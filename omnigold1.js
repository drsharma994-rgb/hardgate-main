/* HARDGATE — OMNIGOLD 1 · institutional-grade gold setup engine.

   Sections 0–8 of the field instruction, printed in order:
     0  DATA LOAD + 10-item VETO STACK      (any veto → SCORE 0 · NO TRADE · stop)
     1  REGIME + PERMISSION LAYER           (KER regime · day type · 4H bias · weekly S28 · trader state)
     2  20-POINT CONFLUENCE MATRIX          (Block A 10 · Block B 10 · one vote per family · 4-family spread)
     3  DECISION                            (≥12 full · 10–11 half if RR≥2 · <10 NO SETUP · ML inflation guard)
     4  STRATEGY SELECTOR                   (PRIMARY S__ · ALSO · TARGET LOGIC · priority ladder)
     5  TRADE LEVELS                        (entry · stop buffer rules · TP1/TP2 · management · venue · expression)
     6  POSITION SIZE                       (V-Mod clamped 0.5–1.5 · tiers · venue multiplier · liquidation clearance)
     7  12 CORE GATES cross-check           (gates win on conflict → MATRIX/GATE CONFLICT)
     8  TRIGGER                             (TRIGGERED / WAIT / EXPIRED on the last CLOSED 1H + 15m)

   Contract (same as gold-seven-step.js, whose helpers it reuses via HG_GOLD7):
     closed candles only · every number from data · "unavailable" never estimated ·
     no win rate / probability / confidence % · one vote per evidence family ·
     never invents direction · against-tape hypotheses are HELD, never scored best.  */
