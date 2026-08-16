/* =========================================================================
HARDGATE — contract-report.js
FULL CONTRACT REPORT: one symbol, put through every strategy, gate and
indicator the app ships, in one page.

The SEARCH tab was a lookup — price, funding, turnover, and nothing else. It
answered "does this contract exist" and never "what does the app think of
it". This runs the whole desk against a single contract and shows what each
engine says, including the ones that say nothing.

Design rules, the same ones the rest of the app is held to:

  - An engine that could not run reads UNCHECKED, never PASS and never a
    silent absence. A missing module, thin candles or a throw are all
    reported by name, because "no signal" and "never ran" are different
    answers and only one of them is evidence.
  - Every R:R shown is derived from the entry, stop and target on the same
    row. A ratio is never carried from whatever the engine happened to have
    in its object.
  - Nothing here vetoes, ranks or trades. It reports. The desks decide.
  - Never throws: every engine call is isolated, so one broken module costs
    its own row and not the report.

Exports: hgContractReportRun (async), hgContractReportHTML, hgContractReportCSS
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

/* +null and +'' are both 0 and isFinite lets them through — the trap that has
   produced fabricated numbers repeatedly in this codebase. */
function num(v){ return (v === null || v === undefined || v === '') ? NaN : +v; }
function fin(v){ var n = num(v); return (typeof n === 'number' && isFinite(n)) ? n : NaN; }
function has(n){ try{ return typeof W[n] === 'function'; }catch(e){ return false; } }
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function errText(e){ try{ return (e && e.message) ? String(e.message) : String(e); }catch(e2){ return 'error'; } }
function px(n){
  var v = fin(n);
  if (!isFinite(v)) return '—';
  var a = Math.abs(v);
  var d = a >= 1000 ? 2 : a >= 100 ? 3 : a >= 1 ? 4 : 6;
  return v.toFixed(d);
}
function nf(n, d){
  var v = fin(n);
  return isFinite(v) ? v.toFixed(d === undefined ? 2 : d) : '—';
}

/* ---- the one arithmetic rule: a ratio belongs to the levels beside it ---- */
function rrOf(entry, stop, target){
  var e = fin(entry), s = fin(stop), t = fin(target);
  if (!isFinite(e) || !isFinite(s) || !isFinite(t)) return null;
  var risk = Math.abs(e - s);
  if (!(risk > 0)) return null;
  return Math.abs(t - e) / risk;
}

/* A row every engine produces, in one shape so the reader can compare them. */
function row(name, o){
  o = o || {};
  return {
    name: name,
    state: o.state || 'idle',            /* signal | idle | unchecked | error */
    dir: o.dir || null,
    detail: o.detail || '',
    entry: isFinite(fin(o.entry)) ? fin(o.entry) : null,
    stop: isFinite(fin(o.stop)) ? fin(o.stop) : null,
    t1: isFinite(fin(o.t1)) ? fin(o.t1) : null,
    t2: isFinite(fin(o.t2)) ? fin(o.t2) : null,
    rr: rrOf(o.entry, o.stop, o.t1),
    rr2: rrOf(o.entry, o.stop, o.t2),
    gates: Array.isArray(o.gates) ? o.gates : null,
    passed: isFinite(fin(o.passed)) ? fin(o.passed) : null,
    total: isFinite(fin(o.total)) ? fin(o.total) : null,
    why: o.why || null
  };
}
function unchecked(name, why){ return row(name, { state: 'unchecked', detail: why }); }

/* Run one engine in isolation. A throw costs this row, not the report. */
function attempt(name, need, fn){
  var missing = [];
  for (var i = 0; i < need.length; i++) if (!has(need[i])) missing.push(need[i]);
  if (missing.length){
    return unchecked(name, 'module not loaded: ' + missing.join(', '));
  }
  try{
    var r = fn();
    return r || row(name, { state: 'idle', detail: 'no signal on this data' });
  }catch(e){
    return row(name, { state: 'error', detail: 'threw: ' + errText(e) });
  }
}

function dirOf(v){
  var d = String(v || '').toLowerCase();
  return (d === 'long' || d === 'short') ? d : null;
}

/* ==================== indicators ==================== */

