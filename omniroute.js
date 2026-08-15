/* =========================================================================
HARDGATE — omniroute.js
OMNIROUTE — setup scanner for the techniques the popular desks trade.

WHY THIS TAB EXISTS. The widely followed crypto desks trade a handful of
mechanics our ledger could not express: Wyckoff springs, the power-of-three
session model, opening-range breaks, effort-vs-result absorption, value-area
rejection, measured moves. This tab implements those as REAL GATES and scans
the Delta India + CoinDCX universe with them, so the techniques become
tickets on our own venues instead of a reading list.

THE LEDGER. Six setup families, each a pure detector over OHLCV:

  SPRING     Wyckoff spring / UTAD — price sweeps a established range
             extreme and closes back INSIDE the range. Failed breakdown.
  PO3        Power of three — session accumulation (tight range), then a
             sweep of the range low/high, then expansion + reclaim.
  ORB        Opening-range break — first N bars of the UTC day define the
             range; break and hold beyond it with the daily bias.
  ABSORB     Effort vs result — an outsized volume bar that produces a
             small range at a range edge: someone is absorbing.
  VALUE      Value-area rejection — price tags the volume-profile VAH/VAL
             (built from candle volume-at-price) and rejects back inside.
  MMOVE      Measured move — clean impulse leg, shallow pullback, the leg
             projected forward supplies a structural target.

GATES, NOT SCORES. Every candidate runs the same ledger. Three HARD gates
(trend alignment, ATR vol-alive, participation) are computable from candles
on BOTH venues and must pass explicitly. Funding is CONDITIONAL: it vetoes
when the venue reports a crowded rate, and reports 'unchecked' when the venue
reports nothing at all — CoinDCX publishes no funding, and a blocking funding
gate would have meant CoinDCX could never produce a ticket. A single veto
stands the trade aside; the card still renders with the veto visible, marked
VETO or WATCH, never a ticket. No composite score anywhere; cards are ORDERED
by R:R (a fact about the plan's geometry), which is explicitly not a
prediction. Levels come from the house hgPlanLevels so entry/stop/T1/T2 obey
the same policy as every other tab.

ON "MAXIMUM PROFITABILITY". This ranks by reward-to-risk, requires a minimum
R:R, and refuses setups whose geometry does not clear it. That is the honest
lever available to a scanner. It is NOT a profitability claim: gate quality
is measurable, future returns are not, and no arrangement of these gates has
been walk-forward tested here. Size small until YOU have measured them.

DATA. window.xuUniverse() (combined Delta + CoinDCX, per-leg degradation)
and window.xuCandles(item, tf, n). Both are feature-checked; when either is
absent the tab says so and disables the scan rather than faking a universe.
Positioning (funding) via window.xuPositioning() where the venue reports it —
CoinDCX exposes none, so that gate reads 'unchecked', never 'pass'.

RESEARCH HALVES. The coverage matrix (which desk techniques we can now
express) and the optional OmniRoute-gateway ingest live BELOW the scanner.
The gateway is machine-local, so ingest works when running HARDGATE locally
and is unreachable from the deployed site; it says so rather than failing
silently. The scanner needs no gateway at all.

Classic script, IIFE. Exposes the pure detectors/graders (for tests) and the
window.HG_tabs registration. Never throws at load; every global is
feature-checked; every fetch carries a timeout and resolves [] on failure.

Hard refresh (index.html hardRefreshAll): refresh() is async, NEVER throws,
returns a terse status string. Before the first scan it reports
'skipped: not run yet' (a global refresh must never trigger an expensive
first-time whole-universe sweep); while a scan is in flight, 'busy'.
========================================================================= */
'use strict';

