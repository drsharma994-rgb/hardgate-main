/**
 * hg-v927 — how old the walk behind each gold desk is, said on the desk.
 *
 * Every suppress / demote / prefer on GOLD SCALP and every mechanic verdict on
 * OMNIGOLD comes from ONE replay, and the only record of when that replay ran
 * was prose in a comment — which no desk can read and no re-bake updates. A
 * trader opening either tab was gated by a walk of entirely unstated age,
 * presented as current. hgOgEvidenceStaleHtml watches the GATE SET moving
 * under the evidence and hgOgEvidenceHealthHtml watches its thinness; neither
 * watches the CALENDAR.
 *
 * This guard pins four things:
 *   1. the spans equal the artifacts they claim to come from;
 *   2. the age is computed at RENDER time, not baked (a baked "11 days" is
 *      wrong the next morning);
 *   3. NO staleness threshold is invented — nothing here measures gold-edge
 *      decay, so there is no honest "too old to trade" line;
 *   4. scripts/rebake-gold-literals.mjs rewrites both spans, so the next
 *      re-bake moves them and nobody has to remember to.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));

const GI_SRC = readFileSync(join(ROOT, 'goldind.js'), 'utf8');
const OG_SRC = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
const ctx = {
  Math, Date, JSON, isFinite, parseFloat, parseInt, Array, Object, String, Number,
  setTimeout: () => 0, clearTimeout: () => {},
  console: { log(){}, warn(){}, error(){} },
  document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
              addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem(){} },
  location: { href: '' }, fetch: () => Promise.reject(new Error('offline'))
};
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
try { vm.runInContext(GI_SRC, ctx, { timeout: 20000 }); } catch (e) {}
try { vm.runInContext(OG_SRC, ctx, { timeout: 30000 }); } catch (e) {}

const GS = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldscalp-results-floor.json'), 'utf8'));
const OG = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-omnigold-results.json'), 'utf8'));

/* ---- 1. the spans are the artifacts', re-derived not transcribed ---- */
console.log('1. each span equals the artifact it names');
for (const [label, live, raw, srcPath] of [
  ['GOLD SCALP', ctx.HG_GOLD_EDGE_WALK, GS, 'scripts/backtest-goldscalp-results-floor.json'],
  ['OMNIGOLD',   ctx.HG_OG_WALK,        OG, 'scripts/backtest-omnigold-results.json']]){
  ok(live && typeof live === 'object', label + ' exposes its walk span');
  if (!live) continue;
  eq(live.from, raw.meta.span.from, label + ' span start');
  eq(live.to, raw.meta.span.to, label + ' span end');
  eq(live.generated, raw.meta.generated, label + ' generation stamp');
  eq(live.trades, raw.trades.length, label + ' trade count');
  eq(live.src, srcPath, label + ' names the file it came from');
}

/* ---- 2. the age is computed against the clock, never baked ---- */
console.log('2. the age is render-time, so it cannot itself go stale');
{
  const DAY = 86400000;
  const gEnd = Date.parse(GS.meta.span.to), oEnd = Date.parse(OG.meta.span.to);
  eq(ctx.hgGoldEdgeWalkAgeDays(gEnd), 0, 'zero days at the instant the walk ended');
  eq(ctx.hgGoldEdgeWalkAgeDays(gEnd + 5 * DAY), 5, 'five days later it is five');
  eq(ctx.hgGoldEdgeWalkAgeDays(gEnd + 5 * DAY + 23 * 3600000), 5,
     'and still five 23 hours after that — whole days, floored, never rounded early');
  eq(ctx.hgOgWalkAgeDays(oEnd + 40 * DAY), 40, 'the OMNIGOLD one counts the same way');
  eq(ctx.hgOgWalkAgeDays(oEnd), 0, 'zero at the instant its walk ended');
  eq(ctx.hgOgWalkAgeDays(oEnd + 40 * DAY + 23 * 3600000), 40,
     'and still 40 with 23 hours on top — floored on BOTH desks, not just one');
  /* a clock before the walk end is nonsense, not a negative age */
  eq(ctx.hgGoldEdgeWalkAgeDays(gEnd - DAY), null, 'a clock before the walk ended reports nothing');
  eq(ctx.hgOgWalkAgeDays(oEnd - DAY), null, 'on both desks');
  eq(ctx.hgGoldEdgeWalkAgeNote(gEnd - DAY), '', 'and renders nothing rather than a negative');
  eq(ctx.hgOgWalkAgeHtml(oEnd - DAY), '', 'on both desks');
  /* the rendered number tracks the clock it was given */
  ok(/IS 5 DAYS OLD/.test(ctx.hgOgWalkAgeHtml(oEnd + 5 * DAY)), 'the panel prints the computed age');
  ok(/IS 1 DAY OLD\b/.test(ctx.hgOgWalkAgeHtml(oEnd + DAY)), 'and gets the singular right');
  ok(/IS 1 DAY OLD\b/.test(ctx.hgGoldEdgeWalkAgeNote(gEnd + DAY)), 'on both desks');
  ok(/IS 2 DAYS OLD/.test(ctx.hgGoldEdgeWalkAgeNote(gEnd + 2 * DAY)), 'and the plural');
  /* and NO literal day-count is written into either source */
  ok(!/\b1[0-9] DAYS OLD/.test(GI_SRC) && !/\b1[0-9] DAYS OLD/.test(OG_SRC),
     'no day count is hard-coded into either string');
}

