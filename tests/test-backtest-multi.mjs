/* HARDGATE — pooling symbols must not fake the sample it buys.

   One symbol is one bet. The sequential book takes ~1.65 trades a day on
   PAXG at a per-trade sd of 1.32R, so proving a +0.10R edge needs 1,367
   trades — years. More independent bets is the only lever that shortens
   that, and it shortens it linearly.

   The trap is the word INDEPENDENT. Gold, silver and platinum move
   together: pooling three of them multiplies rows faster than it
   multiplies evidence, and a script that reported pooled n as if it were
   independent would repeat, across symbols, exactly the overlap error that
   hgOgEffN fixes within one. These tests are mostly about that.

   Run: node tests/test-backtest-multi.mjs */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const SCRIPT = path.join(ROOT, 'scripts', 'backtest-multi.mjs');
const WALK = path.join(ROOT, 'scripts', 'backtest-omnigold.mjs');
const run = args => execFileSync(process.execPath, [SCRIPT].concat(args),
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

ok(fs.existsSync(SCRIPT), 'the pooling driver exists');

console.log('\n== the walk takes a symbol, and protects the default artifact ==');
{
  const src = fs.readFileSync(WALK, 'utf8');
  ok(/--symbol/.test(src), 'backtest-omnigold.mjs accepts --symbol');
  ok(/opt\('--symbol', 'PAXGUSDT'\)/.test(src), 'and still defaults to PAXGUSDT');
  /* a per-symbol run must not overwrite the artifact the whole repo quotes */
  ok(/SYMBOL !== 'PAXGUSDT'[\s\S]{0,200}backtest-omnigold-results-/.test(src),
     'a non-default symbol writes to its OWN artifact, never over the PAXG one');
  ok(/let OUT_FILE/.test(src), 'which requires OUT_FILE to be assignable after the CLI is read');
}

console.log('\n== it pools what exists and names what does not ==');
{
  const out = run(['--symbols=PAXGUSDT,NOTAREALSYMBOL']);
  ok(/NOT WALKED YET/.test(out), 'a missing symbol is reported, not skipped silently');
  ok(/NOTAREALSYMBOL/.test(out), 'by name');
  ok(/--run/.test(out), 'with the command that would produce it');
  ok(/PAXGUSDT/.test(out), 'and the symbol that IS walked still pools');

  const j = JSON.parse(run(['--symbols=PAXGUSDT,NOTAREALSYMBOL', '--json']));
  ok(j.missing.length === 1 && j.missing[0].sym === 'NOTAREALSYMBOL', 'the JSON says which is missing');
  ok(j.perSymbol.length === 1, 'and pools only the one it has');
}

console.log('\n== the rate is per CALENDAR day, not per day something happened ==');
{
  const j = JSON.parse(run(['--symbols=PAXGUSDT', '--json']));
  const p = j.perSymbol[0];
  const out = run(['--symbols=PAXGUSDT']);
  const m = /([\d.]+) trades\/day pooled over (\d+) calendar days/.exec(out);
  ok(m, 'the report states the rate and the window it is over');
  const rate = +m[1], days = +m[2];
  ok(days > p.days, 'the denominator is the calendar span (' + days
    + '), larger than the ' + p.days + ' days with a trade');
  ok(Math.abs(rate - p.n / days) < 0.01, 'and the rate is trades / calendar days');
  /* the flattering version: dividing by active days would inflate this */
  ok(rate < p.n / p.days, 'which is a LOWER rate than dividing by active days would give');
}

console.log('\n== correlation is measured, never assumed ==');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-multi-'));
  const mkArtifact = (file, trades, from, to) => {
    fs.writeFileSync(file, JSON.stringify({
      meta: { span: { from, to }, fees: { roundTripFrac: 0.0026 } }, trades
    }));
  };
  /* build two fake symbols whose daily R is IDENTICAL: perfectly
     correlated, so two symbols must count as about one bet */
  const day = i => new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
  const trades = (mult) => Array.from({ length: 40 }, (_, i) => ({
    tISO: day(i), exitISO: day(i) + '', entry: 1000, stop: 990, t1: 1020,
    dir: 'long', horizon: 'SWING', tier: 'FAIR',
    rMultiple: mult * ((i % 5) - 2), outcome: (i % 5) > 2 ? 'win' : 'loss'
  }));
  const A = path.join(ROOT, 'scripts', 'backtest-omnigold-results-testaaa.json');
  const B = path.join(ROOT, 'scripts', 'backtest-omnigold-results-testbbb.json');
  mkArtifact(A, trades(1), day(0), day(39));
  mkArtifact(B, trades(1), day(0), day(39));
  try {
    const j = JSON.parse(run(['--symbols=TESTAAA,TESTBBB', '--json']));
    ok(j.correlation.pairs.length === 1, 'the pair is measured');
    ok(j.correlation.pairs[0].r > 0.95, 'two identical series correlate ~1 (' + j.correlation.pairs[0].r + ')');
    ok(j.correlation.effectiveSymbols < 1.2,
       'so two perfectly correlated symbols count as ~1 independent bet ('
       + j.correlation.effectiveSymbols + '), not 2');

    const txt = run(['--symbols=TESTAAA,TESTBBB']);
    ok(/independent bets/.test(txt), 'and the report says so in words');
    ok(/move together/.test(txt), 'naming why gold-family symbols do not pool cleanly');
  } finally {
    fs.rmSync(A, { force: true }); fs.rmSync(B, { force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('\n== with nothing measured it says unknown, not independent ==');
{
  const j = JSON.parse(run(['--symbols=PAXGUSDT', '--json']));
  ok(j.correlation.pairs.length === 0, 'one symbol yields no pair');
  ok(j.correlation.mean === null, 'so the mean correlation is null, not 0');
  ok(j.correlation.effectiveSymbols === null, 'and the effective symbol count is null, not 1');
  const out = run(['--symbols=PAXGUSDT']);
  ok(/UPPER BOUND/.test(out), 'the text calls the unpooled n an upper bound on the real sample');
}

console.log('\n== the power table is the argument, and it is arithmetic ==');
{
  const out = run(['--symbols=PAXGUSDT']);
  ok(/trades needed/.test(out), 'the report states how many trades an edge needs');
  const rows = [...out.matchAll(/\+([\d.]+)R\s+(\d+)\s+([\d.]+)/g)].map(m => ({
    edge: +m[1], n: +m[2], yrs: +m[3]
  }));
  ok(rows.length >= 4, 'for several edge sizes');
  /* n scales as 1/edge^2 — halve the edge, quadruple the trades */
  const a = rows.find(r => r.edge === 0.10), b = rows.find(r => r.edge === 0.20);
  ok(a && b, 'including +0.10R and +0.20R');
  ok(Math.abs(a.n / b.n - 4) < 0.1, 'halving the edge quadruples the trades needed (' + (a.n / b.n).toFixed(2) + 'x)');
  ok(a.yrs > b.yrs, 'and the years scale with it');
  ok(a.yrs > 1, 'a +0.10R edge still needs more than a year on one symbol — the whole point');
}

console.log('\n' + passed + ' passed, 0 failed');
