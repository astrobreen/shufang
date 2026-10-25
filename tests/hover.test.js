// Hover preview: pointing at a word shows pinyin + a short meaning; it disappears on leave.
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
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 900, height: 800 } })).newPage();
  const fails = []; p.on('pageerror', (e) => fails.push(e.message));
  await p.goto(`http://localhost:${server.address().port}/`); await p.waitForSelector('#tabs, nav button, [data-v]');
  await p.click('[data-v="read"]'); await p.click('.lrow >> nth=0'); await p.waitForSelector('.sent');
  await p.hover('.w >> nth=0'); await p.waitForTimeout(100);
  const shown = await p.evaluate(() => { const t = document.getElementById('tip'); return t && !t.hidden ? t.textContent : ''; });
  if (!shown) fails.push('tooltip did not appear on hover'); else console.log('tooltip:', shown);
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  if (await p.evaluate(() => !document.getElementById('tip').hidden)) fails.push('tooltip stayed after leaving');
  await p.hover('.w >> nth=2'); await p.waitForTimeout(100); if (process.argv[2]) await p.screenshot({ path: process.argv[2] }); await p.mouse.move(5,5); await p.click('.w >> nth=0'); await p.waitForSelector('#sheet .wd');
  if (await p.evaluate(() => !document.getElementById('tip').hidden)) fails.push('tooltip visible over the open sheet');
  await b.close(); server.close();
  if (fails.length) { console.error('FAILED\n' + fails.join('\n')); process.exit(1); }
  console.log('hover ok');
})();
