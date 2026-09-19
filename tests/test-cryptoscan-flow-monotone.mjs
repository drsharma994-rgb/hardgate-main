/* HARDGATE — CRYPTO SCAN was most confident when order flow argued against it.

   hgComputeThreeLayerConfidence took layer 2 like this:

     (Math.abs(l2.score || 0) * 0.35)

   with direction supposedly carried by the +-15%/-20% agreement multiplier
   further down. Composed, it is not: the multiplier is far too small to undo a
   0.35-weighted magnitude term, so the confidence curve is V-SHAPED in flow
   agreement with its MINIMUM at flow = 0. One long, pct 0.90, sentiment +0.60,
   sweeping the flow read from fully against to fully with:

     flow -0.9 (hard against)  0.660
     flow -0.5                 0.548
     flow  0.0 (NO OPINION)    0.408   <- the lowest point on the curve
     flow +0.5                 0.788
     flow +0.9 (hard with)     0.949

   The harder order flow argued AGAINST the trade, the more confident the desk
   became. Swept over 200 configurations that held in every single one: 100%
   non-monotone, and in 100% a neutral flow scored below an opposing one.

   Two causes, both in that one function. Math.abs() credits conviction-against
   straight to the base. And 'neutral' is a truthy string, so the l2.dir compare
   read no-opinion as disagreement — charging it the 0.80 penalty and printing
   "L1/L2 divergence" on the card while denying it the magnitude credit an
   opposing read collected. A flow reader that RAN and said neutral therefore
   scored BELOW one that was never loaded at all: 0.408 against 0.510.

   Layer 2 is now read relative to the trade, exactly as layer 3 is, and only a
   real long/short call takes the multiplier. Measured over 6,840
   configurations: 2,520 of them have flow agreeing with the trade and the
   confidence changed in ZERO of those, so the pro-grade cohort (694 cells
   before, 694 after, 0 moved) does not move at all — that stamp requires
   layerAgreement === 2, which IS the agreeing case. 166 cells change tier and
   shouldTrade, all of them in the region where flow was being paid to disagree,
   and 1,800 lose a "L1/L2 divergence" line that was never true.

   Run: node tests/test-cryptoscan-flow-monotone.mjs */
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
/** Body of a top-level `function name(...)`, comments removed. Scoped, because
    hgVotingSummary legitimately prints Math.abs(l2.score) as a magnitude and a
    whole-file scan would read that as the defect still being present. */
function fnBody(src, name){
  const s = stripComments(src);
  const at = s.indexOf('\nfunction ' + name + '(');
  if (at < 0) return '';
  const open = s.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < s.length; i++){
    if (s[i] === '{') depth++;
    else if (s[i] === '}'){ depth--; if (!depth) return s.slice(open, i + 1); }
  }
  return '';
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

/* order-flow.js derives its direction from the score with a +-0.2 dead band;
   the tab passes both straight through, so the harness must too. */
const dirOf = sc => sc > 0.2 ? 'long' : sc < -0.2 ? 'short' : 'neutral';
const conf = (dir, pct, flow, sent, flowDir) => S.hgComputeThreeLayerConfidence(
  { pct: pct, dir: dir },
  { score: flow, dir: flowDir === undefined ? dirOf(flow) : flowDir },
  { sentiment: sent }, {});
