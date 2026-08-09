/* =========================================================================
   HARDGATE — setup-stack.js
   Unified Fundamental · Technical · Sentiment (FTS) stack for every setup
   tab (crypto + gold). Pure reads + thresholds; never throws; loaded after
   plans.js so hgConfirmedCascade / hgRegimeAllowsSetup are available.
   ========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_FUND_VETO = 0.05;
var HG_FUND_CAUTION = 0.04;
var HG_FNG_VETO_LOW = 20;
var HG_FNG_VETO_HIGH = 80;
var HG_FNG_CONTEXT_LOW = 21;
var HG_FNG_CONTEXT_HIGH = 79;

function _item(label, detail, align){
  return { label: label, detail: detail || '', align: align || 'neutral' };
}

function _pillar(){
  return { items: [], score: 0, veto: false, caution: false };
}

function _bump(pillar, item, vetoes, cautions){
  pillar.items.push(item);
  if (item.align === 'veto'){
    pillar.veto = true;
    pillar.score -= 2;
    vetoes.push(item.label + (item.detail ? ': ' + item.detail : ''));
  } else if (item.align === 'caution'){
    pillar.caution = true;
    pillar.score -= 1;
    cautions.push(item.label + (item.detail ? ': ' + item.detail : ''));
  } else if (item.align === 'with') pillar.score += 1;
  else if (item.align === 'against') pillar.score -= 1;
}

function _pillarTag(p){
  if (p.veto) return 'VETO';
  if (p.score >= 2) return 'OK';
  if (p.score >= 0) return 'MIX';
  return 'WEAK';
}

/** Snapshot cross-tab layer state (best-effort, sync). */
function hgSetupStackSnap(){
  try{
    var o = {};
    try{ if (G.S && G.S.fng) o.fng = G.S.fng; }catch(e1){}
    try{ if (typeof G.regimeState === 'function') o.regime = G.regimeState(); }catch(e2){}
    try{ if (typeof G.hgNewsState === 'function') o.news = G.hgNewsState(); }catch(e3){}
    try{ if (typeof G.onchainState === 'function') o.onchain = G.onchainState(); }catch(e4){}
    try{ if (typeof G.rotationState === 'function') o.rotation = G.rotationState(); }catch(e5){}
    try{ if (typeof G.getGoldMacroCached === 'function') o.macro = G.getGoldMacroCached(); }catch(e6){}
    try{ if (typeof G.getDeskMacroCached === 'function') o.desk = G.getDeskMacroCached(); }catch(e7){}
    if (o.desk && !o.macro) o.macro = o.desk;
    else if (o.desk && o.macro) o.macro = Object.assign({}, o.macro, o.desk);
    return o;
  }catch(e){ return {}; }
}

/**
 * Evaluate Fundamental / Technical / Sentiment alignment for a setup direction.
 * inp: { dir, style, asset, sym, rows4h, rows1h, ticker, gatesPassed, gatesTotal,
 *        clean, nearClean, fng, regime, news, onchain, rotation, macro, goldPositioning, positioning }
 */
