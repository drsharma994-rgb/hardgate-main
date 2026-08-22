/* =========================================================================
HARDGATE — trendtable.js
TREND MATRIX tab (id 'trendmx'): multi-timeframe trend dashboard across the
full combined universe (Delta + CoinDCX + Binance extension via xuniverse.js,
≥ $5M turnover floor, no top-N cap; Binance-only fallback when xu absent).

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

var TURNOVER_FLOOR = (typeof W.hgDeskMinTurnover === 'function') ? W.hgDeskMinTurnover() : 5e6;
var CHUNK = 5;               // paced bulk fetch chunk size
var CHUNK_SLEEP_MS = 150;

function tmVenueChip(item){
  return (typeof W.hgDeskVenueChipHTML === 'function') ? W.hgDeskVenueChipHTML(item) : '';
}
function tmSymLabel(row){
  if (!row) return '';
  return (typeof W.hgDeskSymLabel === 'function') ? W.hgDeskSymLabel(row) : (row.sym || '');
}
function tmRowVenue(row){
  return row && row.exchange ? String(row.exchange).toLowerCase() : 'binance';
}

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
var TM_MIN_RR = (typeof W.CG_SWING_RR_MIN === 'number') ? W.CG_SWING_RR_MIN : 2.0;

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
  var stopOpts = (typeof hgStructureStopOpts === 'function') ? hgStructureStopOpts({ atrLen: TM_ATR_LEN }) : { atrLen: TM_ATR_LEN, look: 20 };
  if (typeof hgStructureStop === 'function'){
    var st = hgStructureStop(dir, entry, rows, stopOpts);
    if (st) return { stop: st.stop, note: st.note };
  }
  var look = stopOpts.look || 20;
  var stop = NaN, note = '';
  var sw = (typeof lastSwing === 'function') ? lastSwing(rows, dir, look) : NaN;
  if (isFinite(sw)){
    var s = (dir === 'long') ? sw - 0.25 * a : sw + 0.25 * a;
    var r = (dir === 'long') ? entry - s : s - entry;
    if (r > 0 && r <= 2.5 * a){ stop = s; note = 'stop: lastSwing(4h,' + look + ') structure buffered 0.25×ATR' + TM_ATR_LEN; }
    else if (r > 2.5 * a) note = 'stop capped: structure beyond 2.5×ATR — ' + TM_STOP_ATR + '×ATR' + TM_ATR_LEN + ' used';
  }
  if (!isFinite(stop)){
    stop = (dir === 'long') ? entry - TM_STOP_ATR * a : entry + TM_STOP_ATR * a;
    if (!note) note = 'stop: ' + TM_STOP_ATR + '×ATR' + TM_ATR_LEN + ' (lastSwing unavailable)';
  }
  return { stop: stop, note: note };
}

function tmValidSetup(s){
  if (!s || !isFinite(s.entry) || s.entry <= 0 || !isFinite(s.stop) || !isFinite(s.t1)) return false;
  if (Math.abs(s.entry - s.stop) <= 0) return false;
  var rr = isFinite(s.rr1) ? s.rr1
    : Math.abs(s.t1 - s.entry) / Math.abs(s.entry - s.stop);
  return isFinite(rr) && rr >= TM_MIN_RR - 1e-9;
}

function trendmxTicker(inp){
  inp = inp || {};
  var mark = isFinite(inp.price) ? inp.price
    : (inp.rows4h && inp.rows4h.length ? inp.rows4h[inp.rows4h.length - 1].c : null);
  return { symbol: inp.sym, fundingPct: inp.fundingPct, mark: mark };
}

function trendmxClassify(inp, dir){
  var c = (inp && inp.comps) ? inp.comps : {};
  var longEv = [], shortEv = [];
  if (c.d1Trend > 0) longEv.push('1D above EMA200');
  else if (c.d1Trend < 0) shortEv.push('1D below EMA200');
  if (c.d1Cross > 0) longEv.push('EMA50>EMA200');
  else if (c.d1Cross < 0) shortEv.push('EMA50<EMA200');
  if (c.h4Cascade > 0) longEv.push('4H cascade bull');
  else if (c.h4Cascade < 0) shortEv.push('4H cascade bear');
  if (c.cloud > 0) longEv.push('above cloud');
  else if (c.cloud < 0) shortEv.push('below cloud');
  if (c.adxPt > 0) longEv.push('ADX strength bull');
  else if (c.adxPt < 0) shortEv.push('ADX strength bear');
  var regime = '';
  try{
    if (typeof hgTapeRegimeLabel === 'function' && inp.rows4h && inp.rows4h.length)
      regime = hgTapeRegimeLabel(inp.rows4h) || '';
  }catch(e){}
  return {
    dir: dir,
    longEv: longEv,
    shortEv: shortEv,
    regime: regime,
    score: Math.abs((inp && inp.score) || 0),
    total: 5
  };
}

/* cryptogates parity for the row's trend direction — never throws */
function trendmxGateEval(inp, dir){
  try{
    if (!dir || !inp || !inp.rows4h || !inp.rows4h.length) return null;
    var ticker = trendmxTicker(inp);
    var out = {
      gatesPassed: 0, gatesTotal: 7, clean7: false, nearClean: false,
      hit: null, label: 'trend only', veto: null
    };
    if (typeof swingTryClean === 'function'){
      var clean = swingTryClean(inp.rows4h, ticker);
      if (clean && clean.dir === dir){
        out.hit = clean;
        out.clean7 = clean.clean === true || (+clean.passed >= 7);
        out.gatesPassed = clean.passed != null ? +clean.passed : 7;
        out.label = out.clean7 ? '7/7 CLEAN' : (out.gatesPassed + '/7');
        out.nearClean = !out.clean7 && out.gatesPassed >= 6;
        return out;
      }
    }
    if (typeof swingTryNear === 'function'){
      var near = swingTryNear(inp.rows4h, ticker);
      if (near && near.dir === dir){
        out.hit = near;
        out.nearClean = true;
        out.gatesPassed = near.passed != null ? +near.passed : 6;
        out.label = out.gatesPassed + '/7 NEAR';
        return out;
      }
    }
    if (typeof hgSwingParity === 'function'){
      var par = hgSwingParity(inp.rows4h, ticker, dir);
      if (par && par.aligned){
        out.gatesPassed = par.passed || 0;
        out.clean7 = par.clean === true;
        out.nearClean = !par.clean && par.passed >= 6;
        out.label = par.label || (par.passed + '/7');
      }
    } else if (typeof swingGateMatrix === 'function'){
      var m = swingGateMatrix(inp.rows4h, ticker);
      if (m && m.regimeVeto){ out.veto = 'regime'; out.label = 'regime veto'; return out; }
      if (m && m.structureVeto){ out.veto = 'structure'; out.label = 'CHoCH veto'; return out; }
      if (m && m.dir === dir){
        out.gatesPassed = m.passed || 0;
        out.clean7 = m.clean === true;
        out.nearClean = !m.clean && m.passed >= 6;
        out.label = (m.passed || 0) + '/7' + (m.clean ? ' CLEAN' : (m.passed >= 6 ? ' NEAR' : ''));
      } else if (m && m.dir){
        out.label = 'gates ' + m.dir + ' vs trend';
      }
    }
    return out;
  }catch(e){ return null; }
}

