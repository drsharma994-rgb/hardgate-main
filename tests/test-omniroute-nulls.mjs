/* =========================================================================
tests/test-omniroute-nulls.mjs

Regression guard for the crash that killed the OMNIROUTE scan in the field:

  scan failed: Cannot read properties of null (reading 'toFixed')

Root cause was a JavaScript trap rather than a typo. `isFinite(null)` is
TRUE — null coerces to 0 — so the natural-looking guard

    isFinite(x.foo) ? x.foo.toFixed(2) : 'unavailable'

passes for null and then throws on .toFixed. The venues return nulls BY
DESIGN: xuPositioning reports fundingPct:null for every CoinDCX contract,
and CoinDCX is ~494 of the ~500 contracts scanned. So the very first
CoinDCX setup killed the whole sweep.

These tests feed every gate the null/undefined/'' shapes the real venue
payloads produce and assert the ledger survives and reports UNCHECKED —
never a silent PASS, which would be worse than the crash.
========================================================================= */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* omniroute.js is a classic script: evaluate it with a window shim. */
const win = {};
/* hg-gates.js holds the gate logic that was identical in both desks. */
new Function('window', readFileSync(path.join(ROOT, 'hg-gates.js'), 'utf8'))(win);
const src = readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
new Function('window', src)(win);

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.log('FAIL  - ' + msg); }
}

/* ---- a bar series with a spring on the final bar ---- */
function fixture(){
  const rows = [];
  let px = 100;
  for (let i = 0; i < 80; i++){
    const o = px, c = px + 0.05;
    rows.push({ t: 1700000000 + i * 14400, o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c, v: 1000 });
    px = c;
  }
  rows.push({ t: 1700000000 + 80 * 14400, o: px, h: px + 0.2, l: px - 5, c: px + 0.4, v: 3000 });
  return rows;
}
const rows = fixture();
const hit = { kind: 'SPRING', dir: 'long', level: 99, why: 'test' };

/* ---- 1. the exact field that crashed production ---- */
{
  const coindcx = { sym: 'B-BTC_USDT', base: 'BTC', fundingPct: null, oiUsd: null, mark: 50000, exchange: 'coindcx' };
  let threw = null;
  try { win.hgOmniGates(rows, hit, coindcx, {}); } catch (e) { threw = e.message; }
  ok(threw === null, 'CoinDCX positioning (fundingPct:null) does not throw — ' + (threw || 'clean'));

  const g = win.hgOmniGates(rows, hit, coindcx, {});
  const funding = g.filter(x => x.key === 'funding')[0];
  ok(funding.pass === null, 'null funding reads UNCHECKED, not a silent PASS');
}

/* ---- 2. every conditional gate, against every empty shape ---- */
const emptyShapes = [null, undefined, ''];
const fields = [
  ['oi',     v => ({ oi: { changePct: v } }),        'oi-build'],
  ['retail', v => ({ retail: { longPct: v } }),      'retail-contrarian'],
  ['taker',  v => ({ taker: { buySellRatio: v } }),  'taker-flow'],
  ['depth',  v => ({ depth: { bidUsd: v, askUsd: v } }), 'book-depth'],
  ['htf',    v => ({ htf: { e21: v, e50: v } }),     'htf-daily'],
  ['stats',  v => ({ stats: { samples: v, hit: v, expR: v } }), 'measured-edge']
];
for (const [name, mk, gateKey] of fields){
  for (const shape of emptyShapes){
    const label = name + ' = ' + (shape === null ? 'null' : shape === undefined ? 'undefined' : "''");
    let threw = null, gates = null;
    try { gates = win.hgOmniGates(rows, hit, null, mk(shape)); } catch (e) { threw = e.message; }
    ok(threw === null, label + ' does not throw' + (threw ? (' — ' + threw) : ''));
    if (gates){
      const g = gates.filter(x => x.key === gateKey)[0];
      ok(g && g.pass === null, label + ' -> ' + gateKey + ' UNCHECKED (never a silent pass)');
    }
  }
}

