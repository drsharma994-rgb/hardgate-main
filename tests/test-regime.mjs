/* HARDGATE — regime.js unit tests (Node 18+, builtins only).
   Loads regime.js as a classic script in a vm context (like the browser's
   <script> globals) and asserts the pure window.regimeVerdict classifier
   against synthetic inputs covering every branch: each state/direction,
   deadzones, null/NaN inputs, and boundary thresholds — including the R8
   stablecoin dry-powder gauge (+0.6%/-0.6%/±0.5% boundaries, null and
   malformed payloads). No live network.
   Also smoke-tests mount() with a fake DOM: dead fetch stub, then a stubbed
   binanceKlines to prove the gold leg calls XAUUSDT (never PAXGUSDT), then
   stubbed DeFiLlama payloads (null payload, malformed entries).
   Run: node tests/test-regime.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* vm sandbox: window stub + a fetch that always fails fast (no network) */
const sandbox = {
  window: {},
  console,
  setTimeout,
  clearTimeout,
  AbortController,
  fetch: async () => ({ ok: false, status: 503, json: async () => null })
};
const ctx = vm.createContext(sandbox);
vm.runInContext(readFileSync(path.join(root, 'regime.js'), 'utf8'), ctx, { filename: 'regime.js' });

const W = sandbox.window;
const regimeVerdict = W.regimeVerdict;

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------------- 0) exposure / registration ---------------- */
assert(typeof regimeVerdict === 'function', 'window.regimeVerdict exposed as a function');
assert(Array.isArray(W.HG_tabs) && W.HG_tabs.length === 1, 'HG_tabs registered exactly once');
assert(W.HG_tabs[0].id === 'regime' && W.HG_tabs[0].label === 'REGIME' && typeof W.HG_tabs[0].mount === 'function',
       'HG_tabs entry: id "regime", label "REGIME", mount function');

/* rows helper: verdict with only the named component set, rest null */
function verdictWith(patch){
  const base = { btc: null, ethbtc: null, btcd: null, fng: null, dxy: null, us10y: null, gold: null, stable: null };
  return regimeVerdict(Object.assign(base, patch || {}));
}

/* ---------------- 1) R1 BTC trend ---------------- */
{
  let v = verdictWith({ btc: { close: 70000, ema50: 62000, ema200: 60000 } });
  assert(v.rows[0].stamp === 'BULL' && v.rows[0].score === 1 && v.rows[0].stampClass === 'pass'
         && v.rows[0].detail.indexOf('ABOVE 200EMA') > -1 && v.rows[0].detail.indexOf('GOLDEN CROSS') > -1,
         'R1: close>ema200 & ema50>ema200 => BULL/+1 "ABOVE 200EMA · GOLDEN CROSS"');

  v = verdictWith({ btc: { close: 70000, ema50: 58000, ema200: 60000 } });
  assert(v.rows[0].stamp === 'BULL' && v.rows[0].score === 1 && v.rows[0].detail.indexOf('DEATH CROSS') > -1,
         'R1: close>ema200 & ema50<ema200 => BULL/+1 with DEATH CROSS context');

  v = verdictWith({ btc: { close: 50000, ema50: 58000, ema200: 60000 } });
  assert(v.rows[0].stamp === 'BEAR' && v.rows[0].score === -1 && v.rows[0].stampClass === 'veto'
         && v.rows[0].detail.indexOf('BELOW 200EMA') > -1 && v.rows[0].detail.indexOf('DEATH CROSS') > -1,
         'R1: close<ema200 & ema50<ema200 => BEAR/-1 "BELOW 200EMA · DEATH CROSS"');

  v = verdictWith({ btc: { close: 50000, ema50: 62000, ema200: 60000 } });
  assert(v.rows[0].stamp === 'BEAR' && v.rows[0].score === -1 && v.rows[0].detail.indexOf('GOLDEN CROSS') > -1,
         'R1: close<ema200 & ema50>ema200 => BEAR/-1 with GOLDEN CROSS context');

  v = verdictWith({ btc: { close: 60000, ema50: 60000, ema200: 60000 } });
  assert(v.rows[0].stamp === 'NA' && v.rows[0].score === 0 && v.rows[0].detail.indexOf('AT 200EMA') > -1,
         'R1: close == ema200 boundary => NA/0 ("AT 200EMA")');

  v = verdictWith({ btc: null });
  assert(v.rows[0].stamp === 'NA' && v.rows[0].score === 0 && v.rows[0].detail === 'data unavailable',
         'R1: null component => NA/0 "data unavailable"');

  v = verdictWith({ btc: { close: NaN, ema50: 1, ema200: 1 } });
  assert(v.rows[0].stamp === 'NA' && v.rows[0].score === 0, 'R1: NaN close => NA/0');

  v = verdictWith({ btc: { close: null, ema50: 1, ema200: 1 } });
  assert(v.rows[0].stamp === 'NA' && v.rows[0].score === 0, 'R1: null close field (not 0) => NA/0');
}

/* ---------------- 2) R2 ETH/BTC EMA20 slope ---------------- */
{
  let v = verdictWith({ ethbtc: { ema20Now: 0.052, ema20Prev: 0.050, last: 0.052 } });
  assert(v.rows[1].stamp === 'BULL' && v.rows[1].score === 1 && v.rows[1].detail.indexOf('RISING') > -1,
         'R2: ema20 rising => BULL/+1');

  v = verdictWith({ ethbtc: { ema20Now: 0.048, ema20Prev: 0.050, last: 0.048 } });
  assert(v.rows[1].stamp === 'BEAR' && v.rows[1].score === -1 && v.rows[1].detail.indexOf('FALLING') > -1,
         'R2: ema20 falling => BEAR/-1');

  v = verdictWith({ ethbtc: { ema20Now: 0.050, ema20Prev: 0.050, last: 0.050 } });
  assert(v.rows[1].stamp === 'NA' && v.rows[1].score === 0 && v.rows[1].detail.indexOf('FLAT') > -1,
         'R2: ema20 flat (equal) => NA/0');

  v = verdictWith({ ethbtc: null });
  assert(v.rows[1].stamp === 'NA' && v.rows[1].score === 0, 'R2: null => NA/0');

  v = verdictWith({ ethbtc: { ema20Now: NaN, ema20Prev: 0.05 } });
  assert(v.rows[1].stamp === 'NA' && v.rows[1].score === 0, 'R2: NaN slope input => NA/0');
}

