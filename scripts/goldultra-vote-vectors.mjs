/* HARDGATE — capture GOLD ULTRA's PER-READ vote vector on every closed 15m bar.

   Run:  node scripts/goldultra-vote-vectors.mjs [--bars=N]

   WHY THIS EXISTS
   ---------------
   goldultra.js's own limitations note says the quiet part out loud:

     "the 319 directional reads (of 492 fed) are heavily correlated (dozens are
      moving-average variants); agreement % is a count, not an
      independence-weighted probability"

   That is the accuracy defect. The plain vote measured -0.215R/trade OOS
   (hg-v706) and FOUR re-runs that added MORE reads did not change the sign —
   which is what you would expect if the count is dominated by a handful of
   facts restated many times. Nobody has tried DE-correlating it.

   To test that you need the per-read vote series, and no harness keeps it:
   backtest-goldultra-filter.mjs calls the engine and stores only
   {lead, pct, decisive, regime}, discarding out.votes. This script keeps
   out.votes so the reads can be correlated and clustered offline.

   WHAT IT WRITES
   --------------
   scripts/.bt-cache/goldultra-votevectors-<bars>-<enginehash>.json
     { generated, bars, minAvail, ids: [readId...],
       rows: [[t, "0+-0+..."], ...] }
   One character per directional read per bar: '+' = long, '-' = short,
   '0' = neutral, in the fixed `ids` order. ~319 chars x ~5770 bars, so the
   whole thing is a couple of MB and stays greppable.

   CLOCK AND LOOKAHEAD: identical to backtest-goldultra-filter.mjs — the engine
   sees the 320-bar 15m prefix and the closed 1h prefix as of that bar's close,
   with the rule neutralised (minPct 0, minAvail 0, regimeGate off) so gating
   never suppresses a read. Zero lookahead by construction.

   DATA: reads the shared scripts/.bt-cache PAXGUSDT series. It never refreshes
   the cache, so it is safe to run alongside a read-only job — but per the
   repo's standing rule, do not run it concurrently with a harness using
   --refresh. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const a = argv.find(x => x.startsWith(name + '=')); return a ? a.split('=')[1] : dflt; };
const BARS_15M = +opt('--bars', 6000);
const WIN_15M = 320, WIN_1H = 400, MIN_15M = 230;

function loadCache(interval, target){
  const p = path.join(CACHE_DIR, 'PAXGUSDT-' + interval + '.json');
  if (!fs.existsSync(p)) throw new Error('missing ' + p + ' — run scripts/backtest-goldultra.mjs first');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.rows || j.rows.length < Math.min(target, 1000)) throw new Error('cache too thin for ' + interval);
  return j.rows.slice(-target);
}
function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'goldultra.js'), 'utf8'), ctx, { filename: 'goldultra.js' });
  return ctx;
}

/* same hash basis as backtest-goldultra-filter.mjs so an engine edit invalidates both */
const engineHash = crypto.createHash('sha1')
  .update(fs.readFileSync(path.join(ROOT, 'goldultra.js'), 'utf8').split('/* =========================== evidence panel')[0])
  .digest('hex').slice(0, 12);
const OUT_FILE = path.join(CACHE_DIR, 'goldultra-votevectors-' + BARS_15M + '-' + engineHash + '.json');

const m15 = loadCache('15m', BARS_15M);
const h1 = loadCache('1h', Math.ceil(BARS_15M / 4) + WIN_1H + 8);
const W = boot();
console.log('=== GOLD ULTRA per-read vote capture · ' + new Date().toISOString() + ' ===');
console.log('  ' + m15.length + ' x 15m bars · engine ' + engineHash);

if (fs.existsSync(OUT_FILE)){
  const existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
  console.log('  cache hit: ' + existing.rows.length + ' bars x ' + existing.ids.length + ' reads — nothing to do');
  console.log('  ' + OUT_FILE);
  process.exit(0);
}

/* The id order is fixed from the FIRST bar that produces a full read list, and
   every later bar is checked against it. If the engine ever emits a different
   set of directional reads mid-run the vectors would silently misalign by
   column, which would corrupt every correlation downstream — so that is a hard
   stop, not a warning. */
let ids = null, idIndex = null;
const rows = [];
let h1Ptr = 0, skipped = 0;
const t0 = Date.now();

for (let i = MIN_15M - 1; i < m15.length; i++){
  const now = (m15[i].t + 900) * 1000;
  while (h1Ptr < h1.length && (h1[h1Ptr].t + 3600) * 1000 <= now) h1Ptr++;
  let r;
  try{
    r = W.goldUltraEngine({
      rows15m: m15.slice(Math.max(0, i - WIN_15M + 1), i + 1),
      rows1h: h1.slice(Math.max(0, h1Ptr - WIN_1H), h1Ptr),
      now,
      allowUnverified: true,
      rule: { minPct: 0, minAvail: 0, regimeGate: false },
    });
  }catch(e){ skipped++; continue; }
  if (!r || !r.ok || !Array.isArray(r.votes)){ skipped++; continue; }

  const dir = r.votes.filter(v => v && v.kind === 'vote');
  if (!dir.length){ skipped++; continue; }

  if (!ids){
    ids = dir.map(v => v.id);
    idIndex = new Map(ids.map((id, k) => [id, k]));
    console.log('  directional reads: ' + ids.length);
  } else if (dir.length !== ids.length){
    throw new Error('read count changed at bar ' + i + ' (' + dir.length + ' vs ' + ids.length + ') — columns would misalign');
  }

  const cells = new Array(ids.length).fill('0');
  for (const v of dir){
    const k = idIndex.get(v.id);
    if (k === undefined) throw new Error('unknown read id "' + v.id + '" at bar ' + i + ' — id set is not stable');
    cells[k] = v.vote > 0 ? '+' : v.vote < 0 ? '-' : '0';
  }
  rows.push([m15[i].t, cells.join('')]);

  if ((i - MIN_15M) % 500 === 0){
    const el = (Date.now() - t0) / 1000;
    const done = i - MIN_15M + 1, total = m15.length - MIN_15M + 1;
    const eta = done > 0 ? (el / done) * (total - done) : 0;
    console.log('  bar ' + i + '/' + m15.length + ' · ' + el.toFixed(0) + 's elapsed · ~' + eta.toFixed(0) + 's left');
  }
}

if (!rows.length) throw new Error('no bars produced a vote vector — engine or cache problem');

fs.writeFileSync(OUT_FILE, JSON.stringify({
  generated: new Date().toISOString(),
  bars: rows.length,
  reads: ids.length,
  engineHash,
  skipped,
  ids,
  rows,
}));
console.log('  captured ' + rows.length + ' bars x ' + ids.length + ' reads (' + skipped + ' skipped) in ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
console.log('  -> ' + OUT_FILE);
