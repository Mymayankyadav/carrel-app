"""Assemble Carrel into one self-contained page (plus a local test copy with a mock store)."""
import pathlib

root = pathlib.Path(__file__).parent
css = (root / 'style.css').read_text()
logic = (root / 'logic.js').read_text()
app = (root / 'app.js').read_text() + '\n' + (root / 'cal.js').read_text() + '\n' + (root / 'gcal.js').read_text() + '\n' + (root / 'live.js').read_text() + '\n' + (root / 'boot.js').read_text()

head = """<title>Carrel</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Personal study time tracker: timers that survive closing the page, silent pomodoro, adaptive day plans, week and pattern views.">
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

def page(extra_head=''):
    return (head + extra_head + '<style>\n' + css + '\n</style>\n' + shell +
            '<script>\n"use strict";\n' + logic.replace("if (typeof module !== 'undefined') module.exports", "if (typeof module !== 'undefined' && module.exports) module.exports") +
            '\n' + app + '\n</script>\n')

out = page()
(root / 'carrel.html').write_text(out)

# local test copy: real document skeleton + mock capabilities injected first
mock = (root / 'test' / 'mock.js').read_text() if (root / 'test' / 'mock.js').exists() else ''
test = ('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
        + '<script>\n' + mock + '\n</script>\n' + page() + '</body></html>')
(root / 'test').mkdir(exist_ok=True)
(root / 'test' / 'carrel-test.html').write_text(test)
print('built', len(out), 'bytes')