/* ---- 3. all of it null at once, the way a CoinDCX-only contract arrives ---- */
{
  let threw = null;
  try {
    const g = win.hgOmniGates(rows, hit, { fundingPct: null }, {
      htf: { e21: null, e50: null }, oi: { changePct: null }, retail: { longPct: null },
      taker: { buySellRatio: null }, depth: { bidUsd: null, askUsd: null },
      stats: { samples: null, hit: null, expR: null }
    });
    const grade = win.hgOmniGrade(g);
    ok(grade && typeof grade.ticket === 'boolean', 'all-null payload still grades');
  } catch (e) { threw = e.message; }
  ok(threw === null, 'every conditional field null at once does not throw');
}

/* ---- 4. real values must still be read (the guard must not over-reject) ---- */
{
  const g = win.hgOmniGates(rows, hit, { fundingPct: 0.0123 }, {
    retail: { longPct: 81 }, taker: { buySellRatio: 1.4 }, oi: { changePct: -9 }
  });
  const by = k => g.filter(x => x.key === k)[0];
  ok(by('funding').pass === true, 'a real funding number still evaluates');
  ok(by('retail-contrarian').pass === false, 'retail 81% long on a long setup still vetoes');
  ok(by('oi-build').pass === false, 'OI -9% still vetoes');
}

/* ---- 5. measured-edge only vetoes a CLEARLY losing detector ----
   A veto on any negative expectancy silenced the entire tab: the walk-forward
   is in-sample over a short window and a 2R system near its 33% breakeven
   drifts negative on noise alone. */
{
  const edge = st => win.hgOmniGates(rows, hit, null, { stats: st }).filter(x => x.key === 'measured-edge')[0];
  ok(edge({ samples: 40, hit: 0.13, expR: -0.60 }).pass === false, 'clearly losing detector (40 smp, -0.60R) is vetoed');
  /* These two now read UNCHECKED rather than PASS, and that is the point of
     the family-wise bar: 45% over 40 samples on a 2R floor is +1.57 sigma,
     and across six scanned mechanics the best of six clears that by chance
     most of the time. The gate is SOFT, so an unchecked read does not veto
     and the ticket still forms — which is exactly what this section exists to
     protect. What changed is that the card stops calling an unproven number
     evidence, not that the tab went quiet. */
  ok(edge({ samples: 40, hit: 0.30, expR: -0.10 }).pass !== false, 'marginally negative (40 smp, -0.10R) is NOT vetoed on noise');
  ok(edge({ samples: 40, hit: 0.45, expR: 0.35 }).pass !== false,  'a profitable-looking detector is not vetoed');
  ok(edge({ samples: 40, hit: 0.45, expR: 0.35 }).pass === null,   'but reads UNCHECKED — +1.57 sigma does not clear the six-mechanic bar');
  ok(edge({ samples: 400, hit: 0.46, expR: 0.35 }).pass === true,  'a detector with a real sample behind it still PASSES');
  /* And an unchecked measured-edge must not cost the ticket. */
  ok(win.hgOmniGrade([{ key: 'measured-edge', hard: false, pass: null, why: 'x' }]).ticket === true,
     'an UNCHECKED measured-edge leaves the ticket standing');
  ok(edge({ samples: 8,  hit: 0.63, expR: 0.90 }).pass === null,   'too few samples reads UNCHECKED, however good the number looks');
  /* This used to assert pass === true, and the PASS was the defect. A live
     gold card showed a green PASS beside "-2.09 sigma vs breakeven" on the
     only ticket the desk was recommending, while the pool table above it read
     "has not paid" for the same mechanic on the same number: the table judges
     past MIN_SAMPLES (20), the gate refused to act under EDGE_VETO_SAMPLES
     (30), and the 20-29 window printed PASS. Too thin to VETO on is not
     evidence of an edge. It now reports AGAINST via info:true — visible on
     the card, and still unable to stand the trade aside. */
  const thin = edge({ samples: 22, hit: 0.13, expR: -0.60 });
  ok(thin.pass === false && thin.info === true,
     'negative-but-thin is AGAINST, not a PASS — it must not read as evidence of an edge');
  ok(/counts AGAINST/.test(thin.why),
     'and says what it is doing, rather than calling -0.60R "marginal noise"');
  ok(win.hgOmniGrade([{ key: 'trend', hard: true, pass: true, why: 'x' }, thin]).ticket === true,
     'while still leaving the ticket standing, which is the whole point of info');
}

