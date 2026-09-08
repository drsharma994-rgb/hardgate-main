/* v680: reversalsniper wires hgFwdResolve into its per-symbol scan loop.

   The gap. Reversalsniper records every scan's picks via hgFwdRecordScan
   (line ~710). But it never called hgFwdResolve, so those records
   accumulated as 'open' forever unless another tab happened to scan the
   same alt symbol (omnigold does resolve; omnipresent does; goldswing
   does for XAU only; no crypto-universe tab besides omnipresent resolves).
   Result: rsniper's measured-edge lookup (bt.expR / bt.winPct feeding
   +3 conviction in rsConviction) never learned from live outcomes on its
   own picks. The v664/v671 measured-edge rebalance work assumed the edge
   signal was truthful; on reversalsniper it silently was not.

   The fix. In the per-symbol scan loop, immediately after fetching rows
   and BEFORE assessing new setups, call hgFwdResolve(item.sym, '4h', rows).
   This settles any prior open records for this symbol using the freshest
   rows we just downloaded, so the very next scan's edge lookup sees
   updated stats. Guarded (no-op when helper absent, e.g. test harness).
   hgFwdResolve dedupes internally so a rescan does not double-settle. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'reversalsniper.js'), 'utf8');

/* --- rationale + call --- */
assert.ok(/v680: settle any prior open forward-log records for this symbol/.test(src),
  'v680 rationale must be present at the resolve callsite');
assert.ok(/if \(typeof W\.hgFwdResolve === 'function'\)\{[\s\S]{0,200}?W\.hgFwdResolve\(item\.sym, '4h', rows\);/.test(src),
  'must call W.hgFwdResolve with correct args');
assert.ok(/W\.hgFwdWarn\('reversalsniper:resolve', eR\)/.test(src),
  'must warn via hgFwdWarn on resolve error');

/* --- structural: resolve happens AFTER fetch and BEFORE rsAssess --- */
const loopMatch = src.match(/var rows = await rsFetchKlines\(item, '4h', KL_LIMIT\);[\s\S]{0,1500}?var setup = rsAssess\(rows\);/);
assert.ok(loopMatch, 'must find the fetch->resolve->assess ordering');
assert.ok(/W\.hgFwdResolve\(item\.sym, '4h', rows\);/.test(loopMatch[0]),
  'the resolve must sit between fetch and assess');

/* --- runtime demonstration: replicate the guard pattern --- */
var resolveCalls = [];
function simulateScan(W, item, rows){
  if (typeof W.hgFwdResolve === 'function'){
    try { W.hgFwdResolve(item.sym, '4h', rows); }
    catch (e) { /* warn omitted for demo */ }
  }
  return { rows: rows };
}

/* Case A: helper present, called with the right args */
{
  const W = { hgFwdResolve: function(sym, tf, r){ resolveCalls.push({ sym: sym, tf: tf, len: r.length }); } };
  simulateScan(W, { sym: 'BTCUSD' }, [{ t: 100, c: 1 }, { t: 200, c: 2 }]);
  assert.equal(resolveCalls.length, 1, 'helper called once');
  assert.equal(resolveCalls[0].sym, 'BTCUSD');
  assert.equal(resolveCalls[0].tf, '4h');
  assert.equal(resolveCalls[0].len, 2);
}

/* Case B: helper absent, scan proceeds without error */
{
  assert.doesNotThrow(function(){ simulateScan({}, { sym: 'BTCUSD' }, [{ t: 100, c: 1 }]); },
    'helper absent: scan proceeds');
}

/* Case C: helper throws, caught */
{
  const W = { hgFwdResolve: function(){ throw new Error('boom'); } };
  assert.doesNotThrow(function(){ simulateScan(W, { sym: 'BTCUSD' }, [{ t: 100, c: 1 }]); },
    'helper throws: caught');
}

/* Case D: per-symbol, in scan order */
{
  resolveCalls = [];
  const W = { hgFwdResolve: function(sym){ resolveCalls.push(sym); } };
  ['BTCUSD', 'ETHUSD', 'SOLUSD'].forEach(function(sym){
    simulateScan(W, { sym: sym }, [{ t: 100, c: 1 }]);
  });
  assert.equal(resolveCalls.length, 3);
  assert.deepEqual(resolveCalls, ['BTCUSD', 'ETHUSD', 'SOLUSD']);
}

/* --- coverage invariant: RECORD + RESOLVE both present --- */
assert.ok(/W\.hgFwdRecordScan\('REVERSALSNIPER'/.test(src),
  'reversalsniper must still RECORD its picks');
assert.ok(/W\.hgFwdResolve\(item\.sym, '4h', rows\);/.test(src),
  'reversalsniper must RESOLVE its prior picks (v680 adds this)');

/* --- version --- */
assert.ok(/^hg-v(?:680|68[1-9]|69\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v680',
  'HG_VER must be >= hg-v680 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('reversalsniper\\.js\\?v=' + qv).test(idx),
  'index.html reversalsniper.js cache-buster must be ?v=' + qv);

console.log('OK - v680: reversalsniper wires hgFwdResolve into scan loop');
console.log('  * fetch -> resolve -> assess ordering verified');
console.log('  * helper present: called with (sym, 4h, rows)');
console.log('  * helper absent: scan proceeds');
console.log('  * helper throws: caught');
console.log('  * per-symbol: one resolve per symbol in scan order');
console.log('  * RECORD + RESOLVE invariant preserved');
console.log('  * version bumped to ' + HG_VER);
