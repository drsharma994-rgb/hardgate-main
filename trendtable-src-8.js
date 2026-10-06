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


/* hg-v1082: FIVE-PILLAR STACK — technical, fundamental, sentiment, macro, micro.
   A FULL STACK row is one where every pillar is readable AND with the row's
   own majority. WITH is a positive read. An unread ATR, a mixed tape, a
   missing 4h structure, and BTC funding that is merely not crowded do not
   count as WITH. Structure must agree (EMA50 vs EMA200). An against pillar
   vetoes the stack. The composite, the PERFECT predicate, and the tiers are
   unchanged. A stricter desk, not a profit claim. */
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
    var structWith = false;
    try{
      var st = tmStructureDir(r.rows4h);
      if (st){
        notes.push('structure ' + st);
        if ((dir === 'long' && st === 'down') || (dir === 'short' && st === 'up')) against = true;
        if ((dir === 'long' && st === 'up') || (dir === 'short' && st === 'down')) structWith = true;
      }
    }catch(eSt){}
    if (!against && structWith && mom === 'with' && vol === 'with' && Math.abs(+r.score || 0) >= 4 && atr && atr.regime === 'HEALTHY' && chop && chop.state === 'trend') withIt = true;
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
        if (bm && bm.against === true){ mAgainst = true; macroBits[macroBits.length - 1] += ' crowded'; }
        else macroBits[macroBits.length - 1] += ' not crowded';
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
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + bag.map(trendmxLimitCardHTML).join('') + '</div></div>';
}

function trendmxSetupCardHTML(r, tier){
  tier = tier || 'clean';
  var dir = tmDirOf(r);
  if (!dir) return '';
  var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
  var stack = trendmxCardStack(r, dir);
  var cls = trendmxClassify(r, dir);
  var conv = trendmxConviction(r);
  var mini = [
    ['SCORE', (r.score > 0 ? '+' : '') + r.score + '/5'],
    ['ADX', isFinite(r.adx) ? r.adx.toFixed(1) : '—'],
    ['REGIME', cls.regime || '—']
  ];
  if (plan) mini.push(['ENTRY', pxFmt(plan.entry)], ['R:R', fmtN(plan.rr1, 1) + 'R']);
  var gates = [];
  if (r.gate) gates.push([r.gate.label, r.gate.clean7 && !r.gate.veto]);
  if (typeof hgSetupCardHTML !== 'function'){
    return '<div class="card ' + dir + '"><b>' + escH(r.sym) + '</b>' + tmVenueChip(r) + ' · ' + dir.toUpperCase() + '</div>';
  }
  return hgSetupCardHTML({
    sym: r.sym, dir: dir, tier: tier,
    mini: mini, gates: gates,
    plan: plan ? (trendmxPlanHTML(plan) + tmSmcChip(r) + trendmxFlowChipHtml(r) + trendmxMomChipHtml(r) + trendmxVolChipHtml(r) + trendmxFundingChipHtml(r) + trendmxAtrRegimeChipHtml(r) + trendmxFundChipHtml(r) + trendmxSlotChipHtml(r) + trendmxDayChipHtml(r) + trendmxCostChipHtml(r, plan) + trendmxChopChipHtml(r) + trendmxPillarHtml(r)) : '',
    entry: plan ? plan.entry : null, stop: plan ? plan.stop : null, t1: plan ? plan.t1 : null,
    chartId: (tier === 'clean' && plan) ? ('tmx_' + String(r.sym).replace(/[^A-Za-z0-9]/g, '')) : '',
    stack: stack,
    visionChip: r.visionChip, visionNextBar: r.visionNextBar, visionNextMove: r.visionNextMove, visionPrediction: r.visionPrediction,
    bookMeta: { scanner: 'trendmx', strategy: 'trendmx', t2: plan ? plan.t2 : null,
      venue: (typeof W.hgDeskVenueLabel === 'function') ? W.hgDeskVenueLabel(r.exchange) : 'BINANCE',
      visionChip: r.visionChip, visionNextBar: r.visionNextBar, visionNextMove: r.visionNextMove, visionPrediction: r.visionPrediction },
    note: tier !== 'clean' ? (tier === 'near' ? '6/7 NEAR — watch only, not a ticket.' : 'FORMING — trend signal without CLEAN ticket.') : null
  });
}

