// P2 Plan sheet rendering, validation, undoable writes and menu actions.
// Run: TZ=Asia/Kolkata node web/test/plan_sheets_test.js
const assert=require('assert');
const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../ui/plan-sheets.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../ui/plan-sheets.css'),'utf8');
const MIN=60000,writes=[],commits=[],events=[];
const base={id:'b1',activity:'math',title:'Integration',minutes:60,at:'09:00',pomo:null,order:1};
const row={id:'b1',activity:'math',title:'Integration',target:60*MIN,done:15*MIN,
 remaining:45*MIN,st:'partial',pieces:[[120000,180000]]};
const plans={'2026-10-27':{date:'2026-10-27',end:'22:30',blocks:{b1:base}}};
const ACT={},SHEETS={},UI={sheet:null,ab:{activity:'math'},cal:{anchor:'2026-10-27'}};
const ctx={
 MIN,Math,Date,Object,Array,Set,ACT,SHEETS,UI,
 ACTMAP:{math:{id:'math',name:'Mathematics',kind:'study',color:'#3D7EA6'}},
 ACTS:[{id:'math',name:'Mathematics',kind:'study',color:'#3D7EA6'}],
 CFG:{weekStart:1,planStart:'08:00',planEnd:'22:30'},V:{plans},ENTRIES:[],CUR:null,
 esc:x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 todayKey:()=> '2026-10-27',weekdayOfKey:()=>1,
 wdName:()=> 'Monday',fmtDur:ms=>Math.round(ms/MIN)+'m',fmtHM:x=>x,fmtT:x=>String(x),
 msToHm:()=> '09:00',roundUpMs:x=>x,
 dayName:k=>k,act:()=>({name:'Mathematics',color:'#3D7EA6'}),
 firstStudyId:()=> 'math',nextOrder:()=>2,uid:kind=>kind+'-new',
 blocksOf:()=>({b1:base}),
 planModelFor:()=>({rows:[row],planned:60*MIN,done:15*MIN,over:20*MIN,finish:120000}),
 aggregate:()=>({'2026-10-27':{study:35*MIN}}),
 blockDoc:doc=>doc,
 addDaysKey:(k,n)=>n===1?'2026-10-28':k,
 planShrink:k=>events.push('shrink:'+k),
 planOverflow:k=>events.push('overflow:'+k),
 copyPlan:(a,b)=>events.push('copy:'+a+':'+b),
 W:()=>({
   plan(k,data){writes.push(['plan',k,data]);return this;},
   update(k,data){writes.push(['update',k,data]);return this;},
   set(k,data){writes.push(['set',k,data]);return this;}
 }),
 commit:(message)=>commits.push(message),
 renderSheet:()=>events.push('render-sheet'),render:()=>events.push('render'),
 closeSheet:()=>{UI.sheet=null;events.push('close')},
 openSheet:sh=>{UI.sheet=sh;events.push('open:'+sh.type)},
 openMenu:(_el,items)=>{ctx.items=items;events.push('menu')},
 kSheetHead:(t,a)=>'<header>'+t+(a||'')+'</header>',
 kSheetFoot:x=>'<footer>'+x+'</footer>',
 kField:(l,v)=>'<div>'+l+v+'</div>',
 kActPick:()=>'<div>activity picker</div>',
 kText:o=>'<input value="'+o.value+'" id="'+o.attrs+'">',
 kTime:o=>'<input type="time" value="'+o.hm+'">',
 kDate:o=>'<input type="date" value="'+o.key+'">',
 kSwitch:o=>'<button role="switch" data-bind="'+o.bind+'">'+o.label+'</button>',
 kSeg:o=>'<div>'+o.options.map(x=>x.label).join('|')+'</div>',
 kChips:o=>'<div>'+o.options.map(x=>x.label).join('|')+'</div>',
 kStepper:o=>'<div>stepper '+o.value+'</div>',
 kCollapse:(id,title,body)=>'<details><summary>'+title+'</summary>'+body+'</details>',
 kIconBtn:(ic,l,attrs)=>'<button aria-label="'+l+'" '+attrs+'>'+ic+'</button>',
 kBtn:(l,attrs)=>'<button '+attrs+'>'+l+'</button>',
 kRow:o=>'<button '+o.attrs+'>'+o.label+'</button>',
 kEmpty:x=>x
};
vm.createContext(ctx);vm.runInContext(source,ctx);
assert.deepStrictEqual(Object.keys(SHEETS).sort(),['block','fit','planend','qnew','wrap']);
assert(!source.includes('Tap again to delete'),'P2 removes two-tap deletion');
assert(!source.includes('Cancel</button>'),'P2 sheets have no Cancel button');

