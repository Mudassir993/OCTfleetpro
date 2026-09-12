/* OCT FleetPro - equipment list display compatibility layer */
(function(){
  function esc(v){
    return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]});
  }
  function statusBadge(v){
    const s=String(v||'—');
    const cls=s.toLowerCase().replace(/\s+/g,'');
    return '<span class="badge '+(cls==='available'?'available':cls==='rented'?'rented':cls==='maintenance'?'maintenance':cls==='breakdown'?'breakdown':'available')+'">'+esc(s)+'</span>';
  }
  function renderEquipment(){
    if(!window.state || !Array.isArray(state.fleet)) return;
    const host=document.getElementById('myfleet');
    if(!host) return;
    const arr=state.fleet.filter(function(f){return !f.archived;});
    host.innerHTML='<div class="panel"><h2>My Assigned Equipment</h2><div class="tablewrap"><table><thead><tr><th>Equipment / Asset ID</th><th>Category</th><th>Make / Model</th><th>Year</th><th>Plate / Registration</th><th>Location</th><th>Status</th></tr></thead><tbody>'+
      (arr.map(function(f){
        const id=f.assetId||f.id||'—';
        const category=f.category||f.vehicleType||f.cat||'—';
        const model=f.model||f.vehicleBrand||'—';
        const year=f.year||f.vehicleSize||'—';
        const plate=f.plate||f.id||'—';
        const location=f.location||'—';
        const status=f.status||f.projectStatus||'—';
        return '<tr><td>'+esc(id)+'</td><td>'+esc(category)+'</td><td>'+esc(model)+'</td><td>'+esc(year)+'</td><td>'+esc(plate)+'</td><td>'+esc(location)+'</td><td>'+statusBadge(status)+'</td></tr>';
      }).join('')||'<tr><td colspan="7" class="empty">No equipment assigned.</td></tr>')+
      '</tbody></table></div></div>';
  }
  window.octRefreshEquipmentView=renderEquipment;
  window.addEventListener('DOMContentLoaded',function(){
    setTimeout(renderEquipment,100);
    let last='';
    setInterval(function(){
      if(!window.state || !Array.isArray(state.fleet)) return;
      const sig=JSON.stringify(state.fleet.map(function(f){return [f._id,f.assetId,f.id,f.category,f.vehicleType,f.cat,f.model,f.vehicleBrand,f.year,f.plate,f.location,f.status,f.projectStatus,f.archived];}));
      if(sig!==last){last=sig;renderEquipment();}
    },1000);
  });
})();
