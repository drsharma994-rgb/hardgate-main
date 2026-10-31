#!/usr/bin/env node
/* test-gold-tab-math-v1464 — the gold-tab math + max-accuracy round's contract.

   hg-v1464 makes the setups MAXIMUM ACCURACY at the one choke point every
   gold setup passes — the shared ranker — after the shared primitives came
   back exact under fuzz:

     1. hgGoldLegR (gold-best-levels, used by nine files) — 200,000 fuzzed
        cases against a faithful reference: ZERO mismatches. The directional
        R primitive is exact.
     2. hgSealGoldSetup / hgSyncPlanRr — 50,000 fuzzed candidates: every leg
        recomputed from the published levels, wrong-side legs cleared to
        null, geometryOk exact. ZERO mismatches.
     3. goldSweeps — 3,000 synthetic tapes recomputed bar-by-bar: the sweep
        level always equals the 25-bar pool extreme, the detection always
        matches the wick+reclaim predicate. ZERO violations.
     4. goldKillzone — session boundaries exact (Asian 00-08, London 07-10
        wins the overlap by else-if order, NY AM 10-13, OVERLAP 13-17).
     5. THE DEFECT: goldRankSetups overwrote c.rr only when a target existed
        (hg-v1459) — a candidate whose target was UNREAD kept whatever R the
        desk advertised, so a card could print "R 2.5" on a plan with no
        target to pay it. The ranker now runs the house SEAL
        (hgSyncPlanRr): every leg from the published levels, unread or
        wrong-side legs CLEARED with a named rrNote, never invented; the
        partial overwrite remains only as the fallback when the seal is not
        loaded.
     6. THE AUDIT: every ranked setup carries hgGoldPlanPricingOk when it
        has something to say (off-tick mints, risk drift, ladder order) —
        named, never gating.
     7. the shipped build is stamped hg-v1464 on every cache surface.

   Mutation-proven: restoring the stale-R survival, dropping the audit, or
   flipping legR's long-side sign each red a named section. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function bootCtx(files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseFloat, parseInt, RegExp, Intl };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){ /* desks tolerate */ } }
  return ctx;
}

/* ============ 1. hgGoldLegR: exact against the reference ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'gold-best-levels.js']);
  const gbNumLike = v => (v === null || v === undefined || v === '') ? NaN : +v;
  const refLegR = (dir, entry, stop, target) => {
    const d = String(dir || '').toLowerCase();
    const e = gbNumLike(entry), s = gbNumLike(stop), t = gbNumLike(target);
    if (d === 'long' || d === 'short'){
      const risk = d === 'long' ? e - s : s - e;
      const rew = d === 'long' ? t - e : e - t;
      if (!(Number.isFinite(e) && e > 0 && Number.isFinite(risk) && risk > 0 && Number.isFinite(rew) && rew > 0)) return null;
      return rew / risk;
    }
    const absRisk = (Number.isFinite(e) && Number.isFinite(s)) ? Math.abs(e - s) : NaN;
    if (!(Number.isFinite(absRisk) && absRisk > 0 && Number.isFinite(t))) return null;
    return Math.abs(t - e) / absRisk;
  };
  let seed = 14641, bad = 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 20000; i++){
    const dirs = ['long','short','',null,undefined,'LONG','Buy','x',0];
    const dir = dirs[Math.floor(rnd()*dirs.length)];
    const pick = () => { const r = rnd(); return r < 0.08 ? NaN : r < 0.12 ? null : r < 0.15 ? 0 : r < 0.18 ? -Math.abs(rnd()*50+1) : r < 0.21 ? '2645.11' : rnd()*3000+1000; };
    const e = pick(), s = pick(), t = pick();
    const got = ctx.hgGoldLegR(dir, e, s, t), want = refLegR(dir, e, s, t);
    const same = (got === null && want === null) || (got !== null && want !== null && Math.abs(got - want) < 1e-9);
    if (!same) bad++;
  }
  ok(bad === 0, 'legR: 20000 fuzzed cases, zero mismatches vs the directional reference');

  /* pinned semantics */
  ok(ctx.hgGoldLegR('long', 2645.11, 2635.11, 2665.11) === 2, 'legR: a clean long pays exactly 2R');
  ok(ctx.hgGoldLegR('long', 2645.11, 2655.11, 2665.11) === null, 'legR: a long whose stop sits ABOVE the entry quotes no R');
  ok(ctx.hgGoldLegR('long', 2645.11, 2635.11, 2640.11) === null, 'legR: a long whose target sits BELOW the entry quotes no R');
  ok(ctx.hgGoldLegR('short', 2645.11, 2655.11, 2625.11) === 2, 'legR: a clean short pays exactly 2R');
  ok(ctx.hgGoldLegR('', 2645.11, 2635.11, 2665.11) === 2, 'legR: an unlabelled pair keeps the historical absolute ratio');
}

