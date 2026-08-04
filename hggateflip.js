/* HARDGATE — gate-flip alerts when a symbol clears SWING/SCALP gates toward CLEAN.
   Persists last gate snapshot in localStorage; fires Telegram + ntfy on meaningful flips.
   Source tab: CRYPTO SWING or CRYPTO SCALP (index.html runScanLeg), NOT GOLD SWING. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var SNAP_KEY = 'hg_gate_snap_v1';

var TAB_META = {
  swing: {
    tab: 'CRYPTO SWING tab',
    signal: '7-gate swing matrix (G1–G7 + EMA21 anchor) on 4H — progress toward CLEAN ticket',
    tf: '4H'
  },
  scalp: {
    tab: 'CRYPTO SCALP tab',
    signal: '7-gate scalp matrix on 15m/1h — progress toward CLEAN ticket',
    tf: '15m/1h'
  }
};

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

function telegramText(opts){
  opts = opts || {};
  if (typeof G.hgTelegramFormat === 'function') return G.hgTelegramFormat(opts);
  var parts = [opts.headline || opts.title || 'HARDGATE alert'];
  if (opts.tab) parts.push('Tab: ' + opts.tab);
  if (opts.signal) parts.push('Signal: ' + opts.signal);
  if (opts.venue) parts.push('Venue: ' + opts.venue);
  if (opts.body) parts.push('', opts.body);
  parts.push('', 'https://hardgate-main.onrender.com/');
  return parts.join('\n');
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
  var meta = TAB_META[kind] || TAB_META.swing;
  var lines = [];
  for (var i = 0; i < records.length; i++){
    var rec = records[i];
    if (!rec || !rec.next) continue;
    var old = rec.prev, neu = rec.next;
    if (!old) continue;
    if (neu.clean && !old.clean){
      lines.push((rec.sym || '?') + ' · ' + String(neu.dir || '').toUpperCase()
        + ' · NOW CLEAN (7/7 + EMA21 anchor) — eligible on ' + meta.tab);
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
  var headline = '📊 HARDGATE — ' + meta.tab + ' · gate flip';
  var body = lines.slice(0, 8).join('\n')
    + '\n\nGate flip = a symbol moved closer to CLEAN on the ' + meta.tf
    + ' matrix (not necessarily a full entry — open the tab for plans).';
  var text = telegramText({
    headline: headline,
    tab: meta.tab,
    signal: meta.signal,
    venue: venue || null,
    body: body
  });
  try{
    if (typeof G.sendTelegram === 'function') G.sendTelegram(text);
  }catch(e){}
  try{
    if (typeof G.sendAlertPush === 'function'){
      G.sendAlertPush(headline, text, { priority: 5 });
    }
  }catch(e){}
  return lines.length;
}

G.hgGateFlipRecord = hgGateFlipRecord;
G.hgGateFlipAlerts = hgGateFlipAlerts;
G.hgGateSnapRead = gateSnapRead;
G.hgGateFlipTabMeta = TAB_META;

})();
