"""Final integrated redesign acceptance against mock data; never signs in.

Run after build:web. Captures phone/desktop light/dark screens and exercises
cross-screen actions, modal stacking, keyboard/Back, pinning, drag and Undo.
CARREL_CHROMIUM optionally selects an already installed Chromium executable.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('CARREL_QA_OUT', 'screenshots/redesign'))
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in map(int, os.environ.get('CARREL_QA_WIDTHS','390,1280').split(',')):
        for theme in ('light', 'dark'):
            errors = []
            page = browser.new_page(viewport={'width': width, 'height': 844},
                color_scheme=theme, is_mobile=width < 960, has_touch=width < 960)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
            page.goto((ROOT / 'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.current && ACTS.length > 0')

            def capture(name):
                page.wait_for_timeout(250)
                scroll_width = page.evaluate('Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)')
                if scroll_width > width + 1:
                    offenders = page.evaluate("""() => Array.from(document.querySelectorAll('body *')).map(e => {
                        const r=e.getBoundingClientRect();
                        return {tag:e.tagName,cls:String(e.className||'').slice(0,65),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)};
                    }).filter(x=>x.right>innerWidth+1&&x.width>1).slice(0,12)""")
                    raise AssertionError(f'{name} overflows {scroll_width}px > {width+1}px: {offenders}')
                missing = page.evaluate('''() => Array.from(document.querySelectorAll('[data-act],[data-long],[data-change],[data-submit]')).flatMap(el =>
                    ['act','long','change','submit'].flatMap(k => {const name=el.dataset[k];return name && typeof (k==='submit'?SUBMIT:ACT)[name]!=='function' ? [k+':'+name] : []}))''')
                assert not missing, (name, missing)
                assert not errors, errors
                page.screenshot(path=str(OUT / f'{width}-{theme}-{name}.png'), full_page=True)

            def tab(name):
                if name == 'settings':
                    page.locator('#nav [data-v="today"]').click()
                    page.locator('[data-act="open-settings"]').click()
                    assert page.evaluate("UI.view==='settings'")
                    return
                target = 'insights' if name == 'stats' else name
                page.locator(f'#nav [data-v="{target}"]').click()
                expect(page.locator(f'#nav [data-v="{target}"]')).to_have_attribute('aria-current', 'page')

            def close():
                page.keyboard.press('Escape')
                page.wait_for_timeout(150)
                assert page.evaluate('UI.sheet === null')

            for view in ('today', 'plan', 'subjects', 'stats', 'settings'):
                tab(view)
                capture(view)
            # Every registered production subscreen must render independently.
            pages = page.evaluate("Object.keys(PAGES).filter(id=>id!=='kit' && id!=='settings.notifications')")
            for name in pages:
                params = {'id': page.evaluate("ACTS.find(a=>a.kind==='study').id")} if name in ('settings.activity', 'stats.subject') else {}
                page.evaluate('([id,params])=>openPage(id.startsWith("stats.")?"stats":id==="log"?"today":id==="tasks"?"plan":"settings",id,params)', [name,params])
                capture(name)
                page.keyboard.press('Escape')
                page.wait_for_timeout(150)
                assert page.evaluate('UI.pages.length===0'), name
            tab('today')
            page.locator('[data-act="t1-log"]').click()
            assert page.evaluate('UI.pages.at(-1).id==="log"')
            page.go_back()
            page.wait_for_timeout(150)
            assert page.evaluate('UI.pages.length===0')
            # Entry sheet stays above navigation; focus remains inside on keyboard Tab.
            page.locator('[data-act="edit-running"]').click()
            capture('entry-running')
            assert not page.evaluate('''() => {const r=document.querySelector('#nav button').getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#nav')}''')
            page.keyboard.press('Tab')
            assert page.evaluate("!!document.activeElement.closest('#sheet')")
            close()
            # Start, activities, park and corrected-stop sheets integrate with Today.
            study = page.evaluate("ACTS.find(a=>a.kind==='study').id")
            page.evaluate('(id)=>ACT["t2-start-opts"]({getAttribute:()=>id})', study)
            capture('start-options')
            close()
            page.locator('[data-act="t1-activities"]').click()
            capture('activities')
            close()
            page.evaluate("ACT['t1-fixstop']()")
            capture('fix-stop')
            close()
            page.evaluate("ACT['t1-park']()")
            page.locator('[data-bind="parkText"]').fill('Integration QA thought')
            page.locator('[data-act="t2-save-park"]').click()
            page.locator('[data-act="break"]').click()
            expect(page.locator('[data-act="t1-parked"]')).to_be_visible()
            page.locator('[data-act="t1-parked"]').click()
            capture('parked')
            close()
            page.locator('[data-act="back"]').click()
            # Focus has no navigation; Escape returns to Today.
            page.locator('[data-act="desk"]').click()
            expect(page.locator('.desk')).to_be_visible()
            capture('focus')
            page.keyboard.press('Escape')
            page.wait_for_timeout(150)
            assert page.evaluate('!UI.desk')
            # Stop/rating/Undo retain the original timer write path.
            page.locator('[data-act="stop"]').click()
            expect(page.locator('.t1-idle')).to_be_visible()
            capture('stopped')
            page.locator('[data-act="undo"]').click()
            expect(page.locator('.t1-clock')).to_be_visible()
            # Today Next -> Plan and the New/Busy/Block/Tasks editors.
            page.locator('[data-act="t1-plan-focus"]').first.click()
            assert page.evaluate('UI.view==="plan"')
            page.locator('[data-act="cal-new"]').click()
            capture('plan-new')
            page.locator('[data-act="q-tab"][data-v="busy"]').click()
            capture('plan-new-busy')
            close()
            page.evaluate('''() => {const k=todayKey(),r=planModelFor(k).rows.find(r=>r.st!=='active');openBlockSheet(k,r.id)}''')
            capture('plan-block')
            close()
            page.evaluate("p2OpenWrap(todayKey())")
            capture('plan-wrap')
            close()
            page.evaluate("openSheet({type:'fit',k:todayKey()})")
            capture('plan-fit')
            close()
            page.evaluate("openSheet({type:'planend',k:todayKey(),end:CFG.planEnd,err:''})")
            capture('plan-end')
            close()
            # Drag and resize a future block with real pointer events.
            if width >= 960:
                # Previous QA blindly moved one day forward, which fails when
                # an earlier action already navigated to tomorrow's block.
                # Select a real, loaded future plan rather than an offset.
                page.evaluate("""() => {
                    const future=Object.keys(V.plans).filter(k=>k>todayKey() &&
                      Object.values((V.plans[k]||{}).blocks||{})
                        .some(b=>b&&b.activity&&b.status!=='skipped')).sort();
                    if(!future.length)throw new Error('No future mock plan available');
                    UI.view='plan';UI.pages=[];UI.cal.view='day';
                    UI.cal.anchor=future[0];UI.cal.scrollTo=true;render();
                }""")
                page.wait_for_timeout(200)
                card = page.locator('[data-drag="block"]').first
                if card.count():
                    card.scroll_into_view_if_needed()
                    block_id = card.get_attribute('data-id')
                    key = card.get_attribute('data-k')
                    old = page.evaluate('([k,id])=>JSON.stringify(blocksOf(k)[id])', [key,block_id])
                    rect = card.bounding_box()
                    x, y = rect['x']+rect['width']/2, rect['y']+8
                    page.mouse.move(x,y)
                    page.mouse.down()
                    page.mouse.move(x,y+56,steps=8)
                    page.mouse.up()
                    page.wait_for_timeout(450)
                    assert page.evaluate('([k,id,old])=>JSON.stringify(blocksOf(k)[id])!==old',[key,block_id,old]), 'Drag did not move block'
                    page.locator('[data-act="undo"]').click()
                    page.wait_for_timeout(150)
                    assert page.evaluate('([k,id,old])=>JSON.stringify(blocksOf(k)[id])===old',[key,block_id,old]), 'Undo did not restore dragged block'
                    card = page.locator(f'[data-drag="block"][data-id="{block_id}"]')
                    card.scroll_into_view_if_needed()
                    handle = card.locator('.rz')
                    rect = handle.bounding_box()
                    old_minutes=page.evaluate('([k,id])=>blocksOf(k)[id].minutes',[key,block_id])
                    x,y=rect['x']+rect['width']/2,rect['y']+rect['height']/2
                    page.mouse.move(x,y)
                    page.mouse.down()
                    page.mouse.move(x,y+28,steps=8)
                    page.mouse.up()
                    page.wait_for_timeout(450)
                    assert page.evaluate('([k,id,n])=>blocksOf(k)[id].minutes!==n',[key,block_id,old_minutes]), 'Resize did not change duration'
                    page.locator('[data-act="undo"]').click()
                    page.wait_for_timeout(150)
                    assert page.evaluate('([k,id,n])=>blocksOf(k)[id].minutes===n',[key,block_id,old_minutes]), 'Undo did not restore duration'
                else:
                    raise AssertionError('Future mock plan requires a draggable block')
            page.locator('[data-act="p1-open-tasks"]').click()
            for name in ('deadlines','backlog','weekly'):
                page.evaluate('(tab)=> {UI.pages.at(-1).params.tab=tab;render()}',name)
                capture('tasks-'+name)
            for script, name in [("openDeadlineSheet(null)",'deadline'), ("openTaskSheet(null)",'task'),
                    ("openQnew(todayKey(),hmOnDay(todayKey(),'10:00'),hmOnDay(todayKey(),'11:00'),'busy',[1])",'weekly')]:
                page.evaluate(script)
                capture('editor-'+name)
                close()
            # Pin control persists through derived activities and changes Today picks.
            page.evaluate('(id)=>openPage("settings","settings.activity",{id})',study)
            old_pin=page.evaluate('(id)=>g1PinValue(ACTMAP[id])',study)
            page.locator('[data-act="g1-pin"]').click()
            page.wait_for_function('([id,old])=>g1PinValue(ACTMAP[id])!==old',arg=[study,old_pin])
            # Local queued commits can update the pin before Today derived picks repaint.
            page.wait_for_function('([id,old])=>t1Picks().some(a=>a.id===id)!==old',arg=[study,old_pin],timeout=10000)
            # Month keyboard paging must affect the displayed range.
            tab('stats')
            page.locator('[data-act="s1-range"][data-v="month"]').click()
            page.keyboard.press('ArrowLeft')
            assert page.evaluate('UI.s1MonthOff===1')
            page.keyboard.press('ArrowRight')
            assert page.evaluate('UI.s1MonthOff===0')
            # Alert dialog keyboard/Back closes without exposing browser confirm.
            page.evaluate("void confirmDialog({title:'Unsaved changes',text:'Discard waiting changes?',ok:'Sign out',danger:true})")
            expect(page.locator('[role="alertdialog"]')).to_be_visible()
            capture('confirm')
            for _ in range(4):
                page.keyboard.press('Tab')
                assert page.evaluate("!!document.activeElement.closest('[role=alertdialog]')")
            page.keyboard.press('Escape')
            assert page.evaluate('!UI.kDialog')
            # Empty states use real empty data, never sample charts.
            page.evaluate("S.base.days={};S.base.plans={};S.base.current=null;S.pending=[];recompute();render()")
            for view in ('today','plan','stats'):
                tab(view)
                capture('empty-'+view)
            assert not errors, errors
            print(f'PASS {width}px {theme}: tabs, {len(pages)} pages, sheets, writes, Undo, Back, empty states')
            page.close()
    browser.close()
print('INTEGRATED REDESIGN ACCEPTANCE PASSED')
