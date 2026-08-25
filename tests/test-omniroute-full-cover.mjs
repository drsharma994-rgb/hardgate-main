/* HARDGATE — OMNIROUTE covers what its header says it covers.

   THE CLAIM THIS GUARDS. The tab's lead says it scans "every futures
   contract" on Delta India + CoinDCX and that "pass 2 runs the full ledger on
   every name — every engine ... and every indicator". That is true of the
   current code and it was NOT true a short while ago: pass 2 used to run only
   on contracts that fired in pass 1, capped at ENRICH_MAX = 120 chosen by
   merit order. Asked whether the tab really used everything, the honest
   answer then was no.

   Both halves were removed upstream, and nothing guards the removal. A cap is
   the obvious thing to reintroduce the next time a scan feels slow — 500
   contracts x (walk-forward + Binance + depth) is genuinely expensive — and
   the header would go straight back to over-claiming, silently, because a
   narrower scan looks identical from the outside. It just finds less.

   So this file pins the three things that made the claim true:

     1. held.push is UNCONDITIONAL. Gate it on hits.length and every contract
        that fired nothing loses positioning, cross-sectional and the whole
        indicator layer — which is exactly the old behaviour.
     2. subset is held ENTIRE. No slice, no top-N, no merit cut.
     3. pass 2 evaluates WITH positioning and the cross-section, or the
        forward-only mechanics can never fire at all.

   Plus the registration checks OMNIGOLD already has, because the two desks
   share this engine and the same misses are possible on both.

   Run: node tests/test-omniroute-full-cover.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SRC = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');

/* Comments stripped before any scan: three tests in this repo have previously
   passed by matching their own explanatory prose. */
function stripComments(s){
  let out = '', i = 0;
  while (i < s.length){
    const two = s.slice(i, i + 2);
    if (two === '/*'){ const e = s.indexOf('*/', i + 2); i = (e === -1) ? s.length : e + 2; continue; }
    if (two === '//'){ const e = s.indexOf('\n', i); i = (e === -1) ? s.length : e; continue; }
    out += s[i]; i++;
  }
  return out;
}
const CODE = stripComments(SRC);

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'structure-levels.js',
                   'best-levels.js', 'regime.js', 'omniroute.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { throw new Error('FAIL: ' + f + ' did not load — ' + e.message); }
  }
  return ctx;
}
const W = boot();

const grab = name => {
  const a = CODE.indexOf('var ' + name);
  return a < 0 ? [] : (CODE.slice(a, CODE.indexOf('];', a)).match(/'[A-Z0-9][A-Z0-9-]*'/g) || []).map(s => s.slice(1, -1));
};
const MECH = grab('OMNI_MECHANICS');
const FWD  = grab('OMNI_FWD_ONLY');
const ALL  = MECH.concat(FWD);

console.log('== the mechanic inventory ==');
ok(MECH.length >= 20, 'OMNI_MECHANICS holds the backtestable set (' + MECH.length + ')');
ok(FWD.length >= 3, 'OMNI_FWD_ONLY holds the positioning / cross-sectional set (' + FWD.length + ')');
ok(new Set(ALL).size === ALL.length, 'no mechanic is listed twice across the two lists');
ok(/OMNI_ALL_MECHANICS\s*=\s*OMNI_MECHANICS\.concat\(OMNI_FWD_ONLY\)/.test(CODE),
   'the significance bar counts BOTH lists — a search is a search whether or not it can be replayed');

console.log('\n== 1. pass 1 holds every contract, fired or not ==');
{
  /* The old shape was `if (hits.length) fired.push(...)` with a separate
     unfired array. The current shape must push unconditionally. */
  const i = CODE.indexOf('held.push(');
  ok(i > 0, 'pass 1 pushes to a held list');
  /* Look at the statement immediately before the push: it must not be a
     conditional that wraps it. */
  const before = CODE.slice(Math.max(0, i - 220), i);
  ok(!/if\s*\([^)]*hits\.length[^)]*\)\s*\{?\s*$/.test(before),
     'held.push is NOT gated on hits.length — a contract that fires nothing still gets the full ledger');
  ok(/if\s*\(hits\.length\)\s*nPass1Fired\+\+;/.test(CODE),
     'firing is COUNTED rather than used to filter (nPass1Fired is a statistic, not a gate)');
}

console.log('\n== 2. pass 2 runs on the whole held set ==');
{
  ok(/var\s+subset\s*=\s*held\s*;/.test(CODE),
     'subset is the entire held list — no slice, no cap');
  ok(!/subset\s*=\s*[^;]*\.slice\(0,\s*[A-Za-z_$][A-Za-z0-9_$]*\)/.test(CODE),
     'subset is never a slice of a merit order (the old ENRICH_MAX shape)');
  ok(!/ENRICH_MAX/.test(CODE),
     'the ENRICH_MAX cap is gone and has not come back');
  /* TOP_N is the other way to narrow the scan. Zero means every contract. */
  const m = /var\s+TOP_N\s*=\s*(\d+)/.exec(CODE);
  ok(!!m, 'TOP_N is declared');
  ok(Number(m[1]) === 0, 'TOP_N is 0 — every contract in the universe, no top-N cut');
}

