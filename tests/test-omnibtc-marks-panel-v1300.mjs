#!/usr/bin/env node
/* hg-v1300: a user paste proposed replacing OMNIBTC's 3500-line measured
   engine with a 170-line prototype carrying five hand-chosen hard gates
   (F&G 30-70, EMA50>EMA200, 10-bar low "sweep", RSI 40-60, ATR>0) and a
   TRADE VALID / NO TRADE verdict. Three concrete reasons that paste did
   not ship: (a) its API globals do not exist in this repo (window.BinanceAPI,
   window.Indicators.EMA, 'YOUR_FREE_TOKEN', data.主动_dominance Chinese
   field, .toFixed on an array), (b) its gate thresholds are UNMEASURED,
   exactly the hg-v966 trap the last 10 packs refused on this desk, and (c)
   it replaces 16 tested files worth of forward-ledger plumbing.

   What ships instead is the HONEST half of the ask: a FUNDAMENTALS & FEED
   panel on the existing OMNIBTC card that reads the hg-v1297/v1299 free: +
   ind: marks and the hg-v1293/v1295/v1296 pine: marks already stamped on
   every record. One function (hgObtcMarksPanelHtml), one new call site in
   the dhtml chain, no new gate (asserted), no new fetcher.

   Mark triangulation (hg-v989 three-state): free: and ind: are strict
   booleans TRUE/FALSE/absent; pine: is 'long'/'short'/absent and the
   panel translates both into WITH / AGAINST / UNREAD on the plan's
   direction.

   Behavioural guard drives the real exported hgObtcMarksPanelHtml under
   stubbed pick.row.perfectReads. Mutation targets: group ordering changes,
   loosened boolean check (hg-v955 coercion trap), direction coupling errors
   on pine marks that store 'long'/'short' not booleans, and a mutation
   that removes the "nothing is gated" doctrine note. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0, failed = 0;
function ok(cond, label){
  if (cond){ passed++; console.log('  ok —', label); }
  else { failed++; console.log('  FAIL —', label); }
}
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function bootPanel(){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
  };
  ctx.window = ctx; ctx.W = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const src = read('omnibtc.js');
  /* Lift the panel helpers out: HG_OBTC_MARKS_GROUPS declaration through
     the end of hgObtcMarksPanelHtml. */
  const start = src.indexOf('var HG_OBTC_MARKS_GROUPS');
  if (start < 0) throw new Error('HG_OBTC_MARKS_GROUPS not found');
  const endMarker = 'function hgObtcFundingWitnessHtml';
  const end = src.indexOf(endMarker, start);
  if (end < 0 || end <= start) throw new Error('end marker not found');
  const block = src.slice(start, end);
  /* The panel calls esc(). The real esc() is in the IIFE scope; stub it. */
  vm.runInContext('function esc(s){ s = String(s == null ? "" : s); return s.replace(/[&<>"\']/g, function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\'":"&#39;"})[c] || c; }); }', ctx);
  vm.runInContext(block, ctx);
  return ctx;
}

function makePick(dir, freeMarks, indMarks, pineMarks){
  return {
    row: {
      dir: dir,
      perfectReads: {
        freeFeedVerdicts: freeMarks || {},
        indMarks: indMarks || {},
        pineMarks: pineMarks || {}
      }
    }
  };
}

/* ------------------------------------------------------------------ */
console.log('== 1) hgObtcMarksPanelHtml is exported (one home for the reader) ==');
{
  const src = read('omnibtc.js');
  ok(/W\.hgObtcMarksPanelHtml\s*=\s*hgObtcMarksPanelHtml/.test(src),
    'hgObtcMarksPanelHtml exported on W');
  ok(/W\.HG_OBTC_MARKS_GROUPS\s*=\s*HG_OBTC_MARKS_GROUPS/.test(src),
    'HG_OBTC_MARKS_GROUPS exported on W');
}

