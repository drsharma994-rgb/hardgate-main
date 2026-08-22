/* =========================================================================
   HARDGATE — supersetup.js
   SUPER SETUP tab (id 'super-setup'): structure/scanner-gated trade builder.
   Idle until BOS/CHoCH/zone reaction or CLEAN scanner ticket exists.
   Reads swingScan/bestScan/edgeScan/gold scans + HG_chart + legacy globals.
   Pure helpers exported for tests. refresh() re-evaluates gates + recalc.
   Never throws at load time.
   ========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var TAB_ID = 'super-setup';
var SYNC_MS = 2500;
var SCAN_INTERVAL_MS = 10 * 60 * 1000;
var SNAP_MAX_MS = SCAN_INTERVAL_MS + 10 * 60 * 1000;
var STRUCT_MAX_BARS = 20;
var __hgSuperSetupSnap = null;
var __ss = {
  mounted: false, update: null, syncTimer: null, scanTimer: null,
  root: null, lastKey: '', selectedId: null, scanBusy: false, lastScanAt: 0,
  scanPromise: null, lastScanMsg: ''
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

function safeJson(x){
  try{ return (typeof x === 'string') ? JSON.parse(x) : x; }catch(e){ return null; }
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

function dirToTrend(dir){
  return dir === 'long' ? 'up' : (dir === 'short' ? 'down' : null);
}

var SCANNER_KEYS = ['HG_scannerOutput', 'HG_lastScan', 'HG_bestSetup', 'HG_selectedSetup',
  'HG_currentSetup', 'HG_chartSetup', 'HG_signal'];

function pickBestCand(snap){
  if (!snap || !Array.isArray(snap.cands) || !snap.cands.length) return null;
  var bestId = snap.bestId;
  var i;
  if (bestId){
    for (i = 0; i < snap.cands.length; i++){
      var c = snap.cands[i];
      if (c && (c.id === bestId)) return c;
    }
  }
  return snap.cands[0];
}

function hitFromCand(c, meta){
  if (!c || !c.dir) return null;
  var entry = N(c.entry);
  var stop = N(c.stop);
  if (!(entry > 0 && stop > 0)) return null;
  var tier = meta.tier || (c.nearClean ? 'near' : 'clean');
  var gatesPassed = N(c.gatesPassed != null ? c.gatesPassed : c.passed);
  return {
    sym: c.sym || c.symbol || c.coin || c.ticker || null,
    dir: c.dir,
    entry: entry,
    stop: stop,
    t1: N(c.t1),
    t2: N(c.t2),
    rr: N(c.rr),
    rows: c.rows || c.rows4h || null,
    source: meta.source,
    tier: tier,
    trigger: meta.trigger || tier,
    clean: tier === 'clean',
    nearClean: tier === 'near' || c.nearClean === true,
    gatesPassed: gatesPassed,
    tightCount: N(c.tightCount),
    tightGates: c.tightGates || null,
    margins: c.margins || null,
    formationScore: N(c.formationScore),
    venueTag: c.venueTag || meta.venueTag || null,
    id: c.id || null,
    at: meta.at || null
  };
}

function defaultRiskOpts(win){
  win = win || W;
  return {
    balance: N(win.__ssDefaultBalance != null ? win.__ssDefaultBalance : 1000),
    riskPct: N(win.__ssDefaultRiskPct != null ? win.__ssDefaultRiskPct : 1),
    maxLeverage: N(win.__ssDefaultMaxLev != null ? win.__ssDefaultMaxLev : 5),
    feePct: 0.06,
    slipPct: 0.05
  };
}

/** Max safe leverage — same formula as hgSafeLevChip / TRADE PLAN (liquidation ≥1.5× stop). */
function calcSafeMaxLeverage(entry, stop){
  entry = N(entry);
  stop = N(stop);
  if (!(entry > 0 && stop > 0) || entry === stop) return NaN;
  var sd = Math.abs(entry - stop) / entry;
  return Math.max(1, Math.min(100, Math.floor(1 / (sd * 1.5 + 0.005))));
}

/**
 * Sync minimal-loss audit — stand-down, regime, structure, macro, stale momentum,
 * post-enrich geometry, gate clearance, FTS stack, cost. Fail-closed for CLEAN trade-ready.
 */
function runMinimalLossAudit(win, c, hit, opts){
  win = win || W;
  opts = opts || {};
  c = c || {};
  hit = hit || {};
  var reasons = [];
  var passed = [];
  var style = opts.style || (String(hit.scanner || 'swing').indexOf('scalp') >= 0 ? 'scalp' : 'swing');
  var rows = c.rows || c.rows4h || hit.rows || [];
  var dir = hit.dir;
  var calc = opts.calc || null;

  if (typeof win.hgStandDownState === 'function'){
    try{
      var recs = typeof win.hgScoreRecords === 'function' ? win.hgScoreRecords() : [];
      var sd = win.hgStandDownState(recs);
      if (sd && sd.tripped){
        reasons.push('STAND DOWN: ' + ((sd.reasons || []).join(' · ') || 'drawdown limit'));
      } else passed.push('stand-down');
    }catch(e0){}
  }

  if (rows.length && typeof win.hgRegimeAllowsSetup === 'function'){
    try{
      var reg = win.hgRegimeAllowsSetup(rows, style);
      if (reg && reg.allow === false) reasons.push(reg.reason || 'regime block');
      else passed.push('regime');
    }catch(e1){}
  }

  if (rows.length && typeof win.hgStructureGate === 'function' && dir){
    try{
      var sg = win.hgStructureGate(rows, dir, { maxBars: STRUCT_MAX_BARS });
      if (sg && sg.veto) reasons.push(sg.note || 'structure veto');
      else passed.push('structure');
    }catch(e2){}
  }

  if (typeof win.hgMacroAllowsCrypto === 'function' && hit.sym && dir){
    try{
      var mac = win.hgMacroAllowsCrypto(hit.sym, dir);
      if (mac && mac.allow === false) reasons.push(mac.reason || 'macro block');
      else passed.push('macro');
    }catch(e3){}
  }

  if (rows.length && typeof win.hgStaleMomentumVeto === 'function' && dir){
    try{
      var stale = win.hgStaleMomentumVeto(rows, dir, hit.entry);
      if (stale && stale.veto) reasons.push(stale.reason || 'stale momentum');
      else passed.push('momentum');
    }catch(e4){}
  }

  if (rows.length && dir){
    try{
      var validFn = style === 'scalp' ? win.hgScalpPostEnrichValid : win.hgSwingPostEnrichValid;
      if (typeof validFn === 'function'){
        var vopts = style === 'scalp'
          ? { rows: c.rows15m || c.m15, m15: c.rows15m || c.m15 }
          : { rows: rows };
        if (!validFn(hit, vopts)) reasons.push('RR/geometry below house minimum');
        else passed.push('geometry');
      }
    }catch(e5){}
  }

  var tightN = N(c.tightCount != null ? c.tightCount : hit.tightCount);
  if (Number.isFinite(tightN) && tightN >= 2){
    reasons.push('tight gate margins (' + tightN + ' binding)');
  } else if (Number.isFinite(tightN)) passed.push('clearance');

  if (hit.stack){
    if (hit.stack.tierHint === 'aside'){
      var v0 = (hit.stack.vetoes && hit.stack.vetoes.length) ? hit.stack.vetoes[0] : 'pillar veto';
      reasons.push('FTS aside: ' + v0);
    } else if (hit.tier === 'clean' && hit.stack.tierHint !== 'clean'){
      reasons.push('FTS tier ' + hit.stack.tierHint);
    } else passed.push('FTS');
  }

  if (typeof win.hgPlanCostCheck === 'function' && N(hit.entry) > 0 && N(hit.stop) > 0){
    try{
      var costCtx = { sym: hit.sym, venue: hit.venueTag };
      if (calc && Number.isFinite(calc.notional)) costCtx.notionalUsd = calc.notional;
      var cc = win.hgPlanCostCheck({ entry: hit.entry, stop: hit.stop }, costCtx);
      if (cc && cc.veto) reasons.push(cc.reason || 'fees too high vs risk');
      else if (cc && cc.ok) passed.push('cost');
    }catch(e6){}
  }

  return {
    pass: reasons.length === 0,
    reasons: reasons,
    passed: passed,
    layerSummary: passed.length + ' ok' + (reasons.length ? (' · ' + reasons.length + ' block') : '')
  };
}

/** Normalize symbol for cross-desk matching (Delta / CoinDCX / Binance twin). */
function superSetupSymBase(sym){
  sym = String(sym || '').toUpperCase();
  return sym.replace(/^B-/, '').replace(/_USDT$/, '').replace(/USDT$/, '').replace(/USD$/, '');
}

function superSetupIsBtcProxy(sym){
  var b = superSetupSymBase(sym);
  return b === 'BTC' || /^BTC/.test(String(sym || '').toUpperCase());
}

/**
 * External-source audit — public feeds already integrated in HARDGATE:
 * Binance (OI/liqs/CCXT), mempool.space (on-chain), ForexFactory/news RSS,
 * World Monitor (macro/VIX/stress). Fail-closed when data opposes direction.
 */
function runExternalSourceAudit(win, c, hit){
  win = win || W;
  hit = hit || {};
  var reasons = [];
  var passed = [];
  var sources = [];
  var dir = String(hit.dir || '').toLowerCase();

  if (typeof win.hgNewsRisk === 'function' && hit.sym){
    try{
      sources.push('news/calendar');
      var nr = win.hgNewsRisk(hit.sym);
      if (nr && nr.blackout){
        reasons.push('News blackout: ' + (nr.note || 'high-impact window'));
      } else if (nr && nr.risk === 'high'){
        reasons.push('News risk high — stand aside');
      } else passed.push('news');
    }catch(e0){}
  }

  if (superSetupIsBtcProxy(hit.sym) && typeof win.onchainSignal === 'function'){
    try{
      sources.push('mempool.space');
      var ocState = typeof win.onchainState === 'function' ? win.onchainState() : null;
      var ocSnap = ocState && ocState.snap ? ocState.snap : (ocState || {});
      var oc = win.onchainSignal(ocSnap);
      if (oc){
        if (dir === 'long' && oc.bias === 'bearish'){
          reasons.push('On-chain bearish — ' + (oc.setupColor || 'headwind'));
        } else if (dir === 'short' && oc.bias === 'bullish'){
          reasons.push('On-chain bullish — contrarian short risk');
        } else if (dir === 'long' && oc.flags && oc.flags.feeSpike){
          reasons.push('BTC fee spike — frothy demand (mempool.space)');
        } else passed.push('on-chain');
      }
    }catch(e1){}
  }

  if (typeof win.oiflowState === 'function' && hit.sym){
    try{
      sources.push('Binance OI/funding/taker');
      var oi = win.oiflowState();
      var oiRows = (oi && oi.results) ? oi.results : (Array.isArray(oi) ? oi : []);
      var base = superSetupSymBase(hit.sym);
      var match = null;
      for (var oi_i = 0; oi_i < oiRows.length; oi_i++){
        var or = oiRows[oi_i];
        if (or && superSetupSymBase(or.sym) === base){ match = or; break; }
      }
      if (match && match.dir){
        var oiDir = String(match.dir).toLowerCase();
        if ((oiDir === 'long' || oiDir === 'short') && oiDir !== dir && N(match.evidence) >= 2){
          reasons.push('OI flow opposes — ' + match.dir + ' positioning (' + (match.cls || 'evidence') + ')');
        } else passed.push('oi-flow');
      }
    }catch(e2){}
  }

  if (typeof win.liqsState === 'function'){
    try{
      sources.push('Binance liquidations WS');
      var lq = win.liqsState();
      var cls = lq && lq.snap && lq.snap.imbalance && lq.snap.imbalance.cls;
      if (cls === 'long-flush' && dir === 'long'){
        reasons.push('Liq cascade against longs — wait for flush to settle');
      } else if (cls === 'short-flush' && dir === 'short'){
        reasons.push('Liq cascade against shorts — wait for flush to settle');
      } else if (cls) passed.push('liqs');
    }catch(e3){}
  }

  if (typeof win.wmDeskFormationBoost === 'function'){
    try{
      sources.push('World Monitor');
      var wm = typeof win.getWorldMonitorDeskCached === 'function' ? win.getWorldMonitorDeskCached() : null;
      if (wm){
        var wmBoost = win.wmDeskFormationBoost(dir, hit.sym, wm);
        var stressLbl = wm.stress && wm.stress.label;
        if (wmBoost <= -7){
          reasons.push('Macro stress opposes trade' + (stressLbl ? (' (' + stressLbl + ')') : ''));
        } else passed.push('world-monitor');
      }
    }catch(e4){}
  }

  if (typeof win.ccxtDeskFormationBoost === 'function'){
    try{
      sources.push('CCXT/Binance funding desk');
      var ccxtDesk = typeof win.getCcxtDeskCached === 'function' ? win.getCcxtDeskCached() : null;
      if (ccxtDesk){
        var fundBoost = win.ccxtDeskFormationBoost(dir, hit.sym, ccxtDesk);
        if (fundBoost <= -7){
          reasons.push('Funding crowded against direction (CCXT ann %)');
        } else passed.push('ccxt-funding');
      }
    }catch(e5){}
  }

  if (hit.stack && Array.isArray(hit.stack.vetoes) && hit.stack.vetoes.length){
    sources.push('FTS pillars');
    reasons.push('FTS veto: ' + hit.stack.vetoes[0]);
  }

  return {
    pass: reasons.length === 0,
    reasons: reasons,
    passed: passed,
    sources: sources,
    layerSummary: passed.length + ' ext ok' + (reasons.length ? (' · ' + reasons.length + ' ext block') : '')
  };
}

