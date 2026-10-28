"""QA: signed-out cache-clear warning and retry across four responsive themes.

Uses the mock test page; never signs in or accesses production documents.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = root / 'v2-shots' / 'qa-signout-cache'
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390, 1280):
        for theme in ('light', 'dark'):
            page = browser.new_page(viewport={'width': width, 'height': 844},
                                    color_scheme=theme, is_mobile=width < 960,
                                    has_touch=width < 960)
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto((root / 'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.activities && S.loaded.settings')
            page.evaluate('''() => {
                S.conn = 'none'; S.owner = false; S.uid = null; S.db = null;
                a1CleanupPending = ['qa-signout-cache'];
                a1CleanupBusy.clear();
                store.set('cacheClearPending', a1CleanupPending);
                render();
            }''')
            alert = page.locator('#main .w1-cache-alert')
            expect(alert).to_be_visible()
            expect(alert).to_contain_text('Device cache not cleared')
            retry = alert.locator('[data-act="a1-retry-cache-clear"]')
            expect(retry).to_be_visible()
            assert retry.bounding_box()['height'] >= 44
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            page.screenshot(path=str(out / f'{width}-{theme}-warning.png'), full_page=True)
            retry.click()
            expect(alert).not_to_be_visible(timeout=10000)
            assert page.evaluate("store.get('cacheClearPending') === null")
            assert not errors, errors
            page.close()
    browser.close()
print('QA SIGN-OUT CACHE RECOVERY SMOKE PASSED')