function hgSetupStack(inp){
  inp = inp || {};
  var dir = String(inp.dir || '').toLowerCase();
  var style = String(inp.style || 'swing').toLowerCase();
  var sym = String(inp.sym || '');
  var asset = inp.asset || (/(XAU|XAUT|GOLD|PAXG)/i.test(sym) ? 'gold' : 'crypto');
  var rows4h = inp.rows4h || inp.rows || [];
  var ticker = inp.ticker || {};
  var fundamental = _pillar(), technical = _pillar(), sentiment = _pillar();
  var vetoes = [], cautions = [];
  var hasDir = (dir === 'long' || dir === 'short');

  if (hasDir){
    var cascStyle = (style === 'scalp') ? 'smart' : ((style === 'swing' || style === 'best' || style === 'cryptogates') ? 'swing' : style);
    if (typeof G.hgConfirmedCascade === 'function' && rows4h.length){
      var casc = G.hgConfirmedCascade(rows4h, cascStyle);
      if (casc && casc.confirmed && casc.dir === dir){
        _bump(technical, _item('cascade', casc.label, 'with'), vetoes, cautions);
      } else if (casc && casc.confirmed && casc.dir && casc.dir !== dir){
        _bump(technical, _item('cascade', casc.label + ' — against setup', 'against'), vetoes, cautions);
      } else if (casc){
        _bump(technical, _item('cascade', casc.label || 'mixed', 'neutral'), vetoes, cautions);
      }
    }
    if (isFinite(inp.gatesPassed) && isFinite(inp.gatesTotal)){
      var gp = +inp.gatesPassed, gt = +inp.gatesTotal;
      if (gp >= gt){
        _bump(technical, _item('gates', gp + '/' + gt + ' CLEAN', 'with'), vetoes, cautions);
      } else if (gp >= gt - 1){
        _bump(technical, _item('gates', gp + '/' + gt + ' NEAR', 'neutral'), vetoes, cautions);
      } else {
        _bump(technical, _item('gates', gp + '/' + gt, 'against'), vetoes, cautions);
      }
    }
    if (typeof G.hgRegimeAllowsSetup === 'function' && rows4h.length){
      var regAllow = G.hgRegimeAllowsSetup(rows4h, style);
      if (regAllow && !regAllow.allow){
        _bump(fundamental, _item('tape regime', regAllow.reason || 'blocked', 'veto'), vetoes, cautions);
      } else if (regAllow && regAllow.reason){
        _bump(fundamental, _item('tape regime', regAllow.reason, 'with'), vetoes, cautions);
      }
    }
    if (typeof G.hgTapeRegimeLabel === 'function' && rows4h.length){
      var tape = G.hgTapeRegimeLabel(rows4h);
      if (tape && tape !== 'n/a' && tape !== 'DATA THIN'){
        _bump(technical, _item('4H tape', tape, 'neutral'), vetoes, cautions);
      }
    }
  }

  var fund = ticker.fundingPct;
  if (fund !== null && fund !== undefined && isFinite(+fund) && hasDir){
    var fp = +fund;
    var payAgainst = (dir === 'long' && fp >= HG_FUND_CAUTION) || (dir === 'short' && fp <= -HG_FUND_CAUTION);
    var extreme = Math.abs(fp) >= HG_FUND_VETO - 1e-9;
    if (style === 'bias' && (extreme || payAgainst)){
      _bump(sentiment, _item('funding', fp.toFixed(4) + '%/interval crowded', 'veto'), vetoes, cautions);
    } else if (payAgainst && Math.abs(fp) >= HG_FUND_VETO){
      _bump(sentiment, _item('funding', fp.toFixed(4) + '% paying against', 'veto'), vetoes, cautions);
    } else if (payAgainst){
      _bump(sentiment, _item('funding', fp.toFixed(4) + '% against direction', 'caution'), vetoes, cautions);
    } else if (extreme){
      _bump(sentiment, _item('funding', fp.toFixed(4) + '% extreme — fade crowd', 'caution'), vetoes, cautions);
    } else {
      _bump(sentiment, _item('funding', fp.toFixed(4) + '% clean', 'with'), vetoes, cautions);
    }
  }

  var fng = inp.fng;
  if (!fng && G.S && G.S.fng) fng = G.S.fng;
  if (fng && isFinite(+fng.v) && hasDir){
    var fv = +fng.v;
    var fngVeto = (dir === 'long' && fv >= HG_FNG_VETO_HIGH) || (dir === 'short' && fv <= HG_FNG_VETO_LOW);
    if (style === 'bias' && fngVeto){
      _bump(sentiment, _item('F&G', fv + ' ' + (fng.c || ''), 'veto'), vetoes, cautions);
    } else if (fv <= HG_FNG_CONTEXT_LOW && dir === 'long'){
      _bump(sentiment, _item('F&G', fv + ' extreme fear — contrarian long context', 'with'), vetoes, cautions);
    } else if (fv >= HG_FNG_CONTEXT_HIGH && dir === 'short'){
      _bump(sentiment, _item('F&G', fv + ' extreme greed — contrarian short context', 'with'), vetoes, cautions);
    } else if (fngVeto){
      _bump(sentiment, _item('F&G', fv + ' extreme — chase risk', 'caution'), vetoes, cautions);
    } else {
      _bump(sentiment, _item('F&G', fv + ' neutral band', 'neutral'), vetoes, cautions);
    }
  }

  var news = inp.news;
  if (news && (news.caution || news.block)){
    _bump(fundamental, _item('news', news.title || news.reason || 'high-impact window', news.block ? 'veto' : 'caution'), vetoes, cautions);
  }

  var regime = inp.regime;
  if (regime && hasDir){
    if (regime.playbook && regime.playbook.bias){
      var rb = String(regime.playbook.bias).toUpperCase();
      if (rb.indexOf('LONG') >= 0 && rb.indexOf('ONLY') >= 0 && dir === 'short'){
        _bump(fundamental, _item('market regime', (regime.label || 'regime') + ' · LONG-ONLY', 'against'), vetoes, cautions);
      } else if (rb.indexOf('SHORT') >= 0 && rb.indexOf('ONLY') >= 0 && dir === 'long'){
        _bump(fundamental, _item('market regime', (regime.label || 'regime') + ' · SHORT-ONLY', 'against'), vetoes, cautions);
      } else if (rb.indexOf('ASIDE') >= 0 || rb.indexOf('STAND') >= 0){
        _bump(fundamental, _item('market regime', (regime.label || 'regime') + ' · stand aside', 'caution'), vetoes, cautions);
      } else if (regime.label){
        _bump(fundamental, _item('market regime', regime.label, 'with'), vetoes, cautions);
      }
    } else if (regime.label){
      _bump(fundamental, _item('market regime', regime.label, 'neutral'), vetoes, cautions);
    }
  }

  var oc = inp.onchain;
  if (oc && oc.bias && hasDir){
    if (oc.bias === 'bullish' && dir === 'long') _bump(fundamental, _item('on-chain', 'bullish', 'with'), vetoes, cautions);
    else if (oc.bias === 'bearish' && dir === 'short') _bump(fundamental, _item('on-chain', 'bearish', 'with'), vetoes, cautions);
    else _bump(fundamental, _item('on-chain', oc.bias + ' — against', 'against'), vetoes, cautions);
  }

  var rot = inp.rotation;
  if (rot && rot.btcSeason && hasDir){
    var season = String(rot.btcSeason).toLowerCase();
    if (season.indexOf('btc') >= 0 && dir === 'long' && asset === 'crypto'){
      _bump(fundamental, _item('rotation', rot.btcSeason, 'caution'), vetoes, cautions);
    } else if (rot.btcSeason){
      _bump(fundamental, _item('rotation', rot.btcSeason, 'neutral'), vetoes, cautions);
    }
  }

  if (asset === 'gold' && inp.macro){
    if (inp.macro.veto){
      _bump(fundamental, _item('macro', inp.macro.veto, 'veto'), vetoes, cautions);
    } else if (inp.macro.hint){
      _bump(fundamental, _item('macro', inp.macro.hint, 'neutral'), vetoes, cautions);
    }
  }

  var macroSnap = inp.macro;
  if (macroSnap && hasDir && asset === 'crypto'){
    if (macroSnap.dxyOfficial && macroSnap.dxyOfficial.trend20 === 'RISING' && dir === 'long'){
      _bump(fundamental, _item('DXY FRED', 'DTWEXBGS rising — headwind for risk-on longs', 'caution'), vetoes, cautions);
    } else if (macroSnap.dxyOfficial && macroSnap.dxyOfficial.trend20 === 'FALLING' && dir === 'long'){
      _bump(fundamental, _item('DXY FRED', 'DTWEXBGS falling — tailwind', 'with'), vetoes, cautions);
    } else if (macroSnap.dxyOfficial && macroSnap.dxyOfficial.trend20 === 'RISING' && dir === 'short'){
      _bump(fundamental, _item('DXY FRED', 'DTWEXBGS rising — supports USD shorts', 'with'), vetoes, cautions);
    }
    if (isFinite(+macroSnap.realYield10Y) && macroSnap.realYieldTrend === 'RISING' && dir === 'long'){
      _bump(fundamental, _item('real yield FRED', 'DFII10 ' + (+macroSnap.realYield10Y).toFixed(2) + '% rising', 'caution'), vetoes, cautions);
    } else     if (isFinite(+macroSnap.realYield10Y) && macroSnap.realYieldTrend === 'FALLING' && dir === 'long'){
      _bump(fundamental, _item('real yield FRED', 'DFII10 falling — gold/crypto long tailwind', 'with'), vetoes, cautions);
    }
    var desk = inp.desk || macroSnap;
    if (desk && isFinite(+desk.riskOnScore)){
      var ros = +desk.riskOnScore;
      if (ros >= 25 && dir === 'long'){
        _bump(fundamental, _item('OpenBB desk', 'SPY/VIX/desk RISK-ON (' + ros + ') — tailwind', 'with'), vetoes, cautions);
      } else if (ros <= -25 && dir === 'long'){
        _bump(fundamental, _item('OpenBB desk', 'desk RISK-OFF (' + ros + ') — headwind', 'caution'), vetoes, cautions);
      } else if (ros <= -25 && dir === 'short'){
        _bump(fundamental, _item('OpenBB desk', 'desk RISK-OFF — supports short beta', 'with'), vetoes, cautions);
      } else if (ros >= 25 && dir === 'short'){
        _bump(fundamental, _item('OpenBB desk', 'desk RISK-ON — against short', 'caution'), vetoes, cautions);
      }
      if (desk.vix && isFinite(+desk.vix.last) && +desk.vix.last >= 26 && dir === 'long'){
        _bump(fundamental, _item('VIX', 'VIX ' + (+desk.vix.last).toFixed(1) + ' elevated — size down', 'caution'), vetoes, cautions);
      }
    }
  }

  if (asset === 'gold' && inp.goldPositioning){
    if (inp.goldPositioning.veto){
      _bump(sentiment, _item('XAU positioning', inp.goldPositioning.veto, 'veto'), vetoes, cautions);
    } else if (inp.goldPositioning.warn){
      _bump(sentiment, _item('XAU positioning', inp.goldPositioning.warn, 'caution'), vetoes, cautions);
    }
  }

  if (inp.positioning && inp.positioning.items){
    for (var pi = 0; pi < inp.positioning.items.length; pi++){
      var it = inp.positioning.items[pi];
      if (!it) continue;
      _bump(sentiment, _item(it.label || 'positioning', it.detail || '', it.align || 'neutral'), vetoes, cautions);
    }
  }

  var totalVeto = fundamental.veto || technical.veto || sentiment.veto;
  var net = fundamental.score + technical.score + sentiment.score;
  var tierHint = 'forming';
  if (inp.clean === true || (isFinite(inp.gatesPassed) && isFinite(inp.gatesTotal) && inp.gatesPassed >= inp.gatesTotal)){
    tierHint = totalVeto ? 'aside' : 'clean';
  } else if (inp.nearClean === true || (isFinite(inp.gatesPassed) && isFinite(inp.gatesTotal) && inp.gatesPassed >= inp.gatesTotal - 1)){
    tierHint = totalVeto ? 'aside' : 'near';
  } else if (totalVeto){
    tierHint = 'aside';
  } else if (technical.score >= 2 && sentiment.score >= 0 && fundamental.score >= -1){
    tierHint = 'clean';
  } else if (technical.score >= 1 && !sentiment.veto){
    tierHint = 'near';
  }

  return {
    dir: dir, style: style, asset: asset, sym: sym,
    fundamental: fundamental, technical: technical, sentiment: sentiment,
    vetoes: vetoes, cautions: cautions,
    alignScore: net, tierHint: tierHint,
    summary: 'F:' + _pillarTag(fundamental) + ' · T:' + _pillarTag(technical) + ' · S:' + _pillarTag(sentiment)
  };
}

