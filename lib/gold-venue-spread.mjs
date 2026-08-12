/* HARDGATE — gold complex venue dislocation (fix pack 15). */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function hgGoldVenueSpread({ xauusdt, paxg, xaut, spot, cashOpen = true } = {}) {
  if (!cashOpen) {
    return {
      gated: true,
      note: 'Cash gold market closed — weekend/holiday spreads are structural, not positioning',
      spreads: {},
      maxAbsBps: null,
      z: null,
      dislocated: false,
      richest: null,
      cheapest: null,
      darkVenues: [],
    };
  }

  const s = num(spot);
  const legs = {
    xauusdt: num(xauusdt),
    paxg: num(paxg),
    xaut: num(xaut),
    spot: s,
  };
  const darkVenues = [];
  if (s === null || !(s > 0)) darkVenues.push('spot');

  const spreads = {};
  let maxAbs = 0;
  let richest = null;
  let cheapest = null;

  for (const k of ['xauusdt', 'paxg', 'xaut']) {
    const px = legs[k];
    if (px === null || s === null) {
      spreads[k] = null;
      darkVenues.push(k);
      continue;
    }
    const bps = ((px - s) / s) * 10000;
    spreads[k] = Math.round(bps * 10) / 10;
    const ab = Math.abs(bps);
    if (ab > maxAbs) maxAbs = ab;
    if (richest === null || bps > spreads[richest]) richest = k;
    if (cheapest === null || bps < spreads[cheapest]) cheapest = k;
  }

  return {
    gated: false,
    spreads,
    maxAbsBps: maxAbs,
    z: null,
    dislocated: maxAbs >= 25,
    richest,
    cheapest,
    darkVenues,
    note: maxAbs >= 25
      ? 'tokenised gold dislocated vs spot — crowded side may mean-revert'
      : 'complex spreads within normal band',
  };
}

export function hgGoldVenueSpreadZ(history = [], premBps, lookback = 240) {
  const hist = (Array.isArray(history) ? history : []).map(num).filter((x) => x !== null);
  const cur = num(premBps);
  const window = hist.slice(-lookback);
  const n = window.length;
  if (cur === null || !n) return { z: null, n, stretched: false };
  let sum = 0;
  for (let i = 0; i < window.length; i++) sum += window[i];
  const mean = sum / n;
  let v = 0;
  for (let i = 0; i < window.length; i++) v += (window[i] - mean) ** 2;
  const sd = Math.sqrt(v / n);
  const z = sd > 0 ? (cur - mean) / sd : null;
  return { z, n, stretched: n >= 60 && z !== null && Math.abs(z) >= 2 };
}

export function hgGoldVenueDislocationVeto(spreadRead, zRead, dir) {
  const d = String(dir || '').toLowerCase();
  if (!spreadRead || spreadRead.gated) return { veto: false, dark: true };
  const z = zRead?.z;
  if (z === null || z === undefined) return { veto: false, dark: spreadRead.darkVenues?.length > 0 };
  if (z >= 3 && d === 'long') return { veto: true, dark: false, note: 'token gold stretched premium vs spot' };
  if (z <= -3 && d === 'short') return { veto: true, dark: false, note: 'token gold stretched discount vs spot' };
  return { veto: false, dark: false };
}

export function hgGoldVenueRingPush(history, bps, maxLen = 300) {
  const h = Array.isArray(history) ? history.slice() : [];
  const v = num(bps);
  if (v !== null) {
    h.push(v);
    while (h.length > maxLen) h.shift();
  }
  return h;
}
