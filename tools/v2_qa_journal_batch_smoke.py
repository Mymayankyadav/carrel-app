"""QA #90: real two-page same-origin atomic journal durability smoke.

This exercises the isolated journal, not production sync.js integration.
Two Pages in ONE BrowserContext share localStorage while keeping independent JS
heaps; separate BrowserContexts would not reproduce competing Carrel tabs.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
fixture = (root / 'web/test/carrel-test.html').as_uri()
script = str(root / 'web/logic/outbox-journal.js')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
    context = browser.new_context()
    tab_a, tab_b = context.new_page(), context.new_page()
    errors = []
    for tab in (tab_a, tab_b):
        tab.on('pageerror', lambda error: errors.append(str(error)))
        tab.goto(fixture)
        tab.add_script_tag(path=script)
    init = """() => {
      const uid='qa_journal_browser', session='session_qa_browser';
      window.journal=qaOutboxJournal(localStorage,uid,session,
        () => window.qaId);
      return journal.list().records.length;
    }"""
    assert tab_a.evaluate(init) == 0
    assert tab_b.evaluate(init) == 0
    tab_a.evaluate("window.qaId='browser_tab_A_00001'")
    tab_b.evaluate("window.qaId='browser_tab_B_00002'")
    action_a = """() => journal.appendBatch([
      {path:'days/2026-10-29',kind:'set',data:{date:'2026-10-29',entries:{a:{note:'first'}}}},
      {path:'plans/2026-10-29',kind:'update',data:{blocks:{a:{minutes:30}}}}
    ])"""
    action_b = """() => journal.appendBatch([
      {path:'days/2026-10-30',kind:'set',data:{date:'2026-10-30',entries:{b:{note:'second'}}}}
    ])"""
    first = tab_a.evaluate(action_a)
    second = tab_b.evaluate(action_b)
    assert first['ok'] and second['ok'], (first, second)
    for tab in (tab_a, tab_b):
        records = tab.evaluate('journal.list()')
        assert records['ok'] and len(records['records']) == 2, records
        batches = [r['record']['ops'] for r in records['records']]
        assert sorted(len(x) for x in batches) == [1, 2], batches

    # A real reload discards tab-local JS state but not the two durable edits.
    tab_a.reload()
    tab_a.add_script_tag(path=script)
    assert tab_a.evaluate(init) == 2
    assert tab_a.evaluate("""(item) => journal.acknowledge(item)""", first)
    records = tab_b.evaluate('journal.list()')
    assert records['ok'] and len(records['records']) == 1
    assert records['records'][0]['key'] == second['key']
    assert not tab_b.evaluate("""(item) => journal.acknowledge(item)""", first)

    # Simulated quota exception cannot expose half a multi-document action.
    failed = tab_a.evaluate("""() => {
      const disk = {
        getItem:k=>localStorage.getItem(k),
        setItem:()=>{throw Error('QuotaExceededError')},
        removeItem:k=>localStorage.removeItem(k),
        key:i=>localStorage.key(i),
        get length(){return localStorage.length}
      };
      return qaOutboxJournal(disk,'qa_journal_browser','session_qa_browser',
        ()=>'browser_quota_00003').appendBatch([
          {path:'days/2026-11-01',kind:'set',data:{date:'2026-11-01'}},
          {path:'plans/2026-11-01',kind:'set',data:{date:'2026-11-01'}}
        ]);
    }""")
    assert not failed['ok'] and failed['uncertain']
    assert tab_b.evaluate('journal.list().records.length') == 1

    # Session fencing is independent of tab identity and survives reload.
    assert tab_b.evaluate("""() => qaOutboxJournal(localStorage,
      'qa_journal_browser','new_session',()=> 'new_session_op').list().records.length""") == 0
    assert not errors, errors
    # Explicit fixture cleanup only; never clear production browser storage.
    assert tab_b.evaluate("""(item) => journal.acknowledge(item)""", second)
    assert tab_a.evaluate('journal.list().records.length') == 0
    context.close()
    browser.close()
print('QA JOURNAL TWO-TAB ATOMIC ACTION SMOKE PASSED')
