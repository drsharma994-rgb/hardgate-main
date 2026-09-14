/* HARDGATE — does GOLD ULTRA's signal FAIL ON ENTRY OR ON EXIT?

   Run:  node scripts/goldultra-excursion.mjs [--bars=N]

   THE QUESTION
   ------------
   The ULTRA vote measured -0.215R/trade OOS (hg-v706) and ships record-only.
   Every attempt to improve it since — four rounds of added reads, a
   de-correlation test (v733), threshold extension (v734) — has tuned the ENTRY
   side. Nobody has touched the exit.

   RULE has seven tunables. backtest-goldultra.mjs grids TWO:

       minAvail: 25          never varied
       minPct: 0.85          <- gridded
       regimeGate: true      <- gridded
       stopAtr: 1.5          never varied
       costFloorMult: 8      never varied
       t1R: 1.5              never varied
       t2R: 2.5              never varied
       timeoutBars: 24       never varied   (passed as a constant, line 178)

   So "not tradable" was concluded from ONE exit configuration that was never
   itself tested.

   WHY THIS IS A DIAGNOSTIC AND NOT A GRID SEARCH
   ----------------------------------------------
   The tempting move is to grid stopAtr x t1R x timeoutBars on top of the
   existing minPct x gate. That multiplies 14 candidate rules into hundreds,
   and picking the in-sample best from hundreds then reporting out-of-sample is
   how you manufacture an edge that does not exist. This repo has the scar:
   "THE RULE WAS PICKED ON THE FIRST 70% AND REPORTED ON THE LAST 30% — one
   split, one regime of gold history".

   So measure first, search only if the measurement says there is anything to
   find. For every trade the rule takes, record how far price actually travelled
   in R terms:

     MFE  max favourable excursion  — how far it went the right way
     MAE  max adverse excursion     — how far it went the wrong way first

   That distinguishes the two failure modes cleanly:
     - MFE routinely >= 1.5R but stopped out first  -> the STOP is too tight.
       There is real headroom and an exit grid is justified.
     - MFE rarely reaches 1.5R at all               -> the TARGET is unreachable
       and the entry has no directional information. No exit tuning can save it,
       and the v706 verdict stands for a better reason than it was given.

   NOTHING HERE CHANGES THE APP. It reports; it writes no rule.

   CLOCK: identical to backtest-goldultra.mjs — the engine sees only the 320-bar
   15m prefix and the closed 1h prefix as of each bar's close. Excursions are
   measured from the FILL bar forward, never from the signal bar, and never
   using a bar the engine had already seen. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ogXmBarTouchesEntry } from '../lib/omnigold-xm-bot-backtest.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');
const argv = process.argv.slice(2);
const opt = (n, d) => { const a = argv.find(x => x.startsWith(n + '=')); return a ? a.split('=')[1] : d; };
const BARS_15M = +opt('--bars', 6000);
const WIN_15M = 320, WIN_1H = 400, MIN_15M = 230;
const COST_XM_FRAC = (0.35 / 3500) + 0.010 / 100;

function loadCache(interval, target){
  const p = path.join(CACHE_DIR, 'PAXGUSDT-' + interval + '.json');
  if (!fs.existsSync(p)) throw new Error('missing ' + p + ' — run scripts/backtest-goldultra.mjs first');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return j.rows.slice(-target);
}
function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'goldultra.js'), 'utf8'), ctx, { filename: 'goldultra.js' });
  return ctx;
}

const engineHash = crypto.createHash('sha1')
  .update(fs.readFileSync(path.join(ROOT, 'goldultra.js'), 'utf8').split('/* =========================== evidence panel')[0])
  .digest('hex').slice(0, 12);
/* the existing harness rebuilds signals from scratch every run; cache them so a
   follow-up question costs seconds instead of another full engine replay */
const SIGS_FILE = path.join(CACHE_DIR, 'goldultra-sigs-' + BARS_15M + '-' + engineHash + '.json');

const m15 = loadCache('15m', BARS_15M);
const h1 = loadCache('1h', Math.ceil(BARS_15M / 4) + WIN_1H + 8);
console.log('=== GOLD ULTRA excursion diagnostic · ' + m15.length + ' x 15m bars · engine ' + engineHash + ' ===');

