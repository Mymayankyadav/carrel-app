/* R0a: task UI will be moved here by P3. */

function openBusySheet(k, id, rec) {
  if (rec) {
    const c = commitmentsMap()[id];
    if (!c) return;
    openSheet({ type: 'busy', rec: true, id, k, title: c.title || '', start: c.start || '', end: c.end || '', days: Array.isArray(c.days) ? c.days.slice() : [], bact: c.activity || '', armed: false, err: '' });
  } else {
    const ev = ((V.plans[k] && V.plans[k].events) || {})[id];
    if (!ev) return;
    openSheet({ type: 'busy', rec: false, id, k, title: ev.title || '', start: ev.start || '', end: ev.end || '', days: [], bact: ev.activity || '', armed: false, err: '' });
  }
}

function sBusy(sh) {
  const weekly=!!sh.rec;
  const head=kSheetHead(weekly?'Weekly item':'Busy',sh.id&&commitmentsMap()[sh.id]||(!weekly&&sh.id)?kIconBtn('delete','Delete','data-act="busy-del"'):'');
  const days=Array.from({length:7},(_,i)=>{const d=((+CFG.weekStart||0)+i)%7;return '<button type="button" class="p3-day'+(sh.days&&sh.days.includes(d)?' active':'')+'" data-act="p3-day" data-d="'+d+'" aria-pressed="'+!!(sh.days&&sh.days.includes(d))+'" aria-label="'+esc(wdName(new Date(2026,0,4+d),true))+'">'+esc(wdName(new Date(2026,0,4+d)).slice(0,1))+'</button>';}).join('');
  const dates=weekly?kField('Days','<div class="p3-days" role="group" aria-label="Repeat days">'+days+'</div>'):
    kField('Date',kDate({bind:'sheet.k',key:sh.k||todayKey()}));
  return head+'<div class="k-sheet-body p3-sheet">'+
    kText({bind:'sheet.title',value:sh.title,placeholder:'Title',attrs:'id="bz-title" maxlength="60" aria-label="Title"'})+
    dates+kField('Start',kTime({bind:'sheet.start',hm:sh.start}))+
    kField('End',kTime({bind:'sheet.end',hm:sh.end}))+
    (sh.armed?'<span class="p3-error" role="status">Tap Delete again</span>':'')+errLine(sh)+
    '</div>'+kSheetFoot(kBtn('Save','data-act="busy-save"',{kind:'primary'}));
}

function openDeadlineSheet(id) {
  if (id) {
    const d = deadlinesMap()[id];
    if (!d) return;
    openSheet({ type: 'deadline', id, title: d.title || '', date: d.date || todayKey(), time: d.time || '', activity: d.activity || '', kind: d.kind || 'exam', done: !!d.done, armed: false, err: '' });
  } else openSheet({ type: 'deadline', id: null, title: '', date: addDaysKey(todayKey(), 7), time: '', activity: '', kind: 'exam', done: false, armed: false, err: '' });
}

function sDeadline(sh) {
  const actions=sh.id?(kIconBtn('check','Toggle done','data-act="dl-done"')+
    kIconBtn('delete','Delete','data-act="dl-del"')):'';
  const types=kSeg({act:'dl-kind',value:sh.kind||'exam',options:[
    {v:'exam',label:'Exam',icon:'exam'},
    {v:'due',label:'Due',icon:'due'},
    {v:'other',label:'Other',icon:'other'}]});
  return kSheetHead('Deadline',actions)+
    '<div class="k-sheet-body p3-sheet">'+
    kText({bind:'sheet.title',value:sh.title,placeholder:'Title',attrs:'id="dl-title" maxlength="60" aria-label="Deadline title"'})+
    kField('Type',types)+
    kField('Date',kDate({bind:'sheet.date',key:sh.date}))+
    kField('Time','<input class="k-input" type="time" data-bind="sheet.time" id="dl-time" aria-label="Optional time" value="'+esc(sh.time||'')+'">')+
    kField('Subject',kActPick({bind:'sheet.activity',id:sh.activity,study:true,life:false,none:true}))+
    (sh.armed?'<span class="p3-error" role="status">Tap Delete again</span>':'')+errLine(sh)+'</div>'+
    kSheetFoot(kBtn('Save','data-act="dl-save"',{kind:'primary'}));
}

function openTaskSheet(id) {
  const t = id ? backlogMap()[id] : null;
  if (id && !t) return;
  openSheet({ type: 'task', id: id || null, title: t ? t.title : '', activity: t && ACTMAP[t.activity] ? t.activity : (ACTMAP[UI.ta.activity] ? UI.ta.activity : firstStudyId()), minutes: t ? (+t.minutes || 60) : 60, due: (t && t.due) || '', prio: t ? (+t.prio || 2) : 2, day: addDaysKey(todayKey(), 1), err: '' });
}

