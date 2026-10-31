'use strict';
// QA: JSON from synced documents and local settings may contain non-primitive
// telemetry. Such values must never crash Insights or fabricate progress.
const assert=require('node:assert/strict');
const {advise,flexibleStreak,l7Accuracy}=require('../logic/advice.js');
const poison={toString:0,valueOf:0};
assert.deepEqual(advise({subjects:[{id:'math',name:'Maths',goalMin:600,
  studiedMin:poison,factor:poison}],daysLeft:4}),[],
  'uncoercible telemetry cannot throw or manufacture a goal percentage');
assert.deepEqual(advise({subjects:[{id:'math',name:poison,goalMin:600,
  studiedMin:100,factor:1.5}],daysLeft:4}),[],
  'uncoercible subject names cannot crash text rendering');
assert.deepEqual(advise({subjects:[{id:'math',name:'Maths',goalMin:600,
  studiedMin:100,factor:poison}],daysLeft:4}).map(x=>x.id),['behind'],
  'invalid factor must not suppress valid goal advice');
assert.deepEqual(advise({subjects:[{id:'math',name:'Maths',goalMin:600,
  studiedMin:100,factor:'1.4'}],daysLeft:4}).map(x=>x.id),['behind','estimate'],
  'legacy numeric-string factor remains supported');
assert.deepEqual(advise({dismissed:poison,overdue:6}).map(x=>x.id),['reviews'],
  'corrupt persisted dismissals cannot crash suggestions');
assert.deepEqual(advise({dismissed:{0:'reviews',length:1},overdue:6})
  .map(x=>x.id),['reviews'],'array-like objects are not trusted dismissal lists');
assert.deepEqual(advise({dismissed:['reviews'],overdue:6}),[],
  'valid dismissal arrays retain their existing behavior');
assert.equal(flexibleStreak({'2026-10-26':30,'2026-10-27':poison},
  25,1,'2026-10-27').count,1,
  'uncoercible day data cannot award a current-day streak');
assert.equal(flexibleStreak({'2026-10-26':30,'2026-10-27':[30]},
  25,1,'2026-10-27').count,1,
  'JSON array data cannot masquerade as study minutes');
assert.equal(flexibleStreak({'2026-10-26':30,'2026-10-27':'30'},
  25,1,'2026-10-27').count,2,
  'legacy numeric-string day minutes remain valid');
assert.equal(l7Accuracy([{planned:'60',actual:'60'}]),100,
  'valid legacy estimate history remains compatible');
console.log('L7 UNTRUSTED ADVICE QA PASSED');
