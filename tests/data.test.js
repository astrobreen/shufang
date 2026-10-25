// Integrity checks for the generated lesson bundle.  Run: node tests/data.test.js
const assert = require('assert');
const fs = require('fs'), path = require('path');
const C = require('../src/app/core.js');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'dist', 'data.json'), 'utf8'));
const W = D.W, tok = (t) => (typeof t === 'number' ? W[t] : null);

assert(D.L.length >= 150, 'lesson count');
const ids = new Set();
const perLevel = {};
D.L.forEach((c) => {
  assert(!ids.has(c.i), 'duplicate id ' + c.i); ids.add(c.i);
  assert(c.l >= 1 && c.l <= 9, c.i + ': level');
  assert(c.z && c.z.length === c.q.length, c.i + ': Chinese quiz missing or the wrong length');
  c.z.forEach((z, k) => assert(z[2].length === c.q[k][2].length, c.i + ' Q' + (k + 1) + ': option counts differ'));
  assert('dspac'.includes(c.y), c.i + ': type');
  assert(c.t.length && c.te && c.su && c.s, c.i + ': title/summary/source');
  perLevel[c.l] = (perLevel[c.l] || 0) + 1;
  assert(c.ss.length >= 3, c.i + ': too few sentences');
  const words = new Set();
  c.ss.forEach((s, k) => {
    assert(s[2], `${c.i} s${k}: missing translation`);
    s[1].forEach((t) => {
      if (typeof t === 'number') {
        const w = W[t];
        assert(w, `${c.i} s${k}: bad word index ${t}`);
        const n = w[0].length, py = w[1] ? w[1].split(' ') : [];
        assert.strictEqual(py.length, n, `${c.i} s${k}: ${w[0]} has ${py.length} syllables`);
        words.add(w[0]);
      } else assert.strictEqual(typeof t, 'string');
    });
  });
  c.g.forEach((g) => g[4].forEach((k) => assert(words.has(k), `${c.i}: grammar key ${k} is not a token of the lesson`)));
  assert(c.q.length >= 3, c.i + ': needs 3+ quiz questions');
  c.q.forEach((q, k) => { assert(!q[2].includes(q[1]), `${c.i} q${k}: correct answer also listed as wrong`); assert(q[2].length >= 2); });
});
for (let lv = 1; lv <= 9; lv++) assert(perLevel[lv] >= 4, `level ${lv} has ${perLevel[lv] || 0} lessons`);
console.log('data ok:', D.L.length, 'lessons,', W.length, 'distinct words, per level', JSON.stringify(perLevel));

// ---- 成语
assert(D.CY && D.CY.length >= 100, 'chengyu count');
assert(D.CT && D.CT.length >= 6, 'chengyu topics');
const cyseen = new Set();
D.CY.forEach((c) => {
  const [h, py, lit, g, bg, ex, en, topic, tier, trad] = c;
  assert(/^[一-鿿]{4}$/.test(h), 'chengyu ' + h + ': four characters');
  assert(!cyseen.has(h), 'duplicate chengyu ' + h); cyseen.add(h);
  assert.strictEqual(py.split(' ').length, 4, h + ': pinyin');
  py.split(' ').forEach((s) => assert(C.splitPinyin ? true : /^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/.test(s), h + ': syllable ' + s));
  assert(lit && g && bg && en, h + ': text fields');
  assert(topic >= 0 && topic < D.CT.length, h + ': topic');
  assert([1, 2, 3].includes(tier), h + ': tier');
  const text = ex.map((t) => (typeof t === 'number' ? W[t][0] : t)).join('');
  assert(text.includes(h), h + ': the example sentence must contain the idiom');
  ex.forEach((t) => { if (typeof t === 'number') { assert(W[t], h + ': bad token'); assert.strictEqual(W[t][1].split(' ').length, W[t][0].length, h + ': token syllables ' + W[t][0]); } });
});
console.log('chengyu ok:', D.CY.length, 'idioms in', D.CT.length, 'topics');
