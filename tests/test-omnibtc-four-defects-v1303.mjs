#!/usr/bin/env node
/* hg-v1303 — four OMNIBTC defects uncovered by the user complaint "setups
   are wrong in omnibtc tab correct them":

   (1) MEAN REV engine silently dropped — pushEngine aliased tp→t1 only.
       meanrev.js returns {target}, so every firing dropped null at
       hgObtcCandidateFromSignal's isFinite(t1) check.
   (2) hg-v1051 override always fires — pick.row.kind reads 'UNKNOWN'
       because hgNormalizeSetupRow strips kind/omniKind/engine; the
       "primary pick already proven?" short-circuit was dead.
   (3) SETUP CARD painted ENTRY ZONE and TP3 from 4h ATR on 15m SCALP/TRAP
       picks — zones overstated 5–10×.
   (4) hg-v1300 panel inverted every pine mark on every SHORT pick —
       'long' always mapped to WITH, 'short' always to AGAINST, no
       pick.row.dir read.

   Each fix is driven through the REAL omnibtc.js via vm sandbox lift
   (hg-v1022 technique). Mutation pass on the shipped source. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
const ok = (c, label) => { if (c){ passed++; console.log('ok —', label); } else { failed++; console.log('FAIL —', label); } };

const SRC = read('omnibtc.js');

/* ---------- §1: source-level pins ---------- */
console.log('\n[§1] source-level pins in omnibtc.js');
{
  /* Fix 1: pushEngine maps hit.target → hit.t1 when both tp and t1 are absent. */
  ok(/hg-v1303.*MEAN REVERSION/s.test(SRC) || /else if \(hit\.target != null\) hit\.t1 = hit\.target/.test(SRC),
    'Fix 1: pushEngine has target→t1 fallback');

  /* Fix 2a: pfReads.atrVal15 is set from match._rows15 beside atrVal.
     The source expression is pinned textually (hg-v956): a behavioural
     test on the write path would need to drive the full pfReads block,
     which depends on 15 other seams. Pinning the series the ATR is
     computed from catches a mutation that switches the series to
     winnerRows (the 4h tape) and silently gets back the old defect. */
  ok(/pfReads\.atrVal15 = aLast15/.test(SRC), 'Fix 2a: pfReads.atrVal15 is written');
  /* Pin on the exact assignment that writes atrArr15: the series must be
     match._rows15, not winnerRows (the 4h tape — which would silently
     restore the pre-fix defect while atrVal15 keeps the right name).
     match._rows15 is used elsewhere in the file for other 15m reads, so
     a broader pin (just the regex) is not sufficient. */
  ok(/var atrArr15 = W\.atr\(match\._rows15,\s*14\);/.test(SRC),
    'Fix 2a: atrVal15 is computed from match._rows15 (not winnerRows)');

  /* Fix 2b: SETUP CARD reads atrVal15 on SCALP/TRAP picks. */
  ok(/__obtcScalp.*= \/SCALP\|TRAP\/i\.test/.test(SRC), 'Fix 2b: card detects scalp picks');
  ok(/__obtcScalp && isFinite\(reads\.atrVal15\)/.test(SRC), 'Fix 2b: card reads atrVal15 on scalp');

  /* Fix 3: hg-v1051 override has UNKNOWN-fallback lookup through btc. */
  ok(/pickMech === 'UNKNOWN' && Array\.isArray\(btc\)/.test(SRC),
    'Fix 3: override has UNKNOWN mechanic lookup through btc');

  /* Fix 4: pine panel reads pick.row.dir. */
  ok(/var planLong = !!\(pick && pick\.row && pick\.row\.dir === 'long'\)/.test(SRC),
    'Fix 4: pine panel reads planLong from pick.row.dir');
  ok(/var planShort = !!\(pick && pick\.row && pick\.row\.dir === 'short'\)/.test(SRC),
    'Fix 4: pine panel reads planShort from pick.row.dir');
}

