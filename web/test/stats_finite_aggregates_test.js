'use strict';
// L7 QA: malformed persisted study/goal/drift values must not poison Insights.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../ui/stats.js'),'utf8');
const MIN=60000;
const math={id:'math',name:'Math',kind:'study',archived:false,goal:Infinity,color:'#123456'};
const physics={id:'physics',name:'Physics',kind:'study',archived:false,goal:'120',color:'#abcdef'};
const opened=[];
const env={
  ACT:{},SHEETS:{},VIEWS:{},ACTS:[math,physics],ACTMAP:{math,physics},
  MIN,CFG:{dailyGoal:60},V:{distractions:{
    '2026-10-26':{items:{
      a:{type:'drift',driftMin:Infinity},b:{type:'drift',driftMin:-5},
      c:{type:'drift',driftMin:12},d:{type:'drift',driftMin:'8'},
      e:{type:'drift',driftMin:[30]},f:{type:'drift',driftMin:100,dismissed:true}
    }}
  }},
  isStudyId:id=>id==='math'||id==='physics',
  addDaysKey:(k,n)=>new Date(Date.parse(k+'T00:00:00Z')+n*86400000).toISOString().slice(0,10),
  l3Factor:()=>1,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
  openSheet:sh=>opened.push(sh),
  Math,Date,Array,Object
};
vm.createContext(env);
vm.runInContext(source,env);
const agg={
  '2026-10-26':{acts:{math:Infinity,physics:20*MIN}},
  '2026-10-27':{acts:{math:45*MIN,physics:-20*MIN}},
  '2026-10-28':{acts:{math:[30*MIN]}},
  '2026-10-29':{acts:{math:'600000'}}
};
env.qaAgg=agg;
const buckets=vm.runInContext("s1Buckets({ws:'2026-10-26',month:false},qaAgg)",env);
assert.equal(buckets[0].total,20*MIN,'infinite study history cannot inflate daily bars');
assert.equal(buckets[1].total,45*MIN,'negative study history cannot cancel valid time');
assert.equal(buckets[2].total,0,'arrays are not numeric study evidence');
assert.equal(buckets[3].total,10*MIN,'legacy numeric strings remain valid');
const summary=vm.runInContext("l7WeekData({weeks:1},qaAgg)",env);
assert.equal(summary.total,75*MIN,'week total excludes corrupt duration values');
assert.equal(summary.goal,120*MIN,'invalid infinite subject goal cannot poison weekly target');
assert.equal(summary.subjects[0].goalMin,0);
assert.equal(summary.subjects[1].goalMin,120);
assert.equal(summary.subjects[0].studiedMin,55);
assert.equal(vm.runInContext("l7Drift('2026-10-26','2026-10-27')",env),20,
  'drift ignores infinite, negative, array and dismissed values');
const badRing=vm.runInContext("l7GoalRing(Infinity,Infinity)",env);
assert(badRing.includes('0%')&&!/NaN|Infinity/.test(badRing),
  'invalid goal ring renders a finite percentage and SVG');
assert(vm.runInContext("l7GoalRing(60000,60000)",env).includes('100%'),
  'valid ring behavior remains unchanged');
assert.equal(vm.runInContext("l7TopSubject().id",env),'physics',
  'invalid infinite goal cannot win the fresh-start suggestion');
env.ACT['l7-goal-open']();
assert.equal(opened[0].subject,'physics');
assert.equal(opened[0].hours,2,'fresh-start sheet preserves valid weekly goals');
console.log('L7 FINITE AGGREGATES TESTS PASSED');
