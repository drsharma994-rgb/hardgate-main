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

var __book = { snap: null, busy: false, lastAt: 0 };

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
function bookLocalSave(book){
  try{ localStorage.setItem('hg_paperbook_v1', JSON.stringify(book)); return true; }catch(e){ return false; }
}

async function bookPull(){
  if (bookApiOn()){
    var r = await bookFetch('/api/book');
    if (r.json && r.json.ok){ __book.snap = r.json; __book.lastAt = Date.now(); return r.json; }
  }
  var local = bookLocalLoad();
  if (local && local.book){
    __book.snap = { ok: true, book: local.book, summary: local.summary || {} };
    return __book.snap;
  }
  return null;
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
    if (bookApiOn()){
      var r = await bookFetch('/api/book/intent', { method: 'POST', body: JSON.stringify(body) });
      if (r.json && r.json.ok){
        __book.snap = { ok: true, book: { positions: [r.json.position] }, summary: r.json.summary };
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

async function bookRefreshMarks(){
  var snap = __book.snap || await bookPull();
  if (!snap || !snap.book || !snap.book.positions || !snap.book.positions.length) return snap;
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
  if (!Object.keys(marks).length) return snap;
  if (bookApiOn()){
    var r = await bookFetch('/api/book/marks', { method: 'POST', body: JSON.stringify({ marks: marks }) });
    if (r.json && r.json.ok){ __book.snap = r.json; __book.lastAt = Date.now(); }
    return __book.snap;
  }
  return snap;
}

function posRowHTML(p){
  var upl = p.unrealizedUsd || 0;
  var uplCls = upl >= 0 ? 'ok' : 'warn';
  return '<tr>'
    + '<td>' + esc(p.sym) + '</td>'
    + '<td>' + esc((p.dir || '').toUpperCase()) + '</td>'
    + '<td>' + esc(p.strategy || '—') + '</td>'
    + '<td>' + fmtUsd(p.notionalUsd) + '</td>'
    + '<td>' + pxF(p.entry) + '</td>'
    + '<td>' + pxF(p.mark) + '</td>'
    + '<td class="' + uplCls + '">' + fmtUsd(upl) + '</td>'
    + '<td>' + fmtUsd(p.riskUsd) + '</td>'
    + '<td><button class="btn ghost" data-close="' + esc(p.id) + '">CLOSE</button></td>'
    + '</tr>';
}

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>PAPER FUND BOOK <span>$1M NAV · risk limits · paper fills at plan entry</span></h2>'
    + '<p class="note">Add setups from <b>BRAIN</b>, <b>STAR TRADER</b>, <b>EDGE</b>, or <b>EXECUTE</b> via <b>ADD TO BOOK</b>. '
    + 'Pre-trade risk: max 12 positions · 15% single name · 35% asset bucket · 6% portfolio heat · news blackout veto. '
    + 'Requires the Render backend (<code>/api/book</code>).</p>'
    + '<div class="row">'
    + '<button class="btn" id="bookRefresh">REFRESH MARKS</button>'
    + '<button class="btn ghost" id="bookReset">RESET BOOK</button>'
    + '<span class="note" id="bookStat">idle</span>'
    + '</div>'
    + '<div class="kv" id="bookSummary"></div>'
    + '</div>'
    + '<div class="panel"><h3>Open positions</h3>'
    + '<div style="overflow-x:auto"><table class="booktbl" id="bookTable">'
    + '<thead><tr><th>Symbol</th><th>Side</th><th>Strategy</th><th>Notional</th><th>Entry</th><th>Mark</th><th>UPL</th><th>Risk</th><th></th></tr></thead>'
    + '<tbody id="bookBody"></tbody></table></div>'
    + '<div class="empty" id="bookEmpty" style="display:none">No open paper positions — add from a scanner card.</div>'
    + '</div>'
    + '<div class="panel"><h3>Recently closed</h3><div id="bookClosed"></div></div>';

  var stat = el.querySelector('#bookStat');
  var summary = el.querySelector('#bookSummary');
  var body = el.querySelector('#bookBody');
  var empty = el.querySelector('#bookEmpty');
  var closedEl = el.querySelector('#bookClosed');

  function setStat(t, warn){ if (stat){ stat.textContent = t || ''; stat.className = warn ? 'note warn' : 'note'; } }

  function paint(snap){
    snap = snap || __book.snap;
    if (!snap || !snap.summary){
      setStat(bookApiOn() ? 'book empty — add from scanners' : 'backend required — deploy on Render for /api/book', !bookApiOn());
      if (summary) summary.innerHTML = '';
      if (body) body.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    var s = snap.summary;
    if (summary){
      summary.innerHTML =
        '<span class="k">NAV</span><span class="v">' + fmtUsd(s.navUsd) + '</span>'
        + '<span class="k">Equity</span><span class="v">' + fmtUsd(s.equityUsd) + '</span>'
        + '<span class="k">Day P&amp;L</span><span class="v">' + fmtUsd(s.dayPnlUsd) + '</span>'
        + '<span class="k">Unrealized</span><span class="v">' + fmtUsd(s.unrealizedUsd) + '</span>'
        + '<span class="k">Heat</span><span class="v">' + fmtF((s.heatPct || 0) * 100, 2) + '% · ' + fmtUsd(s.heatUsd) + '</span>'
        + '<span class="k">Open</span><span class="v">' + s.openCount + ' positions · gross ' + fmtUsd(s.grossUsd) + '</span>';
    }
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
    setStat('updated ' + new Date(snap.summary.at || Date.now()).toLocaleTimeString());
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

  el.querySelector('#bookRefresh').addEventListener('click', function(){ refresh(); });
  el.querySelector('#bookReset').addEventListener('click', async function(){
    if (!confirm('Reset paper book to $1M NAV and clear all positions?')) return;
    if (bookApiOn()){
      await bookFetch('/api/book/reset', { method: 'POST', body: '{}' });
      await refresh();
    }
  });
  el.addEventListener('click', async function(ev){
    var btn = ev.target && ev.target.closest ? ev.target.closest('[data-close]') : null;
    if (!btn) return;
    var id = btn.getAttribute('data-close');
    if (!id || !bookApiOn()) return;
    await bookFetch('/api/book/close', { method: 'POST', body: JSON.stringify({ id: id }) });
    await refresh();
  });

  refresh();
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

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'book', label: 'BOOK', mount: mount, refresh: bookRefresh });

})();
