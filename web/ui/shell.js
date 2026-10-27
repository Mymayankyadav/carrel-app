/* ---------- views: shell ---------- */
/* R0a: global top bar removed; each screen now owns its header. */
function vNav() { return kNav(UI.view); }
function vNotices() {
  if (S.conn === 'none') return `<div class="banner" style="margin-bottom:22px"><h3>Sign in to Carrel</h3><p>Your timers and log are saved to your own account so they follow you across devices.</p><div class="row"><button type="button" class="btn lamp" data-act="signin">Sign in with Google</button></div></div>`;
  if (!S.owner) return `<div class="banner" style="margin-bottom:22px"><h3>This tracker is private</h3><p>Only the person who owns it can see or change its log.</p></div>`;
  if (S.conn === 'readonly') return `<div class="banner warn" style="margin-bottom:22px"><h3>View only</h3><p>Can't save right now. Carrel will retry automatically.</p><div class="row"><button type="button" class="btn sm" data-act="a1-reconnect">Try again</button></div></div>`;
  return '';
}
function canonicalView(v) {
  return ({calendar:'plan',week:'stats',patterns:'stats'})[v] || v || 'today';
}
function vSyncLine() {
  const status = syncState(), count = S.pending.length;
  if (status === 'offline' && count) return '<div class="r0-sync" role="status">'+icon('offline')+'Offline · '+count+' waiting</div>';
  if (status === 'readonly') return '<div class="r0-sync error" role="alert">'+icon('warn')+"Can't save"+kBtn('Retry','data-act="a1-reconnect"',{kind:'text'})+'</div>';
  return '';
}
function vMain() {
  const stack=UI.pages||[];
  if (S.conn === 'none' || !S.owner) return '<div class="k-screen">'+(VIEWS.welcome ? VIEWS.welcome() : vNotices())+'</div>';
  if (stack.length) {
    const top=stack[stack.length-1], page=PAGES[top.id];
    if(!page){console.warn('Unknown page:',top.id);return '';}
    const params=top.params||{};
    return '<div class="k-screen k-page">'+kPageHead(typeof page.title==='function'?page.title(params):page.title||top.id,typeof page.actions==='function'?page.actions(params):'')+
      (typeof page.render==='function'?page.render(params):'')+'</div>';
  }
  const view=canonicalView(UI.view), f=VIEWS[view];
  if(!f){console.warn('Unknown view:',view);return '';}
  const wide=view==='plan'?' wide':'';
  return '<div class="k-screen'+wide+'">'+(view==='today'?vSyncLine():'')+f()+'</div>';
}
function vSheet() {
  const sh=UI.sheet;
  if(!sh)return '';
  const f=SHEETS[sh.type];
  if(!f){console.warn('Unknown sheet:',sh.type);return '';}
  const body=f(sh);
  return '<div class="scrim k-sheet-bg" data-act="sheet-close"><div class="sheet k-sheet'+(sh.type==='setup'?' wide':'')+
    '" role="dialog" aria-modal="true" aria-labelledby="sh-title" data-act="noop">'+body+'</div></div>';
}
function actPick(sel, bind) {
  const list = ACTS.filter(a => !a.archived || a.id === sel);
  return `<div class="pick" role="radiogroup" aria-label="Activity">${list.map(a => `<button type="button" role="radio" aria-checked="${a.id === sel}" class="${a.id === sel ? 'on' : ''}" style="--c:${a.color}" data-act="pick" data-bind-to="${bind}" data-v="${esc(a.id)}"><i class="dot"></i>${esc(a.name)}</button>`).join('')}</div>`;
}
/* ---------- toast ---------- */
let toastT = 0;
function toast(msg, o) {
  o=o||{};
  UI.lastRate=o.rate||null;
  UI.toast={msg,undo:!!o.undo,rate:o.rate||null,action:o.undo?null:(o.action||null)};
  renderToast();
  clearTimeout(toastT);
  if(!o.persist) toastT=setTimeout(()=>{UI.toast=null;renderToast();},o.undo?8000:4000);
}
function renderToast() {
  const el=document.getElementById('toast');
  if(!el)return;
  const t=UI.toast;
  morphInto(el,t?'<div class="k-toast" role="status">'+esc(t.msg)+
    (t.undo?kBtn('Undo','data-act="undo"',{kind:'text'}):'')+
    (t.action?kBtn(t.action.label,'data-act="'+esc(t.action.act)+'"',{kind:'text'}):'')+'</div>':'');
}

