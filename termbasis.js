/* =========================================================================
HARDGATE — termbasis.js
Binance USD-M futures term-structure tab — PERPETUAL vs CURRENT_QUARTER vs
NEXT_QUARTER via binanceBasis() (/futures/data/basis).

Classic-script IIFE. Registers window.HG_tabs id 'termbasis'. Pure curve math
is exported as window.termBasisCurve for tests. Never throws at load time;
every fetch is delegated to binance.js (60s cache, 10s timeout). refresh()
follows the house contract: async, never throws, 'skipped: not run yet' until
the user runs a scan once.
========================================================================= */
'use strict';

(function(){

  var G = (typeof window !== 'undefined') ? window : globalThis;
  var TOP_N = 12;
  var MIN_TURNOVER = 20e6;
  var CHUNK = 3;
  var CHUNK_SLEEP_MS = 200;
  var SEED_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function esc(s){ return String(s || '').replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function fmtN(n, d){
    if (typeof fmt === 'function') return fmt(n, d);
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Number(n).toFixed(d === undefined ? 2 : d);
  }

  /* Pure: annualized basis % for perp / current quarter / next quarter.
     Returns { perp, cur, next, spreadCur, spreadNext, slope, regime, note }
     or null on any non-finite leg. spread* = perp − quarter (positive =>
     perp rich vs dated). slope = cur − next (positive => upward-sloping /
     contango in time). regime labels the dominant shape. */
  function termBasisCurve(perpAnn, curAnn, nextAnn){
    if (typeof perpAnn !== 'number' || typeof curAnn !== 'number' || typeof nextAnn !== 'number') return null;
    if (!isFinite(perpAnn) || !isFinite(curAnn) || !isFinite(nextAnn)) return null;
    var spreadCur = perpAnn - curAnn;
    var spreadNext = perpAnn - nextAnn;
    var slope = curAnn - nextAnn;
    var regime = 'flat';
    if (slope > 0.15 && spreadCur > 0) regime = 'contango';
    else if (slope < -0.15 && spreadCur < 0) regime = 'backwardation';
    else if (Math.abs(spreadCur) >= 0.25) regime = (spreadCur > 0) ? 'perp rich' : 'perp cheap';
    var note = 'perp ' + fmtN(perpAnn, 2) + '% · cur ' + fmtN(curAnn, 2) + '% · next ' + fmtN(nextAnn, 2) + '%';
    return {
      perp: perpAnn, cur: curAnn, next: nextAnn,
      spreadCur: spreadCur, spreadNext: spreadNext, slope: slope,
      regime: regime, note: note
    };
  }

  function termBasisScore(curve){
    if (!curve) return 0;
    return Math.abs(curve.spreadCur || 0) + Math.abs(curve.slope || 0) * 0.5;
  }

  /* Desk plan for paper book — perp leg of the curve trade (macro fund). */
  function termBasisPlan(row){
    try{
      if (!row || !row.curve || !isFinite(row.mark) || !(row.mark > 0)) return null;
      var c = row.curve;
      var dir = null;
      if (c.regime === 'contango' || c.regime === 'perp rich') dir = 'short';
      else if (c.regime === 'backwardation' || c.regime === 'perp cheap') dir = 'long';
      else if (Math.abs(c.spreadCur) >= 0.25) dir = c.spreadCur > 0 ? 'short' : 'long';
      if (!dir) return null;
      var entry = row.mark;
      var riskPct = Math.max(0.008, Math.min(0.04, Math.abs(c.spreadCur) / 100 * 0.5 + 0.01));
      var risk = entry * riskPct;
      var stop = dir === 'short' ? entry + risk : entry - risk;
      var t1 = dir === 'short' ? entry - risk : entry + risk;
      var t2 = dir === 'short' ? entry - 2 * risk : entry + 2 * risk;
      var sym = String(row.pair || '').replace(/USDT$/i, 'USD');
      if (!sym) return null;
      return { sym: sym, dir: dir, entry: entry, stop: stop, t1: t1, t2: t2, regime: c.regime };
    }catch(e){ return null; }
  }

  function termBasisCardStack(row){
    try{
      var plan = termBasisPlan(row);
      if (!plan || typeof hgSetupStackForInlineScan !== 'function') return null;
      return hgSetupStackForInlineScan({
        dir: plan.dir, sym: row.pair, style: 'termbasis', asset: 'crypto', clean: true,
        ticker: { turnoverUsd: row.turnoverUsd, exchange: 'binance' }
      });
    }catch(e){ return null; }
  }

  function termBasisBookBtn(row, stack){
    try{
      var plan = termBasisPlan(row);
      if (!plan || typeof bookBtnHTML !== 'function') return '';
      var st = stack || termBasisCardStack(row);
      return bookBtnHTML(plan.sym, plan.dir, plan.entry, plan.stop, plan.t1, {
        scanner: 'termbasis',
        fund: 'macro',
        strategy: 'termbasis',
        klass: 'macro',
        venue: 'binance',
        layers: ['termbasis', plan.regime || 'curve'],
        t2: plan.t2,
        stack: st
      });
    }catch(e){ return ''; }
  }

  function setProg(el, frac){
    try{
      var bar = el && el.querySelector ? el.querySelector('#tbProg i') : null;
      if (!bar) return;
      if (frac === null || frac === undefined){ bar.style.width = '0%'; return; }
      bar.style.width = Math.max(0, Math.min(100, frac * 100)).toFixed(1) + '%';
    }catch(e){}
  }

  function cardHTML(row){
    var c = row.curve;
    var tag = (c.regime || 'flat').toUpperCase();
    var tagCls = (c.regime === 'contango') ? 'long' : ((c.regime === 'backwardation') ? 'short' : '');
    var tbStack = termBasisCardStack(row);
    var stackHtml = (tbStack && typeof hgSetupStackMiniHtml === 'function') ? hgSetupStackMiniHtml(tbStack) : '';
    return '<div class="card">'
      + '<div class="card-h"><span class="sym">' + esc(row.pair) + '</span>'
      + '<span class="tag ' + tagCls + '">' + esc(tag) + '</span></div>'
      + '<div class="card-b">'
      + '<div class="kv"><span class="k">Perp ann.</span><span class="v">' + fmtN(c.perp, 2) + '%</span></div>'
      + '<div class="kv"><span class="k">Current Q</span><span class="v">' + fmtN(c.cur, 2) + '%</span></div>'
      + '<div class="kv"><span class="k">Next Q</span><span class="v">' + fmtN(c.next, 2) + '%</span></div>'
      + '<div class="kv"><span class="k">Perp − Cur</span><span class="v">' + fmtN(c.spreadCur, 2) + '%</span></div>'
      + '<div class="kv"><span class="k">Cur − Next</span><span class="v">' + fmtN(c.slope, 2) + '%</span></div>'
      + '<div class="kv"><span class="k">Mark</span><span class="v">' + fmtN(row.mark, 2) + '</span></div>'
      + '<div class="kv"><span class="k">24h turnover</span><span class="v">' + (row.turnoverUsd ? ('$' + fmtN(row.turnoverUsd, 0)) : '—') + '</span></div>'
      + '<div class="note" style="margin-top:8px">' + esc(c.note) + '</div>'
      + stackHtml
      + termBasisBookBtn(row, tbStack)
      + '</div></div>';
  }

  var __busy = false;
  var __ranOnce = false;
  var __uiEl = null;
  var __tbSnap = null;

  async function fetchBasisLeg(pair, contractType){
    try{
      if (typeof binanceBasis !== 'function') return null;
      var r = await binanceBasis(pair, contractType, '1h', 1);
      if (!r || !r.latest || !isFinite(r.latest.annualizedBasisPct)) return null;
      return r.latest;
    }catch(e){ return null; }
  }

  async function scanPair(pair, tick){
    var legs = await Promise.all([
      fetchBasisLeg(pair, 'PERPETUAL'),
      fetchBasisLeg(pair, 'CURRENT_QUARTER'),
      fetchBasisLeg(pair, 'NEXT_QUARTER')
    ]);
    if (!legs[0] || !legs[1] || !legs[2]) return null;
    var curve = termBasisCurve(legs[0].annualizedBasisPct, legs[1].annualizedBasisPct, legs[2].annualizedBasisPct);
    if (!curve) return null;
    return {
      pair: pair,
      curve: curve,
      mark: (tick && isFinite(tick.mark)) ? tick.mark : legs[0].futuresPrice,
      turnoverUsd: tick ? tick.turnoverUsd : null,
      score: termBasisScore(curve)
    };
  }

  async function universePairs(){
    var out = [];
    var seen = {};
    SEED_PAIRS.forEach(function(p){ if (!seen[p]){ seen[p] = true; out.push(p); } });
    try{
      if (typeof binanceTickers24h !== 'function') return out;
      var map = await binanceTickers24h();
      if (!map) return out;
      var rows = Object.keys(map).map(function(sym){ return map[sym]; })
        .filter(function(t){ return t && (t.turnoverUsd || 0) >= MIN_TURNOVER; })
        .sort(function(a, b){ return (b.turnoverUsd || 0) - (a.turnoverUsd || 0); });
      for (var i = 0; i < rows.length && out.length < TOP_N; i++){
        var sym = rows[i].symbol;
        if (!seen[sym]){ seen[sym] = true; out.push(sym); }
      }
    }catch(e){}
    return out.slice(0, TOP_N);
  }

  async function runTermBasisScan(el){
    var stat = el.querySelector('#tbStat');
    var cards = el.querySelector('#tbCards');
    var empty = el.querySelector('#tbEmpty');
    var btn = el.querySelector('#tbRun');
    if (!stat || !cards || !empty) return 'pane incomplete';
    if (__busy) return 'busy';
    __busy = true;
    if (btn) btn.disabled = true;
    cards.innerHTML = '';
    empty.style.display = 'none';
    var t0 = Date.now();
    var results = [];
    var failed = 0;
    try{
      if (typeof binanceBasis !== 'function'){
        stat.className = 'note warn';
        stat.textContent = 'binance.js not loaded — binanceBasis unavailable';
        return 'error: binanceBasis missing';
      }
      var tickMap = (typeof binanceTickers24h === 'function') ? await binanceTickers24h() : null;
      var pairs = await universePairs();
      stat.className = 'note';
      stat.textContent = 'loading term structure for ' + pairs.length + ' pairs…';
      for (var ci = 0; ci < pairs.length; ci += CHUNK){
        var chunk = pairs.slice(ci, ci + CHUNK);
        await Promise.all(chunk.map(async function(pair, idx){
          var i = ci + idx;
          setProg(el, (i + 1) / pairs.length);
          stat.textContent = 'scanning ' + (i + 1) + '/' + pairs.length + ' · ' + pair;
          try{
            var tick = tickMap ? tickMap[pair] : null;
            var row = await scanPair(pair, tick);
            if (row) results.push(row); else failed++;
          }catch(e){ failed++; }
        }));
        await sleep(CHUNK_SLEEP_MS);
      }
      results.sort(function(a, b){ return (b.score - a.score) || ((b.turnoverUsd || 0) - (a.turnoverUsd || 0)); });
      cards.innerHTML = results.map(cardHTML).join('');
      stat.textContent = 'done · ' + results.length + ' curves'
        + (failed ? ' · ' + failed + ' incomplete' : '')
        + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's';
      if (!results.length){
        var hostMsg = (typeof hgHostingMode === 'function' && hgHostingMode() === 'static')
          ? ' Static host — term basis needs Binance /api routes on Render.'
          : '';
        empty.textContent = 'No term-structure data returned — Binance basis endpoint may be geo-blocked or pairs lack dated futures.' + hostMsg;
        empty.style.display = 'block';
      }
      __tbSnap = {
        at: Date.now(),
        top: results.length ? {
          pair: results[0].pair,
          regime: results[0].curve.regime,
          spreadCur: results[0].curve.spreadCur,
          score: results[0].score
        } : null,
        count: results.length
      };
      __ranOnce = true;
      return 'refreshed';
    }catch(e){
      stat.className = 'note warn';
      stat.textContent = 'term basis scan failed: ' + (e && e.message ? e.message : e);
      return 'error: ' + (e && e.message ? e.message : String(e));
    }finally{
      __busy = false;
      setProg(el, null);
      if (btn) btn.disabled = false;
    }
  }

  async function termbasisRefresh(){
    try{
      if (__busy) return 'busy';
      if (!__ranOnce || !__uiEl) return 'skipped: not run yet';
      return await runTermBasisScan(__uiEl);
    }catch(e){ return 'error: ' + ((e && e.message) ? e.message : String(e)); }
  }

  function mount(el){
    if (!el) return;
    try{
      el.innerHTML =
        '<div class="panel">'
        + '<h2>Term Basis — Binance futures curve <span>PERP vs CURRENT_QUARTER vs NEXT_QUARTER · annualized basis from /futures/data/basis</span></h2>'
        + '<div class="note" style="margin-bottom:10px">Informational term-structure read, not a trade signal. '
        + 'Positive annualized basis usually means futures trade above spot (contango); negative means backwardation. '
        + 'Compare perp vs dated legs for roll/carry context — verify liquidity and contract specs before acting.</div>'
        + '<div class="row"><button class="btn" id="tbRun">RUN TERM SCAN</button>'
        + '<span class="note" id="tbStat"></span></div>'
        + '<div class="prog" id="tbProg"><i></i></div>'
        + '</div>'
        + '<div class="cards" id="tbCards"></div>'
        + '<div class="empty" id="tbEmpty" style="display:none"></div>';
      __uiEl = el;
      var btn = el.querySelector('#tbRun');
      if (btn) btn.addEventListener('click', function(){ runTermBasisScan(el); });
      var deps = el.querySelector('#tbStat');
      if (deps && typeof binanceBasis !== 'function'){
        deps.className = 'note warn';
        deps.textContent = 'missing binanceBasis — load binance.js first';
      }
    }catch(e){}
  }

  function __tbWarmEl(){
    var stub = { style: {}, textContent: '', className: '', innerHTML: '',
      disabled: false, addEventListener: function(){} };
    return { innerHTML: '', querySelector: function(){ return stub; } };
  }

  async function termbasisWarm(){
    try{
      if (G.termBasisState && G.termBasisState()) return 'fresh';
      if (__busy) return 'busy';
      var el = __uiEl || __tbWarmEl();
      var r = await runTermBasisScan(el);
      return (G.termBasisState && G.termBasisState()) ? 'warmed' : ('unavailable: ' + (r || 'no curve data'));
    }catch(e){ return 'error: ' + ((e && e.message) || e); }
  }

  G.termBasisCurve = termBasisCurve;
  G.termBasisScore = termBasisScore;
  G.termBasisPlan = termBasisPlan;
  G.termBasisBookBtn = termBasisBookBtn;
  G.termBasisState = function termBasisState(){
    try{ return __tbSnap ? JSON.parse(JSON.stringify(__tbSnap)) : null; }catch(e){ return null; }
  };
  G.HG_tabs = G.HG_tabs || [];
  G.HG_tabs.push({ id: 'termbasis', label: 'TERM BASIS', mount: mount, refresh: termbasisRefresh });
  G.HG_warmups = G.HG_warmups || [];
  G.HG_warmups.push({ id: 'termbasis', label: 'TERM BASIS', run: termbasisWarm });

})();
