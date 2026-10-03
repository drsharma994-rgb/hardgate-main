/* HARDGATE — hg-v1035: OMNIBTC THE PERFECT SETUP tier.

   OmniBTC already points every engine (technical) at BTC and applies the
   fundamental + sentiment stack (on-chain / term / F&G / 25Δ RR / calendar)
   at pick time — blackout refuses, a 2+ net headwind demotes. What it never
   did was SYNTHESIS: stamp its single MOST PROBABLE crown with the shared
   PERFECT formation predicate (hg-perfect-setup.js hgPerfectFormation), so a
   max-confluence crown is surfaced as ★ PERFECT / ★ PERFECT⁺ and its cohort
   is measured by the forward ledger like every other mechanic.

   hgObtcPerfectCandidate adapts the desk's row (clean / passed / levels) into
   the predicate's graded shape HONESTLY:
     grade  — 'A' only for a 7/7 CLEAN engine ticket; a near/watch row is not
              top grade and never perfect.
     tally  — the gates-passed count (a positive-confluence proxy).
     oppose — 0 (the OMNIROUTE principal + evidence pass already dropped any
              row a decisive read opposed).
   The evidence legs the desk actually holds (real CVD/taker flow, the event
   calendar blackout, perp funding) ride the reads bag; an unread leg neither
   confirms nor denies (the honest third state).

   Covers:
     1) the candidate adapts clean -> top grade, near -> never top
     2) the predicate: clean + no against -> perfect; near -> not
     3) an explicit AGAINST evidence leg disqualifies (blackout / flow against)
     4) the headline tier: a readable WITH leg earns PERFECT⁺
     5) the stamp renders the badge, and only when stamped perfect
   Run: node tests/test-omnibtc-perfect-v1035.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }
const text = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = {
    createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} },
    addEventListener(){}
  };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'setup-ui.js', 'hg-perfect-setup.js', 'omnibtc.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function cleanRow(opts){
  return Object.assign({ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120,
    clean: true, passed: 7, gatesPassed: 7, engine: 'SWING' }, opts || {});
}

console.log('== 1) the candidate adapts the desk row honestly ==');
{
  const W = boot();
  const c = W.hgObtcPerfectCandidate(cleanRow());
  assert(c.grade === 'A' && c.tally === 7 && c.oppose === 0 && c.dir === 'long',
    'a 7/7 CLEAN row adapts to top grade, positive tally, no opposition');
  const near = W.hgObtcPerfectCandidate({ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120, clean: false, near: true, passed: 6 });
  assert(near.grade === null, 'a NEAR (6/7) row is NOT top grade — never perfect');
}

console.log('\n== 2) the predicate: clean + no against -> perfect; near -> not ==');
{
  const W = boot();
  const pf = W.hgObtcPerfectFormation({ row: cleanRow(), tier: 'clean' }, {});
  assert(pf.perfect === true, 'a clean crown with real levels and R:R is PERFECT (bar cleared)');
  assert(pf.plus === false, 'with zero readable evidence the headline PLUS is not minted');
  const pfn = W.hgObtcPerfectFormation({ row: { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120, clean: false, near: true, passed: 6 }, tier: 'near' }, {});
  assert(pfn.perfect === false, 'a near/watch crown is never PERFECT');
}

console.log('\n== 3) an explicit AGAINST evidence leg disqualifies ==');
{
  const W = boot();
  const blackout = W.hgObtcPerfectFormation({ row: cleanRow(), tier: 'clean' }, { newsRisk: 'blackout' });
  assert(blackout.perfect === false && /news blackout/i.test((blackout.why || []).join(' ')),
    'a scheduled red-folder blackout disqualifies PERFECT (the calendar is evidence)');
  const flowA = W.hgObtcPerfectFormation({ row: cleanRow(), tier: 'clean' }, { takerFlowVerdict: 'against' });
  assert(flowA.perfect === false && /taker flow against/i.test((flowA.why || []).join(' ')),
    'real taker flow AGAINST the crown disqualifies PERFECT');
  const fundA = W.hgObtcPerfectFormation({ row: cleanRow(), tier: 'clean' }, { fundingAgainst: true });
  assert(fundA.perfect === false && /funding crowded/i.test((fundA.why || []).join(' ')),
    'crowded perp funding disqualifies PERFECT');
}

console.log('\n== 4) the headline tier: a readable WITH leg earns PERFECT\u207A ==');
{
  const W = boot();
  const plus = W.hgObtcPerfectFormation({ row: cleanRow(), tier: 'clean' }, { takerFlowVerdict: 'with', newsRisk: 'low', fundingAgainst: false });
  assert(plus.perfect === true && plus.plus === true,
    'clean + flow WITH + no blackout + no crowded funding earns ★ PERFECT\u207A');
}

console.log('\n== 5) the stamp renders only the stamped verdict ==');
{
  const W = boot();
  const row = cleanRow();
  W.hgObtcPerfectFormation({ row: row, tier: 'clean' }, { takerFlowVerdict: 'with' });
  const stamp = W.hgObtcPerfectStamp(row);
  assert(/PERFECT/.test(text(stamp)), 'a perfect crown renders the ★ PERFECT badge');
  assert(/PLUS|PERFECT\u207A/.test(text(stamp)), 'the readable WITH leg earns the ★ PERFECT\u207A headline');
  const dark = W.hgObtcPerfectStamp(cleanRow());
  assert(dark === '', 'an un-stamped row renders no badge (never minted at render)');
}

console.log('\ntest-omnibtc-perfect-v1035: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
