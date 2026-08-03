/* HARDGATE — pine.js
   PINE SCRIPT tab: run Pine-ported math only on contracts that pass ALL
   HARDGATE scanner gates (SWING, SCALP, EDGE, BEST, BRAIN, REGIME, TREND MATRIX).
   Alerts fire immediately on new Pine setups. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var KL_BARS = 280;
var TF = '4h';
var CHUNK = 4;
var CHUNK_SLEEP_MS = 120;
var LS_ALERT = 'hg_pine_alert_keys';
var ALERT_GAP_MS = 15 * 60 * 1000;

var PINE_SCRIPTS = [
  {
    id: 'lorentzian-kernel',
    label: 'ML: Lorentzian + Kernel',
    fn: 'pineLorentzianKernel',
    opts: { kNeighbors: 8, lookback: 250, scoreLimit: 2, kernelLookback: 8, kernelBandwidth: 3 }
  }
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

function alertKey(scriptId, sym, dir){
  return String(scriptId) + ':' + String(sym).toUpperCase() + ':' + String(dir).toLowerCase();
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
      var ss = W.smartSetup(rows, dir, TF);
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

function runPineScript(script, rows){
  try{
    var fn = W[script.fn];
    if (typeof fn !== 'function') return null;
    return fn(rows, script.opts || {});
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
        if (!rows || rows.length < 260) return next();
        for (var s = 0; s < scripts.length; s++){
          var script = scripts[s];
          var res = runPineScript(script, rows);
          if (!res || !res.dir) return;
          if (String(res.dir).toLowerCase() !== item.dir) return;
          var plan = buildPlan(item.dir, res.price, rows);
          var sig = {
            sym: item.sym,
            dir: item.dir,
            scriptId: script.id,
            scriptLabel: script.label,
            mlScore: res.mlScore,
            smoothedScore: res.smoothedScore,
            newLong: !!res.newLong,
            newShort: !!res.newShort,
            isNew: !!(res.newLong || res.newShort),
            price: res.price,
            entry: plan.entry,
            stop: plan.stop,
            t1: plan.t1,
            t2: plan.t2,
            planSrc: plan.planSrc,
            gates: item.gates,
            rows: rows
          };
          sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
          signals.push(sig);
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
      + '\n7-gate universe: SWING+SCALP+EDGE+BEST+BRAIN+REGIME+TRENDMX'
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
      + '\n7-gate universe: SWING+SCALP+EDGE+BEST+BRAIN+REGIME+TRENDMX'
      + '\n' + sqJson;
  }
  var action = sig.dir === 'long' ? 'buy' : 'sell';
  var json = '{"action":"' + action + '","ticker":"' + sig.sym + '","price":' + sig.price
    + ',"ml_confidence":' + fmtF(sig.smoothedScore, 2) + ',"script":"' + sig.scriptId + '"}';
  return '🌲 PINE SETUP · ' + sig.sym + ' ' + sig.dir.toUpperCase()
    + '\n' + sig.scriptLabel
    + '\nML score ' + fmtF(sig.smoothedScore, 2) + ' (limit ±' + (sig.scoreLimit || 2) + ')'
    + '\nENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · TP ' + pxF(sig.t1)
    + '\n7-gate universe: SWING+SCALP+EDGE+BEST+BRAIN+REGIME+TRENDMX'
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
    if (!sig.isNew) continue;
    var k = alertKey(sig.scriptId, sig.sym, sig.dir);
    if (keys[k] !== undefined) continue;
    toSend.push(sig);
    keys[k] = now;
  }
  if (!toSend.length) return { sent: 0 };
  if (opts.dryRun) return { sent: toSend.length, dryRun: true };

  var sent = 0;
  for (var j = 0; j < toSend.length; j++){
    var s = toSend[j];
    var body = formatPineAlert(s);
    var title = 'HARDGATE PINE: ' + s.sym + ' ' + s.dir.toUpperCase();
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
  var cls = sig.dir === 'long' ? 'long' : 'short';
  var badge = sig.isNew ? '<span class="stamp pass" style="margin-left:6px">NEW SETUP</span>' : '';
  var gateNote = sig.gates && sig.gates.regime ? esc(sig.gates.regime) : '';
  return '<div class="panel ' + cls + '" style="margin-bottom:12px">'
    + '<h2>' + esc(sig.sym) + ' <span>' + esc(sig.dir.toUpperCase()) + ' · ' + esc(sig.scriptLabel) + badge + '</span></h2>'
    + '<div class="note">Smoothed ML score <b>' + fmtF(sig.smoothedScore, 2) + '</b>'
    + ' · raw ' + fmtF(sig.mlScore, 1)
    + ' · mark ' + pxF(sig.price)
    + (gateNote ? ' · ' + gateNote : '')
    + '</div>'
    + '<div class="plan">' + (typeof W.planBlock === 'function'
      ? W.planBlock(sig.dir, sig.entry, sig.stop, sig.t1, sig.t2, sig.planSrc || '')
      : ('ENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · T1 ' + pxF(sig.t1))) + '</div>'
    + '<button class="toTrade" onclick="toTrade(\'' + esc(sig.sym) + '\',\'' + sig.dir + '\',' + sig.entry + ',' + sig.stop + ',' + sig.t1 + ')">SEND TO TRADE PLAN →</button>'
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
    + '<h2>PINE ML <span>Lorentzian KNN + Gaussian kernel · 7-gate intersection</span></h2>'
    + '<div class="note">Only symbols that simultaneously pass <b>SWING</b>, <b>SCALP</b>, <b>EDGE</b>, <b>BEST</b>, <b>BRAIN</b>, <b>REGIME</b> bias, and <b>TREND MATRIX</b> direction are scanned. '
    + 'When Pine math fires a <b>new</b> long/short (score crosses ±threshold on bar close), Telegram + push alert immediately.</div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="pineRun">RUN PINE SCAN</button>'
    + '<span class="note" id="pineStat">Run dependent scans first (SWING, SCALP, EDGE, BEST, BRAIN, REGIME, TREND MATRIX).</span>'
    + '</div>'
    + '<div class="prog" id="pineProg"><i></i></div>'
    + '<div id="pineFunnel" style="margin-top:8px"></div>'
    + '<div id="pineOut" style="margin-top:12px"><div class="empty">Press RUN PINE SCAN after gate tabs have run.</div></div>'
    + '</div>';

  var btn = el.querySelector('#pineRun');
  var stat = el.querySelector('#pineStat');
  var prog = el.querySelector('#pineProg');
  var out = el.querySelector('#pineOut');
  var funnelEl = el.querySelector('#pineFunnel');

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
      if (stat) stat.textContent = 'Building 7-gate universe…';
      var gate = (typeof W.pineGateLive === 'function') ? W.pineGateLive() : { eligible: [], funnel: {}, missing: ['pinegate'] };
      if (funnelEl && typeof W.hgFunnelPanelHTML === 'function' && typeof W.pineFunnelRows === 'function'){
        funnelEl.innerHTML = W.hgFunnelPanelHTML('PINE gate funnel (all tabs must agree on sym+dir)',
          W.pineFunnelRows(gate.funnel), 'pineGateFunnel');
      }
      if (!gate.eligible || !gate.eligible.length){
        var miss = (gate.missing && gate.missing.length) ? gate.missing.join(', ') : 'none aligned';
        if (out) out.innerHTML = '<div class="empty"><b>WAIT.</b> No contracts pass all seven gates on the same direction. Missing or empty: '
          + esc(miss) + '. Run the scanner tabs first, then retry.</div>';
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
            if (!rows || rows.length < 260){ failed++; return; }
            for (var s = 0; s < PINE_SCRIPTS.length; s++){
              var script = PINE_SCRIPTS[s];
              var res = runPineScript(script, rows);
              if (!res || !res.dir) continue;
              if (String(res.dir).toLowerCase() !== item.dir) continue;
              var plan = buildPlan(item.dir, res.price, rows);
              var sig = {
                sym: item.sym,
                dir: item.dir,
                scriptId: script.id,
                scriptLabel: script.label,
                mlScore: res.mlScore,
                smoothedScore: res.smoothedScore,
                scoreLimit: res.scoreLimit,
                newLong: !!res.newLong,
                newShort: !!res.newShort,
                isNew: !!(res.newLong || res.newShort),
                price: res.price,
                entry: plan.entry,
                stop: plan.stop,
                t1: plan.t1,
                t2: plan.t2,
                planSrc: plan.planSrc,
                gates: item.gates,
                rows: rows
              };
              sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
              signals.push(sig);
            }
          }catch(e){ failed++; }
        }));
        if (ci + CHUNK < eligible.length) await sleep(CHUNK_SLEEP_MS);
      }

      signals.sort(function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.smoothedScore || 0) - Math.abs(a.smoothedScore || 0);
      });

      var freshNew = signals.filter(function(s){ return s.isNew; });
      if (!opts.quiet && freshNew.length){
        try{ await pineFireAlerts(freshNew); }catch(eAl){ console.warn('pine alert', eAl); }
      }

      __pineSnap = { at: Date.now(), signals: signals, gate: gate, stat: '' };

      if (!signals.length){
        if (out) out.innerHTML = '<div class="empty">' + eligible.length + ' gate-passing contracts scanned — no Pine setup on the latest bar.</div>';
      } else {
        if (out) out.innerHTML = signals.map(cardHTML).join('');
      }

      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var newN = freshNew.length;
      if (stat) stat.textContent = 'done · ' + eligible.length + ' gated · ' + signals.length + ' Pine signal(s)'
        + (newN ? (' · ' + newN + ' NEW alerted') : '') + ' · failed ' + failed + ' · ' + dt + 's';
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

W.pineFireAlerts = pineFireAlerts;
W.pineEvalEligible = pineEvalEligible;
W.pineScan = function(){ try{ return __pineSnap; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine', label: 'PINE ML', mount: mount, refresh: pineRefresh });

})();
