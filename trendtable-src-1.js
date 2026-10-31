         byte-identical, so every recorded tmScore stays on its own scale
         (the hg-v1012 rule). rsi missing -> NaN, and NaN holds nothing off
         (hg-v700 honest degradation). */
      if (typeof rsi === 'function'){
        var r1d = rsi(c1, 14);
        out.rsi = (r1d && r1d.length) ? r1d[r1d.length - 1] : NaN;
      }
      /* hg-v1020: THE VOLUME WITNESS rides the same 1D tape — OBV
         divergence as EVIDENCE, the momentum witness's own seam. Never a
         composite leg (the hg-v1012 rule); a tape that cannot speak stamps
         nulls, and nulls hold nothing off. */
      var vw1020 = tmVolWitness(rows1d);
      out.volDiv = vw1020.div;
      out.volConf = vw1020.conf;
      var trendSum = out.comps.d1Trend + out.comps.d1Cross +
                     out.comps.h4Cascade + out.comps.cloud;
      if (isFinite(out.adx) && out.adx >= 25) out.comps.adxPt = sgn(trendSum);
    }

    /* hg-v1398: adxPt stays inside this number so a recorded tmScore is
       still the same five-leg sum. It does not create the side. tmDirOf
       reads the four legs above, which can oppose each other. */
    out.score = out.comps.d1Trend + out.comps.d1Cross + out.comps.h4Cascade +
                out.comps.cloud + out.comps.adxPt;
  }catch(e){
    return zeroResult(); // never throw to UI
  }
  return out;
}

/* ---------------- hg-v1154: the free positioning feeds, through the rules that already read them ----------------
   SWING, whose 7/7 gates this desk borrows, has run every CLEAN hit through
   hgPostGateSetupVeto since hg-v197 -- flow trap (Binance taker ratio · depth
   imbalance · spot taker flow · Bybit positioning cross), BTC relative
   strength, stale momentum, regime overlay, on-chain alt gate, calibration --
   all public, free feeds the data layer already fetches and caches. And G4 on
   a contract whose venue reports no funding read nothing unless the ticker
   carried the Binance twin (hgEnrichTickerFundingTwin, hg-v197). This desk
   did neither, so a TM "7/7 CLEAN" was a weaker claim than SWING's under the
   same label. The hg-v1012 flow witness below reads the taker ratio on its
   own; the shared rule is the SWING policy in full and is called, not
   restated. A vetoed row is the FIFTH witness hold-off (counted and named per
   class like the other four), keeps its levels, moves to the watch tier (the
   shared card prints no handoff there), and -- unlike the other witnesses --
   is still RECORDED with ticket:false and reads['postgate:veto'] = true, so
   the ledger can ask whether the veto separates on this desk; a passed row
   records false; unchecked or un-run records nothing. Runs only on rows with
   a gate hit. With the shared rule absent the board reads as before. */
function tmGetCandlesFn(){
  if (typeof W.getCandles === 'function') return function(sym, tf, n){ return W.getCandles(sym, tf, n); };
  if (typeof W.binanceKlines === 'function') return function(sym, tf, n){ return W.binanceKlines(sym, tf, n); };
  return null;
}
async function tmEnrichFunding(row){
  var ticker = trendmxTicker(row);
  if (typeof W.hgEnrichTickerFundingTwin !== 'function') return ticker;
  try{
    var t2 = await W.hgEnrichTickerFundingTwin(ticker);
    if (t2 && typeof t2.fundingPct === 'number' && isFinite(t2.fundingPct)){
      row.fundingPct = t2.fundingPct;
      if (t2.fundingTwin) row.fundingTwin = t2.fundingTwin;
    }
  }catch(e){}
  return trendmxTicker(row);
}
function tmPostGateRead(qv){
  if (!qv || typeof qv !== 'object') return undefined;
  if (qv.ok === false){
    return { state: 'veto', reason: qv.reason || 'post-gate veto', tag: qv.tag || null, flowDetail: qv.flowDetail || null };
  }
  if (qv.unchecked === true){
    return { state: 'unchecked', reasons: Array.isArray(qv.uncheckedReasons) ? qv.uncheckedReasons.slice() : [], flowDetail: qv.flowDetail || null };
  }
  return { state: 'pass', flowDetail: qv.flowDetail || null, rsEdge: (typeof qv.rsEdge === 'number' && isFinite(qv.rsEdge)) ? qv.rsEdge : null };
}
async function tmFeedRow(row, dir, rows4h){
  var ticker = await tmEnrichFunding(row);
  row.gate = trendmxGateEval(row, dir);
  if (!row.gate || !row.gate.hit || typeof W.hgPostGateSetupVeto !== 'function') return;
  try{
    var qv = await W.hgPostGateSetupVeto(ticker, row.gate.hit, rows4h, 'swing', tmGetCandlesFn());
    row.postGate = tmPostGateRead(qv);
    if (qv && qv.ok && typeof W.hgApplyCryptoPostGate === 'function') W.hgApplyCryptoPostGate(row.gate.hit, qv);
  }catch(e){
    row.postGate = { state: 'unchecked', reasons: ['post-gate threw: ' + ((e && e.message) || e)], flowDetail: null };
  }
}
function tmPostGateVeto(r){ return !!(r && r.postGate && r.postGate.state === 'veto'); }

/* hg-v1159: THE WITNESSES AND THE LEGS, RECORDED AS THREE-STATE MARKS.
   Four witnesses have held rows off the class desks since hg-v1012 / v1019 /
   v1020 / v1034 and the record map only ever saw the rows they let through,
   marked `true` — so the ledger could compare WITH against SILENT and never
   against AGAINST, and what the hold-offs remove was unmeasurable by
   construction (the hg-v966 trap, four times). The composite rode every
   record as one number (tmScore, hg-v995) and never as its five legs. This
   is the one home for the reads bag both record sites hand the ledger:
     takerFlowWith · momWith · volWith · fundWith · trendQualityWith
        true  = the witness backed the row (WITH / TREND)
        false = it stood against (AGAINST · REFUSE · CHOP)
        absent = it abstained or could not read (FLAT / UNREAD — never a
                 guessed false, hg-v989's third state)
     tm:d1Trend · tm:cross · tm:cascade · tm:cloud · tm:adx
        each leg of trendScore's composite, true when its sign is the row's
        direction, false when it opposes, absent at zero
     tm:adxStrong — the ADX >= 25 strength bar itself, true / false / absent
     tm:freshCross — a GOLDEN / DEATH cross inside 10 bars, true with the
        row's direction, false against, absent when none
     postgate:veto — the hg-v1154 SWING post-gate verdict, unchanged
   Marks only: nothing here moves a tier, a plan or a desk. The ledger's read
   split asks, out of sample, which of them separates. */
