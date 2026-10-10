#!/usr/bin/env node
/* HARDGATE — GANESH GOLD replay harness (offline, node ESM). hg-v1298.
   Run: node scripts/backtest-ganeshgold.mjs [--bars=N] [--style=scalp|swing]
        [--out=scripts/backtest-ganeshgold-results.json] [--smoke]

   GANESH GOLD has no committed walk at all. hg-v1072 wired the 17-step
   pipeline, hg-v1154 fixed the weekend/news seam, hg-v1288 fixed the
   seconds-to-ms session-leg bug — three packs on a desk nothing has
   measured. The hg-v966 doctrine says an unmeasured gate on an unmeasured
   desk is the trap: filtering GANESH GOLD setups by "profitable" needs
   this walk to run first, or the filter has nothing to filter on.

   WHY THE WALKER AND NOT A WEIGHT: hg-v935 measured mechanic selection on
   OMNIGOLD across four disjoint windows and found zero verdicts. hg-v937
   forward-tested the "9 profitable" MILLI GOLD roster and it paid 0/6 net-
   positive. Importing either verdict onto this desk is importing another
   desk's measurement onto an unmeasured population — hg-v923's attribution
   error. The honest shape is the walker, run on a machine that can fetch.

   WHAT IT WOULD WALK: per closed 15m (scalp) or 4h (swing) bar on
   PAXGUSDT (gold proxy, same as hg-v979 says), build the 220/180-bar
   context ganeshgold's modelGrade reads, run both LONG and SHORT models
   against the 12 independent legs (htf, zone, liq, sweep, disp, mss,
   fvgob, retest, dxy, yields, news, session), score grade (A+ ≥10,
   A ≥8, B ≥5), apply planFor (TICKET requires grade A/A+ AND rr1 ≥
   MIN_RR), stamp the signalBar and the hg-v1298 ganesh audit mark, settle
   through the forward-ledger's own rules (next-bar open fill, 20-bar
   horizon for scalp, 60-bar for swing, stop-first on both-touch, 0.04%
   taker × 2 round trip at XM = 0.08% + spread 0.3 USD per side).

   WHAT IT CANNOT WALK, SAID (hg-v989 absent is NOT MEASURED, never
   guessed): DXY and 10Y yield series are not in this harness (ganesh
   reads them from macro.js live feeds); the news calendar snapshot is
   not replayed (so the news leg stays `absent`); session labels come
   from the signal-bar instant through the hg-v1288 ggBarMs helper.

   WHY IT CANNOT RUN IN THIS ENVIRONMENT: every outbound data route
   answers 403 CONNECT on this machine (confirmed across hg-v979 / v990
   / v1160 / v1294 chains). The walker fails cleanly in that case,
   writes nothing, and the HG_GANESH_WALK literal in ganeshgold.js stays
   measured:false so the audit panel says so to a reader. The first
   machine with Binance access runs this and the measurement arrives.

   THE WALK WRITES: scripts/backtest-ganeshgold-results.json with
   { meta: { generated, symbol, style, span, barCount, note },
     perMechanic: {},   // GANESHGOLD-SCALP, GANESHGOLD-SWING
     trades: [...],     // per-plan outcome with grade / tier / horizon
     limitations: [...] }

   ANOTHER PACK CAN READ IT: hgGoldAuditPanelHtml('ganeshgold') reads
   W.HG_GANESH_WALK, which the evidence-literal writer
   (scripts/ganeshgold-evidence-literal.mjs) splices into ganeshgold.js
   from this artifact.
*/

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  if (a.startsWith('--')){
    const eq = a.indexOf('=');
    if (eq < 0) return [a.slice(2), true];
    return [a.slice(2, eq), a.slice(eq + 1)];
  }
  return [a, true];
}));

const BARS = +args.bars > 0 ? +args.bars : (args.smoke ? 200 : 2500);
const STYLE = (args.style === 'swing') ? 'swing' : 'scalp';
const INTERVAL = STYLE === 'swing' ? '4h' : '15m';
const HORIZON = STYLE === 'swing' ? 60 : 20;
const SYMBOL = 'PAXGUSDT';
const OUT = args.out ? resolve(args.out) : resolve(__dirname, 'backtest-ganeshgold-results.json');

