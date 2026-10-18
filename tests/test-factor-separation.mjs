/**
 * hg-v922 — which signal-time factor actually separates winners.
 *
 * Both gold desks now carry a baked table answering "how do we raise the win
 * rate" with a measurement rather than a rule. This guard does NOT trust those
 * literals: it re-runs scripts/factor-separation.mjs against both committed
 * replays and fails on any drift, so a re-bake cannot leave either table
 * quietly stale — the failure hg-v916 found in the edge table.
 *
 * It also pins the three things the measurement REFUSED, because the in-sample
 * read invites all three and a later reader will find the same invitation:
 *   1. a 0.28% (or any) scalp stop bar, because the unanimity appears at 0.28,
 *      vanishes at 0.32 and 0.40, and returns at 0.50 — a searched number;
 *   2. retiring OMNIGOLD's FAIR tier, which is unanimous at ONE fill bound;
 *   3. reading a win-rate rise as an improvement without its gross column.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { bake, run, measure, scalpBook, ogBook, stopPct, WINDOWS, XM_RT_PCT,
         COST_BAR_PCT, SUPPRESSED, SCALP_FACTORS, OG_FACTORS,
         MIN_SIDE_SCALP, MIN_SIDE_OG } from '../scripts/factor-separation.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));

/* ---- load both real modules, no stubbed copies ---- */
function load(file, extra){
  const W = {};
  const ctx = Object.assign({
    window: W, self: W, globalThis: W, Math, Date, JSON, isFinite, parseFloat, parseInt,
    Array, Object, String, Number, setTimeout: () => 0, clearTimeout: () => {},
    console: { log(){}, warn(){}, error(){} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
                addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem(){} },
    location: { href: '' }, fetch: () => Promise.reject(new Error('offline'))
  }, extra || {});
  vm.createContext(ctx);
  try { vm.runInContext(readFileSync(join(ROOT, file), 'utf8'), ctx, { timeout: 30000 }); }
  catch (e) { /* each module guards its own env */ }
  return W;
}
const GI = load('goldind.js');
const OG = load('omnigold.js');
const SCALP_TABLE = GI.HG_GOLD_FACTOR_SEP, SCALP_HTML = GI.hgGoldFactorSepHtml;
const OG_TABLE = OG.HG_OG_FACTOR_SEP, OG_HTML = OG.hgOgFactorSepPanelHtml;
ok(SCALP_TABLE && Array.isArray(SCALP_TABLE.rows), 'goldind.js exports HG_GOLD_FACTOR_SEP');
ok(typeof SCALP_HTML === 'function', 'goldind.js exports hgGoldFactorSepHtml');
ok(OG_TABLE && Array.isArray(OG_TABLE.rows), 'omnigold.js exports HG_OG_FACTOR_SEP');
ok(typeof OG_HTML === 'function', 'omnigold.js exports hgOgFactorSepPanelHtml');

const measured = bake();

