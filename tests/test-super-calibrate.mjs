/* HARDGATE — super-calibrate.js unit tests */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ window: {}, document: { head: { appendChild: function(){} } } });
ctx.window = ctx;
ctx.globalThis = ctx;

vm.runInContext(fs.readFileSync(path.join(root, 'super-desk-common.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'super-calibrate.js'), 'utf8'), ctx);
const W = ctx.window;

let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('ok    - ' + m); } else { fail++; console.error('FAIL  - ' + m); } }

W.hgFunnelPanelHTML = function(title, rows, id){
  return '<div id="' + id + '">' + title + ':' + rows.length + '</div>';
};

ok(typeof W.superCalibrateBuildPanel === 'function', 'buildPanel exported');

const samples = [
  { pass: { G1: true, G2: true }, r: 1.2 },
  { pass: { G1: true, G2: false }, r: -0.5 },
  { pass: { G1: true, G2: true }, r: 0.8 }
];
const sum = W.superCalibrateSummarize(samples);
ok(sum.clean === 2 && sum.settled === 3, 'summarize clean/settled');

const panel = W.superCalibrateBuildPanel(
  { samples: [{ pass: { G1: true, G2: true }, r: 1.0 }] },
  W.superCalibrateSummarize([{ pass: { G1: true, G2: true }, r: 1.0 }]),
  1,
  'test'
);
ok(typeof panel === 'string' && panel.length > 20, 'buildPanel returns html');

ok(new RegExp('super-calibrate\\.js\\?v=' + HG_VER.replace('hg-v', '')).test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')), 'index wired');
ok(swCacheOk(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'sw ' + HG_VER);

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
