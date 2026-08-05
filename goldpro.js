/* =========================================================================
HARDGATE — goldpro.js
GOLD PRO tab: professional gold context panel.

  1) STRUCTURE            gold 1D close vs EMA50/EMA200, 50/200 cross state
                          (crossedRecently, 15-bar window), 4H EMA20/50/100
                          cascade side.
  2) MACRO LEDGER         DXY 20d trend, US10Y trend, real-rate hint,
                          gold/silver ratio, XAU perp funding (contrarian at
                          extremes), XAU perp retail long% — every row stamped
                          BULL / BEAR / NEUT / N/A *for gold*.
  3) GOLD–DXY CORRELATION Frankfurter daily ECB fixes -> ICE DXY per day via
                          computeDXYfromRates (macro.js), aligned with gold
                          daily closes by UTC date string, Pearson over the
                          last 60 return pairs (correlation, indicators2.js).
                          Needs >= 30 overlapping pairs, else '—'.
  4) VERDICT              STRUCTURAL BULL / STRUCTURAL BEAR / NEUTRAL.

Classic script, loaded AFTER indicators.js / indicators2.js / binance.js /
macro.js. Never throws at load or run time: every external global is
feature-checked, every network call is async with an AbortController timeout,
and every panel degrades independently of the others.

Exports (and ONLY these): window.goldProVerdict (pure classifier, unit-tested),
window.goldProPlan (pure execution-levels builder, unit-tested), plus the
window.HG_tabs registration below.

Hard refresh (index.html hardRefreshAll): the registration carries refresh()
per the house contract — async, NEVER throws, terse status string. It re-runs
runGoldPro on the latest mount; before the first user run it reports
'skipped: not run yet' (a global refresh must never trigger a first-time
multi-source pull on its own), and while a run is in flight it reports 'busy'
(overlaps never double-fetch — ui.running and a module-level flag both guard).
========================================================================= */
(function(){
'use strict';

/* ======================== pure verdict classifier ========================
   Inputs (all nullable / missing-tolerant):
     goldAbove200  bool|null     1D close above the 200D EMA
     crossState    'GOLDEN'|'DEATH'|'NONE'|null   50/200 cross within 15 bars
     dxyTrend      'RISING'|'FALLING'|'FLAT'|null
     tnxTrend      'RISING'|'FALLING'|'FLAT'|null
     realRateHint  'TAILWIND'|'HEADWIND'|'NEUTRAL'|null
     corr          number|null   gold/DXY daily-return correlation
   Scoring: structure (200D side) +/-2, recent cross +/-1, each macro read
   +/-1. When gold and the dollar are decoupled (corr > -0.2) the macro reads
   carry half weight — gold is trading on flows/geopolitics, not the dollar.
   net >= +2.5 -> STRUCTURAL BULL, net <= -2.5 -> STRUCTURAL BEAR.          */
function goldProVerdict(opts){
  opts = opts || {};
  function norm(v){ return (typeof v === 'string') ? v.trim().toUpperCase() : null; }
  var above = (opts.goldAbove200 === true) ? true : ((opts.goldAbove200 === false) ? false : null);
  var cross = norm(opts.crossState);
  var dxy   = norm(opts.dxyTrend);
  var tnx   = norm(opts.tnxTrend);
  var hint  = norm(opts.realRateHint);
  var corr  = (typeof opts.corr === 'number' && isFinite(opts.corr)) ? opts.corr : null;

  var bull = 0, bear = 0;
  var bullWhy = [], bearWhy = [];

  if (above === true){ bull += 2; bullWhy.push('price above the 200D EMA'); }
  else if (above === false){ bear += 2; bearWhy.push('price below the 200D EMA'); }

  if (cross === 'GOLDEN'){ bull += 1; bullWhy.push('recent 50/200D golden cross'); }
  else if (cross === 'DEATH'){ bear += 1; bearWhy.push('recent 50/200D death cross'); }

  var decoupled = (corr !== null && corr > -0.2);
  var macroW = decoupled ? 0.5 : 1;
  if (dxy === 'FALLING'){ bull += macroW; bullWhy.push('DXY 20d trend falling'); }
  else if (dxy === 'RISING'){ bear += macroW; bearWhy.push('DXY 20d trend rising'); }
  if (tnx === 'FALLING'){ bull += macroW; bullWhy.push('US10Y yield falling'); }
  else if (tnx === 'RISING'){ bear += macroW; bearWhy.push('US10Y yield rising'); }
  if (hint === 'TAILWIND'){ bull += macroW; bullWhy.push('real-rate tailwind'); }
  else if (hint === 'HEADWIND'){ bear += macroW; bearWhy.push('real-rate headwind'); }

  var net = bull - bear;
  var word = (net >= 2.5) ? 'STRUCTURAL BULL' : ((net <= -2.5) ? 'STRUCTURAL BEAR' : 'NEUTRAL');

  var regime = decoupled ? ' Gold/DXY decoupled — macro reads at half weight.' : '';
  var why;
  if (!bullWhy.length && !bearWhy.length){
    why = 'Insufficient data — no structure or macro inputs available.' + regime;
  } else if (word === 'NEUTRAL'){
    var parts = [];
    if (bullWhy.length) parts.push('for: ' + bullWhy.join(', '));
    if (bearWhy.length) parts.push('against: ' + bearWhy.join(', '));
    why = 'Mixed evidence (' + parts.join(' | ') + ') — no structural edge.' + regime;
  } else {
    var lead = (word === 'STRUCTURAL BULL') ? bullWhy : bearWhy;
    var contra = (word === 'STRUCTURAL BULL') ? bearWhy : bullWhy;
    why = ((word === 'STRUCTURAL BULL') ? 'Aligned bull evidence: ' : 'Aligned bear evidence: ') + lead.join(', ') + '.';
    if (contra.length) why += ' Against: ' + contra.join(', ') + '.';
    why += regime;
  }
  return { word: word, why: why };
}

/* ================== execution levels (SL/TP audit) ==================
   goldProPlan({dir, entry, atr, swing}) -> levels | null.
   ATR fallback conventions aligned with index.html's goldSetupDecision:
     STOP = the WIDER of 1.5xATR(4H) and the structure stop beyond the swing
            extreme by 0.25xATR, against the direction
     T1 = 2R, T2 = 3.5R.
   `swing` is optional; when it is missing, non-finite, or on the wrong side,
   the plain 1.5xATR stop stands (structural=false). Never throws; null on
   degenerate input. */
function goldProPlan(inp){
  try{
    if (!inp || typeof inp !== 'object') return null;
    var dir = inp.dir;
    if (dir !== 'long' && dir !== 'short') return null;
    var entry = +inp.entry, at = +inp.atr, sw = +inp.swing;
    if (!isFinite(entry) || !isFinite(at)) return null;
    if (!(entry > 0) || !(at > 0)) return null;
    var stopDist = 1.5 * at, structural = false;
    if (isFinite(sw)){
      var structStop = (dir === 'long') ? sw - 0.25 * at : sw + 0.25 * at;
      var rightSide = (dir === 'long') ? structStop < entry : structStop > entry;
      var d = Math.abs(entry - structStop);
      if (rightSide && d > stopDist){ stopDist = d; structural = true; }
    }
    var stop = (dir === 'long') ? entry - stopDist : entry + stopDist;
    var t1 = (dir === 'long') ? entry + 2 * stopDist : entry - 2 * stopDist;
    var t2 = (dir === 'long') ? entry + 3.5 * stopDist : entry - 3.5 * stopDist;
    return { dir: dir, entry: entry, stop: stop, t1: t1, t2: t2,
             risk: stopDist, riskPct: stopDist / entry * 100,
             rr1: 2, rr2: 3.5, structural: structural };
  }catch(e){ return null; }
}

/* ============================ tiny helpers ============================ */
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fnum(n, dp){
  dp = (dp === undefined) ? 2 : dp;
  return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : (+n).toFixed(dp);
}
function signed(n, dp){
  dp = (dp === undefined) ? 1 : dp;
  return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : ((+n >= 0 ? '+' : '') + (+n).toFixed(dp));
}
/* px/fmt live in index.html inline — feature-check, fall back locally. */
function pxF(n){
  if (typeof px === 'function'){ try{ return px(n); }catch(e){} }
  return fnum(n, 2);
}
function kv(k, vHtml){
  return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v">' + vHtml + '</span></div>';
}
function lrow(gid, name, detail, stampCls, stampTxt){
  return '<div class="lrow"><span class="gid">' + esc(gid) + '</span><span class="gname">' + esc(name) + '</span>'
       + '<span class="gdetail">' + esc(detail) + '</span><span class="stamp ' + stampCls + '">' + esc(stampTxt) + '</span></div>';
}
var SRC_LABEL = { 'binance-xau': 'BINANCE XAU', 'binance-paxg': 'BINANCE PAXG', 'twelvedata': 'TWELVE DATA', 'yahoo': 'YAHOO GC=F' };
function srcLabel(src){ return SRC_LABEL[src] || (src ? String(src).toUpperCase() : 'NONE'); }

function setNote(ui, msg, warn){
  if (!ui || !ui.note) return;
  ui.note.textContent = msg;
  ui.note.className = warn ? 'note warn' : 'note';
}
function setP(ui, f){
  if (!ui || !ui.prog) return;
  if (f === null){ ui.prog.style.display = 'none'; return; }
  ui.prog.style.display = 'block';
  var i = ui.prog.firstElementChild;
  if (i) i.style.width = (f*100).toFixed(1) + '%';
}

/* ================= Frankfurter daily DXY series (60s cache) ================= */
var __gpCorrCache = { at: 0, key: null, val: null };
async function fetchDxyRange(fromIso, toIso){
  var key = fromIso + '..' + toIso;
  if (__gpCorrCache.key === key && __gpCorrCache.val && (Date.now() - __gpCorrCache.at) < 60000) return __gpCorrCache.val;
  var url = 'https://api.frankfurter.dev/v1/' + key + '?base=USD&symbols=EUR,JPY,GBP,CAD,SEK,CHF';
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, 12000);
  var j = null;
  try{
    var res = await fetch(url, { signal: ctrl.signal });
    if (res && res.ok) j = await res.json();
  }catch(e){ j = null; }
  finally{ clearTimeout(timer); }
  if (!j || !j.rates) return null; // failures are NOT cached
  var out = {};
  var dts = Object.keys(j.rates).sort();
  for (var i = 0; i < dts.length; i++){
    var v = computeDXYfromRates(j.rates[dts[i]]);
    if (v !== null && isFinite(v)) out[dts[i]] = v;
  }
  // degenerate payloads (<30 fixes) are not cached — they would poison the
  // 60s cache and starve the >=30-pair correlation guard of a retry
  if (Object.keys(out).length >= 30) __gpCorrCache = { at: Date.now(), key: key, val: out };
  return out;
}

/* Align DXY fixes with gold daily closes by UTC date string, build simple
   returns on consecutive overlapping dates, Pearson over the last 60 pairs. */
function computeGoldDxyCorr(goldRows1d, dxyByDate){
  var gmap = {};
  for (var i = 0; i < goldRows1d.length; i++){
    var r = goldRows1d[i];
    if (!r || !isFinite(r.t) || !isFinite(r.c) || !(r.c > 0)) continue;
    gmap[new Date(r.t*1000).toISOString().slice(0, 10)] = r.c;
  }
  var dts = Object.keys(dxyByDate).sort();
  var dxyS = [], goldS = [], usedDts = [];
  for (var k = 0; k < dts.length; k++){
    var d = dts[k];
    if (gmap[d] !== undefined && isFinite(dxyByDate[d]) && dxyByDate[d] > 0){
      dxyS.push(dxyByDate[d]); goldS.push(gmap[d]); usedDts.push(d);
    }
  }
  var n = dxyS.length;
  var dxyR = new Array(n).fill(NaN), goldR = new Array(n).fill(NaN);
  var overlap = 0;
  for (var m = 1; m < n; m++){
    dxyR[m] = dxyS[m]/dxyS[m-1] - 1;
    goldR[m] = goldS[m]/goldS[m-1] - 1;
    if (isFinite(dxyR[m]) && isFinite(goldR[m])) overlap++;
  }
  var corr = NaN;
  if (overlap >= 30 && typeof correlation === 'function') corr = correlation(dxyR, goldR, 60);
  return {
    corr: (typeof corr === 'number') ? corr : NaN,
    overlap: overlap,
    from: usedDts.length ? usedDts[0] : null,
    to: usedDts.length ? usedDts[usedDts.length - 1] : null
  };
}
function corrInterpretation(c){
  if (!isFinite(c)) return '';
  if (c < -0.3) return 'Regime: classic inverse (macro-driven) — the dollar trend is the dominant gold driver right now.';
  if (c > -0.2) return 'Regime: decoupled (flows/geopolitics) — gold is trading on non-dollar drivers; macro reads carry less weight.';
  return 'Regime: weak inverse — transitional zone between macro-driven and flow-driven.';
}

/* ============================ structure state ============================ */
function lastCrossIdx(boolArr){
  for (var i = boolArr.length - 1; i > 0; i--){ if (boolArr[i]) return i; }
  return -1;
}
function structureState(rows1d, rows4h){
  var st = { ok: false, above200: null, distPct: null, crossState: null, crossAgo: null,
             cascade: 'N/A', lastClose: NaN, e50: NaN, e200: NaN };
  if (typeof ema !== 'function') return st;
  var closes = (rows1d || []).map(function(r){ return r.c; });
  var n = closes.length;
  if (n >= 2){
    st.lastClose = closes[n-1];
    var e50 = ema(closes, 50), e200 = ema(closes, 200);
    st.e50 = e50[n-1]; st.e200 = e200[n-1];
    if (isFinite(st.e200) && st.e200 > 0){
      st.above200 = st.lastClose > st.e200;
      st.distPct = (st.lastClose/st.e200 - 1)*100;
    }
    if (typeof crossOver === 'function' && typeof crossUnder === 'function' && typeof crossedRecently === 'function'){
      var co = crossOver(e50, e200), cu = crossUnder(e50, e200);
      var ig = lastCrossIdx(co), id = lastCrossIdx(cu);
      var recentG = crossedRecently(co, 15), recentD = crossedRecently(cu, 15);
      if (recentG && (!recentD || ig > id)){ st.crossState = 'GOLDEN'; st.crossAgo = (n-1) - ig; }
      else if (recentD){ st.crossState = 'DEATH'; st.crossAgo = (n-1) - id; }
      else st.crossState = 'NONE';
    }
    st.ok = true;
  }
  var c4 = (rows4h || []).map(function(r){ return r.c; });
  if (c4.length >= 100){
    var m = c4.length - 1;
    var a = ema(c4, 20)[m], b = ema(c4, 50)[m], d = ema(c4, 100)[m], cc = c4[m];
    if (isFinite(a) && isFinite(b) && isFinite(d)){
      if (cc > a && a > b && b > d) st.cascade = 'LONG';
      else if (cc < a && a < b && b < d) st.cascade = 'SHORT';
      else st.cascade = 'MIXED';
    }
  }
  return st;
}

/* ============================ panel renderers ============================ */
function renderStructurePanel(st, rows1d, rows4h, src){
  var h = '<div class="panel"><h2>STRUCTURE <span>gold 1D vs EMA50/200 · 50/200 cross (15d window) · 4H cascade</span></h2>';
  h += '<div class="row">'
     + '<span class="statuschip">source <b>' + esc(srcLabel(src)) + '</b></span>'
     + '<span class="statuschip">1D bars <b>' + (rows1d ? rows1d.length : 0) + '</b></span>'
     + '<span class="statuschip">4H bars <b>' + (rows4h ? rows4h.length : 0) + '</b></span></div>';
  if (!st.ok) return h + '<div class="note warn" style="margin-top:8px">gold candles unavailable or EMA helpers missing — structure cannot be computed.</div></div>';

  var sideCls = st.above200 === true ? 'pos' : (st.above200 === false ? 'neg' : '');
  var sideTxt = st.above200 === null ? 'n/a (need 200+ daily bars)'
              : '<span class="' + sideCls + '">' + (st.above200 ? 'ABOVE' : 'BELOW') + ' (' + signed(st.distPct, 1) + '%)</span>';
  var crossCls = st.crossState === 'GOLDEN' ? 'pos' : (st.crossState === 'DEATH' ? 'neg' : '');
  var crossTxt = st.crossState === 'GOLDEN' ? 'GOLDEN CROSS · ' + st.crossAgo + 'd ago'
              : (st.crossState === 'DEATH' ? 'DEATH CROSS · ' + st.crossAgo + 'd ago'
              : (st.crossState === 'NONE' ? 'none in last 15d' : 'n/a'));
  var cascCls = st.cascade === 'LONG' ? 'pos' : (st.cascade === 'SHORT' ? 'neg' : '');
  h += '<div style="margin-top:8px">'
     + kv('1D close', esc(pxF(st.lastClose)))
     + kv('EMA 50 (1D)', fnum(st.e50, 2))
     + kv('EMA 200 (1D)', fnum(st.e200, 2))
     + kv('price vs 200D', sideTxt)
     + kv('50/200 cross state', '<span class="' + crossCls + '">' + esc(crossTxt) + '</span>')
     + kv('4H cascade (close vs EMA20/50/100)', '<span class="' + cascCls + '">' + esc(st.cascade) + '</span>')
     + '</div></div>';
  return h;
}

function renderMacroPanel(macro, funding, ls){
  var rows = [];

  // M1 — DXY 20d trend (FALLING dollar = gold BULL)
  var dxy = (macro && macro.dxyOfficial && isFinite(macro.dxyOfficial.value)) ? macro.dxyOfficial
    : ((macro && macro.dxy) ? macro.dxy : null);
  var dxyLbl = (macro && macro.dxyOfficial && isFinite(macro.dxyOfficial.value)) ? 'FRED DTWEXBGS' : 'DXY proxy';
  if (dxy && isFinite(dxy.value)){
    var tr = dxy.trend20 || 'FLAT';
    rows.push(lrow('M1', dxyLbl + ' · dollar index (20d trend)',
      fnum(dxy.value, 2) + ' · ' + tr + (isFinite(dxy.change20Pct) ? ' (' + signed(dxy.change20Pct, 1) + '% over 20d)' : ''),
      tr === 'FALLING' ? 'pass' : (tr === 'RISING' ? 'veto' : 'na'),
      tr === 'FALLING' ? 'BULL' : (tr === 'RISING' ? 'BEAR' : 'NEUT')));
  } else rows.push(lrow('M1', 'DXY · dollar index (20d trend)', 'unavailable', 'na', 'N/A'));

  // M2 — US10Y trend (FALLING yields = gold BULL)
  var tnxTr = macro ? macro.tnxTrend : null;
  var tnxSrc = (macro && macro.tnxSource) ? (' · ' + macro.tnxSource) : '';
  if (macro && isFinite(macro.tnx)){
    rows.push(lrow('M2', 'US 10Y yield (20d trend)',
      fnum(macro.tnx, 2) + '% · ' + (tnxTr || 'FLAT') + (isFinite(macro.tnxChange20Pct) ? ' (' + signed(macro.tnxChange20Pct, 1) + '% rel. 20d)' : '') + tnxSrc,
      tnxTr === 'FALLING' ? 'pass' : (tnxTr === 'RISING' ? 'veto' : 'na'),
      tnxTr === 'FALLING' ? 'BULL' : (tnxTr === 'RISING' ? 'BEAR' : 'NEUT')));
  } else rows.push(lrow('M2', 'US 10Y yield (20d trend)', 'unavailable', 'na', 'N/A'));

  // M3 — real-rate hint
  var hint = macro ? macro.realRateHint : null;
  rows.push(lrow('M3', 'Real-rate hint (DXY × yields)',
    hint === 'TAILWIND' ? 'TAILWIND — dollar and yields falling together'
      : (hint === 'HEADWIND' ? 'HEADWIND — dollar and yields rising together' : (hint === 'NEUTRAL' ? 'NEUTRAL — mixed macro currents' : 'unavailable')),
    hint === 'TAILWIND' ? 'pass' : (hint === 'HEADWIND' ? 'veto' : 'na'),
    hint === 'TAILWIND' ? 'BULL' : (hint === 'HEADWIND' ? 'BEAR' : (hint === 'NEUTRAL' ? 'NEUT' : 'N/A'))));

  // M4 — gold/silver ratio regime (informational, not a directional stamp)
  var gsr = macro ? macro.goldSilverRatio : null;
  if (isFinite(gsr)){
    rows.push(lrow('M4', 'Gold/Silver ratio',
      fnum(gsr, 1) + (gsr > 80 ? ' · >80 — silver historically undervalued; risk-off regime'
                    : (gsr < 70 ? ' · <70 — silver relatively rich; risk-on regime' : ' · mid-range')),
      'na', 'INFO'));
  } else rows.push(lrow('M4', 'Gold/Silver ratio', 'unavailable', 'na', 'N/A'));

  // M5 — XAU perp funding (extremes read contrarian; percent units per 8h)
  if (funding && isFinite(funding.fundingPct)){
    var f = funding.fundingPct;
    rows.push(lrow('M5', 'XAU perp funding (8h)',
      signed(f, 4) + '% / 8h' + (f >= 0.05 ? ' — longs crowded: contrarian bearish lean'
                              : (f <= -0.05 ? ' — shorts crowded: contrarian bullish lean' : ' — normal range')),
      f >= 0.05 ? 'veto' : (f <= -0.05 ? 'pass' : 'na'),
      f >= 0.05 ? 'BEAR' : (f <= -0.05 ? 'BULL' : 'NEUT')));
  } else rows.push(lrow('M5', 'XAU perp funding (8h)', 'unavailable', 'na', 'N/A'));

  // M6 — XAU perp retail positioning (global long/short accounts, 1h)
  var lp = (ls && ls.latest && isFinite(ls.latest.longPct)) ? ls.latest.longPct : null;
  if (lp !== null){
    rows.push(lrow('M6', 'XAU retail long % (1h)',
      fnum(lp, 0) + '% long' + (lp >= 60 ? ' — retail heavily long: contrarian bearish lean'
                             : (lp <= 40 ? ' — retail heavily short: contrarian bullish lean' : ' — balanced')),
      lp >= 60 ? 'veto' : (lp <= 40 ? 'pass' : 'na'),
      lp >= 60 ? 'BEAR' : (lp <= 40 ? 'BULL' : 'NEUT')));
  } else rows.push(lrow('M6', 'XAU retail long % (1h)', 'unavailable', 'na', 'N/A'));

  return '<div class="panel"><h2>MACRO LEDGER <span>stamps read for gold: BULL tailwind · BEAR headwind · NEUT/INFO · N/A</span></h2>'
       + '<div class="ledger">' + rows.join('') + '</div></div>';
}

/* EXECUTION LEVELS panel: exact ENTRY/STOP/T1/T2 for the live 4H gold setup,
   or an honest reason when no levels can be computed. oiflow.js plan markup. */
function goldProCardStack(o){
  try{
    var p = o && o.plan;
    if (!p || typeof hgSetupStackForInlineScan !== 'function') return null;
    return hgSetupStackForInlineScan({
      dir: p.dir, sym: 'XAUUSDT', rows4h: o.rows4h || null, style: 'goldpro', asset: 'gold',
      clean: true, gatesPassed: 7, gatesTotal: 7
    });
  }catch(e){ return null; }
}

function renderLevelsPanel(o){
  var h = '<div class="panel"><h2>EXECUTION LEVELS <span>live 4H gold setup · stop = wider of 1.5×ATR14(4H) / 30-bar swing structure · T1 2R · T2 3.5R</span></h2>';
  if (!o || !o.plan) return h + '<div class="note warn">' + esc((o && o.reason) || 'levels unavailable.') + '</div></div>';
  var p = o.plan;
  if (p && p.dir && typeof hgBookStampSlot === 'function'){
    h = '<div class="panel"><h2>EXECUTION LEVELS <span>live 4H gold setup · stop = wider of 1.5×ATR14(4H) / 30-bar swing structure · T1 2R · T2 3.5R</span>'
      + hgBookStampSlot('XAUUSD', p.dir, { scanner: 'goldpro', strategy: 'goldpro', fund: 'gold', klass: 'metals' })
      + '</h2>';
  } else if (p && p.dir && typeof hgBookStampForMeta === 'function'){
    h = '<div class="panel"><h2>EXECUTION LEVELS <span>live 4H gold setup · stop = wider of 1.5×ATR14(4H) / 30-bar swing structure · T1 2R · T2 3.5R</span>'
      + hgBookStampForMeta('XAUUSD', p.dir, { scanner: 'goldpro', strategy: 'goldpro', fund: 'gold', klass: 'metals' })
      + '</h2>';
  }
  var gpStack = goldProCardStack(o);
  var stackHtml = (gpStack && typeof hgSetupStackMiniHtml === 'function') ? hgSetupStackMiniHtml(gpStack) : '';
  h += '<div class="row">'
     + '<span class="statuschip">dir <b>' + esc(p.dir.toUpperCase()) + '</b></span>'
     + '<span class="statuschip">4H cascade <b>' + esc(String(o.cascade || '').toUpperCase()) + '</b></span>'
     + (o.src ? '<span class="statuschip">src <b>' + esc(o.src) + '</b></span>' : '')
     + (o.rowsN ? '<span class="statuschip">4H bars <b>' + o.rowsN + '</b></span>' : '')
     + '</div>';
  h += '<div class="plan">ENTRY <b>' + esc(pxF(p.entry)) + '</b>'
     + ' · STOP <b>' + esc(pxF(p.stop)) + '</b>'
     + ' · T1 ' + esc(pxF(p.t1)) + ' (' + fnum(p.rr1, 1) + 'R)'
     + ' · T2 ' + esc(pxF(p.t2)) + ' (' + fnum(p.rr2, 1) + 'R)'
     + ' · risk ' + fnum(p.riskPct, 2) + '%'
     + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(p.entry, p.stop) : '')
     + (p.structural ? ' — stop = wider of 1.5×ATR14(4H) / structure beyond the 30-bar swing'
                     : ' — stop = 1.5×ATR14(4H)')
     + '</div>';
  if (o.note) h += '<div class="note" style="margin-top:6px">' + esc(o.note) + '</div>';
  h += stackHtml;
  if (typeof bookBtnHTML === 'function'){
    h += bookBtnHTML('XAUUSD', p.dir, p.entry, p.stop, p.t1, {
      scanner: 'goldpro',
      fund: 'gold',
      strategy: 'goldpro',
      klass: 'metals',
      layers: ['goldpro', '4h-levels'],
      t2: p.t2,
      stack: gpStack
    });
  }
  return h + '</div>';
}

