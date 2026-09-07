/* HARDGATE — setup calibration core (Increment 2). Pure functions only. */

export const SC_MIN_SAMPLE = 20;

const SEC_PER_RES = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

export function scNum(v){
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Macro REGIME composite → profile bucket. */
export function scMacroRegimeBucket(score){
  const s = scNum(score);
  if (s === null) return 'chop';
  if (s >= 3) return 'risk-on';
  if (s <= -3) return 'risk-off';
  return 'chop';
}

/** 4H tape regime label → trend vs chop bucket. */
export function scTapeRegimeBucket(tapeRegime){
  const t = String(tapeRegime || '').toLowerCase();
  if (!t || t === 'n/a' || t === 'data thin') return 'chop';
  if (t.indexOf('compression') >= 0 || t.indexOf('chop') >= 0 || t.indexOf('weak') >= 0) return 'chop';
  if (t.indexOf('volatile') >= 0) return 'chop';
  return 'trend';
}

export function scBlankBucket(){
  return { n: 0, wins: 0, losses: 0, sumWinR: 0, sumLossR: 0, sumR: 0, winBars: [], medianWinBars: null };
}

export function scAccBucket(b, trade){
  b.n += 1;
  const r = scNum(trade.r);
  if (r === null) return b;
  b.sumR += r;
  if (r > 0){
    b.wins += 1;
    b.sumWinR += r;
    if (scNum(trade.barsToOutcome) !== null) b.winBars.push(trade.barsToOutcome);
  } else {
    b.losses += 1;
    b.sumLossR += Math.abs(r);
  }
  return b;
}

export function scFinalizeBucket(b){
  const n = b.n || 0;
  const wr = n ? b.wins / n : null;
  const avgWin = b.wins ? b.sumWinR / b.wins : null;
  const avgLoss = b.losses ? b.sumLossR / b.losses : null;
  let expectancy = null;
  if (n && wr !== null && avgWin !== null && avgLoss !== null){
    expectancy = wr * avgWin - (1 - wr) * avgLoss;
  } else if (n) expectancy = b.sumR / n;
  let medianWinBars = null;
  if (b.winBars && b.winBars.length){
    const s = b.winBars.slice().sort((a, b2) => a - b2);
    const m = Math.floor(s.length / 2);
    medianWinBars = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  return {
    n, wins: b.wins, losses: b.losses,
    wr: wr !== null ? Math.round(wr * 1000) / 1000 : null,
    avgWinR: avgWin !== null ? Math.round(avgWin * 1000) / 1000 : null,
    avgLossR: avgLoss !== null ? Math.round(avgLoss * 1000) / 1000 : null,
    expectancy: expectancy !== null ? Math.round(expectancy * 1000) / 1000 : null,
    medianWinBars: medianWinBars !== null ? Math.round(medianWinBars * 10) / 10 : null,
  };
}

/** Normalize setup kind strings to profile keys. */
export function scNormalizeSetupKind(kind){
  const k = String(kind || 'swing').toLowerCase();
  if (k === 'best') return 'swing';
  if (k.indexOf('gold') >= 0 && k.indexOf('scalp') >= 0) return 'gold-scalp';
  if (k.indexOf('gold') >= 0) return 'gold-swing';
  if (k.indexOf('gs') === 0) return k;
  if (k.indexOf('judas') >= 0) return 'judas';
  if (k.indexOf('smc') >= 0 || k.indexOf('fvg') >= 0) return 'smc-fvg';
  if (k === 'trap' || k.indexOf('mean') >= 0) return 'meanrev';
  return k;
}

/** Build setup-profile from LOG rows and/or scorecard records. */
export function scBuildProfileFromSources(logEntries, scoreRecords, opts){
  opts = opts || {};
  const minSample = scNum(opts.minSample) ?? SC_MIN_SAMPLE;
  const setups = {};
  const trades = [];

  function pushTrade(kind, regimeBucket, r, bars){
    trades.push({ kind: scNormalizeSetupKind(kind), regimeBucket, r, barsToOutcome: bars });
  }

  for (const e of Array.isArray(logEntries) ? logEntries : []){
    if (!e) continue;
    const st = String(e.status || '');
    if (st !== 'tp' && st !== 'sl' && st !== 'time_stop') continue;
    let r = scNum(e.rr);
    if (st === 'sl') r = -1;
    else if (st === 'time_stop') r = scNum(e.rr) ?? -0.1;
    else if (r === null) r = 2;
    const macro = scMacroRegimeBucket(e.regimeScore);
    let bars = null;
    if (e.filledTs && e.doneTs && e.res && SEC_PER_RES[e.res]){
      bars = Math.max(1, Math.round((e.doneTs - e.filledTs) / SEC_PER_RES[e.res]));
    }
    pushTrade(e.kind || 'swing', macro, r, bars);
  }

  for (const rec of Array.isArray(scoreRecords) ? scoreRecords : []){
    if (!rec || rec.status !== 'settled') continue;
    const r = scNum(rec.r ?? rec.rNet);
    if (r === null) continue;
    const kind = rec.poiKind || rec.kind || rec.lane || rec.source || 'swing';
    const regime = (rec.fpParts && rec.fpParts.regime) ? rec.fpParts.regime : 'chop';
    let rb = 'chop';
    if (regime.indexOf('risk') >= 0 || regime === 'reg-on') rb = 'risk-on';
    else if (regime.indexOf('off') >= 0) rb = 'risk-off';
    else if (regime.indexOf('trend') >= 0) rb = 'trend';
    let bars = scNum(rec.barsToOutcome);
    if (bars === null && rec.filledAt && rec.closedAt){
      const res = rec.res || '4h';
      const sec = SEC_PER_RES[res] || 14400;
      bars = Math.max(1, Math.round((rec.closedAt - rec.filledAt) / (sec * 1000)));
    }
    pushTrade(kind, rb, r, bars);
  }

  for (const t of trades){
    const kind = t.kind;
    if (!setups[kind]) setups[kind] = { 'risk-on': scBlankBucket(), 'risk-off': scBlankBucket(), chop: scBlankBucket(), trend: scBlankBucket(), all: scBlankBucket() };
    scAccBucket(setups[kind][t.regimeBucket], t);
    scAccBucket(setups[kind].all, t);
  }

  const out = { version: 1, minSample, computedAt: Date.now(), setups: {} };
  for (const kind of Object.keys(setups)){
    out.setups[kind] = {};
    for (const bucket of Object.keys(setups[kind])){
      out.setups[kind][bucket] = scFinalizeBucket(setups[kind][bucket]);
    }
  }
  return out;
}

export function scProfileLookup(profile, setupKind, regimeBucket){
  profile = profile || {};
  const kind = scNormalizeSetupKind(setupKind);
  const setups = profile.setups || {};
  const row = setups[kind] || setups.swing || null;
  if (!row) return null;
  const bucket = row[regimeBucket] || row.chop || row.all || null;
  const fallback = row.all || null;
  if (!bucket || !bucket.n) return fallback && fallback.n ? { ...fallback, source: 'all' } : null;
  return { ...bucket, source: regimeBucket };
}

export function scProfileAnnotate(profile, setupKind, regimeScore, opts){
  opts = opts || {};
  const minSample = scNum(opts.minSample) ?? scNum(profile.minSample) ?? SC_MIN_SAMPLE;
  const bucket = scMacroRegimeBucket(regimeScore);
  const row = scProfileLookup(profile, setupKind, bucket);
  if (!row || !row.n){
    return { tag: 'insufficient-sample', line: 'historical edge: insufficient sample (< ' + minSample + ')', allowBest: true, n: 0 };
  }
  const wrPct = row.wr !== null ? Math.round(row.wr * 100) : null;
  const exp = row.expectancy;
  const line = 'hist edge ' + bucket + ': n=' + row.n
    + (wrPct !== null ? ' · WR ' + wrPct + '%' : '')
    + (exp !== null ? ' · exp ' + (exp >= 0 ? '+' : '') + exp.toFixed(2) + 'R' : '');
  if (row.n < minSample){
    return { tag: 'insufficient-sample', line: line + ' — below ' + minSample + ' trades', allowBest: false, n: row.n, expectancy: exp, wr: row.wr };
  }
  if (exp !== null && exp < 0){
    return { tag: 'negative-ev-regime', line: line + ' — negative EV in this regime', allowBest: false, n: row.n, expectancy: exp, wr: row.wr };
  }
  return { tag: null, line, allowBest: true, n: row.n, expectancy: exp, wr: row.wr, medianWinBars: row.medianWinBars };
}

/** Regime-conditional gate tightening from regime-profile.json rules. */
export function scRegimeConditionalGate(regimeProfile, setupKind, macroScore, tapeRegime, gatesPassed, opts){
  opts = opts || {};
  const cfg = (regimeProfile && regimeProfile.setups) ? regimeProfile.setups[scNormalizeSetupKind(setupKind)] : null;
  if (!cfg) return { allow: true, reason: null, extraConfluence: 0 };
  const abs = Math.abs(scNum(macroScore) ?? 0);
  const tape = scTapeRegimeBucket(tapeRegime);
  const home = String(cfg.homeRegime || 'trend');
  const macro = cfg.macro || {};
  const fullMin = scNum(macro.fullStrengthMinAbs) ?? 3;
  const extraMin = scNum(macro.extraConfluenceMinAbs) ?? 1;
  const vetoMax = scNum(macro.vetoMaxAbs) ?? 0.99;

  if (home === 'trend' || setupKind === 'swing' || setupKind === 'edge' || setupKind === 'best'){
    if (abs < vetoMax) return { allow: false, reason: 'regime chop — trend setup vetoed (|score| < ' + vetoMax + ')', extraConfluence: 0 };
    if (abs >= fullMin) return { allow: true, reason: null, extraConfluence: 0 };
    if (abs >= extraMin) return { allow: true, reason: 'regime mixed — needs extra confluence', extraConfluence: 1 };
    return { allow: false, reason: 'regime too weak for trend setup', extraConfluence: 0 };
  }

  if (home === 'chop' || setupKind === 'meanrev' || setupKind === 'trap'){
    if (abs >= fullMin) return { allow: false, reason: 'strong macro trend — mean-reversion setup vetoed', extraConfluence: 0 };
    if (tape === 'chop' || abs < extraMin) return { allow: true, reason: null, extraConfluence: 0 };
    return { allow: true, reason: 'transition regime — prefer extra confluence', extraConfluence: 1 };
  }

  if (setupKind === 'judas' || setupKind === 'gold-scalp'){
    const sess = cfg.sessionOverlapOnly;
    if (sess && !optsSessionOverlap(opts)) return { allow: false, reason: 'session gate — London/NY overlap required', extraConfluence: 0 };
    return { allow: true, reason: null, extraConfluence: 0 };
  }

  return { allow: true, reason: null, extraConfluence: 0 };
}

function optsSessionOverlap(opts){
  return !!(opts && opts.sessionOverlap);
}

/** Cross-tab confluence tier (1 = strongest). Not a score — count of independent tab passes. */
export function scConfluenceTier(crossTabHits){
  const h = scNum(crossTabHits) ?? 0;
  if (h >= 2) return 1;
  if (h === 1) return 2;
  return 3;
}

export function scCountCrossTabHits(sym, dir, publishers){
  publishers = publishers || [];
  let hits = 0;
  const d = String(dir || '').toLowerCase();
  for (const pub of publishers){
    if (!pub || !Array.isArray(pub.results)) continue;
    for (const r of pub.results){
      if (!r || String(r.sym) !== String(sym)) continue;
      const rd = String(r.dir || '').toLowerCase();
      if (!rd || rd === d) { hits += 1; break; }
    }
  }
  return hits;
}

/** ATR percentile rank on symbol history (0–100). */
export function scAtrPercentileRank(rows, atrLen, lookback){
  atrLen = atrLen || 14;
  lookback = lookback || 90;
  if (!Array.isArray(rows) || rows.length < atrLen + 5) return { rank: null, pct: null, atrNow: null };
  const atrFn = (typeof globalThis !== 'undefined' && globalThis.__scAtr) ? globalThis.__scAtr : null;
  if (!atrFn) return { rank: null, pct: null, atrNow: null };
  const series = atrFn(rows, atrLen);
  const vals = [];
  for (let i = Math.max(0, series.length - lookback); i < series.length; i++){
    if (Number.isFinite(series[i]) && series[i] > 0) vals.push(series[i]);
  }
  if (!vals.length) return { rank: null, pct: null, atrNow: null };
  const now = vals[vals.length - 1];
  const below = vals.filter((v) => v <= now).length;
  const pct = Math.round((below / vals.length) * 100);
  return { rank: below, pct, atrNow: now, n: vals.length };
}

/** Volatility-adaptive stop multiplier and minimum R:R. */
export function scVolAdaptiveRr(atrPctRank, volRatio, base){
  base = base || {};
  const stopMult = scNum(base.stopMult) ?? 1;
  const rrMin = scNum(base.rrMin) ?? 2;
  let sm = stopMult;
  let rr = rrMin;
  const rank = scNum(atrPctRank);
  const vr = scNum(volRatio);
  if (vr !== null){
    if (vr > 1.2) sm *= 1.25;
    else if (vr < 0.8) sm *= 0.85;
  }
  if (rank !== null){
    if (rank >= 80) rr = Math.max(rr, 2.5);
    else if (rank <= 20) rr = Math.min(rr, 1.8);
  }
  return { stopMult: Math.round(sm * 1000) / 1000, rrMin: Math.round(rr * 100) / 100 };
}

/** Time-stop max bars = 2 × median winner duration for setup kind. */
export function scTimeStopMaxBars(setupKind, profileRow, defaults){
  defaults = defaults || {};
  const kind = scNormalizeSetupKind(setupKind);
  const med = profileRow && scNum(profileRow.medianWinBars);
  if (med !== null && med > 0) return Math.max(2, Math.round(med * 2));
  const d = defaults[kind] || defaults.swing || {};
  return scNum(d.bars) ?? 48;
}

export function scTimeStopDue(openedAtMs, res, maxBars, nowMs){
  if (!openedAtMs || !maxBars) return false;
  const sec = SEC_PER_RES[res] || 14400;
  const elapsed = ((nowMs || Date.now()) - openedAtMs) / 1000;
  return elapsed >= maxBars * sec;
}

/** EMA cascade on rows — swing cross-venue agreement. */
export function scEmaCascadeDir(rows){
  if (!Array.isArray(rows) || rows.length < 55) return null;
  const emaFn = (typeof globalThis !== 'undefined' && globalThis.__scEma) ? globalThis.__scEma : null;
  if (!emaFn) return null;
  const c = rows.map((r) => r.c);
  const e9 = emaFn(c, 9), e21 = emaFn(c, 21), e50 = emaFn(c, 50);
  const k = c.length - 1;
  if (c[k] > e21[k] && e21[k] > e50[k]) return 'long';
  if (c[k] < e21[k] && e21[k] < e50[k]) return 'short';
  return null;
}

export function scCrossVenueSwingGate(dir, primaryRows, refRows){
  const d = String(dir || '').toLowerCase();
  const pDir = scEmaCascadeDir(primaryRows);
  const rDir = scEmaCascadeDir(refRows);
  if (!pDir || !rDir) return { pass: true, unchecked: true, reason: 'cross-venue: reference data thin' };
  if (pDir !== d) return { pass: false, reason: 'primary cascade disagrees with setup dir' };
  if (rDir !== d) return { pass: false, reason: 'Binance reference cascade disagrees — cross-venue veto' };
  return { pass: true, reason: 'cross-venue cascade aligned' };
}

export function scGoldBasisGate(dir, perpPx, spotPx){
  const p = scNum(perpPx), s = scNum(spotPx);
  if (p === null || s === null || !(s > 0)) return { pass: true, unchecked: true, reason: 'gold basis: spot/perp unavailable' };
  const basisPct = (p - s) / s * 100;
  if (Math.abs(basisPct) >= 0.3){
    return { pass: false, reason: 'gold basis dislocation ' + basisPct.toFixed(2) + '% — perp/spot disagree' };
  }
  const d = String(dir || '').toLowerCase();
  if (d === 'long' && basisPct > 0.15) return { pass: false, reason: 'perp premium vs spot — long veto' };
  if (d === 'short' && basisPct < -0.15) return { pass: false, reason: 'perp discount vs spot — short veto' };
  return { pass: true, reason: 'gold perp/spot aligned (' + basisPct.toFixed(2) + '%)' };
}

/** Triple-witness positioning gate for longs (mirror for shorts). */
export function scTripleWitnessGate(dir, retailLongPct, topLongPct, takerRatio){
  const d = String(dir || '').toLowerCase();
  const retail = scNum(retailLongPct);
  const top = scNum(topLongPct);
  const taker = scNum(takerRatio);
  let witnesses = 0;
  if (d === 'long'){
    if (retail !== null && retail < 55) witnesses++;
    if (top !== null && top > 55) witnesses++;
    if (taker !== null && taker > 1) witnesses++;
  } else {
    if (retail !== null && retail > 45) witnesses++;
    if (top !== null && top < 45) witnesses++;
    if (taker !== null && taker < 1) witnesses++;
  }
  return { pass: witnesses >= 2, witnesses, reason: witnesses >= 2 ? witnesses + '/3 positioning witnesses' : 'positioning witnesses ' + witnesses + '/3 (need 2)' };
}
