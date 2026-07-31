/* =========================================================================
HARDGATE — cryptowatch.js
Crypto FORMING NOW watch panel — partial gate progress on SWING/SCALP
and saved COIL watchlists. Watch items are NOT entries. Pure evaluators +
HTML renderer; scans are orchestrated from index.html runScan().
========================================================================= */
'use strict';

var CW_CSS = ''
+ '#tab_swing .hgwatch,#tab_scalp .hgwatch,#tab_coil .hgwatch{margin:14px 0 18px;border:1px solid #E2E8F0;border-radius:10px;background:#F8FAFC;overflow:hidden}'
+ '#tab_swing .hgwatch-h,#tab_scalp .hgwatch-h,#tab_coil .hgwatch-h{font-size:10px;letter-spacing:.18em;font-weight:800;color:#475569;padding:10px 12px;border-bottom:1px solid #E2E8F0;background:#FFFFFF}'
+ '#tab_swing .hgwatch-h span,#tab_scalp .hgwatch-h span,#tab_coil .hgwatch-h span{font-weight:500;letter-spacing:.04em;color:#64748B}'
+ '#tab_swing .hgw-row,#tab_scalp .hgw-row,#tab_coil .hgw-row{font-size:11px;padding:8px 12px;border-bottom:1px solid #F1F5F9;color:#334155;line-height:1.55;font-weight:500}'
+ '#tab_swing .hgw-row:last-child,#tab_scalp .hgw-row:last-child,#tab_coil .hgw-row:last-child{border-bottom:0}'
+ '#tab_swing .hgw-row.armed,#tab_scalp .hgw-row.armed,#tab_coil .hgw-row.armed{background:rgba(5,150,105,.06);color:#020617;border-left:3px solid #059669}'
+ '#tab_swing .hgw-row.idle,#tab_scalp .hgw-row.idle,#tab_coil .hgw-row.idle{border-left:3px solid #E2E8F0}'
+ '#tab_swing .hgw-st,#tab_scalp .hgw-st,#tab_coil .hgw-st{font-size:8px;letter-spacing:.14em;padding:2px 6px;border-radius:4px;margin-right:6px;border:1px solid;font-weight:700}'
+ '#tab_swing .hgw-row.armed .hgw-st,#tab_scalp .hgw-row.armed .hgw-st,#tab_coil .hgw-row.armed .hgw-st{color:#047857;border-color:rgba(5,150,105,.45);background:rgba(5,150,105,.10)}'
+ '#tab_swing .hgw-row.idle .hgw-st,#tab_scalp .hgw-row.idle .hgw-st,#tab_coil .hgw-row.idle .hgw-st{color:#475569;border-color:#E2E8F0;background:#FFFFFF}'
+ '#tab_swing .hgw-row b,#tab_scalp .hgw-row b,#tab_coil .hgw-row b{font-weight:700;color:#020617}'
+ '.hgwatch-cross{font-size:10px;margin-top:6px;line-height:1.5;color:#334155}';

