/* ===== data: hydrate the compact bundle, build the dictionary ===== */
var C = window.Core, D = window.__D__;
var TYPEN = { d: 'dialogue', s: 'story', a: 'article', p: 'poem', c: 'classic' };
var TYPE_LABEL = { dialogue: 'Dialogue', story: 'Story', article: 'Article', poem: 'Poem', classic: 'Classic' };
var LEVELS = [null,
  { n: 'HSK 1', d: 'First steps: greetings, family, food and numbers.' },
  { n: 'HSK 2', d: 'Everyday plans and simple stories.' },
  { n: 'HSK 3', d: 'Daily life told in longer, connected sentences.' },
  { n: 'HSK 4', d: 'Conversation and short articles on familiar topics.' },
  { n: 'HSK 5', d: 'News-style prose, idioms and abstract ideas.' },
  { n: 'HSK 6', d: 'Fluent reading of essays, stories and debate.' },
  { n: 'HSK 7', d: 'Advanced prose: society, science, history.' },
  { n: 'HSK 8', d: 'Formal and literary registers; classical echoes.' },
  { n: 'HSK 9', d: 'Near-native range, including classical Chinese.' }
];
var W = D.W.map(function (a) { return { h: a[0], py: a[1] ? a[1].split(' ') : [], g: a[2], t: a[3] || '', lv: a[4] }; });
function tk(x) { return typeof x === 'number' ? W[x] : { p: x }; }
var LESSONS = D.L.map(function (c) {
  var L = {
    id: c.i, level: c.l, type: TYPEN[c.y], topic: c.c, minutes: c.m, source: c.s,
    title: c.t.map(tk), titleEn: c.te, summary: c.su, speakers: c.sp.map(tk),
    sents: c.ss.map(function (s) { return { spk: s[0], t: s[1].map(tk), en: s[2] }; }),
    grammar: c.g.map(function (g) { return { pattern: g[0], expl: g[1], ex: g[2], exEn: g[3], keys: g[4] }; }),
    quiz: c.q.map(function (q, qi) {
      var z = c.z && c.z[qi], o = { q: q[0], a: q[1], w: q[2], zq: null, zo: {} };   // q/a/w are English; zq/zo are the same question in Chinese (zo is keyed by the English option)
      if (z) { o.zq = z[0].map(tk); o.zo[q[1]] = z[1].map(tk); q[2].forEach(function (e, i) { o.zo[e] = z[2][i].map(tk); }); }
      return o;
    })
  };
  L.chars = 0;
  L.sents.forEach(function (s) { s.t.forEach(function (t) { if (t.h) L.chars += t.h.length; }); });
  return L;
});
var byId = new Map(LESSONS.map(function (l) { return [l.id, l]; }));
var TRADCH = D.T || {};

/* 成语 (four-character idioms): inlined, with their own example sentences */
var CT = D.CT || [];
var CY = (D.CY || []).map(function (a) {
  return { h: a[0], py: a[1].split(' '), lit: a[2], g: a[3], bg: a[4], ex: a[5].map(tk), en: a[6], topic: CT[a[7]], tier: a[8], t: a[9] || '' };
});
var CYMAP = new Map(CY.map(function (c) { return [c.h, c]; }));
var TIERS = [null, 'Everyday', 'Common', 'Literary'];
function charTrad(h) { var o = ''; for (var i = 0; i < h.length; i++) o += TRADCH[h[i]] || h[i]; return o; }

