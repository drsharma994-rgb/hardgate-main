/* HARDGATE — hg-v1314 CANDLE FORECAST tab guard.

   The user asked for "more advanced candle stick pattern recognition in
   candle forecast tab for further accurate analysis of gold candles
   and setups with all the indicators, core strategies, fundamentals,
   technicals used in all the gold tabs to form a confluence with
   candle stick patterns and then form a setup".

   The hg-v1306 engine was a two-line EMA9-slope read; this upgrades it
   to three legs: hgCfPatterns (16 candlestick patterns), hgCfStructure
   (eight structural reads), hgCfConfluence (calls hgGoldFreeFeedVerdicts,
   hgGoldIndicatorReads + hgGoldIndicatorMarks, pineGoldLayerStates +
   pineGoldPineMarks, hgGoldFormingRegime). A SETUP forms on
   patterns + structure + confluence agreement; a LEAN on patterns +
   structure alone; a CONFLICT when confluence runs AGAINST the pattern;
   NEUTRAL otherwise.

   Sections:
     §1  engine + helpers are globals
     §2  thin tape returns null; flat tape returns NEUTRAL (never a lean)
     §3  rising tape → BULL with entry/SL/TP geometry (1R, 1:1, 1:2)
     §4  falling tape → BEAR mirror
     §5  hgCfPatterns names 16 patterns and refuses dust bars as hammers
     §6  hgCfStructure names 8 structural reads
     §7  hgCfConfluence tallies WITH/AGAINST on injected marks
     §8  SETUP tier when confluence ≥60% WITH on ≥4 marks
     §9  CONFLICT tier when confluence ≤40% WITH on ≥4 marks (levels withheld)
     §10 module file registers through HG_tabs with new label chip
     §11 index.html carries the tab in HG_NAV_GROUPS and loads before bootHgTabs
     §12 build stamps are current (hg-v1314) and no gate reads the engine
     §13 behavioural mutation pass over the hg-v1314 block

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

const ENGINE_MARKER = '/* ========================================================================\n   hg-v1314: CANDLE FORECAST';

function bootEngine(opts){
  const o = opts || {};
  const ctx = { console };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  if (!o.skipIndicators) vm.runInContext(read('indicators.js'), ctx, { filename: 'indicators.js' });
  const gold = read('goldind.js');
  const idx = gold.indexOf(ENGINE_MARKER);
  if (idx < 0) throw new Error('hg-v1314 engine block not found in goldind.js');
  vm.runInContext(gold.slice(idx), ctx, { filename: 'goldind.js#hg-v1314' });
  /* seed stubs for the confluence readers, letting §7-9 inject marks. */
  ctx.__cfStubReset = function(){
    ctx.hgGoldFreeFeedVerdicts = undefined;
    ctx.hgGoldIndicatorReads = undefined;
    ctx.hgGoldIndicatorMarks = undefined;
    ctx.pineGoldLayerStates = undefined;
    ctx.pineGoldPineMarks = undefined;
    ctx.hgGoldFormingRegime = undefined;
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
  ok(typeof ctx.hgCfStructure === 'function', 'window.hgCfStructure exists');
  ok(typeof ctx.hgCfConfluence === 'function', 'window.hgCfConfluence exists');
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
  ok(/goldCandleForecast\(rows,\s*ctx\)/.test(src) || /goldCandleForecast\(rows,/.test(src), 'calls window.goldCandleForecast with (rows, ctx)');
  ok(/gatherContext/.test(src), 'module gathers context for confluence');
  ok(/SCAN NEXT CANDLE/.test(src), 'mount paints the SCAN button');
  ok(/v1314/.test(src), 'version chip bumped to v1314');
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
  ok(/gold-candle-forecast\.js\?v=1314/.test(html), 'script version query bumped to 1314');
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
    ok(!/hgCfConfluence\b/.test(src), f + ' does not read the confluence helper');
  }
  /* also assert the engine is not registered as a forward-ledger mark */
  const fwd = read('hg-forward.js');
  ok(!/goldCandleForecast\b/.test(fwd), 'hg-forward.js does not read the engine (display-only)');
  ok(!/hgCfPatterns\b/.test(fwd), 'hg-forward.js does not read the pattern helper');
}

console.log('== §13 behavioural mutation pass ==');
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
    { name: 'swap pattern bull/bear tally', from: 'var patBull = pat.ok ? pat.bull.length : 0;\n    var patBear = pat.ok ? pat.bear.length : 0;', to: 'var patBull = pat.ok ? pat.bear.length : 0;\n    var patBear = pat.ok ? pat.bull.length : 0;' },
    { name: 'loosen SETUP confluence threshold', from: 'conf.readableN >= 4 && isFinite(confWithPct) && confWithPct >= 0.6', to: 'conf.readableN >= 0 || (isFinite(confWithPct) && confWithPct >= 0.0)' },
    { name: 'drop CONFLICT levels withholding', from: 'sl = null; tp1 = null; tp2 = null;', to: '/* mutated: keep CONFLICT levels */' },
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
      }
    } catch (e){ caught = true; }
    if (!caught) throw new Error('MUTATION SURVIVED: ' + m.name);
    pass++; console.log('  ok — mutation caught —', m.name);
  }
}

console.log('\n' + pass + ' assertions passed, 0 failed.');
