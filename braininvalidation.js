/* HARDGATE — post-entry BRAIN invalidation alerts (Telegram + ntfy).
   Compares booked layer snapshot vs fresh synthesis; fires on tier collapse or new vetoes. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var SNAP_KEY = 'hg_brain_book_layers_v1';

function snapRead(){
  try{
    var raw = localStorage.getItem(SNAP_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function snapWrite(obj){
  try{ localStorage.setItem(SNAP_KEY, JSON.stringify(obj || {})); }catch(e){}
}

function posKey(fund, sym, dir){
  return String(fund || 'main') + '|' + String(sym || '').toUpperCase() + '|' + String(dir || '').toLowerCase();
}

function layerSigFromRow(row){
  try{
    if (!row || !row.col || !Array.isArray(row.col.votes)) return '';
    var parts = [];
    for (var i = 0; i < row.col.votes.length; i++){
      var v = row.col.votes[i];
      if (!v || !v.layer) continue;
      parts.push(v.layer + ':' + String(v.vote || 'neutral'));
    }
    parts.sort();
    return parts.join('|');
  }catch(e){ return ''; }
}

function layerSigFromEvidence(evidence, dir){
  try{
    if (!Array.isArray(evidence)) return '';
    return evidence.slice(0, 12).join(' · ');
  }catch(e){ return ''; }
}

/** Call after a brain row lands in the book. */
function hgBrainBookLayerRecord(opts){
  opts = opts || {};
  try{
    if (!opts.sym || !opts.dir) return;
    var k = posKey(opts.fund, opts.sym, opts.dir);
    var prev = snapRead();
    prev[k] = {
      sym: opts.sym, dir: opts.dir, fund: opts.fund || 'main',
      tier: opts.tier || null,
      layers: opts.layers || [],
      layerSig: opts.layerSig || '',
      entryAt: Date.now()
    };
    snapWrite(prev);
  }catch(e){}
}

function hgBrainInvAlertsFromRows(rows){
  rows = rows || [];
  if (typeof G.brainInvAlertsOn === 'function' && !G.brainInvAlertsOn()) return 0;
  var snap = snapRead();
  var keys = Object.keys(snap);
  if (!keys.length) return 0;
  var bySym = {};
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.sym) continue;
    bySym[String(r.sym).toUpperCase()] = r;
  }
  var lines = [];
  for (var ki = 0; ki < keys.length; ki++){
    var rec = snap[keys[ki]];
    if (!rec || !rec.sym) continue;
    var fresh = bySym[String(rec.sym).toUpperCase()];
    if (!fresh){
      lines.push(rec.sym + ' · ' + String(rec.dir).toUpperCase() + ' · no longer in BRAIN scan — review open book');
      continue;
    }
    var tier = fresh.tier || (fresh.dec && fresh.dec.tier);
    var fdir = fresh.dir || (fresh.dec && fresh.dec.dir);
    if (tier === 'ASIDE' || !tier){
      lines.push(rec.sym + ' · ' + String(rec.dir).toUpperCase() + ' · now ASIDE — invalidation risk on open position');
      continue;
    }
    if (fdir && rec.dir && String(fdir).toLowerCase() !== String(rec.dir).toLowerCase()){
      lines.push(rec.sym + ' · was ' + String(rec.dir).toUpperCase() + ' · BRAIN now ' + String(fdir).toUpperCase() + ' — direction flip');
      continue;
    }
    if (rec.tier === 'PRIME' && tier === 'HIGH'){
      lines.push(rec.sym + ' · ' + String(rec.dir).toUpperCase() + ' · demoted PRIME → HIGH — tighten or exit');
    }else if (rec.tier === 'PRIME' && tier === 'WATCH'){
      lines.push(rec.sym + ' · ' + String(rec.dir).toUpperCase() + ' · demoted PRIME → WATCH — exit or reduce');
    }
    var newSig = fresh.layerSig || layerSigFromEvidence(fresh.evidence, fdir);
    if (rec.layerSig && newSig && rec.layerSig !== newSig && tier !== 'PRIME'){
      lines.push(rec.sym + ' · ' + String(rec.dir).toUpperCase() + ' · layer evidence shifted — review stop');
    }
  }
  if (!lines.length) return 0;
  var title = 'HARDGATE BRAIN invalidation';
  var body = lines.slice(0, 8).join('\n');
  try{
    if (typeof G.sendTelegram === 'function') G.sendTelegram(title, body);
  }catch(e){}
  try{
    if (typeof G.sendAlertPush === 'function') G.sendAlertPush(title, body, { priority: 5 });
  }catch(e){}
  return lines.length;
}

function hgBrainInvAlertsFromLast(){
  try{
    var last = (typeof G.__hgBrainLast === 'function') ? G.__hgBrainLast() : null;
    if (!last || !Array.isArray(last.rows)) return 0;
    return hgBrainInvAlertsFromRows(last.rows);
  }catch(e){ return 0; }
}

G.hgBrainBookLayerRecord = hgBrainBookLayerRecord;
G.hgBrainInvAlertsFromRows = hgBrainInvAlertsFromRows;
G.hgBrainInvAlertsFromLast = hgBrainInvAlertsFromLast;
G.hgBrainLayerSigFromRow = layerSigFromRow;

})();
