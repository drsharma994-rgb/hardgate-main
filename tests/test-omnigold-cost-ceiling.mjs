/**
 * hg-v919 — the cost ceiling is a stop width, and it moves with the venue.
 *
 * costR = rtCostPct / stopPct exactly, so OMNIGOLD's 0.15R scalp and 0.30R
 * swing ceilings are not scores — they are a minimum stop the geometry must
 * reach, and it depends entirely on the venue: 0.133% at XM, 1.733% at PAXG.
 * On the replay the ceiling alone vetoes 96.1% of scalp rows at PAXG against
 * 16.4% at XM, and PAXG is the fail-closed default.
 *
 * This guard re-derives the inversion, the veto shares (from the walk) and
 * the stop-band table (from the evidence file, via the generator). It also
 * pins the REFUSAL: the two fill bounds give opposite slopes for gross-vs-
 * stop-width, so nothing widens a stop on the strength of the cost arithmetic.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m + ' — got ' + a + ', want ~' + b);

const src = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
const W = {};
const ctx = {
  window: W, self: W, globalThis: W, Math, Date, JSON, isFinite, parseFloat, parseInt,
  Array, Object, String, Number, setTimeout: () => 0, clearTimeout: () => {},
  console: { log(){}, warn(){}, error(){} },
  document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
              addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem(){} },
  location: { href: '' }, fetch: () => Promise.reject(new Error('offline'))
};
vm.createContext(ctx);
try { vm.runInContext(src, ctx, { timeout: 30000 }); } catch (e) { /* guards its own env */ }
const DEMAND = W.hgOgCostCeilingDemand, NOTE = W.hgOgCostCeilingNote;
const PANEL = W.hgOgCostCeilingPanelHtml, SETV = W.hgOgSetVenue;
const TABLE = W.HG_OG_REPLAY_EVIDENCE;
for (const [f, n] of [[DEMAND, 'hgOgCostCeilingDemand'], [NOTE, 'hgOgCostCeilingNote'],
                      [PANEL, 'hgOgCostCeilingPanelHtml'], [SETV, 'hgOgSetVenue']])
  ok(typeof f === 'function', 'omnigold.js exports ' + n);

/* ---- 1. the inversion is exact, not approximate ---- */
console.log('1. ceiling x min stop width == the round trip, exactly');
for (const venue of ['XM', 'PAXG']){
  SETV(venue);
  for (const scalp of [true, false]){
    const d = DEMAND({ scalp, px: 4500 });
    ok(d, venue + ' ' + (scalp ? 'SCALP' : 'SWING') + ' resolves');
    if (!d) continue;
    eq(d.venue, venue, 'it reports the venue in force');
    eq(d.lane, scalp ? 'SCALP' : 'SWING', 'and the lane');
    /* THE identity: costR = rt/stopPct, so stopPct_min = rt/ceiling */
    near(d.minStopPct * d.ceilingR, d.rtCostPct, 1e-12,
      venue + ' ' + d.lane + ': minStopPct x ceiling reproduces the round trip');
    near(d.minStopUsd, 4500 * d.minStopPct / 100, 1e-9, 'and the dollar figure is that percent of price');
    /* a stop exactly at the minimum sits exactly on the ceiling */
    near(d.rtCostPct / d.minStopPct, d.ceilingR, 1e-12, 'a stop at the minimum lands on the ceiling');
  }
}
/* the numbers the comment and the panel both quote */
SETV('XM');
near(DEMAND({ scalp: true, px: 4500 }).minStopPct, 0.1333, 5e-4, 'XM SCALP asks 0.133%');
near(DEMAND({ scalp: true, px: 4500 }).minStopUsd, 6, 0.01, 'which is $6 on $4500 gold');
near(DEMAND({ scalp: false, px: 4500 }).minStopUsd, 3, 0.01, 'XM SWING asks $3');
SETV('PAXG');
near(DEMAND({ scalp: true, px: 4500 }).minStopPct, 1.7333, 5e-4, 'PAXG SCALP asks 1.733%');
near(DEMAND({ scalp: true, px: 4500 }).minStopUsd, 78, 0.01, 'which is $78 on $4500 gold');
near(DEMAND({ scalp: false, px: 4500 }).minStopUsd, 39, 0.01, 'PAXG SWING asks $39');
{
  SETV('XM'); const x = DEMAND({ scalp: true, px: 4500 });
  SETV('PAXG'); const p = DEMAND({ scalp: true, px: 4500 });
  near(p.minStopPct / x.minStopPct, 13, 0.01, 'PAXG asks 13x the stop XM does — same rule, same R');
  eq(p.ceilingR, x.ceilingR, 'while the ceiling in R is identical, which is the point');
}

