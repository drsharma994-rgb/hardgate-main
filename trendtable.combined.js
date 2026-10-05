/* =========================================================================
HARDGATE — trendtable.js
TREND MATRIX tab (id 'trendmx'): multi-timeframe trend dashboard across the
full combined universe (Delta + CoinDCX + Binance extension via xuniverse.js,
≥ $5M turnover floor, no top-N cap; Binance-only fallback when xu absent).

Per symbol: binanceKlines 1d x260 + 4h x120 -> five signed components
(-1/0/+1), composite score -5..+5:
  1D TREND   1d close vs ema200
  CROSS      1d ema50 vs ema200, plus fresh-cross marker (<=10 bars):
             GOLDEN (crossOver) / DEATH (crossUnder)
  4H CASCADE 4h ema9 > ema21 > ema50 full align +1 / full inverse -1 / else 0
  CLOUD      ichimokuState(1d).priceVsCloud: ABOVE +1 / BELOW -1 / INSIDE 0
  ADX        adx(1d,14) latest >= 25 -> +sign(sum of the four trend
             components) as a strength point, else 0

Classic script, no build step. Loaded AFTER indicators.js, indicators2.js
and binance.js. Exposes the pure classifier window.trendScore, the pure
level builder window.trendmxPlan (+ trendmxPlanHTML/trendmxPlanBlock
renderers) and the window.HG_tabs registration (id/label/mount/refresh —
refresh re-runs a previously-started scan, busy-guarded, skipping honestly
when the operator never ran one). Never throws at load time;
all network goes through binance.js (10s AbortController, 60s cache);
per-symbol failures are counted and skipped; bulk fetches are paced in
chunks of 5.

Universal SL/TP: every scanned row caches its own 4h klines (no double
fetch) and gets an expandable LEVELS cell. Direction comes from the row's
own majority signal (composite >= +2 => long / <= -2 => short); levels come
from window.trendmxPlan — window.smartSetup (index.html SMART $ builder)
when present and sane, else the house fallback: entry = last 4h close,
stop = lastSwing(4h,30) structure buffered 0.25xATR when within 2.5xATR,
else 1.5xATR against dir; T1 = 2R, T2 = 3.5R. Levels are never fabricated:
rows without cached 4h history or a computable ATR print an honest note.

EVIDENCE LAYER (hg-v1012) — the composite's five components are five reads
of the same closes; this layer adds the two independent legs the desk
carried but never judged on. The composite score itself is NOT touched:
a sixth component would silently re-scale every recorded tmScore the
forward ledger measures.
  TAKER FLOW — one capped, paced pass per scan (the promoted slice only,
    <= TM_FLOW_MAX rows, chunks of CHUNK) reads REAL Binance taker
    long/short flow — binanceTakerRatio on the row's hgDeskBinanceSym twin,
    4h x 120 windows — through omniroute.js's hgOmniCvd over the last
    TM_FLOW_LOOK windows. Flow AGAINST the row's own majority holds the row
    off the LIMIT BOARD and caps it at NEAR (it paints, the chip names why
    — nothing is dropped silently); flow WITH chips TAKER FLOW WITH IT.
    Anything unreadable — no Binance twin, fewer than TM_FLOW_MIN_WIN
    windows, a junk ratio series hgOmniCvd itself refuses to call taker, a
    failed fetch — demotes nothing (the hg-v700 honest-degradation rule).
    The candle-approximated stand-in never speaks here (the hg-v1009 rule:
    it derives from the same closes the composite already read, so it is
    not independent evidence). The look and the floor are stated PRIORS,
    not measurements; the forward record now carries fundingPct and a
    takerFlowWith read-mark (hg-v985/hg-v989 seams) so the ledger can
    answer the split out of sample. The GOLDEN CROSS desk is deliberately
    out of scope: its premise is a fresh multi-week cross, which five days
    of 4h flow would misjudge.
  FUNDING CROWDING — the fundingPct the universe already carried, read
    through the ONE house rule (hg-setup-core.js hgFundingAgainstMark, the
    G4 directional bar): leaning the same way as the row's direction chips
    FUNDING CROWDED — squeeze risk. A caution chip, never a gate, the tier
    unchanged (brain.js's own crowding pattern). Chip only; the tally's
    points stay untouched.

DIRECTION PARITY (hg-v1013) — trendmxConviction measured the composite's
strength on the long side only (sc >= 4 / sc >= 2), so a row at -5 had
less standing than a row at +2: no short reached the LIMIT BOARD, the
promoted slice or the CONVICTION filter except through a 7/7 clean. The
reader now takes |score| — the same bars, both directions.

THE DEATH CROSS DESK (hg-v1014) — the last one-sided surface: the golden
desk's exact mirror. trendmxDeathCrossSetups rows carry a fresh ⚡DEATH
(EMA50/200 cross under, <=10 daily bars) + bear cross + short majority +
conviction (the v1013 bars) + a valid short plan; the FRESH CROSS DESK
panel renders golden longs and death shorts side by side, a ⚡ DEATH
filter chip joins the bar, the SMC pass enriches both ticket kinds inside
the one capped envelope, and the Telegram cycle (tabalerts.js) keys,
formats and pushes death crosses under their own dedup namespace
(TRENDMX:DEATH) — golden keys and formats are byte-identical to before.

TWO CROSS DESKS (hg-v1015) — at the operator's ask the combined panel is
split: the ⚡ GOLDEN CROSS DESK (bull, green) and the ⚡ DEATH CROSS DESK
(bear, red) stand on their own, each its own panel and container
(data-r=golden / data-r=death), each rendering only its own bag through
the shared dir-aware card renderer. The 4-card cap per desk is the cap
each half already had — the split changes presentation, not exposure.

THE CLASS DESKS (hg-v1018) — the LIMIT BOARD painted two different
formation CLASSES in one mixed bag and ranked them against each other,
while the forward log already recorded them under different mechanics
(TM-CLEAN7 / TM-CONVICTION) precisely because the desk's own claim is
that they are different things. They stand on their own now:
  LIMIT BOARD · GATE-CLEAN DESK (data-r=gateclean) — the 7/7 swing-gate
    matrix (spread · vol-Z · EMA21 anchor · funding · regime · structure
    · R:R) CONFIRMS the composite majority. Ordered by |composite| then
    gates passed — the old board's intra-class rank, unchanged.
  LIMIT BOARD · CONVICTION DESK (data-r=conviction) — the five-leg
    composite majority speaks WITHOUT the 7/7 stamp (|score| ≥ 2, STRONG
    at |4|). Ordered by |composite| with the ADX strength indicator
    breaking ties — the class's own claim is trend strength, so the
    strength read orders it (a ±4 at ADX 38 outranks a ±4 at 25); gate
    count is the other class's evidence and does not order this desk.
One collection (trendmxLimitClasses), ONE forward record over both bags
before either desk slices (mechanics byte-identical), two renders off
the shared card renderer. Each desk caps at 4 cards — the old mixed
board's 8 — so the split changes presentation, not exposure. Every
desk's panel header names its own formation criteria; each card carries
its class stamp. Taker-flow-AGAINST rows are still held off, now counted
and named per desk. The cross desks, the composite, the gates and every
bar are exactly what they were — no threshold moved.

THE MOMENTUM WITNESS (hg-v1019) — the composite's five legs are all SLOW
trend/strength reads of the same closes (two EMA stacks, a cascade, a
cloud, ADX); until this pack the desk carried no momentum oscillator at
all. Trend legs lag: a row keeps a ±3 composite while the momentum regime
has already turned. The witness is the canonical RSI range read
(Cardwell/Constance Brown): a bull momentum range holds RSI(14) above 40
(the 40–50 pullback floor), a bear range caps it under 60 — so a LONG row
whose 1D RSI has broken UNDER 40, or a SHORT row whose RSI has broken
OVER 60, is a slow composite fighting a turned momentum regime. The
mechanic mirrors the hg-v1012 taker-flow hold-off exactly:
  - trendScore carries out.rsi — EVIDENCE ONLY. The composite stays five
    legs: a sixth would silently re-scale every tmScore the forward
    ledger measures (the hg-v1012 rule). rsi missing/unreadable -> NaN,
    and NaN holds nothing off (the hg-v700 honest-degradation rule).
  - momentum-AGAINST rows cap at NEAR (trendmxRowTier, beside the flow
    cap) and are HELD OFF both limit desks — counted per class
    (heldWhy.clean/heldWhy.mom), the desk verdict naming each reason that
    actually fired; the row still paints in the matrix with its
    MOMENTUM AGAINST · HELD OFF chip. Nothing is dropped silently.
  - momentum-WITH rows (RSI on the regime side of the 50 midline: long
    ≥ 50, short ≤ 50) chip MOMENTUM WITH IT and hand the forward log a
    momWith read-mark (the hg-v989 reads seam, beside takerFlowWith) —
    the 40/60 bars and the 50 midline are stated PRIORS, and the ledger
    is how they earn a measured verdict.
  - the abstain zone is honest: RSI 40–50 against a long (50–60 against
    a short) is the pullback zone inside an INTACT regime — momentum has
    nothing to add, no chip, no hold, no read.
  - the GOLDEN/DEATH cross desks stay out of scope: a fresh multi-week
    cross prints RSI climbing out of the OLD range by construction, and
    the witness would misjudge the turn (the same reason flow stands
    down there, hg-v1012).

THE VOLUME WITNESS (hg-v1020) — the composite reads closes, the momentum
witness reads closes, and the flow witness reads ONE venue's 4h taker
prints; until this pack NOTHING read the swing-scale volume trend on the
row's own 1D tape. Granville's rule is the canonical one: volume must
confirm. The read is the textbook OBV DIVERGENCE over the last two 20-bar
daily windows (windowed swing extremes, not the raw cumulative line):
price making a HIGHER 20-bar high while OBV makes a LOWER one is
distribution under the rally (AGAINST longs); a LOWER price low with a
HIGHER OBV low is accumulation under the fall (AGAINST shorts); price and
OBV making the new extreme TOGETHER is confirmation (WITH). The mechanic
is the momentum witness's own (hg-v1019): trendScore carries volDiv /
volConf as EVIDENCE (never composite legs), AGAINST rows cap at NEAR and
hold off both class desks (heldWhy gains the vol reason; each desk names
only the witnesses that fired), WITH rows chip VOLUME TREND WITH IT and
hand the ledger a volWith read-mark on the same hg-v989 seam, flat and
unreadable stay silent — fewer than 40 daily bars or a volume-deaf feed
(all-zero v) cannot speak, and what cannot speak holds nothing off. A
pullback does NOT false-fire: divergence needs price at a NEW 20-bar
extreme, which a pullback by definition is not. The 20-bar windows are
stated PRIORS; the ledger earns them a measured verdict.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : this;

/* ---------------- pure composite score ---------------- */

function sgn(x){ return x > 0 ? 1 : (x < 0 ? -1 : 0); }

/* compare with a 1e-12 relative deadzone — absorbs float accumulation noise
   in long EMA chains (e.g. 260 exactly-flat closes drift ~1e-13), invisible
   to any real price difference. */
function cmp(a, b){
  var d = a - b;
  var tol = 1e-12 * Math.max(Math.abs(a), Math.abs(b), 1);
  return d > tol ? 1 : (d < -tol ? -1 : 0);
}

function zeroResult(){
  return { score: 0,
           comps: { d1Trend: 0, d1Cross: 0, h4Cascade: 0, cloud: 0, adxPt: 0 },
           freshCross: null, adx: NaN, rsi: NaN, volDiv: null, volConf: null };
}

/* hg-v1020: THE VOLUME WITNESS — OBV on the row's own 1D tape. Local copy
   of the canonical definition (cumulative signed volume; identical math to
   every charting package — indicators.js does not export one), plus the
   windowed divergence read: the last two 20-bar daily windows compared on
   swing extremes, price vs OBV. -> { div: 'bear'|'bull'|null,
   conf: 'up'|'down'|null }; nulls when the tape cannot speak (fewer than
   40 bars, or a volume-deaf feed: every v zero/missing). */
var TM_VOL_WIN = 20;
function tmObvSeries(rows){
  var n = rows.length, out = new Array(n).fill(NaN), acc = 0, anyV = false;
  for (var i = 0; i < n; i++){
    var r = rows[i];
    if (!r || !isFinite(r.c)) continue;
    var v = (isFinite(r.v) && r.v > 0) ? r.v : 0;
    if (v > 0) anyV = true;
    if (i > 0 && rows[i - 1] && isFinite(rows[i - 1].c)){
      if (r.c > rows[i - 1].c) acc += v;
      else if (r.c < rows[i - 1].c) acc -= v;
    }
    out[i] = acc;
  }
  return anyV ? out : null;
}
function tmVolWitness(rows){
  var out = { div: null, conf: null };
  var n = rows.length;
  if (n < TM_VOL_WIN * 2) return out;
  var obv = tmObvSeries(rows);
  if (!obv) return out;
  var pHi1 = -Infinity, pHi2 = -Infinity, pLo1 = Infinity, pLo2 = Infinity,
      oHi1 = -Infinity, oHi2 = -Infinity, oLo1 = Infinity, oLo2 = Infinity;
  for (var i = n - TM_VOL_WIN * 2; i < n; i++){
    var r = rows[i];
    if (!r || !isFinite(r.c) || !isFinite(obv[i])) continue;
    if (i >= n - TM_VOL_WIN){
      if (r.c > pHi2) pHi2 = r.c; if (r.c < pLo2) pLo2 = r.c;
      if (obv[i] > oHi2) oHi2 = obv[i]; if (obv[i] < oLo2) oLo2 = obv[i];
    } else {
      if (r.c > pHi1) pHi1 = r.c; if (r.c < pLo1) pLo1 = r.c;
      if (obv[i] > oHi1) oHi1 = obv[i]; if (obv[i] < oLo1) oLo1 = obv[i];
    }
  }
  if (!isFinite(pHi1) || !isFinite(pHi2) || !isFinite(oHi1) || !isFinite(oHi2)
      || !isFinite(pLo1) || !isFinite(pLo2) || !isFinite(oLo1) || !isFinite(oLo2)) return out;
  /* distribution under the rally / accumulation under the fall — the
     textbook OBV divergences; confirmation is the new extreme TOGETHER */
  if (pHi2 > pHi1 && oHi2 < oHi1) out.div = 'bear';
  if (pLo2 < pLo1 && oLo2 > oLo1) out.div = 'bull';
  if (pHi2 > pHi1 && oHi2 > oHi1) out.conf = 'up';
  if (pLo2 < pLo1 && oLo2 < oLo1) out.conf = 'down';
  return out;
}

/* window.trendScore(rows1d, rows4h) -> {score, comps, freshCross, adx, rsi}
   Pure: no DOM, no network, never throws. Rows are {t,o,h,l,c,v} ascending.
   hg-v1019: rsi is EVIDENCE — it is NOT a composite leg; score is the same
   five legs it always was. */
