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
function tmStalled(rows, dir){
  if (!rows || rows.length < 5 || typeof atr !== 'function') return null;
  var series = atr(rows, 14);
  var atrNow = series && series.length ? series[series.length - 1] : NaN;
  if (!(atrNow > 0)) return null;
  var base = rows[rows.length - 4];
  var last = rows[rows.length - 1];
  var moved = dir === 'long' ? last.c - base.c : base.c - last.c;
  return moved < 0.3 * atrNow;
}
function tmRunnerR(rows){
  var pk = tmParkinsonHot(rows);
  if (!pk) return null;
  return pk.hot ? 4 : 2.2;
}
function tmAsiaChop(now){
  now = now || new Date();
  var t = now.getUTCHours() + now.getUTCMinutes() / 60;
  return t >= 0 && t < 6.5;
}
function tmChandelier(rows, dir, entry){
  if (!rows || rows.length < 8 || typeof atr !== 'function') return null;
  if (!(entry > 0)) return null;
  var series = atr(rows, 14);
  var a = series && series.length ? series[series.length - 1] : NaN;
  if (!(a > 0)) return null;
  var look = rows.slice(-8), i, px;
  if (dir === 'long'){
    px = look[0].h;
    for (i = 1; i < look.length; i++) if (look[i].h > px) px = look[i].h;
    px = px - 2 * a;
    if (!(px < entry)) return null;
  } else {
    px = look[0].l;
    for (i = 1; i < look.length; i++) if (look[i].l < px) px = look[i].l;
    px = px + 2 * a;
    if (!(px > entry)) return null;
  }
  return isFinite(px) ? px : null;
}
function tmEmaSeries(values, period){
  if (!values || values.length <= period) return null;
  var out = new Array(values.length);
  var i, sum = 0, k = 2 / (period + 1), seed;
  for (i = 0; i < period; i++) sum += values[i];
  seed = sum / period;
  out[period - 1] = seed;
  for (i = 0; i < period - 1; i++) out[i] = NaN;
  for (i = period; i < values.length; i++) out[i] = values[i] * k + out[i - 1] * (1 - k);
  return out;
}
function tmWaveOk(rows, dir){
  if (!rows || rows.length < 40) return null;
  var i, ap = [];
  for (i = 0; i < rows.length; i++) ap.push((rows[i].h + rows[i].l + rows[i].c) / 3);
  var esa = tmEmaSeries(ap, 10);
  if (!esa) return null;
  var diff = [];
  for (i = 0; i < ap.length; i++) diff.push(Math.abs(ap[i] - (isFinite(esa[i]) ? esa[i] : ap[i])));
  var d = tmEmaSeries(diff, 10);
  if (!d) return null;
  var ci = [];
  for (i = 0; i < ap.length; i++){
    var den = 0.015 * d[i];
    ci.push(den > 0 && isFinite(esa[i]) ? (ap[i] - esa[i]) / den : 0);
  }
  var wt1 = tmEmaSeries(ci, 21);
  if (!wt1) return null;
  var n = wt1.length - 1;
  if (!isFinite(wt1[n]) || !isFinite(wt1[n - 1])) return null;
  function sma4(idx){
    var s = 0, k;
    for (k = idx - 3; k <= idx; k++){
      if (!isFinite(wt1[k])) return NaN;
      s += wt1[k];
    }
    return s / 4;
  }
  var wt2 = sma4(n), prev2 = sma4(n - 1);
  if (!isFinite(wt2) || !isFinite(prev2)) return null;
  var green = wt1[n - 1] <= prev2 && wt1[n] > wt2;
  var red = wt1[n - 1] >= prev2 && wt1[n] < wt2;
  if (dir === 'long') return green && wt1[n - 1] <= -30;
  return red && wt1[n - 1] >= 30;
}
function tmKernel(rows, lookback, bandwidth){
  lookback = lookback || 24;
  bandwidth = bandwidth || 8;
  if (!rows || rows.length < lookback + 1) return null;
  function at(end){
    var sumW = 0, sum = 0, j, w;
    for (j = 0; j < lookback; j++){
      w = Math.pow(1 + (j * j) / (2 * bandwidth * bandwidth), -1);
      sumW += w;
      sum += rows[end - j].c * w;
    }
    return sumW > 0 ? sum / sumW : NaN;
  }
  var cur = at(rows.length - 1);
  var prev = at(rows.length - 2);
  if (!isFinite(cur) || !isFinite(prev)) return null;
  return { slopeUp: cur >= prev, above: rows[rows.length - 1].c >= cur };
}
function tmSuperTrend(rows, period, mult){
  if (!rows || rows.length < period + 5 || typeof atr !== 'function') return null;
  var a = atr(rows, period);
  if (!a || a.length < rows.length) return null;
  var i, up, dn, trend = null, prevUp = NaN, prevDn = NaN, prevClose, hl2, c;
  for (i = period; i < rows.length; i++){
    if (!(a[i] > 0)) return null;
    hl2 = (rows[i].h + rows[i].l) / 2;
    if (!isFinite(prevUp)) up = hl2 + mult * a[i];
    else up = ((hl2 + mult * a[i]) < prevUp || prevClose > prevUp) ? hl2 + mult * a[i] : prevUp;
    if (!isFinite(prevDn)) dn = hl2 - mult * a[i];
    else dn = ((hl2 - mult * a[i]) > prevDn || prevClose < prevDn) ? hl2 - mult * a[i] : prevDn;
    c = rows[i].c;
    if (trend == null) trend = c >= hl2;
    else if (trend && c < dn) trend = false;
    else if (!trend && c > up) trend = true;
    prevUp = up;
    prevDn = dn;
    prevClose = c;
  }
  if (trend == null) return null;
  return { up: trend };
}
function tmCmf(rows, period){
  period = period || 20;
  if (!rows || rows.length < period) return null;
  var slice = rows.slice(-period);
  var mfv = 0, vol = 0, i, k, range, mfm;
  for (i = 0; i < slice.length; i++){
    k = slice[i];
    if (!(k.v > 0)) return null;
    range = k.h - k.l;
    mfm = range > 0 ? ((k.c - k.l) - (k.h - k.c)) / range : 0;
    mfv += mfm * k.v;
    vol += k.v;
  }
  if (!(vol > 0)) return null;
  return mfv / vol;
}
function tmSqueezeHigh(rows){
  if (!rows || rows.length < 20 || typeof atr !== 'function') return null;
  var a = atr(rows, 20);
  var atrNow = a && a.length ? a[a.length - 1] : NaN;
  if (!(atrNow > 0)) return null;
  var slice = rows.slice(-20), i, sum = 0;
  for (i = 0; i < slice.length; i++) sum += slice[i].c;
  var sma = sum / slice.length, varr = 0;
  for (i = 0; i < slice.length; i++) varr += Math.pow(slice[i].c - sma, 2);
  var sd = Math.sqrt(varr / slice.length);
  return (sma + 2 * sd) < (sma + atrNow) && (sma - 2 * sd) > (sma - atrNow);
}
function tmWilderRsi(closes, period){
  if (!closes || closes.length < period + 2) return null;
  var i, gains = 0, losses = 0, d, out = new Array(closes.length);
  for (i = 0; i < closes.length; i++) out[i] = NaN;
  for (i = 1; i <= period; i++){
    d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  var avgGain = gains / period, avgLoss = losses / period;
  out[period] = (avgGain === 0 && avgLoss === 0) ? 50 : (avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  for (i = period + 1; i < closes.length; i++){
    d = closes[i] - closes[i - 1];
    avgGain = ((avgGain * (period - 1)) + (d > 0 ? d : 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + (d < 0 ? -d : 0)) / period;
    if (avgGain === 0 && avgLoss === 0) out[i] = 50;
    else if (avgLoss === 0) out[i] = 100;
    else out[i] = 100 - (100 / (1 + avgGain / avgLoss));
  }
  return out;
}
function tmQqe(rows, dir){
  if (!rows || rows.length < 40) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++) closes.push(rows[i].c);
  var rsi = tmWilderRsi(closes, 14);
  if (!rsi) return null;
  var smooth = tmEmaSeries(rsi.map(function(v){ return isFinite(v) ? v : 50; }), 5);
  if (!smooth) return null;
  var last = smooth[smooth.length - 1];
  if (!isFinite(last)) return null;
  if (dir === 'long') return last > 55;
  return last < 45;
}
function tmWmaAt(values, end, period){
  if (!values || end < period - 1 || end >= values.length) return NaN;
  var w = period * (period + 1) / 2, s = 0, i;
  for (i = 0; i < period; i++) s += values[end - period + 1 + i] * (i + 1);
  return s / w;
}
function tmHullRising(rows, period){
  period = period || 21;
  var half = Math.floor(period / 2);
  var root = Math.floor(Math.sqrt(period));
  if (!rows || rows.length < period + root + 2 || half < 2) return null;
  var closes = [], i, raw = [], a, b;
  for (i = 0; i < rows.length; i++) closes.push(rows[i].c);
  for (i = period - 1; i < closes.length; i++){
    a = tmWmaAt(closes, i, half);
    b = tmWmaAt(closes, i, period);
    if (!isFinite(a) || !isFinite(b)) return null;
    raw.push(2 * a - b);
  }
  if (raw.length < root + 1) return null;
  var cur = tmWmaAt(raw, raw.length - 1, root);
  var prev = tmWmaAt(raw, raw.length - 2, root);
  if (!isFinite(cur) || !isFinite(prev)) return null;
  return cur >= prev;
}
function tmVfi(rows, period, coef){
  period = period || 20;
  coef = (coef == null) ? 0.2 : coef;
  if (!rows || rows.length < period + 2) return null;
  var start = rows.length - period, mf = 0, vol = 0, i, tp, prev, tr, diff, cut;
  for (i = start; i < rows.length; i++){
    if (!(rows[i].v > 0)) return null;
    tp = (rows[i].h + rows[i].l + rows[i].c) / 3;
    prev = (rows[i - 1].h + rows[i - 1].l + rows[i - 1].c) / 3;
    tr = Math.max(rows[i].h - rows[i].l, Math.abs(rows[i].h - rows[i - 1].c), Math.abs(rows[i].l - rows[i - 1].c));
    cut = coef * tr;
    diff = tp - prev;
    vol += rows[i].v;
    if (diff > cut) mf += rows[i].v;
    else if (diff < -cut) mf -= rows[i].v;
  }
  if (!(vol > 0)) return null;
  return mf / vol;
}
function tmWt1Series(rows){
  if (!rows || rows.length < 40) return null;
  var i, ap = [];
  for (i = 0; i < rows.length; i++) ap.push((rows[i].h + rows[i].l + rows[i].c) / 3);
  var esa = tmEmaSeries(ap, 10);
  if (!esa) return null;
  var diff = [];
  for (i = 0; i < ap.length; i++) diff.push(Math.abs(ap[i] - (isFinite(esa[i]) ? esa[i] : ap[i])));
  var d = tmEmaSeries(diff, 10);
  if (!d) return null;
  var ci = [];
  for (i = 0; i < ap.length; i++){
    var den = 0.015 * d[i];
    ci.push(den > 0 && isFinite(esa[i]) ? (ap[i] - esa[i]) / den : 0);
  }
  return tmEmaSeries(ci, 21);
}
function tmWtDiverging(rows, dir){
  var wt = tmWt1Series(rows);
  if (!wt || rows.length < 40) return null;
  var n = rows.length - 1;
  function extreme(from, to, high){
    var idx = from, i;
    for (i = from + 1; i <= to; i++){
      if (high ? rows[i].h > rows[idx].h : rows[i].l < rows[idx].l) idx = i;
    }
    return idx;
  }
  var recent = extreme(n - 14, n, dir === 'long');
  var prior = extreme(n - 29, n - 15, dir === 'long');
  if (!isFinite(wt[recent]) || !isFinite(wt[prior])) return null;
  if (dir === 'long') return rows[recent].h > rows[prior].h && (wt[prior] - wt[recent]) > 10;
  return rows[recent].l < rows[prior].l && (wt[recent] - wt[prior]) > 10;
}
function tmFreshOb(rows, dir){
  if (!rows || rows.length < 20 || typeof atr !== 'function') return null;
  var a = atr(rows, 14);
  var atrNow = a && a.length ? a[a.length - 1] : NaN;
  if (!(atrNow > 0)) return null;
  var last = rows.length - 1;
  var px = rows[last].c;
  var i, j, o, up, dn, top, bot, hit;
  for (i = 3; i < last - 2; i++){
    o = rows[i];
    up = rows[i + 1];
    dn = rows[i + 2];
    if (dir === 'long'){
      if (!(o.c < o.o && up.c > up.o && dn.c > dn.o && (dn.c - o.c) >= 1.5 * atrNow)) continue;
    } else if (!(o.c > o.o && up.c < up.o && dn.c < dn.o && (o.c - dn.c) >= 1.5 * atrNow)) continue;
    top = o.h;
    bot = o.l;
    hit = false;
    for (j = i + 3; j < last; j++){
      if (dir === 'long' && rows[j].l <= top) { hit = true; break; }
      if (dir === 'short' && rows[j].h >= bot) { hit = true; break; }
    }
    if (hit) continue;
    if (px >= bot && px <= top) return true;
  }
  return false;
}
function tmUtBot(rows, key){
  if (!rows || rows.length < 20 || typeof atr !== 'function') return null;
  key = key || 2;
  var a = atr(rows, 10);
  if (!a || a.length < rows.length) return null;
  var stop = rows[0].c, i, c, prev, loss;
  for (i = 1; i < rows.length; i++){
    if (!(a[i] > 0)) return null;
    loss = key * a[i];
    c = rows[i].c;
    prev = rows[i - 1].c;
    if (c > stop && prev > stop) stop = Math.max(stop, c - loss);
    else if (c < stop && prev < stop) stop = Math.min(stop, c + loss);
    else stop = c > stop ? c - loss : c + loss;
  }
  return rows[rows.length - 1].c > stop ? 'buy' : 'sell';
}
function tmTrendMagic(rows, dir){
  if (!rows || rows.length < 55) return null;
  var tp = [], i, sum = 0;
  for (i = 0; i < rows.length; i++) tp.push((rows[i].h + rows[i].l + rows[i].c) / 3);
  var slice = tp.slice(-50);
  for (i = 0; i < slice.length; i++) sum += slice[i];
  var sma = sum / slice.length, dev = 0;
  for (i = 0; i < slice.length; i++) dev += Math.abs(slice[i] - sma);
  dev = dev / slice.length;
  if (!(dev > 0)) return null;
  var cci = (tp[tp.length - 1] - sma) / (0.015 * dev);
  if (dir === 'long') return cci > 0;
  return cci < 0;
}
function tmAlpha(rows, dir){
  if (!rows || rows.length < 20 || typeof atr !== 'function') return null;
  var start = rows.length - 14, pos = 0, neg = 0, i, tp, prev, money;
  for (i = start + 1; i < rows.length; i++){
    if (!(rows[i].v > 0)) return null;
    tp = (rows[i].h + rows[i].l + rows[i].c) / 3;
    prev = (rows[i - 1].h + rows[i - 1].l + rows[i - 1].c) / 3;
    money = tp * rows[i].v;
    if (tp > prev) pos += money;
    else if (tp < prev) neg += money;
  }
  if (!(pos + neg > 0)) return null;
  var mfi = neg === 0 ? 100 : (pos === 0 ? 0 : 100 - (100 / (1 + pos / neg)));
  var a = atr(rows, 14);
  var atrNow = a && a.length ? a[a.length - 1] : NaN;
  if (!(atrNow > 0) || rows.length < 4) return null;
  var up = rows[rows.length - 1].l - atrNow;
  var prevUp = rows[rows.length - 3].l - atrNow;
  var dn = rows[rows.length - 1].h + atrNow;
  var prevDn = rows[rows.length - 3].h + atrNow;
  if (dir === 'long') return mfi > 50 && up >= prevUp;
  return mfi < 50 && dn <= prevDn;
}
function tmRangeFilter(rows, dir){
  if (!rows || rows.length < 20 || typeof atr !== 'function') return null;
  var a = atr(rows, 14);
  if (!a || a.length < rows.length) return null;
  var filter = rows[0].c, way = 0, i, c, range;
  for (i = 1; i < rows.length; i++){
    if (!(a[i] > 0)) return null;
    range = 2 * a[i];
    c = rows[i].c;
    if (c > filter + range){ filter = c - range; way = 1; }
    else if (c < filter - range){ filter = c + range; way = -1; }
  }
  if (way === 0) return null;
  var px = rows[rows.length - 1].c;
  if (dir === 'long') return way === 1 && px > filter;
  return way === -1 && px < filter;
}
function tmLorentz(rows, dir){
  if (!rows || rows.length < 40) return null;
  function feat(i){
    if (i < 4 || !(rows[i].c > 0) || !(rows[i - 1].c > 0) || !(rows[i - 4].c > 0)) return null;
    var range = rows[i].h - rows[i].l;
    if (!(range > 0)) return null;
    return [
      (rows[i].c - rows[i - 4].c) / rows[i - 4].c,
      range / rows[i].c,
      (rows[i].c - rows[i - 1].c) / rows[i - 1].c,
      Math.abs(rows[i].c - rows[i].o) / range
    ];
  }
  var now = feat(rows.length - 1);
  if (!now) return null;
  var mem = [], i, f, dist, j, future;
  for (i = 10; i < rows.length - 4; i++){
    f = feat(i);
    if (!f) continue;
    dist = 0;
    for (j = 0; j < 4; j++) dist += Math.log(1 + Math.abs(now[j] - f[j]));
    future = rows[i + 3].c - rows[i].c;
    if (future === 0) continue;
    mem.push({ dist: dist, label: future > 0 ? 1 : -1 });
  }
  if (mem.length < 7) return null;
  mem.sort(function(a, b){ return a.dist - b.dist; });
  var votes = 0, k;
  for (k = 0; k < 7; k++) votes += mem[k].label;
  if (votes === 0) return false;
  if (dir === 'long') return votes > 0;
  return votes < 0;
}
function tmHalfTrend(rows, dir){
  if (!rows || rows.length < 20 || typeof atr !== 'function') return null;
  var a = atr(rows, 10);
  if (!a || a.length < rows.length) return null;
  var trend = 0, stop = rows[0].c, i, c, dev;
  for (i = 1; i < rows.length; i++){
    if (!(a[i] > 0)) return null;
    dev = a[i];
    c = rows[i];
    if (trend === 0){
      if (c.c > rows[i - 1].h){ trend = 1; stop = c.l - dev; }
      else if (c.c < rows[i - 1].l){ trend = -1; stop = c.h + dev; }
      continue;
    }
    if (trend === 1){
      stop = Math.max(stop, c.l - dev);
      if (c.c < stop){ trend = -1; stop = c.h + dev; }
    } else {
      stop = Math.min(stop, c.h + dev);
      if (c.c > stop){ trend = 1; stop = c.l - dev; }
    }
  }
  if (trend === 0) return null;
  if (dir === 'long') return trend === 1;
  return trend === -1;
}
function tmWae(rows, dir){
  if (!rows || rows.length < 50 || typeof atr !== 'function') return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++) closes.push(rows[i].c);
  var fast = tmEmaSeries(closes, 20);
  var slow = tmEmaSeries(closes, 40);
  if (!fast || !slow) return null;
  var n = closes.length - 1;
  if (!isFinite(fast[n]) || !isFinite(slow[n]) || !isFinite(fast[n - 1]) || !isFinite(slow[n - 1])) return null;
  var diff = ((fast[n] - slow[n]) - (fast[n - 1] - slow[n - 1])) * 150;
  var slice = closes.slice(-20), sum = 0;
  for (i = 0; i < slice.length; i++) sum += slice[i];
  var sma = sum / slice.length, varr = 0;
  for (i = 0; i < slice.length; i++) varr += Math.pow(slice[i] - sma, 2);
  var width = 4 * Math.sqrt(varr / slice.length);
  var a = atr(rows, 14);
  var dead = a && a.length ? a[a.length - 1] * 3.7 : NaN;
  if (!(dead > 0) || !(width >= 0)) return null;
  var power = Math.abs(diff);
  if (!(power > width && power > dead)) return false;
  if (dir === 'long') return diff > 0;
  return diff < 0;
}
function tmMomBar(rows, end, length){
  if (end < length - 1) return NaN;
  var slice = rows.slice(end - length + 1, end + 1);
  var hh = slice[0].h, ll = slice[0].l, sum = 0, i;
  for (i = 0; i < slice.length; i++){
    if (slice[i].h > hh) hh = slice[i].h;
    if (slice[i].l < ll) ll = slice[i].l;
    sum += slice[i].c;
  }
  var mid = ((hh + ll) / 2 + sum / slice.length) / 2;
  return rows[end].c - mid;
}
function tmSqueezeMom(rows, dir){
  if (!rows || rows.length < 22) return null;
  var n = rows.length - 1;
  var cur = tmMomBar(rows, n, 20);
  var prev = tmMomBar(rows, n - 1, 20);
  if (!isFinite(cur) || !isFinite(prev)) return null;
  if (dir === 'long') return cur > 0 && cur > prev;
  return cur < 0 && cur < prev;
}
function tmDamiani(rows){
  if (!rows || rows.length < 45 || typeof atr !== 'function') return null;
  function last(period){
    var a = atr(rows, period);
    return a && a.length ? a[a.length - 1] : NaN;
  }
  var v13 = last(13), v20 = last(20), v40 = last(40);
  if (!(v13 > 0) || !(v20 > 0) || !(v40 > 0)) return null;
  var slice = rows.slice(-13), i, sum = 0;
  for (i = 0; i < slice.length; i++) sum += slice[i].c;
  var mean = sum / slice.length, varr = 0;
  for (i = 0; i < slice.length; i++) varr += Math.pow(slice[i].c - mean, 2);
  var sd = Math.sqrt(varr / slice.length);
  return (v13 / v20) > ((v40 / v20) + (sd / v20));
}
function tmAroon(rows, dir){
  var period = 14;
  if (!rows || rows.length < period) return null;
  var win = rows.slice(-period);
  var hi = 0, lo = 0, i;
  for (i = 1; i < win.length; i++){
    if (win[i].h >= win[hi].h) hi = i;
    if (win[i].l <= win[lo].l) lo = i;
  }
  var up = (100 * (period - ((period - 1) - hi))) / period;
  var down = (100 * (period - ((period - 1) - lo))) / period;
  if (dir === 'long') return up >= 70 && up > down;
  return down >= 70 && down > up;
}
function tmElder(rows, dir){
  if (!rows || rows.length < 20) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++) closes.push(rows[i].c);
  var ema = tmEmaSeries(closes, 13);
  if (!ema) return null;
  var n = rows.length - 1;
  if (!isFinite(ema[n]) || !isFinite(ema[n - 1])) return null;
  var bull = rows[n].h - ema[n];
  var bear = rows[n].l - ema[n];
  if (dir === 'long') return bull > 0 && bear > 0;
  return bull < 0 && bear < 0;
}
function tmVwmaSide(rows, dir){
  if (!rows || rows.length < 20) return null;
  var slice = rows.slice(-20);
  var pv = 0, vol = 0, sum = 0, i, k;
  for (i = 0; i < slice.length; i++){
    k = slice[i];
    if (!(k.v > 0)) return null;
    pv += k.c * k.v;
    vol += k.v;
    sum += k.c;
  }
  if (!(vol > 0)) return null;
  var vwma = pv / vol;
  var sma = sum / slice.length;
  var px = slice[slice.length - 1].c;
  if (dir === 'long') return px > vwma && vwma > sma;
  return px < vwma && vwma < sma;
}
function tmDmi(rows, dir){
  var len = 14;
  if (!rows || rows.length < len * 2 + 2) return null;
  var tr = [], pd = [], md = [], i;
  for (i = 1; i < rows.length; i++){
    var up = rows[i].h - rows[i - 1].h;
    var dn = rows[i - 1].l - rows[i].l;
    pd.push(up > dn && up > 0 ? up : 0);
    md.push(dn > up && dn > 0 ? dn : 0);
    tr.push(Math.max(rows[i].h - rows[i].l, Math.abs(rows[i].h - rows[i - 1].c), Math.abs(rows[i].l - rows[i - 1].c)));
  }
  if (tr.length < len + len) return null;
  function wilder(src){
    var s = 0, out = [], j;
    for (j = 0; j < len; j++) s += src[j];
    out.push(s);
    for (j = len; j < src.length; j++) out.push(out[out.length - 1] - (out[out.length - 1] / len) + src[j]);
    return out;
  }
  var trS = wilder(tr), pdS = wilder(pd), mdS = wilder(md);
  var dx = [], pdi = NaN, mdi = NaN, k;
  for (k = 0; k < trS.length; k++){
    if (!(trS[k] > 0)) return null;
    pdi = 100 * pdS[k] / trS[k];
    mdi = 100 * mdS[k] / trS[k];
    var den = pdi + mdi;
    dx.push(den > 0 ? (100 * Math.abs(pdi - mdi) / den) : 0);
  }
  if (dx.length < len || !isFinite(pdi) || !isFinite(mdi)) return null;
  var adx = 0;
  for (k = 0; k < len; k++) adx += dx[k];
  adx /= len;
  for (k = len; k < dx.length; k++) adx = ((adx * (len - 1)) + dx[k]) / len;
  if (!(adx >= 18 && adx <= 70)) return false;
  if (dir === 'long') return pdi > mdi;
  return mdi > pdi;
}
function tmBbSide(rows, dir){
  var n = 20;
  if (!rows || rows.length < n) return null;
  var slice = rows.slice(-n), sum = 0, i, v = 0;
  for (i = 0; i < slice.length; i++) sum += slice[i].c;
  var sma = sum / n;
  for (i = 0; i < slice.length; i++) v += Math.pow(slice[i].c - sma, 2);
  var sd = Math.sqrt(v / n);
  if (!(sd > 0)) return null;
  var pct = (slice[n - 1].c - (sma - 2 * sd)) / (4 * sd);
  if (dir === 'long') return pct >= 0.5 && pct <= 0.95;
  return pct <= 0.5 && pct >= 0.05;
}
function tmHlMid(rows, end, len){
  if (!rows || end < len - 1 || end >= rows.length) return NaN;
  var hi = -Infinity, lo = Infinity, i, bar;
  for (i = end - len + 1; i <= end; i++){
    bar = rows[i];
    if (!bar || !isFinite(bar.h) || !isFinite(bar.l)) return NaN;
    if (bar.h > hi) hi = bar.h;
    if (bar.l < lo) lo = bar.l;
  }
  if (!isFinite(hi) || !isFinite(lo)) return NaN;
  return (hi + lo) / 2;
}
function tmIchiSignal(rows, dir){
  if (!rows || rows.length < 52) return null;
  var i = rows.length - 1;
  var ten = tmHlMid(rows, i, 9);
  var kij = tmHlMid(rows, i, 26);
  var ago = rows[i - 26] && rows[i - 26].c;
  var px = rows[i].c;
  if (!isFinite(ten) || !isFinite(kij) || !(ago > 0) || !(px > 0)) return null;
  if (ten === kij) return false;
  if (dir === 'long') return ten > kij && px > ago;
  return ten < kij && px < ago;
}
function tmVwapStretch(rows, dir){
  if (!rows || rows.length < 14 || typeof tmSessionVwap !== 'function' || typeof atr !== 'function') return null;
  var vwap = tmSessionVwap(rows);
  var series = atr(rows, 14);
  var atrNow = series && series.length ? series[series.length - 1] : NaN;
  var px = rows[rows.length - 1] && rows[rows.length - 1].c;
  if (!isFinite(vwap) || !(atrNow > 0) || !(px > 0)) return null;
  var dist = (px - vwap) / atrNow;
  if (dir === 'long') return dist > 0 && dist <= 2;
  return dist < 0 && dist >= -2;
}
/* SSL channel (high/low SMA, length 10). The state only flips when close
   crosses the high average or the low average. No flip yet is not a pass. */
