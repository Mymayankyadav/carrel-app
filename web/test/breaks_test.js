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


const poisoned={toString:0,valueOf:0};
for(const bad of [poisoned,[],[25],{minutes:25},true,false,'', '  ',Symbol('minutes')]){
  assert.equal(suggestBreak(bad),5,'malformed focus duration fails closed');
  assert.equal(l5BreakRemaining(bad,start,9),0,'malformed start fails closed');
  assert.equal(l5BreakRemaining(start,bad,9),0,'malformed now fails closed');
  assert.equal(l5BreakRemaining(start,start,bad),0,'malformed break target fails closed');
}
assert.equal(suggestBreak('50'),10,'finite legacy numeric-string focus remains supported');
assert.equal(l5BreakRemaining(String(start),String(start),'9'),9,
  'finite legacy numeric-string timestamps and targets remain supported');
assert.equal(l5BreakRemaining(1e308,0,1e308),0,
  'overflowing end time cannot display an infinite break countdown');
console.log('L5 FLOWTIME TESTS PASSED');