/** House + external minimal-loss audit merged. */
function runFullMinimalLossAudit(win, c, hit, opts){
  var house = runMinimalLossAudit(win, c, hit, opts);
  var ext = runExternalSourceAudit(win, c, hit);
  var prec = runPrecisionSourceAudit(win, c, hit, opts);
  var reasons = (house.reasons || []).concat(ext.reasons || []).concat(prec.reasons || []);
  var passed = (house.passed || []).concat(ext.passed || []).concat(prec.passed || []);
  var unchecked = (house.unchecked || []).concat(ext.unchecked || []).concat(prec.unchecked || []);
  return {
    pass: house.pass && ext.pass && prec.pass,
    reasons: reasons,
    passed: passed,
    unchecked: unchecked,
    externalSources: (ext.sources || []).concat(prec.sources || []),
    precision: prec,
    layerSummary: passed.length + ' ok'
      + (reasons.length ? (' · ' + reasons.length + ' block') : '')
      + (unchecked.length ? (' · ' + unchecked.length + ' unchecked') : '')
  };
}

/** Browser FQS gate — mirrors formation-quality.mjs floors (btc 62, eth 64, alt 70). */
function superSetupFqsGate(hit, c){
  hit = hit || {};
  c = c || {};
  var base = superSetupSymBase(hit.sym);
  var cls = base === 'BTC' ? 'btc' : (base === 'ETH' ? 'eth' : 'alt');
  var floor = cls === 'btc' ? 62 : (cls === 'eth' ? 64 : 70);
  var rr = pickRR(hit);
  if (N(hit.t1) > 0 && N(hit.entry) > 0 && N(hit.stop) > 0){
    var rd = Math.abs(hit.entry - hit.stop);
    if (rd > 0) rr = Math.abs(hit.t1 - hit.entry) / rd;
  }
  var score = 48;
  var gates = N(hit.gatesPassed);
  if (gates >= 7) score += 18;
  else if (gates >= 6) score += 8;
  if (hit.refined) score += 10;
  if (N(hit.formationScore) > 0) score += Math.min(12, N(hit.formationScore) / 4);
  if (hit.stack && N(hit.stack.alignScore) > 1) score += Math.min(10, N(hit.stack.alignScore) * 2);
  if (rr >= 3) score += 12;
  else if (rr >= 2) score += 8;
  else if (rr < 1.5) score -= 18;
  if (N(hit.tightCount) >= 2) score -= 12;
  if (c.nearClean || hit.nearClean) score -= 8;
  score = Math.max(0, Math.min(100, Math.round(score)));
  var grade = score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F';
  return {
    ok: score >= floor,
    fqs: score,
    grade: grade,
    floor: floor,
    reason: score >= floor ? ('FQS ok ' + score + '/' + floor + ' ' + grade) : ('FQS low ' + score + '<' + floor + ' (' + grade + ')')
  };
}

/**
 * Precision audit — meta-label ledger, FQS, Deribit DVOL (v2.3).
 * Post-gate flow/BTC RS applied async via applySuperSetupPostGate.
 */
function runPrecisionSourceAudit(win, c, hit, opts){
  win = win || W;
  c = c || {};
  hit = hit || {};
  opts = opts || {};
  var reasons = [];
  var passed = [];
  var sources = [];
  /* Layers that could not be evaluated. Kept apart from `passed` and from
     `reasons`: an unrunnable check neither clears a setup nor blocks it. */
  var unchecked = [];
  var style = opts.style || (String(hit.scanner || 'swing').indexOf('scalp') >= 0 ? 'scalp' : 'swing');

  if (typeof win.deribitVolState === 'function'){
    try{
      sources.push('Deribit DVOL');
      var dv = win.deribitVolState();
      if (dv && dv.regime === 'extreme'){
        reasons.push('DVOL extreme (' + fmt(dv.dvol, 1) + ') — skip trend trades');
      } else if (dv && dv.regime === 'high' && style !== 'scalp' && hit.tier === 'clean'){
        reasons.push('DVOL high (' + fmt(dv.dvol, 1) + ') — elevated implied vol');
      } else if (dv && dv.regime){
        passed.push('dvol');
        hit.dvolRegime = dv.regime;
      }
    }catch(e0){}
  }

  if (hit.tier === 'clean'){
    try{
      sources.push('FQS');
      var fqs = superSetupFqsGate(hit, c);
      hit.fqs = fqs.fqs;
      hit.fqsGrade = fqs.grade;
      if (!fqs.ok) reasons.push(fqs.reason);
      else passed.push('fqs');
    }catch(e1){}
  }

  if (typeof win.hgMetaLabel === 'function' && hit.tier === 'clean'){
    try{
      sources.push('meta-label');
      var recs = typeof win.hgScoreRecords === 'function' ? win.hgScoreRecords() : [];
      var nr = typeof win.hgNewsRisk === 'function' ? win.hgNewsRisk(hit.sym) : null;
      var plan = {
        dir: hit.dir, entry: hit.entry, stop: hit.stop, t1: hit.t1, t2: hit.t2,
        rr: hit.rr, rr1: hit.rr, poiKind: hit.entryType, formationScore: hit.formationScore,
        fqs: hit.fqs, fillProb: hit.fillProb
      };
      var ml = win.hgMetaLabel(plan, {
        newsRisk: nr && nr.risk,
        metaFloor: N(win.HG_META_FLOOR) > 0 ? N(win.HG_META_FLOOR) : 0.52
      }, recs);
      hit.metaLabel = ml;
      if (ml && !ml.take){
        reasons.push('Meta-label SKIP (' + Math.round((ml.prob || 0) * 100) + '% · ' + (ml.verdict || 'skip') + ')');
      } else if (ml && ml.take) passed.push('meta-label');
    }catch(e2){}
  }

  var rows = hit.rows || null;
  if (hit.tier === 'clean' && rows && rows.length && typeof win.hgPostGateSetupVeto === 'function' && !hit.postGate){
    sources.push('post-gate');
    reasons.push('Post-gate pending (flow trap · BTC RS)');
  } else if (hit.postGate && hit.postGate.ok === false){
    sources.push('post-gate');
    reasons.push(hit.postGate.reason || 'post-gate veto');
  } else if (hit.postGate && hit.postGate.ok && hit.postGate.unchecked){
    /* ok:true from a gate that could not run is not a pass. It does not block
       the setup, but it must not be counted as a precision layer cleared. */
    sources.push('post-gate');
    unchecked.push('Post-gate UNCHECKED — '
      + ((hit.postGate.uncheckedReasons || ['reason not recorded']).join(' · ')));
  } else if (hit.postGate && hit.postGate.ok){
    passed.push('post-gate');
  }

  return {
    pass: reasons.length === 0,
    reasons: reasons,
    passed: passed,
    sources: sources,
    unchecked: unchecked,
    layerSummary: passed.length + ' precision ok'
      + (reasons.length ? (' · ' + reasons.length + ' block') : '')
      + (unchecked.length ? (' · ' + unchecked.length + ' unchecked') : '')
  };
}

function superSetupApplyVetoReason(hit, reason){
  if (!hit) return;
  if (!hit.minLossAudit) hit.minLossAudit = { pass: true, reasons: [], passed: [] };
  hit.minLossAudit.pass = false;
  hit.minLossAudit.reasons = (hit.minLossAudit.reasons || []).concat([reason]);
  hit.minimalLossPass = false;
  hit.riskReason = reason;
}

function superSetupSortCands(cands){
  if (!Array.isArray(cands)) return;
  cands.sort(function(a, b){
    var am = a.minimalLossPass ? 1 : 0, bm = b.minimalLossPass ? 1 : 0;
    if (bm !== am) return bm - am;
    var ar = a.riskPass ? 1 : 0, br = b.riskPass ? 1 : 0;
    if (br !== ar) return br - ar;
    var ac = a.tier === 'clean' ? 1 : 0, bc = b.tier === 'clean' ? 1 : 0;
    if (bc !== ac) return bc - ac;
    var ae = a.refined ? 1 : 0, be = b.refined ? 1 : 0;
    if (be !== ae) return be - ae;
    var as = N(a.stack && a.stack.alignScore) || N(a.formationScore) || N(a.fqs) || 0;
    var bs = N(b.stack && b.stack.alignScore) || N(b.formationScore) || N(b.fqs) || 0;
    if (bs !== as) return bs - as;
    return (N(b.rr) || 0) - (N(a.rr) || 0);
  });
}

/** Async post-gate — flow trap + BTC relative strength (same as SWING/BEST CLEAN path). */
async function applySuperSetupPostGate(snap, win){
  win = win || W;
  if (!snap || !Array.isArray(snap.cands)) return snap;
  var vetoFn = win.hgPostGateSetupVeto;
  if (typeof vetoFn !== 'function') return snap;
  var getCandles = win.getCandles || win.xuCandles;
  var i, hit, style, rows, pg;
  for (i = 0; i < snap.cands.length; i++){
    hit = snap.cands[i];
    if (!hit || hit.tier !== 'clean') continue;
    rows = hit.rows || null;
    if (!rows || !rows.length) continue;
    style = String(hit.scanner || 'swing').indexOf('scalp') >= 0 ? 'scalp' : 'swing';
    try{
      pg = await vetoFn(
        { symbol: hit.sym, fundingPct: hit.fundingPct },
        hit, rows, style,
        typeof getCandles === 'function' ? getCandles : null
      );
      hit.postGate = pg;
      if (pg && !pg.ok){
        superSetupApplyVetoReason(hit, pg.reason || 'Flow/RS post-gate veto');
      } else if (hit.minLossAudit){
        var prec = runPrecisionSourceAudit(win, {}, hit, { style: style });
        hit.minLossAudit.pass = hit.minLossAudit.pass && prec.pass;
        if (!prec.pass) hit.minLossAudit.reasons = (hit.minLossAudit.reasons || []).concat(prec.reasons || []);
        hit.minimalLossPass = hit.tier === 'clean' && hit.sizingPass && hit.minLossAudit.pass
          && (!hit.stack || hit.stack.tierHint === 'clean');
      }
    }catch(e){}
  }
  superSetupSortCands(snap.cands);
  if (snap.audit){
    snap.audit.minLoss = snap.cands.filter(function(r){ return r.minimalLossPass; }).length;
  }
  return snap;
}

/** Refine scan row through house formation: exact entry, structure SL, T1/T2, shield veto. */
function refineSuperSetupLevels(win, c, hit, refineOpts){
  win = win || W;
  c = c || {};
  refineOpts = refineOpts || {};
  if (!hit || !hit.dir) return { ok: false, veto: true, reason: 'no setup' };
  var rows = c.rows || c.rows4h || hit.rows || null;
  var rows1h = c.rows1h || null;
  var rows15m = c.rows15m || c.m15 || null;
  var scanner = String(hit.scanner || 'swing').toLowerCase();
  var style = scanner.indexOf('scalp') >= 0 ? 'scalp' : 'swing';
  var dir = hit.dir;
  var isClean = hit.tier === 'clean' && !c.nearClean;

  if (N(c.tightCount) >= 0) hit.tightCount = N(c.tightCount);
  if (c.margins) hit.margins = c.margins;
  if (c.tightGates) hit.tightGates = c.tightGates;
  if (N(c.formationScore) > 0) hit.formationScore = N(c.formationScore);

  var plan = null;
  if (typeof win.hgBestLevels === 'function' && rows && rows.length){
    try{
      var gateHit = c.nearClean ? c : (c.entry != null ? c : null);
      var bl = win.hgBestLevels({
        dir: dir,
        rows4h: rows,
        rows1h: rows1h,
        rows15m: rows15m,
        style: style,
        sym: hit.sym,
        ticker: c.ticker || { symbol: hit.sym },
        gate: gateHit ? { hit: gateHit, clean7: isClean, gatesPassed: hit.gatesPassed || 7 } : null,
        tab: 'super-setup',
        preferEdge: true,
        ftEdgeGate: isClean,
        rejectVisionVeto: refineOpts.rejectVisionVeto != null ? refineOpts.rejectVisionVeto : isClean
      });
      if (bl && bl.veto) return { ok: false, veto: true, reason: bl.reason || 'levels veto' };
      if (bl && bl.ok && bl.plan) plan = bl.plan;
    }catch(e1){}
  }

  if (!plan && rows && rows.length && typeof win.hgPlanLevels === 'function'){
    try{ plan = win.hgPlanLevels(dir, rows, hit.entry); }catch(e2){}
  }

  if (!plan && typeof win.hgApplyExactEntry === 'function'){
    try{
      var base = { dir: dir, entry: hit.entry, stop: hit.stop, t1: hit.t1, t2: hit.t2, rr: hit.rr };
      plan = win.hgApplyExactEntry(base, rows || [], {
        style: style, rows1h: rows1h, rows15m: rows15m, m15: rows15m, preferEdge: true
      });
    }catch(e3){}
  }

  if (plan){
    if (N(plan.entry) > 0) hit.entry = N(plan.entry);
    if (N(plan.stop) > 0) hit.stop = N(plan.stop);
    if (N(plan.t1) > 0) hit.t1 = N(plan.t1);
    if (N(plan.t2) > 0) hit.t2 = N(plan.t2);
    if (N(plan.rr) > 0) hit.rr = N(plan.rr);
    hit.entryType = plan.entryType || hit.entryType || null;
    hit.entryGuidance = plan.entryGuidance || hit.entryGuidance || null;
    hit.targetPolicy = plan.targetPolicy || hit.targetPolicy || null;
    if (plan.formationScore != null) hit.formationScore = plan.formationScore;
    hit.planSrc = plan.planSrc || 'hgBestLevels';
    hit.refined = true;
  }

  hit.safeMaxLev = calcSafeMaxLeverage(hit.entry, hit.stop);

  if (typeof win.hgSetupStackAttach === 'function'){
    try{
      win.hgSetupStackAttach(hit, {
        style: style,
        rows4h: rows,
        rows1h: rows1h,
        rows: rows15m,
        ticker: c.ticker || { symbol: hit.sym },
        gatesPassed: hit.gatesPassed,
        gatesTotal: 7,
        clean: hit.tier === 'clean',
        nearClean: hit.nearClean,
        tightCount: hit.tightCount,
        margins: hit.margins,
        tightGates: hit.tightGates
      });
    }catch(e4){}
  }

  return { ok: true, veto: false, hit: hit };
}

