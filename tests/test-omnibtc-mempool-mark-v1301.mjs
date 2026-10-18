#!/usr/bin/env node
/* hg-v1403 note: the ind: / combined key-count pins (§1) and the §10
   doctrine-word pins were re-pinned 13 -> 17 ind / 25 -> 29 combined because
   hg-v1396's disclosed house marks (hgObtcHouseMarkReads: ind:tsiWith /
   ind:vwapWith / ind:choppy / ind:atrExpand) shipped AFTER this suite was
   written and are pinned GREEN by test-omnibtc-pine-record-bank-v1293. The
   stale counts contradict surviving shipped reality (verifier-approved
   hg-v1403 amendment). Mutation proof re-run: remove any one emitted ind:
   key -> RED; revert -> GREEN. No other assertion relaxed. */
/* hg-v1301 — OMNIBTC mempool fee regime mark guard.

   Adds one new free: mark (free:mempoolFeeHigh) through the hg-v1297 one home
   (hgObtcFreeFeedVerdicts) by reading onchain.js's cached fees leg. The ratio
   bar (FEE_SPIKE_MULT = 3) lives in onchain.js and nowhere else -- this mark
   quotes it. STATE read (hg-v993: a mempool regime is not a side), strict
   hg-v989 three-state (true HIGH / false NO PRIORITY PREMIUM / absent inside
   band or on any non-finite / null leg). The +null === 0 trap (pinned ten
   times already in this codebase) does not open an eleventh: economyFee must
   be a finite number > 0, not merely truthy, so dividing by null falls
   through to NOT MEASURED instead of INF/HIGH.

   No gate reads the key (asserted on the hg-v1299 7-file / 2-shape pattern,
   now 5 keys x 7 files x 2 = 70 cells). The new "ON-CHAIN" category in
   HG_OBTC_MARKS_GROUPS is asserted present with exactly this one key. The
   ffCtx caller is asserted to read W.onchainState() through a typeof guard
   so a scan on an unloaded onchain.js records NOT MEASURED (never a guessed
   HIGH, never a thrown exception). onchain.js is asserted to still set
   FEE_SPIKE_MULT = 3; if that constant moves, this mark's bar must move with
   it, so this guard pins the number by cross-reference. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
const ok = (c, label) => { if (c){ passed++; console.log('ok —', label); } else { failed++; console.log('FAIL —', label); } };

function bootHelpers(){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
  };
  ctx.window = ctx; ctx.W = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { data: {}, getItem(k){ return this.data[k] == null ? null : this.data[k]; },
    setItem(k, v){ this.data[k] = String(v); }, removeItem(k){ delete this.data[k]; } };
  vm.createContext(ctx);
  vm.runInContext(read('indicators.js'), ctx);
  vm.runInContext(read('indicators2.js'), ctx);
  vm.runInContext(read('fixpack14-core.js'), ctx);
  const src = read('omnibtc.js');
  const ffStart = src.indexOf('function hgObtcFreeFeedVerdicts');
  const indEnd  = src.indexOf('function hgObtcIsBtc');
  if (ffStart < 0 || indEnd < 0 || indEnd < ffStart){
    throw new Error('helpers block boundaries not found — did omnibtc.js change?');
  }
  vm.runInContext(src.slice(ffStart, indEnd), ctx);
  return ctx;
}

/* ---------- §1: key count is 29 (11 free + 13 ind + 1 new + 4 hg-v1396 house = 29; re-pinned hg-v1403) ---------- */
console.log('\n[§1] key count 24 → 25 → 29 (ONE HOME grows; hg-v1403 recount for hg-v1396)');
{
  const src = read('omnibtc.js');
  const freeRe = /out\s*\[\s*'free:(\w+)'\s*\]/g;
  const indRe  = /out\s*\[\s*'ind:(\w+)'\s*\]/g;
  const freeSet = new Set(), indSet = new Set();
  let m;
  while ((m = freeRe.exec(src))) freeSet.add(m[1]);
  while ((m = indRe.exec(src))) indSet.add(m[1]);
  ok(freeSet.size === 12, `free: keys count === 12 (was 11, hg-v1301 adds mempoolFeeHigh) [got ${freeSet.size}]`);
  ok(indSet.size === 17, `ind: keys count === 17 (13 + 4 hg-v1396 house reads — re-pinned hg-v1403) [got ${indSet.size}]`);
  ok(freeSet.size + indSet.size === 29, `combined free: + ind: keys === 29 (re-pinned hg-v1403)`);
  ok(freeSet.has('mempoolFeeHigh'), 'free:mempoolFeeHigh is in the key set');
}

