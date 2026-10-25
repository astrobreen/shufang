// UI test for the Dictionary tab (CC-CEDICT).  Run: node tests/dict.test.js
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', 'site');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

// the data file itself
const D = JSON.parse(fs.readFileSync(path.join(root, 'dict.json'), 'utf8'));
assert(D.e.length > 100000, 'dictionary has ' + D.e.length + ' entries');
const get = (h) => D.e.filter((e) => e[0] === h);
assert(get('你好').some((e) => e[2] === 'nǐ hǎo' && e[3].includes('Hello!')), '你好 entry');
assert(get('图书馆').some((e) => e[1] === '圖書館' && e[3][0] === 'library' && /家 jiā/.test(e[4])), '图书馆 entry with traditional form and measure words');
assert(get('女').some((e) => e[2] === 'nǚ'), 'ü is written with its tone mark');
assert(get('花儿').some((e) => /huā r$/.test(e[2])), 'erhua r');
assert(D.e.every((e) => e.length === 5 && Array.isArray(e[3]) && e[3].length > 0 && !/[a-z]\d\b/.test(e[2])), 'every entry is well formed and has no unconverted tone numbers');
assert(!D.e.some((e) => e[3].some((d) => /\[[a-z]+[1-5]\]/.test(d))), 'numbers inside meanings are converted');

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 400, height: 820 } }), p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url); await p.waitForSelector('#tabs button');
  assert.strictEqual((await p.$$('#tabs button')).length, 6, 'six tabs');
  await p.click('#tabs button[data-v="dict"]'); await p.waitForSelector('#dq'); await p.waitForSelector('.dhint');
  const rows = async () => p.$$eval('#dlist .wrow', (a) => a.map((x) => ({ hz: x.querySelector('.hz').textContent, py: x.querySelector('.wp').textContent, g: x.querySelector('.wg').textContent })));
  const search = async (q) => { await p.fill('#dq', q); await p.waitForTimeout(250); return rows(); };

  let r = await search('你好'); assert.strictEqual(r[0].hz, '你好'); assert(/Hello/.test(r[0].g) && r[0].py === 'nǐ hǎo', 'Chinese search: ' + JSON.stringify(r[0]));
  r = await search('shu'); assert(r.slice(0, 5).some((x) => x.hz === '书'), 'pinyin without tones finds 书 near the top: ' + r.slice(0, 5).map((x) => x.hz));
  r = await search('ni3hao3'); assert.strictEqual(r[0].hz, '你好', 'pinyin with tone numbers');
  r = await search('nǐ hǎo'); assert.strictEqual(r[0].hz, '你好', 'pinyin with tone marks');
  r = await search('library'); assert(r.slice(0, 5).some((x) => x.hz === '图书馆'), 'English search: ' + r.slice(0, 5).map((x) => x.hz));
  r = await search('圖書館'); assert.strictEqual(r[0].hz, '图书馆', 'traditional characters find the simplified word');
  r = await search('我爱学习中文'); assert.deepStrictEqual(r.slice(0, 4).map((x) => x.hz), ['我', '爱', '学习', '中文'], 'a sentence is split into its words');
  assert(/No entry for the whole text/.test(await p.textContent('#dlist .note')), 'says so');
  r = await search('zzzzqqq'); assert.strictEqual(r.length, 0); assert(await p.$('#dlist .empty'), 'no matches message');

  // an entry
  await search('图书馆'); await p.click('#dlist .wrow >> nth=0'); await p.waitForSelector('#sheet .dent');
  assert((await p.textContent('#sheet .dfl')).includes('library'), 'definition');
  assert(/Measure word/.test(await p.textContent('#sheet .dcl')), 'measure words');
  assert.strictEqual((await p.$$('#sheet .chr')).length, 3, 'one button per character');
  assert((await p.textContent('#sheet .dph')).replace(/\s/g, '') === 'túshūguǎn', 'pinyin');
  await p.click('#sheet [data-act="char"] >> nth=1'); await p.waitForSelector('#chanim svg', { timeout: 10000 });
  await p.click('#sheet [data-act="close"]');

  // save a word that is in no lesson, then check it shows up with its reading and meaning, also after a reload
  await search('parrot'); await p.click('#dlist .wrow >> nth=0'); await p.waitForSelector('#sheet .dent');
  const word = await p.textContent('#sheet .big'); assert(/鹦鹉|鸚鵡/.test(word), 'parrot is ' + word);
  await p.click('#sheet [data-act="save"]'); await p.click('#sheet [data-act="close"]');
  await p.reload(); await p.waitForSelector('#tabs button'); await p.click('#tabs button[data-v="words"]');
  const mine = await p.textContent('#wlist'); assert(/yīng wǔ/.test(mine) && /parrot/.test(mine), 'saved word keeps its reading and meaning: ' + mine.slice(0, 80));
  await p.click('#tabs button[data-v="dict"]'); await p.waitForSelector('#dlist .wrow');
  assert((await rows())[0].hz === '鹦鹉', 'recent lookups are listed');
  await p.click('[data-act="dclearhist"]'); assert(!(await p.$('#dlist .wrow')), 'history cleared');

  // from a lesson word to the full entry
  await p.click('#tabs button[data-v="words"]'); await p.click('[data-act="wtab"][data-v="hsk"]'); await p.waitForSelector('.wrow');
  await p.click('.wrow >> nth=0'); await p.waitForSelector('#sheet [data-act="dictinfo"]'); await p.click('#sheet [data-act="dictinfo"]');
  await p.waitForSelector('#sheet .dent'); assert((await p.$$('#sheet .dfl li')).length >= 1, 'full dictionary entry from the word card');
  assert.strictEqual(await p.evaluate(() => window.__androidBack()), true, 'back closes the entry');

  // layout: six tabs fit, nothing scrolls sideways, at phone and computer sizes
  for (const [w, h] of [[320, 640], [360, 740], [400, 820], [768, 1024], [1280, 800]]) {
    await p.setViewportSize({ width: w, height: h });
    await p.click('#tabs button[data-v="dict"]'); await p.fill('#dq', 'shu'); await p.waitForTimeout(250);
    const m = await p.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#tabs button').forEach((x) => { if (x.scrollWidth > x.clientWidth + 1) bad.push('tab ' + x.textContent.trim()); });
      const tb = document.querySelector('#tabs').getBoundingClientRect();
      return { bad, sideways: document.documentElement.scrollWidth > innerWidth + 1, tabsInside: tb.left >= -1 && tb.right <= innerWidth + 1 };
    });
    assert(m.bad.length === 0 && !m.sideways && m.tabsInside, w + 'px: ' + JSON.stringify(m));
  }
  assert(errs.length === 0, 'page errors: ' + errs.join('; '));
  console.log('dictionary ok (' + D.e.length + ' entries)');
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
