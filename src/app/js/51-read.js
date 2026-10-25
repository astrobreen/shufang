/* ===== Read: library ===== */
function lessonRow(L) {
  var d = doneMap.get(L.id), cov = coverageOf(L), marked = S.marks.indexOf(L.id) >= 0;
  var first = (L.title[0] && L.title[0].h) ? tokSc(L.title[0]).charAt(0) : '读';
  var tags = '';
  if (d) tags += '<span class="tag good">Done' + (d.q != null ? ' · ' + Math.round(d.q) + '%' : '') + '</span>';
  else if (S.last && S.last.id === L.id) tags += '<span class="tag acc">Continue</span>';
  else if (uLevel() > 0 && L.type !== 'poem' && L.type !== 'classic' && cov < 0.999) tags += '<span class="tag ' + (cov >= 0.9 ? 'good' : cov >= 0.75 ? 'acc' : 'warn') + '">' + Math.round(cov * 100) + '% familiar</span>';
  return '<div class="lrow l' + L.level + '" data-act="open" data-id="' + L.id + '" tabindex="0" role="button" aria-label="Open ' + esc(L.titleEn) + '">' +
    '<div class="lt' + (d ? ' done' : '') + '" lang="' + lang() + '">' + esc(first) + '</div><div class="lb">' +
    '<div class="z" lang="' + lang() + '">' + esc(titleZh(L)) + '</div><div class="e">' + esc(L.titleEn) + '</div>' +
    '<div class="m"><span>' + TYPE_LABEL[L.type] + ' · ' + esc(L.topic) + ' · ' + L.minutes + ' min</span>' + (tags ? tags : '') + '</div></div>' +
    '<button class="bm' + (marked ? ' on' : '') + '" data-act="bm" data-id="' + L.id + '" aria-label="' + (marked ? 'Remove bookmark' : 'Bookmark') + '" aria-pressed="' + marked + '">' + icon('bm', 'sm') + '</button></div>';
}
function levelStats(lv) {
  var ls = LESSONS.filter(function (l) { return l.level === lv; });
  return { n: ls.length, done: ls.filter(function (l) { return doneMap.has(l.id); }).length };
}
function viewRead() {
  var out = '<div class="title"><div class="sp"><h1>Read</h1><p>' + LESSONS.length + ' lessons from HSK 1 to 9</p></div>' +
    '<button class="chip" data-act="script" aria-label="Switch between simplified and traditional characters" style="min-height:36px"><span class="zh" style="font-weight:700">' + (S.set.script === 'simp' ? '简' : '繁') + '</span></button></div>';
  out += '<label class="search">' + icon('search', 'sm') + '<input id="lq" type="search" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Search lessons" value="' + esc(hui.q) + '"></label>';
  out += '<div class="lvlbar mt12" role="group" aria-label="Level"><button class="' + (hui.lv === 0 ? 'on' : '') + '" data-act="lvl" data-v="0">All</button>';
  for (var i = 1; i <= 9; i++) out += '<button class="l' + i + (hui.lv === i ? ' on' : '') + '" data-act="lvl" data-v="' + i + '" aria-label="HSK ' + i + '">' + i + '</button>';
  out += '</div>';
  var scope = hui.lv ? levelStats(hui.lv) : { n: LESSONS.length, done: S.done.length };
  out += '<p class="prog">' + scope.done + ' of ' + scope.n + ' read' + (hui.lv ? ' · HSK ' + hui.lv : '') + '</p>';
  if (hui.lv) out += '<p class="note">' + esc(LEVELS[hui.lv].d) + '</p>';
  out += '<div class="hscroll" role="group" aria-label="Filters">';
  [['dialogue', 'Dialogues'], ['story', 'Stories'], ['article', 'Articles'], ['poem', 'Poems'], ['classic', 'Classics']].forEach(function (t) {
    out += '<button class="chip' + (hui.type === t[0] ? ' on' : '') + '" data-act="type" data-v="' + t[0] + '">' + t[1] + '</button>';
  });
  out += '<button class="chip' + (hui.unread ? ' on' : '') + '" data-act="unread" aria-pressed="' + hui.unread + '">Unread</button>' +
    '<button class="chip' + (hui.marked ? ' on' : '') + '" data-act="marked" aria-pressed="' + !!hui.marked + '">Saved</button></div>';
  out += '<div id="llist">' + lessonList() + '</div>';
  return out;
}
function lessonList() {
  var q = hui.q.trim().toLowerCase();
  var list = LESSONS.slice().sort(lessonOrder).filter(function (L) {
    if (hui.lv && L.level !== hui.lv) return false;
    if (hui.type !== 'all' && L.type !== hui.type) return false;
    if (hui.unread && doneMap.has(L.id)) return false;
    if (hui.marked && S.marks.indexOf(L.id) < 0) return false;
    if (q) {
      var hay = (L.titleEn + ' ' + L.summary + ' ' + L.topic + ' ' + L.source + ' ' + L.title.map(function (t) { return t.h || ''; }).join('') + ' ' + L.title.map(function (t) { return t.py ? C.plainPy(t.py.join(' ')) : ''; }).join('')).toLowerCase();
      var qn = /^[a-z0-9üv:' ]+$/i.test(q) ? C.norm(q) : '';
      if (hay.indexOf(q) < 0 && !(qn && hay.replace(/[^a-z]/g, '').indexOf(qn) >= 0)) return false;
    }
    return true;
  });
  if (!list.length) return '<div class="empty"><h3>Nothing here</h3><p>Try another level or format.</p></div>';
  if (hui.lv) return '<div class="group">' + list.map(lessonRow).join('') + '</div>';
  var out = '', cur = 0, buf = '';
  function flush() { if (buf) { out += '<div class="group">' + buf + '</div>'; buf = ''; } }
  list.forEach(function (L) {
    if (L.level !== cur) { flush(); cur = L.level; out += '<h2 class="h2 l' + cur + '">HSK ' + cur + '</h2>'; }
    buf += lessonRow(L);
  });
  flush();
  return out;
}