/* dictionary of every word that occurs in a lesson */
var dict = new Map();
function addTok(t, L, si) {
  if (!t.h) return;
  var e = dict.get(t.h), py = t.py.join(' ');
  if (!e) { e = { h: t.h, lv: t.lv, pys: {}, gl: [], n: 0, ex: null, exLv: 99, t: t.t }; dict.set(t.h, e); }
  e.n++; e.pys[py] = (e.pys[py] || 0) + 1;
  if (t.g && e.gl.indexOf(t.g) < 0) e.gl.push(t.g);
  if (!e.t && t.t) e.t = t.t;
  if (si >= 0 && L.level < e.exLv && L.type !== 'poem' && L.type !== 'classic') { e.ex = { lid: L.id, si: si }; e.exLv = L.level; }
  else if (si >= 0 && !e.ex) e.ex = { lid: L.id, si: si };
}
LESSONS.forEach(function (L) {
  L.title.forEach(function (t) { addTok(t, L, -1); });
  L.speakers.forEach(function (t) { addTok(t, L, -1); });
  L.sents.forEach(function (s, si) { s.t.forEach(function (t) { addTok(t, L, si); }); });
});
dict.forEach(function (e) {
  var best = 0;
  Object.keys(e.pys).forEach(function (k) { if (e.pys[k] > best) { best = e.pys[k]; e.py = k.split(' '); } });
  e.gl.sort(function (a, b) { return (a[0] === '(' ? 1 : 0) - (b[0] === '(' ? 1 : 0); });
  e.gl = e.gl.slice(0, 5);
  e.pyNorm = C.norm(e.py.join(''));
});
/* character -> words that contain it */
var cidx = new Map();
dict.forEach(function (e) {
  for (var i = 0; i < e.h.length; i++) {
    var c = e.h[i];
    if (!C.CJK.test(c)) continue;
    var a = cidx.get(c); if (!a) { a = []; cidx.set(c, a); }
    if (a.indexOf(e.h) < 0) a.push(e.h);
  }
});

/* full HSK 1-9 list: fetched on demand */
var V = { ready: false, loading: false, failed: false, list: [], map: new Map(), byLv: {}, waiters: [] };
function loadVocab(cb) {
  if (V.ready) { if (cb) cb(true); return; }
  if (cb) V.waiters.push(cb);
  if (V.loading) return;
  V.loading = true; V.failed = false;
  fetch('vocab.json').then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (j) {
    for (var lv = 1; lv <= 9; lv++) {
      var arr = j[lv] || [];
      V.byLv[lv] = arr.map(function (a) {
        var o = { h: a[0], py: a[1].split(' '), g: a[2], t: a[3] || '', lv: lv, pyNorm: C.norm(a[1]), gl: a[2].toLowerCase() };
        V.list.push(o); V.map.set(o.h, o); return o;
      });
    }
    V.ready = true; V.loading = false;
    V.waiters.splice(0).forEach(function (f) { f(true); });
  }).catch(function () {
    V.loading = false; V.failed = true;
    V.waiters.splice(0).forEach(function (f) { f(false); });
  });
}

/* unified lookup: { h, py[], g, t, lv, meanings } for any word we know */
function info(h) {
  var e = dict.get(h), v = V.map.get(h), cy = CYMAP.get(h);
  if (!e && !v && cy) return { h: h, py: cy.py, g: cy.g, t: cy.t, lv: 11, all: '', inLessons: false, e: null, cy: true };
  if (!e && !v) {
    var de = DI && DI.ready ? dictBest(h) : null;                 // any other word in the dictionary
    return de ? { h: h, py: de.pys.map(function (s) { return s.toLowerCase(); }), g: dictGloss(de), t: de.t, lv: 0, all: de.d.join('; '), inLessons: false, e: null, dict: true } : null;
  }
  var r = info0(h, e, v);
  if (cy) { r.py = cy.py; r.g = cy.g; r.cy = true; }
  return r;
}
function info0(h, e, v) {
  return {
    h: h, py: e ? e.py : v.py, g: e ? e.gl[0] : v.g, t: (v && v.t) || (e && e.t) || '',
    lv: v ? v.lv : (e ? e.lv : 0), all: v ? v.g : '', inLessons: !!e, e: e
  };
}
function lvOf(h) {
  var v = V.map.get(h);
  if (v) return v.lv;
  var e = dict.get(h);
  return e ? e.lv : 9;
}
function sentText(s) { return s.t.map(function (t) { return t.h || t.p; }).join(''); }
function tokenAt(lid, si, h) {
  var L = byId.get(lid);
  if (!L || !L.sents[si]) return null;
  var ts = L.sents[si].t;
  for (var i = 0; i < ts.length; i++) if (ts[i].h === h) return ts[i];
  return null;
}
