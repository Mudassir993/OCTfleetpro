/* OCT FleetPro - keep the original Staff navigation slot and avoid duplicate Staff/Employee entries */
(function(){
  'use strict';
  function fix(){
    try{
      var nav=document.getElementById('nav');
      if(!nav)return false;
      var original=nav.querySelector('button[data-page="staff"]');
      var staffButtons=Array.from(nav.querySelectorAll('button[data-page="staffEmployee"]'));
      if(original){
        original.dataset.page='staffEmployee';
        original.textContent='👥 Staff/Employee';
        original.onclick=function(){
          if(typeof window.showStaffEmployeePage==='function')window.showStaffEmployeePage();
        };
        staffButtons.forEach(function(b){if(b!==original)b.remove();});
      }else if(staffButtons.length>1){
        staffButtons.slice(1).forEach(function(b){b.remove();});
      }
      return true;
    }catch(e){console.warn('Staff navigation fix:',e);return false;}
  }
  document.addEventListener('DOMContentLoaded',function(){
    fix();
    setTimeout(fix,300);
    setTimeout(fix,1000);
    setTimeout(fix,2000);
    setInterval(fix,3000);
  });
})();
