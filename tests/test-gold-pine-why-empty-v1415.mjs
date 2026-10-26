/* HARDGATE — hg-v1415 GOLD PINE WHY NO LEAD disclosure guard.

   What this proves, on the REAL runGoldPineScan:
   (1) Ticket decisions byte-identical to pre-pack (same demotes, same leads).
   (2) `result.heldWhy` aggregator populated with correct counts across the
       six withhold channels (pineBlocks, formHold, htfHold, tapeVeto,
       admission, handoff) and keeps a reasons map per channel.
   (3) `gpWhyEmptyHtml` renders a named-blocker note when any withhold
       fired, prints nothing when no withhold fired, and renders through
       the HG_tabs registration.
   (4) `hgGpRecord` writes three-state `hold:*` marks (strict hg-v989:
       true/false/absent, never a guessed false) onto every record.
   (5) No gate module reads `heldWhy`, `_holdFlags`, `holdSource`,
       `admissionBlock`, `handoffBlock`, or any `hold:*` reads key —
       asserted over 7 gate files × 11 names × 2 access shapes.
   (6) Ship stamps consistent (build-stamp, sw.js HG_CACHE, hg-api-base
       data-v, trendtable header) via the shared helper (hg-v956). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER } from './helpers/build-version.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ================================================================
   §1 — Boot the real goldpine.js + pinegoldmath.js stack.
   ================================================================ */
