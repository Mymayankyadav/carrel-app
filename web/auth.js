/* ===== sign-in and session ===== */
const MOCK = typeof window !== 'undefined' && typeof window.__mockDocs !== 'undefined';
let sb = null;
let recoverT = 0;

// An IndexedDB deletion can fail even after sign-out succeeds. Keep a
// device-local cleanup obligation until its transaction actually commits.
// This is not synced to Supabase and never includes document contents.
const a1CleanupKey = 'cacheClearPending';
let a1CleanupPending = store.get(a1CleanupKey);
a1CleanupPending = Array.isArray(a1CleanupPending) ?
  [...new Set(a1CleanupPending.filter(id => typeof id === 'string' && id.length > 0 && id.length <= 128))] : [];
const a1CleanupBusy = new Set(), a1CleanupVersions = new Map();
function a1SaveCleanup() { store.set(a1CleanupKey, a1CleanupPending.length ? a1CleanupPending : null); }
function a1ClearCache(uid, clear) {
  if (!uid) return Promise.resolve(true);
  if (!a1CleanupPending.includes(uid)) a1CleanupPending.push(uid);
  a1SaveCleanup(); // Record intent BEFORE starting the asynchronous deletion.
  const version = (a1CleanupVersions.get(uid) || 0) + 1;
  a1CleanupVersions.set(uid, version);
  a1CleanupBusy.add(uid);
  let work;
  try { work = clear(); } catch (e) { work = false; }
  return Promise.resolve(work).then(ok => ok === true, () => false).then(ok => {
    // An older completion cannot acknowledge a newer sign-out for this UID.
    if (a1CleanupVersions.get(uid) === version) {
      a1CleanupBusy.delete(uid);
      if (ok) {
        a1CleanupPending = a1CleanupPending.filter(id => id !== uid);
        a1SaveCleanup();
      }
      if (S.conn === 'none') render();
    }
    return ok;
  });
}


// Retry expired auth without requiring a page reload. Only a confirmed
// refreshed session can make a read-only connection writable again.
function recoverAuth(delay = 30000) {
  if (!sb || !S.db || S.conn !== 'readonly' || recoverT) return;
  recoverT = setTimeout(async () => {
    recoverT = 0;
    if (!sb || !S.db || S.conn !== 'readonly') return;
    const db = S.db, uid = S.uid;
    try {
      const r = await sb.auth.refreshSession();
      // Auth refresh can finish after a different user signs in.
      if (S.db !== db || S.uid !== uid || S.conn !== 'readonly') return;
      if (!r.error && r.data && r.data.session &&
          r.data.session.user && r.data.session.user.id === uid) {
        S.conn = 'live'; S.offline = false;
        pumpAll();
        if (S.db && S.db.refresh) S.db.refresh();
        changed();
        return;
      }
    } catch (e) { /* offline; retry later */ }
    if (S.conn === 'readonly') recoverAuth();
  }, delay);
}

