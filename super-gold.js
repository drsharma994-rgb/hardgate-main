/* =========================================================================
   HARDGATE — super-gold.js
   SUPER GOLD tab (id 'super-gold'): conviction desk merging GOLD SCALP + GOLD SWING.
   Grade-based tiers (A/B), goldAttachPositionSize, weekend/macro/spread audit.
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
  return (Number.isFinite(rr) && rr > 0) ? rr : 2;
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
  var rr = pickRR(hit);
  if (N(hit.t1) > 0 && N(hit.entry) > 0 && N(hit.stop) > 0){
    var riskDist = Math.abs(hit.entry - hit.stop);
    if (riskDist > 0) rr = Math.abs(hit.t1 - hit.entry) / riskDist;
  }
  return rr;
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
  return null;
}

/** Gold desk audit — weekend, macro tilt, stand-down. Fail-closed for GRADE A trade-ready. */
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

  if (typeof win.hgInGoldWeekend === 'function'){
    try{
      if (win.hgInGoldWeekend(Math.floor(Date.now() / 1000))){
        reasons.push('Gold weekend closure — spot liquidity thin');
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
        cashOpen: !(typeof win.hgInGoldWeekend === 'function'
          && win.hgInGoldWeekend(Math.floor(Date.now() / 1000)))
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
        nowMs: Date.now(),
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
  hit.rr = rrForCalc;
  var calc = goldCalcTrade(riskOpts, hit, rrForCalc);

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
      } else if (hit.positionSize && !hit.positionSize.error){
        hit.sizingPass = true;
      }
    }catch(eSz){}
  }

  hit.minimalLossPass = hit.tier === 'clean' && hit.sizingPass && hit.goldAudit.pass && !hit.demoted;
  hit.riskPass = hit.sizingPass && hit.goldAudit.pass;
  hit.nearWatch = hit.tier === 'near' && hit.sizingPass && N(hit.entry) > 0 && hit.entry !== hit.stop;
  hit.riskReason = hit.minimalLossPass ? 'PASS'
    : (hit.nearWatch ? 'WATCH — grade B or demoted'
      : ((hit.goldAudit.reasons && hit.goldAudit.reasons.length)
        ? hit.goldAudit.reasons[0] : (calc.reason || 'blocked')));
  hit.calc = calc;
  hit.tp = N(hit.t1) > 0 ? hit.t1 : calc.tp;
  hit.tp2 = N(hit.t2);
  hit.qty = hit.positionSize && hit.positionSize.positionSizeUnits != null
    ? hit.positionSize.positionSizeUnits : calc.qty;
  hit.notional = hit.positionSize && hit.positionSize.notionalValueUSD != null
    ? hit.positionSize.notionalValueUSD : calc.notional;
  return hit;
}

