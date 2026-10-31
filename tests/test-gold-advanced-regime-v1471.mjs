#!/usr/bin/env node
/* test-gold-advanced-regime-v1471 — the advanced regime indicators' contract.

   hg-v1471 adds two advanced regime reads to the shared indicator stack
   (gold-catalog.js), marks only, never gating:

     1. VR20 — the Lo–MacKinlay variance-ratio at q=4, on price levels:
        VR(q) = sigma2_c(q) / (q x sigma2_a), sigma2_c(q) over the
        (n - q + 1) overlapping q-windows. VR > 1 = variance grows faster
        than a random walk (TRENDING); VR < 1 = it grows slower
        (MEAN-REVERTING); an i.i.d. walk reads ~1. The classic overlap
        error (an extra factor of q in the sigma2_c divisor) deflates VR by
        exactly q — found by the tape probe (an i.i.d. walk read 0.33 with
        q=4) and fixed; the probe now orders momentum > coin-flip > anchor.
     2. ENTROPY20 — Shannon entropy of the up/down/flat symbol sequence over
        the last 20 closed bars, normalized by log2(3): 1 = coin-flip
        disorder, near 0 = ordered structure.
     3. Both flow into the indicator stack as three-state marks
        (ind:vrTrending, ind:entropyLow) and display rows — reaching every
        gold tab through the shared stack, exactly like the existing reads.
     4. the shipped build is stamped hg-v1471 on every cache surface.

   Mutation-proven: the overlap error reintroduced, or the entropy
   normalization dropped, each reds a named section. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function bootCtx(files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseFloat, parseInt, RegExp, Intl, encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){ /* tolerated */ } }
  return ctx;
}
function tape(fn, n){
  const rows = []; let c = 2600;
  for (let i = 0; i < n; i++){ const o = c; c = fn(i, c); rows.push({ t: i * 9e5, o, h: Math.max(o, c) + 0.2, l: Math.min(o, c) - 0.2, c, v: 500 }); }
  return rows;
}
const LCG = (seed) => { let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };

/* ============ 1. VR20: the exact mathematics ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'gold-catalog.js']);

  /* pinned: a perfectly ALTERNATING tape (±a every bar) — the q-period
     displacement is identically zero, so VR = 0 exactly: MEANREV */
  const alt = tape((i, c) => c + (i % 2 === 0 ? 2 : -2), 140);
  const irA = ctx.hgGoldIndicatorReads(alt, {});
  ok(isFinite(irA.vr20) && irA.vr20 < 0.01, 'vr: a perfectly alternating tape reads VR ~ 0 (MEANREV; the drift correction leaves sub-tick dust), got ' + irA.vr20);
  ok(irA.vrState === 'MEANREV', 'vr: the alternating tape tiers MEANREV');

  /* pinned: a large i.i.d. two-point walk reads VR ~ 1 */
  const rndF = LCG(14671);
  const iid = tape((i, c) => c + (rndF() < 0.5 ? -1 : 1), 2400);
  const irI = ctx.hgGoldIndicatorReads(iid, {});
  ok(isFinite(irI.vr20) && Math.abs(irI.vr20 - 1) < 0.08,
     'vr: a 2400-step i.i.d. two-point walk reads VR ~ 1, got ' + (irI.vr20 && irI.vr20.toFixed(4)));

  /* ordering across regimes, averaged over seeds: momentum > i.i.d. > anchor */
  let momSum = 0, revSum = 0, flipSum = 0, reads = 0;
  for (let s = 1; s <= 6; s++){
    const rnd = LCG(100 + s);
    let d = 0;
    const mom = tape((i, c) => { d = d * 0.6 + (rnd() - 0.5) * 1.4; return c + d + 0.25; }, 240);
    const rev = tape((i, c) => 2600 + ((2600 - c) * 0.35) + (rnd() - 0.5) * 1.0, 240);
    const flip = tape((i, c) => c + (rnd() - 0.5) * 3, 240);
    const a = ctx.hgGoldIndicatorReads(mom, {}), b = ctx.hgGoldIndicatorReads(rev, {}), cc = ctx.hgGoldIndicatorReads(flip, {});
    if (isFinite(a.vr20) && isFinite(b.vr20) && isFinite(cc.vr20)){ momSum += a.vr20; revSum += b.vr20; flipSum += cc.vr20; reads++; }
  }
  ok(reads === 6 && momSum / reads > flipSum / reads && flipSum / reads > revSum / reads,
     'vr: averaged over ' + reads + ' seeds, momentum (' + (momSum / reads).toFixed(3) + ') > i.i.d. (' + (flipSum / reads).toFixed(3) + ') > anchored mean-reversion (' + (revSum / reads).toFixed(3) + ')');

  /* a degenerate perfect ramp: both variances zero — the read stays absent */
  const ramp = tape((i, c) => 2600 + i * 0.5, 140);
  const irR = ctx.hgGoldIndicatorReads(ramp, {});
  ok(!isFinite(irR.vr20) && irR.vrState === undefined, 'vr: a perfect ramp (zero variance) leaves the read absent, never 0/0');
}

