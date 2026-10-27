function sSetup() {
  // Registered lazily: ACT is declared after the views section.
  Object.assign(ACT, {
    'a6-jump'(el) {
      const id = el.getAttribute('data-target');
      if (!/^(activities|timer|day|phone|data)$/.test(id)) return;
      const target = document.getElementById('setsec-' + id);
      if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });
  const study = ACTS.filter(a => a.kind === 'study'), life = ACTS.filter(a => a.kind !== 'study');
  const row = a => `<div class="arow ${a.archived ? 'arch' : ''}" style="--c:${a.color}" data-key="a-${esc(a.id)}">
      <button type="button" class="swatch" data-act="act-color" data-id="${esc(a.id)}" aria-label="Change color of ${esc(a.name)}"></button>
      <input class="inp" id="an-${esc(a.id)}" data-change="act-name" data-id="${esc(a.id)}" value="${esc(a.name)}" maxlength="40" aria-label="Name">
      <span class="tools">
        <button type="button" class="icon-btn" data-act="act-move" data-id="${esc(a.id)}" data-d="-1" aria-label="Move ${esc(a.name)} up">${icon('up')}</button>
        <button type="button" class="icon-btn" data-act="act-move" data-id="${esc(a.id)}" data-d="1" aria-label="Move ${esc(a.name)} down">${icon('down')}</button>
        <button type="button" class="icon-btn" data-act="act-arch" data-id="${esc(a.id)}" aria-label="${a.archived ? 'Restore' : 'Archive'} ${esc(a.name)}" title="${a.archived ? 'Restore' : 'Archive (keeps its history)'}">${a.archived ? icon('undo') : icon('archive')}</button>
      </span>
      <span class="arow-sub"><span class="seg"><button type="button" class="${a.kind === 'study' ? 'on' : ''}" data-act="act-kind" data-id="${esc(a.id)}" data-k="study">Study</button><button type="button" class="${a.kind !== 'study' ? 'on' : ''}" data-act="act-kind" data-id="${esc(a.id)}" data-k="life">Life</button></span>
      ${a.kind === 'study' ? `<label>Weekly goal <input type="number" class="inp sm goal" min="0" max="80" step="0.5" id="ag-${esc(a.id)}" data-change="act-goal" data-id="${esc(a.id)}" value="${a.goal ? +(a.goal / 60).toFixed(1) : ''}" placeholder="–"> h</label>` : ''}
      ${a.role === 'break' ? '<span class="tag brass">break</span>' : ''}${a.role === 'sleep' ? '<span class="tag">sleep</span>' : ''}${a.role === 'drift' ? '<span class="tag">drift</span>' : ''}</span>
    </div>`;
  const shown = l => l.filter(a => UI.showArchived || !a.archived);
  const arch = ACTS.filter(a => a.archived).length;
  const pd = CFG.pomodoro;
  const num = (f, v, min, max, step, lbl, suf) => `<label class="field"><span>${lbl}</span><input type="number" class="inp" id="set-${f}" data-change="set-num" data-f="${f}" min="${min}" max="${max}" step="${step}" value="${esc(v)}"${suf ? ` aria-label="${lbl} (${suf})"` : ''}></label>`;
  const nd = Object.keys(V.days || {}).length;
  const ne = ENTRIES.filter(e => !e.running).length;
  return `<div class="sh-head"><h2 id="sh-title">Setup</h2><button type="button" class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('x')}</button></div>
    <nav class="set-jump" aria-label="Setup sections">${[['activities','Activities'],['timer','Timer'],['day','Day'],['phone','Phone'],['data','Data']].map(([id, label]) => `<button type="button" class="chip-btn" data-act="a6-jump" data-target="${id}">${label}</button>`).join('')}</nav>
    <div id="setsec-activities" class="setsec" style="border-top:0;padding-top:0"><h3>Activities</h3><p class="note-line">Study activities count toward study time, goals and streaks. Archiving hides an activity but keeps its history.</p>
      <span class="lbl">Study</span><div>${shown(study).map(row).join('') || '<p class="note-line">No study activities yet.</p>'}</div>
      <span class="lbl">Life</span><div>${shown(life).map(row).join('')}</div>
      <form class="row" data-submit="act-add"><input class="inp" id="na-name" style="flex:1 1 180px;width:auto" maxlength="40" placeholder="New activity" data-bind="newAct.name" value="${esc(UI.newAct.name)}" autocomplete="off" aria-label="New activity name"><span class="seg"><button type="button" class="${UI.newAct.kind === 'study' ? 'on' : ''}" data-act="na-kind" data-k="study">Study</button><button type="button" class="${UI.newAct.kind !== 'study' ? 'on' : ''}" data-act="na-kind" data-k="life">Life</button></span><button type="submit" class="btn sm lamp">${icon('plus')}Add</button></form>
      ${arch ? `<button type="button" class="btn sm ghost" data-act="show-arch" style="justify-self:start">${UI.showArchived ? 'Hide' : 'Show'} ${arch} archived</button>` : ''}
    </div>
    <div class="setsec" id="setsec-timer"><h3>Pomodoro</h3><p class="note-line">Silent by design. When a focus block ends, the timer turns brass and waits; time keeps counting as study until you take the break.</p>
      <div class="chips">${Object.keys(PRESETS).concat(['1/1']).map(p => `<button type="button" class="chip-btn ${presetLabel(pd) === p ? 'on' : ''}" data-act="preset-apply" data-p="${p}">${p === '1/1' ? '1/1 test' : p}</button>`).join('')}</div>
      <div class="g2">${num('focus', pd.focus, 1, 180, 1, 'Focus minutes')}${num('short', pd.short, 1, 60, 1, 'Short break')}${num('long', pd.long, 1, 90, 1, 'Long break')}${num('every', pd.every, 2, 8, 1, 'Long break every')}</div>
    </div>
    <div class="setsec" id="setsec-day"><h3>Your day</h3>
      <div class="g2">
        <label class="field"><span>A new day starts at</span><input type="time" class="inp" id="set-dayStart" data-change="set-time" data-f="dayStart" value="${esc(CFG.dayStart)}"></label>
        <label class="field"><span>Daily study goal (hours)</span><input type="number" class="inp" id="set-goal" data-change="set-goal" min="0" max="16" step="0.25" value="${+(CFG.dailyGoal / 60).toFixed(2)}"></label>
        <label class="field"><span>Plans start at</span><input type="time" class="inp" id="set-planStart" data-change="set-time" data-f="planStart" value="${esc(CFG.planStart)}"></label>
        <label class="field"><span>Plans end by</span><input type="time" class="inp" id="set-planEnd" data-change="set-time" data-f="planEnd" value="${esc(CFG.planEnd)}"></label>
        ${num('gap', CFG.gap, 0, 60, 5, 'Breathing room between blocks (min)')}
        ${num('guardHours', CFG.guardHours, 1, 12, 1, 'Ask about timers running longer than (hours)')}
        <label class="field"><span>Week starts on</span><select class="sel" id="set-week" data-change="set-week" data-value="${CFG.weekStart}"><option value="1"${+CFG.weekStart === 1 ? ' selected' : ''}>Monday</option><option value="0"${+CFG.weekStart === 0 ? ' selected' : ''}>Sunday</option><option value="6"${+CFG.weekStart === 6 ? ' selected' : ''}>Saturday</option></select></label>
        <label class="field"><span>Clock</span><select class="sel" id="set-clock" data-change="set-clock" data-value="${esc(CFG.clock)}"><option value="auto"${CFG.clock === 'auto' ? ' selected' : ''}>Like this device</option><option value="24"${CFG.clock === '24' ? ' selected' : ''}>24-hour</option><option value="12"${CFG.clock === '12' ? ' selected' : ''}>12-hour</option></select></label>
      </div>
      <p class="note-line">Time after midnight and before the day start still counts toward the evening it began.</p>
    </div>
    <div id="setsec-phone" class="setsec-phone">${vPhonePanel()}</div>
    <div class="setsec"><h3>Ask Claude in chat</h3><p class="note-line">Everything routine happens on this page. For thinking work, open a chat with Claude and say one of these.</p>
      ${PROMPTS.map(([p, d]) => `<div class="field"><div class="ask"><code>${esc(p)}</code><button type="button" class="btn sm" data-act="copy" data-text="${esc(p)}">${icon('copy')}Copy</button></div><span style="font-weight:400;color:var(--ink-3)">${esc(d)}</span></div>`).join('')}
    </div>
    <div class="setsec" id="setsec-data"><h3>Your data</h3><p class="note-line">${ne} entries across ${nd} days are loaded on this device. Exports include everything saved.</p>
      ${S.user && S.user.email ? `<div class="row"><span class="note-line">Signed in as ${esc(S.user.email)}</span><button type="button" class="btn sm" data-act="signout">Sign out</button></div>` : ''}<div class="row">${S.dl ? `<button type="button" class="btn sm" data-act="export" data-f="csv">${icon('download')}Export CSV</button><button type="button" class="btn sm" data-act="export" data-f="json">${icon('download')}Export JSON backup</button>` : '<span class="note-line">Exports are not available in this view.</span>'}</div>
    </div>
    <div class="setsec"><h3>Keyboard</h3><div class="keys">
      <kbd>1–9</kbd><span>Start or switch to an activity, in the order shown on Today</span>
      <kbd>S</kbd><span>Stop the timer</span><kbd>B</kbd><span>Take a break, or go back from one</span><kbd>R</kbd><span>Resume the last activity</span>
      <kbd>M</kbd><span>Pomodoro on or off</span><kbd>D</kbd><span>Desk view</span><kbd>N</kbd><span>Add an entry</span>
      <kbd>← →</kbd><span>Previous or next day (or week)</span><kbd>T C W P</kbd><span>Today, Calendar, Week, Patterns</span><kbd>N</kbd><span>In Calendar: plan something new</span><kbd>Ctrl Z</kbd><span>Undo</span>
    </div></div>`;
}


VIEWS.settings = () => sSetup();
SHEETS.setup = sSetup;