/** Desk pill label — NEAR 6/7 is watch-only by tier; CLEAN needs full audit for MIN LOSS PASS. */
function superSetupDeskPill(row){
  if (!row) return { cls: 'block', label: 'RISK BLOCK' };
  if (row.minimalLossPass) return { cls: 'minloss', label: 'MIN LOSS PASS' };
  var isNear = row.tier === 'near' || row.nearClean;
  if (isNear || row.nearWatch){
    if (row.levUnsafe) return { cls: 'block', label: 'LEV UNSAFE' };
    return { cls: 'watch', label: 'WATCH ONLY' };
  }
  if (row.tier === 'clean' && row.sizingPass && row.minLossAudit && !row.minLossAudit.pass){
    return { cls: 'block', label: 'AUDIT HOLD' };
  }
  if (row.riskPass || row.sizingPass) return { cls: 'clean', label: 'RISK PASS' };
  return { cls: 'block', label: 'RISK BLOCK' };
}

/** Gate + risk architecture filter — CLEAN 7/7 or NEAR 6/7+, valid stop, optional risk pass flag. */
function enrichSuperSetupRow(c, tier, riskOpts, meta){
  meta = meta || {};
  if (!c || !c.dir) return null;
  tier = tier || (c.nearClean ? 'near' : 'clean');
  var gatesPassed = N(c.gatesPassed != null ? c.gatesPassed : c.passed);
  if (tier === 'near'){
    if (!(c.nearClean === true || gatesPassed >= 6)) return null;
  } else if (tier !== 'clean' && gatesPassed > 0 && gatesPassed < 7){
    return null;
  }
  var hit = hitFromCand(c, {
    source: meta.source || 'scan',
    tier: tier,
    trigger: tier === 'clean' ? 'clean' : 'near',
    venueTag: c.venueTag,
    at: meta.at
  });
  if (!hit) return null;

  var refined = refineSuperSetupLevels(W, c, hit, meta.refineOpts);
  if (!refined.ok || refined.veto) return null;
  hit = refined.hit;

  riskOpts = riskOpts || defaultRiskOpts();
  var safeLev = N(hit.safeMaxLev);
  var capLev = Number.isFinite(safeLev)
    ? Math.min(riskOpts.maxLeverage, safeLev)
    : riskOpts.maxLeverage;
  var rrForCalc = pickRR(hit);
  if (N(hit.t1) > 0 && N(hit.entry) > 0 && N(hit.stop) > 0){
    var riskDist = Math.abs(hit.entry - hit.stop);
    if (riskDist > 0) rrForCalc = Math.abs(hit.t1 - hit.entry) / riskDist;
  }
  var calc = calcTrade({
    balance: riskOpts.balance,
    riskPct: riskOpts.riskPct,
    entry: hit.entry,
    stop: hit.stop,
    rr: rrForCalc,
    tpPrice: N(hit.t1) > 0 ? hit.t1 : null,
    maxLeverage: capLev,
    feePct: riskOpts.feePct,
    slipPct: riskOpts.slipPct
  });
  hit.id = hit.id || c.id || [hit.sym, hit.dir, hit.entry, hit.stop, tier].join('|');
  hit.scanner = meta.scanner || meta.source || 'swing';
  hit.sizingPass = calc.ok && Number.isFinite(safeLev) && calc.impliedLeverage <= safeLev;
  hit.levUnsafe = Number.isFinite(safeLev) && Number.isFinite(calc.impliedLeverage) && calc.impliedLeverage > safeLev;
  hit.nearWatch = (hit.tier === 'near' || hit.nearClean) && !hit.levUnsafe
    && N(hit.entry) > 0 && N(hit.stop) > 0 && hit.entry !== hit.stop;
  var style = String(hit.scanner || meta.scanner || 'swing').indexOf('scalp') >= 0 ? 'scalp' : 'swing';
  hit.minLossAudit = runFullMinimalLossAudit(W, c, hit, { style: style, calc: calc });
  if (typeof W.hgCryptoAttachPositionSize === 'function'){
    try{
      W.hgCryptoAttachPositionSize(hit, riskOpts.balance, riskOpts.riskPct, { style: style });
      if (hit.positionRisk && hit.tier === 'clean' && !hit.positionRisk.pass){
        hit.minLossAudit.pass = false;
        hit.minLossAudit.reasons = (hit.minLossAudit.reasons || []).concat(hit.positionRisk.reasons || []);
      }
    }catch(eSz){}
  }
  hit.minimalLossPass = hit.tier === 'clean' && hit.sizingPass && hit.minLossAudit.pass
    && (!hit.stack || hit.stack.tierHint === 'clean');
  hit.riskPass = hit.sizingPass;
  hit.riskReason = hit.minimalLossPass ? 'PASS'
    : (hit.nearWatch ? 'NEAR — watch only (6/7)'
      : (hit.levUnsafe ? 'Leverage above safe max'
        : (hit.minLossAudit && hit.minLossAudit.reasons && hit.minLossAudit.reasons.length
          ? hit.minLossAudit.reasons[0] : calc.reason)));
  hit.calc = calc;
  hit.tp = N(hit.t1) > 0 ? hit.t1 : calc.tp;
  hit.tp2 = N(hit.t2);
  hit.qty = calc.qty;
  hit.impliedLev = calc.impliedLev;
  hit.missing = Array.isArray(c.missing) ? c.missing.slice() : [];
  return hit;
}

function buildSnapFromCryptoScans(win, riskOpts, opts){
  win = win || W;
  riskOpts = riskOpts || defaultRiskOpts(win);
  opts = opts || {};
  var allowStale = opts.allowStale === true;
  var merged = [];
  var scanned = 0;
  var audit = { clean: 0, near: 0, riskPass: 0, nearWatch: 0, minLoss: 0, uniLen: 0, venues: [] };

  function snapFresh(snap){
    if (!snap) return false;
    if (allowStale) return true;
    return isFreshAt(snap.at, SNAP_MAX_MS);
  }

  function absorbSnap(snap, scanner){
    if (!snapFresh(snap)) return;
    scanned = Math.max(scanned, snap.at || 0);
    if (snap.audit && isFinite(snap.audit.uniLen)) audit.uniLen += snap.audit.uniLen;
    (snap.cands || []).forEach(function(c){
      var row = enrichSuperSetupRow(c, 'clean', riskOpts, { source: 'universe', scanner: scanner, at: snap.at });
      if (row){ merged.push(row); audit.clean++; if (row.riskPass) audit.riskPass++; if (row.minimalLossPass) audit.minLoss++; }
    });
    (snap.nearCands || []).forEach(function(c){
      var row = enrichSuperSetupRow(c, 'near', riskOpts, { source: 'universe', scanner: scanner, at: snap.at });
      if (row){ merged.push(row); audit.near++; if (row.nearWatch) audit.nearWatch++; if (row.riskPass) audit.riskPass++; }
    });
  }

  var bestFn = win.bestScan;
  if (typeof bestFn === 'function'){
    try{
      var best = bestFn();
      if (snapFresh(best) && Array.isArray(best.clean)){
        audit.venues.push('best');
        if (best.meta && isFinite(best.meta.uniLen)) audit.uniLen += best.meta.uniLen;
        scanned = Math.max(scanned, best.at || 0);
        best.clean.forEach(function(c){
          var row = enrichSuperSetupRow(c, 'clean', riskOpts, { source: 'universe', scanner: 'best', at: best.at });
          if (row){ merged.push(row); audit.clean++; if (row.riskPass) audit.riskPass++; if (row.minimalLossPass) audit.minLoss++; }
        });
      }
    }catch(e0){}
  }

  var swingFn = win.swingScan;
  if (typeof swingFn === 'function'){
    try{ absorbSnap(swingFn(), 'swing'); audit.venues.push('swing'); }catch(e1){}
  }
  var scalpFn = win.scalpScan;
  if (typeof scalpFn === 'function'){
    try{ absorbSnap(scalpFn(), 'scalp'); audit.venues.push('scalp'); }catch(e2){}
  }

  var seen = {};
  merged = merged.filter(function(r){
    if (!r || !r.id) return false;
    if (seen[r.id]) return false;
    seen[r.id] = true;
    return true;
  });
  superSetupSortCands(merged);

  return {
    at: scanned || Date.now(),
    cands: merged,
    audit: audit,
    stat: merged.length
      ? (merged.length + ' setups · ' + audit.clean + ' CLEAN · ' + audit.near + ' NEAR · '
        + audit.minLoss + ' trade-ready · ' + audit.nearWatch + ' watch · Delta + CoinDCX universe')
      : '0 setups — run Scan all contracts or wait for the 15 min cycle · checked swing/scalp/best desks'
  };
}

function syncDeskFromExisting(win, riskOpts, opts){
  win = win || W;
  opts = opts || {};
  var snap = buildSnapFromCryptoScans(win, riskOpts, { allowStale: true });
  snap.scanAt = __ss.lastScanAt || snap.at || Date.now();
  snap.hydrated = true;
  publishSuperSetupSnap(snap);
  if (opts.skipPostGate !== true && typeof Promise === 'function'){
    Promise.resolve(applySuperSetupPostGate(snap, win)).then(function (next){
      if (!next) return;
      publishSuperSetupSnap(next);
      if (__ss.mounted && typeof __ss.paintDesk === 'function') __ss.paintDesk(next);
    }).catch(function (){});
  }
  return snap;
}

