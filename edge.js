/* =========================================================================
HARDGATE — edge.js
EDGE tab: multi-venue range-edge scanner (Delta India + CoinDCX + free feeds).

Fades range extremes on the contracts you actually trade:
  LONG  — price sweeps/touches the range bottom and reclaims
  SHORT — price tags the range top and rejects

Data: xuUniverse() + xuCandles() (Delta direct, CoinDCX via /api/proxy,
Binance kline fallback when a venue listing is thin). Confluence layers:
Donchian range, Bollinger %B, RSI, detectRegime, volRegime, meanrevAssess,
hgStructureGate, liquidity pools, TTM squeeze, native funding (Delta).

Pure exports (never throw):
  edgeSignal, edgeEnrich, edgeAssess, edgePlan, edgeBacktest,
  edgeMaxSafeLev, edgeUseLev
========================================================================= */
(function(){
'use strict';

var MIN_TURNOVER  = 500000;
var MAX_UNIVERSE  = 50;
var KL_LIMIT      = 300;
var DON_LEN       = 55;
var BB_LEN        = 20;
var BB_MULT       = 2;
var ATR_LEN       = 14;
var EXT_LEN       = 8;
var STOP_ATR      = 1.5;
var TOUCH_ATR     = 0.25;
var MIN_RR        = 1.5;
var MIN_TALLY     = 3;
var MAX_HOLD      = 12;
var MIN_RECORD    = 3;
var CHUNK         = 4;
var CHUNK_SLEEP_MS = 150;
var USE_LEV_FRAC  = 0.5;
var TF            = '4h';

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

function edgeDropForming(rows, res){
  try{
    var sec = {'15m':900,'1h':3600,'2h':7200,'4h':14400,'1d':86400}[res];
    if (!rows || !rows.length || !sec) return rows || [];
    var now = Math.floor(Date.now() / 1000);
    return (now - rows[rows.length - 1].t < sec) ? rows.slice(0, -1) : rows;
  }catch(e){ return rows || []; }
}

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
  return { rows: clean, closes: closes, highs: highs, lows: lows,
           dc: donchian(clean, DON_LEN), pb: bollingerPercentB(closes, BB_LEN, BB_MULT),
           atr: atr(clean, ATR_LEN), sma20: sma(closes, 20), rsi14: rsi(closes, 14),
           loExt: lowest(lows, EXT_LEN), hiExt: highest(highs, EXT_LEN) };
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
    var priorLo = Infinity, priorHi = -Infinity, k;
    for (k = Math.max(0, i - DON_LEN); k < i; k++){
      if (isFinite(A.lows[k]) && A.lows[k] < priorLo) priorLo = A.lows[k];
      if (isFinite(A.highs[k]) && A.highs[k] > priorHi) priorHi = A.highs[k];
    }
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

function edgeEnrich(sig, rows, item, candleSrc){
  var out = { tally: 0, parts: [], notes: [], candleSrc: candleSrc || null };
  try{
    if (!sig || !rows) return out;
    var dir = sig.dir;
    out.parts.push({ label: sig.edge + (sig.swept ? ' · sweep+reclaim' : ' · touch+reject'), pts: 2 });
    out.tally += 2;

    if (typeof volRegime === 'function'){
      var vr = volRegime(rows, 50);
      if (vr === 'COMPRESSING'){
        out.parts.push({ label: 'vol regime COMPRESSING — stored energy at the range edge', pts: 1 });
        out.tally += 1;
      }
    }

    if (typeof meanrevAssess === 'function'){
      var mr = meanrevAssess(rows);
      if (mr && mr.dir === dir && mr.signal){
        var rec = (mr.n >= 3) ? ('MR record ' + mr.n + ' · ' + Math.round(mr.winPct) + '% · avg ' + fmtSignedR(mr.expR))
                              : ('MR thin n=' + mr.n);
        out.parts.push({ label: 'mean-reversion layer agrees — ' + rec, pts: 2 });
        out.tally += 2;
      } else if (mr && mr.dir && mr.dir !== dir){
        out.parts.push({ label: 'mean-reversion opposes the fade — caution', pts: -1 });
        out.tally -= 1;
        out.notes.push('MR opposes');
      }
    }

    if (typeof hgStructureGate === 'function'){
      var sg = hgStructureGate(rows, dir);
      if (sg && sg.veto){
        out.veto = true;
        out.parts.push({ label: 'structure CHoCH against bias — veto', pts: -99 });
        return out;
      }
      if (sg && sg.bos){
        out.parts.push({ label: sg.note || 'BOS confirms the fade direction', pts: 1 });
        out.tally += 1;
      }
    }

    if (typeof findLiquidityPools === 'function'){
      var pools = findLiquidityPools(rows);
      if (pools){
        var tgt = (typeof liquidityTargetText === 'function') ? liquidityTargetText(rows, dir) : null;
        if (tgt && tgt !== '—'){
          out.parts.push({ label: 'liquidity magnet aligned — ' + tgt, pts: 1 });
          out.tally += 1;
        }
      }
    }

    if (typeof ttmSqueeze === 'function'){
      var sq = ttmSqueeze(rows);
      if (sq && sq.on){
        out.parts.push({ label: 'TTM squeeze ON — coil at the range extreme', pts: 1 });
        out.tally += 1;
      }
    }

    if (item){
      if (isFinite(item.fundingPct)){
        var f = item.fundingPct;
        var tail = (dir === 'long' && f < -0.02) || (dir === 'short' && f > 0.02);
        var crowd = (dir === 'long' && f > 0.05) || (dir === 'short' && f < -0.05);
        if (tail){
          out.parts.push({ label: 'funding tailwind ' + fmtF(f, 4) + '%/interval (' + item.exchange + ')', pts: 1 });
          out.tally += 1;
        } else if (crowd){
          out.parts.push({ label: 'funding crowded against the fade', pts: -1 });
          out.tally -= 1;
        }
      }
      if (item.alsoOn){
        out.parts.push({ label: 'also listed on ' + String(item.alsoOn).split(' ')[0], pts: 0 });
      }
    }

    if (candleSrc === 'binance-fallback'){
      out.notes.push('candles via Binance twin (venue history thin)');
    }
    return out;
  }catch(e){ return out; }
}

function edgeAssess(rows, item, candleSrc){
  try{
    var sig = edgeSignal(rows);
    if (!sig) return null;
    var en = edgeEnrich(sig, rows, item, candleSrc);
    if (en.veto) return null;
    if (en.tally < MIN_TALLY) return null;
    var plan = edgePlan(sig);
    if (!plan) return null;
    return { sig: sig, enrich: en, plan: plan, tally: en.tally, parts: en.parts };
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
        var hj = A.highs[j], lj = A.lows[j];
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
    var wins = 0, grossWin = 0, grossLoss = 0, sum = 0, k;
    for (k = 0; k < rs.length; k++){
      sum += rs[k];
      if (rs[k] > 0){ wins++; grossWin += rs[k]; }
      else if (rs[k] < 0){ grossLoss += -rs[k]; }
    }
    var avgR = sum / rs.length;
    return { n: rs.length, winPct: wins / rs.length * 100, avgR: avgR,
             pf: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0), expR: avgR };
  }catch(e){ return btZero(); }
}

function edgePlanHtml(p){
  if (!p) return '';
  var levLine = ' · USE <b>' + p.useLev + 'x</b> (conservative · max safe ' + p.maxLev + 'x)';
  var t2 = (p.t2 !== null && isFinite(p.t2) && isFinite(p.rr2))
    ? ' · T2 ' + pxF(p.t2) + ' (' + fmtF(p.rr2, 1) + 'R)' : '';
  return 'ENTRY <b>' + pxF(p.entry) + '</b> · STOP <b>' + pxF(p.stop) + '</b>'
    + ' · T1 ' + pxF(p.t1) + ' (' + fmtF(p.rr1, 1) + 'R)' + t2
    + ' · risk ' + fmtF(p.riskPct, 2) + '%' + levLine
    + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(p.entry, p.stop) : '')
    + (typeof hgSessionChip === 'function' ? hgSessionChip() : '');
}

