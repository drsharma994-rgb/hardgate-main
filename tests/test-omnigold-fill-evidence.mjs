/* HARDGATE — the fill rate is a measurement, and a missing input is not a
   measurement of zero.

   Every LIMIT setup on the OMNIGOLD tab carries a fill probability. It comes
   from hgFillProbability in formation.js, which replays the tape and counts
   how often a 12-bar window touched the entry zone. When it cannot answer it
   returns a SENTINEL — { prob: null, pct: null, note: 'fill history n/a' }.

   Four separate readings turned an absence into a quoted statistic, and all
   four reached the card:

     omnigold's guard was `isFinite(+fill.pct)`. +null is 0, isFinite(0) is
     true, so "I have no history" arrived as a measured 0% fill chance. It
     overwrote the gap-ATR estimate, tripped the < 35 demote, cost the setup
     ten conviction points, and printed "· thin fill" on the card.

     A null ENTRY cleared `isFinite(+entry)` inside the function as the price
     zero, and the sentinel never fired at all: the answer came back
     "0% of past 12-bar windows touched this zone (n=177)" — a fabricated
     measurement carrying a sample size.

     A null ZONE BOUND cleared `isFinite(zone.lo)` the same way (isFinite(null)
     is true) and collapsed the zone to [0, hi], which every bar is inside:
     "100% of past 12-bar windows touched this zone (n=177)".

     A null bar LOW inside the touch test read as 0 — below any zone above
     zero — so a hole in the feed counted as a touch. Measured on the tapes
     below: a zone the tape never reached went 0% -> 100%, and a zone at the
     median close went 49% -> 82%.

   And the evidence behind the verdict was computed and thrown away:
   plan.fillNote was assigned and never rendered, so a reader saw "thin fill"
   and not the sample it came from.

   Every assertion here is driven against the original arithmetic,
   reimplemented in this file, so none of them can pass by accident.

   Run: node tests/test-omnigold-fill-evidence.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(files){
  const doc = { getElementById: () => null,
                createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
                querySelector: () => null, querySelectorAll: () => [],
                head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, document: doc,
                setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {},
                fetch: () => Promise.reject(new Error('no net')),
                localStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of files){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  return ctx;
}

const T = 1700000000 - (1700000000 % 86400);
const mk = (n, seed) => {
  let p = 4000, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const out = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    out.push({ t: T + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1000 });
  }
  return out;
};

/* THE ORIGINAL ARITHMETIC. Kept verbatim so every claim below is checkable
   rather than asserted. */
const looseFill = (rows, entry, dir, zone, maxBars) => {
  const out = { prob: null, pct: null, note: 'fill history n/a' };
  maxBars = maxBars || 12;
  if (!rows || rows.length < maxBars + 10 || !isFinite(+entry)) return out;
  let lo = (zone && isFinite(zone.lo)) ? +zone.lo : +entry;
  let hi = (zone && isFinite(zone.hi)) ? +zone.hi : +entry;
  if (lo > hi){ const t = lo; lo = hi; hi = t; }
  let touches = 0, trials = 0;
  for (let i = 10; i < rows.length - maxBars - 1; i++){
    let touched = false;
    for (let j = i; j < i + maxBars && j < rows.length; j++){
      const bar = rows[j];
      if (!bar) continue;
      if (+bar.l <= hi && +bar.h >= lo){ touched = true; break; }
    }
    trials++;
    if (touched) touches++;
  }
  if (!trials) return out;
  out.prob = touches / trials;
  out.pct = Math.round(out.prob * 100);
  out.note = out.pct + '% of past ' + maxBars + '-bar windows touched this zone (n=' + trials + ')';
  return out;
};

