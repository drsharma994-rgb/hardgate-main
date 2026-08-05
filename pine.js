/* HARDGATE — pine.js
   PINE tab: all ported Pine scripts on EDGE ticket universe (+ REGIME).
   Alerts fire immediately on new Pine setups. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var KL_BARS = 280;
var TF = '4h';
var CHUNK = 4;
var CHUNK_SLEEP_MS = 120;
var LS_ALERT = 'hg_pine_alert_keys';
var ALERT_GAP_MS = 5 * 60 * 1000;

var PINE_GATE_OPTS = { mode: 'edge' };
var PINE_SCAN_OPTS = { includeContext: true, recentBars: 5 };

var PINE_SCRIPTS = [
  { id: 'lorentzian-kernel', label: 'ML: Lorentzian + Kernel', fn: 'pineLorentzianKernel', minBars: 260,
    opts: { kNeighbors: 8, lookback: 250, scoreLimit: 2, kernelLookback: 8, kernelBandwidth: 3 } },
  { id: 'msb-ob', label: 'MSB & Order Block', fn: 'pineMsbOb', minBars: 80,
    opts: { leftBars: 5, rightBars: 5 } },
  { id: 'squeeze-momentum', label: 'Squeeze Momentum', fn: 'pineSqueezeMomentum', minBars: 50,
    opts: { length: 20, bbMult: 2, kcMult: 1.5 } },
  { id: 'smart-money-flow', label: 'Smart Money Flow', fn: 'pineSmartMoneyFlow', minBars: 30,
    opts: { length: 21, threshold: 0.10 } },
  { id: 'half-trend', label: 'HalfTrend', fn: 'pineHalfTrend', minBars: 120,
    opts: { amplitude: 2, atrMult: 2.0, atrLen: 100 } },
  { id: 'smc-core', label: 'SMC: Core Math', fn: 'pineSmcCore', minBars: 30,
    opts: { pivotLength: 5, atrLen: 14, recentBars: 5 } },
  { id: 'vumanchu-cipher', label: 'VuManChu Cipher B', fn: 'pineVumanchuCipher', minBars: 40,
    opts: { wtChannelLen: 9, wtAvgLen: 21, osLevel: -53, obLevel: 53, recentBars: 5 } },
  { id: 'range-filter', label: 'Range Filter', fn: 'pineRangeFilter', minBars: 210,
    opts: { period: 100, mult: 3.0 } },
  { id: 'nw-envelope', label: 'NW Envelope', fn: 'pineNwEnvelope', minBars: 60,
    opts: { bandwidth: 8.0, mult: 2.5, lookback: 50, atrLen: 100 } },
  { id: 'weekly-avwap', label: 'Weekly AVWAP + SD', fn: 'pineWeeklyAvwap', minBars: 20,
    opts: { bandMult: 2.0 } }
];

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function fin(v){ return typeof v === 'number' && isFinite(v); }

function pxF(n){
  if (typeof W.px === 'function') return W.px(n);
  if (!fin(+n)) return '—';
  return String(+n);
}

function fmtF(n, d){
  if (typeof W.fmt === 'function') return W.fmt(n, d);
  if (!fin(+n)) return '—';
  return (+n).toFixed(d === undefined ? 2 : d);
}

function loadAlertKeys(){
  try{
    var raw = localStorage.getItem(LS_ALERT);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}

function saveAlertKeys(keys){
  try{ localStorage.setItem(LS_ALERT, JSON.stringify(keys || {})); }catch(e){}
}

function pineAlertPhase(sig){
  if (!sig) return null;
  if (sig.isNew) return 'new';
  if (sig.isRecent) return 'recent';
  return null;
}

function pineAlertable(sig){
  return !!pineAlertPhase(sig);
}

function alertKey(scriptId, sym, dir, phase){
  return String(scriptId) + ':' + String(sym).toUpperCase() + ':' + String(dir).toLowerCase()
    + ':' + String(phase || 'new');
}

function pruneKeys(keys, now, gap){
  var out = {};
  var cutoff = now - gap;
  for (var k in keys){
    if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
    var t = +keys[k];
    if (isFinite(t) && t > cutoff) out[k] = t;
  }
  return out;
}

function buildPlan(dir, price, rows){
  try{
    if (typeof W.smartSetup === 'function' && rows && rows.length){
      var cls = { dir: dir, longEv: dir === 'long' ? ['pine signal'] : [], shortEv: dir === 'short' ? ['pine signal'] : [], score: 1 };
      var ss = W.smartSetup(cls, rows, rows);
      if (ss && fin(+ss.entry) && fin(+ss.stop) && fin(+ss.t1)) return ss;
    }
    if (typeof W.hgStructureStop === 'function' && rows && rows.length){
      var st = W.hgStructureStop(dir, price, rows, { atrLen: 14, look: 30 });
      if (st && fin(+st.stop)){
        var risk = Math.abs(price - st.stop);
        if (risk > 0){
          return {
            entry: price, stop: st.stop,
            t1: dir === 'long' ? price + 2 * risk : price - 2 * risk,
            t2: dir === 'long' ? price + 3.5 * risk : price - 3.5 * risk,
            planSrc: st.note || 'structure'
          };
        }
      }
    }
  }catch(e){}
  var atrFn = W.atr;
  var a = (typeof atrFn === 'function' && rows && rows.length) ? atrFn(rows, 14) : null;
  var av = a && a.length ? a[a.length - 1] : NaN;
  if (!fin(av)) av = price * 0.015;
  var stop = dir === 'long' ? price - 1.5 * av : price + 1.5 * av;
  var risk = Math.abs(price - stop);
  return {
    entry: price, stop: stop,
    t1: dir === 'long' ? price + 2 * risk : price - 2 * risk,
    t2: dir === 'long' ? price + 3.5 * risk : price - 3.5 * risk,
    planSrc: '1.5×ATR fallback'
  };
}

function buildPlanWithTarget(dir, price, rows, target, bandStop){
  var tgt = fin(+target) ? +target : null;
  var stopBand = fin(+bandStop) ? +bandStop : null;
  try{
    if (typeof W.hgStructureStop === 'function' && rows && rows.length){
      var st = W.hgStructureStop(dir, price, rows, { atrLen: 14, look: 30 });
      if (st && fin(+st.stop)){
        var stop = +st.stop;
        if (stopBand !== null){
          stop = dir === 'long' ? Math.min(stop, stopBand) : Math.max(stop, stopBand);
        }
        var risk = Math.abs(price - stop);
        if (risk > 0){
          var t1 = tgt !== null ? tgt : (dir === 'long' ? price + 2 * risk : price - 2 * risk);
          return {
            entry: price, stop: stop, t1: t1,
            t2: dir === 'long' ? t1 + Math.abs(t1 - price) * 0.5 : t1 - Math.abs(t1 - price) * 0.5,
            planSrc: tgt !== null ? 'mean/VWAP target' : (st.note || 'structure')
          };
        }
      }
    }
  }catch(e){}
  return buildPlan(dir, price, rows);
}

function signalFromScript(item, script, res, rows){
  if (!res || !res.dir) return null;
  if (String(res.dir).toLowerCase() !== item.dir) return null;
  var dir = item.dir;
  var price = res.price;
  var entry, stop, t1, t2, planSrc;
  var sid = script.id;
  var isFresh = !!(res.newLong || res.newShort);
  var isRecent = !isFresh && fin(+res.barsAgo) && res.barsAgo > 0 && res.barsAgo <= (PINE_SCAN_OPTS.recentBars || 5);
  var isContext = !isFresh && !isRecent && !!(res.aligned || res.aligned === undefined && !res.newLong && !res.newShort);

  if (sid === 'msb-ob' || sid === 'smc-core'){
    if (!fin(+res.entry) || !fin(+res.stop) || res.entry === res.stop) return null;
    entry = +res.entry;
    stop = +res.stop;
    var riskOb = Math.abs(entry - stop);
    t1 = fin(+res.t1) ? +res.t1 : (dir === 'long' ? entry + 2 * riskOb : entry - 2 * riskOb);
    t2 = fin(+res.t2) ? +res.t2 : (dir === 'long' ? entry + 3.5 * riskOb : entry - 3.5 * riskOb);
    planSrc = sid === 'smc-core' ? 'SMC FVG zone limit (CHoCH)' : 'MSB order block (limit @ OB)';
  } else if (sid === 'half-trend'){
    entry = fin(+res.entry) ? +res.entry : price;
    stop = fin(+res.trailingStop) ? +res.trailingStop : (fin(+res.stop) ? +res.stop : null);
    if (!fin(stop)) return null;
    var riskHt = Math.abs(entry - stop);
    t1 = fin(+res.t1) ? +res.t1 : (dir === 'long' ? entry + 2 * riskHt : entry - 2 * riskHt);
    t2 = fin(+res.t2) ? +res.t2 : (dir === 'long' ? entry + 3.5 * riskHt : entry - 3.5 * riskHt);
    planSrc = 'HalfTrend trailing line';
  } else if (sid === 'nw-envelope'){
    var bandLo = fin(+res.lower) ? +res.lower - (fin(+res.atr) ? res.atr * 0.25 : price * 0.005) : null;
    var planNw = buildPlanWithTarget(dir, price, rows, res.meanTarget || res.nwCenter, bandLo);
    entry = planNw.entry; stop = planNw.stop; t1 = planNw.t1; t2 = planNw.t2; planSrc = planNw.planSrc;
  } else if (sid === 'weekly-avwap'){
    var bandLoAv = null;
    if (dir === 'long' && fin(+res.lower)) bandLoAv = +res.lower - (fin(+res.stdDev) ? res.stdDev * 0.15 : price * 0.005);
    if (dir === 'short' && fin(+res.upper)) bandLoAv = +res.upper + (fin(+res.stdDev) ? res.stdDev * 0.15 : price * 0.005);
    var planAv = buildPlanWithTarget(dir, price, rows, res.targetVwap || res.vwap, bandLoAv);
    entry = planAv.entry; stop = planAv.stop; t1 = planAv.t1; t2 = planAv.t2; planSrc = planAv.planSrc;
  } else {
    var plan = buildPlan(dir, price, rows);
    entry = plan.entry; stop = plan.stop; t1 = plan.t1; t2 = plan.t2; planSrc = plan.planSrc;
  }

  var sig = {
    sym: item.sym,
    dir: dir,
    scriptId: script.id,
    scriptLabel: script.label,
    gateHits: item.gateHits,
    newLong: !!res.newLong,
    newShort: !!res.newShort,
    isNew: isFresh,
    isRecent: isRecent,
    isContext: isContext && !isRecent,
    barsAgo: fin(+res.barsAgo) ? +res.barsAgo : 0,
    edgeForming: !!item.edgeForming,
    edgeTicket: !!item.edgeTicket,
    price: price,
    entry: entry,
    stop: stop,
    t1: t1,
    t2: t2,
    planSrc: planSrc,
    gates: item.gates,
    rows: rows
  };
  Object.keys(res).forEach(function(k){
    if (k === 'dir' || k === 'rows') return;
    if (sig[k] === undefined) sig[k] = res[k];
  });
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  if (!isFresh && !isRecent && !isContext) return null;
  return sig;
}

function pineSignalVisible(sig){
  return !!(sig && (sig.isNew || sig.isRecent || sig.isContext));
}

function pineUniverseWatchHTML(gate){
  if (!gate || !gate.eligible || !gate.eligible.length) return '';
  if (typeof W.hgFormingWatchHTML !== 'function') return '';
  var items = gate.eligible.slice(0, 16).map(function(u){
    var strat = u.edgeTicket ? 'EDGE ticket'
      : (u.edgeForming ? 'EDGE forming' : (u.swingFallback ? 'SWING fallback' : 'EDGE soft'));
    return {
      state: u.edgeTicket ? 'armed' : 'idle',
      sym: u.sym,
      strategy: strat + ' · ' + String(u.dir || '').toUpperCase(),
      condition: (u.gates && u.gates.regime) ? u.gates.regime : 'awaiting Pine script match',
      gatesPassed: fin(+u.gateHits) ? +u.gateHits : 1,
      gatesTotal: 7
    };
  });
  return W.hgFormingWatchHTML(items, {
    title: 'PINE UNIVERSE',
    subtitle: 'gate-passing sym+dir pairs — matches listed below when scripts align',
    idleText: 'Run EDGE or SWING scan first to populate the Pine universe.'
  });
}

function renderPineOut(signals, gate, opts){
  opts = opts || {};
  var cardFn = opts.cardFn || cardHTML;
  var emptyDetail = opts.emptyDetail
    || 'none fired NEW, RECENT, or ALIGNED on this scan. Try after the next 4H close or expand EDGE forming watch.';
  var visible = (signals || []).filter(pineSignalVisible);
  if (!visible.length){
    var watch = pineUniverseWatchHTML(gate);
    var n = (gate && gate.eligible) ? gate.eligible.length : 0;
    var tail = n
      ? ('<div class="hg-setup-empty" style="margin-top:12px"><b>No Pine script match on latest bars.</b><br>'
        + n + ' sym+dir pair(s) in universe — ' + emptyDetail + '</div>')
      : '<div class="empty">No Pine setups.</div>';
    return watch ? (watch + tail) : tail;
  }
  var clean = visible.filter(function(s){ return s.isNew || s.edgeTicket; });
  var forming = visible.filter(function(s){
    return !(s.isNew || s.edgeTicket) && (s.isRecent || s.edgeForming);
  });
  var near = visible.filter(function(s){
    return !(s.isNew || s.edgeTicket) && !(s.isRecent || s.edgeForming) && s.isContext;
  });
  var html = '';
  if (clean.length){
    html += '<div class="hg-setup-near-h" style="color:#047857;border-color:rgba(5,150,105,.35);background:rgba(5,150,105,.08)">'
      + 'CLEAN · ' + clean.length + ' ticket(s) — NEW or EDGE ticket + Pine confirm</div>';
    html += clean.map(cardFn).join('');
  }
  if (forming.length){
    html += '<div class="hg-setup-near-h" style="margin-top:14px">FORMING · ' + forming.length
      + ' RECENT bar signal(s) — watch only</div>';
    html += forming.map(cardFn).join('');
  }
  if (near.length){
    html += '<div class="hg-setup-near-h" style="margin-top:14px">ALIGNED · ' + near.length
      + ' context match(es) — NEAR watch</div>';
    html += near.map(cardFn).join('');
  }
  return html;
}

function sigNoteLine(sig){
  var sid = sig.scriptId;
  if (sid === 'lorentzian-kernel'){
    return 'ML score <b>' + fmtF(sig.smoothedScore, 2) + '</b> · raw ' + fmtF(sig.mlScore, 1);
  }
  if (sid === 'msb-ob') return 'Limit @ OB · SH ' + pxF(sig.lastSh) + ' · SL ' + pxF(sig.lastSl);
  if (sid === 'squeeze-momentum') return 'Squeeze fired · momentum ' + fmtF(sig.momentum, 4);
  if (sid === 'smart-money-flow') return 'SMF ' + fmtF(sig.smf, 4) + ' · cross ±' + fmtF(sig.threshold, 2);
  if (sid === 'half-trend') return 'HalfTrend flip · trailing ' + pxF(sig.trailingStop || sig.stop);
  if (sid === 'smc-core') return 'CHoCH limit @ FVG ' + pxF(sig.zoneEntry || sig.entry);
  if (sid === 'vumanchu-cipher') return 'WT1 ' + fmtF(sig.wt1, 2) + ' · ' + (sig.signalType || 'div');
  if (sid === 'range-filter') return 'Filter ' + pxF(sig.filterLevel) + ' · regime flip';
  if (sid === 'nw-envelope') return 'Mean ' + pxF(sig.meanTarget || sig.nwCenter) + ' · snap-back';
  if (sid === 'weekly-avwap') return 'Week VWAP ' + pxF(sig.targetVwap || sig.vwap) + ' · band bounce';
  return 'mark ' + pxF(sig.price);
}

function runPineScript(script, rows){
  try{
    var fn = W[script.fn];
    if (typeof fn !== 'function') return null;
    var opts = Object.assign({}, PINE_SCAN_OPTS, script.opts || {});
    return fn(rows, opts);
  }catch(e){ return null; }
}

function pineEvalEligible(eligible, fetchRows){
  var signals = [];
  var scripts = PINE_SCRIPTS;
  return Promise.resolve().then(function(){
    var i = 0;
    function next(){
      if (i >= eligible.length) return signals;
      var item = eligible[i++];
      return fetchRows(item.sym).then(function(rows){
        if (!rows || rows.length < 20) return next();
        for (var s = 0; s < scripts.length; s++){
          var script = scripts[s];
          if (rows.length < (script.minBars || 30)) continue;
          var res = runPineScript(script, rows);
          var sig = signalFromScript(item, script, res, rows);
          if (sig) signals.push(sig);
        }
        return next();
      }).catch(function(){ return next(); });
    }
    return next();
  });
}

function formatPineAlert(sig){
  if (sig.scriptId === 'msb-ob'){
    var action = sig.dir === 'long' ? 'limit_buy' : 'limit_sell';
    var json = '{"action":"' + action + '","ticker":"' + sig.sym + '","entry_price":' + sig.entry
      + ',"stop_loss":' + sig.stop + ',"script":"msb-ob"}';
    return '🌲 PINE MSB/OB · ' + sig.sym + ' ' + sig.dir.toUpperCase()
      + '\nMSB + Order Block · limit @ OB'
      + '\nLIMIT ENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · TP ' + pxF(sig.t1)
      + '\nmark ' + pxF(sig.price) + ' · structure trend ' + (sig.trend > 0 ? 'BULL' : (sig.trend < 0 ? 'BEAR' : 'NEUT'))
      + '\nEDGE+ Pine universe (tickets · forming · soft · SWING fallback)'
      + '\n' + json;
  }
  if (sig.scriptId === 'squeeze-momentum'){
    var sqAction = sig.dir === 'long' ? 'buy' : 'sell';
    var sqJson = '{"action":"' + sqAction + '","ticker":"' + sig.sym + '","price":' + sig.price
      + ',"momentum_val":' + fmtF(sig.momentum, 4) + ',"script":"squeeze-momentum"}';
    return '🌲 PINE SQZ · ' + sig.sym + ' ' + sig.dir.toUpperCase()
      + '\nSqueeze Momentum · squeeze fired OFF'
      + '\nmomentum ' + fmtF(sig.momentum, 4)
      + '\nENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · TP ' + pxF(sig.t1)
      + '\nmark ' + pxF(sig.price)
      + '\nEDGE+ Pine universe (tickets · forming · soft · SWING fallback)'
      + '\n' + sqJson;
  }
  if (sig.scriptId === 'smart-money-flow'){
    var smfAction = sig.dir === 'long' ? 'buy' : 'sell';
    var smfJson = '{"action":"' + smfAction + '","ticker":"' + sig.sym + '","price":' + sig.price
      + ',"flow_strength":' + fmtF(sig.smf, 4) + ',"script":"smart-money-flow"}';
    return '🌲 PINE SMF · ' + sig.sym + ' ' + sig.dir.toUpperCase()
      + '\nSmart Money Flow · cross ±' + fmtF(sig.threshold, 2)
      + '\nflow strength ' + fmtF(sig.smf, 4)
      + '\nENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · TP ' + pxF(sig.t1)
      + '\nmark ' + pxF(sig.price)
      + '\nEDGE+ Pine universe (tickets · forming · soft · SWING fallback)'
      + '\n' + smfJson;
  }
  if (sig.scriptId === 'half-trend'){
    var htAction = sig.dir === 'long' ? 'buy' : 'sell';
    var htJson = '{"action":"' + htAction + '","ticker":"' + sig.sym + '","price":' + sig.price
      + ',"trailing_stop":' + fmtF(sig.trailingStop || sig.stop, 6) + ',"script":"half-trend"}';
    return '🌲 PINE HT · ' + sig.sym + ' ' + sig.dir.toUpperCase()
      + '\nHalfTrend flip · amplitude ' + (sig.amplitude || 2)
      + '\nENTRY ' + pxF(sig.entry) + ' · trailing SL ' + pxF(sig.trailingStop || sig.stop) + ' · TP ' + pxF(sig.t1)
      + '\nmark ' + pxF(sig.price)
      + '\nEDGE+ Pine universe (tickets · forming · soft · SWING fallback)'
      + '\n' + htJson;
  }
  if (sig.scriptId === 'smc-core'){
    var smcAction = sig.dir === 'long' ? 'limit_buy' : 'limit_sell';
    var smcJson = '{"action":"' + smcAction + '","ticker":"' + sig.sym + '","zone_entry":' + sig.entry
      + ',"stop_loss":' + sig.stop + ',"script":"smc-core"}';
    return '🌲 PINE SMC · ' + sig.sym + ' ' + sig.dir.toUpperCase()
      + '\nSMC CHoCH + FVG limit @ zone'
      + '\nZONE ENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · TP ' + pxF(sig.t1)
      + '\nmark ' + pxF(sig.price) + ' · pivot ' + (sig.pivotLength || 5)
      + '\nEDGE+ Pine universe (tickets · forming · soft · SWING fallback)'
      + '\n' + smcJson;
  }
  if (sig.scriptId === 'vumanchu-cipher'){
    var cipherAction = sig.dir === 'long' ? 'buy' : 'sell';
    var cipherSig = sig.signalType || (sig.dir === 'long' ? 'bull_div' : 'bear_div');
    var cipherJson = '{"action":"' + cipherAction + '","ticker":"' + sig.sym + '","signal":"' + cipherSig
      + '","price":' + sig.price + ',"wt1":' + fmtF(sig.wt1, 2) + ',"script":"vumanchu-cipher"}';
    return '🌲 PINE CIPHER · ' + sig.sym + ' ' + sig.dir.toUpperCase()
      + '\nVuManChu Cipher B · WaveTrend divergence (' + cipherSig + ')'
      + '\nWT1 ' + fmtF(sig.wt1, 2) + ' · WT2 ' + fmtF(sig.wt2, 2)
      + ' · OS ' + (sig.osLevel || -53) + ' · OB ' + (sig.obLevel || 53)
      + '\nENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · TP ' + pxF(sig.t1)
      + '\nmark ' + pxF(sig.price)
      + '\nEDGE+ Pine universe (tickets · forming · soft · SWING fallback)'
      + '\n' + cipherJson;
  }
  if (sig.scriptId === 'range-filter'){
    var rfAction = sig.dir === 'long' ? 'regime_bull' : 'regime_bear';
    var rfJson = '{"action":"' + rfAction + '","ticker":"' + sig.sym + '","price":' + sig.price
      + ',"filter_level":' + fmtF(sig.filterLevel, 6) + ',"script":"range-filter"}';
    return '🌲 PINE RF · ' + sig.sym + ' ' + sig.dir.toUpperCase()
      + '\nRange Filter regime flip · period ' + (sig.period || 100) + ' · mult ' + fmtF(sig.mult || 3, 1)
      + '\nFILTER ' + pxF(sig.filterLevel) + ' · rng ' + pxF(sig.rng)
      + '\nENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · TP ' + pxF(sig.t1)
      + '\nmark ' + pxF(sig.price)
      + '\nEDGE+ Pine universe (tickets · forming · soft · SWING fallback)'
      + '\n' + rfJson;
  }
  if (sig.scriptId === 'nw-envelope'){
    var nwAction = sig.dir === 'long' ? 'revert_long' : 'revert_short';
    var nwJson = '{"action":"' + nwAction + '","ticker":"' + sig.sym + '","price":' + sig.price
      + ',"mean_target":' + fmtF(sig.meanTarget || sig.nwCenter, 6) + ',"script":"nw-envelope"}';
    return '🌲 PINE NW · ' + sig.sym + ' ' + sig.dir.toUpperCase()
      + '\nNW Envelope snap-back · bandwidth ' + fmtF(sig.bandwidth || 8, 1) + ' · ATR×' + fmtF(sig.mult || 2.5, 1)
      + '\nMEAN ' + pxF(sig.meanTarget || sig.nwCenter) + ' · upper ' + pxF(sig.upper) + ' · lower ' + pxF(sig.lower)
      + '\nENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · TP ' + pxF(sig.t1)
      + '\nmark ' + pxF(sig.price)
      + '\nEDGE+ Pine universe (tickets · forming · soft · SWING fallback)'
      + '\n' + nwJson;
  }
  if (sig.scriptId === 'weekly-avwap'){
    var avAction = sig.dir === 'long' ? 'buy_vwap_bounce' : 'sell_vwap_bounce';
    var avJson = '{"action":"' + avAction + '","ticker":"' + sig.sym + '","price":' + sig.price
      + ',"target_vwap":' + fmtF(sig.targetVwap || sig.vwap, 6) + ',"script":"weekly-avwap"}';
    return '🌲 PINE AVWAP · ' + sig.sym + ' ' + sig.dir.toUpperCase()
      + '\nWeekly AVWAP + SD×' + fmtF(sig.bandMult || 2, 1) + ' snap-back'
      + '\nVWAP ' + pxF(sig.targetVwap || sig.vwap) + ' · upper ' + pxF(sig.upper) + ' · lower ' + pxF(sig.lower)
      + '\nENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · TP ' + pxF(sig.t1)
      + '\nmark ' + pxF(sig.price)
      + '\nEDGE+ Pine universe (tickets · forming · soft · SWING fallback)'
      + '\n' + avJson;
  }
  var action = sig.dir === 'long' ? 'buy' : 'sell';
  var json = '{"action":"' + action + '","ticker":"' + sig.sym + '","price":' + sig.price
    + ',"ml_confidence":' + fmtF(sig.smoothedScore, 2) + ',"script":"' + sig.scriptId + '"}';
  return '🌲 PINE SETUP · ' + sig.sym + ' ' + sig.dir.toUpperCase()
    + '\n' + sig.scriptLabel
    + '\nML score ' + fmtF(sig.smoothedScore, 2) + ' (limit ±' + (sig.scoreLimit || 2) + ')'
    + '\nENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · TP ' + pxF(sig.t1)
    + '\nEDGE+ Pine universe (tickets · forming · soft · SWING fallback)'
    + '\n' + json;
}

async function pineFireAlerts(fresh, opts){
  opts = opts || {};
  if (!fresh || !fresh.length) return { sent: 0 };
  var now = Date.now();
  var keys = pruneKeys(loadAlertKeys(), now, ALERT_GAP_MS);
  var toSend = [];
  for (var i = 0; i < fresh.length; i++){
    var sig = fresh[i];
    var phase = pineAlertPhase(sig);
    if (!phase) continue;
    var k = alertKey(sig.scriptId, sig.sym, sig.dir, phase);
    if (keys[k] !== undefined) continue;
    toSend.push(sig);
    keys[k] = now;
  }
  if (!toSend.length) return { sent: 0 };
  if (opts.dryRun) return { sent: toSend.length, dryRun: true };

  var sent = 0;
  for (var j = 0; j < toSend.length; j++){
    var s = toSend[j];
    var phaseLabel = s.isNew ? 'NEW' : ('FORMING −' + (s.barsAgo || '?') + 'b');
    var body = formatPineAlert(s);
    if (body.indexOf('Tab:') < 0){
      body = '🌲 HARDGATE PINE tab\nSignal: ' + phaseLabel + ' · ' + s.scriptLabel + '\n' + body;
    }
    var title = 'HARDGATE PINE' + (s.isRecent ? ' FORMING' : '') + ': ' + s.sym + ' ' + s.dir.toUpperCase();
    try{
      if (typeof W.logSetup === 'function') W.logSetup(s.sym, s.dir, 'pine-' + s.scriptId, s.entry, s.stop, s.t1);
    }catch(eLog){}
    try{
      if (typeof W.sendTelegram === 'function'){
        var r = await W.sendTelegram(body);
        if (r === true) sent++;
      }
    }catch(eTg){}
    try{
      if (typeof W.sendAlertPush === 'function'){
        await W.sendAlertPush(title, body, { priority: 5 });
        sent++;
      }
    }catch(eNt){}
  }
  saveAlertKeys(keys);
  return { sent: sent, count: toSend.length };
}

function cardHTML(sig){
  if (!sig.stack && typeof W.hgSetupStackForPineSig === 'function'){
    try{ sig.stack = W.hgSetupStackForPineSig(sig); }catch(eSt){}
  }
  if (typeof W.hgSetupPanelHTML === 'function'){
    return W.hgSetupPanelHTML(sig, { scanner: 'pine', label: sig.scriptLabel, noteFn: sigNoteLine });
  }
  var cls = sig.dir === 'long' ? 'long' : 'short';
  var badge = sig.isNew ? '<span class="stamp pass" style="margin-left:6px">NEW</span>'
    : (sig.isRecent ? '<span class="stamp" style="margin-left:6px">RECENT −' + sig.barsAgo + 'b</span>'
      : (sig.isContext ? '<span class="stamp" style="margin-left:6px">ALIGNED</span>' : ''));
  var gateNote = sig.gates && sig.gates.regime ? esc(sig.gates.regime) : '';
  var hits = sig.edgeTicket ? ' · EDGE ticket'
    : (sig.edgeForming ? ' · EDGE forming' : (sig.gates && sig.gates.swing ? ' · SWING' : ''));
  return '<div class="panel ' + cls + '" style="margin-bottom:12px">'
    + '<h2>' + esc(sig.sym) + ' <span>' + esc(sig.dir.toUpperCase()) + ' · ' + esc(sig.scriptLabel) + badge
    + ((typeof W.hgBookStampChip === 'function')
      ? W.hgBookStampChip(sig.sym, sig.dir, { scanner: 'pine', strategy: sig.scriptId || 'pine' })
      : '')
    + '</span></h2>'
    + '<div class="note">' + sigNoteLine(sig)
    + ' · mark ' + pxF(sig.price) + hits
    + (gateNote ? ' · ' + gateNote : '')
    + '</div>'
    + '<div class="plan">' + (typeof W.planBlock === 'function'
      ? W.planBlock(sig.dir, sig.entry, sig.stop, sig.t1, sig.t2, sig.planSrc || '')
      : ('ENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · T1 ' + pxF(sig.t1))) + '</div>'
    + ((typeof W.hgToTradePlanOnclickAttr === 'function')
      ? '<button class="toTrade" onclick="' + W.hgToTradePlanOnclickAttr(sig.sym, sig.dir, sig.entry, sig.stop, sig.t1, { t2: sig.t2, stack: sig.stack, scanner: 'pine', strategy: sig.scriptId || 'pine' }) + '">SEND TO TRADE PLAN →</button>'
      : '<button class="toTrade" onclick="toTrade(\'' + esc(sig.sym) + '\',\'' + sig.dir + '\',' + sig.entry + ',' + sig.stop + ',' + sig.t1 + ')">SEND TO TRADE PLAN →</button>')
    + (typeof W.hgBookBtn === 'function'
      ? W.hgBookBtn(sig.sym, sig.dir, sig.entry, sig.stop, sig.t1, { scanner: 'pine', strategy: sig.scriptId, t2: sig.t2 })
      : '')
    + '</div>';
}

var __pineSnap = null;
var __pineTab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>CRYPTO PINE <span>All 10 Pine strategies · EDGE+ universe</span></h2>'
    + '<div class="note">Runs <b>every ported Pine script</b> on the expanded <b>EDGE</b> universe: tickets (tally ≥3 + plan), '
    + '<b>forming</b> watchlist, soft tally ≥2, plus REGIME — falls back to <b>SWING CLEAN</b> if EDGE is empty. '
    + 'Shows <b>NEW</b> bar flips, <b>RECENT</b> signals (last 5 bars), and <b>ALIGNED</b> trend/context matches. '
    + 'Run <b>EDGE</b> scan first. New setups alert immediately.</div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="pineRun">RUN ALL PINE SCAN</button>'
    + '<span class="note" id="pineStat">Run EDGE scan first, then scan.</span>'
    + '</div>'
    + '<div class="prog" id="pineProg"><i></i></div>'
    + '<div id="pineFunnel" style="margin-top:8px"></div>'
    + '<div id="pineDesk"></div>'
    + '<div id="pineOut" style="margin-top:12px"><div class="empty">Press RUN PINE SCAN after gate tabs have run.</div></div>'
    + '</div>';

  var btn = el.querySelector('#pineRun');
  var stat = el.querySelector('#pineStat');
  var prog = el.querySelector('#pineProg');
  var out = el.querySelector('#pineOut');
  var funnelEl = el.querySelector('#pineFunnel');
  try{
    var pineDesk = el.querySelector('#pineDesk');
    if (pineDesk && typeof W.hgSetupDeskBannerHTML === 'function'){
      pineDesk.innerHTML = W.hgSetupDeskBannerHTML({ kind: 'pine', tab: 'PINE', note: 'NEW = CLEAN ticket · RECENT/ALIGNED = FORMING/NEAR watch tiers.' });
    }
    if (typeof W.hgSetupInjectStyles === 'function') W.hgSetupInjectStyles();
  }catch(eP){}

  function setProg(p){
    if (!prog) return;
    if (p === null || p === undefined){ prog.classList.remove('on'); prog.querySelector('i').style.width = '0'; return; }
    prog.classList.add('on');
    prog.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
  }

  async function runScan(opts){
    opts = opts || {};
    if (__pineTab.busy) return 'busy';
    __pineTab.busy = true;
    __pineTab.hasRun = true;
    if (btn) btn.disabled = true;
    setProg(0.02);
    if (out) out.innerHTML = '';
    var status = 'refreshed';
    var t0 = Date.now();
    try{
      if (stat) stat.textContent = 'Building EDGE Pine universe…';
      var gate = (typeof W.pineGateLive === 'function')
        ? W.pineGateLive(null, PINE_GATE_OPTS)
        : { eligible: [], funnel: {}, missing: ['pinegate'] };
      if (funnelEl && typeof W.hgFunnelPanelHTML === 'function' && typeof W.pineFunnelRows === 'function'){
        funnelEl.innerHTML = W.hgFunnelPanelHTML('PINE universe (EDGE tickets + forming + REGIME)',
          W.pineFunnelRows(gate.funnel), 'pineGateFunnel');
      }
      if (!gate.eligible || !gate.eligible.length){
        var miss = (gate.missing && gate.missing.length) ? gate.missing.join(', ') : 'EDGE empty';
        if (out) out.innerHTML = '<div class="empty"><b>WAIT.</b> No EDGE tickets in the Pine universe. '
          + 'Run <b>EDGE</b> scan first. Missing: '
          + esc(miss) + '.</div>';
        if (stat) stat.textContent = 'done · 0 eligible · ' + miss;
        __pineSnap = { at: Date.now(), signals: [], gate: gate, stat: stat ? stat.textContent : '' };
        return status;
      }

      if (typeof W.getCandles !== 'function'){
        if (out) out.innerHTML = '<div class="empty">getCandles unavailable — open from HARDGATE app.</div>';
        return 'failed: no getCandles';
      }

      var eligible = gate.eligible.slice();
      var signals = [];
      var failed = 0;
      for (var ci = 0; ci < eligible.length; ci += CHUNK){
        var chunk = eligible.slice(ci, ci + CHUNK);
        await Promise.all(chunk.map(async function(item, ix){
          var n = ci + ix + 1;
          if (stat) stat.textContent = 'Pine math ' + n + '/' + eligible.length + ' · ' + item.sym + ' ' + item.dir.toUpperCase();
          setProg(0.05 + 0.9 * (n / eligible.length));
          try{
            var rows = await W.getCandles(item.sym, TF, KL_BARS);
            if (!rows || rows.length < 20){ failed++; return; }
            for (var s = 0; s < PINE_SCRIPTS.length; s++){
              var script = PINE_SCRIPTS[s];
              if (rows.length < (script.minBars || 30)) continue;
              var res = runPineScript(script, rows);
              var sig = signalFromScript(item, script, res, rows);
              if (sig) signals.push(sig);
            }
          }catch(e){ failed++; }
        }));
        if (ci + CHUNK < eligible.length) await sleep(CHUNK_SLEEP_MS);
      }

      signals.sort(function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
        if (a.isContext !== b.isContext) return a.isContext ? 1 : -1;
        var gh = (fin(+b.gateHits) ? +b.gateHits : 0) - (fin(+a.gateHits) ? +a.gateHits : 0);
        if (gh) return gh;
        return Math.abs(b.smoothedScore || b.momentum || b.smf || 0) - Math.abs(a.smoothedScore || a.momentum || a.smf || 0);
      });

      var alertable = signals.filter(pineAlertable);
      if (alertable.length && !opts.quiet){
        try{ await pineFireAlerts(alertable, opts); }catch(eAl){ console.warn('pine alert', eAl); }
      }

      __pineSnap = { at: Date.now(), signals: signals, gate: gate, stat: '' };

      if (out) out.innerHTML = renderPineOut(signals, gate);

      var visibleN = signals.filter(pineSignalVisible).length;
      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var newN = signals.filter(function(s){ return s.isNew; }).length;
      var formN = signals.filter(function(s){ return s.isRecent; }).length;
      var ctxN = signals.filter(function(s){ return s.isContext; }).length;
      if (stat) stat.textContent = 'done · ' + eligible.length + ' gated · ' + visibleN + ' Pine signal(s)'
        + (newN ? (' · ' + newN + ' NEW') : '')
        + (formN ? (' · ' + formN + ' forming') : '')
        + (alertable.length ? (' · ' + alertable.length + ' alerted') : '')
        + (ctxN ? (' · ' + ctxN + ' context/recent') : '')
        + ' · failed ' + failed + ' · ' + dt + 's';
      __pineSnap.stat = stat ? stat.textContent : '';
    }catch(e){
      status = 'error: ' + ((e && e.message) || e);
      if (stat) stat.textContent = status;
      if (out) out.innerHTML = '<div class="empty">Pine scan failed: ' + esc(status) + '</div>';
    }finally{
      if (btn) btn.disabled = false;
      setProg(null);
      __pineTab.busy = false;
    }
    return status;
  }

  if (btn) btn.addEventListener('click', function(){ runScan(); });
  __pineTab.run = runScan;
}

async function pineRefresh(){
  try{
    if (__pineTab.busy) return 'busy';
    if (!__pineTab.hasRun || typeof __pineTab.run !== 'function') return 'skipped: not run yet';
    return await __pineTab.run({ quiet: false });
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

var PINE_WARM_MS = 2.5 * 60 * 1000;

async function pineWarm(opts){
  opts = (opts && typeof opts === 'object') ? opts : {};
  try{
    if (!opts.force && __pineSnap && __pineSnap.at
        && Date.now() - __pineSnap.at < PINE_WARM_MS) return 'fresh';
  }catch(e0){}
  if (__pineTab.busy) return 'busy';
  if (typeof W.getCandles !== 'function') return 'unavailable';
  if (typeof __pineTab.run === 'function' && __pineTab.hasRun){
    return await __pineTab.run(Object.assign({ quiet: true }, opts));
  }
  var pane = document.createElement('div');
  pane.style.display = 'none';
  document.body.appendChild(pane);
  try{
    mount(pane);
    if (typeof __pineTab.run === 'function'){
      return await __pineTab.run(Object.assign({ quiet: true }, opts));
    }
  }finally{
    try{ pane.remove(); }catch(e){}
  }
  return __pineSnap ? 'warmed' : 'unavailable';
}

W.pineFireAlerts = pineFireAlerts;
W.pineAlertable = pineAlertable;
W.pineAlertPhase = pineAlertPhase;
W.pineEvalEligible = pineEvalEligible;
W.pineSignalVisible = pineSignalVisible;
W.renderPineOut = renderPineOut;
W.PINE_SCRIPTS = PINE_SCRIPTS;
W.PINE_GATE_OPTS = PINE_GATE_OPTS;
W.PINE_SCAN_OPTS = PINE_SCAN_OPTS;
W.pineScan = function(){ try{ return __pineSnap; }catch(e){ return null; } };
W.pineWarm = pineWarm;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine', label: 'CRYPTO PINE', mount: mount, refresh: pineRefresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'pine', label: 'PINE', run: pineWarm });

})();
