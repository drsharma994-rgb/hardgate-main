        + ' (Granville: volume must confirm). Held off the LIMIT BOARD, never CLEAN — the row paints, the reason is named.') + '">VOLUME TREND AGAINST · HELD OFF</span>';
    }
    return '<span class="stamp pass" style="margin-left:6px" title="' + escH('trendmx volume witness (hg-v1020): price and OBV made the new 20-bar extreme together — the 1D volume trend confirms this ' + dir
      + '. Evidence, never a composite point.') + '">VOLUME TREND WITH IT</span>';
  }catch(e){ return ''; }
}

/* the witness's chip — reads the row's rsi stamp exactly like the flow chip
   reads the flow stamp (hg-v1012). AGAINST rows name the hold-off on the
   card (nothing is dropped silently); WITH rows carry the pass chip; FLAT
   and unread rows paint NO chip — the abstain states stay silent. */
function trendmxMomChipHtml(r){
  try{
    var dir = tmDirOf(r);
    var st = trendmxMomState(r, dir);
    if (!st || st === 'flat') return '';
    var rv = isFinite(r.rsi) ? r.rsi.toFixed(1) : '?';
    if (st === 'against'){
      return '<span class="stamp bad" style="margin-left:6px" title="' + escH('trendmx momentum witness (hg-v1019): 1D RSI(14) ' + rv
        + (dir === 'long' ? ' has broken under the bull-range floor ' + TM_MOM_BULL_FLOOR : ' has broken over the bear-range ceiling ' + TM_MOM_BEAR_CEIL)
        + ' — the slow composite is fighting a turned momentum regime. Held off the LIMIT BOARD, never CLEAN — the row paints, the reason is named.') + '">MOMENTUM AGAINST · HELD OFF</span>';
    }
    return '<span class="stamp pass" style="margin-left:6px" title="' + escH('trendmx momentum witness (hg-v1019): 1D RSI(14) ' + rv
      + ' sits on the regime side of the ' + TM_MOM_MID + ' midline for this ' + dir
      + '. Evidence, never a composite point.') + '">MOMENTUM WITH IT</span>';
  }catch(e){ return ''; }
}

/* hg-v1018: ONE collection of the limit board's two formation CLASSES.
   The old board walked the rows once, ranked gate-clean and conviction
   rows against each other in one mixed bag (the clean7 1000-bonus made
   the ordering a class ordering, not a quality one) and recorded them
   under two mechanics while painting one panel. The classes are
   collected separately here and painted on their own desks; the bars
   themselves — gate veto, majority, valid plan, clean7-or-conviction,
   the hg-v1012 flow hold-off — are exactly the old board's, per row. */
