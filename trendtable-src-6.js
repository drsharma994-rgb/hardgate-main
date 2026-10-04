                 /* hg-v1012: the funding the row already carried — a desk that
                    has it in hand hands it in (hg-v985: the ledger has no
                    venue-safe symbol map, so a desk that hands in no funding
                    records none, and this desk recorded none until now).
                    fundAgainst then comes from the one rule in hg-setup-core.js. */
                 fundingPct: (c.row && typeof c.row.fundingPct === 'number' && isFinite(c.row.fundingPct)) ? c.row.fundingPct : undefined,
                 /* hg-v1012: the flow verdict at fire time, on the hg-v989
                    reads seam — true when real taker flow backed the row,
                    absent when the flow never spoke (NOT RECORDED, the third
                    state). Flow-AGAINST rows never reach this map: they were
                    held off above. The split is the layer's measurement. */
                 reads: (function(){
                   var rd = {};
                   if (c.row && c.row.flow && c.row.flow.verdict === 'with') rd.takerFlowWith = true;
                   /* hg-v1019: the momentum witness's read-mark rides the same
                      hg-v989 seam — true when the 1D RSI regime backed the row
                      at fire time, absent when the witness abstained or could
                      not read (NOT RECORDED, the third state). Momentum-AGAINST
                      rows never reach this map: they were held off above. */
                   if (trendmxMomState(c.row, c.dir) === 'with') rd.momWith = true;
                   /* hg-v1020: the volume witness's read-mark — true when the
                      swing OBV trend CONFIRMED the row's new extreme at fire
                      time, absent when it abstained or could not read. */
                   if (trendmxVolState(c.row, c.dir) === 'with') rd.volWith = true;
                   /* hg-v1034: the fundamental + sentiment read-mark — true
                      when the house stack backed the row (2+ net with) at
                      fire time, absent when it was silent or dark. Against /
                      refuse rows never reach this map (held off above). */
                   if (trendmxFundState(c.row, c.dir) === 'with') rd.fundWith = true;
                   return Object.keys(rd).length ? rd : undefined;
                 })(),
                 /* hg-v995: the composite is NOT handed in here -- the ledger reads it off
                    this desk's own published snapshot (hgTrendMatrixMark), the same row the
                    board painted, so a second copy would be the same number twice */
                 mechanic: (c.row && c.row.gate && c.row.gate.clean7) ? 'TM-CLEAN7' : 'TM-CONVICTION',
                 ticket: !!(c.row && c.row.gate && c.row.gate.clean7),
                 /* hg-v1022: the PERFECT read-mark — true when the row met the
                    strictest confluence bar at fire time, absent otherwise. The
                    split is how the PERFECT desk earns a measured outcome. */
                 perfect: (trendmxPerfectState(c.row) ? true : undefined) };
      }), { horizonBars: 20 });
    }
  } catch (eFwd) { try { if (typeof window.hgFwdWarn === "function") window.hgFwdWarn("trendtable", eFwd); } catch (eW) {} }
  return out;
}

/* hg-v1018: one desk renderer serves both formation classes — the desks
   differ in WHICH bag they render and the criteria their header names,
   nothing else. An empty bag with held-off rows renders the held-off
   verdict (never a blank desk pretending nothing qualified); an empty bag
   with nothing held off renders nothing, by design (the hg-v1015 rule). */
/* hg-v1019: the held-off verdict names each witness that actually fired.
   why = {flow, mom} per class; a legacy caller passing no why is the
   hg-v1012/hg-v1018 flow-only world, and its text stays byte-identical. */
function trendmxHeldBits(held, why){
  var w = why || { flow: held, mom: 0 };
  var bits = [];
  if (w.flow) bits.push('real Binance taker flow reads against the trend (hg-v1012)');
  if (w.mom) bits.push('the 1D RSI momentum range has turned against the trend (hg-v1019)');
  if (w.vol) bits.push('the 1D OBV volume trend diverges against the trend (hg-v1020)');
  if (w.fund) bits.push('the fundamental + sentiment stack stands against the trend — a calendar blackout or 2+ net checked votes (hg-v1034)');
  if (!bits.length) bits.push('real Binance taker flow reads against the trend (hg-v1012)');
  return bits;
}

