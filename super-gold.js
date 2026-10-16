/* =========================================================================
   HARDGATE — super-gold.js
   SUPER GOLD tab (id 'super-gold'): conviction desk merging GOLD SCALP + GOLD SWING.
   Grade-based tiers (A/B), goldAttachPositionSize, weekend/macro/spread audit.
   hg-v1005: the desk answers to the FUNDAMENTAL STACK (fundamental-stack.js) —
   a red-folder blackout refuses every fresh pick at superGoldEvaluate; the
   source desk's compact fund verdict (refuse / demote / chips) travels on
   the candidate through hitFromGoldCand, keeps a headwinded row off the
   pick in all three fallback loops, and renders as the per-card verdict
   chip plus the full gold board panel above the desk.
   Never throws at load time.
   ========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var TAB_ID = 'super-gold';
var SYNC_MS = 2500;
var SCAN_INTERVAL_MS = 10 * 60 * 1000;
var SNAP_MAX_MS = SCAN_INTERVAL_MS + 10 * 60 * 1000;
var __hgSuperGoldSnap = null;
var __sg = {
  mounted: false, syncTimer: null, scanTimer: null, root: null,
  lastKey: '', selectedId: null, scanBusy: false, lastScanAt: 0,
  scanPromise: null, lastScanMsg: '', selectedHit: null,
  dispatchedKeys: {}, lastDispatch: null,
  intelHealTimer: null, intelHealCount: 0
};

function N(v){ return Number(v); }

/* Number(null) and +null are both 0, so coercing before the finite test
   prints a confident zero for a value that is absent. Reject the empty
   values first. */
function fmt(n, d){
  if (n === null || n === undefined || n === '') return '—';
  d = (d === undefined) ? 2 : d;
  var x = N(n);
  return Number.isFinite(x) ? x.toFixed(d) : '—';
}

function isFreshAt(at, maxMs){
  maxMs = maxMs || SNAP_MAX_MS;
  return !!(at && (Date.now() - at) < maxMs);
}

function normalizeSide(raw){
  if (raw == null || raw === '') return null;
  var d = String(raw).toLowerCase();
  if (d === 'long' || d === 'buy' || d === 'bull' || d === 'bullish') return 'Long';
  if (d === 'short' || d === 'sell' || d === 'bear' || d === 'bearish') return 'Short';
  return null;
}

function pickRR(hit){
  var rr = N(hit && (hit.rr != null ? hit.rr : hit.rR));
  return (Number.isFinite(rr) && rr > 0) ? rr : null;
}

function calcTradeLocal(opts){
  opts = opts || {};
  var balance = N(opts.balance), riskPct = N(opts.riskPct);
  var entry = N(opts.entry), stop = N(opts.stop);
  var tpRR = N(opts.tpRR != null ? opts.tpRR : (opts.rr != null ? opts.rr : 2));
  var tpPrice = N(opts.tpPrice);
  if (![balance, riskPct, entry, stop, tpRR].every(Number.isFinite)){
    return { ok: false, reason: 'Missing or invalid inputs' };
  }
  var riskDollars = balance * (riskPct / 100);
  var stopDist = Math.abs(entry - stop);
  if (stopDist <= 0) return { ok: false, reason: 'Stop-loss must differ from entry' };
  var positionUnits = riskDollars / stopDist;
  var notional = positionUnits * entry;
  var tp = Number.isFinite(tpPrice) ? tpPrice
    : (entry > stop ? entry + stopDist * tpRR : entry - stopDist * tpRR);
  return {
    ok: true, reason: 'PASS', riskDollars: riskDollars, stopDist: stopDist,
    positionUnits: positionUnits, qty: positionUnits, notional: notional,
    impliedLeverage: notional / balance, impliedLev: notional / balance, tp: tp, rr: tpRR
  };
}

/** Spot gold sizing — never inherit crypto fee-buffer / 5x lev gate from supersetup calcTrade. */
function goldCalcTrade(riskOpts, hit, rrForCalc){
  var opts = {
    balance: riskOpts.balance,
    riskPct: riskOpts.riskPct,
    entry: hit.entry,
    stop: hit.stop,
    rr: rrForCalc,
    tpPrice: N(hit.t1) > 0 ? hit.t1 : null,
    maxLeverage: 30,
    feePct: 0,
    slipPct: 0
  };
  if (typeof W.calcTrade === 'function') return W.calcTrade(opts);
  return calcTradeLocal(opts);
}

function effectiveGoldRr(hit){
  if (hit && N(hit.t1) > 0 && N(hit.entry) > 0 && N(hit.stop) > 0){
    var riskDist = Math.abs(hit.entry - hit.stop);
    if (riskDist > 0) return Math.abs(hit.t1 - hit.entry) / riskDist;
  }
  return pickRR(hit);
}

function defaultRiskOpts(win){
  win = win || W;
  return {
    balance: N(win.__sgDefaultBalance != null ? win.__sgDefaultBalance : 1000),
    riskPct: N(win.__sgDefaultRiskPct != null ? win.__sgDefaultRiskPct : 1)
  };
}

function hitFromGoldCand(c, meta){
  if (!c || !c.dir) return null;
  var entry = N(c.entry);
  var stop = N(c.stop);
  if (!(entry > 0 && stop > 0)) return null;
  var tier = meta.tier || 'clean';
  return {
    sym: c.sym || c.symbol || 'XAUUSD',
    dir: c.dir,
    entry: entry,
    stop: stop,
    t1: N(c.t1),
    t2: N(c.t2),
    t3: N(c.t3),
    rr: N(c.rr),
    rr2: N(c.rr2),
    source: meta.source,
    tier: tier,
    trigger: meta.trigger || tier,
    clean: tier === 'clean',
    nearClean: tier === 'near',
    /* the mark the source desk sized this against — goldswing/goldscalp
       now carry it, and without forwarding it here super-gold cannot ask
       whether price already walked through the plan it is about to show. */
    mark: N(c.mark),
    barT: (c.barT != null && c.barT !== '') ? c.barT : null,
    signalT: (c.signalT != null && c.signalT !== '') ? c.signalT : null,
    t: (c.t != null && c.t !== '') ? c.t : null,
    venueTag: c.venue || meta.venueTag || null,
    id: c.id || null,
    at: meta.at || null,
    grade: c.grade,
    strategy: c.strategy,
    stratKey: c.stratKey,
    tally: c.tally,
    killzone: c.killzone,
    demoted: !!c.demoted,
    demoteReason: c.demoteReason || null,
    vetoed: !!c.vetoed,
    vetoReason: c.vetoReason || null,
    locked: !!c.locked,
    stamps: c.stamps || null,
    /* hg-v1005: the source desk's fundamental-stack verdict travels with the
       candidate exactly as published (refuse / demote / chips — the compact
       carry, never recomputed here), so the pick loops and the card chip
       hold THAT desk's read at THAT scan's instant. Same copy-forward
       pattern .smc already uses across this boundary. */
    fund: (c.fund && typeof c.fund === 'object')
      ? { refuse: !!c.fund.refuse, demote: !!c.fund.demote,
          chips: Array.isArray(c.fund.chips) ? c.fund.chips.slice() : [] }
      : null,
    scanner: meta.scanner || meta.source,
    scalpEnhancement: c.scalpEnhancement || null,
    scalpPrecision: c.scalpPrecision || null,
    scalpSizing: c.scalpSizing || null
  };
}

/** Map gold grade / demotion to desk tier. Returns null to skip row. */
function goldCandTier(c){
  if (!c || c.vetoed) return null;
  var g = String(c.grade || '').toUpperCase();
  if (c.demoted) return 'near';
  if (g === 'A') return 'clean';
  if (g === 'B') return 'near';
  if (g === 'C') return 'near';
  return null;
}

/** Gold desk audit — weekend, macro tilt, stand-down. Fail-closed for GRADE A trade-ready. */
/* hg-v952: the instant a gold candidate was FORMED ON, in seconds, read from
   whatever the desk that produced it recorded — never Date.now(). Returns
   null when nothing on the row carries a time, so the caller can say so
   rather than silently substituting the wall clock. `t` is seconds or
   milliseconds by the repo's usual convention; fin-first, because `+null` is
   0 and would read as 1970. */
function sgCandSec(c, hit){
  var srcs = [hit && hit.t, hit && hit.barT, hit && hit.at,
              c && c.t, c && c.barT, c && c.at, c && c.signalT];
  for (var i = 0; i < srcs.length; i++){
    var v = srcs[i];
    if (v === null || v === undefined || v === '') continue;
    var n = +v;
    if (!isFinite(n) || n <= 0) continue;
    return Math.floor(Math.abs(n) > 1e12 ? n / 1000 : n);
  }
  return null;
}
/* hg-v952: the route in ONE callable place, so the coverage reporter can
   CALL it with a known Saturday and a known Wednesday and verify it rather
   than take this file's word for it. Before this pack the reporter reported
   the `via` string an author typed; that is how a desk reading Date.now()
   came to be listed as covered. Delegates to hgInGoldWeekend, never
   re-derives the edges; null when the calendar or the instant is unreadable. */
function sgWeekendVerdict(tSec){
  try{
    var f = W.hgInGoldWeekend;
    if (typeof f !== 'function') return null;
    if (tSec === null || tSec === undefined || tSec === '') return null;
    var n = +tSec;
    if (!isFinite(n) || n <= 0) return null;
    var sec = Math.floor(Math.abs(n) > 1e12 ? n / 1000 : n);
    return f(sec) ? { inWeekend: true, atSec: sec,
      why: 'formed inside the gold weekend (Fri 22:00 - Sun 22:00 UTC, DST-aware)' } : null;
  }catch(e){ return null; }
}

function sgCandSecOr(c, hit){
  var t = sgCandSec(c, hit);
  return (t === null) ? Math.floor(Date.now() / 1000) : t;
}

function runGoldDeskAudit(win, c, hit){
  win = win || W;
  c = c || {};
  hit = hit || {};
  var reasons = [];
  var passed = [];
  var dir = String(hit.dir || '').toLowerCase();

  if (typeof win.hgStandDownState === 'function'){
    try{
      var recs = typeof win.hgScoreRecords === 'function' ? win.hgScoreRecords() : [];
      var sd = win.hgStandDownState(recs);
      if (sd && sd.tripped){
        reasons.push('STAND DOWN: ' + ((sd.reasons || []).join(' · ') || 'drawdown limit'));
      } else passed.push('stand-down');
    }catch(e0){}
  }

  /* hg-v952: THE SIGNAL BAR, NOT THE WALL CLOCK. This veto is real — it
     pushes a reason and stands the candidate down — and it read Date.now()
     at every site, which is wrong in BOTH directions: a setup formed on
     Friday and reviewed on Saturday was vetoed for a closure it never met,
     and one formed on Saturday and reviewed on Monday sailed through. The
     hg-v949 rule ("a Monday re-run over Friday's bars must give Friday's
     answer") was written into the shared formation while this desk did the
     opposite. Falls back to the wall clock ONLY when the candidate carries
     no instant, which is the pre-hg-v952 behaviour and is named on the
     reason so a reader can tell the two apart. */
  if (typeof win.hgInGoldWeekend === 'function'){
    try{
      var sgAt = sgCandSec(c, hit);
      var sgWhen = (sgAt === null) ? Math.floor(Date.now() / 1000) : sgAt;
      if (sgWeekendVerdict(sgWhen)){
        reasons.push('Gold weekend closure — spot liquidity thin'
          + (sgAt === null ? ' (no bar time on this candidate — read on the wall clock)' : ''));
      } else passed.push('session');
    }catch(e1){}
  }

  if (typeof win.getGoldMacroCached === 'function'){
    try{
      var macro = win.getGoldMacroCached();
      var hint = macro && macro.realRateHint ? String(macro.realRateHint).toUpperCase() : '';
      if (hint === 'HEADWIND'){
        if (dir === 'long') reasons.push('Macro HEADWIND vs long');
        else passed.push('macro');
      } else if (hint === 'TAILWIND'){
        if (dir === 'short') reasons.push('Macro TAILWIND vs short');
        else passed.push('macro');
      } else if (hint) passed.push('macro');
    }catch(e2){}
  }

  if (typeof win.hgGoldVenueSpread === 'function'){
    try{
      var spotSt = typeof win.goldspotState === 'function' ? win.goldspotState() : null;
      var gvs = win.hgGoldVenueSpread({
        spot: spotSt && spotSt.spot,
        paxg: spotSt && spotSt.paxg,
        xaut: spotSt && spotSt.xaut,
        /* hg-v952: same instant as the veto above — one candidate, one clock */
        cashOpen: !(typeof win.hgInGoldWeekend === 'function'
          && win.hgInGoldWeekend(sgCandSecOr(c, hit)))
      });
      if (gvs && gvs.veto && hit.tier === 'clean'){
        reasons.push(gvs.reason || 'Cross-venue spread guard');
      } else if (gvs && gvs.ok) passed.push('spread');
    }catch(e3){}
  }

  if ((c.demoted || hit.demoted) && hit.tier === 'clean'){
    reasons.push(c.demoteReason || hit.demoteReason || 'Demoted by best-levels / quality gate');
  }

  if (c.stamps && Array.isArray(c.stamps)){
    for (var si = 0; si < c.stamps.length; si++){
      var st = c.stamps[si];
      if (st && /news|blackout|caution/i.test(String(st))){
        reasons.push('News caution on ticket');
        break;
      }
    }
  }

  var effRr = effectiveGoldRr(hit);
  if (N(effRr) > 0 && N(effRr) < 1.2 && hit.tier === 'clean'){
    reasons.push('R:R below gold house minimum');
  }

  return {
    pass: reasons.length === 0,
    reasons: reasons,
    passed: passed,
    layerSummary: passed.length + ' gold ok' + (reasons.length ? (' · ' + reasons.length + ' block') : '')
  };
}

function superGoldDeskPill(row){
  if (!row) return { cls: 'block', label: 'HOLD' };
  if (row.minimalLossPass) return { cls: 'minloss', label: 'GRADE A PASS' };
  if (row.tier === 'near' || row.nearWatch || row.demoted){
    return { cls: 'watch', label: 'WATCH ONLY' };
  }
  if (row.tier === 'clean' && row.goldAudit && row.goldAudit.pass === false){
    return { cls: 'block', label: 'AUDIT HOLD' };
  }
  if (row.sizingPass || (row.positionSize && !row.positionSize.error)){
    return { cls: 'clean', label: 'LEVELS OK' };
  }
  var why = row.riskReason || (row.calc && row.calc.reason) || 'SIZE HOLD';
  return { cls: 'block', label: String(why).slice(0, 28) };
}

function sgCalcBarsAtr(rows, period){
  if (!Array.isArray(rows) || rows.length < 2) return NaN;
  period = period || 14;
  var slice = rows.slice(-Math.max(period + 1, 6));
  var sum = 0, cnt = 0;
  for (var i = 1; i < slice.length; i++){
    var cur = slice[i], prev = slice[i - 1];
    if (!cur || !prev) continue;
    var h = N(cur.h != null ? cur.h : cur.high);
    var l = N(cur.l != null ? cur.l : cur.low);
    var pc = N(prev.c != null ? prev.c : prev.close);
    if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) continue;
    var tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    if (tr > 0){ sum += tr; cnt++; }
  }
  return cnt > 0 ? (sum / cnt) : NaN;
}

function sgImpulseSwing(rows, side){
  if (!Array.isArray(rows) || rows.length < 6) return null;
  var win = rows.slice(-24);
  var hi = -Infinity, lo = Infinity;
  var vwapNum = 0, vwapDen = 0;
  for (var i = 0; i < win.length; i++){
    var b = win[i];
    if (!b) continue;
    var bh = N(b.h != null ? b.h : b.high);
    var bl = N(b.l != null ? b.l : b.low);
    var bc = N(b.c != null ? b.c : b.close);
    var bv = N(b.v != null ? b.v : (b.vol != null ? b.vol : 1));
    if (isFinite(bh) && bh > hi) hi = bh;
    if (isFinite(bl) && bl < lo) lo = bl;
    if (isFinite(bh) && isFinite(bl) && isFinite(bc)){
      var typ = (bh + bl + bc) / 3;
      var w = (isFinite(bv) && bv > 0) ? bv : 1;
      vwapNum += typ * w;
      vwapDen += w;
    }
  }
  if (!isFinite(hi) || !isFinite(lo) || !(hi > lo)) return null;
  var rng = hi - lo;
  var isLong = String(side || '').toLowerCase() === 'long';
  /* OTE 61.8% - 70.5% retracement of recent impulse leg */
  var ote618 = isLong ? (hi - rng * 0.618) : (lo + rng * 0.618);
  var ote705 = isLong ? (hi - rng * 0.705) : (lo + rng * 0.705);
  var oteMid = (ote618 + ote705) / 2;
  var ext1272 = isLong ? (hi + rng * 0.272) : (lo - rng * 0.272);
  var ext1618 = isLong ? (hi + rng * 0.618) : (lo - rng * 0.618);
  return {
    swingHigh: +hi.toFixed(2),
    swingLow: +lo.toFixed(2),
    range: +rng.toFixed(2),
    ote618: +ote618.toFixed(2),
    ote705: +ote705.toFixed(2),
    oteMid: +oteMid.toFixed(2),
    ext1272: +ext1272.toFixed(2),
    ext1618: +ext1618.toFixed(2),
    vwap: vwapDen > 0 ? +(vwapNum / vwapDen).toFixed(2) : null
  };
}

function sgPsychShieldStop(rawStop, side){
  if (!isFinite(rawStop) || rawStop <= 0) return { stop: rawStop, shielded: false, magnet: null };
  var isLong = String(side || '').toLowerCase() === 'long';
  /* Gold liquidity sweeps cluster around $25 / $50 / $75 / $00 and $10 levels */
  var nearest25 = Math.round(rawStop / 25) * 25;
  var nearest10 = Math.round(rawStop / 10) * 10;
  var magnet = Math.abs(rawStop - nearest25) <= 1.25 ? nearest25
             : (Math.abs(rawStop - nearest10) <= 0.85 ? nearest10 : null);
  if (magnet === null){
    return { stop: +rawStop.toFixed(2), shielded: false, magnet: null };
  }
  /* Push stop $1.15 past the psychological magnet so liquidity wicks into the
     round number do not tag the stop before reversing. */
  var shieldedStop = isLong ? Math.min(rawStop, magnet - 1.15) : Math.max(rawStop, magnet + 1.15);
  return {
    stop: +shieldedStop.toFixed(2),
    shielded: Math.abs(shieldedStop - rawStop) >= 0.05,
    magnet: magnet
  };
}

function sgPrecisionGoldLevels(row, intel, opts){
  opts = opts || {};
  if (!row) return { ok: false, reason: 'no setup row' };
  var sideStr = String(row.dir || row.side || '').toLowerCase();
  var side = (sideStr === 'long' || sideStr === 'buy' || sideStr === 'bull') ? 'long'
           : ((sideStr === 'short' || sideStr === 'sell' || sideStr === 'bear') ? 'short' : '');
  var rawEntry = N(row.entry);
  var rawStop = N(row.stop);
  var rawT1 = N(row.t1 || row.tp);
  var rawT2 = N(row.t2 || row.tp2);
  var rawT3 = N(row.t3);
  if (!side || !(rawEntry > 0 && rawStop > 0 && rawEntry !== rawStop)){
    return { ok: false, reason: 'missing or invalid raw entry/stop' };
  }
  var isLong = (side === 'long');
  var rows15 = (intel && Array.isArray(intel.rows15) && intel.rows15.length)
    ? intel.rows15
    : (Array.isArray(row.rows15m) ? row.rows15m : []);
  var atr = (intel && intel.volRegime && intel.volRegime.ok && isFinite(+intel.volRegime.atrNow) && +intel.volRegime.atrNow > 0)
    ? +intel.volRegime.atrNow
    : sgCalcBarsAtr(rows15, 14);
  var rawRisk = Math.abs(rawEntry - rawStop);
  var atrUnread = !(isFinite(atr) && atr > 0);
  if (atrUnread) atr = Math.max(2, +(rawRisk * 0.65).toFixed(2));

  var regime = (intel && intel.volRegime && intel.volRegime.regime) ? String(intel.volRegime.regime) : 'NORMAL';
  var swing = sgImpulseSwing(rows15, side);
  var structItems = (intel && intel.structure && intel.structure.ok && Array.isArray(intel.structure.items))
    ? intel.structure.items : [];

  /* 1. PRECISION ENTRY REFINEMENT
     Snap entry toward nearest supporting structure / OTE 61.8% / VWAP when
     within 0.45 ATR so we enter on institutional reload rather than mid-air. */
  var bestEntry = rawEntry;
  var entryReason = 'desk structural level';
  var nearStruct = null;
  for (var i = 0; i < structItems.length; i++){
    var spx = N(structItems[i] && structItems[i].px);
    if (!isFinite(spx) || spx <= 0) continue;
    if (Math.abs(spx - rawEntry) <= atr * 0.45){
      if (nearStruct === null || Math.abs(spx - rawEntry) < Math.abs(nearStruct.px - rawEntry)){
        nearStruct = { px: spx, label: structItems[i].label || 'structure' };
      }
    }
  }
  if (nearStruct){
    /* Place limit $0.25 in front of structure to guarantee fill before bounce */
    bestEntry = isLong ? Math.max(rawStop + atr * 0.5, nearStruct.px + 0.25)
                       : Math.min(rawStop - atr * 0.5, nearStruct.px - 0.25);
    entryReason = 'front-run ' + nearStruct.label + ' @ ' + fmt(nearStruct.px, 2);
  } else if (swing && isFinite(swing.ote618) && isFinite(swing.ote705)){
    var oteLo = Math.min(swing.ote618, swing.ote705);
    var oteHi = Math.max(swing.ote618, swing.ote705);
    var bandPad = atr * 0.55;
    var nearOte = rawEntry >= (oteLo - bandPad) && rawEntry <= (oteHi + bandPad);
    var vwap = (swing.vwap != null && isFinite(+swing.vwap)) ? +swing.vwap : NaN;
    if (nearOte){
      var snapped = Math.min(oteHi, Math.max(oteLo, rawEntry));
      if (isFinite(vwap) && vwap >= oteLo && vwap <= oteHi && Math.abs(vwap - rawEntry) <= bandPad){
        bestEntry = +(((snapped + vwap) / 2)).toFixed(2);
        entryReason = 'OTE 61.8-70.5 with VWAP (' + fmt(vwap, 2) + ')';
      } else {
        bestEntry = +snapped.toFixed(2);
        entryReason = 'OTE 61.8-70.5 (' + fmt(oteLo, 2) + '-' + fmt(oteHi, 2) + ')';
      }
    } else if (isFinite(vwap) && Math.abs(vwap - rawEntry) <= atr * 0.45){
      bestEntry = +((rawEntry * 0.6 + vwap * 0.4)).toFixed(2);
      entryReason = 'VWAP confluence (' + fmt(vwap, 2) + ')';
    }
  }
  if ((isLong && bestEntry <= rawStop) || (!isLong && bestEntry >= rawStop)){
    bestEntry = rawEntry;
    entryReason = 'desk structural level';
  }
  bestEntry = +bestEntry.toFixed(2);
  var zonePad = +(atr * 0.15).toFixed(2);
  var entryZoneLow = +(bestEntry - zonePad).toFixed(2);
  var entryZoneHigh = +(bestEntry + zonePad).toFixed(2);

  /* 2. SWEEP-PROTECTED STOP-LOSS (SL)
     Ensure SL sits beyond structural invalidation + regime ATR buffer and
     clear of psychological round-number stop-hunt clusters ($00/$25/$50/$75). */
  var atrBufMult = (regime === 'EXPANSION') ? 0.50 : 0.35;
  var minStopDist = Math.max(2.0, +(atr * 0.85).toFixed(2));
  var maxStopDist = Math.max(rawRisk * 1.35, +(atr * 2.6).toFixed(2));
  var structStop = rawStop;
  if (swing){
    if (isLong && swing.swingLow < bestEntry && (bestEntry - swing.swingLow) <= maxStopDist){
      structStop = Math.min(rawStop, swing.swingLow - atr * atrBufMult);
    } else if (!isLong && swing.swingHigh > bestEntry && (swing.swingHigh - bestEntry) <= maxStopDist){
      structStop = Math.max(rawStop, swing.swingHigh + atr * atrBufMult);
    }
  }
  var curDist = Math.abs(bestEntry - structStop);
  if (curDist < minStopDist){
    structStop = isLong ? (bestEntry - minStopDist) : (bestEntry + minStopDist);
  } else if (curDist > maxStopDist){
    structStop = isLong ? (bestEntry - maxStopDist) : (bestEntry + maxStopDist);
  }
  var shield = sgPsychShieldStop(structStop, side);
  var bestStop = shield.stop;
  /* Guarantee direction invariant: Long stop < entry, Short stop > entry */
  if (isLong && bestStop >= bestEntry) bestStop = +(bestEntry - minStopDist).toFixed(2);
  if (!isLong && bestStop <= bestEntry) bestStop = +(bestEntry + minStopDist).toFixed(2);
  var riskDist = Math.abs(bestEntry - bestStop);
  var stopAtrRatio = +(riskDist / atr).toFixed(2);
  var slNote = (shield.shielded ? ('shielded past $' + shield.magnet + ' sweep magnet · ') : '')
    + fmt(riskDist, 2) + ' pts (' + fmt(stopAtrRatio, 2) + ' ATR)';

  /* 3. MULTI-TIER TAKE-PROFIT LADDER (TP1 / TP2 / TP3)
     - TP1 (50% scale): >= 1.8R, front-running any opposing structure wall by $0.60
     - TP2 (30% scale): >= 2.8R or 1.618 Fib impulse extension
     - TP3 (20% runner): 4.0R or Daily ADR exhaustion cap (3.5 * ATR_15m * 4) */
  var minT1Dist = riskDist * 1.8;
  var targetT1 = (rawT1 > 0 && Math.abs(rawT1 - bestEntry) >= riskDist * 1.5)
    ? rawT1
    : (isLong ? (bestEntry + minT1Dist) : (bestEntry - minT1Dist));
  /* Front-run opposing structure walls near TP1 by $0.60 */
  var t1FrontRun = false;
  for (var j = 0; j < structItems.length; j++){
    var opPx = N(structItems[j] && structItems[j].px);
    if (!isFinite(opPx) || opPx <= 0) continue;
    if (isLong && opPx > bestEntry + riskDist * 1.4 && Math.abs(opPx - targetT1) <= atr * 0.5){
      targetT1 = opPx - 0.60;
      t1FrontRun = true;
      break;
    } else if (!isLong && opPx < bestEntry - riskDist * 1.4 && Math.abs(opPx - targetT1) <= atr * 0.5){
      targetT1 = opPx + 0.60;
      t1FrontRun = true;
      break;
    }
  }
  targetT1 = +targetT1.toFixed(2);

  var minT2Dist = riskDist * 2.8;
  var targetT2 = (rawT2 > 0 && Math.abs(rawT2 - bestEntry) > Math.abs(targetT1 - bestEntry))
    ? rawT2
    : (isLong ? (bestEntry + minT2Dist) : (bestEntry - minT2Dist));
  if (swing && isFinite(swing.ext1618)){
    if (isLong && swing.ext1618 > targetT1 + riskDist * 0.5 && swing.ext1618 <= bestEntry + riskDist * 3.8){
      targetT2 = swing.ext1618;
    } else if (!isLong && swing.ext1618 < targetT1 - riskDist * 0.5 && swing.ext1618 >= bestEntry - riskDist * 3.8){
      targetT2 = swing.ext1618;
    }
  }
  targetT2 = +targetT2.toFixed(2);

  /* ADR exhaustion cap (~8.5x 15m ATR for session remaining range) */
  var adrRemaining = Math.max(riskDist * 3.6, atr * 8.5);
  var rawRunnerDist = riskDist * 4.0;
  var runnerDist = Math.min(rawRunnerDist, adrRemaining);
  var targetT3 = (rawT3 > 0 && Math.abs(rawT3 - bestEntry) > Math.abs(targetT2 - bestEntry))
    ? rawT3
    : (isLong ? (bestEntry + runnerDist) : (bestEntry - runnerDist));
  if (isLong && targetT3 <= targetT2) targetT3 = +(targetT2 + riskDist * 1.0).toFixed(2);
  if (!isLong && targetT3 >= targetT2) targetT3 = +(targetT2 - riskDist * 1.0).toFixed(2);
  targetT3 = +targetT3.toFixed(2);

  var rr1 = +(Math.abs(targetT1 - bestEntry) / riskDist).toFixed(2);
  var rr2 = +(Math.abs(targetT2 - bestEntry) / riskDist).toFixed(2);
  var rr3 = +(Math.abs(targetT3 - bestEntry) / riskDist).toFixed(2);
  var microSplit = null;
  try{ microSplit = sgDetectMicrostructureZones(rows15, null, side); }catch(eMs){}
  var tpSplits = sgAdaptiveTpSplits(intel, microSplit, side);
  var blendedRr = +((tpSplits.t1Pct * rr1 + tpSplits.t2Pct * rr2 + tpSplits.t3Pct * rr3) / 100).toFixed(2);
  var precOut = {
    ok: true,
    side: side,
    entry: bestEntry,
    rawEntry: rawEntry,
    entryZone: [entryZoneLow, entryZoneHigh],
    entryReason: entryReason,
    stop: bestStop,
    rawStop: rawStop,
    riskDist: +riskDist.toFixed(2),
    atr: +atr.toFixed(2),
    stopAtrRatio: stopAtrRatio,
    psychShielded: shield.shielded,
    psychMagnet: shield.magnet,
    slNote: slNote,
    t1: targetT1,
    t2: targetT2,
    t3: targetT3,
    t1FrontRun: t1FrontRun,
    rr1: rr1,
    rr2: rr2,
    rr3: rr3,
    blendedRr: blendedRr,
    splits: tpSplits,
    unread: atrUnread === true,
    ordered: false,
    vwap: swing ? swing.vwap : null,
    ote618: swing ? swing.ote618 : null,
    ote705: swing ? swing.ote705 : null,
    why: 'Entry ' + fmt(bestEntry, 2) + ' [' + fmt(entryZoneLow, 2) + '-' + fmt(entryZoneHigh, 2) + '] (' + entryReason + ')'
      + ' · SL ' + fmt(bestStop, 2) + ' (' + slNote + ')'
      + ' · TP1 ' + fmt(targetT1, 2) + ' (' + fmt(rr1, 2) + 'R, ' + tpSplits.t1Pct + '%)'
      + ' · TP2 ' + fmt(targetT2, 2) + ' (' + fmt(rr2, 2) + 'R, ' + tpSplits.t2Pct + '%)'
      + ' · TP3 ' + fmt(targetT3, 2) + ' (' + fmt(rr3, 2) + 'R, ' + tpSplits.t3Pct + '%)'
      + ' · Blended ' + fmt(blendedRr, 2) + 'R'
  };
  try{
    sgAttachEntryPlan(precOut, microSplit || sgDetectMicrostructureZones(rows15, null, side), regime);
    precOut.volumeProfile = sgIntradayVolumeProfile(rows15, side, precOut.entry);
    precOut.ratchetLadder = sgBuildStopRatchetLadder(precOut.entry, precOut.stop, precOut.t1, precOut.t2, side);
    precOut.liquidityMap = sgSessionLiquidityMap(rows15, side, precOut.entry);
    precOut.adverse = sgAdverseSelectionGuard({ dir: side }, precOut, { rows15: rows15 });
    precOut.dolMagnet = null;
    var dolPx = precOut.liquidityMap && precOut.liquidityMap.drawOnLiquidity && precOut.liquidityMap.drawOnLiquidity.px;
    if (isFinite(+dolPx) && precOut.unread !== true){
      var toward = isLong ? (+dolPx > precOut.entry) : (+dolPx < precOut.entry);
      if (toward){
        precOut.dolMagnet = {
          px: +(+dolPx).toFixed(2),
          suggested: +((isLong ? +dolPx - 0.35 : +dolPx + 0.35).toFixed(2)),
          movedEntry: false
        };
      }
    }
  }catch(ePlan){}
  return precOut;
}

/* A suggestion is sendable only when the side, the stop, and the three
   targets are in order. A long is stop, entry, TP1, TP2, TP3. A short is
   the reverse. Anything else is not a bracket. */
function sgPrecisionOrdered(prec){
  if (!prec || prec.ok !== true || prec.unread === true) return false;
  var e = +prec.entry, s = +prec.stop, t1 = +prec.t1, t2 = +prec.t2, t3 = +prec.t3;
  if (!(e > 0 && s > 0 && t1 > 0 && e !== s)) return false;
  if (!(isFinite(+prec.rr1) && +prec.rr1 >= 1.2)) return false;
  if (prec.side === 'long'){
    if (!(s < e && e < t1)) return false;
    if (isFinite(t2) && t2 > 0 && !(t2 > t1)) return false;
    if (isFinite(t3) && t3 > 0 && !(t3 > t2)) return false;
    return true;
  }
  if (prec.side === 'short'){
    if (!(s > e && e > t1)) return false;
    if (isFinite(t2) && t2 > 0 && !(t2 < t1)) return false;
    if (isFinite(t3) && t3 > 0 && !(t3 < t2)) return false;
    return true;
  }
  return false;
}

/* One suggestion per row, computed from the intel pinned on this snap.
   Replaces the copy made before the tape existed. Does not touch entry,
   stop, or t1 on the row. */
function sgStampPrecision(snap){
  if (!snap || !Array.isArray(snap.cands)) return snap;
  snap.cands.forEach(function(row){
    if (!row) return;
    try{
      var prec = sgPrecisionGoldLevels(row, snap.intel || null);
      if (prec && prec.ok){
        prec.ordered = sgPrecisionOrdered(prec);
        row.precision = prec;
        row.expectancy = sgCalcSetupExpectancy(row, prec, snap.intel || null);
        row.decay = sgEvaluateSetupDecay(row, prec, snap.intel || null);
      }
    }catch(eSt){}
  });
  return snap;
}

function sgBarPx(b){
  if (!b) return null;
  var o = N(b.o != null ? b.o : b.open);
  var h = N(b.h != null ? b.h : b.high);
  var l = N(b.l != null ? b.l : b.low);
  var c = N(b.c != null ? b.c : b.close);
  if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
  return { o: o, h: h, l: l, c: c, t: b.t };
}

/* 15m gaps and order blocks that later bars have not traded back into.
   A bullish gap is the third bar's low above the first bar's high.
   A bullish order block is the down candle directly before the up displacement.
   The displacement wick is not a fill. A later bar trading into the zone is. */
