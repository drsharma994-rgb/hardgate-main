/* =========================================================================
HARDGATE — omnigold.js
OMNIGOLD — gold desk setups, SCALP and SWING, on the OmniRoute engine.

WHAT THIS IS. OMNIROUTE's method (mechanical detectors → hard-gate ledger →
walk-forward self-measurement → evidence coverage) pointed at XAUUSD, with
the mechanics gold desks actually trade added on top. It answers one
question per horizon: "is there a gold setup right now whose geometry and
evidence both hold up, and has this mechanic ever paid?"

BUILT ON OMNIROUTE, NOT COPIED FROM IT. The detectors, walk-forward,
pooling, plan derivation, grading and ranking are consumed from
omniroute.js's exports (all feature-checked). A fix there — the isFinite(null)
trap, the stale-risk R:R, the forming-bar rule, the significance test —
lands here automatically. Duplicating that engine would have meant
duplicating its bugs.

TWO HORIZONS, MEASURED SEPARATELY.
  SCALP  1h bars. Session-driven: Asia range, London/NY killzones, ADR
         budget. Tighter R floor.
  SWING  4h bars, daily context. Structure and macro driven.
A mechanic that pays on the swing horizon need not pay intraday, so the two
pools are measured and reported apart — never merged into one flattering
number.

GOLD-SPECIFIC MECHANICS (added to OmniRoute's six):
  ASIA-BREAK   Asia-session range, then a London break holding beyond it —
               the most widely taught gold intraday setup there is.
  KZ-JUDAS     Asia range swept during a killzone, then reclaimed: the
               stop-run before the real move (ICT's gold variant).
  ADR-FADE     Day has already spent its average daily range and is pressing
               the extreme — fade the exhaustion.
  ROUND-MAGNET Gold respects round dollars far more than alts do; a rejection
               wick at a $10/$25/$50/$100 level with a close back inside.

GOLD GATE LEDGER (deliberately NOT the crypto one — perp gates do not
exist here; there is no funding, OI, retail ratio or taker flow on spot
gold, and pretending otherwise would fabricate confluence):
  HARD          trend (family-aware), vol-alive
  CONDITIONAL   htf-daily · session/killzone · macro real-rate · DXY
                alignment · yield guard · ADR budget · news window ·
                participation · measured-edge
Participation is CONDITIONAL here, unlike OmniRoute: several gold feeds
publish no volume at all, and a hard volume gate would silently disqualify
every setup sourced from them.

DATA. The app's existing gold chain, in order and all feature-checked:
getXmGoldCandles (XM MT5 bridge) → getGoldCandles (spot proxy) →
binanceKlines('PAXGUSDT') as the last resort. Whichever answers is named on
screen, because a PAXG-derived setup is not the same instrument as XAUUSD
spot and the difference belongs in front of the user, not buried.

ON EDGE. Same discipline as OMNIROUTE: cards are ordered by evidence
coverage, the measured-edge gate vetoes a mechanic whose own history is
significantly below breakeven, and nothing here is a profit forecast. Gold
trends differently from alts — the measurement will say whether these
mechanics pay on YOUR feed, and that answer is the only edge claim made.

Classic script, IIFE. Never throws at load; every global is feature-checked;
every fetch carries a timeout. refresh() is async, never throws, returns a
terse status, and never launches a first-time scan on a global refresh.
========================================================================= */
'use strict';