function tmLegReads(r, dir){
  var out = {};
  if (!r || (dir !== 'long' && dir !== 'short')) return out;
  var sgn = (dir === 'long') ? 1 : -1;
  var c = (r.comps && typeof r.comps === 'object') ? r.comps : null;
  function leg(key, v){
    if (typeof v !== 'number' || !isFinite(v) || v === 0) return;
    out[key] = (v * sgn) > 0;
  }
  if (c){
    leg('tm:d1Trend', c.d1Trend); leg('tm:cross', c.d1Cross); leg('tm:cascade', c.h4Cascade);
    leg('tm:cloud', c.cloud); leg('tm:adx', c.adxPt);
  }
  if (typeof r.adx === 'number' && isFinite(r.adx)) out['tm:adxStrong'] = r.adx >= 25;
  if (r.freshCross === 'GOLDEN') out['tm:freshCross'] = (dir === 'long');
  else if (r.freshCross === 'DEATH') out['tm:freshCross'] = (dir === 'short');
  return out;
}
/* hg-v1336: CANDLESTICK PATTERN RECOGNITION on the 4h tape, as RECORD-ONLY
   THREE-STATE READS. The function reads window.hgCfCandlePatterns — the ONE
   HOME (hg-v949) in goldind.js that gold's candle forecast tab already uses
   — on this row's own 4h series, over the last three closed bars with the
   ATR of the series as the pattern-size gate. The engine fires on hammer /
   shooting star / dragonfly / gravestone doji / marubozu / engulfing /
   piercing / dark cloud / morning star / evening star / three white
   soldiers / three black crows / tweezers / three inside / rising three
   methods / falling three methods — 46 patterns since hg-v1316, each
   ATR-gated so a dust bar is never a hammer and a monster bar is never a
   doji. The RECORD BAG returned here is:
     pattern:bullMajority — true when bullVotes > bearVotes
     pattern:bearMajority — true when bearVotes > bullVotes
       (so the two keys agree with each other by construction: if one is
       true, the other must be false; a tie or no fire leaves BOTH absent)
     pattern:withTrend    — true when the pattern majority agrees with
                           tmDirOf(r), false when it fights, absent when
                           the row has no direction or no majority
     pattern:anyFire      — true when at least one pattern voted on either
                           side, absent when nothing fired (so the ledger
                           can split 'tape printed a pattern' vs 'quiet
                           bar')
   The pattern engine's longStop/shortStop and the raw name list ride on the
   row (r.candleReads) so the card renderer can name the pattern that fired
   without re-running the engine. Marks only: hg-v966 refuses an unmeasured
   gate on this desk (hg-v987/v945/v922 measured the additive well dry), so
   nothing here moves a tier, a plan or a desk — the ledger's read split
   asks, out of sample, which of them separates. hg-v989 three-state: a
   missing engine, a tape under six bars, an unreadable ATR all record
   NOTHING, never a guessed false. */
function tmCandleRead(rows){
  try {
    if (!Array.isArray(rows) || rows.length < 6) return null;
    if (typeof W.hgCfCandlePatterns !== 'function') return null;
    if (typeof atr !== 'function') return null;
    var atrSeries = atr(rows, 14);
    if (!Array.isArray(atrSeries) || !atrSeries.length) return null;
    var atrLast = atrSeries[atrSeries.length - 1];
    if (!(typeof atrLast === 'number' && isFinite(atrLast) && atrLast > 0)) return null;
    var pat = W.hgCfCandlePatterns(rows, atrLast);
    if (!pat || typeof pat !== 'object') return null;
    return pat;
  } catch (ePat) { return null; }
}
function tmCandleMarks(r, dir){
  var out = {};
  if (!r) return out;
  var pat = r.candleReads;
  if (!pat || typeof pat !== 'object') return out;
  var bv = (typeof pat.bullVotes === 'number' && isFinite(pat.bullVotes)) ? pat.bullVotes : 0;
  var ev = (typeof pat.bearVotes === 'number' && isFinite(pat.bearVotes)) ? pat.bearVotes : 0;
  if (bv > 0 || ev > 0) out['pattern:anyFire'] = true;
  if (bv > ev) { out['pattern:bullMajority'] = true; out['pattern:bearMajority'] = false; }
  else if (ev > bv) { out['pattern:bullMajority'] = false; out['pattern:bearMajority'] = true; }
  if (dir === 'long' || dir === 'short'){
    if (bv > ev) out['pattern:withTrend'] = (dir === 'long');
    else if (ev > bv) out['pattern:withTrend'] = (dir === 'short');
    /* a tie or no fire records NOTHING on withTrend (hg-v989: absent is
       absent, never a guessed false — the ledger must be able to split
       the three states) */
  }
  return out;
}
function tmRecordReads(r, dir){
  var rd = {};
  if (!r) return undefined;
  dir = dir || tmDirOf(r);
  if (r.flow && r.flow.verdict === 'with') rd.takerFlowWith = true;
  else if (r.flow && r.flow.verdict === 'against') rd.takerFlowWith = false;
  var ms = trendmxMomState(r, dir);
  if (ms === 'with') rd.momWith = true; else if (ms === 'against') rd.momWith = false;
  var vs = trendmxVolState(r, dir);
  if (vs === 'with') rd.volWith = true; else if (vs === 'against') rd.volWith = false;
  var fs = trendmxFundState(r, dir);
  if (fs === 'with') rd.fundWith = true; else if (fs === 'against' || fs === 'refuse') rd.fundWith = false;
  var cs = trendmxChopState(r);
  if (cs && cs.state === 'trend') rd.trendQualityWith = true; else if (cs && cs.state === 'chop') rd.trendQualityWith = false;
  var pgr = tmPostGateReads(r);
  if (pgr) rd['postgate:veto'] = pgr['postgate:veto'];
  var legs = tmLegReads(r, dir), k;
  for (k in legs){ if (Object.prototype.hasOwnProperty.call(legs, k)) rd[k] = legs[k]; }
  /* hg-v1237: the crypto Pine marks ride the reads seam as booleans */
  var pm = r.pineMarks;
  if (pm){
    if (pm.lor) rd['pine:lorKnnWith'] = pm.lor === dir;
    if (pm.ht) rd['pine:halftrendWith'] = pm.ht === dir;
    if (pm.sqz) rd['pine:squeezeWith'] = pm.sqz === dir;
    if (pm.smf) rd['pine:smfWith'] = pm.smf === dir;
    if (pm.msb) rd['pine:msbWith'] = pm.msb === dir;
    if (pm.cipher) rd['pine:cipherWith'] = pm.cipher === dir;
    if (pm.rfilter) rd['pine:rangefilterWith'] = pm.rfilter === dir;
    if (pm.nwenv) rd['pine:nwenvelopeWith'] = pm.nwenv === dir;
    if (pm.wavwap) rd['pine:wavwapWith'] = pm.wavwap === dir;
    if (pm.smc) rd['pine:smcWith'] = pm.smc === dir;
  }
  /* hg-v1336: fold the three-state candlestick-pattern marks in. The engine
     is the one home in goldind.js (hgCfCandlePatterns); the pattern read is
     stamped on the row at scan time (r.candleReads) so the ledger reads
     exactly what the card paints. The ledger's read split then asks whether
     a bull-majority bar or a with-trend-pattern bar separates winners, out
     of sample — the one route this desk has to turning a pattern read into
     a measurement rather than a claim. */
  var cm = tmCandleMarks(r, dir), ck;
  for (ck in cm){ if (Object.prototype.hasOwnProperty.call(cm, ck)) rd[ck] = cm[ck]; }
  return Object.keys(rd).length ? rd : undefined;
}
/* hg-v1159: the TICKET claim on a record is the board's own CLEAN tier — the
   one rule (trendmxRowTier) that already caps a row at NEAR under every
   witness and the post-gate veto. The crown recorder (hg-v1039) claimed
   ticket:true on every 7/7 row the board itself showed as NEAR; both sites
   read this now. hg-v1399: the ticket ALSO clears the admission floor — a
   7/7 clean on a sub-2% stop or a fresh-cross/cloud-against read is not a
   ticket the desk would mint on its own boards. */
