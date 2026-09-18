/* HARDGATE — a cohort is quoted from the record, or it is not quoted.

   Four places on the OMNIGOLD tab described a replay cohort in prose, and
   all four wrote the NUMBER into the sentence and the JUDGEMENT into the
   grammar. Then the evidence was re-baked underneath them. What the
   shipped build actually rendered:

     "the replay's ENGINE scalp cohort lost 2.60R/trade net"
     "replay: scalp cost drag -2.6R/trade net — swing geometry survived
      (PF 0.90)"
     "No cohort finished net-positive; the closest was ENGINE setups on
      SWING geometry (0.85R/trade net, PF 0.90 — still a net loss).
      ... Every number here is measured"

   ENGINE:SCALP has no row in the current bake, so both -2.6 figures came
   from a literal fallback on EVERY render. PF 0.90 printed while the
   evidence object carries pf: { 'ENGINE:SWING': null }. And the banner
   called +0.85R "still a net loss" one clause after declaring no cohort
   finished net-positive — having computed the +0.85 from the record.

   These are driven, not grepped: the bake is mutated and the sentences
   have to follow it.

   Run: node tests/test-omnigold-cohort-claims.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

function boot(){
  const doc = { getElementById: () => null,
                createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
                querySelector: () => null, querySelectorAll: () => [],
                head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, document: doc,
                setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {},
                fetch: () => Promise.reject(new Error('no net')),
                localStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'hg-plan.js', 'hg-gates.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  return ctx;
}
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
/* a scalp plan whose stop is tight enough that the PAXG round trip is a
   fatal fee load, which is what makes the cost lines render at all */
const SCALP = { kind: 'ROUND-MAGNET', horizon: 'SCALP', dir: 'long',
                plan: { entry: 4000, stop: 3980, t1: 4040 } };

console.log('== the state that produced this: ENGINE:SCALP has no row ==');
{
  const W = boot();
  ok(typeof W.hgOgCohortClaim === 'function', 'hgOgCohortClaim is exported');
  const scalp = W.hgOgCohortClaim('ENGINE:SCALP');
  ok(scalp.missing === true,
     'ENGINE:SCALP is absent from the bake — so every -2.6 ever printed was the fallback');
  const swing = W.hgOgCohortClaim('ENGINE:SWING');
  ok(swing.missing === false && swing.n === 3,
     'ENGINE:SWING exists, on 3 trades');
  ok(swing.net > 0, 'and its net is POSITIVE (' + swing.net + 'R) — the banner called it a net loss');
  ok(swing.thin === true, 'and it is under the judge bar, so the sign is not a finding');
  ok(!isFinite(swing.pf),
     'its PF is null in the bake ("the old 0.90 was measured on n=27 pre-v699"), so nothing may print one');
  const scan = W.hgOgCohortClaim('SCAN:SCALP');
  ok(scan.missing === false && scan.thin === false && scan.n > 6000,
     'SCAN:SCALP is the scalp cohort that DOES carry a judgeable record');
}

console.log('\n== no rendered surface prints a number the bake does not hold ==');
{
  const W = boot();
  const drag = W.hgOgCostDrag(SCALP);
  ok(drag && (drag.tier === 'heavy' || drag.tier === 'fatal'),
     'the fixture really is a heavy/fatal fee load, so the cost lines render');
  const surfaces = {
    'costs-first': strip(W.hgOgCostsFirstHtml(SCALP, drag)),
    'engine replay line': strip(W.hgOgEngineReplayLinesHtml(SCALP, 'SCALP')),
    'desk stance banner': strip(W.hgOgDeskStanceBannerHtml())
  };
  for (const [name, txt] of Object.entries(surfaces)){
    ok(txt.length > 0, name + ' renders something');
    ok(txt.indexOf('2.60') < 0 && txt.indexOf('-2.6R') < 0,
       name + ' does not print the pre-v699 ENGINE:SCALP figure');
    ok(txt.indexOf('PF 0.90') < 0,
       name + ' does not print a PF the bake sets to null');
  }
  ok(surfaces['desk stance banner'].indexOf('still a net loss') < 0,
     'the banner no longer calls a positive net a loss');
  ok(/3 trades/.test(surfaces['engine replay line']),
     'the card line states the three-trade sample instead of calling it survival');
  ok(surfaces['engine replay line'].indexOf('survived') < 0,
     'and does not say a three-trade cohort survived anything');
}

