const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined });
const ROOT = path.join(process.cwd());
const HTML_PATH = path.join(ROOT, 'index.html');
const CLOUD_JS = `\n<script src="/fleetpro-cloud.js?v=3"></script>\n`;

const DEFAULT_STATE = {
  fleet: [], rentals: [], breakdowns: [], maintenance: [], workshop: [], locations: [], garageInventory: [], staff: [], vehicleRecords: [], documents: [], users: [], timesheet: [],
  proposal: { services: [], compliance: [], jobCards: [], purchaseOrders: [], invoices: [], batteries: [], tires: [], fuel: [], attendance: [], payroll: [], notifications: [] },
  roles: [], audit: [], loginHistory: [], views: {}
};

function json(res, status, body){ res.statusCode=status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(body)); }
function body(req){ return new Promise((resolve,reject)=>{ let s=''; req.on('data',c=>s+=c); req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}}); }); }
function tokenHash(t){ return crypto.createHash('sha256').update(t).digest('hex'); }
function newToken(){ return crypto.randomBytes(32).toString('hex'); }
async function db(){ return pool.connect(); }
async function ensureSchema(){
  const c=await db();
  try{
    await c.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await c.query(`CREATE TABLE IF NOT EXISTS app_users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'View-Only', email TEXT, phone TEXT, status TEXT NOT NULL DEFAULT 'Active', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
    await c.query(`CREATE TABLE IF NOT EXISTS app_workspace (id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id=1), state JSONB NOT NULL DEFAULT '{}'::jsonb, updated_by UUID REFERENCES app_users(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
    await c.query(`CREATE TABLE IF NOT EXISTS app_sessions (token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL);`);
    await c.query(`CREATE TABLE IF NOT EXISTS audit_log (id BIGSERIAL PRIMARY KEY, user_id UUID REFERENCES app_users(id), username TEXT, action TEXT NOT NULL, page TEXT, details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
    await c.query(`CREATE TABLE IF NOT EXISTS login_history (id BIGSERIAL PRIMARY KEY, user_id UUID REFERENCES app_users(id), username TEXT, ip TEXT, browser TEXT, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
    await c.query(`INSERT INTO app_workspace(id,state) VALUES(1,$1) ON CONFLICT(id) DO NOTHING`,[DEFAULT_STATE]);
    const n=await c.query('SELECT COUNT(*)::int AS n FROM app_users');
    if(n.rows[0].n===0){
      const p1=await bcrypt.hash('admin123',12), p2=await bcrypt.hash('staff123',12);
      await c.query(`INSERT INTO app_users(username,password_hash,name,role,email,phone,status) VALUES ($1,$2,$3,$4,$5,$6,'Active'),($7,$8,$9,$10,$11,$12,'Active')`,['admin',p1,'OCT Administrator','Administrator','admin@oct.qa','', 'staff',p2,'Staff User','Supervisor','staff@oct.qa','']);
    }
  } finally { c.release(); }
}
async function auth(req){
  const h=req.headers.authorization||''; const raw=h.startsWith('Bearer ')?h.slice(7):null;
  if(!raw) return null;
  const c=await db();
  try{
    const r=await c.query(`SELECT u.id,u.username,u.name,u.role,u.email,u.phone,u.status FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='Active'`,[tokenHash(raw)]);
    return r.rows[0]||null;
  } finally {c.release();}
}
function canWrite(user){ return user && ['Administrator','Supervisor','HR','Data Entry'].includes(user.role); }
async function audit(user,action,page,details={}){ const c=await db(); try{await c.query(`INSERT INTO audit_log(user_id,username,action,page,details) VALUES($1,$2,$3,$4,$5)`,[user?.id,user?.username,action,page,details]);}finally{c.release();} }

async function handler(req,res){
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); const p=url.pathname;
  if(p==='/api/health'){ try{await ensureSchema(); return json(res,200,{ok:true,database:true})}catch(e){return json(res,500,{ok:false,error:e.message})} }
  if(p==='/' || p==='/api' || p==='/api/index'){
    try{const html=fs.readFileSync(HTML_PATH,'utf8'); res.setHeader('Content-Type','text/html; charset=utf-8'); return res.end(html.replace('</body>',CLOUD_JS+'</body>'));}catch(e){return json(res,500,{error:e.message})}
  }
  if(p==='/fleetpro-cloud.js'){
    try{const js=fs.readFileSync(path.join(ROOT,'public','fleetpro-cloud.js'),'utf8');res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end(js)}catch(e){return json(res,500,{error:e.message})}
  }
  if(p==='/api/auth/login' && req.method==='POST'){
    try{await ensureSchema(); const b=await body(req); const c=await db();
      try{
        const r=await c.query('SELECT * FROM app_users WHERE username=$1',[String(b.username||'').trim()]);
        const u=r.rows[0]; const ok=!!u && u.status==='Active' && await bcrypt.compare(String(b.password||''),u.password_hash);
        await c.query(`INSERT INTO login_history(user_id,username,ip,browser,status) VALUES($1,$2,$3,$4,$5)`,[u?.id,u?.username,req.headers['x-forwarded-for']||'',req.headers['user-agent']||'',ok?'Success':'Failed']);
        if(!ok) return json(res,401,{error:'Invalid username or password'});
        const t=newToken(); await c.query(`INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')`,[tokenHash(t),u.id]);
        await c.query(`DELETE FROM app_sessions WHERE expires_at<=now()`);
        await audit(u,'Login','Login',{});
        return json(res,200,{token:t,user:{id:u.id,username:u.username,name:u.name,role:u.role,email:u.email,phone:u.phone,status:u.status}});
      }finally{c.release();}
    }catch(e){return json(res,500,{error:e.message})}
  }
  if(p==='/api/auth/logout' && req.method==='POST'){ const h=req.headers.authorization||''; if(h.startsWith('Bearer ')){const c=await db();try{await c.query('DELETE FROM app_sessions WHERE token_hash=$1',[tokenHash(h.slice(7))])}finally{c.release();}} return json(res,200,{ok:true}); }

  const user=await auth(req);
  if(p.startsWith('/api/') && !user) return json(res,401,{error:'Authentication required'});

  if(p==='/api/state' && req.method==='GET'){
    const c=await db(); try{const r=await c.query('SELECT state FROM app_workspace WHERE id=1'); return json(res,200,r.rows[0]?.state||DEFAULT_STATE)}finally{c.release();}
  }
  if(p==='/api/state' && req.method==='PUT'){
    if(!canWrite(user)) return json(res,403,{error:'Your role is view-only for data changes'});
    try{const b=await body(req); const c=await db(); try{await c.query(`UPDATE app_workspace SET state=$1,updated_by=$2,updated_at=now() WHERE id=1`,[b.state||DEFAULT_STATE,user.id]); await audit(user,'Updated workspace state',b.page||'Workspace',{}); return json(res,200,{ok:true});}finally{c.release();}}catch(e){return json(res,400,{error:e.message});}
  }
  if(p==='/api/me' && req.method==='GET') return json(res,200,user);
  if(p==='/api/audit' && req.method==='GET'){
    const c=await db(); try{const r=await c.query('SELECT id,username,action,page,details,created_at FROM audit_log ORDER BY created_at DESC LIMIT 500'); return json(res,200,r.rows)}finally{c.release();}
  }
  if(p==='/api/login-history' && req.method==='GET'){
    const c=await db(); try{const r=await c.query('SELECT id,username,ip,browser,status,created_at FROM login_history ORDER BY created_at DESC LIMIT 500'); return json(res,200,r.rows)}finally{c.release();}
  }
  if(p==='/api/users' && req.method==='GET'){
    if(user.role!=='Administrator') return json(res,403,{error:'Administrator access required'});
    const c=await db(); try{const r=await c.query('SELECT id,username,name,role,email,phone,status,created_at,updated_at FROM app_users ORDER BY username'); return json(res,200,r.rows)}finally{c.release();}
  }
  if(p==='/api/users' && req.method==='POST'){
    if(user.role!=='Administrator') return json(res,403,{error:'Administrator access required'});
    try{const b=await body(req); if(!b.username||!b.name||!b.password) return json(res,400,{error:'username, name and password are required'}); const c=await db(); try{const ph=await bcrypt.hash(b.password,12); const r=await c.query(`INSERT INTO app_users(username,password_hash,name,role,email,phone,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,username,name,role,email,phone,status`,[b.username,ph,b.name,b.role||'View-Only',b.email||'',b.phone||'',b.status||'Active']); await audit(user,'Created user','User Accounts',{username:b.username}); return json(res,201,r.rows[0]);}finally{c.release();}}catch(e){return json(res,400,{error:e.code==='23505'?'Username already exists':e.message});}
  }
  if(p.startsWith('/api/users/') && req.method==='PUT'){
    if(user.role!=='Administrator') return json(res,403,{error:'Administrator access required'});
    const id=p.split('/').pop(); try{const b=await body(req); const c=await db(); try{const sets=[];const vals=[]; for(const k of ['username','name','role','email','phone','status']){if(b[k]!==undefined){vals.push(b[k]);sets.push(`${k}=$${vals.length}`)}} if(b.password){vals.push(await bcrypt.hash(b.password,12));sets.push(`password_hash=$${vals.length}`)} if(!sets.length)return json(res,400,{error:'No fields to update'}); vals.push(id); const r=await c.query(`UPDATE app_users SET ${sets.join(',')},updated_at=now() WHERE id=$${vals.length} RETURNING id,username,name,role,email,phone,status`,vals); await audit(user,'Updated user','User Accounts',{id}); return json(res,200,r.rows[0]);}finally{c.release();}}catch(e){return json(res,400,{error:e.message});}
  }
  return json(res,404,{error:'Not found'});
}

module.exports = handler;
