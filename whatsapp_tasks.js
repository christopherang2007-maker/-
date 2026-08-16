/* WhatsApp dual delivery: manual link or Supabase queue. No secret key is used here. */
(()=>{
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const jobByStudent=new Map();
  const groupByStudent=new Map();
  let deliveryMode='manual';
  let senderDevice=null;
  let initialized=false;
  let activeDate=today();

  function messageFor(student){
    return `【托育班通知｜${student.name}】宝贝已安全到达托育班了哦~ ✨`;
  }

  function dayStartIso(){
    return new Date(`${today()}T00:00:00+08:00`).toISOString();
  }

  function deviceOnline(){
    if(!senderDevice?.enabled||!senderDevice.last_seen_at)return false;
    return Date.now()-new Date(senderDevice.last_seen_at).getTime()<60000;
  }

  async function refreshMessagingState(render=true){
    if(!window.cloud||!window.cloudUser)return;
    const [jobs,mappings,settings,devices]=await Promise.all([
      cloud.from('message_jobs').select('id,student_id,status,delivery_mode,message_text,error_message,created_at,sent_at').eq('message_type','arrival_notification').gte('created_at',dayStartIso()).order('created_at',{ascending:false}),
      cloud.from('student_whatsapp_groups').select('student_id,whatsapp_group_id,group_display_name'),
      cloud.from('app_settings').select('setting_value').eq('setting_key','whatsapp_delivery').maybeSingle(),
      cloud.from('sender_devices').select('id,device_name,enabled,whatsapp_ready,status,last_seen_at,app_version').eq('enabled',true).order('last_seen_at',{ascending:false}).limit(1)
    ]);
    if(jobs.error)console.warn('读取发送任务失败：',jobs.error.message);
    if(mappings.error)console.warn('读取WhatsApp群组绑定失败：',mappings.error.message);
    if(settings.error)console.warn('读取发送模式失败：',settings.error.message);
    if(devices.error)console.warn('读取发送电脑状态失败：',devices.error.message);
    jobByStudent.clear();
    (jobs.data||[]).forEach(job=>{if(!jobByStudent.has(String(job.student_id)))jobByStudent.set(String(job.student_id),job)});
    groupByStudent.clear();
    (mappings.data||[]).forEach(item=>groupByStudent.set(String(item.student_id),item));
    deliveryMode=settings.data?.setting_value?.mode||'manual';
    senderDevice=devices.data?.[0]||null;
    students.forEach(student=>{
      student.whatsappGroup=groupByStudent.get(String(student.id))||null;
      student.messageJob=jobByStudent.get(String(student.id))||null;
      if(['sent','manual_sent'].includes(student.messageJob?.status))student.notified=true;
    });
    updateSettingsPanel();
    if(render&&typeof window.renderAttendance==='function')window.renderAttendance();
    setTimeout(updateBulkButton,0);
  }

  function buttonStyle(kind){
    if(kind==='ok')return 'background:#078560;color:#fff;border:0';
    if(kind==='bad')return 'background:#fff0f0;color:#b3261e;border:1px solid #e4a5a5';
    return 'background:#fff;color:#42506a;border:1px solid #b8c0ce';
  }

  window.whatsappNotificationButton=(student,canSend=true)=>{
    const job=jobByStudent.get(String(student.id));
    const common='margin:0;padding:7px 9px;border-radius:8px;';
    if(!canSend)return `<button disabled style="${common}opacity:.45">尚未完成点名</button>`;
    if(['sent','manual_sent'].includes(job?.status)||(!job&&student.notified))return `<button disabled style="${common}${buttonStyle('ok')}">✓ 已发送</button>`;
    if(job?.status==='pending')return `<button disabled style="${common}${buttonStyle('plain')}">等待发送…</button>`;
    if(job?.status==='processing')return `<button disabled style="${common}${buttonStyle('plain')}">发送中…</button>`;
    if(job?.status==='manual_opened')return `<button style="${common}${buttonStyle('ok')}" onclick="confirmManualSent('${esc(student.id)}')">确认已发送</button>`;
    if(job?.status==='failed')return `<button style="${common}${buttonStyle('bad')}" onclick="handleFailedMessage('${esc(student.id)}')">自动发送失败</button>`;
    const label=deliveryMode==='manual'?'WhatsApp手动发送':deliveryMode==='automatic'?'WhatsApp自动发送':'自动发送（可手动补发）';
    return `<button class="greenbtn" style="${common}" onclick="shareStudentWhatsapp('${esc(student.id)}')">${label}</button>`;
  };

  function idempotency(studentId,suffix=''){
    return `${studentId}:arrival:${today()}${suffix}`;
  }

  async function insertJob(student,mode,status,keySuffix=''){
    const task={
      student_id:String(student.id),
      created_by:cloudUser.id,
      message_type:'arrival_notification',
      recipient_type:'whatsapp_group',
      message_text:messageFor(student),
      status,
      delivery_mode:mode,
      scheduled_at:new Date().toISOString(),
      idempotency_key:idempotency(student.id,keySuffix)
    };
    const {data,error}=await cloud.from('message_jobs').insert(task).select('id,student_id,status,delivery_mode,message_text,error_message,created_at').single();
    if(error){
      if(error.code==='23505'){
        await refreshMessagingState();
        return jobByStudent.get(String(student.id));
      }
      throw error;
    }
    jobByStudent.set(String(student.id),data);
    return data;
  }

  function openManual(student){
    const text=messageFor(student);
    navigator.clipboard?.writeText(text).catch(()=>{});
    window.open(student.group||'https://web.whatsapp.com','_blank');
    alert('通知文案已复制。请在正确的WhatsApp家庭群粘贴并发送，再回到网站点击“确认已发送”。');
  }

  async function startManual(student,existingJob=null,keySuffix=''){
    if(existingJob){
      const {error}=await cloud.from('message_jobs').update({status:'manual_opened'}).eq('id',existingJob.id);
      if(error)throw error;
      existingJob.status='manual_opened';
      jobByStudent.set(String(student.id),existingJob);
    }else{
      await insertJob(student,'manual','manual_opened',keySuffix);
    }
    window.renderAttendance();
    openManual(student);
  }

  window.shareStudentWhatsapp=async id=>{
    const student=students.find(item=>String(item.id)===String(id));
    if(!student||!window.cloudUser)return alert('网站尚未完成云端登录。');
    const existingJob=jobByStudent.get(String(student.id));
    if(existingJob&&!['failed','cancelled'].includes(existingJob.status))return;
    const retrySuffix=existingJob?.status==='cancelled'?`:retry:${Date.now()}`:'';
    try{
      if(deliveryMode==='manual'){
        if(!confirm(`打开WhatsApp手动通知「${student.name}」吗？`))return;
        await startManual(student,null,retrySuffix);
        return;
      }
      if(!groupByStudent.has(String(student.id)))return alert('这个学生尚未设置WhatsApp家庭群ID。请管理员先在学生资料中保存群组ID。');
      const offline=!deviceOnline()||!senderDevice?.whatsapp_ready;
      const warning=offline?'\n\n发送电脑目前离线或WhatsApp未连接，任务会等待电脑恢复。':'';
      if(!confirm(`确认建立「${student.name}」的到达通知任务吗？${warning}`))return;
      await insertJob(student,'automatic','pending',retrySuffix);
      window.renderAttendance();
      alert(offline?'任务已建立，目前等待发送电脑上线。':'任务已建立，正在等待发送电脑处理。');
    }catch(error){
      alert('无法建立发送任务：'+error.message);
      await refreshMessagingState();
    }
  };

  window.confirmManualSent=async id=>{
    const student=students.find(item=>String(item.id)===String(id));
    const job=jobByStudent.get(String(id));
    if(!student||!job||!confirm(`确认已经在WhatsApp发送给「${student.name}」的家庭群吗？`))return;
    const {error}=await cloud.from('message_jobs').update({status:'manual_sent'}).eq('id',job.id);
    if(error)return alert('无法记录手动发送状态：'+error.message);
    student.notified=true;
    job.status='manual_sent';
    if(typeof localSave==='function')localSave();
    await cloud.from('attendance').upsert({attendance_date:today(),student_id:String(student.id),school_a:!!student.school?.[0],school_b:!!student.school?.[1],care_a:!!student.care?.[0],care_b:!!student.care?.[1],notified:true});
    window.renderAttendance();
  };

  window.handleFailedMessage=async id=>{
    const student=students.find(item=>String(item.id)===String(id));
    const job=jobByStudent.get(String(id));
    if(!student||!job)return;
    const reason=job.error_message||'没有提供失败原因';
    const manual=confirm(`自动发送失败：${reason}\n\n按“确定”改用WhatsApp手动补发；按“取消”可选择重新建立自动任务。`);
    try{
      if(manual){await startManual(student,job);return;}
      if(!confirm('请先检查家庭群，确认没有收到信息。确定重新建立自动发送任务吗？'))return;
      await insertJob(student,'automatic','pending',`:retry:${Date.now()}`);
      window.renderAttendance();
    }catch(error){alert('无法处理失败任务：'+error.message)}
  };

  window.clearSentStatus=async()=>{
    if(window.cloudRole!=='admin')return alert('只有管理员可以重置已发送状态。');
    if(!confirm('这只会重置今天的“已发送”标记，已经送到WhatsApp的信息不会被撤回。重置后再次点击可能造成重复发送。确定继续吗？'))return;
    try{
      const jobs=await cloud.from('message_jobs').update({status:'cancelled'}).in('status',['sent','manual_sent']).gte('created_at',dayStartIso());
      if(jobs.error)throw jobs.error;
      const attendance=await cloud.from('attendance').update({notified:false}).eq('attendance_date',today());
      if(attendance.error)throw attendance.error;
      students.forEach(student=>student.notified=false);
      if(typeof localSave==='function')localSave();
      await refreshMessagingState(true);
      alert('今天的“已发送”标记已重置。现在可以重新建立发送任务。');
    }catch(error){
      alert('无法重置已发送状态：'+error.message);
    }
  };

  function visibleAutomaticCandidates(){
    const ids=[...document.querySelectorAll('#careList button[onclick^="shareStudentWhatsapp"]')]
      .map(button=>(button.getAttribute('onclick')||'').match(/shareStudentWhatsapp\('([^']+)'\)/)?.[1])
      .filter(Boolean);
    const unique=[...new Set(ids)];
    const visible=unique.map(id=>students.find(student=>String(student.id)===String(id))).filter(Boolean);
    const eligible=visible.filter(student=>{
      const job=jobByStudent.get(String(student.id));
      return !student.special&&student.care?.every(Boolean)&&groupByStudent.has(String(student.id))&&(!job||job.status==='cancelled');
    });
    const missingGroup=visible.filter(student=>!groupByStudent.has(String(student.id)));
    return {eligible,missingGroup};
  }

  function addBulkButton(){
    const notice=document.querySelector('#care .notice');
    if(!notice||document.getElementById('bulkAutomaticWhatsapp'))return;
    notice.insertAdjacentHTML('afterend',`<div id="bulkAutomaticWhatsapp" class="notice" style="display:none;margin-top:10px;background:#eef9f5;border-color:#9fd9c8"><button type="button" class="greenbtn" id="bulkAutomaticWhatsappButton" style="margin:0;width:100%">批量自动发送当前名单</button><small id="bulkAutomaticWhatsappHelp" style="display:block;margin-top:7px">只会为当前画面中完成托育双确认并已绑定群组ID的学生建立任务。</small></div>`);
    document.getElementById('bulkAutomaticWhatsappButton').onclick=window.bulkSendWhatsappTasks;
  }

  function updateBulkButton(){
    const panel=document.getElementById('bulkAutomaticWhatsapp');
    const button=document.getElementById('bulkAutomaticWhatsappButton');
    const help=document.getElementById('bulkAutomaticWhatsappHelp');
    if(!panel||!button)return;
    const automatic=deliveryMode==='automatic'||deliveryMode==='hybrid';
    panel.style.display=automatic?'block':'none';
    if(!automatic)return;
    const {eligible,missingGroup}=visibleAutomaticCandidates();
    button.disabled=eligible.length===0;
    button.textContent=eligible.length?`批量自动发送当前名单（${eligible.length}人）`:'当前名单没有可建立的任务';
    if(help)help.textContent=`只处理当前画面：可发送 ${eligible.length} 人${missingGroup.length?`；另有 ${missingGroup.length} 人未绑定群组ID`:''}。等待、发送中及已发送的学生会自动跳过。`;
  }

  window.bulkSendWhatsappTasks=async()=>{
    if(!['automatic','hybrid'].includes(deliveryMode))return alert('请先在后台开启自动或混合发送模式。');
    if(!window.cloudUser)return alert('网站尚未完成云端登录。');
    await refreshMessagingState(false);
    const {eligible,missingGroup}=visibleAutomaticCandidates();
    if(!eligible.length)return alert(missingGroup.length?'当前名单没有可发送学生；请先为学生绑定WhatsApp家庭群ID。':'当前名单没有尚待建立的自动发送任务。');
    const offline=!deviceOnline()||!senderDevice?.whatsapp_ready;
    const names=eligible.map(student=>student.name).join('、');
    const warning=offline?'\n\n发送电脑离线或WhatsApp未连接，任务会等待电脑恢复。':'';
    if(!confirm(`确定为当前名单中的 ${eligible.length} 位学生建立自动发送任务吗？\n\n${names}${warning}`))return;
    const button=document.getElementById('bulkAutomaticWhatsappButton');
    if(button){button.disabled=true;button.textContent='正在建立任务…'}
    let success=0;
    const failures=[];
    for(const student of eligible){
      try{
        const existing=jobByStudent.get(String(student.id));
        const suffix=existing?.status==='cancelled'?`:retry:${Date.now()}:${student.id}`:'';
        await insertJob(student,'automatic','pending',suffix);
        success++;
      }catch(error){failures.push(`${student.name}：${error.message}`)}
    }
    await refreshMessagingState(true);
    alert(`批量建立完成：成功 ${success} 人，失败 ${failures.length} 人。${failures.length?`\n\n${failures.join('\n')}`:''}`);
  };

  function addSettingsPanel(){
    const admin=document.getElementById('admin');
    if(!admin||document.getElementById('whatsappDeliverySettings'))return;
    admin.insertAdjacentHTML('afterbegin',`<div class="card" id="whatsappDeliverySettings" style="margin-bottom:18px"><h2 class="section-title">WhatsApp讯息发送方式</h2><div class="formgrid"><label>发送模式<select id="whatsappDeliveryMode"><option value="manual">WhatsApp Link手动发送</option><option value="automatic">Supabase电脑自动发送</option><option value="hybrid">自动优先，失败后手动补发</option></select></label><div><b>发送电脑状态</b><p id="senderDeviceStatus" class="muted">正在读取…</p></div><button type="button" class="save" id="saveWhatsappDeliveryMode">保存发送模式</button><button type="button" class="outline" id="resetWhatsappSentStatus" style="color:#b3261e;border-color:#e4a5a5">重置今日“已发送”标记</button></div><p class="muted">只有管理员可以修改。自动模式不会直接连接老师电脑IP，网站只会把任务写入Supabase。重置标记不会撤回已经送到WhatsApp的信息。</p></div>`);
    document.getElementById('saveWhatsappDeliveryMode').onclick=saveDeliveryMode;
    document.getElementById('resetWhatsappSentStatus').onclick=window.clearSentStatus;
  }

  function updateSettingsPanel(){
    const select=document.getElementById('whatsappDeliveryMode');
    if(select)select.value=deliveryMode;
    const status=document.getElementById('senderDeviceStatus');
    if(status){
      const online=deviceOnline();
      status.textContent=!senderDevice?'没有登记的发送电脑':`${senderDevice.device_name}：${online?'在线':'离线'}，WhatsApp ${senderDevice.whatsapp_ready?'已连接':'未连接'}；最后在线 ${senderDevice.last_seen_at?new Date(senderDevice.last_seen_at).toLocaleString():'未知'}`;
    }
    const save=document.getElementById('saveWhatsappDeliveryMode');
    if(save)save.disabled=window.cloudRole!=='admin';
    const reset=document.getElementById('resetWhatsappSentStatus');
    if(reset)reset.disabled=window.cloudRole!=='admin';
    setTimeout(updateBulkButton,0);
  }

  async function saveDeliveryMode(){
    if(window.cloudRole!=='admin')return alert('只有管理员可以修改发送模式。');
    const mode=document.getElementById('whatsappDeliveryMode').value;
    const {error}=await cloud.from('app_settings').update({setting_value:{mode},updated_by:cloudUser.id,updated_at:new Date().toISOString()}).eq('setting_key','whatsapp_delivery');
    if(error)return alert('无法保存发送模式：'+error.message);
    deliveryMode=mode;
    window.renderAttendance();
    updateBulkButton();
    alert('发送模式已保存。');
  }

  function addGroupFields(){
    const form=document.getElementById('easyStudentForm')||document.getElementById('studentForm');
    if(!form||form.elements.whatsapp_group_id)return;
    const groupLink=form.elements.group?.closest('label');
    const html=`<label>WhatsApp家庭群ID<input name="whatsapp_group_id" placeholder="例如：120363123456789012@g.us" pattern="[0-9]+@g\\.us"><small class="muted">从电脑发送工具复制，不要填写群主号码或邀请Link。</small></label><label>家庭群显示名称<input name="whatsapp_group_name" placeholder="例如：陈小明家庭群"></label>`;
    (groupLink||form.querySelector('.formgrid')||form).insertAdjacentHTML(groupLink?'afterend':'beforeend',html);
  }

  function wrapStudentEdit(){
    const previous=window.editStudent;
    window.editStudent=id=>{
      previous?.(id);
      const form=document.getElementById('studentForm');
      const mapping=groupByStudent.get(String(id));
      if(form?.elements.whatsapp_group_id)form.elements.whatsapp_group_id.value=mapping?.whatsapp_group_id||'';
      if(form?.elements.whatsapp_group_name)form.elements.whatsapp_group_name.value=mapping?.group_display_name||'';
    };
  }

  function watchStudentForm(){
    const form=document.getElementById('easyStudentForm')||document.getElementById('studentForm');
    if(!form)return;
    form.addEventListener('submit',()=>{
      const originalId=String(form.elements.id?.value||'');
      const name=String(form.elements.name?.value||'').trim();
      const groupId=String(form.elements.whatsapp_group_id?.value||'').trim();
      const groupName=String(form.elements.whatsapp_group_name?.value||'').trim();
      setTimeout(async()=>{
        if(!window.cloud||window.cloudRole!=='admin')return;
        const student=students.find(item=>originalId?String(item.id)===originalId:item.name===name);
        if(!student)return;
        try{
          if(groupId){
            if(!/^[0-9]+@g\.us$/.test(groupId))return alert('WhatsApp家庭群ID格式不正确，资料没有保存到群组绑定。');
            const {error}=await cloud.from('student_whatsapp_groups').upsert({student_id:String(student.id),whatsapp_group_id:groupId,group_display_name:groupName,updated_by:cloudUser.id,updated_at:new Date().toISOString()});
            if(error)throw error;
          }else if(groupByStudent.has(String(student.id))){
            const {error}=await cloud.from('student_whatsapp_groups').delete().eq('student_id',String(student.id));
            if(error)throw error;
          }
          await refreshMessagingState(false);
        }catch(error){alert('学生资料已保存，但WhatsApp群组绑定失败：'+error.message)}
      },350);
    });
  }

  async function resetWhenDateChanges(){
    const current=today();
    if(current===activeDate)return;
    activeDate=current;
    if(window.cloudUser&&typeof pullCloud==='function'){
      await pullCloud();
    }else{
      students.forEach(student=>{student.school=[false,false];student.care=[false,false];student.mealTaken=false;student.notified=false;student.special=null});
      if(typeof localSave==='function')localSave();
      if(typeof window.renderAll==='function')window.renderAll();
    }
    await refreshMessagingState(true);
  }

  function install(){
    if(initialized)return;
    initialized=true;
    addSettingsPanel();
    addBulkButton();
    addGroupFields();
    wrapStudentEdit();
    const previousPull=window.pullCloud;
    if(previousPull)window.pullCloud=async()=>{await previousPull();await refreshMessagingState(false)};
    setInterval(()=>refreshMessagingState(true).catch(console.warn),7000);
    setInterval(()=>resetWhenDateChanges().catch(console.warn),30000);
    setTimeout(()=>refreshMessagingState(true).catch(console.warn),600);
  }

  window.addEventListener('load',()=>setTimeout(install,1800));
})();
