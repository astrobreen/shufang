/* ===== Words tab + sheets ===== */
function stateOf(w) { return w.due <= now() ? 'due' : C.cardState(w); }
function wordRowHTML(o, tag) {
  return '<button class="wrow" data-act="wordinfo" data-h="' + esc(o.h) + '"><span class="hz" lang="' + lang() + '">' + esc(sc(o.h)) + '</span>' +
    '<span class="wm"><span class="wp">' + esc(phonJoin(o.py || [])) + '</span><span class="wg">' + esc(o.g || '') + '</span></span>' +
    '<span class="ws">' + lvBadge(o.lv) + (tag || '') + '</span></button>';
}
function myWordsList() {
  var q = wui.q.trim().toLowerCase(), f = wui.f;
  var list = S.words.filter(function (w) {
    var st = stateOf(w);
    if (f === 'due' && st !== 'due') return false;
    if (f === 'new' && C.cardState(w) !== 'new') return false;
    if (f === 'learning' && C.cardState(w) !== 'learning') return false;
    if (f === 'mature' && C.cardState(w) !== 'mature') return false;
    if (q) { var i = cardInfo(w); if (w.h.indexOf(q) < 0 && C.norm(q) && C.norm(i.py.join('')).indexOf(C.norm(q)) < 0 && (i.g || '').toLowerCase().indexOf(q) < 0) return false; }
    return true;
  }).sort(function (a, b) { return a.due - b.due; });
  if (!list.length) return '<div class="empty"><h3>' + (S.words.length ? 'No matches' : 'No saved words yet') + '</h3><p>' + (S.words.length ? 'Try another filter.' : 'Tap any word while reading and choose Add to review. Or add a batch from the HSK list.') + '</p></div>';
  var shown = list.slice(0, wui.n);
  return '<div class="group">' + shown.map(function (w) {
    var i = cardInfo(w), st = stateOf(w);
    var tag = st === 'due' ? '<span class="tag warn">Due</span>' : st === 'new' ? '<span class="tag acc">New</span>' : '<span class="tag">' + C.fmtIv(w.due - now()) + '</span>';
    return wordRowHTML(i, tag);
  }).join('') + '</div>' + (list.length > shown.length ? '<button class="btn block mt12" data-act="more">Show more (' + (list.length - shown.length) + ')</button>' : '');
}
function matchWord(o, q) {
  var ql = q.toLowerCase(), qn = /^[a-zA-Z0-9üv:' ]+$/.test(q) ? C.norm(q) : '';
  if (o.h.indexOf(q) >= 0 || (o.t && o.t.indexOf(q) >= 0)) return 3;
  if (qn && o.pyNorm && o.pyNorm.indexOf(qn) === 0) return 2;
  if (qn && o.pyNorm && o.pyNorm.indexOf(qn) > 0 && qn.length > 2) return 1;
  if (ql.length > 1 && /[a-z]/.test(ql) && (o.gl || '').indexOf(ql) >= 0) return 1;
  return 0;
}
function searchWords(q) {
  var out = [];
  if (V.ready) V.list.forEach(function (v) { var s = matchWord(v, q); if (s) out.push({ o: v, s: s + (v.h === q ? 5 : 0) - v.h.length * 0.05 }); });
  dict.forEach(function (e) {
    if (V.map.has(e.h)) return;
    var s = matchWord({ h: e.h, t: e.t, pyNorm: e.pyNorm, gl: e.gl.join(' ').toLowerCase() }, q);
    if (s) out.push({ o: { h: e.h, py: e.py, g: e.gl[0], lv: e.lv }, s: s - e.h.length * 0.05 });
  });
  out.sort(function (a, b) { return b.s - a.s; });
  return out.slice(0, 80).map(function (x) { return x.o; });
}
function hskList() {
  if (!V.ready) {
    if (V.failed) return '<div class="empty"><h3>Could not load the word list</h3><p>Check your connection and try again.</p><button class="btn mt8" data-act="retryvocab">Retry</button></div>';
    return '<div class="empty"><h3>Loading…</h3></div>';
  }
  var q = wui.q.trim();
  if (q) {
    var r = searchWords(q);
    if (!r.length) return '<div class="empty"><h3>No matches</h3><p>Search by character, pinyin or English.</p></div>';
    return '<div class="group">' + r.map(function (o) { return wordRowHTML(o, savedSet.has(o.h) ? '<span class="tag good">Saved</span>' : ''); }).join('') + '</div>';
  }
  var arr = V.byLv[wui.lv] || [], shown = arr.slice(0, wui.n);
  var inList = arr.filter(function (w) { return savedSet.has(w.h) || knownSet.has(w.h); }).length;
  return '<p class="note">' + esc(LEVELS[wui.lv].d) + ' ' + arr.length.toLocaleString() + ' words' + (inList ? ', ' + inList + ' in your list' : '') + '.' + (wui.lv >= 7 ? ' HSK 7 to 9 is one official band; we split it by word frequency.' : '') + '</p>' +
    '<div class="group">' + shown.map(function (w) { return wordRowHTML(w, savedSet.has(w.h) ? '<span class="tag good">Saved</span>' : knownSet.has(w.h) ? '<span class="tag">Known</span>' : ''); }).join('') + '</div>' +
    (arr.length > shown.length ? '<button class="btn block mt12" data-act="more">Show more (' + (arr.length - shown.length) + ')</button>' : '') +
    '<div class="actions"><button class="btn" data-act="learn" data-n="10">Add 10 new</button><button class="btn" data-act="learn" data-n="25">Add 25 new</button></div>';
}
/* ---------- 成语 ---------- */
function cyMatch(c, q) {
  var ql = q.toLowerCase(), qn = /^[a-zA-Z0-9üv:' ]+$/.test(q) ? C.norm(q) : '';
  if (c.h.indexOf(q) >= 0 || (c.t && c.t.indexOf(q) >= 0)) return true;
  if (qn && C.norm(c.py.join('')).indexOf(qn) >= 0) return true;
  return ql.length > 1 && /[a-z]/.test(ql) && (c.g + ' ' + c.lit + ' ' + c.en).toLowerCase().indexOf(ql) >= 0;
}
function cyExample(cy) { return { zh: sc(cy.ex.map(function (t) { return t.h || t.p; }).join('')), en: cy.en, lid: '', title: '' }; }
function cyChips() {
  return '<button class="chip' + (wui.cf === 'all' && !wui.q ? ' on' : '') + '" data-act="cyf" data-v="all">All</button>' +
    CT.map(function (t) { return '<button class="chip' + (wui.cf === t && !wui.q ? ' on' : '') + '" data-act="cyf" data-v="' + esc(t) + '">' + esc(t) + '</button>'; }).join('');
}
function cyRow(c) {
  var tag = savedSet.has(c.h) ? '<span class="tag good">Saved</span>' : knownSet.has(c.h) ? '<span class="tag">Known</span>' : '<span class="tag tier' + c.tier + '">' + TIERS[c.tier] + '</span>';
  return '<button class="cyrow" data-act="wordinfo" data-h="' + esc(c.h) + '"><span class="top"><span class="cyh" lang="' + lang() + '">' + esc(sc(c.h)) + '</span>' + tag + '</span>' +
    '<span class="wp">' + esc(phonJoin(c.py)) + '</span><span class="wg">' + esc(c.g) + '</span></button>';
}
function cyList() {
  var q = wui.q.trim(), topic = wui.cf;
  var arr = CY.filter(function (c) { return (topic === 'all' || q || c.topic === topic) && (!q || cyMatch(c, q)); });
  if (!arr.length) return '<div class="empty"><h3>No matches</h3><p>Search by characters, pinyin or English.</p></div>';
  return '<p class="note">' + (q ? plural(arr.length, 'idiom') : topic === 'all' ? 'Four-character sayings, many with a story behind them. ' + arr.length + ' idioms.' : arr.length + ' idioms about ' + esc(topic.toLowerCase()) + '.') + '</p>' +
    '<div class="group">' + arr.map(cyRow).join('') + '</div>';
}
function viewWords() {
  var due = dueCards().length;
  var out = '<div class="title"><div class="sp"><h1>Words</h1><p>' + plural(S.words.length, 'saved word') + (due ? ' · ' + due + ' due' : '') + '</p></div></div>';
  out += '<div class="seg"><button data-act="wtab" data-v="mine" class="' + (wui.tab === 'mine' ? 'on' : '') + '">My words</button><button data-act="wtab" data-v="hsk" class="' + (wui.tab === 'hsk' ? 'on' : '') + '">HSK list</button><button data-act="wtab" data-v="cy" class="' + (wui.tab === 'cy' ? 'on' : '') + '"><span lang="zh-Hans">成语</span> Idioms</button></div>';
  out += '<label class="search mt12">' + icon('search', 'sm') + '<input id="wq" type="search" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + (wui.tab === 'mine' ? 'Search your words' : wui.tab === 'cy' ? 'Search idioms: 汉字, pinyin or English' : 'Search all words: 汉字, pinyin or English') + '" value="' + esc(wui.q) + '"></label>';
  if (wui.tab === 'mine') {
    var cnt = { new: 0, learning: 0, mature: 0 };
    S.words.forEach(function (w) { cnt[C.cardState(w)]++; });
    out += '<div class="stats3"><div class="stat"><b class="num">' + cnt.new + '</b><span>new</span></div><div class="stat"><b class="num">' + cnt.learning + '</b><span>learning</span></div><div class="stat"><b class="num">' + cnt.mature + '</b><span>mature</span></div></div>';
    out += '<div class="hscroll mt12">' + [['all', 'All'], ['due', 'Due'], ['new', 'New'], ['learning', 'Learning'], ['mature', 'Mature']].map(function (t) {
      return '<button class="chip' + (wui.f === t[0] ? ' on' : '') + '" data-act="wfilter" data-v="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';
    out += '<div id="wlist">' + myWordsList() + '</div>';
    if (S.words.length) out += '<button class="btn block mt16" data-act="flash-start"' + (due ? '' : ' disabled') + '>' + (due ? 'Review ' + due + ' due' : 'Nothing due') + '</button>';
  } else if (wui.tab === 'cy') {
    out += '<div class="hscroll mt12" id="cychips">' + cyChips() + '</div>';
    out += '<div id="wlist">' + cyList() + '</div>';
  } else {
    out += '<div class="hscroll mt12">';
    for (var i = 1; i <= 9; i++) out += '<button class="chip lv l' + i + (wui.lv === i && !wui.q ? ' on' : '') + '" data-act="wlv" data-v="' + i + '">HSK ' + i + '</button>';
    out += '</div><div id="wlist">' + hskList() + '</div>';
    if (!V.ready && !V.loading && !V.failed) loadVocab(function () { if (!rd && !ses && view === 'words') { var el = $('#wlist'); if (el) el.innerHTML = hskList(); } });
  }
  return out;
}

/* ---------- save / known ---------- */
function toggleSave(h, ctx) {
  if (savedSet.has(h)) { S.words = S.words.filter(function (w) { return w.h !== h; }); toast('Removed from review'); }
  else { S.words.push(newCard(h, ctx)); if (knownSet.has(h)) S.known = S.known.filter(function (x) { return x !== h; }); toast('Added to review'); }
  save();
}
function toggleKnown(h) {
  if (knownSet.has(h)) { S.known = S.known.filter(function (x) { return x !== h; }); toast('Marked as not known'); }
  else { S.known.push(h); S.words = S.words.filter(function (w) { return w.h !== h; }); toast('Marked as known'); }
  save();
}

/* ---------- sheets ---------- */
function exampleFor(h, ctx) {
  var lid = ctx && ctx.lid, si = ctx && ctx.si, cy = CYMAP.get(h);
  if (cy && (lid == null || lid === '' || si == null || si < 0) && !dict.get(h)) return cyExample(cy);
  if (lid == null || lid === '' || si == null || si < 0) { var e = dict.get(h); if (e && e.ex) { lid = e.ex.lid; si = e.ex.si; } else return null; }
  var L = byId.get(lid);
  if (!L || !L.sents[si]) return null;
  return { zh: sc(sentText(L.sents[si])), en: L.sents[si].en, lid: lid, title: L.titleEn };
}
function idiomSheet() {
  var h = sh.h, ctx = sh.ctx || {}, c = CYMAP.get(h), saved = savedSet.has(h), known = knownSet.has(h);
  var exz = c.ex.map(function (t) { return t.h || t.p; }).join('');
  var out = sheetHead('<span class="row gap4"><span class="lvb cy" lang="zh-Hans">成语</span><span class="tag tier' + c.tier + '">' + TIERS[c.tier] + '</span><span class="tag">' + esc(c.topic) + '</span></span>');
  out += '<div class="wd"><div class="big kai cybig" lang="' + lang() + '">' + esc(sc(h)) + '</div><div class="ph">' + esc(phonJoin(c.py)) +
    '<button class="iconbtn sm" data-act="say" data-h="' + esc(h) + '" aria-label="Listen">' + icon('say', 'sm') + '</button></div>' +
    '<div class="gl">' + esc(c.g) + '</div><div class="alt">Literally: ' + esc(c.lit) + '</div>' +
    (S.set.script === 'simp' && c.t && c.t !== h ? '<div class="alt mt8">Traditional: <span class="zh">' + esc(c.t) + '</span></div>' : '') + '</div>';
  out += '<div class="cybg"><div class="eyebrow">Background</div><p>' + esc(c.bg) + '</p></div>';
  out += '<div class="ctxbox"><div class="zh exz" lang="' + lang() + '">' + zhRuby(c.ex) + '</div><div class="en">' + esc(c.en) + '</div>' +
    '<button class="btn sm mt8" data-act="say-text" data-t="' + esc(exz) + '">' + icon('say', 'sm') + ' Hear the sentence</button></div>';
  out += '<div class="chars">' + h.split('').map(function (ch, k) {
    return '<button class="chr" data-act="char" data-c="' + esc(ch) + '"><span class="cz" lang="' + lang() + '">' + esc(sc(ch)) + '</span><span class="sp"><span class="cp">' + esc(phonJoin([c.py[k]])) + '</span></span><span class="cm">Strokes</span>' + icon('chev', 'sm') + '</button>';
  }).join('') + '</div>';
  out += '<div class="actions"><button class="btn ' + (saved ? '' : 'pri') + '" data-act="save" data-h="' + esc(h) + '">' + (saved ? 'Remove from review' : 'Add to review') + '</button>' +
    '<button class="btn" data-act="known" data-h="' + esc(h) + '">' + (known ? 'Not known yet' : 'I know this') + '</button></div>';
  if (ctx.lid != null && ctx.lid !== '' && ctx.si >= 0) out += '<button class="btn ghost block mt8" data-act="flag" data-lid="' + esc(ctx.lid) + '" data-si="' + ctx.si + '" data-h="' + esc(h) + '">' + icon('flag', 'sm') + ' Report a mistake in this sentence</button>';
  return out;
}
function wordSheet() {
  if (CYMAP.has(sh.h)) return idiomSheet();
  var h = sh.h, ctx = sh.ctx || {}, i = info(h) || { h: h, py: ctx.py || [], g: ctx.g || '', t: '', lv: 0, all: '' };
  var py = ctx.py && ctx.py.length ? ctx.py : i.py, g = ctx.g || i.g, ex = exampleFor(h, ctx);
  var saved = savedSet.has(h), known = knownSet.has(h);
  var chars = h.split('').filter(function (c) { return C.CJK.test(c); });
  var gs = (g || '').split(/;\s*/), alt = i.all ? i.all.split(/;\s*/).filter(function (x) { return gs.indexOf(x) < 0; }).join('; ') : '';
  var out = sheetHead('<span class="row gap4">' + lvTag(i.lv) + (i.lv === 0 ? '<span class="tag">Name</span>' : '') + '</span>');
  out += '<div class="wd"><div class="big kai" lang="' + lang() + '">' + esc(sc(h)) + '</div><div class="ph">' + esc(phonJoin(py)) +
    '<button class="iconbtn sm" data-act="say" data-h="' + esc(h) + '" aria-label="Listen">' + icon('say', 'sm') + '</button></div>' +
    '<div class="gl">' + esc(g) + '</div>' + (alt ? '<div class="alt">' + esc(alt) + '</div>' : '') +
    (S.set.script === 'simp' && i.t && i.t !== h ? '<div class="alt mt8">Traditional: <span class="zh">' + esc(i.t) + '</span></div>' : '') + '</div>';
  if (ex) out += '<div class="ctxbox"><div class="zh" lang="' + lang() + '">' + hilite(ex.zh, h) + '</div><div class="en">' + esc(ex.en) + '</div></div>';
  if (chars.length) {
    out += '<div class="chars">' + chars.map(function (c, k) {
      var p = py.length === chars.length && h.length === chars.length ? phonJoin([py[k]]) : '';
      return '<button class="chr" data-act="char" data-c="' + esc(c) + '"><span class="cz" lang="' + lang() + '">' + esc(sc(c)) + '</span><span class="sp"><span class="cp">' + esc(p) + '</span></span><span class="cm">Strokes</span>' + icon('chev', 'sm') + '</button>';
    }).join('') + '</div>';
  }
  out += '<div class="actions"><button class="btn ' + (saved ? '' : 'pri') + '" data-act="save" data-h="' + esc(h) + '">' + (saved ? 'Remove from review' : 'Add to review') + '</button>' +
    '<button class="btn" data-act="known" data-h="' + esc(h) + '">' + (known ? 'Not known yet' : 'I know this') + '</button></div>';
  if (ctx.lid != null && ctx.lid !== '' && ctx.si >= 0) out += '<button class="btn ghost block mt8" data-act="flag" data-lid="' + esc(ctx.lid) + '" data-si="' + ctx.si + '" data-h="' + esc(h) + '">' + icon('flag', 'sm') + ' Report a mistake in this sentence</button>';
  return out;
}
function readingsOf(c) {
  var set = {}, words = cidx.get(c) || [];
  words.forEach(function (w) {
    var e = dict.get(w), k = w.indexOf(c);
    if (e && e.py.length === w.length && k >= 0) set[e.py[k]] = (set[e.py[k]] || 0) + e.n;
  });
  var v = V.map.get(c);
  if (v && v.py.length === 1) set[v.py[0]] = (set[v.py[0]] || 0) + 1000;
  return Object.keys(set).sort(function (a, b) { return set[b] - set[a]; }).slice(0, 3);
}
function charSheet() {
  var c = sh.c, rs = readingsOf(c), i = info(c), words = (cidx.get(c) || []).filter(function (w) { return w !== c; }).sort(function (a, b) { return dict.get(b).n - dict.get(a).n; }).slice(0, 8);
  var out = sheetHead('<span class="muted small">Character</span>');
  out += '<div class="wd"><div class="big kai" lang="' + lang() + '">' + esc(sc(c)) + '</div><div class="ph">' + esc(rs.map(function (r) { return C.phon(r, S.set.phon); }).join(' · ')) +
    '<button class="iconbtn sm" data-act="say" data-h="' + esc(c) + '" aria-label="Listen">' + icon('say', 'sm') + '</button></div>' +
    (i && i.g ? '<div class="gl">' + esc(i.g) + '</div>' : '') + '</div>';
  out += '<div class="padwrap" style="margin-top:12px;width:min(100%,270px)"><div id="chanim" style="position:absolute;inset:0"></div></div>';
  out += '<div id="chinfo"></div><div class="actions"><button class="btn" data-act="replay">' + icon('replay', 'sm') + ' Replay</button><button class="btn pri" data-act="write-char" data-c="' + esc(c) + '">' + icon('brush', 'sm') + ' Write it</button></div>';
  if (words.length) out += '<h3 class="h2" style="font-size:16px">Words with ' + esc(sc(c)) + '</h3><div class="hscroll">' + words.map(function (w) { return '<button class="chip" data-act="wordinfo" data-h="' + esc(w) + '" lang="' + lang() + '">' + esc(sc(w)) + '</button>'; }).join('') + '</div>';
  return out;
}
function mountCharAnim() {
  var c = sh.c;
  hzLoad([c], function (ok) {
    if (!sh || sh.kind !== 'char' || sh.c !== c) return;
    var host = $('#chanim');
    if (!host) return;
    if (!ok || !hzGet(c)) { host.innerHTML = '<div class="empty" style="padding-top:90px"><p>No stroke data for this character.</p></div>'; var b = $('[data-act="write-char"]'); if (b) b.disabled = true; return; }
    host.innerHTML = hzAnimHTML(c);
    $('#chinfo').innerHTML = hzInfoHTML(c);
    if (sh.anim) sh.anim.stop();
    sh.anim = hzPlay($('svg.anim', host));
  });
}
function gramSheet() {
  var L = byId.get(sh.lid), g = L.grammar[sh.gi];
  return sheetHead(lvTag(L.level)) + '<div class="gcard on" style="cursor:default"><div class="gp" lang="' + lang() + '">' + esc(sc(g.pattern)) + '</div><div class="ge">' + esc(g.expl) + '</div><div class="gx" lang="' + lang() + '">' + esc(sc(g.ex)) + '</div><div class="gt">' + esc(g.exEn) + '</div></div>' +
    '<div class="actions"><button class="btn" data-act="say-text" data-t="' + esc(g.ex) + '">' + icon('say', 'sm') + ' Hear example</button><button class="btn pri" data-act="open" data-id="' + L.id + '" data-g="' + sh.gi + '">Read in context</button></div>' +
    '<p class="small muted mt12">From “' + esc(L.titleEn) + '”.</p>';
}

/* ---------- placement test ----------
   A real test, not a self-rating: multiple-choice "what does this word mean?" questions drawn from the HSK list.
   It searches for your level by bisection: 6 questions at a level, 4 or more right moves up, otherwise down.
   Guessing at random passes a round about 4% of the time, and "I don't know" counts as wrong. */
var PT = { per: 6, pass: 4 };
function ptUsable(w) {
  var g = (w.g || '').trim();
  return g && g.length <= 40 && g.charAt(0) !== '(' && !/^[A-Z]/.test(g) && !/^(surname|variant|abbr|see |used |classifier)/i.test(g) && w.h.length <= 4 && C.CJK.test(w.h);
}
function ptGloss(w) { return (w.g || '').split(/;\s*/)[0].replace(/\s*\([^)]*\)\s*$/, '').trim() || w.g; }
function ptWords(g) { return (g.toLowerCase().match(/[a-z]{4,}/g) || []); }
function ptQuestions(lv, seed) {
  var pool = (V.byLv[lv] || []).filter(ptUsable);
  var near = [];
  [lv - 1, lv, lv + 1].forEach(function (l) { if (V.byLv[l]) near = near.concat(V.byLv[l].filter(ptUsable)); });
  return C.shuffle(pool, seed).slice(0, PT.per).map(function (w, k) {
    var ans = ptGloss(w), bad = [], aw = ptWords(ans);
    C.shuffle(near, seed + ':d' + k).forEach(function (d) {
      if (bad.length >= 3 || d.h === w.h) return;
      var g = ptGloss(d);
      if (g.toLowerCase() === ans.toLowerCase() || bad.indexOf(g) >= 0) return;
      var dw = ptWords(g);
      if (dw.some(function (x) { return aw.indexOf(x) >= 0; })) return;   // avoid near-synonyms
      bad.push(g);
    });
    return { h: w.h, py: w.py, ans: ans, opts: C.shuffle([ans].concat(bad), seed + ':o' + k) };
  });
}
function startFinder() {
  loadVocab(function (ok) {
    if (!ok) { toast('Could not load the word list.'); return; }
    finder = { lo: 0, hi: 9, rounds: 0, asked: 0, right: 0, hist: [], res: null, intro: true };
    openSheet({ kind: 'finder' });
  });
}
function finderNext() {
  var f = finder;
  if (f.lo >= f.hi) { f.res = f.lo; return; }
  f.lv = Math.ceil((f.lo + f.hi) / 2); f.rounds++;
  f.qs = ptQuestions(f.lv, 'pt' + now() + ':' + f.rounds); f.i = 0; f.ok = 0;
  if (f.qs.length < PT.per) { f.res = f.lo; }   // not enough usable words (should not happen)
}
function finderAnswer(j) {
  var f = finder, q = f.qs[f.i];
  f.asked++;
  if (j >= 0 && q.opts[j] === q.ans) { f.ok++; f.right++; }
  f.i++;
  if (f.i >= f.qs.length) {
    var pass = f.ok >= PT.pass;
    f.hist.push({ lv: f.lv, ok: f.ok });
    if (pass) f.lo = f.lv; else f.hi = f.lv - 1;
    finderNext();
  }
}
function finderSheet() {
  var f = finder;
  if (f.intro) {
    return sheetHead('Placement test') + '<p class="muted" style="margin:0 0 6px;line-height:1.6">Choose the meaning of each word. The test climbs or drops a level depending on how you do and stops when it has found yours.</p>' +
      '<ul class="small muted" style="margin:8px 0 14px;padding-left:20px;line-height:1.7"><li>About 18 to 24 questions, 2 to 3 minutes.</li><li>If you do not know a word, tap “I don’t know”. A wrong guess costs the same, so do not guess.</li><li>No pinyin is shown, because this tests reading.</li></ul>' +
      '<button class="btn pri block" data-act="fstart">Start the test</button>';
  }
  if (f.res != null) {
    var rows = f.hist.slice().sort(function (a, b) { return a.lv - b.lv; }).map(function (h) { return '<div class="lvrow l' + h.lv + '"><span class="n"><span class="lvb l' + h.lv + '">' + h.lv + '</span>HSK ' + h.lv + '</span><div class="bar lvbar"><i style="width:' + Math.round(h.ok / PT.per * 100) + '%"></i></div><span class="small muted num" style="text-align:right">' + h.ok + '/' + PT.per + '</span></div>'; }).join('');
    return sheetHead('Your result') + '<div class="center" style="padding:10px 0 6px"><div class="bignum" style="color:var(--accent)">' + (f.res ? 'HSK ' + f.res : 'New') + '</div><p class="muted mt8">' + esc(f.res ? LEVELS[f.res].d : 'Start with HSK 1. Pinyin stays on for every word.') + '</p></div>' +
      '<div class="group mt12">' + rows + '</div><p class="small muted mt12">' + f.right + ' of ' + f.asked + ' answers correct. A short test is a rough guide, so you can change your level any time in Me.</p>' +
      '<button class="btn pri block mt12" data-act="fapply">Use ' + (f.res ? 'HSK ' + f.res : 'New') + '</button><button class="btn ghost block mt8" data-act="fstart">Take it again</button>';
  }
  var q = f.qs[f.i], total = PT.per * 4;   // 10 levels need at most 4 bisection rounds, so the bar only ever moves forward
  return '<div class="shead" style="padding-top:2px"><span class="small muted">Question ' + (f.asked + 1) + '</span><div class="prog"><i style="width:' + Math.round(f.asked / total * 100) + '%"></i></div><button class="iconbtn" data-act="close" aria-label="Stop the test">' + icon('close') + '</button></div>' +
    '<div class="qcard"><div class="qz" lang="' + lang() + '">' + esc(sc(q.h)) + '</div><p class="hint mt8">What does this word mean?</p></div>' +
    '<div class="choices">' + q.opts.map(function (o, j) { return '<button class="choice" data-act="fans" data-j="' + j + '">' + esc(o) + '</button>'; }).join('') + '</div>' +
    '<button class="btn ghost block mt8" data-act="fans" data-j="-1">I don’t know</button>';
}

function renderSheet() {
  var body = '';
  switch (sh.kind) {
    case 'word': body = wordSheet(); break;
    case 'char': body = charSheet(); break;
    case 'summary': body = rd ? summarySheet() : ''; break;
    case 'display': body = sheetHead('Reading display') + displayControls(); break;
    case 'gram': body = gramSheet(); break;
    case 'finder': body = finderSheet(); break;
    default: body = sheetHead('') ;
  }
  $('#sheet').innerHTML = '<div class="grab"></div>' + body;
  if (sh.kind === 'char') mountCharAnim();
}