/* ---------------- 3) R3 BTC dominance deadzone ---------------- */
{
  let v = verdictWith({ btcd: { pct: 49.9 } });
  assert(v.rows[2].stamp === 'BULL' && v.rows[2].score === 1 && v.rows[2].detail.indexOf('BELOW 50%') > -1,
         'R3: 49.9% < 50% => BULL/+1 (alt-favorable)');

  v = verdictWith({ btcd: { pct: 50 } });
  assert(v.rows[2].stamp === 'NA' && v.rows[2].score === 0 && v.rows[2].detail.indexOf('mid-zone') > -1,
         'R3: exactly 50% boundary => NA/0 mid-zone');

  v = verdictWith({ btcd: { pct: 55 } });
  assert(v.rows[2].stamp === 'NA' && v.rows[2].score === 0, 'R3: exactly 55% boundary => NA/0 mid-zone');

  v = verdictWith({ btcd: { pct: 55.1 } });
  assert(v.rows[2].stamp === 'BEAR' && v.rows[2].score === -1 && v.rows[2].detail.indexOf('ABOVE 55%') > -1,
         'R3: 55.1% > 55% => BEAR/-1 (risk-off for alts)');

  v = verdictWith({ btcd: null });
  assert(v.rows[2].stamp === 'NA' && v.rows[2].score === 0, 'R3: null => NA/0');

  v = verdictWith({ btcd: { pct: 'abc' } });
  assert(v.rows[2].stamp === 'NA' && v.rows[2].score === 0, 'R3: non-numeric pct => NA/0');
}

/* ---------------- 4) R4 Fear & Greed deadzone ---------------- */
{
  let v = verdictWith({ fng: { value: 61, classification: 'Greed', change: 4 } });
  assert(v.rows[3].stamp === 'BULL' && v.rows[3].score === 1 && v.rows[3].detail.indexOf('GREED 61') > -1
         && v.rows[3].detail.indexOf('(+4 d/d)') > -1,
         'R4: 61 > 60 => BULL/+1 with classification + d/d change');

  v = verdictWith({ fng: { value: 60, classification: 'Greed', change: 1 } });
  assert(v.rows[3].stamp === 'NA' && v.rows[3].score === 0, 'R4: exactly 60 boundary => NA/0');

  v = verdictWith({ fng: { value: 25, classification: 'Fear', change: -2 } });
  assert(v.rows[3].stamp === 'NA' && v.rows[3].score === 0, 'R4: exactly 25 boundary => NA/0');

  v = verdictWith({ fng: { value: 24, classification: 'Extreme Fear', change: -6 } });
  assert(v.rows[3].stamp === 'BEAR' && v.rows[3].score === -1 && v.rows[3].detail.indexOf('EXTREME FEAR 24') > -1
         && v.rows[3].detail.indexOf('(-6 d/d)') > -1,
         'R4: 24 < 25 => BEAR/-1');

  v = verdictWith({ fng: { value: '72', classification: 'Greed', change: null } });
  assert(v.rows[3].stamp === 'BULL' && v.rows[3].score === 1 && v.rows[3].detail.indexOf('d/d') === -1,
         'R4: string "72" coerced; null change omits d/d text');

  v = verdictWith({ fng: null });
  assert(v.rows[3].stamp === 'NA' && v.rows[3].score === 0, 'R4: null => NA/0');

  v = verdictWith({ fng: { value: NaN } });
  assert(v.rows[3].stamp === 'NA' && v.rows[3].score === 0, 'R4: NaN value => NA/0');
}

/* ---------------- 5) R5 DXY trend ---------------- */
{
  let v = verdictWith({ dxy: { value: 103.4, trend20: 'FALLING', change20Pct: -0.8 } });
  assert(v.rows[4].stamp === 'BULL' && v.rows[4].score === 1 && v.rows[4].detail.indexOf('FALLING') > -1,
         'R5: DXY FALLING => BULL/+1');

  v = verdictWith({ dxy: { value: 105.1, trend20: 'RISING', change20Pct: 0.9 } });
  assert(v.rows[4].stamp === 'BEAR' && v.rows[4].score === -1 && v.rows[4].detail.indexOf('RISING') > -1,
         'R5: DXY RISING => BEAR/-1');

  v = verdictWith({ dxy: { value: 104.0, trend20: 'FLAT', change20Pct: 0.1 } });
  assert(v.rows[4].stamp === 'NA' && v.rows[4].score === 0, 'R5: DXY FLAT => NA/0');

  v = verdictWith({ dxy: { value: 104.0, trend20: null } });
  assert(v.rows[4].stamp === 'NA' && v.rows[4].score === 0, 'R5: missing trend => NA/0');

  v = verdictWith({ dxy: null });
  assert(v.rows[4].stamp === 'NA' && v.rows[4].score === 0, 'R5: null => NA/0');
}

/* ---------------- 6) R6 US 10Y trend ---------------- */
{
  let v = verdictWith({ us10y: { value: 4.1, trend: 'FALLING' } });
  assert(v.rows[5].stamp === 'BULL' && v.rows[5].score === 1, 'R6: 10Y FALLING => BULL/+1');

  v = verdictWith({ us10y: { value: 4.6, trend: 'RISING' } });
  assert(v.rows[5].stamp === 'BEAR' && v.rows[5].score === -1, 'R6: 10Y RISING => BEAR/-1');

  v = verdictWith({ us10y: { value: 4.3, trend: 'FLAT' } });
  assert(v.rows[5].stamp === 'NA' && v.rows[5].score === 0, 'R6: 10Y FLAT => NA/0');

  v = verdictWith({ us10y: null });
  assert(v.rows[5].stamp === 'NA' && v.rows[5].score === 0, 'R6: null => NA/0');
}

/* ---------------- 7) R7 GOLD (XAU PERP) — informational only ---------------- */
{
  let v = verdictWith({ gold: { close: 2500, ema200: 2400 } });
  assert(v.rows[6].stamp === 'BULL' && v.rows[6].score === 0 && v.rows[6].scored === false
         && v.rows[6].name.indexOf('HEDGE DEMAND') > -1 && v.rows[6].name.indexOf('GOLD (XAU PERP)') > -1
         && v.rows[6].detail.indexOf('XAU ABOVE 200EMA') > -1 && v.rows[6].detail.indexOf('PAXG') === -1,
         'R7: XAU above ema200 => BULL stamp, score 0, scored=false, "HEDGE DEMAND · GOLD (XAU PERP)" label, no PAXG text');

  v = verdictWith({ gold: { close: 2300, ema200: 2400 } });
  assert(v.rows[6].stamp === 'BEAR' && v.rows[6].score === 0 && v.rows[6].scored === false
         && v.rows[6].detail.indexOf('XAU BELOW 200EMA') > -1,
         'R7: XAU below ema200 => BEAR stamp, still score 0');

  v = verdictWith({ gold: { close: 2400, ema200: 2400 } });
  assert(v.rows[6].stamp === 'NA' && v.rows[6].score === 0, 'R7: XAU at ema200 => NA/0');

  v = verdictWith({ gold: null });
  assert(v.rows[6].stamp === 'NA' && v.rows[6].score === 0 && v.rows[6].scored === false, 'R7: null => NA/0');

  /* gold never moves the aggregate score */
  const withGold = verdictWith({ btc: { close: 7e4, ema50: 6.2e4, ema200: 6e4 }, gold: { close: 2500, ema200: 2400 } });
  const noGold   = verdictWith({ btc: { close: 7e4, ema50: 6.2e4, ema200: 6e4 }, gold: null });
  assert(withGold.score === noGold.score && withGold.scoredTotal === 7,
         'R7: gold informational — aggregate score identical with/without it, scoredTotal stays 7');
}