console.log('\n== the banner verdict is DERIVED: mutate the bake, the sentence follows ==');
{
  const W = boot();
  const base = strip(W.hgOgDeskStanceBannerHtml());
  ok(/One cohort finished net-positive/.test(base),
     'today: one cohort is net-positive, and the banner says so');
  ok(/not evidence of an edge in either direction/.test(base),
     'and immediately disqualifies it on sample size rather than selling it');
  ok(/on 3 trades/.test(base), 'naming the sample inline');

  /* every cohort negative -> the old sentence, now earned */
  vm.runInContext(`HG_OG_REPLAY_EVIDENCE.cohorts['ENGINE:SWING'] = [3, 0.33, -0.849, -0.9];`, W);
  ok(W.hgOgCohortClaim('ENGINE:SWING').net < 0, 'the mutation took');
  const allNeg = strip(W.hgOgDeskStanceBannerHtml());
  ok(/No cohort finished net-positive/.test(allNeg),
     'all-negative bake -> "No cohort finished net-positive"');
  ok(/the closest was/.test(allNeg), 'and it names the closest from the record');

  /* a positive cohort AT SCALE is a different sentence again */
  vm.runInContext(`HG_OG_REPLAY_EVIDENCE.cohorts['ENGINE:SWING'] = [900, 0.51, 0.42, 0.55];`, W);
  const fat = strip(W.hgOgDeskStanceBannerHtml());
  ok(/1 cohort finished net-positive/.test(fat),
     'a judgeable positive cohort is reported as one');
  ok(/over 900 trades/.test(fat), 'with its sample, and no "too few to judge"');
  ok(fat.indexOf('not evidence of an edge') < 0,
     'and the thin-sample disclaimer is NOT attached to a 900-trade row');

  /* a PF in the bake prints; null does not */
  vm.runInContext(`HG_OG_REPLAY_EVIDENCE.pf['ENGINE:SWING'] = 1.24;`, W);
  ok(/PF 1\.24/.test(strip(W.hgOgDeskStanceBannerHtml())),
     'a PF the bake carries IS printed');
  vm.runInContext(`HG_OG_REPLAY_EVIDENCE.pf['ENGINE:SWING'] = null;`, W);
  ok(strip(W.hgOgDeskStanceBannerHtml()).indexOf('PF ') < 0,
     'and a null PF prints nothing at all — not a remembered 0.90');
}

console.log('\n== a missing cohort says so instead of inventing a figure ==');
{
  const W = boot();
  /* drop every scalp record: the cost line must lose its cohort clause,
     not fall back to a number */
  vm.runInContext(`delete HG_OG_REPLAY_EVIDENCE.cohorts['SCAN:SCALP'];`, W);
  ok(W.hgOgCohortClaim('SCAN:SCALP').missing === true, 'the deletion took');
  const txt = strip(W.hgOgCostsFirstHtml(SCALP, W.hgOgCostDrag(SCALP)));
  ok(/COSTS FIRST/.test(txt), 'the live cost arithmetic still renders — it was never the problem');
  ok(/0\.52R of this stop/.test(txt), 'including the measured drag on this stop');
  ok(/no settled scalp cohort/.test(txt),
     'and the cohort clause states the absence rather than printing a literal');
  ok(!/\dR\/trade net/.test(txt), 'no per-trade net is claimed with no record behind it');
}