function tmSsl(rows, dir){
  var len = 10;
  if (!rows || rows.length < len + 2 || (dir !== 'long' && dir !== 'short')) return null;
  var hlv = 0, i, j, sh, sl, c;
  for (i = len - 1; i < rows.length; i++){
    sh = 0; sl = 0;
    for (j = i - len + 1; j <= i; j++){
      if (!isFinite(rows[j].h) || !isFinite(rows[j].l) || !isFinite(rows[j].c)) return null;
      sh += rows[j].h;
      sl += rows[j].l;
    }
    sh /= len; sl /= len;
    c = rows[i].c;
    if (c > sh) hlv = 1;
    else if (c < sl) hlv = -1;
  }
  if (hlv === 0) return false;
  return dir === 'long' ? hlv === 1 : hlv === -1;
}
function tmRsiSeries(closes, len){
  if (!closes || closes.length < len + 1) return null;
  var gains = 0, losses = 0, i, ch, g, l, avgG, avgL;
  for (i = 1; i <= len; i++){
    ch = closes[i] - closes[i - 1];
    if (!isFinite(ch)) return null;
    if (ch >= 0) gains += ch; else losses -= ch;
  }
  avgG = gains / len; avgL = losses / len;
  var out = new Array(closes.length);
  for (i = 0; i < closes.length; i++) out[i] = NaN;
  out[len] = avgL === 0 ? 100 : 100 - (100 / (1 + avgG / avgL));
  for (i = len + 1; i < closes.length; i++){
    ch = closes[i] - closes[i - 1];
    if (!isFinite(ch)) return null;
    g = ch > 0 ? ch : 0;
    l = ch < 0 ? -ch : 0;
    avgG = (avgG * (len - 1) + g) / len;
    avgL = (avgL * (len - 1) + l) / len;
    out[i] = avgL === 0 ? 100 : 100 - (100 / (1 + avgG / avgL));
  }
  return out;
}
/* Stochastic RSI (14, 14, 3). The trade side of 50 agrees. Rolling off
   the extreme (leaving 90 for a long, leaving 10 for a short) does not. */