function sgDetectMicrostructureZones(rows, intel, side){
  if (typeof intel === 'string' && (side == null || side === '')){
    side = intel;
    intel = null;
  }
  rows = Array.isArray(rows) ? rows : [];
  var want = String(side || '').toLowerCase();
  if (want === 'buy' || want === 'bull') want = 'long';
  if (want === 'sell' || want === 'bear') want = 'short';
  var out = { ok: rows.length >= 5, fvgs: [], ifvgs: [], obs: [], sweeps: [], breakers: [], nearestFvg: null, nearestIfvg: null, nearestOb: null, nearestBreaker: null, mssConfirmed: false, chochLevel: null, impulseZScore: null, volCommitmentRatio: null, clvScore: null, wickRejectionScore: null, absorptionDetected: false, sweepReclaimed: false };
  if (!out.ok) return out;
  var bars = [];
  for (var i = 0; i < rows.length; i++){
    var px = sgBarPx(rows[i]);
    if (px) bars.push(px);
  }
  if (bars.length < 5){ out.ok = false; return out; }
  var last = bars[bars.length - 1].c;
  function nearer(cur, px){
    if (!cur) return true;
    return Math.abs(px - last) < Math.abs(cur - last);
  }
  var f, j, k, b0, b1, b2, gap, ob, later, filled, sweepLo, sweepHi;
  for (f = 2; f < bars.length; f++){
    b0 = bars[f - 2]; b2 = bars[f];
    if (b2.l > b0.h){
      gap = { kind: 'FVG', side: 'long', bottom: +b0.h.toFixed(2), top: +b2.l.toFixed(2), index: f };
      gap.ce = +(((gap.bottom + gap.top) / 2).toFixed(2));
      filled = false;
      for (k = f + 1; k < bars.length; k++){ if (bars[k].l <= gap.top){ filled = true; break; } }
      if (!filled) out.fvgs.push(gap);
    } else if (b2.h < b0.l){
      gap = { kind: 'FVG', side: 'short', bottom: +b2.h.toFixed(2), top: +b0.l.toFixed(2), index: f };
      gap.ce = +(((gap.bottom + gap.top) / 2).toFixed(2));
      filled = false;
      for (k = f + 1; k < bars.length; k++){ if (bars[k].h >= gap.bottom){ filled = true; break; } }
      if (!filled) out.fvgs.push(gap);
    }
  }
  for (j = 0; j < bars.length - 1; j++){
    b0 = bars[j]; b1 = bars[j + 1];
    if (b0.c < b0.o && b1.c > b1.o && b1.c > b0.h && (b1.c - b1.o) >= Math.max(0.5, (b0.h - b0.l) * 0.5)){
      ob = { kind: 'OB', side: 'long', bottom: +b0.l.toFixed(2), top: +b0.h.toFixed(2), index: j };
      ob.mt = +(((ob.bottom + ob.top) / 2).toFixed(2));
      filled = false;
      for (k = j + 2; k < bars.length; k++){ if (bars[k].l <= ob.top){ filled = true; break; } }
      if (!filled) out.obs.push(ob);
    } else if (b0.c > b0.o && b1.c < b1.o && b1.c < b0.l && (b1.o - b1.c) >= Math.max(0.5, (b0.h - b0.l) * 0.5)){
      ob = { kind: 'OB', side: 'short', bottom: +b0.l.toFixed(2), top: +b0.h.toFixed(2), index: j };
      ob.mt = +(((ob.bottom + ob.top) / 2).toFixed(2));
      filled = false;
      for (k = j + 2; k < bars.length; k++){ if (bars[k].h >= ob.bottom){ filled = true; break; } }
      if (!filled) out.obs.push(ob);
    }
  }
  for (j = 5; j < bars.length; j++){
    sweepLo = Infinity; sweepHi = -Infinity;
    for (k = j - 5; k < j; k++){
      if (bars[k].l < sweepLo) sweepLo = bars[k].l;
      if (bars[k].h > sweepHi) sweepHi = bars[k].h;
    }
    if (bars[j].l < sweepLo && bars[j].c > sweepLo){
      out.sweeps.push({ side: 'long', index: j, pool: +sweepLo.toFixed(2), close: +bars[j].c.toFixed(2) });
    }
    if (bars[j].h > sweepHi && bars[j].c < sweepHi){
      out.sweeps.push({ side: 'short', index: j, pool: +sweepHi.toFixed(2), close: +bars[j].c.toFixed(2) });
    }
  }
  for (f = 0; f < out.fvgs.length; f++){
    if (want && out.fvgs[f].side !== want) continue;
    if (nearer(out.nearestFvg && out.nearestFvg.ce, out.fvgs[f].ce)) out.nearestFvg = out.fvgs[f];
  }
  for (f = 0; f < out.obs.length; f++){
    if (want && out.obs[f].side !== want) continue;
    if (nearer(out.nearestOb && out.nearestOb.mt, out.obs[f].mt)) out.nearestOb = out.obs[f];
  }
  var refPx = last;
  for (j = 1; j < bars.length - 1; j++){
    b0 = bars[j - 1]; b1 = bars[j];
    if (want !== 'short' && b0.c > b0.o && b1.c < b0.l && refPx > b0.h){
      out.breakers.push({
        side: 'long', top: +b0.h.toFixed(2), bottom: +b0.l.toFixed(2),
        mt: +((b0.h + b0.l) / 2).toFixed(2), index: j - 1
      });
    } else if (want !== 'long' && b0.c < b0.o && b1.c > b0.h && refPx < b0.l){
      out.breakers.push({
        side: 'short', top: +b0.h.toFixed(2), bottom: +b0.l.toFixed(2),
        mt: +((b0.h + b0.l) / 2).toFixed(2), index: j - 1
      });
    }
  }
  out.nearestBreaker = out.breakers.length ? out.breakers[out.breakers.length - 1] : null;
  var nBars = bars.length;
  for (j = Math.max(5, nBars - 6); j < nBars; j++){
    var preHi = -Infinity, preLo = Infinity;
    for (k = Math.max(0, j - 5); k < j; k++){
      if (bars[k].h > preHi) preHi = bars[k].h;
      if (bars[k].l < preLo) preLo = bars[k].l;
    }
    if (want !== 'short' && isFinite(preHi) && bars[j].c > preHi){
      out.mssConfirmed = true;
      out.chochLevel = +preHi.toFixed(2);
    } else if (want === 'short' && isFinite(preLo) && bars[j].c < preLo){
      out.mssConfirmed = true;
      out.chochLevel = +preLo.toFixed(2);
    }
  }
  var ranges = [];
  for (j = 0; j < nBars; j++){
    if (bars[j].h >= bars[j].l) ranges.push(bars[j].h - bars[j].l);
  }
  if (ranges.length > 1){
    var meanRng = 0;
    for (j = 0; j < ranges.length; j++) meanRng += ranges[j];
    meanRng = meanRng / ranges.length;
    var varRng = 0;
    for (j = 0; j < ranges.length; j++) varRng += Math.pow(ranges[j] - meanRng, 2);
    varRng = varRng / (ranges.length - 1);
    var sdRng = Math.sqrt(Math.max(varRng, 0));
    var maxRecent = 0;
    for (j = Math.max(0, nBars - 5); j < nBars; j++){
      maxRecent = Math.max(maxRecent, bars[j].h - bars[j].l);
    }
    if (sdRng > 0) out.impulseZScore = +((maxRecent - meanRng) / sdRng).toFixed(2);
  }
  for (j = 0; j < out.sweeps.length; j++){
    if (!want || out.sweeps[j].side === want){ out.sweepReclaimed = true; break; }
  }
  var atrM = sgCalcBarsAtr(rows, 14);
  var minGap = (isFinite(atrM) && atrM > 0) ? atrM * 0.06 : 0;
  for (j = 2; j < bars.length - 1; j++){
    b0 = bars[j - 2]; b2 = bars[j];
    if (want !== 'short' && b0.l > b2.h && (b0.l - b2.h) > minGap){
      var up = false;
      for (k = j + 1; k < bars.length; k++){ if (bars[k].c > b0.l){ up = true; break; } }
      if (up && refPx >= b2.h){
        out.ifvgs.push({
          side: 'long', top: +b0.l.toFixed(2), bottom: +b2.h.toFixed(2),
          ce: +((b0.l + b2.h) / 2).toFixed(2), width: +(b0.l - b2.h).toFixed(2), index: j
        });
      }
    } else if (want !== 'long' && b2.l > b0.h && (b2.l - b0.h) > minGap){
      var dn = false;
      for (k = j + 1; k < bars.length; k++){ if (bars[k].c < b0.h){ dn = true; break; } }
      if (dn && refPx <= b2.l){
        out.ifvgs.push({
          side: 'short', top: +b2.l.toFixed(2), bottom: +b0.h.toFixed(2),
          ce: +((b2.l + b0.h) / 2).toFixed(2), width: +(b2.l - b0.h).toFixed(2), index: j
        });
      }
    }
  }
  out.nearestIfvg = out.ifvgs.length ? out.ifvgs[out.ifvgs.length - 1] : null;
  var volKept = [];
  for (j = 0; j < rows.length; j++){
    if (!sgBarPx(rows[j])) continue;
    var rawV = rows[j].v != null ? rows[j].v : rows[j].vol;
    volKept.push((isFinite(N(rawV)) && N(rawV) > 0) ? N(rawV) : null);
  }
  var volNums = volKept.filter(function(v){ return v != null; });
  if (volNums.length >= 2){
    var meanVol = 0;
    for (j = 0; j < volNums.length; j++) meanVol += volNums[j];
    meanVol = meanVol / volNums.length;
    var maxRecentVol = 0, sawRecent = false;
    for (j = Math.max(0, volKept.length - 5); j < volKept.length; j++){
      if (volKept[j] != null){ sawRecent = true; if (volKept[j] > maxRecentVol) maxRecentVol = volKept[j]; }
    }
    if (sawRecent && meanVol > 0) out.volCommitmentRatio = +(maxRecentVol / meanVol).toFixed(2);
  }
  var lastBar = bars[bars.length - 1];
  if (lastBar && lastBar.h > lastBar.l){
    out.clvScore = +((((lastBar.c - lastBar.l) - (lastBar.h - lastBar.c)) / (lastBar.h - lastBar.l))).toFixed(2);
  }
  var atrAbs = sgCalcBarsAtr(rows, 14);
  var maxWickRatio = 0;
  var isLongSide = want !== 'short';
  if (want === 'long' || want === 'short'){
    for (j = Math.max(0, bars.length - 4); j < bars.length; j++){
      var wb = bars[j];
      if (!wb || !(wb.h > wb.l)) continue;
      var wRng = wb.h - wb.l;
      var bodyLo = Math.min(wb.o, wb.c), bodyHi = Math.max(wb.o, wb.c);
      var favWick = isLongSide ? (bodyLo - wb.l) : (wb.h - bodyHi);
      var wickRatio = favWick / wRng;
      if (wickRatio > maxWickRatio) maxWickRatio = wickRatio;
      var favClose = isLongSide ? ((wb.c - wb.l) / wRng >= 0.55) : ((wb.h - wb.c) / wRng >= 0.55);
      var wickBig = wickRatio >= 0.35 || (isFinite(atrAbs) && atrAbs > 0 && favWick >= atrAbs * 0.25);
      if (wickBig && favClose) out.absorptionDetected = true;
    }
    var dirClv = (out.clvScore == null) ? 0 : (isLongSide ? out.clvScore : -out.clvScore);
    out.wickRejectionScore = Math.max(0, Math.min(100, Math.round(maxWickRatio * 85 + Math.max(0, dirClv) * 35 + (out.absorptionDetected ? 15 : 0))));
  }
  return out;
}

/* How many timeframes actually printed the same direction, and whether
   the Asian range (00:00-07:00 UTC) or the prior UTC day was swept and
   reclaimed. A missing row is not counted as aligned. No bar clock means
   the session raid is unread, not a continuation. */
function sgBarUtc(b){
  if (!b || b.t == null || b.t === '') return null;
  var n = +b.t;
  if (!isFinite(n) || n <= 0) return null;
  var ms = Math.abs(n) > 1e12 ? n : n * 1000;
  var d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d;
}

function sgMultiTfFractalCascade(row, intel){
  row = row || {};
  intel = intel || {};
  var side = String(row.dir || row.side || '').toLowerCase();
  if (side === 'buy' || side === 'bull') side = 'long';
  if (side === 'sell' || side === 'bear') side = 'short';
  if (side !== 'long' && side !== 'short'){
    return { ok: false, alignedCount: 0, totalTf: null, cascadeState: 'UNREAD', sessionRaid: 'UNREAD', ibRaided: false, summary: 'No side, so the cascade is unread' };
  }
  var isLong = side === 'long';
  var wantDir = isLong ? 'BULL' : 'BEAR';
  var ft = intel.fiveTf || null;
  var tfRows = (ft && Array.isArray(ft.rows)) ? ft.rows : [];
  var alignedCount = 0, htfAligned = false, ltfAligned = false, alignedList = [];
  for (var i = 0; i < tfRows.length; i++){
    var r = tfRows[i];
    if (!r) continue;
    var d = String(r.dir || '').toUpperCase();
    var tf = String(r.tf || '').toLowerCase();
    if (d !== wantDir) continue;
    alignedCount++;
    if (tf) alignedList.push(r.tf);
    if (tf === '4h' || tf === '1d' || tf === '1h') htfAligned = true;
    if (tf === '15m' || tf === '5m') ltfAligned = true;
  }
  var totalTf = tfRows.length ? tfRows.length : null;
  var rows15 = Array.isArray(intel.rows15) ? intel.rows15 : [];
  var ibHigh = -Infinity, ibLow = Infinity, asianN = 0;
  var byDay = {};
  for (i = 0; i < rows15.length; i++){
    var b = rows15[i];
    var dt = sgBarUtc(b);
    if (!dt || !b) continue;
    var bh = N(b.h != null ? b.h : b.high);
    var bl = N(b.l != null ? b.l : b.low);
    if (dt.getUTCHours() < 7){
      asianN++;
      if (isFinite(bh) && bh > ibHigh) ibHigh = bh;
      if (isFinite(bl) && bl < ibLow) ibLow = bl;
    }
    var day = dt.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { hi: -Infinity, lo: Infinity };
    if (isFinite(bh) && bh > byDay[day].hi) byDay[day].hi = bh;
    if (isFinite(bl) && bl < byDay[day].lo) byDay[day].lo = bl;
  }
  var sessionRaid = 'UNREAD';
  var ibRaided = false;
  var lastC = null;
  if (rows15.length){
    var lastBar = rows15[rows15.length - 1];
    lastC = N(lastBar && (lastBar.c != null ? lastBar.c : lastBar.close));
  }
  if (asianN >= 3 && isFinite(ibHigh) && isFinite(ibLow) && ibHigh > ibLow){
    var sweptLo = false, sweptHi = false;
    for (i = 0; i < rows15.length; i++){
      var dt2 = sgBarUtc(rows15[i]);
      if (!dt2 || dt2.getUTCHours() < 7) continue;
      var bh2 = N(rows15[i].h != null ? rows15[i].h : rows15[i].high);
      var bl2 = N(rows15[i].l != null ? rows15[i].l : rows15[i].low);
      if (isFinite(bl2) && bl2 < ibLow) sweptLo = true;
      if (isFinite(bh2) && bh2 > ibHigh) sweptHi = true;
    }
    if (isLong && sweptLo && isFinite(lastC) && lastC > ibLow){
      sessionRaid = 'ASIAN_IB_LOW_SWEEP_RECLAIM';
      ibRaided = true;
    } else if (!isLong && sweptHi && isFinite(lastC) && lastC < ibHigh){
      sessionRaid = 'ASIAN_IB_HIGH_SWEEP_REJECT';
      ibRaided = true;
    } else if (isLong && isFinite(lastC) && lastC > ibHigh){
      sessionRaid = 'IB_RANGE_EXPANSION_BREAKOUT';
    } else if (!isLong && isFinite(lastC) && lastC < ibLow){
      sessionRaid = 'IB_RANGE_BREAKDOWN_EXPANSION';
    } else {
      sessionRaid = 'INSIDE_ASIAN_RANGE';
    }
  }
  /* The opening block of the window handed to the desk. A later bar that
     takes its low and closes back above it is the same raid, even when
     that wick still falls inside 00:00-07:00 UTC and the clock range
     swallowed it. */
  var winN = Math.min(10, Math.max(3, Math.floor(rows15.length / 3)));
  if (rows15.length > winN){
    var wHi = -Infinity, wLo = Infinity, pLo = Infinity, pHi = -Infinity;
    for (i = 0; i < winN; i++){
      var wh = N(rows15[i].h != null ? rows15[i].h : rows15[i].high);
      var wl = N(rows15[i].l != null ? rows15[i].l : rows15[i].low);
      if (isFinite(wh) && wh > wHi) wHi = wh;
      if (isFinite(wl) && wl < wLo) wLo = wl;
    }
    for (i = winN; i < rows15.length; i++){
      var ph = N(rows15[i].h != null ? rows15[i].h : rows15[i].high);
      var pl = N(rows15[i].l != null ? rows15[i].l : rows15[i].low);
      if (isFinite(pl) && pl < pLo) pLo = pl;
      if (isFinite(ph) && ph > pHi) pHi = ph;
    }
    if (isFinite(wHi) && isFinite(wLo) && wHi > wLo){
      if (isLong && pLo < wLo && isFinite(lastC) && lastC > wLo){
        sessionRaid = 'ASIAN_IB_LOW_SWEEP_RECLAIM';
        ibRaided = true;
        ibHigh = wHi;
        ibLow = wLo;
        asianN = Math.max(asianN, 3);
      } else if (!isLong && pHi > wHi && isFinite(lastC) && lastC < wHi){
        sessionRaid = 'ASIAN_IB_HIGH_SWEEP_REJECT';
        ibRaided = true;
        ibHigh = wHi;
        ibLow = wLo;
        asianN = Math.max(asianN, 3);
      }
    }
  }
  var days = Object.keys(byDay).sort();
  var pdh = null, pdl = null, pdRaided = false;
  if (days.length >= 2 && rows15.length){
    var lastDay = sgBarUtc(rows15[rows15.length - 1]);
    var lastKey = lastDay ? lastDay.toISOString().slice(0, 10) : days[days.length - 1];
    var prevKey = null;
    for (i = 0; i < days.length; i++){ if (days[i] < lastKey) prevKey = days[i]; }
    if (prevKey && isFinite(byDay[prevKey].hi) && isFinite(byDay[prevKey].lo)){
      pdh = +byDay[prevKey].hi.toFixed(2);
      pdl = +byDay[prevKey].lo.toFixed(2);
      var sweptPdl = false, sweptPdh = false;
      for (i = 0; i < rows15.length; i++){
        var dt3 = sgBarUtc(rows15[i]);
        if (!dt3 || dt3.toISOString().slice(0, 10) !== lastKey) continue;
        var bh3 = N(rows15[i].h != null ? rows15[i].h : rows15[i].high);
        var bl3 = N(rows15[i].l != null ? rows15[i].l : rows15[i].low);
        if (isFinite(bl3) && bl3 < pdl) sweptPdl = true;
        if (isFinite(bh3) && bh3 > pdh) sweptPdh = true;
      }
      if (isLong && sweptPdl && isFinite(lastC) && lastC > pdl){
        pdRaided = true;
        if (!ibRaided) sessionRaid = 'PDL_SWEEP_RECLAIM';
      } else if (!isLong && sweptPdh && isFinite(lastC) && lastC < pdh){
        pdRaided = true;
        if (!ibRaided) sessionRaid = 'PDH_SWEEP_REJECT';
      }
    }
  }
  var cascadeState = (htfAligned && ltfAligned && alignedCount >= 4)
    ? 'FULL_FRACTAL_CASCADE'
    : (htfAligned ? 'HTF_DOMINANT_ALIGN' : (ibRaided || pdRaided ? 'LIQUIDITY_RAID_REVERSAL' : (alignedCount > 0 ? 'PARTIAL_ALIGNMENT' : 'UNREAD')));
  var countTxt = (totalTf != null) ? (alignedCount + '/' + totalTf + ' TF') : (alignedCount + ' TF');
  return {
    ok: cascadeState !== 'UNREAD' || sessionRaid !== 'UNREAD',
    alignedCount: alignedCount,
    totalTf: totalTf,
    htfAligned: htfAligned,
    ltfAligned: ltfAligned,
    alignedTimeframes: alignedList,
    cascadeState: cascadeState,
    ibHigh: (asianN >= 3 && isFinite(ibHigh)) ? +ibHigh.toFixed(2) : null,
    ibLow: (asianN >= 3 && isFinite(ibLow)) ? +ibLow.toFixed(2) : null,
    ibRaided: ibRaided,
    pdh: pdh,
    pdl: pdl,
    pdRaided: pdRaided,
    sessionRaid: sessionRaid,
    summary: cascadeState + ' (' + countTxt + ' · ' + sessionRaid + ')'
  };
}

/* Breakeven win rate is 1 / (1 + measured R). A missing reward or a missing
   win estimate stays unread. It is not filled in as 2.2R or 62%. The loss
   is a full 1R, not a made-up 0.88. */
function sgSetupRiskProfile(exp, prec){
  exp = exp || {};
  prec = prec || {};
  var blended = null;
  if (exp.ok === true && isFinite(+exp.rewardR) && +exp.rewardR > 0) blended = +exp.rewardR;
  else if (prec && prec.ok === true && prec.unread !== true && isFinite(+prec.blendedRr) && +prec.blendedRr > 0) blended = +prec.blendedRr;
  var win = (exp.ok === true && isFinite(+exp.estWinPct) && +exp.estWinPct > 0) ? +exp.estWinPct : null;
  var kelly = (exp.ok === true && isFinite(+exp.halfKellyRiskPct) && +exp.halfKellyRiskPct > 0) ? +exp.halfKellyRiskPct : null;
  if (!(blended > 0) || win == null){
    return {
      ok: false, unread: true, breakevenWinPct: null, edgeMarginPct: null,
      streak5DdPct: null, ruinGrade: null,
      why: 'No measured reward or win estimate, so the hurdle is unread'
    };
  }
  var be = +((1 / (1 + blended)) * 100).toFixed(1);
  var edge = +(win - be).toFixed(1);
  var streak = (kelly != null) ? +((1 - Math.pow(1 - kelly / 100, 5)) * 100).toFixed(2) : null;
  var grade = edge >= 30 ? 'FORTRESS' : (edge >= 20 ? 'INSTITUTIONAL' : (edge >= 10 ? 'STANDARD' : 'TIGHT'));
  return {
    ok: true, unread: false, lossR: 1,
    breakevenWinPct: be, edgeMarginPct: edge, streak5DdPct: streak, ruinGrade: grade,
    summary: 'BE hurdle ' + fmt(be, 1) + '% · edge +' + fmt(edge, 1) + '% (' + grade + ')'
      + (streak != null ? (' · 5-loss DD ' + fmt(streak, 2) + '%') : '')
  };
}

/* Prior-day high, low, and midpoint. A daily bar is used when the tape has
   one. Otherwise the split is the UTC date on the 15-minute bars. The first
   half of a single session is not called yesterday. */
function sgDailyBenchmarkLevels(row, intel){
  row = row || {};
  intel = intel || {};
  var side = String(row.dir || row.side || '').toLowerCase();
  if (side === 'buy' || side === 'bull') side = 'long';
  if (side === 'sell' || side === 'bear') side = 'short';
  var isLong = side !== 'short';
  var rows1d = Array.isArray(intel.rows1d) ? intel.rows1d : [];
  var rows15 = Array.isArray(intel.rows15) ? intel.rows15 : [];
  var pdh = NaN, pdl = NaN, sessionOpen = NaN, sourced = null;
  if (rows1d.length >= 2){
    var prevDay = rows1d[rows1d.length - 2];
    var curDay = rows1d[rows1d.length - 1];
    pdh = N(prevDay && (prevDay.h != null ? prevDay.h : prevDay.high));
    pdl = N(prevDay && (prevDay.l != null ? prevDay.l : prevDay.low));
    sessionOpen = N(curDay && (curDay.o != null ? curDay.o : curDay.open));
    sourced = '1d';
  }
  if (!(isFinite(pdh) && isFinite(pdl) && pdh > pdl) && rows15.length){
    var byDay = {};
    for (var i = 0; i < rows15.length; i++){
      var b = rows15[i];
      var dt = sgBarUtc(b);
      if (!dt || !b) continue;
      var key = dt.toISOString().slice(0, 10);
      if (!byDay[key]) byDay[key] = { hi: -Infinity, lo: Infinity, open: NaN };
      var bh = N(b.h != null ? b.h : b.high);
      var bl = N(b.l != null ? b.l : b.low);
      var bo = N(b.o != null ? b.o : b.open);
      if (isFinite(bh) && bh > byDay[key].hi) byDay[key].hi = bh;
      if (isFinite(bl) && bl < byDay[key].lo) byDay[key].lo = bl;
      if (!isFinite(byDay[key].open) && isFinite(bo)) byDay[key].open = bo;
    }
    var days = Object.keys(byDay).sort();
    if (days.length >= 2){
      var prev = byDay[days[days.length - 2]];
      var cur = byDay[days[days.length - 1]];
      pdh = prev.hi;
      pdl = prev.lo;
      sessionOpen = cur.open;
      sourced = '15m-date';
    }
  }
  /* No daily candle and no second date. The first half of a long window is
     the range the later bars are judged against. It is not labeled a
     calendar day. */
  if (!(isFinite(pdh) && isFinite(pdl) && pdh > pdl) && rows15.length >= 12){
    var half = Math.floor(rows15.length / 2);
    var pHi = -Infinity, pLo = Infinity;
    for (i = 0; i < half; i++){
      var hb = rows15[i];
      if (!hb) continue;
      var hh = N(hb.h != null ? hb.h : hb.high);
      var hl = N(hb.l != null ? hb.l : hb.low);
      if (isFinite(hh) && hh > pHi) pHi = hh;
      if (isFinite(hl) && hl < pLo) pLo = hl;
    }
    if (isFinite(pHi) && isFinite(pLo) && pHi > pLo){
      pdh = pHi;
      pdl = pLo;
      var openBar = rows15[half];
      sessionOpen = openBar ? N(openBar.o != null ? openBar.o : openBar.open) : NaN;
      sourced = 'window-half';
    }
  }
  if (!isFinite(pdh) || !isFinite(pdl) || !(pdh > pdl)){
    return { ok: false, pdh: null, pdl: null, pdm: null, sessionOpen: null, amdPhase: 'UNREAD', benchmarkState: 'UNREAD', summary: 'No prior day on the tape, so the benchmark is unread' };
  }
  var pdm = +((pdh + pdl) / 2).toFixed(2);
  var lastClose = NaN;
  if (rows15.length){
    var lb = rows15[rows15.length - 1];
    lastClose = N(lb.c != null ? lb.c : lb.close);
  }
  if (!isFinite(lastClose)) lastClose = N(row.mark);
  var recentLo = Infinity, recentHi = -Infinity;
  var recentSlice = rows15.slice(-Math.min(15, rows15.length));
  for (var r = 0; r < recentSlice.length; r++){
    var rb = recentSlice[r];
    if (!rb) continue;
    var rh = N(rb.h != null ? rb.h : rb.high);
    var rl = N(rb.l != null ? rb.l : rb.low);
    if (isFinite(rl) && rl < recentLo) recentLo = rl;
    if (isFinite(rh) && rh > recentHi) recentHi = rh;
  }
  var benchmarkState = 'INTRADAY_EQUILIBRIUM';
  var amdPhase = 'UNREAD';
  if (side !== 'long' && side !== 'short'){
    benchmarkState = 'UNREAD';
  } else if (isLong && recentLo <= pdl && isFinite(lastClose) && lastClose > pdl){
    benchmarkState = 'PDL_SWEEP_RECLAIM';
    amdPhase = 'MANIPULATION_JUDAS_RAID';
  } else if (!isLong && recentHi >= pdh && isFinite(lastClose) && lastClose < pdh){
    benchmarkState = 'PDH_SWEEP_REJECT';
    amdPhase = 'MANIPULATION_JUDAS_RAID';
  } else if (isLong && isFinite(sessionOpen) && recentLo < sessionOpen && isFinite(lastClose) && lastClose > sessionOpen){
    benchmarkState = 'OPEN_JUDAS_RECLAIM_BULL';
    amdPhase = 'DISTRIBUTION_EXPANSION';
  } else if (!isLong && isFinite(sessionOpen) && recentHi > sessionOpen && isFinite(lastClose) && lastClose < sessionOpen){
    benchmarkState = 'OPEN_JUDAS_REJECT_BEAR';
    amdPhase = 'DISTRIBUTION_EXPANSION';
  } else if (isLong && isFinite(lastClose) && lastClose >= pdm){
    benchmarkState = 'ABOVE_PDM_CONTINUATION';
    amdPhase = 'RELOAD_PULLBACK';
  } else if (!isLong && isFinite(lastClose) && lastClose <= pdm){
    benchmarkState = 'BELOW_PDM_CONTINUATION';
    amdPhase = 'RELOAD_PULLBACK';
  }
  return {
    ok: true,
    source: sourced,
    pdh: +pdh.toFixed(2),
    pdl: +pdl.toFixed(2),
    pdm: pdm,
    sessionOpen: isFinite(sessionOpen) ? +sessionOpen.toFixed(2) : null,
    amdPhase: amdPhase,
    benchmarkState: benchmarkState,
    summary: benchmarkState + ' (PDL ' + fmt(pdl, 2) + ' · PDM ' + fmt(pdm, 2) + ' · PDH ' + fmt(pdh, 2) + ')'
      + (sourced === 'window-half' ? ' · first half of this window, not a calendar day' : '')
  };
}

/* Distance from the live price to the entry. The fill figure is a proximity
   score from that measured distance, not a historical fill rate. No measured
   ATR means no score, and it is not filled in as 4. */
function sgSetupExecutionRadar(row, prec, intel, advGuard, benchmarks){
  row = row || {};
  prec = prec || (row && row.precision) || {};
  advGuard = advGuard || (row && row.adverseSelection) || {};
  benchmarks = benchmarks || (row && row.dailyBenchmarks) || {};
  intel = intel || {};
  var rows15 = Array.isArray(intel.rows15) ? intel.rows15 : [];
  var livePx = N(row.mark);
  if (!isFinite(livePx) && rows15.length){
    var lb = rows15[rows15.length - 1];
    livePx = N(lb && (lb.c != null ? lb.c : lb.close));
  }
  var ePx = (isFinite(+prec.entry) && +prec.entry > 0) ? +prec.entry : N(row.entry);
  var atr = NaN;
  if (prec && prec.unread !== true && isFinite(+prec.atr) && +prec.atr > 0) atr = +prec.atr;
  if (!(atr > 0) && intel.volRegime && intel.volRegime.ok && isFinite(+intel.volRegime.atrNow) && +intel.volRegime.atrNow > 0){
    atr = +intel.volRegime.atrNow;
  }
  if (!(atr > 0)) atr = sgCalcBarsAtr(rows15, 14);
  var distPts = (isFinite(livePx) && isFinite(ePx)) ? +(Math.abs(livePx - ePx).toFixed(2)) : null;
  var distAtr = (distPts != null && isFinite(atr) && atr > 0) ? +(distPts / atr).toFixed(2) : null;
  var fill = null;
  if (distAtr != null){
    var rawFill = Math.round(94 - Math.min(2.5, distAtr) * 26);
    if (advGuard && advGuard.status === 'SAFE_LIMIT') rawFill += 4;
    if (advGuard && advGuard.status === 'KNIFE_HAZARD') rawFill -= 18;
    fill = Math.max(15, Math.min(96, rawFill));
  }
  var splitWeights = (prec && Array.isArray(prec.entryTranches) && prec.entryTranches.length >= 2)
    ? (prec.entryTranches[0].weightPct + '/' + prec.entryTranches[1].weightPct)
    : null;
  var amdPhase = (benchmarks && benchmarks.amdPhase) ? benchmarks.amdPhase : 'UNREAD';
  var knife = advGuard && advGuard.status === 'KNIFE_HAZARD';
  var action = 'Distance unread';
  if (knife){
    action = 'Wait for a 15m reclaim close. The resting limit stays';
  } else if (distPts == null){
    action = 'Distance unread';
  } else if (distAtr != null && distAtr <= 0.35){
    action = 'IMMINENT FILL (' + fmt(distPts, 2) + ' pts / ' + fmt(distAtr, 2) + ' ATR'
      + (fill != null ? (' · ' + fill + '% fill est') : '') + ')';
  } else if (distAtr != null){
    action = (splitWeights || '60/40') + ' limit is ' + fmt(distPts, 2) + ' pts away (' + fmt(distAtr, 2) + ' ATR)';
  } else {
    action = 'Limit is ' + fmt(distPts, 2) + ' pts away. ATR was not measured';
  }
  return {
    ok: distPts != null,
    livePx: isFinite(livePx) ? +livePx.toFixed(2) : null,
    entryPx: isFinite(ePx) ? +ePx.toFixed(2) : null,
    distToEntryPts: distPts,
    distToEntryAtr: distAtr,
    fillProbabilityPct: fill,
    amdPhase: amdPhase,
    splitWeights: splitWeights,
    actionDirective: action
  };
}

/* Volume at price across the last 30 bars. A bar with no volume is left out.
   No measured ATR does not become 3.50, and a missing volume does not become 1. */
function sgIntradayVolumeProfile(rows, side, refEntry){
  if (!Array.isArray(rows) || rows.length < 6){
    return { ok: false, poc: null, vah: null, val: null, lvnLevels: [], profileState: 'UNREAD', nearPoc: false, summary: 'Not enough bars for a volume profile' };
  }
  var isLong = String(side || 'long').toLowerCase() !== 'short';
  var slice = rows.slice(-30);
  var atr = sgCalcBarsAtr(slice, 14);
  var lo = Infinity, hi = -Infinity, bars = [];
  for (var i = 0; i < slice.length; i++){
    var b = slice[i];
    if (!b) continue;
    var bh = N(b.h != null ? b.h : b.high);
    var bl = N(b.l != null ? b.l : b.low);
    var bc = N(b.c != null ? b.c : b.close);
    var bv = N(b.v != null ? b.v : b.vol);
    if (!(isFinite(bh) && isFinite(bl) && isFinite(bc) && bh >= bl)) continue;
    if (bl < lo) lo = bl;
    if (bh > hi) hi = bh;
    if (!(isFinite(bv) && bv > 0)) continue;
    bars.push({ h: bh, l: bl, c: bc, typ: (bh + bl + bc) / 3, v: bv });
  }
  if (!bars.length || !(hi > lo)){
    return { ok: false, poc: null, vah: null, val: null, lvnLevels: [], profileState: 'UNREAD', nearPoc: false, summary: 'No volume on these bars, so the profile is unread' };
  }
  var numBins = 12;
  var step = (hi - lo) / numBins;
  var bins = [];
  for (var bIdx = 0; bIdx < numBins; bIdx++){
    var bLow = lo + bIdx * step;
    var bHigh = bLow + step;
    bins.push({ idx: bIdx, low: bLow, high: bHigh, mid: (bLow + bHigh) / 2, vol: 0 });
  }
  var totalVol = 0;
  for (i = 0; i < bars.length; i++){
    var bar = bars[i];
    for (var j = 0; j < numBins; j++){
      var bn = bins[j];
      var overlap = Math.min(bar.h, bn.high) - Math.max(bar.l, bn.low);
      if (overlap > 0 || (bar.typ >= bn.low && bar.typ <= bn.high)){
        var w = (bar.h > bar.l && overlap > 0) ? (overlap / (bar.h - bar.l)) : (1 / numBins);
        var addV = bar.v * w;
        bn.vol += addV;
        totalVol += addV;
      }
    }
  }
  if (!(totalVol > 0)){
    return { ok: false, poc: null, vah: null, val: null, lvnLevels: [], profileState: 'UNREAD', nearPoc: false, summary: 'No volume on these bars, so the profile is unread' };
  }
  var pocBin = bins[0];
  for (var k = 1; k < numBins; k++){
    if (bins[k].vol > pocBin.vol) pocBin = bins[k];
  }
  var vaVol = pocBin.vol;
  var targetVol = totalVol * 0.70;
  var leftIdx = pocBin.idx, rightIdx = pocBin.idx;
  while (vaVol < targetVol && (leftIdx > 0 || rightIdx < numBins - 1)){
    var leftV = leftIdx > 0 ? bins[leftIdx - 1].vol : -1;
    var rightV = rightIdx < numBins - 1 ? bins[rightIdx + 1].vol : -1;
    if (rightV >= leftV && rightIdx < numBins - 1){
      rightIdx++;
      vaVol += bins[rightIdx].vol;
    } else if (leftIdx > 0){
      leftIdx--;
      vaVol += bins[leftIdx].vol;
    } else break;
  }
  var poc = +pocBin.mid.toFixed(2);
  var val = +bins[leftIdx].low.toFixed(2);
  var vah = +bins[rightIdx].high.toFixed(2);
  var lvnLevels = [];
  for (var m = 1; m < numBins - 1; m++){
    if (bins[m].vol < bins[m - 1].vol * 0.78 && bins[m].vol < bins[m + 1].vol * 0.78){
      lvnLevels.push(+bins[m].mid.toFixed(2));
    }
  }
  var lastClose = bars[bars.length - 1].c;
  var checkPx = (isFinite(+refEntry) && +refEntry > 0) ? +refEntry : lastClose;
  var nearPoc = (isFinite(atr) && atr > 0) ? (Math.abs(checkPx - poc) <= atr * 0.40) : false;
  var recentLo = Infinity, recentHi = -Infinity;
  var tail = bars.slice(-8);
  for (i = 0; i < tail.length; i++){
    if (tail[i].l < recentLo) recentLo = tail[i].l;
    if (tail[i].h > recentHi) recentHi = tail[i].h;
  }
  var profileState = 'INSIDE_VALUE_AREA';
  if (isLong && recentLo < val && lastClose >= val) profileState = 'VAL_SPRING_RECLAIM';
  else if (!isLong && recentHi > vah && lastClose <= vah) profileState = 'VAH_UPTHRUST_REJECT';
  else if (nearPoc) profileState = 'POC_MAGNET_RELOAD';
  else if (isLong && lastClose > vah) profileState = 'VAH_BREAKOUT_ACCEPTANCE';
  else if (!isLong && lastClose < val) profileState = 'VAL_BREAKDOWN_ACCEPTANCE';
  return {
    ok: true, poc: poc, vah: vah, val: val, lvnLevels: lvnLevels, nearPoc: nearPoc,
    profileState: profileState,
    summary: profileState + ' (VAL ' + fmt(val, 2) + ' · POC ' + fmt(poc, 2) + ' · VAH ' + fmt(vah, 2) + ')'
  };
}

/* Spot against the token, only when both prices were read. A missing print
   is unread. It is not a 75 alignment score and it is not a zero premium. */
function sgCrossVenueSmtRead(row, intel, win){
  win = win || W;
  row = row || {};
  var side = String(row.dir || row.side || '').toLowerCase();
  if (side === 'buy' || side === 'bull') side = 'long';
  if (side === 'sell' || side === 'bear') side = 'short';
  var isLong = side !== 'short';
  var sp = null;
  try{
    if (typeof win.goldspotState === 'function') sp = win.goldspotState();
  }catch(eSp){ sp = null; }
  var spotPx = sp && isFinite(N(sp.spot)) && N(sp.spot) > 0 ? N(sp.spot) : NaN;
  var xmPx = sp && isFinite(N(sp.xm)) && N(sp.xm) > 0 ? N(sp.xm) : NaN;
  var paxgPx = sp && isFinite(N(sp.paxg)) && N(sp.paxg) > 0 ? N(sp.paxg) : NaN;
  if (!isFinite(spotPx) || !isFinite(paxgPx) || (side !== 'long' && side !== 'short')){
    return { ok: false, smtState: 'UNREAD', spotVsTokenPremiumUsd: null, brokerDeltaUsd: null, venueAlignmentScore: null, smtConfirmed: false, summary: 'Spot or token price was not read' };
  }
  var prem = +(spotPx - paxgPx).toFixed(2);
  var brokerDelta = isFinite(xmPx) ? +(Math.abs(spotPx - xmPx)).toFixed(2) : null;
  var smtConfirmed = isLong ? (prem >= 0.05 && prem <= 6.0) : (prem <= -0.05 && prem >= -6.0);
  var smtState = Math.abs(prem) > 8.0
    ? 'DIVERGENT_CAUTION'
    : (smtConfirmed ? (isLong ? 'SPOT_LEADING_BULL' : 'SPOT_LEADING_BEAR') : 'LOCKSTEP_CONFIRMATION');
  var alignRaw = 92 + (smtConfirmed ? 6 : 0);
  if (brokerDelta != null) alignRaw -= brokerDelta * 6;
  var venueAlignmentScore = Math.max(40, Math.min(99, Math.round(alignRaw)));
  return {
    ok: true, smtState: smtState, spotVsTokenPremiumUsd: prem, brokerDeltaUsd: brokerDelta,
    venueAlignmentScore: venueAlignmentScore, smtConfirmed: smtConfirmed,
    summary: smtState + ' (Spot vs PAXG ' + (prem >= 0 ? '+' : '') + fmt(prem, 2) + ' USD · align ' + venueAlignmentScore + '/100)'
  };
}

/* How the three targets are sized. Five agreeing timeframes keep more on
   the runner. Compression takes more off at the first target. Anything else
   stays 50/30/20. The target prices are not moved. */
function sgAdaptiveTpSplits(intel, micro, side){
  intel = intel || {};
  micro = micro || {};
  var regime = (intel.volRegime && intel.volRegime.regime) ? String(intel.volRegime.regime).toUpperCase() : '';
  var ft = intel.fiveTf || {};
  var isLong = String(side || 'long').toLowerCase() !== 'short';
  var wantDir = isLong ? 'BULL' : 'BEAR';
  var alignedCnt = isLong ? N(ft.bull) : N(ft.bear);
  var volCommit = N(micro && micro.volCommitmentRatio);
  var strongCascade = (ft.aligned === wantDir && isFinite(alignedCnt) && alignedCnt >= 5)
    || (regime === 'EXPANSION' && isFinite(volCommit) && volCommit >= 1.5);
  var defensiveMode = (regime === 'COMPRESSION') || (ft.aligned && ft.aligned !== 'NONE' && ft.aligned !== wantDir);
  if (strongCascade && !defensiveMode){
    return { t1Pct: 40, t2Pct: 30, t3Pct: 30, splitScheme: 'RUNNER_HEAVY_40_30_30' };
  }
  if (defensiveMode){
    return { t1Pct: 60, t2Pct: 25, t3Pct: 15, splitScheme: 'FRONT_LOADED_60_25_15' };
  }
  return { t1Pct: 50, t2Pct: 30, t3Pct: 20, splitScheme: 'STANDARD_50_30_20' };
}

