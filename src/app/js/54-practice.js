/* ===== Practice: hub, flashcards, writing, tones, listening, grammar index, pinyin chart ===== */
var pui = { page: 'hub' };
var gui = { q: '', lv: 0 };

var TONE_PATH = ['', 'M4 6H32', 'M4 21L32 6', 'M4 7L13 22L32 6', 'M4 5L32 23'];
function toneSvg(t) {
  if (t === 5) return '<svg viewBox="0 0 36 28" aria-hidden="true"><circle cx="18" cy="14" r="3" fill="var(--t5)"/></svg>';
  return '<svg viewBox="0 0 36 28" aria-hidden="true"><path d="' + TONE_PATH[t] + '" fill="none" stroke="var(--t' + t + ')" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function viewPractice() {
  if (pui.page === 'gram') return viewGrammar();
  if (pui.page === 'pinyin') return viewPinyin();
  var due = dueCards().length, wr = Object.keys(S.wr).length;
  var out = '<div class="title"><div class="sp"><h1>Practice</h1><p>Short sessions beat long ones.</p></div></div>';
  out += '<div class="tiles">' +
    '<button class="tilebtn" data-act="flash-start"><span class="ti">' + icon('cards') + '</span><b>Flashcards</b><span>' + (S.words.length ? (due ? due + ' due now' : 'Nothing due') : 'Save words to begin') + '</span>' + (due ? '<span class="cnt">' + due + '</span>' : '') + '</button>' +
    '<button class="tilebtn" data-act="write-start"><span class="ti">' + icon('brush') + '</span><b>Write</b><span>' + (wr ? plural(wr, 'character') + ' practised' : 'Stroke order, with feedback') + '</span></button>' +
    '<button class="tilebtn" data-act="tone-start"><span class="ti">' + icon('tone') + '</span><b>Tones</b><span>Pick the tone for each syllable</span></button>' +
    '<button class="tilebtn" data-act="listen-start"><span class="ti">' + icon('ear') + '</span><b>Listening</b><span>Hear a word, pick what you heard</span></button></div>';
  out += '<h2 class="h2">Reference</h2><div class="group">' +
    '<button class="wrow" data-act="ppage" data-v="gram"><span class="ti" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">' + icon('gram') + '</span><span class="wm"><span style="font-weight:650;display:block">Grammar index</span><span class="wg">Every pattern from the lessons, by level</span></span>' + icon('chev', 'sm') + '</button>' +
    '<button class="wrow" data-act="ppage" data-v="pinyin"><span class="ti" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">' + icon('grid') + '</span><span class="wm"><span style="font-weight:650;display:block">Pinyin chart</span><span class="wg">Tones, initials and finals, with audio</span></span>' + icon('chev', 'sm') + '</button></div>';
  return out;
}

/* ---------- session shell ---------- */
function sessHead(prog, label) {
  return '<div class="shead"><button class="iconbtn" data-act="end" aria-label="End session">' + icon('close') + '</button><div class="prog"><i style="width:' + Math.round(prog * 100) + '%"></i></div><span class="small muted num">' + label + '</span></div>';
}
function startSession(s) { stopSpeech(); ses = s; render(); window.scrollTo(0, 0); }
function endSession() {
  if (ses && ses.writer) ses.writer.destroy();
  if (ses && ses.anim) ses.anim.stop();
  stopSpeech(); ses = null; render();
}
function viewSession() {
  switch (ses.kind) {
    case 'flash': return flashView();
    case 'write': return writeView();
    case 'tone': return quizView();
    case 'listen': return quizView();
  }
  return '';
}
function afterSession() {
  if (!ses) return;
  if (ses.kind === 'write') mountWrite();
  if (ses.kind === 'listen' && ses.auto) { ses.auto = false; speakQ(); }
  if (ses.kind === 'tone' && ses.auto) { ses.auto = false; speakQ(); }
}
function resultView(title, big, sub, again) {
  return '<div class="center" style="padding:40px 0 10px"><div class="hz-big kai" style="font-size:54px;color:var(--accent)" lang="zh-Hans">好</div><h2 style="font:750 24px var(--f-ui);letter-spacing:-.02em;margin:6px 0 2px">' + title + '</h2>' +
    '<div class="bignum mt12">' + big + '</div><p class="muted mt8">' + sub + '</p></div><div class="actions"><button class="btn pri" data-act="' + again + '">Another round</button><button class="btn" data-act="end">Done</button></div>';
}

