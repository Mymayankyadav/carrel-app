'use strict';
// R5 bridge contract tests. No Android SDK, npm, browser or Supabase access needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'native.js'), 'utf8');

function load({ native = false, plugin = null, pages = true } = {}) {
  const events = { changed: 0, prefs: [], toasts: [], restarts: 0 };
  const cp = {
    Plugins: native ? { CarrelLive: plugin || {
      setPrefs: values => { events.prefs.push(values); return Promise.resolve(values); }
    } } : {},
    isNativePlatform: () => native,
    isPluginAvailable: name => native && name === 'CarrelLive',
  };
  const ctx = {
    console,
    window: { Capacitor: cp },
    Capacitor: cp,
    ACT: {},
    changed: () => { events.changed += 1; },
    toast: msg => { events.toasts.push(msg); },
    kRow: props => '<row>' + props.label + '|' + (props.right || props.value || '') + '</row>',
    kSwitch: props => '<switch action="' + props.act + '" checked="' + props.on + '">' + props.label + '</switch>',
    kBtn: text => '<button>' + text + '</button>',
    kGroup: (_, body) => body,
    kCollapse: (_, label, body) => '<details>' + label + body + '</details>',
    kEmpty: text => '<empty>' + text + '</empty>',
  };
  if (pages) ctx.PAGES = {};
  vm.createContext(ctx);
  vm.runInContext(source, ctx, { filename: 'web/native.js' });
  return { ctx, events };
}

async function main() {
  // The legacy web shell does not define PAGES; the R5 module must still load.
  assert.equal(Object.hasOwn(load({ pages: false }).ctx.ACT, 'np-toggle'), true);

  // Web users cannot see unusable Android toggles.
  const web = load();
  assert.equal(web.ctx.PAGES['settings.notifications'].render(), '<empty>Available on Android');
  assert.equal(vm.runInContext('vPhonePanel()', web.ctx), '');

  // Native-only Settings subscreen: no explanatory paragraphs and five independent controls.
  const { ctx, events } = load({ native: true });
  const markup = ctx.PAGES['settings.notifications'].render();
  for (const key of ['vibrateFocus', 'vibrateBreak', 'respectDnd', 'privacy', 'notifDistractions']) {
    assert.match(markup, new RegExp('np-' + key));
    assert.equal(typeof ctx.ACT['np-' + key], 'function');
  }
  assert.match(markup, /Troubleshoot/);
  assert.match(markup, /Exact alarms/);
  assert.match(markup, /Background activity/);
  assert.doesNotMatch(markup, /<p>|note-line|Save your settings|From Claude/i);
  assert.match(markup, /action="np-notifDistractions" checked="false"/);

  // A user gesture must persist the new preference and update the visual state.
  ctx.ACT['np-notifDistractions']();
  assert.equal(events.prefs.length, 1);
  assert.equal(events.prefs[0].notifDistractions, true);
  await Promise.resolve();
  assert.match(ctx.PAGES['settings.notifications'].render(), /action="np-notifDistractions" checked="true"/);

  // Unrecognized values in a data attribute cannot write arbitrary plugin preferences.
  ctx.ACT['np-toggle']({ getAttribute: () => '__proto__' });
  assert.equal(events.prefs.length, 1);

  // Simulate the native save failing: the optimistic switch is reversed.
  const rejecting = load({ native: true, plugin: {
    setPrefs: values => { events.prefs.push(values); return Promise.reject(new Error('offline')); }
  } });
  rejecting.ctx.ACT['np-notifDistractions']();
  await Promise.resolve();
  await Promise.resolve();
  assert.match(rejecting.ctx.PAGES['settings.notifications'].render(),
    /action="np-notifDistractions" checked="false"/);

  console.log('native_redesign_test: all bridge and settings checks passed');
}

main().catch(e => { console.error(e); process.exitCode = 1; });
