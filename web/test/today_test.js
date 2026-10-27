// Today integration and dead-code regression: T1 replaces legacy Today UI.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../ui/today.js'),'utf8');
const required=['function t1Today(', 'function t1Timer(', 'function t1Next(',
  'function noticeNow(', 'function driftWrites(', 'function noticeDrift(',
  'function parkAdd(', 'function parkedItems(', 'function parkToBacklog(',
  'VIEWS.today = t1Today;'];
for(const part of required) assert(source.includes(part),'required implementation: '+part);
for(const part of ['function vTimer(', 'function vRing(', 'function vSwitcher(',
  'function vToday(', 'function vParking(', 'function vDistractionPatterns(',
  'function vNoticeBar(', 'function todayFold(']) {
  assert(!source.includes(part),'obsolete renderer should be deleted: '+part);
}
assert(source.includes("data-long=\"t2-start-opts\""),'touch Start options still registered');
assert(source.includes("pushPage('log',{k:todayKey()})"),'T3 log linkage preserved');
assert(source.includes("planFocus(el.getAttribute('data-k')"),'P1 timeline focus preserved');
require('./t1_today_test.js');
console.log('TODAY LEGACY CLEANUP TESTS PASSED');
