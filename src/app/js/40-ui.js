/* ===== shared UI ===== */
var IC = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
  read: '<path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z"/><path d="M12 6.5v13"/>',
  words: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M8 9.5h8M8 13h5"/>',
  dict: '<path d="M6 3.5h10.5a2 2 0 012 2V20H8a2 2 0 01-2-2z"/><path d="M6 18a2 2 0 012-2h10.5M10 8h5M10 11.5h3"/>',
  practice: '<path d="M4.5 19.5l1-4.2L16.3 4.5a2 2 0 012.8 0l.4.4a2 2 0 010 2.8L8.7 18.5z"/><path d="M14.5 6.3l3.2 3.2"/>',
  me: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.6-3.6 3.4-5.6 7-5.6s6.4 2 7 5.6"/>',
  play: '<path class="f" d="M8 5v14l11-7z"/>', pause: '<path class="f" d="M7 5h4v14H7zM13 5h4v14h-4z"/>',
  prev: '<path class="f" d="M18 6v12L9 12z"/><path d="M6.5 6v12"/>', next: '<path class="f" d="M6 6v12l9-6z"/><path d="M17.5 6v12"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', chev: '<path d="M9 5l7 7-7 7"/>',
  bm: '<path d="M7 4h10v16l-5-4-5 4z"/>', say: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9c1.5 1.6 1.5 4.4 0 6"/>',
  head: '<path d="M4 15v-3a8 8 0 0116 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  aa: '<path d="M3.5 18l5-12 5 12M5.3 14h6.4M15 18l3-7 3 7M16.2 15.5h3.6"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l5 5"/>', play2: '<path d="M7 5l12 7-12 7z"/>',
  cards: '<rect x="4" y="7" width="16" height="12" rx="2.5"/><path d="M7 4h10"/>',
  brush: '<path d="M4.5 19.5l1-4.2L16.3 4.5a2 2 0 012.8 0l.4.4a2 2 0 010 2.8L8.7 18.5z"/><path d="M14.5 6.3l3.2 3.2"/>',
  tone: '<path d="M4.5 9l7.5 6 7.5-6"/>', ear: '<path d="M7 9a5 5 0 0110 0c0 3-3 3.5-3 6.5a2.5 2.5 0 01-5 0"/><path d="M10 9a2 2 0 014 0"/>',
  gram: '<path d="M5 5h14v10H11l-4 4v-4H5z"/><path d="M9 9h6"/>', chart: '<path d="M5 20v-8M12 20V5M19 20v-5"/>',
  flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>', replay: '<path d="M4 12a8 8 0 108-8H8"/><path d="M11 1l-3 3 3 3"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  hint: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2v.1h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'
};
function icon(n, cls) { return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + '</svg>'; }

var view = 'today';
var hui = { lv: 0, type: 'all', unread: false, q: '' };
var wui = { q: '', tab: 'mine', lv: 0, f: 'all', n: 60, cf: 'all' };
var rd = null;     // open lesson
var ses = null;    // open practice session
var sh = null;     // open sheet
var finder = null;
var resetArm = false;
var scrollMemo = {};

var toastT = null;
function toast(msg) {
  var t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(function () { t.hidden = true; }, 2600);
}

function seg(key, opts) {
  return '<div class="seg" role="group">' + opts.map(function (o) {
    var on = String(S.set[key]) === String(o[0]);
    return '<button data-act="set" data-k="' + key + '" data-v="' + o[0] + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '">' + o[1] + '</button>';
  }).join('') + '</div>';
}
function toggle(key, label, sub) {
  return '<div class="field"><div class="fr"><div class="lab">' + label + (sub ? '<small>' + sub + '</small>' : '') + '</div><button class="sw" role="switch" aria-checked="' + !!S.set[key] + '" aria-label="' + esc(label) + '" data-act="tog" data-k="' + key + '"></button></div></div>';
}
/* word levels: 1-9 official HSK 3.0, 0 = name, 10 = outside the HSK lists */
function lvBadge(lv) { return lv > 0 && lv < 10 ? '<span class="lvb l' + lv + '">' + lv + '</span>' : lv === 11 ? '<span class="lvb cy" lang="zh-Hans" title="chéngyǔ: a four-character idiom">成语</span>' : ''; }
function lvTag(lv) { return lv === 11 ? '<span class="lvb cy" lang="zh-Hans" title="chéngyǔ: a four-character idiom">成语</span>' : lv > 0 && lv < 10 ? '<span class="lvb l' + lv + '" title="HSK ' + lv + '">HSK ' + lv + '</span>' : lv === 10 ? '<span class="tag">Beyond HSK</span>' : ''; }

