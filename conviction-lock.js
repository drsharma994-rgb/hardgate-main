/* =========================================================================
HARDGATE — conviction-lock.js
ConvictionLockManager: prevents repainting and manages trade lifecycle for
GOLD SCALP (6h expiry, 15m close invalidation) and GOLD SWING (5d expiry,
4h close invalidation). Loaded BEFORE goldscalp.js / goldswing.js.

Never throws. Accepts Hardgate bars {t,o,h,l,c,v} or {timestamp,open,high,low,close}.
Exports: ConvictionLockManager, applyHardgateConvictionLock (window).
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};

var SCALP_EXPIRY_MS = 6 * 60 * 60 * 1000;
var SWING_EXPIRY_MS = 5 * 24 * 60 * 60 * 1000;

function __barMs(bar){
  try{
    if (!bar) return NaN;
    var t = (bar.t !== undefined && bar.t !== null) ? bar.t : bar.timestamp;
    if (!isFinite(t)) return NaN;
    return (t < 1e12) ? t * 1000 : t;
  }catch(e){ return NaN; }
}

function __normCandle(bar){
  if (!bar) return null;
  return {
    timestamp: __barMs(bar),
    open: isFinite(bar.o) ? bar.o : bar.open,
    high: isFinite(bar.h) ? bar.h : bar.high,
    low: isFinite(bar.l) ? bar.l : bar.low,
    close: isFinite(bar.c) ? bar.c : bar.close
  };
}

function __is4hBarClose(bar){
  var ms = __barMs(bar);
  if (!isFinite(ms)) return false;
  var d = new Date(ms);
  return d.getUTCMinutes() === 0 && (d.getUTCHours() % 4 === 0);
}

/** @constructor */
function ConvictionLockManager(opts){
  opts = opts || {};
  this.activeConvictions = new Map();
  this.type = opts.type || 'scalp';
  this.SCALP_EXPIRY_MS = isFinite(opts.scalpExpiryMs) ? opts.scalpExpiryMs : SCALP_EXPIRY_MS;
  this.SWING_EXPIRY_MS = isFinite(opts.swingExpiryMs) ? opts.swingExpiryMs : SWING_EXPIRY_MS;
  this.debug = !!opts.debug;
}

ConvictionLockManager.prototype.generateID = function(stratKey, direction, anchor){
  var rounded = Math.round(anchor);
  return String(stratKey) + '|' + direction + '|' + rounded;
};

ConvictionLockManager.prototype._expiryMs = function(setupType){
  return (setupType === 'swing') ? this.SWING_EXPIRY_MS : this.SCALP_EXPIRY_MS;
};

/** Hardgate candidate -> internal locked setup. */
ConvictionLockManager.prototype.fromCandidate = function(c, setupType){
  if (!c) return null;
  var anchor = isFinite(c.anchor) ? c.anchor : (isFinite(c.entry) ? c.entry : NaN);
  var strat = c.stratKey || (c.id ? String(c.id).split('|')[0] : 'setup');
  return {
    id: c.id || this.generateID(strat, c.dir, anchor),
    type: setupType || this.type || 'scalp',
    direction: c.dir,
    stratKey: strat,
    sym: c.sym,
    venue: c.venue,
    strategy: c.strategy,
    grade: c.grade || null,
    levels: {
      entry: c.entry,
      stopLoss: c.stop,
      tp1: c.t1,
      tp2: c.t2,
      tp3: c.t3,
      anchor: anchor
    },
    tally: isFinite(c.tally) ? c.tally : 0,
    macroHint: c.macroHint || null,
    executionBarIndex: isFinite(c.executionBarIndex) ? c.executionBarIndex : null,
    executionState: c.executionState || null,
    timestamp: isFinite(c.issuedAt) ? c.issuedAt : Date.now(),
    status: 'ACTIVE'
  };
};

