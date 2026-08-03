/* HARDGATE — pinegate.js
   Intersect sym+dir pairs for Pine math. Default universe: EDGE tickets (+ REGIME).
   Modes: edge (default) · swing · relaxed · strict (all six scanners).
   Pure exports never throw. */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

function gfn(name){
  try{ if (typeof G[name] === 'function') return G[name]; }catch(e){}
  return null;
}

function pineNormSym(s){
  var x = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (x.length > 4 && x.slice(-4) === 'USDT') return x.slice(0, -4);
  if (x.length > 3 && x.slice(-3) === 'USD') return x.slice(0, -3);
  if (x.length > 4 && x.slice(-4) === 'PERP') return x.slice(0, -4);
  return x;
}

function pairKey(sym, dir){
  return pineNormSym(sym) + '|' + String(dir || '').toLowerCase();
}

function fin(v){ return typeof v === 'number' && isFinite(v); }

/** Build { pairKey -> { sym, dir, meta } } from CLEAN-style cands. */
function pinePairsFromCands(cands, opts){
  opts = opts || {};
  var out = {};
  if (!Array.isArray(cands)) return out;
  for (var i = 0; i < cands.length; i++){
    var c = cands[i];
    if (!c) continue;
    var sym = c.sym || c.symbol || (c.t && c.t.symbol);
    if (!sym) continue;
    var dir = String(c.dir || '').toLowerCase();
    if (dir !== 'long' && dir !== 'short') continue;
    if (opts.minTally !== undefined && opts.minTally !== null){
      var t = fin(+c.tally) ? +c.tally : null;
      if (t === null || t < opts.minTally) continue;
    }
    if (opts.requirePlan){
      var entry = c.entry != null ? +c.entry : (c.plan && +c.plan.entry);
      var stop = c.stop != null ? +c.stop : (c.plan && +c.plan.stop);
      var t1 = c.t1 != null ? +c.t1 : (c.plan && +c.plan.t1);
      if (!fin(entry) || !fin(stop) || !fin(t1) || entry === stop) continue;
    }
    var k = pairKey(sym, dir);
    out[k] = { sym: String(sym), dir: dir, tally: c.tally, tier: c.tier, entry: c.entry, stop: c.stop, t1: c.t1 };
  }
  return out;
}

function pineIntersectMaps(maps){
  maps = maps || [];
  if (!maps.length) return [];
  var keys = Object.keys(maps[0] || {});
  for (var m = 1; m < maps.length; m++){
    var nxt = maps[m] || {};
    keys = keys.filter(function(k){ return nxt[k]; });
  }
  return keys.map(function(k){ return maps[0][k]; });
}

function pineUnionMaps(maps){
  var out = {};
  maps = maps || [];
  for (var m = 0; m < maps.length; m++){
    var map = maps[m] || {};
    for (var k in map){
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      if (!out[k]) out[k] = map[k];
    }
  }
  return Object.keys(out).map(function(k){ return out[k]; });
}

/** EDGE forming watchlist → sym+dir pairs (no plan required). */
function pinePairsFromForming(forming){
  var out = {};
  if (!Array.isArray(forming)) return out;
  for (var i = 0; i < forming.length; i++){
    var f = forming[i];
    if (!f || !f.sym) continue;
    var dir = String(f.dir || '').toLowerCase();
    if (dir !== 'long' && dir !== 'short') continue;
    var k = pairKey(f.sym, dir);
    out[k] = { sym: String(f.sym), dir: dir, forming: true, note: f.note || f.regime || 'forming' };
  }
  return out;
}

function pineMergePairMaps(){
  var out = {};
  for (var m = 0; m < arguments.length; m++){
    var map = arguments[m] || {};
    for (var k in map){
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      if (!out[k]) out[k] = map[k];
      else out[k] = Object.assign({}, out[k], map[k]);
    }
  }
  return out;
}

var PINE_GATE_NAMES = ['swing', 'scalp', 'edge', 'best', 'brain', 'trendmx'];