/* ---- 1. every literal, both desks, re-derived from the replays ---- */
console.log('1. every baked number is re-derived from the committed replays');
for (const [deskName, live, want] of [['GOLD SCALP', SCALP_TABLE, measured.scalp],
                                      ['OMNIGOLD', OG_TABLE, measured.og]]){
  if (!live || !live.rows) continue;
  eq(live.windows, measured.windows, deskName + ' window count');
  eq(live.rtPct, measured.rtPct, deskName + ' venue round trip the net column is priced at');
  for (const end of ['asRecorded', 'lower']){
    eq(live.book[end].n, want.book[end].n, deskName + ' ' + end + ' book n');
    eq(live.book[end].win, want.book[end].win, deskName + ' ' + end + ' book win%');
    eq(live.book[end].gross, want.book[end].gross, deskName + ' ' + end + ' book gross');
    eq(live.book[end].net, want.book[end].net, deskName + ' ' + end + ' book net');
  }
  eq(live.rows.length, want.rows.length, deskName + ' row count');
  for (let i = 0; i < want.rows.length; i++){
    const g = live.rows[i], w = want.rows[i];
    eq(g.f, w.f, deskName + ' row ' + i + ' factor name and order');
    eq(g.n, w.n, deskName + ' ' + w.f + ' n');
    if (w.thin){ eq(g.thin, true, deskName + ' ' + w.f + ' stays marked thin'); continue; }
    for (const col of ['dWin', 'dGross', 'dNet']){
      eq(g[col][0], w[col][0], deskName + ' ' + w.f + ' ' + col + ' as-recorded');
      eq(g[col][1], w[col][1], deskName + ' ' + w.f + ' ' + col + ' lower bound');
    }
    eq(g.q[0], w.q[0], deskName + ' ' + w.f + ' window agreement as-recorded');
    eq(g.q[1], w.q[1], deskName + ' ' + w.f + ' window agreement lower bound');
    eq(g.verdict, w.verdict, deskName + ' ' + w.f + ' verdict');
  }
  eq(live.bars.length, want.bars.length, deskName + ' bar sweep length');
  for (let i = 0; i < want.bars.length; i++){
    eq(live.bars[i].bar, want.bars[i].bar, deskName + ' bar ' + i + ' value');
    eq(live.bars[i].n, want.bars[i].n, deskName + ' bar ' + want.bars[i].bar + ' n');
    eq(live.bars[i].holds[0], want.bars[i].holds[0], deskName + ' bar ' + want.bars[i].bar + ' holds as-recorded');
    eq(live.bars[i].holds[1], want.bars[i].holds[1], deskName + ' bar ' + want.bars[i].bar + ' holds lower');
  }
}

/* ---- 2. the verdict rule is both-bounds, and it is doing work ---- */
console.log('2. a verdict needs BOTH fill bounds, and that rule changes an answer');
const raw = run();
const ogRaw0 = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-omnigold-results.json'), 'utf8'));
const fair = raw.og.lower['tier FAIR'], fairA = raw.og['as-recorded']['tier FAIR'];
/* hg-v1404 recalibration: on the hg-v1402 walk tier FAIR is unanimous at
   NEITHER bound (the old walk's lower-bound unanimity did not reproduce).
   The hg-v918 rule this section exists to pin — one end of the fill interval
   is not a verdict — is unchanged, and the fresh reading is its own proof:
   a verdict that was visible at one end alone evaporated when re-measured. */
eq(fair.sign, null, 'tier FAIR is unanimous at neither bound on the hg-v1402 walk');
eq(fairA.sign, null, 'and not at the as-recorded bound either');
eq(OG_TABLE.rows.find((r) => r.f === 'tier FAIR').verdict, null,
   'so tier FAIR carries no verdict — one end of the fill interval is not a verdict (hg-v918)');
ok(fairA.grossQ[0] > 0 && fairA.grossQ[0] < fairA.grossQ[1],
   'and it is the GROSS column that splits at the as-recorded end, not win or net');
/* if this ever became unanimous at both ends it would retire 54% of the book
   (was 77% on the old walk), which is exactly why the rule is pinned here */
ok(fair.nA / raw.book.lower.og.n > 0.5, 'FAIR is over half of OMNIGOLD settled rows');

/* ---- 2b. the lower bound is NOT neutral for the limit-vs-market split ---- */
console.log('2b. the lower bound is NOT neutral for the limit-vs-market split (and on the hg-v1402 walk there is no verdict left to rest anywhere)');
const ogAll = ogRaw0.trades.filter((t) => typeof t.rMultiple === 'number');
const ambByType = { LIMIT: 0, STOP: 0, MARKET: 0 };
const kindOf = (t) => (/LIMIT$/.test(t.orderType || '') ? 'LIMIT'
  : (/STOP$/.test(t.orderType || '') ? 'STOP' : 'MARKET'));
