"""Chromium T1 Today browser regression, using mock-only local seed data."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
html=root/'web/test/carrel-test.html'
out=root/'t1-screens'
out.mkdir(exist_ok=True)
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    for dark,width in ((False,390),(True,390),(False,1280),(True,1280)):
        name=('dark' if dark else 'light')+'-'+str(width)
        page=browser.new_page(viewport={'width':width,'height':844},
            color_scheme='dark' if dark else 'light',is_mobile=width<960,has_touch=width<960)
        page.on('pageerror',lambda e:errors.append('PAGE '+str(e)))
        page.on('console',lambda m:errors.append('CONSOLE '+m.text) if m.type=='error' else None)
        page.goto(html.as_uri())
        page.wait_for_timeout(850)
        expect(page.locator('#main .t1-today')).to_have_count(1)
        expect(page.locator('#main .t1-timer')).to_have_count(1)
        assert page.locator('#main .dayhead').count()==0, name+' old Today header visible'

        def capture(label):
            page.wait_for_timeout(300)
            measured=page.evaluate('Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)')
            page.screenshot(path=str(out/(name+'-'+label+'.png')),full_page=True)
            assert measured<=width+1,'%s %s overflow %s'%(name,label,measured)

        capture('running')
        page.locator('[data-act="t1-log"]').click()
        assert page.evaluate("UI.pages.at(-1).id")=='log', name+' Log route'
        page.keyboard.press('Escape')
        assert not page.evaluate('UI.pages.length'), name+' Log Back'

        page.locator('[data-act="t1-activities"]').click()
        assert page.evaluate("UI.sheet && UI.sheet.type")=='activities'
        capture('activities')
        page.keyboard.press('Escape')
        assert page.evaluate('UI.sheet') is None

        if page.locator('#main [data-act="notice"]').count():
            page.locator('#main [data-act="notice"]').click()
            expect(page.locator('#main .t1-drift')).to_be_visible()
            capture('noticed')
            page.locator('#main [data-act="notice-drift"][data-m="5"]').click()

        # Focus is an independent navigation layer.
        page.locator('#main [data-act="desk"]').click()
        expect(page.locator('#desk .desk')).to_be_visible()
        capture('focus')
        page.keyboard.press('Escape')
        assert page.evaluate('UI.desk') is False, name+' focus exit'

        # Finishing a study entry exposes optional rating, then the start grid.
        page.locator('#main [data-act="stop"]').click()
        page.wait_for_timeout(500)
        assert page.evaluate('CUR') is None
        expect(page.locator('#main .t1-tiles')).to_be_visible()
        capture('idle')
        if page.locator('#main [data-act="t1-rate"][data-v="3"]').count():
            page.locator('#main [data-act="t1-rate"][data-v="3"]').click()
            assert page.evaluate('UI.lastRate') is None
        assert page.locator('#main .t1-chip[data-id="maths"]').count()==0, name+' duplicate idle study chip'

        page.locator('#main .t1-tile[data-id="maths"]').click()
        page.wait_for_timeout(450)
        assert page.evaluate("CUR && CUR.activity==='maths'"), name+' tile did not start timer'
        capture('restart-study')

        if page.locator('#main [data-act="t1-plan-focus"]').count():
            page.locator('#main [data-act="t1-plan-focus"]').first.click()
            assert page.evaluate("UI.view")=='plan', name+' Plan focus route'

        assert not errors,'; '.join(errors)
        page.close()
    browser.close()
print('T1 BROWSER PASS: Today/Log/activities/notice/focus/idle/rating/restart/Plan, 390/1280 light/dark')
