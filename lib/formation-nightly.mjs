/* HARDGATE — nightly formation rebake (pure).
   Turns one UTC day's settled book into demote / prefer / cost / OG1 floors.
   Never loosens G1–G7, OMNIPRESENT 3+/2+, baked OMNIROUTE demotes, or OG1
   SL$ / displacement floors. Never invents direction or tickets.
   Reports expectancy in R — never a win-rate claim. */

export const BAKED_OP_COST_CEIL = 0.12;
export const OP_COST_FLOOR = 0.06;
export const BAKED_OG1_MIN_RISK = 5;
export const BAKED_OG1_MIN_DISP = 0.5;
export const DAY_MIN_N = 8;
export const DAY_DEMOTE_GROSS = -0.05;
export const DAY_DEMOTE_NET = -0.20;
export const NIGHTLY_HOUR_UTC = 21;

export const OG1_WHITELIST = [
  'raw', 'minRisk5', 'minDisp0.5', 'minRisk5+disp0.5'
];

export const REVERSION_KINDS = [
  'VALUE', 'VWAP-REVERT', 'ABSORB', 'PIN-REJECT', 'POC-REVERT',
  'EXHAUST-REVERT', 'RSI-DIVERGE', 'OP-HIGH-REJECT', 'OP-LOW-REJECT'
];

function fin(x){
  const n = +x;
  return isFinite(n) ? n : NaN;
}

function utcDay(ms){
  return new Date(ms).toISOString().slice(0, 10);
}

export function nightlyDue(lastAt, now){
  const t = now instanceof Date ? now.getTime() : +now;
  if (!isFinite(t)) return false;
  const d = new Date(t);
  if (d.getUTCHours() < NIGHTLY_HOUR_UTC) return false;
  if (!lastAt) return true;
  const prev = Date.parse(lastAt);
  if (!isFinite(prev)) return true;
  return utcDay(prev) !== utcDay(t);
}

export function bag(list){
  const rows = (list || []).filter(t => t && isFinite(fin(t.netR)));
  const n = rows.length;
  if (!n) return { n: 0, avgGross: null, avgNet: null };
  const g = rows.reduce((s, t) => s + (fin(t.rMultiple) || fin(t.grossR) || 0), 0);
  const net = rows.reduce((s, t) => s + (fin(t.netR) || 0), 0);
  return { n, avgGross: +(g / n).toFixed(4), avgNet: +(net / n).toFixed(4) };
}

export function kindBags(list, key){
  const k = key || 'mechanic';
  const out = {};
  for (const t of list || []){
    const name = String((t && t[k]) || t && t.kind || '').toUpperCase();
    if (!name) continue;
    (out[name] || (out[name] = [])).push(t);
  }
  const bags = {};
  for (const name of Object.keys(out)) bags[name] = bag(out[name]);
  return bags;
}

export function dayAsideKinds(byKind, minN){
  const floorN = isFinite(minN) ? minN : DAY_MIN_N;
  const out = [];
  for (const [k, v] of Object.entries(byKind || {})){
    if (!v || !(v.n >= floorN)) continue;
    const g = fin(v.avgGross);
    const n = fin(v.avgNet);
    if (isFinite(g) && g <= DAY_DEMOTE_GROSS) out.push(k);
    else if (isFinite(g) && g < 0 && isFinite(n) && n <= DAY_DEMOTE_NET) out.push(k);
    else if (!isFinite(g) && isFinite(n) && n <= DAY_DEMOTE_NET) out.push(k);
  }
  out.sort();
  return out;
}

export function dayPreferKinds(byKind, minN, aside){
  const floorN = isFinite(minN) ? minN : DAY_MIN_N;
  const blocked = new Set(aside || []);
  const out = [];
  for (const [k, v] of Object.entries(byKind || {})){
    if (blocked.has(k)) continue;
    if (!v || !(v.n >= floorN)) continue;
    if (fin(v.avgGross) > 0 && fin(v.avgNet) > 0) out.push(k);
  }
  out.sort();
  return out;
}

export function tightenCostCeil(dayFadeBag, baked){
  const cap = isFinite(baked) ? baked : BAKED_OP_COST_CEIL;
  let next = cap;
  if (dayFadeBag && dayFadeBag.n >= DAY_MIN_N && isFinite(fin(dayFadeBag.avgNet))){
    if (dayFadeBag.avgNet <= -0.30) next = Math.min(next, 0.08);
    else if (dayFadeBag.avgNet <= -0.15) next = Math.min(next, 0.10);
  }
  if (next > cap) next = cap;
  if (next < OP_COST_FLOOR) next = OP_COST_FLOOR;
  return +next.toFixed(3);
}

export function pickOg1Apply(variants){
  const floors = { minRisk: BAKED_OG1_MIN_RISK, minDisp: BAKED_OG1_MIN_DISP, gated: false, biasSide: false };
  const ranked = Object.entries(variants || {})
    .filter(([name, v]) => OG1_WHITELIST.includes(name) && v && v.resolved >= 4 && isFinite(fin(v.expR)))
    .sort((a, b) => fin(b[1].expR) - fin(a[1].expR));
  const best = ranked[0];
  if (!best){
    return Object.assign({ bestNamed: 'minRisk5+disp0.5', dayExpR: null }, floors);
  }
  const name = best[0];
  const apply = Object.assign({ bestNamed: name, dayExpR: +fin(best[1].expR).toFixed(4) }, floors);
  if (name === 'minRisk5' || name === 'minRisk5+disp0.5') apply.minRisk = Math.max(apply.minRisk, 5);
  if (name === 'minDisp0.5' || name === 'minRisk5+disp0.5') apply.minDisp = Math.max(apply.minDisp, 0.5);
  return apply;
}

