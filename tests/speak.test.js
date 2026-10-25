// Speaking drill: the comparison logic, then the drill in a browser with a stand-in speech recogniser.  Run: node tests/speak.test.js
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const C = require('../src/app/core.js');
const root = path.join(__dirname, '..', 'site');

// comparison
const ok = (t, h) => C.speakCompare(t, h).ok;
assert(ok('我想喝一杯茶。', ['我想喝一杯茶']), 'exact, punctuation ignored');
assert(ok('我想喝一杯茶', ['我想喝杯茶']), 'one character dropped in a longer sentence is still fine');
assert(ok('我想喝一杯茶', ['我想喝一杯查', '我想喝一杯茶']), 'a better alternative is used');
assert(!ok('我想喝一杯茶', ['你好']), 'a different sentence fails');
assert(!ok('我是学生', ['我是老师']), 'a short sentence must be exact');
assert(ok('三个人', ['3个人']) && ok('我十二岁', ['我12岁']), 'digits are read as Chinese numbers');
assert(!ok('我想喝一杯茶', []) && !ok('我想喝一杯茶', ['']), 'nothing heard');
const r = C.speakCompare('今天天气很好', ['今天天汽很好']);
assert.deepStrictEqual(r.marks, [true, true, true, false, true, true], 'the missed character is marked');
assert(r.score > 0.8 && r.score < 1);
console.log('speak compare ok');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((q, rs) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!fs.existsSync(f)) { rs.writeHead(404); return rs.end(); } rs.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rs); });
const MOCK = () => {                       // a recogniser that answers with whatever the test sets
  window.__sr = { heard: null, err: null, starts: 0 };
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() { window.__sr.starts++; if (window.__sr.hang) return; const me = this; setTimeout(() => { const s = window.__sr; if (s.err) me.onerror && me.onerror({ error: s.err }); else if (s.heard) { const res = s.heard.map((t) => ({ transcript: t })); me.onresult && me.onresult({ results: [res] }); } if (!s.noend) me.onend && me.onend(); }, 40); }
    stop() {} abort() {}
  };
};

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  const open = async (init, w = 400, h = 820) => { const ctx = await b.newContext({ viewport: { width: w, height: h } }); if (init) await ctx.addInitScript(typeof init === 'string' ? { content: init } : init); const p = await ctx.newPage(); p.setDefaultTimeout(8000); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); await p.goto(url); await p.waitForSelector('#tabs button'); await p.click('#tabs button[data-v="practice"]'); return { p, errs, ctx }; };

  // no speech recognition: no tile
  let t = await open(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  assert(!(await t.p.$('[data-act="speak-start"]')), 'no Speaking tile without speech recognition'); assert.strictEqual((await t.p.$$('.tilebtn')).length, 4);
  await t.ctx.close();
  // a page that is not allowed to use the microphone: no tile either
  t = await open('(' + (() => { MOCK_BODY(); Object.defineProperty(document, 'permissionsPolicy', { value: { allowsFeature: (f) => f !== 'microphone' } }); }).toString().replace('MOCK_BODY()', '(' + MOCK.toString() + ')()') + ')()');
  assert(!(await t.p.$('[data-act="speak-start"]')), 'no Speaking tile where the microphone is blocked');
  await t.ctx.close();

  // the drill
  t = await open(MOCK); const p = t.p;
  assert.strictEqual((await p.$$('.tilebtn')).length, 5, 'Speaking tile appears'); await p.click('[data-act="speak-start"]');
  await p.waitForSelector('[data-act="sok"]'); assert(/does not grade your tones/.test(await p.textContent('#main')), 'the notice is shown first');
  await p.click('[data-act="sok"]'); await p.waitForSelector('.micbtn');
  const target = () => p.$$eval('.spk-line ruby', (a) => a.map((r) => r.firstChild.textContent).join('')).then((s) => s || p.$eval('.spk-line', (e) => e.textContent));
  const say = async (heard, err) => { await p.evaluate(([h, e]) => { window.__sr.heard = h; window.__sr.err = e; }, [heard, err || null]); await p.click('.micbtn'); await p.waitForFunction(() => !document.querySelector('.micbtn.on')); await p.waitForTimeout(100); };
  // 1: said correctly
  if (process.env.SPEAK_SHOTS) await p.screenshot({ path: process.env.SPEAK_SHOTS + '/speak-idle.png' });
  let tg = await target(); assert(tg.length >= 4, 'sentence shown: ' + tg);
  await say([tg]); assert(/Well said/.test(await p.textContent('#main')), 'correct: ' + tg + ' | ' + (await p.textContent('#main')).slice(0, 200)); assert.strictEqual((await p.$$('.sp-no')).length, 0); await p.click('[data-act="snext"]');
  // 2: blocked microphone, then nothing heard, then wrong, then right on the second try
  await say(null, 'not-allowed'); assert(/microphone is blocked/.test(await p.textContent('#main')), 'blocked message');
  await say(null, 'no-speech'); assert(/did not hear anything/.test(await p.textContent('#main')), 'no speech message');
  tg = await target(); await say(['你好你好你好你好你好']); assert(/Not quite/.test(await p.textContent('#main')), 'wrong'); assert((await p.$$('.sp-no')).length > 0, 'missed characters are marked');
  if (process.env.SPEAK_SHOTS) await p.screenshot({ path: process.env.SPEAK_SHOTS + '/speak-wrong.png' });
  await p.evaluate((h) => { window.__sr.heard = [h]; window.__sr.err = null; }, tg); await p.click('[data-act="smic"]');          // Try again starts listening at once
  await p.waitForFunction(() => !document.querySelector('.micbtn.on')); await p.waitForTimeout(100); assert(/Well said|Good/.test(await p.textContent('#main')), 'second try'); await p.click('[data-act="snext"]');
  // a recogniser that starts but never answers or ends: Stop still ends the turn
  await p.evaluate(() => { window.__sr.hang = true; });
  await p.click('.micbtn'); await p.waitForSelector('.micbtn.on'); await p.click('.micbtn.on'); await p.waitForFunction(() => !document.querySelector('.micbtn.on'), null, { timeout: 4000 });
  assert(/did not hear anything/.test(await p.textContent('#main')), 'Stop works even when the recogniser never ends'); await p.evaluate(() => { window.__sr.hang = false; });
  // shown inside another page that blocks the microphone: say so, then stop offering the drill
  const host = await t.ctx.newPage(); await host.setContent('<iframe id="f" allow="microphone" src="' + url + '" style="width:400px;height:800px"></iframe>');
  const fr = host.frames().find((f) => f !== host.mainFrame()); await fr.waitForSelector('#tabs button'); await fr.click('#tabs button[data-v="practice"]'); await fr.click('[data-act="speak-start"]');
  await fr.evaluate(() => { window.__sr.err = 'not-allowed'; window.__sr.heard = null; }); await fr.waitForSelector('.micbtn'); await fr.click('.micbtn'); await fr.waitForFunction(() => !document.querySelector('.micbtn.on'));
  assert(/shown inside another app/.test(await fr.textContent('#main')), 'embedded message'); await fr.click('[data-act="end"]');
  assert(!(await fr.$('[data-act="speak-start"]')), 'the tile goes away once the host has refused the microphone'); await host.close();
  // an answer arrives but the recogniser never reports that it ended: the turn still finishes by itself
  tg = await target(); await p.evaluate((h) => { window.__sr.noend = true; window.__sr.heard = [h]; window.__sr.err = null; }, tg);
  await p.click('.micbtn'); await p.waitForFunction(() => !document.querySelector('.micbtn.on'), null, { timeout: 6000 }); assert(/Well said|Good/.test(await p.textContent('#main')), 'answer used without an end event');
  await p.evaluate(() => { window.__sr.noend = false; }); await p.click('[data-act="snext"]');
  // 3: skip, then finish the rest
  await p.click('[data-act="snext"]');
  for (let i = 4; i < 8; i++) { tg = await target(); await say([tg]); await p.click('[data-act="snext"]'); }
  await p.waitForSelector('.bignum'); assert.strictEqual((await p.textContent('.bignum')).trim(), '6/8', 'first-try passes are scored (skipped and retried ones are not)');
  await p.click('[data-act="end"]');
  // the notice is only shown once
  await p.click('[data-act="speak-start"]'); await p.waitForSelector('.micbtn'); assert(!(await p.$('[data-act="sok"]')), 'notice not repeated');
  await p.click('[data-act="end"]');
  for (const [w, h] of [[320, 640], [400, 820], [1280, 800]]) {
    await p.setViewportSize({ width: w, height: h }); await p.click('[data-act="speak-start"]'); await p.waitForSelector('.micbtn');
    const m = await p.evaluate(() => { const r = document.querySelector('.micbtn').getBoundingClientRect(); return { sideways: document.documentElement.scrollWidth > innerWidth + 1, visible: r.top >= 0 && r.bottom <= innerHeight }; });
    assert(!m.sideways && m.visible, w + 'px: ' + JSON.stringify(m)); await p.click('[data-act="end"]');
  }
  assert(t.errs.length === 0, 'page errors: ' + t.errs.join('; '));
  console.log('speaking drill ok');
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
