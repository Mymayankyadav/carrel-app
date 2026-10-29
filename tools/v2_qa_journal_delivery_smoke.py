"""QA #90: two real same-origin tabs contend for Web Locks journal delivery.

The isolated journal/delivery modules are loaded explicitly; production sync
and Supabase are NOT touched. Remote send is a local in-page test callback.
"""
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
fixture = (root / 'web/test/carrel-test.html').as_uri()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    context = browser.new_context()
    a, b = context.new_page(), context.new_page()
    errors = []
    for page in (a, b):
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(fixture)
        page.add_script_tag(path=str(root / 'web/logic/outbox-journal.js'))
        page.add_script_tag(path=str(root / 'web/logic/outbox-delivery.js'))
        assert page.evaluate('!!navigator.locks'), 'Web Locks required for this browser acceptance'
        assert page.evaluate("""() => {
          window.journal=qaOutboxJournal(localStorage,'qa_delivery','s1',
            () => window.qaId);
          window.delivered=[];
          return journal.list().ok;
        }""")
    a.evaluate("window.qaId='actionA_00001'")
    b.evaluate("window.qaId='actionB_00002'")
    assert a.evaluate("""() => journal.appendBatch([
      {path:'days/a',kind:'set',data:{note:'A1'}},
      {path:'plans/a',kind:'set',data:{note:'A2'}}]).ok""")
    assert b.evaluate("""() => journal.appendBatch([
      {path:'days/b',kind:'set',data:{note:'B1'}}]).ok""")
    a.evaluate("""() => {
      window.waiting=new Promise(resolve=>window.release=resolve);
      window.started=false;
      window.coordinator=qaJournalDelivery(journal,navigator.locks,
        'qa_delivery','s1',async op=>{
          delivered.push(op.data.note);
          if(op.data.note==='A1') {started=true; await waiting;}
        },()=>true);
      window.running=coordinator.drain();
      return true;
    }""")
    a.wait_for_function('window.started === true')
    busy = b.evaluate("""async () => {
      const c=qaJournalDelivery(journal,navigator.locks,'qa_delivery','s1',
        async op=>delivered.push(op.data.note),()=>true);
      return c.drain();
    }""")
    assert busy['error'] == 'busy', busy
    assert b.evaluate('journal.list().records.length') == 2
    a.evaluate('window.release()')
    done = a.evaluate('window.running')
    assert done == {'ok': True, 'sent': 3, 'acknowledged': 2}, done
    # B must read fresh storage inside the lock and not replay A.
    again = b.evaluate("""async () => qaJournalDelivery(journal,navigator.locks,
      'qa_delivery','s1',async op=>delivered.push(op.data.note),
      ()=>true).drain()""")
    assert again == {'ok': True, 'sent': 0, 'acknowledged': 0}, again
    assert b.evaluate('delivered.length') == 0

    # Crash releases Web Lock; surviving tab recovers unacknowledged action.
    b.evaluate("window.qaId='actionC_00003'")
    assert b.evaluate("""() => journal.appendBatch([
      {path:'days/c',kind:'set',data:{note:'C1'}}]).ok""")
    a.evaluate("""() => {
      window.waiting=new Promise(()=>{});
      window.started=false;
      window.running=qaJournalDelivery(journal,navigator.locks,
        'qa_delivery','s1',async()=>{started=true; await waiting;},
        ()=>true).drain();
      return true;
    }""")
    a.wait_for_function('window.started === true')
    a.close()
    # Browser lock release after closing a tab is asynchronous. A busy
    # result means retry later, not a lost edit or failed recovery.
    for attempt in range(30):
        recovered = b.evaluate("""async () => qaJournalDelivery(journal,navigator.locks,
          'qa_delivery','s1',async op=>delivered.push(op.data.note),
          ()=>true).drain()""")
        if recovered.get('error') != 'busy':
            break
        time.sleep(0.1)
    assert recovered == {'ok': True, 'sent': 1, 'acknowledged': 1}, recovered
    assert b.evaluate('journal.list().records.length') == 0
    assert b.evaluate('delivered') == ['C1']

    # Without Web Locks, fail closed and preserve durable work.
    b.evaluate("window.qaId='actionD_00004'")
    assert b.evaluate("""() => journal.appendBatch([
      {path:'days/d',kind:'set',data:{note:'D1'}}]).ok""")
    unsupported = b.evaluate("""async () => qaJournalDelivery(journal,null,
      'qa_delivery','s1',async()=>{throw Error('should not run')},
      ()=>true).drain()""")
    assert unsupported['error'] == 'locks-unavailable'
    assert b.evaluate('journal.list().records.length') == 1
    assert not errors, errors
    context.close()
    browser.close()
print('QA JOURNAL TWO-TAB WEB LOCK DELIVERY SMOKE PASSED')
