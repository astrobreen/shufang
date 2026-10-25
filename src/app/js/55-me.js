/* ===== Me ===== */
function totalChars() { return S.log.reduce(function (a, r) { return a + r.chars; }, 0); }
function heatHTML() {
  /* 10 week-columns x 7 weekday-rows (Mon first), the last column ends on this week */
  var by = {}, cells = '', today = new Date(); today.setHours(12, 0, 0, 0);
  S.log.forEach(function (r) { by[r.d] = r; });
  var dow = (today.getDay() + 6) % 7, day = new Date(today); day.setDate(day.getDate() - dow - 63);
  for (var i = 0; i < 70; i++, day.setDate(day.getDate() + 1)) {
    if (day > today) { cells += '<i class="fut"></i>'; continue; }
    var k = C.dayKey(day.getTime()), r = by[k], a = r ? r.chars / S.set.goal + r.cards / 20 + (r.ex || 0) / 20 : 0;
    cells += '<i class="' + (a >= 1 ? 'h3' : a >= 0.5 ? 'h2' : a > 0 ? 'h1' : '') + '" title="' + k + '"></i>';
  }
  return '<div class="heat" role="img" aria-label="Activity over the last 10 weeks">' + cells + '</div>';
}
function levelRows() {
  if (!V.ready) { if (!V.loading && !V.failed) loadVocab(function () { if (view === 'me' && !rd && !ses) render(); }); return '<div class="empty" style="padding:18px"><p>Loading…</p></div>'; }
  var out = '';
  for (var lv = 1; lv <= 9; lv++) {
    var arr = V.byLv[lv] || [], n = 0;
    arr.forEach(function (w) { if (savedSet.has(w.h) || knownSet.has(w.h)) n++; });
    out += '<div class="lvrow l' + lv + '"><span class="n"><span class="lvb l' + lv + '">' + lv + '</span>HSK ' + lv + '</span><div class="bar lvbar"><i style="width:' + Math.round(n / Math.max(1, arr.length) * 100) + '%"></i></div><span class="small muted num" style="text-align:right">' + n + '/' + arr.length + '</span></div>';
  }
  return out;
}
function flagsHTML() {
  if (!S.flags.length) return '<div class="field"><div class="lab">None yet<small>When a sentence looks wrong, open any word in it and tap “Report a mistake”. They collect here so you can send them on.</small></div></div>';
  return S.flags.slice().reverse().slice(0, 12).map(function (f) {
    var L = byId.get(f.lid);
    return '<div class="field"><div class="lab"><span class="zh">' + esc(f.note) + '</span> in “' + esc(L ? L.titleEn : f.lid) + '”, sentence ' + (f.si + 1) + '<small>' + new Date(f.at).toLocaleDateString() + '</small></div></div>';
  }).join('') + '<div class="field"><div class="actions" style="margin:0"><button class="btn sm" data-act="copyflags">Copy list</button><button class="btn sm danger" data-act="clearflags">Clear</button></div></div>';
}
function viewMe() {
  var strk = C.streak(S.log, now());
  var out = '<div class="title"><div class="sp"><h1>Me</h1><p>Your progress and settings</p></div></div>';
  out += '<div class="stats3" style="margin-top:0"><div class="stat"><b class="num">' + strk + '</b><span>day streak</span></div><div class="stat"><b class="num">' + totalChars().toLocaleString() + '</b><span>characters read</span></div><div class="stat"><b class="num">' + S.done.length + '</b><span>lessons done</span></div></div>';
  out += '<div class="panel mt12"><div class="eyebrow">Last 10 weeks</div>' + heatHTML() + '</div>';
  out += '<h2 class="h2">My level</h2><div class="group"><div class="field"><div class="lab">HSK level<small>Words at or below it lose their pinyin in Smart mode, and lessons are matched to it. Choose New if you are just starting.</small></div><div class="lvpick">';
  for (var i = 0; i <= 9; i++) out += '<button class="chip lv l' + i + (uLevel() === i ? ' on' : '') + '" data-act="mylevel" data-v="' + i + '"' + (i === 0 ? ' aria-label="New, just starting"' : '') + '>' + (i || 'New') + '</button>';
  out += '</div><button class="btn sm" data-act="finder" style="align-self:flex-start">Take the placement test</button></div>' +
    '<div class="field"><div class="lab">Daily reading goal<small>Characters per day. A short lesson is about 100.</small></div><div class="seg">' +
    [50, 100, 150, 300, 600].map(function (g) { return '<button data-act="goal" data-v="' + g + '" class="' + (S.set.goal === g ? 'on' : '') + '">' + g + '</button>'; }).join('') + '</div></div></div>';
  out += '<h2 class="h2">Vocabulary by level</h2><div class="group">' + levelRows() + '</div><p class="legend"><span>Saved or known words</span></p>';
  out += '<h2 class="h2">Flashcards</h2><div class="group"><div class="field"><div class="lab">Card front<small>What you see before you reveal the answer.</small></div>' + seg('dir', [['zh-en', '汉字 first'], ['en-zh', 'English first'], ['listen', 'Audio first']]) + '</div></div>';
  out += '<h2 class="h2">Display</h2>' + displayControls();
  out += '<h2 class="h2">Your data</h2><div class="group">' +
    '<div class="field"><div class="actions" style="margin:0;grid-template-columns:1fr 1fr 1fr"><button class="btn sm" data-act="export">Save file</button><button class="btn sm" data-act="copy">Copy</button><button class="btn sm" data-act="import">Import</button></div></div>' +
    '<div class="field"><button class="btn danger sm" data-act="reset" style="align-self:flex-start">' + (resetArm ? 'Tap again to erase everything' : 'Reset all progress') + '</button></div></div>';
  out += '<h2 class="h2">Reported mistakes</h2><div class="group">' + flagsHTML() + '</div>';
  out += '<div class="about">' + markHTML('sm') + '<p><b>Shufang 书房</b><br>' + LESSONS.length + ' graded lessons · HSK 3.0 levels 1 to 9</p>' +
    '<p class="cr">Dictionary: CC-CEDICT (CC BY-SA 4.0) · Stroke data: Make Me a Hanzi · Pinyin: pinyin-data · Word lists: complete-hsk-vocabulary. HSK 7 to 9 are ordered by word frequency.</p></div>';
  return out;
}

/* ---------- backup ---------- */
function exportData() {
  var name = 'shufang-backup-' + C.dayKey(now()) + '.json', data = JSON.stringify(S, null, 1);
  if (window.ShufangAndroid && typeof window.ShufangAndroid.saveFile === 'function') {   // the Android app: system "save as" dialog
    try { window.ShufangAndroid.saveFile(name, data); } catch (e) { toast('Could not save the file. Use Copy instead.'); }
    return;
  }
  try {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000); toast('Backup saved');
  } catch (e) { toast('Saving files is not available here. Use Copy instead.'); }
}
function copyText(text, ok, fail) {
  try { navigator.clipboard.writeText(text).then(function () { toast(ok); }, function () { toast(fail); }); } catch (e) { toast(fail); }
}
function importData(file) {
  var fr = new FileReader();
  fr.onload = function () {
    try {
      var inc = sanitize(JSON.parse(String(fr.result)));
      if (!hasData(inc) && inc.updatedAt === 0) { toast('That file has no Shufang data.'); return; }
      S = unionState(S, inc); S.updatedAt = now(); save();
      toast('Backup merged: ' + plural(S.words.length, 'word') + ', ' + plural(S.done.length, 'finished lesson'));
      render();
    } catch (e) { toast('That file could not be read.'); }
  };
  fr.readAsText(file);
}
