/* ===== stroke data, animation and handwriting check =====
   Outlines and median strokes come from Make Me a Hanzi (Arphic Public License, derived from Arphic PL KaitiM GB / UKai).
   Coordinates: 1024 box, y up; the page flips them with scale(1,-1) translate(0,-900). */
var HZ = { idx: null, idxState: 0, data: {}, loaded: {}, waiters: [] };
function hzIndex(cb) {
  if (HZ.idx) { cb(true); return; }
  HZ.waiters.push(cb);
  if (HZ.idxState === 1) return;
  HZ.idxState = 1;
  fetch('chars.json').then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (j) {
    HZ.idx = {};
    Object.keys(j).forEach(function (sh) { for (var i = 0; i < j[sh].length; i++) HZ.idx[j[sh][i]] = sh; });
    HZ.idxState = 2; HZ.waiters.splice(0).forEach(function (f) { f(true); });
  }).catch(function () { HZ.idxState = 0; HZ.waiters.splice(0).forEach(function (f) { f(false); }); });
}
/* make sure stroke data for these characters is present; cb(ok) */
function hzLoad(chars, cb) {
  hzIndex(function (ok) {
    if (!ok) { cb(false); return; }
    var need = {};
    chars.forEach(function (c) { if (!HZ.data[c] && HZ.idx[c] && !HZ.loaded[HZ.idx[c]]) need[HZ.idx[c]] = 1; });
    var shards = Object.keys(need);
    if (!shards.length) { cb(true); return; }
    var left = shards.length, bad = false;
    shards.forEach(function (sh) {
      fetch('strokes/s' + sh + '.json').then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (j) {
        Object.keys(j).forEach(function (c) { HZ.data[c] = { s: j[c][0], m: j[c][1], i: j[c][2] || [] }; });
        HZ.loaded[sh] = 1;
      }).catch(function () { bad = true; }).then(function () { if (--left === 0) cb(!bad); });
    });
  });
}
function hzGet(c) { return HZ.data[c] || null; }
function hzHas(c) { return !!(HZ.idx && HZ.idx[c]) || !!HZ.data[c]; }