function trendmxPaintMiniCharts(cardsEl, rows){
  try{
    if (!cardsEl || typeof hgMiniChart !== 'function') return;
    var nodes = cardsEl.querySelectorAll('.hgchart');
    for (var i = 0; i < nodes.length; i++){
      var node = nodes[i], id = node.id || '', symGuess = id.replace(/^tmx_/, ''), row = null;
      for (var j = 0; j < rows.length; j++){
        if (rows[j] && String(rows[j].sym).replace(/[^A-Za-z0-9]/g, '') === symGuess){ row = rows[j]; break; }
      }
      if (!row || !row.rows4h) continue;
      var dir = tmDirOf(row);
      var plan = dir ? trendmxPlan(Object.assign({}, row, { dir: dir })) : null;
      hgMiniChart(node, row.rows4h, {
        dir: dir, entry: plan ? plan.entry : null, stop: plan ? plan.stop : null,
        t1: plan ? plan.t1 : null, t2: plan ? plan.t2 : null
      });
    }
  }catch(e){}
}

function trendmxPaintDeskSections(refs, state){
  var allRows = state.rows || [], golden = state.golden || [], death = state.death || [];
  var rows = allRows;
  if (state.venue && state.venue !== 'ALL'){
    rows = allRows.filter(function(r){ return tmRowVenue(r) === state.venue; });
    var onVenue = function(g){
      for (var gi = 0; gi < allRows.length; gi++){
        if (allRows[gi].sym === g.sym && tmRowVenue(allRows[gi]) === state.venue) return true;
      }
      return false;
    };
    golden = golden.filter(onVenue);
    death = death.filter(onVenue);   /* hg-v1014 */
    golden.held = (state.golden && state.golden.held) || golden.held;
    death.held = (state.death && state.death.held) || death.held;
  }
  var vc = state.venueCounts || null;
  if (refs.summary) refs.summary.textContent = rows.length ? trendmxSummaryLine(rows, golden, vc) : 'Idle — run a scan to build the desk.';
  /* hg-v1015: two desks, two containers — each renders only its own cross */
  if (refs.crypto) refs.crypto.innerHTML = trendmxCryptoDeskHTML(state.crypto || []);
  if (refs.golden) refs.golden.innerHTML = trendmxGoldenDeskHTML(golden);
  if (refs.death) refs.death.innerHTML = trendmxDeathDeskHTML(death);
  var clean = [], near = [], forming = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r) continue;
    var dir = tmDirOf(r);
    var plan = dir ? trendmxPlan(Object.assign({}, r, { dir: dir })) : null;
    var tier = trendmxRowTier(r, plan);
    if (tier === 'clean') clean.push(r);
    else if (tier === 'near') near.push(r);
    else if (r.freshCross || Math.abs(r.score) >= TM_MAJORITY || (r.gate && r.gate.gatesPassed >= 5)) forming.push(r);
  }
  clean.sort(function(a, b){ return Math.abs(b.score) - Math.abs(a.score); });
  near.sort(function(a, b){ return (b.gate ? b.gate.gatesPassed : 0) - (a.gate ? a.gate.gatesPassed : 0); });
  forming.sort(function(a, b){ return Math.abs(b.score) - Math.abs(a.score); });
  if (refs.cards){
    if (!clean.length){
      refs.cards.innerHTML = (typeof hgSetupEmptyHTML === 'function')
        ? hgSetupEmptyHTML({ title: 'No CLEAN trend tickets right now.', body: 'NEAR and FORMING rows below are watch-only. The golden and death cross desks and the limit board surface actionable rows when gates + plan align.' })   /* hg-v1015: two cross desks now */
        : '<div class="empty">No CLEAN tickets.</div>';
    } else {
      var ch = '<div class="note" style="margin:0 0 10px"><b>CLEAN TICKETS</b> — 7/7 gates + valid plan + min R:R ' + TM_MIN_RR + '.</div>';
      for (var ci = 0; ci < Math.min(clean.length, 12); ci++) ch += trendmxSetupCardHTML(clean[ci], 'clean');
      refs.cards.innerHTML = ch;
      trendmxPaintMiniCharts(refs.cards, clean);
    }
    try {
      if (typeof W.hgMpPin === 'function'){
        function tmWithPlan(row){
          var d = tmDirOf(row);
          var p = d ? trendmxPlan(Object.assign({}, row, { dir: d })) : null;
          return p ? Object.assign({}, row, p, { dir: d }) : row;
        }
        W.hgMpPin('trendmx', { cands: clean.map(tmWithPlan), nearCands: near.map(tmWithPlan), closest: forming[0] ? tmWithPlan(forming[0]) : null }, null, refs.cards);
      }
    } catch (eMp) {}
  }
  if (refs.near){
    refs.near.innerHTML = near.length
      ? ((typeof hgSetupNearHeaderHTML === 'function' ? hgSetupNearHeaderHTML(near.length, 'trendmx') : '')
        + near.slice(0, 8).map(function(r){ return trendmxSetupCardHTML(r, 'near'); }).join(''))
      : '';
  }
  if (refs.forming){
    refs.forming.innerHTML = (typeof hgFormingWatchHTML === 'function')
      ? hgFormingWatchHTML(forming.slice(0, 12).map(function(r){
          return {
            state: (r.gate && r.gate.gatesPassed >= 5) ? 'armed' : 'idle',
            sym: r.sym, strategy: 'TRENDMX',
            condition: (r.freshCross ? '⚡' + r.freshCross + ' · ' : '') + 'composite ' + (r.score > 0 ? '+' : '') + r.score + '/5',
            gatesPassed: r.gate ? r.gate.gatesPassed : null, gatesTotal: 7
          };
        }), { title: 'FORMING · TREND RADAR', subtitle: 'fresh crosses + strong composite without CLEAN ticket yet' })
      : '';
  }
  /* hg-v1018: the two limit classes, one collection, one forward record,
     two desks — each renders only its own formation class, like the cross
     desks above them (hg-v1015). */
  if (refs.trendform){
    refs.trendform.innerHTML = trendmxTrendFormHTML(rows);
  }
  if (refs.crown){
    refs.crown.innerHTML = trendmxCrownPanelHTML(state);
  }
  if (refs.gateclean || refs.conviction){
    var tmClasses = trendmxLimitClasses(rows);
    /* hg-v1019: each desk gets its OWN reason split, so its verdict names
       only the witnesses that fired on ITS class */
    if (refs.gateclean) refs.gateclean.innerHTML = trendmxGateCleanDeskHTML(tmClasses.clean, tmClasses.heldClean, tmClasses.heldWhy.clean);
    if (refs.conviction) refs.conviction.innerHTML = trendmxConvictionDeskHTML(tmClasses.conv, tmClasses.heldConv, tmClasses.heldWhy.conv);
  }
  /* hg-v1022: the PERFECT desk — the strictest confluence tier, built off the
     same rows the two limit desks just judged. Empty is policy (a perfect
     row is rare by design), not a fault — trendmxPerfectDeskHTML names it
     honestly with nothing when nothing qualifies. */
  if (refs.perfect){
    refs.perfect.innerHTML = trendmxFullStackDeskHTML(trendmxFullStackSetups(rows))
      + trendmxPerfectDeskHTML(trendmxPerfectSetups(rows));
  }
}

/* hg-v1039: THE MEASURED BOOK — the desk records every crowned CLEAN /
   PERFECT row (runScan) and this panel answers 'does the crown pay?' from
   settled forward records, including the TREND MATRIX stance split every
   other recording desk inherits. Evidence, never a gate. */
function trendmxPaintFwd(refs){
  if (!refs || !refs.fwd) return;
  try{
    if (typeof W.hgFwdPanelHTML === 'function'){
      refs.fwd.innerHTML = W.hgFwdPanelHTML('TRENDMX') || '';
    } else {
      refs.fwd.innerHTML = '<div class="note">Forward ledger absent — crowns are recorded nowhere to be measured.</div>';
    }
  }catch(e){ try{ refs.fwd.innerHTML = ''; }catch(e2){} }
}

/* hg-v1045: THE BULL / BEAR COLUMN VIEW — the full matrix regrouped into