function autoSelectFirstSetup(snap){
  snap = snap || superSetupScan();
  if (!snap || !Array.isArray(snap.cands) || !snap.cands.length) return null;
  var hit = null;
  var i;
  if (__ss.selectedId){
    for (i = 0; i < snap.cands.length; i++){
      if (snap.cands[i] && snap.cands[i].id === __ss.selectedId){ hit = snap.cands[i]; break; }
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
  if (hit && hit.id) __ss.selectedId = hit.id;
  return hit;
}

function publishSuperSetupSnap(snap){
  __hgSuperSetupSnap = snap || null;
  try{ W.HG_superSetupScan = snap; }catch(e){}
  return snap;
}

function mergePublishSuperSetupSnap(nextSnap){
  var prev = superSetupScan() || {};
  return publishSuperSetupSnap(
    (typeof W.hgSuperDeskMergeSnap === 'function')
      ? W.hgSuperDeskMergeSnap(prev, nextSnap || {}, { emptyStatPrefixes: ['0 setups'] })
      : Object.assign({}, prev, nextSnap || {})
  );
}

function superSetupScan(){
  return __hgSuperSetupSnap;
}

function superSetupAfterScan(snap){
  snap = snap || superSetupScan();
  if (!snap) return;
  mergePublishSuperSetupSnap(snap);
  __ss.lastScanMsg = snap.stat || 'done';
  if (__ss.mounted && typeof __ss.setScanStatus === 'function') __ss.setScanStatus(__ss.lastScanMsg);
  if (__ss.mounted && typeof __ss.paintDesk === 'function') __ss.paintDesk(superSetupScan());
  if (__ss.mounted && typeof __ss.applyFirstSetup === 'function') __ss.applyFirstSetup(false);
  else if (__ss.mounted && typeof __ss.tryAutoPopulate === 'function') __ss.tryAutoPopulate(true);
}

async function superSetupRunScanInner(opts){
  opts = opts || {};
  __ss.scanBusy = true;
  __ss.lastScanMsg = 'Scanning Delta + CoinDCX universe…';
  if (__ss.mounted && typeof __ss.setScanStatus === 'function') __ss.setScanStatus(__ss.lastScanMsg);
  try{
    var warm = W.cryptoScanWarm;
    var runScan = W.runScan;
    if (typeof warm === 'function'){
      __ss.lastScanMsg = 'Swing scan — liquid top-N Delta + CoinDCX…';
      if (__ss.mounted && typeof __ss.setScanStatus === 'function') __ss.setScanStatus(__ss.lastScanMsg);
      await warm('swing');
      if (opts.includeScalp !== false){
        __ss.lastScanMsg = 'Scalp scan — liquid top-N Delta + CoinDCX…';
        if (__ss.mounted && typeof __ss.setScanStatus === 'function') __ss.setScanStatus(__ss.lastScanMsg);
        await warm('scalp');
      }
    } else if (typeof runScan === 'function'){
      var warmN = (typeof W.HG_SCAN_WARM_N === 'number') ? W.HG_SCAN_WARM_N : 80;
      await runScan('swing', { quiet: true, n: warmN });
      if (opts.includeScalp !== false) await runScan('scalp', { quiet: true, n: warmN });
    }
    var bestWarm = W.bestScanWarm;
    if (typeof bestWarm === 'function'){
      try{ await bestWarm(); }catch(eB){}
    }
    try{
      var extWarm = [
        W.refreshCcxtDesk, W.refreshWorldMonitorDesk, W.hgNewsRefresh,
        W.onchainFetch, W.oiflowWarm, W.deribitVolWarm
      ];
      for (var ew = 0; ew < extWarm.length; ew++){
        if (typeof extWarm[ew] === 'function'){
          try{ await extWarm[ew](false); }catch(eW){}
        }
      }
    }catch(eExt){}
    var riskOpts = opts.riskOpts || defaultRiskOpts(W);
    var snap = buildSnapFromCryptoScans(W, riskOpts);
    snap.scanAt = Date.now();
    snap.at = snap.scanAt;
    __ss.lastScanMsg = 'Precision pass — post-gate flow/BTC RS…';
    if (__ss.mounted && typeof __ss.setScanStatus === 'function') __ss.setScanStatus(__ss.lastScanMsg);
    snap = await applySuperSetupPostGate(snap, W);
    __ss.lastScanAt = snap.scanAt;
    superSetupAfterScan(snap);
    return snap.cands.length ? ('ok · ' + snap.cands.length + ' setups') : 'ok · 0 setups';
  }catch(e){
    __ss.lastScanMsg = 'Scan error: ' + ((e && e.message) ? e.message : String(e));
    if (__ss.mounted && typeof __ss.setScanStatus === 'function') __ss.setScanStatus(__ss.lastScanMsg);
    return __ss.lastScanMsg;
  }finally{
    __ss.scanBusy = false;
  }
}

function forceFlag(opts){ return !!(opts && opts.force); }

async function superSetupRunScan(opts){
  opts = opts || {};
  if (__ss.scanPromise){
    if (opts.force){
      try{ await __ss.scanPromise; }catch(e0){}
    } else {
      return __ss.scanPromise;
    }
  }
  __ss.scanPromise = superSetupRunScanInner(opts).finally(function(){
    __ss.scanPromise = null;
  });
  return __ss.scanPromise;
}

async function superSetupWarm(opts){
  opts = opts || {};
  var stale = !__ss.lastScanAt || (Date.now() - __ss.lastScanAt) >= SCAN_INTERVAL_MS;
  if (stale || opts.force) return superSetupRunScan({ force: !!opts.force });
  return 'fresh';
}

function collectScanHits(win){
  win = win || W;
  var hits = [];
  function push(hit){ if (hit) hits.push(hit); }

  var ssFn = win.superSetupScan;
  if (typeof ssFn === 'function'){
    try{
      var ss = ssFn();
      if (ss && Array.isArray(ss.cands) && ss.cands.length
          && (ss.hydrated || isFreshAt(ss.at || ss.scanAt, SNAP_MAX_MS))){
        ss.cands.forEach(function(c){ push(c); });
      }
    }catch(eSs){}
  }

  var sgFn = win.superGoldScan;
  if (typeof sgFn === 'function'){
    try{
      var sg = sgFn();
      if (sg && Array.isArray(sg.cands) && sg.cands.length
          && (sg.hydrated || isFreshAt(sg.at || sg.scanAt, SNAP_MAX_MS))){
        sg.cands.forEach(function(c){
          if (c && (c.minimalLossPass || c.tier === 'clean')) push(c);
        });
      }
    }catch(eSg){}
  }

  var sel = win.HG_selectedSetup || win.HG_currentSetup || win.HG_bestSetup;
  if (sel && typeof sel === 'object'){
    push(hitFromCand(sel, { source: 'selected', tier: 'clean', trigger: sel.trigger || 'selected' }));
  }

  var bestFn = win.bestScan;
  if (typeof bestFn === 'function'){
    try{
      var best = bestFn();
      if (best && isFreshAt(best.at) && Array.isArray(best.clean) && best.clean.length){
        push(hitFromCand(best.clean[0], { source: 'best', tier: 'clean', trigger: 'clean', at: best.at }));
      }
    }catch(e0){}
  }

  var swingFn = win.swingScan;
  if (typeof swingFn === 'function'){
    try{
      var sw = swingFn();
      if (sw && isFreshAt(sw.at)){
        push(hitFromCand(pickBestCand(sw), { source: 'swing', tier: 'clean', trigger: 'clean', at: sw.at }));
      }
    }catch(e1){}
  }

  var scalpFn = win.scalpScan;
  if (typeof scalpFn === 'function'){
    try{
      var sc = scalpFn();
      if (sc && isFreshAt(sc.at)){
        push(hitFromCand(pickBestCand(sc), { source: 'scalp', tier: 'clean', trigger: 'clean', at: sc.at }));
      }
    }catch(e2){}
  }

  var edgeFn = win.edgeScan;
  if (typeof edgeFn === 'function'){
    try{
      var ed = edgeFn();
      if (ed && isFreshAt(ed.at) && Array.isArray(ed.cands) && ed.cands.length){
        for (var ei = 0; ei < ed.cands.length; ei++){
          var ec = ed.cands[ei];
          if (ec && (ec.clean === true || ec.gatesPassed >= 7)){
            push(hitFromCand(ec, { source: 'edge', tier: 'clean', trigger: 'clean', at: ed.at }));
            break;
          }
        }
      }
    }catch(e3){}
  }

  [['goldscalpScan', 'gold-scalp'], ['goldswingScan', 'gold-swing']].forEach(function(pair){
    var fn = win[pair[0]];
    if (typeof fn !== 'function') return;
    try{
      var gs = fn();
      if (!gs || !isFreshAt(gs.at) || !Array.isArray(gs.cands)) return;
      for (var gi = 0; gi < gs.cands.length; gi++){
        var gc = gs.cands[gi];
        if (gc && String(gc.grade || '').toUpperCase() === 'A'){
          push(hitFromCand(gc, { source: pair[1], tier: 'clean', trigger: 'grade-a', at: gs.at }));
          break;
        }
      }
    }catch(e4){}
  });

  var sources = [win.HG_scannerOutput, win.HG_lastScan, win.HG_chartSetup, win.HG_signal];
  var i;
  for (i = 0; i < sources.length; i++){
    if (sources[i] && typeof sources[i] === 'object'){
      push(hitFromCand(sources[i], { source: 'global', tier: 'clean', trigger: sources[i].trigger || 'signal' }));
    }
  }

  return hits;
}

function getScannerContext(win, storage){
  win = win || W;
  storage = storage || (win && win.localStorage);
  var hits = collectScanHits(win);
  if (hits.length) return hits[0];
  if (storage && typeof storage.getItem === 'function'){
    var i;
    for (i = 0; i < SCANNER_KEYS.length; i++){
      try{
        var v = safeJson(storage.getItem(SCANNER_KEYS[i]));
        if (v && typeof v === 'object'){
          var lh = hitFromCand(v, { source: 'localStorage', tier: 'clean', trigger: 'signal' });
          if (lh) return lh;
          return v;
        }
      }catch(e0){}
    }
  }
  return null;
}

function getChartContext(win){
  win = win || W;
  var c = win.HG_chart || win.chart || win.tradingChart || null;
  var lastPrice = N(c && (c.lastPrice != null ? c.lastPrice : c.price));
  if (!Number.isFinite(lastPrice)) lastPrice = N(win.HG_lastPrice != null ? win.HG_lastPrice : win.lastPrice);
  return {
    lastPrice: lastPrice,
    high: N(c && c.high != null ? c.high : win.HG_chartHigh),
    low: N(c && c.low != null ? c.low : win.HG_chartLow),
    ema21: N(c && c.ema21 != null ? c.ema21 : win.HG_ema21),
    ema50: N(c && c.ema50 != null ? c.ema50 : win.HG_ema50),
    ema200: N(c && c.ema200 != null ? c.ema200 : win.HG_ema200),
    atr: N(c && c.atr != null ? c.atr : win.HG_atr),
    swingHigh: N(c && c.swingHigh != null ? c.swingHigh : win.HG_swingHigh),
    swingLow: N(c && c.swingLow != null ? c.swingLow : win.HG_swingLow),
    lastBOS: (c && c.lastBOS) ? c.lastBOS : (win.HG_lastBOS || null),
    lastCHoCH: (c && c.lastCHoCH) ? c.lastCHoCH : (win.HG_lastCHoCH || null),
    fvg: (c && c.fvg) ? c.fvg : null,
    fvgTap: !!(c && c.fvgTap),
    orderBlock: (c && c.orderBlock) ? c.orderBlock : (c && c.ob ? c.ob : null),
    sweep: !!(c && c.sweep),
    reclaim: !!(c && c.reclaim),
    rows: (c && c.rows) ? c.rows : (win.HG_rows4h || win.HG_rows || null)
  };
}

function pickEntry(side, chart, scan){
  chart = chart || {};
  scan = scan || null;
  var direct = N(scan && (scan.entry != null ? scan.entry : (scan.entryPrice != null ? scan.entryPrice : (scan.setup && scan.setup.entry))));
  if (Number.isFinite(direct) && direct > 0) return direct;
  var lp = chart.lastPrice;
  var sh = chart.swingHigh;
  var sl = chart.swingLow;
  var ema21 = chart.ema21;
  var ema50 = chart.ema50;
  if (side === 'Long'){
    if (Number.isFinite(ema21) && Number.isFinite(ema50) && ema21 > ema50) return Number.isFinite(lp) ? lp : ema21;
    if (Number.isFinite(sl)) return sl * 1.001;
    if (Number.isFinite(lp)) return lp;
  } else {
    if (Number.isFinite(ema21) && Number.isFinite(ema50) && ema21 < ema50) return Number.isFinite(lp) ? lp : ema21;
    if (Number.isFinite(sh)) return sh * 0.999;
    if (Number.isFinite(lp)) return lp;
  }
  return NaN;
}

function pickStop(side, chart, scan, entry){
  chart = chart || {};
  scan = scan || null;
  entry = N(entry);
  var direct = N(scan && (scan.stop != null ? scan.stop : (scan.stopLoss != null ? scan.stopLoss : (scan.sl != null ? scan.sl : (scan.setup && scan.setup.stop)))));
  if (Number.isFinite(direct) && direct > 0) return direct;
  var atr = chart.atr;
  var swingHigh = chart.swingHigh;
  var swingLow = chart.swingLow;
  if (side === 'Long'){
    if (Number.isFinite(swingLow)) return swingLow - (Number.isFinite(atr) ? atr * 0.2 : 0);
    if (Number.isFinite(entry) && Number.isFinite(atr)) return entry - atr * 1.5;
  } else {
    if (Number.isFinite(swingHigh)) return swingHigh + (Number.isFinite(atr) ? atr * 0.2 : 0);
    if (Number.isFinite(entry) && Number.isFinite(atr)) return entry + atr * 1.5;
  }
  return NaN;
}

function pickRR(scan){
  var rr = N(scan && (scan.rr != null ? scan.rr : (scan.rR != null ? scan.rR : (scan.setup && scan.setup.rr))));
  return (Number.isFinite(rr) && rr > 0) ? rr : 2;
}

function structureEventFresh(ev, n, maxBars){
  if (!ev || !isFinite(ev.i)) return true;
  if (!isFinite(n) || n < 0) return true;
  return (n - ev.i) <= (maxBars || STRUCT_MAX_BARS);
}

function stopBeyondZone(side, stop, zone){
  if (!zone || !Number.isFinite(stop)) return true;
  var lo = N(zone.lo != null ? zone.lo : zone.bottom);
  var hi = N(zone.hi != null ? zone.hi : zone.top);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return true;
  if (side === 'Long') return stop < lo;
  return stop > hi;
}

/** Structure gate: BOS/CHoCH/zone required; optional row helpers when loaded. */
function evaluateStructureTrigger(win, side, rows, chart){
  win = win || W;
  chart = chart || {};
  var dir = side === 'Long' ? 'long' : 'short';
  var want = dirToTrend(dir);
  var triggers = [];
  var entry = NaN;
  var stop = NaN;
  var n = (rows && rows.length) ? rows.length - 1 : -1;
  var zoneStop = null;

  function addTrigger(t){ if (triggers.indexOf(t) < 0) triggers.push(t); }

  if (chart.lastBOS && chart.lastBOS.dir === want && structureEventFresh(chart.lastBOS, n)) addTrigger('bos');
  if (chart.lastCHoCH && chart.lastCHoCH.dir === want && structureEventFresh(chart.lastCHoCH, n)) addTrigger('choch');
  if (chart.fvgTap || chart.fvg) addTrigger('fvg');
  if (chart.orderBlock) addTrigger('ob');
  if (chart.sweep && chart.reclaim) addTrigger('sweep');

  if (rows && rows.length >= 12){
    if (typeof win.hgStructureGate === 'function'){
      try{
        var gate = win.hgStructureGate(rows, dir, { maxBars: STRUCT_MAX_BARS });
        if (gate && gate.veto){
          return { valid: false, reason: gate.note || 'CHoCH veto against trade direction' };
        }
        if (gate && gate.bos) addTrigger('bos');
        if (gate && gate.choch) addTrigger('choch');
      }catch(e0){}
    }
    if (typeof win.hgDetectFvg === 'function'){
      try{
        var fvg = win.hgDetectFvg(rows, dir);
        if (fvg && Number.isFinite(fvg.entry)){
          addTrigger('fvg');
          entry = fvg.entry;
          if (fvg.zone) zoneStop = fvg.zone;
        }
      }catch(e1){}
    }
    if (typeof win.hgDetectOrderBlock === 'function'){
      try{
        var ob = win.hgDetectOrderBlock(rows, dir);
        if (ob && Number.isFinite(ob.entry)){
          addTrigger('ob');
          if (!Number.isFinite(entry)) entry = ob.entry;
          if (ob.zone) zoneStop = ob.zone;
        }
      }catch(e2){}
    }
    if (typeof win.hgShieldGuardVeto === 'function'){
      try{
        var shield = win.hgShieldGuardVeto(rows, dir);
        if (shield && shield.veto){
          return { valid: false, reason: 'Manipulation shield: ' + ((shield.reasons || []).join(' · ') || 'veto') };
        }
      }catch(e3){}
    }
  }

  if (!triggers.length){
    return { valid: false, reason: 'No BOS/CHoCH/zone confirmation — standing aside' };
  }

  if (!Number.isFinite(entry)) entry = pickEntry(side, chart, null);
  if (!Number.isFinite(stop)) stop = pickStop(side, chart, null, entry);

  if (zoneStop && Number.isFinite(stop) && !stopBeyondZone(side, stop, zoneStop)){
    if (side === 'Long'){
      var zlo = N(zoneStop.lo != null ? zoneStop.lo : zoneStop.bottom);
      if (Number.isFinite(zlo)) stop = zlo - (Number.isFinite(chart.atr) ? chart.atr * 0.15 : 0);
    } else {
      var zhi = N(zoneStop.hi != null ? zoneStop.hi : zoneStop.top);
      if (Number.isFinite(zhi)) stop = zhi + (Number.isFinite(chart.atr) ? chart.atr * 0.15 : 0);
    }
  }

  if (!Number.isFinite(stop) || stop <= 0){
    return { valid: false, reason: 'No stop beyond invalidation' };
  }
  if (!Number.isFinite(entry) || entry <= 0){
    return { valid: false, reason: 'No entry after confirmation' };
  }

  if (Number.isFinite(chart.ema21) && Number.isFinite(chart.ema50)){
    if (side === 'Long' && chart.ema21 < chart.ema50){
      return { valid: false, reason: 'EMA stack against long bias' };
    }
    if (side === 'Short' && chart.ema21 > chart.ema50){
      return { valid: false, reason: 'EMA stack against short bias' };
    }
  }

  return {
    valid: true,
    trigger: triggers[0],
    triggers: triggers,
    entry: entry,
    stop: stop,
    note: triggers.join(' + ') + ' confirmed'
  };
}

function isCleanScannerHit(hit){
  if (!hit) return false;
  if (hit.clean === false && !hit.nearClean) return false;
  var side = normalizeSide(hit.dir);
  if (!side) return false;
  var entry = N(hit.entry);
  var stop = N(hit.stop);
  return entry > 0 && stop > 0 && entry !== stop;
}

function isNearScannerHit(hit){
  return isCleanScannerHit(hit) && (hit.nearClean === true || hit.tier === 'near');
}

function scannerReadyNote(hit){
  var isNear = isNearScannerHit(hit);
  var tierLabel = isNear ? 'NEAR' : 'CLEAN';
  var hold = '';
  if (isNear) hold = ' · watch only';
  else if (hit && hit.minimalLossPass) hold = ' · minimal-loss PASS';
  else if (hit && hit.minLossAudit && hit.minLossAudit.reasons && hit.minLossAudit.reasons.length)
    hold = ' · audit hold: ' + hit.minLossAudit.reasons[0];
  else if (hit && hit.riskPass === false) hold = ' · risk ' + (hit.riskReason || 'BLOCK');
  else hold = ' · audit hold';
  return {
    isNear: isNear,
    watchOnly: isNear,
    tierLabel: tierLabel,
    note: tierLabel + hold + ' · ' + ((hit && hit.sym) || '') + ' · ' + ((hit && hit.venueTag) || 'Delta/CoinDCX')
  };
}

/** Main gate: idle until CLEAN scanner or confirmed structure. Pure for tests. */
function evaluateSetup(win, opts){
  win = win || W;
  opts = opts || {};
  var chart = getChartContext(win);
  var hits = collectScanHits(win);
  var hit = null;
  var i;
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
      if (hits[i] && hits[i].tier === 'clean' && hits[i].riskPass !== false){ hit = hits[i]; break; }
    }
  }
  if (!hit && hits.length) hit = hits[0];

  if (isCleanScannerHit(hit)){
    var scanSide = normalizeSide(hit.dir);
    var labels = scannerReadyNote(hit);
    var scanRr = pickRR(hit);
    if (N(hit.t1) > 0 && N(hit.entry) > 0 && N(hit.stop) > 0){
      var sdist = Math.abs(hit.entry - hit.stop);
      if (sdist > 0) scanRr = Math.abs(hit.t1 - hit.entry) / sdist;
    }
    return {
      ready: true,
      idle: false,
      mode: 'scanner',
      trigger: hit.trigger || (hit.tier === 'near' ? 'near' : 'clean'),
      source: hit.source || 'scanner',
      side: scanSide,
      sym: hit.sym,
      tf: hit.tf || hit.scanner || '4h',
      entry: hit.entry,
      stop: hit.stop,
      t1: hit.t1,
      t2: hit.t2,
      rr: scanRr,
      entryType: hit.entryType,
      entryGuidance: hit.entryGuidance,
      safeMaxLev: hit.safeMaxLev,
      minimalLossPass: hit.minimalLossPass,
      minLossAudit: hit.minLossAudit,
      refined: hit.refined,
      watchOnly: labels.watchOnly,
      setupType: labels.tierLabel + ' · ' + (hit.scanner || hit.source || 'scanner')
        + (hit.refined ? ' · exact entry' : ''),
      note: labels.note,
      hit: hit
    };
  }

  var side = normalizeSide(opts.side) || normalizeSide(hit && hit.dir);
  if (!side && Number.isFinite(chart.ema21) && Number.isFinite(chart.ema50)){
    side = chart.ema21 > chart.ema50 ? 'Long' : 'Short';
  }
  if (!side){
    return { ready: false, idle: true, reason: 'No direction bias — waiting for scanner or structure' };
  }

  var rows = opts.rows || chart.rows || null;
  var struct = evaluateStructureTrigger(win, side, rows, chart);
  if (!struct.valid){
    return { ready: false, idle: true, reason: struct.reason || 'No confirmed structure' };
  }

  return {
    ready: true,
    idle: false,
    mode: 'structure',
    trigger: struct.trigger,
    source: 'chart',
    side: side,
    sym: opts.sym || null,
    entry: struct.entry,
    stop: struct.stop,
    rr: pickRR(hit),
    setupType: 'Structure · ' + struct.trigger,
    note: struct.note
  };
}

