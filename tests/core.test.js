// Unit tests for src/app/core.js (pure logic, no DOM).  Run: node tests/core.test.js
const assert = require('assert');
const fs = require('fs'), path = require('path');
const C = require('../src/app/core.js');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'dist', 'data.json'), 'utf8'));

// ---- zhuyin against known-good conversions
const Z = {
  'nǐ': 'ㄋㄧˇ', 'hǎo': 'ㄏㄠˇ', 'xué': 'ㄒㄩㄝˊ', 'shēng': 'ㄕㄥ', 'zhī': 'ㄓ', 'chī': 'ㄔ', 'shì': 'ㄕˋ',
  'rì': 'ㄖˋ', 'zì': 'ㄗˋ', 'cí': 'ㄘˊ', 'sì': 'ㄙˋ', 'yuè': 'ㄩㄝˋ', 'wǒ': 'ㄨㄛˇ', 'yǒu': 'ㄧㄡˇ',
  'liù': 'ㄌㄧㄡˋ', 'zuì': 'ㄗㄨㄟˋ', 'jūn': 'ㄐㄩㄣ', 'wèn': 'ㄨㄣˋ', 'jiǔ': 'ㄐㄧㄡˇ', 'huì': 'ㄏㄨㄟˋ',
  'kǒng': 'ㄎㄨㄥˇ', 'ér': 'ㄦˊ', 'nín': 'ㄋㄧㄣˊ', 'nǚ': 'ㄋㄩˇ', 'lǜ': 'ㄌㄩˋ', 'yī': 'ㄧ', 'yǔ': 'ㄩˇ',
  'yuán': 'ㄩㄢˊ', 'yún': 'ㄩㄣˊ', 'yīng': 'ㄧㄥ', 'yòng': 'ㄩㄥˋ', 'wáng': 'ㄨㄤˊ', 'wēng': 'ㄨㄥ',
  'wài': 'ㄨㄞˋ', 'wéi': 'ㄨㄟˊ', 'wǎn': 'ㄨㄢˇ', 'wū': 'ㄨ', 'yè': 'ㄧㄝˋ', 'yào': 'ㄧㄠˋ', 'yǎn': 'ㄧㄢˇ',
  'yīn': 'ㄧㄣ', 'yáng': 'ㄧㄤˊ', 'bō': 'ㄅㄛ', 'mǎ': 'ㄇㄚˇ', 'me': '˙ㄇㄜ', 'de': '˙ㄉㄜ', 'qù': 'ㄑㄩˋ',
  'xiǎng': 'ㄒㄧㄤˇ', 'qiū': 'ㄑㄧㄡ', 'duì': 'ㄉㄨㄟˋ', 'dūn': 'ㄉㄨㄣ', 'lüè': 'ㄌㄩㄝˋ', 'zhuāng': 'ㄓㄨㄤ',
  'shuǐ': 'ㄕㄨㄟˇ', 'xiàn': 'ㄒㄧㄢˋ', 'jué': 'ㄐㄩㄝˊ', 'quán': 'ㄑㄩㄢˊ', 'ài': 'ㄞˋ', 'ān': 'ㄢ',
  'ǎo': 'ㄠˇ', 'ōu': 'ㄡ', 'ěr': 'ㄦˇ', 'fēi': 'ㄈㄟ', 'dōng': 'ㄉㄨㄥ', 'liǎng': 'ㄌㄧㄤˇ', 'jiǒng': 'ㄐㄩㄥˇ',
};
Object.keys(Z).forEach(k => assert.strictEqual(C.zhuyin(k), Z[k], `zhuyin(${k}) = ${C.zhuyin(k)}, wanted ${Z[k]}`));

// every syllable used in the lesson bundle converts to pure bopomofo
const bopo = /^˙?[ㄅ-ㄯ]+[ˊˇˋ]?$/;
const sylls = new Set();
D.W.forEach(w => (w[1] ? w[1].split(' ') : []).forEach(s => sylls.add(s)));
sylls.forEach(s => assert(bopo.test(C.zhuyin(s)), `bad zhuyin for ${s}: ${C.zhuyin(s)}`));
console.log('zhuyin ok for', sylls.size, 'distinct syllables');

// numbered pinyin
assert.strictEqual(C.numSyl('nǐ'), 'ni3');
assert.strictEqual(C.numSyl('ma'), 'ma5');
assert.strictEqual(C.numSyl('lǜ'), 'lü4');
assert.strictEqual(C.toneOf('shì'), 4);

// tone helpers used by the tone drill
assert.strictEqual(C.withTone('hao', 3), 'hǎo');
assert.strictEqual(C.withTone('liu', 4), 'liù');
assert.strictEqual(C.withTone('lv', 4), 'lǜ');
assert.strictEqual(C.withTone('ma', 5), 'ma');
assert.deepStrictEqual(C.tonesOf('nǐ hǎo'), [3, 3]);
assert.strictEqual(C.retone('ni hao', [2, 3]), 'ní hǎo');
assert.strictEqual(C.plainPy('nǐ hǎo'), 'nihao');
assert.strictEqual(C.norm('Xué-shēng'), C.norm('xue2 sheng1'));

// ---- SRS
const now = 1_700_000_000_000;
let card = {};
let a = C.srsApply(card, 'good', now);
assert.strictEqual(a.int, 1); assert.strictEqual(a.reps, 1); assert.strictEqual(a.due, now + C.DAY);
a = C.srsApply(a, 'good', now); assert.strictEqual(a.int, 3);
a = C.srsApply(a, 'good', now); assert.strictEqual(a.int, Math.round(3 * 2.4));
const f = C.srsApply(a, 'again', now);
assert.strictEqual(f.reps, 0); assert.strictEqual(f.lapses, 1); assert.strictEqual(f.due, now + 10 * C.MIN);
assert(f.ease >= 1.3);
let low = {ease: 1.3};
for (let i = 0; i < 5; i++) low = C.srsApply(low, 'again', now);
assert.strictEqual(low.ease, 1.3);
assert.deepStrictEqual(C.srsPreview({}, now), { again: '10m', hard: '1d', good: '1d' });
assert.strictEqual(C.fmtIv(45 * C.DAY), '2mo');
assert.strictEqual(C.cardState({}), 'new');
assert.strictEqual(C.cardState({ reps: 3, int: 30 }), 'mature');
assert.strictEqual(C.cardState({ reps: 0, lapses: 2 }), 'learning');

// ---- streak
const base = new Date(2026, 9, 24, 10).getTime();
const log = [0, 1, 2].map(i => ({ d: C.dayKey(base - i * C.DAY), chars: 50, lessons: 0, cards: 0 }));
assert.strictEqual(C.streak(log, base), 3);
assert.strictEqual(C.streak(log.slice(1), base), 2, 'today empty keeps yesterday streak');
assert.strictEqual(C.streak([{ d: C.dayKey(base - 3 * C.DAY), chars: 5, lessons: 0, cards: 0 }], base), 0);
assert.strictEqual(C.dayKey(new Date(2026, 0, 5).getTime()), '2026-01-05');

// ---- quiz shuffle is stable and a permutation
const o = ['a', 'b', 'c', 'd'];
assert.deepStrictEqual(C.shuffle(o, 'n01-1'), C.shuffle(o, 'n01-1'));
assert.deepStrictEqual(C.shuffle(o, 'x').slice().sort(), o);

console.log('ALL CORE TESTS PASSED');
