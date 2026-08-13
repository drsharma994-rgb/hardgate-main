/* HARDGATE — browser bridges for fix pack 16 (gold deep families). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_DEEP_GATE_META = {
  G1:{family:'trend',speed:'slow',label:'Weekly EMA9/21'}, G2:{family:'trend',speed:'medium',label:'4H EMA cascade'},
  G3:{family:'trend',speed:'slow',label:'1D vs EMA50 side'}, G4:{family:'trend',speed:'fast',label:'Heikin Ashi'},
  G5:{family:'trend',speed:'fast',label:'Hull MA slope'}, G6:{family:'trend',speed:'fast',label:'TEMA slope'},
  G7:{family:'trend',speed:'medium',label:'Donchian position'}, G8:{family:'trend',speed:'fast',label:'Parabolic SAR'},
  G9:{family:'trend',speed:'medium',label:'SuperTrend'}, G10:{family:'trend',speed:'slow',label:'Ichimoku TK+Kumo'},
  G17:{family:'trend',speed:'medium',label:'Keltner mid side'}, G24:{family:'trend',speed:'medium',label:'Awesome Oscillator'},
  G25:{family:'trend',speed:'medium',label:'Aroon oscillator'}, G33:{family:'trend',speed:'fast',label:'Fisher slope'},
  G34:{family:'trend',speed:'fast',label:'LinReg slope'}, G36:{family:'trend',speed:'fast',label:'ATR trailing stop'},
  G14:{family:'oscillator',label:'RSI exhaustion'}, G15:{family:'oscillator',label:'Williams %R'}, G16:{family:'oscillator',label:'CCI(20)'},
  G18:{family:'oscillator',label:'StochRSI'}, G19:{family:'oscillator',label:'MACD hist'}, G31:{family:'oscillator',label:'Bollinger %B'},
  G32:{family:'oscillator',label:'Stochastic K/D'}, G35:{family:'oscillator',label:'RSI divergence'},
  G20:{family:'flow',label:'MFI(14)'}, G21:{family:'flow',label:'CMF(20)'}, G22:{family:'flow',label:'Elder Ray'}, G23:{family:'flow',label:'OBV slope'},
  G11:{family:'adx',label:'ADX ≥25 + DI'}, G12:{family:'dxy',label:'DXY anti-correlation'}, G13:{family:'rates',label:'10Y / real yield'},
  G26:{family:'tsmom',label:'TSMOM 30/90d'}, G27:{family:'cusum',label:'CUSUM event alignment'}, G28:{family:'volregime',label:'Vol regime known'},
  G29:{family:'events',label:'NFP / event window'}, G30:{family:'fix',label:'London Fix / NY Close'}, G37:{family:'squeeze',label:'Bollinger squeeze'}
};
var FAM_ORDER = ['trend','oscillator','flow','adx','dxy','rates','tsmom','cusum','volregime','events','fix','squeeze'];
var FAM_LABELS = { trend:'TREND', oscillator:'OSCILLATOR', flow:'FLOW', adx:'ADX', dxy:'DXY', rates:'RATES',
  tsmom:'TSMOM', cusum:'CUSUM', volregime:'VOL REGIME', events:'EVENTS', fix:'FIX/CLOSE', squeeze:'SQUEEZE' };

function familyVerdict(members){
  var scored = members.filter(function(m){ return m.state !== 'na'; });
  if (!scored.length) return 'DARK';
  var passN = scored.filter(function(m){ return m.state === 'pass'; }).length;
  var vetoN = scored.length - passN;
  if (passN === scored.length) return 'AGREE';
  if (vetoN === scored.length) return 'OPPOSE';
  return 'SPLIT';
}

function hgGateFamilies(){ return HG_DEEP_GATE_META; }

function hgFamilyRollup(ledger){
  var byKey = {};
  for (var i = 0; i < ledger.length; i++){
    var row = ledger[i], id = row[0], meta = HG_DEEP_GATE_META[id] || { family: id.toLowerCase(), label: row[1] };
    var fam = meta.family;
    if (!byKey[fam]) byKey[fam] = { family: fam, label: FAM_LABELS[fam] || fam.toUpperCase(), members: [] };
    byKey[fam].members.push({ id: id, name: row[1], state: row[2], detail: row[3], speed: meta.speed || null, label: meta.label || row[1] });
  }
  var out = [];
  for (var j = 0; j < FAM_ORDER.length; j++){
    var key = FAM_ORDER[j], bucket = byKey[key];
    if (!bucket) continue;
    var members = bucket.members, verdict = familyVerdict(members);
    var dissent = [];
    if (verdict === 'SPLIT'){
      var passN = members.filter(function(m){ return m.state === 'pass'; }).length;
      var majorityPass = passN >= members.filter(function(m){ return m.state !== 'na'; }).length / 2;
      dissent = members.filter(function(m){
        if (m.state === 'na') return false;
        return majorityPass ? m.state !== 'pass' : m.state !== 'veto';
      });
    }
    out.push({
      family: key, label: bucket.label, verdict: verdict,
      nPass: members.filter(function(m){ return m.state === 'pass'; }).length,
      nVeto: members.filter(function(m){ return m.state === 'veto'; }).length,
      nNa: members.filter(function(m){ return m.state === 'na'; }).length,
      members: members, dissent: dissent,
      fastFlip: dissent.filter(function(d){ return d.speed === 'fast'; }),
      slowFlip: dissent.filter(function(d){ return d.speed === 'slow'; })
    });
  }
  return out;
}

function hgFamilyDissentLine(famRow){
  if (!famRow || famRow.verdict !== 'SPLIT' || !famRow.dissent.length) return '';
  var names = famRow.dissent.map(function(d){ return d.id + ' ' + d.label; }).join(', ');
  var tag = '';
  if (famRow.family === 'trend'){
    if (famRow.fastFlip.length && !famRow.slowFlip.length) tag = ' · fast members flipping';
    else if (famRow.slowFlip.length && !famRow.fastFlip.length) tag = ' · slow members flipping';
  }
  return 'dissent: ' + names + tag;
}

function hgFamilyVerdict(rollup, opts){
  opts = opts || {};
  var agree = 0, oppose = 0, dark = 0, split = 0, blockers = [], darkFamilies = [], splitFamilies = [];
  for (var i = 0; i < rollup.length; i++){
    var fam = rollup[i];
    if (fam.verdict === 'AGREE') agree++;
    else if (fam.verdict === 'OPPOSE') oppose++;
    else if (fam.verdict === 'DARK'){ dark++; darkFamilies.push(fam.label); }
    else if (fam.verdict === 'SPLIT'){ split++; splitFamilies.push(fam.label); }
    for (var j = 0; j < fam.members.length; j++){
      var m = fam.members[j];
      if ((m.id === 'G29' || m.id === 'G30') && m.state === 'veto') blockers.push(m.id);
    }
  }
  if (opts.structuralRrVeto) blockers.push('GS7/GC6');
  var timingVeto = blockers.indexOf('G29') >= 0 || blockers.indexOf('G30') >= 0;
  /* fix pack 17 — was FAM_ORDER.length (a hardcoded 12). hgFamilyRollup skips
     families with no gates present, so a partial ledger reported "8 of 12"
     while only 9 families existed: a denominator the read was never measured
     against. Thresholds are scaled off the same count, so with all 12 present
     they resolve to exactly the previous 10 / 8 / 6 and nothing changes. */
  var total = rollup.length;
  var needStrong = Math.ceil(total * 10 / 12);
  var needModerate = Math.ceil(total * 8 / 12);
  var needWeak = Math.ceil(total * 6 / 12);
  var label = 'BIAS ONLY', why = 'Direction exists; family agreement insufficient.', tier = 'bias';
  if (timingVeto){
    label = 'TIMING VETO'; tier = 'veto';
    why = 'Hard timing veto overrides family count.';
  } else if (opts.structuralRrVeto){
    label = 'STRUCTURAL VETO'; tier = 'veto';
    why = 'Structural R:R < 2 — not worth taking.';
  } else if (agree >= needStrong && oppose === 0 && dark <= 1 && split === 0){
    label = 'STRONG'; tier = 'strong';
    why = agree + ' of ' + total + ' families agree · oppose 0 · dark ' + dark;
  } else if (agree >= needModerate && oppose <= 1 && split <= 1){
    label = 'MODERATE'; tier = 'moderate';
    why = agree + ' of ' + total + ' families agree · oppose ' + oppose;
  } else if (agree >= needWeak){
    label = 'WEAK'; tier = 'weak';
    why = agree + ' of ' + total + ' families agree · oppose ' + oppose;
  }
  var headline = agree + ' of ' + total + ' families agree'
    + (dark ? ' · ' + dark + ' DARK (' + darkFamilies.join(', ') + ')' : '')
    + (split ? ' · ' + split + ' SPLIT (' + splitFamilies.join(', ') + ')' : '');
  return {
    agree: agree, oppose: oppose, dark: dark, split: split, total: total, label: label, why: why, tier: tier,
    blockers: blockers, timingVeto: timingVeto, headline: headline,
    legacyScore: opts.legacyScore != null ? opts.legacyScore : null,
    rareNote: 'STRONG now requires 10 of 12 INDEPENDENT families, not 30 of 37 overlapping gates. Fewer STRONG reads is the fix working.'
  };
}