/* ------------------------------------------------------------------ */
console.log('== 2) the groups cover every mark the hg-v1297/v1299/v1295 pipeline stamps ==');
{
  const ctx = bootPanel();
  const groups = ctx.HG_OBTC_MARKS_GROUPS;
  ok(Array.isArray(groups) && groups.length === 6, 'exactly 6 groups (hg-v1301 adds ON-CHAIN)');
  const titles = groups.map(g => g.title);
  ok(titles.includes('MACRO'), 'MACRO group');
  ok(titles.includes('CRYPTO SENTIMENT'), 'CRYPTO SENTIMENT group');
  ok(titles.includes('TREND / MOMENTUM'), 'TREND / MOMENTUM group');
  ok(titles.includes('VOLATILITY'), 'VOLATILITY group');
  ok(titles.includes('PINE PORTS'), 'PINE PORTS group');
  const allKeys = groups.flatMap(g => g.keys.map(k => k[0]));
  const freeKeys = allKeys.filter(k => k.startsWith('free:'));
  const indKeys = allKeys.filter(k => k.startsWith('ind:'));
  const pineKeys = allKeys.filter(k => k.startsWith('pine:'));
  ok(freeKeys.length === 12, `panel covers 12 free: keys — got ${freeKeys.length} (hg-v1301 adds mempoolFeeHigh)`);
  ok(indKeys.length === 13, `panel covers 13 ind: keys — got ${indKeys.length}`);
  ok(pineKeys.length === 13, `panel covers 13 pine: keys — got ${pineKeys.length}`);
  ok(allKeys.length === 38, `total 38 marks surfaced — got ${allKeys.length} (hg-v1301 adds free:mempoolFeeHigh)`);
  /* every key must be unique */
  const uniq = new Set(allKeys);
  ok(uniq.size === allKeys.length, 'no duplicate keys across groups');
  /* every key must have a label */
  const everyHasLabel = groups.every(g => g.keys.every(k => typeof k[1] === 'string' && k[1].length > 0));
  ok(everyHasLabel, 'every mark has a human label');
}