/* ---------- flashcards ---------- */
function flashStart() {
  if (!S.words.length) { toast('Save a few words first'); view = 'words'; wui.tab = 'hsk'; render(); return; }
  var q = dueCards().slice(0, 30).map(function (w) { return w.h; });
  if (!q.length) { toast('Nothing is due. ' + nextDueText()); return; }
  startSession({ kind: 'flash', q: q, total: q.length, i: 0, flip: false, again: 0, good: 0, tried: {} });
  flashAuto();
}
function flashAuto() { if (ses && ses.kind === 'flash' && S.set.dir === 'listen' && !ses.flip && hasVoice()) speak(sc(ses.q[0])); }
function flashView() {
  var s = ses;
  if (!s.q.length) {
    var r = '<div class="center" style="padding:44px 0 6px"><div class="hz-big kai" style="font-size:56px;color:var(--good)" lang="zh-Hans">完</div><h2 style="font:750 24px var(--f-ui);letter-spacing:-.02em;margin:6px 0">Session complete</h2>' +
      '<p class="muted">' + plural(s.total, 'card') + ' reviewed' + (s.again ? ', ' + s.again + ' to see again soon' : '') + '.</p><p class="small muted mt8">' + esc(nextDueText()) + '</p></div>';
    var more = dueCards().length;
    return r + '<div class="actions">' + (more ? '<button class="btn pri" data-act="flash-start">Review ' + more + ' more</button>' : '<button class="btn pri" data-act="learn" data-n="10">Add 10 new words</button>') + '<button class="btn" data-act="end">Done</button></div>';
  }
  var h = s.q[0], w = savedMap.get(h), i = cardInfo(w), dir = S.set.dir;
  var ex = CYMAP.has(h) ? cyExample(CYMAP.get(h)) : exampleFor(h, { lid: w.lid, si: w.si });
  var front, back;
  var sayBtn = '<button class="iconbtn" data-act="say" data-h="' + esc(h) + '" aria-label="Listen">' + icon('say') + '</button>';
  var hz = '<div class="fz" lang="' + lang() + '">' + esc(sc(h)) + '</div>', py = '<div class="fp">' + esc(phonJoin(i.py)) + '</div>', gl = '<div class="fg">' + esc(i.g) + '</div>';
  if (dir === 'en-zh') front = gl; else if (dir === 'listen') front = '<button class="btn pri" data-act="say" data-h="' + esc(h) + '" style="min-height:64px;min-width:64px;border-radius:32px">' + icon('say') + '</button><p class="hint">Listen, then recall the word</p>'; else front = hz;
  back = hz + py + gl + (ex ? '<div class="fx"><div class="zh" lang="' + lang() + '">' + hilite(ex.zh, h) + '</div><div class="en">' + esc(ex.en) + '</div></div>' : '');
  var out = sessHead(1 - s.q.length / Math.max(s.total, 1), (s.total - s.q.length) + '/' + s.total);
  out += '<div class="flash" data-act="flip" role="button" tabindex="0" aria-label="' + (s.flip ? 'Answer shown' : 'Show answer') + '">' + (s.flip ? back + sayBtn : front + '<p class="hint mt8">Tap to reveal</p>') + '</div>';
  if (s.flip) {
    var pv = C.srsPreview(w, now());
    out += '<div class="grades"><button class="g-again" data-act="grade" data-g="again">Again<small>' + pv.again + '</small></button><button class="g-hard" data-act="grade" data-g="hard">Hard<small>' + pv.hard + '</small></button><button class="g-good" data-act="grade" data-g="good">Good<small>' + pv.good + '</small></button></div>';
  } else {
    out += '<p class="hint center mt12">Say it aloud first. Honest grading makes the schedule work.</p>';
  }
  return out;
}
function flashGrade(g) {
  var s = ses, h = s.q[0], w = savedMap.get(h);
  if (!w) { s.q.shift(); render(); return; }
  var r = C.srsApply(w, g, now());
  Object.keys(r).forEach(function (k) { w[k] = r[k]; });
  todayRow().cards++;
  s.q.shift(); s.flip = false;
  if (g === 'again') { s.again++; if (!s.tried[h]) { s.tried[h] = 1; s.q.push(h); s.total++; } }
  save();
  render(); window.scrollTo(0, 0);
  flashAuto();
}

