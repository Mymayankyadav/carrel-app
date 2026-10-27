"""P1 Plan browser QA: Day/Week, Tasks, P2 menu, create, drag and viewport."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
html=root/'web/test/carrel-test.html'
out=root/'p1-screens'
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
        page.locator('#nav [data-v="plan"]').click()
        expect(page.locator('.p1-plan')).to_have_count(1)
        assert page.locator('.cv-side,.cv-legend,.cv-hint').count()==0,'legacy side panel visible'
        assert page.locator('.p1-header [data-act="p1-open-tasks"]').count()==1
        def capture(label):
            page.wait_for_timeout(300)
            scroll=page.evaluate("Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)")
            assert scroll<=width+1,name+' '+label+' horizontal overflow '+str(scroll)
            page.screenshot(path=str(out/(name+'-'+label+'.png')),full_page=True)
        capture('day')
        page.locator('[data-act="cal-view"][data-v="week"]').click()
        assert page.evaluate('UI.cal.view')=='week'
        expect(page.locator('.p1-plan .p1-dayhead')).to_have_count(7)
        capture('week')
        page.locator('.p1-plan [data-act="p1-day"]').first.click()
        assert page.evaluate('UI.cal.view')=='day'
        expect(page.locator('.p1-plan .p1-dayhead')).to_have_count(1)
        page.locator('.p1-header [data-act="p1-open-tasks"]').click()
        expect(page.locator('.k-page-title')).to_contain_text('Tasks')
        assert page.evaluate('UI.pages.length')==1
        page.keyboard.press('Escape')
        assert page.evaluate('UI.pages.length')==0,'Tasks Back did not pop page'
        page.locator('.p1-header [data-act="p2-plan-menu"]').click()
        expect(page.locator('.k-menu button')).to_have_count(4)
        page.locator('.k-menu button').filter(has_text='Plan ends at').click()
        assert page.evaluate("UI.sheet&&UI.sheet.type")== 'planend'
        capture('planend')
        page.locator('#sheet input[type=time]').fill('23:15')
        page.locator('#sheet [data-act="p2-planend-save"]').click()
        assert page.evaluate('UI.sheet') is None
        page.wait_for_timeout(300)
        assert page.evaluate("V.plans[UI.cal.anchor||todayKey()]?.end==='23:15'"),'plan end save failed'
        page.locator('.p1-fab').click()
        assert page.evaluate('UI.sheet.type')=='qnew'
        capture('new')
        page.locator('#q-title').fill('P1 planning smoke')
        page.locator('#sheet [data-act="q-save"]').click()
        page.wait_for_timeout(350)
        assert page.evaluate("Object.values(blocksOf(todayKey())).some(x=>x&&x.title==='P1 planning smoke')"),'new block missing from today'
        page.evaluate("planFocus(todayKey(),'b2')")
        assert page.evaluate("UI.view==='plan'&&UI.cal.view==='day'"),'planFocus contract broken'
        # Mouse drag must remain wired; it may target an unoccupied slot, which is fine.
        drag=page.locator('.p1-plan .ce-blk[data-drag="block"]').first
        if drag.count():
            drag.scroll_into_view_if_needed()
            box=drag.bounding_box()
            if box:
                x=box['x']+min(20,box['width']/2)
                y=box['y']+min(20,box['height']/2)
                page.mouse.move(x,y)
                page.mouse.down()
                page.mouse.move(x+16,y+22,steps=6)
                page.mouse.up()
                page.wait_for_timeout(200)
        assert not errors,'; '.join(errors)
        page.close()
    browser.close()
print('P1 BROWSER QA PASSED: Plan Day/Week, Tasks, P2 menu, plan end, create, focus, drag, no overflow')