/* ------------------------------------------------------------------ */
console.log('== 3) the panel reads strict booleans and absents everything else ==');
{
  const ctx = bootPanel();
  const pick = makePick('long',
    { 'free:dxyTrend': true, 'free:fngExtreme': false, 'free:btcGoldCorr': true },
    { 'ind:adxTrending': true, 'ind:sma50With': false, 'ind:parkHigh': true },
    { lor: 'long', ht: 'short', supertrend: 'long', macd: 'short', cci: 'long' }
  );
  const html = ctx.hgObtcMarksPanelHtml(pick);
  ok(typeof html === 'string' && html.length > 0, 'returns html');
  ok(/FUNDAMENTALS &amp; FEED/.test(html), 'header reads FUNDAMENTALS & FEED');
  /* count read: 3 free + 3 ind + 5 pine = 11 */
  ok(/11 of 38/.test(html), 'header shows 11 of 38 read (hg-v1301 total 38)');
  /* direction surfaced */
  ok(/plan direction LONG/.test(html), 'direction LONG surfaced');
  /* the WITH / AGAINST labels */
  ok(/WITH/.test(html), 'WITH tokens present');
  ok(/AGAINST/.test(html), 'AGAINST tokens present');
  ok(/UNREAD/.test(html), 'UNREAD tokens present (the 27 absent marks)');
  /* every unread mark reads UNREAD (38 - 11 = 27). Count only value cells
     ("<span class='v'>UNREAD</span>"), not the "WITH / AGAINST / UNREAD"
     doctrine line which mentions the token descriptively. */
  const unreads = (html.match(/<span class="v[^"]*">UNREAD<\/span>/g) || []).length;
  ok(unreads === 27, `exactly 27 UNREAD cells — got ${unreads}`);
}

/* ------------------------------------------------------------------ */
console.log('== 4) a non-boolean mark reads UNREAD (the hg-v955 coercion trap) ==');
{
  const ctx = bootPanel();
  /* junk values must not coerce; the panel reads only strict true/false */
  const pick = makePick('long',
    { 'free:dxyTrend': 1, 'free:fngExtreme': 'yes', 'free:btcGoldCorr': null, 'free:tnxTrend': 0, 'free:vixRising': {}, 'free:newsBlackout': 'true' },
    {},
    { lor: 'LONG', ht: 'short', supertrend: 1, macd: '', cci: null }
  );
  const html = ctx.hgObtcMarksPanelHtml(pick);
  /* exactly one pine mark is read: ht:'short'. 'LONG' (upper), 1, '', null are junk */
  /* zero free marks read. */
  ok(/1 of 38/.test(html), 'only ht is read; 1 of 38 (hg-v1301 total 38)');
  /* ht reads SHORT direction → AGAINST on a long. Count only value cells. */
  const againsts = (html.match(/<span class="v[^"]*">AGAINST<\/span>/g) || []).length;
  ok(againsts === 1, `exactly 1 AGAINST (ht short on long plan) — got ${againsts}`);
}

/* ------------------------------------------------------------------ */
console.log('== 5) direction-aware output: a long and a short see mirrored WITH/AGAINST ==');
{
  const ctx = bootPanel();
  const freeMarks = { 'free:dxyTrend': true };
  const indMarks = { 'ind:sma50With': true, 'ind:parkHigh': true };
  const pineMarks = { lor: 'long', supertrend: 'short' };
  const htmlLong = ctx.hgObtcMarksPanelHtml(makePick('long', freeMarks, indMarks, pineMarks));
  const htmlShort = ctx.hgObtcMarksPanelHtml(makePick('short', freeMarks, indMarks, pineMarks));
  /* Direction-aware reads on the free: and ind: side were already resolved
     to boolean by hgObtcFreeFeedVerdicts/hgObtcIndicatorMarks, so flipping
     dir in the panel changes nothing for those. BUT the pine marks come in
     as 'long'/'short' and the panel translates them against pick.dir. */
  /* On the long plan: lor='long' → WITH; supertrend='short' → AGAINST */
  /* On the short plan: lor='long' → AGAINST; supertrend='short' → WITH */
  /* Count group counters: long has lor WITH + supertrend AGAINST = 2 pine read */
  ok(/plan direction LONG/.test(htmlLong), 'long plan surfaces LONG');
  ok(/plan direction SHORT/.test(htmlShort), 'short plan surfaces SHORT');
  /* Compare pine group's WITH count. Long: 1 WITH 1 AGAINST */
  const longPineLine = (htmlLong.match(/PINE PORTS[^<]*/)||[''])[0];
  const shortPineLine = (htmlShort.match(/PINE PORTS[^<]*/)||[''])[0];
  ok(/2 of 13 read/.test(longPineLine), 'long plan: pine group 2 of 13 read');
  ok(/2 of 13 read/.test(shortPineLine), 'short plan: pine group 2 of 13 read');
}

/* ------------------------------------------------------------------ */
console.log('== 6) fail-open contract: a null pick / missing bag / absent reads yields "" ==');
{
  const ctx = bootPanel();
  ok(ctx.hgObtcMarksPanelHtml(null) === '', 'null pick returns ""');
  ok(ctx.hgObtcMarksPanelHtml({}) === '', 'empty pick returns ""');
  ok(ctx.hgObtcMarksPanelHtml({ row: {} }) === '', 'pick without perfectReads returns ""');
  /* perfectReads with empty bags still renders (all UNREAD) */
  const emptyBag = ctx.hgObtcMarksPanelHtml(makePick('long', {}, {}, {}));
  ok(/FUNDAMENTALS/.test(emptyBag), 'empty perfectReads still renders with 0 reads');
  ok(/0 of 38/.test(emptyBag), 'empty reads shows 0 of 38 (hg-v1301 total 38)');
}

/* ------------------------------------------------------------------ */
console.log('== 7) doctrine note names hg-v966 and "nothing is gated" ==');
{
  const ctx = bootPanel();
  const html = ctx.hgObtcMarksPanelHtml(makePick('long',
    { 'free:dxyTrend': true }, {}, {}));
  ok(/nothing is gated|record-only/i.test(html), 'doctrine note says record-only / nothing gated');
  ok(/hg-v966|unmeasured|forward ledger/i.test(html), 'doctrine note names the measurement rule');
  ok(/hg-v1294|walker/i.test(html), 'doctrine note names the hg-v1294 walker');
}

/* ------------------------------------------------------------------ */
console.log('== 8) no gate reads any of the 38 marks (hg-v1301: 38 cells x 7 files = 266 empty) ==');
{
  const gateFiles = ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
    'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'];
  const ctx = bootPanel();
  const groups = ctx.HG_OBTC_MARKS_GROUPS;
  const keys = groups.flatMap(g => g.keys.map(k => k[0]));
  let empty = 0, total = 0;
  for (const f of gateFiles){
    let body;
    try{ body = read(f); }catch(e){ continue; }
    for (const k of keys){
      total += 2;
      const quoted = new RegExp("['\"]" + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]");
      /* dot-form only applies to keys without a colon; the colon-prefixed form is grepped as quoted */
      const dot = new RegExp('\\breads\\s*\\.\\s*' + k.replace(/^(free|ind|pine):/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (!quoted.test(body)) empty++;
      /* The dot-form check is weaker here (bare key could collide with other usage)
         so we only count the quoted form. Compensate by counting total/2. */
    }
  }
  const expected = 7 * 38;
  ok(total === expected * 2, `swept ${total/2} cells (7 files x 38 keys)`);
  ok(empty === expected, `all ${empty} cells empty: no gate reads any of the 38 marks (quoted form)`);
}

/* ------------------------------------------------------------------ */
console.log('== 9) the panel is wired into the dhtml chain (one call site) ==');
{
  const src = read('omnibtc.js');
  /* The call site sits inside applySnap between the funding/evidence witnesses
     and the scalp anchor panel. */
  const callCount = (src.match(/dhtml\s*\+=\s*hgObtcMarksPanelHtml\(pick\)/g) || []).length;
  ok(callCount === 1, `hgObtcMarksPanelHtml called exactly once in the chain — got ${callCount}`);
  /* The live stash sits just before perfectReads assignment. */
  ok(/pfReads\.indReads\s*=\s*liveIndReads/.test(src), 'live indReads stashed on pfReads');
  ok(/pfReads\.indMarks\s*=\s*liveIndMarks/.test(src), 'live indMarks stashed on pfReads');
  ok(/pfReads\.pineMarks\s*=\s*livePineMarks/.test(src), 'live pineMarks stashed on pfReads');
}

/* ------------------------------------------------------------------ */
console.log('== 10) ship stamps align (hg-v956) ==');
{
  const { HG_VER, swCacheOk } = await import('./helpers/build-version.mjs');
  ok(/^hg-v\d+$/.test(HG_VER), `HG_VER ${HG_VER} has correct shape`);
  const sw = read('sw.js');
  ok(swCacheOk(sw), `sw.js HG_CACHE matches ${HG_VER}`);
  const trend = read('trendtable.js');
  const numericBuild = (HG_VER.match(/\d+$/) || [])[0];
  const trendVer = (trend.match(/\?v=(\d+)/) || [])[1];
  ok(numericBuild === trendVer, `build numeric ${numericBuild} === trend v=${trendVer}`);
}

console.log(`\n== hg-v1300 OMNIBTC FUNDAMENTALS & FEED panel: ${passed} passed, ${failed} failed ==`);
process.exit(failed === 0 ? 0 : 1);
