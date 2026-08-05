/* HARDGATE — pinemsb.js
   PINE MSB/OB tab: Market Structure Break + Order Block on EDGE+ universe.
   Separate tab from PINE ML (Lorentzian). Alerts on new Pine setups. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var KL_BARS = 160;
var TF = '4h';
var CHUNK = 4;
var CHUNK_SLEEP_MS = 120;
var MSB_SCRIPT = {
  id: 'msb-ob',
  label: 'MSB & Order Block',
  fn: 'pineMsbOb',
  opts: { leftBars: 5, rightBars: 5 }
};
var EDGE_NOTE = W.PINE_EDGE_UNIVERSE_NOTE || 'Run EDGE scan first.';

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function fin(v){ return typeof v === 'number' && isFinite(v); }

function pxF(n){
  if (typeof W.px === 'function') return W.px(n);
  if (!fin(+n)) return '—';
  return String(+n);
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
    scriptId: MSB_SCRIPT.id,
    scriptLabel: MSB_SCRIPT.label,
    trend: res.trend,
    newLong: !!res.newLong,
    newShort: !!res.newShort,
    isNew: !!(res.newLong || res.newShort),
    price: res.price,
    entry: res.entry,
    stop: res.stop,
    t1: t1,
    t2: t2,
    planSrc: 'MSB order block (limit @ OB)',
    gates: item.gates,
    lastSh: res.lastSh,
    lastSl: res.lastSl,
    rows: rows
  };
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  return (typeof W.pineSubEnrichSignal === 'function') ? W.pineSubEnrichSignal(sig, item, res) : sig;
}

function msbNote(sig){
  return 'Limit @ OB · SH ' + pxF(sig.lastSh) + ' · SL ' + pxF(sig.lastSl);
}

function cardHTML(sig){
  return (typeof W.pineSubCardHTML === 'function')
    ? W.pineSubCardHTML(sig, { scanner: 'pine-msb', noteFn: msbNote })
    : '';
}

var __pineMsbSnap = null;
var __pineMsbTab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>PINE MSB/OB <span>Market Structure Break + Order Block · pivot 5/5 · limit @ OB</span></h2>'
    + '<div class="note">Bull MSB: close breaks last swing high → limit long at last bear candle high, stop at bear low. '
    + 'Bear MSB: close breaks last swing low → limit short at last bull candle low, stop at bull high. '
    + EDGE_NOTE + '</div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="pineMsbRun">RUN MSB/OB SCAN</button>'
    + '<span class="note" id="pineMsbStat">Run EDGE scan first, then scan.</span>'
    + '</div>'
    + '<div class="prog" id="pineMsbProg"><i></i></div>'
    + '<div id="pineMsbFunnel" style="margin-top:8px"></div>'
    + '<div id="pineMsbDesk"></div>'
    + '<div id="pineMsbOut" style="margin-top:12px"><div class="empty">Press RUN MSB/OB SCAN after EDGE has run.</div></div>'
    + '</div>';

  var btn = el.querySelector('#pineMsbRun');
  var stat = el.querySelector('#pineMsbStat');
  var prog = el.querySelector('#pineMsbProg');
  var out = el.querySelector('#pineMsbOut');
  var funnelEl = el.querySelector('#pineMsbFunnel');
  if (typeof W.pineSubMountDesk === 'function'){
    W.pineSubMountDesk(el.querySelector('#pineMsbDesk'), 'PINE MSB/OB');
  }

  function setProg(p){
    if (!prog) return;
    if (p === null || p === undefined){ prog.classList.remove('on'); prog.querySelector('i').style.width = '0'; return; }
    prog.classList.add('on');
    prog.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
  }

  async function runScan(opts){
    opts = opts || {};
    if (__pineMsbTab.busy) return 'busy';
    __pineMsbTab.busy = true;
    __pineMsbTab.hasRun = true;
    if (btn) btn.disabled = true;
    setProg(0.02);
    if (out) out.innerHTML = '';
    var status = 'refreshed';
    var t0 = Date.now();
    try{
      if (stat) stat.textContent = 'Building EDGE Pine universe…';
      var gate = (typeof W.pineSubGate === 'function') ? W.pineSubGate() : { eligible: [], funnel: {}, missing: ['pinegate'] };
      if (funnelEl && typeof W.hgFunnelPanelHTML === 'function' && typeof W.pineFunnelRows === 'function'){
        funnelEl.innerHTML = W.hgFunnelPanelHTML('MSB/OB · PINE universe (EDGE tickets + forming + REGIME)',
          W.pineFunnelRows(gate.funnel), 'pineMsbGateFunnel');
      }
      if (!gate.eligible || !gate.eligible.length){
        var miss = (gate.missing && gate.missing.length) ? gate.missing.join(', ') : 'EDGE empty';
        if (out) out.innerHTML = (typeof W.pineSubGateEmptyHTML === 'function')
          ? W.pineSubGateEmptyHTML(miss)
          : '<div class="empty">WAIT — run EDGE first.</div>';
        if (stat) stat.textContent = 'done · 0 eligible · ' + miss;
        __pineMsbSnap = { at: Date.now(), signals: [], gate: gate, stat: stat ? stat.textContent : '' };
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
          if (stat) stat.textContent = 'MSB/OB ' + n + '/' + eligible.length + ' · ' + item.sym + ' ' + item.dir.toUpperCase();
          setProg(0.05 + 0.9 * (n / eligible.length));
          try{
            var rows = await W.getCandles(item.sym, TF, KL_BARS);
            if (!rows || rows.length < 30){ failed++; return; }
            var res = (typeof W.pineSubRunScript === 'function') ? W.pineSubRunScript(MSB_SCRIPT, rows) : null;
            var sig = signalFromResult(item, res, rows);
            if (sig) signals.push(sig);
          }catch(e){ failed++; }
        }));
        if (ci + CHUNK < eligible.length) await sleep(CHUNK_SLEEP_MS);
      }

      signals.sort(function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
        return Math.abs(b.entry - b.price) - Math.abs(a.entry - a.price);
      });

      if (typeof W.pineSubAlertBatch === 'function'){
        try{ await W.pineSubAlertBatch(signals, opts); }catch(eAl){ console.warn('pine msb alert', eAl); }
      }

      __pineMsbSnap = { at: Date.now(), signals: signals, gate: gate, stat: '' };

      if (out){
        out.innerHTML = (typeof W.pineSubRenderOut === 'function')
          ? W.pineSubRenderOut(signals, gate, cardHTML, 'no MSB/OB NEW, RECENT, or ALIGNED match on this scan.')
          : '';
      }

      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var visN = (typeof W.pineSubVisibleCount === 'function') ? W.pineSubVisibleCount(signals) : signals.length;
      var newN = signals.filter(function(s){ return s.isNew; }).length;
      if (stat) stat.textContent = 'done · ' + eligible.length + ' gated · ' + visN + ' MSB signal(s)'
        + (newN ? (' · ' + newN + ' NEW') : '') + ' · failed ' + failed + ' · ' + dt + 's';
      __pineMsbSnap.stat = stat ? stat.textContent : '';
    }catch(e){
      status = 'error: ' + ((e && e.message) || e);
      if (stat) stat.textContent = status;
      if (out) out.innerHTML = '<div class="empty">MSB scan failed: ' + esc(status) + '</div>';
    }finally{
      if (btn) btn.disabled = false;
      setProg(null);
      __pineMsbTab.busy = false;
    }
    return status;
  }

  if (btn) btn.addEventListener('click', function(){ runScan(); });
  __pineMsbTab.run = runScan;
}

async function pineMsbRefresh(){
  try{
    if (__pineMsbTab.busy) return 'busy';
    if (!__pineMsbTab.hasRun || typeof __pineMsbTab.run !== 'function') return 'skipped: not run yet';
    return await __pineMsbTab.run({ quiet: false });
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

W.pineMsbScan = function(){ try{ return __pineMsbSnap; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-msb', label: 'PINE MSB/OB', mount: mount, refresh: pineMsbRefresh });

})();
