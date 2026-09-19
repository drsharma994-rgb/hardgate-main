/* HARDGATE — CRYPTO SCAN scored sentiment against the trade, not with it.

   hgComputeThreeLayerConfidence blends three layers into the number that
   decides a card's tier, its shouldTrade verdict, and — through
   hgIsProGradeSetup — the PROFESSIONAL-GRADE stamp that cryptoscan.js turns
   into its HIGH-QUALITY block and writes to the forward log as `ticket`.

   Layer 3 went in like this:

     ((l3.sentiment || 0) * 0.25)

   sentiment.js scores the SYMBOL on an absolute scale — +1 bullish, -1
   bearish — and it is hgSentimentScoreSignal there that turns that into
   agreement with a trade (alignment = score for a long, -score for a short).
   Added raw, it is right for longs and exactly backwards for shorts.

   One setup, identical price and flow reads (pct 0.80, flow 0.5), changing
   nothing but the market's mood:

     short + sentiment -0.80 (bearish, CONFIRMS the short)     0.339  weak
     short + sentiment +0.80 (bullish, CONTRADICTS the short)  0.799  professional

   The short was blocked when the market agreed with it and promoted to
   PROFESSIONAL when the market disagreed. Longs were right all along, which
   is why the fault was invisible on half the book.

   Not hypothetical on the shipped cache: scripts/sentiment-cache/sentiment.json
   carries BTCUSDT, ETHUSDT and SOLUSDT all at +0.272. Across a 200-cell grid of
   short setups, 37 — 18.5% — held the >=0.75 pro-grade bar ONLY because the
   sign was wrong; none lost out the other way.

   Also pinned here, because the same stamp claims it: risk-reward is NOT one
   of the pro-grade standards and cannot be, since cryptoultra.js prices every
   plan off the constant RULE.t1R = 1.5, making an rr1 >= 1.5 test true by
   construction. It stays reported and stays out of the conjunction, so nobody
   later mistakes it for a filter.

   Run: node tests/test-cryptoscan-sentiment-sign.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp };
  s.window = s; s.globalThis = s; s.self = s;
  vm.createContext(s);
  vm.runInContext(fs.readFileSync(root + 'cryptoscan-voting-v3.js', 'utf8'), s,
                  { filename: 'cryptoscan-voting-v3.js' });
  return s;
}
const S = boot();
const VOTE = fs.readFileSync(root + 'cryptoscan-voting-v3.js', 'utf8');
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');

/** The call cryptoscan.js makes, with the same argument shapes.
    `flow` is a MAGNITUDE here: order-flow.js derives its direction from the
    sign of its score (positive is buying pressure), so a score labelled
    'short' is negative and one labelled 'long' is positive. This harness used
    to pass a positive score alongside dir 'short' — a pair the producer cannot
    emit — and pack 864, which reads layer 2 relative to the trade instead of
    as a bare magnitude, correctly disagreed with it. Sign it properly and
    every assertion below is about the sentiment layer again, which is what
    this file is for. */
const conf = (dir, pct, flow, sent, risk) => S.hgComputeThreeLayerConfidence(
  { pct: pct, dir: dir },
  { score: (dir === 'short' ? -flow : flow), dir: dir },
  { sentiment: sent }, risk || {});