console.log('== the measurement itself ==');
{
  const F = boot(['formation.js']);
  ok(typeof F.hgFillProbability === 'function', 'hgFillProbability is exported');

  const rows = mk(200, 3);
  const sorted = rows.map(r => r.c).slice().sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const below = rows[rows.length - 1].c * 0.5;          /* a price this tape never traded */

  /* --- the baseline, so the deltas below mean something --- */
  const baseMid = F.hgFillProbability(rows, mid, 'long', null, 12);
  ok(baseMid.pct > 30 && baseMid.pct < 70,
     `a zone at the median close measures ${baseMid.pct}% on a clean tape`);
  const baseFar = F.hgFillProbability(rows, below, 'long', null, 12);
  ok(baseFar.pct === 0, 'and a zone the tape never reached measures 0% — correctly, with evidence');

  /* --- 1. a null entry is not the price zero --- */
  const wasEntry = looseFill(mk(200, 3), null, 'long', null, 12);
  ok(wasEntry.pct === 0 && /n=\d+/.test(wasEntry.note),
     `the +v reading answered a NULL entry with "${wasEntry.note}" — a measurement it never made`);
  const nowEntry = F.hgFillProbability(mk(200, 3), null, 'long', null, 12);
  ok(nowEntry.pct === null && nowEntry.prob === null && nowEntry.note === 'fill history n/a',
     'the shipped function returns its n/a sentinel instead');
  for (const bad of [undefined, '', NaN, 'x', {}]){
    const g = F.hgFillProbability(mk(200, 3), bad, 'long', null, 12);
    ok(g.pct === null, `and the same for entry = ${JSON.stringify(bad)}`);
  }

  /* --- 2. a null zone bound does not collapse the zone --- */
  const wasZone = looseFill(mk(200, 3), 4050, 'long', { lo: null, hi: 4100 }, 12);
  ok(wasZone.pct === 100,
     `the +v reading collapsed {lo:null, hi:4100} to [0, 4100] and reported "${wasZone.note}"`);
  const nowZone = F.hgFillProbability(mk(200, 3), 4050, 'long', { lo: null, hi: 4100 }, 12);
  const refZone = F.hgFillProbability(mk(200, 3), 4050, 'long', null, 12);
  ok(nowZone.pct !== 100, 'the shipped function does not report certainty from a missing bound');
  ok(nowZone.pct === F.hgFillProbability(mk(200, 3), 4050, 'long', { hi: 4100 }, 12).pct,
     'a null bound and an absent bound read the same — both fall back to the entry');
  ok(isFinite(refZone.pct), 'and the no-zone call still measures normally, so the fallback is live');

  /* --- 3. a hole in the feed is not a touch --- */
  const holeFar = mk(200, 3); for (let i = 0; i < holeFar.length; i += 7) holeFar[i].l = null;
  const wasFar = looseFill(holeFar, below, 'long', null, 12);
  ok(baseFar.pct === 0 && wasFar.pct === 100,
     `the +v reading took an unreachable zone from 0% to ${wasFar.pct}% on null lows alone`);
  ok(F.hgFillProbability(holeFar, below, 'long', null, 12).pct === 0,
     'the shipped function still says 0%: a bar with no low did not trade there');

  const holeMid = mk(200, 3); for (let i = 0; i < holeMid.length; i += 3) holeMid[i].l = null;
  const wasMid = looseFill(holeMid, mid, 'long', null, 12);
  ok(wasMid.pct > baseMid.pct + 25,
     `and a real zone from ${baseMid.pct}% to ${wasMid.pct}% with one bar in three missing its low`);
  const nowMid = F.hgFillProbability(holeMid, mid, 'long', null, 12);
  ok(Math.abs(nowMid.pct - baseMid.pct) <= 5,
     `the shipped function reads ${nowMid.pct}% — within five points of the clean tape's ${baseMid.pct}%`);

  /* the asymmetry is what identifies this as the defect rather than noise:
     a null HIGH fails the other half of the test, so it never inflated */
  const holeHi = mk(200, 3); for (let i = 0; i < holeHi.length; i += 3) holeHi[i].h = null;
  const wasHi = looseFill(holeHi, mid, 'long', null, 12);
  ok(wasHi.pct < baseMid.pct,
     `under the +v reading a null HIGH moved the same tape the other way (${wasHi.pct}% vs ${baseMid.pct}%) — `
     + 'one-directional inflation, not symmetric noise');
  const nowHi = F.hgFillProbability(holeHi, mid, 'long', null, 12);
  ok(nowHi.pct === nowMid.pct,
     `and the shipped function treats the two holes identically (${nowHi.pct}% both ways) — a bar `
     + 'missing either side answers nothing');

  /* --- 4. a tape with nothing readable reports nothing --- */
  const allHoles = mk(200, 3);
  for (const r of allHoles) r.l = null;
  const wasAll = looseFill(allHoles, mid, 'long', null, 12);
  ok(wasAll.pct > baseMid.pct + 25,
     `the +v reading answered a tape with NO usable low at all: "${wasAll.note}" `
     + `— against ${baseMid.pct}% on the same tape intact`);
  ok(F.hgFillProbability(allHoles, mid, 'long', null, 12).pct === null,
     'the shipped function falls back to the n/a sentinel — no usable bar, no rate');

  /* --- and it never throws --- */
  let calls = 0;
  for (const bad of [null, undefined, '', NaN, 'x']){
    for (const field of ['o', 'h', 'l', 'c', 't']){
      const r = mk(200, 5); r[120][field] = bad;
      for (const z of [null, { lo: bad, hi: 4100 }, { lo: 4000, hi: bad }, { lo: bad, hi: bad }]){
        let g;
        try { g = F.hgFillProbability(r, mid, 'long', z, 12); }
        catch (e) { throw new Error('FAIL: threw on ' + field + '=' + String(bad) + ' — ' + e.message); }
        calls++;
        if (g.pct !== null && !(g.pct >= 0 && g.pct <= 100))
          throw new Error('FAIL: returned ' + g.pct + '% for ' + field + '=' + String(bad));
      }
    }
  }
  ok(calls === 100, `${calls} malformed calls: every answer is either a percentage or the sentinel`);
}

