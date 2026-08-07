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

var __book = { snap: null, desk: null, busy: false, lastAt: 0, autoTimer: null, autoLog: [], liveReady: false, digestReady: false, consolidatedAll: null };
var __bookOpenKeys = {};
var BOOK_AUTO_MS = 45000;
var BOOK_MAX_HEAT_PCT = 0.06;
var BOOK_MAX_DAILY_LOSS_PCT = 0.02;
var BOOK_AUTO_KEY = 'hg_book_auto_rules_v1';
var BOOK_AUTO_EXEC_KEY = 'hg_book_auto_exec_v1';
var BOOK_AUTO_EXEC_PENDING_KEY = 'hg_book_auto_exec_pending_v1';
var BOOK_AUTO_RETRY_FAILED_KEY = 'hg_book_auto_retry_failed_v1';
var BOOK_AUTO_EXEC_CROSS_FUND_KEY = 'hg_book_auto_exec_cross_fund_v1';
var BOOK_AUTO_POLL_FILLS_KEY = 'hg_book_auto_poll_fills_v1';
var BOOK_BLOTTER_FILTER_KEY = 'hg_book_blotter_filter_v1';
var BOOK_POSITIONS_FILL_FILTER_KEY = 'hg_book_positions_fill_filter_v1';
var BOOK_POSITIONS_BRACKET_FILTER_KEY = 'hg_book_positions_bracket_filter_v1';
var BOOK_FUND_KEY = 'hg_book_fund_v1';

function bookFundId(){
  try{
    var v = localStorage.getItem(BOOK_FUND_KEY);
    return v || 'main';
  }catch(e){ return 'main'; }
}
function bookSetFund(id){
  try{ localStorage.setItem(BOOK_FUND_KEY, id || 'main'); }catch(e){}
}
function bookFundQuery(){
  return '?fund=' + encodeURIComponent(bookFundId());
}
function bookFundBody(extra){
  extra = extra || {};
  if (!extra.fund) extra.fund = bookFundId();
  return extra;
}

function bookResolveFund(opts){
  opts = opts || {};
  var scannerFn = W.hgBookScannerFund || W.bookScannerFund;
  if (opts.scanner && typeof scannerFn === 'function'){
    return scannerFn(opts.scanner, opts);
  }
  if (typeof W.bookRouteFund === 'function'){
    return W.bookRouteFund({
      fund: opts.fund,
      strategy: opts.strategy || opts.source,
      klass: opts.klass,
      source: opts.source,
    }, bookFundId());
  }
  return opts.fund || bookFundId();
}

function bookMetaLayers(meta){
  meta = meta || {};
  var L = Array.isArray(meta.layers) ? meta.layers.slice() : [];
  if (meta.scanner){
    var s = String(meta.scanner);
    if (L.indexOf(s) < 0) L.unshift(s);
  }
  return L.slice(0, 12);
}

function bookAutoOn(){
  try{
    var v = localStorage.getItem(BOOK_AUTO_KEY);
    return v === null ? true : v === '1';
  }catch(e){ return true; }
}
function bookSetAuto(on){
  try{ localStorage.setItem(BOOK_AUTO_KEY, on ? '1' : '0'); }catch(e){}
}
function bookAutoExecOn(){
  try{ return localStorage.getItem(BOOK_AUTO_EXEC_KEY) === '1'; }catch(e){ return false; }
}
function bookSetAutoExec(on){
  try{ localStorage.setItem(BOOK_AUTO_EXEC_KEY, on ? '1' : '0'); }catch(e){}
}
function bookAutoExecPendingOn(){
  try{ return localStorage.getItem(BOOK_AUTO_EXEC_PENDING_KEY) === '1'; }catch(e){ return false; }
}
function bookSetAutoExecPending(on){
  try{ localStorage.setItem(BOOK_AUTO_EXEC_PENDING_KEY, on ? '1' : '0'); }catch(e){}
}
function bookAutoRetryFailedOn(){
  try{ return localStorage.getItem(BOOK_AUTO_RETRY_FAILED_KEY) === '1'; }catch(e){ return false; }
}
function bookSetAutoRetryFailed(on){
  try{ localStorage.setItem(BOOK_AUTO_RETRY_FAILED_KEY, on ? '1' : '0'); }catch(e){}
}
function bookAutoExecCrossFundOn(){
  try{ return localStorage.getItem(BOOK_AUTO_EXEC_CROSS_FUND_KEY) === '1'; }catch(e){ return false; }
}
function bookAutoPollFillsOn(){
  try{ return localStorage.getItem(BOOK_AUTO_POLL_FILLS_KEY) === '1'; }catch(e){ return false; }
}
function bookSetAutoPollFills(on){
  try{ localStorage.setItem(BOOK_AUTO_POLL_FILLS_KEY, on ? '1' : '0'); }catch(e){}
}
function bookDailyLossHalted(){
  if (__book.desk && __book.desk.dailyLossHalt) return true;
  var s = __book.snap && __book.snap.summary;
  return !!(s && s.dailyLossHalt);
}
function bookSetAutoExecCrossFund(on){
  try{ localStorage.setItem(BOOK_AUTO_EXEC_CROSS_FUND_KEY, on ? '1' : '0'); }catch(e){}
}
function bookBlotterExecOnlyOn(){
  try{ return localStorage.getItem(BOOK_BLOTTER_FILTER_KEY) === 'execute'; }catch(e){ return false; }
}
function bookSetBlotterExecOnly(on){
  try{ localStorage.setItem(BOOK_BLOTTER_FILTER_KEY, on ? 'execute' : 'all'); }catch(e){}
}
function bookPositionsFillFilterOn(){
  try{ return localStorage.getItem(BOOK_POSITIONS_FILL_FILTER_KEY) === '1'; }catch(e){ return false; }
}
function bookSetPositionsFillFilter(on){
  try{
    localStorage.setItem(BOOK_POSITIONS_FILL_FILTER_KEY, on ? '1' : '0');
    if (on) localStorage.setItem(BOOK_POSITIONS_BRACKET_FILTER_KEY, '0');
  }catch(e){}
}
function bookPositionsBracketPendingFilterOn(){
  try{ return localStorage.getItem(BOOK_POSITIONS_BRACKET_FILTER_KEY) === '1'; }catch(e){ return false; }
}
function bookSetPositionsBracketPendingFilter(on){
  try{
    localStorage.setItem(BOOK_POSITIONS_BRACKET_FILTER_KEY, on ? '1' : '0');
    if (on) localStorage.setItem(BOOK_POSITIONS_FILL_FILTER_KEY, '0');
  }catch(e){}
}
function bookPositionFillBacklog(p, blotter){
  return bookPositionNeedsFillPoll(p, blotter);
}
function bookPositionBracketPending(p, blotter){
  return bookExecStatus(blotter, p && p.id) === 'pending';
}
function bookFilterBlotterRows(rows){
  rows = rows || [];
  if (!bookBlotterExecOnlyOn()) return rows;
  return rows.filter(function(b){
    return b && (b.type === 'execute_ok' || b.type === 'execute_fail'
      || b.type === 'execute_fill' || b.type === 'live_send');
  });
}

function bookDataFund(p){
  return (p && p._fundId) ? (' data-fund="' + esc(p._fundId) + '"') : '';
}

function bookActionFund(el){
  if (!el || !el.getAttribute) return bookFundId();
  return el.getAttribute('data-fund') || bookFundId();
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
    var r = await bookFetch('/api/book' + bookFundQuery());
    if (r.json && r.json.ok){
      __book.snap = r.json;
      /* The server may advertise liveExecute; this build declines it. */
      __book.liveReady = bookLiveAllowed() && !!(r.json.capabilities && r.json.capabilities.liveExecute);
      __book.digestReady = !!(r.json.capabilities && (r.json.capabilities.digestSend || r.json.capabilities.digestWebhook));
      if (r.json.fundId) bookSetFund(r.json.fundId);
      __book.funds = r.json.funds || [];
      if ((__book.funds || []).length > 1){
        try{
          var ar = await bookFetch('/api/book/attribution');
          if (ar.json && ar.json.ok && ar.json.attribution) __book.snap.crossAttribution = ar.json.attribution;
          var dr = await bookFetch('/api/book/desk');
          if (dr.json && dr.json.ok && dr.json.desk) __book.desk = dr.json.desk;
          __book.consolidatedAll = await bookFetchAllPositions();
        }catch(e){}
      } else {
        __book.desk = null;
        __book.consolidatedAll = null;
      }
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
      scalePct: isFinite(opts.scalePct) ? +opts.scalePct : null,
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

function bookBuildExecutePlan(position, source){
  if (!position || !position.id) return null;
  var mark = isFinite(position.mark) ? position.mark : position.entry;
  var qty = (mark > 0 && position.notionalUsd > 0) ? position.notionalUsd / mark : 0;
  if (!(qty > 0)) return null;
  var t1 = isFinite(position.t1) ? position.t1 : null;
  if (!isFinite(t1)){
    var risk = Math.abs(position.entry - position.stop);
    t1 = position.dir === 'short' ? position.entry - risk : position.entry + risk;
  }
  return {
    sym: position.sym,
    side: position.dir,
    qty: qty,
    entry: isFinite(position.entry) ? position.entry : mark,
    lev: 1,
    stop: position.stop,
    t1: t1,
    t2: isFinite(position.t2) ? position.t2 : undefined,
    vetoed: false,
    positionId: position.id,
    source: source || 'hardgate-book',
  };
}

async function bookMaybeAutoExecute(position){
  if (!bookAutoExecOn() || !position || !position.id) return null;
  if (typeof W.executeTrade !== 'function' || !bookExecuteReady()) return null;
  var plan = bookBuildExecutePlan(position, 'hardgate-book-auto');
  if (!plan) return null;
  if (position._fundId) plan.fund = position._fundId;
  return W.executeTrade(plan, { skipConfirm: true });
}

async function bookMaybeAutoExecPending(snap){
  if (!bookAutoExecPendingOn() || !bookExecuteReady()) return null;
  var scope = await bookAutoExecScope(snap);
  var targets = bookExecTargets(scope.positions, scope.blotter, { pending: true, failed: false });
  if (!targets.length) return null;
  return bookExecuteBatch(targets, 'hardgate-book-auto-pending');
}

async function bookMaybeAutoRetryFailed(snap){
  if (!bookAutoRetryFailedOn() || !bookExecuteReady()) return null;
  var scope = await bookAutoExecScope(snap);
  var targets = bookExecTargets(scope.positions, scope.blotter, { pending: false, failed: true });
  if (!targets.length) return null;
  return bookExecuteBatch(targets, 'hardgate-book-auto-retry');
}

async function bookPollFills(opts){
  opts = opts || {};
  if (!bookApiOn() || !bookExecuteReady()) return { ok: false, reason: 'unavailable' };
  var multiFund = (__book.funds || []).length > 1;
  var body = { allFunds: opts.allFunds != null ? !!opts.allFunds : multiFund };
  if (opts.fund) body.fund = opts.fund;
  var r = await bookFetch('/api/book/poll-fills', { method: 'POST', body: JSON.stringify(bookFundBody(body)) });
  return (r.json && typeof r.json === 'object') ? r.json : { ok: false, reason: 'poll failed' };
}

async function bookMaybeAutoPollFills(){
  if (!bookAutoPollFillsOn() || !bookExecuteReady() || !bookApiOn()) return null;
  var deskFill = __book.desk && __book.desk.fill;
  if (!deskFill || !(deskFill.unfilled || deskFill.partial)) return null;
  var multiFund = (__book.funds || []).length > 1;
  return bookPollFills({ allFunds: multiFund });
}

async function bookPollAllFundsFills(){
  return bookPollFills({ allFunds: true });
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
      fund: bookResolveFund(opts),
      layers: bookMetaLayers(opts),
      scalePct: isFinite(opts.scalePct) ? +opts.scalePct : null,
      newsBlackout: false,
    };
    if (!body.sym || !body.dir || !isFinite(body.entry) || !isFinite(body.stop)){
      return { ok: false, reason: 'invalid plan' };
    }
    if ((opts.scanner === 'brain' || opts.strategy === 'brain')
        && typeof W.brainLiveModeOn === 'function' && W.brainLiveModeOn()
        && typeof W.brainLiveEligible === 'function' && opts._brainRow){
      var liveGate = W.brainLiveEligible(opts._brainRow);
      if (!liveGate.ok){
        return { ok: false, veto: true, reasons: ['LIVE MODE: ' + (liveGate.reasons || []).join(' · ')] };
      }
    }
    if (body.t1 == null || !isFinite(body.t1)){
      var risk = Math.abs(body.entry - body.stop);
      body.t1 = body.dir === 'short' ? body.entry - risk : body.entry + risk;
    }
    if (bookApiOn()){
      var r = await bookFetch('/api/book/intent', { method: 'POST', body: JSON.stringify(bookFundBody(body)) });
      if (r.json && r.json.ok){
        await bookPull();
        bookScoreRecord(body);
        __book.lastAt = Date.now();
        try{
          if ((opts.scanner === 'brain' || body.strategy === 'brain') && typeof W.hgBrainBookLayerRecord === 'function'){
            W.hgBrainBookLayerRecord({
              fund: body.fund, sym: body.sym, dir: body.dir, tier: body.tier,
              layers: body.layers || [],
              layerSig: opts.layerSig || ''
            });
          }
        }catch(eRec){}
        try{
          if (r.json.position){
            var autoPos = r.json.position;
            if (r.json.fundId) autoPos = Object.assign({}, autoPos, { _fundId: r.json.fundId });
            await bookMaybeAutoExecute(autoPos);
          }
        }catch(eAuto){}
        try{ await bookRefreshOpenKeys(); __hgBookKeysRefreshAt = Date.now(); hgBookStampRepaintDom(); }catch(eKeys){}
        if (!opts.silent && typeof W.showTab === 'function') W.showTab('book');
        return r.json;
      }
      var msg = (r.json && r.json.reasons) ? r.json.reasons.join(' · ') : ((r.json && r.json.reason) || 'risk veto');
      if (!opts.silent){ try{ alert('BOOK: ' + msg); }catch(e){} }
      return r.json || { ok: false, reason: 'book API error' };
    }
    if (!opts.silent){ try{ alert('Paper book requires Render backend — open hardgate-main.onrender.com'); }catch(e2){} }
  }catch(e){
    return { ok: false, reason: (e && e.message) || String(e) };
  }
}

