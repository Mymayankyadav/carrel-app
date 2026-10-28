'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),manifest=require('../files.json');
const src=fs.readFileSync(path.join(root,'logic.js'),'utf8')+'\n'+manifest.js.filter(p=>p!=='boot.js').map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
const mem=new Map();
const ctx=vm.createContext({
 window:{innerWidth:390,addEventListener(){},matchMedia(){return {matches:false}},Capacitor:null},
 document:{addEventListener(){},getElementById(){return null},querySelector(){return null},documentElement:{style:{}},body:{}},
 localStorage:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)},
 navigator:{},location:{hash:'',pathname:'/',origin:'https://example.test'},
 history:{pushState(){},replaceState(){}},
 requestAnimationFrame(){return 1},cancelAnimationFrame(){},setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},
 Date,Intl,URL,Blob,Math,Set,Map,Promise,console
});
vm.runInContext(src,ctx,{timeout:5000});
const run=s=>vm.runInContext(s,ctx,{timeout:5000});
for(const id of ['today','plan','subjects','insights'])assert.ok(run("kNav('"+id+"')").includes('data-v="'+id+'"'));
assert.ok(run('VIEWS.subjects()').includes('Coming soon'));
assert.strictEqual(run("canonicalView('stats')"),'insights');
assert.strictEqual(run("typeof watchColl"),'function');
assert.ok(run("PAGES['settings.labs']"));
run("LABS.flowtime={label:'Flowtime',def:true}");
assert.strictEqual(run("lab('flowtime')"),true);
run("S.pending.push({path:'topics/t1',kind:'set',data:{v:1,title:'Topology'}})");
assert.strictEqual(run("computeView().topics.t1.title"),'Topology');
run("CARDS.one={rank:()=>50,render:()=>'<p>One</p>'};CARDS.two={rank:()=>80,render:()=>'<p>Two</p>'}");
assert.strictEqual(run("topCards(1)[0].id"),'two');
assert.ok(run("cardFrame('two')").includes('card-snooze'));
run("ACT['card-snooze']({getAttribute:()=> 'two'})");
assert.strictEqual(run("topCards(3)[0].id"),'one');
run("UI.sheet={step:0,done(){this.completed=true}};kFlow(UI.sheet,[{title:'First',body:()=>'<p>a</p>'},{title:'Second',body:()=>'<p>b</p>'}])");
assert.ok(run("kFlow(UI.sheet,UI.sheet.flowSteps)").includes('Step 1 of 2'));
run("ACT['k-flow-next']()");
assert.strictEqual(run("UI.sheet.step"),1);
run("goBack()");
assert.strictEqual(run("UI.sheet.step"),0);
console.log('F1 FOUNDATION TESTS PASSED');