function trendScore(rows1d, rows4h){
  var out = zeroResult();
  try{
    if (typeof ema !== 'function' || typeof adx !== 'function' ||
        typeof ichimokuState !== 'function' || typeof crossOver !== 'function' ||
        typeof crossUnder !== 'function' || typeof crossedRecently !== 'function'){
      return out; // indicator globals missing -> graceful zero
    }
    var ok1 = Array.isArray(rows1d) && rows1d.length > 0;
    var ok4 = Array.isArray(rows4h) && rows4h.length > 0;
    if (!ok1 && !ok4) return out;

    if (ok1){
      var c1 = rows1d.map(function(r){ return r ? r.c : NaN; });
      var i1 = c1.length - 1;
      var e50 = ema(c1, 50), e200 = ema(c1, 200);
      var cL = c1[i1], e50L = e50[i1], e200L = e200[i1];

      /* 1) 1d close vs ema200 */
      if (isFinite(cL) && isFinite(e200L)) out.comps.d1Trend = cmp(cL, e200L);

      /* 2) 1d ema50 vs ema200 + fresh-cross marker (<=10 bars) */
      if (isFinite(e50L) && isFinite(e200L)) out.comps.d1Cross = cmp(e50L, e200L);
      if (crossedRecently(crossOver(e50, e200), 10)) out.freshCross = 'GOLDEN';
      else if (crossedRecently(crossUnder(e50, e200), 10)) out.freshCross = 'DEATH';

      /* 4) ichimoku cloud on 1d */
      var st = ichimokuState(rows1d);
      if (st && st.priceVsCloud === 'ABOVE') out.comps.cloud = 1;
      else if (st && st.priceVsCloud === 'BELOW') out.comps.cloud = -1;
    }

    /* 3) 4h cascade ema9 / ema21 / ema50 */
    if (ok4){
      var c4 = rows4h.map(function(r){ return r ? r.c : NaN; });
      var i4 = c4.length - 1;
      var e9 = ema(c4, 9)[i4], e21 = ema(c4, 21)[i4], e50h = ema(c4, 50)[i4];
      if (isFinite(e9) && isFinite(e21) && isFinite(e50h)){
        if (e9 > e21 && e21 > e50h) out.comps.h4Cascade = 1;
        else if (e9 < e21 && e21 < e50h) out.comps.h4Cascade = -1;
      }
    }

    /* 5) ADX strength point in the direction of the trend-sum so far */
    if (ok1){
      var a = adx(rows1d, 14);
      out.adx = (a && a.adx && a.adx.length) ? a.adx[a.adx.length - 1] : NaN;
      /* hg-v1019: THE MOMENTUM WITNESS rides the same 1D tape — RSI(14) as
         EVIDENCE. NOT a sixth composite leg: the score sum below is
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

    out.score = out.comps.d1Trend + out.comps.d1Cross + out.comps.h4Cascade +
                out.comps.cloud + out.comps.adxPt;
  }catch(e){
    return zeroResult(); // never throw to UI
  }
  return out;
}

/* ---------------- tab UI ---------------- */

var TURNOVER_FLOOR = (typeof W.hgDeskMinTurnover === 'function') ? W.hgDeskMinTurnover() : 5e6;
var CHUNK = 5;               // paced bulk fetch chunk size
var CHUNK_SLEEP_MS = 150;

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

/* majority direction from the row's own composite score; an explicit
   lowercase/uppercase dir always wins over the score. */
function tmDirOf(inp){
  var dir = (inp && typeof inp.dir === 'string') ? inp.dir.toLowerCase() : null;
  if (dir === 'long' || dir === 'short') return dir;
  var sc = (inp && typeof inp.score === 'number' && isFinite(inp.score)) ? inp.score : 0;
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
function trendmxPlan(inp){
  try{
    inp = inp || {};
    var dir = tmDirOf(inp);
    if (!dir) return null;
    if (typeof hgBestLevels === 'function'){
      var gate = inp.gate || trendmxGateEval(inp, dir);
      var bl = hgBestLevels(Object.assign({}, inp, {
        tab: 'trendmx', style: 'swing', dir: dir, gate: gate,
      }));
      if (bl && bl.ok && bl.plan && tmValidSetup(bl.plan)){
        return trendmxAttachMeta(bl.plan, bl.gate || gate, { formationScore: bl.formationScore, rows4h: inp.rows4h, price: inp.price });
      }
      if (bl && bl.veto) return null;
    }
    return trendmxPlanLegacy(inp);
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
      type: 'ATR', dir: dir, entry: entry, stop: st.stop, t1: t1, t2: t2,
      rr1: Math.abs(t1 - entry) / risk,
      rr2: Math.abs(t2 - entry) / risk,
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
      gatesPassed: gate ? gate.gatesPassed : undefined,
      gatesTotal: 7,
      tightCount: gate && gate.hit ? gate.hit.tightCount : undefined
    });
  }catch(e){ return null; }
}

function trendmxPlanBlock(r){
  var dir = tmDirOf(r);
  if (!dir)
    return '<div class="plan">No majority direction on this row (|score| &lt; ' + TM_MAJORITY + ') — no levels.</div>';
  var s = trendmxPlan(Object.assign({}, r, { dir: dir }));
  /* lazy SMC read for a row the operator expanded by hand: one row per click,
     not a repaint loop, so rows outside the scan's capped slice still get a
     context when they are actually looked at. */
  if (s && !r.smc && r.rows4h && r.rows4h.length && tmSmcOn()){
    var tmSyn = { sym: r.sym, dir: dir, entry: s.entry, stop: s.stop, t1: s.t1 };
    tmSmcMark(tmSyn, r.rows4h);
    if (tmSyn.smc) r.smc = tmSyn.smc;
  }
  var tmStack = trendmxCardStack(r, dir);
  var stackHtml = (tmStack && typeof hgSetupStackMiniHtml === 'function') ? hgSetupStackMiniHtml(tmStack) : '';
  var inner = '<b>' + escH(r.sym) + '</b> ' + dir.toUpperCase() + ' · '
    + (s ? trendmxPlanHTML(s)
         : 'levels unavailable — 4h history was not cached for this row or ATR' + TM_ATR_LEN + ' is not computable; nothing is estimated.');
  if (s && s.gateLabel){
    inner += ' · <span class="gpip ' + (s.clean7 ? 'ok' : (s.nearClean ? '' : '')) + '">' + escH(s.gateLabel) + '</span>';
  }
  inner += tmSmcChip(r);
  /* hg-v1012: the evidence layer beside the plan an operator expanded to
     inspect — the stamps the scan left, never recomputed here */
  inner += trendmxFlowChipHtml(r) + trendmxFundingChipHtml(r);
  var tradeOnclick = (s && (typeof hgToTradePlanOnclickAttr === 'function' || typeof toTrade === 'function'))
    ? ((typeof hgToTradePlanOnclickAttr === 'function')
      ? hgToTradePlanOnclickAttr(r.sym, s.dir, s.entry, s.stop, s.t1, { t2: s.t2, stack: tmStack, scanner: 'trendmx', strategy: 'trendmx' })
      : ('toTrade(' + JSON.stringify(r.sym) + ',' + JSON.stringify(s.dir) + ',' + s.entry + ',' + s.stop + ',' + s.t1 + ')')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    : '';
  var btn = tradeOnclick
    ? ' <button class="toTrade" onclick="' + tradeOnclick + '">SEND TO TRADE PLAN →</button>' : '';
  var bookStamp = (s && typeof hgBookStampChip === 'function')
    ? hgBookStampChip(r.sym, s.dir, { scanner: 'trendmx', strategy: 'trendmx' }) : '';
  var bookBtn = (s && typeof bookBtnHTML === 'function')
    ? ' ' + bookBtnHTML(r.sym, s.dir, s.entry, s.stop, s.t1,
      { scanner: 'trendmx', strategy: 'trendmx', t2: s.t2, stack: tmStack }) : '';
  return '<div class="plan">' + inner + stackHtml + bookStamp + btn + bookBtn + '</div>';
}

var COLS = [
  { k: 'sym',       label: 'SYMBOL' },
  { k: 'score',     label: 'SCORE' },
  { k: 'gates',     label: 'GATES' },
  { k: 'd1Trend',   label: '1D TREND' },
  { k: 'd1Cross',   label: 'CROSS' },
  { k: 'h4Cascade', label: '4H CASCADE' },
  { k: 'cloud',     label: 'CLOUD' },
  { k: 'adx',       label: 'ADX' },
  { k: 'price',     label: 'PRICE' },
  { k: 'plan',      label: 'LEVELS', nosort: true }
];

/* ---------------- hard-refresh contract state ----------------
   tmTab mirrors the mounted pane's scan state so the HG_tabs refresh()
   (4th registration field) can re-run a scan the OPERATOR already started.
   A global hard refresh must NEVER trigger the expensive first-time
   full-universe scan on a tab that was never used — it skips honestly.
   busy mirrors runScan's own state.running guard so overlapping refresh
   invocations can't double-fetch. */
var tmTab = { run: null, busy: false, hasRun: false, missing: 0, mountEl: null };
var __tmSnap = null;
var __tmScanSnap = null;

/* hg-v1013: conviction is the STRENGTH of the majority, not its side.
   Every other reader of the composite is direction-agnostic — tmDirOf
   (|score| >= 2), the FORMING predicate (|score|), the board rank
   (|score|), the summary's strong counts (+4/-4) — while this one read
   sc >= 4 / sc >= 2, so a row at -5, the maximum bearish alignment the
   composite can print, had less standing than a row at +2. The practical
   effect: no short ever reached the LIMIT BOARD or the promoted slice
   (SMC + taker flow) except through a 7/7 clean, and the CONVICTION
   filter never showed a short. The bars do not move — 4 and TM_MAJORITY,
   exactly as before; they just stop pointing one way. Not a
   recalibration: the same numbers, applied to the side they always
   claimed to measure. The golden desk is untouched — it enforces
   dir === 'long' before conviction is ever asked. */
function trendmxConviction(row){
  var sc = (row && typeof row.score === 'number' && isFinite(row.score)) ? row.score : 0;
  var a = Math.abs(sc);
  if (a >= 4) return { tier: 'STRONG', label: 'STRONG CONVICTION', prime: true };
  if (a >= TM_MAJORITY) return { tier: 'CONVICTION', label: 'CONVICTION', prime: false };
  return null;
}

/** Rows with fresh ⚡GOLDEN (EMA50/200 cross ≤10d) + bull cross + long plan + conviction. Pure. */
function trendmxGoldenCrossSetups(rows){
  var out = [];
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || r.freshCross !== 'GOLDEN') continue;
    if (!r.comps || r.comps.d1Cross <= 0) continue;
    var dir = tmDirOf(r);
    if (dir !== 'long') continue;
    var conv = trendmxConviction(r);
    if (!conv) continue;
    if (r.gate && r.gate.veto) continue;
    var plan = trendmxPlan({ dir: dir, score: r.score, rows4h: r.rows4h, rows1h: r.rows1h, entry: r.price, gate: r.gate, comps: r.comps, sym: r.sym, fundingPct: r.fundingPct });
    if (!tmValidSetup(plan)) continue;
    out.push({
      sym: r.sym, dir: 'long', entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: fin(+plan.rr1) ? +plan.rr1 : TM_T1_R, score: r.score, adx: r.adx,
      clean7: !!(plan.clean7 || (r.gate && r.gate.clean7)),
      freshCross: 'GOLDEN', conviction: conv.label, tier: conv.tier, prime: conv.prime,
      comps: r.comps, gateLabel: plan.gateLabel || (r.gate && r.gate.label),
      note: '⚡GOLDEN CROSS (EMA50/200 · ≤10 daily bars) · composite ' + (r.score > 0 ? '+' : '') + r.score + '/5'
        + (plan.gateLabel ? ' · ' + plan.gateLabel : '')
    });
  }
  return out;
}

/* hg-v1014: the mirrored desk — rows with fresh ⚡DEATH (EMA50/200 cross
   UNDER, <=10 daily bars) + bear cross + short majority + conviction +
   valid short plan. The exact mirror of the golden desk, bar for bar:
   the same freshness window, the same conviction bars (|score|, hg-v1013
   — a fresh death cross at -2 earns the standing a golden cross earns at
   +2), the same veto respect, the same plan-validity bar. A death cross
   IS a bear cross; leaving shorts off this desk was the last one-sided
   surface on the tab. Pure. */
function trendmxDeathCrossSetups(rows){
  var out = [];
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || r.freshCross !== 'DEATH') continue;
    if (!r.comps || r.comps.d1Cross >= 0) continue;
    var dir = tmDirOf(r);
    if (dir !== 'short') continue;
    var conv = trendmxConviction(r);
    if (!conv) continue;
    if (r.gate && r.gate.veto) continue;
    var plan = trendmxPlan({ dir: dir, score: r.score, rows4h: r.rows4h, rows1h: r.rows1h, entry: r.price, gate: r.gate, comps: r.comps, sym: r.sym, fundingPct: r.fundingPct });
    if (!tmValidSetup(plan)) continue;
    out.push({
      sym: r.sym, dir: 'short', entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: fin(+plan.rr1) ? +plan.rr1 : TM_T1_R, score: r.score, adx: r.adx,
      clean7: !!(plan.clean7 || (r.gate && r.gate.clean7)),
      freshCross: 'DEATH', conviction: conv.label, tier: conv.tier, prime: conv.prime,
      comps: r.comps, gateLabel: plan.gateLabel || (r.gate && r.gate.label),
      note: '⚡DEATH CROSS (EMA50/200 · ≤10 daily bars) · composite ' + (r.score > 0 ? '+' : '') + r.score + '/5'
        + (plan.gateLabel ? ' · ' + plan.gateLabel : '')
    });
  }
  return out;
}

function fin(v){ return typeof v === 'number' && isFinite(v); }

/* ---------------- SMC context (record-only) ----------------
   hgSmcEnrich attaches .smc (structure bias, OB/FVG confluence, a grade) and
   records one SMC_CONTEXT signal. Nothing in this file reads .smc except the
   chip helper below: composite score, gate label, tier, sort order, the venue
   and quality filters and whether a card is shown are all untouched.

   Cost: the matrix holds the whole universe and every row carries its own
   120-bar 4h array, so SMC runs ONCE per scan over a capped, ranked slice of
   the rows the desk itself promotes — never from a render path, which
   repaints on every venue chip, SYNC DESK and chart-vision callback. */
var TM_SMC_MAX = 24;

function tmSmcOn(){
  try{ return !!(W && typeof W.hgSmcEnrich === 'function'); }catch(e){ return false; }
}

/* enrich a finished ticket in place; a ticket that already carries .smc, or a
   row with no cached 4h history, is left exactly as it was. */
function tmSmcMark(ticket, rows4h){
  try{
    if (!ticket || ticket.smc) return ticket;
    if (!Array.isArray(rows4h) || !rows4h.length) return ticket;
    if (W && typeof W.hgSmcEnrich === 'function') W.hgSmcEnrich(ticket, { rows: rows4h, tab: 'TREND MATRIX' });
  }catch(e){}
  return ticket;
}

function tmSmcChip(o){
  var out = '';
  try{
    if (o && o.smc && W && typeof W.hgSmcChipHtml === 'function') out = W.hgSmcChipHtml(o) || '';
  }catch(e){ out = ''; }
  return out;
}

/* One pass per scan. Golden tickets carry their levels but drop their candles;
   matrix rows carry their candles but not their levels — the two are joined
   here by symbol. The matrix row is never given dir/entry/stop of its own:
   trendmxPlan reads inp.entry as an entry OVERRIDE and tmDirOf reads inp.dir,
   so writing those onto the row would change the plan the desk builds. A
   synthetic ticket is enriched instead and only .smc is copied back. */
function tmSmcScanPass(rows, golden, death){
  try{
    if (!tmSmcOn() || !Array.isArray(rows) || !rows.length) return;
    var i, r, byRows = {};
    for (i = 0; i < rows.length; i++){ if (rows[i] && rows[i].sym) byRows[rows[i].sym] = rows[i].rows4h; }
    /* hg-v1014: golden AND death tickets share the one capped envelope —
       the cap is a compute budget, not a per-desk allowance */
    var tickets = (golden || []).concat(death || []);
    for (i = 0; i < tickets.length && i < TM_SMC_MAX; i++){
      if (tickets[i]) tmSmcMark(tickets[i], byRows[tickets[i].sym]);
    }
    var cands = [];
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      if (!r || r.smc || !r.rows4h || !r.rows4h.length) continue;
      if (r.gate && r.gate.veto) continue;
      if (!tmDirOf(r)) continue;
      if (!(r.gate && r.gate.clean7) && !trendmxConviction(r)) continue;
      cands.push(r);
    }
    /* the limit board's own rank, so the capped slice is the slice this desk
       promotes first rather than an arbitrary universe order */
    cands.sort(function(a, b){
      var ra = ((a.gate && a.gate.clean7) ? 1000 : 0) + Math.abs(a.score) * 10 + ((a.gate && a.gate.gatesPassed) || 0);
      var rb = ((b.gate && b.gate.clean7) ? 1000 : 0) + Math.abs(b.score) * 10 + ((b.gate && b.gate.gatesPassed) || 0);
      return rb - ra;
    });
    for (i = 0; i < cands.length && i < TM_SMC_MAX; i++){
      r = cands[i];
      var dir = tmDirOf(r);
      var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
      if (!tmValidSetup(plan)) continue;
      var syn = { sym: r.sym, dir: dir, entry: plan.entry, stop: plan.stop, t1: plan.t1 };
      tmSmcMark(syn, r.rows4h);
      if (syn.smc) r.smc = syn.smc;
    }
  }catch(e){}
}