/** Register or merge; returns {action:'NEW_LOCK'|'MERGED', setup}. */
ConvictionLockManager.prototype.lockConviction = function(setup, currentTime, currentATR){
  var out = { action: 'NEW_LOCK', setup: setup };
  try{
    if (!setup || !setup.levels) return out;
    if (!isFinite(currentTime)) currentTime = Date.now();
    var id = setup.id;
    if (!id && setup.stratKey && setup.direction && isFinite(setup.levels.anchor)){
      id = this.generateID(setup.stratKey, setup.direction, setup.levels.anchor);
      setup.id = id;
    }
    if (!id) return out;

    var self = this, existingId, existingSetup, sameDirection, sameType, anchorDistance, isWithinATR;
    for (existingId of this.activeConvictions.keys()){
      existingSetup = this.activeConvictions.get(existingId);
      if (!existingSetup || !existingSetup.levels) continue;
      sameDirection = existingSetup.direction === setup.direction;
      sameType = existingSetup.type === setup.type;
      if (setup.sym && existingSetup.sym && existingSetup.sym !== setup.sym) continue;
      if (!sameDirection || !sameType) continue;
      if (!isFinite(currentATR) || !(currentATR > 0)
          || !isFinite(existingSetup.levels.anchor) || !isFinite(setup.levels.anchor)) continue;
      anchorDistance = Math.abs(existingSetup.levels.anchor - setup.levels.anchor);
      isWithinATR = anchorDistance <= (0.5 * currentATR);
      if (isWithinATR){
        existingSetup.timestamp = currentTime;
        if (isFinite(setup.tally)) existingSetup.tally = setup.tally;
        existingSetup.lastConfirmedAt = currentTime;
        this.activeConvictions.set(existingId, existingSetup);
        return { action: 'MERGED', setup: existingSetup };
      }
    }

    setup.timestamp = currentTime;
    setup.status = 'ACTIVE';
    this.activeConvictions.set(id, setup);
    return { action: 'NEW_LOCK', setup: setup };
  }catch(e){ return out; }
};

/** Evaluate one locked setup; returns status string or null. Never deletes from map.
   Optional barIndex (6th arg) enables evaluateTimeDecay when goldind.js is loaded. */
