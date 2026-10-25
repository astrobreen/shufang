/* ===== app shell: render, events, boot ===== */
var TABS = [['today', 'Today', 'today'], ['read', 'Read', 'read'], ['words', 'Words', 'words'], ['practice', 'Practice', 'practice'], ['me', 'Me', 'me']];
function renderTabs() {
  var due = dueCards().length;
  $('#tabs').innerHTML = '<div class="in">' + TABS.map(function (t) {
    return '<button data-act="tab" data-v="' + t[0] + '" class="' + (view === t[0] ? 'on' : '') + '"' + (view === t[0] ? ' aria-current="page"' : '') + '><span class="ic">' + icon(t[2]) +
      (t[0] === 'practice' && due ? '<span class="badge num">' + (due > 99 ? '99+' : due) + '</span>' : '') + '</span>' + t[1] + '</button>';
  }).join('') + '</div>';
}
var VIEWS = { today: viewToday, read: viewRead, words: viewWords, practice: viewPractice, me: viewMe };
function render() {
  document.body.classList.toggle('tc', !!S.set.tone);
  document.body.classList.toggle('listen', !!S.set.listen && !!rd);
  if (rd) { renderReader(true); return; }
  $('#reader').hidden = true; $('#audio').hidden = true;
  var main = $('#main');
  main.hidden = false; main.classList.toggle('session', !!ses);
  $('#tabs').hidden = !!ses;
  if (!ses) renderTabs();
  main.innerHTML = ses ? viewSession() : VIEWS[view]();
  afterSession();
}
function refresh() { render(); if (sh) renderSheet(); }
function rerenderIdle() {
  var a = document.activeElement;
  if (rd || ses || sh || (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName))) return;
  render();
}
function setSetting(k, v) { S.set[k] = v; save(); refresh(); }

function gotoTab(v) {
  if (rd) { stopSpeech(); rd = null; }
  if (sh) closeSheet();
  if (ses) { if (ses.writer) ses.writer.destroy(); if (ses.anim) ses.anim.stop(); stopSpeech(); ses = null; }
  scrollMemo[view] = window.scrollY;
  if (v !== view || v === 'practice') pui.page = 'hub';
  view = v; render();
  window.scrollTo(0, scrollMemo[view] || 0);
}
var RATES = [0.7, 0.85, 1, 1.15, 1.3];
function toggleIn(o, k) { o[k] = !o[k]; }

