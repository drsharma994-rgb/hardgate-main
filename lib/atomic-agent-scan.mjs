/* HARDGATE — Atomic Agents pipeline: scan Delta + CoinDCX for best setups. */
import { fetchDualUniverse, fetchVenueCandles, topByTurnover } from './atomic-agent-universe.mjs';
import { trySwingClean, tryScalpClean, trySwingNear } from './atomic-agent-gates.mjs';
import { composeAtomicDesk, rankCrossVenue } from './atomic-agent-core.mjs';

const CACHE_MS = 3 * 60 * 1000;
let __cache = null;

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

function setupFromHit(item, hit, style){
  if (!hit || !item) return null;
  return {
    sym: item.sym,
    base: item.base,
    exchange: item.exchange,
    dir: hit.dir,
    style: style,
    entry: hit.entry,
    stop: hit.stop,
    t1: hit.t1,
    t2: hit.t2,
    rr: hit.rr || hit.rr1,
    clean7: hit.clean === true || hit.passed >= 7,
    nearClean: hit.nearClean === true,
    clean: hit.clean,
    gatesPassed: hit.passed,
    gatesTotal: 7,
    mark: item.mark,
    turnoverUsd: item.turnoverUsd,
    fundingPct: item.fundingPct,
    note: style + ' ' + (hit.clean ? '7/7' : (hit.nearClean ? '6/7 near' : hit.passed + '/7')) + ' · ' + item.exchange,
  };
}

async function scanVenueItems(items, venue, opts){
  opts = opts || {};
  var topN = opts.topN || 18;
  var concurrency = opts.concurrency || 3;
  var list = topByTurnover(items, venue, topN);
  if (!list.length && venue === 'coindcx'){
    list = (items || []).filter(function(it){ return it.exchange === 'coindcx'; }).slice(0, topN);
  }
  var setups = [];
  var scanned = 0;
  var idx = 0;

  async function worker(){
    while (idx < list.length){
      var i = idx++;
      var item = list[i];
      scanned++;
      var rows4h = await fetchVenueCandles(item, '4h', 260);
      if (!rows4h || rows4h.length < 40) continue;
      var rows1h = await fetchVenueCandles(item, '1h', 120);
      var rows15m = await fetchVenueCandles(item, '15m', 120);
      var ticker = {
        symbol: item.sym,
        fundingPct: item.fundingPct,
        mark: item.mark != null ? item.mark : rows4h[rows4h.length - 1].c,
      };
      var swing = trySwingClean(rows4h, ticker);
      if (swing){
        var ss = setupFromHit(item, swing, 'swing');
        if (ss) setups.push(ss);
      } else {
        var near = trySwingNear(rows4h, ticker);
        if (near){
          var ns = setupFromHit(item, near, 'swing');
          if (ns){ ns.nearClean = true; ns.clean7 = false; setups.push(ns); }
        }
      }
      if (rows1h && rows1h.length >= 30 && rows15m && rows15m.length >= 30){
        var scalp = tryScalpClean(rows1h, rows15m, ticker);
        if (scalp){
          var sc = setupFromHit(item, scalp, 'scalp');
          if (sc) setups.push(sc);
        }
      }
      await sleep(80);
    }
  }

  var workers = [];
  for (var w = 0; w < concurrency; w++) workers.push(worker());
  await Promise.all(workers);

  setups.sort(function(a, b){
    var sa = (a.clean7 ? 100 : 0) + (a.rr || 0) * 10;
    var sb = (b.clean7 ? 100 : 0) + (b.rr || 0) * 10;
    return sb - sa;
  });

  return { venue: venue, setups: setups.slice(0, 12), scanned: scanned };
}

export async function runAtomicPipeline(opts){
  opts = opts || {};
  var t0 = Date.now();
  var topN = +(opts.topN || process.env.ATOMIC_SCAN_TOP || 18);
  var uni = await fetchDualUniverse();
  var allItems = (uni.delta || []).concat(uni.coindcx || []);

  var t1 = Date.now();
  var deltaLeg = await scanVenueItems(allItems, 'delta', { topN: topN });
  deltaLeg.ms = Date.now() - t1;

  var t2 = Date.now();
  var cdcxLeg = await scanVenueItems(allItems, 'coindcx', { topN: topN });
  cdcxLeg.ms = Date.now() - t2;

  var ranked = rankCrossVenue(deltaLeg.setups, cdcxLeg.setups);
  var desk = composeAtomicDesk({
    at: new Date().toISOString(),
    delta: deltaLeg,
    coindcx: cdcxLeg,
    ranked: ranked,
  });
  desk.universe = {
    delta: (uni.delta || []).length,
    coindcx: (uni.coindcx || []).length,
    cdcxMarks: uni.cdcxMarks,
    note: uni.note,
  };
  desk.ms = Date.now() - t0;
  return { ok: true, desk: desk, pipeline: { delta: deltaLeg, coindcx: cdcxLeg, ranked: ranked } };
}

export async function getAtomicDesk(force){
  var now = Date.now();
  if (!force && __cache && (now - __cache.at) < CACHE_MS){
    return { ok: true, desk: __cache.desk, cached: true, ms: 0 };
  }
  var result = await runAtomicPipeline({});
  if (result && result.ok && result.desk){
    __cache = { at: now, desk: result.desk };
  }
  return Object.assign({ cached: false }, result);
}