/* ---- 6. still-forming bar must never reach the gates ----
   engine.js/edge.js/startradertab.js all drop it: "gates only ever see
   CLOSED candles — a still-forming bar repaints". omniroute did not, and
   the partial bar's partial VOLUME made the participation gate veto live
   setups at 0.08x the 20-bar mean, while ORB claimed a close on a bar that
   had not closed. */
{
  const now = 1700000000 + 100 * 14400;
  const base = [];
  for (let i = 0; i < 10; i++) base.push({ t: 1700000000 + i * 14400, o: 1, h: 2, l: 0.5, c: 1, v: 10 });

  const forming = base.concat([{ t: now - 3600, o: 1, h: 2, l: 0.5, c: 1, v: 1 }]);
  ok(win.hgOmniDropForming(forming, '4h', now).length === base.length,
     'a bar opened 1h ago on 4h is still forming and is dropped');

  const closed = base.concat([{ t: now - 18000, o: 1, h: 2, l: 0.5, c: 1, v: 1 }]);
  ok(win.hgOmniDropForming(closed, '4h', now).length === closed.length,
     'a bar opened 5h ago on 4h has closed and is kept');

  ok(Array.isArray(win.hgOmniDropForming(null, '4h', now)), 'dropForming is null-safe');
  ok(win.hgOmniDropForming(base, 'nonsense', now).length === base.length,
     'unknown timeframe leaves the series untouched rather than guessing');
}

/* ---- 7. rr1/riskPct must be derived, since the plan wrapper strips them ----
   index.html's hgPlanLevels forwards only {dir,entry,stop,t1,t2,risk,note},
   dropping rr1/rr2/riskPct from hgPlanLevelsCore. Reading plan.rr1 gave
   undefined, so cards showed "R:R —" AND hgOmniRank sorted every row by NaN
   — the tab claimed to order by R:R while ordering by nothing. */
{
  const stripped = { dir:'short', entry:0.0023456, stop:0.0024111, t1:0.0021, t2:0.0020, risk:0.0000655, note:'x' };
  const d = win.hgOmniDerivePlan(stripped);
  ok(Math.abs(d.rr1 - 3.75) < 0.01, 'rr1 derived from entry/t1/risk (got ' + d.rr1.toFixed(3) + ')');
  ok(isFinite(d.rr2), 'rr2 derived');
  ok(Math.abs(d.riskPct - 2.792) < 0.01, 'riskPct derived (got ' + d.riskPct.toFixed(3) + '%)');
  ok(stripped.rr1 === undefined, 'the input plan object is not mutated');

  const ranked = win.hgOmniRank([
    { base:'A', grade:{ ticket:true,  vetoes:[] }, rr:1.9 },
    { base:'B', grade:{ ticket:true,  vetoes:[] }, rr:4.2 },
    { base:'D', grade:{ ticket:false, vetoes:[] }, rr:9.9 }
  ]);
  ok(ranked.map(r => r.base).join('') === 'BAD',
     'ranking puts tickets first, then R:R desc (got ' + ranked.map(r => r.base).join('') + ')');
}

/* ---- 8. R:R must agree with the levels the card prints ----
   Live cards showed R:R 14.72 / 11.35 / 9.57 whose true value was 2.00 in
   every case, because plan.risk is stale with respect to the entry the
   wrapper reports. Risk is now derived from |entry-stop|. */
{
  const stale = { dir:'long', entry:0.13417, stop:0.13131, t1:0.13989, t2:0.14417, risk:0.00038909 };
  const d = win.hgOmniDerivePlan(stale);
  ok(Math.abs(d.rr1 - 2.00) < 0.01, 'R:R derived from printed geometry, not stale plan.risk (got ' + d.rr1.toFixed(2) + ')');
  ok(Math.abs(d.riskPct - 2.13) < 0.02, 'riskPct matches |entry-stop| (got ' + d.riskPct.toFixed(2) + '%)');
  ok(Math.abs(d.risk - Math.abs(stale.entry - stale.stop)) < 1e-12, 'risk overwritten with the self-consistent value');
}