function act(a, el, ev) {
  var d = el.dataset;
  switch (a) {
    case 'tab': gotoTab(d.v); break;
    case 'lvl': hui.lv = +d.v; render(); break;
    case 'type': hui.type = hui.type === d.v ? 'all' : d.v; render(); break;
    case 'unread': hui.unread = !hui.unread; render(); break;
    case 'marked': hui.marked = !hui.marked; render(); break;
    case 'script': setSetting('script', S.set.script === 'simp' ? 'trad' : 'simp'); break;
    case 'bm': { var bi = S.marks.indexOf(d.id); if (bi >= 0) S.marks.splice(bi, 1); else S.marks.push(d.id); save(); render(); break; }
    case 'open': if (sh) closeSheet(); openLesson(d.id); if (d.g != null && d.g !== '') { rd.gram = +d.g; renderReader(true); var f = $('.w.gm'); if (f) f.scrollIntoView({ block: 'center' }); } break;
    case 'back': closeSheet(); if (rd) closeReader(); break;
    case 'vis': setSetting('vis', { all: 'smart', smart: 'off', off: 'all' }[S.set.vis]); toast('Pronunciation guide: ' + { all: 'always shown', smart: 'smart', off: 'hidden' }[S.set.vis]); break;
    case 'transall': setSetting('trans', !S.set.trans); break;
    case 'display': openSheet({ kind: 'display' }); break;
    case 'plays': if (rd.playing && rd.once && rd.cur === +d.si) pausePlay(); else playFrom(+d.si, true); break;
    case 'trs': {
      if (S.set.trans) { toast('Translations are always on. Turn them off with 译 at the top.'); break; }
      var si = +d.si; rd.open[si] = !rd.open[si];
      var se = $('#s' + si); $('.tr', se).hidden = !rd.open[si]; el.classList.toggle('on', !!rd.open[si]); el.setAttribute('aria-pressed', !!rd.open[si]);
      break;
    }
    case 'gram': rd.gram = rd.gram === +d.g ? -1 : +d.g; renderReader(true); if (rd.gram >= 0) { var g1 = $('.w.gm'); if (g1) g1.scrollIntoView({ block: 'center', behavior: 'smooth' }); } break;
    case 'qen': rd.quizEn = !rd.quizEn; renderReader(true); break;
    case 'ans': if (rd.quiz[+d.q] == null) { rd.quiz[+d.q] = d.o; todayRow().ex++; save(); renderReader(true); } break;
    case 'finish': finishLesson(); break;
    case 'savenew': {
      var nw = newWordsOf(rd.L).slice(0, 25);
      nw.forEach(function (w) { if (!savedSet.has(w.h)) S.words.push(newCard(w.h, { lid: w.lid, si: w.si })); });
      save(); toast('Added ' + plural(nw.length, 'word') + ' to review'); closeSheet(); renderReader(true); break;
    }
    case 'tog': setSetting(d.k, !S.set[d.k]); break;
    case 'prev': case 'next': {
      var n = rd.L.sents.length; rd.cur = clamp(rd.cur + (a === 'next' ? 1 : -1), 0, n - 1);
      if (rd.playing) playFrom(rd.cur, rd.once); else { markPlaying(rd.cur, true); updateAudioBar(); }
      break;
    }
    case 'play': if (rd.playing && !rd.once) pausePlay(); else playFrom(rd.cur, false); break;
    case 'rate': { var ri = RATES.indexOf(S.set.rate); S.set.rate = RATES[(ri + 1) % RATES.length]; save(); if (rd.playing) playFrom(rd.cur, rd.once); else updateAudioBar(); break; }
    case 'close': closeSheet(); break;
    case 'set': { var v = d.v; S.set[d.k] = v; save(); refresh(); break; }
    case 'learn': learnNew(+d.n); break;
    case 'flash-start': flashStart(); break;
    case 'tone-start': toneStart(); break;
    case 'listen-start': listenStart(); break;
    case 'write-start': writeStart(); break;
    case 'write-char': writeStart([d.c]); break;
    case 'wordinfo':
      openSheet({ kind: 'word', h: d.h, ctx: {} });
      if (!V.ready) loadVocab(function () { if (sh && sh.kind === 'word' && sh.h === d.h) renderSheet(); });
      break;
    case 'char':
      openSheet({ kind: 'char', c: d.c });
      if (!V.ready) loadVocab(function () { if (sh && sh.kind === 'char') { var ph = $('#sheet .ph'); if (ph) ph.firstChild.textContent = readingsOf(sh.c).map(function (r) { return C.phon(r, S.set.phon); }).join(' · '); } });
      break;
    case 'replay': {
      var host = ses && ses.kind === 'write' ? ses : sh, svg = ses && ses.kind === 'write' ? $('#padhost svg.anim') : $('#chanim svg.anim');
      if (host && svg) { if (host.anim) host.anim.stop(); host.anim = hzPlay(svg); }
      break;
    }
    case 'ppage': pui.page = d.v; render(); window.scrollTo(0, 0); break;
    case 'glv': gui.lv = +d.v; render(); break;
    case 'gramopen': openSheet({ kind: 'gram', lid: d.lid, gi: +d.gi }); break;
    case 'wtab': wui.tab = d.v; wui.q = ''; wui.n = 60; if (d.v === 'hsk' && !wui.lv) wui.lv = clamp(uLevel(), 1, 9); render(); break;
    case 'cyf': wui.cf = d.v; wui.q = ''; render(); break;
    case 'wfilter': wui.f = d.v; wui.n = 60; render(); break;
    case 'wlv': wui.lv = +d.v; wui.q = ''; wui.n = 60; render(); break;
    case 'more': wui.n += 60; { var wl = $('#wlist'); if (wl) wl.innerHTML = wui.tab === 'mine' ? myWordsList() : wui.tab === 'cy' ? cyList() : hskList(); } break;
    case 'retryvocab': V.failed = false; loadVocab(function () { render(); }); render(); break;
    case 'say': if (rd && rd.playing) pausePlay(); speak(sc(d.h)); break;
    case 'say-text': if (rd && rd.playing) pausePlay(); speak(d.t); break;
    case 'save': toggleSave(d.h, sh && sh.ctx); refresh(); break;
    case 'known': toggleKnown(d.h); refresh(); break;
    case 'flag':
      S.flags.push({ lid: d.lid, si: +d.si, at: now(), note: d.h }); S.flags = S.flags.slice(-60); save();
      toast('Noted. Find it under Me, Reported mistakes.'); break;
    case 'flip': ses.flip = !ses.flip; render(); break;
    case 'grade': flashGrade(d.g); break;
    case 'end': if (ses) endSession(); else closeSheet(); break;
    case 'wgo': ses.phase = 'write'; render(); break;
    case 'whint': if (ses.writer) ses.writer.hint(); break;
    case 'wguide': ses.guide = !ses.guide; S.set.guide = ses.guide; save(); if (ses.writer) ses.writer.guide(ses.guide); el.textContent = ses.guide ? 'Hide guide' : 'Show guide'; break;
    case 'wskip': case 'wnext': ses.i++; ses.phase = 'watch'; render(); window.scrollTo(0, 0); break;
    case 'tpick': tonePick(+d.t); break;
    case 'lpick': listenPick(+d.j); break;
    case 'qnext': quizNext(); break;
    case 'qsay': speakQ(); break;
    case 'mylevel': S.set.level = +d.v; save(); render(); break;
    case 'goal': S.set.goal = +d.v; save(); render(); break;
    case 'finder': startFinder(); break;
    case 'fstart': finder.intro = false; finder.lo = 0; finder.hi = 9; finder.rounds = 0; finder.asked = 0; finder.right = 0; finder.hist = []; finder.res = null; finderNext(); renderSheet(); $('#sheet').scrollTop = 0; break;
    case 'fans': finderAnswer(+d.j); renderSheet(); $('#sheet').scrollTop = 0; break;
    case 'fapply': S.set.level = finder.res; save(); closeSheet(); render(); toast(S.set.level ? 'Level set to HSK ' + S.set.level : 'Level set to New'); break;
    case 'export': exportData(); break;
    case 'copy': copyText(JSON.stringify(S), 'Backup copied. Paste it somewhere safe.', 'Copy was blocked. Try Save file.'); break;
    case 'import': $('#imp').click(); break;
    case 'reset':
      if (!resetArm) { resetArm = true; render(); setTimeout(function () { if (resetArm) { resetArm = false; if (view === 'me' && !rd && !ses) render(); } }, 4000); }
      else { resetArm = false; S = fresh(); S.updatedAt = now(); save(); toast('Progress erased'); render(); }
      break;
    case 'copyflags':
      copyText(S.flags.map(function (f) { var L = byId.get(f.lid); return (L ? L.id + ' ' + L.titleEn : f.lid) + ' / sentence ' + (f.si + 1) + ' / ' + f.note; }).join('\n'), 'List copied', 'Copy was blocked'); break;
    case 'clearflags': S.flags = []; save(); render(); break;
  }
}