(function(){

  var LS_KEY = 'hg_omnigold_v1';

  /* Horizon shapes. Bar counts are deliberately much larger than OmniRoute's. That scan
     pools its walk-forward across ~500 contracts; gold is ONE instrument, so
     the only way to reach a sample count worth reading is depth of history.
     At 180x4h the first live run returned 5-12 samples per mechanic on the
     swing horizon — every row read "too few to judge", which is an honest
     report of a useless measurement. Deeper history also makes the daily
     resample possible on the scalp horizon (1000x1h ~ 41 days, where 320x1h
     was 13 days and could not fill a 21-period daily EMA).
     minAtrPct is per-horizon because ATR% scales with the square root of bar
     length: holding 1h bars to a 4h threshold vetoed live setups as "too
     dead" that were merely intraday. */
  /* 1500 is the ceiling the data layer can actually deliver: getGoldCandles
     accepts up to 5000 but delegates to binanceKlines, which caps a single
     request at 1500 and offers no pagination. Taking all of it is free and
     it is the only lever left on sample count — 1500x1h is ~62 days,
     1500x4h ~250 days. The swing horizon gains most (3x), which is where
     nearly every row read "too few to judge". */
  var HORIZONS = {
    scalp: { tf: '1h', bars: 1500, minRr: 1.5, horizonBars: 24, warm: 60, label: 'SCALP',
             minAtrPct: 0.05, sessionHard: true },
    swing: { tf: '4h', bars: 1500, minRr: 2.0, horizonBars: 20, warm: 45, label: 'SWING',
             minAtrPct: 0.12, sessionHard: false }
  };

  /* Assumed round-trip transaction cost in DOLLARS per ounce, used only to
     express what a stop distance costs to trade. Gold retail spreads run
     roughly $0.20-0.50 and widen off-hours; $0.30 is a middling, not a
     generous, assumption. This is the difference between a measured edge and
     a tradeable one: the walk-forward is GROSS, and on a 3-point scalp stop
     a $0.30 spread is ~19% of 1R. */
  var ASSUMED_SPREAD_USD = 0.30;
  var COST_WARN_R = 0.15;   // cost above this share of 1R is worth flagging
  var COST_VETO_R = 0.30;   // above this the edge is mostly paying the spread

  var FWD_MIN_JUDGE = 20;   // settled out-of-sample trades before it can conclude
  var MIN_SAMPLES = 20;
  var EDGE_VETO_Z = -2;
  var EDGE_VETO_SAMPLES = 30;
  var DAILY_FAST = 10, DAILY_SLOW = 21;
  var REVERSION_KINDS = { SPRING:true, UTAD:true, VALUE:true, ABSORB:true, 'ADR-FADE':true, 'ROUND-MAGNET':true, 'KZ-JUDAS':true };

  /* Every mechanic this desk scans. ONE list: renderPooled shows these, and
     the measured-edge gate divides its significance threshold by this many,
     so the multiple-comparisons correction can never drift out of step with
     the number of mechanics actually being tried. Adding a detector without
     adding it here would understate the correction. */
  var OG_MECHANICS = ['SPRING','PO3','ORB','ABSORB','VALUE','MMOVE',
                      'ASIA-BREAK','KZ-JUDAS','ADR-FADE','ROUND-MAGNET',
                      'PDH-SWEEP','PDL-SWEEP','LONDON-FIX','VWAP-REVERT','NR7-BREAK',
                      'SMT-DIVERGE','TREND-RECLAIM',
                      'PWH-SWEEP','PWL-SWEEP','FVG-FILL','BOS-RETEST','EQH-SWEEP','EQL-SWEEP',
                      'SQUEEZE-FIRE','RSI-DIVERGE','GSR-EXTREME','AVWAP-RECLAIM',
                      'CUSUM-SHIFT','VOL-EXPANSION','PIN-REJECT','ENGULF-LEVEL',
                      'POC-REVERT','COINT-SPREAD','THREE-BAR'];

  var __og = { ui: null, busy: false, ran: false, snap: null, lastStat: '', src: null };

  function W(){ return (typeof window !== 'undefined') ? window : null; }
  function gfn(name){
    var w = W();
    return (w && typeof w[name] === 'function') ? w[name] : null;
  }
  function num(v){ var n = +v; return isFinite(n) ? n : NaN; }
  /* null/undefined/'' -> NaN. isFinite(null) is TRUE in JS; see omniroute. */
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }

  /* ==================== gold-specific pure detectors ==================== */

  /* Asia session = 23:00-07:00 UTC (Tokyo through pre-London). Returns the
     range of the CURRENT day's Asia session from the bar-open seconds the
     app's candle contract guarantees. Pure. */
  function hgOgAsiaRange(rows, nowSec){
    if (!rows || rows.length < 6) return null;
    var last = num(rows[rows.length - 1].t);
    if (!isFinite(last)) return null;
    var refN = fin(nowSec);                       /* NOT isFinite(nowSec): null passes it */
    var ref = isFinite(refN) ? refN : last;
    var dayStart = Math.floor(ref / 86400) * 86400;
    var hi = -Infinity, lo = Infinity, n = 0, i, t, h, l, hr;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t)) continue;
      hr = ((t % 86400) / 3600);
      /* Asia wraps midnight: 23:00-24:00 of the prior day plus 00:00-07:00 */
      var inAsia = (hr >= 23) || (hr < 7);
      var sameWindow = (t >= dayStart - 3600) && (t <= dayStart + 7 * 3600);
      if (!inAsia || !sameWindow) continue;
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
      n++;
    }
    if (n < 3 || !isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    return { hi: hi, lo: lo, height: hi - lo, bars: n };
  }

  /* ASIA-BREAK: last bar closes beyond the Asia range and holds. Pure. */
  function hgOgAsiaBreak(rows, asia){
    if (!rows || !rows.length || !asia) return null;
    var last = rows[rows.length - 1];
    var c = num(last.c), o = num(last.o);
    if (!isFinite(c) || !isFinite(o)) return null;
    if (c > asia.hi && o <= asia.hi){
      return { kind:'ASIA-BREAK', dir:'long', level: asia.hi,
               why:'closed above the Asia range high ' + asia.hi.toFixed(2) };
    }
    if (c < asia.lo && o >= asia.lo){
      return { kind:'ASIA-BREAK', dir:'short', level: asia.lo,
               why:'closed below the Asia range low ' + asia.lo.toFixed(2) };
    }
    return null;
  }

  /* KZ-JUDAS: the Asia range is swept and RECLAIMED inside a killzone — the
     stop-run before the real move. Requires goldKillzone for the session
     read; without it the setup is not claimed rather than guessed. Pure
     given the killzone function. */
  function hgOgKzJudas(rows, asia, kzFn){
    if (!rows || rows.length < 3 || !asia || typeof kzFn !== 'function') return null;
    var last = rows[rows.length - 1];
    var t = num(last.t), h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(t) || !isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var kz = null;
    try { kz = kzFn(t * 1000); } catch (e) { return null; }
    if (!kz || !kz.zone || kz.zone === 'OFF') return null;
    if (l < asia.lo && c > asia.lo){
      return { kind:'KZ-JUDAS', dir:'long', level: asia.lo, zone: kz.zone,
               why:'swept Asia low in the ' + kz.zone + ' killzone and reclaimed' };
    }
    if (h > asia.hi && c < asia.hi){
      return { kind:'KZ-JUDAS', dir:'short', level: asia.hi, zone: kz.zone,
               why:'swept Asia high in the ' + kz.zone + ' killzone and rejected' };
    }
    return null;
  }

  /* Average daily range over the last n complete days, from intraday rows. */
  function hgOgAdr(rows, days){
    if (!rows || rows.length < 24) return null;
    var byDay = {}, i, t, d, h, l;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t); h = num(rows[i].h); l = num(rows[i].l);
      if (!isFinite(t) || !isFinite(h) || !isFinite(l)) continue;
      d = Math.floor(t / 86400);
      if (!byDay[d]) byDay[d] = { hi: h, lo: l };
      else { if (h > byDay[d].hi) byDay[d].hi = h; if (l < byDay[d].lo) byDay[d].lo = l; }
    }
    var keys = Object.keys(byDay).sort();
    if (keys.length < 3) return null;
    var take = keys.slice(-(days || 14) - 1, -1);   // exclude today (incomplete)
    if (!take.length) return null;
    var sum = 0, n = 0;
    for (i = 0; i < take.length; i++){
      var r = byDay[take[i]].hi - byDay[take[i]].lo;
      if (isFinite(r) && r > 0){ sum += r; n++; }
    }
    if (!n) return null;
    var today = byDay[keys[keys.length - 1]];
    var todayRange = today ? (today.hi - today.lo) : NaN;
    var adr = sum / n;
    return { adr: adr, todayRange: todayRange, usedPct: isFinite(todayRange) ? (todayRange / adr * 100) : NaN,
             todayHi: today ? today.hi : NaN, todayLo: today ? today.lo : NaN };
  }

  /* ADR-FADE: the day has already spent >=100% of its average range and is
     pressing the extreme — fade toward the mean. Pure. */
  function hgOgAdrFade(rows, adr){
    if (!rows || !rows.length || !adr || !isFinite(adr.usedPct)) return null;
    if (adr.usedPct < 100) return null;
    var last = rows[rows.length - 1];
    var c = num(last.c);
    if (!isFinite(c) || !isFinite(adr.todayHi) || !isFinite(adr.todayLo)) return null;
    var span = adr.todayHi - adr.todayLo;
    if (!(span > 0)) return null;
    var pos = (c - adr.todayLo) / span;      // 0 = at the low, 1 = at the high
    if (pos >= 0.85){
      return { kind:'ADR-FADE', dir:'short', level: adr.todayHi,
               why:'day has used ' + adr.usedPct.toFixed(0) + '% of ADR and is at the high' };
    }
    if (pos <= 0.15){
      return { kind:'ADR-FADE', dir:'long', level: adr.todayLo,
               why:'day has used ' + adr.usedPct.toFixed(0) + '% of ADR and is at the low' };
    }
    return null;
  }

  /* ROUND-MAGNET: gold respects round dollars far more than alts. A wick
     through a $10/$25/$50/$100 level with the close back inside. Pure. */
  function hgOgRoundMagnet(rows){
    if (!rows || rows.length < 20) return null;
    var last = rows[rows.length - 1];
    var h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var steps = [100, 50, 25, 10], i, s, lvl;
    /* the wick must be a real rejection, not a rounding artefact */
    var atrLike = 0, n = 0, j;
    for (j = Math.max(1, rows.length - 15); j < rows.length; j++){
      var hh = num(rows[j].h), ll = num(rows[j].l);
      if (isFinite(hh) && isFinite(ll)){ atrLike += (hh - ll); n++; }
    }
    if (!n) return null;
    atrLike /= n;
    if (!(atrLike > 0)) return null;
    for (i = 0; i < steps.length; i++){
      s = steps[i];
      lvl = Math.round(c / s) * s;
      if (!isFinite(lvl) || lvl <= 0) continue;
      var pierceUp = h - lvl, pierceDn = lvl - l;
      if (h > lvl && c < lvl && pierceUp >= atrLike * 0.15){
        return { kind:'ROUND-MAGNET', dir:'short', level: lvl,
                 why:'rejected the $' + lvl.toFixed(0) + ' round level from above' };
      }
      if (l < lvl && c > lvl && pierceDn >= atrLike * 0.15){
        return { kind:'ROUND-MAGNET', dir:'long', level: lvl,
                 why:'reclaimed the $' + lvl.toFixed(0) + ' round level from below' };
      }
    }
    return null;
  }

  /* Every detector for a horizon: OmniRoute's six (consumed from its
     exports, so its fixes land here) plus the four gold mechanics. Pure
     given the injected omniroute functions. */
  function hgOgDetect(rows, opts){
    var out = [], w = W(), d;
    if (!rows || rows.length < 40) return out;
    opts = opts || {};

    /* --- shared mechanics, borrowed from the omniroute engine --- */
    if (w && typeof w.hgOmniDetect === 'function'){
      try {
        var shared = w.hgOmniDetect(rows) || [];
        for (var i = 0; i < shared.length; i++) out.push(shared[i]);
      } catch (e) { /* engine absent or unhappy — gold mechanics still run */ }
    }

    /* --- gold-specific mechanics --- */
    var asia = hgOgAsiaRange(rows, opts.nowSec);
    if (asia){
      d = hgOgAsiaBreak(rows, asia); if (d) out.push(d);
      d = hgOgKzJudas(rows, asia, opts.kzFn || gfn('goldKillzone')); if (d) out.push(d);
    }
    var adr = hgOgAdr(rows, 14);
    if (adr){ d = hgOgAdrFade(rows, adr); if (d) out.push(d); }
    d = hgOgRoundMagnet(rows); if (d) out.push(d);
    /* --- added mechanics: each also registered in the backtest map and the
       pooled key list, so none of them can produce setups without a
       measurable record --- */
    var pd = hgOgPrevDay(rows, opts.nowSec);
    if (pd){ d = hgOgPdSweep(rows, pd); if (d) out.push(d); }
    d = hgOgLondonFix(rows);     if (d) out.push(d);
    d = hgOgVwapRevert(rows);    if (d) out.push(d);
    d = hgOgNr7Break(rows);      if (d) out.push(d);
    d = hgOgSmtDiverge(rows);    if (d) out.push(d);
    d = hgOgTrendReclaim(rows);  if (d) out.push(d);

    /* second round */
    var pw = hgOgPrevWeek(rows, opts.nowSec);
    if (pw){ d = hgOgPwSweep(rows, pw); if (d) out.push(d); }
    d = hgOgFvgFill(rows);       if (d) out.push(d);
    d = hgOgBosRetest(rows);     if (d) out.push(d);
    d = hgOgPoolSweep(rows);     if (d) out.push(d);
    d = hgOgSqueezeFire(rows);   if (d) out.push(d);
    d = hgOgRsiDiverge(rows);    if (d) out.push(d);
    d = hgOgGsrExtreme(rows);    if (d) out.push(d);
    d = hgOgAvwapReclaim(rows);  if (d) out.push(d);

    /* round four */
    d = hgOgCusumShift(rows);    if (d) out.push(d);
    d = hgOgVolExpansion(rows);  if (d) out.push(d);
    d = hgOgPinReject(rows);     if (d) out.push(d);
    d = hgOgEngulfLevel(rows);   if (d) out.push(d);
    d = hgOgPocRevert(rows);     if (d) out.push(d);
    d = hgOgCointSpread(rows);   if (d) out.push(d);
    d = hgOgThreeBar(rows);      if (d) out.push(d);
    return out;
  }


  /* ==================== additional gold mechanics ====================

     Each of these is a mechanic a gold desk actually trades, and each is
     registered in THREE places: the live detect pass, the walk-forward
     backtest map, and the pooled-results key list. That wiring is the point.
     A detector added only to the scan would produce setups with no in-sample
     history and no out-of-sample record — a strategy that can never be judged
     is worse than no strategy, because it still costs money.

     Every one starts at zero samples. Their measured-edge gate reads "not yet
     measured" until their own record says otherwise, and the forward log
     scores each separately from the first firing. None is assumed to work. */

  /* The prior day high/low — the liquidity gold reaches for most reliably.
     Distinct from ASIA-BREAK, which uses the Asian session box rather than
     the whole previous day. */
  function hgOgPrevDay(rows, nowSec){
    if (!rows || rows.length < 24) return null;
    var last = num(rows[rows.length - 1].t);
    if (!isFinite(last)) return null;
    var refN = fin(nowSec);                       /* NOT isFinite(nowSec): null passes it */
    var ref = isFinite(refN) ? refN : last;
    var dayStart = Math.floor(ref / 86400) * 86400;
    var prevStart = dayStart - 86400;
    var hi = -Infinity, lo = Infinity, n = 0, i, t, h, l;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t < prevStart || t >= dayStart) continue;
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
      n++;
    }
    if (n < 6 || !isFinite(hi) || !isFinite(lo) || !(hi > lo)) return null;
    return { pdh: hi, pdl: lo, bars: n };
  }

  function hgOgPdSweep(rows, pd){
    if (!rows || !pd || rows.length < 4) return null;
    var last = rows[rows.length - 1];
    var h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var rng = h - l;
    if (!(rng > 0)) return null;
    /* swept the level then closed back inside it — a failed continuation */
    if (h > pd.pdh && c < pd.pdh && (h - pd.pdh) >= rng * 0.2){
      return { kind:'PDH-SWEEP', dir:'short', level: pd.pdh,
               why:'swept the prior day high ' + pd.pdh.toFixed(2) + ' and closed back below it' };
    }
    if (l < pd.pdl && c > pd.pdl && (pd.pdl - l) >= rng * 0.2){
      return { kind:'PDL-SWEEP', dir:'long', level: pd.pdl,
               why:'swept the prior day low ' + pd.pdl.toFixed(2) + ' and reclaimed it' };
    }
    return null;
  }

  /* The London PM fix at 15:00 is a scheduled, documented gold flow. Taken as
     a decisive drive through the fix hour rather than a fade of it. */
  function hgOgLondonFix(rows){
    if (!rows || rows.length < 6) return null;
    var last = rows[rows.length - 1];
    var t = num(last.t);
    if (!isFinite(t)) return null;
    var hr = Math.floor((t % 86400) / 3600);
    if (hr !== 15 && hr !== 16) return null;
    var c = num(last.c), o = num(last.o), h = num(last.h), l = num(last.l);
    if (!isFinite(c) || !isFinite(o) || !isFinite(h) || !isFinite(l)) return null;
    var rng = h - l;
    if (!(rng > 0)) return null;
    if (Math.abs(c - o) < rng * 0.5) return null;      /* needs a decisive body */
    var pc = num(rows[rows.length - 2] && rows[rows.length - 2].c);
    if (!isFinite(pc)) return null;
    if (c > o && c > pc){
      return { kind:'LONDON-FIX', dir:'long', level: c,
               why:'decisive up bar through the ' + hr + ':00 London fix window' };
    }
    if (c < o && c < pc){
      return { kind:'LONDON-FIX', dir:'short', level: c,
               why:'decisive down bar through the ' + hr + ':00 London fix window' };
    }
    return null;
  }

  /* Session VWAP stretch and reversion. Uses the shared vwapAt when present
     so this cannot drift from the rest of the app.s VWAP. */
  /* ---- the instrument-agnostic mechanics now live in hg-mechanics.js ----

     Not one of these sixteen knew anything about gold: every threshold was in
     ATR or in percent, so they read a BTC 4h chart as well as an XAUUSD 1h
     one. OMNIROUTE wanted them, and copying would have doubled the
     maintenance surface and guaranteed the two copies drift — the app already
     carries ~300 lines of exactly that between the gold desks.

     They are thin delegations rather than deletions so that every call site,
     every export and every test keeps its existing name. Feature-checked: a
     missing hg-mechanics.js means those mechanics stop firing, which is
     visible in the pooled table, rather than a thrown scan. */

  function hgOgVwapRevert(rows){ var f = gfn('hgMechVwapRevert'); return f ? f(rows) : null; }

  /* NR7 — the narrowest range of seven bars, then expansion out of it.
     Compression precedes expansion; direction is taken from the break. */
  function hgOgNr7Break(rows){ var f = gfn('hgMechNr7Break'); return f ? f(rows) : null; }

  /* Gold against silver. Real desks watch the pair; macro-feeds.js already
     fetches the silver series. With no silver this returns null rather than
     guessing — a mechanic that cannot see its second leg has no signal. */
  function hgOgSmtDiverge(rows){
    if (!rows || rows.length < 20) return null;
    var w = W();
    var xag = w && w.__hgXagCandles;
    if (!xag || xag.length < 20) return null;
    function legs(src){
      var n = src.length - 1;
      return { last: num(src[n].c), prior: num(src[n - 10] && src[n - 10].c) };
    }
    var g = legs(rows), s = legs(xag);
    if (!isFinite(g.last) || !isFinite(g.prior) || !isFinite(s.last) || !isFinite(s.prior)) return null;
    var gUp = g.last > g.prior, sUp = s.last > s.prior;
    if (gUp === sUp) return null;                      /* aligned — no divergence */
    var gMove = Math.abs(g.last - g.prior) / Math.max(1e-9, Math.abs(g.prior));
    var sMove = Math.abs(s.last - s.prior) / Math.max(1e-9, Math.abs(s.prior));
    if (gMove < 0.002 || sMove < 0.002) return null;   /* both legs must have moved */
    return { kind:'SMT-DIVERGE', dir: gUp ? 'short' : 'long', level: g.last,
             why:'gold ' + (gUp ? 'up' : 'down') + ' while silver ' + (sUp ? 'up' : 'down')
                 + ' over 10 bars — the metals disagree' };
  }

  /* Trend reclaim: an established stack, a pullback through the fast EMA, and
     a close back the right side of it. The continuation counterpart to the
     reversion mechanics above. */
  function hgOgTrendReclaim(rows){ var f = gfn('hgMechTrendReclaim'); return f ? f(rows) : null; }


  /* ============ second round of gold mechanics ============

     Same rule as the first round: every kind is registered in the live detect
     pass, the walk-forward backtest map and the pooled key list, so it earns
     an in-sample record and a forward record from its first firing and can be
     judged. None is assumed to work.

     These lean on the shared indicator library rather than re-deriving what
     it already computes. Every return shape below was checked against the
     real function output, not inferred from the name — the previous round
     wired two gates to shapes that did not exist (ichimokuState has no
     .state; donchian returns arrays, not scalars) and both read "unavailable"
     forever without ever throwing. */

  /* Fair value gap: a three-bar imbalance where the middle bar runs so hard
     that bar 1 and bar 3 do not overlap. Price returning into that gap is the
     rebalance. Pure — no library dependency. */
  function hgOgFvgFill(rows){ var f = gfn('hgMechFvgFill'); return f ? f(rows) : null; }

  /* Break of structure, then a retest of the level that broke. hgStructure
     returns { swings, lastBOS:{dir,level,i}, lastCHoCH, trend }. */
  function hgOgBosRetest(rows){ var f = gfn('hgMechBosRetest'); return f ? f(rows) : null; }

  /* Equal highs and lows are resting liquidity. findLiquidityPools returns
     { buySide:{level,count}|null, sellSide:{level,count}|null }. Fire on the
     sweep-and-reject of a pool, which is where the stops actually sat. */
  function hgOgPoolSweep(rows){ var f = gfn('hgMechPoolSweep'); return f ? f(rows) : null; }

  /* TTM squeeze release. ttmSqueeze returns { on:[], fired:[], momentum:[] }
     as parallel arrays; direction comes from the momentum sign at the fire. */
  function hgOgSqueezeFire(rows){ var f = gfn('hgMechSqueezeFire'); return f ? f(rows) : null; }

  /* Regular RSI divergence at a confirmed pivot: price makes the extreme, the
     oscillator does not. findPivots returns [{i,type:'high'|'low',v}]. */
  function hgOgRsiDiverge(rows){ var f = gfn('hgMechRsiDiverge'); return f ? f(rows) : null; }

  /* The prior WEEK high and low. A different pool from the prior day: weekly
     levels are where swing stops sit, and gold reaches for them on the
     Monday/Tuesday expansion. */
  function hgOgPrevWeek(rows, nowSec){
    if (!rows || rows.length < 48) return null;
    var last = num(rows[rows.length - 1].t);
    if (!isFinite(last)) return null;
    var refN = fin(nowSec);
    var ref = isFinite(refN) ? refN : last;
    /* Unix epoch was a Thursday; shift so weeks start Monday 00:00 UTC. */
    var wkStart = Math.floor((ref - 345600) / 604800) * 604800 + 345600;
    var prevStart = wkStart - 604800;
    var hi = -Infinity, lo = Infinity, n = 0, i, t, h, l;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t < prevStart || t >= wkStart) continue;
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
      n++;
    }
    if (n < 24 || !isFinite(hi) || !isFinite(lo) || !(hi > lo)) return null;
    return { pwh: hi, pwl: lo, bars: n };
  }

  function hgOgPwSweep(rows, pw){
    if (!rows || !pw || rows.length < 4) return null;
    var last = rows[rows.length - 1];
    var h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var rng = h - l;
    if (!(rng > 0)) return null;
    if (h > pw.pwh && c < pw.pwh && (h - pw.pwh) >= rng * 0.2){
      return { kind:'PWH-SWEEP', dir:'short', level: pw.pwh,
               why:'swept the prior week high ' + pw.pwh.toFixed(2) + ' and closed back below it' };
    }
    if (l < pw.pwl && c > pw.pwl && (pw.pwl - l) >= rng * 0.2){
      return { kind:'PWL-SWEEP', dir:'long', level: pw.pwl,
               why:'swept the prior week low ' + pw.pwl.toFixed(2) + ' and reclaimed it' };
    }
    return null;
  }

  /* Gold/silver ratio at an extreme. Distinct from SMT-DIVERGE, which reads
     the two legs disagreeing in DIRECTION; this reads the ratio itself
     stretched against its own recent distribution. */
  function hgOgGsrExtreme(rows){
    if (!rows || rows.length < 60) return null;
    var w = W();
    var xag = w && w.__hgXagCandles;
    if (!xag || xag.length < 60) return null;
    var zf = gfn('zscoreLast');
    if (!zf) return null;
    var m = Math.min(rows.length, xag.length);
    var ratio = [], i, g, s;
    for (i = 0; i < m; i++){
      g = num(rows[rows.length - m + i].c);
      s = num(xag[xag.length - m + i].c);
      if (!isFinite(g) || !isFinite(s) || !(s > 0)) continue;
      ratio.push(g / s);
    }
    if (ratio.length < 50) return null;
    var z;
    try { z = num(zf(ratio, 50)); } catch (e) { return null; }
    if (!isFinite(z)) return null;
    var c = num(rows[rows.length - 1].c);
    if (!isFinite(c)) return null;
    var gsr = ratio[ratio.length - 1];
    /* A stretched ratio mean-reverts through the gold leg as often as the
       silver leg, so this is a fade of the stretch, stated as such. */
    if (z >= 2){
      return { kind:'GSR-EXTREME', dir:'short', level: c,
               why:'gold/silver ratio ' + gsr.toFixed(1) + ' at +' + z.toFixed(1) + 'σ — gold stretched rich to silver' };
    }
    if (z <= -2){
      return { kind:'GSR-EXTREME', dir:'long', level: c,
               why:'gold/silver ratio ' + gsr.toFixed(1) + ' at ' + z.toFixed(1) + 'σ — gold stretched cheap to silver' };
    }
    return null;
  }

  /* Anchored VWAP from the last significant swing, reclaimed. hgAVWAP returns
     { value, upper, lower, stdev } measured from the anchor index forward. */
  function hgOgAvwapReclaim(rows){ var f = gfn('hgMechAvwapReclaim'); return f ? f(rows) : null; }



  /* ============ round four: robustness ============

     Twenty-seven mechanics already scan here. A fourth round of detectors
     alone would buy less than it costs: every added mechanic raises the
     multiple-comparisons bar for all of them and makes a two-sided tape more
     likely. So this round is weighted toward reads that make an existing
     setup more trustworthy — higher-timeframe agreement, regime fit and a
     volatility forecast — with the new mechanics chosen for being genuinely
     different in kind rather than for the count.

     Shapes below were probed against the real functions first, as always. */

  /* Resample to a coarser timeframe. The desk already holds 1500 bars, so the
     higher timeframe is built from what is in hand rather than fetched: no
     extra request, no second source to disagree with the first, and the two
     views are guaranteed to describe the same bars. */
  function hgOgResample(rows, factor){ var f = gfn('hgMechResample'); return f ? f(rows, factor) : null; }

  /* A CUSUM shift is a structural change in the mean, not a pattern: the
     series has genuinely moved to a new level. cusumLast returns
     { dir, barsAgo }. */
  function hgOgCusumShift(rows){ var f = gfn('hgMechCusumShift'); return f ? f(rows) : null; }

  /* Volatility breaking out of its own long-run level. hgVolFromCloses
     returns { sigmaNow, sigmaForecast, sigmaLongRun, ... }. Direction comes
     from the bar doing the expanding, not from the volatility itself. */
  function hgOgVolExpansion(rows){ var f = gfn('hgMechVolExpansion'); return f ? f(rows) : null; }

  /* A pin bar: most of the range is wick on one side, and the close is back
     in the body. The oldest reversal read there is, and pure. */
  function hgOgPinReject(rows){ var f = gfn('hgMechPinReject'); return f ? f(rows) : null; }

  /* An engulfing bar that also takes out the prior extreme: the reversal has
     to actually trade through the level, not merely close past it on a
     bigger body. */
  function hgOgEngulfLevel(rows){ var f = gfn('hgMechEngulfLevel'); return f ? f(rows) : null; }

  /* Price stretched away from the volume-profile point of control, which is
     where the most business was actually done. volumeProfile returns
     { poc, vah, val, bins }. */
  function hgOgPocRevert(rows){ var f = gfn('hgMechPocRevert'); return f ? f(rows) : null; }

  /* The cointegrated gold/silver residual at an extreme. Distinct from
     GSR-EXTREME, which reads the raw ratio: this reads the spread AFTER
     fitting the hedge ratio, and only when the pair is actually cointegrated
     — an uncointegrated spread has no mean to revert to, and trading it as
     though it did is the classic way to lose money on a pairs trade. */
  function hgOgCointSpread(rows){
    if (!rows || rows.length < 120) return null;
    var w = W();
    var xag = w && w.__hgXagCandles;
    if (!xag || xag.length < 120) return null;
    var f = gfn('hgCoint');
    if (!f) return null;
    var m = Math.min(rows.length, xag.length, 300);
    var a = [], b = [], i, ga, sa;
    for (i = 0; i < m; i++){
      ga = num(rows[rows.length - m + i].c);
      sa = num(xag[xag.length - m + i].c);
      if (!isFinite(ga) || !isFinite(sa)) continue;
      a.push(ga); b.push(sa);
    }
    if (a.length < 100 || a.length !== b.length) return null;
    var co;
    try { co = f(a, b); } catch (e) { return null; }
    if (!co || co.cointegrated !== true) return null;
    var z = num(co.spreadZ), hl = num(co.halfLifeBars);
    if (!isFinite(z) || Math.abs(z) < 2) return null;
    /* A half-life longer than the horizon means the reversion cannot land in
       time even if it is real. */
    if (isFinite(hl) && hl > 40) return null;
    var c = num(rows[rows.length - 1].c);
    if (!isFinite(c)) return null;
    return { kind:'COINT-SPREAD', dir: z > 0 ? 'short' : 'long', level: c,
             why:'gold/silver spread ' + (z >= 0 ? '+' : '') + z.toFixed(1)
                 + ' SD from its fitted mean, half-life ' + (isFinite(hl) ? hl.toFixed(0) + ' bars' : 'unknown') };
  }

  /* Three-bar reversal: a low (or high) with a higher (lower) bar either
     side, confirmed by the close. Structure, not indicator. */
  function hgOgThreeBar(rows){ var f = gfn('hgMechThreeBar'); return f ? f(rows) : null; }

  /* ==================== consensus across mechanics ====================

     THE DEFECT THIS EXISTS FOR: on 42% of tapes the desk graded a LONG
     ticket and a SHORT ticket at the same moment, on the same instrument and
     the same horizon, each with a clean ledger. The user is handed two
     contradictory trades and nothing on the card says which one the app
     believes. That is not a confidence problem, it is a correctness problem —
     and every mechanic added makes it more likely, not less.

     Nothing in the twelve-gate ledger ever asked the one question a desk asks
     first: is anything else firing, and does it agree?

     Counting raw agreeing mechanics would be the multiple-comparisons error
     in a different suit. PDH-SWEEP, PWH-SWEEP and EQH-SWEEP are three names
     for "liquidity taken from above and rejected" — they agree with each
     other by construction, not by evidence, and treating them as three
     independent confirmations manufactures confidence out of redundancy. So
     the vote is by FAMILY: mechanics that read the same thing about the tape
     count once between them. */

  var OG_FAMILY = {
    /* liquidity taken and rejected */
    'SPRING':'SWEEP', 'UTAD':'SWEEP', 'KZ-JUDAS':'SWEEP', 'ROUND-MAGNET':'SWEEP',
    'PDH-SWEEP':'SWEEP', 'PDL-SWEEP':'SWEEP', 'PWH-SWEEP':'SWEEP', 'PWL-SWEEP':'SWEEP',
    'EQH-SWEEP':'SWEEP', 'EQL-SWEEP':'SWEEP',
    /* the tape is going somewhere and this joins it */
    'ORB':'TREND', 'MMOVE':'TREND', 'PO3':'TREND', 'ASIA-BREAK':'TREND',
    'NR7-BREAK':'TREND', 'SQUEEZE-FIRE':'TREND', 'TREND-RECLAIM':'TREND',
    'BOS-RETEST':'TREND', 'LONDON-FIX':'TREND',
    /* price is stretched and this fades it */
    'VWAP-REVERT':'REVERSION', 'ADR-FADE':'REVERSION', 'VALUE':'REVERSION',
    'ABSORB':'REVERSION', 'RSI-DIVERGE':'REVERSION', 'AVWAP-RECLAIM':'REVERSION',
    /* an unfilled inefficiency */
    'FVG-FILL':'IMBALANCE',
    /* round four */
    'PIN-REJECT':'SWEEP', 'ENGULF-LEVEL':'SWEEP', 'THREE-BAR':'SWEEP',
    'POC-REVERT':'REVERSION', 'COINT-SPREAD':'INTERMARKET',
    'CUSUM-SHIFT':'TREND', 'VOL-EXPANSION':'TREND',
    /* the other metal disagrees with this one */
    'SMT-DIVERGE':'INTERMARKET', 'GSR-EXTREME':'INTERMARKET'
  };
  function hgOgFamilyOf(kind){ return OG_FAMILY[String(kind || '')] || 'OTHER'; }

  /* Families voting each way on the bar this hit fired on. */
  function hgOgConsensus(allHits, hit){
    if (!allHits || !allHits.length || !hit) return null;
    /* A family is only a vote if it speaks with ONE voice. SPRING long and
       ROUND-MAGNET short are both SWEEP; counting SWEEP as agreeing AND
       opposing put the same family on both sides of the ledger, inflated
       both counts, and manufactured ties out of a family that simply had no
       opinion. A split family is neutral, and is reported as neutral rather
       than quietly dropped — "the sweep reads are split" is worth knowing. */
    var seen = {}, i, h, fam, k;
    for (i = 0; i < allHits.length; i++){
      h = allHits[i];
      if (!h || !h.kind || (h.dir !== 'long' && h.dir !== 'short')) continue;
      fam = hgOgFamilyOf(h.kind);
      if (!seen[fam]) seen[fam] = { mine: false, theirs: false };
      if (h.dir === hit.dir) seen[fam].mine = true; else seen[fam].theirs = true;
    }
    var agree = [], against = [], split = [];
    for (k in seen){
      if (!Object.prototype.hasOwnProperty.call(seen, k)) continue;
      if (seen[k].mine && seen[k].theirs) split.push(k);
      else if (seen[k].mine) agree.push(k);
      else against.push(k);
    }
    return { agree: agree.sort(), against: against.sort(), split: split.sort(),
             nAgree: agree.length, nAgainst: against.length, nSplit: split.length };
  }

  /* ==================== gold gate ledger ==================== */

  /* Standard normal CDF (Abramowitz & Stegun 26.2.17). Inlined rather than
     borrowed from the indicator library so that a piece of pure arithmetic
     can never read "unavailable" because a script did not load. */
  function hgOgNormCdf(z){
    if (!isFinite(z)) return NaN;
    var sgn = z < 0 ? -1 : 1, x = Math.abs(z) / Math.SQRT2;
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
              - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + sgn * y);
  }

  /* THE MULTIPLE-COMPARISONS BAR.

     This desk scans OG_MECHANICS.length mechanics and reports the ones that
     look good. Judging each against a lone 5% threshold answers the wrong
     question: with 27 mechanics tried, the BEST of them clears +1.6σ by pure
     chance most of the time, so "+1.47σ vs breakeven" on a card is not
     evidence of anything — it is what searching twenty-seven ways looks like.

     Sidak: the per-mechanic threshold that holds the FAMILY-wise false
     positive rate at 5% across k independent tries. Inverted by bisection
     because the closed form is not worth carrying. */
  function hgOgFamilyZ(k){
    var n = Math.floor(fin(k));
    if (!isFinite(n) || n < 1) n = 1;
    var target = Math.pow(0.95, 1 / n);        /* per-test confidence needed */
    var lo = 0, hi = 8, mid, i;
    for (i = 0; i < 64; i++){
      mid = (lo + hi) / 2;
      if (hgOgNormCdf(mid) < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function emaOf(vals, n){
    if (!vals || vals.length < n || n <= 0) return NaN;
    var k = 2 / (n + 1), e = vals[0], i;
    for (i = 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
    return e;
  }
  function closesOf(rows){
    var out = [], i, c;
    if (!rows || !rows.length) return out;
    /* A null ENTRY, not just a null array: a feed that drops a bar leaves a
       hole in the middle, and reaching through it threw from inside whatever
       gate happened to call this first. Skip the hole, keep the series. */
    for (i = 0; i < rows.length; i++){
      if (!rows[i]) continue;
      c = num(rows[i].c);
      if (isFinite(c)) out.push(c);
    }
    return out;
  }
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

  /* Gold's ledger. Perp gates (funding, OI, retail, taker) do not exist on
     spot gold and are deliberately absent rather than faked. */
  function hgOgGates(rows, hit, extra){
    var gates = [], x = extra || {};
    /* One guarded read of the trigger bar. rows[rows.length-1] on an empty
       array is undefined, and reaching through it threw before any gate had
       been pushed — so the whole ledger vanished rather than degrading to
       UNCHECKED. Not reachable from the live scan (detect needs 40 bars
       first) but a ledger that can throw is a ledger that can take the card
       with it. */
    var lastBar = (rows && rows.length) ? rows[rows.length - 1] : null;
    var closes = closesOf(rows || []);
    var e21 = emaOf(closes.slice(-60), 21), e50 = emaOf(closes.slice(-120), 50);
    var last = closes.length ? closes[closes.length - 1] : NaN;
    var reversion = REVERSION_KINDS[hit.kind] === true;

    /* 1 — trend, graded by family (see omniroute: vetoing a reversion setup
       for being counter-trend is a category error) */
    var trendOk = null, trendWhy = 'EMA unavailable';
    if (isFinite(e21) && isFinite(e50) && isFinite(last)){
      var up = e21 >= e50;
      var agrees = (hit.dir === 'long') ? up : !up;
      if (reversion){
        trendOk = true;
        trendWhy = 'EMA21 ' + (up ? '≥' : '<') + ' EMA50 — '
                 + (agrees ? 'trend agrees' : 'counter-trend, which is what this setup IS')
                 + ' (context only for a reversion setup)';
      } else {
        trendOk = agrees;
        trendWhy = 'EMA21 ' + (up ? '≥' : '<') + ' EMA50' + (agrees ? ' — with the setup' : ' — against the setup');
      }
    }
    gates.push({ key:'trend', hard: !reversion, pass: trendOk, why: trendWhy });

    /* 2 — volatility alive */
    var atr = atrOf(rows, 14), atrPct = (isFinite(atr) && isFinite(last) && last > 0) ? (atr / last * 100) : NaN;
    /* Per-horizon: ATR% scales with sqrt(bar length), so a 1h bar cannot be
       held to a 4h floor. Gold is also far less volatile than alts. */
    var minAtr = isFinite(fin(x.minAtrPct)) ? fin(x.minAtrPct) : 0.12;
    var volOk = isFinite(atrPct) ? (atrPct >= minAtr) : null;
    gates.push({ key:'vol-alive', hard:true, pass: volOk,
      /* 3dp, not 2. Gold ATR% sits right on the scalp floor, so at 2dp a
         vetoed 0.0499% and a passing 0.0501% both printed "0.05%" — the card
         showed a number that appeared to satisfy the very floor it had just
         failed. A gate must not display a value that contradicts its own
         verdict. */
      why: isFinite(atrPct) ? ('ATR ' + atrPct.toFixed(3) + '% of price (floor ' + minAtr + '%)' + (volOk ? '' : ' — too dead')) : 'ATR unavailable' });

    /* 3 — participation. CONDITIONAL on gold, unlike crypto: several gold
       feeds (spot proxies especially) publish no volume at all, and a hard
       volume gate would silently disqualify every setup sourced from them. */
    var mv = lastBar ? meanVol(rows.slice(0, rows.length - 1), 20) : NaN;
    var lv = lastBar ? num(lastBar.v) : NaN;
    var partOk = null, partWhy = 'this gold feed publishes no volume';
    if (isFinite(mv) && isFinite(lv) && mv > 0){
      partOk = lv >= mv * 0.7;
      partWhy = 'trigger vol ' + (lv / mv).toFixed(2) + '× 20-bar mean';
    }
    gates.push({ key:'participation', hard:false, pass: partOk, why: partWhy });

    /* 4 — daily agreement */
    var he21 = x.htf ? fin(x.htf.e21) : NaN, he50 = x.htf ? fin(x.htf.e50) : NaN;
    var d1 = null, d1Why = 'daily bars unavailable';
    if (isFinite(he21) && isFinite(he50)){
      var upD = he21 >= he50;
      var dAgrees = (hit.dir === 'long') ? upD : !upD;
      d1 = reversion ? true : dAgrees;
      d1Why = 'daily EMA' + DAILY_FAST + (upD ? ' ≥ ' : ' < ') + 'EMA' + DAILY_SLOW
            + (reversion ? (dAgrees ? ' — agrees' : ' — counter-trend (expected for a reversion setup)')
                         : (dAgrees ? ' — agrees' : ' — disagrees with the setup'));
    }
    gates.push({ key:'htf-daily', hard:false, pass: d1, why: d1Why });

    /* 5 — session. Gold's character is session-bound in a way alts are not:
       the London and NY killzones carry the volume that makes intraday
       structure mean anything. Off-hours is not a veto (swing setups are
       legitimately born there) but it is reported. */
    var sess = null, sessWhy = 'killzone module unavailable';
    if (x.killzone && x.killzone.zone){
      var z = String(x.killzone.zone);
      var inKz = (z !== 'OFF');
      /* Session is decisive INTRADAY and merely contextual on the swing
         horizon — a 4h structure is legitimately born at any hour, and
         vetoing it for the clock (as the first live build did) grades it
         against a scalper's model. The comment said this; the code did not. */
      if (x.sessionHard === false){
        sess = true;
        sessWhy = 'session ' + (x.killzone.label || z)
                + (inKz ? '' : ' — off-hours, context only at swing horizon');
      } else {
        sess = inKz;
        sessWhy = 'session ' + (x.killzone.label || z) + (inKz ? '' : ' — outside the London/NY killzones');
      }
    }
    gates.push({ key:'session', hard:false, pass: sess, why: sessWhy });

    /* 6 — real-rate macro. Gold's primary fundamental driver. */
    var mac = null, macWhy = 'macro module has not run';
    if (x.macro && x.macro.realRateHint){
      var hint = String(x.macro.realRateHint).toUpperCase();
      if (hint === 'TAILWIND') mac = (hit.dir === 'long');
      else if (hint === 'HEADWIND') mac = (hit.dir === 'short');
      else mac = true;                                  // NEUTRAL blocks nothing
      macWhy = 'real rates ' + hint + (mac ? '' : ' — against the setup side');
    }
    gates.push({ key:'macro-realrate', hard:false, pass: mac, why: macWhy });

    /* 7 — DXY. Gold trades inversely to the dollar often enough that a
       strongly trending DXY on the wrong side is a genuine headwind. */
    var dxy = null, dxyWhy = 'DXY unavailable';
    if (x.macro && x.macro.dxy && typeof x.macro.dxy.trend20 === 'string'){
      var dt = String(x.macro.dxy.trend20).toUpperCase();
      if (dt.indexOf('UP') >= 0) dxy = (hit.dir === 'short');
      else if (dt.indexOf('DOWN') >= 0) dxy = (hit.dir === 'long');
      else dxy = true;
      dxyWhy = 'DXY 20d ' + dt + (dxy ? ' — inverse supports the setup' : ' — inverse opposes the setup');
    }
    gates.push({ key:'dxy-inverse', hard:false, pass: dxy, why: dxyWhy });

    /* 8 — yield guard, from goldind's own validator */
    /* getGoldMacro() exposes tnxTrend (US10Y direction), NOT a US10Y candle
       series — the first build asked for rows that never existed, so this
       gate read UNCHECKED on every card. Rising nominal yields are a
       headwind for gold longs; falling yields for shorts. */
    var yld = null, yldWhy = 'US10Y trend unavailable';
    if (x.macro && typeof x.macro.tnxTrend === 'string' && x.macro.tnxTrend){
      var yt = String(x.macro.tnxTrend).toUpperCase();
      if (yt.indexOf('RIS') >= 0) yld = (hit.dir === 'short');
      else if (yt.indexOf('FALL') >= 0) yld = (hit.dir === 'long');
      else yld = true;                                   // FLAT blocks nothing
      yldWhy = 'US10Y ' + yt + (yld ? ' — supports this direction' : ' — headwind for this direction');
    } else if (x.yield && typeof x.yield.valid === 'boolean'){
      yld = x.yield.valid;
      yldWhy = 'yield guard ' + (yld ? 'clear' : 'flags this direction')
             + (x.yield.reason ? (' — ' + x.yield.reason) : '');
    }
    gates.push({ key:'yield-guard', hard:false, pass: yld, why: yldWhy });

    /* 9 — ADR budget. Chasing a breakout after the day has spent its range
       is how intraday gold trades die. */
    var adr = null, adrWhy = 'ADR unavailable';
    if (x.adr && isFinite(fin(x.adr.usedPct))){
      var used = fin(x.adr.usedPct);
      var continuation = !reversion;
      adr = continuation ? (used < 100) : true;   // fades WANT an exhausted day
      adrWhy = 'day has used ' + used.toFixed(0) + '% of ADR'
             + (adr ? '' : ' — too late to chase a continuation');
    }
    gates.push({ key:'adr-budget', hard:false, pass: adr, why: adrWhy });

    /* 10 — news. Gold is the most event-sensitive instrument in the app;
       NFP/CPI/FOMC routinely move it multiples of ATR in seconds.
       An unloaded module reads UNCHECKED, never a low-risk pass. */
    var nw = null, nwWhy = 'news module has not run';
    var nwNote = (x.news && typeof x.news.note === 'string') ? x.news.note : '';
    var nwUnloaded = /not loaded|news error/i.test(nwNote);
    if (x.news && x.news.risk && !nwUnloaded){
      nw = !(x.news.blackout === true || String(x.news.risk) === 'high');
      nwWhy = 'news risk ' + x.news.risk + (nw ? '' : ' — blackout window');
    } else if (nwUnloaded){
      nwWhy = 'news not checked — module reports: ' + nwNote;
    }
    gates.push({ key:'news-window', hard:false, pass: nw, why: nwWhy });

    /* 11 — cost drag. A stop can be structurally correct and still be
       untradeable: the walk-forward measures GROSS outcomes, so a tight
       intraday stop can show a healthy R multiple that the spread then eats.
       On the first live scalp card a 3.16-point stop meant a $0.30 spread
       was 19% of 1R, turning a measured +0.38R into roughly +0.19R net. */
    var cost = null, costWhy = 'no plan risk to cost';
    var planRisk = fin(x.planRisk);
    if (isFinite(planRisk) && planRisk > 0){
      var rt = ASSUMED_SPREAD_USD * 2;
      var costR = rt / planRisk;
      cost = costR <= COST_VETO_R;
      costWhy = 'round-trip ~$' + rt.toFixed(2) + ' on a $' + planRisk.toFixed(2) + ' stop = '
              + (costR * 100).toFixed(0) + '% of 1R'
              + (costR > COST_VETO_R ? ' — the spread would eat most of the edge'
                 : (costR > COST_WARN_R ? ' — material drag, size accordingly' : ''));
    }
    gates.push({ key:'cost-drag', hard:false, pass: cost, why: costWhy });

    /* 12 — measured edge: this mechanic's own walk-forward on THIS horizon,
       judged by significance against the breakeven rate for this R floor. */
    var minRr = isFinite(fin(x.minRr)) ? fin(x.minRr) : 2;
    var sExp = x.stats ? fin(x.stats.expR) : NaN;
    var sHit = x.stats ? fin(x.stats.hit) : NaN;
    var sN = x.stats ? fin(x.stats.samples) : NaN;
    var ed = null, edWhy = 'not yet measured';
    if (isFinite(sExp) && isFinite(sHit) && isFinite(sN)){
      var pBreak = 1 / (1 + minRr);
      var se = Math.sqrt(pBreak * (1 - pBreak) / Math.max(1, sN));
      var z = se > 0 ? ((sHit - pBreak) / se) : 0;
      var stat = sN + ' samples · ' + (sHit * 100).toFixed(0) + '% T1-first · '
               + (sExp >= 0 ? '+' : '') + sExp.toFixed(2) + 'R [' + (z >= 0 ? '+' : '') + z.toFixed(2) + 'σ vs breakeven]';
      /* The bar a single mechanic must clear once you account for how many
         were tried. A positive read that does not clear it is not a weaker
         edge — it is no evidence at all, and PASS would say otherwise. */
      var famZ = hgOgFamilyZ(OG_MECHANICS.length);
      var famTxt = ' · ' + OG_MECHANICS.length + ' mechanics scanned, so +'
                 + famZ.toFixed(2) + 'σ is the bar before one this good means anything';

      if (sN < MIN_SAMPLES) edWhy = 'only ' + sN + ' past samples — too few to judge';
      else if (z <= EDGE_VETO_Z && sN >= EDGE_VETO_SAMPLES){ ed = false; edWhy = stat + ' — significantly below breakeven, this mechanic has not paid'; }
      else if (z <= EDGE_VETO_Z){ ed = true; edWhy = stat + ' — below breakeven, but only ' + sN + ' samples: too few to veto on'; }
      else if (z >= famZ){ ed = true; edWhy = stat + ' — clears the ' + OG_MECHANICS.length + '-mechanic significance bar (+' + famZ.toFixed(2) + 'σ)'; }
      else {
        /* UNCHECKED, not PASS: searching 27 ways and reporting the best one
           does not demonstrate an edge, and the ledger's own rule is that
           what has not been established does not read as established. The
           gate is soft, so this does not veto — the ticket stands and the
           card stops claiming a measurement it has not got. */
        ed = null;
        edWhy = stat + (z < 0 ? ' — below breakeven but within noise' : '') + famTxt;
      }
      edWhy = 'in-sample ' + edWhy;
    }

    /* ---- OUT-OF-SAMPLE OVERRIDE ----------------------------------------

       Everything above is the walk-forward pool, re-read from the same window
       on every scan. It is what this gate has always used, and on the live
       gold desk it passed a ticket reading

         'PASS measured-edge 41 samples · 51% T1-first · +0.54R [+1.47σ]'

       for ROUND-MAGNET, while the forward log for that same mechanic on that
       same horizon stood at 0 wins in 5 settled trades. A gate calling itself
       measured-edge cannot quote the number the forward log exists to
       distrust and then ignore the forward log.

       Precedence: enough settled forward trades and the forward record IS the
       verdict; too few but CONTRADICTING a positive in-sample read and the
       gate reads UNCHECKED rather than passing on the agreeable half; nothing
       forward and the in-sample number stands, labelled as in-sample. */
    var fwd = x.fwd || null;
    var fN = fwd ? fin(fwd.samples) : NaN;
    if (isFinite(fN) && fN > 0){
      var fHit = fin(fwd.hit);
      var fBreak = 1 / (1 + minRr);
      var fTxt = fN + ' settled out-of-sample · ' + (isFinite(fHit) ? (fHit * 100).toFixed(0) + '%' : '—') + ' T1-first';
      if (fN >= FWD_MIN_JUDGE && isFinite(fHit)){
        var fse = Math.sqrt(Math.max(1e-9, fBreak * (1 - fBreak) / fN));
        var fz = (fHit - fBreak) / fse;
        var fzTxt = ' [' + (fz >= 0 ? '+' : '') + fz.toFixed(2) + 'σ vs breakeven]';
        if (fz <= EDGE_VETO_Z){
          ed = false;
          edWhy = fTxt + fzTxt + ' — the OUT-OF-SAMPLE record is significantly below breakeven and outranks the in-sample pool';
        } else {
          ed = true;
          edWhy = fTxt + fzTxt + ' — measured out-of-sample';
        }
      } else if (isFinite(fHit) && isFinite(z) && z > 0 && fHit < fBreak){
        ed = null;
        edWhy = fTxt + ' vs ' + edWhy
              + ' — CONTRADICTORY: the walk-forward pool is positive while every settled out-of-sample '
              + 'trade has lost. Too few to judge either way, so this reads UNCHECKED rather than PASS.';
      } else {
        edWhy = fTxt + ' (too few to judge) · ' + edWhy;
      }
    } else if (fwd && fin(fwd.open) > 0){
      edWhy = fin(fwd.open) + ' out-of-sample trade' + (fin(fwd.open) === 1 ? '' : 's') + ' still open · ' + edWhy;
    }

    gates.push({ key:'measured-edge', hard:false, pass: ed, why: edWhy });

    /* --- added indicator reads ------------------------------------------

       These are CONTEXT, deliberately conditional rather than hard. Adding
       four more hard gates to a twelve-gate ledger would cut tickets to
       almost nothing and the cut would be arbitrary: none of these has a
       measured record on this desk. They report, they show on the card, and
       they can veto only where the read is unambiguous and directional.

       An indicator that cannot be computed reads UNCHECKED, never PASS. */

    /* 13 — Ichimoku cloud position. A well-known gold trend filter. */
    var ich = null, ichWhy = 'ichimoku unavailable';
    var ichFn = gfn('ichimokuState');
    if (ichFn){
      try {
        /* indicators2.js returns { priceVsCloud:'ABOVE'|'BELOW'|'INSIDE',
           tkCross:'BULL'|'BEAR', cloudBull:bool }. Reading a .state or .label
           off it finds undefined and the gate reads UNCHECKED forever, which
           is exactly what the suite caught. */
        var ichR = ichFn(rows);
        var iState = ichR ? String(ichR.priceVsCloud || '') : '';
        if (iState === 'ABOVE' || iState === 'BELOW'){
          var bullCloud = (iState === 'ABOVE');
          var tk = ichR.tkCross === 'BULL';
          var ichAgrees = (hit.dir === 'long') ? bullCloud : !bullCloud;
          ichWhy = 'price ' + iState.toLowerCase() + ' the cloud, tenkan/kijun '
                 + (tk ? 'bull' : 'bear') + ', cloud ' + (ichR.cloudBull ? 'bull' : 'bear');
          /* A reversion mechanic is counter-cloud BY DESIGN — the same
             category error the trend gate already refuses to make. */
          if (reversion){
            ich = true;
            ichWhy += ' — counter-cloud is expected for a reversion mechanic';
          } else {
            /* A SOFT FAIL, not UNCHECKED. The cloud was read and it disagrees;
               reporting that as "unknown" would hide a known negative behind
               the label the ledger reserves for things it could not check. */
            ich = ichAgrees;
            ichWhy += ichAgrees ? ' — agrees' : ' — against this direction (context, not a veto)';
          }
        } else if (iState === 'INSIDE'){
          ichWhy = 'inside the cloud — no directional read';
        }
      } catch (eIch){ ich = null; ichWhy = 'ichimoku threw: ' + ((eIch && eIch.message) || eIch); }
    }
    gates.push({ key:'ichimoku', hard:false, info:true, pass: ich, why: ichWhy });

    /* 14 — Donchian position: where price sits in its own 20-bar range. */
    var don = null, donWhy = 'donchian unavailable';
    var donFn = gfn('donchian');
    if (donFn){
      try {
        /* indicators2.js returns { up, lo, mid } as ARRAYS, one entry per bar
           — not scalars, and not .upper/.lower. Both halves of that mistake
           read NaN and left the gate permanently UNCHECKED. */
        var dc = donFn(rows, 20);
        var dUa = dc && dc.up, dLa = dc && dc.lo;
        var dU = (dUa && dUa.length) ? fin(dUa[dUa.length - 1]) : NaN;
        var dL = (dLa && dLa.length) ? fin(dLa[dLa.length - 1]) : NaN;
        var dC = lastBar ? fin(lastBar.c) : NaN;
        if (isFinite(dU) && isFinite(dL) && isFinite(dC) && dU > dL){
          /* The channel is built from the bars BEFORE this one, so the close
             can sit outside it. That is a range break and worth saying, not a
             negative percentage on the card. */
          var pos = (dC - dL) / (dU - dL);
          var shown = Math.max(0, Math.min(1, pos));
          donWhy = (pos > 1 ? 'broken ABOVE the 20-bar range ('
                  : pos < 0 ? 'broken BELOW the 20-bar range ('
                  : 'at ' + (shown * 100).toFixed(0) + '% of the 20-bar range (')
                 + dL.toFixed(2) + '–' + dU.toFixed(2) + ')';
          /* Buying the very top or selling the very bottom of the range is
             the one case worth flagging as a fail. */
          if (hit.dir === 'long' && pos > 0.95){ don = false; donWhy += ' — buying the extreme high of the range'; }
          else if (hit.dir === 'short' && pos < 0.05){ don = false; donWhy += ' — selling the extreme low of the range'; }
          else { don = true; }
        }
      } catch (eDon){ don = null; donWhy = 'donchian threw: ' + ((eDon && eDon.message) || eDon); }
    }
    gates.push({ key:'donchian-pos', hard:false, info:true, pass: don, why: donWhy });

    /* 15 — Stochastic RSI extreme, as a momentum-exhaustion read. */
    var st = null, stWhy = 'stoch RSI unavailable';
    var stFn = gfn('stochRsi');
    if (stFn){
      try {
        var closes = [], ci;
        for (ci = 0; ci < rows.length; ci++){ var cv = fin(rows[ci].c); if (isFinite(cv)) closes.push(cv); }
        var sArr = stFn(closes, 14);
        var sv = (sArr && sArr.length) ? fin(sArr[sArr.length - 1]) : NaN;
        /* "unavailable" would claim the indicator is missing. It ran; on a
           tape with no RSI range in the window there is simply no value to
           read, and the card should say which of the two it is. */
        if (!isFinite(sv)) stWhy = 'stoch RSI has no value on this tape (no RSI range in the window)';
        if (isFinite(sv)){
          var v = sv > 1 ? sv / 100 : sv;           /* some builds return 0–100 */
          stWhy = 'stoch RSI ' + (v * 100).toFixed(0);
          if (hit.dir === 'long' && v >= 0.95){ st = false; stWhy += ' — buying into an exhausted high'; }
          else if (hit.dir === 'short' && v <= 0.05){ st = false; stWhy += ' — selling into an exhausted low'; }
          else { st = true; }
        }
      } catch (eSt){ st = null; stWhy = 'stoch RSI threw: ' + ((eSt && eSt.message) || eSt); }
    }
    gates.push({ key:'stoch-rsi', hard:false, info:true, pass: st, why: stWhy });

    /* 16 — Hurst exponent: is this series trending or mean-reverting right
       now? Reported for every mechanic, and used to flag the mismatch that
       matters — a reversion mechanic in a strongly trending tape. */
    var hu = null, huWhy = 'hurst unavailable';
    var huFn = gfn('hgHurstRS');
    if (huFn){
      try {
        var hcl = [], hi2;
        for (hi2 = 0; hi2 < rows.length; hi2++){ var hv = fin(rows[hi2].c); if (isFinite(hv)) hcl.push(hv); }
        var hr = huFn(hcl);
        var H = fin(hr && (hr.hurst !== undefined ? hr.hurst : hr));
        if (isFinite(H)){
          var trending = H > 0.55, reverting = H < 0.45;
          huWhy = 'Hurst ' + H.toFixed(2) + ' — '
                + (trending ? 'trending' : (reverting ? 'mean-reverting' : 'neither, random walk'));
          var isReversion = /REVERT|FADE|MAGNET|SWEEP|JUDAS|SPRING/.test(String(hit.kind || ''));
          if (isReversion && trending){ hu = false; huWhy += ': a reversion mechanic against a trending tape'; }
          else { hu = true; }
        }
      } catch (eHu){ hu = null; huWhy = 'hurst threw: ' + ((eHu && eHu.message) || eHu); }
    }
    gates.push({ key:'hurst-regime', hard:false, info:true, pass: hu, why: huWhy });

    /* --- second round of indicator reads --------------------------------

       Same standing as the first four: info gates. They report, they can
       argue against a setup on the card, and they never veto. Nothing here
       has a measured record on gold, so nothing here has earned the right to
       stand a trade aside.

       Every return shape below was read off the real function, not guessed.
       adx/keltner/ttmSqueeze all return PARALLEL ARRAYS; hgAtrPercentile
       returns a bare number; hgStructureGate returns an object with a note.
       Getting that wrong is silent — the gate simply reads unavailable for
       ever — which is how the previous round shipped two dead gates. */

    /* 17 — ADX: is there a trend here at all, and does it point our way? */
    var adxOk = null, adxWhy = 'ADX unavailable';
    var adxFn = gfn('adx');
    if (adxFn){
      try {
        var ax = adxFn(rows, 14);
        var aArr = ax && ax.adx, pArr = ax && ax.plusDI, mArr = ax && ax.minusDI;
        var aV = (aArr && aArr.length) ? fin(aArr[aArr.length - 1]) : NaN;
        var pV = (pArr && pArr.length) ? fin(pArr[pArr.length - 1]) : NaN;
        var mV = (mArr && mArr.length) ? fin(mArr[mArr.length - 1]) : NaN;
        if (isFinite(aV) && isFinite(pV) && isFinite(mV)){
          var trending = aV >= 25;
          var diUp = pV > mV;
          adxWhy = 'ADX ' + aV.toFixed(0) + (trending ? ' — trending' : ' — no trend')
                 + ', DI ' + (diUp ? 'up' : 'down');
          if (!trending){
            /* No trend is not an argument against a reversion mechanic; it is
               the condition it wants. */
            adxOk = reversion ? true : false;
            adxWhy += reversion ? ' — which is the tape a reversion mechanic wants'
                                : ' — a continuation mechanic with no trend behind it';
          } else {
            var diAgrees = (hit.dir === 'long') ? diUp : !diUp;
            adxOk = reversion ? true : diAgrees;
            adxWhy += diAgrees ? ' — agrees' : (reversion ? ' — counter-trend by design' : ' — DI points the other way');
          }
        }
      } catch (eAdx){ adxOk = null; adxWhy = 'ADX threw: ' + ((eAdx && eAdx.message) || eAdx); }
    }
    gates.push({ key:'adx-trend', hard:false, info:true, pass: adxOk, why: adxWhy });

    /* 18 — TTM squeeze state: compression, release, or neither. */
    var sq = null, sqWhy = 'squeeze unavailable';
    var sqFn = gfn('ttmSqueeze');
    if (sqFn){
      try {
        var sqR = sqFn(rows);
        var onA = sqR && sqR.on, fdA = sqR && sqR.fired, moA = sqR && sqR.momentum;
        if (onA && onA.length && moA && moA.length){
          var li = onA.length - 1;
          var isOn = onA[li] === true, didFire = !!(fdA && fdA[li] === true);
          var mo = fin(moA[li]);
          sqWhy = isOn ? 'in a volatility squeeze (compression, no expansion yet)'
                : didFire ? 'squeeze just released' : 'no squeeze';
          if (isFinite(mo)){
            var moUp = mo > 0;
            sqWhy += ', momentum ' + (moUp ? 'up' : 'down');
            var moAgrees = (hit.dir === 'long') ? moUp : !moUp;
            /* Entering INTO a live squeeze is entering before the market has
               chosen — worth saying, not worth vetoing. */
            if (isOn){ sq = false; sqWhy += ' — entering before the expansion has picked a side'; }
            else if (reversion){
              /* A fade is counter-momentum BY DESIGN. Marking it "against"
                 would be the same category error the trend gate refuses. */
              sq = true;
              sqWhy += moAgrees ? ' — agrees' : ' — counter-momentum by design';
            }
            else { sq = moAgrees; sqWhy += moAgrees ? ' — agrees' : ' — momentum points the other way'; }
          } else { sq = isOn ? false : null; }
        }
      } catch (eSq){ sq = null; sqWhy = 'squeeze threw: ' + ((eSq && eSq.message) || eSq); }
    }
    gates.push({ key:'squeeze-state', hard:false, info:true, pass: sq, why: sqWhy });

    /* 19 — Keltner position: riding the band, or stretched outside it. */
    var kel = null, kelWhy = 'keltner unavailable';
    var kelFn = gfn('keltner');
    if (kelFn){
      try {
        var kc = kelFn(rows, 20, 1.5);
        var kU = (kc && kc.up && kc.up.length) ? fin(kc.up[kc.up.length - 1]) : NaN;
        var kL = (kc && kc.lo && kc.lo.length) ? fin(kc.lo[kc.lo.length - 1]) : NaN;
        var kM = (kc && kc.mid && kc.mid.length) ? fin(kc.mid[kc.mid.length - 1]) : NaN;
        var kC = fin(rows[rows.length - 1].c);
        if (isFinite(kU) && isFinite(kL) && isFinite(kM) && isFinite(kC) && kU > kL){
          var outHigh = kC > kU, outLow = kC < kL;
          kelWhy = outHigh ? 'above the upper Keltner band'
                 : outLow ? 'below the lower Keltner band'
                 : 'inside the Keltner bands';
          if (reversion){
            /* Outside the band is exactly where a fade belongs. */
            kel = true;
            if (outHigh || outLow) kelWhy += ' — the stretch a reversion mechanic is fading';
          } else if ((hit.dir === 'long' && outHigh) || (hit.dir === 'short' && outLow)){
            kel = false;
            kelWhy += ' — chasing a move already extended past the band';
          } else {
            kel = true;
          }
        }
      } catch (eKel){ kel = null; kelWhy = 'keltner threw: ' + ((eKel && eKel.message) || eKel); }
    }
    gates.push({ key:'keltner-pos', hard:false, info:true, pass: kel, why: kelWhy });

    /* 20 — ATR percentile: gold's own volatility, ranked against its history.
       Both tails matter. A dead tape will not reach a 1.5R target before the
       horizon expires; a top-decile tape moves the stop into the noise. */
    var vp = null, vpWhy = 'ATR percentile unavailable';
    var vpFn = gfn('hgAtrPercentile');
    if (vpFn){
      try {
        var pct = fin(vpFn(rows, 14, 100));
        if (isFinite(pct)){
          vpWhy = 'ATR in the ' + hgOgOrdinal(pct) + ' percentile of the last 100 bars';
          if (pct < 15){ vp = false; vpWhy += ' — too quiet to reach the target inside the horizon'; }
          else if (pct > 90){ vp = false; vpWhy += ' — top-decile volatility, the stop sits inside the noise'; }
          else vp = true;
        }
      } catch (eVp){ vp = null; vpWhy = 'ATR percentile threw: ' + ((eVp && eVp.message) || eVp); }
    }
    gates.push({ key:'atr-percentile', hard:false, info:true, pass: vp, why: vpWhy });

    /* 21 — Market structure: is there a fresh opposing change of character?
       hgStructureGate returns { veto, bos, choch, note } and already words
       its own note, so the card quotes it rather than paraphrasing. */
    var stG = null, stGWhy = 'structure unavailable';
    var stGFn = gfn('hgStructureGate');
    if (stGFn){
      try {
        var sg = stGFn(rows, hit.dir, {});
        if (sg && typeof sg.note === 'string' && sg.note){
          stGWhy = sg.note;
          stG = (sg.veto === true) ? false : true;
          if (sg.veto === true) stGWhy += ' — structure turned against this direction';
        }
      } catch (eSt2){ stG = null; stGWhy = 'structure threw: ' + ((eSt2 && eSt2.message) || eSt2); }
    }
    gates.push({ key:'structure-shift', hard:false, info:true, pass: stG, why: stGWhy });

    /* 22 — CONSENSUS. The one gate that reads the rest of the scan.

       A hard veto, and deliberately so: unlike the indicator reads above,
       this makes no claim about whether a mechanic works. It states a fact
       about this bar — that the desk's own mechanics are pointing both ways
       and this setup is on the side with fewer of them. Presenting that as a
       ticket is the app disagreeing with itself in front of the user.

       Ties veto BOTH directions. When the tape is genuinely two-sided the
       honest output is no trade, not a coin flip dressed as a setup. */
    var con = null, conWhy = 'no other mechanics to compare against';
    var conHard = false;
    var cons = x.allHits ? hgOgConsensus(x.allHits, hit) : null;
    if (cons){
      conHard = true;
      var aTxt = cons.nAgree + ' famil' + (cons.nAgree === 1 ? 'y agrees' : 'ies agree')
               + (cons.agree.length ? ' (' + cons.agree.join(', ') + ')' : '');
      var splitTxt = cons.nSplit ? '; ' + cons.split.join(', ')
                   + (cons.nSplit === 1 ? ' is' : ' are') + ' split and counted for neither' : '';
      if (cons.nAgree === 0 && cons.nAgainst === 0){
        /* Every family that fired is internally divided, so not one of them
           has an opinion. The nAgainst===0 branch below would read that as
           "nothing firing against it" and PASS — which it did, printing
           "0 families agree, nothing firing against it" and letting a long
           and a short ticket simultaneously. Nothing agreeing is not the same
           as nothing disagreeing, and this is the most two-sided tape there
           is. A latent hole since the split rule landed; round four made
           splits common enough to hit it. */
        con = false;
        conWhy = 'every mechanic family that fired is split (' + cons.split.join(', ')
               + ') — the desk has no directional opinion at all';
      } else if (cons.nAgainst === 0){
        con = true;
        conWhy = aTxt + ', nothing firing against it' + splitTxt;
      } else if (cons.nAgree > cons.nAgainst){
        con = true;
        conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt;
      } else if (cons.nAgree === cons.nAgainst){
        /* A TIE between TREND and REVERSION is not a contradiction — it is
           what those two families ARE. In a trending tape the continuation
           mechanics fire with the move and the fades fire against it, every
           time, so vetoing both throws the trade away for being exactly what
           it should be. Found on OMNIROUTE, where the veto rate ROSE from 36%
           on a random walk to 56% on a trending one with 87% of those being
           ties; here ties were ~60% of every consensus veto.

           The structural regime already says which family belongs, so let it
           break the tie. Only one side can win, so this cannot reintroduce a
           contradictory pair, and with no clear regime both still stand
           aside. */
        var tieReg = null;
        var tieFn = gfn('detectRegime');
        if (tieFn){ try { var tr = tieFn(rows); tieReg = tr ? String(tr.regime || '') : null; } catch (eT){ tieReg = null; } }
        var wantFam = /trend/i.test(tieReg || '') ? 'TREND'
                    : /range|chop|mean/i.test(tieReg || '') ? 'REVERSION' : null;
        var mineHas = wantFam && cons.agree.indexOf(wantFam) >= 0;
        var theirsHas = wantFam && cons.against.indexOf(wantFam) >= 0;
        if (wantFam && mineHas && !theirsHas){
          con = true;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — tied, broken by the ' + tieReg + ' regime, which favours ' + wantFam;
        } else if (wantFam && theirsHas && !mineHas){
          con = false;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — tied, and the ' + tieReg + ' regime favours the other side (' + wantFam + ')';
        } else {
          con = false;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ')
                 + ')' + splitTxt + ' — tied, and no regime read to break it: the desk cannot pick a side';
        }
      } else {
        con = false;
        conWhy = 'only ' + aTxt + ' vs ' + cons.nAgainst + ' against ('
               + cons.against.join(', ') + ')' + splitTxt + ' — this is the minority read';
      }
    }
    gates.push({ key:'consensus', hard: conHard, pass: con, why: conWhy });

    /* 23 — MACD histogram: momentum turning, not merely present. macdHist
       returns a bare ARRAY of histogram values. */
    var mac = null, macWhy = 'MACD unavailable';
    var macFn = gfn('macdHist');
    if (macFn){
      try {
        var mh = macFn(closesOf(rows));
        var m0 = (mh && mh.length) ? fin(mh[mh.length - 1]) : NaN;
        var m1 = (mh && mh.length > 1) ? fin(mh[mh.length - 2]) : NaN;
        if (isFinite(m0) && isFinite(m1)){
          var rising = m0 > m1;
          macWhy = 'MACD histogram ' + (m0 >= 0 ? '+' : '') + m0.toFixed(2)
                 + ' and ' + (rising ? 'rising' : 'falling');
          var macAgrees = (hit.dir === 'long') ? rising : !rising;
          if (reversion){
            /* A fade wants momentum rolling over, which is the opposite of
               agreement — so agreement is not the test for it. */
            mac = true;
            macWhy += macAgrees ? ' — turning with the fade' : ' — still against the fade, early';
          } else {
            mac = macAgrees;
            macWhy += macAgrees ? ' — agrees' : ' — momentum is turning the other way';
          }
        }
      } catch (eMac){ mac = null; macWhy = 'MACD threw: ' + ((eMac && eMac.message) || eMac); }
    }
    gates.push({ key:'macd-momentum', hard:false, info:true, pass: mac, why: macWhy });

    /* 24 — Bollinger %B: where price sits across its own volatility envelope.
       bollingerPercentB returns a bare NUMBER (0 = lower band, 1 = upper). */
    var bb = null, bbWhy = 'bollinger %B unavailable';
    var bbFn = gfn('bollingerPercentB');
    if (bbFn){
      try {
        var pb = fin(bbFn(rows, 20, 2));
        if (isFinite(pb)){
          bbWhy = '%B ' + pb.toFixed(2) + ' ('
                + (pb > 1 ? 'above the upper band' : pb < 0 ? 'below the lower band'
                   : pb > 0.5 ? 'upper half' : 'lower half') + ')';
          if (reversion){
            bb = true;
            if (pb > 1 || pb < 0) bbWhy += ' — the stretch being faded';
          } else if (hit.dir === 'long' && pb > 1){ bb = false; bbWhy += ' — buying outside the envelope'; }
          else if (hit.dir === 'short' && pb < 0){ bb = false; bbWhy += ' — selling outside the envelope'; }
          else bb = true;
        }
      } catch (eBb){ bb = null; bbWhy = 'bollinger %B threw: ' + ((eBb && eBb.message) || eBb); }
    }
    gates.push({ key:'bollinger-pctb', hard:false, info:true, pass: bb, why: bbWhy });

    /* 25 — Volume z-score: is anyone actually here for this move? volZ
       returns a bare NUMBER. Gold feeds without volume return NaN, which
       reads UNCHECKED rather than pretending participation was confirmed. */
    var vz = null, vzWhy = 'volume z unavailable (this feed may publish no volume)';
    var vzFn = gfn('volZ');
    if (vzFn){
      try {
        var z20 = fin(vzFn(rows, 20));
        if (isFinite(z20)){
          vzWhy = 'volume ' + (z20 >= 0 ? '+' : '') + z20.toFixed(1) + 'σ vs its 20-bar mean';
          if (z20 <= -1){ vz = false; vzWhy += ' — nobody is here for this move'; }
          else vz = true;
        }
      } catch (eVz){ vz = null; vzWhy = 'volume z threw: ' + ((eVz && eVz.message) || eVz); }
    }
    gates.push({ key:'volume-z', hard:false, info:true, pass: vz, why: vzWhy });

    /* 26 — Linear regression slope: the trend's actual gradient, in dollars
       per bar, rather than a crossover's opinion of it. Returns an ARRAY. */
    var lr = null, lrWhy = 'regression slope unavailable';
    var lrFn = gfn('linregSlope');
    if (lrFn){
      try {
        var slArr = lrFn(closesOf(rows), 20);
        var sl = (slArr && slArr.length) ? fin(slArr[slArr.length - 1]) : NaN;
        var aRef = atrOf(rows, 14);
        if (isFinite(sl) && isFinite(aRef) && aRef > 0){
          var perAtr = sl / aRef;
          lrWhy = '20-bar regression slope ' + (sl >= 0 ? '+' : '') + sl.toFixed(2)
                + '/bar (' + (perAtr >= 0 ? '+' : '') + perAtr.toFixed(2) + ' ATR)';
          var flat = Math.abs(perAtr) < 0.02;
          if (flat){
            lr = reversion ? true : false;
            lrWhy += flat && reversion ? ' — flat, which is what a fade wants'
                                       : ' — flat, no gradient behind a continuation';
          } else {
            var slUp = sl > 0;
            var slAgrees = (hit.dir === 'long') ? slUp : !slUp;
            lr = reversion ? true : slAgrees;
            lrWhy += reversion ? ' — counter-slope by design'
                   : (slAgrees ? ' — agrees' : ' — the gradient points the other way');
          }
        }
      } catch (eLr){ lr = null; lrWhy = 'regression slope threw: ' + ((eLr && eLr.message) || eLr); }
    }
    gates.push({ key:'regression-slope', hard:false, info:true, pass: lr, why: lrWhy });

    /* 27 — Volume profile: is the entry near value, or out in thin air where
       there is no traded history to lean on? volumeProfile returns
       { poc, vah, val, bins }. */
    var vpf = null, vpfWhy = 'volume profile unavailable';
    var vpfFn = gfn('volumeProfile');
    if (vpfFn){
      try {
        var prof = vpfFn(rows, Math.max(0, rows.length - 200), rows.length - 1);
        var poc = prof ? fin(prof.poc) : NaN;
        var vah = prof ? fin(prof.vah) : NaN;
        var val = prof ? fin(prof.val) : NaN;
        var pxNow = fin(rows[rows.length - 1].c);
        if (isFinite(poc) && isFinite(vah) && isFinite(val) && isFinite(pxNow) && vah > val){
          var inValue = pxNow >= val && pxNow <= vah;
          vpfWhy = 'price ' + (inValue ? 'inside' : 'outside') + ' value ('
                 + val.toFixed(2) + '–' + vah.toFixed(2) + ', POC ' + poc.toFixed(2) + ')';
          if (reversion){
            /* Fades work back toward the POC; being outside value is the setup. */
            vpf = true;
            if (!inValue) vpfWhy += ' — outside value, with the POC as the magnet';
          } else {
            /* A continuation entered deep inside value is fighting the whole
               traded distribution to get anywhere. */
            vpf = !inValue;
            vpfWhy += inValue ? ' — a continuation starting inside the value area'
                              : ' — outside value, with room to travel';
          }
        }
      } catch (eVpf){ vpf = null; vpfWhy = 'volume profile threw: ' + ((eVpf && eVpf.message) || eVpf); }
    }
    gates.push({ key:'value-area', hard:false, info:true, pass: vpf, why: vpfWhy });

    /* 28 — HIGHER TIMEFRAME CONFIRMATION.

       The one read on this ledger that adds robustness rather than opinion.
       Everything else judges the setup against the timeframe it fired on;
       this asks whether the timeframe above agrees, which is the question a
       desk asks before sizing up. A 1h long inside a 4h downtrend is a
       different trade from the same 1h long inside a 4h uptrend, and until
       now the card could not tell them apart.

       The higher timeframe is RESAMPLED from bars already in hand — no second
       fetch, no second source that can disagree with the first, and both
       views provably describe the same bars.

       Info, not hard. A counter-HTF trade is a real thing a desk takes on
       purpose, and this has no measured record on gold. It argues; it does
       not veto. */
    var htf = null, htfWhy = 'higher timeframe unavailable';
    try {
      var hRows = hgOgResample(rows, 4);
      if (hRows && hRows.length >= 60){
        var hCl = closesOf(hRows);
        var h21 = emaOf(hCl.slice(-60), 21), h50 = emaOf(hCl.slice(-120), 50);
        var hLast = hCl.length ? hCl[hCl.length - 1] : NaN;
        if (isFinite(h21) && isFinite(h50) && isFinite(hLast)){
          var hUp = h21 >= h50;
          var hAgrees = (hit.dir === 'long') ? hUp : !hUp;
          htfWhy = '4x timeframe is ' + (hUp ? 'up' : 'down')
                 + ' (EMA21 ' + h21.toFixed(2) + ' vs EMA50 ' + h50.toFixed(2) + ')';
          if (reversion){
            /* A fade is counter-trend by design on every timeframe. */
            htf = true;
            htfWhy += hAgrees ? ' — and agrees' : ' — counter-trend by design for a reversion mechanic';
          } else {
            htf = hAgrees;
            htfWhy += hAgrees ? ' — agrees, the trade is with the timeframe above'
                              : ' — this is a counter-trend trade against the timeframe above';
          }
        }
      } else if (hRows){
        htfWhy = 'only ' + hRows.length + ' higher-timeframe bars — too few to read a trend';
      }
    } catch (eHtf){ htf = null; htfWhy = 'higher timeframe threw: ' + ((eHtf && eHtf.message) || eHtf); }
    gates.push({ key:'htf-confirm', hard:false, info:true, pass: htf, why: htfWhy });

    /* 29 — REGIME FIT. detectRegime returns { regime, label }.

       Trend mechanics need a trending tape and reversion mechanics need a
       ranging one. That is not a preference, it is the definition of the
       mechanic — and running a breakout in a dead range is the single most
       reliable way to pay the spread repeatedly for nothing. */
    var reg = null, regWhy = 'regime unavailable';
    var regFn = gfn('detectRegime');
    if (regFn){
      try {
        var rg = regFn(rows);
        var rName = rg ? String(rg.regime || '') : '';
        var rLabel = rg ? String(rg.label || rName) : '';
        if (rName){
          var trendy = /trend/i.test(rName);
          var rangey = /range|chop|mean/i.test(rName);
          regWhy = 'regime reads ' + (rLabel || rName);
          if (!trendy && !rangey){
            reg = true;
            regWhy += ' — no clear regime either way';
          } else if (reversion){
            reg = rangey;
            regWhy += rangey ? ' — a ranging tape is what a reversion mechanic wants'
                             : ' — fading a trending tape';
          } else {
            reg = trendy;
            regWhy += trendy ? ' — a trending tape is what a continuation mechanic wants'
                             : ' — a continuation mechanic in a tape that is not trending';
          }
        }
      } catch (eReg){ reg = null; regWhy = 'regime threw: ' + ((eReg && eReg.message) || eReg); }
    }
    gates.push({ key:'regime-fit', hard:false, info:true, pass: reg, why: regWhy });

    /* 30 — VOLATILITY FORECAST. hgVolFromCloses returns
       { sigmaNow, sigmaForecast, sigmaLongRun, source, ... }.

       Every target on this desk is an R multiple of the stop, so whether the
       target is reachable inside the horizon depends on volatility going
       FORWARD, not on what it has just done. A target set in an expanding
       tape and a target set into a collapse are not the same bet, and the
       ladder alone cannot show the difference. */
    var vf = null, vfWhy = 'volatility forecast unavailable';
    var vfFn = gfn('hgVolFromCloses');
    if (vfFn){
      try {
        var vpk = vfFn(closesOf(rows), {});
        var sNow = vpk ? fin(vpk.sigmaNow) : NaN;
        var sFwd = vpk ? fin(vpk.sigmaForecast) : NaN;
        if (isFinite(sNow) && isFinite(sFwd) && sNow > 0){
          var chg = (sFwd - sNow) / sNow;
          vfWhy = 'volatility forecast ' + (chg >= 0 ? '+' : '') + (chg * 100).toFixed(0)
                + '% vs now (' + (vpk.source || 'model') + ')';
          if (chg <= -0.35){
            vf = false;
            vfWhy += ' — contracting hard, the target may not be reachable inside the horizon';
          } else {
            vf = true;
          }
        }
      } catch (eVf){ vf = null; vfWhy = 'volatility forecast threw: ' + ((eVf && eVf.message) || eVf); }
    }
    gates.push({ key:'vol-forecast', hard:false, info:true, pass: vf, why: vfWhy });




    return gates;
  }

  /* This mechanic's OUT-OF-SAMPLE record, or null when the log is absent.
     Never throws: no forward log must leave the gate on the in-sample number
     saying so, not break the scan. */
  function hgOgFwdFor(tab, mechanic){
    try{
      var w = W();
      if (!w || typeof w.hgFwdStats !== 'function' || !tab || !mechanic) return null;
      var f = w.hgFwdStats(tab, mechanic, false);
      return (f && isFinite(fin(f.samples))) ? f : null;
    }catch(e){ return null; }
  }

  /* Grade + plan for one horizon. Reuses omniroute's grade/derive so the
     ticket rule and the R:R correction stay in one place. */
  function hgOgEvaluate(rows, hits, extra, cfg){
    var w = W(), out = [], i;
    if (!hits || !hits.length) return out;
    var gradeFn = (w && typeof w.hgOmniGrade === 'function') ? w.hgOmniGrade : null;
    var deriveFn = (w && typeof w.hgOmniDerivePlan === 'function') ? w.hgOmniDerivePlan : null;
    var planFn = gfn('hgPlanLevels');
    for (i = 0; i < hits.length; i++){
      var hit = hits[i];
      var ex = {}, k;
      for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) ex[k] = extra[k];
      /* UTAD is measured under SPRING — same family in the pool */
      var statKey = (hit.kind === 'UTAD') ? 'SPRING' : hit.kind;
      ex.stats = (extra && extra.stats && extra.stats[statKey]) ? extra.stats[statKey] : null;
      /* Tell the shared gate which forward pool is this desk's, so
         measured-edge can weigh the out-of-sample record for this mechanic
         against the in-sample one instead of only seeing the latter. */
      ex.fwdTab = 'OMNIGOLD:' + cfg.label;
      ex.fwd = hgOgFwdFor(ex.fwdTab, statKey);
      ex.minRr = cfg.minRr;
      ex.minAtrPct = cfg.minAtrPct;
      ex.sessionHard = cfg.sessionHard;
      /* Plan BEFORE gates: the cost-drag gate needs the actual stop distance,
         so the levels must exist before the ledger runs. */
      var plan = null;
      if (planFn){
        /* Gold opts into structure stops.
           With the crypto default, 65% of gold setups had their stop moved
           off structure to a flat 1.5xATR — 53% nearer than the level that
           actually invalidates the idea, which on gold sits inside ordinary
           session noise. Targets are R-multiples OF the risk, so keeping the
           stop on structure widens the target with it: the same 2R trade, now
           measured against real invalidation, with fixed-risk sizing taking a
           smaller position for the same dollars at risk. */
        try {
          plan = planFn(hit.dir, rows, undefined, { minRr: cfg.minRr, capMode: 'structure' });
        } catch (e) { plan = null; }
      }
      if (plan && deriveFn) plan = deriveFn(plan);
      ex.planRisk = (plan && isFinite(fin(plan.risk))) ? fin(plan.risk) : NaN;
      ex.allHits = hits;          /* so the consensus gate can see the rest of the scan */
      var gates = hgOgGates(rows, hit, ex);
      var grade = gradeFn ? gradeFn(gates) : { ticket:false, vetoes:[], unknown:[], degraded:[], evaluated:0, total:gates.length, verdict:'engine unavailable' };
      out.push({
        horizon: cfg.label, kind: hit.kind, dir: hit.dir, level: hit.level, why: hit.why,
        gates: gates, grade: grade, plan: plan,
        /* Carried on the candidate so the ranker can put the setup the rest
           of the desk agrees with above the one nothing supports. */
        consensus: hgOgConsensus(hits, hit),
        family: hgOgFamilyOf(hit.kind),
        rr: (plan && isFinite(fin(plan.rr1))) ? fin(plan.rr1) : NaN
      });
    }
    return out;
  }

  /* ==================== data ==================== */

  /* The app's gold chain, in order, all feature-checked. Whichever answers
     is NAMED — a PAXG-derived setup is not XAUUSD spot and the user should
     see which instrument produced their levels. */
  function hgOgFetchRows(tf, n){
    var xm = gfn('getXmGoldCandles'), gg = gfn('getGoldCandles'), bk = gfn('binanceKlines');
    return Promise.resolve()
      .then(function(){ return xm ? xm(tf, n) : null; })
      .catch(function(){ return null; })
      .then(function(a){
        if (a && a.rows && a.rows.length) return { rows: a.rows, source: a.source || 'xm-xauusd' };
        return Promise.resolve().then(function(){ return gg ? gg(tf, n) : null; })
          .catch(function(){ return null; })
          .then(function(b){
            if (b && b.rows && b.rows.length) return { rows: b.rows, source: b.source || 'gold-spot' };
            return Promise.resolve().then(function(){ return bk ? bk('PAXGUSDT', tf, n) : null; })
              .catch(function(){ return null; })
              .then(function(c){
                if (c && c.length) return { rows: c, source: 'binance-paxg' };
                return { rows: [], source: null };
              });
          });
      });
  }

  /* ==================== render ==================== */

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function pill(t, c){ return '<span class="gpip ' + (c || '') + '">' + esc(t) + '</span>'; }
  /* Gold prints in dollars — 2dp is right for XAUUSD and PAXG alike. */
  /* isFinite(null) is TRUE and +null is 0, so formatting a null through the
     natural guard prints a confident "0.00" for a value that is absent. Every
     cleared R:R and every venue field that legitimately arrives as null went
     through here. fin() maps null/undefined/'' to NaN first. */
  function fmtPx(n){ var v = fin(n); return isFinite(v) ? v.toFixed(2) : '—'; }
  function fmt(n, d){ var v = fin(n); return isFinite(v) ? v.toFixed(d == null ? 2 : d) : '—'; }

  /* 62th, 23th, 2th. Ordinals are not "th" for everything. */
  function hgOgOrdinal(n){
    var v = Math.round(n), t = v % 100, u = v % 10;
    var suf = (t >= 11 && t <= 13) ? 'th' : (u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th');
    return v + suf;
  }

  function gateLine(g){
    /* An info gate does not veto, so it must not print VETO next to a TICKET
       badge — the row would contradict the card. It reads AGAINST: the app
       disagrees, and is saying so without standing the trade aside. */
    var vetoed = (g.pass === false) && !g.info;
    var against = (g.pass === false) && g.info;
    var cls = g.pass === true ? 'ok' : (vetoed ? 'bad' : '');
    var mark = g.pass === true ? 'PASS'
             : vetoed ? 'VETO'
             : against ? 'AGAINST'
             : (g.hard ? 'NO DATA' : 'UNCHECKED');
    return '<li>' + pill(mark, cls) + ' <b>' + esc(g.key) + '</b> <span class="dim">' + esc(g.why) + '</span></li>';
  }


  /* ==================== the pick ====================

     One setup per horizon, marked out from the rest.

     It is called the STRONGEST CASE and not "highest probability to win",
     because the desk cannot honestly say the second thing. A probability
     needs a settled record; most of these 27 mechanics have never settled a
     trade here, and the ones that have are 0 for 13. Printing a win
     percentage next to a setup that has no measured record would be inventing
     the one number the user would most reasonably act on.

     So the pick is ranked on the evidence that DOES exist, in this order:

       1. it must be a TICKET — a vetoed setup is never promoted
       2. how many independent mechanic families agree with it
       3. its own settled out-of-sample record, where it has one
       4. how much of the ledger could actually be evaluated
       5. R:R

     and the card states which of those it is standing on, so "strongest" is
     auditable rather than a colour. Where a measured record exists it is
     quoted with its sample count; where none exists the card says so in those
     words instead of leaving a confident-looking gap. */

  /* The pick's own colour, injected once and scoped to this tab's cards.

     Deliberately VIOLET, not green: green already means PASS on every gate
     row in the app, and reusing it here would read as "this one passed" —
     which says nothing, since every pick is a ticket by construction. A
     colour that means nothing elsewhere can mean exactly one thing here.

     Colours are set explicitly rather than inherited so the card reads the
     same on the light and dark stylesheets, and the accent is carried by a
     left rule and a tint, never by text colour alone — a card that says what
     it means only in colour says nothing to a reader who cannot see it, which
     is why the badge and the reasons are spelled out in words too. */
  function hgOgInjectPickStyles(){
    var d = (typeof document !== 'undefined') ? document : null;
    if (!d || !d.head) return;
    if (d.getElementById('og-pick-css')) return;
    var st = d.createElement('style');
    st.id = 'og-pick-css';
    st.textContent =
      '#ogCards .card.og-pick{'
    +   'border-left:4px solid #7c3aed;'
    +   'background:linear-gradient(90deg,rgba(124,58,237,.075),transparent 42%);'
    +   'box-shadow:0 0 0 1px rgba(124,58,237,.30),0 6px 20px -8px rgba(124,58,237,.40);'
    + '}'
    + '#ogCards .card.og-pick .ttl{color:#6d28d9}'
    + '#ogCards .gpip.pick{'
    +   'background:#7c3aed;border:1px solid #6d28d9;color:#fff;'
    +   'font-weight:700;letter-spacing:.04em;'
    + '}'
    + '#ogCards .og-pick-why{'
    +   'margin:8px 0;padding:8px 10px;'
    +   'border:1px solid rgba(124,58,237,.32);border-left:3px solid #7c3aed;'
    +   'background:rgba(124,58,237,.06);border-radius:4px;font-size:12px;line-height:1.5;'
    + '}'
    + '#ogCards .og-pick-why b{color:#6d28d9}'
    + '#ogCards .og-pick-why ul{margin:5px 0 5px 16px;padding:0}'
    + '#ogCards .og-pick-why li{margin:2px 0}'
    + '#ogCards .og-pick-none{'
    +   'border-left:3px solid rgba(124,58,237,.42);'
    +   'background:rgba(124,58,237,.04);margin-bottom:8px;'
    + '}'
    /* Dark stylesheets: same hue, lifted so it holds on a dark ground. */
    + '@media (prefers-color-scheme:dark){'
    +   '#ogCards .card.og-pick{border-left-color:#a78bfa;'
    +     'background:linear-gradient(90deg,rgba(167,139,250,.13),transparent 42%);'
    +     'box-shadow:0 0 0 1px rgba(167,139,250,.34),0 6px 20px -8px rgba(167,139,250,.34)}'
    +   '#ogCards .card.og-pick .ttl{color:#c4b5fd}'
    +   '#ogCards .gpip.pick{background:#7c3aed;border-color:#a78bfa;color:#fff}'
    +   '#ogCards .og-pick-why{border-color:rgba(167,139,250,.36);border-left-color:#a78bfa;'
    +     'background:rgba(167,139,250,.10)}'
    +   '#ogCards .og-pick-why b{color:#c4b5fd}'
    +   '#ogCards .og-pick-none{border-left-color:rgba(167,139,250,.45);background:rgba(167,139,250,.07)}'
    + '}';
    d.head.appendChild(st);
  }

  function hgOgPickBasis(c){
    var bits = [], fwd = null, cons = c && c.consensus;
    if (cons && cons.nAgree > 0){
      bits.push(cons.nAgree + ' mechanic famil' + (cons.nAgree === 1 ? 'y agrees' : 'ies agree')
              + (cons.agree && cons.agree.length ? ' (' + cons.agree.join(', ') + ')' : '')
              + (cons.nAgainst ? ', ' + cons.nAgainst + ' against' : ', none against'));
    }
    /* The only number here that is out-of-sample. */
    var g, i;
    for (i = 0; c && c.gates && i < c.gates.length; i++){
      g = c.gates[i];
      if (g && g.key === 'measured-edge'){ fwd = g; break; }
    }
    if (fwd){
      if (/settled out-of-sample/.test(String(fwd.why))) bits.push('own settled record: ' + fwd.why);
      else bits.push('no settled out-of-sample record yet — nothing here is a measured win rate');
    }
    var ev = (c && c.grade && c.grade.evaluated) || 0;
    var tot = (c && c.grade && c.grade.total) || 0;
    if (tot) bits.push(ev + ' of ' + tot + ' checks could be evaluated');
    return bits;
  }

  /* Highest-ranked TICKET on one horizon, or null. Deliberately null rather
     than "the best of a bad lot": promoting a vetoed setup because it was the
     least-vetoed would defeat the entire ledger. */
  function hgOgPickFor(ranked, horizon){
    if (!ranked || !ranked.length) return null;
    var i, c;
    for (i = 0; i < ranked.length; i++){
      c = ranked[i];
      if (!c || c.horizon !== horizon) continue;
      if (!(c.grade && c.grade.ticket)) continue;
      if (!c.plan) continue;              /* no levels means nothing to act on */
      return c;
    }
    return null;
  }

  function setupCard(c){
    var ev = (c.grade.evaluated || 0), tot = (c.grade.total || 0);
    var badge = c.grade.ticket ? pill('TICKET','ok') : pill(c.grade.vetoes.length ? 'VETO' : 'WATCH', c.grade.vetoes.length ? 'bad' : '');
    if (tot) badge += ' ' + pill(ev + '/' + tot + ' checks', ev * 2 >= tot ? '' : 'bad');
    if (c.topPick) badge = pill('STRONGEST ' + c.horizon, 'pick') + ' ' + badge;
    var h = '<div class="card' + (c.topPick ? ' og-pick' : '') + '">';
    h += '<div class="ttl">GOLD · ' + esc(c.horizon) + ' · ' + esc(c.kind) + ' ' + esc(c.dir.toUpperCase()) + ' ' + badge + '</div>';
    h += '<div class="dim">' + esc(c.why) + '</div>';
    if (c.alsoKinds && c.alsoKinds.length){
      h += '<div class="dim">also fired here on identical levels: ' + esc(c.alsoKinds.join(', '))
        +  ' — ' + (c.alsoKinds.length + 1) + ' mechanics, one trade</div>';
    }
    if (c.topPick){
      /* What the pick is standing on, in words, so the colour is never the
         whole argument. */
      var basis = hgOgPickBasis(c), bi;
      h += '<div class="og-pick-why"><b>Strongest case on ' + esc(c.horizon)
        +  '</b> — ranked on the evidence the desk actually has:<ul>';
      for (bi = 0; bi < basis.length; bi++) h += '<li>' + esc(basis[bi]) + '</li>';
      h += '</ul><span class="dim">Strongest of what fired now. NOT a win probability: '
        +  'a probability needs a settled record, and this desk does not have one yet.</span></div>';
    }
    if (c.plan){
      h += '<div class="plan">ENTRY ' + fmtPx(c.plan.entry) + ' · STOP ' + fmtPx(c.plan.stop)
        +  ' · T1 ' + fmtPx(c.plan.t1) + ' · T2 ' + fmtPx(c.plan.t2)
        +  ' · <b>R:R ' + fmt(c.plan.rr1, 2) + '</b> · risk ' + fmt(c.plan.riskPct, 2) + '%</div>';
      if (c.plan.note) h += '<div class="dim">' + esc(c.plan.note) + '</div>';
    } else {
      h += '<div class="dim">no plan — structure could not clear the R floor, so no levels are shown.</div>';
    }
    h += '<ul class="lst">';
    for (var i = 0; i < c.gates.length; i++) h += gateLine(c.gates[i]);
    h += '</ul></div>';
    return h;
  }

  function renderPooled(pool, label, minRr, fwdTab){
    if (!pool) return '';
    var keys = OG_MECHANICS.slice();
    /* Forward (out-of-sample) counts for the same mechanics. These accumulate
       one record per firing across scans and are the only numbers here that
       are not re-read from the same window every time. */
    var fwdPool = null;
    var fwdFn = gfn('hgFwdPool');
    if (fwdFn && fwdTab){ try { fwdPool = fwdFn(fwdTab); } catch (e) { fwdPool = null; } }
    var h = '<h4>' + esc(label) + ' — measured on this horizon</h4>';
    h += '<table class="tbl"><thead><tr><th>MECHANIC</th><th>SAMPLES</th><th>T1-FIRST</th><th>EXPECTANCY</th><th>σ</th><th>READ</th><th>FORWARD</th></tr></thead><tbody>';
    var pBreak = 1 / (1 + minRr);
    for (var i = 0; i < keys.length; i++){
      var k = keys[i], p = pool[k];
      var fwd = fwdPool ? fwdPool[k] : null;
      var fwdTxt = fwdCell(fwd);
      if (!p || !p.samples){
        h += '<tr><td><b>' + k + '</b></td><td class="dim">0</td><td class="dim">—</td><td class="dim">—</td><td class="dim">—</td><td class="dim">never fired here</td><td>' + fwdTxt + '</td></tr>';
        continue;
      }
      /* Same shared verdict helper omniroute's table uses, so the two
         cannot drift apart in wording or in threshold. */
      var rd = (W() && typeof W().hgOmniPoolRead === 'function')
             ? W().hgOmniPoolRead(p, minRr, MIN_SAMPLES)
             : { z: NaN, read: 'engine unavailable', need: null, cls: '' };
      var z = rd.z, read = rd.read, cls = rd.cls;
      var needTxt = rd.need ? (' <span class="dim">(needs ~' + rd.need + ')</span>') : '';
      h += '<tr><td><b>' + k + '</b></td><td>' + p.samples + needTxt + '</td><td>' + (p.hit * 100).toFixed(0) + '%</td>'
        +  '<td>' + (p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R</td>'
        +  '<td>' + (z >= 0 ? '+' : '') + z.toFixed(2) + 'σ</td>'
        +  '<td>' + pill(read, cls) + '</td>'
        +  '<td>' + fwdTxt + '</td></tr>';
    }
    return h + '</tbody></table>';
  }

  /* Forward column. Deliberately terse: settled count, hit rate, and how many
     are still open. Until a mechanic has settled trades this reads "—", which
     is the honest state on day one — the log has to be fed by scans over time
     before it can say anything. */
  function fwdCell(f){
    if (!f || (!f.samples && !f.open)) return '<span class="dim">—</span>';
    if (!f.samples) return '<span class="dim">' + f.open + ' open</span>';
    return '<b>' + f.samples + '</b> · ' + (f.hit * 100).toFixed(0) + '%'
         + (f.open ? (' <span class="dim">(+' + f.open + ' open)</span>') : '');
  }

  /* ==================== the scan ==================== */

  function scanHorizon(cfg, shared, ui){
    var w = W();
    var dropFn = (w && typeof w.hgOmniDropForming === 'function') ? w.hgOmniDropForming : null;
    var dailyFn = (w && typeof w.hgOmniDailyHtf === 'function') ? w.hgOmniDailyHtf : null;
    var btFn = (w && typeof w.hgOmniBacktestOne === 'function') ? w.hgOmniBacktestOne : null;
    var poolFn = (w && typeof w.hgOmniPoolStats === 'function') ? w.hgOmniPoolStats : null;

    if (ui) ui.stat.textContent = 'fetching gold ' + cfg.tf + ' bars…';
    return hgOgFetchRows(cfg.tf, cfg.bars).then(function(got){
      var rows = got.rows || [];
      /* Sanitise before anything reads a bar. dropFn (omniroute's) now does
         this too, but it is feature-checked — without it gold would ingest a
         hole-punched array straight into the detectors, and a venue dropping
         one candle would take the whole horizon down. A hole in the data is a
         data problem, not something each detector should have to guard. */
      var okRows = [], ri, rr;
      for (ri = 0; ri < rows.length; ri++){
        rr = rows[ri];
        if (!rr || typeof rr !== 'object') continue;
        /* fin(), NOT num(): num(null) is 0 because +null is 0, which would
           admit a null close as the price zero. */
        if (!isFinite(fin(rr.c))) continue;
        okRows.push(rr);
      }
      rows = okRows;
      if (dropFn) rows = dropFn(rows, cfg.tf);        // closed candles only
      if (!rows.length) return { cfg: cfg, rows: [], source: got.source, cands: [], pooled: null };

      /* walk-forward every mechanic on THIS horizon */
      var stats = {}, pooled = null;
      if (btFn){
        var fns = {
          SPRING: function(r){ var g = w.hgOmniRange ? w.hgOmniRange(r, 40) : null; return g && w.hgOmniSpring ? w.hgOmniSpring(r, g) : null; },
          PO3:    function(r){ return w.hgOmniPo3 ? w.hgOmniPo3(r, 6) : null; },
          ORB:    function(r){ return w.hgOmniOrb ? w.hgOmniOrb(r, 3) : null; },
          ABSORB: function(r){ var g = w.hgOmniRange ? w.hgOmniRange(r, 40) : null; return g && w.hgOmniAbsorb ? w.hgOmniAbsorb(r, g) : null; },
          VALUE:  function(r){ var p = w.hgOmniProfile ? w.hgOmniProfile(r, 24) : null; return p && w.hgOmniValueReject ? w.hgOmniValueReject(r, p) : null; },
          MMOVE:  function(r){ return w.hgOmniMeasuredMove ? w.hgOmniMeasuredMove(r, 10) : null; },
          'ASIA-BREAK':   function(r){ var a = hgOgAsiaRange(r); return a ? hgOgAsiaBreak(r, a) : null; },
          'KZ-JUDAS':     function(r){ var a = hgOgAsiaRange(r); return a ? hgOgKzJudas(r, a, gfn('goldKillzone')) : null; },
          'ADR-FADE':     function(r){ var a = hgOgAdr(r, 14); return a ? hgOgAdrFade(r, a) : null; },
          'ROUND-MAGNET': function(r){ return hgOgRoundMagnet(r); },
          'PDH-SWEEP':    function(r){ var p = hgOgPrevDay(r); var h = p ? hgOgPdSweep(r, p) : null; return (h && h.kind === 'PDH-SWEEP') ? h : null; },
          'PDL-SWEEP':    function(r){ var p = hgOgPrevDay(r); var h = p ? hgOgPdSweep(r, p) : null; return (h && h.kind === 'PDL-SWEEP') ? h : null; },
          'LONDON-FIX':   function(r){ return hgOgLondonFix(r); },
          'VWAP-REVERT':  function(r){ return hgOgVwapRevert(r); },
          'NR7-BREAK':    function(r){ return hgOgNr7Break(r); },
          'SMT-DIVERGE':  function(r){ return hgOgSmtDiverge(r); },
          'TREND-RECLAIM':function(r){ return hgOgTrendReclaim(r); },
          'PWH-SWEEP':    function(r){ var q = hgOgPrevWeek(r); var h = q ? hgOgPwSweep(r, q) : null; return (h && h.kind === 'PWH-SWEEP') ? h : null; },
          'PWL-SWEEP':    function(r){ var q = hgOgPrevWeek(r); var h = q ? hgOgPwSweep(r, q) : null; return (h && h.kind === 'PWL-SWEEP') ? h : null; },
          'FVG-FILL':     function(r){ return hgOgFvgFill(r); },
          'BOS-RETEST':   function(r){ return hgOgBosRetest(r); },
          'EQH-SWEEP':    function(r){ var h = hgOgPoolSweep(r); return (h && h.kind === 'EQH-SWEEP') ? h : null; },
          'EQL-SWEEP':    function(r){ var h = hgOgPoolSweep(r); return (h && h.kind === 'EQL-SWEEP') ? h : null; },
          'SQUEEZE-FIRE': function(r){ return hgOgSqueezeFire(r); },
          'RSI-DIVERGE':  function(r){ return hgOgRsiDiverge(r); },
          'GSR-EXTREME':  function(r){ return hgOgGsrExtreme(r); },
          'AVWAP-RECLAIM':function(r){ return hgOgAvwapReclaim(r); },
          'CUSUM-SHIFT':  function(r){ return hgOgCusumShift(r); },
          'VOL-EXPANSION':function(r){ return hgOgVolExpansion(r); },
          'PIN-REJECT':   function(r){ return hgOgPinReject(r); },
          'ENGULF-LEVEL': function(r){ return hgOgEngulfLevel(r); },
          'POC-REVERT':   function(r){ return hgOgPocRevert(r); },
          'COINT-SPREAD': function(r){ return hgOgCointSpread(r); },
          'THREE-BAR':    function(r){ return hgOgThreeBar(r); }
        };
        var k;
        for (k in fns) if (Object.prototype.hasOwnProperty.call(fns, k)){
          stats[k] = btFn(rows, fns[k], { rMult: cfg.minRr, horizon: cfg.horizonBars, warm: cfg.warm });
        }
        pooled = poolFn ? poolFn([stats]) : stats;
      }

      /* Settle any forward records this symbol has open, using the bars just
         fetched. Done BEFORE recording the current firing, so a setup can
         never be settled by the bar it was written on. */
      var fwdResolve = gfn('hgFwdResolve');
      /* tf is passed as null on purpose: settle EVERY open XAUUSD record, not
         only ones from this horizon. GOLD SWING, GOLD SCALP and GOLD PRO all
         record against XAUUSD, and a user who runs only one gold tab should
         still see their records resolve. Settling a 4h record with 1h bars is
         FINER, not coarser; the reverse is conservative under the "one bar
         spanning both counts as a stop" rule. Both directions are safe. */
      if (fwdResolve){
        try { fwdResolve('XAUUSD', null, rows); }
        catch (e) { var wf = gfn('hgFwdWarn'); if (wf) { try { wf('omnigold:resolve', e); } catch (eW) {} } }
      }

      var hits = hgOgDetect(rows, {});
      var extra = {
        htf: dailyFn ? dailyFn(rows) : null,
        killzone: shared.killzone, macro: shared.macro, yield: shared.yieldGuard,
        adr: hgOgAdr(rows, 14), news: shared.news, stats: pooled
      };
      var cands = hgOgEvaluate(rows, hits, extra, cfg);

      /* Record every firing that carries a plan — not only tickets. The
         in-sample pool measures the raw mechanic, so the forward pool must
         measure the same thing or the two cannot be compared. The ticket flag
         rides along so the gates can be judged separately later. */
      var fwdRecord = gfn('hgFwdRecord');
      if (fwdRecord && rows.length){
        var barT = num(rows[rows.length - 1].t);
        for (var ci = 0; ci < cands.length; ci++){
          var c = cands[ci];
          if (!c.plan) continue;
          try {
            fwdRecord({
              tab: 'OMNIGOLD:' + cfg.label, mechanic: c.kind, sym: 'XAUUSD', tf: cfg.tf,
              dir: c.dir, entry: c.plan.entry, stop: c.plan.stop, t1: c.plan.t1,
              barT: barT, horizonBars: cfg.horizonBars, ticket: !!(c.grade && c.grade.ticket)
            });
          } catch (e) { var wr = gfn('hgFwdWarn'); if (wr) { try { wr('omnigold:record', e); } catch (eW) {} } }
        }
      }
      return { cfg: cfg, rows: rows, source: got.source, cands: cands, pooled: pooled };
    }).catch(function(){
      return { cfg: cfg, rows: [], source: null, cands: [], pooled: null };
    });
  }

  function runScan(ui){
    if (__og.busy) return Promise.resolve();
    var w = W();
    if (!w || typeof w.hgOmniDetect !== 'function'){
      ui.stat.textContent = 'omniroute.js engine unavailable — OMNIGOLD builds on it; load order problem.';
      return Promise.resolve();
    }
    __og.busy = true;
    ui.btn.disabled = true;
    ui.cards.innerHTML = '';
    ui.pool.innerHTML = '';

    /* market-wide context, fetched once for both horizons */
    ui.stat.textContent = 'reading macro + session context…';
    var macroFn = gfn('getGoldMacro') || gfn('getGoldMacroCached');
    var shared = { killzone: null, macro: null, yieldGuard: null, news: null };
    try { var kz = gfn('goldKillzone'); if (kz) shared.killzone = kz(Date.now()); } catch (e) {}
    try { var nr = gfn('hgNewsRisk'); if (nr) shared.news = nr('XAUUSD'); } catch (e) {}

    return Promise.resolve()
      .then(function(){ return macroFn ? macroFn() : null; })
      .catch(function(){ return null; })
      .then(function(m){
        shared.macro = m || null;
        var yg = gfn('validateYieldCorrelation');
        if (yg && m && m.us10yRows){
          try { shared.yieldGuard = yg(m.us10yRows, 'long'); } catch (e) { shared.yieldGuard = null; }
        }
        return scanHorizon(HORIZONS.scalp, shared, ui);
      })
      .then(function(scalp){
        return scanHorizon(HORIZONS.swing, shared, ui).then(function(swing){
          return { scalp: scalp, swing: swing };
        });
      })
      .then(function(res){
        var rankFn = (w && typeof w.hgOmniRank === 'function') ? w.hgOmniRank : function(a){ return a; };
        var all = (res.scalp.cands || []).concat(res.swing.cands || []);
        var ranked = rankFn(all);
        __og.snap = { at: Date.now(), rows: ranked, scalp: res.scalp.pooled, swing: res.swing.pooled };
        __og.ran = true;
        __og.src = { scalp: res.scalp.source, swing: res.swing.source };

        var tickets = 0, i;
        for (i = 0; i < ranked.length; i++) if (ranked[i].grade.ticket) tickets++;
        var srcNote = 'source: scalp ' + (res.scalp.source || 'none') + ' · swing ' + (res.swing.source || 'none');
        __og.lastStat = ranked.length + ' setup(s) · ' + tickets + ' ticket(s) · ' + srcNote;
        var warn = '';
        if (!res.scalp.rows.length && !res.swing.rows.length){
          warn = '  · NO gold bars from any source (XM bridge, spot proxy, PAXG) — this is a data problem, not a quiet market';
        }
        ui.stat.textContent = __og.lastStat + warn;

        ui.pool.innerHTML = renderPooled(res.scalp.pooled, 'SCALP (' + HORIZONS.scalp.tf + ', ' + HORIZONS.scalp.minRr + 'R)', HORIZONS.scalp.minRr, 'OMNIGOLD:SCALP')
                          + renderPooled(res.swing.pooled, 'SWING (' + HORIZONS.swing.tf + ', ' + HORIZONS.swing.minRr + 'R)', HORIZONS.swing.minRr, 'OMNIGOLD:SWING')
                          + (function(){
                              /* The two horizons record under separate tabs, so the shared
                                 panel is rendered twice — a mechanic that pays on 1h need not
                                 pay on 4h, and merging them would hide exactly that. */
                              var pf = gfn('hgFwdPanelHTML');
                              if (!pf) return '';
                              return pf('OMNIGOLD:SCALP', { minRr: HORIZONS.scalp.minRr, title: 'FORWARD — SCALP, out-of-sample' })
                                   + pf('OMNIGOLD:SWING', { minRr: HORIZONS.swing.minRr, title: 'FORWARD — SWING, out-of-sample' });
                            })()
                          + '<div class="note">Walk-forward on the same bars just read, per horizon and never merged — a mechanic that pays on 4h need not pay on 1h. '
                          + 'A bar spanning both stop and target counts as a STOP. In-sample on a short window; under ' + MIN_SAMPLES + ' samples is noise. '
                          + '<b>Every figure above is GROSS of spread and commission.</b> That matters most intraday: at an assumed $'
                          + ASSUMED_SPREAD_USD.toFixed(2) + ' gold spread, a $3 scalp stop gives up ~20% of 1R round-trip, so a +0.38R gross read is nearer +0.19R net. '
                          + 'The per-card <b>cost-drag</b> gate prices this against each setup’s own stop.</div>';

        if (!ranked.length){
          ui.cards.innerHTML = (!res.scalp.rows.length && !res.swing.rows.length)
            ? '<div class="note warn">No gold candles were returned by any source, so nothing could be scanned. Check the XM bridge / spot proxy before reading anything into this.</div>'
            : '<div class="empty">no gold setup fired on either horizon. That is a normal result — the detectors are meant to be quiet.</div>';
          return;
        }
        /* ONE pick per horizon, marked and floated to the top so the answer
           to "what do I trade" is the first thing on the page rather than
           something to be reconstructed from a list. A horizon with no ticket
           says so outright — an empty result is an answer, and dressing up
           the least-vetoed setup as a pick would defeat the ledger. */
        var pickScalp = hgOgPickFor(ranked, HORIZONS.scalp.label);
        var pickSwing = hgOgPickFor(ranked, HORIZONS.swing.label);
        if (pickScalp) pickScalp.topPick = true;
        if (pickSwing) pickSwing.topPick = true;

        var ordered = [];
        if (pickScalp) ordered.push(pickScalp);
        if (pickSwing) ordered.push(pickSwing);
        for (i = 0; i < ranked.length; i++){
          if (ranked[i] !== pickScalp && ranked[i] !== pickSwing) ordered.push(ranked[i]);
        }

        var h = '';
        [[HORIZONS.scalp.label, pickScalp], [HORIZONS.swing.label, pickSwing]].forEach(function(pair){
          if (pair[1]) return;
          h += '<div class="note og-pick-none">No ' + esc(pair[0]) + ' pick: nothing on that horizon '
            +  'cleared the ledger this scan. That is a result, not a gap — the alternative would be '
            +  'promoting a setup the desk already vetoed.</div>';
        });
        /* Collapse duplicate trades — see omniroute. Several mechanics firing
           on the same bar produce the same symbol, direction, entry and stop:
           that is one trade with several names, and showing it several times
           reads as several opportunities. Horizon is part of the key, because
           the same levels on SCALP and SWING are genuinely two tickets with
           different targets and different time stops. */
        var ogTradeKey = function(c){
          var pl = c.plan || {};
          var e = isFinite(fin(pl.entry)) ? fin(pl.entry).toPrecision(8) : 'na';
          var st = isFinite(fin(pl.stop)) ? fin(pl.stop).toPrecision(8) : 'na';
          return String(c.horizon) + '|' + String(c.dir) + '|' + e + '|' + st;
        };
        var ogSeen = {}, ogCollapsed = [];
        for (i = 0; i < ordered.length; i++){
          var ok2 = ogTradeKey(ordered[i]);
          if (ogSeen[ok2] !== undefined){
            var own = ogCollapsed[ogSeen[ok2]];
            if (!own.alsoKinds) own.alsoKinds = [];
            if (own.alsoKinds.indexOf(ordered[i].kind) < 0 && ordered[i].kind !== own.kind){
              own.alsoKinds.push(ordered[i].kind);
            }
            continue;
          }
          ogSeen[ok2] = ogCollapsed.length;
          ogCollapsed.push(ordered[i]);
        }
        for (i = 0; i < ogCollapsed.length; i++) h += setupCard(ogCollapsed[i]);
        ui.cards.innerHTML = h;
      })
      .catch(function(err){
        ui.stat.textContent = 'scan failed: ' + ((err && err.message) || err);
        try { if (typeof console !== 'undefined' && console.error) console.error('[omnigold] scan failed', err); } catch (e) {}
      })
      .then(function(){
        __og.busy = false;
        ui.btn.disabled = false;
      });
  }

  /* ==================== mount / refresh ==================== */

  function mountOmnigold(el){
    if (!el) return;
    el.innerHTML =
      '<div class="panel">'
      + '<h2>OmniGold — gold desk setups <span>XAUUSD · scalp ' + HORIZONS.scalp.tf + ' + swing ' + HORIZONS.swing.tf
      +   ' · asia break · killzone judas · adr fade · round magnet · + the OmniRoute six</span></h2>'
      + '<div class="note" style="margin-bottom:10px">OmniRoute’s method pointed at gold: mechanical detectors, a hard-gate ledger, '
      + 'walk-forward self-measurement and evidence coverage — plus the mechanics gold desks actually trade. '
      + '<b>Two horizons are measured separately</b>, because a mechanic that pays on 4h need not pay intraday. '
      + 'The perp gates have no meaning here (spot gold has no funding, OI, retail ratio or taker flow) and are deliberately absent rather than faked; '
      + 'in their place sit session, real-rate macro, DXY inverse, yield guard and ADR budget. '
      + 'Levels come from the house plan engine; cards order by evidence coverage. Nothing here is a profit forecast.</div>'
      + '<div class="row"><button class="btn" id="ogRun">RUN GOLD SCAN</button></div>'
      + '<div class="note" id="ogStat">idle — press RUN. Fetches two horizons of gold bars, then measures every mechanic on each.</div>'
      + '<div id="ogPool" style="margin-top:10px"></div>'
      + '<div class="cards" id="ogCards" style="margin-top:12px"></div>'
      + '</div>';

    var ui = {
      btn: el.querySelector('#ogRun'), stat: el.querySelector('#ogStat'),
      pool: el.querySelector('#ogPool'), cards: el.querySelector('#ogCards')
    };
    if (!ui.btn || !ui.stat || !ui.cards || !ui.pool) return;
    __og.ui = ui;
    hgOgInjectPickStyles();

    var w = W(), missing = [];
    if (typeof fetch !== 'function') missing.push('fetch');
    if (!w || typeof w.hgOmniDetect !== 'function') missing.push('omniroute.js engine');
    if (!gfn('getXmGoldCandles') && !gfn('getGoldCandles') && !gfn('binanceKlines')) missing.push('every gold candle source');
    if (!gfn('hgPlanLevels')) missing.push('hgPlanLevels (no entry/stop/target)');
    if (missing.length){
      ui.stat.textContent = 'missing: ' + missing.join(', ') + ' — the scan degrades honestly where it can.';
    }
    if (!w || typeof w.hgOmniDetect !== 'function' || typeof fetch !== 'function'){
      ui.btn.disabled = true;
      return;
    }
    ui.btn.addEventListener('click', function(){ return runScan(ui); });
  }

  function refreshOmnigold(){
    return Promise.resolve().then(function(){
      if (__og.busy) return 'busy';
      if (!__og.ran) return 'skipped: not run yet';
      var ui = __og.ui;
      if (ui) return runScan(ui).then(function(){ return __og.lastStat || 'rescanned'; });
      return __og.lastStat || 'no ui mounted';
    }).catch(function(){ return 'refresh failed'; });
  }

  /* ============================ exports ============================ */
  if (typeof window !== 'undefined'){
    window.hgOgAsiaRange = hgOgAsiaRange;
    window.hgOgAsiaBreak = hgOgAsiaBreak;
    window.hgOgKzJudas = hgOgKzJudas;
    window.hgOgAdr = hgOgAdr;
    window.hgOgAdrFade = hgOgAdrFade;
    window.hgOgRoundMagnet = hgOgRoundMagnet;
    window.hgOgResample = hgOgResample;   /* exported so the higher-timeframe build is testable directly */
    window.hgOgDetect = hgOgDetect;
    window.hgOgGates = hgOgGates;
    window.hgOgEvaluate = hgOgEvaluate;
    /* hgOgReport() — the desk record, on demand, from the console.

       The forward log lives in localStorage, so it can only be read in the
       browser that produced it. Asking someone to paste a twenty-line
       snippet to see their own results is a way of not showing them. */
    window.hgOgReport = function hgOgReport(){
      var sf = gfn('hgFwdStats'), pf = gfn('hgFwdPool');
      if (!sf || !pf) return 'hg-forward.js is not loaded — no record to read.';
      var out = [];
      ['OMNIGOLD:SCALP', 'OMNIGOLD:SWING'].forEach(function(tab){
        var st, pool;
        try { st = sf(tab, null, false); pool = pf(tab) || {}; }
        catch (e) { out.push(tab + ': unreadable (' + ((e && e.message) || e) + ')'); return; }
        out.push('=== ' + tab + ' ===');
        out.push('  settled ' + st.samples + '  wins ' + st.wins + '  losses ' + st.losses
               + '  open ' + st.open + '  expired ' + st.expired);
        out.push('  hit ' + (isFinite(st.hit) ? (st.hit * 100).toFixed(0) + '%' : '—')
               + '   expectancy ' + (isFinite(st.expR) ? ((st.expR >= 0 ? '+' : '') + st.expR.toFixed(2) + 'R') : '—'));
        var rows = [], k;
        for (k in pool){
          if (!Object.prototype.hasOwnProperty.call(pool, k)) continue;
          if (pool[k] && (pool[k].samples || pool[k].open)) rows.push([k, pool[k]]);
        }
        rows.sort(function(a, b){ return (b[1].samples || 0) - (a[1].samples || 0); });
        if (!rows.length){ out.push('  no mechanic has recorded anything yet on this horizon'); return; }
        rows.forEach(function(r){
          var p = r[1];
          out.push('    ' + String(r[0] + '               ').slice(0, 15)
                 + ' settled ' + String('  ' + p.samples).slice(-3)
                 + '  W' + String('  ' + p.wins).slice(-3) + ' L' + String('  ' + p.losses).slice(-3)
                 + '  open ' + String('  ' + p.open).slice(-3)
                 + '  hit ' + (isFinite(p.hit) ? String('   ' + (p.hit * 100).toFixed(0) + '%').slice(-4) : '   —')
                 + '  exp ' + (isFinite(p.expR) ? ((p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R') : '—'));
        });
      });
      out.push('');
      out.push('Out-of-sample only. Every figure is GROSS of spread and commission.');
      var txt = out.join('\n');
      if (typeof console !== 'undefined' && console.log) console.log(txt);
      return txt;
    };

    window.hgOgState = function hgOgState(){
      try { return __og.snap ? JSON.parse(JSON.stringify(__og.snap)) : null; } catch (e) { return null; }
    };
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push({ id: 'omnigold', label: 'OMNIGOLD', mount: mountOmnigold, refresh: refreshOmnigold });
  }

})();
