"""P2 Plan sheets browser smoke: isolated mock data, four light/dark viewports."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
html=root/'web/test/carrel-test.html'
out=root/'p2-screens'
out.mkdir(exist_ok=True)
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    for dark,width in ((False,390),(True,390),(False,1280),(True,1280)):
        name=('dark' if dark else 'light')+'-'+str(width)
        page=browser.new_page(viewport={'width':width,'height':844},
            color_scheme='dark' if dark else 'light',is_mobile=width<960,has_touch=width<960)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append('console: '+m.text) if m.type=='error' else None)
        page.goto(html.as_uri())
        page.wait_for_timeout(800)
        def capture(label):
            page.wait_for_timeout(350)
            actual=page.evaluate("Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)")
            assert actual<=width+1, '%s %s overflow %s'%(name,label,actual)
            page.screenshot(path=str(out/(name+'-'+label+'.png')),full_page=True)
        def open_sheet(script,typ):
            page.evaluate(script)
            expect(page.locator('#sheet [role="dialog"]')).to_have_count(1)
            assert page.evaluate('UI.sheet.type')==typ, 'wrong modal: '+typ
        open_sheet("openQnew(todayKey(),hmOnDay(todayKey(),'19:00'),hmOnDay(todayKey(),'20:00'))",'qnew')
        expect(page.locator('#sheet .k-sheet')).to_be_visible()
        capture('new-block')
        page.locator('#q-title').fill('P2 regression block')
        page.locator('#sheet [data-act="q-save"]').click()
        page.wait_for_timeout(350)
        assert page.evaluate("Object.values(blocksOf(todayKey())).some(b=>b&&b.title==='P2 regression block')"),'new block was not saved'
        open_sheet("openQnew(todayKey(),hmOnDay(todayKey(),'18:00'),hmOnDay(todayKey(),'19:00'),'busy',[])",'qnew')
        page.locator('#q-btitle').fill('P2 repeating class')
        page.locator('#sheet [data-act="p2-weekly"]').click()
        assert page.evaluate('UI.sheet.weekly') is True, 'weekly toggle failed'
        if width==390:
            ys=page.locator('#sheet .p2-weekday').evaluate_all("(els)=>els.map(e=>Math.round(e.getBoundingClientRect().top))")
            assert len(ys)==7 and len(set(ys))==1,'weekday buttons must share one row: '+str(ys)
        capture('new-busy-weekly')
        page.locator('#sheet [data-act="q-save"]').click()
        page.wait_for_timeout(350)
        assert page.evaluate("Object.values(commitmentsMap()).some(c=>c&&c.title==='P2 repeating class')"),'weekly busy save failed'
        open_sheet("openBlockSheet(todayKey(),'b2')",'block')
        assert page.locator('#sheet [data-act="block-dup"]').count()==1
        capture('edit-block')
        page.locator('#b-title').fill('P2 revised block')
        page.locator('#sheet [data-act="block-save"]').click()
        page.wait_for_timeout(350)
        assert page.evaluate("blocksOf(todayKey()).b2?.title==='P2 revised block'"),'block edit failed'
        open_sheet("p2OpenWrap(todayKey())",'wrap')
        capture('wrap')
        page.keyboard.press('Escape')
        assert page.evaluate('UI.sheet') is None,'Escape did not dismiss Wrap'
        open_sheet("openSheet({type:'fit',k:todayKey()})",'fit')
        capture('fit')
        page.keyboard.press('Escape')
        open_sheet("ACT['p2-menu-end']({getAttribute:()=>todayKey()})",'planend')
        capture('planend')
        page.locator('#sheet input[type="time"]').fill('23:15')
        page.locator('#sheet [data-act="p2-planend-save"]').click()
        page.wait_for_timeout(350)
        assert page.evaluate("V.plans[todayKey()].end==='23:15'"),'plan end write failed'
        page.evaluate("p2OpenPlanMenu(document.querySelector('#nav [data-v=plan]'),todayKey())")
        expect(page.locator('.k-menu button')).to_have_count(4)
        capture('menu')
        page.keyboard.press('Escape')
        assert not page.evaluate('UI.kMenu'),'menu Escape failed'
        assert not errors, "; ".join(errors)
        page.close()
    browser.close()
print('P2 browser QA passed: five sheets, edits, recurring busy, menu, Back, 390/1280 and light/dark')