/* ---------------- 7b) R8 STABLECOIN FLOWS — dry powder, ±0.5% band ---------------- */
{
  /* +0.6% 7d flow => dry powder IN => BULL/+1 */
  let v = verdictWith({ stable: { totalUSD: 100.6e9, delta7dUSD: 0.6e9, delta30dUSD: 1.1e9 } });
  assert(v.rows[7].id === 'R8' && v.rows[7].name === 'DRY POWDER' && v.rows[7].scored === true,
         'R8: row id "R8", label "DRY POWDER", scored gauge');
  assert(v.rows[7].stamp === 'BULL' && v.rows[7].score === 1 && v.rows[7].stampClass === 'pass'
         && v.rows[7].detail.indexOf('(INFLOWS)') > -1 && v.rows[7].detail.indexOf('risk-on') > -1,
         'R8: +0.6% 7d flow (> +0.5%) => BULL/+1 INFLOWS');

  /* -0.6% 7d flow => liquidity DRAINING => BEAR/-1, with ledger text shape */
  v = verdictWith({ stable: { totalUSD: 308.9e9, delta7dUSD: -3e9, delta30dUSD: -4.5e9 } });
  assert(v.rows[7].stamp === 'BEAR' && v.rows[7].score === -1 && v.rows[7].stampClass === 'veto'
         && v.rows[7].detail.indexOf('STABLECOINS $308.9B') > -1 && v.rows[7].detail.indexOf('7D -$3.0B') > -1
         && v.rows[7].detail.indexOf('(DRAINING)') > -1 && v.rows[7].detail.indexOf('30D -$4.5B') > -1,
         'R8: -0.6% 7d flow => BEAR/-1, ledger "STABLECOINS $308.9B · 7D -$3.0B (DRAINING) · 30D -$4.5B"');

  /* exactly ±0.5% boundaries sit inside the band => NA/0 FLAT */
  v = verdictWith({ stable: { totalUSD: 100.5e9, delta7dUSD: 0.5e9 } });
  assert(v.rows[7].stamp === 'NA' && v.rows[7].score === 0 && v.rows[7].detail.indexOf('(FLAT)') > -1,
         'R8: exactly +0.5% boundary => NA/0 FLAT (band edge not scored)');

  v = verdictWith({ stable: { totalUSD: 99.5e9, delta7dUSD: -0.5e9 } });
  assert(v.rows[7].stamp === 'NA' && v.rows[7].score === 0, 'R8: exactly -0.5% boundary => NA/0 FLAT');

  /* just inside the band => FLAT; string-coerced numbers still work */
  v = verdictWith({ stable: { totalUSD: '100.2e9', delta7dUSD: '0.2e9' } });
  assert(v.rows[7].stamp === 'NA' && v.rows[7].score === 0, 'R8: +0.2% inside band (string-coerced) => NA/0');

  /* null / malformed payloads => honest NA row, never a score, never a throw */
  v = verdictWith({ stable: null });
  assert(v.rows[7].stamp === 'NA' && v.rows[7].score === 0 && v.rows[7].detail === 'data unavailable',
         'R8: null component => NA/0 "data unavailable"');

  v = verdictWith({ stable: {} });
  assert(v.rows[7].stamp === 'NA' && v.rows[7].score === 0, 'R8: empty object => NA/0');

  v = verdictWith({ stable: { totalUSD: NaN, delta7dUSD: 1e9 } });
  assert(v.rows[7].stamp === 'NA' && v.rows[7].score === 0, 'R8: NaN totalUSD => NA/0');

  v = verdictWith({ stable: { totalUSD: 100e9, delta7dUSD: null } });
  assert(v.rows[7].stamp === 'NA' && v.rows[7].score === 0, 'R8: null delta7dUSD (no week baseline) => NA/0');

  v = verdictWith({ stable: { totalUSD: -5e9, delta7dUSD: 1e9 } });
  assert(v.rows[7].stamp === 'NA' && v.rows[7].score === 0, 'R8: non-positive totalUSD => NA/0');

  v = verdictWith({ stable: { totalUSD: 100e9, delta7dUSD: 150e9 } });
  assert(v.rows[7].stamp === 'NA' && v.rows[7].score === 0, 'R8: delta implying negative week-ago baseline => NA/0');
}