function setupSignalKey(ev){
  if (!ev || !ev.ready) return '';
  return [ev.mode, ev.source, ev.trigger, ev.sym, ev.side, ev.entry, ev.stop].join('|');
}

/** Risk-first sizing + approval gate. Accepts tpRR or rr. Pure — never throws. */
function calcTrade(opts){
  opts = opts || {};
  var balance = N(opts.balance);
  var riskPct = N(opts.riskPct);
  var entry = N(opts.entry);
  var stop = N(opts.stop);
  var tpRR = N(opts.tpRR != null ? opts.tpRR : (opts.rr != null ? opts.rr : 2));
  var maxLeverage = N(opts.maxLeverage != null ? opts.maxLeverage : 5);
  var feePct = N(opts.feePct != null ? opts.feePct : 0.06);
  var slipPct = N(opts.slipPct != null ? opts.slipPct : 0.05);
  var tpPrice = N(opts.tpPrice);

  if (![balance, riskPct, entry, stop, tpRR, maxLeverage].every(Number.isFinite)){
    return { ok: false, reason: 'Missing or invalid inputs' };
  }
  var riskDollars = balance * (riskPct / 100);
  var stopDist = Math.abs(entry - stop);
  if (stopDist <= 0) return { ok: false, reason: 'Stop-loss must differ from entry' };

  var positionUnits = riskDollars / stopDist;
  var notional = positionUnits * entry;
  var impliedLeverage = notional / balance;
  var feeBuffer = notional * ((feePct + slipPct) / 100);
  var effectiveRisk = riskDollars + feeBuffer;
  var tp = Number.isFinite(tpPrice) ? tpPrice
    : (entry > stop ? entry + stopDist * tpRR : entry - stopDist * tpRR);
  var levOk = impliedLeverage <= maxLeverage;
  var pass = levOk && effectiveRisk <= riskDollars * 1.15;

  return {
    ok: pass,
    reason: pass ? 'PASS' : (!levOk ? 'Leverage too high' : 'Risk buffer too high'),
    riskDollars: riskDollars,
    riskUsd: riskDollars,
    stopDist: stopDist,
    positionUnits: positionUnits,
    qty: positionUnits,
    notional: notional,
    impliedLeverage: impliedLeverage,
    impliedLev: impliedLeverage,
    tp: tp,
    rr: tpRR,
    feeBuffer: feeBuffer,
    effectiveRisk: effectiveRisk
  };
}

