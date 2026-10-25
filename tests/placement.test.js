// Simulates learners who know every word up to a level and checks the placement test finds that level.
// Needs Playwright (see smoke.js).  Run: node tests/placement.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', 'site');
const types = { '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => { const f = path.join(root, req.url.split('?')[0].replace(/\/$/, '/index.html')); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res); });
const vocab = JSON.parse(fs.readFileSync(root + '/vocab.json', 'utf8'));
const lvOf = {}, glOf = {};
for (const lv of Object.keys(vocab)) for (const a of vocab[lv]) { lvOf[a[0]] = +lv; glOf[a[0]] = (a[2].split(/;\s*/)[0]).replace(/\s*\([^)]*\)\s*$/, '').trim() || a[2]; }
(async () => {
  const bad = [];
  await new Promise(r => server.listen(0, r)); const url = `http://localhost:${server.address().port}/`;
  const b = await chromium.launch();
  for (const known of [0, 2, 5, 7, 9]) {
    const errs = []; const p = await (await b.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.click('#tabs button[data-v="me"]'); await p.click('[data-act="finder"]'); await p.waitForSelector('[data-act="fstart"]');
        await p.click('[data-act="fstart"]'); let n = 0;
    while (await p.locator('[data-act="fans"]').count()) {
      const h = (await p.locator('.qz').innerText()).trim();
      const opts = await p.locator('.choice').allInnerTexts();
      let j = -1;
      if (lvOf[h] <= known) j = opts.indexOf(glOf[h]);
      await p.click(`[data-act="fans"][data-j="${j}"]`); n++;
      if (n > 80) break;
    }
    const res = (await p.locator('.bignum').innerText()).trim();
    const got = res === 'New' ? 0 : +res.replace('HSK ', '');
    console.log('simulated learner at HSK', known, '-> placed', res, 'after', n, 'questions');
    if (errs.length) bad.push(errs.join(';'));
    if (Math.abs(got - known) > 0) bad.push(`learner at ${known} was placed at ${got}`);
    if (n > 30) bad.push('test too long: ' + n);
  }
  await b.close(); server.close();
  if (bad.length) { console.error('FAILED\n' + bad.join('\n')); process.exit(1); }
  console.log('placement ok');
})();
