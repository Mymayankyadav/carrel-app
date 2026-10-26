/* ===== native bridge (Capacitor) and browser fallbacks ===== */
const NATIVE = typeof window !== 'undefined' && !!(window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
const CAP = NATIVE ? Capacitor.Plugins : {};
const CL = NATIVE && typeof Capacitor.isPluginAvailable === 'function' && Capacitor.isPluginAvailable('CarrelLive') ? Capacitor.Plugins.CarrelLive : null;

const DL = {
  async save({ filename, data }) {
    if (NATIVE && CAP.Filesystem && CAP.Share) {
      const w = await CAP.Filesystem.writeFile({ path: filename, data, directory: 'CACHE', encoding: 'utf8' });
      await CAP.Share.share({ title: filename, files: [w.uri] });
      return;
    }
    const type = /\.csv$/.test(filename) ? 'text/csv' : 'application/json';
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
};

/* ----- phone notification (the CarrelLive plugin) ----- */
const NP = { vibrateFocus: true, vibrateBreak: false, respectDnd: true, privacy: false, notifications: true, exactAlarms: true };
let nbDone = false, nsSig = '';

/* Native may have refreshed the login while the app was closed; pick up the newer tokens before supabase-js starts. */
async function adoptNativeSession() {
  if (!CL || !CL.getSession) return;
  try {
    const ns = await CL.getSession();
    if (!ns || !ns.refresh) return;
    const key = 'sb-' + new URL(SUPABASE_URL).hostname.split('.')[0] + '-auth-token';
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const js = JSON.parse(raw);
    if (!js || !js.user) return;
    if (ns.expiresAt > (js.expires_at || 0) * 1000 && ns.refresh !== js.refresh_token) {
      js.access_token = ns.access; js.refresh_token = ns.refresh;
      js.expires_at = Math.round(ns.expiresAt / 1000);
      js.expires_in = Math.max(0, js.expires_at - Math.round(Date.now() / 1000));
      localStorage.setItem(key, JSON.stringify(js));
    }
  } catch (e) { /* keep what the page has */ }
}

function nativeBoot() {
  if (!CL) return;
  CL.configure({ url: SUPABASE_URL, key: SUPABASE_KEY });
  nsSig = '';
  if (nbDone) return;
  nbDone = true;
  updateBoot();
  CL.addListener('session', s => { if (sb && s && s.refresh) sb.auth.setSession({ access_token: s.access, refresh_token: s.refresh }).catch(() => {}); });
  CL.addListener('action', () => { if (S.db && S.db.refresh) S.db.refresh(); });
  CL.getPrefs().then(p => { Object.assign(NP, p); changed(); }).catch(() => {});
  if (!store.get('notifAsked')) {
    store.set('notifAsked', 1);
    CL.requestNotifications().then(p => { Object.assign(NP, p); changed(); }).catch(() => {});
  }
}
function nativeSession(session) {
  if (CL && CL.setSession) CL.setSession({ access: session.access_token, refresh: session.refresh_token, expiresAt: (session.expires_at || 0) * 1000 });
}
function nativeClear() { nsSig = ''; if (CL && CL.clearSession) CL.clearSession(); }

/* Tells the notification what the timer is doing. Only sends when something changed. */
function nativeSync() {
  if (!CL || !S.db || !S.loaded.current) return;
  let blockTitle = '';
  if (CUR && CUR.block) {
    const p = V.plans[dayKeyOf(parseT(CUR.start))], b = p && p.blocks && p.blocks[CUR.block];
    blockTitle = (b && b.title) || '';
  }
  const br = breakAct();
  const state = liveStateOf(CUR, { rev: 0, act: id => act(id), breakId: br ? br.id : null, blockTitle });
  const payload = { state, id: CUR ? CUR.id : null };
  const sig = JSON.stringify(payload);
  if (sig === nsSig) return;
  nsSig = sig;
  CL.setState(payload).catch(() => { nsSig = ''; });
}

function vPhonePanel() {
  if (!CL) return '';
  const row = (k, label) => `<div class="row"><span class="note-line">${label}</span><button type="button" class="btn sm" data-act="np-toggle" data-k="${k}" aria-pressed="${NP[k] ? 'true' : 'false'}">${NP[k] ? 'On' : 'Off'}</button></div>`;
  return `<div class="setsec"><h3>Phone notification (update test)</h3>
    <p class="note-line">The running timer in your notification shade, with Urge, Drifted, Park, Stop and Take break buttons.</p>
    ${NP.notifications === false ? `<div class="row"><span class="note-line">Notifications are off for Carrel.</span><button type="button" class="btn sm" data-act="np-notif">Allow</button></div>` : ''}
    ${row('vibrateFocus', 'Vibrate when focus time ends')}
    ${row('vibrateBreak', 'Vibrate when a break ends')}
    ${row('respectDnd', 'Stay quiet in Do Not Disturb')}
    ${row('privacy', 'Hide details on the lock screen')}
    <div class="row"><span class="note-line">Last buzz: ${esc(NP.lastNudge || 'none yet')}</span><span><button type="button" class="btn sm" data-act="np-test">Test buzz</button> <button type="button" class="btn sm ghost" data-act="np-check">Refresh</button></span></div>
    <div class="row"><span class="note-line">${NP.exactAlarms === false ? 'Exact alarms are off, so the vibration can arrive a few minutes late.' : 'Exact alarms are allowed.'}</span><button type="button" class="btn sm" data-act="np-exact">Open settings</button></div>
    <div class="row"><span class="note-line">${UPDI.apk ? `<b>New app version available.</b>` : `App build ${UPDI.build || '?'}, web code ${esc(UPDI.bundle || 'built in')}.`} ${esc(UPDI.web)}</span><span>${UPDI.apk ? `<button type="button" class="btn sm" data-act="upd-apk">Download</button> ` : ''}<button type="button" class="btn sm ghost" data-act="upd-check">${UPDI.busy ? 'Checking' : 'Check now'}</button></span></div>
    <div class="row"><span class="note-line">If the notification stops updating, let Carrel run in the background.</span><button type="button" class="btn sm" data-act="np-battery">Battery settings</button></div>
  </div>`;
}
Object.assign(ACT, {
  'np-toggle'(el) {
    const k = el.getAttribute('data-k');
    NP[k] = !NP[k];
    if (CL) CL.setPrefs({ [k]: NP[k] }).then(p => { Object.assign(NP, p); changed(); }).catch(() => {});
    changed();
  },
  'np-notif'() { if (CL) CL.requestNotifications().then(p => { Object.assign(NP, p); changed(); }).catch(() => {}); },
  'np-test'() { if (CL) CL.testNudge().then(p => { Object.assign(NP, p); changed(); }).catch(() => toast('Could not test the buzz.')); },
  'np-check'() { if (CL) CL.getPrefs().then(p => { Object.assign(NP, p); changed(); }).catch(() => {}); },
  'upd-check'() { checkUpdates(true); },
  'upd-apk'() { if (UPDI.apk && CAP.Browser) CAP.Browser.open({ url: UPDI.apk.url }); },
  'np-exact'() { if (CL) CL.openExactAlarmSettings(); },
  'np-battery'() { if (CL) CL.openBatterySettings().then(r => { if (r && r.help) toast(r.help); }).catch(() => {}); }
});

/* ----- self-update: new web code arrives without reinstalling; a new APK shows a banner ----- */
const UPD = NATIVE && CAP.CapacitorUpdater ? CAP.CapacitorUpdater : null;
const UPDATE_URL = 'https://mymayankyadav.github.io/carrel-app/updates/latest.json';
const RELEASES_URL = 'https://api.github.com/repos/Mymayankyadav/carrel-app/releases?per_page=1';
const m_url = step => UPDATE_URL.replace('latest.json', 'web-' + step.replace('downloading ', '') + '.zip');
const UPDI = { build: 0, bundle: '', web: '', apk: null, busy: false };
if (UPD) UPD.notifyAppReady().catch(() => {});   // without this the updater rolls the new code back

async function checkUpdates(manual) {
  if (!NATIVE || UPDI.busy) return;
  UPDI.busy = true;
  try {
    try { const i = await CAP.App.getInfo(); UPDI.build = +i.build || 0; } catch (e) { /* keep 0 */ }
    if (UPD) { try { const c = await UPD.current(); UPDI.bundle = (c.bundle && c.bundle.version) || ''; } catch (e) { /* keep */ } }
    let step = 'start';
    try {   // 1) new web code
      if (UPD) {
        step = 'reading latest.json';
        const r = await fetch(UPDATE_URL, { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const m = await r.json();
        if (!m.version || m.version === UPDI.bundle) UPDI.web = manual ? 'Web code is up to date.' : UPDI.web;
        else if (m.minNative && UPDI.build < m.minNative) UPDI.web = 'A new web version needs the new app first.';
        else if (store.get('updReady') === m.version) UPDI.web = 'Update ready. Reopen Carrel to apply.';
        else {
          step = 'downloading ' + m.version;
          const b = await UPD.download({ url: m.url, version: m.version });
          step = 'switching to ' + m.version;
          await UPD.next({ id: b.id });
          store.set('updReady', m.version);
          UPDI.web = 'Update ready. Reopen Carrel to apply.';
          toast('Update ready. Reopen Carrel to apply.');
        }
      }
    } catch (e) {
      let more = '';
      if (/downloading/.test(step)) {   // can the page itself reach the zip?
        try { const z = await fetch(m_url(step), { cache: 'no-store' }); more = ' | page fetch: HTTP ' + z.status + ', ' + (await z.arrayBuffer()).byteLength + ' bytes'; }
        catch (e2) { more = ' | page fetch failed: ' + String(e2 && e2.message || e2).slice(0, 60); }
      }
      let raw = ''; try { raw = JSON.stringify(e).slice(0, 160); } catch (e3) { /* not serialisable */ }
      UPDI.web = 'Web update failed while ' + step + ': ' + String((e && (e.message || e.errorMessage || e.code)) || e).slice(0, 100) + ' ' + raw + more;
    }
    try {   // 2) new APK, at most once a day unless asked
      const last = +store.get('apkChecked') || 0;
      if (manual || Date.now() - last > 864e5) {
        const rel = (await (await fetch(RELEASES_URL)).json())[0];
        store.set('apkChecked', Date.now());
        const n = rel && /^build-(\d+)$/.exec(rel.tag_name);
        const a = rel && (rel.assets || []).find(x => /\.apk$/.test(x.name));
        UPDI.apk = n && a && 100000 + +n[1] > UPDI.build ? { tag: rel.tag_name, url: a.browser_download_url } : null;
      }
    } catch (e) { /* offline: try tomorrow */ }
  } finally { UPDI.busy = false; changed(); }
}
function updateBoot() { if (NATIVE) setTimeout(() => checkUpdates(false), 5000); }

/* Google sign-in returns to the app through the app.carrel.study://auth deep link. */
if (NATIVE && CAP.App) {
  CAP.App.addListener('appUrlOpen', async ({ url }) => {
    if (!url || url.indexOf(APP_SCHEME + '://') !== 0) return;
    try { if (CAP.Browser) await CAP.Browser.close(); } catch (e) { /* already closed */ }
    const code = (url.match(/[?&]code=([^&#]+)/) || [])[1];
    const err = (url.match(/[?&]error_description=([^&#]+)/) || [])[1];
    if (err) { toast('Sign-in failed: ' + decodeURIComponent(err.replace(/\+/g, ' '))); return; }
    if (code && sb) {
      const r = await sb.auth.exchangeCodeForSession(decodeURIComponent(code));
      if (r.error) toast('Sign-in failed: ' + r.error.message);
    }
  });
}
