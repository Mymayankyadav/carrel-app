"""QA #90: two real tabs cannot send unordered legacy journal actions.

This is an isolated browser prototype test, not production sync migration.
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
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto(fixture)
        page.add_script_tag(path=str(root / "web/logic/outbox-journal.js"))
        page.add_script_tag(path=str(root / "web/logic/outbox-delivery.js"))
        assert page.evaluate("!!navigator.locks"), "Web Locks required for two-tab acceptance"

    # Both tabs append without an ordering lock (the old prototype API).
    for page, name, note in ((a, "z_first", "first"), (b, "a_second", "second")):
        assert page.evaluate("""({name,note}) =>
          qaOutboxJournal(localStorage,'qa_unordered_fence','s1',()=>name)
            .appendBatch([{path:'days/same',kind:'set',data:{note}}]).ok
        """, {"name":name,"note":note})
    for page in (a, b):
        page.wait_for_function("""() =>
          qaOutboxJournal(localStorage,'qa_unordered_fence','s1',
            ()=>'reader').list().records.length === 2""")
        result = page.evaluate("""async () => {
          const journal=qaOutboxJournal(localStorage,'qa_unordered_fence','s1',
            ()=>'reader');
          let sent=0;
          const outcome=await qaJournalDelivery(journal,navigator.locks,
            'qa_unordered_fence','s1',async()=>{sent++},()=>true).drain();
          return {outcome,sent,remaining:journal.list().records.length};
        }""")
        assert result == {
            "outcome": {"ok": False, "error": "unordered-pending",
                        "sent": 0, "acknowledged": 0},
            "sent": 0, "remaining": 2
        }, result

    # Ordered actions in a separate session still deliver in append order.
    for page, name, note in ((a, "z_first", "first"), (b, "a_second", "second")):
        result = page.evaluate("""async ({name,note}) =>
          qaOutboxJournal(localStorage,'qa_unordered_fence','ordered',()=>name)
            .appendOrdered({path:'days/same',kind:'set',data:{note}},
              navigator.locks,()=>true)
        """, {"name":name,"note":note})
        assert result["ok"], result
    b.wait_for_function("""() =>
      qaOutboxJournal(localStorage,'qa_unordered_fence','ordered',
        ()=>'reader').list().records.length === 2""")
    result = b.evaluate("""async () => {
      const journal=qaOutboxJournal(localStorage,'qa_unordered_fence','ordered',
        ()=>'reader');
      const sent=[];
      const outcome=await qaJournalDelivery(journal,navigator.locks,
        'qa_unordered_fence','ordered',async op=>sent.push(op.data.note),
        ()=>true).drain();
      return {outcome,sent};
    }""")
    assert result == {
        "outcome": {"ok": True, "sent": 2, "acknowledged": 2},
        "sent": ["first","second"]
    }, result
    assert not errors, errors
    context.close()
    browser.close()

print("QA JOURNAL UNSEQUENCED TWO-TAB SMOKE PASSED")
