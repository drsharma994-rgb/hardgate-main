/* HARDGATE — pineht.js
   PINE HT tab: HalfTrend flip signals on 7-gate universe. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var KL_BARS = 180;
var TF = '4h';
var CHUNK = 4;
var CHUNK_SLEEP_MS = 120;
var HT_SCRIPT = {
  id: 'half-trend',
  label: 'HalfTrend',
  fn: 'pineHalfTrend',
  opts: { amplitude: 2, atrMult: 2.0, atrLen: 100 }
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

function runHt(rows){
  try{
    var fn = W[HT_SCRIPT.fn];
    if (typeof fn !== 'function') return null;
    return fn(rows, HT_SCRIPT.opts || {});
  }catch(e){ return null; }
}

function signalFromResult(item, res, rows){
  if (!res || !res.dir) return null;
  if (String(res.dir).toLowerCase() !== item.dir) return null;
  if (!fin(+res.entry) || !fin(+res.stop) || res.entry === res.stop) return null;
  var t1 = fin(+res.t1) ? +res.t1 : (item.dir === 'long' ? res.entry + 2 * Math.abs(res.entry - res.stop) : res.entry - 2 * Math.abs(res.entry - res.stop));
  var t2 = fin(+res.t2) ? +res.t2 : (item.dir === 'long' ? res.entry + 3.5 * Math.abs(res.entry - res.stop) : res.entry - 3.5 * Math.abs(res.entry - res.stop));
  var sig = {
    sym: item.sym,
    dir: item.dir,
    scriptId: HT_SCRIPT.id,
    scriptLabel: HT_SCRIPT.label,
    trend: res.trend,
    prevTrend: res.prevTrend,
    halftrend: res.halftrend,
    trailingStop: res.trailingStop,
    amplitude: res.amplitude,
    atrMult: res.atrMult,
    newLong: !!res.newLong,
    newShort: !!res.newShort,
    isNew: !!(res.newLong || res.newShort),
    price: res.price,
    entry: res.entry,
    stop: res.stop,
    t1: t1,
    t2: t2,
    planSrc: 'HalfTrend trailing line',
    gates: item.gates,
    rows: rows
  };
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  return sig;
}

function cardHTML(sig){
  var cls = sig.dir === 'long' ? 'long' : 'short';
  var badge = sig.isNew ? '<span class="stamp pass" style="margin-left:6px">TREND FLIP</span>' : '';
  var gateNote = sig.gates && sig.gates.regime ? esc(sig.gates.regime) : '';
  return '<div class="panel ' + cls + '" style="margin-bottom:12px">'
    + '<h2>' + esc(sig.sym) + ' <span>' + esc(sig.dir.toUpperCase()) + ' · HalfTrend' + badge + '</span></h2>'
    + '<div class="note">HalfTrend line <b>' + pxF(sig.halftrend) + '</b> · trailing stop'
    + ' · mark ' + pxF(sig.price)
    + (gateNote ? ' · ' + gateNote : '')
    + '</div>'
    + '<div class="plan">' + (typeof W.planBlock === 'function'
      ? W.planBlock(sig.dir, sig.entry, sig.stop, sig.t1, sig.t2, sig.planSrc || '')
      : ('ENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · T1 ' + pxF(sig.t1))) + '</div>'
    + '<button class="toTrade" onclick="toTrade(\'' + esc(sig.sym) + '\',\'' + sig.dir + '\',' + sig.entry + ',' + sig.stop + ',' + sig.t1 + ')">SEND TO TRADE PLAN →</button>'
    + (typeof W.hgBookBtn === 'function'
      ? W.hgBookBtn(sig.sym, sig.dir, sig.entry, sig.stop, sig.t1, { scanner: 'pine-ht', strategy: sig.scriptId, t2: sig.t2 })
      : '')
    + '</div>';
}

var __pineHtSnap = null;
var __pineHtTab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>PINE HT <span>HalfTrend · amplitude 2 · ATR(100)×1.0 band</span></h2>'
    + '<div class="note">HalfTrend state machine: bullish floor / bearish ceiling with ATR buffer. '
    + 'Signal on <b>trend flip</b> (bullish after bearish or vice versa). Stop = HalfTrend line (trailing). '
    + 'Same 7-gate intersection as other Pine tabs.</div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="pineHtRun">RUN HT SCAN</button>'
    + '<span class="note" id="pineHtStat">Run gate tabs first, then scan.</span>'
    + '</div>'
    + '<div class="prog" id="pineHtProg"><i></i></div>'
    + '<div id="pineHtFunnel" style="margin-top:8px"></div>'
    + '<div id="pineHtOut" style="margin-top:12px"><div class="empty">Press RUN HT SCAN after gate tabs have run.</div></div>'
    + '</div>';

  var btn = el.querySelector('#pineHtRun');
  var stat = el.querySelector('#pineHtStat');
  var prog = el.querySelector('#pineHtProg');
  var out = el.querySelector('#pineHtOut');
  var funnelEl = el.querySelector('#pineHtFunnel');

  function setProg(p){
    if (!prog) return;
    if (p === null || p === undefined){ prog.classList.remove('on'); prog.querySelector('i').style.width = '0'; return; }
    prog.classList.add('on');
    prog.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
  }

  async function runScan(opts){
    opts = opts || {};
    if (__pineHtTab.busy) return 'busy';
    __pineHtTab.busy = true;
    __pineHtTab.hasRun = true;
    if (btn) btn.disabled = true;
    setProg(0.02);
    if (out) out.innerHTML = '';
    var status = 'refreshed';
    var t0 = Date.now();
    try{
      if (stat) stat.textContent = 'Building 7-gate universe…';
      var gate = (typeof W.pineGateLive === 'function') ? W.pineGateLive() : { eligible: [], funnel: {}, missing: ['pinegate'] };
      if (funnelEl && typeof W.hgFunnelPanelHTML === 'function' && typeof W.pineFunnelRows === 'function'){
        funnelEl.innerHTML = W.hgFunnelPanelHTML('HT gate funnel (all tabs must agree on sym+dir)',
          W.pineFunnelRows(gate.funnel), 'pineHtGateFunnel');
      }
      if (!gate.eligible || !gate.eligible.length){
        var miss = (gate.missing && gate.missing.length) ? gate.missing.join(', ') : 'none aligned';
        if (out) out.innerHTML = '<div class="empty"><b>WAIT.</b> No contracts pass all seven gates. Missing: '
          + esc(miss) + '.</div>';
        if (stat) stat.textContent = 'done · 0 eligible · ' + miss;
        __pineHtSnap = { at: Date.now(), signals: [], gate: gate, stat: stat ? stat.textContent : '' };
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
          if (stat) stat.textContent = 'HT ' + n + '/' + eligible.length + ' · ' + item.sym + ' ' + item.dir.toUpperCase();
          setProg(0.05 + 0.9 * (n / eligible.length));
          try{
            var rows = await W.getCandles(item.sym, TF, KL_BARS);
            if (!rows || rows.length < 110){ failed++; return; }
            var res = runHt(rows);
            var sig = signalFromResult(item, res, rows);
            if (sig) signals.push(sig);
          }catch(e){ failed++; }
        }));
        if (ci + CHUNK < eligible.length) await sleep(CHUNK_SLEEP_MS);
      }

      signals.sort(function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.entry - b.stop) - Math.abs(a.entry - a.stop);
      });

      var freshNew = signals.filter(function(s){ return s.isNew; });
      if (!opts.quiet && freshNew.length && typeof W.pineFireAlerts === 'function'){
        try{ await W.pineFireAlerts(freshNew); }catch(eAl){ console.warn('pine ht alert', eAl); }
      }

      __pineHtSnap = { at: Date.now(), signals: signals, gate: gate, stat: '' };

      if (!signals.length){
        if (out) out.innerHTML = '<div class="empty">' + eligible.length + ' gated contracts — no HalfTrend flip on latest bar.</div>';
      } else {
        if (out) out.innerHTML = signals.map(cardHTML).join('');
      }

      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var newN = freshNew.length;
      if (stat) stat.textContent = 'done · ' + eligible.length + ' gated · ' + signals.length + ' HT signal(s)'
        + (newN ? (' · ' + newN + ' NEW alerted') : '') + ' · failed ' + failed + ' · ' + dt + 's';
      __pineHtSnap.stat = stat ? stat.textContent : '';
    }catch(e){
      status = 'error: ' + ((e && e.message) || e);
      if (stat) stat.textContent = status;
      if (out) out.innerHTML = '<div class="empty">HT scan failed: ' + esc(status) + '</div>';
    }finally{
      if (btn) btn.disabled = false;
      setProg(null);
      __pineHtTab.busy = false;
    }
    return status;
  }

  if (btn) btn.addEventListener('click', function(){ runScan(); });
  __pineHtTab.run = runScan;
}

async function pineHtRefresh(){
  try{
    if (__pineHtTab.busy) return 'busy';
    if (!__pineHtTab.hasRun || typeof __pineHtTab.run !== 'function') return 'skipped: not run yet';
    return await __pineHtTab.run({ quiet: false });
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

W.pineHtScan = function(){ try{ return __pineHtSnap; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-ht', label: 'PINE HT', mount: mount, refresh: pineHtRefresh });

})();
