/* HARDGATE — brainrobust.js (browser) + brain-robust.mjs (daemon) contract tests.
   Proves LIVE eligibility stamps on __hgBrainLast rows match daemon filtering.
   Run: node tests/test-brain-robust.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brainLiveEligibleRow, filterDaemonBrainRows } from '../lib/brain-robust.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  pass++;
  console.log('  ok —', label);
};

function loadBrainRobust(){
  globalThis.window = globalThis.window || {};
  const W = globalThis.window;
  W.familyEvOk = function(plan){
    return !!(plan && isFinite(plan.entry) && isFinite(plan.stop));
  };
  W.hgTripleStackMatch = function(sym, dir){
    return sym === 'BTCUSDT' && dir === 'long';
  };
  vm.runInThisContext(fs.readFileSync(root + 'brainrobust.js', 'utf8'), { filename: 'brainrobust.js' });
  return W;
}

function primeBrowserRow(opts){
  opts = opts || {};
  return {
    sym: opts.sym || 'BTCUSDT',
    lane: 'crypto',
    dec: { tier: opts.tier || 'PRIME', dir: opts.dir || 'long', agree: 8 },
    plan: opts.plan || { entry: 100, stop: 95, t1: 110, t2: 117.5, confirmed: true, rr1: 2 },
    col: { votes: opts.votes || [], notes: opts.notes || {} },
    rows4h: opts.rows4h || [{ o: 1, h: 1, l: 1, c: 1 }],
  };
}

function snapshotFromBrowserRow(row, W){
  var liveEl = W.brainLiveEligible(row);
  var p = row.plan;
  return {
    sym: row.sym,
    dir: row.dec.dir,
    tier: row.dec.tier,
    liveOk: liveEl.ok,
    liveReasons: liveEl.reasons || [],
    plan: (p && isFinite(p.entry) && isFinite(p.stop) && isFinite(p.t1))
      ? { entry: p.entry, stop: p.stop, t1: p.t1, t2: p.t2 || null }
      : null,
  };
}

console.log('== brainrobust.js exports ==');
{
  const W = loadBrainRobust();
  ok(typeof W.brainLiveEligible === 'function', 'brainLiveEligible exported');
  ok(typeof W.applyPrimeCrowdingVeto === 'function', 'applyPrimeCrowdingVeto exported');
  ok(typeof W.brainLiveModeOn === 'function', 'brainLiveModeOn exported');
  ok(typeof W.brainRowRank === 'function', 'brainRowRank exported');
}

console.log('== browser LIVE eligibility ==');
{
  const W = loadBrainRobust();
  var good = primeBrowserRow({});
  ok(W.brainLiveEligible(good).ok, 'PRIME + triple stack + confirmed plan passes');

  var noStack = primeBrowserRow({ sym: 'ETHUSDT' });
  var noStackEl = W.brainLiveEligible(noStack);
  ok(!noStackEl.ok && noStackEl.reasons.some(function(r){ return r.indexOf('TRIPLE STACK') >= 0; }),
    'missing TRIPLE STACK blocks LIVE');

  var unconfirmed = primeBrowserRow({ plan: { entry: 100, stop: 95, t1: 110, confirmed: false } });
  ok(!W.brainLiveEligible(unconfirmed).ok, 'unconfirmed plan blocks LIVE');

  var liq = primeBrowserRow({ notes: { liqpool: 'CAUTION — stop in pool' } });
  ok(!W.brainLiveEligible(liq).ok, 'liqpool caution blocks LIVE');
}

console.log('== PRIME crowding veto ==');
{
  const W = loadBrainRobust();
  var row = primeBrowserRow({
    votes: [
      { layer: 'fundz', vote: 'long', caution: true, text: 'crowded' },
      { layer: 'oiflow', vote: 'long', text: 'NEW LONGS crowded' },
    ],
    xu: { fundingPct: 0.002 },
  });
  row.xu = { fundingPct: 0.002 };
  W.applyPrimeCrowdingVeto([row]);
  ok(row.dec.tier === 'HIGH' && row.dec.gatedFrom === 'PRIME', 'funding + OI crowding demotes PRIME → HIGH');
}

console.log('== browser snapshot → daemon live filter ==');
{
  const W = loadBrainRobust();
  var eligible = snapshotFromBrowserRow(primeBrowserRow({}), W);
  ok(eligible.liveOk, 'eligible browser row stamps liveOk true on snapshot shape');

  var blocked = snapshotFromBrowserRow(primeBrowserRow({ sym: 'ETHUSDT' }), W);
  ok(!blocked.liveOk, 'blocked browser row stamps liveOk false');

  var batch = [eligible, blocked, {
    sym: 'SOLUSDT', dir: 'short', tier: 'PRIME',
    liveOk: true,
    plan: { entry: 50, stop: 52, t1: 46 },
  }];
  var liveOut = filterDaemonBrainRows(batch, { liveMode: true, tiers: ['PRIME'] });
  ok(liveOut.length === 2 && liveOut.every(function(r){ return r.liveOk !== false; }),
    'daemon liveMode accepts only snapshot rows with liveOk !== false');

  ok(brainLiveEligibleRow(eligible).ok, 'brainLiveEligibleRow agrees with browser liveOk true');
  ok(!brainLiveEligibleRow(blocked).ok, 'brainLiveEligibleRow agrees with browser liveOk false');
}

console.log('== brainRowRank LIVE boost ==');
{
  const W = loadBrainRobust();
  var eligible = primeBrowserRow({});
  var ineligible = primeBrowserRow({ sym: 'ETHUSDT' });
  ok(W.brainRowRank(eligible) > W.brainRowRank(ineligible),
    'LIVE-eligible PRIME ranks above blocked PRIME');
}

console.log('\n' + pass + ' passed');