function tmTicketClaim(r, plan){
  return trendmxRowTier(r, plan) === 'clean' && tmAdmissionFloor(r, plan).ok;
}
/* hg-v1399: THE ADMISSION FLOOR — the measured expectancy bar every admission
   seam now shares. Read off the hg-v1160 replay walk (n=1953 settled, both
   halves of the median-tISO split agree): the cohorts these four clauses
   veto resolved −0.19…−0.25R in BOTH halves while the kept cohort improved
   in both (combo B: avg −0.0473R → +0.038R, ~36.5% of admissions filtered;
   an expectancy filter, win rate flat by design). The four clauses:
     ① stopPct ≥ 2% of entry — the plan-geometry floor; a tighter stop is a
       noise-catcher. FAILS OPEN when the plan never priced (no plan, no
       entry/stop): a mark that never spoke vetoes nothing.
     ② reads['tm:freshCross'] !== true — a fresh GOLDEN/DEATH cross riding
       WITH the majority measured toxic both halves (direction-agnostic).
     ③ reads['tm:cloud'] !== false — the 1D Ichimoku cloud AGAINST the
       majority was the worst cluster on the tape.
     ④ the 1D EMA(150) regime bar (hg-v1419) — price on the wrong side of
       the 150-day EMA for the row's own majority measured toxic in BOTH
       halves on the same replay (dropped n=37 at −0.166R standalone, n=27
       at −0.215R on the floor-kept book, H1 −0.560 / H2 −0.117; every
       flagged row had the EMA200 leg WITH it, so this read is not the
       composite restated). FAILS OPEN when the row carries no 1d series,
       fewer than 150 closes, or no finite EMA (hg-v989) — a fresh listing
       under 150 daily bars is vetoed by nothing here.
     ⑤ |composite| = 2 (a bare 2-of-4 majority) admits only with
       gatesPassed ≥ 3 standing behind it; |≥3| rows are unaffected.
   ②③ read the hg-v1159 leg marks through tmLegReads and FAIL OPEN on the
   hg-v989 third state: a live row whose reads bag carries no fresh-cross or
   cloud mark yet is NOT vetoed by that clause — absent is absent, never a
   guessed false. Nothing here re-weights the composite, moves a majority
   bar or touches the conviction 2/4 bars; it is a veto at the admission
   seams only (trendmxLimitClasses, tmTicketClaim, trendmxPerfectState),
   and every vetoed row stays visible and is recorded ticket:false — the
   desk shows its vetoes (the hg-v1159 measurability rule). */
function tmAdmissionFloor(r, plan){
  var why = [];
  if (!r) return { ok: false, why: ['noRow'] };
  var dir = tmDirOf(r);
  /* ① the stop-geometry floor — fail-open when no priced stop is in hand */
  var pe = plan ? +plan.entry : NaN, ps = plan ? +plan.stop : NaN;
  if (isFinite(pe) && pe > 0 && isFinite(ps) && ps > 0){
    if (Math.abs(pe - ps) / pe * 100 < 2) why.push('stop<2%');
  }
  /* ②③ the fresh-cross / cloud leg marks — fail-open on the absent third state */
  var legs = tmLegReads(r, dir);
  if (legs['tm:freshCross'] === true) why.push('freshCross');
  if (legs['tm:cloud'] === false) why.push('cloudAgainst');
  /* ④ the 1D EMA(150) regime bar (hg-v1419) — fail-open when the row carries
     no readable 1d series or no finite EMA: absent is absent, never a guess */
  if (dir && Array.isArray(r.rows1d) && r.rows1d.length >= 150 && typeof ema === 'function'){
    try{
      var c1 = r.rows1d.map(function(x){ return +(x && x.c); });
      var e150 = ema(c1, 150)[c1.length - 1], px1 = c1[c1.length - 1];
      if (isFinite(e150) && isFinite(px1)
          && ((dir === 'long' && px1 < e150) || (dir === 'short' && px1 > e150))) why.push('ema150Against');
    }catch(e){ /* an unreadable tape abstains — the clause vetoes nothing it cannot read */ }
  }
  /* ⑤ the bare-majority floor — a |2| composite needs 3 gates with it */
  var sc = Math.abs(+r.score);
  var gp = (r.gate && isFinite(+r.gate.gatesPassed)) ? +r.gate.gatesPassed : 0;
  if (!(sc >= 3) && gp < 3) why.push('bare|2|<3gates');
  return { ok: why.length === 0, why: why };
}
/* hg-v1160: WHICH READS SEPARATE, ON THIS DESK'S OWN REPLAY. HG_TM_FACTOR_SEP
   is written by scripts/trendmx-factor-separation.mjs off the walk that
   scripts/backtest-trendmx.mjs leaves (the hg-v921 rule: a generated thing
   writes itself) -- the same walk-then-judge shape OMNIROUTE (hg-v987) and
   OMNIPRESENT (hg-v988) carry, on the reads this desk has recorded since
   hg-v1159. Rendered through OMNIROUTE's one renderer (hgOmniFactorSepHtml)
   so there is one panel for three desks. While the walk has not run the
   literal reads measured:false and the panel SAYS so in place of a table,
   because an empty table is not a clean bill (hg-v955); three reads are
   forward-only (no bar archive carries them) and are named as such. Nothing
   here gates anything: the literal is read by tmFactorSepHtml and by nothing
   else. */