function indicatorReads(rows4h, rows1h, rows15m){
  var out = [];
  function add(label, value, note){ out.push({ label: label, value: value, note: note || '' }); }
  if (!rows4h || rows4h.length < 30){
    return [{ label: 'indicators', value: 'UNCHECKED', note: 'needs 30+ 4h bars, have ' + ((rows4h && rows4h.length) || 0) }];
  }
  var c = rows4h.map(function(r){ return fin(r.c); }).filter(function(x){ return isFinite(x); });
  var last = c[c.length - 1];

  function lastOf(arr){ return (arr && arr.length) ? fin(arr[arr.length - 1]) : NaN; }

  try{
    if (has('ema')){
      var e21 = lastOf(W.ema(c, 21)), e50 = lastOf(W.ema(c, 50)), e200 = lastOf(W.ema(c, 200));
      add('EMA 21 / 50 / 200 (4h)', nf(e21, 4) + ' / ' + nf(e50, 4) + ' / ' + nf(e200, 4),
        (isFinite(e50) && isFinite(e200))
          ? (e50 > e200 ? 'bull stack' : (e50 < e200 ? 'bear stack' : 'flat'))
          : 'not enough bars for the 200');
      add('price vs EMA200', isFinite(e200) ? (last > e200 ? 'above' : 'below') : 'UNCHECKED',
        isFinite(e200) ? nf(((last - e200) / e200) * 100, 2) + '%' : 'needs 200 bars');
    } else add('EMA', 'UNCHECKED', 'indicators.js not loaded');
  }catch(e){ add('EMA', 'ERROR', errText(e)); }

  try{
    if (has('rsi')){
      var r14 = lastOf(W.rsi(c, 14));
      add('RSI(14) 4h', nf(r14, 1), isFinite(r14) ? (r14 >= 70 ? 'overbought' : (r14 <= 30 ? 'oversold' : 'mid')) : '');
    }
  }catch(e){ add('RSI', 'ERROR', errText(e)); }

  try{
    if (has('atr')){
      var a = lastOf(W.atr(rows4h, 14));
      add('ATR(14) 4h', nf(a, 4), isFinite(a) && last > 0 ? nf(a / last * 100, 2) + '% of price' : '');
    }
  }catch(e){ add('ATR', 'ERROR', errText(e)); }

  try{ if (has('adx')){ var ax = W.adx(rows4h, 14); var av = lastOf(Array.isArray(ax) ? ax : (ax && ax.adx));
    add('ADX(14) 4h', nf(av, 1), isFinite(av) ? (av >= 25 ? 'trending' : 'rangebound') : ''); } }catch(e){ add('ADX', 'ERROR', errText(e)); }

  try{ if (has('macdHist')){ var mh = lastOf(W.macdHist(c));
    add('MACD histogram 4h', nf(mh, 5), isFinite(mh) ? (mh > 0 ? 'positive' : 'negative') : ''); } }catch(e){ add('MACD', 'ERROR', errText(e)); }

  try{ if (has('bollingerPercentB')){ var pb = lastOf(W.bollingerPercentB(c, 20, 2));
    add('Bollinger %B 4h', nf(pb, 2), isFinite(pb) ? (pb > 1 ? 'above upper band' : (pb < 0 ? 'below lower band' : 'inside bands')) : ''); } }catch(e){ add('Bollinger', 'ERROR', errText(e)); }

  try{ if (has('ttmSqueeze')){ var sq = W.ttmSqueeze(rows4h);
    var on = sq && (sq.squeeze === true || sq.on === true || sq.inSqueeze === true);
    add('TTM squeeze 4h', sq ? (on ? 'ON — compression' : 'off') : 'UNCHECKED', sq ? '' : 'no reading'); } }catch(e){ add('TTM squeeze', 'ERROR', errText(e)); }

  try{ if (has('volZ')){ var vz = W.volZ(rows4h, 20); var vzv = fin(typeof vz === 'number' ? vz : lastOf(vz));
    add('volume z-score 4h', nf(vzv, 2), isFinite(vzv) ? (vzv >= 1 ? 'expansion' : (vzv <= -1 ? 'dry' : 'normal')) : ''); } }catch(e){ add('volume z', 'ERROR', errText(e)); }

  try{ if (has('kaufmanER')){ var er = fin(W.kaufmanER(rows4h, 20));
    add('Kaufman efficiency 4h', nf(er, 3), isFinite(er) ? (er >= 0.45 ? 'trend' : (er < 0.25 ? 'chop' : 'mixed')) : ''); } }catch(e){ add('Kaufman ER', 'ERROR', errText(e)); }

  try{ if (has('cusumLast')){ var ev = W.cusumLast(c.slice(-120), 1);
    add('CUSUM last event', ev ? (String(ev.dir || '?') + ' ' + (ev.barsAgo != null ? ev.barsAgo + ' bars ago' : '')) : 'none in 120 bars', ''); } }catch(e){ add('CUSUM', 'ERROR', errText(e)); }

  try{ if (has('detectRegime')){ var dr = W.detectRegime(rows4h);
    add('regime (4h)', dr ? String(dr.label || dr.regime || '—') : 'UNCHECKED', ''); } }catch(e){ add('regime', 'ERROR', errText(e)); }

  try{ if (has('ichimokuState')){ var ic = W.ichimokuState(rows4h);
    add('Ichimoku', ic ? String(ic.state || ic.label || '—') : 'UNCHECKED', ''); } }catch(e){ add('Ichimoku', 'ERROR', errText(e)); }

  try{ if (has('hgAtrPercentile')){ var ap = fin(W.hgAtrPercentile(rows4h, 14, 100));
    add('ATR percentile (100 bars)', isFinite(ap) ? nf(ap * (ap <= 1 ? 100 : 1), 0) + 'th' : '—', ''); } }catch(e){ add('ATR percentile', 'ERROR', errText(e)); }

  try{ if (has('stochRsi')){ var sr = lastOf(W.stochRsi(c, 14));
    add('Stoch RSI 4h', nf(sr, 2), ''); } }catch(e){ add('Stoch RSI', 'ERROR', errText(e)); }

  try{ if (has('donchian')){ var dc = W.donchian(rows4h, 20);
    add('Donchian(20) 4h', dc ? px(dc.lower) + ' … ' + px(dc.upper) : 'UNCHECKED', ''); } }catch(e){ add('Donchian', 'ERROR', errText(e)); }

  if (rows1h && rows1h.length >= 30){
    try{ if (has('ema')){ var c1 = rows1h.map(function(r){ return fin(r.c); });
      var h21 = lastOf(W.ema(c1, 21));
      add('1h EMA21', nf(h21, 4), isFinite(h21) ? (fin(rows1h[rows1h.length - 1].c) > h21 ? 'price above' : 'price below') : ''); } }catch(e){}
  } else add('1h reads', 'UNCHECKED', 'needs 30+ 1h bars, have ' + ((rows1h && rows1h.length) || 0));

  if (rows15m && rows15m.length >= 30){
    try{ if (has('rsi')){ var c15 = rows15m.map(function(r){ return fin(r.c); });
      add('15m RSI(14)', nf(lastOf(W.rsi(c15, 14)), 1), ''); } }catch(e){}
  } else add('15m reads', 'UNCHECKED', 'needs 30+ 15m bars, have ' + ((rows15m && rows15m.length) || 0));

  return out;
}

/* ==================== strategies ==================== */