/* ---------------- hg-v1012: EVIDENCE LAYER — real taker flow ----------------
   The composite is five reads of the same closes (1D EMA200, the 50/200
   cross, the 4H cascade, the cloud, the ADX point): five ways to agree
   with yourself. This pass adds the read that CANNOT be derived from
   those closes — which side is aggressing the tape. A TREND MATRIX row is
   a multi-day swing claim, and a swing minted into five days of net
   aggressive selling (for a long) is a claim against the crowd that is
   actually hitting the market.

   REAL Binance taker long/short flow only, read on the row's own
   hgDeskBinanceSym twin through hgOmniCvd (omniroute.js) over the last
   TM_FLOW_LOOK 4h windows. The candle-approximated stand-in never speaks
   here — the hg-v1009 rule: it derives from the same closes the composite
   already read, so it is not independent evidence (the caller hands the
   taker series straight through; hgOmniCvd only returns source 'taker'
   when enough real windows were used).

   Flow AGAINST the row's own majority: the row is HELD OFF — capped at
   NEAR (trendmxRowTier), excluded from the LIMIT BOARD and from the
   forward record the board writes (the ledger measures what the desk
   judged tradeable WITH the evidence in hand), and the chip names why.
   Flow WITH: a chip, never a point — the composite's five points stay
   exactly what they were. Fewer than TM_FLOW_MIN_WIN readable windows
   (hg-v1009's floor), a junk ratio series, a missing Binance twin or a
   failed fetch: UNREAD, and what cannot be read demotes nothing (hg-v700).

   ONE PASS PER SCAN over the promoted slice only — the same candidates
   the SMC pass picks (a direction, no gate veto, clean7 or conviction),
   the same rank, capped at the same TM_SMC_MAX-sized slice — paced in
   CHUNK-sized chunks like the universe fetch itself. The matrix holds the
   whole universe; fetching flow for every row would be a hundred calls
   for rows the desk never promotes. Rows are stamped row.flow =
   { verdict: 'with' | 'against' | 'unreadable', delta, bars, divergence,
   sym, why? } and every render path READS the stamp — nothing recomputes
   in a paint loop. The look, the floor and the cap are stated PRIORS, not
   measurements; the forward record's new reads.takerFlowWith mark is how
   the layer earns a measured one. PURE apart from the two readers it
   calls; it reports the counts so the scan line and the tests read the
   same object the scan acted on. */
var TM_FLOW_LOOK = 30;      /* hgOmniCvd's own default look — five days of 4h flow, the horizon a swing row is judged on */
var TM_FLOW_MIN_WIN = 10;   /* hg-v1009's floor: fewer readable windows than this is UNREAD, never a verdict */
var TM_FLOW_MAX = 24;       /* the SMC pass's own cap — flow is fetched for the slice the desk promotes, never the whole universe */

function trendmxFlowScan(rows){
  var out = { with: 0, against: 0, unreadable: 0, scanned: 0, read: 'unavailable' };
  var cvdFn = (typeof W.hgOmniCvd === 'function') ? W.hgOmniCvd : null;
  var tkFn = (typeof W.binanceTakerRatio === 'function') ? W.binanceTakerRatio : null;
  var symFn = (typeof W.hgDeskBinanceSym === 'function') ? W.hgDeskBinanceSym : null;
  if (!cvdFn || !tkFn || !symFn || !Array.isArray(rows) || !rows.length) return Promise.resolve(out);
  var cands = [], i;
  for (i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.rows4h || !r.rows4h.length) continue;
    if (r.gate && r.gate.veto) continue;
    if (!tmDirOf(r)) continue;
    if (!(r.gate && r.gate.clean7) && !trendmxConviction(r)) continue;
    cands.push(r);
  }
  if (!cands.length) return Promise.resolve(out);
  /* the limit board's own rank, so the capped slice is the slice this desk
     promotes first rather than an arbitrary universe order — the SMC
     pass's own ordering, one rank for both reads */
  cands.sort(function(a, b){
    var ra = ((a.gate && a.gate.clean7) ? 1000 : 0) + Math.abs(a.score) * 10 + ((a.gate && a.gate.gatesPassed) || 0);
    var rb = ((b.gate && b.gate.clean7) ? 1000 : 0) + Math.abs(b.score) * 10 + ((b.gate && b.gate.gatesPassed) || 0);
    return rb - ra;
  });
  cands = cands.slice(0, TM_FLOW_MAX);
  out.read = 'taker';
  var idx = 0;
  function oneChunk(){
    var chunk = cands.slice(idx, idx + CHUNK);
    idx += CHUNK;
    return Promise.all(chunk.map(function(r){
      var dir = tmDirOf(r);
      out.scanned++;
      return Promise.resolve().then(function(){
        var bSym = symFn(r);
        if (!bSym){ r.flow = { verdict: 'unreadable', why: 'no Binance twin' }; out.unreadable++; return; }
        return tkFn(bSym, '4h', 120).then(function(tk){
          var series = (tk && Array.isArray(tk.series)) ? tk.series : null;
          if (!series || !series.length){
            r.flow = { verdict: 'unreadable', why: 'no real flow', sym: bSym }; out.unreadable++; return;
          }
          /* no signal-bar slice: a matrix row is minted by THIS scan, so the
             last closed 4h bar IS its judging bar — the windows that exist
             are the windows that had printed */
          var cv = cvdFn(r.rows4h, TM_FLOW_LOOK, { series: series });
          if (!cv || cv.source !== 'taker' || !isFinite(cv.delta) || cv.bars < TM_FLOW_MIN_WIN || cv.delta === 0){
            r.flow = { verdict: 'unreadable', why: 'no real-flow verdict', sym: bSym }; out.unreadable++; return;
          }
          var withDir = (dir === 'long') ? (cv.delta > 0) : (cv.delta < 0);
          r.flow = { verdict: withDir ? 'with' : 'against',
                     delta: Math.round(cv.delta * 100) / 100, bars: cv.bars,
                     divergence: cv.divergence || null, sym: bSym };
          if (withDir) out.with++; else out.against++;
        });
      }).catch(function(){
        try{ r.flow = { verdict: 'unreadable', why: 'fetch failed' }; out.unreadable++; }catch(e2){}
      });
    })).then(function(){
      if (idx < cands.length) return sleepMs(CHUNK_SLEEP_MS).then(oneChunk);
    });
  }
  return oneChunk().then(function(){ return out; }, function(){ return out; });
}

/* The chips — read the verdict the scan stamped, never recompute (the same
   rule as goldscalp's gsTakerFlowChipHtml). bad on AGAINST, ok on WITH,
   neutral on UNREAD (the desk looked and could not read — said, because a
   read that looked and could not speak is different from one that never
   looked), nothing when the stamp is absent (a row outside the promoted
   slice was never judged). Same stamp-with-margin markup as hgSmcChipHtml
   so the chip sits naturally beside it on every card. */
function trendmxFlowChipHtml(r){
  try{
    var f = r && r.flow;
    if (!f || !f.verdict) return '';
    var dir = tmDirOf(r) || '';
    if (f.verdict === 'against'){
      return '<span class="stamp bad" style="margin-left:6px" title="' + escH('trendmx evidence layer (hg-v1012): real Binance taker flow over '
        + (f.bars || '?') + ' 4h windows on ' + (f.sym || 'the Binance twin') + ' reads net against this ' + dir
        + ' (delta ' + (f.delta != null ? f.delta : '?') + ')'
        + (f.divergence ? ' — ' + f.divergence + ' divergence on the tape' : '')
        + '. Held off the LIMIT BOARD, never CLEAN — the row paints, the reason is named.') + '">TAKER FLOW AGAINST · HELD OFF</span>';
    }
    if (f.verdict === 'with'){
      return '<span class="stamp pass" style="margin-left:6px" title="' + escH('trendmx evidence layer (hg-v1012): real Binance taker flow over '
        + (f.bars || '?') + ' 4h windows on ' + (f.sym || 'the Binance twin') + ' backs this ' + dir
        + ' (delta ' + (f.delta != null ? f.delta : '?') + ')'
        + (f.divergence ? ' — ' + f.divergence + ' divergence on the tape' : '')
        + '. Evidence, never a composite point.') + '">TAKER FLOW WITH IT</span>';
    }
    return '<span class="stamp" style="margin-left:6px" title="' + escH('trendmx evidence layer (hg-v1012): '
      + (f.why || 'no real-flow read for this row') + ' — the read cannot speak, and what cannot speak holds nothing off') + '">TAKER FLOW UNREAD</span>';
  }catch(e){ return ''; }
}

/* FUNDING CROWDING — the fundingPct the universe already carried, read
   through the ONE house rule (hg-setup-core.js hgFundingAgainstMark — the
   G4 directional bar — so this chip can never disagree with the ledger's
   fundAgainst mark on the same row). Leaning the same way as the row's
   direction = the crowd is already stacked here = squeeze risk: a caution
   chip, never a gate, the tier unchanged — brain.js's own funding-crowding
   pattern. Absent rule, absent funding or a non-crowded read: no chip. */
function trendmxFundingChipHtml(r){
  try{
    var dir = tmDirOf(r);
    var fp = r && r.fundingPct;
    if (!dir || typeof fp !== 'number' || !isFinite(fp)) return '';
    var markFn = (typeof W.hgFundingAgainstMark === 'function') ? W.hgFundingAgainstMark : null;
    if (!markFn) return '';
    var m = markFn(fp, dir);
    if (!m || m.against !== true) return '';
    return '<span class="stamp" style="margin-left:6px" title="' + escH('funding crowding (hg-v1012, the one rule in hg-setup-core.js): funding '
      + fp.toFixed(4) + '%/interval leans the same way as this ' + dir
      + ' — the crowd is already stacked here, squeeze risk. A caution chip, never a gate, the tier unchanged.') + '">FUNDING CROWDED</span>';
  }catch(e){ return ''; }
}

/* hg-v1042: SESSION PARTICIPATION — the fire bar's volume against ITS OWN
   time-of-day slot (hgSlotMeanVol, the same correction omniroute applies).
   A quiet-hours fire on a strong composite is evidence, never a gate. */
function trendmxSlotChipHtml(r){
  try{
    if (!r || !Array.isArray(r.rows4h) || r.rows4h.length < 21) return '';
    var slotFn = (typeof W.hgSlotMeanVol === 'function') ? W.hgSlotMeanVol : null;
    if (!slotFn) return '';
    var slot = slotFn(r.rows4h, 20);
    if (!slot || !isFinite(slot.mean) || !(slot.mean > 0)) return '';
    var lv = +r.rows4h[r.rows4h.length - 1].v;
    if (!isFinite(lv) || lv <= 0) return '';
    var rv = lv / slot.mean;
    if (rv >= 0.7) return '';
    return '<span class="stamp" style="margin-left:6px" title="' + escH('session participation (hg-v1042): the fire bar traded ' + rv.toFixed(2) + 'x its own time-of-day norm — quiet hours fire on thin participation. Evidence, never a gate.') + '">SESSION THIN</span>';
  }catch(e){ return ''; }
}

/* hg-v1042: DAY-RANGE EXHAUSTION — today's range against the trailing
   20-day mean. A crown at 85%+ consumed is chasing a move already spent. */
function trendmxDayChipHtml(r){
  try{
    if (!r || !Array.isArray(r.rows4h) || r.rows4h.length < 30) return '';
    var days = {}, i, t, key, d;
    for (i = 0; i < r.rows4h.length; i++){
      t = +r.rows4h[i].t; if (!isFinite(t)) continue;
      key = String(Math.floor(t / 86400));
      d = days[key];
      if (!d) days[key] = { hi: r.rows4h[i].h, lo: r.rows4h[i].l };
      else { if (+r.rows4h[i].h > d.hi) d.hi = +r.rows4h[i].h; if (+r.rows4h[i].l < d.lo) d.lo = +r.rows4h[i].l; }
    }
    var keys = Object.keys(days).sort(), ranges = [], k;
    for (i = 0; i < keys.length; i++){
      var dd = days[keys[i]];
      if (dd.hi > dd.lo) ranges.push(dd.hi - dd.lo);
    }
    if (ranges.length < 5) return '';
    var prev = ranges.slice(-21, -1);
    if (!prev.length) return '';
    var mean = 0;
    for (k = 0; k < prev.length; k++) mean += prev[k];
    mean /= prev.length;
    if (!(mean > 0)) return '';
    var pct = Math.round(ranges[ranges.length - 1] / mean * 100);
    if (pct < 85) return '';
    return '<span class="stamp bad" style="margin-left:6px" title="' + escH('day-range exhaustion (hg-v1042): ' + pct + '% of the average daily range already consumed — chasing a move that may be spent. Evidence, never a gate.') + '">DAY ' + pct + '% SPENT</span>';
  }catch(e){ return ''; }
}

/* hg-v1042: ROUND-TRIP COST — fees as R of the stop window (the house
   hgCryptoCostR). A crown whose fees eat over a quarter of its stop is
   COST-HEAVY — the gold ledger measured that cohort to bleed. Evidence,
   never a gate. */
function trendmxCostChipHtml(r, plan){
  try{
    if (!plan || !isFinite(+plan.entry) || !isFinite(+plan.stop)) return '';
    var costFn = (typeof W.hgCryptoCostR === 'function') ? W.hgCryptoCostR : null;
    if (!costFn) return '';
    var costR = costFn(+plan.entry, +plan.stop, 'taker', 'taker');
    if (!isFinite(costR)) return '';
    if (costR > 0.25){
      return '<span class="stamp bad" style="margin-left:6px" title="' + escH('round-trip cost (hg-v1042): fees eat ' + costR.toFixed(2) + 'R of the stop window — COST-HEAVY. The gold ledger measured this cohort to bleed. Evidence, never a gate.') + '">COST-HEAVY ' + costR.toFixed(2) + 'R</span>';
    }
    return '<span class="stamp ok" style="margin-left:6px" title="' + escH('round-trip cost (hg-v1042): ' + costR.toFixed(2) + 'R of the stop window. Evidence, never a gate.') + '">COST ' + costR.toFixed(2) + 'R</span>';
  }catch(e){ return ''; }
}

