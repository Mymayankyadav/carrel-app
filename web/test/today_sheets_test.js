// T2 regression tests: Today sheets and low-distraction focus mode.
// Run: TZ=Asia/Kolkata node web/test/today_sheets_test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../ui/', name), 'utf8');
const MIN = 60000, HOUR = 60 * MIN, now = Date.now();
const entry = { e: now - 10 * MIN };
const calls = [], ACT = {}, SHEETS = {};
let parked = [{ id: 'p1', text: 'Check theorem statement' }];
let aggregates = 0;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = { sheet: null, parkText: '', guardTime: '14:25', pomoOn: true,
  pomoPreset: '25/5', deskShift: [0, 0], deskCtl: now + 4000 };
const ACTMAP = { math: { id:'math', name:'Math <proofs>', color:'#3D7EA6', kind:'study' },
  break: { id:'break', name:'Break', color:'#4E5A86', kind:'life', role:'break' },
  archived: { id:'archived', name:'Hidden', color:'#333333', kind:'study', archived:true } };
const kButton = (label, attrs='') => '<button '+attrs+'>'+label+'</button>';
const ctx = { ACT, SHEETS, UI, ACTMAP, ACTS: Object.values(ACTMAP), ENTRIES:[],
  MIN, HOUR, PRESETS: {'25/5':{},'50/10':{},'90/20':{}},
  CFG: { pomodoro: { focus:25,short:5 } },
  aggregate: () => { aggregates++; return { '2026-10-27':{acts:{ math:90*MIN, break:20*MIN }} }; },
  todayKey: () => '2026-10-27', esc, kSafeColour:x=>x, fmtDur:ms=>(ms/MIN)+'m',
  fmtT: () => '14:30', msToHm:()=>'14:25', parseT:()=>now-HOUR,
  lastEntry:()=>entry, parkedItems:()=>parked,
  kIconBtn: (_i,label,attrs)=>kButton(label,attrs),
  kSheetHead: (title,actions='')=>'<header>'+esc(title)+actions+'</header>',
  kSheetFoot: html=>'<footer>'+html+'</footer>',
  kField: (title,html)=>'<label>'+title+html+'</label>',
  kChips: o=>'<div class="k-chips">'+o.options.map(x=>
    kButton(esc(x.label),'data-act="'+(o.act||'noop')+'" data-v="'+esc(x.v)+'"')).join('')+'</div>',
  kSwitch: o=>kButton('toggle','data-act="'+o.act+'" aria-checked="'+o.on+'"'),
  kSeg: o=>'<div class="k-seg">'+o.options.map(x=>
    kButton(x.label,'data-act="'+o.act+'" data-v="'+x.v+'"')).join('')+'</div>',
  kBtn: kButton, kTime:o=>'<input type="time" data-bind="'+o.bind+'" value="'+o.hm+'">',
  kEmpty:s=>'<div>'+s+'</div>',
  startActivity:(id,opts)=>calls.push(['start',id,opts]), parkAdd:s=>calls.push(['park',s]),
  parkToBacklog:()=>{ calls.push('backlog'); parked=[]; },
  openPage:(tab,page)=>calls.push(['page',tab,page]),
  openSheet:sh=>{ UI.sheet=sh; calls.push(['open',sh.type]); },
  closeSheet:()=>{UI.sheet=null;calls.push('close');},
  renderSheet:()=>calls.push('render'),
  store:{ get: key=>key==='seen'?now-10*MIN:null },
  setTimeout:()=>{},
  Date, Math, String
};
ACT['park-drop']=()=>{ calls.push('drop'); parked=[]; };
ACT['guard-seen']=el=>calls.push(['guard-seen',el.getAttribute('data-t')]);
vm.createContext(ctx);
vm.runInContext(read('today-sheets.js'),ctx,{filename:'today-sheets.js'});
assert.deepEqual(Object.keys(SHEETS).sort(),['activities','fixstop','park','parked','start']);
let activities = SHEETS.activities();
assert.equal(aggregates,1,'compute todays logged totals only once');
assert(activities.includes('Math &lt;proofs&gt;') && activities.includes('90m'));
assert(activities.includes('data-long="t2-start-opts"'));
assert(activities.includes('aria-pressed="false"'));
assert(!activities.includes('Hidden'), 'archived activities are excluded');
ACT['t2-start-opts']({getAttribute:()=> 'math'});
assert.equal(UI.sheet.type,'start');
assert.equal(UI.sheet.pomo,true,'respects timer default');
let options = SHEETS.start(UI.sheet);
assert(options.includes('After last') && options.includes('data-act="t2-confirm-start"'));
assert(options.includes('50/10') && !options.includes('Cancel'));
ACT['t2-from']({getAttribute:()=> 'last'});
assert.equal(UI.sheet.from,'last');
ACT['t2-preset']({getAttribute:()=> '50/10'});
assert.equal(UI.sheet.preset,'50/10');
ACT['t2-confirm-start']();
let started = calls.filter(x=>Array.isArray(x)&&x[0]==='start').at(-1);
assert.equal(started[1],'math');
assert.equal(started[2].at,entry.e);
assert.equal(started[2].pomoPreset,'50/10');
assert.equal(UI.sheet,null);
entry.e=now-13*HOUR;
ACT['t2-start-opts']({getAttribute:()=> 'math'});
options = SHEETS.start(UI.sheet);
assert(!options.includes('After last'),'stale last entry is not an option');
ACT['t2-pomo']();
assert.equal(UI.sheet.pomo,false);
ACT['t2-confirm-start']();
started = calls.filter(x=>Array.isArray(x)&&x[0]==='start').at(-1);
assert.equal(started[2].pomoRaw,null,'off overrides persistent/default pomodoro');
ACT['t2-start-opts']({getAttribute:()=> 'archived'});
assert.equal(UI.sheet,null,'archived actions do not open a sheet');
ACT['t2-start']({getAttribute:()=> 'break'});
assert.equal(calls.filter(x=>Array.isArray(x)&&x[0]==='start').at(-1)[1],'break');
UI.parkText='';
assert(SHEETS.park().includes('disabled'),'empty thoughts cannot be saved');
ACT['t2-save-park']();
assert(!calls.some(x=>Array.isArray(x)&&x[0]==='park'));
UI.parkText='  A < B  ';
assert(SHEETS.park().includes('A &lt; B'),'text is escaped');
ACT['t2-save-park']();
assert.equal(calls.filter(x=>Array.isArray(x)&&x[0]==='park').at(-1)[1],'A < B');
UI.parkText='x'.repeat(121);
assert(SHEETS.park().includes('121/140'),'character count is progressive');
UI.sheet={type:'parked',k:'2026-10-27'};
assert(SHEETS.parked(UI.sheet).includes('data-act="t2-park-backlog"'));
ACT['t2-park-backlog']({getAttribute: k=>k==='data-k'?'2026-10-27':'p1'});
assert(calls.includes('backlog') && calls.includes('close'),'sheet closes on last moved thought');
parked=[{ id:'p2',text:'Try a lemma'}]; UI.sheet={type:'parked',k:'2026-10-27'};
ACT['t2-park-drop']({getAttribute: k=>k==='data-k'?'2026-10-27':'p2'});
assert(calls.includes('drop') && UI.sheet===null);
const fixed=SHEETS.fixstop();
assert(fixed.includes('data-act="guard-save"') && fixed.includes('Last open'));
ACT['t2-seen']({getAttribute:()=>String(now-10*MIN)});
assert.equal(calls.at(-1)[0],'guard-seen');
ACT['t2-edit-activities']();
assert.deepEqual(calls.at(-1),['page','settings','settings.activities']);

