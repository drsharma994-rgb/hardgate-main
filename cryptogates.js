/* HARDGATE — shared SWING/SCALP gate matrix (cryptowatch + runScan parity). */
'use strict';

(function(){
  var G = (typeof window !== 'undefined') ? window : globalThis;
  /* PARITY BLOCK — these four MUST equal engine.js's tunables of the same name.
     engine.js is the source of truth; tests/test-gate-parity.mjs enforces it. */
  /* ===================== THE SWING LOOKBACK =====================
     This is the most consequential number in the swing path and it was a
     hardcoded 30. Measured over 3,346 aligned cascades:
       lookback  ~days   median stop   within the 1.75xATR G6 cap   max R:R at median
            5     0.8      1.39 ATR            62.8%                     2.53R
            8     1.3      1.87 ATR            45.9%                     1.87R
           10     1.7      2.14 ATR            38.3%                     1.64R
           20     3.3      3.43 ATR            12.7%                     1.02R
           30     5.0      4.53 ATR             3.6%                     0.77R   <- was here
     ATR(14) on 4H spans about 2.3 days. A 30-bar swing spans 5. The stop was
     being measured over TWICE the horizon the R:R is scaled to, so the median
     setup could not reach even 1:1 — G6 was not "tight", it was arithmetically
     asking for a rare geometry.
  /* CHANGED 30 -> 20 in fix pack 22, on outcome evidence from two independent
     120-symbol walk-forward samples (see the pack notes). 30 produced 19
     settled trades per sample — a number you cannot measure anything from, and
     the reason this app has shown zero setups for twenty-one packs. */
  var CG_SWING_LOOK = 20;
  var CG_SWING_ANCHOR_ATR = 1.5;    /* engine ANCHOR_MAX_ATR */
  var CG_G5_VZ_MIN = 0.5;           /* engine VOLZ_MIN */
  var CG_G1_SPREAD_ATR = 0.25;      /* engine SPREAD_MIN_ATR */
  var CG_SWING_CASCADE_MIN = 4;
  var CG_SCALP_RR_MIN = 2.25;
  var CG_SWING_EXP_ATR = 3.5;
  var CG_SWING_RR_MIN = 2.0;
  var CG_SWING_MAX_EXC_ATR = 4.9;
  var CG_FUND_HARD = 0.05;
  var CG_FUND_DIR = 0.04;
  /* Data-sanity bound only. It is NOT a crowd read: funding that PAYS you is
     never a reason to skip a trade, however large. */
  var CG_FUND_SANITY = 0.30;
  /* Max non-G4 gate failures tolerated by the counter-trend funding fade.
     Applies ALWAYS — it used to be skipped once |funding| >= CG_FUND_HARD,
     which let a setup with every other gate down still emit a ticket. */
  var CG_FADE_MAX_OTHER_FAILS = 1;
  function cgEsc(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function cgPositioningCls(ticker){
    if (!ticker) return null;
    var d = {
      chg24: ticker.chg24, oiChgPct: ticker.oiChgPct, fundingPct: ticker.fundingPct,
      retailLongPct: ticker.retailLongPct, topLongPct: ticker.topLongPct,
      takerRatio: ticker.takerRatio
    };
    if (typeof G.hgPositioningClassify === 'function'){
      try{ return G.hgPositioningClassify(d, { style: 'smart' }); }catch(e){}
    }
    if (typeof G.smartClassify === 'function'){
      try{ return G.smartClassify(d); }catch(e){}
    }
    return null;
  }

  /* Crowded-book fade side when |fr|>=0.05 or trend-aligned crowd — positioning score >= 2 (ENGINE parity). */
  function cgFundingFadeDir(ticker, trendDir){
    if (!ticker || ticker.fundingPct === null || ticker.fundingPct === undefined) return null;
    var fr = +ticker.fundingPct;
    if (!isFinite(fr)) return null;
    var hard = Math.abs(fr) >= CG_FUND_HARD - 1e-9;
    var dirCrowd = (trendDir === 'long' && fr >= CG_FUND_DIR) || (trendDir === 'short' && fr <= -CG_FUND_DIR);
    if (!hard && !dirCrowd) return null;
    var fadeDir = fr > 0 ? 'short' : 'long';
    var cls = cgPositioningCls(ticker);
    if (!cls) return null;
    var score = (cls.dir === fadeDir) ? (cls.score || 0) : 0;
    if (!score && cls.fundingFade && cls.dir === fadeDir) score = cls.score || 2;
    if (score < 2) return null;
    return fadeDir;
  }

  function cgBuildFadePlan(cls, rows4h, rows1h, fadeDir){
    if (typeof G.smartSetup !== 'function' || !cls) return null;
    var fadeCls = Object.assign({}, cls, { dir: fadeDir, fundingFade: true });
    try{
      var sp = G.smartSetup(fadeCls, rows4h, rows1h || []);
      if (!sp || sp.type !== 'FADE' || !(+sp.rr1 >= 2.0)) return null;
      return sp;
    }catch(e){ return null; }
  }

  function cgTrySwingFundingFade(rows, ticker, m){
    if (!m || !m.dir || !rows) return null;
    var fadeDir = cgFundingFadeDir(ticker, m.dir);
    if (!fadeDir || !cgMacroOk(ticker, fadeDir)) return null;
    var g4fail = false, nonG4Fails = 0;
    for (var gi = 0; gi < (m.gates || []).length; gi++){
      var g = m.gates[gi];
      if (!g[1]){
        if (g[0].indexOf('G4 funding') === 0) g4fail = true;
        else nonG4Fails++;
      }
    }
    var fr = ticker && ticker.fundingPct !== null ? Math.abs(+ticker.fundingPct) : 0;
    if (!g4fail && fr < CG_FUND_HARD - 1e-9) return null;
    /* ceiling applies ALWAYS. It used to short-circuit once |fr| >= 0.05, which
       let a setup with every other gate down still emit a ticket. */
    if (nonG4Fails > CG_FADE_MAX_OTHER_FAILS) return null;
    var cls = cgPositioningCls(ticker);
    var sp = cgBuildFadePlan(cls, rows, null, fadeDir);
    if (!sp) return null;
    var out = {
      sym: ticker && ticker.symbol, dir: fadeDir,
      entry: sp.entry, stop: sp.stop, t1: sp.t1, t2: sp.t2, rr: sp.rr1,
      entryType: 'FUNDING-FADE · mean-reversion',
      rows: m.rows, r14: m.r14, vz: m.vz, mark: m.p,
      fundingFade: true, planSrc: 'funding fade', type: 'FADE',
      targetPolicy: sp.targetPolicy || 'R-multiples (fade)', note: sp.note || 'crowded funding fade'
    };
    if (typeof hgSetupStackAttach === 'function'){
      /* HONEST STAMP: the matrix did NOT go 7/7 — report what actually passed.
         clean:true here used to print "CLEAN 7/7" on a 4/7 counter-trend trade. */
      hgSetupStackAttach(out, { style: 'swing', rows4h: rows, ticker: ticker,
        gatesPassed: m.passed, gatesTotal: m.gatesTotal, clean: false, nearClean: false,
        fundingFade: true, vetoes: ['counter-trend funding fade — SWING matrix ' + m.passed + '/' + m.gatesTotal] });
    }
    return out;
  }

  function cgTryScalpFundingFade(h1, m15, ticker, m){
    if (!m || !m.dir) return null;
    var fadeDir = cgFundingFadeDir(ticker, m.dir);
    if (!fadeDir || !cgMacroOk(ticker, fadeDir)) return null;
    var g4fail = false;
    for (var gi = 0; gi < (m.gates || []).length; gi++){
      var g = m.gates[gi];
      if (!g[1] && g[0] === 'G4 funding') g4fail = true;
    }
    var fr = ticker && ticker.fundingPct !== null ? Math.abs(+ticker.fundingPct) : 0;
    if (!g4fail && fr < CG_FUND_HARD - 1e-9) return null;
    var cls = cgPositioningCls(ticker);
    var sp = cgBuildFadePlan(cls, h1, m15, fadeDir);
    if (!sp) return null;
    var out = {
      sym: ticker && ticker.symbol, dir: fadeDir,
      entry: sp.entry, stop: sp.stop, t1: sp.t1, t2: sp.t2, rr: sp.rr1,
      m15: m15, r15: m.r15, a: m.a, mark: sp.entry,
      fundingFade: true, planSrc: 'funding fade', type: 'FADE',
      entryType: 'FUNDING-FADE · scalp fade', note: sp.note || 'crowded funding fade'
    };
    if (typeof hgSetupStackAttach === 'function'){
      hgSetupStackAttach(out, { style: 'scalp', rows4h: h1, rows: m15, ticker: ticker,
        gatesPassed: m.passed, gatesTotal: m.gatesTotal, clean: false, nearClean: false,
        fundingFade: true, vetoes: ['counter-trend funding fade — SCALP matrix ' + m.passed + '/' + m.gatesTotal] });
    }
    return out;
  }

  function cgCryptoKillzone(){
    try{
      var d = new Date();
      var h = d.getUTCHours() + d.getUTCMinutes() / 60;
      if (h >= 7 && h < 10) return { name: 'LONDON', kz: true };
      if (h >= 12 && h < 15) return { name: 'NY', kz: true };
      return { name: 'OFF', kz: false };
    }catch(e){ return { name: 'OFF', kz: false }; }
  }

  function cgSessionOrbBreak(m15, dir){
    try{
      dir = String(dir || '').toLowerCase();
      if (!m15 || m15.length < 20) return { ok: false, detail: 'n/a' };
      var sess = cgCryptoKillzone();
      if (!sess.kz) return { ok: false, detail: 'outside London/NY kill zone' };
      var orFn = (typeof G.goldOpeningRange === 'function') ? G.goldOpeningRange : null;
      if (!orFn) return { ok: false, detail: 'opening-range helper unavailable' };
      var or = orFn(m15, sess.name === 'LONDON' ? 'london' : 'ny');
      if (!or || !(or.hi > or.lo)) return { ok: false, detail: sess.name + ' OR not built yet' };
      if (dir === 'long' && or.state === 'LONG_BREAK') return { ok: true, detail: or.session + ' OR break above ' + or.hi.toFixed(4) };
      if (dir === 'short' && or.state === 'SHORT_BREAK') return { ok: true, detail: or.session + ' OR break below ' + or.lo.toFixed(4) };
      return { ok: false, detail: or.session + ' OR inside ' + or.lo.toFixed(4) + '–' + or.hi.toFixed(4) };
    }catch(e){ return { ok: false, detail: 'n/a' }; }
  }

  function cgMacroOk(sym, dir){
    if (typeof G.hgMacroAllowsCrypto !== 'function') return true;
    var mac = G.hgMacroAllowsCrypto(sym && (sym.symbol || sym), dir);
    return mac && mac.allow !== false;
  }

  function swingGateMatrix(rows, ticker, opts){
    var swingLook = (opts && opts.swingLook > 1) ? Math.floor(opts.swingLook) : CG_SWING_LOOK;
    if (!rows || rows.length < 210) return null;
    var c = rows.map(function(r){ return r.c; });
    var e9 = last(ema(c, 9)), e21 = last(ema(c, 21)), e50 = last(ema(c, 50)), e200 = last(ema(c, 200));
    var p = last(c), r14 = last(rsi(c, 14)), vz = volZ(rows, 20);
    var dir = null;
    if (e9 > e21 && e21 > e50) dir = 'long';
    else if (e9 < e21 && e21 < e50) dir = 'short';
    if (!dir) return { dir: null, gates: [], passed: 0, gatesTotal: 7, level: null, clean: false };

    var sgFn = (typeof G.hgStructureGate === 'function') ? G.hgStructureGate
             : (typeof hgStructureGate === 'function') ? hgStructureGate : null;
    if (sgFn){
      try{
        var sg0 = sgFn(rows, dir);
        if (sg0 && sg0.veto){
          return { dir: null, gates: [], passed: 0, gatesTotal: 7, level: null, clean: false,
            structureVeto: true, structureNote: sg0.note || ('CHoCH against ' + dir + ' cascade') };
        }
      }catch(e){}
    }
    var drFn = (typeof G.detectRegime === 'function') ? G.detectRegime
             : (typeof detectRegime === 'function') ? detectRegime : null;
    if (drFn){
      try{
        var dr0 = drFn(rows);
        if (dr0 && dr0.regime === 'compression'){
          return { dir: null, gates: [], passed: 0, gatesTotal: 7, level: null, clean: false,
            regimeVeto: true, regimeNote: dr0.label || 'compression chop' };
        }
      }catch(e){}
    }

    var a4 = last(atr(rows, 14));
    var gates = [];
    var g1 = isFinite(a4) && Math.abs(e21 - e50) >= CG_G1_SPREAD_ATR * a4;
    gates.push(['G1 cascade+spread', g1]);
    var g2 = dir === 'long' ? p > e200 : p < e200;
    gates.push(['G2 HTF side', g2]);
    var g3 = !((dir === 'long' && r14 > 70) || (dir === 'short' && r14 < 30));
    gates.push(['G3 RSI', g3]);
    var g4 = true;
    if (ticker && ticker.fundingPct !== null){
      var fr = ticker.fundingPct;
      /* DIRECTIONAL. The old |fr| <= 0.05 cap vetoed a LONG at funding -0.06%
         — shorts paying you, on a setup where short crowding is squeeze fuel.
         That filtered out the better longs, not the worse ones. Veto only when
         funding runs AGAINST the trade; the absolute bound is now a data-sanity
         check for a broken feed. */
      var frAgainst = (dir === 'long' && fr >= CG_FUND_DIR) || (dir === 'short' && fr <= -CG_FUND_DIR);
      g4 = isFinite(fr) && Math.abs(fr) <= CG_FUND_SANITY && !frAgainst;
    }
    gates.push(['G4 funding', g4]);
    var g5r = (typeof hgSwingG5OK === 'function')
      ? hgSwingG5OK(dir, rows, c, r14, vz)
      : (function(){
          var currentBar = rows[rows.length - 1];
          var range = currentBar.h - currentBar.l;
          var closePos = range > 0 ? (currentBar.c - currentBar.l) / range : 0.5;
          var closeOK = dir === 'long' ? closePos >= 0.60 : closePos <= 0.40;
          var _rA = rsi(c, 14);
          var _rP = _rA[_rA.length - 4];
          var slopeOK = isFinite(_rP) ? (dir === 'long' ? r14 > _rP : r14 < _rP) : false;
          var volOK = isFinite(vz) && vz > CG_G5_VZ_MIN;
          if (isFinite(vz) && vz <= -1.5 && !closeOK) return { ok: false, closeOK: closeOK, quiet: false };
          var ok = closeOK && (volOK || slopeOK);
          return { ok: ok, closeOK: closeOK, quiet: !volOK && ok };
        })();
    var g5 = g5r.ok;
    gates.push(['G5 vol+wick', g5]);
    var stop = lastSwing(rows, dir, swingLook);
    var entry = p;
    /* G6 is a VETO, never an adjustment. The stop stays where structure put it;
       if structure is wider than EXP/RR_MIN ATR the setup fails honestly. */
    var risk = Math.abs(entry - stop);
    var expAtr = CG_SWING_EXP_ATR;
    var drG6Fn = (typeof G.detectRegime === 'function') ? G.detectRegime
               : (typeof detectRegime === 'function') ? detectRegime : null;
    if (drG6Fn){
      try{
        var drG6 = drG6Fn(rows);
        if (drG6 && drG6.regime === 'weak_trend') expAtr = 3.0;
        else if (drG6 && drG6.regime === 'volatile') expAtr = 4.0;
      }catch(e){}
    }
    var expectedMove = a4 * expAtr;
    var dynamicRR = (isFinite(a4) && a4 > 0 && risk > 0) ? expectedMove / risk : 0;
    var rrMin = CG_SWING_RR_MIN;
    if (typeof G.hgRegimeResolveState === 'function' && typeof G.hgRegimeAdjust === 'function'){
      try{
        var rsAdj = G.hgRegimeAdjust({ minRR: CG_SWING_RR_MIN }, G.hgRegimeResolveState().score, 'crypto');
        rrMin = rsAdj.thresholds.minRR;
      }catch(eR){}
    }
    var g6 = dynamicRR >= rrMin;
    gates.push(['G6 R:R≥' + (isFinite(rrMin) ? rrMin.toFixed(1) : CG_SWING_RR_MIN), g6]);
    var ev = cusumLast(c.slice(-120), 1);
    var g7 = !(ev && ev.barsAgo <= 20 && ev.dir !== dir);
    gates.push(['G7 CUSUM', g7]);
    var passed = gates.filter(function(g){ return g[1]; }).length;
    var distToAnchor = isFinite(a4) ? Math.abs(p - e21) / a4 : NaN;
    var anchorOK = isFinite(distToAnchor) && distToAnchor <= CG_SWING_ANCHOR_ATR;
    var clean = passed >= 7 && anchorOK;
    /* ===================== GATE CLEARANCE =====================
       A pass/fail badge cannot separate a setup that cleared every gate with
       room from one that scraped through three of them, and those are not the
       same conviction. Each margin below is the RAW distance to that gate's
       own threshold, in that gate's own unit — no composite, no weighting.
       Measured context (20,910 aligned cascades): G3 and ANCHOR jointly block
       ZERO setups the other six do not already block, because G6's risk cap
       (risk <= EXP/RR_MIN x ATR) already forces price to sit near structure.
       They are consequences of G6, not independent confirmations, so they are
       flagged `implied` and kept OUT of the binding count instead of inflating
       it. They stay visible — an implied fact is still worth seeing, it just
       must not be counted as a separate confirmation. */
    var margins = [];
    function mg(name, ok, margin, unit, tight, implied){
      margins.push({ gate: name, ok: !!ok, margin: isFinite(margin) ? margin : null,
                     unit: unit, tight: !!tight, implied: !!implied });
    }
    var spreadAtr = (isFinite(a4) && a4 > 0) ? Math.abs(e21 - e50) / a4 : NaN;
    mg('G1', g1, spreadAtr - CG_G1_SPREAD_ATR, 'ATR of E21-E50 spread past the floor',
       spreadAtr < CG_G1_SPREAD_ATR * 1.5);
    var htfAtr = (isFinite(a4) && a4 > 0) ? Math.abs(p - e200) / a4 : NaN;
    mg('G2', g2, htfAtr, 'ATR past EMA200', htfAtr < 0.5);
    var rsiRoom = (dir === 'long') ? (70 - r14) : (r14 - 30);
    mg('G3', g3, rsiRoom, 'RSI points from the band', rsiRoom < 5, true);
    var frNow = (ticker && ticker.fundingPct !== null && ticker.fundingPct !== undefined
                 && isFinite(ticker.fundingPct)) ? ticker.fundingPct : null;
    var frRoom = (frNow === null) ? NaN : ((dir === 'long') ? (CG_FUND_DIR - frNow) : (frNow + CG_FUND_DIR));
    mg('G4', g4, frRoom, '% funding from the against-side veto', isFinite(frRoom) && frRoom < 0.01);
    mg('G5', g5, isFinite(vz) ? vz - CG_G5_VZ_MIN : NaN, 'volume z above the floor',
       isFinite(vz) && vz >= CG_G5_VZ_MIN && vz - CG_G5_VZ_MIN < 0.25);
    mg('G6', g6, dynamicRR - CG_SWING_RR_MIN, 'R above the R:R floor',
       dynamicRR - CG_SWING_RR_MIN < CG_SWING_RR_MIN * 0.10);
    /* G7 margin = how far the last OPPOSING CUSUM break is past the 20-bar
       veto window. No opposing break at all is unbounded clearance, reported
       as null rather than a made-up large number. */
    var oppose = (ev && ev.dir !== dir) ? ev : null;
    mg('G7', g7, oppose ? (oppose.barsAgo - 20) : NaN,
       'bars past the opposing-CUSUM veto window',
       !!oppose && oppose.barsAgo - 20 < 5);
    mg('ANCHOR', anchorOK, CG_SWING_ANCHOR_ATR - distToAnchor, 'ATR of room before the anchor cap',
       CG_SWING_ANCHOR_ATR - distToAnchor < 0.25, true);
    var tightList = margins.filter(function(x){ return x.ok && x.tight && !x.implied; });
    return {
      dir: dir, gates: gates, passed: passed, gatesTotal: 7,
      level: isFinite(e21) ? e21 : p, clean: clean,
      p: p, e9: e9, e21: e21, a4: a4, r14: r14, vz: vz,
      stop: stop, entry: entry, risk: risk, expectedMove: expectedMove,
      dynamicRR: dynamicRR, ev: ev, anchorOK: anchorOK, rows: rows,
      margins: margins,
      tightCount: tightList.length,
      tightGates: tightList.map(function(x){ return x.gate; }),
      bindingTotal: margins.filter(function(x){ return !x.implied; }).length,
      e50: e50, e200: e200, fr: frNow
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
    var orb = cgSessionOrbBreak(m15, dir);
    var vwr = (typeof vwapReclaim === 'function') ? vwapReclaim(m15, 20, dir) : { ok: false };
    var g2 = (swept && reclaimed) || pullbackHold || orb.ok || (vwr && vwr.ok);
    var g2Detail = (swept && reclaimed) ? 'sweep+reclaim'
      : (pullbackHold ? 'EMA21 hold' : (orb.ok ? orb.detail : (vwr && vwr.ok ? vwr.detail : 'no trigger')));
    var r15 = last(rsi(c15, 14));
    var g3 = dir === 'long' ? (r15 >= 40 && r15 <= 65) : (r15 >= 35 && r15 <= 60);
    var g4 = true;
    if (ticker && ticker.fundingPct !== null){
      var fr = ticker.fundingPct;
      /* DIRECTIONAL. The old |fr| <= 0.05 cap vetoed a LONG at funding -0.06%
         — shorts paying you, on a setup where short crowding is squeeze fuel.
         That filtered out the better longs, not the worse ones. Veto only when
         funding runs AGAINST the trade; the absolute bound is now a data-sanity
         check for a broken feed. */
      var frAgainst = (dir === 'long' && fr >= CG_FUND_DIR) || (dir === 'short' && fr <= -CG_FUND_DIR);
      g4 = isFinite(fr) && Math.abs(fr) <= CG_FUND_SANITY && !frAgainst;
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
    var g6 = (vz > CG_G5_VZ_MIN) && closeOK;
    var entry = c15[n - 1];
    var stop = (swept && reclaimed)
      ? (dir === 'long' ? localLow - (a * 0.5) : localHigh + (a * 0.5))
      : (dir === 'long' ? Math.min.apply(null, m15.slice(n - 8, n - 1).map(function(r){ return r.l; })) - (a * 0.5)
        : Math.max.apply(null, m15.slice(n - 8, n - 1).map(function(r){ return r.h; })) + (a * 0.5));
    var risk = Math.abs(entry - stop);
    var expectedMove = a * 2.5;
    var dynamicRR = risk > 0 ? expectedMove / risk : 0;
    var g7 = dynamicRR >= CG_SCALP_RR_MIN;
    var gates = [
      ['G1 1H trend', true],
      ['G2 sweep/reclaim · ORB · VWAP', g2],
      ['G3 RSI band', g3],
      ['G4 funding', g4],
      ['G5 settle>25m', g4b],
      ['G6 vol+wick commit', g6 && closeOK],
      ['G7 ' + CG_SCALP_RR_MIN + 'R vol-capped', g7]
    ];
    var passed = gates.filter(function(g){ return g[1]; }).length;
    var t1 = dir === 'long' ? entry + expectedMove : entry - expectedMove;
    var t2 = dir === 'long' ? entry + (a * 4) : entry - (a * 4);
    return {
      dir: dir, gates: gates, passed: passed, gatesTotal: 7,
      level: entry, clean: passed >= 7,
      entry: entry, stop: stop, t1: t1, t2: t2, dynamicRR: dynamicRR,
      r15: r15, a: a, m15: m15, h1: h1, swept: swept, reclaimed: reclaimed,
      localLow: localLow, localHigh: localHigh,
      e21: e21a[n], mark: c15[n - 1], g2Detail: g2Detail,
      orb: orb, vwapReclaim: vwr
    };
  }

  function swingTryClean(rows, ticker){
    var m = swingGateMatrix(rows, ticker);
    /* CONTRACT: a non-null return from swingTryClean is a 7/7 CLEAN TREND
       ticket in the cascade direction. BEST, SWING, STARTRADER and
       hgSwingCleanPlan all rely on that. The funding fade is a counter-trend
       trade off a FAILED matrix — it is exposed as swingTryFundingFade() and
       must never leak out of here. */
    if (!m || !m.dir || !m.clean) return null;
    var dir = m.dir, p = m.p, e9 = m.e9, e21 = m.e21, a4 = m.a4;
    if (!cgMacroOk(ticker, dir)) return null;
    var plannedEntry = p;
    var entryType = 'MARKET';
    var distToFast = Math.abs(p - e9) / a4;
    if (distToFast > 0.25){
      plannedEntry = dir === 'long' ? Math.min(p, e9) : Math.max(p, e9);
      entryType = 'LIMIT @ EMA9';
    }
    var entry = plannedEntry;
    var stop = m.stop;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    var expectedMove = a4 * CG_SWING_EXP_ATR;
    var maxExcursion = a4 * CG_SWING_MAX_EXC_ATR;
    var t1 = dir === 'long' ? entry + expectedMove : entry - expectedMove;
    var t2 = dir === 'long' ? entry + maxExcursion : entry - maxExcursion;
    var dynamicRR = expectedMove / risk;
    if (!(dynamicRR >= CG_SWING_RR_MIN)) return null;
    if (typeof cascadeAge === 'function' && m.rows && m.rows.length){
      var cAge = cascadeAge(m.rows.map(function(r){ return r.c; }), dir);
      if (isFinite(cAge) && cAge < CG_SWING_CASCADE_MIN) return null;
    }
    var out = { sym: ticker && ticker.symbol, dir: dir, entry: entry, stop: stop, t1: t1, t2: t2,
      rr: dynamicRR, entryType: entryType, rows: m.rows, r14: m.r14, vz: m.vz, ev: m.ev, mark: p,
      /* clearance travels WITH the ticket: 58% of 7/7 CLEAN setups scrape at
         least one binding gate, and the badge alone cannot show which. */
      margins: m.margins, tightCount: m.tightCount, tightGates: m.tightGates,
      bindingTotal: m.bindingTotal };
    if (typeof hgEnrichSwingClean === 'function'){
      var enriched = hgEnrichSwingClean(out, rows, m);
      if (enriched) out = enriched;
    }
    if (typeof hgApplyExactEntry === 'function'){
      var exact = hgApplyExactEntry(out, rows, { style: 'swing', preferEdge: false });
      if (exact) out = exact;
    }
    if (typeof hgSwingPostEnrichValid === 'function'){
      out = hgSwingPostEnrichValid(out, { rows: rows, a4: a4, minRr: CG_SWING_RR_MIN, expMult: CG_SWING_EXP_ATR });
      if (!out) return null;
    }
    if (typeof hgSetupStackAttach === 'function'){
      hgSetupStackAttach(out, { style: 'swing', rows4h: rows, ticker: ticker, gatesPassed: 7, gatesTotal: 7, clean: true });
    }
    return out;
  }

  function scalpTryClean(h1, m15, ticker, minsToFunding){
    var m = scalpGateMatrix(h1, m15, ticker, minsToFunding);
    if (!m || !m.dir || !m.clean) return null;
    if (!cgMacroOk(ticker, m.dir)) return null;
    var sweepLevel = (m.swept && m.reclaimed)
      ? (m.dir === 'long' ? m.localLow : m.localHigh) : null;
    var out = { sym: ticker && ticker.symbol, dir: m.dir, entry: m.entry, stop: m.stop,
      t1: m.t1, t2: m.t2, rr: m.dynamicRR, m15: m.m15, r15: m.r15, a: m.a,
      swept: m.swept, reclaimed: m.reclaimed, sweepLevel: sweepLevel,
      e21: m.e21, mark: m.mark || m.entry };
    if (typeof hgEnrichScalpExact === 'function'){
      var enriched = hgEnrichScalpExact(out, m15, {});
      if (enriched) out = enriched;
    } else if (typeof hgApplyExactEntry === 'function'){
      out = hgApplyExactEntry(Object.assign({ type: 'SCALP' }, out), m15, { style: 'scalp', m15: m15 }) || out;
    }
    if (typeof hgScalpPostEnrichValid === 'function'){
      out = hgScalpPostEnrichValid(out, { rows: m15, a: m.a, minRr: CG_SCALP_RR_MIN });
      if (!out) return null;
    }
    if (typeof hgSetupStackAttach === 'function'){
      hgSetupStackAttach(out, { style: 'scalp', rows4h: h1, rows1h: h1, rows: m15, ticker: ticker, gatesPassed: m.passed, gatesTotal: m.gatesTotal, clean: true });
    }
    return out;
  }

  /* Draft ENTRY/STOP/T1/T2 from a swing matrix. Does not decide CLEAN vs
     NEAR — callers keep those thresholds. Stop still comes from the matrix
     (structure); T1/T2 stay on the 3.5× / 4.9× ATR ladder. */
  function cgDraftSwingLevels(m){
    if (!m || !m.dir) return null;
    var dir = m.dir, p = m.p, e9 = m.e9, a4 = m.a4;
    var entry = p;
    var distToFast = isFinite(a4) && a4 > 0 ? Math.abs(p - e9) / a4 : NaN;
    if (isFinite(distToFast) && distToFast > 0.25){
      entry = dir === 'long' ? Math.min(p, e9) : Math.max(p, e9);
    }
    var stop = m.stop;
    if (isFinite(a4) && a4 > 0 && Math.abs(entry - stop) > 2.0 * a4){
      stop = dir === 'long' ? entry - 2.0 * a4 : entry + 2.0 * a4;
    }
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    var expectedMove = (isFinite(a4) && a4 > 0) ? a4 * 3.5 : risk * 2;
    var maxExcursion = (isFinite(a4) && a4 > 0) ? a4 * 4.9 : risk * 3;
    var t1 = dir === 'long' ? entry + expectedMove : entry - expectedMove;
    var t2 = dir === 'long' ? entry + maxExcursion : entry - maxExcursion;
    return { dir: dir, entry: entry, stop: stop, t1: t1, t2: t2, rr: expectedMove / risk, mark: p };
  }

  function swingTryNear(rows, ticker){
    var m = swingGateMatrix(rows, ticker);
    if (!m || !m.dir || m.clean) return null;
    if (m.passed < 6) return null;
    var distToAnchor = isFinite(m.a4) ? Math.abs(m.p - m.e21) / m.a4 : NaN;
    var anchorOK = isFinite(distToAnchor) && distToAnchor <= CG_SWING_ANCHOR_ATR;
    /* 6/7 must be anchor-close; 7/7 with only anchor miss still gets levels + Telegram NEAR row */
    if (!anchorOK && m.passed < 7) return null;
    var missing = m.gates.filter(function(g){ return !g[1]; }).map(function(g){ return g[0]; });
    if (!anchorOK && m.passed >= 7) missing.push('EMA21 anchor (>1.25×ATR away)');
    var lv = cgDraftSwingLevels(m);
    if (!lv) return null;
    var near = {
      sym: ticker && ticker.symbol, dir: lv.dir, passed: m.passed, gatesPassed: m.passed,
      gatesTotal: m.gatesTotal, missing: missing, rows: m.rows, r14: m.r14, vz: m.vz, mark: lv.mark,
      level: m.level, dynamicRR: lv.rr, nearClean: true,
      entry: lv.entry, stop: lv.stop, t1: lv.t1, t2: lv.t2, rr: lv.rr
    };
    if (typeof hgSetupStackAttach === 'function'){
      hgSetupStackAttach(near, { style: 'swing', rows4h: rows, ticker: ticker, nearClean: true, gatesPassed: m.passed, gatesTotal: m.gatesTotal });
    }
    return near;
  }

  /* Shared 7-gate eval — single source for SWING tab, BEST (swingTryClean), ENGINE parity */
  function swingSevenGateCheck(rows, ticker){
    var m = swingGateMatrix(rows, ticker);
    if (!m) return { ok: false, reason: 'insufficient 4H history', matrix: null };
    if (!m.dir) return { ok: false, reason: 'EMA9/21/50 mixed — no cascade', matrix: m };
    var fail = null;
    for (var gi = 0; gi < (m.gates || []).length; gi++){
      if (!m.gates[gi][1]){ fail = m.gates[gi][0]; break; }
    }
    if (fail) return { ok: false, reason: fail + ' failed', matrix: m, failedGate: fail };
    if (!m.anchorOK) return { ok: false, reason: 'EMA21 anchor >' + CG_SWING_ANCHOR_ATR + '×ATR — anti-chase', matrix: m, failedGate: 'anchor' };
    return { ok: true, dir: m.dir, matrix: m, reason: 'SWING 7/7 + anchor (cryptogates)' };
  }

  function scalpTryNear(h1, m15, ticker, minsToFunding){
    var m = scalpGateMatrix(h1, m15, ticker, minsToFunding);
    if (!m || !m.dir || m.clean) return null;
    if (m.passed < 6) return null;
    var missing = m.gates.filter(function(g){ return !g[1]; }).map(function(g){ return g[0]; });
    var near = {
      sym: ticker && ticker.symbol, dir: m.dir, passed: m.passed, gatesPassed: m.passed,
      gatesTotal: m.gatesTotal, missing: missing, rows: m.m15 || m15, r14: m.r15, vz: null, mark: m.mark,
      level: m.level, dynamicRR: m.dynamicRR, nearClean: true,
      entry: m.entry, stop: m.stop, t1: m.t1, t2: m.t2, rr: m.dynamicRR
    };
    if (typeof hgSetupStackAttach === 'function'){
      hgSetupStackAttach(near, { style: 'scalp', rows4h: h1, rows: m15, ticker: ticker, nearClean: true, gatesPassed: m.passed, gatesTotal: m.gatesTotal });
    }
    return near;
  }

  /* One closest ≥5/7 draft for the MOST PROBABLE banner when CLEAN and
     NEAR are empty. Not a ticket. Does not change swingTryNear (still 6/7). */
  function swingTryClosest(rows, ticker){
    var m = swingGateMatrix(rows, ticker);
    if (!m || !m.dir || m.clean) return null;
    if (m.passed < 5) return null;
    var lv = cgDraftSwingLevels(m);
    if (!lv) return null;
    var missing = (m.gates || []).filter(function(g){ return !g[1]; }).map(function(g){ return g[0]; });
    if (!m.anchorOK) missing.push('EMA21 anchor');
    return {
      sym: ticker && ticker.symbol, dir: lv.dir, passed: m.passed, gatesPassed: m.passed,
      gatesTotal: m.gatesTotal, missing: missing, forming: true, nearClean: false,
      entry: lv.entry, stop: lv.stop, t1: lv.t1, t2: lv.t2, rr: lv.rr, mark: lv.mark
    };
  }

  function scalpTryClosest(h1, m15, ticker, minsToFunding){
    var m = scalpGateMatrix(h1, m15, ticker, minsToFunding);
    if (!m || !m.dir || m.clean) return null;
    if (m.passed < 5) return null;
    if (!(isFinite(m.entry) && isFinite(m.stop) && isFinite(m.t1) && m.entry !== m.stop)) return null;
    var missing = (m.gates || []).filter(function(g){ return !g[1]; }).map(function(g){ return g[0]; });
    return {
      sym: ticker && ticker.symbol, dir: m.dir, passed: m.passed, gatesPassed: m.passed,
      gatesTotal: m.gatesTotal, missing: missing, forming: true, nearClean: false,
      entry: m.entry, stop: m.stop, t1: m.t1, t2: m.t2, rr: m.dynamicRR, mark: m.mark
    };
  }

  /* Pure formatter — plain text so it works in a card, a Telegram alert or a
     console line. Returns '' when clearance was never computed, so an older
     ticket shape degrades to silence rather than to a fake all-clear. */
  function cgClearanceLine(o){
    try{
      if (!o || !Array.isArray(o.margins) || !o.margins.length) return '';
      var total = isFinite(o.bindingTotal) ? o.bindingTotal : 6;
      var tight = isFinite(o.tightCount) ? o.tightCount : 0;
      if (tight === 0) return 'CLEARANCE — all ' + total + ' binding gates cleared with room';
      var names = (o.tightGates || []).join(', ');
      return 'CLEARANCE — ' + tight + ' of ' + total + ' binding gates only just cleared ('
        + names + '). Same badge, thinner setup.';
    }catch(e){ return ''; }
  }
  G.cgClearanceLine = cgClearanceLine;
  /* ===================== SOLE BLOCKER =====================
     The scan funnel already tallies how many symbols each gate BLOCKS. That
     number cannot be acted on, because a gate that blocks a lot may be
     blocking symbols three other gates were failing anyway.
     Measured over 20,910 aligned cascades (27 CLEAN):
         gate     blocks    ONLY blocker
         G6        20153        1795
         G5        13169          50
         G7         8138           9
         ANCHOR     7453           0   <- relaxing it adds NOTHING
         G4         4221           5
         G3         4016           0   <- relaxing it adds NOTHING
         G2         2035           3
         G1         1728           4
     ANCHOR and G3 look like major constraints in the left column and are
     worth exactly zero setups in the right one. G6 is the only real lever.
     Relaxing a gate is only worth considering when its SOLE count is large.
     Returns the one gate holding a setup back, or null when zero or several
     gates failed. The EMA21 anchor is included because `clean` requires it. */
  function cgSoleBlocker(m){
    try{
      if (!m || !m.dir || !Array.isArray(m.gates)) return null;
      if (m.clean) return null;
      var failed = [];
      for (var i = 0; i < m.gates.length; i++){
        if (!m.gates[i][1]) failed.push(String(m.gates[i][0]).split(' ')[0]);
      }
      if (!m.anchorOK) failed.push('ANCHOR');
      return (failed.length === 1) ? failed[0] : null;
    }catch(e){ return null; }
  }
  /* ===================== IS ZERO NORMAL? =====================
     On 2026-08-08 the pipeline finally ran clean — degraded count 0, setups.at
     moving — and reported ZERO setups. For six packs before that I had read
     the same zero off a frozen field and called it a broken funnel.
     Measured at CG_SWING_LOOK 20 over 6,000 independent symbol snapshots, the
     probability that any one symbol is a live ticket at any one instant is
     0.500%. Which means:
         universe   expected tickets/scan   P(scan returns ZERO)
             40            0.20                    81.8%
             87            0.43                    64.7%
            200            1.00                    36.7%
     On a Delta-sized universe, ZERO IS THE SINGLE MOST LIKELY OUTCOME OF ANY
     GIVEN SCAN. A board showing nothing is the normal state of a selective
     system, and reading it as breakage — as I did, repeatedly — is a mistake
     the UI was actively inviting by displaying a bare 0.
     So this converts the count into a bounded statement using the scan's own
     numbers rather than my synthetic constant. With 0 of 87 the Wilson upper
     bound says the true per-scan rate is at most ~4%, which is a fact; "the
     funnel is broken" is not.
     The rate worth judging is per DAY, not per scan. */
  var CG_SYNTHETIC_TICKET_RATE = 0.005;   /* measured, see table above */
  function cgScanRateNote(universe, clean){
    try{
      var u = Math.floor(+universe), c = Math.floor(+clean);
      if (!(isFinite(u) && u > 0)) return '';
      if (!(isFinite(c) && c >= 0)) c = 0;
      /* Wilson 95% on the observed rate — with c = 0 the lower bound is 0 and
         the UPPER bound is the informative half. */
      var out = '';
      if (typeof hgWilson === 'function'){
        var w = hgWilson(c, u, 1.96);
        if (w && isFinite(w.hi)){
          out += 'observed ' + c + '/' + u + ' · 95% CI on the per-scan rate '
               + (100 * Math.max(0, w.lo)).toFixed(1) + '–' + (100 * w.hi).toFixed(1) + '%';
        }
      }
      var exp = u * CG_SYNTHETIC_TICKET_RATE;
      var pZero = Math.pow(1 - CG_SYNTHETIC_TICKET_RATE, u);
      out += (out ? ' · ' : '') + 'at the measured base rate expect ~' + exp.toFixed(2)
           + ' per scan, and ZERO on ' + (100 * pZero).toFixed(0) + '% of scans';
      if (c === 0 && pZero > 0.5) out += ' — zero here is the MOST LIKELY outcome, not a fault';
      return out;
    }catch(e){ return ''; }
  }
  G.cgScanRateNote = cgScanRateNote;
  G.CG_SYNTHETIC_TICKET_RATE = CG_SYNTHETIC_TICKET_RATE;
  G.cgSoleBlocker = cgSoleBlocker;
  /* ===================== WALK-FORWARD GATE REPLAY =====================
     Pack 17 answers "how many setups would relaxing this gate ADD".
     Pack 15 answers "what would a different stop have PAID".
     Neither answers the one that decides a threshold: BOTH AT ONCE.
     This replays the gate matrix bar by bar over history, with NO look-ahead —
     the matrix at bar i only ever sees rows[0..i] — records the RAW value each
     gate was measuring, and then settles the hypothetical trade against the
     bars that came after. One pass produces enough to re-derive what ANY
     threshold on those gates would have produced, in count AND in R.
     Raw values are stored, not pass/fail and not margins, so a sweep needs no
     knowledge of what the threshold was when the replay ran.
     Outcomes carry the ledger's discipline — a limit must be touched before
     stop or target are read, and a bar reaching both counts as the stop — but
     note the replay uses the MATRIX entry, which is the mark, NOT the EMA21
     limit hgEnrichSwingClean puts on a live ticket. That is deliberate: it
     isolates the GATE decision from fill behaviour, which is exactly what a
     threshold sweep needs, since otherwise a threshold change and a fill-rate
     change move together and neither can be read. The consequence is that
     replay expectancy is a MARKET-ENTRY figure and will differ from what your
     live limit tickets realise.
     Trades can overlap — the same leg may be sampled on several bars. That
     inflates n identically at every threshold, so comparisons hold while the
     absolute expectancy is optimistic. Stated rather than hidden. */
  function cgGateReplay(rows, ticker, opts){
    var out = { n: 0, aligned: 0, clean: 0, settled: 0, samples: [], note: '' };
    try{
      opts = opts || {};
      var warm = opts.warmup || 210;
      var horizon = opts.horizon || 84;          /* 84 x 4h = 14 days */
      var fillBars = opts.fillBars || 12;
      if (!Array.isArray(rows) || rows.length < warm + horizon + 5){
        out.note = 'needs ' + (warm + horizon + 5) + '+ bars, got ' + (rows ? rows.length : 0);
        return out;
      }
      for (var i = warm; i < rows.length - horizon; i++){
        out.n++;
        var hist = rows.slice(0, i + 1);
        var m = swingGateMatrix(hist, ticker, opts);
        if (!m || !m.dir) continue;
        out.aligned++;
        if (m.clean) out.clean++;
        var pass = {};
        for (var g = 0; g < m.gates.length; g++) pass[String(m.gates[g][0]).split(' ')[0]] = !!m.gates[g][1];
        pass.ANCHOR = !!m.anchorOK;
        var a4 = m.a4;
        var vals = {
          G1: (isFinite(a4) && a4 > 0) ? Math.abs(m.e21 - m.e50) / a4 : null,
          G3: (m.dir === 'long') ? (70 - m.r14) : (m.r14 - 30),
          G5: isFinite(m.vz) ? m.vz : null,
          G6: isFinite(m.dynamicRR) ? m.dynamicRR : null,
          ANCHOR: (isFinite(a4) && a4 > 0) ? Math.abs(m.p - m.e21) / a4 : null
        };
        var r = cgReplaySettle(rows, i, m.dir, m.entry, m.stop, m.t1 || null, horizon, fillBars, m);
        if (r.r !== null) out.settled++;
        out.samples.push({ i: i, dir: m.dir, pass: pass, vals: vals,
                           entry: m.entry, stop: m.stop, r: r.r, state: r.state });
        /* NON-OVERLAPPING samples. Advancing one bar at a time counted a gate
           that stays true across twenty bars of ONE move as twenty independent
           samples sharing a single outcome. Anything reading samples.length as
           a sample count — super-calibrate tunes thresholds on it — inherits a
           number several times larger than the evidence behind it. Measured on
           the identical flaw in omniroute: 94% of firings fell inside the
           previous signal's forward window, and correcting it moved a mechanic
           from "has paid" to "within noise".
           The skip is a FIXED cooldown, not "resume where the trade resolved".
           Resolution depends on future bars, so skipping to it would make the
           sample SET future-dependent — tests/test-gate-replay.mjs caught
           exactly that: gate verdicts stopped being invariant when the future
           was mutated. The verdicts themselves never looked ahead, but which
           bars got sampled did, and purged-cv/OOS downstream rely on that
           invariant. A fixed `horizon` cooldown is deterministic, guarantees
           no two counted trades share a forward window, and costs only some
           samples where a trade resolved early. */
        i += horizon;
      }
      out.note = out.aligned + ' aligned bars of ' + out.n + ' replayed · ' + out.clean
        + ' CLEAN · ' + out.settled + ' settled';
      return out;
    }catch(e){ out.note = 'replay failed: ' + (e && e.message); return out; }
  }
  /* forward settle from bar i+1; LIMIT fill required first */
  function cgReplaySettle(rows, i, dir, entry, stop, t1, horizon, fillBars, m){
    try{
      if (!isFinite(entry) || !isFinite(stop) || Math.abs(entry - stop) <= 0) return { r: null, state: 'no-plan', at: i };
      var risk = Math.abs(entry - stop);
      /* isFinite(null) === true in JS — null coerces to 0, which would make the
         target 0 and turn every long into an instant 7R "win". Same trap as the
         gold basis guard in pack 3; check the VALUE, not just finiteness.
         The target is the matrix's own ATR excursion, so the replay measures
         the ticket policy that actually ships. */
      var tgt;
      if (t1 !== null && t1 !== undefined && isFinite(t1) && t1 !== 0) tgt = t1;
      else if (m && isFinite(m.expectedMove) && m.expectedMove > 0) tgt = (dir === 'long') ? entry + m.expectedMove : entry - m.expectedMove;
      else tgt = (dir === 'long') ? entry + 2 * risk : entry - 2 * risk;
      if (!isFinite(tgt) || (dir === 'long' ? tgt <= entry : tgt >= entry)) return { r: null, state: 'bad-target', at: i };
      var filled = false, wait = 0;
      for (var k = i + 1; k <= i + horizon && k < rows.length; k++){
        var b = rows[k];
        if (!b) continue;
        if (!filled){
          var touched = (dir === 'long') ? b.l <= entry : b.h >= entry;
          if (touched) filled = true;
          else { wait++; if (wait >= fillBars) return { r: null, state: 'unfilled', at: k }; continue; }
        }
        var sl = (dir === 'long') ? b.l <= stop : b.h >= stop;
        var tp = (dir === 'long') ? b.h >= tgt : b.l <= tgt;
        if (sl) return { r: -1, state: 'SL', at: k };          /* same-bar -> SL, as the ledger does */
        if (tp) return { r: Math.abs(tgt - entry) / risk, state: 'TP', at: k };
      }
      return { r: null, state: filled ? 'open' : 'unfilled', at: Math.min(i + horizon, rows.length - 1) };
    }catch(e){ return { r: null, state: 'err', at: i }; }
  }
  /* What WOULD a different threshold on one gate have produced?
     dir: 'min' = value must be >= t (G1, G5, G6, G3)
          'max' = value must be <= t (ANCHOR) */
  function cgReplaySweep(replay, gate, thresholds, cmp){
    var out = { gate: gate, rows: [], note: '' };
    try{
      var samples = (replay && replay.samples) || [];
      if (!samples.length){ out.note = 'no replay samples'; return out; }
      var isMax = (cmp === 'max');
      for (var a = 0; a < thresholds.length; a++){
        var t = thresholds[a];
        var n = 0, settled = 0, sumR = 0, wins = 0;
        for (var s = 0; s < samples.length; s++){
          var smp = samples[s];
          var othersOk = true;
          for (var k in smp.pass){ if (k !== gate && !smp.pass[k]) { othersOk = false; break; } }
          if (!othersOk) continue;
          var v = smp.vals[gate];
          if (v === null || !isFinite(v)) continue;
          if (isMax ? !(v <= t) : !(v >= t)) continue;
          n++;
          if (smp.r !== null){ settled++; sumR += smp.r; if (smp.r > 0) wins++; }
        }
        out.rows.push({ t: t, setups: n, settled: settled,
                        hitPct: settled ? wins / settled : null,
                        expectancyR: settled ? sumR / settled : null });
      }
      out.note = samples.length + ' aligned samples swept on ' + gate;
      return out;
    }catch(e){ out.note = 'sweep failed'; return out; }
  }
  function cgReplaySweepTableHTML(sweep, label){
    try{
      if (!sweep || !Array.isArray(sweep.rows) || !sweep.rows.length) return '';
      var cap = label || ('Gate ' + (sweep.gate || ''));
      var h = '<table class="hg-replay-table" style="width:100%;border-collapse:collapse;font-size:10px;margin:8px 0">'
        + '<caption style="text-align:left;font-weight:800;letter-spacing:.08em;margin-bottom:4px">' + cap + '</caption>'
        + '<thead><tr style="border-bottom:1px solid var(--line,#E2E8F0)">'
        + '<th style="text-align:left;padding:4px 6px">threshold</th>'
        + '<th style="text-align:right;padding:4px 6px">setups</th>'
        + '<th style="text-align:right;padding:4px 6px">hit%</th>'
        + '<th style="text-align:right;padding:4px 6px">E[R]</th></tr></thead><tbody>';
      for (var i = 0; i < sweep.rows.length; i++){
        var r = sweep.rows[i];
        var hit = (r.hitPct !== null && isFinite(r.hitPct)) ? (r.hitPct * 100).toFixed(1) + '%' : '—';
        var er = (r.expectancyR !== null && isFinite(r.expectancyR)) ? r.expectancyR.toFixed(3) : '—';
        var cur = (sweep.gate === 'G6' && Math.abs(r.t - CG_SWING_RR_MIN) < 1e-9)
          || (sweep.gate === 'G5' && Math.abs(r.t - CG_G5_VZ_MIN) < 1e-9)
          || (sweep.gate === 'ANCHOR' && Math.abs(r.t - CG_SWING_ANCHOR_ATR) < 1e-9);
        h += '<tr' + (cur ? ' style="background:#FFFBEB;font-weight:700"' : '') + '>'
          + '<td style="padding:4px 6px">' + r.t + (cur ? ' ← current' : '') + '</td>'
          + '<td style="text-align:right;padding:4px 6px">' + r.setups + '</td>'
          + '<td style="text-align:right;padding:4px 6px">' + hit + '</td>'
          + '<td style="text-align:right;padding:4px 6px">' + er + '</td></tr>';
      }
      return h + '</tbody></table>';
    }catch(e){ return ''; }
  }
  function cgGateReplayPanelHTML(replay, soleMap){
    try{
      if (!replay || !Array.isArray(replay.samples) || !replay.samples.length) return '';
      soleMap = soleMap || {};
      var topGate = null, topN = 0;
      for (var k in soleMap){
        if (Object.prototype.hasOwnProperty.call(soleMap, k) && soleMap[k] > topN){
          topN = soleMap[k]; topGate = k;
        }
      }
      var gates = [{ gate: 'G6', thresholds: [1.50, 1.75, 2.00, 2.25, 2.50], cmp: 'min', label: 'G6 R:R floor' }];
      if (topGate && topGate !== 'G6'){
        if (topGate === 'G5') gates.push({ gate: 'G5', thresholds: [0.00, 0.25, 0.50, 0.75, 1.00], cmp: 'min', label: 'G5 vol-z floor (top ONLY blocker)' });
        else if (topGate === 'G1') gates.push({ gate: 'G1', thresholds: [0.10, 0.15, 0.20, 0.25, 0.30], cmp: 'min', label: 'G1 spread floor (top ONLY blocker)' });
        else gates.push({ gate: topGate, thresholds: [1.00, 1.50, 2.00], cmp: (topGate === 'ANCHOR' ? 'max' : 'min'), label: topGate + ' (top ONLY blocker)' });
      }
      gates.push({ gate: 'ANCHOR', thresholds: [1.00, 1.25, 1.50, 2.00, 3.00], cmp: 'max', label: 'ANCHOR EMA21 cap' });
      var body = '';
      for (var gi = 0; gi < gates.length; gi++){
        var g = gates[gi];
        var sw = cgReplaySweep(replay, g.gate, g.thresholds, g.cmp);
        body += cgReplaySweepTableHTML(sw, g.label);
      }
      return '<details class="hg-funnel" id="swingReplayPanel" style="margin:10px 0;padding:8px 12px;border:1px solid var(--line);border-radius:6px;background:var(--panel)">'
        + '<summary style="cursor:pointer;font-weight:800;letter-spacing:.06em">GATE REPLAY — threshold sweep (walk-forward · no look-ahead)</summary>'
        + '<div class="note" style="margin:8px 0;line-height:1.55">Replays ' + replay.samples.length
        + ' aligned bars from this scan\'s universe · ' + (replay.clean || 0) + ' CLEAN at current settings · '
        + (replay.settled || 0) + ' settled. Market-entry measure (matrix mark, not EMA21 limit). '
        + 'Overlapping samples inflate n equally at every threshold — compare curves, not absolute E[R]. '
        + (topGate ? ('Sweep highlights <b>' + topGate + '</b> (top ONLY blocker: ' + topN + ' symbols). ') : '')
        + 'Read count AND expectancy together before changing a constant.'
        + (typeof G.hgReplaySweepOos === 'function'
          ? (' OOS (70/30): ' + (function(){
              try{
                var o = G.hgReplaySweepOos(replay, 'G6', [1.50, 1.75, 2.00, 2.25, 2.50], 'min');
                return o.oos ? ('best G6≥' + o.oos.threshold + ' · test E[R] ' + (o.oos.expectancyR != null ? o.oos.expectancyR.toFixed(3) : '—') + ' · ' + o.oos.verdict) : 'n/a';
              }catch(e){ return 'n/a'; }
            })()) : '')
        + '</div>'
        + body + '</details>';
    }catch(e){ return ''; }
  }
  G.cgGateReplay = cgGateReplay;
  G.cgReplaySweep = cgReplaySweep;
  G.cgReplaySweepTableHTML = cgReplaySweepTableHTML;
  G.cgGateReplayPanelHTML = cgGateReplayPanelHTML;
  G.CG_SWING_RR_MIN = CG_SWING_RR_MIN;
  G.CG_G5_VZ_MIN = CG_G5_VZ_MIN;
  G.CG_G1_SPREAD_ATR = CG_G1_SPREAD_ATR;
  G.CG_SWING_ANCHOR_ATR = CG_SWING_ANCHOR_ATR;
  G.CG_SWING_LOOK = CG_SWING_LOOK;
  G.swingGateMatrix = swingGateMatrix;
  G.scalpGateMatrix = scalpGateMatrix;
  G.swingTryClean = swingTryClean;
  G.swingTryNear = swingTryNear;
  G.swingTryClosest = swingTryClosest;
  G.scalpTryNear = scalpTryNear;
  G.scalpTryClosest = scalpTryClosest;
  G.cgDraftSwingLevels = cgDraftSwingLevels;
  G.scalpTryClean = scalpTryClean;
  G.swingSevenGateCheck = swingSevenGateCheck;
  /* Counter-trend funding fade — NOT a clean swing/scalp ticket. Exposed so a
     caller can opt in deliberately; never returned by swingTryClean/scalpTryClean. */
  G.swingTryFundingFade = function(rows, ticker){
    var m = swingGateMatrix(rows, ticker);
    return m ? cgTrySwingFundingFade(rows, ticker, m) : null;
  };
  G.scalpTryFundingFade = function(h1, m15, ticker, minsToFunding){
    var m = scalpGateMatrix(h1, m15, ticker, minsToFunding);
    return m ? cgTryScalpFundingFade(h1, m15, ticker, m) : null;
  };
})();
