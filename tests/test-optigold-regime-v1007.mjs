/* HARDGATE — hg-v1007: OPTI GOLD answers to the HOUSE REGIME.

   Run: node tests/test-optigold-regime-v1007.mjs

   THE HOLE THIS CLOSES
   --------------------
   A breakout rule and a mean-reversion rule have OPPOSITE expectancy in the
   same market, and until this pack every gold desk ran its one style in all
   weather: OPTI GOLD placed break-of-structure limits in a compressed or
   ranging tape — the population where breaks fade — and nothing anywhere
   could say "the house regime is against my style", because there was no
   house regime. regime.js answers a different question (market-wide risk
   appetite off BTC, DXY and yields) and stays untouched.

   regime-stack.js reads the GOLD TAPE ITSELF: hgGoldRegime(rows4h) is a pure
   read built from indicators.js primitives only (detectRegime owns the
   volatility/compression/structure call; the trend state uses detectRegime's
   own ADX-30 bar with direction from the close beyond a sloping EMA-50;
   cascadeAge is evidence). hgRegimePosture maps desk style x regime x
   direction: only 'against' may ever bar a TOP PICK slot, and only the
   BREAKOUT style is mapped — other styles land with their own desks.
   optigold.js computes the regime from the SWING lane's own 4h rows (no
   extra fetch), stamps every lane's setups through hgRegimeScanCands, bars
   AGAINST setups from the headline slots (ogRegimeBlocked, beside the v1005
   and v1006 exclusions — the setup still renders, chipped, reason named),
   and writes row.regime into the forward ledger so the book can later
   measure whether regime-aligned breaks pay better — on evidence.

   The tapes below are deterministic and every number was derived by running
   the real indicators on them, never asserted blind: a persistent grind
   (ADX 100), a wide-wick overlapping tape with tiny alternating closes
   (ADX ~3.7, RANGE), a geometrically shrinking tape (COMPRESSION), and a
   40-bar thin tape (UNREADABLE). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok —', m); }
                       else { failed++; console.error('  FAIL —', m); } };

function boot(opts){
  opts = opts || {};
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.document = { createElement: () => ({ style: {}, appendChild(){}, addEventListener(){} }),
                   querySelector: () => null, addEventListener(){} };
  vm.createContext(ctx);
  if (opts.ind !== false){
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'indicators.js'), 'utf8'), ctx, { filename: 'indicators.js' });
  }
  if (opts.regime !== false){
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'regime-stack.js'), 'utf8'), ctx, { filename: 'regime-stack.js' });
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8'), ctx, { filename: 'optigold.js' });
  return ctx;
}

/* ---- the deterministic tapes the numbers above were derived on ---- */
function grindUp(){
  const rows = []; let t = 1700000000, c = 100;
  for (let i = 0; i < 120; i++){ const o = c; c = c + 0.55;
    rows.push({ t: (t += 14400), o, h: c + 0.1, l: o - 0.1, c, v: 100 }); }
  return rows;
}
function grindDn(){
  const rows = []; let t = 1700000000, c = 200;
  for (let i = 0; i < 120; i++){ const o = c; c = c - 0.55;
    rows.push({ t: (t += 14400), o, h: o + 0.1, l: c - 0.1, c, v: 100 }); }
  return rows;
}
function wideWick(){                                   /* overlapping ±3 wicks, tiny alternating closes */
  const rows = []; let t = 1700000000, c = 100;
  for (let i = 0; i < 120; i++){
    const cc = c + (i % 2 ? 0.05 : -0.05);
    rows.push({ t: (t += 14400), o: c, h: cc + 3.0, l: cc - 3.0, c: cc, v: 100 });
    c = cc;
  }
  return rows;
}
function geoShrink(){                                  /* amplitude decays 3% per bar — BB width collapsing */
  const rows = []; let t = 1700000000, c = 100;
  for (let i = 0; i < 120; i++){
    const amp = 1.5 * Math.pow(0.97, i);
    const cc = c + (i % 2 ? amp * 0.2 : -amp * 0.2);
    rows.push({ t: (t += 14400), o: c, h: cc + amp, l: cc - amp, c: cc, v: 100 });
    c = cc;
  }
  return rows;
}
const mk = (lane, entry, extra) => Object.assign(
  { state: 'waiting', lane, dir: 'long', entry, stop: entry - 5,
    t1: entry + 10, risk: 5, rr: 2, atr: 2, barsLeft: 30 }, extra || {});

