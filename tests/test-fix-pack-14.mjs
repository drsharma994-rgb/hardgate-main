/* HARDGATE — fix pack 14 regression guards (expert repo integration). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { relSpearman, relGateIC } from '../lib/reliability.mjs';
import { hgEwmaVol, hgGarchLite, hgVolRegime } from '../lib/vol-forecast.mjs';
import { hgBetSize } from '../lib/bet-size.mjs';
import { hgAvgUniqueness, hgEffectiveN, hgEventsFromRecords } from '../lib/sample-uniqueness.mjs';
import { hgHurstRS, hgFamilyRouter } from '../lib/regime-router.mjs';
import { hgCoint, hgCointHalfLifeVeto } from '../lib/gold-coint.mjs';
import { HG_META_FLOOR } from '../lib/meta-label.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

function mulberry(seed){
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5; a >>>= 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log('== rank IC ==');
{
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const ys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  ok(relSpearman(xs.slice(0, 10), ys.slice(0, 10)) === null, 'relSpearman null below n=12');
  const sp = relSpearman(xs, ys);
  ok(sp && Math.abs(sp.rho - 1) < 1e-9, 'relSpearman perfect correlation');
  const tied = relSpearman([1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], ys);
  ok(tied && isFinite(tied.rho), 'relSpearman handles ties');

  const recs = [];
  for (let i = 0; i < 25; i++){
    recs.push({
      status: 'settled', r: i * 0.1 - 1,
      layers: ['TAPE'],
      layerVals: { TAPE: i / 25 },
      at: Date.now() - i * 3600000,
      closedAt: Math.floor(Date.now() / 1000) - i * 3600,
    });
  }
  const ic = relGateIC(recs);
  ok(ic.length >= 1, 'relGateIC produces rows');
  const noise = ic.every(r => Math.abs(r.tStat || 0) < 2 ? r.verdict === 'NOISE' : true);
  ok(noise, 'relGateIC marks NOISE when |tStat| < 2');
}

console.log('== vol forecast ==');
{
  const rnd = mulberry(42);
  const rs = Array.from({ length: 35 }, () => (rnd() - 0.5) * 0.02);
  ok(hgEwmaVol(rs.slice(0, 29)) === null, 'hgEwmaVol null below n=30');
  const ew = hgEwmaVol(rs);
  ok(ew && ew.sigma > 0, 'hgEwmaVol returns sigma');
  const g = hgGarchLite(rs);
  ok(g && typeof g.converged === 'boolean', 'hgGarchLite reports converged flag');
  if (!g.converged) ok(g.note && /EWMA|unstable|grid/i.test(g.note), 'hgGarchLite notes fallback');
  const reg = hgVolRegime({ sigmaNow: 0.01, sigmaForecast: 0.015, ratioThresh: 1.15 });
  ok(reg.regime === 'VOL EXPANDING', 'hgVolRegime flags expansion');
}

console.log('== bet size ==');
{
  const below = hgBetSize({ prob: 0.5, floor: HG_META_FLOOR });
  ok(below.sizeR === 0, 'hgBetSize returns 0 below HG_META_FLOOR');
  const mid = hgBetSize({ prob: 0.57, floor: HG_META_FLOOR, maxR: 1.0 });
  ok(mid.sizeR > 0 && mid.sizeR <= 1.0, 'hgBetSize within maxR=1.0');
  const high = hgBetSize({ prob: 0.95, floor: HG_META_FLOOR, maxR: 1.0 });
  ok(high.sizeR <= 1.0, 'hgBetSize NEVER exceeds maxR=1.0');
  const execSrc = fs.readFileSync(path.join(root, 'execute.js'), 'utf8');
  ok(!/hgBetSize/.test(execSrc), 'hgBetSize absent from execute.js');
}

console.log('== sample uniqueness ==');
{
  const t0 = 1000000;
  const overlap = [
    { tStart: t0, tEnd: t0 + 1000 },
    { tStart: t0, tEnd: t0 + 1000 },
    { tStart: t0, tEnd: t0 + 1000 },
  ];
  const u = hgAvgUniqueness(overlap);
  ok(u.length === 3, 'hgAvgUniqueness returns per event');
  ok(Math.abs(u[0].uniqueness - 1 / 3) < 0.05, 'hgAvgUniqueness ~1/k for k overlapping');
  const iso = [{ tStart: t0 + 5000, tEnd: t0 + 6000 }];
  const u2 = hgAvgUniqueness(iso);
  ok(u2[0].uniqueness > 0.95, 'isolated event uniqueness ~1');
  const eff = hgEffectiveN(overlap);
  ok(eff < overlap.length, 'hgEffectiveN < raw n when overlap exists');
  const recs = overlap.map((e, i) => ({
    status: 'settled', r: 1, at: e.tStart, closedAt: Math.floor(e.tEnd / 1000), sym: 'A' + i,
  }));
  ok(hgEventsFromRecords(recs).length === 3, 'hgEventsFromRecords from ledger');
}

console.log('== family router ==');
{
  const rnd = mulberry(99);
  const rw = Array.from({ length: 200 }, () => (rnd() - 0.5));
  const h = hgHurstRS(rw);
  ok(h && h.hurst > 0.35 && h.hurst < 0.65, 'hgHurstRS random walk H near 0.5');
  const route = hgFamilyRouter({ hurst: h });
  ok(route.favour === 'NEITHER' || route.favour === 'TREND' || route.favour === 'MEANREV', 'hgFamilyRouter returns favour');
}

console.log('== gold coint ==');
{
  const rnd2 = mulberry(7);
  const walkA = [100];
  const walkB = [50];
  for (let i = 0; i < 150; i++){
    walkA.push(walkA[walkA.length - 1] + (rnd2() - 0.5));
    walkB.push(walkB[walkB.length - 1] + (rnd2() - 0.5));
  }
  const c = hgCoint(walkA, walkB);
  ok(c && c.cointegrated === false, 'hgCoint false on independent random walks');
  ok(hgCoint(walkA.slice(0, 50), walkB.slice(0, 50)) === null, 'hgCoint null below n=120');
  const veto = hgCointHalfLifeVeto({ cointegrated: true, halfLifeBars: 200 }, 42);
  ok(veto.veto === true, 'hgCoint vetoes when halfLifeBars beyond time barrier');
}

console.log('== cache bump ==');
{
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v265/.test(sw), 'cache hg-v265');
  ok(/fixpack14-core\.js/.test(sw), 'fixpack14-core precached');
  ok(/goldcoint\.js/.test(sw), 'goldcoint.js precached');
}

console.log('== provenance test file ==');
{
  ok(fs.existsSync(path.join(root, 'tests/test-provenance.mjs')), 'test-provenance.mjs exists');
}

console.log('\nfix pack 14: ' + pass + ' passed');
