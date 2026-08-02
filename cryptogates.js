/* HARDGATE — shared SWING/SCALP gate matrix (cryptowatch + runScan parity). */
'use strict';

(function(){
  var G = (typeof window !== 'undefined') ? window : globalThis;
  function cgEsc(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function swingGateMatrix(rows, ticker){
    if (!rows || rows.length < 210) return null;
    var c = rows.map(function(r){ return r.c; });
    var e9 = last(ema(c, 9)), e21 = last(ema(c, 21)), e50 = last(ema(c, 50)), e200 = last(ema(c, 200));
    var p = last(c), r14 = last(rsi(c, 14)), vz = volZ(rows, 20);
    var dir = null;
    if (e9 > e21 && e21 > e50) dir = 'long';
    else if (e9 < e21 && e21 < e50) dir = 'short';
    if (!dir) return { dir: null, gates: [], passed: 0, gatesTotal: 7, level: null, clean: false };

    var a4 = last(atr(rows, 14));
    var gates = [];
    var g1 = isFinite(a4) && Math.abs(e21 - e50) >= 0.25 * a4;
    gates.push(['G1 cascade+spread', g1]);
    var g2 = dir === 'long' ? p > e200 : p < e200;
    gates.push(['G2 HTF side', g2]);
    var g3 = !((dir === 'long' && r14 > 70) || (dir === 'short' && r14 < 30));
    gates.push(['G3 RSI', g3]);
    var g4 = true;
    if (ticker && ticker.fundingPct !== null){
      var fr = ticker.fundingPct;
      g4 = Math.abs(fr) <= 0.05 + 1e-9 && !((dir === 'long' && fr >= 0.04) || (dir === 'short' && fr <= -0.04));
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
    var distToAnchor = isFinite(a4) ? Math.abs(p - e21) / a4 : NaN;
    var anchorOK = isFinite(distToAnchor) && distToAnchor <= 1.5;
    var clean = passed >= 7 && anchorOK;
    return {
      dir: dir, gates: gates, passed: passed, gatesTotal: 7,
      level: isFinite(e21) ? e21 : p, clean: clean,
      p: p, e9: e9, e21: e21, a4: a4, r14: r14, vz: vz,
      stop: stop, entry: entry, risk: risk, expectedMove: expectedMove,
      dynamicRR: dynamicRR, ev: ev, anchorOK: anchorOK, rows: rows
    };
  }

  function scalpGateMatrix(h1, m15, ticker, minsToFunding){
    if (!h1 || h1.length < 60 || !m15 || m15.length < 60) return null;
    var c1 = h1.map(function(r){ return r.c; });
    var e9h = last(ema(c1, 9)), e21h = last(ema(c1, 21)), e50h = last(ema(c1, 50));
    var dir = null;
    if (e9h > e21h && e21h > e50h) dir = 'long';
    else if (e9h < e21h && e21h < e50h) dir = 'short';
    if (!dir) return { dir: null, gates: [], passed: 0, gatesTotal: 7, level: null, clean: false };

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
    var g4b = !(minsToFunding < 25);
    var atrArr = atr(m15, 14);
    var a = last(atrArr);
    var base = atrArr.slice(-96).filter(isFinite).sort(function(x,y){ return x-y; });
    var aMed = base.length ? base[Math.floor(base.length / 2)] : NaN;
    var g5v = isFinite(a) && isFinite(aMed) && a >= 0.8 * aMed;
    var vz = volZ(m15, 20);
    var currentBar = m15[m15.length - 1];
    var range = currentBar.h - currentBar.l;
    var closePos = range > 0 ? (currentBar.c - currentBar.l) / range : 0.5;
    var closeOK = dir === 'long' ? closePos >= 0.60 : closePos <= 0.40;
    var _rA = rsi(c15, 14);
    var _rL = _rA[_rA.length - 1];
    var _rP = _rA[_rA.length - 4];
    var slopeOK = (isFinite(_rL) && isFinite(_rP)) ? (dir === 'long' ? _rL > _rP : _rL < _rP) : false;
    var g6 = (vz > 0.5) || (closeOK && slopeOK);
    var entry = c15[n - 1];
    var stop = (swept && reclaimed)
      ? (dir === 'long' ? localLow - (a * 0.25) : localHigh + (a * 0.25))
      : (dir === 'long' ? Math.min.apply(null, m15.slice(n - 8, n - 1).map(function(r){ return r.l; })) - (a * 0.25)
        : Math.max.apply(null, m15.slice(n - 8, n - 1).map(function(r){ return r.h; })) + (a * 0.25));
    var risk = Math.abs(entry - stop);
    var expectedMove = a * 2.5;
    var dynamicRR = risk > 0 ? expectedMove / risk : 0;
    var g7 = dynamicRR >= 1.5;
    var gates = [
      ['G1 1H trend', true],
      ['G2 sweep+reclaim / EMA21 hold', g2],
      ['G3 RSI band', g3],
      ['G4 funding', g4],
      ['G5 settle>25m', g4b],
      ['G6 vol+wick commit', g6 && closeOK],
      ['G7 1.5R vol-capped', g7]
    ];
    var passed = gates.filter(function(g){ return g[1]; }).length;
    var t1 = dir === 'long' ? entry + expectedMove : entry - expectedMove;
    var t2 = dir === 'long' ? entry + (a * 4) : entry - (a * 4);
    return {
      dir: dir, gates: gates, passed: passed, gatesTotal: 7,
      level: entry, clean: passed >= 7,
      entry: entry, stop: stop, t1: t1, t2: t2, dynamicRR: dynamicRR,
      r15: r15, a: a, m15: m15, h1: h1, swept: swept, reclaimed: reclaimed
    };
  }

  function swingTryClean(rows, ticker){
    var m = swingGateMatrix(rows, ticker);
    if (!m || !m.dir || !m.clean) return null;
    var dir = m.dir, p = m.p, e9 = m.e9, e21 = m.e21, a4 = m.a4;
    var plannedEntry = p;
    var entryType = 'MARKET';
    var distToFast = Math.abs(p - e9) / a4;
    if (distToFast > 0.25){
      plannedEntry = dir === 'long' ? Math.min(p, e9) : Math.max(p, e9);
      entryType = 'LIMIT @ EMA9';
    }
    var entry = plannedEntry;
    var stop = m.stop;
    if (Math.abs(entry - stop) > 1.5 * a4){
      stop = dir === 'long' ? entry - 1.5 * a4 : entry + 1.5 * a4;
      entryType += ' · ATR-capped stop';
    }
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    var expectedMove = a4 * 3.5;
    var maxExcursion = a4 * 4.9;
    var t1 = dir === 'long' ? entry + expectedMove : entry - expectedMove;
    var t2 = dir === 'long' ? entry + maxExcursion : entry - maxExcursion;
    var dynamicRR = expectedMove / risk;
    if (!(dynamicRR >= 2)) return null;
    var out = { sym: ticker && ticker.symbol, dir: dir, entry: entry, stop: stop, t1: t1, t2: t2,
      rr: dynamicRR, entryType: entryType, rows: m.rows, r14: m.r14, vz: m.vz, ev: m.ev, mark: p };
    if (typeof hgEnrichSwingClean === 'function'){
      var enriched = hgEnrichSwingClean(out, rows, m);
      if (enriched) return enriched;
    }
    return out;
  }

  function scalpTryClean(h1, m15, ticker, minsToFunding){
    var m = scalpGateMatrix(h1, m15, ticker, minsToFunding);
    if (!m || !m.dir || !m.clean) return null;
    return { sym: ticker && ticker.symbol, dir: m.dir, entry: m.entry, stop: m.stop,
      t1: m.t1, t2: m.t2, rr: m.dynamicRR, m15: m.m15, r15: m.r15, a: m.a };
  }

  G.swingGateMatrix = swingGateMatrix;
  G.scalpGateMatrix = scalpGateMatrix;
  G.swingTryClean = swingTryClean;
  G.scalpTryClean = scalpTryClean;
})();
