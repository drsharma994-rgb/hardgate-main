/* HARDGATE — correlation clusters + beta-weighted heat (pure). */

export const PB_CLUSTERS = {
  'btc-beta':  /^(BTC|WBTC|BTCUSD|BTCUSDT)/,
  'eth-beta':  /^(ETH|WETH|STETH)/,
  'l1-alt':    /^(SOL|ADA|AVAX|NEAR|DOT|ATOM|SUI|APT|TON|SEI|INJ|TRX|BNB)/,
  'l2-defi':   /^(ARB|OP|MATIC|POL|UNI|AAVE|LDO|LINK|MKR|CRV|PENDLE)/,
  'meme':      /^(DOGE|SHIB|PEPE|WIF|BONK|FLOKI|TRUMP)/,
  'gold':      /(XAU|XAUT|PAXG|GOLD|XAG|SILVER)/,
};

export const PB_CLUSTER_BETA = {
  'btc-beta': 1.0, 'eth-beta': 1.2, 'l1-alt': 1.5,
  'l2-defi': 1.6, 'meme': 2.0, 'gold': 0.3, 'other': 1.3,
};

export function pbCluster(sym, klass){
  var s = String(sym || '').toUpperCase();
  if (klass && /gold|metal/i.test(String(klass))) return 'gold';
  for (var k in PB_CLUSTERS){
    if (Object.prototype.hasOwnProperty.call(PB_CLUSTERS, k) && PB_CLUSTERS[k].test(s)) return k;
  }
  return 'other';
}

export function pbClusterHeat(positions, navUsd){
  var out = { byCluster: {}, netBeta: 0, grossBeta: 0 };
  var nav = +navUsd;
  if (!(nav > 0)) return out;
  var arr = Array.isArray(positions) ? positions : [];
  for (var i = 0; i < arr.length; i++){
    var p = arr[i];
    if (!p || !(+p.riskUsd > 0)) continue;
    var cl = p.cluster || pbCluster(p.sym, p.klass);
    var sign = (String(p.dir || '').toLowerCase() === 'short') ? -1 : 1;
    var beta = PB_CLUSTER_BETA[cl] !== undefined ? PB_CLUSTER_BETA[cl] : PB_CLUSTER_BETA.other;
    var frac = (+p.riskUsd) / nav;
    if (!out.byCluster[cl]) out.byCluster[cl] = { net: 0, gross: 0 };
    out.byCluster[cl].net += sign * frac;
    out.byCluster[cl].gross += frac;
    out.netBeta += sign * frac * beta;
    out.grossBeta += frac * beta;
  }
  return out;
}

export const PB_CLUSTER_CAPS = {
  maxClusterHeatPct: 0.025,
  maxNetBetaHeatPct: 0.04,
};

function dailyLogReturns(closes){
  var out = [];
  if (!Array.isArray(closes) || closes.length < 2) return out;
  for (var i = 1; i < closes.length; i++){
    var a = +closes[i - 1], b = +closes[i];
    if (!(a > 0) || !(b > 0)) continue;
    out.push(Math.log(b / a));
  }
  return out;
}

export function pbRealizedBeta(sym, btcCloses, symCloses, lookbackDays){
  lookbackDays = lookbackDays > 0 ? lookbackDays : 30;
  try{
    var btc = Array.isArray(btcCloses) ? btcCloses.slice(-lookbackDays - 1) : [];
    var sym = Array.isArray(symCloses) ? symCloses.slice(-lookbackDays - 1) : [];
    var n = Math.min(btc.length, sym.length);
    if (n < 21) return null;
    btc = btc.slice(-n); sym = sym.slice(-n);
    var rb = dailyLogReturns(btc);
    var rs = dailyLogReturns(sym);
    var m = Math.min(rb.length, rs.length);
    if (m < 20) return null;
    rb = rb.slice(-m); rs = rs.slice(-m);
    var meanB = 0, meanS = 0, i;
    for (i = 0; i < m; i++){ meanB += rb[i]; meanS += rs[i]; }
    meanB /= m; meanS /= m;
    var cov = 0, varB = 0, varS = 0;
    for (i = 0; i < m; i++){
      var db = rb[i] - meanB, ds = rs[i] - meanS;
      cov += db * ds; varB += db * db; varS += ds * ds;
    }
    if (!(varB > 0) || !(varS > 0)){
      return { beta: null, corr: null, n: m, note: 'zero variance' };
    }
    var beta = cov / varB;
    var corr = cov / Math.sqrt(varB * varS);
    return {
      beta: Math.round(beta * 1000) / 1000,
      corr: Math.round(corr * 1000) / 1000,
      n: m,
      note: 'measured ' + m + 'd log-return overlap',
    };
  }catch(e){
    return null;
  }
}

