"""QA/ORC: browser proof that a failed local queue write never reports a saved timer stop."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = root / 'v2-shots' / 'qa-storage'
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390, 1280):
        for theme in ('light', 'dark'):
            page = browser.new_page(
                viewport={'width': width, 'height': 844},
                color_scheme=theme,
                is_mobile=width < 960,
                has_touch=width < 960
            )
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto((root / 'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.current && !!CUR && ACTS.length > 0')
            # The fixture normally has no authenticated UID. Give it a test
            # identity so it exercises the production account-scoped queue.
            page.evaluate("""() => {
              S.uid = 'qa-storage';
              window.qaOriginalStoreSet = store.set;
              store.set = (key, value) => key === 'pending:qa-storage'
                ? false : window.qaOriginalStoreSet(key, value);
            }""")
            page.evaluate('stopTimer()')
            page.wait_for_function("S.pendingStorageError === 'qa-storage'")
            expect(page.locator('.r0-sync[role="alert"]')).to_contain_text('change not saved')
            assert page.evaluate('!!CUR'), 'failed storage write must not stop the timer'
            assert page.evaluate('S.pending.length') == 0, 'failed action must not enter queue'
            page.screenshot(path=str(out / f'{width}-{theme}-failure.png'), full_page=True)
            page.evaluate("""() => {store.set = window.qaOriginalStoreSet; stopTimer();}""")
            page.wait_for_function('!CUR')
            expect(page.locator('.r0-sync[role="alert"]')).to_have_count(0)
            assert not errors, errors
            page.close()
    browser.close()
print('QA STORAGE SMOKE PASSED')