/* ---------- §2: HIGH / LOW / inside / boundaries at FEE_SPIKE_MULT=3 and 1.1x ---------- */
console.log('\n[§2] free:mempoolFeeHigh — ratio-based state read, hg-v989 three-state');
{
  const ctx = bootHelpers();
  const fv = ctx.hgObtcFreeFeedVerdicts;
  ok(typeof fv === 'function', 'hgObtcFreeFeedVerdicts lifted into vm');

  // HIGH-DEMAND regime: fastestFee >= 3x economyFee
  const high = fv({ onchain: { fees: { fastestFee: 30, economyFee: 10 } } }, 'long', 'BTCUSDT');
  ok(high['free:mempoolFeeHigh'] === true, 'ratio 3.0 reads HIGH (true, boundary inclusive)');
  const high2 = fv({ onchain: { fees: { fastestFee: 60, economyFee: 10 } } }, 'long', 'BTCUSDT');
  ok(high2['free:mempoolFeeHigh'] === true, 'ratio 6.0 reads HIGH (true)');

  // State read: SAME on long and short (regime, not a side — hg-v993)
  const highShort = fv({ onchain: { fees: { fastestFee: 30, economyFee: 10 } } }, 'short', 'BTCUSDT');
  ok(highShort['free:mempoolFeeHigh'] === true, 'HIGH reads TRUE on short too (state, not direction)');

  // NO PRIORITY PREMIUM: fastestFee <= 1.1x economyFee
  const low = fv({ onchain: { fees: { fastestFee: 11, economyFee: 10 } } }, 'long', 'BTCUSDT');
  ok(low['free:mempoolFeeHigh'] === false, 'ratio 1.1 reads LOW (false, boundary inclusive)');
  const lowEq = fv({ onchain: { fees: { fastestFee: 5, economyFee: 10 } } }, 'long', 'BTCUSDT');
  ok(lowEq['free:mempoolFeeHigh'] === false, 'ratio 0.5 reads LOW (fastest below economy — degenerate but readable)');
  const lowShort = fv({ onchain: { fees: { fastestFee: 11, economyFee: 10 } } }, 'short', 'BTCUSDT');
  ok(lowShort['free:mempoolFeeHigh'] === false, 'LOW reads FALSE on short too (state, not direction)');

  // Inside band: 1.1 < ratio < 3.0 reads absent
  const mid = fv({ onchain: { fees: { fastestFee: 20, economyFee: 10 } } }, 'long', 'BTCUSDT');
  ok(mid['free:mempoolFeeHigh'] === undefined, 'ratio 2.0 reads absent (inside band, hg-v989 NOT MEASURED)');
  const midLow = fv({ onchain: { fees: { fastestFee: 15, economyFee: 10 } } }, 'long', 'BTCUSDT');
  ok(midLow['free:mempoolFeeHigh'] === undefined, 'ratio 1.5 reads absent');
  const midHigh = fv({ onchain: { fees: { fastestFee: 29, economyFee: 10 } } }, 'long', 'BTCUSDT');
  ok(midHigh['free:mempoolFeeHigh'] === undefined, 'ratio 2.9 reads absent (just below HIGH threshold)');
}

