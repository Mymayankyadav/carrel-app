'use strict';
const assert=require('node:assert/strict');
const {nextReview,dueTopics,l4PlusDays,l4KeyValid}=require('../logic/spacing.js');
const today='2026-10-28';
const next=(topic,rating,exam)=>nextReview(topic,rating,today,exam);
assert.deepEqual(next({},3),{interval:3,due:'2026-10-31',reps:1,last:today});
assert.deepEqual(next({},2),{interval:2,due:'2026-10-30',reps:1,last:today});
assert.deepEqual(next({},1),{interval:1,due:'2026-10-29',reps:1,last:today});
assert.deepEqual(next({interval:4,reps:3},3),{interval:10,due:'2026-11-07',reps:4,last:today});
assert.deepEqual(next({interval:4,reps:3},2),{interval:7,due:'2026-11-04',reps:4,last:today});
assert.deepEqual(next({interval:8,reps:3},1),{interval:1,due:'2026-10-29',reps:4,last:today});
assert.equal(next({interval:20},3,'2026-11-11').due,'2026-11-09','15% before exam');
assert.equal(next({interval:10},3,'2026-10-29').due,'2026-10-29','tomorrow exam');
assert.equal(next({interval:10},3,'2026-10-28').due,'2026-11-22','past and today exams ignored');
assert.equal(next({interval:10},3,'2026-10-20').due,'2026-11-22','past exam ignored');
assert.equal(next({interval:1},3,'2027-01-01').due,'2026-10-31','long-range exam does not pull forward');
assert.equal(next({interval:3},2,'2026-11-03').due,'2026-11-02','exam pull forward 1 day');
assert.equal(next({interval:2},3,'2026-11-04').due,'2026-11-02','exam pull forward 1 day');
assert.equal(next({interval:0},2).interval,2,'bad interval defaults 1');
assert.equal(next({interval:NaN},3).interval,3);
assert.equal(next({},4),null);
assert.equal(next({},0),null);
assert.equal(next({},3,'not a date').due,'2026-10-31');
assert.equal(next({},3,'2026-02-31').due,'2026-10-31');
assert.equal(next({},3,'2026-11-01').due,'2026-10-31');
assert.equal(nextReview({},3,'not a date'),null);
assert.equal(l4PlusDays('2026-12-31',1),'2027-01-01');
assert.equal(l4PlusDays('2024-02-28',1),'2024-02-29');
assert.equal(l4PlusDays('2023-02-28',1),'2023-03-01');
assert.equal(l4KeyValid('2026-02-29'),false);
assert.equal(l4KeyValid('2024-02-29'),true);
const topics={
  first:{subject:'math',title:'Topology',due:'2026-10-28'},
  second:{subject:'phy',title:'Optics',due:'2026-10-27'},
  future:{subject:'chem',title:'Atoms',due:'2026-10-29'},
  gone:{subject:'phy',title:'Forgetting',due:'2026-10-27',archived:true},
  bad:{subject:'math',title:'Bad',due:'2026-15-91'}
};
assert.deepEqual(dueTopics(topics,today).map(t=>t.id),['second','first']);
assert.deepEqual(dueTopics(topics,'2026-10-29').map(t=>t.id),['second','first','future']);
assert.deepEqual(dueTopics(topics,'2026-10-26'),[]);
assert.deepEqual(dueTopics([],today),[]);
assert.deepEqual(dueTopics(topics,'none'),[]);
assert.deepEqual(dueTopics([{id:'t1',subject:'math',title:'One',due:today}],today).map(x=>x.id),['t1']);
console.log('L4 SPACING TESTS PASSED');
