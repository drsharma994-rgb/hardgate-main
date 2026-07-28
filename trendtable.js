/* =========================================================================
HARDGATE — trendtable.js
TREND MATRIX tab (id 'trendmx'): multi-timeframe trend dashboard for the
top 60 Binance USDT-M perps by 24h turnover (>= $20M floor).

Per symbol: binanceKlines 1d x260 + 4h x120 -> five signed components
(-1/0/+1), composite score -5..+5:
  1D TREND   1d close vs ema200
  CROSS      1d ema50 vs ema200, plus fresh-cross marker (<=10 bars):
             GOLDEN (crossOver) / DEATH (crossUnder)
  4H CASCADE 4h ema9 > ema21 > ema50 full align +1 / full inverse -1 / else 0
  CLOUD      ichimokuState(1d).priceVsCloud: ABOVE +1 / BELOW -1 / INSIDE 0
  ADX        adx(1d,14) latest >= 25 -> +sign(sum of the four trend
             components) as a strength point, else 0

Classic script, no build step. Loaded AFTER indicators.js, indicators2.js
and binance.js. Exposes the pure classifier window.trendScore, the pure
level builder window.trendmxPlan (+ trendmxPlanHTML/trendmxPlanBlock
renderers) and the window.HG_tabs registration (id/label/mount/refresh —
refresh re-runs a previously-started scan, busy-guarded, skipping honestly
when the operator never ran one). Never throws at load time;
all network goes through binance.js (10s AbortController, 60s cache);
per-symbol failures are counted and skipped; bulk fetches are paced in
chunks of 5.

Universal SL/TP: every scanned row caches its own 4h klines (no double
fetch) and gets an expandable LEVELS cell. Direction comes from the row's
own majority signal (composite >= +2 => long / <= -2 => short); levels come
from window.trendmxPlan — window.smartSetup (index.html SMART $ builder)
when present and sane, else the house fallback: entry = last 4h close,
stop = lastSwing(4h,30) structure buffered 0.25xATR when within 2.5xATR,
else 1.5xATR against dir; T1 = 2R, T2 = 3.5R. Levels are never fabricated:
rows without cached 4h history or a computable ATR print an honest note.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

/* ---------------- pure composite score ---------------- */

function sgn(x){ return x > 0 ? 1 : (x < 0 ? -1 : 0); }

/* compare with a 1e-12 relative deadzone — absorbs float accumulation noise
   in long EMA chains (e.g. 260 exactly-flat closes drift ~1e-13), invisible
   to any real price difference. */
function cmp(a, b){
  var d = a - b;
  var tol = 1e-12 * Math.max(Math.abs(a), Math.abs(b), 1);
  return d > tol ? 1 : (d < -tol ? -1 : 0);
}

function zeroResult(){
  return { score: 0,
           comps: { d1Trend: 0, d1Cross: 0, h4Cascade: 0, cloud: 0, adxPt: 0 },
           freshCross: null, adx: NaN };
}

/* window.trendScore(rows1d, rows4h) -> {score, comps, freshCross, adx}
   Pure: no DOM, no network, never throws. Rows are {t,o,h,l,c,v} ascending. */