/* ---------- writing ---------- */
function writeCandidates() {
  var freq = new Map(), saved = new Set();
  dict.forEach(function (e) {
    if (e.lv > uLevel() + 1 && !savedSet.has(e.h)) return;
    for (var i = 0; i < e.h.length; i++) { var c = e.h[i]; if (C.CJK.test(c)) freq.set(c, (freq.get(c) || 0) + e.n); }
  });
  S.words.forEach(function (w) { for (var i = 0; i < w.h.length; i++) saved.add(w.h[i]); });
  var arr = Array.from(freq.keys()).filter(function (c) { return hzHas(c) && (S.wr[c] || 0) < 5; });
  arr.sort(function (a, b) {
    return (S.wr[a] || 0) - (S.wr[b] || 0) || (saved.has(b) ? 1 : 0) - (saved.has(a) ? 1 : 0) || freq.get(b) - freq.get(a);
  });
  return arr;
}
function writeStart(chars) {
  var go = function () {
    var cs = chars || writeCandidates().slice(0, 6);
    if (!cs.length) { toast(chars ? 'No stroke data for that character' : 'You have practised every character here'); return; }
    hzLoad(cs, function (ok) {
      if (!ok) { toast('Could not load stroke data.'); return; }
      cs = cs.filter(function (c) { return hzGet(c); });
      if (!cs.length) { toast('No stroke data for that character'); return; }
      closeSheet();
      startSession({ kind: 'write', chars: cs, i: 0, phase: 'watch', results: [], guide: S.set.guide });
    });
  };
  hzIndex(function (ok) { if (!ok) { toast('Could not load stroke data.'); return; } go(); });
}
function charMeaning(c) {
  var i = info(c), rs = readingsOf(c);
  return { py: rs.length ? rs.map(function (r) { return C.phon(r, S.set.phon); }).join(' · ') : '', g: i && i.g ? i.g : '' };
}
function writeView() {
  var s = ses, c = s.chars[s.i], m = charMeaning(c);
  if (s.i >= s.chars.length) {
    var good = s.results.filter(function (r) { return r.clean; }).length;
    return resultView('Nicely written', good + '/' + s.chars.length, 'characters written without a slip', 'write-start');
  }
  var out = sessHead(s.i / s.chars.length, (s.i + 1) + '/' + s.chars.length);
  out += '<div class="charstrip">' + s.chars.map(function (x, k) { return '<span class="' + (k === s.i ? 'cur' : k < s.i ? 'ok' : '') + '" lang="' + lang() + '">' + esc(sc(x)) + '</span>'; }).join('') + '</div>';
  out += '<div class="center mt8"><div class="ph" style="font-size:19px;color:var(--accent);font-weight:650">' + esc(m.py) + '</div><div class="muted">' + esc(m.g) + '</div></div>';
  out += '<div class="padwrap" id="padhost">' + (s.phase === 'watch' ? hzAnimHTML(c) : '') + '</div>';
  out += '<div class="strokenote" id="snote" aria-live="polite">' + (s.phase === 'watch' ? 'Watch the stroke order.' : s.phase === 'done' ? 'Well done.' : 'Draw stroke ' + 1 + ' of ' + hzGet(c).s.length + '.') + '</div>';
  if (s.phase === 'watch') out += '<div class="actions"><button class="btn" data-act="replay">' + icon('replay', 'sm') + ' Replay</button><button class="btn pri" data-act="wgo">Start writing</button></div>';
  else if (s.phase === 'write') out += '<div class="actions"><button class="btn" data-act="whint">' + icon('hint', 'sm') + ' Hint</button><button class="btn" data-act="wguide">' + (s.guide ? 'Hide guide' : 'Show guide') + '</button></div><button class="btn ghost block mt8" data-act="wskip">Skip this character</button>';
  else out += '<div class="actions"><button class="btn" data-act="say" data-h="' + esc(c) + '">' + icon('say', 'sm') + ' Listen</button><button class="btn pri" data-act="wnext">' + (s.i + 1 >= s.chars.length ? 'Finish' : 'Next character') + '</button></div>';
  return out;
}
function mountWrite() {
  var s = ses, c = s.chars[s.i];
  if (!c) return;
  if (s.writer) { s.writer.destroy(); s.writer = null; }
  if (s.anim) { s.anim.stop(); s.anim = null; }
  var host = $('#padhost');
  if (!host) return;
  if (s.phase === 'watch') {
    var svg = $('svg.anim', host);
    if (svg) s.anim = hzPlay(svg);
  } else if (s.phase === 'write') {
    host.innerHTML = '';
    var n = hzGet(c).s.length;
    s.writer = hzWriter(host, c, {
      guide: s.guide,
      onStroke: function (idx, ok, st) {
        var el = $('#snote');
        if (!el) return;
        if (ok) el.textContent = st.cur >= st.n ? 'Complete.' : 'Good. Stroke ' + (st.cur + 1) + ' of ' + st.n + '.';
        else el.textContent = st.order ? 'That stroke belongs later. Follow the stroke order.' : 'Not quite. Try again' + (st.curMiss >= 3 ? ' (hint shown).' : '.');
      },
      onDone: function (st) {
        var clean = st.miss <= Math.floor(st.n / 3) && st.hints === 0;
        s.results.push({ c: c, clean: clean });
        if (clean) S.wr[c] = Math.min(5, (S.wr[c] || 0) + 1);
        else if (!(c in S.wr)) S.wr[c] = 0;
        todayRow().ex++; save();
        setTimeout(function () { if (ses === s) { s.phase = 'done'; s.writer = null; render(); } }, 450);
      }
    });
  } else if (s.phase === 'done') {
    host.innerHTML = hzAnimHTML(c);
    var sv = $('svg.anim', host);
    if (sv) $$('.inkp', sv).forEach(function (p) { p.style.opacity = 1; });
  }
}

