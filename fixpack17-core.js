/* HARDGATE — fix pack 17. Two jobs, both about not lying to yourself.

   1. INFORMATION FAMILIES FOR THE 20-GATE SCALP LEDGER.
      Pack 16 fixed collinearity on the 37-gate swing ledger and left the
      scalp ledger scoring flat (passC/totalC*100, thresholds 70/50/30).
      That ledger is worse: seven of its twenty gates — C7 Williams %R,
      C9 MACD hist, C11 Aroon, C12 CCI, C15 Bollinger %B, C16 Stochastic,
      C17 Fisher — are all computed on the SAME 15m series and keyed to the
      same direction variable. 35% of the score came from one condition.
      Grouped into families, oscillator is 1 vote of 10 instead of 7 of 20.

   2. MEASURED FAMILY LIFT IN THE BROWSER.
      lib/gold-tally-audit.mjs computes family lift but is daemon-only, so
      the tab could never show whether a family actually earns R. Ported
      here, with one deliberate correction: the lib sums nWith across the
      gates in a family, so a 7-gate family reports 7x the samples of a
      1-gate family and reaches the CARRIES threshold on arithmetic alone.
      That is the same over-counting bug pack 16 set out to kill, sitting
      in the measurement layer. Here a family is scored ONCE PER RECORD.

   Classic script on purpose: index.html loads no ES modules, so anything
   in lib/*.mjs never reaches the gold tabs. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

/* ================= 20-gate scalp ledger → families ================= */

var HG_SCALP_GATE_META = {
  C1:  { family:'session',    speed:'fast',   label:'Kill zone' },
  C2:  { family:'structure',  speed:'medium', label:'Liquidity sweep' },
  C3:  { family:'structure',  speed:'fast',   label:'15m reclaim' },
  C4:  { family:'trend',      speed:'medium', label:'1H EMA21 context' },
  C5:  { family:'volregime',  speed:'fast',   label:'Volatility alive' },
  C6:  { family:'trend',      speed:'fast',   label:'Heikin Ashi 15m' },
  C7:  { family:'oscillator', speed:'fast',   label:'Williams %R' },
  C8:  { family:'trend',      speed:'fast',   label:'SuperTrend 15m' },
  C9:  { family:'oscillator', speed:'fast',   label:'MACD hist 15m' },
  C10: { family:'flow',       speed:'fast',   label:'Session VWAP' },
  C11: { family:'oscillator', speed:'fast',   label:'Aroon 15m' },
  C12: { family:'oscillator', speed:'fast',   label:'CCI 15m' },
  C13: { family:'dxy',        speed:'slow',   label:'DXY aligned' },
  C14: { family:'events',     speed:'slow',   label:'Event window' },
  C15: { family:'oscillator', speed:'fast',   label:'Bollinger %B' },
  C16: { family:'oscillator', speed:'fast',   label:'Stochastic K/D' },
  C17: { family:'oscillator', speed:'fast',   label:'Fisher Transform' },
  C18: { family:'pattern',    speed:'fast',   label:'Reversal candle' },
  C19: { family:'structure',  speed:'fast',   label:'Opening range break' },
  C20: { family:'rr',         speed:'medium', label:'2R before opposite pool' }
};

var SCALP_FAM_ORDER = ['structure','trend','oscillator','flow','volregime','dxy','events','pattern','session','rr'];

var SCALP_FAM_LABELS = {
  structure:'STRUCTURE', trend:'TREND', oscillator:'OSCILLATOR', flow:'FLOW',
  volregime:'VOL REGIME', dxy:'DXY', events:'EVENTS', pattern:'PATTERN',
  session:'SESSION', rr:'STRUCTURAL R:R'
};

/* C2+C3 are the premise of the setup, not opinions about it: no sweep and
   no reclaim means there is nothing to scalp, whatever else agrees. */
var SCALP_PREMISE = ['C2','C3'];
/* Timing and structural blockers cannot be outvoted by agreement elsewhere. */
var SCALP_TIMING_BLOCKERS = ['C1','C14'];
var SCALP_RR_BLOCKER = 'C20';
/* Below this many resolved families, STRONG/MODERATE are not on the table at
   all: proportional thresholds are meaningless over a handful of signals. */
var MIN_FAM_FOR_CONVICTION = 6;

function hgScalpGateFamilies(){ return HG_SCALP_GATE_META; }
function hgScalpFamilyOrder(){ return SCALP_FAM_ORDER.slice(); }
function hgScalpGateIds(){ return Object.keys(HG_SCALP_GATE_META); }

