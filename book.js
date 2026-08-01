/* =========================================================================
HARDGATE — book.js
PAPER FUND BOOK — server-backed positions, risk limits, MTM PnL.

Exports (never throw):
  addToBook(opts) -> Promise<{ok, ...}>
  bookBtnHTML(sym, dir, entry, stop, t1, meta)
  bookRefreshMarks()
  bookState() -> last snapshot

Registers window.HG_tabs id 'book' label 'BOOK'.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

var __book = { snap: null, busy: false, lastAt: 0, autoTimer: null, autoLog: [], liveReady: false, digestReady: false };
var BOOK_AUTO_MS = 45000;
var BOOK_MAX_HEAT_PCT = 0.06;
var BOOK_AUTO_KEY = 'hg_book_auto_rules_v1';

function bookAutoOn(){
  try{
    var v = localStorage.getItem(BOOK_AUTO_KEY);
    return v === null ? true : v === '1';
  }catch(e){ return true; }
}
function bookSetAuto(on){
  try{ localStorage.setItem(BOOK_AUTO_KEY, on ? '1' : '0'); }catch(e){}
}

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c];
  });
}
function pxF(n){
  if (typeof W.px === 'function') return W.px(n);
  if (!isFinite(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtF(n, d){
  if (typeof W.fmt === 'function') return W.fmt(n, d);
  if (!isFinite(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}
function fmtUsd(n){
  if (!isFinite(n)) return '—';
  var sign = n < 0 ? '-' : '';
  return sign + '$' + fmtF(Math.abs(n), 0);
}

function bookApiOn(){
  try{ return typeof W.hgApiAvailable === 'function' && W.hgApiAvailable(); }catch(e){ return false; }
}

function bookTabVisible(){
  try{
    var pane = document.getElementById('tab_book');
    return !!(pane && pane.classList && pane.classList.contains('on'));
  }catch(e){ return false; }
}

async function bookFetch(path, opts){
  opts = opts || {};
  var res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  var j = null;
  try{ j = await res.json(); }catch(e){}
  return { res: res, json: j };
}

function bookLocalLoad(){
  try{
    var raw = localStorage.getItem('hg_paperbook_v1');
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

async function bookPull(){
  if (bookApiOn()){
    var r = await bookFetch('/api/book');
    if (r.json && r.json.ok){
      __book.snap = r.json;
      __book.liveReady = !!(r.json.capabilities && r.json.capabilities.liveExecute);
      __book.digestReady = !!(r.json.capabilities && (r.json.capabilities.digestSend || r.json.capabilities.digestWebhook));
      __book.lastAt = Date.now();
      return r.json;
    }
  }
  var local = bookLocalLoad();
  if (local && local.book){
    __book.snap = { ok: true, book: local.book, summary: local.summary || {} };
    return __book.snap;
  }
  return null;
}

function bookScoreRecord(opts){
  try{
    if (typeof W.hgScoreRecord !== 'function' || !opts) return;
    if (!isFinite(opts.entry) || !isFinite(opts.stop) || !isFinite(opts.t1)) return;
    W.hgScoreRecord({
      source: 'book',
      sym: opts.sym,
      dir: opts.dir,
      tier: opts.tier || 'BOOK',
      entry: +opts.entry,
      stop: +opts.stop,
      t1: +opts.t1,
      t2: isFinite(opts.t2) ? +opts.t2 : null,
      layers: opts.layers || [],
      at: Date.now()
    });
  }catch(e){}
}

function bookScoreSettle(){
  try{
    if (typeof W.hgScoreSettle !== 'function') return;
    var p = W.hgScoreSettle(typeof W.getCandles === 'function' ? function(sym, tf, n){
      return W.getCandles(sym, tf, n);
    } : null);
    if (p && typeof p.catch === 'function') p.catch(function(){});
  }catch(e){}
}

async function addToBook(opts){
  opts = (opts && typeof opts === 'object') ? opts : {};
  try{
    if (typeof W.hgNewsRisk === 'function'){
      var nr = W.hgNewsRisk(opts.sym || 'BTCUSD');
      if (nr && nr.blackout) return { ok: false, veto: true, reasons: ['NEWS BLACKOUT — ' + (nr.note || '')] };
      if (nr && nr.risk === 'high') opts.newsCaution = true;
    }
    var body = {
      sym: opts.sym,
      dir: opts.dir,
      entry: +opts.entry,
      stop: +opts.stop,
      t1: isFinite(opts.t1) ? +opts.t1 : null,
      t2: isFinite(opts.t2) ? +opts.t2 : null,
      mark: isFinite(opts.mark) ? +opts.mark : +opts.entry,
      venue: opts.venue || 'paper',
      klass: opts.klass || null,
      strategy: opts.strategy || opts.source || 'scanner',
      tier: opts.tier || null,
      layers: opts.layers || [],
      newsBlackout: false,
    };
    if (!body.sym || !body.dir || !isFinite(body.entry) || !isFinite(body.stop)){
      return { ok: false, reason: 'invalid plan' };
    }
    if (!isFinite(body.t1)){
      var risk = Math.abs(body.entry - body.stop);
      body.t1 = body.dir === 'short' ? body.entry - risk : body.entry + risk;
    }
    if (bookApiOn()){
      var r = await bookFetch('/api/book/intent', { method: 'POST', body: JSON.stringify(body) });
      if (r.json && r.json.ok){
        await bookPull();
        bookScoreRecord(body);
        __book.lastAt = Date.now();
        if (typeof W.showTab === 'function') W.showTab('book');
        return r.json;
      }
      var msg = (r.json && r.json.reasons) ? r.json.reasons.join(' · ') : ((r.json && r.json.reason) || 'risk veto');
      try{ alert('BOOK: ' + msg); }catch(e){}
      return r.json || { ok: false, reason: 'book API error' };
    }
    try{ alert('Paper book requires Render backend — open hardgate-main.onrender.com'); }catch(e2){}
  }catch(e){
    return { ok: false, reason: (e && e.message) || String(e) };
  }
}

function bookBtnHTML(sym, dir, entry, stop, t1, meta){
  meta = meta || {};
  var payload = JSON.stringify({
    sym: sym, dir: dir, entry: entry, stop: stop,
    t1: (t1 !== undefined && isFinite(t1)) ? t1 : null,
    strategy: meta.strategy || meta.source || 'scanner',
    tier: meta.tier || null,
    klass: meta.klass || null,
    venue: meta.venue || 'paper',
    layers: meta.layers || []
  });
  return '<button class="toBook" onclick=\'addToBook(' + payload + ')\'>ADD TO BOOK</button>';
}

async function bookCollectMarks(snap){
  snap = snap || __book.snap;
  if (!snap || !snap.book || !snap.book.positions || !snap.book.positions.length) return {};
  var marks = {};
  var positions = snap.book.positions;
  await Promise.all(positions.map(async function(p){
    try{
      var mark = null;
      if (typeof W.startraderCandles === 'function' && typeof W.startraderContract === 'function' && W.startraderContract(p.sym)){
        var rows = await W.startraderCandles(p.sym, '1h', 3);
        if (rows && rows.length) mark = rows[rows.length - 1].c;
      } else if (typeof W.getCandles === 'function'){
        var cr = await W.getCandles(p.sym, '1h', 3);
        if (cr && cr.length) mark = cr[cr.length - 1].c;
      }
      if (isFinite(mark)) marks[p.sym] = mark;
    }catch(e){}
  }));
  return marks;
}

async function bookCollectAtrMarks(snap){
  snap = snap || __book.snap;
  if (!snap || !snap.book || !snap.book.positions || !snap.book.positions.length) return {};
  var atrFn = (typeof W.atr === 'function') ? W.atr : (typeof atr === 'function' ? atr : null);
  if (!atrFn) return {};
  var atrMarks = {};
  var positions = snap.book.positions;
  await Promise.all(positions.map(async function(p){
    try{
      var rows = null;
      if (typeof W.getCandles === 'function'){
        rows = await W.getCandles(p.sym, '4h', 20);
      } else if (typeof W.startraderCandles === 'function' && typeof W.startraderContract === 'function' && W.startraderContract(p.sym)){
        rows = await W.startraderCandles(p.sym, '4h', 20);
      }
      if (!rows || rows.length < 15) return;
      var a = atrFn(rows, 14);
      var last = a[a.length - 1];
      if (isFinite(last) && last > 0) atrMarks[p.sym] = last;
    }catch(e){}
  }));
  return atrMarks;
}

async function bookRefreshMarks(){
  var snap = __book.snap || await bookPull();
  if (!snap || !snap.book || !snap.book.positions || !snap.book.positions.length) return snap;
  var marks = await bookCollectMarks(snap);
  if (!Object.keys(marks).length) return snap;
  var atrMarks = await bookCollectAtrMarks(snap);
  if (bookApiOn()){
    var r = await bookFetch('/api/book/marks', {
      method: 'POST',
      body: JSON.stringify({ marks: marks, atrMarks: atrMarks, auto: bookAutoOn() }),
    });
    if (r.json && r.json.ok){
      __book.snap = r.json;
      __book.lastAt = Date.now();
      if (r.json.autoActions && r.json.autoActions.length){
        __book.autoLog = (r.json.autoActions.concat(__book.autoLog)).slice(0, 12);
      }
    }
    return __book.snap;
  }
  return snap;
}

function autoLogHTML(){
  var log = __book.autoLog || [];
  if (!log.length) return '<div class="note">Auto desk idle — T1 50% · ATR trail · lock +0.5R @2R · lock +1R @3R · BE @1R · stop-out.</div>';
  return '<ul class="bookAutoLog">' + log.map(function(a){
    var txt = a.action === 'scale_t1' ? ('T1 scale ' + Math.round((a.pct || 0.5) * 100) + '% · ' + a.sym)
      : a.action === 'trail_be' ? ('Trail BE · ' + a.sym + ' @ ' + fmtF(a.r, 2) + 'R')
      : a.action === 'trail_lock_half' ? ('Lock +0.5R · ' + a.sym + ' @ ' + fmtF(a.r, 2) + 'R')
      : a.action === 'trail_lock_1r' ? ('Lock +1R · ' + a.sym + ' @ ' + fmtF(a.r, 2) + 'R')
      : a.action === 'trail_atr' ? ('ATR trail · ' + a.sym + ' @ ' + fmtF(a.r, 2) + 'R · ' + fmtF(a.mult, 1) + '×ATR')
      : a.action === 'stop_out' ? ('Stop out · ' + a.sym + ' ' + (a.dir || ''))
      : (a.action || 'action');
    return '<li>' + esc(txt) + '</li>';
  }).join('') + '</ul>';
}

function blotterHTML(rows){
  rows = (rows || []).slice(0, 10);
  if (!rows.length) return '<div class="note">No blotter events yet.</div>';
  return '<table class="booktbl"><thead><tr><th>Time</th><th>Event</th><th>Symbol</th><th>Detail</th></tr></thead><tbody>'
    + rows.map(function(b){
      return '<tr><td>' + new Date(b.at).toLocaleTimeString() + '</td><td>' + esc(b.type || '—') + '</td>'
        + '<td>' + esc(b.sym || '—') + '</td><td>' + esc(b.note || b.dir || (b.qty != null ? ('qty ' + fmtF(b.qty, 4)) : '') || '') + '</td></tr>';
    }).join('') + '</tbody></table>';
}

async function bookLivePosition(id){
  if (!bookApiOn()) return;
  if (!__book.liveReady){
    try{ alert('Live execute not configured — set EXECUTE_WEBHOOK_URL on Render.'); }catch(e){}
    return;
  }
  if (!confirm('Send LIVE bracket for this paper position to the execution webhook?')) return;
  var r = await bookFetch('/api/book/live', { method: 'POST', body: JSON.stringify({ id: id }) });
  if (r.json && r.json.ok){
    try{ alert('Live bracket sent (HTTP ' + r.json.status + ').'); }catch(e2){}
  } else {
    try{ alert('Live send failed: ' + ((r.json && r.json.reason) || r.json.response || 'error')); }catch(e3){}
  }
  await bookPull();
  var pane = document.getElementById('tab_book');
  if (pane && pane.querySelector('#bookRefresh')) pane.querySelector('#bookRefresh').click();
}

async function bookExportLp(){
  try{
    var month = new Date().toISOString().slice(0, 7);
    var r = await bookFetch('/api/book/lp?month=' + encodeURIComponent(month));
    if (!r.json || !r.json.ok) return;
    var lp = r.json.lp;
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>HARDGATE LP Report ' + esc(lp.month) + '</title>'
      + '<style>body{font-family:system-ui;background:#0b0f14;color:#e8eaed;padding:24px}'
      + 'h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:12px}'
      + 'td,th{border:1px solid #2a2f3a;padding:8px;text-align:left;font-size:13px}</style></head><body>'
      + '<h1>HARDGATE Paper Fund — LP Report</h1>'
      + '<p>Month: <b>' + esc(lp.month) + '</b> · Generated ' + new Date().toISOString() + '</p>'
      + '<table><tr><th>NAV</th><td>' + fmtUsd(lp.navUsd) + '</td></tr>'
      + '<tr><th>Equity</th><td>' + fmtUsd(lp.equityUsd) + '</td></tr>'
      + '<tr><th>MTD return</th><td>' + fmtF(lp.mtdReturnPct, 2) + '%</td></tr>'
      + '<tr><th>MTD realized</th><td>' + fmtUsd(lp.mtdRealizedUsd) + '</td></tr>'
      + '<tr><th>Trades closed</th><td>' + lp.tradesClosed + '</td></tr>'
      + '<tr><th>Win rate</th><td>' + fmtF(lp.winRate * 100, 1) + '%</td></tr>'
      + '<tr><th>Open positions</th><td>' + lp.openCount + '</td></tr></table>';
    if (lp.byStrategy && lp.byStrategy.length){
      html += '<h2 style="margin-top:20px;font-size:16px">P&amp;L by strategy</h2><table><tr><th>Strategy</th><th>Trades</th><th>P&amp;L</th></tr>'
        + lp.byStrategy.map(function(s){
          return '<tr><td>' + esc(s.key) + '</td><td>' + s.count + '</td><td>' + fmtUsd(s.pnlUsd) + '</td></tr>';
        }).join('') + '</table>';
    }
    html += '<p style="margin-top:24px;font-size:11px;color:#888">Paper fund simulation — not audited. For desk use only.</p>'
      + '</body></html>';
    var blob = new Blob([html], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hardgate-lp-' + lp.month + '.html';
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){}
}

async function bookExportDigest(period){
  period = period === 'month' ? 'month' : 'week';
  try{
    var r = await bookFetch('/api/book/digest?period=' + encodeURIComponent(period));
    if (!r.json || !r.json.ok) return;
    var html = r.json.html || '';
    if (!html && r.json.digest){
      html = '<!DOCTYPE html><html><body><pre>' + esc(JSON.stringify(r.json.digest, null, 2)) + '</pre></body></html>';
    }
    var blob = new Blob([html], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hardgate-digest-' + period + '-' + new Date().toISOString().slice(0, 10) + '.html';
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){}
}

async function bookSendDigest(){
  if (!bookApiOn()) return;
  if (!__book.digestReady){
    try{ alert('Digest not configured — set LP_DIGEST_WEBHOOK_URL and/or TELEGRAM_TOKEN+TELEGRAM_CHAT_ID on Render.'); }catch(e){}
    return;
  }
  if (!confirm('Send weekly LP digest to the configured webhook?')) return;
  var r = await bookFetch('/api/book/digest/send', { method: 'POST', body: JSON.stringify({ period: 'week' }) });
  if (r.json && r.json.ok){
    try{ alert('Digest sent (HTTP ' + r.json.status + ').'); }catch(e2){}
  } else {
    try{ alert('Digest send failed: ' + ((r.json && r.json.reason) || r.json.response || 'error')); }catch(e3){}
  }
}

function heatBarHTML(s){
  var heatPct = (s && isFinite(s.heatPct)) ? s.heatPct : 0;
  var maxPct = (s && isFinite(s.maxHeatPct)) ? s.maxHeatPct : BOOK_MAX_HEAT_PCT;
  var fill = maxPct > 0 ? Math.min(100, (heatPct / maxPct) * 100) : 0;
  var warn = heatPct >= maxPct * 0.85;
  var buckets = bucketBarsHTML(s);
  return '<div class="bookHeatWrap">'
    + '<span class="k">Portfolio heat</span>'
    + '<div class="bookHeatBar' + (warn ? ' warn' : '') + '"><div class="bookHeatFill" style="width:' + fill.toFixed(1) + '%"></div></div>'
    + '<span class="v">' + fmtF(heatPct * 100, 2) + '% / ' + fmtF(maxPct * 100, 0) + '% · ' + fmtUsd(s.heatUsd || 0) + '</span>'
    + '</div>' + buckets;
}

function bucketBarsHTML(s){
  var buckets = (s && s.bucketExposure) || [];
  var maxPct = (s && isFinite(s.maxBucketPct)) ? s.maxBucketPct : 0.35;
  if (!buckets.length) return '';
  return '<div class="bookBucketWrap"><span class="k" style="width:100%;margin-top:6px">Asset buckets (35% cap)</span>'
    + buckets.map(function(b){
      var fill = maxPct > 0 ? Math.min(100, (b.pct / maxPct) * 100) : 0;
      var warn = b.pct >= maxPct * 0.85;
      return '<div class="bookBucketRow"><span class="k">' + esc(b.key) + '</span>'
        + '<div class="bookHeatBar' + (warn ? ' warn' : '') + '"><div class="bookHeatFill" style="width:' + fill.toFixed(1) + '%"></div></div>'
        + '<span class="v">' + fmtF(b.pct * 100, 1) + '% · ' + fmtUsd(b.usd) + '</span></div>';
    }).join('') + '</div>';
}

function posR(p){
  if (!p || !isFinite(p.entry) || !isFinite(p.mark)) return null;
  var orig = isFinite(p.origStop) ? p.origStop : p.stop;
  var risk = Math.abs(p.entry - orig);
  if (!(risk > 0)) return null;
  var move = p.dir === 'short' ? (p.entry - p.mark) : (p.mark - p.entry);
  return move / risk;
}

function bookFindPos(id){
  var positions = (__book.snap && __book.snap.book && __book.snap.book.positions) || [];
  for (var i = 0; i < positions.length; i++){
    if (positions[i].id === id) return positions[i];
  }
  return null;
}

function bookManagePosition(p){
  try{
    var snap = __book.snap;
    var eq = snap && snap.summary ? snap.summary.equityUsd : null;
    var tEq = document.getElementById('tEq');
    if (tEq && isFinite(eq)) tEq.value = Math.round(eq);
    if (typeof W.toTrade === 'function') W.toTrade(p.sym, p.dir, p.entry, p.stop, p.t1);
  }catch(e){}
}

function attrTableHTML(title, rows){
  rows = rows || [];
  if (!rows.length){
    return '<div class="panel"><h3>' + esc(title) + '</h3><div class="note">No attribution data yet.</div></div>';
  }
  return '<div class="panel"><h3>' + esc(title) + '</h3>'
    + '<div style="overflow-x:auto"><table class="booktbl"><thead><tr>'
    + '<th>Bucket</th><th>Trades</th><th>Realized</th><th>Unrealized</th><th>Total P&amp;L</th>'
    + '</tr></thead><tbody>'
    + rows.map(function(r){
      var cls = (r.pnlUsd || 0) >= 0 ? 'ok' : 'warn';
      return '<tr><td>' + esc(r.key) + '</td><td>' + r.count + '</td>'
        + '<td>' + fmtUsd(r.realizedUsd) + '</td><td>' + fmtUsd(r.unrealizedUsd) + '</td>'
        + '<td class="' + cls + '">' + fmtUsd(r.pnlUsd) + '</td></tr>';
    }).join('')
    + '</tbody></table></div></div>';
}

function bookExportJSON(){
  try{
    var snap = __book.snap;
    if (!snap) return;
    var blob = new Blob([JSON.stringify({
      app: 'hardgate-paperbook',
      version: 1,
      exportedAt: new Date().toISOString(),
      book: snap.book,
      summary: snap.summary,
      attribution: snap.attribution || null
    }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hardgate-book-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){}
}

function bookExportCSV(){
  try{
    var snap = __book.snap;
    if (!snap || !snap.book) return;
    var lines = ['type,sym,dir,strategy,bucket,tier,notional,entry,mark,pnl,openedAt,closedAt'];
    (snap.book.positions || []).forEach(function(p){
      lines.push(['open', p.sym, p.dir, p.strategy || '', p.bucket || '', p.tier || '',
        p.notionalUsd, p.entry, p.mark, p.unrealizedUsd || 0, p.openedAt || '', ''].join(','));
    });
    (snap.book.closed || []).forEach(function(c){
      lines.push(['closed', c.sym, c.dir, c.strategy || '', c.bucket || '', c.tier || '',
        c.notionalUsd, c.entry, c.mark, c.realizedUsd || 0, c.openedAt || '', c.closedAt || ''].join(','));
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hardgate-book-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){}
}

function navHistoryHTML(hist){
  hist = (hist || []).slice(-12).reverse();
  if (!hist.length) return '';
  return '<div class="panel"><h3>NAV history (recent)</h3>'
    + '<div style="overflow-x:auto"><table class="booktbl"><thead><tr>'
    + '<th>Time</th><th>Equity</th><th>Heat</th><th>Open</th></tr></thead><tbody>'
    + hist.map(function(h){
      return '<tr><td>' + new Date(h.at).toLocaleString() + '</td>'
        + '<td>' + fmtUsd(h.equityUsd) + '</td>'
        + '<td>' + fmtF((h.heatPct || 0) * 100, 2) + '%</td>'
        + '<td>' + (h.openCount != null ? h.openCount : '—') + '</td></tr>';
    }).join('')
    + '</tbody></table></div></div>';
}

function posRowHTML(p){
  var upl = p.unrealizedUsd || 0;
  var uplCls = upl >= 0 ? 'ok' : 'warn';
  var rVal = posR(p);
  var rCls = (rVal != null && rVal >= 0) ? 'ok' : 'warn';
  var liveBtn = __book.liveReady
    ? '<button class="btn" data-live="' + esc(p.id) + '" title="Send bracket to EXECUTE_WEBHOOK_URL">LIVE</button>' : '';
  return '<tr>'
    + '<td>' + esc(p.sym) + '</td>'
    + '<td>' + esc((p.dir || '').toUpperCase()) + '</td>'
    + '<td>' + esc(p.strategy || '—') + '</td>'
    + '<td>' + fmtUsd(p.notionalUsd) + '</td>'
    + '<td>' + pxF(p.entry) + '</td>'
    + '<td>' + pxF(p.mark) + '</td>'
    + '<td class="' + rCls + '">' + (rVal != null ? fmtF(rVal, 2) + 'R' : '—') + '</td>'
    + '<td class="' + uplCls + '">' + fmtUsd(upl) + '</td>'
    + '<td>' + fmtUsd(p.riskUsd) + '</td>'
    + '<td class="bookActs">'
    + '<button class="btn ghost" data-manage="' + esc(p.id) + '" title="Open in TRADE PLAN with fund equity">MANAGE</button>'
    + liveBtn
    + '<button class="btn ghost" data-scale="0.5" data-id="' + esc(p.id) + '" title="Scale out 50% at mark">50%</button>'
    + '<button class="btn ghost" data-be="' + esc(p.id) + '" title="Move stop to breakeven">BE</button>'
    + '<button class="btn ghost" data-close="' + esc(p.id) + '">CLOSE</button>'
    + '</td>'
    + '</tr>';
}

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>PAPER FUND BOOK <span>$1M NAV · risk limits · paper fills at plan entry</span></h2>'
    + '<p class="note">Desk OMS: <b>MANAGE</b> → TRADE PLAN · <b>50%</b> scale · <b>BE</b> stop · auto rules on mark refresh. Weekly LP digest auto-sends Sun ~21:07 IST when webhook/Telegram is configured.</p>'
    + '<div class="row" style="align-items:center;gap:12px">'
    + '<label class="note"><input type="checkbox" id="bookAutoRules" ' + (bookAutoOn() ? 'checked' : '') + '> Auto desk (T1 50% · ATR trail · BE @1R · stop-out)</label>'
    + '</div>'
    + '<div class="row">'
    + '<button class="btn" id="bookRefresh">REFRESH MARKS</button>'
    + '<button class="btn ghost" id="bookCloseAll">CLOSE ALL</button>'
    + '<button class="btn ghost" id="bookExportJson">EXPORT JSON</button>'
    + '<button class="btn ghost" id="bookExportCsv">EXPORT CSV</button>'
    + '<button class="btn ghost" id="bookExportLp">LP REPORT</button>'
    + '<button class="btn ghost" id="bookExportDigest">WEEKLY DIGEST</button>'
    + '<button class="btn ghost" id="bookSendDigest" title="POST digest to LP_DIGEST_WEBHOOK_URL">SEND DIGEST</button>'
    + '<button class="btn ghost" id="bookReset">RESET BOOK</button>'
    + '<span class="note" id="bookStat">idle</span>'
    + '</div>'
    + '<div class="kv" id="bookSummary"></div>'
    + '<div id="bookHeat"></div>'
    + '<div class="panel" style="margin-top:8px"><h3>Auto desk log</h3><div id="bookAutoLog"></div></div>'
    + '<div class="panel" style="margin-top:8px"><h3>Execution blotter</h3><div id="bookBlotter"></div>'
    + '</div>'
    + '<div class="panel"><h3>Open positions</h3>'
    + '<div style="overflow-x:auto"><table class="booktbl" id="bookTable">'
    + '<thead><tr><th>Symbol</th><th>Side</th><th>Strategy</th><th>Notional</th><th>Entry</th><th>Mark</th><th>R</th><th>UPL</th><th>Risk</th><th>OMS</th></tr></thead>'
    + '<tbody id="bookBody"></tbody></table></div>'
    + '<div class="empty" id="bookEmpty" style="display:none">No open paper positions — add from a scanner card.</div>'
    + '</div>'
    + '<div class="panel"><h3>Recently closed</h3><div id="bookClosed"></div></div>'
    + '<div id="bookAttr"></div>'
    + '<div id="bookNavHist"></div>';

  var stat = el.querySelector('#bookStat');
  var summary = el.querySelector('#bookSummary');
  var heatEl = el.querySelector('#bookHeat');
  var autoLogEl = el.querySelector('#bookAutoLog');
  var blotterEl = el.querySelector('#bookBlotter');
  var body = el.querySelector('#bookBody');
  var empty = el.querySelector('#bookEmpty');
  var closedEl = el.querySelector('#bookClosed');
  var attrEl = el.querySelector('#bookAttr');
  var navHistEl = el.querySelector('#bookNavHist');

  function setStat(t, warn){ if (stat){ stat.textContent = t || ''; stat.className = warn ? 'note warn' : 'note'; } }

  function paint(snap){
    snap = snap || __book.snap;
    if (!snap || !snap.summary){
      setStat(bookApiOn() ? 'book empty — add from scanners' : 'backend required — deploy on Render for /api/book', !bookApiOn());
      if (summary) summary.innerHTML = '';
      if (heatEl) heatEl.innerHTML = '';
      if (body) body.innerHTML = '';
      if (attrEl) attrEl.innerHTML = '';
      if (navHistEl) navHistEl.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    var s = snap.summary;
    if (summary){
      summary.innerHTML =
        '<span class="k">NAV</span><span class="v">' + fmtUsd(s.navUsd) + '</span>'
        + '<span class="k">Equity</span><span class="v">' + fmtUsd(s.equityUsd) + '</span>'
        + '<span class="k">Day P&amp;L</span><span class="v">' + fmtUsd(s.dayPnlUsd)
        + (s.dayKey ? ' <span class="note">(UTC ' + esc(s.dayKey) + ')</span>' : '') + '</span>'
        + '<span class="k">Unrealized</span><span class="v">' + fmtUsd(s.unrealizedUsd) + '</span>'
        + '<span class="k">Realized</span><span class="v">' + fmtUsd(s.realizedUsd) + '</span>'
        + '<span class="k">Open</span><span class="v">' + s.openCount + ' positions · gross ' + fmtUsd(s.grossUsd) + '</span>';
    }
    if (heatEl) heatEl.innerHTML = heatBarHTML(s);
    if (autoLogEl) autoLogEl.innerHTML = autoLogHTML();
    if (blotterEl) blotterEl.innerHTML = blotterHTML((snap.book && snap.book.blotter) || snap.blotter);
    var positions = (snap.book && snap.book.positions) || [];
    if (body){
      body.innerHTML = positions.map(posRowHTML).join('');
      if (empty) empty.style.display = positions.length ? 'none' : 'block';
    }
    if (closedEl && snap.book && snap.book.closed){
      var closed = snap.book.closed.slice(0, 8);
      closedEl.innerHTML = closed.length
        ? '<table class="booktbl"><thead><tr><th>Symbol</th><th>Side</th><th>Realized</th><th>Closed</th></tr></thead><tbody>'
          + closed.map(function(c){
            return '<tr><td>' + esc(c.sym) + '</td><td>' + esc(c.dir) + '</td><td>' + fmtUsd(c.realizedUsd) + '</td><td>'
              + new Date(c.closedAt).toLocaleString() + '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<div class="note">No closed trades yet.</div>';
    }
    if (attrEl && snap.attribution){
      attrEl.innerHTML = attrTableHTML('P&amp;L by strategy', snap.attribution.byStrategy)
        + attrTableHTML('P&amp;L by asset bucket', snap.attribution.byBucket)
        + attrTableHTML('P&amp;L by tier', snap.attribution.byTier);
    }
    if (navHistEl) navHistEl.innerHTML = navHistoryHTML(snap.navHistory || (snap.book && snap.book.navHistory));
    setStat('updated ' + new Date(snap.summary.at || Date.now()).toLocaleTimeString()
      + (bookTabVisible() ? ' · auto-refresh on' : ''));
  }

  async function refresh(){
    if (__book.busy) return 'busy';
    __book.busy = true;
    setStat('loading…');
    try{
      await bookPull();
      await bookRefreshMarks();
      paint(__book.snap);
    }catch(e){
      setStat('refresh failed: ' + ((e && e.message) || e), true);
    }finally{
      __book.busy = false;
    }
    return 'refreshed';
  }

  function startAutoRefresh(){
    if (__book.autoTimer) return;
    __book.autoTimer = setInterval(function(){
      if (!bookTabVisible() || __book.busy) return;
      refresh();
    }, BOOK_AUTO_MS);
  }

  el.querySelector('#bookRefresh').addEventListener('click', function(){ refresh(); });
  el.querySelector('#bookExportJson').addEventListener('click', bookExportJSON);
  el.querySelector('#bookExportCsv').addEventListener('click', bookExportCSV);
  el.querySelector('#bookExportLp').addEventListener('click', bookExportLp);
  el.querySelector('#bookExportDigest').addEventListener('click', function(){ bookExportDigest('week'); });
  el.querySelector('#bookSendDigest').addEventListener('click', bookSendDigest);
  var autoChk = el.querySelector('#bookAutoRules');
  if (autoChk){
    autoChk.addEventListener('change', function(){
      bookSetAuto(autoChk.checked);
      setStat(autoChk.checked ? 'auto desk ON' : 'auto desk OFF');
    });
  }
  el.querySelector('#bookCloseAll').addEventListener('click', async function(){
    if (!bookApiOn()) return;
    var snap = __book.snap || await bookPull();
    var n = (snap && snap.book && snap.book.positions) ? snap.book.positions.length : 0;
    if (!n){ try{ alert('No open positions.'); }catch(e){} return; }
    if (!confirm('Close all ' + n + ' paper position' + (n === 1 ? '' : 's') + ' at current marks?')) return;
    var marks = await bookCollectMarks(snap);
    await bookFetch('/api/book/close-all', { method: 'POST', body: JSON.stringify({ marks: marks }) });
    bookScoreSettle();
    await refresh();
  });
  el.querySelector('#bookReset').addEventListener('click', async function(){
    if (!confirm('Reset paper book to $1M NAV and clear all positions?')) return;
    if (bookApiOn()){
      await bookFetch('/api/book/reset', { method: 'POST', body: '{}' });
      await refresh();
    }
  });
  el.addEventListener('click', async function(ev){
    var t = ev.target;
    if (!t || !t.closest) return;
    var manageBtn = t.closest('[data-manage]');
    if (manageBtn){
      var mp = bookFindPos(manageBtn.getAttribute('data-manage'));
      if (mp) bookManagePosition(mp);
      return;
    }
    var liveBtn = t.closest('[data-live]');
    if (liveBtn){
      bookLivePosition(liveBtn.getAttribute('data-live'));
      return;
    }
    var scaleBtn = t.closest('[data-scale]');
    if (scaleBtn){
      if (!bookApiOn()) return;
      var sid = scaleBtn.getAttribute('data-id');
      var pct = +scaleBtn.getAttribute('data-scale');
      if (!sid || !(pct > 0)) return;
      await bookFetch('/api/book/scale', { method: 'POST', body: JSON.stringify({ id: sid, pct: pct }) });
      bookScoreSettle();
      await refresh();
      return;
    }
    var beBtn = t.closest('[data-be]');
    if (beBtn){
      if (!bookApiOn()) return;
      var bp = bookFindPos(beBtn.getAttribute('data-be'));
      if (!bp) return;
      await bookFetch('/api/book/stop', { method: 'POST', body: JSON.stringify({ id: bp.id, stop: bp.entry }) });
      await refresh();
      return;
    }
    var btn = t.closest('[data-close]');
    if (!btn) return;
    var id = btn.getAttribute('data-close');
    if (!id || !bookApiOn()) return;
    await bookFetch('/api/book/close', { method: 'POST', body: JSON.stringify({ id: id }) });
    bookScoreSettle();
    await refresh();
  });

  refresh();
  startAutoRefresh();
}

function bookRefresh(){
  try{
    if (__book.busy) return 'busy';
    var pane = document.getElementById('tab_book');
    if (!pane || !pane.querySelector('#bookRefresh')) return 'skipped: not mounted';
    pane.querySelector('#bookRefresh').click();
    return 'refreshed';
  }catch(e){ return 'refreshed'; }
}

function bookState(){ return __book.snap; }

W.addToBook = addToBook;
W.bookBtnHTML = bookBtnHTML;
W.bookRefreshMarks = bookRefreshMarks;
W.bookState = bookState;
W.bookManagePosition = bookManagePosition;
W.bookLivePosition = bookLivePosition;

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'book', label: 'BOOK', mount: mount, refresh: bookRefresh });

})();
