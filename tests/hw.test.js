// Handwriting search: unit checks of the recognizer on simulated handwriting, then the pad in a browser.  Run: node tests/hw.test.js
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const Core = require('../src/app/core.js');
const root = path.join(__dirname, '..', 'site');
const J = JSON.parse(fs.readFileSync(path.join(root, 'hw.json'), 'utf8'));
const idx = Core.hwIndex(J);
assert(idx.c.length > 3000, 'index has ' + idx.c.length + ' characters');

// stroke centre-lines, y down, straight from the stroke data
const meds = {};
for (const f of fs.readdirSync(path.join(root, 'strokes'))) {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'strokes', f), 'utf8'));
  for (const c in j) meds[c] = j[c][1].filter((m) => m.length > 1).map((m) => m.map((p) => [p[0], -p[1]]));
}
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(6.2832 * r());
function dense(m, n) { const L = [0]; for (let i = 1; i < m.length; i++) L.push(L[i - 1] + Math.hypot(m[i][0] - m[i - 1][0], m[i][1] - m[i - 1][1])); const T = L[L.length - 1] || 1, o = []; let j = 0; for (let k = 0; k < n; k++) { const t = T * k / (n - 1); while (j < m.length - 2 && L[j + 1] < t) j++; const f = L[j + 1] - L[j] ? (t - L[j]) / (L[j + 1] - L[j]) : 0; o.push([m[j][0] + (m[j + 1][0] - m[j][0]) * f, m[j][1] + (m[j + 1][1] - m[j][1]) * f]); } return o; }
function messy(ms, r, lvl) {            // uneven scale, slant, wobble, shifted strokes, trimmed ends, a swapped pair of strokes, irregular sampling
  const sx = 1 + (r() - .5) * .3 * lvl, sy = 1 + (r() - .5) * .3 * lvl, rot = (r() - .5) * .17 * lvl, sh = (r() - .5) * .2 * lvl, c = Math.cos(rot), s = Math.sin(rot);
  let st = ms.map((m) => m.map(([x, y]) => { x *= sx; y *= sy; x += sh * y; return [x * c - y * s, x * s + y * c]; }));
  st = st.map((m) => { const dx = gauss(r) * 18 * lvl, dy = gauss(r) * 18 * lvl; return m.map(([x, y]) => [x + dx + gauss(r) * 10 * lvl, y + dy + gauss(r) * 10 * lvl]); });
  st = st.map((m) => { if (m.length < 3 || r() > .5 * lvl) return m; return m.slice(Math.floor(m.length * .06 * r()), m.length - Math.floor(m.length * .06 * r())); });
  if (r() < .12 * lvl && st.length > 2) { const i = Math.floor(r() * (st.length - 1)); [st[i], st[i + 1]] = [st[i + 1], st[i]]; }
  return st.map((m) => dense(m, 8 + Math.floor(r() * 30)));
}
function score(chars, lvl, seed) {
  const r = rng(seed); let t1 = 0, t5 = 0;
  for (const ch of chars) { const res = Core.hwRank(messy(meds[ch], r, lvl), idx, 12).map((x) => x.c), p = res.indexOf(ch); if (p === 0) t1++; if (p >= 0 && p < 5) t5++; }
  return { top1: t1 / chars.length, top5: t5 / chars.length };
}
const pick = (n, seed) => { const r = rng(seed); return Array.from({ length: n }, () => idx.c[Math.floor(r() * idx.c.length)]); };
const clean = score(pick(150, 3), 0.001, 11); assert(clean.top1 >= 0.99, 'clean strokes: ' + JSON.stringify(clean));
const noisy = score(pick(150, 5), 1, 12); assert(noisy.top1 >= 0.9 && noisy.top5 >= 0.97, 'simulated handwriting: ' + JSON.stringify(noisy));
const rough = score(pick(150, 6), 2, 13); assert(rough.top5 >= 0.93, 'rough simulated handwriting: ' + JSON.stringify(rough));
assert.deepStrictEqual(Core.hwRank([], idx, 5), [], 'nothing drawn');
console.log('recognizer ok', JSON.stringify({ clean, noisy, rough }));

