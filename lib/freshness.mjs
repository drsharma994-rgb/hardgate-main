/* HARDGATE — universal bar-age freshness (fix pack 15). */

const DEFAULT_MAX = { '15m': 2, '1h': 2, '4h': 1, '1d': 1 };

export function hgBarFreshnessChip(barAge, tf = '4h') {
  if (!Number.isFinite(barAge)) return { html: '', label: '', stale: false };
  if (barAge === 0) {
    return { html: 'FRESH', label: 'FRESH', stale: false, barAge };
  }
  const max = DEFAULT_MAX[String(tf).toLowerCase()] ?? 2;
  if (barAge <= max) {
    return { html: 'ACTIVE', label: 'ACTIVE', stale: false, barAge };
  }
  return { html: 'STALE', label: 'STALE', stale: true, barAge, veto: true };
}

export function hgBarFreshnessVeto(barAge, tf = '4h') {
  const c = hgBarFreshnessChip(barAge, tf);
  return !!c.veto;
}

export function hgFreshnessMaxBars(tf) {
  return DEFAULT_MAX[String(tf).toLowerCase()] ?? 2;
}
