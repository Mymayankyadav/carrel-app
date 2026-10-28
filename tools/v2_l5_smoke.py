"""L5 Focus v2: mock-only browser acceptance and screenshot matrix."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
out=root/'v2-shots'/'l5'
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
            page.wait_for_function('S.loaded.current && S.loaded.activities && S.loaded.topics && ACTS.length>0')
            page.locator('#nav [data-v="today"]').click()
            # Start options and intent must survive the current state transaction.
            page.evaluate("""() => ACT['t2-start-opts']({getAttribute:()=> 'physics'})""")
            expect(page.locator('#sheet')).to_contain_text('Intention (optional)')
            page.locator('#sheet [data-k-collapse="l5-intention"] summary').click()
            page.locator('#sheet [data-bind="sheet.intent"]').fill('Solve two proofs')
            page.locator('#sheet [data-bind="sheet.ifText"]').fill('If stuck')
            page.locator('#sheet [data-bind="sheet.thenText"]').fill('Review definitions')
            page.screenshot(path=str(out/f'{width}-{theme}-start.png'),full_page=True)
            page.locator('#sheet [data-act="t2-pomo"]').click() if page.evaluate('UI.sheet.pomo') else None
            page.locator('#sheet [data-act="t2-confirm-start"]').click()
            page.wait_for_function("""() => CUR && CUR.activity==='physics' &&
              CUR.intent==='Solve two proofs' && CUR.ifThen && CUR.ifThen.if==='If stuck'""")
            # Mock a 45-minute elapsed uninterrupted session; no live data touched.
            page.evaluate("""() => commit(null,W().update('state/current',{
              start:isoLocal(Date.now()-45*MIN),pomo:null}),{undo:false})""")
            expect(page.locator('[data-act="l5-flow-break"]')).to_be_visible()
            page.screenshot(path=str(out/f'{width}-{theme}-flow.png'),full_page=True)
            page.locator('[data-act="l5-flow-break"]').click()
            page.wait_for_function("""() => CUR && act(CUR.activity).role==='break' &&
              CUR.flowBreakMin>=5 && CUR.flowBreakMin<=20""")
            expect(page.locator('[data-act="l5-break-note"][data-v="Walk"]')).to_be_visible()
            page.locator('[data-act="l5-break-note"][data-v="Walk"]').click()
            page.wait_for_function("""() => CUR && CUR.note==='Walk'""")
            page.screenshot(path=str(out/f'{width}-{theme}-break.png'),full_page=True)
            # Stop a qualifying study session; reflection is optional and undoable.
            page.evaluate("""() => {
              startActivity('physics',{pomoRaw:null,at:Date.now()});
              commit(null,W().update('state/current',{
                start:isoLocal(Date.now()-20*MIN),intent:'Recall definitions'}),{undo:false});
              stopTimer();
            }""")
            expect(page.locator('#sheet')).to_contain_text('Session reflection')
            page.screenshot(path=str(out/f'{width}-{theme}-recall.png'),full_page=True)
            page.locator('#sheet [data-act="l5-recall-focus"][data-v="3"]').click()
            page.locator('#sheet [data-bind="sheet.recall"]').fill('Compact means finite subcover')
            data=page.evaluate("""() => ({k:UI.sheet.day,id:UI.sheet.id})""")
            page.locator('#sheet [data-act="l5-recall-save"]').click()
            page.wait_for_function("""(x) => {
              const e=V.days[x.k]&&V.days[x.k].entries&&V.days[x.k].entries[x.id];
              return e&&e.focus===3&&e.recall==='Compact means finite subcover';
            }""",arg=data)
            assert page.evaluate('UI.sheet===null')
            assert not errors,errors
            page.close()
    browser.close()
print('L5 SMOKE PASSED')
