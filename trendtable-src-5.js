="margin-left:6px">GATE-CLEAN 7/7</span>'
    : '<span class="stamp" style="margin-left:6px">CONVICTION ' + (r.score > 0 ? '+' : '') + r.score + '/5</span>';
  return '<div style="flex:1 1 260px;max-width:360px;border:1px solid #E2E8F0;border-left:3px solid ' + col + ';border-radius:8px;padding:10px 12px;background:#fff">'
    + '<div><b>' + escH(r.sym) + '</b>' + tmVenueChip(r) + ' · ' + dir.toUpperCase() + perfectStamp + clsStamp + stHtml + tmSmcChip(r)
    + trendmxFlowChipHtml(r)   /* hg-v1012: the flow verdict the scan stamped — reads the stamp, never recomputes */
    + trendmxMomChipHtml(r)    /* hg-v1019: the momentum witness's stamp — same read-the-stamp seam */
    + trendmxVolChipHtml(r)    /* hg-v1020: the volume witness's stamp — same seam */
    + trendmxFundingChipHtml(r)
    + trendmxAtrRegimeChipHtml(r) + '</div>'
    + '<div style="font-size:18px;font-weight:800;color:' + col + ';margin:4px 0">' + pxFmt(p.entry) + '</div>'
    + '<div class="note">' + trendmxPlanHTML(p) + '</div>'
    + (tradeOn ? '<button class="toTrade" onclick="' + tradeOn + '">SEND TO TRADE PLAN →</button>' : '')
    + '</div>';
}

/* hg-v1018: each desk caps at 4 cards — two desks x 4 = the old mixed
   board's 8. The split changes presentation, not exposure. */
var TM_LIMIT_DESK_CAP = 4;

/* hg-v1019: THE MOMENTUM WITNESS bands — the canonical RSI range read
   (Cardwell/Constance Brown): a bull momentum range holds RSI(14) above
   TM_MOM_BULL_FLOOR (the 40–50 pullback floor), a bear range caps it under
   TM_MOM_BEAR_CEIL. Stated PRIORS, not measurements — the forward log's
   momWith read-mark is how they earn a measured one. */
var TM_MOM_BULL_FLOOR = 40, TM_MOM_BEAR_CEIL = 60, TM_MOM_MID = 50;

/* trendmxMomState(row, dir) -> 'against' | 'with' | 'flat' | null.
   Pure read of the rsi stamp the scan put on the row (never recomputes):
     against — the momentum range has TURNED against the direction
       (long under the bull floor / short over the bear ceiling);
     with    — RSI on the regime side of the midline;
     flat    — the abstain zone: a pullback inside an INTACT regime, where
       momentum has nothing to add (no chip, no hold, no read);
     null    — no readable rsi: the witness cannot speak, and what cannot
       speak holds nothing off (the hg-v700 honest-degradation rule). */
function trendmxMomState(r, dir){
  var rv = (r && typeof r.rsi === 'number' && isFinite(r.rsi)) ? r.rsi : NaN;
  if (!isFinite(rv)) return null;
  if (dir === 'long'){
    if (rv < TM_MOM_BULL_FLOOR) return 'against';
    return rv >= TM_MOM_MID ? 'with' : 'flat';
  }
  if (dir === 'short'){
    if (rv > TM_MOM_BEAR_CEIL) return 'against';
    return rv <= TM_MOM_MID ? 'with' : 'flat';
  }
  return null;
}

/* hg-v1020: THE VOLUME WITNESS state — reads the row's volDiv/volConf
   stamps exactly like the momentum witness reads rsi (never recomputes):
     against — the swing volume trend DIVERGES against the direction
       (distribution under the rally for longs / accumulation under the
       fall for shorts);
     with    — price and OBV made the new 20-bar extreme TOGETHER;
     flat    — a readable tape with neither divergence nor confirmation:
       volume has nothing to add (no chip, no hold, no read);
     null    — the witness never ran or the tape cannot speak: holds
       nothing off (the hg-v700 rule). */
