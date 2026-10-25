/* ===== Practice: speaking =====
   Read a sentence from the lessons aloud.  The browser's speech recognition turns the voice into text and Core.speakCompare
   marks which characters were heard.  It checks that the right words came out, not tones or sounds, and only appears in
   browsers that have speech recognition. */
var SPREC = window.SpeechRecognition || window.webkitSpeechRecognition || null, spRec = null;
var spEmbedded = false, spDenied = false;           // inside another page (such as a chat window) the host decides about the microphone
function speakOk() {
  if (!SPREC || window.ShufangAndroid || (spEmbedded && spDenied)) return false;
  var pp = document.permissionsPolicy || document.featurePolicy;           // a page embedded without microphone access cannot use it
  try { if (pp && pp.allowsFeature && !pp.allowsFeature('microphone')) return false; } catch (e) { /* ignore */ }
  return true;
}
function spAccepted() { try { return localStorage.getItem('shufang.speakok') === '1'; } catch (e) { return false; } }
function spAccept() { try { localStorage.setItem('shufang.speakok', '1'); } catch (e) { /* ignore */ } }
function spStop() { if (spRec) { var r = spRec; spRec = null; r.onresult = r.onerror = r.onend = r.onstart = r.onaudiostart = r.onspeechend = null; try { r.abort(); } catch (e) { /* ignore */ } } spFinish = null; }

