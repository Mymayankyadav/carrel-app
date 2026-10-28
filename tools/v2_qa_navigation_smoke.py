"""Phase-3 navigation audit: prove core features via *real clicks* from Today.

No production account or server is involved. Count only clicks after resetting
the mock fixture to Today; never call pushPage/openPage to satisfy a route.
Record untested/deep registry pages rather than pretending they were reached.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'screenshots' / 'nav-audit'
OUT.mkdir(parents=True, exist_ok=True)

def state(page):
    return page.evaluate("""() => ({
        view:UI.view,
        page:UI.pages.length?UI.pages.at(-1).id:null,
        sheet:UI.sheet?UI.sheet.type:null,
        desk:!!UI.desk
    })""")

def reset(page):
    # Fixture reset is not counted as a tap; assertions use real DOM clicks.
    page.evaluate("""() => {
        UI.view='today'; UI.pages=[]; UI.sheet=null; UI.desk=null;
        UI.date=null; render();
    }""")
    assert state(page) == {'view':'today','page':None,'sheet':None,'desk':False}

def visit(page, name, selectors, expected, report):
    assert len(selectors) <= 2, (name,selectors)
    reset(page)
    for sel in selectors:
        target = page.locator(sel).first
        assert target.count() == 1 and target.is_visible(), (name,sel)
        target.click()
    found = state(page)
    assert all(found.get(k)==v for k,v in expected.items()), (name,found,expected)
    report['routes'].append({'name':name,'taps':len(selectors),'state':found})
    if found['page']:
        report['reached_pages'].append(found['page'])

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390,1280):
        for theme in ('light','dark'):
            page=browser.new_page(viewport={'width':width,'height':844},
                color_scheme=theme,is_mobile=width<960,has_touch=width<960)
            errors=[]
            page.on('pageerror',lambda e: errors.append(str(e)))
            page.goto((ROOT/'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.current && ACTS.length > 0')
            report={'viewport':width,'theme':theme,'routes':[],
                'reached_pages':[],'unreached_pages':[],'cards':[]}
            report['registered_pages']=page.evaluate('Object.keys(PAGES).sort()')
            report['registered_cards']=page.evaluate('Object.keys(CARDS).sort()')

            for label,selector,view in [
                ('Plan','#nav [data-v="plan"]','plan'),
                ('Subjects','#nav [data-v="subjects"]','subjects'),
                ('Insights','#nav [data-v="insights"]','insights'),
                ('Settings','[data-act="open-settings"]','settings')]:
                visit(page,label,[selector],{'view':view,'page':None},report)

            visit(page,'Quick capture',['[data-act="l9-open"]'],
                {'sheet':'capture'},report)
            visit(page,'Today Log',['[data-act="t1-log"]'],
                {'page':'log'},report)
            visit(page,'Focus mode',['[data-act="desk"]'],
                {'desk':True},report)
            visit(page,'Subject details',[
                '#nav [data-v="subjects"]','[data-act="l4-subject"]'],
                {'page':'subject'},report)
            visit(page,'Plan quick add',[
                '#nav [data-v="plan"]','[data-act="cal-new"]'],
                {'view':'plan'},report)
            assert report['routes'][-1]['state']['sheet'], 'Plan add did not open a sheet'

            # Settings overview links are data-driven and may vary by platform
            # (e.g. Notifications appears only in native builds).
            reset(page)
            page.locator('[data-act="open-settings"]').click()
            settings=page.locator('[data-act="g1-page"]')
            ids=settings.evaluate_all(
                '(els)=>els.map(e=>e.dataset.page).filter(Boolean)')
            assert len(ids)>=7, ('Settings links missing',ids)
            for id in ids:
                visit(page,'Settings / '+id,[
                    '[data-act="open-settings"]',
                    '[data-act="g1-page"][data-page="'+id+'"]'],
                    {'page':id},report)

            # Insights detail pages have explicit one-click rows on the tab.
            for action, id in [
                ('l7-focus','stats.focus'),
                ('l7-estimates','stats.estimates'),
                ('s1-patterns','stats.patterns'),
                ('l7-streak','stats.streak')]:
                visit(page,'Insights / '+id,[
                    '#nav [data-v="insights"]',
                    '[data-act="'+action+'"]'],{'page':id},report)
            reset(page)
            page.locator('#nav [data-v="insights"]').click()
            if page.locator('[data-act="s1-subject"]').count():
                visit(page,'Insights / stats.subject',[
                    '#nav [data-v="insights"]',
                    '[data-act="s1-subject"]'],{'page':'stats.subject'},report)

            # Verify the ranked card registry actually mounts the selected
            # cards on Today. Hidden/zero-rank cards are not falsely counted.
            reset(page)
            ranked=page.evaluate('topCards(3).map(c=>c.id)')
            displayed=page.locator('#main [data-card]').evaluate_all(
                '(els)=>els.map(e=>e.dataset.card)')
            assert ranked==displayed, ('Card registry diverged from Today',ranked,displayed)
            report['cards']=displayed
            if displayed:
                first=displayed[0]
                page.locator('[data-card="'+first+'"] [data-act="card-snooze"]').click()
                assert page.locator('[data-card="'+first+'"]').count()==0, (
                    'Snoozing card did not remove it',first)
            report['unreached_pages']=sorted(
                set(report['registered_pages'])-set(report['reached_pages']))
            assert not errors, errors
            output=OUT/f'{width}-{theme}.json'
            output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
            print(f'QA {width}/{theme}: {len(report["routes"])} routes in <=2 taps, '
                  f'{len(displayed)} ranked cards, '
                  f'{len(report["unreached_pages"])} deeper/conditional pages')
            page.close()
    browser.close()
print('PHASE-3 REAL-CLICK NAVIGATION AUDIT PASSED')
