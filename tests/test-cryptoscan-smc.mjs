/* CRYPTO SCAN — SMC must CHANGE the ordering, not decorate it (hg-v732).

   Every assertion here is differential: it compares two setups that are
   identical in every field the old model looked at and differ ONLY in
   smc.grade. The previous SMC activation (v730) shipped as dead code and its
   test still passed, because that test only asserted nothing crashed and a
   field was absent. These fail if the wiring is inert.

   Run: node tests/test-cryptoscan-smc.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, Promise, RegExp,
    isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout, Map, Set,
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.document = { createElement: () => ({ style: {}, appendChild(){}, addEventListener(){} }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   addEventListener(){} };
  ctx.fetch = () => Promise.reject(new Error('no network in tests'));
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'cryptoscan.js'), 'utf8'), ctx, { filename: 'cryptoscan.js' });
  return ctx;
}

/* identical pct, identical everything else — only smc.grade differs */
const mk = (sym, grade, pct) => ({
  sym, dir: 'long', pct: pct == null ? 0.82 : pct,
  isPro: true, qualityGates: [], isHighQuality: true,
  smc: grade == null ? undefined : { grade, score: grade === 'AGAINST' ? -4 : 6, bias: 'bear', tags: [] },
});

const W = boot();

console.log('== the ordering decision is reachable from outside runScan ==');
ok(typeof W.__csSmcRank === 'function', '__csSmcRank exported — the decision is a pure function, not buried in the network loop');
ok(typeof W.__csSortSetups === 'function', '__csSortSetups exported');

console.log('== rank maps the grades, and absence is neutral ==');
ok(W.__csSmcRank(mk('A', 'STRONG')) === 2, 'STRONG ranks 2');
ok(W.__csSmcRank(mk('A', 'WITH')) === 1, 'WITH ranks 1');
ok(W.__csSmcRank(mk('A', 'NEUTRAL')) === 0, 'NEUTRAL ranks 0');
ok(W.__csSmcRank(mk('A', 'AGAINST')) === -1, 'AGAINST ranks -1');
ok(W.__csSmcRank(mk('A', null)) === 0, 'a row with no smc ranks the same as NEUTRAL — load order cannot shift ordering');
ok(W.__csSmcRank(null) === 0 && W.__csSmcRank({}) === 0, 'null / empty row is neutral, not a throw');

console.log('== SMC actually changes the order (this is the no-op detector) ==');
{
  /* The OLD comparator was `return pb - pa`. With pct tied it returns 0, and
     Array#sort is stable, so [against, strong] would come back unchanged. The
     only way STRONG leads here is if smc genuinely feeds the comparator. */
  const against = mk('AAAUSDT', 'AGAINST');
  const strong = mk('ZZZUSDT', 'STRONG');
  const order = W.__csSortSetups([against, strong]).map(s => s.sym);
  ok(order[0] === 'ZZZUSDT' && order[1] === 'AAAUSDT',
     'pct tied at 0.82 → STRONG sorts above AGAINST (got ' + order.join(' > ') + ')');

  const rev = W.__csSortSetups([strong, against]).map(s => s.sym);
  ok(rev[0] === 'ZZZUSDT', 'same result from the opposite input order — it is the comparator, not input luck');
}

console.log('== but confidence still dominates structure ==');
{
  /* A laggy structure read must never outrank a materially better vote count.
     SMC only breaks ties between cards that print the same whole percent. */
  const weakerButAligned = mk('ALIGNED', 'STRONG', 0.71);
  const strongerButAgainst = mk('CONFIDENT', 'AGAINST', 0.88);
  const order = W.__csSortSetups([weakerButAligned, strongerButAgainst]).map(s => s.sym);
  ok(order[0] === 'CONFIDENT',
     '88% AGAINST still outranks 71% STRONG — pct is the primary key (got ' + order.join(' > ') + ')');
}

console.log('== ties are broken on the percent the card prints, not the raw float ==');
{
  /* 0.8231 and 0.8248 both render as "82%", so the trader sees them as equal
     and SMC is allowed to order them. Without the rounding bucket the raw
     floats would differ and SMC would essentially never fire. */
  const a = mk('RAWHIGHER', 'AGAINST', 0.8248);
  const b = mk('RAWLOWER', 'STRONG', 0.8231);
  const order = W.__csSortSetups([a, b]).map(s => s.sym);
  ok(order[0] === 'RAWLOWER',
     'both print 82%, so STRONG leads despite the lower raw pct (got ' + order.join(' > ') + ')');
}

console.log('== degenerate input does not throw ==');
{
  const bare = { sym: 'NOFIELDS' };
  ok(W.__csSortSetups([bare, mk('X', 'STRONG')]).length === 2, 'setups with no pct and no smc sort without throwing');
  ok(W.__csSortSetups([]).length === 0, 'empty array is fine');
  ok(W.__csSortSetups(null) === null, 'non-array passes through');
}

console.log('== the source no longer claims SMC is decorative, and the helper is CALLED ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'cryptoscan.js'), 'utf8');
  ok(!/record-only annotation\. Never feeds scoring, gating, tiering or/.test(src),
     'the record-only comment is gone — code and comment agree');
  ok(/\n\s*csSortSetups\(setups\)/.test(src),
     'csSortSetups is actually invoked in the scan loop, not merely defined and exported');
  ok(!/setups\.sort\(function/.test(src),
     'the old unconditional pct-only comparator is gone');
}

console.log('\ntest-cryptoscan-smc: ' + passed + ' assertions passed');
