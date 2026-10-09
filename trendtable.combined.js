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
/* Ichimoku cloud at this bar is the span pair from 26 bars ago.
   Price has to be above both spans for a long, and below both for a short. */
function tmKumo(rows, dir){
  if (!rows || rows.length < 80 || (dir !== 'long' && dir !== 'short')) return null;
  var back = rows.length - 1 - 26;
  if (back < 51) return null;
  var ten = tmHlMid(rows, back, 9);
  var kij = tmHlMid(rows, back, 26);
  var spanB = tmHlMid(rows, back, 52);
  if (!isFinite(ten) || !isFinite(kij) || !isFinite(spanB)) return null;
  var spanA = (ten + kij) / 2;
  var px = rows[rows.length - 1].c;
  if (!(px > 0)) return null;
  if (dir === 'long') return px > spanA && px > spanB;
  return px < spanA && px < spanB;
}
/* Blau True Strength Index, 25 then 13. Above zero agrees with a long. */
function tmTsi(rows, dir){
  var slow = 25, fast = 13;
  if (!rows || rows.length < slow + fast + 2 || (dir !== 'long' && dir !== 'short')) return null;
  var pc = [], abs = [], i, delta;
  for (i = 1; i < rows.length; i++){
    if (!isFinite(rows[i].c) || !isFinite(rows[i - 1].c)) return null;
    delta = rows[i].c - rows[i - 1].c;
    pc.push(delta);
    abs.push(Math.abs(delta));
  }
  function twice(values){
    var e1 = tmEmaSeed(values, slow);
    if (!e1) return null;
    var finite = [], k;
    for (k = 0; k < e1.length; k++) if (isFinite(e1[k])) finite.push(e1[k]);
    if (finite.length < fast + 1) return null;
    var e2 = tmEmaSeed(finite, fast);
    if (!e2) return null;
    var last = e2[e2.length - 1];
    return isFinite(last) ? last : null;
  }
  var num = twice(pc), den = twice(abs);
  if (num == null || den == null || !(Math.abs(den) > 0)) return null;
  var tsi = 100 * num / den;
  if (!isFinite(tsi)) return null;
  if (dir === 'long') return tsi > 0;
  return tsi < 0;
}
/* Chaikin Oscillator. Fast accumulation average minus the slow one.
   Missing volume does not pass. */
function tmChaikin(rows, dir){
  if (!rows || rows.length < 14 || (dir !== 'long' && dir !== 'short')) return null;
  var adl = 0, series = [], i, b, range, mfm;
  for (i = 0; i < rows.length; i++){
    b = rows[i];
    if (!isFinite(b.h) || !isFinite(b.l) || !isFinite(b.c) || !(b.v > 0)) return null;
    range = b.h - b.l;
    mfm = range > 0 ? (((b.c - b.l) - (b.h - b.c)) / range) : 0;
    adl += mfm * b.v;
    series.push(adl);
  }
  var fast = tmEmaSeed(series, 3), slowE = tmEmaSeed(series, 10);
  if (!fast || !slowE) return null;
  var f = fast[fast.length - 1], s = slowE[slowE.length - 1];
  if (!isFinite(f) || !isFinite(s)) return null;
  var osc = f - s;
  if (dir === 'long') return osc > 0;
  return osc < 0;
}
/* Detrended Price Oscillator, 20. Price has to be above the average
   that sat 11 bars back for a long, and below it for a short. */
function tmDpo(rows, dir){
  var len = 20, shift = Math.floor(len / 2) + 1;
  if (!rows || rows.length < len + shift || (dir !== 'long' && dir !== 'short')) return null;
  var end = rows.length - 1 - shift, start = end - len + 1, sum = 0, i;
  if (start < 0) return null;
  for (i = start; i <= end; i++){
    if (!(rows[i].c > 0)) return null;
    sum += rows[i].c;
  }
  var px = rows[rows.length - 1].c;
  if (!(px > 0)) return null;
  var dpo = px - (sum / len);
  if (!isFinite(dpo)) return null;
  if (dir === 'long') return dpo > 0;
  return dpo < 0;
}
/* Arms Ease of Movement, 14. The midpoint has to be moving with the trade.
   Missing volume or a zero range does not pass. */
function tmEase(rows, dir){
  var len = 14;
  if (!rows || rows.length < len + 1 || (dir !== 'long' && dir !== 'short')) return null;
  var emv = [], i, b, p, range, mid, prevMid;
  for (i = 1; i < rows.length; i++){
    b = rows[i]; p = rows[i - 1];
    if (!isFinite(b.h) || !isFinite(b.l) || !isFinite(p.h) || !isFinite(p.l) || !(b.v > 0)) return null;
    range = b.h - b.l;
    if (!(range > 0)) return null;
    mid = (b.h + b.l) / 2;
    prevMid = (p.h + p.l) / 2;
    emv.push(((mid - prevMid) * range) / b.v);
  }
  var slice = emv.slice(-len), sum = 0;
  for (i = 0; i < slice.length; i++){
    if (!isFinite(slice[i])) return null;
    sum += slice[i];
  }
  var avg = sum / len;
  if (dir === 'long') return avg > 0;
  return avg < 0;
}
/* Dorsey Relative Volatility Index, 10. This is not the Relative Vigor Index.
   Above 50 agrees with a long. Below 50 agrees with a short. */
function tmRelVol(rows, dir){
  var len = 10;
  if (!rows || rows.length < len * 2 || (dir !== 'long' && dir !== 'short')) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++){
    if (!(rows[i].c > 0)) return null;
    closes.push(rows[i].c);
  }
  function stdevAt(end){
    if (end < len - 1) return NaN;
    var s = 0, k, m, v = 0, d;
    for (k = end - len + 1; k <= end; k++) s += closes[k];
    m = s / len;
    for (k = end - len + 1; k <= end; k++){ d = closes[k] - m; v += d * d; }
    return Math.sqrt(v / len);
  }
  var up = 0, dn = 0, start = closes.length - len, sd, ch;
  for (i = start; i < closes.length; i++){
    sd = stdevAt(i);
    if (!isFinite(sd)) return null;
    ch = closes[i] - closes[i - 1];
    if (ch > 0) up += sd;
    else if (ch < 0) dn += sd;
  }
  if (!(up + dn > 0)) return false;
  var rvi = 100 * up / (up + dn);
  if (!isFinite(rvi)) return null;
  if (dir === 'long') return rvi > 50;
  return rvi < 50;
}
/* Coppock Curve. Weighted average of the 11-bar and 14-bar rate of change.
   Above zero agrees with a long. A short tape does not pass. */
function tmCoppock(rows, dir){
  var wmaLen = 10, r1 = 11, r2 = 14;
  if (!rows || rows.length < r2 + wmaLen || (dir !== 'long' && dir !== 'short')) return null;
  var c = [], i;
  for (i = 0; i < rows.length; i++){
    if (!(rows[i].c > 0)) return null;
    c.push(rows[i].c);
  }
  function roc(end, n){
    if (end < n || !(c[end - n] > 0)) return NaN;
    return ((c[end] - c[end - n]) / c[end - n]) * 100;
  }
  var sum = 0, w = 0, end = c.length - 1;
  for (i = 0; i < wmaLen; i++){
    var v = roc(end - (wmaLen - 1 - i), r1) + roc(end - (wmaLen - 1 - i), r2);
    if (!isFinite(v)) return null;
    var weight = i + 1;
    sum += v * weight;
    w += weight;
  }
  var cop = sum / w;
  if (!isFinite(cop)) return null;
  if (dir === 'long') return cop > 0;
  return cop < 0;
}
/* Ehlers Laguerre RSI, gamma 0.5. Above one half agrees with a long.
   This is not Stochastic RSI. */
function tmLaguerre(rows, dir){
  var gamma = 0.5;
  if (!rows || rows.length < 16 || (dir !== 'long' && dir !== 'short')) return null;
  if (!(rows[0].c > 0)) return null;
  var L0 = rows[0].c, L1 = L0, L2 = L0, L3 = L0, lrsi = NaN, i;
  for (i = 1; i < rows.length; i++){
    var price = rows[i].c;
    if (!(price > 0)) return null;
    var p0 = L0, p1 = L1, p2 = L2, p3 = L3;
    L0 = (1 - gamma) * price + gamma * p0;
    L1 = -gamma * L0 + p0 + gamma * p1;
    L2 = -gamma * L1 + p1 + gamma * p2;
    L3 = -gamma * L2 + p2 + gamma * p3;
    var cu = 0, cd = 0;
    function side(d){ if (d > 0) cu += d; else if (d < 0) cd -= d; }
    side(L0 - L1); side(L1 - L2); side(L2 - L3);
    if (!(cu + cd > 0)) return null;
    lrsi = cu / (cu + cd);
  }
  if (!isFinite(lrsi)) return null;
  if (dir === 'long') return lrsi > 0.5;
  return lrsi < 0.5;
}
/* Least-squares slope of the last 20 closes. A long needs it rising.
   A flat fit does not pass. */
function tmLinreg(rows, dir){
  var len = 20;
  if (!rows || rows.length < len || (dir !== 'long' && dir !== 'short')) return null;
  var slice = rows.slice(-len), n = len, sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, i;
  for (i = 0; i < n; i++){
    if (!(slice[i].c > 0)) return null;
    sumX += i;
    sumY += slice[i].c;
    sumXY += i * slice[i].c;
    sumXX += i * i;
  }
  var den = n * sumXX - sumX * sumX;
  if (!(den > 0)) return null;
  var slope = (n * sumXY - sumX * sumY) / den;
  if (!isFinite(slope)) return null;
  if (dir === 'long') return slope > 0;
  return slope < 0;
}
/* Williams %R, 14. Above -50 agrees with a long. Below -50 agrees with a short.
   A flat range does not pass. */
function tmWilliams(rows, dir){
  var len = 14;
  if (!rows || rows.length < len || (dir !== 'long' && dir !== 'short')) return null;
  var slice = rows.slice(-len), hi = -Infinity, lo = Infinity, i;
  for (i = 0; i < slice.length; i++){
    if (!isFinite(slice[i].h) || !isFinite(slice[i].l) || !(slice[i].c > 0)) return null;
    if (slice[i].h > hi) hi = slice[i].h;
    if (slice[i].l < lo) lo = slice[i].l;
  }
  if (!(hi > lo)) return null;
  var wr = ((hi - slice[slice.length - 1].c) / (hi - lo)) * -100;
  if (!isFinite(wr)) return null;
  if (dir === 'long') return wr > -50;
  return wr < -50;
}
/* Balance of Power, 14. The close has to be on the trade side of the open.
   A zero range does not pass. */
function tmBop(rows, dir){
  var len = 14;
  if (!rows || rows.length < len || (dir !== 'long' && dir !== 'short')) return null;
  var slice = rows.slice(-len), sum = 0, i, b, range;
  for (i = 0; i < slice.length; i++){
    b = slice[i];
    if (!isFinite(b.h) || !isFinite(b.l) || !isFinite(b.o) || !(b.c > 0)) return null;
    range = b.h - b.l;
    if (!(range > 0)) return null;
    sum += (b.c - b.o) / range;
  }
  var avg = sum / len;
  if (!isFinite(avg) || avg === 0) return false;
  if (dir === 'long') return avg > 0;
  return avg < 0;
}
/* Klinger volume oscillator, 34/55. Volume force has to be on the trade side
   of zero. A short tape or missing volume does not pass. */
function tmKlinger(rows, dir){
  if (!rows || rows.length < 70 || (dir !== 'long' && dir !== 'short')) return null;
  var vf = [], cm = 0, prevTrend = 0, i, b, p, tp, prevTp, trend, dm;
  for (i = 1; i < rows.length; i++){
    b = rows[i];
    p = rows[i - 1];
    if (!(b.c > 0) || !(p.c > 0) || !(b.v > 0) || !isFinite(b.h) || !isFinite(b.l) || !isFinite(p.h) || !isFinite(p.l)) return null;
    tp = (b.h + b.l + b.c) / 3;
    prevTp = (p.h + p.l + p.c) / 3;
    trend = tp >= prevTp ? 1 : -1;
    dm = b.h - b.l;
    if (!(dm > 0)) return null;
    cm = trend === prevTrend ? cm + dm : dm;
    prevTrend = trend;
    if (!(cm > 0)) return null;
    vf.push(b.v * Math.abs(2 * (dm / cm) - 1) * trend * 100);
  }
  var fast = tmEmaSeed(vf, 34), slow = tmEmaSeed(vf, 55);
  if (!fast || !slow) return null;
  var kvo = fast[fast.length - 1] - slow[slow.length - 1];
  if (!isFinite(kvo) || kvo === 0) return false;
  if (dir === 'long') return kvo > 0;
  return kvo < 0;
}
function tmSeedEma(values, len){
  if (!values || !values.length) return null;
  var k = 2 / (len + 1), ema = null, out = [], i;
  for (i = 0; i < values.length; i++){
    if (!isFinite(values[i])) return null;
    ema = ema == null ? values[i] : (values[i] * k + ema * (1 - k));
    out.push(ema);
  }
  return out;
}
/* Stochastic Momentum Index, 10/3/3. Above zero agrees with a long.
   A flat high-low range does not pass. */
function tmSmi(rows, dir){
  var len = 10, smooth = 3;
  if (!rows || rows.length < len + 12 || (dir !== 'long' && dir !== 'short')) return null;
  var diff = [], rng = [], i, k, hi, lo;
  for (i = len - 1; i < rows.length; i++){
    hi = -Infinity;
    lo = Infinity;
    for (k = i - len + 1; k <= i; k++){
      if (!isFinite(rows[k].h) || !isFinite(rows[k].l) || !(rows[k].c > 0)) return null;
      if (rows[k].h > hi) hi = rows[k].h;
      if (rows[k].l < lo) lo = rows[k].l;
    }
    if (!(hi > lo)) return null;
    diff.push(rows[i].c - (hi + lo) / 2);
    rng.push(hi - lo);
  }
  var d2 = tmSeedEma(tmSeedEma(diff, smooth), smooth);
  var r2 = tmSeedEma(tmSeedEma(rng, smooth), smooth);
  if (!d2 || !r2 || !(r2[r2.length - 1] > 0)) return null;
  var smi = 200 * d2[d2.length - 1] / r2[r2.length - 1];
  if (!isFinite(smi) || smi === 0) return false;
  if (dir === 'long') return smi > 0;
  return smi < 0;
}
/* Triple EMA, 21. The TEMA itself has to be moving with the trade.
   A flat TEMA does not pass. */
function tmTema(rows, dir){
  var len = 21;
  if (!rows || rows.length < len * 2 || (dir !== 'long' && dir !== 'short')) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++){
    if (!(rows[i].c > 0)) return null;
    closes.push(rows[i].c);
  }
  var e1 = tmSeedEma(closes, len);
  var e2 = e1 ? tmSeedEma(e1, len) : null;
  var e3 = e2 ? tmSeedEma(e2, len) : null;
  if (!e1 || !e3) return null;
  var n = closes.length - 1;
  var now = 3 * e1[n] - 3 * e2[n] + e3[n];
  var prev = 3 * e1[n - 1] - 3 * e2[n - 1] + e3[n - 1];
  if (!isFinite(now) || !isFinite(prev) || now === prev) return false;
  if (dir === 'long') return now > prev;
  return now < prev;
}
/* Elder Impulse. A long does not pass when the 13 EMA and the MACD histogram
   are both falling. A short does not pass when both are rising. */
function tmImpulse(rows, dir){
  if (!rows || rows.length < 35 || (dir !== 'long' && dir !== 'short')) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++){
    if (!(rows[i].c > 0)) return null;
    closes.push(rows[i].c);
  }
  var ema = tmSeedEma(closes, 13);
  var e12 = tmSeedEma(closes, 12);
  var e26 = tmSeedEma(closes, 26);
  if (!ema || !e12 || !e26) return null;
  var macd = [], n = closes.length;
  for (i = 0; i < n; i++) macd.push(e12[i] - e26[i]);
  var sig = tmSeedEma(macd, 9);
  if (!sig) return null;
  var last = n - 1;
  var hist = macd[last] - sig[last];
  var histPrev = macd[last - 1] - sig[last - 1];
  if (!isFinite(hist) || !isFinite(histPrev)) return null;
  if (dir === 'long') return !(ema[last] < ema[last - 1] && hist < histPrev);
  return !(ema[last] > ema[last - 1] && hist > histPrev);
}
function tmFractals(rows){
  var wing = 2, highs = [], lows = [], i, k, isH, isL;
  for (i = wing; i < rows.length - wing; i++){
    if (!isFinite(rows[i].h) || !isFinite(rows[i].l)) return null;
    isH = true;
    isL = true;
    for (k = i - wing; k <= i + wing; k++){
      if (k === i) continue;
      if (!isFinite(rows[k].h) || !isFinite(rows[k].l)) return null;
      if (!(rows[i].h > rows[k].h)) isH = false;
      if (!(rows[i].l < rows[k].l)) isL = false;
    }
    if (isH) highs.push(i);
    if (isL) lows.push(i);
  }
  return { highs: highs, lows: lows };
}
/* Bearish RSI divergence refuses a long. Bullish divergence refuses a short.
   No second swing means there is nothing against the trade. A short tape does not pass. */
function tmRsiDiv(rows, dir){
  if (!rows || rows.length < 20 || (dir !== 'long' && dir !== 'short')) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++){
    if (!(rows[i].c > 0) || !isFinite(rows[i].h) || !isFinite(rows[i].l)) return null;
    closes.push(rows[i].c);
  }
  var rsi = tmRsiSeries(closes, 14);
  var sw = tmFractals(rows);
  if (!rsi || !sw) return null;
  var pair = dir === 'long' ? sw.highs : sw.lows;
  var picked = [], i;
  for (i = pair.length - 1; i >= 0 && picked.length < 2; i--){
    if (isFinite(rsi[pair[i]])) picked.push(pair[i]);
  }
  if (picked.length < 2) return true;
  var b = picked[0], a = picked[1];
  if (dir === 'long' && rows[b].h > rows[a].h && rsi[b] < rsi[a]) return false;
  if (dir === 'short' && rows[b].l < rows[a].l && rsi[b] > rsi[a]) return false;
  return true;
}
/* Price Volume Trend. The last six bars have to carry volume with the trade.
   Missing volume does not pass. A flat trend does not pass. */
function tmPvt(rows, dir){
  if (!rows || rows.length < 16 || (dir !== 'long' && dir !== 'short')) return null;
  var pvt = 0, series = [0], i;
  for (i = 1; i < rows.length; i++){
    if (!(rows[i].v > 0) || !(rows[i - 1].c > 0) || !(rows[i].c > 0)) return null;
    pvt += rows[i].v * (rows[i].c - rows[i - 1].c) / rows[i - 1].c;
    series.push(pvt);
  }
  var now = series[series.length - 1], prev = series[series.length - 6];
  if (!isFinite(now) || !isFinite(prev) || now === prev) return false;
  if (dir === 'long') return now > prev;
  return now < prev;
}
/* Two lower highs and two lower lows refuse a long. The mirror refuses a short.
   One swing is not structure, so it does not refuse. */
function tmStructure(rows, dir){
  if (!rows || rows.length < 15 || (dir !== 'long' && dir !== 'short')) return null;
  var i;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(rows[i].h) || !isFinite(rows[i].l) || !(rows[i].c > 0)) return null;
  }
  var sw = tmFractals(rows);
  if (!sw) return null;
  if (sw.highs.length < 2 || sw.lows.length < 2) return true;
  var h1 = sw.highs[sw.highs.length - 2], h2 = sw.highs[sw.highs.length - 1];
  var l1 = sw.lows[sw.lows.length - 2], l2 = sw.lows[sw.lows.length - 1];
  var bear = rows[h2].h < rows[h1].h && rows[l2].l < rows[l1].l;
  var bull = rows[h2].h > rows[h1].h && rows[l2].l > rows[l1].l;
  if (dir === 'long') return !bear;
  return !bull;
}
/* A wick through the prior 20-bar extreme that closes back inside, on a candle
   against the trade. A close through the extreme does not refuse. */
function tmFailedBreak(rows, dir){
  var len = 20;
  if (!rows || rows.length < len + 1 || (dir !== 'long' && dir !== 'short')) return null;
  var last = rows[rows.length - 1];
  var look = rows.slice(-(len + 1), -1);
  var hi = -Infinity, lo = Infinity, i;
  for (i = 0; i < look.length; i++){
    if (!isFinite(look[i].h) || !isFinite(look[i].l) || !(look[i].c > 0)) return null;
    if (look[i].h > hi) hi = look[i].h;
    if (look[i].l < lo) lo = look[i].l;
  }
  var h = +last.h, l = +last.l, o = +last.o, c = +last.c;
  if (!isFinite(h) || !isFinite(l) || !isFinite(o) || !(c > 0) || !(hi > lo)) return null;
  if (dir === 'long' && h > hi && c <= hi && c < o) return false;
  if (dir === 'short' && l < lo && c >= lo && c > o) return false;
  return true;
}
/* Session VWAP from 00:00 UTC. Losing it on this bar does not pass.
   Fewer than four bars in the session does not pass. */
function tmVwapLost(rows, dir){
  if (!rows || rows.length < 4 || (dir !== 'long' && dir !== 'short')) return null;
  var lastT = +rows[rows.length - 1].t;
  if (!isFinite(lastT)) return null;
  if (lastT < 1e12) lastT = lastT * 1000;
  var day = new Date(lastT).toISOString().slice(0, 10);
  var sess = [], i, b, tb, key;
  for (i = 0; i < rows.length; i++){
    b = rows[i];
    tb = +b.t;
    if (!isFinite(tb)) return null;
    if (tb < 1e12) tb = tb * 1000;
    key = new Date(tb).toISOString().slice(0, 10);
    if (key !== day) continue;
    if (!(+b.c > 0) || !isFinite(+b.h) || !isFinite(+b.l)) return null;
    sess.push(b);
  }
  if (sess.length < 4) return null;
  function vwap(list){
    var s = 0, vol = 0, j, bar, v, tp;
    for (j = 0; j < list.length; j++){
      bar = list[j];
      v = +bar.v;
      if (!(v > 0)) v = 1;
      tp = (+bar.h + +bar.l + +bar.c) / 3;
      s += tp * v;
      vol += v;
    }
    return vol > 0 ? s / vol : NaN;
  }
  var prevV = vwap(sess.slice(0, -1));
  var nowV = vwap(sess);
  var prevC = +sess[sess.length - 2].c;
  var c = +sess[sess.length - 1].c;
  if (!isFinite(prevV) || !isFinite(nowV)) return null;
  if (dir === 'long' && prevC > prevV && c < nowV) return false;
  if (dir === 'short' && prevC < prevV && c > nowV) return false;
  return true;
}
/* A close through the latest swing against the trade is a break of structure.
   No swing means there is nothing against the trade. */
function tmBos(rows, dir){
  if (!rows || rows.length < 15 || (dir !== 'long' && dir !== 'short')) return null;
  var i;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(rows[i].h) || !isFinite(rows[i].l) || !(rows[i].c > 0)) return null;
  }
  var sw = tmFractals(rows);
  if (!sw) return null;
  var c = +rows[rows.length - 1].c;
  if (dir === 'long'){
    if (!sw.lows.length) return true;
    return !(c < rows[sw.lows[sw.lows.length - 1]].l);
  }
  if (!sw.highs.length) return true;
  return !(c > rows[sw.highs[sw.highs.length - 1]].h);
}
/* Yesterday's high or low. A wick through it that closes back inside, on a
   candle against the trade, does not pass. A tiny prior day does not refuse.
   No prior day in the tape does not refuse. */