function hgSetupStackFromHit(hit, opts){
  opts = opts || {};
  if (!hit || !hit.dir) return null;
  var snap = (typeof hgSetupStackSnap === 'function') ? hgSetupStackSnap() : {};
  return hgSetupStack(Object.assign({}, snap, {
    dir: hit.dir,
    sym: hit.sym || opts.sym,
    style: opts.style || hit.style || 'swing',
    rows4h: opts.rows4h || hit.rows,
    rows1h: opts.rows1h,
    ticker: opts.ticker,
    gatesPassed: hit.passed != null ? hit.passed : (hit.clean ? 7 : undefined),
    gatesTotal: hit.gatesTotal || 7,
    clean: hit.clean === true,
    nearClean: hit.nearClean === true,
    macro: opts.macro,
    goldPositioning: opts.goldPositioning,
    positioning: opts.positioning
  }, opts.layers || {}));
}

function hgSetupStackAttach(hit, opts){
  try{
    var st = hgSetupStackFromHit(hit, opts);
    if (st) hit.stack = st;
  }catch(e){}
  return hit;
}

function _ptsAlign(pts){
  if (!isFinite(+pts)) return 'neutral';
  if (+pts > 0) return 'with';
  if (+pts < 0) return 'against';
  return 'neutral';
}

