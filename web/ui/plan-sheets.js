function sBlock(sh) {
  const b = sh.b, tk = todayKey();
  const pm = planModelFor(sh.k);
  const r = pm && pm.rows.find(x => x.id === sh.id);
  const live = r && (r.st === 'open' || r.st === 'partial');
  const info = r ? `<p class="note-line">${fmtDur(Math.min(r.done, r.target))} of ${fmtDur(r.target)} done${r.pieces.length ? ' · next ' + fmtT(r.pieces[0][0]) + '–' + fmtT(r.pieces[r.pieces.length - 1][1]) : ''}${r.clash ? ' · overlaps something else' : ''}</p>` : '';
  return `<div class="sh-head"><h2 id="sh-title">Plan block</h2><button type="button" class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('x')}</button></div>
    ${info}
    ${actPick(b.activity, 'b.activity')}
    <label class="field"><span>What exactly</span><input class="inp" id="b-title" maxlength="80" data-bind="b.title" value="${esc(b.title)}" autocomplete="off" placeholder="e.g. Chapter 6 problems"></label>
    <div class="g2"><label class="field"><span>Day</span><input type="date" class="inp" id="b-day" data-bind="b.day" value="${esc(b.day)}" min="${tk}"></label>
    <label class="field"><span>Minutes</span><input type="number" class="inp" id="b-min" min="5" max="720" step="5" data-bind="b.minutes" value="${esc(b.minutes)}"></label></div>
    <div class="g2"><label class="field"><span>Pinned start (empty fits it in automatically)</span><input type="time" class="inp" id="b-at" data-bind="b.at" value="${esc(b.at || '')}"></label>
    <label class="field"><span>Pomodoro</span><select class="sel" id="b-pomo" data-bind="b.pomo" data-value="${esc(b.pomo || '')}"><option value=""${!b.pomo ? ' selected' : ''}>Use my switch</option>${Object.keys(PRESETS).map(p => `<option value="${p}"${b.pomo === p ? ' selected' : ''}>${p}</option>`).join('')}</select></label></div>
    <div class="row">${sh.k === tk && live ? `<button type="button" class="btn sm lamp" data-act="block-start">${icon('play')}Start now</button>` : ''}<button type="button" class="btn sm" data-act="block-dup">${icon('copy')}Duplicate</button><button type="button" class="btn sm" data-act="block-back">${icon('inbox')}Back to backlog</button><button type="button" class="btn sm danger ${sh.armed ? 'armed' : ''}" data-act="block-del">${icon('trash')}${sh.armed ? 'Tap again to delete' : 'Delete'}</button></div>
    ${sh.err ? `<p class="err" role="alert">${esc(sh.err)}</p>` : ''}
    <div class="sh-foot"><button type="button" class="btn ghost" data-act="sheet-close">Cancel</button><button type="button" class="btn lamp" data-act="block-save">Save block</button></div>`;
}
function sWrap(sh) {
  const pm = planModelFor(sh.k);
  const left = pm ? pm.rows.filter(r => r.remaining > 0) : [];
  const done = pm ? pm.done : 0, planned = pm ? pm.planned : 0;
  const agg = aggregate(ENTRIES, Date.now(), sh.k, sh.k)[sh.k] || { study: 0 };
  return `<div class="sh-head"><h2 id="sh-title">Wrap up the day</h2><button type="button" class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('x')}</button></div>
    <p class="note-line">You studied <b>${fmtDur(agg.study)}</b> today${planned ? ` and finished <b>${fmtDur(done)}</b> of <b>${fmtDur(planned)}</b> planned (${Math.round(done / planned * 100)}%)` : ''}.</p>
    ${left.length ? `<div class="field"><span>Carry to tomorrow</span>${left.map(r => `<label class="check"><input type="checkbox" data-act="wrap-pick" data-id="${r.id}" ${sh.pick[r.id] ? 'checked' : ''}> ${esc(act(r.activity).name)}${r.title ? ' · ' + esc(r.title) : ''} <span class="num">(${fmtDur(r.remaining)} left)</span></label>`).join('')}</div>` : '<p class="note-line">Nothing is left in the plan.</p>'}
    ${CUR ? `<label class="check"><input type="checkbox" data-act="wrap-stop" ${sh.stop ? 'checked' : ''}> Stop the ${esc(act(CUR.activity).name)} timer now</label>` : ''}
    <div class="sh-foot"><button type="button" class="btn ghost" data-act="sheet-close">Cancel</button><button type="button" class="btn lamp" data-act="wrap-save">Wrap up</button></div>`;
}

SHEETS.block = sBlock;
SHEETS.wrap = sWrap;

SHEETS.qnew = sQnew;