/* ================= generic family rollup ================= */
/* Generic on purpose. Pack 16's hgFamilyRollup is hardcoded to the swing
   meta and is live, so it is left untouched rather than refactored. */

function verdictOf(members){
  var scored = members.filter(function(m){ return m.state !== 'na'; });
  if (!scored.length) return 'DARK';
  var passN = scored.filter(function(m){ return m.state === 'pass'; }).length;
  if (passN === scored.length) return 'AGREE';
  if (passN === 0) return 'OPPOSE';
  return 'SPLIT';
}

function hgRollupWith(meta, order, labels, ledger){
  var byKey = {}, rows = Array.isArray(ledger) ? ledger : [];
  for (var i = 0; i < rows.length; i++){
    var row = rows[i];
    if (!row || !row[0]) continue;
    var id = row[0];
    var m = meta[id];
    /* An unmapped gate must not invent a family — that would add a phantom
       row and inflate the denominator the verdict divides by. */
    if (!m) continue;
    var fam = m.family;
    if (!byKey[fam]) byKey[fam] = { family: fam, label: (labels[fam] || fam.toUpperCase()), members: [] };
    byKey[fam].members.push({
      id: id, name: row[1], state: row[2], detail: row[3],
      speed: m.speed || null, label: m.label || row[1]
    });
  }
  var out = [];
  for (var j = 0; j < order.length; j++){
    var key = order[j], bucket = byKey[key];
    if (!bucket) continue;
    var members = bucket.members, verdict = verdictOf(members);
    var dissent = [];
    if (verdict === 'SPLIT'){
      var scored = members.filter(function(mm){ return mm.state !== 'na'; });
      var passN = scored.filter(function(mm){ return mm.state === 'pass'; }).length;
      var majorityPass = passN >= scored.length / 2;
      dissent = members.filter(function(mm){
        if (mm.state === 'na') return false;
        return majorityPass ? mm.state !== 'pass' : mm.state === 'pass';
      });
    }
    out.push({
      family: key, label: bucket.label, verdict: verdict,
      nPass: members.filter(function(m2){ return m2.state === 'pass'; }).length,
      nVeto: members.filter(function(m2){ return m2.state === 'veto'; }).length,
      nNa:   members.filter(function(m2){ return m2.state === 'na';   }).length,
      members: members, dissent: dissent,
      fastFlip: dissent.filter(function(d){ return d.speed === 'fast'; }),
      slowFlip: dissent.filter(function(d){ return d.speed === 'slow'; })
    });
  }
  return out;
}

function hgScalpRollup(ledger){
  return hgRollupWith(HG_SCALP_GATE_META, SCALP_FAM_ORDER, SCALP_FAM_LABELS, ledger);
}

function hgScalpDissentLine(famRow){
  if (!famRow || famRow.verdict !== 'SPLIT' || !famRow.dissent.length) return '';
  var names = famRow.dissent.map(function(d){ return d.id + ' ' + d.label; }).join(', ');
  var tag = '';
  if (famRow.fastFlip.length && !famRow.slowFlip.length) tag = ' · fast members flipping';
  else if (famRow.slowFlip.length && !famRow.fastFlip.length) tag = ' · slow members flipping';
  return 'dissent: ' + names + tag;
}

/* ================= scalp verdict ================= */

function stateOfGate(rollup, gateId){
  for (var i = 0; i < rollup.length; i++){
    var ms = rollup[i].members;
    for (var j = 0; j < ms.length; j++) if (ms[j].id === gateId) return ms[j].state;
  }
  return null;
}