/** Map confluence tally parts (gold) or edge parts into positioning items. */
function hgSetupStackEvidenceItems(parts){
  try{
    if (!parts || !parts.length) return null;
    var items = [];
    for (var i = 0; i < parts.length; i++){
      var p = parts[i];
      if (!p) continue;
      items.push(_item(p.label || 'read', p.detail || '', p.align || _ptsAlign(p.pts)));
    }
    return items.length ? { items: items } : null;
  }catch(e){ return null; }
}

/** Gold swing/scalp: evaluate FTS from transparent tallyParts + macro context. */
function hgSetupStackFromTallyParts(parts, opts){
  opts = opts || {};
  var snap = (typeof hgSetupStackSnap === 'function') ? hgSetupStackSnap() : {};
  var tally = isFinite(+opts.tally) ? +opts.tally : 0;
  var clean = opts.clean;
  if (clean === undefined) clean = tally >= 2 && opts.grade === 'A';
  var nearClean = opts.nearClean;
  if (nearClean === undefined) nearClean = !clean && tally >= 1;
  return hgSetupStack(Object.assign({}, snap, opts, {
    positioning: hgSetupStackEvidenceItems(parts),
    clean: clean === true,
    nearClean: nearClean === true,
    gatesPassed: clean ? 7 : (nearClean ? 6 : (tally >= 0 ? 5 : 4)),
    gatesTotal: 7
  }));
}

