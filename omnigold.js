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

  /* Horizon shapes. Gold's intraday character is session-bound, so the scalp
     horizon reads 1h bars over ~2 weeks; the swing horizon mirrors
     OmniRoute's 4h/180. */
  var HORIZONS = {
    scalp: { tf: '1h', bars: 320, minRr: 1.5, horizonBars: 24, warm: 60, label: 'SCALP' },
    swing: { tf: '4h', bars: 180, minRr: 2.0, horizonBars: 20, warm: 45, label: 'SWING' }
  };

  var MIN_SAMPLES = 20;
  var EDGE_VETO_Z = -2;
  var EDGE_VETO_SAMPLES = 30;
  var DAILY_FAST = 10, DAILY_SLOW = 21;
  var REVERSION_KINDS = { SPRING:true, UTAD:true, VALUE:true, ABSORB:true, 'ADR-FADE':true, 'ROUND-MAGNET':true, 'KZ-JUDAS':true };

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
    var ref = isFinite(nowSec) ? nowSec : last;
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
    return out;
  }

  /* ==================== gold gate ledger ==================== */

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
    var closes = closesOf(rows);
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
    var volOk = isFinite(atrPct) ? (atrPct >= 0.12) : null;   // gold is far less volatile than alts
    gates.push({ key:'vol-alive', hard:true, pass: volOk,
      why: isFinite(atrPct) ? ('ATR ' + atrPct.toFixed(2) + '% of price' + (volOk ? '' : ' — too dead')) : 'ATR unavailable' });

    /* 3 — participation. CONDITIONAL on gold, unlike crypto: several gold
       feeds (spot proxies especially) publish no volume at all, and a hard
       volume gate would silently disqualify every setup sourced from them. */
    var mv = meanVol(rows.slice(0, rows.length - 1), 20), lv = num(rows[rows.length - 1].v);
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
      sess = (z !== 'OFF');
      sessWhy = 'session ' + (x.killzone.label || z) + (sess ? '' : ' — outside the London/NY killzones');
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
    var yld = null, yldWhy = 'US10Y series unavailable';
    if (x.yield && typeof x.yield.valid === 'boolean'){
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

    /* 11 — measured edge: this mechanic's own walk-forward on THIS horizon,
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
      if (sN < MIN_SAMPLES) edWhy = 'only ' + sN + ' past samples — too few to judge';
      else if (z <= EDGE_VETO_Z && sN >= EDGE_VETO_SAMPLES){ ed = false; edWhy = stat + ' — significantly below breakeven, this mechanic has not paid'; }
      else if (z <= EDGE_VETO_Z){ ed = true; edWhy = stat + ' — below breakeven, but only ' + sN + ' samples: too few to veto on'; }
      else { ed = true; edWhy = stat + (z < 0 ? ' — below breakeven but within noise' : ''); }
    }
    gates.push({ key:'measured-edge', hard:false, pass: ed, why: edWhy });

    return gates;
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
      ex.minRr = cfg.minRr;
      var gates = hgOgGates(rows, hit, ex);
      var grade = gradeFn ? gradeFn(gates) : { ticket:false, vetoes:[], unknown:[], degraded:[], evaluated:0, total:gates.length, verdict:'engine unavailable' };
      var plan = null;
      if (planFn){
        try { plan = planFn(hit.dir, rows, undefined, { minRr: cfg.minRr }); } catch (e) { plan = null; }
      }
      if (plan && deriveFn) plan = deriveFn(plan);
      out.push({
        horizon: cfg.label, kind: hit.kind, dir: hit.dir, level: hit.level, why: hit.why,
        gates: gates, grade: grade, plan: plan,
        rr: (plan && isFinite(num(plan.rr1))) ? num(plan.rr1) : NaN
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
  function fmtPx(n){ var v = +n; return isFinite(v) ? v.toFixed(2) : '—'; }
  function fmt(n, d){ return isFinite(n) ? (+n).toFixed(d == null ? 2 : d) : '—'; }

  function gateLine(g){
    var cls = g.pass === true ? 'ok' : (g.pass === false ? 'bad' : '');
    var mark = g.pass === true ? 'PASS' : (g.pass === false ? 'VETO' : (g.hard ? 'NO DATA' : 'UNCHECKED'));
    return '<li>' + pill(mark, cls) + ' <b>' + esc(g.key) + '</b> <span class="dim">' + esc(g.why) + '</span></li>';
  }

  function setupCard(c){
    var ev = (c.grade.evaluated || 0), tot = (c.grade.total || 0);
    var badge = c.grade.ticket ? pill('TICKET','ok') : pill(c.grade.vetoes.length ? 'VETO' : 'WATCH', c.grade.vetoes.length ? 'bad' : '');
    if (tot) badge += ' ' + pill(ev + '/' + tot + ' checks', ev * 2 >= tot ? '' : 'bad');
    var h = '<div class="card">';
    h += '<div class="ttl">GOLD · ' + esc(c.horizon) + ' · ' + esc(c.kind) + ' ' + esc(c.dir.toUpperCase()) + ' ' + badge + '</div>';
    h += '<div class="dim">' + esc(c.why) + '</div>';
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

  function renderPooled(pool, label, minRr){
    if (!pool) return '';
    var keys = ['SPRING','PO3','ORB','ABSORB','VALUE','MMOVE','ASIA-BREAK','KZ-JUDAS','ADR-FADE','ROUND-MAGNET'];
    var h = '<h4>' + esc(label) + ' — measured on this horizon</h4>';
    h += '<table class="tbl"><thead><tr><th>MECHANIC</th><th>SAMPLES</th><th>T1-FIRST</th><th>EXPECTANCY</th><th>READ</th></tr></thead><tbody>';
    var pBreak = 1 / (1 + minRr);
    for (var i = 0; i < keys.length; i++){
      var k = keys[i], p = pool[k];
      if (!p || !p.samples){
        h += '<tr><td><b>' + k + '</b></td><td class="dim">0</td><td class="dim">—</td><td class="dim">—</td><td class="dim">never fired here</td></tr>';
        continue;
      }
      var se = Math.sqrt(pBreak * (1 - pBreak) / Math.max(1, p.samples));
      var z = se > 0 ? ((p.hit - pBreak) / se) : 0;
      var thin = p.samples < MIN_SAMPLES;
      var read = thin ? 'too few to judge' : (z <= EDGE_VETO_Z ? 'has not paid' : (z > 0 ? 'has paid' : 'within noise'));
      var cls = thin ? '' : (z <= EDGE_VETO_Z ? 'bad' : (z > 0 ? 'ok' : ''));
      h += '<tr><td><b>' + k + '</b></td><td>' + p.samples + '</td><td>' + (p.hit * 100).toFixed(0) + '%</td>'
        +  '<td>' + (p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R</td><td>' + pill(read, cls) + '</td></tr>';
    }
    return h + '</tbody></table>';
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
          'ROUND-MAGNET': function(r){ return hgOgRoundMagnet(r); }
        };
        var k;
        for (k in fns) if (Object.prototype.hasOwnProperty.call(fns, k)){
          stats[k] = btFn(rows, fns[k], { rMult: cfg.minRr, horizon: cfg.horizonBars, warm: cfg.warm });
        }
        pooled = poolFn ? poolFn([stats]) : stats;
      }

      var hits = hgOgDetect(rows, {});
      var extra = {
        htf: dailyFn ? dailyFn(rows) : null,
        killzone: shared.killzone, macro: shared.macro, yield: shared.yieldGuard,
        adr: hgOgAdr(rows, 14), news: shared.news, stats: pooled
      };
      var cands = hgOgEvaluate(rows, hits, extra, cfg);
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

        ui.pool.innerHTML = renderPooled(res.scalp.pooled, 'SCALP (' + HORIZONS.scalp.tf + ', ' + HORIZONS.scalp.minRr + 'R)', HORIZONS.scalp.minRr)
                          + renderPooled(res.swing.pooled, 'SWING (' + HORIZONS.swing.tf + ', ' + HORIZONS.swing.minRr + 'R)', HORIZONS.swing.minRr)
                          + '<div class="note">Walk-forward on the same bars just read, per horizon and never merged — a mechanic that pays on 4h need not pay on 1h. '
                          + 'A bar spanning both stop and target counts as a STOP. In-sample on a short window; under ' + MIN_SAMPLES + ' samples is noise.</div>';

        if (!ranked.length){
          ui.cards.innerHTML = (!res.scalp.rows.length && !res.swing.rows.length)
            ? '<div class="note warn">No gold candles were returned by any source, so nothing could be scanned. Check the XM bridge / spot proxy before reading anything into this.</div>'
            : '<div class="empty">no gold setup fired on either horizon. That is a normal result — the detectors are meant to be quiet.</div>';
          return;
        }
        var h = '';
        for (i = 0; i < ranked.length; i++) h += setupCard(ranked[i]);
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
    window.hgOgDetect = hgOgDetect;
    window.hgOgGates = hgOgGates;
    window.hgOgEvaluate = hgOgEvaluate;
    window.hgOgState = function hgOgState(){
      try { return __og.snap ? JSON.parse(JSON.stringify(__og.snap)) : null; } catch (e) { return null; }
    };
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push({ id: 'omnigold', label: 'OMNIGOLD', mount: mountOmnigold, refresh: refreshOmnigold });
  }

})();
