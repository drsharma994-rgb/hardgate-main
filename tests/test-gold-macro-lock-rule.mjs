/* HARDGATE — hg-v966: the gold macro kill ran a DIFFERENT RULE than the one it
   documented, and the read it documented had never run at all.

   hgGoldMacroLock is the gold-native kill: the dollar and the 10-year both
   bullish stands a gold LONG down. It offers two reads of "bullish":

     * hgGoldEma50Above -- a LEVEL test, last close above its own EMA50
     * the trend20 fallback -- a 20-day CHANGE band (DXY > 0.3%, TNX > 2%)

   Both call sites of the first sit behind ctx.dxyRows / ctx.tnxRows, and
   getGoldMacro() -- the only macro supplier on every gold desk -- returned
   NEITHER. So the documented read was unreachable and the band was the rule in
   force, while goldind.js, AGENTS.md and the card all named EMA50.

   THE NAIVE FIX IS A TRAP, and that is the finding. Simply supplying the feed
   would have handed the verdict to EMA50 on every gold desk, because the old
   chain preferred rows wherever they existed -- switching the gold-long kill
   from a change band to a level test with nobody deciding that. Measured on a
   constructed grid: 4,360 of 39,240 verdicts move that way.

   So the feed is supplied AND the rule in force decides alone. The level test
   is computed and its DISAGREEMENT reported, so a machine that can fetch has
   the measurement this environment cannot make (403 CONNECT on every route, no
   DXY or TNX series committed). HG_GOLD_MACRO_RULE is the one lever.

   Covers:
     1) the rule in force, and the lever
     2) the close-only defect that would have kept the read dead anyway
     3) DIFFERENTIAL: supplying the feed moves no verdict
     4) the two rules disagree in BOTH directions
     5) the measurement survives the unchecked return
     6) the note -- a reader for a field nothing read
     7) macro.js supplies the series, and fails open
     8) the rule in force is NOT moved by this pack
   Run: node tests/test-gold-macro-lock-rule.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of files){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch(e){ /* reported below */ }
  }
  return ctx;
}
const GI = ['indicators.js', 'indicators2.js', 'goldind.js'];

/* a close-only series, as a macro index genuinely is */
function ser(step, n){ const r = []; let c = 100; for (let i = 0; i < n; i++){ c += step; r.push({ t: i, c: +c.toFixed(4) }); } return r; }
const UP = ser(0.5, 85), DOWN = ser(-0.5, 85);
const JUNK = Array.from({ length: 60 }, (_, i) => ({ t: i, c: NaN }));
const SHORT = ser(0.5, 10);

console.log('== 1) the rule in force, and the lever ==');
{
  const W = boot(GI);
  assert(typeof W.hgGoldMacroLock === 'function', 'hgGoldMacroLock is exported');
  assert(typeof W.hgGoldMacroRule === 'function' && W.hgGoldMacroRule() === 'trend20',
         'the rule IN FORCE is the 20-day trend band, not the EMA50 level test');
  const src = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  assert(/var HG_GOLD_MACRO_RULE = 'trend20';/.test(src),
         'and it is a named constant, so switching it is one line and visible');

  /* the lever really switches which read decides */
  const lockedByBand = W.hgGoldMacroLock('long', { dxyRows: DOWN, tnxRows: DOWN,
    macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } });
  assert(lockedByBand.lock === true && lockedByBand.dxyVia === 'trend20',
         'by default the BAND decides, even with a readable series present');
  W.HG_GOLD_MACRO_RULE = 'ema50';
  const lockedByEma = W.hgGoldMacroLock('long', { dxyRows: DOWN, tnxRows: DOWN,
    macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } });
  assert(lockedByEma.lock === false && lockedByEma.dxyVia === 'ema50',
         'with the lever on ema50 the LEVEL test decides, and here it declines to lock');
  /* and under the lever a corrupt series falls back rather than refusing */
  const fellBack = W.hgGoldMacroLock('long', { dxyRows: JUNK, tnxRows: JUNK,
    macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } });
  assert(fellBack.dxyVia === 'trend20' && fellBack.lock === true,
         'and an unreadable series falls back to the band — a corrupt feed is not a reason to refuse a question the other feed answers');
  W.HG_GOLD_MACRO_RULE = undefined;
  assert(W.hgGoldMacroRule() === 'trend20', 'clearing the lever restores the rule in force');
  /* actually SET a junk value: the first cut asserted this while the lever was
     undefined, which any fallback satisfies, so a mutation obeying junk
     survived. A whitelist is only testable against something off the list. */
  W.HG_GOLD_MACRO_RULE = 'banana';
  assert(W.hgGoldMacroRule() === 'trend20',
         'a junk lever value is IGNORED rather than obeyed — the lever is a whitelist, not a passthrough');
  W.HG_GOLD_MACRO_RULE = 'ema50';
  assert(W.hgGoldMacroRule() === 'ema50', 'and a value ON the whitelist is honoured');
  W.HG_GOLD_MACRO_RULE = undefined;
}