/* ---- 3. NO staleness threshold is invented ---- */
console.log('3. it reports the age and draws no line');
{
  const DAY = 86400000;
  const g = ctx.hgGoldEdgeWalkAgeNote(Date.parse(GS.meta.span.to) + 400 * DAY);
  const o = ctx.hgOgWalkAgeHtml(Date.parse(OG.meta.span.to) + 400 * DAY);
  ok(/400 DAY/.test(g) && /400 DAY/.test(o), 'a 400-day-old walk still just reports 400 days');
  for (const [h, label] of [[g, 'GOLD SCALP'], [o, 'OMNIGOLD']]){
    ok(/No staleness threshold is attached|no staleness threshold is attached/i.test(h),
       label + ' says no threshold is attached');
    ok(/decay/.test(h), label + ' says why — nothing measures how fast the edge decays');
    ok(/gold:rebake/.test(h), label + ' names the command that fixes it');
    /* the phrase "too old to trade" DOES appear — inside the sentence saying
       such a line would be invented rather than measured. So assert the
       refusal, and separately that no imperative to stop is present. A bare
       negative lookahead on the phrase passed on the quote mark after it. */
    ok(/would be invented|invented rather than measured|refuses elsewhere/.test(h),
       label + ' frames that line as invented, not drawn');
    ok(!/do not trade|stop trading|avoid trading|is too old to trade\./i.test(h),
       label + ' never tells the reader to stop on an invented bar');
  }
  /* and nothing GATES on the age */
  ok(!/hgOgWalkAgeDays\(\)[\s\S]{0,80}(pass|dropped|veto)/.test(OG_SRC),
     'no gate reads the age');
  ok(!/hgGoldEdgeWalkAgeDays\(\)[\s\S]{0,80}(dropped|reject|demote)/.test(GI_SRC),
     'nor any gold-scalp rejection');
}

/* ---- 4. wired where a reader meets it ---- */
console.log('4. rendered on both desks, above what it qualifies');
ok(/\+ hgOgWalkAgeHtml\(\)/.test(OG_SRC), 'OMNIGOLD panel chain calls it');
ok(/\+ hgOgWalkAgeHtml\(\)[\s\S]{0,200}\+ hgOgEdgeRelaxedPanelHtml\(\)/.test(OG_SRC),
   'first, before the tables and verdicts it qualifies');
const GSCALP = readFileSync(join(ROOT, 'goldscalp.js'), 'utf8');
ok(/hgGoldEdgeWalkAgeNote\(\)/.test(GSCALP), 'GOLD SCALP WHY SILENT calls it');
ok(/\.gsx-walkage\{/.test(GSCALP), 'and it has styling rather than inheriting none');

/* ---- 5. the re-bake keeps both spans current ---- */
console.log('5. a re-bake rewrites both spans — nobody has to remember');
{
  const W = readFileSync(join(ROOT, 'scripts/rebake-gold-literals.mjs'), 'utf8');
  ok(/function walkBlock/.test(W), 'the writer has a walk-span rewriter');
  ok(/HG_GOLD_EDGE_WALK/.test(W) && /HG_OG_WALK/.test(W), 'and rewrites both blocks');
  ok(/throw new Error\('rebake: ' \+ r\.err\)/.test(W),
     'a block it cannot locate is FATAL, never skipped — the hg-v921 rule');
  /* the committed tree round-trips to zero drift, which proves the writer
     reproduces exactly what is in the files rather than merely not crashing */
  const out = execFileSync('node', [join(ROOT, 'scripts/rebake-gold-literals.mjs')],
                           { cwd: ROOT, encoding: 'utf8' });
  ok(/every baked literal already equals its artifact/.test(out),
     'and the committed tree reports zero drift');
  ok(/walk span: already matches/.test(out), 'including both walk spans');
  eq((out.match(/walk span: already matches/g) || []).length, 2, 'both of them');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
