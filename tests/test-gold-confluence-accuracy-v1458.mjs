#!/usr/bin/env node
/* hg-v1458 — CONFLUENCE accuracy round (rebased over upstream hg-v1455..v1457).
   ① The 100-point stack was starving the tab's own plan: hg-v1454 scores
   the median with stratKey 'confluence', a key that matched no mechanic
   family, so location read 2/… (not 7), trigger 3/10 (not 7) and volume
   0/10 (not 4) — a fully aligned plan capped near 66, UNDER the 68 WATCH
   bar. Upstream made the score a LABEL on the card (hg-v1455), which
   makes an honest score MORE important, not less: a starved 66 would
   mislead on every scan. The stack now teaches the key its honest
   brackets: location = desk-chosen structural levels (7), trigger =
   family bracket (7, never the alert 10 — the median carries every
   member's fired trigger but no single alert-tier stamp), volume = the
   participation floor the member desks' own gates already passed (4).
   Measured on the BOS tape below: 79/GOOD/alert WITH the macro read,
   77/WATCH without it, 66/NO_TRADE with the brackets stripped — the
   exact 13-point starvation. The stack discriminates: short on the same
   bull tape and a long on chop both read NO_TRADE. The score is fed the
   cached macro ledger when read (cfMacro, fail-open).
   ② Risk shape in the build, in the upstream hg-v1456 direction — NAMED,
   never gating: when a forming plan's stop distance sits outside
   0.5x-2x of the pack median risk, the reason names the disagreement
   (the median stop is no desk's measured plan) and accuracy.riskOk
   carries it. The setup STAYS on the card.
   ③ crownOk dead code removed: the hg-v1391 branch was unreachable from
   the day hg-v1452 dropped the crown requirement, and the HIGH line
   printed "N/N crowned" with the same number twice. The count is now
   crowned-of-formed, honestly.
   ④ Record-only marks (counted, never gated): a two-plan pack from one
   mechanic family is familyShort; the leading plan's signal older than
   eight hours is staleSignal; both three-state absent when unread.
   Mutation-proven: kill any leg and its assertion goes RED. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(label, cond){
  if (cond){ pass++; return; }
  fail++;
  console.error('FAIL §' + label);
}
function eq(label, a, b){
  if (a === b){ pass++; return; }
  fail++;
  console.error('FAIL §' + label + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}

/* ---------- §1 the stack scores the confluence key (real scorer) ---------- */
const IND1 = fs.readFileSync(path.join(ROOT, 'indicators.js'), 'utf8');
const IND2 = fs.readFileSync(path.join(ROOT, 'indicators2.js'), 'utf8');
const GOLDIND = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
function bootScorer(giSrc){
  /* A fresh context per boot: the mutation harness re-runs goldind in the
     same process and a let-declared memo will not re-declare in a shared
     context. window points at the context itself, exactly like the browser. */
  const ctx = { console: { log(){}, warn(){}, error(){} } };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(IND1, ctx, { filename: 'indicators.js' });
  vm.runInContext(IND2, ctx, { filename: 'indicators2.js' });
  vm.runInContext(giSrc || GOLDIND, ctx, { filename: 'goldind.js' });
  return ctx;
}

/* A rising tape with 5-bar-shouldered swings (goldSwings needs real
   fractal separation: an up bar shares no high with the next down bar),
   a pullback deep enough to hold RSI(14) inside 50-75, and a breakout
   that closes above the last swing high — trend 'bullish', BOS true. */
