'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {parse}=require('../logic/parse.js');

const writes=[],commits=[];
const ctx={
  UI:{sheet:null},ACT:{},SHEETS:{},ACTS:[],ACTMAP:{},CFG:{weekStart:1},
  Date,l9Parse:parse,renderSheet(){},closeSheet(){},
  W(){return {
    update(...args){writes.push(['update',...args]);},
    set(...args){writes.push(['set',...args]);},
    plan(...args){writes.push(['plan',...args]);}
  };},
  commit(...args){commits.push(args);},
  uid(){return 'test-id';},isoLocal(){return '2026-10-30T09:00:00';},
  nextBacklogOrder(){return 1;},firstStudyId(){return null;}
};
vm.runInNewContext(fs.readFileSync(require.resolve('../ui/capture.js'),'utf8'),ctx,{filename:'capture.js'});
function attempt(text,type,override,shouldWrite){
  const before=writes.length, beforeCommits=commits.length;
  ctx.UI.sheet={type:'capture',text,manualType:type,override:override||{},err:''};
  ctx.l9CaptureSave();
  assert.equal(writes.length-before,shouldWrite?1:0,text+' writes');
  assert.equal(commits.length-beforeCommits,shouldWrite?1:0,text+' commits');
  if(!shouldWrite)assert.equal(ctx.UI.sheet.err,'Choose a valid date.',text+' warning');
}
attempt('essay due 2026-02-31','deadline',null,false);
attempt('essay due 2025-02-29','task',null,false);
attempt('essay due 2026-13-10','deadline',null,false);
attempt('essay due 2026-02-31','deadline',{date:'2026-03-01'},true);
assert.equal(writes.at(-1)[2].items['test-id'].date,'2026-03-01');
attempt('essay due 2026-11-12','deadline',null,true);
assert.equal(writes.at(-1)[2].items['test-id'].date,'2026-11-12');
attempt('essay due 2026-02-31','ask',null,true);
assert.equal(writes.at(-1)[0],'set');
console.log('L9 ISO CAPTURE WRITE GUARD TESTS PASSED');
