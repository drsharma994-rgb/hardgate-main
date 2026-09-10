/* HARDGATE — hg-v700 NEW GOLD honesty + floor-coherence tests (newgold.js).

   WHAT THIS PROVES, each against the replay evidence that demanded it
   (scripts/backtest-newgold-results.json, n=11 settled, 34 fires):

     B1  RR HONESTY — rr1/rr2 print against the FINAL plan. Until hg-v700
         rr divided by the pre-widening FVG risk while entry/stop/t1/t2 were
         reassigned from hgPlanFromRisk: every stop-widened settled trade
         printed rr1 > 1.5 (3.96 / 36.55 / 6.39 / 2.90 / 2.43 / 1.92) for a
         T1 that pays exactly 1.5R of the FINAL stop; all 5 natural trades
         printed 1.50. Solidity G4 (rr >= minRr + 0.25) passed ONLY on the
         inflated cards.
     B2  'UNMITIGATED' IS NOW A CHECKED CLAIM — a gap a later closed bar
         traded through stops counting as the structure leg (fail closed),
         and the label prints only when the check ran (the v536 label rule).
     B3  ONE COMPOSED STOP FLOOR — venue 8x-round-trip leg (omnigold's own
         constants) composed with the v681 0.5xATR leg BEFORE the plan is
         built. Replay: 16 of 28 1H fires stood aside at the venue floor
         (counters.horizons.1H stoodAsideStopFloor=16), 14 of them AFTER
         plans had already widened the stop — widen-then-reject on the same
         fire. Invariant here: a fire that widens never then rejects at the
         same floor.
     B4  confluenceCount reflects reality — the measured distinct-class
         count from the shared formation verdict, fallback 2 (structure +
         momentum, the classes the signal's own reads span), never the old
         hard-coded 3.

   Pattern per tests/test-goldscalp-stopfloor.mjs (hg-v699): direct-drive
   the exported functions + a pipeline invariant through the shared
   formation. Boot mirrors tests/test-v698-gold-formation.mjs.

   Run: node tests/test-newgold-honesty.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, label) => { if (c){ pass++; console.log('  ok   —', label); } else { fail++; console.log('  FAIL —', label); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(files){
  const ctx = { console:{ log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object, Number, String,
    Promise, RegExp, Error, TypeError, Map, Set, Symbol, Intl,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent, AbortController };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState:'visible', readyState:'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent:'node', onLine:false };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  /* the desk's real execution venue (XM, 0.020% RT) — the DOCUMENTED
     override, precedence #1 (omnigold.js hgOgVenueCost), same as the
     backtest harness that produced the evidence this test cites */
  ctx.HG_OG_VENUE = 'XM';
  return ctx;
}

const CORE = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
  'hg-forward.js','hg-gates.js','hg-plan.js','formation.js','hg-solidity.js',
  'backtest-tab-params.js','gold-session.js','goldind.js','gold-catalog.js',
  'gold-formation.js','omniroute.js','omnigold.js'];

const W = boot(CORE.concat(['newgold.js']));

/* ---------- deterministic triple-confirmation fixture --------------------
   70 closed 1h bars ending Monday 2026-06-01 18:00 UTC (NY-PM cohort, the
   measured-confirming session): a zigzag uptrend (VWMA-50 below price, RSI
   not pinned), a bull FVG [4000.0, 4000.6], a dip that flattens inside the
   gap (SMA9-of-RSI converges onto RSI; lows never pierce gapLo, so the gap
   stays unmitigated), then an up bar closing inside the gap that crosses
   RSI(14) above its 9-SMA. Raw FVG risk = 0.5 — deliberately far inside the
   XM venue floor (8 x 0.020% of ~4000 = ~6.4) so the composed floor MUST
   act, exactly the geometry class the replay measured being widened then
   rejected (fireLog, 14 of the 16 1H stop-floor stand-asides). */
