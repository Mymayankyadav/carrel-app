"""L9 quick capture browser acceptance. Runs for light/dark phone and desktop."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1]
out=root/'v2-shots'/'l9'
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390,1280):
        for theme in ('light','dark'):
            errors=[]
            page=browser.new_page(viewport={'width':width,'height':844},
                color_scheme=theme,is_mobile=width<960,has_touch=width<960)
            page.on('pageerror',lambda err:errors.append(str(err)))
            page.goto((root/'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.current && ACTS.length>0')
            page.evaluate("l9OpenCapture('read paper tmr 14:30 1h')")
            assert page.evaluate("l9CaptureResult(UI.sheet).type==='block'")
            planned_date=page.evaluate("l9CaptureResult(UI.sheet).date")
            expect(page.locator('#sheet')).to_contain_text('Quick add')
            page.screenshot(path=str(out/f'{width}-{theme}-preview.png'),full_page=True)
            page.locator('[data-act="l9-save"]').click()
            print('L9 DEBUG block', page.evaluate("""(date) => ({
              date, sheet:UI.sheet, errors:[],
              plans: Object.keys(V.plans), records:((V.plans[date]||{}).blocks||{}),
              pending:S.pending.length, toast:UI.toast, conn:S.conn
            })""", planned_date),flush=True)
            assert page.evaluate("""(date) => {
               const k=date;
               return Object.values(((V.plans[k]||{}).blocks)||{})
                 .some(b=>b && b.title==='Read paper' && b.at==='14:30');
            }""",planned_date),'block should be saved'
            page.evaluate("l9OpenCapture('write notes 45m by fri')")
            page.locator('[data-act="l9-save"]').click()
            assert page.evaluate("""() => Object.values(((V.planning.backlog||{}).items)||{})
                 .some(t=>t&&t.title==='Write notes'&&t.minutes===45)"""),'task should be saved'
            page.evaluate("l9OpenCapture('exam tomorrow 9am')")
            exam_date=page.evaluate("l9CaptureResult(UI.sheet).date")
            page.locator('[data-act="l9-save"]').click()
            assert page.evaluate("""(date) => Object.values(((V.planning.deadlines||{}).items)||{})
                 .some(d=>d&&d.date===date&&d.kind==='exam')""",exam_date),'deadline should be saved'
            page.evaluate("l9OpenCapture('Ask for a weekly plan','ask')")
            page.locator('[data-act="l9-save"]').click()
            assert page.evaluate("""() => Object.values(V.coach||{})
                 .some(c=>c&&c.kind==='ask'&&c.from==='me'&&c.v===1)"""),'coach question should be saved'
            assert not errors,errors
            page.screenshot(path=str(out/f'{width}-{theme}-saved.png'),full_page=True)
            page.close()
    browser.close()
print('L9 SMOKE PASSED')