function renderCorrPanel(cr, corrErr){  var h = '<div class="panel"><h2>GOLD–DXY CORRELATION <span>Pearson on daily returns · last 60 pairs · Frankfurter fixes vs gold close</span></h2>';
  if (corrErr) return h + '<div class="note warn">' + esc(corrErr) + '</div></div>';
  if (!isFinite(cr.corr)){
    return h + '<div class="row"><span class="big">—</span>'
         + '<span class="statuschip">pairs <b>' + cr.overlap + '</b></span></div>'
         + '<div class="note" style="margin-top:6px">insufficient overlap: ' + cr.overlap + ' return pairs (need ≥ 30)'
         + (cr.from ? ' across ' + esc(cr.from) + ' → ' + esc(cr.to) : '') + '.</div></div>';
  }
  return h + '<div class="row"><span class="big">' + cr.corr.toFixed(2) + '</span>'
       + '<span class="statuschip">pairs <b>' + Math.min(cr.overlap, 60) + '</b></span>'
       + '<span class="statuschip">window <b>' + esc(cr.from) + ' → ' + esc(cr.to) + '</b></span></div>'
       + '<div class="note" style="margin-top:6px">' + esc(corrInterpretation(cr.corr)) + '</div></div>';
}

function renderVerdictPanel(v){
  var cls = v.word === 'STRUCTURAL BULL' ? 'long' : (v.word === 'STRUCTURAL BEAR' ? 'short' : 'aside');
  return '<div class="panel"><h2>VERDICT <span>structural gold bias — context, not a trade signal</span></h2>'
       + '<div class="verdict ' + cls + '"><span class="vword">' + esc(v.word) + '</span><span class="vwhy">' + esc(v.why) + '</span></div>'
       + '<div class="note" style="margin-top:8px">Context panel for orientation only — not financial advice.</div></div>';
}

