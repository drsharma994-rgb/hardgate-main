/* HARDGATE — formation instrumentation browser bridge (loads after scorecard.js). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function num(v){ var n = +v; return (v === undefined || v === null || v === '' || !isFinite(n)) ? null : n; }
function fpClass(sym){
  var s = String(sym || '').toUpperCase();
  if (/(XAU|PAXG|XAUT|GOLD)/.test(s)) return 'gold';
  if (/^(BTC|WBTC)/.test(s)) return 'btc';
  if (/^(ETH|WETH)/.test(s)) return 'eth';
  return 'alt';
}
function fpKey(rec){
  var side = String(rec.dir || rec.side || 'long').toLowerCase() === 'short' ? 'short' : 'long';
  var tier = String(rec.tier || 'na').toLowerCase();
  return fpClass(rec.sym || rec.symbol) + '|' + side + '|' + tier + '|scorecard';
}
function buildSimpleEdgeTable(records){
  var map = {}, all = { n: 0, sumR: 0 };
  for (var i = 0; i < (records || []).length; i++){
    var r = records[i];
    if (!r || r.status !== 'settled' || !isFinite(+r.r)) continue;
    var k = fpKey(r);
    if (!map[k]) map[k] = { n: 0, sumR: 0, wins: 0 };
    map[k].n++; map[k].sumR += +r.r; if (+r.r > 0) map[k].wins++;
    all.n++; all.sumR += +r.r;
  }
  var rows = [];
  for (var key in map){
    if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
    var s = map[key];
    rows.push({ key: key, n: s.n, expR: s.n ? s.sumR / s.n : 0, winRate: s.n ? s.wins / s.n : 0 });
  }
  rows.sort(function(a, b){ return (b.expR || 0) - (a.expR || 0); });
  return { global: { n: all.n, expR: all.n ? all.sumR / all.n : 0 }, rows: rows };
}

function loadGateStats(){
  try{
    var raw = localStorage.getItem('hg_gate_v1');
    if (!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}

function gateLampClass(vetoRate){
  var v = +vetoRate || 0;
  if (v >= 80) return 'hg-lamp--sole';
  if (v >= 25) return 'hg-lamp--veto';
  return 'hg-lamp--pass';
}

function hgFormationPanelHtml(records){
  try{
    var settled = [];
    for (var i = 0; i < (records || []).length; i++){
      var r = records[i];
      if (r && r.status === 'settled' && isFinite(+r.r)) settled.push(r);
    }
    var tbl = buildSimpleEdgeTable(settled);
    var gates = loadGateStats();
    var h = '<div class="hg-panel" style="margin:10px 0 4px">'
      + '<div class="hg-panel__legend">Formation instr · edge table</div>';
    h += '<div class="note" style="line-height:1.6">GLOBAL&nbsp; <span class="hg-num">n=' + tbl.global.n
      + '</span> · E[R] <span class="hg-num">' + (tbl.global.expR >= 0 ? '+' : '') + (tbl.global.expR || 0).toFixed(2) + '</span></div>';
    if (tbl.rows.length){
      h += '<table class="hg-table" style="margin-top:6px"><thead><tr><th>family</th><th>n</th><th>win%</th><th class="hg-right">E[R]</th></tr></thead><tbody>';
      var show = tbl.rows.slice(0, 5).concat(tbl.rows.length > 10 ? tbl.rows.slice(-5) : []);
      for (var j = 0; j < show.length; j++){
        var row = show[j];
        h += '<tr><td>' + row.key + '</td><td class="hg-num">' + row.n + '</td><td class="hg-num">' + Math.round(row.winRate * 100) + '</td><td class="hg-num hg-right">'
          + (row.expR >= 0 ? '+' : '') + row.expR.toFixed(2) + '</td></tr>';
      }
      h += '</tbody></table>';
    } else {
      h += '<div class="note">no settled R-scored trades yet — FQS/edge table fills as scorecard settles</div>';
    }
    if (typeof G.hgTradingStackPanelHtml === 'function'){
      h += G.hgTradingStackPanelHtml();
    }
    if (typeof G.hgFtEdgePanelHtml === 'function'){
      h += G.hgFtEdgePanelHtml(settled);
    }
    if (typeof G.hgOpenbbDeskPanelHtml === 'function'){
      h += G.hgOpenbbDeskPanelHtml();
    }
    if (typeof G.hgCcxtDeskPanelHtml === 'function'){
      h += G.hgCcxtDeskPanelHtml();
    }
    if (typeof G.hgWorldMonitorDeskPanelHtml === 'function'){
      h += G.hgWorldMonitorDeskPanelHtml();
    }
    if (gates && gates.rows && gates.rows.length){
      h += '<div class="hg-panel__legend" style="margin-top:12px">Gate attrib</div>';
      h += '<div class="hg-gaterow hg-gaterow--wrap" style="margin-bottom:8px">';
      for (var gi = 0; gi < gates.rows.length; gi++){
        var gRow = gates.rows[gi];
        h += '<span class="hg-lamp ' + gateLampClass(gRow.vetoRate) + '" title="pass ' + gRow.pass + ' · veto ' + gRow.veto + '">'
          + String(gRow.gate || '').toUpperCase().slice(0, 8) + '</span>';
      }
      h += '</div>';
      h += '<table class="hg-table"><thead><tr><th>gate</th><th>pass</th><th>veto</th><th class="hg-right">veto%</th></tr></thead><tbody>';
      for (var g = 0; g < gates.rows.length; g++){
        var gr = gates.rows[g];
        h += '<tr><td>' + gr.gate + '</td><td class="hg-num">' + gr.pass + '</td><td class="hg-num">' + gr.veto + '</td><td class="hg-num hg-right">' + gr.vetoRate + '%</td></tr>';
      }
      h += '</tbody></table>';
    }
    h += '<div class="note" style="margin-top:6px">Daemon: set HARDGATE_FQS_GATE=1 / HARDGATE_EDGE_GATE=1 on Render to enable vetoes (default report-only).</div>';
    h += '</div>';
    return h;
  }catch(e){ return ''; }
}

try{
  G.hgFormationPanelHtml = hgFormationPanelHtml;
  G.hgGateStatsSave = function(summary){
    try{ localStorage.setItem('hg_gate_v1', JSON.stringify(summary || {})); return true; }catch(e){ return false; }
  };
}catch(e){}

})();
