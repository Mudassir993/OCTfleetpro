/* OCT FleetPro - Neon/Vercel cloud adapter. The existing UI remains the presentation layer. */
(function(){
  const TOKEN_KEY='octfleetpro.session';
  let cloudUser=null;
  function token(){return sessionStorage.getItem(TOKEN_KEY)||''}
  async function api(path,opts={}){ const h=Object.assign({'Content-Type':'application/json'},opts.headers||{}); if(token()) h.Authorization='Bearer '+token(); const r=await fetch(path,Object.assign({},opts,{headers:h})); const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.error||('Request failed: '+r.status)); return data; }
  function applyUser(u){cloudUser=u; state.user=u.username; state.role=(u.role==='Administrator'?'admin':'user'); window.octCloudUser=u;}
  window.octCloud={api, get user(){return cloudUser}, token};
  window.login=async function(){
    const username=document.getElementById('username').value.trim(), password=document.getElementById('password').value;
    const btn=document.querySelector('#login button.primary'); if(btn){btn.disabled=true;btn.textContent='Signing in…'}
    try{
      const r=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username,password})}); sessionStorage.setItem(TOKEN_KEY,r.token); applyUser(r.user);
      const cloudState=await api('/api/state'); state=Object.assign(defaultState(),cloudState||{}); ensureIds(state);
      document.getElementById('login').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); buildNav(); buildPages(); showPage(r.user.role==='Administrator'?'dashboard':'userdash'); document.getElementById('datePill').textContent=new Date().toLocaleDateString(); document.getElementById('userPill').textContent=r.user.name+' · '+r.user.role;
      if(typeof renderAll==='function') renderAll(); toast('Connected to Neon ✓');
    }catch(e){alert(e.message||'Sign in failed')}finally{if(btn){btn.disabled=false;btn.textContent='Sign in'}}
  };
  window.logout=async function(){try{await api('/api/auth/logout',{method:'POST'})}catch(e){} sessionStorage.removeItem(TOKEN_KEY);cloudUser=null;location.reload()};
  window.saveState=async function(){
    if(!token()) return;
    try{ await api('/api/state',{method:'PUT',body:JSON.stringify({state,page:'Workspace'})}); }
    catch(e){ console.error(e); toast('⚠ Cloud save failed: '+e.message); }
  };
  window.loadCloudState=async function(){ const s=await api('/api/state'); state=Object.assign(defaultState(),s||{}); ensureIds(state); return state; };
  window.saveUser=async function(e,id){
    e.preventDefault();
    try{
      const payload={username:u_username.value.trim(),name:u_name.value.trim(),role:u_role.value,email:u_email.value.trim(),phone:u_phone.value.trim(),status:u_status.value};
      if(!id){
        const password=prompt('Set a temporary password for this user:');
        if(!password) return;
        payload.password=password;
        await api('/api/users',{method:'POST',body:JSON.stringify(payload)});
      }else{
        await api('/api/users/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(payload)});
      }
      const users=await api('/api/users'); state.users=users.map(u=>({...u,_id:u.id})); closeModal(); renderAll(); toast('User account '+(id?'updated':'created')+' ✓');
    }catch(err){toast('⚠ User save failed: '+err.message)}
  };
  window.upsert=function(coll,id,rec){
    if(id){const ex=find(coll,id);if(ex)Object.assign(ex,rec)} else {rec._id=uid();state[coll].push(rec)}; saveState(); renderAll();
  };
  window.del=function(coll,id){if(!confirm('Delete this record permanently?'))return;state[coll]=state[coll].filter(r=>r._id!==id);saveState();renderAll();toast('Record deleted')};
  window.addEventListener('DOMContentLoaded',async()=>{
    if(!token()) return;
    try{
      const me=await api('/api/me'); applyUser(me); await loadCloudState();
      document.getElementById('login').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); buildNav(); buildPages(); showPage(me.role==='Administrator'?'dashboard':'userdash'); document.getElementById('datePill').textContent=new Date().toLocaleDateString(); document.getElementById('userPill').textContent=me.name+' · '+me.role; renderAll();
    }catch(e){sessionStorage.removeItem(TOKEN_KEY)}
  });
})();
