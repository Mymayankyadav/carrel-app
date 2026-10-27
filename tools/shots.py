"""Phone-width screenshots of every Carrel view from the mock build, plus console errors and overflow checks.

Usage (from the repo root):
    python3 web/build.py
    python3 tools/shots.py OUT_DIR [--dark]

Writes OUT_DIR/{today,calendar,week,patterns,setup}.png (390px wide, cropped to 2400px tall)
and prints console errors, page errors and horizontal-overflow warnings.
The font-loading ERR_TUNNEL_CONNECTION_FAILED error is expected offline; ignore it.
"""
import pathlib, sys
from playwright.sync_api import sync_playwright

out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
dark = '--dark' in sys.argv
page_path = pathlib.Path(__file__).resolve().parent.parent / 'web' / 'test' / 'carrel-test.html'
W, MAXH = 390, 2400
errs = []

def crop(p):
    try:
        from PIL import Image
        im = Image.open(p)
        if im.size[1] > MAXH: im.crop((0, 0, W, MAXH)).save(p)
    except ImportError:
        pass

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': 844}, device_scale_factor=1,
                    color_scheme='dark' if dark else 'light', has_touch=True, is_mobile=True)
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') and 'TUNNEL' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.goto('file://' + str(page_path)); pg.wait_for_timeout(1500)
    for v in ['today', 'calendar', 'week', 'patterns']:
        pg.click(f'#nav [data-v="{v}"]'); pg.wait_for_timeout(600)
        sw = pg.evaluate('document.documentElement.scrollWidth')
        if sw > W: errs.append(f'H-OVERFLOW on {v}: page is {sw}px wide')
        f = out / f'{v}.png'; pg.screenshot(path=str(f), full_page=True); crop(f)
    pg.click('#nav [data-act="setup"]'); pg.wait_for_timeout(600)
    pg.screenshot(path=str(out / 'setup.png'))
    b.close()
print('\n'.join(errs) or 'OK: no console errors, no horizontal overflow')