/* ---------------- 8) aggregate verdict ---------------- */
{
  const allOn = regimeVerdict({
    btc:    { close: 7e4, ema50: 6.2e4, ema200: 6e4 },
    ethbtc: { ema20Now: 0.052, ema20Prev: 0.05 },
    btcd:   { pct: 45 },
    fng:    { value: 75, classification: 'Greed', change: 3 },
    dxy:    { value: 102, trend20: 'FALLING' },
    us10y:  { value: 4.0, trend: 'FALLING' },
    gold:   { close: 2500, ema200: 2400 },
    stable: { totalUSD: 101e9, delta7dUSD: 1e9, delta30dUSD: 2e9 }
  });
  assert(allOn.score === 7 && allOn.word === 'RISK-ON' && allOn.cls === 'long' && allOn.scoredTotal === 7
         && allOn.why.indexOf('+1 BTC trend up') > -1 && allOn.why.indexOf('greed 75') > -1
         && allOn.why.indexOf('+1 dry powder in') > -1,
         'aggregate: all seven risk-on => score 7, RISK-ON, cls long, drivers listed (incl. dry powder)');

  const allOff = regimeVerdict({
    btc:    { close: 5e4, ema50: 5.8e4, ema200: 6e4 },
    ethbtc: { ema20Now: 0.048, ema20Prev: 0.05 },
    btcd:   { pct: 58 },
    fng:    { value: 12, classification: 'Extreme Fear', change: -5 },
    dxy:    { value: 106, trend20: 'RISING' },
    us10y:  { value: 4.8, trend: 'RISING' },
    gold:   { close: 2300, ema200: 2400 },
    stable: { totalUSD: 99e9, delta7dUSD: -1e9, delta30dUSD: -2e9 }
  });
  assert(allOff.score === -7 && allOff.word === 'RISK-OFF' && allOff.cls === 'short' && allOff.scoredTotal === 7,
         'aggregate: all seven risk-off => score -7, RISK-OFF, cls short');

  const plus3 = regimeVerdict({ // exactly +3 boundary => RISK-ON
    btc: { close: 7e4, ema50: 6.2e4, ema200: 6e4 },
    ethbtc: { ema20Now: 0.052, ema20Prev: 0.05 },
    dxy: { value: 102, trend20: 'FALLING' },
    btcd: { pct: 52 }, fng: { value: 50 }, us10y: { value: 4.3, trend: 'FLAT' }, gold: null, stable: null
  });
  assert(plus3.score === 3 && plus3.word === 'RISK-ON', 'aggregate: score exactly +3 boundary => RISK-ON');

  const minus3 = regimeVerdict({ // exactly -3 boundary => RISK-OFF
    btc: { close: 5e4, ema50: 5.8e4, ema200: 6e4 },
    ethbtc: { ema20Now: 0.048, ema20Prev: 0.05 },
    dxy: { value: 106, trend20: 'RISING' },
    btcd: { pct: 52 }, fng: { value: 50 }, us10y: { value: 4.3, trend: 'FLAT' }, gold: null, stable: null
  });
  assert(minus3.score === -3 && minus3.word === 'RISK-OFF', 'aggregate: score exactly -3 boundary => RISK-OFF');

  const plus3Stable = regimeVerdict({ // stablecoin flow carries the third point to the boundary
    btc: { close: 7e4, ema50: 6.2e4, ema200: 6e4 },
    ethbtc: { ema20Now: 0.052, ema20Prev: 0.05 },
    stable: { totalUSD: 101e9, delta7dUSD: 1e9 },
    btcd: { pct: 52 }, fng: { value: 50 }, dxy: { value: 104, trend20: 'FLAT' },
    us10y: { value: 4.3, trend: 'FLAT' }, gold: null
  });
  assert(plus3Stable.score === 3 && plus3Stable.word === 'RISK-ON',
         'aggregate: +3 boundary reached via stablecoin inflow => RISK-ON');

  const minus3Stable = regimeVerdict({ // same on the short side
    btc: { close: 5e4, ema50: 5.8e4, ema200: 6e4 },
    ethbtc: { ema20Now: 0.048, ema20Prev: 0.05 },
    stable: { totalUSD: 99e9, delta7dUSD: -1e9 },
    btcd: { pct: 52 }, fng: { value: 50 }, dxy: { value: 104, trend20: 'FLAT' },
    us10y: { value: 4.3, trend: 'FLAT' }, gold: null
  });
  assert(minus3Stable.score === -3 && minus3Stable.word === 'RISK-OFF',
         'aggregate: -3 boundary reached via stablecoin drain => RISK-OFF');

  const plus2 = regimeVerdict({ // +2 even with flat stables stays inside the deadzone
    btc: { close: 7e4, ema50: 6.2e4, ema200: 6e4 },
    ethbtc: { ema20Now: 0.052, ema20Prev: 0.05 },
    stable: { totalUSD: 100.2e9, delta7dUSD: 0.2e9 },
    btcd: null, fng: null, dxy: null, us10y: null, gold: null
  });
  assert(plus2.score === 2 && plus2.word === 'MIXED — SELECTIVE' && plus2.cls === 'aside',
         'aggregate: score +2 (inside deadzone, stables flat) => MIXED — SELECTIVE, cls aside');

  const allNull = regimeVerdict({
    btc: null, ethbtc: null, btcd: null, fng: null, dxy: null, us10y: null, gold: null, stable: null
  });
  assert(allNull.score === 0 && allNull.word === 'MIXED — SELECTIVE' && allNull.rows.length === 8
         && allNull.why.indexOf('no directional drivers') > -1 && allNull.scoredTotal === 7,
         'aggregate: all sources null => score 0, MIXED, 8 rows, honest "no directional drivers"');

  let threw = false;
  try { regimeVerdict(null); regimeVerdict(undefined); regimeVerdict({}); }
  catch(e){ threw = true; }
  assert(!threw, 'aggregate: null/undefined/empty argument never throws');

  const mixedWhy = allOn.why + ' | ' + allNull.why;
  assert(allOn.why.indexOf('score +7/7') === 0 && allOff.why.indexOf('score -7/7') === 0,
         'aggregate: why string opens with signed score out of 7');
  assert(mixedWhy.length > 0, 'aggregate: why strings built');
}

/* ---------------- 9) mount() smoke test — fake DOM, dead fetch ---------------- */
function fakeNode(id){
  return {
    id: id, innerHTML: '', textContent: '', style: {}, disabled: false,
    firstElementChild: { style: {} },
    _click: null,
    addEventListener(ev, fn){ if (ev === 'click') this._click = fn; }
  };
}
function fakeEl(){
  return {
    innerHTML: '',
    _nodes: {},
    querySelector(sel){
      if (!this._nodes[sel]) this._nodes[sel] = fakeNode(sel);
      return this._nodes[sel];
    }
  };
}

const el = fakeEl();
let mountThrew = null;
try { W.HG_tabs[0].mount(el); } catch(e){ mountThrew = e; }
assert(!mountThrew, 'mount() does not throw with no data globals present');
assert(el.innerHTML.indexOf('MARKET REGIME') > -1 && el.innerHTML.indexOf('class="panel"') > -1
       && el.innerHTML.indexOf('id="regimeProg"') > -1 && el.innerHTML.indexOf('id="regimeRun"') > -1,
       'mount() builds panel + REFRESH button + prog bar skeleton');

const outNode = el._nodes['#regimeOut'], statNode = el._nodes['#regimeStat'], runNode = el._nodes['#regimeRun'];
assert(!!outNode && !!statNode && !!runNode, 'mount() wires out/stat/run nodes');

