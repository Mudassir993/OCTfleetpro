/* OCT FleetPro - stable role synchronization without changing existing navigation */
(function(){
  function syncRoleAndStaff(){
    try{
      var u=window.octCloud&&window.octCloud.user;
      if(!u||!window.state)return false;
      var isAdmin=u.role==='Administrator';
      state.role=isAdmin?'admin':'user';
      state.user=u.username;
      var label=document.getElementById('roleLabel');
      if(label)label.textContent=isAdmin?'ADMINISTRATOR':'STAFF / USER';
      /* Do not rebuild the navigation. The original navigation must remain unchanged. */
      if(isAdmin&&typeof window.installStaffNav==='function')window.installStaffNav();
      return true;
    }catch(e){console.warn('Role sync:',e);return false;}
  }
  function wrapLogin(){
    if(typeof window.login!=='function'||window.login.__octStableWrapped)return;
    var original=window.login;
    async function stableLogin(){
      var result=await original.apply(this,arguments);
      syncRoleAndStaff();
      return result;
    }
    stableLogin.__octStableWrapped=true;
    window.login=stableLogin;
  }
  window.addEventListener('DOMContentLoaded',function(){
    wrapLogin();
    setTimeout(wrapLogin,0);
    setTimeout(syncRoleAndStaff,50);
  });
})();
