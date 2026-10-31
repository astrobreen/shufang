/* ===== Dictionary tab ===== */
/* CC-CEDICT (about 115,000 entries) in site/dict.json, fetched the first time the tab or an entry is opened and then cached.
   Search takes Chinese (simplified or traditional), pinyin (with or without tone numbers) or English in one box. */
var DI = { ready: false, loading: false, failed: false, list: [], by: new Map(), pk: null, nk: null, en: null, waiters: [] };
var dui = { q: '', n: 40 }, dTimer = null, dCache = null;
var CJKQ = /[㐀-䶿一-鿿豈-﫿]/;
var VARIANT = /^(variant of|old variant|archaic variant|unofficial variant|erhua variant|Japanese variant|also written|see |same as|abbr\. for|surname |used in |\(Tw\)|Taiwan pr\.)/i;

function loadDict(cb) {
  if (DI.ready) { if (cb) cb(true); return; }
  if (cb) DI.waiters.push(cb);
  if (DI.loading) return;
  DI.loading = true; DI.failed = false;
  fetch('dict.json').then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (j) {
    DI.list = j.e.map(function (a) {
      return { h: a[0], t: a[1], py: a[2], pys: a[2].split(' '), d: a[3], cl: a[4], pn: /^[A-Z]/.test(a[2]) };
    });
    DI.list.forEach(function (e) {
      var a = DI.by.get(e.h); if (a) a.push(e); else DI.by.set(e.h, [e]);
      if (e.t) { var b = DI.by.get(e.t); if (b) b.push(e); else DI.by.set(e.t, [e]); }
    });
    DI.ready = true; DI.loading = false;
    DI.waiters.splice(0).forEach(function (f) { f(true); });
  }).catch(function () {
    DI.loading = false; DI.failed = true;
    DI.waiters.splice(0).forEach(function (f) { f(false); });
  });
}

/* search keys, built the first time a Latin-letter search is made */
function dictKeys() {
  if (DI.pk) return;
  var list = DI.list, n = list.length, memo = new Map(), pk = new Array(n), nk = new Array(n), en = new Array(n);
  for (var i = 0; i < n; i++) {                                // the same ~1,300 syllables recur, so work them out once
    var e = list[i], a = '', b = '';
    for (var j = 0; j < e.pys.length; j++) {
      var low = e.pys[j].toLowerCase(), m = memo.get(low);
      if (!m) { var nm = C.norm(low); m = [nm, nm + C.toneOf(low)]; memo.set(low, m); }
      a += m[0]; b += m[1];
    }
    pk[i] = a; nk[i] = b; en[i] = e.d.join(' | ').toLowerCase();
  }
  DI.pk = pk; DI.nk = nk; DI.en = en;
}

function variantish(e) { return VARIANT.test(e.d[0] || ''); }
function readingRank(e) { return (variantish(e) ? 2 : 0) + (e.pn ? 1 : 0); }
function dictEnts(h) {
  var a = (DI.by.get(h) || []).filter(function (e) { return e.h === h; });
  if (!a.length) a = DI.by.get(h) || [];
  return a.map(function (e, i) { return { e: e, i: i }; }).sort(function (x, y) { return readingRank(x.e) - readingRank(y.e) || x.i - y.i; }).map(function (x) { return x.e; });
}
function dictBest(h) { var a = dictEnts(h); return a.length ? a[0] : null; }
function dictGloss(e) {
  var good = e.d.filter(function (d) { return !VARIANT.test(d); });
  return (good.length ? good : e.d).slice(0, 3).join('; ');
}
function dictHz(e) { return S.set.script === 'trad' && e.t ? e.t : e.h; }
function dictSyl(s) { return S.set.phon === 'pinyin' ? s : C.phon(s.toLowerCase(), S.set.phon); }
function dictPh(pys) { return pys.map(dictSyl).join(' '); }
function dictPhHTML(pys) {
  return pys.map(function (s) {
    var t = esc(dictSyl(s));
    return S.set.tone ? '<span class="t' + C.toneOf(s.toLowerCase()) + 'c">' + t + '</span>' : t;
  }).join(' ');
}
function dictBonus(h) {
  var v = V.map.get(h);
  if (v) return 14 - v.lv;                    // HSK 1 words first
  return dict.has(h) ? 4 : 0;                 // then words from the lessons
}

