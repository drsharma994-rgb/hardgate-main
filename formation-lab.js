/* =========================================================================
HARDGATE — formation-lab.js
FORMATION LAB tab: AI4Finance-inspired validation desk — meta-labeling (MLFinLab),
purged CV gate replay, QuantStats-style tear sheet, and TradingAgents-style
bull/bear debate on live setups. Advisory only — never auto-trades.

Classic script, IIFE. Loads after scorecard.js, meta-label.js, tear-sheet.js,
purged-cv.js, agent-debate.js, formation.js. Never throws at load time.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

function esc(s){
  if (typeof W.hgEsc === 'function') return W.hgEsc(s);
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtR(x){
  if (typeof x !== 'number' || !isFinite(x)) return '—';
  return (x >= 0 ? '+' : '') + x.toFixed(2) + 'R';
}

function fmtPct(x, d){
  d = d != null ? d : 1;
  if (typeof x !== 'number' || !isFinite(x)) return '—';
  return (x * 100).toFixed(d) + '%';
}

function records(){
  try{
    return (typeof W.hgScoreRecords === 'function') ? W.hgScoreRecords() : [];
  }catch(e){ return []; }
}

function collectLiveSetups(){
  var out = [], seen = {};
  function add(s){
    if (!s || !s.sym || !s.dir) return;
    var key = s.sym + '|' + s.dir + '@' + (isFinite(+s.entry) ? s.entry : 'na');
    if (seen[key]) return;
    seen[key] = true;
    out.push(s);
  }
  try{
    var snap = typeof W.bestScan === 'function' ? W.bestScan() : null;
    if (snap && snap.clean){
      for (var i = 0; i < snap.clean.length; i++) add(snap.clean[i]);
    }
  }catch(e1){}
  try{
    var swing = typeof W.swingScan === 'function' ? W.swingScan() : null;
    if (swing && swing.hits){
      for (var j = 0; j < Math.min(swing.hits.length, 5); j++) add(swing.hits[j]);
    }
  }catch(e2){}
  try{
    var scalp = typeof W.scalpScan === 'function' ? W.scalpScan() : null;
    if (scalp && scalp.hits){
      for (var k = 0; k < Math.min(scalp.hits.length, 5); k++) add(scalp.hits[k]);
    }
  }catch(e3){}
  return out.slice(0, 8);
}

function tearSheetHtml(recs){
  if (typeof W.hgTearSheet !== 'function'){
    return '<div class="note">tear sheet module not loaded</div>';
  }
  var ts = W.hgTearSheet(recs);
  if (!ts.ok){
    return '<div class="note">' + esc(ts.note || 'no data') + ' — log trades on SCORECARD first</div>';
  }
  var pf = ts.profitFactor === Infinity ? '∞' : (isFinite(ts.profitFactor) ? ts.profitFactor.toFixed(2) : '—');
  var nSub = ts.nLabel || (ts.n + ' settled');
  var h = '<div class="grid3" style="margin-top:8px">';
  h += tile('Win rate', fmtPct(ts.winRate), nSub);
  h += tile('Expectancy', fmtR(ts.expectancy), 'avg R per trade');
  h += tile('Profit factor', pf, 'gross win / gross loss');
  h += tile('Total R', fmtR(ts.totalR), 'cumulative edge');
  h += tile('Max DD', fmtR(ts.maxDrawdownR), 'peak-to-trough on R curve');
  h += tile('Sharpe proxy', ts.sharpeProxy != null ? ts.sharpeProxy.toFixed(2) : '—', 'mean/std on R');
  if (ts.deflatedSharpe && ts.deflatedSharpe.deflated != null){
    h += tile('Deflated Sharpe', ts.deflatedSharpe.deflated.toFixed(2), 'Bailey & LdP · trials=' + ts.deflatedSharpe.numTrials);
  }
  h += tile('Sortino proxy', ts.sortinoProxy === Infinity ? '∞' : (ts.sortinoProxy != null ? ts.sortinoProxy.toFixed(2) : '—'), 'downside-adjusted');
  h += tile('Win streak', String(ts.maxWinStreak), 'longest green run');
  h += tile('Loss streak', String(ts.maxLossStreak), 'longest red run');
  h += '</div>';
  return h;
}

function tile(label, val, sub){
  return '<div class="card"><div class="card__label">' + esc(label) + '</div>'
    + '<div class="card__val hg-num">' + esc(val) + '</div>'
    + '<div class="note">' + esc(sub) + '</div></div>';
}

function metaLabelPanel(recs){
  if (typeof W.hgMetaLabel !== 'function') return '';
  var setups = collectLiveSetups();
  if (!setups.length){
    return '<div class="note">Run SWING/SCALP/BEST scan — meta-labels appear on live setups here</div>';
  }
  var h = '<table class="hg-table" style="margin-top:8px"><thead><tr>'
    + '<th>sym</th><th>dir</th><th>verdict</th><th class="hg-right">p(take)</th><th>reason</th></tr></thead><tbody>';
  for (var i = 0; i < setups.length; i++){
    var s = setups[i];
    var ml = W.hgMetaLabel(s, {}, recs);
    s.metaLabel = ml;
    var cls = ml.take ? 'pos' : 'neg';
    h += '<tr><td>' + esc(s.sym) + '</td><td>' + esc(String(s.dir).toUpperCase()) + '</td>'
      + '<td class="' + cls + '">' + esc(ml.verdict) + '</td>'
      + '<td class="hg-num hg-right">' + Math.round(ml.prob * 100) + '%</td>'
      + '<td class="note">' + esc(ml.reason) + '</td></tr>';
  }
  h += '</tbody></table>';
  return h;
}

function debatePanel(){
  if (typeof W.hgAgentDebate !== 'function') return '';
  var setups = collectLiveSetups();
  if (!setups.length) return '<div class="note">No live setups — debate panel fills after a scan</div>';
  var s = setups[0];
  if (typeof W.hgMetaLabel === 'function'){
    s.metaLabel = W.hgMetaLabel(s, {}, records());
  }
  var d = W.hgAgentDebate(s);
  var h = '<div class="note" style="margin-top:6px"><b>' + esc(d.summary) + '</b></div>';
  h += '<div class="grid2" style="margin-top:8px">';
  h += '<div class="hg-panel"><div class="hg-panel__legend pos">Bull case</div><ul style="margin:6px 0 0 16px;line-height:1.6">';
  for (var i = 0; i < d.bull.length; i++) h += '<li>' + esc(d.bull[i]) + '</li>';
  h += '</ul></div>';
  h += '<div class="hg-panel"><div class="hg-panel__legend neg">Bear case</div><ul style="margin:6px 0 0 16px;line-height:1.6">';
  for (var j = 0; j < d.bear.length; j++) h += '<li>' + esc(d.bear[j]) + '</li>';
  h += '</ul></div></div>';
  h += '<div class="note" style="margin-top:6px">Risk manager: <b>' + esc(d.risk.verdict) + '</b>'
    + ' · suggested size ×' + d.risk.sizeAdj + ' · score ' + d.risk.score + '</div>';
  return h;
}

function purgedReplayPanel(){
  if (typeof W.cgGateReplay !== 'function' || typeof W.hgReplaySweepPurged !== 'function'){
    return '<div class="note">Gate replay modules not loaded — purged CV unavailable</div>';
  }
  var h = '<div class="note">Purged CV removes overlapping train samples before OOS gate threshold validation (MLFinLab-style).</div>';
  h += '<div class="note" id="flabReplayStat" style="margin-top:6px">Press RUN PURGED REPLAY to sweep ADX gate on synthetic replay (demo).</div>';
  h += '<div class="row" style="margin-top:8px"><button class="btn" id="flabReplayBtn">RUN PURGED REPLAY</button></div>';
  h += '<div id="flabReplayOut"></div>';
  return h;
}

function runPurgedDemo(ui){
  if (!ui || !ui.replayOut) return;
  ui.replayOut.innerHTML = '<div class="note">running…</div>';
  try{
    var rows = [];
    var p = 100;
    for (var i = 0; i < 300; i++){
      p = p * (1 + (Math.sin(i / 17) * 0.008) + ((i % 7 === 0) ? 0.012 : -0.004));
      rows.push({ t: i * 14400, o: p, h: p * 1.01, l: p * 0.99, c: p, v: 1000 });
    }
    var replay = W.cgGateReplay(rows, { symbol: 'DEMOUSDT', fundingPct: 0.01 }, {});
    var thresholds = [];
    for (var t = 14; t <= 32; t += 2) thresholds.push(t);
    var plain = typeof W.hgReplaySweepOos === 'function'
      ? W.hgReplaySweepOos(replay, 'adx', thresholds, 'min')
      : null;
    var purged = W.hgReplaySweepPurged(replay, 'adx', thresholds, 'min', { labelHorizon: 14, embargo: 7 });
    var html = '<table class="hg-table" style="margin-top:8px"><thead><tr><th>method</th><th>train/test</th><th>OOS E[R]</th><th>verdict</th></tr></thead><tbody>';
    if (plain && plain.oos){
      html += '<tr><td>standard 70/30</td><td>' + esc(plain.note || '') + '</td><td class="hg-num">' + fmtR(plain.oos.expectancyR) + '</td><td>' + esc(plain.oos.verdict || '—') + '</td></tr>';
    }
    if (purged){
      html += '<tr><td>purged CV</td><td>' + esc(purged.note || '') + '</td><td class="hg-num">' + (purged.oos ? fmtR(purged.oos.expectancyR) : '—') + '</td><td>' + esc(purged.oos ? purged.oos.verdict : '—') + '</td></tr>';
      if (purged.purged) html += '<tr><td colspan="4" class="note">purged ' + purged.purged.count + ' overlapping samples · embargo ' + purged.purged.embargo + ' bars</td></tr>';
    }
    html += '</tbody></table>';
    ui.replayOut.innerHTML = html;
    if (ui.replayStat) ui.replayStat.textContent = 'purged replay complete · ' + (replay.samples ? replay.samples.length : 0) + ' samples';
  }catch(e){
    ui.replayOut.innerHTML = '<div class="note neg">replay failed: ' + esc(String(e && e.message || e)) + '</div>';
  }
}

function render(ui){
  if (!ui || !ui.root) return;
  var recs = records();
  var params = typeof W.hgFormationParams === 'function' ? W.hgFormationParams() : null;
  var html = '';
  html += '<div class="note">Formation params: <span class="hg-num">' + esc(params ? params.source : 'defaults') + '</span>'
    + (params && params.fqsFloor ? ' · FQS floor ' + params.fqsFloor : '') + '</div>';
  html += '<div class="hg-panel__legend" style="margin-top:14px">Tear sheet (QuantStats-style)</div>';
  html += tearSheetHtml(recs);
  if (typeof W.hgValidationPanelHtml === 'function'){
    html += W.hgValidationPanelHtml(recs);
  }
  html += '<hr class="sep">';
  html += '<div class="hg-panel__legend">Meta-label overlay (MLFinLab)</div>';
  html += metaLabelPanel(recs);
  html += '<hr class="sep">';
  html += '<div class="hg-panel__legend">Agent debate (TradingAgents-style)</div>';
  html += debatePanel();
  html += '<hr class="sep">';
  html += '<div class="hg-panel__legend">Purged gate replay</div>';
  html += purgedReplayPanel();
  ui.root.innerHTML = html;
  ui.replayBtn = ui.root.querySelector('#flabReplayBtn');
  ui.replayOut = ui.root.querySelector('#flabReplayOut');
  ui.replayStat = ui.root.querySelector('#flabReplayStat');
  if (ui.replayBtn) ui.replayBtn.addEventListener('click', function(){ runPurgedDemo(ui); });
}

var __fl = { ui: null, busy: false };

function mountFormationLab(el){
  try{
    if (!el) return;
    el.innerHTML = '<div class="panel">'
      + '<h2>Formation Lab <span>AI4Finance validation desk · meta-label · purged CV · tear sheet · agent debate</span></h2>'
      + '<div class="note">Robust setup formation validation inspired by MLFinLab, QuantStats, and TradingAgents. '
      + 'Meta-labels filter primary signals; purged CV prevents lookahead in gate calibration; '
      + 'the tear sheet proves edge with honest R-multiples from SCORECARD.</div>'
      + '<div class="note" id="flabStat" style="margin-top:6px">ready</div>'
      + '<div id="flabRoot" style="margin-top:10px"></div>'
      + '</div>';
    var ui = { el: el, root: el.querySelector('#flabRoot'), stat: el.querySelector('#flabStat') };
    __fl.ui = ui;
    render(ui);
  }catch(e){
    try{ el.innerHTML = '<div class="empty">formation lab mount failed</div>'; }catch(e2){}
  }
}

async function refreshFormationLab(){
  try{
    if (__fl.busy) return 'busy';
    __fl.busy = true;
    if (__fl.ui) render(__fl.ui);
    if (__fl.ui && __fl.ui.stat) __fl.ui.stat.textContent = 'refreshed · ' + new Date().toTimeString().slice(0, 8);
    return 'refreshed';
  }catch(e){
    return 'error';
  }finally{
    __fl.busy = false;
  }
}

try{
  W.HG_tabs = W.HG_tabs || [];
  W.HG_tabs.push({ id: 'formationlab', label: 'FORMATION LAB', mount: mountFormationLab, refresh: refreshFormationLab });
}catch(e){}

})();