const near = (a, b) => Math.abs(a - b) < 5e-4;

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the layer, its producer, and what the number decides');
{
  ok(typeof S.hgComputeThreeLayerConfidence === 'function', 'hgComputeThreeLayerConfidence is reachable');
  const flow = stripComments(fs.readFileSync(root + 'order-flow.js', 'utf8'));
  ok(/score: Math\.max\(-1, Math\.min\(1, aggregated\)\)/.test(flow),
     'order-flow.js emits a SIGNED score, -1 to +1');
  ok(/aggregated > 0\.2 \? 'long' : aggregated < -0\.2 \? 'short' : 'neutral'/.test(flow),
     "and a direction with a +-0.2 dead band whose middle is the string 'neutral'");
  const scan = stripComments(fs.readFileSync(root + 'cryptoscan.js', 'utf8'));
  ok(/score: orderFlow\.score \|\| 0, dir: orderFlowDir/.test(scan),
     'cryptoscan.js hands both of those to the confidence function unchanged');
  ok(/if \(orderFlowDir === 'neutral'\)\s*\{\s*layerAgreement = 1;/.test(scan),
     'and cryptoscan.js itself already treats neutral as partial, not as disagreement');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. confidence rises with agreement now, all the way across');
{
  const sweep = [];
  for (let sc = -0.9; sc <= 0.9001; sc += 0.1){
    sweep.push(conf('long', 0.90, +sc.toFixed(1), 0.60).confidence);
  }
  let breaks = 0;
  for (let i = 1; i < sweep.length; i++) if (sweep[i] < sweep[i - 1] - 1e-12) breaks++;
  ok(breaks === 0, 'the 19-step sweep from hard-against to hard-with never turns back (0 breaks, was 9)');
  ok(sweep[0] < sweep[9] && sweep[9] < sweep[18],
     'hard-against < no-opinion < hard-with, which is the whole point');
  ok(near(sweep[18], 0.949), 'the hard-with end is still 0.949 — the agreeing side did not move');
  ok(near(sweep[9], 0.510) && near(sweep[0], 0.156),
     'no-opinion is 0.510 and hard-against 0.156 (they were 0.408 and 0.660, the wrong way round)');

  /* and it is general, not a property of one slice */
  let cells = 0, nonMono = 0;
  for (let pct = 0.60; pct <= 0.98001; pct += 0.02){
    for (let sent = -1; sent <= 1.0001; sent += 0.5){
      for (const d of ['long', 'short']){
        cells++;
        const sgn = d === 'long' ? 1 : -1;
        let prev = -Infinity, bad = false;
        for (let mag = -0.9; mag <= 0.9001; mag += 0.1){
          const c = conf(d, +pct.toFixed(2), +(sgn * mag).toFixed(2), +sent.toFixed(2)).confidence;
          if (c < prev - 1e-12) bad = true;
          prev = c;
        }
        if (bad) nonMono++;
      }
    }
  }
  ok(cells === 200, 'the general sweep is the 200 configurations the report measured');
  ok(nonMono === 0, 'none of them is non-monotone in flow agreement (all 200 were)');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. a neutral read is silence, and silence is not dissent');
{
  const neutral  = conf('long', 0.90, 0, 0.60);
  const opposing = conf('long', 0.90, -0.5, 0.60);
  ok(neutral.confidence > opposing.confidence,
     'no opinion now scores ABOVE an opinion against (0.510 vs 0.268)');
  ok((neutral.gateReasons || []).indexOf('L1/L2 divergence') < 0,
     'and carries no "L1/L2 divergence" line — the layers did not diverge, one said nothing');
  ok((opposing.gateReasons || []).indexOf('L1/L2 divergence') >= 0,
     'while a genuine opposing call still does');

  /* the 0.80 penalty is gone from the neutral path: prove it by arithmetic */
  const bare = 0.90 * 0.40 + 0 * 0.35 + 0.60 * 0.25;
  ok(near(neutral.confidence, bare),
     'a neutral read takes neither the 1.15 bonus nor the 0.80 penalty (' + neutral.confidence.toFixed(3) + ')');

  let checked = 0, clean = 0;
  for (let pct = 0.60; pct <= 0.98001; pct += 0.02){
    for (let sent = -1; sent <= 1.0001; sent += 0.25){
      for (const d of ['long', 'short']){
        checked++;
        const r = conf(d, +pct.toFixed(2), 0, +sent.toFixed(2));
        if ((r.gateReasons || []).indexOf('L1/L2 divergence') < 0) clean++;
      }
    }
  }
  ok(checked === 360 && clean === 360,
     'across all ' + checked + ' neutral-flow cells, not one claims a divergence');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. running the flow reader is no longer worse than not having it');
{
  const ran     = conf('long', 0.90, 0, 0.60);              /* module loaded, says neutral */
  const missing = conf('long', 0.90, 0, 0.60, undefined);   /* dirOf(0) is neutral */
  const absent  = S.hgComputeThreeLayerConfidence({ pct: 0.90, dir: 'long' }, {}, { sentiment: 0.60 }, {});
  ok(near(ran.confidence, absent.confidence),
     'a reader that ran and said neutral scores the same as no reader at all (was 0.408 vs 0.510)');
  ok(near(missing.confidence, ran.confidence), 'and the two neutral shapes agree with each other');
  ok((absent.gateReasons || []).indexOf('L1/L2 divergence') < 0,
     'an absent layer 2 still invents no divergence');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the agreeing case, which is the only one that can be pro-grade, is untouched');
{
  /* whenever flow points the way the trade does, |score| and the aligned score
     are the same number, so this branch must be bit-identical to the old one */
  let agree = 0, moved = 0, proWas = 0, proNow = 0;
  for (let pct = 0.60; pct <= 0.98001; pct += 0.02){
    for (let sent = -1; sent <= 1.0001; sent += 0.25){
      for (const d of ['long', 'short']){
        const sgn = d === 'long' ? 1 : -1;
        for (let mag = 0.3; mag <= 0.9001; mag += 0.1){
          const sc = +(sgn * mag).toFixed(2);
          if (dirOf(sc) !== d) continue;
          agree++;
          const got = conf(d, +pct.toFixed(2), sc, +sent.toFixed(2)).confidence;
          /* the old arithmetic, written out: abs magnitude, raw sentiment for a
             long and negated for a short (v863), times the agreement bonus */
          const s3 = d === 'long' ? +sent.toFixed(2) : -(+sent.toFixed(2));
          const old = Math.max(0, Math.min(1, pct * 0.40 + Math.abs(sc) * 0.35 + s3 * 0.25)) * 1.15;
          if (Math.abs(got - old) > 1e-12) moved++;
          if (old >= 0.75) proWas++;
          if (got >= 0.75) proNow++;
        }
      }
    }
  }
  ok(agree === 2520, 'the agreeing region is the 2,520 cells the report measured');
  ok(moved === 0, 'and the confidence changed in NONE of them');
  ok(proWas === 694 && proNow === 694,
     'the pro-grade-eligible count is 694 before and 694 after — the HIGH-QUALITY cohort does not move');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. an unreadable flow layer contributes nothing, never NaN');
{
  const base = conf('long', 0.80, 0, 0).confidence;
  const junk = [undefined, null, '', 'strong', NaN, {}, []];
  let clean = 0;
  for (const j of junk){
    const r = S.hgComputeThreeLayerConfidence({ pct: 0.80, dir: 'long' },
                                              { score: j, dir: 'neutral' }, { sentiment: 0 }, {});
    if (isFinite(r.confidence) && Math.abs(r.confidence - base) < 1e-12) clean++;
  }
  ok(clean === junk.length, 'every unreadable score reads as 0 (' + clean + '/' + junk.length + ')');
  ok(isFinite(S.hgComputeThreeLayerConfidence({ pct: 0.8, dir: 'long' }, null, { sentiment: 0 }, {}).confidence),
     'a missing layer-2 object does not take the confidence out with it');
  ok(near(S.hgComputeThreeLayerConfidence({ pct: 0.8, dir: null },
          { score: 0.9, dir: 'long' }, { sentiment: 0.9 }, {}).confidence, 0.8 * 0.40),
     'no trade direction: neither flow nor sentiment can be judged, so neither contributes');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. pinned in source, including the pack before this one');
{
  const body = fnBody(VOTE, 'hgComputeThreeLayerConfidence');
  ok(body.length > 0, 'hgComputeThreeLayerConfidence is a top-level declaration');
  ok(/\(l2Aligned \* 0\.35\)/.test(body), 'the base takes the ALIGNED flow score');
  ok(!/Math\.abs\(l2\.score/.test(body), 'and no longer its bare magnitude');
  ok(/Math\.abs\(l2\.score/.test(fnBody(VOTE, 'hgVotingSummary')),
     'while hgVotingSummary keeps it, because there it PRINTS a magnitude beside a direction');
  ok(/l1\.dir === 'long' \? l2Raw : l1\.dir === 'short' \? -l2Raw : 0/.test(body),
     'aligned means signed against the trade direction, the same rule layer 3 uses');
  ok(/l2Dir = \(l2 && \(l2\.dir === 'long' \|\| l2\.dir === 'short'\)\) \? l2\.dir : null/.test(body),
     "only 'long' or 'short' counts as a call from the flow layer");
  ok(/l1\.dir && l2Dir && l1\.dir === l2Dir/.test(body) && !/l1\.dir && l2\.dir/.test(body),
     'and the agreement multiplier reads l2Dir, not the raw string');
  const summary = fnBody(VOTE, 'hgVotingSummary');
  ok(/l2d = \(l2 && \(l2\.dir === 'long' \|\| l2\.dir === 'short'\)\)/.test(summary)
     && !/if \(l1\.dir === l2\.dir\)/.test(summary),
     'the dead hgVotingSummary carried the same neutral-is-dissent line, and no longer does');
  /* v863 must survive this change */
  ok(/\(l3Aligned \* 0\.25\)/.test(body) && /l1\.dir === 'short' \? -l3Raw : 0/.test(body),
     'the sentiment alignment from the previous pack is still in place');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
