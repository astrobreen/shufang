// Word meanings shown in the lessons and the HSK list: guards the reviewed corrections in src/content/gloss_fix.tsv.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(root, 'build/dist/data.json'), 'utf8'));
const V = JSON.parse(fs.readFileSync(path.join(root, 'site/vocab.json'), 'utf8'));
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('FAIL', m); } };
const W = D.W;

// every token of a sentence as [word, pinyin, gloss]
function sent(lid, si) {
  const L = D.L.find(l => l.i === lid);
  return L.ss[si][1].filter(t => typeof t === 'number').map(t => W[t]);
}
function gloss(lid, si, word) {
  const t = sent(lid, si).find(w => w[0] === word);
  return t && t[2];
}
function find(word, pred) {
  for (const L of D.L) for (const s of L.ss) for (const t of s[1]) if (typeof t === 'number' && W[t][0] === word && pred(W[t][2])) return true;
  return false;
}

// words whose first dictionary sense is not the one the lessons use
const must = [['才', 'only then; not until'], ['太', 'too; excessively'], ['药', 'medicine'], ['后', 'after; behind; later'], ['云', 'cloud'], ['火星', 'Mars']];
for (const [w, g] of must) ok(find(w, x => x === g), `${w} should be glossed "${g}" somewhere in the lessons`);
const bad = [['才', /ability; talent/], ['太', /highest|greatest/], ['药', /iris/], ['后', /empress|queen/], ['火星', /spark/], ['里', /lining/], ['时', /timing/]];
for (const [w, re] of bad) ok(!W.some(e => e[0] === w && re.test(e[2])), `${w} still has a misleading gloss ${re}`);

// no gloss may end mid-word or with a dangling connector
for (const e of W) {
  ok(!/(\s(the|an)|[,;(])\s*$/.test(e[2]), `dangling gloss ${e[0]}: "${e[2]}"`);
  ok((e[2].match(/\(/g) || []).length === (e[2].match(/\)/g) || []).length, `unbalanced bracket ${e[0]}: "${e[2]}"`);
}

// HSK list: the leading reading and meaning are the common ones
const lv = {};
for (const k of Object.keys(V)) for (const r of V[k]) lv[r[0]] = r;
const list = { 才: ['cái', /only then|not until|just/], 药: ['yào', /medicine/], 比: ['bǐ', /compare|than/] };
for (const [w, [py, re]] of Object.entries(list)) {
  ok(lv[w] && lv[w][1] === py, `${w} should lead with ${py} in the HSK list`);
  ok(lv[w] && re.test(lv[w][2]), `${w} list gloss: ${lv[w] && lv[w][2]}`);
}
if (fails) { console.error(fails + ' gloss test(s) failed'); process.exit(1); }
console.log('gloss tests OK');
