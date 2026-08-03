/* HARDGATE — pinecipher.js
   PINE CIPHER tab: VuManChu Cipher B WaveTrend divergence on 7-gate universe. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var KL_BARS = 120;
var TF = '4h';
var CHUNK = 4;
var CHUNK_SLEEP_MS = 120;
var CIPHER_SCRIPT = {
  id: 'vumanchu-cipher',
  label: 'VuManChu Cipher B',
  fn: 'pineVumanchuCipher',
  opts: { wtChannelLen: 9, wtAvgLen: 21, osLevel: -53, obLevel: 53 }
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

function runCipher(rows){
  try{
    var fn = W[CIPHER_SCRIPT.fn];
    if (typeof fn !== 'function') return null;
    return fn(rows, CIPHER_SCRIPT.opts || {});
  }catch(e){ return null; }
}

function signalFromResult(item, res, rows){
  if (!res || !res.dir) return null;
  if (String(res.dir).toLowerCase() !== item.dir) return null;
  var plan = buildPlan(item.dir, res.price, rows);
  var sig = {
    sym: item.sym,
    dir: item.dir,
    scriptId: CIPHER_SCRIPT.id,
    scriptLabel: CIPHER_SCRIPT.label,
    signalType: res.signalType,
    wt1: res.wt1,
    wt2: res.wt2,
    osLevel: res.osLevel,
    obLevel: res.obLevel,
    lastSwingLowPrice: res.lastSwingLowPrice,
    lastSwingLowWt: res.lastSwingLowWt,
    lastSwingHighPrice: res.lastSwingHighPrice,
    lastSwingHighWt: res.lastSwingHighWt,
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
  var divLabel = sig.signalType === 'bull_div' ? 'BULL DIV' : (sig.signalType === 'bear_div' ? 'BEAR DIV' : 'DIV');
  var badge = sig.isNew ? '<span class="stamp pass" style="margin-left:6px">' + divLabel + '</span>' : '';
  var gateNote = sig.gates && sig.gates.regime ? esc(sig.gates.regime) : '';
  return '<div class="panel ' + cls + '" style="margin-bottom:12px">'
    + '<h2>' + esc(sig.sym) + ' <span>' + esc(sig.dir.toUpperCase()) + ' · VuManChu Cipher B' + badge + '</span></h2>'
    + '<div class="note">WaveTrend WT1 <b>' + fmtF(sig.wt1, 2) + '</b> · WT2 ' + fmtF(sig.wt2, 2)
    + ' · ' + divLabel
    + ' · mark ' + pxF(sig.price)
    + (gateNote ? ' · ' + gateNote : '')
    + '</div>'
    + '<div class="plan">' + (typeof W.planBlock === 'function'
      ? W.planBlock(sig.dir, sig.entry, sig.stop, sig.t1, sig.t2, sig.planSrc || '')
      : ('ENTRY ' + pxF(sig.entry) + ' · SL ' + pxF(sig.stop) + ' · T1 ' + pxF(sig.t1))) + '</div>'
    + '<button class="toTrade" onclick="toTrade(\'' + esc(sig.sym) + '\',\'' + sig.dir + '\',' + sig.entry + ',' + sig.stop + ',' + sig.t1 + ')">SEND TO TRADE PLAN →</button>'
    + (typeof W.hgBookBtn === 'function'
      ? W.hgBookBtn(sig.sym, sig.dir, sig.entry, sig.stop, sig.t1, { scanner: 'pine-cipher', strategy: sig.scriptId, t2: sig.t2 })
      : '')
    + '</div>';
}

var __pineCipherSnap = null;
var __pineCipherTab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>PINE CIPHER <span>VuManChu Cipher B · WaveTrend 9/21 · OS −53 · OB +53</span></h2>'
    + '<div class="note">WaveTrend oscillator with green/red momentum dots. '
    + '<b>Bull div</b>: green dot in oversold, price lower low but WT1 higher low. '
    + '<b>Bear div</b>: red dot in overbought, price higher high but WT1 lower high. '
    + 'Same 7-gate intersection as other Pine tabs.</div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="pineCipherRun">RUN CIPHER SCAN</button>'
    + '<span class="note" id="pineCipherStat">Run gate tabs first, then scan.</span>'
    + '</div>'
    + '<div class="prog" id="pineCipherProg"><i></i></div>'
    + '<div id="pineCipherFunnel" style="margin-top:8px"></div>'
    + '<div id="pineCipherOut" style="margin-top:12px"><div class="empty">Press RUN CIPHER SCAN after gate tabs have run.</div></div>'
    + '</div>';

  var btn = el.querySelector('#pineCipherRun');
  var stat = el.querySelector('#pineCipherStat');
  var prog = el.querySelector('#pineCipherProg');
  var out = el.querySelector('#pineCipherOut');
  var funnelEl = el.querySelector('#pineCipherFunnel');

  function setProg(p){
    if (!prog) return;
    if (p === null || p === undefined){ prog.classList.remove('on'); prog.querySelector('i').style.width = '0'; return; }
    prog.classList.add('on');
    prog.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
  }

  async function runScan(opts){
    opts = opts || {};
    if (__pineCipherTab.busy) return 'busy';
    __pineCipherTab.busy = true;
    __pineCipherTab.hasRun = true;
    if (btn) btn.disabled = true;
    setProg(0.02);
    if (out) out.innerHTML = '';
    var status = 'refreshed';
    var t0 = Date.now();
    try{
      if (stat) stat.textContent = 'Building 7-gate universe…';
      var gate = (typeof W.pineGateLive === 'function') ? W.pineGateLive() : { eligible: [], funnel: {}, missing: ['pinegate'] };
      if (funnelEl && typeof W.hgFunnelPanelHTML === 'function' && typeof W.pineFunnelRows === 'function'){
        funnelEl.innerHTML = W.hgFunnelPanelHTML('Cipher gate funnel (all tabs must agree on sym+dir)',
          W.pineFunnelRows(gate.funnel), 'pineCipherGateFunnel');
      }
      if (!gate.eligible || !gate.eligible.length){
        var miss = (gate.missing && gate.missing.length) ? gate.missing.join(', ') : 'none aligned';
        if (out) out.innerHTML = '<div class="empty"><b>WAIT.</b> No contracts pass all seven gates. Missing: '
          + esc(miss) + '.</div>';
        if (stat) stat.textContent = 'done · 0 eligible · ' + miss;
        __pineCipherSnap = { at: Date.now(), signals: [], gate: gate, stat: stat ? stat.textContent : '' };
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
          if (stat) stat.textContent = 'CIPHER ' + n + '/' + eligible.length + ' · ' + item.sym + ' ' + item.dir.toUpperCase();
          setProg(0.05 + 0.9 * (n / eligible.length));
          try{
            var rows = await W.getCandles(item.sym, TF, KL_BARS);
            if (!rows || rows.length < 40){ failed++; return; }
            var res = runCipher(rows);
            var sig = signalFromResult(item, res, rows);
            if (sig) signals.push(sig);
          }catch(e){ failed++; }
        }));
        if (ci + CHUNK < eligible.length) await sleep(CHUNK_SLEEP_MS);
      }

      signals.sort(function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.wt1 || 0) - Math.abs(a.wt1 || 0);
      });

      var freshNew = signals.filter(function(s){ return s.isNew; });
      if (!opts.quiet && freshNew.length && typeof W.pineFireAlerts === 'function'){
        try{ await W.pineFireAlerts(freshNew); }catch(eAl){ console.warn('pine cipher alert', eAl); }
      }

      __pineCipherSnap = { at: Date.now(), signals: signals, gate: gate, stat: '' };

      if (!signals.length){
        if (out) out.innerHTML = '<div class="empty">' + eligible.length + ' gated contracts — no Cipher divergence on latest bar.</div>';
      } else {
        if (out) out.innerHTML = signals.map(cardHTML).join('');
      }

      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var newN = freshNew.length;
      if (stat) stat.textContent = 'done · ' + eligible.length + ' gated · ' + signals.length + ' Cipher signal(s)'
        + (newN ? (' · ' + newN + ' NEW alerted') : '') + ' · failed ' + failed + ' · ' + dt + 's';
      __pineCipherSnap.stat = stat ? stat.textContent : '';
    }catch(e){
      status = 'error: ' + ((e && e.message) || e);
      if (stat) stat.textContent = status;
      if (out) out.innerHTML = '<div class="empty">Cipher scan failed: ' + esc(status) + '</div>';
    }finally{
      if (btn) btn.disabled = false;
      setProg(null);
      __pineCipherTab.busy = false;
    }
    return status;
  }

  if (btn) btn.addEventListener('click', function(){ runScan(); });
  __pineCipherTab.run = runScan;
}

async function pineCipherRefresh(){
  try{
    if (__pineCipherTab.busy) return 'busy';
    if (!__pineCipherTab.hasRun || typeof __pineCipherTab.run !== 'function') return 'skipped: not run yet';
    return await __pineCipherTab.run({ quiet: false });
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

W.pineCipherScan = function(){ try{ return __pineCipherSnap; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-cipher', label: 'PINE CIPHER', mount: mount, refresh: pineCipherRefresh });

})();
