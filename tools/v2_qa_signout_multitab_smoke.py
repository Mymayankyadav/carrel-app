"""QA: a second tab's durable outbox requires confirmation before sign-out."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = root / 'v2-shots' / 'qa-signout-tabs'
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390, 1280):
        for theme in ('light', 'dark'):
            page = browser.new_page(
                viewport={'width': width, 'height': 844},
                color_scheme=theme, is_mobile=width < 960, has_touch=width < 960)
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto((root / 'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.activities && S.loaded.settings && S.db')
            page.evaluate('''() => {
              S.uid='qa-signout-tabs'; S.pendingSession='session-qa-123';
              S.pending=[]; window.qaSignoutCalls=0;
              const key='pending:qa-signout-tabs:session-qa-123';
              store.set(key,[{path:'days/2026-10-29',kind:'set',
                data:{date:'2026-10-29',entries:{other:{note:'unsent'}}}}]);
              sb={auth:{signOut:async()=>{window.qaSignoutCalls++;return {error:null};}}};
              openPage('today','settings.account');
            }''')
            page.locator('[data-act="signout"]').click()
            dialog = page.locator('#pop [role="alertdialog"]')
            expect(dialog).to_be_visible()
            expect(dialog).to_contain_text('possibly in another tab')
            expect(dialog).to_contain_text('1 waiting')
            page.screenshot(path=str(out / f'{width}-{theme}-confirm.png'), full_page=True)
            dialog.locator('[data-act="k-dialog-cancel"]').click()
            expect(dialog).not_to_be_visible()
            assert page.evaluate('window.qaSignoutCalls') == 0
            assert page.evaluate(
                "store.get('pending:qa-signout-tabs:session-qa-123').length") == 1
            assert not errors, errors
            page.close()
    browser.close()
print('QA SIGNOUT MULTITAB SMOKE PASSED')
