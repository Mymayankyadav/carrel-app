'use strict';
// L4 QA: a failed offline enqueue must not dismiss the only editable copy.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../ui/subjects.js'),'utf8');
let saveOK=false,commits=0,closes=0,renders=0;
const ctx={
  VIEWS:{},PAGES:{},SHEETS:{},ACT:{},UI:{sheet:null},
  V:{topics:{}},ACTMAP:{math:{kind:'study',archived:false,name:'Maths'}},
  todayKey:()=> '2026-10-31',deadlineList:()=>[],
  nextReview:()=>({interval:3,due:'2026-11-03',reps:1,last:'2026-10-31'}),
  shortDay:k=>k,addDaysKey:()=> '2026-11-01',firstStudyId:()=> 'math',
  uid:()=> 'newtopic',
  W:()=>({ops:[],set(path,data){this.ops.push({path,data});return this;},
    update(path,data){this.ops.push({path,data});return this;}}),
  commit:()=>{commits++;return saveOK;},
  closeSheet:()=>{closes++;ctx.UI.sheet=null;},
  renderSheet:()=>{renders++;}
};
vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'subjects.js'});
const sh={type:'topic',id:null,d:{title:'Finite groups',subject:'math',rating:null},err:''};
ctx.UI.sheet=sh;
ctx.ACT['l4-topic-save']();
assert.equal(commits,1,'save was attempted');
assert.equal(closes,0,'failed save must not close editor');
assert.equal(ctx.UI.sheet,sh,'unsaved form stays editable');
assert.equal(sh.d.title,'Finite groups','typed data survives storage failure');
assert.match(sh.err,/not saved/i,'actionable error is visible');
assert.equal(renders,1,'failure refreshes the error state');
saveOK=true;
ctx.ACT['l4-topic-save']();
assert.equal(commits,2,'retry must actually persist');
assert.equal(closes,1,'only successful save closes editor');
assert.equal(ctx.UI.sheet,null);
ctx.V.topics.old={subject:'math',title:'Old',archived:false};
const edit={type:'topic',id:'old',d:{title:'Revised',subject:'math',rating:null},err:''};
ctx.UI.sheet=edit;saveOK=false;
ctx.ACT['l4-topic-save']();
assert.equal(ctx.UI.sheet,edit,'failed edit retains draft');
assert.equal(closes,1);
assert.match(edit.err,/not saved/i);
saveOK=true;ctx.ACT['l4-topic-save']();
assert.equal(closes,2,'successful edit closes');
const archive={type:'topic',id:'old',d:{title:'Revised',subject:'math'},err:''};
ctx.UI.sheet=archive;saveOK=false;
ctx.ACT['l4-delete-topic']();
assert.equal(ctx.UI.sheet,archive,'failed archive retains topic editor');
assert.match(archive.err,/not archived/i);
assert.equal(closes,2);
saveOK=true;ctx.ACT['l4-delete-topic']();
assert.equal(closes,3,'successful archive closes');
saveOK=false;
assert.equal(ctx.l4ReviewTopic('old',3),false,'failed review is not reported as saved');
const before=renders;
ctx.ACT['l4-review-rate']({getAttribute:k=>k==='data-id'?'old':'3'});
assert.equal(renders,before,'failed review does not claim an accepted rating');
saveOK=true;
assert.equal(ctx.l4ReviewTopic('old',3),true,'successful review is acknowledged');
delete ctx.V.topics.old;
const stale={type:'topic',id:'old',d:{title:'Stale',subject:'math',rating:null},err:''};
ctx.UI.sheet=stale;
const previous=commits;
ctx.ACT['l4-topic-save']();
assert.equal(commits,previous,'removed topic must not be recreated under another ID');
assert.equal(ctx.UI.sheet,stale);
assert.match(stale.err,/no longer available/i);
ctx.ACTMAP.math.archived=true;
const inactive={type:'topic',id:null,d:{title:'Invalid subject',subject:'math',rating:null},err:''};
ctx.UI.sheet=inactive;ctx.ACT['l4-topic-save']();
assert.equal(commits,previous,'archived subject cannot receive a new topic');
assert.match(inactive.err,/active study subject/i);
console.log('QA L4 TOPIC DURABLE WRITE TESTS PASSED');
