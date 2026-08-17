/* HARDGATE — a dead macro feed went on biasing the gold lane.

   macro-feeds.js is one of the modules no test executes. Running it with the
   feeds stubbed, then killing the feeds, showed the defect immediately: a
   failed refresh published nothing, which left the LAST GOOD state standing —
   the same object, with its original timestamp — for as long as the feed
   stayed down.

   brain.js reads that state and acts on it:

     trend 'spiking'  -> pushes a SHORT bias on gold, caution: true
     trend 'dropping' -> pushes a LONG bias on gold, strong: true
     divergence set   -> pushes a VETO

   So a dead US10Y feed biased gold short indefinitely, and a dead silver feed
   vetoed indefinitely, with nothing to say the reading had stopped being
   refreshed. brain.js already had the honest branch —
   `if (!inp.yield) hush('yield', 'no US10Y macro data — yield correlation
   unread')` — it just could never be reached.

   Expiry is set by the timeframe the data is BUILT from, not by taste: the
   US10Y trend comes off daily candles and stays fair for hours, the SMT
   divergence is computed from 15m bars and does not.

   Run: node tests/test-macro-feed-staleness.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function bars(n, base, drift){
  const out = [];
  let c = base;
  for (let i = 0; i < n; i++){ c = c * (1 + drift); out.push({ t: 1700000000 + i * 900, o: c, h: c * 1.001, l: c * 0.999, c: c, v: 1 }); }
  return out;
}

function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_warmups = [];
  /* The module arms a 5-minute refresh loop at load; stubbed so the test does
     not hang on a live timer. */
  let armed = 0;
  ctx.setTimeout = () => { armed++; return armed; };
  ctx.clearTimeout = () => {};
  ctx.setInterval = () => { armed++; return armed; };
  ctx.clearInterval = () => {};
  vm.createContext(ctx);
  ctx.getGoldCandles = async () => ({ rows: bars(50, 3300, 0.0005), source: 'stub-xau' });
  ctx.getSilverCandles = async () => ({ rows: bars(50, 40, 0.0004), source: 'stub-xag' });
  ctx.getUST10YCandles = async () => bars(10, 4.2, 0.004);
  ctx.detectSMTDivergence = () => ({ smtActive: true, type: 'BEARISH_SMT', signal: 'stub' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'macro-feeds.js'), 'utf8'), ctx, { filename: 'macro-feeds.js' });
  ctx.__armedTimers = armed;
  return ctx;
}
function killFeeds(ctx){
  ctx.getUST10YCandles = async () => null;
  ctx.getGoldCandles = async () => null;
  ctx.getSilverCandles = async () => null;
  ctx.getUST10Y = undefined;
  ctx.getGoldMacro = undefined;
}

console.log('== the module loads and publishes a healthy read ==');
const W = boot();
{
  ok(typeof W.updateMacroFeeds === 'function', 'updateMacroFeeds exported');
  ok(typeof W.hgExpireMacroFeedState === 'function', 'the expiry is exported so staleness is testable');
  await W.updateMacroFeeds();
  ok(W.__hgGoldYieldState && W.__hgGoldYieldState.trend === 'spiking', 'a rising series reads as spiking');
  ok(W.__hgGoldYieldState.stale === false, 'and is marked fresh');
  ok(W.__hgGoldSmtState && W.__hgGoldSmtState.divergence === 'BEARISH', 'the SMT divergence is published');
  ok(W.__hgGoldSmtState.stale === false, 'and is marked fresh');
}

console.log('\n== THE DEFECT: a failed refresh no longer leaves a silent survivor ==');
{
  const beforeYield = W.__hgGoldYieldState;
  killFeeds(W);
  await W.updateMacroFeeds();
  ok(W.__hgGoldYieldState !== null, 'the last value is kept — a single failure should not erase a good read');
  ok(W.__hgGoldYieldState.stale === true, 'but it is now marked STALE (it used to survive unmarked)');
  ok(W.__hgGoldSmtState.stale === true, 'and so is the SMT divergence');
  ok(W.__hgGoldYieldState.trend === beforeYield.trend, 'the value itself is unchanged, only its status');
}

