"""QA/ORC: visible warning and recovery after a remote ack cannot clear local outbox."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = root / 'v2-shots' / 'qa-ack-storage'
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    for width in (390, 1280):
        for theme in ('light', 'dark'):
            page = browser.new_page(viewport={'width':width,'height':844},
                color_scheme=theme,is_mobile=width<960,has_touch=width<960)
            errors=[]
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto((root/'web/test/carrel-test.html').as_uri())
            page.wait_for_function('S.loaded.current && !!CUR && ACTS.length > 0')
            page.evaluate("""() => {
              S.uid='qa-ack-storage';
              window.qaStoreSet=store.set;
              window.qaOriginalDb=S.db;
              window.qaFailAck=false;
              store.set=(key,value)=>key==='pending:qa-ack-storage' && window.qaFailAck
                ? false : window.qaStoreSet(key,value);
              S.db={doc(){return {set(){return new Promise(resolve=>{window.qaResolve=resolve;});}};}};
              enqueue({path:'topics/qa',kind:'set',data:{v:1,title:'Ack check'}});
              window.qaFailAck=true;
              window.qaResolve();
            }""")
            page.wait_for_function("S.pendingAckStorageError === 'qa-ack-storage'")
            expect(page.locator('.r0-sync[role="alert"]')).to_contain_text('Sync cleanup failed')
            assert page.evaluate('S.pending.length') == 1
            page.screenshot(path=str(out/f'{width}-{theme}-warning.png'),full_page=True)
            page.evaluate("""() => {
              window.qaFailAck=false;
              savePending();
              changed();
            }""")
            page.wait_for_function('S.pending.length === 0 && !S.pendingAckStorageError')
            expect(page.locator('.r0-sync[role="alert"]')).to_have_count(0)
            assert not errors, errors
            page.close()
    browser.close()
print('QA ACK STORAGE SMOKE PASSED')
