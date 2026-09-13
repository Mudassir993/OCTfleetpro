const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

const DOC_KEYS=['qid','passport','licence','certificate1','certificate2','certificate3','certificate4','certificate5'];

function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}
function tokenHash(t){return crypto.createHash('sha256').update(t).digest('hex');}
function parseBody(req){
  if(req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject);});
}
async function auth(req){
  const h=req.headers.authorization||'';const raw=h.startsWith('Bearer ')?h.slice(7):null;if(!raw)return null;
  const c=await pool.connect();try{const r=await c.query(`SELECT u.id,u.username,u.name,u.role,u.status FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='Active'`,[tokenHash(raw)]);return r.rows[0]||null;}finally{c.release();}
}
function canWrite(u){return u&&['Administrator','Supervisor','HR','Data Entry'].includes(u.role);}
async function audit(u,action,details={}){const c=await pool.connect();try{await c.query(`INSERT INTO audit_log(user_id,username,action,page,details) VALUES($1,$2,$3,$4,$5)`,[u.id,u.username,action,'Staff/Employee',details]);}finally{c.release();}}

async function ensureSchema(){
  const c=await pool.connect();
  try{
    await c.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await c.query(`CREATE TABLE IF NOT EXISTS employees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employee_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      passport_no TEXT NOT NULL DEFAULT '', designation TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '', joining_date DATE, employment_status TEXT NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by UUID REFERENCES app_users(id), updated_by UUID REFERENCES app_users(id)
    );`);
    await c.query(`CREATE TABLE IF NOT EXISTS employee_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      doc_key TEXT NOT NULL, pathname TEXT NOT NULL, name TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT '',
      size_bytes BIGINT NOT NULL DEFAULT 0, etag TEXT, expiry_date DATE, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      uploaded_by UUID REFERENCES app_users(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(employee_id,doc_key)
    );`);
    await c.query(`CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);`);
    await c.query(`CREATE INDEX IF NOT EXISTS idx_employees_passport ON employees(passport_no);`);
    await c.query(`CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry ON employee_documents(expiry_date);`);
    const n=await c.query('SELECT COUNT(*)::int n FROM employees');
    if(n.rows[0].n===0){
      const w=await c.query('SELECT state FROM app_workspace WHERE id=1');
      const staff=Array.isArray(w.rows[0]?.state?.staff)?w.rows[0].state.staff:[];
      for(const e of staff){
        const employeeId=String(e.employeeId||e.empId||e.staffId||e.id||e._id||'').trim();
        const name=String(e.name||e.employeeName||e.fullName||'').trim();if(!employeeId||!name)continue;
        try{
          const r=await c.query(`INSERT INTO employees(employee_id,name,passport_no,designation,phone,email,joining_date,employment_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(employee_id) DO NOTHING RETURNING id`,[employeeId,name,String(e.passportNo||e.passport||''),String(e.designation||''),String(e.phone||e.phoneNumber||''),String(e.email||''),e.joiningDate||null,String(e.employmentStatus||'Active')]);
          const id=r.rows[0]?.id;if(!id)continue;
          const docs=e.documents||e.docs||{};
          for(const key of DOC_KEYS){const f=docs[key];if(!f||!f.pathname)continue;await c.query(`INSERT INTO employee_documents(employee_id,doc_key,pathname,name,content_type,size_bytes,etag,expiry_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(employee_id,doc_key) DO NOTHING`,[id,key,String(f.pathname),String(f.name||key),String(f.type||''),Number(f.size||0),f.etag||null,f.expiryDate||null]);}
        }catch(err){console.warn('Employee migration skipped:',employeeId,err.message);}
      }
    }
  }finally{c.release();}
}

