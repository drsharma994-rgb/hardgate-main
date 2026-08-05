/* HARDGATE — pinesqz.js — Squeeze Momentum on EDGE+ Pine universe. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var SQZ_SCRIPT = { id: 'squeeze-momentum', label: 'Squeeze Momentum', fn: 'pineSqueezeMomentum', opts: { length: 20, bbMult: 2, kcMult: 1.5 } };
var EDGE_NOTE = W.PINE_EDGE_UNIVERSE_NOTE || 'Run EDGE scan first.';
function fin(v){ return typeof v === 'number' && isFinite(v); }
function fmtF(n, d){ return (typeof W.fmt === 'function') ? W.fmt(n, d) : (fin(+n) ? (+n).toFixed(d === undefined ? 2 : d) : '—'); }

function signalFromResult(item, res, rows){
  if (!res || !res.dir || String(res.dir).toLowerCase() !== item.dir) return null;
  var plan = (typeof W.pineSubBuildPlan === 'function') ? W.pineSubBuildPlan(item.dir, res.price, rows) : null;
  if (!plan) return null;
  var sig = {
    sym: item.sym, dir: item.dir, scriptId: SQZ_SCRIPT.id, scriptLabel: SQZ_SCRIPT.label,
    momentum: res.momentum, sqzOn: res.sqzOn, sqzFired: res.sqzFired,
    newLong: !!res.newLong, newShort: !!res.newShort, isNew: !!(res.newLong || res.newShort),
    price: res.price, entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
    planSrc: plan.planSrc, gates: item.gates, rows: rows
  };
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  return (typeof W.pineSubEnrichSignal === 'function') ? W.pineSubEnrichSignal(sig, item, res) : sig;
}
function sqzNote(sig){ return 'Squeeze fired · momentum ' + fmtF(sig.momentum, 4); }
function cardHTML(sig){ return W.pineSubCardHTML(sig, { scanner: 'pine-sqz', noteFn: sqzNote }); }

var __snap = { current: null };
var __tab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML = '<div class="panel"><h2>PINE SQZ <span>Squeeze Momentum · BB/KC fire + linreg · ch 20</span></h2>'
    + '<div class="note">LazyBear squeeze: BB inside KC = ON. Signal when squeeze <b>fires</b> (ON→OFF) with momentum agreeing. '
    + EDGE_NOTE + '</div>'
    + '<div class="row" style="margin-top:10px"><button class="btn" id="pineSqzRun">RUN SQZ SCAN</button>'
    + '<span class="note" id="pineSqzStat">Run EDGE scan first, then scan.</span></div>'
    + '<div class="prog" id="pineSqzProg"><i></i></div><div id="pineSqzFunnel" style="margin-top:8px"></div>'
    + '<div id="pineSqzDesk"></div><div id="pineSqzOut" style="margin-top:12px">'
    + '<div class="empty">Press RUN SQZ SCAN after EDGE has run.</div></div></div>';
  var ui = { btn: el.querySelector('#pineSqzRun'), stat: el.querySelector('#pineSqzStat'), prog: el.querySelector('#pineSqzProg'),
    out: el.querySelector('#pineSqzOut'), funnelEl: el.querySelector('#pineSqzFunnel') };
  if (typeof W.pineSubMountDesk === 'function') W.pineSubMountDesk(el.querySelector('#pineSqzDesk'), 'PINE SQZ');
  async function runScan(opts){
    return W.pineSubRunScan({
      ui: ui, state: __tab, snap: __snap, script: SQZ_SCRIPT, signalFn: signalFromResult, cardFn: cardHTML,
      statLabel: 'SQZ', klBars: 120, funnelId: 'pineSqzGateFunnel',
      funnelTitle: 'SQZ · PINE universe (EDGE tickets + forming + REGIME)',
      emptyDetail: 'no squeeze fire NEW, RECENT, or ALIGNED match on this scan.',
      sortFn: function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
        return Math.abs(b.momentum || 0) - Math.abs(a.momentum || 0);
      }
    }, opts);
  }
  if (ui.btn) ui.btn.addEventListener('click', function(){ runScan(); });
  __tab.run = runScan;
}
async function pineSqzRefresh(){
  if (__tab.busy) return 'busy';
  if (!__tab.hasRun || typeof __tab.run !== 'function') return 'skipped: not run yet';
  return __tab.run({ quiet: false });
}
W.pineSqzScan = function(){ try{ return __snap.current; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-sqz', label: 'PINE SQZ', mount: mount, refresh: pineSqzRefresh });
})();
