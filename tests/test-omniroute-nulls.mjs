/* =========================================================================
tests/test-omniroute-nulls.mjs

Regression guard for the crash that killed the OMNIROUTE scan in the field:

  scan failed: Cannot read properties of null (reading 'toFixed')

Root cause was a JavaScript trap rather than a typo. `isFinite(null)` is
TRUE — null coerces to 0 — so the natural-looking guard

    isFinite(x.foo) ? x.foo.toFixed(2) : 'unavailable'

passes for null and then throws on .toFixed. The venues return nulls BY
DESIGN: xuPositioning reports fundingPct:null for every CoinDCX contract,
and CoinDCX is ~494 of the ~500 contracts scanned. So the very first
CoinDCX setup killed the whole sweep.

These tests feed every gate the null/undefined/'' shapes the real venue
payloads produce and assert the ledger survives and reports UNCHECKED —
never a silent PASS, which would be worse than the crash.
========================================================================= */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* omniroute.js is a classic script: evaluate it with a window shim. */
const win = {};
const src = readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
new Function('window', src)(win);

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.log('FAIL  - ' + msg); }
}

/* ---- a bar series with a spring on the final bar ---- */
function fixture(){
  const rows = [];
  let px = 100;
  for (let i = 0; i < 80; i++){
    const o = px, c = px + 0.05;
    rows.push({ t: 1700000000 + i * 14400, o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c, v: 1000 });
    px = c;
  }
  rows.push({ t: 1700000000 + 80 * 14400, o: px, h: px + 0.2, l: px - 5, c: px + 0.4, v: 3000 });
  return rows;
}
const rows = fixture();
const hit = { kind: 'SPRING', dir: 'long', level: 99, why: 'test' };

/* ---- 1. the exact field that crashed production ---- */
{
  const coindcx = { sym: 'B-BTC_USDT', base: 'BTC', fundingPct: null, oiUsd: null, mark: 50000, exchange: 'coindcx' };
  let threw = null;
  try { win.hgOmniGates(rows, hit, coindcx, {}); } catch (e) { threw = e.message; }
  ok(threw === null, 'CoinDCX positioning (fundingPct:null) does not throw — ' + (threw || 'clean'));

  const g = win.hgOmniGates(rows, hit, coindcx, {});
  const funding = g.filter(x => x.key === 'funding')[0];
  ok(funding.pass === null, 'null funding reads UNCHECKED, not a silent PASS');
}

/* ---- 2. every conditional gate, against every empty shape ---- */
const emptyShapes = [null, undefined, ''];
const fields = [
  ['oi',     v => ({ oi: { changePct: v } }),        'oi-build'],
  ['retail', v => ({ retail: { longPct: v } }),      'retail-contrarian'],
  ['taker',  v => ({ taker: { buySellRatio: v } }),  'taker-flow'],
  ['depth',  v => ({ depth: { bidUsd: v, askUsd: v } }), 'book-depth'],
  ['htf',    v => ({ htf: { e21: v, e50: v } }),     'htf-daily'],
  ['stats',  v => ({ stats: { samples: v, hit: v, expR: v } }), 'measured-edge']
];
for (const [name, mk, gateKey] of fields){
  for (const shape of emptyShapes){
    const label = name + ' = ' + (shape === null ? 'null' : shape === undefined ? 'undefined' : "''");
    let threw = null, gates = null;
    try { gates = win.hgOmniGates(rows, hit, null, mk(shape)); } catch (e) { threw = e.message; }
    ok(threw === null, label + ' does not throw' + (threw ? (' — ' + threw) : ''));
    if (gates){
      const g = gates.filter(x => x.key === gateKey)[0];
      ok(g && g.pass === null, label + ' -> ' + gateKey + ' UNCHECKED (never a silent pass)');
    }
  }
}

/* ---- 3. all of it null at once, the way a CoinDCX-only contract arrives ---- */
{
  let threw = null;
  try {
    const g = win.hgOmniGates(rows, hit, { fundingPct: null }, {
      htf: { e21: null, e50: null }, oi: { changePct: null }, retail: { longPct: null },
      taker: { buySellRatio: null }, depth: { bidUsd: null, askUsd: null },
      stats: { samples: null, hit: null, expR: null }
    });
    const grade = win.hgOmniGrade(g);
    ok(grade && typeof grade.ticket === 'boolean', 'all-null payload still grades');
  } catch (e) { threw = e.message; }
  ok(threw === null, 'every conditional field null at once does not throw');
}