const W = boot({});

/* Safe wrappers: on the PRE-FIX tree the desk seams do not exist, and a bare
   call would throw the suite dead instead of counting its failures. The
   wrappers return the absence answers so the run stays readable — the typeof
   asserts record the missing seams, and every behavior assert fails on the
   absence answer. */
const GR = (...a) => (typeof W.hgGoldRegime === 'function') ? W.hgGoldRegime(...a) : null;
const PO = (...a) => (typeof W.hgRegimePosture === 'function') ? W.hgRegimePosture(...a) : null;
const SC = (...a) => (typeof W.hgRegimeScanCands === 'function') ? W.hgRegimeScanCands(...a) : 0;
const CH = (...a) => (typeof W.hgRegimeChipHtml === 'function') ? W.hgRegimeChipHtml(...a) : '';
const PA = (...a) => (typeof W.hgRegimePanelHtml === 'function') ? W.hgRegimePanelHtml(...a) : '';
const B  = (s) => (typeof W.__ogRegimeBlocked === 'function') ? W.__ogRegimeBlocked(s) : false;
const OCH = (s) => (typeof W.__ogRegimeChipHtml === 'function') ? W.__ogRegimeChipHtml(s) : '';

console.log('== the seams exist — module and desk ==');
{
  ok(typeof W.hgGoldRegime === 'function', 'hgGoldRegime exported');
  ok(typeof W.hgRegimePosture === 'function', 'hgRegimePosture exported');
  ok(typeof W.hgRegimeScanCands === 'function', 'hgRegimeScanCands exported');
  ok(typeof W.hgRegimeChipHtml === 'function', 'hgRegimeChipHtml exported');
  ok(typeof W.hgRegimePanelHtml === 'function', 'hgRegimePanelHtml exported');
  ok(typeof W.__ogRegimeBlocked === 'function', '__ogRegimeBlocked exported');
  ok(typeof W.__ogRegimeChipHtml === 'function', '__ogRegimeChipHtml exported');
  const reg = (W.HG_tabs || []).find(t => t && t.id === 'optigold');
  ok(!!reg && reg.regimeBlocked === W.__ogRegimeBlocked,
     'the registration carries the seam, like the v1005/v1006 seams beside it');
}

console.log('== hgGoldRegime: the truth table on tuned tapes ==');
{
  const up = GR(grindUp());
  ok(!!up && up.state === 'trend' && up.dir === 'up', 'a persistent grind is TREND UP');
  ok(!!up && up.adx >= 30, 'ADX ' + (up && up.adx ? up.adx.toFixed(0) : '?') + ' clears detectRegime\'s own 30 bar');
  ok(!!up && up.label === 'TREND UP' && typeof up.line === 'string' && up.line.indexOf('ADX') >= 0,
     'the label and the evidence line say what was read');
  ok(!!up && typeof up.cascadeLong === 'number' && up.cascadeLong > 0, 'the ribbon age rides as evidence');
  const dn = GR(grindDn());
  ok(!!dn && dn.state === 'trend' && dn.dir === 'down', 'the mirror grind is TREND DOWN');
  const rg = GR(wideWick());
  ok(!!rg && rg.state === 'range', 'overlapping wide wicks with tiny closes are RANGE');
  const cp = GR(geoShrink());
  ok(!!cp && cp.state === 'compression', 'a geometrically shrinking tape is COMPRESSION');
  const thin = GR(grindUp().slice(0, 40));
  ok(!!thin && thin.state === 'unreadable' && /fewer than 60/.test(thin.why || ''),
     'fewer than 60 closed 4h bars is UNREADABLE, with the reason named');
  for (const bad of [null, undefined, 0, 'x', NaN, {}]){
    const r = GR(bad);
    ok(!!r && r.state === 'unreadable', 'rows ' + JSON.stringify(bad) + ' -> unreadable, never a fabricated regime');
  }
  const junk = GR(Array.from({ length: 120 }, () => ({ t: 1, o: 'x', h: null, l: undefined, c: NaN, v: {} })));
  ok(!!junk && typeof junk.state === 'string',
     'a junk tape never throws — a state string comes back and only AGAINST could ever bar');
  ok(!junk || junk.state !== 'trend', 'and junk can never read as a confident TREND');
}

