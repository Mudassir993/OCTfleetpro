/* OCT FleetPro - route correction for expiry-date saves */
(function(){
  function token(){return sessionStorage.getItem('octfleetpro.session')||'';}
  async function api(url,opts={}){const h=Object.assign({'Content-Type':'application/json'},opts.headers||{});if(token())h.Authorization='Bearer '+token();const r=await fetch(url,Object.assign({},opts,{headers:h}));const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||('Request failed: '+r.status));return d;}
  window.octStaffSaveExpiry=async function(id,key){const input=document.getElementById('sp_exp_'+key);if(!input)return;try{await api('/api/employee-expiry',{method:'PUT',body:JSON.stringify({employeeId:id,docKey:key,expiryDate:input.value||null})});if(typeof toast==='function')toast('Expiry date saved ✓');if(typeof window.octStaffView==='function')await window.octStaffView(id);}catch(e){if(typeof toast==='function')toast('⚠ '+e.message);else alert(e.message);}};
})();
