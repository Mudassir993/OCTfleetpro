const crypto = require('crypto');
const { Pool } = require('pg');
const { issueSignedToken, presignUrl } = require('@vercel/blob');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

const DOC_KEYS=['qid','passport','licence','certificate1','certificate2','certificate3','certificate4','certificate5'];
const TYPES=['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX=20*1024*1024;

function tokenHash(t){return crypto.createHash('sha256').update(t).digest('hex');}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}
function parseBody(req){
  if(req.body&&typeof req.body==='object')return Promise.resolve(req.body);
  return new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject);});
}
async function auth(req){
  const h=req.headers.authorization||'';const raw=h.startsWith('Bearer ')?h.slice(7):null;if(!raw)return null;
  const c=await pool.connect();try{const r=await c.query(`SELECT u.id,u.username,u.name,u.role,u.status FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='Active'`,[tokenHash(raw)]);return r.rows[0]||null;}finally{c.release();}
}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'POST required'});
  try{
    const user=await auth(req);if(!user)return json(res,401,{error:'Authentication required'});
    if(!['Administrator','Supervisor','HR','Data Entry'].includes(user.role))return json(res,403,{error:'Your role cannot upload employee documents'});
    const b=await parseBody(req);
    const employeeId=String(b.employeeId||'').trim();
    const docKey=String(b.docKey||'').trim();
    const filename=String(b.filename||'document').trim().replace(/[^a-zA-Z0-9._ -]/g,'_').slice(-160)||'document';
    const contentType=String(b.contentType||'application/octet-stream');
    const size=Number(b.size||0);
    if(!employeeId||!DOC_KEYS.includes(docKey))return json(res,400,{error:'Invalid employee document target'});
    if(!TYPES.includes(contentType))return json(res,400,{error:'Unsupported document type'});
    if(!Number.isFinite(size)||size<=0||size>MAX)return json(res,400,{error:'Document size must be between 1 byte and 20 MB'});
    const c=await pool.connect();try{const er=await c.query('SELECT id FROM employees WHERE id=$1',[employeeId]);if(!er.rows[0])return json(res,404,{error:'Employee not found'});}finally{c.release();}
    const pathname=`employees/${employeeId}/${docKey}/${crypto.randomBytes(8).toString('hex')}-${filename}`;
    const validUntil=Date.now()+15*60*1000;
    const signed=await issueSignedToken({pathname,operations:['put'],validUntil,allowedContentTypes:[contentType],maximumSizeInBytes:size});
    const result=await presignUrl(signed,{pathname,operation:'put',validUntil,access:'private'});
    return json(res,200,{ok:true,pathname,presignedUrl:result.presignedUrl,expiresAt:validUntil});
  }catch(e){console.error('Employee Blob signed upload error',e);return json(res,500,{error:e.message||'Could not create secure upload URL'});}
};
