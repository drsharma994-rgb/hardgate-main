/* HARDGATE — the walk reads bars from a file, and sweeps geometry on them.

   WHY THIS EXISTS. Every number the 80PERCENT tab shows is arithmetic on an
   unmeasured strategy: no file in data/ mentions P80 and
   scripts/walk-80percent-results.json had never existed, because the walk's
   only data source was api.binance.com and plenty of environments answer
   403 to CONNECT. A measurement tool that cannot run measures nothing.

   So these assert the two things that unblock it: bars from a file in
   whatever shape a broker exports, and a geometry sweep over the identical
   entries. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseBarTime, parseBarsCsv, parseBarsJson, detectInterval, tfNameOf, tidyBars,
  readBarsFile, loadStrategy, run, summarise, sweepGeometry, SWEEP_TP, SWEEP_SL
} from '../scripts/walk-80percent.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hg80walk-'));
const tmp = (name, text) => { const f = path.join(TMP, name); fs.writeFileSync(f, text); return f; };

/* one deterministic series, written out in every shape a user might have */
function series(n){
  let px = 4300, st = 7;
  const rnd = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff; };
  const start = Math.floor(Date.UTC(2026, 0, 5, 0, 0, 0) / 1000);
  const rows = [];
  for (let i = 0; i < n; i++){
    const o = px, c = o + Math.sin(i / 420) * 0.55 + (rnd() - 0.5) * 2.85;
    rows.push({ t: start + i * 300, o: +o.toFixed(2),
                h: +(Math.max(o, c) + rnd() * 1.1).toFixed(2),
                l: +(Math.min(o, c) - rnd() * 1.1).toFixed(2),
                c: +c.toFixed(2), v: 10 });
    px = c;
  }
  return rows;
}
const BARS = series(4000);

console.log('\n== a timestamp is read, or refused — never guessed ==');
{
  ok(parseBarTime(1767571200) === 1767571200, 'seconds pass through');
  ok(parseBarTime(1767571200000) === 1767571200, 'milliseconds are divided down');
  ok(parseBarTime(1767571200000000) === 1767571200, 'microseconds too');
  ok(parseBarTime('2026-01-05T00:00:00Z') === 1767571200, 'ISO with a zone');
  ok(parseBarTime('2026-01-05 00:00:00') === 1767571200,
     'a bare datetime is read as UTC — the session window is stated in UTC');
  ok(parseBarTime('2026.01.05 00:00') === 1767571200, 'MT4/MT5 dotted dates');
  ok(parseBarTime('2026.01.05,00:00') === 1767571200, 'and the comma-joined MT variant');
  for (const bad of [null, undefined, '', 'not a date', 42, {}]){
    ok(parseBarTime(bad) === null, `${JSON.stringify(bad)} returns null rather than a guess`);
  }
}

console.log('\n== the same bars, however the file spells them ==');
{
  const iso = r => new Date(r.t * 1000).toISOString();
  const p2 = n => String(n).padStart(2, '0');
  const files = {
    'plain.csv': 'time,open,high,low,close,volume\n'
      + BARS.map(r => [iso(r), r.o, r.h, r.l, r.c, r.v].join(',')).join('\n'),
    /* deliberately shuffled, and using short names */
    'shuffled.csv': 'Close,High,Time,Low,Open,Vol\n'
      + BARS.map(r => [r.c, r.h, iso(r), r.l, r.o, r.v].join(',')).join('\n'),
    'tabs.tsv': 'timestamp\to\th\tl\tc\n'
      + BARS.map(r => [r.t, r.o, r.h, r.l, r.c].join('\t')).join('\n'),
    /* MT4/MT5: no header at all */
    'mt4.txt': BARS.map(r => {
      const d = new Date(r.t * 1000);
      return [d.getUTCFullYear() + '.' + p2(d.getUTCMonth() + 1) + '.' + p2(d.getUTCDate()),
              p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()),
              r.o, r.h, r.l, r.c, r.v].join(',');
    }).join('\n'),
    'objects.json': JSON.stringify(BARS),
    /* Binance kline order, milliseconds */
    'klines.json': JSON.stringify(BARS.map(r => [r.t * 1000, r.o, r.h, r.l, r.c, r.v]))
  };

  const refClose = BARS.map(r => r.c).join(',');
  for (const [name, text] of Object.entries(files)){
    const got = readBarsFile(tmp(name, text));
    ok(got.rows.length === BARS.length, `${name}: all ${BARS.length} bars read`);
    ok(got.rows.map(r => r.c).join(',') === refClose, `${name}: closes match the source exactly`);
    ok(got.rows[0].t === BARS[0].t, `${name}: first timestamp matches`);
    ok(got.interval && got.interval.sec === 300, `${name}: interval detected as 5m`);
  }
}

