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
      /* A cross on the daily bar that is still forming does not count. */
      var dClosed = tmClosedRows(rows1d, 86400);
      var cClosed = dClosed.map(function(r){ return r ? r.c : NaN; });
      var e50c = ema(cClosed, 50), e200c = ema(cClosed, 200);
      if (crossedRecently(crossOver(e50c, e200c), 10)) out.freshCross = 'GOLDEN';
      else if (crossedRecently(crossUnder(e50c, e200c), 10)) out.freshCross = 'DEATH';

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
      /* hg-v1019: THE MOMENTUM WITNESS rides the same 1D tape — RSI(14) as
         EVIDENCE. NOT a sixth composite leg: the score sum below is
         byte-identical, so every recorded tmScore stays on its own scale
         (the hg-v1012 rule). rsi missing -> NaN, and NaN holds nothing off
         (hg-v700 honest degradation). */
      if (typeof rsi === 'function'){
        var r1d = rsi(c1, 14);
        out.rsi = (r1d && r1d.length) ? r1d[r1d.length - 1] : NaN;
      }
      /* hg-v1020: THE VOLUME WITNESS rides the same 1D tape — OBV
         divergence as EVIDENCE, the momentum witness's own seam. Never a
         composite leg (the hg-v1012 rule); a tape that cannot speak stamps
         nulls, and nulls hold nothing off. */
      var vw1020 = tmVolWitness(rows1d);
      out.volDiv = vw1020.div;
      out.volConf = vw1020.conf;
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
var CHUNK = 8;               // eight contracts at a time; three timeframes share the wave
var CHUNK_SLEEP_MS = 40;

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
  /* WHERE PRICE IS, carried with the plan. trendmxTicker already derives
     exactly this — inp.price, else the last 4h close — for the gate
     evaluation; the plan just never kept it, so the card could not tell
     whether price had already walked through the levels it was drawing.
     Positive finite only: an unknown mark stays absent and renders no
     verdict rather than a wrong one. */
  if (plan.mark == null && extra){
    var tmMark = isFinite(+extra.price) ? +extra.price
      : ((extra.rows4h && extra.rows4h.length) ? +extra.rows4h[extra.rows4h.length - 1].c : NaN);
    if (isFinite(tmMark) && tmMark > 0) plan.mark = tmMark;
  }
  if (!plan.planSrc) plan.planSrc = 'trendmx';
  if (typeof W.hgOmniPrincipalApply === 'function'){
    try{
      W.hgOmniPrincipalApply(plan, {
        tab: 'trendmx', rows: extra && extra.rows4h, strategy: 'trendmx', dir: plan.dir
      });
      if (plan.demoted || plan.deskEdgeAction === 'suppress') plan.omniDemoted = true;
    }catch(eOm){}
  }
  return plan;
}

/* window.trendmxPlan({dir?|score?, cls?, rows4h, rows1h?, entry?}) -> plan|null.
   Pure: no DOM, no network, every global feature-checked, never throws.
   window.smartSetup (index.html) is preferred when available; otherwise the
   house fallback: entry = last 4h close, stop = lastSwing(4h,30) structure
   within 2.5xATR else 1.5xATR against dir, T1 = 2R, T2 = 3.5R. null when
   there is no majority direction or levels cannot be computed honestly. */

function tmBaseOf(inp){
  var b = String((inp && (inp.base || inp.sym)) || '').toUpperCase();
  return b.replace(/^B-/, '').replace(/_USDT$/, '').replace(/USDT$/, '');
}
function tmAltLongBlockedByBtc(inp){
  if (tmBaseOf(inp) === 'BTC') return false;
  return !!((__tmMacro && __tmMacro.btcStructure === 'down'));
}
function trendmxStampBtcStructure(rows){
  var st = null;
  if (Array.isArray(rows)){
    for (var i = 0; i < rows.length; i++){
      if (tmBaseOf(rows[i]) !== 'BTC') continue;
      try{ st = tmStructureDir(rows[i].rows4h); }catch(eSt){ st = null; }
      if (st) break;
    }
  }
  var prev = __tmMacro || {};
  trendmxMacroSet({ btcFunding: prev.btcFunding != null ? prev.btcFunding : null, btcStructure: st });
  return st;
}
function tmAtrLast(rows){
  try{
    if (!rows || typeof atr !== 'function') return NaN;
    var a = atr(rows, 14);
    if (!a || !a.length) return NaN;
    var v = a[a.length - 1];
    return isFinite(v) ? v : NaN;
  }catch(e){ return NaN; }
}
function tmEmaLast(closes, len){
  if (typeof ema !== 'function' || !closes) return NaN;
  var series = ema(closes, len);
  if (!series || !series.length) return NaN;
  var v = series[series.length - 1];
  return isFinite(v) ? v : NaN;
}
/* A fresh cross is not filled at the print. The order is a limit at the
   nearer 4h EMA that price has to come back to. If price is already through
   both, the pullback has happened and the last close is the entry. The
   limit dies if it is not tagged within 6 four-hour bars. */
