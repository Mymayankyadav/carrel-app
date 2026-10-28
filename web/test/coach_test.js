'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const now='2026-10-28';
const activity={math:{id:'math',name:'Mathematics',kind:'study',archived:false,color:'#123456'},
  other:{id:'other',name:'Sleep',kind:'life',archived:false,color:'#222222'}};
const proposal={date:'2026-10-29',blocks:[{activity:'math',title:'Read chapter',minutes:60,at:'10:00'}]};
const msg={v:1,at:'2026-10-28T10:00:00+05:30',kind:'plan',from:'claude',
  title:'<img src=x onerror=alert(1)>',body:'Review <script>bad()</script>',status:'new',proposal};
const calls=[],ctx={
  console,Date,Math,Object,Set,
  module:{exports:{}},
  V:{coach:{coach1:msg}},ACTMAP:activity,
  UI:{sheet:null},ACT:{},CARDS:{},SHEETS:{},
  MIN:60000,
  todayKey:()=>now,
  esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
  shortDay:x=>x,fmtDur:x=>String(x/60000)+'m',
  kRow:o=>'<row>'+o.label+'</row>',
  kGroup:(_,html)=>html,
  kSheetHead:title=>title,kSheetFoot:html=>html,
  kBtn:(text,attrs)=>'<button '+attrs+'>'+text+'</button>',
  kEmpty:s=>s,icon:()=>'<icon>',
  openSheet:sh=>{ctx.UI.sheet=sh;},
  closeSheet:()=>{ctx.UI.sheet=null;},
  canWrite:()=>true,
  act:id=>activity[id],
  nextOrder:()=>10,
  blockDoc:x=>x,
  uid:()=> 'b1',
  W:()=>({
    plan(date,data){calls.push({type:'plan',date,data});return this;},
    update(path,data){calls.push({type:'update',path,data});return this;}
  }),
  commit:(text,w)=>{calls.push({type:'commit',text});return true;}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/coach.js'),'utf8'),ctx);
const {l10DateValue,l10ValidCoach,l10ValidProposal}=ctx.module.exports;
assert.equal(l10DateValue('2026-02-30'),null);
assert.equal(l10DateValue('2026-10-28'),Date.parse('2026-10-28T12:00:00Z'));
assert.equal(l10DateValue('not-a-date'),null);
assert.equal(l10ValidProposal(proposal,now,activity).blocks.length,1);
assert.equal(l10ValidProposal({...proposal,date:'2026-11-20'},now,activity),null);
assert.equal(l10ValidProposal({...proposal,date:'2026-10-25'},now,activity),null);
assert.equal(l10ValidProposal({...proposal,blocks:Array(13).fill(proposal.blocks[0])},now,activity),null);
assert.equal(l10ValidProposal({...proposal,blocks:[{...proposal.blocks[0],activity:'other'}]},now,activity),null);
assert.equal(l10ValidProposal({...proposal,blocks:[{...proposal.blocks[0],activity:'missing'}]},now,activity),null);
assert.equal(l10ValidProposal({...proposal,blocks:[{...proposal.blocks[0],minutes:241}]},now,activity),null);
assert.equal(l10ValidProposal({...proposal,blocks:[{...proposal.blocks[0],at:'29:00'}]},now,activity),null);
assert.equal(l10ValidCoach('bad/id',msg),null);
assert.equal(l10ValidCoach('coach1',{...msg,v:2}),null);
assert.equal(l10ValidCoach('coach1',{...msg,from:'attacker'}),null);
assert.equal(l10ValidCoach('coach1',{...msg,title:'x'.repeat(121)}),null);
assert.equal(l10ValidCoach('coach1',{...msg,body:'x'.repeat(5001)}),null);
assert.equal(ctx.CARDS.coach.rank(),78);
const html=ctx.CARDS.coach.render();
assert.match(html,/&lt;img src=x/);
assert.doesNotMatch(html,/<img/);
assert.doesNotMatch(html,/<script/);
ctx.ACT['l10-open']({getAttribute:()=> 'coach1'});
const view=ctx.SHEETS.coach(ctx.UI.sheet);
assert.match(view,/&lt;script&gt;/);
assert.match(view,/Accept plan/);
ctx.ACT['l10-accept']();
assert.equal(calls[0].type,'plan');
assert.equal(calls[0].date,'2026-10-29');
assert.equal(calls[0].data.blocks.b1.from,'claude');
assert.equal(calls[1].path,'coach/coach1');
assert.equal(calls[1].data.status,'accepted');
assert.equal(calls[2].type,'commit');
ctx.V.coach.bad={...msg,kind:'plan',proposal:{...proposal,blocks:[{...proposal.blocks[0],minutes:1000}]}};
ctx.ACT['l10-open']({getAttribute:()=> 'bad'});
assert.doesNotMatch(ctx.SHEETS.coach(ctx.UI.sheet),/Accept plan/);
const old=calls.length;ctx.ACT['l10-accept']();assert.equal(calls.length,old);
ctx.ACT['l10-dismiss']();
assert.equal(calls[old].path,'coach/bad');
assert.equal(calls[old].data.status,'dismissed');
ctx.V.coach.malformed={v:1,title:'Oops',kind:'plan',from:'unknown',body:null,status:'new'};
assert.equal(ctx.l10CoachItems().some(x=>x.id==='malformed'),false);
assert.equal(ctx.l10CoachItems().length,2);
console.log('coach_test: validated and escaped inbox, proposal review, accept/dismiss passed');