ConvictionLockManager.prototype.evaluateSetup = function(setup, currentCandle, is15mClose, is4hClose, nowMs, barIndex){
  try{
    if (!setup || !setup.levels) return null;
    if (!isFinite(nowMs)) nowMs = Date.now();
    var c = __normCandle(currentCandle);
    if (!c || !isFinite(c.close)) return null;
    var type = setup.type || 'scalp';
    var elapsed = nowMs - (setup.timestamp || setup.issuedAt || 0);
    if (elapsed > this._expiryMs(type)){
      if (this.debug) console.log('[LOCK EXPIRED] ' + setup.id + ' — exceeded TTL.');
      return 'EXPIRED';
    }

    var dir = setup.direction || setup.dir;
    var stop = setup.levels.stopLoss;
    var tp1 = setup.levels.tp1;
    var close = c.close;
    var high = c.high;
    var low = c.low;

    if (type === 'scalp' && is15mClose){
      if (dir === 'long' && isFinite(stop) && close < stop){
        if (this.debug) console.log('[INVALIDATED] ' + setup.id + ' — 15m closed beyond stop.');
        return 'STOPPED';
      }
      if (dir === 'short' && isFinite(stop) && close > stop){
        if (this.debug) console.log('[INVALIDATED] ' + setup.id + ' — 15m closed beyond stop.');
        return 'STOPPED';
      }
    } else if (type === 'swing' && is4hClose){
      if (dir === 'long' && isFinite(stop) && close < stop){
        if (this.debug) console.log('[INVALIDATED] ' + setup.id + ' — 4h closed beyond stop.');
        return 'STOPPED';
      }
      if (dir === 'short' && isFinite(stop) && close > stop){
        if (this.debug) console.log('[INVALIDATED] ' + setup.id + ' — 4h closed beyond stop.');
        return 'STOPPED';
      }
    }

    /* TP1 — wicks count (no close required). Hardgate status label uses a space. */
    if (dir === 'long' && isFinite(tp1) && isFinite(high) && high >= tp1){
      if (this.debug) console.log('[TARGET HIT] ' + setup.id + ' — TP1 reached.');
      setup.tp1Hit = true;
      return 'TARGET HIT';
    }
    if (dir === 'short' && isFinite(tp1) && isFinite(low) && low <= tp1){
      if (this.debug) console.log('[TARGET HIT] ' + setup.id + ' — TP1 reached.');
      setup.tp1Hit = true;
      return 'TARGET HIT';
    }

    /* Scalp time decay — momentum exit after maxBars without profit (goldind.js). */
    var tdFn = W.evaluateTimeDecay;
    if (typeof tdFn === 'function' && type === 'scalp' && is15mClose && isFinite(barIndex)){
      var td = tdFn(setup, currentCandle, barIndex, setup.maxDecayBars);
      if (td && td.action === 'MARKET_CLOSE_FULL'){
        if (this.debug) console.log('[MOMENTUM DECAY] ' + setup.id + ' — time decay exit.');
        return 'MOMENTUM DECAY';
      }
      if (td && td.action === 'TRAIL_SL_TIGHT'){
        setup.trailSlTight = true;
        setup.momentumWarning = td.reason;
      }
    }

    /* BRAIN crypto — exit if TP1 not reached within N bars (dead promotion). */
    if ((setup.stratKey === 'brain' || setup.strategy === 'brain') && isFinite(barIndex) && isFinite(setup.executionBarIndex)){
      var maxBars = setup.maxBarsToTp1;
      if (!isFinite(maxBars)){
        maxBars = (type === 'swing') ? (W.BRAIN_TP1_BARS_SWING || 12) : (W.BRAIN_TP1_BARS_SCALP || 24);
      }
      var barsElapsed = barIndex - setup.executionBarIndex;
      if (barsElapsed >= maxBars){
        var tp1Hit = setup.tp1Hit === true;
        if (!tp1Hit && dir === 'long' && isFinite(tp1) && isFinite(high) && high >= tp1) tp1Hit = true;
        if (!tp1Hit && dir === 'short' && isFinite(tp1) && isFinite(low) && low <= tp1) tp1Hit = true;
        if (!tp1Hit){
          if (this.debug) console.log('[TIME STOP] ' + setup.id + ' — TP1 not hit in ' + barsElapsed + ' bars.');
          return 'TIME_STOP';
        }
      }
    }
    return null;
  }catch(e){ return null; }
};

/** Batch evaluate all convictions in the map (single candle context). */
ConvictionLockManager.prototype.evaluateInvalidations = function(currentCandle, is15mClose, is4hClose, nowMs){
  var closed = [];
  try{
    if (!isFinite(nowMs)) nowMs = __barMs(currentCandle) || Date.now();
    var self = this, id, setup, status;
    for (id of this.activeConvictions.keys()){
      setup = this.activeConvictions.get(id);
      status = this.evaluateSetup(setup, currentCandle, is15mClose, is4hClose, nowMs);
      if (status){
        setup.status = status;
        closed.push({ id: id, setup: setup, status: status });
        this.activeConvictions.delete(id);
      }
    }
    return closed;
  }catch(e){ return closed; }
};

ConvictionLockManager.prototype.hydrateFromRecord = function(rec, storageKey){
  if (!rec || !rec.id) return;
  var anchor = isFinite(rec.anchor) ? rec.anchor : rec.entry;
  var setup = {
    id: rec.id,
    storageKey: storageKey || rec.id,
    type: rec.type || this.type || 'scalp',
    direction: rec.dir,
    dir: rec.dir,
    sym: rec.sym,
    venue: rec.venue,
    strategy: rec.strategy,
    levels: {
      entry: rec.entry,
      stopLoss: rec.stop,
      tp1: rec.t1,
      tp2: rec.t2,
      tp3: rec.t3,
      anchor: anchor
    },
    tally: rec.tally,
    macroHint: rec.macroHint || null,
    executionBarIndex: rec.executionBarIndex,
    executionState: rec.executionState || null,
    timestamp: rec.issuedAt,
    issuedAt: rec.issuedAt,
    lastConfirmedAt: rec.lastConfirmedAt,
    status: 'ACTIVE'
  };
  this.activeConvictions.set(storageKey || rec.id, setup);
};

