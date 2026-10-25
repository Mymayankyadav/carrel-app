/* ===== start ===== */
try {
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => ({ view: UI.view, date: UI.date }));
  if (hot && typeof hot.ready === 'function') hot.ready(boot); else boot(hot && hot.data ? hot.data : {});
} catch (e) { boot({}); }