/* ---------- rendering: DOM morphing keeps focus and scroll while live data arrives ---------- */
function keyOf(n) { return n.nodeType === 1 ? n.getAttribute('data-key') : null; }
function syncAttrs(from, to) {
  const ta = to.attributes, fa = from.attributes;
  for (let i = fa.length - 1; i >= 0; i--) { const n = fa[i].name; if (!to.hasAttribute(n)) from.removeAttribute(n); }
  for (let i = 0; i < ta.length; i++) { const { name, value } = ta[i]; if (from.getAttribute(name) !== value) from.setAttribute(name, value); }
}
function morph(from, to) {
  if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) { from.replaceWith(to); return; }
  if (from.nodeType === 3 || from.nodeType === 8) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return; }
  syncAttrs(from, to);
  const tag = from.nodeName;
  const focused = document.activeElement === from;
  if (tag === 'INPUT') {
    if (from.type === 'checkbox' || from.type === 'radio') from.checked = to.hasAttribute('checked');
    else if (!focused && from.value !== to.getAttribute('value')) from.value = to.getAttribute('value') || '';
    return;
  }
  if (tag === 'TEXTAREA') { if (!focused && from.value !== to.textContent) from.value = to.textContent; return; }
  morphChildren(from, to);
  if (tag === 'SELECT' && !focused && to.hasAttribute('data-value')) { const v = to.getAttribute('data-value'); if (from.value !== v) from.value = v; }
}
function morphChildren(parent, toParent) {
  const newKids = Array.from(toParent.childNodes);
  const keyed = new Map();
  parent.childNodes.forEach(n => { const k = keyOf(n); if (k) keyed.set(k, n); });
  let i = 0;
  for (const nk of newKids) {
    const k = keyOf(nk), cur = parent.childNodes[i] || null;
    let match = null;
    if (k) { match = keyed.get(k) || null; if (match) keyed.delete(k); }
    else if (cur && !keyOf(cur) && cur.nodeName === nk.nodeName) match = cur;
    if (match) {
      if (match !== cur) parent.insertBefore(match, cur);
      morph(match, nk);
    } else parent.insertBefore(nk, cur);
    i++;
  }
  while (parent.childNodes.length > newKids.length) parent.removeChild(parent.lastChild);
}
function morphInto(el, html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  morphChildren(el, t.content);
}
let rq = 0, lastFull = 0, nextDue = Infinity;
function changed() {
  if (rq) return;
  rq = requestAnimationFrame(() => { rq = 0; recompute(); render(); });
}
function render() {
  if (rq) { cancelAnimationFrame(rq); rq = 0; }
  if (DRAG && DRAG.started) { DRAG.pending = true; return; }
  const app = document.getElementById('app');
  if (!app) return;
  UI.view = canonicalView(UI.view);
  lastFull = Date.now();
  applyPhoneDrifts();
  computeNextDue();
  morphInto(document.getElementById('main'), vMain());
  morphInto(document.getElementById('nav'), vNav());
  morphInto(document.getElementById('sheet'), UI.sheet ? vSheet() : '');
  morphInto(document.getElementById('desk'), UI.desk ? vDesk() : '');
  document.documentElement.style.overflow = UI.sheet || UI.desk ? 'hidden' : '';
  if (S.mcp) gcWatch();
  nativeSync();
  if (UI.view === 'plan' && UI.cal.scrollTo) { const sc = document.getElementById('cv-scroll'); if (sc) { UI.cal.scrollTo = false; sc.scrollTop = calScrollTarget(); } }
  tick(true);
}
function renderSheet() { morphInto(document.getElementById('sheet'), UI.sheet ? vSheet() : ''); }
function computeNextDue() {
  const now = Date.now();
  let due = Infinity;
  const ps = pomoState(now);
  if (ps && ps.end > now) due = Math.min(due, ps.end);
  const g = CUR && guardInfo(now) == null ? (() => { const s = parseT(CUR.start), a = act(CUR.activity); const ack = parseT(CUR.ack); const ref = ack && ack > s ? ack : s; return ref + (a.guard || (a.role === 'sleep' ? 14 : +CFG.guardHours || 4)) * HOUR; })() : Infinity;
  due = Math.min(due, g);
  nextDue = due;
}
function tick(fromRender) {
  const now = Date.now();
  if (!fromRender) {
    if (now >= nextDue || now - lastFull > 30000 || (UI.desk && UI.deskCtl && now > UI.deskCtl && now - UI.deskCtl < 1500)) { recompute(); render(); return; }
  }
  document.querySelectorAll('[data-tk]').forEach(el => {
    const k = el.getAttribute('data-tk');
    if (k === 'el') el.textContent = fmtClock(now - +el.getAttribute('data-s'));
    else if (k === 'elh') el.textContent = fmtClock(now - +el.getAttribute('data-s'), true);
    else if (k === 'elx') el.textContent = fmtEl(now - +el.getAttribute('data-s'));
    else if (k === 'dur') el.textContent = fmtDur(now - +el.getAttribute('data-s'));
    else if (k === 'cd') el.textContent = fmtClock(+el.getAttribute('data-to') - now);
    else if (k === 'ring') { const f = clamp((now - +el.getAttribute('data-s')) / +el.getAttribute('data-len'), 0, 1); el.setAttribute('stroke-dashoffset', String(Math.round(1000 * (1 - f)))); }
    else if (k === 'bar') { const f = clamp((now - +el.getAttribute('data-s')) / +el.getAttribute('data-len'), 0, 1); el.style.width = (f * 100).toFixed(2) + '%'; }
  });
}