/* ---- 9. trend gates must grade each family against the right model ----
   SPRING is a failed breakdown, so it occurs in a downtrend BY CONSTRUCTION.
   Vetoing it for being counter-trend graded reversion setups against a
   continuation model and silenced the tab. */
{
  const dn = [];
  let px = 200;
  for (let i = 0; i < 90; i++){                    // sustained downtrend
    const o = px, c = px - 0.6;
    dn.push({ t: 1700000000 + i * 14400, o, h: Math.max(o,c) + 0.2, l: Math.min(o,c) - 0.2, c, v: 1000 });
    px = c;
  }
  const trendOf = kind => win.hgOmniGates(dn, { kind, dir:'long', level:1, why:'t' }, null, {})
                              .filter(g => g.key === 'trend')[0];

  const spring = trendOf('SPRING');
  ok(spring.pass !== false, 'SPRING long in a downtrend is NOT vetoed on trend');
  ok(spring.hard === false, 'trend is conditional for a reversion family');
  ok(/reversion setup/.test(spring.why), 'the card explains why counter-trend is expected');

  const po3 = trendOf('PO3');
  ok(po3.pass === false, 'PO3 long in a downtrend IS vetoed — continuation must agree with trend');
  ok(po3.hard === true, 'trend stays a hard gate for a continuation family');
}

/* ---- 10. measured-edge uses significance, not a flat R cutoff ----
   A fixed threshold ignores sample size. On live data SPRING at 26% over 473
   samples is 3.4 SE below the 33.3% breakeven for 2R (a real shortfall) yet
   sat inside a -0.25R cutoff; MMOVE at 33% over 2016 samples is genuinely
   breakeven and must survive. */
{
  const edge = st => win.hgOmniGates(rows, { kind:'PO3', dir:'long', level:99, why:'t' }, null, { stats: st })
                        .filter(g => g.key === 'measured-edge')[0];
  ok(edge({ samples:473,  hit:0.26, expR:-0.23 }).pass === false, 'SPRING-like -3.4sigma is vetoed despite -0.23R');
  ok(edge({ samples:624,  hit:0.29, expR:-0.12 }).pass === false, 'PO3-like -2.3sigma is vetoed');
  /* "Survives" means NOT VETOED, which is what this section is about. Since
     the family-wise bar landed there is a third state: a read sitting near
     breakeven is UNCHECKED rather than PASS. It still survives — the gate is
     soft and the ticket stands — it just no longer claims to be evidence. */
  ok(edge({ samples:458,  hit:0.30, expR:-0.10 }).pass !== false, 'ORB-like -1.5sigma survives as noise');
  ok(edge({ samples:2016, hit:0.33, expR:0 }).pass !== false,     'MMOVE-like breakeven over 2016 samples survives');
  ok(edge({ samples:2016, hit:0.33, expR:0 }).pass === null,      'and sitting exactly on breakeven reads UNCHECKED, not PASS');
  ok(edge({ samples:4,    hit:0.25, expR:-0.25 }).pass === null,  'ABSORB-like 4 samples stays UNCHECKED');
  ok(/sigma vs breakeven|σ vs breakeven/.test(edge({ samples:473, hit:0.26, expR:-0.23 }).why),
     'the card shows the sigma distance it judged on');
}

/* ---- 11. daily HTF is free and must be available to EVERY card ----
   It was computed only inside the network-enrichment step, so every contract
   past the enrich ceiling reported "daily bars unavailable" while the bars
   sat in memory. */
{
  let seed = 9;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let px = 100; const series = [];
  for (let i = 0; i < 200; i++){
    const o = px, c = px + (rnd() - 0.46) * 1.5;
    series.push({ t: 1700000000 + i * 14400, o, h: Math.max(o,c) + rnd()*0.5, l: Math.min(o,c) - rnd()*0.5, c, v: 1000 });
    px = c;
  }
  const htf = win.hgOmniDailyHtf(series);
  ok(htf && htf.bars >= 23, '200x4h resamples to enough daily bars to run the gate (got ' + (htf ? htf.bars : 0) + ')');
  ok(htf && isFinite(htf.e21) && isFinite(htf.e50), 'daily EMAs are finite at periods the history supports');
  ok(win.hgOmniDailyHtf(series.slice(0, 40)) === null, 'a too-short series refuses rather than returning noise');
  ok(win.hgOmniDailyHtf(null) === null, 'daily HTF is null-safe');

  const g = win.hgOmniGates(series, { kind:'MMOVE', dir:'long', level:1, why:'t' }, null, { htf })
                .filter(x => x.key === 'htf-daily')[0];
  ok(g.pass !== null, 'htf-daily actually evaluates when given resampled bars');
}