/* ============================ scan orchestrator ============================ */
async function runGoldPro(ui){
  if (!ui) return 'skipped: no ui';
  if (ui.running || __gp.busy) return 'busy';
  ui.running = true;
  __gp.busy = true;
  __gp.ranOnce = true;
  __gp.ui = ui;
  if (ui.btn) ui.btn.disabled = true;
  var status = 'refreshed';
  try{
    setNote(ui, 'fetching gold candles (1D ×400, 4H ×200)…');
    setP(ui, 0.05);

    var g1d = { rows: [], source: null }, g4h = { rows: [], source: null };
    if (typeof getGoldCandles === 'function'){
      try{ var a = await getGoldCandles('1d', 400); if (a && a.rows) g1d = a; }catch(e){}
      setP(ui, 0.22);
      try{ var b = await getGoldCandles('4h', 200); if (b && b.rows) g4h = b; }catch(e){}
    }
    setP(ui, 0.35);
    setNote(ui, 'fetching macro dashboard + XAU perp sentiment…');

    var macro = null, funding = null, ls = null;
    var jobs = [];
    if (typeof getGoldMacro === 'function') jobs.push(Promise.resolve(getGoldMacro()).then(function(m){ macro = m; }, function(){}));
    if (typeof binanceFunding === 'function') jobs.push(Promise.resolve(binanceFunding('XAUUSDT')).then(function(f){ funding = f; }, function(){}));
    if (typeof binanceLongShort === 'function') jobs.push(Promise.resolve(binanceLongShort('XAUUSDT', '1h', 1)).then(function(l){ ls = l; }, function(){}));
    if (jobs.length){ try{ await Promise.all(jobs); }catch(e){} }
    setP(ui, 0.6);

    var cr = { corr: NaN, overlap: 0, from: null, to: null }, corrErr = null;
    if (typeof computeDXYfromRates !== 'function') corrErr = 'computeDXYfromRates missing (macro.js) — correlation skipped.';
    else if (typeof correlation !== 'function') corrErr = 'correlation missing (indicators2.js) — correlation skipped.';
    else if (typeof fetch !== 'function') corrErr = 'fetch unavailable — correlation skipped.';
    else if (!g1d.rows.length) corrErr = 'no gold daily closes — correlation skipped.';
    else{
      setNote(ui, 'fetching Frankfurter FX fixes (~90d) for the DXY correlation…');
      var toIso = new Date().toISOString().slice(0, 10);
      var fromIso = new Date(Date.now() - 90*86400000).toISOString().slice(0, 10);
      var dxyByDate = await fetchDxyRange(fromIso, toIso);
      if (!dxyByDate || !Object.keys(dxyByDate).length) corrErr = 'Frankfurter range fetch failed or returned no rates — correlation unavailable.';
      else cr = computeGoldDxyCorr(g1d.rows, dxyByDate);
    }
    setP(ui, 0.85);
    setNote(ui, 'rendering…');

    var st = structureState(g1d.rows, g4h.rows);
    var verdict = goldProVerdict({
      goldAbove200: st.above200,
      crossState: st.crossState,
      dxyTrend: (macro && macro.dxy) ? macro.dxy.trend20 : null,
      tnxTrend: macro ? macro.tnxTrend : null,
      realRateHint: macro ? macro.realRateHint : null,
      corr: isFinite(cr.corr) ? cr.corr : null
    });
    try{ window.__hgGoldProVerdict = {
      word: verdict.word,
      why: verdict.why,
      bias: (verdict.word === 'STRUCTURAL BULL') ? 'long' : ((verdict.word === 'STRUCTURAL BEAR') ? 'short' : null)
    }; }catch(e){}

    var src = g1d.source || g4h.source || null;
    if (ui.srcchip) ui.srcchip.textContent = 'SRC: ' + srcLabel(src);

    if (!g1d.rows.length && !macro && !funding && !ls && corrErr){
      ui.out.innerHTML = '<div class="empty">No gold context data available — every upstream source (gold candles, macro dashboard, XAU perp, Frankfurter) is unreachable. Check network / API keys, then re-run.</div>';
      setNote(ui, 'all sources unavailable — showing empty state.', true);
      setP(ui, null);
      status = 'failed: all sources unavailable';
      return status;
    }

    /* ---- EXECUTION LEVELS: live 4H gold setup with exact ENTRY/STOP/T1/T2.
       Candle preference: window.getCandles('XAUUSDT'|'PAXGUSDT','4h',n) when
       index.html is loaded, else the gold chain rows already fetched above.
       When index.html's goldSetupDecision is reachable it gets the final say:
       its plan levels override, its stand-aside verdict is shown as a warn. */
    var lvPlan = null, lvReason = null, lvNote = null, lvSrc = null, lvRowsN = 0, lvCascade = null;
    if (typeof ema !== 'function' || typeof atr !== 'function'){
      lvReason = 'levels unavailable — the indicator layer (ema/atr) is missing.';
    } else {
      var lvRows = null;
      if (typeof getCandles === 'function'){
        try{ var xa = await getCandles('XAUUSDT', '4h', 200); if (xa && xa.length){ lvRows = xa; lvSrc = 'XAUUSDT perp'; } }catch(e){}
        if (!lvRows){ try{ var xp = await getCandles('PAXGUSDT', '4h', 200); if (xp && xp.length){ lvRows = xp; lvSrc = 'PAXGUSDT perp'; } }catch(e){} }
      }
      if (!lvRows && g4h.rows.length){ lvRows = g4h.rows; lvSrc = srcLabel(g4h.source) + ' gold chain'; }
      if (!lvRows || !lvRows.length){
        lvReason = 'levels unavailable — no 4H gold candles from any source (getCandles XAUUSDT/PAXGUSDT, gold chain).';
      } else {
        lvRowsN = lvRows.length;
        var lc = lvRows.map(function(r){ return r.c; });
        var lm = lc.length - 1;
        var le20 = ema(lc, 20)[lm], le50 = ema(lc, 50)[lm], le100 = ema(lc, 100)[lm];
        var la4 = atr(lvRows, 14)[lm];
        var lclose = lc[lm];
        if (lc.length >= 100 && isFinite(le20) && isFinite(le50) && isFinite(le100) && isFinite(lclose)){
          lvCascade = (lclose > le20 && le20 > le50 && le50 > le100) ? 'long'
                    : ((lclose < le20 && le20 < le50 && le50 < le100) ? 'short' : 'mixed');
        } else lvCascade = 'mixed';
        if (lvCascade !== 'long' && lvCascade !== 'short'){
          lvReason = '4H EMA20/50/100 cascade is ' + String(lvCascade || 'mixed').toUpperCase()
                   + ' — no directional gold setup right now, no live levels.';
        } else if (!(isFinite(la4) && la4 > 0)){
          lvReason = 'levels unavailable — ATR(14) is not computable on the 4H gold series.';
        } else {
          var lswing = (typeof lastSwing === 'function') ? lastSwing(lvRows, lvCascade, 30) : NaN;
          lvPlan = goldProPlan({ dir: lvCascade, entry: lclose, atr: la4, swing: lswing });
          if (!lvPlan){
            lvReason = 'levels unavailable — degenerate 4H inputs.';
          } else if (typeof goldSetupDecision === 'function' && typeof rsi === 'function'){
            try{
              var g9 = ema(lc, 9)[lm], g21 = ema(lc, 21)[lm], g50 = ema(lc, 50)[lm];
              var gcasc = (isFinite(g9) && isFinite(g21) && isFinite(g50))
                ? ((g9 > g21 && g21 > g50) ? 'long' : ((g9 < g21 && g21 < g50) ? 'short' : 'mixed'))
                : 'mixed';
              var dSide = (st.ok && isFinite(st.e50)) ? (st.lastClose > st.e50 ? 'long' : 'short') : null;
              var w5 = g1d.rows.slice(-5);
              var weekRange = (w5.length >= 3)
                ? { hi: Math.max.apply(null, w5.map(function(r){ return r.h; })),
                    lo: Math.min.apply(null, w5.map(function(r){ return r.l; })) }
                : null;
              var gsd = goldSetupDecision({
                casc: gcasc,
                spreadOk: isFinite(g21) && isFinite(g50) && Math.abs(g21 - g50) >= 0.25 * la4,
                dSide: dSide, r4: rsi(lc, 14)[lm],
                macroHint: macro ? macro.realRateHint : null,
                dxyTrend: (macro && macro.dxy) ? macro.dxy.trend20 : null,
                tnxTrend: macro ? macro.tnxTrend : null,
                fundingPct: (funding && isFinite(funding.fundingPct)) ? funding.fundingPct : null,
                retailLongPct: (ls && ls.latest && isFinite(ls.latest.longPct)) ? ls.latest.longPct : null,
                price: lclose, a4: la4, e20: le20,
                swingStop: lswing, weekRange: weekRange
              });
              if (gsd && gsd.aside === false && isFinite(gsd.entry) && isFinite(gsd.stop) &&
                  isFinite(gsd.t1) && isFinite(gsd.t2) && gsd.entry > 0){
                lvPlan = { dir: gsd.dir, entry: gsd.entry, stop: gsd.stop, t1: gsd.t1, t2: gsd.t2,
                           risk: Math.abs(gsd.entry - gsd.stop),
                           riskPct: isFinite(gsd.riskPct) ? gsd.riskPct
                                    : Math.abs(gsd.entry - gsd.stop) / gsd.entry * 100,
                           rr1: 2, rr2: 3.5, structural: true };
                lvNote = 'levels aligned with the GOLD SETUP composite decision ('
                       + (gsd.confidence || 'n/a') + ' confidence · ' + (gsd.entryType || 'market') + ').';
              } else if (gsd && gsd.aside){
                lvNote = 'GOLD SETUP composite says STAND ASIDE — ' + (gsd.reason || '')
                       + ' Levels above are the raw ATR fallback; discretion advised.';
              }
            }catch(e){ /* decision alignment is best-effort */ }
          }
        }
      }
    }

    ui.out.innerHTML = renderStructurePanel(st, g1d.rows, g4h.rows, src)
                     + renderLevelsPanel({ plan: lvPlan, reason: lvReason, note: lvNote,
                                           src: lvSrc, rowsN: lvRowsN, cascade: lvCascade, rows4h: lvRows })
                     + renderMacroPanel(macro, funding, ls)
                     + renderCorrPanel(cr, corrErr)
                     + renderVerdictPanel(verdict);

    var degraded = [];
    if (!g1d.rows.length) degraded.push('gold candles');
    if (!macro) degraded.push('macro');
    if (corrErr) degraded.push('correlation');
    setNote(ui, 'done · ' + new Date().toISOString().slice(11, 19) + ' UTC'
      + (degraded.length ? ' — degraded: ' + degraded.join(', ') + ' unavailable' : ''), degraded.length > 0);
    setP(ui, 1);
    setTimeout(function(){ setP(ui, null); }, 600);
  }catch(e){
    try{
      setNote(ui, 'unexpected error: ' + ((e && e.message) ? e.message : String(e)), true);
      setP(ui, null);
    }catch(_){}
    status = 'failed: ' + ((e && e.message) ? e.message : String(e));
  }finally{
    ui.running = false;
    __gp.busy = false;
    if (ui.btn) ui.btn.disabled = false;
  }
  return status;
}

