"""QA #90: real two-tab browser fence for non-authoritative migration copies.

The prototype modules are injected into the mock page. No production sync,
Supabase, user documents, or native permissions are touched.
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
        assert page.evaluate("!!navigator.locks"), "Web Locks required for this test"

    assert a.evaluate("""() => {
      const normal=qaOutboxJournal(localStorage,'qa_stage_fence','s1',()=> 'normal_1');
      const staged=qaOutboxJournal(localStorage,'qa_stage_fence','s1',
        ()=> 'legacy_chunk_v1_000000');
      return normal.appendBatch([{path:'days/normal',kind:'set',data:{v:1}}]).ok &&
        staged.appendBatch([{path:'days/staged',kind:'set',data:{v:2}}]).ok;
    }""")
    b.wait_for_function("""() => qaOutboxJournal(localStorage,'qa_stage_fence','s1',
      ()=> 'reader').list().records.length === 2""")
    for page in (a, b):
        result = page.evaluate("""async () => {
          const journal=qaOutboxJournal(localStorage,'qa_stage_fence','s1',
            ()=> 'reader');
          window.qaSent=0;
          const coordinator=qaJournalDelivery(journal,navigator.locks,
            'qa_stage_fence','s1',async()=>{window.qaSent++},()=>true);
          const outcome=await coordinator.drain();
          return {outcome,sent:window.qaSent,remaining:journal.list().records.length,
            stagedAck:journal.acknowledge(journal.list().records[1])};
        }""")
        assert result == {
            "outcome": {"ok": False, "error": "migration-staged",
                        "sent": 0, "acknowledged": 0},
            "sent": 0, "remaining": 2, "stagedAck": False
        }, result
    assert not errors, errors
    context.close()
    browser.close()

print("QA JOURNAL STAGED DELIVERY TWO-TAB SMOKE PASSED")