function bosTape(){
  const rows = [];
  const t0 = Math.floor(Date.UTC(2026, 6, 1) / 1000);
  let c = 2600, i = 0;
  function bar(step, v){
    const o = c;
    c = +(c + step).toFixed(2);
    const h = step >= 0 ? +(c + 1).toFixed(2) : o;
    const l = step >= 0 ? o : +(c - 1).toFixed(2);
    rows.push({ t: t0 + i * 14400, o, h, l, c, v });
    i++;
  }
  for (let w = 0; w < 10; w++){
    for (let k = 0; k < 5; k++) bar(4.5, 1100);
    for (let k = 0; k < 5; k++) bar(-3.0, 700);
  }
  for (let k = 0; k < 7; k++) bar(-3.0, 700);
  for (let k = 0; k < 6; k++) bar(6.2, 1300 + k * 50);
  return rows;
}
function chopTape(){
  const rows = [];
  const t0 = Math.floor(Date.UTC(2026, 6, 1) / 1000);
  for (let i = 0; i < 120; i++){
    const o = 2600 + ((i % 2) ? 2 : -2);
    const c = 2600 + ((i % 2) ? -2 : 2);
    rows.push({ t: t0 + i * 14400, o, h: Math.max(o, c) + 1, l: Math.min(o, c) - 1, c, v: 900 });
  }
  return rows;
}
function scoreConfluence(W, rows, dir, macro){
  const px = rows[rows.length - 1].c;
  return W.hgGoldConfluenceScore(
    { dir: dir, stratKey: 'confluence', entry: px, agree: 3, confirmed: true },
    { rows15m: rows, rows1h: rows, rows4h: rows, macro: macro || null, newsGate: { lock: false } });
}
const W1 = bootScorer();
const TAPE = bosTape();
const mst = W1.goldMarketStructure(TAPE);
eq('1.a structure reads bullish BOS', mst.trend + (mst.bos ? '+bos' : ''), 'bullish+bos');
const aligned = scoreConfluence(W1, TAPE, 'long', { realRateHint: 'TAILWIND' });
eq('1.b aligned + tailwind score', aligned.score, 79);
eq('1.c tier', aligned.tier, 'GOOD');
ok('1.d alert ok at GOOD', aligned.alertOk === true);
eq('1.e htf full', aligned.parts.htf, 25);
eq('1.f location carries the structural credit', aligned.parts.location, 14);
eq('1.g momentum full band', aligned.parts.momentum, 13);
eq('1.h vol regime', aligned.parts.volRegime, 8);
eq('1.i participation floor', aligned.parts.volume, 4);
eq('1.j macro fed', aligned.parts.macro, 8);
eq('1.k trigger family bracket (never the alert 10)', aligned.parts.trigger, 7);
const noMacro = scoreConfluence(W1, TAPE, 'long', null);
eq('1.l no macro read is 77 WATCH (the leg is fed when read)', noMacro.score, 77);
eq('1.m no macro tier', noMacro.tier, 'WATCH');
const shortOnBull = scoreConfluence(W1, TAPE, 'short', { realRateHint: 'HEADWIND' });
ok('1.n short on the bull tape is NO_TRADE (got ' + shortOnBull.score + ')', shortOnBull.tier === 'NO_TRADE' && shortOnBull.score < 68);
const chopLong = scoreConfluence(W1, chopTape(), 'long', { realRateHint: 'TAILWIND' });
ok('1.o long on chop is NO_TRADE (got ' + chopLong.score + ')', chopLong.tier === 'NO_TRADE' && chopLong.score < 68);
const unknownKey = W1.hgGoldConfluenceScore(
  { dir: 'long', stratKey: 'zzz-unknown', entry: TAPE[TAPE.length - 1].c, agree: 3, confirmed: true },
  { rows15m: TAPE, rows1h: TAPE, rows4h: TAPE, macro: { realRateHint: 'TAILWIND' }, newsGate: { lock: false } });
eq('1.p an unknown key still reads the starved 66 (the 13-point gap the fix removes)', unknownKey.score, 66);
eq('1.q starved location', unknownKey.parts.location, 9);
eq('1.r starved trigger', unknownKey.parts.trigger, 3);
eq('1.s starved volume', unknownKey.parts.volume, 0);

