/* HARDGATE — the threshold that arithmetic said could never be reached.

   hg-v757 opened the lockout by judging on `gateClear` instead of `ticket`.
   It did not check whether that population can actually get anywhere:

     OMNIGOLD writes             ~48.8 records/day
     spread across (tab, mechanic)  ~108 cells
     gate-clear share                ~15%
     minus the ~18% now excluded as unfilled
       -> about 0.05 usable records per cell per day
     to reach FWD_MIN_JUDGE (20)   ~377 days
     live window at the 4,000 cap   ~27 days

   The log forgets roughly fourteen times faster than a cell fills. Worse,
   it is a steady state: each cell asymptotes around two to five and never
   moves. The key dissolved before it turned.

   Three changes, and this file pins all three:

     1. the gate-clear split FOLDS INTO THE AGGREGATE, which has no cap, so
        a gate-clear query reads all time instead of the last four weeks
     2. the gate POOLS THE THREE GOLD TABS it always could have — the
        settled-evidence panel has pooled them since it was written
     3. PROMOTION MOVES TO THE HORIZON'S BOOK. Per-mechanic evidence costs
        twice: the data splits 108 ways AND the bar is +3.11 sigma because
        there are 54 mechanics. Condemning stays per-mechanic, because
        condemning a mechanic is a claim about that mechanic.

   Run: node tests/test-omnigold-evidence-reach.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const store = {};
const doc = { getElementById: () => null, createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
              querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
              body: { appendChild(){} }, addEventListener(){} };
const ctx = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
              JSON, Date, RegExp, document: doc, setTimeout: () => 0, clearTimeout: () => {},
              addEventListener: () => {}, fetch: () => Promise.reject(new Error('no net')),
              localStorage: { getItem: k => (k in store ? store[k] : null),
                              setItem: (k, v) => { store[k] = String(v); },
                              removeItem: k => { delete store[k]; } } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'hg-forward.js', 'plans.js', 'hg-plan.js',
                 'hg-gates.js', 'omniroute.js', 'omnigold.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade */ }
}
const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

const H = 3600;
const rec = (i, o) => Object.assign(ctx.hgFwdNormalize({
  tab: 'OMNIGOLD:SCALP', mechanic: 'MMOVE', sym: 'XAUUSD', tf: '1h', dir: 'long',
  entry: 4700, stop: 4670, t1: 4760, barT: 1700000000 + i * H, horizonBars: 24
}), o);

console.log('== 1. the gate-clear split survives pruning ==');
{
  const F = ctx.hgFwdFoldOf || ctx.hgFwdFold;
  ok(typeof F === 'function', 'hgFwdFold is reachable');

  const dropped = [
    rec(0, { gateClear: true, state: 't1', stateFill: 't1', fillState: 'filled' }),
    rec(1, { gateClear: true, state: 'stop', stateFill: 'stop', fillState: 'filled' }),
    rec(2, { gateClear: true, state: 't1', fillState: 'unfilled', stateFill: 'unfilled' }),
    rec(3, { gateClear: false, state: 't1' }),      /* not cleared: must not count */
    rec(4, { state: 't1' })                          /* legacy: unknown, must not count */
  ];
  const agg = F({}, dropped);
  const e = agg['OMNIGOLD:SCALP|MMOVE'];
  ok(e, 'the pruned records reach the aggregate');
  ok(e.wins === 4 && e.losses === 1, 'the all-time totals count every settled record as before');
  ok(e.gc, 'and a gate-clear split now rides beside them');
  ok(e.gc.wins === 2 && e.gc.losses === 1, 'counting only the cleared ones (2W 1L)');
  ok(e.gc.fillWins === 1 && e.gc.fillLosses === 1, 'with the fill-aware pair kept separately');
  ok(e.gc.fillUnfilled === 1, 'and the phantom recorded as never filled');

  /* a record the ledger did not clear, or never told us about, must not
     leak into the population that promotes mechanics */
  ok(e.gc.wins + e.gc.losses === 3, 'a non-cleared and a legacy record are both excluded');
}

console.log('\n== and a gate-clear query now reads it ==');
{
  const S = ctx.hgFwdStatsOf;
  const agg = { 'OMNIGOLD:SCALP|MMOVE': { wins: 99, losses: 99,
    gc: { wins: 12, losses: 8, expired: 0, rrSum: 24, fillWins: 11, fillLosses: 7,
          fillUnfilled: 3, fillUnprovable: 1 } } };

  const live = [rec(0, { gateClear: true, state: 't1', stateFill: 't1', fillState: 'filled' })];
  const gc = S(live, 'OMNIGOLD:SCALP', 'MMOVE', { gateClear: true }, agg);
  ok(gc.samples === 21, 'the live record and the folded ones are counted together (' + gc.samples + ')');
  ok(gc.wins === 13, 'wins carry across the prune boundary');
  ok(gc.fillSamples === 19, 'and so does the fill-aware population');

  /* before this, the same query saw one record and could never reach 20 */
  ok(gc.samples >= 20, 'so FWD_MIN_JUDGE is reachable at all, which was the whole problem');

  /* ticket and shown have no aggregate split and must not silently borrow one */
  const tk = S(live, 'OMNIGOLD:SCALP', 'MMOVE', true, agg);
  ok(tk.samples === 0, 'a ticket query still reads live records only — no split exists for it');
}

