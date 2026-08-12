/* HARDGATE — Delta India vs Binance price premium (fix pack 15). */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function hgVenuePremium({ deltaMark, binanceMark } = {}) {
  const d = num(deltaMark);
  const b = num(binanceMark);
  if (d === null || b === null || !(b > 0)) return null;
  const premBps = ((d - b) / b) * 10000;
  const note = premBps >= 0
    ? 'Delta trading at +' + premBps.toFixed(1) + ' bps vs Binance mark'
    : 'Delta trading at ' + premBps.toFixed(1) + ' bps vs Binance mark';
  return { premBps, note, deltaMark: d, binanceMark: b };
}

function meanSd(arr) {
  if (!arr.length) return { mean: null, sd: null };
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  const mean = sum / arr.length;
  let v = 0;
  for (let i = 0; i < arr.length; i++) v += (arr[i] - mean) ** 2;
  const sd = Math.sqrt(v / arr.length);
  return { mean, sd };
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const a = arr.slice().sort((x, y) => x - y);
  const idx = Math.min(a.length - 1, Math.max(0, Math.floor(a.length * p)));
  return a[idx];
}

/**
 * Rolling z-score of venue premium. stretched when |z| >= 2 and n >= 60.
 */
export function hgVenuePremiumZ(history = [], lookback = 240, premBps = null) {
  const lb = Math.max(10, Math.floor(num(lookback) ?? 240));
  const hist = (Array.isArray(history) ? history : []).map(num).filter((x) => x !== null);
  const cur = premBps !== null ? num(premBps) : (hist.length ? hist[hist.length - 1] : null);
  const window = hist.slice(-lb);
  const n = window.length;
  if (cur === null) return { premBps: null, mean: null, sd: null, z: null, percentile: null, n, stretched: false };
  const { mean, sd } = meanSd(window);
  const z = (sd && sd > 0) ? (cur - mean) / sd : null;
  const pct = percentile(window.concat(cur).sort((a, b) => a - b), n ? n / (n + 1) : 0.5);
  const stretched = n >= 60 && z !== null && Math.abs(z) >= 2;
  return {
    premBps: cur,
    mean: mean !== null ? Math.round(mean * 100) / 100 : null,
    sd: sd !== null ? Math.round(sd * 100) / 100 : null,
    z: z !== null ? Math.round(z * 1000) / 1000 : null,
    percentile: pct,
    n,
    stretched,
  };
}

/** Directional read for conviction mesh / extreme veto. */
export function hgVenuePremiumVote(zRead, dir) {
  if (!zRead || zRead.z === null || !zRead.stretched) {
    return { vote: 'neutral', note: 'venue premium not stretched', extremeVeto: false };
  }
  const z = zRead.z;
  const d = String(dir || '').toLowerCase();
  let vote = 'neutral';
  let note = 'venue premium z=' + z.toFixed(2);
  if (z >= 2) {
    vote = d === 'short' ? 'long' : (d === 'long' ? 'short' : 'neutral');
    note = 'Delta STRETCHED PREMIUM — local books crowded long · headwind on new longs';
  } else if (z <= -2) {
    vote = d === 'long' ? 'long' : (d === 'short' ? 'short' : 'neutral');
    note = 'Delta STRETCHED DISCOUNT — local books crowded short · headwind on new shorts';
  }
  const extremeVeto = Math.abs(z) >= 3 && (
    (z >= 3 && d === 'long') || (z <= -3 && d === 'short')
  );
  return { vote, note, extremeVeto, z };
}

export function hgVenuePremiumRingPush(history, premBps, maxLen = 300) {
  const h = Array.isArray(history) ? history.slice() : [];
  const v = num(premBps);
  if (v !== null) {
    h.push(v);
    while (h.length > maxLen) h.shift();
  }
  return h;
}