export function pbEffectiveBeta(sym, klass, realized){
  var cl = pbCluster(sym, klass);
  var prior = PB_CLUSTER_BETA[cl] !== undefined ? PB_CLUSTER_BETA[cl] : PB_CLUSTER_BETA.other;
  if (realized && typeof realized.n === 'number' && realized.n >= 20
      && typeof realized.beta === 'number' && isFinite(realized.beta)){
    return { beta: realized.beta, corr: realized.corr, source: 'measured', cluster: cl, n: realized.n };
  }
  return { beta: prior, corr: null, source: 'assumed', cluster: cl, n: realized && realized.n ? realized.n : 0 };
}

export function pbCrowdingSummary(candidates, opts){
  opts = opts || {};
  var topN = opts.topN > 0 ? opts.topN : 4;
  var corrThr = opts.corrThr > 0 ? opts.corrThr : 0.8;
  var list = Array.isArray(candidates) ? candidates.slice(0, topN) : [];
  if (list.length < 2) return null;
  var clusters = {}, corrs = [];
  for (var i = 0; i < list.length; i++){
    var c = list[i];
    var cl = c.cluster || pbCluster(c.sym, c.klass);
    clusters[cl] = (clusters[cl] || 0) + 1;
  }
  var topCluster = null, topCount = 0;
  for (var k in clusters){
    if (Object.prototype.hasOwnProperty.call(clusters, k) && clusters[k] > topCount){
      topCount = clusters[k]; topCluster = k;
    }
  }
  for (var a = 0; a < list.length; a++){
    for (var b = a + 1; b < list.length; b++){
      var ca = list[a].realizedCorr, cb = list[b].realizedCorr;
      if (typeof ca === 'number' && typeof cb === 'number'){
        corrs.push((ca + cb) / 2);
      } else if (list[a].corr != null && list[b].corr != null){
        corrs.push(Math.abs(list[a].corr));
      }
    }
  }
  var meanCorr = corrs.length ? corrs.reduce(function(x, y){ return x + y; }, 0) / corrs.length : null;
  if (topCount >= Math.ceil(topN * 0.75) || (meanCorr !== null && meanCorr > corrThr)){
    return {
      warn: true,
      topN: list.length,
      cluster: topCluster,
      clusterCount: topCount,
      meanCorr: meanCorr,
      message: 'TOP ' + list.length + ' CANDIDATES ARE ONE TRADE — ' + topCount + ' of ' + list.length
        + ' in ' + topCluster + (meanCorr !== null ? ', mean corr ' + meanCorr.toFixed(2) : ''),
    };
  }
  return null;
}

export function pbClusterCheck(intent, positions, navUsd, caps){
  caps = Object.assign({}, PB_CLUSTER_CAPS, caps || {});
  var res = { ok: true, veto: false, reasons: [], cluster: null };
  try{
    var nav = +navUsd;
    if (!(nav > 0) || !intent || !(+intent.riskUsd > 0)) return res;
    var cl = pbCluster(intent.sym, intent.klass);
    res.cluster = cl;
    var next = (Array.isArray(positions) ? positions.slice() : []).concat([{
      sym: intent.sym, klass: intent.klass, dir: intent.dir,
      riskUsd: +intent.riskUsd, cluster: cl,
    }]);
    var heat = pbClusterHeat(next, nav);
    var clHeat = heat.byCluster[cl] ? Math.abs(heat.byCluster[cl].net) : 0;
    if (clHeat > caps.maxClusterHeatPct + 1e-12){
      res.veto = true; res.ok = false;
      res.reasons.push('cluster heat ' + cl + ' ' + (clHeat * 100).toFixed(2) +
        '% > cap ' + (caps.maxClusterHeatPct * 100).toFixed(2) + '% NAV');
    }
    if (Math.abs(heat.netBeta) > caps.maxNetBetaHeatPct + 1e-12){
      res.veto = true; res.ok = false;
      res.reasons.push('net beta heat ' + (heat.netBeta * 100).toFixed(2) +
        '% > cap ' + (caps.maxNetBetaHeatPct * 100).toFixed(2) + '% NAV');
    }
    return res;
  }catch(e){ return res; }
}