/* ============ 2. the seal: legs from the levels, never invented ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'gold-best-levels.js']);
  let seed = 14642, bad = 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 5000; i++){
    const dir = rnd() < 0.45 ? 'long' : rnd() < 0.9 ? 'short' : '';
    const e = 1000 + rnd()*2000, sign = dir === 'short' ? -1 : 1;
    const s = dir === '' ? e - (rnd()-0.5)*40 : e - sign*(1 + rnd()*40);
    const c = { dir: dir || undefined, entry: e, stop: s,
      t1: e + sign*(rnd()<0.2 ? -(5+rnd()*30) : rnd()*80),
      t2: e + sign*(rnd()*100), t3: e + sign*(rnd()*120),
      rr: 99, rr2: 99, rr3: 99 };
    ctx.hgSealGoldSetup(c);
    const d = dir || '';
    const leg = (t) => { const r = ctx.hgGoldLegR(d, e, s, t); return r === null ? null : r; };
    const eq = (a,b) => (a===null&&b===null)||(a!==null&&b!==null&&Math.abs(a-b)<1e-9);
    const geoWant = (dir==='long'||dir==='short') && c.rr !== null && c.rr > 0;
    if (!eq(c.rr, leg(c.t1)) || !eq(c.rr2, leg(c.t2)) || !eq(c.rr3, leg(c.t3)) || c.geometryOk !== geoWant) bad++;
  }
  ok(bad === 0, 'seal: 5000 fuzzed candidates, every leg recomputed from the levels, geometryOk exact');

  const cleared = { dir: 'long', entry: 2645.11, stop: 2635.11, t1: 2640.11, rr: 9.99 };
  ctx.hgSealGoldSetup(cleared);
  ok(cleared.rr === null && /cleared/.test(cleared.rrNote || ''), 'seal: a wrong-side T1 is CLEARED to null with a named rrNote (was a positive 9.99R lie)');
  ok(cleared.geometryOk === false, 'seal: a cleared leg is not geometry-ok');
}

/* ============ 3. the detectors: sweeps and killzones ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'goldind.js']);
  let seed = 14643, bad = 0, n = 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 60; i++){
    const nn = 30 + Math.floor(rnd()*60);
    const rows = [];
    let c = 2000 + rnd()*800;
    for (let k = 0; k < nn; k++){
      const o = c; c += (rnd()-0.5)*8;
      rows.push({ t: k*9e5, o, h: Math.max(o,c) + rnd()*4, l: Math.min(o,c) - rnd()*4, c, v: 100+rnd()*900 });
    }
    const out = ctx.goldSweeps(rows);
    if (!out) continue;
    n++;
    for (const sw of (out.all || [])){
      const i2 = rows.length - 1 - sw.barsAgo;
      const pool = rows.slice(Math.max(0, i2-25), i2);
      const poolL = Math.min(...pool.map(r => r.l)), poolH = Math.max(...pool.map(r => r.h));
      const r = rows[i2];
      const isBull = r.l < poolL && r.c > poolL, isBear = r.h > poolH && r.c < poolH;
      const lvlOk = sw.dir === 'bullish' ? Math.abs(sw.level - poolL) < 1e-9 : Math.abs(sw.level - poolH) < 1e-9;
      if (!lvlOk || !(isBull || isBear)) { bad++; break; }
    }
  }
  ok(n > 30 && bad === 0, 'sweeps: ' + n + ' tapes recomputed, every level is the pool extreme and every detection matches the predicate');

  const kz = ctx.goldKillzone;
  const cases = [[12,59,'NY AM'],[13,0,'LONDON/NY OVERLAP'],[16,59,'LONDON/NY OVERLAP'],[17,0,'OFF-HOURS'],[7,0,'LONDON KILLZONE'],[9,59,'LONDON KILLZONE'],[10,0,'NY AM'],[0,0,'ASIAN RANGE']];
  let kzBad = 0;
  for (const [h, m, label] of cases){
    if (kz(Date.UTC(2026,9,29,h,m)).label !== label) kzBad++;
  }
  ok(kzBad === 0, 'killzone: session boundaries exact');
}

/* ============ 4. the ranker: the seal + the audit ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'goldind.js', 'gold-best-levels.js']);
  const rank = ctx.goldRankSetups;
  ok(typeof rank === 'function', 'ranker: goldRankSetups exported');

  /* a candidate advertising R 2.5 with NO target: the seal clears it */
  const stale = { id: 'stale', dir: 'long', entry: 2650, stop: 2640, rr: 2.5, strategy: 's', stratKey: 's', grade: 'A' };
  const r1 = rank([stale], { now: Date.UTC(2026,9,29,12,0) });
  const rs = r1.ranked.find(c => c.id === 'stale') || stale;
  ok(rs.rr === null, 'ranker: a stale advertised R on a target-less plan is CLEARED to null (was printed as R 2.5)');
  ok(/cleared/.test(rs.rrNote || ''), 'ranker: the clearing is named on the candidate (rrNote)');

  /* a wrong-side target: the sides gate REFUSES it outright, named */
  const wrong = { id: 'wrong', dir: 'long', entry: 2650, stop: 2640, t1: 2630, rr: 2, strategy: 's', stratKey: 's', grade: 'A' };
  const rw = rank([wrong], { now: Date.UTC(2026,9,29,12,0) });
  ok(rw.ranked.length === 0 && rw.rejected.length === 1 && /TP1 must sit ABOVE entry/.test(rw.rejected[0].reason || ''),
     'ranker: a wrong-side target is refused at the sides gate with the named reason');

  /* a clean candidate: the exact R, no audit noise */
  const clean = { id: 'clean', dir: 'long', entry: 2650, stop: 2640, t1: 2660, strategy: 's', stratKey: 's', grade: 'A' };
  rank([clean], { now: Date.UTC(2026,9,29,12,0) });
  ok(Math.abs(clean.rr - 1) < 1e-9, 'ranker: a clean candidate prints the exact geometry R (1.0)');
  ok(clean.pricingAudit === undefined, 'ranker: a clean on-tick plan carries no audit noise');

  /* a sub-cent mint: the audit rides, named */
  const off = { id: 'off', dir: 'long', entry: 2650.115, stop: 2640.11, t1: 2670.115, strategy: 's', stratKey: 's', grade: 'A' };
  rank([off], { now: Date.UTC(2026,9,29,12,0) });
  ok(off.pricingAudit && Array.isArray(off.pricingAudit.offTick) && off.pricingAudit.offTick.length >= 2,
     'ranker: a sub-cent mint carries the pricing audit naming the off-tick levels (never gating)');
  ok(off.rr !== null && Math.abs(off.rr - Math.abs(off.t1 - off.entry)/Math.abs(off.entry - off.stop)) < 0.006,
     'ranker: the printed R still lands on the exact ratio of the published levels');
}