/* ---------- sheets helpers ---------- */
let sheetOpener = null;
function focusSheet() {
  requestAnimationFrame(() => {
    const sh = document.querySelector('#sheet .sheet');
    if (!sh) return;
    const f = sh.querySelector('input:not([type=checkbox]),textarea,select,button.btn.lamp');
    if (f && window.matchMedia('(pointer:fine)').matches) f.focus({ preventScroll: true });
    else { sh.setAttribute('tabindex', '-1'); sh.focus({ preventScroll: true }); }
  });
}
document.addEventListener('keydown', e => {
  if (!UI.sheet || e.key !== 'Tab' || e.defaultPrevented) return;
  const sh = document.querySelector('#sheet .sheet');
  if (!sh) return;
  const all = Array.from(sh.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
    .filter(el => el.getClientRects().length && el.getAttribute('aria-hidden') !== 'true' && el.tabIndex >= 0);
  if (!all.length) { e.preventDefault(); sh.focus({ preventScroll: true }); return; }
  const first = all[0], last = all[all.length - 1], active = document.activeElement;
  if (e.shiftKey && (active === first || active === sh || !sh.contains(active))) {
    e.preventDefault(); last.focus({ preventScroll: true });
  } else if (!e.shiftKey && (active === last || active === sh || !sh.contains(active))) {
    e.preventDefault(); first.focus({ preventScroll: true });
  }
}, true);
function openSheet(s) {
  if (!s || !s.type || !SHEETS[s.type]) { console.warn('Unknown sheet:',s&&s.type);return; }
  const replacing = !!UI.sheet;
  sheetOpener=document.activeElement; UI.sheet=s;
  // Replacing a sheet is not another back-stack level; the old sheet is gone.
  if (!replacing) kHistoryPush('sheet');
  render();focusSheet();
}
function closeSheet(silent, fromHistory) {
  const hadSheet=!!UI.sheet;
  UI.sheet = null;
  if (hadSheet && !fromHistory) kHistoryConsume('sheet');
  if (!silent) render();
  if (sheetOpener && sheetOpener.isConnected) { try { sheetOpener.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  sheetOpener = null;
}

/* ---------- actions ---------- */
Object.assign(ACT, {
  notice() { noticeNow(); },
  'notice-drift'(el) { noticeDrift(+el.getAttribute('data-m')); },
  'park-backlog'(el) { parkToBacklog(el.getAttribute('data-k'), el.getAttribute('data-id')); },
  'park-drop'(el) { const k = el.getAttribute('data-k'); commit('Dropped.', W().dis(k, el.getAttribute('data-id'), { dismissed: true }), { undo: true }); },
  noop() {},
  view(el) { UI.view=canonicalView(el.getAttribute('data-v')); UI.pages=[];UI.planMenu=false; if(UI.view==='today')UI.date=null; if(UI.view==='plan')UI.cal.scrollTo=true; try{history.replaceState(null,'','#'+UI.view)}catch(e){} render();window.scrollTo(0,0); },
  setup() { openSheet({ type: 'setup' }); },
  'sheet-close'(el, e) { if (e && e.target !== el && el.classList.contains('scrim')) return; closeSheet(); },
  'day-prev'() { UI.date = addDaysKey(UI.date || todayKey(), -1); UI.openBlk = null; UI.planMenu = false; render(); },
  'day-next'() { const k = addDaysKey(UI.date || todayKey(), 1); UI.date = k === todayKey() ? null : k; UI.openBlk = null; UI.planMenu = false; render(); },
  'day-today'() { UI.date = null; render(); },
  'day-pick'(el) { const v = el.value; if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { UI.date = v === todayKey() ? null : v; render(); } },
  'goto-day'(el) { const k = el.getAttribute('data-k'); UI.view = 'today'; UI.date = k === todayKey() ? null : k; try { history.replaceState(null, '', '#today'); } catch (e) { /* ignore */ } render(); window.scrollTo(0, 0); },
  start(el) { startActivity(el.getAttribute('data-id')); },
  stop() { stopTimer(); },
  break() { takeBreak(); },
  back() { backFromBreak(); },
  resume() { const l = lastEntry(); if (l) startActivity(l.a); },
  desk() { enterDesk(); },
  'desk-exit'(el, e) { e.stopPropagation(); exitDesk(); },
  'desk-tap'() { UI.deskCtl = Date.now() + 6000; render(); },
  'pomo-toggle'() {
    const on = pomoShown();
    UI.pomoOn = !on; store.set('pomoOn', UI.pomoOn);
    const c = CUR;
    const w = W();
    if (c && !on && !c.pomo && isStudyId(c.activity)) w.update('state/current', { pomo: newPomo(parsePreset(UI.pomoPreset) || PRESETS['25/5'], Date.now()) });
    else if (c && on && c.pomo) w.update('state/current', { pomo: null });
    if (w.list().length) { commit(UI.pomoOn ? 'Pomodoro on for this session.' : 'Pomodoro off. The timer keeps running.', w, { undo: false }); return; }
    render();
  },
  'pomo-preset'(el) {
    UI.pomoPreset = el.value; store.set('pomoPreset', UI.pomoPreset);
    const c = CUR, p = parsePreset(UI.pomoPreset);
    if (c && c.pomo && c.pomo.phase === 'focus' && p) { const w = W(); w.update('state/current', { pomo: { focus: p.focus, short: p.short, long: p.long, every: p.every } }); commit(null, w, { undo: false }); return; }
    render();
  },
  'start-from'(el) { UI.from = el.value; },
  'cur-note'(el) { const c = CUR; if (!c) return; const v = el.value.trim().slice(0, 200); if (v === (c.note || '')) return; const w = W(); w.update('state/current', { note: v }); commit(null, w, { undo: false }); },
  'edit-running'() { openEntrySheet('running'); },
  'edit-entry'(el) { openEntrySheet('edit', { id: el.getAttribute('data-id') }); },
  'add-entry'() { openEntrySheet('add'); },
  fill(el) { const s = +el.getAttribute('data-s'), ev = el.getAttribute('data-e'); openEntrySheet('add', { s, e: ev === 'now' ? Date.now() : +ev }); },
  logmode(el) { UI.logMode = el.getAttribute('data-m'); store.set('logMode', UI.logMode); render(); },
  'guard-keep'() { const w = W(); w.update('state/current', { ack: isoLocal(Date.now()) }); UI.guardOpen = false; commit(null, w, { undo: false }); },
  'guard-fix'() { UI.guardOpen = !UI.guardOpen; if (UI.guardOpen && CUR) { const s = parseT(CUR.start); UI.guardTime = msToHm(Math.min(Date.now(), s + 60 * MIN)); } render(); },
  'guard-save'() {
    const c = CUR; if (!c || !/^\d{1,2}:\d{2}/.test(UI.guardTime)) return;
    const s = parseT(c.start), now = Date.now();
    const [h, m] = UI.guardTime.split(':').map(Number);
    const d = new Date(now); d.setHours(h, m, 0, 0);
    let t = d.getTime();
    while (t > now) t -= DAY;
    if (t <= s) { toast('That time is before the timer started (' + fmtT(s) + ').'); return; }
    stopTimer({ at: t });
  },
  'guard-seen'(el) { stopTimer({ at: +el.getAttribute('data-t') }); },
  'entry-save'() { saveEntrySheet(); },
  'entry-del'() { deleteEntrySheet(); },
  'split-open'() {
    const sh = UI.sheet; const en = ENTRIES.find(e => e.id === sh.id); if (!en) return;
    const other = ACTS.find(a => !a.archived && a.id !== en.a);
    openSheet({ type: 'split', id: en.id, at: msToHm(en.s + (en.e - en.s) / 2), activity: other ? other.id : en.a, err: '' });
  },
  'split-save'() { saveSplit(); },
  pick(el) { setBind(el.getAttribute('data-bind-to'), el.getAttribute('data-v')); render(); },
  'e-focus'(el) { const d = UI.sheet.d; const v = +el.getAttribute('data-v'); d.focus = d.focus === v ? null : v; render(); },
  'e-nudge'(el) {
    const d = UI.sheet.d, f = el.getAttribute('data-f'), dl = +el.getAttribute('data-d');
    if (!/^\d{1,2}:\d{2}/.test(d[f] || '')) return;
    const t = hmOnDay(d.date, d[f]) + dl * MIN;
    d[f] = msToHm(t);
    if (f === 'start') { const nk = dayKeyOf(t); if (nk !== d.date) d.date = nk; }
    render();
  },
  rate(el) {
    const t = UI.toast && UI.toast.rate; if (!t) return;
    const w = W(); w.day(t.day, { [t.id]: { focus: +el.getAttribute('data-v') } });
    UI.toast = null; renderToast();
    commit(null, w, { undo: false });
    toast('Rated ' + ({ 3: 'deep', 2: 'okay', 1: 'scattered' })[el.getAttribute('data-v')] + '.');
  },
  undo() { undo(); },
  copy(el) { copyText(el); },
  // plan
  'plan-menu'() { UI.planMenu = !UI.planMenu; UI.clearArmed = false; render(); },
  'plan-end'(el) { const k = UI.date || todayKey(); if (!/^\d{1,2}:\d{2}/.test(el.value)) return; const w = W(); w.plan(k, { end: el.value }); commit(null, w, { undo: false }); },
  'plan-start'(el) { const k = UI.date || todayKey(); if (!/^\d{1,2}:\d{2}/.test(el.value)) return; const w = W(); w.plan(k, { start: el.value }); commit(null, w, { undo: false }); },
  'plan-extend'(el) { const k = UI.date || todayKey(); const w = W(); w.plan(k, { end: el.getAttribute('data-t') }); commit('Plan now runs until ' + fmtHM(el.getAttribute('data-t')) + '.', w); },
  'plan-shrink'() { UI.planMenu = false; planShrink(UI.date || todayKey()); },
  'plan-overflow'() { UI.planMenu = false; planOverflow(UI.date || todayKey()); },
  'plan-wrap'() { UI.planMenu = false; const k = UI.date || todayKey(); const pm = planModelFor(k); const pick = {}; if (pm) pm.rows.forEach(r => { if (r.remaining > 0) pick[r.id] = true; }); openSheet({ type: 'wrap', k, pick, stop: false }); },
  'wrap-pick'(el) { UI.sheet.pick[el.getAttribute('data-id')] = el.checked; },
  'wrap-stop'(el) { UI.sheet.stop = el.checked; },
  'wrap-save'() { wrapUp(); },
  'plan-clear'() {
    if (!UI.clearArmed) { UI.clearArmed = true; render(); return; }
    UI.clearArmed = false; UI.planMenu = false;
    const k = UI.date || todayKey(); const w = W(); w.set('plans/' + k, { date: k, source: 'me', blocks: {} });
    commit('Cleared the plan.', w);
  },
  'carry-y'() { planCarryYesterday(); },
  'carry-n'() { const yk = addDaysKey(todayKey(), -1); const w = W(); w.plan(yk, { closed: true }); commit('Left yesterday’s plan as it was.', w); },
  'addblk-open'() { UI.addBlk = true; render(); requestAnimationFrame(() => { const el = document.getElementById('ab-min'); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }); },
  'addblk-close'() { UI.addBlk = false; render(); },
  'ab-min'(el) { UI.ab.minutes = +el.getAttribute('data-m'); render(); },
  'blk-toggle'(el) { const id = el.getAttribute('data-id'); UI.openBlk = UI.openBlk === id ? null : id; render(); },
  'blk-start'(el) {
    const k = UI.date || todayKey(); const b = blocksOf(k)[el.getAttribute('data-id')]; if (!b) return;
    if (k !== todayKey()) return;
    UI.openBlk = null;
    startActivity(b.activity, { block: el.getAttribute('data-id'), pomoPreset: b.pomo || undefined, force: true });
  },
  'blk-min'(el) { const k = UI.date || todayKey(), id = el.getAttribute('data-id'), b = blocksOf(k)[id]; if (!b) return; const m = Math.max(5, Math.min(720, (+b.minutes || 0) + +el.getAttribute('data-d'))); const w = W(); w.plan(k, { blocks: { [id]: { minutes: m } } }); commit(null, w); },
  'blk-move'(el) { planReorder(UI.date || todayKey(), el.getAttribute('data-id'), +el.getAttribute('data-d')); },
  'blk-status'(el) { const k = UI.date || todayKey(), id = el.getAttribute('data-id'), s = el.getAttribute('data-s'); const w = W(); w.plan(k, { blocks: { [id]: { status: s } } }); UI.openBlk = null; commit(s === 'skipped' ? 'Skipped the block.' : s === 'done' ? 'Marked the block done.' : 'Reopened the block.', w); },
  'blk-unfix'(el) { const k = UI.date || todayKey(), id = el.getAttribute('data-id'); const w = W(); w.plan(k, { blocks: { [id]: { at: null } } }); commit('The block now fits wherever there’s room today.', w); },
  'blk-tomorrow'(el) {
    const k = UI.date || todayKey(), id = el.getAttribute('data-id'); const pm = planModelFor(k); const r = pm && pm.rows.find(x => x.id === id); if (!r) return;
    const w = W();
    w.plan(k, { blocks: { [id]: r.done > MIN ? { minutes: Math.round(r.done / MIN), status: 'done' } : { status: 'moved' } } });
    const nk = carryTo(w, k, [{ activity: r.activity, title: r.title, minutes: Math.ceil(r.remaining / MIN), pomo: r.pomo }]);
    UI.openBlk = null;
    commit('Moved ' + fmtDur(r.remaining) + ' of ' + act(r.activity).name + ' to ' + shortDay(nk) + '.', w);
  },
  'blk-edit'(el) { openBlockSheet(UI.date || todayKey(), el.getAttribute('data-id')); },
  'block-save'() { saveBlockSheet(); },
  'blk-del'(el) { const k = UI.date || todayKey(), id = el.getAttribute('data-id'); const w = W(); w.plan(k, { blocks: { [id]: null } }); UI.openBlk = null; commit('Deleted the block.', w); },
  // onboarding and activities
  'onb-chip'(el) { addActs([el.getAttribute('data-name')], 'study'); },
  'onb-done'() { saveSetting({ onboarded: true }, null); },
  starter() { const w = W(); w.set('config/activities', { items: STARTER }); commit('Added the starter activities.', w); },
  'act-color'(el) { const a = ACTMAP[el.getAttribute('data-id')]; if (!a) return; const i = PALETTE.findIndex(c => c.toUpperCase() === a.color.toUpperCase()); saveAct(a.id, { color: PALETTE[(i + 1) % PALETTE.length] }); },
  'act-name'(el) { const a = ACTMAP[el.getAttribute('data-id')]; const v = el.value.trim().replace(/\s+/g, ' ').slice(0, 40); if (!a || !v || v === a.name) { if (a) el.value = a.name; return; } saveAct(a.id, { name: v }, 'Renamed to ' + v + '.'); },
  'act-kind'(el) { const a = ACTMAP[el.getAttribute('data-id')]; const k = el.getAttribute('data-k'); if (!a || a.kind === k) return; saveAct(a.id, { kind: k }, a.name + ' now counts as ' + (k === 'study' ? 'study.' : 'life.')); },
  'act-goal'(el) { const a = ACTMAP[el.getAttribute('data-id')]; if (!a) return; const h = parseFloat(el.value); saveAct(a.id, { goal: h > 0 ? Math.round(h * 60) : null }); },
  'act-arch'(el) { const a = ACTMAP[el.getAttribute('data-id')]; if (!a) return; saveAct(a.id, { archived: !a.archived }, (a.archived ? 'Restored ' : 'Archived ') + a.name + '.'); },
  'act-move'(el) {
    const a = ACTMAP[el.getAttribute('data-id')]; if (!a) return;
    const list = ACTS.filter(x => x.kind === a.kind);
    const i = list.indexOf(a), j = i + +el.getAttribute('data-d');
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const items = {}; list.forEach((x, n) => { items[x.id] = { order: n + 1 }; });
    const w = W(); w.update('config/activities', { items }, { items: {} }); commit(null, w, { undo: false });
  },
  'na-kind'(el) { UI.newAct.kind = el.getAttribute('data-k'); renderSheet(); },
  'show-arch'() { UI.showArchived = !UI.showArchived; renderSheet(); },
  'preset-apply'(el) { const p = parsePreset(el.getAttribute('data-p')); if (p) saveSetting({ pomodoro: p }, null); },
  'set-num'(el) {
    const f = el.getAttribute('data-f'), v = +el.value;
    if (!Number.isFinite(v)) return;
    const lim = { focus: [1, 180], short: [1, 60], long: [1, 90], every: [2, 8], gap: [0, 60], guardHours: [1, 12] }[f];
    if (!lim) return;
    const val = clamp(Math.round(v), lim[0], lim[1]);
    if (['focus', 'short', 'long', 'every'].includes(f)) saveSetting({ pomodoro: { [f]: val } }, null); else saveSetting({ [f]: val }, null);
  },
  'set-time'(el) { if (/^\d{1,2}:\d{2}/.test(el.value)) saveSetting({ [el.getAttribute('data-f')]: el.value.slice(0, 5) }, null); },
  'set-goal'(el) { const h = parseFloat(el.value); if (Number.isFinite(h) && h >= 0) saveSetting({ dailyGoal: Math.round(h * 60) }, null); },
  'set-week'(el) { saveSetting({ weekStart: +el.value }, null); },
  'set-clock'(el) { saveSetting({ clock: el.value }, null); },
  export(el) { exportData(el.getAttribute('data-f')); },
  'ex-hide'() { UI.hideEx = true; store.set('hideEx', true); render(); },
  // week and patterns
  'wk-prev'() { UI.weekOff++; render(); },
  'wk-next'() { UI.weekOff = Math.max(0, UI.weekOff - 1); render(); },
  'wk-this'() { UI.weekOff = 0; render(); },
  pw(el) { UI.pweeks = +el.getAttribute('data-w'); render(); }
});
Object.assign(SUBMIT, {
  'park-add'() { parkAdd(UI.parkText); },
  'onb-add'() { const names = String(UI.onbText || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean); if (!names.length) return; UI.onbText = ''; const el = document.getElementById('onb-text'); if (el) el.value = ''; addActs(names, 'study'); },
  'act-add'() { const n = UI.newAct.name; if (!String(n).trim()) return; UI.newAct.name = ''; const el = document.getElementById('na-name'); if (el) el.value = ''; addActs([n], UI.newAct.kind); },
  'blk-add'(f) { planAddBlock(f.getAttribute('data-k')); }
});
function addActs(names, kind) {
  const items = {};
  const added = [];
  names.slice(0, 20).forEach(n => { const r = addActivity(n, kind); if (r) { items[r.id] = r.doc; added.push(r.doc.name); } });
  if (!added.length) { render(); return; }
  const w = W(); w.update('config/activities', { items }, { items: {} });
  commit('Added ' + added.join(', ') + '.', w);
}
function setBind(path, value) {
  const parts = path.split('.');
  let o;
  if (parts[0] === 'sheet') { o = UI.sheet; parts.shift(); }
  else if (parts[0] === 'd' || parts[0] === 'b') o = UI.sheet;
  else o = UI;
  if (!o) return;
  for (let i = 0; i < parts.length - 1; i++) { o = o[parts[i]]; if (!o) return; }
  o[parts[parts.length - 1]] = value;
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const name = el.getAttribute('data-act');
  if (name === 'sheet-close' && el.classList.contains('scrim') && e.target !== el) return;
  if (name === 'desk-tap' && e.target.closest('button')) return;
  if ((el.type === 'checkbox')) { const fn = ACT[name]; if (fn) fn(el, e); return; }
  const fn = ACT[name];
  if (fn) fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.hasAttribute && el.hasAttribute('data-bind')) {
    setBind(el.getAttribute('data-bind'), el.type === 'checkbox' ? el.checked : el.value);
    if (UI.sheet) renderSheet(); else render();
  }
  const ch = el.getAttribute && el.getAttribute('data-change');
  if (ch && ACT[ch]) ACT[ch](el, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.hasAttribute && el.hasAttribute('data-bind') && el.type !== 'checkbox') {
    setBind(el.getAttribute('data-bind'), el.value);
    if (UI.sheet && el.closest('#sheet')) renderSheet();
  }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, fn = SUBMIT[f.getAttribute('data-submit')];
  if (fn) fn(f, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (DRAG && DRAG.started) { cancelDrag(); e.preventDefault(); return; }
    if (UI.sheet) { closeSheet(); e.preventDefault(); return; }
    if (UI.desk) { exitDesk(); e.preventDefault(); return; }
    if (UI.planMenu || UI.openBlk) { UI.planMenu = false; UI.openBlk = null; render(); return; }
  }
  const t = e.target;
  if (e.key === 'Enter' && t && t.id === 'cur-note') { t.blur(); return; }
  const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || UI.sheet) return;
  const k = e.key;
  if (k === 'x' || k === 'X') { if (CUR) { e.preventDefault(); noticeNow(); } return; }
  if (/^[1-9]$/.test(k)) {
    const list = ACTS.filter(a => !a.archived);
    const order = list.filter(a => a.kind === 'study').concat(list.filter(a => a.kind !== 'study'));
    const a = order[+k - 1];
    if (a) { e.preventDefault(); startActivity(a.id); }
    return;
  }
  const lk = k.toLowerCase();
  if (lk === 's') { if (CUR) stopTimer(); }
  else if (lk === 'b') { if (CUR && act(CUR.activity).role === 'break') backFromBreak(); else takeBreak(); }
  else if (lk === 'r') { if (!CUR) { const l = lastEntry(); if (l) startActivity(l.a); } }
  else if (lk === 'm') ACT['pomo-toggle']();
  else if (lk === 'd') { if (UI.desk) exitDesk(); else enterDesk(); }
  else if (lk === 'n') { if (UI.view === 'calendar') ACT['cal-new'](); else openEntrySheet('add'); }
  else if (lk === 't') ACT.view({ getAttribute: () => 'today' });
  else if (lk === 'c') ACT.view({ getAttribute: () => 'calendar' });
  else if (lk === 'w') ACT.view({ getAttribute: () => 'week' });
  else if (lk === 'p') ACT.view({ getAttribute: () => 'patterns' });
  else if (k === 'ArrowLeft') { if (UI.view === 'week') ACT['wk-prev'](); else if (UI.view === 'today') ACT['day-prev'](); else if (UI.view === 'calendar') ACT['cal-prev'](); else return; }
  else if (k === 'ArrowRight') { if (UI.view === 'week') ACT['wk-next'](); else if (UI.view === 'today') ACT['day-next'](); else if (UI.view === 'calendar') ACT['cal-next'](); else return; }
  else return;
  e.preventDefault();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { recompute(); render(); pumpAll(); if (UI.desk) wakeOn(); }
  else store.set('seen', Date.now());
});
window.addEventListener('pagehide', () => store.set('seen', Date.now()));
window.addEventListener('online', () => pumpAll());
window.addEventListener('hashchange', () => {
  const h = (location.hash || '').replace('#', '');
  if (['today', 'calendar', 'week', 'patterns'].includes(h) && h !== UI.view) { UI.view = h; if (h === 'today') UI.date = null; if (h === 'calendar') UI.cal.scrollTo = true; render(); }
});

/* ---------- boot ---------- */
async function boot(hot) {
  hot = hot || {};
  if (hot.view) UI.view = hot.view;
  if (hot.date) UI.date = hot.date;
  const h = (location.hash || '').replace('#', '');
  if (['today','plan','stats','settings','calendar','week','patterns'].includes(h)) UI.view = canonicalView(h);
  S.windowFrom = addDaysKey(keyOfDate(new Date()), -WINDOW_DAYS);
  restorePending();
  recompute();
  render();
  let seenW = 0;
  setInterval(() => { tick(false); const n = Date.now(); if (document.visibilityState === 'visible' && n - seenW > 30000) { seenW = n; store.set('seen', n); } }, 1000);
  await startSession();
}

/* R0a: registry bridge until the Phase-2 owners replace legacy sheets. */
Object.assign(SHEETS,{qnew:sQnew,busy:sBusy,deadline:sDeadline,task:sTask});
VIEWS.calendar=VIEWS.plan;
document.addEventListener('keydown', e=>{if(e.key==='Escape'&&!e.defaultPrevented){if(goBack()){e.preventDefault();e.stopPropagation();}}},true);
window.addEventListener('popstate',()=>{if(kIgnorePopstate){kIgnorePopstate--;return;}goBack(true);});
