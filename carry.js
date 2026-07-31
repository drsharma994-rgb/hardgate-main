/* =========================================================================
HARDGATE — carry.js
Delta-neutral funding carry scanner.

LEG A (Binance USD-M perps): all-symbols /fapi/v1/premiumIndex, top 30 by
  |lastFundingRate| with >= $20M 24h turnover (join binanceTickers24h), then
  /fapi/v1/fundingRate?limit=30 per symbol -> avg % per funding print ->
  APR = avg * (24/intervalHours) * 365. intervalHours comes from
  binanceFundingInfo() (/fapi/v1/fundingInfo): Binance perps settle funding
  every 1h/4h/8h per symbol, so the old hardcoded 3*365 was wrong on every
  non-8h perp. Symbols missing from fundingInfo default to 8h and are
  labeled '(assumed 8h)'. When |current rate| > 80% of the adjusted funding
  cap the card/row is flagged 'at cap — squeeze crowded'.
LEG B (Delta India): /v2/tickers?contract_types=perpetual_futures —
  funding_rate is ALREADY percent units per 8h interval (NO *100, same
  convention as the index.html Delta adapter). APR = rate*3*365.
Symbols matched by base asset (BTCUSD ~ BTCUSDT; strip USD/USDT suffix).
Cross-venue cards when |deltaAPR - binanceAPR| >= 25%: short the perp on the
higher-funding venue, long the perp on the lower one, collect the spread.

Classic script, IIFE. Exposes ONLY window.carrySpread / window.carryAnnualize /
window.carrySpreadInt (pure, for tests) and the window.HG_tabs registration.
Never throws at load time; every external global is feature-checked; every
fetch has a 12s AbortController timeout and resolves null on failure; bulk
per-symbol fetches paced in chunks of 5.

Hard refresh (index.html hardRefreshAll): the registration carries refresh()
per the house contract — async, NEVER throws, terse status string. It re-runs
the same two-leg scan the RUN CARRY SCAN button triggers (the module's 60s
data caches still apply — refresh re-runs the pipeline, not a cache flush);
before the first user run it reports 'skipped: not run yet' (a global refresh
must never trigger an expensive first-time scan on its own), and while a scan
is in flight it reports 'busy' (overlaps never double-fetch).
========================================================================= */
'use strict';