function dictSearch(q) {
  if (dCache && dCache.q === q) return dCache.r;
  var res = new Map(), note = '', list = DI.list, i, e, s;
  function bump(e, s) { var c = res.get(e.h); if (!c || s > c.s) res.set(e.h, { h: e.h, s: s }); }
  if (CJKQ.test(q)) {
    var qs = q.replace(/\s+/g, ''), exact = false;
    for (i = 0; i < list.length; i++) {
      e = list[i]; s = 0;
      if (e.h === qs || e.t === qs) { s = 100; exact = true; }
      else if (e.h.indexOf(qs) === 0 || (e.t && e.t.indexOf(qs) === 0)) s = 70 - (e.h.length - qs.length) * 2;
      else if (e.h.indexOf(qs) > 0 || (e.t && e.t.indexOf(qs) > 0)) s = 40 - (e.h.length - qs.length);
      if (s) bump(e, s);
    }
    if (!exact && qs.length >= 2) {      // no entry for the whole text: list the words inside it, in order
      var k = 0, pos = 0, found = 0;
      while (pos < qs.length) {
        var hit = '';
        for (var len = Math.min(8, qs.length - pos); len >= 1; len--) {
          var sub = qs.substr(pos, len);
          if (DI.by.has(sub) && CJKQ.test(sub)) { hit = sub; break; }
        }
        if (hit) {
          DI.by.get(hit).forEach(function (en) { bump(en, 200 - k); });
          found++; k++; pos += hit.length;
        } else pos++;
      }
      if (found) note = 'No entry for the whole text. These are the words inside it, in order.';
    }
  } else {
    var ql = q.toLowerCase().trim();
    dictKeys();
    if (/^[a-zA-Z\u00fc\u00dc\u0100-\u01dc:\d\s'’·-]+$/.test(q)) {   // pinyin, with tone numbers or tone marks
      var qn = C.norm(ql.replace(/u:/g, 'v')), marked = false, qnum = ql.replace(/u:|ü/g, 'v').replace(/[^a-z0-9\s']/g, function (ch) { return /[\u0100-\u01dc]/.test(ch) ? ch : ''; });
      var toks = qnum.split(/[\s'’·-]+/).filter(Boolean);
      qnum = toks.map(function (tk) {
        if (!/[\u0100-\u01dc]/.test(tk)) return tk.replace(/[^a-z0-9]/g, '');
        var n = C.norm(tk), tn = C.toneOf(tk);
        if (tn >= 1 && tn <= 5 && /^[a-z]+$/.test(n) && n.length <= 6) { marked = true; return n + tn; }
        return n;
      }).join('');
      var hasDig = marked || /[1-5]/.test(q);
      if (qn.length) {
        for (i = 0; i < list.length; i++) {
          s = 0;
          if (hasDig) { var nk = DI.nk[i]; if (nk === qnum) s = 90; else if (nk.indexOf(qnum) === 0) s = 60 - (nk.length - qnum.length) * 0.3; }
          else { var pk = DI.pk[i]; if (pk === qn) s = 80; else if (qn.length >= 2 && pk.indexOf(qn) === 0) s = 50 - (pk.length - qn.length) * 0.8; }
          if (s) bump(list[i], s);
        }
      }
    }
    if (ql.length >= 2) {                                   // English
      var re = new RegExp('(^|[^a-z])' + ql.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z])');
      for (i = 0; i < list.length; i++) {
        if (DI.en[i].indexOf(ql) < 0) continue;
        e = list[i]; var best = 0;
        for (var j = 0; j < e.d.length; j++) {
          var dl = e.d[j].toLowerCase(), st = dl.replace(/^to /, '').replace(/\s*\([^)]*\)\s*/g, ' ').trim(), sc2 = 0;
          if (dl === ql || st === ql || dl === 'to ' + ql) sc2 = 85;
          else if (st.indexOf(ql + ' ') === 0 || st.indexOf(ql + ',') === 0) sc2 = 62;
          else if (re.test(dl)) sc2 = 45;
          else if (ql.length >= 3) sc2 = 22;
          if (sc2 && j === 0) sc2 += 8;
          if (sc2 > best) best = sc2;
        }
        if (!best) continue;
        if (variantish(e)) best -= 25;
        bump(e, best - e.h.length * 0.6 - (e.h.length === 1 && !V.map.has(e.h) ? 4 : 0));   // a bound character (鹦, 鹉) ranks below the word (鹦鹉)
      }
    }
  }
  var groups = Array.from(res.values()).map(function (g) {
    var ents = dictEnts(g.h), main = ents[0];
    g.s += dictBonus(g.h) - (main && main.pn ? 10 : 0);
    g.ents = ents;
    return g;
  }).sort(function (a, b) { return b.s - a.s || a.h.length - b.h.length; });
  var r = { groups: groups.slice(0, 400), note: note };
  dCache = { q: q, r: r };
  return r;
}

function dictRow(g) {
  var m = g.ents[0], v = V.map.get(g.h), lv = v ? v.lv : (dict.has(g.h) ? dict.get(g.h).lv : 0);
  return '<button class="wrow" data-act="dictinfo" data-h="' + esc(g.h) + '"><span class="hz" lang="' + lang() + '">' + esc(dictHz(m)) + '</span>' +
    '<span class="wm"><span class="wp">' + esc(dictPh(m.pys)) + '</span><span class="wg">' + esc(dictGloss(m)) + '</span></span>' +
    '<span class="ws">' + (lv ? lvBadge(lv) : '') + (g.ents.length > 1 ? '<span class="tag">' + g.ents.length + ' readings</span>' : '') + '</span></button>';
}
function dictHome() {
  var out = '';
  if (S.hist.length) {
    var rows = S.hist.map(function (h) { var a = dictEnts(h); return a.length ? dictRow({ h: h, ents: a }) : ''; }).join('');
    if (rows) out += '<div class="rowhead"><h2 class="h2">Recent</h2><button class="btn ghost sm" data-act="dclearhist">Clear</button></div><div class="group">' + rows + '</div>';
  }
  out += '<div class="empty dhint"><h3>Search the dictionary</h3><p>Type Chinese, pinyin or English. Pinyin works with or without tone numbers.</p>' +
    '<div class="chiprow">' + [['你好', ''], ['shu', ''], ['library', ''], ['ni3hao3', '']].map(function (x) { return '<button class="chip" data-act="dtry" data-v="' + esc(x[0]) + '">' + esc(x[0]) + '</button>'; }).join('') + '</div>' +
    '<p class="small muted mt12">' + DI.list.length.toLocaleString() + ' entries from CC-CEDICT. Tap any word for every meaning, its characters and stroke order.</p></div>';
  return out;
}
function dictList() {
  if (!DI.ready) {
    if (DI.failed) return '<div class="empty"><h3>Could not load the dictionary</h3><p>It needs a connection the first time. After that it works offline.</p><button class="btn mt8" data-act="dretry">Retry</button></div>';
    return '<div class="empty"><h3>Loading the dictionary…</h3></div>';
  }
  var q = dui.q.trim();
  if (!q) return dictHome();
  var r = dictSearch(q);
  if (!r.groups.length) return '<div class="empty"><h3>No matches</h3><p>Try fewer letters, another spelling, or the characters themselves.</p></div>';
  var shown = r.groups.slice(0, dui.n);
  return (r.note ? '<p class="note">' + esc(r.note) + '</p>' : '') + '<div class="group">' + shown.map(dictRow).join('') + '</div>' +
    (r.groups.length > shown.length ? '<button class="btn block mt12" data-act="dmore">Show more (' + (r.groups.length - shown.length) + ')</button>' : '');
}
function refreshDictList() { var el = $('#dlist'); if (el) el.innerHTML = dictList(); }
function scheduleDictList() { clearTimeout(dTimer); dTimer = setTimeout(refreshDictList, 90); }

function inDict() { return view === 'words' && wui.tab === 'dict'; }
function dictBody() {
  var out = '<label class="search mt12">' + icon('search', 'sm') + '<input id="dq" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="汉字, pinyin or English" value="' + esc(dui.q) + '" aria-label="Search the dictionary"><button class="iconbtn sm' + (dui.hw ? ' on' : '') + '" data-act="hwtoggle" aria-label="Write a character" aria-pressed="' + !!dui.hw + '">' + icon('practice', 'sm') + '</button></label>' +
    (dui.hw ? hwBoxHTML() : '') + '<div id="dlist">' + dictList() + '</div>';
  var again = function () { if (inDict() && !rd && !ses && !sh) refreshDictList(); };
  if (dui.hw && !HWI.ready && !HWI.failed) loadHw(function () { if (inDict() && dui.hw && !rd && !ses) { if (HWS.length) hwRecognize(); else hwRefreshBox(); } });
  if (!DI.ready && !DI.loading && !DI.failed) loadDict(again);
  if (!V.ready && !V.loading && !V.failed) loadVocab(again);
  setTimeout(function () {                                   // a computer keyboard: ready to type; on a phone, do not pop the keyboard up
    var el = $('#dq');
    if (el && inDict() && !dui.q && !dui.hw && !sh && window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) el.focus();
  }, 0);
  return out;
}

/* ---------- entry sheet ---------- */
function openDictEntry(h) {
  openSheet({ kind: 'dict', h: h, ctx: {} });
  S.hist = [h].concat(S.hist.filter(function (x) { return x !== h; })).slice(0, 40); save();
  var again = function () { if (sh && sh.kind === 'dict' && sh.h === h) renderSheet(); };
  if (!DI.ready) loadDict(again);
  if (!V.ready) loadVocab(again);
}
function defHTML(d) {                                        // Chinese inside a meaning is tappable
  return esc(d).replace(/[㐀-䶿一-鿿豈-﫿]+/g, function (m) { return '<button class="xr" data-act="dictinfo" data-h="' + m + '" lang="' + lang() + '">' + m + '</button>'; });
}
function dictCompounds(h) {
  var out = [];
  DI.list.forEach(function (e) { if (e.h !== h && !e.pn && e.h.indexOf(h) >= 0 && e.h.length <= h.length + 3) out.push(e); });
  var seen = {};
  return out.map(function (e) { return { e: e, s: dictBonus(e.h) - e.h.length * 0.8 }; }).sort(function (a, b) { return b.s - a.s; })
    .filter(function (x) { if (seen[x.e.h]) return false; seen[x.e.h] = 1; return true; }).slice(0, 14).map(function (x) { return x.e; });
}
function dictSheet() {
  var h = sh.h;
  if (!DI.ready) {
    if (DI.failed) return sheetHead('') + '<div class="empty"><h3>Could not load the dictionary</h3><p>It needs a connection the first time.</p><button class="btn mt8" data-act="dretry">Retry</button></div>';
    return sheetHead('') + '<div class="empty"><h3>Loading…</h3></div>';
  }
  var ents = dictEnts(h);
  if (!ents.length) {
    var cs = h.split('').filter(function (c, i, a) { return CJKQ.test(c) && a.indexOf(c) === i; });
    return sheetHead('') + '<div class="empty"><h3>Not in the dictionary</h3><p>' + esc(h) + '</p>' + (cs.length > 1 ? '<p class="mt8">Look up its characters:</p><div class="chiprow">' +
      cs.map(function (c) { return '<button class="chip" data-act="dictinfo" data-h="' + esc(c) + '" lang="' + lang() + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '') + '</div>';
  }
  var m = ents[0], v = V.map.get(h), lv = v ? v.lv : (dict.get(h) ? dict.get(h).lv : 0);
  var saved = savedSet.has(h), known = knownSet.has(h), canSave = CJKRE.test(h);
  var tags = (CYMAP.has(h) ? lvTag(11) : lv ? lvTag(lv) : '') + (m.pn ? '<span class="tag">Name</span>' : '');
  var out = sheetHead('<span class="row gap4">' + tags + '</span>');
  out += '<div class="wd"><div class="big kai" lang="' + lang() + '">' + esc(dictHz(m)) + '</div></div>';
  out += '<div class="dents">' + ents.slice(0, 8).map(function (e, k) {
    return '<div class="dent"><div class="dph">' + dictPhHTML(e.pys) +
      (k === 0 ? '<button class="iconbtn sm" data-act="say" data-h="' + esc(h) + '" aria-label="Listen">' + icon('say', 'sm') + '</button>' : '') + '</div>' +
      (S.set.script === 'simp' && e.t && e.t !== e.h ? '<div class="alt">Traditional: <span class="zh">' + esc(e.t) + '</span></div>' : '') +
      '<ol class="dfl">' + e.d.map(function (d) { return '<li>' + defHTML(d) + '</li>'; }).join('') + '</ol>' +
      (e.cl ? '<div class="dcl"><span class="muted">Measure word:</span> <span class="zh" lang="' + lang() + '">' + esc(e.cl) + '</span></div>' : '') + '</div>';
  }).join('') + (ents.length > 8 ? '<p class="small muted">' + (ents.length - 8) + ' more entries not shown.</p>' : '') + '</div>';
  var ex = dict.get(h) ? exampleFor(h, {}) : null;
  if (ex) out += '<div class="ctxbox"><div class="zh" lang="' + lang() + '">' + hilite(ex.zh, h) + '</div><div class="en">' + esc(ex.en) + '</div></div>';
  var chars = h.split('').filter(function (c) { return CJKQ.test(c); });
  if (chars.length) {
    out += '<div class="chars">' + chars.map(function (c, k) {
      var p = m.pys.length === chars.length && h.length === chars.length ? dictPh([m.pys[k]]) : '';
      return '<button class="chr" data-act="char" data-c="' + esc(c) + '"><span class="cz" lang="' + lang() + '">' + esc(sc(c)) + '</span><span class="sp"><span class="cp">' + esc(p) + '</span></span><span class="cm">Strokes</span>' + icon('chev', 'sm') + '</button>';
    }).join('') + '</div>';
  }
  var comp = dictCompounds(h);
  if (comp.length) out += '<h3 class="h2" style="font-size:16px">Words with ' + esc(sc(h)) + '</h3><div class="chiprow">' + comp.map(function (e) {
    return '<button class="chip" data-act="dictinfo" data-h="' + esc(e.h) + '" lang="' + lang() + '">' + esc(dictHz(e)) + '</button>';
  }).join('') + '</div>';
  if (canSave) {
    sh.ctx = { lid: '', si: -1, dpy: m.pys.map(function (s) { return s.toLowerCase(); }).join(' '), dg: dictGloss(m).slice(0, 160) };
    out += '<div class="actions"><button class="btn ' + (saved ? '' : 'pri') + '" data-act="save" data-h="' + esc(h) + '">' + (saved ? 'Remove from review' : 'Add to review') + '</button>' +
      '<button class="btn" data-act="known" data-h="' + esc(h) + '">' + (known ? 'Not known yet' : 'I know this') + '</button></div>';
  }
  return out;
}