/* ---------- §3: non-coercion — the +null === 0 trap pinned ---------- */
console.log('\n[§3] non-coercion: +null, strings, NaN, missing all read absent');
{
  const ctx = bootHelpers();
  const fv = ctx.hgObtcFreeFeedVerdicts;

  // No onchain at all
  const none = fv({}, 'long', 'BTCUSDT');
  ok(none['free:mempoolFeeHigh'] === undefined, 'no onchain field reads absent');

  // onchain null
  const nullOc = fv({ onchain: null }, 'long', 'BTCUSDT');
  ok(nullOc['free:mempoolFeeHigh'] === undefined, 'onchain:null reads absent');

  // onchain is a number (junk)
  const junkOc = fv({ onchain: 42 }, 'long', 'BTCUSDT');
  ok(junkOc['free:mempoolFeeHigh'] === undefined, 'onchain:42 (not an object) reads absent');

  // onchain object with no fees
  const noFees = fv({ onchain: {} }, 'long', 'BTCUSDT');
  ok(noFees['free:mempoolFeeHigh'] === undefined, 'onchain:{} with no fees leg reads absent');

  // fees is null (leg failed)
  const nullFees = fv({ onchain: { fees: null } }, 'long', 'BTCUSDT');
  ok(nullFees['free:mempoolFeeHigh'] === undefined, 'fees:null (leg failed) reads absent — never a guessed low');

  // Missing fastestFee
  const noFastest = fv({ onchain: { fees: { economyFee: 10 } } }, 'long', 'BTCUSDT');
  ok(noFastest['free:mempoolFeeHigh'] === undefined, 'missing fastestFee reads absent');

  // Missing economyFee
  const noEconomy = fv({ onchain: { fees: { fastestFee: 30 } } }, 'long', 'BTCUSDT');
  ok(noEconomy['free:mempoolFeeHigh'] === undefined, 'missing economyFee reads absent');

  // +null === 0 trap: economyFee = null — would divide by zero if coerced
  const nullEcon = fv({ onchain: { fees: { fastestFee: 30, economyFee: null } } }, 'long', 'BTCUSDT');
  ok(nullEcon['free:mempoolFeeHigh'] === undefined, 'economyFee:null reads absent (+null === 0 trap, hg-v955)');

  // economyFee = 0 exactly (would be division by zero)
  const zeroEcon = fv({ onchain: { fees: { fastestFee: 30, economyFee: 0 } } }, 'long', 'BTCUSDT');
  ok(zeroEcon['free:mempoolFeeHigh'] === undefined, 'economyFee:0 reads absent (division-by-zero guard)');

  // economyFee = negative (should be impossible but refuse to coerce)
  const negEcon = fv({ onchain: { fees: { fastestFee: 30, economyFee: -5 } } }, 'long', 'BTCUSDT');
  ok(negEcon['free:mempoolFeeHigh'] === undefined, 'economyFee:-5 reads absent (strict > 0 guard)');

  // String fastestFee (parseable but should not coerce)
  const strFast = fv({ onchain: { fees: { fastestFee: '30', economyFee: 10 } } }, 'long', 'BTCUSDT');
  ok(strFast['free:mempoolFeeHigh'] === undefined, "fastestFee:'30' (string) reads absent — no coercion");

  // String economyFee
  const strEcon = fv({ onchain: { fees: { fastestFee: 30, economyFee: '10' } } }, 'long', 'BTCUSDT');
  ok(strEcon['free:mempoolFeeHigh'] === undefined, "economyFee:'10' (string) reads absent — no coercion");

  // NaN fastestFee
  const nanFast = fv({ onchain: { fees: { fastestFee: NaN, economyFee: 10 } } }, 'long', 'BTCUSDT');
  ok(nanFast['free:mempoolFeeHigh'] === undefined, 'fastestFee:NaN reads absent');

  // Infinity fastestFee
  const infFast = fv({ onchain: { fees: { fastestFee: Infinity, economyFee: 10 } } }, 'long', 'BTCUSDT');
  ok(infFast['free:mempoolFeeHigh'] === undefined, 'fastestFee:Infinity reads absent (isFinite)');
}

/* ---------- §4: wrong direction / bad input shape ---------- */
console.log('\n[§4] bad dir / bad ctx — hg-v1297 contract preserved');
{
  const ctx = bootHelpers();
  const fv = ctx.hgObtcFreeFeedVerdicts;

  const payload = { onchain: { fees: { fastestFee: 30, economyFee: 10 } } };
  const bad = fv(payload, 'BUY', 'BTCUSDT');
  ok(Object.keys(bad).length === 0, "dir='BUY' returns empty bag (contract: only 'long' or 'short')");

  const noDir = fv(payload, null, 'BTCUSDT');
  ok(Object.keys(noDir).length === 0, 'dir=null returns empty bag');

  const noCtx = fv(null, 'long', 'BTCUSDT');
  ok(Object.keys(noCtx).length === 0, 'ctx=null returns empty bag');

  const strCtx = fv('ctx', 'long', 'BTCUSDT');
  ok(Object.keys(strCtx).length === 0, "ctx='ctx' (string) returns empty bag");
}

