/* ===== Dictionary: write a character =====
   A pad in the Dictionary view.  Strokes are matched against site/hw.json (the stroke centre-lines of the same ~3,000
   characters used for stroke order) by Core.hwRank, which pairs strokes by cheapest assignment, so the order they are
   written in matters only a little.  Tapping a candidate adds it to the search box. */
var HWI = { ready: false, loading: false, failed: false, idx: null, waiters: [] };
var HWS = [], HWC = [], hwDraw = null, hwTimer = null;

function loadHw(cb) {
  if (HWI.ready) { if (cb) cb(true); return; }
  if (cb) HWI.waiters.push(cb);
  if (HWI.loading) return;
  HWI.loading = true; HWI.failed = false;
  fetch('hw.json').then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (j) {
    HWI.idx = C.hwIndex(j); HWI.ready = true; HWI.loading = false;
    HWI.waiters.splice(0).forEach(function (f) { f(true); });
  }).catch(function () {
    HWI.loading = false; HWI.failed = true;
    HWI.waiters.splice(0).forEach(function (f) { f(false); });
  });
}

function hwPath(pts) {
  if (!pts.length) return '';
  if (pts.length === 1) return 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1) + ' l 0.01 0';
  return 'M ' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L ');
}
function hwCandsHTML() {
  if (HWI.failed) return '<span class="small muted">Could not load the handwriting data. It needs a connection the first time.</span> <button class="btn ghost sm" data-act="hwretry">Retry</button>';
  if (!HWI.ready) return '<span class="small muted">Loading…</span>';
  if (!HWS.length) return '<span class="small muted">Write one character below. Its best matches appear here.</span>';
  if (!HWC.length) return '<span class="small muted">No match. Check the number of strokes, or clear and try again.</span>';
  return HWC.map(function (c) { return '<button class="hwc" data-act="hwpick" data-c="' + esc(c) + '" lang="' + lang() + '" aria-label="' + esc(c) + '">' + esc(sc(c)) + '</button>'; }).join('');
}
function hwBoxHTML() {
  var ink = HWS.map(function (s) { return '<path class="hwink" d="' + hwPath(s) + '"/>'; }).join('');
  return '<div class="hwbox" id="hwbox"><div class="hwcands" id="hwcands">' + hwCandsHTML() + '</div>' +
    '<div class="hwwrap"><svg class="hwpad" id="hwpad" viewBox="0 0 100 100" role="img" aria-label="Writing pad"><path class="gl" d="M50 0V100M0 50H100"/><g id="hwink">' + ink + '</g><path class="hwlive" id="hwlive" d=""/></svg></div>' +
    '<div class="hwbtns"><button class="btn" data-act="hwundo"' + (HWS.length ? '' : ' disabled') + '>Undo</button><button class="btn" data-act="hwclear"' + (HWS.length ? '' : ' disabled') + '>Clear</button>' +
    '<button class="btn" data-act="hwdel"' + (dui.q ? '' : ' disabled') + ' aria-label="Delete the last character in the search box">Delete</button></div>' +
    '<p class="small muted mt8" style="text-align:center">Stroke order is flexible, but draw every stroke. One character at a time.</p></div>';
}
function hwRefreshBox() {
  var c = $('#hwcands'); if (c) c.innerHTML = hwCandsHTML();
  var b = $('#hwbox'); if (!b) return;
  var bs = b.querySelectorAll('.hwbtns .btn');
  if (bs.length === 3) { bs[0].disabled = !HWS.length; bs[1].disabled = !HWS.length; bs[2].disabled = !dui.q; }
}
function hwRecognize() {
  clearTimeout(hwTimer);
  if (!HWS.length) { HWC = []; hwRefreshBox(); return; }
  if (!HWI.ready) { loadHw(function () { if (inDict() && dui.hw) hwRecognize(); }); hwRefreshBox(); return; }
  hwTimer = setTimeout(function () {                 // after the ink is on screen; a later stroke cancels an earlier search
    HWC = C.hwRank(HWS, HWI.idx, 12).map(function (r) { return r.c; });
    hwRefreshBox();
  }, 25);
}
function hwSetQuery(q) {
  dui.q = q; dui.n = 40;
  var el = $('#dq'); if (el) el.value = q;
  refreshDictList();
}
function hwClearInk() { HWS = []; HWC = []; var g = $('#hwink'); if (g) g.innerHTML = ''; var l = $('#hwlive'); if (l) l.setAttribute('d', ''); }

function hwPoint(ev, svg) {
  var r = svg.getBoundingClientRect();
  return [Math.min(100, Math.max(0, (ev.clientX - r.left) / r.width * 100)), Math.min(100, Math.max(0, (ev.clientY - r.top) / r.height * 100))];
}
document.addEventListener('pointerdown', function (ev) {
  var svg = ev.target && ev.target.closest && ev.target.closest('#hwpad');
  if (!svg || ev.button > 0) return;
  ev.preventDefault();
  try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  hwDraw = { id: ev.pointerId, svg: svg, pts: [hwPoint(ev, svg)] };
  $('#hwlive').setAttribute('d', hwPath(hwDraw.pts));
});
document.addEventListener('pointermove', function (ev) {
  if (!hwDraw || ev.pointerId !== hwDraw.id) return;
  ev.preventDefault();
  var evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
  if (!evs.length) evs = [ev];
  evs.forEach(function (e) {
    var p = hwPoint(e, hwDraw.svg), l = hwDraw.pts[hwDraw.pts.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.7) hwDraw.pts.push(p);
  });
  var live = $('#hwlive'); if (live) live.setAttribute('d', hwPath(hwDraw.pts));
});
function hwEnd(ev, cancel) {
  if (!hwDraw || ev.pointerId !== hwDraw.id) return;
  var pts = hwDraw.pts; hwDraw = null;
  var live = $('#hwlive'); if (live) live.setAttribute('d', '');
  if (cancel || !pts.length) return;
  HWS.push(pts);
  var g = $('#hwink');
  if (g) { var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('class', 'hwink'); p.setAttribute('d', hwPath(pts)); g.appendChild(p); }
  hwRecognize();
}
document.addEventListener('pointerup', function (ev) { hwEnd(ev, false); });
document.addEventListener('pointercancel', function (ev) { hwEnd(ev, true); });
document.addEventListener('contextmenu', function (ev) { if (ev.target && ev.target.closest && ev.target.closest('#hwpad')) ev.preventDefault(); });