/* --- BEGIN GENERATED HG_TM_FACTOR_SEP (scripts/trendmx-factor-separation.mjs) ---
     Re-derive with `node scripts/trendmx-factor-separation.mjs --write`. Do not
     hand-edit — generated literals write themselves (hg-v921). Every figure is
     read off backtest-trendmx-results.json; the guard re-runs the generator and fails on drift. */
  var HG_TM_FACTOR_SEP = {
    artifact: "backtest-trendmx-results.json", n: 1952, windows: 4, minSide: 20,
    span: ["2025-11-20","2026-10-16"],
    measured: true,
    tab: "TRENDMX",
    forwardOnly: ["takerFlowWith","fundWith","postgate:veto"],
    reads: ["momWith","tm:adx","tm:adxStrong","tm:cascade","tm:cloud","tm:cross","tm:d1Trend","tm:freshCross","trendQualityWith","volWith"],
    bound: "stop-first on a both-touch bar (the lower bound, hg-v918): 13 of 1952 settled rows touched both levels on one 4h bar; the other bound is not read here",
    note: null,
    verdicts: [],
    leans: ["geom:stopGe2"],
    inSampleVerdicts: [],
    rows: [
      { f: "pop:clean7", g: "population", n: 0, win: null, gross: null, net: null, outWin: 0.265, outNet: -0.047, q: "0/0/0", verdict: null, thin: 4, degenerate: true },
      { f: "pop:ticket", g: "population", n: 0, win: null, gross: null, net: null, outWin: 0.265, outNet: -0.047, q: "0/0/0", verdict: null, thin: 4, degenerate: true },
      { f: "pop:held", g: "population", n: 254, win: 0.28, gross: 0.015, net: -0.035, outWin: 0.263, outNet: -0.049, q: "3/3/3", verdict: null },
      { f: "pop:perfect", g: "population", n: 0, win: null, gross: null, net: null, outWin: 0.265, outNet: -0.047, q: "0/0/0", verdict: null, thin: 4, degenerate: true },
      { f: "pop:score5", g: "population", n: 506, win: 0.281, gross: 0.038, net: 0, outWin: 0.26, outNet: -0.063, q: "3/3/2", verdict: null },
      { f: "pop:gates6", g: "population", n: 0, win: null, gross: null, net: null, outWin: 0.265, outNet: -0.047, q: "0/0/0", verdict: null, thin: 4, degenerate: true },
      { f: "pop:long", g: "population", n: 346, win: 0.251, gross: -0.081, net: -0.14, outWin: 0.268, outNet: -0.027, q: "2/2/2", verdict: null, thin: 1 },
      { f: "pop:strong", g: "population", n: 1145, win: 0.276, gross: -0.001, net: -0.026, outWin: 0.25, outNet: -0.076, q: "3/3/3", verdict: null },
      { f: "read:momWith=with", g: "read", n: 1727, win: 0.272, gross: -0.017, net: -0.055, outWin: 0.218, outNet: 0.015, q: "4/3/2", verdict: null },
      { f: "read:momWith=against", g: "read", n: 0, win: null, gross: null, net: null, outWin: 0.265, outNet: -0.047, q: "0/0/0", verdict: null, thin: 4, degenerate: true },
      { f: "read:tm:adx=with", g: "read", n: 1187, win: 0.275, gross: 0.007, net: -0.029, outWin: 0.25, outNet: -0.074, q: "3/4/3", verdict: null },
      { f: "read:tm:adx=against", g: "read", n: 0, win: null, gross: null, net: null, outWin: 0.265, outNet: -0.047, q: "0/0/0", verdict: null, thin: 4, degenerate: true },
      { f: "read:tm:adxStrong=with", g: "read", n: 1187, win: 0.275, gross: 0.007, net: -0.029, outWin: 0.25, outNet: -0.074, q: "3/4/3", verdict: null },
      { f: "read:tm:adxStrong=against", g: "read", n: 765, win: 0.25, gross: -0.068, net: -0.074, outWin: 0.275, outNet: -0.029, q: "1/0/1", verdict: null },
      { f: "read:tm:cascade=with", g: "read", n: 1105, win: 0.256, gross: -0.033, net: -0.046, outWin: 0.277, outNet: -0.047, q: "1/2/2", verdict: null },
      { f: "read:tm:cascade=against", g: "read", n: 191, win: 0.241, gross: -0.146, net: -0.226, outWin: 0.268, outNet: -0.027, q: "2/2/2", verdict: null },
      { f: "read:tm:cloud=with", g: "read", n: 1603, win: 0.274, gross: -0.011, net: -0.047, outWin: 0.223, outNet: -0.044, q: "3/2/2", verdict: null },
      { f: "read:tm:cloud=against", g: "read", n: 37, win: 0.135, gross: -0.403, net: -0.394, outWin: 0.268, outNet: -0.04, q: "0/0/0", verdict: null, thin: 4 },
      { f: "read:tm:cross=with", g: "read", n: 1795, win: 0.265, gross: -0.026, net: -0.049, outWin: 0.268, outNet: -0.017, q: "1/1/1", verdict: null, thin: 2 },
      { f: "read:tm:cross=against", g: "read", n: 157, win: 0.268, gross: 0.019, net: -0.017, outWin: 0.265, outNet: -0.049, q: "1/1/1", verdict: null, thin: 2 },
      { f: "read:tm:d1Trend=with", g: "read", n: 1952, win: 0.265, gross: -0.022, net: -0.047, outWin: null, outNet: null, q: "0/0/0", verdict: null, thin: 4, degenerate: true },
      { f: "read:tm:d1Trend=against", g: "read", n: 0, win: null, gross: null, net: null, outWin: 0.265, outNet: -0.047, q: "0/0/0", verdict: null, thin: 4, degenerate: true },
      { f: "read:tm:freshCross=with", g: "read", n: 88, win: 0.205, gross: -0.205, net: -0.249, outWin: 0.268, outNet: -0.037, q: "0/0/0", verdict: null, thin: 2 },
      { f: "read:tm:freshCross=against", g: "read", n: 0, win: null, gross: null, net: null, outWin: 0.265, outNet: -0.047, q: "0/0/0", verdict: null, thin: 4, degenerate: true },
      { f: "read:trendQualityWith=with", g: "read", n: 212, win: 0.311, gross: 0.076, net: 0.055, outWin: 0.26, outNet: -0.059, q: "3/3/3", verdict: null },
      { f: "read:trendQualityWith=against", g: "read", n: 103, win: 0.262, gross: 0.037, net: -0.004, outWin: 0.266, outNet: -0.049, q: "1/2/3", verdict: null },
      { f: "read:volWith=with", g: "read", n: 1146, win: 0.277, gross: 0.012, net: -0.015, outWin: 0.249, outNet: -0.092, q: "3/3/3", verdict: null },
      { f: "read:volWith=against", g: "read", n: 155, win: 0.297, gross: 0.019, net: -0.037, outWin: 0.263, outNet: -0.048, q: "3/3/3", verdict: null },
      { f: "geom:limit", g: "geometry", n: 34, win: 0.176, gross: -0.206, net: -0.275, outWin: 0.267, outNet: -0.043, q: "0/0/0", verdict: null, thin: 4 },
      { f: "geom:stopLt1", g: "geometry", n: 149, win: 0.336, gross: 0.014, net: -0.256, outWin: 0.26, outNet: -0.03, q: "3/2/1", verdict: null },
      { f: "geom:stopGe2", g: "geometry", n: 1431, win: 0.257, gross: 0.004, net: 0.028, outWin: 0.288, outNet: -0.254, q: "2/2/4", verdict: null, lean: "better" },
      { f: "geom:bothTouch", g: "geometry", n: 13, win: 0, gross: -1, net: -1.226, outWin: 0.267, outNet: -0.039, q: "0/0/0", verdict: null, thin: 4 },
      { f: "session:ASIA 00-08", g: "session", n: 683, win: 0.25, gross: -0.035, net: -0.037, outWin: 0.273, outNet: -0.052, q: "1/3/3", verdict: null },
      { f: "session:LONDON 08-13", g: "session", n: 500, win: 0.264, gross: -0.046, net: -0.08, outWin: 0.266, outNet: -0.035, q: "3/2/2", verdict: null },
      { f: "session:OVERLAP 13-17", g: "session", n: 461, win: 0.295, gross: 0.048, net: 0.01, outWin: 0.256, outNet: -0.064, q: "3/2/2", verdict: null },
      { f: "session:NY PM 17-21", g: "session", n: 308, win: 0.256, gross: -0.061, net: -0.1, outWin: 0.267, outNet: -0.037, q: "2/2/2", verdict: null },
      { f: "session:LATE 21-24", g: "session", n: 0, win: null, gross: null, net: null, outWin: 0.265, outNet: -0.047, q: "0/0/0", verdict: null, thin: 4, degenerate: true }
    ]
  };
  /* --- END GENERATED HG_TM_FACTOR_SEP --- */
