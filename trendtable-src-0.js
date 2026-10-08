/* =========================================================================
HARDGATE — trendtable.js
TREND MATRIX tab (id 'trendmx'): multi-timeframe trend dashboard across the
full combined universe (Delta + CoinDCX + Binance extension via xuniverse.js,
≥ $5M turnover floor, no top-N cap; Binance-only fallback when xu absent).

Per symbol: binanceKlines 1d x260 + 4h x260 -> five signed components. BATCH 1133: 4h history is long enough for the 7-gate matrix (210 bars). A fresh cross is a limit at the nearer 4h EMA9 or EMA21, cancelled if price does not tag it within 6 four-hour bars. An alt long is stood down while BTC 4h EMA50 is under EMA200.
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
function tmBarOpenSec(row){
  var t = row && row.t;
  if (!isFinite(+t)) return NaN;
  t = +t;
  return t > 1e12 ? Math.floor(t / 1000) : t;
}
function tmClosedRows(rows, barSec){
  if (!Array.isArray(rows) || rows.length < 2) return rows || [];
  var open = tmBarOpenSec(rows[rows.length - 1]);
  if (!isFinite(open) || open + barSec > Date.now() / 1000) return rows.slice(0, -1);
  return rows;
}
function tmCascadeDir(rows4h){
  var rows = tmClosedRows(rows4h, 14400);
  if (!rows || rows.length < 50 || typeof ema !== 'function') return 0;
  var c = rows.map(function(r){ return r ? r.c : NaN; });
  var i = c.length - 1;
  var e9 = ema(c, 9)[i], e21 = ema(c, 21)[i], e50 = ema(c, 50)[i];
  if (!(isFinite(e9) && isFinite(e21) && isFinite(e50))) return 0;
  if (e9 > e21 && e21 > e50) return 1;
  if (e9 < e21 && e21 < e50) return -1;
  return 0;
}
function trendmxClosedGate(r, dir){
  var rows = tmClosedRows(r && r.rows4h, 14400);
  if (!rows || rows.length < 210) return null;
  return trendmxGateEval({
    rows4h: rows, sym: r.sym, fundingPct: r.fundingPct, exchange: r.exchange, base: r.base
  }, dir);
}
function trendmxSetupGrade(r, dir){
  var reasons = [];
  var rsiV = (r && typeof r.rsi === 'number') ? r.rsi : NaN;
  var volDiv = r ? r.volDiv : null;
  var volConf = r ? r.volConf : null;
  var daily = tmClosedRows(r && r.rows1d, 86400);
  if (daily && daily.length >= 20){
    if (typeof rsi === 'function'){
      var series = rsi(daily.map(function(x){ return x.c; }), 14);
      if (series && series.length && isFinite(series[series.length - 1])) rsiV = series[series.length - 1];
    }
    var vol = tmVolWitness(daily);
    volDiv = vol.div;
    volConf = vol.conf;
  }
  if (dir === 'long'){
    if (isFinite(rsiV) && rsiV < 40) reasons.push('RSI ' + rsiV.toFixed(0) + ' against');
    if (volDiv === 'bear') reasons.push('OBV diverging');
    if (typeof r.fundingPct === 'number' && isFinite(r.fundingPct) && r.fundingPct >= 0.04) reasons.push('funding crowded');
    if (tmAltLongBlockedByBtc(r)) reasons.push('BTC structure down');
  } else if (dir === 'short'){
    if (isFinite(rsiV) && rsiV > 60) reasons.push('RSI ' + rsiV.toFixed(0) + ' against');
    if (volDiv === 'bull') reasons.push('OBV diverging');
    if (typeof r.fundingPct === 'number' && isFinite(r.fundingPct) && r.fundingPct <= -0.04) reasons.push('funding crowded');
  }
  var value = tmValueState(r, dir);
  for (var vi = 0; vi < value.reasons.length; vi++) reasons.push(value.reasons[vi]);
  return { grade: reasons.length ? 'SKIP' : 'TRADE', reasons: reasons, volConf: volConf, value: value };
}
function tmValueState(row, dir){
  var out = { reasons: [], distAtr: null, adx4: null, touched: null };
  var rows4 = tmClosedRows(row && row.rows4h, 14400);
  if (!rows4 || rows4.length < 50 || typeof ema !== 'function') return out;
  var closes = rows4.map(function(bar){ return bar ? bar.c : NaN; });
  var px = closes[closes.length - 1];
  var e21 = tmEmaLast(closes, 21);
  var atr = tmAtrLast(rows4);
  if (isFinite(px) && isFinite(e21) && atr > 0){
    out.distAtr = Math.abs(px - e21) / atr;
    if (out.distAtr > 2.2) out.reasons.push('extended ' + out.distAtr.toFixed(1) + 'x ATR from the 4h EMA21');
  }
  if (typeof adx === 'function'){
    try {
      var ax = adx(rows4, 14);
      var adx4 = ax && ax.adx && ax.adx.length ? ax.adx[ax.adx.length - 1] : NaN;
      if (isFinite(adx4)){
        out.adx4 = adx4;
        if (adx4 > 44) out.reasons.push('4h ADX ' + adx4.toFixed(0) + ' is exhaustion, not an entry');
        else if (adx4 < 22) out.reasons.push('4h ADX ' + adx4.toFixed(0) + ' is chop, not a trend entry');
      }
    } catch (eAdx) {}
  }
  var rows1 = tmClosedRows(row && row.rows1h, 3600);
  if (rows1 && rows1.length >= 30){
    var c1 = rows1.map(function(bar){ return bar ? bar.c : NaN; });
    var series = ema(c1, 21);
    var level = series && series.length ? series[series.length - 1] : NaN;
    var touched = false;
    if (isFinite(level)){
      var slice = rows1.slice(-3), i, bar;
      for (i = 0; i < slice.length; i++){
        bar = slice[i];
        if (!bar) continue;
        if (dir === 'long' && bar.l <= level) touched = true;
        if (dir === 'short' && bar.h >= level) touched = true;
      }
    }
    out.touched = touched;
    if (!touched && isFinite(out.distAtr) && out.distAtr > 0.6) out.reasons.push('no pullback into the 1h EMA21');
    else if (touched){
      var pull = tmPullbackRvol(rows1, dir, level);
      if (pull === 'unread') out.reasons.push('pullback volume unread');
      else if (pull >= 0.85) out.reasons.push('pullback volume ' + pull.toFixed(2) + 'x is distribution, not a quiet retest');
    }
    if (rows1.length >= 52 && typeof ichimoku === 'function'){
      try {
        var ic = ichimoku(rows1);
        var i1 = rows1.length - 1;
        var spanA = ic && ic.senkouA ? ic.senkouA[i1] : NaN;
        var spanB = ic && ic.senkouB ? ic.senkouB[i1] : NaN;
        var cloudPx = rows1[i1] && rows1[i1].c;
        if (!(isFinite(spanA) && isFinite(spanB) && isFinite(cloudPx))) out.reasons.push('1h cloud unread');
        else {
          var top = Math.max(spanA, spanB), bot = Math.min(spanA, spanB);
          if (dir === 'long' && cloudPx < bot) out.reasons.push('1h price is below the cloud');
          else if (dir === 'long' && cloudPx <= top) out.reasons.push('1h price is inside the cloud');
          else if (dir === 'short' && cloudPx > top) out.reasons.push('1h price is above the cloud');
          else if (dir === 'short' && cloudPx >= bot) out.reasons.push('1h price is inside the cloud');
        }
      } catch (eIc) { out.reasons.push('1h cloud unread'); }
    }
    var va = (typeof tmVolumeProfile === 'function') ? tmVolumeProfile(rows1) : null;
    var px1 = rows1[rows1.length - 1] && rows1[rows1.length - 1].c;
    if (!va || !isFinite(px1)) out.reasons.push('1h value area unread');
    else if (dir === 'long' && px1 < va.poc) out.reasons.push('1h price lost the point of control');
    else if (dir === 'long' && px1 < va.vah) out.reasons.push('1h price is under the value area high');
    else if (dir === 'short' && px1 > va.poc) out.reasons.push('1h price lost the point of control');
    else if (dir === 'short' && px1 > va.val) out.reasons.push('1h price is over the value area low');
  }
  var hurst = tmHurst(rows4);
  if (hurst == null) out.reasons.push('hurst unread');
  else if (hurst < 0.48) out.reasons.push('hurst ' + hurst.toFixed(2) + ' is mean-reverting');
  else if (hurst <= 0.55) out.reasons.push('hurst ' + hurst.toFixed(2) + ' is not a trend');
  var poc = tmPocShift(rows4, dir);
  if (poc == null) out.reasons.push('point of control unread');
  else if (!poc) out.reasons.push('point of control did not migrate with the trend');
  if (typeof ttmSqueeze === 'function'){
    try {
      var sq = ttmSqueeze(rows4);
      var i4 = rows4.length - 1;
      if (sq && sq.on && sq.on[i4]) out.reasons.push('4h squeeze still coiled');
      else if (sq && sq.fired && sq.fired[i4] && sq.momentum && isFinite(sq.momentum[i4])){
        if (dir === 'long' && sq.momentum[i4] < 0) out.reasons.push('4h squeeze fired against the long');
        if (dir === 'short' && sq.momentum[i4] > 0) out.reasons.push('4h squeeze fired against the short');
      }
    } catch (eSq) {}
  }
  if (typeof rsi === 'function'){
    try {
      var rsiSeries = rsi(closes, 14);
      var rsiNow = rsiSeries && rsiSeries.length ? rsiSeries[rsiSeries.length - 1] : NaN;
      if (isFinite(rsiNow)){
        if (dir === 'long' && rsiNow > 52) out.reasons.push('4h RSI ' + rsiNow.toFixed(0) + ' is above the bull floor');
        if (dir === 'short' && rsiNow < 50) out.reasons.push('4h RSI ' + rsiNow.toFixed(0) + ' is below the bear ceiling');
      }
    } catch (eRsi) {}
  }
  var swing = tmSwingAnchor(rows4, dir);
  if (!swing) out.reasons.push('anchored VWAP unread');
  else {
    var avwap = tmAnchoredVwap(rows4, swing.i);
    if (!isFinite(avwap)) out.reasons.push('anchored VWAP unread');
    else if (atr > 0){
      var taggedAv = false, ak, abar;
      var atail = rows4.slice(-3);
      for (ak = 0; ak < atail.length; ak++){
        abar = atail[ak];
        if (!abar) continue;
        if (dir === 'long' && abar.l <= avwap) taggedAv = true;
        if (dir === 'short' && abar.h >= avwap) taggedAv = true;
      }
      if (!taggedAv && Math.abs(px - avwap) > atr * 0.8) out.reasons.push('not at the 4h anchored VWAP');
    }
  }
  return out;
}
function tmSwingAnchor(rows, dir){
  if (typeof hgStructure !== 'function' || !rows) return null;
  try {
    var hs = hgStructure(rows);
    if (!hs || !hs.swings) return null;
    var best = null, i;
    for (i = 0; i < hs.swings.length; i++){
      var kind = hs.swings[i].kind;
      var type = hs.swings[i].type;
      var isLow = kind === 'low' || type === 'HL' || type === 'LL';
      var isHigh = kind === 'high' || type === 'HH' || type === 'LH';
      if (dir === 'long' && isLow) best = hs.swings[i];
      if (dir === 'short' && isHigh) best = hs.swings[i];
    }
    return best && isFinite(best.i) ? best : null;
  } catch (e) { return null; }
}
function tmAnchoredVwap(rows, from){
  if (!rows || !(from >= 0) || from >= rows.length) return NaN;
  var pv = 0, vv = 0, i, bar, vol, typ;
  for (i = from; i < rows.length; i++){
    bar = rows[i];
    vol = tmBarVol(bar);
    if (!isFinite(vol)) return NaN;
    typ = (bar.h + bar.l + bar.c) / 3;
    if (!isFinite(typ)) return NaN;
    pv += typ * vol;
    vv += vol;
  }
  return vv > 0 ? pv / vv : NaN;
}
function tmBodyCommit(rows, dir){
  if (!rows || rows.length < 8 || typeof atr !== 'function') return null;
  var series = atr(rows, 14);
  var atrNow = series && series.length ? series[series.length - 1] : NaN;
  if (!(atrNow > 0)) return null;
  var cur = rows[rows.length - 1];
  var recent = rows.slice(-8, -1);
  var buf = atrNow * 0.25;
  if (dir === 'long'){
    var pivotH = Math.max.apply(null, recent.map(function(bar){ return bar.h; }));
    return cur.c > cur.o && cur.c > pivotH + buf;
  }
  var pivotL = Math.min.apply(null, recent.map(function(bar){ return bar.l; }));
  return cur.c < cur.o && cur.c < pivotL - buf;
}
function tmAltBtcLowerLow(coinRows, btcRows){
  var n = Math.min(coinRows ? coinRows.length : 0, btcRows ? btcRows.length : 0);
  if (n < 12) return null;
  var ratio = [], i, c, b;
  for (i = 0; i < n; i++){
    c = coinRows[coinRows.length - n + i].c;
    b = btcRows[btcRows.length - n + i].c;
    if (!(c > 0) || !(b > 0)) return null;
    ratio.push(c / b);
  }
  var last = ratio.slice(-6), prev = ratio.slice(-12, -6);
  var minL = Math.min.apply(null, last), minP = Math.min.apply(null, prev);
  var maxL = Math.max.apply(null, last), maxP = Math.max.apply(null, prev);
  return { lowerLow: minL < minP, higherHigh: maxL > maxP };
}
function tmExampleSize(entry, stop){
  var dist = Math.abs(+entry - +stop);
  if (!(+entry > 0) || !(dist > 0)) return null;
  var units = 100 / dist;
  return { units: units, notional: units * +entry };
}
function tmParkinson(rows, period){
  period = period || 14;
  if (!rows || rows.length < period) return NaN;
  var factor = 1 / (4 * Math.log(2) * period);
  var sum = 0, i, h, l, slice = rows.slice(-period);
  for (i = 0; i < slice.length; i++){
    h = slice[i].h; l = slice[i].l;
    if (!(l > 0) || !(h >= l)) return NaN;
    sum += Math.pow(Math.log(h / l), 2);
  }
  return Math.sqrt(factor * sum);
}
function tmParkinsonHot(rows){
  if (!rows || rows.length < 42) return null;
  var now = tmParkinson(rows, 14);
  if (!isFinite(now)) return null;
  var hist = [], end, w;
  for (end = 14; end < rows.length - 1; end++){
    w = tmParkinson(rows.slice(end - 14, end), 14);
    if (isFinite(w)) hist.push(w);
  }
  if (hist.length < 10) return null;
  hist.sort(function(a, b){ return a - b; });
  return { now: now, hot: now > hist[Math.floor(0.8 * (hist.length - 1))] };
}
function tmRs(closes){
  if (!closes || closes.length < 8) return NaN;
  var rets = [], i, mean = 0;
  for (i = 1; i < closes.length; i++) rets.push(closes[i] - closes[i - 1]);
  for (i = 0; i < rets.length; i++) mean += rets[i];
  mean /= rets.length;
  var cum = 0, mx = -Infinity, mn = Infinity, v = 0;
  for (i = 0; i < rets.length; i++){
    cum += rets[i] - mean;
    if (cum > mx) mx = cum;
    if (cum < mn) mn = cum;
    v += (rets[i] - mean) * (rets[i] - mean);
  }
  var sd = Math.sqrt(v / rets.length);
  if (!(sd > 0) || !(mx > mn)) return NaN;
  return (mx - mn) / sd;
}
function tmHurst(rows){
  if (!rows || rows.length < 80) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++){
    if (!(rows[i].c > 0)) return null;
    closes.push(rows[i].c);
  }
  function avgRs(scale){
    var logs = [], start;
    for (start = 0; start + scale <= closes.length; start += scale){
      var rs = tmRs(closes.slice(start, start + scale));
      if (isFinite(rs) && rs > 0) logs.push(Math.log(rs));
    }
    if (logs.length < 2) return NaN;
    var sum = 0;
    for (start = 0; start < logs.length; start++) sum += logs[start];
    return Math.exp(sum / logs.length);
  }
  var small = avgRs(16), large = avgRs(64);
  if (!(small > 0) || !(large > 0)) return null;
  var h = Math.log(large / small) / Math.log(64 / 16);
  return isFinite(h) ? h : null;
}
function tmPocShift(rows, dir){
  if (!rows || rows.length < 80 || typeof tmVolumeProfile !== 'function') return null;
  var mid = Math.floor(rows.length / 2);
  var prior = tmVolumeProfile(rows.slice(0, mid));
  var recent = tmVolumeProfile(rows.slice(mid));
  if (!prior || !recent || !isFinite(prior.poc) || !isFinite(recent.poc)) return null;
  if (dir === 'long') return recent.poc > prior.poc;
  return recent.poc < prior.poc;
}
function tmFundingSpike(prev, cur, dir){
  if (!isFinite(prev) || !isFinite(cur)) return null;
  var delta = cur - prev;
  var vel = prev === 0 ? null : (delta / Math.abs(prev)) * 100;
  if (dir === 'long') return delta > 0.0003 && (vel == null || vel > 250);
  return delta < -0.0003 && (vel == null || vel < -250);
}
function tmSettlementFreeze(now){
  now = now || new Date();
  var mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  var marks = [0, 8 * 60, 16 * 60], i, d;
  for (i = 0; i < marks.length; i++){
    d = Math.abs(mins - marks[i]);
    if (d <= 15 || d >= 24 * 60 - 15) return true;
  }
  return false;
}
function tmLiquidityRoom(rows, dir, entry, risk){
  if (!rows || rows.length < 30 || typeof hgStructure !== 'function') return null;
  if (!(entry > 0) || !(risk > 0)) return null;
  var hs;
  try { hs = hgStructure(rows); } catch (e) { return null; }
  if (!hs || !hs.swings || hs.swings.length < 2) return null;
  var levels = [], i, s;
  for (i = 0; i < hs.swings.length; i++){
    s = hs.swings[i];
    if (dir === 'long' && (s.type === 'HH' || s.type === 'LH') && s.px > entry) levels.push(s.px);
    if (dir === 'short' && (s.type === 'HL' || s.type === 'LL') && s.px < entry) levels.push(s.px);
  }
  var pools = [], a, b, mid;
  for (a = 0; a < levels.length; a++){
    for (b = a + 1; b < levels.length; b++){
      mid = (levels[a] + levels[b]) / 2;
      if (!(mid > 0)) continue;
      if (Math.abs(levels[a] - levels[b]) / mid <= 0.0025) pools.push(mid);
    }
  }
  if (!pools.length) return { open: true, room: null };
  pools.sort(function(x, y){ return dir === 'long' ? x - y : y - x; });
  var room = Math.abs(pools[0] - entry) / risk;
  return { open: room >= 2, room: room };
}
function tmEffortTrap(candle, atrNow, share, dir){
  if (!candle || !(atrNow > 0) || share == null || !isFinite(share)) return null;
  var body = Math.abs(candle.c - candle.o);
  if (dir === 'long') return share >= 0.65 && body < atrNow * 0.35 && (candle.h - candle.c) > body;
  return share <= 0.35 && body < atrNow * 0.35 && (candle.c - candle.l) > body;
}
function tmTurtleReclaim(rows, dir){
  if (!rows || rows.length < 8) return null;
  var current = rows[rows.length - 1];
  var prev = rows[rows.length - 2];
  var look = rows.slice(-8, -2);
  if (dir === 'long'){
    var recentLow = Math.min.apply(null, look.map(function(bar){ return bar.l; }));
    var swept = prev.l < recentLow || current.l < recentLow;
    return !!(swept && current.c > recentLow && current.c > current.o);
  }
  var recentHigh = Math.max.apply(null, look.map(function(bar){ return bar.h; }));
  var sweptH = prev.h > recentHigh || current.h > recentHigh;
  return !!(sweptH && current.c < recentHigh && current.c < current.o);
}
function tmDisplacementFvg(rows, dir){
  if (!rows || rows.length < 4 || typeof atr !== 'function') return null;
  var series = atr(rows, 14);
  var atrNow = series && series.length ? series[series.length - 1] : NaN;
  if (!(atrNow > 0)) return null;
  var c0 = rows[rows.length - 3], c1 = rows[rows.length - 2], c2 = rows[rows.length - 1];
  if (!c0 || !c1 || !c2) return null;
  var body = Math.abs(c1.c - c1.o);
  if (!(body > 1.4 * atrNow)) return false;
  if (dir === 'long') return c1.c > c1.o && c2.l > c0.h;
  return c1.c < c1.o && c0.l > c2.h;
}
function tmSynergy(row, dir, extras){
  var score = 0;
  var c = (row && row.comps) || {};
  if (dir === 'long' && c.d1Trend > 0) score += 25;
  else if (dir === 'short' && c.d1Trend < 0) score += 25;
  if (dir === 'long' && c.h4Cascade > 0) score += 25;
  else if (dir === 'short' && c.h4Cascade < 0) score += 25;
  var rows1 = tmClosedRows(row && row.rows1h, 3600);
  if (rows1 && rows1.length >= 52 && typeof ichimoku === 'function'){
    try {
      var ic = ichimoku(rows1);
      var i1 = rows1.length - 1;
      var a = ic.senkouA[i1], b = ic.senkouB[i1], px = rows1[i1].c;
      if (isFinite(a) && isFinite(b) && isFinite(px)){
        var top = Math.max(a, b), bot = Math.min(a, b);
        if (dir === 'long' && px > top) score += 25;
        if (dir === 'short' && px < bot) score += 25;
      }
    } catch (e) {}
  }
  if (extras && extras.body && extras.takerOk) score += 25;
  return score;
}
function tmBarVol(bar){
  if (!bar) return NaN;
  var v = bar.v != null ? bar.v : bar.volume;
  return isFinite(+v) && +v > 0 ? +v : NaN;
}
function tmPullbackRvol(rows, dir, level){
  if (!rows || rows.length < 24 || !isFinite(level)) return 'unread';
  var start = rows.length - 3, touch = [], prior = [], i, v, tagged;
  for (i = 0; i < rows.length; i++){
    v = tmBarVol(rows[i]);
    if (i >= start){
      tagged = dir === 'long' ? rows[i].l <= level : rows[i].h >= level;
      if (!tagged) continue;
      if (!isFinite(v)) return 'unread';
      touch.push(v);
    } else if (i >= start - 20 && isFinite(v)) prior.push(v);
  }
  if (!touch.length || prior.length < 8) return 'unread';
  var avg = prior.reduce(function(a, b){ return a + b; }, 0) / prior.length;
  if (!(avg > 0)) return 'unread';
  return touch.reduce(function(a, b){ return a + b; }, 0) / touch.length / avg;
}
function tmTriggerRvol(rows){
  if (!rows || rows.length < 12) return null;
  var last = tmBarVol(rows[rows.length - 1]);
  var prior = [], i, v;
  for (i = Math.max(0, rows.length - 21); i < rows.length - 1; i++){
    v = tmBarVol(rows[i]);
    if (isFinite(v)) prior.push(v);
  }
  if (!isFinite(last) || prior.length < 8) return null;
  var avg = prior.reduce(function(a, b){ return a + b; }, 0) / prior.length;
  if (!(avg > 0)) return null;
  return last / avg;
}
async function tmFundingZ(row){
  var fn = (typeof binanceFundingHist === 'function') ? binanceFundingHist : (W && W.binanceFundingHist);
  if (typeof fn !== 'function' || typeof tmBaseOf !== 'function') return null;
  try {
    var hist = await fn(tmBaseOf(row) + 'USDT', 30);
    if (!hist || hist.length < 12) return null;
    var rates = [], i;
    for (i = 0; i < hist.length; i++) if (isFinite(+hist[i].rate)) rates.push(+hist[i].rate);
    if (rates.length < 12) return null;
    var mean = rates.reduce(function(a, b){ return a + b; }, 0) / rates.length;
    var varr = 0;
    for (i = 0; i < rates.length; i++) varr += (rates[i] - mean) * (rates[i] - mean);
    var sd = Math.sqrt(varr / rates.length);
    if (!(sd > 0)) return null;
    return (rates[rates.length - 1] - mean) / sd;
  } catch (e) { return null; }
}
function tm15HeavyAgainst(rows, dir){
  if (!rows || rows.length < 10) return false;
  var last = rows[rows.length - 1], prev = rows[rows.length - 2];
  if (!last || !prev || !(last.v > 0)) return false;
  var sum = 0, n = 0, i;
  for (i = Math.max(0, rows.length - 9); i < rows.length - 1; i++){
    if (rows[i] && rows[i].v > 0){ sum += rows[i].v; n++; }
  }
  if (!(n >= 4) || !(last.v > (sum / n) * 1.4)) return false;
  if (dir === 'long' && last.c < prev.l && last.c < last.o) return true;
  if (dir === 'short' && last.c > prev.h && last.c > last.o) return true;
  return false;
}
function trendmxValueChipHtml(r){
  try {
    var dir = tmDirOf(r);
    var st = tmValueState(r, dir);
    if (!st || !st.reasons.length){
      if (st && isFinite(st.adx4) && isFinite(st.distAtr)) return '<span class="stamp pass" style="margin-left:6px">4h ADX ' + st.adx4.toFixed(0) + ' · ' + st.distAtr.toFixed(1) + 'x EMA21</span>';
      return '';
    }
    return '<span class="stamp bad" style="margin-left:6px">' + escH(st.reasons[0]) + '</span>';
  } catch (e) { return ''; }
}
function trendmxEmaTag(rows4h, dir){
  var rows = tmClosedRows(rows4h, 14400);
  if (!rows || rows.length < 30 || typeof ema !== 'function') return { state: 'waiting' };
  var closes = rows.map(function(r){ return r ? r.c : NaN; });
  var e9 = ema(closes, 9), e21 = ema(closes, 21);
  var i = closes.length - 1, px = closes[i];
  var cands = [];
  if (dir === 'long'){
    if (isFinite(e9[i]) && e9[i] < px) cands.push(['EMA9', e9]);
    if (isFinite(e21[i]) && e21[i] < px) cands.push(['EMA21', e21]);
  } else {
    if (isFinite(e9[i]) && e9[i] > px) cands.push(['EMA9', e9]);
    if (isFinite(e21[i]) && e21[i] > px) cands.push(['EMA21', e21]);
  }
  if (!cands.length) return { state: 'waiting' };
  cands.sort(function(a, b){ return Math.abs(a[1][i] - px) - Math.abs(b[1][i] - px); });
  var name = cands[0][0], series = cands[0][1];
  var from = Math.max(1, rows.length - 6);
  for (var k = from; k < rows.length; k++){
    var level = series[k], bar = rows[k];
    if (!bar || !isFinite(level)) continue;
    if (dir === 'long' && bar.l <= level && bar.c > level) return { state: 'ready', ema: name };
    if (dir === 'short' && bar.h >= level && bar.c < level) return { state: 'ready', ema: name };
  }
  return { state: 'waiting', ema: name };
}
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
      /* A cross on the daily bar that is still forming does not count. */
      var dClosed = tmClosedRows(rows1d, 86400);
      var cClosed = dClosed.map(function(r){ return r ? r.c : NaN; });
      var e50c = ema(cClosed, 50), e200c = ema(cClosed, 200);
      if (crossedRecently(crossOver(e50c, e200c), 10)) out.freshCross = 'GOLDEN';
      else if (crossedRecently(crossUnder(e50c, e200c), 10)) out.freshCross = 'DEATH';

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