function trendmxAttachMeta(plan, gate, extra){
  if (!plan) return plan;
  if (gate){
    plan.gatesPassed = gate.gatesPassed;
    plan.clean7 = gate.clean7;
    plan.nearClean = gate.nearClean;
    plan.gateLabel = gate.label;
  }
  if (extra && extra.formationScore != null) plan.formationScore = extra.formationScore;
  if (!plan.planSrc) plan.planSrc = 'trendmx';
  return plan;
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
    if (typeof hgBestLevels === 'function'){
      var gate = inp.gate || trendmxGateEval(inp, dir);
      var bl = hgBestLevels(Object.assign({}, inp, {
        tab: 'trendmx', style: 'swing', dir: dir, gate: gate,
      }));
      if (bl && bl.ok && bl.plan && tmValidSetup(bl.plan)){
        return trendmxAttachMeta(bl.plan, bl.gate || gate, { formationScore: bl.formationScore });
      }
      if (bl && bl.veto) return null;
    }
    return trendmxPlanLegacy(inp);
  }catch(e){ return null; }
}

function trendmxPlanLegacy(inp){
  try{
    inp = inp || {};
    var dir = tmDirOf(inp);
    if (!dir) return null;
    var rows = inp.rows4h;
    if (!Array.isArray(rows) || !rows.length) return null;
    var lastBar = rows[rows.length - 1];
    if (!lastBar) return null;
    var ticker = trendmxTicker(inp);
    var gate = inp.gate || trendmxGateEval(inp, dir);

    /* 1) gate-clean hit + unified formation ticket (same as GATES scan) */
    if (gate && gate.hit && !gate.veto && typeof hgFormTicket === 'function'){
      try{
        var fm = hgFormTicket(gate.hit, {
          rows: rows, style: 'swing', a4: gate.hit.a4,
          rows1h: inp.rows1h, ticker: ticker
        });
        if (fm && fm.ok && fm.hit && tmValidSetup(fm.hit)){
          return trendmxAttachMeta(fm.hit, gate, { formationScore: fm.formationScore });
        }
      }catch(eForm){}
    }

    /* 2) swing clean plan from cryptogates */
    if (typeof hgSwingCleanPlan === 'function'){
      try{
        var sc = hgSwingCleanPlan(rows, ticker, dir);
        if (tmValidSetup(sc)) return trendmxAttachMeta(sc, gate);
      }catch(eSc){}
    }

    /* 3) structure-based hgPlanLevels with min R:R */
    if (typeof hgPlanLevelsCore === 'function'){
      try{
        var pl = hgPlanLevelsCore(dir, rows, null, { minRr: TM_MIN_RR, style: 'swing', type: 'TRENDMX' });
        if (tmValidSetup(pl)) return trendmxAttachMeta(pl, gate);
      }catch(ePl){}
    }

    /* 4) SMART $ builder with trend-derived evidence */
    if (typeof smartSetup === 'function'){
      try{
        var cls = trendmxClassify(inp, dir);
        var s = smartSetup(cls, rows, inp.rows1h);
        if (tmValidSetup(s)){
          if (typeof hgApplyExactEntry === 'function'){
            s = hgApplyExactEntry(s, rows, { rows1h: inp.rows1h, style: s.type || 'swing', preferEdge: true }) || s;
          }
          return trendmxAttachMeta(s, gate);
        }
      }catch(eSmart){}
    }

    /* 5) house fallback — structure stop + structure targets when available */
    var entry = +((inp.entry !== undefined && inp.entry !== null) ? inp.entry : lastBar.c);
    var a = (typeof atr === 'function') ? atr(rows, TM_ATR_LEN)[rows.length - 1] : NaN;
    if (!isFinite(entry) || entry <= 0 || !isFinite(a) || a <= 0) return null;
    var st = tmFallbackStop(dir, entry, a, rows);
    var risk = Math.abs(entry - st.stop);
    if (!(risk > 0)) return null;
    var t1 = (dir === 'long') ? entry + TM_T1_R * risk : entry - TM_T1_R * risk;
    var t2 = (dir === 'long') ? entry + TM_T2_R * risk : entry - TM_T2_R * risk;
    if (typeof hgStructureTargets === 'function'){
      try{
        var tg = hgStructureTargets(dir, entry, st.stop, rows, a, { minRr: TM_MIN_RR, style: 'swing' });
        if (tg && isFinite(tg.t1)){
          t1 = tg.t1;
          if (isFinite(tg.t2)) t2 = tg.t2;
        }
      }catch(eTg){}
    }
    var fb = {
      type: 'ATR', dir: dir, entry: entry, stop: st.stop, t1: t1, t2: t2,
      rr1: Math.abs(t1 - entry) / risk,
      rr2: Math.abs(t2 - entry) / risk,
      riskPct: risk / entry * 100,
      confirmed: null, note: st.note, planSrc: 'trendmx-fallback'
    };
    if (!tmValidSetup(fb)) return null;
    return trendmxAttachMeta(fb, gate);
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
    + (s.note ? ' — ' + escH(s.note) : '')
    /* the shared 14-gate indicator read attached by hgBestLevels */
    + ((typeof hgStrategyConfirmChipHtml === 'function')
      ? hgStrategyConfirmChipHtml(s.strategyConfirm, s.strategyWith, s.strategyAgainst) : '')
    + (s.contextRead ? '<div class="dim">' + escH(s.contextRead)
        + (s.contextWarn ? ' — context AGAINST this direction' : '') + '</div>' : '');
}

/* expandable-row block for one matrix row; uses the scan-cached 4h rows —
   never refetches. */
function trendmxCardStack(r, dir){
  try{
    if (!dir) return null;
    var gate = r.gate || trendmxGateEval(r, dir);
    var ticker = trendmxTicker(r);
    if (gate && gate.hit && typeof hgSetupStackFromHit === 'function'){
      var hit = Object.assign({}, gate.hit, { sym: r.sym });
      if (typeof hgSetupStackAttach === 'function'){
        hgSetupStackAttach(hit, {
          sym: r.sym, style: 'swing', rows4h: r.rows4h, rows1h: r.rows1h, ticker: ticker
        });
        return hit.stack || null;
      }
    }
    if (typeof hgSetupStackForInlineScan !== 'function') return null;
    return hgSetupStackForInlineScan({
      dir: dir, sym: r.sym, rows4h: r.rows4h, rows1h: r.rows1h,
      style: 'swing', asset: 'crypto', ticker: ticker,
      clean: !!(gate && gate.clean7),
      nearClean: !!(gate && gate.nearClean),
      gatesPassed: gate ? gate.gatesPassed : undefined,
      gatesTotal: 7,
      tightCount: gate && gate.hit ? gate.hit.tightCount : undefined
    });
  }catch(e){ return null; }
}

function trendmxPlanBlock(r){
  var dir = tmDirOf(r);
  if (!dir)
    return '<div class="plan">No majority direction on this row (|score| &lt; ' + TM_MAJORITY + ') — no levels.</div>';
  var s = trendmxPlan(Object.assign({}, r, { dir: dir }));
  var tmStack = trendmxCardStack(r, dir);
  var stackHtml = (tmStack && typeof hgSetupStackMiniHtml === 'function') ? hgSetupStackMiniHtml(tmStack) : '';
  var inner = '<b>' + escH(r.sym) + '</b> ' + dir.toUpperCase() + ' · '
    + (s ? trendmxPlanHTML(s)
         : 'levels unavailable — 4h history was not cached for this row or ATR' + TM_ATR_LEN + ' is not computable; nothing is estimated.');
  if (s && s.gateLabel){
    inner += ' · <span class="gpip ' + (s.clean7 ? 'ok' : (s.nearClean ? '' : '')) + '">' + escH(s.gateLabel) + '</span>';
  }
  var tradeOnclick = (s && (typeof hgToTradePlanOnclickAttr === 'function' || typeof toTrade === 'function'))
    ? ((typeof hgToTradePlanOnclickAttr === 'function')
      ? hgToTradePlanOnclickAttr(r.sym, s.dir, s.entry, s.stop, s.t1, { t2: s.t2, stack: tmStack, scanner: 'trendmx', strategy: 'trendmx' })
      : ('toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(s.dir) + ',' + s.entry + ',' + s.stop + ',' + s.t1 + ')')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    : '';
  var btn = tradeOnclick
    ? ' <button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var bookStamp = (s && typeof hgBookStampChip === 'function')
    ? hgBookStampChip(r.sym, s.dir, { scanner: 'trendmx', strategy: 'trendmx' }) : '';
  var bookBtn = (s && typeof bookBtnHTML === 'function')
    ? ' ' + bookBtnHTML(r.sym, s.dir, s.entry, s.stop, s.t1,
      { scanner: 'trendmx', strategy: 'trendmx', t2: s.t2, stack: tmStack }) : '';
  return '<div class="plan">' + inner + stackHtml + bookStamp + btn + bookBtn + '</div>';
}

var COLS = [
  { k: 'sym',       label: 'SYMBOL' },
  { k: 'score',     label: 'SCORE' },
  { k: 'gates',     label: 'GATES' },
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
var tmTab = { run: null, busy: false, hasRun: false, missing: 0, mountEl: null };
var __tmSnap = null;
var __tmScanSnap = null;

function trendmxConviction(row){
  var sc = (row && typeof row.score === 'number' && isFinite(row.score)) ? row.score : 0;
  if (sc >= 4) return { tier: 'STRONG', label: 'STRONG CONVICTION', prime: true };
  if (sc >= TM_MAJORITY) return { tier: 'CONVICTION', label: 'CONVICTION', prime: false };
  return null;
}

/** Rows with fresh ⚡GOLDEN (EMA50/200 cross ≤10d) + bull cross + long plan + conviction. Pure. */
function trendmxGoldenCrossSetups(rows){
  var out = [];
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || r.freshCross !== 'GOLDEN') continue;
    if (!r.comps || r.comps.d1Cross <= 0) continue;
    var dir = tmDirOf(r);
    if (dir !== 'long') continue;
    var conv = trendmxConviction(r);
    if (!conv) continue;
    if (r.gate && r.gate.veto) continue;
    var plan = trendmxPlan({ dir: dir, score: r.score, rows4h: r.rows4h, rows1h: r.rows1h, entry: r.price, gate: r.gate, comps: r.comps, sym: r.sym, fundingPct: r.fundingPct });
    if (!tmValidSetup(plan)) continue;
    out.push({
      sym: r.sym, dir: 'long', entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: fin(+plan.rr1) ? +plan.rr1 : TM_T1_R, score: r.score, adx: r.adx,
      clean7: !!(plan.clean7 || (r.gate && r.gate.clean7)),
      freshCross: 'GOLDEN', conviction: conv.label, tier: conv.tier, prime: conv.prime,
      comps: r.comps, gateLabel: plan.gateLabel || (r.gate && r.gate.label),
      note: '⚡GOLDEN CROSS (EMA50/200 · ≤10 daily bars) · composite ' + (r.score > 0 ? '+' : '') + r.score + '/5'
        + (plan.gateLabel ? ' · ' + plan.gateLabel : '')
    });
  }
  return out;
}

function fin(v){ return typeof v === 'number' && isFinite(v); }

async function trendmxScanCore(hooks){
  hooks = hooks || {};
  var fetchK = (typeof W.hgDeskFetchKlines === 'function') ? W.hgDeskFetchKlines.bind(W)
    : function(it, tf, n){ return W.binanceKlines(it.sym || it, tf, n); };
  if (typeof W.hgDeskLoadUniverse !== 'function'
      && (typeof W.binancePerpUniverse !== 'function' || typeof W.binanceKlines !== 'function')){
    throw new Error('missing universe layer (hgDeskLoadUniverse or binancePerpUniverse)');
  }
  var uniPack = await W.hgDeskLoadUniverse({ force: true, minTurnover: TURNOVER_FLOOR });
  var items = uniPack.items || [];
  if (!items.length) throw new Error('universe empty' + (uniPack.note ? ' — ' + uniPack.note : ''));
  var results = [], failed = 0;
  for (var i = 0; i < items.length; i += CHUNK){
    var chunk = items.slice(i, i + CHUNK);
    if (typeof hooks.setProg === 'function') hooks.setProg((i + chunk.length) / items.length);
    var rs = await Promise.all(chunk.map(function(item){
      return fetchK(item, '4h', 120).then(function(r4){
          if (!r4 || !r4.length) return null;
          return Promise.all([fetchK(item, '1d', 260), fetchK(item, '1h', 120)]).then(function(rr){
            var r1 = rr[0], r1h = rr[1];
            if (!r1 || !r1.length) return null;
            var ts = trendScore(r1, r4);
            var row = {
              sym: item.sym, base: item.base, exchange: item.exchange || 'binance', alsoOn: item.alsoOn,
              xu: item, score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx,
              price: r1[r1.length - 1].c, rows4h: r4, rows1h: (r1h && r1h.length) ? r1h : null,
              fundingPct: item.fundingPct, turnoverUsd: item.turnoverUsd, mark: item.mark
            };
            var dir = tmDirOf(row);
            row.gate = dir ? trendmxGateEval(row, dir) : null;
            return row;
          });
        }).catch(function(){ return null; });
    }));
    for (var j = 0; j < rs.length; j++){ if (rs[j]) results.push(rs[j]); else failed++; }
    if (i + CHUNK < items.length) await sleepMs(CHUNK_SLEEP_MS);
  }
  return {
    rows: results, failed: failed, uniLen: uniPack.rawLen || items.length,
    scanned: items.length, at: Date.now(), note: uniPack.note, source: uniPack.source,
    venueCounts: uniPack.venueCounts
  };
}

async function trendmxScan(opts){
  opts = opts || {};
  var maxAge = (opts.maxAgeMs > 0) ? opts.maxAgeMs : (5 * 60 * 1000);
  if (!opts.force && __tmScanSnap && __tmScanSnap.at && (Date.now() - __tmScanSnap.at) < maxAge){
    return __tmScanSnap;
  }
  var core = await trendmxScanCore(opts);
  var golden = trendmxGoldenCrossSetups(core.rows);
  __tmScanSnap = {
    at: core.at, rows: core.rows, failed: core.failed, uniLen: core.uniLen, scanned: core.scanned,
    goldenCross: golden, note: core.note, source: core.source, venueCounts: core.venueCounts
  };
  publishTrendmxSnap(core.rows);
  return __tmScanSnap;
}

async function trendmxWarm(opts){
  try{
    var r = await trendmxScan({ force: !!(opts && opts.force) });
    if (r && r.rows && r.rows.length) return 'warmed';
    return 'unavailable: trend matrix scan returned no rows';
  }catch(e){ return 'error: ' + ((e && e.message) || e); }
}

function trendmxCompPipsHtml(comps){
  comps = comps || {};
  return ''
    + '<span class="gpip ' + (comps.d1Trend > 0 ? 'ok' : (comps.d1Trend < 0 ? 'bad' : '')) + '" title="1D trend">1D</span>'
    + '<span class="gpip ' + (comps.d1Cross > 0 ? 'ok' : (comps.d1Cross < 0 ? 'bad' : '')) + '" title="EMA cross">X</span>'
    + '<span class="gpip ' + (comps.h4Cascade > 0 ? 'ok' : (comps.h4Cascade < 0 ? 'bad' : '')) + '" title="4H cascade">4H</span>'
    + '<span class="gpip ' + (comps.cloud > 0 ? 'ok' : (comps.cloud < 0 ? 'bad' : '')) + '" title="Cloud">CL</span>'
    + '<span class="gpip ' + (comps.adxPt !== 0 ? 'ok' : '') + '" title="ADX strength">ADX</span>';
}

function trendmxRowTier(r, plan){
  if (!r) return 'forming';
  if (r.gate && r.gate.veto) return 'forming';
  if (plan && tmValidSetup(plan) && r.gate && r.gate.clean7) return 'clean';
  if (r.gate && r.gate.nearClean) return 'near';
  return 'forming';
}

function trendmxSummaryLine(rows, golden, venueCounts){
  rows = rows || [];
  golden = golden || [];
  var sl = 0, ss = 0, fx = 0, clean = 0, near = 0;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r) continue;
    if (r.score >= 4) sl++;
    if (r.score <= -4) ss++;
    if (r.freshCross) fx++;
    var dir = tmDirOf(r);
    var plan = dir ? trendmxPlan(Object.assign({}, r, { dir: dir })) : null;
    var tier = trendmxRowTier(r, plan);
    if (tier === 'clean') clean++;
    else if (tier === 'near') near++;
  }
  var vc = venueCounts || {};
  var ven = ' · Δ' + (vc.delta || 0) + ' · CDX' + (vc.coindcx || 0) + ' · BN' + (vc.binance || 0);
  return 'scanned ' + rows.length + ven
    + ' · golden ' + golden.length
    + ' · strong +' + sl + '/−' + ss + ' · fresh crosses ' + fx
    + ' · CLEAN ' + clean + ' · NEAR ' + near;
}