/* ---- 4. real values must still be read (the guard must not over-reject) ---- */
{
  const g = win.hgOmniGates(rows, hit, { fundingPct: 0.0123 }, {
    retail: { longPct: 81 }, taker: { buySellRatio: 1.4 }, oi: { changePct: -9 }
  });
  const by = k => g.filter(x => x.key === k)[0];
  ok(by('funding').pass === true, 'a real funding number still evaluates');
  ok(by('retail-contrarian').pass === false, 'retail 81% long on a long setup still vetoes');
  ok(by('oi-build').pass === false, 'OI -9% still vetoes');
}

/* ---- 5. measured-edge only vetoes a CLEARLY losing detector ----
   A veto on any negative expectancy silenced the entire tab: the walk-forward
   is in-sample over a short window and a 2R system near its 33% breakeven
   drifts negative on noise alone. */
{
  const edge = st => win.hgOmniGates(rows, hit, null, { stats: st }).filter(x => x.key === 'measured-edge')[0];
  ok(edge({ samples: 40, hit: 0.13, expR: -0.60 }).pass === false, 'clearly losing detector (40 smp, -0.60R) is vetoed');
  ok(edge({ samples: 40, hit: 0.30, expR: -0.10 }).pass === true,  'marginally negative (40 smp, -0.10R) is NOT vetoed on noise');
  ok(edge({ samples: 40, hit: 0.45, expR: 0.35 }).pass === true,   'profitable detector passes');
  ok(edge({ samples: 8,  hit: 0.63, expR: 0.90 }).pass === null,   'too few samples reads UNCHECKED, however good the number looks');
  const thin = edge({ samples: 22, hit: 0.13, expR: -0.60 });
  ok(thin.pass === true && /too few to veto on/.test(thin.why),
     'negative-but-thin says so, rather than calling -0.60R "marginal noise"');
}

/* ---- 6. still-forming bar must never reach the gates ----
   engine.js/edge.js/startradertab.js all drop it: "gates only ever see
   CLOSED candles — a still-forming bar repaints". omniroute did not, and
   the partial bar's partial VOLUME made the participation gate veto live
   setups at 0.08x the 20-bar mean, while ORB claimed a close on a bar that
   had not closed. */
{
  const now = 1700000000 + 100 * 14400;
  const base = [];
  for (let i = 0; i < 10; i++) base.push({ t: 1700000000 + i * 14400, o: 1, h: 2, l: 0.5, c: 1, v: 10 });

  const forming = base.concat([{ t: now - 3600, o: 1, h: 2, l: 0.5, c: 1, v: 1 }]);
  ok(win.hgOmniDropForming(forming, '4h', now).length === base.length,
     'a bar opened 1h ago on 4h is still forming and is dropped');

  const closed = base.concat([{ t: now - 18000, o: 1, h: 2, l: 0.5, c: 1, v: 1 }]);
  ok(win.hgOmniDropForming(closed, '4h', now).length === closed.length,
     'a bar opened 5h ago on 4h has closed and is kept');

  ok(Array.isArray(win.hgOmniDropForming(null, '4h', now)), 'dropForming is null-safe');
  ok(win.hgOmniDropForming(base, 'nonsense', now).length === base.length,
     'unknown timeframe leaves the series untouched rather than guessing');
}

/* ---- 7. rr1/riskPct must be derived, since the plan wrapper strips them ----
   index.html's hgPlanLevels forwards only {dir,entry,stop,t1,t2,risk,note},
   dropping rr1/rr2/riskPct from hgPlanLevelsCore. Reading plan.rr1 gave
   undefined, so cards showed "R:R —" AND hgOmniRank sorted every row by NaN
   — the tab claimed to order by R:R while ordering by nothing. */
{
  const stripped = { dir:'short', entry:0.0023456, stop:0.0024111, t1:0.0021, t2:0.0020, risk:0.0000655, note:'x' };
  const d = win.hgOmniDerivePlan(stripped);
  ok(Math.abs(d.rr1 - 3.75) < 0.01, 'rr1 derived from entry/t1/risk (got ' + d.rr1.toFixed(3) + ')');
  ok(isFinite(d.rr2), 'rr2 derived');
  ok(Math.abs(d.riskPct - 2.792) < 0.01, 'riskPct derived (got ' + d.riskPct.toFixed(3) + '%)');
  ok(stripped.rr1 === undefined, 'the input plan object is not mutated');

  const ranked = win.hgOmniRank([
    { base:'A', grade:{ ticket:true,  vetoes:[] }, rr:1.9 },
    { base:'B', grade:{ ticket:true,  vetoes:[] }, rr:4.2 },
    { base:'D', grade:{ ticket:false, vetoes:[] }, rr:9.9 }
  ]);
  ok(ranked.map(r => r.base).join('') === 'BAD',
     'ranking puts tickets first, then R:R desc (got ' + ranked.map(r => r.base).join('') + ')');
}