function trendmxApplyCrossLimit(plan, inp, dir){
  if (!plan) return null;
  var kind = inp && inp.freshCross;
  if (kind !== 'GOLDEN' && kind !== 'DEATH') return plan;
  var rows = inp.rows4h;
  if (!rows || rows.length < 21) return plan;
  var closes = rows.map(function(r){ return r ? r.c : NaN; });
  var px = closes[closes.length - 1];
  var e9 = tmEmaLast(closes, 9), e21 = tmEmaLast(closes, 21);
  if (!isFinite(px)) return plan;
  var cands = [];
  if (dir === 'long'){
    if (isFinite(e9) && e9 < px) cands.push(['EMA9', e9]);
    if (isFinite(e21) && e21 < px) cands.push(['EMA21', e21]);
  } else {
    if (isFinite(e9) && e9 > px) cands.push(['EMA9', e9]);
    if (isFinite(e21) && e21 > px) cands.push(['EMA21', e21]);
  }
  var entry = px, emaName = 'MARKET', entryType = 'MARKET';
  if (cands.length){
    cands.sort(function(a, b){ return Math.abs(a[1] - px) - Math.abs(b[1] - px); });
    entry = cands[0][1];
    emaName = cands[0][0];
    entryType = 'LIMIT';
  }
  var stop = plan.stop;
  var a = tmAtrLast(rows);
  if (dir === 'long' && !(entry > stop) && isFinite(a) && a > 0) stop = entry - 1.5 * a;
  if (dir === 'short' && !(stop > entry) && isFinite(a) && a > 0) stop = entry + 1.5 * a;
  var risk = dir === 'long' ? entry - stop : stop - entry;
  if (!(risk > 0)) return plan;
  var bit = entryType === 'LIMIT'
    ? ('LIMIT @ 4h ' + emaName + ' · cancel if not tagged in 6×4h')
    : 'price already at the 4h EMAs';
  return Object.assign({}, plan, {
    entry: entry, stop: stop,
    t1: dir === 'long' ? entry + 2 * risk : entry - 2 * risk,
    t2: dir === 'long' ? entry + 3.5 * risk : entry - 3.5 * risk,
    rr1: 2, rr2: 3.5, riskPct: risk / entry * 100,
    entryType: entryType, limitEma: emaName,
    note: (plan.note ? plan.note + ' · ' : '') + bit
  });
}

function trendmxPlan(inp){
  try{
    inp = inp || {};
    var dir = tmDirOf(inp);
    if (!dir) return null;
    if (dir === 'long' && tmAltLongBlockedByBtc(inp)) return null;
    var plan = null;
    if (typeof hgBestLevels === 'function'){
      var gate = inp.gate || trendmxGateEval(inp, dir);
      var bl = hgBestLevels(Object.assign({}, inp, {
        tab: 'trendmx', style: 'swing', dir: dir, gate: gate,
      }));
      if (bl && bl.ok && bl.plan && tmValidSetup(bl.plan)){
        plan = trendmxAttachMeta(bl.plan, bl.gate || gate, { formationScore: bl.formationScore, rows4h: inp.rows4h, price: inp.price });
      } else if (bl && bl.veto) return null;
    }
    if (!plan) plan = trendmxPlanLegacy(inp);
    return trendmxApplyCrossLimit(plan, inp, dir);
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
          return trendmxAttachMeta(fm.hit, gate, { formationScore: fm.formationScore, rows4h: rows, price: inp.price });
        }
      }catch(eForm){}
    }

    /* 2) swing clean plan from cryptogates */
    if (typeof hgSwingCleanPlan === 'function'){
      try{
        var sc = hgSwingCleanPlan(rows, ticker, dir);
        if (tmValidSetup(sc)) return trendmxAttachMeta(sc, gate, { rows4h: rows, price: inp.price });
      }catch(eSc){}
    }

    /* 3) structure-based hgPlanLevels with min R:R */
    if (typeof hgPlanLevelsCore === 'function'){
      try{
        var pl = hgPlanLevelsCore(dir, rows, null, { minRr: TM_MIN_RR, style: 'swing', type: 'TRENDMX' });
        if (tmValidSetup(pl)) return trendmxAttachMeta(pl, gate, { rows4h: rows, price: inp.price });
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
