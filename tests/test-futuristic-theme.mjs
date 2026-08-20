/* HARDGATE — light theme smoke tests (markbang/base-themes data-dense). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== light theme (base-themes data-dense) ==');
{
  const bright = fs.readFileSync(path.join(root, 'bright.css'), 'utf8');
  const tokens = fs.readFileSync(path.join(root, 'vendor/base-themes/tokens-data-dense-light.css'), 'utf8');
  ok(bright.indexOf('#f4f6f9') >= 0, 'light background token');
  ok(!/backdrop-filter\s*:\s*blur/.test(bright), 'bright.css avoids heavy backdrop blur');
  ok(/hgColorWash/.test(bright), 'page keeps a named color wash (not a gray slab)');
  ok(/hgAccentBar/.test(bright), 'header carries a named multi-hue accent bar');
  ok(/card\.long/.test(bright) && /rgba\(21,128,61/.test(bright),
     'LONG cards keep a green tint, not color-only borders');
  ok(/card\.short/.test(bright) && /rgba\(220,38,38/.test(bright),
     'SHORT cards keep a red tint');
  ok(/#fffbeb|#fef3c7|#fff7ed/.test(bright), 'GOLD setup cards sit on a warm cream wash');
  ok(/prefers-reduced-motion/.test(bright), 'color motion still yields to reduced-motion');
  ok(tokens.indexOf("data-style='data-dense'") >= 0, 'vendor tokens scoped to data-dense light');
  ok(fs.existsSync(path.join(root, 'hg-icons.css')), 'hg-icons.css present');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(html.indexOf('data-style="data-dense"') >= 0 && html.indexOf('data-theme="light"') >= 0,
    'html shell uses data-dense + light');
  ok(html.indexOf('--ink:#f4f6f9') >= 0, 'inline :root light tokens');
  ok(html.indexOf('class="hg-ico"') >= 0, 'header uses SVG icons not emoji');
  ok(html.indexOf('vendor/base-themes/tokens-data-dense-light.css') >= 0, 'vendor theme linked');
  ok(fs.existsSync(path.join(root, 'vendor/base-themes/README.md')), 'base-themes attribution README');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(swCacheOk(sw), 'cache matches build stamp');
  ok(sw.indexOf('hg-icons.css') >= 0, 'sw precaches hg-icons.css');
}

console.log('\n' + pass + ' passed');