console.log('== honest degradation: no indicator library, no regime ==');
{
  const W2 = boot({ ind: false });
  const r = W2.hgGoldRegime(grindUp());
  ok(!!r && r.state === 'unreadable' && /indicator library/.test(r.why || ''),
     'with indicators.js absent the regime is UNREADABLE — never inferred from nothing');
  ok(typeof W2.hgRegimePosture === 'function'
      && W2.hgRegimePosture('breakout', r, 'long').posture === 'unreadable',
     'and an unreadable regime has an unreadable posture — it bars nothing');
}

console.log('== hgRegimePosture: only AGAINST may ever bar ==');
{
  const trendUp = { state: 'trend', dir: 'up' }, trendDn = { state: 'trend', dir: 'down' };
  ok(PO('breakout', trendUp, 'long').posture === 'favored', 'a with-trend break is FAVORED');
  ok(PO('breakout', trendDn, 'short').posture === 'favored', 'FAVORED is symmetric');
  ok(PO('breakout', trendUp, 'short').posture === 'caution', 'a counter-trend break is CAUTION — informed, not barred');
  ok(PO('breakout', trendDn, 'long').posture === 'caution', 'CAUTION is symmetric');
  ok(PO('breakout', { state: 'trend', dir: null }, 'long').posture === 'neutral',
     'a trend without a readable direction is NEUTRAL');
  ok(PO('breakout', { state: 'range' }, 'long').posture === 'against', 'RANGE is AGAINST — the population where breaks fade');
  ok(PO('breakout', { state: 'range' }, 'short').posture === 'against', 'AGAINST is direction-blind in a range');
  ok(PO('breakout', { state: 'compression' }, 'short').posture === 'against', 'COMPRESSION is AGAINST — breaks starve for range');
  ok(PO('breakout', { state: 'volatile' }, 'long').posture === 'caution', 'VOLATILE EXPANSION is CAUTION — stops get run, not barred');
  ok(PO('breakout', { state: 'weak' }, 'long').posture === 'neutral', 'a weak tape is NEUTRAL — the regime does not speak');
  ok(PO('meanrev', trendUp, 'long').posture === 'unreadable',
     'an unmapped style reads UNREADABLE rather than guessing — other styles land with their own desks');
  ok(PO('breakout', { state: 'unreadable', why: 'thin' }, 'long').posture === 'unreadable',
     'an unreadable regime stays unreadable, with the reason');
  ok(PO('breakout', null, 'long').posture === 'unreadable' && PO(null, null, null).posture === 'unreadable',
     'junk in, unreadable out — never a fabricated bar');
  ok(PO('breakout', trendUp, 'sideways').posture === 'neutral',
     'a setup without a direction is not favored and not barred');
}

console.log('== the scan seam: stamps directions, invents none ==');
{
  const rg = GR(wideWick());
  const cands = [{ dir: 'long' }, { dir: 'short' }, { nodir: true }, null, 'x'];
  const n = SC(cands, { style: 'breakout', regime: rg });
  ok(n === 2, 'two candidates carried a direction, two were stamped');
  ok(cands[0].regime && cands[0].regime.posture === 'against', 'a RANGE stamp on a long break is AGAINST');
  ok(cands[1].regime && cands[1].regime.posture === 'against', 'and on a short — the range bars both ways');
  ok(!('regime' in cands[2]), 'a candidate without a direction acquires no fabricated verdict');
  ok(SC(null, { style: 'breakout', regime: rg }) === 0 && SC(cands, null) === 0
      && SC(cands, { style: 'breakout' }) === 0,
     'junk arguments stamp nothing and return 0');
  const up = GR(grindUp());
  const c2 = [{ dir: 'long' }, { dir: 'short' }];
  SC(c2, { style: 'breakout', regime: up });
  ok(c2[0].regime.posture === 'favored' && c2[1].regime.posture === 'caution',
     'TREND UP stamps the with-trend break FAVORED and the counter-trend one CAUTION');
}