/* ---------- §2: Fix 1 — pushEngine target→t1 (lifted) ---------- */
console.log('\n[§2] Fix 1: pushEngine target→t1 fallback (lifted real code)');
{
  /* Extract the pushEngine function body as a standalone callable and run
     it against a stubbed hgObtcCandidateFromSignal that captures what the
     function hands over. */
  const idx = SRC.indexOf('function pushEngine(out, name, fn, ticker)');
  if (idx < 0) throw new Error('pushEngine not found');
  const openBrace = SRC.indexOf('{', idx);
  let depth = 1, i = openBrace + 1;
  while (i < SRC.length && depth > 0){
    const c = SRC[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  const fnSrc = SRC.slice(idx, i);

  function makeCtx(){
    const captured = { ok: 0, nulls: 0, lastHit: null };
    const ctx = {
      console: { log(){}, warn(){}, error(){} },
      Math, isFinite, isNaN, JSON, Array, Object, Number, String,
      capture: captured,
    };
    ctx.hgObtcCandidateFromSignal = function(hit, ticker, opts){
      captured.lastHit = JSON.parse(JSON.stringify(hit));
      if (!hit || hit.t1 == null || !isFinite(+hit.t1)) { captured.nulls++; return null; }
      captured.ok++;
      return { ...hit, _ok: true };
    };
    ctx.hgObtcApplyOmniPrincipal = function(){};
    vm.createContext(ctx);
    vm.runInContext(fnSrc + '; this.pushEngine = pushEngine;', ctx);
    return ctx;
  }

  /* MR shape: target, not t1/tp */
  {
    const ctx = makeCtx();
    const out = [];
    ctx.pushEngine(out, 'MEAN REVERSION',
      () => ({dir:'long', entry:65000, stop:64000, target:66500, rr:1.5}),
      { symbol:'BTCUSD' });
    ok(ctx.capture.ok === 1, 'MR {target:66500} now reaches candidate (ok=1)');
    ok(ctx.capture.lastHit && ctx.capture.lastHit.t1 === 66500, 'MR target was mapped to t1=66500');
    ok(out.length === 1, 'MR candidate landed in out');
  }

  /* Both tp AND target present: tp wins (hg-v1303 keeps the pre-existing
     tp semantics; target is strictly a FALLBACK for engines that emit
     neither tp nor t1. A reversed order would silently prefer target
     over tp, which legacy engines never expected). */
  {
    const ctx = makeCtx();
    const out = [];
    ctx.pushEngine(out, 'MIXED',
      () => ({dir:'long', entry:65000, stop:64000, tp:67000, target:66500, rr:1.5}),
      { symbol:'BTCUSD' });
    ok(ctx.capture.ok === 1, 'tp AND target present → still accepted');
    ok(ctx.capture.lastHit && ctx.capture.lastHit.t1 === 67000,
      `tp wins over target when both present (got t1=${ctx.capture.lastHit && ctx.capture.lastHit.t1}, expected 67000)`);
  }

  /* tp shape still works (pre-fix path) */
  {
    const ctx = makeCtx();
    const out = [];
    ctx.pushEngine(out, 'LEGACY',
      () => ({dir:'short', entry:65000, stop:66000, tp:64000, rr:1.5}),
      { symbol:'BTCUSD' });
    ok(ctx.capture.ok === 1, 'legacy {tp:64000} still works');
    ok(ctx.capture.lastHit && ctx.capture.lastHit.t1 === 64000, 'tp mapped to t1=64000');
  }

  /* t1 shape still works (correct engines) */
  {
    const ctx = makeCtx();
    const out = [];
    ctx.pushEngine(out, 'SWING',
      () => ({dir:'long', entry:65000, stop:64000, t1:67000, rr:2.0}),
      { symbol:'BTCUSD' });
    ok(ctx.capture.ok === 1, 'engine emitting {t1:67000} unchanged');
    ok(ctx.capture.lastHit && ctx.capture.lastHit.t1 === 67000, 't1 preserved');
  }

  /* hit with NO t1/tp/target: still null */
  {
    const ctx = makeCtx();
    const out = [];
    ctx.pushEngine(out, 'BROKEN',
      () => ({dir:'long', entry:65000, stop:64000, rr:1.5}),
      { symbol:'BTCUSD' });
    ok(ctx.capture.nulls === 1, 'no target/tp/t1 → still null');
    ok(out.length === 0, 'no candidate landed');
  }

  /* hit:null → nothing */
  {
    const ctx = makeCtx();
    const out = [];
    ctx.pushEngine(out, 'DEAD', () => null, { symbol:'BTCUSD' });
    ok(ctx.capture.ok === 0 && ctx.capture.nulls === 0, 'null hit → no call');
    ok(out.length === 0, 'no candidate');
  }

  /* fn throws → pushEngine swallows */
  {
    const ctx = makeCtx();
    const out = [];
    let didThrow = false;
    try { ctx.pushEngine(out, 'THROWS', () => { throw new Error('x'); }, { symbol:'BTCUSD' }); }
    catch(e){ didThrow = true; }
    ok(!didThrow, 'thrown fn is swallowed by pushEngine try/catch');
  }
}

/* ---------- §3: Fix 3 — hg-v1051 UNKNOWN mechanic lookup ---------- */
console.log('\n[§3] Fix 3: override reads mechanic from btc when pick.row.kind stripped');
{
  /* Extract the override block (the try block starting at hg-v1051 comment)
     and verify its control flow on a stubbed hgProvenEdgeVerdict. */
  const startMarker = 'hg-v1051: MEASURED RANKING';
  const startIdx = SRC.indexOf(startMarker);
  if (startIdx < 0) throw new Error('hg-v1051 block marker not found');
  /* The block is: try{ ... }catch(eMr){ ... }  */
  const tryIdx = SRC.indexOf('try{', startIdx);
  const openBrace = SRC.indexOf('{', tryIdx + 3);
  let depth = 1, i = openBrace + 1;
  while (i < SRC.length && depth > 0){
    const c = SRC[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  /* Also pull the catch */
  const catchIdx = SRC.indexOf('catch(eMr)', i);
  const catchOpenBrace = SRC.indexOf('{', catchIdx);
  let d2 = 1, j = catchOpenBrace + 1;
  while (j < SRC.length && d2 > 0){
    const c = SRC[j];
    if (c === '{') d2++;
    else if (c === '}') d2--;
    j++;
  }
  const overrideSrc = SRC.slice(tryIdx, j);

  function runOverride(opts){
    const ctx = {
      console: { log(){}, warn(){}, error(){} },
      Math, isFinite, isNaN, JSON, Array, Object, Number, String,
    };
    ctx.W = ctx;
    ctx.gfn = (name) => typeof ctx[name] === 'function' || (name === 'hgProvenEdgeVerdict' && typeof opts.verdict === 'function');
    ctx.hgProvenEdgeVerdict = opts.verdict || null;
    ctx.hgFwdWarn = function(){};
    ctx.btc = opts.btc;
    ctx.pick = opts.pick;
    vm.createContext(ctx);
    const wrapper = 'var btc = this.btc; var pick = this.pick; ' + overrideSrc + '; this.pick = pick;';
    vm.runInContext(wrapper, ctx);
    return ctx.pick;
  }

  /* Fixture: btc has one LONG NR7-BREAK (primary, high turnover) and one
     SHORT AVWAP-RECLAIM. Primary pick is LONG NR7-BREAK (via hgPickMostProbableAny
     stubbed via opts.pick). Both mechanics proven. */
  const primaryPick = {
    row: { sym: 'BTCUSD', dir: 'long', entry: 65000, stop: 64000, t1: 67000, clean: true },
    tier: 'clean', source: 'clean'
  };
  const btc = [
    { sym: 'BTCUSD', dir: 'long', entry: 65000, stop: 64000, t1: 67000, clean: true, kind: 'NR7-BREAK', omniKind: 'NR7-BREAK', engine: 'NR7-BREAK' },
    { sym: 'BTCUSD', dir: 'short', entry: 66000, stop: 67000, t1: 64000, clean: true, kind: 'AVWAP-RECLAIM', omniKind: 'AVWAP-RECLAIM', engine: 'AVWAP-RECLAIM' },
  ];

  /* Pre-fix shape: primary pick.row stripped of kind — override would fire
     and promote AVWAP-RECLAIM (alphabetically first) despite primary being
     proven. The fix: look up NR7-BREAK from btc, verdict reads proven,
     short-circuit stays short. The verdict stub here mirrors production:
     the ledger has records only under KNOWN mechanic names, so
     hgProvenEdgeVerdict('UNKNOWN', ...) returns unproven. A mutation that
     breaks the lookup leaves pickMech='UNKNOWN', the stub returns unproven,
     the override enters and re-crowns alphabetically — which is exactly
     the defect this fix addresses. */
  const bothProvenKnown = (desk, mech) => {
    if (mech === 'UNKNOWN') return { state: 'unproven' };
    return { state: 'proven', mech };
  };
  const picked = runOverride({
    pick: JSON.parse(JSON.stringify(primaryPick)),
    btc,
    verdict: bothProvenKnown,
  });
  ok(picked.row.dir === 'long', 'Fix 3: primary LONG NR7-BREAK pick kept when its mechanic proven (dir preserved)');
  ok(picked.source === 'clean' || picked.source === undefined, 'Fix 3: source stays "clean", override did not re-crown');
  ok(!picked.row.measuredRanked, 'Fix 3: measuredRanked NOT stamped (override short-circuited)');

  /* Pre-fix regression: with no lookup (or a broken lookup), pickMech stays
     'UNKNOWN', the stub reads unproven, the override enters and promotes
     AVWAP (alphabetically first) → dir flips to short. This is the behaviour
     we fixed; running the same stub against the fixed code should NOT flip. */
  ok(picked.row.dir !== 'short',
    'Fix 3: lookup works — primary dir does not flip to short under realistic stub');

  /* When primary is unproven and alternate IS proven, override still fires
     and crowns the proven alternate — that is the override's job. */
  const onlyAvwapProven = (desk, mech) => (mech === 'AVWAP-RECLAIM' ? { state: 'proven' } : { state: 'unproven' });
  const picked2 = runOverride({
    pick: JSON.parse(JSON.stringify(primaryPick)),
    btc,
    verdict: onlyAvwapProven,
  });
  ok(picked2.row.dir === 'short', 'Fix 3: primary unproven + AVWAP proven → override crowns AVWAP (dir flips)');
  ok(picked2.source === 'measured-rank', 'Fix 3: source="measured-rank" when override crowns');
  ok(picked2.row.measuredRanked === true, 'Fix 3: measuredRanked stamp when override fires');

  /* When both proven (same as first fixture but driving another path): the
     short-circuit depends on reading the primary mechanic correctly. */
  const picked3 = runOverride({
    pick: JSON.parse(JSON.stringify(primaryPick)),
    btc,
    verdict: bothProvenKnown,
  });
  ok(picked3.row.kind !== 'AVWAP-RECLAIM', 'Fix 3: both proven, primary NR7 kept (not AVWAP)');
}

/* ---------- §4: Fix 4 — pine panel direction (lifted) ---------- */
console.log('\n[§4] Fix 4: pine marks WITH/AGAINST on pick.row.dir');
{
  /* Lift hgObtcMarksPanelHtml and HG_OBTC_MARKS_GROUPS and run with
     stubbed esc, stubbed free/ind as empty (we only test pine). */
  const groupsIdx = SRC.indexOf('var HG_OBTC_MARKS_GROUPS');
  const groupsEnd = SRC.indexOf('];', groupsIdx);
  const groupsSrc = SRC.slice(groupsIdx, groupsEnd + 2);

  const fnIdx = SRC.indexOf('function hgObtcMarksPanelHtml(pick)');
  const openBrace = SRC.indexOf('{', fnIdx);
  let d = 1, k = openBrace + 1;
  while (k < SRC.length && d > 0){
    const c = SRC[k];
    if (c === '{') d++;
    else if (c === '}') d--;
    k++;
  }
  const fnSrc = SRC.slice(fnIdx, k);

  const stateFnIdx = SRC.indexOf('function hgObtcMarkState(bag, keyWithPrefix)');
  const stateOpen = SRC.indexOf('{', stateFnIdx);
  let dS = 1, l = stateOpen + 1;
  while (l < SRC.length && dS > 0){
    const c = SRC[l];
    if (c === '{') dS++;
    else if (c === '}') dS--;
    l++;
  }
  const stateFnSrc = SRC.slice(stateFnIdx, l);

  function makePanelCtx(){
    const ctx = {
      console: { log(){}, warn(){}, error(){} },
      Math, isFinite, isNaN, JSON, Array, Object, Number, String,
      esc: s => String(s == null ? '' : s),
    };
    vm.createContext(ctx);
    vm.runInContext(groupsSrc + ';\n' + stateFnSrc + ';\n' + fnSrc + '; this.hgObtcMarksPanelHtml = hgObtcMarksPanelHtml;', ctx);
    return ctx;
  }

  const ctx = makePanelCtx();

  function panelFor(dir, pineMarks){
    const pick = {
      row: {
        dir,
        perfectReads: {
          freeFeedVerdicts: null,
          indMarks: null,
          pineMarks,
        },
      },
    };
    return ctx.hgObtcMarksPanelHtml(pick);
  }

  /* LONG pick, every pine port says 'long': all WITH */
  {
    const marks = { lor:'long', ht:'long', sqz:'long', smf:'long' };
    const html = panelFor('long', marks);
    const withCount = (html.match(/>WITH</g) || []).length;
    const againstCount = (html.match(/>AGAINST</g) || []).length;
    ok(withCount >= 4 && againstCount === 0,
      `LONG + 4 pine longs → ${withCount} WITH / ${againstCount} AGAINST (expect 4/0)`);
  }

  /* SHORT pick, every pine port says 'long': all AGAINST */
  {
    const marks = { lor:'long', ht:'long', sqz:'long', smf:'long' };
    const html = panelFor('short', marks);
    const withCount = (html.match(/>WITH</g) || []).length;
    const againstCount = (html.match(/>AGAINST</g) || []).length;
    ok(withCount === 0 && againstCount >= 4,
      `SHORT + 4 pine longs → ${withCount} WITH / ${againstCount} AGAINST (expect 0/4)`);
  }

  /* SHORT pick, every pine port says 'short': all WITH (the trade) */
  {
    const marks = { lor:'short', ht:'short', sqz:'short', smf:'short' };
    const html = panelFor('short', marks);
    const withCount = (html.match(/>WITH</g) || []).length;
    const againstCount = (html.match(/>AGAINST</g) || []).length;
    ok(withCount >= 4 && againstCount === 0,
      `SHORT + 4 pine shorts → ${withCount} WITH / ${againstCount} AGAINST (expect 4/0 — the trade agrees)`);
  }

  /* LONG + mixed: 2 long / 2 short → 2 WITH / 2 AGAINST */
  {
    const marks = { lor:'long', ht:'short', sqz:'long', smf:'short' };
    const html = panelFor('long', marks);
    const withCount = (html.match(/>WITH</g) || []).length;
    const againstCount = (html.match(/>AGAINST</g) || []).length;
    ok(withCount >= 2 && againstCount >= 2,
      `LONG mixed → ${withCount} WITH / ${againstCount} AGAINST (expect ≥2 each)`);
  }

  /* No direction: pine marks all UNREAD, never guessed */
  {
    const marks = { lor:'long', ht:'short' };
    const html = panelFor('', marks);
    const withCount = (html.match(/>WITH</g) || []).length;
    const againstCount = (html.match(/>AGAINST</g) || []).length;
    ok(withCount === 0 && againstCount === 0,
      `no direction → pine marks UNREAD (${withCount} WITH / ${againstCount} AGAINST)`);
  }

  /* Non-boolean pine values (coercion refused — hg-v989 three-state) */
  {
    const marks = { lor: 1, ht: 'LONG', sqz: null, smf: 'bull' };
    const html = panelFor('long', marks);
    const withCount = (html.match(/>WITH</g) || []).length;
    const againstCount = (html.match(/>AGAINST</g) || []).length;
    ok(withCount === 0 && againstCount === 0,
      `LONG with junk pine values → all UNREAD (${withCount} WITH / ${againstCount} AGAINST)`);
  }

  /* Fail open: no pick */
  ok(ctx.hgObtcMarksPanelHtml(null) === '', 'null pick → empty');
  ok(ctx.hgObtcMarksPanelHtml({}) === '', '{} pick → empty');
  ok(ctx.hgObtcMarksPanelHtml({ row: {} }) === '', 'row missing perfectReads → empty');
}

/* ---------- §5: Fix 2b — scalp card uses scalp ATR ---------- */
console.log('\n[§5] Fix 2b: SETUP CARD uses atrVal15 on scalp picks');
{
  /* Lift hgObtcSetupCardHtml and run on a scalp pick with atrVal15 set. */
  const fnIdx = SRC.indexOf('function hgObtcSetupCardHtml(pick, snap)');
  const openBrace = SRC.indexOf('{', fnIdx);
  let d = 1, i = openBrace + 1;
  while (i < SRC.length && d > 0){
    const c = SRC[i];
    if (c === '{') d++;
    else if (c === '}') d--;
    i++;
  }
  const fnSrc = SRC.slice(fnIdx, i);

  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, isFinite, isNaN, JSON, Array, Object, Number, String, Date,
    esc: s => String(s == null ? '' : s),
  };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '; this.hgObtcSetupCardHtml = hgObtcSetupCardHtml;', ctx);

  function parseZone(html){
    const m = html.match(/Entry Zone[^<]*<\/span><span class="v">\[([-0-9.]+)\s*-\s*([-0-9.]+)\]/);
    if (!m) return null;
    return [parseFloat(m[1]), parseFloat(m[2])];
  }

  /* SCALP pick with 15m ATR $80 and 4h ATR $500: zone should use $80. */
  {
    const pick = {
      row: {
        dir: 'long', entry: 65000, stop: 64900, t1: 65200, engine: 'SCALP clean plan',
        perfectReads: { atrVal: 500, atrVal15: 80 },
      },
      tier: 'clean',
    };
    const html = ctx.hgObtcSetupCardHtml(pick, {});
    const zone = parseZone(html);
    ok(zone && Math.abs(zone[0] - (65000 - 20)) < 0.5 && Math.abs(zone[1] - (65000 + 20)) < 0.5,
      `SCALP: Entry Zone from 15m ATR ($80 × 0.25 = $20): zone=${zone}`);
  }

  /* SWING pick with 15m ATR $80 and 4h ATR $500: zone should use $500 (4h). */
  {
    const pick = {
      row: {
        dir: 'long', entry: 65000, stop: 64000, t1: 66500, engine: 'SWING clean plan',
        perfectReads: { atrVal: 500, atrVal15: 80 },
      },
      tier: 'clean',
    };
    const html = ctx.hgObtcSetupCardHtml(pick, {});
    const zone = parseZone(html);
    ok(zone && Math.abs(zone[0] - (65000 - 125)) < 0.5 && Math.abs(zone[1] - (65000 + 125)) < 0.5,
      `SWING: Entry Zone from 4h ATR ($500 × 0.25 = $125): zone=${zone}`);
  }

  /* TRAP pick (scalp family) with 15m ATR: zone 15m */
  {
    const pick = {
      row: {
        dir: 'short', entry: 65000, stop: 65100, t1: 64800, engine: 'TRAP',
        perfectReads: { atrVal: 500, atrVal15: 80 },
      },
      tier: 'clean',
    };
    const html = ctx.hgObtcSetupCardHtml(pick, {});
    const zone = parseZone(html);
    ok(zone && Math.abs(zone[0] - (65000 - 20)) < 0.5 && Math.abs(zone[1] - (65000 + 20)) < 0.5,
      `TRAP: Entry Zone from 15m ATR: zone=${zone}`);
  }

  /* SCALP pick with no atrVal15: falls back to atrVal (pre-fix shape, kept so a legacy pick still paints) */
  {
    const pick = {
      row: {
        dir: 'long', entry: 65000, stop: 64900, t1: 65200, engine: 'SCALP clean plan',
        perfectReads: { atrVal: 500 },
      },
      tier: 'clean',
    };
    const html = ctx.hgObtcSetupCardHtml(pick, {});
    const zone = parseZone(html);
    ok(zone && Math.abs(zone[0] - (65000 - 125)) < 0.5,
      `SCALP w/o atrVal15: falls back to 4h ATR (legacy shape, zone=${zone})`);
  }

  /* ATR convergence line labels 15m vs 4h */
  {
    const pick = {
      row: {
        dir: 'long', entry: 65000, stop: 64900, t1: 65200, engine: 'SCALP clean plan',
        perfectReads: { atrVal: 500, atrVal15: 80 },
      },
      tier: 'clean',
    };
    const html = ctx.hgObtcSetupCardHtml(pick, {});
    ok(/ATR14 \(15m\) 80\.00/.test(html), 'SCALP card prints "ATR14 (15m) 80.00"');
    ok(/ATR14 \(4h\) 500\.00/.test(html), 'SCALP card prints "ATR14 (4h) 500.00" beside 15m');
  }

  /* SWING card: no (15m) label, no (4h) label */
  {
    const pick = {
      row: {
        dir: 'long', entry: 65000, stop: 64000, t1: 66500, engine: 'SWING clean plan',
        perfectReads: { atrVal: 500, atrVal15: 80 },
      },
      tier: 'clean',
    };
    const html = ctx.hgObtcSetupCardHtml(pick, {});
    ok(/ATR14 500\.00/.test(html), 'SWING card prints bare "ATR14 500.00"');
    ok(!/ATR14 \(15m\)/.test(html), 'SWING card does NOT print "(15m)"');
  }
}

/* ---------- §6: no gate reads the new fields ---------- */
console.log('\n[§6] no gate reads the new fields');
{
  const gateFiles = ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
    'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'];
  for (const gf of gateFiles){
    let src;
    try { src = read(gf); } catch(e){ ok(false, `${gf} missing`); continue; }
    ok(!/atrVal15/.test(src), `${gf}: no gate reads atrVal15`);
    ok(!/planLong|planShort/.test(src) || gf === 'plans.js',
      `${gf}: no gate reads the new panel helpers (plans.js excluded)`);
  }
}

/* ---------- §7: ship stamps ---------- */
console.log('\n[§7] ship stamps align');
{
  const { HG_VER, swCacheOk } = await import('./helpers/build-version.mjs');
  ok(/^hg-v\d+$/.test(HG_VER), `HG_VER matches shape: ${HG_VER}`);
  ok(swCacheOk(read('sw.js')), `sw.js HG_CACHE matches ${HG_VER}`);
  const trendtable = read('trendtable.js');
  const verNum = HG_VER.replace(/^hg-v/, '');
  const ttRe = new RegExp("\\?v=" + verNum + "\\b");
  ok(ttRe.test(trendtable), `trendtable.js ?v=${verNum} matches`);
  const buildStamp = read('build-stamp.js');
  const bsRe = new RegExp("version:\\s*'" + HG_VER + "'");
  ok(bsRe.test(buildStamp), `build-stamp.js version: '${HG_VER}'`);
}

console.log(`\n== hg-v1303 four OMNIBTC defects: ${passed} passed, ${failed} failed ==`);
process.exit(failed === 0 ? 0 : 1);
