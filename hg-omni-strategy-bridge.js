/* =========================================================================
   HARDGATE — hg-omni-strategy-bridge.js
   Shares OMNIROUTE mechanic registry + replay/nightly principal across
   SUPER / PINE / MODELS / COMMAND (BRAIN / BOOK / TRADE / LOG / NEWS / BIAS /
   REGIME / TREND MATRIX / ROTATION / GATES / STAR TRADER) tabs.

   Applies v531 replay demotes, formation nightly day-aside/prefer, and
   desk-formation-edge analogues. Demote/suppress only — never loosens G1–G7.
   ========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var OMNI_NATIVE = ['SPRING', 'UTAD', 'PO3', 'ORB', 'ABSORB', 'VALUE', 'MMOVE'];
var OMNI_CONVICTION = ['HTF-PULLBACK', 'DONCHIAN-DRIVE', 'AVWAP-DEFEND', 'COMPRESSION-BREAK', 'SWEEP-RECLAIM', 'EXHAUST-REVERT'];
var OMNI_BEST = ['AVWAP-RECLAIM', 'CUSUM-SHIFT', 'DONCHIAN-DRIVE', 'MMOVE', 'NR7-BREAK'];

var TAB_DESK = {
  'super-setup': 'swing', 'super-best': 'swing', 'super-sniper': 'reversalsniper',
  'super-book': 'swing', 'super-calibrate': 'swing',
  'pine': 'edge', 'pine-msb': 'smc', 'pine-sqz': 'squeeze', 'pine-smf': 'smart',
  'pine-ht': 'edge', 'pine-smc': 'smc', 'pine-cipher': 'edge', 'pine-rf': 'edge',
  'pine-nw': 'coil', 'pine-avwap': 'edge',
  'strats': 'swing', 'meanrev': 'divergence', 'formationlab': 'swing',
  'scorecard': 'swing', 'reliability': 'swing',
  'brain': 'swing', 'book': 'swing', 'trade': 'swing', 'log': 'swing',
  'news': 'edge', 'bias': 'swing', 'regime': 'edge', 'trendmx': 'swing',
  'rotation': 'smart', 'execute': 'swing', 'startrader': 'swing'
};

var SCRIPT_TAB = {
  'lorentzian-kernel': 'pine', 'msb-ob': 'pine-msb', 'squeeze-momentum': 'pine-sqz',
  'smart-money-flow': 'pine-smf', 'half-trend': 'pine-ht', 'smc-core': 'pine-smc',
  'vumanchu-cipher': 'pine-cipher', 'range-filter': 'pine-rf', 'nw-envelope': 'pine-nw',
  'weekly-avwap': 'pine-avwap'
};

var TAB_KIND = {
  'super-setup': 'TREND-RECLAIM', 'super-best': 'CUSUM-SHIFT', 'super-sniper': 'PIN-REJECT',
  'super-book': 'MMOVE', 'super-calibrate': 'NR7-BREAK',
  'pine': 'NR7-BREAK', 'pine-msb': 'FVG-FILL', 'pine-sqz': 'SQUEEZE-FIRE',
  'pine-smf': 'CUSUM-SHIFT', 'pine-ht': 'HTF-PULLBACK', 'pine-smc': 'FVG-FILL',
  'pine-cipher': 'VOL-EXPANSION', 'pine-rf': 'DONCHIAN-DRIVE', 'pine-nw': 'NR7-BREAK',
  'pine-avwap': 'AVWAP-RECLAIM',
  'strats': 'TREND-RECLAIM', 'meanrev': 'VWAP-REVERT', 'formationlab': 'BOS-RETEST',
  'scorecard': 'MMOVE', 'reliability': 'MMOVE',
  'brain': 'MMOVE', 'book': 'MMOVE', 'trade': 'TREND-RECLAIM', 'log': 'MMOVE',
  'news': 'ORB', 'bias': 'HTF-PULLBACK', 'regime': 'COMPRESSION-BREAK',
  'trendmx': 'DONCHIAN-DRIVE', 'rotation': 'CUSUM-SHIFT', 'execute': 'TREND-RECLAIM',
  'startrader': 'DONCHIAN-DRIVE'
};

var SCRIPT_KIND = {
  'lorentzian-kernel': 'CUSUM-SHIFT', 'msb-ob': 'FVG-FILL', 'squeeze-momentum': 'SQUEEZE-FIRE',
  'smart-money-flow': 'CUSUM-SHIFT', 'half-trend': 'HTF-PULLBACK', 'smc-core': 'FVG-FILL',
  'vumanchu-cipher': 'VOL-EXPANSION', 'range-filter': 'DONCHIAN-DRIVE',
  'nw-envelope': 'NR7-BREAK', 'weekly-avwap': 'AVWAP-RECLAIM'
};

var STRAT_KIND = {
  ema: 'TREND-RECLAIM', connors: 'VWAP-REVERT', donchian: 'DONCHIAN-DRIVE'
};

function gfn(n){ return (W && typeof W[n] === 'function') ? W[n] : null; }

function hgOmniStrategyKinds(){
  var mech = (W.HG_MECH_KINDS && W.HG_MECH_KINDS.length) ? W.HG_MECH_KINDS.slice() : [];
  var out = OMNI_NATIVE.concat(mech, OMNI_CONVICTION);
  var seen = {}, i, k, uniq = [];
  for (i = 0; i < out.length; i++){
    k = out[i];
    if (!k || seen[k]) continue;
    seen[k] = true;
    uniq.push(k);
  }
  return uniq;
}

function hgOmniPrincipalDesk(tab){
  tab = String(tab || '').toLowerCase();
  return TAB_DESK[tab] || tab;
}

function hgOmniPrincipalTabForScript(scriptId){
  var s = String(scriptId || '').toLowerCase();
  return SCRIPT_TAB[s] || '';
}

function hgOmniPrincipalKind(tab, strategy){
  tab = String(tab || '').toLowerCase();
  var s = String(strategy || '').toLowerCase();
  if (SCRIPT_KIND[s]) return SCRIPT_KIND[s];
  if (STRAT_KIND[s]) return STRAT_KIND[s];
  if (TAB_KIND[tab]) return TAB_KIND[tab];
  if (s && s.indexOf('pin') >= 0) return 'PIN-REJECT';
  if (s && s.indexOf('squeeze') >= 0) return 'SQUEEZE-FIRE';
  if (s && s.indexOf('smc') >= 0) return 'FVG-FILL';
  if (s && s.indexOf('avwap') >= 0) return 'AVWAP-RECLAIM';
  if (s && s.indexOf('donchian') >= 0) return 'DONCHIAN-DRIVE';
  if (s && s.indexOf('rsi') >= 0) return 'RSI-DIVERGE';
  if (s && s.indexOf('mean') >= 0) return 'VWAP-REVERT';
  return '';
}

function hgOmniPrincipalApply(cand, opts){
  if (!cand || typeof cand !== 'object') return cand;
  opts = opts || {};
  var tab = opts.tab || cand.tab || cand.scanner || '';
  if (!tab && cand.scriptId) tab = hgOmniPrincipalTabForScript(cand.scriptId);
  var desk = hgOmniPrincipalDesk(tab);
  var kind = opts.kind || cand.omniKind || cand.kind || cand.mechanic
    || hgOmniPrincipalKind(tab, cand.strategy || cand.scriptId || cand.script);
  if (kind){
    cand.omniKind = kind;
    cand.kind = cand.kind || kind;
    cand.mechanic = cand.mechanic || kind;
  }

  if (kind && gfn('hgOmniKindDemotion')){
    try{
      var dem = W.hgOmniKindDemotion(kind);
      if (dem){
        cand.kindDemotion = dem;
        cand.formationOk = false;
        cand.omniPrincipal = 'replay-demoted';
        cand.demoted = true;
        cand.near = true;
        cand.clean = false;
        if (opts.strictDemote) return cand;
      }
    }catch(eD){}
  }

  if (kind && gfn('hgOmniNightlyAside')){
    try{
      if (W.hgOmniNightlyAside(kind)){
        cand.nightlyAside = true;
        cand.omniPrincipal = cand.omniPrincipal || 'nightly-aside';
        cand.demoted = true;
        cand.near = true;
        cand.clean = false;
      }
    }catch(eN){}
  }

  if (gfn('hgOmniNightlyPrefer') && kind){
    try{
      if (W.hgOmniNightlyPrefer(kind)) cand.omniPrefer = true;
    }catch(eP){}
  }

  if (gfn('hgDeskFormationEdgeApply')){
    try{
      W.hgDeskFormationEdgeApply(cand, {
        tab: desk, kind: kind, rows: opts.rows || cand.rows || cand.rows4h, dir: cand.dir
      });
      if (cand.deskEdgeAction === 'suppress' || cand.deskEdgeAction === 'demote'){
        cand.omniPrincipal = 'desk-edge-' + cand.deskEdgeAction;
        cand.demoted = true;
        cand.near = true;
        cand.clean = false;
      }
    }catch(eE){}
  }

  if (!cand.omniPrincipal) cand.omniPrincipal = 'pass';
  hgOmniPrincipalDemoteEffects(cand, opts);
  return cand;
}

function hgOmniPrincipalDemoteEffects(cand, opts){
  if (!cand || typeof cand !== 'object') return cand;
  opts = opts || {};
  var blocked = cand.demoted === true
    || cand.deskEdgeAction === 'suppress' || cand.deskEdgeAction === 'demote'
    || cand.omniPrincipal === 'replay-demoted' || cand.nightlyAside === true
    || (cand.omniPrincipal && String(cand.omniPrincipal).indexOf('desk-edge-') === 0);
  if (!blocked) return cand;
  cand.omniDemoted = true;
  if (opts.stripClean === false) return cand;
  cand.clean = false;
  cand.near = true;
  cand.nearWatch = true;
  cand.watchOnly = true;
  cand.ticket = false;
  cand.minimalLossPass = false;
  if (cand.tier === 'clean' || cand.tier === 'PRIME' || cand.tier === 'HIGH'){
    cand.tier = opts.tierDemote || 'near';
  }
  return cand;
}

function hgOmniPrincipalRows(rows, tab, opts){
  opts = opts || {};
  tab = tab || opts.tab || '';
  var out = [], i, r;
  rows = rows || [];
  for (i = 0; i < rows.length; i++){
    r = hgOmniPrincipalApply(rows[i], Object.assign({ tab: tab }, opts));
    if (opts.filterSuppress && (r.deskEdgeAction === 'suppress' || r.omniPrincipal === 'replay-demoted')) continue;
    out.push(r);
  }
  return out;
}

function hgOmniPrincipalBanner(tab){
  var h = '', desk = hgOmniPrincipalDesk(tab);
  try{
    if (gfn('hgDeskFormationEdgeBannerHtml')){
      h += W.hgDeskFormationEdgeBannerHtml(desk) || '';
    }
  }catch(eB){}
  try{
    if (gfn('hgTabFormationDayHtml')){
      var day = W.hgTabFormationDayHtml(tab);
      if (day) h += day;
    }
  }catch(eD){}
  return h;
}

function hgOmniPrincipalReplayNote(tab){
  var kind = hgOmniPrincipalKind(tab, '');
  var bits = [];
  if (kind) bits.push('OMNI analogue <b>' + kind + '</b>');
  if (kind && gfn('hgOmniKindDemotion')){
    try{
      var dem = W.hgOmniKindDemotion(kind);
      if (dem) bits.push('replay demote');
    }catch(e){}
  }
  if (kind && gfn('hgOmniNightlyAside')){
    try{ if (W.hgOmniNightlyAside(kind)) bits.push('nightly aside'); }catch(e2){}
  }
  if (kind && gfn('hgOmniNightlyPrefer')){
    try{ if (W.hgOmniNightlyPrefer(kind)) bits.push('nightly prefer'); }catch(e3){}
  }
  if (!bits.length) return '';
  return bits.join(' · ');
}

function hgOmniPrincipalNoteHtml(tab){
  var note = hgOmniPrincipalReplayNote(tab);
  if (!note) return '';
  return '<div class="note" data-hg-omni-principal="1" style="margin:8px 0">' + note + '</div>';
}

W.hgOmniStrategyKinds = hgOmniStrategyKinds;
W.hgOmniPrincipalDesk = hgOmniPrincipalDesk;
W.hgOmniPrincipalTabForScript = hgOmniPrincipalTabForScript;
W.hgOmniPrincipalKind = hgOmniPrincipalKind;
W.hgOmniPrincipalApply = hgOmniPrincipalApply;
W.hgOmniPrincipalDemoteEffects = hgOmniPrincipalDemoteEffects;
W.hgOmniPrincipalRows = hgOmniPrincipalRows;
W.hgOmniPrincipalBanner = hgOmniPrincipalBanner;
W.hgOmniPrincipalReplayNote = hgOmniPrincipalReplayNote;
W.hgOmniPrincipalNoteHtml = hgOmniPrincipalNoteHtml;
W.HG_OMNI_SCRIPT_TAB = Object.assign({}, SCRIPT_TAB);
W.HG_OMNI_BEST_KINDS = OMNI_BEST.slice();
W.HG_OMNI_TAB_KIND = Object.assign({}, TAB_KIND);
W.HG_OMNI_SCRIPT_KIND = Object.assign({}, SCRIPT_KIND);

})();