console.log('\n== what the OMNIGOLD card does with it ==');
{
  const W = boot(['indicators.js', 'indicators2.js', 'formation.js', 'plans.js', 'hg-plan.js',
                  'hg-gates.js', 'omnigold.js']);
  ok(typeof W.hgOgFormTicket === 'function', 'hgOgFormTicket is exported');

  /* A LIMIT setup: the entry sits far enough from the live price that the
     at-market branch does not fire, which is the only branch where the fill
     model is consulted at all. */
  const rows = mk(200, 11);
  const px = rows[rows.length - 1].c;
  const hit = { kind: 'ROUND-MAGNET', dir: 'long' };
  const mkPlan = () => ({ entry: px * 0.99, stop: px * 0.982, dir: 'long' });

  const measured = W.hgOgFormTicket(mkPlan(), hit, rows, { livePx: px }, {});
  ok(measured && /^LIMIT @/.test(String(measured.entryType)),
     `the setup forms as a limit (${measured && measured.entryType})`);
  ok(measured.fillMeasured === true, 'and its fill probability is a measurement');
  ok(/n=\d+/.test(String(measured.fillNote)),
     `carrying its sample: "${measured.fillNote}"`);

  /* THE DEFECT. A tape too short to build a 12-bar window from is exactly
     what makes hgFillProbability return its sentinel. */
  const short = mk(18, 11);
  const shortPx = short[short.length - 1].c;
  const shortAtr = W.hgOgAtrOf(short, 14);
  /* The entry sits one ATR from market: past the 0.25 at-market cut, so the
     fill model IS consulted, and inside the 1.5 gap cut, so the entry gap is
     NOT itself a reason to demote. Whatever demote appears here can only have
     come from the fill model — which is the point. */
  const naEntry = shortPx - shortAtr;
  const na = W.hgFillProbability(short, naEntry, 'long', null, 12);
  ok(na.pct === null, 'a tape too short to build a 12-bar window from returns the sentinel, as designed');
  ok(isFinite(+na.pct) && +na.pct === 0,
     'and the OLD guard `isFinite(+fill.pct)` reads that sentinel as a measured 0%');

  const naPlan = W.hgOgFormTicket(
    { entry: naEntry, stop: naEntry - shortAtr * 2, dir: 'long' },
    hit, short, { livePx: shortPx }, {});
  ok(naPlan && /^LIMIT @/.test(String(naPlan.entryType)), 'the unmeasurable tape still forms a limit setup');
  ok(naPlan.fillMeasured === false, 'the shipped build records that its fill number is NOT a measurement');
  ok(naPlan.fillProb === 50,
     `the gap-ATR estimate stands at ${naPlan.fillProb}% — one ATR from market — instead of `
     + 'being overwritten with a zero nobody measured');
  ok(naPlan.fillDemote !== true,
     'and nothing is demoted for a fill rate that was never measured');
  ok(String(naPlan.fillNote).indexOf('n/a') >= 0,
     `the card is told why: "${naPlan.fillNote}"`);

  /* WHAT THE OLD GUARD DID WITH THAT SAME PLAN, so the fix is not asserted
     against itself. Reproduced here rather than described. */
  const oldGuard = (planFillProb, fill) => {
    const out = { fillProb: planFillProb, fillDemote: undefined };
    if (fill && isFinite(+fill.pct)){
      out.fillProb = +fill.pct;
      if (out.fillProb < 35) out.fillDemote = true;
    }
    return out;
  };
  const wasPlan = oldGuard(50, na);
  ok(wasPlan.fillProb === 0 && wasPlan.fillDemote === true,
     'under the old guard that same setup read 0% and was demoted — ten conviction points and '
     + 'a "· thin fill" label, from a function that had just said it had no history');

  /* THE DEMOTE STILL WORKS WHERE IT IS EARNED. A measured rate under 35 must
     still demote, or this change would have bought silence rather than
     accuracy. */
  let sawLowMeasured = false;
  for (let seed = 1; seed <= 60 && !sawLowMeasured; seed++){
    const r = mk(200, seed);
    const p0 = r[r.length - 1].c;
    const aa = W.hgOgAtrOf(r, 14);
    for (const mult of [3, 5, 8, 12]){
      const e = p0 - aa * mult;
      const pl = W.hgOgFormTicket({ entry: e, stop: e - aa * 2, dir: 'long' }, hit, r, { livePx: p0 }, {});
      if (pl && pl.fillMeasured === true && pl.fillProb < 35){
        ok(pl.fillDemote === true,
           `a MEASURED ${pl.fillProb}% fill still demotes — "${pl.fillNote}"`);
        sawLowMeasured = true;
        break;
      }
    }
  }
  ok(sawLowMeasured, 'and such a setup was actually found, so that assertion ran');
  ok(measured.fillProb >= 0 && measured.fillProb <= 100,
     `a measured fill reads ${measured.fillProb}%, in range`);
}

