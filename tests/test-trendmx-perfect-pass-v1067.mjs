/* HARDGATE — hg-v1067: THE SHARED PERFECT EVIDENCE PASS ON TREND MATRIX.

   The matrix's strongest rows now run through the SAME reads bag and the
   SAME enrichment + predicate OMNIBTC consumes (W.hgObtcPerfectFormation),
   fed by the same external data: real Binance taker flow, Binance funding,
   the ATR percentile regime, EMA50/200 structure, session RVOL and the
   news calendar. A PERFECT / PERFECT+ stamp on a matrix row now means
   byte-identically what it means on OMNIBTC. Evidence, never a gate.

   Run: node tests/test-trendmx-perfect-pass-v1067.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = []; ctx.HG_TAB_MODS = {};
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                     addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-gates.js', 'hg-perfect-setup.js',
                   'hg-setup-core.js', 'crypto-position-risk.js', 'cryptogates.js',
                   'plans.js', 'setup-ui.js', 'trendtable.combined.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});
  return ctx;
}

const T4 = 14400;
function mkRows(n, slope, vol){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 100 + i * slope;
    rows.push({ t: 1760000000 - (n - 1 - i) * T4, o: c - 0.02, h: c + 0.4, l: c - 0.4, c, v: vol });
  }
  return rows;
}
function row(sym, score){
  return { sym, score, exchange: 'delta',
    comps: { d200: score > 0 ? 1 : -1, x: score > 0 ? 1 : -1, h4: score > 0 ? 1 : -1, cloud: score > 0 ? 1 : -1, adx: 0 },
    adx: 28, price: 100 + score, fundingPct: -0.002,
    gate: { label: 'trend', clean7: true, veto: false, gatesPassed: 7 },
    rows4h: mkRows(220, 0.05, 100) };
}
const TSERIES = (function(){ const s = []; for (let k = 119; k >= 0; k--) s.push({ buySellRatio: k < 60 ? 1.0 : 1.25, t: 1760000000 - k * T4 }); return s; })();

console.log('== the pass runs the SAME stack and stamps the SAME badges ==');
{
  const cap = {};
  const W = boot({
    binanceTakerRatio: async () => { cap.takerAsked = true; return { series: TSERIES }; },
    binanceFunding: async () => { cap.fundAsked = true; return { fundingPct: 0.004 }; },
    hgNewsRisk: () => ({ blackout: false }),
    hgObtcPerfectFormation: (pick, reads) => {   /* the OMNIBTC seam is stubbed here - its own tests cover the real one */
      cap.reads = reads;
      pick.row.perfect = true; pick.row.perfectPlus = true; pick.row.perfectReads = reads;
    }
  });
  const rows = [row('BTCUSD', 3), row('ETHUSD', 2), row('SOLUSD', 1), row('XRPUSD', -1),
    row('ADAUSD', -2), row('DOTUSD', -3), row('LTCUSD', 2), row('BCHUSD', 2), row('AVAXUSD', 2)];
  await W.trendmxPerfectEvidencePass(rows);
  ok(cap.takerAsked === true && cap.fundAsked === true, 'the same external data is fetched (real taker flow + Binance funding)');
  ok(rows[0].perfect === true && rows[0].perfectPlus === true, 'the strongest row carries the shared PERFECT+ badge');
  ok(cap.reads && cap.reads.takerFlowVerdict, 'the taker-flow leg reads from the real series (' + cap.reads.takerFlowVerdict + ')');
  ok(cap.reads && cap.reads.atrRegime, 'the ATR-percentile regime leg reads (' + cap.reads.atrRegime + ')');
  ok(cap.reads && cap.reads.structureTrend, 'the EMA50/200 structure leg reads (' + cap.reads.structureTrend + ')');
  ok(cap.reads && cap.reads.sess && isFinite(cap.reads.volumeRvol), 'the session + volume witness legs read');
  /* XRPUSD (|score| 1) sorts below the eight stronger rows and is excluded */
  ok(rows[3] && rows[3].sym === 'XRPUSD' && rows[3].perfect !== true, 'the pass caps at the 8 strongest rows - the rest stay unjudged');
}

