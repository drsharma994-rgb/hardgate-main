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

console.log(`\n${passed} passed, 0 failed`);
