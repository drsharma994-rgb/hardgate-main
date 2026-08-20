/* HARDGATE — phone viewing contract (mobile.css + viewport + header drawer). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'mobile.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

console.log('== viewport ==');
{
  const m = /<meta name="viewport" content="([^"]+)">/.exec(html);
  ok(!!m, 'viewport meta exists');
  ok(/width=device-width/.test(m[1]), 'width=device-width');
  ok(/viewport-fit=cover/.test(m[1]), 'viewport-fit=cover so safe-area insets apply');
  ok(!/user-scalable\s*=\s*no/i.test(m[1]) && !/maximum-scale\s*=\s*1/.test(m[1]),
     'does not disable pinch-zoom');
}

console.log('== shell wiring ==');
{
  const iBright = html.indexOf('href="bright.css"');
  const iMobile = html.indexOf('href="mobile.css"');
  ok(iBright > 0 && iMobile > iBright, 'mobile.css loads after bright.css');
  ok(/id="headerMenuBtn"/.test(html), 'hamburger exists');
  ok(/aria-label="/.test(html.match(/id="headerMenuBtn"[^>]*>/)[0]),
     'hamburger has an accessible name');
  ok(/function toggleHeaderDrawer\(/.test(html), 'drawer toggle is wired');
  ok(sw.indexOf("'./mobile.css'") >= 0, 'sw precaches mobile.css');
  ok(swCacheOk(sw), 'cache matches build stamp');
}

console.log('== phone layout (≤860px) ==');
{
  ok(/overflow-x:\s*clip/.test(css), 'page clips horizontal overflow instead of sideways scroll');
  ok(/safe-area-inset/.test(css), 'notch / home-indicator insets');
  ok(/header-phone-grid/.test(css), 'named phone header grid (brand + menu, then exchange)');
  ok(/min-height:\s*44px/.test(css), '44px tap targets');
  ok(/grid-template-columns:\s*1fr/.test(css) && /\.cards\{[^}]*1fr/.test(css.replace(/\s+/g, '')),
     'setup cards stack to one column');
  ok(!/table\{display:block\}/.test(css.replace(/\s+/g, '')),
     'tables stay tables (scroll the panel, do not flatten thead)');
  ok(/max-width:\s*100%\s*!important/.test(css), 'inline-width inputs cannot blow past the viewport');
  ok(/font-size:\s*16px/.test(css), '16px inputs so iOS does not zoom on focus');
}

console.log('== small phones (≤480px) ==');
{
  const small = css.split('@media (max-width: 480px)')[1] || '';
  ok(small.length > 40, 'small-phone breakpoint exists');
  ok(!/font-size:\s*[7-9]px/.test(small), 'no sub-10px type on small phones');
}

console.log('\n' + pass + ' passed');
