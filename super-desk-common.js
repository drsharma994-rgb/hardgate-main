/* HARDGATE — super-desk-common.js
   Shared helpers for SUPER BEST / SNIPER / BOOK / CALIBRATE conviction desks. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

function N(v){ return Number(v); }

function fmt(n, d){
  d = (d === undefined) ? 2 : d;
  var x = N(n);
  return Number.isFinite(x) ? x.toFixed(d) : '—';
}

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
  });
}

function hgSuperDeskScorecardLink(tabId){
  tabId = tabId || 'super-desk';
  return '<button type="button" class="hg-btn secondary hg-super-scorecard" data-desk="'
    + esc(tabId) + '">SCORECARD validation →</button>';
}

function hgSuperDeskBindScorecard(root){
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('.hg-super-scorecard').forEach(function(btn){
    btn.addEventListener('click', function(){
      if (typeof W.showTab === 'function') W.showTab('scorecard');
    });
  });
}

function hgSuperDeskValidationHtml(win){
  win = win || W;
  if (typeof win.hgValidationPanelHtml !== 'function') return '';
  try{
    var recs = typeof win.hgScoreRecords === 'function' ? win.hgScoreRecords() : [];
    return win.hgValidationPanelHtml(recs);
  }catch(e0){ return ''; }
}

function hgSuperDeskEnrichChartVision(rows, opts){
  opts = opts || {};
  if (!rows || !rows.length || typeof W.hgChartVisionEnrichDeskRows !== 'function') return;
  var wraps = [];
  var i;
  for (i = 0; i < rows.length && wraps.length < (opts.limit || 6); i++){
    var r = rows[i];
    if (!r || !r.dir) continue;
    var rowBars = r.rows || r.rows4h;
    if (!rowBars || rowBars.length < 21) continue;
    if (opts.cleanOnly && !r.minimalLossPass) continue;
    wraps.push({
      sym: r.sym, dir: r.dir, rows: rowBars,
      entry: r.entry, stop: r.stop, t1: r.t1 || r.tp,
      clean7: true, style: opts.style || 'super', asset: opts.asset || 'crypto',
      timeframe: opts.timeframe || '4h', __ref: r
    });
  }
  if (!wraps.length) return;
  W.hgChartVisionEnrichDeskRows(wraps, function(b){ return b.rows; }, {
    limit: opts.limit || 6,
    repaint: opts.repaint || null
  });
}

function hgSuperDeskVisionBlock(row){
  if (!row || typeof W.hgChartVisionCardBlock !== 'function') return '';
  try{ return W.hgChartVisionCardBlock(row) || ''; }catch(e){ return ''; }
}

function hgSuperDeskInjectStyles(cssId, extra){
  if (W['__' + cssId]) return;
  W['__' + cssId] = true;
  if (typeof document === 'undefined') return;
  var st = document.createElement('style');
  st.id = cssId;
  st.textContent = [
    '.hg-super-desk{padding:16px;display:grid;gap:12px}',
    '.hg-super-desk .hg-card{background:var(--panel,#fff);border:1px solid var(--line,#d7dee8);border-radius:var(--radius,8px);padding:14px}',
    '.hg-super-desk .hg-title{font:800 18px/1.2 var(--disp,system-ui);color:var(--txt,#172033)}',
    '.hg-super-desk .hg-note{font:500 12px/1.45 var(--mono,monospace);color:var(--mut,#536175)}',
    '.hg-super-desk .hg-desk{display:grid;gap:10px;max-height:420px;overflow:auto}',
    '.hg-super-desk .hg-desk-card{border:1px solid var(--line,#d7dee8);border-radius:var(--radius-sm,6px);padding:12px;cursor:pointer}',
    '.hg-super-desk .hg-desk-card.sel{border-color:#2563eb;box-shadow:0 0 0 1px #2563eb}',
    '.hg-super-desk .hg-pill{font:700 10px/1 var(--mono,monospace);padding:4px 8px;border-radius:999px;border:1px solid var(--line,#d7dee8)}',
    '.hg-super-desk .hg-pill.clean{color:var(--long,#15803d)}',
    '.hg-super-desk .hg-pill.watch{color:var(--gold,#a67c12);background:#fffbeb}',
    '.hg-super-desk .hg-pill.block{color:var(--short,#dc2626)}',
    '.hg-super-desk .hg-pill.minloss{color:var(--long,#15803d);background:var(--long-bg,#ecfdf5)}',
    '.hg-super-desk .hg-btn{border:0;border-radius:6px;padding:10px 14px;font:700 12px/1.2 var(--mono,monospace);cursor:pointer}',
    '.hg-super-desk .hg-btn.primary{background:linear-gradient(180deg,#2563eb,#1d4ed8);color:#fff}',
    '.hg-super-desk .hg-btn.secondary{background:var(--panel,#fff);border:1px solid var(--line,#d7dee8);color:var(--txt,#172033)}',
    extra || ''
  ].join('\n');
  try{ (document.head || document.documentElement).appendChild(st); }catch(e1){}
}

W.hgSuperDeskFmt = fmt;
W.hgSuperDeskEsc = esc;
W.hgSuperDeskScorecardLink = hgSuperDeskScorecardLink;
W.hgSuperDeskBindScorecard = hgSuperDeskBindScorecard;
W.hgSuperDeskValidationHtml = hgSuperDeskValidationHtml;
W.hgSuperDeskEnrichChartVision = hgSuperDeskEnrichChartVision;
W.hgSuperDeskVisionBlock = hgSuperDeskVisionBlock;
W.hgSuperDeskInjectStyles = hgSuperDeskInjectStyles;

})();
