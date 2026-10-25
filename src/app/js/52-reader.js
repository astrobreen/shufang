/* ===== reader ===== */
function phVisible(t) {
  var m = S.set.vis;
  if (m === 'all') return true;
  if (m === 'off') return false;
  if (knownSet.has(t.h)) return false;
  return !(t.lv > 0 && t.lv <= uLevel());
}
function tokenHTML(t, si, ti, L) {
  if (!t.h) return '<span class="p">' + esc(t.p) + '</span>';
  var txt = tokSc(t), show = phVisible(t), inner = '';
  for (var i = 0; i < t.h.length; i++) {
    var syl = t.py[i];
    inner += '<ruby class="t' + C.toneOf(syl) + '">' + esc(txt.charAt(i)) + (show ? '<rt>' + esc(C.phon(syl, S.set.phon)) + '</rt>' : '') + '</ruby>';
  }
  var cls = 'w' + (savedSet.has(t.h) ? ' sv' : '') + (S.set.hiNew && !knownSet.has(t.h) && t.lv > uLevel() ? ' nw' : '');
  if (rd && rd.gram >= 0 && L.grammar[rd.gram].keys.indexOf(t.h) >= 0) cls += ' gm';
  return '<span class="' + cls + '" data-si="' + si + '" data-ti="' + ti + '" data-h="' + esc(t.h) + '">' + inner + '</span>';
}
function sentenceHTML(s, si, L) {
  var spk = '';
  if (s.spk >= 0 && L.speakers[s.spk]) {
    var sp = L.speakers[s.spk];
    spk = '<div class="spk" lang="' + lang() + '">' + esc(tokSc(sp)) + '<i>' + esc(sp.g.replace(/\s*\(name\)/, '')) + '</i></div>';
  }
  var showTr = S.set.trans || rd.open[si];
  return '<div class="sent' + (s.spk >= 0 ? ' dlg sp' + (s.spk % 2) : '') + (rd.cur === si && rd.playing ? ' playing' : '') + (rd.peek[si] ? ' peek' : '') + '" id="s' + si + '" data-si="' + si + '">' + spk +
    '<p class="line" lang="' + lang() + '">' + s.t.map(function (t, ti) { return tokenHTML(t, si, ti, L); }).join('') + '</p>' +
    '<div class="sx"><button class="mini" data-act="plays" data-si="' + si + '" aria-label="Play this sentence">' + icon('play2', 'sm') + '</button><button class="mini' + (showTr ? ' on' : '') + '" data-act="trs" data-si="' + si + '" aria-label="Show translation" aria-pressed="' + !!showTr + '" lang="zh-Hans">译</button></div>' +
    '<p class="tr" ' + (showTr ? '' : 'hidden') + '>' + esc(s.en) + '</p></div>';
}
function quizOpts(L) { return L.quiz.map(function (q, qi) { return C.shuffle([q.a].concat(q.w), L.id + '-' + qi); }); }
/* Chinese text with pinyin, following the reader's pinyin setting (no tap targets) */
function zhRuby(ts) {
  return '<span class="zq" lang="' + lang() + '">' + ts.map(function (t) {
    if (!t.h) return esc(t.p);
    var txt = tokSc(t), show = phVisible(t), inner = '';
    for (var i = 0; i < t.h.length; i++) inner += '<ruby class="t' + C.toneOf(t.py[i]) + '">' + esc(txt.charAt(i)) + (show ? '<rt>' + esc(C.phon(t.py[i], S.set.phon)) + '</rt>' : '') + '</ruby>';
    return inner;
  }).join('') + '</span>';
}
/* questions are asked in Chinese; the 译 button (or the reader's translation switch) adds the English under each line */
function quizHTML(L) {
  var en = S.set.trans || rd.quizEn;
  return L.quiz.map(function (q, qi) {
    var ans = rd.quiz[qi], zh = !!q.zq;
    return '<div class="q"><div class="qt">' + (qi + 1) + '. ' + (zh ? zhRuby(q.zq) : esc(q.q)) + (zh && en ? '<small class="en">' + esc(q.q) + '</small>' : '') + '</div>' + rd.opts[qi].map(function (o) {
      var cls = ans == null ? '' : (o === q.a ? ' ok' : (o === ans ? ' no' : ''));
      return '<button class="opt' + cls + '" data-act="ans" data-q="' + qi + '" data-o="' + esc(o) + '"' + (ans != null ? ' disabled' : '') + '>' + (zh ? zhRuby(q.zo[o]) + (en ? '<small class="en">' + esc(o) + '</small>' : '') : esc(o)) + '</button>';
    }).join('') + '</div>';
  }).join('');
}
function renderReader(keepScroll) {
  var L = rd.L, y = window.scrollY, lit = L.type === 'poem' || L.type === 'classic';
  $('#main').hidden = true; $('#tabs').hidden = true; $('#reader').hidden = false; $('#audio').hidden = false;
  var visLabel = { all: 'always shown', smart: 'smart', off: 'hidden' }[S.set.vis];
  var answered = Object.keys(rd.quiz).length, correct = L.quiz.filter(function (q, qi) { return rd.quiz[qi] === q.a; }).length;
  $('#reader').style.setProperty('--fs', S.set.size);
  $('#reader').innerHTML =
    '<header class="rh"><div class="in"><button class="iconbtn" data-act="back" aria-label="Back to library">' + icon('back') + '</button>' +
    '<div class="tt l' + L.level + '"><div class="lv"><span class="dot"></span>HSK ' + L.level + ' · ' + TYPE_LABEL[L.type] + '</div><h1 lang="' + lang() + '">' + esc(titleZh(L)) + '</h1></div>' +
    '<button class="iconbtn tg' + (S.set.vis !== 'off' ? ' on' : '') + '" data-act="vis" aria-label="Pronunciation guide: ' + visLabel + '" lang="zh-Hans">拼</button>' +
    '<button class="iconbtn tg' + (S.set.trans ? ' on' : '') + '" data-act="transall" aria-label="Translations" aria-pressed="' + S.set.trans + '" lang="zh-Hans">译</button>' +
    '<button class="iconbtn" data-act="display" aria-label="Reading display">' + icon('aa') + '</button></div></header>' +
    '<div class="lesson' + (S.set.font === 'serif' ? ' serif' : '') + (lit ? ' poem' : '') + '">' +
    '<p class="lead">' + esc(L.titleEn) + ' · ' + esc(L.summary) + '</p>' +
    '<div class="mt8">' + L.sents.map(function (s, si) { return sentenceHTML(s, si, L); }).join('') + '</div>' +
    (L.grammar.length ? '<section class="section"><h2 class="h2 first">Grammar in this lesson</h2><p class="muted small" style="margin:-4px 0 10px">Tap a note to highlight it in the text.</p>' +
      L.grammar.map(function (g, gi) {
        return '<button class="gcard' + (rd.gram === gi ? ' on' : '') + '" data-act="gram" data-g="' + gi + '" aria-pressed="' + (rd.gram === gi) + '"><div class="gp" lang="' + lang() + '">' + esc(sc(g.pattern)) + '</div><div class="ge">' + esc(g.expl) + '</div><div class="gx" lang="' + lang() + '">' + esc(sc(g.ex)) + '</div><div class="gt">' + esc(g.exEn) + '</div></button>';
      }).join('') + '</section>' : '') +
    '<section class="section"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h2 class="h2 first" style="margin:0">Check your understanding</h2>' + (L.quiz[0] && L.quiz[0].zq ? '<button class="mini' + (S.set.trans || rd.quizEn ? ' on' : '') + '" data-act="qen" aria-label="Show English" aria-pressed="' + !!(S.set.trans || rd.quizEn) + '" lang="zh-Hans">译</button>' : '') + '</div>' + quizHTML(L) + '</section>' +
    '<section class="section center"><button class="btn pri block" data-act="finish">' + (answered === L.quiz.length ? 'Finish lesson · ' + correct + '/' + L.quiz.length + ' correct' : 'Finish lesson') + '</button>' +
    (answered < L.quiz.length ? '<p class="hint mt8">The quiz is optional.</p>' : '') + '</section>' +
    (L.source === 'Original' ? '' : '<p class="src">' + esc(L.source) + '</p>') + '</div>';
  $('#audio').innerHTML = audioBar();
  if (keepScroll) window.scrollTo(0, y);
}
function audioBar() {
  var n = rd.L.sents.length, all = rd.playing && !rd.once;   // the big button pauses only a whole-lesson play
  return '<div class="in"><button class="iconbtn' + (S.set.listen ? ' on' : '') + '" data-act="tog" data-k="listen" aria-label="Listening mode" aria-pressed="' + !!S.set.listen + '">' + icon('head') + '</button>' +
    '<button class="iconbtn" data-act="prev" aria-label="Previous sentence">' + icon('prev') + '</button>' +
    '<button class="playbtn" data-act="play" aria-label="' + (all ? 'Pause' : 'Play lesson') + '">' + icon(all ? 'pause' : 'play') + '</button>' +
    '<button class="iconbtn" data-act="next" aria-label="Next sentence">' + icon('next') + '</button>' +
    '<button class="rate num" data-act="rate" aria-label="Speaking speed">' + S.set.rate.toFixed(2).replace(/0$/, '') + '×</button>' +
    '<span class="pos num" aria-live="off">' + (rd.cur + 1) + '/' + n + '</span></div>';
}
function updateAudioBar() { if (rd) $('#audio').innerHTML = audioBar(); }

