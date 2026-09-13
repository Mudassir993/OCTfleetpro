/* OCT FleetPro - stable Administrator role synchronization */
(function(){
  function syncAdmin(){
    try{
      var u=window.octCloud&&window.octCloud.user;
      if(!u||!window.state)return false;
      var isAdmin=u.role==='Administrator';
      state.role=isAdmin?'admin':'user';
      state.user=u.username;
      var label=document.getElementById('roleLabel');
      if(label)label.textContent=isAdmin?'ADMINISTRATOR':'STAFF / USER';
      if(isAdmin){
        if(typeof window.buildNav==='function')window.buildNav();
        if(typeof window.buildPages==='function')window.buildPages();
        if(typeof window.octInstallStaffNav==='function')window.octInstallStaffNav();
        if(typeof window.showPage==='function')window.showPage('dashboard');
      }
      return true;
    }catch(e){console.warn('Role sync:',e);return false;}
  }
  function wrapLogin(){
    if(typeof window.login!=='function'||window.login.__octStableWrapped)return;
    var original=window.login;
    async function stableLogin(){
      var result=await original.apply(this,arguments);
      syncAdmin();
      return result;
    }
    stableLogin.__octStableWrapped=true;
    window.login=stableLogin;
  }
  window.addEventListener('DOMContentLoaded',function(){
    wrapLogin();
    setTimeout(wrapLogin,0);
    setTimeout(syncAdmin,50);
  });
})();
