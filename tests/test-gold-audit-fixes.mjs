/* HARDGATE — gold audit fix regression tests (hg-v629)
   Covers: SMT timestamp alignment, yield noise band, DST sessions,
   evalGoldSwing GS3 mixed=na contract, goldBasisSignal PAXG proxy labels.
   Run: node tests/test-gold-audit-fixes.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout, Intl };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(ctx);
  for (const f of ['gold-session.js', 'goldind.js', ...(extra || [])]){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

ok(swCacheOk(read('sw.js')), 'sw.js matches build-stamp ' + HG_VER);
ok(read('index.html').indexOf("de260a776e5d49d091d7a49bf9d17be5") < 0, 'hardcoded Twelve Data key removed from index.html');

console.log('\n== SMT timestamp alignment ==');
{
  const W = boot();
  const t0 = Math.floor(Date.UTC(2024, 6, 15, 9, 0) / 1000);
  const xau = [], xag = [];
  for (let i = 0; i < 20; i++){
    const t = t0 + i * 900;
    xau.push({ t, o: 2400 + i, h: 2405 + i, l: 2398 + i, c: 2402 + i, v: 100 });
    /* silver bars lag 15m — index pairing would misalign */
    xag.push({ t: t + 900, o: 28 + i * 0.01, h: 28.2 + i * 0.01, l: 27.8, c: 28.1, v: 50 });
  }
  const last = xau.length - 1;
  xau[last].h = 2425;
  xag[xag.length - 1].h = 28.05;
  const idxMis = W.detectSMTDivergence(xau, xag, last, 10);
  ok(!idxMis.smtActive, 'misaligned silver offset does not fire false SMT');
  const xag2 = xag.map(b => ({ ...b, t: b.t - 900 }));
  xau[last].h = 2425;
  xag2[xag2.length - 1].h = 28.05;
  for (let i = 0; i < 10; i++){ xag2[i].h = 27.5; xag2[i].l = 27.2; }
  const aligned = W.detectSMTDivergence(xau, xag2, last, 10);
  ok(aligned.smtActive && aligned.type === 'BEARISH_SMT', 'timestamp-aligned bars can detect bearish SMT');
}

console.log('\n== validateYieldCorrelation ±0.05% band ==');
{
  const W = boot();
  const mk = c => ({ o: c, h: c, l: c, c });
  const flat = [mk(4.0), mk(4.0), mk(4.0), mk(4.0), mk(4.0), mk(4.0019)];
  ok(W.validateYieldCorrelation(flat, 'long').valid === true, 'sub-0.05% yield tick does not veto long gold');
  const spike = [mk(4.0), mk(4.0), mk(4.0), mk(4.0), mk(4.0), mk(4.0025)];
  ok(W.validateYieldCorrelation(spike, 'long').valid === false, '>=0.05% rise vetoes long gold');
}

console.log('\n== DST session helpers ==');
{
  const W = boot();
  const winterLon = W.hgGoldKillzoneRead(Date.UTC(2024, 0, 15, 8, 30));
  ok(winterLon.zone === 'LONDON', '08:30 UTC Jan = London killzone (GMT)');
  const summerLon = W.hgGoldKillzoneRead(Date.UTC(2024, 6, 15, 7, 30));
  ok(summerLon.zone === 'LONDON', '07:30 UTC Jul = London killzone (BST)');
  const fixWinter = W.hgIsLondonFix(Date.UTC(2024, 0, 15, 15, 15));
  const fixSummer = W.hgIsLondonFix(Date.UTC(2024, 6, 15, 14, 15));
  ok(fixWinter && fixSummer, 'London fix window tracks 15:00 local in winter and summer');
  const nyCloseWinter = W.hgIsNYClose(Date.UTC(2024, 0, 15, 21, 15));
  const nyCloseSummer = W.hgIsNYClose(Date.UTC(2024, 6, 15, 20, 15));
  ok(nyCloseWinter && nyCloseSummer, 'NY close window tracks 16:00 local in winter and summer');
}

console.log('\n== goldBasisSignal PAXG proxy labeling ==');
{
  const ctx = boot(['goldspot.js']);
  const s = ctx.goldBasisSignal({ spot: 3000, perp: 3004.8, perpSymbol: 'PAXGUSDT', perpDegraded: true });
  ok(s.verdict === 'paxg-premium', 'PAXG degraded leg uses paxg-premium verdict');
  ok(/PAXG token spread/i.test(s.evidence.join(' ')), 'PAXG evidence names token spread');
}

console.log('\n== evalGoldSwing GS3 mixed contract (source) ==');
{
  const src = read('index.html');
  ok(/casc==='mixed'\?'na':\(rsiVeto\?'veto':'pass'\)/.test(src), 'evalGoldSwing GS3 is na when cascade mixed');
  ok(/Funding clean \(crowding veto\)/.test(src) && /binanceFunding\('XAUUSDT'\)/.test(src), 'evalGoldSwing wires GS4 funding from XAUUSDT');
}

console.log('\n== goldpro forward-log W scope (source) ==');
{
  const gp = read('goldpro.js');
  ok(/async function runGoldPro\(ui\)\{\s*\n\s*var W = \(typeof window/.test(gp),
     'runGoldPro declares window W before hgFwdRecordScan');
}

console.log('\n' + passed + ' assertions passed');