/* ---- 8. R:R must agree with the levels the card prints ----
   Live cards showed R:R 14.72 / 11.35 / 9.57 whose true value was 2.00 in
   every case, because plan.risk is stale with respect to the entry the
   wrapper reports. Risk is now derived from |entry-stop|. */
{
  const stale = { dir:'long', entry:0.13417, stop:0.13131, t1:0.13989, t2:0.14417, risk:0.00038909 };
  const d = win.hgOmniDerivePlan(stale);
  ok(Math.abs(d.rr1 - 2.00) < 0.01, 'R:R derived from printed geometry, not stale plan.risk (got ' + d.rr1.toFixed(2) + ')');
  ok(Math.abs(d.riskPct - 2.13) < 0.02, 'riskPct matches |entry-stop| (got ' + d.riskPct.toFixed(2) + '%)');
  ok(Math.abs(d.risk - Math.abs(stale.entry - stale.stop)) < 1e-12, 'risk overwritten with the self-consistent value');
}

/* ---- 9. trend gates must grade each family against the right model ----
   SPRING is a failed breakdown, so it occurs in a downtrend BY CONSTRUCTION.
   Vetoing it for being counter-trend graded reversion setups against a
   continuation model and silenced the tab. */
{
  const dn = [];
  let px = 200;
  for (let i = 0; i < 90; i++){                    // sustained downtrend
    const o = px, c = px - 0.6;
    dn.push({ t: 1700000000 + i * 14400, o, h: Math.max(o,c) + 0.2, l: Math.min(o,c) - 0.2, c, v: 1000 });
    px = c;
  }
  const trendOf = kind => win.hgOmniGates(dn, { kind, dir:'long', level:1, why:'t' }, null, {})
                              .filter(g => g.key === 'trend')[0];

  const spring = trendOf('SPRING');
  ok(spring.pass !== false, 'SPRING long in a downtrend is NOT vetoed on trend');
  ok(spring.hard === false, 'trend is conditional for a reversion family');
  ok(/reversion setup/.test(spring.why), 'the card explains why counter-trend is expected');

  const po3 = trendOf('PO3');
  ok(po3.pass === false, 'PO3 long in a downtrend IS vetoed — continuation must agree with trend');
  ok(po3.hard === true, 'trend stays a hard gate for a continuation family');
}

/* ---- 10. measured-edge uses significance, not a flat R cutoff ----
   A fixed threshold ignores sample size. On live data SPRING at 26% over 473
   samples is 3.4 SE below the 33.3% breakeven for 2R (a real shortfall) yet
   sat inside a -0.25R cutoff; MMOVE at 33% over 2016 samples is genuinely
   breakeven and must survive. */
{
  const edge = st => win.hgOmniGates(rows, { kind:'PO3', dir:'long', level:99, why:'t' }, null, { stats: st })
                        .filter(g => g.key === 'measured-edge')[0];
  ok(edge({ samples:473,  hit:0.26, expR:-0.23 }).pass === false, 'SPRING-like -3.4sigma is vetoed despite -0.23R');
  ok(edge({ samples:624,  hit:0.29, expR:-0.12 }).pass === false, 'PO3-like -2.3sigma is vetoed');
  ok(edge({ samples:458,  hit:0.30, expR:-0.10 }).pass === true,  'ORB-like -1.5sigma survives as noise');
  ok(edge({ samples:2016, hit:0.33, expR:0 }).pass === true,      'MMOVE-like breakeven over 2016 samples survives');
  ok(edge({ samples:4,    hit:0.25, expR:-0.25 }).pass === null,  'ABSORB-like 4 samples stays UNCHECKED');
  ok(/sigma vs breakeven|σ vs breakeven/.test(edge({ samples:473, hit:0.26, expR:-0.23 }).why),
     'the card shows the sigma distance it judged on');
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail){ console.log('TESTS FAILED'); process.exit(1); }
console.log('ALL OMNIROUTE NULL-GUARD TESTS PASSED');
