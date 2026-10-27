"""T3 real browser page/edit smoke with mock data only."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
html=root/'web/test/carrel-test.html'
out=root/'t3-screens'
out.mkdir(exist_ok=True)
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    for dark,width in ((False,390),(True,390),(False,1280),(True,1280)):
        name=('dark' if dark else 'light')+'-'+str(width)
        page=browser.new_page(viewport={'width':width,'height':844},
            color_scheme='dark' if dark else 'light',is_mobile=width<960,has_touch=width<960)
        page.on('pageerror',lambda e:errors.append('pageerror '+str(e)))
        page.on('console',lambda m:errors.append('console '+m.text) if m.type=='error' else None)
        page.goto(html.as_uri())
        page.wait_for_timeout(700)
        page.evaluate("pushPage('log',{k:todayKey()})")
        expect(page.locator('.k-page-title')).to_have_count(1)
        expect(page.locator('.t3-log-summary')).to_contain_text('studied')
        def capture(label):
            page.wait_for_timeout(350)
            actual=page.evaluate("Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)")
            assert actual<=width+1,name+' '+label+' horizontal overflow '+str(actual)
            page.screenshot(path=str(out/(name+'-'+label+'.png')),full_page=True)
        capture('log')
        page.locator('.k-page-actions [data-act="t3-prev"]').click()
        assert page.evaluate("UI.pages.at(-1).params.k!==todayKey()"),'Previous day did not navigate'
        page.locator('.k-page-actions [data-act="t3-next"]').click()
        assert page.evaluate("UI.pages.at(-1).params.k===todayKey()"),'Next day did not navigate'
        page.locator('.k-page-actions [data-act="t3-add"]').click()
        assert page.evaluate("UI.sheet&&UI.sheet.type==='entry'&&UI.sheet.mode==='add'"),'Add editor did not open'
        expect(page.locator('#sheet [role="dialog"]')).to_have_count(1)
        capture('new-entry')
        page.keyboard.press('Escape')
        assert page.evaluate('UI.sheet') is None,'Escape did not close entry'
        page.evaluate("openEntrySheet('running')")
        if page.evaluate("UI.sheet&&UI.sheet.mode==='running'"):
            capture('running-entry')
            page.keyboard.press('Escape')
        target=page.evaluate("ENTRIES.find(e=>!e.running)?.id")
        assert target,'mock has no completed log entries'
        page.evaluate("(id)=>openEntrySheet('edit',{id})",target)
        assert page.evaluate("UI.sheet&&UI.sheet.mode==='edit'"),'Edit editor did not open'
        capture('edit-entry')
        page.locator('#sheet [data-act="split-open"]').click()
        assert page.evaluate("UI.sheet&&UI.sheet.type==='split'"),'Split sheet did not open'
        capture('split')
        page.keyboard.press('Escape')
        assert page.evaluate('UI.sheet') is None,'Split did not close'
        page.keyboard.press('Escape')
        assert page.evaluate('UI.pages.length')==0,'Log Back did not pop page'
        assert not errors,'; '.join(errors)
        page.close()
    browser.close()
print('T3 BROWSER QA PASSED: log/add/running/edit/split, 390/1280 light/dark, Back, no overflow')