/** BRAIN row: layer votes + tier map into FTS pillars. */
function hgSetupStackFromBrainRow(row, opts){
  opts = opts || {};
  if (!row || !row.dec) return null;
  var dec = row.dec, dir = dec.dir;
  if (dir !== 'long' && dir !== 'short') return null;
  var setupTier = (typeof G.hgBrainSetupTier === 'function') ? G.hgBrainSetupTier(dec.tier) : 'clean';
  var posItems = [];
  if (row.col && row.col.votes){
    for (var i = 0; i < row.col.votes.length; i++){
      var v = row.col.votes[i];
      if (!v || v.vote === 'neutral') continue;
      var align = 'neutral';
      if (v.vote === 'veto' || v.veto) align = 'veto';
      else if (v.caution) align = 'caution';
      else if (v.vote === dir) align = 'with';
      else align = 'against';
      posItems.push(_item(v.layer || 'layer', v.text || v.kind || '', align));
    }
  }
  if (dec.vetoes && dec.vetoes.length){
    for (var vi = 0; vi < dec.vetoes.length; vi++){
      posItems.push(_item('veto', dec.vetoes[vi], 'veto'));
    }
  }
  var snap = (typeof hgSetupStackSnap === 'function') ? hgSetupStackSnap() : {};
  return hgSetupStack(Object.assign({}, snap, opts, {
    dir: dir,
    style: 'brain',
    asset: row.lane === 'gold' ? 'gold' : 'crypto',
    sym: row.sym,
    rows4h: row.rows || opts.rows4h,
    clean: setupTier === 'clean',
    nearClean: setupTier === 'near',
    gatesPassed: setupTier === 'clean' ? 7 : (setupTier === 'near' ? 6 : 5),
    gatesTotal: 7,
    positioning: posItems.length ? { items: posItems } : undefined
  }));
}

