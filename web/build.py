"""Assemble Carrel into www/index.html (the app) and test/carrel-test.html (mock store, no sign-in)."""
import json, pathlib, re

root = pathlib.Path(__file__).parent
repo = root.parent
manifest = json.loads((root / 'files.json').read_text())
css = '\n'.join((root / n).read_text() for n in manifest['css'])
rd = lambda n: (root / n).read_text()
logic = rd('logic.js').replace("if (typeof module !== 'undefined') module.exports", "if (typeof module !== 'undefined' && module.exports) module.exports")
app = '\n'.join(rd(n) for n in manifest['js'])


head = """<meta name="description" content="Carrel: personal study time tracker with silent pomodoro timers, adaptive day plans and week views.">
<title>Carrel</title>
"""

shell = """<div id="app">
  <main id="main"></main>
  <div id="nav"></div>
  <div id="sheet"></div>
  <div id="desk"></div>
  <div id="toast" aria-live="polite"></div>
  <div id="pop"></div>
</div>
<noscript><p style="padding:24px">Carrel needs JavaScript to run its timers.</p></noscript>
"""

# Keep Android's status bar in step with the system theme, even before JS boots.
paper_colors = re.findall(r'--bg:\s*(#[0-9A-Fa-f]{6})', css)
if len(paper_colors) < 2:
    raise ValueError('Expected light and dark --bg colours in kit CSS')
paper, dark_paper = paper_colors[:2]

def document(extra_head='', before_app='', vendor=True):
    v = '<script src="vendor/supabase.js"></script>\n' if vendor else ''
    return ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            f'<meta name="theme-color" media="(prefers-color-scheme: light)" content="{paper}">\n'
            f'<meta name="theme-color" media="(prefers-color-scheme: dark)" content="{dark_paper}">\n' + head + extra_head +
            '<style>\n' + css + '\n</style></head><body>\n' + shell + before_app + v +
            '<script>\n"use strict";\n' + logic + '\n' + app + '\n</script>\n</body></html>\n')

www = repo / 'www'
(www / 'vendor').mkdir(parents=True, exist_ok=True)
out = document()
(www / 'index.html').write_text(out)

mock = (root / 'test' / 'mock.js').read_text() if (root / 'test' / 'mock.js').exists() else ''
(root / 'test').mkdir(exist_ok=True)
(root / 'test' / 'carrel-test.html').write_text(document(before_app='<script>\n' + mock + '\n</script>\n', vendor=False))
print('built', len(out), 'bytes')