function tmStochRsi(rows, dir){
  var rsiLen = 14, stochLen = 14, smooth = 3;
  if (!rows || rows.length < rsiLen + stochLen + smooth + 2 || (dir !== 'long' && dir !== 'short')) return null;
  var closes = [], i, j;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(rows[i].c)) return null;
    closes.push(rows[i].c);
  }
  var rsi = tmRsiSeries(closes, rsiLen);
  if (!rsi) return null;
  var raw = new Array(closes.length);
  for (i = 0; i < closes.length; i++) raw[i] = NaN;
  for (i = rsiLen + stochLen - 1; i < closes.length; i++){
    var hi = -Infinity, lo = Infinity;
    for (j = i - stochLen + 1; j <= i; j++){
      if (!isFinite(rsi[j])) return null;
      if (rsi[j] > hi) hi = rsi[j];
      if (rsi[j] < lo) lo = rsi[j];
    }
    raw[i] = hi === lo ? (rsi[i] > 70 ? 100 : (rsi[i] < 30 ? 0 : 50)) : ((rsi[i] - lo) / (hi - lo)) * 100;
  }
  function smaEnd(end){
    if (end < smooth - 1) return NaN;
    var s = 0, k;
    for (k = end - smooth + 1; k <= end; k++){
      if (!isFinite(raw[k])) return NaN;
      s += raw[k];
    }
    return s / smooth;
  }
  var n = closes.length - 1;
  var kNow = smaEnd(n), kPrev = smaEnd(n - 1);
  if (!isFinite(kNow) || !isFinite(kPrev)) return null;
  if (dir === 'long') return kNow > 50 && !(kPrev >= 90 && kNow < kPrev);
  return kNow < 50 && !(kPrev <= 10 && kNow > kPrev);
}
/* Ehlers Fisher Transform, length 10. With the trade means the right side
   of zero and still moving that way. */
