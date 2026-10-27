// R0a: registry-based shell and build-manifest regression tests.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {app,css}=require('./src');
const shell=fs.readFileSync(path.join(__dirname,'../ui/shell.js'),'utf8');
const manifest=require('../files.json'),build=fs.readFileSync(path.join(__dirname,'../build.py'),'utf8');
const between=(a,b)=>{
  const from=shell.indexOf(a),to=shell.indexOf(b,from+a.length);
  assert.ok(from>=0&&to>from,'missing shell boundary '+a);
  return shell.slice(from,to);
};
assert.equal(manifest.js.at(-1),'boot.js');
const combined=fs.readFileSync(path.join(__dirname,'../logic.js'),'utf8')+
  String.fromCharCode(10)+manifest.js.map(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8')).join(String.fromCharCode(10));
assert.doesNotThrow(()=>new vm.Script(combined),'bundled modules parse as one script');
assert.ok(combined.indexOf('SUBMIT = {}')<combined.indexOf('Object.assign(SUBMIT,'),'submit registry ready');

assert.equal(manifest.js[2],'core/state.js');
assert.equal(manifest.css[0],'ui/kit.css');
assert.ok(manifest.js.includes('ui/shell.js'));
assert.ok(!manifest.js.includes('app.js'),'monolith no longer built');
assert.ok(!manifest.css.includes('style.css'),'monolith styles no longer built');
assert.ok(!build.includes('fonts.googleapis'),'Google Fonts loading removed');
assert.ok(build.includes('interactive-widget=resizes-content'));
assert.ok(build.includes('id="pop"'));
assert.ok(!build.includes('id="hdr"'),'top bar removed');
assert.ok(!shell.includes('function vHeader()'),'header renderer removed');
assert.ok(!shell.includes("getElementById('hdr')"),'no missing header morph');
assert.ok(shell.includes('return kNav(UI.view)'), 'four tab kit nav');
assert.ok(shell.includes('function vSyncLine()'), 'sync status on Today');
assert.ok(shell.includes('VIEWS[view]'), 'registered views');
assert.ok(shell.includes('PAGES[top.id]'), 'registered pages');
assert.ok(shell.includes('SHEETS[sh.type]'), 'registered sheets');
assert.ok(shell.includes("e.key==='Escape'"), 'Escape goes through back handler');
assert.ok(shell.includes("window.addEventListener('popstate'"), 'browser back goes through handler');
assert.ok(css.includes('.k-nav-item') && css.includes('grid-template-columns:repeat(4,1fr)'));
assert.ok(css.includes('.k-sheet-head') && css.includes('.k-page-head'));
const runtime={
  UI:{view:'plan',pages:[],sheet:null},
  PAGES:{tasks:{title:()=> 'Tasks',render:()=>'<p>list</p>'}},
  VIEWS:{today:()=>'<span>timer</span>',plan:()=>'<p>plan</p>',stats:()=>'<p>stats</p>',settings:()=>'<p>settings</p>'},
  S:{conn:'live',owner:true,pending:[]},
  syncState:()=> 'live',icon:()=>'',kBtn:()=>'<button>Retry</button>',
  kPageHead:()=>'<header>Tasks</header>',vNotices:()=>'<p>sign-in</p>',console
};
const section=between('function canonicalView(v)',"function vSheet()");
const ctx=vm.createContext(runtime);
const render=vm.runInContext(section+'\n[vMain,vSyncLine,canonicalView]',ctx);
const [vMain,vSyncLine,canonical]=render;
assert.equal(canonical('calendar'),'plan');assert.equal(canonical('week'),'stats');
assert.ok(vMain().includes('plan'));
runtime.UI.pages=[{id:'tasks',params:{}}];assert.ok(vMain().includes('<header>Tasks</header>'));
runtime.UI.pages=[];runtime.UI.view='today';
assert.ok(vMain().includes('timer'));
assert.equal(vSyncLine(),'');
runtime.syncState=()=> 'offline';runtime.S.pending=[{},{}];
assert.ok(vSyncLine().includes('2 waiting'));
runtime.syncState=()=> 'readonly';assert.ok(vSyncLine().includes("Can't save"));
runtime.S.conn='none';assert.ok(vMain().includes('sign-in'));
assert.ok(app.includes('Object.assign(ACT,'),'action registration preserved');

/* Execute all module initializers, but not boot's asynchronous sign-in. */
const startup=fs.readFileSync(path.join(__dirname,'../logic.js'),'utf8')+
  String.fromCharCode(10)+manifest.js.filter(p=>p!=='boot.js')
    .map(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8')).join(String.fromCharCode(10));
const fakeDoc={
  addEventListener(){}, getElementById(){return null;}, querySelector(){return null;},
  documentElement:{style:{}}, body:{}, visibilityState:'visible'
};
const fakeWindow={
  innerWidth:390,addEventListener(){},matchMedia(){return {matches:false}},
  Capacitor:null
};
const startupCtx=vm.createContext({
  window:fakeWindow,document:fakeDoc,
  localStorage:{getItem(){return null},setItem(){},removeItem(){}},
  navigator:{}, location:{hash:'',pathname:'/',origin:'https://example.test'},
  history:{pushState(){},replaceState(){}},
  requestAnimationFrame(){return 1},cancelAnimationFrame(){},
  setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},
  console,Date,Intl,URL,Blob,Math,Set,Map,Promise
});
assert.doesNotThrow(()=>vm.runInContext(startup,startupCtx,{timeout:5000}),
  'all module initializers run in manifest order');
assert.equal(vm.runInContext('typeof SUBMIT',startupCtx),'object');
assert.equal(vm.runInContext('typeof VIEWS.plan',startupCtx),'function');
assert.equal(vm.runInContext('typeof SHEETS.entry',startupCtx),'function');

const toastOutput={html:''};
const toastEnv={
  UI:{toast:null,lastRate:null},
  document:{getElementById:()=>({})},
  morphInto:(_el,html)=>{toastOutput.html=html;},
  esc:s=>String(s), kBtn:(label,attrs)=>'<button '+attrs+'>'+label+'</button>',
  clearTimeout:()=>{}, setTimeout:()=>1
};
const [showToast]=vm.runInNewContext(between('let toastT = 0;', '/* ---------- rendering:')+
  '\n[toast,renderToast]',toastEnv);
showToast('Update ready',{persist:true,action:{label:'Restart',act:'upd-restart'}});
assert.ok(toastOutput.html.includes('data-act="upd-restart"'),'persistent update toast has Restart action');
showToast('Stopped',{undo:true,action:{label:'Restart',act:'upd-restart'}});
assert.ok(toastOutput.html.includes('data-act="undo"'),'undo gets the sole action');
assert.ok(!toastOutput.html.includes('data-act="upd-restart"'),'undo excludes a second action');
console.log('SHELL TESTS PASSED');
