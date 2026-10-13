/* HARDGATE — hg-v1316 CANDLE FORECAST tab guard.

   The user asked a THIRD time for maximum pattern recognition and every
   gold tab's analysis to form a confluence and a scalp+swing setup.

   hg-v1316 extends hg-v1315 with three concrete additions:
     (A) hgCfMaxPatterns adds 15 further candlestick patterns BEYOND the
         hg-v1314 16 and hg-v1315 15 (46 total): takuri line, rickshaw
         man, doji star bull/bear, island reversal, advance block, three
         stars in the south, matching high/low, upside/downside tasuki
         gap, last engulfing top/bottom, closing marubozu, in-neck /
         on-neck / thrusting line, hikkake, side-by-side white lines,
         ladder bottom/top, concealing baby swallow;
     (B) hgCfGoldDeskReads adds SEVEN more directional readers on top of
         the hg-v1315 three (hgGoldMacroLock, hgGoldMtfMatrix,
         hgGoldHtfBias, hgGoldSweepEngine, hgGoldSessionBoundSweep,
         hgGoldNyExhaustion, hgGoldOiTrap) — ten directional readers in
         total through the one home;
     (C) mode-aware R:R preserved: scalp 1R/2R on 15m, swing 1.5R/3R on 4h.

   Sections:
     §1  engine + helpers are globals (new: hgCfMaxPatterns + the hg-v1315 set)
     §2  thin tape returns null; flat tape returns NEUTRAL (never a lean)
     §3  rising tape → BULL with entry/SL/TP geometry (SCALP 1R/2R)
     §4  falling tape → BEAR mirror
     §5  hgCfPatterns names 16 patterns and refuses dust bars as hammers
     §6  hgCfStructure names 8 structural reads
     §7  hgCfConfluence tallies WITH/AGAINST on injected marks
     §8  SETUP tier when confluence ≥60% WITH on ≥4 marks
     §9  CONFLICT tier when confluence ≤40% WITH on ≥4 marks (levels withheld)
     §10 module file registers through HG_tabs with new label chip
     §11 index.html carries the tab in HG_NAV_GROUPS and loads before bootHgTabs
     §12 build stamps are current (hg-v1316) and no gate reads the engine
     §13 hg-v1315 — hgCfAdvancedPatterns detects the 15 patterns
     §14 hg-v1315 — hgCfGoldDeskReads merges directional readers into the tally
     §15 hg-v1315 — mode-aware R:R: scalp 1R/2R, swing 1.5R/3R
     §16 hg-v1315 — a news-lock downgrades SETUP to LEAN but is not a direction veto
     §17 hg-v1316 — hgCfMaxPatterns detects the 15 further patterns
     §18 hg-v1316 — hgCfGoldDeskReads carries the seven new directional readers
     §19 hg-v1316 — the engine merges three pattern sets (46 patterns total)
     §20 behavioural mutation pass over the hg-v1314 + hg-v1315 + hg-v1316 block

   DISPLAY tool: no setup leaves any board on this, no forward-ledger mark,
   no threshold moves (asserted). */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

const ENGINE_MARKER = '/* ========================================================================\n   hg-v1316: CANDLE FORECAST';

function bootEngine(opts){
  const o = opts || {};
  const ctx = { console };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  if (!o.skipIndicators) vm.runInContext(read('indicators.js'), ctx, { filename: 'indicators.js' });
  const gold = read('goldind.js');
  const idx = gold.indexOf(ENGINE_MARKER);
  if (idx < 0) throw new Error('hg-v1316 engine block not found in goldind.js');
  vm.runInContext(gold.slice(idx), ctx, { filename: 'goldind.js#hg-v1316' });
  /* seed stubs for the confluence readers, letting §7-9 inject marks. */
  ctx.__cfStubReset = function(){
    ctx.hgGoldFreeFeedVerdicts = undefined;
    ctx.hgGoldIndicatorReads = undefined;
    ctx.hgGoldIndicatorMarks = undefined;
    ctx.pineGoldLayerStates = undefined;
    ctx.pineGoldPineMarks = undefined;
    ctx.hgGoldFormingRegime = undefined;
    ctx.hgGoldSevenStep = undefined;
    ctx.hgGoldSweepOb = undefined;
    ctx.pineGoldConfluence = undefined;
    ctx.hgGoldNewsGate = undefined;
    ctx.hgGoldInstFilter = undefined;
    ctx.hgGoldFormingStack = undefined;
    ctx.hgGoldCatalogFeed = undefined;
    /* hg-v1316 readers */
    ctx.hgGoldMacroLock = undefined;
    ctx.hgGoldMtfMatrix = undefined;
    ctx.hgGoldHtfBias = undefined;
    ctx.hgGoldSweepEngine = undefined;
    ctx.hgGoldSessionBoundSweep = undefined;
    ctx.hgGoldNyExhaustion = undefined;
    ctx.hgGoldOiTrap = undefined;
  };
  return ctx;
}

function makeRising(opts){
  const o = opts || {};
  const n = o.n || 40, start = o.start || 2300, drift = (o.drift === undefined ? 1.0 : o.drift);
  const amp = o.amp || 2.0;
  const rows = []; let p = start;
  for (let i = 0; i < n; i++){
    const o_ = p, c_ = p + drift, h_ = Math.max(o_, c_) + amp, l_ = Math.min(o_, c_) - amp;
    rows.push({ t: 1_700_000_000 + i * 900, o: o_, h: h_, l: l_, c: c_, v: 1000 });
    p = c_;
  }
  return rows;
}

/* a hammer-after-decline fixture: 20+ falling bars, then a bar with a long
   lower wick and small body that closes slightly above the open. */
function makeHammerFixture(){
  const rows = []; let p = 2400;
  for (let i = 0; i < 25; i++){
    const o_ = p, c_ = p - 1.5, h_ = Math.max(o_, c_) + 1.0, l_ = Math.min(o_, c_) - 1.0;
    rows.push({ t: 1_700_000_000 + i * 900, o: o_, h: h_, l: l_, c: c_, v: 1000 });
    p = c_;
  }
  /* add 14 continuation bars so the engine has 40+ bars for structure */
  for (let i = 25; i < 39; i++){
    const o_ = p, c_ = p - 0.5, h_ = Math.max(o_, c_) + 1.0, l_ = Math.min(o_, c_) - 1.0;
    rows.push({ t: 1_700_000_000 + i * 900, o: o_, h: h_, l: l_, c: c_, v: 1000 });
    p = c_;
  }
  /* final bar: hammer — small bull body, long lower wick (≥ 2× body), tiny upper wick */
  const o_ = p, c_ = p + 0.5, h_ = Math.max(o_, c_) + 0.1, l_ = Math.min(o_, c_) - 3.0;
  rows.push({ t: 1_700_000_000 + 39 * 900, o: o_, h: h_, l: l_, c: c_, v: 1000 });
  return rows;
}

/* three-white-soldiers composite fixture: 37 rising bars then three
   strong bull-body bars with ascending opens/closes. Both patterns AND
   structure fire bull, so the primary branch of the direction decision
   is reached and a mutation that swaps BULL/BEAR there is caught. */
