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
  scanPromise: null, lastScanMsg: '', selectedHit: null
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
    scanner: meta.scanner || meta.source
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

  return { ok: true, veto: false, hit: hit };
}

function superGoldSortCands(cands){
  if (!Array.isArray(cands)) return;
  cands.sort(function(a, b){
    var am = a.minimalLossPass ? 1 : 0, bm = b.minimalLossPass ? 1 : 0;
    if (bm !== am) return bm - am;
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
async function superGoldIntel(win){
  win = win || W;
  var out = { ok: false, at: Date.now(), fiveTf: null, candle: null, volRegime: null, session: null, news: null, feedQuality: null, structure: null, why: '' };
  var I = win.hgCfIntel;
  function pack(tf, n){
    if (typeof win.getGoldCandles !== 'function') return Promise.resolve(null);
    return Promise.race([
      win.getGoldCandles(tf, n).then(function(p){ return p && p.rows && p.rows.length ? p.rows : null; }).catch(function(){ return null; }),
      new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, 5000); })
    ]);
  }
  try{
    var got = await Promise.all([pack('5m', 80), pack('15m', 80), pack('1h', 80), pack('4h', 80), pack('1d', 120)]);
    var rows5 = got[0], rows15 = got[1], rows1h = got[2], rows4h = got[3], rows1d = got[4];
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

async function superGoldRunScanInner(opts){
  opts = opts || {};
  __sg.scanBusy = true;
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
    __sg.lastScanAt = snap.scanAt;
    superGoldAfterScan(snap);
    sgPublishAlert(superGoldScan());
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
      execHtml = '<div class="hg-note" data-sg-intel="exec" style="margin-bottom:6px"><b>CROWN EXECUTION</b> '
        + '<span style="color:' + exColor + ';font-weight:700">' + esc(ex.state) + '</span>'
        + (ex.side ? (' <span class="hg-note">' + esc(ex.side.toUpperCase()) + '</span>') : '')
        + '<div class="hg-note">' + esc(ex.why) + '</div>'
        + coneBits + fwdBits
        + ((ex.state === 'ARMED' || ex.state === 'TRIGGERED') ? '<div id="sg-crown-chart" style="margin-top:6px"></div>' : '')
        + '</div>';
    }catch(eEx){ execHtml = ''; }
    if (!bits.length && intel && intel.why) bits.push('<div class="hg-note">Desk intel unread: ' + esc(intel.why) + '</div>');
    host.innerHTML = (crownHtml || bits.length || execHtml)
      ? ('<div class="hg-note" data-sg-intel="1" style="margin:8px 0;padding:8px 10px;border:1px solid rgba(166,124,18,.25);border-radius:var(--radius-sm,6px);background:#fffbeb">'
        + '<b>DESK INTELLIGENCE</b> <span class="hg-note">— tape, clock and calendar beside the crown. They do not crown and they do not move a level.</span>'
        + '<div style="margin-top:6px">' + crownHtml + execHtml + bits.join('') + '</div></div>')
      : '';
    /* hg-v1363: the mini chart draws after the host exists; a missing 2d
       context leaves the wrap empty, never a thrown repaint. */
    try{
      var exNow = sgCrownExecution(snap);
      if ((exNow.state === 'ARMED' || exNow.state === 'TRIGGERED') && intel && Array.isArray(intel.rows15)){
        sgDrawChart(host, intel.rows15, exNow);
      }
    }catch(eCh){}
  }

  /* hg-v1363: the crowned bracket on the tape — last 60 closed 15m candles
     with entry / stop / T1 as level lines. Plain canvas, no dependency. */
  function sgDrawChart(host, rows, ex){
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
          return (a.strategy || a.stratKey || 'watch') + ' @ ' + fmt(a.level, 2);
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
        + '<div class="hg-desk-sym">' + String(r.sym || 'XAU') + ' · ' + String(r.dir || '').toUpperCase() + '</div>'
        + '<div class="hg-desk-pills">'
        + '<span class="hg-pill ' + tierPillCls + '">' + tierLbl + '</span>'
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
        + '<div class="hg-note" style="margin-top:8px">' + String(r.strategy || '') + '</div></div>';
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
