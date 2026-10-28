"""F1 navigation, Labs and responsive screenshots."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
out=root/'v2-shots'/'f1';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
 for width in (390,1280):
  for theme in ('light','dark'):
   errs=[]
   page=browser.new_page(viewport={'width':width,'height':844},color_scheme=theme,is_mobile=width<960,has_touch=width<960)
   page.on('pageerror',lambda e:errs.append(str(e)))
   page.goto((root/'web/test/carrel-test.html').as_uri())
   page.wait_for_function('S.loaded.current && ACTS.length > 0')
   assert page.locator('#nav .k-nav-item').count()==4
   page.locator('#nav [data-v="subjects"]').click()
   expect(page.locator('.l4-heading')).to_contain_text('Subjects')
   page.screenshot(path=str(out/f'{width}-{theme}-subjects.png'))
   page.locator('#nav [data-v="insights"]').click()
   expect(page.locator('#nav [data-v="insights"]')).to_have_attribute('aria-current','page')
   page.locator('#nav [data-v="today"]').click()
   page.locator('[data-act="open-settings"]').click()
   page.locator('[data-act="g1-page"][data-page="settings.labs"]').click()
   expect(page.get_by_text('Adaptive breaks')).to_be_visible()
   expect(page.get_by_text('Session recall')).to_be_visible()
   expect(page.get_by_text('Start-of-session energy check')).to_be_visible()
   page.screenshot(path=str(out/f'{width}-{theme}-labs.png'))
   page.keyboard.press('Escape')
   assert page.evaluate('UI.pages.length===0 && UI.view==="settings"')
   page.keyboard.press('Escape')
   assert page.evaluate('UI.view==="today"')
   assert not errs,errs
   page.close()
 browser.close()
print('F1 SMOKE PASSED')
