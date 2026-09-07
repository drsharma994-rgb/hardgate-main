/* HARDGATE — RECON tab: live vs paper execution reconciliation (Increment 7). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
var TAB_ID = 'recon';

function esc(s){
  return String(s || '').replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function $(root, sel){ return root.querySelector(sel); }
function fin(v){ return typeof v === 'number' && isFinite(v); }

function reconBuildPaperLogs(bookSnap){
  var closed = (bookSnap && bookSnap.book && bookSnap.book.closed) || [];
  return closed.map(function(c){
    return {
      id: c.id || c.tradeId,
      sym: c.sym,
      strategy: c.strategy || c.setupKind,
      entry: c.entry,
      exit: c.exit || c.mark,
      closedAt: c.closedAt || c.at,
      expectedFeesUsd: fin(c.feesUsd) ? c.feesUsd : 10
    };
  });
}

function reconBuildLiveFills(blotter){
  blotter = blotter || [];
  var out = [];
  for (var i = 0; i < blotter.length; i++){
    var b = blotter[i];
    if (!b || b.type !== 'execute_ok' && b.type !== 'fill') continue;
    out.push({
      id: b.positionId || b.id,
      entry: b.fillPrice || b.entry,
      exit: b.exitPrice || b.closePrice || b.mark,
      feesUsd: b.feesUsd || b.feeUsd || 0,
      slippageUsd: b.slippageUsd || 0
    });
  }
  return out;
}

function reconRender(root){
  var out = $(root, '#reconOut');
  var stat = $(root, '#reconStat');
  if (!out) return;
  if (typeof G.hgReconcileTrades !== 'function'){
    out.innerHTML = '<div class="empty">portfolio-allocation.js not loaded</div>';
    return;
  }
  var snap = (typeof G.bookState === 'function') ? G.bookState() : null;
  if (!snap || !snap.book){
    out.innerHTML = '<div class="empty">Open BOOK first — no paper ledger to reconcile.</div>';
    if (stat) stat.textContent = 'no book data';
    return;
  }
  var paper = reconBuildPaperLogs(snap);
  var live = reconBuildLiveFills(snap.book.blotter || []);
  var recon = G.hgReconcileTrades(paper, live);
  var healthCls = recon.executionHealth === 'HEALTHY_EXECUTION' ? 'ok' : 'warn';
  var rows = (recon.diffs || []).map(function(d){
    return '<tr><td>' + esc(d.tradeId) + '</td><td>' + esc(d.sym) + '</td><td>' + esc(d.strategy)
      + '</td><td>' + (fin(d.slippagePct) ? d.slippagePct.toFixed(3) + '%' : '—')
      + '</td><td>' + (fin(d.exitSlippagePct) ? d.exitSlippagePct.toFixed(3) + '%' : '—')
      + '</td><td>$' + (fin(d.feeDrift) ? d.feeDrift.toFixed(2) : '—') + '</td></tr>';
  }).join('');
  var weeklyRows = (recon.weeklyByStrategy || []).map(function(w){
    return '<tr><td>' + esc(w.week) + '</td><td>' + esc(w.strategy) + '</td><td>' + w.n
      + '</td><td>$' + (fin(w.slippageUsd) ? w.slippageUsd.toFixed(2) : '0')
      + '</td><td>$' + (fin(w.feeDriftUsd) ? w.feeDriftUsd.toFixed(2) : '0') + '</td></tr>';
  }).join('');
  if (recon.alert && recon.alert.push && typeof G.sendAlertPush === 'function'){
    try{ G.sendAlertPush(recon.alert.title, recon.alert.body, { setup: 'recon', scanner: 'recon' }); }catch(ePush){}
  }
  out.innerHTML = '<div class="verdict ' + healthCls + '"><div class="vword">' + esc(recon.executionHealth) + '</div>'
    + '<div class="vwhy">Reconciled ' + recon.reconciledCount + ' trades · slippage $'
    + (fin(recon.totalSlippageUsd) ? recon.totalSlippageUsd.toFixed(2) : '0')
    + ' · fee drift $' + (fin(recon.totalFeeDriftUsd) ? recon.totalFeeDriftUsd.toFixed(2) : '0') + '</div></div>'
    + '<table class="tbl" style="margin-top:10px"><thead><tr><th>ID</th><th>Sym</th><th>Strategy</th><th>Entry slip</th><th>Exit slip</th><th>Fee drift</th></tr></thead>'
    + '<tbody>' + (rows || '<tr><td colspan="6">No matched paper/live fills yet — execute brackets to populate.</td></tr>') + '</tbody></table>'
    + '<h3 style="margin-top:12px">Weekly per-strategy divergence</h3>'
    + '<table class="tbl"><thead><tr><th>Week</th><th>Strategy</th><th>n</th><th>Slippage</th><th>Fee drift</th></tr></thead>'
    + '<tbody>' + (weeklyRows || '<tr><td colspan="5">No weekly buckets yet</td></tr>') + '</tbody></table>'
    + '<div class="note" style="margin-top:8px">Compares closed paper entries vs execute_ok blotter fills. DEGRADED_EXECUTION when |slippage| &gt; $500 or fee drift &gt; $100.</div>';
  if (stat) stat.textContent = 'updated ' + new Date().toISOString().slice(11, 19) + ' UTC';
}

function mount(el){
  if (!el) return;
  el.innerHTML = '<div class="panel"><h2>RECON <span>live vs paper execution drift</span></h2>'
    + '<div class="row"><button class="btn" id="reconRun">REFRESH RECON</button>'
    + '<span class="note" id="reconStat">auto-runs on open</span></div>'
    + '<div id="reconOut" style="margin-top:10px"><div class="empty">Loading…</div></div></div>';
  var btn = $(el, '#reconRun');
  if (btn) btn.addEventListener('click', function(){ reconRender(el); });
  reconRender(el);
}

function refresh(){
  try{
    var pane = document.getElementById('tab_recon');
    if (pane && pane._mounted) reconRender(pane);
    return 'refreshed';
  }catch(e){ return 'degraded: ' + (e && e.message || e); }
}

G.HG_tabs = G.HG_tabs || [];
G.HG_tabs.push({ id: TAB_ID, label: 'RECON', title: 'Live vs Paper Recon', mount: mount, refresh: refresh });

})();