/* ---- 12. evidence coverage separates a thin ticket from a solid one ----
   The plan engine returns its 2R floor on essentially every setup, so R:R is
   pinned at 2.00 and cannot rank anything. How many gates RAN is the real
   difference between two tickets. */
{
  const hit = { kind:'VALUE', dir:'long', level:99, why:'t' };
  const bare = win.hgOmniGrade(win.hgOmniGates(rows, hit, null, {}));
  const full = win.hgOmniGrade(win.hgOmniGates(rows, hit, { fundingPct:0.01 }, {
    htf:{e21:9,e50:10}, oi:{changePct:5}, retail:{longPct:50}, taker:{buySellRatio:1.1},
    depth:{bidUsd:5e5,askUsd:5e5}, regime:{label:'RISK-ON'}, news:{risk:'low'},
    stats:{samples:500,hit:0.34,expR:0.02}
  }));
  ok(bare.evaluated < full.evaluated, 'a bare CoinDCX ticket reports fewer evaluated gates than a fully evidenced one');
  /* measured-edge reads UNCHECKED here on purpose: 34% over 500 samples is
     +0.32 sigma, and against six scanned mechanics the bar is +2.39. Every
     OTHER gate must still be evaluated. */
  const fullGates = win.hgOmniGates(rows, hit, { fundingPct:0.01 }, {
    htf:{e21:9,e50:10}, oi:{changePct:5}, retail:{longPct:50}, taker:{buySellRatio:1.1},
    depth:{bidUsd:5e5,askUsd:5e5}, regime:{label:'RISK-ON'}, news:{risk:'low'},
    stats:{samples:500,hit:0.34,expR:0.02}
  });
  const fullUnchecked = fullGates.filter(g => g.pass === null).map(g => g.key);
  /* This harness loads omniroute via new Function('window', src), so
     indicators.js and fixpack14-core.js are never loaded and the three
     indicator reads correctly report that they could not be computed. That
     they produce real values on a real series is proved against a shared
     context in tests/test-shared-mechanics.mjs. */
  const ALLOWED_UNCHECKED = ['measured-edge', 'consensus', 'adx-trend', 'atr-percentile', 'vol-forecast',
                            /* no plan key is supplied here, and plan-levels
                               separates that from an explicitly null plan,
                               which is a veto */
                            'plan-levels', 'level-fresh',
                            /* the universe reads need the whole sweep, which a
                               single-symbol harness has no way to supply */
                            'xs-rank', 'breadth',
                            /* no plan is supplied in this harness, so the
                               stop cannot be judged — which is the correct
                               UNCHECKED, not a missing gate */
                            'stop-width',
                            /* no plan and no crypto-position-risk.js in this
                               harness, so these correctly cannot be read */
                            'net-r', 'liq-room'];
  ok(fullUnchecked.every(k => ALLOWED_UNCHECKED.indexOf(k) >= 0),
     'only the family-wise edge read, consensus and the unloadable indicator reads are unchecked ('
     + (fullUnchecked.join(', ') || 'none') + ')');
  ok(full.evaluated === full.total - fullUnchecked.length, 'and every other gate reports');
  const ranked = win.hgOmniRank([
    { base:'BARE', grade:bare, rr:2.0 },
    { base:'FULL', grade:full, rr:2.0 }
  ]);
  ok(ranked[0].base === 'FULL', 'at equal R:R the better-evidenced ticket ranks first');
}

