/* HARDGATE — pinerf.js — Range Filter on EDGE+ Pine universe. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var RF_SCRIPT = { id: 'range-filter', label: 'Range Filter', fn: 'pineRangeFilter', opts: { period: 100, mult: 3.0 } };
var EDGE_NOTE = W.PINE_EDGE_UNIVERSE_NOTE || 'Run EDGE scan first.';
function fin(v){ return typeof v === 'number' && isFinite(v); }
function fmtF(n, d){ return (typeof W.fmt === 'function') ? W.fmt(n, d) : (fin(+n) ? (+n).toFixed(d === undefined ? 2 : d) : '—'); }
function pxF(n){ return (typeof W.px === 'function') ? W.px(n) : (fin(+n) ? String(+n) : '—'); }

function signalFromResult(item, res, rows){
  if (!res || !res.dir || String(res.dir).toLowerCase() !== item.dir) return null;
  var plan = W.pineSubBuildPlan(item.dir, res.price, rows);
  var sig = {
    sym: item.sym, dir: item.dir, scriptId: RF_SCRIPT.id, scriptLabel: RF_SCRIPT.label,
    filterLevel: res.filterLevel, rng: res.rng, period: res.period, mult: res.mult, trend: res.trend,
    newLong: !!res.newLong, newShort: !!res.newShort, isNew: !!(res.newLong || res.newShort),
    price: res.price, entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
    planSrc: plan.planSrc, gates: item.gates, rows: rows
  };
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  return W.pineSubEnrichSignal(sig, item, res);
}
function rfNote(sig){ return 'Filter ' + pxF(sig.filterLevel) + ' · regime ' + (sig.trend > 0 ? 'BULL' : 'BEAR'); }
function cardHTML(sig){ return W.pineSubCardHTML(sig, { scanner: 'pine-rf', noteFn: rfNote }); }

var __snap = { current: null };
var __tab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML = '<div class="panel"><h2>PINE RF <span>Range Filter · period 100 · mult 3</span></h2>'
    + '<div class="note"><b>Long</b> on bear→bull regime flip; <b>short</b> on bull→bear. Aligned trend context included. '
    + EDGE_NOTE + '</div>'
    + '<div class="row" style="margin-top:10px"><button class="btn" id="pineRfRun">RUN RF SCAN</button>'
    + '<span class="note" id="pineRfStat">Run EDGE scan first, then scan.</span></div>'
    + '<div class="prog" id="pineRfProg"><i></i></div><div id="pineRfFunnel" style="margin-top:8px"></div>'
    + '<div id="pineRfDesk"></div><div id="pineRfOut" style="margin-top:12px">'
    + '<div class="empty">Press RUN RF SCAN after EDGE has run.</div></div></div>';
  var ui = { btn: el.querySelector('#pineRfRun'), stat: el.querySelector('#pineRfStat'), prog: el.querySelector('#pineRfProg'),
    out: el.querySelector('#pineRfOut'), funnelEl: el.querySelector('#pineRfFunnel') };
  W.pineSubMountDesk(el.querySelector('#pineRfDesk'), 'PINE RF');
  async function runScan(opts){
    return W.pineSubRunScan({
      ui: ui, state: __tab, snap: __snap, script: RF_SCRIPT, signalFn: signalFromResult, cardFn: cardHTML,
      statLabel: 'RF', klBars: 220, minBars: 210, funnelId: 'pineRfGateFunnel',
      funnelTitle: 'RF · PINE universe (EDGE tickets + forming + REGIME)',
      emptyDetail: 'no Range Filter NEW, RECENT, or ALIGNED match on this scan.',
      sortFn: function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.rng || 0) - Math.abs(a.rng || 0);
      }
    }, opts);
  }
  if (ui.btn) ui.btn.addEventListener('click', function(){ runScan(); });
  __tab.run = runScan;
}
async function pineRfRefresh(){
  if (__tab.busy) return 'busy';
  if (!__tab.hasRun || typeof __tab.run !== 'function') return 'skipped: not run yet';
  return __tab.run({ quiet: false });
}
W.pineRfScan = function(){ try{ return __snap.current; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-rf', label: 'PINE RF', mount: mount, refresh: pineRfRefresh });
})();