console.log('\n== malformed input is named, not silently absorbed ==');
{
  const bad = readBarsFile(tmp('bad.csv', 'nonsense,data\n1,2'));
  ok(bad.rows.length === 0 && /no header row/.test(bad.why),
     'a file with no recognisable columns is refused, with the reason');

  const holes = readBarsFile(tmp('holes.csv',
    'time,open,high,low,close\n'
    + '2026-01-05T00:00:00Z,1,2,0.5,1.5\n'
    + 'garbage,1,2,0.5,1.5\n'
    + '2026-01-05T00:05:00Z,1,2,0.5,1.6\n'));
  ok(holes.rows.length === 2 && holes.skipped === 1,
     'an unreadable line is skipped AND counted, never quietly dropped');

  const dupes = readBarsFile(tmp('dupes.csv',
    'time,close\n2026-01-05T00:00:00Z,1\n2026-01-05T00:00:00Z,2\n2026-01-05T00:05:00Z,3\n'));
  ok(dupes.rows.length === 2 && dupes.dupes === 1, 'a repeated timestamp is dropped and counted');

  const unsorted = readBarsFile(tmp('unsorted.csv',
    'time,close\n2026-01-05T00:10:00Z,3\n2026-01-05T00:00:00Z,1\n2026-01-05T00:05:00Z,2\n'));
  ok(unsorted.rows.map(r => r.c).join(',') === '1,2,3', 'out-of-order bars are sorted');

  const t = tidyBars([{ t: 1, c: 5, h: 1, l: 9 }]);
  ok(t.rows.length === 0 && t.dropped === 1, 'a bar whose high is below its low is dropped');
}

console.log('\n== the bars decide the timeframe ==');
{
  ok(detectInterval(BARS).sec === 300, '5m bars detect as 300s');
  const q = BARS.filter((_, i) => i % 3 === 0).map((r, i) => ({ ...r, t: BARS[0].t + i * 900 }));
  ok(detectInterval(q).sec === 900, '15m bars detect as 900s');
  ok(detectInterval([]) === null && detectInterval([{ t: 1 }]) === null,
     'too few bars to tell returns null rather than a default');
  ok(tfNameOf(300) === '5m' && tfNameOf(86400) === '1d' && tfNameOf(7) === '7s',
     'and an unnamed interval is reported in seconds rather than mislabelled');
}

console.log('\n== the walk runs on those bars, with no network ==');
{
  const ctx = loadStrategy();
  const all = ctx.HG_P80_VARIANTS;
  const cfg = ctx.hg80Cfg({ tf: '5m', sec: 300 });

  const specOnly = run(BARS, ctx, { cfg });
  ok(Array.isArray(specOnly.trades), 'a spec-only walk completes');
  ok(specOnly.trades.every(t => t.variant === 'spec'),
     'and takes nothing but spec firings — the default population is unchanged');

  const wide = run(BARS, ctx, { cfg, variants: all });
  ok(wide.trades.length > specOnly.trades.length,
     `asking for every mechanic can only add trades (${specOnly.trades.length} -> ${wide.trades.length})`);
  ok(wide.trades.length > 5, `and the fixture produces enough to measure (${wide.trades.length})`);
  ok(wide.trades.every(t => t.mechanic && t.kind.startsWith(t.mechanic)),
     'every row names the mechanic that produced it, so the records stay apart');

  /* the sequential book really is sequential */
  let lastExit = null;
  for (const t of wide.trades){
    if (lastExit) ok(t.tISO >= lastExit, 'no trade opens before the previous one exited');
    lastExit = t.exitISO;
  }
  passed++; console.log('  ok — the book holds one position at a time, start to finish');
}

