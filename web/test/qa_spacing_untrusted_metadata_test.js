'use strict';
const assert=require('node:assert/strict');
const {nextReview,l4PlusDays}=require('../logic/spacing.js');
assert.equal(l4PlusDays('2026-10-30',1e9),null,'unrepresentable offset must not make NaN date');
assert.equal(l4PlusDays('9999-12-31',1),null,'out-of-range year must not persist');
assert.equal(nextReview({interval:1e9},3,'2026-10-30').due,'2026-11-02','corrupt interval defaults to first review');
assert.equal(nextReview({interval:3650},3,'2026-10-30').interval,3650,'valid long interval is capped');
assert.equal(nextReview({reps:'oops'},3,'2026-10-30').reps,1,'invalid reps are reset');
assert.equal(nextReview({reps:Infinity},3,'2026-10-30').reps,1,'infinite reps are reset');
assert.equal(nextReview({reps:Number.MAX_SAFE_INTEGER},3,'2026-10-30').reps,1,'unsafe increment is rejected');
assert.equal(nextReview({},3,'9999-12-31'),null,'unrepresentable due date fails closed');
assert.equal(nextReview({interval:4,reps:3},3,'2026-10-28').due,'2026-11-07','normal review unaffected');
// Invalid JSON types must not crash Insights/Subjects or enter due review lists.
const {dueTopics,l4KeyValid}=require('../logic/spacing.js');
const badPrimitive={toString:null,valueOf:null};
assert.equal(l4KeyValid(['2026-10-28']),false,'array-shaped date is not a date key');
assert.equal(l4KeyValid(badPrimitive),false,'hostile JSON date cannot throw');
assert.equal(nextReview({},3,['2026-10-30']),null,'array-shaped today fails closed');
assert.equal(nextReview({},3,'2026-10-30',['2026-10-31']).due,'2026-11-02',
  'array-shaped exam is ignored without a crash');
assert.equal(nextReview({interval:badPrimitive,reps:badPrimitive},3,'2026-10-30').reps,1,
  'uncoercible JSON metadata resets safely');
assert.equal(nextReview({interval:badPrimitive},3,'2026-10-30').interval,3,
  'uncoercible interval uses initial interval');
const malformed={
  badDate:{due:['2026-10-30'],title:'Invalid due',subject:'math'},
  malformedTitle:{due:'2026-10-30',title:badPrimitive,subject:badPrimitive},
  good:{due:'2026-10-29',title:'Real topic',subject:'math'}
};
const due=dueTopics(malformed,'2026-10-30');
assert.deepEqual(due.map(x=>x.id),['good','malformedTitle']);
assert.equal(due[1].title,'','malformed title is safely ignored');
assert.equal(due[1].subject,null,'malformed subject cannot reach activity lookup');
console.log('QA SPACING UNTRUSTED METADATA TESTS PASSED');
