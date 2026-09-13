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
  const c=await pool.connect();
  try{const r=await c.query(`SELECT u.id,u.username,u.name,u.role,u.status FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='Active'`,[tokenHash(raw)]);return r.rows[0]||null;}
  finally{c.release();}
}
module.exports=async function handler(req,res){
  if(req.method!=='GET')return res.status(405).end('GET required');
  try{
    const user=await auth(req);if(!user)return res.status(401).end('Authentication required');
    const pathname=new URL(req.url,`http://${req.headers.host||'localhost'}`).searchParams.get('pathname');
    if(!pathname || !pathname.startsWith('employees/'))return res.status(400).end('Invalid pathname');
    const result=await get(pathname,{access:'private'});
    if(!result || result.statusCode!==200)return res.status(404).end('File not found');
    res.setHeader('Content-Type',result.blob.contentType||'application/octet-stream');
    res.setHeader('Content-Disposition',result.blob.contentDisposition||'attachment');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','private, no-store');
    if(result.blob.etag)res.setHeader('ETag',result.blob.etag);
    if(result.stream && typeof result.stream.getReader==='function')Readable.fromWeb(result.stream).pipe(res);else res.end();
  }catch(e){console.error('Employee Blob download error',e);res.statusCode=500;res.end('Could not retrieve document');}
};