function trendmxLimitDeskHTML(title, crit, bag, held, why){
  bag = (bag || []).slice(0, TM_LIMIT_DESK_CAP);
  if (!bag.length){
    /* every qualified row held off is a verdict, not an empty desk — name it */
    return held
      ? '<div class="panel" style="margin:12px 0">'
        + '<h2>' + title + ' <span>' + crit + '</span></h2>'
        + '<div class="note">' + held + ' qualified row' + (held === 1 ? '' : 's') + ' held off — ' + trendmxHeldBits(held, why).join('; ') + '. The rows paint in the matrix with their chips.</div></div>'
      : '';
  }
  var heldTag = '';
  if (held){
    var w2 = why || { flow: held, mom: 0 };
    var tags = [];
    if (w2.flow) tags.push('taker flow against');
    if (w2.mom) tags.push('momentum regime against');
    if (w2.vol) tags.push('volume trend against');
    if (w2.fund) tags.push('fundamental headwind');
    if (!tags.length) tags.push('taker flow against');
    heldTag = ' · ' + held + ' held off — ' + tags.join(' · ');
  }
  return '<div class="panel" style="margin:12px 0">'
    + '<h2>' + title + ' <span>' + crit
    + heldTag + '</span></h2>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + bag.map(trendmxLimitCardHTML).join('') + '</div></div>';
}

function trendmxGateCleanDeskHTML(bag, held, why){
  return trendmxLimitDeskHTML(
    'LIMIT BOARD · GATE-CLEAN DESK',
    'criteria: the 7/7 swing-gate matrix (spread · vol-Z · EMA21 anchor · funding · regime · structure · R:R) confirms the composite majority · exact resting limits · taker flow not against · 1D RSI momentum range not turned against · 1D OBV volume trend not diverging against · sorted by composite + gates',
    bag, held, why);
}

function trendmxConvictionDeskHTML(bag, held, why){
  return trendmxLimitDeskHTML(
    'LIMIT BOARD · CONVICTION DESK',
    'criteria: five-leg composite majority |≥2| (STRONG |≥4|) without the 7/7 stamp — 1D EMA200 · EMA50/200 cross · 4H EMA9/21/50 cascade · Ichimoku cloud · ADX strength · exact resting limits · taker flow not against · 1D RSI momentum range not turned against · 1D OBV volume trend not diverging against · ADX breaks composite ties',
    bag, held, why);
}

/* hg-v1022: the PERFECT desk collects the rows trendmxPerfectState crowned and
   builds a valid plan for each, ranked by |composite| then gates passed (the
   gate-clean desk's own intra-class rank). The bag reuses the shared card
   renderer with item.perfect set, so each card carries the ★ PERFECT stamp. */
function trendmxPerfectSetups(rows){
  var out = [];
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!trendmxPerfectState(r)) continue;
    var dir = tmDirOf(r);
    var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
    if (!tmValidSetup(plan)) continue;
    out.push({ row: r, plan: plan, dir: dir, stack: trendmxCardStack(r, dir), perfect: true,
               rank: Math.abs(r.score) * 10 + (r.gate.gatesPassed || 0) });
  }
  out.sort(function(a, b){ return b.rank - a.rank; });
  return out;
}


/* hg-v1078: FIVE-PILLAR STACK — technical, fundamental, sentiment, macro, micro.
   A FULL STACK row is one where every pillar is readable AND with the row's
   own majority. An unread pillar does not confirm. An against pillar vetoes
   the stack. This does not change the composite, the PERFECT predicate, or
   any tier. It is a stricter desk, not a profit claim. */