var hzUid = 0;
function mPath(m) { return 'M ' + m.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L '); }
function mLen(m) { var l = 0; for (var i = 1; i < m.length; i++) l += Math.hypot(m[i][0] - m[i - 1][0], m[i][1] - m[i - 1][1]); return l; }
var VB = '-64 -64 1152 1152';   // 64 units of margin around the 1024 em box so characters never touch the frame
var GRID = '<path class="gridl" d="M512 -64V1088M-64 512H1088M-64 -64L1088 1088M1088 -64L-64 1088"/>';
var FLIP = 'transform="scale(1,-1) translate(0,-900)"';

/* animated stroke-order diagram */
function hzAnimHTML(ch) {
  var d = hzGet(ch);
  if (!d) return '';
  var u = 'a' + (++hzUid), bg = '', ink = '', defs = '';
  d.s.forEach(function (s, i) {
    var L = Math.ceil(mLen(d.m[i])) + 10;
    bg += '<path class="bg" d="' + s + '"/>';
    defs += '<clipPath id="' + u + '-' + i + '"><path d="' + s + '"/></clipPath>';
    ink += '<path class="inkp" clip-path="url(#' + u + '-' + i + ')" d="' + mPath(d.m[i]) + '" stroke-width="170" data-len="' + L + '" style="stroke-dasharray:' + L + ' ' + (L + 4) + ';stroke-dashoffset:0"/>';
  });
  return '<svg class="anim" viewBox="' + VB + '" role="img" aria-label="Stroke order of ' + esc(ch) + '" data-ch="' + esc(ch) + '">' + GRID + '<defs>' + defs + '</defs><g ' + FLIP + '>' + bg + ink + '</g></svg>';
}
/* play the diagram stroke by stroke; returns { stop() } */
function hzPlay(svg, done) {
  var paths = $$('.inkp', svg), alive = true, raf = 0, t0 = 0, i = 0, dur = 0;
  paths.forEach(function (p) { p.style.opacity = 0; });
  function begin(k) {
    if (!alive) return;
    if (k >= paths.length) { if (done) done(); return; }
    i = k; var L = +paths[k].dataset.len; dur = clamp(260 + L * 0.85, 360, 1100);
    paths[k].style.strokeDashoffset = L + 4; paths[k].style.opacity = 1; t0 = performance.now();
    raf = requestAnimationFrame(step);
  }
  function step(t) {
    if (!alive) return;
    var p = clamp((t - t0) / dur, 0, 1), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, L = +paths[i].dataset.len;
    paths[i].style.strokeDashoffset = (L + 4) * (1 - e);
    if (p < 1) raf = requestAnimationFrame(step); else setTimeout(function () { begin(i + 1); }, 170);
  }
  begin(0);
  return { stop: function () { alive = false; cancelAnimationFrame(raf); paths.forEach(function (p) { p.style.opacity = 1; p.style.strokeDashoffset = 0; }); } };
}

/* ---- handwriting check ---- */
function resample(pts, n) {
  var tot = 0, i, segs = [];
  for (i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); tot += l; }
  if (tot === 0) { var o = []; for (i = 0; i < n; i++) o.push(pts[0].slice()); return o; }
  var out = [pts[0].slice()], acc = 0, k = 0, step = tot / (n - 1);
  for (var j = 1; j < n - 1; j++) {
    var target = j * step;
    while (k < segs.length - 1 && acc + segs[k] < target) { acc += segs[k]; k++; }
    var f = segs[k] ? (target - acc) / segs[k] : 0;
    out.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]);
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
function strokeMatch(user, med) {
  var lenU = mLen(user), lenM = mLen(med);
  if (user.length < 2 || lenU < 12) { // a tap: only fine for short strokes (dots)
    return lenM < 170 && user.length && Math.hypot(user[0][0] - med[0][0], user[0][1] - med[0][1]) < 230;
  }
  var a = resample(user, 24), b = resample(med, 24), sum = 0, i;
  for (i = 0; i < 24; i++) sum += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]);
  var avg = sum / 24, d0 = Math.hypot(a[0][0] - b[0][0], a[0][1] - b[0][1]), d1 = Math.hypot(a[23][0] - b[23][0], a[23][1] - b[23][1]);
  var ux = a[23][0] - a[0][0], uy = a[23][1] - a[0][1], mx = b[23][0] - b[0][0], my = b[23][1] - b[0][1];
  var dirOK = true, nu = Math.hypot(ux, uy), nm = Math.hypot(mx, my);
  if (nm > 90 && nu > 50) dirOK = (ux * mx + uy * my) / (nu * nm) > 0.25;
  var ratioOK = lenU > 0.38 * lenM && lenU < 2.4 * lenM + 140;
  return avg < 165 && d0 < 250 && d1 < 280 && dirOK && ratioOK;
}