function cryptoGateRows(rows4h, rows1h, rows15m, ticker){
  var out = [];

  out.push(attempt('SWING gate matrix (G1–G7)', ['swingGateMatrix'], function(){
    var m = W.swingGateMatrix(rows4h, ticker);
    if (!m || !m.dir) return row('SWING gate matrix (G1–G7)', { state: 'idle', detail: 'no aligned direction' });
    return row('SWING gate matrix (G1–G7)', {
      state: m.clean ? 'signal' : 'idle', dir: m.dir,
      passed: m.passed, total: m.gatesTotal || 7,
      entry: m.entry, stop: m.stop,
      gates: (m.gates || []).map(function(g){ return { id: g[0], pass: !!g[1] }; }),
      detail: m.clean ? 'CLEAN 7/7' : (m.passed + '/' + (m.gatesTotal || 7) + ' gates')
    });
  }));

  out.push(attempt('SWING clean plan', ['swingTryClean'], function(){
    var h = W.swingTryClean(rows4h, ticker);
    if (!h) return row('SWING clean plan', { state: 'idle', detail: 'gates not all clean' });
    return row('SWING clean plan', { state: 'signal', dir: h.dir, entry: h.entry, stop: h.stop,
      t1: h.t1, t2: h.t2, detail: h.entryType || h.planSrc || 'clean ticket' });
  }));

  out.push(attempt('SWING near-clean watch', ['swingTryNear'], function(){
    var n = W.swingTryNear(rows4h, ticker);
    if (!n) return row('SWING near-clean watch', { state: 'idle', detail: 'not within one gate' });
    return row('SWING near-clean watch', { state: 'signal', dir: n.dir, passed: n.passed, total: 7,
      detail: 'missing: ' + ((n.missing || []).join(', ') || '—') });
  }));

  var mins = 120;
  try{ if (has('tickClock')) mins = W.tickClock(); }catch(e){}

  out.push(attempt('SCALP gate matrix', ['scalpGateMatrix'], function(){
    if (!rows1h || !rows15m || rows1h.length < 60 || rows15m.length < 60){
      return unchecked('SCALP gate matrix', 'needs 60+ 1h and 15m bars, have '
        + ((rows1h && rows1h.length) || 0) + ' / ' + ((rows15m && rows15m.length) || 0));
    }
    var s = W.scalpGateMatrix(rows1h, rows15m, ticker, mins);
    if (!s || !s.dir) return row('SCALP gate matrix', { state: 'idle', detail: 'no aligned direction' });
    return row('SCALP gate matrix', { state: s.clean ? 'signal' : 'idle', dir: s.dir,
      passed: s.passed, total: s.gatesTotal || 7, entry: s.entry, stop: s.stop,
      gates: (s.gates || []).map(function(g){ return { id: g[0], pass: !!g[1] }; }),
      detail: s.clean ? 'CLEAN' : (s.passed + '/' + (s.gatesTotal || 7) + ' gates') });
  }));

  out.push(attempt('SCALP clean plan', ['scalpTryClean'], function(){
    if (!rows1h || !rows15m || rows1h.length < 60 || rows15m.length < 60){
      return unchecked('SCALP clean plan', 'needs 60+ 1h and 15m bars');
    }
    var h = W.scalpTryClean(rows1h, rows15m, ticker, mins);
    if (!h) return row('SCALP clean plan', { state: 'idle', detail: 'gates not all clean' });
    return row('SCALP clean plan', { state: 'signal', dir: h.dir, entry: h.entry, stop: h.stop,
      t1: h.t1, t2: h.t2, detail: h.entryType || 'clean scalp ticket' });
  }));

  out.push(attempt('EDGE', ['edgeSignal'], function(){
    var bias = has('edgeSwingBias') ? W.edgeSwingBias(rows4h) : null;
    var sig = W.edgeSignal(rows4h);
    if (!sig || !sig.dir) return row('EDGE', { state: 'idle', detail: bias ? 'bias only, no trigger' : 'no trigger' });
    var res = row('EDGE', { state: 'signal', dir: sig.dir, entry: sig.entry, stop: sig.stop,
      t1: sig.t1, t2: sig.t2, detail: sig.kind || sig.label || 'edge trigger' });
    if (has('edgeAssess')){
      try{
        var ea = W.edgeAssess(rows4h, { sym: (ticker && ticker.symbol) || '', exchange: 'search' }, 'search');
        if (ea) res.detail += ' · tally ' + (ea.tally != null ? ea.tally : '—');
      }catch(e){}
    }
    return res;
  }));

  out.push(attempt('SQUEEZE', ['squeezeClassify'], function(){
    var s = W.squeezeClassify(rows4h, rows1h || rows4h);
    if (!s) return row('SQUEEZE', { state: 'idle', detail: 'no reading' });
    var d = /LONG/.test(String(s.state)) ? 'long' : (/SHORT/.test(String(s.state)) ? 'short' : null);
    return row('SQUEEZE', { state: d ? 'signal' : 'idle', dir: d, detail: String(s.state || s.label || '—') });
  }));

  out.push(attempt('TREND MATRIX', ['trendmxClassify'], function(){
    var t = W.trendmxClassify(rows4h, rows1h || rows4h);
    if (!t) return row('TREND MATRIX', { state: 'idle', detail: 'no reading' });
    return row('TREND MATRIX', { state: dirOf(t.dir) ? 'signal' : 'idle', dir: dirOf(t.dir),
      detail: String(t.label || t.state || t.score || '—') });
  }));

  out.push(attempt('MEAN REVERSION', ['mrSignal'], function(){
    var m = W.mrSignal(rows4h);
    if (!m || !m.dir) return row('MEAN REVERSION', { state: 'idle', detail: 'no stretch' });
    return row('MEAN REVERSION', { state: 'signal', dir: m.dir, entry: m.entry, stop: m.stop,
      t1: m.t1, detail: m.kind || 'mean reversion' });
  }));

  out.push(attempt('REVERSAL SNIPER', ['rsAssess'], function(){
    var r = W.rsAssess(rows4h, rows1h || rows4h, ticker);
    if (!r || !r.dir) return row('REVERSAL SNIPER', { state: 'idle', detail: 'no reversal structure' });
    return row('REVERSAL SNIPER', { state: 'signal', dir: r.dir, entry: r.entry, stop: r.stop,
      t1: r.t1, t2: r.t2, detail: r.kind || r.label || 'reversal' });
  }));

  out.push(attempt('LIQUIDITY FLUSH', ['liqFlushSetup'], function(){
    var l = W.liqFlushSetup(rows4h, ticker);
    if (!l || !l.dir) return row('LIQUIDITY FLUSH', { state: 'idle', detail: 'no flush' });
    return row('LIQUIDITY FLUSH', { state: 'signal', dir: l.dir, entry: l.entry, stop: l.stop,
      t1: l.t1, detail: l.note || 'liquidity flush' });
  }));

  return out;
}

function pineRows(rows4h){
  var SCRIPTS = [
    ['SMC (CHoCH/FVG)',      'pineSmcCore'],
    ['Market structure break', 'pineMsbOb'],
    ['Half Trend',           'pineHalfTrend'],
    ['Squeeze momentum',     'pineSqueezeMomentum'],
    ['Range filter',         'pineRangeFilter'],
    ['Nadaraya-Watson',      'pineNwEnvelope'],
    ['VuManChu Cipher',      'pineVumanchuCipher'],
    ['Smart money flow',     'pineSmartMoneyFlow'],
    ['Weekly anchored VWAP', 'pineWeeklyAvwap'],
    ['Lorentzian kernel',    'pineLorentzianKernel']
  ];
  var opts = (W.PINE_SCAN_OPTS && typeof W.PINE_SCAN_OPTS === 'object')
    ? W.PINE_SCAN_OPTS : { includeContext: true, recentBars: 5 };
  return SCRIPTS.map(function(s){
    return attempt('PINE · ' + s[0], [s[1]], function(){
      var r = W[s[1]](rows4h, opts);
      if (!r) return row('PINE · ' + s[0], { state: 'idle', detail: 'no reading on this history' });
      var d = dirOf(r.dir);
      if (!d) return row('PINE · ' + s[0], { state: 'idle', detail: 'no direction' });
      /* Three of the pine tabs read the detector's own levels straight
         through; only report them when they are real numbers. */
      var e = fin(r.entry), st = fin(r.stop);
      var usable = isFinite(e) && isFinite(st) && e !== st;
      return row('PINE · ' + s[0], {
        state: 'signal', dir: d,
        entry: usable ? e : null, stop: usable ? st : null,
        t1: usable ? r.t1 : null, t2: usable ? r.t2 : null,
        detail: (r.newLong || r.newShort) ? 'fresh flip' : 'context',
        why: usable ? null : 'detector gave no usable levels — direction only'
      });
    });
  });
}