ConvictionLockManager.prototype.toRecord = function(setup){
  if (!setup || !setup.levels) return null;
  return {
    id: setup.id,
    dir: setup.direction || setup.dir,
    type: setup.type,
    strategy: setup.strategy,
    grade: setup.grade || null,
    entry: setup.levels.entry,
    stop: setup.levels.stopLoss,
    t1: setup.levels.tp1,
    t2: setup.levels.tp2,
    t3: setup.levels.tp3,
    venue: setup.venue,
    sym: setup.sym,
    issuedAt: setup.timestamp || setup.issuedAt,
    lastConfirmedAt: setup.lastConfirmedAt,
    tally: setup.tally,
    agree: setup.agree,
    oppose: setup.oppose,
    tallyParts: setup.tallyParts,
    why: setup.why,
    invalidates: setup.invalidates,
    stratKey: setup.stratKey,
    zone: setup.zone,
    session: setup.session,
    confluence: setup.confluence,
    reads: setup.reads,
    atr: setup.atr,
    newsCaution: setup.newsCaution,
    newsStamp: setup.newsStamp,
    macroHint: setup.macroHint || null,
    executionBarIndex: setup.executionBarIndex,
    executionState: setup.executionState || null,
    anchor: setup.levels.anchor
  };
};

/**
 * Full Hardgate conviction-lock pass (localStorage store + ranked candidates).
 * opts: { type, rowKey, historyLimit, noMint, venueScopedKeys, expiryMs }
 */