console.log('== the chip and the panel ==');
{
  ok(CH({ posture: 'favored' }).indexOf('REGIME WITH IT') >= 0, 'FAVORED wears REGIME WITH IT');
  ok(CH({ posture: 'caution' }).indexOf('REGIME CAUTION') >= 0, 'CAUTION wears REGIME CAUTION');
  const ca = CH({ posture: 'against' });
  ok(ca.indexOf('REGIME AGAINST') >= 0 && ca.indexOf('never a TOP PICK') >= 0,
     'AGAINST says what it costs, on the chip');
  ok(CH({ posture: 'neutral' }) === '' && CH({ posture: 'unreadable' }) === '' && CH(null) === '' && CH({}) === '',
     'neutral and unreadable wear nothing — the panel says it once, not once per card');
  const up = GR(grindUp());
  const p = PA(up);
  ok(p.indexOf('HOUSE REGIME (4h)') >= 0 && p.indexOf('TREND UP') >= 0, 'the board panel names the read');
  const pu = PA({ state: 'unreadable', why: 'thin tape' });
  ok(pu.indexOf('HOUSE REGIME UNREADABLE') >= 0 && pu.indexOf('thin tape') >= 0,
     'an unreadable regime is honest on the panel, with its reason');
  ok(pu.indexOf('No setup is favored or barred') >= 0, 'and says that it bars nothing');
  ok(PA(null) === '', 'no regime, no panel');
}

console.log('== the desk predicate: only AGAINST blocks ==');
{
  ok(B(null) === false && B({}) === false, 'an unstamped setup is never blocked (backward compat)');
  ok(B({ regime: { posture: 'favored' } }) === false
      && B({ regime: { posture: 'neutral' } }) === false
      && B({ regime: { posture: 'caution' } }) === false
      && B({ regime: { posture: 'unreadable' } }) === false,
     'favored, neutral, caution and unreadable all inform — none bar');
  ok(B({ regime: { posture: 'against' } }) === true, 'and AGAINST always does');
}

console.log('== the picks: AGAINST never leads, whatever it scores ==');
{
  const T = W.__ogTopPicks;
  const ag = mk('scalp', 99, { regime: { posture: 'against', why: 'ranging' } });
  const clean = mk('scalp', 99.5, {});
  ok(T([ag, clean], 100).scalp.setup === clean,
     'an AGAINST break loses the slot to the unstamped one behind it');
  ok(T([ag], 100).scalp === null,
     'a lane whose only setup is AGAINST has NO pick — the slot stays empty rather than leading with it');
  const cau = mk('scalp', 99, { regime: { posture: 'caution', why: 'volatile' } });
  ok(T([cau], 100).scalp.setup === cau, 'CAUTION stays eligible — the regime informs, it does not bar');
  const fav = mk('scalp', 99, { regime: { posture: 'favored', why: 'with it' } });
  ok(T([fav], 100).scalp.setup === fav, 'FAVORED stays eligible');
  const agSwing = mk('swing', 97, { regime: { posture: 'against', why: 'compressed' } });
  const both = T([ag, agSwing], 100);
  ok(both.scalp === null && both.swing === null, 'the regime bars both headline lanes alike');
}