function structureRows(rows4h, dirHint){
  var out = [];
  var d = dirOf(dirHint) || 'long';
  out.push(attempt('Order block', ['hgDetectOrderBlock'], function(){
    var ob = W.hgDetectOrderBlock(rows4h, d);
    if (!ob) return row('Order block', { state: 'idle', detail: 'none active for ' + d });
    return row('Order block', { state: 'signal', dir: d, entry: ob.entry, detail: ob.label || 'order block' });
  }));
  out.push(attempt('Fair value gap', ['hgDetectFvg'], function(){
    var f = W.hgDetectFvg(rows4h, d);
    if (!f) return row('Fair value gap', { state: 'idle', detail: 'none open for ' + d });
    return row('Fair value gap', { state: 'signal', dir: d, entry: f.entry, detail: f.label || 'FVG' });
  }));
  out.push(attempt('Liquidity sweep', ['hgDetectLiquiditySweep'], function(){
    var s = W.hgDetectLiquiditySweep(rows4h, d);
    if (!s) return row('Liquidity sweep', { state: 'idle', detail: 'no sweep for ' + d });
    return row('Liquidity sweep', { state: 'signal', dir: d, detail: s.label || s.note || 'sweep' });
  }));
  out.push(attempt('Structure stop', ['hgStructureStop'], function(){
    var last = rows4h[rows4h.length - 1];
    var st = W.hgStructureStop(d, fin(last && last.c), rows4h, { atrLen: 14, look: 20 });
    if (!st || !isFinite(fin(st.stop))) return row('Structure stop', { state: 'idle', detail: 'no swing found' });
    return row('Structure stop', { state: 'signal', dir: d, stop: st.stop, detail: st.note || 'swing stop' });
  }));
  out.push(attempt('Liquidity pools', ['findLiquidityPools'], function(){
    var lp = W.findLiquidityPools(rows4h);
    if (!lp) return row('Liquidity pools', { state: 'idle', detail: 'none mapped' });
    var bs = lp.buySide && fin(lp.buySide.level), ss = lp.sellSide && fin(lp.sellSide.level);
    return row('Liquidity pools', { state: 'signal',
      detail: 'buy-side ' + px(bs) + ' · sell-side ' + px(ss) });
  }));
  return out;
}

function gateVetoRows(rows4h, ticker){
  var out = [];
  out.push(attempt('Regime permits a setup', ['hgRegimeAllowsSetup'], function(){
    var r = W.hgRegimeAllowsSetup(rows4h, 'swing');
    if (!r) return unchecked('Regime permits a setup', 'no verdict returned');
    if (r.unchecked) return unchecked('Regime permits a setup', r.reason || 'check could not run');
    return row('Regime permits a setup', { state: r.allow ? 'signal' : 'idle',
      detail: (r.allow ? 'allowed' : 'blocked') + (r.reason ? ' — ' + r.reason : '') });
  }));
  out.push(attempt('Stale momentum', ['hgStaleMomentumVeto'], function(){
    var last = rows4h[rows4h.length - 1];
    var s = W.hgStaleMomentumVeto(rows4h, 'long', fin(last && last.c));
    if (s && s.unchecked) return unchecked('Stale momentum', s.uncheckedReason || 'could not check');
    return row('Stale momentum', { state: (s && s.veto) ? 'idle' : 'signal',
      detail: (s && s.veto) ? ('VETO — ' + s.reason) : 'not stale' });
  }));
  out.push(attempt('ShieldGuard', ['hgShieldGuardVeto'], function(){
    var last = rows4h[rows4h.length - 1];
    var g = W.hgShieldGuardVeto(rows4h, 'long', fin(last && last.c));
    if (g && g.unchecked) return unchecked('ShieldGuard', g.reason || 'could not check');
    return row('ShieldGuard', { state: (g && g.veto) ? 'idle' : 'signal',
      detail: (g && g.veto) ? ('VETO — ' + g.reason) : 'clear' });
  }));
  out.push(attempt('Macro permits crypto', ['hgMacroAllowsCrypto'], function(){
    var m = W.hgMacroAllowsCrypto((ticker && ticker.symbol) || '', 'long');
    if (!m) return unchecked('Macro permits crypto', 'no verdict returned');
    if (m.unchecked) return unchecked('Macro permits crypto', m.reason || 'check could not run');
    return row('Macro permits crypto', { state: m.allow ? 'signal' : 'idle',
      detail: (m.allow ? 'allowed' : 'blocked') + (m.reason ? ' — ' + m.reason : '') });
  }));
  return out;
}

function formationRow(rows4h, ticker, best){
  return attempt('Ticket formation (POI → stop → targets)', ['hgFormTicket'], function(){
    if (!best || !best.dir || !isFinite(fin(best.entry)) || !isFinite(fin(best.stop))){
      return unchecked('Ticket formation (POI → stop → targets)',
        'no engine produced levels to form a ticket from');
    }
    var last = rows4h[rows4h.length - 1];
    var fm = W.hgFormTicket({
      dir: best.dir, sym: (ticker && ticker.symbol) || '', entry: best.entry, stop: best.stop,
      t1: best.t1, t2: best.t2, mark: fin(last && last.c)
    }, { rows: rows4h, style: 'swing', ticker: ticker });
    if (!fm) return unchecked('Ticket formation (POI → stop → targets)', 'no result');
    if (!fm.ok){
      return row('Ticket formation (POI → stop → targets)', { state: 'idle',
        detail: 'declined — ' + (fm.reason || fm.tag || 'not stated') });
    }
    var h = fm.hit || {};
    return row('Ticket formation (POI → stop → targets)', { state: 'signal', dir: h.dir,
      entry: h.entry, stop: h.stop, t1: h.t1, t2: h.t2,
      detail: (h.entryType || 'formed') + (isFinite(fin(fm.formationScore)) ? (' · score ' + nf(fm.formationScore, 0)) : '') });
  });
}

/* ==================== measured track record ====================

   Everything above is what the engines SEE. This is what the app has
   actually MEASURED — the out-of-sample forward log, the scorecard's edge
   lookup, the meta-label and the formation-quality score.

   It will mostly read "no settled samples yet", and that is the honest
   answer rather than a failure of this panel: the forward log only counts
   firings that were recorded on a bar and later settled against bars that
   had not printed at the time. A number here is earned slowly. Showing an
   empty ledger truthfully is the whole point — a confident-looking hit rate
   with four samples behind it would be worse than nothing. */