(function(){

  /* ============================ pure core ============================ */
  /* Both inputs are funding rates in PERCENT units per 8h interval.
     APR = rate * 3 * 365 (three 8h funding prints per day).
     Carry construction: SHORT the perp on the venue with the HIGHER rate
     (collect its funding), LONG the perp on the LOWER-rate venue — the
     spread captured per 8h is |rDelta - rBinance| regardless of signs
     (a long on a negative-funding venue also collects). Ties break to
     'delta' deterministically. Returns null on any non-finite input. */
  function carrySpread(deltaRatePct8h, binanceRatePct8h){
    if (typeof deltaRatePct8h !== 'number' || typeof binanceRatePct8h !== 'number') return null;
    if (!isFinite(deltaRatePct8h) || !isFinite(binanceRatePct8h)) return null;
    const deltaAPR = deltaRatePct8h * 3 * 365;
    const binanceAPR = binanceRatePct8h * 3 * 365;
    const spreadAPR = Math.abs(deltaAPR - binanceAPR);
    const shortVenue = (deltaAPR >= binanceAPR) ? 'delta' : 'binance';
    const longVenue = (shortVenue === 'delta') ? 'binance' : 'delta';
    return { deltaAPR: deltaAPR, binanceAPR: binanceAPR, spreadAPR: spreadAPR, shortVenue: shortVenue, longVenue: longVenue };
  }

  /* APR annualization is per-symbol: a funding print lands every
     intervalHours (1h/4h/8h per /fapi/v1/fundingInfo), so
     APR = ratePerPrint * (24/intervalHours) * 365.
     e.g. 0.01% per print -> 10.95% APR on an 8h perp, 21.9% on a 4h perp.
     Returns null on any non-finite input or a non-positive interval. */
  function carryAnnualize(ratePctPerPrint, intervalHours){
    if (typeof ratePctPerPrint !== 'number' || typeof intervalHours !== 'number') return null;
    if (!isFinite(ratePctPerPrint) || !isFinite(intervalHours) || intervalHours <= 0) return null;
    return ratePctPerPrint * (24/intervalHours) * 365;
  }

  /* Interval-aware carrySpread: same construction and same result shape,
     but the binance leg is a PER-PRINT rate annualized with the symbol's
     own funding interval. The delta leg stays 8h (Delta India convention).
     carrySpread(a, b) === carrySpreadInt(a, b, 8) — the 8h case is unchanged. */
  function carrySpreadInt(deltaRatePct8h, binanceRatePctPerPrint, binanceIntervalHours){
    if (typeof deltaRatePct8h !== 'number' || typeof binanceRatePctPerPrint !== 'number') return null;
    if (!isFinite(deltaRatePct8h) || !isFinite(binanceRatePctPerPrint)) return null;
    const binanceAPR = carryAnnualize(binanceRatePctPerPrint, binanceIntervalHours);
    if (binanceAPR === null) return null;
    const deltaAPR = deltaRatePct8h * 3 * 365;
    const spreadAPR = Math.abs(deltaAPR - binanceAPR);
    const shortVenue = (deltaAPR >= binanceAPR) ? 'delta' : 'binance';
    const longVenue = (shortVenue === 'delta') ? 'binance' : 'delta';
    return { deltaAPR: deltaAPR, binanceAPR: binanceAPR, spreadAPR: spreadAPR, shortVenue: shortVenue, longVenue: longVenue };
  }

  /* Generalized two-venue carry spread. Rates are percent per print at each
     venue's own funding interval. Adds aprA/aprB + pair label; legacy
     deltaAPR/binanceAPR aliases when the pair is delta↔binance. */
  function carrySpreadPair(rateA, rateB, venueA, venueB, intervalHoursA, intervalHoursB){
    if (typeof rateA !== 'number' || typeof rateB !== 'number') return null;
    if (!isFinite(rateA) || !isFinite(rateB)) return null;
    const aprA = carryAnnualize(rateA, intervalHoursA);
    const aprB = carryAnnualize(rateB, intervalHoursB);
    if (aprA === null || aprB === null) return null;
    const spreadAPR = Math.abs(aprA - aprB);
    const shortVenue = (aprA >= aprB) ? venueA : venueB;
    const longVenue = (shortVenue === venueA) ? venueB : venueA;
    const out = {
      aprA: aprA, aprB: aprB, spreadAPR: spreadAPR,
      shortVenue: shortVenue, longVenue: longVenue,
      venueA: venueA, venueB: venueB, pair: venueA + '-' + venueB
    };
    if (venueA === 'delta' && venueB === 'binance'){ out.deltaAPR = aprA; out.binanceAPR = aprB; }
    else if (venueA === 'binance' && venueB === 'delta'){ out.deltaAPR = aprB; out.binanceAPR = aprA; }
    else if (venueA === 'bybit' && venueB === 'binance'){ out.bybitAPR = aprA; out.binanceAPR = aprB; }
    else if (venueA === 'binance' && venueB === 'bybit'){ out.bybitAPR = aprB; out.binanceAPR = aprA; }
    return out;
  }

  /* Bybit funding cross-check on an existing Binance↔Delta spread card. */
  function carryBybitCrossCheck(sp, bybitPct8h){
    try{
      if (!sp || typeof bybitPct8h !== 'number' || !isFinite(bybitPct8h)){
        return { status: 'bybit-dark', bybitAPR: null, note: 'Bybit funding unavailable for cross-check' };
      }
      const bybitAPR = carryAnnualize(bybitPct8h, 8);
      if (bybitAPR === null){
        return { status: 'bybit-dark', bybitAPR: null, note: 'Bybit funding unavailable for cross-check' };
      }
      const binAPR = sp.binanceAPR, delAPR = sp.deltaAPR;
      if (!isFinite(binAPR) || !isFinite(delAPR)){
        return { status: 'neutral', bybitAPR: bybitAPR, note: 'Bybit APR ~' + F(bybitAPR, 1) + '%' };
      }
      const hi = Math.max(binAPR, delAPR, bybitAPR);
      const lo = Math.min(binAPR, delAPR, bybitAPR);
      if (bybitAPR >= hi - 0.01){
        return { status: 'conflicts', bybitAPR: bybitAPR,
          note: 'Bybit is the richest leg (~' + F(bybitAPR, 1) + '% APR) — best short may be Bybit, not this card' };
      }
      if (bybitAPR <= lo + 0.01){
        return { status: 'conflicts', bybitAPR: bybitAPR,
          note: 'Bybit is the cheapest leg (~' + F(bybitAPR, 1) + '% APR) — best long may be Bybit, not this card' };
      }
      return { status: 'confirms', bybitAPR: bybitAPR,
        note: 'Bybit APR ~' + F(bybitAPR, 1) + '% sits between Delta and Binance — spread direction holds' };
    }catch(e){ return { status: 'bybit-dark', bybitAPR: null, note: 'Bybit cross-check error' }; }
  }

  function __venueSym(c, venue){
    if (venue === 'delta') return (c.del && c.del.symbol) ? c.del.symbol : '—';
    if (venue === 'bybit') return (c.byb && c.byb.symbol) ? c.byb.symbol : ((c.bin && c.bin.symbol) ? c.bin.symbol : '—');
    return (c.bin && c.bin.symbol) ? c.bin.symbol : '—';
  }

  /* ================== per-card execution levels (SL/TP audit) ==================
     carryPlan({entry, atr, spreadAPR, intervalHours}) -> levels | null.
       ENTRY  : delta-neutral pair at the reference mark (binance leg), equal
                notional on both legs.
       STOP   : 'funding flip + price invalidation' — an adverse 2xATR(4h) move
                on the reference leg invalidates the price hedge
                (stopShort = entry + 2*ATR for the SHORT perp leg,
                 stopLong  = entry - 2*ATR for the LONG perp leg),
                OR the funding sign flips at the next print -> exit both legs.
       T1/T2  : funding-capture horizons (7d / 30d of spreadAPR) converted to
                price equivalents via the reference mark, also expressed in
                ATR multiples.
     Strict number typing (same discipline as carrySpread); null on any
     degenerate input; never throws. */
  const CARRY_STOP_ATR = 2, CARRY_T1_DAYS = 7, CARRY_T2_DAYS = 30;
  function carryPlan(inp){
    try{
      if (!inp || typeof inp !== 'object') return null;
      const entry = inp.entry, at = inp.atr, spr = inp.spreadAPR, ivl = inp.intervalHours;
      if (typeof entry !== 'number' || typeof at !== 'number' ||
          typeof spr !== 'number' || typeof ivl !== 'number') return null;
      if (!isFinite(entry) || !isFinite(at) || !isFinite(spr) || !isFinite(ivl)) return null;
      if (!(entry > 0) || !(at > 0) || !(spr > 0) || !(ivl > 0)) return null;
      const stopShort = entry + CARRY_STOP_ATR * at;
      const stopLong = entry - CARRY_STOP_ATR * at;
      const t1CapturePct = spr * CARRY_T1_DAYS / 365;   // % of notional
      const t2CapturePct = spr * CARRY_T2_DAYS / 365;
      const t1Px = entry * t1CapturePct / 100;          // price-equivalent per unit
      const t2Px = entry * t2CapturePct / 100;
      return {
        entry: entry, atr: at,
        stopShort: stopShort, stopLong: stopLong, stopAtrMult: CARRY_STOP_ATR,
        t1Days: CARRY_T1_DAYS, t2Days: CARRY_T2_DAYS,
        t1CapturePct: t1CapturePct, t2CapturePct: t2CapturePct,
        t1Px: t1Px, t2Px: t2Px,
        t1Atr: t1Px / at, t2Atr: t2Px / at
      };
    }catch(e){ return null; }
  }

  /* ============================ config ============================ */
  const BINANCE_FAPI = 'https://fapi.binance.com';
  const DELTA_API = 'https://api.india.delta.exchange';
  const TOP_N = 30;               // top |lastFundingRate| perps to deep-scan
  const MIN_TURNOVER_USD = 20e6;  // 24h quote-volume gate
  const SPREAD_MIN_APR = 25;      // cross-venue card threshold (% APR)
  const LIST_N = 12;              // rows in the binance-only payers table
  const HIST_LIMIT = 30;          // funding prints per symbol (~10 days of 8h)
  const CHUNK = 5, CHUNK_SLEEP_MS = 250;
  const FETCH_TIMEOUT_MS = 12000;
  const CACHE_MS = 60*1000;

  /* ================ tiny net layer (binance.js discipline) ================ */
  const __cache = new Map();
  function __cget(k){ const h = __cache.get(k); return (h && (Date.now() - h.at) < CACHE_MS) ? h.val : undefined; }
  function __cput(k, v){ if (v !== null && v !== undefined) __cache.set(k, { at: Date.now(), val: v }); return v; }

  async function __fetchJson(url){
    const ctrl = new AbortController();
    const timer = setTimeout(function(){ ctrl.abort(); }, FETCH_TIMEOUT_MS);
    try{
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      return await res.json();
    }catch(e){ return null; }
    finally{ clearTimeout(timer); }
  }
  function __sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  /* ============ formatters — feature-checked against index.html ============
     px/fmt/pct are consts in the inline script; resolve lazily at call time
     so load order vs this file does not matter. */
  function F(n, d){
    if (typeof fmt === 'function') return fmt(n, d);
    d = (d === undefined) ? 2 : d;
    return (n === null || n === undefined || !isFinite(n)) ? '—' : (+n).toFixed(d);
  }
  function P(n, d){ // signed percent
    if (typeof pct === 'function') return pct(n, d);
    d = (d === undefined) ? 3 : d;
    return isFinite(n) ? ((n >= 0 ? '+' : '') + (+n).toFixed(d) + '%') : '—';
  }
  function FP(n){ // adaptive price format for execution levels
    if (typeof px === 'function'){ try{ return px(n); }catch(e){} }
    if (n === null || n === undefined || !isFinite(n)) return '—';
    const a = Math.abs(n);
    const d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
  }
  function esc(s){
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function __baseOf(sym){
    return String(sym).toUpperCase().replace(/USDT$/, '').replace(/USD$/, '');
  }

  /* ============================ data legs ============================ */
  /* LEG A step 1: all-symbols premiumIndex -> map sym -> {pct8h, mark, nextFundingTime} */
  async function __binancePremiumAll(){
    const hit = __cget('premiumAll'); if (hit !== undefined) return hit;
    const j = await __fetchJson(BINANCE_FAPI + '/fapi/v1/premiumIndex');
    if (!Array.isArray(j)) return null;
    const map = {};
    for (let i = 0; i < j.length; i++){
      const d = j[i];
      if (!d || !d.symbol) continue;
      const r = +d.lastFundingRate;
      if (!isFinite(r)) continue;
      map[d.symbol] = { pct8h: r*100, mark: +d.markPrice, nextFundingTime: +d.nextFundingTime };
    }
    return __cput('premiumAll', map);
  }

  /* LEG A step 2 (per symbol): funding history -> avg8hPct over <=30 prints */
  async function __binanceFundingAvg(symbol){
    const key = 'fhist|' + symbol;
    const hit = __cget(key); if (hit !== undefined) return hit;
    const j = await __fetchJson(BINANCE_FAPI + '/fapi/v1/fundingRate?symbol=' +
                                encodeURIComponent(symbol) + '&limit=' + HIST_LIMIT);
    if (!Array.isArray(j) || !j.length) return null;
    let sum = 0, n = 0;
    for (let i = 0; i < j.length; i++){
      const r = +j[i].fundingRate;
      if (isFinite(r)){ sum += r; n++; }
    }
    if (!n) return null;
    return __cput(key, { avg8hPct: (sum/n)*100, prints: n });
  }

  /* LEG B: Delta India perp tickers -> map BASE -> {symbol, pct8h, turnoverUsd}
     funding_rate is already percent units per 8h interval — NO *100. */
  async function __deltaPerps(){
    const hit = __cget('deltaPerps'); if (hit !== undefined) return hit;
    const j = await __fetchJson(DELTA_API + '/v2/tickers?contract_types=perpetual_futures');
    if (!j || !Array.isArray(j.result)) return null;
    const map = {};
    for (let i = 0; i < j.result.length; i++){
      const t = j.result[i];
      if (!t || !t.symbol) continue;
      const fr = (t.funding_rate !== undefined && t.funding_rate !== null) ? parseFloat(t.funding_rate) : NaN;
      if (!isFinite(fr)) continue;
      map[__baseOf(t.symbol)] = {
        symbol: t.symbol,
        pct8h: fr,
        turnoverUsd: parseFloat(t.turnover_usd !== undefined && t.turnover_usd !== null ? t.turnover_usd : (t.turnover || 0))
      };
    }
    return __cput('deltaPerps', map);
  }

  /* ============================ rendering ============================ */
  function __prog(ui, f){
    if (!ui.prog) return;
    ui.prog.style.display = (f === null) ? 'none' : 'block';
    const bar = ui.prog.firstElementChild;
    if (bar && bar.style && f !== null) bar.style.width = (f*100).toFixed(1) + '%';
  }
  function __warn(ui, msg){
    if (!ui.warn) return;
    ui.warn.textContent = msg;
    ui.warn.style.display = 'block';
  }
  function __showEmpty(ui, msg){
    if (!ui.empty) return;
    ui.empty.textContent = msg;
    ui.empty.style.display = 'block';
  }

  function __renderCards(ui, cards){
    if (!cards.length){
      ui.cards.innerHTML = '';
      __showEmpty(ui, 'no cross-venue funding spreads ≥ ' + SPREAD_MIN_APR + '% APR right now — binance-only payers below.');
      return;
    }
    ui.empty.style.display = 'none';
    ui.cards.innerHTML = cards.map(function(c){
      const hi = c.sp.shortVenue, lo = c.sp.longVenue;
      const hiSym = __venueSym(c, hi), loSym = __venueSym(c, lo);
      const pairLbl = (c.pair === 'bin-bybit') ? 'BINANCE↔BYBIT'
        : (c.pair === 'delta-bybit') ? 'DELTA↔BYBIT'
        : 'BINANCE↔DELTA';
      const ivl = c.bin.intervalHours;
      const settleTxt = ivl + 'h settle' + (c.bin.intervalAssumed ? ' (assumed 8h)' : '');
      const spreadPerDayPct = c.sp.spreadAPR / 365;
      const feeRt = 0.2;
      const daysToCover = (spreadPerDayPct > 0) ? feeRt/spreadPerDayPct : NaN;
      const mini = [
        ['spread APR', '~' + F(c.sp.spreadAPR, 1) + '%'],
        ['pair', pairLbl]
      ];
      if (c.pair === 'bin-delta'){
        mini.push(['delta APR (current)', F(c.sp.deltaAPR, 1) + '%']);
        mini.push(['binance APR (avg ' + c.bin.prints + 'F)', F(c.sp.binanceAPR, 1) + '%']);
        mini.push(['delta 8h now', P(c.del.pct8h, 4)]);
      } else if (c.pair === 'bin-bybit'){
        mini.push(['bybit APR (current)', F(c.sp.bybitAPR, 1) + '%']);
        mini.push(['binance APR (avg ' + c.bin.prints + 'F)', F(c.sp.binanceAPR, 1) + '%']);
        mini.push(['bybit 8h now', P(c.byb.pct8h, 4)]);
      } else if (c.pair === 'delta-bybit'){
        mini.push(['delta APR (current)', F(c.sp.deltaAPR, 1) + '%']);
        mini.push(['bybit APR (current)', F(c.sp.bybitAPR, 1) + '%']);
        mini.push(['delta 8h now', P(c.del.pct8h, 4)]);
        mini.push(['bybit 8h now', P(c.byb.pct8h, 4)]);
      }
      mini.push(['binance ' + ivl + 'h now', P(c.bin.cur8hPct, 4)]);
      mini.push(['binance avg ' + ivl + 'h', P(c.bin.avg8hPct, 4)]);
      mini.push(['binance settle', settleTxt]);
      if (c.bin.atCap) mini.push(['funding cap', 'at cap — squeeze crowded']);
      if (c.bybitCross && c.bybitCross.note) mini.push(['bybit cross', c.bybitCross.note]);
      const gates = ['spread ≥ ' + SPREAD_MIN_APR + '% APR', 'delta-neutral',
                     ivl + 'h × ' + (24/ivl) + ' × 365' + (c.bin.intervalAssumed ? ' (assumed)' : '')];
      const plan = 'SHORT perp on <b>' + hi.toUpperCase() + '</b> (' + esc(hiSym) + ') + LONG perp on <b>' +
        lo.toUpperCase() + '</b> (' + esc(loSym) + ') · collect ~<b>' + F(c.sp.spreadAPR, 1) +
        '% APR</b> spread, equal notional on both legs. ' +
        'Risks: <b>basis risk</b> — the two venues’ marks can drift apart · <b>fees ~0.05%/side/entry</b> ' +
        '(≈0.2% round trip both legs' + (isFinite(daysToCover) ? ', ~' + F(daysToCover, 1) + ' days of spread to cover' : '') + ') · ' +
        '<b>funding flips</b> — either leg’s rate can change or invert at the next ' + ivl + 'h print, re-check before every settlement · ' +
        '<b>venue counterparty risk</b> — the delta leg sits on Delta India. Not a signal — size and margin both legs yourself.';
      /* SL/TP audit: per-carry-plan execution levels. ENTRY = both legs at the
         reference mark; STOP = 2×ATR(4h) price invalidation OR funding sign
         flip; T1/T2 = 7d/30d funding capture in price + ATR equivalents. */
      const lv = c.levels || null;
      const lvTxt = lv
        ? 'LEVELS — ENTRY short <b>' + esc(hiSym) + '</b> + long <b>' + esc(loSym) + '</b>, equal notional @ ref ' + FP(lv.entry)
          + ' · STOP <b>' + FP(lv.stopShort) + '</b> short leg / <b>' + FP(lv.stopLong) + '</b> long leg'
          + ' — adverse 2×ATR(4h) move = price invalidation; funding sign flip at the next ' + ivl + 'h print = exit both legs'
          + ' · T1 ' + lv.t1Days + 'd capture ≈ <b>' + F(lv.t1CapturePct, 2) + '%</b> ≈ ' + FP(lv.t1Px) + ' ≈ ' + F(lv.t1Atr, 1) + '×ATR'
          + ' · T2 ' + lv.t2Days + 'd capture ≈ <b>' + F(lv.t2CapturePct, 2) + '%</b> ≈ ' + FP(lv.t2Px) + ' ≈ ' + F(lv.t2Atr, 1) + '×ATR'
        : 'LEVELS unavailable — 4h candles or the ATR layer are missing for ' + esc(c.bin.symbol)
          + '; funding-capture horizons and price invalidation cannot be quantified.';
      return '<div class="card long">'
        + '<div class="chead"><span class="sym">' + esc(c.base) + '</span><span class="dir">CARRY · ' + esc(pairLbl) + '</span></div>'
        + '<div class="mini">' + mini.map(function(kv){ return '<span class="k">' + kv[0] + '</span><span>' + kv[1] + '</span>'; }).join('') + '</div>'
        + '<div class="gates">' + gates.map(function(g){ return '<span class="gpip ok">' + g + '</span>'; }).join('') + '</div>'
        + '<div class="plan">' + plan + '</div>'
        + '<div class="plan">' + lvTxt + '</div>'
        + '</div>';
    }).join('');
  }

  function __renderTable(ui, list){
    if (!list.length){
      ui.tableWrap.innerHTML = '<div class="empty">no binance funding payers found.</div>';
      return;
    }
    let h = '<div class="note" style="margin:2px 0 6px"><b>BINANCE-ONLY</b> · top |APR| payers — positive funding means longs pay shorts: ' +
            'collect by <b>shorting perp (delta-neutral: long spot)</b>; negative funding: collect by longing perp + short spot.</div>';
    h += '<table><thead><tr><th>SYMBOL</th><th>PRINT %</th><th>APR</th><th>AVG APR · ' + HIST_LIMIT + 'F</th><th>RETAIL LONG</th></tr></thead><tbody>';
    for (let i = 0; i < list.length; i++){
      const r = list[i];
      const apr = carryAnnualize(r.cur8hPct, r.intervalHours);
      const avgApr = (r.avg8hPct !== null) ? carryAnnualize(r.avg8hPct, r.intervalHours) : null;
      h += '<tr><td>' + esc(r.symbol) + ' (' + r.intervalHours + 'h' + (r.intervalAssumed ? '*' : '') + ')' +
             (r.atCap ? ' ⚠' : '') + '</td>'
        + '<td class="' + (r.cur8hPct >= 0 ? 'pos' : 'neg') + '">' + P(r.cur8hPct, 4) + '</td>'
        + '<td>' + F(apr, 1) + '%</td>'
        + '<td>' + (avgApr === null ? 'n/a' : F(avgApr, 1) + '%') + '</td>'
        + '<td>' + (r.retailLongPct === null ? 'n/a' : F(r.retailLongPct, 1) + '%') + '</td></tr>';
    }
    h += '</tbody></table>';
    h += '<div class="note" style="margin-top:6px">APR = per-print funding rate × (24 ÷ funding interval) × 365 · interval from ' +
         '/fapi/v1/fundingInfo (* = assumed 8h) · ⚠ at cap — squeeze crowded = |current funding| above 80% of the adjusted funding rate cap · ' +
         'AVG = mean of the last ' + HIST_LIMIT + ' funding prints · ' +
         'retail long = binance global long/short account ratio, latest print.</div>';
    ui.tableWrap.innerHTML = h;
  }

  /* ============================ the scan ============================ */
  async function runCarryScan(ui){
    if (!ui) return 'skipped: no ui';
    if (__carry.busy) return 'busy';
    __carry.busy = true;
    __carry.ranOnce = true;
    __carry.ui = ui;
    var status = 'refreshed';
    ui.btn.disabled = true;
    ui.warn.style.display = 'none'; ui.warn.textContent = '';
    ui.empty.style.display = 'none';
    ui.cards.innerHTML = ''; ui.tableWrap.innerHTML = '';
    ui.prog.style.display = 'block'; __prog(ui, 0);
    const setStat = function(s){ ui.stat.textContent = s; };
    let failures = 0;
    const warnMsgs = [];
    try{
      if (typeof fetch !== 'function' || typeof AbortController !== 'function'){
        __warn(ui, 'fetch/AbortController unavailable in this browser — carry scan cannot run.');
        setStat('aborted — no fetch layer');
        status = 'failed: no fetch layer';
        return status;
      }

      /* ---- LEG A: binance universe ---- */
      setStat('LEG A · binance premiumIndex (all symbols)…');
      __prog(ui, 0.05);
      const prem = await __binancePremiumAll();
      if (!prem){
        __warn(ui, 'binance premiumIndex fetch failed — check network/CORS.');
        setStat('failed at binance premiumIndex');
        status = 'failed: binance premiumIndex';
        return status;
      }

      let tickMap = null;
      if (typeof binanceTickers24h === 'function'){
        try{ tickMap = await binanceTickers24h(); }catch(e){ tickMap = null; }
        if (!tickMap) warnMsgs.push('binanceTickers24h returned nothing — $20M turnover gate skipped');
      } else {
        warnMsgs.push('binanceTickers24h global missing — $20M turnover gate skipped');
      }

      /* funding intervals/caps: global missing -> silently assume 8h per symbol
         (labeled '(assumed 8h)' on cards/rows); global present but failed -> warn. */
      let fInfo = null;
      if (typeof binanceFundingInfo === 'function'){
        try{ fInfo = await binanceFundingInfo(); }catch(e){ fInfo = null; }
        if (!fInfo) warnMsgs.push('binanceFundingInfo fetch failed — funding intervals assumed 8h, caps unavailable');
      }

      let uni = Object.keys(prem).filter(function(s){ return s.endsWith('USDT'); });
      if (tickMap){
        uni = uni.filter(function(s){
          const t = tickMap[s];
          return t && isFinite(t.turnoverUsd) && t.turnoverUsd >= MIN_TURNOVER_USD;
        });
      }
      uni.sort(function(a, b){ return Math.abs(prem[b].pct8h) - Math.abs(prem[a].pct8h); });
      const top = uni.slice(0, TOP_N);
      if (!top.length){
        setStat('no binance perps to scan');
        __showEmpty(ui, 'no binance USDT perps pass the $20M turnover gate right now.');
        __renderTable(ui, []);
        return status;
      }

      /* ---- LEG A: per-symbol funding history + retail ratio, chunked ---- */
      const rows = [];
      for (let ci = 0; ci < top.length; ci += CHUNK){
        const chunk = top.slice(ci, ci + CHUNK);
        await Promise.all(chunk.map(async function(sym){
          try{
            const hist = await __binanceFundingAvg(sym);
            let retail = null;
            if (typeof binanceLongShort === 'function'){
              try{
                const ls = await binanceLongShort(sym, '1h', 1);
                if (ls && ls.latest && isFinite(ls.latest.longPct)) retail = ls.latest.longPct;
              }catch(e){}
            }
            /* funding interval/cap for this symbol: default 8h (flagged as
               assumed) when fundingInfo has no verified entry for it */
            const fi = fInfo ? fInfo[sym] : null;
            const fiOk = !!(fi && isFinite(fi.intervalHours) && fi.intervalHours > 0);
            const intervalHours = fiOk ? fi.intervalHours : 8;
            const capPct = (fi && isFinite(fi.capPct)) ? fi.capPct : null;
            const curPct = prem[sym].pct8h; // percent units per funding print (whatever the interval)
            rows.push({
              symbol: sym, base: __baseOf(sym),
              cur8hPct: curPct,
              avg8hPct: hist ? hist.avg8hPct : null,
              prints: hist ? hist.prints : 0,
              retailLongPct: retail,
              intervalHours: intervalHours,
              intervalAssumed: !fiOk,
              capPct: capPct,
              atCap: (capPct !== null && capPct > 0 && Math.abs(curPct) > 0.8*capPct)
            });
            if (!hist) failures++;
          }catch(e){ failures++; }
        }));
        const done = Math.min(ci + CHUNK, top.length);
        setStat('LEG A · funding history ' + done + '/' + top.length + '…');
        __prog(ui, 0.05 + 0.65*(done/top.length));
        if (ci + CHUNK < top.length) await __sleep(CHUNK_SLEEP_MS);
      }

      /* ---- LEG B: delta india ---- */
      setStat('LEG B · delta india perp tickers…');
      const delta = await __deltaPerps();
      if (!delta) warnMsgs.push('delta india tickers fetch failed — cross-venue spreads unavailable (binance-only list below)');
      const bybit = (typeof bybitLinearTickersByBase === 'function') ? await bybitLinearTickersByBase() : null;
      if (!bybit && typeof bybitFunding === 'function'){
        warnMsgs.push('Bybit bulk tickers unavailable — per-card Bybit cross-check only where funding resolves');
      }
      __prog(ui, 0.85);

      /* ---- match by base asset + spread cards (best pair per base) ---- */
      const cards = [];
      const byBase = {};
      function offerCard(card){
        if (!card || !card.base || !card.sp) return;
        const prev = byBase[card.base];
        if (!prev || card.sp.spreadAPR > prev.sp.spreadAPR) byBase[card.base] = card;
      }
      let matched = 0;
      if (delta){
        for (let i = 0; i < rows.length; i++){
          const r = rows[i];
          const d = delta[r.base];
          if (!d || r.avg8hPct === null) continue;
          matched++;
          const sp = carrySpreadInt(d.pct8h, r.avg8hPct, r.intervalHours);
          if (!sp || sp.spreadAPR < SPREAD_MIN_APR) continue;
          offerCard({ base: r.base, pair: 'bin-delta', bin: r, del: d, sp: sp });
        }
      }
      if (bybit){
        for (let j = 0; j < rows.length; j++){
          const r2 = rows[j];
          const b = bybit[r2.base];
          if (!b || r2.avg8hPct === null || b.pct8h === null) continue;
          const spB = carrySpreadPair(r2.avg8hPct, b.pct8h, 'binance', 'bybit', r2.intervalHours, 8);
          if (!spB || spB.spreadAPR < SPREAD_MIN_APR) continue;
          spB.binanceAPR = spB.aprA; spB.bybitAPR = spB.aprB;
          offerCard({ base: r2.base, pair: 'bin-bybit', bin: r2, byb: b, sp: spB });
          if (delta && delta[r2.base]){
            const d2 = delta[r2.base];
            const spD = carrySpreadPair(d2.pct8h, b.pct8h, 'delta', 'bybit', 8, 8);
            if (spD && spD.spreadAPR >= SPREAD_MIN_APR){
              spD.deltaAPR = spD.aprA; spD.bybitAPR = spD.aprB;
              offerCard({ base: r2.base, pair: 'delta-bybit', bin: r2, del: d2, byb: b, sp: spD });
            }
          }
        }
      }
      for (const bk in byBase){ if (Object.prototype.hasOwnProperty.call(byBase, bk)) cards.push(byBase[bk]); }
      cards.sort(function(a, b){ return b.sp.spreadAPR - a.sp.spreadAPR; });

      if (cards.length && typeof bybitFunding === 'function'){
        for (let ci2 = 0; ci2 < cards.length; ci2 += CHUNK){
          const chunkX = cards.slice(ci2, ci2 + CHUNK);
          await Promise.all(chunkX.map(async function(c){
            if (c.pair !== 'bin-delta' || !c.bin || !c.bin.symbol) return;
            try{
              const f = await bybitFunding(c.bin.symbol);
              const pct = (f && isFinite(f.fundingPct)) ? f.fundingPct : null;
              c.bybitCross = carryBybitCrossCheck(c.sp, pct);
            }catch(e){}
          }));
          if (ci2 + CHUNK < cards.length) await __sleep(CHUNK_SLEEP_MS);
        }
      }
      /* per-card execution levels: 4h ATR on the binance leg. Feature-checked
         and silently degrading — each card states honestly when its levels
         cannot be quantified. */
      if (cards.length && typeof binanceKlines === 'function' && typeof atr === 'function'){
        await Promise.all(cards.map(async function(c){
          try{
            const kRows = await binanceKlines(c.bin.symbol, '4h', 60);
            if (kRows && kRows.length >= 20){
              const aa = atr(kRows, 14);
              const a4 = aa[aa.length - 1];
              const pm = prem[c.bin.symbol];
              const mark = (pm && isFinite(pm.mark) && pm.mark > 0) ? pm.mark
                : ((kRows[kRows.length - 1] && isFinite(kRows[kRows.length - 1].c)) ? kRows[kRows.length - 1].c : NaN);
              c.levels = carryPlan({ entry: mark, atr: a4, spreadAPR: c.sp.spreadAPR, intervalHours: c.bin.intervalHours });
            }
          }catch(e){ /* c.levels stays unset -> honest fallback on the card */ }
        }));
      }
      __carrySnap = {
        at: Date.now(),
        topSpread: cards.length ? cards[0].sp.spreadAPR : null,
        topBase: cards.length ? cards[0].base : null,
        count: cards.length
      };
      __renderCards(ui, cards);

      /* ---- binance-only payers table ---- */
      const list = rows.slice()
        .sort(function(a, b){
          return Math.abs(carryAnnualize(b.cur8hPct, b.intervalHours)) -
                 Math.abs(carryAnnualize(a.cur8hPct, a.intervalHours));
        })
        .slice(0, LIST_N);
      __renderTable(ui, list);

      __prog(ui, 1);
      const parts = ['done — ' + rows.length + ' binance perps deep-scanned'];
      parts.push(delta ? (Object.keys(delta).length + ' delta perps · ' + matched + ' matched') : 'delta leg failed');
      if (bybit) parts.push(Object.keys(bybit).length + ' bybit perps');
      parts.push(cards.length + ' spreads ≥ ' + SPREAD_MIN_APR + '% APR');
      if (failures) parts.push(failures + ' per-symbol history failures (avg n/a)');
      setStat(parts.join(' · '));
      if (warnMsgs.length) __warn(ui, warnMsgs.join(' · '));
    }catch(e){
      __warn(ui, 'carry scan error: ' + (e && e.message ? e.message : e));
      setStat('carry scan failed');
      status = 'failed: ' + ((e && e.message) ? e.message : String(e));
    }finally{
      __prog(ui, null);
      ui.btn.disabled = false;
      __carry.busy = false;
    }
    return status;
  }

  /* ==================== HARD REFRESH support ====================
     House refresh contract (index.html hardRefreshAll): async, NEVER throws,
     terse status — 'busy' while a scan is in flight (overlapping invocations
     never double-fetch), 'skipped: not run yet' before the first user run (a
     global refresh must never trigger an expensive first-time scan on its
     own), otherwise re-runs the same two-leg scan the RUN CARRY SCAN button
     triggers and returns its status. The per-symbol loops inside
     runCarryScan already catch-isolate failures (counted), so a refresh can
     degrade but never rejects. */
  var __carry = { busy: false, ranOnce: false, ui: null };
  var __carrySnap = null;
  async function refreshCarry(){
    try{
      if (__carry.busy) return 'busy';
      if (!__carry.ranOnce || !__carry.ui) return 'skipped: not run yet';
      return await runCarryScan(__carry.ui);
    }catch(e){
      return 'error: ' + ((e && e.message) ? e.message : String(e));
    }
  }

  function __carryWarmShim(){
    return { innerHTML: '', textContent: '', className: '', disabled: false,
      style: {}, firstElementChild: { style: {} },
      querySelector: function(sel){
        return { style: {}, textContent: '', innerHTML: '', disabled: false,
          addEventListener: function(){}, removeEventListener: function(){} };
      } };
  }
  async function carryWarm(){
    try{
      if (typeof window.carryState === 'function' && window.carryState()) return 'fresh';
      if (__carry.busy) return 'busy';
      const shim = __carryWarmShim();
      const ui = {
        btn: shim, stat: shim, prog: shim, warn: shim,
        cards: shim, empty: shim, tableWrap: shim
      };
      __carry.ui = ui;
      const r = await runCarryScan(ui);
      __carry.ranOnce = true;
      return (typeof window.carryState === 'function' && window.carryState())
        ? 'warmed' : ('unavailable: ' + (r || 'carry scan did not publish state'));
    }catch(e){ return 'error: ' + ((e && e.message) || e); }
  }

  /* ============================ mount ============================ */
  function mountCarry(el){
    if (!el) return;
    const hostNote = (typeof hgHostingMode === 'function' && hgHostingMode() === 'static')
      ? ' Static host (GitHub Pages) — Delta leg and proxy APIs need Render for full carry scans.'
      : '';
    el.innerHTML =
      '<div class="panel">'
      + '<h2>Carry — funding arbitrage <span>delta-neutral · binance vs delta india · APR = rate × (24 ÷ funding interval) × 365</span></h2>'
      + '<div class="note" style="margin-bottom:10px">LEG A — Binance: all-symbols premiumIndex, top ' + TOP_N +
        ' by |lastFundingRate| with ≥ $20M 24h turnover, plus the last ' + HIST_LIMIT +
        ' funding prints per symbol for an average rate. LEG B — Delta India perp tickers (funding_rate is already percent per 8h interval). ' +
        'LEG C — Bybit linear perps (current funding, 8h). Matched by base asset; the best spread per base wins (Binance↔Delta, Binance↔Bybit, or Delta↔Bybit). Cross-venue cards need |APR spread| ≥ ' + SPREAD_MIN_APR +
        '%. Carry is not free money — funding flips, bases drift, fees eat thin spreads.' + hostNote + '</div>'
      + '<div class="note" id="carryStat">idle — press RUN.</div>'
      + '<div class="row" style="margin-top:8px"><button class="btn" id="carryRun">RUN CARRY SCAN</button></div>'
      + '<div class="prog" id="carryProg"><i></i></div>'
      + '<div class="note warn" id="carryWarn" style="display:none;margin-top:8px"></div>'
      + '<div class="cards" id="carryCards" style="margin-top:12px"></div>'
      + '<div class="empty" id="carryEmpty" style="display:none"></div>'
      + '<hr class="sep">'
      + '<div id="carryTableWrap"></div>'
      + '</div>';
    const ui = {
      btn: el.querySelector('#carryRun'),
      stat: el.querySelector('#carryStat'),
      prog: el.querySelector('#carryProg'),
      warn: el.querySelector('#carryWarn'),
      cards: el.querySelector('#carryCards'),
      empty: el.querySelector('#carryEmpty'),
      tableWrap: el.querySelector('#carryTableWrap')
    };
    if (!ui.btn || !ui.stat || !ui.prog || !ui.warn || !ui.cards || !ui.empty || !ui.tableWrap) return;
    __carry.ui = ui;   // latest mount wins for the hard-refresh contract

    const missing = [];
    if (typeof fetch !== 'function') missing.push('fetch');
    if (typeof AbortController !== 'function') missing.push('AbortController');
    if (typeof binanceTickers24h !== 'function') missing.push('binanceTickers24h');
    if (missing.length){
      ui.warn.textContent = 'missing globals: ' + missing.join(', ') +
        ' — the scan degrades honestly where it can (' + missing.join(', ') + ').';
      ui.warn.style.display = 'block';
    }
    if (typeof fetch !== 'function' || typeof AbortController !== 'function'){
      ui.btn.disabled = true; // hard dependency — nothing the scan can do
      return;
    }
    ui.btn.addEventListener('click', function(){ return runCarryScan(ui); });
  }

  /* ============================ exports ============================ */
  if (typeof window !== 'undefined'){
    window.carrySpread = carrySpread;         // legacy both-8h classifier (unchanged)
    window.carryAnnualize = carryAnnualize;   // per-print rate -> APR at a given interval
    window.carrySpreadInt = carrySpreadInt;   // interval-aware classifier used by the scan
    window.carrySpreadPair = carrySpreadPair;
    window.carryBybitCrossCheck = carryBybitCrossCheck;
    window.carryPlan = carryPlan;             // per-card execution levels (SL/TP audit)
    window.carryState = function carryState(){
      try{ return __carrySnap ? JSON.parse(JSON.stringify(__carrySnap)) : null; }catch(e){ return null; }
    };
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push({ id: 'carry', label: 'CARRY', mount: mountCarry, refresh: refreshCarry });
    window.HG_warmups = window.HG_warmups || [];
    window.HG_warmups.push({ id: 'carry', label: 'CARRY', run: carryWarm });
  }

})();