function tmPriorDay(rows, dir){
  if (!rows || rows.length < 8 || (dir !== 'long' && dir !== 'short')) return null;
  function dayOf(t){
    var ms = +t;
    if (!isFinite(ms)) return null;
    if (ms < 1e12) ms = ms * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  var today = dayOf(rows[rows.length - 1].t);
  if (!today) return null;
  var prevDay = null, i, key;
  for (i = 0; i < rows.length - 1; i++){
    key = dayOf(rows[i].t);
    if (!key) return null;
    if (key !== today) prevDay = key;
  }
  if (!prevDay) return true;
  var hi = -Infinity, lo = Infinity, n = 0;
  for (i = 0; i < rows.length - 1; i++){
    if (dayOf(rows[i].t) !== prevDay) continue;
    if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l)) return null;
    if (+rows[i].h > hi) hi = +rows[i].h;
    if (+rows[i].l < lo) lo = +rows[i].l;
    n++;
  }
  if (n < 4 || !(hi > lo)) return true;
  var last = rows[rows.length - 1];
  var h = +last.h, l = +last.l, o = +last.o, c = +last.c;
  if (!isFinite(h) || !isFinite(l) || !isFinite(o) || !(c > 0)) return null;
  if ((hi - lo) / c < 0.004) return true;
  if (dir === 'long' && h > hi && c <= hi && c < o) return false;
  if (dir === 'short' && l < lo && c >= lo && c > o) return false;
  return true;
}
/* The last body covers the prior body and is at least 0.6 of the 14-bar ATR.
   A smaller candle does not refuse. */
function tmEngulf(rows, dir){
  if (!rows || rows.length < 16 || (dir !== 'long' && dir !== 'short')) return null;
  var atr = 0, i, tr, pc;
  for (i = rows.length - 14; i < rows.length; i++){
    if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l) || !(+rows[i - 1].c > 0)) return null;
    pc = +rows[i - 1].c;
    tr = Math.max(+rows[i].h - +rows[i].l, Math.abs(+rows[i].h - pc), Math.abs(+rows[i].l - pc));
    atr += tr;
  }
  atr = atr / 14;
  if (!(atr > 0)) return null;
  var prev = rows[rows.length - 2], last = rows[rows.length - 1];
  var o = +last.o, c = +last.c, po = +prev.o, pc2 = +prev.c;
  if (!isFinite(o) || !(c > 0) || !isFinite(po) || !(pc2 > 0)) return null;
  if (Math.abs(c - o) < 0.6 * atr) return true;
  var top = Math.max(po, pc2), bot = Math.min(po, pc2);
  if (dir === 'long' && c < o && o >= top && c <= bot) return false;
  if (dir === 'short' && c > o && o <= bot && c >= top) return false;
  return true;
}
/* Mother bar, then an inside bar, then a wick back inside the mother.
   No inside bar does not refuse. */
function tmInsideFail(rows, dir){
  if (!rows || rows.length < 8 || (dir !== 'long' && dir !== 'short')) return null;
  var m = rows[rows.length - 3], inn = rows[rows.length - 2], last = rows[rows.length - 1];
  if (!isFinite(+m.h) || !isFinite(+m.l) || !isFinite(+inn.h) || !isFinite(+inn.l)) return null;
  if (!isFinite(+last.h) || !isFinite(+last.l) || !isFinite(+last.o) || !(+last.c > 0)) return null;
  if (!(+inn.h < +m.h && +inn.l > +m.l)) return true;
  if (dir === 'long' && +last.h > +m.h && +last.c <= +m.h && +last.c < +last.o) return false;
  if (dir === 'short' && +last.l < +m.l && +last.c >= +m.l && +last.c > +last.o) return false;
  return true;
}
/* Price makes a higher high while On-Balance Volume makes a lower high.
   That refuses a long. The mirror refuses a short. One swing does not refuse.
   Missing volume does not pass. */
function tmObvDiv(rows, dir){
  if (!rows || rows.length < 20 || (dir !== 'long' && dir !== 'short')) return null;
  var obv = 0, series = [0], i;
  for (i = 1; i < rows.length; i++){
    if (!(+rows[i].v > 0) || !(+rows[i].c > 0) || !(+rows[i - 1].c > 0)) return null;
    if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l)) return null;
    if (+rows[i].c > +rows[i - 1].c) obv += +rows[i].v;
    else if (+rows[i].c < +rows[i - 1].c) obv -= +rows[i].v;
    series.push(obv);
  }
  var sw = tmFractals(rows);
  if (!sw) return null;
  var pair = dir === 'long' ? sw.highs : sw.lows;
  if (pair.length < 2) return true;
  var a = pair[pair.length - 2], b = pair[pair.length - 1];
  if (dir === 'long' && rows[b].h > rows[a].h && series[b] < series[a]) return false;
  if (dir === 'short' && rows[b].l < rows[a].l && series[b] > series[a]) return false;
  return true;
}
/* The UTC day open. Losing it on this bar does not pass.
   Fewer than two bars in the session does not refuse. */
function tmDayOpen(rows, dir){
  if (!rows || !rows.length || (dir !== 'long' && dir !== 'short')) return null;
  function dayOf(t){
    var ms = +t;
    if (!isFinite(ms)) return null;
    if (ms < 1e12) ms = ms * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  var today = dayOf(rows[rows.length - 1].t);
  if (!today) return null;
  var sess = [], i, key;
  for (i = 0; i < rows.length; i++){
    key = dayOf(rows[i].t);
    if (!key) return null;
    if (key === today) sess.push(rows[i]);
  }
  if (sess.length < 2) return true;
  var open = +sess[0].o;
  var prevC = +sess[sess.length - 2].c;
  var c = +sess[sess.length - 1].c;
  if (!(open > 0) || !(prevC > 0) || !(c > 0)) return null;
  if (dir === 'long' && prevC > open && c < open) return false;
  if (dir === 'short' && prevC < open && c > open) return false;
  return true;
}
/* A wick through the next round step that closes back through it, against the trade.
   Price not at a round step does not refuse. */
function tmRound(rows, dir){
  if (!rows || rows.length < 8 || (dir !== 'long' && dir !== 'short')) return null;
  var last = rows[rows.length - 1];
  var h = +last.h, l = +last.l, o = +last.o, c = +last.c;
  if (!(c > 0) || !isFinite(h) || !isFinite(l) || !isFinite(o)) return null;
  var mag = Math.pow(10, Math.floor(Math.log10(c)));
  var step = mag / 10;
  if (!(step > 0)) return null;
  if (dir === 'long' && c < o){
    var up = Math.floor(h / step) * step;
    if (h > up && c < up && up > 0) return false;
  }
  if (dir === 'short' && c > o){
    var dn = Math.ceil(l / step) * step;
    if (l < dn && c > dn && dn > 0) return false;
  }
  return true;
}
/* A 9/21 cross on this bar. A cross on an earlier bar does not refuse. */
function tmEmaCross(rows, dir){
  if (!rows || rows.length < 30 || (dir !== 'long' && dir !== 'short')) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++){
    if (!(+rows[i].c > 0)) return null;
    closes.push(+rows[i].c);
  }
  var e9 = tmSeedEma(closes, 9), e21 = tmSeedEma(closes, 21);
  if (!e9 || !e21) return null;
  var n = closes.length - 1;
  if (dir === 'long' && e9[n - 1] >= e21[n - 1] && e9[n] < e21[n]) return false;
  if (dir === 'short' && e9[n - 1] <= e21[n - 1] && e9[n] > e21[n]) return false;
  return true;
}
/* The last two swing highs within 0.2% are a pool. A wick through them that
   closes back inside does not pass as a long. Equal lows are the short.
   No pair does not refuse. */
function tmEqSweep(rows, dir){
  if (!rows || rows.length < 20 || (dir !== 'long' && dir !== 'short')) return null;
  var i;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l) || !(+rows[i].c > 0)) return null;
  }
  var sw = tmFractals(rows);
  if (!sw) return null;
  var last = rows[rows.length - 1];
  var pool = dir === 'long' ? sw.highs : sw.lows;
  if (pool.length < 2) return true;
  var i1 = pool[pool.length - 2], i2 = pool[pool.length - 1];
  var p1 = dir === 'long' ? +rows[i1].h : +rows[i1].l;
  var p2 = dir === 'long' ? +rows[i2].h : +rows[i2].l;
  var mid = (p1 + p2) / 2;
  if (!(mid > 0)) return null;
  if (Math.abs(p1 - p2) / mid > 0.002) return true;
  var level = dir === 'long' ? Math.max(p1, p2) : Math.min(p1, p2);
  if (dir === 'long' && +last.h > level && +last.c <= level && +last.c < +last.o) return false;
  if (dir === 'short' && +last.l < level && +last.c >= level && +last.c > +last.o) return false;
  return true;
}
/* Losing the 61.8 of the last impulse on this bar. A level already lost
   does not refuse. A swing smaller than 0.4% does not refuse. */
function tmFibLost(rows, dir){
  if (!rows || rows.length < 20 || (dir !== 'long' && dir !== 'short')) return null;
  var i;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l) || !(+rows[i].c > 0)) return null;
  }
  var sw = tmFractals(rows);
  if (!sw || !sw.highs.length || !sw.lows.length) return true;
  var hi = sw.highs[sw.highs.length - 1], lo = sw.lows[sw.lows.length - 1];
  var prev = +rows[rows.length - 2].c, c = +rows[rows.length - 1].c;
  if (dir === 'long'){
    if (!(lo < hi)) return true;
    var low = +rows[lo].l, high = +rows[hi].h, span = high - low;
    if (!(span > 0) || span / c < 0.004) return true;
    var fib = high - 0.618 * span;
    if (prev >= fib && c < fib) return false;
    return true;
  }
  if (!(hi < lo)) return true;
  var top = +rows[hi].h, bot = +rows[lo].l, drop = top - bot;
  if (!(drop > 0) || drop / c < 0.004) return true;
  var fibS = bot + 0.618 * drop;
  if (prev <= fibS && c > fibS) return false;
  return true;
}
/* A climax bar: volume at least twice the prior 20-bar average, closing against
   the trade, with the rejection wick at least half the range. A normal bar does not refuse. */
function tmClimax(rows, dir){
  if (!rows || rows.length < 22 || (dir !== 'long' && dir !== 'short')) return null;
  var last = rows[rows.length - 1];
  var prior = rows.slice(-21, -1);
  var sum = 0, i;
  for (i = 0; i < prior.length; i++){
    if (!(+prior[i].v > 0)) return null;
    sum += +prior[i].v;
  }
  if (!(+last.v > 0) || !(+last.c > 0) || !isFinite(+last.o) || !isFinite(+last.h) || !isFinite(+last.l)) return null;
  var avg = sum / prior.length;
  if (!(avg > 0) || +last.v < avg * 2) return true;
  var range = +last.h - +last.l;
  if (!(range > 0)) return null;
  if (dir === 'long' && +last.c < +last.o && (+last.h - Math.max(+last.o, +last.c)) >= range * 0.5) return false;
  if (dir === 'short' && +last.c > +last.o && (Math.min(+last.o, +last.c) - +last.l) >= range * 0.5) return false;
  return true;
}
/* Monday 00:00 UTC open. Losing it on this bar does not pass.
   If that open is not in the tape, it does not refuse. */
function tmWeekOpen(rows, dir){
  if (!rows || !rows.length || (dir !== 'long' && dir !== 'short')) return null;
  function msOf(t){
    var ms = +t;
    if (!isFinite(ms)) return NaN;
    if (ms < 1e12) ms = ms * 1000;
    return ms;
  }
  var lastMs = msOf(rows[rows.length - 1].t);
  if (!isFinite(lastMs)) return null;
  var day = new Date(lastMs);
  var monday = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  var week = [], i, ms;
  for (i = 0; i < rows.length; i++){
    ms = msOf(rows[i].t);
    if (!isFinite(ms)) return null;
    if (ms >= monday) week.push(rows[i]);
  }
  if (week.length < 2) return true;
  var open = +week[0].o, prevC = +week[week.length - 2].c, c = +week[week.length - 1].c;
  if (!(open > 0) || !(prevC > 0) || !(c > 0)) return null;
  if (dir === 'long' && prevC > open && c < open) return false;
  if (dir === 'short' && prevC < open && c > open) return false;
  return true;
}
/* MACD histogram divergence. A higher high with a lower histogram does not pass
   as a long. One swing does not refuse. */
function tmMacdDiv(rows, dir){
  if (!rows || rows.length < 40 || (dir !== 'long' && dir !== 'short')) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++){
    if (!(+rows[i].c > 0) || !isFinite(+rows[i].h) || !isFinite(+rows[i].l)) return null;
    closes.push(+rows[i].c);
  }
  var e12 = tmSeedEma(closes, 12), e26 = tmSeedEma(closes, 26);
  if (!e12 || !e26) return null;
  var macd = [];
  for (i = 0; i < closes.length; i++) macd.push(e12[i] - e26[i]);
  var sig = tmSeedEma(macd, 9);
  if (!sig) return null;
  var hist = [];
  for (i = 0; i < macd.length; i++) hist.push(macd[i] - sig[i]);
  var sw = tmFractals(rows);
  if (!sw) return null;
  var pair = dir === 'long' ? sw.highs : sw.lows;
  if (pair.length < 2) return true;
  var a = pair[pair.length - 2], b = pair[pair.length - 1];
  if (!isFinite(hist[a]) || !isFinite(hist[b])) return true;
  if (dir === 'long' && rows[b].h > rows[a].h && hist[b] < hist[a]) return false;
  if (dir === 'short' && rows[b].l < rows[a].l && hist[b] > hist[a]) return false;
  return true;
}
/* RSI(14) crossing 50 on this bar. A cross on an earlier bar does not refuse. */
function tmRsiCross(rows, dir){
  if (!rows || rows.length < 20 || (dir !== 'long' && dir !== 'short')) return null;
  var closes = [], i;
  for (i = 0; i < rows.length; i++){
    if (!(+rows[i].c > 0)) return null;
    closes.push(+rows[i].c);
  }
  var rsi = tmRsiSeries(closes, 14);
  if (!rsi) return null;
  var n = rsi.length - 1;
  if (!isFinite(rsi[n]) || !isFinite(rsi[n - 1])) return null;
  if (dir === 'long' && rsi[n - 1] >= 50 && rsi[n] < 50) return false;
  if (dir === 'short' && rsi[n - 1] <= 50 && rsi[n] > 50) return false;
  return true;
}
/* The nearest fair-value gap of at least 0.15%. Losing it on this bar does not pass.
   No gap does not refuse. */
function tmFvgLost(rows, dir){
  if (!rows || rows.length < 8 || (dir !== 'long' && dir !== 'short')) return null;
  var i;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l) || !(+rows[i].c > 0)) return null;
  }
  var prev = +rows[rows.length - 2].c, c = +rows[rows.length - 1].c;
  var start = Math.max(2, rows.length - 30);
  for (i = rows.length - 3; i >= start; i--){
    if (dir === 'long' && +rows[i].l > +rows[i - 2].h){
      var bot = +rows[i - 2].h;
      if ((+rows[i].l - bot) / c < 0.0015) continue;
      if (prev >= bot && c < bot) return false;
      return true;
    }
    if (dir === 'short' && +rows[i].h < +rows[i - 2].l){
      var top = +rows[i - 2].l;
      if ((top - +rows[i].h) / c < 0.0015) continue;
      if (prev <= top && c > top) return false;
      return true;
    }
  }
  return true;
}
/* A wick through the 20-bar Bollinger band that closes back inside, against the trade.
   Price that stays inside the band does not refuse. */
function tmBbReject(rows, dir){
  var len = 20;
  if (!rows || rows.length < len || (dir !== 'long' && dir !== 'short')) return null;
  var last = rows[rows.length - 1];
  var look = rows.slice(-len);
  var sum = 0, i, c;
  for (i = 0; i < look.length; i++){
    c = +look[i].c;
    if (!(c > 0)) return null;
    sum += c;
  }
  var mean = sum / len, acc = 0;
  for (i = 0; i < look.length; i++){
    var d = +look[i].c - mean;
    acc += d * d;
  }
  var sd = Math.sqrt(acc / len);
  if (!(sd > 0)) return true;
  var upper = mean + 2 * sd, lower = mean - 2 * sd;
  var h = +last.h, l = +last.l, o = +last.o, px = +last.c;
  if (!isFinite(h) || !isFinite(l) || !isFinite(o) || !(px > 0)) return null;
  if (dir === 'long' && h > upper && px <= upper && px < o) return false;
  if (dir === 'short' && l < lower && px >= lower && px > o) return false;
  return true;
}
/* Session point of control, from bars before this one. Losing it on this bar does not pass.
   Fewer than four session bars does not refuse. Missing volume does not pass. */
function tmPocLost(rows, dir){
  if (!rows || !rows.length || (dir !== 'long' && dir !== 'short')) return null;
  function dayOf(t){
    var ms = +t;
    if (!isFinite(ms)) return null;
    if (ms < 1e12) ms = ms * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  var today = dayOf(rows[rows.length - 1].t);
  if (!today) return null;
  var sess = [], i, key;
  for (i = 0; i < rows.length - 1; i++){
    key = dayOf(rows[i].t);
    if (!key) return null;
    if (key === today) sess.push(rows[i]);
  }
  if (sess.length < 4) return true;
  var px = +rows[rows.length - 1].c;
  if (!(px > 0)) return null;
  var step = px * 0.001, bins = {}, best = null, vol = 0, b, tp, bin, v;
  for (i = 0; i < sess.length; i++){
    b = sess[i];
    v = +b.v;
    if (!(v > 0) || !isFinite(+b.h) || !isFinite(+b.l) || !(+b.c > 0)) return null;
    tp = (+b.h + +b.l + +b.c) / 3;
    bin = Math.round(tp / step);
    bins[bin] = (bins[bin] || 0) + v;
    if (bins[bin] > vol){ vol = bins[bin]; best = bin; }
  }
  if (best == null || !(vol > 0)) return null;
  var poc = best * step;
  var prevC = +sess[sess.length - 1].c;
  if (dir === 'long' && prevC > poc && px < poc) return false;
  if (dir === 'short' && prevC < poc && px > poc) return false;
  return true;
}
/* Yesterday floor pivot. A wick through R1 or S1 that closes back through it does not pass.
   No prior day, or a prior day under 0.4%, does not refuse. */
function tmPivot(rows, dir){
  if (!rows || rows.length < 8 || (dir !== 'long' && dir !== 'short')) return null;
  function dayOf(t){
    var ms = +t;
    if (!isFinite(ms)) return null;
    if (ms < 1e12) ms = ms * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  var today = dayOf(rows[rows.length - 1].t);
  if (!today) return null;
  var prevDay = null, i, key;
  for (i = 0; i < rows.length - 1; i++){
    key = dayOf(rows[i].t);
    if (!key) return null;
    if (key !== today) prevDay = key;
  }
  if (!prevDay) return true;
  var hi = -Infinity, lo = Infinity, lastC = NaN, n = 0;
  for (i = 0; i < rows.length - 1; i++){
    if (dayOf(rows[i].t) !== prevDay) continue;
    if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l) || !(+rows[i].c > 0)) return null;
    if (+rows[i].h > hi) hi = +rows[i].h;
    if (+rows[i].l < lo) lo = +rows[i].l;
    lastC = +rows[i].c;
    n++;
  }
  if (n < 4 || !(hi > lo) || !(lastC > 0)) return true;
  var last = rows[rows.length - 1];
  var h = +last.h, l = +last.l, o = +last.o, c = +last.c;
  if (!isFinite(h) || !isFinite(l) || !isFinite(o) || !(c > 0)) return null;
  if ((hi - lo) / c < 0.004) return true;
  var pp = (hi + lo + lastC) / 3;
  var r1 = 2 * pp - lo, s1 = 2 * pp - hi;
  if (dir === 'long' && h > r1 && c < r1 && c < o) return false;
  if (dir === 'short' && l < s1 && c > s1 && c > o) return false;
  return true;
}
/* The order block before the latest displacement. A close through it on this bar does not pass.
   No displacement does not refuse. */
function tmObLost(rows, dir){
  if (!rows || rows.length < 20 || (dir !== 'long' && dir !== 'short')) return null;
  var atr = 0, i, pc, tr;
  for (i = rows.length - 14; i < rows.length; i++){
    if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l) || !(+rows[i - 1].c > 0)) return null;
    pc = +rows[i - 1].c;
    tr = Math.max(+rows[i].h - +rows[i].l, Math.abs(+rows[i].h - pc), Math.abs(+rows[i].l - pc));
    atr += tr;
  }
  atr = atr / 14;
  if (!(atr > 0)) return null;
  var prev = +rows[rows.length - 2].c, c = +rows[rows.length - 1].c;
  if (!(prev > 0) || !(c > 0)) return null;
  for (i = rows.length - 2; i >= 1; i--){
    var body = +rows[i].c - +rows[i].o;
    if (dir === 'long' && body >= 0.6 * atr && +rows[i - 1].c < +rows[i - 1].o){
      var level = +rows[i - 1].l;
      if (prev >= level && c < level) return false;
      return true;
    }
    if (dir === 'short' && -body >= 0.6 * atr && +rows[i - 1].c > +rows[i - 1].o){
      var top = +rows[i - 1].h;
      if (prev <= top && c > top) return false;
      return true;
    }
  }
  return true;
}
/* A wick through the Keltner band, measured before this bar, that closes back inside.
   Price that stays inside the band does not refuse. */
function tmKeltner(rows, dir){
  var len = 20;
  if (!rows || rows.length < len + 1 || (dir !== 'long' && dir !== 'short')) return null;
  var prior = rows.slice(0, -1), closes = [], i, atr = 0, pc, tr;
  for (i = 0; i < prior.length; i++){
    if (!(+prior[i].c > 0)) return null;
    closes.push(+prior[i].c);
  }
  for (i = prior.length - len; i < prior.length; i++){
    if (!isFinite(+prior[i].h) || !isFinite(+prior[i].l) || !(+prior[i - 1].c > 0)) return null;
    pc = +prior[i - 1].c;
    tr = Math.max(+prior[i].h - +prior[i].l, Math.abs(+prior[i].h - pc), Math.abs(+prior[i].l - pc));
    atr += tr;
  }
  atr = atr / len;
  if (!(atr > 0)) return true;
  var ema = tmSeedEma(closes, len);
  if (!ema) return null;
  var mid = ema[ema.length - 1];
  var upper = mid + 2 * atr, lower = mid - 2 * atr;
  var last = rows[rows.length - 1];
  var h = +last.h, l = +last.l, o = +last.o, c = +last.c;
  if (!isFinite(h) || !isFinite(l) || !isFinite(o) || !(c > 0)) return null;
  if (dir === 'long' && h > upper && c <= upper && c < o) return false;
  if (dir === 'short' && l < lower && c >= lower && c > o) return false;
  return true;
}
/* Asian range, 00:00 to 07:00 UTC. A later wick back inside it does not pass.
   Before 07:00, or no Asian bars, it does not refuse. */
function tmAsiaSweep(rows, dir){
  if (!rows || rows.length < 8 || (dir !== 'long' && dir !== 'short')) return null;
  function msOf(t){
    var ms = +t;
    if (!isFinite(ms)) return NaN;
    if (ms < 1e12) ms = ms * 1000;
    return ms;
  }
  var lastMs = msOf(rows[rows.length - 1].t);
  if (!isFinite(lastMs)) return null;
  var when = new Date(lastMs);
  if (when.getUTCHours() < 7) return true;
  var day = when.toISOString().slice(0, 10);
  var hi = -Infinity, lo = Infinity, n = 0, i, ms, barDay, hour;
  for (i = 0; i < rows.length - 1; i++){
    ms = msOf(rows[i].t);
    if (!isFinite(ms)) return null;
    var at = new Date(ms);
    barDay = at.toISOString().slice(0, 10);
    hour = at.getUTCHours();
    if (barDay !== day || hour >= 7) continue;
    if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l)) return null;
    if (+rows[i].h > hi) hi = +rows[i].h;
    if (+rows[i].l < lo) lo = +rows[i].l;
    n++;
  }
  if (n < 3 || !(hi > lo)) return true;
  var last = rows[rows.length - 1];
  var h = +last.h, l = +last.l, o = +last.o, c = +last.c;
  if (!isFinite(h) || !isFinite(l) || !isFinite(o) || !(c > 0)) return null;
  if ((hi - lo) / c < 0.002) return true;
  if (dir === 'long' && h > hi && c <= hi && c < o) return false;
  if (dir === 'short' && l < lo && c >= lo && c > o) return false;
  return true;
}
/* A wick through the session VWAP band, one standard deviation, that closes back inside.
   Fewer than four session bars does not refuse. */