function measuredRows(rows4h, ticker, plan, sections){
  var out = [];

  /* --- out-of-sample forward log, per desk whose engine fired --- */
  var TABS = [
    ['SWING gate matrix', 'CRYPTOGATES'], ['EDGE', 'EDGE'], ['SQUEEZE', 'SQUEEZE'],
    ['TREND MATRIX', 'TRENDTABLE'], ['REVERSAL SNIPER', 'REVERSALSNIPER'],
    ['PINE ·', 'PINE'], ['MEAN REVERSION', 'MEANREV']
  ];
  var fired = {};
  sections.forEach(function(s){
    s.rows.forEach(function(r){
      if (r.state !== 'signal') return;
      TABS.forEach(function(t){ if (r.name.indexOf(t[0]) === 0) fired[t[1]] = true; });
    });
  });
  var tabs = Object.keys(fired);

  if (!has('hgFwdStats')){
    out.push(unchecked('Out-of-sample forward log', 'hg-forward.js not loaded'));
  } else if (!tabs.length){
    out.push(row('Out-of-sample forward log', { state: 'idle',
      detail: 'no desk fired on this contract, so there is no mechanic to look up' }));
  } else {
    tabs.forEach(function(tab){
      out.push(attempt('Forward log · ' + tab, ['hgFwdStats'], function(){
        var st = W.hgFwdStats(tab, null, false) || {};
        var n = fin(st.samples);
        if (!isFinite(n) || n <= 0){
          return row('Forward log · ' + tab, { state: 'idle',
            detail: 'no settled out-of-sample trades recorded for this desk yet'
              + (fin(st.open) > 0 ? ' — ' + fin(st.open) + ' still open' : '') });
        }
        var hit = fin(st.hit), expR = fin(st.expR);
        return row('Forward log · ' + tab, { state: 'signal',
          detail: n + ' settled · hit ' + (isFinite(hit) ? nf(hit * 100, 1) + '%' : '—')
            + ' · expectancy ' + (isFinite(expR) ? nf(expR, 3) + 'R' : '—')
            + (fin(st.open) > 0 ? ' · ' + fin(st.open) + ' open' : ''),
          why: n < 30 ? (n + ' settled trades is not enough to conclude anything — treat this as a count, not a verdict') : null });
      }));
    });
  }

  /* --- the scorecard's measured edge for this symbol and direction --- */
  out.push(attempt('Measured edge (scorecard ledger)', ['hgEdgeFor', 'hgScoreRecords'], function(){
    if (!plan || !plan.ok) return unchecked('Measured edge (scorecard ledger)', 'no plan to look up');
    var recs = W.hgScoreRecords() || [];
    if (!recs.length) return row('Measured edge (scorecard ledger)', { state: 'idle',
      detail: 'the scorecard has no records yet' });
    var e = W.hgEdgeFor({ symbol: (ticker && ticker.symbol) || '', side: plan.dir,
      rr: plan.rr1, ts: null }, recs);
    if (!e) return row('Measured edge (scorecard ledger)', { state: 'idle', detail: 'no matching archetype' });
    var n = fin(e.n);
    if (!isFinite(n) || n <= 0) return row('Measured edge (scorecard ledger)', { state: 'idle',
      detail: 'no settled records match this archetype' });
    return row('Measured edge (scorecard ledger)', { state: 'signal',
      detail: n + ' matching records' + (isFinite(fin(e.winRate)) ? ' · win ' + nf(fin(e.winRate) * 100, 1) + '%' : '')
        + (isFinite(fin(e.expR)) ? ' · ' + nf(fin(e.expR), 3) + 'R' : ''),
      why: n < 30 ? 'fewer than 30 records — a count, not a verdict' : null });
  }));

  /* --- the app's own take-or-skip on this exact plan --- */
  out.push(attempt('Meta-label (take / skip)', ['hgMetaLabel'], function(){
    if (!plan || !plan.ok) return unchecked('Meta-label (take / skip)', 'no plan to label');
    var recs = has('hgScoreRecords') ? (W.hgScoreRecords() || []) : [];
    var ml = W.hgMetaLabel({
      dir: plan.dir, entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: plan.rr1, rr1: plan.rr1
    }, {}, recs);
    if (!ml) return row('Meta-label (take / skip)', { state: 'idle', detail: 'no label returned' });
    var p = fin(ml.prob);
    return row('Meta-label (take / skip)', { state: ml.take ? 'signal' : 'idle', dir: plan.dir,
      detail: (ml.take ? 'TAKE' : 'SKIP') + (isFinite(p) ? ' · ' + nf(p * 100, 0) + '%' : '')
        + (ml.verdict ? ' · ' + ml.verdict : ''),
      why: recs.length ? null : 'no ledger records behind this probability yet — it is a prior, not a measurement' });
  }));

  /* --- formation quality --- */
  out.push(attempt('Formation quality score', ['superSetupFqsGate'], function(){
    if (!plan || !plan.ok) return unchecked('Formation quality score', 'no plan to score');
    var f = W.superSetupFqsGate({ dir: plan.dir, entry: plan.entry, stop: plan.stop,
      t1: plan.t1, rr: plan.rr1, sym: (ticker && ticker.symbol) || '' }, {});
    if (!f) return row('Formation quality score', { state: 'idle', detail: 'no score returned' });
    return row('Formation quality score', { state: f.ok ? 'signal' : 'idle',
      detail: (isFinite(fin(f.fqs)) ? 'FQS ' + nf(f.fqs, 0) : 'FQS —')
        + (f.grade ? ' · grade ' + f.grade : '')
        + (f.ok ? ' · clears the floor' : ' · below the floor' + (f.reason ? ' — ' + f.reason : '')) });
  }));

  return out;
}

/* Async engines — flow legs and the post-gate need the network, so they run
   after the synchronous report is already on screen rather than holding it. */
function hgContractReportEnrich(rep, inp){
  inp = inp || {};
  var ticker = inp.ticker || {};
  var rows4h = Array.isArray(inp.rows4h) ? inp.rows4h : [];
  var dir = (rep && rep.plan && rep.plan.ok) ? rep.plan.dir : null;
  var jobs = [];
  var rows = [];

  if (!dir){
    rows.push(unchecked('Flow trap (CVD / order-book imbalance)', 'no direction to assess flow against'));
    rows.push(unchecked('Post-gate quality veto', 'no plan to put through it'));
    return Promise.resolve(rows);
  }

  jobs.push(
    (has('hgAssessFlowTrap')
      ? Promise.resolve().then(function(){ return W.hgAssessFlowTrap(ticker.symbol || '', dir, ticker.fundingPct, '4h'); })
      : Promise.resolve(null))
    .then(function(f){
      if (!f) return unchecked('Flow trap (CVD / order-book imbalance)', 'plans.js not loaded');
      if (f.flowNA) return unchecked('Flow trap (CVD / order-book imbalance)',
        f.flowDetail || 'no flow legs available for this symbol');
      return row('Flow trap (CVD / order-book imbalance)', {
        state: f.veto ? 'idle' : 'signal', dir: dir,
        detail: (f.veto ? 'VETO — ' + (f.reason || 'flow against') : 'no trap') + ' · ' + (f.flowDetail || '') });
    })
    .catch(function(e){ return row('Flow trap (CVD / order-book imbalance)', { state: 'error', detail: 'threw: ' + errText(e) }); })
  );

  jobs.push(
    (has('hgPostGateSetupVeto')
      ? Promise.resolve().then(function(){
          return W.hgPostGateSetupVeto(ticker, { dir: dir, entry: rep.plan.entry, stop: rep.plan.stop, t1: rep.plan.t1 },
            rows4h, 'swing', W.getCandles || null);
        })
      : Promise.resolve(null))
    .then(function(q){
      if (!q) return unchecked('Post-gate quality veto', 'plans.js not loaded');
      if (q.ok === false) return row('Post-gate quality veto', { state: 'idle',
        detail: 'VETO — ' + (q.reason || q.tag || 'quality') });
      if (q.unchecked) return unchecked('Post-gate quality veto',
        (q.uncheckedReasons || ['could not be evaluated']).join(' · '));
      return row('Post-gate quality veto', { state: 'signal', dir: dir, detail: 'passed' });
    })
    .catch(function(e){ return row('Post-gate quality veto', { state: 'error', detail: 'threw: ' + errText(e) }); })
  );

  return Promise.all(jobs);
}