let sigs;
if (fs.existsSync(SIGS_FILE)){
  sigs = JSON.parse(fs.readFileSync(SIGS_FILE, 'utf8'));
  console.log('  signals: cache hit (' + sigs.length + ')');
} else {
  const W = boot();
  sigs = []; let h1Ptr = 0; const t0 = Date.now();
  for (let i = MIN_15M - 1; i < m15.length - 1; i++){
    const now = (m15[i].t + 900) * 1000;
    while (h1Ptr < h1.length && (h1[h1Ptr].t + 3600) * 1000 <= now) h1Ptr++;
    let r;
    try{
      r = W.goldUltraEngine({ rows15m: m15.slice(Math.max(0, i - WIN_15M + 1), i + 1), rows1h: h1.slice(Math.max(0, h1Ptr - WIN_1H), h1Ptr),
                              now, allowUnverified: true, venueCost: { venue: 'XM', rtFrac: COST_XM_FRAC },
                              rule: { minPct: 0, minAvail: 0, regimeGate: false } });
    }catch(e){ continue; }
    if (!r || !r.ok || !r.fire || !r.plan) continue;
    sigs.push({ i, pct: r.count.pct, decisive: r.count.decisive, lead: r.count.lead, regime: r.regime, atr: r.atr,
                entry: r.plan.entry, stop: r.plan.stop, t1: r.plan.t1, stopAtr: r.plan.stopAtr });
    if ((i - MIN_15M) % 500 === 0) console.log('  bar ' + i + '/' + m15.length + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  fs.writeFileSync(SIGS_FILE, JSON.stringify(sigs));
  console.log('  signals: ' + sigs.length + ' firing bars in ' + ((Date.now() - t0) / 1000).toFixed(0) + 's (cached)');
}

/* ---- walk the DEPLOYED rule and record how far each trade actually travelled ---- */
const RULE = { minPct: 0.85, minAvail: 25, regimeGate: true, timeoutBars: 24 };
const live = { long: null, short: null };
const trades = [];

for (let bi = MIN_15M; bi < m15.length; bi++){
  const bar = m15[bi];
  for (const dir of ['long', 'short']){
    const tr = live[dir]; if (!tr) continue;
    if (tr.state === 'pending'){
      if (ogXmBarTouchesEntry(tr.orderType, dir, bar, tr.entry)){ tr.state = 'filled'; tr.fillIdx = bi; }
      else { tr.outcome = 'unfilled'; trades.push(tr); live[dir] = null; continue; }
    }
    const risk = Math.abs(tr.stop - tr.entry);
    /* excursion in R, measured from the FILL price on bars at or after the fill */
    const fav = dir === 'long' ? (bar.h - tr.entry) / risk : (tr.entry - bar.l) / risk;
    const adv = dir === 'long' ? (tr.entry - bar.l) / risk : (bar.h - tr.entry) / risk;
    if (fav > tr.mfe) tr.mfe = fav;
    if (adv > tr.mae) tr.mae = adv;
    tr.bars++;

    if (tr.outcome == null){
      const hitStop = dir === 'long' ? bar.l <= tr.stop : bar.h >= tr.stop;
      const hitT1 = dir === 'long' ? bar.h >= tr.t1 : bar.l <= tr.t1;
      if (hitStop && hitT1) tr.outcome = 'loss';
      else if (hitStop) tr.outcome = 'loss';
      else if (hitT1) tr.outcome = 'win';
      else if (bi - tr.fillIdx >= RULE.timeoutBars) tr.outcome = 'timeout';
      if (tr.outcome) tr.exitIdx = bi;
    }
    /* KEEP WALKING past the exit, to the timeout horizon, so MFE answers "could
       a wider stop or further target have worked" rather than only "what did
       this particular stop allow". mfeAtExit is frozen when the trade closes. */
    if (tr.outcome && tr.mfeAtExit == null){ tr.mfeAtExit = tr.mfe; tr.maeAtExit = tr.mae; }
    if (tr.outcome && bi - tr.fillIdx >= RULE.timeoutBars){ trades.push(tr); live[dir] = null; }
  }

  const s = sigs.find(x => x.i === bi);
  if (!s) continue;
  if (s.pct < RULE.minPct || s.decisive < RULE.minAvail) continue;
  if (RULE.regimeGate && s.regime === 'chop') continue;
  if (live[s.lead]) continue;
  live[s.lead] = { dir: s.lead, state: 'pending', fillIdx: null, entry: s.entry, stop: s.stop, t1: s.t1,
                   orderType: s.lead === 'long' ? 'BUY' : 'SELL', stopAtr: s.stopAtr, atr: s.atr,
                   mfe: 0, mae: 0, mfeAtExit: null, maeAtExit: null, bars: 0, outcome: null };
}

const filled = trades.filter(t => t.outcome && t.outcome !== 'unfilled');
if (!filled.length){ console.log('  no filled trades at the deployed rule — nothing to diagnose'); process.exit(0); }

const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))]; };
const mfe = filled.map(t => t.mfe), mae = filled.map(t => t.mae);
const pct = (n) => (100 * n / filled.length).toFixed(1) + '%';

