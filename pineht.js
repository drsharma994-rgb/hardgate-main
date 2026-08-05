/* HARDGATE — pineht.js — HalfTrend on EDGE+ Pine universe. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var HT_SCRIPT = { id: 'half-trend', label: 'HalfTrend', fn: 'pineHalfTrend', opts: { amplitude: 2, atrMult: 2.0, atrLen: 100 } };
var EDGE_NOTE = W.PINE_EDGE_UNIVERSE_NOTE || 'Run EDGE scan first.';
function fin(v){ return typeof v === 'number' && isFinite(v); }
function pxF(n){ return (typeof W.px === 'function') ? W.px(n) : (fin(+n) ? String(+n) : '—'); }

function signalFromResult(item, res, rows){
  if (!res || !res.dir || String(res.dir).toLowerCase() !== item.dir) return null;
  if (!fin(+res.entry) || !fin(+res.stop) || res.entry === res.stop) return null;
  var t1 = fin(+res.t1) ? +res.t1 : (item.dir === 'long' ? res.entry + 2 * Math.abs(res.entry - res.stop) : res.entry - 2 * Math.abs(res.entry - res.stop));
  var t2 = fin(+res.t2) ? +res.t2 : (item.dir === 'long' ? res.entry + 3.5 * Math.abs(res.entry - res.stop) : res.entry - 3.5 * Math.abs(res.entry - res.stop));
  var sig = {
    sym: item.sym, dir: item.dir, scriptId: HT_SCRIPT.id, scriptLabel: HT_SCRIPT.label,
    trend: res.trend, halftrend: res.halftrend, trailingStop: res.trailingStop,
    newLong: !!res.newLong, newShort: !!res.newShort, isNew: !!(res.newLong || res.newShort),
    price: res.price, entry: res.entry, stop: res.stop, t1: t1, t2: t2,
    planSrc: 'HalfTrend trailing line', gates: item.gates, rows: rows
  };
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  return W.pineSubEnrichSignal(sig, item, res);
}
function htNote(sig){ return 'HalfTrend line ' + pxF(sig.halftrend) + ' · trailing ' + pxF(sig.trailingStop || sig.stop); }
function cardHTML(sig){ return W.pineSubCardHTML(sig, { scanner: 'pine-ht', noteFn: htNote }); }

var __snap = { current: null };
var __tab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML = '<div class="panel"><h2>PINE HT <span>HalfTrend · amplitude 2 · ATR(100)×2 band</span></h2>'
    + '<div class="note">Signal on <b>trend flip</b> or aligned HalfTrend context. Stop = HalfTrend trailing line. '
    + EDGE_NOTE + '</div>'
    + '<div class="row" style="margin-top:10px"><button class="btn" id="pineHtRun">RUN HT SCAN</button>'
    + '<span class="note" id="pineHtStat">Run EDGE scan first, then scan.</span></div>'
    + '<div class="prog" id="pineHtProg"><i></i></div><div id="pineHtFunnel" style="margin-top:8px"></div>'
    + '<div id="pineHtDesk"></div><div id="pineHtOut" style="margin-top:12px">'
    + '<div class="empty">Press RUN HT SCAN after EDGE has run.</div></div></div>';
  var ui = { btn: el.querySelector('#pineHtRun'), stat: el.querySelector('#pineHtStat'), prog: el.querySelector('#pineHtProg'),
    out: el.querySelector('#pineHtOut'), funnelEl: el.querySelector('#pineHtFunnel') };
  W.pineSubMountDesk(el.querySelector('#pineHtDesk'), 'PINE HT');
  async function runScan(opts){
    return W.pineSubRunScan({
      ui: ui, state: __tab, snap: __snap, script: HT_SCRIPT, signalFn: signalFromResult, cardFn: cardHTML,
      statLabel: 'HT', klBars: 180, minBars: 110, funnelId: 'pineHtGateFunnel',
      funnelTitle: 'HT · PINE universe (EDGE tickets + forming + REGIME)',
      emptyDetail: 'no HalfTrend NEW, RECENT, or ALIGNED match on this scan.',
      sortFn: function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.entry - b.stop) - Math.abs(a.entry - a.stop);
      }
    }, opts);
  }
  if (ui.btn) ui.btn.addEventListener('click', function(){ runScan(); });
  __tab.run = runScan;
}
async function pineHtRefresh(){
  if (__tab.busy) return 'busy';
  if (!__tab.hasRun || typeof __tab.run !== 'function') return 'skipped: not run yet';
  return __tab.run({ quiet: false });
}
W.pineHtScan = function(){ try{ return __snap.current; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-ht', label: 'PINE HT', mount: mount, refresh: pineHtRefresh });
})();
