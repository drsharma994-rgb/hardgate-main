/* HARDGATE — pinesmc.js
   PINE SMC tab: SMC Core Math (CHoCH + FVG limit) on 7-gate universe. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var KL_BARS = 160;
var TF = '4h';
var CHUNK = 4;
var CHUNK_SLEEP_MS = 120;
var SMC_SCRIPT = {
  id: 'smc-core',
  label: 'SMC: Core Math',
  fn: 'pineSmcCore',
  opts: { pivotLength: 5, atrLen: 14 }
};

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function fin(v){ return typeof v === 'number' && isFinite(v); }

function pxF(n){
  if (typeof W.px === 'function') return W.px(n);
  if (!fin(+n)) return '—';
  return String(+n);
}

function runSmc(rows){
  try{
    var fn = W[SMC_SCRIPT.fn];
    if (typeof fn !== 'function') return null;
    return fn(rows, SMC_SCRIPT.opts || {});
  }catch(e){ return null; }
}

function signalFromResult(item, res, rows){
  if (!res || !res.dir) return null;
  if (String(res.dir).toLowerCase() !== item.dir) return null;
  if (!fin(+res.entry) || !fin(+res.stop) || res.entry === res.stop) return null;
  var t1 = fin(+res.t1) ? +res.t1 : null;
  var t2 = fin(+res.t2) ? +res.t2 : null;
  if (!fin(t1)){
    var risk = Math.abs(res.entry - res.stop);
    t1 = item.dir === 'long' ? res.entry + 2 * risk : res.entry - 2 * risk;
    t2 = item.dir === 'long' ? res.entry + 3.5 * risk : res.entry - 3.5 * risk;
  }
  var sig = {
    sym: item.sym,
    dir: item.dir,
    scriptId: SMC_SCRIPT.id,
    scriptLabel: SMC_SCRIPT.label,
    zoneEntry: res.zoneEntry,
    zoneTop: res.zoneTop,
    zoneBot: res.zoneBot,
    lastSh: res.lastSh,
    lastSl: res.lastSl,
    pivotLength: res.pivotLength,
    newLong: !!res.newLong,
    newShort: !!res.newShort,
    isNew: !!(res.newLong || res.newShort),
    price: res.price,
    entry: res.entry,
    stop: res.stop,
    t1: t1,
    t2: t2,
    planSrc: 'SMC FVG zone limit (CHoCH)',
    gates: item.gates,
    rows: rows
  };
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  return sig;
}

function cardHTML(sig){
  var cls = sig.dir === 'long' ? 'long' : 'short';
  var badge = sig.isNew ? '<span class="stamp pass" style="margin-left:6px">CHoCH</span>' : '';
  var gateNote = sig.gates && sig.gates.regime ? esc(sig.gates.regime) : '';
  return '<div class="panel ' + cls + '" style="margin-bottom:12px">'
    + '<h2>' + esc(sig.sym) + ' <span>' + esc(sig.dir.toUpperCase()) + ' · SMC CHoCH + FVG' + badge + '</span></h2>'
    + '<div class="note">Limit @ FVG zone <b>' + pxF(sig.zoneEntry) + '</b>'
    + ' · SH ' + pxF(sig.lastSh) + ' · SL ' + pxF(sig.lastSl)
    + ' · mark ' + pxF(sig.price)
    + (gateNote ? ' · ' + gateNote : '')
    + '</div>'
    + '<div class="plan">' + (typeof W.planBlock === 'function'
      ? W.planBlock(sig.dir, sig.entry, sig.stop, sig.t1, sig.t2, sig.planSrc || '')
      : ('LIMIT ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · T1 ' + pxF(sig.t1))) + '</div>'
    + '<button class="toTrade" onclick="toTrade(\'' + esc(sig.sym) + '\',\'' + sig.dir + '\',' + sig.entry + ',' + sig.stop + ',' + sig.t1 + ')">SEND TO TRADE PLAN →</button>'
    + (typeof W.hgBookBtn === 'function'
      ? W.hgBookBtn(sig.sym, sig.dir, sig.entry, sig.stop, sig.t1, { scanner: 'pine-smc', strategy: sig.scriptId, t2: sig.t2 })
      : '')
    + '</div>';
}

var __pineSmcSnap = null;
var __pineSmcTab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>PINE SMC <span>CHoCH + Fair Value Gap · pivot 5/5 · limit @ FVG</span></h2>'
    + '<div class="note">Fractal swing highs/lows, 3-candle FVG imbalance zones, and <b>Change of Character</b> '
    + '(first break against trend). Bull CHoCH in bear trend → limit long at bull FVG top, stop below gap − ATR. '
    + 'Bear CHoCH → limit short at bear FVG bottom. Same 7-gate intersection as other Pine tabs.</div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="pineSmcRun">RUN SMC SCAN</button>'
    + '<span class="note" id="pineSmcStat">Run gate tabs first, then scan.</span>'
    + '</div>'
    + '<div class="prog" id="pineSmcProg"><i></i></div>'
    + '<div id="pineSmcFunnel" style="margin-top:8px"></div>'
    + '<div id="pineSmcOut" style="margin-top:12px"><div class="empty">Press RUN SMC SCAN after gate tabs have run.</div></div>'
    + '</div>';

  var btn = el.querySelector('#pineSmcRun');
  var stat = el.querySelector('#pineSmcStat');
  var prog = el.querySelector('#pineSmcProg');
  var out = el.querySelector('#pineSmcOut');
  var funnelEl = el.querySelector('#pineSmcFunnel');

  function setProg(p){
    if (!prog) return;
    if (p === null || p === undefined){ prog.classList.remove('on'); prog.querySelector('i').style.width = '0'; return; }
    prog.classList.add('on');
    prog.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
  }

  async function runScan(opts){
    opts = opts || {};
    if (__pineSmcTab.busy) return 'busy';
    __pineSmcTab.busy = true;
    __pineSmcTab.hasRun = true;
    if (btn) btn.disabled = true;
    setProg(0.02);
    if (out) out.innerHTML = '';
    var status = 'refreshed';
    var t0 = Date.now();
    try{
      if (stat) stat.textContent = 'Building 7-gate universe…';
      var gate = (typeof W.pineGateLive === 'function') ? W.pineGateLive() : { eligible: [], funnel: {}, missing: ['pinegate'] };
      if (funnelEl && typeof W.hgFunnelPanelHTML === 'function' && typeof W.pineFunnelRows === 'function'){
        funnelEl.innerHTML = W.hgFunnelPanelHTML('SMC gate funnel (all tabs must agree on sym+dir)',
          W.pineFunnelRows(gate.funnel), 'pineSmcGateFunnel');
      }
      if (!gate.eligible || !gate.eligible.length){
        var miss = (gate.missing && gate.missing.length) ? gate.missing.join(', ') : 'none aligned';
        if (out) out.innerHTML = '<div class="empty"><b>WAIT.</b> No contracts pass all seven gates. Missing: '
          + esc(miss) + '.</div>';
        if (stat) stat.textContent = 'done · 0 eligible · ' + miss;
        __pineSmcSnap = { at: Date.now(), signals: [], gate: gate, stat: stat ? stat.textContent : '' };
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
          if (stat) stat.textContent = 'SMC ' + n + '/' + eligible.length + ' · ' + item.sym + ' ' + item.dir.toUpperCase();
          setProg(0.05 + 0.9 * (n / eligible.length));
          try{
            var rows = await W.getCandles(item.sym, TF, KL_BARS);
            if (!rows || rows.length < 30){ failed++; return; }
            var res = runSmc(rows);
            var sig = signalFromResult(item, res, rows);
            if (sig) signals.push(sig);
          }catch(e){ failed++; }
        }));
        if (ci + CHUNK < eligible.length) await sleep(CHUNK_SLEEP_MS);
      }

      signals.sort(function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.entry - b.price) - Math.abs(a.entry - a.price);
      });

      var freshNew = signals.filter(function(s){ return s.isNew; });
      if (!opts.quiet && freshNew.length && typeof W.pineFireAlerts === 'function'){
        try{ await W.pineFireAlerts(freshNew); }catch(eAl){ console.warn('pine smc alert', eAl); }
      }

      __pineSmcSnap = { at: Date.now(), signals: signals, gate: gate, stat: '' };

      if (!signals.length){
        if (out) out.innerHTML = '<div class="empty">' + eligible.length + ' gated contracts — no SMC CHoCH on latest bar.</div>';
      } else {
        if (out) out.innerHTML = signals.map(cardHTML).join('');
      }

      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var newN = freshNew.length;
      if (stat) stat.textContent = 'done · ' + eligible.length + ' gated · ' + signals.length + ' SMC signal(s)'
        + (newN ? (' · ' + newN + ' NEW alerted') : '') + ' · failed ' + failed + ' · ' + dt + 's';
      __pineSmcSnap.stat = stat ? stat.textContent : '';
    }catch(e){
      status = 'error: ' + ((e && e.message) || e);
      if (stat) stat.textContent = status;
      if (out) out.innerHTML = '<div class="empty">SMC scan failed: ' + esc(status) + '</div>';
    }finally{
      if (btn) btn.disabled = false;
      setProg(null);
      __pineSmcTab.busy = false;
    }
    return status;
  }

  if (btn) btn.addEventListener('click', function(){ runScan(); });
  __pineSmcTab.run = runScan;
}

async function pineSmcRefresh(){
  try{
    if (__pineSmcTab.busy) return 'busy';
    if (!__pineSmcTab.hasRun || typeof __pineSmcTab.run !== 'function') return 'skipped: not run yet';
    return await __pineSmcTab.run({ quiet: false });
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

W.pineSmcScan = function(){ try{ return __pineSmcSnap; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-smc', label: 'PINE SMC', mount: mount, refresh: pineSmcRefresh });

})();
