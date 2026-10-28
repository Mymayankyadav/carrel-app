"""L7 Insights v2: overview, focus, estimates, streak and minimum-day controls."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
out=root/'v2-shots'/'l7'
out.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390,1280):
        for theme in ('light','dark'):
            errors=[]
            page=browser.new_page(viewport={'width':width,'height':844},
              color_scheme=theme,is_mobile=width<960,has_touch=width<960)
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto((root/'web/test/carrel-test.html').as_uri())
            page.wait_for_function("S.loaded.current && S.loaded.days && ACTS.length>0")
            page.locator('#nav [data-v="insights"]').click()
            expect(page.locator('.l7-insights')).to_be_visible()
            expect(page.locator('.l7-goal')).to_be_visible()
            expect(page.locator('[data-act="l7-focus"]')).to_be_visible()
            page.screenshot(path=str(out/f'{width}-{theme}-overview.png'),full_page=True)
            page.locator('[data-act="l7-focus"]').click()
            assert page.evaluate("UI.pages.at(-1).id==='stats.focus'")
            expect(page.locator('#main')).to_contain_text('Focus by hour')
            page.screenshot(path=str(out/f'{width}-{theme}-focus.png'),full_page=True)
            page.evaluate("UI.pages=[];UI.view='insights';render()")
            page.locator('[data-act="l7-estimates"]').click()
            assert page.evaluate("UI.pages.at(-1).id==='stats.estimates'")
            page.screenshot(path=str(out/f'{width}-{theme}-estimates.png'),full_page=True)
            page.evaluate("UI.pages=[];UI.view='insights';render()")
            page.locator('[data-act="l7-streak"]').click()
            assert page.evaluate("UI.pages.at(-1).id==='stats.streak'")
            expect(page.locator('#main')).to_contain_text('minimum')
            page.screenshot(path=str(out/f'{width}-{theme}-streak.png'),full_page=True)
            page.evaluate("UI.pages=[];UI.view='settings';render();pushPage('settings.day')")
            expect(page.locator('[data-key="minDay"][data-d="5"]')).to_be_visible()
            assert not errors,errors
            page.close()
    browser.close()
print('L7 SMOKE PASSED')