function mkTightFixture(){
  const rows = [];
  const t0 = Math.floor(Date.UTC(2026, 5, 1, 18, 0, 0) / 1000);
  const n = 70;
  const t = i => t0 - (n - 1 - i) * 3600;
  let c = 3950;
  for (let i = 0; i < 50; i++){
    c += (i % 2 === 0) ? 1.6 : -0.5;
    rows.push({ t: t(i), o: c - 0.2, h: c + 0.45, l: c - 0.5, c: +c.toFixed(2), v: 1000 });
  }
  /* bull FVG: low[52]=4000.6 > high[50]=4000.0, bull body bar 51 */
  rows.push({ t: t(50), o: 3999.5, h: 4000.0, l: 3999.2, c: 3999.9, v: 1000 });
  rows.push({ t: t(51), o: 4000.2, h: 4001.6, l: 4000.1, c: 4001.5, v: 1200 });
  rows.push({ t: t(52), o: 4001.6, h: 4002.2, l: 4000.6, c: 4001.9, v: 1000 });
  /* fast 5-bar dip into the gap, then an 11-bar alternating flat tail */
  const dipStart = 4001.8, dipEnd = 4000.1, dipFast = 5, dipLen = 16;
  const closes = [];
  for (let k = 0; k < dipFast; k++) closes.push(dipStart - (dipStart - dipEnd) * ((k + 1) / dipFast));
  for (let k = 0; k < dipLen - dipFast; k++) closes.push(dipEnd + ((dipLen - dipFast - 1 - k) % 2 === 0 ? 0 : 0.05));
  for (let k = 0; k < closes.length; k++){
    const c2 = +closes[k].toFixed(2);
    const o2 = k === 0 ? dipStart + 0.1 : +closes[k - 1].toFixed(2);
    rows.push({ t: t(53 + k), o: o2, h: Math.max(o2, c2) + 0.18,
                l: Math.max(Math.min(o2, c2) - 0.12, 4000.05), c: c2, v: 900 });
  }
  /* trigger bar: close 4000.5, inside the gap, RSI crosses up */
  rows.push({ t: t(69), o: 4000.12, h: 4000.55, l: 4000.07, c: 4000.5, v: 1300 });
  return rows;
}

/* same tape, gap widened to [3992.0, 4000.6] (8.58 > the ~6.4 venue floor)
   so the stop needs NO widening — the natural-geometry control */
function mkWideFixture(){
  const rows = mkTightFixture();
  rows[50] = { ...rows[50], o: 3991.5, h: 3992.0, l: 3991.2, c: 3991.9 };
  rows[69] = { ...rows[69], c: 4000.58, h: 4000.63 };
  return rows;
}

console.log('\n--- B2: mitigation is CHECKED (ngDetectLastFvgs) ---');
{
  ok(typeof W.ngDetectLastFvgs === 'function', 'ngDetectLastFvgs is exported (hg-v700)');
  /* bull gap [101, 101.5] on a minimal 3-bar tape */
  const A = [
    { o: 100,   h: 101,   l: 99,    c: 100.5, v: 1 },
    { o: 100.6, h: 102.5, l: 100.4, c: 102.4, v: 1 },
    { o: 102.5, h: 103.5, l: 101.5, c: 103,   v: 1 }
  ];
  const f0 = W.ngDetectLastFvgs(A);
  ok(f0.bullBot === 101 && f0.bullTop === 101.5, 'fresh bull gap [101, 101.5] is found');
  /* a later bar DIPS INTO the gap but does not cover it -> still valid */
  const dip = A.concat([{ o: 103, h: 103.2, l: 101.2, c: 102.8, v: 1 }]);
  const f1 = W.ngDetectLastFvgs(dip);
  ok(f1.bullBot === 101 && f1.bullTop === 101.5,
     'a partial dip (low 101.2 > gapLo 101) does NOT mitigate — the zone survives');
  /* a later bar trades THROUGH the gap (low <= gapLo) -> excluded, fail closed */
  const thru = A.concat([{ o: 103, h: 103.2, l: 100.9, c: 102.8, v: 1 }]);
  const f2 = W.ngDetectLastFvgs(thru);
  ok(!isFinite(f2.bullTop), 'a traded-through bull gap (low 100.9 <= gapLo 101) is EXCLUDED');
  /* bear mirror: gap [96.5, 97] at the last bar; a later high >= gapHi kills it */
  const B = [
    { o: 98,   h: 99,   l: 97,   c: 98,   v: 1 },
    { o: 97.9, h: 98,   l: 96.6, c: 96.7, v: 1 },
    { o: 96.6, h: 96.5, l: 95.5, c: 95.8, v: 1 }
  ];
  const g0 = W.ngDetectLastFvgs(B);
  ok(g0.bearTop === 97 && g0.bearBot === 96.5, 'fresh bear gap [96.5, 97] is found');
  const gThru = B.concat([{ o: 95.8, h: 97.1, l: 95.6, c: 96.2, v: 1 }]);
  const g2 = W.ngDetectLastFvgs(gThru);
  ok(!isFinite(g2.bearTop), 'a traded-through bear gap (high 97.1 >= gapHi 97) is EXCLUDED');
  /* garbage-safe */
  let threw = false;
  try { W.ngDetectLastFvgs(null); W.ngDetectLastFvgs([]); W.ngDetectLastFvgs([{}, {}, {}]); }
  catch (e){ threw = true; }
  ok(!threw, 'never throws on null/empty/garbage rows');
}