function hgScalpVerdict(rollup, opts){
  opts = opts || {};
  rollup = Array.isArray(rollup) ? rollup : [];
  var agree = 0, oppose = 0, dark = 0, split = 0;
  var darkFamilies = [], splitFamilies = [], opposeFamilies = [];
  for (var i = 0; i < rollup.length; i++){
    var fam = rollup[i];
    if (fam.verdict === 'AGREE') agree++;
    else if (fam.verdict === 'OPPOSE'){ oppose++; opposeFamilies.push(fam.label); }
    else if (fam.verdict === 'DARK'){ dark++; darkFamilies.push(fam.label); }
    else if (fam.verdict === 'SPLIT'){ split++; splitFamilies.push(fam.label); }
  }

  var premiseMissing = [];
  for (var p = 0; p < SCALP_PREMISE.length; p++){
    if (stateOfGate(rollup, SCALP_PREMISE[p]) === 'veto') premiseMissing.push(SCALP_PREMISE[p]);
  }
  var blockers = [];
  for (var t = 0; t < SCALP_TIMING_BLOCKERS.length; t++){
    if (stateOfGate(rollup, SCALP_TIMING_BLOCKERS[t]) === 'veto') blockers.push(SCALP_TIMING_BLOCKERS[t]);
  }
  var timingVeto = blockers.length > 0;
  var rrVeto = stateOfGate(rollup, SCALP_RR_BLOCKER) === 'veto' || !!opts.structuralRrVeto;
  if (rrVeto && blockers.indexOf(SCALP_RR_BLOCKER) < 0) blockers.push(SCALP_RR_BLOCKER);

  /* Denominator is the families actually present, never a hardcoded count. */
  var total = rollup.length;
  var need = { strong: Math.ceil(total * 0.8), moderate: Math.ceil(total * 0.6), weak: Math.ceil(total * 0.4) };

  var label, tier, why = [];
  if (!total){
    /* No families means no information. Without this guard the thresholds
       below are all zero and `agree >= 0` reports STRONG on an empty
       ledger — maximum conviction from nothing at all. */
    return {
      label: 'BIAS ONLY', tier: 'bias',
      agree: 0, oppose: 0, dark: 0, split: 0, total: 0,
      darkFamilies: [], splitFamilies: [], opposeFamilies: [],
      blockers: [], timingVeto: false, structuralRrVeto: false, premiseMissing: [],
      legacyScore: (opts.legacyScore === undefined || opts.legacyScore === null) ? null : opts.legacyScore,
      why: 'no gates resolved — nothing to judge',
      rareNote: ''
    };
  }
  if (premiseMissing.length){
    tier = 'veto';
    label = 'NO SETUP';
    why.push('no sweep + reclaim (' + premiseMissing.join(', ') + ') — there is nothing to scalp yet');
  } else if (timingVeto){
    tier = 'veto';
    label = 'TIMING VETO';
    why.push('blocked by ' + blockers.join(', ') + ' — timing cannot be outvoted');
  } else if (rrVeto){
    tier = 'veto';
    label = 'STRUCTURAL VETO';
    why.push('2R does not fit before the opposite pool — structure cannot be outvoted');
  } else if (total < MIN_FAM_FOR_CONVICTION){
    /* Agreement across two or three families is not conviction, it is a thin
       ledger. Unanimity over a handful of gates would otherwise clear a
       proportional threshold and print STRONG. */
    tier = (agree >= need.weak) ? 'weak' : 'bias';
    label = (agree >= need.weak) ? 'WEAK' : 'BIAS ONLY';
    why.push('only ' + total + ' families resolved — too thin for a conviction read');
  } else if (oppose === 0 && agree >= need.strong){
    tier = 'strong'; label = 'STRONG';
  } else if (oppose <= 1 && agree >= need.moderate){
    tier = 'moderate'; label = 'MODERATE';
  } else if (agree >= need.weak){
    tier = 'weak'; label = 'WEAK';
  } else {
    tier = 'bias'; label = 'BIAS ONLY';
  }

  if (tier !== 'veto'){
    why.unshift(agree + ' of ' + total + ' families agree');
    if (oppose) why.push(oppose + ' OPPOSE (' + opposeFamilies.join(', ') + ')');
    if (split)  why.push(split  + ' SPLIT ('  + splitFamilies.join(', ')  + ')');
    if (dark)   why.push(dark   + ' DARK ('   + darkFamilies.join(', ')   + ')');
  }

  return {
    label: label, tier: tier,
    agree: agree, oppose: oppose, dark: dark, split: split, total: total,
    darkFamilies: darkFamilies, splitFamilies: splitFamilies, opposeFamilies: opposeFamilies,
    blockers: blockers, timingVeto: timingVeto, structuralRrVeto: rrVeto,
    premiseMissing: premiseMissing,
    legacyScore: (opts.legacyScore === undefined || opts.legacyScore === null) ? null : opts.legacyScore,
    why: why.join(' · '),
    rareNote: 'STRONG needs ' + need.strong + ' of ' + total + ' INDEPENDENT families, not '
      + Math.round(total * 0.8 * 2) + ' of 20 overlapping gates. Fewer STRONG reads is the fix working.'
  };
}

/* ================= measured family lift ================= */

function isSettled(r){
  return !!r && r.status === 'settled' && r.r !== null && r.r !== undefined && isFinite(Number(r.r));
}
function settledOnly(records){
  return (Array.isArray(records) ? records : []).filter(isSettled);
}
function avgR(recs){
  if (!recs.length) return null;
  var s = 0;
  for (var i = 0; i < recs.length; i++) s += Number(recs[i].r);
  return s / recs.length;
}
function gateStatesOf(r){
  return (r && (r.gateStates || r.deepGates)) || null;
}

