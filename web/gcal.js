/* ===== Google Calendar: read-only events shown as busy time (via the viewer's own connector) ===== */
const GC = { server: 'Google Calendar', tool: 'list_events', status: 'off', events: [], at: 0, msg: '', unsub: null, key: '' };
function gcRange() {
  const tk = todayKey();
  let lo = addDaysKey(weekStartKey(tk), -7), hi = addDaysKey(tk, 28);
  if (UI.view === 'calendar') {
    const d = calDays();
    if (d[0] < lo) lo = weekStartKey(d[0]);
    if (d[d.length - 1] > hi) hi = addDaysKey(weekStartKey(d[d.length - 1]), 6);
  }
  return [lo, addDaysKey(hi, 1)];
}
function gcInput(r) { return { startTime: r[0] + 'T00:00:00', endTime: r[1] + 'T00:00:00', orderBy: 'startTime', pageSize: 250 }; }
function gcWatch() {
  if (!S.mcp || !S.owner) return;
  const r = gcRange(), key = r.join('>');
  if (key === GC.key && GC.unsub) return;
  if (GC.unsub) { try { GC.unsub(); } catch (e) { /* already closed */ } }
  GC.key = key;
  if (GC.status === 'off') GC.status = 'loading';
  try {
    GC.unsub = S.mcp.watchTool(GC.server, GC.tool, gcInput(r), ev => { if (ev.type === 'data') gcData(ev.result); else gcErr(ev.error); changed(); },
      { refetchInterval: 5 * 60000, cache: { staleTime: 2 * 60000, gcTime: 60 * 60000 } });
  } catch (e) { GC.status = 'error'; GC.msg = String((e && e.message) || e); }
}
function normGc(x) {
  if (!x || x.status === 'cancelled' || x.eventType === 'WORKING_LOCATION' || x.eventType === 'BIRTHDAY') return null;
  if (typeof x.description === 'string' && x.description.indexOf('carrel1:') >= 0) return null;
  const title = String(x.summary || 'Busy').slice(0, 120);
  const link = typeof x.htmlLink === 'string' && /^https:\/\//.test(x.htmlLink) ? x.htmlLink : null;
  if (x.start && x.start.dateTime) {
    const s = parseT(x.start.dateTime), e = parseT(x.end && x.end.dateTime);
    if (s == null || e == null || e <= s) return null;
    return { id: String(x.id || s), title, s, e, allDay: false, link };
  }
  const sd = x.start && x.start.date ? String(x.start.date).slice(0, 10) : '';
  const ed = x.end && x.end.date ? String(x.end.date).slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) return null;
  return { id: String(x.id || sd), title, allDay: true, from: sd, to: /^\d{4}-\d{2}-\d{2}$/.test(ed) && ed > sd ? ed : addDaysKey(sd, 1), link };
}
function gcData(res) {
  const p = res && res.payload;
  const list = p && Array.isArray(p.events) ? p.events : [];
  GC.events = list.map(normGc).filter(Boolean);
  GC.status = 'ok';
  GC.msg = '';
  GC.at = (res && res.cache && res.cache.storedAt) || Date.now();
}
const GC_DENIED = ['needs_reauth', 'server_not_connected', 'selection_required', 'blocked_by_policy', 'approval_required', 'not_in_manifest', 'server_not_found', 'not_granted', 'capability_disabled', 'capability_removed', 'consent_required'];
function gcErr(err) {
  const c = (err && err.code) || 'upstream_error';
  if (GC_DENIED.includes(c)) { GC.events = []; GC.status = c; GC.msg = ''; }
  else { GC.status = GC.events.length ? 'stale' : 'error'; GC.msg = (err && err.message) || ''; }
}
async function gcConnect(fresh) {
  if (!S.mcp) return;
  if (!GC.events.length) GC.status = 'loading';
  render();
  try { gcData(await S.mcp.callTool(GC.server, GC.tool, gcInput(gcRange()), fresh ? { cache: { staleTime: 2 * 60000, gcTime: 60 * 60000, refresh: true } } : undefined)); }
  catch (e) { gcErr(e); }
  changed();
}
async function gcPermissions() {
  try { const p = await window.claude.use('permissions'); if (p && p.manage) { await p.manage(); gcConnect(); return; } } catch (e) { /* fall through */ }
  toast('Open this page’s Permissions menu and turn on Google Calendar.');
}
function gcFor(k) { const ds = dayStartMs(k), de = dayEndMs(k); return GC.events.filter(x => !x.allDay && x.s < de && x.e > ds); }
function gcAllDay(k) { return GC.events.filter(x => x.allDay && x.from <= k && x.to > k); }
function vGcalPanel() {
  if (!S.mcp) return `<section class="panel"><div class="sec-head"><h2>Google Calendar</h2></div><p class="cap">Busy time from Google Calendar is coming in a later update.</p></section>`;
  const st = GC.status;
  const n = GC.events.filter(x => x.allDay ? x.to > todayKey() : x.e > Date.now()).length;
  let text, btn = '';
  if (st === 'ok' || st === 'stale') {
    text = st === 'stale' ? `Couldn’t refresh just now. Showing events from ${fmtT(GC.at)}.` : `${n ? n + ' upcoming event' + (n > 1 ? 's' : '') : 'No upcoming events'} in the next four weeks. Timed events count as busy, so plans move around them. Updated ${fmtT(GC.at)}.`;
    btn = `<button type="button" class="btn sm" data-act="gc-refresh">Refresh</button>`;
  } else if (st === 'loading' || st === 'off') text = 'Checking your Google Calendar…';
  else if (st === 'approval_required' || st === 'consent_required') { text = 'Allow Carrel to read your Google Calendar so your events show here and plans fit around them. It only reads; nothing in your calendar changes.'; btn = `<button type="button" class="btn sm lamp" data-act="gc-connect">Allow and show events</button>`; }
  else if (st === 'not_in_manifest') { text = 'Google Calendar is turned off for this page.'; btn = `<button type="button" class="btn sm" data-act="gc-perms">Turn it on</button>`; }
  else if (st === 'needs_reauth') text = 'Your Google Calendar connection needs signing in again. Reconnect it in claude.ai Settings → Connectors, then reload.';
  else if (st === 'server_not_connected' || st === 'server_not_found') text = 'Add Google Calendar in claude.ai Settings → Connectors to see your events here.';
  else if (st === 'selection_required') text = 'You have more than one Google Calendar connector. Choose one when Claude asks, then reload.';
  else if (st === 'blocked_by_policy') text = 'Your organization doesn’t allow this connector here.';
  else if (st === 'not_granted' || st === 'capability_disabled' || st === 'capability_removed') text = 'Google Calendar isn’t available in this view. Open Carrel in the Claude app or on claude.ai.';
  else { text = 'Couldn’t load your events' + (GC.msg ? ': ' + GC.msg.slice(0, 140) : '.'); btn = `<button type="button" class="btn sm" data-act="gc-connect">Try again</button>`; }
  return `<section class="panel" aria-labelledby="gc-h"><div class="sec-head"><h2 id="gc-h">Google Calendar</h2>${btn}</div><p class="cap">${esc(text)}</p></section>`;
}
Object.assign(ACT, {
  'gc-connect'() { gcConnect(false); },
  'gc-refresh'() { gcConnect(true); },
  'gc-perms'() { gcPermissions(); }
});
