/* HARDGATE — backtest confidence bands (task #13), shared by the walk scripts.
 *
   The backtests already carry venue-true costs (fees + slippage per side,
   e.g. omnigold 0.26% RT, gold desks XM 0.020% RT primary + PAXG 0.26%
   sensitivity) and a Wilson 95% lower bound on hit rate. What was missing
   is a confidence band on the NET expectancy itself: a single mean R number
   reads like a promise, and with small settled-trade samples it is one.

   This is a seeded bootstrap percentile band over the per-trade net R
   distribution — no normality assumption (R distributions are skewed by
   design: winners run to +N R, losers clip near -1 R), deterministic for
   reproducible evidence, and honest at n=0 (nulls, never a guess). */

/** Deterministic PRNG (mulberry32) — same seed, same band, every run. */
export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bootstrap percentile CI for the MEAN of the given net-R values.
 * @param {number[]|null[]} rs per-trade net R (null entries skipped)
 * @param {{ci?:number, reps?:number, seed?:number}} [opts]
 * @returns {{n:number, meanR:number, lo:number, hi:number} | null}
 */
export function hgMeanRCI(rs, opts){
  /* +null and +'' coerce to 0 — a MISSING trade must never count as a
     zero-R trade. Reject the absent before coercing the present. */
  const vals = (Array.isArray(rs) ? rs : [])
    .filter(v => v !== null && v !== undefined && v !== '' && Number.isFinite(+v))
    .map(v => +v);
  const n = vals.length;
  if (!n) return null;

  const ci = Number.isFinite(+opts?.ci) ? Math.min(0.99, Math.max(0.5, +opts.ci)) : 0.95;
  const reps = Number.isFinite(+opts?.reps) && +opts.reps >= 100 ? Math.round(+opts.reps) : 2000;
  const seed = Number.isFinite(+opts?.seed) ? (+opts.seed | 0) : 0xC0FFEE;

  const meanR = vals.reduce((s, v) => s + v, 0) / n;

  if (n === 1) return { n, meanR, lo: vals[0], hi: vals[0] };

  const rand = mulberry32(seed + n);
  const means = new Array(reps);
  for (let r = 0; r < reps; r++){
    let s = 0;
    for (let i = 0; i < n; i++) s += vals[(rand() * n) | 0];
    means[r] = s / n;
  }
  means.sort((a, b) => a - b);
  const alpha = (1 - ci) / 2;
  const lo = means[Math.max(0, Math.floor(alpha * reps))];
  const hi = means[Math.min(reps - 1, Math.ceil((1 - alpha) * reps) - 1)];
  return { n, meanR, lo, hi };
}

/** Compact printable form for summaries/evidence: "0.42 [p2.5 0.18 · p97.5 0.67]". */
export function hgMeanRCILabel(band){
  if (!band || !Number.isFinite(band.meanR)) return null;
  const f = v => (v >= 0 ? '+' : '') + (+v).toFixed(2);
  return `${f(band.meanR)}R [p2.5 ${f(band.lo)} · p97.5 ${f(band.hi)}] (n=${band.n}, bootstrap 95%)`;
}
