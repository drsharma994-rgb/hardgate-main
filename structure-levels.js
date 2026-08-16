/* HARDGATE — structure level primitives (opencrypto-inspired SMC layer).
   Phase 2: order blocks, FVG, volume profile hints, ShieldGuard pre-trade veto.
   Loaded after plans.js, before formation.js. Never throws. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var SL_REF = 'moo-22/opencrypto (OB/FVG/sweep/VP + manipulation guard)';

function fin(v){ return typeof v === 'number' && isFinite(v); }

function hgSwingLook(){
  try{
    if (typeof G.CG_SWING_LOOK === 'number' && G.CG_SWING_LOOK > 5) return G.CG_SWING_LOOK;
  }catch(e){}
  return 20;
}

function hgSwingAnchorMax(){
  try{
    if (typeof G.CG_SWING_ANCHOR_ATR === 'number' && G.CG_SWING_ANCHOR_ATR > 0) return G.CG_SWING_ANCHOR_ATR;
  }catch(e){}
  return 1.5;
}

function hgStructureStopOpts(extra){
  extra = extra || {};
  return Object.assign({
    atrLen: 14,
    look: hgSwingLook(),
    buffer: 0.25,
    capDist: 2.5,
    fallback: 1.5,
  }, extra);
}

function volZ(rows, n){
  n = n || 20;
  if (!rows || rows.length < n + 1) return NaN;
  var vols = rows.map(function(r){ return fin(+r.v) ? +r.v : 0; });
  var slice = vols.slice(-n);
  var mean = slice.reduce(function(a, b){ return a + b; }, 0) / n;
  var varc = 0;
  for (var i = 0; i < slice.length; i++) varc += Math.pow(slice[i] - mean, 2);
  var sd = Math.sqrt(varc / n);
  if (!(sd > 0)) return 0;
  return (vols[vols.length - 1] - mean) / sd;
}

/** Bullish/bearish order block — last opposing candle before displacement leg. */
function hgDetectOrderBlock(rows, dir){
  try{
    rows = rows || [];
    dir = String(dir || '').toLowerCase();
    if (rows.length < 12 || !(dir === 'long' || dir === 'short')) return null;
    var n = rows.length - 1;
    var a = (typeof atr === 'function') ? atr(rows, 14) : null;
    var atrVal = a && a.length ? a[n] : NaN;
    if (!fin(atrVal) || atrVal <= 0) return null;

    for (var i = n - 1; i >= Math.max(2, n - 40); i--){
      var b = rows[i];
      var next = rows[i + 1];
      if (!b || !next) continue;
      var body = b.c - b.o;
      var disp = Math.abs(next.c - next.o);
      if (disp < atrVal * 0.85) continue;

      if (dir === 'long' && body < 0 && next.c > next.o && next.c > b.h){
        return {
          entry: (b.o + b.c) / 2,
          zone: { lo: Math.min(b.o, b.c), hi: b.h },
          label: 'bull OB',
          poi: 'ob',
          idx: i,
        };
      }
      if (dir === 'short' && body > 0 && next.c < next.o && next.c < b.l){
        return {
          entry: (b.o + b.c) / 2,
          zone: { lo: b.l, hi: Math.max(b.o, b.c) },
          label: 'bear OB',
          poi: 'ob',
          idx: i,
        };
      }
    }
    return null;
  }catch(e){ return null; }
}

/** 3-candle fair value gap (ICT-style). */
function hgDetectFvg(rows, dir){
  try{
    rows = rows || [];
    dir = String(dir || '').toLowerCase();
    if (rows.length < 5 || !(dir === 'long' || dir === 'short')) return null;
    var n = rows.length - 1;
    for (var i = n; i >= 2; i--){
      var c0 = rows[i - 2], c2 = rows[i];
      if (!c0 || !c2) continue;
      if (dir === 'long' && c2.l > c0.h){
        var mid = (c0.h + c2.l) / 2;
        return {
          entry: mid,
          zone: { lo: c0.h, hi: c2.l },
          label: 'bull FVG',
          poi: 'fvg',
          idx: i,
        };
      }
      if (dir === 'short' && c2.h < c0.l){
        var midS = (c0.l + c2.h) / 2;
        return {
          entry: midS,
          zone: { lo: c2.h, hi: c0.l },
          label: 'bear FVG',
          poi: 'fvg',
          idx: i,
        };
      }
    }
    return null;
  }catch(e){ return null; }
}

function hgStructureVolumeProfile(rows, lookback, bins){
  try{
    if (typeof volumeProfile !== 'function' || !rows || rows.length < 20) return null;
    lookback = lookback || Math.min(80, rows.length);
    bins = bins || 24;
    return volumeProfile(rows, lookback, bins);
  }catch(e){ return null; }
}

/** Pre-trade manipulation / exhaustion veto (ShieldGuard-lite). */
function hgShieldGuardVeto(rows, dir, inp){
  inp = inp || {};
  try{
    if (inp.skipShield === true) return { veto: false };
    rows = rows || [];
    dir = String(dir || '').toLowerCase();
    if (rows.length < 15) return { veto: false };

    var vz = volZ(rows, 20);
    var last = rows[rows.length - 1];
    var reasons = [];

    if (fin(vz) && vz >= 3.2){
      reasons.push('volume spike z=' + vz.toFixed(1));
    }

    var streak = 0;
    for (var i = rows.length - 1; i >= Math.max(0, rows.length - 8); i--){
      var bull = rows[i].c >= rows[i].o;
      if (dir === 'long' && bull) streak++;
      else if (dir === 'short' && !bull) streak++;
      else break;
    }
    if (streak >= 6) reasons.push('exhaustion streak ' + streak + ' bars');

    if (last){
      var rng = last.h - last.l;
      if (rng > 0){
        var upperWick = last.h - Math.max(last.o, last.c);
        var lowerWick = Math.min(last.o, last.c) - last.l;
        if (dir === 'long' && upperWick / rng >= 0.55) reasons.push('upper rejection wick');
        if (dir === 'short' && lowerWick / rng >= 0.55) reasons.push('lower rejection wick');
      }
    }

    if (reasons.length >= 2){
      return { veto: true, reason: 'ShieldGuard: ' + reasons.join(' · '), reasons: reasons };
    }
    return { veto: false, reasons: reasons, checked: true };
  }catch(e){
    /* A veto that could not be evaluated is not the same as no veto found. */
    return { veto: false, unchecked: true,
             reason: 'ShieldGuard threw: ' + ((e && e.message) || String(e)) };
  }
}

G.hgSwingLook = hgSwingLook;
G.hgSwingAnchorMax = hgSwingAnchorMax;
G.hgStructureStopOpts = hgStructureStopOpts;
G.hgDetectOrderBlock = hgDetectOrderBlock;
G.hgDetectFvg = hgDetectFvg;
G.hgStructureVolumeProfile = hgStructureVolumeProfile;
G.hgShieldGuardVeto = hgShieldGuardVeto;
G.HG_STRUCTURE_LEVELS_REF = SL_REF;

})();
