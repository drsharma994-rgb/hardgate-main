/* =========================================================================
HARDGATE — positioning.js
Cross-venue positioning cross-check (Binance vs Bybit). Pure functions
only — no fetch. Used by SMART $ after both legs are loaded.
========================================================================= */
'use strict';

var FUNDING_EXTREME = 0.05;
var RETAIL_EXTREME_HI = 65;
var RETAIL_EXTREME_LO = 35;

function __crowdedSide(fundingPct){
  if (fundingPct === null || fundingPct === undefined || !isFinite(fundingPct)) return null;
  if (Math.abs(fundingPct) < FUNDING_EXTREME) return 'neutral';
  return fundingPct > 0 ? 'long' : 'short';
}

function __retailSide(retailLongPct){
  if (retailLongPct === null || retailLongPct === undefined || !isFinite(retailLongPct)) return null;
  if (retailLongPct >= RETAIL_EXTREME_HI) return 'long';
  if (retailLongPct <= RETAIL_EXTREME_LO) return 'short';
  return 'neutral';
}

/* bin = {fundingPct, retailLongPct}, byb = same shape from bybitPositioningSnapshot */
function positioningCrossCheck(bin, byb){
  var notes = [];
  var legs = 0, agree = 0, conflict = 0;
  if (!bin) return { status: 'no-bin', legs: 0, agree: 0, conflict: 0, notes: ['Binance leg missing'] };

  if (!byb){
    return { status: 'bybit-dark', legs: 0, agree: 0, conflict: 0,
      notes: ['Bybit cross-check unavailable — Binance read only (not a veto)'] };
  }

  var bf = __crowdedSide(bin.fundingPct);
  var yf = __crowdedSide(byb.fundingPct);
  if (bf && yf){
    legs++;
    if (bf === yf){
      agree++;
      if (bf !== 'neutral'){
        notes.push('funding crowding confirmed on Binance + Bybit (' + bf.toUpperCase() + ' side pays)');
      }
    } else if (bf === 'neutral' || yf === 'neutral'){
      notes.push('funding: one venue calm, one extreme — treat crowding as unconfirmed');
    } else {
      conflict++;
      notes.push('funding CONFLICT: Binance ' + (bin.fundingPct !== null ? bin.fundingPct.toFixed(4) : '—')
        + '% vs Bybit ' + (byb.fundingPct !== null ? byb.fundingPct.toFixed(4) : '—') + '%');
    }
  }

  var br = __retailSide(bin.retailLongPct);
  var yr = __retailSide(byb.retailLongPct);
  if (br && yr){
    legs++;
    if (br === yr){
      agree++;
      if (br !== 'neutral'){
        notes.push('retail extreme confirmed on both venues (' + br.toUpperCase() + ' crowded)');
      }
    } else if (br === 'neutral' || yr === 'neutral'){
      notes.push('retail: one venue extreme, one neutral — contrarian read weaker');
    } else {
      conflict++;
      notes.push('retail CONFLICT: Binance ' + (bin.retailLongPct !== null ? bin.retailLongPct.toFixed(1) : '—')
        + '% long vs Bybit ' + (byb.retailLongPct !== null ? byb.retailLongPct.toFixed(1) : '—') + '% long');
    }
  }

  if (bin.oiChgPct !== null && byb.oiChgPct !== null && isFinite(bin.oiChgPct) && isFinite(byb.oiChgPct)){
    legs++;
    var sameSign = Math.sign(bin.oiChgPct) === Math.sign(byb.oiChgPct) || Math.abs(bin.oiChgPct) < 1 || Math.abs(byb.oiChgPct) < 1;
    if (sameSign){ agree++; notes.push('OI Δ direction agrees (' + bin.oiChgPct.toFixed(1) + '% / ' + byb.oiChgPct.toFixed(1) + '%)'); }
    else { conflict++; notes.push('OI Δ diverges: Binance ' + bin.oiChgPct.toFixed(1) + '% vs Bybit ' + byb.oiChgPct.toFixed(1) + '%'); }
  }

  var status = 'neutral';
  if (conflict > 0) status = 'conflict';
  else if (agree >= 2) status = 'confirmed';
  else if (agree === 1) status = 'partial';

  return { status: status, legs: legs, agree: agree, conflict: conflict, notes: notes };
}

