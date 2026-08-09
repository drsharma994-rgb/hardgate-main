/* HARDGATE — Atomic Agents pipeline (Eigenwise/atomic-agents inspired).
   Modular single-purpose agents with explicit input/output schemas.
   https://github.com/Eigenwise/atomic-agents — MIT patterns, native JS engines. */

export const ATOMIC_VENUES = ['delta', 'coindcx'];

/** Pipeline agent definitions (atomic: one job each). */
export const ATOMIC_AGENT_CHAIN = [
  {
    id: 'delta-scout',
    label: 'Delta Scout',
    role: 'venue-scout',
    venue: 'delta',
    description: 'Scan Delta India perps for 7/7 swing/scalp gate-clean setups',
  },
  {
    id: 'coindcx-scout',
    label: 'CoinDCX Scout',
    role: 'venue-scout',
    venue: 'coindcx',
    description: 'Scan CoinDCX USDT futures for gate-clean setups',
  },
  {
    id: 'cross-venue-ranker',
    label: 'Cross-Venue Ranker',
    role: 'ranker',
    description: 'Pick best setup per base asset; flag cross-venue basis',
  },
  {
    id: 'setup-composer',
    label: 'Setup Composer',
    role: 'composer',
    description: 'Merge ranked setups into actionable desk output',
  },
];

export function atomicCapabilities(env){
  env = env || {};
  var top = +(env.ATOMIC_SCAN_TOP || 18);
  return {
    ok: true,
    inspiredBy: 'https://github.com/Eigenwise/atomic-agents',
    attribution: 'Atomic Agents patterns · HARDGATE gates + xuniverse',
    scanTop: top,
    venues: ATOMIC_VENUES,
    agents: ATOMIC_AGENT_CHAIN,
    routes: {
      capabilities: '/api/atomic/capabilities',
      scan: '/api/atomic/scan',
      desk: '/api/atomic/desk',
    },
  };
}

export function rankCrossVenue(deltaSetups, cdcxSetups){
  var byBase = {};
  function add(list, venue){
    for (var i = 0; i < (list || []).length; i++){
      var s = list[i];
      if (!s || !s.base) continue;
      var key = String(s.base).toUpperCase();
      if (!byBase[key]) byBase[key] = {};
      if (!byBase[key][venue] || setupScore(s) > setupScore(byBase[key][venue])){
        byBase[key][venue] = s;
      }
    }
  }
  add(deltaSetups, 'delta');
  add(cdcxSetups, 'coindcx');

  var ranked = [];
  for (var base in byBase){
    if (!Object.prototype.hasOwnProperty.call(byBase, base)) continue;
    var legs = byBase[base];
    var d = legs.delta;
    var c = legs.coindcx;
    var best = null;
    var bestVenue = null;
    if (d && c){
      if (setupScore(d) >= setupScore(c)){ best = d; bestVenue = 'delta'; }
      else { best = c; bestVenue = 'coindcx'; }
    } else if (d){ best = d; bestVenue = 'delta'; }
    else if (c){ best = c; bestVenue = 'coindcx'; }
    if (!best) continue;
    var basisBps = null;
    var alt = bestVenue === 'delta' ? c : d;
    if (alt && isFinite(+best.mark) && isFinite(+alt.mark) && +best.mark > 0 && +alt.mark > 0){
      basisBps = ((+best.mark - +alt.mark) / ((+best.mark + +alt.mark) / 2)) * 10000;
    }
    ranked.push(Object.assign({}, best, {
      bestVenue: bestVenue,
      score: setupScore(best),
      basisBps: basisBps,
      alsoOn: alt ? (bestVenue === 'delta' ? 'coindcx' : 'delta') : null,
      alternateSym: alt ? alt.sym : null,
    }));
  }
  ranked.sort(function(a, b){ return (b.score || 0) - (a.score || 0); });
  return ranked;
}

export function setupScore(s){
  if (!s) return 0;
  var score = 0;
  if (s.clean7 || s.clean === true) score += 40;
  else if (s.nearClean) score += 20;
  if (s.style === 'swing') score += 8;
  if (s.style === 'scalp') score += 6;
  if (isFinite(+s.rr)) score += Math.min(15, +s.rr * 4);
  if (isFinite(+s.turnoverUsd)) score += Math.min(10, Math.log10(+s.turnoverUsd + 1));
  if (s.prime) score += 12;
  return score;
}

export function composeAtomicDesk(pipeline){
  pipeline = pipeline || {};
  var delta = pipeline.delta || {};
  var cdcx = pipeline.coindcx || {};
  var ranked = pipeline.ranked || rankCrossVenue(delta.setups, cdcx.setups);
  return {
    at: pipeline.at || new Date().toISOString(),
    source: 'atomic-pipeline',
    swarmScore: Math.min(100, Math.round(ranked.slice(0, 5).reduce(function(a, s){ return a + setupScore(s); }, 0) / 3)),
    delta: { count: (delta.setups || []).length, scanned: delta.scanned || 0, ms: delta.ms || 0 },
    coindcx: { count: (cdcx.setups || []).length, scanned: cdcx.scanned || 0, ms: cdcx.ms || 0 },
    bestSetups: ranked.slice(0, 15),
    topFindings: ranked.slice(0, 12).map(function(s){
      return {
        sym: s.sym,
        dir: s.dir,
        venue: s.exchange || s.bestVenue,
        score: s.score,
        clean7: !!(s.clean7 || s.clean),
        entry: s.entry,
        stop: s.stop,
        t1: s.t1,
        style: s.style,
        note: (s.bestVenue ? s.bestVenue.toUpperCase() : '') + (s.basisBps != null ? ' · basis ' + s.basisBps.toFixed(1) + ' bps' : '') + (s.alsoOn ? ' · also ' + s.alsoOn : ''),
        agentLabel: 'Atomic ' + (s.bestVenue || 'ranker'),
        asset: 'crypto',
      };
    }),
  };
}
