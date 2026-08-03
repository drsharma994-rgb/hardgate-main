/* HARDGATE — pinesmf.js
   PINE SMF tab: Smart Money Flow ratio cross on 7-gate universe. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var KL_BARS = 120;
var TF = '4h';
var CHUNK = 4;
var CHUNK_SLEEP_MS = 120;
var SMF_SCRIPT = {
  id: 'smart-money-flow',
  label: 'Smart Money Flow',
  fn: 'pineSmartMoneyFlow',
  opts: { length: 21, threshold: 0.10 }
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

function runSmf(rows){
  try{
    var fn = W[SMF_SCRIPT.fn];
    if (typeof fn !== 'function') return null;
    return fn(rows, SMF_SCRIPT.opts || {});
  }catch(e){ return null; }
}

function signalFromResult(item, res, rows){
  if (!res || !res.dir) return null;
  if (String(res.dir).toLowerCase() !== item.dir) return null;
  var plan = buildPlan(item.dir, res.price, rows);
  var sig = {
    sym: item.sym,
    dir: item.dir,
    scriptId: SMF_SCRIPT.id,
    scriptLabel: SMF_SCRIPT.label,
    smf: res.smf,
    prevSmf: res.prevSmf,
    threshold: res.threshold,
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
  var badge = sig.isNew ? '<span class="stamp pass" style="margin-left:6px">FLOW CROSS</span>' : '';
  var gateNote = sig.gates && sig.gates.regime ? esc(sig.gates.regime) : '';
  return '<div class="panel ' + cls + '" style="margin-bottom:12px">'
    + '<h2>' + esc(sig.sym) + ' <span>' + esc(sig.dir.toUpperCase()) + ' · Smart Money Flow' + badge + '</span></h2>'
    + '<div class="note">SMF <b>' + fmtF(sig.smf, 4) + '</b> crossed ±' + fmtF(sig.threshold, 2)
    + ' · prev ' + fmtF(sig.prevSmf, 4)
    + ' · mark ' + pxF(sig.price)
    + (gateNote ? ' · ' + gateNote : '')
    + '</div>'
    + '<div class="plan">' + (typeof W.planBlock === 'function'
      ? W.planBlock(sig.dir, sig.entry, sig.stop, sig.t1, sig.t2, sig.planSrc || '')
      : ('ENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · T1 ' + pxF(sig.t1))) + '</div>'
    + '<button class="toTrade" onclick="toTrade(\'' + esc(sig.sym) + '\',\'' + sig.dir + '\',' + sig.entry + ',' + sig.stop + ',' + sig.t1 + ')">SEND TO TRADE PLAN →</button>'
    + (typeof W.hgBookBtn === 'function'
      ? W.hgBookBtn(sig.sym, sig.dir, sig.entry, sig.stop, sig.t1, { scanner: 'pine-smf', strategy: sig.scriptId, t2: sig.t2 })
      : '')
    + '</div>';
}

var __pineSmfSnap = null;
var __pineSmfTab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>PINE SMF <span>Smart Money Flow · MF ratio lookback 21 · trigger ±0.10</span></h2>'
    + '<div class="note">Money-flow multiplier × volume summed over 21 bars → SMF ratio. '
    + '<b>Long</b> when SMF crosses above +0.10 (smart money entering). '
    + '<b>Short</b> when SMF crosses below −0.10 (distribution). Same 7-gate intersection as other Pine tabs.</div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="pineSmfRun">RUN SMF SCAN</button>'
    + '<span class="note" id="pineSmfStat">Run gate tabs first, then scan.</span>'
    + '</div>'
    + '<div class="prog" id="pineSmfProg"><i></i></div>'
    + '<div id="pineSmfFunnel" style="margin-top:8px"></div>'
    + '<div id="pineSmfOut" style="margin-top:12px"><div class="empty">Press RUN SMF SCAN after gate tabs have run.</div></div>'
    + '</div>';

  var btn = el.querySelector('#pineSmfRun');
  var stat = el.querySelector('#pineSmfStat');
  var prog = el.querySelector('#pineSmfProg');
  var out = el.querySelector('#pineSmfOut');
  var funnelEl = el.querySelector('#pineSmfFunnel');

  function setProg(p){
    if (!prog) return;
    if (p === null || p === undefined){ prog.classList.remove('on'); prog.querySelector('i').style.width = '0'; return; }
    prog.classList.add('on');
    prog.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
  }

  async function runScan(opts){
    opts = opts || {};
    if (__pineSmfTab.busy) return 'busy';
    __pineSmfTab.busy = true;
    __pineSmfTab.hasRun = true;
    if (btn) btn.disabled = true;
    setProg(0.02);
    if (out) out.innerHTML = '';
    var status = 'refreshed';
    var t0 = Date.now();
    try{
      if (stat) stat.textContent = 'Building 7-gate universe…';
      var gate = (typeof W.pineGateLive === 'function') ? W.pineGateLive() : { eligible: [], funnel: {}, missing: ['pinegate'] };
      if (funnelEl && typeof W.hgFunnelPanelHTML === 'function' && typeof W.pineFunnelRows === 'function'){
        funnelEl.innerHTML = W.hgFunnelPanelHTML('SMF gate funnel (all tabs must agree on sym+dir)',
          W.pineFunnelRows(gate.funnel), 'pineSmfGateFunnel');
      }
      if (!gate.eligible || !gate.eligible.length){
        var miss = (gate.missing && gate.missing.length) ? gate.missing.join(', ') : 'none aligned';
        if (out) out.innerHTML = '<div class="empty"><b>WAIT.</b> No contracts pass all seven gates. Missing: '
          + esc(miss) + '.</div>';
        if (stat) stat.textContent = 'done · 0 eligible · ' + miss;
        __pineSmfSnap = { at: Date.now(), signals: [], gate: gate, stat: stat ? stat.textContent : '' };
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
          if (stat) stat.textContent = 'SMF ' + n + '/' + eligible.length + ' · ' + item.sym + ' ' + item.dir.toUpperCase();
          setProg(0.05 + 0.9 * (n / eligible.length));
          try{
            var rows = await W.getCandles(item.sym, TF, KL_BARS);
            if (!rows || rows.length < 30){ failed++; return; }
            var res = runSmf(rows);
            var sig = signalFromResult(item, res, rows);
            if (sig) signals.push(sig);
          }catch(e){ failed++; }
        }));
        if (ci + CHUNK < eligible.length) await sleep(CHUNK_SLEEP_MS);
      }

      signals.sort(function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.smf || 0) - Math.abs(a.smf || 0);
      });

      var freshNew = signals.filter(function(s){ return s.isNew; });
      if (!opts.quiet && freshNew.length && typeof W.pineFireAlerts === 'function'){
        try{ await W.pineFireAlerts(freshNew); }catch(eAl){ console.warn('pine smf alert', eAl); }
      }

      __pineSmfSnap = { at: Date.now(), signals: signals, gate: gate, stat: '' };

      if (!signals.length){
        if (out) out.innerHTML = '<div class="empty">' + eligible.length + ' gated contracts — no SMF cross on latest bar.</div>';
      } else {
        if (out) out.innerHTML = signals.map(cardHTML).join('');
      }

      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var newN = freshNew.length;
      if (stat) stat.textContent = 'done · ' + eligible.length + ' gated · ' + signals.length + ' SMF signal(s)'
        + (newN ? (' · ' + newN + ' NEW alerted') : '') + ' · failed ' + failed + ' · ' + dt + 's';
      __pineSmfSnap.stat = stat ? stat.textContent : '';
    }catch(e){
      status = 'error: ' + ((e && e.message) || e);
      if (stat) stat.textContent = status;
      if (out) out.innerHTML = '<div class="empty">SMF scan failed: ' + esc(status) + '</div>';
    }finally{
      if (btn) btn.disabled = false;
      setProg(null);
      __pineSmfTab.busy = false;
    }
    return status;
  }

  if (btn) btn.addEventListener('click', function(){ runScan(); });
  __pineSmfTab.run = runScan;
}

async function pineSmfRefresh(){
  try{
    if (__pineSmfTab.busy) return 'busy';
    if (!__pineSmfTab.hasRun || typeof __pineSmfTab.run !== 'function') return 'skipped: not run yet';
    return await __pineSmfTab.run({ quiet: false });
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

W.pineSmfScan = function(){ try{ return __pineSmfSnap; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-smf', label: 'PINE SMF', mount: mount, refresh: pineSmfRefresh });

})();