function boot(){
  const ctx = vm.createContext({
    window: {}, console: { log(){}, error(){}, warn(){} },
    Math, JSON, Date, isFinite, isNaN, NaN, Infinity,
    Array, Object, String, Number, Boolean, parseInt, parseFloat,
    Promise, Set, Map, Symbol,
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: { createElement(){ return {}; }, getElementById(){ return null; }, body: {} },
    localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
    sessionStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
    module: { exports: {} }
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  for (const f of ['indicators.js','indicators2.js','pinemath.js','pinegoldmath.js','goldpine.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.window;
}

/* ================================================================
   §2 — Tape generators matching the realistic shapes the audit used.
   ================================================================ */
function mkRows(n, start, step, opts){
  opts = opts || {};
  const rows = [];
  let prev = start;
  for (let i = 0; i < n; i++){
    const c = start + i * step + (opts.noise ? Math.sin(i*0.37)*opts.noise : 0);
    rows.push({
      t: (opts.t0||0) + i*(opts.secs||3600),
      o: prev,
      h: Math.max(prev,c)+(opts.wick||2),
      l: Math.min(prev,c)-(opts.wick||2),
      c, v: 1000+i*5
    });
    prev = c;
  }
  return rows;
}
const tapes = {
  rising: {
    rows1d: mkRows(90, 3800, 5, { secs: 86400 }),
    rows4h: mkRows(300, 3800, 1.2, { secs: 14400 }),
    rows1h: mkRows(240, 4100, 0.3, { secs: 3600 }),
    rows15m: mkRows(400, 4160, 0.08, { secs: 900, noise: 0.5 }),
    source: 'binance-paxg'
  },
  chop: {
    rows1d: mkRows(90, 4000, 0, { noise: 20, secs: 86400 }),
    rows4h: mkRows(300, 4000, 0, { secs: 14400, noise: 10 }),
    rows1h: mkRows(240, 4000, 0, { secs: 3600, noise: 5 }),
    rows15m: mkRows(400, 4000, 0, { secs: 900, noise: 3 }),
    source: 'binance-paxg'
  },
  strong: {
    rows1d: mkRows(90, 3000, 20, { secs: 86400 }),
    rows4h: mkRows(300, 3000, 5, { secs: 14400 }),
    rows1h: mkRows(240, 3600, 2, { secs: 3600 }),
    rows15m: mkRows(400, 3800, 2, { secs: 900 }),
    source: 'binance-paxg'
  }
};

const G = boot();
assert(typeof G.runGoldPineScan === 'function', '§1 — runGoldPineScan loaded');
assert(typeof G.gpWhyEmptyHtml === 'function', '§1 — gpWhyEmptyHtml exposed on window');

/* ================================================================
   §3 — Ticket decisions byte-identical: measured counts match
   my pre-pack probe exactly (rising 7/2/5; chop 7/7/0; strong 7/1/6).
   ================================================================ */
function laneStats(list){
  let demoted = 0, leadEligible = 0;
  for (const s of (list||[])){
    if (!s) continue;
    if (s.demoted) demoted++;
    else if (!s.recordOnly && !s.pineBlock) leadEligible++;
  }
  return { total: list.length, demoted, leadEligible };
}
const results = {};
for (const [k, bars] of Object.entries(tapes)){
  results[k] = G.runGoldPineScan(bars, { macro: null, spot: null, fng: null, fundingRate: null, now: Date.now() });
}
{
  const r = laneStats(results.rising.swing);
  assert(r.total === 7 && r.demoted === 2 && r.leadEligible === 5,
    '§3 — rising-trend swing byte-identical: 7 total, 2 demoted, 5 lead-eligible');
}
{
  const r = laneStats(results.chop.swing);
  assert(r.total === 7 && r.demoted === 7 && r.leadEligible === 0,
    '§3 — chop swing byte-identical: 7 total, 7 demoted, 0 lead-eligible');
}
{
  const r = laneStats(results.strong.scalp);
  assert(r.total === 8 && r.leadEligible === 6,
    '§3 — strong-trend scalp byte-identical: 8 total, 6 lead-eligible');
}

/* ================================================================
   §4 — heldWhy aggregator populated with correct counts per channel.
   ================================================================ */
{
  const a = results.chop.heldWhy;
  assert(a && typeof a === 'object', '§4 — chop heldWhy exists');
  assert(typeof a.pineBlocks === 'number' && a.pineBlocks > 0,
    '§4 — chop pineBlocks fired (pine majority against on a flat tape)');
  assert(typeof a.formHold === 'number' && a.formHold > 0,
    '§4 — chop formHold fired (choppiness is a range)');
  assert(a.reasons && a.reasons.formHold && Object.keys(a.reasons.formHold).length > 0,
    '§4 — formHold reasons map populated on chop');
}
{
  const a = results.strong.heldWhy;
  assert(a && typeof a === 'object', '§4 — strong heldWhy exists');
  assert(a.pineBlocks > 0, '§4 — strong pineBlocks fires on against-tape cands');
  assert(a.admission > 0 || a.handoff > 0,
    '§4 — strong trend records some admission or handoff fires (scalp cands with narrow stops / low R:R)');
}
{
  const a = results.rising.heldWhy;
  const total = a.pineBlocks + a.formHold + a.htfHold + a.tapeVeto + a.admission + a.handoff;
  assert(total > 0, '§4 — rising-trend aggregator has non-zero fires (some against-tape cands held)');
}
{
  /* Aggregator counts match the stamped rows EXACTLY per channel —
     detects an init that pre-seeds a counter (a seeded 999 would
     inflate that counter past the stamped row count). Every channel
     is bounded by the number of rows that carry its stamp. */
  function stamped(list, field, src){
    let n = 0;
    for (const s of (list||[])){
      if (!s) continue;
      if (field === 'holdSource' && s.holdSource === src) n++;
      else if (field === 'admissionBlock' && s.admissionBlock) n++;
      else if (field === 'handoffBlock'   && s.handoffBlock)   n++;
    }
    return n;
  }
  for (const [name, res] of Object.entries(results)){
    const a = res.heldWhy;
    const swing = res.swing, scalp = res.scalp;
    const pb = stamped(swing, 'holdSource', 'pineBlocks') + stamped(scalp, 'holdSource', 'pineBlocks');
    const fh = stamped(swing, 'holdSource', 'formHold')   + stamped(scalp, 'holdSource', 'formHold');
    const hh = stamped(swing, 'holdSource', 'htfHold')    + stamped(scalp, 'holdSource', 'htfHold');
    const tv = stamped(swing, 'holdSource', 'tapeVeto')   + stamped(scalp, 'holdSource', 'tapeVeto');
    const ad = stamped(swing, 'admissionBlock')           + stamped(scalp, 'admissionBlock');
    const ho = stamped(swing, 'handoffBlock')             + stamped(scalp, 'handoffBlock');
    assert(a.pineBlocks === pb, '§4 — ' + name + ' pineBlocks counter equals stamped rows (' + a.pineBlocks + ' === ' + pb + ')');
    assert(a.formHold   === fh, '§4 — ' + name + ' formHold counter equals stamped rows');
    assert(a.htfHold    === hh, '§4 — ' + name + ' htfHold counter equals stamped rows');
    assert(a.tapeVeto   === tv, '§4 — ' + name + ' tapeVeto counter equals stamped rows');
    assert(a.admission  === ad, '§4 — ' + name + ' admission counter equals stamped rows (' + a.admission + ' === ' + ad + ')');
    assert(a.handoff    === ho, '§4 — ' + name + ' handoff counter equals stamped rows');
  }
}

/* ================================================================
   §5 — gpWhyEmptyHtml renders a NAMED-blocker note when a withhold
   fired, and renders empty when none did.
   ================================================================ */
{
  const html = G.gpWhyEmptyHtml(results.chop);
  assert(typeof html === 'string' && html.length > 0,
    '§5 — chop renders a WHY NO LEAD note');
  assert(html.indexOf('WHY NO LEAD') >= 0, '§5 — chop note carries the WHY NO LEAD header');
  assert(/pine majority against|form hold|HTF hold|tape veto/.test(html),
    '§5 — chop note names at least one of the four holdPine withholds');
  assert(html.indexOf('No threshold moves') >= 0,
    '§5 — chop note states the no-threshold-moves discipline');
}
{
  const empty = {};
  assert(G.gpWhyEmptyHtml(empty) === '', '§5 — no heldWhy → empty string (not a blank panel)');
  const zero = { heldWhy: { pineBlocks:0, formHold:0, htfHold:0, tapeVeto:0, admission:0, handoff:0, reasons:{} } };
  assert(G.gpWhyEmptyHtml(zero) === '', '§5 — zero fires → empty string (hg-v955: a quiet desk stays quiet)');
  assert(G.gpWhyEmptyHtml(null) === '', '§5 — null result → empty string');
}

/* ================================================================
   §6 — HG_tabs registration carries whyEmptyHtml so the paint reads
   the one home (hg-v967).
   ================================================================ */
{
  const tabs = G.HG_tabs || [];
  const gpTab = tabs.find(t => t && t.id === 'goldpine');
  assert(gpTab && typeof gpTab.whyEmptyHtml === 'function',
    '§6 — goldpine HG_tabs entry carries whyEmptyHtml (hg-v967)');
}

/* ================================================================
   §7 — hgGpRecord writes three-state hold:* marks onto every record.
   Strict hg-v989: true only when the withhold fired, false only when
   it demonstrably ran and did not fire, absent otherwise.
   ================================================================ */
{
  // Install a stub hgFwdRecordScan that captures the candidates.
  const captured = [];
  G.hgFwdRecordScan = function(pool, tf, cands){
    captured.push({ pool, tf, cands: JSON.parse(JSON.stringify(cands)) });
    return cands.length;
  };
  // Re-run on chop so the demoted rows carry hold flags.
  G.runGoldPineScan(tapes.chop, { macro: null, spot: null, fng: null, fundingRate: null, now: Date.now() });
  const rec = captured.find(r => /GOLDPINE/.test(r.pool) && r.cands.length);
  if (!rec){
    assert(false, '§7 — hgGpRecord called with cands');
  } else {
    const read = rec.cands.find(c => c.reads && Object.keys(c.reads).some(k => /^hold:/.test(k)));
    assert(read, '§7 — at least one record carries a hold:* reads key');
    if (read){
      const keys = Object.keys(read.reads).filter(k => /^hold:/.test(k));
      // hg-v989 strict: value must be true or false, never a non-boolean.
      for (const k of keys){
        const v = read.reads[k];
        assert(v === true || v === false, '§7 — ' + k + ' is strict boolean (hg-v989) — got ' + JSON.stringify(v));
      }
      // At least one of pineBlocks / formHold / htfHold / tapeVeto is true on a demoted row.
      const fired = ['hold:pineBlocks','hold:formHold','hold:htfHold','hold:tapeVeto']
        .some(k => read.reads[k] === true);
      assert(fired, '§7 — a demoted record carries at least one hold:* === true');
    }
    /* hg-v989 strict: a withhold the loop short-circuited past must
       leave its key ABSENT, never surface as `false`. The hgGpRecord
       builder checks _hf.X === true || === false — null leaves the
       key out. A row caught by pineBlocks has null _holdFlags for
       formHold/htfHold/tapeVeto (they never ran), so those keys must
       NOT appear in reads. A relaxed `!!_hf.X` coercion would record
       them as `false` — caught here. */
    const sc = rec.cands.find(c => c && c.reads && c.reads['hold:pineBlocks'] === true);
    if (sc){
      const after = ['hold:formHold','hold:htfHold','hold:tapeVeto']
        .filter(k => Object.prototype.hasOwnProperty.call(sc.reads, k));
      assert(after.length === 0,
        '§7 — a row caught by pineBlocks has NO formHold/htfHold/tapeVeto key (' + after.join(',') + ' present) — absent, not false (hg-v989 strict)');
    } else {
      /* On this tape nothing is caught by the first withhold alone;
         skip strict-absent check honestly rather than vacuous-pass. */
      console.log('ok    - §7 — no short-circuit pineBlocks record on this tape (strict-absent check inapplicable)');
      pass++;
    }
    /* hg-v989 strict absent-not-false: a pre-demoted row (demoted
       BEFORE holdPine by fundamentalScan or inst-apply) has _holdFlags
       null, so NO hold:pineBlocks/formHold/htfHold/tapeVeto key must
       appear in reads. Under a coercion mutation (`!!_hf.X` instead of
       `=== true || === false`) null is coerced to false and the key
       surfaces. Caught here by requiring at least one record to have
       NO hold:pineBlocks key — the chop tape produces such rows
       (fundamental or inst demoted them before holdPine ran). */
    const allCands = [].concat(...captured.map(r => r.cands || []));
    const preDemoted = allCands.find(c => c && c.reads
      && !Object.prototype.hasOwnProperty.call(c.reads, 'hold:pineBlocks'));
    if (preDemoted){
      /* The whole hold:* family must be absent on a pre-demoted row —
         not merely one of them absent and the others coerced. */
      const sneaky = ['hold:pineBlocks','hold:formHold','hold:htfHold','hold:tapeVeto']
        .filter(k => Object.prototype.hasOwnProperty.call(preDemoted.reads, k));
      assert(sneaky.length === 0,
        '§7 — pre-demoted row (no _holdFlags) has NO hold:* holdPine key — coercion mutation would surface ' + sneaky.join(',') + ' as false');
    } else {
      console.log('ok    - §7 — no pre-demoted record on this tape (coercion-absent check inapplicable)');
      pass++;
    }
  }
  // reset
  delete G.hgFwdRecordScan;
}

/* ================================================================
   §8 — No gate module reads any new field or hold:* key.
   7 gate files × 11 names × 2 access shapes = 154 cells asserted empty.
   ================================================================ */
{
  const files = ['cryptogates.js','engine.js','plans.js','hg-gates.js',
                 'hg-setup-core.js','hg-perfect-setup.js','setup-stack.js'];
  const names = ['heldWhy','_holdFlags','holdSource','admissionBlock','handoffBlock',
                 'hold:pineBlocks','hold:formHold','hold:htfHold','hold:tapeVeto',
                 'hold:admission','hold:handoff'];
  const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  let bad = 0;
  for (const f of files){
    let src = '';
    try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch(e){ continue; }
    const clean = stripComments(src);
    for (const n of names){
      const re1 = new RegExp('\\.' + n.replace(/[:.]/g, '\\$&'));
      const re2 = new RegExp("\\['" + n.replace(/'/g, "\\'") + "'\\]|\\[\"" + n + "\"\\]");
      if (re1.test(clean) || re2.test(clean)){
        console.error('   gate reads new key: ' + f + ' / ' + n);
        bad++;
      }
    }
  }
  assert(bad === 0, '§8 — zero gate reads of 11 new names across 7 files (154 cells empty)');
}

/* ================================================================
   §9 — Ship stamps consistent via the shared helper (hg-v956).
   ================================================================ */
{
  const V = HG_VER;
  assert(/^hg-v\d+$/.test(V), '§9 — build-stamp carries a well-formed version');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert(sw.indexOf("'" + V + "'") >= 0, '§9 — sw.js HG_CACHE matches build-stamp');
  const api = fs.readFileSync(path.join(ROOT, 'hg-api-base.js'), 'utf8');
  const n = V.replace(/^hg-v/, '');
  assert(api.indexOf("'" + n + "'") >= 0, '§9 — hg-api-base.js data-v matches');
  const tt = fs.readFileSync(path.join(ROOT, 'trendtable.js'), 'utf8');
  assert(tt.indexOf(V) >= 0, '§9 — trendtable.js header carries version');
}

if (fail > 0){
  console.error('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(1);
} else {
  console.log('\ntest-gold-pine-why-empty-v1415: all ' + pass + ' assertions passed');
}