console.log('\n== 3. pass 2 evaluates with positioning AND the cross-section ==');
{
  /* Without these the five forward-only mechanics can never fire, and the
     tab would advertise engines that no code path can reach. */
  ok(/hgOmniEvaluate\(\s*fitem\s*,\s*held\[j\]\.rows\s*,\s*pos\s*,\s*ex\s*\)/.test(CODE),
     'pass 2 passes positioning into hgOmniEvaluate');
  ok(/ex\.xs\s*=\s*xsRanks/.test(CODE),
     'pass 2 passes the universe cross-section into hgOmniEvaluate');
  ok(/function hgOmniDetect\(rows, positioning, xs, sym\)/.test(CODE),
     'the detector accepts both, so they are not silently ignored');
}

console.log('\n== the exclusions are the stated two, and no more ==');
{
  ok(/item\.exchange === 'delta' \|\| item\.exchange === 'coindcx'/.test(CODE),
     'the universe is Delta + CoinDCX (extension legs are deliberately not scanned)');
  ok(/rows\.length < 60\)\{\s*thin\+\+;\s*return;\s*\}/.test(CODE.replace(/\s+/g, ' ').replace(/ \{/g, '{')) ||
     /thin\+\+/.test(CODE),
     'contracts with too little history are counted as thin rather than silently dropped');
}

console.log('\n== every mechanic is family-mapped, so consensus can see it ==');
{
  ok(typeof W.hgOmniFamilyOf === 'function', 'hgOmniFamilyOf is exported');
  const unmapped = ALL.filter(k => W.hgOmniFamilyOf(k) === 'OTHER');
  ok(unmapped.length === 0,
     'no mechanic falls through to OTHER' + (unmapped.length ? ' — ' + unmapped.join(', ') : ' (' + ALL.length + '/' + ALL.length + ')'));
  const fams = new Set(ALL.map(k => W.hgOmniFamilyOf(k)));
  ok(fams.size >= 4, 'the mechanics span several families (' + [...fams].sort().join(', ') + ')');
}

console.log('\n== the backtestable set has a backtest entry; the forward-only set does not ==');
{
  const a = CODE.indexOf('function hgOmniBacktestAll');
  const blk = CODE.slice(a, CODE.indexOf('return out;', a));
  const missing = MECH.filter(k => blk.indexOf("'" + k + "'") < 0 && !new RegExp('\\b' + k + '\\s*:').test(blk));
  ok(missing.length === 0,
     'every OMNI_MECHANICS key has a walk-forward entry' + (missing.length ? ' — missing: ' + missing.join(', ') : ''));
  /* And the forward-only ones must NOT, or they would be measured against a
     replay that cannot include the funding and OI they read. */
  const wrong = FWD.filter(k => blk.indexOf("'" + k + "'") >= 0);
  ok(wrong.length === 0,
     'no forward-only mechanic is in the walk-forward map' + (wrong.length ? ' — ' + wrong.join(', ') : ''));
}

console.log('\n== end to end: every indicator read reaches every candidate ==');
{
  const T0 = 1700000000 - (1700000000 % 86400);
  function tape(seed, n){
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const rows = []; let p = 100 + rnd() * 200;
    for (let i = 0; i < n; i++){
      p += (rnd() - 0.48) * 4 + Math.sin(i / 9) * 1.5;
      const o = p, c = p + (rnd() - 0.5) * 2;
      rows.push({ t: T0 + i * 14400, o, h: Math.max(o, c) + rnd() * 2,
                  l: Math.min(o, c) - rnd() * 2, c, v: 900 + rnd() * 900 });
    }
    return rows;
  }
  const gateSeen = {}, infoKeys = new Set();
  let nCand = 0;
  for (let s = 1; s <= 10; s++){
    const rows = W.hgOmniDropForming(tape(s * 7919, 300), '4h');
    const item = { sym: 'TEST' + s + 'USDT', exchange: 'delta' };
    let cands = [];
    try {
      cands = W.hgOmniEvaluate(item, rows, null,
        { livePx: rows[rows.length - 1].c, nowSec: rows[rows.length - 1].t }) || [];
    } catch (e) { continue; }
    nCand += cands.length;
    cands.forEach(c => {
      (c.gates || []).forEach(g => {
        gateSeen[g.key] = (gateSeen[g.key] || 0) + 1;
        if (g.info === true) infoKeys.add(g.key);
      });
    });
  }
  ok(nCand > 0, 'the chain produced candidates (' + nCand + ')');
  ok(infoKeys.size >= 20, 'the ledger carries a deep indicator layer (' + infoKeys.size + ' info reads)');
  const partial = [...infoKeys].filter(k => gateSeen[k] !== nCand);
  ok(partial.length === 0,
     'every info read appears on all ' + nCand + ' candidates' +
     (partial.length ? ' — partial: ' + partial.map(k => k + '(' + gateSeen[k] + ')').join(', ') : ''));
}

console.log('\n== the header claim and the code agree ==');
{
  /* If the lead says "full ledger on every name", the code must have no cap.
     Checked in both directions so neither can drift alone. */
  const claimsEvery = /full ledger on every name/.test(SRC);
  const hasCap = /ENRICH_MAX/.test(CODE) || /var\s+subset\s*=\s*[^;]*\.slice\(/.test(CODE);
  ok(!(claimsEvery && hasCap),
     'the tab does not claim "full ledger on every name" while capping the ledger');
  ok(claimsEvery, 'and the claim is present, so this check is live rather than vacuous');
}

console.log('\nomniroute full-cover: ' + passed + ' checks passed · ' +
            ALL.length + ' mechanics, uncapped pass 2');