function makeThreeSoldiersFixture(){
  const rows = []; let p = 2300;
  for (let i = 0; i < 37; i++){
    const o_ = p, c_ = p + 0.5, h_ = Math.max(o_, c_) + 0.5, l_ = Math.min(o_, c_) - 0.5;
    rows.push({ t: 1_700_000_000 + i * 900, o: o_, h: h_, l: l_, c: c_, v: 1000 });
    p = c_;
  }
  /* three white soldiers: each opens above the prior open, closes above
     the prior close, and has a strong bull body ≥ atrGate (ATR ~1 here) */
  for (let i = 0; i < 3; i++){
    const o_ = p + 0.3, c_ = p + 2.5;
    const h_ = c_ + 0.1, l_ = o_ - 0.1;
    rows.push({ t: 1_700_000_000 + (37 + i) * 900, o: o_, h: h_, l: l_, c: c_, v: 1500 });
    p = c_;
  }
  return rows;
}

console.log('== §1 engine + helpers registered as globals ==');
{
  const ctx = bootEngine();
  ok(typeof ctx.goldCandleForecast === 'function', 'window.goldCandleForecast exists');
  ok(typeof ctx.hgCfPatterns === 'function', 'window.hgCfPatterns exists');
  ok(typeof ctx.hgCfAdvancedPatterns === 'function', 'window.hgCfAdvancedPatterns exists (hg-v1315)');
  ok(typeof ctx.hgCfStructure === 'function', 'window.hgCfStructure exists');
  ok(typeof ctx.hgCfConfluence === 'function', 'window.hgCfConfluence exists');
  ok(typeof ctx.hgCfGoldDeskReads === 'function', 'window.hgCfGoldDeskReads exists (hg-v1315)');
  ok(typeof ctx.hgCfMaxPatterns === 'function', 'window.hgCfMaxPatterns exists (hg-v1316)');
}

console.log('== §2 thin tape returns null; flat tape → NEUTRAL ==');
{
  const ctx = bootEngine();
  ok(ctx.goldCandleForecast(makeRising({ n: 19 })) === null, 'returns null on <20 rows');
  ok(ctx.goldCandleForecast([]) === null, 'returns null on []');
  ok(ctx.goldCandleForecast(null) === null, 'returns null on null');
  ok(ctx.goldCandleForecast('nope') === null, 'returns null on a non-array');
  const flat = [];
  for (let i = 0; i < 40; i++) flat.push({ t: 1_700_000_000 + i, o: 2300, h: 2300.1, l: 2299.9, c: 2300, v: 100 });
  const flatR = ctx.goldCandleForecast(flat);
  ok(flatR && flatR.tier === 'NEUTRAL', 'flat tape reads NEUTRAL');
  ok(flatR.entry === null && flatR.sl === null, 'NEUTRAL carries no levels');
}

console.log('== §3 rising tape → BULL with 1R/2R geometry ==');
let bull;
{
  const ctx = bootEngine();
  bull = ctx.goldCandleForecast(makeRising({ drift: +1.5 }));
  ok(bull && bull.dir === 'BULL', 'dir is BULL on a rising tape');
  ok(bull.tier === 'LEAN' || bull.tier === 'SETUP', 'tier is LEAN (no ctx) or SETUP: ' + bull.tier);
  ok(isFinite(bull.entry) && isFinite(bull.sl) && isFinite(bull.tp1) && isFinite(bull.tp2), 'entry/SL/TP1/TP2 all finite');
  ok(bull.entry === bull.close, 'entry equals last close');
  ok(bull.sl < bull.entry, 'long SL below entry');
  ok(bull.tp1 > bull.entry, 'long TP1 above entry');
  ok(bull.tp2 > bull.tp1, 'long TP2 beyond TP1');
  /* 1R geometry: distance(entry → tp1) == distance(entry → sl) */
  const r1Dist = Math.abs(bull.tp1 - bull.entry);
  const slDist = Math.abs(bull.sl - bull.entry);
  ok(Math.abs(r1Dist - slDist) < 0.01, 'TP1 is 1R from entry (1:1)');
  const r2Dist = Math.abs(bull.tp2 - bull.entry);
  ok(Math.abs(r2Dist - 2 * slDist) < 0.01, 'TP2 is 2R from entry (1:2)');
  ok(bull.confidence > 0 && bull.confidence <= 1, 'confidence in (0, 1]');
}

console.log('== §4 falling tape → BEAR mirror ==');
{
  const ctx = bootEngine();
  const bear = ctx.goldCandleForecast(makeRising({ drift: -1.5 }));
  ok(bear && bear.dir === 'BEAR', 'dir is BEAR on a falling tape');
  ok(bear.sl > bear.entry, 'short SL above entry');
  ok(bear.tp1 < bear.entry, 'short TP1 below entry');
  ok(bear.tp2 < bear.tp1, 'short TP2 beyond TP1');
  const r1D = Math.abs(bear.entry - bear.tp1);
  const slD = Math.abs(bear.sl - bear.entry);
  ok(Math.abs(r1D - slD) < 0.01, 'short TP1 is 1R from entry');
}

console.log('== §5 hgCfPatterns names patterns and refuses dust bars ==');
{
  const ctx = bootEngine();
  const rows = makeHammerFixture();
  const atr = ctx.atr(rows, 14);
  const atrLast = atr[atr.length - 1];
  const pat = ctx.hgCfPatterns(rows, atrLast);
  ok(pat.ok === true, 'patterns ran ok');
  ok(Array.isArray(pat.bull) && Array.isArray(pat.bear) && Array.isArray(pat.neutral), 'bull/bear/neutral arrays returned');
  ok(pat.bull.some(p => /hammer/i.test(p)), 'hammer-after-decline detected on the hammer fixture: got [' + pat.bull.join(', ') + ']');
  /* dust bar: tiny body + tiny wick — no pattern should fire */
  const dust = []; for (let i = 0; i < 3; i++) dust.push({ t: i, o: 2300, h: 2300.05, l: 2299.95, c: 2300.01, v: 10 });
  const dustPat = ctx.hgCfPatterns(dust, atrLast);
  ok(dustPat.ok === true, 'dust fixture runs');
  ok(dustPat.bull.length === 0 && dustPat.bear.length === 0, 'dust bars fire no bull/bear pattern');
  /* zero ATR → no patterns, out.ok false */
  const no = ctx.hgCfPatterns(rows, 0);
  ok(no.ok === false, 'zero ATR → ok:false');
}

console.log('== §6 hgCfStructure names structural reads ==');
{
  const ctx = bootEngine();
  const rows = makeRising({ drift: +1.5, n: 40 });
  const atr = ctx.atr(rows, 14);
  const struct = ctx.hgCfStructure(rows, atr[atr.length - 1]);
  ok(struct.ok === true, 'structure ran ok');
  ok(Array.isArray(struct.bull) && Array.isArray(struct.bear), 'structure returns bull/bear arrays');
  ok(struct.bull.some(s => /EMA9|SMA20|break of structure/i.test(s)), 'rising tape names at least one bull structure read');
  ok(struct.bear.length === 0, 'no bear structure on a rising tape');
  /* thin series → ok:false */
  const thin = rows.slice(0, 10);
  const stThin = ctx.hgCfStructure(thin, 5);
  ok(stThin.ok === false, 'thin series → ok:false');
}