console.log('\n== 2. the gate pools the tabs the panel always pooled ==');
{
  const S = ctx.hgFwdStatsOf;
  const other = (i, o) => Object.assign(ctx.hgFwdNormalize({
    tab: 'GOLDSCALP', mechanic: 'MMOVE', sym: 'XAUUSD', tf: '1h', dir: 'long',
    entry: 4700, stop: 4670, t1: 4760, barT: 1700000000 + i * H, horizonBars: 24
  }), o);
  const list = [rec(0, { state: 't1' }), rec(1, { state: 'stop' }),
                other(2, { state: 't1' }), other(3, { state: 't1' })];

  ok(S(list, 'OMNIGOLD:SCALP', 'MMOVE', false, null).samples === 2, 'one tab sees two records');
  const pooled = S(list, ['OMNIGOLD:SCALP', 'GOLDSCALP', 'SUPER:GOLD'], 'MMOVE', false, null);
  ok(pooled.samples === 4, 'the list sees all four');
  ok(pooled.wins === 3, 'and pools the outcomes');
  /* avgRr is a ratio: pooling inside the function keeps rrSum in scope,
     which summing three finished stat blocks could not do correctly */
  ok(Math.abs(pooled.avgRr - 2) < 1e-9, 'the reward multiple is weighted, not averaged twice');

  ok(S(list, [], 'MMOVE', false, null).samples === 4, 'an empty list means no filter, like null');
  ok(/hgOgFwdTabsFor/.test(SRC), 'omnigold names the list rather than repeating it');
  ok(/var all = w\.hgFwdStats\(tabs, mechanic, false\)/.test(SRC), 'and the gate reads the pool');
}

console.log('\n== 3. promote on the horizon, condemn on the mechanic ==');
{
  ok(/fwd\.horizonPool/.test(SRC), 'the gate reads a horizon-wide pool');
  ok(/w\.hgFwdStats\(tabs, null, \{ gateClear: true \}\)/.test(SRC),
     'built with no mechanic filter — the whole cleared book');
  /* the count is COUNTED, not written down — test-omnigold-full-cover
     forbids a literal here, and rightly: a hard-coded count stops
     correcting the moment a horizon is added */
  ok(/hgOgFamilyZ\(hgOgHorizonPoolTests\(\)\)/.test(SRC),
     'judged at the horizon-count bar, derived from the horizon table');
  const nH = ctx.hgOgHorizonPoolTests();
  ok(nH === 2, 'which is ' + nH + ' today');
  ok(ctx.hgOgFamilyZ(nH) < ctx.hgOgFamilyZ(ctx.OG_MECHANICS ? ctx.OG_MECHANICS.length : 54),
     'a lower bar (' + ctx.hgOgFamilyZ(nH).toFixed(2) + 'σ) than the per-mechanic one — '
     + 'that is the point of not splitting the data every which way');

  /* the asymmetry is the design and must not erode */
  ok(/if \(ed !== false && fwd && fwd\.horizonPool\)/.test(SRC),
     'a mechanic already condemned on its OWN record is never promoted by the pool');
  ok(/CONDEMN a mechanic only on evidence about that mechanic/.test(SRC),
     'and the rule is stated where the next reader will be standing');

  /* "not condemned" must no longer read as PASS */
  ok(/not proof of an edge on its own record/.test(SRC),
     'a mechanic merely better than -2σ no longer promotes itself');
  /* but one that DOES carry it alone still wins — the pool is an extra
     route to a ticket, never the only one */
  ok(/clears the ' \+ OG_MECHANICS\.length[\s\S]{0,60}on its own out-of-sample record/.test(SRC),
     'while a forward record clearing the family-wise bar promotes on its own merit');
  ok(!/ed = true;\s*\n\s*edWhy = tixTxt \+ fzTxt \+ ' — measured out-of-sample on cleared setups'/.test(SRC),
     'the old lax promotion is gone');
}

console.log('\n== the arithmetic that motivated all three ==');
{
  /* stated as a test so the numbers are checked rather than asserted in a
     comment that can drift from them */
  const perDay = 48.8, cells = 108, clearShare = 0.15, filledShare = 0.82;
  const perCellPerDay = perDay * clearShare * filledShare / cells;
  const daysNeeded = 20 / perCellPerDay;
  ok(perCellPerDay < 0.06, 'a cell gains about ' + perCellPerDay.toFixed(3) + ' usable records a day');
  ok(daysNeeded > 300, 'so 20 takes about ' + Math.round(daysNeeded) + ' days per mechanic');

  const window = 4000 / 150;                     /* cap over total daily records */
  ok(window < 30, 'while the live window is about ' + Math.round(window) + ' days');
  ok(daysNeeded / window > 10,
     'a gap of ' + (daysNeeded / window).toFixed(0) + 'x — which is why the split had to fold into the aggregate');

  /* pooled across the horizon it is a different question entirely */
  const pooledPerDay = perDay * clearShare * filledShare;
  ok(20 / pooledPerDay < 5,
     'the horizon book reaches 20 in about ' + (20 / pooledPerDay).toFixed(1)
     + ' days — the same evidence, asked a question it can answer');
}

console.log('\n' + passed + ' passed, 0 failed');
