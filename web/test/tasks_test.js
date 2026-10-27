// P3 Tasks: registry, the three tabs, edit shells and write-compatible actions.
const assert=require('assert');
const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../ui/tasks.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../ui/tasks.css'),'utf8');
const acts={math:{id:'math',name:'Mathematics',kind:'study',color:'#3D7EA6'}};
const pending={id:'d1',title:'Algebra exam',date:'2026-10-28',time:'10:00',kind:'exam',done:false,activity:'math'};
const done={id:'d2',title:'Finished test',date:'2026-10-26',time:null,kind:'due',done:true};
const backlog={t1:{id:'t1',title:'Finish chapter',activity:'math',minutes:90,due:'2026-10-30',prio:1}};
const commitments={w1:{title:'Lecture',start:'10:00',end:'11:30',days:[1,3,5]}};
const writes=[],calls=[],UI={sheet:null,pages:[{id:'tasks',params:{tab:'deadlines'}}],ta:{minutes:60,activity:'math'}};
const ACT={},SHEETS={},PAGES={},SUBMIT={};
const env={
 ACT,SHEETS,PAGES,SUBMIT,UI,ACTMAP:acts,ACTS:Object.values(acts),
 CFG:{weekStart:1},V:{plans:{}},MIN:60000,Math,Date,Object,Set,
 esc:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
 icon:name=>'<svg>'+name+'</svg>',
 fmtHM:s=>s,fmtDur:n=>Math.round(n/60000)+'m',shortDay:s=>s,
 todayKey:()=> '2026-10-27',addDaysKey:(k,d)=>k,daysUntil:k=> k==='2026-10-28'?1:-1,
 countdown:k=>'in 1d',wdName:()=> 'Monday',weekdayOfKey:()=> 2,
 dateOfKey:k=>new Date(k+'T12:00:00Z'),uid:s=>s+'1',
 ACTS:Object.values(acts),deadlineList:()=>[pending,done],backlogList:()=>[backlog.t1],
 backlogMap:()=>backlog,commitmentsMap:()=>commitments,deadlinesMap:()=>({d1:pending}),
 kEmpty:s=>'<div>'+s+'</div>',kRow:o=>'<button '+(o.attrs||'')+'>'+o.label+(o.sub||'')+(o.value||'')+(o.right||'')+'</button>',
 kSeg:o=>'<div class="k-seg">'+o.options.map(v=>'<button data-act="'+o.act+'" data-v="'+v.v+'">'+v.label+'</button>').join('')+'</div>',
 kIconBtn:(ic,label,attrs)=>'<button '+attrs+' aria-label="'+label+'"></button>',
 kBtn:(label,attrs)=>'<button '+attrs+'>'+label+'</button>',
 kSheetHead:(title,a)=>'<header>'+title+(a||'')+'</header>',
 kSheetFoot:a=>'<footer>'+a+'</footer>',kField:(label,body)=>'<label>'+label+body+'</label>',
 kText:o=>'<input data-bind="'+o.bind+'" value="'+(o.value||'')+'">',
 kDate:o=>'<input type="date" data-bind="'+o.bind+'">',
 kTime:o=>'<input type="time" data-bind="'+o.bind+'">',
 kActPick:o=>'<span>activity:'+o.id+'</span>',
 kChips:o=>'<span>'+o.options.map(x=>x.label).join(' ')+'</span>',
 kCollapse:(id,s,b)=>'<details><summary>'+s+'</summary>'+b+'</details>',
 kSafeColour:s=>s,
 openSheet:sh=>{UI.sheet=sh;calls.push('sheet:'+sh.type)},
 render:()=>calls.push('render'),renderSheet:()=>calls.push('renderSheet'),
 closeSheet:()=>{UI.sheet=null;calls.push('close')},
 commit:(m,w)=>{calls.push('commit:'+m);writes.push(...w.out)},
 W:()=>({out:[],update(patch,data){this.out.push([patch,data])}}),
 findDayFor:()=>({k:'2026-10-30',fits:true}),
 scheduleTask:(id,k,at)=>calls.push('scheduled:'+id+':'+k+':'+at),
 firstStudyId:()=> 'math',ACTMAP:acts,wdChips:()=>'',actSelect:()=>'',actPick:()=>'',errLine:()=>'',closeBtn:'',
 fmtT:x=>String(x),fmtHourL:x=>String(x),LONG:0,
 canWrite:()=>true,
 kGroup:(a,b)=>b
};
vm.createContext(env);
vm.runInContext(source,env);
assert.equal(typeof PAGES.tasks.render,'function','Tasks registered');
const params={tab:'deadlines'};
let html=PAGES.tasks.render(params);
assert(html.includes('Algebra exam')&&html.includes('Finished test'));
assert(html.includes('Done (1)')&&html.includes('Tomorrow'));
assert(html.includes('p3-count urgent'));
assert(html.includes('data-id="d1"')&&html.includes('--p3-subject:#3D7EA6'));
assert(html.includes('exam')&&html.includes('due'),'semantic bundled deadline icons');
assert(html.includes('Done</span>'),'completed rows do not say overdue');
assert.equal(env.p3DueLabel('2026-10-28'),'Tomorrow');
assert.equal(env.p3DueLabel('2026-10-27'),'Yesterday'); // mocked daysUntil defaults to -1