function positioningCrossHTML(cross){
  if (!cross || !cross.notes || !cross.notes.length) return '';
  var cls = cross.status === 'confirmed' ? 'ok' : (cross.status === 'conflict' ? 'veto' : '');
  return '<div class="hgwatch-cross">'
    + '<span class="gpip ' + cls + '">CROSS-VENUE ' + (cross.status || 'n/a').toUpperCase() + '</span> '
    + cross.notes.map(function(n){ return escPos(n); }).join(' · ')
    + '</div>';
}

function escPos(s){
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* Unified positioning classifier — shared by SMART $ (smartClassify) and OI FLOW
   (oiflowClassify). Accepts chg24/pxChg, oiChgPct/oiChg, fundingPct, fundingZ,
   retailLongPct/longPct, topLongPct, takerRatio/takerAvg. Returns lowercase dir
   for smartSetup plus optional dirUpper for legacy OI FLOW cards. */
function hgPositioningClassify(d, opts){
  opts = opts || {};
  d = d || {};
  function num(x){ return (typeof x === 'number' && isFinite(x)) ? x : null; }
  var pxDead = (opts.pxDeadzone !== undefined) ? +opts.pxDeadzone : 0.25;
  var oiDead = (opts.oiDeadzone !== undefined) ? +opts.oiDeadzone : 1;
  var fundExt = (opts.fundingExtreme !== undefined) ? +opts.fundingExtreme : FUNDING_EXTREME;
  var fundZExt = (opts.fundingZExtreme !== undefined) ? +opts.fundingZExtreme : 2;
  var pxChg = num(d.chg24); if (pxChg === null) pxChg = num(d.pxChg);
  var oiChg = num(d.oiChgPct); if (oiChg === null) oiChg = num(d.oiChg);
  var fundingPct = num(d.fundingPct);
  var fundingZ = num(d.fundingZ);
  var retailLongPct = num(d.retailLongPct); if (retailLongPct === null) retailLongPct = num(d.longPct);
  var topLongPct = num(d.topLongPct);
  var takerRatio = num(d.takerRatio); if (takerRatio === null) takerRatio = num(d.takerAvg);

  var longEv = [], shortEv = [], regime = [];
  var up = pxChg !== null && pxChg >= pxDead, dn = pxChg !== null && pxChg <= -pxDead;
  var oiUp = oiChg !== null && oiChg >= oiDead, oiDn = oiChg !== null && oiChg <= -oiDead;
  var fundExtreme = fundingPct !== null && Math.abs(fundingPct) >= fundExt;

  if (pxChg !== null && oiChg !== null){
    var qdetail = ' · px ' + (pxChg >= 0 ? '+' : '') + pxChg.toFixed(1) + '% / OI ' + (oiChg >= 0 ? '+' : '') + oiChg.toFixed(1) + '%';
    if (opts.style === 'oiflow'){
      if (up && oiUp){ regime.push('NEW LONGS (trend fuel)'); longEv.push('NEW LONGS (trend fuel)' + qdetail); }
      else if (up && oiDn){ regime.push('SHORT COVERING (weak rally)'); shortEv.push('SHORT COVERING (weak rally)' + qdetail); }
      else if (dn && oiUp){ regime.push('NEW SHORTS (trend fuel)'); shortEv.push('NEW SHORTS (trend fuel)' + qdetail); }
      else if (dn && oiDn){ regime.push('LONG FLUSH (capitulation)'); longEv.push('LONG FLUSH (capitulation)' + qdetail); }
    } else {
      if (up && oiUp){ regime.push('new longs entering'); if (!fundExtreme) longEv.push('trend fuel: price+OI rising'); }
      else if (up && oiDn){ regime.push('short-covering rally — fade risk'); shortEv.push('covering rally: price up, OI down'); }
      else if (dn && oiUp){ regime.push('new shorts entering'); if (!fundExtreme) shortEv.push('trend fuel: price down, OI rising'); }
      else if (dn && oiDn){ regime.push('long liquidation — capitulation watch'); longEv.push('capitulation: price down, OI down'); }
    }
  }

  if (fundingZ !== null){
    if (fundingZ >= fundZExt) shortEv.push('CROWDED LONG (squeeze-down risk) · funding z +' + fundingZ.toFixed(2));
    else if (fundingZ <= -fundZExt) longEv.push('CROWDED SHORT (squeeze-up risk) · funding z ' + fundingZ.toFixed(2));
  }
  if (fundExtreme){
    if (fundingPct > 0){
      regime.push('longs crowded (funding)');
      shortEv.push('funding extreme +' + fundingPct.toFixed(4) + '%/8h — longs pay');
    } else {
      regime.push('shorts crowded (funding)');
      longEv.push('funding extreme ' + fundingPct.toFixed(4) + '%/8h — shorts pay');
    }
  }

  if (retailLongPct !== null){
    if (retailLongPct >= RETAIL_EXTREME_HI){
      regime.push(opts.style === 'oiflow' ? 'retail extremely long' : 'retail extremely long');
      if (opts.style === 'oiflow'){
        shortEv.push('RETAIL MAX LONG (fade) · ' + retailLongPct.toFixed(1) + '% long');
      } else {
        shortEv.push('retail ' + retailLongPct.toFixed(1) + '% long (≥65) — contrarian');
      }
    } else if (retailLongPct <= RETAIL_EXTREME_LO){
      regime.push('retail extremely short');
      if (opts.style === 'oiflow'){
        longEv.push('RETAIL MAX SHORT (fade) · ' + retailLongPct.toFixed(1) + '% long');
      } else {
        longEv.push('retail ' + retailLongPct.toFixed(1) + '% long (≤35) — contrarian');
      }
    }
  }

  if (topLongPct !== null && retailLongPct !== null){
    var diff = topLongPct - retailLongPct;
    if (diff >= 15){ regime.push('top traders long vs retail'); longEv.push('smart $: top−retail +' + diff.toFixed(1) + 'pp — follow top traders'); }
    else if (diff <= -15){ regime.push('top traders short vs retail'); shortEv.push('smart $: top−retail ' + diff.toFixed(1) + 'pp — follow top traders'); }
  }

  if (takerRatio !== null){
    var tBuy = (opts.takerBuy !== undefined) ? +opts.takerBuy : 1.1;
    var tSell = (opts.takerSell !== undefined) ? +opts.takerSell : 0.9;
    if (opts.style === 'oiflow'){
      if (takerRatio >= tBuy) longEv.push('AGGRESSIVE BUYERS · taker ' + takerRatio.toFixed(3));
      else if (takerRatio <= tSell) shortEv.push('AGGRESSIVE SELLERS · taker ' + takerRatio.toFixed(3));
    } else {
      if (takerRatio >= tBuy) longEv.push('taker buy/sell ' + takerRatio.toFixed(2) + ' (≥' + tBuy + ') — aggressive buyers');
      else if (takerRatio <= tSell) shortEv.push('taker buy/sell ' + takerRatio.toFixed(2) + ' (≤' + tSell + ') — aggressive sellers');
    }
  }

  var dir = longEv.length > shortEv.length ? 'long' : (shortEv.length > longEv.length ? 'short' : null);
  var score = Math.abs(longEv.length - shortEv.length);
  var evidence = dir === 'long' ? longEv.slice() : (dir === 'short' ? shortEv.slice() : []);
  var fundingFade = fundExtreme || (fundingZ !== null && Math.abs(fundingZ) >= fundZExt);
  var out = {
    dir: dir,
    dirUpper: dir ? dir.toUpperCase() : null,
    longEv: longEv,
    shortEv: shortEv,
    regime: regime,
    score: score,
    total: longEv.length + shortEv.length,
    evidence: evidence,
    fundingFade: fundingFade
  };
  if (opts.dirCase === 'upper'){
    out.dir = out.dirUpper;
  }
  return out;
}

var Gpos = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
Gpos.hgPositioningClassify = hgPositioningClassify;
Gpos.positioningCrossCheck = positioningCrossCheck;
Gpos.positioningCrossHTML = positioningCrossHTML;