async function tmLoadCoinDcxContracts(){
  var urls = [
    '/api/coindcx/instruments',
    '/api/proxy?url=' + encodeURIComponent('https://api.coindcx.com/exchange/v1/derivatives/futures/data/active_instruments?margin_currency_short_name[]=USDT')
  ];
  var last = 'coindcx list failed';
  for (var i = 0; i < urls.length; i++){
    try{
      var r = await fetch(urls[i]);
      if (!r || !r.ok){ last = 'HTTP ' + (r ? r.status : '?'); continue; }
      var j = await r.json();
      var list = Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : (j && Array.isArray(j.instruments) ? j.instruments : null));
      if (!list){ last = 'bad shape'; continue; }
      var out = [];
      for (var k = 0; k < list.length; k++){
        var s = String((list[k] && list[k].symbol) ? list[k].symbol : (list[k] || ''));
        if (/^B-[A-Z0-9]+_USDT$/.test(s) && out.indexOf(s) < 0) out.push(s);
      }
      if (out.length) return out;
    }catch(e){ last = (e && e.message) || String(e); }
  }
  throw new Error(last);
}
function tmBinanceTwin(item, tf, n){
  try{
    var base = item && item.base ? String(item.base).toUpperCase() : '';
    if (!base || typeof W.binanceKlines !== 'function') return Promise.resolve([]);
    return W.binanceKlines(base + 'USDT', tf, n).then(function(rows){ return Array.isArray(rows) ? rows : []; }).catch(function(){ return []; });
  }catch(e){ return Promise.resolve([]); }
}
function tmUnreadRow(item){
  return {
    sym: item && item.sym, base: item && item.base, exchange: (item && item.exchange) || 'coindcx',
    alsoOn: item && item.alsoOn, xu: item, score: null, comps: null, freshCross: null, adx: NaN,
    unread: true, price: null, rows4h: null, rows1h: null,
    fundingPct: item && item.fundingPct, turnoverUsd: item && item.turnoverUsd, mark: item && item.mark
  };
}
async function trendmxScanCore(hooks){
  hooks = hooks || {};
/* Map before asking Binance — a venue code means nothing to fapi. This is the
   same defect fixed in desk-scan-universe.js (v431) and brain.js (v450);
   reuse the mapping those export rather than a fifth private copy. When it is
   unavailable the Binance leg is skipped: no usable symbol means no Binance
   data, and inventing one is how this family started. */
  var fetchK = (typeof W.hgDeskFetchKlines === 'function') ? W.hgDeskFetchKlines.bind(W)
    : function(it, tf, n){
        var bSym = (typeof W.hgDeskBinanceSym === 'function')
          ? W.hgDeskBinanceSym(typeof it === 'string' ? { sym: it } : it)
          : (typeof it === 'string' ? it : null);
        return bSym ? W.binanceKlines(bSym, tf, n) : Promise.resolve([]);
      };
  if (typeof W.hgDeskLoadUniverse !== 'function'
      && (typeof W.binancePerpUniverse !== 'function' || typeof W.binanceKlines !== 'function')){
    throw new Error('missing universe layer (hgDeskLoadUniverse or binancePerpUniverse)');
  }
  var uniPack = await W.hgDeskLoadUniverse({ force: true, minTurnover: TURNOVER_FLOOR });
  var items = uniPack.items || [];
  /* hg-v1048/hg-v1074: ALL COINDCX FUTURES - the floored universe drops
     small CoinDCX contracts, so the matrix re-reads the universe at floor 0
     and merges in every CoinDCX future it missed (deduped on venue+sym).
     hg-v1074 reads the RAW CoinDCX leg (hgDeskLoadCoinDCXAll), not the
     deduped merged universe: xuMergeLegs tags one 'exchange' per base and
     the higher-turnover venue wins, so a CoinDCX contract also listed on
     Delta/Startrader was invisible to a ['coindcx'] filter on the merged
     list. Every CoinDCX active_instruments contract now appears regardless.
     The other venues keep their floor. */
  try{
    /* Raw CoinDCX only makes sense when a CoinDCX data source exists
       (xuniverse.js). Guarding on xuCoinDCXRows also avoids a pointless
       second universe fetch on the Binance-only fallback path. */
    if (typeof W.xuCoinDCXRows === 'function' && typeof W.hgDeskLoadCoinDCXAll === 'function'){
      var allPack = await W.hgDeskLoadCoinDCXAll({ force: false, minTurnover: 0, includeUnknown: true });
      var cdcxAll = Array.isArray(allPack.items) ? allPack.items : [];
      var seenU = {};
      for (var ui = 0; ui < items.length; ui++) seenU[String(items[ui].exchange || '') + '|' + String(items[ui].sym || '')] = 1;
      for (var uj = 0; uj < cdcxAll.length; uj++){
        var uitem = cdcxAll[uj];
        var uk = String(uitem.exchange || '') + '|' + String(uitem.sym || '');
        if (!seenU[uk]){ items.push(uitem); seenU[uk] = 1; }
      }
    }
  }catch(eUni){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('trendmx', eUni); }catch(eWu){} }
  /* BATCH 1130 — the instrument list is the source of truth. Every active
     CoinDCX USDT future is on the board, including contracts the merged
     universe dropped because another venue won the base or the $5M floor
     cut them. A symbol already queued is not added twice. */
  try{
    var cdcxSyms = await tmLoadCoinDcxContracts();
    var seenSym = {};
    for (var si = 0; si < items.length; si++) seenSym[String(items[si].sym || '')] = 1;
    for (var ci2 = 0; ci2 < cdcxSyms.length; ci2++){
      var csym = cdcxSyms[ci2];
      if (seenSym[csym]) continue;
      items.push({
        sym: csym,
        base: csym.replace(/^B-/, '').replace(/_USDT$/, ''),
        exchange: 'coindcx',
        turnoverUsd: null, mark: null, fundingPct: null, alsoOn: null
      });
      seenSym[csym] = 1;
    }
    uniPack.cdcxListed = cdcxSyms.length;
  }catch(eCdx){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('trendmx', eCdx); }catch(eW2){} }
  if (!items.length) throw new Error('universe empty' + (uniPack.note ? ' — ' + uniPack.note : ''));
  var results = [], failed = 0;
  for (var i = 0; i < items.length; i += CHUNK){
    var chunk = items.slice(i, i + CHUNK);
    if (typeof hooks.setProg === 'function') hooks.setProg((i + chunk.length) / items.length);
    var rs = await Promise.all(chunk.map(function(item){
      return fetchK(item, '4h', 120).then(function(r4){
          if (r4 && r4.length) return r4;
          return tmBinanceTwin(item, '4h', 120);
        }).then(function(r4){
          if (!r4 || !r4.length) return tmUnreadRow(item);
          return Promise.all([
            fetchK(item, '1d', 260).then(function(r1){ return (r1 && r1.length) ? r1 : tmBinanceTwin(item, '1d', 260); }),
            fetchK(item, '1h', 120).then(function(r1h){ return (r1h && r1h.length) ? r1h : tmBinanceTwin(item, '1h', 120); })
          ]).then(function(rr){
            var r1 = rr[0], r1h = rr[1];
            if (!r1 || !r1.length) return tmUnreadRow(item);
            var ts = trendScore(r1, r4);
            var row = {
              sym: item.sym, base: item.base, exchange: item.exchange || 'binance', alsoOn: item.alsoOn,
              xu: item, score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx,
              rsi: ts.rsi,   /* hg-v1019: the momentum witness rides the row — chips/tier/collector read the stamp, never recompute */
              volDiv: ts.volDiv, volConf: ts.volConf,   /* hg-v1020: the volume witness's stamps, same seam */
              price: r1[r1.length - 1].c, rows4h: r4, rows1h: (r1h && r1h.length) ? r1h : null,
              fundingPct: item.fundingPct, turnoverUsd: item.turnoverUsd, mark: item.mark
            };
            var dir = tmDirOf(row);
            row.gate = dir ? trendmxGateEval(row, dir) : null;
            return row;
          });
        }).catch(function(){ return null; });
    }));
    for (var j = 0; j < rs.length; j++){ if (rs[j]) results.push(rs[j]); else failed++; }
    if (i + CHUNK < items.length) await sleepMs(CHUNK_SLEEP_MS);
  }
  return {
    rows: results, failed: failed, uniLen: uniPack.rawLen || items.length,
    scanned: items.length, at: Date.now(), note: uniPack.note, source: uniPack.source,
    venueCounts: uniPack.venueCounts
  };
}

async function trendmxScan(opts){
  opts = opts || {};
  var maxAge = (opts.maxAgeMs > 0) ? opts.maxAgeMs : (5 * 60 * 1000);
  if (!opts.force && __tmScanSnap && __tmScanSnap.at && (Date.now() - __tmScanSnap.at) < maxAge){
    return __tmScanSnap;
  }
  var core = await trendmxScanCore(opts);
  var golden = trendmxGoldenCrossSetups(core.rows);
  var death = trendmxDeathCrossSetups(core.rows);   /* hg-v1014: the mirrored desk */
  tmSmcScanPass(core.rows, golden, death);
  /* hg-v1012: the evidence layer — one capped, paced pass over the promoted
     slice, AFTER the tier inputs (score/gate/conviction) exist and BEFORE
     the snap the boards read. Never throws; what it cannot read it leaves
     unstamped, and an unstamped row is an unjudged row. */
  var flow = null;
  try{ flow = await trendmxFlowScan(core.rows); }catch(eFl){ flow = null; }
  /* hg-v1067: the shared-perfect evidence pass — the OMNIBTC read stack */
  try{ await trendmxPerfectEvidencePass(core.rows); }catch(ePf3){ }
  __tmScanSnap = {
    at: core.at, rows: core.rows, failed: core.failed, uniLen: core.uniLen, scanned: core.scanned,
    goldenCross: golden, deathCross: death, note: core.note, source: core.source, venueCounts: core.venueCounts,
    flow: flow
  };
  publishTrendmxSnap(core.rows);
  return __tmScanSnap;
}

async function trendmxWarm(opts){
  try{
    var r = await trendmxScan({ force: !!(opts && opts.force) });
    if (r && r.rows && r.rows.length) return 'warmed';
    return 'unavailable: trend matrix scan returned no rows';
  }catch(e){ return 'error: ' + ((e && e.message) || e); }
}

function trendmxCompPipsHtml(comps){
  comps = comps || {};
  return ''
    + '<span class="gpip ' + (comps.d1Trend > 0 ? 'ok' : (comps.d1Trend < 0 ? 'bad' : '')) + '" title="1D trend">1D</span>'
    + '<span class="gpip ' + (comps.d1Cross > 0 ? 'ok' : (comps.d1Cross < 0 ? 'bad' : '')) + '" title="EMA cross">X</span>'
    + '<span class="gpip ' + (comps.h4Cascade > 0 ? 'ok' : (comps.h4Cascade < 0 ? 'bad' : '')) + '" title="4H cascade">4H</span>'
    + '<span class="gpip ' + (comps.cloud > 0 ? 'ok' : (comps.cloud < 0 ? 'bad' : '')) + '" title="Cloud">CL</span>'
    + '<span class="gpip ' + (comps.adxPt !== 0 ? 'ok' : '') + '" title="ADX strength">ADX</span>';
}

function trendmxRowTier(r, plan){
  if (!r) return 'forming';
  if (plan && plan.omniDemoted) return 'near';
  if (r.gate && r.gate.veto) return 'forming';
  /* hg-v1012: real taker flow AGAINST the row's own majority caps the row
     at NEAR — it paints, the chip names why, it can never be CLEAN or sit
     on the LIMIT BOARD (the same leadership pattern as the omni principal
     above it). An unread flow caps nothing. */
  if (r.flow && r.flow.verdict === 'against') return 'near';
  /* hg-v1019: the momentum witness caps the same way — a row whose 1D RSI
     range has TURNED against its direction can never be CLEAN. An unread
     or abstaining witness caps nothing. */
  if (trendmxMomState(r, tmDirOf(r)) === 'against') return 'near';
  /* hg-v1020: and the volume witness — a swing rally the OBV trend refuses
     to confirm (or a fall it refuses to join) caps at NEAR the same way. */
  if (trendmxVolState(r, tmDirOf(r)) === 'against') return 'near';
  /* hg-v1034: the fundamental + sentiment witness caps the same way — a row
     whose coin sits in a red-folder blackout (refuse) or against a 2+ net
     checked headwind (against) can never be CLEAN. */
  var fundSt = trendmxFundState(r, tmDirOf(r));
  if (fundSt === 'refuse' || fundSt === 'against') return 'near';
  /* hg-v1057: the trend-quality witness caps the same way — a row whose own
     4h tape is CHOPPY (Choppiness >= 61.8 AND Efficiency Ratio < 0.3, the two
     instruments agreeing) can never be CLEAN: this desk trades trends and
     that tape has none to ride. Mixed or unreadable caps nothing (fail open
     — one instrument alone is not a verdict). */
  var chopSt = trendmxChopState(r);
  if (chopSt && chopSt.state === 'chop') return 'near';
  if (plan && tmValidSetup(plan) && r.gate && r.gate.clean7) return 'clean';
  if (r.gate && r.gate.nearClean) return 'near';
  return 'forming';
}

function trendmxSummaryLine(rows, golden, venueCounts){
  rows = rows || [];
  golden = golden || [];
  var sl = 0, ss = 0, fx = 0, clean = 0, near = 0, flowW = 0, flowA = 0;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r) continue;
    if (r.score >= 4) sl++;
    if (r.score <= -4) ss++;
    if (r.freshCross) fx++;
    /* hg-v1012: the flow split, read off the stamps the scan left — the
       summary names the evidence the same way the cards do */
    if (r.flow && r.flow.verdict === 'with') flowW++;
    else if (r.flow && r.flow.verdict === 'against') flowA++;
    var dir = tmDirOf(r);
    var plan = dir ? trendmxPlan(Object.assign({}, r, { dir: dir })) : null;
    var tier = trendmxRowTier(r, plan);
    if (tier === 'clean') clean++;
    else if (tier === 'near') near++;
  }
  var vc = venueCounts || {};
  var cdxN = 0;
  for (var ci = 0; ci < rows.length; ci++) if (rows[ci] && String(rows[ci].exchange || '').toLowerCase() === 'coindcx') cdxN++;
  var ven = ' · Δ' + (vc.delta || 0) + ' · CDX ' + cdxN + ' contracts · BN' + (vc.binance || 0);
  return 'scanned ' + rows.length + ven
    + ' · golden ' + golden.length
    + ' · strong +' + sl + '/−' + ss + ' · fresh crosses ' + fx
    + ' · CLEAN ' + clean + ' · NEAR ' + near
    + ((flowW + flowA) > 0 ? ' · taker flow ' + flowW + ' with / ' + flowA + ' held off' : '');
}

/* hg-v1014: one card serves both cross kinds — golden (bull, green) and
   death (bear, red). The stamp, the strategy tag and the palette read the
   ticket's own freshCross/dir; everything else is identical, because the
   desks are the same bar in both directions. */
function trendmxCrossCardHTML(g){
  if (!g || !fin(+g.entry) || !fin(+g.stop) || !fin(+g.t1)) return '';
  var isDeath = (g.freshCross === 'DEATH') || (g.dir === 'short');
  var col = isDeath ? '#b91c1c' : '#047857';
  var strat = isDeath ? 'trendmx-death' : 'trendmx-golden';
  var tradeOn = (typeof hgToTradePlanOnclickAttr === 'function')
    ? hgToTradePlanOnclickAttr(g.sym, g.dir, g.entry, g.stop, g.t1, { t2: g.t2, scanner: 'trendmx', strategy: strat })
    : '';
  var tradeBtn = tradeOn ? '<button class="toTrade" onclick="' + tradeOn + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (typeof bookBtnHTML === 'function')
    ? bookBtnHTML(g.sym, g.dir, g.entry, g.stop, g.t1, { scanner: 'trendmx', strategy: strat, t2: g.t2 }) : '';
  return '<div style="flex:1 1 280px;max-width:380px;border:1px solid ' + (isDeath ? 'rgba(185,28,28,.45)' : 'rgba(5,150,105,.45)') + ';border-left:4px solid ' + col + ';border-radius:8px;padding:12px;background:' + (isDeath ? 'rgba(185,28,28,.06)' : 'rgba(5,150,105,.06)') + '">'
    + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">'
    + '<span style="font-size:14px;font-weight:800">' + escH(g.sym) + tmVenueChip(g) + '</span>'
    + '<span class="stamp ' + (isDeath ? 'bad' : 'pass') + '">' + (isDeath ? '⚡DEATH' : '⚡GOLDEN') + '</span>'
    + '<span class="stamp pass">' + escH(g.conviction || g.tier || 'CONVICTION') + '</span>'
    + '<span class="stamp ' + (isDeath ? 'bad' : 'pass') + '">' + (isDeath ? 'SHORT' : 'LONG') + '</span>'
    + tmSmcChip(g)
    + '</div>'
    + '<div style="margin-top:6px;font-size:10px;color:#64748B">' + escH(g.note || '') + '</div>'
    + '<div style="font-size:22px;font-weight:800;color:' + col + ';margin-top:6px">' + pxFmt(g.entry) + '</div>'
    + '<div class="plan" style="margin-top:6px">' + trendmxPlanHTML(g) + '</div>'
    + tradeBtn + bookBtn
    + '</div>';
}

/* hg-v1015: TWO CROSS DESKS — the v1014 combined panel is split at the
   operator's ask: the bull desk and the bear desk stand on their own, each
   its own panel, its own palette, its own sub-line. The card renderer
   stays the shared dir-aware one (hg-v1014); a desk differs only in which
   bag it renders. The 4-card cap is the cap each half already had — the
   split changes no exposure. A desk with no tickets renders nothing. */
function trendmxGoldenDeskHTML(golden){
  golden = golden || [];
  if (!golden.length) return '';
  var cards = '';
  for (var i = 0; i < Math.min(golden.length, 4); i++) cards += trendmxCrossCardHTML(golden[i]);
  return '<div class="panel tier-clean" style="margin:12px 0;border-left:4px solid #047857">'
    + '<h2>⚡ GOLDEN CROSS DESK <span>EMA50/200 BULL cross ≤10 daily bars — fresh LONGS · conviction + valid plan · Telegram every 15m</span></h2>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cards + '</div>'
    + '</div>';
}

function trendmxDeathDeskHTML(death){
  death = death || [];
  if (!death.length) return '';
  var cards = '';
  for (var i = 0; i < Math.min(death.length, 4); i++) cards += trendmxCrossCardHTML(death[i]);
  return '<div class="panel" style="margin:12px 0;border-left:4px solid #b91c1c">'
    + '<h2>⚡ DEATH CROSS DESK <span>EMA50/200 BEAR cross ≤10 daily bars — fresh SHORTS · conviction + valid plan · Telegram every 15m</span></h2>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cards + '</div>'
    + '</div>';
}

