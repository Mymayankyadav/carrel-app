"""QA: stale tab cannot replace another tab's durable offline outbox."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = root / 'v2-shots' / 'qa-multitab-outbox'
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390, 1280):
        for theme in ('light', 'dark'):
            page = browser.new_page(
                viewport={'width': width, 'height': 844},
                color_scheme=theme, is_mobile=width < 960, has_touch=width < 960)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto((root / 'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.current && !!CUR && ACTS.length > 0')
            page.evaluate("""() => {
              S.uid='qa-multitab'; S.pendingSession='session-qa-123';
              restorePending(); // this tab saw no queued edits
              const key=pendingStoreKey();
              // Simulate a different tab saving an edit after this tab loaded.
              store.set(key,[{path:'days/2026-10-29',kind:'set',
                data:{date:'2026-10-29',entries:{other:{note:'keep me'}}}}]);
              stopTimer();
            }""")
            expect(page.locator('.r0-sync[role="alert"]')).to_contain_text(
                'Offline edits changed in another tab')
            assert page.evaluate('!!CUR'), 'rejected write must leave timer running'
            assert page.evaluate('S.pending.length') == 0, 'no optimistic write after conflict'
            assert page.evaluate('store.get(pendingStoreKey())[0].data.entries.other.note') == 'keep me'
            page.screenshot(path=str(out / f'{width}-{theme}-conflict.png'), full_page=True)
            assert not errors, errors
            page.close()
    browser.close()
print('QA MULTITAB OUTBOX SMOKE PASSED')