function injectStyles(){
  if (W.__hgSuperSetupStyles) return;
  W.__hgSuperSetupStyles = true;
  var st = document.createElement('style');
  st.id = 'hg-super-setup-styles';
  st.textContent = [
    '.hg-super-setup{padding:16px;display:grid;gap:12px}',
    '.hg-super-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}',
    '.hg-super-badge{font:700 11px/1.2 var(--mono,monospace);padding:6px 10px;border-radius:999px;background:var(--panel2,#edf1f6);color:var(--txt,#172033);border:1px solid var(--line,#d7dee8)}',
    '.hg-super-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}',
    '.hg-super-setup .hg-card{grid-column:span 12;background:var(--panel,#fff);border:1px solid var(--line,#d7dee8);border-radius:var(--radius,8px);padding:14px;color:var(--txt,#172033);box-shadow:var(--shadow-sm,0 1px 2px rgba(23,32,51,.06))}',
    '.hg-super-setup .hg-card h3{margin:0 0 10px 0;font:700 13px/1.2 var(--disp,system-ui);color:var(--txt,#172033);letter-spacing:.06em;text-transform:uppercase}',
    '.hg-super-setup .hg-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
    '.hg-super-setup .hg-field{display:grid;gap:6px}',
    '.hg-super-setup .hg-field label{font:600 11px/1.2 var(--mono,monospace);color:var(--mut,#536175);letter-spacing:.04em}',
    '.hg-super-setup .hg-field input,.hg-super-setup .hg-field select{width:100%;box-sizing:border-box;border:1px solid var(--line-strong,#aab7c8);background:var(--panel,#fff);color:var(--txt,#172033);border-radius:var(--radius-sm,6px);padding:10px 12px;font:500 13px/1.2 var(--mono,monospace)}',
    '.hg-super-setup .hg-out{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
    '.hg-super-setup .hg-metric{background:var(--panel2,#edf1f6);border:1px solid var(--line,#d7dee8);border-radius:var(--radius-sm,6px);padding:10px}',
    '.hg-super-setup .hg-metric .k{font:600 11px/1.2 var(--mono,monospace);color:var(--dim,#65758c)}',
    '.hg-super-setup .hg-metric .v{margin-top:6px;font:700 15px/1.2 var(--mono,monospace);color:var(--txt,#172033)}',
    '.hg-super-setup .hg-pass{color:var(--long,#15803d)!important}',
    '.hg-super-setup .hg-fail{color:var(--short,#dc2626)!important}',
    '.hg-super-setup .hg-wait{color:var(--mut,#536175)!important}',
    '.hg-super-setup .hg-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}',
    '.hg-super-setup .hg-btn{border:0;border-radius:var(--radius-sm,6px);padding:10px 14px;font:700 12px/1.2 var(--mono,monospace);cursor:pointer;letter-spacing:.04em}',
    '.hg-super-setup .hg-btn.primary{background:linear-gradient(180deg,#2563eb,#0f5cc0);color:#fff;box-shadow:0 2px 8px rgba(15,92,192,.18)}',
    '.hg-super-setup .hg-btn.secondary{background:var(--panel,#fff);color:var(--txt,#172033);border:1px solid var(--line,#d7dee8)}',
    '.hg-super-setup .hg-btn:disabled{opacity:.45;cursor:not-allowed}',
    '.hg-super-setup .hg-note{font:500 12px/1.45 var(--mono,monospace);color:var(--mut,#536175)}',
    '.hg-super-setup .hg-title{font:800 18px/1.2 var(--disp,system-ui);color:var(--txt,#172033)}',
    '.hg-super-setup .hg-sync{padding:10px 12px;background:var(--panel2,#edf1f6);border:1px solid var(--line,#d7dee8);border-radius:var(--radius-sm,6px);font:500 12px/1.45 var(--mono,monospace);color:var(--mut,#536175)}',
    '.hg-super-setup.hg-idle .hg-trade-field input{opacity:.55}',
    '.hg-super-setup .hg-idle-banner{padding:12px 14px;border-radius:var(--radius-sm,6px);border:1px dashed var(--line-strong,#aab7c8);background:var(--panel2,#edf1f6);font:600 12px/1.45 var(--mono,monospace);color:var(--mut,#536175)}',
    '.hg-super-setup .hg-trigger{display:inline-block;margin-top:8px;font:700 10px/1 var(--mono,monospace);letter-spacing:.08em;text-transform:uppercase;padding:4px 8px;border-radius:999px;background:var(--long-bg,#ecfdf5);color:var(--long,#15803d);border:1px solid rgba(21,128,61,.25)}',
    '.hg-super-setup .hg-desk{display:grid;gap:10px;max-height:420px;overflow:auto}',
    '.hg-super-setup .hg-desk-card{border:1px solid var(--line,#d7dee8);border-radius:var(--radius-sm,6px);padding:12px;background:var(--panel,#fff);cursor:pointer}',
    '.hg-super-setup .hg-desk-card:hover{border-color:var(--line-strong,#aab7c8);box-shadow:var(--shadow-sm,0 1px 2px rgba(23,32,51,.06))}',
    '.hg-super-setup .hg-desk-card.sel{border-color:#2563eb;box-shadow:0 0 0 1px #2563eb}',
    '.hg-super-setup .hg-desk-top{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}',
    '.hg-super-setup .hg-desk-sym{font:800 13px/1.2 var(--mono,monospace);color:var(--txt,#172033)}',
    '.hg-super-setup .hg-desk-pills{display:flex;gap:6px;flex-wrap:wrap}',
    '.hg-super-setup .hg-pill{font:700 10px/1 var(--mono,monospace);padding:4px 8px;border-radius:999px;border:1px solid var(--line,#d7dee8);background:var(--panel2,#edf1f6)}',
    '.hg-super-setup .hg-pill.clean{color:var(--long,#15803d);border-color:rgba(21,128,61,.25)}',
    '.hg-super-setup .hg-pill.near{color:var(--gold,#a67c12);border-color:rgba(166,124,18,.25)}',
    '.hg-super-setup .hg-pill.watch{color:var(--gold,#a67c12);border-color:rgba(166,124,18,.35);background:#fffbeb}',
    '.hg-super-setup .hg-pill.block{color:var(--short,#dc2626)}',
    '.hg-super-setup .hg-pill.minloss{color:var(--long,#15803d);border-color:rgba(21,128,61,.35);background:var(--long-bg,#ecfdf5)}',
    '.hg-super-setup .hg-pill.refined{color:#2563eb;border-color:rgba(37,99,235,.25)}',
    '.hg-super-setup .hg-desk-levels{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:10px}',
    '.hg-super-setup .hg-desk-levels .k{font:600 10px/1.2 var(--mono,monospace);color:var(--dim,#65758c)}',
    '.hg-super-setup .hg-desk-levels .v{font:700 12px/1.2 var(--mono,monospace);margin-top:4px}',
    '.hg-super-setup .hg-scan-stat{font:600 12px/1.45 var(--mono,monospace);color:var(--mut,#536175)}',
    '@media (max-width:900px){.hg-super-setup .hg-form,.hg-super-setup .hg-out,.hg-super-setup .hg-desk-levels{grid-template-columns:1fr}}'
  ].join('\n');
  try{ (document.head || document.documentElement).appendChild(st); }catch(e){}
}

function clearSyncTimer(){
  if (__ss.syncTimer != null){
    try{ clearInterval(__ss.syncTimer); }catch(e){}
    __ss.syncTimer = null;
  }
  if (__ss.scanTimer != null){
    try{ clearInterval(__ss.scanTimer); }catch(e2){}
    __ss.scanTimer = null;
  }
}