function tmFisher(rows, dir){
  var len = 10;
  if (!rows || rows.length < len + 3 || (dir !== 'long' && dir !== 'short')) return null;
  var val = 0, fish = 0, prev = 0, i, j, hi, lo, x, next;
  for (i = len - 1; i < rows.length; i++){
    hi = -Infinity; lo = Infinity;
    for (j = i - len + 1; j <= i; j++){
      if (!isFinite(rows[j].h) || !isFinite(rows[j].l)) return null;
      if (rows[j].h > hi) hi = rows[j].h;
      if (rows[j].l < lo) lo = rows[j].l;
    }
    if (!(hi > lo)) x = 0;
    else x = 0.66 * ((((rows[i].h + rows[i].l) / 2) - lo) / (hi - lo) - 0.5) + 0.67 * val;
    if (x > 0.999) x = 0.999;
    if (x < -0.999) x = -0.999;
    val = x;
    next = 0.5 * Math.log((1 + x) / (1 - x)) + 0.5 * fish;
    prev = fish;
    fish = next;
  }
  if (!isFinite(fish) || !isFinite(prev)) return null;
  if (dir === 'long') return fish > 0 && fish >= prev;
  return fish < 0 && fish <= prev;
}
/* Wilder Parabolic SAR. A long needs the stop under price. A short needs
   it over price. A tape too short to place the stop does not pass. */
