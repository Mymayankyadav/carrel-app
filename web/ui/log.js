/* ---------- views: log ---------- */
function dayEntries(k, now) { const ds = dayStartMs(k), de = dayEndMs(k); return ENTRIES.filter(en => en.s < de && entryEnd(en, now) > ds); }
function gapsOf(ents, now, ds, de, isToday) {
  const out = [];
  let prevEnd = null;
  for (const en of ents) {
    const s = Math.max(en.s, ds);
    if (prevEnd != null && s - prevEnd >= 3 * MIN) out.push([prevEnd, s]);
    prevEnd = Math.max(prevEnd || 0, Math.min(entryEnd(en, now), de));
  }
  if (isToday && prevEnd != null && !CUR && now - prevEnd >= 3 * MIN && now < de) out.push([prevEnd, now]);
  return out;
}
function vLog(k, now, pm) {
  const isToday = k === todayKey();
  const ents = dayEntries(k, now);
  const ds = dayStartMs(k), de = dayEndMs(k);
  const head = `<div class="sec-head"><h2 id="log-h">Log</h2><div class="sec-tools"><div class="seg" role="group" aria-label="Log layout"><button type="button" class="${UI.logMode === 'timeline' ? 'on' : ''}" data-act="logmode" data-m="timeline" aria-pressed="${UI.logMode === 'timeline'}">Timeline</button><button type="button" class="${UI.logMode === 'list' ? 'on' : ''}" data-act="logmode" data-m="list" aria-pressed="${UI.logMode === 'list'}">List</button></div><button type="button" class="btn sm" data-act="add-entry">${icon('plus')}Add</button></div></div>`;
  let body;
  if (!ents.length && !(isToday && pm && pm.rows.some(r => r.pieces.length))) {
    body = `<div class="empty"><p>${isToday ? 'Nothing logged yet today. Start a timer above, or add anything you did before opening Carrel.' : 'Nothing was logged on this day. Add entries for anything you remember.'}</p></div>`;
  } else if (UI.logMode === 'list') body = vList(ents, now, ds, de, isToday);
  else body = vTimeline(k, ents, now, ds, de, isToday, pm);
  return `<section class="sec" aria-labelledby="log-h">${head}${body}</section>`;
}
function vTimeline(k, ents, now, ds, de, isToday, pm) {
  const PX = 1.1;
  // Overnight sleep gets a compact, editable summary instead of consuming
  // several screens of hour-grid space. Don't collapse a running sleep or
  // sleep that overlaps other logged activities.
  const first = ents.slice().sort((a, b) => a.s - b.s)[0];
  const sleepEnd = first ? entryEnd(first, now) : 0;
  const leadSleep = first && !first.running && act(first.a).role === 'sleep' &&
    sleepEnd > ds && !ents.some(en => en !== first && en.s < sleepEnd &&
      entryEnd(en, now) > Math.max(first.s, ds)) ? first : null;
  const sleepBand = leadSleep
    ? `<button type="button" class="tl-sleep-summary" style="--c:${act(leadSleep.a).color}" data-act="edit-entry" data-id="${esc(leadSleep.id)}" data-key="${esc(leadSleep.id)}" aria-label="Edit ${esc(act(leadSleep.a).name)}, ${fmtT(leadSleep.s)} to ${fmtT(sleepEnd)}"><span>${esc(act(leadSleep.a).name)}</span><span>${fmtT(leadSleep.s)}–${fmtT(sleepEnd)} · ${fmtDur(sleepEnd - leadSleep.s)}</span></button>`
    : '';
  let lo = Infinity, hi = -Infinity;
  for (const en of ents) { lo = Math.min(lo, Math.max(en.s, ds)); hi = Math.max(hi, Math.min(entryEnd(en, now), de)); }
  const pieces = [];
  if (pm && (pm.isToday || pm.isFuture)) pm.rows.forEach(r => r.pieces.forEach(p => pieces.push({ r, a: p[0], b: p[1] })));
  if (k >= todayKey()) busyOf(k).forEach(z => { if (!isToday || z.e > now) pieces.push({ busy: z, a: z.s, b: z.e }); });
  pieces.forEach(p => { lo = Math.min(lo, p.a); hi = Math.max(hi, p.b); });
  if (isToday) { lo = Math.min(lo, now - 30 * MIN); hi = Math.max(hi, now + 30 * MIN); }
  if (pm && (pm.isToday || pm.isFuture) && pm.rows.length) hi = Math.max(hi, Math.min(pm.endMs, de));
  if (leadSleep) lo = Math.max(lo, floorLocal(sleepEnd, HOUR));
  lo = Math.max(ds, floorLocal(lo, HOUR));
  hi = Math.min(de, ceilLocal(hi, HOUR));
  if (hi - lo < 5 * HOUR) hi = Math.min(de, lo + 5 * HOUR);
  if (hi - lo < 5 * HOUR) lo = Math.max(ds, hi - 5 * HOUR);
  const y = t => ((clamp(t, lo, hi) - lo) / MIN * PX);
  const H = Math.round(y(hi));
  const axis = [], grid = [];
  for (let t = ceilLocal(lo, HOUR); t <= hi; t += HOUR) {
    const d = new Date(t);
    axis.push(`<span style="top:${y(t).toFixed(1)}px">${fmtHourS(d.getHours())}${H12 ? '' : ':00'}</span>`);
    grid.push(`<i class="tl-grid" style="top:${y(t).toFixed(1)}px"></i>`);
  }
  const blocks = ents.map(en => {
    if (en === leadSleep) return '';
    const a = act(en.a), s = Math.max(en.s, lo), e = Math.min(entryEnd(en, now), hi);
    if (e <= s) return '';
    const top = y(s), h = Math.max(6, y(e) - top - 1);
    const cls = `${en.running ? 'run' : ''} ${h < 17 ? 'tiny' : ''}`;
    const attrs = en.running ? 'data-act="edit-running"' : `data-act="edit-entry" data-id="${esc(en.id)}"`;
    return `<button type="button" class="tl-e ${cls}" style="top:${top.toFixed(1)}px;height:${h.toFixed(1)}px;--c:${a.color}" ${attrs} data-key="${esc(en.id)}" aria-label="${esc(a.name)}, ${fmtT(en.s)} to ${en.running ? 'now' : fmtT(en.e)}"><span class="n">${esc(a.name)}${en.note && h >= 34 ? ' · <span class="muted">' + esc(en.note) + '</span>' : ''}</span>${h >= 30 ? `<span class="d">${fmtT(en.s)}–${en.running ? 'now' : fmtT(en.e)} · ${fmtDur(entryEnd(en, now) - en.s)}</span>` : ''}</button>`;
  }).join('');
  const gaps = gapsOf(ents, now, ds, de, isToday).filter(([a, b]) => b > lo && a < hi).map(([a, b]) => {
    const top = y(Math.max(a, lo)), h = Math.max(10, y(Math.min(b, hi)) - top - 2);
    return `<button type="button" class="tl-gap" style="top:${(top + 1).toFixed(1)}px;height:${h.toFixed(1)}px" data-act="fill" data-s="${a}" data-e="${b === now ? 'now' : b}" aria-label="Untracked ${fmtDur(b - a)}, ${fmtT(a)} to ${fmtT(b)}">${h >= 16 ? `<span>+ ${fmtDur(b - a)}</span>` : ''}</button>`;
  }).join('');
  const plan = pieces.filter(p => p.b > lo && p.a < hi).map(p => {
    if (p.busy) { const top = y(p.a), h = Math.max(8, y(p.b) - top - 2); return `<div class="tl-p busy" style="top:${top.toFixed(1)}px;height:${h.toFixed(1)}px">${h >= 16 ? esc(p.busy.title) : ''}</div>`; }
    const a = act(p.r.activity), top = y(p.a), h = Math.max(8, y(p.b) - top - 2);
    return `<div class="tl-p ${p.r.over > 0 && p.b > pm.endMs ? 'over' : ''}" style="top:${top.toFixed(1)}px;height:${h.toFixed(1)}px;--c:${a.color}">${h >= 16 ? esc(a.name) : ''}</div>`;
  }).join('');
  const nowLine = isToday && now >= lo && now <= hi ? `<i class="tl-now" style="top:${y(now).toFixed(1)}px"></i>` : '';
  const endLine = pm && (pm.isToday || pm.isFuture) && pm.rows.length && pm.endMs > lo && pm.endMs < hi ? `<div class="tl-end" style="top:${y(pm.endMs).toFixed(1)}px"><span>plan ends</span></div>` : '';
  return sleepBand + `<div class="tl-heads"><span></span><span>Logged</span><span>Plan ahead</span></div>
    <div class="tl" style="height:${H}px">${grid.join('')}<div class="tl-axis">${axis.join('')}</div><div class="tl-lane">${gaps}${blocks}</div><div class="tl-lane plan">${plan}</div>${endLine}${nowLine}</div>`;
}
function vList(ents, now, ds, de, isToday) {
  const gaps = gapsOf(ents, now, ds, de, isToday);
  const items = [];
  ents.forEach(en => items.push({ t: en.s, en }));
  gaps.forEach(g => items.push({ t: g[0] + 1, g }));
  items.sort((a, b) => a.t - b.t);
  return `<ol class="ll">${items.map(it => {
    if (it.g) { const [a, b] = it.g; return `<li><button type="button" class="ll-gap" data-act="fill" data-s="${a}" data-e="${b === now ? 'now' : b}"><span>Untracked <span class="num">${fmtT(a)}–${fmtT(b)}</span></span><b>+ ${fmtDur(b - a)}</b></button></li>`; }
    const en = it.en, a = act(en.a);
    const attrs = en.running ? 'data-act="edit-running"' : `data-act="edit-entry" data-id="${esc(en.id)}"`;
    const fd = en.focus ? `<span class="focusdots" aria-label="Focus ${en.focus} of 3">${[1, 2, 3].map(n => `<i class="${n <= en.focus ? 'on' : ''}"></i>`).join('')}</span>` : '';
    return `<li data-key="${esc(en.id)}"><button type="button" class="ll-row" style="--c:${a.color}" ${attrs}><span class="ll-time">${fmtT(en.s)}–${en.running ? 'now' : fmtT(en.e)}</span><span class="ll-body"><span class="ll-name">${esc(a.name)}${fd}</span>${en.note ? `<span class="ll-note">${esc(en.note)}</span>` : ''}</span><span class="ll-dur" ${en.running ? `data-tk="dur" data-s="${en.s}"` : ''}>${fmtDur(entryEnd(en, now) - en.s)}</span></button></li>`;
  }).join('')}</ol>`;
}
function ribbonSegs(ents, now, ds, de) {
  const span = de - ds;
  return ents.map(en => {
    const s = Math.max(en.s, ds), e = Math.min(entryEnd(en, now), de);
    if (e <= s) return '';
    return `<i style="left:${((s - ds) / span * 100).toFixed(3)}%;width:${Math.max(0.25, (e - s) / span * 100).toFixed(3)}%;--c:${act(en.a).color}" title="${esc(act(en.a).name)} ${fmtT(en.s)}–${fmtT(entryEnd(en, now))}"></i>`;
  }).join('');
}
function futMask(ds, de, now) {
  if (now >= de) return '';
  const f = Math.max(0, (now - ds) / (de - ds) * 100);
  return `<i class="fut" style="left:${f.toFixed(3)}%;width:${(100 - f).toFixed(3)}%"></i>`;
}
function ribbonAxis(ds) {
  const ticks = [0, 6, 12, 18, 24];
  return ticks.map(h => `<span style="left:${(h / 24 * 100).toFixed(2)}%">${fmtHourS(new Date(ds + h * HOUR).getHours())}</span>`).join('');
}
function vBreakdown(k, now, agg, pomos) {
  const ents = dayEntries(k, now), ds = dayStartMs(k), de = dayEndMs(k);
  const sess = studySessions(ents, now, ds, de);
  const longest = sess.reduce((m, x) => Math.max(m, x.ms), 0);
  let sw = 0;
  for (let i = 1; i < ents.length; i++) if (ents[i].a !== ents[i - 1].a) sw++;
  const firstStudy = ents.find(en => isStudyId(en.a));
  const goal = (+CFG.dailyGoal || 0) * MIN;
  const rows = Object.entries(agg.acts).sort((a, b) => b[1] - a[1]);
  const max = rows.length ? rows[0][1] : 1;
  const span = Math.min(de, now) - ds;
  return `<section class="sec" aria-labelledby="brk-h"><div class="sec-head"><h2 id="brk-h">Where the day went</h2></div>
    <div><div class="ribbon" role="img" aria-label="Day from ${fmtT(ds)} to ${fmtT(de)}, logged time in color">${ribbonSegs(ents, now, ds, de)}${futMask(ds, de, now)}</div><div class="rib-ax">${ribbonAxis(ds)}</div></div>
    <dl class="kpis">
      <div><dt>Studied</dt><dd class="num">${fmtDur(agg.study)}${goal ? ` <small>/ ${fmtDur(goal)}</small>` : ''}</dd></div>
      <div><dt>Best stretch</dt><dd class="num">${longest ? fmtDur(longest) : '–'}</dd></div>
      <div><dt>Pomodoros</dt><dd class="num">${pomos || '–'}</dd></div>
      <div><dt>First study</dt><dd class="num">${firstStudy ? fmtT(Math.max(firstStudy.s, ds)) : '–'}</dd></div>
      <div><dt>Switches</dt><dd class="num">${sw || '–'}</dd></div>
      <div><dt>Untracked</dt><dd class="num">${span > 0 ? fmtDur(Math.max(0, span - agg.all)) : '–'}</dd></div>
    </dl>
    ${rows.length ? `<div class="abars">${rows.map(([id, ms]) => { const a = act(id); return `<div class="abar" style="--c:${a.color}"><span class="an"><i class="dot"></i><span>${esc(a.name)}</span></span><span class="tr"><i style="width:${(ms / max * 100).toFixed(1)}%"></i></span><span class="v">${fmtDur(ms)}</span></div>`; }).join('')}</div>` : ''}
  </section>`;
}

