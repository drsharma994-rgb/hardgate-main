/* HARDGATE — structure/pine-bridge.js
   Bridges Increment 6 structure-core detectors into PINE scanner tabs. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function fin(v){ return typeof v === 'number' && isFinite(v); }

function hgPineStructureSignal(rows, item, opts){
  opts = opts || {};
  if (!rows || rows.length < 30 || !item || !item.dir) return null;
  if (typeof G.hgDetectSwings !== 'function' || typeof G.hgDetectFvgList !== 'function') return null;
  var left = opts.pivotLength || 5;
  var sw = G.hgDetectSwings(rows, { left: left, right: left });
  var wantUp = item.dir === 'long';
  var breaks = (sw.bos || []).concat(sw.choch || []);
  var brk = null;
  for (var i = breaks.length - 1; i >= 0; i--){
    if (wantUp && breaks[i].dir === 'up'){ brk = breaks[i]; break; }
    if (!wantUp && breaks[i].dir === 'down'){ brk = breaks[i]; break; }
  }
  if (!brk) return null;
  var fvgs = G.hgDetectFvgList(rows, { atrLen: opts.atrLen || 14 }) || [];
  var fvg = null;
  for (var j = fvgs.length - 1; j >= 0; j--){
    var f = fvgs[j];
    if (!f || f.state === 'invalidated') continue;
    if (wantUp && f.dir === 'bullish'){ fvg = f; break; }
    if (!wantUp && f.dir === 'bearish'){ fvg = f; break; }
  }
  if (!fvg) return null;
  var entry = fin(fvg.mid) ? fvg.mid : (fvg.top + fvg.bottom) / 2;
  var stop = wantUp ? fvg.bottom * 0.998 : fvg.top * 1.002;
  var risk = Math.abs(entry - stop);
  if (!(risk > 0)) return null;
  var t1 = wantUp ? entry + 2 * risk : entry - 2 * risk;
  var t2 = wantUp ? entry + 3 * risk : entry - 3 * risk;
  return {
    dir: item.dir,
    entry: entry,
    stop: stop,
    t1: t1,
    t2: t2,
    zoneEntry: entry,
    newLong: wantUp,
    newShort: !wantUp,
    price: rows[rows.length - 1].c,
    planSrc: 'structure-core CHoCH+FVG',
    structureBreak: brk,
    fvg: fvg
  };
}

function hgPineObSignal(rows, item, opts){
  if (!rows || !item || typeof G.hgDetectSwings !== 'function' || typeof G.hgDetectOrderBlocks !== 'function') return null;
  var sw = G.hgDetectSwings(rows, { left: (opts && opts.pivotLength) || 5, right: (opts && opts.pivotLength) || 5 });
  var obs = G.hgDetectOrderBlocks(rows, sw) || [];
  var want = item.dir === 'long' ? 'bullish' : 'bearish';
  var pick = null;
  for (var i = obs.length - 1; i >= 0; i--){
    var ob = obs[i];
    if (!ob || ob.state === 'invalidated') continue;
    if (ob.dir !== want) continue;
    if (opts && opts.requireQualityTap && !ob.highQualityTap) continue;
    pick = ob; break;
  }
  if (!pick) return null;
  var entry = (pick.top + pick.bottom) / 2;
  var stop = item.dir === 'long' ? pick.bottom * 0.998 : pick.top * 1.002;
  var risk = Math.abs(entry - stop);
  if (!(risk > 0)) return null;
  return {
    dir: item.dir, entry: entry, stop: stop,
    t1: item.dir === 'long' ? entry + 2 * risk : entry - 2 * risk,
    t2: item.dir === 'long' ? entry + 3 * risk : entry - 3 * risk,
    planSrc: 'structure-core OB',
    ob: pick
  };
}

function hgPineDivTags(rows, dir){
  if (!rows || typeof G.hgDetectDivergences !== 'function') return [];
  var div = G.hgDetectDivergences(rows, { rsiPeriod: 14 });
  var tags = [];
  var list = (div.hidden || []).concat(div.regular || []);
  for (var i = 0; i < list.length; i++){
    var d = list[i];
    if (!d || !d.side) continue;
    if (String(d.side).toLowerCase() !== String(dir || '').toLowerCase()) continue;
    tags.push((d.nature === 'continuation' ? 'HIDDEN ' : 'REGULAR ') + String(d.type || '').replace(/-/g, ' ').toUpperCase());
  }
  return tags;
}

G.hgPineStructureSignal = hgPineStructureSignal;
G.hgPineObSignal = hgPineObSignal;
G.hgPineDivTags = hgPineDivTags;
})();
