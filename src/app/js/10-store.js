/* ===== state and persistence ===== */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function now() { return Date.now(); }
function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
function num(v, d) { v = +v; return isFinite(v) ? v : d; }

var KEY = 'shufang.v2', OLDKEY = 'shufang.v1';
var DEF = { script: 'simp', phon: 'pinyin', vis: 'smart', trans: false, tone: true, hiNew: false, size: 1, font: 'sans', level: 0, goal: 150, rate: 1, voice: '', dir: 'zh-en', listen: false, guide: true };
var ENUM = { script: ['simp', 'trad'], phon: ['pinyin', 'num', 'zhuyin'], vis: ['all', 'smart', 'off'], font: ['sans', 'serif'], dir: ['zh-en', 'en-zh', 'listen'] };
var CJKRE = /^[㐀-䶿一-鿿豈-﫿]{1,12}$/;

function fresh() { return { v: 2, updatedAt: 0, set: Object.assign({}, DEF), words: [], known: [], done: [], log: [], marks: [], last: null, wr: {}, flags: [] }; }

function sanitize(o) {
  var f = fresh();
  if (!o || typeof o !== 'object') return f;
  f.updatedAt = num(o.updatedAt, 0);
  var s = o.set && typeof o.set === 'object' ? o.set : {};
  Object.keys(DEF).forEach(function (k) {
    var d = DEF[k], v = s[k];
    if (typeof d === 'boolean') { if (typeof v === 'boolean') f.set[k] = v; }
    else if (typeof d === 'number') { if (typeof v === 'number' && isFinite(v)) f.set[k] = v; }
    else if (typeof v === 'string') { if (!ENUM[k] || ENUM[k].indexOf(v) >= 0) f.set[k] = v.slice(0, 200); }
  });
  f.set.level = clamp(Math.round(f.set.level), 0, 9);
  f.set.size = clamp(f.set.size, 0.8, 1.6);
  f.set.rate = clamp(f.set.rate, 0.5, 1.5);
  f.set.goal = clamp(Math.round(f.set.goal), 10, 5000);
  var seen = {};
  (Array.isArray(o.words) ? o.words : []).slice(0, 3500).forEach(function (w) {
    if (!w || typeof w.h !== 'string' || !CJKRE.test(w.h) || seen[w.h]) return;
    seen[w.h] = 1;
    f.words.push({
      h: w.h, lid: byId.has(w.lid) ? w.lid : '', si: num(w.si, -1),
      add: num(w.add, 0), due: num(w.due, 0), ease: clamp(num(w.ease, 2.3), 1.3, 4), int: Math.max(0, num(w.int, 0)),
      reps: Math.max(0, num(w.reps, 0)), lapses: Math.max(0, num(w.lapses, 0)), last: num(w.last, 0)
    });
  });
  f.known = (Array.isArray(o.known) ? o.known : []).slice(0, 6000).filter(function (h, i, a) { return typeof h === 'string' && CJKRE.test(h) && a.indexOf(h) === i; });
  var ds = {};
  (Array.isArray(o.done) ? o.done : []).forEach(function (d) {
    if (d && byId.has(d.id) && !ds[d.id]) { ds[d.id] = 1; f.done.push({ id: d.id, at: num(d.at, 0), q: d.q == null ? null : clamp(num(d.q, 0), 0, 100) }); }
  });
  f.log = (Array.isArray(o.log) ? o.log : []).filter(function (r) { return r && /^\d{4}-\d\d-\d\d$/.test(r.d); })
    .map(function (r) { return { d: r.d, chars: Math.max(0, num(r.chars, 0)), lessons: Math.max(0, num(r.lessons, 0)), cards: Math.max(0, num(r.cards, 0)), ex: Math.max(0, num(r.ex, 0)) }; })
    .slice(-120);
  f.marks = (Array.isArray(o.marks) ? o.marks : []).filter(function (id, i, a) { return byId.has(id) && a.indexOf(id) === i; });
  f.last = o.last && byId.has(o.last.id) ? { id: o.last.id } : null;
  if (o.wr && typeof o.wr === 'object') {
    Object.keys(o.wr).slice(0, 4000).forEach(function (c) { if (CJKRE.test(c) && c.length === 1) f.wr[c] = clamp(Math.round(num(o.wr[c], 0)), 0, 5); });
  }
  f.flags = (Array.isArray(o.flags) ? o.flags : []).slice(-60).filter(function (x) { return x && byId.has(x.lid); })
    .map(function (x) { return { lid: x.lid, si: num(x.si, -1), at: num(x.at, 0), note: typeof x.note === 'string' ? x.note.slice(0, 160) : '' }; });
  return f;
}

