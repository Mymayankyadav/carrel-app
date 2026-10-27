"""Assemble Carrel into www/index.html (the app) and test/carrel-test.html (mock store, no sign-in)."""
import hashlib, os, pathlib, re, urllib.request

root = pathlib.Path(__file__).parent
repo = root.parent
css = (root / 'style.css').read_text()
rd = lambda n: (root / n).read_text()
logic = rd('logic.js').replace("if (typeof module !== 'undefined') module.exports", "if (typeof module !== 'undefined' && module.exports) module.exports")
app = '\n'.join(rd(n) for n in ['config.js', 'supa.js', 'app.js', 'cal.js', 'gcal.js', 'native.js', 'auth.js', 'boot.js'])


FONT_URL = ('https://fonts.googleapis.com/css2?family=Martian+Mono:wdth,wght@75..112.5,200..600'
            '&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500'
            '&family=Schibsted+Grotesk:wght@400..700&display=swap')

def offline_fonts():
    """Bundle requested WOFF2 files for the deployed app; local builds need no network."""
    if os.environ.get('CARREL_BUNDLE_FONTS') != '1':
        return ''
    req = urllib.request.Request(FONT_URL, headers={
        'User-Agent': 'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36'})
    with urllib.request.urlopen(req, timeout=30) as res:
        font_css = res.read().decode('utf-8')
    urls = sorted(set(re.findall(r'https://fonts[.]gstatic[.]com/[^)\s]+', font_css)))
    if not urls:
        raise RuntimeError('Google Fonts did not provide any downloadable WOFF2 files')
    target = repo / 'www' / 'fonts'
    target.mkdir(parents=True, exist_ok=True)
    for url in urls:
        with urllib.request.urlopen(url, timeout=30) as res:
            blob = res.read()
        if not blob or len(blob) > 4_000_000:
            raise RuntimeError('Font download empty or unexpectedly large')
        name = hashlib.sha256(blob).hexdigest()[:20] + '.woff2'
        (target / name).write_bytes(blob)
        font_css = font_css.replace(url, 'fonts/' + name)
    for family in ('Martian Mono', 'Newsreader', 'Schibsted Grotesk'):
        if family not in font_css:
            raise RuntimeError('Missing font family: ' + family)
    print('bundled', len(urls), 'offline font files')
    return '<style>\n' + font_css + '\n</style>\\n'

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

# Keep Android's status bar in step with the system theme, even before JS boots.
paper_colors = re.findall(r'--paper:\s*(#[0-9A-Fa-f]{6})', css)
if len(paper_colors) < 2:
    raise ValueError('Expected light and dark --paper colors in style.css')
paper, dark_paper = paper_colors[:2]

def document(extra_head='', before_app='', vendor=True, local_font_css=''):
    v = '<script src="vendor/supabase.js"></script>\n' if vendor else ''
    return ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            f'<meta name="theme-color" media="(prefers-color-scheme: light)" content="{paper}">\n'
            f'<meta name="theme-color" media="(prefers-color-scheme: dark)" content="{dark_paper}">\n' + (head.split('<link rel="preconnect"')[0] if local_font_css else head) + local_font_css + extra_head +
            '<style>\n' + css + '\n</style></head><body>\n' + shell + before_app + v +
            '<script>\n"use strict";\n' + logic + '\n' + app + '\n</script>\n</body></html>\n')

www = repo / 'www'
(www / 'vendor').mkdir(parents=True, exist_ok=True)
out = document(local_font_css=offline_fonts())
(www / 'index.html').write_text(out)

mock = (root / 'test' / 'mock.js').read_text() if (root / 'test' / 'mock.js').exists() else ''
(root / 'test').mkdir(exist_ok=True)
(root / 'test' / 'carrel-test.html').write_text(document(before_app='<script>\n' + mock + '\n</script>\n', vendor=False))
print('built', len(out), 'bytes')
