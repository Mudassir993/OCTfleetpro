/* OCT FleetPro - equipment display + Staff/Employee management */
(function(){
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]});}
  function statusBadge(v){var s=String(v||'—'),c=s.toLowerCase().replace(/\s+/g,'');return '<span class="badge '+(c==='available'?'available':c==='rented'?'rented':c==='maintenance'?'maintenance':c==='breakdown'?'breakdown':'available')+'">'+esc(s)+'</span>';}
  function renderEquipment(){
    if(!window.state||!Array.isArray(state.fleet))return;var host=document.getElementById('myfleet');if(!host)return;var arr=state.fleet.filter(function(f){return !f.archived;});
    host.innerHTML='<div class="panel"><h2>My Assigned Equipment</h2><div class="tablewrap"><table><thead><tr><th>Equipment / Asset ID</th><th>Category</th><th>Make / Model</th><th>Year</th><th>Plate / Registration</th><th>Location</th><th>Status</th></tr></thead><tbody>'+(arr.map(function(f){var id=f.assetId||f.id||'—',cat=f.category||f.vehicleType||f.cat||'—',model=f.model||f.vehicleBrand||'—',year=f.year||f.vehicleSize||'—',plate=f.plate||f.id||'—',loc=f.location||'—',st=f.status||f.projectStatus||'—';return '<tr><td>'+esc(id)+'</td><td>'+esc(cat)+'</td><td>'+esc(model)+'</td><td>'+esc(year)+'</td><td>'+esc(plate)+'</td><td>'+esc(loc)+'</td><td>'+statusBadge(st)+'</td></tr>';}).join('')||'<tr><td colspan="7" class="empty">No equipment assigned.</td></tr>')+'</tbody></table></div></div>';
  }
  window.octRefreshEquipmentView=renderEquipment;

  var DOCS=[['qid','QID'],['passport','Passport'],['licence','Licence'],['certificate1','Certificate 1'],['certificate2','Certificate 2'],['certificate3','Certificate 3'],['certificate4','Certificate 4'],['certificate5','Certificate 5']];
  function staffArr(){if(!window.state)return[];state.staff=Array.isArray(state.staff)?state.staff:[];return state.staff;}
  function empId(e){return e.employeeId||e.empId||e.staffId||e.id||e._id;}
  function empName(e){return e.name||e.employeeName||e.fullName||'—';}
  function docs(e){e.documents=e.documents||e.docs||{};return e.documents;}
  function ensureStaffPage(){
    var pages=document.getElementById('pages');if(!pages)return null;var p=document.getElementById('staffEmployee');
    if(!p){p=document.createElement('section');p.id='staffEmployee';p.className='page';pages.appendChild(p);}return p;
  }
  function installStaffNav(){
    var nav=document.getElementById('nav');if(!nav)return false;var b=nav.querySelector('button[data-page="staffEmployee"]')||nav.querySelector('button[data-page="staff"]');
    if(b){b.dataset.page='staffEmployee';b.textContent='👥 Staff/Employee';b.onclick=function(){showStaffEmployeePage();};}
    else if(window.state&&state.role==='admin'){
      b=document.createElement('button');b.dataset.page='staffEmployee';b.textContent='👥 Staff/Employee';b.onclick=function(){showStaffEmployeePage();};nav.appendChild(b);
    }return true;
  }
  function showStaffEmployeePage(){
    var p=ensureStaffPage();if(!p)return;document.querySelectorAll('.page').forEach(function(x){x.classList.remove('active');});p.classList.add('active');document.querySelectorAll('.nav button').forEach(function(x){x.classList.toggle('active',x.dataset.page==='staffEmployee');});var t=document.getElementById('pageTitle');if(t)t.textContent='Staff/Employee';renderStaff();
  }
  function renderStaff(){
    var p=ensureStaffPage();if(!p)return;var arr=staffArr();
    p.innerHTML='<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px"><div><h2 style="margin:0">Staff/Employee</h2><div class="muted">Employee records and document management</div></div><button class="btn primary" onclick="octStaffAdd()">+ Add Employee</button></div><div class="toolbar"><input id="staffEmployeeSearch" placeholder="Search employee ID / name / passport / designation / phone" oninput="octStaffRender()"></div><div class="tablewrap"><table><thead><tr><th>Employee ID</th><th>Name</th><th>Passport No</th><th>Designation</th><th>Phone Number</th><th>Documents Names</th><th>View Document</th><th>Edit</th><th>Delete</th></tr></thead><tbody id="staffEmployeeRows"></tbody></table></div></div>';
    octStaffRender();
  }
  function octStaffRender(){
    var body=document.getElementById('staffEmployeeRows');if(!body)return;var q=(document.getElementById('staffEmployeeSearch')?.value||'').toLowerCase();
    var arr=staffArr().filter(function(e){return [empId(e),empName(e),e.passportNo||e.passport,e.designation,e.phone||e.phoneNumber].join(' ').toLowerCase().includes(q);});
    body.innerHTML=arr.length?arr.map(function(e){var d=docs(e),names=DOCS.filter(function(x){return d[x[0]]&&d[x[0]].name;}).map(function(x){return esc(d[x[0]].name);}).join('<br>')||'—',id=empId(e);return '<tr><td>'+esc(id)+'</td><td>'+esc(empName(e))+'</td><td>'+esc(e.passportNo||e.passport||'—')+'</td><td>'+esc(e.designation||'—')+'</td><td>'+esc(e.phone||e.phoneNumber||'—')+'</td><td style="white-space:normal">'+names+'</td><td><button class="btn secondary mini" onclick="octStaffView(\''+escJs(id)+'\')">View</button></td><td><button class="btn secondary mini" onclick="octStaffEdit(\''+escJs(id)+'\')">Edit</button></td><td><button class="btn danger mini" onclick="octStaffDelete(\''+escJs(id)+'\')">Delete</button></td></tr>';}).join(''):'<tr><td colspan="9" class="empty">No employees yet. Click + Add Employee.</td></tr>';
  }
  function escJs(v){return String(v||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
  function findEmp(id){return staffArr().find(function(e){return String(empId(e))===String(id);});}
  function openStaffModal(title,body){if(typeof openModal==='function'){openModal(title,body);}else{var m=document.getElementById('modal'),h=document.getElementById('modalTitle'),b=document.getElementById('modalBody');h.textContent=title;b.innerHTML=body;m.classList.remove('hidden');}}
  function staffForm(id){
    var e=id?findEmp(id):{};var eid=empId(e)||'';return '<form onsubmit="octStaffSave(event,\''+escJs(id||'')+'\')"><div class="formgrid"><div class="field"><label>Employee ID</label><input id="se_employeeId" required value="'+esc(eid)+'"></div><div class="field"><label>Name</label><input id="se_name" required value="'+esc(empName(e)==='—'?'':empName(e))+'"></div><div class="field"><label>Passport No</label><input id="se_passport" value="'+esc(e.passportNo||e.passport||'')+'"></div><div class="field"><label>Designation</label><input id="se_designation" value="'+esc(e.designation||'')+'"></div><div class="field"><label>Phone Number</label><input id="se_phone" value="'+esc(e.phone||e.phoneNumber||'')+'"></div></div><div style="margin-top:14px">'+(id?'Document files can be managed from View Document.':'After saving, use View Document to upload QID, Passport, Licence and Certificates.')+'</div><div style="display:flex;justify-content:flex-end;margin-top:18px">'+(typeof submitBtn==='function'?submitBtn(id?'Update Employee':'Save Employee'):'<button class="btn primary" type="submit">'+(id?'Update Employee':'Save Employee')+'</button>')+'</div></form>';
  }
  function octStaffAdd(){openStaffModal('Add Employee',staffForm(''));}
  function octStaffEdit(id){openStaffModal('Edit Employee',staffForm(id));}
  function octStaffSave(ev,id){ev.preventDefault();var a=document.getElementById('se_employeeId').value.trim(),e=id?findEmp(id):null;if(!a){alert('Employee ID is required');return;}if(!e){e={_id:(typeof uid==='function'?uid():Date.now().toString(36))};staffArr().push(e);}e.employeeId=a;e.name=document.getElementById('se_name').value.trim();e.passportNo=document.getElementById('se_passport').value.trim();e.designation=document.getElementById('se_designation').value.trim();e.phone=document.getElementById('se_phone').value.trim();docs(e);saveState();if(typeof closeModal==='function')closeModal();renderStaff();if(typeof toast==='function')toast('Employee '+(id?'updated':'added')+' ✓');}
  function octStaffDelete(id){var e=findEmp(id);if(!e)return;if(!confirm('Delete employee '+empName(e)+' and all document records?'))return;state.staff=staffArr().filter(function(x){return String(empId(x))!==String(id);});saveState();renderStaff();if(typeof toast==='function')toast('Employee deleted');}
  function fileRow(e,key,label){var d=docs(e),f=d[key];var current=f&&f.name?'<span style="margin-left:8px;font-size:11px;color:var(--muted)">'+esc(f.name)+'</span>':'';var dl=f&&f.data?'<button type="button" class="btn secondary mini" onclick="octStaffDownload(\''+escJs(empId(e))+'\',\''+key+'\')">Download</button>':(f&&f.url?'<a class="btn secondary mini" target="_blank" rel="noopener" href="'+esc(f.url)+'">Download</a>':'');return '<div style="display:grid;grid-template-columns:150px 1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)"><b style="font-size:12px">'+label+'</b><div><input type="file" id="sf_'+key+'" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onchange="octStaffUpload(\''+escJs(empId(e))+'\',\''+key+'\',this)">'+current+'</div><div>'+dl+'</div></div>';}
  function octStaffView(id){var e=findEmp(id);if(!e)return;var d=docs(e);openStaffModal('Employee Documents — '+empName(e),'<div class="detail"><div><small>Employee ID</small><b>'+esc(empId(e))+'</b></div><div><small>Name</small><b>'+esc(empName(e))+'</b></div><div><small>Passport No</small><b>'+esc(e.passportNo||e.passport||'—')+'</b></div></div><div style="margin-top:16px"><h3 style="font-size:14px;margin:0 0 8px">Documents</h3>'+DOCS.map(function(x){return fileRow(e,x[0],x[1]+' Upload / Download');}).join('')+'</div><div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn secondary" onclick="closeModal()">Close</button></div>');}
  function octStaffUpload(id,key,input){var e=findEmp(id);if(!e||!input.files||!input.files[0])return;var f=input.files[0];if(f.size>12*1024*1024){alert('Please use a file smaller than 12 MB.');input.value='';return;}var reader=new FileReader();reader.onload=function(){docs(e)[key]={name:f.name,type:f.type,size:f.size,data:reader.result,uploadedAt:new Date().toISOString()};saveState();octStaffView(id);if(typeof toast==='function')toast(DOCS.find(function(x){return x[0]===key})[1]+' uploaded ✓');};reader.readAsDataURL(f);}
  function octStaffDownload(id,key){var e=findEmp(id);if(!e)return;var f=docs(e)[key];if(!f)return;if(f.data){var a=document.createElement('a');a.href=f.data;a.download=f.name||key;a.click();return;}if(f.url){window.open(f.url,'_blank');}}
  window.octStaffAdd=octStaffAdd;window.octStaffEdit=octStaffEdit;window.octStaffSave=octStaffSave;window.octStaffDelete=octStaffDelete;window.octStaffView=octStaffView;window.octStaffUpload=octStaffUpload;window.octStaffDownload=octStaffDownload;window.octStaffRender=octStaffRender;window.showStaffEmployeePage=showStaffEmployeePage;

  function boot(){installStaffNav();setTimeout(function(){installStaffNav();},500);setTimeout(function(){installStaffNav();},1500);renderEquipment();if(window.state&&state.role==='admin'){} }
  window.addEventListener('DOMContentLoaded',function(){boot();setInterval(function(){if(window.state&&state.role==='admin'){installStaffNav();}},1000);setInterval(function(){renderEquipment();},1500);});
})();
