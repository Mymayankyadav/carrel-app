// A6 shell, setup, dialog and touch access regression tests.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const app = require('./src').app;
const css = require('./src').css;
const between = (start, end) => {
  const i = app.indexOf(start), j = app.indexOf(end, i + start.length);
  assert(i >= 0 && j > i, start + ' must exist before ' + end);
  return app.slice(i, j);
};
const esc = v => String(v).replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]));

// U1 touch sheets: always focus dialog, then trap focus between controls.
const calls = [], events = {};
const makeFocusable = label => ({
  label, tabIndex:0, getClientRects:()=>[{}], getAttribute:()=>null,
  focus(options) { calls.push({label,options}); doc.activeElement = this; }
});
const first = makeFocusable('first'), last = makeFocusable('last');
const sheet = {
  attributes: {},
  setAttribute(k,v) { this.attributes[k]=v; },
  focus:makeFocusable('sheet').focus,
  querySelector(s) { return first; },
  querySelectorAll() { return [first,last]; },
  contains(node) { return [first,last].includes(node); }
};
const doc = {
  activeElement:sheet,
  querySelector(selector) { assert.equal(selector,'#sheet .sheet'); return sheet; },
  addEventListener(type,fn,capture) { events[type]={fn,capture}; }
};
const dialogEnv = {
  document:doc, UI:{sheet:{type:'setup'}},
  window:{matchMedia:()=>({matches:false})},
  requestAnimationFrame:fn=>fn(), Array, Object
};
const focusSheet = vm.runInNewContext(between('function focusSheet()', 'function openSheet(')+'\nfocusSheet',dialogEnv);
focusSheet();
assert.equal(sheet.attributes.tabindex,'-1', 'dialog focus target exists on touch');
assert.equal(calls[0].label,'sheet', 'dialog actually receives focus on touch');
assert.equal(calls[0].options.preventScroll,true, 'dialog focus does not jump scrolling');
assert.equal(events.keydown.capture,true, 'trap keydown listener captures Tab');

function tab(shiftKey,active){
  doc.activeElement=active; let prevented=false;
  events.keydown.fn({key:'Tab',shiftKey,defaultPrevented:false,preventDefault(){prevented=true}});
  return prevented;
}
assert(tab(false,last), 'Tab on last input wraps');
assert.equal(calls.at(-1).label,'first');
assert(tab(true,first), 'Shift-Tab on first input wraps');
assert.equal(calls.at(-1).label,'last');
assert(tab(false,{}), 'Tab from outside dialog reenters');
assert.equal(calls.at(-1).label,'first');
const n=calls.length;
assert.equal(tab(false,first),false,'Tab within dialog remains native');
assert.equal(calls.length,n);
dialogEnv.UI.sheet=null;
assert.equal(tab(false,last),false,'Tab trap off when sheet closes');

// U3 setup renderer and registered action can reach exactly the five sections.
const ACT={};
const jumpTarget={id:'setsec-data',calls:[],scrollIntoView(opts){this.calls.push(opts);}};
const setupDoc={getElementById:id=>id==='setsec-data'?jumpTarget:null};
const setupEnv={
  ACT, document:setupDoc, ACTS:[],
  UI:{newAct:{name:'',kind:'study'},showArchived:false},
  CFG:{pomodoro:{focus:25,short:5,long:15,every:4},dayStart:'04:00',dailyGoal:120,
    planStart:'08:00',planEnd:'22:00',gap:10,guardHours:5,weekStart:1,clock:'auto'},
  V:{days:{}}, ENTRIES:[], PRESETS:{'25/5':{}},PROMPTS:[],
  presetLabel:()=> '25/5',vPhonePanel:()=>'<section>Phone options</section>',
  S:{user:null,dl:null},icon:()=>'',esc,
  Object
};
const setup=vm.runInNewContext(between('function sSetup()', '/* ---------- desk view ---------- */')+'\nsSetup',setupEnv);
const html=setup();
for(const [id,label] of [['activities','Activities'],['timer','Timer'],['day','Day'],['phone','Phone'],['data','Data']]){
  assert(html.includes('data-act="a6-jump" data-target="'+id+'"'), id+' has a jump');
  assert(html.includes('id="setsec-'+id+'"'),id+' has an anchor');
  assert(html.includes('>'+label+'</button>'),id+' has readable button text');
}
assert(html.includes('class="set-jump"'), 'jump bar is rendered under setup header');
assert(html.includes('data-act="signout"') === false,'no sign-out when not signed in');
assert.equal(typeof ACT['a6-jump'],'function');
const button={getAttribute:k=>k==='data-target'?'data':null};
ACT['a6-jump'](button);
assert.equal(jumpTarget.calls[0].block,'start');
assert.equal(jumpTarget.calls[0].behavior,'smooth');
const beforeBad=jumpTarget.calls.length;
ACT['a6-jump']({getAttribute:()=> 'unknown-id'});
assert.equal(jumpTarget.calls.length,beforeBad,'unknown anchors ignored');
setupEnv.S.user={email:'reader@example.org'};
const signedIn=setup();
assert(signedIn.includes('data-act="signout"'),'signed-in setup includes A1-protected signout');
assert(signedIn.includes('data-act="act-arch"')===false,'no irreversible delete in empty setup');

// U6 hide only Saved status when a running pill is present, keep actual
// status text in a span for screen readers and don't hide offline errors.
const context={
  S:{pending:[]},UI:{view:'week'},CUR:{activity:'math',start:'2026-10-27T12:00:00+05:30'},
  syncState:()=> 'live',act:()=>({name:'Mathematics',color:'#123456'}),parseT:()=>1000,
  fmtEl:()=> '2m', Date:{now:()=>10000}, todayKey:()=> '2026-10-27',
  icon:()=>'',esc
};
const vHeader=vm.runInNewContext(between('function vHeader()', 'function vNav(')+'\nvHeader',context);
const running=vHeader();
assert(running.includes('runpill'),'other view shows running activity');
assert(running.includes('sync s-live a6-dot-only'),'running Saved badge is compactable');
assert(running.includes('<span>Saved</span>'),'status remains readable to screen readers');
context.CUR=null;assert(!vHeader().includes('a6-dot-only'),'Saved shown in full without timer pill');
context.CUR={activity:'math',start:'start'};context.syncState=()=> 'offline';
assert(!vHeader().includes('a6-dot-only'),'offline errors always visible');

// U2 & U5 CSS safety.
assert(css.includes('bottom:calc(64px + env(safe-area-inset-bottom,0px) + 12px)'), 'toast clears phone tabs');
assert(css.includes('@media (min-width:860px){.toast{bottom:26px}}'),'desktop toast location unchanged');
assert(css.includes('@media (pointer:coarse){.icon-btn{min-width:40px;min-height:40px}.btn.sm{min-width:40px;min-height:40px}}'), 'touch controls at least 40 px');
assert(css.includes('.set-jump{position:sticky;top:0;'), 'setup jump remains visible when scrolling');
assert(css.includes('.setsec[id],.setsec-phone{scroll-margin-top:64px}'),'anchors clear sticky bar');
assert(css.includes('.sync.a6-dot-only span{position:absolute;'), 'saved label visually hidden, not removed');
console.log('SHELL TESTS PASSED');
