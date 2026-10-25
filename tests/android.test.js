// Simulates the Android app's WebView: the page is served from https://appassets.androidplatform.net/ exactly the way
// MainActivity.shouldInterceptRequest does (assets only, other hosts blocked), with the ShufangApp user agent and a mock
// of the ShufangAndroid bridge.  Run: node tests/android.test.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', 'site'), HOST = 'https://appassets.androidplatform.net';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

// every file type in site/ must have a MIME type in MainActivity.mimeOf
const java = fs.readFileSync(path.join(__dirname, '..', 'android/app/src/main/java/app/shufang/reader/MainActivity.java'), 'utf8');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const exts = [...new Set(walk(root).map((f) => path.extname(f).toLowerCase()))];
exts.forEach((x) => assert(java.includes('"' + x + '"'), 'MainActivity.mimeOf has no case for ' + x));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 820 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 ShufangApp/1.0', hasTouch: true, isMobile: true });
  const blocked = [];
  await ctx.route(/^https?:\/\//, (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== HOST) { blocked.push(u.href); return route.fulfill({ status: 403, body: '' }); }
    let p = decodeURIComponent(u.pathname); if (p === '/') p = '/index.html';
    const f = path.join(root, p);
    if (p.includes('..') || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const saved = [];
  await p.exposeFunction('__save', (n, t) => saved.push([n, t]));
  // mock of the native text-to-speech bridge: like the real one it reports start, boundary and end back through window.__tts
  await p.addInitScript(() => {
    window.__spoken = []; window.__stops = 0;
    window.ShufangAndroid = {
      saveFile: (n, t) => window.__save(n, t),
      ttsAvailable: () => true,
      ttsSpeak: (id, text, rate, pitch, lang) => {
        window.__spoken.push({ id, text, rate, pitch, lang, idType: typeof id });
        setTimeout(() => window.__tts && window.__tts(id, 'start', -1), 5);
        setTimeout(() => window.__tts && window.__tts(id, 'boundary', 0), 10);
        setTimeout(() => window.__tts && window.__tts(id, 'end', -1), 300);
      },
      ttsStop: () => { window.__stops++; }
    };
  });
  await p.goto(HOST + '/index.html'); await p.waitForSelector('#tabs button');
  assert.strictEqual(await p.evaluate(() => location.origin), HOST);
  assert.strictEqual(await p.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0, 'no service worker inside the app');

  // lazy data over the https origin
  await p.click('#tabs button[data-v="words"]'); await p.click('[data-act="wtab"][data-v="hsk"]');
  await p.waitForSelector('.wrow'); assert((await p.$$('.wrow')).length > 20, 'vocab.json loaded');
  await p.click('.wrow >> nth=0'); await p.waitForSelector('#sheet .wd');
  await p.click('#sheet [data-act="char"] >> nth=0'); await p.waitForSelector('#chanim svg', { timeout: 10000 });

  // back button
  assert.strictEqual(await p.evaluate(() => window.__androidBack()), true, 'back closes the sheet');
  assert.strictEqual(await p.evaluate(() => !!document.querySelector('#sheetwrap:not([hidden])')), false, 'the sheet is gone');
  assert.strictEqual(await p.evaluate(() => window.__androidBack()), true, 'back leaves the Words tab');
  assert.strictEqual(await p.evaluate(() => window.__androidBack()), false, 'back on Today leaves the app');

  // reader, then back
  await p.click('#tabs button[data-v="read"]'); await p.click('.lrow >> nth=0'); await p.waitForSelector('.sent');
  assert.strictEqual(await p.evaluate(() => window.__androidBack()), true, 'back leaves the lesson');
  await p.waitForSelector('#tabs button');

  // speech goes through the phone's text-to-speech engine
  await p.click('.lrow >> nth=0'); await p.waitForSelector('.sent');
  await p.click('[data-act="plays"] >> nth=0');
  await p.waitForFunction(() => window.__spoken.length >= 1);
  const one = await p.evaluate(() => window.__spoken[0]);
  assert(/^\d+$/.test(one.id) && one.idType === 'string', 'utterance id is a plain number string');
  assert(/[\u4e00-\u9fff]/.test(one.text) && one.lang === 'zh-CN' && one.rate > 0, 'sentence sent to the engine: ' + JSON.stringify(one));
  await new Promise((r) => setTimeout(r, 600));
  assert.strictEqual(await p.evaluate(() => window.__spoken.length), 1, 'a single sentence plays once and stops');
  await p.click('[data-act="play"]');                                               // whole lesson
  await p.waitForFunction(() => window.__spoken.length >= 3, null, { timeout: 8000 });
  const ids = await p.evaluate(() => window.__spoken.map((x) => +x.id));
  assert(ids.every((v, i) => i === 0 || v > ids[i - 1]), 'each sentence gets a newer id: ' + ids);
  const stops0 = await p.evaluate(() => window.__stops);
  await p.click('[data-act="play"]');                                               // pause
  assert((await p.evaluate(() => window.__stops)) > stops0, 'pause stops the engine');
  const n = await p.evaluate(() => window.__spoken.length); await new Promise((r) => setTimeout(r, 700));
  assert.strictEqual(await p.evaluate(() => window.__spoken.length), n, 'nothing keeps playing after pause');
  assert.strictEqual(await p.evaluate(() => window.__androidBack()), true, 'back leaves the lesson'); await p.waitForSelector('#tabs button');

  // backup export goes through the bridge
  await p.click('#tabs button[data-v="me"]'); await p.click('[data-act="export"]');
  await p.waitForFunction(() => true); await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(saved.length, 1, 'backup handed to the Android save dialog');
  assert(/^shufang-backup-\d{4}-\d{2}-\d{2}\.json$/.test(saved[0][0]), 'file name ' + saved[0][0]);
  assert(JSON.parse(saved[0][1]).words !== undefined, 'backup is the app data');

  // nothing leaves the app
  const probe = await p.evaluate(() => fetch('https://example.com/').then((r) => r.status, () => 'rejected'));
  assert(probe === 403 || probe === 'rejected', 'a request to another host is refused (' + probe + ')');
  assert.deepStrictEqual(blocked, ['https://example.com/'], 'the app itself asked for hosts outside the app: ' + blocked.join(', '));
  assert(errs.length === 0, 'page errors: ' + errs.join('; '));
  console.log('android wrapper simulation ok');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