function trendScore(rows1d, rows4h){
  var out = zeroResult();
  try{
    if (typeof ema !== 'function' || typeof adx !== 'function' ||
        typeof ichimokuState !== 'function' || typeof crossOver !== 'function' ||
        typeof crossUnder !== 'function' || typeof crossedRecently !== 'function'){
      return out; // indicator globals missing -> graceful zero
    }
    var ok1 = Array.isArray(rows1d) && rows1d.length > 0;
    var ok4 = Array.isArray(rows4h) && rows4h.length > 0;
    if (!ok1 && !ok4) return out;

    if (ok1){
      var c1 = rows1d.map(function(r){ return r ? r.c : NaN; });
      var i1 = c1.length - 1;
      var e50 = ema(c1, 50), e200 = ema(c1, 200);
      var cL = c1[i1], e50L = e50[i1], e200L = e200[i1];

      /* 1) 1d close vs ema200 */
      if (isFinite(cL) && isFinite(e200L)) out.comps.d1Trend = cmp(cL, e200L);

      /* 2) 1d ema50 vs ema200 + fresh-cross marker (<=10 bars) */
      if (isFinite(e50L) && isFinite(e200L)) out.comps.d1Cross = cmp(e50L, e200L);
      if (crossedRecently(crossOver(e50, e200), 10)) out.freshCross = 'GOLDEN';
      else if (crossedRecently(crossUnder(e50, e200), 10)) out.freshCross = 'DEATH';

      /* 4) ichimoku cloud on 1d */
      var st = ichimokuState(rows1d);
      if (st && st.priceVsCloud === 'ABOVE') out.comps.cloud = 1;
      else if (st && st.priceVsCloud === 'BELOW') out.comps.cloud = -1;
    }

    /* 3) 4h cascade ema9 / ema21 / ema50 */
    if (ok4){
      var c4 = rows4h.map(function(r){ return r ? r.c : NaN; });
      var i4 = c4.length - 1;
      var e9 = ema(c4, 9)[i4], e21 = ema(c4, 21)[i4], e50h = ema(c4, 50)[i4];
      if (isFinite(e9) && isFinite(e21) && isFinite(e50h)){
        if (e9 > e21 && e21 > e50h) out.comps.h4Cascade = 1;
        else if (e9 < e21 && e21 < e50h) out.comps.h4Cascade = -1;
      }
    }

    /* 5) ADX strength point in the direction of the trend-sum so far */
    if (ok1){
      var a = adx(rows1d, 14);
      out.adx = (a && a.adx && a.adx.length) ? a.adx[a.adx.length - 1] : NaN;
      var trendSum = out.comps.d1Trend + out.comps.d1Cross +
                     out.comps.h4Cascade + out.comps.cloud;
      if (isFinite(out.adx) && out.adx >= 25) out.comps.adxPt = sgn(trendSum);
    }

    out.score = out.comps.d1Trend + out.comps.d1Cross + out.comps.h4Cascade +
                out.comps.cloud + out.comps.adxPt;
  }catch(e){
    return zeroResult(); // never throw to UI
  }
  return out;
}

/* ---------------- tab UI ---------------- */

var TURNOVER_FLOOR = 20e6;   // >= $20M 24h quote volume
var TOP_N = 60;              // top 60 perps by turnover
var CHUNK = 5;               // paced bulk fetch chunk size
var CHUNK_SLEEP_MS = 150;