function openLesson(id) {
  var L = byId.get(id);
  scrollMemo[view] = window.scrollY;
  rd = { id: id, L: L, cur: 0, playing: false, open: {}, peek: {}, gram: -1, quiz: {}, opts: quizOpts(L) };
  S.last = { id: id }; save();
  render();
  window.scrollTo(0, 0);
}
function closeReader() {
  stopSpeech(); rd = null; closeSheet();
  render();
  var y = scrollMemo[view] || 0;
  setTimeout(function () { window.scrollTo(0, y); }, 0);
}
function markPlaying(si, scroll) {
  $$('.sent.playing').forEach(function (el) { el.classList.remove('playing'); });
  var el = si >= 0 ? $('#s' + si) : null;
  if (el) {
    el.classList.add('playing');
    if (scroll) el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}
/* Plays sentence `si`. With once=true it plays only that sentence; otherwise it carries on through the lesson. */
function speechText(s) { return s.t.map(function (t) { return t.h ? tokSc(t) : t.p; }).join(''); }
function clearSay() { $$('.w.say').forEach(function (x) { x.classList.remove('say'); }); }
function playFrom(si, once) {
  var L = rd.L;
  if (si < 0 || si >= L.sents.length) {   // ran off the end: stop and rewind to the start
    rd.playing = false; rd.once = false; rd.cur = 0; markPlaying(-1); updateAudioBar(); return;
  }
  var s = L.sents[si], offs = [], o = 0;
  s.t.forEach(function (t) { offs.push(o); o += (t.h ? tokSc(t) : t.p).length; });
  rd.cur = si; rd.playing = true; rd.once = !!once;
  var ok = speak(speechText(s), {
    pitch: s.spk > 0 ? 1.18 : 1,
    onstart: function () { markPlaying(si, !once); updateAudioBar(); },
    onboundary: function (e) {
      var ci = e.charIndex, ti = 0;
      for (var k = 0; k < offs.length; k++) if (offs[k] <= ci) ti = k;
      clearSay();
      var el = $('#s' + si + ' .w[data-ti="' + ti + '"]');
      if (el) el.classList.add('say');
    },
    onend: function () {
      clearSay();
      if (!rd || !rd.playing) return;
      if (rd.once) { rd.playing = false; rd.once = false; markPlaying(-1); updateAudioBar(); }
      else playFrom(si + 1);
    },
    onerror: function () { if (rd) { rd.playing = false; rd.once = false; markPlaying(-1); updateAudioBar(); } }
  });
  if (!ok) { rd.playing = false; rd.once = false; }
  markPlaying(ok ? si : -1, ok && !once); updateAudioBar();
}
function pausePlay() { stopSpeech(); if (rd) { rd.playing = false; rd.once = false; clearSay(); markPlaying(-1); updateAudioBar(); } }

/* Hover preview: pinyin + a short meaning for the word under the pointer (mouse devices only; touch taps open the full card). */
var tip = null;
function hideTip() { if (tip) tip.hidden = true; }
function showTip(el) {
  if (!rd || !$('#sheetwrap').hidden) return hideTip();
  var sent = el.closest('.sent');
  if (document.body.classList.contains('listen') && sent && !sent.classList.contains('peek')) return hideTip();
  var t = rd.L.sents[+el.dataset.si].t[+el.dataset.ti];
  if (!t || !t.h) return hideTip();
  var g = String(t.g || '').split(/[;；]/)[0].trim();
  if (g.length > 46) g = g.slice(0, 44).replace(/\s+\S*$/, '') + '…';
  if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  tip.innerHTML = '<b>' + esc(t.py.map(function (y) { return C.phon(y, S.set.phon); }).join(' ')) + '</b>' + (g ? '<span>' + esc(g) + '</span>' : '') + (t.lv > 0 && t.lv < 10 ? '<i>HSK ' + t.lv + '</i>' : '');
  tip.hidden = false;
  var r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  var x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  var y = r.top - h - 6 < 8 ? r.bottom + 6 : r.top - h - 6;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function onWord(el) {
  hideTip();
  var si = +el.dataset.si, ti = +el.dataset.ti, t = rd.L.sents[si].t[ti];
  $$('.w.sel').forEach(function (x) { x.classList.remove('sel'); });
  $$('.w[data-si="' + si + '"][data-ti="' + ti + '"]').forEach(function (x) { x.classList.add('sel'); });
  rd.cur = si; updateAudioBar();
  openSheet({ kind: 'word', h: t.h, ctx: { py: t.py, g: t.g, lid: rd.L.id, si: si, ti: ti } });
}

function newWordsOf(L) {
  var seen = new Set(), out = [];
  L.sents.forEach(function (s, si) {
    s.t.forEach(function (t) {
      if (!t.h || seen.has(t.h)) return;
      seen.add(t.h);
      if (t.lv > uLevel() && !knownSet.has(t.h) && !savedSet.has(t.h) && t.h.length > 1) out.push({ h: t.h, lid: L.id, si: si });
    });
  });
  return out;
}
function nextLesson(L) {
  var rest = LESSONS.slice().sort(lessonOrder).filter(function (x) { return x.id !== L.id && !doneMap.has(x.id); });
  var same = rest.find(function (x) { return x.level === L.level; });
  return same || rest.find(function (x) { return x.level > L.level; }) || rest[0] || null;
}
function finishLesson() {
  var L = rd.L, answered = Object.keys(rd.quiz).length, q = null;
  if (answered) q = Math.round(100 * L.quiz.filter(function (x, qi) { return rd.quiz[qi] === x.a; }).length / L.quiz.length);
  var d = doneMap.get(L.id), again = d && C.dayKey(d.at) === C.dayKey(now());   // re-finishing the same lesson today does not count twice
  if (!d) S.done.push({ id: L.id, at: now(), q: q });
  else { d.at = now(); if (q != null && (d.q == null || q > d.q)) d.q = q; }
  if (!again) { var r = todayRow(); r.chars += L.chars; r.lessons += 1; }
  save(); stopSpeech(); rd.playing = false; rd.once = false; updateAudioBar();
  openSheet({ kind: 'summary' });
}
function summarySheet() {
  var L = rd.L, d = doneMap.get(L.id), tr = todayRow(), goal = S.set.goal, pct = clamp(Math.round(tr.chars / goal * 100), 0, 100);
  var nw = newWordsOf(L), next = nextLesson(L);
  return '<div class="center" style="padding:10px 0 4px"><div class="hz-big kai" style="font-size:54px;line-height:1.1;color:var(--accent)" lang="zh-Hans">好</div><h2 style="font:750 24px var(--f-ui);letter-spacing:-.02em;margin-top:4px">Lesson finished</h2><p class="muted">' + esc(L.titleEn) + '</p></div>' +
    '<div class="stats3"><div class="stat"><b class="num">' + L.chars + '</b><span>characters</span></div><div class="stat"><b class="num">' + (d && d.q != null ? Math.round(d.q) + '%' : '–') + '</b><span>best quiz</span></div><div class="stat"><b class="num">' + C.streak(S.log, now()) + '</b><span>day streak</span></div></div>' +
    '<p class="small muted mt16" style="margin-bottom:6px">Today: ' + tr.chars + ' of ' + goal + ' characters</p><div class="bar"><i style="width:' + pct + '%"></i></div>' +
    (nw.length ? '<h3 class="h2" style="font-size:17px">New words worth saving</h3><p class="small muted" style="margin:-4px 0 10px;line-height:1.7" lang="' + lang() + '">' + nw.slice(0, 12).map(function (w) { return esc(sc(w.h)); }).join('  ·  ') + (nw.length > 12 ? '  …' : '') + '</p><button class="btn pri block" data-act="savenew">Add ' + plural(Math.min(nw.length, 25), 'word') + ' to review</button>' : '') +
    '<div class="actions">' + (next ? '<button class="btn" data-act="open" data-id="' + next.id + '">Next lesson</button>' : '<button class="btn" data-act="back">Library</button>') + '<button class="btn ghost" data-act="back">Back to library</button></div>';
}