function applyHardgateConvictionLock(store, ranked, venueRows, nowMs, opts){
  opts = opts || {};
  var transitions = [];
  var historyLimit = isFinite(opts.historyLimit) ? opts.historyLimit : 8;
  var type = opts.type || 'scalp';
  var rowKey = opts.rowKey || 'rows15m';
  var noMint = !!opts.noMint;
  var venueScoped = opts.venueScopedKeys !== false && type === 'swing';
  var mgr = new ConvictionLockManager({ type: type, scalpExpiryMs: opts.expiryMs, swingExpiryMs: opts.expiryMs });

  try{
    if (!store || !store.live) store = { v: 1, live: {}, history: [] };
    if (!Array.isArray(store.history)) store.history = [];
    if (!store.live || typeof store.live !== 'object') store.live = {};

    var id, rec, storageKey;
    for (id in store.live){
      if (!Object.prototype.hasOwnProperty.call(store.live, id)) continue;
      rec = store.live[id];
      if (!rec || (rec.dir !== 'long' && rec.dir !== 'short') || !isFinite(rec.stop)
          || !isFinite(rec.t1) || !isFinite(rec.issuedAt)){
        delete store.live[id];
        continue;
      }
      mgr.hydrateFromRecord(rec, id);
    }

    /* 1) invalidation transitions — per-venue latest bar */
    for (id in store.live){
      if (!Object.prototype.hasOwnProperty.call(store.live, id)) continue;
      rec = store.live[id];
      var vr = venueRows ? venueRows[rec.venue] : null;
      var rows = vr ? vr[rowKey] : null;
      var bar = (rows && rows.length) ? rows[rows.length - 1] : null;
      if (!bar) continue;
      var is15 = (type === 'scalp');
      var is4h = (type === 'swing');
      var setup = mgr.activeConvictions.get(id);
      if (!setup) continue;
      var barIdx = (rows && rows.length) ? rows.length - 1 : NaN;
      var status = mgr.evaluateSetup(setup, bar, is15, is4h, nowMs, barIdx);
      if (status){
        rec.status = status;
        rec.closedAt = nowMs;
        if (bar && isFinite(bar.c)) rec.closePrice = bar.c;
        store.history.unshift(rec);
        delete store.live[id];
        mgr.activeConvictions.delete(id);
        transitions.push(rec);
      }
    }
    if (store.history.length > historyLimit) store.history = store.history.slice(0, historyLimit);

    /* 2) restore / mint / merge ranked candidates */
    var i, c, cKey, lockResult, mergedRec;
    for (i = 0; i < (ranked || []).length; i++){
      c = ranked[i];
      if (!c || !c.id) continue;
      cKey = (venueScoped && c.venue) ? (c.venue + '|' + c.id) : c.id;
      rec = store.live[cKey];
      if (!rec && venueScoped && store.live[c.id]
          && (!store.live[c.id].venue || store.live[c.id].venue === c.venue)){
        rec = store.live[c.id];
        delete store.live[c.id];
        store.live[cKey] = rec;
      }
      if (rec){
        c.entry = rec.entry; c.stop = rec.stop; c.t1 = rec.t1; c.t2 = rec.t2;
        if (isFinite(rec.t3)) c.t3 = rec.t3;
        var risk = Math.abs(rec.entry - rec.stop);
        if (risk > 0){
          c.rr = Math.abs(rec.t1 - rec.entry) / risk;
          c.rr2 = Math.abs(rec.t2 - rec.entry) / risk;
          if (isFinite(rec.t3)) c.rr3 = Math.abs(rec.t3 - rec.entry) / risk;
        }
        c.venue = rec.venue; c.sym = rec.sym;
        c.locked = true; c.issuedAt = rec.issuedAt;
        if (rec.grade) c.grade = rec.grade;
        if (rec.macroHint) c.macroHint = rec.macroHint;
      } else {
        var atr = (isFinite(c.atr) && c.atr > 0) ? c.atr : NaN;
        var setupCand = mgr.fromCandidate(c, type);
        lockResult = mgr.lockConviction(setupCand, nowMs, atr);
        if (lockResult.action === 'MERGED' && lockResult.setup){
          mergedRec = mgr.toRecord(lockResult.setup);
          for (storageKey in store.live){
            if (!Object.prototype.hasOwnProperty.call(store.live, storageKey)) continue;
            var lr = store.live[storageKey];
            if (!lr || lr.dir !== c.dir || lr.sym !== c.sym) continue;
            if (!isFinite(lr.anchor) || !isFinite(c.anchor) || !isFinite(atr)) continue;
            if (Math.abs(lr.anchor - c.anchor) <= 0.5 * atr){
              mergedRec = lr;
              mergedRec.lastConfirmedAt = nowMs;
              break;
            }
          }
          c.entry = mergedRec.entry; c.stop = mergedRec.stop; c.t1 = mergedRec.t1; c.t2 = mergedRec.t2;
          var mrisk = Math.abs(mergedRec.entry - mergedRec.stop);
          if (mrisk > 0){
            c.rr = Math.abs(mergedRec.t1 - mergedRec.entry) / mrisk;
            c.rr2 = Math.abs(mergedRec.t2 - mergedRec.entry) / mrisk;
          }
          c.venue = mergedRec.venue; c.sym = mergedRec.sym;
          c.locked = true; c.issuedAt = mergedRec.issuedAt;
          c.merged = true; c.mergedInto = mergedRec.id; c.mergedAt = nowMs;
        } else if (noMint){
          c.vetoed = true;
        } else {
          rec = mgr.toRecord(setupCand);
          if (rec){
            rec.anchor = isFinite(c.anchor) ? c.anchor : null;
            rec.tally = isFinite(c.tally) ? c.tally : 0;
            if (c.grade) rec.grade = c.grade;
            if (c.macroHint) rec.macroHint = c.macroHint;
            if (venueScoped) store.live[cKey] = rec;
            else store.live[c.id] = rec;
          }
          c.locked = false; c.issuedAt = nowMs;
        }
      }
      try{
        c.asOf = isFinite(c.issuedAt) ? new Date(c.issuedAt).toISOString().slice(11, 16) + ' UTC' : '';
      }catch(eD){ c.asOf = ''; }
    }
  }catch(e){ /* never throw */ }

  return { store: store, transitions: transitions };
}

