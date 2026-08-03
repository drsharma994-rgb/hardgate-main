/* HARDGATE — pineavwap.js
   PINE AVWAP tab: Weekly AVWAP + SD band snap-back on 7-gate universe. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var KL_BARS = 180;
var TF = '4h';
var CHUNK = 4;
var CHUNK_SLEEP_MS = 120;
var AVWAP_SCRIPT = {
  id: 'weekly-avwap',
  label: 'Weekly AVWAP + SD',
  fn: 'pineWeeklyAvwap',
  opts: { bandMult: 2.0 }
};

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

function buildPlan(dir, price, rows, res){
  var vwap = res && fin(+res.targetVwap) ? +res.targetVwap : null;
  var bandStop = null;
  if (res){
    if (dir === 'long' && fin(+res.lower)) bandStop = +res.lower - (fin(+res.stdDev) ? res.stdDev * 0.15 : price * 0.005);
    if (dir === 'short' && fin(+res.upper)) bandStop = +res.upper + (fin(+res.stdDev) ? res.stdDev * 0.15 : price * 0.005);
  }
  try{
    if (typeof W.hgStructureStop === 'function' && rows && rows.length){
      var st = W.hgStructureStop(dir, price, rows, { atrLen: 14, look: 30 });
      if (st && fin(+st.stop)){
        var stop = +st.stop;
        if (bandStop !== null){
          stop = dir === 'long' ? Math.min(stop, bandStop) : Math.max(stop, bandStop);
        }
        var risk = Math.abs(price - stop);
        if (risk > 0){
          var t1 = vwap !== null ? vwap : (dir === 'long' ? price + 2 * risk : price - 2 * risk);
          var ext = Math.abs(t1 - price);
          return {
            entry: price, stop: stop,
            t1: t1,
            t2: dir === 'long' ? t1 + ext * 0.35 : t1 - ext * 0.35,
            planSrc: vwap !== null ? 'Weekly AVWAP target' : (st.note || 'structure')
          };
        }
      }
    }
  }catch(e){}
  var atrFn = W.atr;
  var a = (typeof atrFn === 'function' && rows && rows.length) ? atrFn(rows, 14) : null;
  var av = a && a.length ? a[a.length - 1] : NaN;
  if (!fin(av)) av = price * 0.015;
  var stopF = bandStop !== null ? bandStop : (dir === 'long' ? price - 1.5 * av : price + 1.5 * av);
  var riskF = Math.abs(price - stopF);
  var t1F = vwap !== null ? vwap : (dir === 'long' ? price + 2 * riskF : price - 2 * riskF);
  return {
    entry: price, stop: stopF,
    t1: t1F,
    t2: dir === 'long' ? t1F + riskF * 0.5 : t1F - riskF * 0.5,
    planSrc: vwap !== null ? 'Weekly AVWAP target' : '1.5×ATR fallback'
  };
}

function runAvwap(rows){
  try{
    var fn = W[AVWAP_SCRIPT.fn];
    if (typeof fn !== 'function') return null;
    return fn(rows, AVWAP_SCRIPT.opts || {});
  }catch(e){ return null; }
}

function signalFromResult(item, res, rows){
  if (!res || !res.dir) return null;
  if (String(res.dir).toLowerCase() !== item.dir) return null;
  var plan = buildPlan(item.dir, res.price, rows, res);
  var sig = {
    sym: item.sym,
    dir: item.dir,
    scriptId: AVWAP_SCRIPT.id,
    scriptLabel: AVWAP_SCRIPT.label,
    vwap: res.vwap,
    targetVwap: res.targetVwap,
    upper: res.upper,
    lower: res.lower,
    stdDev: res.stdDev,
    bandMult: res.bandMult,
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
  return sig;
}

function cardHTML(sig){
  var cls = sig.dir === 'long' ? 'long' : 'short';
  var revLabel = sig.dir === 'long' ? 'VWAP BOUNCE ↑' : 'VWAP BOUNCE ↓';
  var badge = sig.isNew ? '<span class="stamp pass" style="margin-left:6px">' + revLabel + '</span>' : '';
  var gateNote = sig.gates && sig.gates.regime ? esc(sig.gates.regime) : '';
  return '<div class="panel ' + cls + '" style="margin-bottom:12px">'
    + '<h2>' + esc(sig.sym) + ' <span>' + esc(sig.dir.toUpperCase()) + ' · Weekly AVWAP' + badge + '</span></h2>'
    + '<div class="note">Week VWAP <b>' + pxF(sig.targetVwap || sig.vwap) + '</b>'
    + ' · upper ' + pxF(sig.upper) + ' · lower ' + pxF(sig.lower)
    + ' · SD×' + fmtF(sig.bandMult, 1)
    + ' · mark ' + pxF(sig.price)
    + (gateNote ? ' · ' + gateNote : '')
    + '</div>'
    + '<div class="plan">' + (typeof W.planBlock === 'function'
      ? W.planBlock(sig.dir, sig.entry, sig.stop, sig.t1, sig.t2, sig.planSrc || '')
      : ('ENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · T1 ' + pxF(sig.t1))) + '</div>'
    + '<button class="toTrade" onclick="toTrade(\'' + esc(sig.sym) + '\',\'' + sig.dir + '\',' + sig.entry + ',' + sig.stop + ',' + sig.t1 + ')">SEND TO TRADE PLAN →</button>'
    + (typeof W.hgBookBtn === 'function'
      ? W.hgBookBtn(sig.sym, sig.dir, sig.entry, sig.stop, sig.t1, { scanner: 'pine-avwap', strategy: sig.scriptId, t2: sig.t2 })
      : '')
    + '</div>';
}

var __pineAvwapSnap = null;
var __pineAvwapTab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>PINE AVWAP <span>Weekly anchored VWAP · SD×2 bands · snap-back to VWAP</span></h2>'
    + '<div class="note">Volume-weighted mean resets each UTC Monday. '
    + '<b>Long</b> when wick pierces lower SD band but close reclaims inside. '
    + '<b>Short</b> when wick pierces upper band but close fails back inside. '
    + 'Target = weekly AVWAP. Same 7-gate intersection as other Pine tabs.</div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="pineAvwapRun">RUN AVWAP SCAN</button>'
    + '<span class="note" id="pineAvwapStat">Run gate tabs first, then scan.</span>'
    + '</div>'
    + '<div class="prog" id="pineAvwapProg"><i></i></div>'
    + '<div id="pineAvwapFunnel" style="margin-top:8px"></div>'
    + '<div id="pineAvwapOut" style="margin-top:12px"><div class="empty">Press RUN AVWAP SCAN after gate tabs have run.</div></div>'
    + '</div>';

  var btn = el.querySelector('#pineAvwapRun');
  var stat = el.querySelector('#pineAvwapStat');
  var prog = el.querySelector('#pineAvwapProg');
  var out = el.querySelector('#pineAvwapOut');
  var funnelEl = el.querySelector('#pineAvwapFunnel');

  function setProg(p){
    if (!prog) return;
    if (p === null || p === undefined){ prog.classList.remove('on'); prog.querySelector('i').style.width = '0'; return; }
    prog.classList.add('on');
    prog.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
  }

  async function runScan(opts){
    opts = opts || {};
    if (__pineAvwapTab.busy) return 'busy';
    __pineAvwapTab.busy = true;
    __pineAvwapTab.hasRun = true;
    if (btn) btn.disabled = true;
    setProg(0.02);
    if (out) out.innerHTML = '';
    var status = 'refreshed';
    var t0 = Date.now();
    try{
      if (stat) stat.textContent = 'Building 7-gate universe…';
      var gate = (typeof W.pineGateLive === 'function') ? W.pineGateLive() : { eligible: [], funnel: {}, missing: ['pinegate'] };
      if (funnelEl && typeof W.hgFunnelPanelHTML === 'function' && typeof W.pineFunnelRows === 'function'){
        funnelEl.innerHTML = W.hgFunnelPanelHTML('AVWAP gate funnel (all tabs must agree on sym+dir)',
          W.pineFunnelRows(gate.funnel), 'pineAvwapGateFunnel');
      }
      if (!gate.eligible || !gate.eligible.length){
        var miss = (gate.missing && gate.missing.length) ? gate.missing.join(', ') : 'none aligned';
        if (out) out.innerHTML = '<div class="empty"><b>WAIT.</b> No contracts pass all seven gates. Missing: '
          + esc(miss) + '.</div>';
        if (stat) stat.textContent = 'done · 0 eligible · ' + miss;
        __pineAvwapSnap = { at: Date.now(), signals: [], gate: gate, stat: stat ? stat.textContent : '' };
        return status;
      }
      if (typeof W.getCandles !== 'function'){
        if (out) out.innerHTML = '<div class="empty">getCandles unavailable.</div>';
        return 'failed: no getCandles';
      }

      var eligible = gate.eligible.slice();
      var signals = [];
      var failed = 0;
      for (var ci = 0; ci < eligible.length; ci += CHUNK){
        var chunk = eligible.slice(ci, ci + CHUNK);
        await Promise.all(chunk.map(async function(item, ix){
          var n = ci + ix + 1;
          if (stat) stat.textContent = 'AVWAP ' + n + '/' + eligible.length + ' · ' + item.sym + ' ' + item.dir.toUpperCase();
          setProg(0.05 + 0.9 * (n / eligible.length));
          try{
            var rows = await W.getCandles(item.sym, TF, KL_BARS);
            if (!rows || rows.length < 20){ failed++; return; }
            var res = runAvwap(rows);
            var sig = signalFromResult(item, res, rows);
            if (sig) signals.push(sig);
          }catch(e){ failed++; }
        }));
        if (ci + CHUNK < eligible.length) await sleep(CHUNK_SLEEP_MS);
      }

      signals.sort(function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.entry - (b.targetVwap || b.vwap)) - Math.abs(a.entry - (a.targetVwap || a.vwap));
      });

      var freshNew = signals.filter(function(s){ return s.isNew; });
      if (!opts.quiet && freshNew.length && typeof W.pineFireAlerts === 'function'){
        try{ await W.pineFireAlerts(freshNew); }catch(eAl){ console.warn('pine avwap alert', eAl); }
      }

      __pineAvwapSnap = { at: Date.now(), signals: signals, gate: gate, stat: '' };

      if (!signals.length){
        if (out) out.innerHTML = '<div class="empty">' + eligible.length + ' gated contracts — no AVWAP band snap-back on latest bar.</div>';
      } else {
        if (out) out.innerHTML = signals.map(cardHTML).join('');
      }

      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var newN = freshNew.length;
      if (stat) stat.textContent = 'done · ' + eligible.length + ' gated · ' + signals.length + ' AVWAP signal(s)'
        + (newN ? (' · ' + newN + ' NEW alerted') : '') + ' · failed ' + failed + ' · ' + dt + 's';
      __pineAvwapSnap.stat = stat ? stat.textContent : '';
    }catch(e){
      status = 'error: ' + ((e && e.message) || e);
      if (stat) stat.textContent = status;
      if (out) out.innerHTML = '<div class="empty">AVWAP scan failed: ' + esc(status) + '</div>';
    }finally{
      if (btn) btn.disabled = false;
      setProg(null);
      __pineAvwapTab.busy = false;
    }
    return status;
  }

  if (btn) btn.addEventListener('click', function(){ runScan(); });
  __pineAvwapTab.run = runScan;
}

async function pineAvwapRefresh(){
  try{
    if (__pineAvwapTab.busy) return 'busy';
    if (!__pineAvwapTab.hasRun || typeof __pineAvwapTab.run !== 'function') return 'skipped: not run yet';
    return await __pineAvwapTab.run({ quiet: false });
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

W.pineAvwapScan = function(){ try{ return __pineAvwapSnap; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-avwap', label: 'PINE AVWAP', mount: mount, refresh: pineAvwapRefresh });

})();
