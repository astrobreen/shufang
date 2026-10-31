#!/usr/bin/env python3
"""Assemble the static site.

  python3 tools/assemble.py              -> site/ (index.html, manifest, service worker, data files)

The app is one HTML file: CSS + core.js + the compact lesson bundle (inline) + src/app/js/*.js in one IIFE.
Big, lazily fetched data (vocab.json, chars.json, examples.json, strokes/*.json) sits next to it.
"""
import glob, hashlib, json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda *p: open(os.path.join(ROOT, *p), encoding='utf-8').read()
safe = lambda s: s.replace('</', '<\\/')
DIST = os.path.join(ROOT, 'build', 'dist')

css = rd('src', 'app', 'app.css')
core = rd('src', 'app', 'core.js')
data = rd('build', 'dist', 'data.json').strip()
code = '\n'.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(ROOT, 'src', 'app', 'js', '*.js'))))

BODY = """<div id="app">
<main id="main"></main>
<div id="reader" hidden></div>
<div id="audio" hidden></div>
<nav id="tabs" aria-label="Sections"></nav>
<div id="sheetwrap" hidden><div id="sheet" role="dialog" aria-modal="true"></div></div>
<div id="toast" role="status" aria-live="polite" hidden></div>
<input id="imp" type="file" accept="application/json,.json" hidden>
</div>"""
SCRIPTS = f"""<script>
{safe(core)}
</script>
<script>
window.__D__ = {safe(data)};
</script>
<script>
(function () {{
"use strict";
{safe(code)}
}})();
</script>"""

SITE = os.path.join(ROOT, 'site')
os.makedirs(SITE, exist_ok=True)
for name in ('vocab.json', 'chars.json', 'examples.json'):  # written by bundle.py
    assert os.path.exists(os.path.join(SITE, name)), 'run tools/bundle.py first (needs ./vendor)'

version = hashlib.sha1((css + core + data + code).encode()).hexdigest()[:10]
html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F6F5F1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B0D0C" media="(prefers-color-scheme: dark)">
<meta name="description" content="Shufang 书房: a graded Chinese reader and study room with HSK 3.0 levels 1 to 9.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Shufang">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/svg+xml" href="icons/icon.svg">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<title>Shufang</title>
<style>
:root {{ color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }}
html:root {{ color-scheme: light dark; }}
body {{ margin: 0; font-size: 14px; }}
[hidden] {{ display: none !important; }}
{css}
</style>
</head>
<body>
{BODY}
{SCRIPTS}
<script>
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !/ShufangApp/.test(navigator.userAgent)) {{
  window.addEventListener('load', function () {{ navigator.serviceWorker.register('sw.js').catch(function () {{}}); }});
}}
</script>
</body>
</html>
"""
open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8').write(html)

open(os.path.join(SITE, 'manifest.webmanifest'), 'w', encoding='utf-8').write(json.dumps({
    'name': 'Shufang 书房 — Chinese Reader', 'short_name': 'Shufang', 'description': 'Graded Chinese reader and study room, HSK 1 to 9.',
    'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'portrait-primary',
    'background_color': '#F6F5F1', 'theme_color': '#C8281E',
    'icons': [
        {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ]}, ensure_ascii=False, indent=2))

open(os.path.join(SITE, 'sw.js'), 'w', encoding='utf-8').write(f"""/* Offline cache. The version below changes whenever the app or its data changes. */
const VERSION = 'shufang-{version}';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'vocab.json', 'chars.json', 'examples.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => {{
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', (e) => {{
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('shufang-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('fetch', (e) => {{
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, {{ ignoreSearch: true }}).then((hit) => hit || fetch(req).then((res) => {{
    if (res.ok) {{ const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }}
    return res;
  }}).catch(() => caches.match('index.html'))));
}});
""")
print('site/index.html', os.path.getsize(os.path.join(SITE, 'index.html')) // 1024, 'KB; sw version', version)
