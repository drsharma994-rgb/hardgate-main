/* HARDGATE — super-book.js
   SUPER BOOK tab: portfolio heat + open-position invalidation desk. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var TAB_ID = 'super-book';
var SYNC_MS = 5000;
var BOOK_MAX_HEAT = 0.06;
var __hgSuperBookSnap = null;
var __bk = { mounted: false, syncTimer: null, root: null, selectedId: null };

function N(v){ return Number(v); }
function fmt(n, d){ return (typeof W.hgSuperDeskFmt === 'function') ? W.hgSuperDeskFmt(n, d) : String(n); }

function superBookDeskPill(row, deskMeta){
  if (deskMeta && deskMeta.dailyLossHalt) return { cls: 'block', label: 'DAILY HALT' };
  var heat = deskMeta && isFinite(deskMeta.heatPct) ? deskMeta.heatPct : 0;
  if (heat >= BOOK_MAX_HEAT) return { cls: 'block', label: 'HEAT CAP' };
  if (heat >= BOOK_MAX_HEAT * 0.85) return { cls: 'watch', label: 'HEAT WARN' };
  if (!row) return { cls: 'watch', label: 'NO POSITION' };
  if (row.invalidNear) return { cls: 'watch', label: 'NEAR STOP' };
  return { cls: 'clean', label: 'HEAT OK' };
}

function positionInvalidNear(p){
  if (!p || !isFinite(p.mark) || !isFinite(p.stop)) return false;
  var dist = Math.abs(p.mark - p.stop) / Math.max(Math.abs(p.mark), 1e-9);
  return dist < 0.005;
}

function enrichBookRow(p, summary){
  if (!p) return null;
  var dir = String(p.dir || p.side || '').toLowerCase();
  return {
    id: String(p.id || [p.sym, dir, p.entry].join('|')),
    sym: p.sym || p.symbol,
    dir: dir,
    entry: N(p.entry),
    stop: N(p.stop),
    t1: N(p.t1 || p.tp),
    mark: N(p.mark || p.mtmPrice),
    pnl: N(p.pnl || p.unrealizedPnl),
    riskUsd: N(p.riskUsd || p.risk),
    scanner: p.scanner || p.strategy || 'book',
    invalidNear: positionInvalidNear(p),
    invalidates: 'Close beyond stop ' + fmt(p.stop, 4) + ' — thesis dead',
    heatPct: summary && summary.heatPct,
    tier: 'open'
  };
}

function buildSnapFromBook(win){
  win = win || W;
  var snap = null;
  try{
    if (typeof win.bookState === 'function') snap = win.bookState();
  }catch(e0){}
  var positions = (snap && snap.book && snap.book.positions) || [];
  var summary = (snap && snap.summary) || {};
  var deskMeta = {
    heatPct: summary.heatPct,
    heatUsd: summary.heatUsd,
    openCount: summary.openCount || positions.length,
    dailyLossHalt: !!(summary.dailyLossHalt)
  };
  var rows = [];
  positions.forEach(function(p){
    var row = enrichBookRow(p, summary);
    if (row) rows.push(row);
  });
  rows.sort(function(a, b){
    var an = a.invalidNear ? 1 : 0, bn = b.invalidNear ? 1 : 0;
    if (bn !== an) return bn - an;
    return (N(b.riskUsd) || 0) - (N(a.riskUsd) || 0);
  });
  return {
    at: Date.now(),
    cands: rows,
    deskMeta: deskMeta,
    stat: positions.length
      ? (positions.length + ' open · heat ' + fmt((deskMeta.heatPct || 0) * 100, 1) + '%'
        + (deskMeta.dailyLossHalt ? ' · DAILY HALT' : ''))
      : '0 open positions — heat ' + fmt((deskMeta.heatPct || 0) * 100, 1) + '%'
  };
}

function publishSuperBookSnap(snap){
  __hgSuperBookSnap = snap || null;
  try{ W.HG_superBookScan = snap; }catch(e){}
  return snap;
}

function superBookScan(){ return __hgSuperBookSnap; }

function syncDeskFromExisting(win){
  var snap = buildSnapFromBook(win);
  snap.scanAt = Date.now();
  publishSuperBookSnap(snap);
  return snap;
}

function heatBarInline(meta){
  if (typeof W.heatBarHTML === 'function' && meta){
    try{
      return W.heatBarHTML({
        heatPct: meta.heatPct || 0,
        heatUsd: meta.heatUsd || 0,
        maxHeatPct: BOOK_MAX_HEAT
      });
    }catch(e0){}
  }
  var heat = (meta && meta.heatPct) ? meta.heatPct : 0;
  return '<div class="hg-note">Portfolio heat ' + fmt(heat * 100, 2) + '% / '
    + fmt(BOOK_MAX_HEAT * 100, 0) + '% · ' + (meta.openCount || 0) + ' open</div>';
}

function mount(el){
  if (!el) return;
  if (typeof W.hgSuperDeskInjectStyles === 'function'){
    W.hgSuperDeskInjectStyles('hg-super-book-styles');
  }
  var scoreLink = (typeof W.hgSuperDeskScorecardLink === 'function')
    ? W.hgSuperDeskScorecardLink(TAB_ID) : '';
  el.innerHTML = [
    '<section class="hg-tab hg-super-desk hg-super-book">',
    '  <div class="hg-title">Super Book</div>',
    '  <div class="hg-note">Conviction desk — BOOK heat guard + per-position invalidation levels.</div>',
    '  <div id="bk-validation"></div>',
    '  <div class="hg-card"><h3>Portfolio Heat</h3>',
    '    <div id="bk-heat"></div>',
    '    <div class="hg-note" id="bk-scan-stat" style="margin-top:8px">—</div>',
    '    <button type="button" class="hg-btn primary" id="bk-refresh" style="margin-top:8px">Refresh book marks</button>',
    '  </div>',
    '  <div class="hg-card"><h3>Open Positions · Invalidation</h3>',
    '    <div class="hg-desk" id="bk-desk"></div>',
    '  </div>',
    '  <div class="hg-card"><h3>Selected Position</h3>',
    '    <div class="hg-note" id="bk-detail">Select a row</div>',
    '    <div style="margin-top:10px">' + scoreLink + '</div>',
    '  </div>',
    '</section>'
  ].join('\n');

  var root = el.querySelector('.hg-super-book') || el;
  __bk.root = root;
  function $(id){ return root.querySelector(id); }

  function paintDesk(snap){
    var vEl = $('#bk-validation');
    if (vEl && typeof W.hgSuperDeskValidationHtml === 'function'){
      vEl.innerHTML = W.hgSuperDeskValidationHtml(W);
    }
    snap = snap || superBookScan();
    var meta = snap && snap.deskMeta;
    var heatEl = $('#bk-heat');
    if (heatEl) heatEl.innerHTML = heatBarInline(meta);
    var statEl = $('#bk-scan-stat');
    if (statEl) statEl.textContent = snap && snap.stat ? snap.stat : '—';
    var desk = $('#bk-desk');
    if (!desk) return;
    var rows = (snap && snap.cands) ? snap.cands : [];
    if (!rows.length){
      desk.innerHTML = '<div class="hg-note">No open positions. Heat bar still tracks book limits.</div>';
      return;
    }
    desk.innerHTML = rows.map(function(r){
      var pill = superBookDeskPill(r, meta);
      var sel = (__bk.selectedId === r.id) ? ' sel' : '';
      return '<div class="hg-desk-card' + sel + '" data-id="' + String(r.id).replace(/"/g, '') + '">'
        + '<strong>' + String(r.sym) + ' · ' + String(r.dir).toUpperCase() + '</strong> '
        + '<span class="hg-pill ' + pill.cls + '">' + pill.label + '</span>'
        + '<div style="margin-top:6px;font:600 11px var(--mono,monospace)">'
        + 'entry ' + fmt(r.entry, 4) + ' · stop ' + fmt(r.stop, 4)
        + ' · mark ' + fmt(r.mark, 4)
        + (r.invalidNear ? ' · <b style="color:var(--short,#dc2626)">NEAR STOP</b>' : '')
        + '</div><div class="hg-note" style="margin-top:4px">' + String(r.invalidates) + '</div></div>';
    }).join('');
    desk.querySelectorAll('.hg-desk-card').forEach(function(card){
      card.addEventListener('click', function(){
        __bk.selectedId = card.getAttribute('data-id');
        desk.querySelectorAll('.hg-desk-card').forEach(function(c){ c.classList.remove('sel'); });
        card.classList.add('sel');
        var hit = rows.find(function(r){ return r.id === __bk.selectedId; });
        var det = $('#bk-detail');
        if (det && hit){
          det.textContent = hit.sym + ' ' + hit.dir.toUpperCase()
            + ' · invalidation: ' + hit.invalidates
            + (hit.pnl != null ? (' · MTM $' + fmt(hit.pnl, 2)) : '');
        }
      });
    });
  }

  async function refreshBook(){
    try{
      if (typeof W.bookRefreshMarks === 'function') await W.bookRefreshMarks();
      else if (typeof W.bookRefresh === 'function') await W.bookRefresh();
    }catch(e){}
    paintDesk(syncDeskFromExisting(W));
  }

  __bk.paintDesk = paintDesk;
  __bk.mounted = true;
  if (typeof W.hgSuperDeskBindScorecard === 'function') W.hgSuperDeskBindScorecard(root);

  $('#bk-refresh') && $('#bk-refresh').addEventListener('click', refreshBook);

  refreshBook();
  __bk.syncTimer = setInterval(refreshBook, SYNC_MS);
}

function superBookRepaint(){
  if (__bk.mounted && typeof __bk.paintDesk === 'function'){
    __bk.paintDesk(syncDeskFromExisting(W));
  }
}

async function superBookRefresh(){
  try{
    if (typeof W.bookRefreshMarks === 'function') await W.bookRefreshMarks();
  }catch(e){}
  superBookRepaint();
  return 'refreshed';
}

W.superBookDeskPill = superBookDeskPill;
W.buildSnapFromBook = buildSnapFromBook;
W.superBookSyncDesk = syncDeskFromExisting;
W.superBookScan = superBookScan;
W.superBookRepaint = superBookRepaint;

W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'super-book', label: 'SUPER BOOK', run: function(){ return superBookRefresh(); } });

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({
  id: TAB_ID,
  label: 'SUPER BOOK',
  title: 'Super Book',
  mount: mount,
  refresh: superBookRefresh
});

})();