const near = (a, b) => Math.abs(a - b) < 1e-9;

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the number, and everything downstream of it');
{
  ok(typeof S.hgComputeThreeLayerConfidence === 'function', 'hgComputeThreeLayerConfidence is reachable');
  ok(typeof S.hgIsProGradeSetup === 'function', 'hgIsProGradeSetup is reachable');

  const scan = stripComments(SCAN);
  ok(/threeLayerConfidence: threeLayerConfidence/.test(scan),
     'cryptoscan.js feeds the confidence straight into hgIsProGradeSetup');
  ok(/isHighQuality: qualityGates\.length === 0 && proGradeCheck\.isPro/.test(scan),
     'and isHighQuality is quality gates clear AND that pro-grade stamp');
  ok(/ticket: !!s\.isHighQuality/.test(scan),
     'csFwdRows writes the same flag to the forward log as `ticket`');

  const sent = stripComments(fs.readFileSync(root + 'sentiment.js', 'utf8'));
  ok(/alignment = score;/.test(sent) && /alignment = -score;/.test(sent),
     'sentiment.js is where the convention lives: score for a long, -score for a short');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the same setup, and the market either agrees or does not');
{
  /* the measured table from the report, now as assertions */
  const shortConfirm  = conf('short', 0.80, 0.5, -0.80);   /* bearish, confirms */
  const shortContra   = conf('short', 0.80, 0.5,  0.80);   /* bullish, contradicts */
  ok(shortConfirm.confidence > shortContra.confidence,
     'a short is scored higher when sentiment confirms it than when it contradicts it');
  ok(shortConfirm.confidence.toFixed(3) === '0.799' && shortContra.confidence.toFixed(3) === '0.339',
     'and by the full width of the layer: 0.799 vs 0.339 (0.20 of sentiment, twice, times the 1.15 bonus)');
  ok(shortConfirm.tier === 'professional' && shortContra.tier === 'weak',
     'professional on the confirming read, weak on the contradicting one');
  ok(shortConfirm.shouldTrade === true && shortContra.shouldTrade === false,
     'and shouldTrade follows — it used to be the other way round');

  const longConfirm = conf('long', 0.80, 0.5,  0.80);
  const longContra  = conf('long', 0.80, 0.5, -0.80);
  ok(longConfirm.confidence > longContra.confidence, 'a long behaves the same way');
  ok(near(longConfirm.confidence, shortConfirm.confidence)
     && near(longContra.confidence, shortContra.confidence),
     'long and short are mirror images — neither side gets a free pass');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. longs did not move, which is how we know only the bug changed');
{
  /* Longs were correct before the fix. Their numbers are the regression
     guard: the raw formula and the aligned one are identical for dir long. */
  const cases = [[0.90, 0.6, 0.5], [0.70, 0.2, -0.3], [0.80, 0.0, 0.0], [0.95, 0.9, 0.9]];
  let same = 0;
  for (const [pct, flow, sent] of cases){
    const got = conf('long', pct, flow, sent).confidence;
    const raw = Math.max(0, Math.min(1, pct * 0.40 + Math.abs(flow) * 0.35 + sent * 0.25)) * 1.15;
    if (near(got, Math.min(raw, raw))) same++;
  }
  ok(same === cases.length, 'all four long cases match the original raw-sign arithmetic exactly');

  /* and the short cases are the raw arithmetic with the sentiment term negated */
  let mirrored = 0;
  for (const [pct, flow, sent] of cases){
    const got = conf('short', pct, flow, sent).confidence;
    const want = Math.max(0, Math.min(1, pct * 0.40 + Math.abs(flow) * 0.35 - sent * 0.25)) * 1.15;
    if (near(got, want)) mirrored++;
  }
  ok(mirrored === cases.length, 'and all four short cases are that arithmetic with sentiment negated');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. no direction and no reading contribute nothing, not a guess');
{
  const base = conf('long', 0.80, 0.5, 0).confidence;
  /* pack 864 extended this to layer 2 as well: with no trade direction there is
     nothing for EITHER outside layer to agree or disagree with, so only the
     price layer is left. */
  ok(near(conf(null, 0.80, 0.5, 0.80).confidence, 0.80 * 0.40),
     'direction unknown: sentiment contributes 0 rather than a sign picked at random');
  ok(near(conf(null, 0.80, 0.5, 0.80).confidence, conf(null, 0.80, 0.5, -0.80).confidence),
     'and bullish and bearish give the same answer when there is no trade to compare them to');

  const junk = [undefined, null, '', 'bullish', NaN, {}];
  let clean = 0;
  for (const j of junk){
    const r = S.hgComputeThreeLayerConfidence({ pct: 0.80, dir: 'short' }, { score: -0.5, dir: 'short' },
                                              { sentiment: j }, {});
    if (isFinite(r.confidence) && near(r.confidence, base)) clean++;
  }
  ok(clean === junk.length, 'every unreadable sentiment value reads as 0, never NaN (' + clean + '/' + junk.length + ')');
  ok(isFinite(S.hgComputeThreeLayerConfidence({ pct: 0.8, dir: 'short' }, { score: 0.5, dir: 'short' },
                                              null, {}).confidence),
     'a missing layer-3 object does not take the confidence out with it');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the shipped cache, where every symbol reads +0.272 bullish');
{
  const cache = JSON.parse(fs.readFileSync(root + 'scripts/sentiment-cache/sentiment.json', 'utf8'));
  const scores = Object.keys(cache).map(k => cache[k].score).filter(v => typeof v === 'number');
  ok(scores.length > 0 && scores.every(v => v > 0),
     'the cache on disk is bullish on every symbol it carries (' + scores.length + ' of them)');
  const SENT = scores[0];

  /* This is a HISTORICAL measurement — what the v862 -> v863 sentiment-sign
     change did, on the code as it stood then. Both sides are therefore written
     out rather than read from the live function: pack 864 later changed the
     layer-2 term, and re-deriving these counts under today's arithmetic would
     answer a different question and silently move a number that is quoted in
     cryptoscan-voting-v3.js and in the v863 commit. The live sentiment
     behaviour is pinned by sections 2, 3 and 4 above, which do call it. */
  const shortBefore = (pct, flow) =>    /* v862: sentiment added raw */
    Math.max(0, Math.min(1, pct * 0.40 + Math.abs(flow) * 0.35 + SENT * 0.25)) * 1.15;
  const shortAfter = (pct, flow) =>     /* v863: sentiment negated for a short */
    Math.max(0, Math.min(1, pct * 0.40 + Math.abs(flow) * 0.35 - SENT * 0.25)) * 1.15;

  let cells = 0, lost = 0, gained = 0;
  for (let pct = 0.60; pct <= 0.98001; pct += 0.02){
    for (let flow = 0; flow <= 0.9001; flow += 0.1){
      cells++;
      const was = shortBefore(pct, flow) >= 0.75;
      const now = shortAfter(pct, flow) >= 0.75;
      if (was && !now) lost++;
      if (!was && now) gained++;
    }
  }
  ok(cells === 200, 'the grid is the 200 cells the report measured');
  ok(lost > 0, lost + ' short setups held the pro-grade bar only on the wrong sign, and no longer do');
  ok(gained === 0, 'and none gained it — the correction only ever removes a short from that cohort');
  ok(Math.abs(lost / cells - 0.185) < 0.02,
     'which is the 18.5% the code comment claims (measured ' + (100 * lost / cells).toFixed(1) + '%)');

  /* longs on the same cache are untouched, and this half IS live: a long's
     flow score is positive, so the aligned reading and the old magnitude are
     the same number and the whole expression must still match v862 exactly. */
  const longBefore = (pct, flow) =>
    Math.max(0, Math.min(1, pct * 0.40 + Math.abs(flow) * 0.35 + SENT * 0.25)) * 1.15;
  let longMoved = 0;
  for (let pct = 0.60; pct <= 0.98001; pct += 0.02){
    for (let flow = 0; flow <= 0.9001; flow += 0.1){
      if (!near(conf('long', +pct.toFixed(2), +flow.toFixed(2), SENT).confidence, longBefore(pct, flow))) longMoved++;
    }
  }
  ok(longMoved === 0, 'not one of the 200 long cells moved, measured against the live function');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. what the PROFESSIONAL-GRADE stamp really stands for');
{
  const pro = s => S.hgIsProGradeSetup(s);
  const good = { threeLayerConfidence: 0.80, layerAgreement: 2, externalRisk: {},
                 qualityGates: [], plan: { rr1: 1.5 } };
  ok(pro(good).isPro === true, 'confidence 0.80 + layers agreeing + no cascade + no gates is pro-grade');
  ok(pro(Object.assign({}, good, { threeLayerConfidence: 0.74 })).isPro === false, 'confidence 0.74 is not');
  ok(pro(Object.assign({}, good, { layerAgreement: 1 })).isPro === false, 'partial layer agreement is not');
  ok(pro(Object.assign({}, good, { externalRisk: { cascadeImminent: true } })).isPro === false,
     'an imminent liquidation cascade is not');
  ok(pro(Object.assign({}, good, { qualityGates: ['regime: CHOP'] })).isPro === false,
     'and one open quality gate is not');

  /* R:R is reported, and is vacuous, and must not be in the conjunction */
  ok(pro(good).checks.positiveRR === true, 'positiveRR is reported on the checks object');
  ok(pro(Object.assign({}, good, { plan: { rr1: 0.5 } })).isPro === true,
     'a plan that FAILS it is still pro-grade — it is not one of the standards');
  const ultra = stripComments(fs.readFileSync(root + 'cryptoultra.js', 'utf8'));
  ok(/t1R: 1\.5/.test(ultra), 'cryptoultra.js sets RULE.t1R to the constant 1.5');
  ok(/rr1: rule\.t1R/.test(ultra), 'and every plan it prices carries rr1: rule.t1R');
  const body = stripComments(VOTE);
  ok(!/checks\.positiveRR/.test(body.slice(body.indexOf('var proGrade'))),
     'so positiveRR stays out of the proGrade conjunction — adding it would tighten nothing');
  ok(!/1:2 minimum/.test(VOTE), 'and the header no longer claims a 1:2 risk-reward standard');
  ok(!/All three layers agree/.test(VOTE),
     'nor that layerAgreement means all three layers — it is price versus order flow');

  const nul = pro(null);
  ok(nul && nul.isPro === false && nul.tier === 'RECORD-ONLY',
     'a null setup returns the same shape as any other, so callers can read .isPro');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. the card no longer describes three conditions out of seven');
{
  /* comments OUT first. The comment explaining this fix quotes the old label
     verbatim, and a scanner reading its own explanation back is how four
     earlier packs shipped a false positive. What is asserted here is what the
     browser renders, so the source it reads must be the code alone. */
  const rendered = stripComments(SCAN);
  ok(/75%\+ confidence, trend, liquid hours/.test(SCAN) && !/75%\+ confidence, trend, liquid hours/.test(rendered),
     'the old wording survives ONLY in the comment that explains it — the card no longer prints it');
  ok(!/HIGH-QUALITY SIGNALS \(75%\+ confidence, trend regime, liquid hours\)/.test(rendered),
     'and the green block header drops it too');
  ok(/every quality gate clear/.test(rendered) && /price and (order )?flow agree/.test(rendered),
     'both now name the gates AND the pro-grade half');
  ok(/fixed 1\.5R/.test(rendered),
     'and the footnote says plainly that risk-reward filters nothing here');
  ok(/\(hq\.length === 1 \? '' : 's'\)/.test(rendered),
     "zero setups reads '0 HIGH-QUALITY setups', not '0 ... setup'");
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