function venueLabel(item){
  if (!item) return '—';
  var v = String(item.exchange || '').toUpperCase();
  if (item.alsoOn) return v + ' · also ' + esc(item.alsoOn);
  return v;
}

function cardHTML(r){
  var sig = r.sig, bt = r.bt, p = r.plan, en = r.enrich || {};
  var turnover = (r.item && isFinite(r.item.turnoverUsd))
    ? '$' + fmtF(r.item.turnoverUsd / 1e6, 1) + 'M' : 'n/a';
  var edgeLbl = sig.edge + (sig.swept ? ' · SWEEP+RECLAIM' : ' · TOUCH+REJECT');
  var record = bt.n >= MIN_RECORD
    ? 'SETUP RECORD: ' + bt.n + ' trades · ' + Math.round(bt.winPct) + '% win · avg ' + fmtSignedR(bt.avgR) + ' · PF ' + fmtPF(bt.pf)
    : (bt.n > 0 ? 'THIN RECORD: ' + bt.n + ' · avg ' + fmtSignedR(bt.avgR)
      : 'THIN RECORD: no historical edge fades on these bars');
  var gates = (en.parts || []).filter(function(pt){ return pt.pts > 0; }).slice(0, 5)
    .map(function(pt){ return '<span class="gpip ok">' + esc(pt.label) + '</span>'; }).join('');
  var planBlock = p
    ? '<div class="plan">' + edgePlanHtml(p)
      + ' — ' + DON_LEN + '-bar range fade on <b>' + esc(venueLabel(r.item)) + '</b>'
      + (r.candleSrc ? ' · candles: ' + esc(r.candleSrc) : '')
      + '</div>' : '<div class="plan">levels unavailable</div>';
  var sym = r.item ? r.item.sym : r.sym;
  var btn = (p && typeof toTrade === 'function')
    ? '<button class="toTrade" onclick="toTrade(' + JSON.stringify(sym) + ',' + JSON.stringify(p.dir)
      + ',' + p.entry + ',' + p.stop + ',' + p.t1 + ')">SEND TO TRADE PLAN</button>' : '';
  return '<div class="card ' + sig.dir + '">'
    + '<div class="chead"><span class="sym">' + esc(sym) + '</span>'
    + '<span class="dir"><span class="stamp pass">' + sig.dir.toUpperCase() + '</span>'
    + ' EDGE · tally ' + (r.tally || 0) + ' · exp ' + fmtSignedR(bt.expR) + '</span></div>'
    + '<div class="mini">'
    + '<span class="k">venue</span><span>' + venueLabel(r.item) + '</span>'
    + '<span class="k">edge</span><span>' + esc(edgeLbl) + '</span>'
    + '<span class="k">regime</span><span>' + esc(sig.regime || 'n/a') + '</span>'
    + '<span class="k">%B</span><span>' + fmtF(sig.pctB, 2) + '</span>'
    + '<span class="k">range</span><span>' + pxF(sig.dcLo) + ' – ' + pxF(sig.dcHi) + '</span>'
    + '<span class="k">turnover</span><span>' + turnover + '</span>'
    + '</div>'
    + '<div class="gates">' + gates
    + '<span class="gpip ok">R:R ' + fmtF(sig.rr, 2) + ' · USE ' + (p ? p.useLev : '—') + 'x</span></div>'
    + planBlock + '<div class="plan">' + record + '</div>' + btn + '</div>';
}