/* A plan for where the stop could move later. It does not change the desk stop. */
function sgBuildStopRatchetLadder(bestEntry, bestStop, targetT1, targetT2, side){
  var e = +bestEntry, s = +bestStop, t1 = +targetT1, t2 = +targetT2;
  if (!(isFinite(e) && isFinite(s) && isFinite(t1) && isFinite(t2) && e > 0 && s > 0 && t1 > 0 && t2 > 0) || e === s){
    return [];
  }
  var isLong = String(side || 'long').toLowerCase() !== 'short';
  var riskDist = Math.abs(e - s);
  var halfRiskStop = +(isLong ? (e - riskDist * 0.40) : (e + riskDist * 0.40)).toFixed(2);
  var bePlusStop = +(isLong ? (e + riskDist * 0.25) : (e - riskDist * 0.25)).toFixed(2);
  var mfe075Trigger = +(isLong ? (e + riskDist * 0.75) : (e - riskDist * 0.75)).toFixed(2);
  return [
    { stage: 0, code: 'INITIAL_SWEEP_SHIELD', triggerPx: +e.toFixed(2), stopPx: +s.toFixed(2), note: 'The desk stop. It is not moved.' },
    { stage: 1, code: 'MFE_0_75R_RISK_HALVED', triggerPx: mfe075Trigger, stopPx: halfRiskStop, note: 'If price trades +0.75R, the plan tightens the stop to -0.40R' },
    { stage: 2, code: 'TP1_HIT_BE_PLUS_0_25R', triggerPx: +t1.toFixed(2), stopPx: bePlusStop, note: 'If TP1 fills, the plan locks the stop 0.25R past entry' },
    { stage: 3, code: 'TP2_HIT_STRUCTURAL_LOCK', triggerPx: +t2.toFixed(2), stopPx: +t1.toFixed(2), note: 'If TP2 fills, the plan locks the stop at TP1' }
  ];
}

/* Equal highs and equal lows on the last 30 bars, the midpoint of that
   range, and the nearest pool price is drawing toward. No measured ATR
   means the cluster tolerance stays at 35 cents. It is not filled in as
   a 3.50 ATR. The desk entry is not moved. */
function sgSessionLiquidityMap(rows, side, refEntry){
  if (!Array.isArray(rows) || rows.length < 6){
    return { ok: false, eqHighs: [], eqLows: [], drawOnLiquidity: null, equilibrium: null, zonePricing: 'UNREAD', atrUnread: true };
  }
  var isLong = String(side || 'long').toLowerCase() !== 'short';
  var slice = rows.slice(-30);
  var atr = sgCalcBarsAtr(slice, 14);
  var atrUnread = !(isFinite(atr) && atr > 0);
  var eqTol = atrUnread ? 0.35 : Math.max(0.35, atr * 0.22);
  var hi = -Infinity, lo = Infinity;
  var highs = [], lows = [];
  for (var i = 0; i < slice.length; i++){
    var b = slice[i];
    if (!b) continue;
    var bh = N(b.h != null ? b.h : b.high);
    var bl = N(b.l != null ? b.l : b.low);
    if (isFinite(bh)){
      if (bh > hi) hi = bh;
      highs.push({ idx: i, px: bh });
    }
    if (isFinite(bl)){
      if (bl < lo) lo = bl;
      lows.push({ idx: i, px: bl });
    }
  }
  if (!isFinite(hi) || !isFinite(lo) || !(hi > lo)){
    return { ok: false, eqHighs: [], eqLows: [], drawOnLiquidity: null, equilibrium: null, zonePricing: 'UNREAD', atrUnread: atrUnread };
  }
  var eqHighs = [], eqLows = [];
  for (var m = 1; m < highs.length - 1; m++){
    var hCur = highs[m].px;
    if (hCur >= highs[m - 1].px && hCur >= highs[m + 1].px){
      for (var n2 = m + 2; n2 < highs.length; n2++){
        if (Math.abs(highs[n2].px - hCur) <= eqTol){
          eqHighs.push(+((highs[n2].px + hCur) / 2).toFixed(2));
          break;
        }
      }
    }
  }
  for (var m2 = 1; m2 < lows.length - 1; m2++){
    var lCur = lows[m2].px;
    if (lCur <= lows[m2 - 1].px && lCur <= lows[m2 + 1].px){
      for (var n3 = m2 + 2; n3 < lows.length; n3++){
        if (Math.abs(lows[n3].px - lCur) <= eqTol){
          eqLows.push(+((lows[n3].px + lCur) / 2).toFixed(2));
          break;
        }
      }
    }
  }
  var equilibrium = +((hi + lo) / 2).toFixed(2);
  var lastC = N(slice[slice.length - 1].c != null ? slice[slice.length - 1].c : slice[slice.length - 1].close);
  var checkPx = (isFinite(+refEntry) && +refEntry > 0) ? +refEntry : lastC;
  var pctInRange = +(((checkPx - lo) / (hi - lo)) * 100).toFixed(1);
  var zonePricing = pctInRange <= 48 ? 'DISCOUNT' : (pctInRange >= 52 ? 'PREMIUM' : 'EQUILIBRIUM');
  var inFavorableZone = isLong ? (pctInRange <= 55) : (pctInRange >= 45);
  var drawOnLiquidity = isLong
    ? (eqHighs.length
      ? { type: 'BSL_EQH', px: eqHighs[eqHighs.length - 1], label: 'Equal Highs BSL @ ' + fmt(eqHighs[eqHighs.length - 1], 2) }
      : { type: 'BSL_HIGH', px: +hi.toFixed(2), label: 'Session High BSL @ ' + fmt(hi, 2) })
    : (eqLows.length
      ? { type: 'SSL_EQL', px: eqLows[eqLows.length - 1], label: 'Equal Lows SSL @ ' + fmt(eqLows[eqLows.length - 1], 2) }
      : { type: 'SSL_LOW', px: +lo.toFixed(2), label: 'Session Low SSL @ ' + fmt(lo, 2) });
  return {
    ok: true,
    rangeHigh: +hi.toFixed(2),
    rangeLow: +lo.toFixed(2),
    equilibrium: equilibrium,
    pctInRange: pctInRange,
    zonePricing: zonePricing,
    inFavorableZone: inFavorableZone,
    eqHighs: eqHighs,
    eqLows: eqLows,
    drawOnLiquidity: drawOnLiquidity,
    atr: atrUnread ? null : +atr.toFixed(2),
    atrUnread: atrUnread
  };
}

/* A resting limit into an opposing expansion bar is a knife. The speed is
   the last bar's range divided by a measured ATR. No ATR means the speed
   is unread, not a 3.50 stand-in and not a claim that the approach is safe. */
function sgAdverseSelectionGuard(row, prec, intel){
  row = row || {};
  prec = prec || (row && row.precision) || null;
  var side = String((row && (row.dir || row.side)) || (prec && prec.side) || '').toLowerCase();
  var isLong = !(side === 'short' || side === 'sell' || side === 'bear');
  var rows15 = (intel && Array.isArray(intel.rows15)) ? intel.rows15 : [];
  if (rows15.length < 3){
    return {
      ok: false, status: 'UNREAD', executionMode: 'NO_VELOCITY',
      approachVelocityAtr: null, opposingCloseStrength: null,
      why: 'Fewer than 3 bars, so the approach speed is unread'
    };
  }
  var atr = NaN;
  if (prec && prec.unread !== true && isFinite(+prec.atr) && +prec.atr > 0) atr = +prec.atr;
  if (!(atr > 0)) atr = sgCalcBarsAtr(rows15, 14);
  if (!(isFinite(atr) && atr > 0)){
    return {
      ok: false, status: 'UNREAD', executionMode: 'NO_VELOCITY',
      approachVelocityAtr: null, opposingCloseStrength: null,
      why: 'ATR was not measured, so the approach speed is unread'
    };
  }
  var last = rows15[rows15.length - 1];
  var lo = N(last.l != null ? last.l : last.low);
  var hi = N(last.h != null ? last.h : last.high);
  var op = N(last.o != null ? last.o : last.open);
  var cl = N(last.c != null ? last.c : last.close);
  var rng = (isFinite(hi) && isFinite(lo) && hi > lo) ? (hi - lo) : 0;
  var approachVelocityAtr = +(rng / atr).toFixed(2);
  var opposingBar = isLong ? (cl < op) : (cl > op);
  var opposingCloseStrength = 0;
  if (opposingBar && rng > 0){
    opposingCloseStrength = isLong ? +(((hi - cl) / rng).toFixed(2)) : +(((cl - lo) / rng).toFixed(2));
  }
  var status = 'SAFE_LIMIT';
  var executionMode = 'RESTING_LIMIT';
  var why = 'Controlled pullback (' + fmt(approachVelocityAtr, 2) + 'x ATR bar). Resting 60/40 limit.';
  if (opposingBar && approachVelocityAtr >= 1.75 && opposingCloseStrength >= 0.82){
    status = 'KNIFE_HAZARD';
    executionMode = 'CONFIRMATION_CLOSE_ONLY';
    why = 'Opposing expansion bar (' + fmt(approachVelocityAtr, 2) + 'x ATR, ' + Math.round(opposingCloseStrength * 100) + '% close). The resting limit waits for a 15m reclaim close.';
  } else if (opposingBar && approachVelocityAtr >= 1.25 && opposingCloseStrength >= 0.72){
    status = 'WAIT_CANDLE_CLOSE';
    executionMode = 'TRANCHE_2_LIMIT_PLUS_CONFIRM';
    why = 'Elevated opposing momentum (' + fmt(approachVelocityAtr, 2) + 'x ATR). Tranche 1 waits for a rejection wick. Tranche 2 stays the deep reload.';
  }
  return {
    ok: true,
    status: status,
    executionMode: executionMode,
    approachVelocityAtr: approachVelocityAtr,
    opposingCloseStrength: opposingCloseStrength,
    why: why
  };
}

/* 60% at the measured entry, 40% at the nearest deeper level that was
   actually on the tape. No deeper level means both tranches are the same
   price. The desk entry is not moved. */
function sgAttachEntryPlan(prec, micro, regime){
  if (!prec || prec.ok !== true || !(prec.entry > 0)) return prec;
  var entry = +prec.entry;
  var isLong = prec.side !== 'short';
  var deep = null, deepLabel = '';
  function consider(px, label){
    if (!isFinite(px)) return;
    px = +px;
    if (isLong && px < entry && (deep == null || px > deep)){ deep = px; deepLabel = label; }
    if (!isLong && px > entry && (deep == null || px < deep)){ deep = px; deepLabel = label; }
  }
  if (micro && micro.nearestOb) consider(micro.nearestOb.mt, 'OB 50% mean threshold');
  if (micro && micro.nearestFvg) consider(micro.nearestFvg.ce, 'FVG 50% consequent encroachment');
  consider(prec.ote705, 'OTE 70.5%');
  consider(prec.ote618, 'OTE 61.8%');
  var primary = +entry.toFixed(2);
  var second = deep != null ? +((+deep).toFixed(2)) : primary;
  var reg = String(regime || '').toUpperCase();
  var w1 = 60;
  if (reg === 'EXPANSION') w1 = 45;
  else if (micro && micro.absorptionDetected && isFinite(+micro.wickRejectionScore) && +micro.wickRejectionScore >= 82) w1 = 70;
  var w2 = 100 - w1;
  prec.entryTranches = [
    { weightPct: w1, price: primary, label: 'primary structure tap' },
    { weightPct: w2, price: second, label: deep != null ? deepLabel : 'no deeper level measured' }
  ];
  prec.blendedEntry = +((primary * w1 + second * w2) / 100).toFixed(2);
  return prec;
}

/* Win rate is a count of what the tape actually confirmed. Reward is the
   measured blended R. No reward means no expectancy, not a filled-in one. */
function sgCalcSetupExpectancy(row, prec, intel){
  prec = prec || (row && row.precision) || null;
  var reward = (prec && isFinite(+prec.blendedRr) && +prec.blendedRr > 0) ? +prec.blendedRr
    : (prec && isFinite(+prec.rr1) && +prec.rr1 > 0 ? +prec.rr1 : NaN);
  if (!(reward > 0) || (prec && prec.unread === true)){
    return { ok: false, estWinPct: null, expectedValueR: null, halfKellyRiskPct: null, payoffAsymmetry: null, why: 'reward was not measured' };
  }
  var side = String((prec && prec.side) || (row && row.dir) || '').toLowerCase();
  var want = (side === 'short' || side === 'sell' || side === 'bear') ? 'BEAR' : 'BULL';
  var win = 52;
  var ft = intel && intel.fiveTf;
  if (ft && ft.aligned === want) win += 8;
  if (row && row.fusedConviction) win += 4;
  if (row && row.minimalLossPass) win += 4;
  if (row && row.killzone) win += 2;
  if (prec && prec.t1FrontRun) win += 2;
  if (prec && prec.entryTranches && prec.blendedEntry &&
      ((want === 'BULL' && prec.blendedEntry < prec.entry) || (want === 'BEAR' && prec.blendedEntry > prec.entry))) win += 2;
  win = Math.max(35, Math.min(74, win));
  var p = win / 100;
  var ev = +((p * reward) - (1 - p)).toFixed(2);
  var kelly = p - (1 - p) / reward;
  var halfPct = null;
  if (kelly > 0 && ev > 0){
    halfPct = +Math.min(1.5, (kelly / 2) * 5).toFixed(2);
  } else {
    halfPct = 0;
  }
  var payoff = +((p * reward) / Math.max(0.01, 1 - p)).toFixed(2);
  return {
    ok: ev > 0,
    estWinPct: win,
    expectedValueR: ev,
    halfKellyRiskPct: halfPct,
    payoffAsymmetry: payoff,
    rewardR: +reward.toFixed(2),
    summary: 'Win est ' + win + '% · E[R] +' + ev.toFixed(2) + 'R · Half-Kelly risk ' + halfPct.toFixed(2) + '%'
  };
}

/* A limit that price has already run 85% of the way to TP1, and that no
   recent bar has tagged, is a missed fill. A scalp stays valid for 90
   minutes. A swing stays valid for 6 hours. No signal bar means the clock
   is unread, not a full TTL and not an expiry. */
function sgEvaluateSetupDecay(row, prec, intel){
  row = row || {};
  prec = prec || row.precision || {};
  var side = String((prec && prec.side) || row.dir || row.side || '').toLowerCase();
  var isLong = !(side === 'short' || side === 'sell' || side === 'bear');
  var isScalp = String(row.scanner || row.source || '').toLowerCase().indexOf('scalp') >= 0;
  var maxValidMin = isScalp ? 90 : 360;
  var bar = sgCandSec(row, row);
  var ageMin = null;
  var ttlLeftMin = null;
  if (bar){
    ageMin = Math.max(0, Math.round((Math.floor(Date.now() / 1000) - bar) / 60));
    ttlLeftMin = Math.max(0, maxValidMin - ageMin);
  }
  var entry = N(prec.entry != null ? prec.entry : row.entry);
  var t1 = N(prec.t1 != null ? prec.t1 : (row.t1 || row.tp));
  var mark = N(row.mark);
  if (!isFinite(mark) && intel && Array.isArray(intel.rows15) && intel.rows15.length){
    var lb = intel.rows15[intel.rows15.length - 1];
    mark = N(lb && (lb.c != null ? lb.c : lb.close));
  }
  var progress = null;
  var progressToT1Pct = null;
  if (isFinite(entry) && isFinite(t1) && isFinite(mark) && t1 !== entry){
    progress = isLong ? (mark - entry) / (t1 - entry) : (entry - mark) / (entry - t1);
    if (isFinite(progress)) progressToT1Pct = Math.round(Math.max(0, progress * 100));
  }
  var missed = false;
  if (progressToT1Pct != null && progressToT1Pct >= 85 && ((isLong && mark > entry) || (!isLong && mark < entry))){
    var filledOnBar = false;
    var look = (intel && Array.isArray(intel.rows15)) ? intel.rows15.slice(-8) : [];
    for (var bi = 0; bi < look.length; bi++){
      var b = look[bi];
      if (!b) continue;
      var bl = N(b.l != null ? b.l : b.low);
      var bh = N(b.h != null ? b.h : b.high);
      if (isLong && isFinite(bl) && bl <= entry) filledOnBar = true;
      if (!isLong && isFinite(bh) && bh >= entry) filledOnBar = true;
    }
    if (!filledOnBar) missed = true;
  }
  var expired = ageMin != null && ageMin > maxValidMin;
  var aging = !missed && !expired && ageMin != null && ageMin > maxValidMin * 0.65;
  var status = missed ? 'FRONT_RUN_INVALIDATED' : (expired ? 'EXPIRED' : (aging ? 'AGING' : 'FRESH'));
  return {
    ok: true,
    status: status,
    missedBoat: missed === true,
    expired: expired === true,
    progress: progress != null ? +progress.toFixed(2) : null,
    progressToT1Pct: progressToT1Pct,
    ageMin: ageMin,
    ttlLeftMin: ttlLeftMin,
    ageSec: ageMin != null ? ageMin * 60 : null,
    ttlSec: maxValidMin * 60,
    why: missed
      ? ('Price ran ' + progressToT1Pct + '% of the way to TP1 and no recent bar tagged the limit')
      : (expired ? ('The signal bar is older than ' + maxValidMin + ' minutes')
      : (ageMin == null ? 'No signal bar, so the validity clock is unread'
      : ('The limit is still in front of price (' + ttlLeftMin + 'm left)')))
  };
}

/* A tape-only setup, returned beside the desk. It is not pushed onto the
   crown. No aligned side, no unfilled zone, or no marked target means none. */
function sgSynthesizeTapeSetups(intel, riskOpts, win){
  win = win || W;
  if (!intel || intel.ok === false) return [];
  var rows = Array.isArray(intel.rows15) ? intel.rows15 : [];
  if (rows.length < 8) return [];
  var aligned = intel.fiveTf && intel.fiveTf.aligned;
  var side = aligned === 'BULL' ? 'long' : (aligned === 'BEAR' ? 'short' : '');
  if (!side) return [];
  var micro = sgDetectMicrostructureZones(rows, intel, side);
  if (!micro.ok || (!micro.nearestFvg && !micro.nearestOb)) return [];
  var isLong = side === 'long';
  var entry = micro.nearestFvg ? micro.nearestFvg.ce : micro.nearestOb.mt;
  var rawStop = micro.nearestOb
    ? (isLong ? micro.nearestOb.bottom : micro.nearestOb.top)
    : NaN;
  if (!isFinite(entry) || !isFinite(rawStop) || entry === rawStop) return [];
  if (isLong && !(rawStop < entry)) return [];
  if (!isLong && !(rawStop > entry)) return [];
  var items = (intel.structure && intel.structure.ok && Array.isArray(intel.structure.items)) ? intel.structure.items : [];
  var t1 = NaN;
  for (var i = 0; i < items.length; i++){
    var px = N(items[i] && items[i].px);
    if (!(px > 0)) continue;
    if (isLong && px > entry && (!isFinite(t1) || px < t1)) t1 = px;
    if (!isLong && px < entry && (!isFinite(t1) || px > t1)) t1 = px;
  }
  if (!isFinite(t1)) return [];
  var last = sgBarPx(rows[rows.length - 1]);
  var row = {
    id: 'tape-synth-1',
    sym: 'XAUUSD',
    dir: side,
    grade: 'A',
    tier: 'clean',
    entry: +entry.toFixed(2),
    stop: +rawStop.toFixed(2),
    t1: +t1.toFixed(2),
    strategy: micro.nearestFvg ? 'Unmitigated FVG reload' : 'Unmitigated order block reload',
    synthesized: true,
    scanner: 'tape',
    mark: last ? last.c : null,
    barT: last && last.t ? last.t : null
  };
  var prec = sgPrecisionGoldLevels(row, intel);
  if (prec && prec.ok){
    sgAttachEntryPlan(prec, micro, intel && intel.volRegime && intel.volRegime.regime);
    prec.ordered = sgPrecisionOrdered(prec);
    row.precision = prec;
  }
  try{ sgEnhanceSetupFormation(row, intel, null, win); }catch(eSy){}
  row.expectancy = sgCalcSetupExpectancy(row, row.precision, intel);
  return (row.formation && row.expectancy) ? [row] : [];
}

function sgClassifySetupArchetype(row, prec, intel){
  row = row || {};
  prec = prec || row.precision || null;
  intel = intel || null;
  var strat = String(row.strategy || row.stratKey || row.scanner || '').toLowerCase();
  var side = String(row.dir || row.side || 'long').toLowerCase();
  var isLong = (side === 'long' || side === 'buy' || side === 'bull');
  var rows15 = (intel && Array.isArray(intel.rows15) && intel.rows15.length) ? intel.rows15 : [];
  var atr = (prec && isFinite(prec.atr) && prec.atr > 0) ? prec.atr : sgCalcBarsAtr(rows15, 14);

  /* Inspect last 3 closed 15m candles for sweep wick or expansion body */
  var sweepWick = false, displacementBody = false;
  if (rows15.length >= 3){
    var last = rows15[rows15.length - 1];
    var prev = rows15[rows15.length - 2];
    var lo = N(last.l != null ? last.l : last.low);
    var hi = N(last.h != null ? last.h : last.high);
    var op = N(last.o != null ? last.o : last.open);
    var cl = N(last.c != null ? last.c : last.close);
    var pLo = N(prev.l != null ? prev.l : prev.low);
    var pHi = N(prev.h != null ? prev.h : prev.high);
    var rng = hi - lo;
    var body = Math.abs(cl - op);
    if (rng > 0 && body / rng >= 0.58) displacementBody = true;
    if (isLong && isFinite(lo) && isFinite(pLo) && lo < pLo && cl > pLo) sweepWick = true;
    if (!isLong && isFinite(hi) && isFinite(pHi) && hi > pHi && cl < pHi) sweepWick = true;
  }

  var nearOte = !!(prec && prec.ok && isFinite(prec.ote618) && isFinite(atr) && Math.abs(prec.entry - prec.ote618) <= atr * 0.65);
  var nearVwap = !!(prec && prec.ok && isFinite(prec.vwap) && isFinite(atr) && Math.abs(prec.entry - prec.vwap) <= atr * 0.55);
  var volReg = intel && intel.volRegime && intel.volRegime.regime ? String(intel.volRegime.regime) : '';

  if (/judas|sweep|trap|reclaim|stop.?hunt|liq/i.test(strat)){
    return {
      code: 'JUDAS_SWEEP_RECLAIM',
      label: 'JUDAS SWEEP & RECLAIM',
      edgeNote: 'Liquidity pool swept beyond swing extreme with displacement reclaim back inside structure'
    };
  }
  if (/coil|squeeze|breakout|expan|orb/i.test(strat)){
    return {
      code: 'COMPRESSION_COIL_BREAKOUT',
      label: 'COMPRESSION COIL EXPANSION',
      edgeNote: 'Volatility squeeze release with directional displacement candle commitment'
    };
  }
  if (/ob|order.?block|fvg|ote|fib|pullback|gs1|cascade/i.test(strat)){
    return {
      code: 'OTE_ORDER_BLOCK_RELOAD',
      label: 'OTE 61.8% + ORDER BLOCK RELOAD',
      edgeNote: 'Institutional pullback into 61.8%–70.5% Fib OTE & unmitigated structure zone'
    };
  }
  if (sweepWick){
    return {
      code: 'JUDAS_SWEEP_RECLAIM',
      label: 'JUDAS SWEEP & RECLAIM',
      edgeNote: 'Liquidity pool swept beyond swing extreme with displacement reclaim back inside structure'
    };
  }
  if (volReg === 'EXPANSION' && displacementBody){
    return {
      code: 'COMPRESSION_COIL_BREAKOUT',
      label: 'COMPRESSION COIL EXPANSION',
      edgeNote: 'Volatility squeeze release with directional displacement candle commitment'
    };
  }
  if (nearOte){
    return {
      code: 'OTE_ORDER_BLOCK_RELOAD',
      label: 'OTE 61.8% + ORDER BLOCK RELOAD',
      edgeNote: 'Institutional pullback into 61.8%–70.5% Fib OTE & unmitigated structure zone'
    };
  }
  return {
    code: 'VWAP_STRUCTURE_CONFLUENCE',
    label: nearVwap ? 'SESSION VWAP + STRUCTURE DEFENSE' : 'HTF STRUCTURE CONFLUENCE',
    edgeNote: nearVwap
      ? 'Entry anchored at Session VWAP & marked intraday structure confluence'
      : 'Multi-timeframe structural alignment with volatility-buffered invalidation'
  };
}

function sgEnhanceSetupFormation(row, intel, snap, win){
  win = win || W;
  if (!row) return null;
  var prec = row.precision || sgPrecisionGoldLevels(row, intel);
  if (prec && prec.ok) row.precision = prec;
  var arch = sgClassifySetupArchetype(row, prec, intel);
  var side = String(row.dir || row.side || 'long').toLowerCase();
  var isLong = (side === 'long' || side === 'buy' || side === 'bull');
  var tags = [];
  var score = (row.tier === 'clean') ? 72 : 58;

  if (row.fusedConviction){
    score += 8;
    tags.push('SCALP+SWING FUSED');
  }
  if (row.minimalLossPass){
    score += 6;
    tags.push('MIN-LOSS VERIFIED');
  }
  if (prec && prec.ok){
    if (/front-run/i.test(prec.entryReason)){
      score += 4;
      tags.push('OB/STRUCT FRONT-RUN');
    } else if (/OTE/i.test(prec.entryReason)){
      score += 4;
      tags.push('OTE 61.8% RELOAD');
    }
    if (prec.psychShielded){
      score += 3;
      tags.push('SL SHIELDED $' + prec.psychMagnet);
    }
    if (prec.t1FrontRun){
      score += 2;
      tags.push('TP1 WALL FRONT-RUN');
    }
    if (prec.blendedRr >= 2.4){
      score += 3;
      tags.push('BLENDED ' + fmt(prec.blendedRr, 2) + 'R');
    }
  }
  if (intel && intel.fiveTf && intel.fiveTf.aligned && intel.fiveTf.aligned !== 'NONE'){
    var ftWant = isLong ? 'BULL' : 'BEAR';
    if (intel.fiveTf.aligned === ftWant){
      score += 4;
      tags.push((intel.fiveTf.bull || intel.fiveTf.bear || 4) + '/5 TF ' + ftWant);
    }
  }
  var ag = sgCandleAgreement(intel, isLong ? 'long' : 'short');
  if (ag && ag.verdict === 'WITH'){
    score += 3;
    tags.push('15M CANDLE WITH');
  }
  if (row.killzone || (intel && intel.session && intel.session.ok && /LONDON|NY|OVERLAP/i.test(String(intel.session.label || '')))){
    score += 3;
    tags.push(String(row.killzone || (intel.session && intel.session.label) || 'KILLZONE').toUpperCase());
  }
  if (row.demoted) score -= 12;
  if (sgFundBlocked(row)) score -= 25;
  score = Math.max(0, Math.min(99, Math.round(score)));

  var ePx = (prec && prec.ok) ? prec.entry : N(row.entry);
  var sPx = (prec && prec.ok) ? prec.stop : N(row.stop);
  var t1Px = (prec && prec.ok) ? prec.t1 : N(row.t1 || row.tp);
  var t2Px = (prec && prec.ok) ? prec.t2 : N(row.t2 || row.tp2);
  var t3Px = (prec && prec.ok) ? prec.t3 : N(row.t3 || row.tp3);
  var ez = (prec && prec.ok && Array.isArray(prec.entryZone)) ? prec.entryZone : [ePx, ePx];

  var triggerCond = (isLong ? 'Limit buy in zone ' : 'Limit sell in zone ')
    + fmt(ez[0], 2) + '–' + fmt(ez[1], 2) + ' (anchor ' + fmt(ePx, 2) + ') on 15m hold';
  var invalidRule = (isLong ? 'Hard invalidation below ' : 'Hard invalidation above ')
    + fmt(sPx, 2) + (prec && prec.psychShielded ? (' (shielded past $' + prec.psychMagnet + ' sweep level)') : '');
  var sp = (prec && prec.splits && isFinite(+prec.splits.t1Pct)) ? prec.splits : { t1Pct: 50, t2Pct: 30, t3Pct: 20 };
  var scalePlan = sp.t1Pct + '% @ TP1 ' + fmt(t1Px, 2) + ' (shift SL -> BE) · ' + sp.t2Pct + '% @ TP2 ' + fmt(t2Px, 2) + ' (lock TP1) · ' + sp.t3Pct + '% @ TP3 ' + fmt(t3Px, 2);
  var decay = sgEvaluateSetupDecay(row, prec, intel);
  if (decay.status === 'FRONT_RUN_INVALIDATED' || decay.status === 'EXPIRED'){
    score = Math.max(0, score - 25);
    tags.push(decay.status);
  }
  var liqMap = sgSessionLiquidityMap((intel && intel.rows15) || [], isLong ? 'long' : 'short', ePx);
  if (liqMap && liqMap.ok && liqMap.drawOnLiquidity && liqMap.drawOnLiquidity.label){
    tags.push(liqMap.drawOnLiquidity.label);
  }
  var advGuard = sgAdverseSelectionGuard(row, prec, intel);
  if (advGuard.status === 'KNIFE_HAZARD'){
    score = Math.max(0, score - 15);
    tags.push('KNIFE GUARD');
  } else if (advGuard.status === 'SAFE_LIMIT'){
    tags.push('SAFE LIMIT APPROACH');
  } else if (advGuard.status === 'WAIT_CANDLE_CLOSE'){
    tags.push('WAIT FOR CLOSE');
  }
  var exp = sgCalcSetupExpectancy(row, prec, intel);
  var cascade = sgMultiTfFractalCascade(row, intel);
  var riskProfile = sgSetupRiskProfile(exp, prec);
  var benchmarks = sgDailyBenchmarkLevels(row, intel);
  var radar = sgSetupExecutionRadar(row, prec, intel, advGuard, benchmarks);
  var volProf = (prec && prec.volumeProfile && prec.volumeProfile.ok)
    ? prec.volumeProfile
    : sgIntradayVolumeProfile((intel && intel.rows15) || [], isLong ? 'long' : 'short', ePx);
  var smtRead = sgCrossVenueSmtRead(row, intel, win || W);
  var ratchet = (prec && Array.isArray(prec.ratchetLadder) && prec.ratchetLadder.length)
    ? prec.ratchetLadder
    : sgBuildStopRatchetLadder(ePx, sPx, t1Px, t2Px, isLong ? 'long' : 'short');
  if (cascade && cascade.ibRaided && cascade.sessionRaid && cascade.sessionRaid !== 'UNREAD') tags.push(cascade.sessionRaid);
  var tranches = (prec && Array.isArray(prec.entryTranches)) ? prec.entryTranches : [];
  var tranchePlan = (tranches.length >= 2)
    ? (tranches[0].weightPct + '% @ ' + fmt(tranches[0].price, 2) + ' + ' + tranches[1].weightPct + '% @ ' + fmt(tranches[1].price, 2)
      + ' (avg ' + fmt((prec && prec.blendedEntry) || ePx, 2) + ')')
    : '';

  var formation = {
    archetype: arch.code,
    archetypeLabel: arch.label,
    edgeNote: arch.edgeNote,
    qualityScore: score,
    qualityBand: score >= 90 ? 'ELITE' : (score >= 80 ? 'HIGH' : (score >= 70 ? 'SOLID' : 'WATCH')),
    confluenceTags: tags,
    triggerCondition: triggerCond,
    tranchePlan: tranchePlan,
    invalidationRule: invalidRule,
    scalePlan: scalePlan,
    expectancy: exp,
    timeDecay: decay,
    liquidityMap: liqMap,
    adverseSelection: advGuard,
    fractalCascade: cascade,
    riskProfile: riskProfile,
    dailyBenchmarks: benchmarks,
    executionRadar: radar,
    volumeProfile: volProf,
    smtRead: smtRead,
    ratchetLadder: ratchet
  };
  row.formation = formation;
  row.convictionScore = score;
  row.expectancy = exp;
  row.decay = decay;
  row.timeDecay = decay;
  row.adverseSelection = advGuard;
  row.liquidityMap = liqMap;
  row.fractalCascade = cascade;
  row.riskProfile = riskProfile;
  row.dailyBenchmarks = benchmarks;
  row.executionRadar = radar;
  row.volumeProfile = volProf;
  row.smtRead = smtRead;
  row.ratchetLadder = ratchet;
  return formation;
}

function sgFuseCrossDeskSetups(rows, intel, riskOpts){
  if (!Array.isArray(rows) || rows.length < 2) return rows;
  var side = sgMergeSide(rows);
  if (!side) return rows;
  var scalpBest = null, swingBest = null;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || sgFundBlocked(r)) continue;
    var sc = String(r.scanner || r.source || '').toLowerCase();
    if (!scalpBest && sc.indexOf('scalp') >= 0) scalpBest = r;
    if (!swingBest && sc.indexOf('swing') >= 0) swingBest = r;
  }
  if (!scalpBest || !swingBest) return rows;

  /* Fuse Scalp's high-precision entry/stop timing with Swing's extended structural targets */
  var primary = (scalpBest.minimalLossPass && !swingBest.minimalLossPass) ? scalpBest
              : ((swingBest.minimalLossPass && !scalpBest.minimalLossPass) ? swingBest : scalpBest);
  primary.fusedConviction = true;
  primary.fusedWith = (primary === scalpBest) ? (swingBest.id || 'gold-swing') : (scalpBest.id || 'gold-scalp');
  var isLong = (side === 'long');
  if (isFinite(N(swingBest.t1)) && N(swingBest.t1) > 0){
    var swT1 = N(swingBest.t1);
    if ((isLong && swT1 > N(primary.t1)) || (!isLong && swT1 < N(primary.t1))){
      primary.t2 = swT1;
      primary.tp2 = swT1;
    }
  }
  if (isFinite(N(swingBest.t2)) && N(swingBest.t2) > 0){
    var swT2 = N(swingBest.t2);
    if ((isLong && swT2 > N(primary.t2 || primary.t1)) || (!isLong && swT2 < N(primary.t2 || primary.t1))){
      primary.t3 = swT2;
      primary.tp3 = swT2;
    }
  }
  if (String(primary.strategy || '').indexOf('[FUSED]') < 0){
    primary.strategy = (scalpBest.strategy || 'Gold Scalp') + ' + ' + (swingBest.strategy || 'Gold Swing') + ' [FUSED]';
  }
  if (!(primary.precision && primary.precision.ok && primary.precision.unread !== true)){
    var prec = sgPrecisionGoldLevels(primary, intel);
    if (prec && prec.ok) primary.precision = prec;
  }
  return rows;
}

function sgEnhanceArmedSetups(armed, intel){
  if (!Array.isArray(armed) || !armed.length) return [];
  var rows15 = (intel && Array.isArray(intel.rows15) && intel.rows15.length) ? intel.rows15 : [];
  var atr = (intel && intel.volRegime && intel.volRegime.ok && isFinite(+intel.volRegime.atrNow) && +intel.volRegime.atrNow > 0)
    ? +intel.volRegime.atrNow
    : sgCalcBarsAtr(rows15, 14);
  if (!isFinite(atr) || atr <= 0) atr = NaN;
  var lastClose = rows15.length ? N(rows15[rows15.length - 1].c != null ? rows15[rows15.length - 1].c : rows15[rows15.length - 1].close) : NaN;

  return armed.map(function(a){
    if (!a) return a;
    var lvl = N(a.level != null ? a.level : a.entry);
    var dirRaw = String(a.dir || a.side || '').toLowerCase();
    var isLong = (dirRaw === 'short' || dirRaw === 'sell' || dirRaw === 'bear') ? false
               : ((dirRaw === 'long' || dirRaw === 'buy' || dirRaw === 'bull') ? true
               : (isFinite(lastClose) && isFinite(lvl) ? (lvl <= lastClose) : true));
    var side = isLong ? 'long' : 'short';
    var distPts = (isFinite(lastClose) && isFinite(lvl) && lvl > 0) ? +(Math.abs(lastClose - lvl)).toFixed(2) : null;
    var distAtr = (distPts != null && atr > 0) ? +(distPts / atr).toFixed(2) : null;
    var readinessPct = (distAtr != null)
      ? Math.max(15, Math.min(98, Math.round((1 - Math.min(distAtr, 2.5) / 2.5) * 100)))
      : 50;
    var projStop = (isFinite(atr) && atr > 0 && isFinite(lvl) && lvl > 0)
      ? sgPsychShieldStop(isLong ? (lvl - atr * 1.1) : (lvl + atr * 1.1), side).stop
      : null;
    var risk = (isFinite(lvl) && isFinite(projStop)) ? Math.abs(lvl - projStop) : NaN;
    var projT1 = (isFinite(risk) && isFinite(lvl) && lvl > 0) ? +(isLong ? (lvl + risk * 1.8) : (lvl - risk * 1.8)).toFixed(2) : null;
    var projT2 = (isFinite(risk) && isFinite(lvl) && lvl > 0) ? +(isLong ? (lvl + risk * 2.8) : (lvl - risk * 2.8)).toFixed(2) : null;
    return Object.assign({}, a, {
      side: side,
      level: isFinite(lvl) ? +lvl.toFixed(2) : a.level,
      distPts: distPts,
      distAtr: distAtr,
      readinessPct: readinessPct,
      projectedStop: projStop,
      projectedT1: projT1,
      projectedT2: projT2,
      summary: (a.strategy || a.stratKey || 'Forming setup') + ' (' + side.toUpperCase() + ' @ ' + fmt(lvl, 2) + ')'
        + (distPts != null ? (' · ' + fmt(distPts, 2) + ' pts (' + fmt(distAtr, 2) + ' ATR) away · ' + readinessPct + '% ready') : '')
        + (projStop ? (' · proj SL ' + fmt(projStop, 2) + ' / TP1 ' + fmt(projT1, 2)) : '')
    });
  });
}

function sgApplyFormation(snap){
  if (!snap) return snap;
  var intel = snap.intel || null;
  if (Array.isArray(snap.cands) && snap.cands.length){
    snap.cands = sgFuseCrossDeskSetups(snap.cands, intel, defaultRiskOpts(W));
    snap.cands.forEach(function(r){
      try{ sgEnhanceSetupFormation(r, intel, snap, W); }catch(eF){}
    });
    superGoldSortCands(snap.cands);
  }
  if (Array.isArray(snap.armed)) snap.armed = sgEnhanceArmedSetups(snap.armed, intel);
  try{ snap.tapeSetups = intel ? sgSynthesizeTapeSetups(intel, defaultRiskOpts(W), W) : []; }catch(eTape){ snap.tapeSetups = []; }
  return snap;
}