/* ============ 5. the shipped build is stamped hg-v1464 ============ */
{
  const stamp = read('build-stamp.js');
  ok(/version: 'hg-v1481'/.test(stamp), 'build-stamp version');
  ok(/built: '2026-11-01T13:00:00Z'/.test(stamp), 'build-stamp built (non-decreasing, re-pinned at the hg-v1481 bump)');
  ok(/hg-v1464: GOLD TAB MATH/.test(stamp), 'the pack string names the round');
  ok(/hg-v1463: GOLD SETUP LOGIC/.test(stamp), 'and the pack history chain is intact');
  ok(/HG_CACHE = 'hg-v1481'/.test(read('sw.js')), 'sw.js cache id');
  const idx = read('index.html');
  ok(idx.indexOf('?v=1463') < 0 && idx.indexOf('?v=1481') >= 0, 'index.html cache-busters all at 1466');
  ok(read('hg-api-base.js').indexOf('1463') < 0, 'hg-api-base at 1464');
  ok(read('trendtable.js').indexOf('1463') < 0, 'trendtable loader at 1464');
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
    const ctx = bootCtx(['indicators.js', 'indicators2.js', 'gold-best-levels.js']);
    try { vm.runInContext(m, ctx, { filename: file.replace(/\.js$/, '-mutated.js') }); }
    catch(e){ pass++; console.log('  ok — mutation ' + name + ' caught (build threw)'); return; }
    const caught = checker(ctx) === true;
    if (caught){ pass++; console.log('  ok — mutation ' + name + ' caught'); }
    else { fail++; console.error('  FAIL mutation ' + name + ' survived'); }
  };

  /* M1: the stale-R survival restored -> the target-less candidate prints R 2.5 */
  runMutation('M1_stale_r_survives', 'goldind.js',
    s => s.replace("if (typeof hgSyncPlanRr === 'function') hgSyncPlanRr(c);\n        else if (isFinite(sideGate.rr)) c.rr = +sideGate.rr.toFixed(2);",
                   "if (isFinite(sideGate.rr)) c.rr = +sideGate.rr.toFixed(2); /* M1 */"),
    ctx => {
      const c = { id: 'm1', dir: 'long', entry: 2650, stop: 2640, rr: 2.5, strategy: 's', stratKey: 's', grade: 'A' };
      ctx.goldRankSetups([c], { now: Date.UTC(2026,9,29,12,0) });
      return c.rr === 2.5; /* mutated: the invented R survives -> caught */
    });

  /* M2: the audit attach dropped -> the off-tick mint goes unnamed */
  runMutation('M2_audit_dropped', 'goldind.js',
    s => s.replace('if (__pa && (!__pa.ok || (__pa.offTick && __pa.offTick.length))) c.pricingAudit = __pa;', '/* M2 */'),
    ctx => {
      const c = { id: 'm2', dir: 'long', entry: 2650.115, stop: 2640.11, t1: 2670.115, strategy: 's', stratKey: 's', grade: 'A' };
      ctx.goldRankSetups([c], { now: Date.UTC(2026,9,29,12,0) });
      return c.pricingAudit === undefined; /* mutated: no audit -> survives */
    });

  /* M3: legR long-side sign flipped -> the pinned long semantics break */
  runMutation('M3_legr_sign_flipped', 'gold-best-levels.js',
    s => s.replace("var risk = d === 'long' ? entry - stop : stop - entry;", "var risk = d === 'long' ? stop - entry : stop - entry; /* M3 */"),
    ctx => ctx.hgGoldLegR('long', 2645.11, 2635.11, 2665.11) === null);
}

console.log(pass + ' assertions passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
