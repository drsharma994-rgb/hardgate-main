#!/usr/bin/env node
/**
 * hg-v917 — the per-mechanic record OMNIGOLD displays, versus the one its own
 * bake already computed.
 *
 * HG_OG_REPLAY_EVIDENCE.kinds in omnigold.js is `perKind` from
 * scripts/omnigold-replay-evidence.json: every settled firing of a detector
 * across the whole walk, priced at the replay's PAXG round trip. The card
 * renders it, and hgOgReplayNetAtVenue reprices that number to the desk's
 * venue at render time.
 *
 * The SAME committed file also carries `sequentialBake.formedByKind` — the
 * same 54 mechanics scoped to the GATE-CLEAR population (what survived the
 * 35-gate stack the fingerprint names), with netR_xm already computed. Nobody
 * reads it. Repricing an unscoped population is not the same correction as
 * measuring the scoped one, and for 43 of the 54 the scoped record is WORSE
 * than what the card shows.
 *
 * This reports both so the difference is a number rather than an argument.
 * It decides nothing: omnigold.js carries the figures and
 * tests/test-omnigold-formed-population.mjs re-derives them from the JSON.
 *
 * Usage: node scripts/omnigold-formed-population.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const EVIDENCE = join(HERE, 'omnigold-replay-evidence.json');

/* Both are the bake's own costModel, echoed rather than re-chosen. */
export const PAXG_RT_PCT = 0.26;
export const XM_RT_PCT = 0.020;

const r3 = (x) => Math.round(x * 1000) / 1000;

/** What hgOgReplayNetAtVenue renders: the displayed PAXG net, re-priced.
 *  costR scales linearly with the round trip — hgOgVenueNet's own rule. */
export function repriceToXm(avgGrossR, avgNetR){
  const cost = avgGrossR - avgNetR;
  return avgGrossR - cost * (XM_RT_PCT / PAXG_RT_PCT);
}

export function formedPopulation(path = EVIDENCE){
  const e = JSON.parse(readFileSync(path, 'utf8'));
  const perKind = e.perKind || {};
  const formed = (e.sequentialBake && e.sequentialBake.formedByKind) || {};

  const rows = {};
  for (const [kind, v] of Object.entries(perKind)){
    const f = formed[kind];
    /* absent is absent — a kind with no gate-clear row gets null, never a
       zero-fill that would read as a measured flat record */
    rows[kind] = {
      shownN: v.n,
      shownNetPaxg: v.avgNetR,
      shownNetXm: r3(repriceToXm(v.avgGrossR, v.avgNetR)),
      /* SETTLED, not the firing count. winRate and netR_xm in formedByKind are
         both over `settled`; `n` also counts rows that never filled. Rendering
         `n=204` beside a rate computed on 177 would misstate the denominator,
         and 43 of the 54 kinds have the two differing. The firing count is
         kept alongside rather than dropped — it is what `n` means on the
         unscoped half of the row. */
      formedN: f ? f.settled : null,
      formedFired: f ? f.n : null,
      formedWr: f ? f.winRate : null,
      formedNetXm: f ? r3(f.netR_xm) : null,
      formedGross: f ? r3(f.grossR) : null
    };
  }

  const vals = Object.values(rows).filter((r) => r.formedNetXm !== null);
  const pops = (e.sequentialBake && e.sequentialBake.populations) || {};
  return {
    rows,
    summary: {
      kinds: Object.keys(rows).length,
      withFormed: vals.length,
      formedWorse: vals.filter((r) => r.formedNetXm < r.shownNetXm).length,
      formedBetter: vals.filter((r) => r.formedNetXm > r.shownNetXm).length,
      positiveShown: vals.filter((r) => r.shownNetXm > 0).length,
      positiveFormed: vals.filter((r) => r.formedNetXm > 0).length,
      signDiffers: vals.filter((r) => (r.shownNetXm > 0) !== (r.formedNetXm > 0)).length
    },
    populations: {
      formed: pops.formed || null,
      sequential: pops.sequential || null,
      sequentialTickets: pops.sequentialTickets || null
    }
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])){
  const res = formedPopulation();
  if (process.argv.includes('--json')){ console.log(JSON.stringify(res, null, 2)); }
  else {
    const s = res.summary, p = res.populations;
    console.log('OMNIGOLD — the record the card shows vs the gate-clear record in the same file\n');
    console.log('  %s of %s kinds carry a gate-clear row', s.withFormed, s.kinds);
    console.log('  gate-clear read is WORSE for %d, better for %d', s.formedWorse, s.formedBetter);
    console.log('  net-positive at XM: %d as shown -> %d on the gate-clear record (%d differ in sign)',
      s.positiveShown, s.positiveFormed, s.signDiffers);
    if (p.formed) console.log('\n  whole formed book : n=%d  %s R at XM  (tCluster %s)',
      p.formed.n, p.formed.netR_xm.toFixed(4), p.formed.effective.tCluster);
    if (p.sequentialTickets) console.log('  sequential tickets: n=%d  %s R at XM  (tCluster %s)',
      p.sequentialTickets.n, p.sequentialTickets.netR_xm.toFixed(4), p.sequentialTickets.effective.tCluster);
    console.log('\n  ' + 'kind'.padEnd(18) + 'shown n'.padStart(8) + 'shown XM'.padStart(10)
      + ' | ' + 'formed n'.padStart(9) + 'formed XM'.padStart(11) + 'delta'.padStart(9));
    const ks = Object.entries(res.rows).filter(([, v]) => v.formedNetXm !== null)
      .sort((a, b) => (a[1].formedNetXm - a[1].shownNetXm) - (b[1].formedNetXm - b[1].shownNetXm));
    for (const [k, v] of ks.slice(0, 14)){
      console.log('  ' + k.padEnd(18) + String(v.shownN).padStart(8)
        + v.shownNetXm.toFixed(3).padStart(10) + ' | ' + String(v.formedN).padStart(9)
        + v.formedNetXm.toFixed(3).padStart(11)
        + (v.formedNetXm - v.shownNetXm).toFixed(3).padStart(9));
    }
  }
}