const totByType = { LIMIT: 0, STOP: 0, MARKET: 0 };
for (const t of ogAll){ totByType[kindOf(t)]++; if (t.ambiguousSameBarWin) ambByType[kindOf(t)]++; }
eq(ambByType.MARKET, 0,
   'no market row is ever flagged unprovable — a market touch needs no proving');
ok(ambByType.LIMIT > 400, 'but hundreds of limit rows are (' + ambByType.LIMIT + ' of ' + totByType.LIMIT + ')');
/* so the lower bound demotes ONE SIDE of the limit-vs-market comparison. The
   verdict has to stand at the as-recorded end on its own, and it does. */
const limA = raw.og['as-recorded']['LIMIT order'];
/* hg-v1404 recalibration: the as-recorded unanimity did not reproduce — the
   limit split reads 1/4 on win and gross at the conservative end now, so NO
   verdict stands at either end (the old walk's 'worse' verdict rested on
   this end). The non-neutrality lesson is untouched: the lower bound still
   exaggerates the split more than fourfold. */
eq(limA.sign, null, 'the limit split is unanimous at neither end on the hg-v1402 walk');
eq(limA.winQ[0], 1, 'one of four windows favours it on win rate at the as-recorded end (was 0)');
eq(limA.grossQ[0], 1, 'one on gross (was 0)');
ok(Math.abs(raw.og.lower['LIMIT order'].dWin) > Math.abs(limA.dWin) * 2,
   'and the lower bound exaggerates it more than twofold, which is why it is not cited as the evidence');

/* ---- 3. REFUSED: no stop bar is shipped, because none is measured ---- */
console.log('3. REFUSED — the direction holds, a stop value does not');
const sBars = SCALP_TABLE.bars;
const holdsAt = (arr, v) => { const b = arr.find((x) => Math.abs(x.bar - v) < 1e-9); return !!(b && b.holds[0] && b.holds[1]); };
ok(holdsAt(sBars, 0.28), 'scalp unanimity appears at 0.28%');
ok(!holdsAt(sBars, 0.32), 'and vanishes at 0.32%');
ok(!holdsAt(sBars, 0.40), 'and is still gone at 0.40%');
ok(holdsAt(sBars, 0.50), 'and returns at 0.50% — which is a number being searched for, not measured');
const oBars = OG_TABLE.bars;
ok(!oBars.find((x) => Math.abs(x.bar - 0.28) < 1e-9).holds[0], 'OMNIGOLD 0.28% does not hold at the as-recorded end');
ok(!oBars.find((x) => Math.abs(x.bar - 0.80) < 1e-9).holds[0], 'nor does 0.80% — the sweep is non-monotone there too');
/* the gate this would have moved is untouched */
const gsrc = readFileSync(join(ROOT, 'goldind.js'), 'utf8');
ok(/var GS_COST_RISK_MULT = 8;/.test(gsrc), 'the scalp cost gate still asks 8x the venue round trip');
ok(/var GS_RT_COST_PCT_DEFAULT = 0\.020;/.test(gsrc), 'and its venue preset is unchanged');
ok(!/HG_GOLD_FACTOR_SEP/.test(gsrc.slice(gsrc.indexOf('function hgGoldScalpCostGate'),
   gsrc.indexOf('function hgGoldScalpStopFloor'))), 'the cost gate does not read the new table at all');

/* ---- 4. no verdict here was a target being shrunk ---- */
console.log('4. every scalp split sits at the same planned R:R on both sides');
for (const end of ['as-recorded', 'lower']){
  for (const [name] of SCALP_FACTORS){
    const m = raw.scalp[end][name];
    if (m.thin) continue;
    ok(Math.abs(m.rrA - m.rrB) < 0.05,
       name + ' (' + end + ') moves planned R:R by under 0.05 — the win-rate difference is not a smaller target');
    ok(m.rrA > 1.4 && m.rrA < 1.6, name + ' (' + end + ') sits on the 1.5R ladder');
  }
}

