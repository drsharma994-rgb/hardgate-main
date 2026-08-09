/* HARDGATE — OpenBB-style desk macro core (pure, vm-testable).
   Unified cross-asset snapshot for setup formation + FTS stack.
   Inspired by OpenBB ODP multi-asset context — no Python runtime required.
   Never throws. */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const round = (v, dp = 3) => (Number.isFinite(v) ? Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp) : null);

/** Parse Yahoo v8 chart JSON into ascending OHLC rows. */
export function obbParseYahooChart(j){
  try{
    var r = j && j.chart && j.chart.result && j.chart.result[0];
    if (!r || !r.timestamp || !r.indicators) return [];
    var ts = r.timestamp;
    var q = r.indicators.quote && r.indicators.quote[0];
    if (!q) return [];
    var out = [];
    for (var i = 0; i < ts.length; i++){
      var c = q.close && q.close[i];
      if (c == null || !isFinite(+c)) continue;
      out.push({
        t: ts[i],
        c: +c,
        o: +(q.open && q.open[i] != null ? q.open[i] : c),
        h: +(q.high && q.high[i] != null ? q.high[i] : c),
        l: +(q.low && q.low[i] != null ? q.low[i] : c),
      });
    }
    return out.sort(function(a, b){ return a.t - b.t; });
  }catch(e){ return []; }
}

/** 20-bar trend label from daily closes. */
export function obbTrend20(rows){
  if (!rows || rows.length < 5) return { trend: null, changePct: null };
  var slice = rows.slice(-21);
  if (slice.length < 2) return { trend: null, changePct: null };
  var first = slice[0].c, last = slice[slice.length - 1].c;
  if (!(first > 0 && last > 0)) return { trend: null, changePct: null };
  var ch = (last / first - 1) * 100;
  var trend = ch > 0.35 ? 'RISING' : (ch < -0.35 ? 'FALLING' : 'FLAT');
  return { trend: trend, changePct: round(ch, 2), last: last };
}

/**
 * Risk-on desk score −100..+100 from cross-asset legs (OpenBB-style desk read).
 * Positive = risk-on tailwind for long crypto/gold beta.
 */
export function obbRiskOnScore(desk){
  if (!desk || typeof desk !== 'object') return 0;
  var s = 0;
  var spx = desk.spx || desk.spy;
  if (spx && spx.trend20 === 'RISING') s += 25;
  else if (spx && spx.trend20 === 'FALLING') s -= 25;
  var qqq = desk.qqq;
  if (qqq && qqq.trend20 === 'RISING') s += 10;
  else if (qqq && qqq.trend20 === 'FALLING') s -= 10;
  var vix = desk.vix;
  if (vix && isFinite(+vix.last)){
    if (+vix.last >= 28) s -= 20;
    else if (+vix.last >= 22) s -= 10;
    else if (+vix.last <= 14) s += 10;
  }
  if (vix && vix.trend20 === 'RISING') s -= 8;
  else if (vix && vix.trend20 === 'FALLING') s += 8;
  var dxy = desk.dxyOfficial || desk.dxy;
  if (dxy && dxy.trend20 === 'RISING') s -= 15;
  else if (dxy && dxy.trend20 === 'FALLING') s += 15;
  var ry = desk.realYield10Y;
  if (isFinite(+ry) && desk.realYieldTrend === 'RISING') s -= 8;
  else if (isFinite(+ry) && desk.realYieldTrend === 'FALLING') s += 8;
  var btc = desk.btc;
  if (btc && btc.trend20 === 'RISING') s += 12;
  else if (btc && btc.trend20 === 'FALLING') s -= 12;
  return Math.max(-100, Math.min(100, Math.round(s)));
}

export function obbRiskOnLabel(score){
  var s = num(score) ?? 0;
  if (s >= 35) return 'RISK-ON';
  if (s <= -35) return 'RISK-OFF';
  return 'MIXED';
}

/** FQS macro pillar extension using desk snapshot. */
export function obbDeskMacroScore(cand, desk){
  var side = String(cand.side || cand.dir || 'long').toLowerCase();
  var score = (desk && desk.riskOnScore != null && isFinite(+desk.riskOnScore)) ? +desk.riskOnScore
    : ((cand.riskOnScore != null && isFinite(+cand.riskOnScore)) ? +cand.riskOnScore : obbRiskOnScore(desk));
  var base = 0.5;
  if (side === 'long'){
    if (score >= 35) base = 0.92;
    else if (score >= 15) base = 0.75;
    else if (score <= -35) base = 0.18;
    else if (score <= -15) base = 0.32;
  }else{
    if (score <= -35) base = 0.9;
    else if (score <= -15) base = 0.72;
    else if (score >= 35) base = 0.2;
    else if (score >= 15) base = 0.35;
  }
  var hint = String(cand.realRateHint || desk?.realRateHint || '').toUpperCase();
  if (hint.includes('TAILWIND') && side === 'long') base = Math.max(base, 0.85);
  if (hint.includes('HEADWIND') && side === 'long') base = Math.min(base, 0.25);
  if (hint.includes('HEADWIND') && side === 'short') base = Math.max(base, 0.85);
  return Math.max(0, Math.min(1, base));
}

/** Formation rank boost −12..+12 from desk alignment. */
export function obbDeskFormationBoost(dir, desk){
  var side = String(dir || 'long').toLowerCase();
  if (!desk) return 0;
  var score = desk.riskOnScore != null && isFinite(+desk.riskOnScore) ? +desk.riskOnScore : obbRiskOnScore(desk);
  if (side === 'long'){
    if (score >= 40) return 12;
    if (score >= 20) return 7;
    if (score >= 8) return 3;
    if (score <= -40) return -12;
    if (score <= -20) return -7;
    if (score <= -8) return -3;
    return 0;
  }
  if (score <= -40) return 12;
  if (score <= -20) return 7;
  if (score <= -8) return 3;
  if (score >= 40) return -12;
  if (score >= 20) return -7;
  if (score >= 8) return -3;
  return 0;
}

/** Merge OpenBB API payload into desk shape (optional backend). */
export function obbMergeOpenBBPayload(base, obbApi){
  if (!obbApi || typeof obbApi !== 'object') return base;
  var out = Object.assign({}, base || {});
  try{
    if (obbApi.equity || obbApi.spy){
      var eq = obbApi.equity || obbApi.spy;
      if (eq.last != null) out.spx = Object.assign({}, out.spx || {}, { last: +eq.last, trend20: eq.trend || eq.trend20 });
    }
    if (obbApi.vix && obbApi.vix.last != null){
      out.vix = Object.assign({}, out.vix || {}, { last: +obbApi.vix.last, trend20: obbApi.vix.trend || obbApi.vix.trend20 });
    }
    if (obbApi.riskOn && obbApi.riskOn.score != null){
      out.riskOnScore = +obbApi.riskOn.score;
      out.riskOnLabel = obbApi.riskOn.label || obbRiskOnLabel(out.riskOnScore);
    }
    out.openbb = true;
    out.source = out.source ? out.source + '+openbb' : 'openbb';
  }catch(e){}
  if (out.riskOnScore == null) out.riskOnScore = obbRiskOnScore(out);
  if (!out.riskOnLabel) out.riskOnLabel = obbRiskOnLabel(out.riskOnScore);
  return out;
}

export function obbFinalizeDesk(desk){
  var d = Object.assign({ at: Date.now() }, desk || {});
  if (d.riskOnScore == null) d.riskOnScore = obbRiskOnScore(d);
  if (!d.riskOnLabel) d.riskOnLabel = obbRiskOnLabel(d.riskOnScore);
  return d;
}
