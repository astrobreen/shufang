/* ===== Today ===== */
var CN = '〇一二三四五六七八九十';
function cnNum(n) { if (n <= 10) return CN[n]; if (n < 20) return '十' + CN[n - 10]; var t = Math.floor(n / 10), o = n % 10; return CN[t] + '十' + (o ? CN[o] : ''); }
function cnDate(d) { return '星期' + '日一二三四五六'[d.getDay()] + ' · ' + cnNum(d.getMonth() + 1) + '月' + cnNum(d.getDate()) + '日'; }

function lessonScore(L) {
  var pen = (L.type === 'poem' || L.type === 'classic') ? 0.05 : 0;
  return Math.abs(coverageOf(L) - 0.92) + 0.07 * Math.abs(L.level - uLevel()) + pen;
}
function recommended(n, skipId) {
  return LESSONS.filter(function (L) { return !doneMap.has(L.id) && L.id !== skipId; })
    .map(function (L) { return { L: L, s: lessonScore(L) }; }).sort(function (a, b) { return a.s - b.s; }).slice(0, n).map(function (x) { return x.L; });
}
function wordOfDay() {
  var d = new Date(), seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  var lv = clamp(uLevel(), 1, 9), pool = [];
  if (V.ready) {
    pool = (V.byLv[lv] || []).filter(function (w) { return w.h.length > 1 && !knownSet.has(w.h); });
  } else {
    pool = Array.from(dict.values()).filter(function (e) { return e.lv === lv && e.h.length > 1 && !knownSet.has(e.h); });
  }
  if (!pool.length) return null;
  var w = pool[(seed * 2654435761 >>> 0) % pool.length];
  return V.ready ? w : { h: w.h, py: w.py, g: w.gl[0], lv: w.lv };
}
function idiomOfDay() {
  var d = new Date(), seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate() + 7, top = uLevel() <= 3 ? 2 : 3;
  var pool = CY.filter(function (c) { return c.tier <= top && !knownSet.has(c.h); });
  return pool.length ? pool[(seed * 2654435761 >>> 0) % pool.length] : null;
}
function nextDueText() {
  var t = null;
  S.words.forEach(function (w) { if (w.due > now() && (t === null || w.due < t)) t = w.due; });
  return t === null ? '' : 'Next review in ' + C.fmtIv(t - now()) + '.';
}
function learnNew(n) {
  if (!V.ready) { toast('Loading the word list…'); loadVocab(function () { if (V.ready) learnNew(n); else toast('Could not load the word list.'); }); return; }
  var lv = clamp(uLevel(), 1, 9), added = [];
  while (lv <= 9 && added.length < n) {
    (V.byLv[lv] || []).forEach(function (w) { if (added.length < n && !savedSet.has(w.h) && !knownSet.has(w.h)) added.push(w.h); });
    lv++;
  }
  added.forEach(function (h) { S.words.push(newCard(h)); });
  save();
  toast(added.length ? 'Added ' + plural(added.length, 'new word') + ' to review' : 'No new words left');
  render();
}

function viewToday() {
  var d = new Date(), tr = todayRow(), goal = S.set.goal, pct = clamp(Math.round(tr.chars / goal * 100), 0, 100);
  var due = dueCards(), strk = C.streak(S.log, now());
  var cont = S.last && byId.get(S.last.id);
  if (cont && doneMap.has(cont.id)) cont = null;
  var rec = cont || recommended(1)[0];
  var out = '<div class="hello row"><div class="sp"><div class="date zh">' + cnDate(d) + '</div><h1>Today</h1></div>' + markHTML('', 'Shufang 书房') + '</div>';

  if (rec) {
    var cov = Math.round(coverageOf(rec) * 100);
    out += '<button class="hero tint l' + rec.level + '" data-act="open" data-id="' + rec.id + '"><div class="t"><div class="k">' + (cont ? 'Continue reading' : 'Read next') + '</div>' +
      '<h2 lang="' + lang() + '">' + esc(titleZh(rec)) + '</h2><p>' + esc(rec.titleEn) + '</p>' +
      '<p class="tiny faint mt8" style="margin-top:6px">HSK ' + rec.level + ' · ' + rec.minutes + ' min' + (uLevel() > 0 ? ' · ' + cov + '% familiar words' : '') + '</p></div><span class="go">' + icon('play') + '</span></button>';
  }

  if (!S.words.length) {
    out += '<div class="hero"><div class="t"><div class="k" style="color:var(--accent)">Words</div><h2>Start your word list</h2><p>Add ten HSK ' + clamp(uLevel(), 1, 9) + ' words and review them a little every day.</p></div><button class="btn pri sm" data-act="learn" data-n="10">Add 10</button></div>';
  } else if (due.length) {
    out += '<button class="hero" data-act="flash-start"><div class="t"><div class="k" style="color:var(--accent)">Review</div><h2>' + plural(due.length, 'card') + ' due</h2><p>About ' + Math.max(1, Math.round(due.length * 0.4)) + ' min · spaced repetition</p></div><span class="go" style="background:var(--accent)">' + icon('cards') + '</span></button>';
  } else {
    out += '<div class="hero"><div class="t"><div class="k" style="color:var(--good)">Review</div><h2>All caught up</h2><p>' + esc(nextDueText() || 'Nothing is due right now.') + '</p></div><button class="btn sm" data-act="learn" data-n="10">+10 new</button></div>';
  }

  out += '<div class="panel mt12"><div class="row gap12"><div class="ring" style="--p:' + pct + '"><span class="num">' + pct + '%</span></div>' +
    '<div class="sp"><div class="eyebrow">Daily reading goal</div><div class="num" style="font:750 22px/1.25 var(--f-ui);letter-spacing:-.02em">' + tr.chars + ' <span class="muted" style="font:500 14px var(--f-ui)">of ' + goal + ' characters</span></div>' +
    '<div class="small muted">' + plural(tr.cards, 'card') + ' · ' + plural(tr.ex || 0, 'exercise') + ' today</div></div>' +
    '<div class="center"><div class="num" style="font:750 26px/1 var(--f-ui)">' + strk + '</div><div class="tiny muted">day' + (strk === 1 ? '' : 's') + '</div><div class="tiny muted">streak</div></div></div></div>';

  var w = wordOfDay();
  if (w) {
    var pyw = Array.isArray(w.py) ? phonJoin(w.py) : '';
    out += '<h2 class="h2">Word of the day</h2><div class="group"><button class="wotd" data-act="wordinfo" data-h="' + esc(w.h) + '"><span class="hz" lang="' + lang() + '">' + esc(sc(w.h)) + '</span>' +
      '<span class="sp"><span class="small" style="color:var(--accent);font-weight:600;display:block">' + esc(pyw) + '</span><span style="font-size:15px">' + esc(w.g) + '</span></span>' + lvBadge(w.lv) + '</button></div>';
  } else if (!V.ready && !V.loading && !V.failed) { loadVocab(function () { if (!rd && !ses && view === 'today') render(); }); }

  var cyd = idiomOfDay();
  if (cyd) out += '<h2 class="h2">Idiom of the day <small lang="zh-Hans">成语</small></h2><div class="group">' + cyRow(cyd) + '</div>';

  out += '<h2 class="h2">Keep going</h2><div class="tiles">' +
    '<button class="tilebtn" data-act="tab" data-v="practice"><span class="ti">' + icon('brush') + '</span><b>Write</b><span>Stroke order with instant feedback</span></button>' +
    '<button class="tilebtn" data-act="tone-start"><span class="ti">' + icon('tone') + '</span><b>Tones</b><span>Train your ear for the four tones</span></button></div>';
  return out;
}