function trendmxGoldenCardHTML(g){
  if (!g || !fin(+g.entry) || !fin(+g.stop) || !fin(+g.t1)) return '';
  var col = '#047857';
  var tradeOn = (typeof hgToTradePlanOnclickAttr === 'function')
    ? hgToTradePlanOnclickAttr(g.sym, g.dir, g.entry, g.stop, g.t1, { t2: g.t2, scanner: 'trendmx', strategy: 'trendmx-golden' })
    : '';
  var tradeBtn = tradeOn ? '<button class="toTrade" onclick="' + tradeOn + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (typeof bookBtnHTML === 'function')
    ? bookBtnHTML(g.sym, g.dir, g.entry, g.stop, g.t1, { scanner: 'trendmx', strategy: 'trendmx-golden', t2: g.t2 }) : '';
  return '<div style="flex:1 1 280px;max-width:380px;border:1px solid rgba(5,150,105,.45);border-left:4px solid ' + col + ';border-radius:8px;padding:12px;background:rgba(5,150,105,.06)">'
    + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">'
    + '<span style="font-size:14px;font-weight:800">' + escH(g.sym) + tmVenueChip(g) + '</span>'
    + '<span class="stamp pass">⚡GOLDEN</span>'
    + '<span class="stamp pass">' + escH(g.conviction || g.tier || 'CONVICTION') + '</span>'
    + '</div>'
    + '<div style="margin-top:6px;font-size:10px;color:#64748B">' + escH(g.note || '') + '</div>'
    + '<div style="font-size:22px;font-weight:800;color:' + col + ';margin-top:6px">' + pxFmt(g.entry) + '</div>'
    + '<div class="plan" style="margin-top:6px">' + trendmxPlanHTML(g) + '</div>'
    + tradeBtn + bookBtn
    + '</div>';
}

