const crypto = require('crypto');
const { Readable } = require('stream');
const { Pool } = require('pg');
const { get } = require('@vercel/blob');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});
function tokenHash(t){return crypto.createHash('sha256').update(t).digest('hex');}
async function auth(req){
  const h=req.headers.authorization||'';const raw=h.startsWith('Bearer ')?h.slice(7):null;if(!raw)return null;
  const c=await pool.connect();try{const r=await c.query(`SELECT u.id,u.username,u.name,u.role,u.status FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='Active'`,[tokenHash(raw)]);return r.rows[0]||null;}finally{c.release();}
}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}
module.exports=async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'GET required'});
  try{
    const user=await auth(req);if(!user)return json(res,401,{error:'Authentication required'});
    const pathname=new URL(req.url,`http://${req.headers.host||'localhost'}`).searchParams.get('pathname')||'';
    if(!pathname.startsWith('employees/'))return json(res,400,{error:'Invalid pathname'});
    const c=await pool.connect();let doc;
    try{const r=await c.query('SELECT id,doc_key,name,content_type FROM employee_documents WHERE pathname=$1',[pathname]);doc=r.rows[0];}finally{c.release();}
    if(!doc)return json(res,404,{error:'Document not registered'});
    const result=await get(pathname,{access:'private'});
    if(!result||!result.stream)return json(res,404,{error:'File not found in secure storage'});
    const blob=result.blob||{};
    res.setHeader('Content-Type',doc.content_type||blob.contentType||'application/octet-stream');
    res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(doc.name||blob.pathname||'document')}`);
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, no-store');if(blob.etag)res.setHeader('ETag',blob.etag);
    if(typeof result.stream.getReader==='function')return Readable.fromWeb(result.stream).pipe(res);
    if(typeof result.stream.pipe==='function')return result.stream.pipe(res);
    return res.end();
  }catch(e){console.error('Employee Blob download error',e);return json(res,500,{error:e.message||'Could not retrieve document'});}
};