function refineSuperGoldLevels(win, c, hit){
  win = win || W;
  c = c || {};
  if (!hit || !hit.dir) return { ok: false, veto: true, reason: 'no setup' };
  if (c.locked) return { ok: true, veto: false, hit: hit };

  var scanner = String(hit.scanner || 'gold-swing').toLowerCase();
  var style = scanner.indexOf('scalp') >= 0 ? 'gold-scalp' : 'gold-swing';
  var rows15m = c.rows15m || c.m15 || null;
  var rows1h = c.rows1h || null;
  var rows4h = c.rows4h || c.rows || null;

  if (typeof win.hgApplyGoldBestLevels === 'function' && (rows4h || rows15m)){
    try{
      var inp = {
        style: style,
        rows15m: rows15m,
        rows1h: rows1h,
        rows4h: rows4h,
        /* hg-v977: the candidate's own instant (the session boost inside the
           best-levels pass is the BAR's session), the wall clock only when the
           candidate carries none */
        nowMs: sgCandSecOr(c, hit) * 1000,
        rankBoost: hit.tier === 'clean'
      };
      var gc = Object.assign({}, c);
      var bl = win.hgApplyGoldBestLevels(gc, inp);
      if (bl && bl.veto){
        return { ok: false, veto: true, reason: bl.reason || gc.vetoReason || 'levels veto' };
      }
      if (N(gc.entry) > 0) hit.entry = N(gc.entry);
      if (N(gc.stop) > 0) hit.stop = N(gc.stop);
      if (N(gc.t1) > 0) hit.t1 = N(gc.t1);
      if (N(gc.t2) > 0) hit.t2 = N(gc.t2);
      if (N(gc.t3) > 0) hit.t3 = N(gc.t3);
      if (N(gc.rr) > 0) hit.rr = N(gc.rr);
      if (gc.entryType) hit.entryType = gc.entryType;
      if (gc.formationScore != null) hit.formationScore = N(gc.formationScore);
      if (gc.goldRegime) hit.goldRegime = gc.goldRegime;
      if (gc.demoted) hit.demoted = true;
      hit.refined = true;
      hit.planSrc = 'hgApplyGoldBestLevels';
    }catch(e1){}
  }

  try{
    var prec = sgPrecisionGoldLevels(hit, null);
    if (prec && prec.ok) hit.precision = prec;
  }catch(ePrec){}

  return { ok: true, veto: false, hit: hit };
}

function superGoldSortCands(cands){
  if (!Array.isArray(cands)) return;
  cands.sort(function(a, b){
    var am = a.minimalLossPass ? 1 : 0, bm = b.minimalLossPass ? 1 : 0;
    if (bm !== am) return bm - am;
    var af = a.fusedConviction ? 1 : 0, bf = b.fusedConviction ? 1 : 0;
    if (bf !== af) return bf - af;
    var ac = a.tier === 'clean' ? 1 : 0, bc = b.tier === 'clean' ? 1 : 0;
    if (bc !== ac) return bc - ac;
    var at = N(a.tally) || 0, bt = N(b.tally) || 0;
    if (bt !== at) return bt - at;
    var ae = a.refined ? 1 : 0, be = b.refined ? 1 : 0;
    if (be !== ae) return be - ae;
    return (N(b.rr) || 0) - (N(a.rr) || 0);
  });
}

function enrichSuperGoldRow(c, tier, riskOpts, meta){
  meta = meta || {};
  if (!c || !c.dir) return null;
  tier = tier || goldCandTier(c);
  if (!tier) return null;

  var hit = hitFromGoldCand(c, {
    source: meta.source || 'gold',
    tier: tier,
    trigger: tier === 'clean' ? 'grade-a' : 'grade-b',
    venueTag: c.venue,
    scanner: meta.scanner,
    at: meta.at
  });
  if (!hit) return null;

  var refined = refineSuperGoldLevels(W, c, hit);
  if (!refined.ok || refined.veto) return null;
  hit = refined.hit;
  if (hit.demoted && hit.tier === 'clean') hit.tier = 'near';

  riskOpts = riskOpts || defaultRiskOpts();
  var rrForCalc = effectiveGoldRr(hit);
  hit.rr = (rrForCalc > 0) ? rrForCalc : null;
  var calc = (rrForCalc > 0)
    ? goldCalcTrade(riskOpts, hit, rrForCalc)
    : { ok: false, reason: 'No target on the source row' };

  hit.id = hit.id || c.id || [hit.sym, hit.dir, hit.entry, hit.stop, tier, meta.scanner].join('|');
  hit.scanner = meta.scanner || meta.source || 'gold-swing';
  hit.goldAudit = runGoldDeskAudit(W, c, hit);
  hit.sizingPass = calc.ok;

  if (typeof W.goldAttachPositionSize === 'function'){
    try{
      W.goldAttachPositionSize(hit, riskOpts.balance, riskOpts.riskPct);
      if (hit.positionSize && hit.positionSize.error){
        hit.sizingPass = false;
        hit.goldAudit.pass = false;
        hit.goldAudit.reasons = (hit.goldAudit.reasons || []).concat([hit.positionSize.error]);
      } else if (hit.positionSize && !hit.positionSize.error && N(hit.t1) > 0){
        hit.sizingPass = true;
      }
    }catch(eSz){}
  }

  hit.minimalLossPass = hit.tier === 'clean' && hit.sizingPass && hit.goldAudit.pass && !hit.demoted && N(hit.t1) > 0;
  hit.riskPass = hit.sizingPass && hit.goldAudit.pass;
  hit.nearWatch = hit.tier === 'near' && hit.sizingPass && N(hit.entry) > 0 && hit.entry !== hit.stop;
  hit.riskReason = hit.minimalLossPass ? 'PASS'
    : (hit.nearWatch ? 'WATCH — grade B or demoted'
      : ((hit.goldAudit.reasons && hit.goldAudit.reasons.length)
        ? hit.goldAudit.reasons[0] : (calc.reason || 'blocked')));
  hit.calc = calc;
  hit.tp = N(hit.t1) > 0 ? N(hit.t1) : null;
  hit.tp2 = N(hit.t2);
  hit.qty = hit.positionSize && hit.positionSize.positionSizeUnits != null
    ? hit.positionSize.positionSizeUnits : calc.qty;
  hit.notional = hit.positionSize && hit.positionSize.notionalValueUSD != null
    ? hit.positionSize.notionalValueUSD : calc.notional;

  /* SMC CONTEXT — RECORD-ONLY, attached where the ticket is FINISHED: levels
     refined by hgApplyGoldBestLevels, gold desk audit run, spot sizing
     attached, tier/minimalLossPass/riskReason already decided above. Nothing
     here or downstream reads hit.smc — superGoldSortCands, superGoldDeskPill,
     hitToEvaluation and the send-to-trade gate never consult it — so the
     measured gold desk scoring is untouched.
     COVERAGE IS PARTIAL BY CONSTRUCTION. This desk re-presents candidates from
     goldscalpScan() / goldswingScan(), and both publish whitelisted, frozen
     cand objects that DROP the bar arrays, so in practice no candles arrive
     and hgSmcEnrich silently no-ops. The read is wired to exactly the fields
     refineSuperGoldLevels already expects candles on (rows15m / rows1h /
     rows4h / rows), preferring the source scanner's own timeframe, so it
     lights up the moment an upstream hydrates them. A cand that already
     carries .smc from its own desk is copied forward, never re-enriched. */
  if (c.smc && !hit.smc){
    hit.smc = c.smc;
  } else if (!hit.smc){
    var smcIsScalp = String(hit.scanner || '').toLowerCase().indexOf('scalp') >= 0;
    var smcRows = smcIsScalp
      ? (c.rows15m || c.m15 || c.rows1h || c.rows4h || c.rows || null)
      : (c.rows4h || c.rows || c.rows1h || c.rows15m || c.m15 || null);
    try{
      if (typeof W.hgSmcEnrich === 'function' && Array.isArray(smcRows) && smcRows.length){
        W.hgSmcEnrich(hit, { rows: smcRows, tab: 'SUPER GOLD' });
      }
    }catch(eSmc){}
  }
  return hit;
}

/** Ranking context — mirrors gold scalp/swing scan legs (all optional). */
/* hg-v977: ONE instant per ranking pass -- the newest signal bar among the
   candidates being ranked (the ranker's news caution reads it), the wall
   clock only when none carries an instant. */
function sgRankInstant(cands){
  var best = null;
  try{
    (Array.isArray(cands) ? cands : []).forEach(function(c){
      var t = sgCandSec(c, null);
      if (t !== null && (best === null || t > best)) best = t;
    });
  }catch(e){ best = null; }
  return (best !== null) ? best * 1000 : Date.now();
}

function buildGoldRankCtx(win, cands){
  win = win || W;
  var ctx = { now: sgRankInstant(cands), style: 'super-gold' };
  try{
    if (typeof win.hgNewsState === 'function') ctx.news = win.hgNewsState();
  }catch(e0){}
  try{
    if (typeof win.goldSeason === 'function') ctx.season = win.goldSeason(ctx.now);
  }catch(e1){}
  try{
    if (typeof win.getGoldMacroCached === 'function') ctx.macro = win.getGoldMacroCached();
  }catch(e2){}
  try{
    if (typeof win.goldspotState === 'function') ctx.spot = win.goldspotState();
  }catch(e3){}
  try{
    if (typeof win.goldProState === 'function') ctx.goldPro = win.goldProState();
  }catch(e4){}
  return ctx;
}

function rankRawGoldCands(win, rawCands, ctx){
  win = win || W;
  if (!Array.isArray(rawCands) || !rawCands.length) return rawCands || [];
  if (typeof win.goldRankSetups !== 'function') return rawCands.slice();
  try{
    var ranked = win.goldRankSetups(rawCands, ctx || buildGoldRankCtx(win, rawCands));
    if (!ranked || !Array.isArray(ranked.ranked) || !ranked.ranked.length) return rawCands.slice();
    var byId = {};
    rawCands.forEach(function(c){ if (c && c.id) byId[c.id] = c; });
    return ranked.ranked.map(function(c){
      var orig = (c && c.id && byId[c.id]) ? byId[c.id] : c;
      var merged = Object.assign({}, orig, c);
      var origG = orig && orig.grade ? String(orig.grade).toUpperCase() : '';
      if (origG === 'A' || origG === 'B') merged.grade = orig.grade;
      merged.__sgScanner = orig.__sgScanner || merged.__sgScanner;
      merged.__sgAt = orig.__sgAt || merged.__sgAt;
      if (orig.tally != null && merged.tally == null) merged.tally = orig.tally;
      return merged;
    });
  }catch(e){}
  return rawCands.slice();
}

function collectRawGoldDeskCands(win, opts){
  win = win || W;
  opts = opts || {};
  try{ sgInstallGoldScalpTabEnhancer(win); }catch(eInst){}
  var allowStale = opts.allowStale === true;
  var raw = [], armed = [], rejected = [], whySilent = null, scanned = 0, venues = [];

  function snapFresh(snap){
    if (!snap) return false;
    if (allowStale) return true;
    return isFreshAt(snap.at, SNAP_MAX_MS);
  }

  function absorbSnap(snap, scanner){
    if (!snapFresh(snap)) return;
    scanned = Math.max(scanned, snap.at || 0);
    venues.push(scanner);
    if (snap.whySilent) whySilent = snap.whySilent;
    if (Array.isArray(snap.rejected)) rejected = rejected.concat(snap.rejected);
    if (Array.isArray(snap.armed)){
      armed = armed.concat(snap.armed.map(function(a){
        return Object.assign({}, a, { scanner: scanner });
      }));
    }
    (snap.cands || []).forEach(function(c){
      if (!c || c.vetoed || !goldCandTier(c)) return;
      raw.push(Object.assign({}, c, { __sgScanner: scanner, __sgAt: snap.at }));
    });
  }

  var gsFn = win.goldscalpScan;
  if (typeof gsFn === 'function'){ try{ absorbSnap(gsFn(), 'gold-scalp'); }catch(e0){} }
  var gwFn = win.goldswingScan;
  if (typeof gwFn === 'function'){ try{ absorbSnap(gwFn(), 'gold-swing'); }catch(e1){} }

  return { raw: raw, armed: armed, rejected: rejected, whySilent: whySilent, scanned: scanned, venues: venues };
}

function sgSnapFresh(sg){
  if (!sg) return false;
  var t = (sg.sourceAt != null) ? sg.sourceAt : (sg.at || sg.scanAt);
  return isFreshAt(t, SNAP_MAX_MS);
}

function sgBoardSplit(hits){
  var long = false, short = false;
  (Array.isArray(hits) ? hits : []).forEach(function(h){
    if (!h) return;
    if (!(N(h.entry) > 0 && N(h.stop) > 0 && N(h.entry) !== N(h.stop))) return;
    var d = String(h.dir || '').toLowerCase();
    if (d === 'long' || d === 'buy') long = true;
    else if (d === 'short' || d === 'sell') short = true;
  });
  return long && short;
}

function sgMergeSide(rows){
  /* A merged pick needs GOLD SCALP and GOLD SWING on the same side.
     One desk, or a split, is not a conviction. */
  var scalp = { long: false, short: false }, swing = { long: false, short: false };
  (Array.isArray(rows) ? rows : []).forEach(function(h){
    if (!h) return;
    if (!(N(h.entry) > 0 && N(h.stop) > 0 && N(h.entry) !== N(h.stop))) return;
    var d = String(h.dir || '').toLowerCase();
    var side = (d === 'long' || d === 'buy') ? 'long' : ((d === 'short' || d === 'sell') ? 'short' : '');
    if (!side) return;
    var sc = String(h.scanner || h.source || '').toLowerCase();
    var box = sc.indexOf('scalp') >= 0 ? scalp : (sc.indexOf('swing') >= 0 ? swing : null);
    if (box) box[side] = true;
  });
  if (scalp.long && swing.long && !scalp.short && !swing.short) return 'long';
  if (scalp.short && swing.short && !scalp.long && !swing.long) return 'short';
  return '';
}

function sgDeskGap(snap){
  var venues = snap && snap.audit && Array.isArray(snap.audit.venues) ? snap.audit.venues : null;
  if (!venues) return [];
  var miss = [];
  if (venues.indexOf('gold-scalp') < 0) miss.push('GOLD SCALP');
  if (venues.indexOf('gold-swing') < 0) miss.push('GOLD SWING');
  return miss;
}

function superGoldBoardNote(snap){
  snap = snap || {};
  var rows = Array.isArray(snap.cands) ? snap.cands : [];
  var bits = [];
  if (rows.length && !sgSnapFresh(snap)){
    bits.push('Source scan is older than 20 minutes, so nothing is crowned. These rows are the last scan, not a fresh pick.');
  }
  if (sgBoardSplit(rows)){
    bits.push('Scalp and swing do not agree, so nothing is crowned. Both rows stay on the board. No price was blended.');
  } else if (rows.length && !sgMergeSide(rows)){
    var gap = sgDeskGap(snap);
    if (gap.length === 1) bits.push(gap[0] + ' has no fresh scan, so nothing is crowned. Unread is not agreement.');
    else bits.push('Only one desk has a setup, so nothing is crowned. A single desk is not a merged pick.');
  }
  return bits.join(' ');
}

function sgWeekendBannerText(snap){
  var sec = null;
  var rows = snap && Array.isArray(snap.cands) ? snap.cands : [];
  rows.forEach(function(c){
    var t = sgCandSec(c, c);
    if (t !== null && (sec === null || t > sec)) sec = t;
  });
  var clock = false;
  if (sec === null){
    sec = Math.floor(Date.now() / 1000);
    clock = true;
  }
  var txt = '';
  try{
    if (typeof W.hgGoldWeekendReadout === 'function'){
      var rd = W.hgGoldWeekendReadout(sec);
      if (rd && rd.line) txt = String(rd.line);
    } else if (typeof W.hgInGoldWeekend === 'function' && W.hgInGoldWeekend(sec)){
      txt = 'Gold weekend closure — WATCH rows only; GRADE A needs session open + audit pass';
    }
  }catch(eWk){ txt = ''; }
  if (txt && clock) txt += ' (wall clock, no bar time on the board)';
  return txt;
}

function collectSuperGoldScanHits(win){
  win = win || W;
  var hits = [];
  var sgFn = win.superGoldScan;
  if (typeof sgFn === 'function'){
    try{
      var sg = sgFn();
      if (sg && Array.isArray(sg.cands) && sg.cands.length && sgSnapFresh(sg)){
        sg.cands.forEach(function(c){ if (c) hits.push(c); });
      }
    }catch(e0){}
  }
  if (!hits.length){
    var snap = buildSnapFromGoldScans(win, defaultRiskOpts(win));
    if (snap && Array.isArray(snap.cands)) hits = snap.cands.slice();
  }
  return hits;
}

/* hg-v1005: a candidate the fundamental stack has spoken against never
   becomes this desk's pick. The verdict arrives two ways — the source desk's
   demote pass already flipped c.demoted (which sinks the row to WATCH tier),
   and the compact .fund verdict rides the published snapshot for the rows
   that kept their grade. A row the stack refused (blackout carry) or demoted
   is skipped in every pick loop; it still renders on the board as WATCH. */
function sgFundBlocked(h){
  return !!(h && h.fund && (h.fund.refuse === true || h.fund.demote === true));
}

function superGoldEvaluate(win, opts){
  win = win || W;
  opts = opts || {};
  /* hg-v1005: the direction-free red-folder probe — inside a blackout window
     NO fresh setup forms on this desk, in either direction, whatever the
     source snapshots hold. An unchecked calendar answers false and refuses
     nothing (a dark board blocks nothing). */
  var fundBlackout = false;
  try{
    if (typeof win.hgFundamentalBlackout === 'function'){
      fundBlackout = win.hgFundamentalBlackout('XAUUSD') === true;
    }
  }catch(eFB){ fundBlackout = false; }
  if (fundBlackout){
    return { ready: false, idle: true,
      reason: 'EVENT BLACKOUT — a red-folder macro print is inside its window; no fresh setup forms into it' };
  }
  var hits = collectSuperGoldScanHits(win);
  if (!hits.length){
    var shown = null;
    try { shown = (typeof win.superGoldScan === 'function') ? win.superGoldScan() : null; } catch (eShown) { shown = null; }
    if (shown && Array.isArray(shown.cands) && shown.cands.length && !sgSnapFresh(shown)){
      return { ready: false, idle: true,
        reason: 'SOURCE SCAN STALE. The GOLD SCALP and GOLD SWING scan this desk is reading is older than 20 minutes, so nothing is crowned. The rows on the board are the last scan, not a fresh pick.' };
    }
  }
  if (!opts.selectedId && hits.length && !sgMergeSide(hits)){
    var gapSnap = null;
    try { gapSnap = (typeof win.superGoldScan === 'function') ? win.superGoldScan() : null; } catch (eGap) { gapSnap = null; }
    if (!(gapSnap && sgSnapFresh(gapSnap))){
      gapSnap = buildSnapFromGoldScans(win, defaultRiskOpts(win));
    }
    return { ready: false, idle: true,
      reason: superGoldBoardNote(gapSnap) || 'No merged SUPER GOLD pick. Nothing was blended.' };
  }
  var hit = null, i;
  if (opts.selectedId){
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].id === opts.selectedId){ hit = hits[i]; break; }
    }
  }
  if (!hit){
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].minimalLossPass && !sgFundBlocked(hits[i])){ hit = hits[i]; break; }
    }
  }
  if (!hit){
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].tier === 'clean' && !sgFundBlocked(hits[i])){ hit = hits[i]; break; }
    }
  }
  if (!hit && hits.length){
    for (i = 0; i < hits.length; i++){
      if (hits[i] && !sgFundBlocked(hits[i])){ hit = hits[i]; break; }
    }
  }
  if (!hit && hits.length){
    /* every candidate on the board is fundamental-blocked — say so instead
       of crowning one; the board below still shows them as WATCH. */
    return { ready: false, idle: true,
      reason: 'FUNDAMENTAL HEADWIND — every desk candidate is fundamental-blocked right now; the board below still shows them as WATCH' };
  }
  if (!hit || !(N(hit.entry) > 0 && N(hit.stop) > 0)){
    return { ready: false, idle: true, reason: 'No SUPER GOLD setup on desk' };
  }
  return hitToEvaluation(hit);
}

function buildSnapFromGoldScans(win, riskOpts, opts){
  win = win || W;
  riskOpts = riskOpts || defaultRiskOpts(win);
  opts = opts || {};
  var merged = [];
  var audit = { clean: 0, near: 0, minLoss: 0, armedCount: 0, venues: [] };

  var bag = collectRawGoldDeskCands(win, opts);
  var armed = bag.armed;
  var rejected = bag.rejected;
  var whySilent = bag.whySilent;
  var scanned = bag.scanned;
  audit.venues = bag.venues.slice();
  var rankCtx = (opts && opts.rankCtx) ? opts.rankCtx : buildGoldRankCtx(win, bag.raw);
  var rankedRaw = rankRawGoldCands(win, bag.raw, rankCtx);

  rankedRaw.forEach(function(c){
    var tier = goldCandTier(c);
    if (!tier) return;
    var scanner = c.__sgScanner || 'gold-swing';
    var row = enrichSuperGoldRow(c, tier, riskOpts, {
      source: scanner, scanner: scanner, at: c.__sgAt || scanned
    });
    if (row){
      merged.push(row);
      if (tier === 'clean') audit.clean++;
      else audit.near++;
      if (row.minimalLossPass) audit.minLoss++;
    }
  });

  var seen = {};
  merged = merged.filter(function(r){
    if (!r || !r.id) return false;
    if (seen[r.id]) return false;
    seen[r.id] = true;
    return true;
  });
  superGoldSortCands(merged);
  var formed = sgApplyFormation({ cands: merged, armed: armed, intel: null });
  merged = formed.cands;
  armed = formed.armed || armed;
  audit.armedCount = armed.length;

  return {
    at: scanned || Date.now(),
    cands: merged,
    armed: armed,
    rejected: rejected,
    whySilent: whySilent,
    audit: audit,
    sourceAt: scanned || null,
    stat: merged.length
      ? (merged.length + ' gold setups · ' + audit.clean + ' GRADE A · ' + audit.near + ' WATCH · '
        + audit.minLoss + ' trade-ready · ' + audit.armedCount + ' forming')
      : '0 gold setups — run GOLD SCALP + GOLD SWING scan or wait for 15 min cycle'
  };
}

function publishSuperGoldSnap(snap){
  __hgSuperGoldSnap = snap || null;
  /* FORWARD LOG. This desk SELECTS from a pool another tab already records,
     so these are not new trades — they are the same setups after a conviction
     filter. Recording them measures the FILTER: does the desk's pick resolve
     better than the pool it picked from? That is the most direct test of
     whether the conviction layer earns its place.
     The SUPER: prefix marks it as a selection layer so the cross-tab ledger
     can keep it out of distinct-trade totals rather than double-counting. */
  try {
    if (snap && Array.isArray(snap.cands) && snap.cands.length
        && typeof W.hgFwdRecordScan === 'function'){
      W.hgFwdRecordScan('SUPER:GOLD', '4h', snap.cands.filter(function(c){
        return c && c.sym && c.dir
            && isFinite(+c.entry) && isFinite(+c.stop) && isFinite(+c.t1)
            && +c.entry !== +c.stop;
      }).map(function(c){
        var side = sgSnapFresh(snap) ? sgMergeSide(snap.cands) : '';
        var crowned = false;
        if (side){
          var i, row, d;
          for (i = 0; i < snap.cands.length; i++){
            row = snap.cands[i];
            d = String(row && row.dir || '').toLowerCase();
            if (row && row.minimalLossPass && !sgFundBlocked(row) && (d === side || (side === 'long' && d === 'buy') || (side === 'short' && d === 'sell'))){
              crowned = row.id === c.id;
              break;
            }
          }
        }
        return { sym: c.sym, dir: c.dir, entry: +c.entry, stop: +c.stop, t1: +c.t1,
                 mechanic: 'CONVICTION-PICK', ticket: crowned,
                 /* hg-v978: the bar the source desk judged it on */
                 barT: c.barT, signalT: c.signalT,
                 /* hg-v979: the feed the source desk priced the levels on */
                 feed: c.feed,
                 /* hg-v980: the mark the source desk sized it against, so the
                    fill model can tell a resting order from a market one */
                 mark: c.mark };
      }), { horizonBars: 20 });
    }
  } catch (eFwd) { try { if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('super-gold', eFwd); } catch (eW) {} }
  try{ W.HG_superGoldScan = snap; }catch(e){}
  return snap;
}

function mergePublishSuperGoldSnap(nextSnap){
  var prev = superGoldScan() || {};
  return publishSuperGoldSnap(
    (typeof W.hgSuperDeskMergeSnap === 'function')
      ? W.hgSuperDeskMergeSnap(prev, nextSnap || {}, { emptyStatPrefixes: ['0 gold setups', '0 setups'] })
      : Object.assign({}, prev, nextSnap || {})
  );
}

function superGoldScan(){
  return __hgSuperGoldSnap;
}

function syncDeskFromExisting(win, riskOpts){
  win = win || W;
  var snap = buildSnapFromGoldScans(win, riskOpts, { allowStale: true });
  snap.scanAt = __sg.lastScanAt || snap.at || Date.now();
  snap.hydrated = true;
  publishSuperGoldSnap(snap);
  return snap;
}

function autoSelectFirstSetup(snap){
  snap = snap || superGoldScan();
  if (!snap || !Array.isArray(snap.cands) || !snap.cands.length) return null;
  /* hg-v1005: the board's auto-crowned pick answers to the same fundamental
     stack superGoldEvaluate does — never a row the stack refused or demoted,
     and inside a red-folder blackout nothing fresh is crowned at all. An
     explicitly (re)selected card still resolves, so the reader can inspect
     a held row without the desk presenting it as the pick. */
  var fundBlackout = false;
  try{
    if (typeof W.hgFundamentalBlackout === 'function'){
      fundBlackout = W.hgFundamentalBlackout('XAUUSD') === true;
    }
  }catch(eFB){ fundBlackout = false; }
  var hit = null, i;
  if (__sg.selectedId){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && snap.cands[i].id === __sg.selectedId){ hit = snap.cands[i]; break; }
    }
  }
  var holdCrown = !sgSnapFresh(snap) || !sgMergeSide(snap.cands);
  if (!hit && !fundBlackout && !holdCrown){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && snap.cands[i].minimalLossPass && !sgFundBlocked(snap.cands[i])){ hit = snap.cands[i]; break; }
    }
  }
  if (!hit && !fundBlackout && !holdCrown){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && snap.cands[i].tier === 'clean' && !sgFundBlocked(snap.cands[i])){ hit = snap.cands[i]; break; }
    }
  }
  if (!hit && !fundBlackout && !holdCrown){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && !sgFundBlocked(snap.cands[i])){ hit = snap.cands[i]; break; }
    }
  }
  if (hit && hit.id) __sg.selectedId = hit.id;
  return hit;
}

function superGoldAfterScan(snap){
  snap = snap || superGoldScan();
  if (!snap) return;
  try{ sgApplyFormation(snap); }catch(eForm){}
  mergePublishSuperGoldSnap(snap);
  __sg.lastScanMsg = snap.stat || 'done';
  if (__sg.mounted && typeof __sg.setScanStatus === 'function') __sg.setScanStatus(__sg.lastScanMsg);
  if (__sg.mounted && typeof __sg.paintDesk === 'function') __sg.paintDesk(superGoldScan());
  if (__sg.mounted && typeof __sg.applyFirstSetup === 'function') __sg.applyFirstSetup(false);
}

/* hg-v1361: THE DESK INTELLIGENCE READ. One composed snapshot of what the
   wider stack knows about gold right now, computed at scan time (the only
   place this desk already awaits the network) and pinned to the snap so the
   render path never fetches. Every leg composes a shared reader and fails
   closed: a missing engine is UNREAD, never agreement, and nothing here
   moves a crown, a level, or a stop — v1358/v1359 own the crowning rules;
   this layer only says whether the tape, the clock and the calendar agree
   with what was crowned. */
async function superGoldIntel(win, opts){
  win = win || W;
  opts = opts || {};
  var maxRetries = (opts.retries != null && isFinite(+opts.retries)) ? Math.max(0, +opts.retries) : 1;
  var timeoutMs = (opts.timeoutMs != null && isFinite(+opts.timeoutMs)) ? Math.max(500, +opts.timeoutMs) : 5000;
  var out = {
    ok: false, at: Date.now(), fiveTf: null, candle: null, volRegime: null,
    session: null, news: null, feedQuality: null, structure: null, why: '',
    diagnostics: { legsRead: 0, legsTotal: 5, healedLegs: [], missingLegs: [], retriesUsed: 0 }
  };
  var I = win.hgCfIntel;
  function normalizeRows(res){
    if (!res) return null;
    if (Array.isArray(res) && res.length) return res;
    if (res.rows && Array.isArray(res.rows) && res.rows.length) return res.rows;
    if (res.candles && Array.isArray(res.candles) && res.candles.length) return res.candles;
    return null;
  }
  function raceRows(work){
    return Promise.race([
      Promise.resolve().then(work).then(normalizeRows).catch(function(){ return null; }),
      new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, timeoutMs); })
    ]);
  }
  function fetchOnce(tf, n){
    if (typeof win.getGoldCandles !== 'function') return Promise.resolve(null);
    return raceRows(function(){ return win.getGoldCandles(tf, n); });
  }
  function fetchFallback(tf, n){
    if (typeof win.getXAUCandles === 'function'){
      return raceRows(function(){ return win.getXAUCandles(tf, n); });
    }
    if (typeof win.binanceKlines === 'function'){
      return raceRows(function(){ return win.binanceKlines('XAUUSDT', tf, n); });
    }
    return Promise.resolve(null);
  }
  async function pack(tf, n){
    var rows = await fetchOnce(tf, n);
    if (rows && rows.length) return rows;
    var attempt;
    for (attempt = 0; attempt < maxRetries; attempt++){
      out.diagnostics.retriesUsed++;
      rows = await fetchOnce(tf, n);
      if (!rows || !rows.length) rows = await fetchFallback(tf, n);
      if (rows && rows.length){
        out.diagnostics.healedLegs.push(tf);
        return rows;
      }
    }
    out.diagnostics.missingLegs.push(tf);
    return null;
  }
  try{
    var got = await Promise.all([pack('5m', 80), pack('15m', 80), pack('1h', 80), pack('4h', 80), pack('1d', 120)]);
    var rows5 = got[0], rows15 = got[1], rows1h = got[2], rows4h = got[3], rows1d = got[4];
    out.diagnostics.legsRead = [rows5, rows15, rows1h, rows4h, rows1d].filter(function(r){ return Array.isArray(r) && r.length > 0; }).length;
    if (I && typeof I.fiveTf === 'function'){
      try{ out.fiveTf = I.fiveTf({ rows5m: rows5, rows15m: rows15, rows1h: rows1h, rows4h: rows4h, rows1d: rows1d }); }catch(eFt){}
    }
    if (I && typeof I.volRegime === 'function'){
      try{ out.volRegime = I.volRegime(rows15); }catch(eVr){}
    }
    /* hg-v1363: the cone and the closed 15m window, pinned for the render
       path — the crown execution block and the mini chart read these instead
       of fetching. Closed bars only, exactly as the scan received them. */
    if (I && typeof I.forecastCone === 'function'){
      try{ out.cone = I.forecastCone(rows15, { bars: 3 }); }catch(eCn){}
    }
    out.rows15 = Array.isArray(rows15) ? rows15.slice(-60) : null;
    /* hg-v1373: the 5m tape was already fetched for the five-timeframe read.
       Keep that copy. Scalp order flow and the opening range read it.
       A missing 5m tape stays null. Nothing here fetches again. */
    out.rows5 = Array.isArray(rows5) ? rows5.slice(-60) : null;
    /* hg-v1362: the desk's own cross-feed check and structure map, the same
       readers Candle Forecast uses — a crowned level the feeds disagree on,
       or an entry in empty space, is a fact the board should carry. */
    if (I && typeof I.structure === 'function'){
      try{ out.structure = I.structure(rows15); }catch(eSt){}
    }
    if (I && typeof I.feedQuality === 'function'){
      try{
        var legs = [{ name: 'house 15m', rows: rows15 }];
        if (typeof win.binanceKlines === 'function'){
          var legs2 = await Promise.all([
            Promise.race([
              win.binanceKlines('XAUUSDT', '15m', 5).then(function(r){ return { name: 'binance-xau direct', rows: r }; }).catch(function(){ return { name: 'binance-xau direct', rows: null }; }),
              new Promise(function(res){ setTimeout(function(){ res({ name: 'binance-xau direct', rows: null }); }, 5000); })
            ]),
            Promise.race([
              win.binanceKlines('PAXGUSDT', '15m', 5).then(function(r){ return { name: 'binance-paxg direct', rows: r }; }).catch(function(){ return { name: 'binance-paxg direct', rows: null }; }),
              new Promise(function(res){ setTimeout(function(){ res({ name: 'binance-paxg direct', rows: null }); }, 5000); })
            ])
          ]);
          legs = legs.concat(legs2);
        }
        out.feedLegs = legs;
        out.feedQuality = I.feedQuality(legs, 900);
      }catch(eFq){}
    }
    /* the candle engine's own read of the 15m tape — the same engine CANDLE
       FORECAST runs, so the desk and the forecast tab can never disagree
       about what the candles said */
    if (Array.isArray(rows15) && rows15.length >= 30 && typeof win.goldCandleForecast === 'function'){
      try{
        var fc = win.goldCandleForecast(rows15, null, { tf: '15m', cachedDesks: true });
        if (fc){
          out.candle = {
            dir: (fc.dir === 'BULL' || fc.dir === 'BEAR') ? fc.dir : 'NEUTRAL',
            patterns: (Array.isArray(fc.patterns) ? fc.patterns : []).concat(Array.isArray(fc.advancedPatterns) ? fc.advancedPatterns : []),
            close: +fc.close
          };
        }
      }catch(eCf){}
    }
    /* hg-v1361: a matrix of five UNREAD rows is not a read. ok means at
       least one leg actually measured something — a row with a direction,
       a candle answer, or a regime that could be computed. */
    var tfRead = !!(out.fiveTf && (out.fiveTf.bull + out.fiveTf.bear) > 0);
    out.ok = !!(tfRead || out.candle || (out.volRegime && out.volRegime.ok) || (out.feedQuality && out.feedQuality.ok));
    if (!out.ok) out.why = 'the gold tapes could not be read this scan';
  }catch(eAll){
    out.why = 'the desk intel read failed: ' + ((eAll && eAll.message) || eAll);
  }
  /* the clock and the calendar need no tape — read them even when the
     feeds failed, and never let them throw the layer */
  try{ if (I && typeof I.sessionOverlay === 'function') out.session = I.sessionOverlay(); }catch(eSe){}
  try{ if (I && typeof I.news === 'function') out.news = I.news(); }catch(eNw){}
  return out;
}

/* hg-v1361: does the candle engine agree with a crowned side? WITH / AGAINST
   / UNREAD — a display verdict only. A desk that crowned a split is already
   impossible (v1359); this answers the different question of whether the
   15m candles are travelling the crowned way. */
function sgCandleAgreement(intel, side){
  var d = intel && intel.candle && intel.candle.dir;
  if (d !== 'BULL' && d !== 'BEAR') return { verdict: 'UNREAD', why: 'the candle engine named no side' };
  var want = String(side || '').toLowerCase();
  var bull = (want === 'long' || want === 'buy');
  var agree = (bull && d === 'BULL') || (!bull && d === 'BEAR');
  var pats = intel.candle.patterns && intel.candle.patterns.length
    ? intel.candle.patterns.slice(0, 3).join(', ') : 'no named pattern';
  return { verdict: agree ? 'WITH' : 'AGAINST', why: d.toLowerCase() + ' 15m read · ' + pats };
}

/* hg-v1362: THE CROWN CHECKS. The desk crowns by the v1358/v1359 rules;
   this is the printed-checks audit of WHAT was crowned, against the intel
   the scan pinned. Nine checks, each printed, the grade a count — the same
   doctrine as Candle Forecast's setup grade, so a reader never has to learn
   two grading languages. Nothing here uncrowns; a failed check is shown. */
function sgCrownedRow(snap){
  if (!snap || !sgSnapFresh(snap)) return null;
  var rows = Array.isArray(snap.cands) ? snap.cands : [];
  var side = sgMergeSide(rows);
  if (!side) return null;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    var d = String(r && r.dir || '').toLowerCase();
    if (r && r.minimalLossPass && !sgFundBlocked(r)
        && (d === side || (side === 'long' && d === 'buy') || (side === 'short' && d === 'sell'))){
      return { row: r, side: side };
    }
  }
  return null;
}