/* ==================== HARD REFRESH support ====================
   House refresh contract (index.html hardRefreshAll): async, NEVER throws,
   terse status — 'busy' while a run is in flight (ui.running + a module-level
   flag, so overlapping invocations never double-fetch), 'skipped: not run
   yet' before the first user run (a global refresh must never trigger a
   first-time multi-source pull on its own), otherwise re-runs runGoldPro on
   the latest mount and returns its status. Every upstream leg inside
   runGoldPro is individually isolated, so a refresh can degrade panels but
   never rejects. */
var __gp = { busy: false, ranOnce: false, ui: null };
async function refreshGoldPro(){
  try{
    var ui = __gp.ui;
    if (__gp.busy || (ui && ui.running)) return 'busy';
    if (!__gp.ranOnce || !ui) return 'skipped: not run yet';
    return await runGoldPro(ui);
  }catch(e){
    return 'error: ' + ((e && e.message) ? e.message : String(e));
  }
}

/* ============================ tab registration ============================ */
function mount(el){
  if (!el) return;
  el.innerHTML =
    '<div class="panel">'
    + '<h2>GOLD PRO <span>structure · macro ledger · dxy correlation · verdict</span></h2>'
    + '<div class="row">'
    + '<button class="btn" data-gp="run">RUN GOLD PRO</button>'
    + '<span class="chip on" data-gp="srcchip">SRC: —</span>'
    + '</div>'
    + '<div class="note" data-gp="note">idle — pulls gold 1D/4H candles, the macro dashboard (DXY / US10Y / silver / real-rate hint), XAU perp sentiment and a 90-day gold/DXY correlation.</div>'
    + '<div class="prog" data-gp="prog"><i></i></div>'
    + '<div data-gp="out"></div>'
    + '</div>';

  var ui = {
    btn: el.querySelector('[data-gp="run"]'),
    note: el.querySelector('[data-gp="note"]'),
    prog: el.querySelector('[data-gp="prog"]'),
    out: el.querySelector('[data-gp="out"]'),
    srcchip: el.querySelector('[data-gp="srcchip"]'),
    running: false
  };
  __gp.ui = ui;   // latest mount wins for the hard-refresh contract

  var missing = [];
  if (typeof getGoldCandles !== 'function') missing.push('getGoldCandles(macro.js)');
  if (typeof getGoldMacro !== 'function') missing.push('getGoldMacro(macro.js)');
  if (typeof ema !== 'function') missing.push('ema(indicators.js)');
  if (typeof correlation !== 'function') missing.push('correlation(indicators2.js)');
  if (typeof computeDXYfromRates !== 'function') missing.push('computeDXYfromRates(macro.js)');
  if (missing.length) setNote(ui, 'missing globals: ' + missing.join(', ') + ' — affected panels will degrade gracefully.', true);

  if (ui.btn) ui.btn.addEventListener('click', function(){ return runGoldPro(ui); });
}

if (typeof window !== 'undefined'){
  window.goldProVerdict = goldProVerdict;
  window.goldProPlan = goldProPlan;
  window.goldProState = function(){
    try{ return window.__hgGoldProVerdict || null; }catch(e){ return null; }
  };
  window.HG_tabs = window.HG_tabs || [];
  window.HG_tabs.push({ id: 'goldpro', label: 'GOLD PRO', mount: mount, refresh: refreshGoldPro });
}
})();