console.log('== 2) the close-only defect that would have kept the read dead ==');
{
  const W = boot(GI);
  assert(typeof W.hgGoldEma50Above === 'function',
         'hgGoldEma50Above is exported — it was unreachable from outside, part of why nobody saw it was dead');
  assert(W.hgGoldEma50Above(UP) === true && W.hgGoldEma50Above(DOWN) === false,
         'it reads a CLOSE-ONLY series — a DXY computed from FX rates has no open, high or low');
  assert(W.hgGoldEma50Above(SHORT) === null, 'too short a series yields no verdict');
  assert(W.hgGoldEma50Above(JUNK) === null, 'an unreadable series yields no verdict, never a guessed false');
  assert(W.hgGoldEma50Above(null) === null && W.hgGoldEma50Above([]) === null,
         'absent or empty yields no verdict');
  /* a real candle series still works, and the STRICT normaliser is untouched */
  const candles = UP.map(r => ({ t: r.t, o: r.c, h: r.c + 1, l: r.c - 1, c: r.c }));
  assert(W.hgGoldEma50Above(candles) === true, 'and an ordinary OHLC series still reads');
  /* A MIXED series is where a filtering normaliser and a passthrough genuinely
     differ: filtering leaves 85 good closes and a verdict, passing everything
     through poisons the EMA with NaN and yields none. Without this case a
     mutation dropping the finiteness check survived, because every all-NaN
     input is caught downstream anyway. */
  const MIXED = UP.concat(Array.from({ length: 20 }, (_, i) => ({ t: 900 + i, c: NaN })));
  assert(W.hgGoldEma50Above(MIXED) === true,
         'a series with some unreadable rows still reads, from the rows that ARE readable');
  const src = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  assert(/function __rowOk\(r\)\{\s*\n\s*return !!r && isFinite\(__fin\(r\.o\)\)/.test(src),
         'the strict o/h/l/c row check is NOT loosened — the close-only path is a separate normaliser');
}

console.log('== 3) DIFFERENTIAL: supplying the feed moves no verdict ==');
{
  const W = boot(GI);
  /* the function hg-v966 replaced, verbatim. BEFORE = it, with rows ABSENT
     (what every gold desk ran). AFTER = the shipped one, with rows SUPPLIED
     (what it runs once macro.js feeds it). */
  function OLD(dir, c, ema50){
    var out = { lock: false, dxyBull: null, tnxBull: null, unchecked: false };
    try{
      if (dir !== 'long') return out; c = c || {};
      var d = null, t = null;
      if (c.dxyRows && c.dxyRows.length >= 52) d = ema50(c.dxyRows);
      else if (c.macro && c.macro.dxy && c.macro.dxy.trend20 === 'RISING') d = true;
      else if (c.macro && c.macro.dxy && c.macro.dxy.trend20 === 'FALLING') d = false;
      else if (c.macro && c.macro.trend20 === 'RISING') d = true;
      else if (c.macro && c.macro.trend20 === 'FALLING') d = false;
      if (c.tnxRows && c.tnxRows.length >= 52) t = ema50(c.tnxRows);
      else if (c.macro && c.macro.tnxTrend === 'RISING') t = true;
      else if (c.macro && c.macro.tnxTrend === 'FALLING') t = false;
      out.dxyBull = d; out.tnxBull = t;
      if (d == null && t == null){ out.unchecked = true; return out; }
      if (d === true && t === true) out.lock = true;
      return out;
    }catch(e){ out.unchecked = true; return out; }
  }
  const ema50 = W.hgGoldEma50Above;
  const TR = [undefined, null, 'RISING', 'FALLING', 'FLAT', 'JUNK'];
  const macros = [];
  for (const d of TR) for (const t of TR) for (const top of TR){
    const m = {};
    if (d !== undefined) m.dxy = { trend20: d };
    if (t !== undefined) m.tnxTrend = t;
    if (top !== undefined) m.trend20 = top;
    macros.push(m);
  }
  macros.push(null);
  const ROWSETS = [null, UP, DOWN, JUNK, SHORT];
  let n = 0, diff = 0, before = 0, after = 0;
  for (const m of macros) for (const dR of ROWSETS) for (const tR of ROWSETS){
    const a = OLD('long', { macro: m }, ema50);
    const b = W.hgGoldMacroLock('long', { macro: m, dxyRows: dR, tnxRows: tR });
    n++; if (a.lock) before++; if (b.lock) after++;
    if (!(a.lock === b.lock && a.dxyBull === b.dxyBull && a.tnxBull === b.tnxBull && a.unchecked === b.unchecked)) diff++;
  }
  assert(n > 5000, 'the grid is real (' + n + ' cases)');
  assert(before > 0, 'and the OLD function DID lock on it (' + before + ') — a grid with no locks would prove nothing');
  assert(diff === 0,
         'SUPPLYING THE FEED MOVES NO VERDICT — ' + before + ' locks before, ' + after + ' after, ' + diff + ' differences');

  /* and the naive fix really would have moved them — the trap, demonstrated */
  let naive = 0;
  for (const m of macros) for (const dR of ROWSETS) for (const tR of ROWSETS){
    const a = OLD('long', { macro: m }, ema50);
    const bad = OLD('long', { macro: m, dxyRows: dR, tnxRows: tR }, ema50);
    if (a.lock !== bad.lock || a.dxyBull !== bad.dxyBull || a.tnxBull !== bad.tnxBull) naive++;
  }
  assert(naive > 0,
         'while the NAIVE fix — feed the rows, leave the chain alone — moves ' + naive
         + ' verdicts, which is the trap this pack exists to avoid');
}

console.log('== 4) the two rules disagree in BOTH directions ==');
{
  const W = boot(GI);
  /* EMA50 bullish while the band is FLAT */
  const a = W.hgGoldMacroLock('long', { dxyRows: UP, tnxRows: UP,
    macro: { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' } });
  assert(a.lock === false && a.altLock === true && a.altAgrees === false,
         'a market above its EMA50 but flat over 20 days: the band does NOT lock, the level test WOULD');
  /* EMA50 not bullish while the band is RISING */
  const b = W.hgGoldMacroLock('long', { dxyRows: DOWN, tnxRows: DOWN,
    macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } });
  assert(b.lock === true && b.altLock === false && b.altAgrees === false,
         'and one below its EMA50 but rising over 20 days: the band LOCKS, the level test would not');
  assert(a.dxyLeg.agree === null && b.dxyLeg.agree === false,
         'per-leg agreement is null where a read is missing and false where the two genuinely differ');
  /* they agree when they agree */
  const c = W.hgGoldMacroLock('long', { dxyRows: UP, tnxRows: UP,
    macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } });
  assert(c.lock === true && c.altLock === true && c.altAgrees === true,
         'and when both reads say bullish they agree — the reporter is not stuck on "disagree"');
}

console.log('== 5) the measurement survives the unchecked return ==');
{
  const W = boot(GI);
  /* the band silent, the level test clear: the case where the rules are
     furthest apart, and the one an early return threw away in the first cut */
  const m = W.hgGoldMacroLock('long', { dxyRows: UP, tnxRows: UP,
    macro: { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' } });
  assert(m.unchecked === true, 'the band cannot answer, so the verdict is UNCHECKED — fail open, as before');
  assert(m.altLock === true && m.altAgrees === false,
         'and the measurement is STILL captured — computed before the unchecked return, not after it');
  assert(m.lock === false, 'nothing is locked on it');
}

console.log('== 6) a reader for a field nothing read ==');
{
  const W = boot(GI);
  assert(typeof W.hgGoldMacroLockNote === 'function',
         'cand.macroLock was written and read by NOTHING — this is the reader (hg-v955 shape)');
  assert(W.hgGoldMacroLockNote(null) === '' && W.hgGoldMacroLockNote({}) === '',
         'it renders NOTHING without a verdict, rather than a zero-filled line');
  const locked = W.hgGoldMacroLock('long', { macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } });
  /* the REASON string is what reaches cand.reason and therefore the card when
     the lock fires -- the note is a second surface, and asserting only the
     note let a mutation strip the read out of the reason unnoticed */
  assert(/CONVICTION LOCK/.test(locked.reason) && /20-day trend band/.test(locked.reason),
         'the lock REASON itself names the read that decided it, not just the note');
  const n1 = W.hgGoldMacroLockNote(locked);
  assert(/MACRO LOCK/.test(n1) && /20-day trend band/.test(n1),
         'a lock names the read that decided it');
  assert(!/EMA50 level/.test(n1), 'and does not claim a read it did not make');
  const ema = W.hgGoldMacroLock('long', { dxyRows: DOWN, tnxRows: DOWN,
    macro: { dxy: { trend20: 'RISING' }, tnxTrend: 'RISING' } });
  const n2 = W.hgGoldMacroLockNote(ema);
  assert(/other rule in this file disagrees/.test(n2) && /NOT measured here/.test(n2),
         'a disagreement is named, and the note refuses to say which rule is better');
  const unchecked = W.hgGoldMacroLockNote(W.hgGoldMacroLock('long', {}));
  assert(/MACRO UNCHECKED/.test(unchecked) && /fail open/.test(unchecked),
         'and an unreadable macro says so, naming that it fails open');
  assert(W.hgGoldMacroLockNote({ unchecked: false, dxyBull: null, tnxBull: null }) === '',
         'a short direction, which is never locked, renders nothing');
}

console.log('== 7) macro.js supplies the series, and fails open ==');
{
  const ctx = boot([]);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'macro.js'), 'utf8'), ctx, { filename: 'macro.js' });
  assert(typeof ctx.getDXYRows === 'function' && typeof ctx.getTNXRows === 'function',
         'getGoldMacro can now obtain the series the EMA50 read needs');

  const rates = {}; const day = 86400000, end = Date.UTC(2026, 8, 25);
  for (let i = 200; i >= 0; i--){
    const d = new Date(end - i * day);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const k = d.toISOString().slice(0, 10), drift = 1 + (200 - i) * 0.0004;
    rates[k] = { EUR: 0.92 * drift, JPY: 150 * drift, GBP: 0.79 * drift,
                 CAD: 1.36 * drift, SEK: 10.5 * drift, CHF: 0.88 * drift };
  }
  ctx.__macroFetchJson = async () => ({ rates });
  ctx.__yahooLastClose = async () => Array.from({ length: 260 },
    (_, i) => ({ t: Math.floor((end - (260 - i) * day) / 1000), c: 41 + i * 0.02 }));

  const dxyRows = await ctx.getDXYRows(270);
  assert(!!dxyRows && dxyRows.length > 52,
         'the DXY series comes back long enough for an EMA50 (' + (dxyRows && dxyRows.length) + ' points)');
  /* Number.isFinite, NOT isFinite: isFinite(null) is TRUE because +null === 0,
     so the coercing form waves through a fabricated null close. That trap has
     now bitten this codebase eight times, twice in guards written to catch it. */
  assert(dxyRows.every(r => r.o === undefined && Number.isFinite(r.c) && Number.isFinite(r.t)),
         'and it is CLOSE-ONLY — no fabricated open, high or low');

  /* a date the rate map cannot price must be SKIPPED, not carried as a null
     close. Exercised deliberately: the clean fixture never reaches that branch,
     so a mutation deleting it survived. */
  const holed = JSON.parse(JSON.stringify(rates));
  const keys = Object.keys(holed).sort();
  holed[keys[5]] = { EUR: null };
  holed[keys[6]] = {};
  ctx.__macroCacheGet = () => undefined;
  ctx.__macroFetchJson = async () => ({ rates: holed });
  const holedRows = await ctx.getDXYRows(270);
  assert(!!holedRows && holedRows.length === dxyRows.length - 2,
         'two unpriceable dates are DROPPED, not carried (' + (holedRows && holedRows.length) + ' vs ' + dxyRows.length + ')');
  assert(holedRows.every(r => Number.isFinite(r.c)), 'and every surviving point has a real close');

  /* a response that parses but yields NOTHING usable is null, not [] -- an
     empty array is a series, and goldind would read it as "too short" rather
     than "absent", which is a different thing to report */
  ctx.__macroCacheGet = () => undefined;
  ctx.__macroFetchJson = async () => ({ rates: {} });
  assert(await ctx.getDXYRows(270) === null,
         'a response with no usable points yields null, never an empty series');
  ctx.__macroCacheGet = () => undefined;
  ctx.__macroFetchJson = async () => ({ rates });
  const tnxRows = await ctx.getTNXRows('1y');
  assert(!!tnxRows && tnxRows.length > 52, 'the TNX series comes back too (' + (tnxRows && tnxRows.length) + ')');
  assert(tnxRows[0].c < 20,
         'and is x10-normalised to match the scalar leg — a series disagreeing with its own scalar is a trap');

  /* goldind can actually read what macro.js produces — the join, not two halves */
  const W = boot(GI);
  assert(W.hgGoldEma50Above(dxyRows) !== null && W.hgGoldEma50Above(tnxRows) !== null,
         'and goldind READS them — the two halves join, which a close-only rejection would have silently broken');

  /* THE JOIN: getGoldMacro must actually carry them. Asserting the two
     fetchers in isolation proves the RULE and not that the supplier calls it --
     the hg-v964 gap -- and mutations cutting both calls out of getGoldMacro
     survived until this drove the real supplier. */
  ctx.__macroCacheGet = () => undefined;
  const macro = await ctx.getGoldMacro();
  assert(!!macro && typeof macro === 'object', 'getGoldMacro returns its dashboard');
  assert(!!macro.dxyRows && macro.dxyRows.length > 52,
         'and it CARRIES the DXY series (' + (macro.dxyRows && macro.dxyRows.length) + ' points)');
  assert(!!macro.tnxRows && macro.tnxRows.length > 52,
         'and the TNX series (' + (macro.tnxRows && macro.tnxRows.length) + ' points)');
  const WJ = boot(GI);
  assert(WJ.hgGoldMacroLock('long', { macro: macro }).dxyLeg.ema50 !== null,
         'so the gold macro lock can finally take the read it documents, straight off getGoldMacro()');

  /* fails open at every seam */
  ctx.__macroCacheGet = () => undefined;
  ctx.__macroFetchJson = async () => { throw new Error('403 CONNECT'); };
  assert(await ctx.getDXYRows(270) === null, 'a refused fetch yields null, never a fabricated series');
  ctx.__macroFetchJson = async () => null;
  assert(await ctx.getDXYRows(270) === null, 'an empty response yields null');
  ctx.__yahooLastClose = async () => null;
  assert(await ctx.getTNXRows('1y') === null, 'no yahoo leg yields null');
  ctx.__yahooLastClose = async () => { throw new Error('boom'); };
  assert(await ctx.getTNXRows('1y') === null, 'a throwing leg yields null and does not propagate');
}

console.log('== 8) the rule in force is NOT moved by this pack ==');
{
  const M = fs.readFileSync(path.join(ROOT, 'macro.js'), 'utf8');
  /* DELIBERATELY TEXTUAL. The bands ARE the rule deciding every gold-long kill
     today; whether a later edit moved one is a property of the source, and no
     runtime comparison can tell an unchanged rule from a retyped one while the
     two still agree — which is exactly when the drift starts (hg-v956). */
  assert(/trend20 = change20Pct > 0\.3 \? 'RISING' : \(change20Pct < -0\.3 \? 'FALLING' : 'FLAT'\);/.test(M),
         'the DXY band is still +/-0.3% over ~20 business days');
  assert(/trend20 = change20Pct > 2 \? 'RISING' : \(change20Pct < -2 \? 'FALLING' : 'FLAT'\);/.test(M),
         'the TNX band is still +/-2%');
  assert(/toD\.getTime\(\) - 31\*86400000/.test(M),
         'and the DXY trend window is still ~21 business days — the longer series is a SEPARATE fetch');
  const G = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  assert(/out\.reason = 'CONVICTION LOCK — DXY\+TNX bullish vs gold long'/.test(G),
         'the lock still says what it always said');
  assert(/if \(dir !== 'long'\) return out;/.test(G),
         'and it still applies to LONGS only — the dollar and yields do not kill a gold short here');
}

console.log('\n' + (fail === 0
  ? 'ALL GOLD MACRO LOCK RULE TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
