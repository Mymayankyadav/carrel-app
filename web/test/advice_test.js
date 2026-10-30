'use strict';
const assert=require('node:assert/strict');
const {advise,l7Accuracy,flexibleStreak,l7WeekOf}=require('../logic/advice.js');
const subject={id:'maths',name:'Maths',goalMin:600,studiedMin:150,factor:1.4};
let c={subjects:[subject],daysLeft:4,bestHour:9,mostHour:15,overdue:7,
  driftThis:80,driftLast:20,todayMin:0,minDay:25,nearPlanEnd:true,streak:6};
assert.deepEqual(advise(c).map(x=>x.id),['behind','peak','estimate']);
assert.equal(advise(c)[0].action.act,'l7-plan');
assert.deepEqual(advise({...c,dismissed:['behind','peak','estimate']}).map(x=>x.id),['reviews','drift','streak']);
assert.equal(advise({...c,daysLeft:2}).some(x=>x.id==='behind'),false);
assert.equal(advise({...c,subjects:[{...subject,studiedMin:500,factor:1}]}).some(x=>x.id==='estimate'),false);
assert.equal(advise({...c,bestHour:15}).some(x=>x.id==='peak'),false);
assert.equal(advise({...c,overdue:4}).some(x=>x.id==='reviews'),false);
assert.equal(advise({...c,driftThis:20}).some(x=>x.id==='drift'),false);
assert.equal(advise({...c,todayMin:25}).some(x=>x.id==='streak'),false);
assert.equal(l7Accuracy([{planned:60,actual:60}]),100);
assert.equal(l7Accuracy([{planned:60,actual:90},{planned:60,actual:60}]),75);
assert.equal(l7Accuracy([{planned:10,actual:100}]),0);
assert.equal(l7Accuracy([]),null);
assert.equal(l7WeekOf('2026-10-28',1),'2026-10-26');
assert.equal(l7WeekOf('2026-11-01',0),'2026-10-26');
// Sunday display-week preferences cannot grant a second freeze in the same ISO week.
assert.equal(flexibleStreak({'2026-10-30':30,'2026-10-31':0,'2026-11-01':0},25,0).status['2026-11-01'],'miss');
const days={
 '2026-10-26':45,'2026-10-27':0,'2026-10-28':40,
 '2026-10-29':0,'2026-10-30':35,'2026-10-31':0,'2026-11-01':0
};
const st=flexibleStreak(days,25,1);
assert.equal(st.status['2026-10-27'],'freeze');
assert.equal(st.status['2026-10-29'],'miss');
assert.equal(st.status['2026-10-31'],'miss');
const w=flexibleStreak({'2026-10-26':40,'2026-10-27':0,'2026-10-28':45},25,1);
assert.equal(w.count,3);
assert.equal(flexibleStreak({'2026-10-26':0,'2026-10-27':0},25,1).count,0);
// QA: missing or impossible calendar days cannot inflate a streak.
const streak=(days,today)=>flexibleStreak(days,25,1,today);
assert.equal(streak({'2026-10-26':30,'2026-10-28':30},'2026-10-28').count,1,
  'a missing intervening day breaks a streak');
assert.equal(streak({'2026-10-26':30,'2026-10-27':30,'2026-10-28':0},'2026-10-28').count,2,
  'only the actual unfinished current day can be skipped');
assert.equal(streak({'2026-10-26':30,'2026-10-27':30},'2026-10-30').count,0,
  'a history ending two days ago is not a live streak');
assert.equal(streak({'2026-10-29':30},'2026-10-30').count,1,
  'yesterday still counts before studying today');
assert.equal(streak({'2026-10-29':0},'2026-10-30').count,0,
  'an older missed day cannot be skipped as if it were today');
assert.equal(streak({'2026-10-29':30,'2026-10-31':30},'2026-10-30').count,1,
  "future data cannot count toward today's streak");
assert.equal(streak({'2026-02-30':30,'2026-03-01':30},'2026-03-01').count,1,
  'impossible date keys are ignored');
assert.equal(streak({'2024-02-28':30,'2024-02-29':30,'2024-03-01':30},'2024-03-01').count,3,
  'leap day is a real consecutive day');
assert.equal(streak({'2026-11-01':30,'2026-11-02':30},'2026-11-02').count,2,
  'ISO-week boundaries must not break a streak');
assert.equal(streak({'2026-10-28':0},'2026-10-28').count,0,
  'an unfinished current day does not manufacture a streak');
assert.deepEqual(Object.keys(streak({'2026-02-31':25},'2026-03-01').status),[],
  'invalid calendar dates are excluded from status');
console.log('L7 ADVICE & STREAK TESTS PASSED');
