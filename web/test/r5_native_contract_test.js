'use strict';
// Guard the R5 integration: a web-only UI refactor must not restore the
// custom native notification that was still being shipped from main.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const android = path.join(root, 'android/app/src/main');
const kt = fs.readFileSync(path.join(android,
  'java/app/carrel/study/live/Notifications.kt'), 'utf8');
const model = fs.readFileSync(path.join(android,
  'java/app/carrel/study/live/NotificationModel.kt'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'web/native.js'), 'utf8');
const patcher = fs.readFileSync(path.join(root, 'tools/patch_android.py'), 'utf8');

for (const obsolete of [
  'res/layout/notification_expanded.xml',
  'res/drawable/notification_chip.xml'
]) {
  assert.equal(fs.existsSync(path.join(android, obsolete)), false,
    'obsolete custom notification resource restored: ' + obsolete);
}
for (const pattern of [
  /import\s+android\.widget\.RemoteViews/,
  /RemoteViews\s*\(/,
  /setCustomBigContentView\s*\(/,
  /setCustomContentView\s*\(/,
  /DecoratedCustomViewStyle\s*\(/,
  /setLargeIcon\s*\(/,
  /setSubText\s*\(/
]) assert.doesNotMatch(kt, pattern);

assert.match(kt, /NotificationCompat\.Builder/);
assert.match(kt, /setColorized\(false\)/);
assert.match(kt, /"Stop",\s*action\("carrel\.STOP"/);
assert.match(kt, /if\s*\(store\.notifDistractions\)/);
assert.match(model, /title\s*=\s*"Break time"/);
assert.match(bridge, /PAGES\['settings\.notifications'\]/);
assert.match(bridge, /notifDistractions:\s*false/);
assert.match(patcher, /carrel_window_background/);
assert.match(patcher, /values-night\/carrel_colors\.xml/);

console.log('r5_native_contract_test: system notification and assets verified');
