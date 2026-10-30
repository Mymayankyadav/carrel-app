"""L4 Subjects and spaced-revision browser checks. Mock DB; no production login."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]
out=root/'v2-shots'/'l4'
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
            page.wait_for_function('S.loaded.current && S.loaded.topics && ACTS.length>0')
            page.locator('#nav [data-v="subjects"]').click()
            expect(page.locator('.l4-heading')).to_contain_text('Subjects')
            expect(page.locator('[data-act="l4-subject"][data-id="physics"]')).to_be_visible()
            page.screenshot(path=str(out/f'{width}-{theme}-subjects.png'),full_page=True)
            page.locator('[data-act="l4-subject"][data-id="physics"]').click()
            assert page.evaluate("UI.pages.at(-1).id==='subject'")
            page.screenshot(path=str(out/f'{width}-{theme}-detail.png'),full_page=True)
            page.evaluate("l4NewTopic('physics')")
            page.locator('[data-bind="sheet.d.title"]').fill('Orbital motion')
            page.locator('[data-act="l4-topic-save"]').click()
            page.wait_for_function("""() => Object.values(V.topics||{})
              .some(t=>t&&t.title==='Orbital motion'&&t.subject==='physics'&&t.interval===1)""")
            # Simulate a durable queue failure: keep the typed topic visible and retryable.
            page.evaluate("l4NewTopic('physics')")
            page.locator('[data-bind="sheet.d.title"]').fill('Retry after storage failure')
            page.evaluate("window.__qaEnqueue = enqueueBatch; enqueueBatch = () => false")
            page.locator('[data-act="l4-topic-save"]').click()
            expect(page.locator('.l4-error')).to_contain_text('not saved')
            expect(page.locator('[data-bind="sheet.d.title"]')).to_have_value('Retry after storage failure')
            page.screenshot(path=str(out/f'{width}-{theme}-failed-topic-save.png'),full_page=True)
            page.evaluate("enqueueBatch = window.__qaEnqueue; delete window.__qaEnqueue")
            page.locator('[data-act="l4-topic-save"]').click()
            page.wait_for_function("""() => Object.values(V.topics||{})
              .some(t=>t&&t.title==='Retry after storage failure')""")
            page.evaluate("""() => {
                const w=W();w.set('topics/qa_due',{
                  v:1,subject:'physics',title:'Recall circular motion',order:100,
                  due:todayKey(),interval:2,reps:1,ease:2.5,last:null,archived:false});
                commit(null,w,{undo:false});
            }""")
            page.wait_for_function("""() => !!(S.base.topics||{}).qa_due &&
              !S.pending.some(op=>op.path==='topics/qa_due') &&
              l4DueTopics(todayKey()).some(x=>x.id==='qa_due')""")
            page.evaluate("openSheet({type:'reviews'})")
            expect(page.locator('[data-act="l4-review-rate"][data-id="qa_due"]')).to_have_count(3)
            page.screenshot(path=str(out/f'{width}-{theme}-reviews.png'),full_page=True)
            page.locator('[data-act="l4-review-rate"][data-id="qa_due"][data-v="3"]').click()
            page.wait_for_function("""() => !!(V.topics.qa_due&&V.topics.qa_due.interval===5&&V.topics.qa_due.reps===2)""")
            assert not errors,errors
            page.close()
    browser.close()
print('L4 SMOKE PASSED')
