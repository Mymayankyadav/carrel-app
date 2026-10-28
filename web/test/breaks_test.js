'use strict';
const assert=require('node:assert/strict');
const {suggestBreak,l5BreakRemaining}=require('../logic/breaks.js');
for(const [focus,expected] of [[0,5],[5,5],[24,5],[25,5],[26,5],[44,9],[50,10],[100,20],[120,20],[240,20],[-3,5],[Infinity,5],[NaN,5]]){
  assert.equal(suggestBreak(focus),expected,'focus '+focus);
}
const start=1000000;
assert.equal(l5BreakRemaining(start,start,9),9);
assert.equal(l5BreakRemaining(start,start+4*60000,9),5);
assert.equal(l5BreakRemaining(start,start+8.5*60000,9),1);
assert.equal(l5BreakRemaining(start,start+10*60000,9),0);
assert.equal(l5BreakRemaining(NaN,start,9),0);
console.log('L5 FLOWTIME TESTS PASSED');
