/* HARDGATE — gate attribution + shadow book. */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function createGateRecorder() {
  const counts = new Map();
  const events = [];

  return {
    record(gateName, ok, ctx = {}) {
      const g = String(gateName || 'unknown');
      if (!counts.has(g)) counts.set(g, { pass: 0, veto: 0 });
      counts.get(g)[ok ? 'pass' : 'veto'] += 1;
      events.push({
        t: Date.now(), gate: g, ok: !!ok,
        symbol: ctx.symbol ?? null, reason: ctx.reason ?? null, fqs: num(ctx.fqs),
      });
      if (events.length > 500) events.splice(0, events.length - 500);
      return ok;
    },
    wrap(gateName, fn) {
      return (...args) => {
        const res = fn(...args);
        const ok = typeof res === 'boolean' ? res : res?.ok !== false;
        this.record(gateName, ok, {
          symbol: args?.[0]?.symbol ?? args?.[0]?.sym,
          reason: typeof res === 'object' ? res?.reason : null,
        });
        return res;
      };
    },
    summary() {
      const rows = [...counts].map(([gate, c]) => ({
        gate, pass: c.pass, veto: c.veto,
        vetoRate: c.pass + c.veto ? Math.round((c.veto / (c.pass + c.veto)) * 100) : 0,
      })).sort((a, b) => b.veto - a.veto);
      return { rows, events: events.slice(-100) };
    },
    reset() { counts.clear(); events.length = 0; },
  };
}

export function shadowResolve(shadowRows = [], priceLookup = () => null) {
  const byGate = new Map();
  let resolved = 0;
  for (const r of Array.isArray(shadowRows) ? shadowRows : []) {
    const entry = num(r?.entry), stop = num(r?.stop), target = num(r?.target);
    if (entry === null || stop === null || target === null) continue;
    const px = priceLookup(r.symbol, r.ts);
    const hi = num(px?.high), lo = num(px?.low);
    if (hi === null || lo === null) continue;
    const long = String(r.side || 'long').toLowerCase() !== 'short';
    const risk = Math.abs(entry - stop) || 1;
    const hitStop = long ? lo <= stop : hi >= stop;
    const hitTgt = long ? hi >= target : lo <= target;
    const R = hitStop ? -1 : hitTgt ? Math.abs(target - entry) / risk : 0;
    if (!hitStop && !hitTgt) continue;
    resolved += 1;
    const g = String(r.vetoGate || 'unknown');
    if (!byGate.has(g)) byGate.set(g, { n: 0, sumR: 0, wins: 0 });
    const a = byGate.get(g);
    a.n += 1; a.sumR += R; if (R > 0) a.wins += 1;
  }
  const rows = [...byGate].map(([gate, a]) => ({
    gate, n: a.n,
    expR: Math.round((a.sumR / a.n) * 1000) / 1000,
    winRate: Math.round((a.wins / a.n) * 100),
    verdict: a.sumR / a.n > 0.15 ? 'OVER-FILTERING' : a.sumR / a.n < -0.1 ? 'EARNING' : 'NEUTRAL',
  })).sort((x, y) => y.expR - x.expR);
  return { resolved, rows };
}