/* ---- 2. the veto shares are re-derived from the walk ---- */
console.log('2. what the ceiling costs the book, re-derived');
{
  const walk = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-omnigold-results.json'), 'utf8'));
  const rows = walk.trades.filter((t) => typeof t.rMultiple === 'number');
  const stopPct = (t) => (typeof t.entry === 'number' && typeof t.stop === 'number' && t.entry > 0)
    ? Math.abs(t.entry - t.stop) / t.entry * 100 : 0;
  const baked = TABLE && TABLE.costCeilingVeto;
  ok(baked, 'the constant carries costCeilingVeto');
  for (const [lane, ceil] of [['SCALP', 0.15], ['SWING', 0.30]]){
    const lane_rows = rows.filter((t) => t.horizon === lane);
    ok(lane_rows.length > 1000, lane + ' has a real population (' + lane_rows.length + ')');
    for (const [venue, rt] of [['XM', 0.020], ['PAXG', 0.26]]){
      const passed = lane_rows.filter((t) => stopPct(t) > 0 && rt / stopPct(t) <= ceil).length;
      const share = 1 - passed / lane_rows.length;
      near(baked[lane][venue], Math.round(share * 1000) / 1000, 0.0011,
        lane + ' at ' + venue + ' vetoes ' + (share * 100).toFixed(1) + '% — matches the baked figure');
    }
  }
  /* the headline asymmetry, stated in the source a reader will hit */
  ok(baked.SCALP.PAXG > 0.95, 'PAXG vetoes over 95% of scalp rows');
  ok(baked.SCALP.XM < 0.20, 'XM vetoes under 20%');
  ok(baked.SWING.XM < 0.01, 'and essentially no swing rows at XM');
  for (const n of ['96.1%', '16.4%', '47.4%', '0.1%', '1.733%', '0.133%', '$78', '$6'])
    ok(src.includes(n), 'omnigold.js states ' + n);
  /* the bound cannot be what produces the asymmetry: it deletes rows, never
     changes a stop. Re-derive on the lower-bound pool and require it to hold. */
  const lowerPool = rows.filter((t) => !t.ambiguousSameBarWin);
  const scalpLower = lowerPool.filter((t) => t.horizon === 'SCALP');
  const passedLower = scalpLower.filter((t) => stopPct(t) > 0 && 0.26 / stopPct(t) <= 0.15).length;
  ok(1 - passedLower / scalpLower.length > 0.95,
     'and it still vetoes over 95% on the lower-bound pool, so the bound is not the cause');
}