(function (root) {
  'use strict';
  var W = root || (typeof window !== 'undefined' ? window : globalThis);
  var HOUR = 3600, H4 = 14400;

  function gfn(n){ try{ var f = W[n]; return typeof f === 'function' ? f : null; }catch(e){ return null; } }
  function G7(){ return W.HG_GOLD7 || null; }
  function fin(x){ var v = +x; return isFinite(v) ? v : NaN; }
  function has(x){ return x != null && x !== '' && typeof x !== 'boolean' && isFinite(+x); }
  function up(s){ return String(s || '').toUpperCase(); }
  function esc(s){ return String(s == null ? '' : s).replace(/[<>&]/g, function(c){ return c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'; }); }
  function px(x){ return has(x) ? (+x).toFixed(2) : 'unavailable'; }
  function num(x, d){ return has(x) ? (+x).toFixed(d == null ? 2 : d) : 'unavailable'; }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  /* ---------------- strategy families (Section 1 / 4) ---------------- */
  var CLASS_OF = {
    S0: 'sweep', S9: 'sweep', S10: 'sweep', S16: 'sweep', S20: 'sweep', S27: 'sweep', S36: 'sweep', S37: 'sweep',
    S17: 'composite', S19: 'composite', S7: 'composite',
    S3: 'continuation', S5: 'continuation', S12: 'continuation', S25: 'continuation', S30: 'continuation',
    S4: 'breakout',
    S8: 'fade', S13: 'fade', S14: 'fade', S21: 'fade', S22: 'fade', S24: 'fade', S33: 'fade', S65: 'fade',
    S1: 'target', S2: 'target', S11: 'target', S15: 'target', S18: 'target', S26: 'target', S38: 'target'
  };
  var NAME_OF = {
    S0: 'AMD sweep-reclaim', S9: 'discount/premium-filtered sweep', S10: 'MSS-refined sweep', S16: 'absorption sweep', S20: 'turtle soup',
    S27: 'post-news sweep', S36: 'SMT-confirmed sweep', S37: 'failed-sweep continuation', S17: 'look-above-and-fail', S19: 'Wyckoff spring + test',
    S7: 'Monday-range weekly sweep', S3: 'developing-POC pullback', S5: 'IB extension', S12: 'contraction breakout', S25: 'open-drive join',
    S30: 'session-composite pullback', S4: 'composite VA breakout-retest', S8: 'PM-fix fade', S13: 'silver non-confirmation', S14: 'ADR exhaustion',
    S21: 'implied-move fade', S22: 'VWAP 2σ', S24: 'three-drive', S33: 'z-score fade', S65: 'perp premium fade',
    S1: '80% rule', S2: 'naked POC', S11: 'gap', S15: 'poor/excess high', S18: 'Asia SD bands', S26: 'expiry pin', S38: 'nPOC ladder'
  };
  var LADDER = { composite: 2, sweep: 3, weekly: 4, continuation: 5, breakout: 6, fade: 7 };
  function enabledClasses(regime){
    if (regime === 'TREND') return { continuation: true, breakout: true, sweep: 'bias-side', composite: false, fade: false };
    if (regime === 'CHOP') return { continuation: false, breakout: false, sweep: true, composite: true, rotation: true, fade: true };
    return { continuation: 'day-type', breakout: 'day-type', sweep: true, composite: true, fade: 'day-type' };
  }

  /* ---------------- derived series ---------------- */
  function sessionVwap(rows1h, anchorUtcHour){
    /* anchor = last 22:00 UTC at or before the last closed bar */
    if (!rows1h.length) return { vwap: NaN, sd: NaN, n: 0 };
    var last = rows1h[rows1h.length - 1].t;
    var dayStart = Math.floor((last - anchorUtcHour * HOUR) / 86400) * 86400 + anchorUtcHour * HOUR;
    var pv = 0, vv = 0, i, r, n = 0, tp = [];
    for (i = 0; i < rows1h.length; i++){
      r = rows1h[i]; if (r.t < dayStart) continue;
      var t = (r.h + r.l + r.c) / 3, v = r.v > 0 ? r.v : 1;
      pv += t * v; vv += v; n++; tp.push({ t: t, v: v });
    }
    if (!vv) return { vwap: NaN, sd: NaN, n: 0 };
    var vw = pv / vv, s = 0;
    for (i = 0; i < tp.length; i++) s += tp[i].v * (tp[i].t - vw) * (tp[i].t - vw);
    return { vwap: vw, sd: Math.sqrt(s / vv), n: n, anchorT: dayStart };
  }
  function anchoredVwap(rows, fromT){
    var pv = 0, vv = 0, i, r;
    for (i = 0; i < rows.length; i++){ r = rows[i]; if (r.t < fromT) continue; var v = r.v > 0 ? r.v : 1; pv += (r.h + r.l + r.c) / 3 * v; vv += v; }
    return vv ? pv / vv : NaN;
  }
  function realizedVol20(rows4h){
    /* 20 daily closes from 4H (6 bars/day) → annualised % */
    var daily = [], i, g = G7();
    for (i = 0; i < rows4h.length; i++){ var k = g.dayKey(rows4h[i].t); if (!daily.length || daily[daily.length - 1].k !== k) daily.push({ k: k, c: rows4h[i].c }); else daily[daily.length - 1].c = rows4h[i].c; }
    if (daily.length < 21) return NaN;
    var rets = [], m = 0;
    for (i = daily.length - 20; i < daily.length; i++){ var r = Math.log(daily[i].c / daily[i - 1].c); rets.push(r); m += r; }
    m /= rets.length; var s = 0;
    for (i = 0; i < rets.length; i++) s += (rets[i] - m) * (rets[i] - m);
    return Math.sqrt(s / (rets.length - 1)) * Math.sqrt(252) * 100;
  }
  function rvolThisHour(rows1h){
    if (rows1h.length < 48) return NaN;
    var last = rows1h[rows1h.length - 1], hr = Math.floor(last.t / HOUR) % 24, s = 0, n = 0, i;
    for (i = rows1h.length - 2; i >= 0 && n < 20; i--){ if (Math.floor(rows1h[i].t / HOUR) % 24 === hr){ s += rows1h[i].v; n++; } }
    if (!n || !(s > 0)) return NaN;
    return last.v / (s / n);
  }
  function zScore20(rows1h){
    if (rows1h.length < 21) return NaN;
    var i, m = 0, s = 0, sl = rows1h.slice(-20);
    for (i = 0; i < sl.length; i++) m += sl[i].c; m /= sl.length;
    for (i = 0; i < sl.length; i++) s += (sl[i].c - m) * (sl[i].c - m);
    var sd = Math.sqrt(s / sl.length);
    return sd > 0 ? (rows1h[rows1h.length - 1].c - m) / sd : NaN;
  }
  function kerSeries(rows4h){
    var out = [], i, g = G7();
    for (i = 21; i <= rows4h.length; i++) out.push(g.ker20(rows4h.slice(0, i)));
    return out;
  }
  function regimeOf(k){ return !isFinite(k) ? 'unavailable' : k > 0.6 ? 'TREND' : k < 0.3 ? 'CHOP' : 'MIXED'; }
  function mondayRange(rows1h){
    if (!rows1h.length) return null;
    var g = G7(), last = rows1h[rows1h.length - 1].t;
    var dow = new Date(last * 1000).getUTCDay(); /* 0 Sun */
    var daysBack = (dow + 6) % 7; /* days since Monday */
    var monKey = g.dayKey(last) - daysBack, hi = -Infinity, lo = Infinity, i, saw = false;
    for (i = 0; i < rows1h.length; i++){ if (g.dayKey(rows1h[i].t) !== monKey) continue; saw = true; if (rows1h[i].h > hi) hi = rows1h[i].h; if (rows1h[i].l < lo) lo = rows1h[i].l; }
    return saw && hi > lo && daysBack > 0 ? { hi: hi, lo: lo } : null;
  }
  function cvdDivergence(rows15m, cvd, dir){
    /* price LL vs prior swing while CVD HL within the last 6 × 15m (LONG); mirror for SHORT */
    if (!Array.isArray(cvd) || cvd.length < 12 || rows15m.length < 12) return { ok: false, why: 'CVD unavailable' };
    var n = Math.min(rows15m.length, cvd.length), r = rows15m.slice(-n), c = cvd.slice(-n);
    var w = 6, i, recentLo = Infinity, recentHi = -Infinity, recentCvdLo = Infinity, recentCvdHi = -Infinity;
    for (i = n - w; i < n; i++){ recentLo = Math.min(recentLo, r[i].l); recentHi = Math.max(recentHi, r[i].h); recentCvdLo = Math.min(recentCvdLo, c[i]); recentCvdHi = Math.max(recentCvdHi, c[i]); }
    var priorLo = Infinity, priorHi = -Infinity, priorCvdLo = Infinity, priorCvdHi = -Infinity;
    for (i = Math.max(0, n - 3 * w); i < n - w; i++){ priorLo = Math.min(priorLo, r[i].l); priorHi = Math.max(priorHi, r[i].h); priorCvdLo = Math.min(priorCvdLo, c[i]); priorCvdHi = Math.max(priorCvdHi, c[i]); }
    if (dir === 'long'){ var ok = recentLo < priorLo && recentCvdLo > priorCvdLo; return { ok: ok, why: ok ? 'price lower low ' + px(recentLo) + ' vs ' + px(priorLo) + ' while CVD higher low' : 'no bullish delta divergence in last 6 × 15m' }; }
    var ok2 = recentHi > priorHi && recentCvdHi < priorCvdHi;
    return { ok: ok2, why: ok2 ? 'price higher high ' + px(recentHi) + ' vs ' + px(priorHi) + ' while CVD lower high' : 'no bearish delta divergence in last 6 × 15m' };
  }

  /* ---------------- 12 core gates (Playbook §10) ---------------- */
  function coreGates(ctx, c){
    var g = G7(), gates = [], pass = 0;
    function gate(n, name, ok, note){ gates.push({ n: n, name: name, pass: !!ok, note: note || '' }); if (ok) pass++; }
    var b = ctx.bias;
    gate(1, 'bias defined', b.bias !== 'NO TRADE', b.bias + (b.transition ? ' (TRANSITION)' : ''));
    gate(2, 'direction matches', b.bias === up(c.dir) || (b.bias === 'BOTH' && (c.grade === 'A' || c.grade === 'B+' || ctx.atVaEdge)), up(c.dir) + ' vs ' + b.bias);
    gate(3, 'location A / B+', c.grade === 'A' || c.grade === 'B+', c.grade + ' — ' + c.gradeWhy);
    var minBreach = Math.max(1, 0.25 * ctx.atr1h);
    gate(4, 'pool swept', has(c.breach) && c.breach >= minBreach, has(c.breach) ? (c.kind + ' by $' + num(c.breach) + ' (min $' + num(minBreach) + ')') : 'no sweep');
    gate(5, 'reclaim ≤ 3 bars, no acceptance', c.reclaimed && c.age <= g.MAX_SWEEP_AGE && !c.acceptance, c.reclaimed ? ('age ' + c.age + (c.acceptance ? ' · acceptance' : '')) : 'reclaim not closed');
    gate(6, 'body in OB', c.obOk, c.ob ? ('OB ' + px(c.ob.lo) + '–' + px(c.ob.hi)) : 'no fresh ' + c.dir + ' OB');
    gate(7, 'session window · no lockout', ctx.session.tradeable && !ctx.news.lock, ctx.session.label + (ctx.news.lock ? ' · LOCKOUT' : ''));
    gate(8, 'LVN path', c.lvnPath, c.lvnPath ? 'LVN between entry and TP1' : 'no LVN path');
    gate(9, 'RR ≥ 2', has(c.rr1) && c.rr1 >= 1.5, has(c.rr1) ? (num(c.rr1) + 'R' + (c.rr1 < 2 ? ' (half band)' : '')) : 'no TP1');
    gate(10, 'R ≤ 0.6 × ' + (ctx.ctxLabel || '4H') + ' ATR', c.risk <= 0.6 * ctx.atr4h, 'R $' + num(c.risk) + ' vs $' + num(0.6 * ctx.atr4h));
    gate(11, 'feed sane', ctx.feedOk, ctx.feedWhy);
    gate(12, '< 2 stops today', !(ctx.stopsToday >= 2), has(ctx.stopsToday) ? ('stops ' + ctx.stopsToday) : 'stops today unavailable — passes with note');
    return { gates: gates, pass: pass, halfBand: has(c.rr1) && c.rr1 >= 1.5 && c.rr1 < 2 };
  }

  /* ================================================================== */
  /*                               ENGINE                               */
  /* ================================================================== */
  function hgOg1Engine(inp){
    inp = inp || {};
    var g = G7();
    var nowMs = has(inp.now) ? +inp.now : Date.now();
    /* horizon: SWING = 4H context / 1H execution (default) · SCALP = 1H context / 15m execution.
       Same veto stack, matrix, gates and trigger — only the bar the rules read changes. */
    var horizon = up(inp.horizon) === 'SCALP' ? 'SCALP' : 'SWING';
    var out = { ok: false, status: 'DATA_UNAVAILABLE', why: '', now: nowMs, horizon: horizon, sections: {}, summary: [],
                disclaimer: 'Rule-based confluence score and gate checklist, not a probability or advice. I enter only on my own review.' };
    if (!g){ out.why = 'gold-seven-step.js not loaded (HG_GOLD7 missing)'; out.summary = ['DATA_UNAVAILABLE — ' + out.why, out.disclaimer]; return out; }
    out.nowIst = g.istUtcDay(nowMs);

    /* ---------------- SECTION 0 — data load ---------------- */
    var rows1hAll = g.closedRows(inp.rows1h, HOUR, nowMs);
    var rows15All = g.closedRows(inp.rows15m, 900, nowMs);
    var rows4hAll = g.closedRows(inp.rows4h, H4, nowMs), derived4h = false;
    if (rows4hAll.length < 60 && rows1hAll.length >= 8){ rows4hAll = g.derive4h(rows1hAll, nowMs); derived4h = true; }
    if (!rows1hAll.length && rows15All.length){
      /* 1H from 15m when the feed carried no 1H leg — closed buckets only */
      var bk = {}, ord = [], bi;
      for (bi = 0; bi < rows15All.length; bi++){ var r0 = rows15All[bi], b0 = Math.floor(r0.t / HOUR) * HOUR; if (!bk[b0]){ bk[b0] = { t: b0, o: r0.o, h: r0.h, l: r0.l, c: r0.c, v: r0.v, n: 1 }; ord.push(b0); } else { var kk = bk[b0]; if (r0.h > kk.h) kk.h = r0.h; if (r0.l < kk.l) kk.l = r0.l; kk.c = r0.c; kk.v += r0.v; kk.n++; } }
      for (bi = 0; bi < ord.length; bi++) if (bk[ord[bi]].n === 4) rows1hAll.push(bk[ord[bi]]);
      rows1hAll = g.closedRows(rows1hAll, HOUR, nowMs);
    }
    /* execution / context rows for this horizon (the rest of the engine reads these names) */
    var scalp = horizon === 'SCALP';
    var rows1h = scalp ? rows15All : rows1hAll;       /* execution bars */
    var rows4h = scalp ? rows1hAll : rows4hAll;       /* context bars */
    var rows15 = rows15All;
    var TF = scalp ? 900 : HOUR, TF_LABEL = scalp ? '15m' : '1H', CTX_LABEL = scalp ? '1H' : '4H';
    var feed = String(inp.feed || 'unavailable'), venue = String(inp.venue || 'analysis feed');
    var basisPct = fin(inp.basisPct), basisUsd = has(inp.basisUsd) ? +inp.basisUsd : (has(basisPct) && rows1h.length ? basisPct / 100 * rows1h[rows1h.length - 1].c : NaN);
    var basisMean5d = fin(inp.basisUsd5dMean);
    var lastCloseMs = rows1hAll.length ? (rows1hAll[rows1hAll.length - 1].t + HOUR) * 1000 : NaN;   /* 1H leg — the staleness clock */
    var lastExecCloseMs = rows1h.length ? (rows1h[rows1h.length - 1].t + TF) * 1000 : NaN;          /* execution bar */
    var load = [];
    function L(name, state, note){ load.push({ name: name, state: state, note: note || '' }); }
    L('1H OHLCV', rows1hAll.length ? 'live' : 'unavailable', rows1hAll.length + ' closed bars · ' + feed);
    L('15m OHLCV', rows15All.length ? 'live' : 'unavailable', rows15All.length + ' closed bars');
    L('4H', rows4hAll.length ? (derived4h ? 'derived' : 'live') : 'unavailable', rows4hAll.length + ' bars' + (derived4h ? ' derived from 1H @ 22:00 UTC' : ''));
    L('horizon', 'live', horizon + ' — context ' + CTX_LABEL + ' (' + rows4h.length + ' bars) · execution ' + TF_LABEL + ' (' + rows1h.length + ' bars)');
    var bid = fin(inp.bid), ask = fin(inp.ask), spread = has(inp.spreadUsd) ? +inp.spreadUsd : (has(bid) && has(ask) ? ask - bid : NaN), spreadAvg = fin(inp.spreadAvgHour);
    L('bid/ask + 20d avg spread', has(spread) ? (has(spreadAvg) ? 'live' : 'partial') : 'unavailable', has(spread) ? ('spread $' + num(spread) + (has(spreadAvg) ? ' vs avg $' + num(spreadAvg) : ' · 20d average unavailable')) : 'no quote');
    var dxy = g.dxyRead(inp), dxyRows = g.normRows(inp.dxyRows || (inp.macro && inp.macro.dxyRows));
    var dxy4h = 'unavailable';
    if (dxyRows.length >= 30){
      /* EMA20 slope over the last 3 bars, relative to price so the read is scale-free (index points or any proxy) */
      var de = g.emaSeries(g.closes(dxyRows), 20), dn = de.length, dsRel = de[dn - 1] > 0 ? (de[dn - 1] - de[dn - 4]) / de[dn - 1] : NaN;
      dxy4h = !isFinite(dsRel) ? 'unavailable' : dsRel > 0.0005 ? 'UP' : dsRel < -0.0005 ? 'DOWN' : 'FLAT';
    }
    L('DXY 24h / 4H trend', dxy.state, dxy.dir + (has(dxy.chgPct) ? ' ' + num(dxy.chgPct) + '% 24h' : '') + ' · 4H ' + dxy4h);
    var ry = Array.isArray(inp.realYield5d) ? inp.realYield5d.map(fin).filter(isFinite) : [];
    var ryTrend = ry.length >= 3 ? (ry[ry.length - 1] < ry[0] - 0.02 ? 'FALLING' : ry[ry.length - 1] > ry[0] + 0.02 ? 'RISING' : 'FLAT') : 'unavailable';
    L('10Y real yield (TIPS) 5 sessions', ry.length >= 3 ? 'live' : 'unavailable', ryTrend + (ry.length ? ' (' + ry.map(function(v){ return v.toFixed(2); }).join(' → ') + ')' : ''));
    L('2Y yield Δ', has(inp.twoYDelta) ? 'live' : 'unavailable', has(inp.twoYDelta) ? num(inp.twoYDelta, 3) : '');
    L('FedWatch implied path Δ today', has(inp.fedwatchDelta) ? 'live' : 'unavailable', has(inp.fedwatchDelta) ? num(inp.fedwatchDelta, 2) + ' cuts' : '');
    var cvd = Array.isArray(inp.cvd15m) ? inp.cvd15m : null;
    L('CVD (' + (inp.cvdSource || 'none') + ')', cvd ? 'live' : 'unavailable', cvd ? cvd.length + ' × 15m deltas' : 'no taker delta / footprint / BVC supplied');
    var dr = g.dealingRange(rows4h), vp4h = dr ? g.volProfile(dr.rows, g.ROW_USD) : g.volProfile(rows4h.slice(-60), g.ROW_USD);
    var prevSess = null, pocs = g.sessionPocs(rows1h, 3);
    if (rows1h.length){
      var todayK = g.dayKey(rows1h[rows1h.length - 1].t), prevRows = rows1h.filter(function(r){ return g.dayKey(r.t) === todayK - 1; });
      if (prevRows.length >= 4) prevSess = g.volProfile(prevRows, g.ROW_USD);
    }
    var composite = g.volProfile(rows1h.slice(-400), g.ROW_USD);
    L('Volume profile (prev session · 4H range · composite)', vp4h ? 'live' : 'unavailable', (prevSess ? 'prev VPOC ' + px(prevSess.pocPrice) + ' VAH ' + px(prevSess.vah) + ' VAL ' + px(prevSess.val) : 'prev session unavailable') + (vp4h ? ' · 4H POC ' + px(vp4h.pocPrice) : '') + (composite ? ' · composite (' + Math.min(400, rows1h.length) + '×1H ≈ ' + Math.round(Math.min(400, rows1h.length) / 23) + ' sessions) POC ' + px(composite.pocPrice) : ''));
    var naked = null;
    if (pocs.length >= 2){ var pp = pocs[pocs.length - 2], touched = false, ti; for (ti = rows1h.length - 1; ti >= 0; ti--){ if (new Date(rows1h[ti].t * 1000).toISOString().slice(0, 10) === pp.day) break; if (rows1h[ti].l <= pp.poc && rows1h[ti].h >= pp.poc){ touched = true; break; } } if (!touched) naked = { level: pp.poc, day: pp.day }; }
    L('naked POCs', naked ? 'live' : 'live', naked ? (px(naked.level) + ' (' + naked.day + ')') : 'none untested');
    var vw = sessionVwap(rows1h, 22);
    var wkOpen = anchoredVwap(rows1h, rows1h.length ? (function(){ var last = rows1h[rows1h.length - 1].t; var dow = (new Date(last * 1000).getUTCDay() + 6) % 7; return (g.dayKey(last) - dow) * 86400; })() : 0);
    L('session VWAP (22:00 UTC) ±σ · anchored VWAPs', has(vw.vwap) ? 'live' : 'unavailable', has(vw.vwap) ? ('VWAP ' + px(vw.vwap) + ' ±1σ ' + px(vw.vwap - vw.sd) + '/' + px(vw.vwap + vw.sd) + ' ±2σ ' + px(vw.vwap - 2 * vw.sd) + '/' + px(vw.vwap + 2 * vw.sd) + ' · weekly-open AVWAP ' + px(wkOpen)) : '');
    var atr1h = g.atrN(rows1h, 14), atr4h = g.atrN(rows4h, 14), atr100 = g.atrN(rows1h, 100), atr50_4h = g.atrN(rows4h, 50);
    var atrRatio = has(atr50_4h) && atr50_4h > 0 ? atr4h / atr50_4h : NaN, atrRegime = !has(atrRatio) ? 'unavailable' : atrRatio < 0.8 ? 'compressed' : atrRatio > 1.25 ? 'expanded' : 'normal';
    L('ATR 1H/4H · ATR(100) 1H · ATR14/50 regime', has(atr1h) ? 'live' : 'unavailable', 'ATR1H ' + num(atr1h) + ' · ATR4H ' + num(atr4h) + ' · ATR100 ' + num(atr100) + ' · regime ' + atrRegime + ' (' + num(atrRatio) + ')');
    var adr = g.adr10(rows1h);
    L('ADR(10) + % used', has(adr.used) ? 'live' : 'unavailable', 'ADR ' + num(adr.adr) + ' · used ' + num(adr.used, 0) + '%');
    var rsi4h = g.rsi14(rows4h), st1h = g.structure1h(rows1h);
    L('RSI(14) 4H + 1H swing sequence', has(rsi4h) ? 'live' : 'unavailable', num(rsi4h, 1) + ' · 1H ' + (st1h.higherLows ? 'higher lows' : st1h.lowerHighs ? 'lower highs' : 'no clean sequence'));
    var e20 = g.emaSeries(g.closes(rows4h), 20), e50 = g.emaSeries(g.closes(rows4h), 50), n4 = rows4h.length;
    var s20 = n4 > 4 ? e20[n4 - 1] - e20[n4 - 4] : NaN, s50 = n4 > 4 ? e50[n4 - 1] - e50[n4 - 4] : NaN, tol = has(atr4h) ? 0.1 * atr4h : 0.5;
    var emaSlope = !has(s20) ? 'unavailable' : (s20 > tol && s50 > 0) ? 'UP' : (s20 < -tol && s50 < 0) ? 'DOWN' : 'FLAT';
    var kers = kerSeries(rows4h), ker = kers.length ? kers[kers.length - 1] : NaN, regime = regimeOf(ker);
    var kerCrossed = false, ki; for (ki = Math.max(1, kers.length - 4); ki < kers.length; ki++){ if (regimeOf(kers[ki]) !== regimeOf(kers[ki - 1])) kerCrossed = true; }
    L('EMA 20/50 4H slope · KER(20) 4H', has(ker) ? 'live' : 'unavailable', emaSlope + ' · KER ' + num(ker) + ' ' + regime + (kerCrossed ? ' (crossed a threshold in last 4 × 4H)' : ''));
    var gvz = fin(inp.gvz != null ? inp.gvz : (inp.macro && inp.macro.gvz)), lastPx = rows1h.length ? rows1h[rows1h.length - 1].c : NaN;
    var implied = has(gvz) && has(lastPx) ? lastPx * gvz / 100 / Math.sqrt(252) : NaN, rv20 = has(inp.rv20) ? +inp.rv20 : realizedVol20(rows4h);
    L('GVZ · implied daily move · RV20', has(gvz) ? 'live' : 'unavailable', (has(gvz) ? 'GVZ ' + num(gvz, 1) + ' → σ $' + num(implied) : 'GVZ unavailable') + ' · RV20 ' + num(rv20, 1) + (has(inp.rv20) ? '' : ' (from 4H closes)'));
    var cot = fin(inp.cotPct != null ? inp.cotPct : (inp.macro && inp.macro.cotMmPct));
    L('COT managed-money 52w percentile', has(cot) ? 'live' : 'unavailable', has(cot) ? num(cot, 0) : '');
    var fund = g.fundingRead(inp), oi = g.oiRead(inp);
    L('funding · OI Δ (perp)', fund.state, (has(fund.value) ? num(fund.value, 4) + '% ' + fund.src : 'unavailable') + ' · OI 24h ' + (has(oi.chgPct) ? num(oi.chgPct, 1) + '%' : 'unavailable'));
    var walls = Array.isArray(inp.ogWalls) ? inp.ogWalls.filter(function(w){ return w && has(w.level); }) : [];
    L('options walls (OG weekly)', walls.length ? 'live' : 'unavailable', walls.length ? walls.map(function(w){ return (w.type || 'wall') + ' ' + px(w.level); }).join(', ') : '');
    var wk = inp.weekly || {};
    var wkReads = [['Shanghai premium', wk.shanghai], ['Indian premium', wk.india], ['COMEX registered', wk.comexReg], ['official-sector regime', wk.cbRegime], ['GLD flow 5d', wk.gldFlow], ['gold/silver ratio', wk.gsRatioDir]];
    var wkAvail = wkReads.filter(function(r){ return r[1] != null && r[1] !== ''; });
    L('weekly physical / positioning reads', wkAvail.length ? (wkAvail.length === wkReads.length ? 'live' : 'partial') : 'unavailable', wkAvail.map(function(r){ return r[0] + ' ' + up(r[1]); }).join(' · ') || 'none supplied');
    L('XAG session H/L · GDX 5d RS', (inp.xag || has(inp.gdxRs)) ? 'live' : 'unavailable', (inp.xag ? 'XAG ' + up(inp.xag) : '') + (has(inp.gdxRs) ? ' · GDX RS ' + num(inp.gdxRs, 2) : ''));
    var ml = inp.ml && inp.ml.dir ? { dir: String(inp.ml.dir).toLowerCase(), age: fin(inp.ml.barAge), name: inp.ml.name || 'Lorentzian Classification' } : null;
    L('ML signal', ml ? 'live' : 'unavailable', ml ? (ml.name + ' ' + up(ml.dir) + ' · age ' + num(ml.age, 0) + ' × 15m') : '');
    var news = g.newsRead(inp.news, nowMs);
    L('economic calendar (tiers)', news.available ? 'live' : 'unavailable', news.next ? ('next ' + news.next + ' T' + news.nextTier + ' ' + g.istUtc(news.nextMs)) : (news.available ? 'no Tier 1/2 ahead' : ''));
    var hist = inp.hourHist && typeof inp.hourHist === 'object' ? inp.hourHist : null;
    L('hour-of-day H/L histogram', hist ? 'live' : 'unavailable', hist ? 'supplied' : '');
    var tr = inp.trader || {};
    var reviewOnly = !!(tr.reviewOnly || tr.OVR === 'REVIEW_ONLY' || tr.LOAD === 'REVIEW_ONLY');
    var reduced = !!(tr.reduced || ['PDI', 'LAT', 'RVG', 'LOAD', 'OVR'].some(function(k){ return up(tr[k]) === 'REDUCED' || up(tr[k]) === 'AMBER'; }));
    var traderState = reviewOnly ? 'REVIEW_ONLY' : reduced ? 'REDUCED' : (Object.keys(tr).length ? 'FULL' : 'FULL (flags unavailable)');
    L('trader-state flags', Object.keys(tr).length ? 'live' : 'unavailable', traderState);
    var stopsToday = fin(inp.stopsToday), weeklyLoss = fin(inp.weeklyLossPct);
    L('stops taken today · weekly P&L', has(stopsToday) ? 'live' : 'unavailable', (has(stopsToday) ? stopsToday + ' stops' : 'stops unavailable') + (has(weeklyLoss) ? ' · week ' + num(weeklyLoss, 1) + '%' : ''));

    /* hard data requirement */
    if (rows1h.length < 60 || rows1hAll.length < 60){
      out.why = rows1hAll.length < 60 ? ('need ≥ 60 closed 1H bars (have ' + rows1hAll.length + ')') : ('need ≥ 60 closed ' + TF_LABEL + ' bars for the ' + horizon + ' horizon (have ' + rows1h.length + ')');
      out.sections.s0 = { load: load, veto: null };
      out.summary = ['XAUUSD ' + feed + ' | ' + out.nowIst + ' | DATA_UNAVAILABLE — ' + out.why, out.disclaimer];
      return out;
    }

    /* ---------------- SECTION 0 — veto stack ---------------- */
    var session = g.goldSession(nowMs);
    var ctx = { rows1h: rows1h, rows15: rows15, rows4h: rows4h, atr1h: atr1h, atr4h: atr4h, session: session, news: news, stopsToday: stopsToday,
                feedOk: true, feedWhy: feed + ' · last closed ' + TF_LABEL + ' ' + g.fmtHM(lastExecCloseMs, 'UTC') + ' UTC', tf: TF, tfLabel: TF_LABEL, ctxLabel: CTX_LABEL, horizon: horizon, lastPx: lastPx, vp4h: vp4h, dr: dr, prevSess: prevSess, composite: composite,
                naked: naked, vw: vw, atrRegime: atrRegime, adr: adr, rsi4h: rsi4h, st1h: st1h, emaSlope: emaSlope, ker: ker, regime: regime, kerCrossed: kerCrossed,
                dxy: dxy, dxy4h: dxy4h, ryTrend: ryTrend, cot: cot, fund: fund, oi: oi, walls: walls, wk: wk, wkAvail: wkAvail, ml: ml, gvz: gvz, implied: implied, rv20: rv20,
                cvd: cvd, hist: hist, spread: spread, spreadAvg: spreadAvg, rvol: rvolThisHour(rows1h), illiq: fin(inp.illiqPct), dom: inp.dom || null,
                pocs: pocs, pocStep: g.pocStep(pocs), asia: g.asiaRange(rows1h, nowMs), pd: g.priorDay(rows1h), pw: g.priorWeek(rows1h), eq: g.equalExtremes(rows1h, g.EQ_TOL_USD),
                obs: g.freshObs(rows1h, atr1h), monday: mondayRange(rows1h), equity: fin(inp.equity), baseRiskPct: has(inp.baseRiskPct) ? +inp.baseRiskPct : 1, tape: null,
                traderState: traderState, isPerp: /XAUT|perp/i.test(venue) || /delta-xaut/.test(feed), venue: venue, basisPct: basisPct,
                nakedPoc: naked, corr60: fin(inp.corr60), dd95: fin(inp.dd95), gcRoll: fin(inp.gcRollCoverage), maintMarginPct: fin(inp.maintMarginPct) };
    var tapeIn = up(inp.tape || inp.deskTape); if (tapeIn === 'UP' || tapeIn === 'LONG') ctx.tape = 'long'; if (tapeIn === 'DOWN' || tapeIn === 'SHORT') ctx.tape = 'short';
    var dn20 = rows1h.slice(-21, -1), dh = -Infinity, dl = Infinity, di; for (di = 0; di < dn20.length; di++){ dh = Math.max(dh, dn20[di].h); dl = Math.min(dl, dn20[di].l); }
    ctx.donchian = dn20.length >= 20 ? { hi: dh, lo: dl } : null;
    ctx.atVaEdge = !!(vp4h && (Math.abs(lastPx - vp4h.vah) <= 0.35 * atr1h || Math.abs(lastPx - vp4h.val) <= 0.35 * atr1h));
    ctx.weekVaPos = composite ? (lastPx > composite.vah ? 'ABOVE' : lastPx < composite.val ? 'BELOW' : 'INSIDE') : 'unavailable';
    ctx.rsiVeto = { longVeto: has(rsi4h) && rsi4h > 70 && st1h.lowerHighs, shortVeto: has(rsi4h) && rsi4h < 30 && st1h.higherLows };
    var vetoes = [];
    function V(n, name, hit, note, unavailable){ vetoes.push({ n: n, name: name, state: hit ? 'VETO' : (unavailable ? 'unavailable' : 'PASS'), note: note || '' }); }
    var t1Near = news.available && has(news.nextMs) && news.nextTier === 1 && Math.abs(news.nextMs - nowMs) <= 30 * 60000;
    var t2Near = news.available && has(news.nextMs) && news.nextTier === 2 && Math.abs(news.nextMs - nowMs) <= 15 * 60000;
    V(1, 'Tier-1 ±30m / Tier-2 ±15m release', news.lock || t1Near || t2Near, news.lock ? news.lockWhy : (news.available ? (news.next ? 'next ' + news.next + ' ' + g.istUtc(news.nextMs) : 'none ahead') : 'calendar unavailable — check manually'), !news.available);
    V(2, 'live spread > 2× 20d hour average', has(spread) && has(spreadAvg) && spread > 2 * spreadAvg, has(spread) && has(spreadAvg) ? ('$' + num(spread) + ' vs 2× $' + num(2 * spreadAvg)) : 'spread average unavailable', !(has(spread) && has(spreadAvg)));
    var stale = nowMs - lastCloseMs > 2 * 3600000 + 5 * 60000;
    var basisDev = has(basisUsd) && has(basisMean5d) ? Math.abs(basisUsd - basisMean5d) : NaN;
    var gapMax = 0, gi; for (gi = Math.max(1, rows1h.length - 400); gi < rows1h.length; gi++) gapMax = Math.max(gapMax, rows1h[gi].t - rows1h[gi - 1].t);
    var missingSession = gapMax > 3 * 86400;
    V(3, 'feed stale / missing session / basis > $3 from 5d mean', stale || missingSession || (has(basisDev) && basisDev > 3), stale ? ('last closed 1H ' + g.istUtcDay(lastCloseMs) + ' is ' + num((nowMs - lastCloseMs) / 3600000, 1) + 'h old') : missingSession ? (num(gapMax / 86400, 1) + '-day hole') : ('last closed 1H ' + g.istUtc(lastCloseMs) + (has(basisUsd) ? ' · basis $' + num(basisUsd) : ' · basis unavailable') + (has(basisDev) ? ' · dev $' + num(basisDev) : ' (5d mean unavailable)')));
    if (stale || missingSession || (has(basisDev) && basisDev > 3)) ctx.feedOk = false;
    /* RSI veto judged per hypothesis later; recorded here as the status */
    V(4, 'RSI exhaustion (per hypothesis)', false, ctx.rsiVeto.longVeto ? 'LONG veto active (4H RSI ' + num(rsi4h, 1) + ' > 70, 1H lower highs)' : ctx.rsiVeto.shortVeto ? 'SHORT veto active (4H RSI ' + num(rsi4h, 1) + ' < 30, 1H higher lows)' : ('none · 4H RSI ' + num(rsi4h, 1)));
    V(5, 'two stops today / weekly −4%', stopsToday >= 2 || weeklyLoss <= -4, (has(stopsToday) ? stopsToday + ' stops' : 'stops unavailable') + (has(weeklyLoss) ? ' · week ' + num(weeklyLoss, 1) + '%' : ' · weekly P&L unavailable'), !has(stopsToday));
    V(6, 'continuation with ADR used > 120% (per class)', false, 'ADR used ' + num(adr.used, 0) + '%' + (adr.used > 120 ? ' — continuation class vetoed' : ''));
    V(7, 'KER regime disables the class (per class)', false, regime + ' · KER ' + num(ker));
    V(8, 'FedWatch path moved ≥ 0.5 cuts today', has(inp.fedwatchDelta) && Math.abs(+inp.fedwatchDelta) >= 0.5, has(inp.fedwatchDelta) ? num(inp.fedwatchDelta, 2) + ' cuts' : 'FedWatch unavailable', !has(inp.fedwatchDelta));
    var fundingNear = false, fundNote = 'not a perp venue';
    if (ctx.isPerp){
      var istH = g.tzHour(nowMs, 'Asia/Kolkata'), stamps = [5.5, 13.5, 21.5], fi;
      for (fi = 0; fi < stamps.length; fi++){ var dmin = (stamps[fi] - istH) * 60; if (dmin > 0 && dmin <= 20) fundingNear = true; }
      fundNote = fundingNear ? 'inside 20 min before a funding timestamp (05:30 / 13:30 / 21:30 IST)' + (has(fund.value) ? ' · funding ' + num(fund.value, 4) + '%' : '') : 'next funding stamp not within 20 min';
    }
    V(9, 'perp: 20 min before funding on the paying side', fundingNear, fundNote, ctx.isPerp && !has(fund.value));
    V(10, 'trader-state REVIEW_ONLY', reviewOnly, traderState, !Object.keys(tr).length);
    var active = vetoes.filter(function(v){ return v.state === 'VETO'; });
    var s0 = { load: load, veto: vetoes, active: active, clear: !active.length, passed: vetoes.filter(function(v){ return v.state !== 'VETO'; }).length };
    out.sections.s0 = s0;
    out.ok = true; out.status = 'OK';
    if (active.length){
      out.sections.s1 = null; out.sections.s2 = null; out.sections.s3 = { decision: 'NO TRADE', score: 0, why: 'VETO ACTIVE: ' + active.map(function(v){ return v.name; }).join(' · ') };
      out.summary = summaryBlock(out, ctx, null);
      return out;
    }

    /* ---------------- SECTION 1 — regime + permission ---------------- */
    var classes = enabledClasses(regime);
    var asiaVsAtr = ctx.asia && has(atr4h) ? (ctx.asia.hi - ctx.asia.lo) / atr4h : NaN;
    var vaPos = composite ? (lastPx > composite.vah ? 'ABOVE' : lastPx < composite.val ? 'BELOW' : 'INSIDE') : 'unavailable';
    var dayType = 'transition';
    if ((ctx.pocStep === 'UP' || ctx.pocStep === 'DOWN') && vaPos !== 'INSIDE' && vaPos !== 'unavailable') dayType = 'trend';
    else if (vaPos === 'INSIDE' && has(asiaVsAtr) && asiaVsAtr < 0.5) dayType = 'balanced-compressed';
    else if (vaPos === 'INSIDE') dayType = 'balanced-normal';
    /* 4H bias */
    var vaPos4 = vp4h ? (lastPx > vp4h.vah ? 'ABOVE VA' : lastPx < vp4h.val ? 'BELOW VA' : 'INSIDE VA') : 'unavailable';
    var bias = { bias: 'BOTH', transition: false, why: [] }, mig = ctx.pocStep, ema = emaSlope;
    if ((mig === 'UP' && ema === 'DOWN') || (mig === 'DOWN' && ema === 'UP')){ bias.bias = 'NO TRADE'; bias.transition = true; bias.why.push('EMA ' + ema + ' vs POC migration ' + mig + ' — TRANSITION → WAIT'); }
    else if (vaPos4 === 'ABOVE VA' && ema !== 'DOWN' && mig !== 'DOWN'){ bias.bias = 'LONG'; bias.why.push('price above 4H VAH · POC ' + mig + ' · EMA ' + ema); }
    else if (vaPos4 === 'BELOW VA' && ema !== 'UP' && mig !== 'UP'){ bias.bias = 'SHORT'; bias.why.push('price below 4H VAL · POC ' + mig + ' · EMA ' + ema); }
    else if (mig === 'UP' && ema === 'UP'){ bias.bias = 'LONG'; bias.why.push('POC UP + EMA UP inside value — buy discount'); }
    else if (mig === 'DOWN' && ema === 'DOWN'){ bias.bias = 'SHORT'; bias.why.push('POC DOWN + EMA DOWN inside value — sell premium'); }
    else bias.why.push('balanced — POC ' + mig + ' · EMA ' + ema + ' · VA edges only');
    bias.why.push('dealing range ' + (dr ? dr.half + ' half (' + num(dr.pct * 100, 0) + '% of ' + px(dr.lo) + '–' + px(dr.hi) + ')' : 'unavailable'));
    ctx.bias = bias;
    /* weekly permission S28 */
    var wkLong = 0, wkShort = 0;
    wkReads.forEach(function(r){ var v = up(r[1]); if (!v) return; if (/POS|\+|UP|RISING|SUPPORT|BUY|INFLOW|DOVISH/.test(v)) wkLong++; else if (/NEG|-|DOWN|FALLING|DRAIN|SELL|OUTFLOW|HAWKISH/.test(v)) wkShort++; });
    if (has(cot)){ if (cot < 50) wkLong++; else if (cot > 90) wkShort++; }
    if (has(inp.fedwatchWeekly)){ if (+inp.fedwatchWeekly > 0) wkLong++; else if (+inp.fedwatchWeekly < 0) wkShort++; }
    var weekly = !wkAvail.length && !has(cot) ? { state: 'unavailable', perm: 'none (weekly reads not supplied — bias alone governs)', restrict: false }
      : (wkLong >= 3 && wkShort === 0) ? { state: 'live', perm: 'LONG-full', restrict: true, dir: 'long' }
      : (wkShort >= 3 && wkLong === 0) ? { state: 'live', perm: 'SHORT-full', restrict: true, dir: 'short' }
      : { state: 'live', perm: 'none (' + wkLong + ' long · ' + wkShort + ' short reads)', restrict: false };
    if (has(inp.macroResidZ)) weekly.perm += ' · macro-residual z ' + num(inp.macroResidZ, 2) + ' (S51)';
    var permitted = bias.bias === 'LONG' ? ['long'] : bias.bias === 'SHORT' ? ['short'] : bias.bias === 'BOTH' ? ['long', 'short'] : [];
    if (weekly.restrict) permitted = permitted.filter(function(d){ return d === weekly.dir; });
    var held = [];
    if (ctx.tape){ permitted.forEach(function(d){ if (d !== ctx.tape) held.push(d); }); permitted = permitted.filter(function(d){ return d === ctx.tape; }); }
    var s1 = { regime: regime, ker: ker, kerCrossed: kerCrossed, classes: classes, dayType: dayType, dayWhy: 'price ' + vaPos + ' composite VA · Asia range ' + (has(asiaVsAtr) ? num(asiaVsAtr) + '× ATR4H' : 'unavailable') + ' · POC ' + ctx.pocStep,
               bias: bias, weekly: weekly, traderState: traderState, permitted: permitted, held: held,
               rsiVeto: ctx.rsiVeto.longVeto ? 'LONG veto active' : ctx.rsiVeto.shortVeto ? 'SHORT veto active' : 'none' };
    out.sections.s1 = s1;
    if (!permitted.length){
      s1.noPermitted = true;
      out.sections.s2 = null;
      out.sections.s3 = { decision: 'NO PERMITTED DIRECTION', score: 0, why: bias.bias === 'NO TRADE' ? bias.why[0] : (held.length ? 'bias side is against the desk gold tape — HELD' : 'weekly permission ' + weekly.perm) };
      out.sections.s8 = { state: 'WAIT', reason: 'no permitted direction — ' + out.sections.s3.why, nextRescan: nextRescan(nowMs) };
      out.summary = summaryBlock(out, ctx, null);
      return out;
    }

    /* ---------------- candidates (location for the matrix) ---------------- */
    var pools = g.pools(ctx);
    if (ctx.monday){ pools.push({ kind: 'Monday low', level: ctx.monday.lo, side: 'low', sid: 'S7' }); pools.push({ kind: 'Monday high', level: ctx.monday.hi, side: 'high', sid: 'S7' }); }
    if (prevSess){ pools.push({ kind: 'prev VAL', level: prevSess.val, side: 'low', sid: 'S17' }); pools.push({ kind: 'prev VAH', level: prevSess.vah, side: 'high', sid: 'S17' }); }
    var sweeps = [], si;
    for (si = 0; si < pools.length; si++){ var sr = g.sweepRead(rows1h, pools[si], atr1h); if (sr) sweeps.push(sr); }
    ctx.acceptance = sweeps.some(function(s){ return s.acceptance; });
    var cands = [];
    for (si = 0; si < sweeps.length; si++){
      var sw = sweeps[si];
      if (sw.acceptance){
        var cdir = sw.dir === 'long' ? 'short' : 'long';
        if (permitted.indexOf(cdir) >= 0) cands.push(buildCand(ctx, { sid: 'S37', dir: cdir, level: sw.pool.level, kind: sw.pool.kind + ' acceptance', wick: cdir === 'short' ? rows1h[rows1h.length - 1].h : rows1h[rows1h.length - 1].l, age: sw.age, reclaimed: true, acceptance: true, breach: sw.breach, cls: 'sweep', second: true }));
        continue;
      }
      if (permitted.indexOf(sw.dir) < 0) continue;
      var sid = sw.pool.sid === 'S19' ? (ctx.pocStep === 'FLAT' ? 'S19' : 'S0') : sw.pool.sid;
      cands.push(buildCand(ctx, { sid: sid, dir: sw.dir, level: sw.pool.level, kind: sw.pool.kind, wick: sw.wick, age: sw.age, reclaimed: sw.reclaimed, breach: sw.breach, cls: CLASS_OF[sid] || 'sweep' }));
    }
    /* continuation candidate in TREND: pullback to the session POC in bias direction */
    if (regime === 'TREND' && vp4h && permitted.length === 1){
      var pdir = permitted[0], poc = vp4h.pocPrice, last = rows1h[rows1h.length - 1];
      var touched = Math.abs(last.l - poc) <= 0.35 * atr1h || Math.abs(last.h - poc) <= 0.35 * atr1h || (last.l <= poc && last.h >= poc);
      var closedRight = pdir === 'long' ? last.c > poc : last.c < poc;
      if (touched && closedRight) cands.push(buildCand(ctx, { sid: 'S3', dir: pdir, level: poc, kind: '4H POC pullback', wick: pdir === 'long' ? last.l : last.h, age: 0, reclaimed: true, breach: NaN, cls: 'continuation', entry: pdir === 'long' ? poc + Math.max(1, 0.1 * atr1h) : poc - Math.max(1, 0.1 * atr1h) }));
    }
    /* ---------------- SECTION 2 — score every candidate, then each permitted direction ---------------- */
    var ci;
    for (ci = 0; ci < cands.length; ci++){
      cands[ci].matrix = scoreMatrix(ctx, cands[ci].dir, cands[ci], cands);
      cands[ci].verdict = decide(ctx, cands[ci].matrix);
    }
    cands.sort(function(a, b){ return (b.matrix.score - a.matrix.score) || (b.gates.pass - a.gates.pass) || (g.gradeRank(b.grade) - g.gradeRank(a.grade)) || ((b.rr1 || 0) - (a.rr1 || 0)); });
    for (ci = 0; ci < cands.length; ci++) cands[ci].rank = ci + 1;
    var scored = permitted.map(function(d){
      var cs = cands.filter(function(c){ return c.dir === d; });
      return cs.length ? cs[0].matrix : scoreMatrix(ctx, d, null, []);
    });
    scored.sort(function(a, b){ return b.score - a.score; });
    var best = scored[0];
    out.sections.s2 = { scored: scored, best: best };
    out.candidates = cands;

    /* ---------------- SECTION 3 — decision ---------------- */
    var s3 = decide(ctx, best);
    out.sections.s3 = s3;

    /* ---------------- SECTION 4 — strategy selector ---------------- */
    out.sections.s4 = s3.qualifies && best.cand ? selectStrategy(ctx, best, scored) : { primary: null, why: 'no qualifying setup' };
    if (out.sections.s4.wait){ s3.qualifies = false; s3.decision = 'WAIT'; s3.why += ' · ' + out.sections.s4.why; }

    /* ---------------- SECTION 5 / 6 / 7 ---------------- */
    if (s3.qualifies && best.cand){
      out.sections.s5 = levels(ctx, best, s3, out.sections.s4);
      out.sections.s6 = sizing(ctx, best, s3, out.sections.s5);
      out.sections.s7 = gateTable(ctx, best, s3);
      if (out.sections.s7.conflict){ s3.qualifies = false; s3.decision = 'NO SETUP'; s3.why += ' · MATRIX/GATE CONFLICT → NO SETUP (' + out.sections.s7.conflictGate + ')'; }
    } else { out.sections.s5 = null; out.sections.s6 = null; out.sections.s7 = best && best.cand ? gateTable(ctx, best, s3) : null; }

    /* ---------------- SECTION 8 ---------------- */
    out.sections.s8 = trigger(ctx, best, s3, out.sections.s5, out.sections.s6, out.sections.s7, out.sections.s4);
    out.summary = summaryBlock(out, ctx, best);
    return out;
  }

  /* ---------------- candidate + gates ---------------- */
  function buildCand(ctx, src){
    var g = G7(), atr = ctx.atr1h, dir = src.dir;
    var buf = Math.max(g.STOP_BUF_MIN_USD, 0.25 * atr);
    if (ctx.atrRegime === 'expanded') buf = 0.35 * atr;
    var bufNote = 'max($2, 0.25 × ATR1H)' + (ctx.atrRegime === 'expanded' ? ' → 0.35 × ATR (expanded)' : '');
    var crowded = has(ctx.cot) && ((dir === 'long' && ctx.cot >= 90) || (dir === 'short' && ctx.cot <= 10));
    if (crowded){ buf *= 1.5; bufNote += ' · +50% COT crowded against'; }
    var entryOff = Math.max(g.STOP_BUF_MIN_USD, 0.1 * atr);
    var entry = has(src.entry) ? +src.entry : (dir === 'long' ? src.level + entryOff : src.level - entryOff);
    var wick = has(src.wick) ? +src.wick : src.level;
    var stop = dir === 'long' ? wick - buf : wick + buf;
    var risk = Math.abs(entry - stop);
    var tg = g.targets(ctx, entry, dir);
    var t1 = tg.t1 ? tg.t1.level : NaN, t2 = tg.t2 ? tg.t2.level : NaN;
    var rr1 = risk > 0 && has(t1) ? Math.abs(t1 - entry) / risk : NaN, rr2 = risk > 0 && has(t2) ? Math.abs(t2 - entry) / risk : NaN;
    var ob = dir === 'long' ? ctx.obs.bull : ctx.obs.bear;
    var obOk = !!(ob && entry >= ob.lo - atr * 0.1 && entry <= ob.hi + atr * 0.1);
    var loc = g.locationGrade(ctx, entry, dir, obOk, true);
    var c = { sid: src.sid, name: NAME_OF[src.sid] || src.sid, cls: src.cls, dir: dir, level: src.level, kind: src.kind, entry: entry, stop: stop, wick: wick, risk: risk, buf: buf, bufNote: bufNote,
              t1: t1, t2: t2, t1Label: tg.t1 ? tg.t1.label : 'unavailable', t2Label: tg.t2 ? tg.t2.label : 'unavailable', rr1: rr1, rr2: rr2,
              grade: loc.grade, gradeWhy: loc.why, obOk: obOk, ob: ob, age: has(src.age) ? +src.age : NaN, reclaimed: !!src.reclaimed, acceptance: !!src.acceptance,
              breach: fin(src.breach), second: !!src.second, lvnPath: g.lvnBetween(entry, t1, ctx.vp4h), crowded: crowded };
    c.gates = coreGates(ctx, c);
    return c;
  }

  /* ---------------- SECTION 2 matrix ---------------- */
  function scoreMatrix(ctx, dir, c, all){
    var g = G7(), rows = [], score = 0, fams = {}, last1h = ctx.rows1h[ctx.rows1h.length - 1];
    function add(block, pts, name, family, ok, evidence, unavailable){
      var got = ok ? pts : 0;
      rows.push({ block: block, pts: pts, got: got, name: name, family: family, evidence: evidence || '', unavailable: !!unavailable });
      if (got){ score += got; fams[family] = (fams[family] || 0) + got; }
    }
    var isSweepClass = !c || c.cls === 'sweep' || c.cls === 'composite';
    var isFade = c && c.cls === 'fade', isCont = c && (c.cls === 'continuation' || c.cls === 'breakout');
    /* A1 macro */
    var macroOk = dir === 'long' ? (ctx.dxy4h === 'DOWN' && ctx.ryTrend === 'FALLING') : (ctx.dxy4h === 'UP' && ctx.ryTrend === 'RISING');
    var macroEv = 'DXY 4H ' + ctx.dxy4h + ' · 10Y real yield ' + ctx.ryTrend;
    if (has(ctx.corr60) && ctx.corr60 > -0.3) macroEv += ' · macro link weak this quarter (60d corr ' + num(ctx.corr60) + ')';
    add('A', 2, 'Intermarket / Macro Driver', 'Macro', macroOk, macroEv, ctx.dxy4h === 'unavailable' || ctx.ryTrend === 'unavailable');
    /* A2 delta */
    var dv = cvdDivergence(ctx.rows15, ctx.cvd, dir);
    add('A', 2, 'Order Flow & Delta Divergence', 'Flow', dv.ok, dv.why, !ctx.cvd);
    /* A3 VPOC / HVN */
    var vpOk = false, vpEv = 'no candidate entry zone';
    if (c){
      var tolZ = 0.35 * ctx.atr1h, node = null;
      if (ctx.prevSess && Math.abs(c.entry - ctx.prevSess.pocPrice) <= tolZ) node = 'previous-session VPOC ' + px(ctx.prevSess.pocPrice);
      var hz = ctx.vp4h ? g.zones(ctx.vp4h.hvnsStrict && ctx.vp4h.hvnsStrict.length ? ctx.vp4h.hvnsStrict : (ctx.vp4h.hvns || []), ctx.vp4h.binSize) : [];
      var zi; for (zi = 0; zi < hz.length && !node; zi++) if (c.entry >= hz[zi].lo - tolZ && c.entry <= hz[zi].hi + tolZ) node = 'HVN ' + px(hz[zi].lo) + '–' + px(hz[zi].hi);
      var inLvn = ctx.vp4h && (ctx.vp4h.lvns || []).some(function(l){ return Math.abs(c.entry - l) <= ctx.vp4h.binSize; });
      var rejection = dir === 'long' ? (last1h.l <= c.level && last1h.c > c.level) : (last1h.h >= c.level && last1h.c < c.level);
      vpOk = !!node && !inLvn && rejection;
      vpEv = node ? (node + (rejection ? ' · rejection wick in zone, body closed ' + (dir === 'long' ? 'above' : 'below') : ' · no rejection close yet') + (inLvn ? ' · entry in LVN → 0' : '')) : ('entry ' + px(c.entry) + ' not at prev VPOC / HVN' + (inLvn ? ' (LVN)' : ''));
    }
    add('A', 2, 'Volume Profile & VPOC/HVN Rejection', 'Volume Profile', vpOk, vpEv);
    /* A4 VWAP / Z */
    var vwOk = false, vwEv = 'session VWAP unavailable';
    if (has(ctx.vw.vwap)){
      var z = zScore20(ctx.rows1h), prev = ctx.rows1h[ctx.rows1h.length - 2];
      var retest = prev && ((dir === 'long' && prev.l <= ctx.vw.vwap + 0.1 * ctx.atr1h && last1h.c > ctx.vw.vwap) || (dir === 'short' && prev.h >= ctx.vw.vwap - 0.1 * ctx.atr1h && last1h.c < ctx.vw.vwap));
      var mr = has(z) && ((dir === 'long' && z <= -2 && last1h.c > ctx.vw.vwap - 2 * ctx.vw.sd) || (dir === 'short' && z >= 2 && last1h.c < ctx.vw.vwap + 2 * ctx.vw.sd));
      vwOk = !!(retest || mr);
      vwEv = 'VWAP ' + px(ctx.vw.vwap) + ' · z20 ' + num(z) + (retest ? ' · retest held' : mr ? ' · 2σ mean-reversion trigger' : ' · no retest / 2σ trigger');
    }
    add('A', 1, 'Statistical Positioning (VWAP / Z)', 'Statistical', vwOk, vwEv, !has(ctx.vw.vwap));
    /* A5 ML */
    var mlOk = !!(ctx.ml && ctx.ml.dir === dir && has(ctx.ml.age) && ctx.ml.age <= 3);
    add('A', 1, 'Algorithmic Momentum (ML)', 'Statistical', mlOk, ctx.ml ? (ctx.ml.name + ' ' + up(ctx.ml.dir) + ' age ' + num(ctx.ml.age, 0)) : 'ML signal unavailable', !ctx.ml);
    /* A6 sweep */
    var swOk = !!(c && has(c.breach) && c.breach >= Math.max(1, 0.25 * ctx.atr1h) && c.obOk && c.reclaimed && c.age <= g.MAX_SWEEP_AGE);
    add('A', 1, 'Structural Liquidity Sweep (SMC)', 'Structure', swOk, c ? (c.kind + ' swept $' + num(c.breach) + (c.obOk ? ' · OB mitigated' : ' · no OB mitigation') + (c.reclaimed ? ' · closed back inside' : ' · not reclaimed') + ' · age ' + c.age) : 'no swept pool');
    /* A7 session */
    var ny = ctx.session.nyHour, lon = ctx.session.lonHour;
    var overlap = ny >= 8 && ny < 11, londonOpen = lon >= 8 && lon < 10.5;
    var sessOk = overlap || (londonOpen && isSweepClass);
    add('A', 1, 'Session Volatility Filter', 'Time', sessOk, ctx.session.label + (overlap ? ' · London/NY overlap 08:00–11:00 NY' : londonOpen ? (isSweepClass ? ' · London open window (sweep strategy)' : ' · London open — sweep strategies only') : ' · outside qualifying windows'));
    /* B1 trend & location */
    var b1 = false, b1Ev = 'no candidate';
    if (c){
      var biasAgree = ctx.bias.bias === up(dir) && !ctx.bias.transition;
      var halfOk = ctx.dr && ((dir === 'long' && c.entry < ctx.dr.eq - 0.15 * (ctx.dr.hi - ctx.dr.lo)) || (dir === 'short' && c.entry > ctx.dr.eq + 0.15 * (ctx.dr.hi - ctx.dr.lo)));
      b1 = biasAgree && !!halfOk;
      b1Ev = 'bias ' + ctx.bias.bias + (biasAgree ? ' agrees' : ' does not agree') + ' · entry ' + (ctx.dr ? ((dir === 'long' ? 'discount' : 'premium') + ' half ' + (halfOk ? 'OK' : 'not ≥ 0.15 × range from EQ ' + px(ctx.dr.eq))) : 'range unavailable');
    }
    add('B', 2, 'Trend & Location Alignment', 'Trend', b1, b1Ev);
    /* B2 positioning & physical */
    var notCrowdedCot = has(ctx.cot) ? (dir === 'long' ? ctx.cot < 90 : ctx.cot > 10) : null;
    var fundOk = has(ctx.fund.value) ? (dir === 'long' ? ctx.fund.value <= 0.05 : ctx.fund.value >= -0.05) : null;
    var wallInPath = c && has(c.t1) && ctx.walls.some(function(w){ return w.level > Math.min(c.entry, c.t1) && w.level < Math.max(c.entry, c.t1); });
    var iAvail = notCrowdedCot !== null || fundOk !== null;
    var iOk = iAvail && notCrowdedCot !== false && fundOk !== false && !wallInPath;
    var physOk = false, physEv = [];
    (ctx.wkAvail || []).forEach(function(r){ var v = up(r[1]); var supportive = /POS|\+|UP|RISING|SUPPORT|BUY|INFLOW/.test(v); if ((dir === 'long' && supportive) || (dir === 'short' && !supportive && v)) { physOk = true; physEv.push(r[0] + ' ' + v); } });
    var b2pts = iOk && physOk ? 2 : (iOk && !ctx.wkAvail.length ? 1 : 0);
    rows.push({ block: 'B', pts: 2, got: b2pts, name: 'Positioning & Physical', family: 'Positioning', evidence: '(i) ' + (iAvail ? ((notCrowdedCot === null ? 'COT unavailable' : 'COT ' + num(ctx.cot, 0) + (notCrowdedCot ? ' ok' : ' crowded')) + ' · ' + (fundOk === null ? 'funding unavailable' : 'funding ' + num(ctx.fund.value, 4) + '%' + (fundOk ? ' ok' : ' against')) + (wallInPath ? ' · options wall inside path' : '')) : 'COT + funding unavailable') + ' · (ii) ' + (physEv.length ? physEv.join(', ') : (ctx.wkAvail.length ? 'no physical read agrees' : 'weekly reads unavailable → +1 max')), unavailable: !iAvail });
    if (b2pts){ score += b2pts; fams.Positioning = (fams.Positioning || 0) + b2pts; }
    /* B3 volatility */
    var volOk = false, volEv = '';
    if (c){
      var regimeOkV = isFade ? ctx.atrRegime !== 'expanded' : isCont ? ctx.atrRegime !== 'compressed' : true;
      var tpOk = has(ctx.implied) ? Math.abs(c.t1 - c.entry) <= 1.5 * ctx.implied : true;
      var ivrv = has(ctx.gvz) && has(ctx.rv20) ? ctx.gvz - ctx.rv20 : NaN;
      var ivOk = has(ivrv) ? (ivrv >= -3 && ivrv <= 5) : true;
      volOk = regimeOkV && tpOk && ivOk && has(c.t1);
      volEv = 'ATR regime ' + ctx.atrRegime + (regimeOkV ? ' ok' : ' blocks class') + ' · TP1 ' + (has(ctx.implied) ? (Math.abs(c.t1 - c.entry) / ctx.implied).toFixed(2) + '× GVZ σ' : 'GVZ unavailable → ATR only') + ' · implied−realized ' + (has(ivrv) ? num(ivrv, 1) : 'unavailable');
    }
    add('B', 1, 'Volatility & Target Realism', 'Volatility', volOk, volEv || 'no candidate');
    /* B4 composite */
    var compOk = !!(c && (c.sid === 'S19' || c.sid === 'S17' || c.sid === 'S7' || c.sid === 'S15'));
    add('B', 1, 'Composite Structure', 'Structure', compOk, c ? (compOk ? c.sid + ' ' + c.name : 'session-level sweep only (' + c.sid + ')') : 'no candidate');
    /* B5 time statistics */
    var timeOk = false, timeEv = 'hour-of-day histogram unavailable';
    if (ctx.hist){
      var hrIst = Math.floor(g.tzHour(ctx.rows1h[ctx.rows1h.length - 1].t * 1000 + ctx.tf * 1000, 'Asia/Kolkata'));
      var pct = fin(ctx.hist[hrIst] != null ? (dir === 'long' ? (ctx.hist[hrIst].lows != null ? ctx.hist[hrIst].lows : ctx.hist[hrIst]) : (ctx.hist[hrIst].highs != null ? ctx.hist[hrIst].highs : ctx.hist[hrIst])) : NaN);
      timeOk = has(pct) && pct >= 30; timeEv = 'histogram ' + num(pct, 0) + '% of session ' + (dir === 'long' ? 'lows' : 'highs') + ' in the coming window (S29)';
    }
    if (!timeOk){
      var rv = ctx.rvol;
      var openDrive = has(rv) && rv >= 1.3 && (ctx.session.key === 'LONDON_OPEN' || ctx.session.key === 'NY_OPEN') && ((dir === 'long' && last1h.c > last1h.o) || (dir === 'short' && last1h.c < last1h.o));
      if (openDrive){ timeOk = true; timeEv = 'open-drive · RVOL ' + num(rv) + ' ≥ 1.3 in hypothesis direction (S25)'; }
      else if (!ctx.hist) timeEv = 'histogram unavailable · RVOL ' + num(rv) + ' · no IB / open-drive read';
    }
    add('B', 1, 'Time Statistics', 'Time', timeOk, timeEv, !ctx.hist && !has(ctx.rvol));
    /* B6 regime fit */
    var cls = c ? c.cls : 'sweep', en = ctx.regime === 'TREND' ? (cls === 'continuation' || cls === 'breakout' || (cls === 'sweep' && ctx.bias.bias === up(dir))) : ctx.regime === 'CHOP' ? (cls === 'sweep' || cls === 'composite' || cls === 'fade') : true;
    var regOk = en && !ctx.kerCrossed && ctx.regime !== 'unavailable';
    add('B', 1, 'Regime Fit', 'Regime', regOk, ctx.regime + ' enables ' + cls + ': ' + (en ? 'yes' : 'no') + (ctx.kerCrossed ? ' · KER crossed a threshold in last 4 × 4H (transition)' : ''), ctx.regime === 'unavailable');
    /* B7 execution */
    var exOk = false, exEv = '';
    if (c){
      var rvOk = has(ctx.rvol) && ctx.rvol >= 0.7;
      var liqOk = has(ctx.illiq) ? ctx.illiq < 85 : (has(ctx.spread) && has(ctx.spreadAvg) ? ctx.spread <= 1.2 * ctx.spreadAvg : null);
      var fillOk = c.risk > 0 && Math.abs(last1h.c - c.entry) <= 0.1 * c.risk;
      exOk = rvOk && liqOk !== false && fillOk;
      exEv = 'RVOL ' + num(ctx.rvol) + (rvOk ? ' ok' : ' < 0.7') + ' · liquidity ' + (liqOk === null ? 'ILLIQ and spread average unavailable' : liqOk ? 'ok' : 'thin') + ' · fill ' + num(Math.abs(last1h.c - c.entry) / (c.risk || 1)) + 'R from entry' + (fillOk ? ' ok' : ' > 0.1R');
    }
    add('B', 1, 'Execution Quality', 'Execution', exOk, exEv || 'no candidate', !has(ctx.rvol));
    /* B8 clean path */
    var pathOk = false, pathEv = 'no candidate';
    if (c && has(c.t1)){
      var lo = Math.min(c.entry, c.t1), hi = Math.max(c.entry, c.t1), blockers = [];
      if (ctx.vp4h){ (ctx.vp4h.hvnsStrict || ctx.vp4h.hvns || []).forEach(function(h){ if (h > lo + ctx.vp4h.binSize && h < hi - ctx.vp4h.binSize) blockers.push('HVN ' + px(h)); }); }
      ctx.walls.forEach(function(w){ if (w.level > lo && w.level < hi) blockers.push('wall ' + px(w.level)); });
      if (ctx.naked && ctx.naked.level > lo + 0.5 && ctx.naked.level < hi - 0.5) blockers.push('naked POC ' + px(ctx.naked.level));
      pathOk = c.lvnPath && !blockers.length;
      pathEv = (c.lvnPath ? 'LVN between entry and TP1' : 'no LVN in path') + (blockers.length ? ' · blockers: ' + blockers.join(', ') : ' · path clean') + ' · TP1 ' + c.t1Label;
    }
    add('B', 1, 'Clean Path', 'Volume Profile', pathOk, pathEv);
    var famList = Object.keys(fams);
    return { dir: dir, cand: c, cands: all, rows: rows, score: score, families: famList, spreadOk: famList.length >= 4, mlPts: mlOk ? 1 : 0,
             held: !!(ctx.tape && ctx.tape !== dir) };
  }

  /* ---------------- SECTION 3 ---------------- */
  function decide(ctx, best){
    var s3 = { score: best ? best.score : 0, decision: 'NO SETUP', tier: null, qualifies: false, why: '', missing: [], mlGuard: false };
    if (!best){ s3.why = 'no permitted direction scored'; return s3; }
    var sc = best.score, rr = best.cand ? best.cand.rr1 : NaN;
    if (!best.spreadOk){ s3.decision = 'NO SETUP'; s3.spreadFail = true; s3.why = 'SPREAD FAIL — points from ' + best.families.length + ' families (' + best.families.join(', ') + '), need 4'; }
    else if (sc >= 12){ s3.decision = 'SETUP QUALIFIES'; s3.tier = 'full'; s3.qualifies = true; s3.why = sc + '/20 ≥ 12 · ' + best.families.length + ' families · VETO CLEAR'; }
    else if (sc >= 10){
      if (has(rr) && rr >= 2){ s3.decision = 'SETUP QUALIFIES — HALF SIZE'; s3.tier = 'half'; s3.qualifies = true; s3.why = sc + '/20 in 10–11 band with RR ' + num(rr) + ' ≥ 2.0'; }
      else { s3.why = sc + '/20 in 10–11 band but RR ' + num(rr) + ' < 2.0'; }
    } else s3.why = sc + '/20 < 10';
    /* ML inflation guard */
    if (best.mlPts && ((s3.tier === 'full' && sc - 1 < 12) || (s3.tier === 'half' && sc - 1 < 10))){
      s3.mlGuard = true;
      if (s3.tier === 'full'){ s3.tier = 'half'; s3.decision = 'SETUP QUALIFIES — HALF SIZE'; s3.why += ' · ML point decides the tier → downgraded one tier (vote inflation guard)'; if (!(has(rr) && rr >= 2)){ s3.qualifies = false; s3.decision = 'NO SETUP'; s3.why += ' · half tier needs RR ≥ 2.0'; } }
      else { s3.tier = null; s3.qualifies = false; s3.decision = 'NO SETUP'; s3.why += ' · ML point decides qualification → downgraded (vote inflation guard)'; }
    }
    if (!s3.qualifies){
      s3.missing = best.rows.filter(function(r){ return !r.got; }).map(function(r){ return { name: r.name, pts: r.pts, need: r.evidence }; });
    }
    if (best.held){ s3.qualifies = false; s3.decision = 'HELD — against gold tape'; s3.why += ' · desk tape opposes this direction'; }
    return s3;
  }

  /* ---------------- SECTION 4 ---------------- */
  function selectStrategy(ctx, best, scored){
    var c = best.cand, primary = c.sid, also = [], target = 'S38';
    if (c.cls === 'sweep' && c.sid !== 'S37'){
      if (ctx.dr && ((c.dir === 'long' && ctx.dr.half === 'DISCOUNT') || (c.dir === 'short' && ctx.dr.half === 'PREMIUM'))) also.push('S9');
      if (ctx.regime === 'CHOP' && (ctx.pocs.length >= 3 && ctx.pocStep === 'FLAT') && /VAH|VAL/.test(c.kind)) also.push('S17');
      if (best.rows.some(function(r){ return r.name === 'Order Flow & Delta Divergence' && r.got; })) also.push('S16');
      if (ctx.dxy4h !== 'unavailable' && ((c.dir === 'long' && ctx.dxy4h === 'DOWN') || (c.dir === 'short' && ctx.dxy4h === 'UP'))) also.push('S36');
    }
    if (c.sid === 'S3') also.push('S30');
    if (/naked POC/.test(c.t1Label)) target = 'S2'; else if (/VAH|VAL/.test(c.t1Label)) target = 'S1'; else if (/Asia/.test(c.t1Label)) target = 'S18';
    var rank = LADDER[c.cls] || 5, ladder = 'hard vetoes > composite > sweep > weekly > continuation > breakout > fades — rank ' + rank + ' (' + c.cls + ')';
    /* equal-rank conflict across directions → WAIT */
    var wait = false, why = '';
    if (scored.length > 1){
      var other = scored[1];
      if (other.cand && other.score === best.score && (LADDER[other.cand.cls] || 5) === rank && other.cand.dir !== c.dir){ wait = true; why = 'two directional templates conflict at equal rank (' + c.sid + ' ' + up(c.dir) + ' vs ' + other.cand.sid + ' ' + up(other.cand.dir) + ') → WAIT'; }
    }
    return { primary: primary, name: NAME_OF[primary] || primary, also: also, target: target, targetName: NAME_OF[target], rank: rank, ladder: ladder, wait: wait, why: why };
  }

  /* ---------------- SECTION 5 ---------------- */
  function levels(ctx, best, s3, s4){
    var g = G7(), c = best.cand, nextClose = (ctx.rows1h[ctx.rows1h.length - 1].t + 2 * ctx.tf) * 1000;
    var t2 = c.t2, t2Note = c.t2Label;
    if (has(ctx.composite && ctx.composite.pocPrice) && has(t2) && Math.abs(ctx.composite.pocPrice - c.entry) <= ctx.atr1h && ((c.dir === 'long' && ctx.composite.pocPrice < t2) || (c.dir === 'short' && ctx.composite.pocPrice > t2))){ t2 = ctx.composite.pocPrice; t2Note = 'capped at composite POC'; }
    var removeT2 = (has(ctx.oi.chgPct) && ctx.oi.chgPct < -2 && ((c.dir === 'long' && ctx.fund.value > 0) || false)) || ctx.atrRegime === 'compressed' || ctx.walls.some(function(w){ return Math.abs(w.level - c.t1) <= 1; });
    var mgmt = removeT2 ? '70% at TP1 + stop to entry (TP2 removed: ' + (ctx.atrRegime === 'compressed' ? 'ATR compressed' : 'options wall / short-covering') + ') · 30% runner by nPOC ladder (S38)' : '50% TP1 + stop to entry · 30% TP2 · 20% runner by nPOC ladder (S38) or session-VWAP trail';
    var rrVerdict = !has(c.rr1) ? 'RR FAIL — NO SETUP (no TP1)' : c.rr1 >= 2 ? 'RR ' + num(c.rr1) + ' ≥ 2.0 full' : c.rr1 >= 1.5 ? 'RR ' + num(c.rr1) + ' in 1.5–2.0 half band' : 'RR FAIL — NO SETUP (' + num(c.rr1) + ' < 1.5)';
    if (has(c.rr1) && c.rr1 < 1.5){ s3.qualifies = false; s3.decision = 'NO SETUP'; s3.why += ' · RR FAIL ' + num(c.rr1); }
    var mult = has(ctx.basisPct) ? 1 + ctx.basisPct / 100 : 1;
    var conv = has(ctx.basisPct) && ctx.venue !== 'analysis feed' ? { venue: ctx.venue, basisPct: ctx.basisPct, entry: c.entry * mult, stop: c.stop * mult, t1: c.t1 * mult, t2: t2 * mult } : null;
    var holdEnd = ctx.session.londonCloseMs, t1InHold = ctx.news.available && has(ctx.news.nextMs) && ctx.news.nextTier === 1 && ctx.news.nextMs > ctx.rows1h[ctx.rows1h.length - 1].t * 1000 && ctx.news.nextMs < holdEnd;
    var ivrv = has(ctx.gvz) && has(ctx.rv20) ? ctx.gvz - ctx.rv20 : NaN;
    var expression = t1InHold ? 'option debit spread preferable (S41) — Tier-1 event inside the hold window' : (has(ivrv) && ivrv < -3) ? 'option debit spread preferable (S41) — GVZ − realized ' + num(ivrv, 1) + ' < −3' : 'outright position (no S41 trigger' + (has(ivrv) ? '' : '; GVZ/RV unavailable') + ')';
    return {
      dir: c.dir, entry: c.entry, entryCondition: c.sid === 'S37' ? (ctx.tfLabel + ' retest of ' + px(c.level) + ' after acceptance → limit ' + px(c.entry)) : (c.reclaimed ? (ctx.tfLabel + ' closed back ' + (c.dir === 'long' ? 'above ' : 'below ') + px(c.level) + ' (' + c.kind + ') → limit ' + px(c.entry)) : (ctx.tfLabel + ' close back ' + (c.dir === 'long' ? 'above ' : 'below ') + px(c.level) + ' at ' + g.istUtc(nextClose) + ' → limit ' + px(c.entry))),
      stop: c.stop, sl: c.risk, stopWhy: 'beyond ' + (c.sid === 'S3' ? 'far edge of the node' : 'sweep wick ' + px(c.wick)) + ' + buffer $' + num(c.buf) + ' (' + c.bufNote + ')' + (has(ctx.gcRoll) ? '' : ' · GC roll-week coverage unavailable'),
      t1: c.t1, t1Label: c.t1Label, rr1: c.rr1, rrVerdict: rrVerdict, t2: t2, t2Label: t2Note, rr2: c.risk > 0 && has(t2) ? Math.abs(t2 - c.entry) / c.risk : NaN, removeT2: removeT2,
      management: mgmt, timeStop: (c.sid === 'S7' || c.sid === 'S17') ? 'runner may hold with stop under each session POC; intraday portion London close ' + g.istUtc(holdEnd) : 'London close ' + g.istUtc(holdEnd),
      invalidation: 'two consecutive ' + ctx.tfLabel + ' closes ' + (c.dir === 'long' ? 'below ' : 'above ') + px(c.level) + ' (acceptance) or sweep age > 3 bars',
      venue: conv, expression: expression
    };
  }

  /* ---------------- SECTION 6 ---------------- */
  function sizing(ctx, best, s3, s5){
    var c = best.cand, out = { equity: ctx.equity, baseRiskPct: ctx.baseRiskPct };
    var reduced = ctx.traderState === 'REDUCED';
    out.basePct = reduced ? Math.min(ctx.baseRiskPct, 0.5) : ctx.baseRiskPct;
    var atr100 = G7().atrN(ctx.rows1h, 100), atr14 = ctx.atr1h;
    out.vmodRaw = has(atr100) && atr14 > 0 ? atr100 / atr14 : NaN;
    out.vmod = has(out.vmodRaw) ? clamp(out.vmodRaw, 0.5, 1.5) : 1;
    out.tierMult = s3.tier === 'half' ? 0.5 : 1;
    out.traderMult = reduced ? 0.5 : 1;
    if (!(out.equity > 0)){ out.pick = 'account balance missing — set it in the OMNIGOLD 1 inputs'; out.adjustedRisk = NaN; return out; }
    out.baseline = out.equity * out.basePct / 100;
    out.adjustedRisk = out.baseline * out.vmod * out.tierMult * out.traderMult;
    if (has(ctx.dd95) && ctx.dd95 > 0){ var cap = out.equity * 0.08 / ctx.dd95 * out.baseline; if (cap < out.adjustedRisk){ out.adjustedRisk = cap; out.ddCapped = true; } }
    var m = ctx.isPerp ? 1 : (/MGC/i.test(ctx.venue) ? 10 : 100);
    out.multiplier = m; out.multLabel = ctx.isPerp ? '1 per oz (perp)' : m === 10 ? '10 (MGC)' : '100 (XAUUSD lot / GC)';
    out.lots = c.risk > 0 ? Math.floor(out.adjustedRisk / (c.risk * m) * (ctx.isPerp ? 100 : 1)) / (ctx.isPerp ? 100 : 1) : 0;
    out.pick = out.lots > 0 ? (out.lots + (ctx.isPerp ? ' oz' : m === 10 ? ' MGC' : ' lot' + (out.lots === 1 ? '' : 's'))) : 'sub-lot — reduce risk or widen? no: reduce account risk';
    out.notional = out.lots * m * c.entry;
    out.leverage = out.equity > 0 ? out.notional / out.equity : NaN;
    if (ctx.isPerp){
      out.liq = has(ctx.maintMarginPct) ? 'computable' : 'unavailable — maintenance margin not read; confirm liquidation beyond stop by ≥ 0.5 × SL$ on the venue';
    } else out.liq = 'n/a (not a perp)';
    return out;
  }

  /* ---------------- SECTION 7 ---------------- */
  function gateTable(ctx, best, s3){
    var c = best.cand, gt = c.gates, rows = gt.gates.map(function(x){ return { gate: 'G' + x.n, name: x.name, result: x.pass ? 'PASS' : 'FAIL', note: x.note }; });
    var g14 = c.dir === 'long' ? ctx.rsiVeto.longVeto : ctx.rsiVeto.shortVeto;
    rows.push({ gate: 'G14', name: 'RSI exhaustion veto', result: g14 ? 'FAIL' : 'PASS', note: '4H RSI ' + num(ctx.rsi4h, 1) });
    rows.push({ gate: 'G13', name: 'CVD confirms (optional)', result: ctx.cvd ? (best.rows[1].got ? 'PASS' : 'FAIL') : 'unavailable', note: best.rows[1].evidence });
    rows.push({ gate: 'G15', name: 'positioning (optional)', result: has(ctx.cot) || has(ctx.fund.value) ? (best.rows.find(function(r){ return r.name === 'Positioning & Physical'; }).got ? 'PASS' : 'FAIL') : 'unavailable', note: '' });
    rows.push({ gate: 'G16', name: 'anchored VWAP side (optional)', result: has(ctx.vw.vwap) ? ((c.dir === 'long' ? c.entry >= ctx.vw.vwap - ctx.vw.sd : c.entry <= ctx.vw.vwap + ctx.vw.sd) ? 'PASS' : 'FAIL') : 'unavailable', note: 'session VWAP ' + px(ctx.vw.vwap) });
    var fails = gt.gates.filter(function(x){ return !x.pass; });
    var result = 'INVALID';
    if (!fails.length && !g14) result = 'VALID';
    else if (fails.length === 1 && fails[0].n === 9 && gt.halfBand && !g14) result = 'VALID-HALF';
    var sane = [];
    var t1InHvn = false;
    if (ctx.vp4h){ var hz = G7().zones(ctx.vp4h.hvnsStrict && ctx.vp4h.hvnsStrict.length ? ctx.vp4h.hvnsStrict : (ctx.vp4h.hvns || []), ctx.vp4h.binSize); t1InHvn = hz.some(function(z){ return c.entry >= z.lo && c.entry <= z.hi && c.t1 >= z.lo && c.t1 <= z.hi; }); }
    sane.push({ id: 'a', name: 'TP1 not inside entry HVN', pass: !t1InHvn });
    sane.push({ id: 'b', name: 'stop beyond wick', pass: c.dir === 'long' ? c.stop < c.wick : c.stop > c.wick });
    sane.push({ id: 'c', name: 'R ≤ 0.6 × 4H ATR', pass: c.risk <= 0.6 * ctx.atr4h });
    var holdEnd = ctx.session.londonCloseMs, newsIn = ctx.news.available && has(ctx.news.nextMs) && ctx.news.nextMs > ctx.rows1h[ctx.rows1h.length - 1].t * 1000 && ctx.news.nextMs < holdEnd && ctx.news.nextTier <= 2;
    sane.push({ id: 'd', name: 'no Tier-1/2 inside hold', pass: !newsIn, note: newsIn ? 'lockout plan: flat or stop-to-entry before ' + ctx.news.window : (ctx.news.available ? '' : 'calendar unavailable') });
    sane.push({ id: 'e', name: 'direction agrees with bias', pass: ctx.bias.bias === up(c.dir) || (ctx.bias.bias === 'BOTH' && (c.grade === 'A' || c.grade === 'B+' || ctx.atVaEdge)) });
    sane.push({ id: 'f', name: 'feed current, basis normal', pass: ctx.feedOk });
    if (sane.some(function(s){ return !s.pass; })) result = 'INVALID';
    var conflict = s3.qualifies && result === 'INVALID';
    return { rows: rows, result: result, failing: fails.map(function(x){ return 'G' + x.n; }).concat(g14 ? ['G14'] : []), sanity: sane, conflict: conflict, conflictGate: conflict ? (fails.length ? 'G' + fails[0].n + ' ' + fails[0].name : (g14 ? 'G14 RSI veto' : 'sanity ' + sane.filter(function(s){ return !s.pass; }).map(function(s){ return s.id; }).join(','))) : null };
  }

  /* ---------------- SECTION 8 ---------------- */
  function nextRescan(nowMs){
    var g = G7(), lon = g.nextLocalHourMs(nowMs, 'Europe/London', 8), ny = g.nextLocalHourMs(nowMs, 'America/New_York', 8);
    var ist = g.nextLocalHourMs(nowMs, 'Asia/Kolkata', 5.5);
    var next = Math.min(lon, ny, ist);
    return (next === lon ? 'London open ' : next === ny ? 'NY open ' : 'daily context ') + g.istUtcDay(next);
  }
  function trigger(ctx, best, s3, s5, s6, s7, s4){
    var g = G7(), out = { state: 'WAIT', reason: '', line: '', nextRescan: nextRescan(ctx.rows1h[ctx.rows1h.length - 1].t * 1000 + ctx.tf * 1000 + 1) };
    var last = ctx.rows1h[ctx.rows1h.length - 1], nextClose = (last.t + 2 * ctx.tf) * 1000;
    if (!best || !best.cand || !s3.qualifies){
      out.state = 'WAIT'; out.reason = (s3.decision || 'NO SETUP') + ' — ' + s3.why;
      if (best && best.cand){ var c0 = best.cand; out.nextClose = 'the ' + g.istUtc(nextClose) + ' ' + ctx.tfLabel + ' close must ' + (c0.reclaimed ? 'hold ' : 'close back ') + (c0.dir === 'long' ? 'above ' : 'below ') + px(c0.level) + (s3.missing && s3.missing.length ? ' · missing: ' + s3.missing.slice(0, 3).map(function(m){ return m.name + ' (+' + m.pts + ')'; }).join(', ') : ''); }
      out.s37 = ctx.acceptance ? 'S37 second-chance eligible (acceptance printed)' : 'S37 not eligible';
      return out;
    }
    var c = best.cand, dist = Math.abs(last.c - c.entry), distSl = c.risk > 0 ? dist / c.risk : NaN;
    var valid = s7 && (s7.result === 'VALID' || s7.result === 'VALID-HALF');
    var expired = null;
    if (c.acceptance && c.sid !== 'S37') expired = 'acceptance — two 1H closes beyond ' + px(c.level);
    else if (c.age > g.MAX_SWEEP_AGE) expired = 'sweep ' + c.age + ' bars old (> 3)';
    else if (!ctx.session.tradeable) expired = 'session window closed (' + ctx.session.label + ')';
    else if (has(distSl) && distSl > 1) expired = 'price ran ' + num(distSl) + ' × SL$ from entry — never chase';
    if (expired){ out.state = 'EXPIRED'; out.reason = expired; out.s37 = ctx.acceptance ? ('S37 second-chance eligible — continuation ' + (c.dir === 'long' ? 'SHORT' : 'LONG') + ' through ' + px(c.level)) : 'S37 not eligible (no acceptance)'; return out; }
    if (c.reclaimed && has(distSl) && distSl <= 0.25 && c.age <= g.MAX_SWEEP_AGE && valid){
      out.state = 'TRIGGERED';
      out.reason = 'entry condition closed on the ' + g.istUtc((last.t + ctx.tf) * 1000) + ' ' + ctx.tfLabel + ' bar · ' + num(distSl) + ' × SL$ from entry · sweep age ' + c.age + ' · veto clear · gates ' + s7.result;
      out.line = 'Enter ' + up(c.dir) + ' at ' + px(c.entry) + ' | Stop ' + px(c.stop) + ' | TP1 ' + px(s5.t1) + ' | TP2 ' + (s5.removeT2 ? 'removed' : px(s5.t2)) + ' | Size ' + (s6 ? s6.pick : 'unavailable') + ' | Time stop ' + g.fmtHM(ctx.session.londonCloseMs, 'Asia/Kolkata') + ' IST | Template ' + s4.primary + '.';
      return out;
    }
    out.state = 'WAIT';
    if (!c.reclaimed) out.reason = 'sweep wick ' + px(c.wick) + ' printed ' + c.age + ' bar(s) ago; the ' + g.istUtc(nextClose) + ' ' + ctx.tfLabel + ' close must be ' + (c.dir === 'long' ? 'above ' : 'below ') + px(c.level);
    else if (!valid) out.reason = 'reclaim closed but gates ' + (s7 ? s7.result + ' (' + s7.failing.join(', ') + ')' : 'unread') + ' — need them on the ' + g.istUtc(nextClose) + ' close';
    else out.reason = 'price ' + num(distSl) + ' × SL$ from entry ' + px(c.entry) + ' (> 0.25) — wait for the retest into ' + px(c.entry) + ' before ' + g.istUtc(nextClose);
    return out;
  }

  /* ---------------- summary block (≤ 15 lines) ---------------- */
  function summaryBlock(out, ctx, best){
    var g = G7(), s0 = out.sections.s0, s1 = out.sections.s1, s2 = out.sections.s2, s3 = out.sections.s3, s4 = out.sections.s4, s5 = out.sections.s5, s6 = out.sections.s6, s7 = out.sections.s7, s8 = out.sections.s8;
    var L = [];
    L.push('XAUUSD ' + (out.sections.feed || ctx.feedWhy.split(' · ')[0]) + '→' + ctx.venue + (has(ctx.basisPct) ? ' basis ' + num(ctx.basisPct) + '%' : ' basis unavailable') + ' | ' + out.nowIst + ' | Session ' + ctx.session.label + ' | Regime ' + ctx.regime + ' | Day type ' + (s1 ? s1.dayType : 'n/a') + ' | VETO ' + (s0.clear ? 'CLEAR ' + s0.passed + '/10' : 'ACTIVE: ' + s0.active.map(function(v){ return v.name; }).join(' · ')));
    if (!s0.clear){ L.push('SCORE = 0. NO TRADE.'); L.push(out.disclaimer); return L; }
    L.push('Bias ' + (ctx.ctxLabel || '4H') + ' ' + s1.bias.bias + (s1.bias.transition ? ' (TRANSITION → WAIT)' : '') + ' | Weekly permission ' + s1.weekly.perm + ' | Trader state ' + s1.traderState + (s1.held.length ? ' | HELD ' + s1.held.map(up).join('/') + ' (against tape)' : ''));
    if (!best){ L.push('NO PERMITTED DIRECTION — ' + s3.why); L.push('TRIGGER: WAIT — next re-scan ' + s8.nextRescan); L.push(out.disclaimer); return L; }
    var R = best.rows, gotOf = function(n){ var r = R.find(function(x){ return x.name === n; }); return r ? r.got : 0; };
    L.push('SCORE ' + best.score + '/20 (A: Macro ' + gotOf('Intermarket / Macro Driver') + ' Delta ' + gotOf('Order Flow & Delta Divergence') + ' VPOC ' + gotOf('Volume Profile & VPOC/HVN Rejection') + ' VWAP/Z ' + gotOf('Statistical Positioning (VWAP / Z)') + ' ML ' + gotOf('Algorithmic Momentum (ML)') + ' Sweep ' + gotOf('Structural Liquidity Sweep (SMC)') + ' Session ' + gotOf('Session Volatility Filter')
      + ' | B: Trend ' + gotOf('Trend & Location Alignment') + ' Positioning ' + gotOf('Positioning & Physical') + ' Vol ' + gotOf('Volatility & Target Realism') + ' Composite ' + gotOf('Composite Structure') + ' Time ' + gotOf('Time Statistics') + ' Regime ' + gotOf('Regime Fit') + ' Exec ' + gotOf('Execution Quality') + ' Path ' + gotOf('Clean Path') + ')');
    L.push('Families contributing ' + best.families.length + (best.spreadOk ? '' : ' (SPREAD FAIL)') + ' | DECISION ' + s3.decision + ' | ' + (s4 && s4.primary ? 'PRIMARY ' + s4.primary + ' ' + s4.name + (s4.also.length ? ' | also ' + s4.also.join(', ') : '') + ' | target ' + s4.target : 'hypothesis ' + up(best.dir) + (best.cand ? ' ' + best.cand.sid + ' ' + best.cand.kind : ' — no swept pool')));
    if (s5){
      L.push('ENTRY ' + px(s5.entry) + ' on ' + s5.entryCondition + ' | STOP ' + px(s5.stop) + ' (SL$ ' + num(s5.sl) + ') | TP1 ' + px(s5.t1) + ' RR ' + num(s5.rr1) + ' | TP2 ' + (s5.removeT2 ? 'removed' : px(s5.t2) + ' RR ' + num(s5.rr2)) + ' | time stop ' + s5.timeStop.replace(/^London close /, ''));
      L.push('V-Mod raw ' + num(s6.vmodRaw) + ' clamped ' + num(s6.vmod) + ' | Adjusted risk $' + num(s6.adjustedRisk, 0) + ' | Size ' + s6.pick + ' (mult ' + s6.multLabel + ') | Leverage ' + num(s6.leverage, 1) + 'x | Liq clearance ' + (ctx.isPerp ? 'unavailable' : 'n/a'));
    } else if (s3.missing && s3.missing.length){
      L.push('Missing: ' + s3.missing.slice(0, 5).map(function(m){ return m.name + ' +' + m.pts; }).join(' · '));
    }
    if (s7) L.push('12-gate cross-check ' + s7.result + (s7.failing.length ? ' gates ' + s7.failing.join(', ') : '') + ' | Sanity a–f ' + s7.sanity.map(function(s){ return s.pass ? 'P' : 'F'; }).join(''));
    L.push('TRIGGER: ' + s8.state + ' — ' + (s8.line || s8.reason) + (s8.nextClose ? ' · ' + s8.nextClose : '') + (s8.state !== 'TRIGGERED' ? ' · next re-scan ' + s8.nextRescan : ''));
    if (s8.s37) L.push(s8.s37);
    L.push(out.disclaimer);
    return L.slice(0, 15);
  }

  /* ================================================================== */
  /*                               RENDER                               */
  /* ================================================================== */
  function tag(state){ var s = String(state || ''); return '<span class="og1-tag og1-' + esc(s.replace(/[^a-z]/gi, '').toLowerCase()) + '">' + esc(s) + '</span>'; }
  function hgOg1Html(r){
    try{
      if (!r) return '';
      var g = G7();
      var h = '<div class="note og1-root" data-hg-og1="1">';
      h += '<div class="og1-head"><b>OMNIGOLD 1 · INSTITUTIONAL GOLD SETUP ENGINE · ' + esc(r.horizon || 'SWING') + '</b> · ' + (r.horizon === 'SCALP' ? '1H context / 15m execution' : '4H context / 1H execution') + ' · ' + esc(r.nowIst || '') + '</div>';
      if (!r.ok){ h += '<div class="og1-veto"><b>DATA_UNAVAILABLE</b> — ' + esc(r.why) + '</div><div class="dim">' + esc(r.disclaimer) + '</div></div>'; return h; }
      var S = r.sections, s0 = S.s0;
      function sec(n, title){ return '<div class="og1-sec"><b>SECTION ' + n + ' — ' + esc(title) + '</b></div>'; }
      function row(k, v){ return '<div class="dim og1-row"><u>' + esc(k) + '</u> ' + v + '</div>'; }
      h += sec(0, 'DATA LOAD AND VETO STACK');
      h += '<div class="og1-grid">' + s0.load.map(function(l){ return '<div>' + tag(l.state) + ' <b>' + esc(l.name) + '</b> <span class="dim">' + esc(l.note) + '</span></div>'; }).join('') + '</div>';
      if (s0.veto){
        h += '<div style="margin-top:6px"><b>' + (s0.clear ? 'VETO CLEAR (' + s0.passed + '/10 checks passed)' : 'VETO ACTIVE: ' + esc(s0.active.map(function(v){ return v.name + (v.note ? ' — ' + v.note : ''); }).join(' · ')) + ' · SCORE = 0 · NO TRADE') + '</b></div>';
        h += '<div class="og1-grid">' + s0.veto.map(function(v){ return '<div>' + tag(v.state) + ' ' + v.n + '. ' + esc(v.name) + ' <span class="dim">' + esc(v.note) + '</span></div>'; }).join('') + '</div>';
      }
      if (!s0.clear){ h += '<pre class="dim og1-pre">' + esc(r.summary.join('\n')) + '</pre></div>'; return h; }
      var s1 = S.s1;
      h += sec(1, 'REGIME AND PERMISSION LAYER');
      h += row('Regime (KER 20 · 4H)', '<b>' + esc(s1.regime) + '</b> · KER ' + num(s1.ker) + (s1.kerCrossed ? ' · crossed a threshold in last 4 × 4H' : '') + ' · enabled: ' + esc(Object.keys(s1.classes).filter(function(k){ return s1.classes[k]; }).map(function(k){ return k + (s1.classes[k] === true ? '' : ' (' + s1.classes[k] + ')'); }).join(', ')) + ' · fades never in TREND');
      h += row('Day type', '<b>' + esc(s1.dayType) + '</b> · ' + esc(s1.dayWhy));
      h += row('4H bias', '<b>' + esc(s1.bias.bias) + (s1.bias.transition ? ' (TRANSITION → WAIT)' : '') + '</b> · ' + esc(s1.bias.why.join(' · ')) + ' · RSI veto ' + esc(s1.rsiVeto));
      h += row('Weekly permission (S28)', tag(s1.weekly.state) + ' ' + esc(s1.weekly.perm));
      h += row('Trader state', '<b>' + esc(s1.traderState) + '</b>');
      h += row('Hypothesis', s1.permitted.length ? s1.permitted.map(up).map(esc).join(' + ') + (s1.held.length ? ' · HELD ' + s1.held.map(up).join('/') + ' (against gold tape)' : '') : '<b>NO PERMITTED DIRECTION</b>');
      if (!S.s2){ h += '<div style="margin-top:6px"><b>' + esc(S.s3.decision) + '</b> — ' + esc(S.s3.why) + '</div><pre class="dim og1-pre">' + esc(r.summary.join('\n')) + '</pre></div>'; return h; }
      var best = S.s2.best;
      h += sec(2, 'THE 20-POINT CONFLUENCE MATRIX — hypothesis ' + up(best.dir) + (best.cand ? ' · ' + best.cand.sid + ' ' + best.cand.kind : ' · no swept pool this window'));
      h += '<table class="og1-tbl"><tr><th>blk</th><th>pts</th><th>component</th><th>family</th><th>evidence</th></tr>';
      best.rows.forEach(function(x){ h += '<tr class="' + (x.got ? 'og1-got' : 'og1-miss') + '"><td>' + x.block + '</td><td><b>' + x.got + '/' + x.pts + '</b></td><td>' + esc(x.name) + '</td><td class="dim">' + esc(x.family) + '</td><td class="dim">' + esc(x.evidence) + (x.unavailable ? ' · unavailable' : '') + '</td></tr>'; });
      h += '</table><div><b>SCORE = ' + best.score + ' / 20</b> · families ' + best.families.length + ' (' + esc(best.families.join(', ')) + ')' + (best.spreadOk ? '' : ' · <b>SPREAD FAIL</b>') + '</div>';
      if (S.s2.scored.length > 1) h += '<div class="dim">other hypothesis: ' + esc(up(S.s2.scored[1].dir) + ' ' + S.s2.scored[1].score + '/20') + '</div>';
      h += sec(3, 'DECISION');
      h += '<div><b>' + esc(S.s3.decision) + '</b> — ' + esc(S.s3.why) + '</div>';
      if (S.s3.missing && S.s3.missing.length) h += '<div class="dim">to add points: ' + S.s3.missing.map(function(m){ return '<b>' + esc(m.name) + ' +' + m.pts + '</b> — ' + esc(m.need); }).join(' · ') + '</div>';
      h += sec(4, 'STRATEGY SELECTOR');
      if (S.s4 && S.s4.primary) h += '<div><b>PRIMARY: ' + esc(S.s4.primary + ' ' + S.s4.name) + '</b> · ALSO SATISFIES: ' + esc(S.s4.also.length ? S.s4.also.map(function(s){ return s + ' ' + (NAME_OF[s] || ''); }).join(', ') : 'none') + ' · TARGET LOGIC USED: ' + esc(S.s4.target + ' ' + S.s4.targetName) + '</div><div class="dim">' + esc(S.s4.ladder) + (S.s4.wait ? ' · ' + esc(S.s4.why) : '') + '</div>';
      else h += '<div class="dim">' + esc(S.s4 ? S.s4.why : 'n/a') + '</div>';
      h += sec(5, 'TRADE LEVELS');
      if (S.s5){
        var f = S.s5;
        h += '<div><b>' + esc(up(f.dir)) + ' XAUUSD · ENTRY ' + px(f.entry) + '</b> — ' + esc(f.entryCondition) + '</div>';
        h += row('STOP', px(f.stop) + ' · SL$ ' + num(f.sl) + ' · ' + esc(f.stopWhy));
        h += row('TP1', px(f.t1) + ' (' + esc(f.t1Label) + ') · ' + esc(f.rrVerdict));
        h += row('TP2', (f.removeT2 ? 'removed — ' : px(f.t2) + ' (' + esc(f.t2Label) + ') · RR ' + num(f.rr2) + ' · ') + esc(f.management));
        h += row('Time stop', esc(f.timeStop)) + row('Invalidation before fill', esc(f.invalidation));
        h += row('Venue conversion', f.venue ? esc(f.venue.venue) + ' (basis ' + num(f.venue.basisPct) + '%): ENTRY ' + px(f.venue.entry) + ' · STOP ' + px(f.venue.stop) + ' · TP1 ' + px(f.venue.t1) + ' · TP2 ' + px(f.venue.t2) + ' · MCX GOLDM: k / USDINR unavailable (S39)' : 'same as analysis feed · MCX GOLDM: k / USDINR unavailable (S39)');
        h += row('Expression', esc(f.expression));
      } else h += '<div class="dim">no qualifying setup — nothing to price</div>';
      h += sec(6, 'POSITION SIZE (V-Mod, clamped, liquidation clearance)');
      if (S.s6){
        var z = S.s6;
        h += row('A Baseline', has(z.equity) ? '$' + num(z.equity, 0) + ' × ' + num(z.basePct, 2) + '% = $' + num(z.baseline, 0) : 'account balance missing');
        h += row('B V-Mod', 'ATR(100)/ATR(14) 1H raw ' + num(z.vmodRaw) + ' → clamped ' + num(z.vmod));
        h += row('C Adjusted risk', '$' + num(z.adjustedRisk, 0) + ' (tier ×' + z.tierMult + ' · trader ×' + z.traderMult + (z.ddCapped ? ' · capped by bootstrap DD95 ≤ 8% equity' : '') + ')');
        h += row('D Lot size', '<b>' + esc(z.pick) + '</b> · multiplier ' + esc(z.multLabel) + ' · notional $' + num(z.notional, 0) + ' · effective leverage ' + num(z.leverage, 1) + '×');
        h += row('Liquidation clearance', esc(z.liq));
      } else h += '<div class="dim">n/a</div>';
      h += sec(7, 'CROSS-CHECK AGAINST THE 12 CORE GATES');
      if (S.s7){
        h += '<table class="og1-tbl"><tr><th>gate</th><th>check</th><th>result</th><th>note</th></tr>' + S.s7.rows.map(function(x){ return '<tr><td>' + esc(x.gate) + '</td><td>' + esc(x.name) + '</td><td><b>' + esc(x.result) + '</b></td><td class="dim">' + esc(x.note) + '</td></tr>'; }).join('') + '</table>';
        h += '<div><b>' + esc(S.s7.result) + '</b>' + (S.s7.failing.length ? ' — ' + esc(S.s7.failing.join(', ')) : '') + (S.s7.conflict ? ' · <b>MATRIX/GATE CONFLICT → NO SETUP</b> (' + esc(S.s7.conflictGate) + ')' : '') + '</div>';
        h += '<div class="dim">sanity: ' + S.s7.sanity.map(function(s){ return '(' + s.id + ') ' + esc(s.name) + ' <b>' + (s.pass ? 'PASS' : 'FAIL') + '</b>' + (s.note ? ' — ' + esc(s.note) : ''); }).join(' · ') + '</div>';
      } else h += '<div class="dim">n/a — no candidate reached the gates</div>';
      h += sec(8, 'TRIGGER CHECK');
      h += '<div><b style="font-size:14px">' + esc(S.s8.state) + '</b> — ' + esc(S.s8.reason) + '</div>';
      if (S.s8.line) h += '<div style="margin-top:3px"><b>' + esc(S.s8.line) + '</b></div>';
      if (S.s8.nextClose) h += '<div class="dim">' + esc(S.s8.nextClose) + '</div>';
      if (S.s8.s37) h += '<div class="dim">' + esc(S.s8.s37) + '</div>';
      h += '<div class="dim">next re-scan ' + esc(S.s8.nextRescan) + '</div>';
      h += '<pre class="dim og1-pre">' + esc(r.summary.join('\n')) + '</pre>';
      h += '</div>';
      return h;
    }catch(e){ return '<div class="note" data-hg-og1="1">OMNIGOLD 1 render error: ' + esc(e && e.message) + '</div>'; }
  }
  function hgOg1Text(r){ return r && r.summary ? r.summary.join('\n') : ''; }

  /* ---------------- setup cards: SCALP + SWING from the engine, plus desk-bridged setups ---------------- */
  function verdictChip(v){
    if (!v) return tag('unscored');
    if (v.decision.indexOf('HELD') === 0) return tag('HELD');
    if (v.qualifies && v.tier === 'full') return tag('QUALIFIES');
    if (v.qualifies) return tag('HALF SIZE');
    return tag('NO SETUP');
  }
  function candCard(c, horizon, ctxLabel, tfLabel){
    var m = c.matrix || { score: 0, families: [] }, v = c.verdict || null, g7 = c.gates || { pass: 0 };
    var h = '<div class="og1-card og1-card-' + esc(c.dir) + (v && v.qualifies ? ' og1-card-q' : '') + '">';
    h += '<div class="og1-card-head"><b class="og1-dir">' + esc(up(c.dir)) + '</b> <b>XAUUSD</b> · ' + esc(horizon) + ' · <b>' + esc(c.sid) + '</b> ' + esc(c.name) + ' <span class="dim">— ' + esc(c.kind) + '</span></div>';
    h += '<div class="og1-card-chips">' + verdictChip(v) + tag('SCORE ' + m.score + '/20') + tag('gates ' + g7.pass + '/12') + tag('location ' + c.grade) + (has(c.rr1) ? tag('RR ' + num(c.rr1, 1)) : tag('RR unavailable')) + tag('families ' + (m.families || []).length) + (c.reclaimed ? tag('reclaim closed · age ' + c.age) : tag('reclaim pending · age ' + c.age)) + '</div>';
    h += '<div class="og1-levels"><div><i>ENTRY</i><b>' + px(c.entry) + '</b><u>' + (c.dir === 'long' ? 'BUY ZONE' : 'SELL ZONE') + '</u></div><div><i>STOP</i><b>' + px(c.stop) + '</b><u>SL$ ' + num(c.risk) + '</u></div><div><i>TP1</i><b>' + px(c.t1) + '</b><u>' + esc(c.t1Label) + '</u></div><div><i>TP2</i><b>' + px(c.t2) + '</b><u>' + esc(c.t2Label) + '</u></div></div>';
    h += '<div class="dim og1-card-why">' + esc(v ? v.why : '') + (v && v.missing && v.missing.length ? ' · missing ' + esc(v.missing.slice(0, 3).map(function(x){ return x.name + ' +' + x.pts; }).join(', ')) : '') + '</div>';
    h += '<div class="dim">context ' + esc(ctxLabel) + ' · execution ' + esc(tfLabel) + ' · stop beyond ' + px(c.wick) + ' + $' + num(c.buf) + ' · invalidates on two ' + esc(tfLabel) + ' closes ' + (c.dir === 'long' ? 'below ' : 'above ') + px(c.level) + '</div>';
    h += '</div>';
    return h;
  }
  function bridgeCards(horizon){
    /* GOLD SCALP / GOLD SWING desks, when they have scanned in the last 30 min */
    var fn = gfn(horizon === 'SCALP' ? 'goldscalpScan' : 'goldswingScan');
    if (!fn) return { html: '', n: 0 };
    var snap = null; try{ snap = fn(); }catch(e){ snap = null; }
    if (!snap || !Array.isArray(snap.cands) || !snap.cands.length) return { html: '', n: 0 };
    if (has(snap.at) && Date.now() - snap.at > 30 * 60000) return { html: '', n: 0 };
    var h = '', n = 0;
    snap.cands.slice(0, 6).forEach(function(c){
      if (!c || !c.dir || !has(c.entry)) return;
      n++;
      h += '<div class="og1-card og1-card-' + esc(String(c.dir).toLowerCase()) + ' og1-card-bridge"><div class="og1-card-head"><b class="og1-dir">' + esc(up(c.dir)) + '</b> <b>XAUUSD</b> · ' + esc(horizon) + ' · <b>' + esc(c.strategy || c.stratKey || 'desk setup') + '</b> <span class="dim">— GOLD ' + esc(horizon) + ' desk' + (c.id === snap.bestId ? ' · MOST PROBABLE' : '') + '</span></div>';
      h += '<div class="og1-card-chips">' + tag('desk grade ' + (c.grade || '—')) + (has(c.tally) ? tag('tally ' + c.tally) : '') + (has(c.rr) ? tag('RR ' + num(c.rr, 1)) : '') + (c.locked ? tag('conviction-locked') : '') + '</div>';
      h += '<div class="og1-levels"><div><i>ENTRY</i><b>' + px(c.entry) + '</b><u>' + (String(c.dir).toLowerCase() === 'long' ? 'BUY ZONE' : 'SELL ZONE') + '</u></div><div><i>STOP</i><b>' + px(c.stop) + '</b><u>SL$ ' + num(Math.abs(c.entry - c.stop)) + '</u></div><div><i>TP1</i><b>' + px(c.t1) + '</b><u>desk</u></div><div><i>TP2</i><b>' + px(c.t2) + '</b><u>desk</u></div></div>';
      h += '<div class="dim og1-card-why">' + esc(c.why || '') + '</div><div class="dim">bridged from the GOLD ' + esc(horizon) + ' desk — not scored by the 20-point matrix; run that desk for its own gates</div></div>';
    });
    return { html: h, n: n };
  }
  function hgOg1CardsHtml(runs){
    /* runs: [{ horizon, r }] — r from hgOg1Engine */
    var h = '<div class="og1-setups" data-hg-og1-setups="1">';
    (runs || []).forEach(function(run){
      var r = run.r, hz = run.horizon, ctxLabel = hz === 'SCALP' ? '1H' : '4H', tfLabel = hz === 'SCALP' ? '15m' : '1H';
      h += '<div class="og1-setups-head"><b>' + esc(hz) + ' SETUPS</b> <span class="dim">· context ' + ctxLabel + ' · execution ' + tfLabel + '</span></div>';
      var cands = (r && r.ok && Array.isArray(r.candidates)) ? r.candidates : [];
      var s0 = r && r.sections && r.sections.s0, s1 = r && r.sections && r.sections.s1;
      if (!r || !r.ok) h += '<div class="dim">DATA_UNAVAILABLE — ' + esc(r ? r.why : 'no run') + '</div>';
      else if (s0 && !s0.clear) h += '<div class="dim">VETO ACTIVE — ' + esc(s0.active.map(function(v){ return v.name; }).join(' · ')) + ' · SCORE = 0 · NO TRADE</div>';
      else if (s1 && s1.noPermitted) h += '<div class="dim">NO PERMITTED DIRECTION — ' + esc(r.sections.s3.why) + '</div>';
      else if (!cands.length) h += '<div class="dim">no swept pool on the last 4 closed ' + tfLabel + ' bars — nothing to price · next re-scan ' + esc(r.sections.s8 ? r.sections.s8.nextRescan : '') + '</div>';
      else h += cands.map(function(c){ return candCard(c, hz, ctxLabel, tfLabel); }).join('');
      var br = bridgeCards(hz);
      if (br.n) h += '<div class="dim" style="margin-top:4px">GOLD ' + esc(hz) + ' desk setups (bridged)</div>' + br.html;
    });
    h += '</div>';
    return h;
  }

  /* ================================================================== */
  /*                                TAB                                 */
  /* ================================================================== */
  var CSS = '.og1-root{margin-top:10px}.og1-head{margin-bottom:6px}.og1-sec{margin-top:10px;padding-top:6px;border-top:1px solid var(--line,#345)}'
    + '.og1-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:2px 12px;font-size:11px;margin-top:4px}'
    + '.og1-tag{display:inline-block;padding:0 5px;border:1px solid var(--line,#345);border-radius:3px;font-size:10px;margin-right:4px}'
    + '.og1-live,.og1-pass{color:var(--good,#0a7)}.og1-unavailable{opacity:.6}.og1-veto{color:var(--bad,#c33)}.og1-partial,.og1-derived{color:var(--warn,#c90)}'
    + '.og1-tbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:4px}.og1-tbl th{text-align:left;opacity:.7}.og1-tbl td{padding:1px 4px;vertical-align:top}.og1-got td{color:inherit}.og1-miss td{opacity:.75}'
    + '.og1-pre{white-space:pre-wrap;font-size:11px;margin-top:8px}.og1-inputs{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:11px;margin-top:6px}.og1-inputs input,.og1-inputs select{width:110px}.og1-inputs textarea{width:100%;min-height:54px;font-size:11px}'
    + '.og1-setups{margin-top:10px}.og1-setups-head{margin:10px 0 4px;font-size:13px}.og1-card{border:1px solid var(--line,#345);border-radius:8px;padding:8px 10px;margin:6px 0;background:var(--panel,transparent)}'
    + '.og1-card-long{border-left:3px solid var(--good,#0a7)}.og1-card-short{border-left:3px solid var(--bad,#c33)}.og1-card-q{box-shadow:0 0 0 1px var(--good,#0a7) inset}.og1-card-bridge{opacity:.9;border-style:dashed}'
    + '.og1-card-head{font-size:13px}.og1-dir{display:inline-block;padding:0 6px;border-radius:4px;background:var(--line,#345)}.og1-card-chips{margin:4px 0}.og1-card-why{margin-top:3px}'
    + '.og1-levels{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0;font-size:11px}.og1-levels div{display:flex;flex-direction:column}.og1-levels i{opacity:.6;font-style:normal;font-size:10px}.og1-levels b{font-size:14px}.og1-levels u{text-decoration:none;opacity:.7;font-size:10px}'
    + '.og1-tag.og1-qualifies{color:var(--good,#0a7);font-weight:700}.og1-tag.og1-halfsize{color:var(--warn,#c90);font-weight:700}.og1-tag.og1-held{color:var(--warn,#c90)}.og1-tag.og1-nosetup{opacity:.7}'
    + '.og1-hz{margin-top:12px}.og1-hz summary{cursor:pointer;font-weight:700}';
  var __st = { busy: false, ui: null, last: null, hasRun: false };
  function lsGet(k, d){ try{ var v = W.localStorage && W.localStorage.getItem(k); return v == null ? d : v; }catch(e){ return d; } }
  function lsSet(k, v){ try{ if (W.localStorage) W.localStorage.setItem(k, String(v)); }catch(e){} }
  function readInputs(ui){
    var o = {};
    if (!ui) return o;
    o.equity = fin(ui.equity && ui.equity.value); o.baseRiskPct = fin(ui.risk && ui.risk.value);
    o.trader = ui.trader && ui.trader.value ? (ui.trader.value === 'REVIEW_ONLY' ? { reviewOnly: true, OVR: 'REVIEW_ONLY' } : ui.trader.value === 'REDUCED' ? { reduced: true, LOAD: 'REDUCED' } : { PDI: 'GREEN' }) : {};
    o.stopsToday = fin(ui.stops && ui.stops.value);
    try{ var j = ui.extra && ui.extra.value ? JSON.parse(ui.extra.value) : null; if (j && typeof j === 'object') Object.assign(o, j); }catch(e){ o.__extraErr = 'DATA BLOCK is not valid JSON — ignored'; }
    return o;
  }
  async function loadInputs(ui, setStat){
    var inp = readInputs(ui), waits = [];
    function race(p, ms){ return Promise.race([Promise.resolve().then(function(){ return p(); }), new Promise(function(r){ setTimeout(function(){ r(null); }, ms); })]).catch(function(){ return null; }); }
    setStat('loading 400 × 1H · 200 × 15m · 4H · macro · calendar · perp…');
    var l1 = gfn('hgGoldSevenStepLoad1h'), xau = gfn('getXAUCandles'), ggc = gfn('getGoldCandles');
    waits.push(race(function(){ return l1 ? l1(400) : null; }, 15000).then(function(r){ if (r && r.rows){ inp.rows1h = r.rows; inp.feed = r.source; inp.basisPct = r.basisPct; } }));
    waits.push(race(function(){ return xau ? xau('15m', 200, { preferDeltaXaut: true }) : (ggc ? ggc('15m', 200).then(function(x){ return x && x.rows; }) : null); }, 15000).then(function(rows){ if (rows && rows.length) inp.rows15m = rows; }));
    waits.push(race(function(){ return xau ? xau('4h', 220, { preferDeltaXaut: true }) : (ggc ? ggc('4h', 220).then(function(x){ return x && x.rows; }) : null); }, 15000).then(function(rows){ if (rows && rows.length) inp.rows4h = rows; }));
    var gm = gfn('getGoldMacro'); if (gm) waits.push(race(gm, 12000).then(function(m){ if (m) inp.macro = m; }));
    var lp = gfn('hgGoldLoadDeltaPerp'); if (lp) waits.push(race(function(){ return lp({ symbol: 'XAUTUSD', resolution: '1h' }); }, 8000).then(function(j){ if (j && j.ok) inp.perpNative = j; }));
    var bf = gfn('binanceFunding'); if (bf) waits.push(race(function(){ return bf('PAXGUSDT'); }, 8000).then(function(f){ if (f && has(f.fundingPct)) inp.fundingRate = f.fundingPct; }));
    var lf = gfn('hgGoldLoadFedCalendar'), mf = gfn('hgGoldMergeFedFomc'), ns = gfn('hgNewsState');
    var news = null; try{ news = ns ? ns() : null; }catch(e){}
    if (lf) waits.push(race(lf, 8000).then(function(j){ if (j && j.ok && mf) news = mf(news || {}, j); }));
    await Promise.all(waits);
    inp.news = news;
    try{ var q = W.__hgGoldQuote; if (q){ inp.bid = q.bid; inp.ask = q.ask; inp.spreadUsd = q.spreadUsd; } if (has(W.__hgGoldSpreadUsd) && !has(inp.spreadUsd)) inp.spreadUsd = W.__hgGoldSpreadUsd; }catch(e){}
    try{ var tf = gfn('hgGoldUniformTape'); if (tf && inp.rows4h) inp.tape = tf(G7().closedRows(inp.rows4h, H4, Date.now())); }catch(e){}
    inp.venue = (inp.feed === 'delta-xaut') ? 'Delta XAUTUSD' : (inp.venue || 'Delta XAUTUSD');
    if (inp.feed === 'delta-xaut') inp.basisPct = NaN;
    inp.now = Date.now();
    return inp;
  }
  async function runScan(ui){
    if (__st.busy) return 'busy';
    __st.busy = true;
    var setStat = function(t){ if (ui && ui.stat) ui.stat.textContent = t; };
    try{
      if (ui && ui.btn) ui.btn.disabled = true;
      var inp = await loadInputs(ui, setStat);
      setStat('scoring SWING (4H/1H) and SCALP (1H/15m) setups…');
      var rSwing = hgOg1Engine(Object.assign({}, inp, { horizon: 'SWING' }));
      var rScalp = hgOg1Engine(Object.assign({}, inp, { horizon: 'SCALP' }));
      var r = rSwing;
      __st.last = r; __st.lastScalp = rScalp; __st.hasRun = true;
      if (ui && ui.out){
        ui.out.innerHTML = hgOg1CardsHtml([{ horizon: 'SWING', r: rSwing }, { horizon: 'SCALP', r: rScalp }])
          + '<details class="og1-hz" open><summary>SWING — Sections 0–8 (4H context · 1H execution)</summary>' + hgOg1Html(rSwing) + '</details>'
          + '<details class="og1-hz"><summary>SCALP — Sections 0–8 (1H context · 15m execution)</summary>' + hgOg1Html(rScalp) + '</details>';
      }
      function lineOf(x, hz){ return hz + ' ' + (x.ok ? ((x.sections.s0 && x.sections.s0.clear ? 'veto clear · ' : 'VETO ACTIVE · ') + (x.sections.s3 ? x.sections.s3.decision : '') + ' · ' + ((x.candidates || []).length) + ' setup(s)') : 'DATA_UNAVAILABLE — ' + x.why); }
      setStat(lineOf(rSwing, 'SWING') + ' | ' + lineOf(rScalp, 'SCALP') + (inp.__extraErr ? ' · ' + inp.__extraErr : '') + ' · ' + new Date().toISOString().slice(11, 19) + ' UTC');
      try{ W.__hgOg1Last = r; W.__hgOg1LastScalp = rScalp; }catch(e){}
      return 'refreshed';
    }catch(e){ setStat('scan failed: ' + (e && e.message ? e.message : String(e))); return 'error: ' + (e && e.message); }
    finally{ __st.busy = false; if (ui && ui.btn) ui.btn.disabled = false; }
  }
  function mount(el){
    if (!el) return;
    el.innerHTML = '<style>' + CSS + '</style>'
      + '<div class="panel"><h2>OMNIGOLD 1 <span>institutional gold setup engine · SCALP (1H/15m) + SWING (4H/1H) setups · veto stack → regime → 20-point matrix → strategy → levels → V-Mod size → 12-gate cross-check → trigger</span></h2>'
      + '<div class="row"><button class="btn" id="og1Run">RUN SCAN</button> <span class="note" id="og1Stat">idle — Sections 0–8 print in order; closed candles only; unavailable data is named, never estimated; no win-rate or probability anywhere.</span></div>'
      + '<div class="og1-inputs"><label>Account $ <input id="og1Equity" type="number" step="100" value="' + esc(lsGet('hg_gold_equity', '')) + '"></label>'
      + '<label>Base risk % <input id="og1Risk" type="number" step="0.1" value="' + esc(lsGet('hg_og1_risk', '1')) + '"></label>'
      + '<label>Trader state <select id="og1Trader"><option>FULL</option><option>REDUCED</option><option>REVIEW_ONLY</option></select></label>'
      + '<label>Stops today <input id="og1Stops" type="number" step="1" value="' + esc(lsGet('hg_og1_stops', '0')) + '"></label>'
      + '<details style="width:100%"><summary class="dim">DATA BLOCK (optional JSON for feeds the app cannot fetch: gvz, rv20, cotPct, realYield5d, twoYDelta, fedwatchDelta, cvd15m, cvdSource, spreadAvgHour, ogWalls, weekly{shanghai,india,comexReg,cbRegime,gldFlow,gsRatioDir}, xag, gdxRs, ml{dir,barAge,name}, hourHist, weeklyLossPct, dd95, illiqPct)</summary>'
      + '<textarea id="og1Extra" placeholder=\'{"gvz": 18.2, "cotPct": 74, "realYield5d": [1.92,1.9,1.88,1.85,1.83]}\'>' + esc(lsGet('hg_og1_extra', '')) + '</textarea></details></div>'
      + '</div><div id="og1Out"></div>';
    var ui = { btn: el.querySelector('#og1Run'), stat: el.querySelector('#og1Stat'), out: el.querySelector('#og1Out'), equity: el.querySelector('#og1Equity'), risk: el.querySelector('#og1Risk'), trader: el.querySelector('#og1Trader'), stops: el.querySelector('#og1Stops'), extra: el.querySelector('#og1Extra') };
    try{ ui.trader.value = lsGet('hg_og1_trader', 'FULL'); }catch(e){}
    __st.ui = ui;
    if (ui.btn) ui.btn.addEventListener('click', function(){ return runScan(ui); });
    [['equity', 'hg_gold_equity'], ['risk', 'hg_og1_risk'], ['trader', 'hg_og1_trader'], ['stops', 'hg_og1_stops'], ['extra', 'hg_og1_extra']].forEach(function(p){ var n = ui[p[0]]; if (n) n.addEventListener('change', function(){ lsSet(p[1], n.value); }); });
  }
  async function refresh(){
    if (__st.busy) return 'busy';
    if (!__st.ui) return 'skipped: not mounted';
    return runScan(__st.ui);
  }

  W.hgOg1Engine = hgOg1Engine;
  W.hgOg1Html = hgOg1Html;
  W.hgOg1Text = hgOg1Text;
  W.hgOg1CardsHtml = hgOg1CardsHtml;
  W.omnigold1ScalpState = function(){ return __st.lastScalp; };
  W.hgOg1RunScan = function(){ return __st.ui ? runScan(__st.ui) : Promise.resolve('skipped: not mounted'); };
  W.omnigold1State = function(){ return __st.last; };
  W.HG_OG1_CLASS_OF = CLASS_OF;
  W.HG_OG1_NAME_OF = NAME_OF;
  W.HG_tabs = W.HG_tabs || [];
  W.HG_tabs.push({ id: 'omnigold1', label: 'OMNIGOLD 1', mount: mount, refresh: refresh });
})(typeof window !== 'undefined' ? window : globalThis);
