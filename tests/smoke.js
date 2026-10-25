// Browser smoke test: boots the built site, walks the five tabs, opens a lesson and a word sheet, fails on any console error.
// Needs Playwright:  npm i -D playwright && npx playwright install chromium   then   npm run test:smoke
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', 'site');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 400, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url); await p.waitForSelector('#tabs button');
  for (const t of ['read', 'words', 'practice', 'me', 'today']) {
    await p.click(`#tabs button[data-v="${t}"]`); await p.waitForTimeout(150);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 0) errs.push(`horizontal overflow on ${t}: ${over}px`);
  }
  await p.click('#tabs button[data-v="read"]'); await p.click('.lrow >> nth=0'); await p.waitForSelector('.sent');
  await p.click('.w >> nth=0'); await p.waitForSelector('#sheet .wd');
  await p.click('[data-act="close"]'); await p.click('[data-act="back"]');
  await p.click('#tabs button[data-v="practice"]'); await p.click('[data-act="write-start"]'); await p.waitForSelector('svg.anim');
  await b.close(); server.close();
  if (errs.length) { console.error('FAILED\n' + errs.join('\n')); process.exit(1); }
  console.log('smoke ok');
})();
