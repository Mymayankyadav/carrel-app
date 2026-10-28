"""L3 smart scheduling preview and persistence acceptance, mock only."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
out=root/'v2-shots'/'l3'
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
   day=page.evaluate("""() => {
     const k=addDaysKey(todayKey(),1);
     S.base.planning.backlog={items:{qa_l3:{title:'Auto planned Topology',
       activity:firstStudyId(),minutes:45,prio:1}}};
     recompute();l3OpenAuto(k);
     return k;
   }""")
   assert page.evaluate("UI.sheet && UI.sheet.type==='autoplan'"),'preview should open'
   expect(page.locator('#sheet').get_by_text('Auto-plan',exact=True)).to_be_visible()
   expect(page.locator('#sheet').get_by_text('Auto planned Topology')).to_be_visible()
   page.screenshot(path=str(out/f'{width}-{theme}-preview.png'),full_page=True)
   page.locator('[data-act="l3-auto-accept"]').click()
   assert page.evaluate("""(k) => Object.values((V.plans[k]||{}).blocks||{})
      .some(b=>b && b.from==='auto')""",day),'accepted schedule persisted'
   assert page.evaluate("UI.sheet===null"),'sheet closed after acceptance'
   assert not errors,errors
   page.screenshot(path=str(out/f'{width}-{theme}-accepted.png'),full_page=True)
   page.close()
 browser.close()
print('L3 SMOKE PASSED')
