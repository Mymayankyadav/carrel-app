// W1 component-level assertions; run with TZ=Asia/Kolkata node web/test/welcome_test.js.
const assert=require('assert');
const fs=require('fs'),vm=require('vm'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../ui/welcome.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../ui/welcome.css'),'utf8');
const acts={},v={};
const env={
 ACT:acts,VIEWS:v,UI:{onbText:''},CFG:{onboarded:false},S:{conn:'none',owner:true},
 a1CleanupPending:[],a1CleanupBusy:new Set(),
 ACTS:[],ACTMAP:{},SUGGEST:['Physics','Calculus','Biology','History','Economics'],
 esc:x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])),
 icon:()=>'<svg></svg>',kBtn:(label,attrs,o)=>'<button data-kind="'+(o.kind||'')+'" '+attrs+'>'+label+'</button>',
 saveAct:(id,data)=>{env.saved=[id,data]},Object,Set
};
vm.createContext(env);vm.runInContext(source,env);
let page=v.welcome();
assert(page.includes('Carrel')&&page.includes('data-act="signin"')&&page.includes('Continue with Google'));
assert(!page.includes('tagline')&&!page.includes('Sign out'));
env.a1CleanupPending.push('u1');
page=v.welcome();
assert(page.includes('Device cache not cleared') && page.includes('a1-retry-cache-clear'));
env.a1CleanupBusy.add('u1');
page=v.welcome();
assert(page.includes('Clearing device cache') && page.includes('disabled'));
env.a1CleanupPending.length=0;env.a1CleanupBusy.clear();
env.S.owner=false;env.S.conn='live';
page=v.welcome();assert(page.includes('This tracker is private')&&page.includes('data-act="signout"'));
assert(!page.includes('data-act="signin"'));
assert(!source.includes('Add the starter set'),'long explanatory legacy onboarding removed');
assert(env.w1NeedsSetup(),'no subjects means first run');
page=env.w1FirstRun();
assert(page.includes('What do you study?')&&page.includes('data-submit="onb-add"'));
assert(page.includes('data-act="onb-chip"')&&page.includes('data-name="Physics"'));
assert(page.includes('data-act="onb-done" disabled'),'Continue disabled until subjects exist');
env.ACTS.push({id:'phys',name:'Physics',kind:'study',archived:false});
env.ACTMAP.phys=env.ACTS[0];
page=env.w1FirstRun();
assert(page.includes('data-act="w1-remove" data-id="phys"'));
assert(!page.includes('data-name="Physics"'),'suggestion not duplicated after add');
assert(page.includes('data-act="onb-done"'),'Continue displayed');
assert(!page.includes('data-act="onb-done" disabled'),'Continue enabled with subject');
acts['w1-remove']({getAttribute:()=> 'phys'});
assert.equal(env.saved[0],'phys');assert.equal(env.saved[1].archived,true);
env.CFG.onboarded=true;assert.equal(env.w1NeedsSetup(),false);
env.ACTS[0].archived=true;assert.equal(env.w1NeedsSetup(),true);
env.UI.onbText='<script>alert(1)</script>';
assert(!env.w1FirstRun().includes('value="<script>'),'onboard text HTML-escaped');
assert(css.includes('.w1-auth')&&css.includes('.w1-setup'));
assert(!/#[0-9a-fA-F]{3,8}\b|font-family|box-shadow/.test(css),'only kit design tokens');
console.log('WELCOME TESTS PASSED');
