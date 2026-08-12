/* HARDGATE — FRED DFII10 real-rate series (fix pack 15). */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function parseDate(s) {
  if (!s) return null;
  const t = Date.parse(String(s));
  return Number.isFinite(t) ? t : null;
}

function businessDaysBetween(fromMs, toMs) {
  if (!fromMs || !toMs || toMs <= fromMs) return 0;
  let n = 0;
  const d = new Date(fromMs);
  d.setUTCHours(0, 0, 0, 0);
  const end = new Date(toMs);
  end.setUTCHours(0, 0, 0, 0);
  while (d < end) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

function chgOver(rows, days) {
  if (!rows || rows.length < days + 1) return null;
  const cur = num(rows[0]?.value ?? rows[0]?.level);
  const prior = num(rows[days]?.value ?? rows[days]?.level);
  if (cur === null || prior === null) return null;
  return cur - prior;
}

/**
 * hgRealRate({ dfii10Rows, t10yieRows, nowMs }) from FRED observations.
 * rows sorted desc by date (newest first).
 */
export function hgRealRate(input = {}) {
  const dfii = Array.isArray(input.dfii10Rows) ? input.dfii10Rows : (Array.isArray(input.observations) ? input.observations : []);
  const t10 = Array.isArray(input.t10yieRows) ? input.t10yieRows : [];
  const nowMs = num(input.nowMs) ?? Date.now();

  if (!dfii.length) {
    return { level: null, chg5d: null, chg20d: null, trend: null, asOf: null, stale: true, source: 'missing', measured: false };
  }

  const level = num(dfii[0].value ?? dfii[0].level);
  const asOf = parseDate(dfii[0].date ?? dfii[0].asOf);
  const stale = asOf === null || businessDaysBetween(asOf, nowMs) > 3;
  const chg5d = chgOver(dfii, 5);
  const chg20d = chgOver(dfii, 20);

  let trend = 'FLAT';
  if (chg20d !== null) {
    if (chg20d <= -0.05) trend = 'FALLING';
    else if (chg20d >= 0.05) trend = 'RISING';
  }

  let breakevenChg20 = chgOver(t10, 20);
  let driverNote = null;
  if (chg20d !== null && breakevenChg20 !== null) {
    if (chg20d < 0 && breakevenChg20 > 0) driverNote = 'real yield falling via RISING breakevens (inflation bid)';
    else if (chg20d < 0 && breakevenChg20 <= 0) driverNote = 'real yield falling via falling nominals (growth scare bid for gold)';
    else if (chg20d > 0 && breakevenChg20 < 0) driverNote = 'real yield rising via falling breakevens (deflationary tightening)';
  }

  return {
    level,
    chg5d,
    chg20d,
    trend,
    asOf: asOf ? new Date(asOf).toISOString().slice(0, 10) : (dfii[0].date || null),
    stale,
    source: 'fred-dfii10',
    measured: true,
    breakevenChg20,
    driverNote,
  };
}

/** Gold macro tilt from measured real rate; fallback hint when dark. */
export function hgRealRateGoldHint(realRate, fallbackHint = 'NEUTRAL') {
  if (!realRate || !realRate.measured || realRate.level === null) {
    return { hint: fallbackHint, measured: false, label: 'fallback hint' };
  }
  let hint = 'NEUTRAL';
  if (realRate.trend === 'FALLING') hint = 'TAILWIND';
  else if (realRate.trend === 'RISING') hint = 'HEADWIND';
  return { hint, measured: true, label: 'FRED DFII10', realRate };
}

export function hgRealRateOpposes(realRate, dir) {
  if (!realRate || !realRate.measured || realRate.trend === 'FLAT' || realRate.trend === null) return false;
  const d = String(dir || '').toLowerCase();
  if (d === 'long' && realRate.trend === 'RISING') return true;
  if (d === 'short' && realRate.trend === 'FALLING') return true;
  return false;
}
