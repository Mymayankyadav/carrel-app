"""Assemble Carrel into www/index.html (the app) and test/carrel-test.html (mock store, no sign-in)."""
import pathlib, re

root = pathlib.Path(__file__).parent
repo = root.parent
css = (root / 'style.css').read_text()
rd = lambda n: (root / n).read_text()
logic = rd('logic.js').replace("if (typeof module !== 'undefined') module.exports", "if (typeof module !== 'undefined' && module.exports) module.exports")
app = '\n'.join(rd(n) for n in ['config.js', 'supa.js', 'app.js', 'cal.js', 'gcal.js', 'native.js', 'auth.js', 'boot.js'])

head = """<meta name="description" content="Carrel: personal study time tracker with silent pomodoro timers, adaptive day plans and week views.">
<title>Carrel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Martian+Mono:wdth,wght@75..112.5,200..600&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500&family=Schibsted+Grotesk:wght@400..700&display=swap">
"""

shell = """<div id="app">
  <header id="hdr" class="bar"></header>
  <main id="main"></main>
  <nav id="nav" class="tabs-bot" aria-label="Views"></nav>
  <div id="sheet"></div>
  <div id="desk"></div>
  <div id="toast" aria-live="polite"></div>
</div>
<noscript><p style="padding:24px">Carrel needs JavaScript to run its timers.</p></noscript>
"""

paper = re.search(r'--paper:\s*(#[0-9A-Fa-f]{6})', css).group(1)

def document(extra_head='', before_app='', vendor=True):
    v = '<script src="vendor/supabase.js"></script>\n' if vendor else ''
    return ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            f'<meta name="theme-color" content="{paper}">\n' + head + extra_head +
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
