// G2 page registry and live action contracts.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../ui/settings-pages.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../ui/settings-pages.css'),'utf8');
const names=['timer','day','calendar','claude','data','account','about','keys'];
const saved=[],called=[];
const ACT={'pomo-toggle':()=>called.push('pomo')};
const CFG={pomodoro:{focus:25,short:5,long:15,every:4},dayStart:'04:00',planStart:'08:00',planEnd:'22:30',gap:10,dailyGoal:240,guardHours:4,weekStart:1,clock:'auto'};
const UI={pomoOn:true};
const PAGES={};
const env={
 ACT,CFG,UI,PAGES,PRESETS:{'25/5':{focus:25,short:5,long:15,every:4},'50/10':{focus:50,short:10,long:20,every:3},'90/20':{focus:90,short:20,long:30,every:2}},
 S:{mcp:null,dl:true,user:{email:'math@example.com'}},GC:{status:'off',events:[]},UPDI:{busy:false,bundle:'1.0.20',build:100009,apk:null,web:''},
 ENTRIES:[{running:false},{running:true}],PROMPTS:[['Prove this theorem','unused'],['Review my week','unused']],
 presetLabel:o=>o.focus+'/'+o.short,todayKey:()=> '2026-10-27',store:{get:()=>null},icon:()=> '<svg></svg>',esc:s=>String(s),
 kField:(s,c)=>'<label>'+s+c+'</label>',kSwitch:()=>'<button role="switch"></button>',
 kSeg:()=>'<div class="k-seg"></div>',kEmpty:s=>s,kIconBtn:(_ic,l,attrs)=>'<button '+attrs+'>'+l+'</button>',
 kRow:o=>'<div class="k-row" '+(o.attrs||'')+'>'+o.label+(o.value||'')+'</div>',
 kBtn:()=>'',saveSetting:o=>saved.push(o),render:()=>called.push('render'),Object,Date,Math
};
vm.createContext(env);vm.runInContext(source,env);
names.forEach(n=>{const page=PAGES['settings.'+n];assert(page&&typeof page.render==='function','register '+n);assert(page.title);});
assert(PAGES['settings.timer'].render().includes('Ask if running longer than'));
assert(PAGES['settings.day'].render().includes('Day starts at'));
assert(PAGES['settings.claude'].render().includes('Prove this theorem'));
assert(PAGES['settings.data'].render().includes('data-f="csv"'));
assert(PAGES['settings.account'].render().includes('math@example.com'));
assert(PAGES['settings.about'].render().includes('1.0.20'));
assert(PAGES['settings.keys'].render().includes('Ctrl Z'));
assert(PAGES['settings.calendar'].render().includes('Not available here'));
ACT['g2-pomo']();assert(called.includes('pomo'));
const el=(key,d)=>({getAttribute:k=>k==='data-key'?key:k==='data-d'?String(d):null});
ACT['g2-nudge'](el('gap',-5));assert.equal(saved.at(-1).gap,5);
ACT['g2-nudge'](el('pomo.focus',5));assert.equal(saved.at(-1).pomodoro.focus,30);
ACT['g2-nudge'](el('dailyGoal',30));assert.equal(saved.at(-1).dailyGoal,270);
ACT['g2-week']({getAttribute:()=> '6'});assert.equal(saved.at(-1).weekStart,6);
ACT['g2-clock']({getAttribute:()=> '24'});assert.equal(saved.at(-1).clock,'24');
ACT['g2-preset']({getAttribute:()=> 'custom'});assert(UI.g2Custom);
ACT['g2-preset']({getAttribute:()=> '50/10'});assert.equal(saved.at(-1).pomodoro.focus,50);
assert(!/#[0-9a-fA-F]{3,8}\b|font-family|box-shadow/.test(css),'G2 CSS uses tokens only');
env.S.mcp={};env.GC.status='ok';env.GC.events=[{e:Date.now()+60000}];
assert(PAGES['settings.calendar'].render().includes('Connected'));
assert(PAGES['settings.calendar'].render().includes('1 upcoming'));
env.GC.status='needs_reauth';
assert(PAGES['settings.calendar'].render().includes('Not connected'));
assert(PAGES['settings.calendar'].render().includes('data-act="gc-connect"'));
console.log('SETTINGS PAGES TESTS PASSED');
