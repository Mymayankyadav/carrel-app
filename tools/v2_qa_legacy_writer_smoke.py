"""QA #90: two real browser tabs serialize prototype legacy queue appends.

No production sync wiring, Supabase, sign-out or user documents are touched.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
fixture = (root / "web/test/carrel-test.html").as_uri()
module = root / "web/logic/outbox-legacy-writer.js"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CARREL_CHROMIUM") or None)
    context = browser.new_context()
    a, b = context.new_page(), context.new_page()
    errors = []
    for page in (a, b):
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto(fixture)
        page.add_script_tag(path=str(module))
        assert page.evaluate("!!navigator.locks"), "Web Locks required for this test"

    for page, name in ((a, "first"), (b, "second")):
        page.evaluate("""name => {
          const writer=qaLegacyLockedWriter(localStorage,'qa_legacy_writer','s1',
            navigator.locks,()=>true);
          window.qaWrite=writer.appendBatch([{
            path:'days/2026-10-30',kind:'update',data:{note:name}
          }]);
        }""", name)
    for page in (a, b):
        result = page.evaluate("async () => await window.qaWrite")
        assert result["ok"], result

    # A browser may propagate localStorage updates to a second tab after
    # both append promises settle. Re-evaluate from the Playwright host
    # rather than relying on a renderer's cached wait_for_function snapshot.
    counts = []
    for _ in range(80):
        counts = [page.evaluate("""() => {
          const w=qaLegacyLockedWriter(localStorage,'qa_legacy_writer','s1',
            navigator.locks,()=>true);
          const s=w.snapshot();
          return s.ok ? s.ops.length : s.error;
        }""") for page in (a, b)]
        if counts == [2, 2]:
            break
        a.wait_for_timeout(100)
    assert counts == [2, 2], counts
    for page in (a, b):
        notes = page.evaluate("""() => {
          const w=qaLegacyLockedWriter(localStorage,'qa_legacy_writer','s1',
            navigator.locks,()=>true);
          return w.snapshot().ops.map(x=>x.data.note).sort();
        }""")
        assert notes == ["first", "second"], notes

    # Staging marker prevents even a cooperating writer from modifying source.
    a.evaluate("""() => localStorage.setItem(
      'carrel.pending-migration-chunks.v1:qa_legacy_writer:s1','{}')""")
    marker_seen = False
    for _ in range(80):
        marker_seen = b.evaluate("""() => localStorage.getItem(
          'carrel.pending-migration-chunks.v1:qa_legacy_writer:s1')==='{}'""")
        if marker_seen:
            break
        b.wait_for_timeout(100)
    assert marker_seen, "staging marker was not visible in second tab"
    blocked = b.evaluate("""async () => qaLegacyLockedWriter(localStorage,
      'qa_legacy_writer','s1',navigator.locks,()=>true).appendBatch([{
        path:'days/2026-10-30',kind:'delete'
      }])""")
    assert blocked == {"ok": False, "error": "migration-staged"}, blocked
    assert not errors, errors
    context.close()
    browser.close()

print("QA LEGACY WRITER TWO-TAB SMOKE PASSED")
