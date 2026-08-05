/* HARDGATE — pinecipher.js — VuManChu Cipher B on EDGE+ Pine universe. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var CIPHER_SCRIPT = { id: 'vumanchu-cipher', label: 'VuManChu Cipher B', fn: 'pineVumanchuCipher',
  opts: { wtChannelLen: 9, wtAvgLen: 21, osLevel: -53, obLevel: 53, recentBars: 5 } };
var EDGE_NOTE = W.PINE_EDGE_UNIVERSE_NOTE || 'Run EDGE scan first.';
function fin(v){ return typeof v === 'number' && isFinite(v); }
function fmtF(n, d){ return (typeof W.fmt === 'function') ? W.fmt(n, d) : (fin(+n) ? (+n).toFixed(d === undefined ? 2 : d) : '—'); }

function signalFromResult(item, res, rows){
  if (!res || !res.dir || String(res.dir).toLowerCase() !== item.dir) return null;
  var plan = W.pineSubBuildPlan(item.dir, res.price, rows);
  var sig = {
    sym: item.sym, dir: item.dir, scriptId: CIPHER_SCRIPT.id, scriptLabel: CIPHER_SCRIPT.label,
    signalType: res.signalType, wt1: res.wt1, wt2: res.wt2, osLevel: res.osLevel, obLevel: res.obLevel,
    newLong: !!res.newLong, newShort: !!res.newShort, isNew: !!(res.newLong || res.newShort),
    price: res.price, entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
    planSrc: plan.planSrc, gates: item.gates, rows: rows
  };
  sig.rr = Math.abs(sig.t1 - sig.entry) / Math.abs(sig.entry - sig.stop);
  return W.pineSubEnrichSignal(sig, item, res);
}
function cipherNote(sig){
  var div = sig.signalType || (sig.dir === 'long' ? 'bull_div' : 'bear_div');
  return 'WT1 ' + fmtF(sig.wt1, 2) + ' · WT2 ' + fmtF(sig.wt2, 2) + ' · ' + div;
}
function cardHTML(sig){ return W.pineSubCardHTML(sig, { scanner: 'pine-cipher', noteFn: cipherNote }); }

var __snap = { current: null };
var __tab = { busy: false, hasRun: false, run: null };

function mount(el){
  el.innerHTML = '<div class="panel"><h2>PINE CIPHER <span>VuManChu Cipher B · WaveTrend divergence</span></h2>'
    + '<div class="note">Bull/bear WaveTrend divergence at OS/OB zones. '
    + EDGE_NOTE + '</div>'
    + '<div class="row" style="margin-top:10px"><button class="btn" id="pineCipherRun">RUN CIPHER SCAN</button>'
    + '<span class="note" id="pineCipherStat">Run EDGE scan first, then scan.</span></div>'
    + '<div class="prog" id="pineCipherProg"><i></i></div><div id="pineCipherFunnel" style="margin-top:8px"></div>'
    + '<div id="pineCipherDesk"></div><div id="pineCipherOut" style="margin-top:12px">'
    + '<div class="empty">Press RUN CIPHER SCAN after EDGE has run.</div></div></div>';
  var ui = { btn: el.querySelector('#pineCipherRun'), stat: el.querySelector('#pineCipherStat'), prog: el.querySelector('#pineCipherProg'),
    out: el.querySelector('#pineCipherOut'), funnelEl: el.querySelector('#pineCipherFunnel') };
  W.pineSubMountDesk(el.querySelector('#pineCipherDesk'), 'PINE CIPHER');
  async function runScan(opts){
    return W.pineSubRunScan({
      ui: ui, state: __tab, snap: __snap, script: CIPHER_SCRIPT, signalFn: signalFromResult, cardFn: cardHTML,
      statLabel: 'CIPHER', klBars: 120, funnelId: 'pineCipherGateFunnel',
      funnelTitle: 'CIPHER · PINE universe (EDGE tickets + forming + REGIME)',
      emptyDetail: 'no Cipher NEW, RECENT, or ALIGNED match on this scan.',
      sortFn: function(a, b){
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return Math.abs(b.wt1 || 0) - Math.abs(a.wt1 || 0);
      }
    }, opts);
  }
  if (ui.btn) ui.btn.addEventListener('click', function(){ runScan(); });
  __tab.run = runScan;
}
async function pineCipherRefresh(){
  if (__tab.busy) return 'busy';
  if (!__tab.hasRun || typeof __tab.run !== 'function') return 'skipped: not run yet';
  return __tab.run({ quiet: false });
}
W.pineCipherScan = function(){ try{ return __snap.current; }catch(e){ return null; } };
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'pine-cipher', label: 'PINE CIPHER', mount: mount, refresh: pineCipherRefresh });
})();
