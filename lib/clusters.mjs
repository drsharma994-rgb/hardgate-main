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
