/* HARDGATE — pinesmf.js — Smart Money Flow on EDGE+ Pine universe. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var SMF_SCRIPT = { id: 'smart-money-flow', label: 'Smart Money Flow', fn: 'pineSmartMoneyFlow', opts: { length: 21, threshold: 0.10 } };
var EDGE_NOTE = W.PINE_EDGE_UNIVERSE_NOTE || 'Run EDGE scan first.';
function fin(v){ return typeof v === 'number' && isFinite(v); }
function fmtF(n, d){ return (typeof W.fmt === 'function') ? W.fmt(n, d) : (fin(+n) ? (+n).toFixed(d === undefined ? 2 : d) : '—'); }

function signalFromResult(item, res, rows){
  if (!res || !res.dir || String(res.dir).toLowerCase() !== item.dir) return null;
  var plan = W.pineSubBuildPlan(item.dir, res.price, rows);
  var sig = {
    sym: item.sym, dir: item.dir, scriptId: SMF_SCRIPT.id, scriptLabel: SMF_SCRIPT.label,
    smf: res.smf, threshold: res.threshold, newLong: !!res.newLong, newShort: !!res.newShort,
    isNew: !!(res.newLong || res.newShort), price: res.price,
    entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2, planSrc: plan.planSrc,
    gates: item.gates, rows: rows
  };
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  return W.pineSubEnrichSignal(sig, item, res);
}
function smfNote(sig){ return 'SMF ' + fmtF(sig.smf, 4) + ' · cross ±' + fmtF(sig.threshold, 2); }
function cardHTML(sig){ return W.pineSubCardHTML(sig, { scanner: 'pine-smf', noteFn: smfNote }); }

var __snap = { current: null };
var __tab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML = '<div class="panel"><h2>PINE SMF <span>Smart Money Flow · ratio cross ±0.10</span></h2>'
    + '<div class="note"><b>Long</b> when SMF crosses above +0.10 (accumulation). <b>Short</b> below −0.10. '
    + EDGE_NOTE + '</div>'
    + '<div class="row" style="margin-top:10px"><button class="btn" id="pineSmfRun">RUN SMF SCAN</button>'
    + '<span class="note" id="pineSmfStat">Run EDGE scan first, then scan.</span></div>'
    + '<div class="prog" id="pineSmfProg"><i></i></div><div id="pineSmfFunnel" style="margin-top:8px"></div>'
    + '<div id="pineSmfDesk"></div><div id="pineSmfOut" style="margin-top:12px">'
    + '<div class="empty">Press RUN SMF SCAN after EDGE has run.</div></div></div>';
  var ui = { btn: el.querySelector('#pineSmfRun'), stat: el.querySelector('#pineSmfStat'), prog: el.querySelector('#pineSmfProg'),
    out: el.querySelector('#pineSmfOut'), funnelEl: el.querySelector('#pineSmfFunnel') };
  W.pineSubMountDesk(el.querySelector('#pineSmfDesk'), 'PINE SMF');
  async function runScan(opts){
    return W.pineSubRunScan({
      ui: ui, state: __tab, snap: __snap, script: SMF_SCRIPT, signalFn: signalFromResult, cardFn: cardHTML,
      statLabel: 'SMF', funnelId: 'pineSmfGateFunnel',
      funnelTitle: 'SMF · PINE universe (EDGE tickets + forming + REGIME)',
      emptyDetail: 'no SMF cross NEW, RECENT, or ALIGNED match on this scan.',
      sortFn: function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.smf || 0) - Math.abs(a.smf || 0);
      }
    }, opts);
  }
  if (ui.btn) ui.btn.addEventListener('click', function(){ runScan(); });
  __tab.run = runScan;
}
async function pineSmfRefresh(){
  if (__tab.busy) return 'busy';
  if (!__tab.hasRun || typeof __tab.run !== 'function') return 'skipped: not run yet';
  return __tab.run({ quiet: false });
}
W.pineSmfScan = function(){ try{ return __snap.current; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-smf', label: 'PINE SMF', mount: mount, refresh: pineSmfRefresh });
})();