/* ---- 5. the stop verdict is NOT just hg-v919's cost arithmetic ---- */
console.log('5. the stop split moves gross, so it is not the fee restated');
const s28 = raw.scalp['as-recorded']['stop >= 0.28%'];
ok(s28.dGross > 0 && s28.dGross / s28.dNet > 0.5,
   'over half of the scalp 0.28% net difference is GROSS, not saved fee — got '
   + Math.round(s28.dGross / s28.dNet * 100) + '%');
ok(s28.grossQ[0] === s28.grossQ[1] && s28.grossQ[0] === WINDOWS,
   'and the gross half is unanimous across all four windows on its own');
const o50 = raw.og['as-recorded']['stop >= 0.50%'];
/* hg-v1404 recalibration: the OMNIGOLD 0.50% split is NOT unanimous even on
   gross at the as-recorded end on the re-walk (2 of 4, and dGross negative)
   — the 'moves gross, not just the fee' half of the old stop story is gone
   at this end too. The scalp half above (goldind's own replay) is unchanged. */
ok(o50.grossQ[0] < o50.grossQ[1],
   'the OMNIGOLD 0.50% split is not unanimous on gross alone at the as-recorded end either (' + o50.grossQ[0] + '/' + o50.grossQ[1] + ')');

/* ---- 6. what the desks rank by reaches no verdict, either way ---- */
console.log('6. the ordering inputs carry no verdict in EITHER direction');
for (const f of ['tally >= 8', 'grade A', 'not demoted']){
  const r = SCALP_TABLE.rows.find((x) => x.f === f);
  eq(r.verdict, null, 'GOLD SCALP ' + f + ' reaches no verdict');
  ok(r.dWin[0] < 0 && r.dWin[1] < 0, f + ' points the wrong way at both bounds (but not unanimously)');
}
for (const f of ['tier STRONG', 'confluence>=50', 'checksPass >= 4']){
  eq(OG_TABLE.rows.find((x) => x.f === f).verdict, null, 'OMNIGOLD ' + f + ' reaches no verdict');
}
/* 1-of-4 is noise in the same way 3-of-4 is; the claim is absence of
   information, never that a low tally is better */
const tally = raw.scalp['as-recorded']['tally >= 8'];
ok(tally.winQ[0] > 0 && tally.winQ[0] < tally.winQ[1],
   'the tally split is not unanimous in the negative direction either — it is noise, not an inverted rule');

/* ---- 7. both panels render, say the uncomfortable part, and list EVERY row ---- */
console.log('7. both panels publish the whole table, not a shortlist');
const sHtml = SCALP_HTML();
const oHtml = OG_HTML();
for (const [html, tbl, tag] of [[sHtml, SCALP_TABLE, 'GOLD SCALP'], [oHtml, OG_TABLE, 'OMNIGOLD']]){
  ok(html && html.length > 400, tag + ' panel renders');
  /* the OMNIGOLD renderer runs names through esc(), so accept either form */
  for (const r of tbl.rows){
    const escd = r.f.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    ok(html.indexOf(r.f) >= 0 || html.indexOf(escd) >= 0, tag + ' panel names ' + r.f);
  }
  ok(/disjoint/.test(html), tag + ' panel says the windows are disjoint');
  ok(/both<\/b> fill bounds|both fill bounds/.test(html), tag + ' panel says both fill bounds');
  ok(/No stop threshold is shipped|no stop threshold is shipped/i.test(html),
     tag + ' panel states that no stop threshold ships from it');
  /* and it shows the sweep that is the REASON, not just the claim — the claim
     alone reads as a policy, the sweep shows it is a measurement */
  for (const b of tbl.bars){
    ok(html.indexOf(b.bar.toFixed(2) + '% ' + (b.holds[0] && b.holds[1] ? 'holds' : 'no')) >= 0,
       tag + ' panel prints the ' + b.bar.toFixed(2) + '% sweep entry that refuses a fitted bar');
  }
  ok(html.indexOf(String(tbl.book.asRecorded.n)) >= 0, tag + ' panel prints the book it measured');
}
ok(/ordering/.test(sHtml) && /tally/.test(sHtml),
   'the GOLD SCALP panel says its own ordering carries no information');