/* A family is ONE signal, so it is scored once per record: 'agree' when a
   majority of its non-na members passed on that record, 'disagree' when a
   majority did not, 'dark' when it had nothing to say. This is the fix for
   the lib version, which summed sample counts across a family's gates and
   so rewarded families merely for holding more gates. */
function familyStateOnRecord(gs, famGateIds){
  var scored = 0, passN = 0;
  for (var i = 0; i < famGateIds.length; i++){
    var st = gs[famGateIds[i]];
    if (st === undefined || st === null || st === 'na') continue;
    scored++;
    if (st === 'pass') passN++;
  }
  if (!scored) return 'dark';
  return (passN >= scored / 2) ? 'agree' : 'disagree';
}

function liftVerdict(nWith, liftR){
  if (nWith < 8 || liftR === null) return 'UNPROVEN';
  if (nWith >= 12 && liftR >= 0.15) return 'CARRIES';
  if (liftR <= -0.05) return 'NOISE';
  if (nWith >= 8 && liftR <= -0.04) return 'NOISE';
  return 'NEUTRAL';
}

/* Derive family order from a meta map when the caller has none to pass.
   Lets the swing meta from pack 16 be measured without editing pack 16. */
function orderFromMeta(meta){
  var seen = {}, out = [], ids = Object.keys(meta);
  for (var i = 0; i < ids.length; i++){
    var f = meta[ids[i]].family;
    if (f && !seen[f]){ seen[f] = 1; out.push(f); }
  }
  return out;
}

function hgFamilyLift(records, meta, order, labels){
  meta = meta || HG_SCALP_GATE_META;
  order = order || (meta === HG_SCALP_GATE_META ? SCALP_FAM_ORDER : orderFromMeta(meta));
  labels = labels || SCALP_FAM_LABELS;
  var recs = settledOnly(records).filter(function(r){ return !!gateStatesOf(r); });
  var effN = null;
  try{
    if (typeof G.hgEffectiveN === 'function' && typeof G.hgEventsFromRecords === 'function'){
      effN = G.hgEffectiveN(G.hgEventsFromRecords(recs));
      if (isFinite(effN)) effN = Math.round(effN * 10) / 10; else effN = null;
    }
  }catch(eN){ effN = null; }

  var famGates = {};
  var ids = Object.keys(meta);
  for (var i = 0; i < ids.length; i++){
    var f = meta[ids[i]].family;
    if (!famGates[f]) famGates[f] = [];
    famGates[f].push(ids[i]);
  }

  var out = [];
  for (var j = 0; j < order.length; j++){
    var fam = order[j];
    if (!famGates[fam]) continue;
    var withRecs = [], withoutRecs = [];
    for (var k = 0; k < recs.length; k++){
      var st = familyStateOnRecord(gateStatesOf(recs[k]), famGates[fam]);
      if (st === 'agree') withRecs.push(recs[k]);
      else if (st === 'disagree') withoutRecs.push(recs[k]);
    }
    var aW = avgR(withRecs), aO = avgR(withoutRecs);
    var liftR = (aW !== null && aO !== null) ? aW - aO : null;
    out.push({
      family: fam,
      label: labels[fam] || fam.toUpperCase(),
      nWith: withRecs.length,
      nWithout: withoutRecs.length,
      effectiveN: effN,
      avgWith: aW !== null ? Math.round(aW * 1000) / 1000 : null,
      avgWithout: aO !== null ? Math.round(aO * 1000) / 1000 : null,
      liftR: liftR !== null ? Math.round(liftR * 1000) / 1000 : null,
      verdict: liftVerdict(withRecs.length, liftR),
      primary: true
    });
  }
  return { familyLift: out, nSettled: recs.length, effectiveN: effN };
}

function hgFamilyLiftLine(row){
  if (!row) return '';
  if (row.liftR === null || row.nWith === 0){
    return 'measured: no settled samples yet';
  }
  var lift = (row.liftR >= 0 ? '+' : '') + row.liftR.toFixed(2) + 'R';
  var eff = (row.effectiveN !== null && row.effectiveN !== undefined) ? ' · eff n ' + row.effectiveN : '';
  return 'measured: ' + lift + ' over ' + row.nWith + ' agree / ' + row.nWithout + ' disagree'
    + eff + ' — ' + row.verdict;
}

function hgFamilyLiftMap(liftResult){
  var map = {}, rows = (liftResult && liftResult.familyLift) || [];
  for (var i = 0; i < rows.length; i++) map[rows[i].family] = rows[i];
  return map;
}

/* ================= render ================= */

