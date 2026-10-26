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
  return `<div class="setsec"><h3>Phone notification</h3>
    <p class="note-line">The running timer in your notification shade, with Urge, Drifted, Park, Stop and Take break buttons.</p>
    ${NP.notifications === false ? `<div class="row"><span class="note-line">Notifications are off for Carrel.</span><button type="button" class="btn sm" data-act="np-notif">Allow</button></div>` : ''}
    ${row('vibrateFocus', 'Gentle vibration when focus time ends')}
    ${row('vibrateBreak', 'Gentle vibration when a break ends')}
    ${row('respectDnd', 'Stay quiet in Do Not Disturb')}
    ${row('privacy', 'Hide details on the lock screen')}
    <div class="row"><span class="note-line">${NP.exactAlarms === false ? 'Exact alarms are off, so the vibration can arrive a few minutes late.' : 'Exact alarms are allowed.'}</span><button type="button" class="btn sm" data-act="np-exact">Open settings</button></div>
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
  'np-exact'() { if (CL) CL.openExactAlarmSettings(); },
  'np-battery'() { if (CL) CL.openBatterySettings().then(r => { if (r && r.help) toast(r.help); }).catch(() => {}); }
});

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