console.log('\n== the sign of the verb is read off the record ==');
{
  const W = boot();
  const t = W.hgOgCohortNetTxt;
  ok(t({ missing: false, net: -1.438 }) === '-1.44R/trade net', 'a loss prints signed');
  ok(t({ missing: false, net: 0.849 }) === '+0.85R/trade net', 'a gain prints with a plus');
  ok(t({ missing: false, net: 0.849 }, 1) === '+0.8R/trade net', 'and honours the precision asked for');
  ok(t({ missing: true, net: -1 }) === null, 'a missing cohort yields no text');
  ok(t({ missing: false, net: NaN }) === null, 'and an unreadable net yields none either');
  ok(t(null) === null, 'null in, null out');

  const n = W.hgOgCohortNTxt;
  ok(n({ missing: false, n: 6461, thin: false }) === 'over 6,461 trades', 'a judgeable n reads plainly');
  ok(/^on 3 trades, under the \d+/.test(n({ missing: false, n: 3, thin: true })),
     'a thin n carries the bar it failed');
  ok(n({ missing: false, n: 3, thin: true }, true) === '3 trades — too few to judge',
     'and the short form fits a dim card line');
  ok(n({ missing: false, n: 1, thin: true }, true) === '1 trade — too few to judge',
     'singular is not "1 trades"');
}

console.log('\n== the literal fallbacks are gone from the source ==');
{
  /* the exact shape of the bug: a cohort lookup with a number behind it */
  const fallbacks = SRC.match(/hgOgReplayEvidence\([^)]*\)[\s\S]{0,220}?\?[^;]*:\s*'?-?\d+\.\d+'?/g) || [];
  ok(fallbacks.length === 0,
     'no cohort lookup falls back to a numeric literal (' + fallbacks.length + ' found)');
  /* A LINE-PREFIX HEURISTIC CANNOT FIND COMMENTS IN THIS FILE. Its block
     comments do not repeat a leading '*', so a continuation line is
     indistinguishable from code by its prefix. Strip the spans instead. */
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');
  ok(/function hgOgCohortStanceTxt/.test(CODE) && /HG_OG_REPLAY_EVIDENCE/.test(CODE),
     'the stripped source is still the code (the stripper did not eat everything)');
  ok(!/COHORT FIGURES THAT USED TO SIT HERE/.test(CODE),
     'and it really did remove the comment prose');
  ok(CODE.indexOf('PF 0.90') < 0,
     'PF 0.90 survives only in comments explaining why it must not be printed');
  ok(CODE.indexOf('2.603') < 0, 'and so does 2.603');
  ok(CODE.indexOf('-0.056') < 0, 'and the ENGINE:SWING figure it was paired with');
}


console.log('\n== a win rate needs trades to be a rate (hg-v815) ==');
{
  const W = boot();
  const A = W.hgOgCohortClaim('A'), B = W.hgOgCohortClaim('B'), C = W.hgOgCohortClaim('C');
  ok(A.n === 1 && B.n === 1 && C.n === 1,
     'the state that produced this: the bake settles ONE trade per engine grade');
  ok(A.winRate === 0 && A.net > 0,
     'grade A is 0% WR with a POSITIVE net R — one trade that lost less than its stop');
  ok(A.thin && B.thin && C.thin, 'all three are under the judge bar');

  const legend = strip(W.hgOgSpectrumLegendCellsHtml());
  /* A BOUNDARY, NOT A SUBSTRING: the FAIR cell legitimately reads "30% WR"
     and contains "0% WR" inside it. The first draft of this assertion
     failed on that, against correct output. */
  ok(!/(^|[^\d])0% WR/.test(legend),
     'the legend does not print a 0% win rate computed from one trade');
  ok(/30% WR/.test(legend), 'and the cell that made that trap real is still there');
  ok(/1 settled trade \(too few for a rate\)/.test(legend),
     'it says what actually settled instead');
  ok(/32% WR/.test(legend),
     'while the tier cells beside it, which carry thousands, still quote their rate');
  ok(legend.indexOf('on scalps') < 0,
     'and the per-horizon claim is withheld — it came from a trade distribution this bake lost');

  const line = strip(W.hgOgEngineReplayLinesHtml(
    { kind: 'ROUND-MAGNET', horizon: 'SCALP', dir: 'long', engineGrade: 'A', grade: 'A',
      plan: { entry: 4000, stop: 3980, t1: 4040 } }, 'SCALP'));
  ok(line.indexOf('selection edge real') < 0,
     'the grade line no longer asserts a selection edge beside the n=1 that refutes it');
  ok(/too few for a rate/.test(line), 'it reports the sample instead');

  const hdr = strip(W.hgOgSpectrumTruthHeaderHtml());
  ok(hdr.indexOf('grade-A selection is real') < 0,
     'and the spectrum header drops the same assertion');
  ok(/not measurable in this window/.test(hdr), 'saying what the bake supports');
}

