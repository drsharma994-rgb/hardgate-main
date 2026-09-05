/* HARDGATE — nightly formation rebake (pure).
   Turns a rolling 40-day settled book (rebaked after 21:00 UTC) into demote /
   prefer / cost / OG1 floors / 19-desk tighten. Never loosens G1–G7,
   OMNIPRESENT 3+/2+, baked OMNIROUTE demotes, baked desk suppress/demote,
   or OG1 SL$ / displacement floors. Never invents direction or tickets.
   Reports expectancy in R — never a win-rate claim. */

export const BAKED_OP_COST_CEIL = 0.12;
export const OP_COST_FLOOR = 0.06;
export const BAKED_OG1_MIN_RISK = 5;
export const BAKED_OG1_MIN_DISP = 0.5;
export const DAY_MIN_N = 8;
export const DAY_DEMOTE_GROSS = -0.05;
export const DAY_DEMOTE_NET = -0.20;
export const NIGHTLY_HOUR_UTC = 21;
/* 120 1h bars (~5d) never hit n≥8 on the first night. 960 ≈ 40d so
   rare kinds can clear the anti-overfit floor. Rebaked after 21:00 UTC. */
export const DEFAULT_NIGHTLY_BARS = 960;

export const OG1_WHITELIST = [
  'raw', 'minRisk5', 'minDisp0.5', 'minRisk5+disp0.5'
];

export const BEST_KINDS = [
  'AVWAP-RECLAIM', 'CUSUM-SHIFT', 'DONCHIAN-DRIVE', 'MMOVE', 'NR7-BREAK'
];

export const DESK_RANK = { prefer: 1, watch: 2, demote: 3, suppress: 4 };

export const DESK_LABELS = {
  swing: 'SWING SCAN', scalp: 'SCALP SCAN', edge: 'EDGE', smart: 'SMART $',
  squeeze: 'SQUEEZE', reversalsniper: 'REVERSAL SNIPER', smc: 'SMC (FVG)',
  ob: 'ORDER BLOCKS', trap: 'LIQUIDITY TRAP', divergence: 'DIVERGENCE',
  coil: 'COIL WATCHLIST', 'coil-expansion': 'COIL EXPANSION', apex: 'APEX (RS)',
  oiflow: 'OI FLOW', liqs: 'LIQS', onchain: 'ON-CHAIN', chartvision: 'CHART VISION',
  carry: 'CARRY', venueprem: 'VENUE', termbasis: 'TERM BASIS', 'fund-fade': 'FUND-FADE'
};

/* Baked floors from desk-formation-edge.js. Nightly may only tighten. */
export const DESK_ANALOGUES = {
  scalp: [{ kind: 'NR7-BREAK', baked: 'prefer' }],
  squeeze: [{ kind: 'SQUEEZE-FIRE', baked: 'watch' }],
  reversalsniper: [
    { kind: 'PIN-REJECT', baked: 'demote' },
    { kind: 'EXHAUST-REVERT', baked: 'watch' }
  ],
  smc: [{ kind: 'FVG-FILL', baked: 'suppress' }],
  trap: [
    { kind: 'SWEEP-RECLAIM', baked: 'demote' },
    { kind: 'EQH-SWEEP', baked: 'demote' },
    { kind: 'EQL-SWEEP', baked: 'demote' }
  ],
  divergence: [{ kind: 'RSI-DIVERGE', baked: 'suppress' }],
  coil: [{ kind: 'COMPRESSION-BREAK', baked: 'watch' }],
  'coil-expansion': [{ kind: 'NR7-BREAK', baked: 'prefer' }]
};

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

export function tighterAction(a, b){
  const ra = DESK_RANK[a] || 0;
  const rb = DESK_RANK[b] || 0;
  return rb >= ra ? b : a;
}

export function mergeDeskAction(baked, nightTighten, nightPrefer){
  let action = baked || 'watch';
  if (nightTighten === 'suppress' || nightTighten === 'demote')
    action = tighterAction(action, nightTighten);
  if (nightPrefer === true && (action === 'watch' || action === 'prefer'))
    action = 'prefer';
  return action;
}

