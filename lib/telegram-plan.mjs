/** Shared COIN / ENTRY / STOP LOSS / TAKE PROFIT block for Telegram (Node + tests). */

export function fmtPx(n) {
  const x = +n;
  if (!Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  const d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  try {
    return Number(x).toLocaleString('en-US', { maximumFractionDigits: d });
  } catch (e) {
    return String(x);
  }
}

/** @param {{ sym?: string, coin?: string, dir?: string, entry?: number, stop?: number, t1?: number, t2?: number, target?: number }} opts */
export function telegramPlanBlock(opts) {
  opts = opts || {};
  const sym = opts.sym != null ? String(opts.sym) : (opts.coin != null ? String(opts.coin) : '—');
  const dir = opts.dir != null ? String(opts.dir).toUpperCase() : '—';
  const t1 = opts.t1 != null ? opts.t1 : opts.target;
  const lines = [
    'COIN: ' + sym,
    'SIDE: ' + dir,
    'ENTRY: ' + fmtPx(opts.entry),
    'STOP LOSS: ' + fmtPx(opts.stop),
    'TAKE PROFIT 1: ' + fmtPx(t1)
  ];
  if (opts.t2 != null && Number.isFinite(+opts.t2)) lines.push('TAKE PROFIT 2: ' + fmtPx(opts.t2));
  return lines.join('\n');
}

export function hasPlanLevels(o) {
  return !!(o && Number.isFinite(+o.entry) && Number.isFinite(+o.stop) && Number.isFinite(+o.t1));
}
