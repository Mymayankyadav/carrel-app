/* W1 — signed-out welcome and subject onboarding (no network writes from render). */
function w1Studies() {
  return ACTS.filter(a => a.kind === 'study' && !a.archived);
}
function w1NeedsSetup() {
  return !CFG.onboarded || !w1Studies().length;
}
function w1Welcome() {
  const blocked = S.conn !== 'none' && !S.owner;
  return '<div class="w1-auth" aria-label="Welcome to Carrel">' +
    '<div class="w1-auth-inner"><i class="w1-mark" aria-hidden="true"></i>' +
    '<h1 class="w1-name">Carrel</h1>' +
    (blocked ?
      '<p class="w1-private">This tracker is private</p>' +
      kBtn('Sign out','data-act="signout"',{kind:'text'}) :
      kBtn('Continue with Google','data-act="signin"',{kind:'primary',icon:'signin'})) +
    '</div></div>';
}
/* Whitespace, duplicate and case-safe suggestions. The original onb-add/onb-chip
 * actions perform the writes and onb-done persists the completion flag. */
function w1FirstRun() {
  const studies = w1Studies(), names = new Set(studies.map(a => a.name.toLocaleLowerCase()));
  const suggested = SUGGEST.filter(n => !names.has(n.toLocaleLowerCase())).slice(0,8);
  const chips = studies.map(a =>
    '<button type="button" class="w1-chip" data-act="w1-remove" data-id="' + esc(a.id) +
    '" aria-label="Remove '+esc(a.name)+'" title="Remove '+esc(a.name)+'">' +
    '<span class="w1-chip-name">'+esc(a.name)+'</span>'+icon('close')+'</button>').join('');
  const suggestions = suggested.map(n =>
    '<button type="button" class="w1-suggest" data-act="onb-chip" data-name="'+esc(n)+'" aria-label="Add '+esc(n)+'" title="Add '+esc(n)+'">' +
    icon('add')+esc(n)+'</button>').join('');
  return '<section class="w1-setup" aria-labelledby="w1-heading">' +
    '<h1 class="w1-heading" id="w1-heading">What do you study?</h1>' +
    '<form class="w1-add-form" data-submit="onb-add">' +
    '<input class="k-input w1-subject-input" id="onb-text" data-bind="onbText" type="text" value="'+esc(UI.onbText||'')+'" placeholder="Add a subject" aria-label="Add a subject" autocomplete="off" enterkeyhint="done" maxlength="300">' +
    '<button type="submit" class="w1-add-btn" aria-label="Add subject" title="Add subject">'+icon('add')+'</button>' +
    '</form>' +
    (chips ? '<div class="w1-added" aria-label="Your subjects">'+chips+'</div>' : '') +
    (suggestions ? '<div class="w1-suggestions" aria-label="Suggested subjects">'+suggestions+'</div>' : '') +
    kBtn('Continue','data-act="onb-done"'+(studies.length?'':' disabled'),{kind:'primary'}) +
    '</section>';
}
/* Legacy Today continues calling these until T1 replaces the old screen.
 * In T1 the first-run route should take over the entire Today screen. */
function vNoActs() { return w1FirstRun(); }
function vOnboard() { return w1NeedsSetup() ? w1FirstRun() : ''; }
VIEWS.welcome = w1Welcome;
Object.assign(ACT, {
  'w1-remove'(el) {
    const id=el.getAttribute('data-id');
    const a=ACTMAP[id];
    if(!a || a.kind!=='study' || a.archived) return;
    saveAct(id,{archived:true});
  }
});