export function statsFromBacktestAll(perKind){
  const bags = {};
  for (const [k, s] of Object.entries(perKind || {})){
    if (!s || !(s.samples > 0) || !isFinite(fin(s.expR))) continue;
    const exp = fin(s.expR);
    bags[k.toUpperCase()] = {
      n: s.samples,
      avgGross: +exp.toFixed(4),
      avgNet: +(exp - 0.16).toFixed(4)
    };
  }
  return bags;
}

export function fadeBagFromKinds(byKind){
  const rows = [];
  for (const k of REVERSION_KINDS){
    const v = byKind && byKind[k];
    if (!v || !v.n) continue;
    for (let i = 0; i < v.n; i++){
      rows.push({ netR: v.avgNet, rMultiple: v.avgGross, mechanic: k });
    }
  }
  return bag(rows);
}

export function clampOg1Floors(edge){
  const e = edge || {};
  return {
    minRisk: Math.max(BAKED_OG1_MIN_RISK, isFinite(fin(e.minRisk)) ? fin(e.minRisk) : BAKED_OG1_MIN_RISK),
    minDisp: Math.max(BAKED_OG1_MIN_DISP, isFinite(fin(e.minDisp)) ? fin(e.minDisp) : BAKED_OG1_MIN_DISP),
    gated: e.gated === true,
    biasSide: e.biasSide === true,
    bestNamed: e.bestNamed || 'minRisk5+disp0.5',
    dayExpR: isFinite(fin(e.dayExpR)) ? fin(e.dayExpR) : null
  };
}

export function buildNightlyApply(inp){
  const asOf = inp && inp.asOf ? String(inp.asOf) : new Date().toISOString();
  const dayUtc = inp && inp.dayUtc ? String(inp.dayUtc) : utcDay(Date.parse(asOf) || Date.now());
  const orBags = inp && inp.omnirouteBags
    ? inp.omnirouteBags
    : kindBags(inp && inp.omnirouteTrades, 'mechanic');
  const orAside = dayAsideKinds(orBags);
  const orPrefer = dayPreferKinds(orBags, DAY_MIN_N, orAside);
  const fade = inp && inp.omnipresentBag
    ? inp.omnipresentBag
    : (inp && inp.omnipresentTrades
      ? bag(inp.omnipresentTrades)
      : fadeBagFromKinds(orBags));
  const og1 = clampOg1Floors(pickOg1Apply(inp && inp.og1Variants));
  const costCeilingR = tightenCostCeil(fade, BAKED_OP_COST_CEIL);
  const standAsideTriggered = !!(fade && fade.n >= DAY_MIN_N && isFinite(fin(fade.avgNet)) && fade.avgNet <= -0.25);
  return {
    asOf,
    dayUtc,
    src: 'nightly-formation-rebake',
    neverLoosen: [
      'G1-G7',
      'OMNIPRESENT 3+/2+',
      'baked OMNIROUTE demotes',
      'OG1 SL$ >= $5',
      'OG1 displacement >= 0.5 ATR'
    ],
    omniroute: {
      dayBags: orBags,
      dayAside: orAside,
      dayPrefer: orPrefer
    },
    omnipresent: {
      fadeBag: fade,
      costCeilingR,
      standAsideTriggered,
      goldAside: true
    },
    omnigold1: og1,
    note: 'Day book retunes which setups form tomorrow. Baked toxic kinds stay stood aside. Never invents tickets.'
  };
}

export function nightlyBannerText(j){
  if (!j || !j.dayUtc) return 'NIGHTLY FORMATION: no day book yet — baked replay floors still apply.';
  const aside = (j.omniroute && j.omniroute.dayAside) || [];
  const prefer = (j.omniroute && j.omniroute.dayPrefer) || [];
  const cost = j.omnipresent && isFinite(fin(j.omnipresent.costCeilingR))
    ? fin(j.omnipresent.costCeilingR).toFixed(2) : '0.12';
  const og = j.omnigold1 || {};
  return 'NIGHTLY FORMATION ' + j.dayUtc
    + ' — OMNIROUTE aside ' + (aside.length ? aside.join(', ') : 'none')
    + ' · prefer ' + (prefer.length ? prefer.join(', ') : 'none')
    + ' · OMNIPRESENT cost≤' + cost + 'R'
    + (j.omnipresent && j.omnipresent.standAsideTriggered ? ' · TRIGGERED stands aside (day fade book toxic)' : '')
    + ' · OG1 ' + (og.bestNamed || 'floors')
    + ' (SL$≥' + (og.minRisk || 5) + ' · disp≥' + (og.minDisp || 0.5) + '×ATR)'
    + ' — demote/tighten only, never loosens G1–G7.';
}