var __tmMacro = null;
function trendmxMacroSet(snap){ __tmMacro = snap || null; return __tmMacro; }
function trendmxFivePillars(r){
  r = r || {};
  var dir = tmDirOf(r);
  var pillars = [];
  if (!dir){
    pillars.push({ name: 'TECHNICAL', state: 'unread', detail: 'no majority' });
  } else {
    var against = false, withIt = false, notes = ['composite ' + r.score + '/5'];
    var mom = trendmxMomState(r, dir);
    var vol = trendmxVolState(r, dir);
    var chop = trendmxChopState(r);
    var atr = trendmxAtrRegime(r);
    if (mom) notes.push('momentum ' + mom);
    if (vol) notes.push('volume ' + vol);
    if (atr) notes.push('ATR ' + atr.regime);
    if (chop && chop.state) notes.push('tape ' + chop.state);
    if (mom === 'against' || vol === 'against' || (chop && chop.state === 'chop')) against = true;
    if (atr && (atr.regime === 'DEAD' || atr.regime === 'BLOWOFF')) against = true;
    try{
      var st = tmStructureDir(r.rows4h);
      if (st){
        notes.push('structure ' + st);
        if ((dir === 'long' && st === 'down') || (dir === 'short' && st === 'up')) against = true;
      }
    }catch(eSt){}
    if (!against && mom === 'with' && vol === 'with' && Math.abs(+r.score || 0) >= 4 && (!atr || atr.regime === 'HEALTHY')) withIt = true;
    pillars.push({ name: 'TECHNICAL', state: against ? 'against' : (withIt ? 'with' : 'flat'), detail: notes.join(' · ') });
  }
  var fund = dir ? trendmxFundState(r, dir) : null;
  pillars.push({ name: 'FUNDAMENTAL', state: fund || 'unread', detail: fund ? ('fundamental stack ' + fund) : 'fundamental stack dark' });
  var sentAgainst = false, sentWith = false, sentRead = false, sentNotes = [];
  if (r.flow && r.flow.verdict && r.flow.verdict !== 'unreadable'){
    sentRead = true;
    sentNotes.push('taker ' + r.flow.verdict);
    if (r.flow.verdict === 'against') sentAgainst = true;
    if (r.flow.verdict === 'with') sentWith = true;
  }
  if (dir && typeof r.fundingPct === 'number' && isFinite(r.fundingPct) && typeof W.hgFundingAgainstMark === 'function'){
    sentRead = true;
    try{
      var fm = W.hgFundingAgainstMark(r.fundingPct, dir);
      if (fm && fm.against === true){ sentAgainst = true; sentWith = false; sentNotes.push('funding crowded'); }
      else sentNotes.push('funding clean');
    }catch(eFm){}
  }
  pillars.push({ name: 'SENTIMENT', state: !sentRead ? 'unread' : (sentAgainst ? 'against' : (sentWith ? 'with' : 'flat')), detail: sentNotes.join(' · ') || 'no flow or funding' });
  var macroState = 'unread', macroBits = [];
  var macro = __tmMacro;
  if (macro && dir){
    var mAgainst = false, mWith = false;
    if (macro.btcFunding != null && typeof W.hgFundingAgainstMark === 'function'){
      try{
        var bm = W.hgFundingAgainstMark(+macro.btcFunding, dir);
        macroBits.push('BTC funding ' + (+macro.btcFunding).toFixed(4) + '%');
        if (bm && bm.against === true) mAgainst = true; else mWith = true;
      }catch(eBm){}
    }
    if (macro.btcStructure){
      macroBits.push('BTC structure ' + macro.btcStructure);
      if ((dir === 'long' && macro.btcStructure === 'down') || (dir === 'short' && macro.btcStructure === 'up')) mAgainst = true;
      if ((dir === 'long' && macro.btcStructure === 'up') || (dir === 'short' && macro.btcStructure === 'down')) mWith = true;
    }
    if (typeof W.hgMacroBias === 'function'){
      try{
        var mb = W.hgMacroBias(dir, r.sym);
        if (mb && (mb.state === 'with' || mb.state === 'against')){
          macroBits.push('desk macro ' + mb.state);
          if (mb.state === 'against') mAgainst = true;
          if (mb.state === 'with') mWith = true;
        }
      }catch(eMb){}
    }
    if (macroBits.length) macroState = mAgainst ? 'against' : (mWith ? 'with' : 'flat');
  }
  pillars.push({ name: 'MACRO', state: macroState, detail: macroBits.join(' · ') || 'BTC macro unread' });
  var microAgainst = false, microWith = false, microRead = false, microBits = [];
  if (r.rows4h && r.rows4h.length >= 21 && typeof W.hgSlotMeanVol === 'function'){
    try{
      var slot = W.hgSlotMeanVol(r.rows4h, 20);
      var lv = +r.rows4h[r.rows4h.length - 1].v;
      if (slot && isFinite(slot.mean) && slot.mean > 0 && isFinite(lv) && lv > 0){
        microRead = true;
        var rv = lv / slot.mean;
        microBits.push('session RVOL ' + rv.toFixed(2));
        if (rv < 0.7) microAgainst = true; else microWith = true;
      }
    }catch(eSl){}
  }
  if (dir && typeof W.hgCryptoCostR === 'function'){
    try{
      var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
      if (plan && isFinite(+plan.entry) && isFinite(+plan.stop)){
        var costR = W.hgCryptoCostR(+plan.entry, +plan.stop, 'taker', 'taker');
        if (isFinite(costR)){
          microRead = true;
          microBits.push('cost ' + costR.toFixed(2) + 'R');
          if (costR > 0.25){ microAgainst = true; microWith = false; }
        }
      }
    }catch(eC){}
  }
  pillars.push({ name: 'MICRO', state: !microRead ? 'unread' : (microAgainst ? 'against' : (microWith ? 'with' : 'flat')), detail: microBits.join(' · ') || 'no participation or cost read' });
  var complete = pillars.every(function(x){ return x.state === 'with'; });
  var blocked = pillars.some(function(x){ return x.state === 'against' || x.state === 'refuse'; });
  return { dir: dir, pillars: pillars, complete: complete, blocked: blocked };
}
function trendmxPillarHtml(r){
  try{
    var pack = trendmxFivePillars(r);
    var chips = pack.pillars.map(function(x){
      var cls = x.state === 'with' ? 'pass' : ((x.state === 'against' || x.state === 'refuse') ? 'bad' : 'na');
      return '<span class="stamp ' + cls + '" title="' + escH(x.detail) + '" style="margin-right:4px">' + escH(x.name) + ' ' + escH(String(x.state).toUpperCase()) + '</span>';
    }).join('');
    var head = pack.complete ? 'FULL STACK' : (pack.blocked ? 'STACK VETO' : 'STACK INCOMPLETE');
    return '<div class="note" style="margin-top:6px"><b>' + head + '</b> ' + chips + '</div>';
  }catch(e){ return ''; }
}
function trendmxFullStackSetups(rows){
  var out = [];
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!trendmxPerfectState(r)) continue;
    var pack = trendmxFivePillars(r);
    if (!pack.complete) continue;
    var dir = tmDirOf(r);
    var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
    if (!tmValidSetup(plan)) continue;
    out.push({ row: r, plan: plan, dir: dir, stack: trendmxCardStack(r, dir), perfect: true,
               rank: Math.abs(r.score) * 10 + ((r.gate && r.gate.gatesPassed) || 0) });
  }
  out.sort(function(a, b){ return b.rank - a.rank; });
  return out;
}
function trendmxFullStackDeskHTML(bag){
  bag = (bag || []).slice(0, TM_LIMIT_DESK_CAP);
  if (!bag.length) return '<div class="panel" style="margin:12px 0"><h2>FULL STACK DESK <span>prints only when technical, fundamental, sentiment, macro and micro are all readable and all with the majority, on top of a PERFECT row. Empty is the honest result. A pass is the right shape, not a profit.</span></h2><div class="note">No full-stack row this scan.</div></div>';
  return '<div class="panel" style="margin:12px 0"><h2>FULL STACK DESK <span>technical · fundamental · sentiment · macro · micro all WITH, on a PERFECT row. Shape filter, not a profit claim.</span></h2><div style="display:flex;gap:10px;flex-wrap:wrap">' + bag.map(trendmxLimitCardHTML).join('') + '</div></div>';
}

function trendmxPerfectDeskHTML(bag){
  bag = (bag || []).slice(0, TM_LIMIT_DESK_CAP);
  if (!bag.length) return '';   /* a perfect row is rare by design — an empty desk is policy, not a fault */
  return '<div class="panel" style="margin:12px 0">'
    + '<h2>PERFECT SETUP DESK <span>criteria: max composite |5/5| · 7/7 gate-clean · momentum witness WITH · volume witness WITH · taker flow never against · funding not crowded · evidence-only, measured by the forward ledger — a filter, not a promise</span></h2>'