ctx.openQnew('2026-10-27',0,60*MIN);
assert.equal(UI.sheet.type,'qnew');assert.equal(UI.sheet.pin,false,'new block defaults to auto fit');
assert(SHEETS.qnew(UI.sheet).includes('Fixed time'));
assert(SHEETS.qnew(UI.sheet).includes('More'));
ACT['q-tab']=e=>{UI.sheet.tab=e.getAttribute('data-v')};
UI.sheet.minutes=60;UI.sheet.title='Topology';
ctx.saveQnew();
assert.equal(writes.at(-1)[0],'plan');
assert.equal(writes.at(-1)[2].blocks['b-new'].at,null);
assert.equal(UI.sheet,null);
assert(commits.at(-1).includes('Planned'));

ctx.openQnew('2026-10-27',0,60*MIN,'busy',[]);
UI.sheet.btitle='Seminar';
ctx.saveQnew();
assert.equal(writes.at(-1)[0],'plan');
assert.equal(writes.at(-1)[2].events['v-new'].title,'Seminar');

ctx.openQnew('2026-10-27',0,60*MIN,'busy',[]);
ACT['p2-weekly']();
assert.equal(UI.sheet.weekly,true);
assert.deepStrictEqual(Array.from(UI.sheet.days),[1]);
assert(SHEETS.qnew(UI.sheet).includes('Repeat days'));
ctx.saveQnew();
assert.equal(writes.at(-1)[0],'update');
assert.equal(writes.at(-1)[1],'planning/commitments');
assert.deepStrictEqual(Array.from(writes.at(-1)[2].items['c-new'].days),[1]);

ctx.openQnew('2026-10-27',0,60*MIN,'busy',[]);
ctx.saveQnew();
assert.equal(UI.sheet.err,'Enter a title.','missing busy title is rejected');
assert.equal(writes.at(-1)[1],'planning/commitments','rejected write does not persist');

ctx.openBlockSheet('2026-10-27','b1');
assert.equal(UI.sheet.type,'block');
let html=SHEETS.block(UI.sheet);
assert(html.includes('Integration')&&html.includes('15m of 60m'),'block progress displays');
assert(html.includes('block-dup')&&html.includes('block-back')&&html.includes('p2-block-del'));
assert(!html.includes('Tap again'),'delete uses Undo');
ACT['p2-block-auto']();
assert.equal(UI.sheet.b.at,'');
UI.sheet.b.title='Updated';
ctx.saveBlockSheet();
assert.equal(writes.at(-1)[2].blocks.b1.at,null);

ctx.openBlockSheet('2026-10-27','b1');
ACT['p2-block-del']();
assert.equal(writes.at(-1)[2].blocks.b1,null);
assert.equal(UI.sheet,null);

UI.sheet={type:'wrap',k:'2026-10-27',pick:{b1:true},stop:false};
html=SHEETS.wrap(UI.sheet);
assert(html.includes('35m studied')&&html.includes('25% of plan'));
assert(html.includes('Move to tomorrow')&&html.includes('data-act="wrap-pick"'));
assert(!html.includes('Cancel'));

UI.sheet={type:'fit',k:'2026-10-27'};
html=SHEETS.fit(UI.sheet);
assert(html.includes("Doesn't fit")&&html.includes('Shrink blocks'));
assert(html.includes('p2-fit-overflow')&&html.includes('p2-fit-extend'));
ACT['p2-fit-shrink']({getAttribute:k=>k==='data-k'?'2026-10-27':null});
assert(events.includes('shrink:2026-10-27'));
UI.sheet={type:'fit',k:'2026-10-27'};
ACT['p2-fit-overflow']({getAttribute:k=>k==='data-k'?'2026-10-27':null});
assert(events.includes('overflow:2026-10-27'));

UI.sheet={type:'planend',k:'2026-10-27',end:'21:45',err:''};
assert(SHEETS.planend(UI.sheet).includes('Save'));
ACT['p2-planend-save']();
assert.equal(writes.at(-1)[2].end,'21:45');
assert.equal(UI.sheet,null);

ACT['p2-plan-menu']({getAttribute:k=>k==='data-k'?'2026-10-27':null});
assert(events.includes('menu'));
assert.deepStrictEqual(ctx.items.map(x=>x.label),['Copy to tomorrow','Wrap up','Plan ends at…','Clear plan']);
ACT['p2-menu-clear']({getAttribute:k=>k==='data-k'?'2026-10-27':null});
assert.deepStrictEqual(writes.at(-1).slice(0,2),['set','plans/2026-10-27']);
assert.equal(commits.at(-1),'Cleared plan.');
ACT['p2-menu-end']({getAttribute:k=>k==='data-k'?'2026-10-27':null});
assert.equal(UI.sheet.type,'planend');

assert(css.includes('.p2-weekday')&&css.includes('.p2-sheet'));
assert(!/#[0-9a-fA-F]{3,8}\b|font-family|box-shadow/.test(css),'P2 CSS kit-token only');
console.log('PLAN SHEETS TESTS PASSED');
