"""QA: unreadable storage and changed cross-tab queue must not silently sign out."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = root / 'v2-shots' / 'qa-signout-storage-race'
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
              S.uid='qa-storage-race'; S.pendingSession='session-qa-123';
              S.pending=[]; window.qaSignoutCalls=0;
              window.qaOriginalGetChecked=store.getChecked;
              store.getChecked=()=>({ok:false,value:null});
              sb={auth:{signOut:async()=>{window.qaSignoutCalls++;return {error:null};}}};
              openPage('today','settings.account');
            }""")
            page.locator('[data-act="signout"]').click()
            dialog = page.locator('#pop [role="alertdialog"]')
            expect(dialog).to_be_visible()
            expect(dialog).to_contain_text('Could not check saved offline edits')
            page.screenshot(path=str(out / f'{width}-{theme}-unreadable.png'), full_page=True)
            dialog.locator('[data-act="k-dialog-cancel"]').click()
            expect(dialog).not_to_be_visible()
            assert page.evaluate('window.qaSignoutCalls') == 0

            # Re-enable reads, then add a second tab's write while the
            # confirmation is open. The old approval must be invalidated.
            page.evaluate("""() => {
              store.getChecked=window.qaOriginalGetChecked;
              store.set('pending:qa-storage-race:session-qa-123',
                [{path:'days/2026-10-29',kind:'set',data:{date:'2026-10-29'}}]);
            }""")
            page.locator('[data-act="signout"]').click()
            expect(dialog).to_contain_text('1 waiting')
            page.evaluate("""() => {
              store.set('pending:qa-storage-race:session-qa-123',[
                {path:'days/2026-10-29',kind:'set',data:{date:'2026-10-29'}},
                {path:'days/2026-10-30',kind:'set',data:{date:'2026-10-30'}}]);
            }""")
            dialog.locator('[data-act="k-dialog-ok"]').click()
            expect(dialog).not_to_be_visible()
            assert page.evaluate('window.qaSignoutCalls') == 0
            assert page.evaluate(
                "store.get('pending:qa-storage-race:session-qa-123').length") == 2
            assert not errors, errors
            page.close()
    browser.close()
print('QA SIGNOUT STORAGE RACE SMOKE PASSED')
