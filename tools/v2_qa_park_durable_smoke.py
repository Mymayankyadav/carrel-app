"""QA: parked-thought failures retain drafts and show retry across four viewports."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
out=root/'v2-shots'/'qa-park'
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
      page.wait_for_function('S.loaded.current && S.loaded.distractions && ACTS.length>0')
      page.evaluate("""() => {
        UI.parkText='Remember the compactness proof';
        openSheet({type:'park'});
        window.qaParkCommit=commit;
        window.commit=()=>false;
      }""")
      page.locator('#sheet [data-act="t2-save-park"]').click()
      expect(page.locator('#sheet [role="alert"]')).to_contain_text('retry')
      assert page.evaluate("""() => UI.sheet && UI.sheet.type==='park' &&
        UI.parkText==='Remember the compactness proof'""")
      page.screenshot(path=str(out/f'{width}-{theme}-park-error.png'),full_page=True)
      page.evaluate('window.commit=window.qaParkCommit;undefined')
      page.locator('#sheet [data-act="t2-save-park"]').click()
      assert page.evaluate('UI.sheet===null')
      day=page.evaluate("""() => {
        const k=todayKey();
        const w=W().dis(k,'qa_park_durable',{type:'park',at:isoLocal(Date.now()),
          driftMin:null,text:'Move this proof to backlog',activity:null,
          entry:null,src:'page',applied:true});
        if(!commit(null,w,{undo:false}))throw Error('fixture enqueue failed');
        openSheet({type:'parked',k});
        window.commit=()=>false;
        return k;
      }""")
      expect(page.locator('#sheet [data-act="t2-park-backlog"]')).to_have_count(1)
      page.locator('#sheet [data-act="t2-park-backlog"]').click()
      expect(page.locator('#sheet [role="alert"]')).to_contain_text('retry')
      assert page.evaluate("""k => UI.sheet && UI.sheet.type==='parked' &&
        parkedItems(k).some(x=>x.id==='qa_park_durable')""",day)
      page.screenshot(path=str(out/f'{width}-{theme}-backlog-error.png'),full_page=True)
      page.evaluate('window.commit=window.qaParkCommit;undefined')
      page.locator('#sheet [data-act="t2-park-backlog"]').click()
      assert page.evaluate('UI.sheet===null')
      assert not errors,errors
      page.close()
  browser.close()
print('QA PARK DURABILITY SMOKE PASSED')
