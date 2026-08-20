# HARDGATE Android

This is a **launcher**, not a rewrite. The APK opens the live desk at
https://hardgate-main.onrender.com in a full-screen WebView (JavaScript on,
HTTPS only, no browser chrome). A Render deploy is the next launch — you
do not rebuild the APK for `hg-vN` stamps.

## Install (sideload)

1. GitHub → Actions → **Android APK** → *Run workflow* (or wait for a
   push that touches `android/`).
2. Download the `hardgate-android-debug` artifact (`app-debug.apk`).
3. On the phone: allow install from this source, open the APK.
4. Package id is `app.hardgate.desk.debug` for the debug build.

Chrome can also **Install app** / Add to Home screen from the live site
once the 192×192 and 512×512 PNG icons are on the deployed origin.

## Build locally

Need JDK 17+ and Android SDK (compileSdk 35):

```bash
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties
gradle assembleDebug     # or ./gradlew if you generate a wrapper
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

Do **not** commit a keystore. Release / Play signing stays on the machine
that owns the upload key.

## What this is not

- Not a Play Store listing (no listing, no Play App Signing).
- Not an offline copy of the scanners (market data still needs the network
  and `/api/proxy` on Render).
- Not a Kotlin port of SWING / OMNIROUTE / gold engines.