function trendmxLimitCardHTML(item){
  if (!item || !item.plan) return '';
  var p = item.plan, r = item.row, dir = item.dir;
  var col = dir === 'long' ? '#047857' : '#dc2626';
  var stHtml = '';
  if (typeof hgLimitState === 'function'){
    var a = (r.rows4h && typeof atr === 'function') ? atr(r.rows4h, TM_ATR_LEN) : null;
    var atrL = (a && a.length) ? a[a.length - 1] : NaN;
    var st = hgLimitState(p, r.price, atrL);
    if (st && st.label) stHtml = '<span class="stamp" style="margin-left:6px">' + escH(st.label) + '</span>';
  }
  var tradeOn = (typeof hgToTradePlanOnclickAttr === 'function')
    ? hgToTradePlanOnclickAttr(r.sym, dir, p.entry, p.stop, p.t1, { t2: p.t2, stack: item.stack, scanner: 'trendmx', strategy: 'trendmx' }) : '';
  /* hg-v1018: the card names its own formation class — the desks are
     separated by criteria now, and the stamp keeps the class legible where
     a card is screenshotted or shared off the desk. */
  /* hg-v1022: a PERFECT row carries its own stamp ahead of the class stamp —
     the strictest confluence read, distinguished so it survives a screenshot. */
  var perfectStamp = item.perfect
    ? '<span class="stamp pass" style="margin-left:6px;background:#fef3c7;color:#92400e">\u2605 PERFECT</span>'
    : '';
  var clsStamp = (r.gate && r.gate.clean7)
    ? '<span class="stamp" style="margin-left:6px">GATE-CLEAN 7/7</span>'
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
      + col('MIXED / CHOP', '#94a3b8', '', mixedS, 'no mixed rows')
      + '</div>';
  }catch(e){ return ''; }
}

/* hg-v1048: the COINDCX TRENDING / FORMING board - every CoinDCX future
   the matrix scanned, in two columns. TRENDING = the composite has a
   majority direction (|score| >= 2); FORMING = it does not yet. Both
   print TP/SL: minted ticket levels where the plan exists (7/7 CLEAN /
   6/7 NEAR), the house DRAFT ladder where it does not. */
function trendmxTrendFormHTML(rows){
  try{
    if (!Array.isArray(rows) || !rows.length) return '<div class="empty">Run a scan to classify the CoinDCX board.</div>';
    var cdcx = [];
    for (var i = 0; i < rows.length; i++){
      if (rows[i] && String(tmRowVenue(rows[i])).toLowerCase() === 'coindcx') cdcx.push(rows[i]);
    }
    if (!cdcx.length) return '<div class="empty">No CoinDCX rows on this board.</div>';
    var trending = [], forming = [];
    for (i = 0; i < cdcx.length; i++){
      var r = cdcx[i];
      if (tmDirOf(r)) trending.push(r); else forming.push(r);
    }
    function byStrength(list){ return list.slice().sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); }); }
    /* typeof guard, not bare isFinite: isFinite(null) is TRUE and +null is 0,
       so a null plan level would print a confident "0" (the null-formatting
       trap this codebase has hit five times). */
    function px(v){ return (typeof v === 'number' && isFinite(v)) ? String(v) : '--'; }
    function lvlLine(rr, dd){
      var plan = dd ? trendmxPlan(Object.assign({}, rr, { dir: dd })) : null;
      if (plan){
        var tier = trendmxRowTier(rr, plan);
        var lvl = 'ENTRY ' + px(plan.entry) + ' - STOP ' + px(plan.stop) + ' - T1 ' + px(plan.t1)
          + (isFinite(plan.t2) ? ' - T2 ' + px(plan.t2) : '');
        /* hg-v1048: the tier is the label — 7/7 CLEAN and 6/7 NEAR are the
           minted tiers; anything below the NEAR floor (or a forming row with
           no majority, whose gate is null) is the house DRAFT ladder, never
           a fabricated 6/7 NEAR. */
        if (tier === 'clean') return lvl + ' - 7/7 CLEAN';
        if (tier === 'near'){
          var gates = (rr.gate && isFinite(rr.gate.gatesPassed)) ? rr.gate.gatesPassed : 0;
          return lvl + ' - ' + gates + '/7 NEAR';
        }
        return lvl + ' - DRAFT';
      }
      return 'no levels - the gates have not met';
    }
    function cell(rr){
      var dd = tmDirOf(rr);
      var lean = dd ? 0 : (+rr.score > 0 ? 1 : (+rr.score < 0 ? -1 : 0));
      var tag = dd === 'long' ? '<span class="pos">LONG</span>'
        : dd === 'short' ? '<span class="neg">SHORT</span>'
        : lean === 1 ? '<span class="pos">LONG-LEAN</span>'
        : lean === -1 ? '<span class="neg">SHORT-LEAN</span>'
        : '<span>NO LEAN</span>';
      /* hg-v1057: the FORMING column names WHY nothing formed — a choppy tape
         is CHOP (no trend to ride, whatever the lean), a clean directional
         tape with a lean but no majority is EARLY FORMING, and a mixed tape
         prints neither (no verdict). The TRENDING column is untouched: its
         rows already have a majority. */
      var formTag = '';
      if (!dd){
        var fs = trendmxChopState(rr);
        if (fs && fs.state === 'chop') formTag = ' · CHOP';
        else if (fs && fs.state === 'trend') formTag = ' · EARLY FORMING';
      }
      var lvl = (dd || lean !== 0) ? lvlLine(rr, dd || (lean === 1 ? 'long' : 'short'))
        : 'no lean - composite 0/5, no levels';
      if (rr.unread){
        return '<div class="card" style="padding:8px;margin-bottom:6px"><b>' + escH(rr.sym) + '</b> <span>UNREAD</span>'
          + '<div style="opacity:.9;font-size:11px;margin-top:2px">CoinDCX contract on the board. No candle series, so no setup.</div></div>';
      }
      return '<div class="card" style="padding:8px;margin-bottom:6px"><b>' + escH(rr.sym) + '</b> ' + tag
        + '<div style="opacity:.9;font-size:11px;margin-top:2px">composite ' + (rr.score > 0 ? '+' : '') + rr.score + '/5' + formTag + (rr.freshCross ? ' - !' + escH(rr.freshCross) : '') + '</div>'
        + '<div style="font-size:11px;margin-top:4px;letter-spacing:.02em">' + lvl + '</div></div>';
    }
    function col(title, cls, list, emptyTxt){
      var h = '<div class="panel" style="border-top:3px solid ' + cls + '"><h3 style="margin:0 0 8px">' + title
        + ' <span style="opacity:.6;font-weight:400">- ' + list.length + ' contract' + (list.length === 1 ? '' : 's') + '</span></h3>';
      if (!list.length) h += '<div class="empty" style="margin:6px 0">' + emptyTxt + '</div>';
      else h += list.map(cell).join('');
      return h + '</div>';
    }
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;align-items:start">'
      + col('TRENDING', '#26a69a', byStrength(trending), 'no trending CoinDCX contracts - composite below +/-2')
      + col('FORMING', '#f59e0b', byStrength(forming), 'no forming CoinDCX contracts')
      + '</div>';
  }catch(e){ return ''; }
}

/* hg-v1069: the grid-setup block — the OMNIBTC dual-grid treatment on
   the matrix crown: each grid stands on its own direction, tier and
   levels, and a grid that disagrees with the call is stamped, never
   hidden. */
function trendmxGridBlockHtml(title, gridLbl, s, callDir){
  try{
    if (!s || !isFinite(+s.entry) || !isFinite(+s.stop) || !isFinite(+s.t1)) return '';
    var dir = String(s.dir || '').toLowerCase();
    var against = dir && callDir && dir !== callDir;
    var risk = Math.abs(+s.entry - +s.stop);
    var rr = risk > 0 ? Math.abs(+s.t1 - +s.entry) / risk : NaN;
    var tierTxt = s.tier === 'CLEAN' ? '7/7 CLEAN' : (s.tier === 'NEAR' ? (s.gates != null ? s.gates + '/7 NEAR' : '6/7 NEAR') : 'DRAFT');
    var color = dir === 'long' ? '#26a69a' : (dir === 'short' ? '#ef5350' : '#94a3b8');
    return '<div class="panel" style="margin-top:10px;border-top:3px solid ' + color + '"><h3>' + title
      + ' <span>' + gridLbl + ' - ' + tierTxt + (s.source ? ' - ' + escH(s.source) : '') + (against ? ' - AGAINST THE CALL' : '') + '</span></h3>'
      + '<div class="kv"><span class="k">Bias</span><span class="v ' + (dir === 'long' ? 'pos' : 'neg') + '">' + dir.toUpperCase() + '</span></div>'
      + '<div class="kv"><span class="k">ENTRY</span><span class="v">' + (+s.entry).toFixed(2) + '</span></div>'
      + '<div class="kv"><span class="k">STOP</span><span class="v">' + (+s.stop).toFixed(2) + '</span></div>'
      + '<div class="kv"><span class="k">T1</span><span class="v">' + (+s.t1).toFixed(2) + (isFinite(rr) ? ' (' + rr.toFixed(1) + 'R)' : '') + '</span></div>'
      + (isFinite(+s.t2) ? '<div class="kv"><span class="k">T2</span><span class="v">' + (+s.t2).toFixed(2) + '</span></div>' : '')
      + '</div>';
  }catch(e){ return ''; }
}

/* hg-v1066: THE CROWN — the OMNIBTC treatment on the TREND MATRIX: a
   single bold call (the strongest majority row with a minted plan), a
   verdict line, the five-dimension complete analysis from the row's own
   reads plus the world tilt, the setup card with the automation JSON,
   and the measured-edge chip for the TRENDMX pool. Evidence, never a
   gate. */