/* ---- 13. book depth must not pass off Binance's book as the trade venue's ----
   Depth comes from binanceDepth(base+USDT). For a CoinDCX or Delta contract
   that is NOT the book the order would hit, and unlike OI/retail/taker
   (market-wide state) this gate is about the fill. The inference is valid in
   one direction only: thin on the deepest venue implies thin everywhere, but
   deep on Binance says nothing about CoinDCX. */
{
  const hit = { kind:'MMOVE', dir:'short', level:99, why:'t' };
  const depthGate = (exchange, usd) =>
    win.hgOmniGates(rows, hit, null, { depth:{ bidUsd:usd, askUsd:usd }, exchange })
       .filter(g => g.key === 'book-depth')[0];

  const cdcx = depthGate('coindcx', 58466);
  ok(cdcx.key === 'book-depth', 'the gate key is stable regardless of venue (identifiers must not vary with data)');
  ok(cdcx.source === 'binance-reference', 'a non-Binance venue marks the reading as a reference');
  ok(/BINANCE reference/.test(cdcx.why), 'the source venue is named on the card');
  ok(/NOT measured/.test(cdcx.why), 'a pass states plainly that the trade venue book was not measured');

  const binance = depthGate('binance', 58466);
  ok(binance.source === 'venue', 'on Binance itself the reading IS the trade venue book');
  ok(!/reference/.test(binance.why), 'and carries no reference caveat');

  ok(depthGate('coindcx', 4000).pass === false,
     'thin on Binance still vetoes — that inference direction IS valid');
}

/* ---- 14. a dead regime gate must explain itself ----
   The scan warms regime.js's headless HG_warmups hook before sweeping, so
   "regime module has not run" stopped being a sufficient explanation: if the
   warm ran and still produced nothing, THAT outcome is the useful
   information. Same principle as surfacing the scan-failure reason. */
{
  const hit = { kind:'MMOVE', dir:'long', level:99, why:'t' };
  const rg = extra => win.hgOmniGates(rows, hit, null, extra).filter(g => g.key === 'regime')[0];

  ok(/every gauge source failed/.test(rg({ regimeWarm:'unavailable: every gauge source failed' }).why),
     'a failed warm reports the gauge failure verbatim');
  ok(/threw: gauge fetch died/.test(rg({ regimeWarm:'threw: gauge fetch died' }).why),
     'a thrown warm reports the exception');
  ok(/no warmup registered/.test(rg({ regimeWarm:'no warmup registered' }).why),
     'a missing warmup hook says so rather than blaming the module');
  ok(rg({}).why === 'regime module has not run',
     'with no warm attempted at all the original wording stands');

  ok(rg({ regimeWarm:'unavailable: x' }).pass === null,
     'an unavailable regime stays UNCHECKED — it never becomes a silent pass');
  const live = rg({ regime:{ label:'RISK-ON' } });
  ok(live.pass === true && /RISK-ON/.test(live.why), 'a live regime read evaluates normally');
}

/* ---- 15. BTC daily regime proxy ----
   regime.js's headless warm returned "unavailable: every gauge source
   failed" on every live scan, leaving the gate permanently UNCHECKED. Its 8
   gauges span CoinGecko / DeFiLlama / alternative.me / macro; rather than
   depend on all of them resolving, fall back to BTC's own daily trend off
   Binance klines — an endpoint the same scan already proves reachable. It is
   deliberately NARROWER than the 8-gauge verdict, so it must say so. */
{
  const daily = (dir, n) => {
    let px = 100; const r = [];
    for (let i = 0; i < n; i++){
      const o = px, c = px + (dir === 'up' ? 0.8 : -0.8);
      r.push({ t: 1700000000 + i * 86400, o, h: Math.max(o,c)+0.3, l: Math.min(o,c)-0.3, c, v: 1000 });
      px = c;
    }
    return r;
  };
  const up = win.hgOmniBtcRegime(daily('up', 60));
  const dn = win.hgOmniBtcRegime(daily('dn', 60));
  ok(up && up.label === 'RISK-ON',  'a BTC daily uptrend reads RISK-ON');
  ok(dn && dn.label === 'RISK-OFF', 'a BTC daily downtrend reads RISK-OFF');
  ok(up.source === 'btc-daily-proxy', 'the proxy identifies its own source');
  ok(win.hgOmniBtcRegime(daily('up', 10)) === null, 'too little daily history returns null rather than a guess');
  ok(win.hgOmniBtcRegime(null) === null, 'proxy is null-safe');

  const g = win.hgOmniGates(rows, { kind:'MMOVE', dir:'long', level:1, why:'t' }, null, { regime: up })
               .filter(x => x.key === 'regime')[0];
  ok(g.pass === true, 'the proxy read drives the gate');
  ok(/BTC daily proxy/.test(g.why), 'the card discloses that this is the proxy, not the 8-gauge verdict');
  ok(/gauges unavailable/.test(g.why), 'and says why the fuller source was not used');

  const real = win.hgOmniGates(rows, { kind:'MMOVE', dir:'long', level:1, why:'t' }, null,
                               { regime:{ label:'RISK-ON' } }).filter(x => x.key === 'regime')[0];
  ok(!/proxy/.test(real.why), 'a genuine regime.js read carries no proxy caveat');
}