console.log('\n== the grade ordering is READ: mutate the bake, the verdict follows ==');
{
  const W = boot();
  ok(W.hgOgGradeOrder().judgeable === false, 'n=1 per grade is not judgeable');
  ok(/every grade settled under \d+ trades/.test(W.hgOgGradeOrder().why),
     'and it names why');

  /* the ordering that used to be asserted, now at a size that can carry it */
  vm.runInContext(`HG_OG_REPLAY_EVIDENCE.grades['A'] = [70, 0.543, 0.87];
                   HG_OG_REPLAY_EVIDENCE.grades['B'] = [60, 0.361, 0.40];
                   HG_OG_REPLAY_EVIDENCE.grades['C'] = [60, 0.348, 0.10];`, W);
  const held = W.hgOgGradeOrder();
  ok(held.judgeable === true && held.holds === true, 'A > B > C at scale is judgeable AND holds');
  ok(/grade selection ordered outcomes/.test(W.hgOgGradeOrderTxt()),
     'and the sentence says so, unprompted');
  ok(/A 54\.3% . B 36\.1% . C 34\.8%/.test(W.hgOgGradeOrderTxt()),
     'quoting the rates it just read rather than remembered ones');
  ok(/54% WR/.test(strip(W.hgOgSpectrumLegendCellsHtml())),
     'and the legend quotes a rate again once the record can carry one');
  ok(/on scalps/.test(strip(W.hgOgSpectrumLegendCellsHtml())),
     'the horizon claim returns with the sample that supports it');

  /* invert it: the sentence must be willing to say the ordering FAILED */
  vm.runInContext(`HG_OG_REPLAY_EVIDENCE.grades['A'] = [70, 0.301, 0.87];`, W);
  const broke = W.hgOgGradeOrder();
  ok(broke.judgeable === true && broke.holds === false, 'a broken ordering is judgeable and false');
  ok(/did NOT order outcomes/.test(W.hgOgGradeOrderTxt()),
     'and the tab is willing to print that its own selection device failed');

  /* one thin grade poisons the comparison, not just all three */
  vm.runInContext(`HG_OG_REPLAY_EVIDENCE.grades['B'] = [2, 0.5, 0.4];`, W);
  ok(W.hgOgGradeOrder().judgeable === false,
     'one thin grade is enough to make the ordering unmeasurable');
  ok(/1 of the three grades/.test(W.hgOgGradeOrder().why), 'and it counts how many');
}

console.log('\n== the record sentence never states more than the sample allows ==');
{
  const W = boot();
  const t = W.hgOgClaimRecordTxt;
  ok(t({ missing: true }) === null, 'a missing record says nothing');
  ok(t({ missing: false, n: 1, winRate: 0, net: 0.874, thin: true })
       === '1 settled trade (too few for a rate)', 'one trade is not a percentage');
  ok(t({ missing: false, n: 1, winRate: 0, net: 0.874, thin: true }, { net: true })
       === '1 settled trade (too few for a rate), +0.87R on it',
     'its outcome can still be reported, attached to the one trade');
  ok(t({ missing: false, n: 4, winRate: 0.5, net: -0.2, thin: true }, { net: true })
       === '4 settled trades (too few for a rate), -0.20R on them', 'plural agrees');
  ok(t({ missing: false, n: 6461, winRate: 0.2959, net: -1.438, thin: false }, { net: true })
       === '30% WR, -1.44R net', 'a judgeable record reads as a rate');
  ok(t({ missing: false, n: 6461, winRate: 0.2959, net: -1.438, thin: false }, { net: true, n: true })
       === '30% WR, -1.44R net (n=6,461)', 'with its sample when asked');
}

