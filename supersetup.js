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
var SCAN_INTERVAL_MS = 15 * 60 * 1000;
var SNAP_MAX_MS = SCAN_INTERVAL_MS + 5 * 60 * 1000;
var STRUCT_MAX_BARS = 20;
var __hgSuperSetupSnap = null;
var __ss = {
  mounted: false, update: null, syncTimer: null, scanTimer: null,
  root: null, lastKey: '', selectedId: null, scanBusy: false, lastScanAt: 0
};

function N(v){ return Number(v); }

function fmt(n, d){
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
  riskOpts = riskOpts || defaultRiskOpts();
  var calc = calcTrade({
    balance: riskOpts.balance,
    riskPct: riskOpts.riskPct,
    entry: hit.entry,
    stop: hit.stop,
    rr: pickRR(hit),
    maxLeverage: riskOpts.maxLeverage,
    feePct: riskOpts.feePct,
    slipPct: riskOpts.slipPct
  });
  hit.id = hit.id || c.id || [hit.sym, hit.dir, hit.entry, hit.stop, tier].join('|');
  hit.scanner = meta.scanner || meta.source || 'swing';
  hit.riskPass = calc.ok;
  hit.riskReason = calc.reason;
  hit.calc = calc;
  hit.tp = calc.tp;
  hit.qty = calc.qty;
  hit.impliedLev = calc.impliedLev;
  hit.missing = Array.isArray(c.missing) ? c.missing.slice() : [];
  return hit;
}

