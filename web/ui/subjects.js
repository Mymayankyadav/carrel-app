/* L4 — Subject overview, topic recall, and review surfacing. */
function l4DueTopics(k){return dueTopics(V.topics||{},k||todayKey());}
function l4ExamFor(subject,k){
  return deadlineList().filter(d=>!d.done&&d.kind==='exam'&&d.activity===subject&&d.date>=(k||todayKey()))[0]||null;
}
function l4TopicsFor(id){
  return Object.entries(V.topics||{}).filter(([,t])=>t&&!t.archived&&t.subject===id&&t.title)
    .map(([key,t])=>Object.assign({id:key},t))
    .sort((a,b)=>(a.due||'9999-12-31').localeCompare(b.due||'9999-12-31')||a.title.localeCompare(b.title));
}
function l4ReviewTopic(id,rating){
  const t=V.topics[id],n=Number(rating);
  if(!t||t.archived||![1,2,3].includes(n))return false;
  const today=todayKey(),exam=l4ExamFor(t.subject,today);
  const update=nextReview(t,n,today,exam&&exam.date);
  if(!update)return false;
  return commit('Review scheduled for '+shortDay(update.due)+'.',
    W().update('topics/'+id,update),{undo:true})===true;
}
function l4SubjectStats(id,agg){
  return Object.values(agg).reduce((m,d)=>m+(d.acts&&d.acts[id]||0),0);
}
function l4Overview(){
  const now=Date.now(),k=todayKey(),week=aggregate(ENTRIES,now,weekStartKey(k),k);
  const acts=ACTS.filter(a=>a.kind==='study'&&!a.archived);
  const head='<header class="l4-heading"><h1 class="k-h1">Subjects</h1>'+kIconBtn('add','Quick add','data-act="l9-open"')+'</header>';
  if(!acts.length)return '<div class="l4-view">'+head+kEmpty('Add a study subject in Settings to get started.')+'</div>';
  return '<div class="l4-view">'+head+
    acts.map(a=>{
      const studied=l4SubjectStats(a.id,week),goal=Math.max(0,+a.goal||0)*MIN;
      const pct=goal?Math.min(100,100*studied/goal):0;
      const next=l4ExamFor(a.id,k),due=l4DueTopics(k).filter(t=>t.subject===a.id).length;
      const notes=[next?'Next: '+next.title+' '+countdown(next.date):null,due?due+' due':null].filter(Boolean).join(' · ');
      return '<section class="l4-subject"><button type="button" class="l4-subject-link" data-act="l4-subject" data-id="'+esc(a.id)+'">'+
        '<i class="k-dot" style="--c:'+kSafeColour(a.color)+'" aria-hidden="true"></i>'+
        '<span class="l4-subject-desc"><strong>'+esc(a.name)+'</strong>'+
        (notes?'<small>'+esc(notes)+'</small>':'')+'</span>'+
        '<span class="l4-subject-total">'+esc(fmtDur(studied)+(goal?' / '+fmtDur(goal):''))+'</span>'+icon('open')+'</button>'+
        (goal?'<div class="l4-goal" role="progressbar" aria-label="'+esc(a.name)+' weekly goal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(pct)+'"><span style="width:'+pct.toFixed(2)+'%;background:'+kSafeColour(a.color)+'"></span></div>':'')+
        '</section>';
    }).join('')+'</div>';
}
function l4Section(name,items,renderer,id,empty){
  if(!items.length&&!empty)return '';
  const key='l4:'+id+':'+name,all=!!(UI.subjectAll&&UI.subjectAll[key]);
  const count=items.length,visible=all?items:items.slice(0,5);
  return kGroup(name,(count?visible.map(renderer).join(''):empty)+
    (count>5?kBtn(all?'Show less':'All ('+count+')','data-act="l4-toggle" data-key="'+esc(key)+'"',{kind:'text'}):''));
}
function l4SubjectPage(p){
  const id=p.id,a=ACTMAP[id];
  if(!a||a.archived||a.kind!=='study')return kEmpty('This subject is not available.');
  const deadlines=deadlineList().filter(d=>d.activity===id&&!d.done);
  const backlog=backlogList().filter(t=>t.activity===id);
  const topics=l4TopicsFor(id),k=todayKey();
  const recent=ENTRIES.filter(e=>e.a===id&&!e.running&&e.e).sort((x,y)=>y.s-x.s).slice(0,5);
  return '<div class="l4-detail">'+
    l4Section('Deadlines',deadlines,d=>kRow({icon:'flag',label:d.title,
      sub:countdown(d.date)+(d.time?' · '+fmtHM(d.time):''),
      attrs:'data-act="l4-deadline" data-id="'+esc(d.id)+'"'}),id)+
    l4Section('Topics',topics,t=>kRow({icon:'bookmark',label:t.title,
      sub:t.due?(t.due<k?'Overdue '+Math.round((dateOfKey(k)-dateOfKey(t.due))/DAY)+'d':countdown(t.due)):'Not scheduled',
      attrs:'data-act="l4-topic-open" data-id="'+esc(t.id)+'"'}),id,
      kEmpty('No topics yet',kBtn('Add topic','data-act="l4-topic-new" data-id="'+esc(id)+'"',{kind:'text'})))+
    '<div class="l4-add-topic">'+kBtn('Add topic','data-act="l4-topic-new" data-id="'+esc(id)+'"',{kind:'text',icon:'add'})+'</div>'+
    l4Section('Backlog',backlog,t=>kRow({icon:'tasks',label:t.title,
      sub:fmtDur(t.minutes*MIN)+(t.due?' · Due '+shortDay(t.due):''),
      attrs:'data-act="l4-task" data-id="'+esc(t.id)+'"'}),id)+
    l4Section('Recent',recent,e=>kRow({icon:'timer',label:e.note||act(e.a).name,
      sub:shortDay(dayKeyOf(e.s))+' · '+fmtDur(e.e-e.s),
      attrs:'data-act="l4-entry" data-id="'+esc(e.id)+'"'}),id)+'</div>';
}
function l4NewTopic(subject){
  const a=ACTMAP[subject]&&ACTMAP[subject].kind==='study'?subject:firstStudyId();
  openSheet({type:'topic',id:null,d:{title:'',subject:a,rating:null},err:''});
}
function l4EditTopic(id){
  const t=V.topics[id];if(!t||t.archived)return;
  openSheet({type:'topic',id,d:{title:t.title||'',subject:t.subject||firstStudyId(),rating:null},err:''});
}
function l4TopicSheet(sh){
  const d=sh.d;
  const current=sh.id&&V.topics[sh.id],day=todayKey();
  const exam=l4ExamFor(d.subject,day),review=d.rating?nextReview(current||{},+d.rating,day,exam&&exam.date):null;
  const rating=kSeg({act:'l4-select-rating',value:d.rating==null?'':String(d.rating),
    options:[{v:'1',label:'Poor'},{v:'2',label:'Okay'},{v:'3',label:'Good'}]});
  return kSheetHead(sh.id?'Edit topic':'Add topic',sh.id?kIconBtn('trash','Delete topic','data-act="l4-delete-topic"'):'')+
    '<div class="k-sheet-body l4-topic-sheet">'+
      kField('Topic',kText({bind:'sheet.d.title',value:d.title,placeholder:'e.g. Compactness'}))+
      kField('Subject',kActPick({bind:'sheet.d.subject',id:d.subject,study:true,life:false}))+
      kField('How well did you recall it?',rating)+
      '<p class="l4-topic-note">'+esc(review?'Next review '+shortDay(review.due):
        current?'Next '+(current.due||'not set'):'First review tomorrow')+'</p>'+
      (sh.err?'<div class="l4-error" role="alert">'+esc(sh.err)+'</div>':'')+
    '</div>'+kSheetFoot(kBtn('Save','data-act="l4-topic-save"',{kind:'primary'}));
}
function l4ReviewSheet(){
  const due=l4DueTopics(todayKey());
  return kSheetHead('Reviews due')+'<div class="k-sheet-body l4-reviews">'+
    (due.length?due.map(t=>'<div class="l4-review" data-key="'+esc(t.id)+'"><div><strong>'+esc(t.title)+'</strong>'+
      '<small>'+esc(act(t.subject).name)+'</small></div>'+
      '<div class="l4-rating">'+[1,2,3].map(r=>kBtn(['Poor','Okay','Good'][r-1],
        'data-act="l4-review-rate" data-id="'+esc(t.id)+'" data-v="'+r+'"',{kind:'text'})).join('')+'</div></div>').join(''):
      kEmpty('All caught up.'))+'</div>';
}
function l4RenderReviewCard(){
  const due=l4DueTopics(todayKey());
  if(!due.length)return '';
  return '<button type="button" class="l4-review-card" data-act="l4-open-reviews">'+
    '<strong>'+due.length+' review'+(due.length===1?'':'s')+' due</strong>'+
    '<span>'+esc(due.slice(0,2).map(t=>t.title).join(', '))+'</span>'+icon('open')+'</button>';
}
VIEWS.subjects=l4Overview;
PAGES.subject={
  title:p=>act(p.id).name,
  actions:p=>kIconBtn('edit','Edit subject','data-act="l4-edit-subject" data-id="'+esc(p.id)+'"'),
  render:l4SubjectPage
};
SHEETS.topic=l4TopicSheet;
SHEETS.reviews=l4ReviewSheet;
Object.assign(ACT,{
  'l4-subject'(el){pushPage('subject',{id:el.getAttribute('data-id')});},
  'l4-edit-subject'(el){openPage('settings','settings.activity',{id:el.getAttribute('data-id')});},
  'l4-toggle'(el){UI.subjectAll=UI.subjectAll||{};const key=el.getAttribute('data-key');UI.subjectAll[key]=!UI.subjectAll[key];render();},
  'l4-deadline'(el){openDeadlineSheet(el.getAttribute('data-id'));},
  'l4-task'(el){openTaskSheet(el.getAttribute('data-id'));},
  'l4-entry'(el){openEntrySheet('edit',{id:el.getAttribute('data-id')});},
  'l4-topic-new'(el){l4NewTopic(el.getAttribute('data-id'));},
  'l4-topic-open'(el){l4EditTopic(el.getAttribute('data-id'));},
  'l4-select-rating'(el){const sh=UI.sheet;if(!sh||sh.type!=='topic')return;sh.d.rating=+el.getAttribute('data-v');renderSheet();},
  'l4-topic-save'(){
    const sh=UI.sheet;if(!sh||sh.type!=='topic')return;
    const title=String(sh.d.title||'').trim().slice(0,120),a=sh.d.subject;
    if(!title||!a||!ACTMAP[a]||ACTMAP[a].kind!=='study'||ACTMAP[a].archived){sh.err='Enter a topic and active study subject.';renderSheet();return;}
    const t=sh.id&&V.topics[sh.id],key=todayKey(),exam=l4ExamFor(a,key);
    if(sh.id&&(!t||t.archived)){
      sh.err='This topic is no longer available. Close and reopen it.';renderSheet();return;
    }
    const review=sh.d.rating?nextReview(t||{},+sh.d.rating,key,exam&&exam.date):null;
    const w=W();
    if(t)w.update('topics/'+sh.id,Object.assign({title,subject:a},review||{}));
    else{
      const order=Object.values(V.topics||{}).filter(x=>x&&x.subject===a).length+1;
      w.set('topics/'+uid('tp'),Object.assign({
        v:1,subject:a,title,order,due:addDaysKey(key,1),interval:1,ease:2.5,reps:0,last:null,archived:false
      },review||{}));
    }
    if(commit('Topic saved.',w,{undo:true}))closeSheet(true);
    else{sh.err='Topic not saved. Check device storage and retry.';renderSheet();}
  },
  'l4-delete-topic'(){
    const sh=UI.sheet;if(!sh||sh.type!=='topic'||!sh.id)return;
    const id=sh.id;
    if(commit('Topic archived.',W().update('topics/'+id,{archived:true}),{undo:true}))closeSheet(true);
    else{sh.err='Topic not archived. Check device storage and retry.';renderSheet();}
  },
  'l4-open-reviews'(){openSheet({type:'reviews'});},
  'l4-review-rate'(el){if(l4ReviewTopic(el.getAttribute('data-id'),el.getAttribute('data-v')))renderSheet();}
});
/* cards.js is loaded after subjects.js in the frozen manifest. Register only
 * when all scripts have been evaluated; no manifest modification needed. */
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{
  if(typeof CARDS==='undefined')return;
  CARDS.reviews={rank:()=>{const n=l4DueTopics(todayKey()).length;return n?60+Math.min(20,5*n):0;},
    render:l4RenderReviewCard};
});
