/* 学校管理、学校筛选、每周缺席、日常记录及特殊情况修复。最后载入以覆盖旧版兼容逻辑。 */
(()=>{
  const $=id=>document.getElementById(id);
  const html=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const weekDays=['星期一','星期二','星期三','星期四','星期五'];
  const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Kuala_Lumpur'});
  const todayWeek=()=>new Intl.DateTimeFormat('zh-CN',{weekday:'long',timeZone:'Asia/Kuala_Lumpur'}).format(new Date());
  const catalog=()=>Array.isArray(window.schoolCatalog)?window.schoolCatalog:[];
  const schoolFor=student=>catalog().find(item=>String(item.id)===String(student?.school_id));
  const readPlans=()=>{try{return JSON.parse(localStorage.getItem('fuchengStudentReturnPlans')||'{}')}catch{return {}}};
  const planFor=student=>student?.weekly_plan&&Object.keys(student.weekly_plan).length?student.weekly_plan:(readPlans()[String(student?.id)]||{});
  const isAbsent=(student,day=todayWeek())=>planFor(student)?.[day]?.status==='absent';
  const schoolComplete=student=>{
    const required=Number(schoolFor(student)?.confirmation_count||2);
    return required===1?!!student?.school?.[0]:!!student?.school?.[0]&&!!student?.school?.[1];
  };
  const careComplete=student=>!!student?.care?.[0]&&!!student?.care?.[1];
  const needsSchoolAttendance=student=>student?.special?!!student.special.school_attendance_required:true;
  const needsCareAttendance=student=>student?.special?!!student.special.care_attendance_required:true;
  const needsMeal=student=>student?.special?!!student.special.meal_required:true;
  const specialTypeLabel=type=>['病假','生病没来'].includes(type)?'生病没来':'其他';
  const cameToCare=student=>student?.special?!!student.special.came_to_care:careComplete(student);
  const schoolSatisfied=student=>needsSchoolAttendance(student)?schoolComplete(student):true;
  const careSatisfied=student=>needsCareAttendance(student)?careComplete(student):cameToCare(student);
  const canNotifyArrival=student=>!isAbsent(student,todayWeek())&&cameToCare(student)&&careSatisfied(student);
  window.canNotifyArrival=canNotifyArrival;
  const saveLocal=()=>{if(typeof localSave==='function')localSave();else if(typeof save==='function')save()};

  function installStyle(){
    if($('schoolFeatureStyle'))return;
    document.head.insertAdjacentHTML('beforeend',`<style id="schoolFeatureStyle">
      .school-filter{display:flex;align-items:center;gap:10px;margin:12px 0;color:#536178;font-weight:700}.school-filter select{min-width:230px;border:1px solid #dce4f1;border-radius:8px;padding:9px 11px;background:#fff;font:inherit}.school-manager{margin-top:20px;border-top:1px solid #e5eaf2;padding-top:18px}.school-manager-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.school-manager-grid label{font-size:12px;font-weight:700;color:#536178}.school-manager-grid input,.school-manager-grid select{width:100%;margin-top:5px;border:1px solid #dce4f1;border-radius:8px;padding:8px;font:inherit}.school-manager-grid .full{grid-column:1/-1}.school-entry{border-top:1px solid #e5eaf2;padding:10px 0}.school-entry small{display:block;color:#6e7b91;margin:3px 0}.attendance-row[data-absent="true"]{opacity:.62;font-style:italic;background:#f5f6f8}.daily-record-form{display:grid;gap:12px}.daily-record-form input,.daily-record-form textarea{width:100%;border:1px solid #dce4f1;border-radius:8px;padding:10px;margin-top:6px;font:inherit}.daily-record-form textarea{min-height:110px;resize:vertical}.daily-record-item{border-left:4px solid #3478f6}.carrier-note{display:block;color:#6e7b91;font-size:11px;margin-top:3px}.special-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.special-controls label{font-size:13px;color:#536178}.special-controls input,.special-controls select,.special-controls textarea{width:100%;border:1px solid #dce4f1;border-radius:8px;padding:9px;margin-top:5px;font:inherit}.special-controls textarea{min-height:76px;resize:vertical}.special-controls .full{grid-column:1/-1}.special-statuses{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}.summary-grade-grid{display:grid;grid-template-columns:repeat(6,minmax(155px,1fr));gap:10px;overflow-x:auto;padding-bottom:6px}.summary-grade-column{min-height:190px;background:#f8faff;border:1px solid #e5eaf2;border-radius:11px;padding:10px}.summary-grade-column h3{margin:0 0 10px;font-size:14px;color:#245ccc}.summary-special-item{background:#fff;border-left:4px solid #f3943f;border-radius:8px;padding:9px;margin-top:8px;font-size:12px}.summary-special-item b{font-size:13px}.summary-special-item small{display:block;color:#6e7b91;margin-top:4px;line-height:1.45}@media(max-width:760px){.school-manager-grid,.special-controls{grid-template-columns:1fr}.school-manager-grid .full,.special-controls .full{grid-column:1}.school-filter{align-items:flex-start;flex-direction:column}.school-filter select{width:100%}.summary-grade-grid{grid-template-columns:repeat(6,155px)}}
    </style>`);
    document.head.insertAdjacentHTML('beforeend',`<style id="mealPlanningStyle">
      .admin-feature-chooser{margin-bottom:18px}.admin-feature-chooser label{display:flex;align-items:center;gap:12px;font-weight:800}.admin-feature-chooser select{min-width:260px;border:1px solid #dce4f1;border-radius:8px;padding:10px;background:#fff;font:inherit}.meal-planning-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px}.meal-plan-row{display:grid;grid-template-columns:minmax(150px,1.2fr) .55fr .75fr 1.2fr;gap:10px;align-items:center;border-top:1px solid #e5eaf2;padding:12px 9px}.meal-plan-row.header{background:#f8faff;color:#6e7b91;border:0;border-radius:8px;font-size:12px}.meal-plan-row.no-meal{opacity:.58;background:#f4f5f7;font-style:italic}.meal-plan-row.school-pack{background:#effbf6}.meal-plan-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.meal-plan-stat{border:1px solid #e5eaf2;border-radius:10px;padding:12px;background:#fff}.meal-plan-stat b{display:block;font-size:24px;margin-top:5px}.school-pack-panel{background:#fff;border:1px solid #e5eaf2;border-radius:15px;padding:20px;align-self:start}.school-pack-item{border-left:4px solid #14b88a;background:#f3fbf8;border-radius:8px;padding:10px;margin:8px 0;font-size:13px}.school-pack-item.cancelled{border-left-color:#9aa5b5;background:#f3f4f6;color:#6e7b91;font-style:italic}.special-meal-list{margin-top:18px;border-top:1px solid #e5eaf2;padding-top:15px}.special-meal-item{border-left:4px solid #f3943f;background:#fffaf2;border-radius:8px;padding:10px;margin:8px 0;font-size:13px}@media(max-width:960px){.meal-planning-layout{grid-template-columns:1fr}.meal-plan-row{grid-template-columns:1.2fr .65fr .8fr}.meal-plan-row>*:last-child{grid-column:1/-1}.admin-feature-chooser label{align-items:flex-start;flex-direction:column}.admin-feature-chooser select{width:100%}}
    </style>`);
  }

  function schoolOptions(selected='',includeBlank=true){
    const first=includeBlank?'<option value="">请选择学校</option>':'<option value="">全部学校</option>';
    return first+catalog().map(s=>`<option value="${html(s.id)}" ${String(s.id)===String(selected)?'selected':''}>${html(s.name)}</option>`).join('');
  }

  let schoolFilter='',careSchoolFilter='';
  function ensureAttendanceFilters(){
    if(!$('schoolFilter'))$('stageTabs')?.insertAdjacentHTML('beforebegin',`<label class="school-filter">选择学校<select id="schoolFilter"></select></label>`);
    if(!$('careSchoolFilter'))$('careStageTabs')?.insertAdjacentHTML('beforebegin',`<label class="school-filter">选择学校<select id="careSchoolFilter"></select></label>`);
    if($('schoolFilter')){
      $('schoolFilter').innerHTML=schoolOptions(schoolFilter,false);
      $('schoolFilter').value=schoolFilter;
      $('schoolFilter').onchange=e=>{schoolFilter=e.target.value;window.renderAttendance()};
    }
    if($('careSchoolFilter')){
      $('careSchoolFilter').innerHTML=schoolOptions(careSchoolFilter,false);
      $('careSchoolFilter').value=careSchoolFilter;
      $('careSchoolFilter').onchange=e=>{careSchoolFilter=e.target.value;window.renderAttendance()};
    }
  }

  function transportText(student){
    const school=schoolFor(student);
    if(!school)return '学校未设置';
    const role=school.transport_type==='van_uncle'?'Van Uncle':'老师';
    return `${school.name} · ${role}${school.carrier_name?'：'+school.carrier_name:''}`;
  }

  function attendanceRow(student,kind){
    student.school=Array.isArray(student.school)?student.school:[false,false];
    student.care=Array.isArray(student.care)?student.care:[false,false];
    const absent=isAbsent(student,typeof week==='string'?week:todayWeek());
    const schoolOK=schoolComplete(student),careOK=careComplete(student),schoolNeeded=needsSchoolAttendance(student),careNeeded=needsCareAttendance(student);
    const attendanceNeeded=kind==='school'?schoolNeeded:careNeeded;
    const blocked=kind==='care'&&!schoolSatisfied(student);
    const done=kind==='school'?(schoolNeeded&&schoolOK):(careNeeded?careOK:cameToCare(student));
    const disabled=!attendanceNeeded||absent||blocked;
    const school=schoolFor(student),onePerson=kind==='school'&&Number(school?.confirmation_count||2)===1;
    const firstLabel=kind==='school'?(school?.transport_type==='van_uncle'?'Van Uncle':'老师'):'老师 A';
    const firstName=kind==='school'&&school?.carrier_name?`<small class="carrier-note">${html(school.carrier_name)}</small>`:'';
    let state=absent?'<span class="tag red">没有来托育</span>':!attendanceNeeded?(kind==='care'&&cameToCare(student)?'<span class="tag green">已来托育（免点名）</span>':`<span class="tag red">不需要${kind==='school'?'学校':'托育'}点名</span>`):done?'<span class="tag green">已确认</span>':blocked?'<span class="tag">等待学校确认</span>':'<span class="tag">待确认</span>';
    const note=student.special?html(student.special.note||'—'):absent?'每周安排：没有来托育':student.diet?'特殊餐：'+html(student.diet):transportText(student);
    const canSend=canNotifyArrival(student),send=window.whatsappNotificationButton?window.whatsappNotificationButton(student,canSend):`<button class="greenbtn" ${canSend?'':'disabled'} onclick="shareStudentWhatsapp('${html(student.id)}')">发信息通知</button>`;
    return `<div class="attendance-row ${done?'confirmed':''} ${absent||!attendanceNeeded?'unavailable':''}" data-student-id="${html(student.id)}" data-school-id="${html(student.school_id||'')}" data-absent="${absent}"><div class="student">${html(student.name)}<small>${html(student.grade)} · ${html(student.meal)} · ${html(school?.name||'学校未设置')}</small></div><label class="check"><input type="checkbox" ${student[kind][0]?'checked':''} ${disabled?'disabled':''} onchange="toggle('${html(student.id)}','${kind}',0,this.checked)">${firstLabel}${firstName}</label><label class="check"><input type="checkbox" ${student[kind][1]?'checked':''} ${disabled||onePerson?'disabled':''} onchange="toggle('${html(student.id)}','${kind}',1,this.checked)">${onePerson?'不需要':'老师 B'}</label><div>${state}</div><div>${kind==='school'?note:send}</div></div>`;
  }

  function postFilterAttendance(){
    document.querySelectorAll('#schoolList .attendance-row[data-student-id]').forEach(row=>{if(schoolFilter&&row.dataset.schoolId!==schoolFilter)row.remove()});
    document.querySelectorAll('#careList .attendance-row[data-student-id]').forEach(row=>{if(careSchoolFilter&&row.dataset.schoolId!==careSchoolFilter)row.remove()});
    const schoolHead=document.querySelector('#schoolList .attendance-row.header');
    if(schoolHead){const cells=schoolHead.children;if(cells[1])cells[1].textContent='接送人员';if(cells[2])cells[2].textContent='第二位确认';if(cells[4])cells[4].textContent='学校／备注'}
    const careRows=[...document.querySelectorAll('#careList .attendance-row[data-student-id]')];
    const shown=careRows.map(row=>students.find(s=>String(s.id)===row.dataset.studentId)).filter(Boolean);
    const active=shown.filter(s=>!isAbsent(s,typeof week==='string'?week:todayWeek())&&(!s.special||s.special.came_to_care||s.special.care_attendance_required));
    const picked=active.filter(s=>needsSchoolAttendance(s)&&schoolComplete(s)).length,arrived=active.filter(cameToCare).length;
    if($('requiredCount'))$('requiredCount').textContent=active.length;
    if($('pickedCount'))$('pickedCount').textContent=picked;
    if($('careCount'))$('careCount').textContent=arrived;
    if($('pickupRatio'))$('pickupRatio').textContent=`${picked} / ${active.length}`;
    if($('pickupProgress'))$('pickupProgress').style.width=(active.length?picked/active.length*100:0)+'%';
    const todayActive=students.filter(s=>!isAbsent(s,todayWeek())&&(!s.special||s.special.came_to_care||s.special.care_attendance_required)),todayArrived=todayActive.filter(cameToCare).length;
    if($('totalStat'))$('totalStat').textContent=todayActive.length;
    if($('arrivedStat'))$('arrivedStat').textContent=todayArrived;
    if($('rateStat'))$('rateStat').textContent=(todayActive.length?Math.round(todayArrived/todayActive.length*100):0)+'%';
  }

  function installAttendance(){
    window.row=attendanceRow;
    window.toggle=(id,kind,index,value)=>{
      const student=students.find(s=>String(s.id)===String(id));
      if(!student||isAbsent(student,typeof week==='string'?week:todayWeek())||(kind==='school'&&!needsSchoolAttendance(student))||(kind==='care'&&!needsCareAttendance(student))||(kind==='care'&&!schoolSatisfied(student)))return;
      student[kind]=Array.isArray(student[kind])?student[kind]:[false,false];
      student[kind][Number(index)]=!!value;
      if(kind==='school'&&Number(schoolFor(student)?.confirmation_count||2)===1)student.school[1]=false;
      if(typeof save==='function')save();
      window.renderAttendance();
      window.renderSpecial?.();
    };
    const base=window.renderAttendance;
    window.renderAttendance=()=>{base?.();ensureAttendanceFilters();postFilterAttendance()};
    window.renderAttendance();
  }

  async function reloadSchools(){
    if(!window.cloud)return;
    const result=await cloud.from('schools').select('*').order('name');
    if(result.error){alert('无法读取学校资料：'+result.error.message);return}
    window.schoolCatalog=result.data||[];
    refreshSchoolUI();
  }

  function schoolManagerMarkup(){return `<section id="schoolManager" class="school-manager"><h3 class="easy-heading">学校管理</h3><p class="easy-sub">先添加学校，学生资料只能从这里已有的学校中选择。</p><form id="schoolManagerForm" class="school-manager-grid"><input type="hidden" name="id"><label class="full">学校名字 *<input required name="name" maxlength="100" placeholder="例如：培才华小"></label><label>学校点名人数 *<select name="confirmation_count"><option value="2">两个人点名</option><option value="1">一个人点名</option></select></label><label>带学生的人 *<select name="transport_type"><option value="teacher">老师</option><option value="van_uncle">Van Uncle</option></select></label><label class="full">负责人名字（可不填）<input name="carrier_name" maxlength="100" placeholder="例如：陈老师／Ah Ming"></label><button class="save-student full">保存学校</button><button type="button" class="outline hidden full" id="cancelSchoolEdit">取消修改</button></form><div id="schoolManagerList"></div></section>`}
  function renderSchoolManager(){
    const box=$('schoolManagerList');if(!box)return;
    box.innerHTML=catalog().length?catalog().map(s=>`<div class="school-entry"><b>${html(s.name)}</b><small>${Number(s.confirmation_count)===1?'一人确认':'两人确认'} · ${s.transport_type==='van_uncle'?'Van Uncle':'老师'}${s.carrier_name?'：'+html(s.carrier_name):''}</small><button type="button" class="outline" onclick="editSchool('${html(s.id)}')">修改</button> <button type="button" class="outline" style="color:#bd3346;border-color:#ffc1ca" onclick="deleteSchool('${html(s.id)}')">删除</button></div>`).join(''):'<p class="easy-sub">尚未添加学校。</p>';
  }
  function bindSchoolManager(){
    const form=$('schoolManagerForm');if(!form||form.dataset.bound)return;
    form.dataset.bound='1';
    form.onsubmit=async event=>{
      event.preventDefault();
      if(!window.cloud||!window.cloudUser)return alert('请先登录云端账号。');
      if(window.cloudRole!=='admin')return alert('只有管理员可以管理学校。');
      const data=Object.fromEntries(new FormData(form));
      const payload={name:String(data.name).trim(),confirmation_count:Number(data.confirmation_count),transport_type:data.transport_type,carrier_name:String(data.carrier_name||'').trim(),updated_at:new Date().toISOString()};
      const query=data.id?cloud.from('schools').update(payload).eq('id',data.id):cloud.from('schools').insert({...payload,created_by:cloudUser.id});
      const result=await query;
      if(result.error)return alert('学校资料保存失败：'+result.error.message);
      form.reset();form.elements.id.value='';$('cancelSchoolEdit')?.classList.add('hidden');
      await reloadSchools();alert('学校资料已保存。');
    };
    $('cancelSchoolEdit').onclick=()=>{form.reset();form.elements.id.value='';$('cancelSchoolEdit').classList.add('hidden')};
  }
  window.editSchool=id=>{
    const item=catalog().find(s=>String(s.id)===String(id)),form=$('schoolManagerForm');if(!item||!form)return;
    form.elements.id.value=item.id;form.elements.name.value=item.name;form.elements.confirmation_count.value=String(item.confirmation_count);form.elements.transport_type.value=item.transport_type;form.elements.carrier_name.value=item.carrier_name||'';$('cancelSchoolEdit').classList.remove('hidden');form.scrollIntoView({behavior:'smooth',block:'center'});
  };
  window.deleteSchool=async id=>{
    const item=catalog().find(s=>String(s.id)===String(id));if(!item||!confirm(`确定删除学校「${item.name}」吗？已经有学生使用的学校不能删除。`))return;
    const result=await cloud.from('schools').delete().eq('id',id);if(result.error)return alert('无法删除学校：'+result.error.message);
    await reloadSchools();
  };

  function refreshStudentSchoolOptions(selected){
    const select=$('studentSchoolSelect');if(!select)return;
    const keep=selected??select.value;select.innerHTML=schoolOptions(keep,true);select.value=String(keep||'');
  }
  function annotateStudentList(){
    document.querySelectorAll('#easyStudentList .student-info-card').forEach(card=>{
      if(card.querySelector('.student-school-name'))return;
      const match=card.querySelector('[onclick*="easyEditStudent"]')?.getAttribute('onclick')?.match(/easyEditStudent\('([^']+)'\)/);
      const student=match&&students.find(s=>String(s.id)===match[1]);
      if(student)card.querySelector('small')?.insertAdjacentHTML('afterend',`<small class="student-school-name">学校：${html(schoolFor(student)?.name||'未设置')}</small>`);
    });
  }
  function ensureStudentForm(){
    const form=$('easyStudentForm');if(!form)return;
    if(!form.elements.school_id){
      form.elements.name.closest('label')?.insertAdjacentHTML('afterend',`<label>学校 *<select required name="school_id" id="studentSchoolSelect"></select></label>`);
    }
    form.querySelectorAll('.return-status').forEach(select=>{if(!select.querySelector('option[value="absent"]'))select.insertAdjacentHTML('beforeend','<option value="absent">没有来托育</option>')});
    form.querySelectorAll('[name="bring_meal"]').forEach(select=>{if(!select.querySelector('option[value="return_meal"]'))select.insertAdjacentHTML('beforeend','<option value="return_meal">回来托育吃饭</option>');const label=select.closest('label');if(label?.firstChild?.nodeType===Node.TEXT_NODE)label.firstChild.textContent='留校饭餐安排'});
    const hiddenId=form.elements.id.value,student=students.find(s=>String(s.id)===String(hiddenId));
    refreshStudentSchoolOptions(student?.school_id||form.elements.school_id.value);
    const section=[...form.querySelectorAll('.easy-section')].find(x=>x.textContent.includes('回托育'));
    const help=section?.querySelector('p');if(help)help.textContent='每天选择“正常回托育”、“留校”或“没有来托育”。若留校，可选择需要带饭、不需要带饭或回来托育吃饭。';
    if(!form.dataset.schoolFeatures){
      form.dataset.schoolFeatures='1';const oldSubmit=form.onsubmit;
      form.onsubmit=async event=>{
        const schoolId=form.elements.school_id.value;
        if(!schoolId){event.preventDefault();return alert('请先选择学生的学校。若名单为空，请先在右侧“学校管理”添加学校。')}
        const oldId=form.elements.id.value,name=form.elements.name.value.trim();
        const weekly={};form.querySelectorAll('.day-card').forEach(card=>{weekly[card.dataset.day]={time:card.querySelector('[name="return_time"]').value,status:card.querySelector('[name="return_status"]').value,bringMeal:card.querySelector('[name="bring_meal"]').value,stayEnd:card.querySelector('[name="stay_end"]')?.value||''}});
        await oldSubmit?.call(form,event);
        const student=students.find(s=>(oldId&&String(s.id)===String(oldId))||(!oldId&&s.name===name));if(!student)return;
        student.school_id=schoolId;student.weekly_plan=weekly;
        const all=readPlans();all[String(student.id)]=weekly;localStorage.setItem('fuchengStudentReturnPlans',JSON.stringify(all));saveLocal();
        if(window.cloud){const result=await cloud.from('students').update({school_id:schoolId,weekly_plan:weekly}).eq('id',String(student.id));if(result.error)return alert('学生已保存，但学校／每周安排同步失败：'+result.error.message)}
        refreshSchoolUI();
      };
    }
    const listCard=$('easyStudentList')?.closest('.easy-list-card');if(listCard&&!$('schoolManager'))listCard.insertAdjacentHTML('beforeend',schoolManagerMarkup());
    bindSchoolManager();renderSchoolManager();annotateStudentList();
  }
  function installAdmin(){
    const oldRenderAdmin=window.renderAdmin;
    window.renderAdmin=()=>{try{oldRenderAdmin?.()}catch(error){console.warn('旧版后台列表已由新版后台取代：',error.message)}ensureStudentForm();annotateStudentList()};
    const oldEdit=window.easyEditStudent;
    if(oldEdit)window.easyEditStudent=id=>{oldEdit(id);setTimeout(()=>{ensureStudentForm();refreshStudentSchoolOptions(students.find(s=>String(s.id)===String(id))?.school_id||'')},0)};
    ensureStudentForm();
  }

  function setAdminFeature(value){
    const admin=$('admin');if(!admin)return;
    admin.querySelectorAll('[data-admin-normal="true"]').forEach(element=>element.classList.toggle('hidden',value==='special'));
    $('adminSpecialPanel')?.classList.toggle('hidden',value!=='special');
    if(value==='special')renderSpecialFixed();
  }
  function installAdminFeatureChooser(){
    const admin=$('admin');if(!admin)return;
    if(!$('adminFeatureChooser')){
      [...admin.children].forEach(child=>child.dataset.adminNormal='true');
      admin.insertAdjacentHTML('afterbegin',`<div id="adminFeatureChooser" class="card admin-feature-chooser"><label>后台信息功能<select id="adminFeatureSelect"><option value="students">学生资料与系统设置</option><option value="special">特殊情况登记</option></select></label></div><section id="adminSpecialPanel" class="card hidden"></section>`);
    }
    $('adminFeatureSelect').onchange=event=>setAdminFeature(event.target.value);
    setAdminFeature($('adminFeatureSelect').value);
  }

  let dailyRecords=[];
  function dailyLocal(){try{return JSON.parse(localStorage.getItem('fuchengDailyRecords')||'[]')}catch{return []}}
  function saveDailyLocal(){localStorage.setItem('fuchengDailyRecords',JSON.stringify(dailyRecords))}
  function dailyMarkup(){return `<div class="two-col"><section class="card"><h2 class="section-title">填写学生日常记录</h2><p class="muted">所有已批准老师都可以选择学生并填写今天的讯息。</p><form id="dailyFeatureForm" class="daily-record-form"><label>搜索／选择学生 *<input required name="student" list="dailyFeatureStudents" placeholder="输入学生名字"></label><datalist id="dailyFeatureStudents"></datalist><label>今日讯息 *<textarea required name="note" placeholder="例如：今天完成了功课，精神良好"></textarea></label><button class="save">保存讯息</button></form></section><section class="card"><h2 class="section-title">今天已填写讯息的学生</h2><p class="muted">这里不会显示尚未填写讯息的学生。</p><div id="dailyFeatureList"></div></section></div>`}
  async function loadDailyRecords(){
    if(window.cloud){const result=await cloud.from('daily_student_records').select('*').eq('record_date',today()).order('created_at',{ascending:false});if(!result.error)dailyRecords=result.data||[];else alert('读取日常记录失败：'+result.error.message)}else dailyRecords=dailyLocal().filter(x=>x.record_date===today());
    saveDailyLocal();renderDailyRecords();
  }
  function renderDailyRecords(){
    if(!$('dailyFeatureList'))return;
    $('dailyFeatureStudents').innerHTML=students.map(s=>`<option value="${html(s.name)}">${html(schoolFor(s)?.name||'未设置学校')} · ${html(s.grade)}</option>`).join('');
    $('dailyFeatureList').innerHTML=dailyRecords.length?dailyRecords.map(record=>`<div class="emergency daily-record-item"><b>${html(record.student_name)}</b><br>${html(record.note)}<br><button type="button" class="outline" onclick="deleteDailyFeatureRecord('${html(record.id)}')">删除</button></div>`).join(''):'<p class="muted">今天还没有填写任何学生讯息。</p>';
  }
  function installDaily(){
    const page=$('dailyrecord'),nav=document.querySelector('[data-page="dailyrecord"]');if(!page||!nav)return;
    page.dataset.schoolFeatures='1';page.innerHTML=dailyMarkup();
    $('dailyFeatureForm').onsubmit=async event=>{
      event.preventDefault();const form=event.currentTarget,name=form.elements.student.value.trim(),student=students.find(s=>s.name===name),note=form.elements.note.value.trim();
      if(!student)return alert('请从学生名单选择正确的学生。');
      const item={id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,student_id:String(student.id),student_name:student.name,record_date:today(),note};
      if(window.cloud){const result=await cloud.from('daily_student_records').insert(item).select().single();if(result.error)return alert('讯息保存失败：'+result.error.message);dailyRecords.unshift(result.data)}else dailyRecords.unshift(item);
      saveDailyLocal();form.reset();renderDailyRecords();
    };
    nav.onclick=event=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));event.currentTarget.classList.add('active');document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));page.classList.remove('hidden');$('pageTitle').textContent='学生日常记录';loadDailyRecords()};
    loadDailyRecords();
  }
  window.deleteDailyFeatureRecord=async id=>{
    const record=dailyRecords.find(x=>String(x.id)===String(id));if(!record||!confirm(`确定删除「${record.student_name}」这条讯息吗？`))return;
    if(window.cloud){const result=await cloud.from('daily_student_records').delete().eq('id',id);if(result.error)return alert('删除失败：'+result.error.message)}
    dailyRecords=dailyRecords.filter(x=>String(x.id)!==String(id));saveDailyLocal();renderDailyRecords();
  };

  let editingSpecialStudentId='';
  function specialFormMarkup(){return `<h2 class="section-title">特殊情况登记</h2><p class="muted">登记后会持续保留，不会在凌晨自动清除；情况结束时请在下方点击“删除”。</p><form id="specialFeatureForm"><div class="special-controls"><label>搜索／选择学生 *<input required id="specialStudent" list="specialFeatureStudents" placeholder="输入学生名字"></label><datalist id="specialFeatureStudents"></datalist><label>年级<input id="specialGrade" readonly placeholder="选择学生后自动显示"></label><label>情况 *<select id="specialType"><option value="生病没来">生病没来</option><option value="其他">其他</option></select></label><label class="full">备注<textarea id="specialNote" placeholder="填写特殊情况原因"></textarea></label><label>需要学校点名<select id="specialSchoolRequired"><option value="false">不需要</option><option value="true">需要</option></select></label><label>需要托育点名<select id="specialCareRequired"><option value="false">不需要</option><option value="true">需要</option></select></label><label>需要吃饭<select id="specialMealRequired"><option value="false">不需要</option><option value="true">需要</option></select></label><label>有没有来托育<select id="specialCameToCare"><option value="false">没有来托育</option><option value="true">有来托育</option></select></label></div><button class="save" id="specialSaveButton">登记特殊情况</button> <button type="button" class="outline hidden" id="cancelSpecialEdit">取消修改</button></form><div id="specialRecords" style="margin-top:17px"></div>`}
  function applySpecialDefaults(force=false){
    if(!$('specialType')||(!force&&editingSpecialStudentId))return;
    const sick=['病假','生病没来'].includes($('specialType').value);
    $('specialSchoolRequired').value=String(!sick);$('specialCareRequired').value=String(!sick);$('specialMealRequired').value=String(!sick);$('specialCameToCare').value=String(!sick);
  }
  function updateSpecialGrade(){const name=String($('specialStudent')?.value||'').trim(),student=students.find(s=>s.name===name||String(s.id)===name);if($('specialGrade'))$('specialGrade').value=student?.grade||''}
  function installSpecialForm(){
    const card=$('adminSpecialPanel');if(!card)return;
    if(!$('specialFeatureForm'))card.innerHTML=specialFormMarkup();
    $('specialFeatureStudents').innerHTML=students.map(s=>`<option value="${html(s.name)}">${html(s.grade)} · ${html(schoolFor(s)?.name||'学校未设置')}</option>`).join('');
    if($('specialFeatureForm').dataset.bound)return;
    $('specialFeatureForm').dataset.bound='1';$('specialStudent').oninput=updateSpecialGrade;$('specialStudent').onchange=updateSpecialGrade;$('specialType').onchange=()=>applySpecialDefaults(true);$('specialFeatureForm').onsubmit=event=>{event.preventDefault();void window.addSpecial()};$('cancelSpecialEdit').onclick=()=>resetSpecialForm();applySpecialDefaults(true);
  }
  function resetSpecialForm(){editingSpecialStudentId='';if($('specialStudent'))$('specialStudent').disabled=false;$('specialFeatureForm')?.reset();if($('specialSaveButton'))$('specialSaveButton').textContent='登记特殊情况';$('cancelSpecialEdit')?.classList.add('hidden');updateSpecialGrade();applySpecialDefaults(true)}
  function boolField(id){return $(id)?.value==='true'}
  function statusTag(label,value,yes='需要',no='不需要'){return `<span class="tag ${value?'green':'red'}">${html(label)}：${value?html(yes):html(no)}</span>`}
  function renderSummarySpecialBoard(){
    const board=$('summarySpecialBoard');if(!board)return;
    const gradeList=['一年级','二年级','三年级','四年级','五年级','六年级'];
    board.innerHTML=gradeList.map(grade=>{const records=specials.filter(x=>students.find(s=>String(s.id)===String(x.student_id)||s.name===x.name)?.grade===grade);return `<section class="summary-grade-column"><h3>${grade}</h3>${records.length?records.map(x=>`<div class="summary-special-item"><b>${html(x.name)} · ${html(specialTypeLabel(x.type))}</b><small>${html(x.note||'没有备注')}</small><small>学校${x.school_attendance_required?'需点名':'免点名'} · 托育${x.care_attendance_required?'需点名':'免点名'} · ${x.meal_required?'要吃饭':'不吃饭'} · ${x.came_to_care?'有来托育':'没来托育'}</small></div>`).join(''):'<p class="muted">暂无</p>'}</section>`}).join('');
  }

  let mealPlanDay=weekDays.includes(todayWeek())?todayWeek():'星期一',mealPlanStage='低年段',mealPlanGrade='全部';
  const lowGrades=['一年级','二年级','三年级'];
  function baseMealDecision(student,day){
    const plan=planFor(student)?.[day]||{},status=plan.status||'return',bringMeal=plan.bringMeal||'no';
    if(status==='absent')return {needed:false,label:'没有来托育',reason:'每周安排：没有来托育',mode:''};
    if(status==='stay'&&bringMeal==='no')return {needed:false,label:'留校，不需要带饭',reason:'每周安排：不需要带饭',mode:''};
    if(status==='stay'&&bringMeal==='yes')return {needed:true,label:'需要带饭',reason:'',mode:'送到学校'};
    if(status==='stay'&&bringMeal==='return_meal')return {needed:true,label:'回来托育吃饭',reason:'',mode:'回托育吃'};
    return {needed:true,label:'正常回托育吃饭',reason:'',mode:'回托育吃'};
  }
  function mealDecision(student,day){
    const base=baseMealDecision(student,day);
    if(student.special&&!needsMeal(student))return {...base,needed:false,label:'特殊情况：不用包饭',reason:student.special.note||specialTypeLabel(student.special.type),cancelledBySpecial:base.needed};
    return {...base,cancelledBySpecial:false};
  }
  function mealPlanningMarkup(){return `<div class="meal-planning-layout"><section class="card"><h2 class="section-title">星期一至五学生饭量</h2><p class="muted">先选星期、年段与年级。灰色斜体代表这一天不用包饭。</p><div class="week-tabs" id="mealPlanWeeks"></div><div class="week-tabs" id="mealPlanStages"></div><div class="time-tabs" id="mealPlanGrades"></div><div class="meal-plan-stats" id="mealPlanStats"></div><div id="mealPlanStudents"></div><section class="special-meal-list"><h3 class="section-title">特殊情况／不用包饭</h3><div id="mealPlanSpecials"></div></section></section><aside class="school-pack-panel"><h2 class="section-title">学校要包的饭</h2><p class="muted" id="schoolPackDayLabel"></p><div id="schoolPackMeals"></div></aside></div>`}
  function installMealPlanningPage(){
    const page=$('special'),nav=document.querySelector('[data-page="special"]');if(!page||!nav)return;
    if(!page.dataset.mealPlanning){page.dataset.mealPlanning='1';page.innerHTML=mealPlanningMarkup()}
    const number=nav.querySelector('.num')?.textContent||'08';nav.innerHTML=`<b class="num">${html(number)}</b> 饭量安排`;
    renderMealPlanning();
  }
  function filterMealStudents(){const grades=mealPlanStage==='低年段'?lowGrades:['四年级','五年级','六年级'];return students.filter(student=>(mealPlanGrade==='全部'?grades.includes(student.grade):student.grade===mealPlanGrade))}
  function renderMealPlanning(){
    if(!$('mealPlanWeeks'))return;
    $('mealPlanWeeks').innerHTML=weekDays.map(day=>`<button class="${day===mealPlanDay?'active':''}" data-day="${html(day)}">${html(day)}</button>`).join('');
    $('mealPlanWeeks').querySelectorAll('button').forEach(button=>button.onclick=()=>{mealPlanDay=button.dataset.day;renderMealPlanning()});
    $('mealPlanStages').innerHTML=['低年段','高年段'].map(stage=>`<button class="${stage===mealPlanStage?'active':''}" data-stage="${stage}">${stage}</button>`).join('');
    $('mealPlanStages').querySelectorAll('button').forEach(button=>button.onclick=()=>{mealPlanStage=button.dataset.stage;mealPlanGrade='全部';renderMealPlanning()});
    const stageGrades=mealPlanStage==='低年段'?lowGrades:['四年级','五年级','六年级'];
    $('mealPlanGrades').innerHTML=['全部',...stageGrades].map(grade=>`<button class="${grade===mealPlanGrade?'active':''}" data-grade="${grade}">${grade}</button>`).join('');
    $('mealPlanGrades').querySelectorAll('button').forEach(button=>button.onclick=()=>{mealPlanGrade=button.dataset.grade;renderMealPlanning()});
    const visible=filterMealStudents(),decisions=visible.map(student=>({student,decision:mealDecision(student,mealPlanDay)})),meals=['小饭','中饭','大饭'];
    $('mealPlanStats').innerHTML=meals.map(meal=>{const count=decisions.filter(item=>item.decision.needed&&item.student.meal===meal).length;return `<div class="meal-plan-stat"><small>${meal}</small><b>${count} 份</b></div>`}).join('');
    $('mealPlanStudents').innerHTML='<div class="meal-plan-row header"><span>学生</span><span>年级</span><span>饭量</span><span>安排</span></div>'+decisions.map(({student,decision})=>`<div class="meal-plan-row ${decision.needed?(decision.mode==='送到学校'?'school-pack':''):'no-meal'}"><b>${html(student.name)}</b><span>${html(student.grade)}</span><span>${html(student.meal)}</span><span>${html(decision.label)}${decision.reason?`<small class="carrier-note">${html(decision.reason)}</small>`:''}</span></div>`).join('');
    const specialNoMeal=decisions.filter(item=>item.student.special&&!item.decision.needed);
    $('mealPlanSpecials').innerHTML=specialNoMeal.length?specialNoMeal.map(({student,decision})=>`<div class="special-meal-item"><b>${html(student.name)} · ${html(student.grade)} · ${html(student.meal)}</b><br>${html(decision.reason||specialTypeLabel(student.special.type))}</div>`).join(''):'<p class="muted">这个筛选没有特殊情况／不用包饭的学生。</p>';
    const schoolMeals=students.map(student=>({student,base:baseMealDecision(student,mealPlanDay),decision:mealDecision(student,mealPlanDay)})).filter(item=>item.base.needed);
    $('schoolPackDayLabel').textContent=`${mealPlanDay} · 共 ${schoolMeals.filter(item=>item.decision.needed).length} 份`;
    $('schoolPackMeals').innerHTML=schoolMeals.length?schoolMeals.map(({student,decision})=>`<div class="school-pack-item ${decision.needed?'':'cancelled'}"><b>${html(student.name)} · ${html(student.grade)} · ${html(student.meal)}</b><br>${decision.needed?html(decision.label):`不用包饭：${html(decision.reason||'特殊情况')}`}</div>`).join(''):'<p class="muted">这个星期没有需要准备的饭。</p>';
  }

  function renderSpecialFixed(){
    installSpecialForm();
    if($('specialFeatureStudents'))$('specialFeatureStudents').innerHTML=students.map(s=>`<option value="${html(s.name)}">${html(s.grade)} · ${html(schoolFor(s)?.name||'学校未设置')}</option>`).join('');
    if($('specialRecords'))$('specialRecords').innerHTML=specials.length?specials.map((x,index)=>`<div class="emergency"><b>${html(x.name)} · ${html(students.find(s=>String(s.id)===String(x.student_id)||s.name===x.name)?.grade||'年级未设置')} · ${html(specialTypeLabel(x.type))}</b><br>${html(x.note||'没有备注')}<div class="special-statuses">${statusTag('学校点名',x.school_attendance_required)}${statusTag('托育点名',x.care_attendance_required)}${statusTag('吃饭',x.meal_required,'需要','不需要')}${statusTag('来托育',x.came_to_care,'有来','没来')}</div><button class="outline" onclick="editSpecial(${index})">调整</button> <button class="outline" onclick="cancelSpecial(${index})">删除</button></div>`).join(''):'<p class="muted">尚未登记特殊情况。</p>';
    renderSummarySpecialBoard();renderMealPlanning();
  }
  window.addSpecial=async()=>{
    const value=String($('specialStudent')?.value||'').trim(),student=students.find(s=>String(s.id)===value||s.name===value),id=String(student?.id||''),type=$('specialType').value,note=$('specialNote').value.trim()||type,controls={school_attendance_required:boolField('specialSchoolRequired'),care_attendance_required:boolField('specialCareRequired'),meal_required:boolField('specialMealRequired'),came_to_care:boolField('specialCameToCare')};if(!student){$('specialRecords').innerHTML='<p class="muted" style="color:#b3261e">请从提示名单选择正确的学生姓名。</p>';return}
    if(window.cloud){await cloud.from('special_records').delete().eq('student_id',id);const result=await cloud.from('special_records').insert({record_date:today(),student_id:id,type,note,...controls}).select().single();if(result.error){$('specialRecords').innerHTML=`<p class="muted" style="color:#b3261e">特殊情况保存失败：${html(result.error.message)}</p>`;return}specials=specials.filter(x=>String(x.student_id||students.find(s=>s.name===x.name)?.id)!==id);specials.push({id:result.data.id,record_date:result.data.record_date,student_id:id,name:student.name,type,note,...controls});await cloud.from('attendance').upsert({attendance_date:today(),student_id:id,meal_taken:controls.meal_required?!!student.mealTaken:false})}else{specials=specials.filter(x=>String(x.student_id||students.find(s=>s.name===x.name)?.id)!==id);specials.push({record_date:today(),student_id:id,name:student.name,type,note,...controls})}
    student.special={type,note,...controls};if(!controls.meal_required)student.mealTaken=false;saveLocal();resetSpecialForm();renderSpecialFixed();renderMealFixed();window.renderAttendance?.();
  };
  window.cancelSpecial=async index=>{
    const record=specials[index];if(!record)return;const student=students.find(s=>String(s.id)===String(record.student_id)||s.name===record.name);
    if(window.cloud){let query=cloud.from('special_records').delete();query=record.id?query.eq('id',record.id):query.eq('student_id',String(student?.id||record.student_id));const result=await query;if(result.error)return alert('取消特殊情况失败：'+result.error.message)}
    if(student)student.special=null;specials.splice(index,1);saveLocal();renderSpecialFixed();renderMealFixed();window.renderAttendance?.();
  };
  window.editSpecial=index=>{const record=specials[index],student=students.find(s=>String(s.id)===String(record?.student_id)||s.name===record?.name);if(!record||!student)return;editingSpecialStudentId=String(student.id);$('specialStudent').value=student.name;$('specialStudent').disabled=true;$('specialGrade').value=student.grade;$('specialType').value=specialTypeLabel(record.type);$('specialNote').value=record.note||'';$('specialSchoolRequired').value=String(!!record.school_attendance_required);$('specialCareRequired').value=String(!!record.care_attendance_required);$('specialMealRequired').value=String(!!record.meal_required);$('specialCameToCare').value=String(!!record.came_to_care);$('specialSaveButton').textContent='保存修改';$('cancelSpecialEdit').classList.remove('hidden');$('specialFeatureForm').scrollIntoView({behavior:'smooth',block:'center'})};

  function renderMealFixed(){
    if(!$('mealCheckList'))return;
    const day=todayWeek(),available=students.filter(s=>needsMeal(s)&&!isAbsent(s,day)),arrived=available.filter(s=>cameToCare(s)&&careSatisfied(s)),taken=arrived.filter(s=>s.mealTaken);
    $('mealCheckList').innerHTML=students.map(s=>{const mealNeeded=needsMeal(s),arrivedNow=cameToCare(s)&&careSatisfied(s),unavailable=!mealNeeded||isAbsent(s,day),done=!!s.mealTaken,label=isAbsent(s,day)?'没有来托育':!mealNeeded?'今天不需要吃饭':!cameToCare(s)?'没有来托育':arrivedNow?(done?'✓ 已拿饭':'待拿饭'):'等待托育点名';return `<div class="meal-row ${arrivedNow&&!unavailable?'':'pending'} ${done&&!unavailable?'taken':''}"><span class="avatar fallback">${html(s.name).slice(0,1)}</span><div class="name">${html(s.name)}<small style="display:block;color:#6e7b91">${html(s.grade)} · ${html(s.meal)} · ${html(schoolFor(s)?.name||'学校未设置')}</small></div><span>${html(label)}</span><button class="pill" ${arrivedNow&&!unavailable?'':'disabled'} onclick="toggleMeal('${html(s.id)}')">${done?'取消拿饭':'点名拿饭'}</button></div>`}).join('')||'<p class="muted">暂无学生。</p>';
    if($('mealRatio'))$('mealRatio').textContent=`${taken.length} / ${arrived.length}`;if($('mealProgress'))$('mealProgress').style.width=(arrived.length?taken.length/arrived.length*100:0)+'%';if($('mealArrived'))$('mealArrived').textContent=arrived.length;if($('mealTaken'))$('mealTaken').textContent=taken.length;if($('mealPending'))$('mealPending').textContent=arrived.length-taken.length;
  }
  window.toggleMeal=async id=>{
    const student=students.find(s=>String(s.id)===String(id));if(!student||!needsMeal(student)||isAbsent(student,todayWeek())||!cameToCare(student)||!careSatisfied(student))return;
    student.mealTaken=!student.mealTaken;saveLocal();if(window.cloud){const result=await cloud.from('attendance').upsert({attendance_date:today(),student_id:String(student.id),meal_taken:student.mealTaken});if(result.error)return alert('吃饭点名保存失败：'+result.error.message)}renderMealFixed();
  };

  function installSummaryBoard(){
    const cards=$('summary')?.querySelectorAll(':scope > .card'),target=cards?.[cards.length-1];if(!target)return;
    target.innerHTML='<h2 class="section-title">当前特殊情况</h2><p class="muted">按一至六年级横向分类；记录会持续保留，直到老师在后台手动删除。</p><div id="summarySpecialBoard" class="summary-grade-grid"></div>';
    renderSummarySpecialBoard();
  }
  function removeEmergencyFeature(){
    document.querySelector('[data-page="emergency"]')?.remove();$('emergency')?.remove();if(!$('emergencyStudent'))document.body.insertAdjacentHTML('beforeend','<select id="emergencyStudent" class="hidden" aria-hidden="true"></select>');window.renderEmergency=()=>{};
    document.querySelectorAll('.nav button').forEach((button,index)=>{const number=button.querySelector('.num');if(number)number.textContent=String(index+1).padStart(2,'0')});
  }

  function refreshSchoolUI(){ensureAttendanceFilters();ensureStudentForm();renderSchoolManager();refreshStudentSchoolOptions();annotateStudentList();window.renderAttendance?.();renderSpecialFixed();renderMealFixed()}
  function install(){
    installStyle();installAttendance();installAdmin();installDaily();removeEmergencyFeature();installSummaryBoard();installAdminFeatureChooser();installMealPlanningPage();installSpecialForm();window.renderSpecial=renderSpecialFixed;
    window.renderAll=()=>{window.renderAttendance?.();window.renderAdmin?.();renderSpecialFixed();renderMealFixed()};
    window.addEventListener('schoolCatalogUpdated',refreshSchoolUI);refreshSchoolUI();
  }
  window.addEventListener('load',()=>setTimeout(install,2400));
})();