function tmVwapBand(rows, dir){
  if (!rows || !rows.length || (dir !== 'long' && dir !== 'short')) return null;
  function dayOf(t){
    var ms = +t;
    if (!isFinite(ms)) return null;
    if (ms < 1e12) ms = ms * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  var today = dayOf(rows[rows.length - 1].t);
  if (!today) return null;
  var sess = [], i, key;
  for (i = 0; i < rows.length - 1; i++){
    key = dayOf(rows[i].t);
    if (!key) return null;
    if (key === today) sess.push(rows[i]);
  }
  if (sess.length < 4) return true;
  var sum = 0, vol = 0, b, v, tp;
  for (i = 0; i < sess.length; i++){
    b = sess[i];
    v = +b.v;
    if (!(v > 0) || !isFinite(+b.h) || !isFinite(+b.l) || !(+b.c > 0)) return null;
    tp = (+b.h + +b.l + +b.c) / 3;
    sum += tp * v;
    vol += v;
  }
  if (!(vol > 0)) return null;
  var vwap = sum / vol, acc = 0;
  for (i = 0; i < sess.length; i++){
    b = sess[i];
    tp = (+b.h + +b.l + +b.c) / 3;
    var d = tp - vwap;
    acc += (+b.v) * d * d;
  }
  var sd = Math.sqrt(acc / vol);
  if (!(sd > 0)) return true;
  var last = rows[rows.length - 1];
  var h = +last.h, l = +last.l, o = +last.o, c = +last.c;
  if (!isFinite(h) || !isFinite(l) || !isFinite(o) || !(c > 0)) return null;
  if (dir === 'long' && h > vwap + sd && c <= vwap + sd && c < o) return false;
  if (dir === 'short' && l < vwap - sd && c >= vwap - sd && c > o) return false;
  return true;
}
/* Camarilla H3 and L3 from the prior day. A wick back through the level does not pass.
   No prior day, or a prior day under 0.4%, does not refuse. */
function tmCamarilla(rows, dir){
  if (!rows || rows.length < 8 || (dir !== 'long' && dir !== 'short')) return null;
  function dayOf(t){
    var ms = +t;
    if (!isFinite(ms)) return null;
    if (ms < 1e12) ms = ms * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  var today = dayOf(rows[rows.length - 1].t);
  if (!today) return null;
  var prevDay = null, i, key;
  for (i = 0; i < rows.length - 1; i++){
    key = dayOf(rows[i].t);
    if (!key) return null;
    if (key !== today) prevDay = key;
  }
  if (!prevDay) return true;
  var hi = -Infinity, lo = Infinity, lastC = NaN, n = 0;
  for (i = 0; i < rows.length - 1; i++){
    if (dayOf(rows[i].t) !== prevDay) continue;
    if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l) || !(+rows[i].c > 0)) return null;
    if (+rows[i].h > hi) hi = +rows[i].h;
    if (+rows[i].l < lo) lo = +rows[i].l;
    lastC = +rows[i].c;
    n++;
  }
  if (n < 4 || !(hi > lo) || !(lastC > 0)) return true;
  var last = rows[rows.length - 1];
  var h = +last.h, l = +last.l, o = +last.o, c = +last.c;
  if (!isFinite(h) || !isFinite(l) || !isFinite(o) || !(c > 0)) return null;
  if ((hi - lo) / c < 0.004) return true;
  var h3 = lastC + (hi - lo) * 1.1 / 4;
  var l3 = lastC - (hi - lo) * 1.1 / 4;
  if (dir === 'long' && h > h3 && c < h3 && c < o) return false;
  if (dir === 'short' && l < l3 && c > l3 && c > o) return false;
  return true;
}
/* Ichimoku Kijun, the midpoint of the prior 26 bars. Losing it on this bar does not pass.
   A close that was already through it does not refuse. */
function tmKijunLost(rows, dir){
  var len = 26;
  if (!rows || rows.length < len + 1 || (dir !== 'long' && dir !== 'short')) return null;
  var prior = rows.slice(-(len + 1), -1);
  var hi = -Infinity, lo = Infinity, i;
  for (i = 0; i < prior.length; i++){
    if (!isFinite(+prior[i].h) || !isFinite(+prior[i].l) || !(+prior[i].c > 0)) return null;
    if (+prior[i].h > hi) hi = +prior[i].h;
    if (+prior[i].l < lo) lo = +prior[i].l;
  }
  if (!(hi > lo)) return true;
  var kijun = (hi + lo) / 2;
  var prev = +prior[prior.length - 1].c;
  var c = +rows[rows.length - 1].c;
  if (!(c > 0)) return null;
  if (dir === 'long' && prev >= kijun && c < kijun) return false;
  if (dir === 'short' && prev <= kijun && c > kijun) return false;
  return true;
}
/* Session value area, 70% of volume. Losing the edge on this bar does not pass.
   Fewer than four session bars does not refuse. Missing volume does not pass. */
function tmVahLost(rows, dir){
  if (!rows || !rows.length || (dir !== 'long' && dir !== 'short')) return null;
  function dayOf(t){
    var ms = +t;
    if (!isFinite(ms)) return null;
    if (ms < 1e12) ms = ms * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  var today = dayOf(rows[rows.length - 1].t);
  if (!today) return null;
  var sess = [], i, key;
  for (i = 0; i < rows.length - 1; i++){
    key = dayOf(rows[i].t);
    if (!key) return null;
    if (key === today) sess.push(rows[i]);
  }
  if (sess.length < 4) return true;
  var px = +rows[rows.length - 1].c;
  if (!(px > 0)) return null;
  var step = px * 0.001, bins = {}, total = 0, b, v, tp, bin;
  for (i = 0; i < sess.length; i++){
    b = sess[i];
    v = +b.v;
    if (!(v > 0) || !isFinite(+b.h) || !isFinite(+b.l) || !(+b.c > 0)) return null;
    tp = (+b.h + +b.l + +b.c) / 3;
    bin = Math.round(tp / step);
    bins[bin] = (bins[bin] || 0) + v;
    total += v;
  }
  if (!(total > 0)) return null;
  var keys = Object.keys(bins).map(Number).sort(function(a, c2){ return a - c2; });
  var poc = keys[0], best = bins[keys[0]];
  for (i = 1; i < keys.length; i++){
    if (bins[keys[i]] > best){ best = bins[keys[i]]; poc = keys[i]; }
  }
  var idx = keys.indexOf(poc), lo = idx, hi = idx, got = bins[poc];
  while (got < total * 0.7 && (lo > 0 || hi < keys.length - 1)){
    var left = lo > 0 ? bins[keys[lo - 1]] : -1;
    var right = hi < keys.length - 1 ? bins[keys[hi + 1]] : -1;
    if (right >= left){ hi++; got += bins[keys[hi]]; }
    else { lo--; got += bins[keys[lo]]; }
  }
  var vah = keys[hi] * step, val = keys[lo] * step;
  var prevC = +sess[sess.length - 1].c;
  if (dir === 'long' && prevC > vah && px < vah) return false;
  if (dir === 'short' && prevC < val && px > val) return false;
  return true;
}
/* Slow stochastic. A cross of %K back under %D from above 80 does not pass as a long.
   A cross that is not at the extreme does not refuse. */
function tmStochCross(rows, dir){
  var len = 14;
  if (!rows || rows.length < len + 6 || (dir !== 'long' && dir !== 'short')) return null;
  var raw = [], i, j, hh, ll;
  for (i = len - 1; i < rows.length; i++){
    hh = -Infinity; ll = Infinity;
    for (j = i - len + 1; j <= i; j++){
      if (!isFinite(+rows[j].h) || !isFinite(+rows[j].l) || !(+rows[j].c > 0)) return null;
      if (+rows[j].h > hh) hh = +rows[j].h;
      if (+rows[j].l < ll) ll = +rows[j].l;
    }
    raw.push(hh > ll ? 100 * (+rows[i].c - ll) / (hh - ll) : 50);
  }
  if (raw.length < 6) return null;
  var ks = [];
  for (i = 2; i < raw.length; i++) ks.push((raw[i] + raw[i - 1] + raw[i - 2]) / 3);
  if (ks.length < 4) return null;
  var n = ks.length - 1;
  var dNow = (ks[n] + ks[n - 1] + ks[n - 2]) / 3;
  var dPrev = (ks[n - 1] + ks[n - 2] + ks[n - 3]) / 3;
  if (dir === 'long' && ks[n - 1] >= dPrev && ks[n] < dNow && ks[n - 1] >= 80) return false;
  if (dir === 'short' && ks[n - 1] <= dPrev && ks[n] > dNow && ks[n - 1] <= 20) return false;
  return true;
}
/* The open of the current 4-hour block. Losing it on this bar does not pass.
   Fewer than two bars in the block does not refuse. */
function tmH4Open(rows, dir){
  if (!rows || !rows.length || (dir !== 'long' && dir !== 'short')) return null;
  function msOf(t){
    var ms = +t;
    if (!isFinite(ms)) return NaN;
    if (ms < 1e12) ms = ms * 1000;
    return ms;
  }
  var lastMs = msOf(rows[rows.length - 1].t);
  if (!isFinite(lastMs)) return null;
  var when = new Date(lastMs);
  var start = Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate(), Math.floor(when.getUTCHours() / 4) * 4);
  var block = [], i, ms;
  for (i = 0; i < rows.length; i++){
    ms = msOf(rows[i].t);
    if (!isFinite(ms)) return null;
    if (ms >= start) block.push(rows[i]);
  }
  if (block.length < 2) return true;
  var open = +block[0].o, prevC = +block[block.length - 2].c, c = +block[block.length - 1].c;
  if (!(open > 0) || !(prevC > 0) || !(c > 0)) return null;
  if (dir === 'long' && prevC > open && c < open) return false;
  if (dir === 'short' && prevC < open && c > open) return false;
  return true;
}
/* Yesterday point of control. Losing it on this bar does not pass.
   No prior day does not refuse. Missing volume does not pass. */
function tmNakedPoc(rows, dir){
  if (!rows || rows.length < 8 || (dir !== 'long' && dir !== 'short')) return null;
  function dayOf(t){
    var ms = +t;
    if (!isFinite(ms)) return null;
    if (ms < 1e12) ms = ms * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  var today = dayOf(rows[rows.length - 1].t);
  if (!today) return null;
  var prevDay = null, i, key;
  for (i = 0; i < rows.length - 1; i++){
    key = dayOf(rows[i].t);
    if (!key) return null;
    if (key !== today) prevDay = key;
  }
  if (!prevDay) return true;
  var px = +rows[rows.length - 1].c;
  if (!(px > 0)) return null;
  var step = px * 0.001, bins = {}, best = null, vol = 0, n = 0, b, v, tp, bin;
  for (i = 0; i < rows.length - 1; i++){
    if (dayOf(rows[i].t) !== prevDay) continue;
    b = rows[i];
    v = +b.v;
    if (!(v > 0) || !isFinite(+b.h) || !isFinite(+b.l) || !(+b.c > 0)) return null;
    tp = (+b.h + +b.l + +b.c) / 3;
    bin = Math.round(tp / step);
    bins[bin] = (bins[bin] || 0) + v;
    if (bins[bin] > vol){ vol = bins[bin]; best = bin; }
    n++;
  }
  if (n < 4 || best == null) return true;
  var poc = best * step;
  var prevC = +rows[rows.length - 2].c;
  if (!(prevC > 0)) return null;
  if (dir === 'long' && prevC > poc && px < poc) return false;
  if (dir === 'short' && prevC < poc && px > poc) return false;
  return true;
}
/* Linear regression channel of the prior 20 closes. A wick back inside it does not pass.
   A flat channel does not refuse. */
function tmRegress(rows, dir){
  var len = 20;
  if (!rows || rows.length < len + 1 || (dir !== 'long' && dir !== 'short')) return null;
  var prior = rows.slice(-(len + 1), -1);
  var n = prior.length, sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, i, y;
  for (i = 0; i < n; i++){
    y = +prior[i].c;
    if (!(y > 0)) return null;
    sumX += i; sumY += y; sumXY += i * y; sumXX += i * i;
  }
  var den = n * sumXX - sumX * sumX;
  if (!(den > 0)) return null;
  var slope = (n * sumXY - sumX * sumY) / den;
  var intercept = (sumY - slope * sumX) / n;
  var acc = 0;
  for (i = 0; i < n; i++){
    var err = +prior[i].c - (intercept + slope * i);
    acc += err * err;
  }
  var sd = Math.sqrt(acc / n);
  if (!(sd > 0)) return true;
  var mid = intercept + slope * n;
  var last = rows[rows.length - 1];
  var h = +last.h, l = +last.l, o = +last.o, c = +last.c;
  if (!isFinite(h) || !isFinite(l) || !isFinite(o) || !(c > 0)) return null;
  if (dir === 'long' && h > mid + 2 * sd && c <= mid + 2 * sd && c < o) return false;
  if (dir === 'short' && l < mid - 2 * sd && c >= mid - 2 * sd && c > o) return false;
  return true;
}
/* CCI(20) crossing back through 100. A reading that was already inside does not refuse. */
function tmCciExit(rows, dir){
  var len = 20;
  if (!rows || rows.length < len + 2 || (dir !== 'long' && dir !== 'short')) return null;
  function cci(end){
    var tps = [], i, sum = 0, tp;
    for (i = end - len + 1; i <= end; i++){
      if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l) || !(+rows[i].c > 0)) return NaN;
      tp = (+rows[i].h + +rows[i].l + +rows[i].c) / 3;
      tps.push(tp); sum += tp;
    }
    var mean = sum / len, dev = 0;
    for (i = 0; i < tps.length; i++) dev += Math.abs(tps[i] - mean);
    dev = dev / len;
    if (!(dev > 0)) return 0;
    return (tps[tps.length - 1] - mean) / (0.015 * dev);
  }
  var prev = cci(rows.length - 2), now = cci(rows.length - 1);
  if (!isFinite(prev) || !isFinite(now)) return null;
  if (dir === 'long' && prev >= 100 && now < 100) return false;
  if (dir === 'short' && prev <= -100 && now > -100) return false;
  return true;
}
/* The 1.272 extension of the last impulse. A wick back through it does not pass.
   No impulse, or a swing under 0.4%, does not refuse. */
function tmExt(rows, dir){
  if (!rows || rows.length < 20 || (dir !== 'long' && dir !== 'short')) return null;
  var i;
  for (i = 0; i < rows.length; i++){
    if (!isFinite(+rows[i].h) || !isFinite(+rows[i].l) || !(+rows[i].c > 0)) return null;
  }
  var sw = tmFractals(rows);
  if (!sw || !sw.highs.length || !sw.lows.length) return true;
  var hi = sw.highs[sw.highs.length - 1], lo = sw.lows[sw.lows.length - 1];
  var last = rows[rows.length - 1], prev = +rows[rows.length - 2].c;
  var h = +last.h, l = +last.l, o = +last.o, c = +last.c;
  if (dir === 'long'){
    if (!(lo < hi)) return true;
    var low = +rows[lo].l, high = +rows[hi].h, span = high - low;
    if (!(span > 0) || span / c < 0.004) return true;
    var ext = high + 0.272 * span;
    if (prev < ext && h > ext && c < ext && c < o) return false;
    return true;
  }
  if (!(hi < lo)) return true;
  var top = +rows[hi].h, bot = +rows[lo].l, drop = top - bot;
  if (!(drop > 0) || drop / c < 0.004) return true;
  var extS = bot - 0.272 * drop;
  if (prev > extS && l < extS && c > extS && c > o) return false;
  return true;
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
  return Object.keys(rd).length ? rd : undefined;
}
/* hg-v1159: the TICKET claim on a record is the board's own CLEAN tier — the
   one rule (trendmxRowTier) that already caps a row at NEAR under every
   witness and the post-gate veto. The crown recorder (hg-v1039) claimed
   ticket:true on every 7/7 row the board itself showed as NEAR; both sites
   read this now. */