console.log('\n== the empty-ticket panel explains the bar that is actually applied ==');
{
  const W = boot();
  const panel = strip(W.hgOgEdgeProofPanelHtml());
  const scanned = W.hgOgFamilyZ ? null : null;
  /* the gate's own family size, read the way the gate reads it */
  const nMech = Number((panel.match(/Of (\d+) mechanics scanned/) || [])[1]);
  ok(nMech > 0, 'the panel names how many mechanics were scanned (' + nMech + ')');
  ok(/(\d+) carry a replay record/.test(panel),
     'and separately how many carry a replay record — they are different numbers');
  const withRecord = Number((panel.match(/(\d+) carry a replay record/) || [])[1]);
  ok(withRecord < nMech,
     'the ledger is bigger than the measured set (' + withRecord + ' of ' + nMech + ')');
  ok(panel.indexOf('mechanics in the ledger') < 0,
     'the old label, which called the measured set "the ledger", is gone');

  /* THE BAR MUST BE THE GATE'S BAR. Recompute it independently. */
  const barInPanel = Number((panel.match(/([\d.]+)σ\)/) || [])[1]);
  const gateBar = W.hgOgFamilyZ(nMech);
  ok(Math.abs(barInPanel - gateBar) < 0.005,
     'the quoted bar is hgOgFamilyZ over the SCANNED count (' + barInPanel + ')');
  ok(Math.abs(gateBar - W.hgOgFamilyZ(withRecord)) > 0.05,
     'which is a different number from the measured-set bar it used to quote ('
     + W.hgOgFamilyZ(withRecord).toFixed(2) + ') — so this assertion can fail');
  ok(new RegExp('Searching ' + nMech + ' ways').test(panel),
     'and the "searching N ways" clause uses the same N');
}


console.log('\n== the evidence reports its own condition (hg-v816) ==');
{
  const W = boot();
  ok(typeof W.hgOgEvidenceHealth === 'function', 'hgOgEvidenceHealth is exported');
  const h = W.hgOgEvidenceHealth();
  const by = k => h.groups.filter(g => g.key === k)[0];

  ok(h.groups.length === 4, 'all four baked maps are read');
  ok(by('kinds').judgeable === 54 && by('kinds').thin === 0,
     'every mechanic row can carry a rate — the bake drops kinds under 40');
  ok(by('grades').blind === true && by('grades').keys === 3,
     'the engine grades are BLIND: three rows, not one of them judgeable');
  ok(by('grades').settled === 3,
     'because the entire ENGINE book settled 3 trades in this window');
  ok(by('cohorts').judgeable === 2 && by('cohorts').thin === 1,
     'the cohorts are mixed — two carry rates, ENGINE:SWING does not');
  ok(by('tiers').blind === false, 'the tier table is healthy');
  ok(h.blind.length === 1 && h.blind[0].key === 'grades',
     'so exactly one group is blind, and the read names it');

  /* THE FOUR TOTALS ARE DIFFERENT ON PURPOSE, and the read must not
     flatten them into one "settled" number. */
  const totals = h.groups.map(g => g.settled);
  ok(new Set(totals).size === 4, 'all four populations differ: ' + totals.join(' / '));
  ok(by('cohorts').settled === h.declaredSettled,
     'cohorts cover every settled trade, so they match the declared count');
  ok(by('kinds').settled < h.declaredSettled,
     'kinds cover fewer — small mechanics are dropped whole by the bake');
  ok(by('tiers').settled < h.declaredSettled,
     'and tiers cover only the trades that carried a score');
}