console.log('\n== expiry follows the timeframe the data was built from ==');
{
  const now = Date.now();

  /* SMT comes off 15m bars: gone within a couple of hours. */
  W.hgExpireMacroFeedState(now + 3 * 60 * 60 * 1000);
  ok(W.__hgGoldSmtState === null, 'after 3h the SMT divergence is withdrawn');
  ok(W.__hgSmtState === null, 'and so is the alias brain reads');
  ok(W.__hgGoldSmtStale && /silver feed has not confirmed/.test(W.__hgGoldSmtStale.reason),
    'with the reason recorded (' + (W.__hgGoldSmtStale && W.__hgGoldSmtStale.reason) + ')');
  ok(W.__hgGoldSmtStale.last && W.__hgGoldSmtStale.last.divergence === 'BEARISH',
    'and the last known value kept for inspection rather than discarded');

  /* The yield trend comes off daily candles: still fair at 3h. */
  ok(W.__hgGoldYieldState !== null, 'the yield read is NOT withdrawn at 3h — daily data is still fair');
  ok(W.__hgGoldYieldState.stale === true, 'though it is still flagged stale');

  W.hgExpireMacroFeedState(now + 25 * 60 * 60 * 1000);
  ok(W.__hgGoldYieldState === null, 'after 25h it is withdrawn too');
  ok(W.__hgYieldState === null, 'and so is its alias');
  ok(W.__hgGoldYieldStale && /US10Y feed has not confirmed/.test(W.__hgGoldYieldStale.reason),
    'with its own reason (' + (W.__hgGoldYieldStale && W.__hgGoldYieldStale.reason) + ')');
}

console.log('\n== withdrawn state is what brain treats as UNREAD ==');
{
  /* brain.js: `if (!inp.yield || typeof inp.yield !== 'object') hush(...)`.
     A null state is what makes that honest branch fire. */
  const brain = fs.readFileSync(path.join(ROOT, 'brain.js'), 'utf8');
  ok(/no US10Y macro data — yield correlation unread/.test(brain), 'brain has an unread branch for the yield');
  ok(/no Silver data — SMT divergence unread/.test(brain), 'and one for the SMT');
  ok(/if \(!inp\.yield \|\| typeof inp\.yield !== 'object'\)/.test(brain), 'it is reached on a falsy state');
  ok(W.__hgGoldYieldState === null && W.__hgGoldSmtState === null,
    'and the expired states are falsy, so those branches now actually fire');
}

console.log('\n== recovery clears both the flag and the diagnostic ==');
{
  const ctx = boot();
  await ctx.updateMacroFeeds();
  killFeeds(ctx);
  await ctx.updateMacroFeeds();
  ok(ctx.__hgGoldYieldState.stale === true, 'stale after the outage');
  ctx.getUST10YCandles = async () => bars(10, 4.2, 0.004);
  ctx.getGoldCandles = async () => ({ rows: bars(50, 3300, 0.0005), source: 'stub-xau' });
  ctx.getSilverCandles = async () => ({ rows: bars(50, 40, 0.0004), source: 'stub-xag' });
  await ctx.updateMacroFeeds();
  ok(ctx.__hgGoldYieldState.stale === false, 'fresh again once the feed returns');
  ok(ctx.__hgGoldYieldStale === null, 'and the stale diagnostic is cleared, not left behind');
  ok(ctx.__hgGoldSmtState.stale === false, 'the SMT recovers too');
}

console.log('\n== the trend classifier no longer reads a missing value as zero ==');
{
  /* Hardening, not a live fault: both upstream parsers already drop
     non-finite closes, so nothing reaches this with a null today. But the
     guard was plainly meant to catch missing data and did not — a real
     current against a null prior returned 'spiking', an active macro call
     manufactured from a single data point. */
  const src = fs.readFileSync(path.join(ROOT, 'macro-feeds.js'), 'utf8');
  ok(/function __yieldNum\(v\)/.test(src), 'a null-rejecting numeric reader was added');
  ok(/var c = __yieldNum\(cur\), p = __yieldNum\(prior\);/.test(src), 'and the classifier reads through it');
  ok(/not a live fault/.test(src), 'the comment states the scope honestly rather than claiming a live bug');
  ok(/Both upstream parsers/.test(src), 'and names why it is latent, so the claim can be re-checked');

  const macro = fs.readFileSync(path.join(ROOT, 'macro.js'), 'utf8');
  ok(/if \(o == null \|\| h == null \|\| l == null \|\| c == null\) continue;/.test(macro),
    'the Yahoo parser really does drop null closes, which is why this is latent');
  ok(/if \(!m \|\| !isFinite\(y10\)\) continue;/.test(macro),
    'and so does the treasury parser');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL MACRO-FEED STALENESS TESTS PASSED');
