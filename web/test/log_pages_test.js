// T3 Log page and edit sheets; legacy Today rendering remains intact.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const raw=fs.readFileSync(path.join(__dirname,'../ui/log.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../ui/log.css'),'utf8');
const start=raw.indexOf('/* T3 — the standalone Today log.');
assert(start>=0,'T3 region exists');
const source=raw.slice(start),MIN=60000,now=Date.now();
const en={id:'x1',a:'math',s:now-90*MIN,e:now-45*MIN,day:'2026-10-27',note:'Integration',focus:3};
const ACT={},PAGES={},SHEETS={},calls=[];
const UI={pages:[{id:'log',params:{k:'2026-10-27'}}],sheet:null};
const env={
 ACT,PAGES,SHEETS,UI,MIN,Math,Date,Object,Array,Set,
 ENTRIES:[en],ACTMAP:{math:{name:'Mathematics',color:'#3D7EA6',kind:'study'}},
 todayKey:()=> '2026-10-27',addDaysKey:(k,d)=>d===1?'2026-10-28':d===-1?'2026-10-26':k,
 shortDay:k=>k,fmtDur:x=>Math.round(x/MIN)+'m',fmtT:()=> '4:20 pm',
 act:()=>({name:'Mathematics',color:'#3D7EA6'}),kSafeColour:x=>x,
 esc:x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
 icon:x=>'<svg>'+x+'</svg>',dayStartMs:()=>now-5*60*MIN,
 dayEndMs:()=>now+24*60*MIN,entryEnd:x=>x.e||now,
 dayEntries:()=>[en],gapsOf:()=>[[now-45*MIN,now-25*MIN]],
 aggregate:()=>({'2026-10-27':{study:45*MIN,all:45*MIN}}),
 ensureRange:()=>{},kEmpty:x=>'<div>'+x+'</div>',
 kIconBtn:(ic,label,attrs)=>'<button '+attrs+' aria-label="'+label+'"></button>',
 kSheetHead:(title,actions)=>'<header>'+title+(actions||'')+'</header>',
 kSheetFoot:x=>'<footer>'+x+'</footer>',
 kBtn:(title,attrs)=>'<button '+attrs+'>'+title+'</button>',
 kField:(title,x)=>'<label>'+title+x+'</label>',
 kActPick:()=>'<button>Activity</button>',
 kDate:()=>'<input type="date">',kArea:()=>'<textarea></textarea>',
 kSwitch:()=>'<button role="switch"></button>',
 kCollapse:(_id,title,body)=>'<details>'+title+body+'</details>',
 kTime:()=>'<input type="time">',
 sheetTimes:()=>({s:now-90*MIN,e:now-45*MIN}),
 overlapsFor:()=>[{a:'math',s:now-85*MIN,e:now-80*MIN}],
 isStudyId:()=>true,
 openEntrySheet:(mode,params)=>calls.push(['open',mode,params]),
 hmOnDay:()=>now-60*MIN,msToHm:()=> '10:00',dayKeyOf:()=> '2026-10-27',
 render:()=>calls.push('render'),renderSheet:()=>calls.push('sheet'),
 deleteEntrySheet:()=>calls.push('delete'),Object
};
vm.createContext(env);vm.runInContext(source,env);
assert(PAGES.log&&SHEETS.entry&&SHEETS.split);
const html=PAGES.log.render({k:'2026-10-27'});
assert(html.includes('45m studied')&&html.includes('Integration'));
assert(html.includes('Untracked')&&html.includes('data-act="t3-gap"'));
assert(html.includes('data-act="t3-entry"')&&html.includes('Mathematics'));
assert(!html.includes('Timeline')&&!html.includes('Plan ahead'));
ACT['t3-prev']();assert.equal(UI.pages[0].params.k,'2026-10-26');
ACT['t3-next']();assert.equal(UI.pages[0].params.k,'2026-10-28');
ACT['t3-entry']({getAttribute:()=> 'x1'});
assert.equal(calls.at(-1)[1],'edit');
ACT['t3-gap']({getAttribute:k=>k==='data-s'?String(now-45*MIN):String(now-25*MIN)});
assert.equal(calls.at(-1)[1],'add');
UI.sheet={type:'entry',mode:'edit',id:'x1',
 d:{activity:'math',date:'2026-10-27',start:'10:00',end:'11:00',focus:3,note:'Integration'},trim:true,err:''};
let editor=SHEETS.entry(UI.sheet);
assert(editor.includes('Edit entry')&&editor.includes('data-act="t3-delete"'));
assert(editor.includes('More')&&editor.includes('Overlaps Mathematics'));
assert(editor.includes('aria-label="Deep"'));
assert(!editor.includes('Cancel'));
UI.sheet.mode='running';
editor=SHEETS.entry(UI.sheet);
assert(editor.includes('Running')&&editor.includes('>Now<'));
assert(!editor.includes('data-act="split-open"'));
UI.sheet.mode='add';
editor=SHEETS.entry(UI.sheet);
assert(editor.includes('New entry')&&editor.includes('type="date"'));
assert(!editor.includes('data-act="t3-delete"'));
UI.sheet={type:'entry',mode:'edit',id:'x1',armed:false};
ACT['t3-delete']();
assert.equal(UI.sheet.armed,true);
assert(calls.includes('delete'),'delete reuses existing transactional action');
UI.sheet={type:'split',id:'x1',at:'10:30',activity:'math',err:''};
editor=SHEETS.split(UI.sheet);
assert(editor.includes('Split at')&&editor.includes('Second part')&&editor.includes('data-act="split-save"'));
assert(!editor.includes('Cancel'));
assert(css.includes('.t3-log-row')&&css.includes('.t3-time-field'));
assert(!/#[0-9a-fA-F]{3,8}\b|box-shadow/.test(css.slice(css.indexOf('/* T3 standalone'))));
console.log('LOG PAGES TESTS PASSED');