function bookPositionKey(fund, sym, dir){
  return String(fund || 'main') + ':' + String(sym) + ':' + String(dir);
}

async function bookFetchAllFundBooks(){
  var out = [];
  if (!bookApiOn()) return out;
  try{
    var fr = await bookFetch('/api/book/funds');
    var ids = [];
    if (fr.json && Array.isArray(fr.json.funds)){
      for (var fi = 0; fi < fr.json.funds.length; fi++){
        var fid = fr.json.funds[fi] && fr.json.funds[fi].id;
        if (fid) ids.push(fid);
      }
    }
    if (!ids.length) ids = ['main'];
    await Promise.all(ids.map(async function(id){
      try{
        var r = await bookFetch('/api/book?fund=' + encodeURIComponent(id));
        if (r.json && r.json.book) out.push({ fundId: id, book: r.json.book });
      }catch(e){}
    }));
  }catch(e){}
  return out;
}

async function bookFetchAllPositions(){
  var packs = await bookFetchAllFundBooks();
  var positions = [];
  var blotter = [];
  var closed = [];
  for (var i = 0; i < packs.length; i++){
    var pack = packs[i];
    var fundId = pack.fundId;
    var book = pack.book || {};
    var pos = book.positions || [];
    for (var p = 0; p < pos.length; p++){
      if (pos[p]) positions.push(Object.assign({}, pos[p], { _fundId: fundId }));
    }
    var bl = book.blotter || [];
    for (var b = 0; b < bl.length; b++){
      if (bl[b]) blotter.push(Object.assign({}, bl[b], { _fundId: fundId }));
    }
    var cl = book.closed || [];
    for (var c = 0; c < cl.length; c++){
      if (cl[c]) closed.push(Object.assign({}, cl[c], { _fundId: fundId }));
    }
  }
  blotter.sort(function(a, b){ return (+b.at || 0) - (+a.at || 0); });
  closed.sort(function(a, b){ return (+b.closedAt || 0) - (+a.closedAt || 0); });
  return { positions: positions, blotter: blotter, closed: closed };
}

async function bookAutoExecScope(snap){
  if (bookAutoExecCrossFundOn() && (__book.funds || []).length > 1){
    var all = __book.consolidatedAll || await bookFetchAllPositions();
    __book.consolidatedAll = all;
    return { positions: all.positions || [], blotter: all.blotter || [] };
  }
  snap = snap || __book.snap;
  return {
    positions: (snap && snap.book && snap.book.positions) || [],
    blotter: (snap && snap.book && snap.book.blotter) || [],
  };
}

async function bookPullAfterAutoExec(){
  await bookPull();
  if ((__book.funds || []).length > 1){
    try{ __book.consolidatedAll = await bookFetchAllPositions(); }catch(e){}
  }
}

async function bookRefreshOpenKeys(){
  try{
    __bookOpenKeys = await bookFetchOpenKeys();
    W.__hgBookOpenKeys = __bookOpenKeys;
  }catch(e){
    __bookOpenKeys = {};
    W.__hgBookOpenKeys = __bookOpenKeys;
  }
  return __bookOpenKeys;
}

var __hgBookKeysRefreshAt = 0;
/** Throttled open-key refresh so IN BOOK stamps work without visiting BOOK tab first. */
function hgBookStampRepaintDom(){
  try{
    var nodes = document.querySelectorAll('.hg-book-stamp[data-hg-book-sym][data-hg-book-dir]');
    for (var i = 0; i < nodes.length; i++){
      var n = nodes[i];
      var sym = n.getAttribute('data-hg-book-sym');
      var dir = n.getAttribute('data-hg-book-dir');
      var metaRaw = n.getAttribute('data-hg-book-meta') || '{}';
      var meta = {};
      try{ meta = JSON.parse(metaRaw); }catch(e){}
      n.innerHTML = hgBookStampHTML(sym, dir, bookResolveFund(meta));
    }
  }catch(e){}
}

/** IN BOOK chip wrapped for live DOM refresh after open-key sync. */
function hgBookStampSlot(sym, dir, meta){
  if (!sym || (dir !== 'long' && dir !== 'short')) return '';
  var html = hgBookStampForMeta(sym, dir, meta || {});
  var metaAttr = '{}';
  try{ metaAttr = esc(JSON.stringify(meta || {})); }catch(e){}
  return '<span class="hg-book-stamp" data-hg-book-sym="' + esc(String(sym)) + '" data-hg-book-dir="' + dir + '" data-hg-book-meta="' + metaAttr + '">' + html + '</span>';
}

/** UI-facing IN BOOK chip — slotted for live refresh via hgBookStampRepaintDom. */
function hgBookStampChip(sym, dir, meta){
  return hgBookStampSlot(sym, dir, meta || {});
}

function hgBookStampRefreshThrottled(force){
  if (!bookApiOn()) return Promise.resolve(__bookOpenKeys || {});
  var now = Date.now();
  if (!force && now - __hgBookKeysRefreshAt < 45000) return Promise.resolve(__bookOpenKeys || {});
  __hgBookKeysRefreshAt = now;
  return bookRefreshOpenKeys().then(function(keys){
    hgBookStampRepaintDom();
    return keys;
  });
}

function hgBookStampHTML(sym, dir, fund){
  if (!sym || (dir !== 'long' && dir !== 'short')) return '';
  fund = fund || 'main';
  var keys = __bookOpenKeys || W.__hgBookOpenKeys || {};
  var k = bookPositionKey(fund, sym, dir);
  if (!keys[k]){
    for (var fk in keys){
      if (!Object.prototype.hasOwnProperty.call(keys, fk)) continue;
      if (fk.indexOf(':' + String(sym).toUpperCase() + ':' + dir) >= 0) return '<span class="statuschip" title="Open in paper book">IN BOOK</span>';
    }
    return '';
  }
  return '<span class="statuschip" title="Open in ' + esc(fund) + ' fund">IN BOOK</span>';
}

/** IN BOOK chip with fund resolved from scanner/strategy meta (same as ADD TO BOOK). */
function hgBookStampForMeta(sym, dir, meta){
  if (!sym || (dir !== 'long' && dir !== 'short')) return '';
  return hgBookStampHTML(sym, dir, bookResolveFund(meta || {}));
}

async function bookFetchOpenKeys(){
  var keys = {};
  if (!bookApiOn()) return keys;
  try{
    var fr = await bookFetch('/api/book/funds');
    var ids = [];
    if (fr.json && Array.isArray(fr.json.funds)){
      for (var fi = 0; fi < fr.json.funds.length; fi++){
        var fid = fr.json.funds[fi] && fr.json.funds[fi].id;
        if (fid) ids.push(fid);
      }
    }
    if (!ids.length) ids = ['main'];
    await Promise.all(ids.map(async function(id){
      try{
        var r = await bookFetch('/api/book?fund=' + encodeURIComponent(id));
        var pos = (r.json && r.json.book && r.json.book.positions) || [];
        for (var i = 0; i < pos.length; i++){
          var p = pos[i];
          if (p && p.sym && p.dir) keys[bookPositionKey(id, p.sym, p.dir)] = true;
        }
      }catch(e){}
    }));
  }catch(e){}
  return keys;
}