console.log('\n== the geometry sweep prices the SAME entries at other multiples ==');
{
  const ctx = loadStrategy();
  const cfg = ctx.hg80Cfg({ tf: '5m', sec: 300 });
  const all = ctx.HG_P80_VARIANTS;
  const sw = sweepGeometry(BARS, ctx, { cfg, variants: all });

  ok(sw.cells.length === SWEEP_TP.length * SWEEP_SL.length,
     `every pair is priced (${sw.cells.length} cells)`);

  /* THE BAR MOVES WITH THE GEOMETRY. Scoring a 2.0/2.0 cell against the
     spec's 84.21% would be the whole measurement inverted. */
  for (const c of sw.cells){
    ok(near(c.grossBreakeven, c.slAtr / (c.slAtr + c.tpAtr)),
       `${c.slAtr}/${c.tpAtr} is judged against its OWN ${(100 * c.grossBreakeven).toFixed(2)}% bar`);
  }

  const spec = sw.cells.find(c => c.tpAtr === 0.75 && c.slAtr === 4.0);
  ok(!!spec, 'the supplied spec is one of the cells, so it can be compared like any other');
  ok(near(spec.grossBreakeven, 0.842105, 1e-5), 'and still needs 84.2105%');

  /* wider stop -> longer hold -> more later signals skipped. Not an error,
     and the number a reader will ask about first. */
  const tight = sw.cells.find(c => c.slAtr === 1.0 && c.tpAtr === 3.0);
  const wide = sw.cells.find(c => c.slAtr === 4.0 && c.tpAtr === 3.0);
  ok(tight && wide && tight.taken >= wide.taken - 1,
     `trade counts differ between cells because holding time does (${tight.taken} vs ${wide.taken})`);

  /* THE HEALTH WARNING IS COMPUTED, NOT ASSERTED */
  const mc = sw.multipleComparisons;
  const n = sw.cells.length;
  ok(mc.cellsTested === n, 'the warning counts the cells actually tested');
  ok(near(mc.chanceOneClearsByLuck, 1 - Math.pow(0.95, n), 1e-12),
     `the familywise error is computed: ${(100 * mc.chanceOneClearsByLuck).toFixed(1)}% chance one `
     + 'cell clears by luck alone');
  ok(near(mc.sidakPerCellAlphaFor95Overall, 1 - Math.pow(0.95, 1 / n), 1e-12),
     `with the Sidak per-cell level that would be needed instead `
     + `(${(100 * mc.sidakPerCellAlphaFor95Overall).toFixed(3)}%)`);
  ok(/Nothing here is a recommendation/.test(mc.note)
     && /re-measured on bars this sweep never saw/.test(mc.note),
     'and it refuses to name a winner, in words');
  ok(!Object.keys(sw).some(k => /best|winner|recommend/i.test(k)),
     'the sweep exposes no "best cell" field for a caller to quote out of context');
}

console.log('\n== and the summary is scored against the geometry that produced it ==');
{
  const ctx = loadStrategy();
  const cfg = ctx.hg80Cfg({ tf: '5m', sec: 300 });
  const r = run(BARS, ctx, { cfg, variants: ctx.HG_P80_VARIANTS, geometry: { tpAtr: 2, slAtr: 2 } });
  const sum = summarise(r.trades, r.geometry);
  ok(near(sum.grossBreakeven, 0.5), 'a 2.0 / 2.0 book needs 50%, not the spec\'s 84.21%');
  ok(sum.geometry.tpAtr === 2 && sum.geometry.slAtr === 2, 'and the summary carries its geometry');
  ok(r.trades.every(t => near(Math.abs(t.t1 - t.entry) / t.atr, 2, 1e-6)),
     'every plan really was built at the requested target');
  ok(r.trades.every(t => near(Math.abs(t.entry - t.stop) / t.atr, 2, 1e-6)),
     'and the requested stop');

  const dflt = summarise(r.trades);
  ok(near(dflt.grossBreakeven, 0.842105, 1e-5),
     'with no geometry passed it falls back to the spec, so old callers are unchanged');
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${passed} passed, 0 failed`);
