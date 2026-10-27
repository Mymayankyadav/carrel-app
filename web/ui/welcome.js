/* R0a: original onboarding UI; W1 will simplify. */
function vNoActs() {
  return `<section class="banner"><h3>Set up your activities</h3><p>Carrel has nothing to track yet. Add the starter set (Study plus everyday activities like sleep, meals and breaks) and rename anything later in Setup.</p><div class="row"><button type="button" class="btn lamp" data-act="starter">Add the starter set</button><button type="button" class="btn" data-act="setup">Open Setup</button></div></section>`;
}
function vOnboard() {
  if (CFG.onboarded) return '';
  const studies = ACTS.filter(a => a.kind === 'study' && !a.archived);
  const names = new Set(studies.map(a => a.name.toLowerCase()));
  const sugg = SUGGEST.filter(n => !names.has(n.toLowerCase())).slice(0, 8);
  return `<section class="banner" aria-labelledby="onb-h">
    <h3 id="onb-h">What are you studying?</h3>
    <p>Add each subject or course, so timers, plans and patterns can tell them apart. Everyday activities like sleep, meals and breaks are already set up.</p>
    <form class="row" data-submit="onb-add"><input class="inp" id="onb-text" style="flex:1 1 220px;width:auto" placeholder="e.g. Organic chemistry, Calculus" data-bind="onbText" value="${esc(UI.onbText)}" autocomplete="off" aria-label="Subjects, separated by commas"><button class="btn lamp" type="submit">Add</button></form>
    ${sugg.length ? `<div class="chips">${sugg.map(n => `<button type="button" class="chip-btn" data-act="onb-chip" data-name="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>` : ''}
    <div class="row"><span class="muted" style="font-size:13px;flex:1 1 200px">Studying: ${studies.map(a => esc(a.name)).join(', ') || 'nothing yet'}</span><button type="button" class="btn sm" data-act="onb-done">Done</button></div>
  </section>`;
}

VIEWS.welcome = () => vNotices();