function tmPsar(rows, dir){
  if (!rows || rows.length < 8 || (dir !== 'long' && dir !== 'short')) return null;
  var i;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(rows[i].h) || !isFinite(rows[i].l) || !isFinite(rows[i].c)) return null;
  }
  var step = 0.02, cap = 0.2;
  var up = rows[1].c >= rows[0].c;
  var sar = up ? rows[0].l : rows[0].h;
  var ep = up ? rows[1].h : rows[1].l;
  var af = step;
  for (i = 2; i < rows.length; i++){
    var next = sar + af * (ep - sar);
    if (up){
      next = Math.min(next, rows[i - 1].l, rows[i - 2].l);
      if (rows[i].l < next){
        up = false; next = ep; ep = rows[i].l; af = step;
      } else if (rows[i].h > ep){
        ep = rows[i].h; af = Math.min(cap, af + step);
      }
    } else {
      next = Math.max(next, rows[i - 1].h, rows[i - 2].h);
      if (rows[i].h > next){
        up = true; next = ep; ep = rows[i].h; af = step;
      } else if (rows[i].l < ep){
        ep = rows[i].l; af = Math.min(cap, af + step);
      }
    }
    sar = next;
  }
  if (!isFinite(sar)) return null;
  var px = rows[rows.length - 1].c;
  if (dir === 'long') return up && px > sar;
  return !up && px < sar;
}
function tmEmaSeed(values, len){
  if (!values || values.length < len) return null;
  var k = 2 / (len + 1), out = new Array(values.length), sum = 0, i;
  for (i = 0; i < values.length; i++){
    if (!isFinite(values[i])) return null;
    if (i < len){
      sum += values[i];
      out[i] = i === len - 1 ? sum / len : NaN;
    } else out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}
/* Schaff Trend Cycle, 23/50/10. Above 50 and not falling for a long.
   Below 50 and not rising for a short. */
function tmSchaff(rows, dir){
  var fast = 23, slow = 50, cycle = 10, factor = 0.5;
  if (!rows || rows.length < slow + cycle * 2 || (dir !== 'long' && dir !== 'short')) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(rows[i].c)) return null;
    closes.push(rows[i].c);
  }
  var ef = tmEmaSeed(closes, fast), es = tmEmaSeed(closes, slow);
  if (!ef || !es) return null;
  var macd = new Array(closes.length);
  for (i = 0; i < closes.length; i++) macd[i] = (isFinite(ef[i]) && isFinite(es[i])) ? ef[i] - es[i] : NaN;
  function stochAt(src, end, asPercent){
    var hi = -Infinity, lo = Infinity, k;
    for (k = end - cycle + 1; k <= end; k++){
      if (!isFinite(src[k])) return NaN;
      if (src[k] > hi) hi = src[k];
      if (src[k] < lo) lo = src[k];
    }
    if (!(hi > lo) || (hi - lo) <= Math.max(1e-9, Math.abs(hi) * 1e-6)){
      if (asPercent) return Math.max(0, Math.min(100, src[end]));
      return src[end] > 0 ? 100 : (src[end] < 0 ? 0 : 50);
    }
    return ((src[end] - lo) / (hi - lo)) * 100;
  }
  var dSeries = new Array(closes.length), d = 0;
  for (i = 0; i < closes.length; i++) dSeries[i] = NaN;
  for (i = slow + cycle - 2; i < closes.length; i++){
    var kk = stochAt(macd, i, false);
    if (!isFinite(kk)) return null;
    d = factor * kk + (1 - factor) * d;
    dSeries[i] = d;
  }
  var stc = 0, prev = 0, seen = 0;
  for (i = slow + cycle * 2 - 2; i < closes.length; i++){
    var kd = stochAt(dSeries, i, true);
    if (!isFinite(kd)) return null;
    prev = stc;
    stc = factor * kd + (1 - factor) * stc;
    seen++;
  }
  if (seen < 2 || !isFinite(stc) || !isFinite(prev)) return null;
  if (dir === 'long') return stc > 50 && stc + 1e-8 >= prev;
  return stc < 50 && stc <= prev + 1e-8;
}
/* Vortex, length 14. The plus line has to lead a long. The minus line
   has to lead a short. A tie does not pass. */
