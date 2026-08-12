/* HARDGATE — GOLD A+ maximum-conviction AND-gate (fix pack 15). */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function leg(name, state, detail) {
  return { name, state, detail: detail || '' };
}

function familyIsMeanRev(cand) {
  const k = String(cand.stratKey || cand.strategy || cand.poiKind || '').toLowerCase();
  return /vwap|ob|fvg|mean|fade|adr|revert/.test(k);
}

function familyIsBreakout(cand) {
  const k = String(cand.stratKey || cand.strategy || cand.poiKind || '').toLowerCase();
  return /break|cont|momentum|sweep|bos|msb|trend/.test(k);
}

/**
 * hgGoldAPlus(cand, ctx) -> { aplus, legs[], failed[], darkLegs[], note, soleBlocker }
 * DARK legs block A+ (A+ PENDING). Conviction lock is never mutated here.
 */
export function hgGoldAPlus(cand = {}, ctx = {}) {
  const style = String(ctx.style || cand.style || 'goldscalp').toLowerCase();
  const isScalp = style.includes('scalp');
  const dir = String(cand.dir || cand.direction || '').toLowerCase();
  const legs = [];
  const failed = [];
  const darkLegs = [];

  function add(l) {
    legs.push(l);
    if (l.state === 'veto') failed.push(l.name);
    if (l.state === 'dark') darkLegs.push(l.name);
  }

  const barAge = num(cand.barAge);
  const maxFresh = isScalp ? 2 : 1;
  if (barAge === null) {
    add(leg('L1 trigger fresh', 'dark', 'bar age unknown'));
  } else if (barAge > maxFresh) {
    add(leg('L1 trigger fresh', 'veto', 'bar age ' + barAge + ' > ' + maxFresh));
  } else {
    add(leg('L1 trigger fresh', 'pass', 'bar age ' + barAge));
  }

  const htfOk = cand.htfAlign === true || cand.htfAligned === true;
  const sweepExempt = cand.counterTrendSweep === true || cand.sweepExempt === true;
  if (sweepExempt) {
    add(leg('L2 HTF alignment', 'veto', 'counter-trend sweep exempt on normal ticket — never A+'));
  } else if (ctx.mixedFeed === true) {
    add(leg('L2 HTF alignment', 'dark', 'mixed feed — cross-timeframe alignment compares two markets'));
  } else if (cand.htfAlign === false || cand.htfAligned === false) {
    add(leg('L2 HTF alignment', 'veto', isScalp ? '4H stack opposes' : '1D stack opposes'));
  } else if (!htfOk) {
    add(leg('L2 HTF alignment', 'dark', isScalp ? '4H EMA50/200 unknown' : '1D EMA50/200 unknown'));
  } else {
    add(leg('L2 HTF alignment', 'pass', isScalp ? '4H aligned' : '1D aligned'));
  }

  const rr = num(cand.rr ?? cand.rr1);
  if (rr === null) {
    add(leg('L3 structural R:R', 'dark', 'R:R unknown'));
  } else if (rr < 2.0) {
    add(leg('L3 structural R:R', 'veto', 'R:R ' + rr.toFixed(1) + ' vs 2.0 required'));
  } else {
    add(leg('L3 structural R:R', 'pass', rr.toFixed(1) + 'R'));
  }

  const anchor = cand.structStop ?? cand.anchor ?? cand.anchorName;
  const stop = num(cand.stop);
  const entry = num(cand.entry);
  if (!anchor && stop === null) {
    add(leg('L4 structural stop', 'dark', 'anchor unknown'));
  } else if (cand.stopIsAtrOnly === true) {
    add(leg('L4 structural stop', 'veto', 'stop is ATR multiple only'));
  } else {
    add(leg('L4 structural stop', 'pass', String(anchor || 'structural anchor')));
  }

  const er = num(cand.er ?? cand.ker?.er);
  const meanRev = familyIsMeanRev(cand);
  const breakout = familyIsBreakout(cand) || !meanRev;
  if (er === null) {
    add(leg('L5 Kaufman ER', 'dark', 'ER(20) unknown'));
  } else if (breakout && er < 0.35) {
    add(leg('L5 Kaufman ER', 'veto', 'ER ' + er.toFixed(2) + ' < 0.35 for breakout/continuation'));
  } else if (meanRev && er > 0.25) {
    add(leg('L5 Kaufman ER', 'veto', 'ER ' + er.toFixed(2) + ' > 0.25 for mean-reversion'));
  } else {
    add(leg('L5 Kaufman ER', 'pass', 'ER ' + er.toFixed(2)));
  }

  const vol = ctx.volRegime || cand.volRegime;
  if (!vol) {
    add(leg('L6 vol regime', 'dark', 'vol forecast unavailable'));
  } else if (vol.regime === 'VOL EXPANDING' && vol.veto === true) {
    add(leg('L6 vol regime', 'veto', vol.note || 'VOL EXPANDING vs stop'));
  } else {
    add(leg('L6 vol regime', 'pass', vol.regime || 'OK'));
  }

  if (isScalp) {
    const kzw = num(cand.killzoneWeight);
    if (kzw === null) add(leg('L7 session', 'dark', 'killzone unknown'));
    else if (kzw < 2) add(leg('L7 session', 'veto', 'off-session / killzone weight ' + kzw));
    else add(leg('L7 session', 'pass', cand.killzone || 'in killzone'));
  } else {
    const news = ctx.news || cand.news;
    if (news === undefined) add(leg('L7 news window', 'dark', 'news state unknown'));
    else if (news && news.caution) add(leg('L7 news window', 'veto', 'high-impact news ±30m'));
    else add(leg('L7 news window', 'pass', 'clear'));
  }

  const newsClear = ctx.newsCaution === false || (ctx.news && !ctx.news.caution);
  if (ctx.news === undefined && ctx.newsCaution === undefined) {
    add(leg('L8 event proximity', 'dark', 'hgNewsState unavailable'));
  } else if (newsClear === false) {
    add(leg('L8 event proximity', 'veto', 'event/funding window'));
  } else {
    add(leg('L8 event proximity', 'pass', 'clear'));
  }

  const metals = ctx.metalsComplex;
  if (!metals) {
    add(leg('L9 metals complex', 'dark', 'metals feed unavailable'));
  } else if (metals.verdict === 'COMPLEX OPPOSES') {
    add(leg('L9 metals complex', 'veto', 'complex opposes'));
  } else if (metals.verdict === 'COMPLEX CONFIRMS') {
    add(leg('L9 metals complex', 'pass', 'complex confirms'));
  } else if (metals.oppose > 0) {
    add(leg('L9 metals complex', 'veto', 'mixed with oppose'));
  } else if (metals.dark && metals.dark.length) {
    add(leg('L9 metals complex', 'dark', metals.dark.join(', ')));
  } else {
    add(leg('L9 metals complex', 'veto', 'insufficient confirmation'));
  }

  const real = ctx.realRate;
  if (!real || !real.measured) {
    add(leg('L10 real rates', 'dark', 'FRED DFII10 unavailable'));
  } else if (real.trend === 'RISING' && dir === 'long') {
    add(leg('L10 real rates', 'veto', 'real yield rising vs long'));
  } else if (real.trend === 'FALLING' && dir === 'short') {
    add(leg('L10 real rates', 'veto', 'real yield falling vs short'));
  } else {
    add(leg('L10 real rates', 'pass', 'trend ' + (real.trend || 'flat')));
  }

  const cot = ctx.cot || cand.cot;
  if (!cot) {
    add(leg('L11 COT crowding', 'dark', 'COT feed stale'));
  } else if (cot.crowding === 'SPEC CROWDED LONG' && dir === 'long') {
    add(leg('L11 COT crowding', 'veto', 'spec crowded long'));
  } else if (cot.crowding === 'SPEC CROWDED SHORT' && dir === 'short') {
    add(leg('L11 COT crowding', 'veto', 'spec crowded short'));
  } else {
    add(leg('L11 COT crowding', 'pass', cot.crowding || 'not extreme'));
  }

  const venue = ctx.goldVenueSpread;
  if (!venue) {
    add(leg('L12 venue dislocation', 'dark', 'gold venue spread unavailable'));
  } else if (venue.gated) {
    add(leg('L12 venue dislocation', 'dark', venue.note || 'cash market closed'));
  } else if (ctx.goldVenueVeto && ctx.goldVenueVeto.veto) {
    add(leg('L12 venue dislocation', 'veto', ctx.goldVenueVeto.note || 'extreme dislocation'));
  } else if (venue.darkVenues && venue.darkVenues.includes('spot')) {
    add(leg('L12 venue dislocation', 'dark', 'spot dark'));
  } else {
    add(leg('L12 venue dislocation', 'pass', 'not extreme'));
  }

  const edge = ctx.edge;
  if (!edge) {
    add(leg('L13 ledger edge', 'dark', 'edge lookup unavailable'));
  } else if (edge.tier === 'PROVEN-BAD') {
    add(leg('L13 ledger edge', 'veto', 'PROVEN-BAD archetype'));
  } else {
    add(leg('L13 ledger edge', 'pass', edge.tier || 'UNPROVEN'));
  }

  const passN = legs.filter((l) => l.state === 'pass').length;
  const total = legs.length;
  const hasDark = darkLegs.length > 0;
  const hasVeto = failed.length > 0;
  const aplus = !hasDark && !hasVeto && passN === total;

  let soleBlocker = null;
  if (failed.length === 1) soleBlocker = failed[0];

  let note;
  if (aplus) {
    note = 'GOLD A+ · all ' + total + ' legs pass';
  } else if (hasDark && !hasVeto && passN === total - darkLegs.length) {
    note = 'A+ PENDING — ' + passN + '/' + total + ' legs pass · DARK: ' + darkLegs.join(', ');
  } else if (soleBlocker) {
    note = 'NOT A+ — sole blocker: ' + soleBlocker;
  } else {
    note = 'NOT A+ — ' + passN + '/' + total + ' legs pass'
      + (darkLegs.length ? ' · DARK: ' + darkLegs.join(', ') : '')
      + (failed.length ? ' · FAIL: ' + failed.join(', ') : '');
  }

  return {
    aplus,
    pending: hasDark && !hasVeto,
    legs,
    failed,
    darkLegs,
    passN,
    total,
    soleBlocker,
    note,
  };
}

/** Assert-safe: never writes conviction storage keys. */
export function hgGoldAPlusAssertNoConvictionWrite(writeFn, storageKey) {
  const forbidden = ['hgGoldscalpConviction', 'hgGoldswingConviction'];
  if (forbidden.includes(storageKey)) {
    throw new Error('A+ must not mutate conviction lock: ' + storageKey);
  }
  return writeFn();
}
