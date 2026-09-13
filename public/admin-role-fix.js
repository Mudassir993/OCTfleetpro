/* OCT FleetPro - restore Admin role after cloud state hydration */
(function(){
  function fixAdminRole(){
    try{
      var u=window.octCloud&&window.octCloud.user;
      if(!u || u.role!=='Administrator' || !window.state) return false;
      if(state.role!=='admin') state.role='admin';
      state.user=u.username;
      var label=document.getElementById('roleLabel');
      if(label) label.textContent='ADMINISTRATOR';
      if(typeof window.buildNav==='function') window.buildNav();
      if(typeof window.installStaffNav==='function') window.installStaffNav();
      if(typeof window.installEquipmentTestUI==='function') window.installEquipmentTestUI();
      return true;
    }catch(e){ console.warn('Admin role fix:',e); return false; }
  }
  window.addEventListener('DOMContentLoaded',function(){
    fixAdminRole();
    setTimeout(fixAdminRole,300);
    setTimeout(fixAdminRole,1000);
    setTimeout(fixAdminRole,2000);
    setInterval(fixAdminRole,1000);
  });
})();