function sgCrownChecks(snap){
  var out = { ok: false, grade: 'NONE', passed: 0, total: 0, checks: [], crowned: null, side: '', dist: null, why: '' };
  snap = snap || superGoldScan();
  var intel = snap && snap.intel;
  function check(label, passed, note){
    out.checks.push({ label: label, passed: passed === true, note: note || '' });
    out.total++;
    if (passed === true) out.passed++;
  }
  var crowned = sgCrownedRow(snap);
  if (!crowned){
    out.why = 'nothing is crowned — a split board, a stale scan or a single desk crowns nothing, so there is nothing to grade';
    return out;
  }
  var r = crowned.row, side = crowned.side;
  out.crowned = { id: r.id, dir: side, entry: +r.entry, stop: +r.stop, t1: +r.t1, sym: r.sym || 'XAUUSD', scanner: r.scanner || '', mark: N(r.mark) };
  out.side = side;
  check('both desks on one side', true, 'scalp and swing agree ' + side);
  check('the crowned row is GRADE A PASS', r.minimalLossPass === true, r.tier === 'clean' ? 'clean tier' : 'watch tier');
  var ag = sgCandleAgreement(intel, side);
  check('the 15m candles travel with the crown', ag.verdict === 'WITH', ag.why);
  var ft = intel && intel.fiveTf;
  var ftSide = ft && ft.aligned !== 'NONE' ? (ft.aligned === 'BULL' ? 'long' : 'short') : '';
  check('four-of-five timeframes on the crowned side', !!(ftSide && ftSide === side), ft ? String(ft.why) : 'matrix unread');
  var sm = intel && intel.structure;
  var atLoc = false, locNote = 'structure unread';
  if (sm && sm.ok){
    var atr = (intel.volRegime && isFinite(+intel.volRegime.atrNow)) ? +intel.volRegime.atrNow : NaN;
    var nearPx = isFinite(atr) ? atr * 0.5 : NaN;
    (sm.items || []).forEach(function(it){
      if (it && it.px != null && isFinite(+it.px) && isFinite(nearPx) && Math.abs(+it.px - +r.entry) <= nearPx) atLoc = true;
    });
    locNote = atLoc ? 'the entry sits on marked structure' : 'no marked structure within half an ATR of the entry';
  }
  check('the entry is at marked structure', atLoc, locNote);
  var vr = intel && intel.volRegime;
  check('a tradeable volatility regime', !!(vr && vr.ok && (vr.regime === 'NORMAL' || vr.regime === 'EXPANSION')), vr && vr.ok ? vr.regime : 'regime unread');
  var fq = intel && intel.feedQuality;
  check('the feeds agree on the price', !!(fq && fq.ok && !fq.lock), fq ? String(fq.why) : 'feeds unread');
  var nw = intel && intel.news;
  check('no news blackout', !!(nw && nw.ok && !nw.blackout), nw ? String(nw.note || nw.state) : 'calendar unchecked');
  check('no fundamental headwind on the row', !sgFundBlocked(r), (r.fund && r.fund.chips && r.fund.chips.length) ? r.fund.chips.join(', ') : 'no verdict chips');
  var hardFail = !!(fq && fq.lock) || !!(nw && nw.blackout);
  out.grade = hardFail ? 'C' : (out.passed >= 8 ? 'A' : (out.passed >= 6 ? 'B' : 'C'));
  /* the distance read: the mark the source desk sized against vs the entry,
     in dollars and in ATR when the regime measured one */
  try{
    var mk = N(r.mark);
    if (isFinite(mk) && mk > 0 && isFinite(+r.entry)){
      var dAtr = (vr && vr.ok && isFinite(+vr.atrNow) && +vr.atrNow > 0) ? +vr.atrNow : null;
      var dlt = +r.entry - mk;
      out.dist = {
        mark: mk, toEntry: +dlt.toFixed(2),
        toEntryAtr: dAtr ? +(dlt / dAtr).toFixed(2) : null,
        why: 'the sizing mark ' + mk.toFixed(2) + ' sits ' + Math.abs(dlt).toFixed(2)
          + (dAtr ? (' (' + Math.abs(+(dlt / dAtr).toFixed(2)) + ' ATR)') : '')
          + ((dlt === 0) ? ' at' : (((side === 'long') === (dlt > 0)) ? ' away from' : ' past')) + ' the entry'
      };
    }
  }catch(eD){ out.dist = null; }
  out.ok = true;
  out.why = out.passed + ' of ' + out.total + ' checks passed'
    + (hardFail ? ' — a feed lock or a blackout caps the grade at C' : '')
    + '. The grade is a count of printed checks, not a probability. It never uncrowns.';
  return out;
}

/* hg-v1363: THE CROWN EXECUTION STATE. Where the crowned bracket stands
   against the sizing mark RIGHT NOW: ARMED while the mark has not reached
   the entry, TRIGGERED once it trades at or through it, NO-TRADE when
   nothing is crowned. The levels are the crowned row's own; the mark is the
   price the source desk sized against. A crown with no mark is ARMED with
   the trigger unread — never a fabricated fill. */
function sgCrownExecution(snap){
  var out = { state: 'NO-TRADE', side: '', entry: NaN, stop: NaN, t1: NaN, mark: NaN, why: '' };
  var crowned = sgCrownedRow(snap);
  if (!crowned){
    out.why = 'nothing is crowned, so there is nothing to execute';
    return out;
  }
  var r = crowned.row, side = crowned.side;
  var e = +r.entry, s = +r.stop, t1 = +r.t1, mk = N(r.mark);
  out.side = side;
  out.entry = e; out.stop = s; out.t1 = t1;
  if (!(e > 0 && s > 0 && e !== s)){
    out.why = 'the crowned row has no settleable bracket';
    return out;
  }
  if (!isFinite(mk) || !(mk > 0)){
    out.state = 'ARMED';
    out.why = 'crowned ' + side + ' — the sizing mark is unread, so the trigger is unchecked; the bracket waits';
    return out;
  }
  out.mark = mk;
  var through = side === 'long' ? mk <= e : mk >= e;
  out.state = through ? 'TRIGGERED' : 'ARMED';
  out.why = through
    ? 'the mark ' + mk.toFixed(2) + ' has traded at the crowned entry — the bracket is live on its own stop'
    : 'crowned ' + side + ' at ' + e.toFixed(2) + ' — the mark ' + mk.toFixed(2) + ' has not reached it; the order waits';
  return out;
}


/* hg-v1364: the cross-venue tape beside the crown. A display and a dispatch
   gate. It does not move the crowned stop and it does not uncrown. */
function sgTapeDiagnostics(snap, win){
  win = win || W;
  snap = snap || superGoldScan();
  var intel = (snap && snap.intel) || null;
  var crowned = sgCrownedRow(snap);
  var r = crowned && crowned.row;
  var side = crowned ? crowned.side : '';
  var out = {
    ok: false, status: 'UNREAD', lock: false, venues: [],
    maxSpreadUsd: null, spreadBps: null, slippagePts: null, slippageAtr: null,
    healedLegs: (intel && intel.diagnostics && Array.isArray(intel.diagnostics.healedLegs)) ? intel.diagnostics.healedLegs.slice() : [],
    missingLegs: (intel && intel.diagnostics && Array.isArray(intel.diagnostics.missingLegs)) ? intel.diagnostics.missingLegs.slice() : [],
    legsRead: (intel && intel.diagnostics && isFinite(+intel.diagnostics.legsRead)) ? +intel.diagnostics.legsRead : 0,
    why: 'tape diagnostics unread'
  };
  function barClose(b){
    if (!b) return NaN;
    var v = (b.c != null) ? b.c : ((b.close != null) ? b.close : (Array.isArray(b) ? b[4] : NaN));
    return N(v);
  }
  var prices = [];
  if (intel && Array.isArray(intel.rows15) && intel.rows15.length){
    var c15 = barClose(intel.rows15[intel.rows15.length - 1]);
    if (isFinite(c15) && c15 > 0) prices.push({ name: '15m-close', px: c15 });
  }
  if (intel && Array.isArray(intel.feedLegs)){
    intel.feedLegs.forEach(function(leg){
      if (!leg || !Array.isArray(leg.rows) || !leg.rows.length) return;
      var px = barClose(leg.rows[leg.rows.length - 1]);
      if (isFinite(px) && px > 0 && leg.name !== 'house 15m') prices.push({ name: leg.name, px: px });
    });
  }
  try{
    if (typeof win.goldspotState === 'function'){
      var sp = win.goldspotState();
      if (sp){
        if (isFinite(N(sp.spot)) && N(sp.spot) > 0) prices.push({ name: 'spot', px: N(sp.spot) });
        if (isFinite(N(sp.xm)) && N(sp.xm) > 0) prices.push({ name: 'xm', px: N(sp.xm) });
        if (isFinite(N(sp.paxg)) && N(sp.paxg) > 0) prices.push({ name: 'paxg', px: N(sp.paxg) });
        if (isFinite(N(sp.xaut)) && N(sp.xaut) > 0) prices.push({ name: 'xaut', px: N(sp.xaut) });
      }
    }
  }catch(eSp){}
  out.venues = prices;
  var fqLock = !!(intel && intel.feedQuality && intel.feedQuality.lock === true);
  if (prices.length >= 2){
    var pxs = prices.map(function(p){ return p.px; });
    var hi = Math.max.apply(null, pxs), lo = Math.min.apply(null, pxs);
    var ref = pxs[0];
    out.maxSpreadUsd = +(hi - lo).toFixed(2);
    out.spreadBps = ref > 0 ? +(((hi - lo) / ref) * 10000).toFixed(1) : null;
  }
  var atr = (intel && intel.volRegime && intel.volRegime.ok && isFinite(+intel.volRegime.atrNow) && +intel.volRegime.atrNow > 0)
    ? +intel.volRegime.atrNow : null;
  var livePx = prices.length ? prices[0].px : NaN;
  if (r && isFinite(N(r.mark)) && N(r.mark) > 0 && isFinite(livePx) && livePx > 0){
    var rawSlip = livePx - N(r.mark);
    var signedSlip = side === 'short' ? -rawSlip : rawSlip;
    out.slippagePts = +signedSlip.toFixed(2);
    out.slippageAtr = atr ? +(signedSlip / atr).toFixed(2) : null;
  }
  var spreadVeto = (out.maxSpreadUsd != null && out.maxSpreadUsd > 12) || (out.spreadBps != null && out.spreadBps > 45);
  var slipCaution = (out.slippageAtr != null && Math.abs(out.slippageAtr) > 0.75);
  out.lock = fqLock || spreadVeto;
  out.ok = prices.length > 0 || !!(intel && intel.feedQuality && intel.feedQuality.ok);
  if (!out.ok){
    out.status = 'UNREAD';
    out.why = 'no live venue prices on this scan';
  } else if (out.lock){
    out.status = 'LOCKED';
    out.why = fqLock
      ? ('feed quality lock: ' + ((intel.feedQuality && intel.feedQuality.why) || 'cross-feed divergence'))
      : ('cross-venue spread ' + fmt(out.maxSpreadUsd, 2) + ' USD (' + fmt(out.spreadBps, 1) + ' bps) is past the 12 USD / 45 bps guard');
  } else if (slipCaution || out.missingLegs.length || (out.maxSpreadUsd != null && out.maxSpreadUsd > 6)){
    out.status = 'CAUTION';
    var notes = [];
    if (out.maxSpreadUsd != null) notes.push('venue spread $' + fmt(out.maxSpreadUsd, 2));
    if (slipCaution) notes.push('mark-to-tape drift ' + fmt(out.slippagePts, 2) + ' (' + fmt(out.slippageAtr, 2) + ' ATR)');
    if (out.missingLegs.length) notes.push('missing legs: ' + out.missingLegs.join(', '));
    out.why = notes.join(' · ') || 'minor tape caution';
  } else {
    out.status = 'CLEAN';
    var okNotes = [];
    if (out.maxSpreadUsd != null) okNotes.push('venue spread $' + fmt(out.maxSpreadUsd, 2));
    if (out.healedLegs.length) okNotes.push('healed ' + out.healedLegs.join(','));
    out.why = okNotes.join(' · ') || 'feeds aligned';
  }
  return out;
}

/* hg-v1364: what the crowned bracket has done since its own bar.
   The source stop is not moved. A touch of T1 or of the stop is named.
   Bars with no time, and bars from before the signal, are not used. */
function sgCrownLifecycle(snap, win){
  win = win || W;
  snap = snap || superGoldScan();
  var ex = sgCrownExecution(snap);
  var crowned = sgCrownedRow(snap);
  var intel = (snap && snap.intel) || null;
  var out = {
    ok: false, stage: 'STANDBY', side: ex.side || '',
    entry: ex.entry, initialStop: ex.stop, activeStop: ex.stop, t1: ex.t1,
    t2: crowned && crowned.row && isFinite(N(crowned.row.t2)) && N(crowned.row.t2) > 0 ? N(crowned.row.t2) : NaN,
    t3: NaN,
    mark: ex.mark, currentR: null, mfeR: null, maeR: null,
    t1Touched: false, t2Touched: false, t3Touched: false, scalePct: 0,
    stoppedOut: false, invalidated: false,
    invalidationReasons: [], why: 'no crowned bracket on the desk'
  };
  if (!crowned || ex.state === 'NO-TRADE') return out;
  var r = crowned.row, side = crowned.side;
  var e = +r.entry, s = +r.stop, t1 = +r.t1;
  var riskDist = Math.abs(e - s);
  if (!(e > 0 && s > 0 && riskDist > 0)){
    out.why = 'the crowned row has no settleable bracket';
    return out;
  }
  out.ok = true;
  out.activeStop = s;
  var prec = (r.precision && r.precision.ok && isFinite(+r.precision.t3))
    ? r.precision : sgPrecisionGoldLevels(r, intel);
  if (prec && prec.ok){
    if (!(isFinite(out.t2) && out.t2 > 0) && isFinite(+prec.t2)) out.t2 = +prec.t2;
    if (isFinite(+prec.t3) && +prec.t3 > 0) out.t3 = +prec.t3;
  }
  var rows15 = (intel && Array.isArray(intel.rows15)) ? intel.rows15 : [];
  var candSec = sgCandSec(r, r);
  var relevant = [];
  if (candSec !== null){
    rows15.forEach(function(b){
      if (!b) return;
      var bt = b.t != null ? +b.t : (b.time != null ? +b.time : (Array.isArray(b) ? +b[0] : NaN));
      if (!isFinite(bt) || bt <= 0) return;
      var bSec = Math.floor(Math.abs(bt) > 1e12 ? bt / 1000 : bt);
      if (bSec >= candSec) relevant.push(b);
    });
  }
  var latestPx = isFinite(ex.mark) && ex.mark > 0 ? ex.mark : NaN;
  if (ex.state === 'TRIGGERED' && relevant.length){
    var mfePx = isFinite(latestPx) ? latestPx : e;
    var maePx = isFinite(latestPx) ? latestPx : e;
    relevant.forEach(function(b){
      var bh = N(b.h != null ? b.h : b.high);
      var bl = N(b.l != null ? b.l : b.low);
      if (side === 'long'){
        if (isFinite(bh) && bh > mfePx) mfePx = bh;
        if (isFinite(bl) && bl < maePx) maePx = bl;
      } else {
        if (isFinite(bl) && bl < mfePx) mfePx = bl;
        if (isFinite(bh) && bh > maePx) maePx = bh;
      }
    });
    if (isFinite(latestPx)) out.currentR = +((side === 'long' ? (latestPx - e) : (e - latestPx)) / riskDist).toFixed(2);
    out.mfeR = +((side === 'long' ? (mfePx - e) : (e - mfePx)) / riskDist).toFixed(2);
    out.maeR = +((side === 'long' ? (e - maePx) : (maePx - e)) / riskDist).toFixed(2);
    out.stoppedOut = side === 'long' ? (maePx <= s) : (maePx >= s);
    out.t1Touched = (t1 > 0) && (side === 'long' ? (mfePx >= t1) : (mfePx <= t1));
    var t2 = isFinite(+out.t2) && +out.t2 > 0 ? +out.t2 : NaN;
    var t3 = isFinite(+out.t3) && +out.t3 > 0 ? +out.t3 : NaN;
    out.t2Touched = isFinite(t2) && (side === 'long' ? (mfePx >= t2) : (mfePx <= t2));
    out.t3Touched = isFinite(t3) && (side === 'long' ? (mfePx >= t3) : (mfePx <= t3));
    if (out.t3Touched) out.scalePct = 100;
    else if (out.t2Touched) out.scalePct = 80;
    else if (out.t1Touched) out.scalePct = 50;
  } else if (candSec === null){
    out.invalidationReasons.push('the crowned row has no bar time, so the path after the signal was not walked');
  }
  var ag = sgCandleAgreement(intel, side);
  if (ag.verdict === 'AGAINST') out.invalidationReasons.push('15m candles are against the crown');
  var blackoutNow = !!(intel && intel.news && intel.news.blackout);
  try{
    if (!blackoutNow && typeof win.hgFundamentalBlackout === 'function') blackoutNow = win.hgFundamentalBlackout('XAUUSD') === true;
  }catch(eBk){}
  if (blackoutNow){
    out.invalidated = true;
    out.invalidationReasons.push('red-folder macro blackout');
  }
  var tape = sgTapeDiagnostics(snap, win);
  if (tape.lock){
    out.invalidated = true;
    out.invalidationReasons.push('tape locked: ' + tape.why);
  }
  if (out.stoppedOut){
    out.invalidated = true;
    out.invalidationReasons.push('the source stop ' + fmt(s, 2) + ' was traded');
  }
  if (out.invalidated){
    out.stage = 'INVALIDATED';
    out.why = 'The source stop stays at ' + fmt(out.activeStop, 2) + '. ' + out.invalidationReasons.join(' · ');
  } else if (ex.state === 'ARMED'){
    out.stage = 'ARMED';
    out.why = 'Armed ' + side + ' at ' + fmt(e, 2) + '. The source stop stays at ' + fmt(s, 2) + '.'
      + (out.invalidationReasons.length ? (' Caution: ' + out.invalidationReasons.join(' · ') + '.') : '');
  } else if (out.t3Touched){
    out.stage = 'T3_COMPLETE';
    out.why = 'TP3 ' + fmt(out.t3, 2) + ' was traded. The source stop stays at ' + fmt(s, 2) + '.';
  } else if (out.t1Touched){
    out.stage = 'T1 TOUCHED';
    out.why = 'T1 ' + fmt(t1, 2) + ' was traded. The source stop stays at ' + fmt(s, 2) + '. This desk does not trail it.';
  } else {
    out.stage = 'IN POSITION';
    out.why = 'In the crowned bracket. The source stop stays at ' + fmt(s, 2) + '.'
      + (out.currentR != null ? (' Live ' + (out.currentR >= 0 ? '+' : '') + fmt(out.currentR, 2) + 'R.') : ' The path after the signal was not walked.');
  }
  return out;
}

/* ==========================================================================
   hg-v1365: 12-GATE INSTITUTIONAL HIGH-ACCURACY GOLD SCORECARD
   Evaluates the crowned setup across 12 institutional XAUUSD accuracy gates
   and returns the Sniper Precision Entry / SL / TP1-TP2-TP3 plan alongside
   a transparent tier verdict: SNIPER A+ (11-12/12), GRADE A (9-10/12),
   GRADE B (7-8/12), or STAND ASIDE (<7/12 or hard veto).
   ========================================================================== */
function sgHighAccuracyAudit(snap, win){
  win = win || W;
  snap = snap || superGoldScan();
  var out = {
    ok: false,
    tier: 'STAND ASIDE',
    score: 0,
    total: 12,
    accuracyPct: 0,
    hardVeto: false,
    vetoReasons: [],
    gates: [],
    precision: null,
    why: ''
  };
  var crowned = sgCrownedRow(snap);
  if (!crowned){
    out.why = 'No crowned setup on a fresh unified scan';
    return out;
  }
  var r = crowned.row, side = crowned.side;
  var intel = (snap && snap.intel) || null;
  var cc = sgCrownChecks(snap);
  var tape = sgTapeDiagnostics(snap, win);
  var prec = (intel && (intel.volRegime || (Array.isArray(intel.rows15) && intel.rows15.length)))
    ? sgPrecisionGoldLevels(r, intel)
    : (r.precision || sgPrecisionGoldLevels(r, intel));
  out.precision = prec;

  function addGate(id, label, passed, detail, critical){
    var p = passed === true;
    out.gates.push({ id: id, label: label, passed: p, detail: detail || '', critical: !!critical });
    if (p) out.score++;
    else if (critical) out.vetoReasons.push(label + (detail ? ' (' + detail + ')' : ''));
  }

  // Gate 1: Dual-Desk Unanimity
  addGate('G1_DUAL_DESK', 'Scalp + Swing Unanimity', true, 'Both desks aligned ' + side.toUpperCase(), true);

  // Gate 2: 5-Timeframe Trend Alignment
  var ft = intel && intel.fiveTf;
  var ftSide = ft && ft.aligned !== 'NONE' ? (ft.aligned === 'BULL' ? 'long' : 'short') : '';
  addGate('G2_5TF_MATRIX', '5-Timeframe Trend Matrix', !!(ftSide && ftSide === side), ft ? (ft.why || ft.aligned) : 'unread', false);

  // Gate 3: 15m Displacement & Candle Confirmation
  var ag = sgCandleAgreement(intel, side);
  addGate('G3_CANDLE_15M', '15m Candle Displacement', ag.verdict === 'WITH', ag.why, false);

  // Gate 4: Kill-Zone Session Liquidity (London / NY / Overlap)
  var sess = intel && intel.session;
  var sessLbl = sess && sess.label ? String(sess.label).toUpperCase() : '';
  var inKillzone = !!(r.killzone || (sess && sess.ok && !/DEAD|ROLL|CLOSED|WEEKEND/i.test(sessLbl)));
  addGate('G4_KILLZONE', 'London/NY Kill-Zone Liquidity', inKillzone, sessLbl || (r.killzone ? String(r.killzone) : 'session active'), false);

  // Gate 5: Macro Real-Rate & DXY Alignment
  var macroOk = true, macroNote = 'neutral/aligned';
  try{
    if (typeof win.getGoldMacroCached === 'function'){
      var mc = win.getGoldMacroCached();
      var hint = mc && mc.realRateHint ? String(mc.realRateHint).toUpperCase() : '';
      if ((hint === 'HEADWIND' && side === 'long') || (hint === 'TAILWIND' && side === 'short')){
        macroOk = false;
        macroNote = 'real-rate ' + hint + ' opposes ' + side;
      } else if (hint){
        macroNote = 'real-rate ' + hint;
      }
    }
  }catch(eMc){}
  addGate('G5_MACRO_RATES', 'Real-Rate & DXY Filter', macroOk, macroNote, false);

  // Gate 6: Red-Folder News Blackout Clear (Critical)
  var nw = intel && intel.news;
  var bk = !!(nw && nw.blackout);
  try{ if (!bk && typeof win.hgFundamentalBlackout === 'function') bk = win.hgFundamentalBlackout('XAUUSD') === true; }catch(eBk){}
  addGate('G6_NEWS_CLEAR', 'Red-Folder Event Clear', !bk, bk ? 'BLACKOUT ACTIVE' : 'clear', true);

  // Gate 7: Cross-Venue Feed Consensus & Spread Guard (Critical)
  var feedOk = !tape.lock && (tape.status === 'CLEAN' || !!(intel && intel.feedQuality && intel.feedQuality.ok && !intel.feedQuality.lock));
  addGate('G7_VENUE_CONSENSUS', 'Cross-Venue Tape Consensus', feedOk, tape.why || 'feeds aligned', tape.lock);

  // Gate 8: Entry at Structure / OTE 61.8%-70.5% Confluence
  var sm = intel && intel.structure;
  var atStruct = false;
  if (sm && sm.ok && prec && prec.ok){
    (sm.items || []).forEach(function(it){
      if (it && isFinite(+it.px) && Math.abs(+it.px - prec.entry) <= prec.atr * 0.5) atStruct = true;
    });
  }
  var atOte = !!(prec && prec.ok && prec.ote618 != null && Math.abs(prec.entry - prec.ote618) <= prec.atr * 0.6);
  addGate('G8_ENTRY_LOC', 'Structure / OTE 61.8% Entry', atStruct || atOte, prec && prec.ok ? prec.entryReason : 'desk level', false);

  // Gate 9: Sweep-Shielded Stop Geometry (0.8 - 2.6 ATR + Psych Magnet Shield)
  var slOk = !!(prec && prec.ok && prec.stopAtrRatio >= 0.8 && prec.stopAtrRatio <= 3.15);
  addGate('G9_SWEEP_SL', 'Sweep-Shielded Stop Geometry', slOk, prec && prec.ok ? prec.slNote : 'raw stop', false);

  // Gate 10: 3-Tier Asymmetric Target Ladder (TP1 >= 1.5R, Blended >= 2.0R)
  var tpOk = !!(prec && prec.ok && prec.rr1 >= 1.5 && prec.blendedRr >= 2.0);
  addGate('G10_TP_LADDER', '3-Tier TP1/TP2/TP3 Ladder', tpOk,
    prec && prec.ok ? ('TP1 ' + fmt(prec.rr1, 2) + 'R · TP2 ' + fmt(prec.rr2, 2) + 'R · TP3 ' + fmt(prec.rr3, 2) + 'R (Blended ' + fmt(prec.blendedRr, 2) + 'R)') : 'single TP', false);

  // Gate 11: Fundamental Stack Verdict Clear (Critical)
  var fundClear = !sgFundBlocked(r);
  addGate('G11_FUND_STACK', 'Fundamental Stack Clear', fundClear, fundClear ? 'pass' : 'blocked', true);

  // Gate 12: Spot Sizing & Minimal-Loss Audit Pass (Critical)
  var minLossOk = r.minimalLossPass === true;
  addGate('G12_MIN_LOSS', 'Spot Sizing & Desk Audit Pass', minLossOk, minLossOk ? 'GRADE A PASS' : (r.riskReason || 'hold'), true);

  out.ok = true;
  out.hardVeto = out.vetoReasons.length > 0;
  out.accuracyPct = Math.round((out.score / out.total) * 100);
  if (out.hardVeto || out.score < 7){
    out.tier = 'STAND ASIDE';
  } else if (out.score >= 11){
    out.tier = 'SNIPER A+';
  } else if (out.score >= 9){
    out.tier = 'GRADE A';
  } else {
    out.tier = 'GRADE B';
  }
  out.why = out.tier + ' (' + out.score + '/' + out.total + ' gates · ' + out.accuracyPct + '% confluence)'
    + (out.hardVeto ? (' — VETO: ' + out.vetoReasons.join(', ')) : '');
  return out;
}

function sgCrownDispatchPayload(snap, riskOpts, win){
  win = win || W;
  snap = snap || superGoldScan();
  riskOpts = riskOpts || defaultRiskOpts(win);
  var crowned = sgCrownedRow(snap);
  if (!crowned) return { ready: false, reason: 'No crowned setup on a fresh scan' };
  var r = crowned.row, side = crowned.side;
  var cc = sgCrownChecks(snap);
  var ex = sgCrownExecution(snap);
  var lc = sgCrownLifecycle(snap, win);
  var tape = sgTapeDiagnostics(snap, win);
  if (!cc.ok || (cc.grade !== 'A' && cc.grade !== 'B')){
    return { ready: false, reason: 'Crown audit grade ' + (cc.grade || 'NONE') + ' is below B, so nothing is sent' };
  }
  if (tape.lock) return { ready: false, reason: 'Tape locked: ' + tape.why };
  var decay = sgEvaluateSetupDecay(r, r.precision, snap && snap.intel);
  if (decay && decay.missedBoat) return { ready: false, reason: 'Price front-ran the entry. The limit is not chased.' };
  var advSend = sgAdverseSelectionGuard(r, r.precision, snap && snap.intel);
  if (advSend && advSend.status === 'KNIFE_HAZARD'){
    return { ready: false, reason: 'Opposing expansion bar. The resting limit waits for a 15m reclaim close.' };
  }
  if (lc.invalidated || lc.stoppedOut) return { ready: false, reason: lc.why || 'The crown is invalidated' };
  var blackout = false;
  try{
    if (typeof win.hgFundamentalBlackout === 'function') blackout = win.hgFundamentalBlackout('XAUUSD') === true;
  }catch(eB){}
  if (blackout || (snap && snap.intel && snap.intel.news && snap.intel.news.blackout)){
    return { ready: false, reason: 'Red-folder macro blackout' };
  }
  if (sgFundBlocked(r)) return { ready: false, reason: 'The fundamental stack blocked this row' };
  var acc = null;
  try{ acc = sgHighAccuracyAudit(snap, win); }catch(eAcc){ acc = null; }
  if (acc && acc.hardVeto){
    return { ready: false, reason: 'Sniper scorecard stands aside: ' + (acc.vetoReasons.join('; ') || acc.why) };
  }
  var prec = (r.precision && r.precision.ok && r.precision.ordered === true && !r.precision.unread)
    ? r.precision
    : sgPrecisionGoldLevels(r, snap && snap.intel);
  if (prec && prec.ok && prec.ordered !== true) prec.ordered = sgPrecisionOrdered(prec);
  var usePrec = !!(prec && prec.ok && !prec.unread && prec.ordered);
  var sendEntry = usePrec ? +prec.entry : +r.entry;
  var sendStop = usePrec ? +prec.stop : +r.stop;
  var sendT1 = usePrec ? +prec.t1 : +r.t1;
  var sendT2 = usePrec ? +prec.t2 : (isFinite(+r.t2) && +r.t2 > 0 ? +r.t2 : null);
  var sendT3 = usePrec ? +prec.t3 : (isFinite(+r.t3) && +r.t3 > 0 ? +r.t3 : null);
  var rr = (sendEntry > 0 && sendStop > 0 && sendEntry !== sendStop && sendT1 > 0)
    ? Math.abs(sendT1 - sendEntry) / Math.abs(sendEntry - sendStop)
    : effectiveGoldRr(r);
  if (!(rr > 0) || !(sendT1 > 0)) return { ready: false, reason: 'No target on the crowned row' };
  var sized = goldCalcTrade(riskOpts, { entry: sendEntry, stop: sendStop, t1: sendT1 }, rr);
  var oz = NaN;
  if (sized && isFinite(+sized.qty) && +sized.qty > 0) oz = +sized.qty;
  else if (!usePrec && r.positionSize && isFinite(+r.positionSize.positionSizeUnits) && +r.positionSize.positionSizeUnits > 0) oz = +r.positionSize.positionSizeUnits;
  else if (!usePrec && isFinite(+r.qty) && +r.qty > 0) oz = +r.qty;
  if (!(oz > 0)) return { ready: false, reason: 'No size on the crowned row' };
  var barStamp = sgCandSec(r, r);
  if (barStamp === null) return { ready: false, reason: 'The crowned row has no bar time, so no ticket key was invented' };
  var ticketKey = [r.sym || 'XAUUSD', side, sendEntry.toFixed(2), sendStop.toFixed(2), sendT1.toFixed(2), barStamp].join(':');
  return {
    ready: true, ticketKey: ticketKey, fund: 'gold', scanner: 'super-gold',
    source: r.scanner || 'super-gold', strategy: r.strategy || 'SUPER GOLD CROWN',
    sym: r.sym || 'XAUUSD', dir: side, side: side === 'long' ? 'BUY' : 'SELL',
    entry: sendEntry, stop: sendStop, t1: sendT1, t2: sendT2, t3: sendT3,
    rr: +(+rr).toFixed(2), qty: +oz.toFixed(4),
    mark: isFinite(N(r.mark)) ? N(r.mark) : null,
    grade: cc.grade, checksPassed: cc.passed, checksTotal: cc.total,
    accuracyTier: acc ? acc.tier : null,
    accuracyScore: acc ? acc.score : null,
    accuracyTotal: acc ? acc.total : null,
    execState: ex.state, lifecycleStage: lc.stage,
    reason: (acc && acc.tier ? (acc.tier + ' · ') : '') + 'CROWN ' + cc.grade + ' (' + cc.passed + '/' + cc.total + ') · ' + ex.state
  };
}

async function sgPostJson(win, url, body){
  win = win || W;
  if (typeof win.fetch !== 'function') return { ok: false, dryRun: true, reason: 'fetch unavailable', payload: body };
  try{
    var res = await win.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var data = null;
    try{ data = await res.json(); }catch(eJ){ data = { status: res.status }; }
    return { ok: !!(res && res.ok), status: res ? res.status : 0, data: data, payload: body };
  }catch(eNet){
    return { ok: false, error: (eNet && eNet.message) || String(eNet), payload: body };
  }
}

async function sgDispatchToBook(snap, opts){
  opts = opts || {};
  var win = opts.win || W;
  var payload = sgCrownDispatchPayload(snap, opts.riskOpts, win);
  if (!payload.ready) return { ok: false, action: 'book', reason: payload.reason };
  var dedupKey = 'book:' + payload.ticketKey;
  if (!opts.force && __sg.dispatchedKeys[dedupKey]){
    return { ok: false, duplicate: true, action: 'book', ticketKey: payload.ticketKey, reason: 'This crown was already sent to the book' };
  }
  __sg.dispatchedKeys[dedupKey] = Date.now();
  var res;
  if (typeof win.hgBookAddPosition === 'function'){
    try{ res = { ok: true, action: 'book', via: 'hgBookAddPosition', ticketKey: payload.ticketKey, result: await Promise.resolve(win.hgBookAddPosition(payload)), payload: payload }; }
    catch(eB){ delete __sg.dispatchedKeys[dedupKey]; res = { ok: false, action: 'book', reason: (eB && eB.message) || String(eB) }; }
  } else if (typeof win.bookAdd === 'function'){
    try{ res = { ok: true, action: 'book', via: 'bookAdd', ticketKey: payload.ticketKey, result: await Promise.resolve(win.bookAdd('gold', payload)), payload: payload }; }
    catch(eB2){ delete __sg.dispatchedKeys[dedupKey]; res = { ok: false, action: 'book', reason: (eB2 && eB2.message) || String(eB2) }; }
  } else {
    var post = await sgPostJson(win, '/api/book', { action: 'add', fund: 'gold', plan: payload });
    if (!post.ok && !post.dryRun) delete __sg.dispatchedKeys[dedupKey];
    res = Object.assign({ action: 'book', via: '/api/book', ticketKey: payload.ticketKey }, post);
  }
  __sg.lastDispatch = res;
  return res;
}

async function sgDispatchToXm(snap, opts){
  opts = opts || {};
  var win = opts.win || W;
  if (win.XM_OMNIGOLD_BOT === 0 || win.XM_OMNIGOLD_BOT === '0' || win.XM_OMNIGOLD_BOT === false){
    return { ok: false, action: 'xm', reason: 'XM bridge disabled' };
  }
  var payload = sgCrownDispatchPayload(snap, opts.riskOpts, win);
  if (!payload.ready) return { ok: false, action: 'xm', reason: payload.reason };
  var dedupKey = 'xm:' + payload.ticketKey;
  if (!opts.force && __sg.dispatchedKeys[dedupKey]){
    return { ok: false, duplicate: true, action: 'xm', ticketKey: payload.ticketKey, reason: 'This crown was already sent to XM' };
  }
  __sg.dispatchedKeys[dedupKey] = Date.now();
  var xmOrder = {
    symbol: 'XAUUSD', side: payload.side, dir: payload.dir, lots: payload.qty,
    entry: payload.entry, stop: payload.stop, tp1: payload.t1, tp2: payload.t2,
    ticket: true, live: win.XM_OMNIGOLD_LIVE === 1 || win.XM_OMNIGOLD_LIVE === '1' || win.XM_OMNIGOLD_LIVE === true,
    source: 'super-gold', comment: 'HG-SG-' + payload.grade + ' ' + payload.execState
  };
  var res;
  if (typeof win.xmSendOrder === 'function'){
    try{ res = { ok: true, action: 'xm', via: 'xmSendOrder', ticketKey: payload.ticketKey, result: await Promise.resolve(win.xmSendOrder(xmOrder)), order: xmOrder }; }
    catch(eX){ delete __sg.dispatchedKeys[dedupKey]; res = { ok: false, action: 'xm', reason: (eX && eX.message) || String(eX) }; }
  } else {
    var post = await sgPostJson(win, '/api/xm/order', xmOrder);
    if (!post.ok && !post.dryRun) delete __sg.dispatchedKeys[dedupKey];
    res = Object.assign({ action: 'xm', via: '/api/xm/order', ticketKey: payload.ticketKey, order: xmOrder }, post);
  }
  __sg.lastDispatch = res;
  return res;
}

async function sgDispatchBracket(snap, opts){
  opts = opts || {};
  var win = opts.win || W;
  var payload = sgCrownDispatchPayload(snap, opts.riskOpts, win);
  if (!payload.ready) return { ok: false, action: 'execute', reason: payload.reason };
  var dedupKey = 'exec:' + payload.ticketKey;
  if (!opts.force && __sg.dispatchedKeys[dedupKey]){
    return { ok: false, duplicate: true, action: 'execute', ticketKey: payload.ticketKey, reason: 'This crown was already sent' };
  }
  __sg.dispatchedKeys[dedupKey] = Date.now();
  var bracket = {
    sym: payload.sym, dir: payload.dir, side: payload.side, entry: payload.entry,
    stopLoss: payload.stop, takeProfit: payload.t1, takeProfit2: payload.t2,
    qty: payload.qty, fund: 'gold', scanner: 'super-gold', plan: payload
  };
  var res;
  var fn = win.hgExecuteBracket || win.executeBracket;
  if (typeof fn === 'function'){
    try{ res = { ok: true, action: 'execute', via: 'executeBracket', ticketKey: payload.ticketKey, result: await Promise.resolve(fn(bracket)), bracket: bracket }; }
    catch(eE){ delete __sg.dispatchedKeys[dedupKey]; res = { ok: false, action: 'execute', reason: (eE && eE.message) || String(eE) }; }
  } else {
    var post = await sgPostJson(win, '/api/execute', bracket);
    if (!post.ok && !post.dryRun) delete __sg.dispatchedKeys[dedupKey];
    res = Object.assign({ action: 'execute', via: '/api/execute', ticketKey: payload.ticketKey, bracket: bracket }, post);
  }
  __sg.lastDispatch = res;
  return res;
}

/* hg-v1362: the desk's one alert candidate. Published after every scan; the
   collector in tabalerts.js owns dispatch. Alertable means: crowned, GRADE B
   or better on the printed checks, feeds not locked, no blackout. */
function sgPublishAlert(snap){
  try{
    var cc = sgCrownChecks(snap);
    W.__sgCrownChecks = cc;
    var snapAt = (snap && snap.at) || 0;
    W.superGoldAlertState = function(){
      /* hg-v1362: freshness is judged at CALL time. A crown published on a
         fresh scan goes stale twenty minutes later like every other read on
         this desk — the closure carries the stamp and answers null past it,
         so the dispatcher can never fire a bracket the desk has stopped
         standing behind. */
      if (!snapAt || (Date.now() - snapAt) >= SNAP_MAX_MS) return null;
      if (!cc || !cc.ok || !cc.crowned) return null;
      if (cc.grade !== 'A' && cc.grade !== 'B') return null;
      return {
        sym: cc.crowned.sym, dir: cc.crowned.dir,
        entry: cc.crowned.entry, stop: cc.crowned.stop, t1: cc.crowned.t1,
        clean: true, tier: 'CROWN ' + cc.grade,
        note: 'super gold crown ' + cc.grade + ' · ' + cc.passed + '/' + cc.total + ' checks'
      };
    };
  }catch(eAl){ /* an alert is a dispatch, never a reason the desk fails */ }
}

function sgScheduleIntelHeal(win){
  win = win || W;
  if (__sg.intelHealTimer) clearTimeout(__sg.intelHealTimer);
  var snap = superGoldScan();
  if (!snap || !sgSnapFresh(snap)) return;
  var intel = snap.intel;
  var missing = intel && intel.diagnostics && intel.diagnostics.missingLegs;
  var needsHeal = !intel || !intel.ok || (Array.isArray(missing) && missing.length > 0);
  if (!needsHeal || __sg.intelHealCount >= 2) return;
  __sg.intelHealTimer = setTimeout(async function(){
    __sg.intelHealTimer = null;
    if (__sg.scanBusy) return;
    var cur = superGoldScan();
    if (!cur || !sgSnapFresh(cur)) return;
    __sg.intelHealCount++;
    try{
      var healed = await superGoldIntel(win, { retries: 1 });
      if (healed && healed.ok && !(healed.diagnostics && healed.diagnostics.missingLegs && healed.diagnostics.missingLegs.length)){
        cur.intel = healed;
        sgStampPrecision(cur);
        superGoldAfterScan(cur);
        sgPublishAlert(superGoldScan());
      }
    }catch(eH){}
  }, 4000);
}

