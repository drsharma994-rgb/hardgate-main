/* HARDGATE — futuristic theme smoke tests (ui-ux-pro-max design system). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== futuristic theme ==');
{
  const bright = fs.readFileSync(path.join(root, 'bright.css'), 'utf8');
  ok(bright.indexOf('#020617') >= 0, 'dark background token');
  ok(bright.indexOf('Orbitron') >= 0, 'Orbitron display font referenced');
  ok(bright.indexOf('backdrop-filter') >= 0, 'glass header blur');
  ok(bright.indexOf('#22D3EE') >= 0 || bright.indexOf('#38BDF8') >= 0, 'cyan neon accent');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(html.indexOf('JetBrains+Mono') >= 0, 'JetBrains Mono font link');
  ok(html.indexOf('--ink:#020617') >= 0, 'inline :root dark tokens');
  ok(fs.existsSync(path.join(root, 'design-system/hardgate/MASTER.md')), 'design system MASTER persisted');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v237/.test(sw), 'cache hg-v237');
}

console.log('\n' + pass + ' passed');
