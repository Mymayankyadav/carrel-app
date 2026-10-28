"""L2 morning and shutdown rituals: mock-only phone/desktop and light/dark browser checks."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1]
out=root/'v2-shots'/'l2';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
  for width in (390,1280):
    for theme in ('light','dark'):
      errors=[]
      page=browser.new_page(viewport={'width':width,'height':844},color_scheme=theme,
        is_mobile=width<960,has_touch=width<960)
      page.on('pageerror',lambda e:errors.append(str(e)))
      page.goto((root/'web/test/carrel-test.html').as_uri())
      page.wait_for_function("S.loaded.current && S.loaded.rituals && S.loaded.planning && ACTS.length>0")
      day=page.evaluate("""() => {
        const k=todayKey();
        commit(null,W().update('planning/backlog',{items:{
          qa_l2:{title:'L2 realistic planning',activity:'physics',minutes:35,prio:1,
            order:999,created:isoLocal(Date.now())}}},{items:{}}),{undo:false});
        l2OpenMorning(k);return k;
      }""")
      expect(page.locator('#sheet')).to_contain_text('Pick today')
      assert page.evaluate("UI.sheet.type==='morning'&&UI.sheet.candidates.some(t=>t.id==='backlog:qa_l2')")
      page.screenshot(path=str(out/f'{width}-{theme}-pick.png'),full_page=True)
      page.locator('#sheet [data-act="k-flow-next"]').click()
      assert page.evaluate('UI.sheet.step===1')
      expect(page.locator('#sheet')).to_contain_text('proposed block')
      page.screenshot(path=str(out/f'{width}-{theme}-preview.png'),full_page=True)
      page.locator('#sheet [data-act="k-flow-next"]').click()
      assert page.evaluate('UI.sheet.step===2 && UI.sheet.accepted')
      page.locator('#sheet [data-bind="sheet.intent"]').fill('Prove one theorem today')
      page.locator('#sheet [data-act="k-flow-next"]').click()
      page.wait_for_function("""k => V.rituals[k] && V.rituals[k].morning &&
        V.rituals[k].morning.intent==='Prove one theorem today'""",arg=day)
      assert page.evaluate('UI.sheet===null')
      page.evaluate("l2OpenShutdown(todayKey())")
      assert page.evaluate('UI.sheet.type==="shutdown"')
      expect(page.locator('#sheet')).to_contain_text('Today')
      page.locator('#sheet [data-act="k-flow-next"]').click()
      assert page.evaluate('UI.sheet.step===1')
      if page.locator('#sheet [data-act="l2-disposition"][data-v="backlog"]').count():
        page.locator('#sheet [data-act="l2-disposition"][data-v="backlog"]').first.click()
      page.screenshot(path=str(out/f'{width}-{theme}-leftovers.png'),full_page=True)
      page.locator('#sheet [data-act="k-flow-next"]').click()
      assert page.evaluate('UI.sheet.step===2')
      page.locator('#sheet [data-act="k-flow-next"]').click()
      page.wait_for_function("k => V.rituals[k] && !!V.rituals[k].shutdown",arg=day)
      assert page.evaluate('UI.sheet===null')
      assert not errors,errors
      page.screenshot(path=str(out/f'{width}-{theme}-closed.png'),full_page=True)
      page.close()
  browser.close()
print('L2 SMOKE PASSED')