console.log('\n== the evidence reaches the card ==');
{
  /* plan.fillNote was assigned on every limit setup and never rendered. The
     card showed the verdict — "· thin fill" — and not the sample behind it.
     Driven through the real renderer, not grepped. */
  const W = boot(['indicators.js', 'indicators2.js', 'formation.js', 'plans.js', 'hg-plan.js',
                  'hg-gates.js', 'omnigold.js']);
  ok(typeof W.hgOgSetupCard === 'function', 'the card renderer is reachable');

  const card = (plan) => ({ grade: { evaluated: 5, total: 8, vetoes: [], ticket: false },
                            horizon: 'SWING', kind: 'ROUND-MAGNET', dir: 'long', gates: [], plan });
  const base = { entry: 4000, stop: 3960, t1: 4080, t2: 4120, entryType: 'LIMIT @ ROUND-MAGNET' };
  const line = (html) => {
    const m = String(html).match(/<div class="dim og-fill-line">([^<]*)</);
    return m ? m[1] : null;
  };

  const mHtml = W.hgOgSetupCard(card(Object.assign({}, base, {
    fillProb: 40, fillMeasured: true,
    fillNote: '40% of past 12-bar windows touched this zone (n=177)' })));
  const mLine = line(mHtml);
  ok(mLine !== null, 'a measured fill renders a fill line on the card');
  ok(/n=177/.test(mLine) && /40%/.test(mLine),
     `quoting the rate AND the sample it came from: "${mLine}"`);

  const uHtml = W.hgOgSetupCard(card(Object.assign({}, base, {
    fillProb: 50, fillMeasured: false, fillNote: 'fill history n/a' })));
  const uLine = line(uHtml);
  ok(uLine !== null, 'and an unmeasured fill renders one too, rather than going quiet');
  ok(/NOT measured/.test(uLine),
     `saying so in words: "${uLine}"`);
  ok(/estimate/.test(uLine) && /50%/.test(uLine),
     'and naming the number it IS showing as an estimate from the entry gap');
  ok(!/n=/.test(uLine),
     'with no sample size attached, because there is no sample');

  /* the verdict is still shown — this adds evidence beside it, not instead */
  const tHtml = W.hgOgSetupCard(card(Object.assign({}, base, {
    fillProb: 12, fillMeasured: true, fillDemote: true,
    fillNote: '12% of past 12-bar windows touched this zone (n=177)' })));
  ok(/thin fill/.test(String(tHtml)), 'a demoted setup still carries its "thin fill" label');
  ok(/12% of past 12-bar windows/.test(String(line(tHtml))),
     'and now the label sits next to the measurement that earned it');

  /* a plan with no fill note at all renders no line — the tab does not
     invent a sentence to fill the space */
  ok(line(W.hgOgSetupCard(card(Object.assign({}, base)))) === null,
     'a setup with no fill note renders no fill line');

  /* and the renderer survives whatever is put in those two fields */
  let rendered = 0;
  for (const note of [null, undefined, '', 'x', '<script>alert(1)</script>', 0, NaN, {}]){
    for (const meas of [true, false, undefined, null, 0, 'yes']){
      for (const prob of [40, 0, null, undefined, NaN, '', 'x', -5, 1e9]){
        let html;
        try { html = W.hgOgSetupCard(card(Object.assign({}, base,
          { fillNote: note, fillMeasured: meas, fillProb: prob }))); }
        catch (e) { throw new Error('FAIL: the card threw on fillNote=' + String(note)
                                    + ' fillMeasured=' + String(meas) + ' fillProb=' + String(prob)
                                    + ' — ' + e.message); }
        rendered++;
        const l = line(html);
        if (l && /NaN|undefined|\[object/.test(l))
          throw new Error('FAIL: the fill line rendered "' + l + '"');
      }
    }
  }
  ok(rendered === 8 * 6 * 9,
     `${rendered} card renders across malformed fill fields: none threw, none printed NaN or undefined`);
  ok(/&lt;script&gt;/.test(String(W.hgOgSetupCard(card(Object.assign({}, base,
       { fillNote: '<script>alert(1)</script>', fillMeasured: true }))))),
     'and a fill note is escaped, not injected');
}

console.log('\n' + passed + ' passed, 0 failed');