function buildSnapFromCryptoScans(win, riskOpts){
  win = win || W;
  riskOpts = riskOpts || defaultRiskOpts(win);
  var merged = [];
  var scanned = 0;
  var audit = { clean: 0, near: 0, riskPass: 0, uniLen: 0, venues: [] };

  function absorbSnap(snap, scanner){
    if (!snap || !isFreshAt(snap.at, SNAP_MAX_MS)) return;
    scanned = Math.max(scanned, snap.at || 0);
    if (snap.audit && isFinite(snap.audit.uniLen)) audit.uniLen += snap.audit.uniLen;
    (snap.cands || []).forEach(function(c){
      var row = enrichSuperSetupRow(c, 'clean', riskOpts, { source: 'universe', scanner: scanner, at: snap.at });
      if (row){ merged.push(row); audit.clean++; if (row.riskPass) audit.riskPass++; }
    });
    (snap.nearCands || []).forEach(function(c){
      var row = enrichSuperSetupRow(c, 'near', riskOpts, { source: 'universe', scanner: scanner, at: snap.at });
      if (row){ merged.push(row); audit.near++; if (row.riskPass) audit.riskPass++; }
    });
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
  merged.sort(function(a, b){
    var ar = a.riskPass ? 1 : 0, br = b.riskPass ? 1 : 0;
    if (br !== ar) return br - ar;
    var ac = a.tier === 'clean' ? 1 : 0, bc = b.tier === 'clean' ? 1 : 0;
    if (bc !== ac) return bc - ac;
    return (N(b.rr) || 0) - (N(a.rr) || 0);
  });

  return {
    at: scanned || Date.now(),
    cands: merged,
    audit: audit,
    stat: merged.length
      ? (merged.length + ' setups · ' + audit.clean + ' CLEAN · ' + audit.near + ' NEAR · '
        + audit.riskPass + ' risk PASS · Delta + CoinDCX universe')
      : '0 setups — no CLEAN/NEAR tickets in latest universe scan'
  };
}

function publishSuperSetupSnap(snap){
  __hgSuperSetupSnap = snap || null;
  try{ W.HG_superSetupScan = snap; }catch(e){}
  return snap;
}

function superSetupScan(){
  return __hgSuperSetupSnap;
}

async function superSetupRunScan(opts){
  opts = opts || {};
  if (__ss.scanBusy && !opts.force) return 'busy';
  __ss.scanBusy = true;
  try{
    var warm = W.cryptoScanWarm;
    if (typeof warm === 'function'){
      await warm('swing');
      if (opts.includeScalp !== false) await warm('scalp');
    }
    var riskOpts = opts.riskOpts || defaultRiskOpts(W);
    var snap = buildSnapFromCryptoScans(W, riskOpts);
    snap.scanAt = Date.now();
    publishSuperSetupSnap(snap);
    __ss.lastScanAt = snap.scanAt;
    if (__ss.mounted && typeof __ss.paintDesk === 'function') __ss.paintDesk(snap);
    if (__ss.mounted && typeof __ss.tryAutoPopulate === 'function') __ss.tryAutoPopulate(false);
    return snap.cands.length ? ('ok · ' + snap.cands.length + ' setups') : 'ok · 0 setups';
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }finally{
    __ss.scanBusy = false;
  }
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
      if (ss && isFreshAt(ss.at || ss.scanAt, SNAP_MAX_MS) && Array.isArray(ss.cands)){
        ss.cands.forEach(function(c){ push(c); });
      }
    }catch(eSs){}
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
      if (hits[i] && hits[i].tier === 'clean' && hits[i].riskPass !== false){ hit = hits[i]; break; }
    }
  }
  if (!hit && hits.length) hit = hits[0];

  if (isCleanScannerHit(hit)){
    var scanSide = normalizeSide(hit.dir);
    var tierLabel = (hit.tier === 'near' || hit.nearClean) ? 'NEAR' : 'CLEAN';
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
      rr: pickRR(hit),
      setupType: tierLabel + ' · ' + (hit.scanner || hit.source || 'scanner'),
      note: tierLabel + ' ticket · ' + (hit.sym || '') + ' · ' + (hit.venueTag || 'Delta/CoinDCX')
        + (hit.riskPass === false ? (' · risk ' + (hit.riskReason || 'BLOCK')) : '')
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
  var tp = entry > stop ? entry + stopDist * tpRR : entry - stopDist * tpRR;
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
    '.hg-super-setup .hg-pill.block{color:var(--short,#dc2626)}',
    '.hg-super-setup .hg-desk-levels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}',
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
    '      <div class="hg-note">Full Delta + CoinDCX universe scan every 15 min · CLEAN 7/7 + NEAR 6/7 · risk gate on each card.</div>',
    '    </div>',
    '    <div class="hg-super-badge">Super Setup v1.3.0</div>',
    '  </div>',
    '  <div class="hg-idle-banner" id="ss-idle">Scanning Delta + CoinDCX universe…</div>',
    '  <div class="hg-super-grid">',
    '    <div class="hg-card"><h3>Universe Desk · Delta + CoinDCX</h3>',
    '      <div class="hg-scan-stat" id="ss-scan-stat">Next scan on tab open · 15 min cycle</div>',
    '      <div class="hg-actions" style="margin-top:8px">',
    '        <button type="button" class="hg-btn primary" id="ss-run-scan">Scan all contracts now</button>',
    '      </div>',
    '      <div class="hg-desk" id="ss-desk" style="margin-top:12px"></div>',
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
    '      <div class="hg-field"><label for="ss-lev">Max Leverage</label><input id="ss-lev" type="number" value="5" step="0.1" /></div>',
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
    '      <div class="hg-metric"><div class="k">Take Profit</div><div class="v" id="o-tp">—</div></div>',
    '      <div class="hg-metric"><div class="k">RR</div><div class="v" id="o-rr">—</div></div>',
    '      <div class="hg-metric"><div class="k">Status</div><div class="v hg-wait" id="o-status">IDLE</div></div>',
    '    </div>',
    '      <div class="hg-note" id="ss-note" style="margin-top:10px">No structure, no setup. No stop, no setup. Unsafe leverage blocks the trade.</div>',
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
    if ($('#ss-entry')){ $('#ss-entry').value = ''; }
    if ($('#ss-stop')){ $('#ss-stop').value = ''; }
    if ($('#ss-symbol')){ $('#ss-symbol').value = '—'; }
    if ($('#ss-tf')){ $('#ss-tf').value = '—'; }
    if ($('#ss-setup')){ $('#ss-setup').value = '—'; }
    if ($('#ss-side')){
      $('#ss-side').value = '—';
      $('#ss-side').disabled = true;
    }
    ['#o-risk', '#o-size', '#o-lev', '#o-tp', '#o-rr'].forEach(function(sel){
      var el0 = $(sel);
      if (el0) el0.textContent = sel === '#o-risk' ? '$—' : '—';
    });
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

    if ($('#ss-use-chart')) $('#ss-use-chart').disabled = (ev.mode !== 'structure');
    if ($('#ss-use-scan')) $('#ss-use-scan').disabled = (ev.mode !== 'scanner');
    if ($('#ss-calc')) $('#ss-calc').disabled = false;

    setIdleBanner('');
    var idleBanner = $('#ss-idle');
    if (idleBanner) idleBanner.textContent = 'ACTIVE — ' + (ev.note || 'tradeable setup detected');
    setTriggerChip(ev);
    __ss.lastKey = setupSignalKey(ev);
    return update();
  }

  function readRiskOpts(){
    return {
      balance: N($('#ss-balance') && $('#ss-balance').value),
      riskPct: N($('#ss-risk') && $('#ss-risk').value),
      maxLeverage: N($('#ss-lev') && $('#ss-lev').value),
      feePct: 0.06,
      slipPct: 0.05
    };
  }

  function hitToEvaluation(hit){
    if (!hit || !isCleanScannerHit(hit)) return { ready: false, idle: true, reason: 'No qualifying setup' };
    var tierLabel = (hit.tier === 'near' || hit.nearClean) ? 'NEAR' : 'CLEAN';
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
      rr: pickRR(hit),
      setupType: tierLabel + ' · ' + (hit.scanner || 'swing'),
      note: tierLabel + ' · ' + (hit.sym || '') + ' · ' + (hit.venueTag || 'Delta/CoinDCX')
    };
  }

  function paintDesk(snap){
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
    desk.innerHTML = rows.map(function(r){
      var tier = (r.tier === 'near' || r.nearClean) ? 'near' : 'clean';
      var tierLbl = tier === 'near' ? ('NEAR ' + (r.gatesPassed || 6) + '/7') : 'CLEAN 7/7';
      var riskPill = r.riskPass ? '<span class="hg-pill clean">RISK PASS</span>'
        : '<span class="hg-pill block">RISK BLOCK</span>';
      var sel = (__ss.selectedId === r.id) ? ' sel' : '';
      return '<div class="hg-desk-card' + sel + '" data-id="' + String(r.id).replace(/"/g, '') + '">'
        + '<div class="hg-desk-top"><div class="hg-desk-sym">' + String(r.sym || '—') + ' · '
        + String(r.dir || '').toUpperCase() + '</div>'
        + '<div class="hg-desk-pills"><span class="hg-pill ' + tier + '">' + tierLbl + '</span>'
        + '<span class="hg-pill">' + String(r.venueTag || r.scanner || 'venue') + '</span>' + riskPill + '</div></div>'
        + '<div class="hg-desk-levels">'
        + '<div><div class="k">ENTRY</div><div class="v">' + fmt(r.entry, 8) + '</div></div>'
        + '<div><div class="k">STOP</div><div class="v">' + fmt(r.stop, 8) + '</div></div>'
        + '<div><div class="k">TP</div><div class="v">' + fmt(r.tp, 8) + '</div></div>'
        + '<div><div class="k">LEV</div><div class="v">' + fmt(r.impliedLev, 2) + 'x</div></div>'
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
    var res = calcTrade({
      balance: $('#ss-balance') && $('#ss-balance').value,
      riskPct: $('#ss-risk') && $('#ss-risk').value,
      entry: entryVal,
      stop: stopVal,
      rr: $('#ss-rr') && $('#ss-rr').value,
      maxLeverage: $('#ss-lev') && $('#ss-lev').value,
      feePct: 0.06,
      slipPct: 0.05
    });
    var hasNums = res && (res.ok || Number.isFinite(res.riskDollars));
    if ($('#o-risk')) $('#o-risk').textContent = hasNums ? ('$' + fmt(res.riskDollars, 2)) : '$—';
    if ($('#o-size')) $('#o-size').textContent = hasNums && Number.isFinite(res.positionUnits) ? fmt(res.positionUnits, 6) : '—';
    if ($('#o-lev')) $('#o-lev').textContent = hasNums && Number.isFinite(res.impliedLeverage) ? (fmt(res.impliedLeverage, 2) + 'x') : '—';
    if ($('#o-tp')) $('#o-tp').textContent = hasNums && Number.isFinite(res.tp) ? fmt(res.tp, 8) : '—';
    if ($('#o-rr')) $('#o-rr').textContent = hasNums && Number.isFinite(res.rr) ? ('1:' + fmt(res.rr, 2)) : '—';
    if ($('#o-status')){
      $('#o-status').textContent = res.ok ? 'PASS' : ('BLOCK: ' + res.reason);
      $('#o-status').className = 'v ' + (res.ok ? 'hg-pass' : 'hg-fail');
    }
    if ($('#ss-note')){
      $('#ss-note').textContent = res.ok
        ? 'Setup passes all safety checks.'
        : ('Setup blocked: ' + res.reason + '.');
    }
    return res;
  }

  root.querySelectorAll('#ss-balance,#ss-risk,#ss-lev').forEach(function(inp){
    inp.addEventListener('input', function(){
      W.__ssDefaultBalance = N($('#ss-balance') && $('#ss-balance').value);
      W.__ssDefaultRiskPct = N($('#ss-risk') && $('#ss-risk').value);
      W.__ssDefaultMaxLev = N($('#ss-lev') && $('#ss-lev').value);
      var snap = buildSnapFromCryptoScans(W, readRiskOpts());
      publishSuperSetupSnap(Object.assign({}, superSetupScan() || {}, { cands: snap.cands, stat: snap.stat, audit: snap.audit }));
      paintDesk(superSetupScan());
      if (__ss.lastKey) update();
    });
  });
  var scanBtn = $('#ss-run-scan');
  if (scanBtn) scanBtn.addEventListener('click', function(){
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning…';
    superSetupRunScan({ force: true, riskOpts: readRiskOpts() }).then(function(msg){
      scanBtn.disabled = false;
      scanBtn.textContent = 'Scan all contracts now';
      if ($('#ss-scan-stat')) $('#ss-scan-stat').textContent = String(msg) + ' · ' + (superSetupScan() && superSetupScan().stat || '');
    });
  });
  var calcBtn = $('#ss-calc');
  if (calcBtn) calcBtn.addEventListener('click', update);
  var chartBtn = $('#ss-use-chart');
  if (chartBtn) chartBtn.addEventListener('click', function(){ fillFromSource('chart'); });
  var scanBtn = $('#ss-use-scan');
  if (scanBtn) scanBtn.addEventListener('click', function(){ fillFromSource('scan'); });

  __ss.mounted = true;
  __ss.paintDesk = paintDesk;
  __ss.update = function(){
    return tryAutoPopulate(true);
  };
  __ss.fillFromSource = fillFromSource;
  __ss.tryAutoPopulate = tryAutoPopulate;

  paintDesk(superSetupScan());
  superSetupRunScan({ riskOpts: readRiskOpts() }).then(function(){
    tryAutoPopulate(false);
  });

  __ss.syncTimer = setInterval(function(){
    try{ tryAutoPopulate(false); }catch(e){}
  }, SYNC_MS);

  __ss.scanTimer = setInterval(function(){
    try{
      if (!__ss.scanBusy) superSetupRunScan({ riskOpts: readRiskOpts() });
    }catch(e2){}
  }, SCAN_INTERVAL_MS);
}

async function superSetupRefresh(){
  try{
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

W.superSetupCalc = calcTrade;
W.calcTrade = calcTrade;
W.superSetupSafeJson = safeJson;
W.superSetupGetScannerContext = getScannerContext;
W.superSetupGetChartContext = getChartContext;
W.superSetupPickEntry = pickEntry;
W.superSetupPickStop = pickStop;
W.superSetupPickRR = pickRR;
W.superSetupCollectScanHits = collectScanHits;
W.superSetupEvaluateStructure = evaluateStructureTrigger;
W.superSetupEvaluate = evaluateSetup;
W.superSetupEnrichRow = enrichSuperSetupRow;
W.superSetupBuildSnap = buildSnapFromCryptoScans;
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
