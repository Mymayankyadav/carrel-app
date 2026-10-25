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

/* Hooks used by auth.js. The notification plugin fills these in (Phase 5). */
function nativeBoot() { if (CL && CL.configure) CL.configure({ url: SUPABASE_URL, key: SUPABASE_KEY }); }
function nativeSession(session) {
  if (CL && CL.setSession) CL.setSession({ access: session.access_token, refresh: session.refresh_token, expiresAt: (session.expires_at || 0) * 1000 });
}
function nativeClear() { if (CL && CL.clearSession) CL.clearSession(); }

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