async function superGoldRunScanInner(opts){
  opts = opts || {};
  __sg.scanBusy = true;
  __sg.intelHealCount = 0;
  __sg.lastScanMsg = 'Scanning GOLD SCALP + GOLD SWING…';
  if (__sg.mounted && typeof __sg.setScanStatus === 'function') __sg.setScanStatus(__sg.lastScanMsg);
  try{
    var gsWarm = W.gsWarm;
    var gwWarm = W.gwWarm;
    if (typeof gsWarm === 'function'){
      __sg.lastScanMsg = 'Gold scalp scan…';
      if (__sg.mounted && typeof __sg.setScanStatus === 'function') __sg.setScanStatus(__sg.lastScanMsg);
      await gsWarm();
    }
    if (typeof gwWarm === 'function'){
      __sg.lastScanMsg = 'Gold swing scan…';
      if (__sg.mounted && typeof __sg.setScanStatus === 'function') __sg.setScanStatus(__sg.lastScanMsg);
      await gwWarm();
    }
    if (typeof W.hgNewsRefresh === 'function'){
      try{ await W.hgNewsRefresh(false); }catch(eN){}
    }
    if (typeof W.getGoldMacro === 'function'){
      try{ await W.getGoldMacro(); }catch(eM){}
    }
    var riskOpts = opts.riskOpts || defaultRiskOpts(W);
    var snap = buildSnapFromGoldScans(W, riskOpts);
    snap.scanAt = Date.now();
    snap.at = snap.scanAt;
    /* hg-v1361: pin the desk intel to the snap. Computed here because this
       is the desk's one async window; the render path below never fetches. */
    try{ snap.intel = await superGoldIntel(W); }catch(eIn){ snap.intel = null; }
    sgStampPrecision(snap);
    __sg.lastScanAt = snap.scanAt;
    superGoldAfterScan(snap);
    sgPublishAlert(superGoldScan());
    sgScheduleIntelHeal(W);
    return snap.cands.length ? ('ok · ' + snap.cands.length + ' setups') : 'ok · 0 setups';
  }catch(e){
    __sg.lastScanMsg = 'Scan error: ' + ((e && e.message) ? e.message : String(e));
    if (__sg.mounted && typeof __sg.setScanStatus === 'function') __sg.setScanStatus(__sg.lastScanMsg);
    return __sg.lastScanMsg;
  }finally{
    __sg.scanBusy = false;
  }
}

async function superGoldRunScan(opts){
  opts = opts || {};
  if (__sg.scanPromise){
    if (opts.force){
      try{ await __sg.scanPromise; }catch(e0){}
    } else {
      return __sg.scanPromise;
    }
  }
  __sg.scanPromise = superGoldRunScanInner(opts).finally(function(){
    __sg.scanPromise = null;
  });
  return __sg.scanPromise;
}

async function superGoldWarm(opts){
  opts = opts || {};
  var stale = !__sg.lastScanAt || (Date.now() - __sg.lastScanAt) >= SCAN_INTERVAL_MS;
  if (stale || opts.force) return superGoldRunScan({ force: !!opts.force });
  return 'fresh';
}

var HG_SUPER_GOLD_STYLE_EXTRA = [
  '.hg-super-gold.hg-super-desk .hg-desk-card.sel{border-color:#a67c12;box-shadow:0 0 0 1px #a67c12}',
  '.hg-super-gold.hg-super-desk .hg-btn.primary{background:linear-gradient(180deg,#b8860b,#8b6914);color:#fff;box-shadow:0 2px 8px rgba(139,105,20,.22)}',
  '.hg-super-gold.hg-super-desk .hg-super-badge{background:#fffbeb;border-color:rgba(166,124,18,.35);color:#8b6914}',
  '.hg-super-gold .hg-armed{font:600 11px/1.45 var(--mono,monospace);color:var(--gold,#a67c12);margin-top:10px;padding:8px 10px;border-radius:var(--radius-sm,6px);background:#fffbeb;border:1px solid rgba(166,124,18,.25)}',
  '.hg-super-gold .hg-weekend{font:600 11px/1.45 var(--mono,monospace);color:var(--short,#dc2626);padding:8px 10px;border-radius:var(--radius-sm,6px);background:#fef2f2;border:1px solid rgba(220,38,38,.2)}'
].join('\n');

function injectStyles(){
  if (typeof W.hgSuperDeskInjectStyles === 'function'){
    W.hgSuperDeskInjectStyles('hg-super-gold-styles', HG_SUPER_GOLD_STYLE_EXTRA);
    return;
  }
  if (W.__hgSuperGoldStyles) return;
  W.__hgSuperGoldStyles = true;
  if (typeof document === 'undefined') return;
  var st = document.createElement('style');
  st.id = 'hg-super-gold-styles';
  st.textContent = HG_SUPER_GOLD_STYLE_EXTRA;
  try{ (document.head || document.documentElement).appendChild(st); }catch(e){}
}

function hitToEvaluation(hit){
  if (!hit || !(N(hit.entry) > 0 && N(hit.stop) > 0)) return { ready: false, idle: true, reason: 'No qualifying gold setup' };
  var tierLabel = hit.tier === 'clean' ? 'GRADE A' : 'WATCH';
  var rr = effectiveGoldRr(hit);
  return {
    ready: true, idle: false, mode: 'scanner',
    trigger: hit.trigger || hit.tier,
    source: hit.source || hit.scanner,
    side: normalizeSide(hit.dir),
    sym: hit.sym,
    tf: hit.scanner || 'gold',
    entry: hit.entry, stop: hit.stop, t1: hit.t1, t2: hit.t2, rr: rr,
    mark: N(hit.mark),
    entryType: hit.entryType,
    minimalLossPass: hit.minimalLossPass,
    goldAudit: hit.goldAudit,
    refined: hit.refined,
    setupType: tierLabel + ' · ' + (hit.strategy || hit.scanner || 'gold'),
    note: tierLabel + ' · ' + (hit.sym || 'XAU') + ' · ' + (hit.venueTag || 'gold desk')
      + (hit.minimalLossPass ? ' · GRADE A PASS'
        : (hit.goldAudit && hit.goldAudit.reasons && hit.goldAudit.reasons.length
          ? (' · hold: ' + hit.goldAudit.reasons[0])
          : (hit.tier === 'near' ? ' · watch only' : ''))),
    hit: hit
  };
}

/* PRICE MAY HAVE WALKED THROUGH THIS PLAN ALREADY — the shared rule in
   hg-plan.js, judged against the mark the SOURCE desk sized the candidate
   against (forwarded through hitFromGoldCand / hitToEvaluation). Silent
   without a mark: super-gold has no price feed of its own, and goldspotState
   carries only basis, so a missing mark here is normal and must not be
   reported as a clean plan. */
function sgGeoLine(r){
  try{
    var fn = (typeof win !== 'undefined' && win && win.hgPlanGeometryLineHtml)
      || (typeof window !== 'undefined' && window && window.hgPlanGeometryLineHtml) || null;
    if (typeof fn !== 'function' || !r) return '';
    return fn({ dir: r.side || r.dir, entry: r.entry, stop: r.stop, t1: r.t1 },
              r.mark, { cls: 'hg-desk-note' }) || '';
  }catch(e){ return ''; }
}

function mount(el){
  if (!el) return;
  injectStyles();
  var scoreLink = (typeof W.hgSuperDeskScorecardLink === 'function')
    ? W.hgSuperDeskScorecardLink(TAB_ID) : '';
  el.innerHTML = [
    '<section class="hg-tab hg-super-desk hg-super-gold">',
    '  <div class="hg-super-head">',
    '    <div>',
    '      <div class="hg-title">Super Gold</div>',
    '      <div class="hg-note">Conviction desk — merges GOLD SCALP + GOLD SWING. GRADE A + audit + spot sizing = trade-ready.</div>',
    '    </div>',
    '    <div class="hg-super-badge">Super Gold · GRADE desk</div>',
    '  </div>',
    '  <div id="sg-validation"></div>',
    '  <div id="sg-intel"></div>',
    '  <div class="hg-weekend" id="sg-weekend" style="display:none"></div>',
    '  <div class="hg-super-grid">',
    '    <div class="hg-card"><h3>Gold Universe Desk</h3>',
    '      <div class="hg-scan-stat" id="sg-scan-stat">Next scan on tab open · 15 min cycle</div>',
    '      <div class="hg-actions">',
    '        <button type="button" class="hg-btn primary" id="sg-run-scan">Scan gold desks now</button>',
    '        <button type="button" class="hg-btn secondary" id="sg-open-scalp">Gold Scalp →</button>',
    '        <button type="button" class="hg-btn secondary" id="sg-open-swing">Gold Swing →</button>',
    '      </div>',
    '      <div class="hg-desk" id="sg-desk"></div>',
    '      <div class="hg-armed" id="sg-armed" style="display:none"></div>',
    '    </div>',
    '    <div class="hg-card"><h3>Trade Context</h3>',
    '      <div class="hg-form">',
    '        <div class="hg-field"><label for="sg-symbol">Symbol</label><input id="sg-symbol" readonly value="—" /></div>',
    '        <div class="hg-field"><label for="sg-side">Direction</label><input id="sg-side" readonly value="—" /></div>',
    '        <div class="hg-field"><label for="sg-balance">Balance USD</label><input id="sg-balance" type="number" value="1000" step="0.01" /></div>',
    '        <div class="hg-field"><label for="sg-risk">Risk %</label><input id="sg-risk" type="number" value="1" step="0.01" /></div>',
    '        <div class="hg-field"><label for="sg-entry">Entry</label><input id="sg-entry" readonly /></div>',
    '        <div class="hg-field"><label for="sg-stop">Stop</label><input id="sg-stop" readonly /></div>',
    '        <div class="hg-field"><label for="sg-t1">T1</label><input id="sg-t1" readonly /></div>',
    '        <div class="hg-field"><label for="sg-size">Size (oz)</label><input id="sg-size" readonly /></div>',
    '      </div>',
    '      <div class="hg-note" id="sg-guidance" style="margin-top:10px"></div>',
    '      <div class="hg-actions" style="margin-top:10px">',
    '        <button type="button" class="hg-btn primary" id="sg-send-trade" disabled>Send to Trade Plan</button>',
    '      </div>',
    '      <div style="margin-top:10px">' + scoreLink + '</div>',
    '    </div>',
    '  </div>',
    '</section>'
  ].join('\n');

  var root = el.querySelector('.hg-super-gold') || el;
  __sg.root = root;
  function $(id){ return root.querySelector(id); }

  function readRiskOpts(){
    var balance = N($('#sg-balance') && $('#sg-balance').value);
    var riskPct = N($('#sg-risk') && $('#sg-risk').value);
    return {
      balance: (Number.isFinite(balance) && balance > 0) ? balance : 1000,
      riskPct: (Number.isFinite(riskPct) && riskPct > 0) ? riskPct : 1
    };
  }

  function applyEvaluation(ev){
    var hit = ev && ev.hit;
    __sg.selectedHit = hit || null;
    if (!ev || !ev.ready){
      if ($('#sg-send-trade')) $('#sg-send-trade').disabled = true;
      return;
    }
    if ($('#sg-symbol')) $('#sg-symbol').value = String(ev.sym || '—');
    if ($('#sg-side')) $('#sg-side').value = String(ev.side || '—');
    if ($('#sg-entry')) $('#sg-entry').value = fmt(ev.entry, 2);
    if ($('#sg-stop')) $('#sg-stop').value = fmt(ev.stop, 2);
    if ($('#sg-t1')) $('#sg-t1').value = fmt(ev.t1, 2);
    if ($('#sg-size') && hit){
      var oz = hit.positionSize && hit.positionSize.positionSizeUnits;
      $('#sg-size').value = Number.isFinite(oz) ? String(oz) : fmt(hit.qty, 3);
    }
    /* hg-v1005: the money path answers to the calendar LIVE — a blackout
       that started after the source desks scanned still stands the button
       down, because the probe runs at render time, not scan time. A row
       carrying the stack's refuse verdict never sends either. */
    var sendBlackout = false;
    try{
      if (typeof W.hgFundamentalBlackout === 'function'){
        sendBlackout = W.hgFundamentalBlackout('XAUUSD') === true;
      }
    }catch(eSB){ sendBlackout = false; }
    if ($('#sg-guidance')){
      var g = ev.note || '';
      if (sendBlackout){
        g += (g ? ' · ' : '') + 'EVENT BLACKOUT — no fresh setup forms into a red-folder macro print';
      }
      if (hit && hit.goldAudit && hit.goldAudit.layerSummary){
        g += (g ? ' · ' : '') + hit.goldAudit.layerSummary;
      }
      $('#sg-guidance').textContent = g;
    }
    var btn = $('#sg-send-trade');
    if (btn){
      var canSend = !!(hit && !sendBlackout && !(hit.fund && hit.fund.refuse === true)
        && hit.minimalLossPass && N(hit.entry) > 0 && N(hit.stop) > 0);
      btn.disabled = !canSend;
      btn.onclick = canSend ? function(){
        var dir = String(hit.dir || '').toLowerCase();
        var t1 = N(hit.t1) > 0 ? hit.t1 : hit.tp;
        if (typeof W.hgToTradePlan === 'function'){
          W.hgToTradePlan(hit.sym, dir, hit.entry, hit.stop, t1, {
            t2: hit.t2 || null,
            scanner: 'super-gold',
            strategy: hit.strategy || hit.scanner,
            venue: hit.venueTag || null,
            source: 'super-gold'
          });
        } else if (typeof W.toTrade === 'function'){
          W.toTrade(hit.sym, dir, hit.entry, hit.stop, t1, hit.t2);
        }
      } : null;
    }
  }

  function paintValidation(){
    var vEl = $('#sg-validation');
    if (vEl && typeof W.hgSuperDeskValidationHtml === 'function'){
      vEl.innerHTML = W.hgSuperDeskValidationHtml(W);
    }
  }

  function paintWeekendBanner(){
    var el = $('#sg-weekend');
    if (!el) return;
    var txt = sgWeekendBannerText(superGoldScan());
    el.textContent = txt || '';
    el.style.display = txt ? 'block' : 'none';
  }

  /* hg-v1361: the desk intel strip. Renders the snapshot pinned at scan
     time — the five-timeframe matrix, the candle engine's agreement with
     the crowned side, the volatility regime, the session clock and the
     calendar. A display layer: nothing here crowns, uncrowns, or moves a
     level. Empty when the scan never computed it. */
  function paintIntel(snap){
    var host = $('#sg-intel');
    if (!host) return;
    /* hg-v1363: NO early return on a missing intel read — the crown
       execution state and the crown audit answer from the board's own rows
       and must still render when the tape legs failed. Every intel leg below
       is guarded on its own. */
    var intel = (snap && snap.intel) || null;
    function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    var bits = [];
    if (intel && intel.fiveTf){
      var ft = intel.fiveTf;
      var aColor = ft.aligned === 'NONE' ? '#64748b' : '#15803d';
      var rowTxt = (ft.rows || []).map(function(r){
        var cls = r.dir === 'BULL' ? 'color:#15803d' : (r.dir === 'BEAR' ? 'color:#dc262c' : 'color:#94a3b8');
        return '<span style="' + cls + ';font-weight:700">' + esc(r.tf) + ' ' + esc(r.dir) + '</span>';
      }).join(' · ');
      bits.push('<div class="hg-note" data-sg-intel="fivetf" style="margin-bottom:4px"><b>FIVE-TIMEFRAME</b> '
        + '<span style="color:' + aColor + ';font-weight:700">' + esc(ft.aligned) + '</span>'
        + ' <span class="hg-note">— ' + esc(ft.why || '') + '</span><br>' + rowTxt + '</div>');
    }
    var crownedSide = '';
    try{
      var rows = snap && Array.isArray(snap.cands) ? snap.cands : [];
      if (rows.length && sgSnapFresh(snap)) crownedSide = sgMergeSide(rows) || '';
    }catch(eCr){ crownedSide = ''; }
    if (intel && intel.candle){
      var ag = crownedSide ? sgCandleAgreement(intel, crownedSide) : null;
      var cColor = !ag ? '#64748b' : (ag.verdict === 'WITH' ? '#15803d' : (ag.verdict === 'AGAINST' ? '#dc262c' : '#94a3b8'));
      bits.push('<div class="hg-note" data-sg-intel="candle" style="margin-bottom:4px"><b>CANDLES 15m</b> '
        + '<span style="font-weight:700">' + esc(intel.candle.dir) + '</span>'
        + (ag ? (' — <span style="color:' + cColor + ';font-weight:700">' + esc(ag.verdict) + ' the crown</span> <span class="hg-note">(' + esc(ag.why) + ')</span>') : (' <span class="hg-note">(' + esc(intel.candle.patterns && intel.candle.patterns.length ? intel.candle.patterns.slice(0, 3).join(', ') : 'no named pattern') + ')</span>'))
        + (ag && ag.verdict === 'AGAINST' ? '<div class="hg-note" style="color:#b45309">The crowned desk and the 15m candles disagree. The crown stands — the disagreement is shown, not hidden.</div>' : '')
        + '</div>');
    }
    var envBits = [];
    if (intel && intel.volRegime && intel.volRegime.ok) envBits.push('<b>VOLATILITY</b> ' + esc(intel.volRegime.regime) + ' <span class="hg-note">(' + esc(intel.volRegime.why) + ')</span>');
    if (intel && intel.session && intel.session.ok) envBits.push('<b>SESSION</b> ' + esc(intel.session.label) + ' <span class="hg-note">(' + esc(intel.session.why) + ')</span>');
    if (intel && intel.news) envBits.push('<b>NEWS</b> ' + esc(intel.news.state || 'UNCHECKED') + ' <span class="hg-note">(' + esc(intel.news.note || '') + ')</span>');
    if (envBits.length) bits.push('<div class="hg-note" data-sg-intel="env" style="margin-bottom:4px">' + envBits.join('<br>') + '</div>');
    /* hg-v1362: the crown audit on top — the printed checks against the
       crowned row, with the distance read beside it. */
    var crownHtml = '';
    try{
      var cc = (typeof W.__sgCrownChecks !== 'undefined' && W.__sgCrownChecks) ? W.__sgCrownChecks : sgCrownChecks(snap);
      if (cc && cc.ok && cc.crowned){
        var gColor = cc.grade === 'A' ? '#15803d' : (cc.grade === 'B' ? '#b45309' : '#dc262c');
        var cRows = cc.checks.map(function(c){
          return '<li><span style="color:' + (c.passed ? '#15803d' : '#94a3b8') + ';font-weight:700">' + (c.passed ? 'PASS' : '—') + '</span> '
            + esc(c.label) + (c.note ? (' <span class="hg-note">— ' + esc(c.note) + '</span>') : '') + '</li>';
        }).join('');
        crownHtml = '<div class="hg-note" data-sg-intel="crown" style="margin-bottom:6px"><b>CROWN AUDIT</b> '
          + '<span style="color:' + gColor + ';font-weight:700">GRADE ' + esc(cc.grade) + '</span>'
          + ' <span class="hg-note">— ' + esc(cc.why) + '</span>'
          + (cc.dist ? ('<div class="hg-note">' + esc(cc.dist.why) + '.</div>') : '')
          + '<ul style="margin:4px 0 0;padding-left:18px">' + cRows + '</ul></div>';
      }
    }catch(eCc){ crownHtml = ''; }
    /* hg-v1363: the crown execution block — the state machine, the cone for
       the crowned side, and the desk's own forward record, split into all
       records and crowned-only tickets so the reader can see whether the
       crown earns its place over the pool it picks from. */
    var execHtml = '';
    try{
      var ex = sgCrownExecution(snap);
      var exColor = ex.state === 'TRIGGERED' ? '#15803d' : (ex.state === 'ARMED' ? '#b45309' : '#94a3b8');
      var coneBits = '';
      if (intel && intel.cone && intel.cone.ok && (intel.cone.steps || []).length){
        coneBits = '<div class="hg-note" data-sg-intel="cone" style="margin-top:4px"><b>CONE</b> '
          + intel.cone.steps.map(function(st){
            return '+' + st.bar + ' ' + Number(st.low).toFixed(2) + '–' + Number(st.high).toFixed(2);
          }).join(' · ')
          + ' <span class="hg-note">(' + esc(intel.cone.why) + ')</span></div>';
      }
      var fwdBits = '';
      try{
        if (typeof W.hgFwdStats === 'function'){
          var all = W.hgFwdStats('SUPER:GOLD');
          var crownedOnly = W.hgFwdStats('SUPER:GOLD', null, true);
          var fmtStat = function(st){
            if (!st || !isFinite(+st.samples) || +st.samples === 0) return 'no records';
            return (+st.samples) + ' recorded · ' + (st.wins || 0) + ' wins · ' + (st.losses || 0) + ' losses'
              + ' · hit ' + (isFinite(+st.hit) ? (+st.hit).toFixed(1) + '%' : '—')
              + ' · expectancy ' + (isFinite(+st.expR) ? (+st.expR).toFixed(2) + 'R' : '—');
          };
          fwdBits = '<div class="hg-note" data-sg-intel="fwd" style="margin-top:4px"><b>FORWARD</b> pool: ' + esc(fmtStat(all))
            + '<br>crowned only: ' + esc(fmtStat(crownedOnly))
            + ' <span class="hg-note">— out of sample. The crowned split is the filter\'s own record.</span></div>';
        }
      }catch(eFw){ fwdBits = ''; }
      var tapeLife = '';
      try{
        var tape = sgTapeDiagnostics(snap);
        var life = sgCrownLifecycle(snap);
        var tColor = tape.status === 'LOCKED' ? '#dc262c' : (tape.status === 'CLEAN' ? '#15803d' : '#b45309');
        tapeLife = '<div class="hg-note" data-sg-intel="tape" style="margin-top:4px"><b>TAPE</b> '
          + '<span style="color:' + tColor + ';font-weight:700">' + esc(tape.status) + '</span>'
          + ' <span class="hg-note">- ' + esc(tape.why) + '</span></div>'
          + '<div class="hg-note" data-sg-intel="life" style="margin-top:4px"><b>LIFECYCLE</b> '
          + esc(life.stage) + ' <span class="hg-note">- ' + esc(life.why) + '</span></div>';
        var payload = sgCrownDispatchPayload(snap, readRiskOpts());
        if (payload.ready){
          tapeLife += '<div style="margin-top:6px">'
            + '<button type="button" class="hg-btn" data-sg-dispatch="book">Send to book</button> '
            + '<button type="button" class="hg-btn" data-sg-dispatch="xm">Send to XM</button> '
            + '<button type="button" class="hg-btn" data-sg-dispatch="execute">Execute bracket</button>'
            + '<div class="hg-note" data-sg-intel="dispatch-result"></div></div>';
        } else if (ex.state !== 'NO-TRADE'){
          tapeLife += '<div class="hg-note" data-sg-intel="dispatch" style="margin-top:4px">Not sent: ' + esc(payload.reason) + '</div>';
        }
      }catch(eTl){ tapeLife = ''; }
      execHtml = '<div class="hg-note" data-sg-intel="exec" style="margin-bottom:6px"><b>CROWN EXECUTION</b> '
        + '<span style="color:' + exColor + ';font-weight:700">' + esc(ex.state) + '</span>'
        + (ex.side ? (' <span class="hg-note">' + esc(ex.side.toUpperCase()) + '</span>') : '')
        + '<div class="hg-note">' + esc(ex.why) + '</div>'
        + coneBits + fwdBits + tapeLife
        + ((ex.state === 'ARMED' || ex.state === 'TRIGGERED') ? '<div id="sg-crown-chart" style="margin-top:6px"></div>' : '')
        + '</div>';
    }catch(eEx){ execHtml = ''; }
    var sniperHtml = '';
    try{
      var acc = sgHighAccuracyAudit(snap);
      if (acc && acc.ok){
        var gates = (acc.gates || []).map(function(g){
          return '<span style="color:' + (g.passed ? '#15803d' : '#dc262c') + ';font-weight:700">' + (g.passed ? 'PASS' : 'FAIL') + '</span> ' + esc(g.label);
        }).join(' · ');
        sniperHtml = '<div class="hg-note" data-sg-intel="sniper" style="margin-bottom:6px"><b>SNIPER</b> '
          + '<span style="font-weight:700">' + esc(acc.tier) + '</span>'
          + ' <span class="hg-note">' + acc.score + '/' + acc.total + '</span>'
          + '<div class="hg-note">' + esc(acc.why) + '</div>'
          + (acc.precision && acc.precision.why ? ('<div class="hg-note">' + esc(acc.precision.why) + '. This does not replace the crowned entry or stop on the card. A measured suggestion is what a send carries.</div>') : '')
          + '<div class="hg-note" style="margin-top:2px">' + gates + '</div></div>';
      }
    }catch(eSn){ sniperHtml = ''; }
    if (!bits.length && intel && intel.why) bits.push('<div class="hg-note">Desk intel unread: ' + esc(intel.why) + '</div>');
    host.innerHTML = (crownHtml || bits.length || execHtml)
      ? ('<div class="hg-note" data-sg-intel="1" style="margin:8px 0;padding:8px 10px;border:1px solid rgba(166,124,18,.25);border-radius:var(--radius-sm,6px);background:#fffbeb">'
        + '<b>DESK INTELLIGENCE</b> <span class="hg-note">— tape, clock and calendar beside the crown. They do not crown and they do not move a level.</span>'
        + '<div style="margin-top:6px">' + sniperHtml + crownHtml + execHtml + bits.join('') + '</div></div>')
      : '';
    /* hg-v1363: the mini chart draws after the host exists; a missing 2d
       context leaves the wrap empty, never a thrown repaint. */
    try{
      host.querySelectorAll('[data-sg-dispatch]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var kind = btn.getAttribute('data-sg-dispatch');
          var fn = kind === 'book' ? sgDispatchToBook : (kind === 'xm' ? sgDispatchToXm : sgDispatchBracket);
          btn.disabled = true;
          Promise.resolve(fn(snap, { riskOpts: readRiskOpts() })).then(function(res){
            btn.disabled = false;
            var note = host.querySelector('[data-sg-intel="dispatch-result"]');
            if (note) note.textContent = (res && (res.reason || (res.ok ? ('sent ' + (res.via || '')) : 'not sent'))) || '';
          });
        });
      });
    }catch(eDp){}
    try{
      var exNow = sgCrownExecution(snap);
      if ((exNow.state === 'ARMED' || exNow.state === 'TRIGGERED') && intel && Array.isArray(intel.rows15)){
        var crownedNow = sgCrownedRow(snap);
        var precNow = crownedNow && crownedNow.row && crownedNow.row.precision;
        sgDrawChart(host, intel.rows15, exNow, precNow);
      }
    }catch(eCh){}
  }

  /* hg-v1363: the crowned bracket on the tape — last 60 closed 15m candles
     with entry / stop / T1 as level lines. Plain canvas, no dependency. */
  function sgDrawChart(host, rows, ex, prec){
    var wrap = host && host.querySelector ? host.querySelector('#sg-crown-chart') : null;
    if (!wrap || typeof document === 'undefined' || !document.createElement) return;
    rows = Array.isArray(rows) ? rows.slice(-60) : [];
    if (rows.length < 2) return;
    var cv = document.createElement('canvas');
    cv.width = 720; cv.height = 220;
    cv.style.width = '100%'; cv.style.height = 'auto';
    var ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return;
    var i, lo = Infinity, hi = -Infinity;
    for (i = 0; i < rows.length; i++){
      if (rows[i].l < lo) lo = rows[i].l;
      if (rows[i].h > hi) hi = rows[i].h;
    }
    var lvls = [];
    if (isFinite(ex.entry)) lvls.push({ px: ex.entry, color: '#2563eb', label: 'entry' });
    if (isFinite(ex.stop)) lvls.push({ px: ex.stop, color: '#dc262c', label: 'stop' });
    if (isFinite(ex.t1)) lvls.push({ px: ex.t1, color: '#15803d', label: 't1' });
    if (prec && prec.ok && prec.unread !== true && sgPrecisionOrdered(prec)){
      lvls.push({ px: prec.entry, color: '#60a5fa', label: 'suggest entry' });
      lvls.push({ px: prec.stop, color: '#f59e0b', label: 'suggest stop' });
      lvls.push({ px: prec.t1, color: '#34d399', label: 'suggest tp1' });
      if (isFinite(prec.t2)) lvls.push({ px: prec.t2, color: '#10b981', label: 'suggest tp2' });
      if (isFinite(prec.t3)) lvls.push({ px: prec.t3, color: '#06b6d4', label: 'suggest tp3' });
    }
    lvls.forEach(function(l){ if (l.px < lo) lo = l.px; if (l.px > hi) hi = l.px; });
    if (!(hi > lo)) return;
    var pad = 8, Wd = cv.width - pad * 2, Ht = cv.height - pad * 2;
    var y = function(px){ return pad + (hi - px) / (hi - lo) * Ht; };
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, cv.width, cv.height);
    var bw = Math.max(2, Math.floor(Wd / rows.length) - 1);
    for (i = 0; i < rows.length; i++){
      var r = rows[i];
      var x = pad + i * (Wd / rows.length);
      var up = r.c >= r.o;
      ctx.strokeStyle = up ? '#15803d' : '#dc262c';
      ctx.fillStyle = up ? '#15803d' : '#dc262c';
      ctx.beginPath(); ctx.moveTo(x + bw / 2, y(r.h)); ctx.lineTo(x + bw / 2, y(r.l)); ctx.stroke();
      var top = y(Math.max(r.o, r.c)), bot = y(Math.min(r.o, r.c));
      ctx.fillRect(x, top, bw, Math.max(1, bot - top));
    }
    lvls.forEach(function(l){
      ctx.strokeStyle = l.color;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(pad, y(l.px)); ctx.lineTo(cv.width - pad, y(l.px)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = l.color;
      if (ctx.fillText) ctx.fillText(l.label + ' ' + Number(l.px).toFixed(2), pad + 4, y(l.px) - 3);
    });
    wrap.innerHTML = '';
    if (wrap.appendChild) wrap.appendChild(cv);
  }

  function paintDesk(snap){
    paintValidation();
    paintWeekendBanner();
    paintIntel(snap || superGoldScan());
    snap = snap || superGoldScan();
    var desk = $('#sg-desk');
    var statEl = $('#sg-scan-stat');
    if (statEl){
      var when = snap && snap.scanAt ? new Date(snap.scanAt).toLocaleTimeString() : '—';
      /* hg-v1363: the countdown to the next scan, repainted by the desk's
         own 2.5s sync — no new timer. */
      var nextBit = '';
      if (__sg.lastScanAt){
        var leftMs = SCAN_INTERVAL_MS - (Date.now() - __sg.lastScanAt);
        if (leftMs > 0){
          var lm = Math.floor(leftMs / 60000), ls = Math.floor((leftMs % 60000) / 1000);
          nextBit = ' · next scan in ' + lm + 'm ' + (ls < 10 ? '0' : '') + ls + 's';
        } else {
          nextBit = ' · scan due';
        }
      }
      statEl.textContent = (snap && snap.stat ? snap.stat : 'No scan yet') + ' · last ' + when + nextBit;
    }
    var armedEl = $('#sg-armed');
    if (armedEl){
      var armed = (snap && Array.isArray(snap.armed)) ? snap.armed : [];
      var armedTxt = armed.length
        ? ('FORMING: ' + armed.slice(0, 4).map(function(a){
          return (a.summary || ((a.strategy || a.stratKey || 'watch') + ' @ ' + fmt(a.level, 2)));
        }).join(' · ') + (armed.length > 4 ? ' …' : ''))
        : '';
      armedEl.textContent = armedTxt;
      armedEl.style.display = armedTxt ? 'block' : 'none';
    }
    if (!desk) return;
    var rows = (snap && Array.isArray(snap.cands)) ? snap.cands : [];
    /* hg-v1005: the full gold fundamental board — sentiment, positioning,
       real rates, COT and the calendar, the same panel every gold desk
       shows — renders above the desk in BOTH outcomes, because the empty
       board is exactly when the reader needs the stack's reason. */
    var sgFundPanel = '';
    try{
      if (typeof W.hgFundamentalRegime === 'function' && typeof W.hgFundamentalPanelHtml === 'function'){
        sgFundPanel = W.hgFundamentalPanelHtml(W.hgFundamentalRegime('gold')) || '';
      }
    }catch(eFP){ sgFundPanel = ''; }
    if (!rows.length){
      desk.innerHTML = sgFundPanel + '<div class="hg-note">No GRADE A/B gold setups on last scan. Weekend / macro / tally filters may be standing aside.</div>';
      return;
    }
    var minPass = rows.filter(function(r){ return r.minimalLossPass; }).length;
    var boardNote = superGoldBoardNote(snap);
    var hint = boardNote
      ? ('<div class="hg-note" style="margin-bottom:10px">' + boardNote + '</div>')
      : (minPass
        ? ('<div class="hg-note" style="margin-bottom:10px">' + minPass + ' GRADE A PASS · trade-ready</div>')
        : ('<div class="hg-note" style="margin-bottom:10px">No GRADE A PASS yet — WATCH rows show levels only</div>'));
    /* hg-v913: this desk reads the records it writes. SUPER:GOLD is pooled
       into OMNIGOLD's gate, so its records were consulted — by a different
       desk, for a different board. This is the one that wrote them. */
    desk.innerHTML = (typeof W.hgGoldFwdNote === 'function' ? W.hgGoldFwdNote('super-gold') : '') + sgFundPanel + hint + rows.map(function(r){
      var tierLbl = r.tier === 'clean' ? ('GRADE ' + String(r.grade || 'A').toUpperCase()) : 'WATCH';
      var pill = superGoldDeskPill(r);
      var sel = (__sg.selectedId === r.id) ? ' sel' : '';
      var tierPillCls = r.tier === 'clean' ? 'clean' : 'watch';
      /* SMC chip — pure read of r.smc; '' when the row has none. */
      var smcChip = '';
      try{ if (typeof W.hgSmcChipHtml === 'function') smcChip = W.hgSmcChipHtml(r) || ''; }catch(eSmcChip){ smcChip = ''; }
      /* hg-v1005: the fundamental-stack verdict chip — the compact fund read
         the source desk stamped at scan time (carried through
         hitFromGoldCand), never recomputed here. '' when the stack saw
         nothing to say. */
      var fundChip = '';
      try{
        if (typeof W.hgFundamentalChipHtml === 'function' && r.fund && Array.isArray(r.fund.chips) && r.fund.chips.length){
          fundChip = W.hgFundamentalChipHtml(Object.assign({ asset: 'gold' }, r.fund)) || '';
        }
      }catch(eFundChip){ fundChip = ''; }
      return '<div class="hg-desk-card' + sel + '" data-id="' + String(r.id).replace(/"/g, '') + '">'
        + '<div class="hg-desk-top">'
        + '<div class="hg-desk-sym">' + String(r.sym || 'XAU') + ' · ' + String(r.dir || '').toUpperCase()
        + (r.fusedConviction ? ' · FUSED' : '') + '</div>'
        + '<div class="hg-desk-pills">'
        + '<span class="hg-pill ' + tierPillCls + '">' + tierLbl + '</span>'
        + (r.formation ? ('<span class="hg-pill">' + String(r.formation.archetypeLabel || r.formation.archetype || '') + ' · ' + r.formation.qualityScore + '</span>') : '')
        + '<span class="hg-pill">' + String(r.scanner || '') + '</span>'
        + '<span class="hg-pill ' + pill.cls + '">' + pill.label + '</span>'
        + smcChip
        + fundChip
        + '</div></div>'
        + '<div class="hg-desk-levels">'
        + '<div><div class="k">ENTRY</div><div class="v">' + fmt(r.entry, 2) + '</div></div>'
        + '<div><div class="k">STOP</div><div class="v">' + fmt(r.stop, 2) + '</div></div>'
        + '<div><div class="k">T1</div><div class="v">' + fmt(r.tp, 2) + '</div></div>'
        + '<div><div class="k">RR</div><div class="v">' + fmt(r.rr, 2) + '</div></div>'
        + '<div><div class="k">SIZE</div><div class="v">'
        + (r.positionSize ? fmt(r.positionSize.positionSizeUnits, 3) + ' oz' : '—') + '</div></div>'
        + sgGeoLine(r)
        + '</div>'
        + '<div class="hg-note" style="margin-top:8px">' + String(r.strategy || '')
        + (r.formation
          ? ('<div class="hg-note" data-sg-playbook="1"><b>Playbook:</b> '
            + String(r.formation.triggerCondition || '') + ' · '
            + String(r.formation.invalidationRule || '') + ' · '
            + String(r.formation.scalePlan || '') + '</div>')
          : '')
        + (r.formation && r.formation.tranchePlan
          ? ('<div class="hg-note" data-sg-tranches="1">' + String(r.formation.tranchePlan) + '</div>')
          : '')
        + (r.expectancy && r.expectancy.ok
          ? ('<div class="hg-note" data-sg-expect="1">E[R] +' + fmt(r.expectancy.expectedValueR, 2)
            + 'R on a ' + r.expectancy.estWinPct + '% estimate. Half-Kelly '
            + fmt(r.expectancy.halfKellyRiskPct, 2) + '%.</div>')
          : '')
        + (r.timeDecay
          ? ('<div class="hg-note" data-sg-ttl="1">Validity ' + String(r.timeDecay.status)
            + (r.timeDecay.ttlLeftMin != null ? (' (' + r.timeDecay.ttlLeftMin + 'm left)') : ' (bar time unread)')
            + '.</div>')
          : '')
        + (r.formation && r.formation.adverseSelection
          ? ('<div class="hg-note" data-sg-exec="1">Exec ' + String(r.formation.adverseSelection.status)
            + (r.formation.adverseSelection.executionMode ? (' / ' + String(r.formation.adverseSelection.executionMode)) : '')
            + '.</div>')
          : '')
        + (r.formation && r.formation.liquidityMap && r.formation.liquidityMap.ok
          ? ('<div class="hg-note" data-sg-dol="1">' + String(r.formation.liquidityMap.zonePricing)
            + (r.formation.liquidityMap.drawOnLiquidity ? (' · ' + String(r.formation.liquidityMap.drawOnLiquidity.label)) : '')
            + '. This does not move the desk entry.</div>')
          : '')
        + (r.fractalCascade
          ? ('<div class="hg-note" data-sg-cascade="1">' + String(r.fractalCascade.summary) + '.</div>')
          : '')
        + (r.riskProfile && r.riskProfile.ok
          ? ('<div class="hg-note" data-sg-hurdle="1">' + String(r.riskProfile.summary) + '. This does not change the size.</div>')
          : '')
        + (r.dailyBenchmarks && r.dailyBenchmarks.ok
          ? ('<div class="hg-note" data-sg-pdh="1">' + String(r.dailyBenchmarks.summary) + '. This does not move the desk entry.</div>')
          : '')
        + (r.executionRadar
          ? ('<div class="hg-note" data-sg-radar="1">' + String(r.executionRadar.actionDirective) + '.</div>')
          : '')
        + (r.volumeProfile && r.volumeProfile.ok
          ? ('<div class="hg-note" data-sg-vp="1">' + String(r.volumeProfile.summary) + '.</div>')
          : '')
        + (r.smtRead && r.smtRead.ok
          ? ('<div class="hg-note" data-sg-smt="1">' + String(r.smtRead.summary) + '.</div>')
          : '')
        + (r.scalpEnhancement
          ? ('<div class="hg-note" data-sg-scalp="1">' + String(r.scalpEnhancement.scalpTier || '')
            + (r.scalpEnhancement.scalpScore != null ? (' ' + r.scalpEnhancement.scalpScore + '/100') : '')
            + ' · ' + String(r.scalpEnhancement.archetypeLabel || '')
            + '. The desk entry, stop, and targets were not replaced.'
            + (r.scalpSizing && r.scalpSizing.positionUnitsOz > 0
              ? (' Size ' + fmt(r.scalpSizing.positionUnitsOz, 2) + ' oz'
                + (r.scalpSizing.halfKellyLots != null ? (' (' + fmt(r.scalpSizing.halfKellyLots, 2) + ' lots at half-Kelly).') : '.'))
              : '')
            + '</div>')
          : '')
        + (r.ratchetLadder && r.ratchetLadder.length
          ? ('<div class="hg-note" data-sg-ratchet="1">Stop plan: '
            + r.ratchetLadder.map(function(st){ return st.code + ' @ ' + fmt(st.stopPx, 2); }).join(' · ')
            + '. The desk stop is not moved.</div>')
          : '')
        + (r.precision && r.precision.ok && !r.precision.unread && Array.isArray(r.precision.entryZone)
          ? ('<div class="hg-note" data-sg-zone="1">Entry zone '
            + fmt(r.precision.entryZone[0], 2) + ' to ' + fmt(r.precision.entryZone[1], 2)
            + '. Desk entry stays ' + fmt(r.entry, 2) + '.</div>')
          : '')
        + (r.precision && r.precision.ok && !r.precision.unread
          ? ('<div class="hg-note" data-sg-send="1">SEND '
            + fmt(r.precision.entry, 2) + ' / stop ' + fmt(r.precision.stop, 2)
            + ' / TP1 ' + fmt(r.precision.t1, 2)
            + ' / TP2 ' + fmt(r.precision.t2, 2)
            + ' / TP3 ' + fmt(r.precision.t3, 2)
            + '. Desk was ' + fmt(r.entry, 2) + ' / ' + fmt(r.stop, 2) + ' / ' + fmt(r.tp || r.t1, 2)
            + '. Suggestion, not the crown: ' + String(r.precision.why || '')
            + '. A measured suggestion is what a send carries. An unread one is not.</div>')
          : '')
        + '</div></div>';
    }).join('');
    try { if (typeof W.hgMpPin === 'function') W.hgMpPin('super-gold', rows, null, desk); } catch (eMp) {}
    desk.querySelectorAll('.hg-desk-card').forEach(function(card){
      card.addEventListener('click', function(){
        var id = card.getAttribute('data-id');
        __sg.selectedId = id;
        desk.querySelectorAll('.hg-desk-card').forEach(function(c){ c.classList.remove('sel'); });
        card.classList.add('sel');
        var hit = rows.find(function(r){ return r.id === id; });
        if (hit) applyEvaluation(hitToEvaluation(hit));
      });
    });
  }

  function setScanStatus(msg){
    var statEl = $('#sg-scan-stat');
    if (statEl && msg) statEl.textContent = msg;
  }

  function applyFirstSetup(force){
    var snap = superGoldScan();
    paintDesk(snap);
    var hit = autoSelectFirstSetup(snap);
    if (hit) applyEvaluation(hitToEvaluation(hit));
    /* hg-v1005: nothing crownable (blackout, or every row fundamental-
       blocked) — take the send button dark too rather than leave a stale
       ticket live. */
    else applyEvaluation(null);
  }

  function syncFromExistingDesks(){
    var snap = syncDeskFromExisting(W, readRiskOpts());
    mergePublishSuperGoldSnap(snap);
    applyFirstSetup(true);
    return superGoldScan();
  }

  $('#sg-balance') && $('#sg-balance').addEventListener('input', function(){
    W.__sgDefaultBalance = N($('#sg-balance').value);
    syncFromExistingDesks();
  });
  $('#sg-risk') && $('#sg-risk').addEventListener('input', function(){
    W.__sgDefaultRiskPct = N($('#sg-risk').value);
    syncFromExistingDesks();
  });
  var runBtn = $('#sg-run-scan');
  if (runBtn) runBtn.addEventListener('click', function(){
    runBtn.disabled = true;
    superGoldRunScan({ force: true, riskOpts: readRiskOpts() }).then(function(msg){
      runBtn.disabled = false;
      setScanStatus(String(msg));
    });
  });
  var scalpBtn = $('#sg-open-scalp');
  if (scalpBtn) scalpBtn.addEventListener('click', function(){
    if (typeof W.showTab === 'function') W.showTab('goldscalp');
  });
  var swingBtn = $('#sg-open-swing');
  if (swingBtn) swingBtn.addEventListener('click', function(){
    if (typeof W.showTab === 'function') W.showTab('goldswing');
  });
  if (typeof W.hgSuperDeskBindScorecard === 'function') W.hgSuperDeskBindScorecard(root);

  __sg.mounted = true;
  __sg.paintDesk = paintDesk;
  __sg.setScanStatus = setScanStatus;
  __sg.applyFirstSetup = applyFirstSetup;
  __sg.syncFromExistingDesks = syncFromExistingDesks;

  syncFromExistingDesks();
  superGoldRunScan({ riskOpts: readRiskOpts() }).then(setScanStatus);

  __sg.syncTimer = setInterval(function(){
    try{
      var snap = buildSnapFromGoldScans(W, readRiskOpts(), { allowStale: true });
      var prevSnap = superGoldScan();
      if (prevSnap && prevSnap.intel && !snap.intel) snap.intel = prevSnap.intel;
      sgStampPrecision(snap);
      try{ sgApplyFormation(snap); }catch(eForm){}
      snap.scanAt = (__sg.lastScanAt || (superGoldScan() && superGoldScan().scanAt) || snap.at);
      mergePublishSuperGoldSnap(snap);
      if (__sg.mounted && typeof __sg.paintDesk === 'function') __sg.paintDesk(superGoldScan());
    }catch(e){}
  }, SYNC_MS);

  __sg.scanTimer = setInterval(function(){
    if (!__sg.scanBusy) superGoldRunScan({ riskOpts: readRiskOpts() });
  }, SCAN_INTERVAL_MS);
}

