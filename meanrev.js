/* =========================================================================
HARDGATE — meanrev.js
MEAN REV tab: mean-reversion scanner on the Binance USDT-perp universe.
Every signal card carries an instant per-symbol mini-backtest of the SAME
rules replayed over the same 300 4H bars ("backtested signals").

Classic-script module, no build step. Loads AFTER indicators.js,
indicators2.js and binance.js; registers itself on window.HG_tabs — the
integrator creates the nav button + pane and calls mount(el) once.

Strategy (4H bars, {t,o,h,l,c,v} ascending)
  REGIME   — trend filter: longs only above SMA200, shorts only below.
  TRIGGER  — RSI(2) extreme + Bollinger %B(20,2) extreme:
               long : close > SMA200 AND RSI(2) <= 10 AND %B <= 0.05
               short: close < SMA200 AND RSI(2) >= 90 AND %B >= 0.95
  PLAN     — entry  = last close
             stop   = beyond the 5-bar extreme by 0.5 x ATR(14)
                     (long: lowest low of 5 bars - 0.5*ATR; short: highest
                      high of 5 bars + 0.5*ATR)
             target = SMA20 (the mean being faded back to)
             R:R = reward/risk must be >= 1.2 else the setup is skipped.

MINI-BACKTEST (the differentiator)
  The exact rules above are replayed over every bar of the same 300-bar
  history (one position at a time — while a trade is open, new triggers
  are ignored; the scan resumes on the bar after the exit):
    entry   = close of the signal bar
    exit    = first of  (a) STOP touched (stop-first resolution: if a bar
              touches both stop and mean, the STOP counts), (b) MEAN TOUCH
              vs the running SMA20 of that bar, (c) TIMEOUT after 10 bars
              (exit at that bar's close).
    R       = P&L in units of initial risk (stop exit = exactly -1).
  Reported on the card as
    SETUP RECORD: 14 trades · 64% win · avg +0.8R · PF 1.6
  with n >= 3 historical occurrences; below that the card still shows but
  is labeled THIN RECORD (n<3). Cards are sorted by expectancy (avgR)
  descending. The still-open occurrence on the last bar cannot be
  resolved, so the record covers history up to bar n-2 only.

Network discipline: all data via binance.js globals (10s AbortController
timeout + 60s cache inside that layer, so this module adds no cache of
its own); per-symbol failures are counted and skipped; symbols are
fetched in chunks of 5 with a small sleep between chunks.

Pure functions exported on window (never throw):
  mrSignal(rows)   -> {dir, entry, stop, target, rr} | null
  mrBacktest(rows) -> {n, winPct, avgR, pf, expR}
                      (zeros when no trades; pf = Infinity when a winning
                       record has zero losing trades)

Hard refresh (index.html hardRefreshAll): the registration carries refresh()
per the house contract — async, NEVER throws, terse status string. It re-runs
the same scan the FIND REVERSIONS button triggers; before the first user run
it reports 'skipped: not run yet' (a global refresh must never trigger an
expensive first-time full-universe scan on its own), and while a scan is in
flight it reports 'busy' (overlaps never double-fetch).
========================================================================= */
(function(){
'use strict';

/* ---------------- thresholds / tuning ---------------- */
var MIN_TURNOVER  = 20e6;    // $20M 24h quote-volume floor
var MAX_UNIVERSE  = 0;      // 0 = full Delta + CoinDCX desk (no top-N cap)
var KL_LIMIT      = 300;     // 4h bars per symbol
var REGIME_LEN    = 200;     // SMA regime filter
var MEAN_LEN      = 20;      // the mean (target)
var RSI_LEN       = 2;
var RSI_OS        = 10, RSI_OB = 90;
var BB_LEN        = 20, BB_MULT = 2;
var PB_LO         = 0.05, PB_HI = 0.95;
var ATR_LEN       = 14, EXT_LEN = 5, STOP_ATR = 0.5;
var MIN_RR        = 1.2;
var MAX_HOLD      = 10;      // backtest timeout, bars
var MIN_RECORD    = 3;       // occurrences needed for a full SETUP RECORD
var CHUNK         = 5, CHUNK_SLEEP_MS = 120;

/* ---------------- tiny local helpers (no DOM touched at load time) ---------------- */
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
/* px/fmt live in index.html inline code; resolve lazily, fall back locally. */
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

/* ---------------- pure signal + backtest engine ---------------- */
/* Indicator arrays over the whole series. All the indicators used are
   causal (value at i depends only on bars <= i), so one pass serves both
   the live signal (last bar) and the historical replay.
   Returns null when the indicator layer is missing. Sanitizes rows first
   so null/garbage bars degrade to NaN instead of throwing downstream. */
function computeArrays(rows){
  if (typeof sma !== 'function' || typeof rsi !== 'function' ||
      typeof bollinger !== 'function' || typeof bollingerPercentB !== 'function' ||
      typeof atr !== 'function' || typeof highest !== 'function' ||
      typeof lowest !== 'function') return null;
  var n = rows.length;
  var clean = new Array(n), closes = new Array(n), highs = new Array(n), lows = new Array(n);
  for (var i = 0; i < n; i++){
    var r = rows[i];
    closes[i] = (r && isFinite(r.c)) ? r.c : NaN;
    highs[i]  = (r && isFinite(r.h)) ? r.h : NaN;
    lows[i]   = (r && isFinite(r.l)) ? r.l : NaN;
    clean[i]  = {
      t: (r && isFinite(r.t)) ? r.t : NaN,
      o: (r && isFinite(r.o)) ? r.o : NaN,
      h: highs[i], l: lows[i], c: closes[i],
      v: (r && isFinite(r.v)) ? r.v : NaN
    };
  }
  var bb = bollinger(closes, BB_LEN, BB_MULT);
  var pctB = new Array(n).fill(NaN);
  for (i = 0; i < n; i++){
    var u = bb.upper[i], l = bb.lower[i];
    if (isFinite(u) && isFinite(l) && u !== l && isFinite(closes[i]))
      pctB[i] = (closes[i] - l)/(u - l);
  }
  return {
    rows: clean, closes: closes,
    sma200: sma(closes, REGIME_LEN),
    sma20:  sma(closes, MEAN_LEN),
    rsi2:   rsi(closes, RSI_LEN),
    atr14:  atr(clean, ATR_LEN),
    pctB:   pctB,
    low5:   lowest(lows, EXT_LEN),
    high5:  highest(highs, EXT_LEN)
  };
}

/* The full setup evaluated at bar i (uses only data <= i via causal arrays).
   null when no signal, when any ingredient is not computable, or when the
   R:R gate (< MIN_RR) rejects the trade. */
function setupAt(A, i){
  var c = A.closes[i];
  if (!isFinite(c)) return null;
  var s200 = A.sma200[i], s20 = A.sma20[i], r2 = A.rsi2[i],
      pb = A.pctB[i], at = A.atr14[i];
  if (!isFinite(s200) || !isFinite(s20) || !isFinite(r2) || !isFinite(pb) || !isFinite(at)) return null;
  if (!(at > 0)) return null;
  var dir = null;
  if (c > s200 && r2 <= RSI_OS && pb <= PB_LO) dir = 'long';
  else if (c < s200 && r2 >= RSI_OB && pb >= PB_HI) dir = 'short';
  if (!dir) return null;
  var stop;
  if (dir === 'long'){
    var lo = A.low5[i];
    if (!isFinite(lo)) return null;
    stop = lo - STOP_ATR * at;
  } else {
    var hi = A.high5[i];
    if (!isFinite(hi)) return null;
    stop = hi + STOP_ATR * at;
  }
  var entry = c, target = s20;
  var risk = (dir === 'long') ? (entry - stop) : (stop - entry);
  if (!(risk > 0)) return null;
  var reward = (dir === 'long') ? (target - entry) : (entry - target);
  var rr = reward / risk;
  if (!(isFinite(rr) && rr >= MIN_RR)) return null;
  return { dir: dir, entry: entry, stop: stop, target: target, rr: rr };
}

/* Live signal on the last bar. Never throws. */
/* Closed bars only. This signal read the last bar of whatever the caller
   fetched — a candle still forming, whose RSI(2) and %B un-print as it
   moves. The file's own backtest header admits the last-bar occurrence
   "cannot be resolved"; the live signal was resolving it anyway, on every
   scan. Self-sufficient (spacing inferred from the tape), a no-op on
   historical tapes, and shared with every caller of mrSignal — brain,
   edge and star trader read this signal too. */
function mrClosed(rows){
  try{
    if (!Array.isArray(rows) || rows.length < 6) return rows;
    var d = [], i, a, b;
    for (i = Math.max(1, rows.length - 30); i < rows.length; i++){
      a = +(rows[i] && rows[i].t); b = +(rows[i - 1] && rows[i - 1].t);
      if (isFinite(a) && isFinite(b) && a > b) d.push(a - b);
    }
    if (!d.length) return rows;
    d.sort(function(x, y){ return x - y; });
    var sp = d[Math.floor(d.length / 2)];
    var lastT = +rows[rows.length - 1].t;
    if (isFinite(lastT) && lastT > 1e12) lastT = Math.floor(lastT / 1000);
    return (isFinite(sp) && sp > 0 && isFinite(lastT) && (Date.now() / 1000 - lastT) < sp)
      ? rows.slice(0, -1) : rows;
  }catch(e){ return rows; }
}

function mrSignal(rows){
  try{
    rows = mrClosed(rows);
    if (!Array.isArray(rows) || rows.length < 2) return null;
    var A = computeArrays(rows);
    if (!A) return null;
    return setupAt(A, rows.length - 1);
  }catch(e){ return null; }
}

function btZero(){ return { n: 0, winPct: 0, avgR: 0, pf: 0, expR: 0 }; }

/* Historical replay of the same rules over the same bars.
   One position at a time; stop-first resolution; mean touch vs the
   running SMA20; timeout exit at the close of the MAX_HOLD-th bar.
   Never throws; degenerate input -> zeros. */
function mrBacktest(rows){
  try{
    if (!Array.isArray(rows) || rows.length < 3) return btZero();
    var A = computeArrays(rows);
    if (!A) return btZero();
    var n = rows.length;
    var rs = [];
    var i = 1;
    while (i <= n - 2){                    // need >= 1 forward bar to resolve
      var s = setupAt(A, i);
      if (!s){ i++; continue; }
      var lastJ = Math.min(i + MAX_HOLD, n - 1);
      var exitR = null, exitJ = lastJ;
      for (var j = i + 1; j <= lastJ; j++){
        var m = A.sma20[j];
        var hj = A.rows[j].h, lj = A.rows[j].l;
        if (s.dir === 'long'){
          if (isFinite(lj) && lj <= s.stop){ exitR = -1; exitJ = j; break; }        // stop first
          if (isFinite(hj) && isFinite(m) && hj >= m){ exitR = (m - s.entry)/(s.entry - s.stop); exitJ = j; break; }
        } else {
          if (isFinite(hj) && hj >= s.stop){ exitR = -1; exitJ = j; break; }        // stop first
          if (isFinite(lj) && isFinite(m) && lj <= m){ exitR = (s.entry - m)/(s.stop - s.entry); exitJ = j; break; }
        }
      }
      if (exitR === null){                 // timeout: exit at the close of the last holding bar
        var cj = A.closes[lastJ];
        exitR = isFinite(cj)
          ? ((s.dir === 'long') ? (cj - s.entry)/(s.entry - s.stop)
                                : (s.entry - cj)/(s.stop - s.entry))
          : 0;
      }
      if (isFinite(exitR)) rs.push(exitR);
      i = exitJ + 1;                       // non-overlapping: resume after the exit
    }
    if (!rs.length) return btZero();
    var wins = 0, grossWin = 0, grossLoss = 0, sum = 0;
    for (var k = 0; k < rs.length; k++){
      var r = rs[k];
      sum += r;
      if (r > 0){ wins++; grossWin += r; }
      else if (r < 0){ grossLoss += -r; }
    }
    var avgR = sum / rs.length;
    var pf = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
    return { n: rs.length, winPct: wins / rs.length * 100, avgR: avgR, pf: pf, expR: avgR };
  }catch(e){ return btZero(); }
}

/* ---------------- live execution levels (SL/TP audit) ---------------- */
/* meanrevPlan(inp) — full execution levels for a live mean-reversion setup.
     inp: { dir:'long'|'short', entry, extreme, atr, mean, oppBand }
       entry   = the stretch level / limit (last close at the extreme)
       extreme = the 5-bar extreme being faded (lowest low long / highest high short)
       atr     = ATR(14) of the same series
       mean    = T1 — the mean (SMA20) the fade reverts to
       oppBand = T2 — the opposite Bollinger band
     STOP  = beyond the extreme by 1.5xATR, against the direction
             (long: extreme - 1.5*ATR; short: extreme + 1.5*ATR)
   Returns {dir, entry, stop, t1, t2, risk, riskPct, rr1, rr2} or null when any
   ingredient is missing/degenerate, when the stop lands on the wrong side of
   the entry, or when T1 is not in the reversion direction. Never throws. */
var PLAN_STOP_ATR = 1.5;
function meanrevPlan(inp){
  try{
    if (!inp || typeof inp !== 'object') return null;
    var dir = inp.dir;
    if (dir !== 'long' && dir !== 'short') return null;
    var entry = +inp.entry, extreme = +inp.extreme, at = +inp.atr,
        mean = +inp.mean, opp = +inp.oppBand;
    if (!isFinite(entry) || !isFinite(extreme) || !isFinite(at) ||
        !isFinite(mean) || !isFinite(opp)) return null;
    if (!(entry > 0) || !(at > 0)) return null;
    var stop = (dir === 'long') ? extreme - PLAN_STOP_ATR * at
                                : extreme + PLAN_STOP_ATR * at;
    var risk = (dir === 'long') ? (entry - stop) : (stop - entry);
    if (!(risk > 0)) return null;                 // stop on the wrong side
    var reward1 = (dir === 'long') ? (mean - entry) : (entry - mean);
    if (!(reward1 > 0)) return null;              // T1 must sit in the reversion direction
    var reward2 = (dir === 'long') ? (opp - entry) : (entry - opp);
    return {
      dir: dir, entry: entry, stop: stop, t1: mean, t2: opp,
      risk: risk, riskPct: risk / entry * 100,
      rr1: reward1 / risk, rr2: reward2 / risk
    };
  }catch(e){ return null; }
}

/* oiflow.js plan-block markup: ENTRY · STOP · T1 (xR) · T2 (xR) · risk x%. */
function meanrevPlanHtml(p){
  if (!p) return '';
  return 'ENTRY <b>' + pxF(p.entry) + '</b> · STOP <b>' + pxF(p.stop) + '</b>'
    + ' · T1 ' + pxF(p.t1) + ' (' + fmtF(p.rr1, 1) + 'R) · T2 ' + pxF(p.t2) + ' (' + fmtF(p.rr2, 1) + 'R)'
    + ' · risk ' + fmtF(p.riskPct, 2) + '%'
    + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(p.entry, p.stop) : '');
}

/* ---------------- scanner (UI) ---------------- */
function cardHTML(r){
  var sig = r.sig, bt = r.bt, st = r.stats;
  var turnover = r.tick ? '$' + fmtF(r.tick.turnoverUsd / 1e6, 0) + 'M' : '—';
  var dirUp = sig.dir.toUpperCase();
  var regimeChip = sig.dir === 'long' ? 'C &gt; SMA' + REGIME_LEN : 'C &lt; SMA' + REGIME_LEN;
  var trigChip = sig.dir === 'long'
    ? 'RSI2 ' + fmtF(st.rsi2, 1) + ' ≤ ' + RSI_OS + ' · %B ' + fmtF(st.pctB, 2) + ' ≤ ' + PB_LO
    : 'RSI2 ' + fmtF(st.rsi2, 1) + ' ≥ ' + RSI_OB + ' · %B ' + fmtF(st.pctB, 2) + ' ≥ ' + PB_HI;

  var record;
  if (bt.n >= MIN_RECORD){
    record = 'SETUP RECORD: ' + bt.n + ' trades · ' + Math.round(bt.winPct) + '% win'
      + ' · avg ' + fmtSignedR(bt.avgR) + ' · PF ' + fmtPF(bt.pf);
  } else if (bt.n > 0){
    record = 'THIN RECORD (n&lt;3): ' + bt.n + ' trade' + (bt.n === 1 ? '' : 's')
      + ' · ' + Math.round(bt.winPct) + '% win · avg ' + fmtSignedR(bt.avgR) + ' · PF ' + fmtPF(bt.pf);
  } else {
    record = 'THIN RECORD (n&lt;3): no historical setups on these bars';
  }
  record += ' · replay: ' + STOP_ATR + '×ATR' + ATR_LEN + ' stop · sma' + MEAN_LEN + ' touch · ' + MAX_HOLD + '-bar timeout';

  /* live execution levels (SL/TP audit): the stretch entry, a stop beyond the
     extreme by 1.5×ATR, T1 at the mean, T2 at the opposite band. Honest
     fallback when the band/ATR ingredients are missing. */
  var lv = meanrevPlan({ dir: sig.dir, entry: sig.entry, extreme: st.extreme,
                         atr: st.atr, mean: sig.target, oppBand: st.oppBand });
  var mrStack = null;
  if (lv && typeof hgSetupStackForInlineScan === 'function'){
    try{
      mrStack = hgSetupStackForInlineScan({ dir: sig.dir, sym: r.sym, rows4h: r.rows, style: 'meanrev',
        ticker: r.tick, clean: true });
    }catch(eSt){}
  }
  var stackHtml = (mrStack && typeof hgSetupStackMiniHtml === 'function') ? hgSetupStackMiniHtml(mrStack) : '';
  var planBlock = lv
    ? '<div class="plan">' + meanrevPlanHtml(lv)
      + ' — limit at the stretch · stop beyond the ' + EXT_LEN + '-bar '
      + (sig.dir === 'long' ? 'low − ' : 'high + ') + PLAN_STOP_ATR + '×ATR' + ATR_LEN
      + ' · T1 = sma' + MEAN_LEN + ' mean · T2 = opposite band(' + BB_LEN + ',' + BB_MULT + ')</div>'
    : '<div class="plan">levels unavailable — ATR/band data missing for ' + esc(r.sym) + '</div>';
  /* the shared 20-gate read — a demotion whose reason never reaches the card is a bug */
  if (r.contextRead){
    planBlock += '<div class="dim">' + esc(r.contextRead)
      + (r.contextAdverse ? ' — context AGAINST this fade' : '') + '</div>';
  }

  var tradeOnclick = (lv && (typeof hgToTradePlanOnclickAttr === 'function' || typeof toTrade === 'function'))
    ? ((typeof hgToTradePlanOnclickAttr === 'function')
      ? hgToTradePlanOnclickAttr(r.sym, sig.dir, lv.entry, lv.stop, lv.t1, { t2: lv.t2, stack: mrStack, scanner: 'meanrev', strategy: 'meanrev' })
      : ('toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(sig.dir) + ',' + lv.entry + ',' + lv.stop + ',' + lv.t1 + ')')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    : '';
  var tradeBtn = tradeOnclick
    ? '<button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (lv && typeof bookBtnHTML === 'function')
    ? bookBtnHTML(r.sym, sig.dir, lv.entry, lv.stop, lv.t1, { scanner: 'meanrev', strategy: 'meanrev', t2: lv.t2, stack: mrStack }) : '';

  return '<div class="card ' + sig.dir + '">'
    + '<div class="chead"><span class="sym">' + esc(r.sym) + '</span>'
    + '<span class="dir">' + dirUp + ' · MEAN REV · exp ' + fmtSignedR(bt.expR) + '</span>'
    + (typeof hgBookStampChip === 'function' ? hgBookStampChip(r.sym, sig.dir, { scanner: 'meanrev', strategy: 'meanrev' }) : '')
    + '</div>'
    + '<div class="mini">'
    + '<span class="k">last</span><span>' + pxF(st.last) + '</span>'
    + '<span class="k">rsi(' + RSI_LEN + ')</span><span>' + fmtF(st.rsi2, 1) + '</span>'
    + '<span class="k">%B(' + BB_LEN + ',' + BB_MULT + ')</span><span>' + fmtF(st.pctB, 2) + '</span>'
    + '<span class="k">vs sma' + REGIME_LEN + '</span><span>' + (st.vsSma200Pct >= 0 ? '+' : '') + fmtF(st.vsSma200Pct, 1) + '%</span>'
    + '<span class="k">mean (sma' + MEAN_LEN + ')</span><span>' + pxF(sig.target) + '</span>'
    + '<span class="k">turnover 24h</span><span>' + turnover + '</span>'
    + '</div>'
    + '<div class="gates">'
    + '<span class="gpip ok">REGIME ' + regimeChip + '</span>'
    + '<span class="gpip ok">' + trigChip + '</span>'
    + '<span class="gpip ok">R:R ' + fmtF(sig.rr, 2) + ' ≥ ' + MIN_RR + ' (replay gate)</span>'
    + '</div>'
    + planBlock
    + stackHtml
    + '<div class="plan">' + record + '</div>'
    + tradeBtn
    + bookBtn
    + '</div>';
}

function mount(el){
  if (!el) return;
  var missing = [];
  if (typeof binancePerpUniverse !== 'function') missing.push('binancePerpUniverse');
  if (typeof binanceTickers24h !== 'function') missing.push('binanceTickers24h');
  if (typeof binanceKlines !== 'function') missing.push('binanceKlines');
  if (typeof rsi !== 'function') missing.push('rsi');
  if (typeof sma !== 'function') missing.push('sma');
  if (typeof bollinger !== 'function') missing.push('bollinger');
  if (typeof bollingerPercentB !== 'function') missing.push('bollingerPercentB');
  if (typeof atr !== 'function') missing.push('atr');
  if (typeof highest !== 'function') missing.push('highest');
  if (typeof lowest !== 'function') missing.push('lowest');

  el.innerHTML = '<div class="panel">'
    + '<h2>Mean Reversion Scanner <span>RSI(' + RSI_LEN + ') + %B(' + BB_LEN + ',' + BB_MULT + ') extremes vs SMA'
    + REGIME_LEN + ' regime · 4H · every signal mini-backtested</span></h2>'
    + '<div class="row"><button class="btn" id="mrRun">FIND REVERSIONS</button>'
    + '<span class="note" id="mrStat">idle — Binance perps ≥ $' + fmtF(MIN_TURNOVER / 1e6, 0)
    + 'M turnover · full Delta + CoinDCX desk · R:R ≥ ' + MIN_RR + ' · sorted by expectancy</span></div>'
    + '<div class="prog" id="mrProg"><i></i></div>'
    + '<div class="cards" id="mrCards"></div>'
    + '<div class="empty" id="mrEmpty" style="display:none">No RSI(' + RSI_LEN + ')/%B extremes against the SMA'
    + REGIME_LEN + ' regime right now.</div>'
    + '</div>';

  var btn = el.querySelector('#mrRun'), statEl = el.querySelector('#mrStat'),
      progEl = el.querySelector('#mrProg'), cardsEl = el.querySelector('#mrCards'),
      emptyEl = el.querySelector('#mrEmpty');
  if (!btn || !statEl || !progEl || !cardsEl || !emptyEl) return;

  function setStat(t, warn){ statEl.textContent = t; statEl.className = warn ? 'note warn' : 'note'; }
  function setProg(f){
    progEl.style.display = (f === null) ? 'none' : 'block';
    if (f !== null && progEl.firstElementChild) progEl.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }

  if (missing.length){
    setStat('missing data/indicator layer: ' + missing.join(', ') + ' — check script load order', true);
    btn.disabled = true;
    return;
  }

  btn.addEventListener('click', function(){ runScan(); });

  async function runScan(){
    if (__mr.busy) return 'busy';
    __mr.busy = true;
    __mr.ranOnce = true;
    btn.disabled = true;
    cardsEl.innerHTML = '';
    emptyEl.style.display = 'none';
    setProg(0);
    var t0 = Date.now();
    var status = 'refreshed';
    try{
      setStat('loading Delta + CoinDCX desk universe…');
      var items = [];
      if (typeof hgDeskLoadDeltaCoinDCX === 'function'){
        var desk = await hgDeskLoadDeltaCoinDCX({ force: true, minTurnover: MIN_TURNOVER, includeUnknown: true });
        items = (desk && desk.items) ? desk.items : [];
      } else if (typeof binancePerpUniverse === 'function' && typeof binanceTickers24h === 'function'){
        var res0 = await Promise.all([binancePerpUniverse(), binanceTickers24h()]);
        var perps0 = res0[0] || [], ticks0 = res0[1];
        items = perps0.filter(function(s){ return ticks0[s] && ticks0[s].turnoverUsd >= MIN_TURNOVER; })
          .map(function(s){ return { sym: s, exchange: 'binance', turnoverUsd: ticks0[s].turnoverUsd }; });
      }
      if (MAX_UNIVERSE > 0) items = items.slice(0, MAX_UNIVERSE);
      if (!items.length){ setStat('desk universe unavailable (network issue?)', true); status = 'failed: universe unavailable'; return status; }
      var uni = items;

      var results = [], failed = 0, started = 0;
      for (var ci = 0; ci < uni.length; ci += CHUNK){
        var chunk = uni.slice(ci, ci + CHUNK);
        await Promise.all(chunk.map(async function(item){
          var sym = (item && item.sym) ? item.sym : String(item);
          var my = ++started;
          setStat('scanning ' + my + '/' + uni.length + ' · ' + sym);
          try{
            var rows = null;
            if (typeof hgDeskFetchKlines === 'function') rows = await hgDeskFetchKlines(item, '4h', KL_LIMIT);
            else if (typeof binanceKlines === 'function') rows = await binanceKlines(sym, '4h', KL_LIMIT);
            if (!rows || !rows.length){ failed++; return; }
            /* one convention for the whole scan: the backtest and the stats
               table must read the same closed tape the signal reads */
            rows = mrClosed(rows);
            var sig = mrSignal(rows);
            if (!sig) return;
            /* The shared indicator context — this desk read five arrays of
               its own and nothing else (the 2026-08 audit's thinnest desk).
               A mean-reversion entry is graded AS reversion: it is never
               punished for being counter-trend, but five-plus objections
               from twenty reads is named on the card and costs rank. */
            var cx = (typeof window !== 'undefined' && typeof window.hgContextRead === 'function')
              ? window.hgContextRead(rows, sig.dir, 'meanrev', true) : null;
            var bt = mrBacktest(rows);
            var closes = rows.map(function(r){ return r.c; });
            var k = rows.length - 1;
            var s200 = sma(closes, REGIME_LEN)[k];
            var bbArr = bollinger(closes, BB_LEN, BB_MULT);
            var atrArr = atr(rows, ATR_LEN);
            var exLow = lowest(rows.map(function(r){ return r.l; }), EXT_LEN)[k];
            var exHigh = highest(rows.map(function(r){ return r.h; }), EXT_LEN)[k];
            var tick = { symbol: sym, turnoverUsd: item.turnoverUsd, mark: rows[k].c, chg24: null };
            results.push({
              sym: sym, sig: sig, bt: bt, tick: tick, rows: rows, venue: item.exchange || null,
              contextRead: cx ? cx.read : null, contextAdverse: !!(cx && cx.adverse),
              stats: {
                last: rows[k].c,
                rsi2: rsi(closes, RSI_LEN)[k],
                pctB: bollingerPercentB(rows, BB_LEN, BB_MULT),
                vsSma200Pct: (isFinite(s200) && s200 !== 0) ? (rows[k].c - s200) / s200 * 100 : NaN,
                atr: atrArr[k],
                extreme: (sig.dir === 'long') ? exLow : exHigh,
                oppBand: (sig.dir === 'long') ? bbArr.upper[k] : bbArr.lower[k]
              }
            });
          }catch(e){ failed++; }
        }));
        setProg(Math.min(1, (ci + chunk.length) / uni.length));
        if (ci + CHUNK < uni.length) await sleep(CHUNK_SLEEP_MS);
      }

      /* expectancy first; ties broken by turnover */
      results.sort(function(a,b){
        if (b.bt.expR !== a.bt.expR) return b.bt.expR - a.bt.expR;
        var ta = a.tick ? a.tick.turnoverUsd : 0, tb = b.tick ? b.tick.turnoverUsd : 0;
        return tb - ta;
      });

      if (!results.length) emptyEl.style.display = 'block';
      else cardsEl.innerHTML = results.map(cardHTML).join('');
      try {
        if (typeof window.hgMpPin === 'function'){
          window.hgMpPin('meanrev', results.map(function(r){
            var sig = r && r.sig;
            var st = r && r.stats;
            var lv = (sig && st && typeof meanrevPlan === 'function')
              ? meanrevPlan({ dir: sig.dir, entry: sig.entry, extreme: st.extreme, atr: st.atr, mean: sig.target, oppBand: st.oppBand })
              : null;
            if (lv) return Object.assign({}, r, lv, { dir: sig.dir });
            if (sig) return Object.assign({}, r, {
              dir: sig.dir, entry: sig.entry, stop: sig.stop, t1: sig.target, rr: sig.rr
            });
            return r;
          }), null, cardsEl);
        }
      } catch (eMp) {}

      var secs = ((Date.now() - t0) / 1000).toFixed(1);
      setStat('universe ' + uni.length + ' · signals ' + results.length + ' · failed ' + failed
              + ' · ' + secs + 's — sorted by expectancy R');
    }catch(e){
      setStat('scan failed: ' + ((e && e.message) ? e.message : String(e)), true);
      status = 'failed: ' + ((e && e.message) ? e.message : String(e));
    }finally{
      btn.disabled = false;
      setProg(null);
      __mr.busy = false;
    }
    return status;
  }
  __mr.run = runScan;   // latest healthy mount wins for the hard-refresh contract
}

/* ---------------- HARD REFRESH support ----------------
   House refresh contract (index.html hardRefreshAll): async, NEVER throws,
   terse status — 'busy' while a scan is in flight (overlapping invocations
   never double-fetch), 'skipped: not run yet' before the first user run (a
   global refresh must never trigger an expensive first-time full-universe
   scan on its own), otherwise re-runs the same scan the button triggers and
   returns its status. The per-symbol loop inside runScan already
   catch-isolates failures (counted as `failed`), so a refresh can degrade
   but never rejects. */
var __mr = { busy: false, ranOnce: false, run: null };
async function mrRefresh(){
  try{
    if (__mr.busy) return 'busy';
    if (!__mr.ranOnce || typeof __mr.run !== 'function') return 'skipped: not run yet';
    return await __mr.run();
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }
}

/* ---------------- registration ---------------- */
var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};
W.mrSignal = mrSignal;
W.mrClosed = mrClosed;   /* exported so the closed-bars contract is testable, not asserted by regex */
W.mrBacktest = mrBacktest;
W.meanrevPlan = meanrevPlan;
W.meanrevPlanHtml = meanrevPlanHtml;
/* meanrevAssess(rows) — pure read for BRAIN/BEST: live signal + replay stats. */
function meanrevAssess(rows){
  try{
    if (!Array.isArray(rows) || rows.length < REGIME_LEN + 10) return null;
    var sig = mrSignal(rows);
    var bt = mrBacktest(rows);
    if (!bt || !isFinite(bt.n)) return { signal: sig, dir: sig ? sig.dir : null, expR: 0, n: 0 };
    return {
      signal: sig,
      dir: sig ? sig.dir : null,
      expR: isFinite(bt.expR) ? bt.expR : 0,
      n: bt.n,
      winPct: bt.winPct,
      pf: bt.pf
    };
  }catch(e){ return null; }
}
W.meanrevAssess = meanrevAssess;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'meanrev', label: 'MEAN REV', mount: mount, refresh: mrRefresh });
})();