/* ---------- §5: isolation — mempoolFeeHigh does not leak into other marks ---------- */
console.log('\n[§5] isolation — adding onchain never writes other keys');
{
  const ctx = bootHelpers();
  const fv = ctx.hgObtcFreeFeedVerdicts;
  // only onchain, nothing else — should write at most one key
  const onlyOc = fv({ onchain: { fees: { fastestFee: 30, economyFee: 10 } } }, 'long', 'BTCUSDT');
  const keys = Object.keys(onlyOc);
  ok(keys.length === 1 && keys[0] === 'free:mempoolFeeHigh',
    `onchain-only context writes exactly one key (free:mempoolFeeHigh); got ${JSON.stringify(keys)}`);

  // The existing 11 marks still work beside the new one
  const together = fv({
    onchain: { fees: { fastestFee: 30, economyFee: 10 } },
    macro: { tnxTrend: 'RISING', goldBtcCorr20: 0.5, curveSlopeTrend: 'STEEPENING' }
  }, 'long', 'BTCUSDT');
  ok(together['free:mempoolFeeHigh'] === true, 'HIGH ride alongside existing marks');
  ok(together['free:tnxTrend'] === false, 'tnxTrend still reads (RISING = against long)');
  ok(together['free:btcGoldCorr'] === true, 'btcGoldCorr still reads (0.5 above +0.30)');
  ok(together['free:curveSlopeTrend'] === true, 'curveSlopeTrend still reads STEEPENING');
}

/* ---------- §6: HG_OBTC_MARKS_GROUPS carries the new ON-CHAIN group ---------- */
console.log('\n[§6] HG_OBTC_MARKS_GROUPS (hg-v1300 panel) surfaces free:mempoolFeeHigh');
{
  const src = read('omnibtc.js');
  const grpIdx = src.indexOf('HG_OBTC_MARKS_GROUPS = [');
  const grpEnd = src.indexOf('];', grpIdx);
  ok(grpIdx > 0 && grpEnd > grpIdx, 'HG_OBTC_MARKS_GROUPS literal found');
  const body = src.slice(grpIdx, grpEnd);
  ok(/ON-CHAIN/.test(body), 'ON-CHAIN group title present');
  ok(/'free:mempoolFeeHigh'/.test(body), "free:mempoolFeeHigh key is in the groups literal");
  ok(/Mempool fee regime \(hg-v1301, onchain\.js\)/.test(body), 'label names hg-v1301 and the one home');

  // 29 free: + ind: keys = 29 (12 free + 17 ind, hg-v1403 recount). Pine lives in its own group.
  const freeInGroups = (body.match(/'free:(\w+)'/g) || []).length;
  const indInGroups = (body.match(/'ind:(\w+)'/g) || []).length;
  ok(freeInGroups === 12, `12 free: entries in HG_OBTC_MARKS_GROUPS (was 11) [got ${freeInGroups}]`);
  ok(indInGroups === 13, `13 ind: entries in HG_OBTC_MARKS_GROUPS [got ${indInGroups}]`);
}

/* ---------- §7: NO GATE reads free:mempoolFeeHigh ---------- */
console.log('\n[§7] no gate module reads the new key (7 files × 1 key × 2 shapes = 14 cells)');
{
  const gateFiles = ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
    'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'];
  let emptyCells = 0;
  for (const gf of gateFiles){
    let src;
    try { src = read(gf); } catch(e){ ok(false, `gate file ${gf} missing`); continue; }
    // Dot access: reads.mempoolFeeHigh (unlikely because of ':' in name, but assert anyway on bare suffix)
    const dotRe = /reads\.mempoolFeeHigh\b/;
    ok(!dotRe.test(src), `${gf}: no dot-access read of mempoolFeeHigh`);
    emptyCells++;
    // Quoted-string access: 'free:mempoolFeeHigh' or "free:mempoolFeeHigh"
    const quotRe = /['"]free:mempoolFeeHigh['"]/;
    ok(!quotRe.test(src), `${gf}: no quoted read of 'free:mempoolFeeHigh'`);
    emptyCells++;
  }
  ok(emptyCells === 14, `14 empty cells across gate files × shapes [got ${emptyCells}]`);
}