/* ---- 3. THE REFUSAL: the slope flips between the bounds ---- */
console.log('3. gross-vs-stop-width has no verdict, and says so');
{
  const bands = TABLE && TABLE.stopBandGross;
  ok(bands, 'the constant carries stopBandGross');
  const ev = JSON.parse(readFileSync(join(ROOT, 'scripts/omnigold-replay-evidence.json'), 'utf8'));
  const lo = ev.sequentialBake.sequentialByStopBand, hi = ev.sequentialBake.sequentialByStopBandUpper;
  ok(lo && hi, 'and the evidence file carries both ends');
  let checked = 0;
  for (const [k, v] of Object.entries(bands)){
    ok(lo[k] && hi[k], k + ' exists at both ends');
    if (!lo[k] || !hi[k]) continue;
    checked++;
    eq(v.lo[0], lo[k].n, k + ' lower n');
    eq(v.lo[1], lo[k].grossR, k + ' lower gross');
    eq(v.hi[0], hi[k].n, k + ' upper n');
    eq(v.hi[1], hi[k].grossR, k + ' upper gross');
  }
  ok(checked >= 6, 're-derived every band (' + checked + ')');
  /* the refusal itself: tightest band is negative at one end and positive at
     the other, so the two ends cannot both be describing the same market */
  const tight = bands['<0.133'], wide = bands['>=1.733'];
  ok(tight && wide, 'the tightest and widest bands are both carried');
  ok(tight.lo[1] < 0 && tight.hi[1] > 0,
     'the tightest band is ' + tight.lo[1] + 'R at one bound and +' + tight.hi[1] + 'R at the other');
  const slopeLo = wide.lo[1] - tight.lo[1], slopeHi = wide.hi[1] - tight.hi[1];
  ok(slopeLo > 0, 'lower bound: gross RISES with stop width (+' + slopeLo.toFixed(3) + ')');
  ok(slopeHi < 0, 'upper bound: gross FALLS with stop width (' + slopeHi.toFixed(3) + ')');
  ok((slopeLo > 0) !== (slopeHi > 0), 'so the slope flips sign and the question is unanswered');
  ok(/THE INFERENCE THE COST ARITHMETIC INVITES, AND WHY IT IS NOT/.test(src),
     'omnigold.js records the refusal');
  ok(/slope FLIPS SIGN between the ends/.test(src), 'and names the reason');
  ok(/nothing here widens a stop, moves a ceiling, or ranks a setup/i.test(src),
     'and states that nothing acts on it');
}

