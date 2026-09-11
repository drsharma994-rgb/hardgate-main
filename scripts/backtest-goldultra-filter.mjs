/* HARDGATE — GOLD ULTRA as a CONFLUENCE FILTER over desks that already pay.
   Run:  node scripts/backtest-goldultra-filter.mjs [--bars=N]

   QUESTION
   --------
   The plain ULTRA vote lost on its own (-0.215R OOS, hg-v706). Does the
   COUNT still carry information when laid over a desk whose setups are
   already measured positive? Every GOLD SCALP trade (its own harness,
   scripts/backtest-goldscalp-results.json — the 15m tab pipeline at XM
   costs) is joined to the ULTRA read of ITS OWN signal bar (same closed-bar
   clock, same PAXGUSDT series), and the trades are split into cohorts:
     AGREE    ULTRA lead == trade side, agreement >= X, decisive >= 25
     AGAINST  ULTRA lead != trade side, agreement >= X
     NEUTRAL  everything else
   for X on a grid. X is CHOSEN on the first 70% of trades (best AGREE
   avg R net @XM over the baseline at n >= 60) and REPORTED on the last 30%.
   OMNIGOLD's SCAN:SCALP book is joined the same way as a second opinion
   (1h grid; its netR is PAXG — an XM figure is recomputed from rMultiple).

   Zero lookahead: the ULTRA read for a bar uses only bars closed at that
   bar's close; the trade's outcome is never consulted when reading. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const a = argv.find(x => x.startsWith(name + '=')); return a ? a.split('=')[1] : dflt; };
const BARS_15M = +opt('--bars', 6000);
const OUT_FILE = path.join(ROOT, 'scripts', 'backtest-goldultra-filter-results.json');
const WIN_15M = 320, WIN_1H = 400, MIN_15M = 230, MIN_AVAIL = 25, IS_SHARE = 0.70, MIN_N = 60;
const GRID = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80];
const COST_XM_FRAC = (0.35 / 3500) + 0.010 / 100;

function loadCache(interval, target){
  const j = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'PAXGUSDT-' + interval + '.json'), 'utf8'));
  if (!j.rows || j.rows.length < Math.min(target, 1000)) throw new Error('cache too thin for ' + interval + ' — run scripts/backtest-goldultra.mjs first');
  return j.rows.slice(-target);
}
function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'goldultra.js'), 'utf8'), ctx, { filename: 'goldultra.js' });
  return ctx;
}
const m15 = loadCache('15m', BARS_15M), h1 = loadCache('1h', Math.ceil(BARS_15M / 4) + WIN_1H + 8);
const W = boot();
console.log('=== GOLD ULTRA confluence-filter test · ' + new Date().toISOString() + ' · ' + m15.length + ' x 15m bars ===');
/* per-bar ULTRA reads are cached against a hash of goldultra.js's vote code
   so cohort re-cuts are instant; any engine change invalidates the cache */
