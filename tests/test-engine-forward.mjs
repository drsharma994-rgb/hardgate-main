/* HARDGATE — the EXECUTE tab never found out whether it was right.

   engine.js opens with its own statement of purpose: it answers "should I go
   long or short, and exactly where do I enter, stop, and take profit."  It
   runs its own six-gate funnel, produces its own levels, and — until this
   change — recorded nothing.

   The forward log is the only measurement in this app that accumulates.
   Every conclusion the desks draw about their own mechanics comes from it:
   measured-edge vetoes on it, the pooled tables are judged against it, and
   the whole multiple-comparisons discipline rests on it. EXECUTE was not in
   it, so the tab whose entire job is naming entry, stop and target had no
   record of whether any of them worked.

   A CORRECTION WORTH RECORDING. I first reported five unmeasured tabs —
   brain, engine, supersetup, pineavwap, pinenw — from a grep for hgFwdRecord
   inside each file. That was wrong, and following the delegation showed why:

     pineavwap, pinenw  route their whole scan through pineSubRunScan, which
                        already records, under each script's own id
     supersetup, brain  are AGGREGATORS. They call collectScanHits and absorb
                        other scanners' snapshots rather than producing their
                        own levels, and most of those sources already record.

   engine is the one that produces its own and recorded nothing.

   Survivors only, and only those carrying a full plan. A rejected candidate
   has no levels to settle against, and recording one would measure a trade
   this tab explicitly refused to take — the circular error omniroute's
   measured-edge gate documents at length.

   Run: node tests/test-engine-forward.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const ENGINE = read('engine.js');

console.log('== the EXECUTE tab records what it claimed ==');
{
  ok(/hgFwdRecordScan\('EXECUTE', '4h', fwd/.test(ENGINE), 'it calls the shared batch recorder');
  ok(/RECORD WHAT THIS TAB CLAIMED, SO IT CAN BE HELD TO IT/.test(ENGINE),
     'and records why, so it is not tidied away');
  ok(/only measurement in this app that\s+accumulates/.test(ENGINE),
     'naming what the forward log is for');
  ok(/mechanic: 'GATES-' \+ String\(s0\.conviction/.test(ENGINE),
     'conviction is the mechanic, so STRONG and MODERATE are measured apart');
  ok(/hgFwdWarn\('engine:forward'/.test(ENGINE), 'failures are reported through the shared warn channel');
}

/* Drive the real recorder with the exact shapes engine builds, so this tests
   the contract rather than the regex above. */
function boot(){
  const store = {};
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String };
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('hg-forward.js'), ctx, { filename: 'hg-forward.js' });
  return ctx;
}

console.log('\n== a survivor with a full plan is recorded ==');
{
  const W = boot();
  const n = W.hgFwdRecordScan('EXECUTE', '4h', [
    { sym: 'BTCUSDT', dir: 'long', entry: 60000, stop: 58000, t1: 64000, mechanic: 'GATES-STRONG', ticket: true }
  ], { horizonBars: 20 });
  ok(n === 1, 'one new trade recorded (' + n + ')');
  const s = W.hgFwdStats('EXECUTE', 'GATES-STRONG', false);
  ok(s && (s.open === 1 || s.samples === 1), 'and it is open in the EXECUTE pool');
}

console.log('\n== conviction tiers are measured apart, not pooled ==');
{
  const W = boot();
  W.hgFwdRecordScan('EXECUTE', '4h', [
    { sym: 'BTCUSDT', dir: 'long', entry: 60000, stop: 58000, t1: 64000, mechanic: 'GATES-STRONG', ticket: true },
    { sym: 'ETHUSDT', dir: 'long', entry: 3000, stop: 2900, t1: 3200, mechanic: 'GATES-MODERATE', ticket: true }
  ], { horizonBars: 20 });
  const a = W.hgFwdStats('EXECUTE', 'GATES-STRONG', false);
  const b = W.hgFwdStats('EXECUTE', 'GATES-MODERATE', false);
  ok(a.open === 1 && b.open === 1, 'STRONG and MODERATE each hold their own record');
  const all = W.hgFwdStats('EXECUTE', null, false);
  ok(all.open === 2, 'and the tab total is both (' + all.open + ')');
}

console.log('\n== the same scan run twice does not double-count ==');
{
  const W = boot();
  const cand = [{ sym: 'BTCUSDT', dir: 'long', entry: 60000, stop: 58000, t1: 64000,
                  mechanic: 'GATES-STRONG', ticket: true }];
  const first = W.hgFwdRecordScan('EXECUTE', '4h', cand, { horizonBars: 20 });
  const second = W.hgFwdRecordScan('EXECUTE', '4h', cand, { horizonBars: 20 });
  ok(first === 1, 'the first scan records it');
  ok(second === 0, 'a rescan inside the same bar records nothing (' + second + ')');
  ok(W.hgFwdStats('EXECUTE', 'GATES-STRONG', false).open === 1, 'so the pool still holds exactly one');
}

