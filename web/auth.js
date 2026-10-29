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
// A failed outbox deletion must not silently resurrect discarded edits.
// The session-specific queue key also prevents replay after a fresh login,
// even if localStorage rejects both deletion and this cleanup marker.
const a1PendingClearKey = 'pendingClearFailed';
let a1PendingClearFailed = store.get(a1PendingClearKey);
a1PendingClearFailed = new Set(Array.isArray(a1PendingClearFailed) ?
  a1PendingClearFailed.filter(k => typeof k === 'string' &&
    /^pending:[a-zA-Z0-9_-]{1,128}(?::[a-zA-Z0-9_-]{1,128})?$/.test(k)) : []);
function a1SavePendingClear() {
  return store.set(a1PendingClearKey,
    a1PendingClearFailed.size ? [...a1PendingClearFailed] : null);
}
function a1SessionKey(session) {
  try {
    const parts = session && session.access_token && session.access_token.split('.');
    const body = parts && parts[1] && JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (body && typeof body.session_id === 'string' &&
        /^[a-zA-Z0-9_-]{8,128}$/.test(body.session_id)) return body.session_id;
  } catch (e) { /* old or malformed session token: use a non-reusable key */ }
  // No trustworthy stable session identifier: preserve edits on disk, but
  // require manual recovery after a reload rather than risk a signed-out replay.
  return 'ephemeral-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function a1DiscardPending(uid, activeKey) {
  if (!uid) return true;
  const keys = [...new Set(['pending:' + uid, activeKey].filter(Boolean))];
  for (const key of keys) a1PendingClearFailed.add(key);
  a1SavePendingClear(); // Best effort: localStorage itself may be unavailable.
  let ok = true;
  for (const key of keys) {
    if (store.set(key, null) === false) ok = false;
    else a1PendingClearFailed.delete(key);
  }
  a1SavePendingClear();
  return ok;
}
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
    if (clearData) a1DiscardPending(oldUid, pendingStoreKey());
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
  S.db = null; S.uid = null; S.user = null; S.pendingSession = null;
  // In-flight completions from the old adapter are fenced in pump().
  S.pending = []; S.inflight.clear(); S.pendingStorageError = null; S.pendingAckStorageError = null;
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
  S.pendingSession = a1SessionKey(session);
  // Never hydrate an old on-device snapshot while a failed sign-out
  // deletion is pending for this account. Network data remains available.
  S.db = makeDb(sb, S.uid, { idb: true, skipHydrate: a1CleanupPending.includes(S.uid), refresh: async () => { const r = await sb.auth.refreshSession(); if (r.error) throw r.error; } });
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
  // Supabase emits auth events synchronously, but their handlers must run
  // outside its callback. Drain a single ordered batch so independently
  // deferred handlers cannot run out of order and restore an older account.
  let explicitAuthSeen = false, authScheduled = false;
  const authEvents = [];
  function drainAuthEvents() {
    authScheduled = false;
    const batch = authEvents.splice(0);
    // Coalesce superseded sign-ins and metadata before the latest explicit
    // transition. Never coalesce SIGNED_OUT: it must clear the old account's
    // offline cache even when another account signs in immediately afterward.
    const latestExplicit = batch.reduce((last, item, i) =>
      item.ev === 'SIGNED_IN' || item.ev === 'SIGNED_OUT' ? i : last, -1);
    let batchSigninUid = null;
    batch.forEach(({ ev, session }, i) => {
      // Track even skipped sign-ins: SIGNED_OUT applies to the last actual
      // signed-in UID, not necessarily the account currently open in the UI.
      if (ev === 'SIGNED_IN' && session && session.user && session.user.id)
        batchSigninUid = session.user.id;
      if (ev === 'INITIAL_SESSION' && (explicitAuthSeen || S.db)) return;
      if (i < latestExplicit && ev !== 'SIGNED_OUT') return;
      if (ev === 'SIGNED_OUT') {
        const signedOutUid = batchSigninUid || S.uid;
        batchSigninUid = null;
        if (signedOutUid && (signedOutUid !== S.uid || !S.db)) {
          // The signed-out account was coalesced before opening. Preserve the
          // previous account's queue, but delete the signed-out UID's cache
          // and unsent edits without hydrating or connecting to Supabase.
          teardownDb(false);
          a1DiscardPending(signedOutUid, null);
          a1ClearCache(signedOutUid, () => {
            const cleanup = makeDb(null, signedOutUid, { idb: true, clearOnly: true });
            cleanup.close();
            return cleanup.clear();
          });
        } else teardownDb(true);
        nativeClear(); showSignedOut();
        return;
      }
      const uid = session && session.user && session.user.id;
      if (!uid) {
        if (ev === 'INITIAL_SESSION') showSignedOut();
        return;
      }
      if (ev === 'INITIAL_SESSION' || ev === 'SIGNED_IN') {
        // Only bootstrap and explicit sign-in can establish identity.
        nativeSession(session);
        openDb(session);
        if (S.db && S.uid === uid && S.conn === 'readonly') {
          S.conn = 'live'; pumpAll(); changed();
        }
      } else if (S.db && S.uid === uid) {
        // Metadata from an outgoing UID cannot alter the active credentials.
        nativeSession(session);
        if (ev === 'TOKEN_REFRESHED' && S.conn === 'readonly') {
          S.conn = 'live'; pumpAll(); changed();
        }
      }
    });
  }
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') explicitAuthSeen = true;
    authEvents.push({ ev, session });
    if (!authScheduled) {
      authScheduled = true;
      setTimeout(drainAuthEvents, 0);
    }
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
  'a1-retry-pending-clear'() {
    if (S.conn !== 'none' || S.db) return;
    for (const key of [...a1PendingClearFailed]) {
      if (store.set(key, null) !== false) a1PendingClearFailed.delete(key);
    }
    a1SavePendingClear();
    render();
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
    const uid = S.uid, scopedKey = uid && 'pending:' + uid;
    const scoped = scopedKey && !a1PendingClearFailed.has(scopedKey) && store.get(scopedKey);
    const old = Array.isArray(scoped) && scoped.length ? scoped : store.get('pending');
    if (!uid || !S.db || S.conn === 'readonly' || !Array.isArray(old) || !old.length) return;
    const ok = await confirmDialog({
      title: 'Older offline edits',
      text: old.length + ' older unsent edits are on this device. Restore only if they belong to this session; a previous sign-out may have discarded them.',
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