/* T3 — the standalone Today log. Legacy vLog/vTimeline remain for T1 until it migrates. */
function t3LogDate(){
  const stack=UI.pages||[],top=stack[stack.length-1];
  return top&&top.id==='log'&&top.params&&top.params.k||todayKey();
}
function t3LogPage(params){
  const k=params&&params.k||todayKey(),now=Date.now();
  ensureRange(k,k);
  const ds=dayStartMs(k),de=dayEndMs(k);
  const list=dayEntries(k,now).slice().sort((a,b)=>b.s-a.s);
  const gaps=gapsOf(list.slice().sort((a,b)=>a.s-b.s),now,ds,de,k===todayKey())
    .filter(([a,b])=>b-a>=5*MIN);
  const all=list.map(en=>({s:Math.max(ds,en.s),en})).concat(gaps.map(([s,e])=>({s,gap:[s,e]})))
    .sort((a,b)=>b.s-a.s);
  const agg=aggregate(ENTRIES,now,k,k)[k]||{study:0,all:0};
  const summary=fmtDur(agg.study)+' studied · '+fmtDur(agg.all)+' logged';
  const rows=all.map(item=>{
    if(item.gap){
      const [s,e]=item.gap;
      return '<button type="button" class="t3-log-row t3-gap" data-act="t3-gap" data-s="'+s+'" data-e="'+e+
        '" aria-label="Add untracked time '+esc(fmtT(s))+' to '+esc(fmtT(e))+'">'+
        '<span class="t3-time">'+esc(fmtT(s))+'</span>'+
        '<span class="t3-entry-label">Untracked</span>'+
        '<span class="t3-duration">'+esc(fmtDur(e-s))+icon('add')+'</span></button>';
    }
    const en=item.en,a=act(en.a);
    const end=Math.min(de,entryEnd(en,now)),start=Math.max(ds,en.s);
    return '<button type="button" class="t3-log-row" data-act="t3-entry" data-id="'+esc(en.id)+
      '" aria-label="Edit '+esc(a.name)+'">'+
      '<span class="t3-time">'+esc(fmtT(start))+'</span>'+
      '<span class="t3-entry-main"><span class="t3-entry-label"><i class="t3-dot" style="--c:'+kSafeColour(a.color)+
      '"></i><span>'+esc(a.name)+'</span></span>'+
      (en.note?'<span class="t3-entry-note">'+esc(en.note)+'</span>':'')+'</span>'+
      '<span class="t3-duration"'+(en.running?' data-tk="dur" data-s="'+en.s+'"':'')+'>'+
      (en.running?'Now':esc(fmtDur(Math.max(0,end-start))))+'</span></button>';
  }).join('');
  return '<div class="t3-log">'+
    '<div class="t3-log-summary">'+esc(summary)+'</div>'+
    (rows||kEmpty('Nothing logged'))+'</div>';
}
PAGES.log={
  title:params=>shortDay(params&&params.k||todayKey()),
  render:t3LogPage,
  actions:()=>kIconBtn('prev','Previous day','data-act="t3-prev"')+
    kIconBtn('next','Next day','data-act="t3-next"')+
    kIconBtn('add','Add entry','data-act="t3-add"')
};
function t3EntryNudge(bind,hm,name){
  return '<div class="t3-time-field">'+
    kIconBtn('minus',name+' earlier','data-act="t3-nudge" data-f="'+name.toLowerCase()+'" data-d="-5"')+
    '<input class="k-input" type="time" aria-label="'+name+' time" data-bind="'+esc(bind)+'" value="'+esc(hm||'')+'">'+
    kIconBtn('add',name+' later','data-act="t3-nudge" data-f="'+name.toLowerCase()+'" data-d="5"')+
    '</div>';
}
function sEntry(sh){
  const d=sh.d||{},running=sh.mode==='running',t=sheetTimes(sh);
  const title=running?'Running':sh.mode==='edit'?'Edit entry':'New entry';
  const actions=(sh.mode==='edit'?kIconBtn('split','Split','data-act="split-open"'):'')+
    (sh.mode!=='add'?kIconBtn('delete',running?'Discard':'Delete','data-act="t3-delete"'):'');
  const ov=t?overlapsFor(sh,t.s,t.e):[];
  const overlap=ov.length?(()=>{
    const first=ov[0],start=Math.max(first.s,t.s),end=Math.min(entryEnd(first,Date.now()),t.e);
    return kField('Overlaps '+act(first.a).name+' by '+fmtDur(Math.max(0,end-start)),
      kSwitch({bind:'sheet.trim',on:!!sh.trim,label:'Trim overlapping time'}));
  })():'';
  const focus=!running&&isStudyId(d.activity)?'<div class="t3-focus" role="group" aria-label="Focus">'+
    [[1,'Scattered'],[2,'Okay'],[3,'Deep']].map(([n,label])=>
      '<button type="button" class="t3-focus-choice" data-act="e-focus" data-v="'+n+'" aria-label="'+label+
      '" title="'+label+'" aria-pressed="'+(d.focus===n)+'">'+icon('rate'+n)+'</button>').join('')+
    '</div>':'';
  const more=kCollapse('t3-entry-more','More',
    kField('Note',kArea({bind:'sheet.d.note',value:d.note||'',rows:2,placeholder:'Note'}))+
    (focus?kField('Focus',focus):''));
  const dur=t?'<div class="t3-entry-duration">'+esc(fmtDur(Math.max(0,t.e-t.s)))+'</div>':'';
  return kSheetHead(title,actions)+
    '<div class="k-sheet-body t3-sheet">'+
    kField('Activity',kActPick({bind:'sheet.d.activity',id:d.activity,study:true,life:true,none:false}))+
    kField('Start',t3EntryNudge('sheet.d.start',d.start,'Start'))+
    kField('End',running?'<span class="t3-now">Now</span>':t3EntryNudge('sheet.d.end',d.end,'End'))+
    (sh.mode==='add'?kField('Date',kDate({bind:'sheet.d.date',key:d.date})):'')+
    dur+overlap+more+(sh.err?'<div class="t3-error" role="alert">'+esc(sh.err)+'</div>':'')+
    '</div>'+kSheetFoot(kBtn('Save','data-act="entry-save"',{kind:'primary'}));
}
function sSplit(sh){
  const en=ENTRIES.find(e=>e.id===sh.id),desc=en?
    act(en.a).name+' · '+fmtT(en.s)+'–'+fmtT(en.e):'';
  return kSheetHead('Split')+
    '<div class="k-sheet-body t3-sheet">'+
    (desc?'<div class="t3-split-summary">'+esc(desc)+'</div>':'')+
    kField('Split at',t3EntryNudge('sheet.at',sh.at,'Split'))+
    kField('Second part',kActPick({bind:'sheet.activity',id:sh.activity,study:true,life:true,none:false}))+
    (sh.err?'<div class="t3-error" role="alert">'+esc(sh.err)+'</div>':'')+
    '</div>'+kSheetFoot(kBtn('Split','data-act="split-save"',{kind:'primary'}));
}
SHEETS.entry=sEntry;
SHEETS.split=sSplit;
Object.assign(ACT,{
  't3-prev'(){
    const stack=UI.pages||[],top=stack[stack.length-1];
    if(top&&top.id==='log'){top.params={...(top.params||{}),k:addDaysKey(t3LogDate(),-1)};render();}
  },
  't3-next'(){
    const stack=UI.pages||[],top=stack[stack.length-1];
    if(top&&top.id==='log'){top.params={...(top.params||{}),k:addDaysKey(t3LogDate(),1)};render();}
  },
  't3-add'(){
    const k=t3LogDate();
    if(k===todayKey()){openEntrySheet('add');return;}
    const s=hmOnDay(k,'09:00');
    openEntrySheet('add',{s,e:s+60*MIN});
  },
  't3-entry'(el){
    const id=el.getAttribute('data-id'),en=ENTRIES.find(e=>e.id===id);
    if(!en)return;
    openEntrySheet(en.running?'running':'edit',en.running?undefined:{id});
  },
  't3-gap'(el){
    const s=Number(el.getAttribute('data-s')),e=Number(el.getAttribute('data-e'));
    if(Number.isFinite(s)&&Number.isFinite(e)&&e>s)openEntrySheet('add',{s,e});
  },
  't3-nudge'(el){
    const sh=UI.sheet;
    if(!sh)return;
    const key=el.getAttribute('data-f'),delta=Number(el.getAttribute('data-d'));
    if(!Number.isFinite(delta)||!['start','end','split'].includes(key))return;
    const d=key==='split'?sh:sh.d,field=key==='split'?'at':key;
    if(!d||!/^\d{1,2}:\d{2}/.test(d[field]||''))return;
    const date=key==='split'?(ENTRIES.find(e=>e.id===sh.id)||{}).s:hmOnDay(d.date,d[field]);
    const base=key==='split'?date!=null?hmOnDay(dayKeyOf(date),d.at):null:date;
    if(base==null)return;
    const shifted=base+delta*MIN;
    d[field]=msToHm(shifted);
    if(key==='start'&&dayKeyOf(shifted)!==d.date)d.date=dayKeyOf(shifted);
    renderSheet();
  },
  't3-delete'(){
    const sh=UI.sheet;
    if(!sh||sh.type!=='entry'||sh.mode==='add')return;
    sh.armed=true;
    deleteEntrySheet(); // preserves existing one-transaction, Undo-capable delete
  }
});