async function superGoldRefresh(){
  try{
    if (__sg.mounted && typeof __sg.syncFromExistingDesks === 'function'){
      __sg.syncFromExistingDesks();
    } else {
      syncDeskFromExisting(W, defaultRiskOpts());
    }
    var stale = !__sg.lastScanAt || (Date.now() - __sg.lastScanAt) >= SCAN_INTERVAL_MS;
    if (stale) await superGoldRunScan({ force: true });
    if (__sg.mounted && typeof __sg.paintDesk === 'function') __sg.paintDesk(superGoldScan());
    return stale ? 'scanned+refreshed' : 'refreshed';
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }
}

function superGoldRepaint(){
  if (!__sg.mounted) return;
  var snap = superGoldScan();
  if (!snap || !snap.cands || !snap.cands.length){
    snap = syncDeskFromExisting(W, defaultRiskOpts());
    mergePublishSuperGoldSnap(snap);
    snap = superGoldScan();
  }
  if (typeof __sg.paintDesk === 'function') __sg.paintDesk(snap);
  if (typeof __sg.applyFirstSetup === 'function') __sg.applyFirstSetup(false);
}

W.superGoldDeskPill = superGoldDeskPill;
W.runGoldDeskAudit = runGoldDeskAudit;
W.goldCandTier = goldCandTier;
W.buildGoldRankCtx = buildGoldRankCtx;
W.sgRankInstant = sgRankInstant;   /* hg-v977 */
W.rankRawGoldCands = rankRawGoldCands;
W.collectRawGoldDeskCands = collectRawGoldDeskCands;
W.collectSuperGoldScanHits = collectSuperGoldScanHits;
W.superGoldBoardNote = superGoldBoardNote;
W.superGoldWeekendLine = sgWeekendBannerText;
W.superGoldEvaluate = superGoldEvaluate;
W.refineSuperGoldLevels = refineSuperGoldLevels;
W.superGoldSortCands = superGoldSortCands;
W.enrichSuperGoldRow = enrichSuperGoldRow;
W.buildSnapFromGoldScans = buildSnapFromGoldScans;
W.superGoldBuildSnap = buildSnapFromGoldScans;
W.mergePublishSuperGoldSnap = mergePublishSuperGoldSnap;
W.superGoldSyncDesk = syncDeskFromExisting;
W.superGoldRepaint = superGoldRepaint;
W.superGoldScan = superGoldScan;
W.superGoldRunScan = superGoldRunScan;
W.superGoldWarm = superGoldWarm;
/* hg-v1361: the intel layer, exported so the guard drives the REAL read. */
W.superGoldIntel = superGoldIntel;
W.sgCandleAgreement = sgCandleAgreement;
/* hg-v1362: the crown audit, exported so the guard drives the REAL checks. */
W.sgCrownChecks = sgCrownChecks;
W.sgCrownedRow = sgCrownedRow;
/* hg-v1363: the crown execution state, exported so the guard drives the
   REAL state machine. */
W.sgCrownExecution = sgCrownExecution;
W.sgTapeDiagnostics = sgTapeDiagnostics;
W.sgCrownLifecycle = sgCrownLifecycle;
W.sgCrownDispatchPayload = sgCrownDispatchPayload;
W.sgDispatchToBook = sgDispatchToBook;
W.sgDispatchToXm = sgDispatchToXm;
W.sgDispatchBracket = sgDispatchBracket;
W.sgPrecisionGoldLevels = sgPrecisionGoldLevels;
W.sgPrecisionOrdered = sgPrecisionOrdered;
W.sgStampPrecision = sgStampPrecision;
W.sgClassifySetupArchetype = sgClassifySetupArchetype;
W.sgEnhanceSetupFormation = sgEnhanceSetupFormation;
W.sgFuseCrossDeskSetups = sgFuseCrossDeskSetups;
W.sgEnhanceArmedSetups = sgEnhanceArmedSetups;
W.sgDetectMicrostructureZones = sgDetectMicrostructureZones;
W.sgCalcSetupExpectancy = sgCalcSetupExpectancy;
W.sgEvaluateSetupDecay = sgEvaluateSetupDecay;
W.sgSynthesizeTapeSetups = sgSynthesizeTapeSetups;
W.sgSessionLiquidityMap = sgSessionLiquidityMap;
W.sgAdverseSelectionGuard = sgAdverseSelectionGuard;
W.sgMultiTfFractalCascade = sgMultiTfFractalCascade;
W.sgSetupRiskProfile = sgSetupRiskProfile;
W.sgDailyBenchmarkLevels = sgDailyBenchmarkLevels;
W.sgSetupExecutionRadar = sgSetupExecutionRadar;
W.sgIntradayVolumeProfile = sgIntradayVolumeProfile;
W.sgCrossVenueSmtRead = sgCrossVenueSmtRead;
W.sgAdaptiveTpSplits = sgAdaptiveTpSplits;
W.sgBuildStopRatchetLadder = sgBuildStopRatchetLadder;
W.sgDetectGoldScalpArchetypes = sgDetectGoldScalpArchetypes;
W.sgRefineGoldScalpBracket = sgRefineGoldScalpBracket;
W.sgScoreGoldScalpSetup = sgScoreGoldScalpSetup;
W.sgEnhanceGoldScalpSetup = sgEnhanceGoldScalpSetup;
W.sgScalpSizing = sgScalpSizing;
W.sgSynthesizeGoldScalpSetups = sgSynthesizeGoldScalpSetups;
W.sgGoldScalpOrderFlowEngine = sgGoldScalpOrderFlowEngine;
W.sgGoldScalpSessionPools = sgGoldScalpSessionPools;
W.sgGoldScalpVelocityProfile = sgGoldScalpVelocityProfile;
W.sgUpgradeGoldScalpTabInOneGo = sgUpgradeGoldScalpTabInOneGo;
W.sgPaintGoldScalpTabHud = sgPaintGoldScalpTabHud;
W.sgInstallGoldScalpTabEnhancer = sgInstallGoldScalpTabEnhancer;
W.sgPsychShieldStop = sgPsychShieldStop;
W.sgHighAccuracyAudit = sgHighAccuracyAudit;

/* Gold Scalp names the setup and suggests a bracket. The suggestion is not
   written onto the desk entry, stop, or targets unless the desk asks for that.
   A missing ATR is not filled in as 2.2. A missing spread is not filled in
   as 35 cents. An empty tape does not grow a scalp setup. */
function sgCalcEma(rows, period){
  if (!Array.isArray(rows) || !rows.length) return NaN;
  period = period || 9;
  var k = 2 / (period + 1);
  var ema = NaN;
  for (var i = 0; i < rows.length; i++){
    var b = rows[i];
    if (!b) continue;
    var c = N(b.c != null ? b.c : b.close);
    if (!isFinite(c)) continue;
    ema = isNaN(ema) ? c : (c * k + ema * (1 - k));
  }
  return isFinite(ema) ? +ema.toFixed(2) : NaN;
}

function sgDetectGoldScalpArchetypes(c, intel, win){
  win = win || W;
  c = c || {};
  intel = intel || {};
  var sideRaw = String(c.dir || c.side || '').toLowerCase();
  if (sideRaw === 'buy' || sideRaw === 'bull') sideRaw = 'long';
  if (sideRaw === 'sell' || sideRaw === 'bear') sideRaw = 'short';
  if (sideRaw !== 'long' && sideRaw !== 'short'){
    return { ok: false, side: null, archetype: 'UNREAD', archetypeLabel: 'No side, so the scalp type is unread' };
  }
  var isLong = sideRaw === 'long';
  var side = sideRaw;
  var rows15 = Array.isArray(c.rows15m) && c.rows15m.length ? c.rows15m : (Array.isArray(intel.rows15) ? intel.rows15 : []);
  var rows5 = Array.isArray(c.rows5m) && c.rows5m.length ? c.rows5m : (Array.isArray(intel.rows5) ? intel.rows5 : []);
  var micro15 = sgDetectMicrostructureZones(rows15, null, side);
  var micro5 = rows5.length >= 5 ? sgDetectMicrostructureZones(rows5, null, side) : null;
  var volProf = sgIntradayVolumeProfile(rows15, side, N(c.entry));
  var liqMap = sgSessionLiquidityMap(rows15, side, N(c.entry));
  var benchmarks = sgDailyBenchmarkLevels(c, intel);
  var fractal = sgMultiTfFractalCascade(c, intel);
  var ema9_15 = sgCalcEma(rows15, 9), ema21_15 = sgCalcEma(rows15, 21);
  var ema9_5 = sgCalcEma(rows5, 9), ema21_5 = sgCalcEma(rows5, 21);
  var emaRibbonAligned15 = (isFinite(ema9_15) && isFinite(ema21_15))
    ? (isLong ? ema9_15 >= ema21_15 : ema9_15 <= ema21_15) : null;
  var emaRibbonAligned5 = (isFinite(ema9_5) && isFinite(ema21_5))
    ? (isLong ? ema9_5 >= ema21_5 : ema9_5 <= ema21_5) : null;
  var candSec = sgCandSec(c, c);
  var utcHour = candSec != null ? new Date(candSec * 1000).getUTCHours() : null;
  var sessLbl = String(c.killzone || (intel.session && intel.session.label) || '').toUpperCase();
  var isLondonKz = (utcHour != null && utcHour >= 7 && utcHour <= 10) || /LONDON/i.test(sessLbl);
  var isNyKz = (utcHour != null && utcHour >= 12 && utcHour <= 16) || /NY|OVERLAP|NEW.?YORK/i.test(sessLbl);
  var isSilverBulletWindow = utcHour != null && (utcHour === 7 || utcHour === 8 || utcHour === 14 || utcHour === 15 || utcHour === 18 || utcHour === 19);
  var killzoneActive = !!(isLondonKz || isNyKz || isSilverBulletWindow);
  var killzoneWindow = !killzoneActive ? 'UNREAD'
    : (isLondonKz && isNyKz ? 'LONDON_NY_OVERLAP_KZ'
      : (isNyKz ? 'NY_OPEN_SILVER_BULLET_KZ'
      : (isLondonKz ? 'LONDON_OPEN_JUDAS_KZ' : 'ICT_SILVER_BULLET_WINDOW')));
  var strat = String(c.strategy || c.stratKey || '').toLowerCase();
  var hasSweep = !!(micro15.sweepReclaimed || (micro5 && micro5.sweepReclaimed) || (fractal && fractal.ibRaided)
    || (benchmarks && (benchmarks.benchmarkState === 'PDL_SWEEP_RECLAIM' || benchmarks.benchmarkState === 'PDH_SWEEP_REJECT')));
  var hasFvg = !!(micro15.nearestFvg || (micro5 && micro5.nearestFvg));
  var hasIfvgOrBreaker = !!(micro15.nearestIfvg || micro15.nearestBreaker || (micro5 && (micro5.nearestIfvg || micro5.nearestBreaker)));
  var hasVaSpring = !!(volProf && volProf.ok && (volProf.profileState === 'VAL_SPRING_RECLAIM' || volProf.profileState === 'VAH_UPTHRUST_REJECT' || volProf.nearPoc));
  var archetype = 'UNREAD';
  var archetypeLabel = 'No scalp archetype measured';
  var edgeThesis = 'Nothing on the tape named this scalp';
  if (/judas|sweep|raid|trap|liq/i.test(strat)){
    archetype = 'NY_JUDAS_LIQUIDITY_SWEEP';
    archetypeLabel = 'JUDAS LIQUIDITY SWEEP + MSS RECLAIM';
    edgeThesis = 'A raid beyond the session extreme, then a 5m or 15m reclaim';
  } else if (/silver.?bullet|fvg|imbalance|gap/i.test(strat)){
    archetype = 'SILVER_BULLET_FVG_RELOAD';
    archetypeLabel = 'ICT SILVER BULLET 50% FVG CE RELOAD';
    edgeThesis = 'An unfilled 5m or 15m gap, limit at the midpoint';
  } else if (/poc|val|vah|profile|auction/i.test(strat)){
    archetype = 'VAL_VAH_POC_AUCTION_SNAP';
    archetypeLabel = 'VALUE AREA SPRING -> POC MAGNET SNAP';
    edgeThesis = 'Price left the value area and the volume node is the magnet';
  } else if (/breaker|ifvg|flip/i.test(strat)){
    archetype = 'BREAKER_IFVG_FLIP_DEFENSE';
    archetypeLabel = 'BREAKER + INVERSE FVG POLARITY FLIP';
    edgeThesis = 'A broken zone flipped, with volume behind the flip';
  } else if (/orb|coil|squeeze|breakout|expan/i.test(strat)){
    archetype = 'ORB_COMPRESSION_SQUEEZE';
    archetypeLabel = 'OPENING RANGE COMPRESSION SQUEEZE';
    edgeThesis = 'A tight range released on a close near the extreme';
  } else if (hasSweep && (micro15.mssConfirmed || (micro5 && micro5.mssConfirmed))){
    archetype = 'NY_JUDAS_LIQUIDITY_SWEEP';
    archetypeLabel = 'JUDAS LIQUIDITY SWEEP + MSS RECLAIM';
    edgeThesis = 'A raid beyond the session extreme, then a 5m or 15m reclaim';
  } else if (hasFvg && (isSilverBulletWindow || micro15.mssConfirmed)){
    archetype = 'SILVER_BULLET_FVG_RELOAD';
    archetypeLabel = 'ICT SILVER BULLET 50% FVG CE RELOAD';
    edgeThesis = 'An unfilled 5m or 15m gap, limit at the midpoint';
  } else if (hasVaSpring){
    archetype = 'VAL_VAH_POC_AUCTION_SNAP';
    archetypeLabel = 'VALUE AREA SPRING -> POC MAGNET SNAP';
    edgeThesis = 'Price left the value area and the volume node is the magnet';
  } else if (hasIfvgOrBreaker && isFinite(+micro15.volCommitmentRatio) && +micro15.volCommitmentRatio >= 1.25){
    archetype = 'BREAKER_IFVG_FLIP_DEFENSE';
    archetypeLabel = 'BREAKER + INVERSE FVG POLARITY FLIP';
    edgeThesis = 'A broken zone flipped, with volume behind the flip';
  } else if (isFinite(+micro15.impulseZScore) && +micro15.impulseZScore >= 1.20 && isFinite(+micro15.clvScore) && Math.abs(+micro15.clvScore) >= 0.55){
    archetype = 'ORB_COMPRESSION_SQUEEZE';
    archetypeLabel = 'OPENING RANGE COMPRESSION SQUEEZE';
    edgeThesis = 'A tight range released on a close near the extreme';
  } else if (emaRibbonAligned15 === true && emaRibbonAligned5 === true){
    archetype = 'VWAP_EMA_RIBBON_CONTINUATION';
    archetypeLabel = '5M/15M VWAP + EMA RIBBON SCALP';
    edgeThesis = 'The 9 and 21 averages agree on both the 5m and the 15m';
  }
  return {
    ok: archetype !== 'UNREAD', side: side, archetype: archetype, archetypeLabel: archetypeLabel, edgeThesis: edgeThesis,
    killzoneActive: killzoneActive, killzoneWindow: killzoneWindow, isSilverBulletWindow: isSilverBulletWindow,
    emaRibbonAligned15: emaRibbonAligned15, emaRibbonAligned5: emaRibbonAligned5,
    ema9_15: isFinite(ema9_15) ? ema9_15 : null, ema21_15: isFinite(ema21_15) ? ema21_15 : null,
    ema9_5: isFinite(ema9_5) ? ema9_5 : null, ema21_5: isFinite(ema21_5) ? ema21_5 : null,
    micro15: micro15, micro5: micro5, volProfile: volProf, liquidityMap: liqMap, benchmarks: benchmarks, fractalCascade: fractal
  };
}

/* hg-v1373: 5m order flow from printed volume only. A bar with no volume
   or no range is skipped. It is not given volume 1. */
function sgGoldScalpBarDelta(bar){
  if (!bar) return null;
  var px = sgBarPx(bar);
  if (!px || !(px.h > px.l)) return null;
  var v = N(bar.v != null ? bar.v : bar.vol);
  if (!(isFinite(v) && v > 0)) return null;
  return v * (2 * ((px.c - px.l) / (px.h - px.l)) - 1);
}

function sgGoldScalpOrderFlowEngine(c, intel){
  c = c || {};
  intel = intel || {};
  var sideRaw = String(c.dir || c.side || '').toLowerCase();
  if (sideRaw === 'buy' || sideRaw === 'bull') sideRaw = 'long';
  if (sideRaw === 'sell' || sideRaw === 'bear') sideRaw = 'short';
  var rows = (Array.isArray(c.rows5m) && c.rows5m.length >= 8) ? c.rows5m
    : ((Array.isArray(intel.rows5) && intel.rows5.length >= 8) ? intel.rows5
    : ((Array.isArray(c.rows15m) && c.rows15m.length) ? c.rows15m
    : (Array.isArray(intel.rows15) ? intel.rows15 : [])));
  var bars = [];
  for (var i = 0; i < rows.length; i++){
    var px = sgBarPx(rows[i]);
    var d = sgGoldScalpBarDelta(rows[i]);
    if (!px) continue;
    bars.push({ o: px.o, h: px.h, l: px.l, c: px.c, d: d });
  }
  var measured = bars.filter(function(b){ return b.d != null; });
  if (sideRaw !== 'long' && sideRaw !== 'short'){
    return { ok: false, reason: 'no side, so order flow is unread' };
  }
  if (measured.length < 6){
    return { ok: false, reason: 'not enough bars with volume for a CVD read' };
  }
  var isLong = sideRaw === 'long';
  var recent = measured.slice(-12);
  var sum = 0, pos = 0, neg = 0;
  for (i = 0; i < recent.length; i++){
    sum += recent[i].d;
    if (recent[i].d > 0) pos++;
    else if (recent[i].d < 0) neg++;
  }
  var n = recent.length;
  var trend = 'MIXED';
  if (sum > 0 && pos / n >= 0.70) trend = 'BULL_ACCUMULATION';
  else if (sum < 0 && neg / n >= 0.70) trend = 'BEAR_DISTRIBUTION';
  var sideHits = isLong ? pos : neg;
  var cvdDeltaScore = Math.round((100 * sideHits) / n);
  var bestTrap = 0;
  for (var j = 6; j < bars.length; j++){
    var priorLo = Infinity, priorHi = -Infinity;
    for (var k = j - 6; k < j; k++){
      if (bars[k].l < priorLo) priorLo = bars[k].l;
      if (bars[k].h > priorHi) priorHi = bars[k].h;
    }
    var rng = bars[j].h - bars[j].l;
    if (!(rng > 0) || !isFinite(priorLo) || !isFinite(priorHi)) continue;
    var loc = (bars[j].c - bars[j].l) / rng;
    if (isLong && bars[j].l < priorLo && bars[j].c > priorLo){
      if (loc * 100 > bestTrap) bestTrap = loc * 100;
    } else if (!isLong && bars[j].h > priorHi && bars[j].c < priorHi){
      var sLoc = (1 - loc) * 100;
      if (sLoc > bestTrap) bestTrap = sLoc;
    }
  }
  var absorption = false;
  var absFrom = Math.max(0, bars.length - 12);
  for (j = absFrom; j < bars.length; j++){
    var br = bars[j];
    var span = br.h - br.l;
    if (!(span > 0) || br.d == null) continue;
    var lowerWick = Math.min(br.o, br.c) - br.l;
    var upperWick = br.h - Math.max(br.o, br.c);
    if (isLong && lowerWick >= span * 0.45 && br.d > 0) absorption = true;
    if (!isLong && upperWick >= span * 0.45 && br.d < 0) absorption = true;
  }
  var chasing = false;
  var pullbackPx = null;
  if (bars.length >= 8){
    var look = bars.slice(-13, -1);
    var hi = -Infinity, lo = Infinity;
    for (j = 0; j < look.length; j++){
      if (look[j].h > hi) hi = look[j].h;
      if (look[j].l < lo) lo = look[j].l;
    }
    var lastC = bars[bars.length - 1].c;
    if (isFinite(hi) && isFinite(lo) && hi > lo){
      if (isLong && lastC > hi) chasing = true;
      if (!isLong && lastC < lo) chasing = true;
    }
    if (chasing){
      for (j = 1; j < look.length - 1; j++){
        var swing = isLong
          ? (look[j].l < look[j - 1].l && look[j].l < look[j + 1].l)
          : (look[j].h > look[j - 1].h && look[j].h > look[j + 1].h);
        if (!swing) continue;
        var pxSwing = isLong ? look[j].l : look[j].h;
        if (pullbackPx == null || Math.abs(pxSwing - lastC) < Math.abs(pullbackPx - lastC)) pullbackPx = +pxSwing.toFixed(2);
      }
    }
  }
  return {
    ok: true,
    cvdTrend: trend,
    cvdAligned: (isLong && trend === 'BULL_ACCUMULATION') || (!isLong && trend === 'BEAR_DISTRIBUTION'),
    cvdDeltaScore: cvdDeltaScore,
    cvdAbsorptionDivergence: absorption,
    trapReversalScore: Math.round(bestTrap),
    chasingExhaustion: chasing,
    exhaustionPullbackPx: pullbackPx
  };
}

/* The first six 5m bars are the opening range of the tape we were given.
   A later sweep that closes back inside that range is a reclaim. */
function sgGoldScalpSessionPools(c, intel){
  c = c || {};
  intel = intel || {};
  var rows = (Array.isArray(c.rows5m) && c.rows5m.length) ? c.rows5m
    : (Array.isArray(intel.rows5) ? intel.rows5 : []);
  if (rows.length < 6) return { ok: false, reason: '5m tape is too short for an opening range' };
  var bars = [];
  for (var i = 0; i < rows.length; i++){
    var px = sgBarPx(rows[i]);
    if (px) bars.push(px);
  }
  if (bars.length < 6) return { ok: false, reason: '5m tape is too short for an opening range' };
  var orbHigh = -Infinity, orbLow = Infinity;
  for (i = 0; i < 6; i++){
    if (bars[i].h > orbHigh) orbHigh = bars[i].h;
    if (bars[i].l < orbLow) orbLow = bars[i].l;
  }
  if (!(orbHigh > orbLow)) return { ok: false, reason: 'opening range was not measured' };
  var longReclaim = false, shortReclaim = false;
  for (i = 6; i < bars.length; i++){
    if (bars[i].l < orbLow && bars[i].c >= orbLow && bars[i].c <= orbHigh) longReclaim = true;
    if (bars[i].h > orbHigh && bars[i].c <= orbHigh && bars[i].c >= orbLow) shortReclaim = true;
  }
  var sideRaw = String(c.dir || c.side || '').toLowerCase();
  var orbState = 'ORB_INSIDE';
  if (longReclaim && shortReclaim){
    orbState = (sideRaw === 'short' || sideRaw === 'sell') ? 'ORB_SWEEP_RECLAIM_SHORT' : 'ORB_SWEEP_RECLAIM_LONG';
  } else if (longReclaim) orbState = 'ORB_SWEEP_RECLAIM_LONG';
  else if (shortReclaim) orbState = 'ORB_SWEEP_RECLAIM_SHORT';
  else if (bars[bars.length - 1].c > orbHigh) orbState = 'ORB_BREAK_LONG';
  else if (bars[bars.length - 1].c < orbLow) orbState = 'ORB_BREAK_SHORT';
  function dupPrices(pick){
    var counts = {};
    for (var d = 0; d < bars.length; d++){
      var key = pick(bars[d]).toFixed(2);
      counts[key] = (counts[key] || 0) + 1;
    }
    var found = [];
    Object.keys(counts).forEach(function(key){ if (counts[key] >= 2) found.push(+key); });
    found.sort(function(a, b){ return a - b; });
    return found;
  }
  var ref = N(c.entry);
  if (!(ref > 0)) ref = N(c.mark);
  if (!(ref > 0)) ref = bars[bars.length - 1].c;
  var nextPool = null;
  if (ref > 0){
    var wantShort = (sideRaw === 'short' || sideRaw === 'sell');
    for (i = 1; i < bars.length - 1; i++){
      var swingHi = bars[i].h > bars[i - 1].h && bars[i].h > bars[i + 1].h;
      var swingLo = bars[i].l < bars[i - 1].l && bars[i].l < bars[i + 1].l;
      if (!wantShort && swingHi && bars[i].h > ref){
        if (nextPool == null || bars[i].h < nextPool) nextPool = bars[i].h;
      }
      if (wantShort && swingLo && bars[i].l < ref){
        if (nextPool == null || bars[i].l > nextPool) nextPool = bars[i].l;
      }
    }
  }
  return {
    ok: true,
    orbHigh: +orbHigh.toFixed(2),
    orbLow: +orbLow.toFixed(2),
    orbMid: +(((orbHigh + orbLow) / 2).toFixed(2)),
    orbState: orbState,
    eqHighs5m: dupPrices(function(b){ return b.h; }),
    eqLows5m: dupPrices(function(b){ return b.l; }),
    nextPoolPx: nextPool != null ? +nextPool.toFixed(2) : null
  };
}

/* Pace is the mean high-low of the last 8 five-minute bars that printed
   volume. Minutes are that pace applied to the suggestion distance to TP1.
   They are not clamped. No pace, no velocity number. */
function sgGoldScalpVelocityProfile(c, sb, scoreCard, intel){
  c = c || {};
  sb = sb || {};
  intel = intel || {};
  var rows = (Array.isArray(c.rows5m) && c.rows5m.length) ? c.rows5m
    : (Array.isArray(intel.rows5) ? intel.rows5 : []);
  var ranges = [];
  for (var i = 0; i < rows.length; i++){
    var px = sgBarPx(rows[i]);
    var v = N(rows[i] && (rows[i].v != null ? rows[i].v : rows[i].vol));
    if (!px || !(px.h > px.l) || !(v > 0)) continue;
    ranges.push(px.h - px.l);
  }
  var last8 = ranges.slice(-8);
  var entry = N(sb.entry);
  var t1 = N(sb.t1);
  var dist = (entry > 0 && t1 > 0) ? Math.abs(t1 - entry) : NaN;
  if (last8.length < 4 || !(dist > 0)){
    return { ok: false, estBars5mToTp1: null, estMinutesToTp1: null, velocityAdjustedEvR: null, rPerHourVelocity: null, reason: 'pace or TP1 distance was not measured' };
  }
  var sum = 0;
  for (i = 0; i < last8.length; i++) sum += last8[i];
  var pace = sum / last8.length;
  if (!(pace > 0)){
    return { ok: false, estBars5mToTp1: null, estMinutesToTp1: null, velocityAdjustedEvR: null, rPerHourVelocity: null, reason: '5m pace was not measured' };
  }
  var minutes = (dist / pace) * 5;
  var rr = (isFinite(+sb.rr1) && +sb.rr1 > 0) ? +sb.rr1 : (isFinite(+sb.riskDist) && +sb.riskDist > 0 ? dist / +sb.riskDist : NaN);
  var perHour = (isFinite(rr) && minutes > 0) ? rr / (minutes / 60) : null;
  var net = (scoreCard && isFinite(+scoreCard.netExpectedValueR)) ? +scoreCard.netExpectedValueR : null;
  var winPct = (scoreCard && scoreCard.expectancy && isFinite(+scoreCard.expectancy.estWinPct)) ? +scoreCard.expectancy.estWinPct : null;
  var adj = (net != null && winPct != null) ? +(net + (1 - winPct / 100) * 0.45).toFixed(2) : null;
  return {
    ok: true,
    estBars5mToTp1: +(minutes / 5).toFixed(2),
    estMinutesToTp1: +minutes.toFixed(2),
    velocityAdjustedEvR: adj,
    rPerHourVelocity: perHour != null ? +perHour.toFixed(2) : null,
    pacePer5m: +pace.toFixed(3)
  };
}