import crypto from 'node:crypto';
const engineHash = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'goldultra.js'), 'utf8').split('/* =========================== evidence panel')[0]).digest('hex').slice(0, 12);
const READS_FILE = path.join(CACHE_DIR, 'goldultra-reads-' + BARS_15M + '-' + engineHash + '.json');
const byT = new Map(); let h1Ptr = 0; const t0 = Date.now();
if (fs.existsSync(READS_FILE)){
  for (const [t, v] of JSON.parse(fs.readFileSync(READS_FILE, 'utf8'))) byT.set(+t, v);
  console.log('  ULTRA reads: cache hit (' + byT.size + ' bars, engine ' + engineHash + ')');
} else {
  for (let i = MIN_15M - 1; i < m15.length; i++){
    const now = (m15[i].t + 900) * 1000;
    while (h1Ptr < h1.length && (h1[h1Ptr].t + 3600) * 1000 <= now) h1Ptr++;
    const r = W.goldUltraEngine({ rows15m: m15.slice(Math.max(0, i - WIN_15M + 1), i + 1), rows1h: h1.slice(Math.max(0, h1Ptr - WIN_1H), h1Ptr), now,
                                  allowUnverified: true, rule: { minPct: 0, minAvail: 0, regimeGate: false } });
    if (r.ok && r.count) byT.set(m15[i].t, { lead: r.count.lead, pct: r.count.pct, decisive: r.count.decisive, regime: r.regime });
    if ((i - MIN_15M) % 1000 === 0) console.log('  bar ' + i + '/' + m15.length + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  fs.writeFileSync(READS_FILE, JSON.stringify([...byT.entries()]));
  console.log('  ULTRA reads on ' + byT.size + ' bars (cached as ' + path.basename(READS_FILE) + ')');
}

function agg(ts){
  const n = ts.length; if (!n) return { n: 0 };
  const wins = ts.filter(t => String(t.outcome).startsWith('win')).length;
  const s = k => ts.reduce((a, t) => a + (t[k] || 0), 0);
  return { n, winRate: +(wins / n).toFixed(3), avgR_net_xm: +(s('netXm') / n).toFixed(3), avgR_net_paxg: +(s('netPaxg') / n).toFixed(3), sumR_net_xm: +s('netXm').toFixed(2) };
}
function cohorts(trades, X){
  const agree = [], against = [], neutral = [];
  for (const t of trades){
    const u = t.ultra;
    if (!u || u.decisive < MIN_AVAIL || u.pct < X) neutral.push(t);
    else if (u.lead === t.dir) agree.push(t); else against.push(t);
  }
  return { agree: agg(agree), against: agg(against), neutral: agg(neutral) };
}
function study(label, trades){
  trades = trades.filter(t => t.ultra).sort((a, b) => a.sec - b.sec);
  const split = Math.floor(trades.length * IS_SHARE), ins = trades.slice(0, split), oos = trades.slice(split);
  const base = { all: agg(trades), ins: agg(ins), oos: agg(oos) };
  const grid = GRID.map(X => ({ X, ins: cohorts(ins, X), oos: cohorts(oos, X), all: cohorts(trades, X) }));
  let chosen = null;
  for (const g of grid){ if (g.ins.agree.n < MIN_N) continue; const lift = g.ins.agree.avgR_net_xm - base.ins.avgR_net_xm; if (!chosen || lift > chosen.lift) chosen = { X: g.X, lift: +lift.toFixed(3), row: g }; }
  const byRegime = {}; for (const t of oos){ const k = t.ultra.regime; (byRegime[k] = byRegime[k] || []).push(t); }
  const regimeRows = Object.keys(byRegime).sort().map(k => ({ regime: k, ...agg(byRegime[k]) }));
  const byLead = { with: agg(oos.filter(t => t.ultra.lead === t.dir)), against: agg(oos.filter(t => t.ultra.lead !== t.dir)) };
  return { label, joined: trades.length, base, grid, chosen, oosByRegime: regimeRows, oosByLeadAnyPct: byLead };
}
const gs = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'backtest-goldscalp-results.json'), 'utf8'));
const gsT = gs.trades.filter(t => !t.shadow && t.netR != null).map(t => { const sec = Math.floor(Date.parse(t.tISO) / 1000); return { sec, dir: t.dir, outcome: t.outcome, netXm: t.netR, netPaxg: t.netR_paxg, demoted: !!t.demoted, ultra: byT.get(sec) || null }; });
const og = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'backtest-omnigold-results.json'), 'utf8'));
const ogT = og.trades.filter(t => t.source === 'SCAN' && t.horizon === 'SCALP' && t.netR != null && isFinite(t.rMultiple)).map(t => {
  const sec = Math.floor(Date.parse(t.tISO) / 1000), risk = Math.abs(t.stop - t.entry), costXm = risk ? (t.entry * COST_XM_FRAC) / risk : 0;
  /* OMNIGOLD signals on the 1h grid: read the ULTRA bar that closed at that hour */
  return { sec, dir: t.dir, outcome: t.outcome, netXm: +(t.rMultiple - costXm).toFixed(3), netPaxg: t.netR, ultra: byT.get(sec - 900) || byT.get(sec) || null };
});
/* the GOLD SCALP book the tab actually CROWNS is the edge-table prefer set
   (goldind.js HG_GOLD_SETUP_EDGE.scalp, action 'prefer'); offline every
   candidate carries a demote stamp (feeds absent), so 'demoted' is not the
   cut — the strategy key is */