function sleepMs(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

function pxFmt(n){
  if (typeof px === 'function') return px(n); // index.html adaptive formatter
  if (n === null || n === undefined || !isFinite(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}

function fmtN(n, d){
  if (typeof fmt === 'function') return fmt(n, d); // index.html formatter
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}

function escH(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

/* ---------------- universal trade plan (SL/TP levels) ---------------- */
var TM_STOP_ATR = 1.5, TM_T1_R = 2, TM_T2_R = 3.5, TM_ATR_LEN = 14;
var TM_MAJORITY = 2;   // |composite| >= 2 = the row's own majority signal

/* majority direction from the row's own composite score; an explicit
   lowercase/uppercase dir always wins over the score. */
function tmDirOf(inp){
  var dir = (inp && typeof inp.dir === 'string') ? inp.dir.toLowerCase() : null;
  if (dir === 'long' || dir === 'short') return dir;
  var sc = (inp && typeof inp.score === 'number' && isFinite(inp.score)) ? inp.score : 0;
  if (sc >= TM_MAJORITY) return 'long';
  if (sc <= -TM_MAJORITY) return 'short';
  return null;
}

function tmFallbackStop(dir, entry, a, rows){
  var stop = NaN, note = '';
  var sw = (typeof lastSwing === 'function') ? lastSwing(rows, dir, 30) : NaN;
  if (isFinite(sw)){
    var s = (dir === 'long') ? sw - 0.25 * a : sw + 0.25 * a;
    var r = (dir === 'long') ? entry - s : s - entry;
    if (r > 0 && r <= 2.5 * a){ stop = s; note = 'stop: lastSwing(4h,30) structure buffered 0.25×ATR' + TM_ATR_LEN; }
    else if (r > 2.5 * a) note = 'stop capped: structure beyond 2.5×ATR — ' + TM_STOP_ATR + '×ATR' + TM_ATR_LEN + ' used';
  }
  if (!isFinite(stop)){
    stop = (dir === 'long') ? entry - TM_STOP_ATR * a : entry + TM_STOP_ATR * a;
    if (!note) note = 'stop: ' + TM_STOP_ATR + '×ATR' + TM_ATR_LEN + ' (lastSwing unavailable)';
  }
  return { stop: stop, note: note };
}

function tmValidSetup(s){
  return !!(s && isFinite(s.entry) && s.entry > 0 && isFinite(s.stop)
            && isFinite(s.t1) && isFinite(s.t2) && Math.abs(s.entry - s.stop) > 0);
}

/* window.trendmxPlan({dir?|score?, cls?, rows4h, rows1h?, entry?}) -> plan|null.
   Pure: no DOM, no network, every global feature-checked, never throws.
   window.smartSetup (index.html) is preferred when available; otherwise the
   house fallback: entry = last 4h close, stop = lastSwing(4h,30) structure
   within 2.5xATR else 1.5xATR against dir, T1 = 2R, T2 = 3.5R. null when
   there is no majority direction or levels cannot be computed honestly. */
function trendmxPlan(inp){
  try{
    inp = inp || {};
    var dir = tmDirOf(inp);
    if (!dir) return null;
    var rows = inp.rows4h;
    if (!Array.isArray(rows) || !rows.length) return null;
    var lastBar = rows[rows.length - 1];
    if (!lastBar) return null;

    /* preferred: index.html SMART $ setup builder (smartClassify shape,
       lowercase dir) */
    if (typeof smartSetup === 'function'){
      try{
        var c = (inp.cls && typeof inp.cls === 'object') ? inp.cls : {};
        var s = smartSetup({ dir: dir, longEv: c.longEv, shortEv: c.shortEv,
                             regime: c.regime, score: c.score, total: c.total },
                           rows, inp.rows1h);
        if (tmValidSetup(s)) return s;
      }catch(eSmart){ /* a broken smartSetup degrades to the house fallback */ }
    }

    /* house fallback */
    var entry = +((inp.entry !== undefined && inp.entry !== null) ? inp.entry : lastBar.c);
    var a = (typeof atr === 'function') ? atr(rows, TM_ATR_LEN)[rows.length - 1] : NaN;
    if (!isFinite(entry) || entry <= 0 || !isFinite(a) || a <= 0) return null;
    var st = tmFallbackStop(dir, entry, a, rows);
    var risk = Math.abs(entry - st.stop);
    if (!(risk > 0)) return null;
    return {
      type: 'ATR', dir: dir, entry: entry, stop: st.stop,
      t1: (dir === 'long') ? entry + TM_T1_R * risk : entry - TM_T1_R * risk,
      t2: (dir === 'long') ? entry + TM_T2_R * risk : entry - TM_T2_R * risk,
      rr1: TM_T1_R, rr2: TM_T2_R, riskPct: risk / entry * 100,
      confirmed: null, note: st.note
    };
  }catch(e){ return null; }
}

/* plan line, same markup as oiflow.js:
   ENTRY <b>..</b> · STOP <b>..</b> · T1 <b>..</b> (xR) · T2 <b>..</b> (xR) · risk ..% */
function trendmxPlanHTML(s){
  if (!s) return '';
  var risk = (isFinite(s.entry) && isFinite(s.stop)) ? Math.abs(s.entry - s.stop) : NaN;
  var rr1 = isFinite(s.rr1) ? s.rr1 : ((isFinite(risk) && risk > 0) ? Math.abs(s.t1 - s.entry) / risk : NaN);
  var rr2 = isFinite(s.rr2) ? s.rr2 : ((isFinite(risk) && risk > 0) ? Math.abs(s.t2 - s.entry) / risk : NaN);
  return 'ENTRY <b>' + pxFmt(s.entry) + '</b> · STOP <b>' + pxFmt(s.stop) + '</b>'
    + ' · T1 <b>' + pxFmt(s.t1) + '</b> (' + fmtN(rr1, 1) + 'R)'
    + ' · T2 <b>' + pxFmt(s.t2) + '</b> (' + fmtN(rr2, 1) + 'R)'
    + (isFinite(s.riskPct) ? ' · risk ' + fmtN(s.riskPct, 2) + '%' : '')
    + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(s.entry, s.stop) : '')
    + (s.note ? ' — ' + escH(s.note) : '');
}

/* expandable-row block for one matrix row; uses the scan-cached 4h rows —
   never refetches. */
function trendmxPlanBlock(r){
  var dir = tmDirOf(r);
  if (!dir)
    return '<div class="plan">No majority direction on this row (|score| &lt; ' + TM_MAJORITY + ') — no levels.</div>';
  var s = trendmxPlan({ dir: dir, rows4h: r.rows4h, rows1h: r.rows1h });
  var inner = '<b>' + escH(r.sym) + '</b> ' + dir.toUpperCase() + ' · '
    + (s ? trendmxPlanHTML(s)
         : 'levels unavailable — 4h history was not cached for this row or ATR' + TM_ATR_LEN + ' is not computable; nothing is estimated.');
  var btn = (s && typeof toTrade === 'function')
    ? ' <button class="toTrade" onclick="'
      + ('toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(s.dir) + ',' + s.entry + ',' + s.stop + ',' + s.t1 + ')')
          .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      + '">SEND TO TRADE PLAN →</button>' : '';
  return '<div class="plan">' + inner + btn + '</div>';
}

var COLS = [
  { k: 'sym',       label: 'SYMBOL' },
  { k: 'score',     label: 'SCORE' },
  { k: 'd1Trend',   label: '1D TREND' },
  { k: 'd1Cross',   label: 'CROSS' },
  { k: 'h4Cascade', label: '4H CASCADE' },
  { k: 'cloud',     label: 'CLOUD' },
  { k: 'adx',       label: 'ADX' },
  { k: 'price',     label: 'PRICE' },
  { k: 'plan',      label: 'LEVELS', nosort: true }
];

/* ---------------- hard-refresh contract state ----------------
   tmTab mirrors the mounted pane's scan state so the HG_tabs refresh()
   (4th registration field) can re-run a scan the OPERATOR already started.
   A global hard refresh must NEVER trigger the expensive first-time
   full-universe scan on a tab that was never used — it skips honestly.
   busy mirrors runScan's own state.running guard so overlapping refresh
   invocations can't double-fetch. */
var tmTab = { run: null, busy: false, hasRun: false, missing: 0 };

/* refresh contract: async, NEVER throws, returns a terse status string —
   'refreshed' | 'skipped: not run yet' | 'skipped: data layer missing' |
   'busy'. Safe before mount / before the first RUN SCAN. */
async function refreshTrendMatrix(){
  try{
    if (tmTab.busy) return 'busy';
    if (tmTab.missing > 0) return 'skipped: data layer missing';
    if (!tmTab.hasRun || typeof tmTab.run !== 'function') return 'skipped: not run yet';
    await tmTab.run(); /* runScan is internally try-caught; belt-and-braces anyway */
    return 'refreshed';
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

function mountTrendMatrix(el){
  var need = ['binancePerpUniverse', 'binanceTickers24h', 'binanceKlines',
              'ema', 'adx', 'ichimokuState', 'crossOver', 'crossUnder', 'crossedRecently'];
  var missing = [];
  for (var m = 0; m < need.length; m++){
    if (typeof W[need[m]] !== 'function') missing.push(need[m]);
  }

  el.innerHTML =
    '<div class="panel">' +
      '<h2>Trend Matrix <span>multi-TF trend composite · top 60 Binance perps by 24h turnover (≥ $20M)</span></h2>' +
      '<div class="note">Five signed components (−1/0/+1): <b>1D TREND</b> close vs EMA200 · <b>CROSS</b> EMA50 vs EMA200 with a ⚡GOLDEN / ⚡DEATH marker when the cross is ≤10 bars old · <b>4H CASCADE</b> EMA9&gt;EMA21&gt;EMA50 full alignment · <b>CLOUD</b> Ichimoku price vs cloud · <b>ADX</b> ≥25 adds one point in the direction of the trend sum. Composite −5…+5. Click a column header to sort asc/desc. The <b>LEVELS</b> cell expands a trade plan per row: direction from the composite (≥ +2 long / ≤ −2 short), ENTRY · STOP · T1 2R · T2 3.5R computed from the scan-cached 4H rows (SMART $ setup builder when available, structure/ATR fallback otherwise — never refetched, never fabricated).</div>' +
      '<div class="row" style="margin-top:10px">' +
        '<button class="btn" data-r="run">RUN SCAN</button>' +
        '<span class="spacer"></span>' +
        '<button class="chip on" data-f="ALL">ALL</button>' +
        '<button class="chip" data-f="SL">STRONG LONG ≥ +4</button>' +
        '<button class="chip" data-f="SS">STRONG SHORT ≤ −4</button>' +
        '<button class="chip" data-f="FX">FRESH CROSSES</button>' +
      '</div>' +
      '<div class="prog" data-r="prog"><i></i></div>' +
      '<div class="note" data-r="status" style="margin-top:8px">Idle — run a scan to build the matrix.</div>' +
      '<div data-r="out" style="margin-top:12px"><div class="empty">Press RUN SCAN to build the matrix.</div></div>' +
    '</div>';

  var btn    = el.querySelector('[data-r="run"]');
  var prog   = el.querySelector('[data-r="prog"]');
  var status = el.querySelector('[data-r="status"]');
  var out    = el.querySelector('[data-r="out"]');
  var chips  = Array.prototype.slice.call(el.querySelectorAll('[data-f]'));

  var state = { rows: [], filter: 'ALL', sortKey: 'score', sortDir: -1, running: false };

  function setProg(f){
    if (!prog) return;
    prog.style.display = (f === null) ? 'none' : 'block';
    if (f !== null) prog.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }
  function setStatus(txt, warn){
    status.className = warn ? 'note warn' : 'note';
    status.textContent = txt;
  }

  if (missing.length){
    setStatus('Missing globals: ' + missing.join(', ') + ' — tab cannot scan until the data/indicator scripts load.', true);
    btn.disabled = true;
  }

  chips.forEach(function(ch){
    ch.addEventListener('click', function(){
      state.filter = ch.getAttribute('data-f');
      chips.forEach(function(c){ c.classList.toggle('on', c === ch); });
      render();
    });
  });
  btn.addEventListener('click', runScan);

  function sortVal(r, k){
    if (k === 'sym')   return r.sym;
    if (k === 'score') return r.score;
    if (k === 'adx')   return isFinite(r.adx) ? r.adx : -Infinity;
    if (k === 'price') return r.price;
    return r.comps[k] || 0;
  }
  function passFilter(r){
    if (state.filter === 'SL') return r.score >= 4;
    if (state.filter === 'SS') return r.score <= -4;
    if (state.filter === 'FX') return !!r.freshCross;
    return true;
  }
  function tri(v, up, dn){
    if (v > 0) return '<span class="pos">' + up + '</span>';
    if (v < 0) return '<span class="neg">' + dn + '</span>';
    return '<span>—</span>';
  }
  function cloudCell(v){
    if (v > 0) return '<span class="pos">ABOVE</span>';
    if (v < 0) return '<span class="neg">BELOW</span>';
    return '<span>INSIDE</span>';
  }

  function render(){
    if (!state.rows.length){
      out.innerHTML = '<div class="empty">No results — run a scan.</div>';
      return;
    }
    var rows = state.rows.filter(passFilter);
    if (!rows.length){
      out.innerHTML = '<div class="empty">No symbols match this filter.</div>';
      return;
    }
    rows.sort(function(a, b){
      var va = sortVal(a, state.sortKey), vb = sortVal(b, state.sortKey);
      var c = (typeof va === 'string') ? va.localeCompare(vb) : (va - vb);
      return state.sortDir * c;
    });

    var h = '<table><thead><tr>';
    COLS.forEach(function(col){
      var arrow = (!col.nosort && state.sortKey === col.k) ? (state.sortDir > 0 ? ' ▲' : ' ▼') : '';
      h += col.nosort
        ? '<th>' + col.label + '</th>'
        : '<th data-k="' + col.k + '" style="cursor:pointer">' + col.label + arrow + '</th>';
    });
    h += '</tr></thead><tbody>';

    rows.forEach(function(r){
      var sc = r.score;
      var scls = sc > 0 ? 'pos' : (sc < 0 ? 'neg' : '');
      var xcls = r.comps.d1Cross > 0 ? 'pos' : (r.comps.d1Cross < 0 ? 'neg' : '');
      var xtxt = r.comps.d1Cross > 0 ? 'BULL' : (r.comps.d1Cross < 0 ? 'BEAR' : '—');
      var fx = r.freshCross
        ? ' <b class="' + (r.freshCross === 'GOLDEN' ? 'pos' : 'neg') + '">⚡' + r.freshCross + '</b>' : '';
      var adxTxt = isFinite(r.adx) ? r.adx.toFixed(1) : '—';
      var adxMark = r.comps.adxPt > 0 ? ' <span class="pos">▲</span>'
                  : (r.comps.adxPt < 0 ? ' <span class="neg">▼</span>' : '');
      var pdir = tmDirOf(r);
      h += '<tr>' +
        '<td><b>' + r.sym + '</b></td>' +
        '<td class="' + scls + '"><b>' + (sc > 0 ? '+' : '') + sc + '</b></td>' +
        '<td>' + tri(r.comps.d1Trend, '▲ UP', '▼ DOWN') + '</td>' +
        '<td><span class="' + xcls + '">' + xtxt + '</span>' + fx + '</td>' +
        '<td>' + tri(r.comps.h4Cascade, '▲ ALIGN', '▼ INVERSE') + '</td>' +
        '<td>' + cloudCell(r.comps.cloud) + '</td>' +
        '<td>' + adxTxt + adxMark + '</td>' +
        '<td>' + pxFmt(r.price) + '</td>' +
        '<td>' + (pdir
          ? '<button class="chip tmPlanBtn" data-sym="' + escH(r.sym) + '">' + pdir.toUpperCase() + ' PLAN ▸</button>'
          : '<span class="note">—</span>') + '</td>' +
      '</tr>' +
      '<tr class="tmPlanRow" data-sym="' + escH(r.sym) + '" style="display:none"><td colspan="' + COLS.length + '"></td></tr>';
    });
    h += '</tbody></table>';
    out.innerHTML = h;

    Array.prototype.slice.call(out.querySelectorAll('th[data-k]')).forEach(function(th){
      th.addEventListener('click', function(){
        var k = th.getAttribute('data-k');
        if (state.sortKey === k) state.sortDir = -state.sortDir;
        else { state.sortKey = k; state.sortDir = (k === 'sym') ? 1 : -1; }
        render();
      });
    });
    Array.prototype.slice.call(out.querySelectorAll('.tmPlanBtn')).forEach(function(b){
      b.addEventListener('click', function(){ togglePlan(b.getAttribute('data-sym')); });
    });
  }

  /* expand/collapse the per-row LEVELS plan (computed lazily from the
     scan-cached 4h rows on first open). */
  function togglePlan(sym){
    var row = out.querySelector('tr.tmPlanRow[data-sym="' + sym + '"]');
    if (!row) return;
    var btn = out.querySelector('.tmPlanBtn[data-sym="' + sym + '"]');
    var open = row.style.display !== 'none';
    if (open){
      row.style.display = 'none';
      if (btn) btn.textContent = btn.textContent.replace('▾', '▸');
      return;
    }
    var r = null;
    for (var i = 0; i < state.rows.length; i++){ if (state.rows[i].sym === sym){ r = state.rows[i]; break; } }
    var td = row.querySelector('td');
    if (td && r) td.innerHTML = trendmxPlanBlock(r);
    row.style.display = '';
    if (btn) btn.textContent = btn.textContent.replace('▸', '▾');
  }

  async function runScan(){
    if (state.running || missing.length) return;
    state.running = true;
    tmTab.busy = true; /* module-level mirror for the hard-refresh busy guard */
    btn.disabled = true;
    var t0 = Date.now();
    try{
      setProg(0.02);
      setStatus('Loading perp universe + 24h tickers…');
      var uni  = await binancePerpUniverse();
      var tick = await binanceTickers24h();
      if (!Array.isArray(uni) || !uni.length) throw new Error('Binance perp universe unavailable');
      if (!tick) throw new Error('Binance 24h tickers unavailable');

      var syms = uni.filter(function(s){
                      return tick[s] && isFinite(tick[s].turnoverUsd) &&
                             tick[s].turnoverUsd >= TURNOVER_FLOOR;
                    })
                    .sort(function(a, b){ return tick[b].turnoverUsd - tick[a].turnoverUsd; })
                    .slice(0, TOP_N);
      if (!syms.length){
        state.rows = [];
        out.innerHTML = '<div class="empty">No symbols above the $20M turnover floor.</div>';
        setStatus('universe ' + uni.length + ' perps · none above the $20M turnover floor.');
        return;
      }

      var results = [], failed = 0;
      for (var i = 0; i < syms.length; i += CHUNK){
        var chunk = syms.slice(i, i + CHUNK);
        var rs = await Promise.all(chunk.map(function(s){
          return Promise.all([binanceKlines(s, '1d', 260), binanceKlines(s, '4h', 120)])
            .then(function(rr){
              var r1 = rr[0], r4 = rr[1];
              if (!r1 || !r1.length || !r4 || !r4.length) return null;
              var ts = trendScore(r1, r4);
              return { sym: s, score: ts.score, comps: ts.comps,
                       freshCross: ts.freshCross, adx: ts.adx,
                       price: r1[r1.length - 1].c,
                       rows4h: r4, rows1h: null }; // cached for the LEVELS plan — no refetch
            })
            .catch(function(){ return null; }); // per-symbol failure: counted, skipped
        }));
        for (var j = 0; j < rs.length; j++){ if (rs[j]) results.push(rs[j]); else failed++; }
        setProg((i + chunk.length) / syms.length);
        setStatus('Scanning ' + Math.min(i + chunk.length, syms.length) + '/' + syms.length + '…');
        if (i + CHUNK < syms.length) await sleepMs(CHUNK_SLEEP_MS);
      }

      state.rows = results;
      render();
      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      setStatus('universe ' + uni.length + ' perps · top ' + syms.length +
                ' by turnover (≥ $20M) · ' + results.length + ' ok / ' + failed +
                ' failed · ' + dt + 's', results.length === 0);
      if (!results.length){
        out.innerHTML = '<div class="empty">All symbol fetches failed — check connection.</div>';
      }
    }catch(e){
      setStatus('Scan failed: ' + ((e && e.message) || e), true);
      if (!state.rows.length) out.innerHTML = '<div class="empty">Scan could not complete.</div>';
    }finally{
      state.running = false;
      tmTab.busy = false;
      tmTab.hasRun = true; /* attempted counts as run — even a failed scan is not 'not run yet' */
      btn.disabled = missing.length > 0;
      setProg(null);
    }
  }

  /* hand the mounted scan to the hard-refresh contract (latest mount wins) */
  tmTab.run = runScan;
  tmTab.missing = missing.length;
}

/* ---------------- exports + tab registration ---------------- */

W.trendScore = trendScore;
W.trendmxPlan = trendmxPlan;
W.trendmxPlanHTML = trendmxPlanHTML;
W.trendmxPlanBlock = trendmxPlanBlock;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'trendmx', label: 'TREND MATRIX', mount: mountTrendMatrix, refresh: refreshTrendMatrix });

})();