/** Restore a live conviction record as a display card (gold tabs + Telegram snap). */
function convictionCardFromLiveRec(rec, defaults){
  defaults = defaults || {};
  if (!rec || !rec.id || (rec.dir !== 'long' && rec.dir !== 'short')) return null;
  if (!isFinite(rec.entry) || !isFinite(rec.stop) || !isFinite(rec.t1)) return null;
  var risk = Math.abs(rec.entry - rec.stop);
  var strategyDefault = defaults.strategyDefault || 'SETUP';
  var card = {
    id: rec.id,
    dir: rec.dir,
    strategy: rec.strategy || strategyDefault,
    stratKey: rec.stratKey || (rec.id ? String(rec.id).split('|')[0] : 'live'),
    entry: rec.entry, stop: rec.stop, t1: rec.t1, t2: rec.t2, t3: rec.t3,
    venue: rec.venue || null, sym: rec.sym || null,
    locked: true, issuedAt: rec.issuedAt,
    grade: rec.grade || 'B',
    agree: isFinite(rec.agree) ? rec.agree : 2,
    oppose: isFinite(rec.oppose) ? rec.oppose : 0,
    tally: isFinite(rec.tally) ? rec.tally : 0,
    tallyParts: Array.isArray(rec.tallyParts) ? rec.tallyParts : [],
    why: rec.why || 'conviction locked — original levels restored verbatim on re-scan',
    invalidates: rec.invalidates || 'a close beyond the stop',
    session: rec.session || 'n/a',
    anchor: isFinite(rec.anchor) ? rec.anchor : rec.entry,
    zone: (rec.zone && isFinite(rec.zone.lo) && isFinite(rec.zone.hi))
      ? rec.zone : { lo: rec.entry - 1, hi: rec.entry + 1 },
    notes: [],
    newsCaution: !!rec.newsCaution,
    newsStamp: rec.newsStamp || null,
    confluence: Array.isArray(rec.confluence) ? rec.confluence : [],
    reads: (rec.reads && typeof rec.reads === 'object')
      ? rec.reads
      : { long: (rec.dir === 'long') ? (isFinite(rec.agree) ? rec.agree : 2) : 0,
          short: (rec.dir === 'short') ? (isFinite(rec.agree) ? rec.agree : 2) : 0 },
    atr: isFinite(rec.atr) ? rec.atr : NaN,
    rr: risk > 0 ? Math.abs(rec.t1 - rec.entry) / risk : NaN,
    rr2: risk > 0 && isFinite(rec.t2) ? Math.abs(rec.t2 - rec.entry) / risk : NaN,
    rr3: (risk > 0 && isFinite(rec.t3)) ? Math.abs(rec.t3 - rec.entry) / risk : NaN
  };
  try{
    card.asOf = isFinite(card.issuedAt)
      ? new Date(card.issuedAt).toISOString().slice(11, 16) + ' UTC' : '';
  }catch(eA){ card.asOf = ''; }
  return card;
}

/** When a scan finds zero new candidates, still surface live locked convictions. */
function mergeLiveConvictionCards(ranked, store, defaults){
  var out = (ranked || []).slice(), seen = {}, i;
  for (i = 0; i < out.length; i++){
    if (!out[i] || !out[i].id) continue;
    if (out[i].venue) seen[out[i].venue + '|' + out[i].id] = true;
    seen[out[i].id] = true;
  }
  if (!store || !store.live) return out;
  for (var k in store.live){
    if (!Object.prototype.hasOwnProperty.call(store.live, k)) continue;
    if (seen[k]) continue;
    var rec = store.live[k];
    if (rec && rec.id && seen[rec.id]) continue;
    var card = convictionCardFromLiveRec(rec, defaults);
    if (card){ out.push(card); seen[k] = true; if (card.id) seen[card.id] = true; }
  }
  return out;
}

W.ConvictionLockManager = ConvictionLockManager;
W.applyHardgateConvictionLock = applyHardgateConvictionLock;
W.convictionCardFromLiveRec = convictionCardFromLiveRec;
W.mergeLiveConvictionCards = mergeLiveConvictionCards;
W.SCALP_CONVICTION_EXPIRY_MS = SCALP_EXPIRY_MS;
W.SWING_CONVICTION_EXPIRY_MS = SWING_EXPIRY_MS;

})();