console.log('\n== degenerate survivors are filtered before they reach the log ==');
{
  const W = boot();
  const n = W.hgFwdRecordScan('EXECUTE', '4h', [
    { sym: 'A', dir: 'long', entry: 100, stop: 100, t1: 110, mechanic: 'GATES-STRONG' },   /* entry === stop */
    { sym: 'B', dir: 'long', entry: NaN, stop: 90, t1: 110, mechanic: 'GATES-STRONG' },
    { sym: '',  dir: 'long', entry: 100, stop: 90, t1: 110, mechanic: 'GATES-STRONG' },
    { sym: 'D', dir: 'sideways', entry: 100, stop: 90, t1: 110, mechanic: 'GATES-STRONG' },
    null
  ], { horizonBars: 20 });
  ok(n === 0, 'none of the malformed candidates is recorded (' + n + ')');
  /* engine's own filter must reject the same shapes before calling. */
  ok(/e0 === st0\) continue;/.test(ENGINE), 'engine rejects entry === stop');
  ok(/!isFinite\(e0\) \|\| !isFinite\(st0\) \|\| !isFinite\(t10\)/.test(ENGINE), 'and any non-finite level');
  ok(/s0\.dir !== 'long' && s0\.dir !== 'short'/.test(ENGINE), 'and any direction that is not long or short');
  ok(/if \(!s0 \|\| !s0\.plan \|\| !s0\.sym\) continue;/.test(ENGINE), 'and anything with no plan or no symbol');
}

console.log('\n== rejected candidates are NOT recorded ==');
{
  /* The circular error: measuring a trade the tab refused to take. engine
     builds `rj` for rejects and must never feed it to the log. */
  /* Slice back from the CALL, not from the feature check that precedes it. */
  const i = ENGINE.indexOf("hgFwdRecordScan('EXECUTE'");
  ok(i > 0, 'the EXECUTE record call is present');
  const before = ENGINE.slice(Math.max(0, i - 1400), i);
  ok(/for \(i = 0; i < sv\.length; i\+\+\)/.test(before), 'the loop iterates survivors');
  ok(!/for \(i = 0; i < rj\.length/.test(before), 'and never the rejected list');
  ok(/Survivors only/.test(ENGINE), 'the source says so');
  ok(/circular/.test(ENGINE), 'and names the error it is avoiding');
}

console.log('\n== instrumentation can never break a scan ==');
{
  ok(/\} catch \(eFwd\)\{/.test(ENGINE), 'the recording block has its own catch');
  /* It sits inside the snapshot try, which already promises this. */
  ok(/snapshotting must never break the scan/.test(ENGINE), 'inside the block that already promised that');
  /* And a missing hg-forward.js must be a no-op, not a throw. */
  ok(/typeof G\.hgFwdRecordScan === 'function'/.test(ENGINE),
     'the recorder is feature-checked, so a missing module is a no-op');
}

console.log('\n== the correction: the other four were already measured ==');
{
  const PSUB = read('pine-sub.js');
  ok(/hgFwdRecordScan\('PINE'/.test(PSUB), 'pineSubRunScan records for every pine sub-tab');
  for (const f of ['pineavwap.js', 'pinenw.js']){
    ok(/pineSubRunScan/.test(read(f)), f + ' routes its scan through it, so it was never unmeasured');
  }
  ok(/collectScanHits|absorbSnap|buildSnapFromCryptoScans/.test(read('supersetup.js')),
     'supersetup is an aggregator — it absorbs other scanners rather than producing its own levels');
  /* brain is NOT an aggregator, and calling it one would have been a second
     wrong claim. It builds plans itself, and says so: "plans via
     window.smartSetup / window.hgPlanLevels only — never invented". It also
     prefers the gate engine's survivors when they exist, so part of what it
     shows is now measured through the EXECUTE pool and part is its own.
     Recording it needs that overlap thought through rather than a one-line
     call, so it is named here as outstanding rather than quietly done. */
  const BRAIN = read('brain.js');
  ok(/hgPlanLevels/.test(BRAIN), 'brain builds its own plans through hgPlanLevels');
  ok(/never invented/.test(BRAIN), 'and says its plans are never invented');
  ok(!/hgFwdRecord/.test(BRAIN), 'and is still unmeasured — the remaining gap, deliberately left');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL ENGINE FORWARD-LOG TESTS PASSED');
