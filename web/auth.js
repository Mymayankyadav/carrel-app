/* ===== sign-in and session ===== */
const MOCK = typeof window !== 'undefined' && typeof window.__mockDocs !== 'undefined';
let sb = null;

function teardownDb(clearData) {
  S.unsubs.forEach(u => { try { u(); } catch (e) { /* already closed */ } });
  S.unsubs = [];
  if (S.db && S.db.close) { try { S.db.close(); } catch (e) { /* closed */ } }
  if (clearData && S.db && S.db.clear) S.db.clear();
  S.db = null; S.uid = null; S.user = null;
  if (clearData) {
    S.base = { current: undefined, activities: undefined, settings: undefined, days: {}, plans: {}, reviews: [], planning: {} };
    S.loaded = { current: false, activities: false, settings: false, days: false, plans: false, reviews: false, planning: false };
    S.pending = []; savePending(); S.fetched = new Set(); UNDO.length = 0; UI.sheet = null;
  }
}
function showSignedOut() {
  S.conn = 'none';
  recompute(); render();
}
function openDb(session) {
  if (S.db && S.uid === session.user.id) return;
  teardownDb(false);
  S.uid = session.user.id; S.user = session.user;
  S.db = makeDb(sb, S.uid, { idb: true, refresh: async () => { const r = await sb.auth.refreshSession(); if (r.error) throw r.error; } });
  S.dl = DL; S.owner = true; S.conn = 'live'; S.offline = false;
  subscribe(); pumpAll(); nativeBoot();
  let tries = 0;
  const tzTimer = setInterval(() => {
    if (++tries > 30 || !S.db) return clearInterval(tzTimer);
    if (S.loaded.settings) {
      clearInterval(tzTimer);
      if (!S.base.settings || !S.base.settings.tz) { try { saveSetting({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata' }); } catch (e) { /* later */ } }
    }
  }, 2000);
  recompute(); render();
}
async function startMock() {
  const cl = window.claude;
  const [db, user, dl] = await Promise.all([cl.use('db'), cl.use('user').catch(() => null), cl.use('downloads').catch(() => null)]);
  S.db = db; S.user = user; S.dl = dl; S.conn = 'live'; S.owner = true;
  subscribe(); pumpAll();
  cl.use('mcp').then(m => { S.mcp = m || null; if (S.mcp) gcWatch(); changed(); }).catch(() => { S.mcp = null; });
  recompute(); render();
}
async function startSession() {
  if (MOCK) return startMock();
  if (typeof supabase === 'undefined' || !supabase.createClient) { showSignedOut(); return; }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: !NATIVE } });
  sb.auth.onAuthStateChange((ev, session) => {
    // Never call auth methods synchronously inside this callback.
    setTimeout(() => {
      if (ev === 'SIGNED_OUT') { teardownDb(true); nativeClear(); showSignedOut(); }
      else if (session) {
        nativeSession(session);
        if (ev === 'INITIAL_SESSION' || ev === 'SIGNED_IN') openDb(session);
        if (S.conn === 'readonly') { S.conn = 'live'; pumpAll(); changed(); }
      } else if (ev === 'INITIAL_SESSION') showSignedOut();
    }, 0);
  });
}
Object.assign(ACT, {
  async signin() {
    if (!sb) { toast('Sign-in isn’t available in this view.'); return; }
    const redirectTo = NATIVE ? APP_SCHEME + '://auth' : location.origin + location.pathname;
    const r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: NATIVE, queryParams: { prompt: 'select_account' } } });
    if (r.error) { toast('Sign-in failed: ' + r.error.message); return; }
    if (NATIVE) await Capacitor.Plugins.Browser.open({ url: r.data.url });
  },
  async signout() {
    if (sb) await sb.auth.signOut();
  }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.db && S.db.refresh) S.db.refresh(); });
window.addEventListener('online', () => { if (S.db && S.db.refresh) S.db.refresh(); });