function sgRefineGoldScalpBracket(c, intel, win){
  win = win || W;
  c = c || {};
  intel = intel || {};
  var archInfo = sgDetectGoldScalpArchetypes(c, intel, win);
  var side = archInfo.side;
  var isLong = side === 'long';
  var rawEntry = N(c.rawEntry != null ? c.rawEntry : c.entry);
  var rawStop = N(c.rawStop != null ? c.rawStop : c.stop);
  var rawT1 = N(c.rawT1 != null ? c.rawT1 : (c.t1 || c.tp));
  var rawT2 = N(c.t2 || c.tp2);
  var rawT3 = N(c.t3 || c.tp3);
  if (!(rawEntry > 0 && rawStop > 0 && rawEntry !== rawStop) || (side !== 'long' && side !== 'short')){
    return { ok: false, reason: 'invalid raw scalp entry/stop' };
  }
  var rows15 = Array.isArray(c.rows15m) && c.rows15m.length ? c.rows15m : (Array.isArray(intel.rows15) ? intel.rows15 : []);
  var rows5 = Array.isArray(c.rows5m) && c.rows5m.length ? c.rows5m : (Array.isArray(intel.rows5) ? intel.rows5 : []);
  var atr15 = (intel.volRegime && intel.volRegime.ok && isFinite(+intel.volRegime.atrNow) && +intel.volRegime.atrNow > 0)
    ? +intel.volRegime.atrNow : sgCalcBarsAtr(rows15, 14);
  if (!(isFinite(atr15) && atr15 > 0)){
    return {
      ok: true, unread: true, side: side, entry: rawEntry, stop: rawStop,
      t1: rawT1 > 0 ? rawT1 : null, t2: rawT2 > 0 ? rawT2 : null, t3: rawT3 > 0 ? rawT3 : null,
      entryReason: 'ATR was not measured, so the desk scalp prices stay',
      entryTranches: null, splits: null, ratchetLadder: [], archetypeInfo: archInfo, atr: null, movedEntry: false,
      microLadder: null, microBlendedEntry: null, softInvalidationPx: null, softInvalidationRule: null
    };
  }
  var atr5 = sgCalcBarsAtr(rows5, 14);
  var micro15 = archInfo.micro15 || {};
  var micro5 = archInfo.micro5 || {};
  var volProf = archInfo.volProfile || {};
  var liqMap = archInfo.liquidityMap || {};
  var swing15 = sgImpulseSwing(rows15, side);
  var bestEntry = rawEntry;
  var entryAnchorReason = 'desk scalp trigger';
  var coreAnchorPx = rawEntry;
  var fvg5 = micro5 && micro5.nearestFvg && Math.abs(micro5.nearestFvg.ce - rawEntry) <= atr15 * 0.45 ? micro5.nearestFvg : null;
  var fvg15 = micro15 && micro15.nearestFvg && Math.abs(micro15.nearestFvg.ce - rawEntry) <= atr15 * 0.55 ? micro15.nearestFvg : null;
  var ifvg15 = micro15 && micro15.nearestIfvg && Math.abs(micro15.nearestIfvg.ce - rawEntry) <= atr15 * 0.55 ? micro15.nearestIfvg : null;
  var brk15 = micro15 && micro15.nearestBreaker && Math.abs(micro15.nearestBreaker.mt - rawEntry) <= atr15 * 0.55 ? micro15.nearestBreaker : null;
  var ob15 = micro15 && micro15.nearestOb && Math.abs(micro15.nearestOb.mt - rawEntry) <= atr15 * 0.55 ? micro15.nearestOb : null;
  var structItems = (intel.structure && intel.structure.ok && Array.isArray(intel.structure.items)) ? intel.structure.items : [];
  var nearStruct = null;
  for (var i = 0; i < structItems.length; i++){
    var spx = N(structItems[i] && structItems[i].px);
    if (isFinite(spx) && spx > 0 && Math.abs(spx - rawEntry) <= atr15 * 0.42){
      if (!nearStruct || Math.abs(spx - rawEntry) < Math.abs(nearStruct.px - rawEntry)){
        nearStruct = { px: spx, label: structItems[i].label || '15m structure' };
      }
    }
  }
  if (fvg5 && nearStruct){
    bestEntry = +((fvg5.ce * 0.55 + (isLong ? nearStruct.px + 0.20 : nearStruct.px - 0.20) * 0.45)).toFixed(2);
    entryAnchorReason = '5m FVG CE (' + fmt(fvg5.ce, 2) + ') + front-run ' + nearStruct.label;
    coreAnchorPx = fvg5.ce;
  } else if (nearStruct){
    bestEntry = +(isLong ? nearStruct.px + 0.22 : nearStruct.px - 0.22).toFixed(2);
    entryAnchorReason = 'front-run ' + nearStruct.label + ' @ ' + fmt(nearStruct.px, 2);
    coreAnchorPx = nearStruct.px;
  } else if (fvg5){
    bestEntry = +((rawEntry * 0.45 + fvg5.ce * 0.55)).toFixed(2);
    entryAnchorReason = '5m FVG CE (' + fmt(fvg5.ce, 2) + ')';
    coreAnchorPx = fvg5.ce;
  } else if (fvg15){
    bestEntry = +((rawEntry * 0.50 + fvg15.ce * 0.50)).toFixed(2);
    entryAnchorReason = '15m FVG 50% CE (' + fmt(fvg15.ce, 2) + ')';
    coreAnchorPx = fvg15.ce;
  } else if (ifvg15){
    bestEntry = +((rawEntry * 0.50 + ifvg15.ce * 0.50)).toFixed(2);
    entryAnchorReason = '15m IFVG 50% CE (' + fmt(ifvg15.ce, 2) + ')';
    coreAnchorPx = ifvg15.ce;
  } else if (brk15){
    bestEntry = +((rawEntry * 0.50 + brk15.mt * 0.50)).toFixed(2);
    entryAnchorReason = '15m Breaker 50% MT (' + fmt(brk15.mt, 2) + ')';
    coreAnchorPx = brk15.mt;
  } else if (ob15){
    bestEntry = +((rawEntry * 0.50 + ob15.mt * 0.50)).toFixed(2);
    entryAnchorReason = '15m OB 50% MT (' + fmt(ob15.mt, 2) + ')';
    coreAnchorPx = ob15.mt;
  } else if (volProf && volProf.ok && volProf.nearPoc && isFinite(volProf.poc)){
    bestEntry = +((rawEntry * 0.55 + volProf.poc * 0.45)).toFixed(2);
    entryAnchorReason = 'Intraday POC Magnet (' + fmt(volProf.poc, 2) + ')';
    coreAnchorPx = volProf.poc;
  }
  var regime = (intel.volRegime && intel.volRegime.regime) ? String(intel.volRegime.regime).toUpperCase() : '';
  var zonePad = (isFinite(atr5) && atr5 > 0) ? +(atr5 * (regime === 'EXPANSION' ? 0.30 : 0.22)).toFixed(2) : null;
  var entryZoneLow = zonePad != null ? +(bestEntry - zonePad).toFixed(2) : bestEntry;
  var entryZoneHigh = zonePad != null ? +(bestEntry + zonePad).toFixed(2) : bestEntry;
  var w1Pct = (regime === 'EXPANSION') ? 50 : ((micro15 && micro15.absorptionDetected && isFinite(+micro15.wickRejectionScore) && +micro15.wickRejectionScore >= 75) ? 70 : 65);
  var w2Pct = 100 - w1Pct;
  var t2EntryPx = zonePad == null ? bestEntry : (isLong ? entryZoneLow : entryZoneHigh);
  var blendedEntry = +((w1Pct / 100) * bestEntry + (w2Pct / 100) * t2EntryPx).toFixed(2);
  var minScalpStopDist = +(atr15 * 0.65).toFixed(2);
  var maxScalpStopDist = Math.max(Math.abs(rawEntry - rawStop), +(atr15 * 1.85).toFixed(2));
  var candidateStop = rawStop;
  if (micro5 && isFinite(micro5.sweptLevel) && isFinite(atr5) && atr5 > 0){
    var swStop = isLong ? (micro5.sweptLevel - atr5 * 0.35) : (micro5.sweptLevel + atr5 * 0.35);
    if (Math.abs(bestEntry - swStop) >= minScalpStopDist && Math.abs(bestEntry - swStop) <= maxScalpStopDist) candidateStop = swStop;
  }
  var curStopDist = Math.abs(bestEntry - candidateStop);
  if (curStopDist < minScalpStopDist) candidateStop = isLong ? (bestEntry - minScalpStopDist) : (bestEntry + minScalpStopDist);
  else if (curStopDist > maxScalpStopDist) candidateStop = isLong ? (bestEntry - maxScalpStopDist) : (bestEntry + maxScalpStopDist);
  var shield = sgPsychShieldStop(candidateStop, side);
  if (!shield.shielded && isFinite(+candidateStop)){
    var nearest5 = Math.round(+candidateStop / 5) * 5;
    if (Math.abs(+candidateStop - nearest5) <= 0.65){
      var s5 = isLong ? Math.min(+candidateStop, nearest5 - 0.65) : Math.max(+candidateStop, nearest5 + 0.65);
      shield = { stop: +s5.toFixed(2), shielded: true, magnet: nearest5 };
    }
  }
  var bestStop = shield.stop;
  if (isLong && bestStop >= bestEntry) bestStop = +(bestEntry - minScalpStopDist).toFixed(2);
  if (!isLong && bestStop <= bestEntry) bestStop = +(bestEntry + minScalpStopDist).toFixed(2);
  var riskDist = +(Math.abs(bestEntry - bestStop)).toFixed(2);
  if (!(riskDist > 0)) return { ok: false, reason: 'scalp stop collapsed onto the entry' };
  var stopAtrRatio = +(riskDist / atr15).toFixed(2);
  var minT1Dist = riskDist * 1.65;
  var targetT1 = (rawT1 > 0 && Math.abs(rawT1 - bestEntry) >= riskDist * 1.45 && Math.abs(rawT1 - bestEntry) <= riskDist * 4.5)
    ? rawT1 : (isLong ? (bestEntry + minT1Dist) : (bestEntry - minT1Dist));
  var t1FrontRun = false;
  for (var j = 0; j < structItems.length; j++){
    var opPx = N(structItems[j] && structItems[j].px);
    if (!isFinite(opPx) || opPx <= 0) continue;
    if (isLong && opPx > bestEntry + riskDist * 1.35 && Math.abs(opPx - targetT1) <= atr15 * 0.55){
      targetT1 = +(opPx - 0.35).toFixed(2); t1FrontRun = true; break;
    } else if (!isLong && opPx < bestEntry - riskDist * 1.35 && Math.abs(opPx - targetT1) <= atr15 * 0.55){
      targetT1 = +(opPx + 0.35).toFixed(2); t1FrontRun = true; break;
    }
  }
  var dolMagnetized = false;
  if (!t1FrontRun && liqMap && liqMap.ok && liqMap.drawOnLiquidity && isFinite(liqMap.drawOnLiquidity.px)){
    var dolPx = liqMap.drawOnLiquidity.px;
    if (isLong && dolPx >= bestEntry + riskDist * 1.4 && Math.abs(dolPx - targetT1) <= atr15 * 0.75){
      targetT1 = +(dolPx - 0.35).toFixed(2); dolMagnetized = true;
    } else if (!isLong && dolPx <= bestEntry - riskDist * 1.4 && Math.abs(dolPx - targetT1) <= atr15 * 0.75){
      targetT1 = +(dolPx + 0.35).toFixed(2); dolMagnetized = true;
    }
  }
  targetT1 = +targetT1.toFixed(2);
  var targetT2 = (rawT2 > 0 && Math.abs(rawT2 - bestEntry) > Math.abs(targetT1 - bestEntry))
    ? rawT2 : (isLong ? (bestEntry + riskDist * 2.55) : (bestEntry - riskDist * 2.55));
  if (swing15 && isFinite(swing15.ext1618)){
    if (isLong && swing15.ext1618 > targetT1 + riskDist * 0.45 && swing15.ext1618 <= bestEntry + riskDist * 3.4) targetT2 = swing15.ext1618;
    else if (!isLong && swing15.ext1618 < targetT1 - riskDist * 0.45 && swing15.ext1618 >= bestEntry - riskDist * 3.4) targetT2 = swing15.ext1618;
  }
  targetT2 = +targetT2.toFixed(2);
  var targetT3 = (rawT3 > 0 && Math.abs(rawT3 - bestEntry) > Math.abs(targetT2 - bestEntry))
    ? rawT3 : (isLong ? (bestEntry + riskDist * 3.4) : (bestEntry - riskDist * 3.4));
  if (isLong && targetT3 <= targetT2) targetT3 = +(targetT2 + riskDist * 0.9).toFixed(2);
  if (!isLong && targetT3 >= targetT2) targetT3 = +(targetT2 - riskDist * 0.9).toFixed(2);
  targetT3 = +targetT3.toFixed(2);
  var rr1 = +(Math.abs(targetT1 - bestEntry) / riskDist).toFixed(2);
  var rr2 = +(Math.abs(targetT2 - bestEntry) / riskDist).toFixed(2);
  var rr3 = +(Math.abs(targetT3 - bestEntry) / riskDist).toFixed(2);
  var ft = intel.fiveTf || {};
  var wantDir = isLong ? 'BULL' : 'BEAR';
  var alignedCnt = isLong ? N(ft.bull) : N(ft.bear);
  var scalpSplits = (regime === 'COMPRESSION')
    ? { t1Pct: 65, t2Pct: 25, t3Pct: 10, splitScheme: 'SCALP_FAST_BANK_65_25_10' }
    : ((ft.aligned === wantDir && isFinite(alignedCnt) && alignedCnt >= 5)
      ? { t1Pct: 45, t2Pct: 30, t3Pct: 25, splitScheme: 'SCALP_CASCADE_RUNNER_45_30_25' }
      : { t1Pct: 55, t2Pct: 30, t3Pct: 15, splitScheme: 'SCALP_STANDARD_55_30_15' });
  var blendedRr = +((scalpSplits.t1Pct * rr1 + scalpSplits.t2Pct * rr2 + scalpSplits.t3Pct * rr3) / 100).toFixed(2);
  var mfe060Px = +(isLong ? (bestEntry + riskDist * 0.60) : (bestEntry - riskDist * 0.60)).toFixed(2);
  var cutRiskStop = +(isLong ? (bestEntry - riskDist * 0.35) : (bestEntry + riskDist * 0.35)).toFixed(2);
  var bePlusStop = +(isLong ? (bestEntry + riskDist * 0.25) : (bestEntry - riskDist * 0.25)).toFixed(2);
  var sweepCatch = null;
  var sweepList = (micro5 && Array.isArray(micro5.sweeps)) ? micro5.sweeps : [];
  for (var swi = 0; swi < sweepList.length; swi++){
    var swPool = N(sweepList[swi] && sweepList[swi].pool);
    if (!(swPool > 0) || sweepList[swi].side !== side) continue;
    if (isLong && swPool < bestEntry && (sweepCatch == null || swPool > sweepCatch)) sweepCatch = swPool;
    if (!isLong && swPool > bestEntry && (sweepCatch == null || swPool < sweepCatch)) sweepCatch = swPool;
  }
  if (sweepCatch == null) sweepCatch = isLong ? entryZoneLow : entryZoneHigh;
  var microLadder = [
    { rung: 1, weightPct: 50, price: +bestEntry.toFixed(2), role: 'Front-Run Tap' },
    { rung: 2, weightPct: 35, price: +(+coreAnchorPx).toFixed(2), role: 'Core Anchor' },
    { rung: 3, weightPct: 15, price: +(+sweepCatch).toFixed(2), role: 'Sweep Catcher' }
  ];
  var microBlendedEntry = +((microLadder[0].price * 0.50 + microLadder[1].price * 0.35 + microLadder[2].price * 0.15)).toFixed(2);
  var softInvalidationPx = +(isLong ? (bestEntry - riskDist * 0.55) : (bestEntry + riskDist * 0.55)).toFixed(2);
  var softInvalidationRule = '5m candle close through -0.55R scratches the idea. The hard stop is not moved.';
  return {
    ok: true, unread: false, side: side, entry: bestEntry, blendedEntry: blendedEntry, rawEntry: rawEntry,
    movedEntry: bestEntry !== +rawEntry.toFixed(2),
    entryZone: [entryZoneLow, entryZoneHigh],
    entryTranches: [
      { tranche: 1, weightPct: w1Pct, price: bestEntry, role: '5m/15m Primary Scalp Trigger' },
      { tranche: 2, weightPct: w2Pct, price: t2EntryPx, role: 'Deep Micro-OTE / OB Reload' }
    ],
    entryReason: entryAnchorReason, stop: +(+bestStop).toFixed(2), rawStop: rawStop, riskDist: riskDist,
    atr: +atr15.toFixed(2), atr5m: (isFinite(atr5) && atr5 > 0) ? +atr5.toFixed(2) : null,
    stopAtrRatio: stopAtrRatio, psychShielded: !!shield.shielded, psychMagnet: shield.magnet,
    slNote: (shield.shielded ? ('shielded past $' + shield.magnet + ' · ') : '') + fmt(riskDist, 2) + ' pts (' + fmt(stopAtrRatio, 2) + ' ATR)',
    t1: targetT1, t2: targetT2, t3: targetT3, t1FrontRun: t1FrontRun, dolMagnetized: dolMagnetized,
    rr1: rr1, rr2: rr2, rr3: rr3, blendedRr: blendedRr, splits: scalpSplits,
    ratchetLadder: [
      { stage: 0, code: 'SCALP_INITIAL_SHIELD', triggerPx: bestEntry, stopPx: +(+bestStop).toFixed(2), note: 'Suggested scalp stop. The desk stop is not moved.' },
      { stage: 1, code: 'SCALP_MFE_0_60R_TRIM', triggerPx: mfe060Px, stopPx: cutRiskStop, note: 'If price trades +0.60R, the plan tightens the stop to -0.35R' },
      { stage: 2, code: 'SCALP_TP1_BANK_BE_PLUS', triggerPx: targetT1, stopPx: bePlusStop, note: 'If TP1 fills, the plan locks the stop 0.25R past entry' },
      { stage: 3, code: 'SCALP_TP2_LOCK_TP1', triggerPx: targetT2, stopPx: targetT1, note: 'If TP2 fills, the plan locks the stop at TP1' }
    ],
    microLadder: microLadder,
    microBlendedEntry: microBlendedEntry,
    softInvalidationPx: softInvalidationPx,
    softInvalidationRule: softInvalidationRule,
    archetypeInfo: archInfo
  };
}

function sgScoreGoldScalpSetup(c, scalpBracket, intel, win){
  win = win || W;
  c = c || {};
  intel = intel || {};
  var sb = scalpBracket || sgRefineGoldScalpBracket(c, intel, win);
  if (!sb || !sb.ok){
    return { ok: false, scalpScore: 0, scalpTier: 'SCALP VETO', gatesPassed: 0, gatesTotal: 10, gates: [], spreadUsd: null };
  }
  var arch = sb.archetypeInfo || sgDetectGoldScalpArchetypes(c, intel, win);
  var micro15 = arch.micro15 || {};
  var micro5 = arch.micro5 || {};
  var volProf = arch.volProfile || {};
  var liqMap = arch.liquidityMap || {};
  var advGuard = sgAdverseSelectionGuard(c, sb, intel);
  var decay = sgEvaluateSetupDecay(c, sb, intel);
  var smtRead = sgCrossVenueSmtRead(c, intel, win);
  var spreadUsd = null;
  try{
    if (typeof win.goldspotState === 'function'){
      var sp = win.goldspotState();
      if (sp && isFinite(N(sp.spot)) && isFinite(N(sp.xm)) && N(sp.spot) > 0 && N(sp.xm) > 0){
        spreadUsd = +(Math.abs(N(sp.spot) - N(sp.xm))).toFixed(2);
      }
    }
  }catch(eSp){}
  var spreadToRiskPct = (spreadUsd != null && sb.riskDist > 0) ? +((spreadUsd / sb.riskDist) * 100).toFixed(1) : null;
  var gates = [], passedCnt = 0, vetoReasons = [];
  function gate(id, label, passed, detail, critical){
    var p = passed === true;
    gates.push({ id: id, label: label, passed: p, detail: detail || '', critical: !!critical });
    if (p) passedCnt++;
    else if (critical) vetoReasons.push(label);
  }
  gate('GS_G1_KILLZONE_TIMING', 'Kill-Zone / Silver Bullet Timing', arch.killzoneActive === true, arch.killzoneWindow, false);
  var ag15 = sgCandleAgreement(intel, sb.side);
  var m5m15Sync = (ag15.verdict === 'WITH' || arch.emaRibbonAligned15 === true) && arch.emaRibbonAligned5 === true;
  gate('GS_G2_M5_M15_IMPULSE_SYNC', '5m/15m Impulse & EMA9/21 Sync', m5m15Sync, '15m ' + ag15.verdict, false);
  var hasMicroAnchor = !!(micro15.nearestFvg || micro15.nearestIfvg || micro15.nearestOb || micro15.nearestBreaker
    || micro15.sweepReclaimed || (micro5 && (micro5.nearestFvg || micro5.sweepReclaimed)));
  gate('GS_G3_MICROSTRUCTURE_ANCHOR', '5m/15m FVG/OB/Sweep Anchor', hasMicroAnchor, sb.entryReason, false);
  var vaOk = !!(volProf.ok && (volProf.nearPoc || volProf.profileState === 'VAL_SPRING_RECLAIM' || volProf.profileState === 'VAH_UPTHRUST_REJECT' || (liqMap.ok && liqMap.inFavorableZone)));
  gate('GS_G4_VOLUME_PROFILE_VA', 'Volume Profile & Discount/Premium', vaOk, volProf.profileState || 'unread', false);
  var wick = isFinite(+micro15.wickRejectionScore) ? +micro15.wickRejectionScore : null;
  var absOk = !!(micro15.absorptionDetected || (wick != null && wick >= 55) || (micro5 && micro5.absorptionDetected));
  gate('GS_G5_WICK_ABSORPTION_CLV', 'Wick Absorption & CLV Pressure', absOk, wick != null ? ('Wick score ' + wick) : 'wick score unread', false);
  gate('GS_G6_SPREAD_TO_RISK_GUARD', 'Spread-to-Stop Efficiency (<=18%)', spreadToRiskPct != null && spreadToRiskPct <= 18,
    spreadToRiskPct == null ? 'spread was not read' : ('Spread $' + fmt(spreadUsd, 2) + ' = ' + spreadToRiskPct + '% of SL'),
    spreadToRiskPct != null && spreadToRiskPct > 28);
  gate('GS_G7_SWEEP_SHIELDED_STOP', 'Micro-Sweep-Shielded Stop Geometry', !sb.unread && sb.stopAtrRatio >= 0.60 && sb.stopAtrRatio <= 2.15, sb.slNote || 'ATR unread', false);
  gate('GS_G8_ASYMMETRIC_SCALP_PAYOFF', 'Fast-Bank TP Asymmetry', !sb.unread && sb.rr1 >= 1.45 && sb.blendedRr >= 1.95,
    sb.unread ? 'ATR unread' : ('TP1 ' + fmt(sb.rr1, 2) + 'R · Blended ' + fmt(sb.blendedRr, 2) + 'R'), false);
  var execSafe = advGuard.status !== 'KNIFE_HAZARD' && decay.status !== 'FRONT_RUN_INVALIDATED' && decay.status !== 'EXPIRED';
  gate('GS_G9_ADVERSE_SELECTION_SAFE', 'Knife & Front-Run Guard Clear', execSafe, advGuard.status + ' · ' + decay.status, decay.status === 'FRONT_RUN_INVALIDATED' || decay.status === 'EXPIRED');
  var blackout = !!(intel.news && intel.news.blackout);
  try{ if (!blackout && typeof win.hgFundamentalBlackout === 'function') blackout = win.hgFundamentalBlackout('XAUUSD') === true; }catch(eB){}
  var macroClear = !blackout && !sgFundBlocked(c) && (!smtRead.ok || smtRead.smtState !== 'DIVERGENT_CAUTION');
  gate('GS_G10_MACRO_NEWS_SMT_CLEAR', 'Blackout, Fund & Bullion SMT Clear', macroClear, blackout ? 'BLACKOUT' : (smtRead.smtState || 'CLEAR'), blackout || sgFundBlocked(c));
  var rawScore = Math.round((passedCnt / 10) * 82)
    + (sb.psychShielded ? 4 : 0)
    + (sb.t1FrontRun || sb.dolMagnetized ? 4 : 0)
    + (arch.isSilverBulletWindow ? 4 : 0)
    + (smtRead && smtRead.smtConfirmed ? 3 : 0)
    + (micro15.mssConfirmed ? 3 : 0);
  if (c.demoted) rawScore -= 8;
  if (vetoReasons.length) rawScore = Math.min(rawScore, 52);
  var scalpScore = Math.max(0, Math.min(99, rawScore));
  var exp = sgCalcSetupExpectancy(c, sb, intel);
  var riskProf = sgSetupRiskProfile(exp, sb);
  var radar = sgSetupExecutionRadar(c, sb, intel, advGuard, arch.benchmarks);
  var scalpTier = 'SCALP B WATCH';
  if (vetoReasons.length || scalpScore < 60) scalpTier = 'SCALP VETO';
  else if (scalpScore >= 88 && passedCnt >= 9) scalpTier = 'SCALP A+ SNIPER';
  else if (scalpScore >= 76 && passedCnt >= 8) scalpTier = 'SCALP A';
  var spreadDragR = (spreadUsd != null && sb.riskDist > 0) ? +(spreadUsd / sb.riskDist).toFixed(2) : null;
  var netExpectedValueR = (exp && isFinite(exp.expectedValueR) && spreadDragR != null) ? +(exp.expectedValueR - spreadDragR).toFixed(2) : null;
  return {
    ok: true, scalpScore: scalpScore, scalpTier: scalpTier, gatesPassed: passedCnt, gatesTotal: 10, vetoReasons: vetoReasons,
    spreadUsd: spreadUsd, spreadToRiskPct: spreadToRiskPct, spreadDragR: spreadDragR, netExpectedValueR: netExpectedValueR,
    timeStopMin: 45, timeStopRule: '45m time-stop: scratch if the trade never reaches +0.50R',
    expectancy: exp, riskProfile: riskProf, executionRadar: radar, adverseSelection: advGuard, timeDecay: decay, smtRead: smtRead, gates: gates
  };
}

function sgScalpSizing(c, sb, scoreCard, win){
  var risk = defaultRiskOpts(win);
  var entry = N(c && c.entry);
  var stop = N(c && c.stop);
  var dist = Math.abs(entry - stop);
  if (!(entry > 0 && dist > 0) || !(risk.balance > 0) || !(risk.riskPct > 0)) return null;
  var kelly = (scoreCard && scoreCard.expectancy && isFinite(+scoreCard.expectancy.halfKellyRiskPct) && +scoreCard.expectancy.halfKellyRiskPct > 0)
    ? +scoreCard.expectancy.halfKellyRiskPct : null;
  var usePct = kelly != null ? kelly : risk.riskPct;
  var riskDollars = risk.balance * (usePct / 100);
  var oz = riskDollars / dist;
  if (!(oz > 0)) return null;
  return {
    positionUnitsOz: +oz.toFixed(4),
    halfKellyRiskPct: kelly,
    halfKellyLots: +(oz / 100).toFixed(4),
    contractOzPerLot: 100,
    riskDollars: +riskDollars.toFixed(2),
    stopDist: +dist.toFixed(2)
  };
}

function sgEnhanceGoldScalpSetup(c, intel, win, opts){
  win = win || W;
  opts = opts || {};
  if (!c || !c.dir) return c;
  intel = intel || {};
  var sb = sgRefineGoldScalpBracket(c, intel, win);
  if (!sb || !sb.ok) return c;
  var scoreCard = sgScoreGoldScalpSetup(c, sb, intel, win);
  var arch = sb.archetypeInfo || {};
  if (scoreCard.scalpTier === 'SCALP A+ SNIPER' || scoreCard.scalpTier === 'SCALP A') c.grade = 'A';
  var mutateLevels = opts.mutateLevels === true;
  c.scalpPrecision = sb;
  if (mutateLevels && sb.unread !== true){
    c.entry = sb.entry;
    c.stop = sb.stop;
    c.t1 = sb.t1;
    c.t2 = sb.t2;
    c.t3 = sb.t3;
  }
  var tranchePlan = (sb.entryTranches && sb.entryTranches.length >= 2)
    ? (sb.entryTranches[0].weightPct + '% @ ' + fmt(sb.entryTranches[0].price, 2) + ' + ' + sb.entryTranches[1].weightPct + '% @ ' + fmt(sb.entryTranches[1].price, 2))
    : 'Desk prices kept. ATR was not measured.';
  var scalePlan = (sb.splits)
    ? (sb.splits.t1Pct + '% @ TP1 ' + fmt(sb.t1, 2) + ' · ' + sb.splits.t2Pct + '% @ TP2 ' + fmt(sb.t2, 2) + ' · ' + sb.splits.t3Pct + '% @ TP3 ' + fmt(sb.t3, 2))
    : 'Desk targets kept.';
  c.scalpSizing = sgScalpSizing(c, sb, scoreCard, win);
  c.scalpOrderFlow = sgGoldScalpOrderFlowEngine(c, intel);
  c.scalpPools = sgGoldScalpSessionPools(c, intel);
  c.scalpVelocity = sgGoldScalpVelocityProfile(c, sb, scoreCard, intel);
  c.scalpEnhancement = {
    ok: true, version: 'hg-v1373', scalpTier: scoreCard.scalpTier, scalpScore: scoreCard.scalpScore,
    archetype: arch.archetype, archetypeLabel: arch.archetypeLabel, edgeThesis: arch.edgeThesis,
    killzoneWindow: arch.killzoneWindow, spreadUsd: scoreCard.spreadUsd, spreadToRiskPct: scoreCard.spreadToRiskPct,
    spreadDragR: scoreCard.spreadDragR, netExpectedValueR: scoreCard.netExpectedValueR,
    timeStopMin: scoreCard.timeStopMin, timeStopRule: scoreCard.timeStopRule,
    tranchePlan: tranchePlan, scalePlan: scalePlan, ratchetLadder: sb.ratchetLadder || [],
    gatesPassed: scoreCard.gatesPassed, gatesTotal: scoreCard.gatesTotal, gates: scoreCard.gates,
    expectancy: scoreCard.expectancy, riskProfile: scoreCard.riskProfile, executionRadar: scoreCard.executionRadar,
    deskUntouched: !mutateLevels
  };
  return c;
}

function sgSynthesizeGoldScalpSetups(intel, riskOpts, win){
  win = win || W;
  intel = intel || {};
  var rows15 = Array.isArray(intel.rows15) ? intel.rows15 : [];
  if (rows15.length < 12) return [];
  var ft = intel.fiveTf || {};
  var side = ft.aligned === 'BEAR' ? 'short' : (ft.aligned === 'BULL' ? 'long' : null);
  if (!side) return [];
  var atr15 = (intel.volRegime && intel.volRegime.ok && isFinite(+intel.volRegime.atrNow) && +intel.volRegime.atrNow > 0)
    ? +intel.volRegime.atrNow : sgCalcBarsAtr(rows15, 14);
  if (!(atr15 > 0)) return [];
  var isLong = side === 'long';
  var rows5 = Array.isArray(intel.rows5) ? intel.rows5 : [];
  var micro15 = sgDetectMicrostructureZones(rows15, null, side);
  var micro5 = rows5.length >= 5 ? sgDetectMicrostructureZones(rows5, null, side) : null;
  var vol = sgIntradayVolumeProfile(rows15, side, null);
  var last = rows15[rows15.length - 1];
  var lastC = N(last && (last.c != null ? last.c : last.close));
  var barT = (last && (last.t || last.time)) || null;
  var built = [];
  function pushSetup(key, strategy, entryPx){
    var e1 = N(entryPx);
    if (!(e1 > 0)) return;
    var rawStop = isLong ? (e1 - atr15 * 0.95) : (e1 + atr15 * 0.95);
    var s1 = sgPsychShieldStop(rawStop, side).stop;
    if (isLong && !(s1 < e1)) s1 = rawStop;
    if (!isLong && !(s1 > e1)) s1 = rawStop;
    var r1 = Math.abs(e1 - s1);
    if (!(r1 > 0)) return;
    built.push({
      id: ['GS-SYNTH', key, side, e1.toFixed(2), barT || 'notime'].join('|'),
      sym: 'XAUUSD', dir: side, grade: 'B', entry: +e1.toFixed(2), stop: +(+s1).toFixed(2),
      t1: +(isLong ? (e1 + r1 * 1.70) : (e1 - r1 * 1.70)).toFixed(2),
      mark: isFinite(lastC) ? lastC : null, barT: barT, rows15m: rows15, rows5m: rows5,
      strategy: strategy, scanner: 'gold-scalp', synthesized: true
    });
  }
  var sweep = null;
  var sweepSrc = ((micro5 && micro5.sweeps) || []).concat(micro15.sweeps || []);
  for (var si = 0; si < sweepSrc.length; si++){
    if (sweepSrc[si] && sweepSrc[si].side === side){ sweep = sweepSrc[si]; break; }
  }
  var fvg = (micro5 && micro5.nearestFvg && micro5.nearestFvg.side === side) ? micro5.nearestFvg
    : ((micro15.nearestFvg && micro15.nearestFvg.side === side) ? micro15.nearestFvg : null);
  if (sweep && fvg && N(fvg.ce) > 0) pushSetup('judas-fvg', 'Judas Sweep + FVG', fvg.ce);
  if (vol && vol.ok && N(vol.poc) > 0 && ((isLong && vol.profileState === 'VAL_SPRING_RECLAIM') || (!isLong && vol.profileState === 'VAH_UPTHRUST_REJECT'))){
    pushSetup('va-poc', 'Value Area Spring to POC', vol.poc);
  }
  var ifvg = (micro5 && micro5.nearestIfvg && micro5.nearestIfvg.side === side) ? micro5.nearestIfvg
    : ((micro15.nearestIfvg && micro15.nearestIfvg.side === side) ? micro15.nearestIfvg : null);
  var brk = (micro5 && micro5.nearestBreaker && micro5.nearestBreaker.side === side) ? micro5.nearestBreaker
    : ((micro15.nearestBreaker && micro15.nearestBreaker.side === side) ? micro15.nearestBreaker : null);
  if (ifvg && brk && N(ifvg.ce) > 0) pushSetup('breaker-ifvg', 'Breaker + IFVG Flip', ifvg.ce);
  var pools = sgGoldScalpSessionPools({ dir: side, rows5m: rows5, entry: lastC }, intel);
  var flow = sgGoldScalpOrderFlowEngine({ dir: side, rows5m: rows5 }, intel);
  if (pools && pools.ok && flow && flow.cvdAligned){
    var reclaim = isLong ? pools.orbState === 'ORB_SWEEP_RECLAIM_LONG' : pools.orbState === 'ORB_SWEEP_RECLAIM_SHORT';
    var pullback = isLong ? pools.orbHigh : pools.orbLow;
    if (reclaim && pullback > 0 && ((isLong && lastC > pullback) || (!isLong && lastC < pullback))){
      pushSetup('orb-cvd', 'ORB + CVD Pullback', pullback);
    }
  }
  if (!built.length){
    var anchor = micro15.nearestFvg || micro15.nearestIfvg || micro15.nearestOb;
    if (!anchor && micro5) anchor = micro5.nearestFvg || micro5.nearestIfvg || micro5.nearestOb;
    if (anchor || micro15.sweepReclaimed || (micro5 && micro5.sweepReclaimed)){
      var legacy = anchor ? N(anchor.ce != null ? anchor.ce : anchor.mt) : lastC;
      pushSetup('legacy', micro15.sweepReclaimed ? 'Judas Sweep Scalp' : 'Silver Bullet FVG Scalp', legacy);
    }
  }
  var out = [];
  for (var bi = 0; bi < built.length; bi++){
    out.push(sgEnhanceGoldScalpSetup(built[bi], intel, win, { mutateLevels: false }));
  }
  return out;
}

function sgUpgradeGoldScalpTabInOneGo(snapOrWin, opts){
  opts = opts || {};
  var win = (snapOrWin && typeof snapOrWin.goldscalpScan === 'function' && !Array.isArray(snapOrWin.cands))
    ? snapOrWin : (opts.win || W);
  var rawSnap = (snapOrWin && typeof snapOrWin === 'object' && (Array.isArray(snapOrWin.cands) || snapOrWin.at))
    ? snapOrWin : null;
  if (!rawSnap) return { at: Date.now(), cands: [], armed: [], scalpSummary: { totalSetups: 0, headline: '0 Gold Scalp setups active' } };
  var intel = opts.intel || rawSnap.intel || null;
  if (!intel || (!intel.volRegime && !intel.rows15 && !intel.structure && !intel.fiveTf)){
    try{
      var sgNow = superGoldScan();
      if (sgNow && sgNow.intel) intel = sgNow.intel;
    }catch(eI){}
  }
  intel = intel || {};
  var mutateLevels = opts.mutateLevels === true;
  var cands = Array.isArray(rawSnap.cands) ? rawSnap.cands.map(function(c){ return Object.assign({}, c); }) : [];
  cands = cands.map(function(c){ return sgEnhanceGoldScalpSetup(c, intel, win, { mutateLevels: mutateLevels }); });
  if (opts.includeSynthesized === true && intel && Array.isArray(intel.rows15)){
    var synth = sgSynthesizeGoldScalpSetups(intel, opts.riskOpts, win);
    var seen = {};
    cands.forEach(function(c){ if (c && c.id) seen[c.id] = true; });
    synth.forEach(function(sc){ if (sc && sc.id && !seen[sc.id]) cands.push(sc); });
  }
  cands.sort(function(a, b){
    var as = N(a && a.scalpEnhancement && a.scalpEnhancement.scalpScore);
    var bs = N(b && b.scalpEnhancement && b.scalpEnhancement.scalpScore);
    if (!isFinite(as)) as = -1;
    if (!isFinite(bs)) bs = -1;
    return bs - as;
  });
  var armed = Array.isArray(rawSnap.armed) ? sgEnhanceArmedSetups(rawSnap.armed.slice(), intel) : rawSnap.armed;
  var sniperCnt = 0, gradeACnt = 0, topVel = 0;
  cands.forEach(function(c){
    var st = c && c.scalpEnhancement && c.scalpEnhancement.scalpTier;
    if (st === 'SCALP A+ SNIPER') sniperCnt++;
    else if (st === 'SCALP A') gradeACnt++;
    var rv = c && c.scalpVelocity && c.scalpVelocity.rPerHourVelocity;
    if (isFinite(+rv) && +rv > topVel) topVel = +rv;
  });
  rawSnap.cands = cands;
  if (armed) rawSnap.armed = armed;
  rawSnap.hgUpgradedVersion = 'hg-v1373';
  rawSnap.oneGoUpgraded = true;
  rawSnap.scalpSummary = {
    version: 'hg-v1373', totalSetups: cands.length, sniperAPlusCount: sniperCnt, gradeACount: gradeACnt,
    topVelocityRPerHour: +topVel.toFixed(2),
    headline: cands.length ? (cands.length + ' Gold Scalp setups (' + sniperCnt + ' SNIPER A+ · ' + gradeACnt + ' GRADE A)') : '0 Gold Scalp setups active'
  };
  try{ sgPaintGoldScalpTabHud(rawSnap, win); }catch(eHud){}
  return rawSnap;
}

function sgPaintGoldScalpTabHud(scalpSnap, win){
  win = win || W;
  if (typeof document === 'undefined' || !document.querySelector) return false;
  var host = document.querySelector('#goldscalp, [data-tab="goldscalp"], .hg-goldscalp');
  if (!host || !scalpSnap || !scalpSnap.scalpSummary) return false;
  var hud = host.querySelector('#hg-gs-v1381-hud');
  if (!hud){
    hud = document.createElement('div');
    hud.id = 'hg-gs-v1381-hud';
    hud.className = 'hg-note';
    if (host.firstChild) host.insertBefore(hud, host.firstChild);
    else host.appendChild(hud);
  }
  var sum = scalpSnap.scalpSummary;
  var top = Array.isArray(scalpSnap.cands) && scalpSnap.cands[0] ? scalpSnap.cands[0] : null;
  var se = top && top.scalpEnhancement;
  hud.innerHTML = '<b>GOLD SCALP</b> · ' + String(sum.headline)
    + (se ? (' · ' + String(se.scalpTier) + ' ' + se.scalpScore + '/100 · ' + String(se.archetypeLabel) + '. Desk prices were not replaced.') : '');
  return true;
}

function sgInstallGoldScalpTabEnhancer(win){
  win = win || W;
  if (!win || typeof win.goldscalpScan !== 'function' || win.goldscalpScan.__hgWrappedScalp) return false;
  var orig = win.goldscalpScan;
  var wrapped = function(){
    var raw = orig.apply(this, arguments);
    if (!raw) return raw;
    try{
      return sgUpgradeGoldScalpTabInOneGo(raw, {
        win: win,
        mutateLevels: win.__sgApplyScalpPrecisionInPlace === true,
        includeSynthesized: win.__sgSynthesizeGoldScalp === true
      });
    }catch(eUp){ return raw; }
  };
  wrapped.__hgWrappedScalp = true;
  wrapped.__orig = orig;
  win.goldscalpScan = wrapped;
  win.__sgGoldScalpEnhancerInstalled = true;
  return true;
}

W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'super-gold', label: 'SUPER GOLD', run: superGoldWarm });

W.sgWeekendVerdict = sgWeekendVerdict;
/* hg-v952: the audit and the instant reader, exported so the guard can drive
   the REAL veto rather than assert about its source text. */
W.__sgGoldDeskAudit = runGoldDeskAudit;
W.__sgCandSec = sgCandSec;
/* hg-v1005: the fundamental-block predicate the pick loops share, exported
   so the guard drives the REAL check rather than re-deriving it. */
W.sgFundBlocked = sgFundBlocked;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({
  id: TAB_ID,
  label: 'SUPER GOLD',
  title: 'Super Gold',
  mount: mount,
  refresh: superGoldRefresh
});

})();
