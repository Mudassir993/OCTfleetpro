/* OCT FleetPro - keep production Staff/Employee navigation binding stable */
(function(){
  function rebind(){
    try{
      if(typeof window.installStaffNav==='function')window.installStaffNav();
      var b=document.querySelector('#nav button[data-page="staffEmployee"]');
      if(b&&typeof window.showStaffEmployeePage==='function')b.onclick=window.showStaffEmployeePage;
    }catch(e){console.warn('Staff navigation:',e);}
  }
  window.addEventListener('DOMContentLoaded',function(){setTimeout(rebind,900);setInterval(rebind,1000);});
})();