/* ---- 16. an unloaded news module must not read as "low risk" ----
   hgNewsRisk() returns {risk:'low', note:'news not loaded'} when it has never
   fetched. That is a DEFAULT, not a measurement, and reading it as PASS let a
   card claim "news risk low" while nothing had been checked — the exact
   silent pass this ledger exists to prevent. */
{
  const hit = { kind:'MMOVE', dir:'long', level:1, why:'t' };
  const nw = news => win.hgOmniGates(rows, hit, null, news ? { news } : {})
                        .filter(g => g.key === 'news-window')[0];

  ok(nw({ risk:'low', blackout:false, note:'news not loaded' }).pass === null,
     'an unloaded news module reads UNCHECKED, not a low-risk PASS');
  ok(nw({ risk:'low', blackout:false, note:'news error: boom' }).pass === null,
     'an errored news module also reads UNCHECKED');
  ok(/news not loaded/.test(nw({ risk:'low', blackout:false, note:'news not loaded' }).why),
     'and the card repeats the module note rather than inventing a reason');

  ok(nw({ risk:'low', blackout:false, note:'' }).pass === true,
     'a genuine low-risk read still passes');
  ok(nw({ risk:'high', blackout:true, note:'' }).pass === false,
     'a blackout window still vetoes');
  ok(nw(null).pass === null, 'no news object at all stays UNCHECKED');
}

/* ---- 17. walk-forward must count NON-OVERLAPPING trades ----
   Advancing one bar at a time counted a mechanic that fires on 20
   consecutive bars of ONE move as 20 samples sharing a single outcome. On
   synthetic data 94% of firings overlapped the previous forward window, and
   the sigma the measured-edge gate judges on was inflated 3-4x (1.38 counted
   vs 0.39 independent) — the difference between "has paid" and "within
   noise" on live cards. */
{
  let seed = 5;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let px = 4384; const series = [];
  for (let i = 0; i < 1000; i++){
    const o = px, c = px + (rnd() - 0.48) * 6;
    series.push({ t:i*3600, o, h:Math.max(o,c)+rnd()*3, l:Math.min(o,c)-rnd()*3, c, v:900+rnd()*400 });
    px = c;
  }
  const det = r => { const p = win.hgOmniProfile(r, 24); return p ? win.hgOmniValueReject(r, p) : null; };

  /* count raw firings the OLD way for comparison */
  let raw = 0;
  for (let i = 60; i < series.length - 24; i++) if (det(series.slice(0, i + 1))) raw++;

  const bt = win.hgOmniBacktestOne(series, det, { rMult:1.5, horizon:24, warm:60 });
  ok(bt.samples < raw, 'non-overlapping sampling reports fewer trades than raw firings (' + bt.samples + ' vs ' + raw + ')');
  ok(bt.samples > 0, 'and still finds trades to measure');
  ok(bt.samples <= Math.ceil((series.length - 60) / 1),
     'sample count cannot exceed the bars available');

  /* every counted trade must be sequentially takeable: at most bars/horizon of them */
  ok(bt.samples <= Math.ceil((series.length - 60) / 2),
     'counted trades are spaced, not stacked on one another');

  /* walkForward keeps its original string contract for existing callers */
  ok(typeof win.hgOmniWalkForward(series, 100, 'long', 1.5, 24) === 'string',
     'hgOmniWalkForward without the detail flag still returns a plain string');
  const d = win.hgOmniWalkForward(series, 100, 'long', 1.5, 24, true);
  ok(d && typeof d === 'object' && typeof d.res === 'string' && isFinite(d.at),
     'with the detail flag it reports where the trade resolved');
}