let focusPop = null;
const focusHistory = [];
const focusCtx={ UI, CUR:{activity:'math',start:now-HOUR}, Date,
  act:id=>ACTMAP[id], parseT:()=>now-HOUR, pomoState:()=>null,
  fmtClock:()=> '1:00:00', icon:name=>'<svg>'+name+'</svg>',
  esc, clamp:(x,a,b)=>Math.max(a,Math.min(b,x)), Math,
  lastEntry:()=>null, setInterval:()=>1, clearInterval:()=>{},
  window:{matchMedia:()=>({matches:false}), addEventListener:(event,fn)=>{if(event==='popstate')focusPop=fn;}},
  kHistoryPush:kind=>focusHistory.push(['push',kind]),
  kHistoryConsume:kind=>focusHistory.push(['consume',kind]),
  render:()=>{},
  document:{visibilityState:'visible'}, navigator:{}
};
vm.createContext(focusCtx);
vm.runInContext(read('focus.js'),focusCtx,{filename:'focus.js'});
let focus=focusCtx.vDesk();
assert(focus.includes('role="dialog"') && focus.includes('data-act="desk-tap"'));
assert(focus.includes('data-act="desk-exit"') && focus.includes('aria-label="Stop"'));
assert(!focus.includes('Take a break</button>'),'icon controls do not display text labels');
focusCtx.pomoState=()=>({ps:now-10*MIN,len:25*MIN,left:15*MIN,end:now+15*MIN,phase:'focus',cycle:2,every:4});
focus=focusCtx.vDesk();
assert(focus.includes('Focus 2 of 4') && focus.includes('role="progressbar"'));
UI.deskCtl=0;
assert(focusCtx.vDesk().includes('desk-ctl hid'),'controls hide after inactivity');
const focusCss=read('focus.css');
assert(focusCss.includes('background:#000') && focusCss.includes('visibility:hidden'));
focusCtx.CUR={activity:'break',start:now-HOUR,ret:null};
focusCtx.pomoState=()=>null;
const breakFocus=focusCtx.vDesk();
assert(!breakFocus.includes('data-act="break"'),'break mode cannot offer another, inert Break action');
assert(breakFocus.includes('data-act="stop"'));
UI.desk=false;
focusCtx.enterDesk();
assert(UI.desk && focusHistory.at(-1)[0]==='push','focus adds a Back history layer');
assert.equal(UI.deskCtl<=Date.now()+4000,true);
focusCtx.exitDesk();
assert(!UI.desk && focusHistory.at(-1)[0]==='consume','exit consumes its history layer');
focusCtx.enterDesk();
let stopped=false;
assert.equal(typeof focusPop,'function');
focusPop({stopImmediatePropagation:()=>{stopped=true;}});
assert(stopped && !UI.desk && focusHistory.at(-1)[0]==='push',
  'system Back closes focus without consuming history twice or navigating a tab');
console.log('TODAY SHEETS / FOCUS TESTS PASSED');