console.log('== the desk chip is feature-checked — no module, no chip, predicate still pure ==');
{
  const W3 = boot({ regime: false });           /* indicators, no regime-stack.js */
  /* the same safe-wrapper rule as the top of the suite: on the pre-fix tree
     these exports do not exist and a bare call would throw the run dead
     instead of counting the failure */
  const C3 = (s) => (typeof W3.__ogRegimeChipHtml === 'function') ? W3.__ogRegimeChipHtml(s) : '';
  const B3 = (s) => (typeof W3.__ogRegimeBlocked === 'function') ? W3.__ogRegimeBlocked(s) : false;
  ok(typeof W3.hgGoldRegime === 'undefined', 'the module is genuinely absent in this boot');
  ok(C3({ regime: { posture: 'against', why: 'x' } }) === '' && typeof W3.__ogRegimeChipHtml === 'function',
     'the desk chip prints nothing without the shared renderer (and exists to make that choice)');
  ok(B3({ regime: { posture: 'against' } }) === true,
     'but the predicate is local and still reads the stamp — module absent means unstamped, not unenforced');
  ok(W3.__ogTopPicks([mk('scalp', 99, {})], 100).scalp !== null,
     'and with no stamps at all the picks behave exactly as before the pack');
  const live = OCH({ regime: { posture: 'against', why: 'ranging' } });
  ok(live.indexOf('REGIME AGAINST') >= 0, 'with the module loaded the desk chip renders the shared words');
  ok(OCH({}) === '' && OCH(null) === '', 'an unstamped setup wears no chip');
}

console.log('== the forward ledger carries the posture ==');
{
  const rows = grindUp();
  const s = mk('scalp', 100, { i: 55, regime: { posture: 'against', why: 'ranging' } });
  const out = W.__ogFwdRows([s], 'scalp', rows, 'test');
  ok(out.length === 1 && out[0].regime === 'against', 'a stamped live setup logs its posture');
  const bare = W.__ogFwdRows([mk('scalp', 100, { i: 55 })], 'scalp', rows, 'test');
  ok(bare.length === 1 && !('regime' in bare[0]), 'an unstamped setup invents none');
  ok(out[0].mechanic === 'BOS-RETRACE-SCALP-LONG',
     'and the mechanic string is untouched — grouping stays continuous with every row already logged');
}

console.log('== wiring: the regime is on the real path, not a parallel copy ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8');
  ok(/cfg\.key === 'swing'/.test(src) && /W\.hgGoldRegime/.test(src),
     'the scan reads the regime from the SWING lane\'s own 4h rows — no extra fetch');
  ok(/hgRegimeScanCands[\s\S]{0,200}style: 'breakout'|style: 'breakout'[\s\S]{0,200}hgRegimeScanCands|ogRsFn\(ogAllR, \{ style: 'breakout', regime: ogRegime \}\)/.test(src),
     'and stamps every lane\'s setups through the shared seam as the BREAKOUT style');
  ok(/if \(ogRegimeBlocked\(s\)\) return;/.test(src),
     'ogTopPicks reads the predicate — the exclusion is the tested one');
  ok(/smcChip \+ fundChip \+ confChip \+ regimeChip/.test(src), 'the chip is actually on the card\'s chip row');
  ok(/row\.regime = s\.regime\.posture/.test(src),
     'the posture rides the forward ledger, so the regime can be judged on outcomes later');
  ok(/opts\.regime/.test(src) && /hgRegimePanelHtml/.test(src), 'the board panel renders above the scan output');
  ok(/regimeBlocked: ogRegimeBlocked/.test(src), 'the registration carries the seam');
  ok(/house regime<\/b> \(hg-v1007\)/.test(src), 'the TOP PICKS note states the regime to the reader');
  ok(/hg-v1007: the desk answers to the HOUSE REGIME/.test(src), 'the file header documents the pack');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<script src="regime-stack\.js\?v=\d+"><\/script>/.test(idx), 'index.html loads the module');
  ok(idx.indexOf('fundamental-stack.js') >= 0 && idx.indexOf('regime-stack.js') > idx.indexOf('fundamental-stack.js'),
     'and it loads beside the fundamental stack it stands next to');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(sw.indexOf("'./regime-stack.js'") >= 0, 'the service worker precaches it — the offline shell covers the desk');
}

console.log('\ntest-optigold-regime-v1007: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