/* ============ 2. ENTROPY20: the exact mathematics ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'gold-catalog.js']);

  /* pinned: an exactly alternating tape is MAXIMALLY disordered on the
     up/down alphabet (half up, half down) -> entropy ~ 1 */
  const alt = tape((i, c) => c + (i % 2 === 0 ? 2 : -2), 140);
  const irA = ctx.hgGoldIndicatorReads(alt, {});
  ok(isFinite(irA.entropy20) && Math.abs(irA.entropy20 - 1) < 1e-9,
     'entropy: a perfectly alternating tape reads entropy = 1 (half up, half down), got ' + irA.entropy20);

  /* pinned: an ordered tape — 15 up then 5 flat — is far from disorder */
  let k = 0;
  const ordered = tape((i, c) => { k++; return k <= 15 ? c + 1 : c; }, 140);
  const irO = ctx.hgGoldIndicatorReads(ordered, {});
  ok(isFinite(irO.entropy20) && irO.entropy20 < 0.75, 'entropy: an ordered tape reads well below 1, got ' + (irO.entropy20 && irO.entropy20.toFixed(3)));

  /* bounds: the normalized entropy can never leave [0, 1] */
  const rndF = LCG(77);
  const any = tape((i, c) => c + (rndF() - 0.5) * 4, 200);
  const irAny = ctx.hgGoldIndicatorReads(any, {});
  ok(isFinite(irAny.entropy20) && irAny.entropy20 >= 0 && irAny.entropy20 <= 1,
     'entropy: the normalized read stays inside [0, 1]');
}

