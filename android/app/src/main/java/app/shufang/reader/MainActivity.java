package app.shufang.reader;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;

/**
 * Shows the Shufang web app (the site/ folder, bundled in the APK's assets) full screen in a WebView.
 *
 * Everything is served from https://appassets.androidplatform.net/ by shouldInterceptRequest, so the page has a real
 * https origin (fetch, localStorage and speech synthesis all behave as in a browser) and no network access is needed.
 * Requests to any other host are blocked.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/index.html";
    private static final int REQ_PICK = 1;
    private static final int REQ_SAVE = 2;

    private WebView web;
    private ValueCallback<Uri[]> chooser;
    private String pendingText;
    private TextToSpeech tts;
    private volatile boolean ttsReady;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(Color.TRANSPARENT);          // the window background (set by the theme) shows until the page paints
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                         // localStorage: where the app keeps progress
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setUserAgentString(s.getUserAgentString() + " ShufangApp/1.0");

        web.addJavascriptInterface(new Bridge(), "ShufangAndroid");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        // the phone's own text-to-speech engine (the WebView has no dependable speechSynthesis)
        tts = new TextToSpeech(getApplicationContext(), new TextToSpeech.OnInitListener() {
            @Override public void onInit(int status) {
                if (status == TextToSpeech.SUCCESS) {
                    tts.setOnUtteranceProgressListener(progress);
                    ttsReady = true;
                }
            }
        });

        if (state == null || web.restoreState(state) == null) {
            web.loadUrl(HOME);
        }
    }

    // speech events go back to the page as window.__tts(id, event, charIndex)
    private final UtteranceProgressListener progress = new UtteranceProgressListener() {
        @Override public void onStart(String id) { emit(id, "start", -1); }
        @Override public void onDone(String id) { emit(id, "end", -1); }
        @Override public void onError(String id) { emit(id, "error", -1); }
        @Override public void onRangeStart(String id, int start, int end, int frame) { emit(id, "boundary", start); }
        @Override public void onStop(String id, boolean interrupted) { /* replaced by a newer utterance: nothing to report */ }
    };

    private void emit(String id, String event, int index) {
        if (id == null || !id.matches("\\d{1,9}")) return;
        final String js = "window.__tts&&window.__tts('" + id + "','" + event + "'," + index + ")";
        runOnUiThread(new Runnable() {
            @Override public void run() { if (web != null) web.evaluateJavascript(js, null); }
        });
    }

    // ---- assets served as https://appassets.androidplatform.net/...
    private static String mimeOf(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".webmanifest")) return "application/manifest+json";
        if (p.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    private static boolean isText(String mime) {
        return mime.startsWith("text/") || mime.contains("json") || mime.contains("javascript") || mime.contains("svg") || mime.contains("manifest");
    }

    private static WebResourceResponse status(int code, String reason) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason, new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    private class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            String scheme = u.getScheme();
            if (!"https".equals(scheme) && !"http".equals(scheme)) return null;          // data:, blob: and the like are handled by the WebView itself
            if (!"https".equals(scheme) || !HOST.equals(u.getHost())) return status(403, "Blocked");   // the app never talks to the network
            String path = u.getPath();
            if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
            if (path.contains("..")) return status(404, "Not Found");
            String asset = path.substring(1);
            try {
                InputStream in = getAssets().open(asset);
                String mime = mimeOf(asset);
                return new WebResourceResponse(mime, isText(mime) ? "utf-8" : null, 200, "OK", new HashMap<String, String>(), in);
            } catch (IOException e) {
                return status(404, "Not Found");
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, u));
            } catch (Exception ignored) {
                // no app can open it
            }
            return true;
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // the WebView process was killed (low memory): rebuild the screen instead of crashing
            runOnUiThread(new Runnable() {
                @Override public void run() { recreate(); }
            });
            return true;
        }
    }

    private class Chrome extends WebChromeClient {
        // <input type="file">: used to import a backup
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (chooser != null) chooser.onReceiveValue(null);
            chooser = callback;
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("*/*");
            try {
                startActivityForResult(Intent.createChooser(pick, "Choose a backup file"), REQ_PICK);
            } catch (ActivityNotFoundException e) {
                chooser = null;
                callback.onReceiveValue(null);
            }
            return true;
        }
    }

    private boolean hasLanguage(Locale locale) {
        return ttsReady && tts.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE;
    }

    // called from the page as ShufangAndroid.saveFile(name, text) and ShufangAndroid.tts...()
    private class Bridge {
        @JavascriptInterface
        public boolean ttsAvailable() {
            return hasLanguage(Locale.SIMPLIFIED_CHINESE) || hasLanguage(Locale.TRADITIONAL_CHINESE);
        }

        @JavascriptInterface
        public void ttsSpeak(String id, String text, double rate, double pitch, String lang) {
            if (!ttsReady || id == null || !id.matches("\\d{1,9}") || text == null) return;
            Locale locale = "zh-TW".equals(lang) && hasLanguage(Locale.TRADITIONAL_CHINESE) ? Locale.TRADITIONAL_CHINESE : Locale.SIMPLIFIED_CHINESE;
            if (!hasLanguage(locale)) { emit(id, "error", -1); return; }
            if (text.length() > 3900) text = text.substring(0, 3900);
            tts.setLanguage(locale);
            tts.setSpeechRate((float) Math.max(0.3, Math.min(3.0, rate)));
            tts.setPitch((float) Math.max(0.5, Math.min(2.0, pitch)));
            if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) emit(id, "error", -1);
        }

        @JavascriptInterface
        public void ttsStop() {
            if (ttsReady) tts.stop();
        }

        @JavascriptInterface
        public void saveFile(final String name, final String text) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    pendingText = text;
                    Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    create.addCategory(Intent.CATEGORY_OPENABLE);
                    create.setType("application/json");
                    create.putExtra(Intent.EXTRA_TITLE, name);
                    try {
                        startActivityForResult(create, REQ_SAVE);
                    } catch (ActivityNotFoundException e) {
                        pendingText = null;
                        Toast.makeText(MainActivity.this, "Could not open the save dialog. Use Copy instead.", Toast.LENGTH_LONG).show();
                    }
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        if (request == REQ_PICK) {
            if (chooser != null) {
                Uri[] picked = result == RESULT_OK ? WebChromeClient.FileChooserParams.parseResult(result, data) : null;
                chooser.onReceiveValue(picked);
                chooser = null;
            }
            return;
        }
        if (request == REQ_SAVE) {
            String text = pendingText;
            pendingText = null;
            if (result != RESULT_OK || data == null || data.getData() == null || text == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                out.write(text.getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this, "Backup saved", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Could not save the file", Toast.LENGTH_LONG).show();
            }
            return;
        }
        super.onActivityResult(request, result, data);
    }

    // the back button first closes whatever is open in the app (sheet, lesson, drill, tab), and only then leaves
    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
                "(function(){try{return window.__androidBack?window.__androidBack():false;}catch(e){return false;}})()",
                new ValueCallback<String>() {
                    @Override public void onReceiveValue(String value) {
                        if (!"true".equals(value)) MainActivity.super.onBackPressed();
                    }
                });
    }

    @Override
    protected void onPause() {
        if (ttsReady) tts.stop();                                                    // stop reading aloud when the app is left
        web.evaluateJavascript("try{speechSynthesis.cancel()}catch(e){}", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (web != null) {
            ViewGroup parent = (ViewGroup) web.getParent();
            if (parent != null) parent.removeView(web);
            web.destroy();
        }
        super.onDestroy();
    }
}
