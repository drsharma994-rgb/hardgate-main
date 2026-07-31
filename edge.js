/* =========================================================================
HARDGATE — edge.js
EDGE tab: range-edge fade scanner on Binance USDT perps.

Fades the extremes of a defined range — enter LONG when price sweeps/touches
the range bottom and reclaims; enter SHORT at the range top when price tags
the ceiling and rejects. Every card is a complete setup: entry, stop, T1/T2,
max-safe leverage, and a conservative USE leverage (50% of max-safe).

4H bars, Binance universe (same discipline as MEAN REV / SQUEEZE).

Pure exports (never throw):
  edgeSignal(rows)     -> {dir, entry, stop, t1, t2, rr, edge, swept, regime} | null
  edgePlan(inp)        -> plan object | null
  edgeBacktest(rows)   -> {n, winPct, avgR, pf, expR}
  edgeMaxSafeLev(e,s)  -> integer
  edgeUseLev(e,s)      -> integer (conservative entry leverage)
========================================================================= */
(function(){
'use strict';

var MIN_TURNOVER  = 20e6;
var MAX_UNIVERSE  = 40;
var KL_LIMIT      = 300;
var DON_LEN       = 55;
var BB_LEN        = 20;
var BB_MULT       = 2;
var ATR_LEN       = 14;
var EXT_LEN       = 8;
var STOP_ATR      = 1.5;
var TOUCH_ATR     = 0.25;
var MIN_RR        = 1.5;
var MAX_HOLD      = 12;
var MIN_RECORD    = 3;
var CHUNK         = 5;
var CHUNK_SLEEP_MS = 120;
var USE_LEV_FRAC  = 0.5;

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function pxF(n){
  if (typeof px === 'function') return px(n);
  if (n === null || n === undefined || isNaN(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtF(n, d){
  if (typeof fmt === 'function') return fmt(n, d);
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}
function fmtSignedR(r){
  if (!isFinite(r)) return '—';
  return (r > 0 ? '+' : '') + r.toFixed(2) + 'R';
}
function fmtPF(pf){
  if (pf === Infinity) return '∞';
  if (!isFinite(pf)) return '—';
  return pf.toFixed(1);
}

function btZero(){ return { n: 0, winPct: 0, avgR: 0, pf: 0, expR: 0 }; }

function edgeMaxSafeLev(entry, stop){
  try{
    entry = +entry; stop = +stop;
    if (!(isFinite(entry) && isFinite(stop)) || entry <= 0 || entry === stop) return 1;
    var sd = Math.abs(entry - stop) / entry;
    return Math.max(1, Math.min(100, Math.floor(1 / (sd * 1.5 + 0.005))));
  }catch(e){ return 1; }
}

function edgeUseLev(entry, stop, frac){
  try{
    frac = (frac === undefined) ? USE_LEV_FRAC : +frac;
    if (!(frac > 0 && frac <= 1)) frac = USE_LEV_FRAC;
    var mx = edgeMaxSafeLev(entry, stop);
    return Math.max(1, Math.min(mx, Math.floor(mx * frac)));
  }catch(e){ return 1; }
}

function computeArrays(rows){
  if (typeof donchian !== 'function' || typeof atr !== 'function' ||
      typeof sma !== 'function' || typeof bollinger !== 'function' ||
      typeof bollingerPercentB !== 'function' || typeof lowest !== 'function' ||
      typeof highest !== 'function' || typeof rsi !== 'function') return null;
  var n = rows.length;
  var clean = new Array(n), closes = new Array(n), highs = new Array(n), lows = new Array(n);
  for (var i = 0; i < n; i++){
    var r = rows[i];
    clean[i] = r;
    closes[i] = (r && isFinite(r.c)) ? r.c : NaN;
    highs[i]  = (r && isFinite(r.h)) ? r.h : NaN;
    lows[i]   = (r && isFinite(r.l)) ? r.l : NaN;
  }
  var dc = donchian(clean, DON_LEN);
  var bb = bollinger(closes, BB_LEN, BB_MULT);
  var pb = bollingerPercentB(closes, BB_LEN, BB_MULT);
  var atrA = atr(clean, ATR_LEN);
  var sma20 = sma(closes, 20);
  var rsi14 = rsi(closes, 14);
  var loExt = lowest(lows, EXT_LEN);
  var hiExt = highest(highs, EXT_LEN);
  return { rows: clean, closes: closes, highs: highs, lows: lows,
           dc: dc, pb: pb, atr: atrA, sma20: sma20, rsi14: rsi14,
           loExt: loExt, hiExt: hiExt };
}

function regimeOk(reg){
  if (!reg) return true;
  return reg.regime === 'range' || reg.regime === 'compression' ||
         reg.regime === 'weak_trend' || reg.regime === 'unknown';
}

function setupAt(A, i){
  try{
    var row = A.rows[i];
    if (!row) return null;
    var c = A.closes[i], h = A.highs[i], l = A.lows[i], o = row.o;
    var dcLo = A.dc.lo[i], dcHi = A.dc.up[i], dcMid = A.dc.mid[i];
    var at = A.atr[i], pb = A.pb[i];
    if (!isFinite(c) || !isFinite(at) || !(at > 0) || !isFinite(dcLo) || !isFinite(dcHi)) return null;
    var tol = TOUCH_ATR * at;
    var range = (isFinite(h) && isFinite(l) && h > l) ? (h - l) : NaN;
    var closePos = (isFinite(range) && range > 0) ? (c - l) / range : NaN;

    var priorLo = Infinity, priorHi = -Infinity;
    for (var k = Math.max(0, i - DON_LEN); k < i; k++){
      if (isFinite(A.lows[k]) && A.lows[k] < priorLo) priorLo = A.lows[k];
      if (isFinite(A.highs[k]) && A.highs[k] > priorHi) priorHi = A.highs[k];
    }

    /* LONG — range bottom touch + rejection or liquidity sweep-reclaim */
    var touchBot = isFinite(l) && l <= dcLo + tol;
    var sweptLo = isFinite(l) && isFinite(priorLo) && priorLo < Infinity && l < priorLo && c > priorLo;
    var rejectLo = isFinite(closePos) && closePos >= 0.55 && isFinite(o) && c >= o;
    var pbLo = isFinite(pb) && pb <= 0.18;
    if (touchBot && pbLo && (rejectLo || sweptLo)){
      var extreme = isFinite(A.loExt[i]) ? A.loExt[i] : l;
      var stop = extreme - STOP_ATR * at;
      var risk = c - stop;
      if (!(risk > 0)) return null;
      var t1 = isFinite(dcMid) ? dcMid : (isFinite(A.sma20[i]) ? A.sma20[i] : NaN);
      var t2 = dcHi;
      var rew1 = t1 - c;
      if (!(rew1 > 0)) return null;
      var rr = rew1 / risk;
      if (rr < MIN_RR) return null;
      return { dir: 'long', entry: c, stop: stop, t1: t1, t2: t2, rr: rr,
               edge: 'RANGE BOTTOM', swept: !!sweptLo, extreme: extreme };
    }

    /* SHORT — range top touch + rejection or sweep-reclaim */
    var touchTop = isFinite(h) && h >= dcHi - tol;
    var sweptHi = isFinite(h) && isFinite(priorHi) && priorHi > -Infinity && h > priorHi && c < priorHi;
    var rejectHi = isFinite(closePos) && closePos <= 0.45 && isFinite(o) && c <= o;
    var pbHi = isFinite(pb) && pb >= 0.82;
    if (touchTop && pbHi && (rejectHi || sweptHi)){
      extreme = isFinite(A.hiExt[i]) ? A.hiExt[i] : h;
      stop = extreme + STOP_ATR * at;
      risk = stop - c;
      if (!(risk > 0)) return null;
      t1 = isFinite(dcMid) ? dcMid : (isFinite(A.sma20[i]) ? A.sma20[i] : NaN);
      t2 = dcLo;
      rew1 = c - t1;
      if (!(rew1 > 0)) return null;
      rr = rew1 / risk;
      if (rr < MIN_RR) return null;
      return { dir: 'short', entry: c, stop: stop, t1: t1, t2: t2, rr: rr,
               edge: 'RANGE TOP', swept: !!sweptHi, extreme: extreme };
    }
    return null;
  }catch(e){ return null; }
}

function edgeSignal(rows){
  try{
    if (!rows || rows.length < DON_LEN + 30) return null;
    var A = computeArrays(rows);
    if (!A) return null;
    var i = rows.length - 1;
    var s = setupAt(A, i);
    if (!s) return null;
    var reg = (typeof detectRegime === 'function') ? detectRegime(rows) : null;
    if (reg && (reg.regime === 'trend' || reg.regime === 'volatile')) return null;
    s.regime = reg ? reg.label : 'n/a';
    s.rsi14 = isFinite(A.rsi14[i]) ? A.rsi14[i] : null;
    s.pctB = isFinite(A.pb[i]) ? A.pb[i] : null;
    s.dcLo = A.dc.lo[i];
    s.dcHi = A.dc.up[i];
    return s;
  }catch(e){ return null; }
}

function edgePlan(inp){
  try{
    if (!inp || (inp.dir !== 'long' && inp.dir !== 'short')) return null;
    var entry = +inp.entry, stop = +inp.stop, t1 = +inp.t1, t2 = +inp.t2;
    if (!(isFinite(entry) && isFinite(stop) && isFinite(t1))) return null;
    var risk = (inp.dir === 'long') ? (entry - stop) : (stop - entry);
    if (!(risk > 0)) return null;
    var rew1 = (inp.dir === 'long') ? (t1 - entry) : (entry - t1);
    if (!(rew1 > 0)) return null;
    var rew2 = (isFinite(t2))
      ? ((inp.dir === 'long') ? (t2 - entry) : (entry - t2))
      : NaN;
    return {
      dir: inp.dir, entry: entry, stop: stop, t1: t1, t2: isFinite(t2) ? t2 : null,
      risk: risk, riskPct: risk / entry * 100,
      rr1: rew1 / risk, rr2: isFinite(rew2) && rew2 > 0 ? rew2 / risk : null,
      maxLev: edgeMaxSafeLev(entry, stop),
      useLev: edgeUseLev(entry, stop)
    };
  }catch(e){ return null; }
}

function edgeBacktest(rows){
  try{
    var A = computeArrays(rows);
    if (!A || A.rows.length < DON_LEN + 40) return btZero();
    var rs = [], i = DON_LEN + 5;
    while (i <= A.rows.length - 2){
      var s = setupAt(A, i);
      if (!s){ i++; continue; }
      var lastJ = Math.min(i + MAX_HOLD, A.rows.length - 1);
      var exitR = null, exitJ = lastJ;
      for (var j = i + 1; j <= lastJ; j++){
        var hj = A.highs[j], lj = A.lows[j], cj = A.closes[j];
        if (s.dir === 'long'){
          if (isFinite(lj) && lj <= s.stop){ exitR = -1; exitJ = j; break; }
          if (isFinite(hj) && hj >= s.t1){ exitR = (s.t1 - s.entry) / (s.entry - s.stop); exitJ = j; break; }
        } else {
          if (isFinite(hj) && hj >= s.stop){ exitR = -1; exitJ = j; break; }
          if (isFinite(lj) && lj <= s.t1){ exitR = (s.entry - s.t1) / (s.stop - s.entry); exitJ = j; break; }
        }
      }
      if (exitR === null && isFinite(A.closes[lastJ])){
        var c = A.closes[lastJ];
        exitR = (s.dir === 'long')
          ? (c - s.entry) / (s.entry - s.stop)
          : (s.entry - c) / (s.stop - s.entry);
      }
      if (isFinite(exitR)) rs.push(exitR);
      i = exitJ + 1;
    }
    if (!rs.length) return btZero();
    var wins = 0, grossWin = 0, grossLoss = 0, sum = 0;
    for (var k = 0; k < rs.length; k++){
      sum += rs[k];
      if (rs[k] > 0){ wins++; grossWin += rs[k]; }
      else if (rs[k] < 0){ grossLoss += -rs[k]; }
    }
    var avgR = sum / rs.length;
    var pf = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
    return { n: rs.length, winPct: wins / rs.length * 100, avgR: avgR, pf: pf, expR: avgR };
  }catch(e){ return btZero(); }
}

function edgePlanHtml(p){
  if (!p) return '';
  var levLine = ' · USE <b>' + p.useLev + 'x</b> (conservative · max safe ' + p.maxLev + 'x)';
  var t2 = (p.t2 !== null && isFinite(p.t2) && isFinite(p.rr2))
    ? ' · T2 ' + pxF(p.t2) + ' (' + fmtF(p.rr2, 1) + 'R)'
    : '';
  return 'ENTRY <b>' + pxF(p.entry) + '</b> · STOP <b>' + pxF(p.stop) + '</b>'
    + ' · T1 ' + pxF(p.t1) + ' (' + fmtF(p.rr1, 1) + 'R)' + t2
    + ' · risk ' + fmtF(p.riskPct, 2) + '%' + levLine
    + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(p.entry, p.stop) : '')
    + (typeof hgSessionChip === 'function' ? hgSessionChip() : '');
}

function cardHTML(r){
  var sig = r.sig, bt = r.bt, p = r.plan;
  var turnover = r.tick ? '$' + fmtF(r.tick.turnoverUsd / 1e6, 0) + 'M' : '—';
  var dirUp = sig.dir.toUpperCase();
  var edgeLbl = sig.edge + (sig.swept ? ' · SWEEP+RECLAIM' : ' · TOUCH+REJECT');
  var record = bt.n >= MIN_RECORD
    ? 'SETUP RECORD: ' + bt.n + ' trades · ' + Math.round(bt.winPct) + '% win · avg ' + fmtSignedR(bt.avgR) + ' · PF ' + fmtPF(bt.pf)
    : (bt.n > 0
      ? 'THIN RECORD (n&lt;3): ' + bt.n + ' · avg ' + fmtSignedR(bt.avgR)
      : 'THIN RECORD: no historical edge fades on these bars');
  var planBlock = p
    ? '<div class="plan">' + edgePlanHtml(p)
      + ' — fade the ' + DON_LEN + '-bar range ' + (sig.dir === 'long' ? 'bottom' : 'top')
      + ' · stop beyond the ' + EXT_LEN + '-bar extreme + ' + STOP_ATR + '×ATR' + ATR_LEN
      + ' · T1 = range mid · T2 = opposite range edge</div>'
    : '<div class="plan">levels unavailable</div>';
  var btn = (p && typeof toTrade === 'function')
    ? '<button class="toTrade" onclick="toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(p.dir)
      + ',' + p.entry + ',' + p.stop + ',' + p.t1 + ')">SEND TO TRADE PLAN</button>'
    : '';
  return '<div class="card ' + sig.dir + '">'
    + '<div class="chead"><span class="sym">' + esc(r.sym) + '</span>'
    + '<span class="dir"><span class="stamp pass">' + dirUp + '</span> EDGE · exp ' + fmtSignedR(bt.expR) + '</span></div>'
    + '<div class="mini">'
    + '<span class="k">edge</span><span>' + esc(edgeLbl) + '</span>'
    + '<span class="k">regime</span><span>' + esc(sig.regime || 'n/a') + '</span>'
    + '<span class="k">%B</span><span>' + fmtF(sig.pctB, 2) + '</span>'
    + '<span class="k">RSI14</span><span>' + fmtF(sig.rsi14, 1) + '</span>'
    + '<span class="k">range</span><span>' + pxF(sig.dcLo) + ' – ' + pxF(sig.dcHi) + '</span>'
    + '<span class="k">turnover</span><span>' + turnover + '</span>'
    + '</div>'
    + '<div class="gates">'
    + '<span class="gpip ok">' + (sig.dir === 'long' ? 'BOTTOM' : 'TOP') + ' TOUCH</span>'
    + '<span class="gpip ok">' + (sig.swept ? 'SWEEP+RECLAIM' : 'REJECTION CLOSE') + '</span>'
    + '<span class="gpip ok">R:R ' + fmtF(sig.rr, 2) + ' ≥ ' + MIN_RR + '</span>'
    + '<span class="gpip ok">USE ' + (p ? p.useLev : '—') + 'x LEV</span>'
    + '</div>'
    + planBlock
    + '<div class="plan">' + record + '</div>'
    + btn
    + '</div>';
}

var __edge = { busy: false, ranOnce: false, run: null };

function mount(el){
  if (!el) return;
  var missing = [];
  if (typeof binancePerpUniverse !== 'function') missing.push('binancePerpUniverse');
  if (typeof binanceTickers24h !== 'function') missing.push('binanceTickers24h');
  if (typeof binanceKlines !== 'function') missing.push('binanceKlines');
  if (typeof donchian !== 'function') missing.push('donchian');

  el.innerHTML = '<div class="panel">'
    + '<h2>EDGE Scanner <span>range-bottom LONG · range-top SHORT · 4H Donchian(' + DON_LEN + ')'
    + ' + sweep/reclaim or rejection · full plan + safe leverage</span></h2>'
    + '<p class="note">Fades the extremes: enter <b>long</b> when price tags the range bottom and reclaims;'
    + ' enter <b>short</b> at the range ceiling when price rejects. Stop sits beyond the local'
    + ' extreme (' + STOP_ATR + '×ATR). <b>USE Nx</b> is 50% of max-safe leverage so liquidation'
    + ' stays well clear of your stop — never trade above the green SAFE chip.</p>'
    + '<div class="row"><button class="btn" id="edgeRun">FIND EDGE SETUPS</button>'
    + '<span class="note" id="edgeStat">idle — Binance perps ≥ $' + fmtF(MIN_TURNOVER / 1e6, 0)
    + 'M · top ' + MAX_UNIVERSE + ' · R:R ≥ ' + MIN_RR + '</span></div>'
    + '<div class="prog" id="edgeProg"><i></i></div>'
    + '<div class="cards" id="edgeCards"></div>'
    + '<div class="empty" id="edgeEmpty" style="display:none">No range-edge setups right now — standing aside is a position.</div>'
    + '</div>';

  var btn = el.querySelector('#edgeRun'), statEl = el.querySelector('#edgeStat'),
      progEl = el.querySelector('#edgeProg'), cardsEl = el.querySelector('#edgeCards'),
      emptyEl = el.querySelector('#edgeEmpty');
  if (!btn || !statEl) return;

  function setStat(t, warn){ statEl.textContent = t; statEl.className = warn ? 'note warn' : 'note'; }
  function setProg(f){
    progEl.style.display = (f === null) ? 'none' : 'block';
    if (f !== null && progEl.firstElementChild) progEl.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }

  if (missing.length){
    setStat('missing: ' + missing.join(', '), true);
    btn.disabled = true;
    return;
  }

  btn.addEventListener('click', function(){ runScan(); });

  async function runScan(){
    if (__edge.busy) return 'busy';
    __edge.busy = true;
    __edge.ranOnce = true;
    btn.disabled = true;
    cardsEl.innerHTML = '';
    emptyEl.style.display = 'none';
    setProg(0);
    var skipped = 0, t0 = Date.now();
    try{
      var uni = await binancePerpUniverse();
      var ticks = await binanceTickers24h();
      var list = (uni || []).filter(function(s){
        var t = ticks && ticks[s];
        return t && (t.turnoverUsd || 0) >= MIN_TURNOVER;
      });
      list.sort(function(a, b){
        return (ticks[b].turnoverUsd || 0) - (ticks[a].turnoverUsd || 0);
      });
      list = list.slice(0, MAX_UNIVERSE);
      if (!list.length){ setStat('universe empty — Binance leg failed or turnover filter too tight', true); return; }
      var found = [];
      for (var ci = 0; ci < list.length; ci += CHUNK){
        var chunk = list.slice(ci, ci + CHUNK);
        await Promise.all(chunk.map(async function(sym, idx){
          var i = ci + idx;
          setProg((i + 1) / list.length);
          setStat('scanning ' + (i + 1) + '/' + list.length + ' · ' + sym + ' · ' + Math.floor((Date.now() - t0) / 1000) + 's');
          try{
            var rows = await binanceKlines(sym, '4h', KL_LIMIT);
            if (!rows || rows.length < DON_LEN + 30){ skipped++; return; }
            var sig = edgeSignal(rows);
            if (!sig) return;
            var bt = edgeBacktest(rows);
            var plan = edgePlan(sig);
            if (!plan) return;
            found.push({ sym: sym, sig: sig, bt: bt, plan: plan, tick: ticks[sym] });
          }catch(e){ skipped++; }
        }));
        await sleep(CHUNK_SLEEP_MS);
      }
      found.sort(function(a, b){ return (b.bt.expR - a.bt.expR) || (b.sig.rr - a.sig.rr); });
      if (!found.length){
        emptyEl.style.display = 'block';
        setStat('done — 0 edge setups / ' + list.length + ' scanned · ' + skipped + ' skipped · ' + Math.floor((Date.now() - t0) / 1000) + 's');
        return;
      }
      cardsEl.innerHTML = found.map(cardHTML).join('');
      setStat('done — ' + found.length + ' EDGE setup' + (found.length === 1 ? '' : 's') + ' / ' + list.length
        + ' scanned · sorted by expectancy · ' + Math.floor((Date.now() - t0) / 1000) + 's');
    }catch(e){
      setStat('scan failed: ' + ((e && e.message) || e), true);
    }finally{
      setProg(null);
      btn.disabled = false;
      __edge.busy = false;
    }
    return 'refreshed';
  }

  __edge.run = runScan;
}

function edgeRefresh(){
  try{
    if (__edge.busy) return 'busy';
    if (!__edge.ranOnce || typeof __edge.run !== 'function') return 'skipped: not run yet';
    return __edge.run();
  }catch(e){ return 'refreshed'; }
}

var W = (typeof window !== 'undefined') ? window : this;
W.edgeSignal = edgeSignal;
W.edgePlan = edgePlan;
W.edgeBacktest = edgeBacktest;
W.edgeMaxSafeLev = edgeMaxSafeLev;
W.edgeUseLev = edgeUseLev;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'edge', label: 'EDGE', mount: mount, refresh: edgeRefresh });

})();
