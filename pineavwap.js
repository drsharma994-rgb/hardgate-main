/* HARDGATE — pineavwap.js — Weekly AVWAP + SD on EDGE+ Pine universe. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var AVWAP_SCRIPT = { id: 'weekly-avwap', label: 'Weekly AVWAP + SD', fn: 'pineWeeklyAvwap', opts: { bandMult: 2.0 } };
var EDGE_NOTE = W.PINE_EDGE_UNIVERSE_NOTE || 'Run EDGE scan first.';
function fin(v){ return typeof v === 'number' && isFinite(v); }
function pxF(n){ return (typeof W.px === 'function') ? W.px(n) : (fin(+n) ? String(+n) : '—'); }

function buildPlan(dir, price, rows, res){
  var vwap = res && fin(+res.targetVwap) ? +res.targetVwap : (res && fin(+res.vwap) ? +res.vwap : null);
  var bandStop = null;
  if (res){
    if (dir === 'long' && fin(+res.lower)) bandStop = +res.lower - (fin(+res.stdDev) ? res.stdDev * 0.15 : price * 0.005);
    if (dir === 'short' && fin(+res.upper)) bandStop = +res.upper + (fin(+res.stdDev) ? res.stdDev * 0.15 : price * 0.005);
  }
  try{
    if (typeof W.hgStructureStop === 'function' && rows && rows.length){
      var st = W.hgStructureStop(dir, price, rows, { atrLen: 14, look: 20 });
      if (st && fin(+st.stop)){
        var stop = +st.stop;
        if (bandStop !== null) stop = dir === 'long' ? Math.min(stop, bandStop) : Math.max(stop, bandStop);
        var risk = Math.abs(price - stop);
        if (risk > 0){
          var t1 = vwap !== null ? vwap : (dir === 'long' ? price + 2 * risk : price - 2 * risk);
          return { entry: price, stop: stop, t1: t1, t2: dir === 'long' ? t1 + Math.abs(t1 - price) * 0.35 : t1 - Math.abs(t1 - price) * 0.35,
            planSrc: vwap !== null ? 'Weekly AVWAP target' : (st.note || 'structure') };
        }
      }
    }
  }catch(e){}
  return W.pineSubBuildPlan(dir, price, rows);
}

function signalFromResult(item, res, rows){
  if (!res || !res.dir || String(res.dir).toLowerCase() !== item.dir) return null;
  var plan = buildPlan(item.dir, res.price, rows, res);
  var sig = {
    sym: item.sym, dir: item.dir, scriptId: AVWAP_SCRIPT.id, scriptLabel: AVWAP_SCRIPT.label,
    vwap: res.vwap, targetVwap: res.targetVwap, upper: res.upper, lower: res.lower, bandMult: res.bandMult,
    newLong: !!res.newLong, newShort: !!res.newShort, isNew: !!(res.newLong || res.newShort),
    price: res.price, entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
    planSrc: plan.planSrc, gates: item.gates, rows: rows
  };
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  return W.pineSubEnrichSignal(sig, item, res);
}
function avNote(sig){ return 'Week VWAP ' + pxF(sig.targetVwap || sig.vwap) + ' · band bounce'; }
function cardHTML(sig){ return W.pineSubCardHTML(sig, { scanner: 'pine-avwap', noteFn: avNote }); }

var __snap = { current: null };
var __tab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML = '<div class="panel"><h2>PINE AVWAP <span>Weekly AVWAP + SD band snap-back</span></h2>'
    + '<div class="note">Pierce weekly VWAP ± SD band and reclaim → target = week VWAP. '
    + EDGE_NOTE + '</div>'
    + '<div class="row" style="margin-top:10px"><button class="btn" id="pineAvwapRun">RUN AVWAP SCAN</button>'
    + '<span class="note" id="pineAvwapStat">Run EDGE scan first, then scan.</span></div>'
    + '<div class="prog" id="pineAvwapProg"><i></i></div><div id="pineAvwapFunnel" style="margin-top:8px"></div>'
    + '<div id="pineAvwapDesk"></div><div id="pineAvwapOut" style="margin-top:12px">'
    + '<div class="empty">Press RUN AVWAP SCAN after EDGE has run.</div></div></div>';
  var ui = { btn: el.querySelector('#pineAvwapRun'), stat: el.querySelector('#pineAvwapStat'), prog: el.querySelector('#pineAvwapProg'),
    out: el.querySelector('#pineAvwapOut'), funnelEl: el.querySelector('#pineAvwapFunnel') };
  W.pineSubMountDesk(el.querySelector('#pineAvwapDesk'), 'PINE AVWAP');
  async function runScan(opts){
    return W.pineSubRunScan({
      ui: ui, state: __tab, snap: __snap, script: AVWAP_SCRIPT, signalFn: signalFromResult, cardFn: cardHTML,
      statLabel: 'AVWAP', klBars: 180, minBars: 20, funnelId: 'pineAvwapGateFunnel',
      funnelTitle: 'AVWAP · PINE universe (EDGE tickets + forming + REGIME)',
      emptyDetail: 'no weekly AVWAP NEW, RECENT, or ALIGNED match on this scan.',
      sortFn: function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.price - (b.targetVwap || b.vwap || b.price)) - Math.abs(a.price - (a.targetVwap || a.vwap || a.price));
      }
    }, opts);
  }
  if (ui.btn) ui.btn.addEventListener('click', function(){ runScan(); });
  __tab.run = runScan;
}
async function pineAvwapRefresh(){
  if (__tab.busy) return 'busy';
  if (!__tab.hasRun || typeof __tab.run !== 'function') return 'skipped: not run yet';
  return __tab.run({ quiet: false });
}
W.pineAvwapScan = function(){ try{ return __snap.current; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-avwap', label: 'PINE AVWAP', mount: mount, refresh: pineAvwapRefresh });
})();