console.log('\n=== ' + filled.length + ' filled trades at the DEPLOYED rule (minPct 0.85, regime gate on) ===');
console.log('  outcomes: ' + ['win', 'loss', 'timeout'].map(o => o + ' ' + filled.filter(t => t.outcome === o).length).join(' · '));

console.log('\n-- how far did price travel the RIGHT way (MFE, in R, to the timeout horizon) --');
console.log('   p25 ' + q(mfe, 0.25).toFixed(2) + 'R   median ' + q(mfe, 0.50).toFixed(2) + 'R   p75 ' + q(mfe, 0.75).toFixed(2) + 'R   p90 ' + q(mfe, 0.90).toFixed(2) + 'R');
for (const lvl of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]){
  console.log('   reached ' + lvl.toFixed(1) + 'R : ' + String(filled.filter(t => t.mfe >= lvl).length).padStart(4) + '  (' + pct(filled.filter(t => t.mfe >= lvl).length) + ')');
}

console.log('\n-- how far did price travel the WRONG way first (MAE, in R) --');
console.log('   p25 ' + q(mae, 0.25).toFixed(2) + 'R   median ' + q(mae, 0.50).toFixed(2) + 'R   p75 ' + q(mae, 0.75).toFixed(2) + 'R   p90 ' + q(mae, 0.90).toFixed(2) + 'R');

/* THE DECISIVE CROSS-TAB.
   A trade that reaches 1.5R favourable BEFORE touching its stop would have hit
   T1 and won, so any loss that later shows 1.5R necessarily reached it AFTER
   being stopped out. The question is therefore not "did price get there" but
   "how far against did it go first" — because that adverse depth IS the stop
   width you would have needed, and widening the stop enlarges the risk
   denominator on EVERY trade, winners included. A recovery that needed 4R of
   adverse room is not a missed winner; it is a different, worse strategy. */
const lost = filled.filter(t => t.outcome === 'loss');
const lostButTravelled = lost.filter(t => t.mfe >= 1.5);
const needed = lostButTravelled.map(t => t.mae).filter(x => isFinite(x));
console.log('\n-- the decisive cross-tab --');
console.log('   losses: ' + lost.length);
console.log('   of those, price LATER reached 1.5R: ' + lostButTravelled.length
  + '  (' + (lost.length ? (100 * lostButTravelled.length / lost.length).toFixed(1) : '0') + '% of losses)');
if (needed.length){
  console.log('   the stop width those recoveries would have required (their MAE):');
  console.log('     p50 ' + q(needed, 0.50).toFixed(2) + 'R   p75 ' + q(needed, 0.75).toFixed(2) + 'R   p90 ' + q(needed, 0.90).toFixed(2) + 'R   max ' + Math.max.apply(null, needed).toFixed(2) + 'R');
  const cheap = needed.filter(x => x <= 2.0).length;
  console.log('     recoverable with a stop <= 2R (i.e. ~2x current): ' + cheap + ' of ' + needed.length);
  console.log('   → many recoveries at MODEST adverse depth = the stop is genuinely too tight, grid it');
  console.log('   → recoveries only after DEEP adverse moves = you would be buying them with a much');
  console.log('     larger risk denominator on every trade; that is a different strategy, not a fix');
}
console.log('   (a loss can only show 1.5R post-exit: reaching it pre-stop would have been a win)');

const OUT = path.join(ROOT, 'scripts', 'goldultra-excursion-results.json');
fs.writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString(), bars: m15.length, engineHash,
  rule: RULE, filled: filled.length,
  outcomes: { win: filled.filter(t => t.outcome === 'win').length, loss: lost.length, timeout: filled.filter(t => t.outcome === 'timeout').length },
  mfe: { p25: q(mfe, 0.25), p50: q(mfe, 0.50), p75: q(mfe, 0.75), p90: q(mfe, 0.90) },
  mae: { p25: q(mae, 0.25), p50: q(mae, 0.50), p75: q(mae, 0.75), p90: q(mae, 0.90) },
  reached: Object.fromEntries([0.5, 1, 1.5, 2, 2.5, 3].map(l => [l + 'R', filled.filter(t => t.mfe >= l).length])),
  lossesThatReached1p5R: lostButTravelled.length,
}, null, 1));
console.log('\n  -> ' + OUT);