/* ---- 18. the pooled verdict must be symmetric ----
   The table read "has paid" on any positive expectancy while only calling
   failure at -2 sigma. On live gold that presented +0.27 sigma — noise — as
   proven, across four mechanics at once. A verdict must be as hard to earn
   as it is to lose. */
{
  const r = (n, hit, rr) => win.hgOmniPoolRead({ samples:n, hit, expR:0 }, rr || 1.5, 20);

  ok(r(45, 0.42).read === 'within noise', '+0.27 sigma is noise, not "has paid" (45 samples, 42% vs 40% breakeven)');
  ok(r(44, 0.48).read === 'within noise', '+1.08 sigma is still noise');
  ok(r(400, 0.52).read === 'has paid',    '+4.90 sigma earns "has paid" — the label is still reachable');
  ok(r(400, 0.28).read === 'has not paid','-4.90 sigma earns "has not paid"');
  ok(r(11, 0.45).read === 'too few to judge', 'below the sample floor nothing is judged');
  ok(r(0, 0).read === 'never fired', 'a mechanic that never fired says so');
  ok(win.hgOmniPoolRead(null, 1.5, 20).read === 'never fired', 'the helper is null-safe');

  /* THE TWO SIDES ARE NOT SYMMETRIC, AND MUST NOT BE.

     This used to assert "exactly +2 sigma passes" against a hard-coded +2.00,
     and that PASS was the defect: the measured-edge gate credits a mechanic
     only at the FAMILY-WISE bar (+2.89 sigma across 27 crypto mechanics), so
     a row between +2.00 and +2.89 was printed green as "has paid" in the
     summary while the ledger refused to credit it on the card.

     The negative side keeps its -2 sigma bar, and that asymmetry is correct
     rather than an oversight. Reporting whichever of 27 mechanics looks BEST
     is a search, so a positive claim must clear the multiple-comparisons
     correction. Noticing that one specific mechanic is losing is not a
     search, so it does not. */
  const se = Math.sqrt(0.4 * 0.6 / 100);
  const BAR = win.hgOmniFamilyZ(27);
  ok(BAR > 2.8 && BAR < 3.0, 'the family-wise bar is +' + BAR.toFixed(2) + ' sigma, not +2.00');
  ok(r(100, 0.40 + 2*se).read === 'within noise',
     'exactly +2 sigma is NOT "has paid" — it does not clear the 27-mechanic bar');
  ok(r(100, 0.40 + (BAR + 0.05)*se).read === 'has paid',
     'clearing the family-wise bar does earn it');
  ok(r(100, 0.40 - 2*se).read === 'has not paid',
     'exactly -2 sigma still fails — a loss is not a search, so it needs no correction');

  /* "needs ~N" answers what a noise row would take to settle */
  const orb = r(27, 0.48);
  ok(orb.need && orb.need > 27, 'a positive-but-unproven row reports the sample count it would need (' + orb.need + ')');
  const tiny = r(45, 0.42);
  ok(tiny.need > orb.need, 'a smaller observed edge needs far more samples — which is itself the answer');
  ok(r(400, 0.52).need === null, 'an already-proven row needs nothing further');
  ok(r(43, 0.30).need === null, 'a negative row is not given a target to chase');

  /* the R multiple moves the breakeven (1/(1+R)), so the SAME hit rate sits
     on opposite sides of it — 36% is below the 40% needed at 1.5R but above
     the 33.3% needed at 2R. Both land in the noise band here, so the honest
     assertion is about sigma, not the label. */
  const at15 = r(200, 0.36, 1.5), at20 = r(200, 0.36, 2);
  ok(at15.z < 0 && at20.z > 0,
     '36% is below breakeven at 1.5R but above it at 2R (sigma ' + at15.z.toFixed(2) + ' vs ' + at20.z.toFixed(2) + ')');
  ok(at20.z > at15.z, 'a lower breakeven makes the same hit rate score better');
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail){ console.log('TESTS FAILED'); process.exit(1); }
console.log('ALL OMNIROUTE NULL-GUARD TESTS PASSED');
