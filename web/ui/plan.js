/* ---------- views: plan ---------- */
function planDisplayRows(pm) {
  const done = pm.rows.filter(r => !(r.remaining > 0));
  const live = pm.rows.filter(r => r.remaining > 0);
  const time = r => r.st === 'active' ? -Infinity : r.pieces.length ? r.pieces[0][0] : Infinity;
  live.sort((a, b) => (time(a) - time(b)) || (a.order - b.order) || a.id.localeCompare(b.id));
  return done.concat(live);
}
VIEWS.plan = () => vCalendar();
