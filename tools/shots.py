"""Capture Carrel's four tabs and optional UI states from the mock web build.

Usage: python3 tools/shots.py OUT [--dark] [--width 1280] [--js "openPage('settings','kit')"]
Requires Playwright and its Chromium browser. Prints OK only if there are no page errors,
console errors or horizontal-overflow failures. The mock never writes to production.
"""
import argparse
import pathlib
import sys
import os

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", type=pathlib.Path)
    parser.add_argument("--dark", action="store_true")
    parser.add_argument("--width", type=int, default=390)
    parser.add_argument("--js", action="append", default=[], help="JavaScript to run before capturing js-N.png")
    args = parser.parse_args()
    if args.width < 320:
        parser.error("--width must be at least 320")
    args.out.mkdir(parents=True, exist_ok=True)
    test_page = pathlib.Path(__file__).resolve().parent.parent / "web" / "test" / "carrel-test.html"
    if not test_page.exists():
        parser.error("Build the mock page first: python3 web/build.py")

    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CARREL_CHROMIUM') or None)
        is_phone = args.width < 960
        page = browser.new_page(
            viewport={"width": args.width, "height": 844},
            device_scale_factor=1,
            color_scheme="dark" if args.dark else "light",
            has_touch=is_phone,
            is_mobile=is_phone,
        )
        page.on("pageerror", lambda error: errors.append("PAGEERROR: " + str(error)))
        page.on("console", lambda message: errors.append("CONSOLE: " + message.text)
                if message.type == "error" else None)
        page.goto(test_page.as_uri())
        page.wait_for_timeout(700)

        def capture(name):
            # The document may use a wide Plan workspace, but must not overflow the viewport.
            actual = page.evaluate(
                "() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)"
            )
            if actual > args.width + 1:
                errors.append(f"H-OVERFLOW on {name}: {actual}px > {args.width}px")
            path = args.out / f"{name}.png"
            page.screenshot(path=str(path), full_page=True)
            try:
                from PIL import Image
                with Image.open(path) as shot:
                    if shot.height > 2400:
                        shot.crop((0, 0, shot.width, 2400)).save(path)
            except ImportError:
                pass

        for view in ("today", "plan", "stats", "settings"):
            try:
                page.locator(f'#nav [data-v="{view}"]').click(timeout=5000)
                page.wait_for_timeout(250)
                capture(view)
            except Exception as exc:
                errors.append(f"{view}: {exc}")
        for index, script in enumerate(args.js, 1):
            try:
                page.locator('#nav [data-v="today"]').click(timeout=5000)
                page.evaluate(script)
                page.wait_for_timeout(250)
                capture(f"js-{index}")
            except Exception as exc:
                errors.append(f"js-{index}: {exc}")
        browser.close()

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("OK: no console or page errors, no horizontal overflow")
    return 0


if __name__ == "__main__":
    sys.exit(main())
