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
const NP = { vibrateFocus: true, vibrateBreak: false, respectDnd: true, privacy: false, notifDistractions: false, notifications: true, exactAlarms: true };
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
  if (CL.consumeIncoming) {
    CL.addListener('incoming', l8ReceiveIncoming);
    CL.consumeIncoming().then(l8ReceiveIncoming).catch(() => {});
  }
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

// Retained bridge contract; Settings owns the Notifications entry.
function vPhonePanel() { return ''; }
function npSetPref(key) {
  if (!['vibrateFocus','vibrateBreak','respectDnd','privacy','notifDistractions'].includes(key)) return;
  NP[key] = !NP[key];
  if (CL) CL.setPrefs({ [key]: NP[key] }).then(p => { Object.assign(NP, p); changed(); })
    .catch(() => { NP[key] = !NP[key]; changed(); });
  changed();
}
Object.assign(ACT, {
  'np-toggle'(el) { npSetPref(el.getAttribute('data-k')); },
  'np-open'() { if (typeof openPage === 'function') openPage('settings','settings.notifications'); },
  'np-notif'() { if (CL) CL.requestNotifications().then(p => { Object.assign(NP, p); changed(); }).catch(() => {}); },
  'np-test'() { if (CL) CL.testNudge().then(p => { Object.assign(NP, p); changed(); }).catch(() => toast('Could not test the buzz.')); },
  'np-check'() { if (CL) CL.getPrefs().then(p => { Object.assign(NP, p); changed(); }).catch(() => {}); },
  'upd-check'() { checkUpdates(true); },
  'upd-restart'() {
    if (UPD && typeof UPD.reload === 'function') UPD.reload().catch(() => toast('Reopen Carrel to update.'));
    else toast('Reopen Carrel to update.');
  },
  'upd-apk'() { if (UPDI.apk && CAP.Browser) CAP.Browser.open({ url: UPDI.apk.url }); },
  'np-exact'() { if (CL) CL.openExactAlarmSettings(); },
  'np-battery'() { if (CL) CL.openBatterySettings().then(r => { if (r && r.help) toast(r.help); }).catch(() => {}); }
});

// Registered only once the R0a shell is present (R5 can still land independently).
if (typeof PAGES !== 'undefined') {
  const phoneToggle = (key, label) => kRow({
    label, right:kSwitch({act:'np-'+key,on:!!NP[key],label})
  });
  PAGES['settings.notifications'] = {
    title:()=>'Notifications',
    render:() => {
      if (!CL) return kEmpty('Available on Android');
      const permission = NP.notifications === false
        ? kRow({label:'Notifications blocked',right:kBtn('Allow','data-act="np-notif"',{kind:'text'})}) : '';
      const options = [
        phoneToggle('vibrateFocus','Vibrate when focus ends'),
        phoneToggle('vibrateBreak','Vibrate when a break ends'),
        phoneToggle('respectDnd','Quiet in Do Not Disturb'),
        phoneToggle('privacy','Hide on lock screen'),
        phoneToggle('notifDistractions','Noticed buttons')
      ].join('');
      const troubleshoot =
        kRow({label:'Exact alarms',value:NP.exactAlarms?'Allowed':'Not allowed',open:true,attrs:'data-act="np-exact"'})+
        kRow({label:'Background activity',open:true,attrs:'data-act="np-battery"'})+
        kRow({label:'Test vibration',value:NP.lastNudge||'',open:true,attrs:'data-act="np-test"'});
      return permission+kGroup('',options)+kCollapse('np-troubleshoot','Troubleshoot',troubleshoot);
    }
  };
  ['vibrateFocus','vibrateBreak','respectDnd','privacy','notifDistractions'].forEach(key => {
    ACT['np-'+key] = () => npSetPref(key);
  });
}

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
        else if (store.get('updReady') === m.version) { UPDI.web = 'Update ready'; toast('Update ready', { persist:true, action:{label:'Restart',act:'upd-restart'} }); }
        else {
          step = 'downloading ' + m.version;
          if (!m.checksum) throw new Error('latest.json has no checksum');
          const b = await UPD.download({ url: m.url, version: m.version, checksum: m.checksum });
          step = 'switching to ' + m.version;
          await UPD.next({ id: b.id });
          store.set('updReady', m.version);
          UPDI.web = 'Update ready';
          toast('Update ready', { persist:true, action:{label:'Restart',act:'upd-restart'} });
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
  CAP.App.addListener('backButton', () => {
    if (typeof goBack === 'function' && goBack()) return;
    if (typeof CAP.App.minimizeApp === 'function') CAP.App.minimizeApp();
  });
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

/* L8: Android shares/shortcuts are delivered by the native plugin with durable ack.
 * Never write a task just because the user shared text; open Quick Capture to review. */
let l8Incoming = null, l8Retry = null;
function l8ReceiveIncoming(item) {
  if (!item || !item.id || !['capture','start'].includes(item.kind)) return;
  if (l8Incoming && l8Incoming.id === item.id) return;
  l8Incoming = item;
  l8FlushIncoming();
}
function l8FlushIncoming() {
  if (!l8Incoming) return;
  if (typeof S === 'undefined' || !S.db || !S.loaded || !S.loaded.activities ||
      !S.loaded.current || typeof UI === 'undefined') {
    if (!l8Retry && typeof setTimeout === 'function')
      l8Retry = setTimeout(() => { l8Retry = null; l8FlushIncoming(); }, 500);
    return;
  }
  const item = l8Incoming;
  l8Incoming = null;
  if (item.kind === 'capture') {
    if (typeof l9OpenCapture === 'function') l9OpenCapture(String(item.value || '').slice(0,500));
  } else if (item.kind === 'start') {
    const last = typeof lastEntry === 'function' ? lastEntry() : null;
    const id = item.value === 'last' ? (last && last.a) || (ACTS.find(a=>a.kind==='study'&&!a.archived)||{}).id : item.value;
    if (id && ACTMAP[id] && ACTMAP[id].kind === 'study' && !ACTMAP[id].archived && typeof startActivity === 'function') {
      startActivity(id);
    } else if (typeof toast === 'function') toast('That subject is not available.');
  }
  if (CL && CL.ackIncoming) CL.ackIncoming({id:item.id}).catch(() => {});
}