function trendmxGoldenDeskHTML(golden){
  golden = golden || [];
  if (!golden.length) return '';
  var cards = '';
  for (var i = 0; i < Math.min(golden.length, 4); i++) cards += trendmxGoldenCardHTML(golden[i]);
  return '<div class="panel tier-clean" style="margin:12px 0">'
    + '<h2>⚡ GOLDEN CROSS DESK <span>fresh EMA50/200 bull cross ≤10 daily bars · conviction + valid plan · Telegram every 15m</span></h2>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cards + '</div></div>';
}

function trendmxLimitCardHTML(item){
  if (!item || !item.plan) return '';
  var p = item.plan, r = item.row, dir = item.dir;
  var col = dir === 'long' ? '#047857' : '#dc2626';
  var stHtml = '';
  if (typeof hgLimitState === 'function'){
    var a = (r.rows4h && typeof atr === 'function') ? atr(r.rows4h, TM_ATR_LEN) : null;
    var atrL = (a && a.length) ? a[a.length - 1] : NaN;
    var st = hgLimitState(p, r.price, atrL);
    if (st && st.label) stHtml = '<span class="stamp" style="margin-left:6px">' + escH(st.label) + '</span>';
  }
  var tradeOn = (typeof hgToTradePlanOnclickAttr === 'function')
    ? hgToTradePlanOnclickAttr(r.sym, dir, p.entry, p.stop, p.t1, { t2: p.t2, stack: item.stack, scanner: 'trendmx', strategy: 'trendmx' }) : '';
  return '<div style="flex:1 1 260px;max-width:360px;border:1px solid #E2E8F0;border-left:3px solid ' + col + ';border-radius:8px;padding:10px 12px;background:#fff">'
    + '<div><b>' + escH(r.sym) + '</b>' + tmVenueChip(r) + ' · ' + dir.toUpperCase() + stHtml + '</div>'
    + '<div style="font-size:18px;font-weight:800;color:' + col + ';margin:4px 0">' + pxFmt(p.entry) + '</div>'
    + '<div class="note">' + trendmxPlanHTML(p) + '</div>'
    + (tradeOn ? '<button class="toTrade" onclick="' + tradeOn + '">SEND TO TRADE PLAN →</button>' : '')
    + '</div>';
}

