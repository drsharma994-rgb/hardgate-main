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
