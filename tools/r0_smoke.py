"""R0a browser interaction regression checks; requires web/build.py output.
Run: python3 tools/r0_smoke.py
No production login: opens web/test/carrel-test.html with the mock store.
"""
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
html=(root/'web'/'test'/'carrel-test.html')
if not html.is_file():
    sys.exit('Build the mock: python3 web/build.py')

errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={'width':390,'height':844},color_scheme='light',
                         is_mobile=True,has_touch=True)
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('console',lambda m: errors.append('console: '+m.text) if m.type=='error' else None)
    page.goto(html.as_uri())
    page.wait_for_timeout(700)
    assert page.locator('#nav .k-nav-item').count()==4, 'Exactly four navigation tabs'
    for tab in ('today','plan','stats','settings'):
        page.locator('#nav [data-v="'+tab+'"]').click()
        expect(page.locator('#nav [data-v="'+tab+'"]')).to_have_attribute('aria-current','page')
        assert page.evaluate('UI.view')==tab, 'route mismatch: '+tab
        assert page.locator('#main').inner_text().strip(), 'Empty screen: '+tab
    # The temporary Stats switch protects access to both legacy report types.
    page.locator('#nav [data-v="stats"]').click()
    assert page.locator('[data-act="r0-stats-pane"][data-v="patterns"]').count()==1
    page.locator('[data-act="r0-stats-pane"][data-v="patterns"]').click()
    assert page.evaluate('UI.statsPane')=='patterns'
    page.locator('[data-act="r0-stats-pane"][data-v="week"]').click()
    assert page.evaluate('UI.statsPane')=='week'
    # Registering a page must not erase the underlying tab or interfere with Escape.
    page.evaluate("openPage('settings','kit')")
    assert page.evaluate('UI.pages.length')==1
    expect(page.locator('.k-page > .k-page-head .k-page-title')).to_contain_text('Kit gallery')
    page.keyboard.press('Escape')
    assert page.evaluate('UI.pages.length')==0,'Escape must close subpage'
    # Editing while mock data is loaded must open exactly one sheet; no click-through.
    page.locator('#nav [data-v="today"]').click()
    page.evaluate("openEntrySheet('add')")
    assert page.evaluate('UI.sheet && UI.sheet.type')=='entry'
    assert page.locator('#sheet [role="dialog"]').count()==1
    page.keyboard.press('Escape')
    assert page.evaluate('UI.sheet') is None,'Escape must close sheet'
    # App-level browser Back should unwind pages, then return to the original tab.
    page.evaluate("openPage('settings','kit')")
    assert page.evaluate('UI.pages.length')==1
    page.go_back(wait_until='domcontentloaded')
    page.wait_for_timeout(150)
    assert page.evaluate('UI.pages.length')==0,'Browser Back must pop a page'
    assert not errors, '\\n'.join(errors)
    browser.close()
print('R0 BROWSER INTERACTIONS PASSED')