function trendmxCrownPanelHTML(state){
  try{
    state = state || {};
    var rows = Array.isArray(state.rows) ? state.rows.slice() : [];
    if (!rows.length) return '';
    rows.sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); });
    var crown = null, plan = null, dir = null, i, r, d;
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      d = tmDirOf(r);
      if (!d) continue;
      var p = trendmxPlan(Object.assign({}, r, { dir: d }));
      if (p){ crown = r; plan = p; dir = d; break; }
    }
    if (!crown || !plan) return '';
    var tier = trendmxRowTier(crown, plan);
    var tierTxt = tier === 'clean' ? 'TICKET' : (tier === 'near' ? 'WATCH' : 'LEADER');
    var conv = trendmxConviction(crown);
    var color = dir === 'long' ? '#26a69a' : (dir === 'short' ? '#ef5350' : '#94a3b8');
    var html = '';
    /* ---- THE CALL ---- */
    html += '<div class="panel" style="margin-top:10px;border-top:3px solid ' + color + '"><h3>THE CALL</h3>'
      + '<div style="font-size:16px;font-weight:700">' + dir.toUpperCase() + ' - ' + tierTxt
      + ' - composite ' + (crown.score > 0 ? '+' : '') + crown.score + '/5'
      + (conv ? ' - ' + conv.label : '') + '</div></div>';
    /* ---- VERDICT ---- */
    var gatesTxt = (crown.gate && isFinite(crown.gate.gatesPassed)) ? crown.gate.gatesPassed + '/7' : '?/7';
    html += '<div class="panel" style="margin-top:10px"><h3>CROWN VERDICT <span>the desk\'s complete verdict on the leading row</span></h3>'
      + '<div style="font-size:12px;letter-spacing:.03em">TREND MATRIX | ' + tierTxt
      + (crown.perfectPlus ? ' | PERFECT+' : (crown.perfect ? ' | PERFECT' : '')) + ' | gates ' + gatesTxt + '</div></div>';
    /* ---- COMPLETE ANALYSIS ---- */
    var comps = crown.comps || {};
    function chip(v, cls){ return '<span class="gpip' + (cls || '') + '">' + escH(v) + '</span>'; }
    function dim(title, verdict, cls, lines){
      if (!lines.length) return '';
      return '<div style="margin:8px 0 2px"><b>' + title + '</b> ' + chip(verdict, cls)
        + '<div style="font-size:11px;opacity:.9;margin-top:2px">' + lines.join(' | ') + '</div></div>';
    }
    var tech = [];
    if (comps.d200 !== undefined && comps.d200 !== null) tech.push('1D vs EMA200 ' + (comps.d200 > 0 ? 'BULL' : 'BEAR'));
    if (comps.x !== undefined && comps.x !== null) tech.push('EMA50/200 ' + (comps.x > 0 ? 'GOLDEN' : 'DEATH'));
    if (comps.h4 !== undefined && comps.h4 !== null) tech.push('4H cascade ' + (comps.h4 > 0 ? 'bull' : 'bear'));
    if (comps.cloud !== undefined && comps.cloud !== null) tech.push('cloud ' + (comps.cloud > 0 ? 'above' : 'below'));
    if (isFinite(+crown.adx)) tech.push('ADX ' + (+crown.adx).toFixed(1));
    html += '<div class="panel" style="margin-top:10px"><h3>COMPLETE ANALYSIS <span>technical - sentimental - fundamental - macro - micro</span></h3>';
    html += dim('TECHNICAL', Math.abs(+crown.score || 0) >= 2 ? 'ALIGNED' : 'NEUTRAL', '', tech);
    var sent = [];
    if (isFinite(+crown.fundingPct)) sent.push('funding ' + (+crown.fundingPct).toFixed(4) + '%');
    if (crown.flow) sent.push('flow ' + escH(String(crown.flow)));
    html += dim('SENTIMENTAL', sent.length ? 'NEUTRAL' : 'UNREAD', '', sent);
    var fund = [];
    if (crown.fundState) fund.push(escH(String(crown.fundState)));
    html += dim('FUNDAMENTAL', fund.length ? 'NEUTRAL' : 'UNREAD', '', fund);
    var mac = [], mTilt = 'UNREAD', mCls = '';
    try{
      var wm = (typeof W.getWorldMonitorDeskCached === 'function') ? W.getWorldMonitorDeskCached() : null;
      var rg = (typeof W.regimeState === 'function') ? W.regimeState() : null;
      if (wm && wm.macro && wm.macro.verdict) mac.push('WM ' + String(wm.macro.verdict).toUpperCase());
      if (wm && wm.stress && wm.stress.label) mac.push('stress ' + String(wm.stress.label).toUpperCase());
      if (rg && rg.playbook && rg.playbook.bias) mac.push('bias ' + String(rg.playbook.bias).toUpperCase());
      if (rg && rg.dxy && (rg.dxy.trend20 || rg.dxy.trend)) mac.push('DXY ' + String(rg.dxy.trend20 || rg.dxy.trend).toUpperCase());
      if (mac.length){
        var off = (wm && wm.macro && (wm.macro.verdict === 'SELL' || wm.macro.verdict === 'AVOID'))
          || (rg && rg.playbook && rg.playbook.bias === 'STAND-ASIDE')
          || (wm && wm.stress && /HIGH|ELEVATED/i.test(String(wm.stress.label)));
        mTilt = off ? 'RISK-OFF' : ((wm && wm.macro && wm.macro.verdict === 'BUY') ? 'RISK-ON' : 'NEUTRAL');
        if (mTilt === 'RISK-OFF') mCls = ' bad';
      }
    }catch(eWm){ }
    try{
      var wmAtT = (typeof W.getWorldMonitorDeskAge === 'function') ? W.getWorldMonitorDeskAge() : null;
      if (wmAtT) mac.push('WM ' + Math.max(0, Math.round((Date.now() - wmAtT) / 60000)) + 'm old');
      if (rg && rg.at) mac.push('regime ' + Math.max(0, Math.round((Date.now() - +rg.at) / 60000)) + 'm old');
    }catch(eAge){ }
    mac.push('world tilt ' + mTilt);
    html += dim('MACRO', mTilt, mCls, mac);
    var mic = [];
    var risk = Math.abs(+plan.entry - +plan.stop);
    if (risk > 0 && isFinite(+plan.t1)) mic.push('R:R ' + (Math.abs(+plan.t1 - +plan.entry) / risk).toFixed(1) + 'R');
    if (typeof hgCryptoCostR === 'function' && isFinite(+plan.entry) && isFinite(+plan.stop)){
      var costR = hgCryptoCostR(+plan.entry, +plan.stop, 'taker', 'taker');
      if (isFinite(costR)) mic.push('cost ' + costR.toFixed(2) + 'R' + (costR > 0.25 ? ' - COST-HEAVY' : ''));
    }
    if (isFinite(+crown.price) && isFinite(+plan.entry)) mic.push('mark dist ' + (((+crown.price - +plan.entry) / +plan.entry) * 100).toFixed(1) + '%');
    if (Array.isArray(crown.rows4h) && crown.rows4h.length >= 45 && typeof hgFillProbability === 'function' && isFinite(+plan.entry)){
      try{ var fp = hgFillProbability(crown.rows4h, +plan.entry, dir, null, 12); if (fp && fp.pct != null && isFinite(fp.pct)) mic.push('fill odds ' + Math.round(fp.pct) + '%'); }catch(eFp){ }
    }
    if (Array.isArray(crown.rows4h) && crown.rows4h.length >= 45 && isFinite(+plan.entry) && isFinite(+plan.stop)){
      try{
        var rp = Math.abs(+plan.entry - +plan.stop); var sweeps = 0;
        for (var si2 = crown.rows4h.length - 40; si2 < crown.rows4h.length; si2++){
          var sb = crown.rows4h[si2]; if (!sb) continue;
          if (dir === 'long' && (+sb.l || 0) <= +plan.entry - rp) sweeps++;
          else if (dir === 'short' && (+sb.h || 0) >= +plan.entry + rp) sweeps++;
        }
        mic.push('stop sensitivity ' + sweeps + '/40');
      }catch(eSw2){ }
    }
    html += dim('MICRO', mic.length ? 'NEUTRAL' : 'UNREAD', '', mic);
    html += '</div>';
    /* ---- ANCHOR (day VWAP + Bollinger on the row's own tape) ---- */
    var anchorHtml = '';
    try{
      if (Array.isArray(crown.rows4h) && crown.rows4h.length >= 30 && typeof hgAVWAP === 'function' && typeof bollinger === 'function'){
        var anIdx = Math.max(0, crown.rows4h.length - 6);
        var av = hgAVWAP(crown.rows4h, anIdx);
        var cArr = crown.rows4h.map(function(x){ return x.c; });
        var bb = bollinger(cArr, 20, 2);
        var lastC = +crown.rows4h[crown.rows4h.length - 1].c;
        if (av && isFinite(+av.value) && bb && bb.widthPct){
          var devPct = (lastC - +av.value) / +av.value * 100;
          var wNow = +bb.widthPct[bb.widthPct.length - 1];
          var wPrev = bb.widthPct.slice(-21, -1).filter(isFinite);
          var wAvg = wPrev.length ? wPrev.reduce(function(a, b){ return a + b; }, 0) / wPrev.length : NaN;
          var bbState = isFinite(wAvg) ? (wNow < 0.85 * wAvg ? 'SQUEEZE' : (wNow > 1.3 * wAvg ? 'EXPANSION' : 'NORMAL')) : null;
          anchorHtml = '<div class="panel" style="margin-top:10px"><h3>ANCHOR <span>day VWAP + Bollinger on the row\'s own tape - evidence, never a gate</span></h3>'
            + '<div class="kv"><span class="k">VWAP (1 day, 4h)</span><span class="v">' + (+av.value).toFixed(2) + ' - price ' + (devPct >= 0 ? '+' : '') + devPct.toFixed(2) + '% from it</span></div>'
            + '<div class="kv"><span class="k">Bollinger (20,2)</span><span class="v">' + (bbState || 'UNREAD') + (isFinite(wNow) ? ' (width ' + wNow.toFixed(2) + '% vs trailing ' + (isFinite(wAvg) ? wAvg.toFixed(2) : '--') + '%)' : '') + (bbState === 'SQUEEZE' ? ' - compression precedes expansion' : '') + '</span></div>'
            + '</div>';
        }
      }
    }catch(eAn){ }
    html += anchorHtml;
    /* ---- SETUP CARD ---- */
    var aArr = (typeof W.atr === 'function' && Array.isArray(crown.rows4h)) ? W.atr(crown.rows4h, 14) : null;
    var aV = (aArr && aArr.length) ? +aArr[aArr.length - 1] : NaN;
    var thesis = 'structure: composite ' + (crown.score > 0 ? '+' : '') + crown.score + '/5 across the 1D/4H legs'
      + (crown.freshCross ? ' with a fresh ' + crown.freshCross + ' cross' : '')
      + '; context: ' + (isFinite(+crown.adx) ? 'ADX ' + (+crown.adx).toFixed(1) : 'ADX UNREAD')
      + (isFinite(+crown.fundingPct) ? ' and funding ' + (+crown.fundingPct).toFixed(4) + '%' : '') + '.';
    var tp3Txt = isFinite(aV) ? ((dir === 'long' ? +plan.entry + 6.5 * aV : +plan.entry - 6.5 * aV).toFixed(2) + ' (EXTENSION - not graded)') : 'n/a';
    var venue = tmRowVenue(crown);
    var payload = { v: 1, id: 'TMX-' + String(crown.sym), venue: venue, symbol: crown.sym,
      side: dir, entry: +plan.entry, stop: +plan.stop, t1: +plan.t1, t2: isFinite(+plan.t2) ? +plan.t2 : null,
      gates: gatesTxt, formation: tier === 'clean' ? 'CLEAN' : 'WATCH_ONLY', measured: 'UNREAD',
      exitPolicy: 'scale50_t1_be_trail', ts: Math.floor(Date.now() / 1000) };
    var jsonTxt = JSON.stringify(payload, null, 2);
    html += '<div class="panel" style="margin-top:10px"><h3>SETUP CARD <span>the OMNIBTC template on the matrix crown</span></h3>'
      + '<div class="kv"><span class="k">Market Thesis</span><span class="v">' + escH(thesis) + '</span></div>'
      + '<div class="kv"><span class="k">Bias</span><span class="v ' + (dir === 'long' ? 'pos' : 'neg') + '">' + dir.toUpperCase() + '</span></div>'
      + '<div class="kv"><span class="k">Entry Zone</span><span class="v">[' + (+plan.entry).toFixed(2) + ']' + (isFinite(aV) ? ' +/- ' + (0.25 * aV).toFixed(2) : '') + '</span></div>'
      + '<div class="kv"><span class="k">Invalidation (SL)</span><span class="v">' + (+plan.stop).toFixed(2) + '</span></div>'
      + '<div class="kv"><span class="k">Targets (TP)</span><span class="v">TP1 ' + (+plan.t1).toFixed(2) + ' | TP2 ' + (isFinite(+plan.t2) ? (+plan.t2).toFixed(2) : 'n/a') + ' | TP3 ' + tp3Txt + '</span></div>'
      + '<div class="kv"><span class="k">Automation Blueprint</span><span class="v"><pre style="margin:4px 0;white-space:pre-wrap;font-size:10px">' + escH(jsonTxt) + '</pre>' + (tier === 'clean' ? '' : '<div class="note warn" style="margin-top:4px">formation WATCH_ONLY - the bridge must drop this payload.</div>') + '</span></div>'
      + '</div>';
    /* ---- the dual grid setups, OMNIBTC style ---- */
    var swingS = { dir: dir, entry: +plan.entry, stop: +plan.stop, t1: +plan.t1, t2: isFinite(+plan.t2) ? +plan.t2 : null,
      tier: tier === 'clean' ? 'CLEAN' : 'NEAR', gates: (crown.gate && isFinite(crown.gate.gatesPassed)) ? crown.gate.gatesPassed : null };
    html += trendmxGridBlockHtml('SWING SETUP', '4h grid', swingS, dir);
    var scalpS = null, altS = null;
    if (Array.isArray(crown.rows1h) && crown.rows1h.length >= 60 && typeof W.atr === 'function'){
      var a1arr = W.atr(crown.rows1h, 14);
      var a1 = (a1arr && a1arr.length) ? +a1arr[a1arr.length - 1] : NaN;
      var p1 = +crown.rows1h[crown.rows1h.length - 1].c;
      if (isFinite(a1) && a1 > 0 && isFinite(p1)){
        function tmxLadder(side){
          return { dir: side, entry: p1, stop: side === 'long' ? p1 - 1.5 * a1 : p1 + 1.5 * a1,
            t1: side === 'long' ? p1 + 3.5 * a1 : p1 - 3.5 * a1,
            t2: side === 'long' ? p1 + 4.9 * a1 : p1 - 4.9 * a1,
            tier: 'DRAFT', gates: null, source: '1h draft ladder ATR14' };
        }
        scalpS = tmxLadder(dir);
        altS = tmxLadder(dir === 'long' ? 'short' : 'long');
      }
    }
    html += trendmxGridBlockHtml('SCALP SETUP', '1h grid', scalpS, dir);
    html += trendmxGridBlockHtml('SCALP SETUP - ALT SIDE', '1h grid', altS, dir);
    /* ---- MEASURED EDGE ---- */
    try{
      if (typeof W.hgProvenEdgeVerdict === 'function'){
        var v = W.hgProvenEdgeVerdict('trendmx', 'TRENDMX', { pool: 'TRENDMX', mechanic: 'TRENDMX' });
        if (v && typeof W.hgProvenEdgeChipHtml === 'function'){
          html += '<div class="panel" style="margin-top:10px"><h3>MEASURED EDGE <span>the TRENDMX pool\'s settled record</span></h3>'
            + W.hgProvenEdgeChipHtml(v) + '</div>';
        }
      }
    }catch(eMe){ }
    return html;
  }catch(e){ return ''; }
}

/* hg-v1067: THE SHARED PERFECT EVIDENCE PASS — the SAME reads bag and
   the SAME enrichment + predicate OMNIBTC consumes (hgObtcPerfectFormation),
   fed by the SAME external data (real Binance taker flow, Binance funding,
   ATR percentile regime, EMA50/200 structure, session RVOL, the news
   calendar), applied to the matrix's strongest rows. PERFECT / PERFECT+
   on a matrix row now means byte-identically what it means on OMNIBTC.
   Evidence, never a gate. */
function tmStructureDir(rows){
  try{
    if (!Array.isArray(rows) || rows.length < 210 || typeof W.ema !== 'function') return null;
    var c = rows.map(function(x){ return x.c; });
    var e50 = W.ema(c, 50), e200 = W.ema(c, 200);
    if (!e50 || !e200 || e50.length < 2) return null;
    var a = e50[e50.length - 1], b = e200[e200.length - 1];
    if (!isFinite(a) || !isFinite(b) || a === b) return null;
    return a > b ? 'up' : 'down';
  }catch(e){ return null; }
}

async function trendmxPerfectEvidencePass(rows){
  try{
    if (!Array.isArray(rows) || !rows.length) return rows;
    var capped = rows.slice().sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); }).slice(0, 8);
    var taker = null, binFund = null;
    try{ if (typeof W.binanceTakerRatio === 'function') taker = await W.binanceTakerRatio('BTCUSDT', '4h', 120); }catch(eT){ }
    try{ if (typeof W.binanceFunding === 'function'){ var bf = await W.binanceFunding('BTCUSDT'); binFund = (bf && isFinite(+bf.fundingPct)) ? +bf.fundingPct : null; } }catch(eB){ }
    var btcStructure = null;
    for (var bi = 0; bi < rows.length; bi++){
      var br = rows[bi];
      var bbase = String(br.base || br.sym || '').toUpperCase();
      if (bbase === 'BTC' || bbase.indexOf('BTC') === 0){
        try{ btcStructure = tmStructureDir(br.rows4h); }catch(eBs){ btcStructure = null; }
        if (btcStructure) break;
      }
    }
    trendmxMacroSet({ btcFunding: binFund, btcStructure: btcStructure });
    for (var i = 0; i < capped.length; i++){
      var r = capped[i];
      var dir = tmDirOf(r);
      if (!dir) continue;
      var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
      if (!plan) continue;
      var reads = {};
      if (isFinite(+r.fundingPct)){
        reads.venueFundingPct = +r.fundingPct;
        if (typeof hgFundingAgainstMark === 'function'){
          try{ var fam = hgFundingAgainstMark(+r.fundingPct, dir); if (fam) reads.fundingAgainst = (fam.against === true); }catch(eF){ }
        }
      }
      if (binFund != null) reads.btcFundingBinance = binFund;
      if (taker && Array.isArray(taker.series) && taker.series.length >= 30){
        try{
          var half = Math.floor(taker.series.length / 2);
          var prev = taker.series.slice(0, half).map(function(x){ return +x.buySellRatio; }).filter(isFinite);
          var last = taker.series.slice(half).map(function(x){ return +x.buySellRatio; }).filter(isFinite);
          if (prev.length && last.length){
            var pm = prev.reduce(function(a, b){ return a + b; }, 0) / prev.length;
            var lm = last.reduce(function(a, b){ return a + b; }, 0) / last.length;
            var up = lm > pm;
            reads.takerFlowVerdict = up ? (dir === 'long' ? 'with' : 'against') : (dir === 'long' ? 'against' : 'with');
          }
        }catch(eCv){ }
      }
      if (Array.isArray(r.rows4h) && r.rows4h.length >= 120 && typeof hgAtrPercentile === 'function'){
        try{ var atrP = hgAtrPercentile(r.rows4h, 14, 100); if (atrP != null){ reads.atrRegime = atrP < 20 ? 'DEAD' : (atrP > 80 ? 'BLOWOFF' : 'HEALTHY'); reads.atrPct = atrP; } }catch(eA){ }
      }
      try{ var st = tmStructureDir(r.rows4h); if (st) reads.structureTrend = st; }catch(eS){ }
      if (Array.isArray(r.rows4h) && r.rows4h.length >= 21 && typeof hgSlotMeanVol === 'function'){
        try{
          var slot = hgSlotMeanVol(r.rows4h, 20);
          var lv = +r.rows4h[r.rows4h.length - 1].v;
          if (slot && isFinite(slot.mean) && slot.mean > 0 && isFinite(lv) && lv > 0){
            var rvolW = lv / slot.mean;
            reads.volumeRvol = rvolW;
            reads.sess = rvolW >= 0.6 ? 'participating' : 'thin';
          }
        }catch(eSl){ }
      }
      try{ if (typeof W.hgNewsRisk === 'function'){ var nw = W.hgNewsRisk(r.base || 'BTC'); if (nw && nw.blackout) reads.newsRisk = 'blackout'; } }catch(eN){ }
      try{
        if (typeof W.hgObtcPerfectFormation === 'function'){
          var pick = { row: Object.assign({}, r, { entry: plan.entry, stop: plan.stop, t1: plan.t1, dir: dir }), tier: 'clean' };
          W.hgObtcPerfectFormation(pick, reads);
          r.perfect = pick.row.perfect === true;
          r.perfectPlus = pick.row.perfectPlus === true;
          r.perfectReads = pick.row.perfectReads || reads;
        }
      }catch(ePf){ }
    }
    return rows;
  }catch(e){ try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('trendmx', e); }catch(e2){ } return rows; }
}

/* hg-v1068: THE CROWN STATE — the strongest majority row with a minted
   plan in a light shape the alert batch and the auto-scan read. */
function trendmxCrownOfRows(rows){
  try{
    if (!Array.isArray(rows) || !rows.length) return null;
    var list = rows.slice().sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); });
    for (var i = 0; i < list.length; i++){
      var r = list[i];
      var dir = tmDirOf(r);
      if (!dir) continue;
      var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
      if (!plan) continue;
      var tier = trendmxRowTier(r, plan);
      return { sym: r.sym, dir: dir, entry: +plan.entry, stop: +plan.stop, t1: +plan.t1,
        t2: isFinite(+plan.t2) ? +plan.t2 : null, score: r.score, venue: tmRowVenue(r),
        gatesPassed: (r.gate && isFinite(r.gate.gatesPassed)) ? r.gate.gatesPassed : null,
        perfect: r.perfect === true, perfectPlus: r.perfectPlus === true,
        tier: tier === 'clean' ? 'clean' : 'near' };
    }
    return null;
  }catch(e){ return null; }
}

function trendmxCrownState(){
  try{
    var rows = (__tmScanSnap && Array.isArray(__tmScanSnap.rows)) ? __tmScanSnap.rows : null;
    if (!rows) return null;
    var c = trendmxCrownOfRows(rows);
    if (!c) return null;
    return { at: __tmScanSnap.at || null, crown: c };
  }catch(e){ return null; }
}

