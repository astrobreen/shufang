/* Core logic: no DOM access. Used by the page and tested in Node. */
(function (root) {
  'use strict';

  // ---------- pinyin helpers ----------
  var TONES = {};
  var rows = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
  Object.keys(rows).forEach(function (b) {
    for (var i = 0; i < 4; i++) TONES[rows[b][i]] = [b, i + 1];
  });

  function parseSyl(s) {
    var base = '', tone = 5;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (TONES[ch]) { base += TONES[ch][0]; tone = TONES[ch][1]; } else base += ch;
    }
    return { b: base, t: tone };
  }

  var INIT = { b: 'ㄅ', p: 'ㄆ', m: 'ㄇ', f: 'ㄈ', d: 'ㄉ', t: 'ㄊ', n: 'ㄋ', l: 'ㄌ', g: 'ㄍ', k: 'ㄎ', h: 'ㄏ',
    j: 'ㄐ', q: 'ㄑ', x: 'ㄒ', zh: 'ㄓ', ch: 'ㄔ', sh: 'ㄕ', r: 'ㄖ', z: 'ㄗ', c: 'ㄘ', s: 'ㄙ' };
  var FIN = { '': '', a: 'ㄚ', o: 'ㄛ', e: 'ㄜ', ai: 'ㄞ', ei: 'ㄟ', ao: 'ㄠ', ou: 'ㄡ', an: 'ㄢ', en: 'ㄣ', ang: 'ㄤ',
    eng: 'ㄥ', er: 'ㄦ', i: 'ㄧ', ia: 'ㄧㄚ', ie: 'ㄧㄝ', iao: 'ㄧㄠ', iu: 'ㄧㄡ', iou: 'ㄧㄡ', ian: 'ㄧㄢ', in: 'ㄧㄣ',
    iang: 'ㄧㄤ', ing: 'ㄧㄥ', ong: 'ㄨㄥ', iong: 'ㄩㄥ', u: 'ㄨ', ua: 'ㄨㄚ', uo: 'ㄨㄛ', uai: 'ㄨㄞ', ui: 'ㄨㄟ',
    uei: 'ㄨㄟ', uan: 'ㄨㄢ', un: 'ㄨㄣ', uen: 'ㄨㄣ', uang: 'ㄨㄤ', ueng: 'ㄨㄥ', 'ü': 'ㄩ', 'üe': 'ㄩㄝ',
    'üan': 'ㄩㄢ', 'ün': 'ㄩㄣ' };
  var ZTONE = { 1: '', 2: 'ˊ', 3: 'ˇ', 4: 'ˋ', 5: '' };

  function zhuyin(syl) {
    var p = parseSyl(syl), b = p.b, ini = '', fin;
    if (b[0] === 'y') {
      var r = b.slice(1);
      if (r[0] === 'u') fin = 'ü' + r.slice(1);
      else if (r[0] === 'i') fin = r;
      else fin = 'i' + r;
    } else if (b[0] === 'w') {
      var r2 = b.slice(1);
      fin = r2[0] === 'u' ? r2 : 'u' + r2;
    } else {
      var two = b.slice(0, 2);
      if (two === 'zh' || two === 'ch' || two === 'sh') ini = two;
      else if (INIT[b[0]]) ini = b[0];
      fin = b.slice(ini.length);
      if ('jqx'.indexOf(ini) >= 0 && ini && fin[0] === 'u') fin = 'ü' + fin.slice(1);
      if (['zh', 'ch', 'sh', 'r', 'z', 'c', 's'].indexOf(ini) >= 0 && fin === 'i') fin = '';
    }
    if (!(fin in FIN) || (ini && !(ini in INIT))) return syl;
    var out = (ini ? INIT[ini] : '') + FIN[fin];
    return p.t === 5 ? '˙' + out : out + ZTONE[p.t];
  }

  function numSyl(syl) {
    var p = parseSyl(syl);
    return p.b + p.t;
  }

  /** text shown above one character for the chosen phonetic system */
  function phon(syl, mode) {
    if (mode === 'num') return numSyl(syl);
    if (mode === 'zhuyin') return zhuyin(syl);
    return syl;
  }

  function toneOf(syl) { return parseSyl(syl).t; }

  function norm(s) {
    var out = '';
    s = s.toLowerCase();
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (TONES[ch]) ch = TONES[ch][0];
      if (ch === 'ü') ch = 'v';
      if (/[a-z]/.test(ch)) out += ch;
    }
    return out;
  }


  // ---------- tone marks ----------
  /** put tone mark t (1-4; 5 = none) on a plain syllable such as "hao" or "nü" */
  function withTone(base, t) {
    base = base.replace(/v/g, 'ü');
    if (t === 5 || t === 0) return base;
    var vs = [], i;
    for (i = 0; i < base.length; i++) if ('aeiouü'.indexOf(base[i]) >= 0) vs.push(i);
    if (!vs.length) return base;
    var pick = -1, pri = 'aeo';
    for (var p = 0; p < 3 && pick < 0; p++) {
      for (i = 0; i < vs.length; i++) if (base[vs[i]] === pri[p]) { pick = vs[i]; break; }
    }
    if (pick < 0) pick = vs[vs.length - 1];
    var c = base[pick];
    return base.slice(0, pick) + rows[c][t - 1] + base.slice(pick + 1);
  }

  /** "nǐ hǎo" -> [3,3]; neutral tone = 5 */
  function tonesOf(py) {
    return py.split(' ').filter(Boolean).map(function (s) { return parseSyl(s).t; });
  }
  /** same pinyin with different tones, e.g. retone("nǐ hǎo", [2,3]) -> "ní hǎo" */
  function retone(py, tones) {
    return py.split(' ').filter(Boolean).map(function (s, i) { return withTone(parseSyl(s).b, tones[i] || 5); }).join(' ');
  }
  function plainPy(py) { return py.split(' ').filter(Boolean).map(function (s) { return parseSyl(s).b; }).join(''); }

  var CJK = /[㐀-䶿一-鿿豈-﫿]/;

  // ---------- spaced repetition (SM-2 style) ----------
  var MIN = 60000, DAY = 86400000;

  function srsApply(card, grade, now) {
    var c = Object.assign({ ease: 2.3, int: 0, reps: 0, lapses: 0 }, card);
    if (grade === 'again') {
      c.reps = 0; c.int = 0; c.lapses++;
      c.ease = Math.max(1.3, c.ease - 0.2);
      c.due = now + 10 * MIN;
    } else if (grade === 'hard') {
      c.int = Math.max(1, Math.round(Math.max(c.int, 1) * 1.2));
      c.ease = Math.max(1.3, c.ease - 0.15);
      c.reps++;
      c.due = now + c.int * DAY;
    } else {
      if (c.reps === 0) c.int = 1;
      else if (c.reps === 1) c.int = 3;
      else c.int = Math.round(c.int * c.ease);
      c.ease = c.ease + 0.05;
      c.reps++;
      c.due = now + c.int * DAY;
    }
    c.last = now;
    return c;
  }

  function fmtIv(ms) {
    if (ms < 60 * MIN) return Math.max(1, Math.round(ms / MIN)) + 'm';
    if (ms < DAY) return Math.round(ms / (60 * MIN)) + 'h';
    var d = Math.round(ms / DAY);
    if (d < 30) return d + 'd';
    if (d < 365) return Math.round(d / 30) + 'mo';
    return (d / 365).toFixed(1) + 'y';
  }

  function srsPreview(card, now) {
    var o = {};
    ['again', 'hard', 'good'].forEach(function (g) {
      o[g] = fmtIv(srsApply(card, g, now).due - now);
    });
    return o;
  }

  /** a card is "mature" once its interval passes 21 days */
  function cardState(c) {
    if (!c.reps) return c.lapses ? 'learning' : 'new';
    return c.int >= 21 ? 'mature' : 'learning';
  }

  // ---------- dates & streaks ----------
  function dayKey(ms) {
    var d = new Date(ms);
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }

  function streak(log, now) {
    var by = {};
    log.forEach(function (r) { by[r.d] = r; });
    var n = 0, t = new Date(now);
    t.setHours(12, 0, 0, 0);   // step from midday so daylight-saving changes cannot skip or repeat a date
    var active = function (k) { var r = by[k]; return r && (r.chars > 0 || r.lessons > 0 || r.cards > 0 || r.ex > 0); };
    if (!active(dayKey(t.getTime()))) t.setDate(t.getDate() - 1); // today not done yet: streak survives until midnight
    while (active(dayKey(t.getTime()))) { n++; t.setDate(t.getDate() - 1); }
    return n;
  }

  // ---------- deterministic shuffle for quiz choices ----------
  function seeded(seed) {
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5;
      var t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, seed) {
    var a = arr.slice(), r = seeded(seed);
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var api = { parseSyl: parseSyl, zhuyin: zhuyin, numSyl: numSyl, phon: phon, toneOf: toneOf, norm: norm,
    CJK: CJK, srsApply: srsApply, srsPreview: srsPreview, fmtIv: fmtIv,
    cardState: cardState, withTone: withTone, tonesOf: tonesOf, retone: retone, plainPy: plainPy, dayKey: dayKey, streak: streak, shuffle: shuffle, MIN: MIN, DAY: DAY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
