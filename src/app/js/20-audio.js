/* ===== speech ===== */
/* In the Android app the phone's own text-to-speech engine is used through the ShufangAndroid bridge (the WebView has no reliable
   speechSynthesis).  Events come back through window.__tts(id, 'start' | 'boundary' | 'end' | 'error', charIndex). */
var NATIVE_TTS = !!(window.ShufangAndroid && typeof window.ShufangAndroid.ttsSpeak === 'function');
var tts = { ok: NATIVE_TTS || ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window), native: NATIVE_TTS, voices: [], tok: 0, warned: false, cb: null };
function nativeVoice() { try { return !!window.ShufangAndroid.ttsAvailable(); } catch (e) { return false; } }
window.__tts = function (id, ev, n) {
  if (String(tts.tok) !== String(id) || !tts.cb) return;
  var o = tts.cb;
  if (ev === 'start' && o.onstart) o.onstart();
  else if (ev === 'boundary' && o.onboundary) o.onboundary({ charIndex: n, name: 'word' });
  else if (ev === 'end') { tts.cb = null; if (o.onend) o.onend(); }
  else if (ev === 'error') { tts.cb = null; if (o.onerror) o.onerror({}); }
};
function loadVoices() {
  if (!tts.ok || tts.native) return;
  try { tts.voices = speechSynthesis.getVoices().filter(function (v) { return /^(zh|cmn|yue)/i.test(String(v.lang).replace('_', '-')); }); } catch (e) { tts.voices = []; }
}
if (tts.ok) { loadVoices(); try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { /* ignore */ } }
function pickVoice() {
  if (tts.native) return nativeVoice() ? { lang: S.set.script === 'trad' ? 'zh-TW' : 'zh-CN', native: true } : null;
  var v = tts.voices;
  if (!v.length) return null;
  if (S.set.voice) { var f = v.find(function (x) { return x.voiceURI === S.set.voice; }); if (f) return f; }
  var want = S.set.script === 'trad' ? /(TW|HK|Hant)/i : /(CN|Hans)/i;
  return v.find(function (x) { return want.test(x.lang); }) || v[0];
}
function hasVoice() { if (tts.native) return nativeVoice(); loadVoices(); return tts.ok && tts.voices.length > 0; }
function stopSpeech() {
  tts.tok++; tts.cb = null;
  if (tts.native) { try { window.ShufangAndroid.ttsStop(); } catch (e) { /* ignore */ } return; }
  if (tts.ok) { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } } }
function speak(text, o) {
  o = o || {};
  if (!tts.ok) { toast('Audio is not supported in this browser.'); return false; }
  loadVoices();
  var v = pickVoice();
  if (!v) {
    if (!tts.warned) { tts.warned = true; toast('No Chinese voice found. Add one in your device’s text-to-speech settings.'); }
    return false;
  }
  if (tts.native) {
    var id = ++tts.tok; tts.cb = o;
    try { window.ShufangAndroid.ttsSpeak(String(id), String(text), o.rate || S.set.rate, o.pitch || 1, v.lang); } catch (e) { tts.cb = null; return false; }
    return true;
  }
  try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  var my = ++tts.tok;
  setTimeout(function () {
    if (my !== tts.tok) return;
    var u = new SpeechSynthesisUtterance(text);
    u.lang = v.lang; u.voice = v; u.rate = o.rate || S.set.rate; u.pitch = o.pitch || 1;
    if (o.onstart) u.onstart = function () { if (my === tts.tok) o.onstart(); };
    if (o.onboundary) u.onboundary = function (e) { if (my === tts.tok) o.onboundary(e); };
    u.onend = function () { if (my === tts.tok && o.onend) o.onend(); };
    u.onerror = function (e) { if (my === tts.tok && o.onerror) o.onerror(e); };
    try { speechSynthesis.speak(u); } catch (e) { if (o.onerror) o.onerror(e); }
  }, 40);
  return true;
}
