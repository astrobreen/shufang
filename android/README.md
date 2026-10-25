# Shufang for Android

A thin native shell (a WebView) around the same app as the website. Lessons, vocabulary, idioms, stroke data and the app
itself are packaged inside the APK, so it **works offline** and nothing is sent anywhere: other hosts are blocked.
Reading aloud uses the phone's own text-to-speech engine.

* Android 8.0 or newer (minSdk 26), target SDK 34.
* Progress is stored on the phone. **Uninstalling the app erases it**, so use *Me → Save file* first if you want a backup.

## Getting the APK (no Android Studio needed)

1. Push this repository to GitHub.
2. **Actions → "Android APK" → latest run → Artifacts → Shufang-apk**, download and unzip `Shufang.apk`.
3. To get a link you can send to a friend: `git tag v1.0 && git push origin v1.0`. The workflow then publishes a **Release**
   with the APK attached.

The workflow (`.github/workflows/android.yml`) builds with JDK 17 and Gradle 8.9 and signs the APK with `keystore/shufang.jks`.

## Installing

Open the APK on the phone and allow "Install unknown apps" for the app you opened it from (Files, Chrome, WhatsApp…).
A "may be harmful" warning is normal for any app that does not come from the Play Store.

## Reading aloud

The app needs a **Chinese (Mandarin) voice** on the phone. Most phones have one through *Speech Recognition & Synthesis by
Google*. If *Me → Voice* says no Chinese voice was found: Android Settings → System → Languages → Text-to-speech → install
Chinese (Mandarin) voice data.

## The signing key

`keystore/shufang.jks` (password `shufang-sideload`) is committed on purpose: it is a sideload-only key and protects nothing
of value. **Keep using the same file** — Android refuses to update an installed app that was signed with a different key.
For a Play Store release, create a private key and keep it out of Git.

## Building locally

```
cd android && ./gradlew assembleRelease     # needs JDK 17 and the Android SDK
```

The app bundles the `site/` folder as its assets, so rebuild the site first with `python3 tools/make.py --no-data`
(CI fails if `site/` is out of date).

## Checks run without a device

`npm run test:smoke` includes `tests/android.test.js`, which serves the site exactly as `MainActivity` does (assets only,
other hosts refused), with a mock of the native bridge for saving backups, the back button and text-to-speech.