/* ---------- §8: ONE HOME — the ratio bar lives in onchain.js and nowhere else ---------- */
console.log('\n[§8] FEE_SPIKE_MULT = 3 is the one home for the ratio bar (hg-v949)');
{
  const oc = read('onchain.js');
  ok(/FEE_SPIKE_MULT\s*=\s*3\b/.test(oc), 'onchain.js still sets FEE_SPIKE_MULT = 3 (hg-v949 one home)');
  // onchain.js reads it this way
  ok(/fees\.fastestFee\s*>=\s*FEE_SPIKE_MULT\s*\*\s*fees\.economyFee/.test(oc),
    'onchain.js reads fastestFee >= FEE_SPIKE_MULT * economyFee — this guard pins the mark against drift');
  // omnibtc.js uses the same number literally (3) in the comment and in the >=3 check
  const obtc = read('omnibtc.js');
  const markBlockRe = /free:mempoolFeeHigh[\s\S]{0,2500}?feeRatio\s*>=\s*3[\s\S]{0,120}?feeRatio\s*<=\s*1\.1/;
  ok(markBlockRe.test(obtc), 'omnibtc.js mark block uses >= 3 (HIGH) and <= 1.1 (LOW) — matches onchain.js');
}

/* ---------- §9: caller wires W.onchainState() with a typeof guard ---------- */
console.log('\n[§9] ffCtx caller reads W.onchainState() safely (hg-v1297 pattern)');
{
  const src = read('omnibtc.js');
  // The caller must guard with typeof so an unloaded onchain.js records NOT MEASURED
  const callerRe = /typeof\s+W\.onchainState\s*!==\s*['"]function['"][\s\S]{0,200}?W\.onchainState\(\)/;
  ok(callerRe.test(src), 'caller guards typeof W.onchainState and then calls it');
  ok(/onchain:\s*\(function\(\)\{/.test(src), 'caller assigns ffCtx.onchain via an IIFE wrapper');
  // The IIFE catch block — no throw escapes
  const iifeRe = /onchain:\s*\(function\(\)\{[\s\S]{0,400}?catch\s*\(\s*\w+\s*\)\s*\{\s*return\s+null;\s*\}/;
  ok(iifeRe.test(src), 'caller IIFE catches and returns null, never throws into the scan');
}

/* ---------- §10: doctrine comment stamps 12 free + 13 ind + 25 total ---------- */
console.log('\n[§10] doctrine comment self-check (hg-v1297/v1299/v1301)');
{
  const src = read('omnibtc.js');
  ok(/Twelve three-state free: marks/.test(src), 'doctrine says "Twelve three-state free: marks"');
  ok(/seventeen\s+three-state ind: marks/.test(src), 'doctrine says "seventeen three-state ind: marks" (re-pinned hg-v1403)');
  ok(/twenty-nine keys/.test(src), 'doctrine says "twenty-nine keys" (re-pinned hg-v1403)');
  ok(/hg-v1301 mempool fee regime/.test(src), 'doctrine names hg-v1301 mempool fee regime');
  ok(/FEE_SPIKE_MULT=3/.test(src) || /FEE_SPIKE_MULT = 3/.test(src),
    'doctrine quotes FEE_SPIKE_MULT = 3 (hg-v949 one home citation)');
  ok(/mempoolFeeHigh,\s*every ind: state read/.test(src),
    'doctrine lists mempoolFeeHigh beside the state reads (not direction-aware)');
}

/* ---------- §11: ship stamps align (hg-v956, shared helper) ---------- */
console.log('\n[§11] ship stamps align');
{
  const { HG_VER, swCacheOk } = await import('./helpers/build-version.mjs');
  ok(/^hg-v\d+$/.test(HG_VER), `HG_VER matches shape: ${HG_VER}`);
  ok(swCacheOk(read('sw.js')), `sw.js HG_CACHE matches ${HG_VER}`);
  const trendtable = read('trendtable.js');
  const verNum = HG_VER.replace(/^hg-v/, '');
  const ttRe = new RegExp("\\?v=" + verNum + "\\b");
  ok(ttRe.test(trendtable), `trendtable.js ?v=${verNum} matches HG_VER`);
  const buildStamp = read('build-stamp.js');
  const bsRe = new RegExp("version:\\s*'" + HG_VER + "'");
  ok(bsRe.test(buildStamp), `build-stamp.js version: '${HG_VER}'`);
}

console.log(`\n== hg-v1301 OMNIBTC mempool mark: ${passed} passed, ${failed} failed ==`);
process.exit(failed === 0 ? 0 : 1);