module.exports=async function handler(req,res){
  try{
    const user=await auth(req);if(!user)return json(res,401,{error:'Authentication required'});
    await ensureSchema();
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);const action=url.searchParams.get('action')||'';const id=url.searchParams.get('id');

    if(action==='document' && req.method==='POST'){
      if(!canWrite(user))return json(res,403,{error:'Your role cannot upload employee documents'});
      const b=await parseBody(req);const employeeId=String(b.employeeId||'');const key=String(b.docKey||'');
      if(!employeeId||!DOC_KEYS.includes(key)||!String(b.pathname||'').startsWith('employees/'))return json(res,400,{error:'Invalid employee document data'});
      const c=await pool.connect();try{
        const er=await c.query('SELECT id FROM employees WHERE id=$1',[employeeId]);if(!er.rows[0])return json(res,404,{error:'Employee not found'});
        const r=await c.query(`INSERT INTO employee_documents(employee_id,doc_key,pathname,name,content_type,size_bytes,etag,expiry_date,uploaded_by,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) ON CONFLICT(employee_id,doc_key) DO UPDATE SET pathname=EXCLUDED.pathname,name=EXCLUDED.name,content_type=EXCLUDED.content_type,size_bytes=EXCLUDED.size_bytes,etag=EXCLUDED.etag,expiry_date=EXCLUDED.expiry_date,uploaded_by=EXCLUDED.uploaded_by,uploaded_at=now(),updated_at=now() RETURNING *`,[employeeId,key,b.pathname,b.name||key,b.type||'',Number(b.size||0),b.etag||null,b.expiryDate||null,user.id]);
        await audit(user,'Uploaded/updated employee document',{employeeId,docKey:key,documentName:b.name||key});return json(res,200,{ok:true,document:r.rows[0]});
      }finally{c.release();}
    }

    if(id){
      if(req.method==='GET'){
        const c=await pool.connect();try{const r=await c.query(`SELECT e.*,COALESCE(jsonb_object_agg(d.doc_key,jsonb_build_object('id',d.id,'pathname',d.pathname,'name',d.name,'type',d.content_type,'size',d.size_bytes,'etag',d.etag,'expiryDate',d.expiry_date,'uploadedAt',d.uploaded_at)) FILTER (WHERE d.id IS NOT NULL),'{}'::jsonb) documents FROM employees e LEFT JOIN employee_documents d ON d.employee_id=e.id WHERE e.id=$1 GROUP BY e.id`,[id]);if(!r.rows[0])return json(res,404,{error:'Employee not found'});return json(res,200,{employee:r.rows[0]});}finally{c.release();}}
      if(req.method==='PUT'){
        if(!canWrite(user))return json(res,403,{error:'Your role is view-only for data changes'});const b=await parseBody(req);const c=await pool.connect();try{const r=await c.query(`UPDATE employees SET employee_id=$1,name=$2,passport_no=$3,designation=$4,phone=$5,email=$6,joining_date=$7,employment_status=$8,updated_by=$9,updated_at=now() WHERE id=$10 RETURNING *`,[String(b.employeeId||'').trim(),String(b.name||'').trim(),String(b.passportNo||''),String(b.designation||''),String(b.phone||''),String(b.email||''),b.joiningDate||null,String(b.employmentStatus||'Active'),user.id,id]);if(!r.rows[0])return json(res,404,{error:'Employee not found'});await audit(user,'Updated employee',{employeeId:r.rows[0].employee_id,employeeDbId:id});return json(res,200,{employee:r.rows[0]});}catch(e){if(e.code==='23505')return json(res,409,{error:'Employee ID already exists. Please use a unique Employee ID.'});throw e;}finally{c.release();}}
      if(req.method==='DELETE'){
        if(!canWrite(user))return json(res,403,{error:'Your role is view-only for data changes'});const c=await pool.connect();try{const r=await c.query('DELETE FROM employees WHERE id=$1 RETURNING employee_id,name',[id]);if(!r.rows[0])return json(res,404,{error:'Employee not found'});await audit(user,'Deleted employee',{employeeId:r.rows[0].employee_id,name:r.rows[0].name});return json(res,200,{ok:true});}finally{c.release();}}
    }

    if(req.method==='GET'){
      const q=String(url.searchParams.get('q')||'').trim();const p=Math.max(1,Number(url.searchParams.get('page')||1));const ps=Math.min(50,Math.max(5,Number(url.searchParams.get('pageSize')||10)));const offset=(p-1)*ps;const c=await pool.connect();try{
        const where=q?`WHERE e.employee_id ILIKE $1 OR e.name ILIKE $1 OR e.passport_no ILIKE $1 OR e.designation ILIKE $1 OR e.phone ILIKE $1`:'';const params=q?[`%${q}%`]:[];
        const count=await c.query(`SELECT COUNT(*)::int n FROM employees e ${where}`,params);const total=count.rows[0].n;
        const r=await c.query(`SELECT e.*,COALESCE(jsonb_object_agg(d.doc_key,jsonb_build_object('id',d.id,'pathname',d.pathname,'name',d.name,'type',d.content_type,'size',d.size_bytes,'etag',d.etag,'expiryDate',d.expiry_date,'uploadedAt',d.uploaded_at)) FILTER (WHERE d.id IS NOT NULL),'{}'::jsonb) documents FROM employees e LEFT JOIN employee_documents d ON d.employee_id=e.id ${where} GROUP BY e.id ORDER BY e.employee_id ASC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,ps,offset]);
        return json(res,200,{items:r.rows,total,page:p,pageSize:ps,totalPages:Math.ceil(total/ps)});
      }finally{c.release();}
    }
    if(req.method==='POST'){
      if(!canWrite(user))return json(res,403,{error:'Your role is view-only for data changes'});const b=await parseBody(req);const employeeId=String(b.employeeId||'').trim(),name=String(b.name||'').trim();if(!employeeId||!name)return json(res,400,{error:'Employee ID and Full Name are required'});const c=await pool.connect();try{const r=await c.query(`INSERT INTO employees(employee_id,name,passport_no,designation,phone,email,joining_date,employment_status,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING *`,[employeeId,name,String(b.passportNo||''),String(b.designation||''),String(b.phone||''),String(b.email||''),b.joiningDate||null,String(b.employmentStatus||'Active'),user.id]);await audit(user,'Created employee',{employeeId,name});return json(res,201,{employee:r.rows[0]});}catch(e){if(e.code==='23505')return json(res,409,{error:'Employee ID already exists. Please use a unique Employee ID.'});throw e;}finally{c.release();}}
    return json(res,405,{error:'Method not allowed'});
  }catch(e){console.error('Employees API:',e);return json(res,500,{error:e.message||'Employee API error'});}
};
