"""QA: legacy offline recovery is opt-in, visible and cancellable at four viewports."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = root / 'v2-shots' / 'qa-account'
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
            page.evaluate("""() => {
              S.uid = 'qa-mock-account';
              store.set('pending', [{path:'days/2026-10-25',kind:'set',
                data:{date:'2026-10-25',entries:{}}}]);
              openPage('today','settings.account');
            }""")
            row = page.locator('#main [data-act="a1-recover-legacy-pending"]')
            expect(row).to_be_visible()
            expect(row).to_contain_text('1 waiting')
            page.screenshot(path=str(out / f'{width}-{theme}-recovery.png'), full_page=True)
            row.click()
            dialog = page.locator('#pop [role="alertdialog"]')
            expect(dialog).to_be_visible()
            expect(dialog).to_contain_text('no account label')
            expect(dialog.locator('[data-act="k-dialog-ok"]')).to_be_visible()
            page.screenshot(path=str(out / f'{width}-{theme}-confirm.png'), full_page=True)
            dialog.locator('[data-act="k-dialog-cancel"]').click()
            expect(dialog).not_to_be_visible()
            assert page.evaluate("Array.isArray(store.get('pending')) && store.get('pending').length === 1")
            assert not errors, errors
            page.close()
    browser.close()
print('QA ACCOUNT RECOVERY SMOKE PASSED')
