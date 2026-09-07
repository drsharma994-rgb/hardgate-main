/* HARDGATE — inc567-regime-panels.js (Increment 5 REGIME Cycle Context + netflow UI) */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function esc(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function hgInc567RegimePanelsHtml(){
  var snap = (typeof G.hgOnchainAltState === 'function') ? G.hgOnchainAltState() : null;
  if (!snap) return '<div class="panel" style="margin-top:10px"><h2>CYCLE CONTEXT <span>on-chain alt</span></h2><div class="note">Run REGIME refresh to load on-chain alt desk.</div></div>';
  var h = '<div class="panel hg-cycle-context" style="margin-top:10px"><h2>CYCLE CONTEXT <span>miner · LTH/STH · netflow · stables</span></h2>';
  if (snap.netflowZ){
    var nz = snap.netflowZ;
    h += '<div class="kv"><span>exchange netflow (BTC 7d z)</span><b>' + esc(nz.regimeLabel || nz.tilt || 'n/a')
      + ' · z=' + (isFinite(nz.z) ? nz.z.toFixed(2) : 'n/a') + '</b></div>';
  }
  if (snap.stableCadence){
    var sc = snap.stableCadence;
    h += '<div class="kv"><span>stablecoin cadence</span><b>' + esc(sc.flowTilt || 'flat')
      + ' · 30d ' + (isFinite(sc.d30Pct) ? sc.d30Pct.toFixed(2) + '%' : 'n/a')
      + (sc.contracting14d ? ' · 14d+ contraction (tighten long R:R +0.5)' : '') + '</b></div>';
  }
  if (snap.tetherPrint && snap.tetherPrint.alert){
    h += '<div class="note warn">' + esc(snap.tetherPrint.message || 'Large Tether print detected') + '</div>';
  }
  if (snap.minerCycle){
    var mc = snap.minerCycle;
    h += '<div class="kv"><span>miner cycle</span><b>' + esc(mc.cycleSignal || 'MID-CYCLE')
      + (mc.puell != null ? ' · Puell ' + mc.puell : '')
      + ' · ribbon ' + esc(mc.hashRibbonState || 'neutral') + '</b></div>';
    if (mc.cycleBottom) h += '<span class="gpip ok">CYCLE BOTTOM — promote BTC/ETH Tier 1 on BEST</span> ';
    if (mc.cycleTop) h += '<span class="gpip veto">CYCLE TOP — veto BTC/ETH longs 30d</span> ';
  }
  if (snap.lthSth){
    var ls = snap.lthSth;
    h += '<div class="kv"><span>LTH/STH supply</span><b>' + esc(ls.phase || 'BALANCED')
      + (ls.lth30dChangePct != null ? ' · LTH 30d ' + ls.lth30dChangePct.toFixed(2) + '%' : '') + '</b></div>';
    if (ls.macroDigitalGoldConvergence){
      h += '<div class="note">' + esc(ls.macroDigitalGoldConvergence.narrative || '') + '</div>';
    }
  }
  if (snap.notes && snap.notes.length){
    h += '<div class="note" style="margin-top:6px">' + esc(snap.notes.join(' · ')) + '</div>';
  }
  return h + '</div>';
}

/** BEST tab modifier from miner cycle context */
function hgBestCycleModifier(sym, dir){
  var snap = (typeof G.hgOnchainAltState === 'function') ? G.hgOnchainAltState() : null;
  if (!snap || !snap.minerCycle) return { ok: true };
  var mc = snap.minerCycle;
  var base = String(sym || '').toUpperCase();
  var isBtcEth = base.indexOf('BTC') >= 0 || base.indexOf('ETH') >= 0;
  if (!isBtcEth) return { ok: true };
  dir = String(dir || '').toLowerCase();
  if (mc.cycleTop && dir === 'long'){
    return { ok: false, veto: true, reason: 'CYCLE TOP — miner/Puell distribution context vetoes BTC/ETH longs' };
  }
  if (mc.cycleBottom && dir === 'long'){
    return { ok: true, promote: true, reason: 'CYCLE BOTTOM — promote Tier 1' };
  }
  return { ok: true };
}

G.hgInc567RegimePanelsHtml = hgInc567RegimePanelsHtml;
G.hgBestCycleModifier = hgBestCycleModifier;
})();