function sTask(sh) {
  const more=kCollapse('p3-task-more','More',
    kField('Due date',kDate({bind:'sheet.due',key:sh.due||''}))+
    kField('Priority',kSeg({act:'task-prio',value:String(sh.prio||2),options:[
      {v:'1',label:'High',icon:'up'},{v:'2',label:'Normal'},{v:'3',label:'Low',icon:'down'}]}))+
    kField('Plan on a day',kDate({bind:'sheet.day',key:sh.day||todayKey()})));
  const presets=kChips({act:'p3-min',value:String(sh.minutes),options:
    [30,60,90,120,180].map(m=>({v:String(m),label:fmtDur(m*MIN)}))});
  const footer='<div class="p3-dual">'+kBtn('Find time','data-act="task-sched" data-w="find"',{kind:'tonal',icon:'autoplan'})+
    kBtn('Save','data-act="task-save"',{kind:'primary'})+'</div>';
  return kSheetHead('Task',sh.id?kIconBtn('delete','Delete','data-act="p3-task-delete"'):'')+
    '<div class="k-sheet-body p3-sheet">'+
    kText({bind:'sheet.title',value:sh.title,placeholder:'Task',attrs:'id="tk-title" maxlength="80" aria-label="Task title"'})+
    kField('Subject',kActPick({bind:'sheet.activity',id:sh.activity,study:true,life:false,none:false}))+
    kField('Length',presets)+more+
    (sh.armed?'<span class="p3-error" role="status">Tap Delete again</span>':'')+errLine(sh)+
    '</div>'+kSheetFoot(footer);
}

function taskFromSheet() {
  const sh = UI.sheet, m = Math.round(+sh.minutes);
  sh.err = '';
  if (!String(sh.title || '').trim()) sh.err = 'Give the task a name.';
  else if (!ACTMAP[sh.activity]) sh.err = 'Choose a subject or activity.';
  else if (!(m >= 5 && m <= 720)) sh.err = 'Use between 5 and 720 minutes.';
  else if (sh.due && !/^\d{4}-\d{2}-\d{2}$/.test(sh.due)) sh.err = 'Pick a valid due date.';
  if (sh.err) { renderSheet(); return null; }
  return { title: String(sh.title).trim().slice(0, 80), activity: sh.activity, minutes: m, due: sh.due || null, prio: +sh.prio || 2 };
}

SHEETS.busy = sBusy; SHEETS.deadline = sDeadline; SHEETS.task = sTask;