var __edge = { busy: false, ranOnce: false, run: null };

function mount(el){
  if (!el) return;
  var missing = [];
  if (typeof xuUniverse !== 'function') missing.push('xuUniverse');
  if (typeof xuCandles !== 'function') missing.push('xuCandles');
  if (typeof donchian !== 'function') missing.push('donchian');

  el.innerHTML = '<div class="panel">'
    + '<h2>EDGE Scanner <span>Delta India + CoinDCX range fades · free feeds + indicators</span></h2>'
    + '<p class="note">Scans the <b>combined Delta + CoinDCX</b> universe (xuUniverse). Candles route per venue'
    + ' with Binance fallback when history is thin. Confluence: Donchian range touch, %B extreme,'
    + ' mean-reversion, structure gate, liquidity pools, TTM squeeze, funding (Delta native).'
    + ' Cards need tally ≥ ' + MIN_TALLY + ' independent reads. <b>USE Nx</b> = 50% of max-safe leverage.</p>'
    + '<div class="row"><button class="btn" id="edgeRun">FIND EDGE SETUPS</button>'
    + '<span class="note" id="edgeStat">idle — Delta+CoinDCX · turnover ≥ $'
    + fmtF(MIN_TURNOVER / 1e6, 1) + 'M when known · top ' + MAX_UNIVERSE + '</span></div>'
    + '<div class="prog" id="edgeProg"><i></i></div>'
    + '<div class="cards" id="edgeCards"></div>'
    + '<div class="empty" id="edgeEmpty" style="display:none">No qualifying edge setups on Delta or CoinDCX right now.</div>'
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
    setStat('missing: ' + missing.join(', ') + ' — load xuniverse.js before edge.js', true);
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
      var uni = await xuUniverse(true);
      var note = (typeof xuUniverseNote === 'function') ? xuUniverseNote() : null;
      var list = (uni || []).filter(function(it){
        if (!it || !it.sym) return false;
        var t = it.turnoverUsd;
        if (t === null || t === undefined) return true;
        return t >= MIN_TURNOVER;
      });
      list.sort(function(a, b){
        var ta = (a.turnoverUsd === null || a.turnoverUsd === undefined) ? 0 : a.turnoverUsd;
        var tb = (b.turnoverUsd === null || b.turnoverUsd === undefined) ? 0 : b.turnoverUsd;
        return tb - ta;
      });
      list = list.slice(0, MAX_UNIVERSE);
      if (!list.length){
        setStat('universe empty — ' + (note || 'both exchange legs failed'), true);
        return;
      }
      var found = [];
      for (var ci = 0; ci < list.length; ci += CHUNK){
        var chunk = list.slice(ci, ci + CHUNK);
        await Promise.all(chunk.map(async function(item, idx){
          var i = ci + idx;
          setProg((i + 1) / list.length);
          setStat('scanning ' + (i + 1) + '/' + list.length + ' · ' + item.sym
            + ' (' + item.exchange + ') · ' + Math.floor((Date.now() - t0) / 1000) + 's'
            + (note ? ' · ' + note : ''));
          try{
            var rows = await xuCandles(item, TF, KL_LIMIT);
            var src = xuCandles.lastSource || item.exchange;
            rows = edgeDropForming(rows, TF);
            if (!rows || rows.length < DON_LEN + 30){ skipped++; return; }
            var assessed = edgeAssess(rows, item, src);
            if (!assessed) return;
            var bt = edgeBacktest(rows);
            found.push({
              item: item, sym: item.sym, sig: assessed.sig, plan: assessed.plan,
              enrich: assessed.enrich, tally: assessed.tally, bt: bt, candleSrc: src
            });
          }catch(e){ skipped++; }
        }));
        await sleep(CHUNK_SLEEP_MS);
      }
      found.sort(function(a, b){
        return (b.tally - a.tally) || (b.bt.expR - a.bt.expR) || (b.sig.rr - a.sig.rr);
      });
      if (!found.length){
        emptyEl.style.display = 'block';
        setStat('done — 0 setups / ' + list.length + ' contracts · tally bar ' + MIN_TALLY
          + ' · ' + skipped + ' skipped · ' + Math.floor((Date.now() - t0) / 1000) + 's');
        return;
      }
      cardsEl.innerHTML = found.map(cardHTML).join('');
      setStat('done — ' + found.length + ' EDGE setup' + (found.length === 1 ? '' : 's')
        + ' · Delta+CoinDCX · sorted by confluence tally · ' + Math.floor((Date.now() - t0) / 1000) + 's');
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
W.edgeEnrich = edgeEnrich;
W.edgeAssess = edgeAssess;
W.edgePlan = edgePlan;
W.edgeBacktest = edgeBacktest;
W.edgeMaxSafeLev = edgeMaxSafeLev;
W.edgeUseLev = edgeUseLev;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'edge', label: 'EDGE', mount: mount, refresh: edgeRefresh });

})();
