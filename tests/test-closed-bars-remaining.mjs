/* HARDGATE — the last three desks that read a forming candle, closed.

   The 2026-08 audit's systemic finding: most desks feed a repainting bar
   into their indicator math. v402–v407 fixed the ledger desks, the two
   best-levels refiners and everything routed through them. Three seams
   remained, fixed here:

     MEAN REV — mrSignal evaluated the LAST bar of whatever the caller
       fetched, a candle still forming, whose RSI(2) and %B un-print as it
       moves. The file's own backtest header admits the last-bar occurrence
       "cannot be resolved"; the live signal resolved it anyway, on every
       scan — and brain, edge and star trader all consume this signal.

     ENGINE — the xu universe path drops the forming candle
       (dropFormingXu); the legacy path fed the same G0–G5 gate ledger raw
       binanceKlines output. One ledger, two conventions, depending on
       which data source happened to serve the symbol.

     GOLD PRO — the panel prices its entry at the LIVE price (v398), then
       the composite override two blocks later was fed `price: lclose` —
       the stale closed bar the panel had just rejected — and re-priced
       the final setup there.

   Run: node tests/test-closed-bars-remaining.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

console.log('== MEAN REV: the signal reads closed bars, whoever calls it ==');
{
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp,
                Error, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{} }), getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [], addEventListener(){},
    head: { appendChild(){} }, body: { appendChild(){} } };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'meanrev.js']) vm.runInContext(read(f), ctx, { filename: f });

  /* A tape stamped up to NOW whose forming bar prints a wild spike. The
     signal must read identically to a direct call on the tape without it. */
  const nowSec = Math.floor(Date.now() / 1000);
  const rows = [];
  let p = 100;
  for (let i = 0; i < 260; i++){
    p = p * (1 + Math.sin(i / 9) * 0.004);
    rows.push({ t: nowSec - (259 - i) * 14400, o: p * 0.999, h: p * 1.004, l: p * 0.996, c: p, v: 500 });
  }
  rows[259] = { ...rows[259], c: rows[259].c * 0.9, l: rows[259].l * 0.88 }; /* forming crash print */
  const viaSignal = ctx.mrSignal(rows);
  const closedDirect = ctx.mrSignal(rows.slice(0, -1));
  ok(JSON.stringify(viaSignal) === JSON.stringify(closedDirect),
     'a wild forming print changes nothing: mrSignal(fresh tape) === mrSignal(closed tape)');

  /* Historical tapes are untouched — the drop keys off the bar's age. */
  const oldRows = rows.map((r, i) => ({ ...r, t: 1700000000 + i * 14400 }));
  const viaOld = ctx.mrSignal(oldRows);
  const directOld = ctx.mrSignal(oldRows.slice());
  ok(JSON.stringify(viaOld) === JSON.stringify(directOld) &&
     JSON.stringify(ctx.mrClosed(oldRows)) === JSON.stringify(oldRows),
     'historical tapes keep every bar — the backtest convention is unchanged');

  const MR = read('meanrev.js');
  ok(/rows = mrClosed\(rows\);\s*\n\s*var sig = mrSignal\(rows\);/.test(MR),
     'the scan closes the tape once, so signal, backtest and stats read the same bars');
}

console.log('\n== ENGINE: one closed-bars convention on both universe paths ==');
{
  const EN = read('engine.js');
  ok(/var rows4h = dropFormingXu\(legs\[0\] \|\| \[\], '4h'\), rows1h = dropFormingXu\(legs\[1\] \|\| \[\], '1h'\)/.test(EN),
     'the legacy gatherSymbol path drops the forming candle exactly like the xu path');
}

console.log('\n== GOLD PRO: the composite override is priced where the panel is ==');
{
  const GP = read('goldpro.js');
  ok(!/price: lclose/.test(GP), 'the stale closed-bar price no longer feeds the composite');
  ok(/price: lvEntry/.test(GP), 'it reads lvEntry — the live price the panel itself trades at');
}

console.log('\n== BOTH BEST-LEVELS REFINERS: the last audit finding, closed ==');
{
  /* squeeze/trendtable/oiflow and the two gold tabs all hand these refiners
     tapes whose last candle is still printing. The refiners now drop it
     themselves: a wild forming print must change NOTHING about the plan. */
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp,
                Error, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{} }), getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [], addEventListener(){},
    head: { appendChild(){} }, body: { appendChild(){} } };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'structure-levels.js',
                   'hg-mechanics.js', 'hg-gates.js', 'formation.js', 'freqtrade-formation.js',
                   'best-levels.js', 'gold-best-levels.js'])
    vm.runInContext(read(f), ctx, { filename: f });

  const nowSec = Math.floor(Date.now() / 1000);
  const mkTape = (n, tf) => {
    const out = []; let p = 4300;
    for (let i = 0; i < n; i++){
      p = p * (1 + Math.sin(i / 9) * 0.003 + 0.0006);
      out.push({ t: nowSec - (n - 1 - i) * tf, o: p * 0.999, h: p * 1.004, l: p * 0.996, c: p, v: 700 });
    }
    return out;
  };

  const rows = mkTape(300, 14400);
  const wild = rows.slice(0, -1).concat([{ ...rows[rows.length - 1],
    c: rows[rows.length - 1].c * 1.06, h: rows[rows.length - 1].h * 1.07 }]); /* forming spike */
  const planKey = p => p && p.plan ? [p.plan.entry, p.plan.stop, p.plan.t1].map(v => +(+v).toFixed(6)).join('|') : String(p && p.reason);

  const viaWild = ctx.hgBestLevels({ dir: 'long', rows4h: wild, style: 'swing', tab: 'test' });
  const viaClosed = ctx.hgBestLevels({ dir: 'long', rows4h: wild.slice(0, -1), style: 'swing', tab: 'test' });
  ok(planKey(viaWild) === planKey(viaClosed),
     'hgBestLevels: a wild forming print changes nothing (' + planKey(viaWild).slice(0, 50) + ')');

  const hit = { dir: 'long', stratKey: 'ob', entry: rows[rows.length - 2].c, pxNow: rows[rows.length - 1].c };
  const gWild = ctx.hgBestLevelsGold({ hit, dir: 'long', rows: wild, style: 'gold-swing', rows4h: wild });
  const gClosed = ctx.hgBestLevelsGold({ hit, dir: 'long', rows: wild.slice(0, -1), style: 'gold-swing', rows4h: wild.slice(0, -1) });
  ok(planKey(gWild) === planKey(gClosed),
     'hgBestLevelsGold: same discipline on the gold side (' + planKey(gWild).slice(0, 50) + ')');

  /* historical tapes keep every bar — backtests unchanged */
  const oldTape = rows.map((r, i) => ({ ...r, t: 1700000000 + i * 14400 }));
  ok(planKey(ctx.hgBestLevels({ dir: 'long', rows4h: oldTape, style: 'swing', tab: 'test' }))
        === planKey(ctx.hgBestLevels({ dir: 'long', rows4h: oldTape.slice(), style: 'swing', tab: 'test' })),
     'historical tapes are untouched — the drop keys off bar age');
}

console.log('\npassed: ' + passed);
