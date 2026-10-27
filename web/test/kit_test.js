/* R0b independent kit tests. Run: TZ=Asia/Kolkata node web/test/kit_test.js */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const kit=fs.readFileSync(path.join(__dirname,'../ui/kit.js'),'utf8');
const icons=fs.readFileSync(path.join(__dirname,'../ui/icons.js'),'utf8');
const state={
  UI:{view:'today',sheet:null,pages:[],open:{}},
  ACT:{},
  P:{},
  PAGES:{},
  ACTS:[{id:'math',name:'Mathematics',color:'#3D7EA6',kind:'study'}],
  calls:[],
  render(){this.calls.push('render');},
  closeSheet(){this.UI.sheet=null;this.calls.push('close-sheet');},
  setBind(k,v){this.calls.push(['bind',k,v]);},
  esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');},
  console,
  setTimeout,clearTimeout,
};
vm.createContext(state);
vm.runInContext([
  "const UI=globalThis.UI, ACT=globalThis.ACT, PAGES=globalThis.PAGES, P=globalThis.P, ACTS=globalThis.ACTS;",
  "const esc=globalThis.esc;",
  "function render(){globalThis.render.call(globalThis)}",
  "function closeSheet(){globalThis.closeSheet.call(globalThis)}",
  "function setBind(k,v){globalThis.setBind.call(globalThis,k,v)}",
  "const icon=name=>'<svg>'+(P[name]||'')+'</svg>';",
].join(String.fromCharCode(10)),state);
vm.runInContext(icons,state);
vm.runInContext(kit,state);
const run = src => vm.runInContext(src,state);
assert.match(run("kIconBtn('add', 'Add entry', 'data-act=\"noop\"')"),/aria-label="Add entry" title="Add entry"/);
assert.match(run("kIconBtn('edit', '<unsafe>')"),/aria-label="&lt;unsafe&gt;"/);
assert.match(run("kSwitch({bind:'d.on',on:true,label:'Notifications'})"),/role="switch"[^>]*aria-checked="true"/);
assert.match(run("kSwitch({bind:'d.on',on:true,label:'Notifications'})"),/data-v="false"/);
assert.match(run("kSeg({bind:'v',value:'week',options:[{v:'day',label:'Day'},{v:'week',label:'Week'}]})"),/aria-pressed="true"/);
assert.match(run("kRow({label:'Maths',dot:'#3D7EA6',sub:'Today'})"),/k-row-sub/);
assert.match(run("kPageHead('Settings')"),/data-act="k-back"/);
assert.match(run("kSheetHead('Edit')"),/data-act="sheet-close"/);
assert.match(run("kBtn('Save','',{kind:'primary'})"),/k-btn primary/);
assert.ok(state.P.today && state.P.settings,'bundled icons should populate P');
assert.ok(state.PAGES.kit,'kit gallery is registered');
assert.equal(run("pushPage('missing')"),false);
assert.equal(run("pushPage('kit',{demo:1})"),true);
assert.equal(state.UI.pages.length,1);
state.UI.kMenu={items:[]};
assert.equal(run("goBack()"),true); assert.equal(state.UI.kMenu,null);
state.UI.sheet={type:'entry'};assert.equal(run("goBack()"),true);assert.equal(state.UI.sheet,null);
assert.equal(run("goBack()"),true);assert.equal(state.UI.pages.length,0);
state.UI.view='settings';assert.equal(run("goBack()"),true);assert.equal(state.UI.view,'today');
assert.equal(run("goBack()"),false);
const switchEl={getAttribute:k=>({'data-bind-to':'sheet.enabled','data-v':'true'}[k]||null)};
state.ACT['k-set'](switchEl);
assert.deepEqual(state.calls.at(-2),['bind','sheet.enabled',true]);
console.log('KIT TESTS PASSED');
