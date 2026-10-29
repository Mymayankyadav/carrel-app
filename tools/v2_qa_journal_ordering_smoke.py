"""QA #90: real two-tab FIFO journal append, lock contention and crash recovery.

Isolated modules only; production sync and Supabase are not modified.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
fixture = (root / "web/test/carrel-test.html").as_uri()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CARREL_CHROMIUM") or None)
    context = browser.new_context()
    a, b = context.new_page(), context.new_page()
    errors = []
    for page in (a, b):
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(fixture)
        page.add_script_tag(path=str(root / "web/logic/outbox-journal.js"))
        page.add_script_tag(path=str(root / "web/logic/outbox-delivery.js"))
        assert page.evaluate("!!navigator.locks")
        assert page.evaluate("""() => {
          window.qaId='z_first';
          window.journal=qaOutboxJournal(localStorage,'qa_order','s1',()=>qaId);
          return journal.list().ok;
        }""")
    b.evaluate("window.qaId='a_second'")
    a.evaluate("""() => {
      window.started=false;
      window.gate=new Promise(resolve=>window.release=resolve);
      window.holding=navigator.locks.request(
        'carrel-journal-delivery.v1:qa_order:s1',
        {mode:'exclusive'},async()=>{window.started=true;await gate;});
      return true;
    }""")
    a.wait_for_function("window.started===true")
    b.evaluate("""() => {
      window.pending=journal.appendBatchOrdered([
        {path:'days/same',kind:'set',data:{note:'first'}}
      ],navigator.locks,()=>true);
      return true;
    }""")
    assert a.evaluate("journal.list().records.length") == 0, "append must await lock"
    a.evaluate("window.release()")
    assert b.evaluate("window.pending")["ok"]
    a.evaluate("window.qaId='a_later'")
    assert a.evaluate("""async () => (await journal.appendOrdered(
      {path:'days/same',kind:'set',data:{note:'second'}},
      navigator.locks,()=>true)).ok""")
    # localStorage changes from another renderer may arrive after the other
    # tab's append promise resolves. Wait for visibility, then verify durable
    # ordering; never silently accept a duplicate sequence or missing record.
    try:
        b.wait_for_function("""() => {
          const rows=journal.list();
          return rows.ok && rows.records.length===2;
        }""", timeout=5000)
    except Exception as exc:
        snapshot = b.evaluate("""() => {
          const rows=journal.list();
          return {rows, keys:Array.from({length:localStorage.length},
            (_,i)=>localStorage.key(i))};
        }""")
        raise AssertionError(f"Cross-tab journal visibility failed: {snapshot}") from exc
    snapshot = b.evaluate("""() => journal.list().records.map(x=>({
      seq:x.record.seq, note:x.record.ops[0].data.note
    }))""")
    assert snapshot == [
        {"seq": 1, "note": "first"}, {"seq": 2, "note": "second"}
    ], f"Journal append order violation: {snapshot}"
    # Simultaneous independent-tab appends must produce unique FIFO sequence
    # numbers even when both paths are identical.
    a.evaluate("""() => {
      window.qaId='z_third';
      window.third=journal.appendOrdered(
        {path:'days/same',kind:'set',data:{note:'third'}},
        navigator.locks,()=>true);
    }""")
    b.evaluate("""() => {
      window.qaId='a_fourth';
      window.fourth=journal.appendOrdered(
        {path:'days/same',kind:'set',data:{note:'fourth'}},
        navigator.locks,()=>true);
    }""")
    assert a.evaluate("window.third")["ok"]
    assert b.evaluate("window.fourth")["ok"]
    b.wait_for_function("""() => {
      const rows=journal.list();
      return rows.ok && rows.records.length===4;
    }""", timeout=5000)
    expected = b.evaluate("""() => journal.list().records.map(x=>({
      seq:x.record.seq, note:x.record.ops[0].data.note
    }))""")
    assert [x["seq"] for x in expected] == [1, 2, 3, 4], expected
    assert set(x["note"] for x in expected[2:]) == {"third", "fourth"}, expected
    b.reload()
    b.add_script_tag(path=str(root / "web/logic/outbox-journal.js"))
    b.add_script_tag(path=str(root / "web/logic/outbox-delivery.js"))
    b.evaluate("""() => {
      window.journal=qaOutboxJournal(localStorage,'qa_order','s1',()=> 'after_reload');
      window.delivered=[];
    }""")
    result = b.evaluate("""async () => qaJournalDelivery(journal,navigator.locks,
      'qa_order','s1',async op=>delivered.push(op.data.note),()=>true).drain()""")
    assert result == {"ok": True, "sent": 4, "acknowledged": 4}, result
    assert b.evaluate("delivered") == [x["note"] for x in expected]
    assert b.evaluate("journal.list().records.length") == 0
    assert not errors, errors
    context.close()
    browser.close()
print("QA JOURNAL ORDERED TWO-TAB SMOKE PASSED")
