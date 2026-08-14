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
    '.hg-super-desk{padding:16px;display:grid;gap:12px;max-width:1200px}',
    '.hg-super-desk .hg-super-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}',
    '.hg-super-desk .hg-super-badge{font:700 11px/1.2 var(--mono,monospace);padding:6px 10px;border-radius:999px;background:var(--panel2,#edf1f6);color:var(--txt,#172033);border:1px solid var(--line,#d7dee8);white-space:nowrap}',
    '.hg-super-desk .hg-super-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}',
    '.hg-super-desk .hg-card{grid-column:span 12;background:var(--panel,#fff);border:1px solid var(--line,#d7dee8);border-radius:var(--radius,8px);padding:14px;box-shadow:var(--shadow-sm,0 1px 2px rgba(23,32,51,.06))}',
    '.hg-super-desk .hg-card h3{margin:0 0 10px;font:700 13px/1.2 var(--disp,system-ui);color:var(--txt,#172033);letter-spacing:.06em;text-transform:uppercase}',
    '.hg-super-desk .hg-title{font:800 18px/1.2 var(--disp,system-ui);color:var(--txt,#172033)}',
    '.hg-super-desk .hg-note{font:500 12px/1.45 var(--mono,monospace);color:var(--mut,#536175)}',
    '.hg-super-desk .hg-scan-stat{font:600 12px/1.45 var(--mono,monospace);color:var(--mut,#536175);margin-top:4px}',
    '.hg-super-desk .hg-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px}',
    '.hg-super-desk .hg-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
    '.hg-super-desk .hg-field{display:grid;gap:6px}',
    '.hg-super-desk .hg-field label{font:600 11px/1.2 var(--mono,monospace);color:var(--mut,#536175);letter-spacing:.04em}',
    '.hg-super-desk .hg-field input{width:100%;box-sizing:border-box;border:1px solid var(--line-strong,#aab7c8);background:var(--panel,#fff);color:var(--txt,#172033);border-radius:var(--radius-sm,6px);padding:10px 12px;font:500 13px/1.2 var(--mono,monospace)}',
    '.hg-super-desk .hg-desk{display:grid;gap:10px;max-height:420px;overflow:auto;margin-top:12px}',
    '.hg-super-desk .hg-desk-card{border:1px solid var(--line,#d7dee8);border-radius:var(--radius-sm,6px);padding:12px;background:var(--panel,#fff);cursor:pointer}',
    '.hg-super-desk .hg-desk-card:hover{border-color:var(--line-strong,#aab7c8);box-shadow:var(--shadow-sm,0 1px 2px rgba(23,32,51,.06))}',
    '.hg-super-desk .hg-desk-card.sel{border-color:#2563eb;box-shadow:0 0 0 1px #2563eb}',
    '.hg-super-desk .hg-desk-top{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}',
    '.hg-super-desk .hg-desk-sym{font:800 13px/1.2 var(--mono,monospace);color:var(--txt,#172033)}',
    '.hg-super-desk .hg-desk-pills{display:flex;gap:6px;flex-wrap:wrap}',
    '.hg-super-desk .hg-desk-levels{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:10px}',
    '.hg-super-desk .hg-desk-levels .k{font:600 10px/1.2 var(--mono,monospace);color:var(--dim,#65758c)}',
    '.hg-super-desk .hg-desk-levels .v{font:700 12px/1.2 var(--mono,monospace);margin-top:4px;color:var(--txt,#172033)}',
    '.hg-super-desk .hg-pill{font:700 10px/1 var(--mono,monospace);padding:4px 8px;border-radius:999px;border:1px solid var(--line,#d7dee8);background:var(--panel2,#edf1f6)}',
    '.hg-super-desk .hg-pill.clean{color:var(--long,#15803d);border-color:rgba(21,128,61,.25)}',
    '.hg-super-desk .hg-pill.watch{color:var(--gold,#a67c12);border-color:rgba(166,124,18,.35);background:#fffbeb}',
    '.hg-super-desk .hg-pill.block{color:var(--short,#dc2626)}',
    '.hg-super-desk .hg-pill.minloss{color:var(--long,#15803d);border-color:rgba(21,128,61,.35);background:var(--long-bg,#ecfdf5)}',
    '.hg-super-desk .hg-btn{border:0;border-radius:var(--radius-sm,6px);padding:10px 16px;font:700 12px/1.2 var(--mono,monospace);cursor:pointer;letter-spacing:.04em;min-height:40px}',
    '.hg-super-desk .hg-btn.primary{background:linear-gradient(180deg,#2563eb,#0f5cc0);color:#fff;box-shadow:0 2px 8px rgba(15,92,192,.18)}',
    '.hg-super-desk .hg-btn.secondary{background:var(--panel,#fff);color:var(--txt,#172033);border:1px solid var(--line,#d7dee8)}',
    '.hg-super-desk .hg-btn:disabled{opacity:.45;cursor:not-allowed}',
    '@media (max-width:900px){.hg-super-desk{padding:12px}.hg-super-desk .hg-form,.hg-super-desk .hg-desk-levels{grid-template-columns:1fr 1fr}.hg-super-desk .hg-actions .hg-btn{flex:1 1 calc(50% - 5px);min-width:140px}}',
    '@media (max-width:520px){.hg-super-desk .hg-form,.hg-super-desk .hg-desk-levels{grid-template-columns:1fr}.hg-super-desk .hg-actions .hg-btn{flex:1 1 100%}}',
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