function tmVortex(rows, dir){
  var len = 14;
  if (!rows || rows.length < len + 2 || (dir !== 'long' && dir !== 'short')) return null;
  var start = rows.length - len, vmp = 0, vmm = 0, tr = 0, i, c, p, range;
  for (i = start; i < rows.length; i++){
    c = rows[i]; p = rows[i - 1];
    if (!isFinite(c.h) || !isFinite(c.l) || !isFinite(c.c) || !isFinite(p.h) || !isFinite(p.l) || !isFinite(p.c)) return null;
    vmp += Math.abs(c.h - p.l);
    vmm += Math.abs(c.l - p.h);
    range = Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c));
    tr += range;
  }
  if (!(tr > 0)) return null;
  var plus = vmp / tr, minus = vmm / tr;
  if (dir === 'long') return plus > minus;
  return minus > plus;
}
function tmSmaWindow(values, end, len){
  if (!values || end < len - 1 || end >= values.length) return NaN;
  var s = 0, i;
  for (i = end - len + 1; i <= end; i++){
    if (!isFinite(values[i])) return NaN;
    s += values[i];
  }
  return s / len;
}
/* Bill Williams Awesome Oscillator. Median price, 5 versus 34.
   A long needs it above zero and not falling. */
function tmAwesome(rows, dir){
  var fast = 5, slow = 34;
  if (!rows || rows.length < slow + 2 || (dir !== 'long' && dir !== 'short')) return null;
  var med = [], i;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(rows[i].h) || !isFinite(rows[i].l)) return null;
    med.push((rows[i].h + rows[i].l) / 2);
  }
  var n = med.length - 1;
  var ao = tmSmaWindow(med, n, fast) - tmSmaWindow(med, n, slow);
  var prev = tmSmaWindow(med, n - 1, fast) - tmSmaWindow(med, n - 1, slow);
  if (!isFinite(ao) || !isFinite(prev)) return null;
  if (dir === 'long') return ao > 0 && ao + 1e-8 >= prev;
  return ao < 0 && ao <= prev + 1e-8;
}
/* Money Flow Index, 14. Volume has to be real. Above 50 agrees with a
   long unless it is rolling off 80. The mirror is the short. */
function tmMfi(rows, dir){
  var len = 14;
  if (!rows || rows.length < len + 2 || (dir !== 'long' && dir !== 'short')) return null;
  function at(end){
    var pos = 0, neg = 0, i, tp, prevTp, flow;
    for (i = end - len + 1; i <= end; i++){
      if (!(rows[i].v > 0) || !isFinite(rows[i].h) || !isFinite(rows[i].l) || !isFinite(rows[i].c)) return NaN;
      if (!isFinite(rows[i - 1].h) || !isFinite(rows[i - 1].l) || !isFinite(rows[i - 1].c)) return NaN;
      tp = (rows[i].h + rows[i].l + rows[i].c) / 3;
      prevTp = (rows[i - 1].h + rows[i - 1].l + rows[i - 1].c) / 3;
      flow = tp * rows[i].v;
      if (tp > prevTp) pos += flow;
      else if (tp < prevTp) neg += flow;
    }
    if (pos === 0 && neg === 0) return 50;
    if (neg === 0) return 100;
    if (pos === 0) return 0;
    return 100 - (100 / (1 + pos / neg));
  }
  var now = at(rows.length - 1), prev = at(rows.length - 2);
  if (!isFinite(now) || !isFinite(prev)) return null;
  if (dir === 'long') return now > 50 && !(prev >= 80 && now < prev);
  return now < 50 && !(prev <= 20 && now > prev);
}
function tmSmmaAt(values, end, len){
  if (!values || end < len - 1 || end >= values.length) return NaN;
  var sum = 0, i;
  for (i = 0; i < len; i++){
    if (!isFinite(values[i])) return NaN;
    sum += values[i];
  }
  var smma = sum / len;
  for (i = len; i <= end; i++){
    if (!isFinite(values[i])) return NaN;
    smma = (smma * (len - 1) + values[i]) / len;
  }
  return smma;
}
/* Williams Alligator. Lips (5, shift 3) lead teeth (8, shift 5),
   which lead the jaw (13, shift 8), and price is on that side. */