/* ---------- tones + listening ---------- */
function wordPool(filter) {
  var arr = [];
  dict.forEach(function (e) {
    if (e.lv === 0 || e.lv > uLevel() + 1 || e.h.length > 3 || e.py.length !== e.h.length) return;
    for (var i = 0; i < e.h.length; i++) if (!C.CJK.test(e.h[i])) return;
    if (filter && !filter(e)) return;
    arr.push(e);
  });
  return arr;
}
function toneStart() {
  var pool = wordPool(function (e) {
    if (/[不一]/.test(e.h)) return false;
    var t = e.py.map(C.toneOf);
    return t.every(function (x) { return x >= 1 && x <= 4; });
  });
  if (pool.length < 12) { pool = wordPool(function (e) { return e.py.map(C.toneOf).every(function (x) { return x >= 1 && x <= 4; }); }); }
  if (pool.length < 4) { toast('Not enough words yet at your level'); return; }
  var qs = C.shuffle(pool, 'tone' + now()).slice(0, 10).map(function (e) { return { h: e.h, py: e.py, g: e.gl[0] }; });
  startSession({ kind: 'tone', qs: qs, i: 0, picks: [], score: 0, done: false, auto: true });
}
function listenStart() {
  if (!hasVoice()) { toast('No Chinese voice found. Add one in your device’s text-to-speech settings.'); return; }
  var pool = wordPool(function (e) { return e.lv <= uLevel(); });
  if (pool.length < 12) pool = wordPool();
  var qs = C.shuffle(pool, 'lis' + now()).slice(0, 10).map(function (e) {
    var d = C.shuffle(pool.filter(function (x) { return x.h !== e.h && x.h.length === e.h.length; }), e.h + now()).slice(0, 3);
    var opts = C.shuffle([e].concat(d), e.h + 'o' + now()).map(function (x) { return { h: x.h, py: x.py, g: x.gl[0] }; });
    return { h: e.h, py: e.py, g: e.gl[0], opts: opts };
  });
  startSession({ kind: 'listen', qs: qs, i: 0, pick: -1, score: 0, done: false, auto: true });
}
function speakQ() { if (ses && ses.qs && ses.qs[ses.i]) speak(sc(ses.qs[ses.i].h)); }
function quizView() {
  var s = ses, q = s.qs[s.i];
  if (s.i >= s.qs.length) return resultView(s.kind === 'tone' ? 'Tone training' : 'Listening', s.score + '/' + s.qs.length, s.score >= 8 ? 'Excellent ear.' : s.score >= 5 ? 'Good. A little more practice will lock these in.' : 'Keep going. Tones take time and repetition.', s.kind === 'tone' ? 'tone-start' : 'listen-start');
  var out = sessHead(s.i / s.qs.length, (s.i + 1) + '/' + s.qs.length);
  if (s.kind === 'tone') {
    var n = q.py.length, k = s.picks.length, answered = s.done;
    var slots = q.py.map(function (p, j) {
      var base = C.parseSyl(p).b;
      if (answered) return '<span class="t' + C.toneOf(p) + 'c">' + esc(C.phon(p, S.set.phon)) + '</span>';
      if (j < k) return '<span class="t' + s.picks[j] + 'c">' + esc(C.phon(C.withTone(base, s.picks[j]), S.set.phon)) + '</span>';
      return '<span style="' + (j === k ? 'border-bottom:2px solid var(--accent)' : 'opacity:.5') + '">' + esc(base) + '</span>';
    }).join(' ');
    out += '<div class="qcard"><div class="qz" lang="' + lang() + '">' + esc(sc(q.h)) + '</div><div class="qp mt8" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">' + slots + '</div><p class="muted mt8">' + esc(q.g) + '</p>' +
      '<button class="btn sm mt8" data-act="qsay">' + icon('say', 'sm') + ' Listen</button></div>';
    if (!answered) {
      out += '<p class="hint center mt12">Tone of syllable ' + (k + 1) + ' of ' + n + '</p><div class="tonebtns">' + [1, 2, 3, 4].map(function (t) { return '<button data-act="tpick" data-t="' + t + '" aria-label="Tone ' + t + '">' + toneSvg(t) + '<span>' + t + '</span></button>'; }).join('') + '</div>';
    } else {
      var all = q.py.every(function (p, j) { return s.picks[j] === C.toneOf(p); });
      out += '<p class="center mt12" style="font-weight:650;color:var(--' + (all ? 'good' : 'bad') + ')">' + (all ? 'Correct' : 'You chose tone ' + s.picks.join(', ') + '. The answer is ' + q.py.map(function (p) { return C.toneOf(p); }).join(', ') + '.') + '</p><button class="btn pri block mt12" data-act="qnext">' + (s.i + 1 >= s.qs.length ? 'See result' : 'Next') + '</button>';
    }
  } else {
    var ans = s.pick >= 0;
    out += '<div class="qcard"><button class="btn pri" data-act="qsay" style="min-height:76px;min-width:76px;border-radius:38px">' + icon('say') + '</button><p class="hint mt8">' + (ans ? esc(q.g) : 'Which word did you hear?') + '</p></div><div class="choices">' +
      q.opts.map(function (o, j) {
        var cls = !ans ? '' : (o.h === q.h ? ' ok' : j === s.pick ? ' no' : '');
        return '<button class="choice' + cls + '" data-act="lpick" data-j="' + j + '"' + (ans ? ' disabled' : '') + '><span class="zh" style="font-size:22px" lang="' + lang() + '">' + esc(sc(o.h)) + '</span>' + (ans ? '<span class="small" style="color:inherit;opacity:.85">' + esc(phonJoin(o.py)) + '</span>' : '') + (ans && o.h === q.h ? '<span class="ck">✓</span>' : '') + '</button>';
      }).join('') + '</div>' + (ans ? '<button class="btn pri block mt12" data-act="qnext">' + (s.i + 1 >= s.qs.length ? 'See result' : 'Next') + '</button>' : '');
  }
  return out;
}
function tonePick(t) {
  var s = ses, q = s.qs[s.i];
  s.picks.push(t);
  if (s.picks.length >= q.py.length) {
    s.done = true;
    if (q.py.every(function (p, j) { return s.picks[j] === C.toneOf(p); })) s.score++;
    todayRow().ex++; save();
  }
  render();
}
function listenPick(j) {
  var s = ses, q = s.qs[s.i];
  s.pick = j;
  if (q.opts[j].h === q.h) s.score++;
  todayRow().ex++; save(); render();
}
function quizNext() {
  var s = ses; s.i++; s.picks = []; s.pick = -1; s.done = false; s.auto = true;
  render(); window.scrollTo(0, 0);
}