/* ---------- §2 build accuracy legs (the REAL hgGoldConfluenceBuild) ---------- */
function bootBuild(src){
  const win = { HG_tabs: [] };
  const ctx = { window: win, globalThis: win, console };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return win;
}
const SRC = fs.readFileSync(path.join(ROOT, 'gold-confluence.js'), 'utf8');
const W2 = bootBuild(SRC);
const build = W2.hgGoldConfluenceBuild;
function vote(desk, id, side, entry, stop, t1, extra){
  return Object.assign({
    desk: desk, id: id, state: 'setup', side: side, entry: entry, stop: stop, t1: t1,
    grade: 'A', lead: true
  }, extra || {});
}
/* coherent risks (10 vs 11): ready, HIGH */
const coh = build([
  vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2670),
  vote('GOLD SWING', 'goldswing', 'long', 2651, 2640.5, 2671)
], { px: 2651 }, { spreadUsd: 0.30 });
eq('2.a coherent risks stay ready', coh.ready, true);
ok('2.b coherent accuracy HIGH', coh.accuracyTier === 'HIGH' && coh.accuracy.riskOk === true);
eq('2.c crowned printed as crowned-of-formed', /2\/2 crowned/.test(coh.reason), true);
/* incoherent risks (10 vs 31): the setup STAYS on the card and the risk
   disagreement is NAMED (the hg-v1456 direction — named, never gating).
   t1s sit wide enough that netR clears both the 1R cost bar and the
   1.20R accuracy bar, so the named leg is risk alone. */
const incoh = build([
  vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2680),
  vote('GOLD SWING', 'goldswing', 'long', 2650.5, 2619.5, 2685)
], { px: 2651 }, { spreadUsd: 0.30 });
eq('2.d incoherent risk shape stays on the card', incoh.ready, true);
ok('2.e no watch is minted for a named caveat', !incoh.watch);
ok('2.f reason names the disagreement', /do not agree where risk lives/.test(incoh.reason));
eq('2.g accuracy carries riskOk', incoh.accuracy.riskOk, false);
ok('2.h accuracy tier reads WATCH', incoh.accuracyTier === 'WATCH');
/* loose cluster: named, never gating (upstream hg-v1456) */
const loose = build([
  vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2670),
  vote('GOLD SWING', 'goldswing', 'long', 2672, 2660, 2692)
], { px: 2651 }, { spreadUsd: 0.30 });
eq('2.i loose cluster stays on the card', loose.ready, true);
ok('2.j loose cluster is named', /Cluster spread 0\.83% is loose/.test(loose.reason));
eq('2.k loose accuracy carries the flag', loose.accuracy.tight, false);
/* cost leg: netR 1.15 passes applyCost (>=1R) but fails the 1.20R accuracy bar — named */
const cost = build([
  vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2610, 2730),
  vote('GOLD SWING', 'goldswing', 'long', 2650.5, 2610.5, 2730.5)
], { px: 2651 }, { spreadUsd: 34 });
eq('2.l thin net stays on the card', cost.ready, true);
ok('2.m thin net is named', /under 1\.20R/.test(cost.reason));
eq('2.n cost accuracy carries the flag', cost.accuracy.netOk, false);
/* crowned-of-formed on a pack with one uncrowned plan in the median */
const mixed = build([
  vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2670, { grade: 'A', lead: true }),
  vote('GOLD SWING', 'goldswing', 'long', 2651, 2640.5, 2671, { grade: null, lead: false })
], { px: 2651 }, { spreadUsd: 0.30 });
eq('2.o one crown of two is printed honestly', /1\/2 crowned/.test(mixed.reason), true);
eq('2.p crownOk dead field is gone', mixed.accuracy.crownOk, undefined);
eq('2.q crownTotal rides the accuracy object', mixed.accuracy.crownTotal, 2);

/* ---------- §3 record-only family mark on a two-plan pack ---------- */
const famPair = build([
  vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2670),
  vote('GANESH GOLD', 'ganeshgold', 'long', 2650.5, 2640.5, 2670.5)
], { px: 2651 }, { spreadUsd: 0.30 });
eq('3.a same-family pair is still ready (marked, not gated)', famPair.ready, true);
eq('3.b same-family pair carries the mark', famPair.reads['cf:familyShort'], true);
const twoFam = build([
  vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2670),
  vote('GOLD SWING', 'goldswing', 'long', 2651, 2640.5, 2671)
], { px: 2651 }, { spreadUsd: 0.30 });
eq('3.c two families leave the key absent (three-state)', twoFam.reads['cf:familyShort'], undefined);