console.log('== §7 hgCfConfluence tallies WITH/AGAINST on injected marks ==');
{
  const ctx = bootEngine();
  ctx.hgGoldFreeFeedVerdicts = function(c, dir){
    /* long: three with, one against; short: inverted */
    const long = (dir === 'long');
    return {
      'free:macroTilt': long,
      'free:silver': long,
      'free:paxgBasis': long,
      'free:vix': !long   /* one against */
    };
  };
  const rows = makeRising({ drift: +1.5, n: 40 });
  const r = ctx.hgCfConfluence({ macro: {} }, 'long', rows, null);
  ok(r.freeWith === 3, 'three WITH on long');
  ok(r.freeAgainst === 1, 'one AGAINST on long');
  ok(r.readableN === 4, 'four readable marks total');
  ok(r.withN === 3 && r.againstN === 1, 'withN/againstN tallies populated');
  /* mirror: short reads inverted on the same marks */
  const rS = ctx.hgCfConfluence({ macro: {} }, 'short', rows, null);
  ok(rS.freeWith === 1 && rS.freeAgainst === 3, 'short reads mirror');
  /* bad dir */
  const bad = ctx.hgCfConfluence({}, 'wrong', rows, null);
  ok(bad.withN === 0 && bad.againstN === 0 && bad.readableN === 0, 'invalid dir returns empty tally');
}

console.log('== §8 SETUP tier when confluence ≥60% WITH on ≥4 marks ==');
{
  const ctx = bootEngine();
  /* inject strong WITH-majority confluence */
  ctx.hgGoldFreeFeedVerdicts = function(c, dir){
    const L = (dir === 'long');
    return {
      'free:macroTilt': L, 'free:silver': L, 'free:paxgBasis': L, 'free:vix': L, 'free:usdjpy': L
    };
  };
  ctx.hgGoldFormingRegime = function(){ return { style: 'trend', er: 0.65, why: 'ER high', stamps: [] }; };
  const bull2 = ctx.goldCandleForecast(makeRising({ drift: +1.5 }), { macro: {} });
  ok(bull2 && bull2.tier === 'SETUP', 'tier is SETUP when confluence agrees: ' + (bull2 && bull2.tier));
  ok(bull2.confluence && bull2.confluence.withN >= 4, 'SETUP needs ≥4 readable WITH marks');
  ok(bull2.sl !== null && bull2.tp1 !== null, 'SETUP carries levels');
}

console.log('== §9 CONFLICT tier withholds levels when confluence runs AGAINST ==');
{
  const ctx = bootEngine();
  ctx.hgGoldFreeFeedVerdicts = function(c, dir){
    /* every mark reads AGAINST a long */
    const L = (dir === 'long');
    return {
      'free:macroTilt': !L, 'free:silver': !L, 'free:paxgBasis': !L, 'free:vix': !L, 'free:usdjpy': !L
    };
  };
  const bull3 = ctx.goldCandleForecast(makeRising({ drift: +1.5 }), { macro: {} });
  ok(bull3 && bull3.tier === 'CONFLICT', 'tier is CONFLICT when confluence opposes: ' + (bull3 && bull3.tier));
  ok(bull3.sl === null && bull3.tp1 === null && bull3.tp2 === null, 'CONFLICT withholds levels');
  ok(bull3.entry !== null, 'CONFLICT still names the entry so the reader sees the tape');
}

