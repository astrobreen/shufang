// Flashcard example sentences match the word's HSK level.  Run: node tests/examples.test.js
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', 'site');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'dist', 'data.json'), 'utf8'));
const X = D.X; assert(Object.keys(X).length > 500, 'graded examples present');
const lv = {}; D.W.forEach((w) => { lv[w[0]] = w[4]; });
for (const [h, [zh, en]] of Object.entries(X)) {
  assert(zh.includes(h) && en.length > 3, 'example for ' + h);
  assert(lv[h] <= 4, h + ' is an HSK 1-4 word');
  assert(/[。？！]$/.test(zh) && /[.?!]$/.test(en), 'punctuation: ' + zh + ' / ' + en);
}
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