console.log('== hg-v1150: the four free-feed evidence legs ride the same reads bag ==');
{
  const asked = { oi: 0, fh: 0, spot: 0 };
  const readsBySym = {};
  const W = boot({
    binanceTakerRatio: async () => ({ series: TSERIES }),
    binanceFunding: async () => ({ fundingPct: 0.004 }),
    hgNewsRisk: () => ({ blackout: false }),
    coinalyzeOIChg: async () => { asked.oi++; return { chgPct: -12 }; },
    binanceFundingHist: async () => { asked.fh++; return [{ rate: 0.0001, t: 1 }, { rate: 0.0002, t: 2 }, { rate: 0.00015, t: 3 }]; },
    binanceSpotTakerFlow: async () => { asked.spot++; return { series: TSERIES }; },
    hgObtcCvdSlopeDir: () => true,
    onchainState: () => ({ netflowZ: { z: 2.5 } }),
    hgObtcNetflowZOf: (oc) => (oc && oc.netflowZ ? +oc.netflowZ.z : null),
    hgNetflowGate: (sym, dir, nz) => ((nz && +nz.z > 2) ? { state: 'veto', note: 'inflow spike' } : { state: 'pass', note: 'netflow normal' }),
    hgObtcPerfectFormation: (pick, reads) => {
      readsBySym[pick.row.sym] = reads;
      pick.row.perfect = true; pick.row.perfectPlus = false;
      pick.row.perfectReads = reads;
    }
  });
  const rBtc = row('BTCUSD', 3);
  rBtc.base = 'BTC';
  rBtc.rows4h = mkRows(220, 2, 100);       /* slope 2: a clean directional tape - chop low AND ER high */
  const rAlt = row('PEPEUSD', 3);
  rAlt.base = 'PEPE';
  rAlt.rows4h = mkRows(220, 2, 100);
  await W.trendmxPerfectEvidencePass([rBtc, rAlt]);
  ok(asked.oi === 2 && asked.fh === 2 && asked.spot === 2, 'the free feeds are asked once per row (coinalyze OI + funding history + spot flow)');
  const rb = readsBySym.BTCUSD, ra = readsBySym.PEPEUSD;
  ok(rb && rb.trendQuality === 'TREND', 'the trend-quality leg reads off the row tape (clean directional tape -> TREND)');
  ok(rb && rb.leverageState === 'RESET' && rb.oiChgPct === -12, 'the leverage-cycle leg reads RESET (OI -12%/24h, the house threshold)');
  ok(rb && isFinite(rb.fundLatestPct) && rb.fundLatestPct > 0, 'the last funding print rides the bag in percent units');
  ok(rb && rb.cvdContext === 'BOTH-WITH', 'the spot-vs-perp CVD context reads (both books with a long)');
  ok(rb && rb.netflowZ === 2.5 && rb.onchainVeto === true, 'the BTC on-chain netflow veto reads for a BTC row (z 2.5 -> veto)');
  ok(ra && ra.cvdContext === 'BOTH-WITH' && ra.leverageState === 'RESET', 'an alt row reads the same free per-symbol legs');
  ok(ra && ra.netflowZ === undefined && ra.onchainVeto === undefined, 'the on-chain leg stays HONESTLY UNREAD on an alt row (the feed is BTC flow)');
  /* the chop tape maps to the CHOP read - the two instruments agreeing the
     other way (sideways rows: chop high AND efficiency near zero) */
  const rChop = row('DOGEUSD', 3);
  rChop.base = 'DOGE';
  rChop.rows4h = mkRows(220, 0, 100);
  const readsChop = {};
  W.hgObtcPerfectFormation = (pick, reads) => { readsChop.r = reads; pick.row.perfect = true; };
  await W.trendmxPerfectEvidencePass([rChop]);
  ok(readsChop.r && readsChop.r.trendQuality === 'CHOP', 'a sideways tape maps to CHOP (the predicate can veto PERFECT on it)');
  /* feeds absent -> every new leg stays honestly unread, no crash */
  const W2 = boot({
    binanceTakerRatio: async () => ({ series: TSERIES }),
    hgObtcPerfectFormation: (pick, reads) => { readsChop.bare = reads; pick.row.perfect = true; }
  });
  const rBare = row('BTCUSD', 3);
  rBare.base = 'BTC';
  await W2.trendmxPerfectEvidencePass([rBare]);
  ok(readsChop.bare && readsChop.bare.trendQuality === undefined && readsChop.bare.leverageState === undefined
     && readsChop.bare.cvdContext === undefined && readsChop.bare.onchainVeto === undefined,
     'feeds absent -> the new legs stay unread (the honest third state), the pass never crashes');
}

console.log('== the shared seam absent degrades to no stamps, never a crash ==');
{
  const W = boot({});
  const rows = [row('BTCUSD', 3)];
  await W.trendmxPerfectEvidencePass(rows);
  ok(rows[0].perfect !== true, 'no OMNIBTC seam, no stamp - and the scan still completes');
}

console.log('== wiring pins ==');
{
  const src = read('trendtable.combined.js');
  ok(src.indexOf('async function trendmxPerfectEvidencePass') >= 0, 'the pass is defined');
  ok(src.indexOf('hgObtcPerfectFormation') >= 0, 'the pass consumes the OMNIBTC enrichment + predicate');
  ok(src.indexOf("binanceTakerRatio('BTCUSDT', '4h', 120)") >= 0, 'the pass fetches the real taker series');
  ok(src.indexOf('await trendmxPerfectEvidencePass(core.rows)') >= 0, 'the pass runs inside the scan');
  ok(src.indexOf('PERFECT+') >= 0, 'the crown verdict shows the shared PERFECT+ badge');
}

console.log('\ntest-trendmx-perfect-pass-v1067: ' + passed + ' passed, 0 failed');