function hgPaintTrendmxFromSnap(){
  try{
    if (!__tmScanSnap || !__tmScanSnap.rows || !__tmScanSnap.rows.length || !tmTab.mountEl) return;
    var el = tmTab.mountEl;
    var refs = {
      summary: el.querySelector('[data-r="summary"]'),
      golden: el.querySelector('[data-r="golden"]'),
      death: el.querySelector('[data-r="death"]'),   /* hg-v1015 */
      cards: el.querySelector('[data-r="cards"]'),
      near: el.querySelector('[data-r="near"]'),
      forming: el.querySelector('[data-r="forming"]'),
      gateclean: el.querySelector('[data-r="gateclean"]'),   /* hg-v1018 */
      conviction: el.querySelector('[data-r="conviction"]'),  /* hg-v1018 */
      perfect: el.querySelector('[data-r="perfect"]'),        /* hg-v1022 */
      fwd: el.querySelector('[data-r="fwd"]'),                /* hg-v1039 */
      out: el.querySelector('[data-r="out"]'),
      status: el.querySelector('[data-r="status"]')
    };
    var state = { rows: __tmScanSnap.rows, golden: __tmScanSnap.goldenCross || [], death: __tmScanSnap.deathCross || [], filter: 'ALL', sortKey: 'score', sortDir: -1 };
    tmTab._state = state;
    trendmxPaintDeskSections(refs, state);
    trendmxPaintFwd(refs);
    if (refs.status && __tmScanSnap.at){
      refs.status.textContent = 'desk synced from cache · ' + trendmxSummaryLine(state.rows, state.golden)
        + ' · age ' + Math.round((Date.now() - __tmScanSnap.at) / 1000) + 's';
    }
    if (typeof tmTab._renderMatrix === 'function') tmTab._renderMatrix();
  }catch(e){}
}
W.hgPaintTrendmxFromSnap = hgPaintTrendmxFromSnap;

function publishTrendmxSnap(rows){
  try{
    if (!rows || !rows.length){ __tmSnap = null; return; }
    __tmSnap = {
      at: Date.now(),
      rows: rows.map(function(r){
        return { sym: r.sym, score: r.score, dir: tmDirOf(r), comps: r.comps || null };
      })
    };
  }catch(e){ __tmSnap = null; }
}

/* ---------------- hg-v995: the composite as a MARK, one home ----------------
   The composite (-5..+5) is read by four consumers: this desk's own board
   (tmDirOf, majority at |2|), the PINE universe filter (aligned at |2|), the
   FTS setup stack (+1 with at |2|, STRONG at |4|) and CONTRACT REPORT. None
   of them recorded it beside an outcome, and CONTRACT REPORT handed
   trendmxClassify two candle arrays where it wants a scored row and a
   direction, so that report row read idle on every tape.

   hgTrendMatrixAlign(score, dir): the composite's stance toward a plan --
   'with' (majority in the plan's direction), 'against' (majority the other
   way), 'neutral' (short of the majority either way), undefined when the
   score is not a finite number or there is no direction. TM_MAJORITY is the
   one bar, tmDirOf's bar, stated here through tmDirOf rather than retyped.

   hgTrendMatrixRowOf(sym): this desk's last published row for a contract,
   matched on the base (BTCUSDT, BTC-PERP, BTCUSD all read the BTC row), or
   null when the desk has not scanned it. hgTrendMatrixMark(dir, sym) reads
   that row for a record at fire time: { score, align, ageMin }, every field
   NOT RECORDED when the snapshot has no row, a string score or a zero stamp
   (+null is 0, the trap), and a gold-lane symbol gets nothing, because this
   is a crypto trend desk. Nothing here gates. */
function tmBaseOf(sym){
  var s = String(sym || '').toUpperCase().replace(/[-_\/:. ]/g, '');
  s = s.replace(/(USDT|USDC|BUSD|USD|PERP)+$/, '');
  return s;
}
function hgTrendMatrixAlign(score, dir){
  var d = (typeof dir === 'string') ? dir.toLowerCase() : '';
  if (d !== 'long' && d !== 'short') return undefined;
  if (typeof score !== 'number' || !isFinite(score)) return undefined;
  var maj = tmDirOf({ score: score });
  if (!maj) return 'neutral';
  return maj === d ? 'with' : 'against';
}
function hgTrendMatrixRowOf(sym){
  try{
    if (!__tmSnap || !Array.isArray(__tmSnap.rows)) return null;
    var want = tmBaseOf(sym);
    if (!want) return null;
    for (var i = 0; i < __tmSnap.rows.length; i++){
      var r = __tmSnap.rows[i];
      if (r && tmBaseOf(r.sym) === want) return r;
    }
    return null;
  }catch(e){ return null; }
}
function hgTrendMatrixMark(dir, sym){
  var out = { score: undefined, align: undefined, ageMin: undefined };
  try{
    if (typeof W.hgIsGoldLaneSym === 'function' && W.hgIsGoldLaneSym(sym)) return out;
    var r = hgTrendMatrixRowOf(sym);
    if (!r) return out;
    /* the row's score is trendScore's own output (a number, zeroResult on failure); the one
       check on its shape is hgTrendMatrixAlign's, and the ledger door has its own. A second
       typeof here was an unkillable mutant in the first cut -- a duplicated check. */
    out.score = r.score;
    var at = __tmSnap && __tmSnap.at;
    if (typeof at === 'number' && isFinite(at) && at > 0) out.ageMin = Math.max(0, Math.round((Date.now() - at) / 60000));
    out.align = hgTrendMatrixAlign(out.score, dir);
  }catch(e){}
  return out;
}

/* refresh contract: async, NEVER throws, returns a terse status string —
   'refreshed' | 'skipped: not run yet' | 'skipped: data layer missing' |
   'busy'. Safe before mount / before the first RUN SCAN. */
async function refreshTrendMatrix(){
  try{
    if (tmTab.busy) return 'busy';
    if (tmTab.missing > 0) return 'skipped: data layer missing';
    if (!tmTab.hasRun || typeof tmTab.run !== 'function') return 'skipped: not run yet';
    await tmTab.run(); /* runScan is internally try-caught; belt-and-braces anyway */
    return 'refreshed';
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

function mountTrendMatrix(el){
  tmTab.mountEl = el;
  if (typeof hgSetupInjectStyles === 'function') hgSetupInjectStyles();

  var need = ['ema', 'adx', 'ichimokuState', 'crossOver', 'crossUnder', 'crossedRecently'];
  var missing = [];
  for (var m = 0; m < need.length; m++){
    if (typeof W[need[m]] !== 'function') missing.push(need[m]);
  }
  var hasUniverse = (typeof W.xuUniverse === 'function')
    || (typeof W.binancePerpUniverse === 'function' && typeof W.binanceKlines === 'function');
  if (!hasUniverse) missing.push('xuUniverse|binancePerpUniverse');

  var floorM = (TURNOVER_FLOOR / 1e6).toFixed(0);
  el.innerHTML =
    '<div class="panel hg-panel">' +
      '<h2>TREND MATRIX <span>advanced multi-TF desk · every active CoinDCX USDT future · other venues ≥ $' + floorM + 'M</span></h2>' +
      (typeof W.hgOmniPrincipalNoteHtml === 'function' ? (W.hgOmniPrincipalNoteHtml('trendmx') || '') : '') +
      '<div id="trendmxDesk"></div>' +
      '<div class="note">Five signed components (−1/0/+1) composite −5…+5 · 7-gate swing matrix · formation ticket cascade · golden cross Telegram every 15m.</div>' +
      '<div class="row" style="margin-top:10px">' +
        '<button class="btn" data-r="run">RUN SCAN</button>' +
        '<button class="btn sec" data-r="sync">SYNC DESK</button>' +
        '<span class="spacer"></span>' +
        '<button class="chip on" data-f="ALL">ALL</button>' +
        '<button class="chip" data-f="CL">CLEAN 7/7</button>' +
        '<button class="chip" data-f="NR">NEAR 6/7</button>' +
        '<button class="chip" data-f="GD">⚡ GOLDEN</button>' +
        '<button class="chip" data-f="DT">⚡ DEATH</button>' +   /* hg-v1014 */
        '<button class="chip" data-f="CV">CONVICTION</button>' +
        '<button class="chip" data-f="SL">STRONG LONG</button>' +
        '<button class="chip" data-f="SS">STRONG SHORT</button>' +
        '<button class="chip" data-f="FX">FRESH CROSSES</button>' +
        '<span class="spacer"></span>' +
        '<button class="chip on" data-v="ALL">ALL VENUES</button>' +
        '<button class="chip" data-v="delta">DELTA</button>' +
        '<button class="chip" data-v="coindcx">COINDCX</button>' +
        '<button class="chip" data-v="binance">BINANCE</button>' +
      '</div>' +
      '<div class="prog" data-r="prog"><i></i></div>' +
      '<div class="note" data-r="summary" style="margin-top:8px;font-weight:600">Idle — run a scan to build the desk.</div>' +
      '<div class="note" data-r="status" style="margin-top:4px">Press RUN SCAN to warm the full matrix + ticket desk.</div>' +
      '<div data-r="golden"></div>' +
      '<div data-r="death"></div>' +   /* hg-v1015: the bear desk stands on its own, right under the bull desk */
      '<div class="cards" data-r="cards"></div>' +
      '<div data-r="near"></div>' +
      '<div data-r="forming"></div>' +
      '<div data-r="gateclean"></div>' +   /* hg-v1018: the gate-clean class on its own desk */
      '<div data-r="conviction"></div>' +  /* hg-v1018: the composite-conviction class under it */
      '<div data-r="perfect"></div>' +     /* hg-v1022: the strictest confluence tier on its own desk */
      '<div data-r="fwd"></div>' +         /* hg-v1039: the measured book — does the crown pay */
      '<h3 style="margin:16px 0 8px;font-size:11px;letter-spacing:.14em;color:#475569">COINDCX - ALL FUTURES - TRENDING / FORMING</h3>' +   /* hg-v1048 */
      '<div data-r="trendform"></div>' +
      '<h3 style="margin:16px 0 8px;font-size:11px;letter-spacing:.14em;color:#475569">THE CROWN</h3>' +   /* hg-v1066 */
      '<div data-r="crown"></div>' +
      '<h3 style="margin:16px 0 8px;font-size:11px;letter-spacing:.14em;color:#475569">FULL MATRIX · sortable · expandable plans</h3>' +
      '<div style="margin:4px 0 8px">' +
        '<button class="chip on" data-view="table">TABLE</button>' +
        '<button class="chip" data-view="columns">BULL / BEAR COLUMNS</button>' +
      '</div>' +
      '<div data-r="out"><div class="empty">Press RUN SCAN to build the matrix.</div></div>' +
    '</div>';

  if (typeof hgSetupPaintDesk === 'function'){
    hgSetupPaintDesk(el.querySelector('#trendmxDesk'), {
      kind: 'trendmx', tab: 'TREND MATRIX',
      note: 'CLEAN = 7/7 + plan + min R:R. The golden/death cross desks + the two limit class desks (gate-clean / conviction) promote the best rows. NEAR/FORMING are watch-only.'   /* hg-v1015 / hg-v1018 */
    });
  }

  var btn    = el.querySelector('[data-r="run"]');
  var syncBtn = el.querySelector('[data-r="sync"]');
  var prog   = el.querySelector('[data-r="prog"]');
  var summary = el.querySelector('[data-r="summary"]');
  var status = el.querySelector('[data-r="status"]');
  var out    = el.querySelector('[data-r="out"]');
  var refs = {
    summary: summary,
    golden: el.querySelector('[data-r="golden"]'),
    death: el.querySelector('[data-r="death"]'),   /* hg-v1015 */
    cards: el.querySelector('[data-r="cards"]'),
    near: el.querySelector('[data-r="near"]'),
    forming: el.querySelector('[data-r="forming"]'),
    gateclean: el.querySelector('[data-r="gateclean"]'),   /* hg-v1018 */
    conviction: el.querySelector('[data-r="conviction"]'),  /* hg-v1018 */
    perfect: el.querySelector('[data-r="perfect"]'),        /* hg-v1022 */
    fwd: el.querySelector('[data-r="fwd"]'),                /* hg-v1039: the measured book */
    trendform: el.querySelector('[data-r="trendform"]'),    /* hg-v1048: coindcx trending / forming */
    crown: el.querySelector('[data-r="crown"]'),            /* hg-v1066: the OMNIBTC-style crown */
    out: out,
    status: status
  };
  var chips  = Array.prototype.slice.call(el.querySelectorAll('[data-f]'));
  var vChips = Array.prototype.slice.call(el.querySelectorAll('[data-v]'));

  var state = { rows: [], golden: [], death: [], filter: 'ALL', venue: 'ALL', sortKey: 'score', sortDir: -1, running: false, view: 'table' };   /* hg-v1015: death bag initialized with golden; hg-v1045: view toggle */
  tmTab._state = state;

  function setProg(f){
    if (!prog) return;
    prog.style.display = (f === null) ? 'none' : 'block';
    if (f !== null) prog.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }
  function setStatus(txt, warn){
    status.className = warn ? 'note warn' : 'note';
    status.textContent = txt;
  }

  if (missing.length){
    setStatus('Missing globals: ' + missing.join(', ') + ' — tab cannot scan until the data/indicator scripts load.', true);
    btn.disabled = true;
  }

  chips.forEach(function(ch){
    ch.addEventListener('click', function(){
      state.filter = ch.getAttribute('data-f');
      chips.forEach(function(c){ c.classList.toggle('on', c === ch); });
      renderMatrix();
    });
  });
  vChips.forEach(function(ch){
    ch.addEventListener('click', function(){
      state.venue = ch.getAttribute('data-v');
      vChips.forEach(function(c){ c.classList.toggle('on', c === ch); });
      renderAll();
    });
  });
  var vwChips = Array.prototype.slice.call(el.querySelectorAll('[data-view]'));
  vwChips.forEach(function(ch){
    ch.addEventListener('click', function(){
      state.view = ch.getAttribute('data-view');
      vwChips.forEach(function(c){ c.classList.toggle('on', c === ch); });
      renderMatrix();
    });
  });
  btn.addEventListener('click', runScan);
  if (syncBtn) syncBtn.addEventListener('click', function(){ renderAll(); setStatus('desk repainted from latest scan.'); });
  /* the measured book renders on mount too — records from previous sessions
     are the point of an accumulating ledger (OMNIBTC's hg-v1011 pattern). */
  trendmxPaintFwd(refs);

  function sortVal(r, k){
    if (k === 'sym')   return r.sym;
    if (k === 'score') return r.score;
    if (k === 'gates') return (r.gate && isFinite(r.gate.gatesPassed)) ? r.gate.gatesPassed : -1;
    if (k === 'adx')   return isFinite(r.adx) ? r.adx : -Infinity;
    if (k === 'price') return r.price;
    return r.comps[k] || 0;
  }
  function passVenue(r){
    if (!state.venue || state.venue === 'ALL') return true;
    return tmRowVenue(r) === state.venue;
  }
  function passFilter(r){
    if (!passVenue(r)) return false;
    var dir = tmDirOf(r);
    var plan = dir ? trendmxPlan(Object.assign({}, r, { dir: dir })) : null;
    var tier = trendmxRowTier(r, plan);
    if (state.filter === 'CL') return tier === 'clean';
    if (state.filter === 'NR') return tier === 'near';
    if (state.filter === 'GD') return r.freshCross === 'GOLDEN';
    if (state.filter === 'DT') return r.freshCross === 'DEATH';   /* hg-v1014 */
    if (state.filter === 'CV') return !!trendmxConviction(r);
    if (state.filter === 'SL') return r.score >= 4;
    if (state.filter === 'SS') return r.score <= -4;
    if (state.filter === 'FX') return !!r.freshCross;
    return true;
  }
  function tri(v, up, dn){
    if (v > 0) return '<span class="pos">' + up + '</span>';
    if (v < 0) return '<span class="neg">' + dn + '</span>';
    return '<span>—</span>';
  }
  function cloudCell(v){
    if (v > 0) return '<span class="pos">ABOVE</span>';
    if (v < 0) return '<span class="neg">BELOW</span>';
    return '<span>INSIDE</span>';
  }

  function renderMatrix(){
    if (!state.rows.length){
      out.innerHTML = '<div class="empty">No results — run a scan.</div>';
      return;
    }
    var rows = state.rows.filter(passFilter);
    if (!rows.length){
      out.innerHTML = '<div class="empty">No symbols match this filter.</div>';
      return;
    }
    if (state.view === 'columns'){
      out.innerHTML = trendmxColumnsHTML(rows);
      return;
    }
    rows.sort(function(a, b){
      var va = sortVal(a, state.sortKey), vb = sortVal(b, state.sortKey);
      var c = (typeof va === 'string') ? va.localeCompare(vb) : (va - vb);
      return state.sortDir * c;
    });

    var h = '<table class="hg-table"><thead><tr>';
    h += '<th>COMP</th>';
    COLS.forEach(function(col){
      var arrow = (!col.nosort && state.sortKey === col.k) ? (state.sortDir > 0 ? ' ▲' : ' ▼') : '';
      h += col.nosort
        ? '<th>' + col.label + '</th>'
        : '<th data-k="' + col.k + '" style="cursor:pointer">' + col.label + arrow + '</th>';
    });
    h += '</tr></thead><tbody>';

    rows.forEach(function(r){
      var sc = r.score;
      var scls = sc > 0 ? 'pos' : (sc < 0 ? 'neg' : '');
      var xcls = r.comps.d1Cross > 0 ? 'pos' : (r.comps.d1Cross < 0 ? 'neg' : '');
      var xtxt = r.comps.d1Cross > 0 ? 'BULL' : (r.comps.d1Cross < 0 ? 'BEAR' : '—');
      var fx = r.freshCross
        ? ' <b class="' + (r.freshCross === 'GOLDEN' ? 'pos' : 'neg') + '">⚡' + r.freshCross + '</b>' : '';
      var adxTxt = isFinite(r.adx) ? r.adx.toFixed(1) : '—';
      var adxMark = r.comps.adxPt > 0 ? ' <span class="pos">▲</span>'
                  : (r.comps.adxPt < 0 ? ' <span class="neg">▼</span>' : '');
      var gate = r.gate;
      var gateTxt = gate ? gate.label : '—';
      var gateCls = gate && gate.clean7 ? 'ok' : (gate && gate.veto ? 'bad' : '');
      var pdir = tmDirOf(r);
      h += '<tr>' +
        '<td>' + trendmxCompPipsHtml(r.comps) + '</td>' +
        '<td><b>' + r.sym + '</b>' + tmVenueChip(r) + '</td>' +
        '<td class="' + scls + '"><b>' + (sc > 0 ? '+' : '') + sc + '</b></td>' +
        '<td><span class="gpip ' + gateCls + '">' + escH(gateTxt) + '</span></td>' +
        '<td>' + tri(r.comps.d1Trend, '▲ UP', '▼ DOWN') + '</td>' +
        '<td><span class="' + xcls + '">' + xtxt + '</span>' + fx + '</td>' +
        '<td>' + tri(r.comps.h4Cascade, '▲ ALIGN', '▼ INVERSE') + '</td>' +
        '<td>' + cloudCell(r.comps.cloud) + '</td>' +
        '<td>' + adxTxt + adxMark + '</td>' +
        '<td>' + pxFmt(r.price) + '</td>' +
        '<td>' + (pdir
          ? '<button class="chip tmPlanBtn" data-sym="' + escH(r.sym) + '">' + pdir.toUpperCase() + ' PLAN ▸</button>'
          : '<span class="note">—</span>') + '</td>' +
      '</tr>' +
      '<tr class="tmPlanRow" data-sym="' + escH(r.sym) + '" style="display:none"><td colspan="' + (COLS.length + 1) + '"></td></tr>';
    });
    h += '</tbody></table>';
    out.innerHTML = h;

    Array.prototype.slice.call(out.querySelectorAll('th[data-k]')).forEach(function(th){
      th.addEventListener('click', function(){
        var k = th.getAttribute('data-k');
        if (state.sortKey === k) state.sortDir = -state.sortDir;
        else { state.sortKey = k; state.sortDir = (k === 'sym') ? 1 : -1; }
        renderMatrix();
      });
    });
    Array.prototype.slice.call(out.querySelectorAll('.tmPlanBtn')).forEach(function(b){
      b.addEventListener('click', function(){ togglePlan(b.getAttribute('data-sym')); });
    });
  }
  tmTab._renderMatrix = renderMatrix;

  function renderAll(){
    trendmxPaintDeskSections(refs, state);
    trendmxPaintFwd(refs);
    renderMatrix();
  }

  function togglePlan(sym){
    var row = out.querySelector('tr.tmPlanRow[data-sym="' + sym + '"]');
    if (!row) return;
    var btnEl = out.querySelector('.tmPlanBtn[data-sym="' + sym + '"]');
    var open = row.style.display !== 'none';
    if (open){
      row.style.display = 'none';
      if (btnEl) btnEl.textContent = btnEl.textContent.replace('▾', '▸');
      return;
    }
    var r = null;
    for (var i = 0; i < state.rows.length; i++){ if (state.rows[i].sym === sym){ r = state.rows[i]; break; } }
    var td = row.querySelector('td');
    if (td && r) td.innerHTML = trendmxPlanBlock(r);
    row.style.display = '';
    if (btnEl) btnEl.textContent = btnEl.textContent.replace('▸', '▾');
  }

  async function runScan(){
    if (state.running || missing.length) return;
    state.running = true;
    tmTab.busy = true;
    btn.disabled = true;
    var t0 = Date.now();
    try{
      setProg(0.05);
      setStatus('Scanning full universe (floor ' + floorM + 'M, Delta + CoinDCX + Binance, + ALL CoinDCX futures)...');
      var snap = await trendmxScan({ force: true });
      var results = (snap && snap.rows) ? snap.rows : [];
      var failed = (snap && snap.failed) ? snap.failed : 0;
      var symsLen = (snap && snap.scanned) ? snap.scanned : results.length;
      var uniLen = (snap && snap.uniLen) ? snap.uniLen : symsLen;
      var vc = (snap && snap.venueCounts) ? snap.venueCounts : {};

      state.rows = results;
      state.golden = (snap && snap.goldenCross) ? snap.goldenCross : [];
      state.death = (snap && snap.deathCross) ? snap.deathCross : [];   /* hg-v1014 */
      state.venueCounts = vc;
      renderAll();
      /* hg-v1039: THE CROWN JOINS THE FORWARD BOOK — the desk has crowned
         CLEAN / PERFECT rows for its whole life and never recorded one, so
         'does the trend-matrix crown pay?' could never be asked. Each 7/7
         gate-clean row with a valid plan is recorded (max 10, strongest
         |composite| first); the ledger dedups on the bar and settles on
         bars the desk already fetched. Evidence, never a gate. */
      try{
        if (typeof W.hgFwdRecordScan === 'function'){
          var recRows = [];
          var cands = state.rows.slice().sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); });
          for (var ri = 0; ri < cands.length && recRows.length < 10; ri++){
            var cr = cands[ri];
            var cdir = tmDirOf(cr);
            if (!cdir || !cr.gate || !cr.gate.clean7 || cr.gate.veto) continue;
            var cplan = trendmxPlan(Object.assign({}, cr, { dir: cdir }));
            if (!cplan || !isFinite(+cplan.entry) || !isFinite(+cplan.stop) || !isFinite(+cplan.t1)) continue;
            var crh4 = cr.rows4h;
            if (!Array.isArray(crh4) || !crh4.length) continue;
            var cLast = crh4[crh4.length - 1];
            recRows.push({
              sym: cr.sym, dir: cdir,
              entry: +cplan.entry, stop: +cplan.stop, t1: +cplan.t1,
              signalT: (cLast && cLast.t != null) ? cLast.t : undefined,
              mark: (cLast && cLast.c != null) ? +cLast.c : undefined,
              rows4h: crh4,
              fundingPct: (typeof cr.fundingPct === 'number' && isFinite(cr.fundingPct)) ? cr.fundingPct : undefined,
              mechanic: trendmxPerfectState(cr) ? 'PERFECT' : 'CLEAN',
              ticket: true
            });
          }
          if (recRows.length) W.hgFwdRecordScan('TRENDMX', '4h', recRows, { horizonBars: 20 });
        }
      }catch(eRec){ try{ if (typeof W.hgFwdWarn === 'function') W.hgFwdWarn('trendmx', eRec); }catch(eW){} }
      if (typeof globalThis !== 'undefined' && typeof globalThis.hgChartVisionEnrichDeskRows === 'function'){
        var tmClean = state.rows.filter(function(r){
          var d = tmDirOf(r);
          if (!d || !r.rows4h) return false;
          var plan = trendmxPlan(Object.assign({}, r, { dir: d }));
          return trendmxRowTier(r, plan) === 'clean';
        });
        globalThis.hgChartVisionEnrichDeskRows(tmClean, function(r){ return r.rows4h; }, {
          limit: 12,
          repaint: function(){ renderAll(); }
        });
      }
      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      var venNote = ' · Δ' + (vc.delta || 0) + ' CDX' + (vc.coindcx || 0) + ' BN' + (vc.binance || 0);
      setStatus('raw ' + uniLen + ' · scanned ' + symsLen + venNote
                + ' (≥ $' + floorM + 'M) · ' + results.length + ' ok / ' + failed +
                ' failed · ' + dt + 's' + (snap && snap.note ? ' · ' + snap.note : '')
                /* hg-v1012: name the evidence pass the same way the board does */
                + ((snap && snap.flow && snap.flow.read === 'taker' && (snap.flow.with + snap.flow.against) > 0)
                  ? ' · taker flow: ' + snap.flow.with + ' with / ' + snap.flow.against + ' held off' : ''),
                results.length === 0);
      if (!results.length){
        out.innerHTML = '<div class="empty">All symbol fetches failed — check connection.</div>';
      }
    }catch(e){
      setStatus('Scan failed: ' + ((e && e.message) || e), true);
      if (!state.rows.length) out.innerHTML = '<div class="empty">Scan could not complete.</div>';
    }finally{
      state.running = false;
      tmTab.busy = false;
      tmTab.hasRun = true;
      btn.disabled = missing.length > 0;
      setProg(null);
    }
  }

  tmTab.run = runScan;
  tmTab.missing = missing.length;

  if (__tmScanSnap && __tmScanSnap.rows && __tmScanSnap.rows.length &&
      __tmScanSnap.at && (Date.now() - __tmScanSnap.at) < (5 * 60 * 1000)){
    state.rows = __tmScanSnap.rows;
    state.golden = __tmScanSnap.goldenCross || [];
    state.death = __tmScanSnap.deathCross || [];   /* hg-v1014 */
    tmTab.hasRun = true;
    renderAll();
    setStatus('restored from cache · ' + trendmxSummaryLine(state.rows, state.golden)
      + ' · age ' + Math.round((Date.now() - __tmScanSnap.at) / 1000) + 's');
  }
}