/* auto-run + REFRESH both do full scans against the dead fetch stub */
async function waitForScan(label){
  const t0 = Date.now();
  while (Date.now() - t0 < 5000){
    if (outNode.innerHTML && runNode.disabled === false && statNode.textContent.indexOf('sources ok') > -1) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}
const autoOk = await waitForScan('auto-run');
assert(autoOk, 'auto-run on mount completes (all sources fail fast, no hang)');
assert(outNode.innerHTML.indexOf('class="empty"') > -1 && outNode.innerHTML.indexOf('note warn') > -1,
       'all-sources-down render: .note warn + .empty (graceful, no throw)');
assert(statNode.textContent.indexOf('0/8 sources ok') > -1, 'status line reports 0/8 sources ok');
assert(typeof runNode._click === 'function', 'REFRESH button has a click handler');

runNode._click();
const refreshOk = await waitForScan('refresh');
assert(refreshOk && outNode.innerHTML.indexOf('class="empty"') > -1,
       'REFRESH re-runs the scan and renders gracefully again');

/* ---- wait helper: set a marker, click REFRESH, wait for a fresh result ---- */
async function clickAndWait(target){
  statNode.textContent = 'marker';
  runNode._click();
  const t0 = Date.now();
  while (Date.now() - t0 < 5000){
    if (runNode.disabled === false && statNode.textContent.indexOf(target) > -1) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

/* ---------------- 10) R7 gold leg uses XAUUSDT (stubbed binanceKlines) ---------------- */
{
  const klineCalls = [];
  const rows260 = [];
  for (let i = 0; i < 260; i++) rows260.push({ t: i, o: 100, h: 110, l: 90, c: 100 + i, v: 1 });
  sandbox.binanceKlines = async (symbol, interval, limit) => {
    klineCalls.push(symbol + '|' + interval + '|' + limit);
    return rows260;
  };
  sandbox.ema = (arr) => arr.map(() => arr[arr.length - 1] - 100); // close > ema => BULL legs

  const ok = await clickAndWait('2/8 sources ok'); // btc + gold hit stubs, six sources still dead
  assert(ok, 'stubbed scan completes with 2/8 sources ok (btc + gold)');
  assert(klineCalls.some(c => c.indexOf('XAUUSDT|1d|') === 0), 'gold leg calls binanceKlines("XAUUSDT", "1d", …)');
  assert(!klineCalls.some(c => c.indexOf('PAXGUSDT') > -1), 'gold leg never calls PAXGUSDT anymore');
  assert(klineCalls.some(c => c.indexOf('BTCUSDT|1d|') === 0), 'btc leg still calls binanceKlines("BTCUSDT", "1d", …)');
  assert(outNode.innerHTML.indexOf('GOLD (XAU PERP)') > -1 && outNode.innerHTML.indexOf('XAU ABOVE 200EMA') > -1,
         'rendered ledger shows "GOLD (XAU PERP)" row with XAU trend text');
}

/* ---------------- 11) R8 stablecoin fetch: null payload, then malformed entries ---------------- */
{
  /* 11a) null payload => honest NA row, no throw (nothing cached yet, so this really fetches) */
  sandbox.fetch = async () => ({ ok: true, status: 200, json: async () => null });
  let ok = await clickAndWait('2/8 sources ok');
  assert(ok && outNode.innerHTML.indexOf('DRY POWDER') > -1 && outNode.innerHTML.indexOf('data unavailable') > -1,
         'R8: null payload => DRY POWDER row renders NA "data unavailable", scan survives');

  /* 11b) malformed entries are skipped/defensive-summed, valid ones still total up */
  const llamaPayload = { peggedAssets: [
    { symbol: 'USDT', circulating: { peggedUSD: 60e9 }, circulatingPrevWeek: { peggedUSD: 59.4e9 }, circulatingPrevMonth: { peggedUSD: 58e9 } },
    { symbol: 'USDC', circulating: { peggedUSD: 40e9 }, circulatingPrevWeek: { peggedUSD: 39.8e9 }, circulatingPrevMonth: { peggedUSD: 39e9 } },
    null,
    'garbage',
    { symbol: 'NOFIELDS' },
    { symbol: 'BADNUM', circulating: { peggedUSD: 'abc' }, circulatingPrevWeek: { peggedUSD: null } },
    { symbol: 'NOPEGKEY', circulating: { other: 5 }, circulatingPrevWeek: { other: 4 } } // fallback: sum numeric values
  ]};
  sandbox.fetch = async (url) => {
    if (String(url).indexOf('stablecoins.llama.fi') > -1)
      return { ok: true, status: 200, json: async () => llamaPayload };
    return { ok: false, status: 503, json: async () => null };
  };
  ok = await clickAndWait('3/8 sources ok'); // btc + gold + stablecoins
  assert(ok, 'stubbed scan completes with 3/8 sources ok (btc + gold + stablecoins)');
  assert(outNode.innerHTML.indexOf('DRY POWDER') > -1
         && outNode.innerHTML.indexOf('STABLECOINS $100.0B') > -1
         && outNode.innerHTML.indexOf('(INFLOWS)') > -1,
         'R8: malformed entries tolerated — $100.0B total from valid entries, +0.8% 7d => INFLOWS ledger row');
  assert(outNode.innerHTML.indexOf('class="empty"') === -1, 'R8: partial-success render is a ledger, not the empty state');
}

/* ---------------- 12) regimePlaybook — pure decision function ---------------- */
console.log('== regimePlaybook: bias, setups, size, invalidation ==');
const regimePlaybook = W.regimePlaybook;
assert(typeof regimePlaybook === 'function', 'window.regimePlaybook exposed as a function');

/* garbage in -> null out, never a throw */
let pbThrew = false;
try { regimePlaybook(null); regimePlaybook(undefined); regimePlaybook({}); regimePlaybook(42); } catch(e){ pbThrew = true; }
assert(!pbThrew, 'playbook: null/undefined/empty/non-object input never throws');
assert(regimePlaybook(null) === null && regimePlaybook({}) === null && regimePlaybook({ score: 3 }) === null,
       'playbook: missing rows array => null (no guidance fabricated)');
assert(regimePlaybook({ rows: [], score: 'abc' }) === null, 'playbook: non-finite score => null');

const pbOn  = regimePlaybook(regimeVerdict({
  btc:    { close: 7e4, ema50: 6.2e4, ema200: 6e4 },
  ethbtc: { ema20Now: 0.052, ema20Prev: 0.05 },
  btcd:   { pct: 45 },
  fng:    { value: 75, classification: 'Greed', change: 3 },
  dxy:    { value: 102, trend20: 'FALLING' },
  us10y:  { value: 4.0, trend: 'FALLING' },
  gold:   { close: 2500, ema200: 2400 },
  stable: { totalUSD: 101e9, delta7dUSD: 1e9, delta30dUSD: 2e9 }
}));
const pbOff = regimePlaybook(regimeVerdict({
  btc:    { close: 5e4, ema50: 5.8e4, ema200: 6e4 },
  ethbtc: { ema20Now: 0.048, ema20Prev: 0.05 },
  btcd:   { pct: 58 },
  fng:    { value: 12, classification: 'Extreme Fear', change: -5 },
  dxy:    { value: 106, trend20: 'RISING' },
  us10y:  { value: 4.8, trend: 'RISING' },
  gold:   { close: 2300, ema200: 2400 },
  stable: { totalUSD: 99e9, delta7dUSD: -1e9, delta30dUSD: -2e9 }
}));
const pbZero = regimePlaybook(regimeVerdict({
  btc: null, ethbtc: null, btcd: null, fng: null, dxy: null, us10y: null, gold: null, stable: null
}));
const pbLean = regimePlaybook(verdictWith({
  btc: { close: 7e4, ema50: 6.2e4, ema200: 6e4 },
  ethbtc: { ema20Now: 0.052, ema20Prev: 0.05 }
})); // score +2, inside the deadzone

/* directional bias */
assert(pbOn && pbOn.bias === 'LONG-ONLY', 'playbook: RISK-ON => bias LONG-ONLY');
assert(pbOff && pbOff.bias === 'SHORT-ONLY', 'playbook: RISK-OFF => bias SHORT-ONLY');
assert(pbZero && pbZero.bias === 'STAND-ASIDE', 'playbook: MIXED score 0 (no drivers) => bias STAND-ASIDE');
assert(pbLean && pbLean.bias === 'BOTH', 'playbook: MIXED score +2 inside deadzone => bias BOTH');
assert(pbLean && regimePlaybook(verdictWith({ btc: { close: 5e4, ema50: 5.8e4, ema200: 6e4 } })).bias === 'BOTH',
       'playbook: MIXED score -1 inside deadzone => bias BOTH');

/* position-size guidance from |score| */
assert(pbOn.size === 'full' && pbOff.size === 'full', 'playbook: |score| 7 => FULL size both directions');
assert(regimePlaybook(verdictWith({
  btc: { close: 7e4, ema50: 6.2e4, ema200: 6e4 },
  ethbtc: { ema20Now: 0.052, ema20Prev: 0.05 },
  dxy: { value: 102, trend20: 'FALLING' }
})).size === 'half', 'playbook: score exactly +3 boundary => HALF size');
assert(regimePlaybook(verdictWith({
  btc: { close: 7e4, ema50: 6.2e4, ema200: 6e4 },
  ethbtc: { ema20Now: 0.052, ema20Prev: 0.05 },
  dxy: { value: 102, trend20: 'FALLING' },
  us10y: { value: 4.0, trend: 'FALLING' }
})).size === 'half', 'playbook: score +4 (thin majority) => HALF size');
assert(regimePlaybook(verdictWith({
  btc: { close: 7e4, ema50: 6.2e4, ema200: 6e4 },
  ethbtc: { ema20Now: 0.052, ema20Prev: 0.05 },
  dxy: { value: 102, trend20: 'FALLING' },
  us10y: { value: 4.0, trend: 'FALLING' },
  btcd: { pct: 45 }
})).size === 'full', 'playbook: score +5 (broad agreement) => FULL size');
assert(pbZero.size === 'quarter' && pbLean.size === 'quarter', 'playbook: MIXED => QUARTER size max');
assert(typeof pbOn.sizeNote === 'string' && pbOn.sizeNote.length > 10
       && typeof pbZero.sizeNote === 'string' && pbZero.sizeNote.length > 10,
       'playbook: sizeNote is a substantive string for trend + mixed regimes');

/* preferred setup types, data-driven from the gauge rows */
assert(Array.isArray(pbOn.setups) && pbOn.setups.length >= 2 && pbOn.setups.every(s => typeof s === 'string' && s.length > 5),
       'playbook: setups is a non-empty string array');
assert(pbOn.setups.some(s => s.indexOf('trend-follow') >= 0), 'playbook: RISK-ON prefers trend-follow');
assert(pbOn.setups.some(s => s.indexOf('carry') >= 0), 'playbook: RISK-ON + R8 dry-powder inflow => carry/basis setup offered');
const pbOnFlat = regimePlaybook(verdictWith({
  btc: { close: 7e4, ema50: 6.2e4, ema200: 6e4 },
  ethbtc: { ema20Now: 0.052, ema20Prev: 0.05 },
  dxy: { value: 102, trend20: 'FALLING' },
  stable: { totalUSD: 100.2e9, delta7dUSD: 0.2e9 } // flat, inside the band
}));
assert(pbOnFlat.bias === 'LONG-ONLY' && pbOnFlat.setups.some(s => s.indexOf('mean-revert') >= 0)
       && !pbOnFlat.setups.some(s => s.indexOf('carry/basis') >= 0),
       'playbook: RISK-ON with FLAT stables => mean-revert substitute, no carry offer');
assert(pbOff.setups.some(s => s.indexOf('trend-follow') >= 0), 'playbook: RISK-OFF prefers trend-follow shorts');
assert(pbOff.setups.some(s => s.indexOf('mean-revert') >= 0),
       'playbook: RISK-OFF + R4 fear stretch => quarter-size mean-revert bounce note');
assert(pbZero.setups.some(s => s.toLowerCase().indexOf('stand aside') >= 0)
       && pbZero.setups.some(s => s.indexOf('mean-revert') >= 0),
       'playbook: STAND-ASIDE regime => stand-aside first, mean-revert only if forced');
assert(pbLean.setups.some(s => s.indexOf('mean-revert') >= 0), 'playbook: BOTH bias => mean-revert at range extremes');

/* invalidation: one explicit line, referencing the live drivers */
assert(pbOn.invalidation.indexOf('This regime thesis dies if') === 0
       && pbOff.invalidation.indexOf('This regime thesis dies if') === 0
       && pbZero.invalidation.indexOf('This regime thesis dies if') === 0
       && pbLean.invalidation.indexOf('This regime thesis dies if') === 0,
       'playbook: every regime emits one explicit "This regime thesis dies if" invalidation line');
assert(pbOn.invalidation.indexOf('BTC TREND (1D)') > -1,
       'playbook: RISK-ON invalidation names the current bull driver (BTC TREND (1D))');
assert(pbOff.invalidation.indexOf('BTC TREND (1D)') > -1 && pbOff.invalidation.indexOf('above -3') > -1,
       'playbook: RISK-OFF invalidation names the bear driver + the score boundary');
assert(pbLean.invalidation.indexOf('±3') > -1, 'playbook: MIXED invalidation points at the ±3 resolution boundary');

/* passthrough + cls/word derivation */
assert(pbOn.regime === 'RISK-ON' && pbOn.cls === 'long' && pbOn.score === 7
       && pbOff.regime === 'RISK-OFF' && pbOff.cls === 'short' && pbOff.score === -7,
       'playbook: regime/cls/score pass through from the verdict');
const pbDerived = regimePlaybook({ score: 5, rows: [] });
assert(pbDerived && pbDerived.cls === 'long' && pbDerived.bias === 'LONG-ONLY' && pbDerived.regime === 'RISK-ON',
       'playbook: cls/word derived from the score when the caller omits them');

/* ---------------- 13) playbook panel in the rendered dashboard ---------------- */
console.log('== playbook panel: rendered from live scan state ==');
/* current stub state (btc+gold ok, stables cached inflow, rest dead) => score +2 MIXED */
let okMix = await clickAndWait('3/8 sources ok');
assert(okMix, 'playbook UI: MIXED scan completes (3/8 sources ok)');
assert(outNode.innerHTML.indexOf('PLAYBOOK') > -1 && outNode.innerHTML.indexOf('INVALIDATION —') > -1,
       'playbook UI: PLAYBOOK card + INVALIDATION plan line rendered');
assert(outNode.innerHTML.indexOf('BOTH') > -1 && outNode.innerHTML.indexOf('QUARTER') > -1,
       'playbook UI: +2 MIXED renders BOTH bias at QUARTER size');
assert(outNode.innerHTML.indexOf('mean-revert') > -1 && outNode.innerHTML.indexOf('gpip') > -1,
       'playbook UI: setup pills rendered as .gpip chips');

/* now stub every source risk-on => score +7 RISK-ON full/long */
sandbox.ema = (arr) => arr.map(v => v * 0.99); // rising series => rising ema legs
sandbox.getDXY = async () => ({ value: 102, trend20: 'FALLING', change20Pct: -0.8 });
sandbox.getGoldMacro = async () => ({ tnx: 4.0, tnxTrend: 'FALLING' });
const ethbtcKlines = [];
for (let i = 0; i < 40; i++) ethbtcKlines.push([0, 0, 0, 0, 0.05 + i * 0.001, 0, 0, 0, 0, 0, 0, 0]);
sandbox.fetch = async (url) => {
  const u = String(url);
  if (u.indexOf('coingecko.com') > -1)
    return { ok: true, status: 200, json: async () => ({ data: { market_cap_percentage: { btc: 45 } } }) };
  if (u.indexOf('alternative.me') > -1)
    return { ok: true, status: 200, json: async () => ({ data: [{ value: '75', value_classification: 'Greed' }] }) };
  if (u.indexOf('api.binance.com') > -1)
    return { ok: true, status: 200, json: async () => ethbtcKlines };
  return { ok: false, status: 503, json: async () => null };
};
let okOn = await clickAndWait('8/8 sources ok');
assert(okOn, 'playbook UI: fully-stubbed RISK-ON scan completes (8/8 sources ok)');
assert(outNode.innerHTML.indexOf('LONG-ONLY') > -1 && outNode.innerHTML.indexOf('FULL') > -1
       && outNode.innerHTML.indexOf('card long') > -1,
       'playbook UI: RISK-ON renders LONG-ONLY at FULL size on a .card.long');
assert(outNode.innerHTML.indexOf('trend-follow') > -1 && outNode.innerHTML.indexOf('carry') > -1,
       'playbook UI: RISK-ON with dry-powder inflow shows trend-follow + carry setups');

/* ---------------- 14) HARD REFRESH contract: refresh field + status paths ---------------- */
console.log('== hard refresh: registration, refreshed/busy/skipped paths, never throws ==');
{
  const __unhandled = [];
  process.on('unhandledRejection', function(e){ __unhandled.push(e); });

  /* registration: refresh is the 4th field alongside id/label/mount */
  const rgTabEntry = W.HG_tabs[0];
  assert(typeof rgTabEntry.refresh === 'function',
         'refresh: HG_tabs registration exposes refresh() as the 4th field (id/label/mount/refresh)');

  /* the section-13 state already ran scans against live stubs -> refreshed */
  let rr = await rgTabEntry.refresh();
  assert(rr === 'refreshed', 'refresh after completed scans -> "refreshed" (got "' + rr + '")');
  assert(statNode.textContent.indexOf('sources ok') > -1 && outNode.innerHTML.indexOf('PLAYBOOK') > -1,
         'refresh re-ran the gauge scan and re-rendered the dashboard');

  /* fresh, never-mounted module in a second context: skip + busy + never-throws */
  let rgFetchCalls = 0;
  const sandbox2 = {
    window: {}, console, setTimeout, clearTimeout, AbortController,
    fetch: async function(){
      rgFetchCalls++;
      await new Promise(r => setTimeout(r, 40)); /* slow enough to observe the busy window */
      return { ok: false, status: 503, json: async () => null };
    }
  };
  const ctx2 = vm.createContext(sandbox2);
  vm.runInContext(readFileSync(path.join(root, 'regime.js'), 'utf8'), ctx2, { filename: 'regime.js' });
  const W2 = sandbox2.window;
  const tab2 = W2.HG_tabs[0];

  let r2 = await tab2.refresh();
  assert(r2 === 'skipped: not run yet', 'refresh before mount -> "skipped: not run yet" (got "' + r2 + '")');
  assert(rgFetchCalls === 0, 'pre-run refresh fires no gauge fetch (no first-time scan from a global refresh)');

  const el2 = fakeEl();
  tab2.mount(el2); /* auto-run starts with the slow stub fetch in flight */
  const stat2 = el2._nodes['#regimeStat'], out2 = el2._nodes['#regimeOut'], run2 = el2._nodes['#regimeRun'];
  r2 = await tab2.refresh();
  assert(r2 === 'busy', 'refresh while the auto-run scan is in flight -> "busy" (got "' + r2 + '")');

  let settled2 = false;
  for (let i = 0; i < 200; i++){
    if (run2.disabled === false && (stat2.textContent || '').indexOf('sources ok') > -1){ settled2 = true; break; }
    await new Promise(r => setTimeout(r, 25));
  }
  assert(settled2 && rgFetchCalls > 0, 'fixture: auto-run completes against the slow dead fetch stub');

  /* post-run refresh re-scans exactly once: 3 fetch-backed gauges here
     (BTC dominance, F&G, stables — klines/ema/DXY/macro globals absent) */
  const beforeCalls = rgFetchCalls;
  r2 = await tab2.refresh();
  assert(r2 === 'refreshed' && rgFetchCalls === beforeCalls + 3,
         'post-run refresh re-scans exactly once -> "refreshed" (fetch calls ' + beforeCalls + ' -> ' + rgFetchCalls + ')');

  /* busy guard: overlapping refresh adds zero fetches */
  const p1 = tab2.refresh();
  const rBusy = await tab2.refresh();
  const rDone = await p1;
  assert(rBusy === 'busy' && rDone === 'refreshed' && rgFetchCalls === beforeCalls + 6,
         'overlapping refresh is busy-guarded — in-flight scan completes, no double-fetch (calls ' + rgFetchCalls + ')');

  /* never throws: a throwing fetch degrades to the honest all-sources-down render */
  sandbox2.fetch = async function(){ rgFetchCalls++; throw new Error('net down'); };
  let threw = null; r2 = null;
  try { r2 = await tab2.refresh(); } catch(e){ threw = e; }
  assert(!threw && r2 === 'refreshed' && out2.innerHTML.indexOf('unreachable') > -1,
         'refresh never rejects — a throwing fetch degrades to the honest all-sources-down render (got "' + r2 + '")');

  await new Promise(r => setTimeout(r, 100));
  assert(__unhandled.length === 0, 'no unhandled rejections on any refresh path');
}

/* ---------------- 15) BRAIN state getter — window.regimeState ----------------
   Fresh context: getter exposed; null before the first successful scan;
   populated {label, score, playbook, at} after a fully-stubbed RISK-ON scan;
   deep-frozen fresh copies; a failing re-run keeps the previous good
   snapshot with its original `at`; sabotaged internals -> null, no throw. */
console.log('== BRAIN state getter (window.regimeState) ==');
{
  const rows260 = [];
  for (let i = 0; i < 260; i++) rows260.push({ t: i, o: 100, h: 110, l: 90, c: 100 + i, v: 1 });
  const ethbtcKlines3 = [];
  for (let i = 0; i < 40; i++) ethbtcKlines3.push([0, 0, 0, 0, 0.05 + i * 0.001, 0, 0, 0, 0, 0, 0, 0]);
  const llama3 = { peggedAssets: [
    { symbol: 'USDT', circulating: { peggedUSD: 101e9 }, circulatingPrevWeek: { peggedUSD: 100e9 }, circulatingPrevMonth: { peggedUSD: 99e9 } }
  ]};
  const sandbox3 = {
    window: {}, console, setTimeout, clearTimeout, AbortController,
    ema: (arr) => arr.map(v => v * 0.99),
    binanceKlines: async () => rows260,
    getDXY: async () => ({ value: 102, trend20: 'FALLING', change20Pct: -0.8 }),
    getGoldMacro: async () => ({ tnx: 4.0, tnxTrend: 'FALLING' }),
    fetch: async (url) => {
      const u = String(url);
      if (u.indexOf('coingecko.com') > -1)
        return { ok: true, status: 200, json: async () => ({ data: { market_cap_percentage: { btc: 45 } } }) };
      if (u.indexOf('alternative.me') > -1)
        return { ok: true, status: 200, json: async () => ({ data: [{ value: '75', value_classification: 'Greed' }] }) };
      if (u.indexOf('api.binance.com') > -1)
        return { ok: true, status: 200, json: async () => ethbtcKlines3 };
      if (u.indexOf('stablecoins.llama.fi') > -1)
        return { ok: true, status: 200, json: async () => llama3 };
      return { ok: false, status: 503, json: async () => null };
    }
  };
  const ctx3 = vm.createContext(sandbox3);
  vm.runInContext(readFileSync(path.join(root, 'regime.js'), 'utf8'), ctx3, { filename: 'regime.js' });
  const W3 = sandbox3.window;
  const tab3 = W3.HG_tabs[0];

  assert(typeof W3.regimeState === 'function', 'state: window.regimeState exposed');
  assert(W3.regimeState() === null, 'state: null before the first successful scan');

  const el3 = fakeEl();
  tab3.mount(el3); /* auto-run starts */
  const stat3 = el3._nodes['#regimeStat'], out3 = el3._nodes['#regimeOut'], run3 = el3._nodes['#regimeRun'];
  let settled3 = false;
  for (let i = 0; i < 200; i++){
    if (run3.disabled === false && (stat3.textContent || '').indexOf('8/8 sources ok') > -1){ settled3 = true; break; }
    await new Promise(r => setTimeout(r, 25));
  }
  assert(settled3, 'state: fully-stubbed RISK-ON scan completes (8/8 sources ok)');

  const st = W3.regimeState();
  assert(st && typeof st === 'object' && typeof st.at === 'number' && isFinite(st.at),
         'state: populated after the successful scan ({label, score, playbook, at})');
  assert(st.label === 'RISK-ON' && st.score === 7,
         'state: label + score come from the regimeVerdict result (RISK-ON, 7)');
  assert(st.playbook && st.playbook.regime === 'RISK-ON' && st.playbook.bias === 'LONG-ONLY'
         && st.playbook.cls === 'long' && Array.isArray(st.playbook.setups),
         'state: playbook is the window.regimePlaybook output (bias LONG-ONLY, setups array)');
  assert(st.btcdPct === 45 && st.dxyTrend === 'FALLING',
         'state: btcdPct + dxyTrend exposed for macro alt filters');
  assert(Object.isFrozen(st) && Object.isFrozen(st.playbook) && Object.isFrozen(st.playbook.setups),
         'state: the view is deep-frozen (state, playbook, setups all frozen)');
  const st2 = W3.regimeState();
  assert(st2 !== st && st2.playbook !== st.playbook && JSON.stringify(st2) === JSON.stringify(st),
         'state: each call hands a fresh deep copy with identical content');

  /* failing re-run (DOM dead -> rgRun catch path) keeps the previous good snapshot */
  const desc3 = Object.getOwnPropertyDescriptor(out3, 'innerHTML');
  Object.defineProperty(out3, 'innerHTML', {
    configurable: true, get: function(){ return ''; }, set: function(){ throw new Error('dom dead'); }
  });
  let rfThrew = null, rf = null;
  try{ rf = await tab3.refresh(); }catch(e){ rfThrew = e; }
  Object.defineProperty(out3, 'innerHTML', desc3);
  const st3 = W3.regimeState();
  assert(!rfThrew, 'state: failing re-run never rejects the refresh');
  assert(st3 && st3.at === st.at && st3.label === 'RISK-ON' && st3.score === 7,
         'state: stale-good snapshot preserved after the failing re-run (same at, same content)');

  /* sabotaged internals: getter degrades to null, never throws, then recovers */
  let sThrew = null, sGot = 'unset';
  vm.runInContext('globalThis.__keepIA = Array.isArray; Array.isArray = undefined;', ctx3);
  try{ sGot = W3.regimeState(); }catch(e){ sThrew = e; }
  vm.runInContext('Array.isArray = globalThis.__keepIA; delete globalThis.__keepIA;', ctx3);
  assert(!sThrew && sGot === null,
         'state: getter never throws with sabotaged internals (Array.isArray removed) — returns null');
  assert(W3.regimeState() !== null, 'state: getter recovers once internals are restored');
}

/* ---------------- summary ---------------- */
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
console.log('ALL REGIME TESTS PASSED');
