"""L6 mock-only browser acceptance: urge-surf and Back / drift paths."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
out=root/'v2-shots'/'l6'
out.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390,1280):
        for theme in ('light','dark'):
            page=browser.new_page(viewport={'width':width,'height':844},
                color_scheme=theme,is_mobile=width<960,has_touch=width<960)
            errors=[]
            page.on('pageerror',lambda e: errors.append(str(e)))
            page.goto((root/'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.current && S.loaded.activities && S.loaded.distractions && ACTS.length>0')
            page.locator('#nav [data-v="today"]').click()
            page.evaluate("""() => startActivity('physics',{pomoRaw:null})""")
            page.wait_for_function("CUR && CUR.activity==='physics'")
            expect(page.locator('[data-act="l1-noticed"]')).to_be_visible()
            page.locator('[data-act="l1-noticed"]').click()
            expect(page.locator('#sheet')).to_contain_text('Wait it out')
            expect(page.locator('#sheet')).to_contain_text('Back to work')
            expect(page.locator('#sheet [role="timer"]')).to_be_visible()
            assert page.evaluate("UI.notice && UI.sheet && UI.sheet.type==='urge'")
            page.screenshot(path=str(out/f'{width}-{theme}-urge.png'),full_page=True)
            page.locator('#sheet [data-act="l6-urge-log"]').click()
            expect(page.locator('[data-act="notice-drift"][data-m="5"]')).to_be_visible()
            assert page.evaluate("UI.sheet===null && UI.notice && UI.notice.until>Date.now()")
            page.locator('[data-act="notice-drift"][data-m="5"]').click()
            page.wait_for_function("!UI.notice")
            assert not errors,errors
            page.close()
    browser.close()
print('L6 URGE SURF SMOKE PASSED')
