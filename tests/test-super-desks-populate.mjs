/* HARDGATE — super desk populate contract (all SUPER * tabs) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('ok    - ' + m); } else { fail++; console.error('FAIL  - ' + m); } }

const ctx = vm.createContext({
  window: {},
  document: { head: { appendChild: function(){} }, createElement: function(){ return { id: '', textContent: '' }; } }
});
ctx.window = ctx;
ctx.globalThis = ctx;

vm.runInContext(fs.readFileSync(path.join(root, 'super-desk-common.js'), 'utf8'), ctx, { filename: 'super-desk-common.js' });
const W = ctx.window;

ok(typeof W.hgSuperDeskMergeSnap === 'function', 'hgSuperDeskMergeSnap exported');

var kept = W.hgSuperDeskMergeSnap(
  { cands: [{ id: 'a', sym: 'BTC' }], stat: '2 setups' },
  { cands: [], stat: '0 setups — empty tick' },
  { emptyStatPrefixes: ['0 setups'] }
);
ok(kept.cands.length === 1 && kept.stat === '2 setups', 'merge snap keeps populated cands');

const deskFiles = [
  ['super-best.js', ['superBestAfterScan', 'mergePublishSuperBestSnap', 'warmBestSnapInline']],
  ['super-sniper.js', ['superSniperAfterScan', 'mergePublishSuperSniperSnap']],
  ['super-gold.js', ['mergePublishSuperGoldSnap', 'superGoldAfterScan', 'publishSuperGoldSnap']],
  ['super-book.js', ['buildSnapFromBook', 'refreshBook']],
  ['super-calibrate.js', ['superCalibrateReplayFromSwingAudit', 'superCalibrateRun']],
  ['supersetup.js', ['mergePublishSuperSetupSnap', 'superSetupAfterScan', 'superSetupRunScanInner']]
];

deskFiles.forEach(function(pair){
  const src = fs.readFileSync(path.join(root, pair[0]), 'utf8');
  pair[1].forEach(function(needle){
    ok(src.indexOf(needle) >= 0, pair[0] + ' has ' + needle);
  });
});

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
['super-setup', 'super-best', 'super-gold', 'super-sniper', 'super-book', 'super-calibrate'].forEach(function(id){
  ok(html.indexOf("if (t === '" + id + "'") >= 0, 'showTab repaints ' + id);
});

ok(swCacheOk(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'sw cache ' + HG_VER);

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
