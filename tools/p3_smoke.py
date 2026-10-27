"""P3 Tasks browser regression: mock data only; no production network."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import os

root=Path(__file__).resolve().parents[1]
html=root/'web/test/carrel-test.html'
out=root/'p3-screens'
out.mkdir(exist_ok=True)
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    for dark,width in ((False,390),(True,390),(False,1280),(True,1280)):
        name=('dark' if dark else 'light')+'-'+str(width)
        page=browser.new_page(viewport={'width':width,'height':844},
            color_scheme='dark' if dark else 'light',is_mobile=width<960,has_touch=width<960)
        page.on('pageerror',lambda e: errors.append('page: '+str(e)))
        page.on('console',lambda m: errors.append('console: '+m.text) if m.type=='error' else None)
        page.goto(html.as_uri())
        page.wait_for_timeout(800)
        page.evaluate("pushPage('tasks',{tab:'deadlines'})")
        expect(page.locator('.k-page-title')).to_contain_text('Tasks')
        def capture(label):
            actual=page.evaluate("Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)")
            page.screenshot(path=str(out/(name+'-'+label+'.png')),full_page=True)
            if actual>width+1:
                offenders=page.evaluate("""limit => ({
                  viewport:{innerWidth,outerWidth,visual:visualViewport.width,document:document.documentElement.clientWidth},
                  nodes:[...document.querySelectorAll('body *')]
                    .map(e=>({tag:e.tagName.toLowerCase(),cls:typeof e.className==='string'?e.className:'',
                      txt:(e.innerText||'').slice(0,30),left:Math.round(e.getBoundingClientRect().left),
                      right:Math.round(e.getBoundingClientRect().right),
                      scroll:e.scrollWidth,client:e.clientWidth,overflow:getComputedStyle(e).overflowX}))
                    .filter(e=>e.right>limit+1||(e.scroll>e.client+2&&e.overflow!=='hidden'))
                    .sort((a,b)=>b.right-a.right).slice(0,30)
                })""",width)
                print('OVERFLOW DETAILS',name,label,offenders,flush=True)
            assert actual<=width+1, '%s %s overflow: %s'%(name,label,actual)
        capture('deadlines')
        page.locator('[data-act="p3-add"]').click()
        expect(page.locator('#sheet [role="dialog"]')).to_have_count(1)
        assert page.evaluate('UI.sheet.type')=='deadline'
        capture('deadline-editor')
        page.keyboard.press('Escape')
        assert page.evaluate('UI.sheet') is None
        page.locator('[data-act="p3-tab"][data-v="backlog"]').click()
        expect(page.locator('[data-act="p3-add"]')).to_have_count(1)
        capture('backlog')
        page.locator('[data-act="p3-add"]').click()
        assert page.evaluate('UI.sheet.type')=='task'
        capture('task-editor')
        page.locator('#tk-title').fill('P3 browser regression task')
        page.locator('#sheet [data-act="task-save"]').click()
        page.wait_for_timeout(400)
        assert page.evaluate("Object.values(backlogMap()).some(x=>x&&x.title==='P3 browser regression task')"), 'task was not saved'
        assert page.locator('#main').get_by_text('P3 browser regression task').count()>0, 'saved task missing from list'
        page.locator('[data-act="p3-tab"][data-v="weekly"]').click()
        capture('weekly')
        page.locator('[data-act="p3-add"]').click()
        assert page.evaluate('UI.sheet.type')=='busy'
        capture('weekly-editor')
        page.locator('#bz-title').fill('P3 browser test weekly')
        page.locator('#sheet [data-act="busy-save"]').click()
        page.wait_for_timeout(400)
        assert page.evaluate("Object.values(commitmentsMap()).some(x=>x&&x.title==='P3 browser test weekly')"), 'weekly item was not saved'
        assert page.locator('#main').get_by_text('P3 browser test weekly').count()>0, 'saved weekly item missing from list'
        page.keyboard.press('Escape')
        assert not page.evaluate('UI.pages.length'), 'Escape did not return from Tasks'
        assert not errors, '; '.join(errors)
        page.close()
    browser.close()
print('P3 BROWSER PASS: Tasks, all editors, save flows, Back, four viewports, no horizontal overflow')
