/* HARDGATE — hg-setup-core.js — browser bridge for lib/hg-setup-core.mjs */
'use strict';

(function(G){
  function fin(x){
    var n = (typeof x === 'number') ? x : parseFloat(x);
    return isFinite(n) ? n : null;
  }

  var TF_SEC = { '15m': 900, '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400 };

  function gateResult(id, label, state, detail, opts){
    opts = opts || {};
    var st = String(state || 'na').toLowerCase();
    if (st === 'na' || st === 'null'){
      var dm = opts.degradeMode || 'veto';
      if (dm === 'pass') st = 'pass';
      else if (dm === 'info') st = 'info';
      else if (dm === 'na') st = 'na';
      else st = 'veto';
    }
    var pass = st === 'pass' || st === 'ok' || st === true;
    return { id: id || '', label: label || '', state: st, pass: pass, detail: detail || '',
      degradeMode: opts.degradeMode || null, scored: opts.scored !== false };
  }

  function getClosedCandles(rows, tf, nowSec){
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) return { rows: [], stale: false, dropped: 0 };
    var sec = TF_SEC[tf] || 0;
    var clean = [], i, r;
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      if (!r || typeof r !== 'object') continue;
      if (!isFinite(fin(r.c))) continue;
      clean.push(r);
    }
    if (!clean.length) return { rows: [], stale: false, dropped: rows.length };
    var dropped = rows.length - clean.length;
    if (!sec) return { rows: clean, stale: false, dropped };
    var lastT = fin(clean[clean.length - 1].t);
    if (lastT === null) return { rows: clean, stale: false, dropped };
    if (lastT > 1e12) lastT = Math.floor(lastT / 1000);
    var now = fin(nowSec);
    if (now === null) now = Math.floor(Date.now() / 1000);
    var stale = (now - lastT) > (2 * sec);
    var out = ((now - lastT) < sec) ? clean.slice(0, -1) : clean;
    if (out.length && out.length < clean.length) dropped++;
    return { rows: out, stale: stale, dropped };
  }

  function alignBarsByTime(left, right, maxSkewSec){
    maxSkewSec = fin(maxSkewSec);
    if (maxSkewSec === null || maxSkewSec <= 0) maxSkewSec = 480;
    left = Array.isArray(left) ? left : [];
    right = Array.isArray(right) ? right : [];
    var rmap = {}, j, rt;
    for (j = 0; j < right.length; j++){
      rt = fin(right[j] && right[j].t);
      if (rt === null) continue;
      if (rt > 1e12) rt = Math.floor(rt / 1000);
      rmap[rt] = right[j];
      rmap[rt - 60] = right[j];
      rmap[rt + 60] = right[j];
    }
    var pairs = [], i, lt, sk, cand, best, bestD;
    for (i = 0; i < left.length; i++){
      lt = fin(left[i] && left[i].t);
      if (lt === null) continue;
      if (lt > 1e12) lt = Math.floor(lt / 1000);
      best = null; bestD = Infinity;
      for (sk = -maxSkewSec; sk <= maxSkewSec; sk += 60){
        cand = rmap[lt + sk];
        if (!cand) continue;
        var d = Math.abs(sk);
        if (d < bestD){ bestD = d; best = cand; }
      }
      if (best) pairs.push({ left: left[i], right: best, t: lt });
    }
    return pairs;
  }

  function quantPrice(p, sig){
    p = fin(p);
    if (p === null) return '0';
    sig = (sig !== undefined && sig !== null) ? +sig : 6;
    if (!isFinite(sig) || sig < 0) sig = 6;
    return p.toFixed(sig);
  }

  function alertKey(parts, sig){
    sig = (sig !== undefined && sig !== null) ? +sig : 6;
    return (parts || []).map(function(x){
      if (typeof x === 'number' && isFinite(x)) return quantPrice(x, sig);
      return String(x == null ? '' : x);
    }).join('|');
  }

  function postCostRr(entry, stop, tp, opts){
    opts = opts || {};
    entry = fin(entry); stop = fin(stop); tp = fin(tp);
    if (entry === null || stop === null || tp === null || entry <= 0) return null;
    var risk = Math.abs(entry - stop), reward = Math.abs(tp - entry);
    if (!(risk > 0) || !(reward > 0)) return null;
    var takerBps = fin(opts.takerBps); if (takerBps === null) takerBps = 6;
    var slipBps = fin(opts.slipBps); if (slipBps === null) slipBps = 5;
    var spreadBps = fin(opts.spreadBps); if (spreadBps === null) spreadBps = 8;
    var fundApr = fin(opts.fundingApr); if (fundApr === null) fundApr = 0;
    var holdH = fin(opts.holdHours); if (holdH === null) holdH = 24;
    var roundTrip = (takerBps + slipBps + spreadBps) * 2 / 10000;
    var fundDrag = Math.abs(fundApr) * holdH / 8760 / 100;
    var cost = entry * (roundTrip + fundDrag);
    var netRisk = risk + cost;
    var netReward = Math.max(0, reward - cost);
    if (!(netRisk > 0)) return null;
    return { rr: netReward / netRisk, grossRr: reward / risk, costUsd: cost, netRisk: netRisk, netReward: netReward };
  }

  function sessionFundingGate(nowSec, fundingTs, opts){
    opts = opts || {};
    nowSec = fin(nowSec); if (nowSec === null) nowSec = Math.floor(Date.now() / 1000);
    var d = new Date(nowSec * 1000);
    var utcH = d.getUTCHours();
    var asianDead = (utcH >= 21 || utcH < 4);
    var nearFund = false;
    fundingTs = fin(fundingTs);
    var buf = fin(opts.fundingBufferMin); if (buf === null) buf = 10;
    if (fundingTs !== null){
      var dMin = Math.abs(fundingTs / 1000 - nowSec) / 60;
      if (dMin <= buf) nearFund = true;
    }
    var veto = !!opts.requireSession && asianDead;
    if (opts.blockFunding !== false && nearFund) veto = true;
    return { veto: veto, asianDead: asianDead, nearFunding: nearFund,
      note: veto ? (nearFund ? 'within funding settlement window' : 'Asian liquidity dead-zone') : 'session OK' };
  }

  function regimeOverlay(regimeScore, dir, opts){
    regimeScore = fin(regimeScore); if (regimeScore === null) regimeScore = 0;
    dir = String(dir || '').toLowerCase();
    var extra = 0, note = '';
    if (regimeScore <= -3 && dir === 'long'){ extra = 1; note = 'RISK-OFF — long needs +1 confluence'; }
    else if (regimeScore >= 3 && dir === 'short'){ extra = 1; note = 'RISK-ON — short needs +1 confluence'; }
    else if (regimeScore <= -3 && dir === 'short'){ extra = -1; note = 'RISK-OFF — short favored'; }
    else if (regimeScore >= 3 && dir === 'long'){ extra = -1; note = 'RISK-ON — long favored'; }
    return { extraConfluence: extra, note: note, score: regimeScore };
  }

  function universeFilter(tickers, opts){
    opts = opts || {};
    tickers = Array.isArray(tickers) ? tickers : [];
    var minTurn = fin(opts.minTurnoverUsd); if (minTurn === null) minTurn = 5000000;
    var maxSpreadBps = fin(opts.maxSpreadBps); if (maxSpreadBps === null) maxSpreadBps = 80;
    var twinMap = opts.twinTurnoverMap || {};
    var out = [], i, t, sym, turn, base, twin, tt, spreadBps;
    for (i = 0; i < tickers.length; i++){
      t = tickers[i];
      if (!t || !t.symbol) continue;
      sym = String(t.symbol);
      turn = fin(t.turnoverUsd);
      if (turn === null || turn < minTurn){
        base = sym.replace(/^B-/i, '').replace(/_USDT$/i, '').replace(/USDT$/i, '');
        twin = twinMap[base + 'USDT'] || twinMap[base + 'USD'];
        tt = fin(twin);
        if (tt !== null && tt >= minTurn) turn = tt;
      }
      if (turn === null || turn < minTurn) continue;
      spreadBps = fin(t.spreadBps);
      if (spreadBps !== null && spreadBps > maxSpreadBps) continue;
      out.push(Object.assign({}, t, { turnoverUsd: turn }));
    }
    out.sort(function(a, b){ return (b.turnoverUsd || 0) - (a.turnoverUsd || 0); });
    var cap = fin(opts.cap);
    if (cap !== null && cap > 0) out = out.slice(0, cap);
    return out;
  }

  function calcTradeSizing(opts){
    opts = opts || {};
    var balance = fin(opts.balance), riskPct = fin(opts.riskPct);
    var entry = fin(opts.entry), stop = fin(opts.stop);
    var tpRR = fin(opts.tpRR != null ? opts.tpRR : (opts.rr != null ? opts.rr : 2));
    var maxLev = fin(opts.maxLeverage != null ? opts.maxLeverage : 5);
    var feePct = fin(opts.feePct != null ? opts.feePct : 0.06);
    var slipPct = fin(opts.slipPct != null ? opts.slipPct : 0.05);
    var inverse = opts.inverse === true || opts.contractType === 'inverse';
    if (balance === null || riskPct === null || entry === null || stop === null
        || tpRR === null || maxLev === null) return { ok: false, reason: 'Missing or invalid inputs' };
    var riskDollars = balance * (riskPct / 100);
    var stopDist = Math.abs(entry - stop);
    if (!(stopDist > 0)) return { ok: false, reason: 'Stop-loss must differ from entry' };
    var positionUnits, notional;
    if (inverse){
      positionUnits = riskDollars * entry / stopDist;
      notional = positionUnits;
    } else {
      positionUnits = riskDollars / stopDist;
      notional = positionUnits * entry;
    }
    var impliedLeverage = notional / balance;
    var feeBuffer = riskDollars * ((feePct + slipPct) / 100);
    var effectiveRisk = riskDollars + feeBuffer;
    var tp = entry > stop ? entry + stopDist * tpRR : entry - stopDist * tpRR;
    var levOk = impliedLeverage <= maxLev + 1e-9;
    var pass = levOk && effectiveRisk <= riskDollars * 1.15 + 1e-9;
    return { ok: pass, qty: positionUnits, notionalUsd: notional, impliedLeverage: impliedLeverage,
      tp: tp, riskUsd: riskDollars, effectiveRiskUsd: effectiveRisk, inverse: inverse,
      reason: pass ? 'OK' : (levOk ? 'Fees exceed risk budget' : 'Leverage exceeds cap') };
  }

  function fundingGateDirectional(fundingPct, dir, opts){
    opts = opts || {};
    fundingPct = fin(fundingPct);
    dir = String(dir || '').toLowerCase();
    if (fundingPct === null) return gateResult('FUND', 'Funding', 'na', 'funding n/a', { degradeMode: opts.degradeMode || 'veto' });
    var extreme = fin(opts.sanity); if (extreme === null) extreme = 0.30;
    var against = fin(opts.against); if (against === null) against = 0.04;
    if (Math.abs(fundingPct) > extreme) return gateResult('FUND', 'Funding', 'veto', 'funding feed out of range', opts);
    var bad = (dir === 'long' && fundingPct >= against) || (dir === 'short' && fundingPct <= -against);
    return gateResult('FUND', 'Funding', bad ? 'veto' : 'pass', 'funding ' + fundingPct.toFixed(4) + '%/interval', opts);
  }

  /** Post-cost min R:R — returns gateResult tuple for plan builders. */
  function planMinRrGate(entry, stop, tp, minRr, opts){
    minRr = fin(minRr); if (minRr === null) minRr = 2.0;
    var pc = postCostRr(entry, stop, tp, opts);
    if (!pc) return gateResult('COST_RR', 'Post-cost R:R', 'veto', 'cannot compute cost-adjusted R:R', { degradeMode: 'veto' });
    var pass = pc.rr >= minRr;
    return gateResult('COST_RR', 'Post-cost R:R', pass ? 'pass' : 'veto',
      (pass ? 'net ' : 'net ') + pc.rr.toFixed(2) + 'R (gross ' + pc.grossRr.toFixed(2) + 'R, cost ' + (pc.costUsd / entry * 100).toFixed(3) + '%)',
      { degradeMode: 'veto', grossRr: pc.grossRr, netRr: pc.rr, costUsd: pc.costUsd });
  }

  var __closedSymCache = {};
  function cacheKey(sym, tf){ return String(sym || '').toUpperCase() + '|' + String(tf || ''); }

  /** Fetch + cache closed bars by (sym, tf). Rejects stale (>2×TF). */
  async function fetchClosedCandles(sym, tf, fetchRows, opts){
    opts = opts || {};
    sym = String(sym || '');
    tf = String(tf || '4h');
    var key = cacheKey(sym, tf);
    var now = fin(opts.nowSec);
    if (now === null) now = Math.floor(Date.now() / 1000);
    var hit = __closedSymCache[key];
    if (!opts.force && hit && hit.rows && hit.rows.length && (now - hit.at) < (TF_SEC[tf] || 3600)){
      return { rows: hit.rows, stale: hit.stale, cached: true };
    }
    var raw = [];
    try{
      if (typeof fetchRows === 'function') raw = await fetchRows(sym, tf, opts.limit || 200);
      else if (Array.isArray(fetchRows)) raw = fetchRows;
    }catch(e){ raw = []; }
    var pack = getClosedCandles(raw, tf, now);
    if (pack.stale && opts.rejectStale) return { rows: [], stale: true, rejected: true };
    __closedSymCache[key] = { rows: pack.rows, stale: pack.stale, at: now, closedBarTs: pack.rows.length ? pack.rows[pack.rows.length - 1].t : null };
    return { rows: pack.rows, stale: pack.stale, cached: false, dropped: pack.dropped };
  }

  G.hgGateResult = gateResult;
  G.getClosedCandles = getClosedCandles;
  G.hgFetchClosedCandles = fetchClosedCandles;
  G.hgAlignBarsByTime = alignBarsByTime;
  G.hgQuantPrice = quantPrice;
  G.hgAlertKey = alertKey;
  G.hgPostCostRr = postCostRr;
  G.hgPlanMinRrGate = planMinRrGate;
  G.hgSessionFundingGate = sessionFundingGate;
  G.hgRegimeOverlay = regimeOverlay;
  G.hgUniverseFilter = universeFilter;
  G.hgCalcTradeSizing = calcTradeSizing;
  G.hgFundingGateDirectional = fundingGateDirectional;
})(typeof window !== 'undefined' ? window : globalThis);
