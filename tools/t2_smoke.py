"""Mock-only T2 browser smoke; four phone/desktop light/dark viewports. No production writes."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
html = root / 'web/test/carrel-test.html'
out = root / 't2-screens'
out.mkdir(exist_ok=True)
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    for dark, width in ((False,390),(True,390),(False,1280),(True,1280)):
        name = ('dark' if dark else 'light') + '-' + str(width)
        page = browser.new_page(
            viewport={'width': width, 'height': 844},
            color_scheme='dark' if dark else 'light',
            is_mobile=width<960, has_touch=width<960)
        page.on('pageerror', lambda e: errors.append('pageerror '+str(e)))
        page.on('console', lambda m: errors.append('console '+m.text) if m.type == 'error' else None)
        page.goto(html.as_uri())
        page.wait_for_timeout(900)
        assert page.evaluate('!!ACTMAP.physics'), name+' mock activity unavailable'

        def capture(label):
            page.wait_for_timeout(350)
            actual = page.evaluate('Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)')
            page.screenshot(path=str(out / (name+'-'+label+'.png')), full_page=True)
            if actual>width+1:
                boxes=page.evaluate("""() => [...document.querySelectorAll('body *')]
                  .filter(el=>el.getBoundingClientRect().right>innerWidth+2)
                  .slice(0,8).map(el=>[el.tagName,el.className,
                    Math.round(el.getBoundingClientRect().right)])""")
                print('OVERFLOW', name, label, actual, boxes, flush=True)
            assert actual<=width+1, name+' '+label+' horizontal overflow '+str(actual)

        # All activities is accessible from the T2 sheet registry.
        page.evaluate("openSheet({type:'activities'})")
        expect(page.locator('#sheet [role="dialog"]')).to_have_count(1)
        expect(page.locator('#sheet .t2-activity')).not_to_have_count(0)
        assert page.locator('#sheet .t2-activity[data-id="physics"]').count()==1
        capture('activities')
        # Real click invokes the original timer write path.
        page.locator('#sheet [data-act="t2-start"][data-id="physics"]').click()
        page.wait_for_timeout(450)
        assert page.evaluate("CUR && CUR.activity==='physics'"), name+' activity switching failed'

        # Start options, offset, override, and accessible buttons.
        page.evaluate("""ACT['t2-start-opts']({getAttribute:k=>k==='data-id'?'maths':null})""")
        assert page.evaluate("UI.sheet&&UI.sheet.type==='start'"), name+' start sheet unavailable'
        expect(page.locator('#sheet [data-act="t2-confirm-start"]')).to_be_visible()
        capture('start')
        page.locator('#sheet [data-act="t2-from"][data-v="5"]').click()
        original_pomo = page.evaluate('UI.sheet.pomo')
        page.locator('#sheet [data-act="t2-pomo"]').click()
        assert page.evaluate('UI.sheet.pomo') != original_pomo, name+' toggle did not change'
        if page.evaluate('UI.sheet.pomo'):
            page.locator('#sheet [data-act="t2-pomo"]').click()
        assert page.evaluate('UI.sheet.pomo') is False
        capture('start-no-pomodoro')
        page.locator('#sheet [data-act="t2-confirm-start"]').click()
        page.wait_for_timeout(450)
        assert page.evaluate("CUR && CUR.activity==='maths' && CUR.pomo===null"), name+' Pomodoro override not applied'

        # Park is one compact editor; text is persisted through the mock write path.
        page.evaluate("UI.parkText='';openSheet({type:'park'})")
        expect(page.locator('#sheet [data-act="t2-save-park"]')).to_be_disabled()
        capture('park')
        page.locator('#sheet textarea[data-bind="parkText"]').fill('T2 visual test thought')
        expect(page.locator('#sheet [data-act="t2-save-park"]')).to_be_enabled()
        page.locator('#sheet [data-act="t2-save-park"]').click()
        page.wait_for_timeout(450)
        assert page.evaluate("parkedItems(todayKey()).some(x=>x.text==='T2 visual test thought')"), name+' parking failed'
        page.evaluate("openSheet({type:'parked',k:todayKey()})")
        expect(page.locator('#sheet .t2-parked-row')).not_to_have_count(0)
        capture('parked')
        page.keyboard.press('Escape')
        assert page.evaluate('UI.sheet') is None

        # Fix stop sheet is visualized without changing the running timer.
        page.evaluate("UI.guardTime=msToHm(Date.now()-5*MIN);openSheet({type:'fixstop'})")
        expect(page.locator('#sheet [data-act="guard-save"]')).to_be_visible()
        capture('fix-stop')
        page.keyboard.press('Escape')
        assert page.evaluate('UI.sheet') is None

        # Focus mode is black in both themes; Escape and browser Back must close it.
        page.evaluate('enterDesk()')
        expect(page.locator('#desk [role="dialog"]')).to_be_visible()
        assert page.evaluate('UI.desk') is True
        capture('focus')
        page.keyboard.press('Escape')
        assert page.evaluate('UI.desk') is False, name+' Escape did not leave Focus'
        page.evaluate('enterDesk()')
        page.go_back(wait_until='domcontentloaded')
        page.wait_for_timeout(300)
        assert page.evaluate('UI.desk') is False, name+' browser Back did not leave Focus'
        assert not errors, '; '.join(errors)
        page.close()
    browser.close()
print('T2 BROWSER PASS: sheets, writes, pomodoro override, Focus Escape/Back, 4 viewports')