var UNTRUSTED_VOL = { 'binance-paxg':1, 'binance-xaut':1, 'binance-xau':1, 'paxg':1, 'xaut':1 };
function hgVolumeTrust(source, tf){
  var src = String(source || '').toLowerCase();
  if (!src) return { trusted: false, reason: 'unknown provider' };
  // Tokenised-gold venues (PAXG/XAUT, incl. delta-xaut) report token flow, not gold flow.
  // This deny check runs first and intentionally also covers delta-xaut.
  if (UNTRUSTED_VOL[src] || /paxg|xaut|token/.test(src)) return { trusted: false, reason: 'volume is ' + source + ', not gold flow' };
  if (src.indexOf('xm-') === 0 || src === 'twelvedata' || src === 'yahoo') return { trusted: true, reason: 'gold venue volume' };
  // Default deny: an unrecognised feed never gets to vote on volume gates.
  return { trusted: false, reason: 'unknown provider' };
}

function hgMixedFeedReason(src, tfA, tfB){
  if (!src || !src[tfA] || !src[tfB] || src[tfA] === src[tfB]) return null;
  return 'mixed feed — ' + tfA + ' from ' + src[tfA] + ', ' + tfB + ' from ' + src[tfB];
}

function hgGoldSrcMixedLabel(src){
  if (!src) return '';
  var parts = [], tfs = ['15m','1h','4h','1d'];
  for (var i = 0; i < tfs.length; i++) if (src[tfs[i]]) parts.push(tfs[i] + ' ' + src[tfs[i]]);
  return parts.join(' · ');
}

