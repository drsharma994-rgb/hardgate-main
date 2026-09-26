/* HARDGATE — CRYPTOVERSE
   =====================================================================
   A three-factor setup on Delta India + CoinDCX futures, built to the
   brief: market structure decides WHERE, a Lorentzian k-NN decides WHEN,
   and a momentum filter decides WHETHER AT ALL. Everything is evaluated on
   CLOSED bars, which is this file's equivalent of `barstate.isconfirmed`.

   WHAT THIS TAB REFUSES TO DO
   ---------------------------
   It claims no win rate. Not 99%, not 60%. A desk that has not settled a
   trade has measured nothing, so this tab reports the BREAKEVEN hit rate
   its own R:R implies -- 1/(1+R) -- and writes every setup into the shared
   forward log (hg-forward.js) so the question can be answered later out of
   sample. Until it is, the cards say RECORD ONLY.

   It does not send anything. The MT5/MT4 webhook payload is built and
   shown so it can be copied and inspected, and it is never POSTed. Crypto
   execution is disabled across this app and this tab does not reopen it.

   THE THREE GATES, in the order price meets them
   ----------------------------------------------
   1. WHERE   liquidity. Price must have swept a CONFIRMED prior swing
              high/low -- wick through it, close back inside -- or be
              trading inside an untested higher-timeframe fair value gap.
              A sweep is only counted once the bars that confirm the swing
              have themselves closed, so the level cannot be redrawn later.

   2. WHEN    a Lorentzian k-NN fires in the same direction, AFTER the
              sweep bar and within CV_TRIG_MAX bars of it. A trigger in the
              middle of a range is ignored by construction: without gate 1
              there is nothing for it to trigger on.

   3. CONFIRM the macro filter agrees. VuManChu Cipher B (WaveTrend) and
              the Range Filter both vote; the gate is binary permission,
              never a reason to enter on its own.

   WHY THIS FILE HAS ITS OWN CLASSIFIER
   ------------------------------------
   pinemath.js already exports pineLorentzianKernel, and seven tabs use it.
   Its neighbour label reads `rows[idx - 4].c > rows[idx].c` -- the move
   ENDING at the neighbour, not the one that FOLLOWED it. A k-NN is only
   predictive if the neighbours are labelled with what happened next.
   Measured over 925 scored bars of a random walk:

     corr(pineLorentzianKernel mlScore, PAST 4-bar return)    -0.658
     corr(pineLorentzianKernel mlScore, FUTURE 4-bar return)  -0.057

   It describes the move that already happened. cvLorentz below labels each
   neighbour with `rows[idx + H].c` versus `rows[idx].c`, and the
   `i >= H` floor on the neighbour walk is what keeps that label in the
   PAST relative to the bar being scored -- the forward label is taken from
   history, never from the future of the bar we are standing on. That
   distinction is the whole anti-lookahead argument, so it is asserted in
   tests/test-cryptoverse.mjs rather than left as a comment.

   pineLorentzianKernel is NOT changed here: it is shared, and re-labelling
   it would silently move seven other desks.
   ===================================================================== */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var TAB_ID = 'cryptoverse';

/* bars fetched. The k-NN needs CV_LOOKBACK of history BEFORE the bar it
   scores, plus the feature warmup, plus the forward-label horizon. */
var KL_15M = 420, KL_1H = 220;
var CV_MIN_15M = 330;          /* lookback + warmup + label horizon + slack */
var CV_MIN_1H  = 60;

/* the classifier */
var CV_LOOKBACK = 250;         /* neighbours drawn from this many bars back */
var CV_K = 8;                  /* neighbours voting */
var CV_LABEL_H = 4;            /* bars ahead a neighbour's label looks */
var CV_SCORE_LIMIT = 2;        /* |smoothed score| that counts as a fire */
var CV_KERNEL_LOOK = 8;
var CV_KERNEL_BW = 3;

/* structure */
var CV_PIVOT = 5;              /* swing needs this many bars each side */
var CV_TRIG_MAX = 8;           /* trigger must land within N bars of the sweep */

/* the plan */
var CV_MIN_RR = 2.0;           /* strict R:R -- the brief's own standard */
var CV_STOP_PAD_ATR = 0.25;    /* stop sits beyond the sweep extreme by this */
var CV_COST_MULT = 8;          /* stop never tighter than N x round-trip cost */
var CV_HORIZON = 24;           /* bars a record stays open (6h at 15m) */
var CV_LABEL_V = 1;            /* bump when the label pipeline changes */

var VENUE_COSTS = {
  delta:   { venue: 'Delta',   rtFrac: 0.001  },
  coindcx: { venue: 'CoinDCX', rtFrac: 0.002  },
  cdcx:    { venue: 'CoinDCX', rtFrac: 0.002  },
  binance: { venue: 'Binance', rtFrac: 0.002  }
};
function costFor(item){
  var ex = item && item.exchange ? String(item.exchange).toLowerCase() : 'binance';
  return VENUE_COSTS[ex] || VENUE_COSTS.binance;
}
function venueName(ex){
  var k = String(ex || '').toLowerCase();
  if (k === 'delta') return 'Delta';
  if (k === 'coindcx' || k === 'cdcx') return 'CoinDCX';
  if (k === 'binance') return 'Binance';
  return k ? (k.charAt(0).toUpperCase() + k.slice(1)) : 'unknown';
}

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(n, d){ if (n == null || !isFinite(+n)) return '—'; d = d != null ? d : (Math.abs(+n) >= 100 ? 2 : Math.abs(+n) >= 1 ? 4 : 6); return (+n).toFixed(d); }

/* ---------------------------------------------------------------- bars */

/* THE `barstate.isconfirmed` EQUIVALENT.

   A bar is closed when its OPEN time is at least one interval behind now.
   Everything downstream reads rows[n-1] as "the latest bar", so trimming
   here is what stops the whole tab reading a forming candle. Absent or
   unreadable stamps are dropped rather than guessed: `+null` is 0 and
   isFinite(0) is true, so coercing before the finite test would admit a
   missing stamp as the epoch. */
function cvClosedRows(rows, ivSec, nowMs){
  if (!Array.isArray(rows) || !rows.length) return [];
  var cutoff = (nowMs / 1000) - ivSec, out = [], i, t;
  for (i = 0; i < rows.length; i++){
    t = (rows[i] && rows[i].t !== null && rows[i].t !== undefined && rows[i].t !== '')
      ? +rows[i].t : NaN;
    if (isFinite(t) && t <= cutoff) out.push(rows[i]);
  }
  /* a feed whose stamps we cannot judge still loses its last bar rather
     than being trusted whole */
  return out.length < rows.length ? out : rows.slice(0, -1);
}

