/* HARDGATE — CRYPTO SCAN's external-risk layer had never measured anything.

   liquidation-intelligence.js exposes cascade detection, whale tracking,
   funding-imbalance risk and exchange flow. Every leaf reader in it is an
   unwired integration point that returns a neutral placeholder, and the two
   readers built on top inherit it, so the whole layer is a constant:

     hgExternalRiskScore(sym) over BTCUSDT, ETHUSDT, DOGEUSDT, B-PEPE_USDT,
     XAUTUSD, '', 'nonsense', null, undefined and {} — ten inputs, ONE
     distinct result:
       { riskScore: 0, cascadeImminent: false, whaleActive: false,
         fundingExtreme: false, flowAbnormal: false, recommendation: 'OK' }

   That is not a finding of low risk, it is the absence of a measurement, and
   it was indistinguishable from one. Three things read it and all three were
   dead: the LIQUIDATION_CASCADE veto in hgComputeThreeLayerConfidence (which
   returns confidence 0 and blocks the trade), the whale CAUTION_LONGS penalty
   beside it, and the CASCADE / WHALE / FUNDING flags on the card — whose empty
   line read as "no risk found".

   It also reached the PROFESSIONAL-GRADE stamp. noLiquidationRisk is one of
   the four conditions in hgIsProGradeSetup's conjunction, and it has been true
   on every setup ever stamped. Pack 863 rewrote that function's header to say
   what the stamp really requires, listed two things it does not, and did not
   check this one. That is corrected here.

   Nothing is invented and no gate is loosened. Each reader now reports
   measured:false, the aggregate names which sources are missing, the card
   prints UNCHECKED, and the verdict fields stay fail-open, which is this
   repo's rule for a missing feed. Each reader also takes an injected
   dependency, so the arithmetic above the feed is proven to work the day one
   is wired rather than discovered broken then — and one branch was already
   broken: hgWhaleSentiment's distribution test read `flow.inflow > 0.7 &&
   baseScore < 0` with baseScore initialised to 0 two lines above, so it could
   not fire even with live data.

   Run: node tests/test-cryptoscan-external-risk.mjs */
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
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error };
  s.window = s; s.globalThis = s; s.self = s;
  s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  vm.createContext(s);
  for (const f of ['order-flow.js', 'liquidation-intelligence.js', 'cryptoscan-voting-v3.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const LIQ = fs.readFileSync(root + 'liquidation-intelligence.js', 'utf8');
const VOTE = fs.readFileSync(root + 'cryptoscan-voting-v3.js', 'utf8');
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
/** a reading that claims to have been measured */
const M = o => Object.assign({ measured: true }, o);

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the layer is a constant, over every input the scan can hand it');
{
  const inputs = ['BTCUSDT', 'ETHUSDT', 'DOGEUSDT', 'B-PEPE_USDT', 'XAUTUSD',
                  '', 'nonsense', null, undefined, {}];
  const verdicts = new Set(inputs.map(q => JSON.stringify({
    riskScore: S.hgExternalRiskScore(q).riskScore,
    cascadeImminent: S.hgExternalRiskScore(q).cascadeImminent,
    whaleActive: S.hgExternalRiskScore(q).whaleActive,
    fundingExtreme: S.hgExternalRiskScore(q).fundingExtreme,
    flowAbnormal: S.hgExternalRiskScore(q).flowAbnormal,
    recommendation: S.hgExternalRiskScore(q).recommendation
  })));
  ok(inputs.length === 10, 'ten different inputs');
  ok(verdicts.size === 1, 'produce exactly one distinct verdict');
  ok(S.hgExternalRiskScore('BTCUSDT').riskScore === 0, 'and that verdict is riskScore 0');

  for (const fn of ['hgFundingRateRisk', 'hgExchangeFlow', 'hgWhaleSentiment', 'hgLiquidationRisk']){
    ok(JSON.stringify(S[fn]('BTCUSDT')) === JSON.stringify(S[fn]('DOGEUSDT')),
       fn + ' returns the same object for BTC and DOGE');
  }
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. it says so now, instead of reporting a clean bill of health');
{
  const r = S.hgExternalRiskScore('BTCUSDT');
  ok(r.measured === false && r.unchecked === true, 'the aggregate reports itself unmeasured');
  ok(Array.isArray(r.uncheckedSources) && r.uncheckedSources.length === 4,
     'and names all four missing sources (' + (r.uncheckedSources || []).join(', ') + ')');
  ok(/UNCHECKED/.test(r.why || ''), 'with a line the card can print (' + r.why + ')');

  let declared = 0;
  for (const fn of ['hgFundingRateRisk', 'hgExchangeFlow', 'hgWhaleSentiment', 'hgLiquidationRisk']){
    const v = S[fn]('BTCUSDT');
    if (v.measured === false && v.unchecked === true) declared++;
  }
  ok(declared === 4, 'each of the four readers declares itself unmeasured');
  ok(/no liquidation, whale or flow feed wired/.test(S.hgLiquidationRisk('BTCUSDT').reason),
     'and the cascade reader no longer reports "Liquidation risk low" when it looked at nothing');

  /* fail-open is preserved: an unwired reader must not veto either */
  ok(r.cascadeImminent === false && r.recommendation === 'OK',
     'the verdict fields stay fail-open — an absent reader cannot veto any more than it can clear');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the arithmetic above the feed works, which is how we know it is only unwired');
{
  const dump = S.hgWhaleSentiment('BTCUSDT', M({ inflow: 0.8 }));
  ok(dump.activity === 'dump' && dump.distributing === true && dump.score === -0.6,
     'heavy exchange inflow reads as distribution — the branch that `baseScore < 0` had frozen shut');
  const acc = S.hgWhaleSentiment('BTCUSDT', M({ inflow: -0.8 }));
  ok(acc.activity === 'accumulation' && acc.accumulating === true,
     'and heavy outflow still reads as accumulation');
  ok(S.hgWhaleSentiment('BTCUSDT', M({ inflow: 0.0 })).activity === 'neutral',
     'a measured flow of zero is neutral, and is reported as measured');
  ok(S.hgWhaleSentiment('BTCUSDT', M({ inflow: 0 })).unchecked === false,
     'so a real zero and an absent feed are no longer the same answer');

  const hot = S.hgLiquidationRisk('BTCUSDT', {
    funding: M({ imbalance: 0.8 }),
    whale: M({ score: -0.6, activity: 'dump', distributing: true }),
    flow: M({ inflow: 0.8 }) });
  ok(hot.cascade === true && hot.level === 'high', 'all three signals hot gives a high-level cascade');
  ok(Math.abs(hot.score - 0.90) < 1e-9, 'scoring 0.30 + 0.35 + 0.25 = 0.90 exactly');
  ok(hot.measured === true && hot.unchecked === false, 'and it reports itself measured');

  const calm = S.hgLiquidationRisk('BTCUSDT', {
    funding: M({ imbalance: 0.1 }), whale: M({ score: 0, activity: 'neutral' }), flow: M({ inflow: 0.1 }) });
  ok(calm.cascade === false && calm.measured === true,
     'and a measured calm tape is a real "low", distinct from the unmeasured one');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the three gates that read it are reachable, not merely present');
{
  const hotAgg = S.hgExternalRiskScore('BTCUSDT', {
    funding: M({ imbalance: 0.8 }),
    whale: M({ score: -0.6, activity: 'dump', distributing: true }),
    flow: M({ inflow: 0.8 }),
    liq: M({ cascade: true, level: 'high', score: 0.9 }) });
  ok(hotAgg.cascadeImminent === true && hotAgg.recommendation === 'AVOID_LONGS',
     'the aggregate escalates to AVOID_LONGS');
  ok(hotAgg.measured === true && hotAgg.unchecked === false, 'and reports itself measured');

  const veto = S.hgComputeThreeLayerConfidence(
    { pct: 0.95, dir: 'long' }, { score: 0.9, dir: 'long' }, { sentiment: 0.9 }, hotAgg);
  ok(veto.confidence === 0 && veto.shouldTrade === false,
     'the LIQUIDATION_CASCADE veto kills a 0.95 long outright');
  ok((veto.gateReasons || []).indexOf('LIQUIDATION_CASCADE') >= 0, 'and names itself');

  const cautionAgg = S.hgExternalRiskScore('BTCUSDT', {
    funding: M({ imbalance: 0.1 }),
    whale: M({ score: -0.4, activity: 'dump', distributing: true }),
    flow: M({ inflow: 0.1 }),
    liq: M({ cascade: false, level: 'low', score: 0.1 }) });
  const withWhale = S.hgComputeThreeLayerConfidence(
    { pct: 0.90, dir: 'long' }, { score: 0.5, dir: 'long' }, { sentiment: 0 }, cautionAgg);
  const without = S.hgComputeThreeLayerConfidence(
    { pct: 0.90, dir: 'long' }, { score: 0.5, dir: 'long' }, { sentiment: 0 }, {});
  ok(withWhale.confidence < without.confidence,
     'the whale CAUTION_LONGS penalty bites (' + without.confidence.toFixed(3)
       + ' -> ' + withWhale.confidence.toFixed(3) + ')');

  const pro = s => S.hgIsProGradeSetup(Object.assign(
    { threeLayerConfidence: 0.90, layerAgreement: 2, qualityGates: [], plan: { rr1: 1.5 } }, s));
  ok(pro({ externalRisk: hotAgg }).isPro === false,
     'and a cascade takes the PROFESSIONAL-GRADE stamp away');
  ok(pro({ externalRisk: hotAgg }).checks.noLiquidationRisk === false,
     'through the noLiquidationRisk check, which had been true on every setup ever stamped');
  ok(pro({ externalRisk: S.hgExternalRiskScore('BTCUSDT') }).isPro === true,
     'while an UNCHECKED layer still fails open and leaves the stamp alone');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the card stops showing an empty risk line as a clean one');
{
  /* RENDER the card. A source scan here survived a mutation that made the
     branch unreachable: the regex for `s.externalRisk.unchecked` matched
     `s.externalRisk.uncheckedSources` inside the body it had just killed. */
  ok(typeof S.__csSetupCardHTML === 'function', 'the card renderer is reachable');
  const card = ext => S.__csSetupCardHTML({
    label: 'BTC', sym: 'BTCUSDT', exchange: 'delta', dir: 'long', pct: 0.82,
    line: 'x', price: 100, atr: 2, regime: 'trend', layerAgreement: 2,
    threeLayerConfidence: 0.8, voteTier: 'professional', count: { total: 470, decisive: 300, kinds: {} },
    externalRisk: ext, plan: null, qualityGates: [], gates: [], votes: []
  }, 0);

  const unchecked = card(S.hgExternalRiskScore('BTCUSDT'));
  ok(/EXTERNAL RISK UNCHECKED/.test(unchecked),
     'an unwired layer renders the UNCHECKED line on the card');
  ok(/liquidation \/ whale \/ funding \/ flow/.test(unchecked),
     'naming every feed that is missing');
  ok(/cascade and whale gates cannot fire/.test(unchecked),
     'and saying plainly that the gates behind it cannot fire');

  const clean = card({ measured: true, unchecked: false, cascadeImminent: false,
                       whaleActive: false, fundingExtreme: false });
  ok(!/EXTERNAL RISK UNCHECKED/.test(clean),
     'a layer that measured and found nothing prints no such line');

  const hot = card({ measured: true, unchecked: false, cascadeImminent: true,
                     whaleActive: true, fundingExtreme: true });
  ok(/CASCADE/.test(hot) && /WHALE/.test(hot) && /FUNDING/.test(hot),
     'and real risk still renders the flags, which had never once been reachable');
  ok(!/EXTERNAL RISK UNCHECKED/.test(hot), 'without the unchecked line beside them');

  const nasty = card({ measured: false, unchecked: true,
                       uncheckedSources: ['<img src=x onerror=alert(1)>'] });
  ok(!/<img/.test(nasty) && /&lt;img/.test(nasty),
     'the source names are escaped before they reach the DOM');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the pro-grade contract, corrected for the third time');
{
  ok(/Three things it does NOT require/.test(VOTE),
     'the header now lists three, not two — pack 863 missed this one');
  ok(/vacuous through ABSENCE rather than by\s*\n \*\s*construction/.test(VOTE),
     'and distinguishes it from positiveRR, which can never discriminate');
  const body = stripComments(VOTE);
  ok(/noLiquidationRisk &&/.test(body),
     'it stays in the conjunction, because it starts working the day a feed lands');

  /* the two same-named functions, and which one wins on window */
  ok(/function hgLiquidationRisk\(/.test(fs.readFileSync(root + 'order-flow.js', 'utf8')),
     'order-flow.js declares its own hgLiquidationRisk');
  ok(/function hgLiquidationRisk\(/.test(LIQ), 'and so does liquidation-intelligence.js');
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  ok(html.indexOf('order-flow.js') < html.indexOf('liquidation-intelligence.js'),
     'the second loads last, so its export is the one on window — both are stubs, so nothing differs today');
  ok(S.hgExternalRiskScore('BTCUSDT').uncheckedSources.indexOf('liquidation') === 0,
     'and the aggregate calls its own, not whichever won the global');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