/* ---- 4. it reaches the reader, and claims nothing more ---- */
console.log('4. the panel and the veto reason');
{
  SETV('PAXG');
  const p = String(PANEL({ px: 4500 }) || '');
  ok(p.includes('1.733%') && p.includes('$78.00'), 'the PAXG panel shows the demand it makes');
  ok(/96\.1%/.test(p), 'and what that cost the measured book');
  ok(/fail-closed default/.test(p), 'it names PAXG as the default');
  ok(p.includes('0.133%') && p.includes('16.4%'), 'and shows what XM would ask instead');
  ok(/may be the venue rather than the tape/.test(p), 'so an empty scan is attributable');
  ok(/NOT settled/.test(p), 'the widest-stop question is marked unsettled on the panel too');
  ok(/Nothing here widens a stop or moves a ceiling/.test(p), 'and the panel disclaims acting');
  SETV('XM');
  const x = String(PANEL({ px: 4500 }) || '');
  ok(x.includes('0.133%') && x.includes('$6.00'), 'the XM panel shows its own, much smaller demand');
  ok(!/fail-closed default/.test(x), 'and the default-venue warning appears only on the default');
  ok(!/undefined|NaN/.test(p + x), 'nothing leaks into either panel');
  ok(/\+ hgOgCostCeilingPanelHtml\(\)/.test(src), 'and the panel is wired into a rendered chain');
  /* the gate reason carries the demand when, and only when, it vetoes */
  ok(/if \(costR > costCeil\)\{/.test(src), 'the veto branch is guarded');
  ok(/costWhy \+= ' · ' \+ demand/.test(src), 'and appends the demand to the reason');
}

/* ---- 5. absent stays absent ---- */
console.log('5. no invented price, no invented venue');
{
  SETV('PAXG');
  const noPx = DEMAND({ scalp: true });
  ok(noPx, 'a demand with no price still resolves the percentage');
  eq(noPx.minStopUsd, null, 'but its dollar figure is null, not a default spot');
  eq(noPx.px, null, 'and it reports no price');
  ok(!/\$/.test(NOTE({ scalp: true })), 'the note omits dollars entirely rather than guessing');
  ok(NOTE({ scalp: true }).includes('1.733%'), 'while still stating the percentage');
  const pn = String(PANEL({}) || '');
  ok(pn.includes('price unavailable'), 'and the panel says so rather than printing $NaN');
  ok(!/\$NaN|\$null|\$undefined/.test(pn), 'no broken dollar figure reaches the page');
  /* no options is not an error: the lane defaults to SWING and the price is
     simply absent. What matters is that it never throws and never invents a
     dollar figure. */
  const bare = DEMAND(null);
  ok(bare && bare.lane === 'SWING', 'no options defaults to the SWING lane rather than throwing');
  eq(bare.minStopUsd, null, 'and still carries no dollar figure');
  ok(isFinite(bare.minStopPct) && bare.minStopPct > 0, 'while the percentage it demands is real');
  /* an unknown venue must not silently become a priced one */
  eq(SETV('BITMEX'), false, 'an unknown venue is refused');
  ok(DEMAND({ scalp: true, px: 4500 }).venue === 'PAXG', 'and the venue in force is unchanged');
}

/* ---- 6. the generator produces what is on disk ---- */
console.log('6. the stop-band table comes from the generator');
{
  const out = execFileSync(process.execPath,
    [join(ROOT, 'scripts/omnigold-evidence-bake.mjs'), '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const fresh = JSON.parse(out);
  const ev = JSON.parse(readFileSync(join(ROOT, 'scripts/omnigold-replay-evidence.json'), 'utf8'));
  for (const k of ['sequentialByStopBand', 'sequentialByStopBandUpper']){
    ok(fresh[k], 'a fresh bake produces ' + k);
    eq(JSON.stringify(fresh[k]), JSON.stringify(ev.sequentialBake[k]),
       k + ' on disk matches the generator right now');
  }
  ok(JSON.stringify(fresh.sequentialByStopBand) !== JSON.stringify(fresh.sequentialByStopBandUpper),
     'the two ends are genuinely different tables');
  /* the band edges are the shipped thresholds, not invented ones */
  const gen = readFileSync(join(ROOT, 'scripts/omnigold-evidence-bake.mjs'), 'utf8');
  {
    const m = gen.match(/STOP_BAND_EDGES = \[([^\]]+)\]/);
    ok(m, 'the generator declares STOP_BAND_EDGES');
    const edges = m ? m[1].split(',').map((x) => parseFloat(x)) : [];
    ok(edges.length === 6 && edges.every((e, i) => i === 0 || e > edges[i - 1]),
       'six edges, strictly increasing — got ' + JSON.stringify(edges));
    for (const want of [0.133, 0.16, 0.32, 0.5, 0.867, 1.733])
      ok(edges.some((e) => Math.abs(e - want) < 1e-9), 'the edges include ' + want);
  }
  ok(/No band edge is invented/.test(gen.replace(/\s+/g, ' ')), 'and the generator says they are the shipped ones');
  /* The banding skips a degenerate stop rather than dividing by it. THIS WALK
     contains none, so that guard is unobservable here and a mutation removing
     it survives — an equivalent mutant on this data, not an untested path.
     Assert the premise instead, so the day a walk DOES carry one, this line
     goes red and the guard becomes observable at the same moment. */
  {
    const walk2 = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-omnigold-results.json'), 'utf8'));
    const degenerate = walk2.trades.filter((t) => typeof t.rMultiple === 'number')
      .filter((t) => !(typeof t.entry === 'number' && typeof t.stop === 'number'
                       && t.entry > 0 && Math.abs(t.entry - t.stop) > 0));
    eq(degenerate.length, 0, 'no walk row has a degenerate stop, so the skip is unobservable here');
    ok(/if \(!\(pct > 0\)\) return null;/.test(gen), 'the generator guards it anyway');
  }
  SETV('XM');
  near(DEMAND({ scalp: true }).minStopPct, 0.1333, 5e-4, '0.133 is the XM scalp demand, not a chosen edge');
  SETV('PAXG');
  near(DEMAND({ scalp: true }).minStopPct, 1.7333, 5e-4, 'and 1.733 is the PAXG one');
  near(DEMAND({ scalp: false }).minStopPct, 0.8667, 5e-4, 'and 0.867 the PAXG swing one');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : '') + pass + ' assertions passed');
if (fail) process.exit(1);