/* ---------- grammar index ---------- */
function grammarItems() {
  var q = gui.q.trim().toLowerCase(), out = [];
  LESSONS.slice().sort(lessonOrder).forEach(function (L) {
    if (gui.lv && L.level !== gui.lv) return;
    L.grammar.forEach(function (g, gi) {
      if (q && (g.pattern + ' ' + g.expl + ' ' + g.exEn).toLowerCase().indexOf(q) < 0 && g.pattern.indexOf(gui.q.trim()) < 0) return;
      out.push({ L: L, g: g, gi: gi });
    });
  });
  return out;
}
function grammarList() {
  var items = grammarItems();
  if (!items.length) return '<div class="empty"><h3>No matches</h3></div>';
  var out = '', cur = 0, buf = '';
  function flush() { if (buf) { out += '<div class="group">' + buf + '</div>'; buf = ''; } }
  items.forEach(function (x) {
    if (x.L.level !== cur) { flush(); cur = x.L.level; out += '<h2 class="h2 l' + cur + '"><span class="lvb">' + cur + '</span>HSK ' + cur + '</h2>'; }
    buf += '<button class="wrow" data-act="gramopen" data-lid="' + x.L.id + '" data-gi="' + x.gi + '"><span class="wm"><span style="font-weight:650;font-size:16px" lang="' + lang() + '">' + esc(sc(x.g.pattern)) + '</span><span class="wg">' + esc(x.g.expl) + '</span></span>' + icon('chev', 'sm') + '</button>';
  });
  flush();
  return out;
}
function viewGrammar() {
  var n = LESSONS.reduce(function (a, L) { return a + L.grammar.length; }, 0);
  var out = '<div class="title"><button class="iconbtn" data-act="ppage" data-v="hub" aria-label="Back">' + icon('back') + '</button><div class="sp"><h1>Grammar</h1><p>' + n + ' patterns from the lessons</p></div></div>';
  out += '<label class="search">' + icon('search', 'sm') + '<input id="gq" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Search patterns" value="' + esc(gui.q) + '"></label>';
  out += '<div class="hscroll mt12"><button class="chip' + (gui.lv === 0 ? ' on' : '') + '" data-act="glv" data-v="0">All</button>';
  for (var i = 1; i <= 9; i++) out += '<button class="chip lv l' + i + (gui.lv === i ? ' on' : '') + '" data-act="glv" data-v="' + i + '">HSK ' + i + '</button>';
  return out + '</div><div id="glist">' + grammarList() + '</div>';
}