// P3 Tasks page: Deadline, Backlog and Weekly without the old Plan side panels.
function p3SelectedTab(params){
  const tab=params&&params.tab||UI.p3Tab||'deadlines';
  return ['deadlines','backlog','weekly'].includes(tab)?tab:'deadlines';
}
function p3PageParams(){
  const stack=UI.pages||[],top=stack[stack.length-1];
  return top&&top.id==='tasks'?top.params||{}:{};
}
function p3DueLabel(date){
  const days=daysUntil(date);
  if(days===0)return 'Today';
  if(days===1)return 'Tomorrow';
  if(days>1)return 'in '+days+'d';
  return days===-1?'Yesterday':Math.abs(days)+'d ago';
}
function p3DeadlineRows(){
  const rows=deadlineList(),pending=rows.filter(d=>!d.done),done=rows.filter(d=>d.done);
  const label=d=>esc(shortDay(d.date))+(d.time?' · '+esc(fmtHM(d.time)):'');
  const row=d=>{
    const subject=d.activity&&ACTMAP[d.activity]?ACTMAP[d.activity]:null;
    const marker=d.kind==='exam'?'exam':d.kind==='due'?'due':'other';
    const priority=!d.done&&daysUntil(d.date)<=2;
    const contents=kRow({icon:marker,label:d.title,sub:label(d),
      right:'<span class="p3-count'+(priority?' urgent':'')+'">'+
      esc(d.done?'Done':p3DueLabel(d.date))+'</span>'+icon('open'),
      attrs:'data-act="p3-deadline" data-id="'+esc(d.id)+'"'});
    return '<div class="p3-deadline-row"'+(subject?' style="--p3-subject:'+kSafeColour(subject.color)+'"':'')+'>'+
      contents+'</div>';
  };
  return pending.map(row).join('')+(done.length?'<details class="p3-done"><summary>Done ('+done.length+')</summary>'+
    done.map(row).join('')+'</details>':'')||kEmpty('No deadlines');
}
function p3BacklogRows(){
  const rows=backlogList();
  if(!rows.length)return kEmpty('Backlog is empty');
  return rows.map(t=>{
    const a=t.activity&&ACTMAP[t.activity]?ACTMAP[t.activity]:null;
    const parts=[a&&a.name,fmtDur(t.minutes*MIN),t.due?'due '+shortDay(t.due):null].filter(Boolean).join(' · ');
    return '<div class="p3-taskrow">'+
      kRow({label:t.title,sub:parts,dot:a&&a.color||null,right:t.prio===1?'<span class="p3-high" role="img" aria-label="High priority" title="High priority">'+icon('high')+'</span>':'',
        attrs:'data-act="p3-task" data-id="'+esc(t.id)+'"'})+
      kIconBtn('schedule','Find time','data-act="p3-schedule" data-id="'+esc(t.id)+'"')+
      '</div>';
  }).join('');
}
function p3WeeklyRows(){
  const order=+CFG.weekStart||0,rows=Object.entries(commitmentsMap()).filter(([,r])=>r&&!r.archived&&r.days&&r.days.length)
    .map(([id,r])=>({id,...r})).sort((a,b)=>(a.start||'').localeCompare(b.start||''));
  if(!rows.length)return kEmpty('No weekly items');
  return rows.map(c=>{
    const days=c.days.slice().sort((a,b)=>((a-order+7)%7)-((b-order+7)%7))
      .map(d=>wdName(new Date(2026,0,4+d))).join(', ');
    return kRow({label:c.title||'Busy',sub:days,
      value:fmtHM(c.start)+'–'+fmtHM(c.end),open:true,
      attrs:'data-act="p3-weekly" data-id="'+esc(c.id)+'"'});
  }).join('');
}
function p3TasksPage(params){
  const tab=p3SelectedTab(params);
  const header=kSeg({act:'p3-tab',value:tab,options:[
    {v:'deadlines',label:'Deadlines'},{v:'backlog',label:'Backlog'},{v:'weekly',label:'Weekly'}]});
  const body=tab==='deadlines'?p3DeadlineRows():tab==='backlog'?p3BacklogRows():p3WeeklyRows();
  return '<section class="p3-tasks"><div class="p3-tabs">'+header+'</div>'+
    (tab==='backlog'&&backlogList().length?'<div class="p3-all">'+
      kBtn('Plan all','data-act="bl-auto"',{kind:'text',icon:'autoplan'})+'</div>':'')+
    '<div class="p3-list">'+body+'</div></section>';
}
PAGES.tasks={title:'Tasks',render:p3TasksPage,
  actions:()=>kIconBtn('add','Add item','data-act="p3-add"')};
Object.assign(ACT,{
  'p3-tab'(el){
    const tab=el.getAttribute('data-v');
    if(!['deadlines','backlog','weekly'].includes(tab))return;
    UI.p3Tab=tab;
    const top=(UI.pages||[]).at(-1);
    if(top&&top.id==='tasks')top.params={...(top.params||{}),tab};
    render();
  },
  'p3-add'(){
    const tab=p3SelectedTab(p3PageParams());
    if(tab==='deadlines')openDeadlineSheet(null);
    else if(tab==='backlog')openTaskSheet(null);
    else {
      openSheet({type:'busy',rec:true,id:uid('w'),k:null,title:'',start:'10:00',end:'11:00',
        days:[weekdayOfKey(todayKey())],bact:'',armed:false,err:''});
    }
  },
  'p3-deadline'(el){openDeadlineSheet(el.getAttribute('data-id'));},
  'p3-task'(el){openTaskSheet(el.getAttribute('data-id'));},
  'p3-weekly'(el){openBusySheet(null,el.getAttribute('data-id'),true);},
  'p3-min'(el){
    if(!UI.sheet||UI.sheet.type!=='task')return;
    const n=+el.getAttribute('data-v');
    if([30,60,90,120,180].includes(n)){UI.sheet.minutes=n;renderSheet();}
  },
  'p3-day'(el){
    const sh=UI.sheet;if(!sh||!sh.rec)return;
    const d=+el.getAttribute('data-d');
    if(!Number.isInteger(d)||d<0||d>6)return;
    sh.days=Array.isArray(sh.days)?sh.days:[];
    sh.days=sh.days.includes(d)?sh.days.filter(x=>x!==d):sh.days.concat(d);
    renderSheet();
  },
  'p3-schedule'(el){
    const id=el.getAttribute('data-id'),task=backlogMap()[id];
    if(!task)return;
    const target=findDayFor(Math.max(5,+task.minutes||60),task.due||null,{});
    scheduleTask(id,target.k,null);
  },
  'p3-task-delete'(){
    const sh=UI.sheet;
    if(!sh||sh.type!=='task'||!sh.id||!backlogMap()[sh.id])return;
    if(!sh.armed){sh.armed=true;renderSheet();return;}
    const w=W();w.update('planning/backlog',{items:{[sh.id]:null}},{items:{}});
    closeSheet(true);commit('Deleted task.',w);
  }
});