console.log('\n== the health panel speaks only when the bake cannot answer ==');
{
  const W = boot();
  const panel = strip(W.hgOgEvidenceHealthHtml());
  ok(panel.length > 0, 'today it speaks');
  ok(/engine grade/.test(panel) && /report samples instead of rates/.test(panel),
     'naming the blind group and what goes quiet because of it');
  ok(/ENGINE:SWING \(n=3\) cannot/.test(panel),
     'and naming the individual thin row in a mixed group');
  ok(panel.indexOf('mechanic —') < 0, 'healthy groups are not listed');

  /* REFILL THE BAKE AND IT MUST GO SILENT. A warning that cannot stop
     warning is decoration. */
  vm.runInContext(`HG_OG_REPLAY_EVIDENCE.grades['A'] = [70, 0.543, 0.87];
                   HG_OG_REPLAY_EVIDENCE.grades['B'] = [60, 0.361, 0.40];
                   HG_OG_REPLAY_EVIDENCE.grades['C'] = [60, 0.348, 0.10];
                   HG_OG_REPLAY_EVIDENCE.cohorts['ENGINE:SWING'] = [130, 0.33, 0.85, 0.95];`, W);
  ok(W.hgOgEvidenceHealth().blind.length === 0, 'a refilled bake has nothing blind');
  ok(strip(W.hgOgEvidenceHealthHtml()) === '', 'and the panel renders nothing at all');

  /* collapse a HEALTHY group and it must notice that one too — the check
     is not hard-wired to grades */
  vm.runInContext(`HG_OG_REPLAY_EVIDENCE.tiers = { WEAK: [2, 0.3, -0.4] };`, W);
  const tPanel = strip(W.hgOgEvidenceHealthHtml());
  ok(/confluence tier/.test(tPanel), 'a collapsed tier table is reported too');
  ok(/the confluence spectrum cells/.test(tPanel),
     'with the surface that depends on it, so the reader knows what went quiet');

  /* an empty map is not a blind one — nothing baked is a different state
     from something baked too thin */
  vm.runInContext(`HG_OG_REPLAY_EVIDENCE.tiers = {};`, W);
  const empty = W.hgOgEvidenceHealth().groups.filter(g => g.key === 'tiers')[0];
  ok(empty.keys === 0 && empty.blind === false,
     'a map with no rows is not reported as blind');
}

console.log('\n== a claim quotes the population it rests on ==');
{
  const W = boot();
  const tierN = W.hgOgGroupSettled('tiers');
  const declared = W.hgOgEvidenceHealth().declaredSettled;
  ok(tierN !== declared, 'the tier population is not the desk-wide one (' + tierN + ' vs ' + declared + ')');
  const hdr = strip(W.hgOgSpectrumTruthHeaderHtml());
  ok(hdr.indexOf(String(tierN).replace(/\B(?=(\d{3})+(?!\d))/g, ',')) >= 0,
     'the tier sentence quotes the tier count');
  ok(hdr.indexOf(String(declared).replace(/\B(?=(\d{3})+(?!\d))/g, ',')) < 0,
     'and not the desk-wide count it used to');
  ok(W.hgOgGroupSettled('nope') !== W.hgOgGroupSettled('nope'),
     'an unknown group yields NaN rather than a number');

  /* the banner, which IS about every settled trade, keeps the full count */
  ok(strip(W.hgOgDeskStanceBannerHtml())
       .indexOf(String(declared).replace(/\B(?=(\d{3})+(?!\d))/g, ',')) >= 0,
     'while the cohort banner, which covers every trade, still quotes all of them');
}


