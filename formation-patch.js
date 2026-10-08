/**
 * HARDGATE Setup Formation Integration Bridge
 * Connects FormationEngine to window.HG_tabs and the Binance kline feed.
 * Cards: ARMED, PRIMED, STALKING. A zone is the latest displacement inside
 * the shelf-life, not only the last three bars.
 */
(function () {
  'use strict';
  var W = (typeof window !== 'undefined') ? window : globalThis;
  if (!W.HG_FormationEngine) return;

  var engine = new W.HG_FormationEngine();
  var SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  var TFS = ['15m', '1h'];

  function esc(s){
    return String(s == null ? '' : s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
  }
  function fundingZ(rows){
    if (!rows || rows.length < 12) return 0;
    var xs = rows.map(function(r){ return +r.rate; }).filter(function(v){ return isFinite(v); });
    if (xs.length < 12) return 0;
    var last = xs[xs.length - 1];
    var mean = 0, i;
    for (i = 0; i < xs.length; i++) mean += xs[i];
    mean /= xs.length;
    var v = 0;
    for (i = 0; i < xs.length; i++) v += (xs[i] - mean) * (xs[i] - mean);
    var sd = Math.sqrt(v / xs.length);
    if (!(sd > 0)) return 0;
    return (last - mean) / sd;
  }
  function nearFunding(fund){
    if (fund && isFinite(+fund.nextFundingTime)){
      var ms = +fund.nextFundingTime - Date.now();
      return ms > 0 && ms <= 10 * 60 * 1000;
    }
    var now = new Date();
    return (now.getUTCHours() % 8 === 7 && now.getUTCMinutes() >= 50);
  }

  var bridge = {
    engine: engine,

    scanCandles: function(symbol, timeframe, klines, orderFlow, bias){
      if (!klines || klines.length < 25) return null;
      var closed = klines.slice(0, -1);
      if (closed.length < 25) closed = klines.slice();
      var atr = engine.calculateATR(closed.map(function(k){
        return { high: k.high != null ? k.high : k.h, low: k.low != null ? k.low : k.l, close: k.close != null ? k.close : k.c };
      }), 14);
      var volSma = engine.calculateVolumeSMA(closed.map(function(k){
        return { volume: k.volume != null ? k.volume : k.v };
      }), 20);
      var from = Math.max(2, closed.length - engine.config.maxBarsValid);
      var found = null, idx;
      for (idx = closed.length - 1; idx >= from; idx--){
        var zone = engine.qualifyDisplacement(closed[idx - 2], closed[idx - 1], closed[idx], atr, volSma);
        if (zone){ found = zone; found.createdBarIndex = idx; break; }
      }
      if (!found) return null;
      return engine.evaluateSetupCandidate({
        symbol: symbol,
        timeframe: timeframe,
        klines: closed,
        zone: found,
        orderFlowData: orderFlow || {},
        macroContext: {
          biasVerdict: (bias && bias.verdict) || 'NEUTRAL',
          nearSettlement: !!(bias && bias.nearSettlement)
        }
      });
    },

    renderSetupBadge: function(status){
      switch (status) {
        case 'ARMED':
          return '<span style="background:#059669;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px;">ARMED (ENTER)</span>';
        case 'PRIMED':
          return '<span style="background:#d97706;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px;">PRIMED (ZONE)</span>';
        case 'STALKING':
          return '<span style="background:#4b5563;color:#fff;padding:2px 8px;border-radius:4px;font-weight:600;font-size:11px;">STALKING</span>';
        default:
          return '<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:4px;font-weight:600;font-size:11px;">VETOED</span>';
      }
    }
  };

  function cardHtml(r){
    var gates = (r.ledger || []).map(function(g){
      return '<div style="font-size:12px;margin-top:2px"><b>' + (g.pass ? 'PASS' : 'FAIL') + '</b> ' + esc(g.name) + ' — ' + esc(g.evidence) + '</div>';
    }).join('');
    var levels = '';
    if (r.status === 'ARMED'){
      levels = '<div style="margin-top:6px">entry ' + esc(r.entryPrice) + ' · SL ' + esc(r.stopLoss) + ' · TP ' + esc(r.targetPrice) + ' · ' + esc(r.netRR) + 'R</div>';
    } else {
      levels = '<div style="margin-top:6px">zone ' + esc(r.gapBottom) + ' – ' + esc(r.gapTop) + ' · displacement ' + esc(r.displacementRatio) + ' ATR · ' + r.gatesPassed + '/' + r.totalGates + ' gates</div>';
    }
    return '<div class="panel" style="margin-top:10px" data-hg-formation="' + esc(r.status) + '">'
      + bridge.renderSetupBadge(r.status) + ' <b>' + esc(r.symbol) + '</b> ' + esc(r.timeframe) + ' ' + esc(r.direction)
      + levels + gates + '</div>';
  }

  var __busy = false;
  function mount(el){
    el.innerHTML = '<div class="panel"><h2>FORMATION <span>displacement · reclaim · 7 gates</span></h2>'
      + '<div class="note">STALKING is a live displacement zone. PRIMED is a tap without a reclaim close. ARMED is all 7 gates, net R at least 2.2 after fees. Last closed bar only.</div>'
      + '<div class="row" style="margin-top:10px"><button class="btn" id="hgFormRun">SCAN</button>'
      + '<span class="note" id="hgFormStat">scanning BTC, ETH, SOL</span></div>'
      + '<div id="hgFormOut" style="margin-top:8px"></div></div>';
    var btn = el.querySelector('#hgFormRun');
    var stat = el.querySelector('#hgFormStat');
    var out = el.querySelector('#hgFormOut');
    async function run(){
      if (__busy) return 'busy';
      __busy = true;
      if (stat) stat.textContent = 'scanning';
      try{
        if (typeof W.binanceKlines !== 'function'){
          if (out) out.innerHTML = '<div class="empty">binanceKlines is not loaded.</div>';
          return 'no-feed';
        }
        var cards = [], scanned = 0, s, tf;
        for (s = 0; s < SYMBOLS.length; s++){
          for (tf = 0; tf < TFS.length; tf++){
            var rows = await W.binanceKlines(SYMBOLS[s], TFS[tf], 120);
            scanned++;
            var z = 0, fund = null, hist = null;
            try{ if (typeof W.binanceFundingHist === 'function') hist = await W.binanceFundingHist(SYMBOLS[s], 30); }catch(e1){}
            try{ if (typeof W.binanceFunding === 'function') fund = await W.binanceFunding(SYMBOLS[s]); }catch(e2){}
            if (hist) z = fundingZ(hist);
            var hit = bridge.scanCandles(SYMBOLS[s], TFS[tf], rows || [], { fundingZScore: z }, { verdict: 'NEUTRAL', nearSettlement: nearFunding(fund) });
            if (hit && hit.status !== 'INVALIDATED') cards.push(hit);
          }
        }
        var order = { ARMED: 0, PRIMED: 1, STALKING: 2 };
        cards.sort(function(a, b){ return (order[a.status] - order[b.status]) || String(a.symbol).localeCompare(String(b.symbol)); });
        W.__hgFormationCards = cards;
        if (stat) stat.textContent = cards.length + ' live · ' + scanned + ' tapes';
        if (out){
          out.innerHTML = cards.length
            ? cards.map(cardHtml).join('')
            : '<div class="empty">No displacement zone inside 48 bars on BTC, ETH, SOL 15m and 1h. Nothing is forced.</div>';
        }
        return cards;
      }catch(e){
        if (out) out.innerHTML = '<div class="empty">Formation scan failed: ' + esc(e && e.message ? e.message : e) + '</div>';
        return 'error';
      }finally{
        __busy = false;
      }
    }
    if (btn) btn.addEventListener('click', function(){ run(); });
    run();
  }
  function refresh(){
    var el = document.getElementById('hgFormOut');
    if (!el) return 'skipped: not open';
    var btn = document.getElementById('hgFormRun');
    if (btn) btn.click();
    return 'ran';
  }

  W.HG_FormationBridge = bridge;
  W.HG_tabs = W.HG_tabs || [];
  if (!W.HG_tabs.some(function(t){ return t && t.id === 'formation'; })){
    W.HG_tabs.push({ id: 'formation', label: 'FORMATION', mount: mount, refresh: refresh });
  }
})();