console.log('== §10 module file registers through HG_tabs ==');
{
  const src = read('gold-candle-forecast.js');
  ok(/G\.HG_tabs\s*=\s*G\.HG_tabs\s*\|\|\s*\[\]/.test(src), 'module ensures HG_tabs exists');
  ok(/G\.HG_tabs\.push\(\s*\{\s*id:\s*'candle-forecast'/.test(src), 'module pushes the tab entry');
  ok(/label:\s*'CANDLE FORECAST'/.test(src), 'label is CANDLE FORECAST');
  ok(/mount:\s*mount/.test(src), 'carries a mount function');
  ok(/refresh:\s*refresh/.test(src), 'carries a refresh function');
  ok(/getXAUCandles\(/.test(src), 'uses the shell gold feed chain');
  ok(!/api\.binance\.com/i.test(src), 'does not fetch Binance directly from the browser');
  ok(/G\.goldCandleForecast\(/.test(src), 'calls window.goldCandleForecast');
  ok(/gatherContext/.test(src), 'module gathers context for confluence');
  ok(/SCAN SCALP \+ SWING|SCAN NEXT CANDLE/.test(src), 'mount paints the SCAN button');
  ok(/v1316/.test(src), 'version chip bumped to v1316');
  /* hg-v1315: module fetches BOTH timeframes and runs the engine with mode. */
  ok(/getXAUCandles\(['"]15m['"]/.test(src), 'module fetches 15m feed');
  ok(/getXAUCandles\(['"]4h['"]/.test(src), 'module fetches 4h feed');
  ok(/mode:\s*['"]scalp['"]/.test(src), 'calls engine with mode: scalp');
  ok(/mode:\s*['"]swing['"]/.test(src), 'calls engine with mode: swing');
  ok(/renderDual|renderCard/.test(src), 'module renders two cards (scalp + swing)');
}

console.log('== §11 index.html wires the tab and loads before bootHgTabs ==');
{
  const html = read('index.html');
  const navMatch = html.match(/\{\s*id:\s*'gold'[^}]*tabs:\s*\[([^\]]+)\][^}]*\}/);
  ok(navMatch, 'gold HG_NAV_GROUPS entry found');
  ok(/'candle-forecast'/.test(navMatch[1]), "'candle-forecast' is in the gold tabs list");
  ok(/gold-candle-forecast\.js/.test(html), 'script tag included');
  const scriptIdx = html.indexOf('gold-candle-forecast.js');
  const bootIdx = html.indexOf('function bootHgTabs()');
  ok(scriptIdx > 0 && bootIdx > 0 && scriptIdx < bootIdx, 'script loads before bootHgTabs (hg-v1307 ordering preserved)');
  ok(/gold-candle-forecast\.js\?v=1316/.test(html), 'script version query bumped to 1316');
}

console.log('== §12 build stamps are current and no gate reads the engine ==');
{
  ok(/^hg-v\d+$/.test(HG_VER), 'build-stamp.js version has hg-v<n> shape; got ' + HG_VER);
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
  const gateFiles = ['cryptogates.js','engine.js','plans.js','hg-gates.js','hg-setup-core.js','hg-perfect-setup.js','setup-stack.js'];
  for (const f of gateFiles){
    const src = read(f);
    ok(!/goldCandleForecast\b/.test(src), f + ' does not read the forecast engine');
    ok(!/hgCfPatterns\b/.test(src), f + ' does not read the pattern helper');
    ok(!/hgCfAdvancedPatterns\b/.test(src), f + ' does not read the hg-v1315 advanced pattern helper');
    ok(!/hgCfConfluence\b/.test(src), f + ' does not read the confluence helper');
    ok(!/hgCfGoldDeskReads\b/.test(src), f + ' does not read the hg-v1315 gold-desk helper');
    ok(!/hgCfMaxPatterns\b/.test(src), f + ' does not read the hg-v1316 maximum pattern helper');
  }
  /* also assert the engine is not registered as a forward-ledger mark */
  const fwd = read('hg-forward.js');
  ok(!/goldCandleForecast\b/.test(fwd), 'hg-forward.js does not read the engine (display-only)');
  ok(!/hgCfPatterns\b/.test(fwd), 'hg-forward.js does not read the pattern helper');
  ok(!/hgCfAdvancedPatterns\b/.test(fwd), 'hg-forward.js does not read the hg-v1315 advanced pattern helper');
  ok(!/hgCfGoldDeskReads\b/.test(fwd), 'hg-forward.js does not read the hg-v1315 gold-desk helper');
  ok(!/hgCfMaxPatterns\b/.test(fwd), 'hg-forward.js does not read the hg-v1316 maximum pattern helper');
}

console.log('== §13 hg-v1315 — hgCfAdvancedPatterns detects the 15 new patterns ==');
{
  const ctx = bootEngine();
  /* Build a three-outside-up fixture: declining tape, strong bear r2, bull
     engulfing r1, bull continuation r0 closing above r1 close. */
  const rows = [];
  let p = 2400;
  for (let i = 0; i < 36; i++){
    const o = p, c = p - 0.5, h = Math.max(o,c) + 1, l = Math.min(o,c) - 1;
    rows.push({ t: 1_700_000_000 + i*900, o, h, l, c, v: 1000 });
    p = c;
  }
  /* r2 strong bear */
  rows.push({ t: 1_700_000_000 + 36*900, o: p, c: p - 3, h: p + 0.1, l: p - 3.5, v: 1500 });
  p = p - 3;
  /* r1 bull engulfs r2 */
  rows.push({ t: 1_700_000_000 + 37*900, o: p - 1, c: p + 5, h: p + 5.5, l: p - 1.5, v: 1800 });
  p = p + 5;
  /* r0 bull continuation closing above r1 close */
  rows.push({ t: 1_700_000_000 + 38*900, o: p, c: p + 2, h: p + 2.3, l: p - 0.3, v: 1600 });

  const atr = ctx.atr(rows, 14);
  const atrLast = atr[atr.length - 1];
  const adv = ctx.hgCfAdvancedPatterns(rows, atrLast);
  ok(adv.ok === true, 'advanced patterns ran ok');
  ok(Array.isArray(adv.bull) && Array.isArray(adv.bear) && Array.isArray(adv.neutral), 'advanced returns bull/bear/neutral arrays');
  ok(adv.bull.some(p => /three outside up/i.test(p)), 'three outside up detected on the fixture: got [' + adv.bull.join(', ') + ']');

  /* thin series → ok:false */
  const thin = [{t:1,o:1,h:1,l:1,c:1}];
  const noAdv = ctx.hgCfAdvancedPatterns(thin, 1);
  ok(noAdv.ok === false, 'thin series → advanced ok:false');

  /* zero ATR → ok:false */
  const noAtr = ctx.hgCfAdvancedPatterns(rows, 0);
  ok(noAtr.ok === false, 'zero ATR → advanced ok:false');

  /* belt-hold fixture: strong bull body opening at session low */
  const beltRows = [];
  p = 2300;
  for (let i = 0; i < 38; i++){
    const o = p, c = p + 0.3, h = Math.max(o,c) + 0.2, l = Math.min(o,c) - 0.2;
    beltRows.push({ t: 1_700_000_000 + i*900, o, h, l, c, v: 1000 });
    p = c;
  }
  /* belt hold: open ≈ low, strong bull body */
  beltRows.push({ t: 1_700_000_000 + 38*900, o: p, c: p + 5, h: p + 5.1, l: p - 0.05, v: 1500 });
  const atrB = ctx.atr(beltRows, 14);
  const bl = ctx.hgCfAdvancedPatterns(beltRows, atrB[atrB.length - 1]);
  ok(bl.bull.some(p => /belt hold/i.test(p)), 'bullish belt hold detected: got [' + bl.bull.join(', ') + ']');
}

console.log('== §14 hg-v1315 — hgCfGoldDeskReads merges directional readers into the tally ==');
{
  const ctx = bootEngine();
  /* stub three directional desk readers to all vote WITH a long */
  ctx.hgGoldSevenStep = () => ({ step4: { bias: 'LONG', note: 'test' } });
  ctx.hgGoldSweepOb = () => ({ dir: 'long', tier: 'alert', score: 80 });
  ctx.pineGoldConfluence = () => ({ long: { pass: true, score: 7 }, short: { pass: false, score: 2 } });
  /* news-lock reader — not firing (clear) */
  ctx.hgGoldNewsGate = () => ({ lock: false, unchecked: false });
  /* inst filter — passing */
  ctx.hgGoldInstFilter = () => ({ ok: true });

  const rows = makeRising({ drift: +1.5, n: 40 });
  const d = ctx.hgCfGoldDeskReads({ macro: {}, now: 1_700_000_000_000 }, 'long', rows, null);
  ok(d.withN >= 4, 'at least 4 WITH (sevenStep, sweepOb, pineConf, instFilter): got ' + d.withN);
  ok(d.againstN === 0, 'no AGAINST on all-long context');
  ok(d.marks && d.marks['desk:sevenStep'] === true, 'desk:sevenStep marked WITH');
  ok(d.marks && d.marks['desk:sweepOb'] === true, 'desk:sweepOb marked WITH');
  ok(d.marks && d.marks['desk:pineConf'] === true, 'desk:pineConf marked WITH');

  /* mirror: short reads the readers against */
  const dS = ctx.hgCfGoldDeskReads({ macro: {}, now: 1_700_000_000_000 }, 'short', rows, null);
  ok(dS.againstN >= 3, 'three desk readers vote AGAINST a short: got ' + dS.againstN);
  ok(dS.marks && dS.marks['desk:sevenStep'] === false, 'desk:sevenStep AGAINST short');
  ok(dS.marks && dS.marks['desk:sweepOb'] === false, 'desk:sweepOb AGAINST short');

  /* bad dir */
  const bad = ctx.hgCfGoldDeskReads({}, 'nope', rows, null);
  ok(bad.withN === 0 && bad.againstN === 0, 'bad dir returns empty tally');

  /* fails open with no readers loaded */
  const ctx2 = bootEngine();
  ctx2.__cfStubReset();
  const empty = ctx2.hgCfGoldDeskReads({}, 'long', rows, null);
  ok(empty.readableN === 0, 'all readers absent → readable 0');
  /* a NEWS LOCK is not a direction vote */
  ctx2.hgGoldNewsGate = () => ({ lock: true, title: 'CPI', reason: 'lockout' });
  const locked = ctx2.hgCfGoldDeskReads({}, 'long', rows, null);
  ok(locked.newsLock && locked.newsLock.lock === true, 'news lock recorded as flag');
  ok(locked.withN === 0 && locked.againstN === 0, 'news lock does NOT cast a direction vote');
}

console.log('== §15 hg-v1315 — mode-aware R:R: scalp 1R/2R, swing 1.5R/3R ==');
{
  const ctx = bootEngine();
  const rows = makeRising({ drift: +1.5, n: 40 });
  const scalp = ctx.goldCandleForecast(rows, { mode: 'scalp' });
  const swing = ctx.goldCandleForecast(rows, { mode: 'swing' });
  ok(scalp && scalp.mode === 'scalp', 'scalp mode reported');
  ok(swing && swing.mode === 'swing', 'swing mode reported');
  ok(scalp.tp1R === 1 && scalp.tp2R === 2, 'scalp uses 1R/2R');
  ok(swing.tp1R === 1.5 && swing.tp2R === 3, 'swing uses 1.5R/3R');
  /* geometry: scalp TP1 distance == SL distance (1R); swing TP1 == 1.5× SL */
  const sScalp = Math.abs(scalp.sl - scalp.entry);
  const tScalp = Math.abs(scalp.tp1 - scalp.entry);
  ok(Math.abs(tScalp - sScalp) < 0.01, 'scalp TP1 is exactly 1R from entry');
  const sSwing = Math.abs(swing.sl - swing.entry);
  const tSwing = Math.abs(swing.tp1 - swing.entry);
  ok(Math.abs(tSwing - sSwing * 1.5) < 0.01, 'swing TP1 is 1.5R from entry');
  const t2Swing = Math.abs(swing.tp2 - swing.entry);
  ok(Math.abs(t2Swing - sSwing * 3) < 0.01, 'swing TP2 is 3R from entry');

  /* default mode is scalp */
  const def = ctx.goldCandleForecast(rows);
  ok(def && def.mode === 'scalp', 'default mode is scalp');

  /* unknown mode falls back to scalp */
  const unk = ctx.goldCandleForecast(rows, { mode: 'nonsense' });
  ok(unk && unk.mode === 'scalp', 'unknown mode falls back to scalp');
}

console.log('== §16 hg-v1315 — news-lock downgrades SETUP to LEAN, never a direction veto ==');
{
  const ctx = bootEngine();
  /* strong WITH confluence that would read SETUP */
  ctx.hgGoldFreeFeedVerdicts = function(c, dir){
    const L = (dir === 'long');
    return { 'free:macroTilt': L, 'free:silver': L, 'free:paxgBasis': L, 'free:vix': L, 'free:usdjpy': L };
  };
  /* now add a tier-1 news lock */
  ctx.hgGoldNewsGate = () => ({ lock: true, title: 'CPI', reason: 'lockout' });

  const rows = makeRising({ drift: +1.5, n: 40 });
  const held = ctx.goldCandleForecast(rows, { macro: {}, mode: 'scalp' });
  ok(held, 'engine runs under a news lock');
  ok(held.dir === 'BULL', 'direction unchanged — the lock is not a direction veto');
  ok(held.tier === 'LEAN', 'SETUP is downgraded to LEAN under a tier-1 lock: got ' + held.tier);
  ok(held.newsHeld === true, 'newsHeld flag reported');
  ok(held.entry !== null && held.sl !== null, 'LEAN still carries levels');
  /* note mentions the news window */
  ok(/news/i.test(held.note || ''), 'note mentions the news window: ' + held.note);

  /* without the lock, same confluence promotes to SETUP */
  ctx.hgGoldNewsGate = () => ({ lock: false, unchecked: false });
  const clear = ctx.goldCandleForecast(rows, { macro: {}, mode: 'scalp' });
  ok(clear.tier === 'SETUP', 'clear news clears SETUP: got ' + clear.tier);
}

console.log('== §17 hg-v1316 — hgCfMaxPatterns detects the 15 further patterns ==');
{
  const ctx = bootEngine();
  /* Takuri line: body ≤ 0.1*ATR, lower wick ≥ 3*body, r1.c < r2.c (declined into r0).
     Need five bars minimum. */
  const takuri = [
    { t:0, o:2015, h:2016, l:2014, c:2015 },
    { t:1, o:2013, h:2014, l:2012, c:2013 },
    { t:2, o:2011, h:2012, l:2010, c:2011 },
    { t:3, o:2010, h:2010.5, l:2009.5, c:2010 },
    { t:4, o:2008, h:2008.1, l:1995, c:2008 }
  ];
  const takR = ctx.hgCfMaxPatterns(takuri, 10);
  ok(takR.ok === true, 'maximum patterns ran ok on takuri fixture');
  ok(takR.bull.some(p => /takuri/i.test(p)), 'takuri line detected on bullish fixture: got [' + takR.bull.join(', ') + ']');

  /* Advance block: three progressively weaker bulls with lengthening upper wicks */
  const advBlk = [
    { t:0, o:1980, h:1985, l:1979, c:1984 },
    { t:1, o:1984, h:1991, l:1983, c:1990 },
    { t:2, o:1990, h:2005, l:1990, c:2003 },  /* strong bull body 13 */
    { t:3, o:2003, h:2015, l:2003, c:2010 },  /* smaller body 7, up wick 5 */
    { t:4, o:2010, h:2020, l:2010, c:2013 }   /* smallest body 3, up wick 7 */
  ];
  const abR = ctx.hgCfMaxPatterns(advBlk, 10);
  ok(abR.bear.some(p => /advance block/i.test(p)), 'advance block detected on three-weakening-bulls fixture: got [' + abR.bear.join(', ') + ']');

  /* Matching high: two bull closes within 0.08*ATR tolerance, highs within tolerance */
  const matchHi = [
    { t:0, o:1990, h:1995, l:1988, c:1993 },
    { t:1, o:1993, h:1998, l:1991, c:1996 },
    { t:2, o:1996, h:2001, l:1994, c:1999 },
    { t:3, o:2002, h:2010, l:1999, c:2008 },
    { t:4, o:2003, h:2010.1, l:2000, c:2008.02 }
  ];
  const mhR = ctx.hgCfMaxPatterns(matchHi, 10);
  ok(mhR.bear.some(p => /matching high/i.test(p)), 'matching high detected on paired-close fixture: got [' + mhR.bear.join(', ') + ']');

  /* Thin series → ok:false */
  const thin = [{ t:1, o:1, h:1, l:1, c:1 }];
  const noMax = ctx.hgCfMaxPatterns(thin, 1);
  ok(noMax.ok === false, 'thin series → maximum ok:false');

  /* Zero ATR → ok:false */
  const noAtr = ctx.hgCfMaxPatterns(matchHi, 0);
  ok(noAtr.ok === false, 'zero ATR → maximum ok:false');
}

console.log('== §18 hg-v1316 — hgCfGoldDeskReads carries the seven new directional readers ==');
{
  const ctx = bootEngine();
  /* stub the seven new readers to all vote WITH a long */
  ctx.hgGoldMacroLock = (dir, c) => ({ lock: false, unchecked: false, dxyBull: false, tnxBull: false });
  ctx.hgGoldMtfMatrix = (inp) => ({ unchecked: false, conflict: false, scalpLongOk: true, scalpShortOk: false });
  ctx.hgGoldHtfBias = () => ({ dir: 'long', label: 'HTF bullish' });
  ctx.hgGoldSweepEngine = () => ({ dir: 'long', tier: 'alert', confirmed: true, score: 80 });
  ctx.hgGoldSessionBoundSweep = () => ({ inWindow: true, dir: 'long', tier: 'alert', confirmed: true });
  ctx.hgGoldNyExhaustion = () => ({ dir: 'long', tier: 'alert', confirmed: true, score: 75 });
  ctx.hgGoldOiTrap = () => ({ ok: true, dir: 'long', unchecked: false, oiBuildPct: 0.4 });

  const rows = makeRising({ drift: +1.5, n: 40 });
  const d = ctx.hgCfGoldDeskReads({ macro: {}, now: 1_700_000_000_000, rows4h: rows, rows1h: rows }, 'long', rows, rows);
  ok(d.marks && d.marks['desk:macroLock'] === true, 'desk:macroLock WITH on clear macro');
  ok(d.marks && d.marks['desk:mtfMatrix'] === true, 'desk:mtfMatrix WITH on long-aligned cascade');
  ok(d.marks && d.marks['desk:htfBias'] === true, 'desk:htfBias WITH on long bias');
  ok(d.marks && d.marks['desk:sweepEngine'] === true, 'desk:sweepEngine WITH on long dir');
  ok(d.marks && d.marks['desk:sessionSweep'] === true, 'desk:sessionSweep WITH on long dir');
  ok(d.marks && d.marks['desk:nyExh'] === true, 'desk:nyExh WITH on long dir');
  ok(d.marks && d.marks['desk:oiTrap'] === true, 'desk:oiTrap WITH on long dir');

  /* Mirror for short */
  const dS = ctx.hgCfGoldDeskReads({ macro: {}, now: 1_700_000_000_000, rows4h: rows }, 'short', rows, rows);
  ok(dS.marks && dS.marks['desk:macroLock'] === true, 'desk:macroLock still WITH short (lock false means both sides clear)');
  ok(dS.marks && dS.marks['desk:mtfMatrix'] === false, 'desk:mtfMatrix AGAINST short (long-only cascade)');
  ok(dS.marks && dS.marks['desk:htfBias'] === false, 'desk:htfBias AGAINST short');
  ok(dS.marks && dS.marks['desk:sweepEngine'] === false, 'desk:sweepEngine AGAINST short');
  ok(dS.marks && dS.marks['desk:nyExh'] === false, 'desk:nyExh AGAINST short');

  /* macroLock blocks long → AGAINST */
  ctx.hgGoldMacroLock = (dir) => ({ lock: true, unchecked: false, reason: 'CONVICTION LOCK' });
  const locked = ctx.hgCfGoldDeskReads({ macro: {} }, 'long', rows, rows);
  ok(locked.marks && locked.marks['desk:macroLock'] === false, 'macroLock lock=true → AGAINST this direction');
  ok(locked.macroLock && locked.macroLock.lock === true, 'macroLock payload records the lock');

  /* macroLock unchecked → UNREAD */
  ctx.hgGoldMacroLock = () => ({ lock: false, unchecked: true });
  const unch = ctx.hgCfGoldDeskReads({ macro: {} }, 'long', rows, rows);
  ok(!('desk:macroLock' in (unch.marks || {})), 'macroLock unchecked → mark absent');

  /* mtfMatrix conflict → UNREAD both ways */
  ctx.hgGoldMacroLock = undefined;
  ctx.hgGoldMtfMatrix = () => ({ unchecked: false, conflict: true, scalpLongOk: false, scalpShortOk: false });
  const conflict = ctx.hgCfGoldDeskReads({ macro: {} }, 'long', rows, rows);
  ok(!('desk:mtfMatrix' in (conflict.marks || {})), 'mtfMatrix conflict → mark absent (not a vote)');

  /* oiTrap unchecked → UNREAD (no OI feed) */
  ctx.hgGoldMtfMatrix = undefined;
  ctx.hgGoldOiTrap = () => ({ ok: false, unchecked: true, why: 'OI history unread' });
  const oi = ctx.hgCfGoldDeskReads({}, 'long', rows, rows);
  ok(!('desk:oiTrap' in (oi.marks || {})), 'oiTrap unchecked (no OI feed) → mark absent');

  /* all readers absent → readable 0 */
  const ctx2 = bootEngine();
  ctx2.__cfStubReset();
  const empty = ctx2.hgCfGoldDeskReads({}, 'long', rows, rows);
  ok(empty.withN === 0 && empty.againstN === 0, 'all readers absent → empty tally');

  /* bad dir */
  const bad = ctx.hgCfGoldDeskReads({}, 'nope', rows, rows);
  ok(bad.withN === 0 && bad.againstN === 0, 'bad dir returns empty tally');
}

console.log('== §19 hg-v1316 — engine merges three pattern sets (46 patterns total) ==');
{
  const ctx = bootEngine();
  const rows = makeThreeSoldiersFixture();
  const atr = ctx.atr(rows, 14);
  const atrLast = atr[atr.length - 1];

  const pat = ctx.hgCfPatterns(rows, atrLast);
  const patAdv = ctx.hgCfAdvancedPatterns(rows, atrLast);
  const patMax = ctx.hgCfMaxPatterns(rows, atrLast);

  const f = ctx.goldCandleForecast(rows);
  ok(f && f.dir === 'BULL', 'engine still votes BULL on three-soldiers fixture');
  /* merged patterns.bull must include every bull entry from the three sets. */
  const bullMerged = (f.patterns && f.patterns.bull) || [];
  const bullCount = (pat.ok ? pat.bull.length : 0) + (patAdv.ok ? patAdv.bull.length : 0) + (patMax.ok ? patMax.bull.length : 0);
  ok(bullMerged.length === bullCount, 'merged bull length (' + bullMerged.length + ') equals pat+patAdv+patMax (' + bullCount + ')');

  /* The engine must call hgCfMaxPatterns. If dropped, merged bull/bear
     would miss its contributions. Here on three-soldiers fixture patMax
     may not emit anything, so we exercise it indirectly by injecting a
     fixture it does fire on, verifying mergedBull contains at least one
     entry from each. */
  const takuri = [
    { t:0, o:2015, h:2016, l:2014, c:2015 },
    { t:1, o:2013, h:2014, l:2012, c:2013 },
    { t:2, o:2011, h:2012, l:2010, c:2011 },
    { t:3, o:2010, h:2010.5, l:2009.5, c:2010 },
    { t:4, o:2008, h:2008.1, l:1995, c:2008 }
  ];
  const padBase = [];
  let p = 2050;
  for (let i = 0; i < 35; i++){
    const o = p, c = p - 1, h = Math.max(o,c)+1, l = Math.min(o,c)-1;
    padBase.push({ t: i, o, h, l, c, v: 1000 });
    p = c;
  }
  const combined = padBase.concat(takuri.map((r,i) => ({...r, t: 35 + i})));
  const combF = ctx.goldCandleForecast(combined);
  if (combF && combF.patterns){
    /* Takuri lives in hgCfMaxPatterns; if it reads bull on this fixture
       the merged bull should contain it. */
    const hasTakuri = (combF.patterns.bull || []).some(p => /takuri/i.test(p));
    ok(hasTakuri, 'merged patterns.bull carries hg-v1316 takuri entry: got [' + (combF.patterns.bull || []).join(', ') + ']');
  }
}

console.log('== §20 behavioural mutation pass ==');
{
  const goldSrc = read('goldind.js');
  const start = goldSrc.indexOf(ENGINE_MARKER);
  const engineText = goldSrc.slice(start);
  const mutations = [
    { name: 'drop thin-tape guard', from: '!Array.isArray(rows) || rows.length < 20) return null;', to: '!Array.isArray(rows) || rows.length < 2) return null;' },
    { name: 'swap BULL/BEAR dir on primary branch', from: "if (bullBias > bearBias && patBull > 0 && structBull > 0){\n      dir = 'BULL'; dirSide = 'long';", to: "if (bullBias > bearBias && patBull > 0 && structBull > 0){\n      dir = 'BEAR'; dirSide = 'short';" },
    { name: 'invert tp sign', from: 'var sign = (dir === \'BULL\') ? 1 : -1;', to: 'var sign = (dir === \'BULL\') ? -1 : 1;' },
    { name: 'swap BULL/BEAR dir on fallback branch', from: "} else if (bullBias > bearBias && bullBias >= bearBias * 2){\n      /* fallback: EMA + patterns agree strongly even if structure is quiet */\n      dir = 'BULL'; dirSide = 'long';", to: "} else if (bullBias > bearBias && bullBias >= bearBias * 2){\n      /* fallback: EMA + patterns agree strongly even if structure is quiet */\n      dir = 'BEAR'; dirSide = 'short';" },
    { name: 'remove export', from: 'G.goldCandleForecast = goldCandleForecast;', to: '/* mutated: no export */' },
    { name: 'swap pattern bull/bear tally', from: 'var patBull = patMerged.ok ? patMerged.bull.length : 0;\n    var patBear = patMerged.ok ? patMerged.bear.length : 0;', to: 'var patBull = patMerged.ok ? patMerged.bear.length : 0;\n    var patBear = patMerged.ok ? patMerged.bull.length : 0;' },
    { name: 'loosen SETUP confluence threshold', from: 'readableN >= 4 && isFinite(confWithPct) && confWithPct >= 0.6', to: 'readableN >= 0 || (isFinite(confWithPct) && confWithPct >= 0.0)' },
    { name: 'drop CONFLICT levels withholding', from: 'sl = null; tp1 = null; tp2 = null;', to: '/* mutated: keep CONFLICT levels */' },
    /* hg-v1315 mutations */
    { name: 'swing R:R mutated to 1R/2R', from: "var tp1R = (mode === 'swing') ? 1.5 : 1.0;\n    var tp2R = (mode === 'swing') ? 3.0 : 2.0;", to: "var tp1R = 1.0;\n    var tp2R = 2.0;" },
    { name: 'drop news-lock SETUP downgrade', from: 'if (newsHeld && tier === \'SETUP\') tier = \'LEAN\';', to: '/* mutated: news lock does not downgrade */' },
    { name: 'swap advanced patterns bull/bear', from: 'var patAdv = hgCfAdvancedPatterns(rows, atrLast);', to: 'var patAdv = (function(r,a){var p=hgCfAdvancedPatterns(r,a); return {ok:p.ok,bull:p.bear,bear:p.bull,neutral:p.neutral};})(rows,atrLast);' },
    { name: 'drop gold-desk reads merge', from: 'var withN = conf.withN + desk.withN;\n    var againstN = conf.againstN + desk.againstN;', to: 'var withN = conf.withN;\n    var againstN = conf.againstN;' },
    /* hg-v1316 mutations */
    { name: 'swap maximum patterns bull/bear', from: 'var patMax = hgCfMaxPatterns(rows, atrLast);', to: 'var patMax = (function(r,a){var p=hgCfMaxPatterns(r,a); return {ok:p.ok,bull:p.bear,bear:p.bull,neutral:p.neutral};})(rows,atrLast);' },
    { name: 'drop maximum patterns merge', from: '(pat.bull || []).concat(patAdv.bull || []).concat(patMax.bull || [])', to: '(pat.bull || []).concat(patAdv.bull || [])' },
    { name: 'invert hgGoldMacroLock verdict', from: "if (ml.lock === true) record('desk:macroLock', false, 'desk');\n          else record('desk:macroLock', true, 'desk');", to: "if (ml.lock === true) record('desk:macroLock', true, 'desk');\n          else record('desk:macroLock', false, 'desk');" },
    { name: 'drop hgGoldHtfBias desk block', from: "if (typeof G.hgGoldHtfBias === 'function'){\n      var hb = G.hgGoldHtfBias(ctxUse.rows4h || rowsUse, ctxUse.rows1h || null);", to: "if (false){\n      var hb = G.hgGoldHtfBias(ctxUse.rows4h || rowsUse, ctxUse.rows1h || null);" },
  ];
  for (const m of mutations){
    const occ = engineText.split(m.from).length - 1;
    if (occ !== 1) throw new Error('mutation "' + m.name + '" needs exactly one occurrence; found ' + occ);
    const mutated = engineText.replace(m.from, m.to);
    const ctx = { console };
    ctx.window = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    try { vm.runInContext(read('indicators.js'), ctx); } catch (_){}
    let caught = false;
    try { vm.runInContext(mutated, ctx, { filename: 'goldind.js#mutated' }); }
    catch (e){ caught = true; pass++; console.log('  ok — mutation caught (parse) —', m.name); continue; }
    try {
      const f = ctx.goldCandleForecast;
      if (typeof f !== 'function'){ caught = true; }
      else {
        /* probe 1: three-soldiers composite — patterns + structure both
           fire bull, so the PRIMARY branch of the direction decision
           runs. A mutation that swaps BULL/BEAR there is caught. */
        const sol = f(makeThreeSoldiersFixture());
        if (!sol || sol.dir !== 'BULL'){ caught = true; }
        else {
          if (sol.tp1 < sol.entry) caught = true;
          if (sol.sl > sol.entry) caught = true;
          if (sol.tp2 < sol.tp1) caught = true;
        }
        /* probe 2: rising-staircase — primary branch not reached (no
           patterns on a staircase), but the fallback branch gives BULL.
           Catches mutations on the staircase path. */
        const b = f(makeRising({ drift: +1.5 }));
        if (!b || b.dir !== 'BULL'){ caught = true; }
        else {
          if (b.tp1 < b.entry) caught = true;
          if (b.sl > b.entry) caught = true;
        }
        /* probe 3: thin tape must still return null */
        if (f(makeRising({ n: 19 })) !== null) caught = caught || (m.name === 'drop thin-tape guard');
        /* probe 4: pattern-inverter — bull patterns on three-soldiers
           fixture should produce bull bias; if swapped, bear dominates. */
        if (m.name === 'invert pattern bull tally'){
          const hr = f(makeThreeSoldiersFixture());
          if (hr && hr.dir === 'BULL') caught = false;
          else caught = true;
        }
        /* probe 5: CONFLICT levels — inject AGAINST confluence and the
           non-mutated engine withholds, the mutated keeps them. */
        if (m.name === 'drop CONFLICT levels withholding'){
          ctx.hgGoldFreeFeedVerdicts = function(c, dir){
            const L = (dir === 'long');
            return { 'free:macroTilt': !L, 'free:silver': !L, 'free:paxgBasis': !L, 'free:vix': !L, 'free:usdjpy': !L };
          };
          const con = f(makeThreeSoldiersFixture(), { macro: {} });
          if (con && con.tier === 'CONFLICT' && con.sl !== null) caught = true;
        }
        /* probe 6: SETUP threshold — three-soldiers with NO confluence
           context must stay at LEAN; the mutation that loosens the
           threshold would promote it to SETUP. */
        if (m.name === 'loosen SETUP confluence threshold'){
          const sol2 = f(makeThreeSoldiersFixture());  /* no ctx */
          if (sol2 && sol2.tier === 'SETUP') caught = true;
        }
        /* probe 7: swing R:R — swing mode must emit tp1R=1.5; mutation
           reverts to tp1R=1 and the probe catches it. */
        if (m.name === 'swing R:R mutated to 1R/2R'){
          const sw = f(makeRising({ drift: +1.5, n: 40 }), { mode: 'swing' });
          if (sw && sw.tp1R === 1.5 && sw.tp2R === 3) caught = false;
          else caught = true;
        }
        /* probe 8: news-lock downgrade — inject SETUP-strength confluence
           and a tier-1 lock; non-mutated engine downgrades to LEAN, mutant
           keeps SETUP. */
        if (m.name === 'drop news-lock SETUP downgrade'){
          ctx.hgGoldFreeFeedVerdicts = function(c, dir){
            const L = (dir === 'long');
            return { 'free:macroTilt': L, 'free:silver': L, 'free:paxgBasis': L, 'free:vix': L, 'free:usdjpy': L };
          };
          ctx.hgGoldNewsGate = () => ({ lock: true, title: 'CPI' });
          const lock = f(makeRising({ drift: +1.5, n: 40 }), { macro: {}, mode: 'scalp' });
          /* non-mutated engine would return tier LEAN; mutant keeps SETUP */
          if (lock && lock.tier === 'SETUP') caught = true;
        }
        /* probe 9: swap advanced patterns bull/bear — build the §13
           three-outside-up fixture; on it hg-v1314 patterns fire bull and
           hg-v1315's three-outside-up fires bull too. The engine votes
           BULL on either side. With advanced bull/bear SWAPPED, the
           advanced leg votes bear instead; the merged tally still votes
           bull because hg-v1314's bull outweighs it — but the swap pulls
           bear up, so bullBias falls and dir may flip to NEUTRAL. We
           probe both bull patterns and bear patterns on the merged
           output: if 'three outside up' now shows in the BEAR list, the
           swap took effect. */
        if (m.name === 'swap advanced patterns bull/bear'){
          const rr = [];
          let p = 2400;
          for (let i = 0; i < 36; i++){
            const o = p, c = p - 0.5, h = Math.max(o,c) + 1, l = Math.min(o,c) - 1;
            rr.push({ t: 1_700_000_000 + i*900, o, h, l, c, v: 1000 });
            p = c;
          }
          rr.push({ t: 1_700_000_000 + 36*900, o: p, c: p - 3, h: p + 0.1, l: p - 3.5, v: 1500 });
          p = p - 3;
          rr.push({ t: 1_700_000_000 + 37*900, o: p - 1, c: p + 5, h: p + 5.5, l: p - 1.5, v: 1800 });
          p = p + 5;
          rr.push({ t: 1_700_000_000 + 38*900, o: p, c: p + 2, h: p + 2.3, l: p - 0.3, v: 1600 });
          const r = f(rr);
          /* non-mutated: 'three outside up' lives in patterns.bull.
             mutated: 'three outside up' lives in patterns.bear. */
          const bullStr = (r && r.patterns && r.patterns.bull || []).join('|');
          const bearStr = (r && r.patterns && r.patterns.bear || []).join('|');
          if (/three outside up/i.test(bearStr)) caught = true;
          else if (/three outside up/i.test(bullStr)) caught = false;
          else caught = true;  /* fixture failed to fire — guard caught by fixture breakage */
        }
        /* probe 10: drop gold-desk merge — inject desk readers that all
           vote WITH long; non-mutated engine merges them and reaches
           SETUP (readableN=4, 100% WITH); mutant drops the merge so
           readableN=0 and the engine reads LEAN. caught=true when the
           mutation is DETECTED (tier not SETUP). */
        if (m.name === 'drop gold-desk reads merge'){
          ctx.hgGoldSevenStep = () => ({ step4: { bias: 'LONG' } });
          ctx.hgGoldSweepOb = () => ({ dir: 'long', tier: 'alert', score: 80 });
          ctx.pineGoldConfluence = () => ({ long: { pass: true }, short: { pass: false } });
          ctx.hgGoldInstFilter = () => ({ ok: true });
          const rr = f(makeRising({ drift: +1.5, n: 40 }), { macro: {}, mode: 'scalp' });
          /* mutated engine drops the merge → readableN=0 → not SETUP */
          if (rr && rr.tier !== 'SETUP') caught = true;
          else caught = false;
        }
        /* probe 11 (hg-v1316): swap maximum patterns bull/bear — build
           a takuri fixture, which fires hgCfMaxPatterns.bull. If the
           maximum leg is bull/bear swapped, 'takuri' appears in BEAR
           rather than BULL. */
        if (m.name === 'swap maximum patterns bull/bear'){
          const padBase = [];
          let p = 2050;
          for (let i = 0; i < 35; i++){
            const o = p, c = p - 1, h = Math.max(o,c)+1, l = Math.min(o,c)-1;
            padBase.push({ t: i, o, h, l, c, v: 1000 });
            p = c;
          }
          const takuri = [
            { t:35, o:2015, h:2016, l:2014, c:2015 },
            { t:36, o:2013, h:2014, l:2012, c:2013 },
            { t:37, o:2011, h:2012, l:2010, c:2011 },
            { t:38, o:2010, h:2010.5, l:2009.5, c:2010 },
            { t:39, o:2008, h:2008.1, l:1995, c:2008 }
          ];
          const combined = padBase.concat(takuri);
          const r = f(combined);
          const bullStr = (r && r.patterns && r.patterns.bull || []).join('|');
          const bearStr = (r && r.patterns && r.patterns.bear || []).join('|');
          if (/takuri/i.test(bearStr)) caught = true;
          else if (/takuri/i.test(bullStr)) caught = false;
          else caught = true;  /* fixture failed */
        }
        /* probe 12 (hg-v1316): drop maximum patterns merge — the merged
           bull list on a takuri fixture must contain the maximum pattern.
           If the merge is dropped, 'takuri' never appears in the merged
           bull list (patMax contribution lost). */
        if (m.name === 'drop maximum patterns merge'){
          const padBase = [];
          let p = 2050;
          for (let i = 0; i < 35; i++){
            const o = p, c = p - 1, h = Math.max(o,c)+1, l = Math.min(o,c)-1;
            padBase.push({ t: i, o, h, l, c, v: 1000 });
            p = c;
          }
          const takuri = [
            { t:35, o:2015, h:2016, l:2014, c:2015 },
            { t:36, o:2013, h:2014, l:2012, c:2013 },
            { t:37, o:2011, h:2012, l:2010, c:2011 },
            { t:38, o:2010, h:2010.5, l:2009.5, c:2010 },
            { t:39, o:2008, h:2008.1, l:1995, c:2008 }
          ];
          const r = f(padBase.concat(takuri));
          const bullStr = (r && r.patterns && r.patterns.bull || []).join('|');
          /* non-mutated: 'takuri' lives in merged bull; mutated: dropped */
          if (!/takuri/i.test(bullStr)) caught = true;
          else caught = false;
        }
        /* probe 13 (hg-v1316): invert hgGoldMacroLock verdict — inject a
           lock=false reading. Non-mutated engine records WITH (desk is
           not against the trade); mutated engine records AGAINST. On a
           long plan with 4 other desk readers voting WITH, inverting
           macroLock still keeps 4 WITH / 1 AGAINST, which is 80% → still
           SETUP. So we instead inspect the mark directly. */
        if (m.name === 'invert hgGoldMacroLock verdict'){
          ctx.hgGoldMacroLock = () => ({ lock: false, unchecked: false });
          const dReads = ctx.hgCfGoldDeskReads({ macro: {} }, 'long', makeRising({ drift: +1.5, n: 40 }), null);
          /* non-mutated: lock=false → mark true (WITH); mutated: mark false */
          if (dReads && dReads.marks && dReads.marks['desk:macroLock'] === false) caught = true;
          else caught = false;
        }
        /* probe 14 (hg-v1316): drop hgGoldHtfBias desk block — inject a
           long bias; non-mutated engine records WITH on desk:htfBias;
           mutated engine never records it. */
        if (m.name === 'drop hgGoldHtfBias desk block'){
          ctx.hgGoldHtfBias = () => ({ dir: 'long', label: 'HTF bullish' });
          const dReads = ctx.hgCfGoldDeskReads({ macro: {} }, 'long', makeRising({ drift: +1.5, n: 40 }), null);
          /* non-mutated: mark present (true); mutated: mark absent */
          if (!dReads || !dReads.marks || !('desk:htfBias' in dReads.marks)) caught = true;
          else caught = false;
        }
      }
    } catch (e){ caught = true; }
    if (!caught) throw new Error('MUTATION SURVIVED: ' + m.name);
    pass++; console.log('  ok — mutation caught —', m.name);
  }
}

console.log('\n' + pass + ' assertions passed, 0 failed.');