/* writing pad for one character. o: { guide, onStroke(idx, ok, st), onDone(st) } */
function hzWriter(host, ch, o) {
  var d = hzGet(ch);
  if (!d) { host.innerHTML = ''; return null; }
  var n = d.s.length, cur = 0, miss = 0, curMiss = 0, hints = 0, pts = null, active = false, done = false, timers = [];
  var ghost = '', doneP = '';
  d.s.forEach(function (s) { ghost += '<path class="ghost" d="' + s + '"/>'; });
  host.innerHTML = '<svg class="pad" viewBox="' + VB + '" aria-label="Writing pad for ' + esc(ch) + '">' + GRID +
    '<g ' + FLIP + ' class="gg" ' + (o.guide ? '' : 'style="display:none"') + '>' + ghost + '</g><g ' + FLIP + ' class="gd"></g><g ' + FLIP + ' class="gh"></g><path class="live" d=""/></svg>';
  var svg = $('svg.pad', host), gd = $('.gd', svg), gh = $('.gh', svg), live = $('.live', svg), gg = $('.gg', svg);
  function toData(ev) {
    var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 1152 - 64, y = (ev.clientY - r.top) / r.height * 1152 - 64;
    return [x, 900 - y];
  }
  function livePath() { live.setAttribute('d', pts && pts.length > 1 ? 'M ' + pts.map(function (p) { return p[0] + ' ' + (900 - p[1]); }).join(' L ') : (pts && pts.length ? 'M ' + pts[0][0] + ' ' + (900 - pts[0][1]) + ' l 0.1 0' : '')); }
  function flash(cls, ms) { svg.classList.add(cls); timers.push(setTimeout(function () { svg.classList.remove(cls); }, ms)); }
  function accept() {
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d.s[cur]); p.setAttribute('class', 'done fade'); gd.appendChild(p);
    var ok = true; cur++; curMiss = 0;
    if (o.onStroke) o.onStroke(cur - 1, true, { cur: cur, n: n, miss: miss, hints: hints });
    if (cur >= n) { done = true; if (o.onDone) o.onDone({ miss: miss, hints: hints, n: n }); }
    return ok;
  }
  function reject() {
    miss++; curMiss++;
    flash('shake', 300);
    var order = false;
    for (var j = cur + 1; j < n; j++) if (strokeMatch(pts, d.m[j])) { order = true; break; }
    if (o.onStroke) o.onStroke(cur, false, { cur: cur, n: n, miss: miss, hints: hints, order: order, curMiss: curMiss });
    if (curMiss >= 3) api.hint();
  }
  function down(ev) {
    if (done || ev.button > 0) return;
    ev.preventDefault();
    try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    active = true; pts = [toData(ev)]; livePath();
  }
  function move(ev) {
    if (!active) return;
    ev.preventDefault();
    var p = toData(ev), l = pts[pts.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 6) { pts.push(p); livePath(); }
  }
  function up(ev) {
    if (!active) return;
    active = false;
    var good = strokeMatch(pts, d.m[cur]);
    live.setAttribute('d', '');
    if (good) accept(); else reject();
    pts = null;
  }
  svg.addEventListener('pointerdown', down);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', function () { active = false; pts = null; live.setAttribute('d', ''); });
  svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  var api = {
    n: n,
    stats: function () { return { cur: cur, n: n, miss: miss, hints: hints, done: done }; },
    hint: function () {
      if (done) return;
      hints++;
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d.s[cur]); p.setAttribute('class', 'hintp fade'); gh.appendChild(p);
      timers.push(setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 1500));
    },
    guide: function (b) { gg.style.display = b ? '' : 'none'; },
    destroy: function () { timers.forEach(clearTimeout); host.innerHTML = ''; }
  };
  return api;
}

/* what a character is made of, from Make Me a Hanzi's dictionary */
function hzInfoHTML(ch) {
  var d = hzGet(ch), i = d && d.i && d.i.length ? d.i : null;
  if (!i) return '';
  var out = [];
  if (i[0]) out.push('<span>Radical <b class="zh">' + esc(i[0]) + '</b></span>');
  var parts = (i[1] || '').replace(/[\u2FF0-\u2FFB]/g, '');
  if (parts && parts.indexOf('？') < 0 && parts.length > 1) out.push('<span>Built from <b class="zh">' + esc(parts.split('').join(' + ')) + '</b></span>');
  var hint = i[3] ? ({ pictographic: 'Picture', ideographic: 'Idea', pictophonetic: 'Sound + meaning' }[i[2]] || '') + (i[3] ? ': ' + esc(i[3]) : '') : '';
  if (i[2] === 'pictophonetic' && i[4] && i[5]) hint = 'Meaning from <b class="zh">' + esc(i[5]) + '</b>, sound from <b class="zh">' + esc(i[4]) + '</b>' + (i[3] ? '. ' + esc(i[3]) : '');
  return '<div class="small muted" style="display:flex;gap:6px 14px;flex-wrap:wrap;margin-top:6px">' + out.join('') + '</div>' + (hint ? '<p class="small muted" style="margin-top:4px">' + hint + '</p>' : '');
}
