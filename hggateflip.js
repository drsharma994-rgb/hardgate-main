/* HARDGATE — gate-flip alerts when a symbol clears SWING/SCALP gates toward CLEAN.
   Persists last gate snapshot in localStorage; fires Telegram + ntfy on meaningful flips. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var SNAP_KEY = 'hg_gate_snap_v1';

function gateSnapRead(){
  try{
    var raw = localStorage.getItem(SNAP_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}

function gateSnapWrite(obj){
  try{ localStorage.setItem(SNAP_KEY, JSON.stringify(obj || {})); }catch(e){}
}

function symKey(kind, sym, venue){
  return String(kind || 'swing') + '|' + String(venue || '') + '|' + String(sym || '').toUpperCase();
}

/** Record matrix eval for one symbol after a scan pass. */
function hgGateFlipRecord(kind, venue, sym, dir, matrix){
  if (!sym || !matrix) return null;
  var prev = gateSnapRead();
  var k = symKey(kind, sym, venue);
  var missing = (matrix.gates || []).filter(function(g){ return !g[1]; }).map(function(g){ return g[0]; });
  var next = {
    dir: dir || matrix.dir || null,
    passed: matrix.passed || 0,
    clean: matrix.clean === true,
    anchorOK: matrix.anchorOK !== false,
    missing: missing,
    at: Date.now()
  };
  var old = prev[k] || null;
  prev[k] = next;
  gateSnapWrite(prev);
  return { sym: sym, key: k, prev: old, next: next };
}

function hgGateFlipAlerts(kind, venue, records){
  records = records || [];
  var lines = [];
  for (var i = 0; i < records.length; i++){
    var rec = records[i];
    if (!rec || !rec.next) continue;
    var old = rec.prev, neu = rec.next;
    if (!old) continue;
    if (neu.clean && !old.clean){
      lines.push((rec.sym || '?') + ' · ' + String(neu.dir || '').toUpperCase()
        + ' · NOW CLEAN (7/7 + anchor) — ticket eligible');
      continue;
    }
    if (!neu.clean && neu.passed > old.passed){
      var cleared = (old.missing || []).filter(function(g){
        return (neu.missing || []).indexOf(g) < 0;
      });
      if (cleared.length){
        lines.push((rec.sym || '?') + ' · ' + String(neu.dir || '').toUpperCase()
          + ' · gate cleared: ' + cleared.join(', ')
          + ' (' + neu.passed + '/7' + (neu.anchorOK ? '' : ' · anchor pending') + ')');
      }
    }
  }
  if (!lines.length) return 0;
  var title = 'HARDGATE ' + String(kind || 'SWING').toUpperCase() + ' gate flip';
  var body = lines.slice(0, 8).join('\n');
  try{
    if (typeof G.sendTelegram === 'function') G.sendTelegram(title, body);
  }catch(e){}
  try{
    if (typeof G.sendAlertPush === 'function') G.sendAlertPush(title, body, { priority: 5 });
  }catch(e){}
  return lines.length;
}

G.hgGateFlipRecord = hgGateFlipRecord;
G.hgGateFlipAlerts = hgGateFlipAlerts;
G.hgGateSnapRead = gateSnapRead;

})();