/* ---------- §4 stale-signal mark on the forward record (scan path) ---------- */
async function scanWith(W, barT){
  const rec = [];
  W.HG_tabs = W.HG_tabs || [];
  W.hgGoldIuxAnchor = async () => ({ px: 2651.5, at: 1, src: 'gold-api' });
  W.goldspotState = () => ({ spot: 2651.5, xm: 2651.2 });
  W.hgFwdRecordScan = (tab, tf, cands) => { rec.push({ tab, tf, cands: cands.slice() }); return 1; };
  const cand = (entry, stop, t1) => ({
    dir: 'long', entry: entry, stop: stop, t1: t1, grade: 'A',
    barT: (typeof barT === 'number') ? barT : undefined
  });
  W.goldscalpScan = () => ({ cands: [cand(2650, 2640, 2670)] });
  W.goldswingScan = () => ({ cands: [cand(2651, 2641, 2671)] });
  const built = await W.hgGoldConfluenceScan(W);
  return { built: built, rec: rec };
}
{
  const W4 = bootBuild(SRC);
  const staleSec = Math.floor(Date.now() / 1000) - 12 * 3600;
  const r1 = await scanWith(W4, staleSec);
  eq('4.a stale-signal scan is still ready (marked, not gated)', r1.built.ready, true);
  eq('4.b record carries staleSignal true', r1.rec[0].cands[0].reads['cf:staleSignal'], true);
  const W5 = bootBuild(SRC);
  const r2 = await scanWith(W5, Math.floor(Date.now() / 1000) - 300);
  eq('4.c fresh signal leaves the mark false', r2.rec[0].cands[0].reads['cf:staleSignal'], false);
  eq('4.d fresh-signal scan ready', r2.built.ready, true);
  const W6 = bootBuild(SRC);
  const r3 = await scanWith(W6, undefined);
  eq('4.e no signal instant leaves the mark absent (three-state)', r3.rec[0].cands[0].reads['cf:staleSignal'], undefined);
  eq('4.f no-instant scan ready', r3.built.ready, true);
}

/* ---------- §5 ship stamps ---------- */
{
  const stamp = fs.readFileSync(path.join(ROOT, 'build-stamp.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const tt = fs.readFileSync(path.join(ROOT, 'trendtable.js'), 'utf8');
  ok('5.a version shape', /^hg-v\d+$/.test(HG_VER));
  eq('5.b build-stamp version', HG_VER, 'hg-v1481');
  ok('5.c sw cache matches', new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw));
  ok('5.d index rides gold-confluence.js?v=1481', idx.includes('gold-confluence.js?v=1481'));
  ok('5.e index rides goldind.js?v=1481', idx.includes('goldind.js?v=1481'));
  ok('5.f trendtable stamped', tt.includes('hg-v1481.'));
  ok('5.g header carries the round own pack stamp', SRC.includes('hg-v1458'));
  const led = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'batch-ledger.json'), 'utf8'));
  const last = led.batches[led.batches.length - 1];
  eq('5.h ledger last entry', last.version, 'hg-v1481');
  const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  ok('5.i AGENTS.md carries the round', agents.includes('hg-v1460'));
}