function trendmxLimitBoardHTML(rows){
  var cands = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.gate || r.gate.veto) continue;
    var dir = tmDirOf(r);
    if (!dir) continue;
    var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
    if (!tmValidSetup(plan)) continue;
    if (!(r.gate.clean7 || trendmxConviction(r))) continue;
    cands.push({
      row: r, plan: plan, dir: dir, stack: trendmxCardStack(r, dir),
      rank: (r.gate.clean7 ? 1000 : 0) + Math.abs(r.score) * 10 + (r.gate.gatesPassed || 0)
    });
  }
  cands.sort(function(a, b){ return b.rank - a.rank; });
  /* FORWARD LOG — recorded BEFORE the top-8 slice, so the measurement covers
     every setup the tab judged tradeable rather than only the eight it had
     room to show. The mechanic splits on clean7, which is the tab's own claim
     about quality: if the 7/7 rows resolve like the merely-convicted ones,
     that distinction is not doing work. */
  try {
    if (typeof W.hgFwdRecordScan === 'function' && cands.length){
      W.hgFwdRecordScan('TRENDMX', '4h', cands.map(function(c){
        return { sym: c.row && c.row.sym, dir: c.dir,
                 entry: c.plan && c.plan.entry, stop: c.plan && c.plan.stop, t1: c.plan && c.plan.t1,
                 mechanic: (c.row && c.row.gate && c.row.gate.clean7) ? 'TM-CLEAN7' : 'TM-CONVICTION',
                 ticket: !!(c.row && c.row.gate && c.row.gate.clean7) };
      }), { horizonBars: 20 });
    }
  } catch (eFwd) { try { if (typeof window.hgFwdWarn === "function") window.hgFwdWarn("trendtable", eFwd); } catch (eW) {} }
  cands = cands.slice(0, 8);
  if (!cands.length) return '';
  return '<div class="panel" style="margin:12px 0">'
    + '<h2>LIMIT BOARD <span>CLEAN + conviction rows · exact resting limits · sorted by gates + composite</span></h2>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cands.map(trendmxLimitCardHTML).join('') + '</div></div>';
}

function trendmxSetupCardHTML(r, tier){
  tier = tier || 'clean';
  var dir = tmDirOf(r);
  if (!dir) return '';
  var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
  var stack = trendmxCardStack(r, dir);
  var cls = trendmxClassify(r, dir);
  var conv = trendmxConviction(r);
  var mini = [
    ['SCORE', (r.score > 0 ? '+' : '') + r.score + '/5'],
    ['ADX', isFinite(r.adx) ? r.adx.toFixed(1) : '—'],
    ['REGIME', cls.regime || '—']
  ];
  if (plan) mini.push(['ENTRY', pxFmt(plan.entry)], ['R:R', fmtN(plan.rr1, 1) + 'R']);
  var gates = [];
  if (r.gate) gates.push([r.gate.label, r.gate.clean7 && !r.gate.veto]);
  if (typeof hgSetupCardHTML !== 'function'){
    return '<div class="card ' + dir + '"><b>' + escH(r.sym) + '</b>' + tmVenueChip(r) + ' · ' + dir.toUpperCase() + '</div>';
  }
  return hgSetupCardHTML({
    sym: r.sym, dir: dir, tier: tier,
    mini: mini, gates: gates,
    plan: plan ? trendmxPlanHTML(plan) : '',
    entry: plan ? plan.entry : null, stop: plan ? plan.stop : null, t1: plan ? plan.t1 : null,
    chartId: (tier === 'clean' && plan) ? ('tmx_' + String(r.sym).replace(/[^A-Za-z0-9]/g, '')) : '',
    stack: stack,
    visionChip: r.visionChip, visionNextBar: r.visionNextBar, visionNextMove: r.visionNextMove, visionPrediction: r.visionPrediction,
    bookMeta: { scanner: 'trendmx', strategy: 'trendmx', t2: plan ? plan.t2 : null,
      venue: (typeof W.hgDeskVenueLabel === 'function') ? W.hgDeskVenueLabel(r.exchange) : 'BINANCE',
      visionChip: r.visionChip, visionNextBar: r.visionNextBar, visionNextMove: r.visionNextMove, visionPrediction: r.visionPrediction },
    note: tier !== 'clean' ? (tier === 'near' ? '6/7 NEAR — watch only, not a ticket.' : 'FORMING — trend signal without CLEAN ticket.') : null
  });
}

function trendmxPaintMiniCharts(cardsEl, rows){
  try{
    if (!cardsEl || typeof hgMiniChart !== 'function') return;
    var nodes = cardsEl.querySelectorAll('.hgchart');
    for (var i = 0; i < nodes.length; i++){
      var node = nodes[i], id = node.id || '', symGuess = id.replace(/^tmx_/, ''), row = null;
      for (var j = 0; j < rows.length; j++){
        if (rows[j] && String(rows[j].sym).replace(/[^A-Za-z0-9]/g, '') === symGuess){ row = rows[j]; break; }
      }
      if (!row || !row.rows4h) continue;
      var dir = tmDirOf(row);
      var plan = dir ? trendmxPlan(Object.assign({}, row, { dir: dir })) : null;
      hgMiniChart(node, row.rows4h, {
        dir: dir, entry: plan ? plan.entry : null, stop: plan ? plan.stop : null,
        t1: plan ? plan.t1 : null, t2: plan ? plan.t2 : null
      });
    }
  }catch(e){}
}