/* ---------- pinyin chart ---------- */
var INITIALS = [['b', '八', 'bā'], ['p', '怕', 'pà'], ['m', '妈', 'mā'], ['f', '发', 'fā'], ['d', '大', 'dà'], ['t', '他', 'tā'], ['n', '那', 'nà'], ['l', '拉', 'lā'], ['g', '哥', 'gē'], ['k', '可', 'kě'], ['h', '喝', 'hē'], ['j', '鸡', 'jī'], ['q', '七', 'qī'], ['x', '西', 'xī'], ['zh', '知', 'zhī'], ['ch', '吃', 'chī'], ['sh', '是', 'shì'], ['r', '日', 'rì'], ['z', '字', 'zì'], ['c', '次', 'cì'], ['s', '四', 'sì'], ['y', '一', 'yī'], ['w', '我', 'wǒ']];
var FINALS = [['a', '啊', 'ā'], ['o', '哦', 'ó'], ['e', '鹅', 'é'], ['i', '衣', 'yī'], ['u', '五', 'wǔ'], ['ü', '鱼', 'yú'], ['ai', '爱', 'ài'], ['ei', '黑', 'hēi'], ['ao', '好', 'hǎo'], ['ou', '有', 'yǒu'], ['an', '安', 'ān'], ['en', '人', 'rén'], ['ang', '帮', 'bāng'], ['eng', '风', 'fēng'], ['ong', '中', 'zhōng'], ['ia', '家', 'jiā'], ['ie', '谢', 'xiè'], ['iao', '小', 'xiǎo'], ['iu', '六', 'liù'], ['ian', '天', 'tiān'], ['in', '心', 'xīn'], ['iang', '想', 'xiǎng'], ['ing', '星', 'xīng'], ['iong', '穷', 'qióng'], ['ua', '花', 'huā'], ['uo', '多', 'duō'], ['uai', '快', 'kuài'], ['ui', '水', 'shuǐ'], ['uan', '万', 'wàn'], ['un', '春', 'chūn'], ['uang', '黄', 'huáng'], ['üe', '月', 'yuè'], ['üan', '远', 'yuǎn'], ['ün', '云', 'yún'], ['er', '二', 'èr']];
function pcells(a) {
  return '<div class="pgrid2">' + a.map(function (x) { return '<button class="pcell2" data-act="say-text" data-t="' + x[1] + '" aria-label="' + x[0] + ', as in ' + x[2] + '"><b>' + x[0] + '</b><span lang="zh-Hans">' + x[1] + '</span><small>' + C.phon(x[2], S.set.phon) + '</small></button>'; }).join('') + '</div>';
}
function viewPinyin() {
  var T = [[1, 'mā', '妈', 'high and flat'], [2, 'má', '麻', 'rising'], [3, 'mǎ', '马', 'dip and rise'], [4, 'mà', '骂', 'sharp fall']];
  var out = '<div class="title"><button class="iconbtn" data-act="ppage" data-v="hub" aria-label="Back">' + icon('back') + '</button><div class="sp"><h1>Pinyin</h1><p>Tap any cell to hear it</p></div></div>';
  out += '<h2 class="h2 first">Four tones</h2><div class="tonerow">' + T.map(function (t) {
    return '<button class="tonecell" data-act="say-text" data-t="' + t[2] + '">' + toneSvg(t[0]) + '<b class="t' + t[0] + 'c">' + C.phon(t[1], S.set.phon) + '</b><span lang="zh-Hans">' + t[2] + '</span><small>' + t[3] + '</small></button>';
  }).join('') + '</div>';
  out += '<p class="small muted mt12" style="line-height:1.6">Some syllables are unstressed and have no mark, as in <span class="zh">吗</span> ma. Three changes to know: two third tones in a row (nǐ hǎo) are said 2 + 3; <span class="zh">不</span> becomes bú before a fourth tone; <span class="zh">一</span> becomes yí before a fourth tone and yì before the others.</p>';
  out += '<h2 class="h2">Initials</h2>' + pcells(INITIALS) + '<h2 class="h2">Finals</h2>' + pcells(FINALS);
  out += '<p class="small muted mt12">Cells show a common character that carries the sound. After j, q, x and y, “u” is really ü.</p>';
  return out;
}
