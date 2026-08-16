/* HARDGATE — pine-sub.js
   Shared scan/render helpers for single-script PINE sub-tabs (MSB, SQZ, …).
   Loaded after pine.js; uses same EDGE+ gate and PINE_SCAN_OPTS as main PINE tab. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var PINE_EDGE_UNIVERSE_NOTE = 'Same <b>EDGE+</b> universe as crypto PINE: tickets (tally ≥3), forming watch, soft tally ≥2, REGIME — '
  + 'falls back to <b>SWING CLEAN</b>. Shows <b>NEW</b>, <b>RECENT</b> (5 bars), and <b>ALIGNED</b> context. Run <b>EDGE</b> first.';

function fin(v){ return typeof v === 'number' && isFinite(v); }

function pineSubEsc(s){
  return String(s || '').replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; });
}

function pineSubGate(){
  var opts = W.PINE_GATE_OPTS || { mode: 'edge' };
  return (typeof W.pineGateLive === 'function')
    ? W.pineGateLive(null, opts)
    : { eligible: [], funnel: {}, missing: ['pinegate'] };
}

function pineSubScriptOpts(scriptOpts){
  var base = W.PINE_SCAN_OPTS || { includeContext: true, recentBars: 5 };
  return Object.assign({}, base, scriptOpts || {});
}

function pineSubRunScript(script, rows){
  try{
    var fn = W[script.fn];
    if (typeof fn !== 'function') return null;
    return fn(rows, pineSubScriptOpts(script.opts));
  }catch(e){ return null; }
}

function pineSubEnrichSignal(sig, item, res){
  if (!sig || !item || !res) return null;
  var isFresh = !!(sig.isNew || res.newLong || res.newShort);
  sig.isNew = isFresh;
  var recentBars = (W.PINE_SCAN_OPTS && W.PINE_SCAN_OPTS.recentBars) || 5;
  var isRecent = !isFresh && fin(+res.barsAgo) && res.barsAgo > 0 && res.barsAgo <= recentBars;
  sig.isRecent = isRecent;
  var isContext = !isFresh && !isRecent
    && !!(res.aligned || (res.aligned === undefined && !res.newLong && !res.newShort));
  sig.isContext = isContext && !isRecent;
  sig.edgeForming = !!item.edgeForming;
  sig.edgeTicket = !!item.edgeTicket;
  sig.gateHits = item.gateHits;
  if (!sig.gates) sig.gates = item.gates;
  if (!isFresh && !isRecent && !isContext) return null;
  return sig;
}

function pineSubBuildPlan(dir, price, rows){
  try{
    if (typeof W.smartSetup === 'function' && rows && rows.length){
      var cls = { dir: dir, longEv: dir === 'long' ? ['pine signal'] : [], shortEv: dir === 'short' ? ['pine signal'] : [], score: 1 };
      var ss = W.smartSetup(cls, rows, rows);
      if (ss && fin(+ss.entry) && fin(+ss.stop) && fin(+ss.t1)) return ss;
    }
    if (typeof W.hgStructureStop === 'function' && rows && rows.length){
      var st = W.hgStructureStop(dir, price, rows, { atrLen: 14, look: 20 });
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

function pineSubCardHTML(sig, opts){
  opts = opts || {};
  if (!sig.stack && typeof W.hgSetupStackForPineSig === 'function'){
    try{ sig.stack = W.hgSetupStackForPineSig(sig); }catch(e){}
  }
  if (typeof W.hgSetupPanelHTML === 'function'){
    return W.hgSetupPanelHTML(sig, {
      scanner: opts.scanner || 'pine',
      label: sig.scriptLabel || opts.label,
      noteFn: opts.noteFn
    });
  }
  return '';
}

function pineSubMountDesk(el, tabLabel){
  try{
    if (!el) return;
    if (typeof W.hgSetupDeskBannerHTML === 'function'){
      el.innerHTML = W.hgSetupDeskBannerHTML({
        kind: 'pine',
        tab: tabLabel || 'PINE',
        note: 'NEW = CLEAN ticket · RECENT/ALIGNED = FORMING/NEAR — same tiers as main PINE tab.'
      });
    }
    if (typeof W.hgSetupInjectStyles === 'function') W.hgSetupInjectStyles();
  }catch(e){}
}

function pineSubGateEmptyHTML(miss){
  miss = miss || 'EDGE empty';
  return '<div class="empty"><b>WAIT.</b> No sym+dir pairs in the Pine universe. '
    + 'Run <b>EDGE</b> scan first (SWING fallback applies). Missing: '
    + pineSubEsc(miss) + '.</div>';
}

function pineSubRenderOut(signals, gate, cardFn, emptyDetail){
  if (typeof W.renderPineOut === 'function'){
    return W.renderPineOut(signals, gate, { cardFn: cardFn, emptyDetail: emptyDetail });
  }
  return '<div class="empty">Pine UI unavailable — reload HARDGATE.</div>';
}

function pineSubVisibleCount(signals){
  if (typeof W.pineSignalVisible === 'function'){
    return (signals || []).filter(W.pineSignalVisible).length;
  }
  return (signals || []).length;
}

function pineSubAlertBatch(signals, opts){
  opts = opts || {};
  var batch = signals;
  if (typeof W.pineAlertable === 'function'){
    batch = (signals || []).filter(W.pineAlertable);
  } else {
    batch = (signals || []).filter(function(s){ return s && s.isNew; });
  }
  if (!batch.length || opts.quiet || typeof W.pineFireAlerts !== 'function') return Promise.resolve(batch);
  return W.pineFireAlerts(batch, opts).then(function(){ return batch; }).catch(function(){
    return batch;
  });
}

/** Shared EDGE+ scan loop for single-script Pine sub-tabs. cfg.ui: { btn, stat, prog, out, funnelEl }. */
function pineSubRunScan(cfg, opts){
  opts = opts || {};
  cfg = cfg || {};
  var ui = cfg.ui || {};
  var state = cfg.state || {};
  var script = cfg.script;
  var TF = cfg.tf || '4h';
  var KL_BARS = cfg.klBars || 160;
  var CHUNK = cfg.chunk || 4;
  var CHUNK_SLEEP_MS = cfg.chunkSleep || 120;
  var minBars = cfg.minBars || 30;
  var funnelTitle = cfg.funnelTitle || 'PINE sub-tab universe (EDGE tickets + forming + REGIME)';
  var emptyDetail = cfg.emptyDetail || 'no script match on this scan.';
  var statLabel = cfg.statLabel || 'Pine';
  var cardFn = cfg.cardFn;
  var signalFn = cfg.signalFn;
  var sortFn = cfg.sortFn;

  if (state.busy) return Promise.resolve('busy');
  state.busy = true;
  state.hasRun = true;
  if (ui.btn) ui.btn.disabled = true;
  if (ui.prog) pineSubSetProg(ui.prog, 0.02);
  if (ui.out) ui.out.innerHTML = '';
  var status = 'refreshed';
  var t0 = Date.now();

  return Promise.resolve().then(async function(){
    if (ui.stat) ui.stat.textContent = 'Building EDGE Pine universe…';
    var gate = pineSubGate();
    if (ui.funnelEl && typeof W.hgFunnelPanelHTML === 'function' && typeof W.pineFunnelRows === 'function'){
      ui.funnelEl.innerHTML = W.hgFunnelPanelHTML(funnelTitle, W.pineFunnelRows(gate.funnel), cfg.funnelId || 'pineSubFunnel');
    }
    if (!gate.eligible || !gate.eligible.length){
      var miss = (gate.missing && gate.missing.length) ? gate.missing.join(', ') : 'EDGE empty';
      if (ui.out) ui.out.innerHTML = pineSubGateEmptyHTML(miss);
      if (ui.stat) ui.stat.textContent = 'done · 0 eligible · ' + miss;
      if (cfg.snap) cfg.snap.current = { at: Date.now(), signals: [], gate: gate, stat: ui.stat ? ui.stat.textContent : '' };
      return status;
    }
    if (typeof W.getCandles !== 'function'){
      if (ui.out) ui.out.innerHTML = '<div class="empty">getCandles unavailable.</div>';
      return 'failed: no getCandles';
    }

    var eligible = gate.eligible.slice();
    var signals = [];
    var failed = 0;
    for (var ci = 0; ci < eligible.length; ci += CHUNK){
      var chunk = eligible.slice(ci, ci + CHUNK);
      await Promise.all(chunk.map(async function(item, ix){
        var n = ci + ix + 1;
        if (ui.stat) ui.stat.textContent = statLabel + ' ' + n + '/' + eligible.length + ' · ' + item.sym + ' ' + item.dir.toUpperCase();
        pineSubSetProg(ui.prog, 0.05 + 0.9 * (n / eligible.length));
        try{
          var rows = await W.getCandles(item.sym, TF, KL_BARS);
          if (!rows || rows.length < minBars){ failed++; return; }
          var res = pineSubRunScript(script, rows);
          var sig = signalFn(item, res, rows);
          if (sig) signals.push(sig);
        }catch(e){ failed++; }
      }));
      if (ci + CHUNK < eligible.length) await sleepMs(CHUNK_SLEEP_MS);
    }

    if (typeof sortFn === 'function') signals.sort(sortFn);

    /* FORWARD LOG — one hook for all nine PINE sub-tabs. They share this
       harness and nothing else, so instrumenting here covers MSB, SQZ, SMF,
       HT, SMC, CIPHER, RF, NW and AVWAP at once.
       Only FRESH signals are recorded. isRecent and isContext are the same
       setup seen again some bars later, and recording those would count one
       signal several times as it aged through the window — the precise
       inflation this log exists to avoid. The script id is the mechanic, so
       each PINE script is measured on its own rather than pooled into one
       undifferentiated "PINE" number. */
    try {
      if (typeof W.hgFwdRecordScan === 'function'){
        var fwd = signals.filter(function(sg){
          return sg && sg.isNew && sg.sym && sg.dir
              && fin(+sg.entry) && fin(+sg.stop) && fin(+sg.t1)
              && +sg.entry !== +sg.stop;
        }).map(function(sg){
          return { sym: sg.sym, dir: sg.dir, entry: +sg.entry, stop: +sg.stop, t1: +sg.t1,
                   mechanic: String(sg.scriptId || statLabel || 'PINE').toUpperCase().slice(0, 24),
                   ticket: !!sg.edgeTicket };
        });
        if (fwd.length) W.hgFwdRecordScan('PINE', TF, fwd, { horizonBars: 20 });
      }
    } catch (eFwd) {}

    /* Settle open PINE records with bars this scan already fetched. Kept to
       the last chunk's rows rather than refetching — resolution is
       best-effort, and OMNIROUTE's full sweep settles anything missed. */
    try {
      if (typeof W.hgFwdResolve === 'function'){
        for (var ri = 0; ri < signals.length; ri++){
          var sr = signals[ri];
          if (sr && sr.sym && sr.rows && sr.rows.length) W.hgFwdResolve(sr.sym, null, sr.rows);
        }
      }
    } catch (eRes) {}

    try{ await pineSubAlertBatch(signals, opts); }catch(eAl){ console.warn('pine sub alert', eAl); }

    if (cfg.snap) cfg.snap.current = { at: Date.now(), signals: signals, gate: gate, stat: '' };
    if (ui.out && cardFn){
      ui.out.innerHTML = pineSubRenderOut(signals, gate, cardFn, emptyDetail);
    }

    var dt = ((Date.now() - t0) / 1000).toFixed(1);
    var visN = pineSubVisibleCount(signals);
    var newN = signals.filter(function(s){ return s.isNew; }).length;
    if (ui.stat){
      ui.stat.textContent = 'done · ' + eligible.length + ' gated · ' + visN + ' ' + statLabel + ' signal(s)'
        + (newN ? (' · ' + newN + ' NEW') : '') + ' · failed ' + failed + ' · ' + dt + 's';
    }
    if (cfg.snap && cfg.snap.current) cfg.snap.current.stat = ui.stat ? ui.stat.textContent : '';
    return status;
  }).catch(function(e){
    status = 'error: ' + ((e && e.message) || e);
    if (ui.stat) ui.stat.textContent = status;
    if (ui.out) ui.out.innerHTML = '<div class="empty">' + pineSubEsc(statLabel) + ' scan failed: ' + pineSubEsc(status) + '</div>';
    return status;
  }).finally(function(){
    if (ui.btn) ui.btn.disabled = false;
    pineSubSetProg(ui.prog, null);
    state.busy = false;
  });
}

function pineSubSetProg(prog, p){
  if (!prog) return;
  if (p === null || p === undefined){
    prog.classList.remove('on');
    var bar = prog.querySelector('i');
    if (bar) bar.style.width = '0';
    return;
  }
  prog.classList.add('on');
  var bar2 = prog.querySelector('i');
  if (bar2) bar2.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
}

function sleepMs(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

W.PINE_EDGE_UNIVERSE_NOTE = PINE_EDGE_UNIVERSE_NOTE;
W.pineSubGate = pineSubGate;
W.pineSubScriptOpts = pineSubScriptOpts;
W.pineSubRunScript = pineSubRunScript;
W.pineSubEnrichSignal = pineSubEnrichSignal;
W.pineSubBuildPlan = pineSubBuildPlan;
W.pineSubCardHTML = pineSubCardHTML;
W.pineSubMountDesk = pineSubMountDesk;
W.pineSubGateEmptyHTML = pineSubGateEmptyHTML;
W.pineSubRenderOut = pineSubRenderOut;
W.pineSubVisibleCount = pineSubVisibleCount;
W.pineSubAlertBatch = pineSubAlertBatch;
W.pineSubRunScan = pineSubRunScan;
W.pineSubSetProg = pineSubSetProg;

})();
