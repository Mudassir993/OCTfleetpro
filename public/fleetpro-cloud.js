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
      if(typeof renderAll==='function') renderAll();
      installEquipmentTestUI();
      toast('Connected to Neon ✓');
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

  function installEquipmentTestUI(){
    if(document.getElementById('neonEquipmentBtn')) return;
    if(!cloudUser || cloudUser.role!=='Administrator') return;

    const top=document.querySelector('.top');
    if(top){
      const right=document.querySelector('.topright');
      const btn=document.createElement('button');
      btn.id='neonEquipmentBtn';
      btn.className='btn primary';
      btn.style.cssText='margin-right:2px;white-space:nowrap';
      btn.textContent='＋ Add Equipment';
      btn.onclick=openEquipmentForm;
      if(right) right.insertBefore(btn,right.firstChild); else top.appendChild(btn);
    }

    if(!document.getElementById('equipmentTestModal')){
      const wrap=document.createElement('div');
      wrap.id='equipmentTestModal';
      wrap.className='modal hidden';
      wrap.innerHTML=`<div class="modalbox" style="max-width:680px">
        <div class="modalhead"><h2>Add Equipment</h2><button class="btn secondary" type="button" id="equipmentCloseBtn">Close</button></div>
        <div class="muted" style="margin:8px 0 16px">This test record will be saved to the shared Neon database and should be visible to other users.</div>
        <form id="equipmentTestForm">
          <div class="formgrid">
            <div class="field"><label>Equipment / Asset ID</label><input id="eq_asset" required placeholder="OCT-TEST-001"></div>
            <div class="field"><label>Category</label><select id="eq_category"><option>Excavator</option><option>Wheel Loader</option><option>Backhoe Loader</option><option>Forklift</option><option>Truck</option><option>Generator</option><option>Other</option></select></div>
            <div class="field"><label>Make / Model</label><input id="eq_model" required placeholder="CAT 320"></div>
            <div class="field"><label>Year</label><input id="eq_year" type="number" min="1980" max="2100" placeholder="2024"></div>
            <div class="field"><label>Plate / Registration</label><input id="eq_plate" placeholder="123456"></div>
            <div class="field"><label>Location</label><input id="eq_location" placeholder="OCT Yard / Industrial Area"></div>
            <div class="field"><label>Status</label><select id="eq_status"><option>Available</option><option>Rented</option><option>Maintenance</option><option>Breakdown</option></select></div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn secondary" type="button" id="equipmentCancelBtn">Cancel</button><button class="btn primary" type="submit">Save to Neon</button></div>
        </form>
      </div>`;
      document.body.appendChild(wrap);
      document.getElementById('equipmentCloseBtn').onclick=closeEquipmentForm;
      document.getElementById('equipmentCancelBtn').onclick=closeEquipmentForm;
      document.getElementById('equipmentTestForm').onsubmit=saveEquipmentTest;
    }

    const db=document.createElement('div');
    db.id='neonStatusPill';
    db.className='pill';
    db.textContent='● Neon Database: Connected';
    db.style.cssText='color:#166534;background:#f0fdf4;border-color:#bbf7d0;font-weight:700';
    const right=document.querySelector('.topright');
    if(right) right.appendChild(db);
  }

  function openEquipmentForm(){
    document.getElementById('equipmentTestModal').classList.remove('hidden');
    document.getElementById('eq_asset').focus();
  }
  function closeEquipmentForm(){document.getElementById('equipmentTestModal').classList.add('hidden')}
  async function saveEquipmentTest(e){
    e.preventDefault();
    const rec={
      _id:uid(),
      assetId:document.getElementById('eq_asset').value.trim(),
      category:document.getElementById('eq_category').value,
      model:document.getElementById('eq_model').value.trim(),
      year:document.getElementById('eq_year').value,
      plate:document.getElementById('eq_plate').value.trim(),
      location:document.getElementById('eq_location').value.trim(),
      status:document.getElementById('eq_status').value,
      createdAt:new Date().toISOString(),
      testRecord:true
    };
    try{
      state.fleet=Array.isArray(state.fleet)?state.fleet:[];
      state.fleet.push(rec);
      await window.saveState();
      closeEquipmentForm();
      if(typeof renderAll==='function') renderAll();
      toast('Equipment saved to Neon ✓');
    }catch(err){
      state.fleet=state.fleet.filter(x=>x!==rec);
      toast('⚠ Could not save equipment: '+err.message);
    }
  }

  window.addEventListener('DOMContentLoaded',async()=>{
    if(!token()) return;
    try{
      const me=await api('/api/me'); applyUser(me); await loadCloudState();
      document.getElementById('login').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); buildNav(); buildPages(); showPage(me.role==='Administrator'?'dashboard':'userdash'); document.getElementById('datePill').textContent=new Date().toLocaleDateString(); document.getElementById('userPill').textContent=me.name+' · '+me.role; renderAll(); installEquipmentTestUI();
    }catch(e){sessionStorage.removeItem(TOKEN_KEY)}
  });
})();
