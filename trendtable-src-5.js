    if (typeof hgFundamentalChipHtml === 'function') return hgFundamentalChipHtml(g) || '';
    return '';
  }catch(e){ return ''; }
}

/* hg-v1057: THE TREND-QUALITY WITNESS state — the matrix's own measure of
   whether the tape the row was scored on has a trend to ride AT ALL. Reads
   the row's own 4h series (never recomputes the composite); the two house
   trend-quality instruments, both from indicators.js:
     Choppiness Index (Dreiss, TASC 2009) — 0..100, >61.8 choppy, <38.2 trending
     Kaufman Efficiency Ratio — 0..1, ~1 clean directional tape, near 0 noise
     chop   — CHOP(14) >= 61.8 AND ER(20) < 0.3 TOGETHER: sideways noise.
       Caps the row at NEAR (never CLEAN) — the matrix is a TREND desk and
       this tape has no trend to ride.
     trend  — CHOP(14) <= 38.2 AND ER(20) > 0.4 TOGETHER: a clean directional
       tape (the FORMING board stamps it EARLY FORMING).
     null   — mixed or unreadable: NO verdict, holds nothing off (the hg-v700
       honest-degradation rule). The readable scalars still ride the object.
   The two instruments must AGREE: one saying chop and the other trend is a
   mixed tape, and a mixed tape is not a cap — fail open, evidence first. */
function trendmxChopState(r){
  var chop = null, er = null;
  if (!r || !Array.isArray(r.rows4h) || r.rows4h.length < 25
      || typeof hgChoppiness !== 'function' || typeof hgKaufmanER !== 'function'){
    return { chop: chop, er: er, state: null };
  }
  try{
    var ch = hgChoppiness(r.rows4h, 14);
    if (ch && ch.length){
      var lc = ch[ch.length - 1];
      if (isFinite(lc)) chop = lc;
    }
    var closes = r.rows4h.map(function(x){ return +x.c; });
    var erArr = hgKaufmanER(closes, 20);
    if (erArr && erArr.length){
      var le = erArr[erArr.length - 1];
      if (isFinite(le)) er = le;
    }
  }catch(e){ /* an unreadable tape is no verdict — the scalars stay null */ }
  var state = null;
  if (isFinite(chop) && isFinite(er)){
    if (chop >= 61.8 && er < 0.3) state = 'chop';
    else if (chop <= 38.2 && er > 0.4) state = 'trend';
  }
  return { chop: chop, er: er, state: state };
}

/* hg-v1057: the trend-quality chip — the momentum chip's own pattern.
   CHOP prints the bad stamp with BOTH measured values (a cap is never
   silent); TREND and mixed/unreadable paint NO chip (evidence, never a
   brag, and a mixed tape is not a verdict). */
function trendmxChopChipHtml(r){
  try{
    var st = trendmxChopState(r);
    if (!st || st.state !== 'chop') return '';
    var chopTxt = isFinite(st.chop) ? st.chop.toFixed(0) : '?';
    var erTxt = isFinite(st.er) ? st.er.toFixed(2) : '?';
    return '<span class="stamp bad" style="margin-left:6px" title="' + escH('trend-quality witness (hg-v1057): this 4h tape reads CHOP ' + chopTxt
      + ' and efficiency ratio ' + erTxt
      + ' — the trend matrix\'s own trend-quality measure says there is no trend to ride. Capped at NEAR, never CLEAN — evidence, never a gate.') + '">CHOP ' + chopTxt + ' · ER ' + erTxt + '</span>';
  }catch(e){ return ''; }
}

/* hg-v1022: THE PERFECT SETUP tier — the strictest confluence read the desk
   can honestly print. NOT a new composite leg and NOT a win guarantee (the
   forward ledger measures it like every other mechanic): it is a FILTER that
   asks every independent confirmation to say WITH and none to say AGAINST, on
   top of a 7/7 gate-clean row at maximum composite alignment. Criteria,
   stated plainly:
     |composite| = 5/5  (all five legs maxed the same way)
     7/7 swing-gate clean (spread · vol-Z · EMA21 anchor · funding · regime · structure · R:R)
     momentum witness WITH  (1D RSI on the regime side — not flat, not null)
     volume witness WITH     (1D OBV confirms the new extreme — not flat, not null)
     taker flow never AGAINST (WITH when readable; an unreadable flow never confirms but never disqualifies)
     funding not crowded      (not against the direction)
   Evidence-only: nothing here gates, moves a tier or drops a row — it only
   earns a desk and a read-mark. A row is PERFECT, not "guaranteed". */
