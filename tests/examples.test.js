// Every HSK word has a flashcard sentence, and each one is checked against the word's level at build time.  Run: node tests/examples.test.js
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', 'site');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'dist', 'data.json'), 'utf8'));
const X = D.X; assert(Object.keys(X).length > 9000, 'graded examples present');
const lv = {}; D.W.forEach((w) => { lv[w[0]] = w[4]; });
for (const [h, [zh, en]] of Object.entries(X)) {
  assert(zh.includes(h) && en.length > 3, 'example for ' + h);
  assert(/[。？！]”?$/.test(zh) && /[.?!]["”]?$/.test(en), 'punctuation: ' + zh + ' / ' + en);
}
// every HSK word has a flashcard sentence: one written for its level, or a lesson sentence that contains it.
// Single characters that only occur inside other words, or whose list meaning differs from their usual one, are left out on purpose.
const V = JSON.parse(fs.readFileSync(path.join(root, 'vocab.json'), 'utf8')), inLesson = new Set();
D.L.forEach((l) => l.ss.forEach((s) => s[1].forEach((i) => { if (typeof i === 'number') inLesson.add(D.W[i][0]); })));
const bare = []; let total = 0;
for (const k of Object.keys(V)) V[k].forEach((r) => { total++; if (!X[r[0]] && !inLesson.has(r[0])) bare.push(r[0]); });
assert(total > 10900, 'full HSK list present');
assert(bare.length <= 60, bare.length + ' HSK words have no example sentence: ' + bare.join(' '));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(0, r));
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 400, height: 820 } }), p = await ctx.newPage();
  p.setDefaultTimeout(8000); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // 买 was saved while reading a harder lesson (lid/si point at that sentence); the card still shows the short HSK 1 sentence
  const lid = D.L.find((l) => l.i === 'h5-01').i;
  await ctx.addInitScript((a) => { try { if (!localStorage.getItem('shufang.v2')) localStorage.setItem('shufang.v2', JSON.stringify({ v: 2, updatedAt: 1, words: [{ h: '买', lid: a, si: 0, add: 1, due: 0, ease: 2.3, int: 0, reps: 0, lapses: 0, last: 0 }] })); } catch (e) { /* ignore */ } }, lid);
  await p.goto('http://localhost:' + srv.address().port + '/'); await p.waitForSelector('#tabs button');
  await p.click('#tabs button[data-v="practice"]'); await p.click('[data-act="flash-start"]'); await p.waitForSelector('.flash');
  await p.click('.flash'); await p.waitForSelector('.fx');
  const fx = await p.textContent('.fx');
  assert(fx.includes(X['买'][0]) && fx.includes(X['买'][1]), 'card shows the graded sentence: ' + fx);
  assert(errs.length === 0, errs.join('; '));
  console.log('examples ok (' + Object.keys(X).length + ' sentences)');
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
