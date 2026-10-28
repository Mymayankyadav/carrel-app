"""L10 mock-only coach inbox acceptance at four viewports/themes."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
out=root/'v2-shots'/'l10'
out.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390,1280):
        for theme in ('light','dark'):
            page=browser.new_page(viewport={'width':width,'height':844},
                color_scheme=theme,is_mobile=width<960,has_touch=width<960)
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto((root/'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.current && S.loaded.activities && S.loaded.coach && ACTS.length>0')
            page.evaluate("""() => {
              const a=ACTS.find(x=>x.kind==='study'&&!x.archived);
              if(!a)throw Error('No mock study activity');
              V.coach={
                'mock-coach':{
                  v:1,kind:'plan',from:'claude',status:'new',
                  at:isoLocal(Date.now()),
                  title:'Tomorrow: finish one proof',body:'Review <script>must not run</script>',
                  proposal:{date:addDaysKey(todayKey(),1),
                    blocks:[{activity:a.id,title:'Read chapter and prove lemma',
                      minutes:60,at:'09:00'}]}
                },
                malformed:{v:1,kind:'plan',from:'unsafe',status:'new',title:'Ignored'}
              };
              UI.pages=[];UI.view='insights';render();
            }""")
            expect(page.locator('#main [data-act="l10-open"]')).to_be_visible()
            expect(page.locator('#main')).to_contain_text('From Claude')
            page.screenshot(path=str(out/f'{width}-{theme}-inbox.png'),full_page=True)
            page.locator('#main [data-act="l10-open"]').first.click()
            expect(page.locator('#sheet')).to_contain_text('Tomorrow: finish one proof')
            expect(page.locator('#sheet [data-act="l10-accept"]')).to_be_visible()
            assert page.locator('#sheet script').count()==0
            page.screenshot(path=str(out/f'{width}-{theme}-proposal.png'),full_page=True)
            page.locator('#sheet [data-act="l10-accept"]').click()
            page.wait_for_function('!UI.sheet')
            assert not errors,errors
            page.close()
    browser.close()
print('L10 COACH SMOKE PASSED')