function bookBtnHTML(sym, dir, entry, stop, t1, meta){
  meta = meta || {};
  var fund = bookResolveFund(meta);
  var payload = JSON.stringify({
    sym: sym, dir: dir, entry: entry, stop: stop,
    t1: (t1 !== undefined && isFinite(t1)) ? t1 : null,
    t2: (meta.t2 !== undefined && isFinite(meta.t2)) ? meta.t2 : null,
    scalePct: (meta.scalePct !== undefined && isFinite(meta.scalePct)) ? meta.scalePct : null,
    strategy: meta.strategy || meta.source || 'scanner',
    tier: meta.tier || null,
    klass: meta.klass || null,
    venue: meta.venue || 'paper',
    fund: fund,
    layers: bookMetaLayers(meta)
  });
  return '<button class="toBook" title="Add to ' + fund + ' fund" onclick=\'addToBook(' + payload + ')\'>ADD · ' + esc(fund.toUpperCase()) + '</button>';
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
      body: JSON.stringify(bookFundBody({ marks: marks, atrMarks: atrMarks, auto: bookAutoOn() })),
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

function blotterHTML(rows, opts){
  opts = opts || {};
  rows = (rows || []).slice(0, 10);
  if (!rows.length){
    return '<div class="note">' + esc(opts.empty || 'No blotter events yet.') + '</div>';
  }
  var showFund = rows.some(function(b){ return b && b._fundId; });
  return '<table class="booktbl"><thead><tr><th>Time</th>'
    + (showFund ? '<th>Fund</th>' : '')
    + '<th>Event</th><th>Symbol</th><th>Detail</th></tr></thead><tbody>'
    + rows.map(function(b){
      var type = b.type || '—';
      var typeCls = (type === 'execute_ok' || type === 'execute_fill') ? 'ok' : ((type === 'execute_fail') ? 'warn' : '');
      var detail = b.note || b.dir || '';
      if (type === 'execute_fill' && isFinite(b.fillPct)){
        detail = (detail ? detail + ' · ' : '') + Math.round(b.fillPct * 100) + '% filled';
      }
      if (!detail && b.qty != null) detail = 'qty ' + fmtF(b.qty, 4);
      if (b.status) detail += (detail ? ' · ' : '') + 'HTTP ' + b.status;
      if (b.idempotencyKey) detail += (detail ? ' · ' : '') + 'idem ' + String(b.idempotencyKey).slice(0, 16);
      return '<tr><td>' + new Date(b.at).toLocaleTimeString() + '</td>'
        + (showFund ? '<td>' + esc(b._fundId || '—') + '</td>' : '')
        + '<td class="' + typeCls + '">' + esc(type) + '</td>'
        + '<td>' + esc(b.sym || '—') + '</td><td>' + esc(detail) + '</td></tr>';
    }).join('') + '</tbody></table>';
}

function deskHeaderHTML(desk){
  if (!desk || (desk.fundCount || 0) < 2) return '';
  var maxPct = BOOK_MAX_HEAT_PCT;
  var heatPct = isFinite(desk.heatPct) ? desk.heatPct : 0;
  var fill = maxPct > 0 ? Math.min(100, (heatPct / maxPct) * 100) : 0;
  var warn = heatPct >= maxPct * 0.85;
  var fundChips = (desk.funds || []).map(function(f){
    return '<span class="statuschip">' + esc(f.label || f.id) + ' <b>' + fmtUsd(f.equityUsd) + '</b>'
      + ' · heat ' + fmtF((f.heatPct || 0) * 100, 1) + '% · ' + (f.openCount || 0) + ' open</span>';
  }).join('');
  return '<div class="panel bookDeskHdr"><h3>Desk rollup <span>' + desk.fundCount + ' funds</span></h3>'
    + '<div class="kv"><span class="k">Total equity</span><span class="v">' + fmtUsd(desk.equityUsd) + '</span>'
    + '<span class="k">NAV</span><span class="v">' + fmtUsd(desk.navUsd) + '</span>'
    + '<span class="k">Open</span><span class="v">' + (desk.openCount || 0) + ' · gross ' + fmtUsd(desk.grossUsd || 0) + '</span></div>'
    + '<div class="bookHeatWrap"><span class="k">Cross-fund heat</span>'
    + '<div class="bookHeatBar' + (warn ? ' warn' : '') + '"><div class="bookHeatFill" style="width:' + fill.toFixed(1) + '%"></div></div>'
    + '<span class="v">' + fmtF(heatPct * 100, 2) + '% / ' + fmtF(maxPct * 100, 0) + '% · ' + fmtUsd(desk.heatUsd || 0) + '</span></div>'
    + (desk.dailyLossHalt
      ? '<div class="note warn" style="margin-top:6px">⛔ Desk daily loss halt — new risk blocked until UTC day roll. Day P&amp;L '
        + fmtUsd(desk.dayPnlUsd) + ' · limit -' + fmtUsd(desk.dailyLossLimitUsd) + '</div>' : '')
    + (desk.execute && (desk.execute.ok || desk.execute.fail || desk.execute.pending)
      ? '<div class="note" style="margin-top:6px">Cross-fund brackets (7d): <b>'
        + (desk.execute.ok || 0) + ' OK</b> · <b>' + (desk.execute.fail || 0) + ' fail</b> · '
        + (desk.execute.pending || 0) + ' open without bracket'
        + (bookExecuteReady() && desk.execute.pending
          ? ' · <span class="statuschip warn bookDeskAct" id="bookDeskExecPending" style="cursor:pointer"'
            + ' title="Send brackets for all pending positions across funds">EXEC all pending</span>' : '')
        + (bookExecuteReady() && desk.execute.fail
          ? ' · <span class="statuschip warn bookDeskAct" id="bookDeskExecRetry" style="cursor:pointer"'
            + ' title="Retry all failed brackets across funds">retry all failed</span>' : '')
        + '</div>' : '')
    + (desk.fill && (desk.fill.unfilled || desk.fill.partial)
      ? '<div class="note warn" style="margin-top:6px">Broker fills: <b>' + (desk.fill.unfilled || 0)
        + ' unfilled</b> · <b>' + (desk.fill.partial || 0) + ' partial</b> (bracket sent, fill not confirmed)'
        + (bookExecuteReady()
          ? ' · <span class="statuschip warn bookDeskAct" id="bookDeskPollFills" style="cursor:pointer"'
            + ' title="Poll EXECUTE backend for broker fill status across funds">poll fills</span>' : '')
        + '</div>' : '')
    + (fundChips ? '<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px">' + fundChips + '</div>' : '')
    + '</div>';
}

async function bookLivePosition(id, fundId){
  if (!bookApiOn()) return;
  if (!bookLiveAllowed()){
    try{ alert('Live order routing is disabled in this build. HARDGATE is a signal + paper terminal.'); }catch(e){}
    return;
  }
  if (!__book.liveReady){
    try{ alert('Live execute not configured — set EXECUTE_WEBHOOK_URL on Render.'); }catch(e){}
    return;
  }
  var p = bookFindPosAny(id);
  fundId = fundId || (p && p._fundId) || bookFundId();
  if (!confirm('Send LIVE bracket for this paper position to the execution webhook?')) return;
  var r = await bookFetch('/api/book/live', { method: 'POST', body: JSON.stringify(bookFundBody({ id: id, fund: fundId })) });
  if (r.json && r.json.ok){
    var fillNote = (r.json.fillPct != null && r.json.fillPct > 0)
      ? (' · fill ' + Math.round(r.json.fillPct * 100) + '% recorded') : '';
    try{ alert('Live bracket sent (HTTP ' + r.json.status + ').' + fillNote); }catch(e2){}
  } else {
    try{ alert('Live send failed: ' + ((r.json && r.json.reason) || r.json.response || 'error')); }catch(e3){}
  }
  await bookPull();
  var pane = document.getElementById('tab_book');
  if (pane && pane.querySelector('#bookRefresh')) pane.querySelector('#bookRefresh').click();
}

/* Single source of truth for whether this build may route real orders.
   Mirrors execute.js HG_LIVE_TRADING_ENABLED; defaults to DISABLED when
   execute.js is absent, so a missing script can never open the path. */
function bookLiveAllowed(){
  return typeof W.hgLiveTradingEnabled === 'function' && W.hgLiveTradingEnabled() === true;
}
function bookExecuteReady(){
  if (!bookLiveAllowed()) return false;
  return typeof W.executeBackendReady === 'function' && W.executeBackendReady();
}

function bookExecStatus(blotter, positionId){
  var evt = bookLatestExecForPosition(blotter, positionId);
  if (!evt) return 'pending';
  return bookBracketEventOk(evt) ? 'ok' : 'fail';
}

function bookExecTargets(positions, blotter, modes){
  positions = positions || [];
  blotter = blotter || [];
  modes = modes || {};
  var wantPending = modes.pending !== false;
  var wantFailed = !!modes.failed;
  var out = [];
  for (var i = 0; i < positions.length; i++){
    var p = positions[i];
    if (!p || !p.id) continue;
    var st = bookExecStatus(blotter, p.id);
    if (st === 'ok') continue;
    if (st === 'pending' && wantPending) out.push(p);
    else if (st === 'fail' && wantFailed) out.push(p);
  }
  return out;
}

async function bookExecuteFromPosition(position, opts){
  opts = opts || {};
  if (!position || !position.id) return { ok: false, reason: 'missing position' };
  if (typeof W.executeTrade !== 'function') return { ok: false, reason: 'no executeTrade' };
  if (!bookExecuteReady()){
    if (!opts.silent){ try{ alert('EXECUTE BRACKET unavailable — set EXECUTE_BACKEND_URL on Render or save an Execute URL in Settings.'); }catch(e){} }
    return { ok: false, reason: 'execute off' };
  }
  var plan = bookBuildExecutePlan(position, opts.source);
  if (!plan){
    if (!opts.silent){ try{ alert('Cannot size bracket — missing mark or notional.'); }catch(e2){} }
    return { ok: false, reason: 'invalid plan' };
  }
  if (opts.fund || position._fundId) plan.fund = opts.fund || position._fundId;
  try{
    await W.executeTrade(plan, opts.skipConfirm ? { skipConfirm: true } : {});
    return { ok: true };
  }catch(e){
    return { ok: false, reason: (e && e.message) || String(e) };
  }
}

async function bookExecutePosition(id, opts){
  opts = opts || {};
  var p = bookFindPosAny(id);
  if (!p) return { ok: false, reason: 'missing position' };
  if (!opts.fund && p._fundId) opts.fund = p._fundId;
  return bookExecuteFromPosition(p, opts);
}

async function bookExecuteBatch(targets, source){
  targets = targets || [];
  if (!targets.length) return { ok: 0, fail: 0, total: 0 };
  if (!bookExecuteReady()){
    try{ alert('EXECUTE BRACKET unavailable — set EXECUTE_BACKEND_URL on Render.'); }catch(e){}
    return { ok: 0, fail: 0, total: 0 };
  }
  var ok = 0;
  var fail = 0;
  for (var i = 0; i < targets.length; i++){
    var p = targets[i];
    var pid = (p && p.id) ? p.id : p;
    var r = (p && p.sym)
      ? await bookExecuteFromPosition(p, {
        skipConfirm: true, silent: true,
        source: source || 'hardgate-book-batch',
        fund: p._fundId,
      })
      : await bookExecutePosition(pid, { skipConfirm: true, silent: true, source: source || 'hardgate-book-batch' });
    if (r && r.ok) ok++;
    else fail++;
  }
  try{
    if (typeof W.bookRefresh === 'function') await W.bookRefresh();
  }catch(e){}
  return { ok: ok, fail: fail, total: targets.length };
}

async function bookExecuteBatchPositions(positions, source){
  return bookExecuteBatch(positions, source);
}

async function bookExecutePending(){
  var snap = __book.snap || await bookPull();
  var positions = (snap && snap.book && snap.book.positions) || [];
  var blotter = (snap && snap.book && snap.book.blotter) || [];
  var targets = bookExecTargets(positions, blotter, { pending: true, failed: false });
  if (!targets.length){ try{ alert('No open positions waiting for a bracket.'); }catch(e){} return; }
  var syms = targets.map(function(p){ return p.sym; }).join(', ');
  if (!confirm('Send EXEC brackets for ' + targets.length + ' position' + (targets.length === 1 ? '' : 's')
    + ' without a blotter record?\n\n' + syms)) return;
  var res = await bookExecuteBatch(targets, 'hardgate-book-pending');
  try{ alert('EXEC pending: ' + res.ok + ' sent · ' + res.fail + ' failed'); }catch(e2){}
}

async function bookRetryFailed(){
  var snap = __book.snap || await bookPull();
  var positions = (snap && snap.book && snap.book.positions) || [];
  var blotter = (snap && snap.book && snap.book.blotter) || [];
  var targets = bookExecTargets(positions, blotter, { pending: false, failed: true });
  if (!targets.length){ try{ alert('No positions with a failed bracket to retry.'); }catch(e){} return; }
  var syms = targets.map(function(p){ return p.sym; }).join(', ');
  if (!confirm('Retry EXEC brackets for ' + targets.length + ' failed position'
    + (targets.length === 1 ? '' : 's') + '?\n\n' + syms)) return;
  var res = await bookExecuteBatch(targets, 'hardgate-book-retry');
  try{ alert('EXEC retry: ' + res.ok + ' sent · ' + res.fail + ' failed'); }catch(e2){}
}

async function bookExecuteAllFundsPending(){
  var all = await bookFetchAllPositions();
  var targets = bookExecTargets(all.positions, all.blotter, { pending: true, failed: false });
  if (!targets.length){ try{ alert('No open positions across all funds waiting for a bracket.'); }catch(e){} return; }
  var lines = targets.map(function(p){ return (p._fundId || 'main') + ':' + p.sym; }).join(', ');
  if (!confirm('Send EXEC brackets for ' + targets.length + ' pending position'
    + (targets.length === 1 ? '' : 's') + ' across all funds?\n\n' + lines)) return;
  var res = await bookExecuteBatch(targets, 'hardgate-book-all-pending');
  try{ alert('All-funds EXEC: ' + res.ok + ' sent · ' + res.fail + ' failed'); }catch(e2){}
}

async function bookRetryAllFundsFailed(){
  var all = await bookFetchAllPositions();
  var targets = bookExecTargets(all.positions, all.blotter, { pending: false, failed: true });
  if (!targets.length){ try{ alert('No failed brackets across all funds to retry.'); }catch(e){} return; }
  var lines = targets.map(function(p){ return (p._fundId || 'main') + ':' + p.sym; }).join(', ');
  if (!confirm('Retry EXEC for ' + targets.length + ' failed position'
    + (targets.length === 1 ? '' : 's') + ' across all funds?\n\n' + lines)) return;
  var res = await bookExecuteBatch(targets, 'hardgate-book-all-retry');
  try{ alert('All-funds retry: ' + res.ok + ' sent · ' + res.fail + ' failed'); }catch(e2){}
}

async function bookExportLp(){
  try{
    var month = new Date().toISOString().slice(0, 7);
    var r = await bookFetch('/api/book/lp?month=' + encodeURIComponent(month) + '&fund=' + encodeURIComponent(bookFundId()));
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
    var r = await bookFetch('/api/book/digest?period=' + encodeURIComponent(period) + '&fund=' + encodeURIComponent(bookFundId()));
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

async function bookExportConsolidated(period){
  period = period === 'week' ? 'week' : 'month';
  try{
    var month = new Date().toISOString().slice(0, 7);
    var r = await bookFetch('/api/book/consolidated?period=' + encodeURIComponent(period)
      + (period === 'month' ? '&month=' + encodeURIComponent(month) : ''));
    if (!r.json || !r.json.ok) return;
    var html = r.json.html || '';
    if (!html && r.json.consolidated){
      html = '<!DOCTYPE html><html><body><pre>' + esc(JSON.stringify(r.json.consolidated, null, 2)) + '</pre></body></html>';
    }
    var blob = new Blob([html], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hardgate-consolidated-' + period + '-' + new Date().toISOString().slice(0, 10) + '.html';
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){}
}

async function bookSendDigest(){
  if (!bookApiOn()) return;
  if (!__book.digestReady){
    try{ alert('Digest not configured — set LP_DIGEST_WEBHOOK_URL, Telegram, and/or LP_DIGEST_EMAIL_TO (+ Resend/SendGrid/SMTP) on Render.'); }catch(e){}
    return;
  }
  if (!confirm('Send weekly LP digest for fund "' + bookFundId() + '"?')) return;
  var r = await bookFetch('/api/book/digest/send', { method: 'POST', body: JSON.stringify(bookFundBody({ period: 'week', consolidated: false })) });
  if (r.json && r.json.ok){
    try{ alert('Digest sent.'); }catch(e2){}
  } else if (r.json && r.json.skipped){
    try{ alert('Digest skipped: ' + (r.json.reason || 'not due')); }catch(e4){}
  } else {
    try{ alert('Digest send failed: ' + ((r.json && r.json.reason) || r.json.response || 'error')); }catch(e3){}
  }
}

async function bookSendConsolidatedDigest(){
  if (!bookApiOn()) return;
  if (!__book.digestReady){
    try{ alert('Digest not configured — set LP_DIGEST_WEBHOOK_URL, Telegram, and/or LP_DIGEST_EMAIL_TO (+ Resend/SendGrid/SMTP) on Render.'); }catch(e){}
    return;
  }
  if (!confirm('Send consolidated weekly LP digest (all funds)?')) return;
  var r = await bookFetch('/api/book/digest/send', { method: 'POST', body: JSON.stringify({ period: 'week', consolidated: true }) });
  if (r.json && r.json.ok){
    var n = (r.json.fundCount != null) ? r.json.fundCount : (r.json.digest && r.json.digest.fundCount);
    try{ alert('Consolidated digest sent' + (n ? ' (' + n + ' funds).' : '.')); }catch(e2){}
  } else if (r.json && r.json.skipped){
    try{ alert('Digest skipped: ' + (r.json.reason || 'not due')); }catch(e4){}
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

function bookFindPosAny(id){
  var p = bookFindPos(id);
  if (p) return p;
  var all = (__book.consolidatedAll && __book.consolidatedAll.positions) || [];
  for (var i = 0; i < all.length; i++){
    if (all[i].id === id) return all[i];
  }
  return null;
}

function bookBlotterRowsForView(){
  var multiFund = (__book.funds || []).length > 1;
  if (multiFund && __book.consolidatedAll){
    return __book.consolidatedAll.blotter || [];
  }
  var snap = __book.snap;
  return (snap && snap.book && snap.book.blotter) || snap.blotter || [];
}

function bookPositionNeedsFillPoll(p, blotter){
  if (!p || !p.id) return false;
  if ((p.brokerFillPct || 0) >= 0.999) return false;
  return bookBracketEventOk(bookLatestExecForPosition(blotter, p.id));
}

async function bookPollFillPosition(id){
  if (!bookApiOn() || !bookExecuteReady()) return { ok: false, reason: 'unavailable' };
  var p = bookFindPosAny(id);
  if (!p) return { ok: false, reason: 'missing position' };
  var r = await bookFetch('/api/book/poll-fill', {
    method: 'POST',
    body: JSON.stringify(bookFundBody({ positionId: id, fund: p._fundId || bookFundId() })),
  });
  return (r.json && typeof r.json === 'object') ? r.json : { ok: false, reason: 'poll failed' };
}

function bookManagePosition(p){
  try{
    var snap = __book.snap;
    var eq = snap && snap.summary ? snap.summary.equityUsd : null;
    var tEq = document.getElementById('tEq');
    if (tEq && isFinite(eq)) tEq.value = Math.round(eq);
    if (typeof W.hgToTradePlanFromBook === 'function'){
      W.hgToTradePlanFromBook(p);
    }
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

function fundAttrTableHTML(attr){
  var funds = (attr && attr.byFund) || [];
  if (!funds.length) return '';
  return '<div class="panel bookCrossAttr"><h3>P&amp;L by fund <span>all books</span></h3>'
    + '<div style="overflow-x:auto"><table class="booktbl"><thead><tr>'
    + '<th>Fund</th><th>Equity</th><th>Open</th><th>Realized</th><th>Unrealized</th><th>Total P&amp;L</th>'
    + '</tr></thead><tbody>'
    + funds.map(function(f){
      var cls = (f.pnlUsd || 0) >= 0 ? 'ok' : 'warn';
      return '<tr><td>' + esc(f.label || f.id) + ' <span class="note">(' + esc(f.id) + ')</span></td>'
        + '<td>' + fmtUsd(f.equityUsd) + '</td><td>' + (f.openCount || 0) + '</td>'
        + '<td>' + fmtUsd(f.realizedUsd) + '</td><td>' + fmtUsd(f.unrealizedUsd) + '</td>'
        + '<td class="' + cls + '">' + fmtUsd(f.pnlUsd) + '</td></tr>';
    }).join('')
    + '</tbody></table></div></div>';
}

function strategyMatrixHTML(attr){
  var matrix = (attr && attr.strategyByFund) || [];
  var ids = (attr && attr.fundIds) || [];
  if (!matrix.length || ids.length < 2) return '';
  var labels = attr.fundLabels || {};
  var head = '<tr><th>Strategy</th>' + ids.map(function(id){
    return '<th>' + esc(labels[id] || id) + '</th>';
  }).join('') + '<th>Total</th></tr>';
  var body = matrix.map(function(row){
    var cells = ids.map(function(id){
      var v = row.cells && row.cells[id];
      if (v == null || v === 0) return '<td class="note">—</td>';
      var cls = v >= 0 ? 'ok' : 'warn';
      return '<td class="' + cls + '">' + fmtUsd(v) + '</td>';
    }).join('');
    var totalCls = (row.total || 0) >= 0 ? 'ok' : 'warn';
    return '<tr><td>' + esc(row.key) + '</td>' + cells
      + '<td class="' + totalCls + '"><b>' + fmtUsd(row.total) + '</b></td></tr>';
  }).join('');
  return '<div class="panel bookCrossAttr"><h3>Strategy × fund <span>cross-book attribution</span></h3>'
    + '<div style="overflow-x:auto"><table class="booktbl"><thead>' + head + '</thead><tbody>'
    + body + '</tbody></table></div></div>';
}

function crossAttrHTML(attr){
  if (!attr || (attr.fundCount || 0) < 2) return '';
  return fundAttrTableHTML(attr)
    + strategyMatrixHTML(attr)
    + attrTableHTML('P&amp;L by strategy (all funds)', attr.byStrategy)
    + attrTableHTML('P&amp;L by asset bucket (all funds)', attr.byBucket);
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

function bookCsvCell(v){
  var s = (v == null || v === undefined) ? '' : String(v);
  if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0){
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function bookExportBlotterCSV(){
  try{
    var rows = [];
    var multiFund = (__book.funds || []).length > 1;
    if (multiFund){
      var all = __book.consolidatedAll || await bookFetchAllPositions();
      rows = (all.blotter || []).slice();
    } else {
      var snap = __book.snap;
      if (!snap || !snap.book) return;
      rows = (snap.book.blotter || []).slice();
    }
    rows = bookFilterBlotterRows(rows);
    if (!rows.length){ try{ alert('No blotter events to export.'); }catch(e){} return; }
    var showFund = multiFund || rows.some(function(b){ return b && b._fundId; });
    var header = ['at_iso', 'time_local'];
    if (showFund) header.push('fund');
    header.push('type', 'sym', 'dir', 'qty', 'filledQty', 'fillPct', 'status', 'note', 'idempotencyKey', 'positionId');
    var lines = [header.join(',')];
    rows.forEach(function(b){
      var at = b.at ? new Date(b.at) : null;
      var cols = [
        at ? at.toISOString() : '',
        at ? at.toLocaleString() : '',
      ];
      if (showFund) cols.push(bookCsvCell(b._fundId || bookFundId()));
      cols.push(
        bookCsvCell(b.type || ''),
        bookCsvCell(b.sym || ''),
        bookCsvCell(b.dir || ''),
        bookCsvCell(b.qty != null ? b.qty : ''),
        bookCsvCell(b.filledQty != null ? b.filledQty : ''),
        bookCsvCell(b.fillPct != null ? b.fillPct : ''),
        bookCsvCell(b.status != null ? b.status : ''),
        bookCsvCell(b.note || ''),
        bookCsvCell(b.idempotencyKey || ''),
        bookCsvCell(b.positionId || '')
      );
      lines.push(cols.join(','));
    });
    var suffix = multiFund ? '-all-funds' : ('-' + bookFundId());
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hardgate-blotter' + suffix + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){}
}

function bookBracketExportLabel(blotter, positionId){
  var st = bookExecStatus(blotter, positionId);
  if (st === 'ok') return 'BRACKET OK';
  if (st === 'fail') return 'BRACKET FAIL';
  return 'EXEC —';
}

function bookFillExportLabel(p, blotter){
  if (!p) return '';
  var pct = p.brokerFillPct;
  if (pct >= 0.999) return 'FILL OK';
  if (pct > 0) return 'FILL ' + Math.round(pct * 100) + '%';
  if (p.id && bookBracketEventOk(bookLatestExecForPosition(blotter, p.id))) return 'UNFILLED';
  return '';
}

function bookExportCSV(){
  try{
    var snap = __book.snap;
    if (!snap || !snap.book) return;
    var blotter = snap.book.blotter || [];
    var lines = ['type,sym,dir,strategy,bucket,tier,notional,entry,stop,t1,t2,mark,pnl,bracket,fill,openedAt,closedAt'];
    (snap.book.positions || []).forEach(function(p){
      lines.push(['open', bookCsvCell(p.sym), bookCsvCell(p.dir), bookCsvCell(p.strategy || ''),
        bookCsvCell(p.bucket || ''), bookCsvCell(p.tier || ''),
        p.notionalUsd, p.entry, p.stop, p.t1, p.t2, p.mark, p.unrealizedUsd || 0,
        bookCsvCell(bookBracketExportLabel(blotter, p.id)),
        bookCsvCell(bookFillExportLabel(p, blotter)),
        p.openedAt || '', ''].join(','));
    });
    (snap.book.closed || []).forEach(function(c){
      lines.push(['closed', bookCsvCell(c.sym), bookCsvCell(c.dir), bookCsvCell(c.strategy || ''),
        bookCsvCell(c.bucket || ''), bookCsvCell(c.tier || ''),
        c.notionalUsd, c.entry, c.stop, c.t1, c.t2, c.mark, c.realizedUsd || 0, '',
        bookCsvCell(bookFillExportLabel(c, blotter)),
        c.openedAt || '', c.closedAt || ''].join(','));
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hardgate-book-' + bookFundId() + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){}
}

async function bookExportConsolidatedCSV(){
  try{
    if (!bookApiOn()) return;
    var all = __book.consolidatedAll || await bookFetchAllPositions();
    var positions = all.positions || [];
    var blotter = all.blotter || [];
    var closed = all.closed || [];
    if (!positions.length && !closed.length){
      try{ alert('No positions or closed trades across funds to export.'); }catch(e){}
      return;
    }
    var lines = ['fund,type,sym,dir,strategy,bucket,tier,notional,entry,stop,t1,t2,mark,pnl,bracket,fill,openedAt,closedAt'];
    positions.forEach(function(p){
      lines.push([
        bookCsvCell(p._fundId || 'main'), 'open', bookCsvCell(p.sym), bookCsvCell(p.dir),
        bookCsvCell(p.strategy || ''), bookCsvCell(p.bucket || ''), bookCsvCell(p.tier || ''),
        p.notionalUsd, p.entry, p.stop, p.t1, p.t2, p.mark, p.unrealizedUsd || 0,
        bookCsvCell(bookBracketExportLabel(blotter, p.id)),
        bookCsvCell(bookFillExportLabel(p, blotter)),
        p.openedAt || '', '',
      ].join(','));
    });
    closed.forEach(function(c){
      lines.push([
        bookCsvCell(c._fundId || 'main'), 'closed', bookCsvCell(c.sym), bookCsvCell(c.dir),
        bookCsvCell(c.strategy || ''), bookCsvCell(c.bucket || ''), bookCsvCell(c.tier || ''),
        c.notionalUsd, c.entry, c.stop, c.t1, c.t2, c.mark, c.realizedUsd || 0, '',
        bookCsvCell(bookFillExportLabel(c, blotter)),
        c.openedAt || '', c.closedAt || '',
      ].join(','));
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hardgate-book-all-funds-' + new Date().toISOString().slice(0, 10) + '.csv';
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

function posSourceChip(p){
  var src = (p.layers && p.layers.length) ? p.layers[0] : '';
  if (!src) return '';
  return ' <span class="statuschip bookSrc" title="Scanner source">' + esc(src) + '</span>';
}

function bookLatestExecForPosition(blotter, positionId){
  if (!positionId || !Array.isArray(blotter)) return null;
  for (var i = 0; i < blotter.length; i++){
    var b = blotter[i];
    if (!b || b.positionId !== positionId) continue;
    if (b.type === 'execute_ok' || b.type === 'execute_fail' || b.type === 'live_send') return b;
  }
  return null;
}

function bookBracketEventOk(evt){
  if (!evt) return false;
  if (evt.type === 'execute_ok') return true;
  if (evt.type === 'live_send') return evt.ok !== false;
  return false;
}

function posFillChipHTML(p, blotter){
  blotter = blotter || [];
  if (!p) return '';
  var fundAttr = bookDataFund(p);
  var pct = p.brokerFillPct;
  if (pct > 0){
    var pctR = Math.round(pct * 100);
    var label = pctR >= 100 ? 'FILL OK' : ('FILL ' + pctR + '%');
    var partialPoll = pctR < 100 && bookExecuteReady() && bookApiOn();
    return ' <span class="statuschip ' + (pctR >= 100 ? 'ok' : 'warn') + '"'
      + (partialPoll ? (' data-poll-fill="' + esc(p.id) + '"' + fundAttr + ' style="cursor:pointer"') : '')
      + ' title="' + (partialPoll ? 'Click to poll for remaining fill · ' : '')
      + 'Broker filled ' + (isFinite(p.brokerFilledQty) ? p.brokerFilledQty.toFixed(4) : pctR + '%') + ' of order">'
      + label + '</span>';
  }
  if (bookPositionNeedsFillPoll(p, blotter)){
    var pollReady = bookExecuteReady() && bookApiOn();
    return ' <span class="statuschip warn"'
      + (pollReady ? (' data-poll-fill="' + esc(p.id) + '"' + fundAttr + ' style="cursor:pointer"') : '')
      + ' title="' + (pollReady ? 'Click to poll broker fill status' : 'Bracket sent — fill not confirmed') + '">UNFILLED</span>';
  }
  return '';
}

function posExecChipHTML(p, blotter){
  var evt = bookLatestExecForPosition(blotter, p && p.id);
  var execReady = bookExecuteReady();
  var fundAttr = bookDataFund(p);
  var click = execReady ? ' style="cursor:pointer"' : '';
  var dataExec = execReady ? (' data-exec="' + esc(p.id) + '"' + fundAttr) : '';
  if (!evt){
    return '<span class="statuschip warn"' + dataExec + click
      + ' title="' + (execReady ? 'Click to send EXEC bracket' : 'No bracket sent yet') + '">EXEC —</span>';
  }
  var ok = bookBracketEventOk(evt);
  var isLive = evt.type === 'live_send';
  var tip = evt.note || (ok ? (isLive ? 'Live webhook accepted' : 'Bracket accepted by proxy') : (isLive ? 'Live webhook rejected' : 'Bracket rejected or failed'));
  if (evt.status) tip += ' · HTTP ' + evt.status;
  if (!ok && execReady) tip = 'Click to retry · ' + tip;
  var label = ok ? (isLive ? 'LIVE OK' : 'BRACKET OK') : (isLive ? 'LIVE FAIL' : 'BRACKET FAIL');
  return '<span class="statuschip ' + (ok ? 'ok' : 'warn') + '"' + (ok ? '' : dataExec) + (ok ? '' : click)
    + ' title="' + esc(tip) + '">' + label + '</span>';
}

function bookDigestExecuteSummary(book, startMs){
  book = book || {};
  startMs = isFinite(startMs) ? +startMs : 0;
  var blotter = book.blotter || [];
  var ok = 0;
  var fail = 0;
  for (var i = 0; i < blotter.length; i++){
    var row = blotter[i];
    if (!row || (+row.at || 0) < startMs) continue;
    if (row.type === 'execute_ok') ok++;
    else if (row.type === 'execute_fail') fail++;
    else if (row.type === 'live_send'){
      if (row.ok !== false) ok++;
      else fail++;
    }
  }
  var pending = 0;
  var positions = book.positions || [];
  for (var p = 0; p < positions.length; p++){
    var pos = positions[p];
    if (pos && pos.id && !bookLatestExecForPosition(blotter, pos.id)) pending++;
  }
  return { ok: ok, fail: fail, pending: pending, total: ok + fail };
}

function bookLastExecuteEvent(blotter){
  blotter = blotter || [];
  for (var i = 0; i < blotter.length; i++){
    var b = blotter[i];
    if (b && (b.type === 'execute_ok' || b.type === 'execute_fail' || b.type === 'live_send')) return b;
  }
  return null;
}

function dailyLossBannerHTML(snap, desk){
  var halted = bookDailyLossHalted();
  if (!halted) return '';
  var dayPnl = (desk && isFinite(desk.dayPnlUsd)) ? desk.dayPnlUsd
    : ((snap && snap.summary && snap.summary.dayPnlUsd) || 0);
  var limit = (desk && desk.dailyLossLimitUsd) || (snap && snap.summary && snap.summary.dailyLossLimitUsd) || 0;
  var pct = (desk && desk.maxDailyLossPct) || (snap && snap.summary && snap.summary.maxDailyLossPct) || BOOK_MAX_DAILY_LOSS_PCT;
  return '<div class="note warn bookDayHalt" style="margin:6px 0 10px">⛔ Daily loss halt — new adds blocked until UTC day roll (existing positions may still be managed). '
    + 'Day P&amp;L ' + fmtUsd(dayPnl) + ' · limit -' + fmtUsd(limit)
    + ' (' + fmtF(pct * 100, 1) + '% of day start)</div>';
}

function deskExecStatusHTML(){
  var execOn = bookExecuteReady();
  var liveOn = __book.liveReady;
  var chips = [
    '<span class="statuschip' + (execOn ? ' ok' : ' warn') + '" title="/api/execute proxy">EXEC ' + (execOn ? 'ready' : 'off') + '</span>',
    '<span class="statuschip' + (liveOn ? ' ok' : ' warn') + '" title="EXECUTE_WEBHOOK_URL">LIVE ' + (liveOn ? 'ready' : 'off') + '</span>',
  ];
  if (bookAutoExecOn()) chips.push('<span class="statuschip ok" title="Bracket sent on each successful add">auto EXEC</span>');
  if (bookAutoExecPendingOn()) chips.push('<span class="statuschip ok" title="Silent EXEC PENDING batch on each mark refresh">auto EXEC pending</span>');
  if (bookAutoRetryFailedOn()) chips.push('<span class="statuschip ok" title="Silent RETRY FAILED batch on each mark refresh">auto retry fail</span>');
  if (bookAutoExecCrossFundOn()) chips.push('<span class="statuschip ok" title="Auto pending/retry scans every fund book">auto EXEC all funds</span>');
  if (bookAutoPollFillsOn()) chips.push('<span class="statuschip ok" title="Poll broker fill status on each mark refresh when backlog exists">auto poll fills</span>');
  if (bookDailyLossHalted()) chips.push('<span class="statuschip warn" title="New adds blocked until UTC day roll">DAY HALT</span>');
  if (typeof W.brainAutoBookOn === 'function' && W.brainAutoBookOn()){
    var abTitle = (typeof W.brainAutoBookPrimeOnlyOn === 'function' && W.brainAutoBookPrimeOnlyOn())
      ? 'BRAIN synthesis auto-adds PRIME plans only'
      : 'BRAIN synthesis auto-adds PRIME/HIGH plans to book';
    var abLabel = (typeof W.brainAutoBookPrimeOnlyOn === 'function' && W.brainAutoBookPrimeOnlyOn())
      ? 'BRAIN auto-book PRIME'
      : 'BRAIN auto-book';
    chips.push('<span class="statuschip ok" title="' + abTitle + '">' + abLabel + '</span>');
  }
  if (typeof W.brainAutoExecAfterBookOn === 'function' && W.brainAutoExecAfterBookOn()){
    chips.push('<span class="statuschip ok" title="BRAIN auto-add then EXEC brackets for new positions">BRAIN auto-exec</span>');
  }
  if (bookAutoOn()) chips.push('<span class="statuschip" title="T1 scale · BE · trail on mark refresh">auto desk</span>');
  var book = __book.snap && __book.snap.book;
  if (book){
    var exFund = bookDigestExecuteSummary(book, Date.now() - 7 * 86400000);
    if (exFund.ok || exFund.fail || exFund.pending){
      var bracketFilterOn = bookPositionsBracketPendingFilterOn();
      var chipCls = 'statuschip' + (bracketFilterOn ? ' ok' : '') + (exFund.pending > 0 && !bracketFilterOn ? ' warn' : '');
      var chipAttrs = exFund.pending > 0
        ? ' id="bookExecBarBracketFilter" class="' + chipCls + ' bookDeskAct" style="cursor:pointer"'
        : ' class="' + chipCls + '"';
      chips.push('<span' + chipAttrs
        + ' title="' + (exFund.pending
          ? 'Click to ' + (bracketFilterOn ? 'show all open positions' : 'filter to bracket pending only')
          : 'Rolling 7d execute blotter for active fund')
        + '">7d ' + exFund.ok + ' OK · ' + exFund.fail + ' fail · ' + exFund.pending + ' pending</span>');
    }
  }
  if (__book.desk && __book.desk.fill && (__book.desk.fill.unfilled || __book.desk.fill.partial)){
    var fillFilterOn = bookPositionsFillFilterOn();
    chips.push('<span class="statuschip ' + (fillFilterOn ? 'ok' : 'warn') + ' bookDeskAct" id="bookExecBarFillFilter" style="cursor:pointer"'
      + ' title="Click to ' + (fillFilterOn ? 'show all open positions' : 'filter to fill backlog only') + '">fills '
      + (__book.desk.fill.unfilled || 0) + ' open · ' + (__book.desk.fill.partial || 0) + ' partial</span>');
  }
  if (__book.desk && __book.desk.execute && (__book.desk.execute.ok || __book.desk.execute.fail || __book.desk.execute.pending)){
    var exDesk = __book.desk.execute;
    chips.push('<span class="statuschip" title="Cross-fund 7d bracket rollup from desk API">desk 7d '
      + (exDesk.ok || 0) + ' OK · ' + (exDesk.fail || 0) + ' fail · ' + (exDesk.pending || 0) + ' pending</span>');
  }
  var blotter = (book && book.blotter) || [];
  var last = bookLastExecuteEvent(blotter);
  if (last){
    var ok = bookBracketEventOk(last);
    var isLive = last.type === 'live_send';
    chips.push('<span class="statuschip ' + (ok ? 'ok' : 'warn') + '">last bracket ' + (ok ? 'OK' : 'FAIL')
      + (isLive ? ' LIVE' : '') + (last.sym ? ' · ' + esc(last.sym) : '') + '</span>');
  }
  return '<div class="row bookExecBar" style="margin:6px 0 10px;flex-wrap:wrap;gap:6px">' + chips.join('') + '</div>';
}

function closedRowHTML(c, opts){
  opts = opts || {};
  var cls = (c.realizedUsd || 0) >= 0 ? 'ok' : 'warn';
  return '<tr>'
    + (opts.showFund ? '<td><span class="statuschip bookSrc" title="Paper fund">' + esc(c._fundId || 'main') + '</span></td>' : '')
    + '<td>' + esc(c.sym) + '</td><td>' + esc(c.dir) + '</td>'
    + '<td>' + esc(c.strategy || '—') + posSourceChip(c) + '</td>'
    + '<td class="' + cls + '">' + fmtUsd(c.realizedUsd) + '</td><td>'
    + new Date(c.closedAt).toLocaleString() + '</td></tr>';
}

function posRowHTML(p, blotter, opts){
  blotter = blotter || [];
  opts = opts || {};
  var fundAttr = bookDataFund(p);
  var upl = p.unrealizedUsd || 0;
  var uplCls = upl >= 0 ? 'ok' : 'warn';
  var rVal = posR(p);
  var rCls = (rVal != null && rVal >= 0) ? 'ok' : 'warn';
  var liveBtn = __book.liveReady
    ? '<button class="btn" data-live="' + esc(p.id) + '"' + fundAttr + ' title="Send bracket to EXECUTE_WEBHOOK_URL">LIVE</button>' : '';
  var execBtn = bookExecuteReady()
    ? '<button class="btn ghost" data-exec="' + esc(p.id) + '"' + fundAttr + ' title="EXECUTE BRACKET via /api/execute proxy">EXEC</button>' : '';
  return '<tr>'
    + (opts.showFund ? '<td><span class="statuschip bookSrc" title="Paper fund">' + esc(p._fundId || 'main') + '</span></td>' : '')
    + '<td>' + esc(p.sym) + '</td>'
    + '<td>' + esc((p.dir || '').toUpperCase()) + '</td>'
    + '<td>' + esc(p.strategy || '—') + posSourceChip(p) + '</td>'
    + '<td>' + fmtUsd(p.notionalUsd) + '</td>'
    + '<td>' + pxF(p.entry) + '</td>'
    + '<td>' + pxF(p.mark) + '</td>'
    + '<td class="' + rCls + '">' + (rVal != null ? fmtF(rVal, 2) + 'R' : '—') + '</td>'
    + '<td class="' + uplCls + '">' + fmtUsd(upl) + '</td>'
    + '<td>' + fmtUsd(p.riskUsd) + '</td>'
    + '<td>' + posExecChipHTML(p, blotter) + posFillChipHTML(p, blotter) + '</td>'
    + '<td class="bookActs">'
    + '<button class="btn ghost" data-manage="' + esc(p.id) + '" title="Open in TRADE PLAN with fund equity">MANAGE</button>'
    + execBtn
    + liveBtn
    + '<button class="btn ghost" data-scale="0.5" data-id="' + esc(p.id) + '"' + fundAttr + ' title="Scale out 50% at mark">50%</button>'
    + '<button class="btn ghost" data-be="' + esc(p.id) + '"' + fundAttr + ' title="Move stop to breakeven">BE</button>'
    + '<button class="btn ghost" data-close="' + esc(p.id) + '"' + fundAttr + '>CLOSE</button>'
    + '</td>'
    + '</tr>';
}

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>PAPER FUND BOOK <span>multi-fund · risk limits · paper fills at plan entry</span></h2>'
    + '<div class="row" style="align-items:center;gap:8px;margin-bottom:8px">'
    + '<label class="note">Fund <select id="bookFundSel" class="bookFundSel"></select></label>'
    + '<button class="btn ghost" id="bookNewFund" title="Create a new paper fund book">+ FUND</button>'
    + '</div>'
    + '<p class="note">Desk OMS: <b>MANAGE</b> → TRADE PLAN · <b>50%</b> scale · <b>BE</b> stop · auto rules on mark refresh. Weekly consolidated LP digest auto-sends Sun ~21:07 IST (webhook / Telegram / email) unless <code>LP_DIGEST_FUND</code> pins a single fund.</p>'
    + '<div class="row" style="align-items:center;gap:12px;flex-wrap:wrap">'
    + '<label class="note"><input type="checkbox" id="bookAutoRules" ' + (bookAutoOn() ? 'checked' : '') + '> Auto desk (T1 50% · ATR trail · BE @1R · stop-out)</label>'
    + '<label class="note"' + (bookExecuteReady() ? '' : ' title="Set EXECUTE_BACKEND_URL on Render to enable"') + '><input type="checkbox" id="bookAutoExec" '
    + (bookAutoExecOn() ? 'checked' : '') + (bookExecuteReady() ? '' : ' disabled') + '> Auto EXEC bracket on add (no second confirm)</label>'
    + '<label class="note"' + (bookExecuteReady() ? '' : ' title="Set EXECUTE_BACKEND_URL on Render to enable"') + '><input type="checkbox" id="bookAutoExecPending" '
    + (bookAutoExecPendingOn() ? 'checked' : '') + (bookExecuteReady() ? '' : ' disabled') + '> Auto EXEC pending on refresh</label>'
    + '<label class="note"' + (bookExecuteReady() ? '' : ' title="Set EXECUTE_BACKEND_URL on Render to enable"') + '><input type="checkbox" id="bookAutoRetryFailed" '
    + (bookAutoRetryFailedOn() ? 'checked' : '') + (bookExecuteReady() ? '' : ' disabled') + '> Auto retry failed on refresh</label>'
    + '<label class="note" id="bookAutoCrossFundWrap" style="display:none"' + (bookExecuteReady() ? '' : ' title="Set EXECUTE_BACKEND_URL on Render to enable"') + '><input type="checkbox" id="bookAutoExecCrossFund" '
    + (bookAutoExecCrossFundOn() ? 'checked' : '') + (bookExecuteReady() ? '' : ' disabled') + '> Auto pending/retry all funds</label>'
    + '<label class="note"' + (bookExecuteReady() ? '' : ' title="Set EXECUTE_BACKEND_URL on Render to enable"') + '><input type="checkbox" id="bookAutoPollFills" '
    + (bookAutoPollFillsOn() ? 'checked' : '') + (bookExecuteReady() ? '' : ' disabled') + '> Auto poll broker fills on refresh</label>'
    + '</div>'
    + '<div class="row">'
    + '<button class="btn" id="bookRefresh">REFRESH MARKS</button>'
    + '<button class="btn ghost" id="bookExecPending" title="EXEC bracket for every open row showing EXEC —"'
    + (bookExecuteReady() ? '' : ' disabled') + '>EXEC PENDING</button>'
    + '<button class="btn ghost" id="bookRetryFailed" title="Retry EXEC for rows showing BRACKET FAIL"'
    + (bookExecuteReady() ? '' : ' disabled') + '>RETRY FAILED</button>'
    + '<button class="btn ghost" id="bookPollFills" title="Poll EXECUTE backend for broker fill status"'
    + (bookExecuteReady() ? '' : ' disabled') + '>POLL FILLS</button>'
    + '<button class="btn ghost" id="bookExecAllPending" style="display:none" title="EXEC pending brackets across every fund">ALL FUNDS PENDING</button>'
    + '<button class="btn ghost" id="bookRetryAllFailed" style="display:none" title="Retry failed brackets across every fund">ALL FUNDS RETRY</button>'
    + '<button class="btn ghost" id="bookCloseAll">CLOSE ALL</button>'
    + '<button class="btn ghost" id="bookExportJson">EXPORT JSON</button>'
    + '<button class="btn ghost" id="bookExportCsv">EXPORT CSV</button>'
    + '<button class="btn ghost" id="bookExportConsolidatedCsv" style="display:none" title="Open + recently closed positions across all funds with bracket + fill columns">EXPORT ALL CSV</button>'
    + '<button class="btn ghost" id="bookExportBlotter" title="Execution blotter CSV (all funds when multi-fund)">EXPORT BLOTTER</button>'
    + '<button class="btn ghost" id="bookExportLp">LP REPORT</button>'
    + '<button class="btn ghost" id="bookExportConsolidated" title="All funds — month MTD">CONSOLIDATED LP</button>'
    + '<button class="btn ghost" id="bookExportDigest">WEEKLY DIGEST</button>'
    + '<button class="btn ghost" id="bookSendDigest" title="Weekly digest for active fund">SEND FUND DIGEST</button>'
    + '<button class="btn ghost" id="bookSendConsolidated" title="Weekly digest — all funds rollup">SEND CONSOLIDATED</button>'
    + '<button class="btn ghost" id="bookReset">RESET BOOK</button>'
    + '<span class="note" id="bookStat">idle</span>'
    + '</div>'
    + '<div class="kv" id="bookSummary"></div>'
    + '<div id="bookExecBar"></div>'
    + '<div id="bookDayHalt"></div>'
    + '<div id="bookDesk"></div>'
    + '<div id="bookHeat"></div>'
    + '<div class="panel" style="margin-top:8px"><h3>Auto desk log</h3><div id="bookAutoLog"></div></div>'
    + '<div class="panel" style="margin-top:8px"><div class="row" style="align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">'
    + '<h3 style="margin:0">Execution blotter</h3>'
    + '<label class="note" title="Show execute_ok / execute_fail / execute_fill / live_send rows"><input type="checkbox" id="bookBlotterExecOnly"> EXEC only</label>'
    + '</div><div id="bookBlotter"></div>'
    + '<div id="bookBlotterAll" style="display:none;margin-top:8px"><h4 style="font-size:12px;margin:0 0 6px">Cross-fund execute events</h4><div id="bookBlotterAllBody"></div></div>'
    + '</div>'
    + '<div class="panel"><h3>Open positions</h3>'
    + '<div style="overflow-x:auto"><table class="booktbl" id="bookTable">'
    + '<thead><tr><th>Symbol</th><th>Side</th><th>Strategy</th><th>Notional</th><th>Entry</th><th>Mark</th><th>R</th><th>UPL</th><th>Risk</th><th>Bracket</th><th>OMS</th></tr></thead>'
    + '<tbody id="bookBody"></tbody></table></div>'
    + '<div class="empty" id="bookEmpty" style="display:none">No open paper positions — add from a scanner card.</div>'
    + '</div>'
    + '<div class="panel"><h3 id="bookClosedTitle">Recently closed</h3><div id="bookClosed"></div></div>'
    + '<div id="bookCrossAttr"></div>'
    + '<div id="bookAttr"></div>'
    + '<div id="bookNavHist"></div>';

  var stat = el.querySelector('#bookStat');
  var summary = el.querySelector('#bookSummary');
  var execBarEl = el.querySelector('#bookExecBar');
  var deskEl = el.querySelector('#bookDesk');
  var heatEl = el.querySelector('#bookHeat');
  var autoLogEl = el.querySelector('#bookAutoLog');
  var blotterEl = el.querySelector('#bookBlotter');
  var blotterAllEl = el.querySelector('#bookBlotterAll');
  var blotterAllBody = el.querySelector('#bookBlotterAllBody');
  var body = el.querySelector('#bookBody');
  var empty = el.querySelector('#bookEmpty');
  var tableHead = el.querySelector('#bookTable thead tr');
  var closedEl = el.querySelector('#bookClosed');
  var crossAttrEl = el.querySelector('#bookCrossAttr');
  var attrEl = el.querySelector('#bookAttr');
  var navHistEl = el.querySelector('#bookNavHist');

  function setStat(t, warn){ if (stat){ stat.textContent = t || ''; stat.className = warn ? 'note warn' : 'note'; } }

  var fundSel = el.querySelector('#bookFundSel');

  function paintFundSelect(funds){
    funds = funds || __book.funds || [];
    if (!fundSel) return;
    var cur = bookFundId();
    fundSel.innerHTML = funds.map(function(f){
      return '<option value="' + esc(f.id) + '"' + (f.id === cur ? ' selected' : '') + '>'
        + esc(f.label || f.id) + ' · ' + fmtUsd(f.equityUsd) + ' · ' + f.openCount + ' open</option>';
    }).join('');
  }

  function paint(snap){
    snap = snap || __book.snap;
    paintFundSelect(snap && snap.funds);
    if (!snap || !snap.summary){
      setStat(bookApiOn() ? 'book empty — add from scanners' : 'backend required — deploy on Render for /api/book', !bookApiOn());
      if (summary) summary.innerHTML = '';
      if (execBarEl) execBarEl.innerHTML = '';
      if (deskEl) deskEl.innerHTML = '';
      var haltBannerEmpty = el.querySelector('#bookDayHalt');
      if (haltBannerEmpty) haltBannerEmpty.innerHTML = '';
      if (heatEl) heatEl.innerHTML = '';
      if (blotterEl) blotterEl.innerHTML = '';
      if (blotterAllEl) blotterAllEl.style.display = 'none';
      if (blotterAllBody) blotterAllBody.innerHTML = '';
      if (body) body.innerHTML = '';
      if (attrEl) attrEl.innerHTML = '';
      if (crossAttrEl) crossAttrEl.innerHTML = '';
      if (navHistEl) navHistEl.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    var s = snap.summary;
    if (summary){
      var fundLabel = bookFundId();
      var fundRow = (__book.funds || []).find(function(f){ return f.id === fundLabel; });
      if (fundRow && fundRow.label) fundLabel = fundRow.label + ' (' + fundRow.id + ')';
      summary.innerHTML =
        '<span class="k">Fund</span><span class="v">' + esc(fundLabel) + '</span>'
        '<span class="k">NAV</span><span class="v">' + fmtUsd(s.navUsd) + '</span>'
        + '<span class="k">Equity</span><span class="v">' + fmtUsd(s.equityUsd) + '</span>'
        + '<span class="k">Day P&amp;L</span><span class="v">' + fmtUsd(s.dayPnlUsd)
        + (s.dayKey ? ' <span class="note">(UTC ' + esc(s.dayKey) + ')</span>' : '') + '</span>'
        + '<span class="k">Unrealized</span><span class="v">' + fmtUsd(s.unrealizedUsd) + '</span>'
        + '<span class="k">Realized</span><span class="v">' + fmtUsd(s.realizedUsd) + '</span>'
        + '<span class="k">Open</span><span class="v">' + s.openCount + ' positions · gross ' + fmtUsd(s.grossUsd) + '</span>';
    }
    if (execBarEl) execBarEl.innerHTML = deskExecStatusHTML();
    if (deskEl) deskEl.innerHTML = deskHeaderHTML(__book.desk);
    var haltBanner = el.querySelector('#bookDayHalt');
    if (haltBanner) haltBanner.innerHTML = dailyLossBannerHTML(snap, __book.desk);
    if (heatEl) heatEl.innerHTML = heatBarHTML(s);
    if (autoLogEl) autoLogEl.innerHTML = autoLogHTML();
    var blotterEmpty = bookBlotterExecOnlyOn() ? 'No execute events in blotter.' : 'No blotter events yet.';
    if (blotterEl) blotterEl.innerHTML = blotterHTML(
      bookFilterBlotterRows((snap.book && snap.book.blotter) || snap.blotter),
      { empty: blotterEmpty }
    );
    var multiFund = (__book.funds || []).length > 1;
    var consolidated = __book.consolidatedAll;
    if (blotterAllEl && blotterAllBody){
      if (multiFund && consolidated && (consolidated.blotter || []).length){
        blotterAllEl.style.display = 'block';
        blotterAllBody.innerHTML = blotterHTML(
          bookFilterBlotterRows(consolidated.blotter),
          { empty: blotterEmpty }
        );
      } else {
        blotterAllEl.style.display = 'none';
        blotterAllBody.innerHTML = '';
      }
    }
    var allPositions = (snap.book && snap.book.positions) || [];
    var blotterRows = (snap.book && snap.book.blotter) || snap.blotter || [];
    if (multiFund && consolidated){
      allPositions = consolidated.positions || allPositions;
      blotterRows = consolidated.blotter || blotterRows;
    }
    var viewPositions = allPositions;
    if (bookPositionsFillFilterOn()){
      viewPositions = allPositions.filter(function(p){ return bookPositionFillBacklog(p, blotterRows); });
    } else if (bookPositionsBracketPendingFilterOn()){
      viewPositions = allPositions.filter(function(p){ return bookPositionBracketPending(p, blotterRows); });
    }
    if (tableHead){
      tableHead.innerHTML = (multiFund ? '<th>Fund</th>' : '')
        + '<th>Symbol</th><th>Side</th><th>Strategy</th><th>Notional</th><th>Entry</th><th>Mark</th>'
        + '<th>R</th><th>UPL</th><th>Risk</th><th>Bracket</th><th>OMS</th>';
    }
    if (body){
      body.innerHTML = viewPositions.map(function(p){ return posRowHTML(p, blotterRows, { showFund: multiFund }); }).join('');
      if (empty){
        empty.textContent = bookPositionsFillFilterOn()
          ? 'No open positions in fill backlog (bracket sent, fill missing or partial).'
          : (bookPositionsBracketPendingFilterOn()
            ? 'No open positions waiting for a bracket (EXEC —).'
            : 'No open paper positions — add from a scanner card.');
        empty.style.display = viewPositions.length ? 'none' : 'block';
      }
    }
    if (closedEl){
      var closedTitleEl = el.querySelector('#bookClosedTitle');
      var closedFundView = multiFund && consolidated;
      var closed = closedFundView
        ? (consolidated.closed || []).slice(0, 12)
        : ((snap.book && snap.book.closed) || []).slice(0, 8);
      if (closedTitleEl){
        closedTitleEl.textContent = closedFundView ? 'Recently closed (all funds)' : 'Recently closed';
      }
      var closedShowFund = !!closedFundView;
      closedEl.innerHTML = closed.length
        ? '<table class="booktbl"><thead><tr>'
          + (closedShowFund ? '<th>Fund</th>' : '')
          + '<th>Symbol</th><th>Side</th><th>Strategy</th><th>Realized</th><th>Closed</th></tr></thead><tbody>'
          + closed.map(function(c){ return closedRowHTML(c, { showFund: closedShowFund }); }).join('')
          + '</tbody></table>'
        : '<div class="note">' + (closedFundView ? 'No closed trades across funds yet.' : 'No closed trades yet.') + '</div>';
    }
    if (crossAttrEl && snap.crossAttribution){
      crossAttrEl.innerHTML = crossAttrHTML(snap.crossAttribution);
    } else if (crossAttrEl){
      crossAttrEl.innerHTML = '';
    }
    if (attrEl && snap.attribution){
      var activeLabel = bookFundId();
      var activeRow = (__book.funds || []).find(function(f){ return f.id === activeLabel; });
      if (activeRow && activeRow.label) activeLabel = activeRow.label + ' (' + activeRow.id + ')';
      attrEl.innerHTML = '<div class="panel"><h3>Active fund — ' + esc(activeLabel) + '</h3></div>'
        + attrTableHTML('P&amp;L by strategy', snap.attribution.byStrategy)
        + attrTableHTML('P&amp;L by asset bucket', snap.attribution.byBucket)
        + attrTableHTML('P&amp;L by tier', snap.attribution.byTier);
    } else if (attrEl){
      attrEl.innerHTML = '';
    }
    if (navHistEl) navHistEl.innerHTML = navHistoryHTML(snap.navHistory || (snap.book && snap.book.navHistory));
    var epBtn = el.querySelector('#bookExecPending');
    var rfBtn = el.querySelector('#bookRetryFailed');
    var epAllBtn = el.querySelector('#bookExecAllPending');
    var rfAllBtn = el.querySelector('#bookRetryAllFailed');
    var execReady = bookExecuteReady();
    if (epBtn){
      epBtn.disabled = !execReady;
      var pendingN = bookExecTargets(allPositions, blotterRows, { pending: true, failed: false }).length;
      epBtn.textContent = pendingN ? ('EXEC PENDING (' + pendingN + ')') : 'EXEC PENDING';
    }
    if (rfBtn){
      rfBtn.disabled = !execReady;
      var failN = bookExecTargets(allPositions, blotterRows, { pending: false, failed: true }).length;
      rfBtn.textContent = failN ? ('RETRY FAILED (' + failN + ')') : 'RETRY FAILED';
    }
    var pfBtn = el.querySelector('#bookPollFills');
    if (pfBtn){
      pfBtn.disabled = !execReady;
      var fillN = (__book.desk && __book.desk.fill && __book.desk.fill.total) || 0;
      pfBtn.textContent = fillN ? ('POLL FILLS (' + fillN + ')') : 'POLL FILLS';
    }
    var autoPollChk = el.querySelector('#bookAutoPollFills');
    if (autoPollChk) autoPollChk.disabled = !execReady;
    if (epAllBtn && rfAllBtn){
      if (multiFund && execReady){
        epAllBtn.style.display = '';
        rfAllBtn.style.display = '';
        epAllBtn.disabled = false;
        rfAllBtn.disabled = false;
        var allPos = (consolidated && consolidated.positions) || [];
        var allBlot = (consolidated && consolidated.blotter) || [];
        var allPendingN = bookExecTargets(allPos, allBlot, { pending: true, failed: false }).length;
        var allFailN = bookExecTargets(allPos, allBlot, { pending: false, failed: true }).length;
        epAllBtn.textContent = allPendingN ? ('ALL FUNDS PENDING (' + allPendingN + ')') : 'ALL FUNDS PENDING';
        rfAllBtn.textContent = allFailN ? ('ALL FUNDS RETRY (' + allFailN + ')') : 'ALL FUNDS RETRY';
      } else {
        epAllBtn.style.display = 'none';
        rfAllBtn.style.display = 'none';
      }
    }
    var exportAllCsvBtn = el.querySelector('#bookExportConsolidatedCsv');
    if (exportAllCsvBtn) exportAllCsvBtn.style.display = (multiFund && bookApiOn()) ? '' : 'none';
    var crossFundWrap = el.querySelector('#bookAutoCrossFundWrap');
    var crossFundChk = el.querySelector('#bookAutoExecCrossFund');
    if (crossFundWrap){
      crossFundWrap.style.display = (multiFund && execReady) ? '' : 'none';
      if (crossFundChk) crossFundChk.disabled = !execReady;
    }
    setStat('updated ' + new Date(snap.summary.at || Date.now()).toLocaleTimeString()
      + (bookTabVisible() ? ' · auto-refresh on' : ''));
  }

  async function refresh(){
    if (__book.busy) return 'busy';
    __book.busy = true;
    setStat('loading…');
    try{
      await bookPull();
      if (typeof W.hgRefreshExecuteCap === 'function') await W.hgRefreshExecuteCap();
      await bookRefreshMarks();
      try{ await bookRefreshOpenKeys(); }catch(eKeys){}
      try{
        var ax = await bookMaybeAutoExecPending(__book.snap);
        if (ax && (ax.ok || ax.fail)) await bookPullAfterAutoExec();
        var ar = await bookMaybeAutoRetryFailed(__book.snap);
        if (ar && (ar.ok || ar.fail)) await bookPullAfterAutoExec();
        var apf = await bookMaybeAutoPollFills();
        if (apf && apf.filled > 0) await bookPull();
      }catch(eAutoP){}
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
  var execPendingBtn = el.querySelector('#bookExecPending');
  if (execPendingBtn) execPendingBtn.addEventListener('click', async function(){
    await bookExecutePending();
    await refresh();
  });
  var retryFailedBtn = el.querySelector('#bookRetryFailed');
  if (retryFailedBtn) retryFailedBtn.addEventListener('click', async function(){
    await bookRetryFailed();
    await refresh();
  });
  var pollFillsBtn = el.querySelector('#bookPollFills');
  if (pollFillsBtn) pollFillsBtn.addEventListener('click', async function(){
    var multiFund = (__book.funds || []).length > 1;
    var r = await bookPollFills({ allFunds: multiFund });
    if (r && r.filled > 0){
      try{ alert('Recorded ' + r.filled + ' broker fill' + (r.filled === 1 ? '' : 's') + ' from poll.'); }catch(e){}
    } else if (r && r.polled > 0){
      try{ alert('Polled ' + r.polled + ' position' + (r.polled === 1 ? '' : 's') + ' — no new fills from backend.'); }catch(e2){}
    } else {
      try{ alert('No open positions need fill polling.'); }catch(e3){}
    }
    await refresh();
  });
  var execAllPendingBtn = el.querySelector('#bookExecAllPending');
  if (execAllPendingBtn) execAllPendingBtn.addEventListener('click', async function(){
    await bookExecuteAllFundsPending();
    await refresh();
  });
  var retryAllFailedBtn = el.querySelector('#bookRetryAllFailed');
  if (retryAllFailedBtn) retryAllFailedBtn.addEventListener('click', async function(){
    await bookRetryAllFundsFailed();
    await refresh();
  });
  el.querySelector('#bookExportJson').addEventListener('click', bookExportJSON);
  el.querySelector('#bookExportCsv').addEventListener('click', bookExportCSV);
  el.querySelector('#bookExportConsolidatedCsv').addEventListener('click', function(){ bookExportConsolidatedCSV(); });
  el.querySelector('#bookExportBlotter').addEventListener('click', function(){ bookExportBlotterCSV(); });
  el.querySelector('#bookExportLp').addEventListener('click', bookExportLp);
  el.querySelector('#bookExportConsolidated').addEventListener('click', function(){ bookExportConsolidated('month'); });
  el.querySelector('#bookExportDigest').addEventListener('click', function(){ bookExportDigest('week'); });
  el.querySelector('#bookSendDigest').addEventListener('click', bookSendDigest);
  el.querySelector('#bookSendConsolidated').addEventListener('click', bookSendConsolidatedDigest);
  var autoChk = el.querySelector('#bookAutoRules');
  if (autoChk){
    autoChk.addEventListener('change', function(){
      bookSetAuto(autoChk.checked);
      setStat(autoChk.checked ? 'auto desk ON' : 'auto desk OFF');
    });
  }
  var autoExecChk = el.querySelector('#bookAutoExec');
  if (autoExecChk){
    autoExecChk.addEventListener('change', function(){
      bookSetAutoExec(autoExecChk.checked);
      setStat(autoExecChk.checked ? 'auto EXEC on add ON' : 'auto EXEC on add OFF');
    });
  }
  var autoExecPendingChk = el.querySelector('#bookAutoExecPending');
  if (autoExecPendingChk){
    autoExecPendingChk.addEventListener('change', function(){
      bookSetAutoExecPending(autoExecPendingChk.checked);
      setStat(autoExecPendingChk.checked ? 'auto EXEC pending ON' : 'auto EXEC pending OFF');
    });
  }
  var autoRetryFailedChk = el.querySelector('#bookAutoRetryFailed');
  if (autoRetryFailedChk){
    autoRetryFailedChk.addEventListener('change', function(){
      bookSetAutoRetryFailed(autoRetryFailedChk.checked);
      setStat(autoRetryFailedChk.checked ? 'auto retry failed ON' : 'auto retry failed OFF');
    });
  }
  var autoCrossFundChk = el.querySelector('#bookAutoExecCrossFund');
  if (autoCrossFundChk){
    autoCrossFundChk.addEventListener('change', function(){
      bookSetAutoExecCrossFund(autoCrossFundChk.checked);
      setStat(autoCrossFundChk.checked ? 'auto EXEC all funds ON' : 'auto EXEC all funds OFF');
    });
  }
  var autoPollFillsChk = el.querySelector('#bookAutoPollFills');
  if (autoPollFillsChk){
    autoPollFillsChk.addEventListener('change', function(){
      bookSetAutoPollFills(autoPollFillsChk.checked);
      setStat(autoPollFillsChk.checked ? 'auto poll fills ON' : 'auto poll fills OFF');
    });
  }
  var blotterExecOnlyChk = el.querySelector('#bookBlotterExecOnly');
  if (blotterExecOnlyChk){
    blotterExecOnlyChk.checked = bookBlotterExecOnlyOn();
    blotterExecOnlyChk.addEventListener('change', function(){
      bookSetBlotterExecOnly(blotterExecOnlyChk.checked);
      paint(__book.snap);
    });
  }
  if (fundSel){
    fundSel.addEventListener('change', function(){
      bookSetFund(fundSel.value);
      refresh();
    });
  }
  el.querySelector('#bookNewFund').addEventListener('click', async function(){
    if (!bookApiOn()) return;
    var id = prompt('New fund id (e.g. gold, swing, macro):', 'gold');
    if (!id) return;
    var label = prompt('Fund label (optional):', id);
    var navStr = prompt('Starting NAV USD (default 1000000):', '1000000');
    var navUsd = navStr ? +navStr : 1000000;
    var r = await bookFetch('/api/book/funds', {
      method: 'POST',
      body: JSON.stringify({ id: id, label: label || id, navUsd: navUsd, active: true }),
    });
    if (r.json && r.json.ok){
      bookSetFund(r.json.fundId || id);
      await refresh();
    } else {
      try{ alert('Create fund failed: ' + ((r.json && r.json.reason) || 'error')); }catch(e){}
    }
  });
  el.querySelector('#bookCloseAll').addEventListener('click', async function(){
    if (!bookApiOn()) return;
    var snap = __book.snap || await bookPull();
    var n = (snap && snap.book && snap.book.positions) ? snap.book.positions.length : 0;
    if (!n){ try{ alert('No open positions.'); }catch(e){} return; }
    if (!confirm('Close all ' + n + ' paper position' + (n === 1 ? '' : 's') + ' at current marks?')) return;
    var marks = await bookCollectMarks(snap);
    await bookFetch('/api/book/close-all', { method: 'POST', body: JSON.stringify(bookFundBody({ marks: marks })) });
    bookScoreSettle();
    await refresh();
  });
  el.querySelector('#bookReset').addEventListener('click', async function(){
    if (!confirm('Reset fund "' + bookFundId() + '" to its starting NAV and clear all positions?')) return;
    if (bookApiOn()){
      await bookFetch('/api/book/reset', { method: 'POST', body: JSON.stringify(bookFundBody({})) });
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
      bookLivePosition(liveBtn.getAttribute('data-live'), bookActionFund(liveBtn));
      return;
    }
    var execBtn = t.closest('[data-exec]');
    if (execBtn){
      await bookExecutePosition(execBtn.getAttribute('data-exec'), { fund: bookActionFund(execBtn) });
      await refresh();
      return;
    }
    var pollFillBtn = t.closest('[data-poll-fill]');
    if (pollFillBtn){
      var pollId = pollFillBtn.getAttribute('data-poll-fill');
      var pollR = await bookPollFillPosition(pollId);
      if (pollR && pollR.ok){
        try{ alert('Fill updated' + (isFinite(pollR.fillPct) ? ' (' + Math.round(pollR.fillPct * 100) + '%)' : '') + '.'); }catch(e){}
      } else if (pollR && pollR.reason !== 'no poll needed'){
        try{ alert('Fill poll: ' + pollR.reason); }catch(e2){}
      }
      await refresh();
      return;
    }
    var deskPending = t.closest('#bookDeskExecPending');
    if (deskPending){
      await bookExecuteAllFundsPending();
      await refresh();
      return;
    }
    var deskRetry = t.closest('#bookDeskExecRetry');
    if (deskRetry){
      await bookRetryAllFundsFailed();
      await refresh();
      return;
    }
    var deskPoll = t.closest('#bookDeskPollFills');
    if (deskPoll){
      await bookPollAllFundsFills();
      await refresh();
      return;
    }
    var fillFilterBtn = t.closest('#bookExecBarFillFilter');
    if (fillFilterBtn){
      bookSetPositionsFillFilter(!bookPositionsFillFilterOn());
      paint(__book.snap);
      setStat(bookPositionsFillFilterOn() ? 'fill backlog filter ON' : 'fill backlog filter OFF');
      return;
    }
    var bracketFilterBtn = t.closest('#bookExecBarBracketFilter');
    if (bracketFilterBtn){
      bookSetPositionsBracketPendingFilter(!bookPositionsBracketPendingFilterOn());
      paint(__book.snap);
      setStat(bookPositionsBracketPendingFilterOn() ? 'bracket pending filter ON' : 'bracket pending filter OFF');
      return;
    }
    var scaleBtn = t.closest('[data-scale]');
    if (scaleBtn){
      if (!bookApiOn()) return;
      var sid = scaleBtn.getAttribute('data-id');
      var pct = +scaleBtn.getAttribute('data-scale');
      if (!sid || !(pct > 0)) return;
      await bookFetch('/api/book/scale', { method: 'POST', body: JSON.stringify(bookFundBody({ id: sid, pct: pct, fund: bookActionFund(scaleBtn) })) });
      bookScoreSettle();
      await refresh();
      return;
    }
    var beBtn = t.closest('[data-be]');
    if (beBtn){
      if (!bookApiOn()) return;
      var bp = bookFindPosAny(beBtn.getAttribute('data-be'));
      if (!bp) return;
      await bookFetch('/api/book/stop', { method: 'POST', body: JSON.stringify(bookFundBody({ id: bp.id, stop: bp.entry, fund: bookActionFund(beBtn) })) });
      await refresh();
      return;
    }
    var btn = t.closest('[data-close]');
    if (!btn) return;
    var id = btn.getAttribute('data-close');
    if (!id || !bookApiOn()) return;
    await bookFetch('/api/book/close', { method: 'POST', body: JSON.stringify(bookFundBody({ id: id, fund: bookActionFund(btn) })) });
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
W.bookExecutePosition = bookExecutePosition;
W.bookFundBody = bookFundBody;
W.bookRefresh = bookRefresh;
W.bookAutoExecOn = bookAutoExecOn;
W.bookAutoExecPendingOn = bookAutoExecPendingOn;
W.bookAutoRetryFailedOn = bookAutoRetryFailedOn;
W.bookAutoExecCrossFundOn = bookAutoExecCrossFundOn;
W.bookAutoPollFillsOn = bookAutoPollFillsOn;
W.bookPollFills = bookPollFills;
W.bookPollFillPosition = bookPollFillPosition;
W.bookPositionNeedsFillPoll = bookPositionNeedsFillPoll;
W.bookDailyLossHalted = bookDailyLossHalted;
W.bookBlotterExecOnlyOn = bookBlotterExecOnlyOn;
W.bookFilterBlotterRows = bookFilterBlotterRows;
W.bookBracketExportLabel = bookBracketExportLabel;
W.bookExportConsolidatedCSV = bookExportConsolidatedCSV;
W.bookAutoExecScope = bookAutoExecScope;
W.bookResolveFund = bookResolveFund;
W.bookPositionKey = bookPositionKey;
W.bookFetchOpenKeys = bookFetchOpenKeys;
W.bookRefreshOpenKeys = bookRefreshOpenKeys;
W.hgBookStampHTML = hgBookStampHTML;
W.hgBookStampForMeta = hgBookStampForMeta;
W.hgBookStampSlot = hgBookStampSlot;
W.hgBookStampChip = hgBookStampChip;
W.hgBookStampRepaintDom = hgBookStampRepaintDom;
W.hgBookStampRefreshThrottled = hgBookStampRefreshThrottled;
W.bookExecTargets = bookExecTargets;
W.bookBuildExecutePlan = bookBuildExecutePlan;
W.bookExecuteBatchPositions = bookExecuteBatchPositions;
W.bookExecuteFromPosition = bookExecuteFromPosition;
W.bookFetchAllPositions = bookFetchAllPositions;
W.bookFindPosAny = bookFindPosAny;
W.bookPositionsFillFilterOn = bookPositionsFillFilterOn;
W.bookPositionsBracketPendingFilterOn = bookPositionsBracketPendingFilterOn;
W.bookExecuteAllFundsPending = bookExecuteAllFundsPending;
W.bookExportBlotterCSV = bookExportBlotterCSV;
W.bookRetryAllFundsFailed = bookRetryAllFundsFailed;

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'book', label: 'BOOK', mount: mount, refresh: bookRefresh });

})();