/** Relaxed: sym+dir must hit minHits gate tabs; default requires a core scanner (swing/scalp/best). */
function pineGateRelaxedPairs(maps, opts){
  opts = opts || {};
  var minHits = opts.minHits !== undefined ? +opts.minHits : 2;
  var requireCore = opts.requireCore !== false;
  var coreIdx = { 0: true, 1: true, 3: true };
  var counts = {};
  for (var m = 0; m < maps.length; m++){
    var map = maps[m] || {};
    var gname = PINE_GATE_NAMES[m] || ('gate' + m);
    for (var k in map){
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      if (!counts[k]){
        counts[k] = { hits: 0, core: false, sym: map[k].sym, dir: map[k].dir, gates: {} };
      }
      counts[k].hits++;
      counts[k].gates[gname] = true;
      if (coreIdx[m]) counts[k].core = true;
      if (map[k].sym) counts[k].sym = map[k].sym;
      if (map[k].dir) counts[k].dir = map[k].dir;
    }
  }
  var out = [];
  for (var key in counts){
    var c = counts[key];
    if (c.hits < minHits) continue;
    if (requireCore && !c.core) continue;
    out.push({
      sym: c.sym,
      dir: c.dir,
      gateHits: c.hits,
      gatesPartial: c.gates
    });
  }
  return out;
}

function pineRegimeAllows(dir, regime){
  if (!regime || !regime.playbook) return { ok: true, note: 'regime unknown — not blocking' };
  var bias = String(regime.playbook.bias || '').toUpperCase();
  if (bias === 'STAND-ASIDE') return { ok: false, note: 'REGIME STAND-ASIDE' };
  if (bias === 'LONG-ONLY' && dir === 'short') return { ok: false, note: 'REGIME LONG-ONLY' };
  if (bias === 'SHORT-ONLY' && dir === 'long') return { ok: false, note: 'REGIME SHORT-ONLY' };
  return { ok: true, note: bias || 'REGIME OK' };
}

function pineTrendMatrixPairs(rows, minScore){
  minScore = (minScore === undefined) ? 2 : +minScore;
  var out = {};
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.sym) continue;
    var sc = fin(+r.score) ? +r.score : 0;
    var dir = null;
    if (typeof G.tmDirOf === 'function'){
      try{ dir = G.tmDirOf(r); }catch(e){ dir = null; }
    }
    if (!dir){
      if (sc >= minScore) dir = 'long';
      else if (sc <= -minScore) dir = 'short';
    }
    if (dir !== 'long' && dir !== 'short') continue;
    var k = pairKey(r.sym, dir);
    out[k] = { sym: r.sym, dir: dir, score: sc };
  }
  return out;
}

