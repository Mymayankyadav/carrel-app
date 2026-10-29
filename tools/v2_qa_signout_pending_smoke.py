"""QA: discarded offline outbox must warn and retry when device deletion fails."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = root / 'v2-shots' / 'qa-signout-pending'
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390, 1280):
        for theme in ('light', 'dark'):
            page = browser.new_page(viewport={'width': width, 'height': 844},
                color_scheme=theme, is_mobile=width < 960, has_touch=width < 960)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto((root / 'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.current && ACTS.length > 0')
            page.evaluate("""() => {
              S.uid='qa-signout'; S.pendingSession='session-qa-123';
              const key='pending:qa-signout:session-qa-123';
              store.set(key,[{path:'days/2026-10-29',kind:'set',data:{date:'2026-10-29'}}]);
              window.qaOriginalStoreSet=store.set;
              store.set=(k,v)=>v===null && k===key ? false : window.qaOriginalStoreSet(k,v);
              teardownDb(true); showSignedOut();
            }""")
            expect(page.locator('.w1-cache-alert[role="alert"]')).to_contain_text('Offline edits not cleared')
            expect(page.locator('[data-act="a1-retry-pending-clear"]')).to_be_visible()
            page.screenshot(path=str(out / f'{width}-{theme}-warning.png'), full_page=True)
            page.evaluate('store.set=window.qaOriginalStoreSet')
            page.locator('[data-act="a1-retry-pending-clear"]').click()
            expect(page.locator('[data-act="a1-retry-pending-clear"]')).to_have_count(0)
            assert not errors, errors
            page.close()
    browser.close()
print('QA SIGNOUT PENDING SMOKE PASSED')