function trendmxPerfectState(r){
  if (!r || !r.gate || !r.gate.clean7 || r.gate.veto) return false;
  if (typeof r.score !== 'number' || !isFinite(r.score)) return false;
  if (Math.abs(r.score) !== 5) return false;
  var dir = tmDirOf(r);
  if (!dir) return false;
  if (trendmxMomState(r, dir) !== 'with') return false;
  if (trendmxVolState(r, dir) !== 'with') return false;
  if (r.flow && r.flow.verdict === 'against') return false;
  /* hg-v1034: the fundamental + sentiment witness — a blackout (refuse) or a
     2+ net checked headwind (against) disqualifies PERFECT exactly like flow
     against. WITH chips; a dark or flat board never disqualifies. */
  var fundSt = trendmxFundState(r, dir);
  if (fundSt === 'refuse' || fundSt === 'against') return false;
  var fp = r.fundingPct;
  if (typeof fp === 'number' && isFinite(fp) && typeof W.hgFundingAgainstMark === 'function'){
    try{ var m = W.hgFundingAgainstMark(fp, dir); if (m && m.against === true) return false; }catch(e){}
  }
  return true;
}

/* hg-v1022: VOLATILITY REGIME — a new independent read the composite's five
   close-derived legs cannot see: WHERE the row's own ATR sits in ITS trailing
   distribution. hgAtrPercentile(4h,14,100) ranks the latest 4h ATR against
   its last 100 values: <20th percentile is DEAD TAPE (chop — trend legs drift
   but nothing trades), >80th is BLOWOFF (a move already spent), the middle
   is HEALTHY (a trend with room to run). Evidence-only — a chip on the card,
   never a gate, never a composite point: it informs and records, it never
   drops a row (the hg-v700 honest-degradation rule applies on unreadable). */
function trendmxAtrRegime(r){
  try{
    if (!r || !r.rows4h || !Array.isArray(r.rows4h) || r.rows4h.length < 30) return null;
    if (typeof hgAtrPercentile !== 'function') return null;
    var pct = hgAtrPercentile(r.rows4h, 14, 100);
    if (!isFinite(pct)) return null;
    if (pct < 20) return { pct: pct, regime: 'DEAD' };
    if (pct > 80) return { pct: pct, regime: 'BLOWOFF' };
    return { pct: pct, regime: 'HEALTHY' };
  }catch(e){ return null; }
}

/* the ATR-regime chip — the volume witness's own pattern (hg-v1020): DEAD and
   BLOWOFF name the danger; HEALTHY carries the pass chip; unreadable paints
   NO chip. Evidence, never a gate. */
function trendmxAtrRegimeChipHtml(r){
  try{
    var reg = trendmxAtrRegime(r);
    if (!reg) return '';
    if (reg.regime === 'DEAD'){
      return '<span class="stamp bad" style="margin-left:6px" title="' + escH('trendmx volatility regime (hg-v1022): 4h ATR(14) sits at the ' + reg.pct.toFixed(0) + 'th percentile of its own trailing distribution — bottom-quintile chop. The trend legs drift but nothing trades here. Evidence, never a gate.') + '">ATR REGIME DEAD</span>';
    }
    if (reg.regime === 'BLOWOFF'){
      return '<span class="stamp bad" style="margin-left:6px" title="' + escH('trendmx volatility regime (hg-v1022): 4h ATR(14) sits at the ' + reg.pct.toFixed(0) + 'th percentile — top-quintile blowoff, a move already spent. Evidence, never a gate.') + '">ATR REGIME BLOWOFF</span>';
    }
    return '<span class="stamp pass" style="margin-left:6px" title="' + escH('trendmx volatility regime (hg-v1022): 4h ATR(14) sits at the ' + reg.pct.toFixed(0) + 'th percentile — healthy volatility, a trend with room to run. Evidence, never a gate.') + '">ATR REGIME HEALTHY</span>';
  }catch(e){ return ''; }
}

/* the volume witness's chip — the momentum chip's own pattern (hg-v1019).
   AGAINST names the hold-off; WITH carries the pass chip; FLAT and unread
   paint NO chip. */
function trendmxVolChipHtml(r){
  try{
    var dir = tmDirOf(r);
    var st = trendmxVolState(r, dir);
    if (!st || st === 'flat') return '';
    if (st === 'against'){
      return '<span class="stamp bad" style="margin-left:6px" title="' + escH('trendmx volume witness (hg-v1020): the 1D OBV trend diverges against this ' + dir
        + ' — ' + (dir === 'long' ? 'price made a higher 20-bar high on a lower OBV high: distribution under the rally' : 'price made a lower 20-bar low on a higher OBV low: accumulation under the fall')
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