function trendmxVolState(r, dir){
  if (!r || (r.volDiv === undefined && r.volConf === undefined)) return null;
  if (r.volDiv === null && r.volConf === null) return null;
  if (dir === 'long'){
    if (r.volDiv === 'bear') return 'against';
    return r.volConf === 'up' ? 'with' : 'flat';
  }
  if (dir === 'short'){
    if (r.volDiv === 'bull') return 'against';
    return r.volConf === 'down' ? 'with' : 'flat';
  }
  return null;
}

/* hg-v1034: THE FUNDAMENTAL + SENTIMENT WITNESS — the composite reads closes,
   the momentum and volume witnesses read closes, the flow witness reads ONE
   venue's taker prints; until this pack NOTHING read what the market is
   POSITIONED to do and what the macro/sentiment says, on the row's own coin.
   This is the house fundamental stack (fundamental-stack.js hgFundamentalGate),
   shared with OmniBTC and the gold desks, read ONCE per row and memoized:
     BTC ..... ON-CHAIN (mempool.space, votes) + TERM (own curve, votes) +
               FEAR & GREED (contrarian 80/20, votes) + 25Δ RISK REVERSAL
               (Deribit, |8| extreme, votes) + EVENT RISK (red-folder blackout).
     ALTS .... F&G (market-wide, votes at extremes) + the coin's OWN TERM row
               (votes) + the coin's OWN calendar (blackout); BTC on-chain and
               the 25Δ RR render as prior INFO, never vote for an alt.
   The mechanic mirrors the flow/mom/vol witnesses (hg-v1012/1019/1020):
     - EVIDENCE ONLY — the composite stays five legs (a sixth would re-scale
       every tmScore the forward ledger measures).
     - refuse  (red-folder blackout) / against  (2+ net checked votes AGAINST
       the row's direction) hold the row off BOTH class desks and cap it at
       NEAR — counted per class in heldWhy (the fund reason). Still paints
       with its chip; nothing dropped silently. One witness never flips.
     - with    (2+ net checked votes WITH) chips TAILWIND and hands the
       ledger a fundWith read-mark — never a composite point.
     - flat / null  — a readable board with no decisive vote, or a dark
       board: silent, holds nothing off (the hg-v700 honest-degradation rule).
   The GOLDEN/DEATH cross desks stay out of scope (the fresh multi-week
   cross premise misjudges a momentary positioning/sentiment snap, the same
   reason flow and momentum stand down there). */
function trendmxFundGate(r, dir){
  if (!r) return null;
  dir = dir || tmDirOf(r);
  if (!dir) return null;
  var key = (dir === 'short') ? '_fundGateShort' : '_fundGate';
  if (r[key] !== undefined) return r[key];
  var g = null;
  if (typeof hgFundamentalGate === 'function'){
    try{ g = hgFundamentalGate(r.sym, dir, { scanner: 'trendmx' }); }catch(e){ g = null; }
  }
  r[key] = g || null;
  return g || null;
}
function trendmxFundState(r, dir){
  var g = trendmxFundGate(r, dir);
  if (!g) return null;
  if (g.refuse) return 'refuse';
  if (g.demote) return 'against';
  if (g.chips && g.chips.some(function(c){ return /TAILWIND/.test(c); })) return 'with';
  return (g.regime && g.regime.checked) ? 'flat' : null;
}

/* the fundamental + sentiment chip — the volume witness's own pattern
   (hg-v1020). It reuses the house renderer (hgFundamentalChipHtml) so the
   chip is byte-identical to the gold desk's and OmniBTC's; an absent stack
   or a dark board paints NO chip. */
function trendmxFundChipHtml(r){
  try{
    var g = trendmxFundGate(r);
    if (!g || !g.chips || !g.chips.length) return '';
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
    return '<span class="stamp pass" style="margin-lef