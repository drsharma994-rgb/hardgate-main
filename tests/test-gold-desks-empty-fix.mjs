/* HARDGATE — gold desks must not paint blank after a scan finishes.
   OMNIGOLD: MOST PROBABLE + GOLD ENGINES paint before/despite a hung bridge.
   GOLD SCALP/SWING: keep last cards while rescanning; Asia honesty in WHY SILENT.
   GOLD SCALP: Asia demotes via hardReject:false (cards still paint).

   Run: node tests/test-gold-desks-empty-fix.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp (' + HG_VER + ')');
ok(HG_VER === 'hg-v552', 'build stamp is hg-v552');

const OG = read('omnigold.js');
const GS = read('goldscalp.js');
const GW = read('goldswing.js');
const GI = read('goldind.js');
const IDX = read('index.html');

console.log('\n== OMNIGOLD bridge paint independence ==');
ok(/loading GOLD SCALP \/ GOLD SWING engines/.test(OG),
   'interim engines strip while bridge fetch runs');
ok(/Paint MOST PROBABLE \+ a loading engines strip BEFORE/.test(OG)
   || /BEFORE the gold-tab/.test(OG),
   'MP paints before bridge await');
ok(/__timeout:\s*true/.test(OG) && /8000/.test(OG),
   'gold-tab engines fetch is time-bounded (8s)');
ok(/timed out waiting for 15m\/1d candles/.test(OG),
   'timeout returns ok:false why-string so engines panel still paints');

console.log('\n== GOLD SCALP keep-last + Asia honesty ==');
ok(/previous results still showing/.test(GS),
   'scalp keeps last cards while rescanning');
ok(!/if \(ui && ui\.cards\) ui\.cards\.innerHTML = '';/.test(GS),
   'scalp no longer wipes #gsCards at scan start');
ok(/asiaSession/.test(GS) && /ASIA SESSION \(00:00–07:00 GMT\)/.test(GS),
   'WHY SILENT names Asia when the session is ASIAN');
ok(/hardReject:\s*false/.test(GI.slice(GI.indexOf('function push(c)'), GI.indexOf('function push(c)') + 800)),
   'goldScalpSetups Asia demotes (hardReject:false) instead of silent drop');

console.log('\n== GOLD SWING keep-last ==');
ok(/previous results still showing/.test(GW),
   'swing keeps last cards while rescanning');
ok(!/if \(ui && ui\.cards\) ui\.cards\.innerHTML = '';/.test(GW),
   'swing no longer wipes #gwCards at scan start');

console.log('\n== auto-scan mustScan includes gold desks ==');
ok(/t === 'omnigold'/.test(IDX) && /t === 'goldscalp'/.test(IDX) && /t === 'goldswing'/.test(IDX),
   'scheduleTabAutoScan retries when omnigold/goldscalp/goldswing blocked');

console.log('\n' + passed + ' assertions passed');
