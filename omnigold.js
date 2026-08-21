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
  var COST_VETO_R = 0.30;   // swing / unspecified — a wide stop can carry more drag
  var COST_VETO_R_SCALP = 0.15; // scalp: the live 3.16-pt stop was 19% of 1R paying the spread
  /* A lastSwing from a three-month rally is not a gold invalidation. 2.5% of
     XAUUSD is already a very wide swing stop; anything larger is a different
     instrument than the setup on the card. */
  var GOLD_STOP_MAX_PCT = 0.025;
  /* STRONGEST prefers a ticket whose named level is actually in reach.
     A 4H FVG 6×ATR behind the market is a real limit, not the trade to
     float first when a sweep 1.5×ATR away already has a ticket. */
  var GOLD_NEAR_ATR = 2;

  var FWD_MIN_JUDGE = 20;   // settled out-of-sample trades before it can conclude
  var MIN_SAMPLES = 20;
  var EDGE_VETO_Z = -2;
  var EDGE_VETO_SAMPLES = 30;
  var DAILY_FAST = 10, DAILY_SLOW = 21;
  /* THERE WERE THREE DEFINITIONS OF "REVERSION" AND THEY DISAGREED.

     A live card showed all three contradicting each other in eleven lines,
     on one mechanic:

       VETO    htf-daily      daily EMA10 >= EMA21 - disagrees with the setup
       PASS    regime-fit     a trending tape is what a CONTINUATION mechanic wants
       AGAINST hurst-regime   a REVERSION mechanic against a trending tape

     The mechanic was POC-REVERT. htf-daily and regime-fit read
     REVERSION_KINDS, a seven-name literal written before rounds two, three
     and four added their detectors; hurst-regime read a private regex. So
     VWAP-REVERT, POC-REVERT, RSI-DIVERGE and AVWAP-RECLAIM — mechanics whose
     whole job is fading a move — were judged as continuation trades and
     vetoed by htf-daily for disagreeing with the higher timeframe, which is
     the condition a fade REQUIRES. A mean-reversion setup that agrees with
     the daily trend is not a mean-reversion setup.

     One derivation now, from the family map consensus already uses, so it
     cannot drift again when a detector is added. A mechanic trades against
     the prevailing move if it is REVERSION (price is stretched, fade it) or
     SWEEP (liquidity taken and rejected). That is a strict superset of both
     old lists: every name in either is REVERSION or SWEEP. */
  function hgOgIsReversion(kind){
    var f = hgOgFamilyOf(kind);
    return f === 'REVERSION' || f === 'SWEEP';
  }

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

  var __og = { ui: null, busy: false, ran: false, snap: null, lastStat: '', src: null, shared: null, btBusy: false };

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

  /* Directional yield read. The scan used to freeze validateYieldCorrelation
     against 'long' and reuse that verdict on every setup — so a short into
     falling yields was cleared by a long-side check. Prefer goldind's
     validator when loaded; otherwise the same last-vs-5-bars test. */
  function hgOgYieldValid(rows, dir){
    var fn = gfn('validateYieldCorrelation');
    if (fn){
      try {
        var r = fn(rows, dir);
        if (r && typeof r.valid === 'boolean') return r;
      } catch (e) {}
    }
    if (!rows || rows.length < 5) return null;
    var cur = fin(rows[rows.length - 1] && rows[rows.length - 1].c);
    var prior = fin(rows[rows.length - 5] && rows[rows.length - 5].c);
    if (!isFinite(cur) || !isFinite(prior)) return null;
    var d = String(dir || '').toLowerCase();
    if (d === 'long' && cur > prior)
      return { valid: false, reason: 'US10Y yields are rising — headwind for a gold long' };
    if (d === 'short' && cur < prior)
      return { valid: false, reason: 'US10Y yields are falling — headwind for a gold short' };
    return { valid: true, reason: 'yield move does not fight this direction' };
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
    'ABSORB':'REVERSION', 'RSI-DIVERGE':'REVERSION',
    /* AVWAP-RECLAIM IS NOT A FADE, AND CALLING IT ONE BROKE A LIVE CARD.
         The detector fires LONG when price crosses UP through the VWAP anchored
         to a swing LOW, and SHORT when it crosses DOWN through one anchored to a
         swing HIGH. Both trade WITH the cross: an up-move resuming after a
         pullback, or a down-move resuming. That is continuation.
         Classed REVERSION, it was exempted from every trend gate, and a live
         gold TICKET came out reading "above the upper Keltner band - the stretch
         a reversion mechanic is fading" on a LONG that was buying that stretch,
         with stoch RSI 100 and the 20-bar range broken above. Six gates
         describing a long as a fade of the move it was joining.
         Every other REVERSION member genuinely fades: VWAP-REVERT, POC-REVERT,
         ADR-FADE, VALUE, ABSORB and RSI-DIVERGE all trade against a stretch.
         This one was alone in being wrong. */
    'AVWAP-RECLAIM':'TREND',
    /* an unfilled inefficiency */
    'FVG-FILL':'IMBALANCE',
    /* round four */
    'PIN-REJECT':'SWEEP', 'ENGULF-LEVEL':'SWEEP', 'THREE-BAR':'SWEEP',
    'POC-REVERT':'REVERSION', 'COINT-SPREAD':'INTERMARKET',
    'CUSUM-SHIFT':'TREND', 'VOL-EXPANSION':'TREND',
    /* the other metal disagrees with this one */
    'SMT-DIVERGE':'INTERMARKET', 'GSR-EXTREME':'INTERMARKET'
  };
  /* COLLAPSE FIRST, THEN COUNT — AND LET THE CLEARED ONE KEEP THE CARD.

     The gold header read "12 setup(s) · 2 ticket(s)" and the desk rendered
     ONE ticket. Both numbers were counted over the pre-collapse list while
     the cards were rendered after it. Several mechanics firing the same bar
     produce the same entry, stop, direction and horizon — one trade with
     several names — and when two members of a group both graded TICKET the
     header counted two and the collapse showed one. A ticket count you cannot
     act on twice is a count of positions the reader might size twice.

     The owner rule was the worse half. The FIRST member kept the card, so a
     group holding one cleared setup and one vetoed setup showed whichever
     happened to sort first — and a ticket could be hidden behind a VETO card
     entirely, invisible on the desk while still being counted in the header.
     That is not hypothetical: mechanics on identical levels genuinely grade
     differently, because measured-edge is per mechanic and consensus is per
     family. A cleared member now takes the card. */
  function ogTradeKey(c){
    var pl = (c && c.plan) || {};
    var e = isFinite(fin(pl.entry)) ? fin(pl.entry).toPrecision(8) : 'na';
    var st = isFinite(fin(pl.stop)) ? fin(pl.stop).toPrecision(8) : 'na';
    /* Horizon is part of the key: the same levels on SCALP and SWING are
       genuinely two tickets, with different targets and different time stops. */
    return String(c && c.horizon) + '|' + String(c && c.dir) + '|' + e + '|' + st;
  }
  /* PURE. Counts only — choosing which member keeps the card is the render's
     job, and a counter that mutated the candidates would make the two passes
     depend on each other. */
  function ogDistinctCounts(list){
    var seen = {}, trades = 0, tickets = 0, i, k, c, t;
    for (i = 0; i < (list || []).length; i++){
      c = list[i]; if (!c) continue;
      k = ogTradeKey(c);
      t = !!(c.grade && c.grade.ticket);
      if (seen[k] === undefined){ seen[k] = t; trades++; if (t) tickets++; }
      else if (t && !seen[k]){ seen[k] = true; tickets++; }
    }
    return { trades: trades, tickets: tickets };
  }

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

  /* Hits that the ledger has already disqualified must not vote. Live scalp
     tapes were empty because ORB/MMOVE/BOS shorts (which fail `trend` on an
     up stack) and POC shorts (which fail fade-strength into a rally) still
     counted in consensus, so the with-trend ROUND-MAGNET / PO3 long was the
     "minority read". A vetoed setup is not disagreement. */
  function hgOgConsensusVoters(allHits, rows, extra){
    if (!allHits || !allHits.length) return allHits || [];
    extra = extra || {};
    var he21 = extra.htf ? fin(extra.htf.e21) : NaN, he50 = extra.htf ? fin(extra.htf.e50) : NaN;
    var dailyUp = (isFinite(he21) && isFinite(he50)) ? (he21 >= he50) : null;
    var out = [], i, h, rev, agrees;
    for (i = 0; i < allHits.length; i++){
      h = allHits[i];
      if (!h || (h.dir !== 'long' && h.dir !== 'short')) continue;
      rev = hgOgIsReversion(h.kind);
      if (dailyUp === null){ out.push(h); continue; }
      if (!rev){
        agrees = (h.dir === 'long') ? dailyUp : !dailyUp;
        if (!agrees) continue;
      } else if (dailyUp === (h.dir === 'short')) continue;
      out.push(h);
    }
    return out;
  }

  function hgOgClipStop(dir, entry, stop){
    var e = fin(entry), s = fin(stop);
    if (!isFinite(e) || e <= 0 || !isFinite(s)) return NaN;
    var risk = (dir === 'long') ? (e - s) : (s - e);
    if (!(risk > 0)) return NaN;
    var cap = e * GOLD_STOP_MAX_PCT;
    if (risk <= cap) return s;
    return (dir === 'long') ? (e - cap) : (e + cap);
  }

  /* The printed trade IS the mechanic. Pricing entry at live gold while the
     detector named Asia high / a round / an FVG produced the live defect:
     FVG-FILL LONG at 4429 printed ENTRY 4535 / STOP 3415. Sweeps get a stop
     beyond the named level (that is the invalidation). Continuation still
     uses structure from that entry, skipExact so enrichers cannot move it.
     Fades never get a momentum stop: a fade's premise IS the level. */
  function hgOgPlanForHit(hit, rows, extra, cfg){
    cfg = cfg || {};
    extra = extra || {};
    if (!hit || (hit.dir !== 'long' && hit.dir !== 'short')) return null;
    var live = fin(extra.livePx);
    var lvl = fin(hit.level);
    var entry = (isFinite(lvl) && lvl > 0) ? lvl
              : ((isFinite(live) && live > 0) ? live : undefined);
    var minRr = isFinite(fin(cfg.minRr)) ? fin(cfg.minRr) : 1.5;
    var reversion = hgOgIsReversion(hit.kind);
    var fromRisk = gfn('hgPlanFromRisk');
    var planFn = gfn('hgPlanLevels');
    var a = atrOf(rows, 14);
    if (!(isFinite(a) && a > 0) && isFinite(entry)) a = entry * 0.003;

    if (reversion && isFinite(entry) && fromRisk){
      var last = (rows && rows.length) ? rows[rows.length - 1] : null;
      var stop, wick;
      if (hit.dir === 'long'){
        wick = last ? fin(last.l) : NaN;
        stop = ((isFinite(wick) && wick < entry) ? wick : entry) - 0.35 * a;
      } else {
        wick = last ? fin(last.h) : NaN;
        stop = ((isFinite(wick) && wick > entry) ? wick : entry) + 0.35 * a;
      }
      stop = hgOgClipStop(hit.dir, entry, stop);
      if (!isFinite(stop)) return null;
      var sweepPl = fromRisk(hit.dir, entry, stop, {
        t1R: 2, t2R: 3.5, minRr: minRr,
        targetPolicy: 'R-multiples of setup-level risk'
      });
      if (sweepPl){
        sweepPl.note = 'SETUP ' + String(hit.kind) + ' @ ' + entry.toFixed(2)
                     + ' — stop beyond the level that is the trade';
        sweepPl.planSrc = 'hgOgPlanForHit';
        sweepPl.dir = hit.dir;
      }
      return sweepPl;
    }

    if (!planFn || !isFinite(entry)) return null;
    var plan = null;
    try {
      plan = planFn(hit.dir, rows, entry, {
        minRr: cfg.minRr, capMode: 'structure', skipExact: true,
        momentumOk: !hgOgIsReversion(hit.kind)
      });
    } catch (eP) { plan = null; }
    if (plan && fromRisk && isFinite(fin(plan.entry)) && isFinite(fin(plan.stop))){
      var clipped = hgOgClipStop(hit.dir, plan.entry, plan.stop);
      if (isFinite(clipped) && Math.abs(clipped - plan.stop) > 1e-9){
        var repl = fromRisk(hit.dir, plan.entry, clipped, {
          t1R: 2, t2R: 3.5, minRr: minRr,
          targetPolicy: plan.targetPolicy || 'R-multiples'
        });
        if (repl){
          /* A clipped stop is no longer the WIDE lastSwing the plan engine
             named. Drop that clause or the card's note disagrees with its
             own ENTRY/STOP (test-stop-note-restate). */
          var prevNote = String(plan.note || '');
          if (/\bWIDE\b/.test(prevNote)) prevNote = '';
          repl.note = (prevNote ? (prevNote + ' — ') : '')
                    + 'stop capped at ' + (GOLD_STOP_MAX_PCT * 100).toFixed(1)
                    + '% of gold: a lastSwing that far is not this setup\'s invalidation';
          if (plan.momentumStop === true) repl.momentumStop = true;
          repl.planSrc = plan.planSrc;
          repl.dir = hit.dir;
          plan = repl;
        }
      }
    }
    return plan;
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
  /* Moved to hg-gates.js. These two helpers were byte-identical in both desks
     (1,330 chars, verbatim) because the fix was written once and pasted; the
     shim keeps this file working if hg-gates.js somehow fails to load, rather
     than throwing a ReferenceError mid-scan. */
  function hgSlotMeanVol(rows, want){
    var w = W();
    return (w && typeof w.hgSlotMeanVol === 'function')
      ? w.hgSlotMeanVol(rows, want)
      : { mean: NaN, n: 0 };
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
    /* PLAN-LEVELS — a TICKET with nothing to place is not a ticket.

       The desk's single ticket read:

         GOLD · SCALP · AVWAP-RECLAIM LONG   TICKET 29/32 checks
         no plan — structure could not clear the R floor, so no levels are shown.
         UNCHECKED cost-drag    no plan risk to cost
         UNCHECKED stop-width   no plan yet — stop width cannot be judged

       The plan engine had returned null, the card said so plainly, and the
       ledger graded it TICKET anyway. Nothing in thirty-two gates asked
       whether there was a trade to take. cost-drag and stop-width both
       noticed and both are soft, so their UNCHECKED could not block it.

       A ticket is the desk saying "this cleared, act on it". With no entry,
       no stop and no target there is nothing to act on, and calling it a
       ticket is the worst thing this ledger can do: every other veto tells
       you why to stand aside, and this one invited you in with no levels.

       THREE STATES, deliberately:
         plan present and complete -> PASS
         plan explicitly null      -> VETO. The engine ran and produced
                                      nothing; that is a decision, not a gap.
         no plan key at all        -> UNCHECKED and soft. The caller never
                                      offered one, so this gate has nothing to
                                      judge and must not invent a veto. */
    var plHas = !!(x && Object.prototype.hasOwnProperty.call(x, 'plan'));
    var plObj = plHas ? x.plan : undefined;
    var plOk = null, plWhy = 'no plan supplied to the ledger — not judged here';
    if (plHas){
      if (!plObj){
        plOk = false;
        /* SAY WHY THERE ARE NO LEVELS. "no plan" and the card's own subtitle
           "structure could not clear the R floor" both point at R:R, and on
           live gold the real cause was stop DISTANCE: price had run 2.74% in
           a day, the nearest swing low sat 165 points below at 7.76xATR, and
           the plan engine refuses anything past 6xATR rather than inventing a
           tighter stop. Six of nine scalp cards were dropped for that, and
           the card blamed the wrong thing. Diagnosed here from the same swing
           and ATR the engine used, so the reader learns the actual geometry
           instead of a category. */
        plWhy = 'NO LEVELS — the plan engine produced no entry, stop or target, '
              + 'so there is nothing to place';
        try {
          var pSwFn = gfn('lastSwing');
          var pAtr = atrOf(rows, 14);
          var pSw = pSwFn ? fin(pSwFn(rows, hit.dir, 20)) : NaN;
          var pLast = (rows && rows.length) ? fin(rows[rows.length - 1].c) : NaN;
          if (isFinite(pSw) && isFinite(pAtr) && pAtr > 0 && isFinite(pLast)){
            var pMult = Math.abs(pLast - pSw) / pAtr;
            plWhy += ' — the nearest swing ' + (hit.dir === 'long' ? 'low' : 'high')
                   + ' is ' + Math.abs(pLast - pSw).toFixed(0) + ' points away ('
                   + pMult.toFixed(1) + '×ATR)'
                   + (pMult > 6 ? ', past the 6×ATR limit, so no stop can be placed on structure'
                                : ', which the engine could not turn into a usable plan');
          }
        } catch (ePl){}
      } else {
        var pE = fin(plObj.entry), pS = fin(plObj.stop), pT = fin(plObj.t1);
        if (isFinite(pE) && isFinite(pS) && isFinite(pT) && pE !== pS){
          plOk = true;
          plWhy = 'entry, stop and target all present';
        } else {
          plOk = false;
          plWhy = 'INCOMPLETE LEVELS — '
                + (!isFinite(pE) ? 'no entry' : !isFinite(pS) ? 'no stop'
                   : !isFinite(pT) ? 'no target' : 'entry equals stop')
                + ', so there is nothing to place';
        }
      }
    }
    gates.push({ key:'plan-levels', hard:false, pass: plOk, why: plWhy });

    /* LEVEL-FRESH — the levels must survive contact with the CURRENT price.

       The desk drops the forming candle before anything reads a bar, which is
       right for every indicator. But the plan then prices its entry at the
       last CLOSED bar — up to four hours stale on the swing horizon — and no
       gate ever compared it against where the market actually is.

       Demonstrated live: every swing card quoted entry 4391.83 while the
       market traded 4499.23, 107 points off the reader's chart. The two
       SHORT cards carried stops at 4449 with the market at 4499 — fifty
       points beyond the stop before the trade was ever placed — and earlier
       the desk TICKETED one of those. A ticket whose stop the market has
       already crossed is dead on arrival: filled at market, it is an instant
       stop-out presented as a 2R setup.

       Three states:
         market beyond the stop            -> VETO, dead on arrival
         entry more than 1.5xATR from      -> AGAINST (info). The levels are a
         the market                           resting-order plan around stale
                                              structure, not a market entry,
                                              and the card must say which
         otherwise                         -> PASS, quoting the gap

       UNCHECKED when no live price is supplied — harnesses and callers that
       predate this gate keep working, and unknown reads UNCHECKED, never
       PASS. */
    /* THE UNCHECKED REASON MUST BE TRUE. This printed "no live price supplied"
       on a card whose own DEAD LEVELS block quoted the live price — the plan
       was what was missing, and a diagnostic that misreports its own inputs
       sends the reader chasing the wrong absence. Three distinct reasons. */
    var lfOk = null, lfWhy = 'no live price supplied — freshness not judged', lfInfo = false;
    var lfPx = x ? fin(x.livePx) : NaN;   /* x may be absent in old harnesses */
    if (isFinite(lfPx) && lfPx > 0 && !(plHas && plObj)){
      lfWhy = 'live price in hand (' + lfPx.toFixed(2) + ') but no plan to judge — see plan-levels';
    }
    if (isFinite(lfPx) && lfPx > 0 && plHas && plObj){
      var lfE = fin(plObj.entry), lfS = fin(plObj.stop);
      if (isFinite(lfE) && isFinite(lfS)){
        var lfAtr = atrOf(rows, 14);
        var lfGap = lfPx - lfE;
        var crossed = (hit.dir === 'short') ? (lfPx >= lfS) : (lfPx <= lfS);
        if (crossed){
          lfOk = false;
          lfWhy = 'DEAD ON ARRIVAL — the market (' + lfPx.toFixed(2) + ') is already '
                + Math.abs(lfPx - lfS).toFixed(0) + ' points beyond the stop ('
                + lfS.toFixed(2) + '): these levels were priced off a closed bar the market has left behind';
        } else if (isFinite(lfAtr) && lfAtr > 0 && Math.abs(lfGap) > 1.5 * lfAtr){
          lfOk = false; lfInfo = true;
          lfWhy = 'entry ' + lfE.toFixed(2) + ' sits ' + Math.abs(lfGap).toFixed(0) + ' points ('
                + (Math.abs(lfGap) / lfAtr).toFixed(1) + '×ATR) from the market (' + lfPx.toFixed(2)
                + ') — a resting-order plan around stale structure, not a market entry';
        } else {
          lfOk = true;
          lfWhy = 'levels within reach of the market (' + lfPx.toFixed(2) + ', '
                + Math.abs(lfGap).toFixed(0) + ' points from entry)';
        }
      }
    }
    gates.push({ key:'level-fresh', hard:false, info: lfInfo, pass: lfOk, why: lfWhy });

    /* MOMENTUM-STOP — a volatility stop, not structure. Continuation
       mechanics may still RECEIVE one from the plan engine (otherwise a
       runaway tape has no levels at all). The ledger flags it AGAINST
       (info) so the compromise is on the card; it does NOT veto the
       ticket. v420 made this a real veto and emptied the desk: fades
       already fail fade-strength, continuation had only a vol stop, and
       the user saw "no setup with ticket". Fades never get a momentum
       stop (momentumOk is off for reversions). */
    var msOk = null, msWhy = 'stop is on structure, or no plan to judge';
    if (plHas && plObj){
      if (plObj.momentumStop === true){
        msOk = false;
        msWhy = 'stop is a VOLATILITY stop, not structure — noise can stop this trade '
              + 'without the idea being wrong; size accordingly';
      } else {
        msOk = true;
        msWhy = 'stop rests on structure';
      }
    }
    gates.push({ key:'momentum-stop', hard:false, info:true, pass: msOk, why: msWhy });

    var reversion = hgOgIsReversion(hit.kind);

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
    /* fin, not num: +null is 0 and isFinite(0) is true, so a feed publishing
       a null volume would score 0.00x and be vetoed rather than read as
       "no volume published". */
    var lv = lastBar ? fin(lastBar.v) : NaN;
    var slotV = hgSlotMeanVol(rows, 20);
    var usedSlot = isFinite(slotV.mean);
    var mv = usedSlot ? slotV.mean
                      : (lastBar ? meanVol(rows.slice(0, rows.length - 1), 20) : NaN);
    var partOk = null, partWhy = 'this gold feed publishes no volume';
    if (isFinite(mv) && isFinite(lv) && mv > 0){
      partOk = lv >= mv * 0.7;
      partWhy = 'trigger vol ' + (lv / mv).toFixed(2)
              + (usedSlot ? '× the mean for THIS TIME OF DAY over the last ' + slotV.n + ' sessions'
                          : '× 20-bar mean — too little history to correct for the session');
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
    } else if (x.yieldRows){
      var yv = hgOgYieldValid(x.yieldRows, hit.dir);
      if (yv && typeof yv.valid === 'boolean'){
        yld = yv.valid;
        yldWhy = yv.reason || (yld ? 'yield guard clear' : 'yield guard flags this direction');
      }
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
    /* Moved to hg-gates.js — the decision was byte-identical in both desks
       (2,730 chars, verbatim). It emptied BOTH tabs for days and the fix had
       to be written twice; that is what this module exists to stop. */
    var __nwG = W(), __nw;
    if (__nwG && typeof __nwG.hgNewsGate === 'function'){
      __nw = __nwG.hgNewsGate(x.news);
    } else {
      /* hg-gates.js absent: UNCHECKED, never a quiet pass. */
      __nw = { pass: null, info: false, why: 'news gate module (hg-gates.js) not loaded' };
    }
    var nw = __nw.pass, nwWhy = __nw.why, nwInfo = __nw.info;
    gates.push({ key:'news-window', hard:false, info: nwInfo, pass: nw, why: nwWhy });

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
      var costCeil = (x.sessionHard === true) ? COST_VETO_R_SCALP : COST_VETO_R;
      cost = costR <= costCeil;
      costWhy = 'round-trip ~$' + rt.toFixed(2) + ' on a $' + planRisk.toFixed(2) + ' stop = '
              + (costR * 100).toFixed(0) + '% of 1R'
              + (costR > costCeil ? ' — the spread would eat most of the edge'
                 : (costR > COST_WARN_R ? ' — material drag, size accordingly' : ''));
    }
    gates.push({ key:'cost-drag', hard:false, pass: cost, why: costWhy });

    /* 12 — measured edge: this mechanic's own walk-forward on THIS horizon,
       judged by significance against the breakeven rate for this R floor. */
    var minRr = isFinite(fin(x.minRr)) ? fin(x.minRr) : 2;
    var sExp = x.stats ? fin(x.stats.expR) : NaN;
    var sHit = x.stats ? fin(x.stats.hit) : NaN;
    var sN = x.stats ? fin(x.stats.samples) : NaN;
    var ed = null, edWhy = 'not yet measured', edInfo = false;
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
      else if (z <= EDGE_VETO_Z){
        /* Min-loss: the pool table already says "has not paid" at MIN_SAMPLES
           (20). The 20–29 window used to report AGAINST as info so the TICKET
           still issued — a mechanic at −2σ with 22 samples was the live
           recommendation. Too thin to be a *large* sample is not a reason to
           take a losing trade. Under 20 stays UNCHECKED (too few to judge). */
        ed = false; edInfo = false;
        edWhy = stat + ' — significantly below breakeven, this mechanic has not paid';
      }
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
      /* THE VETO USES THE TICKET-ONLY RECORD. See omniroute: the all-firings
         figure is what the card reports, because it is the only one
         comparable with the in-sample pool — but vetoing on it is circular.
         Most firings are rejected by this very ledger, the rejects are
         recorded, they lose, and the mechanic is then condemned by trades the
         desk refused to take. That is what emptied both tabs. */
      var tix = fwd.ticketOnly;
      var tN = tix ? fin(tix.samples) : NaN;
      var tHit = tix ? fin(tix.hit) : NaN;
      var judgeN = (isFinite(tN) && tN >= FWD_MIN_JUDGE) ? tN : NaN;
      var judgeHit = isFinite(judgeN) ? tHit : NaN;

      if (isFinite(judgeN) && isFinite(judgeHit)){
        var fse = Math.sqrt(Math.max(1e-9, fBreak * (1 - fBreak) / judgeN));
        var fz = (judgeHit - fBreak) / fse;
        var fzTxt = ' [' + (fz >= 0 ? '+' : '') + fz.toFixed(2) + 'σ vs breakeven]';
        var tixTxt = judgeN + ' settled TICKETS · ' + (judgeHit * 100).toFixed(0) + '% T1-first';
        if (fz <= EDGE_VETO_Z){
          ed = false;
          edWhy = tixTxt + fzTxt + ' — the trades this ledger actually cleared have not paid'
                + (fN > judgeN ? ' (of ' + fN + ' settled firings overall)' : '');
        } else {
          ed = true;
          edWhy = tixTxt + fzTxt + ' — measured out-of-sample on cleared setups';
        }
      } else if (fN >= FWD_MIN_JUDGE && isFinite(fHit)){
        /* Enough settled FIRINGS to describe, not enough cleared TICKETS to
           condemn. Report, do not veto. */
        var az = (fHit - fBreak) / Math.sqrt(Math.max(1e-9, fBreak * (1 - fBreak) / fN));
        ed = null;
        edWhy = fTxt + ' [' + (az >= 0 ? '+' : '') + az.toFixed(2) + 'σ vs breakeven]'
              + ' — but only ' + (isFinite(tN) ? tN : 0) + ' of those were setups this ledger cleared, '
              + 'too few to judge the mechanic on. Reported, not vetoed.';
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

    gates.push({ key:'measured-edge', hard:false, info: edInfo, pass: ed, why: edWhy });

    /* The 14 indicator context reads moved to hg-gates.js so OMNIROUTE gets
       them too — a gold card carried 34 checks to crypto\'s 21, and the gap
       was exactly these. Verbatim move; verified by gate-output equivalence. */
    /* ZONE ANCHOR — is this setup AT a level, or in no-man's land?

       The NEXT GOLD LEVELS panel already computes where the multi-source
       zones sit (swings, prior day/week, ADR, Asia, value area, rounds,
       AVWAP), but the mechanic cards never knew: a POC-REVERT firing at a
       four-source overhead zone and one firing in the middle of nowhere
       graded identically. They are not the same trade — a level everyone
       can see is where liquidity rests and where a rejection has odds; a
       setup far from any structure is leaning on nothing. Info-only: being
       unanchored costs standing, never existence. */
    (function(){
      var za = null, zaWhy = 'zone context unavailable';
      var zc = x.zoneCtx;
      if (Array.isArray(zc) && zc.length){
        var ref = fin(hit.level);
        if (!isFinite(ref)) ref = fin(x.livePx);
        var aRef2 = atrOf(rows, 14);
        if (isFinite(ref) && isFinite(aRef2) && aRef2 > 0){
          var best = null, zi2, zz, dEdge;
          for (zi2 = 0; zi2 < zc.length; zi2++){
            zz = zc[zi2] && zc[zi2].zone;
            if (!zz || !isFinite(fin(zz.lo)) || !isFinite(fin(zz.hi))) continue;
            dEdge = (ref < zz.lo) ? (zz.lo - ref) : (ref > zz.hi ? ref - zz.hi : 0);
            if (!best || dEdge < best.d) best = { d: dEdge, z: zz };
          }
          if (best){
            var dAtr = best.d / aRef2;
            zaWhy = 'nearest structural zone (' + (best.z.confluence || '?') + ' sources: '
                  + best.z.srcs.join(', ') + ') sits ' + dAtr.toFixed(1) + 'xATR from the setup level';
            if (dAtr <= 0.5){ za = true; zaWhy += ' — anchored AT the level'; }
            else if (dAtr > 1.5){ za = false; zaWhy += ' — no structure within reach: a setup in no-man’s-land'; }
            else { za = true; zaWhy += ' — within working distance'; }
          } else zaWhy = 'no multi-source zone computed on this tape';
        }
      }
      gates.push({ key:'zone-anchor', hard:false, info:true, pass: za, why: zaWhy });
    })();

    (function(){
      var shFn = gfn('hgIndicatorGates');
      var sh = shFn ? shFn(rows, hit, x, reversion) : null;
      if (sh && sh.length){ for (var si = 0; si < sh.length; si++) gates.push(sh[si]); }
      else gates.push({ key:'context-gates', hard:false, info:true, pass:null,
                        why:'shared context gates unavailable (hg-gates.js not loaded)' });
    })();




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
    var cons = x.allHits ? hgOgConsensus(hgOgConsensusVoters(x.allHits, rows, x), hit) : null;
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
        /* Outnumbering is not immunity. The minority branch below can now
           be rescued by the regime; if this side could still pass on raw
           count, the two directions would ticket TOGETHER — the exact
           contradiction this gate exists to prevent. Both branches read
           the same signal, so exactly one side can win: a majority whose
           regime-favoured family fired ONLY on the other side is the
           chorus that fires against every such regime, and it stands
           aside. */
        var mjReg = null;
        var mjFn = gfn('detectRegime');
        if (mjFn){ try { var mjR = mjFn(rows); mjReg = mjR ? String(mjR.regime || '') : null; } catch (eMj){ mjReg = null; } }
        var mjFam = /trend/i.test(mjReg || '') ? 'TREND'
                  : /range|chop|mean/i.test(mjReg || '') ? 'REVERSION' : null;
        if (mjFam && cons.against.indexOf(mjFam) >= 0 && cons.agree.indexOf(mjFam) < 0){
          con = false;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — outnumbers it, but the ' + mjReg + ' regime favours ' + mjFam
                 + ', which fired only on the other side: this majority is the chorus that fires against every '
                 + String(mjReg).toLowerCase();
        } else {
          con = true;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt;
        }
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
          /* Say WHICH of the three tie-break failures happened. "No regime
             read" was printed for all of them, including on cards where
             regime-fit had just reported WEAK TREND three lines below — which
             sends the reader looking for a missing regime that is not
             missing. */
          var tieWhy = !wantFam
            ? 'no regime read to break it'
            : (cons.split.indexOf(wantFam) >= 0
                ? 'the ' + tieReg + ' regime favours ' + wantFam + ', and ' + wantFam
                  + ' is itself split — it cannot break its own tie'
                : (mineHas && theirsHas
                    ? wantFam + ' fired on BOTH sides, so the regime cannot separate them'
                    : wantFam + ' did not fire at all, so the ' + tieReg
                      + ' regime has nothing here to favour'));
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ')
                 + ')' + splitTxt + ' — tied, and ' + tieWhy + ': the desk cannot pick a side';
        }
      } else {
        /* MINORITY READ — but the tie-break's own measurement applies here
           too: in a trending tape the fades fire against the move EVERY
           time, so the continuation family is structurally outnumbered by
           mechanics that add no information. Observed live: the only
           with-trend setup on the tape (MMOVE long, ADX 40 up) vetoed
           1-v-2 by the same fades fade-strength had just rejected as
           invalid in that exact regime — REJECTED SETUPS WERE VOTING.
           Same break as the tie above, same conditions, nothing new to
           game: a clear regime read, the regime's own family on THIS side,
           and not on the other. A minority the regime disowns still
           vetoes, and TREND firing on both sides still cannot be
           separated. */
        var mnReg = null;
        var mnFn = gfn('detectRegime');
        if (mnFn){ try { var mnR = mnFn(rows); mnReg = mnR ? String(mnR.regime || '') : null; } catch (eMn){ mnReg = null; } }
        var mnFam = /trend/i.test(mnReg || '') ? 'TREND'
                  : /range|chop|mean/i.test(mnReg || '') ? 'REVERSION' : null;
        if (mnFam && cons.agree.indexOf(mnFam) >= 0 && cons.against.indexOf(mnFam) < 0){
          con = true;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — outnumbered, but the ' + mnReg + ' regime favours ' + mnFam
                 + ' and it fired on this side only: a headcount of mechanics that fire against every '
                 + String(mnReg).toLowerCase() + ' is noise, not disagreement';
        } else {
          con = false;
          conWhy = 'only ' + aTxt + ' vs ' + cons.nAgainst + ' against ('
                 + cons.against.join(', ') + ')' + splitTxt + ' — this is the minority read';
        }
      }
    }
    gates.push({ key:'consensus', hard: conHard, pass: con, why: conWhy });

    /* STOP-WIDTH — what this stop actually asks of the trade. See omniroute:
       the card printed the risk percentage and never said anything about it,
       so a 13% stop and a 0.9% stop rendered identically. Info, not a veto: a
       wide stop is often correct, and the v351 work established that
       truncating one to make the number look better only relocates the risk. */
    var sw = null, swWhy = 'no plan yet — stop width cannot be judged';
    var swPlan = x.plan;
    if (swPlan){
      var swE = fin(swPlan.entry), swS = fin(swPlan.stop), swT = fin(swPlan.t1);
      if (isFinite(swE) && isFinite(swS) && swE > 0){
        var swPct = Math.abs(swE - swS) / swE * 100;
        if (isFinite(swPct) && swPct > 0){
          var needPct = isFinite(swT) ? (Math.abs(swT - swE) / swE * 100) : (swPct * (fin(x.minRr) || 1.5));
          swWhy = 'stop is ' + swPct.toFixed(2) + '% from entry; T1 needs a ' + needPct.toFixed(1) + '% move';
          /* Gold is far less volatile than an alt, so the wide threshold is
             tighter here: 3% on XAUUSD is a very large stop. */
          if (swPct >= 3){
            sw = false;
            swWhy += ' — a very wide stop for gold: at fixed account risk this sizes to a small position';
          } else if (swPct <= 0.08){
            sw = false;
            swWhy += ' — a very tight stop: ordinary noise and spread will take it out before the idea fails';
          } else {
            sw = true;
          }
        }
      }
    }
    gates.push({ key:'stop-width', hard:false, info:true, pass: sw, why: swWhy });








    /* FADE-STRENGTH — the gate that was missing, and that v376 made necessary.

       Reported as "the setups are absolutely wrong — shorts in a rally", and
       the ledger could not stop one. For a reversion mechanic:

         trend             passes by design  (trendOk = true)
         htf-daily         passes by design  (d1 = reversion ? true : ...)
         hurst-regime      info:true
         regime-fit        info:true
         adx-trend         info:true
         structure-shift   info:true
         htf-confirm       info:true
         regression-slope  info:true

       Eight trend-aware gates and not one of them can veto a fade. A live
       ticket carried "AGAINST hurst-regime — a reversion mechanic against a
       trending tape" and "AGAINST regime-fit — fading a trending tape" side
       by side, and cleared anyway.

       v376 widened that hole. Before it, VWAP-REVERT, POC-REVERT, RSI-DIVERGE
       and AVWAP-RECLAIM were classed as continuation and WERE vetoed by trend
       and htf-daily. Reclassifying them as reversion was right — the trend
       gate's own comment says vetoing a fade for being counter-trend is a
       category error, and it is — but it handed those four a free pass on
       every trend check at the same time.

       The distinction the ledger never drew: fading a STRETCHED market is the
       trade; fading a STRONG TREND is the classic way to lose. Direction is
       not the question for a fade. STRENGTH is.

       Three independent reads of strength against this fade. The daily
       stack alone is enough to veto — that is the "shorts in a rally"
       complaint. ADX and regime still need TWO to agree when the daily
       is missing, so one noisy oscillator cannot kill a setup:

         1. the daily stack, which is what "a rally" usually means
         2. ADX >= 25 with DI pointing against the fade
         3. the structural regime reading trend, with the local EMA stack
            confirming the direction

       Soft, so it reports rather than silently disappearing the card. */
    var fadeOk = true, fadeWhy = 'continuation setup — this gate only judges fades';
    if (reversion){
      var adverse = [], dailyAgainst = false, neutralN = 0;
      /* A short fade fights an UPtrend; a long fade fights a DOWNtrend. */
      var fadeShort = (hit.dir === 'short');

      /* 1 — the higher timeframe. The live complaint was "shorts in a rally";
         the daily stack IS that rally. One noisy oscillator must not kill a
         fade, but fading the daily trend is the classic gold loss. */
      var fhe21 = x.htf ? fin(x.htf.e21) : NaN, fhe50 = x.htf ? fin(x.htf.e50) : NaN;
      if (isFinite(fhe21) && isFinite(fhe50)){
        var dailyUp = fhe21 >= fhe50;
        if (dailyUp === fadeShort){
          dailyAgainst = true;
          adverse.push('the daily stack is ' + (dailyUp ? 'up' : 'down'));
        }
      } else neutralN++;

      /* 2 — ADX with direction. */
      var fAdxFn = gfn('adx');
      if (fAdxFn){
        try {
          var fx = fAdxFn(rows, 14);
          var fa = (fx && fx.adx && fx.adx.length) ? fin(fx.adx[fx.adx.length - 1]) : NaN;
          var fp = (fx && fx.plusDI && fx.plusDI.length) ? fin(fx.plusDI[fx.plusDI.length - 1]) : NaN;
          var fm = (fx && fx.minusDI && fx.minusDI.length) ? fin(fx.minusDI[fx.minusDI.length - 1]) : NaN;
          if (isFinite(fa) && isFinite(fp) && isFinite(fm)){
            if (fa >= 25 && ((fp > fm) === fadeShort))
              adverse.push('ADX ' + fa.toFixed(0) + ' with DI ' + (fp > fm ? 'up' : 'down'));
          } else neutralN++;
        } catch (eFa){ neutralN++; }
      } else neutralN++;

      /* 3 — the structural regime, with the local stack agreeing on which way. */
      var fRegFn = gfn('detectRegime');
      if (fRegFn && isFinite(e21) && isFinite(e50)){
        try {
          var fr = fRegFn(rows);
          var frName = fr ? String(fr.regime || '') : '';
          if (/trend/i.test(frName)){
            var localUp = e21 >= e50;
            if (localUp === fadeShort)
              adverse.push('regime ' + ((fr && fr.label) || frName) + ' running ' + (localUp ? 'up' : 'down'));
          }
        } catch (eFr){ neutralN++; }
      } else neutralN++;

      if (dailyAgainst || adverse.length >= 2){
        fadeOk = false;
        fadeWhy = 'fading a STRONG trend — ' + adverse.join('; ')
                + '. A fade wants a stretched tape, not a running one';
      } else if (adverse.length === 1){
        fadeWhy = 'fade is counter-trend on one read (' + adverse[0]
                + '), which is what a fade IS — one oscillator is not enough to stand it aside';
      } else if (neutralN >= 3){
        fadeOk = null;
        fadeWhy = 'no usable trend-strength read — cannot judge this fade';
      } else {
        fadeWhy = 'nothing strong running against this fade';
      }
    }
    gates.push({ key:'fade-strength', hard:false, pass: fadeOk, why: fadeWhy });

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

    /* WEEKEND EXPOSURE — spot/CME closes Fri 22:00 UTC. A ticket issued
       inside that window is a gap bet on a closed book, not a gold trade.
       SWING also vetoes inside one 4h bar of the close: that hold will
       still be open when the book gaps. SCALP may still trade the last
       live hours. */
    var wkOk = null, wkWhy = 'no scan clock supplied — weekend exposure not judged';
    var wkNow = fin(x.nowSec);
    var wkFn = gfn('hgInGoldWeekend');
    if (isFinite(wkNow) && wkNow > 0 && wkFn){
      try {
        if (wkFn(wkNow)){
          wkOk = false;
          wkWhy = x.sessionHard
            ? 'inside gold weekend — spot/CME is closed; a scalp ticket is not a live XAU book'
            : 'inside gold weekend — a swing hold is a gap across a closed spot/CME book';
        } else {
          var secsFn = gfn('hgSecsToGoldWeekend');
          var secsLeft = secsFn ? fin(secsFn(wkNow)) : NaN;
          if (x.sessionHard !== true && isFinite(secsLeft) && secsLeft >= 0 && secsLeft < 4 * 3600){
            wkOk = false;
            wkWhy = 'Friday close in ' + (secsLeft / 3600).toFixed(1)
                  + 'h — a swing hold would gap a closed spot/CME book';
          } else {
            wkOk = true;
            wkWhy = 'outside the gold weekend closure';
          }
        }
      } catch (eWk){ wkWhy = 'weekend check threw'; }
    } else if (isFinite(wkNow) && wkNow > 0 && !wkFn){
      wkWhy = 'weekend helper unavailable — not judged';
    }
    gates.push({ key:'weekend-exposure', hard:false, pass: wkOk, why: wkWhy });

    /* ShieldGuard — gold tabs already refuse these tapes. Feature-checked:
       UNCHECKED when the module is not loaded, never a silent pass. */
    var shOk = null, shWhy = 'ShieldGuard not loaded — not judged';
    var shFn = gfn('hgShieldGuardVeto');
    if (shFn && rows && hit && hit.dir){
      try {
        var sh = shFn(rows, hit.dir, {});
        if (sh && sh.veto){
          shOk = false;
          shWhy = 'ShieldGuard: ' + (sh.reason || 'veto');
        } else {
          shOk = true;
          shWhy = 'ShieldGuard clear';
        }
      } catch (eSh){ shWhy = 'ShieldGuard threw: ' + ((eSh && eSh.message) || eSh); }
    }
    gates.push({ key:'shield-guard', hard:false, pass: shOk, why: shWhy });

    return gates;
  }

  /* This mechanic's OUT-OF-SAMPLE record, or null when the log is absent.
     Never throws: no forward log must leave the gate on the in-sample number
     saying so, not break the scan. */
  function hgOgFwdFor(tab, mechanic){
    try{
      var w = W();
      if (!w || typeof w.hgFwdStats !== 'function' || !tab || !mechanic) return null;
      /* TWO records, and they answer different questions.

         'all' is every firing that carried a plan. It is what the in-sample
         pool measures, so it is the only one comparable with it, and it is
         what the card reports.

         'ticket' is the subset the ledger actually cleared. That is the only
         honest basis for a VETO: a mechanic fires, the ledger rejects most of
         them for reasons of its own — no trend, no participation, wrong
         regime — those rejects are recorded and they lose, and the mechanic
         is then condemned by trades this desk refused to take. Judging it
         that way is circular, and it is what emptied both tabs: every
         mechanic crossed twenty settled all-firings at zero wins and was
         vetoed, including on the setups the ledger had cleared.

         ticketOnly cannot be answered from the pruned aggregate, so it is a
         view of the recent window rather than of all time. That is a reason
         to require enough of it before acting, not a reason to ignore it. */
      var all = w.hgFwdStats(tab, mechanic, false);
      var tix = w.hgFwdStats(tab, mechanic, true);
      if (!all || !isFinite(fin(all.samples))) return null;
      all.ticketOnly = (tix && isFinite(fin(tix.samples))) ? tix : null;
      return all;
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
         so the levels must exist before the ledger runs.

         The printed trade IS the mechanic. Live gold as the entry produced
         FVG-FILL @ 4429 with ENTRY 4535 / STOP 3415, and ROUND-MAGNET @ 4530
         with no plan. hgOgPlanForHit prices entry at hit.level, puts a
         sweep stop beyond that level, and keeps skipExact so enrichers
         cannot hijack continuation structure. livePx is for freshness. */
      var plan = null;
      try { plan = hgOgPlanForHit(hit, rows, ex, cfg); }
      catch (e) { plan = null; }
      if (plan && deriveFn) plan = deriveFn(plan);
      ex.planRisk = (plan && isFinite(fin(plan.risk))) ? fin(plan.risk) : NaN;
      /* Attach only when the engine exists. An absent engine is not a
         declined plan — stamping plan:null vetoed the whole desk in
         harnesses without plans.js. When the engine IS here, null is a
         real decline (plan-levels vetoes) so a ticket cannot print with
         no levels. */
      if (planFn) ex.plan = plan;
      ex.allHits = hits;          /* so the consensus gate can see the rest of the scan */
      var gates = hgOgGates(rows, hit, ex);
      var grade = gradeFn ? gradeFn(gates) : { ticket:false, vetoes:[], unknown:[], degraded:[], evaluated:0, total:gates.length, verdict:'engine unavailable' };
      var livePx = fin(ex.livePx);
      var setupPx = fin(hit.level);
      if (!isFinite(setupPx) && plan) setupPx = fin(plan.entry);
      var atrN = atrOf(rows, 14);
      var distAtr = (isFinite(livePx) && isFinite(setupPx) && isFinite(atrN) && atrN > 0)
                  ? Math.abs(livePx - setupPx) / atrN : NaN;
      out.push({
        horizon: cfg.label, kind: hit.kind, dir: hit.dir, level: hit.level, why: hit.why,
        gates: gates, grade: grade, plan: plan,
        /* Carried on the candidate so the ranker can put the setup the rest
           of the desk agrees with above the one nothing supports. */
        consensus: hgOgConsensus(hgOgConsensusVoters(hits, rows, ex), hit),
        family: hgOgFamilyOf(hit.kind),
        rr: (plan && isFinite(fin(plan.rr1))) ? fin(plan.rr1) : NaN,
        distAtr: distAtr
      });
    }
    return out;
  }

  /* ==================== data ==================== */

  /* The app's gold chain, in order, all feature-checked. Whichever answers
     is NAMED — a PAXG-derived setup is not XAUUSD spot and the user should
     see which instrument produced their levels. */
  /* WHOSE GOLD IS THIS?

     The status line said "source: scalp binance-xau". That is an internal
     key, and it was the only thing on screen telling a reader which
     instrument produced their entry, stop and target. Asked directly whether
     the prices matched their broker, the honest answer needed three lookups
     through two files.

     binance-xau is Binance's USD-M XAUUSDT PERPETUAL. Measured live it sat
     $4374.58 against $4369.70 spot — 0.11% above, which on a 21.94-point
     scalp stop is 22% of 1R. The trade's SHAPE survives, because entry, stop
     and target all come from the same feed, but the printed levels are not
     the ones a broker on spot XAUUSD is showing. It also trades 24/7 while
     spot gold brokers close from Friday night to Sunday night, so a weekend
     scan is built on bars the broker never printed.

     None of that is fixable from here — pointing the desk at a broker's own
     feed needs the XM bridge configured, which is infrastructure, not code.
     What IS fixable is the desk claiming less than it knows. It now names the
     instrument in plain words and states its distance from spot. */
  var OG_SRC_LABEL = {
    'xm-xauusd':   'XM XAUUSD (your broker feed)',
    'gold-spot':   'spot XAU',
    'binance-xau': 'BINANCE XAUUSDT perp',
    'binance-paxg':'BINANCE PAXGUSDT (tokenised gold)',
    'binance-xaut':'BINANCE XAUTUSDT (tokenised gold)'
  };
  function hgOgSrcLabel(src){
    var k = String(src || '');
    return OG_SRC_LABEL[k] || (k || 'none');
  }
  /* True only for a feed that IS the instrument a spot-gold broker quotes. */
  function hgOgSrcIsBroker(src){ return String(src || '') === 'xm-xauusd'; }

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

  /* ==================== anticipation: the next gold levels ==================== */

  /* The desk's own levels, fed into the shared zone engine on equal terms:
     ADR bands (the day's statistical ceiling and floor), the Asia range
     (the liquidity London and New York hunt), and the prior ISO week's
     extremes. Everything else — swing points, prior day, Donchian, value
     area, round hundreds, AVWAP bands — the engine already reads. */
  function hgOgZoneLevels(rows, livePx){
    var above = [], below = [];
    /* survive feed-shaped garbage standalone: a hole-punched array (venue
       dropped a candle) must not throw — same rule as every other export */
    if (!Array.isArray(rows)) rows = [];
    rows = rows.filter(function(r){ return r && typeof r === 'object' && isFinite(fin(r.c)); });
    livePx = fin(livePx);
    if (!rows.length || !(livePx > 0)) return { above: above, below: below };
    function put(px, src){
      var v = fin(px);
      if (!isFinite(v) || v <= 0) return;
      if (v > livePx) above.push({ px: v, src: src });
      else if (v < livePx) below.push({ px: v, src: src });
    }
    var adr = hgOgAdr(rows, 14);
    if (adr && isFinite(fin(adr.adr))){
      if (isFinite(fin(adr.todayLo))) put(adr.todayLo + adr.adr, 'ADR ceiling');
      if (isFinite(fin(adr.todayHi))) put(adr.todayHi - adr.adr, 'ADR floor');
    }
    var asia = hgOgAsiaRange(rows);
    if (asia){
      put(asia.hi, 'Asia high');
      put(asia.lo, 'Asia low');
    }
    /* prior complete ISO week's extremes */
    var byWk = {}, i, t, wk;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t)) continue;
      wk = Math.floor((t - 345600) / 604800);   /* ISO-ish: weeks anchored Monday */
      if (!byWk[wk]) byWk[wk] = { hi: num(rows[i].h), lo: num(rows[i].l) };
      else {
        if (num(rows[i].h) > byWk[wk].hi) byWk[wk].hi = num(rows[i].h);
        if (num(rows[i].l) < byWk[wk].lo) byWk[wk].lo = num(rows[i].l);
      }
    }
    var wks = Object.keys(byWk).sort();
    if (wks.length >= 2){
      var pw = byWk[wks[wks.length - 2]];
      put(pw.hi, 'prior-week high');
      put(pw.lo, 'prior-week low');
    }
    return { above: above, below: below };
  }

  /* The NEXT GOLD LEVELS panel — anticipation, not a ticket. The 35-gate
     mechanic cards below stay the only path to a TICKET; this panel exists
     so the reader holds the next high and the next bottom BEFORE the
     market reaches them, with the trigger rule and the times it can fire. */
  function hgOgZonesPanel(rows, livePx){
    var opFn = gfn('opAssess'), tmFn = gfn('opNextCloses');
    if (!opFn || !rows || rows.length < 120 || !isFinite(fin(livePx))) return '';
    var cands;
    try { cands = opFn(rows, livePx, hgOgZoneLevels(rows, livePx)); }
    catch (e) { return ''; }
    if (!cands || !cands.length) return '';
    /* A gold zone flipping to TRIGGERED reaches the reader even off-tab —
       chime + Telegram through the alert bell's ZONES class, keyed per
       tab+zone (seeded silently on the first scan, never fires twice). */
    var azFn = gfn('hgAlertZones');
    if (azFn){
      try{
        azFn(cands.filter(function(zc){ return zc.status === 'TRIGGERED'; })
          .map(function(zc){
            return { sym: 'XAUUSD', dir: zc.dir, tab: 'OMNIGOLD',
                     zoneLo: zc.zone.lo, zoneHi: zc.zone.hi,
                     entry: zc.entry, stop: zc.stop, t1: zc.t1, t2: zc.t2, rr2: zc.rr2,
                     verdict: 'anticipation zone — the gated OMNIGOLD cards decide tickets' };
          }), 'OMNIGOLD');
      }catch(eAz){}
    }
    var h = '<div class="panel"><h2>NEXT GOLD LEVELS <span>anticipation — the nearest high-confluence zone each way · tickets are decided by the gated cards below</span></h2>';
    if (tmFn){
      try { h += '<div class="dim">triggers evaluate at 1h closes: ' + esc(tmFn(Date.now(), 3).join(' · ')) + '</div>'; } catch (e2) {}
    }
    for (var i = 0; i < cands.length; i++){
      var c = cands[i];
      h += '<div style="margin-top:6px">'
        + '<b>' + (c.dir === 'short' ? 'SHORT from' : 'LONG from') + ' ' + fmtPx(c.zone.lo) + '–' + fmtPx(c.zone.hi) + '</b>'
        + ' <span class="gpip' + (c.status === 'TRIGGERED' ? ' ok' : '') + '">' + c.status + '</span>'
        + ' <span class="dim">' + c.zone.confluence + ' sources: ' + esc(c.zone.srcs.join(', '))
        + ' · ' + c.zone.distAtr.toFixed(1) + '×ATR from ' + fmtPx(livePx) + '</span>'
        + '<div class="dim">if it rejects: entry ' + fmtPx(c.entry) + ' · SL ' + fmtPx(c.stop)
        + ' (squeezed) · TP1 ' + fmtPx(c.t1) + ' (2R) · TP2 ' + fmtPx(c.t2) + ' (' + c.rr2.toFixed(1) + 'R)'
        + ' · trigger: ' + esc(c.trigger) + '</div>'
        + (c.evidence && c.evidence.length
            ? '<div class="dim">evidence: ' + esc(c.evidence.join(' · ')) + '</div>'
            : '<div class="dim">no exhaustion evidence yet — a level, not a setup, until the tape argues for it</div>')
        + '</div>';
    }
    h += '</div>';
    return h;
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
    if (c && c.plan && c.plan.momentumStop === true){
      bits.push('stop is a labelled VOLATILITY / MOMENTUM stop — structure was too far; this is the compromise, not invalidation');
    }
    return bits;
  }

  /* Highest-ranked TICKET on one horizon, or null. Deliberately null rather
     than "the best of a bad lot": promoting a vetoed setup because it was the
     least-vetoed would defeat the entire ledger.

     Structural tickets win. If the only remaining ticket is a labelled
     volatility stop (runaway tape, no nearby pivot), take that rather than
     leave STRONGEST empty — empty is how the desk showed "no setup with
     ticket" while a with-trend continuation was the correct trade.

     Among those, prefer a level inside GOLD_NEAR_ATR of live gold, and
     among those the closest print. A 100-point FVG is still a ticket on
     the list; it is not the first card when a sweep two points off the
     market already has matching entry/stop. Far tickets remain if
     nothing nearer survived. */
  function hgOgPickFor(ranked, horizon){
    if (!ranked || !ranked.length) return null;
    var i, c, structural = [], vol = [];
    for (i = 0; i < ranked.length; i++){
      c = ranked[i];
      if (!c || c.horizon !== horizon) continue;
      if (!(c.grade && c.grade.ticket)) continue;
      if (!c.plan) continue;              /* no levels means nothing to act on */
      if (c.plan.momentumStop === true) vol.push(c);
      else structural.push(c);
    }
    var pool = structural.length ? structural : vol;
    if (!pool.length) return null;
    var near = [], anyDist = false;
    for (i = 0; i < pool.length; i++){
      if (isFinite(fin(pool[i].distAtr))){
        anyDist = true;
        if (pool[i].distAtr <= GOLD_NEAR_ATR) near.push(pool[i]);
      }
    }
    if (anyDist && near.length) pool = near;
    if (anyDist){
      pool = pool.slice().sort(function(a, b){
        var da = isFinite(fin(a.distAtr)) ? a.distAtr : 99;
        var db = isFinite(fin(b.distAtr)) ? b.distAtr : 99;
        return da - db;
      });
    }
    return pool[0];
  }

  function setupCard(c){
    var ev = (c.grade.evaluated || 0), tot = (c.grade.total || 0);
    var badge = c.grade.ticket ? pill('TICKET','ok') : pill(c.grade.vetoes.length ? 'VETO' : 'WATCH', c.grade.vetoes.length ? 'bad' : '');
    if (tot) badge += ' ' + pill(ev + '/' + tot + ' checks', ev * 2 >= tot ? '' : 'bad');
    if (c.topPick) badge = pill('STRONGEST ' + c.horizon, 'pick') + ' ' + badge;
    var h = '<div class="card' + (c.topPick ? ' og-pick' : '') + '">';
    h += '<div class="ttl">GOLD · ' + esc(c.horizon) + ' · ' + esc(c.kind) + ' ' + esc(c.dir.toUpperCase()) + ' ' + badge + '</div>';
    h += '<div class="dim">' + esc(c.why) + '</div>';
    /* the cross-horizon read — agreement is standing, disagreement is a
       warning the reader deserves before entering */
    if (c.horizonNote){
      h += '<div class="dim">' + pill(c.horizonAgree ? 'HORIZONS ALIGNED' : 'HORIZON CONFLICT', c.horizonAgree ? 'ok' : 'bad')
        +  ' ' + esc(c.horizonNote) + '</div>';
    }
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
    if (isFinite(fin(c.level))){
      h += '<div class="dim">SETUP ' + esc(c.kind) + ' @ ' + fmtPx(c.level)
        +  ((c.plan && isFinite(fin(c.plan.entry)) && Math.abs(c.plan.entry - c.level) > 0.05)
              ? (' · plan entry ' + fmtPx(c.plan.entry)) : '')
        +  '</div>';
    }
    if (c.plan){
      h += '<div class="plan">ENTRY ' + fmtPx(c.plan.entry) + ' · STOP ' + fmtPx(c.plan.stop)
        +  ' · T1 ' + fmtPx(c.plan.t1) + ' · T2 ' + fmtPx(c.plan.t2)
        +  ' · <b>R:R ' + fmt(c.plan.rr1, 2) + '</b> · risk ' + fmt(c.plan.riskPct, 2) + '%</div>';
      if (c.plan.note) h += '<div class="dim">' + esc(c.plan.note) + '</div>';
      /* The same levels in the reader's instrument. Only when the factor is
         real and the basis is worth mentioning — a broker-bridge feed, a
         failed spot fetch, or a sub-0.05% basis all render nothing. */
      var sf = fin(__og.spotFactor);
      if (isFinite(sf) && sf > 0 && Math.abs(sf - 1) > 0.0005){
        h += '<div class="dim">&#8776; SPOT-EQUIVALENT (basis ' + ((sf - 1) >= 0 ? '+' : '')
          +  ((sf - 1) * 100).toFixed(2) + '% applied, R:R unchanged): '
          +  'ENTRY ' + fmtPx(c.plan.entry * sf) + ' · STOP ' + fmtPx(c.plan.stop * sf)
          +  ' · T1 ' + fmtPx(c.plan.t1 * sf)
          +  (isFinite(fin(c.plan.t2)) ? ' · T2 ' + fmtPx(c.plan.t2 * sf) : '') + '</div>';
      }
    } else {
      h += '<div class="dim">no plan — structure could not clear the R floor, so no levels are shown.</div>';
    }
    h += '<ul class="lst">';
    for (var i = 0; i < c.gates.length; i++) h += gateLine(c.gates[i]);
    h += '</ul>';
    if (c.grade && c.grade.ticket && c.plan){
      h += '<div class="row" style="margin-top:8px">'
        +  '<button type="button" class="btn og-xm-send" data-og-key="' + esc(ogTradeKey(c)) + '">SEND TICKET TO XM</button>'
        +  '</div>';
    }
    h += '</div>';
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
             /* Gold scans 34 mechanics, so its bar is its own — passing none
                would judge a gold row against the crypto count. */
             ? W().hgOmniPoolRead(p, minRr, MIN_SAMPLES, hgOgFamilyZ(OG_MECHANICS.length))
             : { z: NaN, read: 'engine unavailable', need: null, cls: '' };
      var z = rd.z, read = rd.read, cls = rd.cls;
      /* Shared with omniroute, which already refuses to print a sample size
         nobody can act on. Raising the bar to the family-wise threshold made
         those numbers 2.2x larger, so the guard matters more, not less. */
      var needTxt = (W() && typeof W().hgOmniNeedText === 'function')
                  ? W().hgOmniNeedText(rd.need)
                  : (rd.need ? (' <span class="dim">(needs ~' + rd.need + ')</span>') : '');
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
    if (!f || (!f.samples && !f.open && !f.stale)) return '<span class="dim">—</span>';
    /* STALE is shown apart from OPEN. A record whose bars were never going to
       arrive — the contract was delisted, renamed, or simply stopped being
       scanned — is not a trade still running, and counting the two together
       overstates how much evidence is still in flight. */
    var st = (f.stale > 0) ? (' <span class="dim">· ' + f.stale + ' stale</span>') : '';
    if (!f.samples) return '<span class="dim">' + (f.open || 0) + ' open</span>' + st;
    return '<b>' + f.samples + '</b> · ' + (f.hit * 100).toFixed(0) + '%'
         + (f.open ? (' <span class="dim">(+' + f.open + ' open)</span>') : '') + st;
  }

  /* THE DESK READ — one plain sentence on why the desk is quiet.

     "Why does it show the wrong setups?" was asked four times, and each time
     the answer was recoverable only by reading every gate on every card and
     tallying by hand. The status line named the top blocking GATE, but a gate
     name is a category; the reader needed the market condition it implies.

     Live example this was built from: gold +2.7% in 24h, STRONG TREND up.
     With-trend entries had no placeable stop — the nearest structure sat
     6.8xATR away because the rally never paused long enough to print a
     pivot — while every setup WITH placeable structure was a counter-trend
     fade, vetoed by policy. Eleven coherent cards, zero tickets, and no
     sentence anywhere saying that. This derives one from the cards already
     graded: no refetch, no recompute. */
  function hgOgDeskRead(ranked, rows){
    try {
      if (!ranked || !ranked.length) return '';
      var tally = {}, i, j, g;
      for (i = 0; i < ranked.length; i++){
        var vs = (ranked[i].grade && ranked[i].grade.vetoes) || [];
        for (j = 0; j < vs.length; j++) tally[vs[j]] = (tally[vs[j]] || 0) + 1;
      }
      var keys = Object.keys(tally).sort(function(a, b){ return tally[b] - tally[a]; });
      if (!keys.length) return '';
      var move = NaN;
      if (rows && rows.length > 25){
        var c0 = fin(rows[rows.length - 25].c), c1 = fin(rows[rows.length - 1].c);
        if (isFinite(c0) && isFinite(c1) && c0 > 0) move = (c1 / c0 - 1) * 100;
      }
      var moveTxt = isFinite(move)
        ? ('gold has moved ' + (move >= 0 ? '+' : '') + move.toFixed(1) + '% in 24 bars')
        : 'the tape';
      var PLAIN = {
        'plan-levels': 'price has run without pausing, so there is no nearby structure to stop against — with-trend entries cannot place a stop',
        'fade-strength': 'the only placeable setups fade a strong trend, and the desk stands fades aside against a running tape',
        'adr-budget': 'the day has already spent its range, so chasing continuation late is blocked',
        'consensus': "the desk's own mechanics point both ways, and a two-sided tape earns no ticket",
        'participation': 'the trigger bars are thin for this time of day',
        'trend': 'the setups that fired point against the prevailing EMA stack',
        'htf-daily': 'the setups that fired disagree with the daily stack',
        'news-window': 'a news blackout is standing the whole desk aside',
        'level-fresh': 'the market has moved past the levels the mechanics fired at — the plans are priced off bars the tape has left behind',
        'measured-edge': 'the mechanics that fired have measurably not paid here'
      };
      var parts = [], used = 0;
      for (i = 0; i < keys.length && used < 2; i++){
        if (PLAIN[keys[i]]){ parts.push(PLAIN[keys[i]]); used++; }
      }
      if (!parts.length) return '';
      return 'DESK READ: ' + moveTxt + ' — ' + parts.join('; ')
           + '. Standing aside IS the read; a consolidation that prints new structure changes it.';
    } catch (e){ return ''; }
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
      /* The forming candle is dropped for the indicators, but its close IS the
         current price — keep it so the ledger can judge level freshness. */
      var livePx = rows.length ? fin(rows[rows.length - 1].c) : NaN;
      if (dropFn) rows = dropFn(rows, cfg.tf);        // closed candles only
      if (!rows.length) return { cfg: cfg, rows: [], source: got.source, cands: [], pooled: null, livePx: NaN };

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

      var hits = hgOgDetect(rows, { nowSec: shared.nowSec });
      /* the anticipation zones, computed once per horizon and handed to the
         ledger so zone-anchor can place every mechanic against real
         structure (best-effort: an absent engine reads UNCHECKED) */
      var zoneCtx = null;
      var opFn2 = gfn('opAssess');
      if (opFn2){
        try { zoneCtx = opFn2(rows, livePx, hgOgZoneLevels(rows, livePx)); } catch (eZc){ zoneCtx = null; }
      }
      var extra = {
        htf: dailyFn ? dailyFn(rows) : null,
        killzone: shared.killzone, macro: shared.macro,
        yieldRows: shared.yieldRows || null,
        nowSec: shared.nowSec,
        adr: hgOgAdr(rows, 14), news: shared.news, stats: pooled,
        livePx: livePx, zoneCtx: zoneCtx
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
      return { cfg: cfg, rows: rows, source: got.source, cands: cands, pooled: pooled, livePx: livePx };
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
    var shared = { killzone: null, macro: null, yieldRows: null, nowSec: Date.now() / 1000, news: null };
    try { var kz = gfn('goldKillzone'); if (kz) shared.killzone = kz(Date.now()); } catch (e) {}
    try { var nr = gfn('hgNewsRisk'); if (nr) shared.news = nr('XAUUSD'); } catch (e) {}
    __og.shared = shared;

    return Promise.resolve()
      .then(function(){ return macroFn ? macroFn() : null; })
      .catch(function(){ return null; })
      .then(function(m){
        shared.macro = m || null;
        shared.yieldRows = (m && m.us10yRows) ? m.us10yRows : null;
        shared.nowSec = Date.now() / 1000;
        return scanHorizon(HORIZONS.scalp, shared, ui);
      })
      .then(function(scalp){
        return scanHorizon(HORIZONS.swing, shared, ui).then(function(swing){
          return { scalp: scalp, swing: swing };
        });
      })
      .then(async function(res){
        /* SPOT-EQUIVALENT LEVELS. The feed is a Binance perp and the reader's
           broker quotes spot XAUUSD; the basis line already SAYS the levels
           are the perp's, but saying it does not make them placeable. A
           perp->spot conversion is one ratio (spot / perp-live) applied to
           entry, stop and targets alike, which preserves R:R exactly. Fetched
           BEFORE rendering, bounded to 2.5s, and NaN on any failure — cards
           then simply omit the extra line rather than waiting or lying. */
        __og.spotFactor = NaN;
        try {
          var sfFn = gfn('hgGoldLiveSpot');
          var sfFeed = (res.scalp.rows && res.scalp.rows.length)
                     ? fin(res.scalp.rows[res.scalp.rows.length - 1].c) : NaN;
          if (sfFn && isFinite(sfFeed) && sfFeed > 0 && !hgOgSrcIsBroker(res.scalp.source)){
            var sfSpot = await Promise.race([
              Promise.resolve(sfFn(sfFeed)),
              new Promise(function(r2){ setTimeout(function(){ r2(NaN); }, 2500); })
            ]);
            if (isFinite(sfSpot) && sfSpot > 0) __og.spotFactor = sfSpot / sfFeed;
          }
        } catch (eSf){}
        var rankFn = (w && typeof w.hgOmniRank === 'function') ? w.hgOmniRank : function(a){ return a; };
        var all = (res.scalp.cands || []).concat(res.swing.cands || []);
        /* HORIZON AGREEMENT — a scalp aligned with the swing horizon's read
           is a different trade from one fighting it, and until now the two
           scans never looked at each other. A chip, not a gate: each
           horizon's ledger was graded before the other existed, and an
           honest ledger is not edited after the fact. */
        (function(){
          var dirsOf = function(cands){
            var d = { long: [], short: [] }, i2, c2;
            for (i2 = 0; i2 < (cands || []).length; i2++){
              c2 = cands[i2];
              if (c2 && (c2.dir === 'long' || c2.dir === 'short') && d[c2.dir].indexOf(c2.kind) < 0) d[c2.dir].push(c2.kind);
            }
            return d;
          };
          var scalpD = dirsOf(res.scalp.cands), swingD = dirsOf(res.swing.cands);
          var mark2 = function(cands, other, otherLabel){
            for (var i3 = 0; i3 < (cands || []).length; i3++){
              var c3 = cands[i3];
              if (!c3 || (c3.dir !== 'long' && c3.dir !== 'short')) continue;
              var withMe = other[c3.dir], against = other[c3.dir === 'long' ? 'short' : 'long'];
              if (withMe.length){
                c3.horizonNote = otherLabel + ' horizon agrees (' + withMe.slice(0, 3).join(', ') + ')';
                c3.horizonAgree = true;
              } else if (against.length){
                c3.horizonNote = otherLabel + ' horizon reads the OTHER way (' + against.slice(0, 3).join(', ') + ')';
                c3.horizonAgree = false;
              }
            }
          };
          mark2(res.scalp.cands, swingD, 'SWING');
          mark2(res.swing.cands, scalpD, 'SCALP');
        })();
        var ranked = rankFn(all);
        __og.snap = { at: Date.now(), rows: ranked, scalp: res.scalp.pooled, swing: res.swing.pooled };
        /* Bars kept for the R/horizon grid — it re-runs the walk-forward on
           what the scan already fetched, so it costs no network. */
        __og.gridRows = { scalp: res.scalp.rows || [], swing: res.swing.rows || [] };
        __og.ran = true;
        __og.src = { scalp: res.scalp.source, swing: res.swing.source };

        var i;
        /* Over DISTINCT TRADES, not raw candidates — see ogDistinctCounts. */
        var dcounts = ogDistinctCounts(ranked);
        var tickets = dcounts.tickets;
        var srcNote = 'source: scalp ' + hgOgSrcLabel(res.scalp.source)
                    + ' · swing ' + hgOgSrcLabel(res.swing.source);
        __og.lastStat = ranked.length + ' setup(s)'
                      + (dcounts.trades < ranked.length
                          ? ' · ' + dcounts.trades + ' distinct trade(s) after collapsing '
                            + (ranked.length - dcounts.trades) + ' duplicate card(s) on identical levels'
                          : '')
                      + ' · ' + tickets + ' ticket(s) · ' + srcNote;
        /* When the desk produces NO tickets, name the gate responsible in the
           status line. A scan that reports "11 setups, 0 tickets" and nothing
           else sends the reader through every card looking for the common
           veto — and when a single market-wide gate is the cause, as a news
           blackout is, that is a long way to travel for one sentence. */
        if (!tickets && ranked.length){
          var blockTally = {}, bi, bj, bg;
          for (bi = 0; bi < ranked.length; bi++){
            for (bj = 0; bj < (ranked[bi].gates || []).length; bj++){
              bg = ranked[bi].gates[bj];
              if (bg && bg.pass === false && bg.info !== true){
                blockTally[bg.key] = (blockTally[bg.key] || 0) + 1;
              }
            }
          }
          var bKeys = Object.keys(blockTally).sort(function(a, b){ return blockTally[b] - blockTally[a]; });
          if (bKeys.length){
            var top = bKeys[0];
            __og.lastStat += '  ·  NO TICKETS: ' + top + ' vetoed '
                          + blockTally[top] + ' of ' + ranked.length + ' setups'
                          + (bKeys.length > 1 ? ' (then ' + bKeys.slice(1, 3).join(', ') + ')' : '')
                          + ' — run hgOgWhyNoTickets() for the full tally';
            /* And the condition behind the category, in words. */
            var deskRead = hgOgDeskRead(ranked, res.scalp.rows && res.scalp.rows.length ? res.scalp.rows : res.swing.rows);
            if (deskRead) __og.lastStat += '  ·  ' + deskRead;
          }
        }
        var warn = '';
        if (!res.scalp.rows.length && !res.swing.rows.length){
          warn = '  · NO gold bars from any source (XM bridge, spot proxy, PAXG) — this is a data problem, not a quiet market';
        }
        ui.stat.textContent = __og.lastStat + warn;

        /* THE BASIS, stated rather than left to be discovered. Fired after the
           status line is already up, so a slow or dead spot feed delays
           nothing and simply leaves the line as it was. */
        (function(){
          try {
            var spotFn = gfn('hgGoldLiveSpot');
            var srcKey = res.scalp.source || res.swing.source;
            if (!spotFn || !srcKey) return;
            if (hgOgSrcIsBroker(srcKey)) return;   /* already the broker's own feed */
            var lastRow = (res.scalp.rows && res.scalp.rows.length)
                        ? res.scalp.rows[res.scalp.rows.length - 1]
                        : ((res.swing.rows && res.swing.rows.length)
                            ? res.swing.rows[res.swing.rows.length - 1] : null);
            var feedPx = lastRow ? fin(lastRow.c) : NaN;
            if (!isFinite(feedPx) || feedPx <= 0) return;
            Promise.resolve(spotFn(feedPx)).then(function(spot){
              if (!isFinite(spot) || spot <= 0) return;
              var driftPct = (feedPx / spot - 1) * 100;
              var msg = '  ·  NOT a broker feed: ' + hgOgSrcLabel(srcKey)
                      + ' is ' + (driftPct >= 0 ? '+' : '') + driftPct.toFixed(2)
                      + '% vs spot ($' + feedPx.toFixed(2) + ' vs $' + spot.toFixed(2) + ')'
                      + ' — these levels are this instrument\'s, not your broker\'s XAUUSD';
              __og.lastStat += msg;
              ui.stat.textContent = __og.lastStat + warn;
            }).catch(function(){});
          } catch (eB){}
        })();

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
                          + '"needs ~N" is the sample this mechanic would take to clear the '
                          + OG_MECHANICS.length + '-mechanic significance bar (+' + hgOgFamilyZ(OG_MECHANICS.length).toFixed(2) + '&sigma;), '
                          + 'which is the same bar the measured-edge gate uses — not a lone 5% threshold. '
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
        /* The next levels FIRST: the reader asked to hold the high and the
           bottom before the market arrives — that answer leads the page. */
        try {
          if (res.scalp && res.scalp.rows && res.scalp.rows.length){
            h += hgOgZonesPanel(res.scalp.rows, res.scalp.livePx);
          }
        } catch (eZp) {}
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
        var ogSeen = {}, ogCollapsed = [];
        for (i = 0; i < ordered.length; i++){
          var cur = ordered[i], ok2 = ogTradeKey(cur);
          if (ogSeen[ok2] === undefined){
            ogSeen[ok2] = ogCollapsed.length;
            ogCollapsed.push(cur);
            continue;
          }
          var own = ogCollapsed[ogSeen[ok2]];
          if ((cur.grade && cur.grade.ticket) && !(own.grade && own.grade.ticket)){
            /* The cleared setup takes the card from the vetoed one, carrying
               the names already collected and adding the displaced owner. */
            var also = (own.alsoKinds || []).slice();
            if (also.indexOf(own.kind) < 0) also.push(own.kind);
            var drop = also.indexOf(cur.kind);
            if (drop >= 0) also.splice(drop, 1);
            cur.alsoKinds = also;
            ogCollapsed[ogSeen[ok2]] = cur;
            continue;
          }
          if (!own.alsoKinds) own.alsoKinds = [];
          if (own.alsoKinds.indexOf(cur.kind) < 0 && cur.kind !== own.kind){
            own.alsoKinds.push(cur.kind);
          }
        }
        /* A CARD WHOSE LEVELS ARE DEAD IS NOT A CARD.

           level-fresh already vetoes a plan the market has crossed, so it
           could not ticket — but the tab still drew it full size, ENTRY,
           STOP and T1 in large type, a hundred points from the chart. The
           veto badge was there; the numbers were what registered, and the
           reader kept seeing "a short trade with not even close levels".
           Reported three times before this landed.

           A dead card collapses to one dim line naming the gap and the
           cause. AGAINST (a genuine resting-order plan at real structure)
           still renders in full — those levels are meant to be far. */
        var deadLines = '';
        for (i = 0; i < ogCollapsed.length; i++){
          var cCard = ogCollapsed[i];
          var lfG = null, gj;
          for (gj = 0; gj < (cCard.gates || []).length; gj++){
            if (cCard.gates[gj] && cCard.gates[gj].key === 'level-fresh'){ lfG = cCard.gates[gj]; break; }
          }
          if (lfG && lfG.pass === false && lfG.info !== true){
            deadLines += '<div class="dim">' + esc(cCard.kind + ' ' + String(cCard.dir).toUpperCase())
                      +  ' — levels dead on arrival: ' + esc(String(lfG.why).replace(/^DEAD ON ARRIVAL — /, ''))
                      +  ' · card not rendered</div>';
            continue;
          }
          h += setupCard(cCard);
        }
        if (deadLines){
          h += '<div class="note" style="margin-top:10px"><b>DEAD LEVELS — priced off a closed bar the market has left behind:</b>'
            +  deadLines + '</div>';
        }
        ui.cards.innerHTML = h;
        if (ui.xmAuto && ui.xmAuto.checked) hgOgXmSendStrongest(ui);
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

  /* ==================== XM order bot ==================== */

  function hgOgXmLivePx(){
    var gr = __og.gridRows;
    var rows = (gr && gr.scalp && gr.scalp.length) ? gr.scalp
             : (gr && gr.swing && gr.swing.length ? gr.swing : null);
    if (!rows || !rows.length) return undefined;
    var px = fin(rows[rows.length - 1] && rows[rows.length - 1].c);
    return isFinite(px) && px > 0 ? px : undefined;
  }

  function hgOgXmSlim(c, liveOverride){
    if (!c || !(c.grade && c.grade.ticket) || !c.plan) return null;
    if (c.grade.vetoes && c.grade.vetoes.length) return null;
    if (c.dir !== 'long' && c.dir !== 'short') return null;
    var live = fin(liveOverride);
    if (!(live > 0)) live = isFinite(fin(c.livePx)) ? fin(c.livePx) : hgOgXmLivePx();
    return {
      source: 'OMNIGOLD',
      horizon: c.horizon,
      kind: c.kind,
      dir: c.dir,
      ticket: true,
      grade: { ticket: true, vetoes: [] },
      plan: { entry: c.plan.entry, stop: c.plan.stop, t1: c.plan.t1, t2: c.plan.t2 },
      livePx: live,
      symbol: 'XAUUSD'
    };
  }

  function hgOgXmStrongest(){
    var rows = __og.snap && __og.snap.rows;
    if (!rows || !rows.length) return [];
    var out = [], seen = {};
    var scalp = hgOgPickFor(rows, HORIZONS.scalp.label);
    var swing = hgOgPickFor(rows, HORIZONS.swing.label);
    [scalp, swing].forEach(function(c){
      var slim = hgOgXmSlim(c);
      if (!slim) return;
      var k = ogTradeKey(c);
      if (seen[k]) return;
      seen[k] = true;
      out.push(slim);
    });
    return out;
  }

  function hgOgXmFindByKey(key){
    var rows = __og.snap && __og.snap.rows;
    var i, c;
    for (i = 0; i < (rows || []).length; i++){
      c = rows[i];
      if (c && ogTradeKey(c) === key) return hgOgXmSlim(c);
    }
    return null;
  }

  function hgOgXmSetStat(ui, text){
    if (ui && ui.xmStat) ui.xmStat.textContent = text;
  }

  function hgOgXmPaintStatus(ui, st){
    if (!ui || !ui.xmStat) return;
    if (!st){ ui.xmStat.textContent = 'XM bot status unavailable'; return; }
    var bits = [];
    bits.push(st.configured ? ('bridge on · ' + (st.symbol || 'XAUUSD')) : 'bridge off — set XM_MT5_URL on Render');
    bits.push(st.live ? 'LIVE lots' : 'DRY RUN');
    bits.push((st.lots || 0.01) + ' lots (max ' + (st.maxLots || 0.10) + ')');
    if (st.halted) bits.push('HALTED');
    if (!st.authConfigured) bits.push('set HARDGATE_API_SECRET to send');
    else bits.push('API key required in header');
    if (st.last && st.last.reason) bits.push('last: ' + st.last.reason);
    ui.xmStat.textContent = bits.join(' · ');
  }

  function hgOgXmRefreshStatus(ui){
    if (typeof fetch !== 'function'){
      hgOgXmSetStat(ui, 'fetch unavailable');
      return Promise.resolve(null);
    }
    return fetch('/api/xm/bot', { cache: 'no-store' }).then(function(r){
      return r.json();
    }).then(function(st){
      hgOgXmPaintStatus(ui, st);
      return st;
    }).catch(function(){
      hgOgXmSetStat(ui, 'XM bot status failed');
      return null;
    });
  }

  function hgOgXmSendTickets(ui, tickets, label){
    tickets = tickets || [];
    if (!tickets.length){
      hgOgXmSetStat(ui, (label || 'XM') + ': no OMNIGOLD ticket to send (WATCH / VETO are never sent)');
      return Promise.resolve(null);
    }
    if (typeof fetch !== 'function'){
      hgOgXmSetStat(ui, 'fetch unavailable');
      return Promise.resolve(null);
    }
    var headers = gfn('hgApiHeaders')
                ? gfn('hgApiHeaders')()
                : { 'Content-Type': 'application/json' };
    hgOgXmSetStat(ui, 'sending ' + tickets.length + ' ticket(s) to XM…');
    return fetch('/api/xm/order', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ tickets: tickets })
    }).then(function(r){
      return r.json().then(function(j){ return { status: r.status, json: j }; });
    }).then(function(out){
      var j = out.json || {};
      var first = (j.results && j.results[0]) || j;
      var mode = first.dryRun ? 'DRY RUN' : 'LIVE';
      var msg;
      if (j.ok){
        msg = mode + ' ok — ' + tickets.length + ' ticket(s) '
            + (first.dryRun ? 'previewed, not sent' : 'posted to XM');
      } else {
        msg = mode + ' refused: ' + (j.reason || (first && first.reason) || ('HTTP ' + out.status));
      }
      hgOgXmSetStat(ui, msg);
      return j;
    }).catch(function(err){
      hgOgXmSetStat(ui, 'XM send failed: ' + ((err && err.message) || err));
      return null;
    });
  }

  function hgOgXmSendStrongest(ui){
    return hgOgXmSendTickets(ui, hgOgXmStrongest(), 'strongest');
  }

  /* Bot backtest: replay SEND STRONGEST on the bars this scan fetched.
     Not the mechanic R/HORIZON GRID (that enters at bar close). Macro and
     news are the last scan's snapshot; session/killzone read the prefix bar. */
  function hgOgXmBtExtra(prefix, cfg){
    var last = prefix && prefix.length ? prefix[prefix.length - 1] : null;
    var livePx = last ? fin(last.c) : NaN;
    var nowSec = last ? num(last.t) : NaN;
    var w = W();
    var dailyFn = (w && typeof w.hgOmniDailyHtf === 'function') ? w.hgOmniDailyHtf : null;
    var shared = __og.shared || {};
    var pooled = (__og.snap && cfg && (cfg.label === HORIZONS.scalp.label ? __og.snap.scalp : __og.snap.swing)) || null;
    var kzFn = gfn('goldKillzone');
    var killzone = null;
    try { if (kzFn && isFinite(nowSec)) killzone = kzFn(nowSec * 1000); } catch (eK) {}
    var zoneCtx = null;
    var opFn = gfn('opAssess');
    if (opFn && isFinite(livePx) && livePx > 0){
      try { zoneCtx = opFn(prefix, livePx, hgOgZoneLevels(prefix, livePx)); } catch (eZ) { zoneCtx = null; }
    }
    return {
      htf: dailyFn ? dailyFn(prefix) : null,
      killzone: killzone,
      macro: shared.macro,
      yieldRows: shared.yieldRows,
      nowSec: nowSec,
      adr: hgOgAdr(prefix, 14),
      news: shared.news,
      stats: pooled,
      livePx: livePx,
      zoneCtx: zoneCtx
    };
  }

  function hgOgXmBtTicketAt(prefix, cfg){
    if (!prefix || prefix.length < 40) return null;
    var last = prefix[prefix.length - 1];
    var hits = hgOgDetect(prefix, { nowSec: last ? num(last.t) : undefined });
    if (!hits || !hits.length) return null;
    var cands = hgOgEvaluate(prefix, hits, hgOgXmBtExtra(prefix, cfg), cfg);
    var pick = hgOgPickFor(cands, cfg.label);
    var live = last ? fin(last.c) : NaN;
    return hgOgXmSlim(pick, live);
  }

  function hgOgXmBtWalkHorizon(mod, rows, cfg, onProgress){
    return new Promise(function(resolve){
      if (!mod || !rows || rows.length < (cfg.warm + cfg.horizonBars + 2)){
        resolve(mod ? mod.ogXmBotSummarize([], { lots: 0.01, spreadUsd: ASSUMED_SPREAD_USD }) : null);
        return;
      }
      var i = cfg.warm;
      var takenUntil = -1;
      var trades = [];
      var cap = rows.length - cfg.horizonBars;
      function step(){
        var n = 0;
        while (n < 6 && i < cap){
          n++;
          if (i <= takenUntil){ i++; continue; }
          var slim = null;
          try { slim = hgOgXmBtTicketAt(rows.slice(0, i + 1), cfg); } catch (eT) { slim = null; }
          if (slim){
            var t = mod.ogXmBotWalkTrade(rows, i, slim, {
              horizon: cfg.horizonBars, fillBars: cfg.horizonBars,
              spreadUsd: ASSUMED_SPREAD_USD, lots: 0.01
            });
            if (t && t.state !== 'skip'){
              trades.push(t);
              takenUntil = i + cfg.horizonBars;
            }
          }
          i++;
        }
        if (typeof onProgress === 'function') onProgress(cfg.label, i, cap, trades.length);
        if (i >= cap){
          resolve(mod.ogXmBotSummarize(trades, { lots: 0.01, spreadUsd: ASSUMED_SPREAD_USD }));
          return;
        }
        setTimeout(step, 0);
      }
      setTimeout(step, 0);
    });
  }

  function hgOgXmBtPaint(ui, html){
    if (ui && ui.xmBtOut) ui.xmBtOut.innerHTML = html;
  }

  function hgOgXmRunBacktest(ui){
    ui = ui || __og.ui;
    if (!ui) return Promise.resolve(null);
    if (__og.btBusy || __og.busy){
      hgOgXmBtPaint(ui, '<div class="note">scan or backtest already running</div>');
      return Promise.resolve(null);
    }
    var gr = __og.gridRows;
    var scalpRows = gr && gr.scalp ? gr.scalp : [];
    var swingRows = gr && gr.swing ? gr.swing : [];
    if (!scalpRows.length && !swingRows.length){
      hgOgXmBtPaint(ui, '<div class="note warn">Run a gold scan first — the bot backtest uses the bars that scan fetched, and there are none yet.</div>');
      return Promise.resolve(null);
    }
    __og.btBusy = true;
    if (ui.xmBt) ui.xmBt.disabled = true;
    hgOgXmBtPaint(ui, '<div class="note">loading bot backtest…</div>');
    var ver = '434';
    try {
      var w = W();
      if (w && w.HG_BUILD && w.HG_BUILD.version) ver = String(w.HG_BUILD.version).replace(/^hg-v/, '');
    } catch (eV) {}
    return import('./lib/omnigold-xm-bot-backtest.mjs?v=' + ver).then(function(mod){
      var parts = [];
      function prog(label, i, cap, n){
        hgOgXmBtPaint(ui, '<div class="note">replaying ' + label + ' · bar ' + i + '/' + cap
          + ' · ' + n + ' send(s) so far — TICKET fill at setup entry, not bar close</div>'
          + parts.join(''));
      }
      var chain = Promise.resolve();
      if (scalpRows.length){
        chain = chain.then(function(){
          return hgOgXmBtWalkHorizon(mod, scalpRows, HORIZONS.scalp, prog).then(function(sum){
            parts.push(mod.ogXmBotBacktestHtml(sum, 'SCALP · XM bot'));
          });
        });
      }
      if (swingRows.length){
        chain = chain.then(function(){
          return hgOgXmBtWalkHorizon(mod, swingRows, HORIZONS.swing, prog).then(function(sum){
            parts.push(mod.ogXmBotBacktestHtml(sum, 'SWING · XM bot'));
          });
        });
      }
      return chain.then(function(){
        hgOgXmBtPaint(ui, parts.join('') || '<div class="note">no horizon had enough bars</div>');
        return parts;
      });
    }).catch(function(err){
      hgOgXmBtPaint(ui, '<div class="note warn">bot backtest failed: '
        + esc((err && err.message) || err) + '</div>');
      return null;
    }).then(function(out){
      __og.btBusy = false;
      if (ui.xmBt) ui.xmBt.disabled = false;
      return out;
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
      + '<div class="row"><button class="btn" id="ogRun">RUN GOLD SCAN</button>'
      +   ' <button class="btn" id="ogGrid">R / HORIZON GRID</button></div>'
      + '<div class="note" id="ogStat">idle — press RUN. Fetches two horizons of gold bars, then measures every mechanic on each.</div>'
      + '<div class="panel" id="ogXmBot" style="margin-top:12px">'
      +   '<h3>XM trader bot</h3>'
      +   '<p class="note">Sends this tab’s <b>TICKET</b> rows to your XM MT5 account through the same bridge as gold candles (<code>XM_MT5_URL</code>). '
      +   'WATCH and VETO are never sent. Crypto EXECUTE stays disabled. Default is <b>DRY RUN</b> — live lots require <code>XM_OMNIGOLD_LIVE=1</code> on Render plus the header API key matching <code>HARDGATE_API_SECRET</code>. '
      +   '<code>HARDGATE_KILL_SWITCH</code> / <code>HARDGATE_TRADING_HALT</code> block live sends. '
      +   '<b>BACKTEST BOT</b> replays that send path on the gold bars this scan fetched: pending fill at the setup entry, stop-first, GROSS vs NET of the $'
      +   (ASSUMED_SPREAD_USD * 2).toFixed(2) + ' round-trip spread. Unfilled is not a loss. In-sample — not a live XM statement.</p>'
      +   '<div class="note" id="ogXmStat" role="status">checking XM bot…</div>'
      +   '<div class="row" style="margin-top:8px">'
      +     '<button type="button" class="btn" id="ogXmSend">SEND STRONGEST TICKETS TO XM</button>'
      +     '<button type="button" class="btn ghost" id="ogXmRefresh">REFRESH XM STATUS</button>'
      +     '<button type="button" class="btn ghost" id="ogXmBt">BACKTEST BOT</button>'
      +   '</div>'
      +   '<label class="note" style="display:flex;gap:8px;align-items:center;margin-top:8px">'
      +     '<input type="checkbox" id="ogXmAuto">'
      +     ' Auto-send strongest tickets after each scan (still dry-run unless the server is live)'
      +   '</label>'
      +   '<div id="ogXmBtOut" style="margin-top:10px"></div>'
      + '</div>'
      + '<div id="ogGridOut" style="margin-top:10px"></div>'
      + '<div id="ogPool" style="margin-top:10px"></div>'
      + '<div class="cards" id="ogCards" style="margin-top:12px"></div>'
      + '</div>';

    var ui = {
      btn: el.querySelector('#ogRun'), stat: el.querySelector('#ogStat'),
      pool: el.querySelector('#ogPool'), cards: el.querySelector('#ogCards'),
      grid: el.querySelector('#ogGrid'), gridOut: el.querySelector('#ogGridOut'),
      xmStat: el.querySelector('#ogXmStat'), xmSend: el.querySelector('#ogXmSend'),
      xmRefresh: el.querySelector('#ogXmRefresh'), xmAuto: el.querySelector('#ogXmAuto'),
      xmBt: el.querySelector('#ogXmBt'), xmBtOut: el.querySelector('#ogXmBtOut')
    };
    if (!ui.btn || !ui.stat || !ui.cards || !ui.pool) return;

    /* THE R/HORIZON GRID, WHICH THIS DESK DID NOT HAVE.

       OMNIROUTE has carried this since the day its own test established the
       finding: the SAME six detectors run from -18.7 sigma at 3R/10 bars to
       +2.5 sigma at 1.5R/40 bars. Nothing about the detectors changes between
       those numbers — target and horizon do all the work. The gold desk trades
       SCALP at 1.5R/24 and SWING at 2R/20 and had no way to see whether that
       frame was throwing the edge away.

       Measured on 1,500 real XAUUSDT 1h bars, every one of the twelve cells
       came back inside noise: best +1.37 sigma at 1R/10, gold's own frame
       +0.36, the best reachable +0.83 at 1.5R/40, worst -1.50 at 3R/10
       against a family-wise bar of +2.97. So the frame is NOT the main
       problem here, and that is worth being able to see rather than assume.

       Same six detectors as the crypto grid — the ones this tab's own header
       calls "the OmniRoute six" — so the numbers are comparable across desks.
       A button, not part of every scan: it re-runs the walk-forward twelve
       times. */
    if (ui.grid){
      ui.grid.addEventListener('click', function(){
        var gw = W();
        if (!gw || typeof gw.hgOmniGridProgressive !== 'function'){
          ui.gridOut.innerHTML = '<div class="note warn">grid engine unavailable (omniroute.js not loaded)</div>';
          return;
        }
        var gr = __og.gridRows;
        var lists = [];
        if (gr && gr.scalp && gr.scalp.length) lists.push(gr.scalp);
        if (gr && gr.swing && gr.swing.length) lists.push(gr.swing);
        if (!lists.length){
          ui.gridOut.innerHTML = '<div class="note warn">Run a scan first — the grid measures the bars '
                               + 'that scan fetched, and there are none yet.</div>';
          return;
        }
        ui.grid.disabled = true;
        ui.gridOut.innerHTML = '<div class="note">measuring both gold horizons at 12 settings…</div>';
        var frame = '<div class="note">Gold trades SCALP at ' + HORIZONS.scalp.minRr + 'R / '
                  + HORIZONS.scalp.horizonBars + ' bars and SWING at ' + HORIZONS.swing.minRr + 'R / '
                  + HORIZONS.swing.horizonBars + ' bars. The grid sweeps around both. '
                  + 'Every figure is IN-SAMPLE and GROSS, and the best of twelve cells is the best of '
                  + 'twelve searches — the same multiple-comparisons bar that applies to picking a '
                  + 'mechanic applies to picking a setting.</div>';
        try {
          gw.hgOmniGridProgressive(lists,
            function(html){ ui.gridOut.innerHTML = frame + html; },
            function(html){ ui.gridOut.innerHTML = frame + html; ui.grid.disabled = false; });
        } catch (eG){
          ui.gridOut.innerHTML = '<div class="note warn">grid failed: ' + ((eG && eG.message) || eG) + '</div>';
          ui.grid.disabled = false;
        }
      });
    }
    __og.ui = ui;
    hgOgInjectPickStyles();
    try {
      var autoOn = false;
      try { autoOn = localStorage.getItem('hg_og_xm_auto') === '1'; } catch (eA) {}
      if (ui.xmAuto){
        ui.xmAuto.checked = autoOn;
        ui.xmAuto.addEventListener('change', function(){
          try { localStorage.setItem('hg_og_xm_auto', ui.xmAuto.checked ? '1' : '0'); } catch (eS) {}
        });
      }
      if (ui.xmSend) ui.xmSend.addEventListener('click', function(){ hgOgXmSendStrongest(ui); });
      if (ui.xmRefresh) ui.xmRefresh.addEventListener('click', function(){ hgOgXmRefreshStatus(ui); });
      if (ui.xmBt) ui.xmBt.addEventListener('click', function(){ hgOgXmRunBacktest(ui); });
      if (ui.cards){
        ui.cards.addEventListener('click', function(ev){
          var t = ev.target;
          if (!t || !t.getAttribute) return;
          if (!/\bog-xm-send\b/.test(t.className || '')) return;
          var key = t.getAttribute('data-og-key');
          var slim = hgOgXmFindByKey(key);
          hgOgXmSendTickets(ui, slim ? [slim] : [], 'ticket');
        });
      }
      hgOgXmRefreshStatus(ui);
    } catch (eXm) {}

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
    /* Exported so the ticket count can be tested apart from a live scan —
       the header and the rendered cards disagreed for want of exactly this. */
    window.ogDistinctCounts = ogDistinctCounts;
    window.ogTradeKey = ogTradeKey;
    window.hgOgEvaluate = hgOgEvaluate;
    window.hgOgPlanForHit = hgOgPlanForHit;
    window.hgOgXmSlim = hgOgXmSlim;
    window.hgOgXmStrongest = hgOgXmStrongest;
    window.hgOgXmRunBacktest = hgOgXmRunBacktest;
    window.hgOgConsensusVoters = hgOgConsensusVoters;
    window.hgOgPickFor = hgOgPickFor;
    window.hgOgZoneLevels = hgOgZoneLevels;   /* the desk's own anticipation levels, testable */
    window.hgOgZonesPanel = hgOgZonesPanel;
    /* hgOgReport() — the desk record, on demand, from the console.

       The forward log lives in localStorage, so it can only be read in the
       browser that produced it. Asking someone to paste a twenty-line
       snippet to see their own results is a way of not showing them. */
    /* Same diagnosis for the gold desk. The helper lives in omniroute, which
       loads first and which this tab already borrows its grader from. */
    /* Exported so the plain-language read is testable apart from a live scan. */
    window.hgOgDeskRead = hgOgDeskRead;
    window.hgOgWhyNoTickets = function(){
      var w = W();
      if (!w || typeof w.hgWhyNoTicketsFrom !== 'function'){
        return 'omniroute.js is not loaded — the shared diagnostic is unavailable.';
      }
      return w.hgWhyNoTicketsFrom(__og.snap && __og.snap.rows, 'OMNIGOLD');
    };

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
               + '  open ' + st.open + '  expired ' + st.expired
               + (st.stale ? '  STALE ' + st.stale : ''));
        out.push('  hit ' + (isFinite(st.hit) ? (st.hit * 100).toFixed(0) + '%' : '—')
               + '   expectancy ' + (isFinite(st.expR) ? ((st.expR >= 0 ? '+' : '') + st.expR.toFixed(2) + 'R') : '—'));
        var rows = [], k;
        for (k in pool){
          if (!Object.prototype.hasOwnProperty.call(pool, k)) continue;
          if (pool[k] && (pool[k].samples || pool[k].open || pool[k].stale)) rows.push([k, pool[k]]);
        }
        rows.sort(function(a, b){ return (b[1].samples || 0) - (a[1].samples || 0); });
        if (!rows.length){ out.push('  no mechanic has recorded anything yet on this horizon'); return; }
        rows.forEach(function(r){
          var p = r[1];
          out.push('    ' + String(r[0] + '               ').slice(0, 15)
                 + ' settled ' + String('  ' + p.samples).slice(-3)
                 + '  W' + String('  ' + p.wins).slice(-3) + ' L' + String('  ' + p.losses).slice(-3)
                 + '  open ' + String('  ' + p.open).slice(-3)
                 + (p.stale ? '  stale ' + p.stale : '')
                 + '  hit ' + (isFinite(p.hit) ? String('   ' + (p.hit * 100).toFixed(0) + '%').slice(-4) : '   —')
                 + '  exp ' + (isFinite(p.expR) ? ((p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R') : '—'));
        });
      });
      out.push('');
      out.push('Out-of-sample only. Every figure is GROSS of spread and commission.');
      out.push('STALE = recorded, then the bars to settle it never arrived (delisted, renamed,');
      out.push('or the contract stopped being scanned). Not a win, not a loss, not still running.');
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