/* ==================== the executable plan ====================

   The reads above are evidence. This turns them into ONE plan with exact
   numbers: entry, stop, and three targets, each with the R multiple it
   actually represents.

   Order of preference, best source first:
     1. the formed ticket — the app's own POI entry, structure stop and
        structure targets, the same pipeline the desks trade from
     2. the highest-R:R engine signal that carries real levels
     3. structure stop + ATR projection, clearly labelled as derived, so the
        reader still gets exact numbers rather than a shrug

   If none of those can produce a risk distance, the plan says so and shows
   no numbers at all. An invented entry is worse than no entry. */

function planFrom(rows4h, ticker, sections, lean){
  var out = {
    ok: false, dir: null, source: null, entry: null, stop: null,
    t1: null, t2: null, t3: null, rr1: null, rr2: null, rr3: null,
    mark: null, entryType: null, distancePct: null, reason: null, risk: null
  };
  var last = rows4h && rows4h.length ? rows4h[rows4h.length - 1] : null;
  var mark = fin(last && last.c);
  out.mark = isFinite(mark) ? mark : null;

  var all = [];
  sections.forEach(function(s){ all = all.concat(s.rows); });

  function usable(r){
    return r && r.state === 'signal' && dirOf(r.dir)
      && isFinite(fin(r.entry)) && isFinite(fin(r.stop))
      && fin(r.entry) !== fin(r.stop);
  }

  /* 1 — the formed ticket */
  var formed = all.filter(function(r){ return /Ticket formation/.test(r.name) && usable(r); })[0];
  var pick = formed || null;
  if (pick) out.source = 'formed ticket — POI entry, structure stop, structure targets';

  /* 2 — the best levelled engine read that agrees with the lean */
  if (!pick){
    var cands = all.filter(function(r){
      return usable(r) && !/Ticket formation/.test(r.name) && (!lean || r.dir === lean);
    });
    cands.sort(function(a, b){ return (fin(b.rr) || 0) - (fin(a.rr) || 0); });
    if (cands.length){ pick = cands[0]; out.source = pick.name; }
  }

  /* 3 — derive from structure, so exact numbers still exist */
  if (!pick && isFinite(mark) && dirOf(lean) && has('hgStructureStop')){
    try{
      var st = W.hgStructureStop(lean, mark, rows4h, { atrLen: 14, look: 20 });
      var sStop = fin(st && st.stop);
      if (isFinite(sStop) && sStop !== mark){
        pick = { dir: lean, entry: mark, stop: sStop, t1: null, t2: null };
        out.source = 'derived — no engine gave levels, so this is the structure stop '
          + (st && st.note ? '(' + st.note + ')' : '') + ' with targets projected at R multiples';
      }
    }catch(e){}
  }

  if (!pick){
    out.reason = dirOf(lean)
      ? 'no engine produced a usable entry and stop for this contract, and no structure stop could be found — '
        + 'there is no honest price to quote, so none is shown'
      : 'the engines do not agree on a direction, so there is no plan to state';
    return out;
  }

  var entry = fin(pick.entry), stop = fin(pick.stop);
  var dir = dirOf(pick.dir) || lean;
  var risk = Math.abs(entry - stop);
  if (!(risk > 0)){
    out.reason = 'entry and stop are the same price, so risk is undefined and no target can be priced';
    return out;
  }

  /* Targets: use the engine's own where it gave them, project the rest at R
     multiples off the SAME entry and stop, so every number on the card is
     consistent with every other. */
  function proj(mult){ return dir === 'long' ? entry + risk * mult : entry - risk * mult; }
  var t1 = isFinite(fin(pick.t1)) ? fin(pick.t1) : proj(2);
  var t2 = isFinite(fin(pick.t2)) ? fin(pick.t2) : proj(3.5);
  var t3 = isFinite(fin(pick.t3)) ? fin(pick.t3) : proj(5);

  /* Targets must be on the winning side of entry AND strictly further out in
     order. A first attempt reprojected a bad target at a fixed R multiple,
     which broke ordering the moment an engine's own T2 sat beyond that
     multiple: a long came back with TP3 52079 below TP2 53274. A nearer third
     target than the second is incoherent on a card, so ordering is enforced
     directly rather than assumed to fall out of the multiples. */
  function rightSide(t){ return isFinite(t) && (dir === 'long' ? t > entry : t < entry); }
  function further(t, prev){ return dir === 'long' ? t > prev : t < prev; }
  function pushOut(prev, mult){
    var byR = proj(mult);
    if (further(byR, prev)) return byR;
    return dir === 'long' ? prev + risk : prev - risk;   /* always one R beyond the last */
  }
  if (!rightSide(t1)) t1 = proj(2);
  if (!rightSide(t2) || !further(t2, t1)) t2 = pushOut(t1, 3.5);
  if (!rightSide(t3) || !further(t3, t2)) t3 = pushOut(t2, 5);

  out.ok = true;
  out.dir = dir;
  out.entry = entry; out.stop = stop; out.risk = risk;
  out.t1 = t1; out.t2 = t2; out.t3 = t3;
  out.rr1 = rrOf(entry, stop, t1);
  out.rr2 = rrOf(entry, stop, t2);
  out.rr3 = rrOf(entry, stop, t3);

  if (isFinite(mark)){
    out.distancePct = ((entry - mark) / mark) * 100;
    var within = Math.abs(entry - mark) <= risk * 0.15;
    if (within) out.entryType = 'MARKET — price is at the entry now';
    else if (dir === 'long') out.entryType = mark > entry
      ? 'LIMIT — price is above the entry, wait for the pullback to ' + px(entry)
      : 'LIMIT — price is below the entry, wait for the reclaim of ' + px(entry);
    else out.entryType = mark < entry
      ? 'LIMIT — price is below the entry, wait for the bounce to ' + px(entry)
      : 'LIMIT — price is above the entry, wait for the rejection at ' + px(entry);
  } else {
    out.entryType = 'LIMIT — no live mark price available to compare against';
  }
  return out;
}

