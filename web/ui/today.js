/* ---------- distractions: noticed, drifted, parked ---------- */
function noticeOpen() { return UI.notice && UI.notice.until > Date.now() && CUR; }
function backText() {
  const c = CUR;
  if (!c) return '';
  if (c.note) return c.note;
  const p = V.plans[dayKeyOf(parseT(c.start))], b = c.block && p && p.blocks && p.blocks[c.block];
  return (b && b.title) || act(c.activity).name;
}
function showBack(ms) { UI.back = { text: backText(), until: Date.now() + (ms || 8000) }; setTimeout(render, (ms || 8000) + 100); }
function noticeNow() {
  const c = CUR;
  if (!c || !canWrite()) return;
  const now = Date.now(), k = dayKeyOf(now), id = uid('d');
  const w = W().dis(k, id, { type: 'urge', at: isoLocal(now), driftMin: null, text: null, activity: c.activity, entry: c.id, src: 'page', applied: true });
  commit(null, w, { undo: false });
  UI.notice = { k, id, until: now + 6000 };
  showBack(8000);
  setTimeout(render, 6100);
  render();
}
/* Cuts the drifted minutes out of whatever was logged and records them as drift, so the log stays honest. */
function driftWrites(w, at, min, note) {
  const dr = ACTS.find(a => a.role === 'drift' && !a.archived);
  if (!dr || !(min > 0)) return;
  const now = Date.now(), e = Math.min(at, now), s = e - min * MIN;
  trimOthers(ENTRIES.filter(x => x.s < e && entryEnd(x, now) > s), s, e, w);
  w.day(dayKeyOf(s), { [uid('e')]: { activity: dr.id, start: isoLocal(s), end: isoLocal(e), note: note || 'drift', focus: null, block: null, pomo: null } });
}
function noticeDrift(m) {
  const n = UI.notice;
  if (!n || !canWrite()) return;
  const at = parseT(V.distractions[n.k] && V.distractions[n.k].items && V.distractions[n.k].items[n.id] && V.distractions[n.k].items[n.id].at) || Date.now();
  const w = W().dis(n.k, n.id, { type: 'drift', driftMin: m, applied: true });
  driftWrites(w, at, m, 'drift');
  UI.notice = null;
  commit(`Noted ${m} minute${m > 1 ? 's' : ''} of drift.`, w, { undo: true });
  showBack(8000);
}
/* Drifts tapped on the phone arrive with applied:false. The first device that sees them cuts the time out, and flips the flag in the same commit. */
const APPLYING = new Set();
function applyPhoneDrifts() {
  if (!S.db || !canWrite() || !S.loaded.days || !S.loaded.distractions || !S.loaded.current || !S.loaded.activities) return;
  const w = W();
  let n = 0;
  for (const k in V.distractions) {
    const items = (V.distractions[k] && V.distractions[k].items) || {};
    for (const id in items) {
      const it = items[id];
      if (!it || it.type !== 'drift' || it.applied !== false || APPLYING.has(id)) continue;
      APPLYING.add(id);
      driftWrites(w, parseT(it.at), +it.driftMin || 0, 'drift (from phone)');
      w.dis(k, id, { applied: true });
      n++;
    }
  }
  if (n) commit(`From your phone: ${n} drift${n > 1 ? 's' : ''} logged.`, w, { undo: false });
}
function parkAdd(text) {
  const t = String(text || '').trim().slice(0, 140);
  if (!t || !canWrite()) return;
  const now = Date.now(), k = dayKeyOf(now);
  commit('Parked.', W().dis(k, uid('d'), { type: 'park', at: isoLocal(now), driftMin: null, text: t, activity: CUR ? CUR.activity : null, entry: CUR ? CUR.id : null, src: 'page', applied: true }), { undo: true });
  UI.parkText = '';
  render();
}
function parkedItems(k) {
  const items = (V.distractions[k] && V.distractions[k].items) || {};
  return Object.keys(items).filter(id => items[id].type === 'park' && !items[id].moved && !items[id].dismissed).map(id => Object.assign({ id }, items[id])).sort((a, b) => (a.at < b.at ? -1 : 1));
}
function parkToBacklog(k, id) {
  const it = V.distractions[k] && V.distractions[k].items && V.distractions[k].items[id];
  if (!it || !canWrite()) return;
  const cur = (V.planning.backlog && V.planning.backlog.items) || {};
  const order = Object.keys(cur).reduce((m, x) => Math.max(m, +cur[x].order || 0), 0) + 1;
  const first = ACTS.find(a => a.kind === 'study' && !a.archived);
  const w = W();
  w.update('planning/backlog', { items: { [uid('t')]: { title: it.text, activity: (it.activity && isStudyId(it.activity) ? it.activity : first && first.id) || null, minutes: 30, due: null, prio: 2, order, created: isoLocal(Date.now()) } } }, { items: {} });
  w.dis(k, id, { moved: true });
  commit('Moved to your backlog.', w, { undo: true });
}
/* T1 — minimalist Today view; dedicated actions retain existing write contracts. */
function t1Picks(){
  const visible=ACTS.filter(a=>!a.archived);
  return visible.filter(a=>a.today===true||((a.today===undefined)&&(a.kind==='study'||a.role==='break'||a.role==='sleep')));
}
function t1ActivityButton(a,klass){
  const running=!!(CUR&&CUR.activity===a.id);
  return '<button type="button" class="'+klass+'" data-act="t2-start" data-long="t2-start-opts" data-id="'+esc(a.id)+
    '" aria-pressed="'+running+'" aria-label="Start '+esc(a.name)+'">'+
    '<i class="t1-dot" style="--c:'+kSafeColour(a.color)+'" aria-hidden="true"></i><span>'+esc(a.name)+'</span></button>';
}
function t1Timer(now,pm){
  const c=CUR;
  if(!c){
    const last=lastStudy(),recent=last&&last.e&&last.e<=now&&now-last.e<3*HOUR;
    const pending=UI.lastRate&&UI.lastRate.id&&UI.lastRate.day;
    if(pending&&(!UI.t1RateShown||UI.t1RateShown.id!==UI.lastRate.id)){
      UI.t1RateShown={id:UI.lastRate.id,until:now+60*1000};
      if(typeof setTimeout==='function')setTimeout(()=>{if(UI.t1RateShown&&Date.now()>=UI.t1RateShown.until){UI.lastRate=null;UI.t1RateShown=null;render();}},60050);
    }
    const asking=pending&&UI.t1RateShown&&UI.t1RateShown.until>now;
    const rating=asking?'<div class="t1-rating"><span>Focus?</span>'+[
      [1,'Scattered'],[2,'Okay'],[3,'Deep']].map(([value,label])=>
      kIconBtn('rate'+value,label,'data-act="t1-rate" data-v="'+value+'"')).join('')+'</div>':'';
    const done=UI.t1RateDoneUntil>now?'<div class="t1-rated" role="status">'+icon('check')+'</div>':'';
    return '<section class="t1-timer t1-idle" aria-label="Timer">'+
      (rating||done||'<div class="t1-idle-label">Not tracking</div>')+
      (!rating&&recent?kBtn('Resume '+act(last.a).name,'data-act="t1-resume-study" data-id="'+esc(last.a)+'"',{kind:'primary',icon:'start'}):'')+'</section>';
  }
  const a=act(c.activity),start=parseT(c.start),ps=pomoState(now),g=guardInfo(now);
  const isBreak=a.role==='break',isDue=!!(ps&&ps.left<=0),focusDue=!!(ps&&ps.phase==='focus'&&isDue);
  const time=ps?'<div class="t1-clock'+(isDue?' t1-clock-due':'')+'" data-tk="cd" data-to="'+ps.end+'">'+fmtClock(ps.left)+'</div>':
    '<div class="t1-clock" data-tk="elh" data-s="'+start+'">'+fmtClock(now-start,true)+'</div>';
  const progress=ps?'<div class="t1-progress" role="progressbar" aria-label="Pomodoro progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+
    Math.round(clamp((now-ps.ps)/ps.len,0,1)*100)+'"><span data-tk="bar" data-s="'+ps.ps+'" data-len="'+ps.len+'" style="width:'+
    (100*clamp((now-ps.ps)/ps.len,0,1))+'%"></span></div>':'';
  let status='';
  if(g)status='<span class="t1-warning">'+icon('warn')+' Running '+fmtDur(g.ran)+'</span>';
  else if(focusDue)status='<span class="t1-accent">'+icon('pomodoro')+' Break time</span>';
  else if(ps&&ps.phase==='break')status=isDue?"Break's over":'Back to '+esc(c.ret&&c.ret.activity?act(c.ret.activity).name:'study');
  else if(ps)status='Focus '+ps.cycle+(ps.every?' of '+ps.every:'')+' · '+fmtDur(Math.max(0,ps.left))+' left';
  const block=pm&&c.block&&pm.rows?pm.rows.find(r=>r.id===c.block):null;
  const note=(c.note||'').trim()||(block&&block.title)||'';
  const extra=note?'<div class="t1-note">'+esc(note)+'</div>':'';
  let buttons='';
  if(g)buttons=kBtn('Still going','data-act="guard-keep"',{kind:'primary'})+kBtn('Fix stop','data-act="t1-fixstop"',{kind:'tonal'});
  else if(isBreak){
    buttons=kBtn('Resume','data-act="back"',{kind:'primary',icon:'start'})+kBtn('Stop','data-act="stop"',{kind:'tonal',icon:'stop'});
  }else if(focusDue)buttons=kBtn('Break','data-act="break"',{kind:'primary',icon:'break'})+kBtn('Stop','data-act="stop"',{kind:'tonal',icon:'stop'});
  else buttons=kBtn('Stop','data-act="stop"',{kind:'primary',icon:'stop'})+kBtn('Break','data-act="break"',{kind:'tonal',icon:'break'});
  return '<section class="t1-timer" aria-label="Timer">'+
    '<header class="t1-timer-head"><span class="t1-current"><i class="t1-dot" style="--c:'+kSafeColour(a.color)+'"></i>'+esc(a.name)+'</span>'+
    '<span class="t1-timer-tools">'+kIconBtn('edit','Edit running entry','data-act="edit-running"')+
    kIconBtn('focus','Focus mode','data-act="desk"')+'</span></header>'+
    extra+time+(status?'<p class="t1-status">'+status+'</p>':'')+progress+
    '<div class="t1-actions">'+buttons+'</div></section>';
}
function t1Notice(){
  if(!CUR||act(CUR.activity).kind!=='study')return '';
  const active=noticeOpen(),returning=UI.back&&UI.back.until>Date.now();
  const chips=active?'<div class="t1-drift">'+[1,5,15].map(m=>
    '<button type="button" class="t1-drift-btn" data-act="notice-drift" data-m="'+m+'">'+m+'m</button>').join('')+
    kIconBtn('bookmark','Park a thought','data-act="t1-park"')+'</div>':'';
  return '<div class="t1-notice">'+kBtn('Noticed','data-act="notice"',{kind:'text',icon:'urge'})+chips+
    (returning?'<span class="t1-back">Back to: '+esc(UI.back.text)+'</span>':'')+'</div>';
}
function t1Next(pm,k,now){
  const rows=pm&&pm.rows?pm.rows.filter(r=>r.remaining>0&&!['done','skipped','moved'].includes(r.st)):[];
  rows.sort((a,b)=>(a.pieces&&a.pieces.length?a.pieces[0][0]:Infinity)-
    (b.pieces&&b.pieces.length?b.pieces[0][0]:Infinity));
  const next=rows.slice(0,3).map(r=>{
    const a=act(r.activity),at=r.pieces&&r.pieces.length?r.pieces[0][0]:null;
    return '<button type="button" class="t1-next-row" data-act="t1-plan-focus" data-k="'+esc(k)+'" data-id="'+esc(r.id)+'">'+
      '<span class="t1-next-main"><i class="t1-dot" style="--c:'+kSafeColour(a.color)+'"></i><span>'+
      esc(a.name)+(r.title?' · '+esc(r.title):'')+'</span></span>'+
      (r.at?icon('pin'):'')+'<time>'+esc(at!=null?fmtT(at):'')+'</time></button>';
  }).join('');
  const over=pm&&pm.over>0?'<div class="t1-over"><span>'+icon('warn')+' '+fmtDur(pm.over)+" won't fit"+'</span>'+
    kBtn('Fix','data-act="t1-fit"',{kind:'text'})+'</div>':'';
  return next||over?'<section class="t1-next">'+(next?'<h2 class="t1-label">Next</h2>'+next:'')+over+'</section>':'';
}
function t1Today(){
  const now=Date.now(),k=todayKey();
  const agg=aggregate(ENTRIES,now,k,k)[k]||{study:0,acts:{}};
  const head='<header class="t1-day-head"><span>'+esc(stampText(k))+'</span><span class="f1-head-actions">'+
    '<button type="button" class="t1-log-link" data-act="t1-log" aria-label="Open today log">'+
    esc(fmtDur(agg.study))+icon('open')+'</button>'+kIconBtn('add','Quick add','data-act="l9-open"')+kIconBtn('settings','Settings','data-act="open-settings"')+'</span></header>';
  if(!S.loaded.activities)return '<div class="t1-today">'+head+kEmpty('Opening…')+'</div>';
  if(w1NeedsSetup())return w1FirstRun();
  const pm=planModelFor(k,now);
  const picks=t1Picks(),grid=!CUR?ACTS.filter(a=>!a.archived&&a.kind==='study').map(a=>t1ActivityButton(a,'t1-tile')).join(''):'';
  const chips=picks.filter(a=>CUR?a.id!==CUR.activity:a.kind!=='study').map(a=>t1ActivityButton(a,'t1-chip')).join('');
  const more=kIconBtn('more','All activities','data-act="t1-activities"');
  const parked=CUR&&act(CUR.activity).role==='break'?parkedItems(k):[];
  return '<div class="t1-today">'+head+vSyncLine()+t1Timer(now,pm)+
    (CUR?t1Notice():'')+
    (grid?'<div class="t1-tiles">'+grid+'</div>':'')+
    t1Next(pm,k,now)+
    (parked.length?'<button type="button" class="t1-parked" data-act="t1-parked">'+icon('bookmark')+
      parked.length+' parked '+icon('open')+'</button>':'')+
    '<div class="t1-switch">'+chips+more+'</div></div>';
}
Object.assign(ACT,{
  't1-log'(){pushPage('log',{k:todayKey()});},
  't1-resume-study'(el){const id=el.getAttribute('data-id');if(ACTMAP[id]&&!ACTMAP[id].archived)startActivity(id);},
  't1-rate'(el){
    const rate=UI.lastRate,value=Number(el.getAttribute('data-v'));
    if(!rate||![1,2,3].includes(value)||!rate.day||!rate.id)return;
    const w=W();w.day(rate.day,{[rate.id]:{focus:value}});
    UI.lastRate=null;UI.t1RateShown=null;UI.t1RateDoneUntil=Date.now()+1000;
    commit(null,w,{undo:false});
    if(typeof setTimeout==='function')setTimeout(()=>{UI.t1RateDoneUntil=0;render();},1050);
  },
  't1-plan-focus'(el){planFocus(el.getAttribute('data-k'),el.getAttribute('data-id'));},
  't1-fit'(){openSheet({type:'fit',k:todayKey()});},
  't1-activities'(){openSheet({type:'activities'});},
  't1-park'(){openSheet({type:'park'});},
  't1-parked'(){openSheet({type:'parked',k:todayKey()});},
  't1-fixstop'(){
    if(!CUR)return;
    const start=parseT(CUR.start),now=Date.now();
    UI.guardTime=msToHm(Math.min(now,start+60*MIN));
    openSheet({type:'fixstop'});
  }
});

VIEWS.today = t1Today;
