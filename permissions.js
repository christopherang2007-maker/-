/* 多角色权限、老师个人补习讯息与后台权限控制。权限采用允许项目的联集。 */
(()=>{
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const weekdays=['星期一','星期二','星期三','星期四','星期五','星期六'];
  const grades=['一年级','二年级','三年级','四年级','五年级','六年级'];
  const roleLabels={
    van_uncle:'Uncle van',school_teacher:'学校点名老师',ordinary_childcare_teacher:'普通托育老师',
    childcare_teacher:'托育老师',control_teacher:'控制老师',tuition_teacher:'补习老师'
  };
  const roleGroups={van_uncle:'学校点名组',school_teacher:'学校点名组',ordinary_childcare_teacher:'老师组',childcare_teacher:'老师组',control_teacher:'老师组',tuition_teacher:'补习老师'};
  const rolePages={
    van_uncle:['school'],
    school_teacher:['summary','school'],
    ordinary_childcare_teacher:['summary','care','mealcheck','tuition','dailyrecord'],
    childcare_teacher:['summary','school','care','mealcheck','stay','tuition','dailyrecord','special','teacher_tuition'],
    control_teacher:['summary','school','care','mealcheck','stay','tuition','dailyrecord','admin','special','teacher_tuition'],
    tuition_teacher:['summary','mealcheck','stay','tuition','dailyrecord','teacher_tuition']
  };
  let tuitionDay=weekdays[Math.max(0,Math.min(5,new Date().getDay()-1))]||'星期一';
  let tuitionGrade='全部年级',tuitionTime='';
  let permissionRows=[],editingEmail='';

  function roles(){return Array.isArray(window.staffAccess?.roles)?window.staffAccess.roles:[]}
  function allowedPages(){return new Set(roles().flatMap(role=>rolePages[role]||[]))}
  window.staffCanPage=page=>allowedPages().has(page);
  window.staffCanAction=action=>{
    const current=roles();
    if(action==='care_send')return current.some(role=>['childcare_teacher','control_teacher'].includes(role));
    if(action==='permission_control')return current.includes('control_teacher');
    return false;
  };

  function parseTuition(value){
    if(Array.isArray(value))return value.map(item=>({day:item.day||item.week||'',time:item.time||'',teacher:item.teacher||'',subject:item.subject||'',place:item.place||''})).filter(item=>item.day&&item.time);
    const text=String(value||'').trim();if(!text)return [];
    try{const data=JSON.parse(text);if(Array.isArray(data))return parseTuition(data)}catch{}
    return text.split(/[；;\n]+/).map(raw=>{const parts=raw.trim().split(/[｜|]/).map(part=>part.trim()),match=parts[0]?.match(/(星期[一二三四五六])\s*(\d{1,2}:\d{2})/);return match?{day:match[1],time:match[2],teacher:parts[1]||'',subject:parts[2]||'',place:parts[3]||''}:null}).filter(Boolean);
  }

  function addTeacherTuitionPage(){
    if($('teacher_tuition'))return;
    const admin=$('admin');if(!admin)return;
    admin.insertAdjacentHTML('beforebegin',`<section id="teacher_tuition" class="page hidden"><div class="card teacher-tuition-card"><div class="teacher-identity"><span>当前补习老师身份</span><strong id="teacherTuitionIdentity">尚未读取</strong></div><h2 class="section-title">（老师）补习讯息</h2><p class="muted">只显示学生资料中“补习老师”与当前登录身份名字相同的课程。</p><div class="week-tabs" id="teacherTuitionDays"></div><div class="time-tabs teacher-grade-tabs" id="teacherTuitionGrades"></div><div class="time-tabs" id="teacherTuitionTimes"></div><div id="teacherTuitionList"></div></div></section>`);
    const nav=document.querySelector('.nav');
    nav?.insertAdjacentHTML('beforeend','<button data-page="teacher_tuition"><b class="num">00</b>（老师）补习讯息</button>');
    const button=document.querySelector('[data-page="teacher_tuition"]');
    if(button)button.onclick=event=>{if(!window.staffCanPage('teacher_tuition'))return;showPage(event.currentTarget,'teacher_tuition','（老师）补习讯息');renderTeacherTuition()};
    installPermissionStyle();renumberNav();
  }

  function showPage(button,page,title){
    document.querySelectorAll('.nav button').forEach(item=>item.classList.remove('active'));button.classList.add('active');
    document.querySelectorAll('.page').forEach(item=>item.classList.add('hidden'));$(page)?.classList.remove('hidden');
    if($('pageTitle'))$('pageTitle').textContent=title;
  }

  function teacherEntries(){
    const identity=String(window.staffAccess?.displayName||'').trim().toLocaleLowerCase();
    if(!identity)return [];
    return (window.students||students||[]).flatMap(student=>parseTuition(student.tuition).filter(item=>String(item.teacher||'').trim().toLocaleLowerCase()===identity).map(item=>({student,item})));
  }

  function renderTeacherTuition(){
    if(!$('teacherTuitionList'))return;
    const identity=String(window.staffAccess?.displayName||'').trim();
    $('teacherTuitionIdentity').textContent=identity||'管理员尚未填写身份名字';
    const all=teacherEntries();
    const dayRows=all.filter(row=>row.item.day===tuitionDay);
    const times=[...new Set(dayRows.map(row=>row.item.time).filter(Boolean))].sort();
    if(!times.includes(tuitionTime))tuitionTime=times[0]||'';
    $('teacherTuitionDays').innerHTML=weekdays.map(day=>`<button class="${day===tuitionDay?'active':''}" data-value="${esc(day)}">${esc(day)}</button>`).join('');
    $('teacherTuitionGrades').innerHTML=['全部年级',...grades].map(grade=>`<button class="${grade===tuitionGrade?'active':''}" data-value="${esc(grade)}">${esc(grade)}</button>`).join('');
    $('teacherTuitionTimes').innerHTML=(times.length?times:['暂无补习时间']).map(time=>`<button class="${time===(tuitionTime||'暂无补习时间')?'active':''}" data-value="${esc(time)}">${esc(time)}</button>`).join('');
    $('teacherTuitionDays').querySelectorAll('button').forEach(button=>button.onclick=()=>{tuitionDay=button.dataset.value;tuitionTime='';renderTeacherTuition()});
    $('teacherTuitionGrades').querySelectorAll('button').forEach(button=>button.onclick=()=>{tuitionGrade=button.dataset.value;renderTeacherTuition()});
    $('teacherTuitionTimes').querySelectorAll('button').forEach(button=>button.onclick=()=>{tuitionTime=button.dataset.value==='暂无补习时间'?'':button.dataset.value;renderTeacherTuition()});
    const visible=dayRows.filter(row=>(tuitionGrade==='全部年级'||row.student.grade===tuitionGrade)&&(!tuitionTime||row.item.time===tuitionTime));
    $('teacherTuitionList').innerHTML=!identity?'<div class="notice">控制老师尚未在权限控制填写您的身份名字，因此暂时无法配对补习资料。</div>':visible.length?visible.map(({student,item})=>`<article class="tuition-teacher-row"><div><b>${esc(student.name)}</b><small>${esc(student.grade)}</small></div><strong>${esc(item.time)}</strong><div>${esc(item.subject||'补习')}<small>${esc(item.place||'地点未填写')}</small></div></article>`).join(''):`<p class="muted">${esc(identity)}在${esc(tuitionDay)}${tuitionTime?' '+esc(tuitionTime):''}没有符合条件的学生。</p>`;
  }

  function installPermissionStyle(){
    if($('staffPermissionStyle'))return;
    document.head.insertAdjacentHTML('beforeend',`<style id="staffPermissionStyle">
      body.no-care-send #bulkAutomaticWhatsapp{display:none!important}.teacher-identity{display:flex;justify-content:space-between;gap:16px;align-items:center;background:#edf4ff;border:1px solid #bfd2ff;border-radius:12px;padding:13px 16px;margin-bottom:18px}.teacher-identity span{color:#65738c;font-size:13px}.teacher-identity strong{color:#245ccc;font-size:18px}.tuition-teacher-row{display:grid;grid-template-columns:1.3fr .65fr 1.5fr;gap:15px;align-items:center;padding:14px;border-top:1px solid #e5eaf2}.tuition-teacher-row small{display:block;color:#6e7b91;font-weight:400;margin-top:3px}.permission-panel{margin-top:15px}.permission-role-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.permission-role{border:1px solid #e5eaf2;border-radius:9px;padding:9px;background:#f8faff}.permission-role small{display:block;color:#6e7b91;margin-left:22px}.permission-school-list{display:flex;flex-wrap:wrap;gap:8px}.permission-school-list label{border:1px solid #d8e1ef;border-radius:8px;padding:7px 9px}.permission-row{display:grid;grid-template-columns:1.1fr .8fr 1.5fr auto;gap:12px;align-items:center;padding:13px 5px;border-top:1px solid #e5eaf2}.permission-row small{display:block;color:#6e7b91;margin-top:3px}.permission-status{font-size:11px;border-radius:99px;padding:4px 8px;background:#dff7ec;color:#078560;width:max-content}.permission-status.pending{background:#fff2d9;color:#8b5d19}@media(max-width:760px){.permission-role-grid,.permission-row{grid-template-columns:1fr}.tuition-teacher-row{grid-template-columns:1fr .5fr}.tuition-teacher-row>div:last-child{grid-column:1/-1}}
    </style>`);
  }

  function renumberNav(){[...document.querySelectorAll('.nav button')].filter(button=>button.style.display!=='none').forEach((button,index)=>{const number=button.querySelector('.num');if(number)number.textContent=String(index+1).padStart(2,'0')})}

  function applyPermissions(){
    if(!window.staffAccess)return;
    const pages=allowedPages();
    document.body.classList.toggle('no-care-send',!window.staffCanAction('care_send'));
    document.querySelectorAll('.nav button[data-page]').forEach(button=>{button.style.display=pages.has(button.dataset.page)?'':'none'});
    if(!window.staffCanAction('care_send'))document.getElementById('bulkAutomaticWhatsapp')?.setAttribute('aria-hidden','true');
    const current=document.querySelector('.nav button.active');
    if(!current||current.style.display==='none')[...document.querySelectorAll('.nav button[data-page]')].find(button=>button.style.display!=='none')?.click();
    window.renderAttendance?.();renderTeacherTuition();renumberNav();
  }

  function protectMessaging(){
    const originalButton=window.whatsappNotificationButton;
    if(originalButton)window.whatsappNotificationButton=(student,canSend=true)=>window.staffCanAction('care_send')?originalButton(student,canSend):'';
    const originalSend=window.shareStudentWhatsapp;
    if(originalSend)window.shareStudentWhatsapp=id=>window.staffCanAction('care_send')?originalSend(id):alert('当前账号没有发送家长讯息的权限。');
    const originalBulk=window.bulkSendWhatsappTasks;
    if(originalBulk)window.bulkSendWhatsappTasks=()=>window.staffCanAction('care_send')?originalBulk():alert('当前账号没有批量发送家长讯息的权限。');
  }

  function roleInputs(){
    return Object.entries(roleLabels).map(([key,label])=>`<label class="permission-role"><input type="checkbox" name="role" value="${key}"> <b>${esc(label)}</b><small>${esc(roleGroups[key])}</small></label>`).join('');
  }
  function schoolInputs(){
    const catalog=window.schoolCatalog||[];
    return catalog.length?catalog.map(school=>`<label><input type="checkbox" name="school" value="${esc(school.id)}"> ${esc(school.name)}</label>`).join(''):'<span class="muted">请先在学生资料与系统设置中添加学校。</span>';
  }

  function permissionMarkup(){return `<div class="permission-panel"><div class="card"><h2 class="section-title">权限控制</h2><p class="muted">一个 Gmail 可以勾选多个角色；系统会合并所有“允许”权限。这里只负责授权，网站没有开放注册入口。</p><form id="staffPermissionForm" class="formgrid"><label>登录 Gmail *<input required type="email" name="email" placeholder="teacher@gmail.com"></label><label>显示身份／老师名字 *<input required name="display_name" placeholder="例如：张老师（须与学生补习老师一致）"></label><label>账号状态<select name="approved"><option value="true">批准登录</option><option value="false">暂停登录</option></select></label><div style="grid-column:1/-1"><b>权限角色（可多选）*</b><div class="permission-role-grid" style="margin-top:8px">${roleInputs()}</div></div><div style="grid-column:1/-1"><b>Uncle van 可看的学校</b><p class="muted">只在勾选 Uncle van 时使用；其他角色按自己的允许范围显示。</p><div class="permission-school-list" id="permissionSchoolChoices">${schoolInputs()}</div></div><button class="save" style="grid-column:1/-1" id="saveStaffPermission">保存 Gmail 与权限</button><button type="button" class="outline hidden" style="grid-column:1/-1" id="cancelStaffPermission">取消修改</button></form><div id="staffPermissionMessage" class="muted" style="margin-top:10px"></div></div><div class="card" style="margin-top:16px"><h2 class="section-title">已授权登录者</h2><div id="staffPermissionList"><p class="muted">正在读取…</p></div></div></div>`}

  function installPermissionAdmin(){
    const admin=$('admin'),select=$('adminFeatureSelect');if(!admin||!select||$('adminPermissionsPanel'))return;
    select.insertAdjacentHTML('beforeend','<option value="permissions">权限控制</option>');
    const panel=document.createElement('section');panel.id='adminPermissionsPanel';panel.className='hidden';panel.innerHTML=permissionMarkup();admin.appendChild(panel);
    const oldChange=select.onchange;
    select.onchange=event=>{
      if(event.target.value==='permissions'){
        admin.querySelectorAll('[data-admin-normal="true"]').forEach(element=>element.classList.add('hidden'));
        $('adminSpecialPanel')?.classList.add('hidden');panel.classList.remove('hidden');loadPermissionRows();
      }else{panel.classList.add('hidden');oldChange?.(event)}
    };
    $('staffPermissionForm').onsubmit=saveStaffPermission;
    $('cancelStaffPermission').onclick=resetStaffPermissionForm;
  }

  async function loadPermissionRows(){
    if(!window.cloud||!window.staffCanAction('permission_control'))return;
    const [access,roleRows,schoolRows]=await Promise.all([
      cloud.from('staff_access').select('email,user_id,display_name,approved,updated_at').order('display_name'),
      cloud.from('staff_access_roles').select('email,role_key'),
      cloud.from('staff_access_schools').select('email,school_id')
    ]);
    const error=access.error||roleRows.error||schoolRows.error;if(error){$('staffPermissionList').innerHTML=`<p class="muted">读取失败：${esc(error.message)}</p>`;return}
    permissionRows=(access.data||[]).map(item=>({...item,roles:(roleRows.data||[]).filter(row=>row.email===item.email).map(row=>row.role_key),schoolIds:(schoolRows.data||[]).filter(row=>row.email===item.email).map(row=>String(row.school_id))}));
    renderPermissionRows();
  }

  function renderPermissionRows(){
    const catalog=new Map((window.schoolCatalog||[]).map(school=>[String(school.id),school.name]));
    $('staffPermissionList').innerHTML=permissionRows.length?permissionRows.map(item=>`<div class="permission-row"><div><b>${esc(item.display_name)}</b><small>${esc(item.email)}</small></div><span class="permission-status ${item.user_id?'':'pending'}">${item.approved?(item.user_id?'可登录':'等待建立账号'):'已暂停'}</span><div><small>角色：${item.roles.map(role=>esc(roleLabels[role]||role)).join('、')||'未分配'}</small><small>学校：${item.schoolIds.map(id=>esc(catalog.get(id)||'已删除学校')).join('、')||'—'}</small></div><div><button type="button" class="outline" onclick="editStaffPermission('${esc(item.email)}')">修改</button> <button type="button" class="outline" style="color:#b3261e;border-color:#e4a5a5" onclick="deleteStaffPermission('${esc(item.email)}')">删除</button></div></div>`).join(''):'<p class="muted">尚未添加登录者。</p>';
  }

  function resetStaffPermissionForm(){
    editingEmail='';const form=$('staffPermissionForm');if(!form)return;form.reset();form.elements.email.disabled=false;form.querySelectorAll('input[type="checkbox"]').forEach(input=>input.checked=false);$('cancelStaffPermission').classList.add('hidden');$('saveStaffPermission').textContent='保存 Gmail 与权限';$('staffPermissionMessage').textContent='';
  }

  window.editStaffPermission=email=>{
    const item=permissionRows.find(row=>row.email===email),form=$('staffPermissionForm');if(!item||!form)return;
    editingEmail=email;form.elements.email.value=item.email;form.elements.email.disabled=true;form.elements.display_name.value=item.display_name;form.elements.approved.value=String(item.approved);
    form.querySelectorAll('input[name="role"]').forEach(input=>input.checked=item.roles.includes(input.value));form.querySelectorAll('input[name="school"]').forEach(input=>input.checked=item.schoolIds.includes(input.value));$('cancelStaffPermission').classList.remove('hidden');$('saveStaffPermission').textContent='保存修改';form.scrollIntoView({behavior:'smooth',block:'start'});
  };

  async function saveStaffPermission(event){
    event.preventDefault();if(!window.staffCanAction('permission_control'))return alert('只有控制老师可以修改权限。');
    const form=event.currentTarget,email=String(editingEmail||form.elements.email.value).trim().toLowerCase(),displayName=form.elements.display_name.value.trim(),approved=form.elements.approved.value==='true';
    const selectedRoles=[...form.querySelectorAll('input[name="role"]:checked')].map(input=>input.value),schoolIds=[...form.querySelectorAll('input[name="school"]:checked')].map(input=>input.value);
    if(!selectedRoles.length)return alert('请至少选择一个权限角色。');
    if(email===window.staffAccess.email&&(!approved||!selectedRoles.includes('control_teacher')))return alert('不能暂停自己的账号或移除自己的控制老师权限，以免无法再进入权限控制。');
    const button=$('saveStaffPermission');button.disabled=true;button.textContent='正在保存…';
    try{
      const access=await cloud.from('staff_access').upsert({email,display_name:displayName,approved,created_by:cloudUser.id,updated_at:new Date().toISOString()},{onConflict:'email'});if(access.error)throw access.error;
      const removeRoles=await cloud.from('staff_access_roles').delete().eq('email',email);if(removeRoles.error)throw removeRoles.error;
      if(selectedRoles.length){const addRoles=await cloud.from('staff_access_roles').insert(selectedRoles.map(role_key=>({email,role_key})));if(addRoles.error)throw addRoles.error}
      const removeSchools=await cloud.from('staff_access_schools').delete().eq('email',email);if(removeSchools.error)throw removeSchools.error;
      if(schoolIds.length){const addSchools=await cloud.from('staff_access_schools').insert(schoolIds.map(school_id=>({email,school_id})));if(addSchools.error)throw addSchools.error}
      resetStaffPermissionForm();await loadPermissionRows();$('staffPermissionMessage').textContent='权限已保存。若显示“等待建立账号”，请由管理员在 Supabase Authentication 建立相同 Gmail 的登录账号。';
    }catch(error){alert('权限保存失败：'+error.message)}finally{button.disabled=false;if(!editingEmail)button.textContent='保存 Gmail 与权限'}
  }

  window.deleteStaffPermission=async email=>{
    if(email===window.staffAccess?.email)return alert('不能删除自己正在使用的控制老师账号。');
    if(!confirm(`确定删除 ${email} 的网站权限吗？这不会删除学生资料。`))return;
    const result=await cloud.from('staff_access').delete().eq('email',email);if(result.error)return alert('删除失败：'+result.error.message);await loadPermissionRows();
  };

  function install(){
    installPermissionStyle();addTeacherTuitionPage();protectMessaging();
    const nav=document.querySelector('.nav');
    if(nav&&!nav.dataset.permissionObserver){nav.dataset.permissionObserver='1';new MutationObserver(()=>{if(window.staffAccess)applyPermissions()}).observe(nav,{childList:true})}
    setTimeout(()=>{installPermissionAdmin();applyPermissions()},2750);
  }
  window.addEventListener('staffAccessReady',()=>{
    addTeacherTuitionPage();applyPermissions();renderTeacherTuition();
    setTimeout(()=>{installPermissionAdmin();applyPermissions();renderTeacherTuition()},2850);
  });
  window.addEventListener('schoolCatalogUpdated',()=>{if($('permissionSchoolChoices'))$('permissionSchoolChoices').innerHTML=schoolInputs();renderTeacherTuition()});
  window.addEventListener('load',install);
})();