function hgGoldSrcFinalize(out, legacyTf){
  if (!out.src) out.src = {};
  var providers = [], keys = Object.keys(out.src);
  for (var i = 0; i < keys.length; i++){
    var v = out.src[keys[i]];
    if (v && providers.indexOf(v) < 0) providers.push(v);
  }
  out.mixed = providers.length > 1;
  var leg = legacyTf || '15m';
  out.source = out.src[leg] || out.src['4h'] || out.src['1d'] || providers[0] || out.source || null;
  return out;
}

function hgGoldSrcAssign(out, tf, source, rowsKey, rows){
  if (!out || !tf || !source || !rows || !rows.length) return out;
  if (!out.src) out.src = {};
  if (rowsKey) out[rowsKey] = rows;
  out.src[tf] = source;
  return out;
}

function hgRenderFamilyLedger(rollup, gateRowFn, auditGate){
  gateRowFn = gateRowFn || function(){ return ''; };
  auditGate = auditGate || {};
  var html = '';
  for (var i = 0; i < rollup.length; i++){
    var fam = rollup[i], scored = fam.nPass + fam.nVeto;
    var total = fam.members.length;
    var dissent = hgFamilyDissentLine(fam);
    var summary = fam.label + ' · ' + fam.verdict + ' · ' + fam.nPass + '/' + scored
      + (fam.nNa ? ' (' + fam.nNa + ' na)' : '') + (dissent ? ' · ' + dissent : '');
    html += '<details class="hg-fam-row" style="margin:4px 0;border:1px solid var(--line);border-radius:4px;padding:4px 8px">'
      + '<summary style="cursor:pointer;font-size:11px;letter-spacing:.08em">' + summary + '</summary>'
      + '<div class="ledger" style="margin-top:6px">';
    for (var j = 0; j < fam.members.length; j++){
      var m = fam.members[j];
      var audit = auditGate[m.id];
      var auditTxt = audit ? ' <span style="opacity:.7;font-size:10px">' + audit + '</span>' : '';
      html += gateRowFn(m.id, m.name, m.state, m.detail + auditTxt);
    }
    html += '</div></details>';
  }
  return html;
}

function hgRenderDecisiveBlock(rows, fmtFn){
  fmtFn = fmtFn || function(n,d){ return String(n); };
  var html = '<div class="panel" style="margin-bottom:10px"><h2>Decisive reads <span>measured features · timing vetoes · external inputs</span></h2><div class="ledger">';
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    html += '<div class="kv"><span class="k">' + r.k + '</span><span class="v" style="color:var(--' + (r.state==='pass'?'pass':(r.state==='veto'?'short':'mut')) + ')">' + r.v + '</span></div>';
  }
  html += '</div></div>';
  return html;
}

G.hgGateFamilies = hgGateFamilies;
G.hgFamilyRollup = hgFamilyRollup;
G.hgFamilyDissentLine = hgFamilyDissentLine;
G.hgFamilyVerdict = hgFamilyVerdict;
G.hgVolumeTrust = hgVolumeTrust;
G.hgMixedFeedReason = hgMixedFeedReason;
G.hgGoldSrcMixedLabel = hgGoldSrcMixedLabel;
G.hgGoldSrcFinalize = hgGoldSrcFinalize;
G.hgGoldSrcAssign = hgGoldSrcAssign;
G.hgRenderFamilyLedger = hgRenderFamilyLedger;
G.hgRenderDecisiveBlock = hgRenderDecisiveBlock;
})();