/** Ranking context — mirrors gold scalp/swing scan legs (all optional). */
function buildGoldRankCtx(win){
  win = win || W;
  var ctx = { now: Date.now(), style: 'super-gold' };
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
    var ranked = win.goldRankSetups(rawCands, ctx || buildGoldRankCtx(win));
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

function collectSuperGoldScanHits(win){
  win = win || W;
  var hits = [];
  var sgFn = win.superGoldScan;
  if (typeof sgFn === 'function'){
    try{
      var sg = sgFn();
      if (sg && Array.isArray(sg.cands) && sg.cands.length
          && (sg.hydrated || isFreshAt(sg.at || sg.scanAt, SNAP_MAX_MS))){
        sg.cands.forEach(function(c){ if (c) hits.push(c); });
      }
    }catch(e0){}
  }
  if (!hits.length){
    var snap = buildSnapFromGoldScans(win, defaultRiskOpts(win), { allowStale: true });
    if (snap && Array.isArray(snap.cands)) hits = snap.cands.slice();
  }
  return hits;
}

function superGoldEvaluate(win, opts){
  win = win || W;
  opts = opts || {};
  var hits = collectSuperGoldScanHits(win);
  var hit = null, i;
  if (opts.selectedId){
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].id === opts.selectedId){ hit = hits[i]; break; }
    }
  }
  if (!hit){
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].minimalLossPass){ hit = hits[i]; break; }
    }
  }
  if (!hit){
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].tier === 'clean'){ hit = hits[i]; break; }
    }
  }
  if (!hit && hits.length) hit = hits[0];
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
  var rankCtx = (opts && opts.rankCtx) ? opts.rankCtx : buildGoldRankCtx(win);
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

  var gsFn = win.goldscalpScan;
  if (typeof gsFn === 'function' && audit.venues.indexOf('gold-scalp') < 0){
    try{ audit.venues.push('gold-scalp'); }catch(e0){}
  }
  var gwFn = win.goldswingScan;
  if (typeof gwFn === 'function' && audit.venues.indexOf('gold-swing') < 0){
    try{ audit.venues.push('gold-swing'); }catch(e1){}
  }

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
        return { sym: c.sym, dir: c.dir, entry: +c.entry, stop: +c.stop, t1: +c.t1,
                 mechanic: 'CONVICTION-PICK', ticket: true };
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
  var hit = null, i;
  if (__sg.selectedId){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && snap.cands[i].id === __sg.selectedId){ hit = snap.cands[i]; break; }
    }
  }
  if (!hit){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && snap.cands[i].minimalLossPass){ hit = snap.cands[i]; break; }
    }
  }
  if (!hit){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && snap.cands[i].tier === 'clean'){ hit = snap.cands[i]; break; }
    }
  }
  if (!hit) hit = snap.cands[0];
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
    __sg.lastScanAt = snap.scanAt;
    superGoldAfterScan(snap);
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
  var rr = pickRR(hit);
  if (N(hit.t1) > 0 && N(hit.entry) > 0 && N(hit.stop) > 0){
    var rd = Math.abs(hit.entry - hit.stop);
    if (rd > 0) rr = Math.abs(hit.t1 - hit.entry) / rd;
  }
  return {
    ready: true, idle: false, mode: 'scanner',
    trigger: hit.trigger || hit.tier,
    source: hit.source || hit.scanner,
    side: normalizeSide(hit.dir),
    sym: hit.sym,
    tf: hit.scanner || 'gold',
    entry: hit.entry, stop: hit.stop, t1: hit.t1, t2: hit.t2, rr: rr,
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
    if ($('#sg-guidance')){
      var g = ev.note || '';
      if (hit && hit.goldAudit && hit.goldAudit.layerSummary){
        g += (g ? ' · ' : '') + hit.goldAudit.layerSummary;
      }
      $('#sg-guidance').textContent = g;
    }
    var btn = $('#sg-send-trade');
    if (btn){
      var canSend = !!(hit && hit.minimalLossPass && N(hit.entry) > 0 && N(hit.stop) > 0);
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
    var txt = '';
    if (typeof W.hgGoldWeekendReadout === 'function'){
      try{
        var rd = W.hgGoldWeekendReadout(Math.floor(Date.now() / 1000));
        if (rd && rd.line) txt = rd.line;
      }catch(e0){}
    } else if (typeof W.hgInGoldWeekend === 'function' && W.hgInGoldWeekend(Math.floor(Date.now() / 1000))){
      txt = 'Gold weekend closure — WATCH rows only; GRADE A needs session open + audit pass';
    }
    el.textContent = txt || '';
    el.style.display = txt ? 'block' : 'none';
  }

  function paintDesk(snap){
    paintValidation();
    paintWeekendBanner();
    snap = snap || superGoldScan();
    var desk = $('#sg-desk');
    var statEl = $('#sg-scan-stat');
    if (statEl){
      var when = snap && snap.scanAt ? new Date(snap.scanAt).toLocaleTimeString() : '—';
      statEl.textContent = (snap && snap.stat ? snap.stat : 'No scan yet') + ' · last ' + when;
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
    if (!rows.length){
      desk.innerHTML = '<div class="hg-note">No GRADE A/B gold setups on last scan. Weekend / macro / tally filters may be standing aside.</div>';
      return;
    }
    var minPass = rows.filter(function(r){ return r.minimalLossPass; }).length;
    var hint = minPass
      ? ('<div class="hg-note" style="margin-bottom:10px">' + minPass + ' GRADE A PASS · trade-ready</div>')
      : ('<div class="hg-note" style="margin-bottom:10px">No GRADE A PASS yet — WATCH rows show levels only</div>');
    desk.innerHTML = hint + rows.map(function(r){
      var tierLbl = r.tier === 'clean' ? ('GRADE ' + String(r.grade || 'A').toUpperCase()) : 'WATCH';
      var pill = superGoldDeskPill(r);
      var sel = (__sg.selectedId === r.id) ? ' sel' : '';
      var tierPillCls = r.tier === 'clean' ? 'clean' : 'watch';
      return '<div class="hg-desk-card' + sel + '" data-id="' + String(r.id).replace(/"/g, '') + '">'
        + '<div class="hg-desk-top">'
        + '<div class="hg-desk-sym">' + String(r.sym || 'XAU') + ' · ' + String(r.dir || '').toUpperCase() + '</div>'
        + '<div class="hg-desk-pills">'
        + '<span class="hg-pill ' + tierPillCls + '">' + tierLbl + '</span>'
        + '<span class="hg-pill">' + String(r.scanner || '') + '</span>'
        + '<span class="hg-pill ' + pill.cls + '">' + pill.label + '</span>'
        + '</div></div>'
        + '<div class="hg-desk-levels">'
        + '<div><div class="k">ENTRY</div><div class="v">' + fmt(r.entry, 2) + '</div></div>'
        + '<div><div class="k">STOP</div><div class="v">' + fmt(r.stop, 2) + '</div></div>'
        + '<div><div class="k">T1</div><div class="v">' + fmt(r.tp, 2) + '</div></div>'
        + '<div><div class="k">RR</div><div class="v">' + fmt(r.rr, 2) + '</div></div>'
        + '<div><div class="k">SIZE</div><div class="v">'
        + (r.positionSize ? fmt(r.positionSize.positionSizeUnits, 3) + ' oz' : '—') + '</div></div>'
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
W.rankRawGoldCands = rankRawGoldCands;
W.collectRawGoldDeskCands = collectRawGoldDeskCands;
W.collectSuperGoldScanHits = collectSuperGoldScanHits;
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

W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'super-gold', label: 'SUPER GOLD', run: superGoldWarm });

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({
  id: TAB_ID,
  label: 'SUPER GOLD',
  title: 'Super Gold',
  mount: mount,
  refresh: superGoldRefresh
});

})();