document.addEventListener('click', function (e) {
  var t = e.target;
  if (t.id === 'sheetwrap') { closeSheet(); return; }
  var el = t.closest('[data-act]');
  if (el && !el.disabled) { e.preventDefault(); act(el.dataset.act, el, e); return; }
  if (rd) {
    var w = t.closest('.w');
    var sent = t.closest('.sent');
    if (document.body.classList.contains('listen') && sent && !sent.classList.contains('peek')) { sent.classList.add('peek'); rd.peek[sent.dataset.si] = 1; return; }
    if (w) { onWord(w); return; }
  }
});
if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.addEventListener('mouseover', function (e) { var w = rd && e.target.closest && e.target.closest('.w'); if (w) showTip(w); });
  document.addEventListener('mouseout', function (e) { if (e.target.closest && e.target.closest('.w')) hideTip(); });
  window.addEventListener('scroll', hideTip, { passive: true });
}
document.addEventListener('keydown', function (e) {
  var t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t.matches && t.matches('[data-act][tabindex]')) { e.preventDefault(); t.click(); return; }
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
  if (e.key === 'Escape') { if (sh) closeSheet(); else if (ses) endSession(); else if (rd) closeReader(); return; }
  if (ses && ses.kind === 'flash' && ses.q.length) {
    if (!ses.flip && (e.key === ' ' || e.key === 'Enter') && t.tagName !== 'BUTTON') { e.preventDefault(); ses.flip = true; render(); }
    else if (ses.flip && '123'.indexOf(e.key) >= 0 && e.key) flashGrade(['again', 'hard', 'good'][+e.key - 1]);
  }
});
/* Android back button (the app's WebView asks this first; false means "nothing to close, leave the app") */
window.__androidBack = function () {
  if (sh) { closeSheet(); return true; }
  if (ses) { endSession(); return true; }
  if (rd) { closeReader(); return true; }
  if (view !== 'today') { gotoTab('today'); return true; }
  return false;
};
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t.id === 'lq') { hui.q = t.value; var l = $('#llist'); if (l) l.innerHTML = lessonList(); }
  else if (t.id === 'wq') { wui.q = t.value; wui.n = 60; var wl = $('#wlist'); if (wl) wl.innerHTML = wui.tab === 'mine' ? myWordsList() : wui.tab === 'cy' ? cyList() : hskList(); var cc = $('#cychips'); if (cc) cc.innerHTML = cyChips(); }
  else if (t.id === 'gq') { gui.q = t.value; var gl = $('#glist'); if (gl) gl.innerHTML = grammarList(); }
  else if (t.dataset && t.dataset.range) {
    S.set[t.dataset.range] = +t.value;
    if (t.dataset.range === 'size' && rd) $('#reader').style.setProperty('--fs', S.set.size);
  }
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.dataset && t.dataset.range) { S.set[t.dataset.range] = +t.value; save(); }
  else if (t.dataset && t.dataset.sel === 'voice') { S.set.voice = t.value; save(); }
  else if (t.id === 'imp' && t.files && t.files[0]) { importData(t.files[0]); t.value = ''; }
});
document.addEventListener('visibilitychange', function () { if (document.hidden) stopSpeechSoft(); });
function stopSpeechSoft() { if (rd && rd.playing) pausePlay(); }

caches();
render();