function tmTicketClaim(r, plan){
  return trendmxRowTier(r, plan) === 'clean';
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
    artifact: "backtest-trendmx-results.json", n: 0, windows: 4, minSide: 20,
    span: null,
    measured: false,
    tab: "TRENDMX",
    forwardOnly: ["takerFlowWith","fundWith","postgate:veto"],
    reads: [],
    bound: "no bound: nothing walked",
    note: "scripts/backtest-trendmx-results.json does not exist: the TREND MATRIX replay (scripts/backtest-trendmx.mjs) has not run on a machine that can fetch bars. Every read this desk records (hg-v1159) is unmeasured against its complement until it does; the forward ledger is the only evidence this desk has.",
    verdicts: [],
    leans: [],
    inSampleVerdicts: [],
    rows: [

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
  if (dir === 'long' && tmAltLongBlockedByBtc(r))
    return '<div class="plan">No long. BTC structure is down, so alt longs are stood down.</div>';
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
  if (r.postGate) inner += ' <span class="gpip ' + (r.postGate.state === 'pass' ? 'ok' : (r.postGate.state === 'veto' ? 'bad' : '')) + '">' + escH(tmPostGateLabel(r)) + '</span>';
  /* hg-v1154: a vetoed plan keeps its levels and prints the reason where the two handoffs were */
  if (tmPostGateVeto(r)){
    return '<div class="plan">' + inner + stackHtml + ' <span class="note warn">handoffs withheld — post-gate veto (SWING policy on the gates this desk borrows)</span></div>';
  }
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
  out.held = { waiting: 0, grade: 0, cascade: 0, gates: 0 };
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || r.freshCross !== 'GOLDEN') continue;
    if (!r.comps || r.comps.d1Cross <= 0) continue;
    /* hg-v1150: an unpriceable row is not a setup. hgBestLevels can price a
       plan straight off the tape, which is right for a THIN row — but a row
       whose own published price is unreadable is corrupt, and a corrupt row
       must not mint a ticket the board would show beside a price it cannot
       print. */
    if (!isFinite(+r.price)) continue;
    var dir = tmDirOf(r);
    if (dir !== 'long') continue;
    var conv = trendmxConviction(r);
    if (!conv) continue;
    if (tmCascadeDir(r.rows4h) !== 1){ out.held.cascade++; continue; }
    /* hg-v1150: THE ROW-CARRIED VETO IS RESPECTED. The closed-gate recompute
       below re-derives the 7-gate matrix off the tape, but it can never
       reproduce a veto the SCAN stamped on the row (a chase block, a
       formation-edge suppression) — those live on r.gate, written by the
       upstream layers that know them. An explicit r.gate.veto holds the row
       off this desk no matter what the bare tape says; the recompute then
       serves the rows that arrive without one. */
    if (r.gate && r.gate.veto){ out.held.gates++; continue; }
    var gate = trendmxClosedGate(r, dir);
    if (!gate || gate.veto || !(gate.gatesPassed >= 6)){ out.held.gates++; continue; }
    var grade = trendmxSetupGrade(r, dir);
    if (grade.grade !== 'TRADE'){ out.held.grade++; continue; }
    var tag = trendmxEmaTag(r.rows4h, dir);
    if (!tag || tag.state !== 'ready'){ out.held.waiting++; continue; }
    var plan = trendmxPlan({ dir: dir, score: r.score, rows4h: tmClosedRows(r.rows4h, 14400), rows1h: r.rows1h, entry: r.price, gate: gate, comps: r.comps, sym: r.sym, fundingPct: r.fundingPct, freshCross: r.freshCross, base: r.base });
    if (!tmValidSetup(plan)) continue;
    out.push({
      sym: r.sym, dir: 'long', entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: fin(+plan.rr1) ? +plan.rr1 : TM_T1_R, score: r.score, adx: r.adx,
      clean7: !!(plan.clean7 || gate.clean7),
      freshCross: 'GOLDEN', conviction: conv.label, tier: conv.tier, prime: conv.prime,
      comps: r.comps, gateLabel: plan.gateLabel || gate.label,
      note: '⚡GOLDEN CROSS on a closed daily bar · composite ' + (r.score > 0 ? '+' : '') + r.score + '/5'
        + ' · 4h cascade · ' + (gate.gatesPassed || 0) + '/7'
        + ' · TRADE'
        + (plan.entryType === 'LIMIT' ? (' · 4h ' + plan.limitEma + ' tagged') : ' · tagged at the 4h EMAs')
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
  out.held = { waiting: 0, grade: 0, cascade: 0, gates: 0 };
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || r.freshCross !== 'DEATH') continue;
    if (!r.comps || r.comps.d1Cross >= 0) continue;
    /* hg-v1150: the mirror carries the same corrupt-row rule. */
    if (!isFinite(+r.price)) continue;
    var dir = tmDirOf(r);
    if (dir !== 'short') continue;
    var conv = trendmxConviction(r);
    if (!conv) continue;
    if (tmCascadeDir(r.rows4h) !== -1){ out.held.cascade++; continue; }
    /* hg-v1150: the row-carried veto is respected on the mirror too — the
       same rule the golden desk gained one screen up. */
    if (r.gate && r.gate.veto){ out.held.gates++; continue; }
    var gate = trendmxClosedGate(r, dir);
    if (!gate || gate.veto || !(gate.gatesPassed >= 6)){ out.held.gates++; continue; }
    var grade = trendmxSetupGrade(r, dir);
    if (grade.grade !== 'TRADE'){ out.held.grade++; continue; }
    var tag = trendmxEmaTag(r.rows4h, dir);
    if (!tag || tag.state !== 'ready'){ out.held.waiting++; continue; }
    var plan = trendmxPlan({ dir: dir, score: r.score, rows4h: tmClosedRows(r.rows4h, 14400), rows1h: r.rows1h, entry: r.price, gate: gate, comps: r.comps, sym: r.sym, fundingPct: r.fundingPct, freshCross: r.freshCross, base: r.base });
    if (!tmValidSetup(plan)) continue;
    out.push({
      sym: r.sym, dir: 'short', entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: fin(+plan.rr1) ? +plan.rr1 : TM_T1_R, score: r.score, adx: r.adx,
      clean7: !!(plan.clean7 || gate.clean7),
      freshCross: 'DEATH', conviction: conv.label, tier: conv.tier, prime: conv.prime,
      comps: r.comps, gateLabel: plan.gateLabel || gate.label,
      note: '⚡DEATH CROSS on a closed daily bar · composite ' + r.score + '/5'
        + ' · 4h cascade · ' + (gate.gatesPassed || 0) + '/7'
        + ' · TRADE'
        + (plan.entryType === 'LIMIT' ? (' · 4h ' + plan.limitEma + ' tagged') : ' · tagged at the 4h EMAs')
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
  var cdcxAllP = (typeof W.xuCoinDCXRows === 'function' && typeof W.hgDeskLoadCoinDCXAll === 'function')
    ? W.hgDeskLoadCoinDCXAll({ force: false, minTurnover: 0, includeUnknown: true }).catch(function(){ return null; })
    : Promise.resolve(null);
  var cdcxSymP = tmLoadCoinDcxContracts().catch(function(){ return []; });
  var uniPack = await W.hgDeskLoadUniverse({ force: true, minTurnover: TURNOVER_FLOOR });
  var allPackEarly = await cdcxAllP;
  var cdcxSymsEarly = await cdcxSymP;
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
    if (allPackEarly){
      var allPack = allPackEarly;
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
    var cdcxSyms = cdcxSymsEarly || [];
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
  function tmFetchTf(item, tf, n, minLen){
    return fetchK(item, tf, n).then(function(rows){
      if (rows && rows.length >= minLen) return rows;
      return tmBinanceTwin(item, tf, n).then(function(twin){
        if (twin && twin.length > ((rows && rows.length) || 0)) return twin;
        return (rows && rows.length) ? rows : [];
      });
    }).catch(function(){ return []; });
  }
  var results = [], failed = 0;
  for (var i = 0; i < items.length; i += CHUNK){
    var chunk = items.slice(i, i + CHUNK);
    if (typeof hooks.setProg === 'function') hooks.setProg((i + chunk.length) / items.length);
    var rs = await Promise.all(chunk.map(function(item){
      return Promise.all([
        tmFetchTf(item, '4h', 260, 210),
        tmFetchTf(item, '1d', 260, 1),
        tmFetchTf(item, '1h', 72, 1)
      ]).then(function(got){
        var r4 = got[0], r1 = got[1], r1h = got[2];
        if (!r4 || !r4.length || !r1 || !r1.length) return tmUnreadRow(item);
        /* Score, gates and plan formation must share one closed-bar snapshot.
           The 15m confirmation and forward ledger already judge closed bars;
           partial daily / 4H candles let the same row disagree with them. */
        var r4c = tmClosedRows(r4, 14400);
        var r1c = tmClosedRows(r1, 86400);
        var r1hc = tmClosedRows(r1h, 3600);
        if (!r4c.length || !r1c.length) return tmUnreadRow(item);
        var ts = trendScore(r1c, r4c);
        var row = {
          sym: item.sym, base: item.base, exchange: item.exchange || 'binance', alsoOn: item.alsoOn,
          xu: item, score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx,
          rsi: ts.rsi,
          volDiv: ts.volDiv, volConf: ts.volConf,
          price: r4c[r4c.length - 1].c, rows4h: r4c, rows1d: r1c, rows1h: r1hc.length ? r1hc : null,
          fundingPct: item.fundingPct, turnoverUsd: item.turnoverUsd, mark: item.mark
        };
        var dir = tmDirOf(row);
        if (!dir){ row.gate = null; return row; }
        /* hg-v1154: funding twin -> gates -> shared post-gate, on this row's own series */
        return tmFeedRow(row, dir, r4c).then(function(){ return row; });
      }).catch(function(){ return null; });
    }));
    for (var j = 0; j < rs.length; j++){ if (rs[j]) results.push(rs[j]); else failed++; }
    if (typeof hooks.onBatch === 'function'){
      try {
        hooks.onBatch({
          rows: results.slice(),
          done: Math.min(i + chunk.length, items.length),
          total: items.length,
          batch: Math.floor(i / CHUNK) + 1,
          batches: Math.ceil(items.length / CHUNK),
          failed: failed
        });
      } catch (eBatch) {}
    }
    if (i + CHUNK < items.length) await sleepMs(CHUNK_SLEEP_MS);
  }
  return {
    rows: results, failed: failed, uniLen: uniPack.rawLen || items.length,
    scanned: items.length, at: Date.now(), note: uniPack.note, source: uniPack.source,
    venueCounts: uniPack.venueCounts
  };
}


async function tmProxyJson(url){
  try{
    var r = await fetch('/api/proxy?url=' + encodeURIComponent(url));
    if (!r || !r.ok) return null;
    return await r.json();
  }catch(e){ return null; }
}
async function tmProxyText(url){
  try{
    var r = await fetch('/api/proxy?url=' + encodeURIComponent(url));
    if (!r || !r.ok) return null;
    return await r.text();
  }catch(e){ return null; }
}
function tmYahooChange(j){
  try{
    var q = j.chart.result[0].indicators.quote[0].close.filter(function(v){ return isFinite(v); });
    if (q.length < 2 || !(q[0] > 0)) return null;
    return (q[q.length - 1] - q[0]) / q[0];
  }catch(e){ return null; }
}
function tmSeriesEnds(j, key){
  var caps = j && j[key];
  if (!caps || caps.length < 2) return null;
  var a = +caps[0][1], b = +caps[caps.length - 1][1];
  if (!(a > 0) || !(b > 0)) return null;
  return { a: a, b: b };
}
function tmSpreadChange(total, parts){
  if (!total) return null;
  var a = total.a, b = total.b, i;
  for (i = 0; i < parts.length; i++){
    if (!parts[i]) return null;
    a -= parts[i].a;
    b -= parts[i].b;
  }
  if (!(a > 0)) return null;
  return (b - a) / a;
}
function tmYahooDir(j){
  try{
    var q = j.chart.result[0].indicators.quote[0].close.filter(function(v){ return isFinite(v); });
    if (q.length < 2) return null;
    return q[q.length - 1] > q[q.length - 2];
  }catch(e){ return null; }
}
function tmCapChange(j){
  var caps = j && j.market_caps;
  if (!caps || caps.length < 2) return null;
  var a = caps[0][1], b = caps[caps.length - 1][1];
  if (!(a > 0) || !(b > 0)) return null;
  return (b - a) / a;
}
function tmSessionVwap(rows1h){
  if (!rows1h || !rows1h.length) return NaN;
  var day = Math.floor(Date.now() / 1000 / 86400);
  var pv = 0, vv = 0, n = 0;
  for (var i = 0; i < rows1h.length; i++){
    var r = rows1h[i];
    if (!r) continue;
    var open = tmBarOpenSec(r);
    if (!isFinite(open) || Math.floor(open / 86400) !== day) continue;
    var v = r.v > 0 ? r.v : 0;
    if (!(v > 0)) continue;
    pv += ((r.h + r.l + r.c) / 3) * v;
    vv += v;
    n++;
  }
  return (n >= 2 && vv > 0) ? pv / vv : NaN;
}

function tmWeeklyRows(rowsD){
  if (!rowsD || rowsD.length < 20) return null;
  var weeks = [], cur = null;
  for (var i = 0; i < rowsD.length; i++){
    var r = rowsD[i];
    if (!r) continue;
    var open = tmBarOpenSec(r);
    if (!isFinite(open)) continue;
    var wk = Math.floor(open / (7 * 86400));
    if (!cur || cur.wk !== wk){
      if (cur) weeks.push(cur);
      cur = { wk: wk, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0 };
    } else {
      if (r.h > cur.h) cur.h = r.h;
      if (r.l < cur.l) cur.l = r.l;
      cur.c = r.c;
      cur.v += r.v || 0;
    }
  }
  if (cur) weeks.push(cur);
  return weeks.length >= 8 ? weeks : null;
}
function tmVolumeProfile(rows){
  if (!rows || rows.length < 40) return null;
  var use = rows.slice(-120);
  var lo = Infinity, hi = -Infinity, k;
  for (k = 0; k < use.length; k++){
    if (use[k].l < lo) lo = use[k].l;
    if (use[k].h > hi) hi = use[k].h;
  }
  if (!(hi > lo)) return null;
  var bins = 24, vol = [], step = (hi - lo) / bins;
  for (k = 0; k < bins; k++) vol.push(0);
  for (k = 0; k < use.length; k++){
    var mid = (use[k].h + use[k].l + use[k].c) / 3;
    var b = Math.max(0, Math.min(bins - 1, Math.floor((mid - lo) / step)));
    vol[b] += use[k].v > 0 ? use[k].v : 0;
  }
  var total = 0, max = 0, pocI = 0, j;
  for (j = 0; j < bins; j++){
    total += vol[j];
    if (vol[j] > max){ max = vol[j]; pocI = j; }
  }
  if (!(total > 0)) return null;
  var need = total * 0.7, acc = vol[pocI], loI = pocI, hiI = pocI;
  while (acc < need && (loI > 0 || hiI < bins - 1)){
    var left = loI > 0 ? vol[loI - 1] : -1;
    var right = hiI < bins - 1 ? vol[hiI + 1] : -1;
    if (right >= left){ hiI++; acc += vol[hiI]; }
    else { loI--; acc += vol[loI]; }
  }
  var vals = vol.filter(function(v){ return v > 0; }).slice().sort(function(a, b){ return a - b; });
  var med = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
  var hvn = [], lvn = [];
  for (j = 1; j < bins - 1; j++){
    var node = lo + (j + 0.5) * step;
    if (med > 0 && vol[j] >= med * 1.6 && vol[j] >= vol[j - 1] && vol[j] >= vol[j + 1]) hvn.push(node);
    if (med > 0 && vol[j] > 0 && vol[j] <= med * 0.45 && vol[j] <= vol[j - 1] && vol[j] <= vol[j + 1]) lvn.push(node);
  }
  if (!hvn.length) hvn.push(lo + (pocI + 0.5) * step);
  return { poc: lo + (pocI + 0.5) * step, vah: lo + (hiI + 1) * step, val: lo + loI * step, hvn: hvn, lvn: lvn };
}
function tmEqualSweep(rows, dir){
  if (!rows || rows.length < 20) return false;
  var pivots = [];
  for (var i = 2; i < rows.length - 2; i++){
    if (dir === 'long'){
      if (rows[i].l < rows[i-1].l && rows[i].l < rows[i-2].l && rows[i].l <= rows[i+1].l && rows[i].l <= rows[i+2].l) pivots.push(rows[i].l);
    } else if (rows[i].h > rows[i-1].h && rows[i].h > rows[i-2].h && rows[i].h >= rows[i+1].h && rows[i].h >= rows[i+2].h) pivots.push(rows[i].h);
  }
  var level = null;
  for (var a = 0; a < pivots.length; a++){
    for (var b = a + 1; b < pivots.length; b++){
      var mid = (pivots[a] + pivots[b]) / 2;
      if (mid > 0 && Math.abs(pivots[a] - pivots[b]) / mid < 0.0015) level = mid;
    }
  }
  if (!(level > 0)) return false;
  var recent = rows.slice(-6);
  for (var r = 0; r < recent.length; r++){
    if (dir === 'long' && recent[r].l < level && recent[r].c > level) return true;
    if (dir === 'short' && recent[r].h > level && recent[r].c < level) return true;
  }
  return false;
}

function tmAtLocation(rows4, rowsD, dir){
  if (!rows4 || rows4.length < 20 || !rowsD || rowsD.length < 8) return false;
  var prev = rowsD[rowsD.length - 1];
  var week = rowsD.slice(-6, -1);
  var pdl = prev.l, pdh = prev.h;
  var pwl = Math.min.apply(null, week.map(function(r){ return r.l; }));
  var pwh = Math.max.apply(null, week.map(function(r){ return r.h; }));
  var recent = rows4.slice(-6);
  var last = rows4[rows4.length - 1];
  var sweepLow = recent.some(function(r){ return r.l < pdl && r.c > pdl; }) || recent.some(function(r){ return r.l < pwl && r.c > pwl; });
  var sweepHigh = recent.some(function(r){ return r.h > pdh && r.c < pdh; }) || recent.some(function(r){ return r.h > pwh && r.c < pwh; });
  var fvg = false, ob = false;
  var a = tmAtrLast(rows4);
  for (var k = Math.max(2, rows4.length - 12); k < rows4.length - 1; k++){
    if (dir === 'long' && rows4[k].l > rows4[k - 2].h && last.l <= rows4[k].l && last.c >= rows4[k - 2].h) fvg = true;
    if (dir === 'short' && rows4[k].h < rows4[k - 2].l && last.h >= rows4[k].h && last.c <= rows4[k - 2].l) fvg = true;
    if (a > 0 && (rows4[k].h - rows4[k].l) > 1.5 * a){
      var candle = rows4[k - 1];
      if (dir === 'long' && candle.c < candle.o && last.l <= candle.h && last.c >= candle.l) ob = true;
      if (dir === 'short' && candle.c > candle.o && last.h >= candle.l && last.c <= candle.h) ob = true;
    }
  }
  if (dir === 'long') return sweepLow || fvg || ob || tmEqualSweep(rows4, dir);
  return sweepHigh || fvg || ob || tmEqualSweep(rows4, dir);
}
function tmSupplyDemand(rows){
  if (!rows || rows.length < 30) return null;
  var atr = tmAtrLast(rows);
  if (!(atr > 0)) return null;
  var demand = null, supply = null, k;
  for (k = 2; k < rows.length; k++){
    var impulse = rows[k], base = rows[k - 1];
    var move = impulse.c - impulse.o;
    if (move > 1.2 * atr && base.c < base.o){
      var broken = false, n;
      for (n = k + 1; n < rows.length; n++) if (rows[n].c < base.l) broken = true;
      if (!broken) demand = { lo: base.l, hi: base.h };
    }
    if (move < -1.2 * atr && base.c > base.o){
      var brokenS = false, m;
      for (m = k + 1; m < rows.length; m++) if (rows[m].c > base.h) brokenS = true;
      if (!brokenS) supply = { lo: base.l, hi: base.h };
    }
  }
  if (!demand && !supply) return null;
  return { demand: demand, supply: supply };
}
function tmNodeVeto(prof, px, dir, atr, vz){
  if (!prof || !prof.hvn || !prof.hvn.length) return 'HVN/LVN unread';
  var i, gap;
  for (i = 0; i < prof.lvn.length; i++){
    if (atr > 0 && Math.abs(px - prof.lvn[i]) <= 0.35 * atr && !(vz > 0.5)) return 'inside a low-volume node';
  }
  for (i = 0; i < prof.hvn.length; i++){
    gap = (dir === 'long') ? (prof.hvn[i] - px) : (px - prof.hvn[i]);
    if (atr > 0 && gap > 0 && gap <= 0.4 * atr) return dir === 'long' ? 'HVN overhead' : 'HVN underfoot';
  }
  return null;
}
function tm15Confirm(rows, dir){
  if (!rows || rows.length < 30 || typeof hgStructure !== 'function') return false;
  var hs = hgStructure(rows);
  if (!hs) return false;
  var want = dir === 'long' ? 'up' : 'down';
  var n = rows.length - 1;
  var shifted = hs.lastCHoCH && hs.lastCHoCH.dir === want && (n - hs.lastCHoCH.i) <= 12;
  var sweep = false;
  for (var i = Math.max(10, rows.length - 12); i < rows.length; i++){
    var prior = rows.slice(i - 10, i);
    var lo = Math.min.apply(null, prior.map(function(r){ return r.l; }));
    var hi = Math.max.apply(null, prior.map(function(r){ return r.h; }));
    if (dir === 'long' && rows[i].l < lo && rows[i].c > lo) sweep = true;
    if (dir === 'short' && rows[i].h > hi && rows[i].c < hi) sweep = true;
  }
  if (!(sweep && shifted)) return false;
  var shiftI = hs.lastCHoCH.i, level = hs.lastCHoCH.level;
  if (!(level > 0) || !(shiftI >= 0)) return false;
  for (var j = shiftI; j < rows.length; j++){
    if (dir === 'long' && rows[j].l <= level && rows[j].c > level) return true;
    if (dir === 'short' && rows[j].h >= level && rows[j].c < level) return true;
  }
  return false;
}
function tmHeadlineBook(text){
  var items = String(text || '').split(/<item\b/i).slice(1);
  var book = { marketHack: false, marketReg: false, etfOutflow: false, etfInflow: false, items: [] };
  var i;
  for (i = 0; i < items.length && i < 40; i++){
    var title = items[i].replace(/<[^>]+>/g, ' ').toLowerCase();
    book.items.push(title);
    if (/etf outflow|outflows from .{0,20}etf|spot etf.{0,20}outflow/.test(title)) book.etfOutflow = true;
    if (/etf inflow|inflows into .{0,20}etf|spot etf.{0,20}inflow/.test(title)) book.etfInflow = true;
    if (/exchange hack|funds drained|stablecoin depeg|depegs/.test(title)) book.marketHack = true;
    if (/sec charges|sec sues|crypto ban|crackdown|doj charges/.test(title)) book.marketReg = true;
  }
  return book.items.length ? book : null;
}
function tmCoinHeadline(book, base){
  var hit = { hack: false, delist: false, listing: false, lawsuit: false };
  if (!book || !book.items) return hit;
  var name = String(base || '').toLowerCase();
  if (name.length < 2) return hit;
  var i;
  for (i = 0; i < book.items.length; i++){
    var title = book.items[i];
    if (title.indexOf(name) < 0) continue;
    if (/hack|exploit|drained/.test(title)) hit.hack = true;
    if (/delist/.test(title)) hit.delist = true;
    if (/will list|lists |listing /.test(title)) hit.listing = true;
    if (/lawsuit|sec charge|charged/.test(title)) hit.lawsuit = true;
  }
  return hit;
}
async function trendmxLoadContext(rows){
  var ctx = { macroOk: false, calendarOk: false, domOk: false, ethOk: false, stableOk: false, newsOk: false, riskOff: false, riskOn: false, eventBlock: false, btcDomRising: false, ethStructure: null, stableFalling: false, headlines: '' };
  var yahoo = [
    ['dxy', 'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=5d'],
    ['us10y', 'https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=5d'],
    ['us2y', 'https://query1.finance.yahoo.com/v8/finance/chart/2YY%3DF?interval=1d&range=5d'],
    ['nq', 'https://query1.finance.yahoo.com/v8/finance/chart/NQ%3DF?interval=1d&range=5d'],
    ['spx', 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=5d'],
    ['vix', 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d'],
    ['gold', 'https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=5d']
  ];
  var dirs = {};
  await Promise.all(yahoo.map(function(pair){
    return tmProxyJson(pair[1]).then(function(j){ dirs[pair[0]] = tmYahooDir(j); });
  }));
  var readable = yahoo.filter(function(pair){ return dirs[pair[0]] === true || dirs[pair[0]] === false; }).length;
  if (readable >= 4){
    ctx.macroOk = true;
    var against = 0, withRisk = 0;
    if (dirs.dxy === true) against++; if (dirs.dxy === false) withRisk++;
    if (dirs.us10y === true) against++; if (dirs.us10y === false) withRisk++;
    if (dirs.us2y === true) against++; if (dirs.us2y === false) withRisk++;
    if (dirs.nq === false) against++; if (dirs.nq === true) withRisk++;
    if (dirs.spx === false) against++; if (dirs.spx === true) withRisk++;
    if (dirs.vix === true) against++; if (dirs.vix === false) withRisk++;
    if (dirs.gold === true) against++; if (dirs.gold === false) withRisk++;
    ctx.riskOff = against >= 3;
    ctx.riskOn = withRisk >= 3;
  }
  var pack = await Promise.all([
    tmProxyJson('https://nfs.faireconomy.media/ff_calendar_thisweek.json'),
    tmProxyJson('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2'),
    tmProxyJson('https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=2'),
    tmProxyJson('https://stablecoins.llama.fi/stablecoincharts/all'),
    tmProxyText('https://cointelegraph.com/rss').then(function(t){ return t || tmProxyText('https://www.coindesk.com/arc/outboundfeeds/rss/'); }),
    tmProxyJson('https://api.coingecko.com/api/v3/global/market_cap_chart?days=2'),
    tmProxyJson('https://api.llama.fi/emissions'),
    tmProxyJson('https://query1.finance.yahoo.com/v8/finance/chart/IBIT?interval=1d&range=5d'),
    tmProxyJson('https://query1.finance.yahoo.com/v8/finance/chart/FBTC?interval=1d&range=5d'),
    tmProxyJson('https://api.alternative.me/fng/?limit=1')
  ]);
  var cal = pack[0];
  if (Array.isArray(cal)){
    ctx.calendarOk = true;
    var now = Date.now();
    for (var i = 0; i < cal.length; i++){
      var ev = cal[i] || {};
      if (String(ev.country || '') !== 'USD' || String(ev.impact || '').toLowerCase() !== 'high') continue;
      var title = String(ev.title || '').toLowerCase();
      if (!/cpi|nfp|fomc|fomc|ppi|gdp|powell|unemployment|payroll|fed rate|retail sales/.test(title)) continue;
      var when = Date.parse(ev.date);
      if (!isFinite(when)) continue;
      if (when - now <= 2 * 60 * 60 * 1000 && now - when <= 30 * 60 * 1000) ctx.eventBlock = true;
    }
  }
  var btcJ = pack[1], ethJ = pack[2];
  var btcChg = tmCapChange(btcJ), ethChg = tmCapChange(ethJ);
  if (btcChg != null && ethChg != null){
    ctx.domOk = true;
    ctx.btcDomRising = btcChg > 0.005 && ethChg < btcChg - 0.01;
  }
  ctx.ethOk = false;
  var stables = pack[3];
  if (Array.isArray(stables) && stables.length >= 2){
    var aS = stables[stables.length - 2], bS = stables[stables.length - 1];
    var aV = aS && aS.totalCirculatingUSD && +aS.totalCirculatingUSD.peggedUSD;
    var bV = bS && bS.totalCirculatingUSD && +bS.totalCirculatingUSD.peggedUSD;
    if (aV > 0 && bV > 0){ ctx.stableOk = true; ctx.stableFalling = bV < aV * 0.997; }
  }
  var news = pack[4];
  if (news && news.length > 80){
    ctx.newsOk = true;
    ctx.headlines = news;
    ctx.newsBook = tmHeadlineBook(news);
  }
  var ibitChg = tmYahooChange(pack[7]);
  var fbtcChg = tmYahooChange(pack[8]);
  ctx.etfOk = ibitChg != null && fbtcChg != null;
  ctx.etfFalling = ctx.etfOk && ibitChg < -0.02 && fbtcChg < -0.02;
  ctx.fngOk = false;
  ctx.fng = null;
  try {
    var fngJ = pack[9];
    var fngV = fngJ && fngJ.data && fngJ.data[0] && +fngJ.data[0].value;
    if (isFinite(fngV)){ ctx.fngOk = true; ctx.fng = fngV; }
  } catch (eFng) {}
  ctx.totalOk = false;
  ctx.totalFalling = false;
  ctx.altsFalling = false;
  ctx.total2Ok = false;
  ctx.total2Falling = false;
  ctx.total3Ok = false;
  ctx.total3Falling = false;
  try {
    var tot = pack[5];
    var caps = tot && (tot.market_cap || tot.market_caps);
    if (caps && caps.length >= 2 && caps[0][1] > 0){
      var tchg = (caps[caps.length - 1][1] - caps[0][1]) / caps[0][1];
      ctx.totalOk = true;
      ctx.totalFalling = tchg < -0.01;
      if (btcChg != null && ethChg != null) ctx.altsFalling = (tchg - btcChg) < -0.01 && ethChg < 0;
      var totEnds = tmSeriesEnds(tot, 'market_cap') || tmSeriesEnds(tot, 'market_caps');
      var btcEnds = tmSeriesEnds(btcJ, 'market_caps');
      var ethEnds = tmSeriesEnds(ethJ, 'market_caps');
      var t2 = tmSpreadChange(totEnds, [btcEnds]);
      var t3 = tmSpreadChange(totEnds, [btcEnds, ethEnds]);
      ctx.total2Ok = t2 != null;
      ctx.total2Falling = t2 != null && t2 < -0.01;
      ctx.total3Ok = t3 != null;
      ctx.total3Falling = t3 != null && t3 < -0.01;
    }
  } catch (eTot) {}
  if (!ctx.totalOk && btcChg != null && ethChg != null){
    ctx.totalOk = true;
    ctx.totalFalling = btcChg < 0 && ethChg < 0;
    ctx.altsFalling = ethChg < btcChg - 0.01;
  }
  ctx.unlockOk = false;
  ctx.unlockBases = {};
  try {
    var em = pack[6];
    var list = Array.isArray(em) ? em : (em && em.data);
    if (Array.isArray(list)){
      ctx.unlockOk = true;
      var soon = Date.now() + 48 * 60 * 60 * 1000;
      for (var ui = 0; ui < list.length; ui++){
        var item = list[ui] || {};
        var token = String(item.token || item.symbol || '').toUpperCase();
        var events = item.events || item.unlockEvents || [];
        if (!token || !events || !events.length) continue;
        for (var ev = 0; ev < events.length; ev++){
          var ts = +((events[ev] && (events[ev].timestamp || events[ev].unlockDate)) || 0);
          if (ts > 0 && ts < 1e12) ts *= 1000;
          if (ts > Date.now() && ts < soon) ctx.unlockBases[token] = true;
        }
      }
    }
  } catch (eUn) {}
  return ctx;
}
async function tmOiRead(row){
  if (typeof W.binanceOIHistory !== 'function') return null;
  var hist = await W.binanceOIHistory(tmBaseOf(row) + 'USDT', '4h', 8);
  if (!hist || !hist.series || hist.series.length < 3) return null;
  var series = hist.series;
  var oiNow = series[series.length - 1].oi, oiPrev = series[series.length - 3].oi;
  var rows = tmClosedRows(row.rows4h, 14400);
  if (!rows || rows.length < 3 || !(oiPrev > 0)) return null;
  var pxNow = rows[rows.length - 1].c, pxPrev = rows[rows.length - 3].c;
  return {
    priceUp: pxNow > pxPrev, priceDown: pxNow < pxPrev,
    oiUp: oiNow > oiPrev * 1.005, oiDown: oiNow < oiPrev * 0.995
  };
}
async function tmCvdVerdict(row, dir){
  if (row.flow && (row.flow.verdict === 'with' || row.flow.verdict === 'against')) return row.flow.verdict;
  if (typeof W.binanceTakerRatio !== 'function') return null;
  var tk = await W.binanceTakerRatio(tmBaseOf(row) + 'USDT', '4h', 12);
  var series = tk && tk.series;
  var rows = tmClosedRows(row.rows4h, 14400);
  if (!series || series.length < 6 || !rows || rows.length < 6) return null;
  var r1 = series[series.length - 6].buySellRatio, r2 = series[series.length - 1].buySellRatio;
  var p1 = rows[rows.length - 6].c, p2 = rows[rows.length - 1].c;
  if (dir === 'long'){
    if (p2 > p1 && r2 < r1 && r2 < 1) return 'against';
    return r2 > 1 ? 'with' : 'against';
  }
  if (p2 < p1 && r2 > r1 && r2 > 1) return 'against';
  return r2 < 1 ? 'with' : 'against';
}
async function tmTakerShare(row){
  if (typeof W.binanceTakerRatio !== 'function') return null;
  try {
    var tk = await W.binanceTakerRatio(tmBaseOf(row) + 'USDT', '15m', 3);
    var series = tk && tk.series;
    if (!series || !series.length) return null;
    var ratio = +series[series.length - 1].buySellRatio;
    if (!(ratio > 0)) return null;
    return ratio / (1 + ratio);
  } catch (e) { return null; }
}
async function tmOiPercentile(row){
  if (typeof W.binanceOIHistory !== 'function') return null;
  try {
    var hist = await W.binanceOIHistory(tmBaseOf(row) + 'USDT', '4h', 30);
    if (!hist || !hist.series || hist.series.length < 12) return null;
    var vals = [], i, v;
    for (i = 0; i < hist.series.length; i++){
      v = +hist.series[i].oi;
      if (v > 0) vals.push(v);
    }
    if (vals.length < 12) return null;
    var now = vals[vals.length - 1], below = 0;
    for (i = 0; i < vals.length; i++) if (vals[i] <= now) below++;
    return below / vals.length;
  } catch (e) { return null; }
}
async function tmPerpPremium(row){
  if (typeof W.binanceBasis !== 'function') return null;
  try {
    var b = await W.binanceBasis(tmBaseOf(row) + 'USDT', 'PERPETUAL', '15m', 1);
    var last = b && (b.latest || (b.series && b.series[b.series.length - 1]));
    if (!last || !(last.indexPrice > 0) || !isFinite(last.futuresPrice)) return null;
    return (last.futuresPrice - last.indexPrice) / last.indexPrice;
  } catch (e) { return null; }
}
async function tmBookRatio(row, dir){
  if (typeof W.binanceDepth !== 'function') return null;
  try {
    var book = await W.binanceDepth(tmBaseOf(row) + 'USDT', 20);
    if (!book || !(book.bidUsd > 0) || !(book.askUsd > 0)) return null;
    return dir === 'long' ? book.bidUsd / book.askUsd : book.askUsd / book.bidUsd;
  } catch (e) { return null; }
}
async function tmFundingVelocity(row, dir){
  if (typeof W.binanceFundingHist !== 'function') return null;
  try {
    var hist = await W.binanceFundingHist(tmBaseOf(row) + 'USDT', 12);
    if (!hist || hist.length < 2) return null;
    var prev = +hist[hist.length - 2].rate;
    var cur = +hist[hist.length - 1].rate;
    return tmFundingSpike(prev, cur, dir);
  } catch (e) { return null; }
}
async function tmAbsorption(row, dir){
  if (typeof W.binanceTakerRatio !== 'function') return null;
  try {
    var tk = await W.binanceTakerRatio(tmBaseOf(row) + 'USDT', '1h', 12);
    var series = tk && tk.series;
    var bars = tmClosedRows(row.rows1h, 3600);
    if (!series || series.length < 6 || !bars || bars.length < 6) return null;
    function ratioAt(ts){
      var best = null, i, dt, r;
      for (i = 0; i < series.length; i++){
        r = +series[i].buySellRatio;
        dt = Math.abs((+series[i].t) - ts);
        if (!isFinite(r)) continue;
        if (best == null || dt < best.dt) best = { dt: dt, r: r };
      }
      if (!best || best.dt > 3600) return NaN;
      return best.r;
    }
    var win = bars.slice(-6);
    var dip = win[0], i;
    for (i = 1; i < win.length; i++){
      if (dir === 'long' && win[i].l < dip.l) dip = win[i];
      if (dir === 'short' && win[i].h > dip.h) dip = win[i];
    }
    var before = null;
    for (i = 0; i < bars.length; i++) if (bars[i] === dip && i > 0) before = bars[i - 1];
    if (!before) return null;
    var atDip = ratioAt(dip.t);
    var atBefore = ratioAt(before.t);
    if (!isFinite(atDip) || !isFinite(atBefore)) return null;
    if (dir === 'long') return atDip > atBefore;
    return atDip < atBefore;
  } catch (e) { return null; }
}
async function tmCvdSlope(row, dir){
  if (typeof W.binanceTakerRatio !== 'function') return null;
  try {
    var tk = await W.binanceTakerRatio(tmBaseOf(row) + 'USDT', '15m', 8);
    var series = tk && tk.series;
    if (!series || series.length < 6) return null;
    var first = +series[series.length - 6].buySellRatio;
    var last = +series[series.length - 1].buySellRatio;
    if (!isFinite(first) || !isFinite(last)) return null;
    var slope = last - first;
    return dir === 'long' ? slope >= 0 : slope <= 0;
  } catch (e) { return null; }
}
async function tmFetch15(row){
  try{
    if (typeof W.hgDeskFetchKlines === 'function'){
      var got = await W.hgDeskFetchKlines(row.xu || row, '15m', 80);
      if (got && got.length >= 30) return tmClosedRows(got, 900);
    }
  }catch(e){}
  try{
    if (typeof W.binanceKlines === 'function'){
      var b = await W.binanceKlines(tmBaseOf(row) + 'USDT', '15m', 80);
      if (b && b.length >= 30) return tmClosedRows(b, 900);
    }
  }catch(e2){}
  return null;
}

async function tmLiqRead(row){
  var base = tmBaseOf(row);
  var j = await tmProxyJson('https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&uly=' + encodeURIComponent(base + '-USDT') + '&state=filled&limit=100');
  var details = j && j.data && j.data[0] && j.data[0].details;
  if (!Array.isArray(details)) return null;
  var now = Date.now(), longLiq = 0, shortLiq = 0, buckets = {}, i;
  for (i = 0; i < details.length; i++){
    var d = details[i] || {};
    var ts = +d.ts || +d.time;
    if (!(ts > 0) || now - ts > 6 * 60 * 60 * 1000) continue;
    var sz = +d.sz || 0;
    var side = String(d.posSide || d.side || '').toLowerCase();
    var pxL = +d.bkPx || +d.px || +d.price;
    if (side === 'long' || side === 'sell') longLiq += sz;
    else if (side === 'short' || side === 'buy') shortLiq += sz;
    if (row && row.price > 0 && pxL > 0 && sz > 0){
      var key = Math.round(pxL / (row.price * 0.005));
      if (!buckets[key]) buckets[key] = { price: key * row.price * 0.005, long: 0, short: 0 };
      if (side === 'long' || side === 'sell') buckets[key].long += sz;
      else buckets[key].short += sz;
    }
  }
  var clusters = [];
  for (var key in buckets) clusters.push(buckets[key]);
  clusters.sort(function(x, y){ return (y.long + y.short) - (x.long + x.short); });
  return { longLiq: longLiq, shortLiq: shortLiq, clusters: clusters.slice(0, 8) };
}
async function tm5mVolumeOk(row, dir){
  var got = null;
  try {
    if (typeof W.binanceKlines === 'function') got = await W.binanceKlines(tmBaseOf(row) + 'USDT', '5m', 40);
  } catch (e) { got = null; }
  var rows = tmClosedRows(got, 300);
  if (!rows || rows.length < 15) return null;
  var last = rows[rows.length - 1], avg = 0, i;
  for (i = rows.length - 11; i < rows.length - 1; i++) avg += rows[i].v || 0;
  avg /= 10;
  if (!(avg > 0)) return null;
  if (dir === 'long') return last.c >= last.o && last.v > avg;
  return last.c <= last.o && last.v > avg;
}
async function tmMicroOk(row, dir){
  async function one(tf, n, sec){
    if (typeof W.binanceKlines !== 'function') return null;
    try {
      var got = await W.binanceKlines(tmBaseOf(row) + 'USDT', tf, n);
      var rows = tmClosedRows(got, sec);
      if (!rows || rows.length < 30 || typeof hgStructure !== 'function') return null;
      var hs = hgStructure(rows);
      if (!hs) return null;
      if (hs.trend === (dir === 'long' ? 'down' : 'up')) return false;
      var last = rows[rows.length - 1];
      if (dir === 'long' && last.c < last.o) return false;
      if (dir === 'short' && last.c > last.o) return false;
      return true;
    } catch (e) { return null; }
  }
  var both = await Promise.all([one('3m', 80, 180), one('1m', 60, 60)]);
  return { m3: both[0], m1: both[1] };
}
async function tmTradingView(row){
  var base = tmBaseOf(row);
  if (!base) return null;
  async function ask(ticker){
    var r = await fetch('/api/tv-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: { tickers: [ticker] } })
    });
    if (!r || !r.ok) return null;
    var j = await r.json();
    var d = j && j.data && j.data[0] && j.data[0].d;
    if (!d || !isFinite(+d[0])) return null;
    return { recommend: +d[0], rsi: +d[1] };
  }
  try {
    return await ask('BINANCE:' + base + 'USDT.P') || await ask('BINANCE:' + base + 'USDT');
  } catch (e) { return null; }
}
async function tmTopTrader(row){
  if (typeof W.binanceTopTraders !== 'function') return null;
  try {
    var ls = await W.binanceTopTraders(tmBaseOf(row) + 'USDT', '4h', 1);
    if (!ls || !ls.latest || !isFinite(+ls.latest.ratio)) return null;
    return +ls.latest.ratio;
  } catch (e) { return null; }
}
async function tmCrowdRatio(row){
  if (typeof W.binanceLongShort !== 'function') return null;
  try {
    var ls = await W.binanceLongShort(tmBaseOf(row) + 'USDT', '4h', 2);
    if (!ls || !ls.latest || !isFinite(+ls.latest.ratio)) return null;
    return +ls.latest.ratio;
  } catch (e) { return null; }
}

async function trendmxFormOne(ticket, row, ctx){
  var hard = [];
  var votes = [];
  function vote(name, state){
    votes.push({ name: name, v: state });
  }
  var dir = ticket.dir;
  var rows4 = tmClosedRows(row && row.rows4h, 14400);
  var rows1 = tmClosedRows(row && row.rows1h, 3600);
  var rowsD = tmClosedRows(row && row.rows1d, 86400);
  if (!row || !rows4 || rows4.length < 50) return ['4h history unread'];
  var valueGate = tmValueState(row, dir);
  if (valueGate && valueGate.reasons){
    for (var vg = 0; vg < valueGate.reasons.length; vg++) hard.push(valueGate.reasons[vg]);
  }
  var px = rows4[rows4.length - 1].c;
  var hs = (typeof hgStructure === 'function') ? hgStructure(rows4) : null;
  var want = dir === 'long' ? 'up' : 'down';
  if (!hs) hard.push('structure unread');
  else {
    if (hs.trend !== want) hard.push('4h structure ' + (hs.trend || 'range'));
    var n = rows4.length - 1;
    if (hs.lastCHoCH && hs.lastCHoCH.dir && hs.lastCHoCH.dir !== want && (n - hs.lastCHoCH.i) <= 20) hard.push('CHOCH against');
    var swings = hs.swings || [];
    var lastHigh = null, lastLow = null, si;
    for (si = 0; si < swings.length; si++){
      if (swings[si].type === 'HH' || swings[si].type === 'LH') lastHigh = swings[si];
      if (swings[si].type === 'HL' || swings[si].type === 'LL') lastLow = swings[si];
    }
    if (dir === 'long' && (!(lastHigh && lastHigh.type === 'HH') || !(lastLow && lastLow.type === 'HL'))) hard.push('not HH/HL');
    if (dir === 'short' && (!(lastHigh && lastHigh.type === 'LH') || !(lastLow && lastLow.type === 'LL'))) hard.push('not LH/LL');
    if (!hs.lastBOS || hs.lastBOS.dir !== want || (n - hs.lastBOS.i) > 30) hard.push('no recent BOS');
  }
  var closes = rows4.map(function(r){ return r.c; });
  var e20 = tmEmaLast(closes, 20), e50 = tmEmaLast(closes, 50), e200 = tmEmaLast(closes, 200);
  if (dir === 'long' && !(px > e20 && e20 > e50 && px > e200)) hard.push('EMA 20/50/200 against');
  if (dir === 'short' && !(px < e20 && e20 < e50 && px < e200)) hard.push('EMA 20/50/200 against');
  var vwap = tmSessionVwap(row.rows1h);
  if (!isFinite(vwap)) hard.push('VWAP unread');
  else if (dir === 'long' && !(px > vwap)) hard.push('below VWAP');
  else if (dir === 'short' && !(px < vwap)) hard.push('above VWAP');
  var wave1 = rows1 ? tmWaveOk(rows1, dir) : null;
  var st4 = tmSuperTrend(rows4, 10, 3);
  var st1 = rows1 ? tmSuperTrend(rows1, 10, 3) : null;
  if (!st4 || !st1) hard.push('supertrend unread');
  else if (dir === 'long' && !(st4.up && st1.up)) hard.push('supertrend against');
  else if (dir === 'short' && (st4.up || st1.up)) hard.push('supertrend against');
  var cmf = rows1 ? tmCmf(rows1, 20) : null;
  if (cmf == null) hard.push('money flow unread');
  else if (dir === 'long' && cmf < 0.05) hard.push('money flow ' + cmf.toFixed(2) + ' is under 0.05');
  else if (dir === 'short' && cmf > -0.05) hard.push('money flow ' + cmf.toFixed(2) + ' is above -0.05');
  var ker = rows1 ? tmKernel(rows1, 24, 8) : null;
  if (!ker) hard.push('kernel unread');
  else if (dir === 'long' && !(ker.slopeUp && ker.above)) hard.push('kernel is not rising under price');
  else if (dir === 'short' && !(!ker.slopeUp && !ker.above)) hard.push('kernel is not falling over price');
  var coiled = rows1 ? tmSqueezeHigh(rows1) : null;
  if (coiled == null) hard.push('squeeze unread');
  else if (coiled) hard.push('still inside the high squeeze');
  var qqe = rows1 ? tmQqe(rows1, dir) : null;
  if (qqe == null) hard.push('qqe unread');
  else if (!qqe) hard.push('qqe is not with the trade');
  var hull = rows1 ? tmHullRising(rows1, 21) : null;
  if (hull == null) hard.push('hull unread');
  else if (dir === 'long' && !hull) hard.push('hull slope is down');
  else if (dir === 'short' && hull) hard.push('hull slope is up');
  var vfi = rows1 ? tmVfi(rows1, 20, 0.2) : null;
  if (vfi == null) hard.push('volume flow unread');
  else if (dir === 'long' && !(vfi > 0)) hard.push('volume flow is not in');
  else if (dir === 'short' && !(vfi < 0)) hard.push('volume flow is not out');
  var diverged = rows1 ? tmWtDiverging(rows1, dir) : null;
  if (diverged == null) hard.push('wavetrend divergence unread');
  else if (diverged) hard.push('wavetrend is diverging');
  var block = rows1 ? tmFreshOb(rows1, dir) : null;
  if (block == null) hard.push('order block unread');
  else if (!block) hard.push('not at a fresh order block');
  var magic = rows1 ? tmTrendMagic(rows1, dir) : null;
  if (magic == null) hard.push('trend magic unread');
  else if (!magic) hard.push('trend magic is against the trade');
  var alpha = rows1 ? tmAlpha(rows1, dir) : null;
  if (alpha == null) hard.push('alphatrend unread');
  else if (!alpha) hard.push('alphatrend is against the trade');
  var band = rows1 ? tmRangeFilter(rows1, dir) : null;
  if (band == null) hard.push('range filter unread');
  else if (!band) hard.push('range filter is against the trade');
  var ml = rows1 ? tmLorentz(rows1, dir) : null;
  if (ml == null) hard.push('lorentz unread');
  else if (!ml) hard.push('lorentz is not with the trade');
  var half = rows1 ? tmHalfTrend(rows1, dir) : null;
  if (half == null) hard.push('halftrend unread');
  else if (!half) hard.push('halftrend is against the trade');
  var boom = rows1 ? tmWae(rows1, dir) : null;
  if (boom == null) hard.push('explosion unread');
  else if (!boom) hard.push('no explosion above the dead zone');
  var mom = rows1 ? tmSqueezeMom(rows1, dir) : null;
  if (mom == null) hard.push('squeeze momentum unread');
  else if (!mom) hard.push('momentum is not accelerating with the trade');
  var noise = rows1 ? tmDamiani(rows1) : null;
  if (noise == null) hard.push('volatility unread');
  else if (!noise) hard.push('chop, volatility is not above the noise');
  var aroon = rows1 ? tmAroon(rows1, dir) : null;
  if (aroon == null) hard.push('aroon unread');
  else if (!aroon) hard.push('aroon says the extreme is stale');
  var elder = rows1 ? tmElder(rows1, dir) : null;
  if (elder == null) hard.push('elder ray unread');
  else if (!elder) hard.push('elder ray is against the trade');
  var vwma = rows1 ? tmVwmaSide(rows1, dir) : null;
  if (vwma == null) hard.push('volume average unread');
  else if (!vwma) hard.push('volume is not sitting with the trade');
  var dmi = rows1 ? tmDmi(rows1, dir) : null;
  if (dmi == null) hard.push('dmi unread');
  else if (!dmi) hard.push('dmi is flat or the directional index is against the trade');
  var bandPos = rows1 ? tmBbSide(rows1, dir) : null;
  if (bandPos == null) hard.push('bollinger unread');
  else if (!bandPos) hard.push('price is outside the band or on the wrong side of the midline');
  var ichi = rows1 ? tmIchiSignal(rows1, dir) : null;
  if (ichi == null) hard.push('ichimoku line unread');
  else if (!ichi) hard.push('tenkan, kijun or chikou is against the trade');
  var stretch = rows1 ? tmVwapStretch(rows1, dir) : null;
  if (stretch == null) hard.push('vwap band unread');
  else if (!stretch) hard.push('price is stretched more than 2 ATR from VWAP');
  var ssl = rows1 ? tmSsl(rows1, dir) : null;
  if (ssl == null) hard.push('ssl unread');
  else if (!ssl) hard.push('ssl channel is against the trade');
  var stoch = rows1 ? tmStochRsi(rows1, dir) : null;
  if (stoch == null) hard.push('stoch rsi unread');
  else if (!stoch) hard.push('stoch rsi is not with the trade');
  var fisher = rows1 ? tmFisher(rows1, dir) : null;
  if (fisher == null) hard.push('fisher unread');
  else if (!fisher) hard.push('fisher is against the trade');
  var psar = rows1 ? tmPsar(rows1, dir) : null;
  if (psar == null) hard.push('parabolic sar unread');
  else if (!psar) hard.push('parabolic sar is against the trade');
  var schaff = rows1 ? tmSchaff(rows1, dir) : null;
  if (schaff == null) hard.push('schaff unread');
  else if (!schaff) hard.push('schaff trend cycle is against the trade');
  var vortex = rows1 ? tmVortex(rows1, dir) : null;
  if (vortex == null) hard.push('vortex unread');
  else if (!vortex) hard.push('vortex is against the trade');
  var ao = rows1 ? tmAwesome(rows1, dir) : null;
  if (ao == null) hard.push('awesome oscillator unread');
  else if (!ao) hard.push('awesome oscillator is against the trade');
  var mfi = rows1 ? tmMfi(rows1, dir) : null;
  if (mfi == null) hard.push('money flow index unread');
  else if (!mfi) hard.push('money flow index is against the trade');
  var gator = rows1 ? tmAlligator(rows1, dir) : null;
  if (gator == null) hard.push('alligator unread');
  else if (!gator) hard.push('alligator is not feeding with the trade');
  var cci = rows1 ? tmCci(rows1, dir) : null;
  if (cci == null) hard.push('cci unread');
  else if (!cci) hard.push('cci is against the trade');
  var chop = rows1 ? tmChop(rows1, dir) : null;
  if (chop == null) hard.push('choppiness unread');
  else if (!chop) hard.push('choppiness is above 61.8');
  var rvi = rows1 ? tmRvi(rows1, dir) : null;
  if (rvi == null) hard.push('vigor unread');
  else if (!rvi) hard.push('relative vigor is against the trade');
  var trix = rows1 ? tmTrix(rows1, dir) : null;
  if (trix == null) hard.push('trix unread');
  else if (!trix) hard.push('trix is against the trade');
  var ult = rows1 ? tmUltimate(rows1, dir) : null;
  if (ult == null) hard.push('ultimate oscillator unread');
  else if (!ult) hard.push('ultimate oscillator is against the trade');
  var obv = rows1 ? tmObv(rows1, dir) : null;
  if (obv == null) hard.push('on-balance volume unread');
  else if (!obv) hard.push('on-balance volume is against the trade');
  var ha = rows1 ? tmHeikin(rows1, dir) : null;
  if (ha == null) hard.push('heikin ashi unread');
  else if (!ha) hard.push('heikin ashi is against the trade');
  var force = rows1 ? tmForce(rows1, dir) : null;
  if (force == null) hard.push('force index unread');
  else if (!force) hard.push('force index is against the trade');
  var kst = rows1 ? tmKst(rows1, dir) : null;
  if (kst == null) hard.push('kst unread');
  else if (!kst) hard.push('know sure thing is against the trade');
  var macd = rows1 ? tmMacd(rows1, dir) : null;
  if (macd == null) hard.push('macd unread');
  else if (!macd) hard.push('macd is against the trade');
  var don = rows1 ? tmDonchian(rows1, dir) : null;
  if (don == null) hard.push('donchian unread');
  else if (!don) hard.push('price is on the wrong side of the donchian midpoint');
  var cmo = rows1 ? tmCmo(rows1, dir) : null;
  if (cmo == null) hard.push('chande unread');
  else if (!cmo) hard.push('chande momentum is against the trade');
  var kumo = rows1 ? tmKumo(rows1, dir) : null;
  if (kumo == null) hard.push('cloud unread');
  else if (!kumo) hard.push('price is inside or through the wrong side of the cloud');
  var tsi = rows1 ? tmTsi(rows1, dir) : null;
  if (tsi == null) hard.push('true strength unread');
  else if (!tsi) hard.push('true strength is against the trade');
  var chaikin = rows1 ? tmChaikin(rows1, dir) : null;
  if (chaikin == null) hard.push('chaikin unread');
  else if (!chaikin) hard.push('chaikin oscillator is against the trade');
  var dpo = rows1 ? tmDpo(rows1, dir) : null;
  if (dpo == null) hard.push('dpo unread');
  else if (!dpo) hard.push('detrended price is against the trade');
  var ease = rows1 ? tmEase(rows1, dir) : null;
  if (ease == null) hard.push('ease of movement unread');
  else if (!ease) hard.push('ease of movement is against the trade');
  var relvol = rows1 ? tmRelVol(rows1, dir) : null;
  if (relvol == null) hard.push('relative volatility unread');
  else if (!relvol) hard.push('relative volatility is against the trade');
  var cop = rows1 ? tmCoppock(rows1, dir) : null;
  if (cop == null) hard.push('coppock unread');
  else if (!cop) hard.push('coppock is against the trade');
  var lagu = rows1 ? tmLaguerre(rows1, dir) : null;
  if (lagu == null) hard.push('laguerre unread');
  else if (!lagu) hard.push('laguerre rsi is against the trade');
  var slope = rows1 ? tmLinreg(rows1, dir) : null;
  if (slope == null) hard.push('regression unread');
  else if (!slope) hard.push('regression slope is against the trade');
  var will = rows1 ? tmWilliams(rows1, dir) : null;
  if (will == null) hard.push('williams unread');
  else if (!will) hard.push('williams %R is against the trade');
  var bop = rows1 ? tmBop(rows1, dir) : null;
  if (bop == null) hard.push('balance of power unread');
  else if (!bop) hard.push('balance of power is against the trade');
  var kling = rows1 ? tmKlinger(rows1, dir) : null;
  if (kling == null) hard.push('klinger unread');
  else if (!kling) hard.push('klinger volume is against the trade');
  var smi = rows1 ? tmSmi(rows1, dir) : null;
  if (smi == null) hard.push('smi unread');
  else if (!smi) hard.push('stochastic momentum is against the trade');
  var tema = rows1 ? tmTema(rows1, dir) : null;
  if (tema == null) hard.push('tema unread');
  else if (!tema) hard.push('triple ema is against the trade');
  var impulse = rows1 ? tmImpulse(rows1, dir) : null;
  if (impulse == null) hard.push('impulse unread');
  else if (!impulse) hard.push('elder impulse is sloping against the trade');
  var div = rows1 ? tmRsiDiv(rows1, dir) : null;
  if (div == null) hard.push('rsi divergence unread');
  else if (!div) hard.push('rsi divergence is against the trade');
  var pvt = rows1 ? tmPvt(rows1, dir) : null;
  if (pvt == null) hard.push('price volume trend unread');
  else if (!pvt) hard.push('price volume trend is against the trade');
  var struct = rows1 ? tmStructure(rows1, dir) : null;
  if (struct == null) hard.push('structure unread');
  else if (!struct) hard.push('market structure is against the trade');
  var failBr = rows1 ? tmFailedBreak(rows1, dir) : null;
  if (failBr == null) hard.push('failed break unread');
  else if (!failBr) hard.push('the 20-bar extreme was pierced and closed back inside');
  var lostVwap = rows1 ? tmVwapLost(rows1, dir) : null;
  if (lostVwap == null) hard.push('session vwap unread');
  else if (!lostVwap) hard.push('price lost the session VWAP');
  var bos = rows1 ? tmBos(rows1, dir) : null;
  if (bos == null) hard.push('break of structure unread');
  else if (!bos) hard.push('structure broke against the trade');
  var yday = rows1 ? tmPriorDay(rows1, dir) : null;
  if (yday == null) hard.push('prior day unread');
  else if (!yday) hard.push('yesterday extreme was pierced and closed back inside');
  var engulf = rows1 ? tmEngulf(rows1, dir) : null;
  if (engulf == null) hard.push('engulf unread');
  else if (!engulf) hard.push('a candle engulfed the prior body against the trade');
  var inside = rows1 ? tmInsideFail(rows1, dir) : null;
  if (inside == null) hard.push('inside bar unread');
  else if (!inside) hard.push('an inside bar broke and closed back inside');
  var obvDiv = rows1 ? tmObvDiv(rows1, dir) : null;
  if (obvDiv == null) hard.push('obv divergence unread');
  else if (!obvDiv) hard.push('on-balance volume diverged against the trade');
  var dayOpen = rows1 ? tmDayOpen(rows1, dir) : null;
  if (dayOpen == null) hard.push('day open unread');
  else if (!dayOpen) hard.push('price lost the day open');
  var round = rows1 ? tmRound(rows1, dir) : null;
  if (round == null) hard.push('round level unread');
  else if (!round) hard.push('a round level was pierced and closed back through');
  var cross = rows1 ? tmEmaCross(rows1, dir) : null;
  if (cross == null) hard.push('ema cross unread');
  else if (!cross) hard.push('the 9 EMA just crossed against the trade');
  var eq = rows1 ? tmEqSweep(rows1, dir) : null;
  if (eq == null) hard.push('equal levels unread');
  else if (!eq) hard.push('equal highs or equal lows were swept and closed back inside');
  var fib = rows1 ? tmFibLost(rows1, dir) : null;
  if (fib == null) hard.push('fib unread');
  else if (!fib) hard.push('price lost the 61.8 of the last swing');
  var climax = rows1 ? tmClimax(rows1, dir) : null;
  if (climax == null) hard.push('climax unread');
  else if (!climax) hard.push('a climax bar closed against the trade');
  var week = rows1 ? tmWeekOpen(rows1, dir) : null;
  if (week == null) hard.push('week open unread');
  else if (!week) hard.push('price lost the weekly open');
  var macdDiv = rows1 ? tmMacdDiv(rows1, dir) : null;
  if (macdDiv == null) hard.push('macd divergence unread');
  else if (!macdDiv) hard.push('macd histogram diverged against the trade');
  var rsiX = rows1 ? tmRsiCross(rows1, dir) : null;
  if (rsiX == null) hard.push('rsi cross unread');
  else if (!rsiX) hard.push('RSI just crossed against the trade');
  var fvg = rows1 ? tmFvgLost(rows1, dir) : null;
  if (fvg == null) hard.push('fair value gap unread');
  else if (!fvg) hard.push('price lost the fair value gap');
  var bb = rows1 ? tmBbReject(rows1, dir) : null;
  if (bb == null) hard.push('bollinger unread');
  else if (!bb) hard.push('a Bollinger band was pierced and closed back inside');
  var poc = rows1 ? tmPocLost(rows1, dir) : null;
  if (poc == null) hard.push('point of control unread');
  else if (!poc) hard.push('price lost the session point of control');
  var pivot = rows1 ? tmPivot(rows1, dir) : null;
  if (pivot == null) hard.push('pivot unread');
  else if (!pivot) hard.push('a daily pivot was pierced and closed back through');
  var ob = rows1 ? tmObLost(rows1, dir) : null;
  if (ob == null) hard.push('order block unread');
  else if (!ob) hard.push('price closed through the order block');
  var kelt = rows1 ? tmKeltner(rows1, dir) : null;
  if (kelt == null) hard.push('keltner unread');
  else if (!kelt) hard.push('a Keltner band was pierced and closed back inside');
  var asia = rows1 ? tmAsiaSweep(rows1, dir) : null;
  if (asia == null) hard.push('asian range unread');
  else if (!asia) hard.push('the Asian range was swept and closed back inside');
  var vwapBand = rows1 ? tmVwapBand(rows1, dir) : null;
  if (vwapBand == null) hard.push('vwap band unread');
  else if (!vwapBand) hard.push('a VWAP band was pierced and closed back inside');
  var cam = rows1 ? tmCamarilla(rows1, dir) : null;
  if (cam == null) hard.push('camarilla unread');
  else if (!cam) hard.push('a Camarilla level was pierced and closed back through');
  var kijun = rows1 ? tmKijunLost(rows1, dir) : null;
  if (kijun == null) hard.push('kijun unread');
  else if (!kijun) hard.push('price lost the Kijun');
  var vah = rows1 ? tmVahLost(rows1, dir) : null;
  if (vah == null) hard.push('value area unread');
  else if (!vah) hard.push('price lost the value area');
  var stoch = rows1 ? tmStochCross(rows1, dir) : null;
  if (stoch == null) hard.push('stochastic unread');
  else if (!stoch) hard.push('stochastic crossed against the trade from the extreme');
  var h4 = rows1 ? tmH4Open(rows1, dir) : null;
  if (h4 == null) hard.push('4h open unread');
  else if (!h4) hard.push('price lost the 4h open');
  var naked = rows1 ? tmNakedPoc(rows1, dir) : null;
  if (naked == null) hard.push('prior point of control unread');
  else if (!naked) hard.push('price lost yesterday point of control');
  var reg = rows1 ? tmRegress(rows1, dir) : null;
  if (reg == null) hard.push('regression unread');
  else if (!reg) hard.push('a regression channel was pierced and closed back inside');
  var cci = rows1 ? tmCciExit(rows1, dir) : null;
  if (cci == null) hard.push('cci extreme unread');
  else if (!cci) hard.push('CCI crossed back from the extreme');
  var ext = rows1 ? tmExt(rows1, dir) : null;
  if (ext == null) hard.push('extension unread');
  else if (!ext) hard.push('the 1.272 extension was pierced and closed back through');
  var vz = (typeof volZ === 'function') ? volZ(rows4, 20) : NaN;
  if (!isFinite(vz)) hard.push('volume unread');
  else if (vz < 0) hard.push('volume declining');
  if (!tmAtLocation(rows4, rowsD, dir)) hard.push('no sweep, FVG or order block');
  var a = tmAtrLast(rows4);
  var risk = Math.abs(+ticket.entry - +ticket.stop);
  if (!(a > 0) || !(risk >= 0.8 * a && risk <= 2.5 * a)) hard.push('stop outside ATR');
  var hot = tmParkinsonHot(rows4);
  if (!hot) hard.push('volatility unread');
  else if (hot.hot && risk < 1.45 * a) hard.push('stop is inside 1.45 ATR while volatility is elevated');
  if (typeof row.fundingPct !== 'number' || !isFinite(row.fundingPct)) hard.push('funding unread');
  else if (dir === 'long' && row.fundingPct >= 0.04) hard.push('funding crowded long');
  else if (dir === 'short' && row.fundingPct <= -0.04) hard.push('funding crowded short');
  if (tmBaseOf(row) !== 'BTC'){
    var coinRet = tmFourHourReturn(row.rows4h);
    if (coinRet == null || !ctx || ctx.btcRet == null) hard.push('relative strength unread');
    else if (dir === 'long' && (coinRet - ctx.btcRet) < 0.015) hard.push('not leading BTC');
    else if (dir === 'short' && (ctx.btcRet - coinRet) < 0.015) hard.push('not lagging BTC');
    if (ctx && ctx.btcRows){
      var ratio = tmAltBtcLowerLow(rows4, ctx.btcRows);
      if (!ratio) hard.push('ALT/BTC unread');
      else if (dir === 'long' && ratio.lowerLow) hard.push('ALT/BTC made a lower low');
      else if (dir === 'short' && ratio.higherHigh) hard.push('ALT/BTC made a higher high');
    }
  }
  if (row.mark > 0 && px > 0){
    var basis = (row.mark - px) / px;
    if (dir === 'long' && basis > 0.0015) hard.push('perp basis rich');
    if (dir === 'short' && basis < -0.0015) hard.push('perp basis cheap');
  }
  var zones = tmSupplyDemand(rows4);
  if (zones && dir === 'long' && zones.supply && px >= zones.supply.lo && px <= zones.supply.hi) hard.push('inside supply');
  if (zones && dir === 'short' && zones.demand && px >= zones.demand.lo && px <= zones.demand.hi) hard.push('inside demand');
  if (!ctx || ctx.calendarOk !== true) hard.push('calendar unread');
  else if (ctx.eventBlock) hard.push('high-impact USD event');
  if (ctx && ctx.newsBook){
    var hit = tmCoinHeadline(ctx.newsBook, tmBaseOf(row));
    if (dir === 'long' && (hit.hack || hit.delist || hit.lawsuit)) hard.push('coin headline against');
    if (dir === 'long' && (ctx.newsBook.marketHack || ctx.newsBook.marketReg)) hard.push('market headline against longs');
    if (dir === 'short' && hit.listing) hard.push('fresh listing against a short');
  }
  if (ctx && ctx.unlockOk === true && ctx.unlockBases && ctx.unlockBases[tmBaseOf(row)]) hard.push('token unlock within 48h');
  if (tmBaseOf(row) !== 'BTC' && ctx && ctx.domOk === true && dir === 'long' && ctx.btcDomRising) hard.push('BTC.D rising');
  if (ctx && ctx.ethOk === true && dir === 'long' && ctx.ethStructure === 'down' && tmBaseOf(row) !== 'BTC' && tmBaseOf(row) !== 'ETH') hard.push('ETH structure down');
  if (ctx && ctx.stableOk === true && dir === 'long' && ctx.stableFalling) hard.push('stablecoin liquidity falling');
  if (ctx && ctx.totalOk === true && dir === 'long' && (ctx.totalFalling || ctx.altsFalling) && tmBaseOf(row) !== 'BTC') hard.push('TOTAL / alts falling');
  if (ctx && ctx.macroOk === true && dir === 'long' && ctx.riskOff) hard.push('macro risk-off');
  if (ctx && ctx.macroOk === true && dir === 'short' && ctx.riskOn) hard.push('macro risk-on');
  if (tmSettlementFreeze()) hard.push('funding settlement window');
  if (tmAsiaChop()) hard.push('asian session');
  var room = tmLiquidityRoom(rows4, dir, +ticket.entry, risk);
  if (room == null) hard.push('liquidity map unread');
  else if (!room.open) hard.push('next pool is only ' + room.room.toFixed(1) + 'R away');
  if (hard.length) return hard;

  var weeks = tmWeeklyRows(row.rows1d || rowsD);
  if (!weeks) vote('weekly unread', 0);
  else {
    var wst = (typeof hgStructure === 'function') ? hgStructure(weeks) : null;
    if (!wst) vote('weekly', 0);
    else vote('weekly structure', (wst.trend === (dir === 'long' ? 'down' : 'up')) ? -1 : 1);
  }
  var today = row.rows1d && row.rows1d[row.rows1d.length - 1];
  var dayOpen = today ? today.o : NaN;
  var weekOpen = weeks ? weeks[weeks.length - 1].o : NaN;
  if (!(dayOpen > 0)) vote('daily open', 0);
  else vote('daily open', (dir === 'long' ? px > dayOpen : px < dayOpen) ? 1 : -1);
  if (!(weekOpen > 0)) vote('weekly open', 0);
  else vote('weekly open', (dir === 'long' ? px > weekOpen : px < weekOpen) ? 1 : -1);
  var prof = tmVolumeProfile(rows4);
  if (!prof) vote('volume profile', 0);
  else if (dir === 'long' && px < prof.val) vote('below value area', -1);
  else if (dir === 'long' && px > prof.vah && !(vz > 0)) vote('VAH break on declining volume', -1);
  else if (dir === 'short' && px > prof.vah) vote('above value area', -1);
  else if (dir === 'short' && px < prof.val && !(vz > 0)) vote('VAL break on declining volume', -1);
  else vote('value area', 1);
  var node = tmNodeVeto(prof, px, dir, a, vz);
  vote(node || 'volume nodes', node ? -1 : 1);
  if (!zones) vote('supply/demand', 0);
  else if (dir === 'long' && zones.demand && px >= zones.demand.lo && px <= zones.demand.hi + a) vote('at demand', 1);
  else if (dir === 'short' && zones.supply && px <= zones.supply.hi && px >= zones.supply.lo - a) vote('at supply', 1);
  else vote('supply/demand', 0);
  if (!rows1 || rows1.length < 40 || typeof hgStructure !== 'function') vote('1h', 0);
  else {
    var h1 = hgStructure(rows1);
    vote('1h structure', (h1 && h1.trend === (dir === 'long' ? 'down' : 'up')) ? -1 : 1);
  }
  var localAgainst = votes.filter(function(v){ return v.v < 0; });
  if (localAgainst.length) return localAgainst.map(function(v){ return v.name; });

  var net = await Promise.all([
    tmCvdVerdict(row, dir),
    tmOiRead(row),
    tmFetch15(row),
    tmCrowdRatio(row),
    tmLiqRead(row),
    tm5mVolumeOk(row, dir),
    tmMicroOk(row, dir),
    tmTradingView(row),
    tmTopTrader(row),
    tmFundingZ(row),
    tmTakerShare(row),
    tmOiPercentile(row),
    tmPerpPremium(row),
    tmBookRatio(row, dir),
    tmFundingVelocity(row, dir),
    tmAbsorption(row, dir),
    tmCvdSlope(row, dir)
  ]);
  var cvd = net[0], oi = net[1], m15 = net[2], crowd = net[3], liq = net[4], m5 = net[5], micro = net[6], tv = net[7], top = net[8], fundZ = net[9], takerShare = net[10], oiPct = net[11], prem = net[12], book = net[13], fundVel = net[14], absorb = net[15], slope = net[16];
  if (cvd !== 'with') hard.push(cvd === 'against' ? 'CVD against' : 'CVD unread');
  if (!oi) hard.push('OI unread');
  else if (dir === 'long' && oi.priceUp && oi.oiDown) hard.push('OI falling, short covering not new longs');
  else if (dir === 'long' && !((oi.priceUp && oi.oiUp) || (oi.priceDown && oi.oiDown))) hard.push('OI not confirming the rise');
  else if (dir === 'short' && !(oi.priceDown && oi.oiUp)) hard.push('OI not confirming the drop');
  if (!m15) hard.push('15m unread');
  else if (!tm15Confirm(m15, dir)) hard.push('15m no sweep and CHOCH');
  else if (tm15HeavyAgainst(m15, dir)) hard.push('15m breaking against on volume');
  if (m15){
    var trig = tmTriggerRvol(m15);
    if (trig == null) hard.push('15m trigger volume unread');
    else if (trig < 1.6) hard.push('15m trigger volume ' + trig.toFixed(2) + 'x is under 1.6x');
    var body = tmBodyCommit(m15, dir);
    if (body == null) hard.push('15m body commit unread');
    else if (!body) hard.push('15m body did not close past the swing');
    var gap = tmDisplacementFvg(m15, dir);
    if (gap == null) hard.push('15m displacement unread');
    else if (!gap) hard.push('15m displacement gap missing');
    var soup = tmTurtleReclaim(m15, dir);
    if (soup == null) hard.push('sweep unread');
    else if (!soup) hard.push('no sweep and reclaim on the close');
    var stalled = tmStalled(m15, dir);
    if (stalled == null) hard.push('15m progress unread');
    else if (stalled) hard.push('15m has not expanded in 3 bars');
    var wave15 = tmWaveOk(m15, dir);
    if (wave1 !== true && wave15 !== true){
      if (wave1 == null && wave15 == null) hard.push('wavetrend unread');
      else hard.push('no wavetrend cross from the extreme');
    }
    var ut = tmUtBot(m15, 2);
    if (ut == null) hard.push('ut bot unread');
    else if (dir === 'long' && ut !== 'buy') hard.push('ut bot is not long');
    else if (dir === 'short' && ut !== 'sell') hard.push('ut bot is not short');
  }
  if (fundZ != null && dir === 'long' && fundZ > 2) hard.push('funding z ' + fundZ.toFixed(1) + ' is crowded');
  if (fundZ != null && dir === 'short' && fundZ < -2) hard.push('funding z ' + fundZ.toFixed(1) + ' is crowded');
  if (takerShare == null) hard.push('taker share unread');
  else if (dir === 'long' && takerShare < 0.60) hard.push('taker buy ' + (takerShare * 100).toFixed(0) + '% is under 60%');
  else if (dir === 'short' && (1 - takerShare) < 0.60) hard.push('taker sell ' + ((1 - takerShare) * 100).toFixed(0) + '% is under 60%');
  if (m15 && takerShare != null && typeof atr === 'function'){
    var a15 = atr(m15, 14);
    var atr15 = a15 && a15.length ? a15[a15.length - 1] : NaN;
    var trap = tmEffortTrap(m15[m15.length - 1], atr15, takerShare, dir);
    if (trap == null) hard.push('effort unread');
    else if (trap) hard.push('effort without result');
  }
  if (fundZ == null || oiPct == null) hard.push('crowding density unread');
  else if (dir === 'long' && fundZ * oiPct > 2.5) hard.push('crowding density ' + (fundZ * oiPct).toFixed(2) + ' is too long');
  else if (dir === 'short' && fundZ * oiPct < -2.5) hard.push('crowding density ' + (fundZ * oiPct).toFixed(2) + ' is too short');
  if (prem == null) hard.push('perp premium unread');
  else if (dir === 'long' && prem > 0.0012) hard.push('perp premium ' + (prem * 100).toFixed(2) + '% is rich');
  else if (dir === 'short' && prem < -0.0012) hard.push('perp premium ' + (prem * 100).toFixed(2) + '% is cheap');
  if (book == null) hard.push('book unread');
  else if (book < 1.35) hard.push('book ' + book.toFixed(2) + 'x is under 1.35x');
  if (fundVel == null) hard.push('funding velocity unread');
  else if (fundVel) hard.push('funding is accelerating against the trade');
  if (absorb == null) hard.push('absorption unread');
  else if (!absorb) hard.push('the pullback was not absorbed');
  if (slope == null) hard.push('delta slope unread');
  else if (!slope) hard.push('5-bar delta is against the trade');
  if (m15){
    var chand = tmChandelier(m15, dir, +ticket.entry);
    if (chand != null) ticket.chandelier = chand;
  }
  var syn = tmSynergy(row, dir, {
    body: m15 ? tmBodyCommit(m15, dir) === true : false,
    takerOk: takerShare != null && (dir === 'long' ? takerShare >= 0.60 : (1 - takerShare) >= 0.60)
  });
  row.tmSynergy = syn;
  if (syn < 85) hard.push('synergy ' + syn + '% is under 85%');
  if (hard.length) return hard;

  if (crowd == null) vote('positioning', 0);
  else if (dir === 'long' && crowd >= 1.8 && row.fundingPct > 0) vote('longs crowded', -1);
  else if (dir === 'short' && crowd <= 0.7 && row.fundingPct < 0) vote('shorts crowded', -1);
  else vote('positioning', 1);
  if (!liq) vote('liquidations', 0);
  else if (dir === 'long' && liq.shortLiq > liq.longLiq * 2 && liq.shortLiq > 0 && prof && px > prof.poc) vote('short-liquidation spike', -1);
  else if (dir === 'short' && liq.longLiq > liq.shortLiq * 2 && liq.longLiq > 0 && prof && px < prof.poc) vote('long-liquidation spike', -1);
  else if (liq.clusters && liq.clusters[0] && liq.clusters[0].price > 0 && Math.abs(px - liq.clusters[0].price) / px < 0.004) vote('inside liquidation cluster', -1);
  else vote(tmLiqSwept(rows4, liq, dir) ? 'liquidation sweep' : 'liquidation map', 1);
  if (m5 == null) vote('5m', 0);
  else vote('5m volume', m5 === true ? 1 : -1);
  if (!micro || micro.m3 == null) vote('3m', 0);
  else vote('3m structure', micro.m3 === true ? 1 : -1);
  if (!ctx || ctx.total2Ok !== true) vote('TOTAL2', 0);
  else if (dir === 'long' && ctx.total2Falling && tmBaseOf(row) !== 'BTC') vote('TOTAL2 falling', -1);
  else vote('TOTAL2', 1);
  if (!ctx || ctx.total3Ok !== true) vote('TOTAL3', 0);
  else if (dir === 'long' && ctx.total3Falling && tmBaseOf(row) !== 'BTC' && tmBaseOf(row) !== 'ETH') vote('TOTAL3 falling', -1);
  else vote('TOTAL3', 1);
  if (!ctx || ctx.etfOk !== true) vote('ETF', 0);
  else if (dir === 'long' && ctx.etfFalling && !(ctx.newsBook && ctx.newsBook.etfInflow)) vote('ETF proxies falling', -1);
  else vote('ETF', 1);
  if (!tv) vote('TradingView', 0);
  else if (dir === 'long' && tv.recommend < 0) vote('TradingView against', -1);
  else if (dir === 'short' && tv.recommend > 0) vote('TradingView against', -1);
  else vote('TradingView', 1);
  if (top == null) vote('top traders', 0);
  else if (dir === 'long' && top >= 2.2) vote('top traders crowded long', -1);
  else if (dir === 'short' && top <= 0.55) vote('top traders crowded short', -1);
  else if (dir === 'long' && top > 1) vote('top traders', 1);
  else if (dir === 'short' && top < 1) vote('top traders', 1);
  else vote('top traders flat', -1);
  if (!ctx || ctx.fngOk !== true) vote('fear and greed', 0);
  else if (dir === 'long' && ctx.fng >= 80) vote('extreme greed', -1);
  else if (dir === 'short' && ctx.fng <= 20) vote('extreme fear', -1);
  else vote('fear and greed', 1);

  var against = votes.filter(function(v){ return v.v < 0; });
  if (against.length) return against.map(function(v){ return v.name; });
  var got = votes.filter(function(v){ return v.v > 0; }).length;
  if (got < 8) return ['confluence ' + got + '/' + votes.length + ', need 8'];
  ticket.confluence = got + '/' + votes.length;
  ticket.synergy = row.tmSynergy;
  var atr4 = tmAtrLast(rows4);
  if (atr4 > 0 && isFinite(+ticket.entry)) ticket.trailBe = dir === 'long' ? +ticket.entry + 0.35 * atr4 : +ticket.entry - 0.35 * atr4;
  ticket.pine = 'Coppock, Laguerre RSI and the regression slope agree with the earlier crypto scripts';
  return [];
}

function tmFourHourReturn(rows){
  var c = tmClosedRows(rows, 14400);
  if (!c || c.length < 7 || !(c[c.length - 7].c > 0)) return null;
  return (c[c.length - 1].c - c[c.length - 7].c) / c[c.length - 7].c;
}
function tmLiqSwept(rows4, liq, dir){
  if (!rows4 || !liq || !liq.clusters) return false;
  var recent = rows4.slice(-4), i, k;
  for (i = 0; i < liq.clusters.length; i++){
    var cl = liq.clusters[i];
    if (!(cl.price > 0)) continue;
    for (k = 0; k < recent.length; k++){
      if (dir === 'long' && cl.long >= cl.short && recent[k].l < cl.price && recent[k].c > cl.price) return true;
      if (dir === 'short' && cl.short >= cl.long && recent[k].h > cl.price && recent[k].c < cl.price) return true;
    }
  }
  return false;
}
function trendmxCryptoCandidates(rows){
  var bag = [];
  if (!Array.isArray(rows) || typeof hgStructure !== 'function'){
    bag.held = { stack: [] };
    return bag;
  }
  var i;
  for (i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || !r.rows4h || !r.comps) continue;
    var dir = tmDirOf(r);
    if (dir !== 'long' && dir !== 'short') continue;
    if (dir === 'long' && tmAltLongBlockedByBtc(r)) continue;
    if (dir === 'long' && !(r.score >= 2)) continue;
    if (dir === 'short' && !(r.score <= -2)) continue;
    var rows4 = tmClosedRows(r.rows4h, 14400);
    var rowsD = tmClosedRows(r.rows1d, 86400);
    if (!rows4 || rows4.length < 50 || !tmAtLocation(rows4, rowsD, dir)) continue;
    var hs = hgStructure(rows4);
    if (!hs || hs.trend !== (dir === 'long' ? 'up' : 'down')) continue;
    var plan = trendmxPlan({
      dir: dir, score: r.score, rows4h: rows4, rows1h: r.rows1h, entry: r.price,
      gate: r.gate, comps: r.comps, sym: r.sym, fundingPct: r.fundingPct,
      freshCross: r.freshCross, base: r.base
    });
    if (!plan || !isFinite(+plan.entry) || !isFinite(+plan.stop) || !isFinite(+plan.t1)) continue;
    if (typeof tmValidSetup === 'function' && !tmValidSetup(plan)) continue;
    bag.push({
      sym: r.sym, dir: dir, entry: plan.entry, stop: plan.stop, t1: plan.t1, t2: plan.t2,
      rr: isFinite(+plan.rr1) ? +plan.rr1 : TM_T1_R, score: r.score, adx: r.adx,
      freshCross: r.freshCross || '', conviction: 'CRYPTO', tier: 'CRYPTO', comps: r.comps,
      rank: Math.abs(+r.score || 0) * 10 + (r.freshCross ? 8 : 0) + ((r.gate && r.gate.clean7) ? 6 : 0),
      note: 'crypto · composite ' + (r.score > 0 ? '+' : '') + r.score + '/5' + (r.freshCross ? (' · ' + r.freshCross) : '')
    });
  }
  bag.sort(function(a, b){ return b.rank - a.rank; });
  var out = [], seen = {}, nL = 0, nS = 0;
  for (i = 0; i < bag.length; i++){
    var key = bag[i].sym + '|' + bag[i].dir;
    if (seen[key]) continue;
    if (bag[i].dir === 'long' && nL >= 6) continue;
    if (bag[i].dir === 'short' && nS >= 4) continue;
    seen[key] = 1;
    if (bag[i].dir === 'long') nL++; else nS++;
    out.push(bag[i]);
  }
  out.held = { stack: [] };
  return out;
}

function tmStampEth(ctx, rows){
  if (!ctx) return ctx;
  ctx.ethStructure = null;
  if (Array.isArray(rows)){
    for (var ei = 0; ei < rows.length; ei++){
      if (tmBaseOf(rows[ei]) !== 'ETH') continue;
      try { ctx.ethStructure = tmStructureDir(rows[ei].rows4h); } catch (eE) { ctx.ethStructure = null; }
      if (ctx.ethStructure) break;
    }
  }
  ctx.ethOk = ctx.ethStructure === 'up' || ctx.ethStructure === 'down';
  return ctx;
}

async function trendmxFormationPass(golden, death, rows, ctxReady, crypto){
  var ctx = ctxReady || await trendmxLoadContext(rows);
  if (!ctx.ethOk) tmStampEth(ctx, rows);
  ctx.btcRet = null;
  ctx.btcRows = null;
  if (Array.isArray(rows)){
    for (var bi = 0; bi < rows.length; bi++){
      if (tmBaseOf(rows[bi]) !== 'BTC') continue;
      ctx.btcRows = tmClosedRows(rows[bi].rows4h, 14400);
      ctx.btcRet = tmFourHourReturn(rows[bi].rows4h);
      if (ctx.btcRet != null) break;
    }
  }
  async function keep(list){
    var out = [];
    out.held = (list && list.held) ? list.held : { waiting: 0, grade: 0, cascade: 0, gates: 0 };
    out.held.stack = [];
    var bySym = {};
    for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].sym) bySym[rows[i].sym] = rows[i];
    var jobs = [];
    for (var k = 0; k < list.length; k++) jobs.push(list[k]);
    var cursor = 0;
    async function worker(){
      while (cursor < jobs.length){
        var ticket = jobs[cursor++];
        var row = bySym[ticket.sym];
        var bad = [];
        try{ bad = await trendmxFormOne(ticket, row, ctx); }catch(eOne){ bad = ['formation unread']; }
        if (bad.length) out.held.stack.push({ sym: ticket.sym, reasons: bad });
        else {
          ticket.note = (ticket.note || '') + (ticket.confluence ? (' · confluence ' + ticket.confluence) : ' · full stack');
          if (isFinite(ticket.synergy)) ticket.note += ' · synergy ' + ticket.synergy + '%';
          if (isFinite(ticket.trailBe)) ticket.note += ' · after the first target, example stop ' + ticket.trailBe;
          if (isFinite(ticket.chandelier)) ticket.note += ' · chandelier ' + ticket.chandelier;
          if (ticket.pine) ticket.note += ' · ' + ticket.pine;
          out.push(ticket);
        }
      }
    }
    var workers = [];
    var lanes = Math.min(6, jobs.length);
    for (var w = 0; w < lanes; w++) workers.push(worker());
    await Promise.all(workers);
    return out;
  }
  var both = await Promise.all([keep(golden || []), keep(death || []), keep(crypto || [])]);
  return { golden: both[0], death: both[1], crypto: both[2] };
}

async function trendmxScan(opts){
  opts = opts || {};
  var maxAge = (opts.maxAgeMs > 0) ? opts.maxAgeMs : (5 * 60 * 1000);
  if (!opts.force && __tmScanSnap && __tmScanSnap.at && (Date.now() - __tmScanSnap.at) < maxAge){
    return __tmScanSnap;
  }
  var ctxP = trendmxLoadContext([]);
  var core = await trendmxScanCore(opts);
  trendmxStampBtcStructure(core.rows);
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
  try{
    var ctx = await ctxP;
    tmStampEth(ctx, core.rows);
    var crypto = trendmxCryptoCandidates(core.rows);
    var formed = await trendmxFormationPass(golden, death, core.rows, ctx, crypto);
    golden = formed.golden;
    death = formed.death;
    crypto = formed.crypto;
  }catch(eForm){
    golden = [];
    golden.held = { waiting: 0, grade: 0, cascade: 0, gates: 0, stack: [{ sym: 'desk', reasons: ['formation pass failed'] }] };
    death = [];
    death.held = { stack: [] };
    crypto = [];
    crypto.held = { stack: [] };
  }
  __tmScanSnap = {
    at: core.at, rows: core.rows, failed: core.failed, uniLen: core.uniLen, scanned: core.scanned,
    goldenCross: golden, deathCross: death, cryptoSetups: crypto, note: core.note, source: core.source, venueCounts: core.venueCounts,
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
  /* hg-v1154: the SWING post-gate policy on the gates this desk borrows -- a vetoed
     row keeps its levels and is watch-only (the shared card prints no handoff there) */
  if (tmPostGateVeto(r)) return 'near';
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

function trendmxCryptoDeskHTML(list){
  list = list || [];
  var held = list.held || {};
  var cards = '';
  for (var i = 0; i < Math.min(list.length, 6); i++) cards += trendmxCrossCardHTML(list[i]);
  var why = list.length ? '' : ('<div class="note">No crypto setup. The coin needs 4h structure, a sweep or fair-value gap or order block, relative strength versus BTC, open interest and CVD with the trade, a 15m sweep and change of character, and 8 confluence votes with none against.'
    + ((held.stack && held.stack.length) ? ' ' + held.stack.slice(0, 4).map(function(x){ return x.sym + ': ' + x.reasons.slice(0, 2).join(', '); }).join(' · ') + '.' : '')
    + '</div>');
  return '<div class="panel" style="margin:12px 0;border-left:4px solid #0369a1">'
    + '<h2>CRYPTO SETUPS <span>structure · relative strength · OI · CVD · 15m trigger · 8 confluence votes, none against</span></h2>'
    + why
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cards + '</div>'
    + '</div>';
}

function trendmxGoldenDeskHTML(golden){
  golden = golden || [];
  var held = golden.held || {};
  var cards = '';
  for (var i = 0; i < Math.min(golden.length, 4); i++) cards += trendmxCrossCardHTML(golden[i]);
  var why = golden.length ? '' : ('<div class="note">No golden setup. A cross still has to clear the 4h cascade, 6/7 gates, the EMA tag and the TRADE grade. The 4h RSI has to sit on the bull floor for a long or the bear ceiling for a short, the pullback has to tag the anchored VWAP from the last 4h swing, and an alt long has to be leading Bitcoin by at least 1.5 percent with no lower low in ALT/BTC. The 15m body has to close past the swing by a quarter of its own ATR, and the real 15m taker share has to be at least 60 percent on that side. Open interest has to rise with the break. The four reads have to add to at least 85 percent. A missing taker print is not 50 percent, and missing open interest is not new buying. Then structure, relative strength versus BTC, open interest, CVD, and at least 8 confluence votes with none against.'
    + (held.waiting ? ' ' + held.waiting + ' waiting for the EMA tag.' : '')
    + (held.gates ? ' ' + held.gates + ' failed the gates.' : '')
    + (held.cascade ? ' ' + held.cascade + ' have no 4h cascade.' : '')
    + (held.grade ? ' ' + held.grade + ' failed the TRADE grade.' : '')
    + ((held.stack && held.stack.length) ? ' ' + held.stack.slice(0, 3).map(function(x){ return x.sym + ' blocked: ' + x.reasons.slice(0, 3).join(', '); }).join(' · ') + '.' : '')
    + '</div>');
  return '<div class="panel tier-clean" style="margin:12px 0;border-left:4px solid #047857">'
    + '<h2>⚡ GOLDEN CROSS DESK <span>full stack only · structure, location, volume, OI, CVD, VWAP, 15m, macro, calendar'
    + ((__tmMacro && __tmMacro.btcStructure === 'down') ? ' · alt longs stood down, BTC structure is down' : '')
    + '</span></h2>'
    + why
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
              heldWhy: { clean: { flow: 0, mom: 0, vol: 0, fund: 0, postgate: 0 }, conv: { flow: 0, mom: 0, vol: 0, fund: 0, postgate: 0 } },
              /* hg-v1154: the post-gate-vetoed rows, kept so they are RECORDED (ticket:false) and never shown */
              heldPostGate: [],
              /* hg-v1159: the rows the four witnesses held off, kept for the same reason (heldBy names the witness) */
              heldWitness: [] };
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
    /* hg-v1159: the witness that holds a row off is NAMED here and the row
       is kept (with its plan, when one prices) so the record below carries
       it with ticket:false and the witness mark false — as hg-v1154 did for
       the post-gate veto. The counts and the desks are unchanged. */
    var heldBy = null;
    if (r.flow && r.flow.verdict === 'against'){
      if (isClean){ out.heldClean++; out.heldWhy.clean.flow++; }
      else { out.heldConv++; out.heldWhy.conv.flow++; }
      heldBy = 'flow';
    }
    /* hg-v1019: THE MOMENTUM WITNESS hold-off — the same mechanic one leg
       down. A row whose 1D RSI range has TURNED against its own majority
       (long under the 40 bull floor, short over the 60 bear ceiling) is a
       slow composite fighting a turned regime: held off the desks, counted
       and named per class, still painting in the matrix with its chip.
       WITH and FLAT and UNREAD rows pass — the witness only ever removes. */
    if (!heldBy && trendmxMomState(r, dir) === 'against'){
      if (isClean){ out.heldClean++; out.heldWhy.clean.mom++; }
      else { out.heldConv++; out.heldWhy.conv.mom++; }
      heldBy = 'mom';
    }
    /* hg-v1020: THE VOLUME WITNESS hold-off — the same mechanic, the third
       witness. A row whose swing volume trend DIVERGES against its own
       majority (distribution under the rally / accumulation under the
       fall) is held off, counted and named per class, still painting with
       its chip. WITH, FLAT and UNREAD pass — it only ever removes. */
    if (!heldBy && trendmxVolState(r, dir) === 'against'){
      if (isClean){ out.heldClean++; out.heldWhy.clean.vol++; }
      else { out.heldConv++; out.heldWhy.conv.vol++; }
      heldBy = 'vol';
    }
    /* hg-v1034: THE FUNDAMENTAL + SENTIMENT WITNESS hold-off — the fourth
       witness, the ONLY one that reads off-chart evidence (on-chain, the
       coin's own term curve, F&G, options positioning, the calendar). A
       red-folder blackout REFUSES and a 2+ net checked headwind DEMOTES:
       held off both class desks, counted per class under the fund reason,
       still painting with its chip. WITH, FLAT and a dark board pass — it
       only ever removes, and one witness never flips. */
    var fundSt = heldBy ? null : trendmxFundState(r, dir);
    if (fundSt === 'refuse' || fundSt === 'against'){
      if (isClean){ out.heldClean++; out.heldWhy.clean.fund++; }
      else { out.heldConv++; out.heldWhy.conv.fund++; }
      heldBy = 'fund';
    }
    var plan = trendmxPlan(Object.assign({}, r, { dir: dir }));
    if (!tmValidSetup(plan)) continue;
    if (heldBy){
      out.heldWitness.push({ row: r, plan: plan, dir: dir, stack: null, rank: 0, isClean: isClean, heldBy: heldBy });
      continue;
    }
    /* hg-v1154: THE POST-GATE WITNESS hold-off -- the fifth witness, and the only
       one that is the SWING desk's own rule rather than a read of this desk's.
       A vetoed row is held off both class desks, counted and named per class,
       still painting with its chip -- and unlike the other four it is kept here
       so the record below carries it with ticket:false, because a veto nobody
       records is a veto nobody can measure. PASS and UNCHECKED pass. */
    if (tmPostGateVeto(r)){
      if (isClean){ out.heldClean++; out.heldWhy.clean.postgate++; }
      else { out.heldConv++; out.heldWhy.conv.postgate++; }
      out.heldPostGate.push({ row: r, plan: plan, dir: dir, stack: null, rank: 0, isClean: isClean });
      continue;
    }
    var item = { row: r, plan: plan, dir: dir, stack: trendmxCardStack(r, dir) };
    if (isClean){
      /* the old board's intra-class rank, unchanged: composite, then gates */
      item.rank = Math.abs(r.score) * 10 + (r.gate.gatesPassed || 0);
      out.clean.push(item);
    } else {
      /* the conviction class orders on its OWN claim: trend strength.
         Composite first. ADX breaks ties only inside 22-38. Above 44 is exhaustion and does not outrank a healthy trend. */
      item.rank = Math.abs(r.score) * 10 + (fin(r.adx) ? (r.adx > 44 ? 0 : Math.min(r.adx, 38) / 10) : 0);
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
  /* hg-v1154: the post-gate-vetoed rows ride into the record and nowhere else */
  /* hg-v1159: and the witness-held rows, for the same reason */
  var cands = out.clean.concat(out.conv).concat(out.heldPostGate).concat(out.heldWitness);
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
                 /* hg-v1159: every witness state (true WITH / false AGAINST / absent
                    abstained), the hg-v1154 post-gate verdict and the five composite
                    legs, through the ONE reads helper both record sites call */
                 reads: tmRecordReads(c.row, c.dir),
                 /* hg-v995: the composite is NOT handed in here -- the ledger reads it off
                    this desk's own published snapshot (hgTrendMatrixMark), the same row the
                    board painted, so a second copy would be the same number twice */
                 mechanic: (c.row && c.row.gate && c.row.gate.clean7) ? 'TM-CLEAN7' : 'TM-CONVICTION',
                 /* hg-v1154 / hg-v1159: the ticket claim is the board's own CLEAN tier — a
                    post-gate veto or any witness hold-off withholds it; the record stays */
                 ticket: tmTicketClaim(c.row, c.plan),
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
  if (w.postgate) bits.push('the SWING post-gate rule refused the row — flow trap, BTC relative strength or stale momentum on the free feeds (hg-v1154); recorded, not shown');
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
    if (w2.postgate) tags.push('SWING post-gate rule refused the row (recorded, not shown; hg-v1154)');
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
  if (r.postGate) gates.push([tmPostGateLabel(r), r.postGate.state === 'pass']);
  if (typeof hgSetupCardHTML !== 'function'){
    return '<div class="card ' + dir + '"><b>' + escH(r.sym) + '</b>' + tmVenueChip(r) + ' · ' + dir.toUpperCase() + '</div>';
  }
  return hgSetupCardHTML({
    sym: r.sym, dir: dir, tier: tier,
    mini: mini, gates: gates,
    plan: plan ? (trendmxPlanHTML(plan) + tmSmcChip(r) + trendmxFlowChipHtml(r) + trendmxMomChipHtml(r) + trendmxVolChipHtml(r) + trendmxFundingChipHtml(r) + trendmxAtrRegimeChipHtml(r) + trendmxValueChipHtml(r) + trendmxFundChipHtml(r) + trendmxSlotChipHtml(r) + trendmxDayChipHtml(r) + trendmxCostChipHtml(r, plan) + trendmxChopChipHtml(r) + trendmxPillarHtml(r)) : '',
    entry: plan ? plan.entry : null, stop: plan ? plan.stop : null, t1: plan ? plan.t1 : null,
    chartId: (tier === 'clean' && plan) ? ('tmx_' + String(r.sym).replace(/[^A-Za-z0-9]/g, '')) : '',
    stack: stack,
    visionChip: r.visionChip, visionNextBar: r.visionNextBar, visionNextMove: r.visionNextMove, visionPrediction: r.visionPrediction,
    bookMeta: { scanner: 'trendmx', strategy: 'trendmx', t2: plan ? plan.t2 : null,
      venue: (typeof W.hgDeskVenueLabel === 'function') ? W.hgDeskVenueLabel(r.exchange) : 'BINANCE',
      visionChip: r.visionChip, visionNextBar: r.visionNextBar, visionNextMove: r.visionNextMove, visionPrediction: r.visionPrediction },
    note: tmPostGateVeto(r)
      ? (tmPostGateLabel(r) + ' — watch only, not a ticket. The SWING post-gate policy (flow trap · BTC RS · stale momentum) on the gates this desk borrows; levels kept, handoffs withheld, recorded for the ledger.')
      : (tier !== 'clean' ? (tier === 'near' ? '6/7 NEAR — watch only, not a ticket.' : 'FORMING — trend signal without CLEAN ticket.') : null)
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
    /* hg-v1160: the replay verdict (or the fact that there is none yet) rides under the measured book */
    if (typeof W.hgFwdPanelHTML === 'function'){
      refs.fwd.innerHTML = (W.hgFwdPanelHTML('TRENDMX') || '') + tmFactorSepHtml();
    } else {
      refs.fwd.innerHTML = '<div class="note">Forward ledger absent — crowns are recorded nowhere to be measured.</div>' + tmFactorSepHtml();
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
    var pfR = crown.perfectReads || {};   /* hg-v1144: the free-resource bag from the shared-perfect pass */
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
    if (isFinite(+pfR.dvolVal)) tech.push('DVOL ' + (+pfR.dvolVal).toFixed(1) + (pfR.dvolRegime ? ' ' + String(pfR.dvolRegime) : ''));
    if (pfR.pineLorKnn || pfR.pineHalfTrend || pfR.pineSqueeze || pfR.pineSmf || pfR.pineMsb || pfR.pineCipher || pfR.pineRangeFilter || pfR.pineNwEnvelope || pfR.pineWavwap){
      var pineBits = [];
      if (pfR.pineLorKnn) pineBits.push('LorKNN ' + pfR.pineLorKnn);
      if (pfR.pineHalfTrend) pineBits.push('half-trend ' + pfR.pineHalfTrend);
      if (pfR.pineSqueeze) pineBits.push('squeeze ' + pfR.pineSqueeze);
      if (pfR.pineSmf) pineBits.push('SMF ' + pfR.pineSmf);
      if (pfR.pineMsb) pineBits.push('MSB ' + pfR.pineMsb);
      if (pfR.pineSmc) pineBits.push('SMC ' + pfR.pineSmc);
      if (pfR.pineCipher) pineBits.push('cipher ' + pfR.pineCipher);
      if (pfR.pineRangeFilter) pineBits.push('range ' + pfR.pineRangeFilter);
      if (pfR.pineNwEnvelope) pineBits.push('NW ' + pfR.pineNwEnvelope);
      if (pfR.pineWavwap) pineBits.push('wAVWAP ' + pfR.pineWavwap);
      tech.push('PINE ' + pineBits.join(' | '));
    }
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
    if (isFinite(+pfR.venuePremiumPct)) mic.push('venue premium ' + (pfR.venuePremiumPct >= 0 ? '+' : '') + (+pfR.venuePremiumPct).toFixed(4) + '%');
    if (isFinite(+pfR.liqClusterUsd)) mic.push('liq cluster ' + (+pfR.liqClusterUsd).toFixed(0) + ' USD');
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

/* hg-v1187: THE CRYPTO PINE PORTS — five bar-only Pine strategies read off
   the row's own 4h tape, returned as a light mark bag. Record-only: the
   perfect predicate ignores them and the forward ledger decides whether
   any of them separates. Each unreadable signal is null (the honest
   third state).
   hg-v1205: four more crypto-shaped Pine ports join the bag — VuManChu
   Cipher B (Wave Trend oscillator, DIFFERENT from Lorentzian which is an
   ML kernel), Range Filter (regime flip on adaptive range band, DIFFERENT
   from Half-Trend which is a trailing stop), Nadaraya-Watson envelope
   (Gaussian smoother reversion, no analog in the five), Weekly AVWAP
   (location against the week's volume-weighted average, no analog in the
   five). All four already exist in pinemath.js and were read by nothing on
   this desk. Record-only like the five; nothing scores on them. */
function trendmxPineMarks(rows){
  var out = { lor: null, ht: null, sqz: null, smf: null, msb: null, cipher: null, rfilter: null, nwenv: null, wavwap: null, smc: null };
  try{
    if (!Array.isArray(rows) || rows.length < 30) return out;
    if (typeof W.pineLorentzianKernel === 'function'){ var l = W.pineLorentzianKernel(rows, {}); if (l && l.dir) out.lor = String(l.dir).toLowerCase(); }
    if (typeof W.pineHalfTrend === 'function'){ var h = W.pineHalfTrend(rows, {}); if (h && h.dir) out.ht = String(h.dir).toLowerCase(); }
    if (typeof W.pineSqueezeMomentum === 'function'){ var s = W.pineSqueezeMomentum(rows, {}); if (s && s.dir) out.sqz = String(s.dir).toLowerCase(); }
    if (typeof W.pineSmartMoneyFlow === 'function'){ var f = W.pineSmartMoneyFlow(rows, {}); if (f && f.dir) out.smf = String(f.dir).toLowerCase(); }
    if (typeof W.pineMsbOb === 'function'){ var m = W.pineMsbOb(rows, {}); if (m && m.dir) out.msb = String(m.dir).toLowerCase(); }
    if (typeof W.pineVumanchuCipher === 'function'){ var vc = W.pineVumanchuCipher(rows, {}); if (vc && vc.dir) out.cipher = String(vc.dir).toLowerCase(); }
    if (typeof W.pineRangeFilter === 'function'){ var rf = W.pineRangeFilter(rows, { includeContext: true }); if (rf && rf.dir) out.rfilter = String(rf.dir).toLowerCase(); }
    if (typeof W.pineNwEnvelope === 'function'){ var nw = W.pineNwEnvelope(rows, {}); if (nw && nw.dir) out.nwenv = String(nw.dir).toLowerCase(); }
    if (typeof W.pineWeeklyAvwap === 'function'){ var wv = W.pineWeeklyAvwap(rows, {}); if (wv && wv.dir) out.wavwap = String(wv.dir).toLowerCase(); }
    if (typeof W.pineSmcCore === 'function'){ var sc = W.pineSmcCore(rows, { includeContext: true }); if (sc && sc.dir) out.smc = String(sc.dir).toLowerCase(); }
  }catch(e){ }
  return out;
}

async function trendmxPerfectEvidencePass(rows){
  try{
    if (!Array.isArray(rows) || !rows.length) return rows;
    var capped = rows.slice().sort(function(a, b){ return Math.abs(+b.score || 0) - Math.abs(+a.score || 0); }).slice(0, 8);
    var taker = null, binFund = null;
    try{ if (typeof W.binanceTakerRatio === 'function') taker = await W.binanceTakerRatio('BTCUSDT', '4h', 120); }catch(eT){ }
    try{ if (typeof W.binanceFunding === 'function'){ var bf = await W.binanceFunding('BTCUSDT'); binFund = (bf && isFinite(+bf.fundingPct)) ? +bf.fundingPct : null; } }catch(eB){ }
    /* hg-v1144: the free resources - Deribit options vol (public) and the
       Coinglass free-tier clusters - read once per pass, attached per row. */
    var dvol = null;
    try{ if (typeof W.deribitVolState === 'function') dvol = W.deribitVolState(); }catch(eDv){ }
    var cg = null;
    try{ if (typeof W.coinglassClusters !== 'undefined' && W.coinglassClusters) cg = W.coinglassClusters; }catch(eCg){ }
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
      if (dvol && isFinite(+dvol.dvol)){ reads.dvolVal = +dvol.dvol; reads.dvolRegime = dvol.regime || null; }
      if (cg){
        try{
          var base = String(r.base || r.sym || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
          var cell = cg[base] || cg[base + 'USDT'] || cg[base + 'USD'];
          var usd = cell && (isFinite(+cell.usd) ? +cell.usd : (isFinite(+cell.total) ? +cell.total : (isFinite(+cell.liqUsd) ? +cell.liqUsd : NaN)));
          if (isFinite(usd)) reads.liqClusterUsd = usd;
        }catch(eLc){ }
      }
        reads.venueFundingPct = +r.fundingPct;
      /* hg-v1144: venue premium = venue funding minus the Binance twin */
      if (binFund != null) reads.venuePremiumPct = +reads.venueFundingPct - binFund;
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
      /* hg-v1150: THE FOUR REMAINING SHARED EVIDENCE LEGS — every one a FREE
         feed, so the matrix now feeds the SAME reads bag OMNIBTC feeds and a
         PERFECT / PERFECT+ badge means byte-identically the same thing on
         both desks:
           trendQuality  — the matrix's own chop witness (Choppiness Index +
                           Kaufman ER off the row's own 4h tape; zero requests)
           leverageState — coinalyze 24h aggregated OI % change + the last
                           three Binance funding prints (both free, cached)
           onchainVeto   — the BTC exchange-netflow z from the on-chain state
                           (BTC rows only: that feed speaks about BTC flow —
                           an alt row stays honestly UNREAD)
           cvdContext    — Binance spot taker flow vs the perp taker ratio
                           (both free, cached): BOTH-WITH / PERP-ONLY /
                           SPOT-ONLY / AGAINST
         Unreadable stays null: neither confirms nor denies (the honest
         third state). Evidence, never a gate. */
      try{
        var tqSt = trendmxChopState(r);
        if (tqSt && tqSt.state){
          reads.trendQuality = (tqSt.state === 'chop') ? 'CHOP' : 'TREND';
          if (isFinite(+tqSt.chop)) reads.chopVal = +tqSt.chop;
          if (isFinite(+tqSt.er)) reads.erVal = +tqSt.er;
        }
      }catch(eTq2){ }
      var bSym = (r && r.base) ? String(r.base).toUpperCase() + 'USDT' : null;
      if (bSym){
        var freePack = null;
        try{
          freePack = await Promise.allSettled([
            (typeof W.coinalyzeOIChg === 'function') ? W.coinalyzeOIChg(bSym, 24) : Promise.resolve(null),
            (typeof W.binanceFundingHist === 'function') ? W.binanceFundingHist(bSym, 30) : Promise.resolve(null),
            (typeof W.binanceSpotTakerFlow === 'function') ? W.binanceSpotTakerFlow(bSym, '4h', 100) : Promise.resolve(null),
            (typeof W.binanceTakerRatio === 'function') ? W.binanceTakerRatio(bSym, '4h', 100) : Promise.resolve(null)
          ]);
        }catch(eFp){ freePack = null; }
        /* the leverage cycle — OI % change (24h) plus the last three funding
           prints, the SAME house thresholds OMNIBTC uses: RESET (deleveraging)
           / EXTENDED (crowded) / FLAT. Either feed unreadable = no verdict. */
        try{
          var oiR = (freePack && freePack[0].status === 'fulfilled') ? freePack[0].value : null;
          var oiChg = (oiR && isFinite(+oiR.chgPct)) ? +oiR.chgPct : null;
          var fh = (freePack && freePack[1].status === 'fulfilled') ? freePack[1].value : null;
          var fund3 = [], fundLast = null;
          if (Array.isArray(fh)){
            var f3 = fh.slice(-3);
            for (var fi2 = 0; fi2 < f3.length; fi2++){
              if (f3[fi2] && isFinite(+f3[fi2].rate)) fund3.push((+f3[fi2].rate) * 100);  /* decimal -> percent, the house convention */
            }
            if (fund3.length) fundLast = fund3[fund3.length - 1];
          }
          if (oiChg != null) reads.oiChgPct = oiChg;
          if (fundLast != null) reads.fundLatestPct = fundLast;
          if (oiChg != null && fund3.length){
            if (oiChg <= -10 || (oiChg <= 0 && fund3.some(function(f){ return f <= 0; }))) reads.leverageState = 'RESET';
            else if (oiChg >= 15 && fundLast > 0.03) reads.leverageState = 'EXTENDED';
            else reads.leverageState = 'FLAT';
          }
        }catch(eLv2){ }
        /* the spot-vs-perp CVD context — both books' taker slopes over the
           free Binance feeds, read against the plan's direction */
        try{
          if (typeof W.hgObtcCvdSlopeDir === 'function'){
            var spotFlow = (freePack && freePack[2].status === 'fulfilled') ? freePack[2].value : null;
            var perpTaker = (freePack && freePack[3].status === 'fulfilled') ? freePack[3].value : null;
            var spotUp = W.hgObtcCvdSlopeDir(spotFlow && spotFlow.series);
            var perpUp = W.hgObtcCvdSlopeDir(perpTaker && perpTaker.series);
            if (spotUp != null && perpUp != null){
              var spotWith = (dir === 'long') ? spotUp : !spotUp;
              var perpWith = (dir === 'long') ? perpUp : !perpUp;
              reads.spotCvdUp = spotUp; reads.perpCvdUp = perpUp;
              reads.cvdContext = (spotWith && perpWith) ? 'BOTH-WITH'
                : (perpWith && !spotWith) ? 'PERP-ONLY'
                : (!perpWith && spotWith) ? 'SPOT-ONLY' : 'AGAINST';
            }
          }
        }catch(eCv2){ }
      }
      /* the on-chain netflow veto — BTC rows only: the state's exchange
         netflow z is BTC flow, and applying it to an alt row would be a
         guess, not a read. Fail open, exactly as the predicate expects. */
      try{
        if (r.base === 'BTC' && typeof W.onchainState === 'function' && typeof W.hgObtcNetflowZOf === 'function'){
          var ocSt = W.onchainState();
          var nz = W.hgObtcNetflowZOf(ocSt);
          if (isFinite(nz)){
            reads.netflowZ = nz;
            if (typeof hgNetflowGate === 'function'){
              var ng = hgNetflowGate('BTC', dir, { z: nz });
              if (ng && ng.state === 'veto') reads.onchainVeto = true;
              else reads.onchainVeto = false;
              if (ng && ng.note) reads.netflowNote = ng.note;
            }
          }
        }
      }catch(eNf2){ }
      /* hg-v1187: the crypto Pine ports ride the reads bag as record-only
         evidence, read off the row's own 4h tape. */
      try{
        var pm = trendmxPineMarks(r.rows4h);
        if (pm){
          reads.pineLorKnn = pm.lor;
          reads.pineHalfTrend = pm.ht;
          reads.pineSqueeze = pm.sqz;
          reads.pineSmf = pm.smf;
          reads.pineMsb = pm.msb;
          reads.pineSmc = pm.smc;
          /* hg-v1205: four more crypto Pine ports as record-only marks. */
          reads.pineCipher = pm.cipher;
          reads.pineRangeFilter = pm.rfilter;
          reads.pineNwEnvelope = pm.nwenv;
          reads.pineWavwap = pm.wavwap;
          r.pineMarks = pm;
        }
      }catch(ePine){ }
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
      crypto: el.querySelector('[data-r="crypto"]'),
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
        return { sym: r.sym, score: r.score, dir: tmDirOf(r), comps: r.comps || null,
                 /* hg-v1154: the shared post-gate verdict on this row, read by CONTRACT REPORT */
                 postGate: r.postGate ? r.postGate.state : undefined,
                 postGateReason: (r.postGate && r.postGate.state === 'veto') ? (r.postGate.reason || null) : undefined };
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
      '<div class="note">Five signed components (−1/0/+1) composite −5…+5 · 7-gate swing matrix · formation ticket cascade · fresh CoinDCX crosses on Telegram every 2 hours. A setup is not armed unless the 1h crypto scripts agree: SuperTrend, WaveTrend from an extreme, money flow, the kernel, QQE, Hull, volume flow, a fresh order block, trend magic, AlphaTrend, the range filter, the Lorentzian vote, HalfTrend, a Waddah explosion, accelerating squeeze momentum, Aroon, Elder Ray, a volume-weighted average above the simple average, DMI with ADX between 18 and 70, Bollinger %B on the trade side of the midline but still inside the band, Tenkan above Kijun with Chikou agreeing, price within 2 ATR of the session VWAP, the SSL channel, Stochastic RSI on the trade side of 50 and not rolling off the extreme, and the Fisher Transform still moving with the trade, Parabolic SAR on the trade side of price, the Schaff Trend Cycle on the trade side of 50, and Vortex with the plus line leading a long or the minus line leading a short, the Awesome Oscillator on the trade side of zero, Money Flow Index on the trade side of 50, and the Alligator feeding with the trade, CCI on the trade side of zero, Choppiness under 61.8, and Relative Vigor above its signal on the trade side of zero, TRIX above zero for a long, the Ultimate Oscillator on the trade side of 50, and On-Balance Volume moving with the trade, two Heikin Ashi candles with the trade, the Elder Force Index on the trade side of zero, and Know Sure Thing on the trade side of zero, MACD on the trade side of zero and not under its signal, price on the trade side of the Donchian midpoint, and Chande Momentum on the trade side of zero, price outside the Ichimoku cloud on the trade side, True Strength Index on the trade side of zero, and the Chaikin Oscillator on the trade side of zero, the Detrended Price Oscillator on the trade side of zero, Ease of Movement with the trade, and Relative Volatility on the trade side of 50, the Coppock Curve on the trade side of zero, Laguerre RSI on the trade side of one half, and the 20-bar regression slope with the trade, Williams %R on the trade side of -50, Balance of Power with the trade, and the Klinger volume oscillator on the trade side of zero, Stochastic Momentum Index on the trade side of zero, a triple EMA moving with the trade, and Elder Impulse not sloping against the trade. RSI divergence against the trade does not pass, Price Volume Trend has to be moving with the trade, and a lower-high lower-low structure does not pass a long. A wick back inside the 20-bar extreme does not pass, a lost session VWAP does not pass, and a close through the latest swing against the trade does not pass. A wick back inside the prior-day extreme does not pass, a candle that engulfs the prior body does not pass, and an inside-bar break that closes back inside the mother bar does not pass. On-balance volume divergence against the trade does not pass, a lost UTC day open does not pass, and a wick back through a round level does not pass. A fresh 9/21 cross against the trade does not pass, equal highs or equal lows swept and closed back inside do not pass, and a close that loses the 61.8 of the last swing does not pass. A climax bar against the trade does not pass, a lost weekly open does not pass, and MACD histogram divergence against the trade does not pass. An RSI cross of 50 against the trade does not pass, a lost fair value gap does not pass, and a wick back inside a Bollinger band does not pass. A lost session point of control does not pass, a wick back through a daily pivot does not pass, and a close through the order block does not pass. A wick back inside a Keltner band does not pass, an Asian-range sweep that closes back inside does not pass, and a wick back inside a VWAP band does not pass. A wick back through a Camarilla level does not pass, a lost Kijun does not pass, and a lost value area does not pass. A stochastic cross from the extreme does not pass, a lost 4-hour open does not pass, and a lost prior-day point of control does not pass. A wick back inside the regression channel does not pass, a CCI cross back through 100 does not pass, and a wick back through the 1.272 extension does not pass. Missing data does not pass.</div>' +
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
      '<div data-r="crypto"></div>' +
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
    crypto: el.querySelector('[data-r="crypto"]'),
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

  var state = { rows: [], crypto: [], golden: [], death: [], filter: 'ALL', venue: 'ALL', sortKey: 'score', sortDir: -1, running: false, view: 'table' };   /* hg-v1015: death bag initialized with golden; hg-v1045: view toggle */
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
        '<td><span class="gpip ' + gateCls + '">' + escH(gateTxt) + '</span>' + tmPostGateChip(r) + '</td>' +
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
      setStatus('Scanning in batches of 10...');
      var snap = await trendmxScan({
        force: true,
        setProg: setProg,
        onBatch: function(info){
          state.rows = info.rows;
          /* hg-v1150: THE PARTIAL BOARD IS THE PUBLISHED BOARD for as long as
             it is the one on screen. renderAll() paints the desks and the
             desks write the forward record (trendmxLimitClasses) — and the
             record's tmScore / tmAlign / tmAgeMin marks are read off the
             PUBLISHED snapshot (hgTrendMatrixMark). The full publish happens
             only at the end of trendmxScan, so every mid-scan batch painted
             its record against a stale-or-null snapshot: tmScore undefined on
             records whose row sat on the board with a perfectly readable
             composite. Publish the partial rows here so a mid-scan record
             always carries the composite of the exact row it was minted
             from — the same row the operator saw. */
          try { publishTrendmxSnap(info.rows); } catch (ePub) {}
          try {
            trendmxStampBtcStructure(state.rows);
            state.golden = trendmxGoldenCrossSetups(state.rows);
            state.death = trendmxDeathCrossSetups(state.rows);
          } catch (eB) {}
          renderAll();
          setProg(info.total ? info.done / info.total : 0);
          var more = info.done < info.total;
          setStatus('Batch ' + info.batch + ' of ' + info.batches + ' · ' + info.done + ' / ' + info.total + ' coins on the board'
            + (more ? ' · next 10 starting' : ' · checking setups'));
        }
      });
      var results = (snap && snap.rows) ? snap.rows : [];
      var failed = (snap && snap.failed) ? snap.failed : 0;
      var symsLen = (snap && snap.scanned) ? snap.scanned : results.length;
      var uniLen = (snap && snap.uniLen) ? snap.uniLen : symsLen;
      var vc = (snap && snap.venueCounts) ? snap.venueCounts : {};

      state.rows = results;
      state.crypto = (snap && snap.cryptoSetups) ? snap.cryptoSetups : [];
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
              /* hg-v1154 / hg-v1159: the ticket claim is the board's own CLEAN tier here too — a
                 7/7 row the board caps at NEAR under a witness is recorded and is NO ticket */
              ticket: tmTicketClaim(cr, cplan),
              reads: tmRecordReads(cr, cdir)
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
    state.crypto = __tmScanSnap.cryptoSetups || [];
    state.golden = __tmScanSnap.goldenCross || [];
    state.death = __tmScanSnap.deathCross || [];   /* hg-v1014 */
    tmTab.hasRun = true;
    renderAll();
    setStatus('restored from cache · ' + trendmxSummaryLine(state.rows, state.golden)
      + ' · age ' + Math.round((Date.now() - __tmScanSnap.at) / 1000) + 's');
  }
}

/* ---------------- exports + tab registration ---------------- */

W.trendmxSetupGrade = trendmxSetupGrade;
W.tmValueState = tmValueState;
W.tmBodyCommit = tmBodyCommit;
W.tmExampleSize = tmExampleSize;
W.tmSynergy = tmSynergy;
W.tmDisplacementFvg = tmDisplacementFvg;
W.tmParkinsonHot = tmParkinsonHot;
W.tmHurst = tmHurst;
W.tmTurtleReclaim = tmTurtleReclaim;
W.tmPocShift = tmPocShift;
W.tmFundingSpike = tmFundingSpike;
W.tmSettlementFreeze = tmSettlementFreeze;
W.tmLiquidityRoom = tmLiquidityRoom;
W.tmEffortTrap = tmEffortTrap;
W.tmStalled = tmStalled;
W.tmRunnerR = tmRunnerR;
W.tmAsiaChop = tmAsiaChop;
W.tmChandelier = tmChandelier;
W.tmWaveOk = tmWaveOk;
W.tmKernel = tmKernel;
W.tmSuperTrend = tmSuperTrend;
W.tmCmf = tmCmf;
W.tmSqueezeHigh = tmSqueezeHigh;
W.tmQqe = tmQqe;
W.tmHullRising = tmHullRising;
W.tmVfi = tmVfi;
W.tmWtDiverging = tmWtDiverging;
W.tmFreshOb = tmFreshOb;
W.tmUtBot = tmUtBot;
W.tmTrendMagic = tmTrendMagic;
W.tmAlpha = tmAlpha;
W.tmRangeFilter = tmRangeFilter;
W.tmLorentz = tmLorentz;
W.tmHalfTrend = tmHalfTrend;
W.tmWae = tmWae;
W.tmSqueezeMom = tmSqueezeMom;
W.tmDamiani = tmDamiani;
W.tmAroon = tmAroon;
W.tmElder = tmElder;
W.tmVwmaSide = tmVwmaSide;
W.tmDmi = tmDmi;
W.tmBbSide = tmBbSide;
W.tmIchiSignal = tmIchiSignal;
W.tmVwapStretch = tmVwapStretch;
W.tmSsl = tmSsl;
W.tmStochRsi = tmStochRsi;
W.tmFisher = tmFisher;
W.tmPsar = tmPsar;
W.tmSchaff = tmSchaff;
W.tmVortex = tmVortex;
W.tmAwesome = tmAwesome;
W.tmMfi = tmMfi;
W.tmAlligator = tmAlligator;
W.tmCci = tmCci;
W.tmChop = tmChop;
W.tmRvi = tmRvi;
W.tmTrix = tmTrix;
W.tmUltimate = tmUltimate;
W.tmObv = tmObv;
W.tmHeikin = tmHeikin;
W.tmForce = tmForce;
W.tmKst = tmKst;
W.tmMacd = tmMacd;
W.tmDonchian = tmDonchian;
W.tmCmo = tmCmo;
W.tmKumo = tmKumo;
W.tmTsi = tmTsi;
W.tmChaikin = tmChaikin;
W.tmDpo = tmDpo;
W.tmEase = tmEase;
W.tmRelVol = tmRelVol;
W.tmCoppock = tmCoppock;
W.tmLaguerre = tmLaguerre;
W.tmLinreg = tmLinreg;
W.tmWilliams = tmWilliams;
W.tmBop = tmBop;
W.tmKlinger = tmKlinger;
W.tmSmi = tmSmi;
W.tmTema = tmTema;
W.tmImpulse = tmImpulse;
W.tmRsiDiv = tmRsiDiv;
W.tmPvt = tmPvt;
W.tmStructure = tmStructure;
W.tmFailedBreak = tmFailedBreak;
W.tmVwapLost = tmVwapLost;
W.tmBos = tmBos;
W.tmPriorDay = tmPriorDay;
W.tmEngulf = tmEngulf;
W.tmInsideFail = tmInsideFail;
W.tmObvDiv = tmObvDiv;
W.tmDayOpen = tmDayOpen;
W.tmRound = tmRound;
W.tmEmaCross = tmEmaCross;
W.tmEqSweep = tmEqSweep;
W.tmFibLost = tmFibLost;
W.tmClimax = tmClimax;
W.tmWeekOpen = tmWeekOpen;
W.tmMacdDiv = tmMacdDiv;
W.tmRsiCross = tmRsiCross;
W.tmFvgLost = tmFvgLost;
W.tmBbReject = tmBbReject;
W.tmPocLost = tmPocLost;
W.tmPivot = tmPivot;
W.tmObLost = tmObLost;
W.tmKeltner = tmKeltner;
W.tmAsiaSweep = tmAsiaSweep;
W.tmVwapBand = tmVwapBand;
W.tmCamarilla = tmCamarilla;
W.tmKijunLost = tmKijunLost;
W.tmVahLost = tmVahLost;
W.tmStochCross = tmStochCross;
W.tmH4Open = tmH4Open;
W.tmNakedPoc = tmNakedPoc;
W.tmRegress = tmRegress;
W.tmCciExit = tmCciExit;
W.tmExt = tmExt;
W.tmCvdSlope = tmCvdSlope;
W.tm15Confirm = tm15Confirm;
W.trendScore = trendScore;
W.tmDirOf = tmDirOf;
W.trendmxGateEval = trendmxGateEval;
W.trendmxClassify = trendmxClassify;
W.hgTrendMatrixAlign = hgTrendMatrixAlign;   /* hg-v995 */
W.hgTrendMatrixRowOf = hgTrendMatrixRowOf;
W.hgTrendMatrixMark = hgTrendMatrixMark;
W.tmPostGateRead = tmPostGateRead;     /* hg-v1154 */
W.tmPostGateReads = tmPostGateReads;   /* hg-v1154 */
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
W.tmLegReads = tmLegReads;                 /* hg-v1159: the composite's legs as marks */
W.tmRecordReads = tmRecordReads;           /* hg-v1159: the one reads bag both record sites hand the ledger */
W.tmTicketClaim = tmTicketClaim;           /* hg-v1159: the ticket claim is the board's clean tier */
W.tmValidSetup = tmValidSetup;             /* hg-v1160: the replay harness asks the desk's own plan validity rule */
W.HG_TM_FACTOR_SEP = HG_TM_FACTOR_SEP;     /* hg-v1160: read by the panel, the drift guard and nothing else */
W.tmFactorSepHtml = tmFactorSepHtml;       /* hg-v1160: the replay panel, measured or not */
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
/* hg-v1150: THE SCAN ROWS, SYNC AND FULL. trendmxState() publishes the LIGHT
   mark snapshot ({sym, score, dir, comps} — the ledger reads it) and the
   cross state publishes the held tickets; but the desk's own last scan
   holds FULL rows (tape · gate · witnesses · freshCross), and consumers
   that re-run the builders on them — the AI workforce's rows fallback —
   had no sync seam to reach them. Same rows trendmxScan returned; null
   before the first scan. */
W.trendmxScanRows = function(){
  try{ return (__tmScanSnap && Array.isArray(__tmScanSnap.rows) && __tmScanSnap.rows.length) ? __tmScanSnap.rows : null; }catch(e){ return null; }
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'trendmx', label: 'TREND MATRIX', mount: mountTrendMatrix, refresh: refreshTrendMatrix });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'trendmx', label: 'TREND MATRIX', run: trendmxWarm });

})();