ok(/reaches no verdict/.test(oHtml), 'the OMNIGOLD panel says its own score reaches no verdict');
/* hg-v1404 recalibration: the FAIR one-end trap and the limit verdict both
   evaporated on the re-walk, so the panel now names the NEW fact — no factor
   carries a verdict at all — and still names the asymmetry that keeps the
   lower bound from being neutral for order-type splits. */
ok(/no factor carries a verdict at all/.test(oHtml),
   'and states the hg-v1402 finding plainly — zero verdicts survive');
ok(/0 of 3,117 market rows/.test(oHtml), 'naming the asymmetry on the fresh walk (was 0 of 2,875)');
ok(/explanation offered, not a measured one/.test(oHtml),
   'and does not sell adverse selection as a measured cause');
ok(oHtml.indexOf(OG_TABLE.bars.map((b) => b.bar.toFixed(2) + '% '
     + (b.holds[0] && b.holds[1] ? 'holds' : 'no')).join(', ')) >= 0,
   'and prints the whole sweep as one list, so a reader sees the non-monotonicity');
/* hg-v1404: the only surviving verdicts anywhere are GOLD SCALP's two stop
   rows (its own replay, unchanged); OMNIGOLD contributes none. */
const holdRows = SCALP_TABLE.rows.filter((r) => r.verdict).length + OG_TABLE.rows.filter((r) => r.verdict).length;
eq(holdRows, 2, 'two verdicts across twenty factors on the hg-v1402 walk — both scalp stop rows (was 4: three better, one worse)');
eq(SCALP_TABLE.rows.filter((r) => r.verdict === 'better').length
   + OG_TABLE.rows.filter((r) => r.verdict === 'better').length, 2, 'both of them favourable');
eq(SCALP_TABLE.rows.filter((r) => r.verdict === 'worse').length
   + OG_TABLE.rows.filter((r) => r.verdict === 'worse').length, 0, 'and NONE unfavourable — the limit-order verdict did not reproduce');
eq(OG_TABLE.rows.find((r) => r.f === 'LIMIT order').verdict, null,
   'the old negative verdict is retired, not quietly kept');
ok(!/HOLDS \(WORSE\)/.test(oHtml), 'and the OMNIGOLD panel no longer marks any row as holding, worse');

/* ---- 8. the panels are actually wired into what a user sees ---- */
console.log('8. wired into the panel chain and the WHY SILENT block');
const osrc = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
ok(/\+ hgOgFactorSepPanelHtml\(\);/.test(osrc), 'OMNIGOLD panel chain calls hgOgFactorSepPanelHtml');
/* Order in the chain is the argument, not decoration: the ceiling states the
   RULE, hg-v924's funnel counts THIS SCAN against it, and this panel asks the
   same question of the OUTCOMES. Asserting the three in sequence is stricter
   than the "within 400 characters" window this replaced — which broke the
   moment the funnel was inserted between them, for no reason but length. */
ok(/\+ hgOgCostCeilingPanelHtml\(\)[\s\S]*?\+ hgOgBlockerFunnelHtml\(\)[\s\S]*?\+ hgOgFactorSepPanelHtml\(\);/.test(osrc),
   'ceiling then scan funnel then factor separation, in that order');
ok(osrc.indexOf('+ hgOgFactorSepPanelHtml();') > osrc.indexOf('+ hgOgBlockerFunnelHtml()'),
   'and this panel is last of the three');
const gssrc = readFileSync(join(ROOT, 'goldscalp.js'), 'utf8');
ok(/hgGoldFactorSepHtml\(\)/.test(gssrc), 'GOLD SCALP WHY SILENT calls hgGoldFactorSepHtml');
ok(/goldCoverageNoteHTML\(\)[\s\S]{0,400}hgGoldFactorSepHtml/.test(gssrc),
   'and it sits under the coverage note, which says how little can lead');