/* ---------------- exports + tab registration ---------------- */

W.trendScore = trendScore;
W.tmDirOf = tmDirOf;
W.trendmxGateEval = trendmxGateEval;
W.trendmxClassify = trendmxClassify;
W.hgTrendMatrixAlign = hgTrendMatrixAlign;   /* hg-v995 */
W.hgTrendMatrixRowOf = hgTrendMatrixRowOf;
W.hgTrendMatrixMark = hgTrendMatrixMark;
W.trendmxPlan = trendmxPlan;
W.trendmxPlanHTML = trendmxPlanHTML;
W.trendmxPlanBlock = trendmxPlanBlock;
W.trendmxConviction = trendmxConviction;
/* hg-v1012: the evidence layer's seams — the pass, the chips, and the two
   pre-existing readers the layer's behavior lives through (no export cap
   on this desk; the tests read these rather than re-deriving behavior) */
W.trendmxFlowScan = trendmxFlowScan;
W.trendmxFlowChipHtml = trendmxFlowChipHtml;
W.trendmxMomState = trendmxMomState;       /* hg-v1019: the momentum witness */
W.trendmxMomChipHtml = trendmxMomChipHtml;
W.trendmxSetupCardHTML = trendmxSetupCardHTML;   /* hg-v1019: the matrix card — where a held row's chip must paint (the NEAR section) */
W.trendmxVolState = trendmxVolState;       /* hg-v1020: the volume witness */
W.trendmxVolChipHtml = trendmxVolChipHtml;
W.trendmxFundGate = trendmxFundGate;       /* hg-v1034: the fundamental + sentiment witness */
W.trendmxColumnsHTML = trendmxColumnsHTML; /* hg-v1045: the bull / bear column view */
W.trendmxTrendFormHTML = trendmxTrendFormHTML; /* hg-v1048: the coindcx trending / forming board */
W.trendmxCrownPanelHTML = trendmxCrownPanelHTML; /* hg-v1066: the OMNIBTC-style crown */
W.trendmxPerfectEvidencePass = trendmxPerfectEvidencePass; /* hg-v1067: the OMNIBTC evidence stack */
W.trendmxCrownOfRows = trendmxCrownOfRows;   /* hg-v1068: the crown, pure and testable */
W.trendmxCrownState = trendmxCrownState;     /* hg-v1068: the alert seam */
W.trendmxFundState = trendmxFundState;
W.trendmxFundChipHtml = trendmxFundChipHtml;
W.trendmxChopState = trendmxChopState;      /* hg-v1057: the trend-quality witness */
W.trendmxChopChipHtml = trendmxChopChipHtml;
W.trendmxFivePillars = trendmxFivePillars;
W.trendmxFullStackSetups = trendmxFullStackSetups;
W.trendmxPillarHtml = trendmxPillarHtml;
W.trendmxPerfectState = trendmxPerfectState;       /* hg-v1022: the perfect predicate */
W.trendmxPerfectSetups = trendmxPerfectSetups;     /* hg-v1022: the perfect bag collector */
W.trendmxPerfectDeskHTML = trendmxPerfectDeskHTML; /* hg-v1022: the perfect desk renderer */
W.trendmxAtrRegime = trendmxAtrRegime;             /* hg-v1022: the volatility regime read */
W.trendmxAtrRegimeChipHtml = trendmxAtrRegimeChipHtml;
W.tmVolWitness = tmVolWitness;             /* the pure 1D-tape read, exported for the tests */
W.trendmxFundingChipHtml = trendmxFundingChipHtml;
W.trendmxRowTier = trendmxRowTier;
/* hg-v1018: the mixed board is superseded by the two class desks — the
   collector and both renderers are the desk's behavior, exported the same
   way (the tests read them rather than re-deriving behavior) */
W.trendmxLimitClasses = trendmxLimitClasses;
W.trendmxGateCleanDeskHTML = trendmxGateCleanDeskHTML;
W.trendmxConvictionDeskHTML = trendmxConvictionDeskHTML;
W.trendmxLimitDeskHTML = trendmxLimitDeskHTML;
W.trendmxSummaryLine = trendmxSummaryLine;
W.trendmxGoldenCrossSetups = trendmxGoldenCrossSetups;
W.trendmxDeathCrossSetups = trendmxDeathCrossSetups;   /* hg-v1014 */
W.tmSmcScanPass = tmSmcScanPass;   /* hg-v1014: the shared ticket cap is desk behavior — the tests read it, never re-derive it */
W.trendmxGoldenDeskHTML = trendmxGoldenDeskHTML;   /* hg-v1015 */
W.trendmxDeathDeskHTML = trendmxDeathDeskHTML;   /* hg-v1015 */
W.trendmxPaintDeskSections = trendmxPaintDeskSections;   /* hg-v1015: the desk routing is desk behavior too */
W.trendmxScan = trendmxScan;
W.trendmxWarm = trendmxWarm;
W.trendmxCrossState = function(){
  try{
    if (!__tmScanSnap) return null;
    return {
      at: __tmScanSnap.at,
      scanned: __tmScanSnap.scanned,
      goldenCross: (__tmScanSnap.goldenCross || []).map(function(s){
        return { sym: s.sym, dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1, score: s.score,
          conviction: s.conviction, tier: s.tier, freshCross: s.freshCross };
      }),
      /* hg-v1014: the mirrored half — the alert cycle reads both */
      deathCross: (__tmScanSnap.deathCross || []).map(function(s){
        return { sym: s.sym, dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1, score: s.score,
          conviction: s.conviction, tier: s.tier, freshCross: s.freshCross };
      })
    };
  }catch(e){ return null; }
};
W.trendmxState = function(){
  try{ return __tmSnap ? JSON.parse(JSON.stringify(__tmSnap)) : null; }catch(e){ return null; }
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'trendmx', label: 'TREND MATRIX', mount: mountTrendMatrix, refresh: refreshTrendMatrix });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'trendmx', label: 'TREND MATRIX', run: trendmxWarm });

})();
