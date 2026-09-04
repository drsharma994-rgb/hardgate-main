#!/usr/bin/env node
/* HARDGATE — counterfactual on committed gold + omni replay books.
   Measures what CURRENT and PROPOSED formation filters would have kept.
   Does not invent trades. Run: node scripts/analyze-bt-improve.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const OUT = path.join(ROOT, 'scripts', 'bt-improve-analysis.json');

const gold = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'backtest-omnigold-results.json'), 'utf8'));
const or = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'backtest-omniroute-v531-results.json'), 'utf8'));
const op = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'backtest-omnipresent-results.json'), 'utf8'));
const edge = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'gold-setup-edge.json'), 'utf8'));

function fin(x){ const n = +x; return isFinite(n) ? n : NaN; }
function bag(list){
  const n = list.length;
  if (!n) return { n: 0, winRate: null, avgGross: null, avgNet: null };
  const wins = list.filter(t => {
    const o = String(t.outcome || '');
    return o.startsWith('win') || o === 'target';
  }).length;
  const g = list.reduce((s, t) => s + (fin(t.rMultiple) || 0), 0);
  const net = list.reduce((s, t) => s + (fin(t.netR) || 0), 0);
  return { n, winRate: +(wins / n).toFixed(4), avgGross: +(g / n).toFixed(4), avgNet: +(net / n).toFixed(4) };
}

const SCALP_SUPPRESS = new Set(Object.entries(edge.scalp || {})
  .filter(([, r]) => r && r.action === 'suppress')
  .map(([k]) => k.toUpperCase()));
const SCALP_SUPPRESS_LABELS = [
  'FVG FILL', 'HVN / VOLUME NODE RETEST', 'EMA RIBBON PULLBACK',
  'OPENING RANGE BREAKOUT', 'VWAP-BAND', 'SESSION VWAP BOUNCE / REJECTION',
  'ASIAN RANGE', 'LIQUIDITY SWEEP', 'BOS ALIGNMENT', 'OB-RETEST',
  'ORDER BLOCK'
];
const OR_DEMOTE = new Set(Object.entries((or.aggregates && or.aggregates.byMechanic) || {})
  .filter(([, v]) => v && v.n >= 50 && isFinite(v.avgGrossR) && v.avgGrossR <= -0.05)
  .map(([k]) => k));
const OR_NET_TOXIC = new Set(Object.entries((or.aggregates && or.aggregates.byMechanic) || {})
  .filter(([, v]) => v && v.n >= 50 && isFinite(v.avgGrossR) && v.avgGrossR < 0
    && isFinite(v.avgNetR) && v.avgNetR <= -0.20)
  .map(([k]) => k));
const OR_PREFER = new Set(Object.entries((or.aggregates && or.aggregates.byMechanic) || {})
  .filter(([, v]) => v && v.n >= 50 && v.avgGrossR > 0 && v.avgNetR > 0)
  .map(([k]) => k));

const gTrades = (gold.trades || []).filter(t => t && t.netR != null);
const orTrades = (or.trades || []).filter(t => t && t.netR != null);
const opTrades = (op.trades || []).filter(t => t && t.netR != null);

function goldKeepProposed(t){
  const kind = String(t.kind || '').toUpperCase();
  if (t.source === 'ENGINE' && t.horizon === 'SCALP'){
    if (SCALP_SUPPRESS_LABELS.some(x => kind.indexOf(x) >= 0 || x.indexOf(kind) >= 0)) return false;
    if (/OPENING RANGE|FVG FILL|HVN|EMA RIBBON|VWAP-BAND|SESSION VWAP|ASIAN|BOS ALIGN|OB-RETEST|ORDER BLOCK/.test(kind))
      return false;
  }
  const e = gold.aggregates && gold.aggregates.byKind ? null : null;
  void e;
  /* OMNIGOLD scan: n>=50 + (gross<=-0.05 or venue-net<=-0.5) already refuse.
     Approximate with net <= -0.5 at n>=50 from this book. */
  return true;
}

function kindN(horizon, kind){
  return gTrades.filter(t => t.horizon === horizon && String(t.kind).toUpperCase() === String(kind).toUpperCase()).length;
}

const goldAfterScalpSuppress = gTrades.filter(t => {
  if (!(t.source === 'ENGINE' && t.horizon === 'SCALP')) return true;
  const kind = String(t.kind || '').toUpperCase();
  return !/OPENING RANGE|FVG FILL|HVN|EMA RIBBON|VWAP-BAND|SESSION VWAP|ASIAN RANGE|BOS ALIGN|OB-RETEST|ORDER BLOCK|LIQUIDITY SWEEP/.test(kind);
});

const orKept = orTrades.filter(t => !OR_DEMOTE.has(t.mechanic) && !OR_NET_TOXIC.has(t.mechanic));
const orPrefer = orTrades.filter(t => OR_PREFER.has(t.mechanic));
const opCheap = opTrades.filter(t => isFinite(fin(t.costR)) ? fin(t.costR) <= 0.12 : true)
  .filter(t => !/XAU|XAG|PAXG|XAUT/.test(String(t.sym || t.symbol || '')));

const report = {
  generated: new Date().toISOString(),
  limitations: [
    'Counterfactual on committed replay books — not a new walk.',
    'Gold book is PAXG 0.26% RT (Aug 2026). Venue XM is cheaper.',
    'Never loosen G1–G7. Never invent dir. Demote/suppress/tighten only.'
  ],
  gold: {
    raw: bag(gTrades),
    bySource: {
      'ENGINE:SCALP': bag(gTrades.filter(t => t.source === 'ENGINE' && t.horizon === 'SCALP')),
      'ENGINE:SWING': bag(gTrades.filter(t => t.source === 'ENGINE' && t.horizon === 'SWING')),
      'SCAN:SCALP': bag(gTrades.filter(t => t.source === 'SCAN' && t.horizon === 'SCALP')),
      'SCAN:SWING': bag(gTrades.filter(t => t.source === 'SCAN' && t.horizon === 'SWING'))
    },
    afterEngineScalpSuppress: bag(goldAfterScalpSuppress),
    engineScalpAfter: bag(goldAfterScalpSuppress.filter(t => t.source === 'ENGINE' && t.horizon === 'SCALP'))
  },
  omniroute: {
    raw: bag(orTrades),
    preferOnly: bag(orPrefer),
    dropGrossAndNetToxic: bag(orKept),
    newlyNetToxic: [...OR_NET_TOXIC].filter(k => !OR_DEMOTE.has(k))
  },
  omnipresent: {
    raw: bag(opTrades),
    costLe12AndNotGold: bag(opCheap)
  },
  actions: [
    'GOLD SCALP: keep ORB / FVG / HVN / ribbon suppress. VWAP / Asian / scalp sweep / BOS / OB stay demote (never MOST PROBABLE / ENGINE lead) — full suppress emptied ENGINE:SCALP to n=4.',
    'OMNIROUTE: also stand aside n≥50 gross<0 AND net≤−0.20 (catches PO3). Prefer-only stays +0.10R.',
    'OMNIPRESENT: tighten cost ceiling 0.20 → 0.12 (cost≥0.20 loses −0.49R). Gold perps still aside.',
    'OMNIGOLD 1: QUALIFIES needs SL$ ≥ $5; G5 fails closed without ≥0.5×ATR displacement; BEST prefers trade-ready. Replay: minRisk5+disp0.5 least-bad (−0.245R vs raw −0.275R); do not require gated+bias for QUALIFIES.'
  ]
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
void goldKeepProposed;
void kindN;
void SCALP_SUPPRESS;