function tmAlligator(rows, dir){
  if (!rows || rows.length < 24 || (dir !== 'long' && dir !== 'short')) return null;
  var med = [], i;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(rows[i].h) || !isFinite(rows[i].l) || !isFinite(rows[i].c)) return null;
    med.push((rows[i].h + rows[i].l) / 2);
  }
  var n = med.length - 1;
  var lips = tmSmmaAt(med, n - 3, 5);
  var teeth = tmSmmaAt(med, n - 5, 8);
  var jaw = tmSmmaAt(med, n - 8, 13);
  var px = rows[n].c;
  if (!isFinite(lips) || !isFinite(teeth) || !isFinite(jaw) || !(px > 0)) return null;
  if (dir === 'long') return px > lips && lips > teeth && teeth > jaw;
  return px < lips && lips < teeth && teeth < jaw;
}
/* Commodity Channel Index, 20. Above zero agrees with a long.
   Below zero agrees with a short. A flat tape is not a pass. */
function tmCci(rows, dir){
  var len = 20;
  if (!rows || rows.length < len || (dir !== 'long' && dir !== 'short')) return null;
  var slice = rows.slice(-len), tp = [], i, sum = 0;
  for (i = 0; i < slice.length; i++){
    if (!isFinite(slice[i].h) || !isFinite(slice[i].l) || !isFinite(slice[i].c)) return null;
    tp.push((slice[i].h + slice[i].l + slice[i].c) / 3);
    sum += tp[i];
  }
  var mean = sum / len, dev = 0;
  for (i = 0; i < len; i++) dev += Math.abs(tp[i] - mean);
  dev /= len;
  if (!(dev > 0)) return false;
  var cci = (tp[len - 1] - mean) / (0.015 * dev);
  if (!isFinite(cci)) return null;
  if (dir === 'long') return cci > 0;
  return cci < 0;
}
/* Dreiss Choppiness Index, 14. Above 61.8 is chop, so neither side passes.
   The number does not care about direction. A short tape does not pass. */
function tmChop(rows, dir){
  var len = 14;
  if (!rows || rows.length < len + 1 || (dir !== 'long' && dir !== 'short')) return null;
  var start = rows.length - len, sum = 0, hi = -Infinity, lo = Infinity, i, bar, prev, tr;
  for (i = start; i < rows.length; i++){
    bar = rows[i]; prev = rows[i - 1];
    if (!isFinite(bar.h) || !isFinite(bar.l) || !isFinite(bar.c) || !isFinite(prev.c)) return null;
    tr = Math.max(bar.h - bar.l, Math.abs(bar.h - prev.c), Math.abs(bar.l - prev.c));
    if (!(tr >= 0)) return null;
    sum += tr;
    if (bar.h > hi) hi = bar.h;
    if (bar.l < lo) lo = bar.l;
  }
  if (!(hi > lo) || !(sum > 0)) return false;
  var chop = 100 * Math.log10(sum / (hi - lo)) / Math.log10(len);
  if (!isFinite(chop)) return null;
  return chop < 61.8;
}
/* Ehlers Relative Vigor Index, length 10. A long needs it above zero
   and not under its signal line. */
function tmRvi(rows, dir){
  var len = 10;
  if (!rows || rows.length < len + 6 || (dir !== 'long' && dir !== 'short')) return null;
  var co = [], hl = [], i, span;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(rows[i].o) || !isFinite(rows[i].h) || !isFinite(rows[i].l) || !isFinite(rows[i].c)) return null;
    co.push(rows[i].c - rows[i].o);
    span = rows[i].h - rows[i].l;
    hl.push(span > 0 ? span : 0);
  }
  function swma(arr, end){
    if (end < 3) return NaN;
    return (arr[end] + 2 * arr[end - 1] + 2 * arr[end - 2] + arr[end - 3]) / 6;
  }
  var rvis = [];
  for (i = 3; i < rows.length; i++){
    var num = 0, den = 0, k, sn, sd;
    if (i < 3 + len - 1){ rvis.push(NaN); continue; }
    for (k = i - len + 1; k <= i; k++){
      sn = swma(co, k); sd = swma(hl, k);
      if (!isFinite(sn) || !isFinite(sd)) return null;
      num += sn; den += sd;
    }
    rvis.push(den > 0 ? num / den : 0);
  }
  var n = rvis.length - 1;
  if (n < 3 || !isFinite(rvis[n]) || !isFinite(rvis[n - 1]) || !isFinite(rvis[n - 2]) || !isFinite(rvis[n - 3])) return null;
  var rvi = rvis[n];
  var signal = (rvis[n] + 2 * rvis[n - 1] + 2 * rvis[n - 2] + rvis[n - 3]) / 6;
  if (!isFinite(signal)) return null;
  if (dir === 'long') return rvi > 0 && rvi + 1e-8 >= signal;
  return rvi < 0 && rvi <= signal + 1e-8;
}
/* TRIX, length 15. Triple-smoothed rate of change. Above zero agrees
   with a long. Below zero agrees with a short. A short tape does not pass. */
function tmTrix(rows, dir){
  var len = 15;
  if (!rows || rows.length < len * 3 + 5 || (dir !== 'long' && dir !== 'short')) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(rows[i].c) || !(rows[i].c > 0)) return null;
    closes.push(rows[i].c);
  }
  function nextEma(values){
    var finite = [], k;
    for (k = 0; k < values.length; k++) if (isFinite(values[k])) finite.push(values[k]);
    if (finite.length < len + 2) return null;
    return tmEmaSeed(finite, len);
  }
  var e1 = nextEma(closes);
  var e2 = e1 ? nextEma(e1) : null;
  var e3 = e2 ? nextEma(e2) : null;
  if (!e3) return null;
  var n = e3.length - 1;
  var last = e3[n], prev = e3[n - 1], older = e3[n - 2];
  if (!(last > 0) || !(prev > 0) || !(older > 0)) return null;
  var now = (last - prev) / prev;
  var before = (prev - older) / older;
  if (!isFinite(now) || !isFinite(before)) return null;
  if (dir === 'long') return now > 0;
  return now < 0;
}
/* Larry Williams Ultimate Oscillator, 7/14/28. Above 50 agrees with a long. */
function tmUltimate(rows, dir){
  var slow = 28;
  if (!rows || rows.length < slow + 1 || (dir !== 'long' && dir !== 'short')) return null;
  var bp = [], tr = [], i, bar, prevC, low, high;
  for (i = 1; i < rows.length; i++){
    bar = rows[i]; prevC = rows[i - 1].c;
    if (!isFinite(bar.h) || !isFinite(bar.l) || !isFinite(bar.c) || !isFinite(prevC)) return null;
    low = Math.min(bar.l, prevC);
    high = Math.max(bar.h, prevC);
    bp.push(bar.c - low);
    tr.push(high - low);
  }
  function avg(n){
    if (bp.length < n) return NaN;
    var b = 0, t = 0, k;
    for (k = bp.length - n; k < bp.length; k++){ b += bp[k]; t += tr[k]; }
    if (!(t > 0)) return NaN;
    return b / t;
  }
  var a7 = avg(7), a14 = avg(14), a28 = avg(28);
  if (!isFinite(a7) || !isFinite(a14) || !isFinite(a28)) return null;
  var uo = 100 * ((4 * a7) + (2 * a14) + a28) / 7;
  if (!isFinite(uo)) return null;
  if (dir === 'long') return uo > 50;
  return uo < 50;
}
/* On-balance volume over the last 10 closes. Volume has to be real.
   A long needs the line higher than it was 10 bars ago. */