console.log('\n--- B2: the label prints only what was checked (ngConfirmations) ---');
{
  const checked = { dir: 'long', fvg: { top: 4010, bot: 3990, ageBars: 3, mitigationChecked: true },
    ml: { baseline: 3995, regime: 'bullish' }, rsi: { now: 55, sma: 50 },
    entry: 4000, stop: 3990, t1: 4015, kind: 'TRIPLE-CONF' };
  const cA = W.ngConfirmations(checked, { tape: { dir: '', src: '' }, nowMs: Date.UTC(2026, 5, 1, 18, 0) });
  const structA = cA.filter(x => x.cls === 'structure')[0];
  ok(/unmitigated/.test(structA.detail),
     'a mitigation-CHECKED fvg prints the unmitigated label — ' + structA.detail.slice(0, 70));
  const unchecked = { ...checked, fvg: { top: 4010, bot: 3990, ageBars: 3 } };
  const cB = W.ngConfirmations(unchecked, { tape: { dir: '', src: '' }, nowMs: Date.UTC(2026, 5, 1, 18, 0) });
  const structB = cB.filter(x => x.cls === 'structure')[0];
  ok(!/unmitigated/.test(structB.detail),
     'an UNCHECKED fvg never claims unmitigated (v536: labels print what was checked)');
  /* the unconditional label is gone from the source */
  const src = read('newgold.js');
  ok(!/bars old, unmitigated'\)/.test(src), 'the unconditional "bars old, unmitigated" string is removed');
}

console.log('\n--- B3: venue floor leg reads omnigold\'s own constants ---');
{
  ok(typeof W.ngVenueFloorDist === 'function', 'ngVenueFloorDist is exported (hg-v700)');
  const vc = W.hgOgVenueCost();
  const want = 4000 * (vc.rtCostPct / 100) / W.HG_OG_FORM_COST_R_MAX;
  const got = W.ngVenueFloorDist(4000);
  ok(Math.abs(got - want) / want < 1e-5,
     'floor distance = entry x rtCostPct% / HG_OG_FORM_COST_R_MAX (' + got.toFixed(3) + ' ~ 8x the '
     + vc.venue + ' round trip on 4000)');
  ok(isNaN(W.ngVenueFloorDist(NaN)) && isNaN(W.ngVenueFloorDist(-5)) && isNaN(W.ngVenueFloorDist(0)),
     'non-finite / non-positive entry -> NaN (no floor invented)');
  /* venue machinery missing -> NaN, fail closed (hgGoldFormation still
     refuses to form without the cost model — gold-formation.js) */
  const saved = W.hgOgVenueCost;
  W.hgOgVenueCost = undefined;
  ok(isNaN(W.ngVenueFloorDist(4000)), 'venue cost unreadable -> NaN, never a guessed floor');
  W.hgOgVenueCost = saved;
}

console.log('\n--- B1 + B3: widened fixture — honest rr, ONE coherent floor ---');
{
  const rows = mkTightFixture();
  const s = W.ngAssess(rows);
  ok(!!s && s.dir === 'long', 'tight-gap fixture fires long (raw FVG risk 0.5 on a ~4000 entry)');
  if (s){
    const finalRisk = Math.abs(s.entry - s.stop);
    /* B1: rr equals |t1-entry|/|entry-stop| of the FINAL plan */
    ok(Math.abs(s.rr1 - Math.abs(s.t1 - s.entry) / finalRisk) < 1e-9,
       'rr1 = |t1-entry| / |entry-stop| of the FINAL plan (evidence: widened trades printed 3.96..36.55 pre-fix)');
    ok(Math.abs(s.rr1 - 1.5) < 1e-6, 'rr1 prints 1.5 — T1 pays 1.5R of the FINAL stop, exactly what the card says');
    ok(Math.abs(s.rr2 - 2.5) < 1e-6, 'rr2 prints 2.5 of the FINAL stop');
    ok(Math.abs(s.risk - finalRisk) < 1e-9 && Math.abs(s.riskPct - finalRisk / s.entry * 100) < 1e-9,
       'risk / riskPct are FINAL-geometry too (anything derived, per hg-v700)');
    /* B3: the stop cleared the venue floor in ONE pass */
    ok(s.stopWidened === true, 'stop is flagged widened');
    ok(s.stopWidenedTo === 'venue floor (8× round trip)',
       'the card names the leg that bound: ' + s.stopWidenedTo);
    ok(finalRisk >= W.ngVenueFloorDist(s.entry) * (1 - 1e-9),
       'final stop distance >= the venue floor (composed BEFORE hgPlanFromRisk)');
    const drag = W.hgOgCostDrag({ entry: s.entry, stop: s.stop });
    ok(!!drag && drag.costR <= W.HG_OG_FORM_COST_R_MAX + 1e-12,
       'hgOgCostDrag on the FINAL plan reads costR ' + drag.costR.toFixed(4)
       + ' <= ' + W.HG_OG_FORM_COST_R_MAX + ' — the exact bar hgOgFormation rejects at');
    /* pipeline invariant: NO widen-then-reject on the same fire. Replay
       measured 14 of the 16 1H stop-floor stand-asides arriving ALREADY
       widened (backtest-newgold-results.json fireLog). */
    const conf = W.ngConfirmations(s, { tape: { dir: 'long', src: '4H VWMA-50 regime' }, rows });
    const f = W.hgGoldFormation(
      { kind: s.kind, horizon: '1H', dir: s.dir,
        plan: { entry: s.entry, stop: s.stop, t1: s.t1, rr1: s.rr1 },
        entry: s.entry, stop: s.stop, t1: s.t1 },
      { tab: 'NEWGOLD:1H', mechanic: 'TRIPLE-CONF', confirmations: conf,
        requireClasses: ['session-htf'] });
    ok(!f.stopFloor && !/stop inside 8x/.test((f.reasons || []).join(' ')),
       'the shared formation does NOT stand the widened fire aside at the stop floor (state ' + f.state + ')');
    /* B2 pipeline leg: pierce the trigger bar's low through gapLo -> the
       traded-through gap stops being the structure leg, so this exact
       tape no longer fires off it */
    const rowsMit = rows.map(r => ({ ...r }));
    rowsMit[69] = { ...rowsMit[69], l: 3999.9 };
    const sMit = W.ngAssess(rowsMit);
    ok(!sMit, 'the same tape with the gap traded through (low 3999.9 <= gapLo 4000.0) does NOT fire');
    const dMit = W.ngDetectLastFvgs(rowsMit);
    ok(!(dMit.bullBot === 4000 && dMit.bullTop === 4000.6),
       'the traded-through gap [4000.0, 4000.6] is never returned as the structure leg');
  }
}

console.log('\n--- B3 control: natural geometry is untouched ---');
{
  const s = W.ngAssess(mkWideFixture());
  ok(!!s && s.dir === 'long', 'wide-gap fixture fires long (raw FVG risk 8.58 > the ~6.4 venue floor)');
  if (s){
    ok(s.stop === 3992 && s.stopWidened !== true && s.stopWidenedTo === '',
       'stop stays at the FVG edge — the floor only ever widens marginal geometry, never touches natural stops');
    ok(Math.abs(s.rr1 - 1.5) < 1e-6, 'natural rr1 still prints 1.5 (the 5 natural replay trades all printed 1.50)');
  }
}

console.log('\n--- B4: confluenceCount reflects reality ---');
{
  const src = read('newgold.js');
  ok(!/confluenceCount:\s*3\b/.test(src), 'the hard-coded confluenceCount: 3 is gone');
  const s = W.ngAssess(mkTightFixture());
  ok(!!s && s.confluenceCount === 2,
     'ngAssess fallback is 2 — structure + momentum, the classes the signal\'s own reads span (v698 note)');
  /* through the scan: the shared formation verdict's measured class count
     is stamped over the fallback (the OMNI lane has done this since v698;
     the primary lane never did) */
  const rows = mkTightFixture();
  W.hgOgFetchRows = (tf, n2) => Promise.resolve({ rows, source: 'fixture' });
  const p = await W.ngRunScan();
  const rec = (p.results || []).filter(r => r.setup && r.horizon === '1H')[0];
  ok(!!rec && !!rec.formation && !!rec.formation.confluence,
     'scan produced a 1H record with a formation verdict');
  if (rec && rec.formation && rec.formation.confluence){
    ok(rec.setup.confluenceCount === rec.formation.confluence.classCount,
       'setup.confluenceCount === the formation verdict\'s measured distinct-class count ('
       + rec.formation.confluence.classCount + ')');
    ok(rec.setup.confluenceCount !== 2 || rec.formation.confluence.classCount === 2,
       'the fallback stands only when the verdict carries no count');
  }
}

console.log('\n' + pass + ' assertions passed' + (fail ? (', ' + fail + ' FAILED') : ''));
if (fail) process.exit(1);
console.log('OK - hg-v700: NEW GOLD honesty (rr vs final plan, checked mitigation, composed stop floor, real confluenceCount)');