ok(/\.gsx-fsep\{/.test(gssrc), 'the panel has styling rather than inheriting nothing');

/* ---- 9. the generator's own population choices are the shipped ones ---- */
console.log('9. the generator measures the population the desk forms');
eq(COST_BAR_PCT, 0.16, 'the scalp book starts from the shipped hg-v912 cost reject');
eq(XM_RT_PCT, 0.020, 'and the net column is priced at the XM preset the desk uses');
eq(WINDOWS, 4, 'four disjoint windows');
ok(SUPPRESSED.includes('vwap') && SUPPRESSED.length === 4, 'the four suppressed scalp kinds are excluded');
const sb = scalpBook('as-recorded');
ok(sb.every((t) => stopPct(t) >= COST_BAR_PCT), 'no row under the cost reject is in the scalp book');
ok(sb.every((t) => !SUPPRESSED.includes(t.stratKey)), 'no suppressed kind is in it either');
ok(sb.every((t) => t.outcome !== 'unfilled'), 'unfilled rows are not wins and not losses, so they are out');
eq(MIN_SIDE_SCALP, 15, 'the scalp window floor is the shipped one');
eq(MIN_SIDE_OG, 30, 'and the OMNIGOLD one, which has four times the rows per window');
/* The unfilled guard is redundant today because an unfilled row carries no
   numeric outcome. Prove that rather than assume it: if a re-bake ever starts
   scoring one as 0R, this flips and the guard becomes load-bearing — and
   without it every missed entry would enter the book as a flat trade. */
const scalpRaw = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldscalp-results-floor.json'), 'utf8'));
const ogRaw = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-omnigold-results.json'), 'utf8'));
const sU = scalpRaw.trades.filter((t) => t.outcome === 'unfilled');
const oU = ogRaw.trades.filter((t) => t.outcome === 'unfilled');
ok(sU.length > 0 && oU.length > 0, 'both replays do contain unfilled rows (' + sU.length + ' / ' + oU.length + ')');
eq(sU.filter((t) => typeof t.netR === 'number').length, 0,
   'and none of the scalp ones carries a numeric netR, so the type check already drops them');
eq(oU.filter((t) => typeof t.rMultiple === 'number').length, 0,
   'nor any OMNIGOLD one a numeric rMultiple — the unfilled guard is belt-and-braces, not dead');
const lo = scalpBook('lower'), hi = scalpBook('as-recorded');
eq(lo.length, hi.length, 'the two bounds are the same rows, scored differently');
const flipped = lo.filter((t, i) => t.g !== hi[i].g).length;
ok(flipped > 0, 'and the lower bound does change some of them (' + flipped + ' unprovable same-bar wins)');
ok(lo.every((t, i) => t.g <= hi[i].g), 'the lower bound is never kinder than the as-recorded one');
const ob = ogBook('as-recorded');
ok(ob.every((t) => Math.abs(t.cost - XM_RT_PCT / stopPct(t)) < 1e-12),
   'OMNIGOLD cost is re-priced as rtCostPct / stopPct exactly, not read from the PAXG column');

/* ---- 10. measure() refuses a split it cannot judge ---- */
console.log('10. a split too thin to window is reported thin, never judged');
const thin = measure(sb, (t) => t.stratKey === '__nothing__', 15, (t) => +t.rr);
eq(thin.thin, true, 'an empty side comes back thin');
eq(thin.verdict, undefined, 'and carries no verdict field to be misread');
const everything = measure(sb, () => true, 15, (t) => +t.rr);
eq(everything.thin, true, 'a split with no false side is thin too');
ok(OG_FACTORS.length === 10 && SCALP_FACTORS.length === 10, 'ten factors per desk, twenty in all');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
