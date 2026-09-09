/* =============================================================================
   hg-perf-panel.js — Kind Performance Panel for omniroute, omnigold,
   reversalsniper (v688).

   Purpose. The forward log has been recording outcomes since v680. G6
   (v685) vetoes measured losers, G7 (v687) promotes measured winners.
   But the raw evidence \u2014 which kinds are actually winning, which are
   actually losing \u2014 has never been shown to the user directly. They
   have to trust that the veto/promotion is working without seeing the
   underlying data.

   This module renders a compact panel per tab: top 5 winning kinds and
   top 5 losing kinds, each row showing sample count / hit rate / expR.
   Reads only from hgFwdPool() and hgFwdStats(); adds no new scans, no
   new writes, no ranking changes.

   Grade coloring reuses the SOLIDITY chip classes so the panel looks
   like every other stats surface in the app:
     * PRIME (expR >= +0.5R, samples >= 20) -> gpip ok
     * SOLID (0 <= expR < +0.5R, samples >= 20) -> gpip ok
     * MIXED (-0.25 <= expR < 0, samples >= 20) -> gpip caution
     * LOSER (expR < -0.25, samples >= 20) -> gpip veto
     * THIN (samples < 20) -> gpip dim
   ========================================================================= */
(function(){
  'use strict';
  var G = (typeof window !== 'undefined') ? window : globalThis;

  var HG_PERF_MIN_SAMPLES = 20;
  var HG_PERF_TOP_N = 5;
  var HG_PERF_EDGE_PRIME = 0.5;
  var HG_PERF_EDGE_FLOOR = -0.25;

  function _fin(x){ x = +x; return isFinite(x) ? x : NaN; }
  function _esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Grade a single mechanic's stats into the panel's five buckets. This
     mirrors the SOLIDITY grade system but for a KIND rather than a single
     card, so the labels are worded for kind-level performance. */
  function hgPerfGradeKind(stats){
    if (!stats) return { label: 'THIN', cls: 'dim' };
    var s = _fin(stats.samples);
    if (!isFinite(s) || s < HG_PERF_MIN_SAMPLES){
      return { label: 'THIN', cls: 'dim', reason: (s || 0) + '<' + HG_PERF_MIN_SAMPLES + ' samples' };
    }
    var expR = _fin(stats.expR);
    if (!isFinite(expR)) return { label: 'THIN', cls: 'dim', reason: 'no expR' };
    if (expR >= HG_PERF_EDGE_PRIME) return { label: 'PRIME', cls: 'ok', reason: 'expR ' + expR.toFixed(2) + 'R' };
    if (expR >= 0) return { label: 'SOLID', cls: 'ok', reason: 'expR ' + expR.toFixed(2) + 'R' };
    if (expR >= HG_PERF_EDGE_FLOOR) return { label: 'MIXED', cls: 'caution', reason: 'expR ' + expR.toFixed(2) + 'R' };
    return { label: 'LOSER', cls: 'veto', reason: 'expR ' + expR.toFixed(2) + 'R' };
  }

  /* Given a tab id, return a sorted array of { kind, stats, grade } rows
     for every mechanic that tab has recorded. Sort: samples-eligible rows
     first (samples >= HG_PERF_MIN_SAMPLES) by expR desc, then thin rows
     (unmeasured) by sample count desc so the user can see what's about
     to graduate into scored territory. */
  function hgPerfRows(tab){
    if (!tab || typeof G.hgFwdPool !== 'function') return [];
    var pool;
    try { pool = G.hgFwdPool(String(tab)); }
    catch(e){ return []; }
    if (!pool || typeof pool !== 'object') return [];
    var rows = [];
    for (var kind in pool){
      if (!Object.prototype.hasOwnProperty.call(pool, kind)) continue;
      var stats = pool[kind] || {};
      rows.push({ kind: kind, stats: stats, grade: hgPerfGradeKind(stats) });
    }
    rows.sort(function(a, b){
      var aSized = _fin(a.stats.samples) >= HG_PERF_MIN_SAMPLES;
      var bSized = _fin(b.stats.samples) >= HG_PERF_MIN_SAMPLES;
      if (aSized !== bSized) return bSized ? 1 : -1;
      if (aSized && bSized){
        var ae = _fin(a.stats.expR); var be = _fin(b.stats.expR);
        ae = isFinite(ae) ? ae : -Infinity;
        be = isFinite(be) ? be : -Infinity;
        if (be !== ae) return be - ae;
      }
      return (_fin(b.stats.samples) || 0) - (_fin(a.stats.samples) || 0);
    });
    return rows;
  }

  /* Split rows into top winners and top losers among the SAMPLES-ELIGIBLE
     set. Kinds without enough samples never appear here (they're neither
     winning nor losing measurably). Returns { winners, losers, totalKinds,
     eligibleKinds } for the panel HTML to render. */
  function hgPerfSummary(tab){
    var rows = hgPerfRows(tab);
    var eligible = rows.filter(function(r){ return _fin(r.stats.samples) >= HG_PERF_MIN_SAMPLES; });
    var winners = eligible.filter(function(r){ return _fin(r.stats.expR) > 0; })
      .slice(0, HG_PERF_TOP_N);
    var losers = eligible.filter(function(r){ return _fin(r.stats.expR) <= 0; })
      /* reverse-sort losers so worst appears first */
      .sort(function(a, b){ return _fin(a.stats.expR) - _fin(b.stats.expR); })
      .slice(0, HG_PERF_TOP_N);
    return {
      winners: winners,
      losers: losers,
      totalKinds: rows.length,
      eligibleKinds: eligible.length,
      minSamples: HG_PERF_MIN_SAMPLES
    };
  }

  /* Render one row of the panel. Two column layout: kind on left, stats
     chip on right. */
  function hgPerfRowHtml(row){
    if (!row) return '';
    var s = row.stats || {};
    var samples = _fin(s.samples) || 0;
    var hit = _fin(s.hit);
    var expR = _fin(s.expR);
    var hitStr = isFinite(hit) ? (Math.round(hit * 100) + '%') : '?';
    var expRStr = isFinite(expR) ? (expR >= 0 ? '+' : '') + expR.toFixed(2) + 'R' : '?R';
    var chipCls = row.grade && row.grade.cls ? row.grade.cls : 'dim';
    var chipLabel = row.grade && row.grade.label ? row.grade.label : 'THIN';
    return '<div class="hg-perf-row" style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid var(--hg-line, rgba(255,255,255,0.05));font-size:11px">'
      + '<span style="font-family:monospace">' + _esc(row.kind) + '</span>'
      + '<span style="display:flex;gap:8px;align-items:center">'
      + '<span style="opacity:0.7">n=' + samples + ' \u00b7 ' + hitStr + ' \u00b7 ' + expRStr + '</span>'
      + '<span class="gpip ' + chipCls + '" style="font-size:10px">' + chipLabel + '</span>'
      + '</span>'
      + '</div>';
  }

  /* Render the full panel HTML for a tab. Empty state: shown when the log
     has no eligible mechanics for this tab yet (still recording). */
  function hgPerfPanelHtml(tab, opts){
    opts = opts || {};
    var sum = hgPerfSummary(tab);
    var title = opts.title || ('KIND PERFORMANCE \u00b7 ' + tab);
    var subtitle = 'measured over ' + sum.eligibleKinds + '/' + sum.totalKinds
      + ' kinds with \u2265 ' + sum.minSamples + ' samples';
    var html = '<div class="hg-perf-panel" style="margin-top:10px;padding:8px;border:1px solid var(--hg-line, rgba(255,255,255,0.1));border-radius:6px;background:var(--hg-panel-bg, rgba(255,255,255,0.02))">';
    html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">';
    html += '<span style="font-weight:600;font-size:11px;letter-spacing:0.05em">' + _esc(title) + '</span>';
    html += '<span style="opacity:0.6;font-size:10px">' + _esc(subtitle) + '</span>';
    html += '</div>';
    if (sum.eligibleKinds === 0){
      html += '<div style="opacity:0.6;font-size:11px;padding:6px 0">No kinds have reached ' + sum.minSamples + ' recorded outcomes yet. Panel will populate as the forward log accumulates.</div>';
      html += '</div>';
      return html;
    }
    /* Winners */
    if (sum.winners.length){
      html += '<div style="margin-top:4px">';
      html += '<div style="font-size:10px;opacity:0.7;letter-spacing:0.05em;margin-bottom:2px">TOP WINNERS</div>';
      for (var i = 0; i < sum.winners.length; i++){
        html += hgPerfRowHtml(sum.winners[i]);
      }
      html += '</div>';
    }
    /* Losers */
    if (sum.losers.length){
      html += '<div style="margin-top:8px">';
      html += '<div style="font-size:10px;opacity:0.7;letter-spacing:0.05em;margin-bottom:2px">TOP LOSERS</div>';
      for (var j = 0; j < sum.losers.length; j++){
        html += hgPerfRowHtml(sum.losers[j]);
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  /* --- expose ----------------------------------------------------------- */
  G.hgPerfGradeKind = hgPerfGradeKind;
  G.hgPerfRows = hgPerfRows;
  G.hgPerfSummary = hgPerfSummary;
  G.hgPerfRowHtml = hgPerfRowHtml;
  G.hgPerfPanelHtml = hgPerfPanelHtml;
  G.HG_PERF_PANEL_VERSION = 'v688';
  G.HG_PERF_MIN_SAMPLES = HG_PERF_MIN_SAMPLES;
  G.HG_PERF_EDGE_PRIME = HG_PERF_EDGE_PRIME;
  G.HG_PERF_EDGE_FLOOR = HG_PERF_EDGE_FLOOR;
})();