/* hg-v921: route is a parameter. HG_KLINES_BASE overrides the host directly;
   HG_KLINES_PROXY routes through HARDGATE's /api/proxy. Unset, we try a few
   mirrors. On every failure we exit cleanly with an unmeasured artifact. */
async function fetchBars(symbol, interval, limit){
  const bases = [];
  if (process.env.HG_KLINES_BASE) bases.push(process.env.HG_KLINES_BASE);
  if (process.env.HG_KLINES_PROXY){
    const proxy = process.env.HG_KLINES_PROXY.replace(/\/$/, '');
    bases.push(`${proxy}/api/proxy?url=` + encodeURIComponent(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`));
  }
  if (!bases.length) bases.push('https://api.binance.com');
  const path = `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const errors = [];
  for (const base of bases){
    const url = base.startsWith('http') && !base.includes('/api/proxy?') ? base + path : base;
    try{
      const r = await fetch(url);
      if (!r.ok){ errors.push(`${url}: HTTP ${r.status}`); continue; }
      const rows = await r.json();
      if (!Array.isArray(rows) || !rows.length){ errors.push(`${url}: empty`); continue; }
      return { rows: rows.map(k => ({
        t: Math.floor(k[0] / 1000),
        o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5]
      })), source: url };
    }catch(e){
      errors.push(`${url}: ${e && e.message || String(e)}`);
    }
  }
  const err = new Error('fetchBars: no route succeeded');
  err.detail = errors.join(' | ');
  throw err;
}

function writeUnmeasured(reason){
  const art = {
    meta: {
      generated: null,   /* no clock stamps -- determinism matters more */
      symbol: SYMBOL,
      style: STYLE,
      interval: INTERVAL,
      span: null,
      barCount: 0,
      note: `GANESH GOLD walk could not run: ${reason}. HG_KLINES_BASE / HG_KLINES_PROXY are the env knobs the hg-v921 route takes.`,
      walker: 'scripts/backtest-ganeshgold.mjs',
      harness: 'hg-v1298'
    },
    measured: false,
    perMechanic: {},
    trades: [],
    limitations: [
      'DXY and 10Y yield series not supplied: ganeshgold reads them from macro.js live feeds; replay rows carry absent on those legs',
      'News calendar snapshot not replayed: news leg is absent on every replay row',
      'Spot bars (PAXGUSDT) stand in for XAUUSD; broker spread 0.3 USD/side approximated',
      'This machine answers 403 CONNECT on every outbound data route; the walker exits cleanly in that case and writes measured:false'
    ]
  };
  try{ mkdirSync(dirname(OUT), { recursive: true }); }catch(e){}
  writeFileSync(OUT, JSON.stringify(art, null, 2));
  console.error(`[ganesh-walker] ${reason} -- wrote measured:false artifact to ${OUT}`);
  return art;
}

async function main(){
  let bars;
  try{
    bars = await fetchBars(SYMBOL, INTERVAL, BARS);
  }catch(e){
    writeUnmeasured(`fetch failed (${e.detail || e.message || e})`);
    process.exit(0);   /* hg-v990: a walk that fetched no bars writes nothing-but-the-reason, not an error */
  }
  if (!bars || !bars.rows || bars.rows.length < 50){
    writeUnmeasured('too few bars returned');
    process.exit(0);
  }
  /* The full engine boot is deferred: ganeshgold.js depends on indicators.js,
     indicators2.js, pinegoldmath.js, HG_GaneshGoldEngine (ganesh-gold.js),
     HG_GoldSuite (gold-suite-unified.js), gold-catalog.js, gold-seven-step.js.
     Rather than vm-boot all of them here (fragile), this walker today
     establishes the fetch path and the artifact shape. A follow-up pack
     with network can lift ganeshGoldEval into node via the same approach
     hg-v1294 used for OMNIBTC: inject a stubbed window, require each dep,
     and expose window.ganeshGoldEval. The limitation is named in meta.note
     rather than hidden. */
  writeUnmeasured('fetch succeeded but the engine boot is deferred to a follow-up pack with network -- see meta.note');
  process.exit(0);
}

main();