(function(){

  var LS_KEY = 'hg_omniroute_v1';
  var DEFAULT_ENDPOINT = 'http://localhost:20128';
  var DEFAULT_MODEL = 'auto/best-free';
  var LLM_TIMEOUT_MS = 90000;
  var PING_TIMEOUT_MS = 8000;

  /* Scan shape. TOP_N bounds the sweep so a scan stays inside a sane time
     budget; it is stated in the UI because a silent cap reads as "scanned
     everything" when it did not. */
  var TOP_N = 40;
  var TF = '4h';
  var BARS = 180;
  var CHUNK = 5;
  var MIN_RR = 2;
  var RANGE_LOOKBACK = 40;
  var ORB_BARS = 3;

  var __omni = { ui: null, busy: false, ran: false, snap: null, lastStat: '' };

  /* ==================== pure: small numerics ==================== */

  function num(v){ var n = +v; return isFinite(n) ? n : NaN; }

  function emaOf(vals, n){
    if (!vals || vals.length < n || n <= 0) return NaN;
    var k = 2 / (n + 1), e = vals[0], i;
    for (i = 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
    return e;
  }

  function closesOf(rows){
    var out = [], i, c;
    for (i = 0; i < rows.length; i++){ c = num(rows[i].c); if (isFinite(c)) out.push(c); }
    return out;
  }

  /* Wilder-style ATR over the last n bars. NaN when there is not enough. */
  function atrOf(rows, n){
    if (!rows || rows.length < n + 1) return NaN;
    var sum = 0, cnt = 0, i, h, l, pc, tr;
    for (i = rows.length - n; i < rows.length; i++){
      h = num(rows[i].h); l = num(rows[i].l); pc = num(rows[i - 1].c);
      if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) continue;
      tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      sum += tr; cnt++;
    }
    return cnt ? sum / cnt : NaN;
  }

  function meanVol(rows, n){
    if (!rows || !rows.length) return NaN;
    var s = 0, c = 0, i, v;
    for (i = Math.max(0, rows.length - n); i < rows.length; i++){
      v = num(rows[i].v); if (isFinite(v)) { s += v; c++; }
    }
    return c ? s / c : NaN;
  }

  /* ==================== pure: range + structure ==================== */

  /* The established range EXCLUDING the last bar (the bar under test must
     not define the level it is supposed to sweep). */
  function hgOmniRange(rows, lookback){
    if (!rows || rows.length < 5) return null;
    var n = Math.min(lookback || RANGE_LOOKBACK, rows.length - 1);
    var hi = -Infinity, lo = Infinity, i, h, l;
    for (i = rows.length - 1 - n; i < rows.length - 1; i++){
      if (i < 0) continue;
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
    }
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    var mid = (hi + lo) / 2;
    return { hi: hi, lo: lo, mid: mid, height: hi - lo, heightPct: (hi - lo) / mid * 100, bars: n };
  }

  /* SPRING / UTAD: last bar pierces a range extreme and CLOSES back inside.
     dir 'long' = swept the low (failed breakdown). Pure. */
  function hgOmniSpring(rows, rng){
    if (!rows || rows.length < 3 || !rng) return null;
    var last = rows[rows.length - 1];
    var h = num(last.h), l = num(last.l), c = num(last.c), o = num(last.o);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c) || !isFinite(o)) return null;
    var depth;
    if (l < rng.lo && c > rng.lo){
      depth = (rng.lo - l) / (rng.height || 1) * 100;
      return { kind:'SPRING', dir:'long', level: rng.lo, pierce: rng.lo - l, depthPct: depth,
               why: 'swept range low ' + rng.lo.toFixed(6) + ' and closed back inside' };
    }
    if (h > rng.hi && c < rng.hi){
      depth = (h - rng.hi) / (rng.height || 1) * 100;
      return { kind:'UTAD', dir:'short', level: rng.hi, pierce: h - rng.hi, depthPct: depth,
               why: 'swept range high ' + rng.hi.toFixed(6) + ' and closed back inside' };
    }
    return null;
  }

  /* POWER OF THREE: a tight accumulation window, then a sweep of that
     window's extreme, then expansion + close back through the window.
     Looks at the last `win`+2 bars. Pure. */
  function hgOmniPo3(rows, win){
    if (!rows || rows.length < (win || 6) + 3) return null;
    var w = win || 6;
    var end = rows.length - 2;               // accumulation ends before sweep bar
    var start = end - w;
    if (start < 0) return null;
    var hi = -Infinity, lo = Infinity, i, h, l;
    for (i = start; i < end; i++){
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
    }
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    var accHeight = hi - lo, mid = (hi + lo) / 2;
    var atr = atrOf(rows, 14);
    /* accumulation must actually be TIGHT — otherwise every drift qualifies */
    if (!isFinite(atr) || accHeight > atr * 2.2) return null;
    var sweep = rows[rows.length - 2], last = rows[rows.length - 1];
    var sl = num(sweep.l), sh = num(sweep.h), lc = num(last.c);
    if (!isFinite(sl) || !isFinite(sh) || !isFinite(lc)) return null;
    if (sl < lo && lc > lo){
      return { kind:'PO3', dir:'long', level: lo, accPct: accHeight / mid * 100,
               why:'tight ' + w + '-bar accumulation, swept low, reclaimed' };
    }
    if (sh > hi && lc < hi){
      return { kind:'PO3', dir:'short', level: hi, accPct: accHeight / mid * 100,
               why:'tight ' + w + '-bar accumulation, swept high, rejected' };
    }
    return null;
  }

  /* OPENING RANGE: first ORB_BARS bars of the current UTC day set the range;
     a later bar closing beyond it with follow-through is the break. Needs
     bar-open times in SECONDS (xuCandles contract). Pure. */
  function hgOmniOrb(rows, orbBars){
    if (!rows || rows.length < 6) return null;
    var nb = orbBars || ORB_BARS;
    var last = rows[rows.length - 1];
    var t = num(last.t);
    if (!isFinite(t)) return null;
    var dayStart = Math.floor(t / 86400) * 86400;
    var day = [], i, ti;
    for (i = 0; i < rows.length; i++){
      ti = num(rows[i].t);
      if (isFinite(ti) && ti >= dayStart) day.push(rows[i]);
    }
    if (day.length < nb + 2) return null;      // need the range plus a break bar
    var hi = -Infinity, lo = Infinity, h, l;
    for (i = 0; i < nb; i++){
      h = num(day[i].h); l = num(day[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
    }
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    var c = num(last.c);
    if (!isFinite(c)) return null;
    if (c > hi) return { kind:'ORB', dir:'long', level: hi, why:'closed above the ' + nb + '-bar UTC opening range' };
    if (c < lo) return { kind:'ORB', dir:'short', level: lo, why:'closed below the ' + nb + '-bar UTC opening range' };
    return null;
  }

  /* EFFORT VS RESULT: outsized volume, undersized range, near a range edge.
     Absorption — heavy participation that failed to move price. Pure. */
  function hgOmniAbsorb(rows, rng){
    if (!rows || rows.length < 25 || !rng) return null;
    var last = rows[rows.length - 1];
    var v = num(last.v), h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(v) || !isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var mv = meanVol(rows.slice(0, rows.length - 1), 20);
    var atr = atrOf(rows, 14);
    if (!isFinite(mv) || !isFinite(atr) || mv <= 0 || atr <= 0) return null;
    var volX = v / mv, rangeX = (h - l) / atr;
    if (!(volX >= 1.8 && rangeX <= 0.75)) return null;
    var nearLo = Math.abs(c - rng.lo) / (rng.height || 1) < 0.15;
    var nearHi = Math.abs(c - rng.hi) / (rng.height || 1) < 0.15;
    if (nearLo) return { kind:'ABSORB', dir:'long', level: rng.lo, volX: volX, rangeX: rangeX,
                         why:'vol ' + volX.toFixed(1) + '× with ' + rangeX.toFixed(2) + '× ATR range at range low' };
    if (nearHi) return { kind:'ABSORB', dir:'short', level: rng.hi, volX: volX, rangeX: rangeX,
                         why:'vol ' + volX.toFixed(1) + '× with ' + rangeX.toFixed(2) + '× ATR range at range high' };
    return null;
  }

  /* VOLUME PROFILE from candles: spread each bar's volume evenly across its
     high-low span into buckets, then take POC and the 70% value area. This
     is a candle approximation, NOT tick-level volume-at-price — labelled as
     such in the UI so it is never mistaken for exchange profile data. */
  function hgOmniProfile(rows, buckets){
    if (!rows || rows.length < 20) return null;
    var nb = buckets || 24, i, j;
    var hi = -Infinity, lo = Infinity, h, l;
    for (i = 0; i < rows.length; i++){
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
    }
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    var step = (hi - lo) / nb, bins = [], total = 0;
    for (i = 0; i < nb; i++) bins.push(0);
    for (i = 0; i < rows.length; i++){
      h = num(rows[i].h); l = num(rows[i].l);
      var v = num(rows[i].v);
      if (!isFinite(h) || !isFinite(l) || !isFinite(v) || v <= 0) continue;
      var a = Math.max(0, Math.min(nb - 1, Math.floor((l - lo) / step)));
      var b = Math.max(0, Math.min(nb - 1, Math.floor((h - lo) / step)));
      var span = (b - a) + 1;
      for (j = a; j <= b; j++){ bins[j] += v / span; }
      total += v;
    }
    if (total <= 0) return null;
    var pocIdx = 0;
    for (i = 1; i < nb; i++) if (bins[i] > bins[pocIdx]) pocIdx = i;
    /* grow out from the POC until 70% of volume is enclosed */
    var acc = bins[pocIdx], loIdx = pocIdx, hiIdx = pocIdx, target = total * 0.7, guard = 0;
    while (acc < target && guard++ < nb * 2 && (loIdx > 0 || hiIdx < nb - 1)){
      var down = (loIdx > 0) ? bins[loIdx - 1] : -1;
      var up = (hiIdx < nb - 1) ? bins[hiIdx + 1] : -1;
      if (up >= down && hiIdx < nb - 1){ hiIdx++; acc += bins[hiIdx]; }
      else if (loIdx > 0){ loIdx--; acc += bins[loIdx]; }
      else break;
    }
    return {
      poc: lo + (pocIdx + 0.5) * step,
      val: lo + loIdx * step,
      vah: lo + (hiIdx + 1) * step,
      approx: true
    };
  }

  /* VALUE-AREA REJECTION: bar tags VAH/VAL and closes back inside. Pure. */
  function hgOmniValueReject(rows, prof){
    if (!rows || !rows.length || !prof) return null;
    var last = rows[rows.length - 1];
    var h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    if (l < prof.val && c > prof.val){
      return { kind:'VALUE', dir:'long', level: prof.val, why:'tagged value-area low and closed back inside' };
    }
    if (h > prof.vah && c < prof.vah){
      return { kind:'VALUE', dir:'short', level: prof.vah, why:'tagged value-area high and closed back inside' };
    }
    return null;
  }

  /* MEASURED MOVE: impulse leg over `leg` bars, then a pullback of 30-70%
     of it. Projects the leg from the pullback low/high. Pure. */
  function hgOmniMeasuredMove(rows, leg){
    if (!rows || rows.length < (leg || 10) + 4) return null;
    var L = leg || 10;
    var seg = rows.slice(rows.length - L - 4, rows.length);
    var startC = num(seg[0].c), lastC = num(seg[seg.length - 1].c);
    if (!isFinite(startC) || !isFinite(lastC)) return null;
    var hi = -Infinity, lo = Infinity, i, h, l;
    for (i = 0; i < seg.length; i++){
      h = num(seg[i].h); l = num(seg[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
    }
    if (!isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    var span = hi - lo;
    var atr = atrOf(rows, 14);
    if (!isFinite(atr) || span < atr * 2) return null;      // needs a real leg
    if (lastC > startC){
      var rt = (hi - lastC) / span;
      if (rt >= 0.3 && rt <= 0.7) return { kind:'MMOVE', dir:'long', level: lastC, projected: lastC + span, why:'impulse leg + ' + Math.round(rt*100) + '% pullback' };
    } else {
      var rt2 = (lastC - lo) / span;
      if (rt2 >= 0.3 && rt2 <= 0.7) return { kind:'MMOVE', dir:'short', level: lastC, projected: lastC - span, why:'impulse leg + ' + Math.round(rt2*100) + '% pullback' };
    }
    return null;
  }

  /* Run every detector; return all hits (a symbol can present more than one
     family, which is genuine confluence rather than a duplicate). Pure. */
  function hgOmniDetect(rows){
    var out = [];
    if (!rows || rows.length < 30) return out;
    var rng = hgOmniRange(rows, RANGE_LOOKBACK);
    var prof = hgOmniProfile(rows, 24);
    var d;
    if (rng){
      d = hgOmniSpring(rows, rng); if (d) out.push(d);
      d = hgOmniAbsorb(rows, rng); if (d) out.push(d);
    }
    d = hgOmniPo3(rows, 6); if (d) out.push(d);
    d = hgOmniOrb(rows, ORB_BARS); if (d) out.push(d);
    if (prof){ d = hgOmniValueReject(rows, prof); if (d) out.push(d); }
    d = hgOmniMeasuredMove(rows, 10); if (d) out.push(d);
    return out;
  }

  /* ==================== pure: the gate ledger ==================== */

  /* Each gate returns {key, hard, pass, why}. pass:null means UNKNOWN — the
     venue did not report the input.
       hard:true   computable from candles alone, so it is available on BOTH
                   venues. Must be an explicit pass; unknown blocks.
       hard:false  CONDITIONAL — vetoes when it can be evaluated and fails,
                   but an unevaluable one does not disqualify the setup. This
                   is the difference between "degrade honestly" and "punish
                   the venue for its API": CoinDCX publishes no funding, so a
                   blocking funding gate would mean CoinDCX could never
                   produce a ticket at all. The card still shows the check
                   did not run, so nobody mistakes silence for a pass. */
  function hgOmniGates(rows, hit, positioning){
    var gates = [];
    var closes = closesOf(rows);
    var e21 = emaOf(closes.slice(-60), 21), e50 = emaOf(closes.slice(-120), 50);
    var last = closes.length ? closes[closes.length - 1] : NaN;

    /* 1 — trend alignment: the setup must not fight the 21/50 stack */
    var trendOk = null, trendWhy = 'EMA unavailable';
    if (isFinite(e21) && isFinite(e50) && isFinite(last)){
      var up = e21 >= e50, dn = e21 <= e50;
      trendOk = (hit.dir === 'long') ? up : dn;
      trendWhy = 'EMA21 ' + (up ? '≥' : '<') + ' EMA50' + (trendOk ? ' — with the setup' : ' — against the setup');
    }
    gates.push({ key:'trend', hard:true, pass: trendOk, why: trendWhy });

    /* 2 — volatility alive: a dead tape cannot pay a 2R target */
    var atr = atrOf(rows, 14), atrPct = (isFinite(atr) && isFinite(last) && last > 0) ? (atr / last * 100) : NaN;
    var volOk = isFinite(atrPct) ? (atrPct >= 0.35) : null;
    gates.push({ key:'vol-alive', hard:true, pass: volOk,
      why: isFinite(atrPct) ? ('ATR ' + atrPct.toFixed(2) + '% of price' + (volOk ? '' : ' — too dead')) : 'ATR unavailable' });

    /* 3 — participation: the trigger bar should not be a volume vacuum */
    var mv = meanVol(rows.slice(0, rows.length - 1), 20), lv = num(rows[rows.length - 1].v);
    var partOk = (isFinite(mv) && isFinite(lv) && mv > 0) ? (lv >= mv * 0.7) : null;
    gates.push({ key:'participation', hard:true, pass: partOk,
      why: (isFinite(mv) && isFinite(lv) && mv > 0) ? ('trigger vol ' + (lv/mv).toFixed(2) + '× 20-bar mean') : 'volume unavailable' });

    /* 4 — funding sanity: never add to the crowded side of an extreme.
       CoinDCX reports no funding, so this legitimately stays unknown. */
    var f = (positioning && isFinite(positioning.fundingPct)) ? positioning.fundingPct : NaN;
    var fundOk = null, fundWhy = 'funding not reported by venue';
    if (isFinite(f)){
      var crowded = (hit.dir === 'long' && f > 0.05) || (hit.dir === 'short' && f < -0.05);
      fundOk = !crowded;
      fundWhy = 'funding ' + f.toFixed(4) + '%' + (crowded ? ' — crowded on our side' : ' — not crowded');
    }
    gates.push({ key:'funding', hard:false, pass: fundOk, why: fundWhy });

    return gates;
  }

  /* Ticket requires: every HARD gate an explicit pass, and no evaluable veto
     anywhere. An unevaluable CONDITIONAL gate degrades the card (reported in
     `degraded`) but does not stand it aside — see the note on hgOmniGates.
     An unevaluable HARD gate still blocks, because those are computable on
     both venues and a missing one means the data itself was bad. Pure. */
  function hgOmniGrade(gates){
    var vetoes = [], hardUnknown = [], degraded = [], i, g;
    for (i = 0; i < gates.length; i++){
      g = gates[i];
      if (g.pass === false) vetoes.push(g.key);
      else if (g.pass === null){
        if (g.hard) hardUnknown.push(g.key); else degraded.push(g.key);
      }
    }
    var ticket = vetoes.length === 0 && hardUnknown.length === 0;
    return {
      ticket: ticket,
      vetoes: vetoes,
      unknown: hardUnknown,
      degraded: degraded,
      verdict: vetoes.length ? ('VETO — ' + vetoes.join(', '))
             : (hardUnknown.length ? ('WATCH — no data: ' + hardUnknown.join(', '))
             : (degraded.length ? ('CLEAN · unchecked: ' + degraded.join(', ')) : 'CLEAN'))
    };
  }

  /* Whole per-symbol evaluation: detectors -> gates -> plan. Pure given
     rows; hgPlanLevels is looked up defensively and NaN-safe. */
  function hgOmniEvaluate(item, rows, positioning){
    var hits = hgOmniDetect(rows), out = [], i;
    if (!hits.length) return out;
    var planFn = (typeof window !== 'undefined' && typeof window.hgPlanLevels === 'function')
      ? window.hgPlanLevels : null;
    for (i = 0; i < hits.length; i++){
      var hit = hits[i];
      var gates = hgOmniGates(rows, hit, positioning);
      var grade = hgOmniGrade(gates);
      var plan = null;
      if (planFn){
        try { plan = planFn(hit.dir, rows, undefined, { minRr: MIN_RR, type: 'OMNI' }); }
        catch (e) { plan = null; }
      }
      out.push({
        sym: item && item.sym, base: item && item.base, exchange: item && item.exchange,
        kind: hit.kind, dir: hit.dir, level: hit.level, why: hit.why,
        gates: gates, grade: grade, plan: plan,
        rr: (plan && isFinite(plan.rr1)) ? plan.rr1 : NaN
      });
    }
    return out;
  }

  /* Ordering: tickets first, then by R:R desc, then base alpha so the list
     is stable between runs. Setups with no computable plan sink. Pure. */
  function hgOmniRank(cands){
    var arr = (cands || []).slice();
    arr.sort(function(a, b){
      if (a.grade.ticket !== b.grade.ticket) return a.grade.ticket ? -1 : 1;
      var ar = isFinite(a.rr) ? a.rr : -1, br = isFinite(b.rr) ? b.rr : -1;
      if (br !== ar) return br - ar;
      return String(a.base) < String(b.base) ? -1 : 1;
    });
    return arr;
  }

  /* ==================== coverage matrix (research half) ==================== */

  function hgOmniGateInventory(){
    return [
      { key:'ema_cascade',      label:'EMA cascade / trend stack',        tabs:['SWING SCAN','EDGE','TREND MATRIX'] },
      { key:'htf_alignment',    label:'higher-timeframe alignment',       tabs:['SWING SCAN','BIAS','EDGE'] },
      { key:'sweep_reclaim',    label:'liquidity sweep + reclaim',        tabs:['SCALP SCAN','LIQUIDITY TRAP','EDGE'] },
      { key:'fvg',              label:'fair value gap / imbalance',       tabs:['SMC (FVG)'] },
      { key:'order_block',      label:'order block + mitigation',         tabs:['ORDER BLOCKS'] },
      { key:'rsi_band',         label:'RSI band / guard',                 tabs:['SWING SCAN','SCALP SCAN'] },
      { key:'divergence',       label:'RSI divergence',                   tabs:['DIVERGENCE'] },
      { key:'squeeze',          label:'volatility squeeze / Donchian',    tabs:['SQUEEZE','COIL WATCHLIST'] },
      { key:'compression',      label:'range compression',                tabs:['COIL WATCHLIST'] },
      { key:'funding',          label:'funding rate + crowding',          tabs:['SMART $','OI FLOW','BASIS','CARRY'] },
      { key:'open_interest',    label:'open interest regime',             tabs:['OI FLOW','SMART $'] },
      { key:'taker_flow',       label:'taker buy/sell imbalance',         tabs:['SMART $','OI FLOW'] },
      { key:'tsmom',            label:'time-series momentum',             tabs:['BIAS'] },
      { key:'cusum',            label:'CUSUM structural break',           tabs:['BIAS','SWING SCAN'] },
      { key:'rel_strength',     label:'relative strength / rotation',     tabs:['APEX (RS)'] },
      { key:'regime',           label:'market regime risk-on/off',        tabs:['REGIME'] },
      { key:'macro',            label:'macro overlay',                    tabs:['GOLD','GOLD PRO','REGIME'] },
      { key:'atr_vol',          label:'ATR / volatility-alive check',     tabs:['SCALP SCAN','OMNIROUTE'] },
      { key:'structural_rr',    label:'structural R:R floor',             tabs:['SWING SCAN','EDGE','OMNIROUTE'] },
      { key:'session_killzone', label:'session / kill-zone time gating',  tabs:['GOLD'] },
      { key:'portfolio_heat',   label:'portfolio heat / risk cap',        tabs:['TRADE PLAN','RISK'] },
      /* newly implemented right here */
      { key:'spring_utad',      label:'Wyckoff spring / UTAD',            tabs:['OMNIROUTE'] },
      { key:'power_of_three',   label:'power of three (acc → sweep → expand)', tabs:['OMNIROUTE'] },
      { key:'opening_range',    label:'opening-range break',              tabs:['OMNIROUTE'] },
      { key:'effort_vs_result', label:'effort vs result (absorption)',    tabs:['OMNIROUTE'] },
      { key:'volume_profile',   label:'volume profile POC (candle approx)', tabs:['OMNIROUTE'] },
      { key:'value_area',       label:'value area VAH/VAL rejection',     tabs:['OMNIROUTE'] },
      { key:'measured_move',    label:'measured move projection',         tabs:['OMNIROUTE'] }
    ];
  }

  function hgOmniInventoryKeys(){
    var inv = hgOmniGateInventory(), out = {}, i;
    for (i = 0; i < inv.length; i++) out[inv[i].key] = inv[i];
    return out;
  }

  function hgOmniRoster(){
    return [
      { school:'ICT / smart-money liquidity model',
        taught:'liquidity sweeps, fair value gaps, order blocks, kill zones, power of three',
        needs:['sweep_reclaim','fvg','order_block','session_killzone','power_of_three'] },
      { school:'Wyckoff method',
        taught:'accumulation/distribution schematics, spring and upthrust, volume dry-up, effort vs result',
        needs:['compression','spring_utad','effort_vs_result','open_interest'] },
      { school:'TTM squeeze / volatility expansion',
        taught:'Bollinger-inside-Keltner compression, momentum fire, Donchian breakout',
        needs:['squeeze','compression','atr_vol'] },
      { school:'Perp positioning / funding desk',
        taught:'funding z-score extremes, OI divergence, taker imbalance, contrarian crowding',
        needs:['funding','open_interest','taker_flow'] },
      { school:'Quant trend following (TSMOM)',
        taught:'time-series momentum, volatility targeting, structural-break detection',
        needs:['tsmom','cusum','vol_targeting'] },
      { school:'Relative strength rotation',
        taught:'rank universe against a benchmark, hold leaders, rotate on rank decay',
        needs:['rel_strength','regime'] },
      { school:'Volume profile / auction market theory',
        taught:'point of control, value area, naked POC revisits, acceptance vs rejection',
        needs:['volume_profile','value_area'] },
      { school:'Order flow / CVD',
        taught:'cumulative volume delta, absorption at levels, liquidation cascades',
        needs:['cvd','taker_flow','liquidation_map'] },
      { school:'Classical price action (Brooks)',
        taught:'trend bars, measured moves, always-in direction, second-entry pullbacks',
        needs:['ema_cascade','htf_alignment','measured_move'] },
      { school:'Session / opening range',
        taught:'daily and weekly opening range, prior-session reference, Asia range break',
        needs:['session_killzone','opening_range'] }
    ];
  }

  function hgOmniCoverage(row, inv){
    if (!row || !row.needs || !row.needs.length) return null;
    var keys = inv || hgOmniInventoryKeys(), have = [], miss = [], i, k;
    for (i = 0; i < row.needs.length; i++){
      k = row.needs[i];
      if (keys[k]) have.push(k); else miss.push(k);
    }
    return { school: row.school, taught: row.taught, have: have, miss: miss,
             verdict: miss.length === 0 ? 'COVERED' : (have.length === 0 ? 'GAP' : 'PARTIAL') };
  }

  function hgOmniCoverageMatrix(){
    var inv = hgOmniInventoryKeys(), roster = hgOmniRoster(), out = [], i, c;
    for (i = 0; i < roster.length; i++){ c = hgOmniCoverage(roster[i], inv); if (c) out.push(c); }
    return out;
  }

  function hgOmniGaps(){
    var m = hgOmniCoverageMatrix(), tally = {}, out = [], i, j, k;
    for (i = 0; i < m.length; i++){
      for (j = 0; j < m[i].miss.length; j++){
        k = m[i].miss[j];
        if (!tally[k]) tally[k] = { key:k, schools:[] };
        tally[k].schools.push(m[i].school);
      }
    }
    for (k in tally) if (Object.prototype.hasOwnProperty.call(tally, k)) out.push(tally[k]);
    out.sort(function(a,b){
      if (b.schools.length !== a.schools.length) return b.schools.length - a.schools.length;
      return a.key < b.key ? -1 : 1;
    });
    return out;
  }

  /* ==================== gateway ingest (research half) ==================== */

  function hgOmniVocabulary(){
    var inv = hgOmniGateInventory(), out = [], i;
    for (i = 0; i < inv.length; i++) out.push(inv[i].key);
    var extra = ['vol_targeting','cvd','liquidation_map'];
    for (i = 0; i < extra.length; i++) if (out.indexOf(extra[i]) === -1) out.push(extra[i]);
    return out;
  }

  function hgOmniBuildPrompt(sourceText, kind){
    var what = kind === 'search'
      ? 'Search the web for how this trader or strategy actually works, then extract it.'
      : 'Extract the trading method described in the SOURCE below.';
    return [
      'You are a trading-strategy extractor. ' + what,
      'Return STRICT JSON only — no prose, no markdown fence. Shape:',
      '{"name":string,"timeframe":string,"trigger":string,"filters":[string],',
      '"invalidation":string,"target":string,"techniques":[string]}',
      '',
      '"techniques" MUST come from exactly this vocabulary (use only what the',
      'method genuinely relies on; omit the rest):',
      hgOmniVocabulary().join(', '),
      '',
      'Rules: if the source does not state something, use the empty string —',
      'never invent a number. Do not opine on whether the method is good.',
      '',
      'SOURCE:',
      String(sourceText || '').slice(0, 24000)
    ].join('\n');
  }

  function hgOmniParseModelJson(text){
    if (typeof text !== 'string' || !text) return null;
    var s = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(s); } catch (e) {}
    var start = s.indexOf('{');
    if (start < 0) return null;
    var depth = 0, i, ch;
    for (i = start; i < s.length; i++){
      ch = s.charAt(i);
      if (ch === '{') depth++;
      else if (ch === '}'){
        depth--;
        if (depth === 0){ try { return JSON.parse(s.slice(start, i + 1)); } catch (e2) { return null; } }
      }
    }
    return null;
  }

  function hgOmniMapRules(rules){
    if (!rules || typeof rules !== 'object') return null;
    var keys = hgOmniInventoryKeys(), vocab = hgOmniVocabulary();
    var tech = Array.isArray(rules.techniques) ? rules.techniques : [];
    var covered = [], gaps = [], unknown = [], i, t;
    for (i = 0; i < tech.length; i++){
      t = String(tech[i] || '').trim();
      if (!t) continue;
      if (keys[t]) covered.push({ key:t, label:keys[t].label, tabs:keys[t].tabs });
      else if (vocab.indexOf(t) >= 0) gaps.push(t);
      else unknown.push(t);
    }
    return {
      name: String(rules.name || 'unnamed method'),
      timeframe: String(rules.timeframe || ''), trigger: String(rules.trigger || ''),
      filters: Array.isArray(rules.filters) ? rules.filters.map(String) : [],
      invalidation: String(rules.invalidation || ''), target: String(rules.target || ''),
      covered: covered, gaps: gaps, unknown: unknown,
      verdict: gaps.length === 0 && covered.length > 0 ? 'ALREADY COVERED'
             : (covered.length === 0 ? 'NOT EXPRESSIBLE TODAY' : 'PARTIAL — ' + gaps.length + ' new gate(s) needed')
    };
  }

  /* ==================== settings + gateway I/O ==================== */

  function hgOmniLoadCfg(){
    var cfg = { endpoint: DEFAULT_ENDPOINT, token: '', model: DEFAULT_MODEL };
    try {
      if (typeof localStorage === 'undefined') return cfg;
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return cfg;
      var j = JSON.parse(raw);
      if (j && typeof j === 'object'){
        if (j.endpoint) cfg.endpoint = String(j.endpoint);
        if (j.token) cfg.token = String(j.token);
        if (j.model) cfg.model = String(j.model);
      }
    } catch (e) {}
    return cfg;
  }

  function hgOmniSaveCfg(cfg){
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem(LS_KEY, JSON.stringify({
        endpoint: String(cfg.endpoint || ''), token: String(cfg.token || ''), model: String(cfg.model || '')
      }));
      return true;
    } catch (e) { return false; }
  }

  function hgOmniFetchJson(url, opts, timeoutMs){
    if (typeof fetch !== 'function' || typeof AbortController !== 'function') return Promise.resolve(null);
    var ctl = new AbortController();
    var timer = setTimeout(function(){ try { ctl.abort(); } catch (e) {} }, timeoutMs);
    var o = opts || {};
    o.signal = ctl.signal;
    return fetch(url, o).then(function(r){
      return r.text().then(function(t){
        var j = null;
        try { j = JSON.parse(t); } catch (e) {}
        return { ok: r.ok, status: r.status, json: j, text: t };
      });
    }).catch(function(){ return null; }).then(function(v){ clearTimeout(timer); return v; });
  }

  function hgOmniPing(cfg){
    var base = String(cfg.endpoint || '').replace(/\/+$/, '');
    if (!base) return Promise.resolve({ ok:false, msg:'no endpoint set' });
    var headers = { 'Content-Type':'application/json' };
    if (cfg.token) headers['Authorization'] = 'Bearer ' + cfg.token;
    return hgOmniFetchJson(base + '/v1/models', { method:'GET', headers:headers }, PING_TIMEOUT_MS)
      .then(function(r){
        if (!r) return { ok:false, msg:'unreachable — gateway not running, or this page is not on your machine' };
        if (r.status === 401 || r.status === 403) return { ok:false, msg:'auth rejected (' + r.status + ')' };
        if (!r.ok) return { ok:false, msg:'HTTP ' + r.status };
        var n = (r.json && r.json.data && r.json.data.length) ? r.json.data.length : 0;
        return { ok:true, msg:'gateway up · ' + n + ' models' };
      });
  }

  function hgOmniCompleteOnce(cfg, prompt){
    var base = String(cfg.endpoint || '').replace(/\/+$/, '');
    var headers = { 'Content-Type':'application/json' };
    if (cfg.token) headers['Authorization'] = 'Bearer ' + cfg.token;
    return hgOmniFetchJson(base + '/v1/chat/completions', {
      method:'POST', headers:headers,
      body: JSON.stringify({ model: cfg.model || DEFAULT_MODEL,
        messages:[{ role:'user', content: prompt }], max_tokens:1400, stream:false })
    }, LLM_TIMEOUT_MS).then(function(r){
      if (!r) return { ok:false, msg:'gateway unreachable or timed out', retryable:true };
      if (!r.ok){
        var em = (r.json && r.json.error && r.json.error.message) ? r.json.error.message : ('HTTP ' + r.status);
        return { ok:false, msg:em, retryable: r.status !== 401 && r.status !== 403 };
      }
      var txt = '';
      try { txt = r.json.choices[0].message.content; } catch (e) {}
      if (!txt){
        var em2 = (r.json && r.json.error && r.json.error.message) ? r.json.error.message : 'provider returned no completion';
        return { ok:false, msg:em2, retryable:true };
      }
      return { ok:true, text:txt, model:(r.json && r.json.model) || '' };
    });
  }

  /* Retry once: measured ~1-in-3 first-attempt misses on the free pool
     (HTTP 200 with no choices when auto/* draws a rejecting provider). */
  function hgOmniComplete(cfg, prompt, onRetry){
    return hgOmniCompleteOnce(cfg, prompt).then(function(r){
      if (r.ok || !r.retryable) return r;
      if (typeof onRetry === 'function') { try { onRetry(r.msg); } catch (e) {} }
      return hgOmniCompleteOnce(cfg, prompt).then(function(r2){
        return r2.ok ? r2 : { ok:false, msg: r2.msg + ' (retried once)' };
      });
    });
  }

  /* ==================== render ==================== */

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmt(n, d){ return isFinite(n) ? (+n).toFixed(d == null ? 4 : d) : '—'; }
  function pill(txt, cls){ return '<span class="gpip ' + (cls || '') + '">' + esc(txt) + '</span>'; }

  function gateLine(g){
    var cls = g.pass === true ? 'ok' : (g.pass === false ? 'bad' : '');
    /* an unevaluable CONDITIONAL gate reads UNCHECKED, not UNKNOWN — the
       distinction matters: it did not fail, it never ran. */
    var mark = g.pass === true ? 'PASS'
             : (g.pass === false ? 'VETO' : (g.hard ? 'NO DATA' : 'UNCHECKED'));
    return '<li>' + pill(mark, cls) + ' <b>' + esc(g.key) + '</b> <span class="dim">' + esc(g.why) + '</span></li>';
  }

  function setupCard(c){
    var head = esc(c.base || c.sym) + ' · ' + esc(c.kind) + ' ' + esc(c.dir.toUpperCase());
    var badge = c.grade.ticket ? pill('TICKET','ok') : pill(c.grade.vetoes.length ? 'VETO' : 'WATCH', c.grade.vetoes.length ? 'bad' : '');
    if (c.grade.ticket && c.grade.degraded && c.grade.degraded.length){
      badge += ' ' + pill('· ' + c.grade.degraded.join(',') + ' unchecked', '');
    }
    var h = '<div class="card">';
    h += '<div class="ttl">' + head + ' ' + badge + ' <span class="dim">' + esc(String(c.exchange || '').toUpperCase()) + '</span></div>';
    h += '<div class="dim">' + esc(c.why) + '</div>';
    if (c.plan){
      h += '<div class="plan">ENTRY ' + fmt(c.plan.entry) + ' · STOP ' + fmt(c.plan.stop)
        +  ' · T1 ' + fmt(c.plan.t1) + ' · T2 ' + fmt(c.plan.t2)
        +  ' · <b>R:R ' + fmt(c.plan.rr1, 2) + '</b>'
        +  ' · risk ' + fmt(c.plan.riskPct, 2) + '%</div>';
      if (c.plan.note) h += '<div class="dim">' + esc(c.plan.note) + '</div>';
    } else {
      h += '<div class="dim">no plan — structure could not clear the ' + MIN_RR + 'R floor, so no levels are shown.</div>';
    }
    h += '<ul class="lst">';
    for (var i = 0; i < c.gates.length; i++) h += gateLine(c.gates[i]);
    h += '</ul>';
    h += '</div>';
    return h;
  }

  function renderMatrix(){
    var m = hgOmniCoverageMatrix(), h = '<table class="tbl"><thead><tr><th>SCHOOL</th><th>TEACHES</th><th>OURS</th><th>STILL MISSING</th></tr></thead><tbody>', i, r;
    for (i = 0; i < m.length; i++){
      r = m[i];
      h += '<tr><td><b>' + esc(r.school) + '</b></td><td class="dim">' + esc(r.taught) + '</td>'
        +  '<td>' + pill(r.verdict, r.verdict === 'COVERED' ? 'ok' : (r.verdict === 'GAP' ? 'bad' : ''))
        +  ' <span class="dim">' + r.have.length + '/' + (r.have.length + r.miss.length) + '</span></td>'
        +  '<td class="dim">' + (r.miss.length ? esc(r.miss.join(', ')) : '—') + '</td></tr>';
    }
    return h + '</tbody></table>';
  }

  function renderProposal(mapped, modelName){
    if (!mapped) return '<div class="empty">could not parse a strategy out of that source.</div>';
    var h = '<div class="panel-in"><h3>' + esc(mapped.name) + '</h3>';
    if (modelName) h += '<div class="note dim">extracted by ' + esc(modelName) + ' — the model’s reading of the source, not verified fact.</div>';
    h += '<table class="tbl"><tbody>';
    if (mapped.timeframe) h += '<tr><th>timeframe</th><td>' + esc(mapped.timeframe) + '</td></tr>';
    if (mapped.trigger) h += '<tr><th>trigger</th><td>' + esc(mapped.trigger) + '</td></tr>';
    if (mapped.filters.length) h += '<tr><th>filters</th><td>' + esc(mapped.filters.join(' · ')) + '</td></tr>';
    if (mapped.invalidation) h += '<tr><th>invalidation</th><td>' + esc(mapped.invalidation) + '</td></tr>';
    if (mapped.target) h += '<tr><th>target</th><td>' + esc(mapped.target) + '</td></tr>';
    h += '</tbody></table><h4>maps onto our gates</h4>';
    if (mapped.covered.length){
      h += '<ul class="lst">';
      for (var i = 0; i < mapped.covered.length; i++){
        h += '<li>' + pill('HAVE','ok') + ' ' + esc(mapped.covered[i].label) + ' <span class="dim">→ ' + esc(mapped.covered[i].tabs.join(', ')) + '</span></li>';
      }
      h += '</ul>';
    } else h += '<div class="empty">nothing here maps to an existing gate.</div>';
    if (mapped.gaps.length){
      h += '<h4>would need new gates</h4><ul class="lst">';
      for (var j = 0; j < mapped.gaps.length; j++) h += '<li>' + pill('BUILD','bad') + ' ' + esc(mapped.gaps[j]) + '</li>';
      h += '</ul>';
    }
    if (mapped.unknown.length) h += '<div class="note warn">off-vocabulary terms ignored: ' + esc(mapped.unknown.join(', ')) + '</div>';
    return h + '<div class="note">Research note. No rule becomes a gate until it is coded and backtested against our own data.</div></div>';
  }

  /* ==================== the scan ==================== */

  function runScan(ui){
    if (__omni.busy) return Promise.resolve();
    var W = (typeof window !== 'undefined') ? window : null;
    if (!W || typeof W.xuUniverse !== 'function' || typeof W.xuCandles !== 'function'){
      ui.stat.textContent = 'xuniverse.js unavailable — no venue universe, scan disabled.';
      return Promise.resolve();
    }
    __omni.busy = true;
    ui.btn.disabled = true;
    ui.cards.innerHTML = '';
    ui.stat.textContent = 'loading Delta + CoinDCX universe…';

    return W.xuUniverse().then(function(uni){
      uni = uni || [];
      if (!uni.length){
        ui.stat.textContent = 'universe empty — both venue legs failed.';
        return null;
      }
      var note = (typeof W.xuUniverseNote === 'function') ? W.xuUniverseNote() : null;
      if (note){ ui.warn.textContent = note; ui.warn.style.display = 'block'; }
      else { ui.warn.style.display = 'none'; }

      var list = uni.slice(0, TOP_N);
      var cands = [], done = 0;

      function step(i){
        if (i >= list.length) return Promise.resolve();
        var slice = list.slice(i, i + CHUNK);
        return Promise.all(slice.map(function(item){
          return W.xuCandles(item, TF, BARS).then(function(rows){
            done++;
            ui.stat.textContent = 'scanning ' + done + '/' + list.length + ' — ' + cands.length + ' setup(s) so far';
            if (!rows || rows.length < 30) return;
            var pos = null;
            if (typeof W.xuPositioning === 'function'){
              try { pos = W.xuPositioning(item.base || item.sym); } catch (e) { pos = null; }
            }
            var found = hgOmniEvaluate(item, rows, pos);
            for (var k = 0; k < found.length; k++) cands.push(found[k]);
          }).catch(function(){ done++; });
        })).then(function(){ return step(i + CHUNK); });
      }

      return step(0).then(function(){ return { cands: cands, scanned: list.length, uni: uni.length }; });
    }).then(function(res){
      if (!res) return;
      var ranked = hgOmniRank(res.cands);
      __omni.snap = { at: Date.now(), scanned: res.scanned, uni: res.uni, rows: ranked };
      __omni.ran = true;
      var tickets = 0, i;
      for (i = 0; i < ranked.length; i++) if (ranked[i].grade.ticket) tickets++;
      __omni.lastStat = ranked.length + ' setup(s) · ' + tickets + ' ticket(s) · scanned ' + res.scanned + '/' + res.uni;
      ui.stat.textContent = __omni.lastStat +
        (res.uni > res.scanned ? '  (capped at top ' + TOP_N + ' by turnover — the rest were NOT scanned)' : '');
      if (!ranked.length){
        ui.cards.innerHTML = '<div class="empty">no setup fired on the scanned names. That is a normal result — the detectors are meant to be quiet.</div>';
        return;
      }
      var h = '';
      for (i = 0; i < ranked.length; i++) h += setupCard(ranked[i]);
      ui.cards.innerHTML = h;
    }).catch(function(){
      ui.stat.textContent = 'scan failed.';
    }).then(function(){
      __omni.busy = false;
      ui.btn.disabled = false;
    });
  }

  function readCfgFromUi(ui){
    return {
      endpoint: ui.ep ? String(ui.ep.value || '').trim() : DEFAULT_ENDPOINT,
      token: ui.tok ? String(ui.tok.value || '').trim() : '',
      model: ui.model ? String(ui.model.value || '').trim() : DEFAULT_MODEL
    };
  }

  function runIngest(ui){
    if (__omni.busy) return Promise.resolve();
    var cfg = readCfgFromUi(ui);
    var kind = ui.kind ? ui.kind.value : 'paste';
    var src = ui.src ? String(ui.src.value || '').trim() : '';
    if (!src){ ui.istat.textContent = 'nothing to analyse.'; return Promise.resolve(); }
    __omni.busy = true;
    ui.irun.disabled = true;
    ui.istat.textContent = 'asking the gateway…';
    ui.iout.innerHTML = '';
    hgOmniSaveCfg(cfg);
    return hgOmniComplete(cfg, hgOmniBuildPrompt(src, kind), function(why){
      ui.istat.textContent = 'provider missed (' + why + ') — retrying once…';
    }).then(function(r){
      if (!r.ok){
        ui.istat.textContent = 'gateway error: ' + r.msg;
        ui.iout.innerHTML = '<div class="note warn">The scanner above is unaffected — it never uses the gateway. '
          + 'Ingest needs OmniRoute reachable from this browser; on the deployed site it never will be.</div>';
        return;
      }
      var mapped = hgOmniMapRules(hgOmniParseModelJson(r.text));
      if (!mapped){
        ui.istat.textContent = 'model did not return usable JSON.';
        ui.iout.innerHTML = '<pre class="pre">' + esc(String(r.text).slice(0, 1500)) + '</pre>';
        return;
      }
      ui.istat.textContent = 'done — ' + mapped.verdict;
      ui.iout.innerHTML = renderProposal(mapped, r.model);
    }).catch(function(){
      ui.istat.textContent = 'ingest failed.';
    }).then(function(){
      __omni.busy = false;
      ui.irun.disabled = false;
    });
  }

  /* ==================== mount / refresh ==================== */

  function mountOmniroute(el){
    if (!el) return;
    var cfg = hgOmniLoadCfg();

    el.innerHTML =
      '<div class="panel">'
      + '<h2>OmniRoute — desk setups <span>delta + coindcx · spring · po3 · orb · absorption · value area · measured move</span></h2>'
      + '<div class="note" style="margin-bottom:10px">Scans the Delta India + CoinDCX universe with the six mechanics the popular desks trade '
      + 'but our other tabs could not express. Every candidate runs a hard-gate ledger (trend · vol-alive · participation · funding); '
      + '<b>a single veto stands it aside</b> — vetoed cards still render so you can see WHY. Levels come from the house plan engine with a '
      + MIN_RR + 'R floor, and cards are ordered by R:R. '
      + 'Ordering by R:R is a fact about geometry, <b>not</b> a profitability forecast — none of these gates has been walk-forward tested here.</div>'
      + '<div class="row"><button class="btn" id="omniRun">RUN SETUP SCAN</button></div>'
      + '<div class="note" id="omniStat">idle — press RUN.</div>'
      + '<div class="note warn" id="omniWarn" style="display:none"></div>'
      + '<div class="cards" id="omniCards" style="margin-top:12px"></div>'

      + '<hr class="sep">'
      + '<h3>coverage — what the desks teach vs what we can express</h3>'
      + '<div id="omniMatrix">' + renderMatrix() + '</div>'

      + '<hr class="sep">'
      + '<h3>ingest a source <span class="dim">(optional · needs the local OmniRoute gateway)</span></h3>'
      + '<div class="row" style="gap:8px;flex-wrap:wrap">'
      +   '<label class="f">GATEWAY<input id="omniEp" type="text" size="24" value="' + esc(cfg.endpoint) + '"></label>'
      +   '<label class="f">TOKEN<input id="omniTok" type="password" size="16" value="' + esc(cfg.token) + '" placeholder="oma_live_…"></label>'
      +   '<label class="f">MODEL<input id="omniModel" type="text" size="14" value="' + esc(cfg.model) + '"></label>'
      +   '<button class="btn" id="omniPing">PING</button>'
      + '</div>'
      + '<div class="note" id="omniPingStat">gateway not tested yet.</div>'
      + '<div class="row" style="gap:8px;margin-top:8px">'
      +   '<label class="f">SOURCE<select id="omniKind">'
      +     '<option value="paste">pasted text</option><option value="search">search query</option>'
      +   '</select></label><button class="btn" id="omniIngest">ANALYSE</button>'
      + '</div>'
      + '<textarea id="omniSrc" rows="5" style="width:100%;margin-top:8px" placeholder="Paste a transcript, article or README — or switch to search."></textarea>'
      + '<div class="note" id="omniIStat">idle.</div>'
      + '<div id="omniIOut" style="margin-top:10px"></div>'
      + '</div>';

    var ui = {
      btn: el.querySelector('#omniRun'), stat: el.querySelector('#omniStat'),
      warn: el.querySelector('#omniWarn'), cards: el.querySelector('#omniCards'),
      matrix: el.querySelector('#omniMatrix'),
      ep: el.querySelector('#omniEp'), tok: el.querySelector('#omniTok'),
      model: el.querySelector('#omniModel'), ping: el.querySelector('#omniPing'),
      pingStat: el.querySelector('#omniPingStat'), kind: el.querySelector('#omniKind'),
      src: el.querySelector('#omniSrc'), irun: el.querySelector('#omniIngest'),
      istat: el.querySelector('#omniIStat'), iout: el.querySelector('#omniIOut')
    };
    if (!ui.btn || !ui.stat || !ui.cards) return;
    __omni.ui = ui;

    var W = (typeof window !== 'undefined') ? window : null;
    var missing = [];
    if (typeof fetch !== 'function') missing.push('fetch');
    if (!W || typeof W.xuUniverse !== 'function') missing.push('xuUniverse');
    if (!W || typeof W.xuCandles !== 'function') missing.push('xuCandles');
    if (!W || typeof W.hgPlanLevels !== 'function') missing.push('hgPlanLevels (no entry/stop/target levels)');
    if (missing.length){
      ui.warn.textContent = 'missing globals: ' + missing.join(', ') + ' — the scan degrades honestly where it can.';
      ui.warn.style.display = 'block';
    }
    if (!W || typeof W.xuUniverse !== 'function' || typeof W.xuCandles !== 'function'){
      ui.btn.disabled = true;      // hard dependency: no universe, no setups
    } else {
      ui.btn.addEventListener('click', function(){ return runScan(ui); });
    }

    if (ui.ping && typeof fetch === 'function'){
      ui.ping.addEventListener('click', function(){
        var c = readCfgFromUi(ui); hgOmniSaveCfg(c);
        ui.pingStat.textContent = 'pinging…';
        return hgOmniPing(c).then(function(p){
          ui.pingStat.textContent = p.msg;
          ui.pingStat.className = p.ok ? 'note' : 'note warn';
        });
      });
    }
    if (ui.irun && typeof fetch === 'function'){
      ui.irun.addEventListener('click', function(){ return runIngest(ui); });
    } else if (ui.irun) ui.irun.disabled = true;
  }

  /* House contract: async, never throws, terse status. Never launches a
     first-time universe sweep on a global refresh. */
  function refreshOmniroute(){
    return Promise.resolve().then(function(){
      if (__omni.busy) return 'busy';
      if (!__omni.ran) return 'skipped: not run yet';
      var ui = __omni.ui;
      if (ui) return runScan(ui).then(function(){ return __omni.lastStat || 'rescanned'; });
      return __omni.lastStat || 'no ui mounted';
    }).catch(function(){ return 'refresh failed'; });
  }

  /* ============================ exports ============================ */
  if (typeof window !== 'undefined'){
    /* pure detectors + graders — unit-testable, no globals touched */
    window.hgOmniRange = hgOmniRange;
    window.hgOmniSpring = hgOmniSpring;
    window.hgOmniPo3 = hgOmniPo3;
    window.hgOmniOrb = hgOmniOrb;
    window.hgOmniAbsorb = hgOmniAbsorb;
    window.hgOmniProfile = hgOmniProfile;
    window.hgOmniValueReject = hgOmniValueReject;
    window.hgOmniMeasuredMove = hgOmniMeasuredMove;
    window.hgOmniDetect = hgOmniDetect;
    window.hgOmniGates = hgOmniGates;
    window.hgOmniGrade = hgOmniGrade;
    window.hgOmniEvaluate = hgOmniEvaluate;
    window.hgOmniRank = hgOmniRank;
    /* research half */
    window.hgOmniGateInventory = hgOmniGateInventory;
    window.hgOmniRoster = hgOmniRoster;
    window.hgOmniCoverage = hgOmniCoverage;
    window.hgOmniCoverageMatrix = hgOmniCoverageMatrix;
    window.hgOmniGaps = hgOmniGaps;
    window.hgOmniVocabulary = hgOmniVocabulary;
    window.hgOmniBuildPrompt = hgOmniBuildPrompt;
    window.hgOmniParseModelJson = hgOmniParseModelJson;
    window.hgOmniMapRules = hgOmniMapRules;
    window.hgOmniState = function hgOmniState(){
      try { return __omni.snap ? JSON.parse(JSON.stringify(__omni.snap)) : null; } catch (e) { return null; }
    };
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push({ id:'omniroute', label:'OMNIROUTE', mount: mountOmniroute, refresh: refreshOmniroute });
  }

})();