export function buildDeskNightly(orBags, orAside, orPrefer){
  const aside = new Set(orAside || []);
  const prefer = new Set(orPrefer || []);
  const bestConfirmKinds = BEST_KINDS.filter(k => !aside.has(k));
  const byTab = {};
  const suppress = [];
  const demote = [];
  const preferTabs = [];
  const tighten = [];
  for (const tab of Object.keys(DESK_LABELS)){
    const rows = DESK_ANALOGUES[tab] || [];
    let baked = null;
    let nightTighten = null;
    let nightPrefer = false;
    let hitKind = null;
    for (const row of rows){
      const rowBaked = row.baked || 'watch';
      baked = baked ? tighterAction(baked, rowBaked) : rowBaked;
      if (aside.has(row.kind)){
        nightTighten = tighterAction(nightTighten || 'watch', 'suppress');
        hitKind = row.kind;
      } else if (prefer.has(row.kind)){
        nightPrefer = true;
        if (!hitKind) hitKind = row.kind;
      }
    }
    if (!baked) baked = 'watch';
    const action = mergeDeskAction(baked, nightTighten, nightPrefer);
    const extra = (DESK_RANK[action] || 0) > (DESK_RANK[baked] || 0)
      || (action === 'prefer' && baked === 'watch');
    const why = hitKind
      ? (aside.has(hitKind)
        ? hitKind + ' day-aside — desk ' + action
        : hitKind + ' day-prefer — desk ' + action)
      : (baked !== 'watch' ? 'baked ' + baked : 'fail-open');
    byTab[tab] = {
      action, baked, analogue: hitKind || null,
      label: DESK_LABELS[tab], extra: extra === true, why
    };
    if (action === 'suppress') suppress.push(tab);
    else if (action === 'demote') demote.push(tab);
    else if (action === 'prefer') preferTabs.push(tab);
    if (extra) tighten.push(tab);
  }
  suppress.sort();
  demote.sort();
  preferTabs.sort();
  tighten.sort();
  return { suppress, demote, prefer: preferTabs, tighten, bestConfirmKinds, byTab };
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
  const desk = buildDeskNightly(orBags, orAside, orPrefer);
  return {
    asOf,
    dayUtc,
    src: 'nightly-formation-rebake',
    neverLoosen: [
      'G1-G7',
      'OMNIPRESENT 3+/2+',
      'baked OMNIROUTE demotes',
      'baked desk suppress/demote',
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
    desk,
    note: 'Rolling 40-day book retunes which setups form tomorrow across OMNIROUTE / OMNIPRESENT / OMNIGOLD 1 and the 19 desk tabs. Baked toxic kinds stay stood aside. Never invents tickets.'
  };
}

export function nightlyBannerText(j){
  if (!j || !j.dayUtc) return 'NIGHTLY FORMATION: no day book yet — baked replay floors still apply.';
  const aside = (j.omniroute && j.omniroute.dayAside) || [];
  const prefer = (j.omniroute && j.omniroute.dayPrefer) || [];
  const cost = j.omnipresent && isFinite(fin(j.omnipresent.costCeilingR))
    ? fin(j.omnipresent.costCeilingR).toFixed(2) : '0.12';
  const og = j.omnigold1 || {};
  const desk = j.desk || {};
  const tighten = desk.tighten || [];
  const deskBit = tighten.length
    ? 'desk tighten ' + tighten.map(id => {
        const row = desk.byTab && desk.byTab[id];
        return (row && row.label ? row.label : id) + '→' + (row && row.action ? row.action : 'tighten');
      }).join(', ')
    : 'desk tighten none';
  return 'NIGHTLY FORMATION ' + j.dayUtc
    + ' — OMNIROUTE aside ' + (aside.length ? aside.join(', ') : 'none')
    + ' · prefer ' + (prefer.length ? prefer.join(', ') : 'none')
    + ' · ' + deskBit
    + ' · OMNIPRESENT cost≤' + cost + 'R'
    + (j.omnipresent && j.omnipresent.standAsideTriggered ? ' · TRIGGERED stands aside (day fade book toxic)' : '')
    + ' · OG1 ' + (og.bestNamed || 'floors')
    + ' (SL$≥' + (og.minRisk || 5) + ' · disp≥' + (og.minDisp || 0.5) + '×ATR)'
    + ' — demote/tighten only, never loosens G1–G7.';
}