/* ---------- §6 mutation harness: every leg is load-bearing ---------- */
{
  const giOriginal = GOLDIND;
  const cfOriginal = SRC;

  function runScorerMutation(name, mutate, isCaught){
    const mutated = mutate(giOriginal);
    if (mutated === giOriginal){ fail++; console.error('MUTATION ' + name + ' did not change source'); return; }
    const W = bootScorer(mutated);
    const sc = scoreConfluence(W, bosTape(), 'long', { realRateHint: 'TAILWIND' });
    if (isCaught(sc)){ pass++; }
    else { fail++; console.error('MUTATION ' + name + ' NOT CAUGHT'); }
  }
  /* kill ALL THREE confluence brackets at once -> back to the starved 66 */
  runScorerMutation('M1_strip_confluence_brackets',
    s => s.replace(/key === 'confluence'/g, "key === 'zzznope'"),
    sc => sc.score === 66 && sc.alertOk !== true);
  /* starve only location -> 79 - 5 = 74 */
  runScorerMutation('M2_strip_location_credit',
    s => s.replace(/p\.location \+= 7; tools\.push\('S\/R location \(desk median levels\)'\);/, 'p.location += 2;'),
    sc => sc.score === 74);
  /* starve only trigger -> 79 - 4 = 75 */
  runScorerMutation('M3_strip_trigger_bracket',
    s => s.replace(/else if \(key === 'confluence'\)\n      p\.trigger \+= 7;/, 'else if (key === \'zzznope\')\n      p.trigger += 7;'),
    sc => sc.score === 75);
  /* starve only volume -> 79 - 4 = 75 */
  runScorerMutation('M4_strip_volume_floor',
    s => s.replace(/else if \(key === 'confluence'\) p\.volume \+= 4;/, 'else if (key === \'zzznope\') p.volume += 4;'),
    sc => sc.score === 75);

  function runBuildMutation(name, mutate, isCaught){
    const mutated = mutate(cfOriginal);
    if (mutated === cfOriginal){ fail++; console.error('MUTATION ' + name + ' did not change source'); return; }
    const W = bootBuild(mutated);
    try{
      if (isCaught(W.hgGoldConfluenceBuild)){ pass++; }
      else { fail++; console.error('MUTATION ' + name + ' NOT CAUGHT'); }
    }catch(e){ pass++; }
  }
  /* risk-shape read removed -> the incoherent pack stops being named
     and accuracy.riskOk reads true (the named caveat is the whole point) */
  runBuildMutation('M5_risk_shape_read_removed',
    s => s.replace(/return medRisk > 0 && r > 0 && \(r \/ medRisk\) >= 0\.5 && \(r \/ medRisk\) <= 2;/, 'return true;'),
    bb => {
      const m = bb([
        vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2680),
        vote('GOLD SWING', 'goldswing', 'long', 2650.5, 2619.5, 2685)
      ], { px: 2651 }, { spreadUsd: 0.30 });
      return m.ready === true && !(/do not agree where risk lives/.test(m.reason)) && m.accuracy.riskOk === true;
    });
  /* the 2-pack familyShort mark dropped -> §3.b goes undefined */
  runBuildMutation('M6_family_pair_mark_dropped',
    s => s.replace(/else if \(pack\.length === 2 && nFam < 2\) reads\['cf:familyShort'\] = true;/, ''),
    bb => bb([
      vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2670),
      vote('GANESH GOLD', 'ganeshgold', 'long', 2650.5, 2640.5, 2670.5)
    ], { px: 2651 }, { spreadUsd: 0.30 }).reads['cf:familyShort'] !== true);
  /* crowned-of-formed reverted to the doubled N/N print */
  runBuildMutation('M7_crown_print_reverted',
    s => s.replace(/\+ crowned \+ '\/' \+ formed\.length \+ ' crowned\. The venue spread was not read/, "+ crowned + '/' + crowned + ' crowned. The venue spread was not read"),
    bb => {
      const m = bb([
        vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2670, { grade: 'A', lead: true }),
        vote('GOLD SWING', 'goldswing', 'long', 2651, 2640.5, 2671, { grade: null, lead: false })
      ], { px: 2651 });
      return !(/1\/2 crowned/.test(m.reason));
    });
  /* the risk-shape naming line dropped -> the card no longer tells the
     reader the desks disagree on where risk lives */
  runBuildMutation('M8_risk_naming_dropped',
    s => s.replace(/base\.reason \+= ' The desks agree ' \+ side\.toUpperCase\(\) \+ '[^;]*;/, "/* M8 */"),
    bb => {
      const m = bb([
        vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2680),
        vote('GOLD SWING', 'goldswing', 'long', 2650.5, 2619.5, 2685)
      ], { px: 2651 }, { spreadUsd: 0.30 });
      return !(/do not agree where risk lives/.test(m.reason));
    });

  /* stale-signal mark: the 8h bar widened until it can never fire */
  {
    const mutated = cfOriginal.replace(/> 8 \* 3600;/, '> 8 * 3600 * 10000;');
    if (mutated === cfOriginal){ fail++; console.error('MUTATION M9 did not change source'); }
    else {
      const W = bootBuild(mutated);
      const r = await scanWith(W, Math.floor(Date.now() / 1000) - 12 * 3600);
      if (r.rec[0].cands[0].reads['cf:staleSignal'] !== true){ pass++; }
      else { fail++; console.error('MUTATION M9_stale_mark_never_fires NOT CAUGHT'); }
    }
  }
}

console.log(pass + ' assertions passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