function hgSetupStackAttachPlan(plan, opts){
  try{
    if (!plan || !plan.dir) return plan;
    if (plan.stack) return plan;
    var hit = { dir: plan.dir, sym: opts && opts.sym, clean: !!(opts && opts.clean), nearClean: !!(opts && opts.nearClean) };
    hgSetupStackAttach(hit, opts || {});
    if (hit.stack) plan.stack = hit.stack;
  }catch(e){}
  return plan;
}

/** Inline scanner tabs (COIL/DIV/APEX/TRAP/SMC/OB/PINE): one-call FTS attach. */
function hgSetupStackForInlineScan(opts){
  opts = opts || {};
  if (typeof hgSetupStack !== 'function') return null;
  var snap = (typeof hgSetupStackSnap === 'function') ? hgSetupStackSnap() : {};
  var forming = opts.forming === true;
  var clean = opts.clean === true && !forming;
  var nearClean = opts.nearClean === true || forming;
  return hgSetupStack(Object.assign({}, snap, opts, {
    clean: clean,
    nearClean: nearClean && !clean,
    gatesPassed: clean ? 7 : (nearClean ? 6 : 5),
    gatesTotal: 7
  }));
}

function hgSetupStackForPineSig(sig, opts){
  opts = opts || {};
  if (!sig || !sig.dir) return null;
  var forming = sig.isRecent || sig.isContext || sig.edgeForming;
  var clean = sig.isNew === true || sig.edgeTicket === true;
  return hgSetupStackForInlineScan(Object.assign({
    dir: sig.dir, sym: sig.sym, style: 'pine', asset: 'crypto',
    clean: clean, nearClean: !clean && forming, forming: forming && !clean,
    gatesPassed: clean ? 7 : (forming ? 6 : 5), gatesTotal: 7
  }, opts || {}));
}

function hgSetupStackMiniHtml(stack){
  try{
    if (!stack || !stack.summary) return '';
    var esc = function(s){
      return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    };
    var cls = stack.tierHint === 'clean' ? 'ok' : (stack.tierHint === 'near' ? '' : (stack.tierHint === 'aside' ? 'bad' : ''));
    var vetoLine = stack.vetoes && stack.vetoes.length
      ? ' · <span class="gpip bad">' + esc(stack.vetoes[0]) + '</span>' : '';
    return '<div class="mini hg-stack-row" style="margin-top:4px"><span class="k">FTS</span><span>'
      + '<span class="gpip ' + cls + '">' + esc(stack.summary) + '</span>' + vetoLine + '</span></div>';
  }catch(e){ return ''; }
}

G.HG_FUND_VETO = HG_FUND_VETO;
G.HG_FNG_VETO_LOW = HG_FNG_VETO_LOW;
G.HG_FNG_VETO_HIGH = HG_FNG_VETO_HIGH;
G.hgSetupStackSnap = hgSetupStackSnap;
G.hgSetupStack = hgSetupStack;
G.hgSetupStackFromHit = hgSetupStackFromHit;
G.hgSetupStackAttach = hgSetupStackAttach;
G.hgSetupStackAttachPlan = hgSetupStackAttachPlan;
G.hgSetupStackEvidenceItems = hgSetupStackEvidenceItems;
G.hgSetupStackFromTallyParts = hgSetupStackFromTallyParts;
G.hgSetupStackFromBrainRow = hgSetupStackFromBrainRow;
G.hgSetupStackForInlineScan = hgSetupStackForInlineScan;
G.hgSetupStackForPineSig = hgSetupStackForPineSig;
G.hgSetupStackMiniHtml = hgSetupStackMiniHtml;

})();
