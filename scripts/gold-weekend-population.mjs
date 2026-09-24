#!/usr/bin/env node
/* hg-v949 — how much of a gold desk's measured record was taken on bars
   XAUUSD never printed.

   Gold is shut Friday 22:00 UTC to Sunday 22:00 UTC. The walks in scripts/
   are run on PAXGUSDT, a 24/7 Binance spot proxy whose own artifact meta
   says so: "24/7 weekend bars a broker never printed". Any trade formed
   inside that window is a trade nobody could have taken.

   The weekend test is the REPO'S OWN hgInGoldWeekend (indicators2.js),
   loaded and called -- never re-derived here. A second copy of a calendar
   is a second calendar, and this one is DST-aware in a way a fixed 22:00
   is not.

   Read-only. Prints; writes nothing. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = {};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'indicators2.js'), 'utf8'), { filename: 'indicators2.js' });
const IN_WEEKEND = globalThis.window.hgInGoldWeekend;
if (typeof IN_WEEKEND !== 'function'){
  console.error('FATAL: indicators2.js did not export hgInGoldWeekend — refusing to re-derive the calendar here.');
  process.exit(1);
}
const inW = iso => IN_WEEKEND(Date.parse(iso) / 1000);

const WALKS = [
  { desk: 'NEW GOLD', file: 'backtest-newgold-results.json', rr1: 1.5 },
  /* hg-v953: the two biggest gold walks in the repo, added because nobody had
     asked them this question. GOLD SCALP's is the walk HG_GOLD_SETUP_EDGE is
     measured on -- the table that decides suppress / demote / prefer on that
     desk -- and it was formed by goldScalpSetups, a function that until this
     pack contained no calendar at all. The swing walk's own meta lists
     "weekend demotes" among the runScan stages it does not replay. */
  { desk: 'GOLD SCALP', file: 'backtest-goldscalp-results.json', rr1: 1.5 },
  { desk: 'GOLD SWING', file: 'backtest-goldswing-results.json', rr1: 1.5 },
];

function stats(rows){
  if (!rows.length) return null;
  const wins = rows.filter(r => r.outcome === 'win').length;
  const g = rows.reduce((n, r) => n + (+r.rGross || 0), 0) / rows.length;
  const nx = rows.reduce((n, r) => n + (+r.netR || 0), 0) / rows.length;
  return { n: rows.length, winPct: 100 * wins / rows.length, gross: g, netXm: nx };
}
const sg = x => (x >= 0 ? '+' : '') + x.toFixed(4);
function line(label, s){
  if (!s){ console.log('  ' + label.padEnd(30) + ' n=0'); return; }
  console.log('  ' + label.padEnd(30) + ' n=' + String(s.n).padStart(3)
    + '  win=' + s.winPct.toFixed(1) + '%'
    + '  gross=' + sg(s.gross) + 'R'
    + '  netXM=' + sg(s.netXm) + 'R');
}

let exitCode = 0;
for (const w of WALKS){
  const p = path.join(ROOT, 'scripts', w.file);
  if (!fs.existsSync(p)){ console.error('MISSING ARTIFACT: ' + w.file); exitCode = 1; continue; }
  const a = JSON.parse(fs.readFileSync(p, 'utf8'));
  const t = a.trades || [];
  if (!t.length){ console.error('EMPTY ARTIFACT: ' + w.file); exitCode = 1; continue; }

  console.log('== ' + w.desk + '  (' + w.file + ')');
  const universe = (a.meta && a.meta.universe) || '(universe not recorded)';
  console.log('   universe: ' + universe);
  /* the artifact says it itself — quote it rather than asserting it */
  if (!/24\/7|weekend/i.test(universe))
    console.log('   NOTE: this artifact does not declare a 24/7 universe; the split below may not apply.');

  const weekend = t.filter(r => inW(r.tISO));
  const open = t.filter(r => !inW(r.tISO));
  line('ALL (what the desk quotes)', stats(t));
  line('formed in the gold weekend', stats(weekend));
  line('TRADEABLE (gold open)', stats(open));

  const be = 100 / (1 + w.rr1);
  console.log('   breakeven at this desk\'s ' + w.rr1 + 'R ladder: ' + be.toFixed(1) + '%');
  const so = stats(open);
  if (so){
    const d = so.winPct - be;
    console.log('   tradeable win rate vs its own breakeven: '
      + so.winPct.toFixed(1) + '% vs ' + be.toFixed(1) + '% = ' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' pts');
  }
  console.log('   share of the record formed on bars gold never printed: '
    + weekend.length + '/' + t.length + ' (' + (100 * weekend.length / t.length).toFixed(1) + '%)');

  const fl = a.fireLog || [];
  if (fl.length){
    const fw = fl.filter(r => r.tISO && inW(r.tISO)).length;
    console.log('   fireLog: ' + fw + '/' + fl.length + ' fires inside the gold weekend');
  }
  /* hg-v953: a thin tradeable subset and a thick one are different claims, and
     saying "far too thin" of 1,896 trades would be as false as claiming a
     verdict from ten. Say which this is, from the number itself. */
  if (so && so.n < 30){
    console.log('   NO VERDICT is claimed from the tradeable subset: n=' + so.n
      + ' is far too thin. The finding is that the quoted figure was not measured on a');
    console.log('   population this desk can trade — not that the desk loses.');
  } else {
    console.log('   The finding is the SPLIT, not a verdict on either side: the quoted figure');
    console.log('   pools bars gold printed with bars only a 24/7 crypto proxy printed. No');
    console.log('   threshold, gate or verdict is moved on any desk from these numbers.');
  }
}
process.exit(exitCode);