function cwEsc(s){
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function cwFmt(n, d){
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return Number(n).toFixed(d === undefined ? 2 : d);
}

/* Swing: mirror runScan gates; return null if all 7 pass (already CLEAN). */
function swingWatchEval(rows, ticker){
  if (!rows || rows.length < 210) return null;
  var c = rows.map(function(r){ return r.c; });
  var e9 = last(ema(c, 9)), e21 = last(ema(c, 21)), e50 = last(ema(c, 50)), e200 = last(ema(c, 200));
  var p = last(c), r14 = last(rsi(c, 14)), vz = volZ(rows, 20);
  var dir = null;
  if (e9 > e21 && e21 > e50) dir = 'long';
  else if (e9 < e21 && e21 < e50) dir = 'short';
  if (!dir) return { state: 'idle', dir: null, strategy: 'SWING 4H', sym: ticker && ticker.symbol,
    reason: 'no aligned 4H EMA cascade (G1)', gatesPassed: 0, gatesTotal: 7, level: null };

  var a4 = last(atr(rows, 14));
  var gates = [];
  var g1 = isFinite(a4) && Math.abs(e21 - e50) >= 0.25 * a4;
  gates.push(['G1 cascade+spread', g1]);
  var g2 = dir === 'long' ? p > e200 : p < e200;
  gates.push(['G2 HTF side', g2]);
  var g3 = !((dir === 'long' && r14 > 70) || (dir === 'short' && r14 < 30));
  gates.push(['G3 RSI', g3]);
  var g4 = true, g4note = 'funding n/a';
  if (ticker && ticker.fundingPct !== null){
    var fr = ticker.fundingPct;
    g4 = Math.abs(fr) <= 0.05 + 1e-9 && !((dir === 'long' && fr >= 0.04) || (dir === 'short' && fr <= -0.04));
    g4note = cwFmt(fr, 4) + '%';
  }
  gates.push(['G4 funding', g4]);
  var currentBar = rows[rows.length - 1];
  var range = currentBar.h - currentBar.l;
  var closePos = range > 0 ? (currentBar.c - currentBar.l) / range : 0.5;
  var closeOK = dir === 'long' ? closePos >= 0.60 : closePos <= 0.40;
  var _rA = rsi(c, 14);
  var _rP = _rA[_rA.length - 4];
  var slopeOK = isFinite(_rP) ? (dir === 'long' ? r14 > _rP : r14 < _rP) : false;
  var g5 = (vz > 0.5) || (closeOK && slopeOK);
  gates.push(['G5 vol+wick', g5 && closeOK]);
  var stop = lastSwing(rows, dir, 30);
  var entry = p;
  var risk = Math.abs(entry - stop);
  var expectedMove = a4 * 3.5;
  var dynamicRR = risk > 0 ? expectedMove / risk : 0;
  var g6 = dynamicRR >= 2;
  gates.push(['G6 R:R≥2', g6]);
  var ev = cusumLast(c.slice(-120), 1);
  var g7 = !(ev && ev.barsAgo <= 20 && ev.dir !== dir);
  gates.push(['G7 CUSUM', g7]);

  var passed = gates.filter(function(g){ return g[1]; }).length;
  if (passed >= 7) return null;

  var missing = gates.filter(function(g){ return !g[1]; }).map(function(g){ return g[0]; });
  var level = isFinite(e21) ? e21 : p;
  if (passed >= 5){
    return { state: 'armed', dir: dir, strategy: 'SWING 4H · ' + dir.toUpperCase(), sym: ticker && ticker.symbol,
      condition: passed + '/7 gates pass — waiting: ' + missing.join(', '),
      gatesPassed: passed, gatesTotal: 7, level: level };
  }
  return { state: 'idle', dir: dir, strategy: 'SWING 4H · ' + dir.toUpperCase(), sym: ticker && ticker.symbol,
    reason: passed + '/7 gates — need ≥5 to arm (' + missing.join(', ') + ')',
    gatesPassed: passed, gatesTotal: 7, level: level };
}

function scalpWatchEval(h1, m15, ticker, minsToFunding){
  if (!h1 || h1.length < 60 || !m15 || m15.length < 60) return null;
  var c1 = h1.map(function(r){ return r.c; });
  var e9h = last(ema(c1, 9)), e21h = last(ema(c1, 21)), e50h = last(ema(c1, 50));
  var dir = null;
  if (e9h > e21h && e21h > e50h) dir = 'long';
  else if (e9h < e21h && e21h < e50h) dir = 'short';
  if (!dir) return { state: 'idle', dir: null, strategy: 'SCALP 15m', sym: ticker && ticker.symbol,
    reason: 'no 1H cascade (G1)', gatesPassed: 0, gatesTotal: 7, level: null };

  var c15 = m15.map(function(r){ return r.c; });
  var e9a = ema(c15, 9), e21a = ema(c15, 21);
  var n = c15.length;
  var priorWin = m15.slice(n - 24, n - 7);
  var localLow = Math.min.apply(null, priorWin.map(function(r){ return r.l; }));
  var localHigh = Math.max.apply(null, priorWin.map(function(r){ return r.h; }));
  var recentWin = m15.slice(n - 7, n - 1);
  var swept = dir === 'long' ? Math.min.apply(null, recentWin.map(function(r){ return r.l; })) < localLow
    : Math.max.apply(null, recentWin.map(function(r){ return r.h; })) > localHigh;
  var reclaimed = dir === 'long' ? (c15[n - 1] > e9a[n - 1] && e9a[n - 1] > e21a[n - 1])
    : (c15[n - 1] < e9a[n - 1] && e9a[n - 1] < e21a[n - 1]);
  var pullbackHold = (dir === 'long' ? (m15[n - 1].l <= e21a[n - 1] && c15[n - 1] > e21a[n - 1])
    : (m15[n - 1].h >= e21a[n - 1] && c15[n - 1] < e21a[n - 1])) && reclaimed;
  var g2 = (swept && reclaimed) || pullbackHold;
  var r15 = last(rsi(c15, 14));
  var g3 = dir === 'long' ? (r15 >= 40 && r15 <= 65) : (r15 >= 35 && r15 <= 60);
  var g4 = true;
  if (ticker && ticker.fundingPct !== null){
    var fr = ticker.fundingPct;
    g4 = Math.abs(fr) <= 0.05 + 1e-9 && !((dir === 'long' && fr >= 0.04) || (dir === 'short' && fr <= -0.04));
  }
  var g5 = (minsToFunding === undefined || minsToFunding === null) ? true : minsToFunding >= 25;
  var atrArr = atr(m15, 14);
  var a = last(atrArr);
  var base = atrArr.slice(-96).filter(isFinite).sort(function(x,y){ return x - y; });
  var aMed = base.length ? base[Math.floor(base.length / 2)] : NaN;
  var g6a = isFinite(a) && isFinite(aMed) && a >= 0.8 * aMed;
  var vz = volZ(m15, 20);
  var currentBar = m15[m15.length - 1];
  var range = currentBar.h - currentBar.l;
  var closePos = range > 0 ? (currentBar.c - currentBar.l) / range : 0.5;
  var closeOK = dir === 'long' ? closePos >= 0.60 : closePos <= 0.40;
  var g6b = (vz > 0.5) || closeOK;
  var g6 = g6a && g6b && closeOK;
  var entry = c15[n - 1];
  var stop = swept && reclaimed
    ? (dir === 'long' ? localLow - a * 0.25 : localHigh + a * 0.25)
    : (dir === 'long' ? Math.min.apply(null, m15.slice(n - 8, n - 1).map(function(r){ return r.l; })) - a * 0.25
      : Math.max.apply(null, m15.slice(n - 8, n - 1).map(function(r){ return r.h; })) + a * 0.25);
  var risk = Math.abs(entry - stop);
  var g7 = risk > 0 && (a * 2.5 / risk) >= 1.5;

  var gates = [['G1 1H trend', true], ['G2 sweep/reclaim', g2], ['G3 RSI band', g3],
    ['G4 funding', g4], ['G5 settle>25m', g5], ['G6 vol alive', g6], ['G7 1.5R', g7]];
  var passed = gates.filter(function(g){ return g[1]; }).length;
  if (passed >= 7) return null;
  var missing = gates.filter(function(g){ return !g[1]; }).map(function(g){ return g[0]; });
  var level = isFinite(e21a[n - 1]) ? e21a[n - 1] : entry;
  if (passed >= 5){
    return { state: 'armed', dir: dir, strategy: 'SCALP 15m · ' + dir.toUpperCase(), sym: ticker && ticker.symbol,
      condition: passed + '/7 gates — waiting: ' + missing.join(', '),
      gatesPassed: passed, gatesTotal: 7, level: level };
  }
  return { state: 'idle', dir: dir, strategy: 'SCALP 15m · ' + dir.toUpperCase(), sym: ticker && ticker.symbol,
    reason: passed + '/7 gates — need ≥5 to arm (' + missing.join(', ') + ')',
    gatesPassed: passed, gatesTotal: 7, level: level };
}

function coilWatchItems(watch){
  if (!watch || !Array.isArray(watch.list) || !watch.list.length) return [];
  return watch.list.map(function(w){
    if (!w || !w.symbol) return null;
    return { state: 'armed', dir: w.dir || 'long', strategy: 'COIL COMPRESSION', sym: w.symbol,
      condition: 'sweep below ' + cwFmt(w.coilLow) + ' then reclaim — range ' + cwFmt(w.coilLow) + '–' + cwFmt(w.coilHigh),
      gatesPassed: 3, gatesTotal: 3, level: w.coilLow };
  }).filter(Boolean);
}

function cryptoFormingNowHTML(items){
  if (!items || !items.length){
    return '<div class="hgwatch"><div class="hgwatch-h">FORMING NOW <span>— no partial setups on watch</span></div>'
      + '<div class="hgw-row idle"><span class="hgw-st">IDLE</span> Run SCAN — armed rows appear when ≥5/7 gates pass but the setup is not CLEAN yet.</div></div>';
  }
  var armedN = items.filter(function(w){ return w && w.state === 'armed'; }).length;
  var rows = items.map(function(w){
    if (!w) return '';
    var st = w.state === 'armed';
    var lvl = (typeof w.level === 'number' && isFinite(w.level)) ? ' · trigger ~' + cwFmt(w.level) : '';
    return '<div class="hgw-row ' + (st ? 'armed' : 'idle') + '">'
      + '<span class="hgw-st">' + (st ? 'ARMED' : 'IDLE') + '</span>'
      + '<b>' + cwEsc(w.sym) + '</b> · ' + cwEsc(w.strategy || 'SETUP')
      + (w.gatesPassed !== undefined ? ' (' + w.gatesPassed + '/' + (w.gatesTotal || 7) + ')' : '')
      + lvl + ' — ' + cwEsc(st ? (w.condition || 'watching') : (w.reason || w.condition || ''))
      + '</div>';
  }).join('');
  return '<div class="hgwatch"><div class="hgwatch-h">FORMING NOW <span>— '
    + armedN + ' armed · watch items, not entries</span></div>' + rows + '</div>';
}

function cryptoWatchInjectStyles(){
  if (typeof document === 'undefined') return;
  if (document.getElementById('hg-cryptowatch-css')) return;
  var el = document.createElement('style');
  el.id = 'hg-cryptowatch-css';
  el.textContent = CW_CSS;
  document.head.appendChild(el);
}

if (typeof window !== 'undefined'){
  window.swingWatchEval = swingWatchEval;
  window.scalpWatchEval = scalpWatchEval;
  window.coilWatchItems = coilWatchItems;
  window.cryptoFormingNowHTML = cryptoFormingNowHTML;
  window.cryptoWatchInjectStyles = cryptoWatchInjectStyles;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cryptoWatchInjectStyles);
  else cryptoWatchInjectStyles();
}
