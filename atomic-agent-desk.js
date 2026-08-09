/* HARDGATE — Atomic Agents desk bridge (Delta + CoinDCX best-setup search).
   https://github.com/Eigenwise/atomic-agents — composable pipeline via /api/atomic/* */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var __atomic = { desk: null, at: 0, busy: false };
var ATOMIC_TTL = 3 * 60 * 1000;

function fin(v){ return typeof v === 'number' && isFinite(v); }

function atomicPx(n){
  if (!fin(+n)) return '—';
  if (typeof G.PX === 'function') return G.PX(+n);
  var x = Math.abs(+n);
  if (x >= 100) return (+n).toFixed(2);
  if (x >= 1) return (+n).toFixed(4);
  return (+n).toFixed(6);
}

function atomicRr(entry, stop, t1){
  if (!fin(+entry) || !fin(+stop) || !fin(+t1) || +entry === +stop) return null;
  return Math.abs(+t1 - +entry) / Math.abs(+entry - +stop);
}

function hasLevels(s){
  return s && fin(+s.entry) && fin(+s.stop) && fin(+s.t1);
}

function getAtomicDeskCached(){
  try{
    if (__atomic.desk) return JSON.parse(JSON.stringify(__atomic.desk));
    return null;
  }catch(e){ return null; }
}

async function refreshAtomicDesk(force){
  if (__atomic.busy) return __atomic.desk;
  if (!force && __atomic.desk && (Date.now() - __atomic.at) < ATOMIC_TTL) return __atomic.desk;
  __atomic.busy = true;
  try{
    var url = '/api/atomic/desk' + (force ? '?refresh=1' : '');
    var res = await fetch(url, { cache: 'no-store' });
    var j = await res.json();
    if (j && j.ok && j.desk){
      __atomic.desk = j.desk;
      __atomic.at = Date.now();
    }
  }catch(e){}
  finally{ __atomic.busy = false; }
  return __atomic.desk;
}

function hgAtomicDeskPanelHtml(){
  var d = getAtomicDeskCached();
  if (!d){
    return '<div class="note" style="margin-top:8px">Atomic Agents · Delta + CoinDCX — '
      + '<button type="button" class="btn ghost" style="padding:2px 8px;font-size:11px" onclick="refreshAtomicDesk(true).then(function(){location.reload()})">SCAN</button></div>';
  }
  var h = '<div class="hg-panel__legend" style="margin-top:10px">Atomic Agents · Delta + CoinDCX · exact levels</div>';
  h += '<div class="note">Score <span class="hg-num">' + (d.swarmScore != null ? d.swarmScore : '—')
    + '</span> · Delta <span class="hg-num">' + (d.delta && d.delta.count != null ? d.delta.count : 0)
    + '</span> · CoinDCX <span class="hg-num">' + (d.coindcx && d.coindcx.count != null ? d.coindcx.count : 0)
    + '</span> · <button type="button" class="btn ghost" style="padding:2px 8px;font-size:11px;vertical-align:baseline" onclick="refreshAtomicDesk(true).then(function(){location.reload()})">RESCAN</button></div>';
  if (d.bestSetups && d.bestSetups.length){
    h += '<table class="hg-table" style="margin-top:6px;font-size:12px"><thead><tr>'
      + '<th>sym</th><th>venue</th><th>dir</th><th>style</th><th>entry</th><th>SL</th><th>TP1</th><th>TP2</th><th>R:R</th></tr></thead><tbody>';
    for (var i = 0; i < Math.min(d.bestSetups.length, 10); i++){
      var s = d.bestSetups[i];
      var rr = s.rr != null && fin(+s.rr) ? +s.rr : atomicRr(s.entry, s.stop, s.t1);
      h += '<tr><td>' + (s.sym || '—') + '</td><td>' + (s.bestVenue || s.exchange || '—') + '</td>'
        + '<td class="' + (s.dir === 'long' ? 'pos' : 'neg') + '">' + (s.dir || '—') + '</td>'
        + '<td>' + (s.style || '—') + '</td>'
        + '<td class="hg-num">' + (hasLevels(s) ? atomicPx(s.entry) : '—') + '</td>'
        + '<td class="hg-num">' + (hasLevels(s) ? atomicPx(s.stop) : '—') + '</td>'
        + '<td class="hg-num">' + (hasLevels(s) ? atomicPx(s.t1) : '—') + '</td>'
        + '<td class="hg-num">' + (fin(+s.t2) ? atomicPx(s.t2) : '—') + '</td>'
        + '<td class="hg-num">' + (rr != null ? rr.toFixed(2) : '—') + '</td></tr>';
    }
    h += '</tbody></table>';
  }
  return h;
}

G.getAtomicDeskCached = getAtomicDeskCached;
G.refreshAtomicDesk = refreshAtomicDesk;
G.hgAtomicDeskPanelHtml = hgAtomicDeskPanelHtml;

})();
