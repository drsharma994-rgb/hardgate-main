/* HARDGATE — pinenw.js — NW Envelope on EDGE+ Pine universe. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var NW_SCRIPT = { id: 'nw-envelope', label: 'NW Envelope', fn: 'pineNwEnvelope',
  opts: { bandwidth: 8.0, mult: 2.5, lookback: 50, atrLen: 100 } };
var EDGE_NOTE = W.PINE_EDGE_UNIVERSE_NOTE || 'Run EDGE scan first.';
function fin(v){ return typeof v === 'number' && isFinite(v); }
function pxF(n){ return (typeof W.px === 'function') ? W.px(n) : (fin(+n) ? String(+n) : '—'); }

function buildPlan(dir, price, rows, res){
  var mean = res && fin(+res.meanTarget) ? +res.meanTarget : (res && fin(+res.nwCenter) ? +res.nwCenter : null);
  var bandStop = null;
  if (res){
    if (dir === 'long' && fin(+res.lower)) bandStop = +res.lower - (fin(+res.atr) ? res.atr * 0.25 : price * 0.005);
    if (dir === 'short' && fin(+res.upper)) bandStop = +res.upper + (fin(+res.atr) ? res.atr * 0.25 : price * 0.005);
  }
  try{
    if (typeof W.hgStructureStop === 'function' && rows && rows.length){
      var st = W.hgStructureStop(dir, price, rows, { atrLen: 14, look: 30 });
      if (st && fin(+st.stop)){
        var stop = +st.stop;
        if (bandStop !== null) stop = dir === 'long' ? Math.min(stop, bandStop) : Math.max(stop, bandStop);
        var risk = Math.abs(price - stop);
        if (risk > 0){
          var t1 = mean !== null ? mean : (dir === 'long' ? price + 2 * risk : price - 2 * risk);
          return { entry: price, stop: stop, t1: t1, t2: dir === 'long' ? t1 + Math.abs(t1 - price) * 0.5 : t1 - Math.abs(t1 - price) * 0.5,
            planSrc: mean !== null ? 'NW mean target' : (st.note || 'structure') };
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
    sym: item.sym, dir: item.dir, scriptId: NW_SCRIPT.id, scriptLabel: NW_SCRIPT.label,
    meanTarget: res.meanTarget, nwCenter: res.nwCenter, upper: res.upper, lower: res.lower,
    newLong: !!res.newLong, newShort: !!res.newShort, isNew: !!(res.newLong || res.newShort),
    price: res.price, entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
    planSrc: plan.planSrc, gates: item.gates, rows: rows
  };
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  return W.pineSubEnrichSignal(sig, item, res);
}
function nwNote(sig){ return 'Mean ' + pxF(sig.meanTarget || sig.nwCenter) + ' · snap-back'; }
function cardHTML(sig){ return W.pineSubCardHTML(sig, { scanner: 'pine-nw', noteFn: nwNote }); }

var __snap = { current: null };
var __tab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML = '<div class="panel"><h2>PINE NW <span>Nadaraya-Watson envelope · mean snap-back</span></h2>'
    + '<div class="note">Wick pierce + reclaim at NW band → revert to Gaussian mean. Target = NW mean. '
    + EDGE_NOTE + '</div>'
    + '<div class="row" style="margin-top:10px"><button class="btn" id="pineNwRun">RUN NW SCAN</button>'
    + '<span class="note" id="pineNwStat">Run EDGE scan first, then scan.</span></div>'
    + '<div class="prog" id="pineNwProg"><i></i></div><div id="pineNwFunnel" style="margin-top:8px"></div>'
    + '<div id="pineNwDesk"></div><div id="pineNwOut" style="margin-top:12px">'
    + '<div class="empty">Press RUN NW SCAN after EDGE has run.</div></div></div>';
  var ui = { btn: el.querySelector('#pineNwRun'), stat: el.querySelector('#pineNwStat'), prog: el.querySelector('#pineNwProg'),
    out: el.querySelector('#pineNwOut'), funnelEl: el.querySelector('#pineNwFunnel') };
  W.pineSubMountDesk(el.querySelector('#pineNwDesk'), 'PINE NW');
  async function runScan(opts){
    return W.pineSubRunScan({
      ui: ui, state: __tab, snap: __snap, script: NW_SCRIPT, signalFn: signalFromResult, cardFn: cardHTML,
      statLabel: 'NW', klBars: 180, minBars: 60, funnelId: 'pineNwGateFunnel',
      funnelTitle: 'NW · PINE universe (EDGE tickets + forming + REGIME)',
      emptyDetail: 'no NW envelope NEW, RECENT, or ALIGNED match on this scan.',
      sortFn: function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.price - (b.meanTarget || b.nwCenter || b.price)) - Math.abs(a.price - (a.meanTarget || a.nwCenter || a.price));
      }
    }, opts);
  }
  if (ui.btn) ui.btn.addEventListener('click', function(){ runScan(); });
  __tab.run = runScan;
}
async function pineNwRefresh(){
  if (__tab.busy) return 'busy';
  if (!__tab.hasRun || typeof __tab.run !== 'function') return 'skipped: not run yet';
  return __tab.run({ quiet: false });
}
W.pineNwScan = function(){ try{ return __snap.current; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-nw', label: 'PINE NW', mount: mount, refresh: pineNwRefresh });
})();