/** Pure gate intersection from explicit snapshots (Node-testable). opts.mode: strict | relaxed | swing | edge */
function pineGateIntersect(snap, opts){
  opts = opts || {};
  var mode = opts.mode || 'strict';
  var funnel = {
    swing: 0, scalp: 0, edge: 0, edgeForming: 0, edgeSoft: 0, best: 0, brain: 0, trendmx: 0,
    intersectRaw: 0, regimeBlocked: 0, eligible: 0,
    mode: mode, minHits: opts.minHits, fallbackTier: null
  };
  var missing = [];

  var swingMap = pinePairsFromCands(snap.swingCands || []);
  funnel.swing = Object.keys(swingMap).length;
  if (!funnel.swing) missing.push('SWING');

  var scalpMap = pinePairsFromCands(snap.scalpCands || []);
  funnel.scalp = Object.keys(scalpMap).length;
  if (!funnel.scalp) missing.push('SCALP');

  var edgeMap = pinePairsFromCands(snap.edgeCands || [], { minTally: 3, requirePlan: true });
  funnel.edge = Object.keys(edgeMap).length;
  var edgeFormingMap = pinePairsFromForming(snap.edgeForming || []);
  funnel.edgeForming = Object.keys(edgeFormingMap).length;
  var edgeSoftMap = pinePairsFromCands(snap.edgeCands || [], { minTally: 2, requirePlan: false });
  funnel.edgeSoft = Object.keys(edgeSoftMap).length;
  if (!funnel.edge && !funnel.edgeForming) missing.push('EDGE');

  var bestMap = pinePairsFromCands(snap.bestClean || [], { requirePlan: true });
  funnel.best = Object.keys(bestMap).length;
  if (!funnel.best) missing.push('BEST');

  var brainRows = Array.isArray(snap.brainRows) ? snap.brainRows : [];
  var brainMap = {};
  for (var b = 0; b < brainRows.length; b++){
    var br = brainRows[b];
    if (!br || !br.sym) continue;
    var bdir = String(br.dir || '').toLowerCase();
    if (bdir !== 'long' && bdir !== 'short') continue;
    var tier = String(br.tier || '').toUpperCase();
    if (tier === 'ASIDE') continue;
    brainMap[pairKey(br.sym, bdir)] = { sym: br.sym, dir: bdir, tier: tier };
  }
  funnel.brain = Object.keys(brainMap).length;
  if (!funnel.brain) missing.push('BRAIN');

  var tmMap = pineTrendMatrixPairs(snap.trendmxRows || [], snap.trendMinScore);
  funnel.trendmx = Object.keys(tmMap).length;
  if (!funnel.trendmx) missing.push('TREND MATRIX');

  var gateMaps = [swingMap, scalpMap, edgeMap, bestMap, brainMap, tmMap];
  var raw = [];
  if (mode === 'swing'){
    funnel.mode = 'swing';
    raw = Object.keys(swingMap).map(function(k){
      return { sym: swingMap[k].sym, dir: swingMap[k].dir, gateHits: 1 };
    });
    funnel.intersectRaw = raw.length;
    missing = funnel.swing ? [] : ['SWING'];
  } else if (mode === 'edge'){
    funnel.mode = 'edge';
    var edgeUniverse = pineMergePairMaps(edgeMap, edgeFormingMap, edgeSoftMap);
    raw = Object.keys(edgeUniverse).map(function(k){
      var u = edgeUniverse[k];
      var hits = 1;
      if (edgeMap[k]) hits = 2;
      if (edgeMap[k] && edgeFormingMap[k]) hits = 3;
      return {
        sym: u.sym,
        dir: u.dir,
        gateHits: hits,
        edgeTicket: !!edgeMap[k],
        edgeForming: !!edgeFormingMap[k],
        edgeSoft: !!edgeSoftMap[k] && !edgeMap[k]
      };
    });
    funnel.intersectRaw = raw.length;
    if (!raw.length && opts.fallback !== false && funnel.swing){
      raw = Object.keys(swingMap).map(function(k){
        return { sym: swingMap[k].sym, dir: swingMap[k].dir, gateHits: 1, swingFallback: true };
      });
      funnel.fallbackTier = 'SWING CLEAN';
    }
    missing = raw.length ? [] : (funnel.edge || funnel.edgeForming ? [] : ['EDGE']);
  } else if (mode === 'relaxed'){
    funnel.minHits = opts.minHits !== undefined ? +opts.minHits : 2;
    raw = pineGateRelaxedPairs(gateMaps, { minHits: funnel.minHits, requireCore: true });
    funnel.intersectRaw = raw.length;
    if (!raw.length && opts.fallback !== false){
      raw = pineGateRelaxedPairs(gateMaps, { minHits: 1, requireCore: true });
      if (raw.length) funnel.fallbackTier = 'core≥1';
    }
    if (!raw.length && opts.fallback !== false){
      raw = pineUnionMaps([swingMap, scalpMap, bestMap, tmMap]).map(function(item){
        return { sym: item.sym, dir: item.dir, gateHits: 1, gatesPartial: {} };
      });
      if (raw.length) funnel.fallbackTier = 'scanner union';
    }
  } else {
    raw = pineIntersectMaps(gateMaps);
    funnel.intersectRaw = raw.length;
  }

  var regime = snap.regime || null;
  var applyRegime = opts.applyRegime !== false;
  var eligible = [];
  for (var j = 0; j < raw.length; j++){
    var item = raw[j];
    var rg = { ok: true, note: applyRegime ? 'regime unknown — not blocking' : 'skipped' };
    if (applyRegime){
      rg = pineRegimeAllows(item.dir, regime);
      if (!rg.ok){ funnel.regimeBlocked++; continue; }
    }
    var pk = pairKey(item.sym, item.dir);
    eligible.push({
      sym: item.sym,
      dir: item.dir,
      gateHits: item.gateHits || ((mode === 'swing' || mode === 'edge') ? 1 : 6),
      edgeTicket: !!item.edgeTicket,
      edgeForming: !!item.edgeForming,
      edgeSoft: !!item.edgeSoft,
      swingFallback: !!item.swingFallback,
      gates: {
        swing: !!swingMap[pk] || !!item.swingFallback,
        scalp: !!scalpMap[pk],
        edge: !!edgeMap[pk] || !!item.edgeForming || !!item.edgeSoft,
        best: !!bestMap[pk],
        brain: !!brainMap[pk],
        trendmx: !!tmMap[pk],
        regime: applyRegime ? rg.note : 'skipped'
      }
    });
  }
  funnel.eligible = eligible.length;

  return { eligible: eligible, funnel: funnel, missing: missing, at: Date.now() };
}

