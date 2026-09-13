const crypto = require('crypto');
const { Pool } = require('pg');
const { handleUpload } = require('@vercel/blob/client');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

function tokenHash(t){ return crypto.createHash('sha256').update(t).digest('hex'); }
async function auth(req, suppliedToken){
  const h=req.headers.authorization||'';
  const raw=h.startsWith('Bearer ')?h.slice(7):(suppliedToken||null);
  if(!raw) return null;
  const c=await pool.connect();
  try{
    const r=await c.query(`SELECT u.id,u.username,u.name,u.role,u.email,u.phone,u.status
      FROM app_sessions s JOIN app_users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='Active'`,[tokenHash(raw)]);
    return r.rows[0]||null;
  }finally{c.release();}
}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}

module.exports = async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'POST required'});
  try{
    // Vercel Node functions expose parsed request bodies. The previous implementation
    // attempted to read the stream again, which could leave handleUpload with an empty body.
    const body = req.body || {};
    let suppliedToken=null;
    try{
      const cp=body?.payload?.clientPayload;
      if(cp){ suppliedToken=JSON.parse(cp).sessionToken||null; }
    }catch(e){ suppliedToken=null; }

    const user=await auth(req,suppliedToken);
    if(!user) return json(res,401,{error:'Authentication required'});
    if(!['Administrator','Supervisor','HR','Data Entry'].includes(user.role)) return json(res,403,{error:'Your role cannot upload employee documents'});

    const response=await handleUpload({
      body,
      request:req,
      onBeforeGenerateToken: async (pathname, clientPayload)=>{
        let meta={};
        try{meta=JSON.parse(clientPayload||'{}')}catch(e){throw new Error('Invalid upload metadata');}
        const key=String(meta.docKey||'');
        const emp=String(meta.employeeId||'');
        const allowedKeys=['qid','passport','licence','certificate1','certificate2','certificate3','certificate4','certificate5'];
        if(!emp || !allowedKeys.includes(key)) throw new Error('Invalid employee document target');
        if(!pathname.startsWith('employees/')) throw new Error('Invalid upload path');
        return {
          allowedContentTypes:['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
          maximumSizeInBytes:20*1024*1024,
          addRandomSuffix:true,
          tokenPayload:JSON.stringify({employeeId:emp,docKey:key,userId:user.id})
        };
      },
      onUploadCompleted: async ({blob,tokenPayload})=>{
        return {ok:true};
      }
    });
    return json(res,200,response);
  }catch(e){
    console.error('Employee Blob upload error',e);
    return json(res,400,{error:e.message||'Blob upload failed'});
  }
};
