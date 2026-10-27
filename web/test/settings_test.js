// G1 settings root and activity save-action contracts.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=fs.readFileSync(path.join(__dirname,'../ui/settings.js'),'utf8');
const activities=fs.readFileSync(path.join(__dirname,'../ui/settings-activities.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../ui/settings.css'),'utf8');
const saved=[],writes=[],calls=[];
const a={id:'math',name:'Mathematics',kind:'study',archived:false,color:'#3D7EA6',goal:60,order:1};
const UI={pages:[{id:'settings.activity',params:{id:'math'}}],g1NewKind:'study'};
const ACT={'act-move':el=>calls.push('move:'+el.getAttribute('data-d'))};
const env={
 ACT,VIEWS:{},PAGES:{'settings.timer':{},'settings.day':{},'settings.activities':{}},UI,
 S:{user:{email:'user@example.com'}},CFG:{pomodoro:{focus:25,short:5},dayStart:'04:00'},
 ACTS:[a],ACTMAP:{math:a},PALETTE:['#3D7EA6','#C2603E'],UPDI:{bundle:'1.0.3',apk:null},NATIVE:false,
 GC:{status:'off'},store:{get:()=>null},window:{matchMedia:()=>({matches:false})},NP:{notifications:true},
 fmtHM:s=>s,fmtDur:v=>String(v),MIN:60000,esc:v=>String(v),icon:()=>'<svg></svg>',
 kRow:o=>'<button '+(o.attrs||'')+'>'+o.label+'</button>',kGroup:(l,html)=>l+html,kEmpty:s=>s,
 kField:(l,control)=>l+control,kSeg:()=>'<span>seg</span>',kSwitch:()=>'<span>switch</span>',
 kSwatches:()=>'<span>swatches</span>',kCollapse:(id,head,html)=>'<details>'+head+html+'</details>',
 kIconBtn:(ic,l,attrs)=>'<button '+attrs+' aria-label="'+l+'"></button>',
 saveAct:(id,patch)=>saved.push({id,patch}),addActivity:name=>({id:'new',doc:{name}}),
 W:()=>({update:(path,patch)=>writes.push({path,patch})}),commit:()=>calls.push('commit'),
 pushPage:(id,params)=>{UI.pages.push({id,params});return true},openMenu:()=>calls.push('menu'),
 render:()=>calls.push('render'),Object,Date,Math
};
vm.createContext(env);vm.runInContext(root+'\n'+activities,env);
assert(env.VIEWS.settings,'settings home registered');
assert(env.PAGES['settings.activities']&&env.PAGES['settings.activity']);
const s=env.VIEWS.settings();
assert(s.includes('Settings')&&s.includes('Activities')&&s.includes('Timer')&&s.includes('Google Calendar'));
assert(!s.includes('Notifications'),'notification row only native');
assert(!s.includes('Setup'),'legacy Setup removed');
assert(env.PAGES['settings.activities'].render().includes('Mathematics'));
assert(env.PAGES['settings.activity'].render().includes('Weekly goal'));
ACT['g1-pin']();assert.deepEqual(saved.at(-1).patch,{today:false});
ACT['g1-goal']({getAttribute:()=> '1'});assert.equal(saved.at(-1).patch.goal,90);
ACT['g1-colour']({getAttribute:()=> '#C2603E'});assert.equal(saved.at(-1).patch.color,'#C2603E');
ACT['g1-role']({getAttribute:()=> 'break'});assert.equal(saved.at(-1).patch.color,'#C2603E','study may not receive a role');
ACT['g1-new']();assert.equal(UI.pages.at(-1).params.id,null);
ACT['g1-name']({value:'Topology',getAttribute:()=> null});
assert.equal(writes.at(-1).path,'config/activities');assert.equal(UI.pages.at(-1).params.id,'new');
assert(!/#[0-9a-fA-F]{3,8}\b|font-family|box-shadow/.test(css),'G1 CSS contains only tokens');
console.log('SETTINGS TESTS PASSED');
