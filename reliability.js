/* =========================================================================
HARDGATE — reliability.js
RELIABILITY tab: calibration measurement over the scorecard ledger.
Read-only — NEVER writes localStorage. Gates, not scores.

Classic script, IIFE. Loads after scorecard.js and fixpack13-core.js.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;
var __rel = { ui: null, ranOnce: false, busy: false };

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
  });
}

function records(){
  try{ return (typeof W.hgScoreRecords === 'function') ? W.hgScoreRecords() : []; }
  catch(e){ return []; }
}

function settledN(recs){
  var n = 0;
  for (var i = 0; i < recs.length; i++){
    if (recs[i] && recs[i].status === 'settled' && isFinite(+recs[i].r)) n++;
  }
  return n;
}

function fmtPct(x){
  return (typeof x === 'number' && isFinite(x)) ? (x * 100).toFixed(1) + '%' : '—';
}

function fmtR(x){
  if (typeof x !== 'number' || !isFinite(x)) return '—';
  return (x >= 0 ? '+' : '') + x.toFixed(2) + 'R';
}

function pipClass(v){
  if (v === 'CARRIES') return 'ok';
  if (v === 'DRAG') return 'bad';
  if (v === 'NEUTRAL') return 'warn';
  return 'na';
}

function render(ui){
  try{
    if (!ui) return;
    var recs = records();
    var sn = settledN(recs);
    var brierFn = W.hgRelBrier || null;
    var brier = brierFn ? brierFn(recs) : null;
    var noPred = (typeof W.hgRelNoPredictedCount === 'function') ? W.hgRelNoPredictedCount(recs) : 0;

    var header = '';
    if (!brier){
      header = '<div class="note warn">Not enough data — need 20 settled with predicted R:R, have ' + sn
        + (noPred ? ' (' + noPred + ' lack rr1/t1 — excluded from Brier)' : '') + '.</div>';
    } else {
      header = '<div class="grid3">'
        + tile('Brier score', brier.brier.toFixed(4), 'lower = better calibration')
        + tile('Skill vs base rate', (brier.skill * 100).toFixed(1) + '%', '≤0 = tiering adds nothing')
        + tile('Settled n', String(brier.n), 'base hit ' + fmtPct(brier.baseRate))
        + '</div>';
      if (noPred) header += '<div class="note">Excluded from Brier: ' + noPred + ' settled without rr1/t1.</div>';
    }

    var liftRows = (typeof W.hgRelGateLift === 'function') ? W.hgRelGateLift(recs) : [];
    var liftHtml = '<h3 style="margin-top:14px;font-size:11px;letter-spacing:.1em">GATE LIFT — sorted by liftR (avg R with − without layer)</h3>';
    if (!liftRows.length){
      liftHtml += '<div class="note">No layer data yet — log PRIME/HIGH setups on SCORECARD first.</div>';
    } else {
      liftHtml += '<table><tr><th>layer</th><th>verdict</th><th>nWith</th><th>liftR</th><th>win lift</th></tr>';
      for (var i = 0; i < liftRows.length; i++){
        var r = liftRows[i];
        liftHtml += '<tr><td>' + esc(r.layer) + '</td><td><span class="statuschip ' + pipClass(r.verdict) + '">' + esc(r.verdict) + '</span></td>'
          + '<td>' + r.nWith + '</td><td>' + fmtR(r.liftR) + '</td><td>' + (r.lift != null ? fmtPct(r.lift) : '—') + '</td></tr>';
      }
      liftHtml += '</table>';
    }

    var buckets = (typeof W.hgRelBuckets === 'function') ? W.hgRelBuckets(recs) : { byTier: {} };
    var prime = buckets.byTier && buckets.byTier.PRIME;
    var high = buckets.byTier && buckets.byTier.HIGH;
    var tierHtml = '<h3 style="margin-top:14px;font-size:11px;letter-spacing:.1em">TIER CHECK — PRIME vs HIGH</h3><div class="grid2">';
    tierHtml += tierTile('PRIME', prime) + tierTile('HIGH', high) + '</div>';
    if (prime && prime.enough && high && high.enough && prime.realized <= high.realized){
      tierHtml += '<div class="note warn">PRIME is not separating from HIGH (PRIME ' + fmtPct(prime.realized)
        + ' n=' + prime.n + ' · HIGH ' + fmtPct(high.realized) + ' n=' + high.n + ').</div>';
    }

    var curve = (typeof W.hgRelReliabilityCurve === 'function') ? W.hgRelReliabilityCurve(recs, 5) : [];
    var curveHtml = '<h3 style="margin-top:14px;font-size:11px;letter-spacing:.1em">RELIABILITY CURVE</h3>';
    if (!curve.length){
      curveHtml += '<div class="note">Need settled records with rr1 to plot calibration bins.</div>';
    } else {
      curveHtml += '<table><tr><th>bin predicted</th><th>n</th><th>mean pred</th><th>mean realized</th></tr>';
      for (var c = 0; c < curve.length; c++){
        var b = curve[c];
        curveHtml += '<tr><td>' + fmtPct(b.binLo) + '–' + fmtPct(b.binHi) + '</td><td>' + b.nInBin + '</td>'
          + '<td>' + fmtPct(b.meanPredicted) + '</td><td>' + fmtPct(b.meanRealized) + '</td></tr>';
      }
      curveHtml += '</table>';
    }

    if (ui.root){
      ui.root.innerHTML = header + liftHtml + tierHtml + curveHtml
        + '<div class="note" style="margin-top:12px">Measurement only. Nothing here changes a gate automatically — retune by hand in the module that owns the gate.</div>';
    }
  }catch(e){
    if (ui && ui.root) ui.root.innerHTML = '<div class="note warn">render failed: ' + esc(e.message || e) + '</div>';
  }
}

function tile(label, val, sub){
  return '<div class="card"><div class="card__label">' + esc(label) + '</div><div class="card__val hg-num">' + esc(val)
    + '</div><div class="note">' + esc(sub) + '</div></div>';
}

function tierTile(name, b){
  if (!b || !b.enough){
    return '<div class="card"><div class="card__label">' + esc(name) + '</div><div class="note">n&lt;8 — greyed</div></div>';
  }
  return '<div class="card"><div class="card__label">' + esc(name) + '</div><div class="card__val hg-num">' + fmtPct(b.realized)
    + '</div><div class="note">n=' + b.n + ' · avg net ' + fmtR(b.avgNetR) + '</div></div>';
}

function mountReliability(el){
  try{
    if (!el) return;
    el.innerHTML = '<div class="panel"><h2>RELIABILITY <span>calibration over your ledger — Brier, gate lift, tier check</span></h2>'
      + '<div class="note">Read-only measurement on localStorage hg_score_v1. This tab never writes the ledger.</div>'
      + '<div class="note" id="relStat">loaded from stored ledger</div>'
      + '<div id="relBody"></div></div>';
    __rel.ui = { el: el, root: el.querySelector('#relBody'), stat: el.querySelector('#relStat') };
    __rel.ranOnce = true;
    render(__rel.ui);
  }catch(e){
    try{ el.textContent = 'reliability mount failed'; }catch(e2){}
  }
}

async function refreshReliability(){
  try{
    if (__rel.busy) return 'busy';
    if (!__rel.ranOnce || !__rel.ui) return 'skipped: not run yet';
    render(__rel.ui);
    if (__rel.ui.stat) __rel.ui.stat.textContent = 'refreshed · ' + settledN(records()) + ' settled';
    return 'refreshed';
  }catch(e){ return 'error: ' + (e.message || e); }
}

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'reliability', label: 'RELIABILITY', mount: mountReliability, refresh: refreshReliability });

})();