function planHTML(p, sym){
  if (!p) return '';
  if (!p.ok){
    return '<div class="cr-plan cr-plan-none"><div class="cr-plan-h">NO TRADE PLAN</div>'
      + '<div class="cr-why">' + esc(p.reason || 'no plan') + '</div></div>';
  }
  var cls = p.dir === 'long' ? 'cr-plan-long' : 'cr-plan-short';
  var stopNote = p.dir === 'long' ? 'a close below this kills the idea' : 'a close above this kills the idea';
  return '<div class="cr-plan ' + cls + '">'
    + '<div class="cr-plan-h">' + esc(String(p.dir).toUpperCase()) + ' ' + esc(sym)
    + ' <span class="cr-plan-src">' + esc(p.source) + '</span></div>'
    + '<div class="cr-plan-grid">'
    + '<div><i>ENTRY</i><b>' + px(p.entry) + '</b><u>' + esc(p.entryType || '') + '</u></div>'
    + '<div><i>STOP LOSS</i><b>' + px(p.stop) + '</b><u>' + esc(stopNote)
    + ' · risk ' + px(p.risk) + '</u></div>'
    + '<div><i>TP1</i><b>' + px(p.t1) + '</b><u>' + nf(p.rr1, 2) + 'R — trim / de-risk</u></div>'
    + '<div><i>TP2</i><b>' + px(p.t2) + '</b><u>' + nf(p.rr2, 2) + 'R — core</u></div>'
    + '<div><i>TP3</i><b>' + px(p.t3) + '</b><u>' + nf(p.rr3, 2) + 'R — runner</u></div>'
    + '<div><i>MARK NOW</i><b>' + px(p.mark) + '</b><u>'
    + (p.distancePct === null ? 'no live price' : (nf(p.distancePct, 2) + '% from entry')) + '</u></div>'
    + '</div>'
    + '<div class="cr-why">Every target is priced off this exact entry and stop, so each R multiple is '
    + 'the real ratio between the numbers above it. Nothing here is a recommendation — the evidence each '
    + 'engine gave is listed below, including the ones that could not run.</div>'
    + '</div>';
}

/* ==================== the report ==================== */

function hgContractReportRun(inp){
  inp = inp || {};
  var rows4h = Array.isArray(inp.rows4h) ? inp.rows4h : [];
  var rows1h = Array.isArray(inp.rows1h) ? inp.rows1h : [];
  var rows15m = Array.isArray(inp.rows15m) ? inp.rows15m : [];
  var ticker = inp.ticker || { symbol: inp.sym || '', fundingPct: null };
  var sym = String(inp.sym || ticker.symbol || '—');

  var report = {
    sym: sym, venue: inp.venue || '', at: inp.nowMs || null,
    bars: { h4: rows4h.length, h1: rows1h.length, m15: rows15m.length },
    sections: [], indicators: [], summary: null, note: null
  };

  if (rows4h.length < 60){
    report.note = 'only ' + rows4h.length + ' 4h bars available — most engines need 60 or more, '
      + 'so what follows is mostly UNCHECKED rather than quiet.';
  }

  var strat = cryptoGateRows(rows4h, rows1h, rows15m, ticker);
  var pine = pineRows(rows4h);

  /* the direction the engines lean, used only to orient the structure reads */
  var lean = null, lc = 0, sc = 0;
  strat.concat(pine).forEach(function(r){
    if (r.state !== 'signal' || !r.dir) return;
    if (r.dir === 'long') lc++; else if (r.dir === 'short') sc++;
  });
  lean = lc > sc ? 'long' : (sc > lc ? 'short' : null);

  report.sections.push({ id: 'gates', label: 'GATE MATRICES & CRYPTO STRATEGIES', rows: strat });
  report.sections.push({ id: 'pine', label: 'PINE SCRIPT LIBRARY (10 detectors)', rows: pine });
  report.sections.push({ id: 'structure', label: 'STRUCTURE & LIQUIDITY' + (lean ? ' (read for ' + lean.toUpperCase() + ')' : ''), rows: structureRows(rows4h, lean) });
  report.sections.push({ id: 'gatesveto', label: 'PERMISSION GATES & VETOES', rows: gateVetoRows(rows4h, ticker) });

  /* the best levelled signal, used to attempt a formed ticket */
  var best = null;
  strat.concat(pine).forEach(function(r){
    if (r.state !== 'signal' || !r.dir) return;
    if (!isFinite(fin(r.entry)) || !isFinite(fin(r.stop))) return;
    if (lean && r.dir !== lean) return;
    if (!best || (fin(r.rr) > fin(best.rr))) best = r;
  });
  report.sections.push({ id: 'formation', label: 'TICKET FORMATION', rows: [formationRow(rows4h, ticker, best)] });

  /* the one thing the reader actually acts on */
  report.plan = planFrom(rows4h, ticker, report.sections, lean);

  /* what the app has MEASURED, as opposed to what it sees — needs the plan,
     so it is built after it */
  report.sections.push({ id: 'measured', label: 'MEASURED TRACK RECORD (out-of-sample)',
    rows: measuredRows(rows4h, ticker, report.plan, report.sections) });

  report.indicators = indicatorReads(rows4h, rows1h, rows15m);

  var all = [];
  report.sections.forEach(function(s){ all = all.concat(s.rows); });
  var signals = all.filter(function(r){ return r.state === 'signal'; });
  var unch = all.filter(function(r){ return r.state === 'unchecked'; });
  var errs = all.filter(function(r){ return r.state === 'error'; });
  report.summary = {
    engines: all.length,
    signals: signals.length,
    long: signals.filter(function(r){ return r.dir === 'long'; }).length,
    short: signals.filter(function(r){ return r.dir === 'short'; }).length,
    idle: all.filter(function(r){ return r.state === 'idle'; }).length,
    unchecked: unch.length,
    errors: errs.length,
    lean: lean,
    uncheckedNames: unch.map(function(r){ return r.name; }),
    errorNames: errs.map(function(r){ return r.name + ' (' + r.detail + ')'; })
  };
  return report;
}

/* ==================== rendering ==================== */