function tmFactorSepHtml(T){
  try{
    T = (T === undefined) ? HG_TM_FACTOR_SEP : T;   /* the OMNIROUTE renderer's own seam: a harness hands a literal in */
    if (!T) return '';
    if (T.measured !== true || !Array.isArray(T.rows) || !T.rows.length){
      return '<div class="note" data-tm-replay="unmeasured"><b>REPLAY · NOT YET MEASURED.</b> ' + escH(T.note || 'the walk has not run')
        + ((Array.isArray(T.forwardOnly) && T.forwardOnly.length) ? ' <span class="dim">Forward-only reads, measurable in the ledger above and nowhere else: ' + T.forwardOnly.map(escH).join(', ') + '.</span>' : '')
        + '</div>';
    }
    if (typeof W.hgOmniFactorSepHtml !== 'function') return '';
    return W.hgOmniFactorSepHtml(T) || '';
  }catch(e){ return ''; }
}
function tmPostGateReads(r){
  var pg = r && r.postGate;
  if (!pg) return undefined;
  if (pg.state === 'veto') return { 'postgate:veto': true };
  if (pg.state === 'pass') return { 'postgate:veto': false };
  return undefined;   /* unchecked: nothing was tested, nothing is recorded */
}
function tmPostGateLabel(r){
  var pg = r && r.postGate;
  if (!pg) return '';
  if (pg.state === 'veto') return 'POST-GATE VETO · ' + String(pg.reason || 'veto');
  if (pg.state === 'pass') return 'POST-GATE PASS';
  return 'POST-GATE UNCHECKED';
}
function tmPostGateChip(r){
  var pg = r && r.postGate;
  if (!pg) return '';
  if (pg.state === 'veto') return ' <span class="gpip bad" title="' + escH(pg.reason || '') + '">PG VETO</span>';
  if (pg.state === 'pass') return ' <span class="gpip ok">PG ✓</span>';
  return ' <span class="gpip">PG ?</span>';
}

/* ---------------- tab UI ---------------- */

var TURNOVER_FLOOR = (typeof W.hgDeskMinTurnover === 'function') ? W.hgDeskMinTurnover() : 5e6;
var CHUNK = 10;              // one visible batch: 10 coins, then the board updates
var CHUNK_SLEEP_MS = 40;

function tmVenueChip(item){
  return (typeof W.hgDeskVenueChipHTML === 'function') ? W.hgDeskVenueChipHTML(item) : '';
}
function tmSymLabel(row){
  if (!row) return '';
  return (typeof W.hgDeskSymLabel === 'function') ? W.hgDeskSymLabel(row) : (row.sym || '');
}
function tmRowVenue(row){
  return row && row.exchange ? String(row.exchange).toLowerCase() : 'binance';
}