console.log('\n== a re-pricing reproduces the record it re-prices (hg-v817) ==');
{
  const W = boot();
  const E = W.HG_OG_REPLAY_EVIDENCE;
  const near = (a, b, e) => Math.abs(a - b) <= e;

  /* THE PROPERTY, not the expression. Priced at the replay's own cost the
     ratio is 1 and there is nothing left to scale, so the answer must be
     the replay's own measured net. The old arithmetic — a MEDIAN fee off a
     MEAN gross — failed this on 53 of 54 kinds and no test asked. */
  const off = Object.keys(E.kinds).filter(k => {
    const r = E.kinds[k];
    return !near(W.hgOgVenueNet(r[3], r[2], E.rtCostPct, E.rtCostPct), r[2], 1e-9);
  });
  ok(off.length === 0, 'every one of the ' + Object.keys(E.kinds).length
     + ' baked kinds re-prices to its own net at its own cost');
  const offC = Object.keys(E.cohorts).filter(k => {
    const r = E.cohorts[k];
    return !near(W.hgOgVenueNet(r[3], r[2], E.rtCostPct, E.rtCostPct), r[2], 1e-9);
  });
  ok(offC.length === 0, 'and so does every cohort');

  /* the two ends of the scale */
  ok(near(W.hgOgVenueNet(0.5, -1.0, 0, 0.26), 0.5, 1e-12),
     'a venue that charges nothing returns the gross');
  ok(near(W.hgOgVenueNet(0.5, -1.0, 0.52, 0.26), -2.5, 1e-12),
     'and doubling the round trip doubles the fee, not the gross');

  /* IT MUST BE THE MEAN FEE. The median is smaller on a right-skewed cost
     book, and using it is what made this flattering. */
  const scalp = E.cohorts['SCAN:SCALP'];
  const meanFee = scalp[3] - scalp[2];
  ok(meanFee > E.medianCostR.scalp * 2,
     'the mean scalp fee (' + meanFee.toFixed(3) + 'R) is more than twice the median ('
     + E.medianCostR.scalp + 'R) — the skew that made the old formula generous');
  ok(!near(W.hgOgVenueNet(scalp[3], scalp[2], E.rtCostPct, E.rtCostPct),
           scalp[3] - E.medianCostR.scalp, 1e-6),
     'so the corrected answer and the median-fee answer are genuinely different');

  /* nothing is invented from a row that cannot be re-priced */
  ok(!isFinite(W.hgOgVenueNet(null, -1, 0.02, 0.26)), 'no gross, no re-pricing');
  ok(!isFinite(W.hgOgVenueNet(0.1, null, 0.02, 0.26)), 'no net, no re-pricing');
  ok(!isFinite(W.hgOgVenueNet(0.1, -1, 0.02, 0)), 'and no replay cost to scale from, none either');

  /* the fee correction demotes MORE, never fewer — understating a cost can
     only let a loser through */
  const xm = W.hgOgVenuePresetCost('XM'), paxg = W.hgOgVenuePresetCost('PAXG');
  const nXm = W.hgOgDemotedKindCount(xm), nPaxg = W.hgOgDemotedKindCount(paxg);
  ok(nPaxg > nXm, 'dearer fees demote more (' + nPaxg + ' at PAXG vs ' + nXm + ' at XM)');
  const utad = W.hgOgKindDemotion('UTAD', paxg);
  ok(utad, 'UTAD is demoted at PAXG');
  ok(E.kinds['UTAD'][3] > 0,
     'though its GROSS is positive — the gross branch never caught it');
  ok(utad.reasons.some(r => /venue-adjusted netR/.test(r)),
     'it is the venue-adjusted branch that does, which the median fee let it clear');
  ok(utad.reasons.some(r => /meanCostR/.test(r)),
     'and the reason names the mean fee it actually subtracted');
}


console.log('\n== no render function can take its panel off the page (hg-v821) ==');
{
  /* THE HEADER PROMISES THIS AND NOTHING CHECKED IT: "Never throws at load;
     every global is feature-checked ... refresh() is async, never throws".
     Four of the 42 exported *Html functions did throw, and a throw in a
     render function does not degrade — it removes that panel from the tab.
     The worst was setupCard reading row.grade.ticket two lines below where
     the same object is read defensively for ev and tot, which empties MOST
     PROBABLE, the panel at the top of the page.

     Fuzzed rather than enumerated: the point is the contract, so the test
     has to cover functions nobody has thought about yet. */
  const W = boot();
  const HOSTILE = [
    undefined, null, NaN, 0, -1, '', 'xx', Infinity, -Infinity,
    {}, [], [null], [undefined], [{}],
    { plan: null }, { plan: {} }, { plan: { entry: NaN, stop: NaN, t1: NaN } },
    { kind: null, horizon: null, dir: null }, { grade: null }, { grade: {} },
    { SCALP: null, SWING: null, union: null }
  ];
  const SECOND = [undefined, null, {}, 'SCALP', 'long', []];
  const names = Object.keys(W).filter(k => /^hgOg.*Html$/.test(k) && typeof W[k] === 'function');
  ok(names.length > 30, `${names.length} render functions are exported`);

  const threw = [];
  let calls = 0;
  for (const n of names){
    for (const a of HOSTILE){
      for (const b of SECOND){
        calls++;
        let out;
        try { out = W[n](a, b); }
        catch (e){ threw.push(n + '(' + JSON.stringify(a) + ', ' + JSON.stringify(b) + '): ' + e.message); continue; }
        if (out !== undefined && typeof out !== 'string'){
          threw.push(n + ' returned ' + typeof out + ', not markup');
        }
      }
    }
  }
  if (threw.length) console.error('   ' + threw.slice(0, 6).join('\n   '));
  ok(calls > 3000, `${calls} hostile calls made`);
  ok(threw.length === 0,
     'not one of them throws or returns a non-string — a render that throws '
     + 'does not degrade, it deletes its panel');
}


