// A saved HSK word that is in no lesson must show its reading and meaning on a flashcard even when the HSK list has not been opened yet.  Run: node tests/cards.test.js
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', 'site');
const vocab = JSON.parse(fs.readFileSync(path.join(root, 'vocab.json'), 'utf8')), all = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let pick = null;
for (const lv of [9, 8, 7, 6]) for (const a of vocab[lv]) { if (a[0].length === 2 && !all.includes(a[0])) { pick = a; break; } if (pick) break; }
assert(pick, 'found an HSK word that is in no lesson');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 400, height: 820 } }), p = await ctx.newPage();
  p.setDefaultTimeout(8000); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await ctx.addInitScript((w) => { try { if (!localStorage.getItem('shufang.v2')) localStorage.setItem('shufang.v2', JSON.stringify({ v: 2, updatedAt: 1, words: [{ h: w, lid: '', si: -1, add: 1, due: 0, ease: 2.3, int: 0, reps: 0, lapses: 0, last: 0 }] })); } catch (e) { /* ignore */ } }, pick[0]);
  await p.goto(url); await p.waitForSelector('#tabs button');
  await p.click('#tabs button[data-v="practice"]'); await p.click('[data-act="flash-start"]'); await p.waitForSelector('.flash');
  await p.click('.flash'); await p.waitForSelector('.fg');
  const back = await p.textContent('.flash');
  assert(back.includes(pick[2].split(';')[0].slice(0, 6)) && back.includes(pick[1].split(' ')[0].slice(0, 2)), 'the card shows reading and meaning: ' + back + ' | ' + pick.slice(0, 3));
  await p.click('[data-act="end"]'); await p.click('#tabs button[data-v="words"]'); await p.click('[data-act="wtab"][data-v="mine"]');
  assert((await p.textContent('#wlist')).includes(pick[2].split(';')[0].slice(0, 6)), 'My words shows the meaning too');
  // HSK list: show only the words that no lesson uses
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'dist', 'data.json'), 'utf8'));
  const inStories = new Set(); data.L.forEach((l) => { const add = (x) => { if (typeof x === 'number') inStories.add(data.W[x][0]); }; l.t.forEach(add); l.sp.forEach(add); l.ss.forEach((s) => s[1].forEach(add)); });
  await p.click('[data-act="wtab"][data-v="hsk"]'); await p.click('[data-act="wlv"][data-v="3"]'); await p.waitForSelector('.rowhead [data-act="wnl"]');
  const level3 = vocab[3].map((a) => a[0]), unseen = level3.filter((h) => !inStories.has(h)).length;
  assert((await p.textContent('.rowhead .small')).includes((level3.length - unseen) + ' of ' + level3.length + ' appear in the lessons'), 'coverage line: ' + await p.textContent('.rowhead .small') + ' expected ' + (level3.length - unseen));
  await p.click('[data-act="wnl"]'); await p.waitForSelector('[data-act="wnl"].on');
  assert((await p.textContent('.note')).includes(unseen + ' words'), 'filtered note: ' + await p.textContent('.note'));
  const shown = await p.$$eval('#wlist .wrow .hz', (a) => a.map((x) => x.textContent));
  assert(shown.length > 0 && shown.every((h) => !inStories.has(h) || true) && shown.length <= 60, 'rows shown');
  assert(shown.every((h) => level3.includes(h) && !inStories.has(h)), 'only words that no lesson uses: ' + shown.filter((h) => inStories.has(h)));
  await p.click('[data-act="wnl"]'); assert(!(await p.$('[data-act="wnl"].on')), 'toggles back');
  assert(errs.length === 0, errs.join('; '));
  console.log('cards ok (' + pick[0] + ')');
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
