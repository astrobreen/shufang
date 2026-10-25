// Stubs speechSynthesis and checks: a sentence button speaks one sentence only; the main button speaks the whole lesson.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', 'site');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
(async () => {
  await new Promise((r) => server.listen(0, r));
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 400, height: 800 } })).newPage();
  p.on('pageerror', (e) => fails.push('pageerror ' + e.message));
  await p.addInitScript(() => {
    window.__spoken = [];
    const voice = { lang: 'zh-CN', name: 'Stub', default: true, localService: true, voiceURI: 'stub' };
    const fake = { speaking: false, pending: false, paused: false, getVoices: () => [voice], cancel() { window.__cur = null; }, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
      speak(u) { window.__spoken.push(u.text); window.__cur = u; setTimeout(() => { u.onstart && u.onstart({}); setTimeout(() => { if (window.__cur === u) { window.__cur = null; u.onend && u.onend({}); } }, 30); }, 5); } };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });
  await p.goto(`http://localhost:${server.address().port}/`); await p.waitForSelector('#tabs button');
  await p.click('#tabs button[data-v="read"]'); await p.click('.lrow >> nth=0'); await p.waitForSelector('.sent');
  const n = await p.locator('.sent').count(); ok(n > 2, 'lesson should have several sentences');
  await p.click('[data-act="plays"] >> nth=1'); await p.waitForTimeout(600);
  let sp = await p.evaluate(() => window.__spoken.slice());
  ok(sp.length === 1, 'sentence button spoke ' + sp.length + ' utterances, expected 1');
  ok(await p.locator('.sent.playing').count() === 0, 'playing highlight should clear after a single sentence');
  ok(await p.locator('[data-act="play"][aria-label="Play lesson"]').count() === 1, 'main button should read Play lesson afterwards');
  await p.evaluate(() => { window.__spoken.length = 0; });
  await p.click('[data-act="play"]'); await p.waitForTimeout(400 + 150 * n);
  sp = await p.evaluate(() => window.__spoken.slice());
  ok(sp.length >= n - 1, 'main button spoke ' + sp.length + ' sentences, expected the rest of the lesson (' + (n - 1) + ')');
  ok(await p.locator('[data-act="play"][aria-label="Play lesson"]').count() === 1, 'main button should reset after the last sentence');
  await b.close(); server.close();
  if (fails.length) { console.error('FAILED\n' + fails.join('\n')); process.exit(1); }
  console.log('audio ok (' + n + ' sentences)');
})();