function sleepMs(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

function pxFmt(n){
  if (typeof px === 'function') return px(n); // index.html adaptive formatter
  if (n === null || n === undefined || !isFinite(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}

function fmtN(n, d){
  if (typeof fmt === 'function') return fmt(n, d); // index.html formatter
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}

function escH(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

/* ---------------- universal trade plan (SL/TP levels) ---------------- */
var TM_STOP_ATR = 1.5, TM_T1_R = 2, TM_T2_R = 3.5, TM_ATR_LEN = 14;
var TM_MAJORITY = 2;   // |composite| >= 2 = the row's own majority signal
var TM_MIN_RR = (typeof W.CG_SWING_RR_MIN === 'number') ? W.CG_SWING_RR_MIN : 2.0;

/* majority direction. An explicit dir always wins.
   hg-v1398: when all four independent legs are numbers, the side is their
   sum, not the five-leg score. ADX cannot oppose; it only echoes that sum,
   and one real leg plus the echo used to clear |score| >= 2. The stored
   score still includes the echo. A row with no comps, or with a comps bag
   that does not carry the four legs, still reads the score — that is the
   number other desks already stored. */
function tmIndependentSum(inp){
  var c = inp && inp.comps;
  if (!c || typeof c !== 'object') return null;
  var keys = ['d1Trend', 'd1Cross', 'h4Cascade', 'cloud'];
  var s = 0, i, v;
  for (i = 0; i < 4; i++){
    v = c[keys[i]];
    if (typeof v !== 'number' || !isFinite(v)) return null;
    s += v;
  }
  return s;
}
function tmDirOf(inp){
  var dir = (inp && typeof inp.dir === 'string') ? inp.dir.toLowerCase() : null;
  if (dir === 'long' || dir === 'short') return dir;
  var indep = tmIndependentSum(inp);
  var sc = (indep !== null) ? indep
    : ((inp && typeof inp.score === 'number' && isFinite(inp.score)) ? inp.score : 0);
  if (sc >= TM_MAJORITY) return 'long';
  if (sc <= -TM_MAJORITY) return 'short';
  return null;
}

function tmFallbackStop(dir, entry, a, rows){
  var stopOpts = (typeof hgStructureStopOpts === 'function') ? hgStructureStopOpts({ atrLen: TM_ATR_LEN }) : { atrLen: TM_ATR_LEN, look: 20 };
  if (typeof hgStructureStop === 'function'){
    var st = hgStructureStop(dir, entry, rows, stopOpts);
    if (st) return { stop: st.stop, note: st.note };
  }
  var look = stopOpts.look || 20;
  var stop = NaN, note = '';
  var sw = (typeof lastSwing === 'function') ? lastSwing(rows, dir, look) : NaN;
  if (isFinite(sw)){
    var s = (dir === 'long') ? sw - 0.25 * a : sw + 0.25 * a;
    var r = (dir === 'long') ? entry - s : s - entry;
    if (r > 0 && r <= 2.5 * a){ stop = s; note = 'stop: lastSwing(4h,' + look + ') structure buffered 0.25×ATR' + TM_ATR_LEN; }
    else if (r > 2.5 * a) note = 'stop capped: structure beyond 2.5×ATR — ' + TM_STOP_ATR + '×ATR' + TM_ATR_LEN + ' used';
  }
  if (!isFinite(stop)){
    stop = (dir === 'long') ? entry - TM_STOP_ATR * a : entry + TM_STOP_ATR * a;
    if (!note) note = 'stop: ' + TM_STOP_ATR + '×ATR' + TM_ATR_LEN + ' (lastSwing unavailable)';
  }
  return { stop: stop, note: note };
}

function tmValidSetup(s){
  if (!s || !isFinite(s.entry) || s.entry <= 0 || !isFinite(s.stop) || !isFinite(s.t1)) return false;
  if (Math.abs(s.entry - s.stop) <= 0) return false;
  var rr = isFinite(s.rr1) ? s.rr1
    : Math.abs(s.t1 - s.entry) / Math.abs(s.entry - s.stop);
  return isFinite(rr) && rr >= TM_MIN_RR - 1e-9;
}

function trendmxTicker(inp){
  inp = inp || {};
  var mark = isFinite(inp.price) ? inp.price
    : (inp.rows4h && inp.rows4h.length ? inp.rows4h[inp.rows4h.length - 1].c : null);
  return { symbol: inp.sym, fundingPct: inp.fundingPct, mark: mark };
}

function trendmxClassify(inp, dir){
  var c = (inp && inp.comps) ? inp.comps : {};
  var longEv = [], shortEv = [];
  if (c.d1Trend > 0) longEv.push('1D above EMA200');
  else if (c.d1Trend < 0) shortEv.push('1D below EMA200');
  if (c.d1Cross > 0) longEv.push('EMA50>EMA200');
  else if (c.d1Cross < 0) shortEv.push('EMA50<EMA200');
  if (c.h4Cascade > 0) longEv.push('4H cascade bull');
  else if (c.h4Cascade < 0) shortEv.push('4H cascade bear');
  if (c.cloud > 0) longEv.push('above cloud');
  else if (c.cloud < 0) shortEv.push('below cloud');
  if (c.adxPt > 0) longEv.push('ADX strength bull');
  else if (c.adxPt < 0) shortEv.push('ADX strength bear');
  var regime = '';
  try{
    if (typeof hgTapeRegimeLabel === 'function' && inp.rows4h && inp.rows4h.length)
      regime = hgTapeRegimeLabel(inp.rows4h) || '';
  }catch(e){}
  return {
    dir: dir,
    longEv: longEv,
    shortEv: shortEv,
    regime: regime,
    score: Math.abs((inp && inp.score) || 0),
    total: 5
  };
}

/* cryptogates parity for the row's trend direction — never throws */
function trendmxGateEval(inp, dir){
  try{
    if (!dir || !inp || !inp.rows4h || !inp.rows4h.length) return null;
    var ticker = trendmxTicker(inp);
    var out = {
      gatesPassed: 0, gatesTotal: 7, clean7: false, nearClean: false,
      hit: null, label: 'trend only', veto: null
    };
    if (typeof swingTryClean === 'function'){
      var clean = swingTryClean(inp.rows4h, ticker);
      if (clean && clean.dir === dir){
        out.hit = clean;
        out.clean7 = clean.clean === true || (+clean.passed >= 7);
        out.gatesPassed = clean.passed != null ? +clean.passed : 7;
        out.label = out.clean7 ? '7/7 CLEAN' : (out.gatesPassed + '/7');
        out.nearClean = !out.clean7 && out.gatesPassed >= 6;
        return out;
      }
    }
    if (typeof swingTryNear === 'function'){
      var near = swingTryNear(inp.rows4h, ticker);
      if (near && near.dir === dir){
        out.hit = near;
        out.nearClean = true;
        out.gatesPassed = near.passed != null ? +near.passed : 6;
        out.label = out.gatesPassed + '/7 NEAR';
        return out;
      }
    }
    if (typeof hgSwingParity === 'function'){
      var par = hgSwingParity(inp.rows4h, ticker, dir);
      if (par && par.aligned){
        out.gatesPassed = par.passed || 0;
        out.clean7 = par.clean === true;
        out.nearClean = !par.clean && par.passed >= 6;
        out.label = par.label || (par.passed + '/7');
      }
    } else if (typeof swingGateMatrix === 'function'){
      var m = swingGateMatrix(inp.rows4h, ticker);
      if (m && m.regimeVeto){ out.veto = 'regime'; out.label = 'regime veto'; return out; }
      if (m && m.structureVeto){ out.veto = 'structure'; out.label = 'CHoCH veto'; return out; }
      if (m && m.dir === dir){
        out.gatesPassed = m.passed || 0;
        out.clean7 = m.clean === true;
        out.nearClean = !m.clean && m.passed >= 6;
        out.label = (m.passed || 0) + '/7' + (m.clean ? ' CLEAN' : (m.passed >= 6 ? ' NEAR' : ''));
      } else if (m && m.dir){
        out.label = 'gates ' + m.dir + ' vs trend';
      }
    }
    return out;
  }catch(e){ return null; }
}

function trendmxAttachMeta(plan, gate, extra){
  if (!plan) return plan;
  if (gate){
    plan.gatesPassed = gate.gatesPassed;
    plan.clean7 = gate.clean7;
    plan.nearClean = gate.nearClean;
    plan.gateLabel = gate.label;
  }
  if (extra && extra.formationScore != null) plan.formationScore = extra.formationScore;
  /* WHERE PRICE IS, carried with the plan. trendmxTicker already derives
     exactly this — inp.price, else the last 4h close — for the gate
     evaluation; the plan just never kept it, so the card could not tell
     whether price had already walked through the levels it was drawing.
     Positive finite only: an unknown mark stays absent and renders no
     verdict rather than a wrong one. */
  if (plan.mark == null && extra){
    var tmMark = isFinite(+extra.price) ? +extra.price
      : ((extra.rows4h && extra.rows4h.length) ? +extra.rows4h[extra.rows4h.length - 1].c : NaN);
    if (isFinite(tmMark) && tmMark > 0) plan.mark = tmMark;
  }
  if (!plan.planSrc) plan.planSrc = 'trendmx';
  if (typeof W.hgOmniPrincipalApply === 'function'){
    try{
      W.hgOmniPrincipalApply(plan, {
        tab: 'trendmx', rows: extra && extra.rows4h, strategy: 'trendmx', dir: plan.dir
      });
      if (plan.demoted || plan.deskEdgeAction === 'suppress') plan.omniDemoted = true;
    }catch(eOm){}
  }
  return plan;
}

/* window.trendmxPlan({dir?|score?, cls?, rows4h, rows1h?, entry?}) -> plan|null.
   Pure: no DOM, no network, every global feature-checked, never throws.
   window.smartSetup (index.html) is preferred when available; otherwise the
   house fallback: entry = last 4h close, stop = lastSwing(4h,30) structure
   within 2.5xATR else 1.5xATR against dir, T1 = 2R, T2 = 3.5R. null when
   there is no majority direction or levels cannot be computed honestly. */

function tmBaseOf(inp){
  var b = String((inp && (inp.base || inp.sym)) || '').toUpperCase();
  return b.replace(/^B-/, '').replace(/_USDT$/, '').replace(/USDT$/, '');
}
function tmAltLongBlockedByBtc(inp){
  if (tmBaseOf(inp) === 'BTC') return false;
  return !!((__tmMacro && __tmMacro.btcStructure === 'down'));
}
function trendmxStampBtcStructure(rows){
  var st = null;
  if (Array.isArray(rows)){
    for (var i = 0; i < rows.length; i++){
      if (tmBaseOf(rows[i]) !== 'BTC') continue;
      try{ st = tmStructureDir(rows[i].rows4h); }catch(eSt){ st = null; }
      if (st) break;
    }
  }
  var prev = __tmMacro || {};
  trendmxMacroSet({ btcFunding: prev.btcFunding != null ? prev.btcFunding : null, btcStructure: st });
  return st;
}
function tmAtrLast(rows){
  try{
    if (!rows || typeof atr !== 'function') return NaN;
    var a = atr(rows, 14);
    if (!a || !a.length) return NaN;
    var v = a[a.length - 1];
    return isFinite(v) ? v : NaN;
  }catch(e){ return NaN; }
}
function tmEmaLast(closes, len){
  if (typeof ema !== 'function' || !closes) return NaN;
  var series = ema(closes, len);
  if (!series || !series.length) return NaN;
  var v = series[series.length - 1];
  return isFinite(v) ? v : NaN;
}
/* A fresh cross is not filled at the print. The order is a limit at the
   nearer 4h EMA that price has to come back to. If price is already through
   both, the pullback has happened and the last close is the entry. The
   limit dies if it is not tagged within 6 four-hour bars. */
function trendmxApplyCrossLimit(plan, inp, dir){
  if (!plan) return null;
  var kind = inp && inp.freshCross;
  if (kind !== 'GOLDEN' && kind !== 'DEATH') return plan;
  var rows = inp.rows4h;
  if (!rows || rows.length < 21) return plan;
  var closes = rows.map(function(r){ return r ? r.c : NaN; });
  var px = closes[closes.length - 1];
  var e9 = tmEmaLast(closes, 9), e21 = tmEmaLast(closes, 21);
  if (!isFinite(px)) return plan;
  var cands = [];
  if (dir === 'long'){
    if (isFinite(e9) && e9 < px) cands.push(['EMA9', e9]);
    if (isFinite(e21) && e21 < px) cands.push(['EMA21', e21]);
  } else {
    if (isFinite(e9) && e9 > px) cands.push(['EMA9', e9]);
    if (isFinite(e21) && e21 > px) cands.push(['EMA21', e21]);
  }
  var entry = px, emaName = 'MARKET', entryType = 'MARKET';
  if (cands.length){
    cands.sort(function(a, b){ return Math.abs(a[1] - px) - Math.abs(b[1] - px); });
    entry = cands[0][1];
    emaName = cands[0][0];
    entryType = 'LIMIT';
  }
  var stop = plan.stop;
  var a = tmAtrLast(rows);
  if (dir === 'long' && !(entry > stop) && isFinite(a) && a > 0) stop = entry - 1.5 * a;
  if (dir === 'short' && !(stop > entry) && isFinite(a) && a > 0) stop = entry + 1.5 * a;
  var risk = dir === 'long' ? entry - stop : stop - entry;
  if (!(risk > 0)) return plan;
  var bit = entryType === 'LIMIT'
    ? ('LIMIT @ 4h ' + emaName + ' · cancel if not tagged in 6×4h')
    : 'price already at the 4h EMAs';
  return Object.assign({}, plan, {
    entry: entry, stop: stop,
    t1: dir === 'long' ? entry + 2 * risk : entry - 2 * risk,
    t2: dir === 'long' ? entry + 3.5 * risk : entry - 3.5 * risk,
    rr1: 2, rr2: 3.5, riskPct: risk / entry * 100,
    entryType: entryType, limitEma: emaName,
    note: (plan.note ? plan.note + ' · ' : '') + bit
  });
}

function trendmxPlan(inp){
  try{
    inp = inp || {};
    var dir = tmDirOf(inp);
    if (!dir) return null;
    if (dir === 'long' && tmAltLongBlockedByBtc(inp)) return null;
    var plan = null;
    if (typeof hgBestLevels === 'function'){
      var gate = inp.gate || trendmxGateEval(inp, dir);
      var bl = hgBestLevels(Object.assign({}, inp, {
        tab: 'trendmx', style: 'swing', dir: dir, gate: gate,
      }));
      if (bl && bl.ok && bl.plan && tmValidSetup(bl.plan)){
        plan = trendmxAttachMeta(bl.plan, bl.gate || gate, { formationScore: bl.formationScore, rows4h: inp.rows4h, price: inp.price });
      } else if (bl && bl.veto) return null;
    }
    if (!plan) plan = trendmxPlanLegacy(inp);
    return trendmxApplyCrossLimit(plan, inp, dir);
  }catch(e){ return null; }
}

function trendmxPlanLegacy(inp){
  try{
    inp = inp || {};
    var dir = tmDirOf(inp);
    if (!dir) return null;
    var rows = inp.rows4h;
    if (!Array.isArray(rows) || !rows.length) return null;
    var lastBar = rows[rows.length - 1];
    if (!lastBar) return null;
    var ticker = trendmxTicker(inp);
    var gate = inp.gate || trendmxGateEval(inp, dir);

    /* 1) gate-clean hit + unified formation ticket (same as GATES scan) */
    if (gate && gate.hit && !gate.veto && typeof hgFormTicket === 'function'){
      try{
        var fm = hgFormTicket(gate.hit, {
          rows: rows, style: 'swing', a4: gate.hit.a4,
          rows1h: inp.rows1h, ticker: ticker
        });
        if (fm && fm.ok && fm.hit && tmValidSetup(fm.hit)){
          return trendmxAttachMeta(fm.hit, gate, { formationScore: fm.formationScore, rows4h: rows, price: inp.price });
        }
      }catch(eForm){}
    }

    /* 2) swing clean plan from cryptogates */
    if (typeof hgSwingCleanPlan === 'function'){
      try{
        var sc = hgSwingCleanPlan(rows, ticker, dir);
        if (tmValidSetup(sc)) return trendmxAttachMeta(sc, gate, { rows4h: rows, price: inp.price });
      }catch(eSc){}
    }

    /* 3) structure-based hgPlanLevels with min R:R */
    if (typeof hgPlanLevelsCore === 'function'){
      try{
        var pl = hgPlanLevelsCore(dir, rows, null, { minRr: TM_MIN_RR, style: 'swing', type: 'TRENDMX' });
        if (tmValidSetup(pl)) return trendmxAttachMeta(pl, gate, { rows4h: rows, price: inp.price });
      }catch(ePl){}
    }

    /* 4) SMART $ builder with trend-derived evidence */
    if (typeof smartSetup === 'function'){
      try{
        var cls = trendmxClassify(inp, dir);
        var s = smartSetup(cls, rows, inp.rows1h);
        if (tmValidSetup(s)){
          if (typeof hgApplyExactEntry === 'function'){
            s = hgApplyExactEntry(s, rows, { rows1h: inp.rows1h, style: s.type || 'swing', preferEdge: true }) || s;
          }
          return trendmxAttachMeta(s, gate, { rows4h: rows, price: inp.price });
        }
      }catch(eSmart){}
    }

    /* 5) house fallback — structure stop + structure targets when available */
    var entry = +((inp.entry !== undefined && inp.entry !== null) ? inp.entry : lastBar.c);
    var a = (typeof atr === 'function') ? atr(rows, TM_ATR_LEN)[rows.length - 1] : NaN;
    if (!isFinite(entry) || entry <= 0 || !isFinite(a) || a <= 0) return null;
    var st = tmFallbackStop(dir, entry, a, rows);
    var risk = Math.abs(entry - st.stop);
    if (!(risk > 0)) return null;
    var t1 = (dir === 'long') ? entry + TM_T1_R * risk : entry - TM_T1_R * risk;
    var t2 = (dir === 'long') ? entry + TM_T2_R * risk : entry - TM_T2_R * risk;
    var runner = tmRunnerR(rows);
    var t3 = runner == null ? NaN : ((dir === 'long') ? entry + runner * risk : entry - runner * risk);
    if (typeof hgStructureTargets === 'function'){
      try{
        var tg = hgStructureTargets(dir, entry, st.stop, rows, a, { minRr: TM_MIN_RR, style: 'swing' });
        if (tg && isFinite(tg.t1)){
          t1 = tg.t1;
          if (isFinite(tg.t2)) t2 = tg.t2;
        }
      }catch(eTg){}
    }
    var fb = {
      type: 'ATR', dir: dir, entry: entry, stop: st.stop, t1: t1, t2: t2, t3: t3,
      rr1: Math.abs(t1 - entry) / risk,
      rr2: Math.abs(t2 - entry) / risk,
      trailBe: (dir === 'long') ? entry + 0.35 * a : entry - 0.35 * a,
      riskPct: risk / entry * 100,
      confirmed: null, note: st.note, planSrc: 'trendmx-fallback'
    };
    if (!tmValidSetup(fb)) return null;
    return trendmxAttachMeta(fb, gate, { rows4h: rows, price: inp.price });
  }catch(e){ return null; }
}

/* plan line, same markup as oiflow.js:
   ENTRY <b>..</b> · STOP <b>..</b> · T1 <b>..</b> (xR) · T2 <b>..</b> (xR) · risk ..% */
function trendmxPlanHTML(s){
  if (!s) return '';
  var risk = (isFinite(s.entry) && isFinite(s.stop)) ? Math.abs(s.entry - s.stop) : NaN;
  var rr1 = isFinite(s.rr1) ? s.rr1 : ((isFinite(risk) && risk > 0) ? Math.abs(s.t1 - s.entry) / risk : NaN);
  var rr2 = isFinite(s.rr2) ? s.rr2 : ((isFinite(risk) && risk > 0) ? Math.abs(s.t2 - s.entry) / risk : NaN);
  return 'ENTRY <b>' + pxFmt(s.entry) + '</b> · STOP <b>' + pxFmt(s.stop) + '</b>'
    + ' · T1 <b>' + pxFmt(s.t1) + '</b> (' + fmtN(rr1, 1) + 'R)'
    + ' · T2 <b>' + pxFmt(s.t2) + '</b> (' + fmtN(rr2, 1) + 'R)'
    + (isFinite(s.t3) ? (' · T3 <b>' + pxFmt(s.t3) + '</b> (' + (Math.abs(s.t3 - s.entry) / Math.abs(s.entry - s.stop)).toFixed(1) + 'R)') : '')
    + (isFinite(s.trailBe) ? (' · after T1, example stop <b>' + pxFmt(s.trailBe) + '</b>') : '')
    + (function(){ var ex = tmExampleSize(s.entry, s.stop); return ex ? (' · example 1% of $10,000 is ' + ex.units.toFixed(4) + ' units ($' + ex.notional.toFixed(0) + '), not an order') : ''; })()
    + (isFinite(s.riskPct) ? ' · risk ' + fmtN(s.riskPct, 2) + '%' : '')
    + (typeof hgSafeLevChip === 'function' ? hgSafeLevChip(s.entry, s.stop) : '')
    + (s.note ? ' — ' + escH(s.note) : '')
    /* price may have walked through this plan already — the shared rule in
       hg-plan.js, judged against the mark trendmxAttachMeta carried over */
    + ((typeof W !== 'undefined' && W && typeof W.hgPlanGeometryLineHtml === 'function')
      ? (W.hgPlanGeometryLineHtml({ dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1 },
                                  s.mark, { cls: 'note warn', style: 'margin-top:6px' }) || '') : '')
    /* the shared 14-gate indicator read attached by hgBestLevels */
    + ((typeof hgStrategyConfirmChipHtml === 'function')
      ? hgStrategyConfirmChipHtml(s.strategyConfirm, s.strategyWith, s.strategyAgainst) : '')
    + (s.contextRead ? '<div class="dim">' + escH(s.contextRead)
        + (s.contextWarn ? ' — context AGAINST this direction' : '') + '</div>' : '')
    + ((typeof hgStrategyTradeDetailHtml === 'function')
      ? hgStrategyTradeDetailHtml(s, { skipChip: true }) : '');
}

/* expandable-row block for one matrix row; uses the scan-cached 4h rows —
   never refetches. */
function trendmxCardStack(r, dir){
  try{
    if (!dir) return null;
    var gate = r.gate || trendmxGateEval(r, dir);
    var ticker = trendmxTicker(r);
    if (gate && gate.hit && typeof hgSetupStackFromHit === 'function'){
      var hit = Object.assign({}, gate.hit, { sym: r.sym });
      if (typeof hgSetupStackAttach === 'function'){
        hgSetupStackAttach(hit, {
          sym: r.sym, style: 'swing', rows4h: r.rows4h, rows1h: r.rows1h, ticker: ticker
        });
        return hit.stack || null;
      }
    }
    if (typeof hgSetupStackForInlineScan !== 'function') return null;
    return hgSetupStackForInlineScan({
      dir: dir, sym: r.sym, rows4h: r.rows4h, rows1h: r.rows1h,
      style: 'swing', asset: 'crypto', ticker: ticker,
      clean: !!(gate && gate.clean7),
      nearClean: !!(gate && gate.nearClean),
