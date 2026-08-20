/* HARDGATE — Android app is a thin WebView over the live desk.

   Not a Kotlin rewrite. The SPA stays the product. The APK is a launcher:
   home-screen icon, no browser chrome, JavaScript on, live
   https://hardgate-main.onrender.com so a desk deploy does not need a new APK.

   Guardrails: HTTPS only, no JavascriptInterface bridge (no Android↔JS
   secret channel), no file://, no committed keystore.

   Also: Chrome "Install app" needs 192 + 512 PNG icons in the web manifest.

   Run: node tests/test-android-app.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));
const isPng = (f) => {
  const buf = fs.readFileSync(path.join(ROOT, f));
  return buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
};

const JAVA = 'android/app/src/main/java/app/hardgate/desk/MainActivity.java';
const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const APP_GRADLE = 'android/app/build.gradle';
const WF = '.github/workflows/android.yml';

console.log('== Android project ==');
{
  ok(exists(JAVA), 'MainActivity.java exists');
  ok(exists(MANIFEST), 'AndroidManifest.xml exists');
  ok(exists(APP_GRADLE), 'app/build.gradle exists');
  ok(exists('android/settings.gradle'), 'settings.gradle exists');
  ok(exists(WF), 'GitHub Action builds the APK');
}

const java = exists(JAVA) ? read(JAVA) : '';
const am = exists(MANIFEST) ? read(MANIFEST) : '';
const gradle = exists(APP_GRADLE) ? read(APP_GRADLE) : '';
const wf = exists(WF) ? read(WF) : '';

console.log('== it is a launcher over the live desk, not a rewrite ==');
{
  ok(/hardgate-main\.onrender\.com/.test(java) || /HARDGATE_URL/.test(java),
     'WebView loads the live HARDGATE origin');
  ok(/setJavaScriptEnabled\(\s*true\s*\)/.test(java), 'JavaScript is enabled (the SPA needs it)');
  ok(/canGoBack\(/.test(java) && /goBack\(/.test(java), 'hardware back walks WebView history');
  ok(!/addJavascriptInterface/.test(java), 'no JavascriptInterface bridge');
  ok(/setAllowFileAccess\(\s*false\s*\)/.test(java), 'file:// access is off');
  ok(/MIXED_CONTENT_NEVER_ALLOW/.test(java) || /setMixedContentMode/.test(java),
     'mixed content is refused');
}

console.log('== AndroidManifest ==');
{
  ok(/android\.permission\.INTERNET/.test(am), 'INTERNET permission (the desk is online)');
  ok(/usesCleartextTraffic="false"/.test(am) || !/usesCleartextTraffic="true"/.test(am),
     'cleartext HTTP is not enabled');
  ok(/app\.hardgate\.desk/.test(am + gradle), 'applicationId / package is app.hardgate.desk');
  ok(/HARDGATE/.test(am) || exists('android/app/src/main/res/values/strings.xml'),
     'app is named HARDGATE');
}

console.log('== no secrets in the APK tree ==');
{
  const walk = (dir, acc) => {
    if (!fs.existsSync(dir)) return acc;
    for (const name of fs.readdirSync(dir)){
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()){
        if (name === 'build' || name === '.gradle') continue;
        walk(p, acc);
      } else acc.push(p);
    }
    return acc;
  };
  const files = walk(path.join(ROOT, 'android'), []);
  const secretHit = files.filter(f => /\.(jks|keystore|p12)$/i.test(f));
  ok(secretHit.length === 0, 'no keystore committed');
  const blob = files.filter(f => /\.(xml|java|gradle|properties|kts)$/.test(f))
    .map(f => fs.readFileSync(f, 'utf8')).join('\n');
  ok(!/TELEGRAM_TOKEN|EXECUTE_CCXT_API_KEY|HARDGATE_API_SECRET|BEGIN RSA PRIVATE/.test(blob),
     'no trading/API secrets in android sources');
}

console.log('== CI builds a sideload APK ==');
{
  ok(/assembleDebug/.test(wf), 'workflow runs assembleDebug');
  ok(/upload-artifact|actions\/upload-artifact/.test(wf), 'workflow uploads the APK');
  ok(/workflow_dispatch/.test(wf), 'APK can be built on demand');
}

console.log('== Chrome install icons ==');
{
  const man = JSON.parse(read('manifest.webmanifest'));
  const pngs = (man.icons || []).filter(ic => ic && /image\/png/.test(ic.type || '') || /\.png$/i.test(ic.src || ''));
  ok(pngs.some(ic => String(ic.sizes || '').indexOf('192x192') >= 0), 'manifest has 192 PNG');
  ok(pngs.some(ic => String(ic.sizes || '').indexOf('512x512') >= 0), 'manifest has 512 PNG');
  ok(exists('icon-192.png') && isPng('icon-192.png'), 'icon-192.png is a real PNG');
  ok(exists('icon-512.png') && isPng('icon-512.png'), 'icon-512.png is a real PNG');
  ok(exists('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png')
     && isPng('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'),
     'xxxhdpi launcher icon is a real PNG');
}

console.log('== cache stamp ==');
{
  ok(swCacheOk(read('sw.js')), 'cache matches build stamp');
}

console.log('\n' + passed + ' passed');