function displayControls() {
  return '<div class="group">' +
    '<div class="field"><div class="lab">Characters</div>' + seg('script', [['simp', '简体 Simplified'], ['trad', '繁體 Traditional']]) + '</div>' +
    '<div class="field"><div class="lab">Pronunciation guide</div>' + seg('phon', [['pinyin', 'Pinyin'], ['num', 'pin1yin1'], ['zhuyin', 'ㄅㄆㄇ']]) + '</div>' +
    '<div class="field"><div class="lab">Show the guide<small>Smart hides words at or below your HSK level, and words you marked as known.</small></div>' + seg('vis', [['all', 'Always'], ['smart', 'Smart'], ['off', 'Hidden']]) + '</div>' +
    toggle('tone', 'Colour the tones', 'Pinyin takes a colour for each tone.') +
    toggle('hiNew', 'Underline words above my level', 'Helps you spot what is new.') +
    '<div class="field"><div class="lab">Text size</div><input type="range" min="0.8" max="1.6" step="0.05" value="' + S.set.size + '" data-range="size" aria-label="Text size"></div>' +
    '<div class="field"><div class="lab">Typeface</div>' + seg('font', [['sans', 'Sans'], ['serif', 'Serif']]) + '</div>' +
    toggle('listen', 'Listening mode', 'Blurs the text so you can train your ear. Tap a sentence to peek.') + '</div>' + voiceControls();
}
function voiceControls() {
  if (tts.native) {   // Android app: the phone's own text-to-speech voice
    var has = nativeVoice();
    return '<div class="group mt12"><div class="field"><div class="lab">Voice<small>' + (has ? 'Uses your phone’s text-to-speech voice. To change it, open Android Settings, then System, Languages, Text-to-speech.' : 'No Chinese voice was found. Open Android Settings, then System, Languages, Text-to-speech, and install Chinese (Mandarin) voice data.') + '</small></div></div>' +
      '<div class="field"><div class="lab">Speaking speed <span class="num muted">' + S.set.rate.toFixed(2) + '×</span></div><input type="range" min="0.5" max="1.5" step="0.05" value="' + S.set.rate + '" data-range="rate" aria-label="Speaking speed"></div></div>';
  }
  loadVoices();
  var opts = '<option value="">Automatic</option>' + tts.voices.map(function (v) { return '<option value="' + esc(v.voiceURI) + '"' + (S.set.voice === v.voiceURI ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>'; }).join('');
  return '<div class="group mt12"><div class="field"><div class="lab">Voice' + (tts.voices.length ? '' : '<small>No Chinese voice was found on this device. Audio uses the voices installed on your phone or computer.</small>') + '</div>' + (tts.voices.length ? '<select data-sel="voice" aria-label="Voice">' + opts + '</select>' : '') + '</div>' +
    '<div class="field"><div class="lab">Speaking speed <span class="num muted">' + S.set.rate.toFixed(2) + '×</span></div><input type="range" min="0.5" max="1.5" step="0.05" value="' + S.set.rate + '" data-range="rate" aria-label="Speaking speed"></div></div>';
}

/* ---------- sheet ---------- */
function openSheet(o) { if (sh && sh.anim) sh.anim.stop(); sh = o; $('#sheetwrap').hidden = false; document.documentElement.style.overflow = 'hidden'; renderSheet(); $('#sheet').scrollTop = 0; }
function closeSheet() {
  if (sh && sh.anim) { sh.anim.stop(); }
  sh = null; finder = null;
  var w = $('#sheetwrap'); if (w) w.hidden = true;
  document.documentElement.style.overflow = '';
  $$('.w.sel').forEach(function (x) { x.classList.remove('sel'); });
}
function sheetHead(title) {
  return '<div class="sh-top"><h2 class="h2 sp" style="margin:6px 0">' + title + '</h2><button class="iconbtn" data-act="close" aria-label="Close">' + icon('close') + '</button></div>';
}
function hilite(zh, h) {
  var hs = sc(h), i = zh.indexOf(hs);
  if (i < 0) return esc(zh);
  return esc(zh.slice(0, i)) + '<b>' + esc(hs) + '</b>' + esc(zh.slice(i + hs.length));
}

/* the app mark: the same 书 as the launcher icon, drawn from its outlines so it is exactly centred (Make Me a Hanzi, Arphic Public License) */
var MARK_SVG = '<svg viewBox="0 0 512 512" aria-hidden="true" focusable="false"><rect class="mk" width="512" height="512" rx="104"/><rect class="mf" x="36" y="36" width="440" height="440" rx="76"/><g transform="translate(75.71 77.14) scale(0.34455)"><g transform="scale(1,-1) translate(0,-900)" fill="#FFF3E6"><path d="M 681 421 Q 708 524 748 557 Q 766 576 750 596 Q 674 654 614 629 Q 572 616 534 604 L 483 593 Q 398 578 312 571 Q 294 570 295 560 Q 298 550 318 544 Q 345 531 383 542 Q 431 551 482 559 L 534 568 Q 570 575 607 582 Q 635 588 646 576 Q 658 566 655 543 Q 645 474 629 418 C 621 389 673 392 681 421 Z"/><path d="M 531 375 Q 769 399 794 379 Q 801 372 800 357 Q 760 191 741 170 Q 731 154 714 161 Q 683 167 649 174 Q 619 178 640 158 Q 701 103 726 65 Q 733 49 749 56 Q 779 72 807 151 Q 853 319 877 339 Q 896 361 889 370 Q 882 386 826 427 Q 807 445 788 439 Q 754 429 694 423 Q 687 423 681 421 L 629 418 Q 577 415 531 410 L 478 405 Q 375 398 323 385 Q 245 372 188 368 Q 161 367 156 355 Q 153 348 173 335 Q 210 310 246 322 Q 319 346 453 367 Q 463 368 477 369 L 531 375 Z"/><path d="M 472 -11 Q 478 -39 485 -49 Q 491 -56 499 -54 Q 514 -45 523 20 Q 535 123 532 224 Q 529 267 531 375 L 531 410 Q 531 480 534 568 L 534 604 Q 534 671 551 757 Q 555 776 539 787 Q 505 811 487 814 Q 474 820 456 810 Q 446 801 454 789 Q 484 741 484 647 Q 483 622 483 593 L 482 559 Q 481 489 478 405 L 477 369 Q 464 71 472 -11 Z"/><path d="M 739 695 Q 764 670 790 642 Q 802 629 817 628 Q 827 628 833 641 Q 837 654 831 684 Q 825 711 737 741 Q 722 745 716 743 Q 712 739 712 727 Q 715 717 739 695 Z"/></g></g></svg>';
function markHTML(cls, label) { return '<div class="mark' + (cls ? ' ' + cls : '') + '"' + (label ? ' role="img" aria-label="' + label + '"' : ' aria-hidden="true"') + '>' + MARK_SVG + '</div>'; }
