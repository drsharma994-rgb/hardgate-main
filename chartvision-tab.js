/* =========================================================================
HARDGATE — chartvision-tab.js
CHART VISION tab — dedicated desk for gate-qualified setups (6/7 NEAR or
7/7 CLEAN) with independent chart reads (NEXT BAR + path/edge).

Scans the full desk universe (Delta + CoinDCX + Binance via xuniverse when
loaded), evaluates the shared 7-gate SWING matrix on 4H closed bars, keeps
symbols at 6/7+ with a tradable plan, renders mini charts, then POSTs OHLCV
to /api/chart-vision/analyze for each card.

Registers window.HG_tabs id 'chartvision' label 'CHART VISION'.
Never throws at load; every optional global is feature-checked.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

var CHUNK = 4;
var CHUNK_MS = 140;
var KL_4H = 280;
var KL_1H = 120;
var KL_15M = 160;
var MAX_SHOW = 36;

function esc(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fin(v){ return typeof v === 'number' && isFinite(v); }

function pxF(v){
  if (typeof W.px === 'function') return W.px(v);
  if (!fin(+v)) return '—';
  var n = +v;
  if (Math.abs(n) >= 1000) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

function cvTicker(item){
  item = item || {};
  return {
    symbol: item.sym || item.symbol,
    mark: fin(+item.mark) ? +item.mark : null,
    fundingPct: (item.fundingPct != null && isFinite(+item.fundingPct)) ? +item.fundingPct : null,
    turnoverUsd: fin(+item.turnoverUsd) ? +item.turnoverUsd : null
  };
}

function cvGateLabel(r){
  if (!r) return '';
  if (r.clean7) return '7/7 CLEAN';
  if (r.gatesPassed >= 7) return '7/7 · anchor miss';
  return (r.gatesPassed || 6) + '/7 NEAR';
}

function cvTierOf(r){
  return r && r.clean7 ? 'clean' : 'near';
}

function cvFallbackPlan(m, rows4h){
  if (!m || !m.dir || !rows4h || !rows4h.length) return null;
  var a4 = fin(+m.a4) ? +m.a4 : null;
  var p = fin(+m.p) ? +m.p : rows4h[rows4h.length - 1].c;
  var stop = fin(+m.stop) ? +m.stop : null;
  if (!fin(stop) && a4) stop = m.dir === 'long' ? p - 2 * a4 : p + 2 * a4;
  if (!fin(stop)) return null;
  var risk = Math.abs(p - stop);
  if (!(risk > 0)) return null;
  var exp = a4 ? a4 * 3.5 : risk * 2;
  var t1 = m.dir === 'long' ? p + exp : p - exp;
  return {
    dir: m.dir, entry: p, stop: stop, t1: t1, t2: null, rr: exp / risk,
    passed: m.passed, rows: rows4h, nearClean: !m.clean
  };
}

function cvEvalSwing(item, rows4h){
  if (typeof W.swingGateMatrix !== 'function' || !rows4h || rows4h.length < 210) return null;
  var ticker = cvTicker(item);
  var m = W.swingGateMatrix(rows4h, ticker);
  if (!m || !m.dir || m.passed < 6) return null;

  var hit = null;
  if (m.clean && typeof W.swingTryClean === 'function'){
    try{ hit = W.swingTryClean(rows4h, ticker); }catch(e){}
  }
  if (!hit && typeof W.swingTryNear === 'function'){
    try{ hit = W.swingTryNear(rows4h, ticker); }catch(e){}
  }
  if (!hit) hit = cvFallbackPlan(m, rows4h);
  if (!hit || !hit.dir) return null;

  return {
    sym: item.sym,
    exchange: item.exchange,
    alsoOn: item.alsoOn,
    dir: hit.dir,
    style: 'swing',
    timeframe: '4h',
    gatesPassed: m.passed,
    gatesTotal: m.gatesTotal || 7,
    clean7: m.clean === true,
    tier: m.clean ? 'clean' : 'near',
    gates: m.gates || [],
    margins: m.margins,
    clearance: (typeof W.cgClearanceLine === 'function') ? W.cgClearanceLine(m) : '',
    missing: hit.missing || [],
    entry: hit.entry,
    stop: hit.stop,
    t1: hit.t1,
    t2: hit.t2,
    rr: hit.rr || hit.dynamicRR,
    rows4h: rows4h,
    rows: rows4h,
    mark: fin(+ticker.mark) ? +ticker.mark : (rows4h.length ? rows4h[rows4h.length - 1].c : null),
    fundingPct: ticker.fundingPct,
    turnoverUsd: ticker.turnoverUsd
  };
}

function cvEvalScalp(item, h1, m15){
  if (typeof W.scalpGateMatrix !== 'function' || !h1 || !m15) return null;
  var ticker = cvTicker(item);
  var mins = (typeof W.tickClock === 'function') ? W.tickClock() : 240;
  var m = W.scalpGateMatrix(h1, m15, ticker, mins);
  if (!m || !m.dir || m.passed < 6) return null;

  var hit = null;
  if (m.clean && typeof W.scalpTryClean === 'function'){
    try{ hit = W.scalpTryClean(h1, m15, ticker, mins); }catch(e){}
  }
  if (!hit && typeof W.scalpTryNear === 'function'){
    try{ hit = W.scalpTryNear(h1, m15, ticker, mins); }catch(e){}
  }
  if (!hit && fin(+m.entry) && fin(+m.stop)){
    hit = {
      dir: m.dir, entry: m.entry, stop: m.stop, t1: m.t1, t2: m.t2,
      rr: m.dynamicRR, passed: m.passed, rows: m15
    };
  }
  if (!hit || !hit.dir) return null;

  return {
    sym: item.sym,
    exchange: item.exchange,
    alsoOn: item.alsoOn,
    dir: hit.dir,
    style: 'scalp',
    timeframe: '15m',
    gatesPassed: m.passed,
    gatesTotal: m.gatesTotal || 7,
    clean7: m.clean === true,
    tier: m.clean ? 'clean' : 'near',
    gates: m.gates || [],
    missing: hit.missing || [],
    entry: hit.entry,
    stop: hit.stop,
    t1: hit.t1,
    t2: hit.t2,
    rr: hit.rr || hit.dynamicRR || m.dynamicRR,
    rows4h: h1,
    rows: hit.rows || m15,
    mark: fin(+ticker.mark) ? +ticker.mark : null,
    fundingPct: ticker.fundingPct,
    turnoverUsd: ticker.turnoverUsd
  };
}

function cvSort(a, b){
  var ta = a.clean7 ? 0 : 1, tb = b.clean7 ? 0 : 1;
  if (ta !== tb) return ta - tb;
  if ((b.gatesPassed || 0) !== (a.gatesPassed || 0)) return (b.gatesPassed || 0) - (a.gatesPassed || 0);
  var va = fin(+a.turnoverUsd) ? +a.turnoverUsd : 0;
  var vb = fin(+b.turnoverUsd) ? +b.turnoverUsd : 0;
  return vb - va;
}

function cvVenueChip(item){
  if (typeof W.hgDeskVenueChipHTML === 'function') return W.hgDeskVenueChipHTML(item);
  return '';
}

function cvGateHtml(r){
  return (r.gates || []).map(function(g){
    return '<span class="gpip ' + (g[1] ? 'ok' : 'bad') + '">' + esc(g[0]) + '</span>';
  }).join('');
}

function cvPlanHtml(r){
  if (!fin(+r.entry) || !fin(+r.stop) || !fin(+r.t1)) return '<div class="plan">levels unavailable — gate pass without plan</div>';
  if (typeof W.planBlock === 'function'){
    return '<div class="plan">' + W.planBlock(r.dir, r.entry, r.stop, r.t1, r.t2, cvGateLabel(r) + ' · chart vision desk') + '</div>';
  }
  return '<div class="plan">ENTRY <b>' + pxF(r.entry) + '</b> · STOP <b>' + pxF(r.stop) + '</b> · T1 <b>' + pxF(r.t1) + '</b></div>';
}

function cvCardHTML(r){
  var tierCls = r.tier === 'near' ? ' tier-near' : '';
  var gateLbl = cvGateLabel(r);
  var visionChip = r.visionChip ? ' <span class="gpip ok">' + esc(r.visionChip) + '</span>' : '';
  var visionHtml = (typeof W.hgChartVisionCardBlock === 'function') ? W.hgChartVisionCardBlock(r) : '';
  var visionOnlySvg = (!visionHtml && r.visionSvg && typeof W.hgChartVisionSvgBlock === 'function')
    ? W.hgChartVisionSvgBlock(r) : '';
  var chartId = 'cv_' + String(r.sym).replace(/[^A-Za-z0-9]/g, '') + '_' + String(r.style || 'swing');
  var note = r.tier === 'near'
    ? '<div class="note warn" style="margin-top:6px"><b>6/7 NEAR</b> — watch-only until all seven gates pass. Chart read is independent of the gate tally.</div>'
    : '';
  var miss = (r.missing && r.missing.length)
    ? '<div class="note" style="margin-top:4px;font-size:11px">Missing: ' + esc(r.missing.join(', ')) + '</div>' : '';
  var clr = r.clearance ? '<div class="note" style="margin-top:4px;font-size:11px">' + esc(r.clearance) + '</div>' : '';
  var tradeOnclick = '';
  if (r.tier === 'clean' && fin(+r.entry) && fin(+r.stop) && fin(+r.t1)){
    if (typeof W.hgToTradePlanOnclickAttr === 'function'){
      tradeOnclick = W.hgToTradePlanOnclickAttr(r.sym, r.dir, r.entry, r.stop, r.t1, {
        t2: r.t2, scanner: 'chartvision', strategy: r.style || 'swing'
      });
    } else if (typeof W.toTrade === 'function'){
      tradeOnclick = 'toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(r.dir) + ',' + r.entry + ',' + r.stop + ',' + r.t1 + ')';
    }
    tradeOnclick = tradeOnclick.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  var tradeBtn = tradeOnclick ? '<button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (r.tier === 'clean' && typeof W.bookBtnHTML === 'function')
    ? W.bookBtnHTML(r.sym, r.dir, r.entry, r.stop, r.t1, { scanner: 'chartvision', strategy: r.style || 'swing', t2: r.t2 }) : '';

  return '<div class="card ' + esc(r.dir) + tierCls + '">'
    + '<div class="chead"><span class="sym">' + esc(r.sym) + cvVenueChip({ sym: r.sym, exchange: r.exchange, alsoOn: r.alsoOn }) + '</span>'
    + '<span class="dir">' + esc(String(r.dir).toUpperCase()) + ' · ' + esc(gateLbl) + ' · ' + esc(String(r.style || 'swing').toUpperCase())
    + visionChip + '</span>'
    + (typeof W.hgBookStampChip === 'function' ? W.hgBookStampChip(r.sym, r.dir, { scanner: 'chartvision', strategy: r.style || 'swing' }) : '')
    + '</div>'
    + '<div class="mini">'
    + '<span class="k">gates</span><span>' + esc(String(r.gatesPassed) + '/' + String(r.gatesTotal || 7)) + '</span>'
    + '<span class="k">tf</span><span>' + esc(r.timeframe || '4h') + '</span>'
    + '<span class="k">mark</span><span>' + pxF(r.mark) + '</span>'
    + '<span class="k">funding 8h</span><span>' + (r.fundingPct != null ? pxF(r.fundingPct) + '%' : 'n/a') + '</span>'
    + '<span class="k">turnover</span><span>' + (fin(+r.turnoverUsd) ? '$' + (r.turnoverUsd / 1e6).toFixed(1) + 'M' : '—') + '</span>'
    + (fin(+r.rr) ? ('<span class="k">R:R</span><span>' + pxF(r.rr) + '</span>') : '')
    + '</div>'
    + '<div class="gates">' + cvGateHtml(r) + '</div>'
    + cvPlanHtml(r) + clr + miss + note + visionHtml + visionOnlySvg
    + '<div class="hgchart" id="' + chartId + '"></div>'
    + tradeBtn + bookBtn
    + '</div>';
}

function cvPaintCharts(cardsEl, rows){
  if (!cardsEl || typeof W.hgMiniChart !== 'function') return;
  try{
    var nodes = cardsEl.querySelectorAll('.hgchart');
    for (var i = 0; i < nodes.length; i++){
      var node = nodes[i], id = node.id || '';
      var symGuess = id.replace(/^cv_/, '');
      var row = null;
      for (var j = 0; j < rows.length; j++){
        var key = String(rows[j].sym).replace(/[^A-Za-z0-9]/g, '') + '_' + String(rows[j].style || 'swing');
        if (symGuess === key){ row = rows[j]; break; }
      }
      if (!row || !row.rows) continue;
      W.hgMiniChart(node, row.rows, {
        dir: row.dir, entry: row.entry, stop: row.stop, t1: row.t1, t2: row.t2
      });
    }
  }catch(e){}
}

function cvFilterVenue(items, venue){
  venue = String(venue || 'ALL').toUpperCase();
  if (venue === 'ALL') return items;
  return (items || []).filter(function(it){
    var ex = String(it.exchange || '').toLowerCase();
    if (venue === 'DELTA') return ex === 'delta';
    if (venue === 'COINDCX' || venue === 'CDCX') return ex === 'coindcx' || ex === 'cdcx';
    if (venue === 'BINANCE') return ex === 'binance';
    return true;
  });
}

var __cv = { busy: false, ranOnce: false, run: null, results: [], style: 'swing', venue: 'ALL' };
var __cvSnap = null;

function cvPublishState(rows, meta){
  try{
    __cvSnap = { results: rows, meta: meta || {}, at: Date.now() };
    W.HG_chartVisionResults = {
      at: __cvSnap.at,
      results: rows.map(function(r){
        return {
          sym: r.sym, dir: r.dir, gatesPassed: r.gatesPassed, clean7: r.clean7,
          visionNextBar: r.visionNextBar, visionChip: r.visionChip, style: r.style
        };
      })
    };
  }catch(e){}
}

function cvFunnelHTML(meta){
  meta = meta || {};
  var rows = [
    { k: 'Universe screened', v: String(meta.uniLen || 0) },
    { k: '6/7+ gate hits', v: String(meta.hits || 0) },
    { k: '7/7 CLEAN', v: String(meta.clean7 || 0) },
    { k: '6/7 NEAR', v: String(meta.near || 0) },
    { k: 'Chart vision enriched', v: String(meta.vision || 0) + ' cards' }
  ];
  if (meta.note) rows.push({ k: 'Source', v: meta.note });
  if (typeof W.hgFunnelPanelHTML === 'function'){
    return W.hgFunnelPanelHTML('CHART VISION funnel', rows, 'cvFunnelPanel');
  }
  return '<div class="note">' + rows.map(function(r){ return esc(r.k) + ': ' + esc(r.v); }).join(' · ') + '</div>';
}

async function cvRunScan(opts){
  opts = opts || {};
  if (__cv.busy) return 'busy';
  __cv.busy = true;
  __cv.ranOnce = true;

  var ui = __cv.ui;
  if (!ui) return 'skipped: not mounted';
  var btn = ui.btn, stat = ui.stat, cards = ui.cards, empty = ui.empty, funnel = ui.funnel, prog = ui.prog;
  var style = (opts.style || __cv.style || 'swing').toLowerCase();
  var venue = opts.venue || __cv.venue || 'ALL';
  __cv.style = style;
  __cv.venue = venue;

  var t0 = Date.now();
  try{
    btn.disabled = true;
    cards.innerHTML = '';
    empty.style.display = 'none';
    if (funnel) funnel.innerHTML = '';
    stat.className = 'note';
    stat.textContent = 'loading universe…';

    if (typeof W.hgDeskLoadUniverse !== 'function'){
      stat.className = 'note warn';
      stat.textContent = 'desk-scan-universe.js not loaded';
      return 'failed';
    }
    if (style === 'swing' && typeof W.swingGateMatrix !== 'function'){
      stat.className = 'note warn';
      stat.textContent = 'cryptogates.js (swingGateMatrix) not loaded';
      return 'failed';
    }
    if (style === 'scalp' && typeof W.scalpGateMatrix !== 'function'){
      stat.className = 'note warn';
      stat.textContent = 'cryptogates.js (scalpGateMatrix) not loaded';
      return 'failed';
    }

    var uniPack = await W.hgDeskLoadUniverse({ force: !!opts.force });
    var items = cvFilterVenue(uniPack.items || [], venue);
    if (!items.length){
      stat.textContent = 'universe empty for venue filter';
      empty.style.display = 'block';
      return 'refreshed';
    }

    var results = [], failed = 0, histShort = 0;
    for (var ci = 0; ci < items.length; ci += CHUNK){
      var chunk = items.slice(ci, ci + CHUNK);
      await Promise.all(chunk.map(async function(item, idx){
        var i = ci + idx;
        try{
          if (prog && prog.firstElementChild) prog.firstElementChild.style.width = ((i + 1) / items.length * 100).toFixed(1) + '%';
          stat.textContent = 'scanning ' + (i + 1) + '/' + items.length + ' · ' + (item.sym || '?') + ' · '
            + Math.floor((Date.now() - t0) / 1000) + 's';

          if (style === 'scalp'){
            if (typeof W.hgDeskFetchKlines !== 'function'){ failed++; return; }
            var kl = await Promise.all([
              W.hgDeskFetchKlines(item, '1h', KL_1H),
              W.hgDeskFetchKlines(item, '15m', KL_15M)
            ]);
            var h1 = kl[0], m15 = kl[1];
            if (!h1 || h1.length < 60 || !m15 || m15.length < 40){ histShort++; return; }
            var sc = cvEvalScalp(item, h1, m15);
            if (sc) results.push(sc);
          } else {
            var rows4h = await W.hgDeskFetchKlines(item, '4h', KL_4H);
            if (!rows4h || rows4h.length < 210){ histShort++; return; }
            if (typeof W.hgRegimeAllowsSetup === 'function'){
              var rg = W.hgRegimeAllowsSetup(rows4h, 'swing');
              if (rg && !rg.allow) return;
            }
            var sw = cvEvalSwing(item, rows4h);
            if (sw) results.push(sw);
          }
        }catch(e){ failed++; }
      }));
      if (ci + CHUNK < items.length) await sleep(CHUNK_MS);
    }

    results.sort(cvSort);
    var shown = results.slice(0, MAX_SHOW);
    var clean7n = results.filter(function(r){ return r.clean7; }).length;
    var nearN = results.length - clean7n;

    __cv.results = results;
    if (!shown.length){
      empty.style.display = 'block';
      stat.textContent = 'done — 0 setups at 6/7+ / ' + items.length + ' screened · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's';
    } else {
      cards.innerHTML = shown.map(cvCardHTML).join('');
      try { if (typeof W.hgMpPin === 'function') W.hgMpPin('chartvision', shown, null, cards); } catch (eMp) {}
      cvPaintCharts(cards, shown);
      stat.textContent = 'done — ' + results.length + ' at 6/7+ (' + clean7n + ' CLEAN · ' + nearN + ' NEAR) · showing '
        + shown.length + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's';
    }

    if (funnel){
      funnel.innerHTML = cvFunnelHTML({
        uniLen: items.length, hits: results.length, clean7: clean7n, near: nearN,
        vision: shown.length, note: uniPack.note || uniPack.source
      });
    }

    cvPublishState(results, { style: style, venue: venue, uniLen: items.length });

    if (typeof W.hgChartVisionEnrichDeskRows === 'function' && shown.length){
      var wraps = shown.map(function(r){
        return {
          sym: r.sym, dir: r.dir, rows: r.rows, rows4h: r.rows4h,
          entry: r.entry, stop: r.stop, t1: r.t1,
          clean7: r.clean7, nearClean: !r.clean7 && r.gatesPassed >= 6,
          gatesPassed: r.gatesPassed, confirmed: r.gatesPassed >= 6,
          style: 'chartvision-' + (r.style || 'swing'), asset: 'crypto',
          timeframe: r.timeframe || '4h', __ref: r
        };
      });
      var visDone = 0;
      W.hgChartVisionEnrichDeskRows(wraps, function(w){ return w.rows; }, {
        limit: shown.length,
        confirmedOnly: false,
        sequential: true,
        onEach: function(){
          visDone++;
          if (stat) stat.textContent = 'chart vision ' + visDone + '/' + shown.length + ' · '
            + Math.floor((Date.now() - t0) / 1000) + 's';
        },
        repaint: function(){
          cards.innerHTML = shown.map(cvCardHTML).join('');
          try { if (typeof W.hgMpPin === 'function') W.hgMpPin('chartvision', shown, null, cards); } catch (eMp) {}
          cvPaintCharts(cards, shown);
          if (funnel){
            var visN = shown.filter(function(r){ return r.visionSvg || r.visionNextBar || r.visionChip; }).length;
            funnel.innerHTML = cvFunnelHTML({
              uniLen: items.length, hits: results.length, clean7: clean7n, near: nearN,
              vision: visN, note: uniPack.note || uniPack.source
            });
          }
        }
      });
    }

    return 'refreshed';
  }catch(e){
    stat.className = 'note warn';
    stat.textContent = 'scan failed: ' + ((e && e.message) || e);
    return 'failed';
  }finally{
    __cv.busy = false;
    btn.disabled = false;
    if (prog) prog.style.display = 'none';
  }
}

function mount(el){
  if (!el) return;
  el.innerHTML = '<div class="panel">'
    + '<h2>CHART VISION <span>6/7 NEAR + 7/7 CLEAN · independent next-bar reads on gate-qualified setups</span></h2>'
    + '<p class="note">Scans the full futures universe, keeps contracts that pass <b>6/7</b> or <b>7/7</b> of the shared hard gates, renders the chart, then runs chart vision on <b>every card shown</b> for an independent <b>NEXT BAR</b> opinion (hybrid TA skill — <code>qrak/LLM_trader</code> + <code>TauricResearch/TradingAgents</code>; optional Gemini multimodal PNG when <code>GEMINI_API_KEY</code> is set). NEAR cards are watch-only — not tickets until 7/7.</p>'
    + '<div class="row">'
    + '<button class="btn" id="cvRun">RUN SCAN</button>'
    + '<label class="note" style="margin-left:10px">Style '
    + '<select id="cvStyle"><option value="swing" selected>SWING 4H</option><option value="scalp">SCALP 15m</option></select></label>'
    + '<label class="note" style="margin-left:10px">Venue '
    + '<select id="cvVenue"><option value="ALL" selected>ALL</option><option value="DELTA">DELTA</option><option value="COINDCX">COINDCX</option><option value="BINANCE">BINANCE</option></select></label>'
    + '<span class="note" id="cvStat">idle</span></div>'
    + '<div class="prog" id="cvProg" style="display:none"><i style="width:0"></i></div>'
    + '<div id="cvFunnel"></div>'
    + '<div class="cards" id="cvCards"></div>'
    + '<div class="empty" id="cvEmpty" style="display:none">No 6/7+ gate setups right now — zero is a valid, honest result.</div>'
    + '</div>';

  __cv.ui = {
    btn: el.querySelector('#cvRun'),
    stat: el.querySelector('#cvStat'),
    cards: el.querySelector('#cvCards'),
    empty: el.querySelector('#cvEmpty'),
    funnel: el.querySelector('#cvFunnel'),
    prog: el.querySelector('#cvProg'),
    styleSel: el.querySelector('#cvStyle'),
    venueSel: el.querySelector('#cvVenue')
  };

  var ui = __cv.ui;
  if (!ui.btn) return;

  ui.btn.addEventListener('click', function(){
    cvRunScan({
      style: ui.styleSel ? ui.styleSel.value : 'swing',
      venue: ui.venueSel ? ui.venueSel.value : 'ALL'
    });
  });

  __cv.run = function(opts){
    return cvRunScan(opts || {
      style: ui.styleSel ? ui.styleSel.value : 'swing',
      venue: ui.venueSel ? ui.venueSel.value : 'ALL'
    });
  };
}

async function chartvisionRefresh(){
  try{
    if (__cv.busy) return 'busy';
    if (!__cv.ranOnce || typeof __cv.run !== 'function') return 'skipped: not run yet';
    return await __cv.run();
  }catch(e){ return 'error'; }
}

W.chartVisionState = function(){
  try{ return __cvSnap; }catch(e){ return null; }
};

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'chartvision', label: 'CHART VISION', mount: mount, refresh: chartvisionRefresh });

})();