/** Live read from window scan getters. Default mode edge (EDGE ticket universe). */
function pineGateLive(win, opts){
  win = win || G;
  opts = opts || {};
  if (!opts.mode) opts.mode = 'edge';
  var saved = G;
  if (win) G = win;
  try{
    var swingFn = gfn('swingScan');
    var scalpFn = gfn('scalpScan');
    var edgeFn = gfn('edgeScan');
    var bestFn = gfn('bestScan');
    var brainFn = gfn('__hgBrainLast');
    var regimeFn = gfn('regimeState');
    var tmFn = gfn('trendmxState');

    var swing = swingFn ? swingFn() : null;
    var scalp = scalpFn ? scalpFn() : null;
    var edge = edgeFn ? edgeFn() : null;
    var best = bestFn ? bestFn() : null;
    var brain = brainFn ? brainFn() : null;
    var regime = regimeFn ? regimeFn() : null;
    var tm = tmFn ? tmFn() : null;

    return pineGateIntersect({
      swingCands: swing && swing.cands,
      scalpCands: scalp && scalp.cands,
      edgeCands: edge && edge.cands,
      edgeForming: edge && edge.forming,
      bestClean: best && best.clean,
      brainRows: brain && brain.rows,
      trendmxRows: tm && tm.rows,
      regime: regime
    }, opts);
  }catch(e){
    return { eligible: [], funnel: { eligible: 0 }, missing: ['error'], at: Date.now(), error: String(e && e.message || e) };
  }finally{
    if (win) G = saved;
  }
}

function pineFunnelRows(funnel){
  funnel = funnel || {};
  var rows = [
    { k: 'SWING CLEAN pairs', v: String(funnel.swing || 0) },
    { k: 'SCALP CLEAN pairs', v: String(funnel.scalp || 0) },
    { k: 'EDGE tickets (tally ≥3)', v: String(funnel.edge || 0) },
    { k: 'EDGE forming watch', v: String(funnel.edgeForming || 0) },
    { k: 'EDGE soft (tally ≥2)', v: String(funnel.edgeSoft || 0) },
    { k: 'BEST CLEAN pairs', v: String(funnel.best || 0) },
    { k: 'BRAIN tiered pairs', v: String(funnel.brain || 0) },
    { k: 'TREND MATRIX aligned', v: String(funnel.trendmx || 0) }
  ];
  if (funnel.mode === 'swing'){
    rows.push({ k: 'Gate mode', v: 'SWING CLEAN only (+ REGIME)' });
    rows.push({ k: 'Swing universe', v: String(funnel.intersectRaw || 0) });
  } else if (funnel.mode === 'edge'){
    rows.push({ k: 'Gate mode', v: 'EDGE tickets + forming + soft tally (REGIME)' });
    rows.push({ k: 'Edge universe', v: String(funnel.intersectRaw || 0) });
    if (funnel.fallbackTier) rows.push({ k: 'Fallback tier', v: String(funnel.fallbackTier) });
  } else if (funnel.mode === 'relaxed'){
    rows.push({ k: 'Gate mode', v: 'relaxed (≥' + (funnel.minHits || 2) + ' scanners + core)' });
    rows.push({ k: 'Relaxed matches', v: String(funnel.intersectRaw || 0) });
    if (funnel.fallbackTier) rows.push({ k: 'Fallback tier', v: String(funnel.fallbackTier) });
  } else {
    rows.push({ k: '6-tab intersection', v: String(funnel.intersectRaw || 0) });
  }
  rows.push({ k: 'REGIME blocked', v: String(funnel.regimeBlocked || 0) });
  rows.push({ k: 'Pine-eligible', v: String(funnel.eligible || 0) });
  return rows;
}

G.pineNormSym = pineNormSym;
G.pineGateIntersect = pineGateIntersect;
G.pineGateLive = pineGateLive;
G.pineFunnelRows = pineFunnelRows;

if (typeof module !== 'undefined' && module.exports){
  module.exports = { pineNormSym, pineGateIntersect, pineGateLive, pineFunnelRows, pinePairsFromCands, pinePairsFromForming, pineTrendMatrixPairs, pineGateRelaxedPairs };
}

})();