function tmObv(rows, dir){
  var look = 10;
  if (!rows || rows.length < look + 2 || (dir !== 'long' && dir !== 'short')) return null;
  var obv = 0, series = [0], i;
  for (i = 1; i < rows.length; i++){
    if (!isFinite(rows[i].c) || !isFinite(rows[i - 1].c) || !(rows[i].v > 0)) return null;
    if (rows[i].c > rows[i - 1].c) obv += rows[i].v;
    else if (rows[i].c < rows[i - 1].c) obv -= rows[i].v;
    series.push(obv);
  }
  var now = series[series.length - 1];
  var then = series[series.length - 1 - look];
  if (!isFinite(now) || !isFinite(then)) return null;
  if (dir === 'long') return now > then;
  return now < then;
}
/* Two Heikin Ashi candles in a row have to match the trade.
   A doji does not pass. A short tape does not pass. */
function tmHeikin(rows, dir){
  if (!rows || rows.length < 4 || (dir !== 'long' && dir !== 'short')) return null;
  var prevO = NaN, prevC = NaN, haO, haC, i, last = [];
  for (i = 0; i < rows.length; i++){
    var b = rows[i];
    if (!isFinite(b.o) || !isFinite(b.h) || !isFinite(b.l) || !isFinite(b.c)) return null;
    haC = (b.o + b.h + b.l + b.c) / 4;
    haO = i === 0 ? (b.o + b.c) / 2 : (prevO + prevC) / 2;
    prevO = haO;
    prevC = haC;
    last.push(haC - haO);
    if (last.length > 2) last.shift();
  }
  if (last.length < 2 || !isFinite(last[0]) || !isFinite(last[1])) return null;
  if (dir === 'long') return last[0] > 0 && last[1] > 0;
  return last[0] < 0 && last[1] < 0;
}
/* Elder Force Index, EMA 13 of close-change times volume.
   Missing volume does not pass. */
function tmForce(rows, dir){
  var len = 13;
  if (!rows || rows.length < len + 2 || (dir !== 'long' && dir !== 'short')) return null;
  var raw = [], i;
  for (i = 1; i < rows.length; i++){
    if (!isFinite(rows[i].c) || !isFinite(rows[i - 1].c) || !(rows[i].v > 0)) return null;
    raw.push((rows[i].c - rows[i - 1].c) * rows[i].v);
  }
  var ema = tmEmaSeed(raw, len);
  if (!ema) return null;
  var last = ema[ema.length - 1];
  if (!isFinite(last)) return null;
  if (dir === 'long') return last > 0;
  return last < 0;
}
/* Martin Pring Know Sure Thing. Above zero agrees with a long.
   Below zero agrees with a short. */
function tmKst(rows, dir){
  if (!rows || rows.length < 50 || (dir !== 'long' && dir !== 'short')) return null;
  var c = [], i;
  for (i = 0; i < rows.length; i++){
    if (!(rows[i].c > 0)) return null;
    c.push(rows[i].c);
  }
  function roc(n, end){
    if (end < n || !(c[end - n] > 0)) return NaN;
    return ((c[end] - c[end - n]) / c[end - n]) * 100;
  }
  function smaRoc(rocLen, smaLen, end){
    var s = 0, k, r;
    for (k = end - smaLen + 1; k <= end; k++){
      r = roc(rocLen, k);
      if (!isFinite(r)) return NaN;
      s += r;
    }
    return s / smaLen;
  }
  var end = c.length - 1;
  var a = smaRoc(10, 10, end);
  var b = smaRoc(15, 10, end);
  var d = smaRoc(20, 10, end);
  var e = smaRoc(30, 15, end);
  if (!isFinite(a) || !isFinite(b) || !isFinite(d) || !isFinite(e)) return null;
  var kst = a + (2 * b) + (3 * d) + (4 * e);
  if (!isFinite(kst)) return null;
  if (dir === 'long') return kst > 0;
  return kst < 0;
}
/* MACD 12/26/9. The line has to be on the trade side of zero and not
   under its signal. A short tape does not pass. */
function tmMacd(rows, dir){
  var fast = 12, slow = 26, sigLen = 9;
  if (!rows || rows.length < slow + sigLen + 2 || (dir !== 'long' && dir !== 'short')) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++){
    if (!(rows[i].c > 0)) return null;
    closes.push(rows[i].c);
  }
  var ef = tmEmaSeed(closes, fast), es = tmEmaSeed(closes, slow);
  if (!ef || !es) return null;
  var macd = [];
  for (i = 0; i < closes.length; i++){
    if (isFinite(ef[i]) && isFinite(es[i])) macd.push(ef[i] - es[i]);
  }
  if (macd.length < sigLen + 2) return null;
  var signal = tmEmaSeed(macd, sigLen);
  if (!signal) return null;
  var line = macd[macd.length - 1];
  var sigNow = signal[signal.length - 1];
  if (!isFinite(line) || !isFinite(sigNow)) return null;
  if (dir === 'long') return line > 0 && line + 1e-6 >= sigNow;
  return line < 0 && line <= sigNow + 1e-6;
}
/* Donchian midpoint, 20. A long has to close above the middle of the
   channel. A short has to close below it. A flat channel does not pass. */
function tmDonchian(rows, dir){
  var len = 20;
  if (!rows || rows.length < len || (dir !== 'long' && dir !== 'short')) return null;
  var slice = rows.slice(-len), hi = -Infinity, lo = Infinity, i;
  for (i = 0; i < slice.length; i++){
    if (!isFinite(slice[i].h) || !isFinite(slice[i].l) || !isFinite(slice[i].c)) return null;
    if (slice[i].h > hi) hi = slice[i].h;
    if (slice[i].l < lo) lo = slice[i].l;
  }
  if (!(hi > lo)) return false;
  var mid = (hi + lo) / 2;
  var px = slice[slice.length - 1].c;
  if (dir === 'long') return px > mid;
  return px < mid;
}
/* Chande Momentum Oscillator, 14. Above zero agrees with a long. */
function tmCmo(rows, dir){
  var len = 14;
  if (!rows || rows.length < len + 1 || (dir !== 'long' && dir !== 'short')) return null;
  var up = 0, down = 0, i, ch, start = rows.length - len;
  for (i = start; i < rows.length; i++){
    if (!isFinite(rows[i].c) || !isFinite(rows[i - 1].c)) return null;
    ch = rows[i].c - rows[i - 1].c;
    if (ch > 0) up += ch;
    else if (ch < 0) down -= ch;
  }
  if (!(up + down > 0)) return false;
  var cmo = 100 * (up - down) / (up + down);
  if (!isFinite(cmo)) return null;
  if (dir === 'long') return cmo > 0;
  return cmo < 0;
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