function trendmxLimitClasses(rows){
  /* hg-v1019: heldClean/heldConv stay the TOTALS the v1018 desks published;
     heldWhy splits the reasons so each desk's verdict names only the
     witnesses that actually fired (taker flow hg-v1012 · momentum hg-v1019
     · volume hg-v1020). */
  var out = { clean: [], conv: [], heldClean: 0, heldConv: 0,
              heldWhy: { clean: { flow: 0, mom: 0, vol: 0, fund: 0 }, conv: { flow: 0, mom: 0, vol: 0, fund: 0 } } };
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.gate || r.gate.veto) continue;
    var dir = tmDirOf(r);
    if (!dir) continue;
    var isClean = !!r.gate.clean7;
    var conv = isClean ? null : trendmxConviction(r);
    if (!isClean && !conv) continue;
    /* hg-v1012: flow-AGAINST rows are held off the desks. The row still
       paints in the matrix with its chip — nothing is dropped silently —
       but the desks and the record below are what the desk judged
       tradeable WITH the evidence in hand, and a swing minted against the
       real aggressor flow is not it. hg-v1018: counted per class, so each
       desk names its own held-off rows. */
    if (r.flow && r.flow.verdict === 'against'){
      if (isClean){ out.heldClean++; out.heldWhy.clean.flow++; }
      else { out.heldConv++; out.heldWhy.conv.flow++; }
      continue;
    }
    /* hg-v1019: THE MOMENTUM WITNESS hold-off — the same mechanic one leg
       down. A row whose 1D RSI range has TURNED against its own majority
       (long under the 40 bull floor, short over the 60 bear ceiling) is a
       slow composite fighting a turned regime: held off the desks, counted
       and named per class, still painting in the matrix with its chip.
       WITH and FLAT and UNREAD rows pass — the witness only ever removes. */
    if (trendmxMomState(r, dir) === 'against'){
      if (isClean){ out.heldClean++; out.heldWhy.clean.mom++; }
      else { out.heldConv++; out.heldWhy.conv.mom++; }
      continue;
    }
    /* hg-v1020: THE VOLUME WITNESS hold-off — the same mechanic, the third
       witness. A row whose swing volume trend DIVERGES against its own
       majority (distribution under the rally / accumulation under the
       fall) is held off, counted and named per class, still painting with
       its chip. WITH, FLAT and UNREAD pass — it only ever removes. */
    if (trendmxVolState(r, dir) === 'against'){
      if (isClean){ out.heldClean++; out.heldWhy.clean.vol++; }
      else { out.heldConv++; out.heldWhy.conv.vol++; }
      continue;
    }
    /* hg-v1034: THE FUNDAMENTAL + SENTIMENT WITNESS hold-off — the fourth
       witness, the ONLY one that reads off-chart evidence (on-chain, the
       coin's own term curve, F&G, options positioning, the calendar). A
       red-folder blackout REFUSES and a 2+ net checked headwind DEMOTES:
       held off both class desks, counted per class under the fund reason,
       still painting with its chip. WITH, FLAT and a dark board pass — it
       only ever removes, and one witness never flips. */
    var fundSt = trendmxFundState(r, dir);
    if (fundSt === 'refuse' || fundSt === 'against'){
      if (isClean){ out.heldClean++; out.heldWhy.clean.fund++; }
      else { out.heldConv++; out.heldWhy.conv.fund++; }
      continue;
    }
    var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
    if (!tmValidSetup(plan)) continue;
    var item = { row: r, plan: plan, dir: dir, stack: trendmxCardStack(r, dir) };
    if (isClean){
      /* the old board's intra-class rank, unchanged: composite, then gates */
      item.rank = Math.abs(r.score) * 10 + (r.gate.gatesPassed || 0);
      out.clean.push(item);
    } else {
      /* the conviction class orders on its OWN claim: trend strength.
         Composite first, the ADX strength indicator breaking ties (a ±4 at
         ADX 38 is a stronger trend than a ±4 at 25); the gate count is the
         other class's evidence and does not order this desk. */
      item.rank = Math.abs(r.score) * 10 + (fin(r.adx) ? r.adx / 10 : 0);
      item.conv = conv;
      out.conv.push(item);
    }
  }
  out.clean.sort(function(a, b){ return b.rank - a.rank; });
  out.conv.sort(function(a, b){ return b.rank - a.rank; });
  /* FORWARD LOG — recorded over BOTH classes BEFORE either desk slices, so
     the measurement covers every setup the tab judged tradeable rather than
     only the four per desk it had room to show. The mechanic splits on
     clean7, which is the tab's own claim about quality: if the 7/7 rows
     resolve like the merely-convicted ones, that distinction is not doing
     work. Fields byte-identical to the mixed board's record. */
  var cands = out.clean.concat(out.conv);
  try {
    if (typeof W.hgFwdRecordScan === 'function' && cands.length){
      W.hgFwdRecordScan('TRENDMX', '4h', cands.map(function(c){
        return { sym: c.row && c.row.sym, dir: c.dir,
                 entry: c.plan && c.plan.entry, stop: c.plan && c.plan.stop, t1: c.plan && c.plan.t1,
                 /* hg-v981: the mark trendmxAttachMeta already kept, the bar off the row's series */
                 mark: (c.plan && isFinite(+c.plan.mark) && +c.plan.mark > 0) ? +c.plan.mark : undefined,
                 barT: (typeof W.hgFwdLastBar === 'function') ? W.hgFwdLastBar(c.row && c.row.rows4h).barT : undefined,
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
