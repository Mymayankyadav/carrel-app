"""L1 Today v2 mock-only browser checks: phone/desktop, light/dark, links and screenshots."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
out=root/'v2-shots'/'l1'
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390,1280):
        for theme in ('light','dark'):
            errors=[]
            page=browser.new_page(viewport={'width':width,'height':844},color_scheme=theme,
                is_mobile=width<960,has_touch=width<960)
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto((root/'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.current && S.loaded.topics && ACTS.length>0')
            page.locator('#nav [data-v="today"]').click()
            expect(page.locator('.l1-goal')).to_be_visible()
            expect(page.locator('[data-act="t1-log"]')).to_be_visible()
            expect(page.locator('.l1-ribbon-button')).to_be_visible()
            assert page.locator('.l1-ribbon-segment').count()>0
            assert page.evaluate("l1GoalFraction(120*MIN,240)") == 0.5
            page.screenshot(path=str(out/f'{width}-{theme}-today.png'),full_page=True)
            page.locator('.l1-goal').click()
            assert page.evaluate("UI.view==='insights'")
            page.locator('#nav [data-v="today"]').click()
            page.locator('.l1-ribbon-button').click()
            assert page.evaluate("UI.view==='plan'")
            page.locator('#nav [data-v="today"]').click()
            page.evaluate("stopTimer()")
            page.wait_for_function('!CUR')
            expect(page.locator('.t1-idle')).to_be_visible()
            page.screenshot(path=str(out/f'{width}-{theme}-idle.png'),full_page=True)
            assert not errors,errors
            page.close()
    browser.close()
print('L1 SMOKE PASSED')