function trendmxPaintDeskSections(refs, state){
  var allRows = state.rows || [], golden = state.golden || [];
  var rows = allRows;
  if (state.venue && state.venue !== 'ALL'){
    rows = allRows.filter(function(r){ return tmRowVenue(r) === state.venue; });
    golden = golden.filter(function(g){
      for (var gi = 0; gi < allRows.length; gi++){
        if (allRows[gi].sym === g.sym && tmRowVenue(allRows[gi]) === state.venue) return true;
      }
      return false;
    });
  }
  var vc = state.venueCounts || null;
  if (refs.summary) refs.summary.textContent = rows.length ? trendmxSummaryLine(rows, golden, vc) : 'Idle — run a scan to build the desk.';
  if (refs.golden) refs.golden.innerHTML = trendmxGoldenDeskHTML(golden);
  var clean = [], near = [], forming = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r) continue;
    var dir = tmDirOf(r);
    var plan = dir ? trendmxPlan(Object.assign({}, r, { dir: dir })) : null;
    var tier = trendmxRowTier(r, plan);
    if (tier === 'clean') clean.push(r);
    else if (tier === 'near') near.push(r);
    else if (r.freshCross || Math.abs(r.score) >= TM_MAJORITY || (r.gate && r.gate.gatesPassed >= 5)) forming.push(r);
  }
  clean.sort(function(a, b){ return Math.abs(b.score) - Math.abs(a.score); });
  near.sort(function(a, b){ return (b.gate ? b.gate.gatesPassed : 0) - (a.gate ? a.gate.gatesPassed : 0); });
  forming.sort(function(a, b){ return Math.abs(b.score) - Math.abs(a.score); });
  if (refs.cards){
    if (!clean.length){
      refs.cards.innerHTML = (typeof hgSetupEmptyHTML === 'function')
        ? hgSetupEmptyHTML({ title: 'No CLEAN trend tickets right now.', body: 'NEAR and FORMING rows below are watch-only. Golden cross desk and limit board surface actionable rows when gates + plan align.' })
        : '<div class="empty">No CLEAN tickets.</div>';
    } else {
      var ch = '<div class="note" style="margin:0 0 10px"><b>CLEAN TICKETS</b> — 7/7 gates + valid plan + min R:R ' + TM_MIN_RR + '.</div>';
      for (var ci = 0; ci < Math.min(clean.length, 12); ci++) ch += trendmxSetupCardHTML(clean[ci], 'clean');
      refs.cards.innerHTML = ch;
      trendmxPaintMiniCharts(refs.cards, clean);
    }
    try {
      if (typeof W.hgMpPin === 'function'){
        function tmWithPlan(row){
          var d = tmDirOf(row);
          var p = d ? trendmxPlan(Object.assign({}, row, { dir: d })) : null;
          return p ? Object.assign({}, row, p, { dir: d }) : row;
        }
        for (var ti = 0; ti < clean.length; ti++) tmLead.push(Object.assign({ tier: 'clean' }, tmWithPlan(clean[ti])));
        for (var tn = 0; tn < near.length; tn++) tmLead.push(Object.assign({ tier: 'near' }, tmWithPlan(near[tn])));
        W.hgMpPin('trendmx', { cands: clean.map(tmWithPlan), nearCands: near.map(tmWithPlan), closest: forming[0] ? tmWithPlan(forming[0]) : null }, null, refs.cards);
      }
    } catch (eMp) {}
  }
  if (refs.near){
    refs.near.innerHTML = near.length
      ? ((typeof hgSetupNearHeaderHTML === 'function' ? hgSetupNearHeaderHTML(near.length, 'trendmx') : '')
        + near.slice(0, 8).map(function(r){ return trendmxSetupCardHTML(r, 'near'); }).join(''))
      : '';
  }
  if (refs.forming){
    refs.forming.innerHTML = (typeof hgFormingWatchHTML === 'function')
      ? hgFormingWatchHTML(forming.slice(0, 12).map(function(r){
          return {
            state: (r.gate && r.gate.gatesPassed >= 5) ? 'armed' : 'idle',
            sym: r.sym, strategy: 'TRENDMX',
            condition: (r.freshCross ? '⚡' + r.freshCross + ' · ' : '') + 'composite ' + (r.score > 0 ? '+' : '') + r.score + '/5',
            gatesPassed: r.gate ? r.gate.gatesPassed : null, gatesTotal: 7
          };
        }), { title: 'FORMING · TREND RADAR', subtitle: 'fresh crosses + strong composite without CLEAN ticket yet' })
      : '';
  }
  if (refs.limit) refs.limit.innerHTML = trendmxLimitBoardHTML(rows);
}

function hgPaintTrendmxFromSnap(){
  try{
    if (!__tmScanSnap || !__tmScanSnap.rows || !__tmScanSnap.rows.length || !tmTab.mountEl) return;
    var el = tmTab.mountEl;
    var refs = {
      summary: el.querySelector('[data-r="summary"]'),
      golden: el.querySelector('[data-r="golden"]'),
      cards: el.querySelector('[data-r="cards"]'),
      near: el.querySelector('[data-r="near"]'),
      forming: el.querySelector('[data-r="forming"]'),
      limit: el.querySelector('[data-r="limit"]'),
      out: el.querySelector('[data-r="out"]'),
      status: el.querySelector('[data-r="status"]')
    };
    var state = { rows: __tmScanSnap.rows, golden: __tmScanSnap.goldenCross || [], filter: 'ALL', sortKey: 'score', sortDir: -1 };
    tmTab._state = state;
    trendmxPaintDeskSections(refs, state);
    if (refs.status && __tmScanSnap.at){
      refs.status.textContent = 'desk synced from cache · ' + trendmxSummaryLine(state.rows, state.golden)
        + ' · age ' + Math.round((Date.now() - __tmScanSnap.at) / 1000) + 's';
    }
    if (typeof tmTab._renderMatrix === 'function') tmTab._renderMatrix();
  }catch(e){}
}
W.hgPaintTrendmxFromSnap = hgPaintTrendmxFromSnap;