function esc(s){
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function hgRenderScalpFamilyLedger(rollup, gateRowFn, liftMap){
  gateRowFn = gateRowFn || function(){ return ''; };
  liftMap = liftMap || {};
  var html = '';
  for (var i = 0; i < rollup.length; i++){
    var fam = rollup[i], scored = fam.nPass + fam.nVeto;
    var dissent = hgScalpDissentLine(fam);
    var lift = liftMap[fam.family];
    var liftTxt = lift ? hgFamilyLiftLine(lift) : '';
    var summary = esc(fam.label) + ' · ' + esc(fam.verdict) + ' · ' + fam.nPass + '/' + scored
      + (fam.nNa ? ' (' + fam.nNa + ' na)' : '')
      + (dissent ? ' · ' + esc(dissent) : '');
    html += '<details class="hg-fam-row hg-scalp-fam" style="margin:4px 0;border:1px solid var(--line);border-radius:4px;padding:4px 8px">'
      + '<summary style="cursor:pointer;font-size:11px;letter-spacing:.08em">' + summary + '</summary>'
      + (liftTxt ? '<div style="margin:4px 0 2px;font-size:10px;opacity:.75">' + esc(liftTxt) + '</div>' : '')
      + '<div class="ledger" style="margin-top:6px">';
    for (var j = 0; j < fam.members.length; j++){
      var m = fam.members[j];
      html += gateRowFn(m.id, m.name, m.state, m.detail);
    }
    html += '</div></details>';
  }
  return html;
}

/* Collect gateStates from a ledger so a booked setup can be measured later.
   Without this the lift table can never fill: nothing recorded gate states.
   'na' gates are omitted, not stored: every consumer treats absent and 'na'
   identically, so dropping them is lossless and keeps the record small
   (these live in localStorage and accumulate for the life of the book). */
function hgGateStatesFromLedger(ledger){
  var out = {}, rows = Array.isArray(ledger) ? ledger : [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r[0]) continue;
    var st = r[2];
    if (st !== 'pass' && st !== 'veto') continue;
    out[r[0]] = st;
  }
  return out;
}

/* Compact measured-lift block. Rendered as its own panel so the pack 16
   swing ledger renderer stays untouched. */
function hgRenderFamilyLiftTable(liftResult, title){
  var rows = (liftResult && liftResult.familyLift) || [];
  var nS = (liftResult && liftResult.nSettled) || 0;
  var head = '<div style="margin:8px 0 4px;font-size:11px;letter-spacing:.12em">'
    + esc(title || 'MEASURED FAMILY LIFT')
    + ' <span style="opacity:.6">' + nS + ' settled samples with gate states</span></div>';
  if (!nS){
    return head + '<div class="note" style="font-size:10px;opacity:.75">Nothing measured yet. '
      + 'Gate states are stamped on setups from now on, so this fills in as booked trades settle. '
      + 'It is empty because there is no history, not because the families failed.</div>';
  }
  var body = '';
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    var lift = (r.liftR === null) ? '—' : ((r.liftR >= 0 ? '+' : '') + r.liftR.toFixed(2) + 'R');
    body += '<div style="display:flex;gap:8px;font-size:10px;padding:1px 0">'
      + '<span style="flex:0 0 108px">' + esc(r.label) + '</span>'
      + '<span style="flex:0 0 62px;text-align:right">' + esc(lift) + '</span>'
      + '<span style="flex:0 0 96px;text-align:right;opacity:.7">n ' + r.nWith + '/' + r.nWithout + '</span>'
      + '<span style="opacity:.8">' + esc(r.verdict) + '</span>'
      + '</div>';
  }
  return head + body
    + '<div style="font-size:9px;opacity:.6;margin-top:3px">Lift = mean R when the family agreed minus '
    + 'mean R when it did not. A family counts once per trade, never once per gate.</div>';
}

G.hgRenderFamilyLiftTable = hgRenderFamilyLiftTable;
G.hgScalpGateFamilies = hgScalpGateFamilies;
G.hgScalpFamilyOrder = hgScalpFamilyOrder;
G.hgScalpGateIds = hgScalpGateIds;
G.hgRollupWith = hgRollupWith;
G.hgScalpRollup = hgScalpRollup;
G.hgScalpDissentLine = hgScalpDissentLine;
G.hgScalpVerdict = hgScalpVerdict;
G.hgFamilyLift = hgFamilyLift;
G.hgFamilyLiftLine = hgFamilyLiftLine;
G.hgFamilyLiftMap = hgFamilyLiftMap;
G.hgRenderScalpFamilyLedger = hgRenderScalpFamilyLedger;
G.hgGateStatesFromLedger = hgGateStatesFromLedger;
})();