const PREFER = ['p6fail', 'p9volbar'];
const NOT_DISCREDITED = PREFER.concat(['sweepob', 'p8range']);
const gsAll = gs.trades.filter(t => !t.shadow && t.netR != null);
const withKey = (list, keys) => list.filter(t => keys.indexOf(t.stratKey) >= 0).map(t => { const sec = Math.floor(Date.parse(t.tISO) / 1000); return { sec, dir: t.dir, outcome: t.outcome, netXm: t.netR, netPaxg: t.netR_paxg, stratKey: t.stratKey, ultra: byT.get(sec) || null }; });
const studies = [
  study('GOLD SCALP · main book (XM costs, 15m)', gsT),
  study('GOLD SCALP · PREFER book (p6fail + p9volbar — the rows the tab crowns)', withKey(gsAll, PREFER)),
  study('GOLD SCALP · not-discredited book (prefer + sweepob + p8range)', withKey(gsAll, NOT_DISCREDITED)),
  study('OMNIGOLD · SCAN:SCALP (1h grid; XM recomputed from gross)', ogT)
];
const verdictFor = s => {
  if (!s.chosen) return 'no threshold reached n>=' + MIN_N + ' in-sample AGREE — nothing to claim';
  const o = s.chosen.row.oos, b = s.base.oos, lift = +(o.agree.avgR_net_xm - b.avgR_net_xm).toFixed(3);
  if (o.agree.n < 40) return 'OOS AGREE n=' + o.agree.n + ' too thin to trust';
  return 'OOS: AGREE ' + (o.agree.avgR_net_xm >= 0 ? '+' : '') + o.agree.avgR_net_xm + 'R (n=' + o.agree.n + ', win ' + (100 * o.agree.winRate).toFixed(0) + '%) vs baseline ' + (b.avgR_net_xm >= 0 ? '+' : '') + b.avgR_net_xm + 'R (n=' + b.n + ') — lift ' + (lift >= 0 ? '+' : '') + lift + 'R; AGAINST ' + (o.against.n ? (o.against.avgR_net_xm >= 0 ? '+' : '') + o.against.avgR_net_xm + 'R (n=' + o.against.n + ')' : '—');
};
const out = { generated: new Date().toISOString(), bars: m15.length, ultraBars: byT.size, grid: GRID, minAvail: MIN_AVAIL, isShare: IS_SHARE, minN: MIN_N,
              studies: studies.map(s => ({ ...s, verdict: verdictFor(s) })) };
fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 1));
const rp = (v, w) => String(v === null || v === undefined ? '—' : v).padStart(w);
for (const s of out.studies){
  console.log('\n=== ' + s.label + ' · joined ' + s.joined + ' ===');
  console.log('baseline  IS n ' + s.base.ins.n + ' net ' + s.base.ins.avgR_net_xm + ' · OOS n ' + s.base.oos.n + ' win ' + (100 * (s.base.oos.winRate || 0)).toFixed(0) + '% net ' + s.base.oos.avgR_net_xm);
  console.log('   X  | IS agree n  net  | against n  net  || OOS agree n  win  net   | against n  net  | neutral n  net');
  for (const g of s.grid) console.log(rp((g.X * 100).toFixed(0) + '%', 5) + ' | ' + rp(g.ins.agree.n, 9) + ' ' + rp(g.ins.agree.avgR_net_xm, 6) + ' | ' + rp(g.ins.against.n, 9) + ' ' + rp(g.ins.against.avgR_net_xm, 6)
    + ' || ' + rp(g.oos.agree.n, 10) + ' ' + rp(g.oos.agree.winRate == null ? '—' : (100 * g.oos.agree.winRate).toFixed(0) + '%', 4) + ' ' + rp(g.oos.agree.avgR_net_xm, 6) + ' | ' + rp(g.oos.against.n, 9) + ' ' + rp(g.oos.against.avgR_net_xm, 6) + ' | ' + rp(g.oos.neutral.n, 9) + ' ' + rp(g.oos.neutral.avgR_net_xm, 6) + (s.chosen && s.chosen.X === g.X ? '  <== chosen (IS lift ' + s.chosen.lift + ')' : ''));
  console.log('OOS by regime: ' + s.oosByRegime.map(r => r.regime + ' n' + r.n + ' ' + r.avgR_net_xm).join(' · '));
  console.log('OOS with/against lead (any pct): with n' + s.oosByLeadAnyPct.with.n + ' ' + s.oosByLeadAnyPct.with.avgR_net_xm + ' · against n' + s.oosByLeadAnyPct.against.n + ' ' + s.oosByLeadAnyPct.against.avgR_net_xm);
  console.log('VERDICT: ' + s.verdict);
}
console.log('\nwritten: ' + OUT_FILE);
