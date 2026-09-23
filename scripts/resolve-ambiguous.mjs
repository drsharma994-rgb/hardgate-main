#!/usr/bin/env node
/**
 * hg-v932 — resolve the bars that decide OMNIGOLD's sign.
 *
 * hg-v931 measured what the ambiguity costs. A `both-touch` row is a bar whose
 * range holds the stop AND the target; the order inside it is unknowable at
 * bar resolution, so both gold walks resolve it stop-first. OMNIGOLD carries
 * 672 of them — 8.3% of its filled book — against 23 (0.9%) on GOLD SCALP,
 * because its scalp lane runs on 1h bars and GOLD SCALP's on 15m.
 *
 * Those rows are not a footnote. They are the entire reason OMNIGOLD's win
 * rate reads 30.4% at one fill bound and 38.6% at the other — below its 33.3%
 * breakeven at one end and above it at the other. Every OMNIGOLD verdict since
 * hg-v918 has had to be stated twice because of them.
 *
 * A FINER BAR INSIDE THE AMBIGUOUS ONE ANSWERS IT. This runs as its own pass
 * over a committed results artifact rather than inside the walk, for three
 * reasons: it can be re-run without a full re-bake, it cannot destabilise the
 * walk it post-processes, and it can be tested with an injected fetch, which
 * matters because the network route is frequently unavailable (HTTP 451 / a
 * proxy refusal) on the machines this is developed on.
 *
 * IT FAILS CONSERVATIVE, EVERYWHERE. No finer bars, a window they do not
 * cover, a finer bar that itself holds both levels, a fetch that throws — each
 * leaves the row exactly as the stop-first walk recorded it. The pass reports
 * how many it could not resolve rather than quietly shrinking the problem.
 *
 * Usage:
 *   node scripts/resolve-ambiguous.mjs <results.json> [--write] [--tf=1m]
 *
 * Route: honours HG_KLINES_BASE / HG_KLINES_PROXY exactly as the backtests do
 * (hg-v921), so a mirror or the repo's own /api/proxy both work.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { klinesUrl, klinesRouteNote } from '../lib/klines-source.mjs';
import { resolveAmbiguousBar, applyResolution } from '../lib/ambiguous-bar.mjs';

export const TF_SEC = { '1m': 60, '3m': 180, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400 };

/** Bar length of the walk a row came from — the window we must look inside. */
export function rowBarSec(row){
  const h = String(row && row.horizon || '').toUpperCase();
  if (h === 'SCALP') return TF_SEC['1h'];
  if (h === 'SWING') return TF_SEC['4h'];
  return TF_SEC['15m'];           /* GOLD SCALP's walk */
}

export function isAmbiguous(row){
  return !!row && /both-touch/.test(String(row.outcome || ''));
}

/** Planned reward multiple, so a resolved win is credited at the real number. */
export function plannedRr(row){
  const r = Math.abs(+row.entry - +row.stop), w = Math.abs(+row.t1 - +row.entry);
  return (r > 0 && isFinite(w)) ? w / r : NaN;
}

/** Binance kline tuples -> the bar shape the resolver reads. */
export function toBars(raw){
  if (!Array.isArray(raw)) return [];
  return raw.map(k => ({ t: Math.floor(+k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4] }))
            .filter(b => isFinite(b.t) && isFinite(b.h) && isFinite(b.l));
}

/**
 * The pass. `deps.fetchBars(symbol, tf, startSec, endSec)` is injected so this
 * is testable with no network at all; the default goes through klinesUrl.
 */
export async function resolveArtifact(artifact, opts){
  const o = opts || {};
  const tf = o.tf || '1m';
  const tfSec = TF_SEC[tf];
  if (!tfSec) throw new Error('resolve-ambiguous: unknown timeframe ' + tf);
  const symbol = o.symbol || 'PAXGUSDT';
  const fetchBars = o.fetchBars || defaultFetchBars;

  const trades = (artifact && artifact.trades) || [];
  const stats = { total: trades.length, ambiguous: 0, resolved: 0, toStop: 0, toTarget: 0,
                  unresolved: 0, fetchFailures: 0, reasons: {}, tf, symbol };

  for (const row of trades){
    if (!isAmbiguous(row)) continue;
    stats.ambiguous++;
    const exitSec = Math.floor(Date.parse(row.exitISO) / 1000);
    if (!isFinite(exitSec)){
      stats.unresolved++; stats.reasons['no exit timestamp'] = (stats.reasons['no exit timestamp'] || 0) + 1;
      applyResolution(row, { verdict: null, reason: 'no exit timestamp' });
      continue;
    }
    const barSec = rowBarSec(row);
    let bars = [];
    try { bars = await fetchBars(symbol, tf, exitSec, exitSec + barSec); }
    catch (e){
      stats.fetchFailures++; stats.unresolved++;
      const why = 'finer bars unavailable: ' + ((e && e.message) || String(e));
      stats.reasons[why] = (stats.reasons[why] || 0) + 1;
      applyResolution(row, { verdict: null, reason: why });
      continue;
    }
    const res = resolveAmbiguousBar(bars, {
      dir: row.dir, stop: +row.stop, t1: +row.t1,
      barStartSec: exitSec, barEndSec: exitSec + barSec
    });
    applyResolution(row, res, plannedRr(row));
    if (res.verdict){
      stats.resolved++;
      if (res.verdict === 'stop') stats.toStop++; else stats.toTarget++;
    } else {
      stats.unresolved++;
      stats.reasons[res.reason] = (stats.reasons[res.reason] || 0) + 1;
    }
  }
  return stats;
}

async function defaultFetchBars(symbol, tf, startSec, endSec){
  const { url } = klinesUrl({ symbol, interval: tf, startTime: startSec * 1000,
                              endTime: endSec * 1000, limit: 1000 });
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return toBars(await r.json());
}

if (process.argv[1] && process.argv[1].endsWith('resolve-ambiguous.mjs')){
  const file = process.argv.find(a => a.endsWith('.json'));
  if (!file){ console.error('usage: node scripts/resolve-ambiguous.mjs <results.json> [--write] [--tf=1m]'); process.exit(2); }
  const tfArg = (process.argv.find(a => a.startsWith('--tf=')) || '').slice(5) || '1m';
  const art = JSON.parse(readFileSync(file, 'utf8'));
  console.log('route: ' + klinesRouteNote());
  const stats = await resolveArtifact(art, { tf: tfArg });
  console.log(JSON.stringify(stats, null, 2));
  if (stats.ambiguous && !stats.resolved){
    console.log('\nNOTHING RESOLVED — every row kept the conservative stop-first outcome.');
    console.log('That is the designed failure mode, not a crash. Check the route above.');
  }
  if (process.argv.includes('--write')){
    if (!stats.resolved){
      console.log('\nrefusing to rewrite ' + file + ': nothing was resolved, so the file would change only by gaining "unresolved" flags');
    } else {
      art.ambiguityResolution = stats;
      writeFileSync(file, JSON.stringify(art, null, 2));
      console.log('\nwrote ' + file + ' — ' + stats.resolved + ' rows resolved');
    }
  }
}