function mount(el){
  if (!el) return;
  clearSyncTimer();
  try{ injectStyles(); }catch(e0){}
  el.innerHTML = [
    '<section class="hg-tab hg-super-setup hg-idle">',
    '  <div class="hg-super-head">',
    '    <div>',
    '      <div class="hg-title">Super Setup</div>',
    '      <div class="hg-note">Minimal-loss: 7/7 gates + house audit + external feeds + FQS + meta-label + DVOL + post-gate (flow/BTC RS).</div>',
    '    </div>',
    '    <div class="hg-super-badge">Super Setup v2.3.0</div>',
    '  </div>',
    '  <div id="ss-validation"></div>',
    '  <div class="hg-idle-banner" id="ss-idle">Scanning Delta + CoinDCX universe…</div>',
    '  <div class="hg-super-grid">',
    '    <div class="hg-card"><h3>Universe Desk · Delta + CoinDCX</h3>',
    '      <div class="hg-scan-stat" id="ss-scan-stat">Next scan on tab open · 15 min cycle</div>',
    '      <div class="hg-actions" style="margin-top:8px">',
    '        <button type="button" class="hg-btn primary" id="ss-run-scan">Scan all contracts now</button>',
    '      </div>',
    '      <div class="hg-desk" id="ss-desk" style="margin-top:12px"></div>',
    '      <div id="ss-vision" style="margin-top:10px"></div>',
    '    </div>',
    '    <div class="hg-card"><h3>Trade Context</h3><div class="hg-form">',
    '      <div class="hg-field"><label for="ss-symbol">Symbol</label><input id="ss-symbol" value="—" readonly /></div>',
    '      <div class="hg-field"><label for="ss-side">Direction</label><select id="ss-side" disabled><option>—</option><option>Long</option><option>Short</option></select></div>',
    '      <div class="hg-field"><label for="ss-tf">Timeframe</label><input id="ss-tf" value="—" readonly /></div>',
    '      <div class="hg-field"><label for="ss-setup">Setup Type</label><input id="ss-setup" value="—" readonly /></div>',
    '    </div></div>',
    '    <div class="hg-card"><h3>Inputs</h3><div class="hg-form">',
    '      <div class="hg-field"><label for="ss-balance">Account Balance</label><input id="ss-balance" type="number" value="1000" step="0.01" /></div>',
    '      <div class="hg-field"><label for="ss-risk">Risk % per Trade</label><input id="ss-risk" type="number" value="1" step="0.01" /></div>',
    '      <div class="hg-field hg-trade-field"><label for="ss-entry">Entry Price</label><input id="ss-entry" type="number" value="" placeholder="—" step="0.00000001" readonly /></div>',
    '      <div class="hg-field hg-trade-field"><label for="ss-stop">Stop Loss</label><input id="ss-stop" type="number" value="" placeholder="—" step="0.00000001" readonly /></div>',
    '      <div class="hg-field hg-trade-field"><label for="ss-rr">Take Profit RR</label><input id="ss-rr" type="number" value="2" step="0.1" readonly /></div>',
    '      <div class="hg-field hg-trade-field"><label for="ss-entry-type">Entry Type</label><input id="ss-entry-type" value="—" readonly /></div>',
    '      <div class="hg-field"><label for="ss-lev">Max Leverage (cap)</label><input id="ss-lev" type="number" value="5" step="0.1" /></div>',
    '      <div class="hg-field"><label for="ss-safe-lev">Max Safe Leverage</label><input id="ss-safe-lev" value="—" readonly /></div>',
    '    </div></div>',
    '    <div class="hg-card"><h3>Live Structure / Scanner Sync</h3>',
    '      <div class="hg-sync" id="ss-sync">Scanning Hardgate desks for CLEAN tickets and chart structure…</div>',
    '      <div id="ss-trigger-wrap"></div>',
    '      <div class="hg-actions">',
    '        <button type="button" class="hg-btn secondary" id="ss-use-chart" disabled>Use live chart structure</button>',
    '        <button type="button" class="hg-btn secondary" id="ss-use-scan" disabled>Use scanner output</button>',
    '        <button type="button" class="hg-btn primary" id="ss-calc" disabled>Calculate</button>',
    '      </div>',
    '    </div>',
    '    <div class="hg-card"><h3>Outputs</h3><div class="hg-out">',
    '      <div class="hg-metric"><div class="k">Risk $</div><div class="v" id="o-risk">$—</div></div>',
    '      <div class="hg-metric"><div class="k">Position Size</div><div class="v" id="o-size">—</div></div>',
    '      <div class="hg-metric"><div class="k">Implied Leverage</div><div class="v" id="o-lev">—</div></div>',
    '      <div class="hg-metric"><div class="k">Take Profit T1</div><div class="v" id="o-tp">—</div></div>',
    '      <div class="hg-metric"><div class="k">Take Profit T2</div><div class="v" id="o-tp2">—</div></div>',
    '      <div class="hg-metric"><div class="k">Max Safe Lev</div><div class="v" id="o-safe-lev">—</div></div>',
    '      <div class="hg-metric"><div class="k">RR</div><div class="v" id="o-rr">—</div></div>',
    '      <div class="hg-metric"><div class="k">Status</div><div class="v hg-wait" id="o-status">IDLE</div></div>',
    '    </div>',
    '      <div class="hg-note" id="ss-guidance" style="margin-top:10px"></div>',
    '      <div class="hg-actions" style="margin-top:10px">',
    '        <button type="button" class="hg-btn primary" id="ss-send-trade" disabled>Send to Trade Plan</button>',
    '      </div>',
    '      <div style="margin-top:10px" id="ss-scorecard-wrap"></div>',
      '      <div class="hg-note" id="ss-note" style="margin-top:10px">MIN LOSS PASS = CLEAN 7/7 + house + external + FQS floor + meta-label + DVOL + post-gate flow/BTC RS.</div>',
    '    </div>',
    '  </div>',
    '</section>'
  ].join('\n');

  var root = el.querySelector('.hg-super-setup') || el;
  __ss.root = root;
  __ss.lastKey = '';

  function $(id){ return root.querySelector(id); }

  function setIdleBanner(text){
    var idleEl = $('#ss-idle');
    if (idleEl) idleEl.textContent = text || 'IDLE — waiting for tradeable structure.';
  }

  function setTriggerChip(ev){
    var wrap = $('#ss-trigger-wrap');
    if (!wrap) return;
    if (!ev || !ev.ready){
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = '<span class="hg-trigger">' + String(ev.trigger || 'setup').toUpperCase()
      + ' · ' + String(ev.mode || '').toUpperCase() + '</span>';
  }

  function clearTradeFields(){
    __ss.selectedHit = null;
    if ($('#ss-entry')){ $('#ss-entry').value = ''; }
    if ($('#ss-stop')){ $('#ss-stop').value = ''; }
    if ($('#ss-symbol')){ $('#ss-symbol').value = '—'; }
    if ($('#ss-tf')){ $('#ss-tf').value = '—'; }
    if ($('#ss-setup')){ $('#ss-setup').value = '—'; }
    if ($('#ss-entry-type')){ $('#ss-entry-type').value = '—'; }
    if ($('#ss-safe-lev')){ $('#ss-safe-lev').value = '—'; }
    if ($('#ss-side')){
      $('#ss-side').value = '—';
      $('#ss-side').disabled = true;
    }
    ['#o-risk', '#o-size', '#o-lev', '#o-tp', '#o-tp2', '#o-safe-lev', '#o-rr'].forEach(function(sel){
      var el0 = $(sel);
      if (el0) el0.textContent = sel === '#o-risk' ? '$—' : '—';
    });
    if ($('#ss-guidance')) $('#ss-guidance').textContent = '';
    if ($('#ss-send-trade')){
      $('#ss-send-trade').disabled = true;
      $('#ss-send-trade').onclick = null;
    }
    if ($('#o-status')){
      $('#o-status').textContent = 'IDLE';
      $('#o-status').className = 'v hg-wait';
    }
    root.classList.add('hg-idle');
    if ($('#ss-use-chart')) $('#ss-use-chart').disabled = true;
    if ($('#ss-use-scan')) $('#ss-use-scan').disabled = true;
    if ($('#ss-calc')) $('#ss-calc').disabled = true;
    setTriggerChip(null);
  }

  function wireSendTrade(ev, hit){
    var btn = $('#ss-send-trade');
    if (!btn) return;
    hit = hit || __ss.selectedHit;
    var canSend = !!(ev && ev.ready && hit && hit.minimalLossPass && N(hit.entry) > 0 && N(hit.stop) > 0);
    btn.disabled = !canSend;
    if (!canSend){
      btn.onclick = null;
      return;
    }
    var sym = ev.sym || hit.sym;
    var dir = String(ev.side || hit.dir || '').toLowerCase();
    if (dir === 'long') dir = 'long';
    else if (dir === 'short') dir = 'short';
    else dir = (ev.side === 'Long') ? 'long' : 'short';
    var t1 = N(hit.t1) > 0 ? hit.t1 : (N(hit.tp) > 0 ? hit.tp : ev.t1);
    btn.onclick = function(){
      if (typeof W.hgToTradePlan === 'function'){
        W.hgToTradePlan(sym, dir, hit.entry, hit.stop, t1, {
          t2: hit.t2 || null,
          stack: hit.stack || null,
          scanner: 'super-setup',
          strategy: hit.scanner || 'super-setup',
          venue: hit.venueTag || null,
          source: 'super-setup'
        });
      } else if (typeof W.toTrade === 'function'){
        W.toTrade(sym, dir, hit.entry, hit.stop, t1, hit.t2);
      }
    };
  }

  function applyEvaluation(ev){
    if (!ev || !ev.ready){
      clearTradeFields();
      setIdleBanner(ev && ev.reason ? ('IDLE — ' + ev.reason) : 'IDLE — no structure or CLEAN scanner signal yet.');
      if ($('#ss-note')){
        $('#ss-note').textContent = (ev && ev.reason) ? ev.reason : 'No structure, no setup. No stop, no setup.';
      }
      __ss.lastKey = '';
      return null;
    }

    __ss.selectedHit = ev.hit || null;
    root.classList.remove('hg-idle');
    if ($('#ss-side')){
      $('#ss-side').disabled = false;
      $('#ss-side').value = ev.side || 'Long';
    }
    if (ev.sym && $('#ss-symbol')) $('#ss-symbol').value = String(ev.sym);
    if (ev.tf && $('#ss-tf')) $('#ss-tf').value = String(ev.tf);
    if ($('#ss-setup')) $('#ss-setup').value = ev.setupType || ('Super Setup · ' + (ev.trigger || ''));
    if ($('#ss-entry')) $('#ss-entry').value = ev.entry;
    if ($('#ss-stop')) $('#ss-stop').value = ev.stop;
    if ($('#ss-rr') && Number.isFinite(ev.rr)) $('#ss-rr').value = ev.rr;
    if ($('#ss-entry-type')){
      $('#ss-entry-type').value = ev.entryType
        ? String(ev.entryType).toUpperCase() + (ev.refined ? ' · refined' : '')
        : (ev.refined ? 'REFINED' : '—');
    }
    if ($('#ss-safe-lev')){
      $('#ss-safe-lev').value = Number.isFinite(ev.safeMaxLev) ? (fmt(ev.safeMaxLev, 0) + 'x') : '—';
    }
    if ($('#ss-guidance')){
      var guide = ev.entryGuidance || '';
      if (ev.minLossAudit && ev.minLossAudit.pass){
        guide = (guide ? guide + ' · ' : '') + 'Audit: ' + ev.minLossAudit.layerSummary;
      } else if (ev.minLossAudit && ev.minLossAudit.reasons && ev.minLossAudit.reasons.length){
        guide = (guide ? guide + ' · ' : '') + 'Hold: ' + ev.minLossAudit.reasons.slice(0, 2).join(' · ');
      }
      $('#ss-guidance').textContent = guide;
    }

    if ($('#ss-use-chart')) $('#ss-use-chart').disabled = (ev.mode !== 'structure');
    if ($('#ss-use-scan')) $('#ss-use-scan').disabled = (ev.mode !== 'scanner');
    if ($('#ss-calc')) $('#ss-calc').disabled = false;

    setIdleBanner('');
    var idleBanner = $('#ss-idle');
    if (idleBanner){
      idleBanner.textContent = ev.minimalLossPass
        ? ('MINIMAL LOSS PASS — ' + (ev.note || 'tradeable setup'))
        : (ev.watchOnly
          ? ('WATCH ONLY — ' + (ev.note || 'NEAR · not a ticket'))
          : ('ACTIVE — ' + (ev.note || 'CLEAN · audit hold')));
    }
    setTriggerChip(ev);
    __ss.lastKey = setupSignalKey(ev);
    wireSendTrade(ev, __ss.selectedHit);
    return update();
  }

  function setScanStatus(msg){
    var statEl = $('#ss-scan-stat');
    if (statEl && msg) statEl.textContent = msg;
    var idleEl = $('#ss-idle');
    if (idleEl && __ss.scanBusy) idleEl.textContent = msg || 'Scanning…';
  }

  function applyFirstSetup(force){
    var snap = superSetupScan();
    paintDesk(snap);
    var hit = autoSelectFirstSetup(snap);
    if (hit){
      applyEvaluation(hitToEvaluation(hit));
      return;
    }
    tryAutoPopulate(!!force);
  }

  function standDownBanner(){
    if (typeof W.hgStandDownState !== 'function') return '';
    try{
      var recs = typeof W.hgScoreRecords === 'function' ? W.hgScoreRecords() : [];
      var sd = W.hgStandDownState(recs);
      if (sd && sd.tripped){
        return 'STAND DOWN — ' + ((sd.reasons || []).join(' · ') || 'drawdown limit') + ' · no new trades';
      }
    }catch(e){}
    return '';
  }

  function syncFromExistingDesks(){
    var sdNote = standDownBanner();
    if (sdNote){
      var idleEl = $('#ss-idle');
      if (idleEl) idleEl.textContent = sdNote;
    }
    var snap = syncDeskFromExisting(W, readRiskOpts());
    mergePublishSuperSetupSnap(snap);
    paintDesk(superSetupScan());
    applyFirstSetup(true);
    if (typeof applySuperSetupPostGate === 'function'){
      applySuperSetupPostGate(snap, W).then(function(updated){
        mergePublishSuperSetupSnap(updated);
        paintDesk(superSetupScan());
        applyFirstSetup(false);
      }).catch(function(){});
    }
    return superSetupScan();
  }

  function readRiskOpts(){
    var balance = N($('#ss-balance') && $('#ss-balance').value);
    var riskPct = N($('#ss-risk') && $('#ss-risk').value);
    var maxLev = N($('#ss-lev') && $('#ss-lev').value);
    return {
      balance: (Number.isFinite(balance) && balance > 0) ? balance : 1000,
      riskPct: (Number.isFinite(riskPct) && riskPct > 0) ? riskPct : 1,
      maxLeverage: (Number.isFinite(maxLev) && maxLev > 0) ? maxLev : 5,
      feePct: 0.06,
      slipPct: 0.05
    };
  }

  function hitToEvaluation(hit){
    if (!hit || !isCleanScannerHit(hit)) return { ready: false, idle: true, reason: 'No qualifying setup' };
    var rr = pickRR(hit);
    if (N(hit.t1) > 0 && N(hit.entry) > 0 && N(hit.stop) > 0){
      var rd = Math.abs(hit.entry - hit.stop);
      if (rd > 0) rr = Math.abs(hit.t1 - hit.entry) / rd;
    }
    var labels = scannerReadyNote(hit);
    return {
      ready: true,
      idle: false,
      mode: 'scanner',
      trigger: hit.trigger || hit.tier || 'clean',
      source: hit.source || 'universe',
      side: normalizeSide(hit.dir),
      sym: hit.sym,
      tf: hit.scanner || '4h',
      entry: hit.entry,
      stop: hit.stop,
      t1: hit.t1,
      t2: hit.t2,
      rr: rr,
      entryType: hit.entryType,
      entryGuidance: hit.entryGuidance,
      safeMaxLev: hit.safeMaxLev,
      minimalLossPass: hit.minimalLossPass,
      minLossAudit: hit.minLossAudit,
      refined: hit.refined,
      watchOnly: labels.watchOnly,
      setupType: labels.tierLabel + ' · ' + (hit.scanner || 'swing')
        + (hit.refined ? ' · exact entry' : ''),
      note: labels.note,
      hit: hit
    };
  }

  function paintDesk(snap){
    var valEl = $('#ss-validation');
    if (valEl && typeof W.hgSuperDeskValidationHtml === 'function'){
      valEl.innerHTML = W.hgSuperDeskValidationHtml(W);
    }
    var scWrap = $('#ss-scorecard-wrap');
    if (scWrap && typeof W.hgSuperDeskScorecardLink === 'function'){
      scWrap.innerHTML = W.hgSuperDeskScorecardLink('super-setup');
      if (typeof W.hgSuperDeskBindScorecard === 'function') W.hgSuperDeskBindScorecard(scWrap);
    }
    snap = snap || superSetupScan();
    var desk = $('#ss-desk');
    var statEl = $('#ss-scan-stat');
    if (statEl){
      var when = snap && snap.scanAt ? new Date(snap.scanAt).toLocaleTimeString() : '—';
      statEl.textContent = (snap && snap.stat ? snap.stat : 'No scan yet')
        + ' · last scan ' + when + ' · refresh every 15 min';
    }
    if (!desk) return;
    var rows = (snap && Array.isArray(snap.cands)) ? snap.cands : [];
    if (!rows.length){
      desk.innerHTML = '<div class="hg-note">No CLEAN or NEAR setups passed the gate on the last full-exchange scan. Standing aside is a position.</div>';
      return;
    }
    var minPass = rows.filter(function(r){ return r.minimalLossPass; }).length;
    var nearWatch = rows.filter(function(r){ return r.nearWatch; }).length;
    var deskHint = minPass
      ? ('<div class="hg-note" style="margin-bottom:10px">' + minPass + ' MIN LOSS PASS · trade-ready CLEAN 7/7</div>')
      : ('<div class="hg-note" style="margin-bottom:10px">No CLEAN 7/7 yet'
        + (nearWatch ? (' · ' + nearWatch + ' NEAR 6/7 on watch (Trade Plan when 7/7 confirms)') : '')
        + '</div>');
    desk.innerHTML = deskHint + rows.map(function(r){
      var tier = (r.tier === 'near' || r.nearClean) ? 'near' : 'clean';
      var tierLbl = tier === 'near' ? ('NEAR ' + (r.gatesPassed || 6) + '/7') : 'CLEAN 7/7';
      var pill = superSetupDeskPill(r);
      var riskPill = '<span class="hg-pill ' + pill.cls + '">' + pill.label + '</span>';
      var refinePill = r.refined ? '<span class="hg-pill refined">' + String(r.entryType || 'EXACT').toUpperCase() + '</span>' : '';
      var sel = (__ss.selectedId === r.id) ? ' sel' : '';
      return '<div class="hg-desk-card' + sel + '" data-id="' + String(r.id).replace(/"/g, '') + '">'
        + '<div class="hg-desk-top"><div class="hg-desk-sym">' + String(r.sym || '—') + ' · '
        + String(r.dir || '').toUpperCase() + '</div>'
        + '<div class="hg-desk-pills"><span class="hg-pill ' + tier + '">' + tierLbl + '</span>'
        + refinePill
        + '<span class="hg-pill">' + String(r.venueTag || r.scanner || 'venue') + '</span>' + riskPill + '</div></div>'
        + '<div class="hg-desk-levels">'
        + '<div><div class="k">ENTRY</div><div class="v">' + fmt(r.entry, 8) + '</div></div>'
        + '<div><div class="k">STOP</div><div class="v">' + fmt(r.stop, 8) + '</div></div>'
        + '<div><div class="k">T1</div><div class="v">' + fmt(r.tp, 8) + '</div></div>'
        + '<div><div class="k">T2</div><div class="v">' + fmt(r.tp2, 8) + '</div></div>'
        + '<div><div class="k">IMPL LEV</div><div class="v">' + fmt(r.impliedLev, 2) + 'x</div></div>'
        + '<div><div class="k">SAFE MAX</div><div class="v">' + (Number.isFinite(r.safeMaxLev) ? fmt(r.safeMaxLev, 0) + 'x' : '—') + '</div></div>'
        + '</div></div>';
    }).join('');
    desk.querySelectorAll('.hg-desk-card').forEach(function(card){
      card.addEventListener('click', function(){
        var id = card.getAttribute('data-id');
        __ss.selectedId = id;
        desk.querySelectorAll('.hg-desk-card').forEach(function(c){ c.classList.remove('sel'); });
        card.classList.add('sel');
        var hit = rows.find(function(r){ return r.id === id; });
        if (hit) applyEvaluation(hitToEvaluation(hit));
      });
    });
    if (typeof W.hgSuperDeskEnrichChartVision === 'function'){
      W.hgSuperDeskEnrichChartVision(rows, {
        style: 'super-setup', cleanOnly: true, limit: 6,
        repaint: function(){
          var vEl = $('#ss-vision');
          var sel = rows.find(function(r){ return r.id === __ss.selectedId; }) || rows[0];
          if (vEl && sel && typeof W.hgSuperDeskVisionBlock === 'function'){
            vEl.innerHTML = W.hgSuperDeskVisionBlock(sel) || '';
          }
        }
      });
    }
  }

  function syncText(ev){
    var chart = getChartContext();
    var parts = [];
    if (Number.isFinite(chart.lastPrice)) parts.push('Chart last: ' + chart.lastPrice);
    if (Number.isFinite(chart.ema21) && Number.isFinite(chart.ema50)){
      parts.push('EMA21/50: ' + chart.ema21 + ' / ' + chart.ema50);
    }
    if (Number.isFinite(chart.swingHigh) || Number.isFinite(chart.swingLow)){
      parts.push('Swings: ' + fmt(chart.swingHigh, 8) + ' / ' + fmt(chart.swingLow, 8));
    }
    var snap = superSetupScan();
    if (snap && Array.isArray(snap.cands) && snap.cands.length){
      parts.push('Desk: ' + snap.cands.length + ' setups');
    }
    if (ev && ev.ready) parts.push('Gate: OPEN · ' + ev.trigger);
    else parts.push('Gate: CLOSED');
    var syncEl = $('#ss-sync');
    if (syncEl) syncEl.textContent = parts.join(' | ');
  }

  function tryAutoPopulate(force){
    var snap = superSetupScan();
    if (!__ss.selectedId && snap && snap.cands && snap.cands.length){
      __ss.selectedId = snap.cands[0].id;
    }
    var ev = evaluateSetup(W, { selectedId: __ss.selectedId });
    syncText(ev);
    var key = setupSignalKey(ev);
    if (!ev.ready){
      if (force || __ss.lastKey) applyEvaluation(ev);
      return ev;
    }
    if (force || key !== __ss.lastKey) applyEvaluation(ev);
    else update();
    return ev;
  }

  function fillFromSource(source){
    if (source === 'scan'){
      var hits = collectScanHits();
      if (!hits.length || !isCleanScannerHit(hits[0])){
        applyEvaluation({ ready: false, idle: true, reason: 'No CLEAN scanner confirmation' });
        return;
      }
      applyEvaluation(evaluateSetup(W, {}));
      return;
    }
    var side = ($('#ss-side') && $('#ss-side').value !== '—') ? $('#ss-side').value : null;
    var chart = getChartContext();
    var rows = chart.rows || null;
    var struct = evaluateStructureTrigger(W, side || 'Long', rows, chart);
    if (!struct.valid){
      applyEvaluation({ ready: false, idle: true, reason: struct.reason });
      return;
    }
    applyEvaluation({
      ready: true,
      mode: 'structure',
      trigger: struct.trigger,
      side: side || (chart.ema21 > chart.ema50 ? 'Long' : 'Short'),
      entry: struct.entry,
      stop: struct.stop,
      rr: pickRR(null),
      setupType: 'Structure · ' + struct.trigger,
      note: struct.note
    });
  }

  function update(){
    var entryVal = $('#ss-entry') && $('#ss-entry').value;
    var stopVal = $('#ss-stop') && $('#ss-stop').value;
    if (!entryVal || !stopVal){
      return { ok: false, reason: 'Waiting for setup' };
    }
    var hit = __ss.selectedHit;
    var userLev = N($('#ss-lev') && $('#ss-lev').value);
    var safeLev = hit && Number.isFinite(hit.safeMaxLev) ? hit.safeMaxLev : calcSafeMaxLeverage(entryVal, stopVal);
    var capLev = Number.isFinite(safeLev) ? Math.min(userLev, safeLev) : userLev;
    var tpPrice = hit && N(hit.t1) > 0 ? hit.t1 : (hit && N(hit.tp) > 0 ? hit.tp : null);
    var rrVal = $('#ss-rr') && $('#ss-rr').value;
    if (tpPrice && N(entryVal) > 0 && N(stopVal) > 0){
      var sd = Math.abs(N(entryVal) - N(stopVal));
      if (sd > 0) rrVal = Math.abs(tpPrice - N(entryVal)) / sd;
    }
    var res = calcTrade({
      balance: $('#ss-balance') && $('#ss-balance').value,
      riskPct: $('#ss-risk') && $('#ss-risk').value,
      entry: entryVal,
      stop: stopVal,
      rr: rrVal,
      tpPrice: tpPrice,
      maxLeverage: capLev,
      feePct: 0.06,
      slipPct: 0.05
    });
    var hasNums = res && (res.ok || Number.isFinite(res.riskDollars));
    if ($('#o-risk')) $('#o-risk').textContent = hasNums ? ('$' + fmt(res.riskDollars, 2)) : '$—';
    if ($('#o-size')) $('#o-size').textContent = hasNums && Number.isFinite(res.positionUnits) ? fmt(res.positionUnits, 6) : '—';
    if ($('#o-lev')) $('#o-lev').textContent = hasNums && Number.isFinite(res.impliedLeverage) ? (fmt(res.impliedLeverage, 2) + 'x') : '—';
    if ($('#o-tp')) $('#o-tp').textContent = hasNums && Number.isFinite(res.tp) ? fmt(res.tp, 8) : '—';
    if ($('#o-tp2')) $('#o-tp2').textContent = hit && Number.isFinite(hit.t2) ? fmt(hit.t2, 8) : '—';
    if ($('#o-safe-lev')) $('#o-safe-lev').textContent = Number.isFinite(safeLev) ? (fmt(safeLev, 0) + 'x') : '—';
    if ($('#o-rr')) $('#o-rr').textContent = hasNums && Number.isFinite(res.rr) ? ('1:' + fmt(res.rr, 2)) : '—';
    var minLoss = hit && hit.minimalLossPass;
    var nearWatch = hit && hit.nearWatch && !minLoss;
    var sizingOk = res.ok && hit && (hit.sizingPass || minLoss);
    if ($('#o-status')){
      if (minLoss){
        $('#o-status').textContent = 'MIN LOSS PASS';
        $('#o-status').className = 'v hg-pass';
      } else if (nearWatch){
        $('#o-status').textContent = 'NEAR WATCH';
        $('#o-status').className = 'v hg-wait';
      } else if (sizingOk){
        $('#o-status').textContent = 'PASS';
        $('#o-status').className = 'v hg-pass';
      } else {
        $('#o-status').textContent = 'BLOCK: ' + (res.reason || (hit && hit.riskReason) || 'failed checks');
        $('#o-status').className = 'v hg-fail';
      }
    }
    if ($('#ss-note')){
      if (minLoss){
        $('#ss-note').textContent = 'CLEAN 7/7 · shield pass · implied leverage within safe max — ready for Trade Plan.';
      } else if (nearWatch){
        $('#ss-note').textContent = 'NEAR 6/7 — watch list. Levels shown; Trade Plan opens only on CLEAN 7/7 + full audit pass.';
      } else if (hit && hit.tier === 'clean' && hit.minLossAudit && !hit.minLossAudit.pass){
        $('#ss-note').textContent = 'CLEAN 7/7 but audit hold: ' + (hit.minLossAudit.reasons || []).slice(0, 2).join(' · ') + '.';
      } else if (sizingOk){
        $('#ss-note').textContent = 'Setup passes sizing checks.';
      } else {
        $('#ss-note').textContent = 'Setup blocked: ' + (res.reason || (hit && hit.riskReason) || 'failed checks') + '.';
      }
    }
    if (__ss.lastKey && hit){
      wireSendTrade({ ready: true, sym: hit.sym, side: normalizeSide(hit.dir) }, hit);
    }
    return res;
  }

  root.querySelectorAll('#ss-balance,#ss-risk,#ss-lev').forEach(function(inp){
    inp.addEventListener('input', function(){
      W.__ssDefaultBalance = N($('#ss-balance') && $('#ss-balance').value);
      W.__ssDefaultRiskPct = N($('#ss-risk') && $('#ss-risk').value);
      W.__ssDefaultMaxLev = N($('#ss-lev') && $('#ss-lev').value);
      var snap = buildSnapFromCryptoScans(W, readRiskOpts());
      mergePublishSuperSetupSnap(snap);
      paintDesk(superSetupScan());
      if (__ss.lastKey) update();
    });
  });
  var runScanBtn = $('#ss-run-scan');
  if (runScanBtn) runScanBtn.addEventListener('click', function(){
    runScanBtn.disabled = true;
    runScanBtn.textContent = 'Scanning…';
    superSetupRunScan({ force: true, riskOpts: readRiskOpts() }).then(function(msg){
      runScanBtn.disabled = false;
      runScanBtn.textContent = 'Scan all contracts now';
      setScanStatus(String(msg) + ' · ' + ((superSetupScan() && superSetupScan().stat) || ''));
    });
  });
  var calcBtn = $('#ss-calc');
  if (calcBtn) calcBtn.addEventListener('click', update);
  var chartBtn = $('#ss-use-chart');
  if (chartBtn) chartBtn.addEventListener('click', function(){ fillFromSource('chart'); });
  var useScanBtn = $('#ss-use-scan');
  if (useScanBtn) useScanBtn.addEventListener('click', function(){ fillFromSource('scan'); });

  __ss.mounted = true;
  __ss.paintDesk = paintDesk;
  __ss.setScanStatus = setScanStatus;
  __ss.applyFirstSetup = applyFirstSetup;
  __ss.update = function(){
    syncFromExistingDesks();
    return tryAutoPopulate(true);
  };
  __ss.fillFromSource = fillFromSource;
  __ss.tryAutoPopulate = tryAutoPopulate;
  __ss.syncFromExistingDesks = syncFromExistingDesks;

  syncFromExistingDesks();
  superSetupRunScan({ riskOpts: readRiskOpts() }).then(function(msg){
    setScanStatus(String(msg) + ' · ' + ((superSetupScan() && superSetupScan().stat) || ''));
    applyFirstSetup(true);
  });

  __ss.syncTimer = setInterval(function(){
    try{
      var snap = buildSnapFromCryptoScans(W, readRiskOpts(), { allowStale: true });
      snap.scanAt = (__ss.lastScanAt || (superSetupScan() && superSetupScan().scanAt) || snap.at);
      mergePublishSuperSetupSnap(snap);
      if (__ss.mounted && typeof __ss.paintDesk === 'function') __ss.paintDesk(superSetupScan());
      tryAutoPopulate(false);
    }catch(e){}
  }, SYNC_MS);

  __ss.scanTimer = setInterval(function(){
    try{
      if (!__ss.scanBusy) superSetupRunScan({ riskOpts: readRiskOpts() });
    }catch(e2){}
  }, SCAN_INTERVAL_MS);
}

async function superSetupRefresh(){
  try{
    if (__ss.mounted && typeof __ss.syncFromExistingDesks === 'function'){
      __ss.syncFromExistingDesks();
    } else if (typeof syncDeskFromExisting === 'function'){
      syncDeskFromExisting(W, defaultRiskOpts());
    }
    var stale = !__ss.lastScanAt || (Date.now() - __ss.lastScanAt) >= SCAN_INTERVAL_MS;
    if (stale) await superSetupRunScan({ force: true });
    if (!__ss.mounted || typeof __ss.update !== 'function') return stale ? 'scanned' : 'skipped: not run yet';
    __ss.update();
    if (__ss.mounted && typeof __ss.paintDesk === 'function') __ss.paintDesk(superSetupScan());
    return stale ? 'scanned+refreshed' : 'refreshed';
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }
}

function superSetupRepaint(){
  if (!__ss.mounted) return;
  var snap = superSetupScan();
  if (!snap || !snap.cands || !snap.cands.length){
    snap = syncDeskFromExisting(W, defaultRiskOpts());
    mergePublishSuperSetupSnap(snap);
    snap = superSetupScan();
  }
  if (typeof __ss.paintDesk === 'function') __ss.paintDesk(snap);
  if (typeof __ss.applyFirstSetup === 'function') __ss.applyFirstSetup(false);
}

W.superSetupCalc = calcTrade;
W.calcTrade = calcTrade;
W.superSetupDeskPill = superSetupDeskPill;
W.runMinimalLossAudit = runMinimalLossAudit;
W.runExternalSourceAudit = runExternalSourceAudit;
W.runFullMinimalLossAudit = runFullMinimalLossAudit;
W.superSetupFqsGate = superSetupFqsGate;
W.runPrecisionSourceAudit = runPrecisionSourceAudit;
W.applySuperSetupPostGate = applySuperSetupPostGate;
W.superSetupSortCands = superSetupSortCands;
W.superSetupSymBase = superSetupSymBase;
W.calcSafeMaxLeverage = calcSafeMaxLeverage;
W.refineSuperSetupLevels = refineSuperSetupLevels;
W.superSetupSafeJson = safeJson;
W.superSetupGetScannerContext = getScannerContext;
W.superSetupGetChartContext = getChartContext;
W.superSetupPickEntry = pickEntry;
W.superSetupPickStop = pickStop;
W.superSetupPickRR = pickRR;
W.superSetupCollectScanHits = collectScanHits;
W.superSetupEvaluateStructure = evaluateStructureTrigger;
W.superSetupEvaluate = evaluateSetup;
W.superSetupScannerNote = scannerReadyNote;
W.superSetupEnrichRow = enrichSuperSetupRow;
W.mergePublishSuperSetupSnap = mergePublishSuperSetupSnap;
W.superSetupBuildSnap = buildSnapFromCryptoScans;
W.superSetupSyncDesk = syncDeskFromExisting;
W.superSetupRepaint = superSetupRepaint;
W.superSetupScan = superSetupScan;
W.superSetupRunScan = superSetupRunScan;
W.superSetupWarm = superSetupWarm;
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'super-setup', label: 'SUPER SETUP', run: superSetupWarm });
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({
  id: TAB_ID,
  label: 'SUPER SETUP',
  title: 'Super Setup',
  mount: mount,
  refresh: superSetupRefresh
});

})();
