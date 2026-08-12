/* HARDGATE — annunciator design tokens (opt-in CSS). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== annunciator.css ==');
{
  const css = fs.readFileSync(path.join(root, 'annunciator.css'), 'utf8');
  ok(css.indexOf('--hg-lamp-amber') >= 0, 'lamp tokens defined');
  ok(css.indexOf('.hg-lamp--veto') >= 0, 'veto lamp class');
  ok(css.indexOf('.hg-lamp--pass') >= 0, 'pass lamp class');
  ok(css.indexOf('tabular-nums') >= 0, 'tabular nums on hg-num');
  ok(css.indexOf('@keyframes hg-annunciate') >= 0, 'trip animation');
}

console.log('== index wiring ==');
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(html.indexOf('annunciator.css') >= 0, 'annunciator.css linked');
  ok(html.indexOf('fonts.gstatic.com') >= 0, 'gstatic preconnect');
  ok(html.indexOf('Inter') >= 0, 'Inter font (base-themes data-dense)');
}

console.log('== CSP fonts ==');
{
  const server = fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8');
  ok(server.indexOf('font-src') >= 0 && server.indexOf('fonts.gstatic.com') >= 0, 'server font-src');
  const vercel = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
  ok(vercel.indexOf('fonts.googleapis.com') >= 0, 'vercel style-src fonts');
}

console.log('== cache ==');
{
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v267/.test(sw), 'cache hg-v267');
  ok(sw.indexOf('annunciator.css') >= 0, 'sw precaches annunciator.css');
}

console.log('\n' + pass + ' passed');