function teardownDb(clearData) {
  // A SIGNED_IN event can switch accounts without a SIGNED_OUT event.
  // Preserve unsent writes under the OLD uid (unless explicitly signing out)
  // before replacing the adapter, then isolate the new account completely.
  const oldUid = S.uid, oldDb = S.db;
  let cacheClearResult = Promise.resolve(true);
  if (oldUid) {
    if (clearData) store.set('pending:' + oldUid, null);
    else savePending();
  }
  clearTimeout(recoverT); recoverT = 0;
  clearTimeout(S.resubT); S.resubT = 0;
  S.unsubs.forEach(u => { try { u(); } catch (e) { /* already closed */ } });
  S.unsubs = [];
  if (S.db && S.db.close) { try { S.db.close(); } catch (e) { /* closed */ } }
  if (clearData && oldDb && oldDb.clear) {
    cacheClearResult = a1ClearCache(oldUid, () => oldDb.clear());
  }
  S.db = null; S.uid = null; S.user = null;
  // In-flight completions from the old adapter are fenced in pump().
  S.pending = []; S.inflight.clear();
  for (const path of Object.keys(retryT)) { clearTimeout(retryT[path]); delete retryT[path]; }
  S.base = { current: undefined, activities: undefined, settings: undefined, days: {}, plans: {}, reviews: [], planning: {}, distractions: {}, topics: {}, rituals: {}, coach: {}, usage: {} };
  S.loaded = { current: false, activities: false, settings: false, days: false, plans: false, reviews: false, planning: false, distractions: false, topics: false, rituals: false, coach: false, usage: false };
  S.fetched = new Set(); S.offline = false;
  // Preserve the URL-selected initial tab on first sign-in, but never keep
  // an outgoing account's sheet or page parameters across a switch.
  if (oldUid || clearData) {
    UNDO.length = 0; UI.sheet = null;
    if (Array.isArray(UI.pages)) UI.pages = [];
    UI.view = 'today';
  }
  return cacheClearResult;
}
function showSignedOut() {
  S.conn = 'none';
  recompute(); render();
}
function openDb(session) {
  if (S.db && S.uid === session.user.id) return;
  teardownDb(false);
  S.uid = session.user.id; S.user = session.user;
  // Never hydrate an old on-device snapshot while a failed sign-out
  // deletion is pending for this account. Network data remains available.
  S.db = makeDb(sb, S.uid, { idb: !a1CleanupPending.includes(S.uid), refresh: async () => { const r = await sb.auth.refreshSession(); if (r.error) throw r.error; } });
  restorePending(); // only this user's queue; never the legacy unowned queue
  S.dl = DL; S.owner = true; S.conn = 'live'; S.offline = false;
  subscribe(); pumpAll(); nativeBoot();
  let tries = 0;
  const uid = S.uid, db = S.db;
  const tzTimer = setInterval(() => {
    if (++tries > 30 || S.db !== db || S.uid !== uid) return clearInterval(tzTimer);
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
  await adoptNativeSession();
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
    if (!sb) return;
    if (S.pending.length) {
      pumpAll();
      const deadline = Date.now() + 3000;
      while (S.pending.length && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (S.pending.length && !await confirmDialog({title:'Unsaved changes',text:S.pending.length+' waiting. Discard and sign out?',ok:'Sign out',danger:true})) return;
    }
    const r = await sb.auth.signOut();
    if (r.error) toast('Could not sign out: ' + r.error.message);
  },
  async 'a1-retry-cache-clear'() {
    // Only run while signed out: do not erase an active account's cache.
    if (S.conn !== 'none' || S.db) return;
    const ids = a1CleanupPending.filter(id => !a1CleanupBusy.has(id));
    await Promise.all(ids.map(id => a1ClearCache(id, () => {
      const cleanup = makeDb(null, id, { idb: true, clearOnly: true });
      cleanup.close();
      return cleanup.clear();
    })));
  },
  'a1-reconnect'() {
    clearTimeout(recoverT); recoverT = 0;
    recoverAuth(0);
  },
  async 'a1-recover-legacy-pending'() {
    const uid = S.uid, old = store.get('pending');
    if (!uid || !S.db || S.conn === 'readonly' || !Array.isArray(old) || !old.length) return;
    const ok = await confirmDialog({
      title: 'Older offline edits',
      text: old.length + ' unsent edits from an older version have no account label. Restore only if they belong to this signed-in account.',
      ok: 'Restore here', danger: true
    });
    if (!ok || S.uid !== uid || !S.db || S.conn === 'readonly') return;
    const count = importLegacyPending();
    toast(count > 0 ? count + ' edits queued for this account.' :
      'Could not restore. Older edits were kept on this device.');
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (S.db && S.db.refresh) S.db.refresh();
  if (S.conn === 'readonly') recoverAuth(0);
});
window.addEventListener('online', () => {
  if (S.db && S.db.refresh) S.db.refresh();
  if (S.conn === 'readonly') recoverAuth(0);
  else pumpAll();
});
