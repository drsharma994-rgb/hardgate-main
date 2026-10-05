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
   three columns by the row's own majority direction (composite >= +2 BULL,
   <= -2 BEAR, everything between MIXED / CHOP). Each column reuses the desk's
   own card renderer, ordered by |composite| then gates. Same rows, same
   gates, same evidence — a different reading order. */
function trendmxColumnsHTML(rows){
  try{
    if (!Array.isArray(rows) || !rows.length) return '<div class="empty">No rows to group.</div>';
    var bull = [], bear = [], mixed = [], i, r, d;
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      d = tmDirOf(r);
      if (d === 'long') bull.push(r);
      else if (d === 'short') bear.push(r);
      else mixed.push(r);
    }
    function byStrength(list){
      return list.slice().sort(function(a, b){
        var pa = Math.abs(+a.score || 0), pb = Math.abs(+b.score || 0);
        if (pb !== pa) return pb - pa;
        var ga = (a.gate && isFinite(a.gate.gatesPassed)) ? a.gate.gatesPassed : -1;
        var gb = (b.gate && isFinite(b.gate.gatesPassed)) ? b.gate.gatesPassed : -1;
        return gb - ga;
      });
    }
    /* a direction-less row cannot mint levels, so the mixed column prints a
       compact honest row instead of a setup card */
    function mixedRow(r){
      try{
        if (r.unread) return '<div class="card" style="padding:8px;margin-bottom:6px"><b>' + escH(r.sym) + '</b>' + tmVenueChip(r)
          + '<div style="opacity:.75;font-size:11px;margin-top:2px">UNREAD · CoinDCX contract with no candle series · not a setup</div></div>';
        return '<div class="card" style="padding:8px;margin-bottom:6px"><b>' + escH(r.sym) + '</b>' + tmVenueChip(r)
          + '<div style="opacity:.75;font-size:11px;margin-top:2px">composite ' + (r.score > 0 ? '+' : '') + r.score + '/5 · no majority — no levels minted · ADX '
          + (isFinite(r.adx) ? (+r.adx).toFixed(1) : '—') + '</div></div>';
      }catch(e){ return ''; }
    }
    function col(title, cls, titleCls, list, emptyTxt){
      var h = '<div class="panel tm-col" style="border-top:3px solid ' + cls + '"><h3 style="margin:0 0 8px">'
        + '<span class="' + titleCls + '">' + title + '</span> <span style="opacity:.6;font-weight:400">· ' + list.length + ' row' + (list.length === 1 ? '' : 's') + '</span></h3>';
      if (!list.length) h += '<div class="empty" style="margin:6px 0">' + emptyTxt + '</div>';
      else h += list.map(function(rr){
        var dd = tmDirOf(rr);
        if (!dd) return mixedRow(rr);
        var plan = dd ? trendmxPlan(Object.assign({}, rr, { dir: dd })) : null;
        var tier = trendmxRowTier(rr, plan);
        return trendmxSetupCardHTML(rr, tier === 'clean' ? 'clean' : 'near');
      }).join('');
      return h + '</div>';
    }
    var bullS = byStrength(bull), bearS = byStrength(bear), mixedS = byStrength(mixed);
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;align-items:start">'
      + col('BULL', '#26a69a', 'pos', bullS, 'no bullish rows — composite below +2')
      + col('BEAR', '#ef5350', 'neg', bearS, 'no bearish rows — composite above -2')