function publishTrendmxSnap(rows){
  try{
    if (!rows || !rows.length){ __tmSnap = null; return; }
    __tmSnap = {
      at: Date.now(),
      rows: rows.map(function(r){
        return { sym: r.sym, score: r.score, dir: tmDirOf(r) };
      })
    };
  }catch(e){ __tmSnap = null; }
}

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
  tmTab.mountEl = el;
  if (typeof hgSetupInjectStyles === 'function') hgSetupInjectStyles();

  var need = ['ema', 'adx', 'ichimokuState', 'crossOver', 'crossUnder', 'crossedRecently'];
  var missing = [];
  for (var m = 0; m < need.length; m++){
    if (typeof W[need[m]] !== 'function') missing.push(need[m]);
  }
  var hasUniverse = (typeof W.xuUniverse === 'function')
    || (typeof W.binancePerpUniverse === 'function' && typeof W.binanceKlines === 'function');
  if (!hasUniverse) missing.push('xuUniverse|binancePerpUniverse');

  var floorM = (TURNOVER_FLOOR / 1e6).toFixed(0);
  el.innerHTML =
    '<div class="panel hg-panel">' +
      '<h2>TREND MATRIX <span>advanced multi-TF desk · full universe (Delta + CoinDCX + Binance · ≥ $' + floorM + 'M turnover)</span></h2>' +
      '<div id="trendmxDesk"></div>' +
      '<div class="note">Five signed components (−1/0/+1) composite −5…+5 · 7-gate swing matrix · formation ticket cascade · golden cross Telegram every 15m.</div>' +
      '<div class="row" style="margin-top:10px">' +
        '<button class="btn" data-r="run">RUN SCAN</button>' +
        '<button class="btn sec" data-r="sync">SYNC DESK</button>' +
        '<span class="spacer"></span>' +
        '<button class="chip on" data-f="ALL">ALL</button>' +
        '<button class="chip" data-f="CL">CLEAN 7/7</button>' +
        '<button class="chip" data-f="NR">NEAR 6/7</button>' +
        '<button class="chip" data-f="GD">⚡ GOLDEN</button>' +
        '<button class="chip" data-f="CV">CONVICTION</button>' +
        '<button class="chip" data-f="SL">STRONG LONG</button>' +
        '<button class="chip" data-f="SS">STRONG SHORT</button>' +
        '<button class="chip" data-f="FX">FRESH CROSSES</button>' +
        '<span class="spacer"></span>' +
        '<button class="chip on" data-v="ALL">ALL VENUES</button>' +
        '<button class="chip" data-v="delta">DELTA</button>' +
        '<button class="chip" data-v="coindcx">COINDCX</button>' +
        '<button class="chip" data-v="binance">BINANCE</button>' +
      '</div>' +
      '<div class="prog" data-r="prog"><i></i></div>' +
      '<div class="note" data-r="summary" style="margin-top:8px;font-weight:600">Idle — run a scan to build the desk.</div>' +
      '<div class="note" data-r="status" style="margin-top:4px">Press RUN SCAN to warm the full matrix + ticket desk.</div>' +
      '<div data-r="golden"></div>' +
      '<div class="cards" data-r="cards"></div>' +
      '<div data-r="near"></div>' +
      '<div data-r="forming"></div>' +
      '<div data-r="limit"></div>' +
      '<h3 style="margin:16px 0 8px;font-size:11px;letter-spacing:.14em;color:#475569">FULL MATRIX · sortable · expandable plans</h3>' +
      '<div data-r="out"><div class="empty">Press RUN SCAN to build the matrix.</div></div>' +
    '</div>';

  if (typeof hgSetupPaintDesk === 'function'){
    hgSetupPaintDesk(el.querySelector('#trendmxDesk'), {
      kind: 'trendmx', tab: 'TREND MATRIX',
      note: 'CLEAN = 7/7 + plan + min R:R. Golden cross desk + limit board promote the best rows. NEAR/FORMING are watch-only.'
    });
  }

  var btn    = el.querySelector('[data-r="run"]');
  var syncBtn = el.querySelector('[data-r="sync"]');
  var prog   = el.querySelector('[data-r="prog"]');
  var summary = el.querySelector('[data-r="summary"]');
  var status = el.querySelector('[data-r="status"]');
  var out    = el.querySelector('[data-r="out"]');
  var refs = {
    summary: summary,
    golden: el.querySelector('[data-r="golden"]'),
    cards: el.querySelector('[data-r="cards"]'),
    near: el.querySelector('[data-r="near"]'),
    forming: el.querySelector('[data-r="forming"]'),
    limit: el.querySelector('[data-r="limit"]'),
    out: out,
    status: status
  };
  var chips  = Array.prototype.slice.call(el.querySelectorAll('[data-f]'));
  var vChips = Array.prototype.slice.call(el.querySelectorAll('[data-v]'));

  var state = { rows: [], golden: [], filter: 'ALL', venue: 'ALL', sortKey: 'score', sortDir: -1, running: false };
  tmTab._state = state;

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
      renderMatrix();
    });
  });
  vChips.forEach(function(ch){
    ch.addEventListener('click', function(){
      state.venue = ch.getAttribute('data-v');
      vChips.forEach(function(c){ c.classList.toggle('on', c === ch); });
      renderAll();
    });
  });
  btn.addEventListener('click', runScan);
  if (syncBtn) syncBtn.addEventListener('click', function(){ renderAll(); setStatus('desk repainted from latest scan.'); });

  function sortVal(r, k){
    if (k === 'sym')   return r.sym;
    if (k === 'score') return r.score;
    if (k === 'gates') return (r.gate && isFinite(r.gate.gatesPassed)) ? r.gate.gatesPassed : -1;
    if (k === 'adx')   return isFinite(r.adx) ? r.adx : -Infinity;
    if (k === 'price') return r.price;
    return r.comps[k] || 0;
  }
  function passVenue(r){
    if (!state.venue || state.venue === 'ALL') return true;
    return tmRowVenue(r) === state.venue;
  }
  function passFilter(r){
    if (!passVenue(r)) return false;
    var dir = tmDirOf(r);
    var plan = dir ? trendmxPlan(Object.assign({}, r, { dir: dir })) : null;
    var tier = trendmxRowTier(r, plan);
    if (state.filter === 'CL') return tier === 'clean';
    if (state.filter === 'NR') return tier === 'near';
    if (state.filter === 'GD') return r.freshCross === 'GOLDEN';
    if (state.filter === 'CV') return !!trendmxConviction(r);
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

  function renderMatrix(){
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

    var h = '<table class="hg-table"><thead><tr>';
    h += '<th>COMP</th>';
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
      var gate = r.gate;
      var gateTxt = gate ? gate.label : '—';
      var gateCls = gate && gate.clean7 ? 'ok' : (gate && gate.veto ? 'bad' : '');
      var pdir = tmDirOf(r);
      h += '<tr>' +
        '<td>' + trendmxCompPipsHtml(r.comps) + '</td>' +
        '<td><b>' + r.sym + '</b>' + tmVenueChip(r) + '</td>' +
        '<td class="' + scls + '"><b>' + (sc > 0 ? '+' : '') + sc + '</b></td>' +
        '<td><span class="gpip ' + gateCls + '">' + escH(gateTxt) + '</span></td>' +
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
      '<tr class="tmPlanRow" data-sym="' + escH(r.sym) + '" style="display:none"><td colspan="' + (COLS.length + 1) + '"></td></tr>';
    });
    h += '</tbody></table>';
    out.innerHTML = h;

    Array.prototype.slice.call(out.querySelectorAll('th[data-k]')).forEach(function(th){
      th.addEventListener('click', function(){
        var k = th.getAttribute('data-k');
        if (state.sortKey === k) state.sortDir = -state.sortDir;
        else { state.sortKey = k; state.sortDir = (k === 'sym') ? 1 : -1; }
        renderMatrix();
      });
    });
    Array.prototype.slice.call(out.querySelectorAll('.tmPlanBtn')).forEach(function(b){
      b.addEventListener('click', function(){ togglePlan(b.getAttribute('data-sym')); });
    });
  }
  tmTab._renderMatrix = renderMatrix;

  function renderAll(){
    trendmxPaintDeskSections(refs, state);
    renderMatrix();
  }

  function togglePlan(sym){
    var row = out.querySelector('tr.tmPlanRow[data-sym="' + sym + '"]');
    if (!row) return;
    var btnEl = out.querySelector('.tmPlanBtn[data-sym="' + sym + '"]');
    var open = row.style.display !== 'none';
    if (open){
      row.style.display = 'none';
      if (btnEl) btnEl.textContent = btnEl.textContent.replace('▾', '▸');
      return;
    }
    var r = null;
    for (var i = 0; i < state.rows.length; i++){ if (state.rows[i].sym === sym){ r = state.rows[i]; break; } }
    var td = row.querySelector('td');
    if (td && r) td.innerHTML = trendmxPlanBlock(r);
    row.style.display = '';
    if (btnEl) btnEl.textContent = btnEl.textContent.replace('▸', '▾');
  }

  async function runScan(){
    if (state.running || missing.length) return;
    state.running = true;
    tmTab.busy = true;
    btn.disabled = true;
    var t0 = Date.now();
    try{
      setProg(0.05);
      setStatus('Scanning full universe (≥ $' + floorM + 'M turnover · Delta + CoinDCX + Binance)…');
      var snap = await trendmxScan({ force: true });
      var results = (snap && snap.rows) ? snap.rows : [];
      var failed = (snap && snap.failed) ? snap.failed : 0;
      var symsLen = (snap && snap.scanned) ? snap.scanned : results.length;
      var uniLen = (snap && snap.uniLen) ? snap.uniLen : symsLen;
      var vc = (snap && snap.venueCounts) ? snap.venueCounts : {};

      state.rows = results;
      state.golden = (snap && snap.goldenCross) ? snap.goldenCross : [];
      state.venueCounts = vc;
      renderAll();
      if (typeof globalThis !== 'undefined' && typeof globalThis.hgChartVisionEnrichDeskRows === 'function'){
        var tmClean = state.rows.filter(function(r){
          var d = tmDirOf(r);
          if (!d || !r.rows4h) return false;
          var plan = trendmxPlan(Object.assign({}, r, { dir: d }));
          return trendmxRowTier(r, plan) === 'clean';
        });
        globalThis.hgChartVisionEnrichDeskRows(tmClean, function(r){ return r.rows4h; }, {
          limit: 12,
          repaint: function(){ renderAll(); }
        });
      }
      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var venNote = ' · Δ' + (vc.delta || 0) + ' CDX' + (vc.coindcx || 0) + ' BN' + (vc.binance || 0);
      setStatus('raw ' + uniLen + ' · scanned ' + symsLen + venNote
                + ' (≥ $' + floorM + 'M) · ' + results.length + ' ok / ' + failed +
                ' failed · ' + dt + 's' + (snap && snap.note ? ' · ' + snap.note : ''), results.length === 0);
      if (!results.length){
        out.innerHTML = '<div class="empty">All symbol fetches failed — check connection.</div>';
      }
    }catch(e){
      setStatus('Scan failed: ' + ((e && e.message) || e), true);
      if (!state.rows.length) out.innerHTML = '<div class="empty">Scan could not complete.</div>';
    }finally{
      state.running = false;
      tmTab.busy = false;
      tmTab.hasRun = true;
      btn.disabled = missing.length > 0;
      setProg(null);
    }
  }

  tmTab.run = runScan;
  tmTab.missing = missing.length;

  if (__tmScanSnap && __tmScanSnap.rows && __tmScanSnap.rows.length &&
      __tmScanSnap.at && (Date.now() - __tmScanSnap.at) < (5 * 60 * 1000)){
    state.rows = __tmScanSnap.rows;
    state.golden = __tmScanSnap.goldenCross || [];
    tmTab.hasRun = true;
    renderAll();
    setStatus('restored from cache · ' + trendmxSummaryLine(state.rows, state.golden)
      + ' · age ' + Math.round((Date.now() - __tmScanSnap.at) / 1000) + 's');
  }
}