console.log('\n== the tab paints with this app\'s palette, legibly (hg-v822) ==');
{
  /* TWO THINGS NOTHING CHECKED.

     omnigold.js referenced six CSS custom properties index.html has never
     defined — --fg-muted (x6), --err, --ok, --warn, --bg-muted and --hr.
     Five fell back to a literal, so they LOOKED like design-system use
     while being hard-coded; --hr had no fallback at all, so those two
     border declarations resolved to nothing and were dropped.

     And the confluence spectrum legend — the key a reader uses to read the
     badge on every card — printed its tier labels in dark-theme colours on
     a white card. Each cell tints its own background at ~6.7% alpha, which
     over --panel #ffffff is white for contrast purposes. */
  const W = boot();
  const ROOT_ = path.dirname(fileURLToPath(import.meta.url)) + '/..';
  const OG = fs.readFileSync(path.join(ROOT_, 'omnigold.js'), 'utf8');
  const HTML = fs.readFileSync(path.join(ROOT_, 'index.html'), 'utf8');

  const defined = new Map();
  for (const m of HTML.matchAll(/--([a-z0-9-]+)\s*:\s*([^;}]+)/gi)){
    if (!defined.has(m[1].toLowerCase())) defined.set(m[1].toLowerCase(), m[2].trim());
  }
  ok(defined.has('panel') && defined.has('mut'), 'index.html defines the palette');

  const referenced = [...new Set([...OG.matchAll(/var\(\s*--([a-z0-9-]+)/gi)].map(m => m[1].toLowerCase()))];
  ok(referenced.length > 3, `omnigold references ${referenced.length} tokens`);
  const undef = referenced.filter(k => !defined.has(k));
  if (undef.length) console.error('   undefined: ' + undef.join(', '));
  ok(undef.length === 0,
     'every one of them is defined by the app — a var() the page never sets is '
     + 'a literal wearing a token\'s clothes, or a dropped declaration');

  /* CONTRAST, measured. */
  const lum = hex => {
    let h = String(hex).replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a, b) => {
    const L1 = lum(a), L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };
  ok(Math.abs(ratio('#000000', '#ffffff') - 21) < 0.01, 'the contrast helper agrees black/white is 21:1');
  ok(Math.abs(ratio('#ffffff', '#ffffff') - 1) < 0.01, 'and white on white is 1:1');

  const PANEL = defined.get('panel') || '#ffffff';
  const legend = String(W.hgOgSpectrumLegendCellsHtml());
  const fg = [...legend.matchAll(/color:\s*(#[0-9a-fA-F]{3,6}|var\(--([a-z0-9-]+)\))/g)]
    .map(m => (m[2] ? defined.get(m[2]) : m[1]))
    .filter(Boolean);
  ok(fg.length >= 8, `the legend sets ${fg.length} foreground colours`);

  const failing = fg.map(c => ({ c, r: ratio(c, PANEL) })).filter(x => x.r < 3);
  if (failing.length) console.error('   ' + failing.map(x => x.c + ' ' + x.r.toFixed(2) + ':1').join(', '));
  ok(failing.length === 0,
     'every one clears 3:1 against the panel it sits on — the tier labels used to '
     + 'read 2.54, 2.28 and 2.15:1, which is a legend you cannot use');

  /* the four tiers must still be TOLD APART, or fixing contrast would have
     flattened the thing it exists to encode */
  const tierFg = fg.filter((c, i) => i % 2 === 0);
  ok(new Set(tierFg).size === tierFg.length,
     `the ${tierFg.length} tier labels remain visually distinct from one another`);
  ok(legend.indexOf('&lt;50') >= 0 && !/>\s*<50/.test(legend),
     'and the WEAK cell escapes its "<50" instead of emitting a stray tag start');
}

console.log(`\n${passed} passed, 0 failed`);