function cvAtr(rows, len){
  var n = rows.length, tr = [], i, out = NaN;
  if (n < len + 1) return NaN;
  for (i = 1; i < n; i++){
    var h = +rows[i].h, l = +rows[i].l, pc = +rows[i - 1].c;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (tr.length < len) return NaN;
  var sum = 0;
  for (i = tr.length - len; i < tr.length; i++) sum += tr[i];
  out = sum / len;
  return isFinite(out) && out > 0 ? out : NaN;
}

/* ---------------------------------------------------- GATE 1: WHERE */

/* CONFIRMED swings only. A pivot at index p is confirmed at p + right, once
   the bars that prove it are themselves closed -- which is exactly why the
   level cannot be redrawn under a signal that already fired. */
function cvSwings(rows, left, right){
  var out = { highs: [], lows: [] };
  if (!Array.isArray(rows)) return out;
  var n = rows.length, p, i, isH, isL;
  for (p = left; p + right < n; p++){
    isH = true; isL = true;
    for (i = p - left; i <= p + right; i++){
      if (i === p) continue;
      if (+rows[i].h >= +rows[p].h) isH = false;
      if (+rows[i].l <= +rows[p].l) isL = false;
    }
    if (isH) out.highs.push({ i: p, level: +rows[p].h, confirmedAt: p + right });
    if (isL) out.lows.push({ i: p, level: +rows[p].l, confirmedAt: p + right });
  }
  return out;
}

/* THE SWEEP. Price wicks through a swing level that was ALREADY CONFIRMED
   before that bar, and closes back on the original side. A close beyond the
   level is a break, not a sweep, and is deliberately not one of these. */
function cvSweep(rows, swings, maxAgo){
  if (!Array.isArray(rows) || !rows.length) return null;
  var n = rows.length, best = null, b, s;
  var from = Math.max(1, n - (maxAgo || CV_TRIG_MAX) - 1);
  for (b = from; b < n; b++){
    for (s = 0; s < swings.highs.length; s++){
      var hi = swings.highs[s];
      if (hi.confirmedAt >= b) continue;          /* not yet a level at bar b */
      if (+rows[b].h > hi.level && +rows[b].c < hi.level){
        best = { bar: b, dir: 'short', level: hi.level, extreme: +rows[b].h,
                 side: 'high', barsAgo: n - 1 - b };
      }
    }
    for (s = 0; s < swings.lows.length; s++){
      var lo = swings.lows[s];
      if (lo.confirmedAt >= b) continue;
      if (+rows[b].l < lo.level && +rows[b].c > lo.level){
        best = { bar: b, dir: 'long', level: lo.level, extreme: +rows[b].l,
                 side: 'low', barsAgo: n - 1 - b };
      }
    }
  }
  return best;
}

/* Untested fair value gaps on the HIGHER timeframe: a 3-bar imbalance whose
   body nothing has traded back into since. `untested` is what the brief
   asks for -- a gap price has already filled is not liquidity any more. */
function cvFvgs(rows){
  var out = [];
  if (!Array.isArray(rows) || rows.length < 3) return out;
  var n = rows.length, i, j;
  for (i = 2; i < n; i++){
    var bull = +rows[i].l > +rows[i - 2].h;
    var bear = +rows[i].h < +rows[i - 2].l;
    if (!bull && !bear) continue;
    var top = bull ? +rows[i].l : +rows[i - 2].l;
    var bot = bull ? +rows[i - 2].h : +rows[i].h;
    var tested = false;
    for (j = i + 1; j < n; j++){
      if (+rows[j].l <= top && +rows[j].h >= bot){ tested = true; break; }
    }
    out.push({ i: i, dir: bull ? 'long' : 'short', top: Math.max(top, bot),
               bot: Math.min(top, bot), tested: tested });
  }
  return out;
}

/** is the latest close sitting inside an untested gap pointing `dir`? */
function cvInFvg(fvgs, price, dir){
  if (!Array.isArray(fvgs) || !isFinite(price)) return null;
  for (var i = fvgs.length - 1; i >= 0; i--){
    var f = fvgs[i];
    if (f.tested || f.dir !== dir) continue;
    if (price <= f.top && price >= f.bot) return f;
  }
  return null;
}

/* ----------------------------------------------------- GATE 2: WHEN */

function cvRsi(vals, p){
  var out = new Array(vals.length).fill(NaN), g = 0, l = 0, i;
  if (vals.length <= p) return out;
  for (i = 1; i <= p; i++){
    var d = vals[i] - vals[i - 1];
    if (d >= 0) g += d; else l -= d;
  }
  g /= p; l /= p;
  out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (i = p + 1; i < vals.length; i++){
    var d2 = vals[i] - vals[i - 1];
    g = (g * (p - 1) + (d2 > 0 ? d2 : 0)) / p;
    l = (l * (p - 1) + (d2 < 0 ? -d2 : 0)) / p;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}

function cvCci(rows, p){
  var out = new Array(rows.length).fill(NaN), i, j;
  for (i = p - 1; i < rows.length; i++){
    var sum = 0;
    for (j = i - p + 1; j <= i; j++) sum += (+rows[j].h + +rows[j].l + +rows[j].c) / 3;
    var ma = sum / p, dev = 0;
    for (j = i - p + 1; j <= i; j++) dev += Math.abs((+rows[j].h + +rows[j].l + +rows[j].c) / 3 - ma);
    dev /= p;
    out[i] = dev === 0 ? 0 : ((+rows[i].h + +rows[i].l + +rows[i].c) / 3 - ma) / (0.015 * dev);
  }
  return out;
}

function cvAdx(rows, p){
  var n = rows.length, out = new Array(n).fill(NaN);
  if (n < p * 2 + 2) return out;
  var tr = [], pdm = [], ndm = [], i;
  for (i = 1; i < n; i++){
    var up = +rows[i].h - +rows[i - 1].h, dn = +rows[i - 1].l - +rows[i].l;
    pdm.push(up > dn && up > 0 ? up : 0);
    ndm.push(dn > up && dn > 0 ? dn : 0);
    tr.push(Math.max(+rows[i].h - +rows[i].l,
                     Math.abs(+rows[i].h - +rows[i - 1].c),
                     Math.abs(+rows[i].l - +rows[i - 1].c)));
  }
  var str = 0, sp = 0, sn = 0, dx = [];
  for (i = 0; i < tr.length; i++){
    if (i < p){ str += tr[i]; sp += pdm[i]; sn += ndm[i]; if (i < p - 1) continue; }
    else { str = str - str / p + tr[i]; sp = sp - sp / p + pdm[i]; sn = sn - sn / p + ndm[i]; }
    var pdi = str ? 100 * sp / str : 0, ndi = str ? 100 * sn / str : 0;
    var sumD = pdi + ndi;
    dx.push(sumD ? 100 * Math.abs(pdi - ndi) / sumD : 0);
    if (dx.length >= p){
      var s = 0;
      for (var q = dx.length - p; q < dx.length; q++) s += dx[q];
      out[i + 1] = s / p;
    }
  }
  return out;
}

/* THE NEIGHBOUR SCORE, with a FORWARD label.

   For the bar `bi` being scored we walk back through history. A neighbour at
   `idx = bi - i` is labelled with what price did over the NEXT CV_LABEL_H
   bars -- `rows[idx + H].c` against `rows[idx].c`. The `i >= H` floor makes
   `idx + H <= bi`, so that label was already knowable at `bi`. Nothing here
   reads a bar later than `bi`, and `bi` is the last CLOSED bar.

   This is the single line that separates a classifier from a look-ahead
   backtest, so it is stated here and pinned in the tests. */
function cvMlScoreAtBar(rows, f1, f2, f3, bi, k, lookback, labelH){
  var distances = [], directions = [], i;
  for (i = labelH; i <= lookback; i++){
    var idx = bi - i;
    if (idx < 0) continue;
    if (idx + labelH > bi) continue;              /* never label with the future */
    if (!isFinite(f1[bi]) || !isFinite(f1[idx])) continue;
    if (!isFinite(f2[bi]) || !isFinite(f2[idx])) continue;
    if (!isFinite(f3[bi]) || !isFinite(f3[idx])) continue;
    var dist = Math.log(1 + Math.abs(f1[bi] - f1[idx]))
             + Math.log(1 + Math.abs(f2[bi] - f2[idx]))
             + Math.log(1 + Math.abs(f3[bi] - f3[idx]));
    var after = +rows[idx + labelH].c, at = +rows[idx].c;
    if (!isFinite(after) || !isFinite(at)) continue;
    distances.push(dist);
    directions.push(after > at ? 1 : after < at ? -1 : 0);
  }
  if (distances.length < k) return 0;
  var order = distances.map(function(d, ix){ return { d: d, ix: ix }; });
  order.sort(function(a, b){ return a.d - b.d; });
  var bull = 0, bear = 0;
  for (var j = 0; j < k && j < order.length; j++){
    var vote = directions[order[j].ix];
    if (vote === 1) bull++; else if (vote === -1) bear++;
  }
  return bull - bear;
}

function cvGaussian(scores, bandwidth){
  var n = scores.length;
  if (!n) return 0;
  var wSum = 0, wScore = 0, i;
  for (i = 0; i < n; i++){
    var w = Math.exp(-(i * i) / (2 * bandwidth * bandwidth));
    var sc = scores[n - 1 - i];
    if (!isFinite(sc)) sc = 0;
    wScore += sc * w; wSum += w;
  }
  return wSum > 0 ? wScore / wSum : 0;
}

function cvLorentz(rows, opts){
  opts = opts || {};
  var k = opts.kNeighbors || CV_K;
  var lookback = opts.lookback || CV_LOOKBACK;
  var labelH = opts.labelH || CV_LABEL_H;
  var limit = opts.scoreLimit || CV_SCORE_LIMIT;
  var kl = opts.kernelLookback || CV_KERNEL_LOOK;
  var bw = opts.kernelBandwidth || CV_KERNEL_BW;
  if (!Array.isArray(rows) || rows.length < lookback + kl + labelH + 20) return null;
  var closes = rows.map(function(r){ return +r.c; });
  var f1 = cvRsi(closes, 14);
  var f2 = cvCci(rows, 20);
  var f3 = cvAdx(rows, 14);
  var bi = rows.length - 1;
  function seriesAt(end){
    var hist = [], b;
    for (b = Math.max(lookback, end - kl + 1); b <= end; b++)
      hist.push(cvMlScoreAtBar(rows, f1, f2, f3, b, k, lookback, labelH));
    return cvGaussian(hist, bw);
  }
  var smoothed = seriesAt(bi);
  var prev = (bi - 1 >= lookback) ? seriesAt(bi - 1) : null;
  var newLong = smoothed >= limit && !(prev !== null && prev >= limit);
  var newShort = smoothed <= -limit && !(prev !== null && prev <= -limit);
  return {
    raw: cvMlScoreAtBar(rows, f1, f2, f3, bi, k, lookback, labelH),
    smoothed: smoothed, prev: prev,
    dir: smoothed >= limit ? 'long' : smoothed <= -limit ? 'short' : null,
    newLong: newLong, newShort: newShort,
    scoreLimit: limit, labelH: labelH, k: k, lookback: lookback
  };
}

/* -------------------------------------------------- GATE 3: CONFIRM */

/* Binary permission, never an entry reason of its own. Both filters are the
   repo's existing Pine ports, fed the same closed tape. Either one absent
   is UNCHECKED -- it cannot grant permission it never computed, and it does
   not withhold it either; the gate needs one real agreeing vote. */
function cvMomentum(rows, dir){
  var out = { cipher: null, rf: null, agree: 0, oppose: 0, checked: 0, ok: false, why: [] };
  if (!dir) return out;
  try{
    if (typeof W.pineVumanchuCipher === 'function'){
      var c = W.pineVumanchuCipher(rows, { includeContext: true });
      if (c && c.dir){
        out.cipher = c; out.checked++;
        if (c.dir === dir){ out.agree++; out.why.push('Cipher B ' + c.dir.toUpperCase()); }
        else { out.oppose++; out.why.push('Cipher B opposes (' + c.dir + ')'); }
      } else out.why.push('Cipher B UNCHECKED — no reading on this tape');
    } else out.why.push('Cipher B UNCHECKED — pinemath.js not loaded');
  }catch(e){ out.why.push('Cipher B UNCHECKED — threw'); }
  try{
    if (typeof W.pineRangeFilter === 'function'){
      var r = W.pineRangeFilter(rows, { includeContext: true });
      if (r && r.dir){
        out.rf = r; out.checked++;
        if (r.dir === dir){ out.agree++; out.why.push('Range Filter ' + r.dir.toUpperCase()); }
        else { out.oppose++; out.why.push('Range Filter opposes (' + r.dir + ')'); }
      } else out.why.push('Range Filter UNCHECKED — no reading on this tape');
    } else out.why.push('Range Filter UNCHECKED — pinemath.js not loaded');
  }catch(e2){ out.why.push('Range Filter UNCHECKED — threw'); }
  out.ok = out.agree > 0 && out.oppose === 0;
  return out;
}

/* ------------------------------------------------------- the verdict */

/** breakeven hit rate implied by an R:R — the only rate this tab states */
function cvBreakeven(rr){
  return (isFinite(rr) && rr > 0) ? 1 / (1 + rr) : NaN;
}

/* Every gate's verdict on every contract, whether or not it fires. A tab
   that only reports what passed cannot tell you why the screen is empty. */
function cvEvaluate(inp){
  inp = inp || {};
  var rows15 = inp.rows15 || [], rows1h = inp.rows1h || [];
  var out = { ok: false, dir: null, gates: [], ledger: [], setup: null,
              bar: null, price: NaN, atr: NaN };
  if (rows15.length < CV_MIN_15M){
    out.gates.push('need ' + CV_MIN_15M + ' closed 15m bars, have ' + rows15.length);
    return out;
  }
  var n = rows15.length;
  var bar = rows15[n - 1];
  out.bar = { t: +bar.t, c: +bar.c };
  out.price = +bar.c;
  var atr = cvAtr(rows15, 14);
  out.atr = atr;
  if (!isFinite(atr)){ out.gates.push('ATR unreadable'); return out; }

  /* ---- GATE 1 ---- */
  var swings = cvSwings(rows15, CV_PIVOT, CV_PIVOT);
  var sweep = cvSweep(rows15, swings, CV_TRIG_MAX);
  var fvgs = (rows1h.length >= CV_MIN_1H) ? cvFvgs(rows1h) : null;
  var g1 = null;
  if (sweep){
    g1 = { kind: 'SWEEP', dir: sweep.dir, bar: sweep.bar, barsAgo: sweep.barsAgo,
           level: sweep.level, extreme: sweep.extreme };
  }
  out.ledger.push({ gate: 'WHERE', pass: !!g1,
    why: g1
      ? ('swept the ' + sweep.side + ' at ' + fmt(sweep.level) + ', ' + sweep.barsAgo + ' bar(s) ago')
      : ('no confirmed swing swept in the last ' + CV_TRIG_MAX + ' bars') });
  if (!g1){ out.gates.push('WHERE: no liquidity taken'); return out; }
  var dir = g1.dir;

  /* the higher-timeframe gap is a REASON, recorded whether or not it is
     there — it strengthens the location, it is not required for it */
  var fvg = fvgs ? cvInFvg(fvgs, out.price, dir) : null;
  out.ledger.push({ gate: 'WHERE·HTF', pass: !!fvg, optional: true,
    why: !fvgs ? 'no 1h tape — untested-FVG check UNCHECKED'
       : fvg ? ('inside an untested 1h FVG ' + fmt(fvg.bot) + '–' + fmt(fvg.top))
       : 'not inside an untested 1h FVG' });

  /* ---- GATE 2 ---- */
  var ml = cvLorentz(rows15);
  var trigOk = !!(ml && ml.dir === dir);
  /* the trigger must come AFTER the sweep. The sweep bar is `sweep.bar` and
     the classifier reads the last closed bar, so this is the ordering the
     brief asks for: no signal in the middle of a range counts. */
  var afterSweep = sweep.bar < (n - 1);
  var withinWindow = sweep.barsAgo <= CV_TRIG_MAX;
  out.ledger.push({ gate: 'WHEN', pass: trigOk && afterSweep && withinWindow,
    why: !ml ? 'classifier UNCHECKED — not enough closed history'
       : !trigOk ? ('Lorentzian score ' + fmt(ml.smoothed, 2) + ' does not clear ±'
                    + ml.scoreLimit + ' toward ' + dir)
       : !afterSweep ? 'the trigger bar IS the sweep bar — a signal must follow the sweep'
       : !withinWindow ? ('sweep was ' + sweep.barsAgo + ' bars ago, past the '
                          + CV_TRIG_MAX + '-bar window')
       : ('Lorentzian ' + fmt(ml.smoothed, 2) + ' toward ' + dir + ', '
          + sweep.barsAgo + ' bar(s) after the sweep') });
  if (!(trigOk && afterSweep && withinWindow)){
    out.gates.push('WHEN: no classifier trigger after the sweep');
    out.ml = ml; return out;
  }
  out.ml = ml;

  /* ---- GATE 3 ---- */
  var mom = cvMomentum(rows15, dir);
  out.momentum = mom;
  out.ledger.push({ gate: 'CONFIRM', pass: mom.ok, why: mom.why.join(' · ') });
  /* the three decisions the gates turned on, on the result itself, so a
     reader (and a test) can check the verdict against its own inputs */
  out.sweepDir = dir; out.mlDir = ml.dir; out.momOk = mom.ok;
  out.momAgree = mom.agree; out.momOppose = mom.oppose;
  if (!mom.ok){ out.gates.push('CONFIRM: momentum filter withheld permission'); return out; }

  /* ---- the plan ---- */
  var vc = inp.venueCost, costFrac = vc ? vc.rtFrac : NaN;
  var entry = out.price;
  /* The stop sits BEYOND the extreme the sweep reached, never inside the wick
     that just traded there. A stop parked where price has already been in the
     last few bars is the one noise takes out first, and the whole reason to
     enter after a sweep is that the liquidity below it is gone. */
  var pad = CV_STOP_PAD_ATR * atr;
  var stop = dir === 'long' ? (sweep.extreme - pad) : (sweep.extreme + pad);
  var risk = Math.abs(entry - stop);
  var costFloor = isFinite(costFrac) ? entry * costFrac * CV_COST_MULT : 0;
  var floorNote = '';
  if (risk < costFloor){
    risk = costFloor;
    stop = dir === 'long' ? entry - risk : entry + risk;
    floorNote = 'stop widened to ' + CV_COST_MULT + '× the '
      + ((vc && vc.venue) || 'venue') + ' round-trip';
  }
  if (!(risk > 0)){ out.gates.push('PLAN: zero risk'); return out; }
  /* A STOP ON THE WRONG SIDE IS A BUG, NOT SOMETHING TO REPAIR.

     The cost floor above rewrites `stop` from `entry ± risk`, which lands it
     on the correct side whatever it was before -- so a stop derived from the
     wrong extreme would be silently corrected on every contract whose raw
     risk was under the floor, and nothing would ever say so. A long stops
     BELOW its entry and a short stops ABOVE it; anything else means the sweep
     extreme and the direction disagree, and the setup is dropped rather than
     quietly fixed. */
  var sideOk = dir === 'long' ? (stop < entry) : (stop > entry);
  if (!sideOk){
    out.gates.push('PLAN: stop on the wrong side of entry for a ' + dir
      + ' (entry ' + fmt(entry) + ', stop ' + fmt(stop) + ')');
    return out;
  }
  var d = dir === 'long' ? 1 : -1;
  var t1 = entry + d * risk * CV_MIN_RR;
  var t2 = entry + d * risk * (CV_MIN_RR + 1);
  out.ok = true; out.dir = dir;
  out.setup = {
    dir: dir, kind: fvg ? 'SWEEP+FVG' : 'SWEEP',
    entry: entry, stop: stop, t1: t1, t2: t2, risk: risk,
    rr1: CV_MIN_RR, rr2: CV_MIN_RR + 1,
    breakeven: cvBreakeven(CV_MIN_RR),
    stopAtr: risk / atr, floorNote: floorNote,
    sweepLevel: sweep.level, sweepExtreme: sweep.extreme, sweepBarsAgo: sweep.barsAgo,
    fvg: fvg ? { top: fvg.top, bot: fvg.bot } : null,
    mlScore: ml.smoothed, horizonBars: CV_HORIZON,
    orderType: dir === 'long' ? 'BUY' : 'SELL'
  };
  return out;
}

/* ----------------------------------------------- the webhook payload */

/* BUILT, SHOWN, NEVER SENT.

   The brief routes this to an MT4/MT5 gateway. Crypto execution is disabled
   across this app and this tab does not reopen it, so the payload is
   rendered for inspection and copying and there is no POST anywhere in this
   file. `barClose` is the closed bar the whole decision was taken on -- a
   gateway that receives this can reject a duplicate for the same bar, which
   is the receiving half of the no-repaint contract. */
function cvWebhook(item, res){
  if (!item || !res || !res.ok || !res.setup) return null;
  var s = res.setup;
  return {
    source: 'HARDGATE/CRYPTOVERSE',
    mode: 'RECORD_ONLY',
    symbol: String(item.sym || ''),
    venue: venueName(item.exchange),
    action: s.orderType,
    entry: +fmt(s.entry, 8), sl: +fmt(s.stop, 8),
    tp1: +fmt(s.t1, 8), tp2: +fmt(s.t2, 8),
    rr: s.rr1,
    barClose: res.bar ? res.bar.t : null,
    timeframe: '15m',
    expiresAfterBars: s.horizonBars,
    setup: s.kind,
    note: 'record only — not sent, not a ticket'
  };
}

/* -------------------------------------------- the crypto macro read */

/* hg-v984: THIS DESK NEVER ASKED THE CRYPTO MACRO FILTER, AND SAYS SO.

   hgMacroAllowsCrypto -- an alt long is blocked while BTC.D > 55% or the
   dollar is rising -- is applied on SWING, SCALP, EDGE, BEST, SETUP CONFIRM
   and SUPER SETUP. This desk reads price alone and never asked it. It is not
   wired as a gate here: the filter has been measured on no desk at all, and
   a new veto with no measurement of what it removes is the hg-v966 trap. So
   the verdict is READ, printed on the card, and handed to the forward record
   (the same read, so card and record agree by construction), and the shared
   forward panel splits this desk's settled record on it. When the split says
   the filter would have paid here, a later pack can wire it on evidence.
   Fails open to "not read": absent rule, unread snapshot, no verdict. */
function cvMacroMark(sym, dir){
  try{
    if (typeof W.hgMacroAltMark !== 'function') return null;
    var m = W.hgMacroAltMark(sym, dir);
    if (!m || !(m.block === true || m.block === false)) return null;
    return { block: m.block, why: m.why || null };
  }catch(e){ return null; }
}

function cvMacroChipHTML(row){
  var m = row && row.macro;
  if (!m || m.block !== true) return '';
  return '<span class="cv-chip" style="background:#FEF3C7;color:#92400E" title="'
    + esc(m.why || '') + '">MACRO FILTER WOULD BLOCK</span>';
}

function cvMacroNoteHTML(row){
  var m = row && row.macro;
  if (!m || m.block !== true) return '';
  return '<div class="cv-note"><b>THE SHARED CRYPTO MACRO FILTER WOULD HAVE BLOCKED THIS.</b> '
    + esc(m.why || 'BTC dominance or the dollar reads risk-off for alt longs') + '. '
    + 'SWING, SCALP, EDGE and BEST refuse an alt long on that read; this desk has never asked it, '
    + 'and does not gate on it here because the filter is measured on no desk. '
    + 'The verdict rides on this setup\'s forward record, so the FORWARD panel below can say '
    + 'whether the setups it would have removed paid. Reported, not gated.</div>';
}

/* ------------------------------------------------------ forward log */

/* Same instrument CRYPTO SCAN uses, so this tab's claim can be settled out
   of sample instead of asserted. mechanic carries the label version, since
   hg-forward pools on that string. */
function cvFwdRows(setups){
  if (!Array.isArray(setups)) return [];
  function lvl(v){ return (v === null || v === undefined || v === '') ? NaN : +v; }
  var out = [], i;
  for (i = 0; i < setups.length; i++){
    var s = setups[i], p = s && s.setup;
    if (!s || !s.sym || !p) continue;
    var en = lvl(p.entry), st = lvl(p.stop), tp = lvl(p.t1);
    if (!isFinite(en) || !isFinite(st) || !isFinite(tp) || en === st) continue;
    out.push({
      sym: String(s.sym), dir: p.dir, entry: en, stop: st, t1: tp,
      mark: isFinite(+s.price) && +s.price > 0 ? +s.price : undefined,
      barT: (s.bar && isFinite(+s.bar.t) && +s.bar.t > 0) ? +s.bar.t : undefined,
      mechanic: ('CVERSE-' + String(p.kind || 'SWEEP') + '@v' + CV_LABEL_V).toUpperCase().slice(0, 28),
      /* every card this tab shows cleared all three gates, so they are one
         population; there is no weaker tier to split against yet */
      ticket: true,
      /* hg-v984: the macro read the card shows, or NOT RECORDED */
      macroBlock: (s.macro && (s.macro.block === true || s.macro.block === false)) ? s.macro.block : undefined
    });
  }
  return out;
}

W.__cvClosedRows = cvClosedRows;
W.__cvSwings = cvSwings;
W.__cvSweep = cvSweep;
W.__cvFvgs = cvFvgs;
W.__cvInFvg = cvInFvg;
W.__cvLorentz = cvLorentz;
W.__cvMlScoreAtBar = cvMlScoreAtBar;
W.__cvMomentum = cvMomentum;
W.__cvBreakeven = cvBreakeven;
W.__cvEvaluate = cvEvaluate;
W.__cvWebhook = cvWebhook;
W.__cvFwdRows = cvFwdRows;
W.__cvMacroMark = cvMacroMark;   /* hg-v984 */
W.__cvAtr = cvAtr;
W.HG_CRYPTOVERSE_RULE = {
  lookback: CV_LOOKBACK, k: CV_K, labelH: CV_LABEL_H, scoreLimit: CV_SCORE_LIMIT,
  pivot: CV_PIVOT, trigMax: CV_TRIG_MAX, minRr: CV_MIN_RR, horizon: CV_HORIZON,
  minBars15m: CV_MIN_15M, labelVersion: CV_LABEL_V
};

/* =====================================================================
   UI
   ===================================================================== */

var CV_CSS = ''
  + '.cv-wrap{padding:10px;font-family:system-ui,-apple-system,sans-serif}'
  + '.cv-hdr{font-size:15px;font-weight:800;letter-spacing:.04em;margin:0 0 4px}'
  + '.cv-hdr span{font-weight:400;font-size:10px;color:#64748B;letter-spacing:0}'
  + '.cv-stat{font-size:10px;color:#64748B;margin-left:6px}'
  + '.cv-bar{height:3px;background:#E2E8F0;border-radius:2px;overflow:hidden;margin:6px 0}'
  + '.cv-bar-fill{height:100%;background:#0EA5E9;width:0%;transition:width .2s}'
  + '.cv-card{border:1px solid #E2E8F0;border-radius:8px;margin:8px 0;overflow:hidden;background:#fff}'
  + '.cv-long{border-left:3px solid #16A34A}.cv-short{border-left:3px solid #DC2626}'
  + '.cv-head{padding:8px 10px;cursor:pointer;display:flex;flex-wrap:wrap;gap:6px;align-items:center}'
  + '.cv-sym{font-weight:800;font-size:12px}'
  + '.cv-chip{font-size:9px;font-weight:700;letter-spacing:.06em;padding:2px 5px;border-radius:3px;background:#F1F5F9;color:#475569}'
  + '.cv-dir-long{background:#DCFCE7;color:#166534}.cv-dir-short{background:#FEE2E2;color:#991B1B}'
  + '.cv-meta{flex-basis:100%;font-size:10px;color:#64748B}'
  + '.cv-body{display:none;padding:0 10px 10px}.cv-body.cv-show{display:block}'
  + '.cv-lv{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0}'
  + '.cv-lv div{border:1px solid #E2E8F0;border-radius:5px;padding:5px;text-align:center}'
  + '.cv-lv small{display:block;font-size:8px;color:#94A3B8;letter-spacing:.06em}'
  + '.cv-lv b{font-size:11px}'
  + '.cv-tbl{width:100%;border-collapse:collapse;font-size:10px;margin:6px 0}'
  + '.cv-tbl th{text-align:left;font-size:8px;letter-spacing:.06em;color:#94A3B8;border-bottom:1px solid #E2E8F0;padding:3px}'
  + '.cv-tbl td{border-bottom:1px solid #F1F5F9;padding:3px;vertical-align:top}'
  + '.cv-pass{color:#166534;font-weight:700}.cv-fail{color:#B91C1C;font-weight:700}'
  + '.cv-opt{color:#94A3B8;font-weight:700}'
  + '.cv-pre{font-family:ui-monospace,Menlo,monospace;font-size:9px;background:#0F172A;color:#E2E8F0;'
  + 'padding:8px;border-radius:6px;overflow:auto;white-space:pre;margin:6px 0}'
  + '.cv-note{font-size:10px;color:#475569;border:1px solid #E2E8F0;border-radius:6px;padding:8px;margin:10px 0;background:#F8FAFC}'
  + '.cv-warn{font-size:10px;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:8px;margin:8px 0}';

var __ui = null, __busy = false, __results = null;

function setStat(t, bad){
  try{ if (__ui && __ui.stat){ __ui.stat.textContent = t; __ui.stat.style.color = bad ? '#DC2626' : ''; } }catch(e){}
}
function setProgress(p){
  try{ if (__ui && __ui.bar) __ui.bar.style.width = Math.min(100, Math.max(0, p)) + '%'; }catch(e){}
}

function cvLedgerHTML(ledger){
  if (!Array.isArray(ledger) || !ledger.length) return '';
  var h = '<table class="cv-tbl"><tr><th>gate</th><th>verdict</th><th>why</th></tr>';
  for (var i = 0; i < ledger.length; i++){
    var g = ledger[i];
    var cls = g.optional ? 'cv-opt' : (g.pass ? 'cv-pass' : 'cv-fail');
    var word = g.optional ? (g.pass ? 'YES' : 'no') : (g.pass ? 'PASS' : 'FAIL');
    h += '<tr><td><b>' + esc(g.gate) + '</b></td><td class="' + cls + '">' + word
      + '</td><td>' + esc(g.why || '') + '</td></tr>';
  }
  return h + '</table>';
}

function cvCardHTML(row, idx){
  var s = row.setup, id = 'cv_' + idx;
  var h = '<div class="cv-card ' + (s.dir === 'long' ? 'cv-long' : 'cv-short') + '">';
  h += '<div class="cv-head" onclick="__cvToggle(' + idx + ')">';
  h += '<span class="cv-sym">' + esc(row.label || row.sym) + '</span>';
  h += '<span class="cv-chip">' + esc(venueName(row.exchange)) + '</span>';
  h += '<span class="cv-chip ' + (s.dir === 'long' ? 'cv-dir-long' : 'cv-dir-short') + '">'
    + s.dir.toUpperCase() + '</span>';
  h += '<span class="cv-chip">' + esc(s.kind) + '</span>';
  h += '<span class="cv-chip">RECORD ONLY</span>';
  h += cvMacroChipHTML(row);   /* hg-v984 */
  h += '<span class="cv-meta">entry ' + fmt(s.entry) + ' · SL ' + fmt(s.stop)
    + ' · TP1 ' + fmt(s.t1) + ' (' + s.rr1 + 'R) · breakeven hit rate '
    + Math.round(s.breakeven * 100) + '%'
    + '<br>decided on the closed 15m bar ' + new Date(row.bar.t * 1000).toISOString().replace('T', ' ').slice(0, 16)
    + ' UTC · Lorentzian ' + fmt(s.mlScore, 2) + ' · swept ' + fmt(s.sweepLevel)
    + ' ' + s.sweepBarsAgo + ' bar(s) ago</span>';
  h += '<span id="' + id + '_a">&#9654;</span></div>';

  h += '<div class="cv-body" id="' + id + '">';
  h += '<div class="cv-lv">'
    + '<div><small>ENTRY</small><b>' + fmt(s.entry) + '</b></div>'
    + '<div><small>STOP</small><b style="color:#DC2626">' + fmt(s.stop) + '</b></div>'
    + '<div><small>TP1 (' + s.rr1 + 'R)</small><b style="color:#166534">' + fmt(s.t1) + '</b></div>'
    + '<div><small>TP2 (' + s.rr2 + 'R)</small><b style="color:#166534">' + fmt(s.t2) + '</b></div>'
    + '</div>';
  h += cvLedgerHTML(row.ledger);
  h += cvMacroNoteHTML(row);   /* hg-v984 */
  h += '<div class="cv-note"><b>WHAT THIS DOES AND DOES NOT CLAIM.</b> No win rate is asserted. '
    + 'At ' + s.rr1 + 'R the trade only has to be right '
    + Math.round(s.breakeven * 100) + '% of the time to break even before costs, '
    + 'which is the arithmetic this setup is built around — not accuracy. '
    + 'Every read above is taken on bars that had already CLOSED, so the signal cannot '
    + 'vanish the way a same-bar trigger does.'
    + (s.floorNote ? '<br>' + esc(s.floorNote) : '') + '</div>';
  h += '<div style="font-size:9px;color:#94A3B8;letter-spacing:.06em;margin-top:8px">'
    + 'MT5 / MT4 WEBHOOK PAYLOAD — BUILT, NOT SENT</div>';
  h += '<div class="cv-pre">' + esc(JSON.stringify(row.webhook, null, 2)) + '</div>';
  h += '</div></div>';
  return h;
}

function cvToggle(idx){
  var b = document.getElementById('cv_' + idx);
  if (!b) return;
  b.classList.toggle('cv-show');
}
W.__cvToggle = cvToggle;

function cvEmptyHTML(run){
  var c = run || {};
  var read = Math.max(0, (+c.scanned || 0) - (+c.skipped || 0) - (+c.unread || 0) - (+c.errors || 0));
  if (!c.scanned) return '<div class="cv-note">CRYPTOVERSE has not run in this session yet.</div>';
  var tally = c.gateTally || {};
  var h = '<div class="cv-note"><b>No setups.</b> ' + read + ' of ' + (c.universe || 0)
    + ' contracts were read and none cleared all three gates. '
    + 'That is what a three-gate rule is for: the first two are location and timing, '
    + 'and most bars are neither.'
    + '</div>';
  var keys = Object.keys(tally).sort(function(a, b){ return tally[b] - tally[a]; });
  if (keys.length){
    h += '<table class="cv-tbl"><tr><th>first gate that stopped it</th><th>contracts</th></tr>';
    for (var i = 0; i < keys.length; i++)
      h += '<tr><td>' + esc(keys[i]) + '</td><td>' + tally[keys[i]] + '</td></tr>';
    h += '</table>';
  }
  return h;
}

function cvCoverageHTML(run){
  if (!run || !run.scanned) return '';
  var read = Math.max(0, run.scanned - run.skipped - run.unread - run.errors);
  var t = read + ' of ' + run.universe + ' contracts read';
  if (run.skipped) t += ' · ' + run.skipped + ' skipped (fewer than ' + CV_MIN_15M + ' closed 15m bars)';
  if (run.unread) t += ' · ' + run.unread + ' never fetched';
  if (run.errors) t += ' · ' + run.errors + ' threw';
  var mix = [], k;
  for (k in (run.venueCounts || {})) if (run.venueCounts[k] > 0) mix.push(venueName(k) + ' ' + run.venueCounts[k]);
  if (mix.length) t += ' · from ' + mix.join(' · ');
  if (run.note) t += ' · universe: ' + run.note;
  return '<div style="font-size:10px;color:' + (run.note ? '#92400E' : '#64748B')
    + ';margin:4px 0">COVERAGE · ' + esc(t) + '</div>';
}

function renderCards(rows, run){
  if (!__ui || !__ui.cards) return;
  var h = '';
  h += cvCoverageHTML(run);
  if (!rows || !rows.length){
    __ui.cards.innerHTML = h + cvEmptyHTML(run);
    return;
  }
  h += '<div style="font-size:11px;font-weight:700;color:#0C4A6E;background:#E0F2FE;'
    + 'padding:6px 8px;border-radius:6px;margin:8px 0">' + rows.length
    + ' setup' + (rows.length === 1 ? '' : 's') + ' cleared all three gates — '
    + 'liquidity taken, classifier fired after it, momentum filter permitting</div>';
  for (var i = 0; i < rows.length; i++) h += cvCardHTML(rows[i], i);
  h += '<div class="cv-note"><b>CRYPTOVERSE — RECORD ONLY.</b> Nothing here is sent anywhere. '
    + 'Every setup is written to the shared forward log and settled out of sample by later bars, '
    + 'so whether this rule pays is a question the log will answer rather than one this tab '
    + 'asserts. At ' + CV_MIN_RR + 'R the breakeven hit rate is '
    + Math.round(cvBreakeven(CV_MIN_RR) * 100) + '% — positive expectancy is the target, '
    + 'not accuracy.</div>';
  __ui.cards.innerHTML = h;
  try{ if (__ui.fwd && typeof W.hgFwdPanelHTML === 'function')
    __ui.fwd.innerHTML = W.hgFwdPanelHTML('CRYPTOVERSE', { minRr: CV_MIN_RR,
      title: 'FORWARD — has this three-gate rule paid?' }) || ''; }catch(e){}
}

async function runScan(ui){
  if (__busy) return 'busy';
  __busy = true;
  var loadUni = W.hgDeskLoadDeltaCoinDCX || W.hgDeskLoadUniverse;
  var fetchKl = W.hgDeskFetchKlines;
  var fetchRes = W.hgDeskFetchKlinesResult;
  if (typeof loadUni !== 'function' || typeof fetchKl !== 'function'){
    setStat('desk-scan-universe.js not loaded — universe helpers missing', true);
    __busy = false; return 'error: universe missing';
  }
  try{
    if (ui && ui.btn) ui.btn.disabled = true;
    setStat('loading universe (Delta + CoinDCX futures)…');
    setProgress(0);
    var prevVenues = (__results && __results.venueCounts) ? __results.venueCounts : null;
    var pack = await loadUni({ minTurnover: 0, includeUnknown: true });
    var items = pack.items || [];
    if (!items.length){ setStat('universe empty', true); return 'error: empty universe'; }
    var vc = pack.venueCounts || {};
    var now = Date.now();
    var rows = [], scanned = 0, skipped = 0, unread = 0, errors = 0;
    var gateTally = {};

    for (var i = 0; i < items.length; i++){
      var item = items[i];
      try{
        var got15 = fetchRes ? await fetchRes(item, '15m', KL_15M)
          : { rows: (await fetchKl(item, '15m', KL_15M)) || [], ok: true, reason: null };
        scanned++; setProgress((scanned / items.length) * 100);
        if (!got15.ok){ unread++; continue; }
        var closed15 = cvClosedRows(got15.rows || [], 900, now);
        if (closed15.length < CV_MIN_15M){ skipped++; continue; }
        var got1h = fetchRes ? await fetchRes(item, '1h', KL_1H)
          : { rows: (await fetchKl(item, '1h', KL_1H)) || [], ok: true, reason: null };
        var closed1h = cvClosedRows(got1h.rows || [], 3600, now);

        var res = cvEvaluate({ rows15: closed15, rows1h: closed1h, venueCost: costFor(item) });
        if (!res.ok){
          var stopped = 'other';
          for (var g = 0; g < res.ledger.length; g++){
            if (!res.ledger[g].optional && !res.ledger[g].pass){ stopped = res.ledger[g].gate; break; }
          }
          if (!res.ledger.length) stopped = 'too few closed bars';
          gateTally[stopped] = (gateTally[stopped] || 0) + 1;
          continue;
        }
        rows.push({ sym: item.sym, label: item.sym, exchange: item.exchange,
                    bar: res.bar, price: res.price, setup: res.setup,
                    ledger: res.ledger, webhook: cvWebhook(item, res),
                    macro: cvMacroMark(item.sym, res.setup.dir) });
        setStat('scanned ' + scanned + '/' + items.length + ' · ' + rows.length + ' setup(s) so far…');
      }catch(eC){ errors++; }
    }

    rows.sort(function(a, b){ return Math.abs(b.setup.mlScore) - Math.abs(a.setup.mlScore); });

    try{
      if (typeof W.hgFwdRecordScan === 'function'){
        var fwd = cvFwdRows(rows);
        if (fwd.length) W.hgFwdRecordScan('CRYPTOVERSE', '15m', fwd, { horizonBars: CV_HORIZON });
      }
    }catch(eF){}

    __results = { at: now, setups: rows, universe: items.length, scanned: scanned,
                  skipped: skipped, unread: unread, errors: errors, gateTally: gateTally,
                  venueCounts: vc, prevVenueCounts: prevVenues, note: pack.note || null };
    renderCards(rows, __results);
    setStat(rows.length + ' setup(s) from ' + scanned + ' scanned · ' + skipped
      + ' skipped (too few closed bars) · ' + unread + ' unread · ' + errors + ' errors · '
      + new Date().toISOString().slice(11, 19) + ' UTC');
    setProgress(100);
    return 'refreshed';
  }catch(e){
    setStat('scan failed: ' + ((e && e.message) || e), true);
    return 'error: ' + ((e && e.message) || e);
  }finally{
    __busy = false;
    try{ if (ui && ui.btn) ui.btn.disabled = false; }catch(e2){}
  }
}

function mount(el){
  if (!el) return;
  try{
    el.innerHTML = '<style>' + CV_CSS + '</style><div class="cv-wrap">'
      + '<h2 class="cv-hdr">CRYPTOVERSE <span>· Delta + CoinDCX futures · liquidity → Lorentzian k-NN → momentum permission · closed bars only · record only</span></h2>'
      + '<div class="cv-warn"><b>No win rate is claimed here.</b> A near-perfect backtest is a '
      + 'look-ahead artefact, so this tab evaluates every read on bars that have already CLOSED, '
      + 'records each setup in the shared forward log, and reports the BREAKEVEN hit rate its '
      + 'R:R implies (' + Math.round(cvBreakeven(CV_MIN_RR) * 100) + '% at ' + CV_MIN_RR + 'R) '
      + 'instead of an accuracy it has not measured. The MT5 webhook payload is built and shown '
      + 'for inspection — it is never sent. Crypto execution stays disabled.</div>'
      + '<div style="margin:8px 0"><button class="btn" id="cvRun">SCAN CRYPTOVERSE</button>'
      + '<span class="cv-stat" id="cvStat">idle</span></div>'
      + '<div class="cv-bar"><div class="cv-bar-fill" id="cvBar"></div></div>'
      + '<div id="cvCards"></div><div id="cvFwd" style="margin-top:14px"></div></div>';
    __ui = { cards: el.querySelector('#cvCards'), stat: el.querySelector('#cvStat'),
             btn: el.querySelector('#cvRun'), bar: el.querySelector('#cvBar'),
             fwd: el.querySelector('#cvFwd') };
    if (__ui.btn) __ui.btn.addEventListener('click', function(){ runScan(__ui); });
    if (__results) renderCards(__results.setups, __results);
    try{ if (__ui.fwd && typeof W.hgFwdPanelHTML === 'function')
      __ui.fwd.innerHTML = W.hgFwdPanelHTML('CRYPTOVERSE', { minRr: CV_MIN_RR,
        title: 'FORWARD — has this three-gate rule paid?' }) || ''; }catch(e){}
  }catch(e){}
}

function refresh(){ return runScan(__ui); }
function cryptoverseState(){ return __results || null; }

W.cryptoverseState = cryptoverseState;
W.__cvRenderCards = renderCards;
W.__cvCardHTML = cvCardHTML;
W.__cvLedgerHTML = cvLedgerHTML;
W.__cvEmptyHTML = cvEmptyHTML;
W.__cvCoverageHTML = cvCoverageHTML;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: TAB_ID, label: 'CRYPTOVERSE', mount: mount, refresh: refresh });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: TAB_ID, label: 'CRYPTOVERSE', run: async function(){ return runScan(__ui); } });

})();