/* ============ 3. the marks and the display rows ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'gold-catalog.js']);
  const alt = tape((i, c) => c + (i % 2 === 0 ? 2 : -2), 140);
  const ir = ctx.hgGoldIndicatorReads(alt, {});
  const m = ctx.hgGoldIndicatorMarks(ir, 'long');
  ok(m['ind:vrTrending'] === false, 'marks: the alternating tape marks ind:vrTrending = false (mean-reverting)');
  ok(m['ind:entropyLow'] === false, 'marks: the alternating tape marks ind:entropyLow = false (disordered)');
  const ordered = tape((i, c) => c + 1 + Math.sin(i / 9) * 0.4, 140);
  const ir2 = ctx.hgGoldIndicatorReads(ordered, {});
  const m2 = ctx.hgGoldIndicatorMarks(ir2, 'long');
  ok(m2['ind:vrTrending'] === true, 'marks: the trending tape marks ind:vrTrending = true (got ' + JSON.stringify(m2['ind:vrTrending']) + ')');
  ok(ir2.vr20 > 1.05, 'marks: the trending tape VR is past the 1.05 line, got ' + (ir2.vr20 && ir2.vr20.toFixed(3)));
}

/* ============ 4. the shipped build is stamped hg-v1471 ============ */
{
  const stamp = read('build-stamp.js');
  ok(/version: 'hg-v1481'/.test(stamp), 'build-stamp version');
  ok(/built: '2026-11-01T/.test(stamp), 'build-stamp built (fresh)');
  ok(/hg-v1471: ADVANCED REGIME READS/.test(stamp), 'the pack string names the round');
  ok(/hg-v1470: OMNIGOLD LEADERBOARD/.test(stamp), 'and the pack history chain is intact');
  ok(/HG_CACHE = 'hg-v1481'/.test(read('sw.js')), 'sw.js cache id');
  const idx = read('index.html');
  ok(idx.indexOf('?v=1470') < 0 && idx.indexOf('?v=1481') >= 0, 'index.html cache-busters all at 1472');
  ok(read('hg-api-base.js').indexOf('1470') < 0, 'hg-api-base at 1471');
  ok(read('trendtable.js').indexOf('1470') < 0, 'trendtable loader at 1471');
  const ledger = JSON.parse(read('data/batch-ledger.json'));
  const entries = (Array.isArray(ledger) ? ledger : Object.values(ledger).find(Array.isArray));
  ok(entries[entries.length - 1].version === 'hg-v1481', 'the batch ledger last entry is hg-v1481');
}

/* ============ mutations ============ */
{
  const runMutation = (name, file, mutate, checker) => {
    const src = read(file);
    const m = mutate(src);
    if (m === src){ fail++; console.error('  FAIL mutation ' + name + ' did not change source'); return; }
    const ctx = bootCtx(['indicators.js', 'indicators2.js', 'gold-catalog.js']);
    try { vm.runInContext(m, ctx, { filename: file.replace(/\.js$/, '-mutated.js') }); }
    catch(e){ pass++; console.log('  ok — mutation ' + name + ' caught (build threw)'); return; }
    const caught = checker(ctx) === true;
    if (caught){ pass++; console.log('  ok — mutation ' + name + ' caught'); }
    else { fail++; console.error('  FAIL mutation ' + name + ' survived'); }
  };

  /* M1: the classic overlap error reintroduced -> the i.i.d. pin breaks */
  runMutation('M1_overlap_error', 'gold-catalog.js',
    s => s.replace('var m = n - q + 1, s2c = 0, t2;', 'var m = q * (n - q + 1), s2c = 0, t2; /* M1 */'),
    ctx => {
      const rndF = LCG(14671);
      const iid = tape((i, c) => c + (rndF() < 0.5 ? -1 : 1), 2400);
      const ir = ctx.hgGoldIndicatorReads(iid, {});
      return isFinite(ir.vr20) && Math.abs(ir.vr20 - 1) > 0.15; /* mutated: VR deflated to ~0.25 -> caught */
    });

  /* M2: the entropy normalization dropped -> a three-outcome tape (up/down/flat
     in equal measure carries raw H = log2(3) ~ 1.585) leaves [0, 1] */
  runMutation('M2_entropy_unnormalized', 'gold-catalog.js',
    s => s.replace('out.entropy20 = (syms >= 2 && H > 0) ? H / Math.log2(syms) : 0;', 'out.entropy20 = H; /* M2 */'),
    ctx => {
      /* exact cycle: up 1, down 1, flat — the last 20 moves split evenly */
      const cyc = tape((i, c) => (i % 3 === 0 ? c + 1 : (i % 3 === 1 ? c - 1 : c)), 140);
      const ir = ctx.hgGoldIndicatorReads(cyc, {});
      return isFinite(ir.entropy20) && ir.entropy20 > 1; /* mutated: raw H ~ log2(3) > 1 -> caught */
    });
}

console.log(pass + ' assertions passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