/* union of two states: used when importing a backup */
function unionState(a, b) {
  var newer = b.updatedAt > a.updatedAt ? b : a;
  var out = fresh();
  out.updatedAt = Math.max(a.updatedAt, b.updatedAt);
  out.set = Object.assign({}, newer.set);
  var wm = new Map();
  [a, b].forEach(function (s) {
    s.words.forEach(function (w) {
      var o = wm.get(w.h);
      if (!o || (w.last || w.add) > (o.last || o.add)) wm.set(w.h, w);
    });
  });
  out.words = Array.from(wm.values());
  out.known = Array.from(new Set(a.known.concat(b.known)));
  var dm = new Map();
  [a, b].forEach(function (s) {
    s.done.forEach(function (d) {
      var o = dm.get(d.id);
      if (!o) dm.set(d.id, Object.assign({}, d));
      else { o.at = Math.max(o.at, d.at); if (d.q != null && (o.q == null || d.q > o.q)) o.q = d.q; }
    });
  });
  out.done = Array.from(dm.values());
  var lm = new Map();
  [a, b].forEach(function (s) {
    s.log.forEach(function (r) {
      var o = lm.get(r.d);
      if (!o) lm.set(r.d, Object.assign({}, r));
      else { ['chars', 'lessons', 'cards', 'ex'].forEach(function (k) { o[k] = Math.max(o[k] || 0, r[k] || 0); }); }
    });
  });
  out.log = Array.from(lm.values()).sort(function (x, y) { return x.d < y.d ? -1 : 1; }).slice(-120);
  out.marks = Array.from(new Set(a.marks.concat(b.marks)));
  out.last = newer.last || a.last || b.last;
  out.wr = Object.assign({}, a.wr);
  Object.keys(b.wr).forEach(function (c) { out.wr[c] = Math.max(out.wr[c] || 0, b.wr[c]); });
  var fk = {};
  out.flags = a.flags.concat(b.flags).filter(function (x) { var k = x.lid + ':' + x.si + ':' + x.at; if (fk[k]) return false; fk[k] = 1; return true; }).slice(-60);
  return out;
}
function hasData(s) { return s.words.length || s.done.length || s.known.length || s.log.length || s.marks.length || Object.keys(s.wr).length; }

var S = fresh();
try {
  var raw = localStorage.getItem(KEY) || localStorage.getItem(OLDKEY);
  if (raw) S = sanitize(JSON.parse(raw));
} catch (e) { /* storage unavailable */ }

var savedSet, knownSet, doneMap, savedMap;
function caches() {
  savedSet = new Set(S.words.map(function (w) { return w.h; }));
  savedMap = new Map(S.words.map(function (w) { return [w.h, w]; }));
  knownSet = new Set(S.known);
  doneMap = new Map(S.done.map(function (d) { return [d.id, d]; }));
}
caches();

function save(noStamp) {
  if (!noStamp) S.updatedAt = now();
  caches();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
}

/* ---------- derived ---------- */
function todayRow() {
  var k = C.dayKey(now()), r = S.log.find(function (x) { return x.d === k; });
  if (!r) { r = { d: k, chars: 0, lessons: 0, cards: 0, ex: 0 }; S.log.push(r); if (S.log.length > 120) S.log.shift(); }
  return r;
}
function uLevel() { return S.set.level; }
function sc(h) {
  if (S.set.script !== 'trad') return h;
  var v = V.map.get(h);
  if (v && v.t) return v.t;
  var e = dict.get(h);
  if (e && e.t) return e.t;
  return charTrad(h);
}
function tokSc(t) { return S.set.script === 'trad' ? (t.t || charTrad(t.h)) : t.h; }
function lang() { return S.set.script === 'trad' ? 'zh-Hant' : 'zh-Hans'; }
function phonJoin(py) { return py.map(function (s) { return C.phon(s, S.set.phon); }).join(' '); }
function titleZh(L) { return L.title.map(function (t) { return t.h ? tokSc(t) : t.p; }).join(''); }
function titlePy(L) { return L.title.filter(function (t) { return t.h; }).map(function (t) { return phonJoin(t.py); }).join(' '); }
function knownLv(h) { return knownSet.has(h) || (function () { var l = lvOf(h); return l > 0 && l <= uLevel(); })(); }
function coverageOf(L) {
  var tot = 0, ok = 0;
  L.sents.forEach(function (s) { s.t.forEach(function (t) { if (!t.h || t.lv === 0) return; tot++; if (knownSet.has(t.h) || t.lv <= uLevel()) ok++; }); });
  return tot ? ok / tot : 1;
}
function lessonOrder(a, b) { return a.level - b.level || LESSONS.indexOf(a) - LESSONS.indexOf(b); }
function dueCards() { var t = now(); return S.words.filter(function (w) { return w.due <= t; }).sort(function (a, b) { return a.due - b.due; }); }
/* reading / gloss for a saved card: prefer the sentence it was saved from */
function cardInfo(w) {
  var base = info(w.h) || { h: w.h, py: [], g: '', t: '', lv: 0, all: '' };
  var tok = w.lid && !CYMAP.has(w.h) ? tokenAt(w.lid, w.si, w.h) : null;     // idioms always show their own reading and meaning
  return { h: w.h, py: tok ? tok.py : base.py, g: tok ? tok.g : base.g, t: base.t, lv: base.lv, all: base.all };
}
function newCard(h, ctx) {
  var e = dict.get(h), ex = ctx && ctx.lid != null ? { lid: ctx.lid, si: ctx.si } : (e && e.ex);
  return { h: h, lid: ex ? ex.lid : '', si: ex ? ex.si : -1, add: now(), due: now(), ease: 2.3, int: 0, reps: 0, lapses: 0, last: 0 };
}