/* ---------------- exports + tab registration ---------------- */

W.trendScore = trendScore;
W.tmDirOf = tmDirOf;
W.trendmxGateEval = trendmxGateEval;
W.trendmxClassify = trendmxClassify;
W.trendmxPlan = trendmxPlan;
W.trendmxPlanHTML = trendmxPlanHTML;
W.trendmxPlanBlock = trendmxPlanBlock;
W.trendmxConviction = trendmxConviction;
W.trendmxGoldenCrossSetups = trendmxGoldenCrossSetups;
W.trendmxScan = trendmxScan;
W.trendmxWarm = trendmxWarm;
W.trendmxCrossState = function(){
  try{
    if (!__tmScanSnap) return null;
    return {
      at: __tmScanSnap.at,
      scanned: __tmScanSnap.scanned,
      goldenCross: (__tmScanSnap.goldenCross || []).map(function(s){
        return { sym: s.sym, dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1, score: s.score,
          conviction: s.conviction, tier: s.tier, freshCross: s.freshCross };
      })
    };
  }catch(e){ return null; }
};
W.trendmxState = function(){
  try{ return __tmSnap ? JSON.parse(JSON.stringify(__tmSnap)) : null; }catch(e){ return null; }
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'trendmx', label: 'TREND MATRIX', mount: mountTrendMatrix, refresh: refreshTrendMatrix });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'trendmx', label: 'TREND MATRIX', run: trendmxWarm });

})();