params.tab='backlog';html=PAGES.tasks.render(params);
assert(html.includes('Finish chapter')&&html.includes('Plan all'));
assert(html.includes('data-act="p3-schedule" data-id="t1"'));
params.tab='weekly';html=PAGES.tasks.render(params);
assert(html.includes('Lecture')&&html.includes('10:00–11:30'));
assert(PAGES.tasks.actions().includes('data-act="p3-add"'));
const el=(pairs)=>({getAttribute:k=>pairs[k]||null});
ACT['p3-tab'](el({'data-v':'backlog'}));
assert.equal(UI.p3Tab,'backlog');assert.equal(UI.pages.at(-1).params.tab,'backlog');
ACT['p3-add']();assert.equal(UI.sheet.type,'task');
assert(!SHEETS.task(UI.sheet).includes('Schedule it'),'old verbose scheduling removed');
assert(SHEETS.task(UI.sheet).includes('Find time')&&SHEETS.task(UI.sheet).includes('Save'));
ACT['p3-min'](el({'data-v':'90'}));assert.equal(UI.sheet.minutes,90);
ACT['p3-schedule'](el({'data-id':'t1'}));
assert(calls.includes('scheduled:t1:2026-10-30:null'));
UI.pages.at(-1).params.tab='deadlines';ACT['p3-add']();assert.equal(UI.sheet.type,'deadline');
assert(SHEETS.deadline(UI.sheet).includes('Deadline'));
const icons=fs.readFileSync(path.join(__dirname,'../ui/icons.js'),'utf8');
for(const key of ['exam','due','other','high'])
  assert(icons.includes('"'+key+'":'),key+' must be bundled for P3');
assert(!source.includes("icon:'education'")&&!source.includes("icon:'file'"),
  'all P3 deadline icon keys must exist in the bundle');
UI.pages.at(-1).params.tab='weekly';ACT['p3-add']();
assert.equal(UI.sheet.type,'busy');assert.equal(UI.sheet.rec,true);
const days=UI.sheet.days.slice();
ACT['p3-day'](el({'data-d':String(days[0])}));
assert(!UI.sheet.days.includes(days[0]));
assert(SHEETS.busy(UI.sheet).includes('Weekly item'));
UI.sheet={type:'task',id:'t1',armed:false};
ACT['p3-task-delete']();assert.equal(UI.sheet.armed,true);
ACT['p3-task-delete']();assert.equal(UI.sheet,null);
assert(writes.some(w=>w[0]==='planning/backlog'&&w[1].items.t1===null));
assert(!/#[0-9a-fA-F]{3,8}\b|font-family|box-shadow/.test(css),'kit tokens only');
console.log('TASKS TESTS PASSED');
