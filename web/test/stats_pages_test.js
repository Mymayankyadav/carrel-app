// S2 isolated renderer tests; root Stats is owned by S1.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const js=fs.readFileSync(path.join(__dirname,'../ui/stats-pages.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../ui/stats-pages.css'),'utf8');
const MIN=60000,now=Date.now();
const entries=[{a:'math',s:now-60*MIN,e:now-10*MIN,note:'Topology',focus:3}];
const act={id:'math',name:'Mathematics',kind:'study',goal:180,color:'#445566'};
const UI={weekOff:0,s2Weeks:4};
const ACT={},PAGES={},calls=[];
const model={
 fromK:'2026-10-01',tk:'2026-10-27',studyDays:4,studyTotal:50*MIN,heat:Array.from({length:7},()=>Array(24).fill(10*MIN)),
 wdCount:Array(7).fill(4),dsh:4,lens:[45,60],median:45,streak:2
};
const env={
 ACT,PAGES,ACTS:[act],ACTMAP:{math:act},UI,ENTRIES:entries,
 V:{distractions:{'2026-10-26':{items:{one:{type:'urge'},two:{type:'drift'}}}}},
 MIN,CFG:{weekStart:1,minDay:25},Date,Math,Object,Array,
 todayKey:()=> '2026-10-27',weekStartKey:()=> '2026-10-26',addDaysKey:(k,delta)=> k,
 isStudyId:id=>id==='math',l3History:()=>[{planned:50,actual:60}],
 estimateFactor:()=>1.2,l7Accuracy:()=>80,
 flexibleStreak:()=>({count:3,status:{'2026-10-26':'met','2026-10-27':'met'}}),
 l7Days:()=>({'2026-10-26':60,'2026-10-27':40}),
 ensureRange:()=>{},patternsModel:()=>model,
 aggregate:()=>({'2026-10-26':{acts:{math:50*MIN}}}),
 insights:()=>[{text:'You studied.'}],entryEnd:e=>e.e,dayKeyOf:()=> '2026-10-27',
 fmtDur:ms=>Math.round(ms/MIN)+'m',fmtT:()=> '7 pm',fmtHourL:h=>String(h),fmtHourS:h=>String(h),fmtMinOfDay:h=>String(h),
 shortDay:k=>k,rowWeekday:i=>'Monday',esc:x=>String(x),icon:()=>'<svg></svg>',
 kEmpty:s=>s,kSeg:()=>'<div>range</div>',kIconBtn:()=>'<button></button>',
 kRow:o=>'<row>'+o.label+(o.value||'')+'</row>',
 kGroup:(_name,body)=>'<section>'+body+'</section>',act:()=>act,
 openPage:(tab,id,p)=>calls.push([tab,id,p]),render:()=>calls.push('render')
};
vm.createContext(env);vm.runInContext(js,env);
assert.deepEqual(Object.keys(PAGES).sort(),['stats.estimates','stats.focus','stats.insights',
 'stats.patterns','stats.streak','stats.subject']);
const subj=PAGES['stats.subject'].render({id:'math'});
assert(subj.includes('50m')&&subj.includes('Topology'));
assert(subj.includes('Recent')&&subj.includes('goal'));
const patterns=PAGES['stats.patterns'].render();
assert(patterns.includes('When you study')&&patterns.includes('Typical session'));
assert.equal((patterns.match(/s2-heat-cell/g)||[]).length,168);
assert(patterns.includes('>2</strong>'),'noticed events counted');
assert(PAGES['stats.insights'].render().includes('You studied.'));
assert(PAGES['stats.focus'].render().includes('3.0 / 3'),'rated study shown');
assert(PAGES['stats.estimates'].render().includes('80%'),'accuracy shown');
assert(PAGES['stats.streak'].render().includes('3'),'flexible streak page');
ACT['s2-weeks']({getAttribute:()=> '12'});assert.equal(UI.s2Weeks,12);
ACT['s2-edit']({getAttribute:()=> 'math'});assert.equal(calls.at(-1)[1],'settings.activity');
assert(!/#[0-9a-fA-F]{3,8}\b|font-family|box-shadow/.test(css),'token-only CSS');
console.log('STATS PAGES TESTS PASSED');
