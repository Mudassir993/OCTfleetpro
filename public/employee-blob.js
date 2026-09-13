/* OCT FleetPro - private Vercel Blob storage for Staff/Employee documents */
(function(){
  const MAX=20*1024*1024;
  let blobClientPromise=null;
  function token(){return sessionStorage.getItem('octfleetpro.session')||'';}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]});}
  function safe(v){return String(v||'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);}
  function blobClient(){
    if(!blobClientPromise) blobClientPromise=import('https://esm.sh/@vercel/blob@2.6.1/client');
    return blobClientPromise;
  }
  async function uploadBlob(employeeId,key,file){
    if(!file)throw new Error('No file selected');
    if(file.size>MAX)throw new Error('File is larger than 20 MB');
    const mod=await blobClient();
    const name=safe(file.name||key);
    return await mod.upload('employees/'+safe(employeeId)+'/'+key+'/'+name,file,{
      access:'private',
      handleUploadUrl:'/api/employee-blob-upload',
      clientPayload:JSON.stringify({employeeId:String(employeeId),docKey:key}),
      multipart:file.size>4*1024*1024,
      onUploadProgress:function(p){
        if(typeof toast==='function' && p && p.percentage>=0 && p.percentage<100) toast('Uploading '+Math.round(p.percentage)+'%');
      }
    });
  }
  function findEmp(id){return window.state&&Array.isArray(state.staff)?state.staff.find(function(e){return String(e.employeeId||e.empId||e.staffId||e.id||e._id)===String(id);}):null;}
  function docs(e){e.documents=e.documents||e.docs||{};return e.documents;}
  function docName(key){var a={qid:'QID',passport:'Passport',licence:'Licence',certificate1:'Certificate 1',certificate2:'Certificate 2',certificate3:'Certificate 3',certificate4:'Certificate 4',certificate5:'Certificate 5'};return a[key]||key;}
  async function newUpload(id,key,input){
    const e=findEmp(id);const file=input&&input.files&&input.files[0];if(!e||!file)return;
    try{
      input.disabled=true;
      const blob=await uploadBlob(id,key,file);
      docs(e)[key]={provider:'vercel-blob',pathname:blob.pathname,name:file.name,type:file.type,size:file.size,etag:blob.etag,uploadedAt:new Date().toISOString()};
      await window.saveState();
      if(typeof window.octStaffView==='function')window.octStaffView(id);
      if(typeof toast==='function')toast(docName(key)+' uploaded to secure Blob ✓');
    }catch(err){console.error(err);if(typeof toast==='function')toast('⚠ Upload failed: '+(err.message||err));else alert(err.message||err);}
    finally{if(input)input.disabled=false;}
  }
  async function downloadBlob(id,key){
    const e=findEmp(id);if(!e)return;const f=docs(e)[key];if(!f)return;
    if(f.provider==='vercel-blob'&&f.pathname){
      try{
        const r=await fetch('/api/employee-file?pathname='+encodeURIComponent(f.pathname),{headers:{Authorization:'Bearer '+token()}});
        if(!r.ok)throw new Error('Download failed ('+r.status+')');
        const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=f.name||key;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},60000);return;
      }catch(err){toast('⚠ Download failed: '+err.message);return;}
    }
    if(f.data){const a=document.createElement('a');a.href=f.data;a.download=f.name||key;a.click();return;}
    if(f.url){window.open(f.url,'_blank');}
  }
  async function migrateExisting(){
    if(!window.state||!Array.isArray(state.staff))return;
    const keys=['qid','passport','licence','certificate1','certificate2','certificate3','certificate4','certificate5'];
    let total=0;
    for(const e of state.staff){
      const id=e.employeeId||e.empId||e.staffId||e.id||e._id;const d=docs(e);
      for(const key of keys){
        const f=d[key];
        if(!f||!f.data||f.provider==='vercel-blob')continue;
        try{
          const resp=await fetch(f.data);const b=await resp.blob();const blob=await uploadBlob(id,key,new File([b],f.name||key,{type:f.type||b.type||'application/octet-stream'}));
          d[key]={provider:'vercel-blob',pathname:blob.pathname,name:f.name||key,type:f.type||b.type,size:f.size||b.size,etag:blob.etag,uploadedAt:new Date().toISOString()};
          total++;await window.saveState();
        }catch(err){console.error('Migration failed',id,key,err);}
      }
    }
    if(typeof toast==='function')toast(total?('Migrated '+total+' document(s) to Vercel Blob ✓'):'No legacy document data found.');
    if(typeof window.octStaffRender==='function')window.octStaffRender();
  }
  window.octStaffUpload=newUpload;
  window.octStaffDownload=downloadBlob;
  window.octMigrateEmployeeDocuments=migrateExisting;
  function install(){
    if(!window.state)return;
    const nav=document.getElementById('nav');
    if(nav&&!nav.querySelector('[data-page="staffEmployee"]')){
      const b=Array.from(nav.querySelectorAll('button')).find(function(x){return /Staff/.test(x.textContent||'');});
      if(b){b.dataset.page='staffEmployee';b.textContent='👥 Staff/Employee';}
    }
    const page=document.getElementById('staffEmployee');
    if(page&&window.state.role==='admin'&&!page.dataset.blobButton){
      const panel=page.querySelector('.panel');const head=panel&&panel.firstElementChild;
      if(head){const btn=document.createElement('button');btn.className='btn secondary';btn.style.marginLeft='8px';btn.textContent='☁ Migrate Existing Documents';btn.onclick=function(){migrateExisting();};head.appendChild(btn);page.dataset.blobButton='1';}
    }
  }
  window.addEventListener('DOMContentLoaded',function(){setTimeout(install,700);setInterval(install,1500);});
})();
