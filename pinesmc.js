/* HARDGATE — pinesmc.js — SMC Core (CHoCH + FVG) on EDGE+ Pine universe. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var SMC_SCRIPT = { id: 'smc-core', label: 'SMC: Core Math', fn: 'pineSmcCore', opts: { pivotLength: 5, atrLen: 14, recentBars: 5 } };
var EDGE_NOTE = W.PINE_EDGE_UNIVERSE_NOTE || 'Run EDGE scan first.';
function fin(v){ return typeof v === 'number' && isFinite(v); }
function pxF(n){ return (typeof W.px === 'function') ? W.px(n) : (fin(+n) ? String(+n) : '—'); }

function signalFromResult(item, res, rows){
  if (!res || !res.dir || String(res.dir).toLowerCase() !== item.dir) return null;
  if (!fin(+res.entry) || !fin(+res.stop) || res.entry === res.stop) return null;
  var t1 = fin(+res.t1) ? +res.t1 : null;
  var t2 = fin(+res.t2) ? +res.t2 : null;
  if (!fin(t1)){
    var risk = Math.abs(res.entry - res.stop);
    t1 = item.dir === 'long' ? res.entry + 2 * risk : res.entry - 2 * risk;
    t2 = item.dir === 'long' ? res.entry + 3.5 * risk : res.entry - 3.5 * risk;
  }
  var sig = {
    sym: item.sym, dir: item.dir, scriptId: SMC_SCRIPT.id, scriptLabel: SMC_SCRIPT.label,
    zoneEntry: res.zoneEntry, lastSh: res.lastSh, lastSl: res.lastSl,
    newLong: !!res.newLong, newShort: !!res.newShort, isNew: !!(res.newLong || res.newShort),
    price: res.price, entry: res.entry, stop: res.stop, t1: t1, t2: t2,
    planSrc: 'SMC FVG zone limit (CHoCH)', gates: item.gates, rows: rows
  };
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  return W.pineSubEnrichSignal(sig, item, res);
}
function smcNote(sig){ return 'CHoCH limit @ FVG ' + pxF(sig.zoneEntry || sig.entry); }
function cardHTML(sig){ return W.pineSubCardHTML(sig, { scanner: 'pine-smc', noteFn: smcNote }); }

var __snap = { current: null };
var __tab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML = '<div class="panel"><h2>PINE SMC <span>CHoCH + FVG · pivot 5 · limit @ zone</span></h2>'
    + '<div class="note">Fractal swings + FVG zones + Change of Character limit entries. '
    + EDGE_NOTE + '</div>'
    + '<div class="row" style="margin-top:10px"><button class="btn" id="pineSmcRun">RUN SMC SCAN</button>'
    + '<span class="note" id="pineSmcStat">Run EDGE scan first, then scan.</span></div>'
    + '<div class="prog" id="pineSmcProg"><i></i></div><div id="pineSmcFunnel" style="margin-top:8px"></div>'
    + '<div id="pineSmcDesk"></div><div id="pineSmcOut" style="margin-top:12px">'
    + '<div class="empty">Press RUN SMC SCAN after EDGE has run.</div></div></div>';
  var ui = { btn: el.querySelector('#pineSmcRun'), stat: el.querySelector('#pineSmcStat'), prog: el.querySelector('#pineSmcProg'),
    out: el.querySelector('#pineSmcOut'), funnelEl: el.querySelector('#pineSmcFunnel') };
  W.pineSubMountDesk(el.querySelector('#pineSmcDesk'), 'PINE SMC');
  async function runScan(opts){
    return W.pineSubRunScan({
      ui: ui, state: __tab, snap: __snap, script: SMC_SCRIPT, signalFn: signalFromResult, cardFn: cardHTML,
      statLabel: 'SMC', funnelId: 'pineSmcGateFunnel',
      funnelTitle: 'SMC · PINE universe (EDGE tickets + forming + REGIME)',
      emptyDetail: 'no SMC CHoCH NEW, RECENT, or ALIGNED match on this scan.',
      sortFn: function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.entry - b.price) - Math.abs(a.entry - a.price);
      }
    }, opts);
  }
  if (ui.btn) ui.btn.addEventListener('click', function(){ runScan(); });
  __tab.run = runScan;
}
async function pineSmcRefresh(){
  if (__tab.busy) return 'busy';
  if (!__tab.hasRun || typeof __tab.run !== 'function') return 'skipped: not run yet';
  return __tab.run({ quiet: false });
}
W.pineSmcScan = function(){ try{ return __snap.current; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-smc', label: 'PINE SMC', mount: mount, refresh: pineSmcRefresh });
})();