const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 360, height: 780 }, hasTouch: false, colorScheme: process.env.HW_DARK ? 'dark' : 'light' }), p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url); await p.waitForSelector('#tabs button');
  await p.click('#tabs button[data-v="words"]'); await p.click('[data-act="wtab"][data-v="dict"]'); await p.waitForSelector('#dq');
  assert(!(await p.$('#hwpad')), 'the pad is closed at first');
  await p.click('[data-act="hwtoggle"]'); await p.waitForSelector('#hwpad'); await p.waitForFunction(() => document.querySelector('#hwcands').textContent.includes('Write one character'));
  const draw = async (ch, seed) => {                     // draw the character with the mouse, a little untidily
    const box = await p.$eval('#hwpad', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; });
    const r = rng(seed), st = messy(meds[ch], r, 0.6), xs = st.flat().map((q) => q[0]), ys = st.flat().map((q) => q[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), s = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1, k = box.w * 0.7 / s, ox = box.x + box.w * 0.15, oy = box.y + box.w * 0.15;
    for (const m of st) {
      const pts = m.filter((_, i) => i % 3 === 0 || i === m.length - 1).map((q) => [ox + (q[0] - x0) * k, oy + (q[1] - y0) * k]);
      await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down();
      for (const q of pts.slice(1)) await p.mouse.move(q[0], q[1]);
      await p.mouse.up();
    }
  };
  const cands = () => p.$$eval('#hwcands .hwc', (a) => a.map((x) => x.getAttribute('data-c')));
  await draw('图', 1); await p.waitForSelector('#hwcands .hwc');
  assert.strictEqual((await p.$$('#hwpad .hwink')).length, meds['图'].length, 'one ink path per stroke');
  if (process.env.HW_SHOTS) await p.screenshot({ path: process.env.HW_SHOTS });
  assert((await cands()).slice(0, 3).includes('图'), '图 is among the first candidates: ' + (await cands()));
  await p.click('#hwcands [data-c="图"]'); await p.waitForTimeout(250);
  assert.strictEqual(await p.inputValue('#dq'), '图', 'the candidate goes into the search box');
  assert.strictEqual((await p.$$('#hwpad .hwink')).length, 0, 'the pad clears for the next character');
  await draw('书', 2); await p.waitForSelector('#hwcands .hwc'); assert((await cands()).slice(0, 3).includes('书'), '书 among the first candidates: ' + (await cands()));
  await p.click('#hwcands [data-c="书"]'); await p.waitForTimeout(300);
  assert.strictEqual(await p.inputValue('#dq'), '图书'); assert((await p.textContent('#dlist')).includes('图书馆'), 'results follow the characters');
  await draw('馆', 3); await p.waitForSelector('#hwcands .hwc'); assert((await cands()).slice(0, 3).includes('馆'), '馆 among the first candidates: ' + (await cands()));
  await p.click('[data-act="hwundo"]'); assert((await p.$$('#hwpad .hwink')).length === meds['馆'].length - 1, 'undo removes the last stroke');
  await p.click('[data-act="hwclear"]'); assert((await p.$$('#hwpad .hwink')).length === 0 && (await cands()).length === 0, 'clear');
  await p.click('[data-act="hwdel"]'); await p.waitForTimeout(150); assert.strictEqual(await p.inputValue('#dq'), '图', 'delete removes the last character');
  await p.click('[data-act="hwtoggle"]'); assert(!(await p.$('#hwpad')), 'the pad closes');
  for (const [w, h] of [[320, 640], [400, 820], [1280, 800]]) {
    await p.setViewportSize({ width: w, height: h }); await p.click('[data-act="hwtoggle"]'); await p.waitForSelector('#hwpad');
    const m = await p.evaluate(() => { const r = document.querySelector('#hwpad').getBoundingClientRect(); return { sideways: document.documentElement.scrollWidth > innerWidth + 1, inside: r.left >= 0 && r.right <= innerWidth, size: Math.round(r.width) }; });
    assert(!m.sideways && m.inside && m.size >= 240, w + 'px: ' + JSON.stringify(m));
    await p.click('[data-act="hwtoggle"]');
  }
  assert(errs.length === 0, 'page errors: ' + errs.join('; '));
  console.log('handwriting pad ok');
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
