#!/usr/bin/env node
/* HARDGATE — OMNIPRESENT T2 is the runner. It must sit beyond T1.

   Live MOST PROBABLE (B-TAO_USDT LONG) printed:
     ENTRY 216.0657  STOP 213.9021
     T1    233.2800  (8.0R take profit)
     T2    226.8840  (5.0R runner)   ← inside T1. TP2 IS WRONG.

   Root cause: formation snapped T1 to a farther structure pool and left
   the named 5R T2 in place. The runner cannot be closer than the first
   take. Fix reorders existing prices (nearer = T1, farther = T2) and
   never invents a new level.

   Run: node tests/test-op-t2-order.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond){ passed++; console.log('  ok —', label); }
  else { failed++; console.log('  FAIL —', label); }
};
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise,
                RegExp, Error, TypeError, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['formation.js', 'setup-ui.js', 'omnipresent.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

const TAO = {
  dir: 'long',
  entry: 216.0657,
  stop: 213.9021,
  t1: 233.2800,   /* 8.0R — structure snap */
  t2: 226.8840    /* 5.0R — named floor, CLOSER than T1 */
};

const W = boot();

console.log('== helper exported ==');
ok(typeof W.hgOrderRunnerTargets === 'function', 'hgOrderRunnerTargets exported');

console.log('\n== TAO LONG: swap, do not invent ==');
{
  const o = W.hgOrderRunnerTargets(TAO.dir, TAO.entry, TAO.t1, TAO.t2);
  ok(o && isFinite(o.t1) && isFinite(o.t2), 'order returns both targets');
  ok(o.t1 > TAO.entry && o.t2 > o.t1, 'LONG: entry < T1 < T2');
  ok(Math.abs(o.t1 - TAO.t2) < 1e-9 && Math.abs(o.t2 - TAO.t1) < 1e-9,
    'swap uses the two existing prices — no invented level');
  ok(o.swapped === true, 'marks the swap so sources can follow');
  const risk = TAO.entry - TAO.stop;
  const rr1 = (o.t1 - TAO.entry) / risk;
  const rr2 = (o.t2 - TAO.entry) / risk;
  ok(Math.abs(rr1 - 5) < 0.05 && Math.abs(rr2 - 8) < 0.05,
    'after swap: T1 is ~5R first take, T2 is ~8R runner (got '
    + rr1.toFixed(2) + 'R / ' + rr2.toFixed(2) + 'R)');
}

console.log('\n== already stacked / short / drop ==');
{
  const keep = W.hgOrderRunnerTargets('long', 100, 104, 110);
  ok(keep.t1 === 104 && keep.t2 === 110 && !keep.swapped, 'already stacked LONG is left alone');

  const sh = W.hgOrderRunnerTargets('short', 100, 90, 94);
  ok(sh.t2 < sh.t1 && sh.t1 < 100 && sh.swapped, 'SHORT: T2 was closer — swap so T1=94 T2=90');
  ok(Math.abs(sh.t1 - 94) < 1e-9 && Math.abs(sh.t2 - 90) < 1e-9, 'SHORT swap uses existing prices');

  const same = W.hgOrderRunnerTargets('long', 100, 104, 104);
  ok(!isFinite(same.t2) && same.dropped, 'T2 equal to T1 is dropped, not printed as a runner');

  const behind = W.hgOrderRunnerTargets('long', 100, 104, 98);
  ok(!isFinite(behind.t2) && behind.dropped, 'T2 on the stop side of entry is dropped');
}

console.log('\n== MOST PROBABLE HTML never prints a closer runner ==');
{
  ok(typeof W.hgMostProbablePanelHTML === 'function', 'hgMostProbablePanelHTML exported');
  const html = W.hgMostProbablePanelHTML('omnipresent', {
    tier: 'clean',
    row: {
      sym: 'B-TAO_USDT', dir: 'long',
      entry: TAO.entry, stop: TAO.stop, t1: TAO.t1, t2: TAO.t2, rr: 8
    }
  });
  ok(/MOST PROBABLE/.test(html) && /B-TAO_USDT/.test(html), 'banner names the contract');
  const t1m = html.match(/<i>T1<\/i><b>([^<]+)<\/b><u>([^<]+)<\/u>/);
  const t2m = html.match(/<i>T2<\/i><b>([^<]+)<\/b><u>([^<]+)<\/u>/);
  ok(t1m && t2m, 'T1 and T2 cells render');
  const t1Px = +t1m[1], t2Px = +t2m[1];
  ok(isFinite(t1Px) && isFinite(t2Px) && t2Px > t1Px,
    'HTML T2 price is beyond T1 (got T1 ' + t1m[1] + ' T2 ' + t2m[1] + ')');
  ok(/5\.0R take profit/.test(html) && /8\.0R runner/.test(html),
    'R labels follow the ordered prices, not the inverted incoming rr');
  ok(!/8\.0R take profit/.test(html) || !/5\.0R runner/.test(html),
    'does not keep the inverted 8R-first / 5R-runner pair');
}

console.log('\n== opFormCandidate copies the ordered ticket ==');
{
  const W2 = boot();
  W2.hgOmniFormTicket = function (plan){
    return { ok: true, plan: Object.assign({}, plan, { t1: TAO.t1, t2: TAO.t2, t1Source: 'structure' }) };
  };
  const cand = {
    dir: 'long', status: 'ARMED', sym: 'B-TAO_USDT',
    entry: TAO.entry, stop: TAO.stop, t1: TAO.entry + 2 * (TAO.entry - TAO.stop),
    t2: TAO.t2, rr1: 2, rr2: 5, risk: TAO.entry - TAO.stop, atr: 2.16
  };
  const out = W2.opFormCandidate(cand, [], TAO.entry);
  ok(out && out.t2 > out.t1 && out.t1 > out.entry,
    'opFormCandidate LONG: T1 < T2 after formation snap');
  ok(Math.abs(out.t1 - TAO.t2) < 1e-6 && Math.abs(out.t2 - TAO.t1) < 1e-6,
    'candidate keeps the two live prices, swapped');
}

console.log('\n== wiring ==');
{
  const form = read('formation.js');
  const op = read('omnipresent.js');
  const ui = read('setup-ui.js');
  ok(/function hgOrderRunnerTargets/.test(form) && /G\.hgOrderRunnerTargets/.test(form),
    'formation.js owns the helper');
  ok(/hgOrderRunnerTargets/.test(form) && /hgFormKeepLevels/.test(form),
    'keep-levels path can see the helper');
  ok(/hgOrderRunnerTargets/.test(op), 'OMNIPRESENT applies the order after formation');
  ok(/hgOrderRunnerTargets/.test(ui), 'MOST PROBABLE panel orders before paint');
}

console.log('\n== stamp ==');
{
  ok(swCacheOk(read('sw.js')), 'sw cache matches stamp ' + HG_VER);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