var CR_CSS = ''
  + '.cr-wrap{margin-top:10px}'
  + '.cr-head{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;margin-bottom:8px}'
  + '.cr-sum{font-size:12px;opacity:.85}'
  + '.cr-sec{margin-top:14px}'
  + '.cr-sec>h4{margin:0 0 6px;font-size:12px;letter-spacing:.06em;opacity:.75}'
  + '.cr-row{display:grid;grid-template-columns:minmax(140px,1.4fr) 70px minmax(120px,1.2fr) minmax(150px,1.6fr);'
  + 'gap:8px;padding:6px 8px;border-bottom:1px solid rgba(148,163,184,.18);font-size:12px;align-items:start}'
  + '.cr-row:last-child{border-bottom:none}'
  + '.cr-name{font-weight:600}'
  + '.cr-pill{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;letter-spacing:.04em;border:1px solid}'
  + '.cr-long{color:#22C55E;border-color:#22C55E}'
  + '.cr-short{color:#EF4444;border-color:#EF4444}'
  + '.cr-idle{opacity:.5;border-color:rgba(148,163,184,.4)}'
  + '.cr-unchk{color:#FBBF24;border-color:#FBBF24}'
  + '.cr-err{color:#EF4444;border-color:#EF4444}'
  + '.cr-lv{font-variant-numeric:tabular-nums;opacity:.9}'
  + '.cr-why{opacity:.7}'
  + '.cr-gates{margin-top:3px;opacity:.75;font-size:11px}'
  + '.cr-ind{display:grid;grid-template-columns:minmax(150px,1fr) minmax(90px,auto) minmax(120px,1fr);'
  + 'gap:8px;padding:4px 8px;border-bottom:1px solid rgba(148,163,184,.12);font-size:12px}'
  + '.cr-note{margin-top:8px;font-size:11px;opacity:.75}'
  + '.cr-plan{margin:10px 0 4px;padding:12px;border:1px solid;border-radius:6px}'
  + '.cr-plan-long{border-color:#22C55E;background:rgba(34,197,94,.06)}'
  + '.cr-plan-short{border-color:#EF4444;background:rgba(239,68,68,.06)}'
  + '.cr-plan-none{border-color:rgba(148,163,184,.4)}'
  + '.cr-plan-h{font-size:15px;font-weight:700;letter-spacing:.04em;margin-bottom:8px}'
  + '.cr-plan-src{font-size:11px;font-weight:400;opacity:.7;letter-spacing:0}'
  + '.cr-plan-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}'
  + '.cr-plan-grid>div{display:flex;flex-direction:column;gap:2px}'
  + '.cr-plan-grid i{font-style:normal;font-size:10px;letter-spacing:.08em;opacity:.65}'
  + '.cr-plan-grid b{font-size:17px;font-variant-numeric:tabular-nums}'
  + '.cr-plan-grid u{text-decoration:none;font-size:10px;opacity:.7;line-height:1.35}';

function hgContractReportCSS(){ return CR_CSS; }

function pill(r){
  if (r.state === 'unchecked') return '<span class="cr-pill cr-unchk">UNCHECKED</span>';
  if (r.state === 'error') return '<span class="cr-pill cr-err">ERROR</span>';
  if (r.state === 'signal' && r.dir === 'long') return '<span class="cr-pill cr-long">LONG</span>';
  if (r.state === 'signal' && r.dir === 'short') return '<span class="cr-pill cr-short">SHORT</span>';
  if (r.state === 'signal') return '<span class="cr-pill cr-long">READ</span>';
  return '<span class="cr-pill cr-idle">—</span>';
}

function levelsCell(r){
  if (r.entry === null && r.stop === null) return '<span class="cr-lv">—</span>';
  var s = '<span class="cr-lv">';
  if (r.entry !== null) s += 'E ' + px(r.entry);
  if (r.stop !== null) s += (r.entry !== null ? ' · ' : '') + 'SL ' + px(r.stop);
  if (r.t1 !== null) s += ' · T1 ' + px(r.t1);
  if (r.rr !== null) s += ' (' + nf(r.rr, 2) + 'R)';
  if (r.t2 !== null) s += ' · T2 ' + px(r.t2) + (r.rr2 !== null ? ' (' + nf(r.rr2, 2) + 'R)' : '');
  return s + '</span>';
}

function rowHTML(r){
  var gates = '';
  if (r.gates && r.gates.length){
    gates = '<div class="cr-gates">' + r.gates.map(function(g){
      return (g.pass ? '✓ ' : '✗ ') + esc(g.id);
    }).join(' · ') + '</div>';
  }
  var why = r.why ? '<div class="cr-why">' + esc(r.why) + '</div>' : '';
  return '<div class="cr-row">'
    + '<div class="cr-name">' + esc(r.name) + '</div>'
    + '<div>' + pill(r) + '</div>'
    + '<div>' + levelsCell(r) + '</div>'
    + '<div>' + esc(r.detail || '') + gates + why + '</div>'
    + '</div>';
}

function hgContractReportHTML(rep){
  if (!rep) return '<div class="empty">no report</div>';
  var s = rep.summary || {};
  var h = '<div class="cr-wrap"><div class="cr-head">'
    + '<b>' + esc(rep.sym) + '</b>'
    + '<span class="cr-sum">' + s.engines + ' engines run · ' + s.signals + ' with a read ('
    + s.long + ' long / ' + s.short + ' short) · ' + s.idle + ' quiet · '
    + s.unchecked + ' UNCHECKED · ' + s.errors + ' errored</span>'
    + '<span class="cr-sum">bars: ' + rep.bars.h4 + '×4h · ' + rep.bars.h1 + '×1h · ' + rep.bars.m15 + '×15m</span>'
    + '</div>';

  h += planHTML(rep.plan, rep.sym);

  if (rep.note) h += '<div class="note warn">' + esc(rep.note) + '</div>';

  h += '<div class="note">Every engine in the app, run against this one contract. '
    + 'An engine that could not run reads <b>UNCHECKED</b> — that is different from a quiet one, '
    + 'and only a quiet one is evidence. Every R:R shown is derived from the entry, stop and target on '
    + 'its own row. This page reports; it does not rank or recommend.</div>';

  rep.sections.forEach(function(sec){
    h += '<div class="cr-sec"><h4>' + esc(sec.label) + '</h4>';
    h += sec.rows.map(rowHTML).join('');
    h += '</div>';
  });

  h += '<div class="cr-sec"><h4>INDICATOR READS</h4>';
  h += rep.indicators.map(function(i){
    return '<div class="cr-ind"><div>' + esc(i.label) + '</div>'
      + '<div class="cr-lv">' + esc(i.value) + '</div>'
      + '<div class="cr-why">' + esc(i.note) + '</div></div>';
  }).join('');
  h += '</div>';

  if (s.uncheckedNames && s.uncheckedNames.length){
    h += '<div class="cr-note"><b>Could not be checked:</b> ' + esc(s.uncheckedNames.join(' · ')) + '</div>';
  }
  if (s.errorNames && s.errorNames.length){
    h += '<div class="cr-note"><b>Errored:</b> ' + esc(s.errorNames.join(' · ')) + '</div>';
  }
  return h + '</div>';
}

W.hgContractReportRun = hgContractReportRun;
W.hgContractReportEnrich = hgContractReportEnrich;
W.hgContractReportHTML = hgContractReportHTML;
W.hgContractReportCSS = hgContractReportCSS;

})();