function speakStart() {
  var lv = Math.max(uLevel(), 1) + 1, pool = [];
  LESSONS.forEach(function (L) {
    if (L.level > lv || L.type === 'poem' || L.type === 'classic') return;
    L.sents.forEach(function (s) {
      var txt = sentText(s), n = Array.from(txt).filter(function (ch) { return C.CJK.test(ch); }).length;
      if (n < 4 || n > 14 || !s.en) return;
      for (var i = 0; i < s.t.length; i++) { var t = s.t[i]; if (t.h && t.lv > lv) return; }
      pool.push({ t: s.t, zh: txt, en: s.en, py: null });
    });
  });
  if (pool.length < 8) { toast('Not enough sentences at your level yet'); return; }
  var qs = C.shuffle(pool, 'spk' + now()).slice(0, 8);
  startSession({ kind: 'speak', qs: qs, i: 0, st: spAccepted() ? 'idle' : 'notice', res: null, tries: 0, score: 0, msg: '' });
}
function speakView() {
  var s = ses;
  if (s.i >= s.qs.length) return resultView('Speaking', s.score + '/' + s.qs.length, s.score >= 7 ? 'Clear and confident.' : s.score >= 4 ? 'Good. Say them slowly and clearly if one is missed.' : 'Keep going. Speak a little slower and closer to the microphone.', 'speak-start');
  if (s.st === 'notice') {
    return sessHead(0, '') + '<div class="qcard"><div class="ti" style="width:54px;height:54px;border-radius:16px;display:grid;place-items:center;margin:0 auto 10px;background:var(--accent-soft);color:var(--accent)">' + icon('mic') + '</div>' +
      '<h2 style="font:750 20px var(--f-ui);letter-spacing:-.02em">Before you speak</h2>' +
      '<p class="muted mt8">This uses your browser’s speech recognition to turn your voice into text. Depending on the browser, the recording may be sent to the browser’s maker to do that (Chrome sends it to Google). Shufang itself records and keeps nothing.</p>' +
      '<p class="muted mt8">It checks that the right words were heard. It does not grade your tones.</p></div>' +
      '<div class="actions"><button class="btn pri" data-act="sok">Continue</button><button class="btn" data-act="end">Not now</button></div>';
  }
  var q = s.qs[s.i], out = sessHead(s.i / s.qs.length, (s.i + 1) + '/' + s.qs.length), r = s.res, line;
  if (r && s.st === 'result') {
    var k = 0;
    line = '<span class="zq" lang="' + lang() + '">' + q.t.map(function (t) {
      var txt = t.h ? tokSc(t) : t.p;
      return Array.from(txt).map(function (ch) {
        if (!C.CJK.test(ch)) return esc(ch);
        var ok = r.marks[k++];
        return '<span class="' + (ok ? 'sp-ok' : 'sp-no') + '">' + esc(ch) + '</span>';
      }).join('');
    }).join('') + '</span>';
  } else line = zhRuby(q.t);
  out += '<div class="qcard"><div class="spk-line">' + line + '</div><p class="muted mt8">' + esc(q.en) + '</p>' +
    (hasVoice() ? '<button class="btn sm mt8" data-act="spsay">' + icon('say', 'sm') + ' Listen</button>' : '') + '</div>';
  if (s.st === 'result') {
    var pass = r.ok;
    out += '<p class="center mt12" style="font-weight:650;color:var(--' + (pass ? 'good' : 'bad') + ')">' + (pass ? (r.score >= 0.99 ? 'Well said' : 'Good') : (r.heard ? 'Not quite. Red characters were not heard.' : 'Nothing recognised.')) + '</p>' +
      (r.heard && !pass ? '<p class="small muted center mt8">Heard: <span class="zh" lang="' + lang() + '">' + esc(r.heard) + '</span></p>' : '') +
      '<div class="actions">' + (pass ? '' : '<button class="btn' + (s.tries >= 2 ? '' : ' pri') + '" data-act="smic">Try again</button>') + '<button class="btn' + (pass || s.tries >= 2 ? ' pri' : '') + '" data-act="snext">' + (s.i + 1 >= s.qs.length ? 'See result' : 'Next') + '</button></div>';
  } else {
    out += '<div class="center mt16"><button class="micbtn' + (s.st === 'listen' ? ' on' : '') + '" data-act="smic" aria-label="' + (s.st === 'listen' ? 'Stop listening' : 'Speak') + '">' + icon('mic') + '</button>' +
      '<p class="hint mt8">' + (s.st === 'listen' ? 'Listening… tap to stop' : (s.msg ? esc(s.msg) : 'Tap, then read the sentence aloud')) + '</p></div>' +
      '<p class="center mt12"><button class="btn ghost sm" data-act="snext">Skip</button></p>';
  }
  return out;
}
var spFinish = null;
function speakMic() {
  var s = ses;
  if (!s || s.kind !== 'speak') return;
  if (s.st === 'listen') {                           // Stop: ask the recogniser to finish, and end the turn anyway if it does not
    if (spRec) { try { spRec.stop(); } catch (e) { /* ignore */ } }
    setTimeout(function () { if (spFinish) spFinish(); }, 1200);
    return;
  }
  stopSpeech(); spStop();
  var qi = s.i, got = null, err = '', rec, finished = false, started = false, tMax, tStart, tEnd;
  try { rec = new SPREC(); } catch (e) { s.st = 'idle'; s.msg = 'Speech recognition could not start in this browser.'; render(); return; }
  rec.lang = 'zh-CN'; rec.interimResults = false; rec.continuous = false; rec.maxAlternatives = 5;
  function finish() {                                // runs once, whether the recogniser ended, failed or never answered
    if (finished) return;
    finished = true; clearTimeout(tMax); clearTimeout(tStart); clearTimeout(tEnd);
    if (spFinish === finish) spFinish = null;
    if (spRec === rec) { spRec = null; rec.onresult = rec.onerror = rec.onend = rec.onstart = rec.onaudiostart = rec.onspeechend = null; try { rec.abort(); } catch (e) { /* ignore */ } }
    if (!ses || ses.kind !== 'speak' || ses.i !== qi) return;
    if (got) {
      var r = C.speakCompare(ses.qs[qi].zh, got);
      ses.res = r; ses.st = 'result'; ses.tries++; ses.msg = '';
      if (r.ok) { if (ses.tries === 1) ses.score++; todayRow().ex++; save(); }
    } else {
      ses.st = 'idle';
      try { spEmbedded = window.top !== window.self; } catch (e) { spEmbedded = true; }
      if (err === 'not-allowed' || err === 'service-not-allowed') spDenied = true;
      ses.msg = (err === 'not-allowed' || err === 'service-not-allowed') && spEmbedded ? 'The microphone is blocked here, because this page is shown inside another app. Open Shufang in its own browser tab to speak.' :
        err === 'not-allowed' || err === 'service-not-allowed' ? 'The microphone is blocked. Allow it for this site in your browser’s settings, then tap again.' :
        err === 'audio-capture' ? 'No microphone was found.' :
        err === 'network' ? 'Speech recognition needs an internet connection.' :
        err === 'language-not-supported' ? 'This browser has no Chinese speech recognition.' :
        err === 'start-timeout' ? 'The microphone did not start. Check that this site may use it, then tap again.' :
        'I did not hear anything. Tap and try again.';
    }
    render();
  }
  function wind() { try { rec.stop(); } catch (e) { /* ignore */ } clearTimeout(tEnd); tEnd = setTimeout(finish, 2500); }
  rec.onresult = function (ev) {
    var alts = [], res = ev.results && ev.results[ev.results.length - 1];
    if (res) for (var i = 0; i < res.length; i++) alts.push(res[i].transcript);
    if (alts.length) got = alts;
    wind();                                          // one answer is enough
  };
  rec.onerror = function (ev) { err = ev && ev.error || 'error'; if (err !== 'no-speech' && err !== 'aborted') finish(); };
  rec.onstart = rec.onaudiostart = function () { started = true; clearTimeout(tStart); };
  rec.onspeechend = wind;
  rec.onend = finish;
  spRec = rec; spFinish = finish; s.st = 'listen'; s.msg = '';
  tMax = setTimeout(wind, 12000);                    // never listen for ever
  tStart = setTimeout(function () { if (!started && !got) { err = err || 'start-timeout'; finish(); } }, 15000);
  try { rec.start(); } catch (e) { spRec = null; spFinish = null; clearTimeout(tMax); clearTimeout(tStart); s.st = 'idle'; s.msg = 'Speech recognition could not start. Tap again.'; }
  render();
}
function speakNext() {
  var s = ses; spStop();
  s.i++; s.st = 'idle'; s.res = null; s.tries = 0; s.msg = '';
  render(); window.scrollTo(0, 0);
}
