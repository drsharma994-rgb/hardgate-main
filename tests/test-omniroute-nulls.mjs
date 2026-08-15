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

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail){ console.log('TESTS FAILED'); process.exit(1); }
console.log('ALL OMNIROUTE NULL-GUARD TESTS PASSED');
