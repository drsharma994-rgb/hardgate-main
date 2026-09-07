/* HARDGATE — Increment 4 data-feed pure module tests */
import {
  goldCotAssess, goldCotGate, goldCotParse,
} from '../lib/gold-cot.mjs';
import { fedLiquidityAssess, fedLiquidityCompose } from '../lib/fed-liquidity.mjs';
import {
  coinalyzeMergeOI, coinalyzeOIChgPct, coinalyzeSymbolsForBase,
} from '../lib/coinalyze-core.mjs';
import { carryNetApr, borrowAnnualizePct } from '../lib/borrow-carry.mjs';
import { liquidityToStop, bookImbalance } from '../lib/liquidity-gate.mjs';
import {
  deribitDvolSlope, deribitRiskReversal, deribitGammaFlip,
} from '../lib/deribit-options.mjs';
import {
  coinglassParseHeatmap, coinglassStopWarning, coinglassConfluenceTag,
} from '../lib/coinglass-core.mjs';

let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== gold COT gate ==');
{
  const rows = [];
  for (let i = 0; i < 80; i++){
    rows.push({
      market_and_exchange_names: 'GOLD - COMMODITY EXCHANGE INC.',
      noncomm_positions_long_all: 200000 + i * 500,
      noncomm_positions_short_all: 100000,
      open_interest_all: 400000,
      report_date_as_yyyy_mm_dd: '2024-01-' + String((i % 28) + 1).padStart(2, '0'),
    });
  }
  const series = goldCotParse(rows);
  const assess = goldCotAssess(series);
  ok(assess.zScore !== null, 'COT z-score computed');
  const gateLong = goldCotGate({ zScore: 2.5, reportDate: Date.now() }, 'long');
  ok(gateLong.veto === true, 'z>+2 vetoes gold long');
  const gateBonus = goldCotGate({ zScore: -2.5, reportDate: Date.now() }, 'long');
  ok(gateBonus.bonus === true, 'z<-2 bonuses gold long');
}

console.log('== fed liquidity ==');
{
  const walcl = [{ date: '2024-01-01', value: 8000000 }, { date: '2024-01-08', value: 8015000 }];
  const tga = [{ date: '2024-01-01', value: 700000 }, { date: '2024-01-08', value: 710000 }];
  const rrp = [{ date: '2024-01-01', value: 500 }, { date: '2024-01-08', value: 480 }];
  const pts = fedLiquidityCompose(walcl, tga, rrp);
  ok(pts && pts.length === 2, 'fed liquidity compose');
  const a = fedLiquidityAssess(pts);
  ok(a && typeof a.score === 'number', 'fed liquidity assess score');
}

console.log('== coinalyze merge ==');
{
  const syms = coinalyzeSymbolsForBase('BTCUSDT');
  ok(syms.length >= 5, 'coinalyze symbol list');
  const m = coinalyzeMergeOI([
    { symbol: 'BTCUSDT_PERP.A', value: 1000 },
    { symbol: 'BTCUSDT_PERP.6', value: 800 },
  ]);
  ok(m && m.aggOIUsd === 1800 && m.binanceOIUsd === 1000, 'coinalyze merge OI');
  const chg = coinalyzeOIChgPct({
    a: [{ t: 1, v: 100 }, { t: 2, v: 110 }],
    b: [{ t: 1, v: 50 }, { t: 2, v: 55 }],
  });
  ok(chg && chg.chgPct > 0, 'aggregated OI chg pct');
}

console.log('== borrow carry net ==');
{
  ok(borrowAnnualizePct(0.0001) > 3, 'borrow annualize');
  const net = carryNetApr(30, 12);
  ok(net.netApr === 18 && net.grossApr === 30, 'net carry APR');
}

console.log('== liquidity gate ==');
{
  const book = {
    bids: [[100, 10], [99, 5]],
    asks: [[101, 8], [102, 4]],
    bidUsd: 1000, askUsd: 900,
  };
  const liq = liquidityToStop(book, 'long', 100, 98, 5000);
  ok(liq && liq.slippageProne === true, 'thin book flagged');
  const imb = bookImbalance(book);
  ok(imb && imb.ratio > 0, 'book imbalance');
}

console.log('== deribit options pure ==');
{
  const slope = deribitDvolSlope(70, 65);
  ok(slope.score === -1 && slope.slope === 'RISING', 'DVOL rising bearish');
  const rr = deribitRiskReversal(75, 60);
  ok(rr && rr.rr25d === 15, '25d risk reversal');
  const gf = deribitGammaFlip({ 99000: -1, 100000: 1 }, 100500);
  ok(gf && gf.level > 0, 'gamma flip level');
}

console.log('== coinglass clusters ==');
{
  const clusters = coinglassParseHeatmap({
    y_axis: [100, 101],
    liquidation_leverage_data: [[0, 0, 2000000], [0, 1, 500000]],
  });
  ok(clusters.length >= 1, 'heatmap parse');
  const warn = coinglassStopWarning(clusters, 100, 500000);
  ok(warn && warn.warn, 'stop inside cluster warns');
  const tag = coinglassConfluenceTag(clusters, 100, 1000000);
  ok(tag && tag.indexOf('LIQ CLUSTER') >= 0, 'confluence tag');
}

console.log('\nIncrement 4 data-feed tests passed:', pass);
