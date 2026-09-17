/* HARDGATE — every table that decides "has this candle closed?" must know
   every timeframe the app requests.

   THE BUG THIS EXISTS FOR. getClosedCandles(rows, tf, now) strips the
   still-forming bar. It looked the timeframe up in a table that stopped at
   15m, and a missing key made it a silent no-op:

       var sec = TF_SEC[tf] || 0;
       ...
       if (!sec) return { rows: clean, stale: false, dropped };

   — every row handed back, forming bar included, reporting stale:false, a
   freshness claim it had never made. Four more copies of the same table had
   the same hole. 5m was the live case: any desk reading 5m bars evaluated
   close-vs-open, wick-through and EMA/RSI/ATR on a candle still moving, so
   setups appeared and vanished tick to tick.

   A lookup that fails OPEN cannot be caught by reading it. It has to be
   asserted. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* The canonical set is not invented here: hg-forward.js has carried the full
   list since long before this bug, so it is the app's own statement of which
   timeframes exist. Deriving it rather than hard-coding it means the two
   cannot drift apart without this test noticing. */
const FWD = read('hg-forward.js');
const canonSrc = (FWD.match(/var TF_SEC = \{[^}]*\}/) || [])[0] || '';
const CANON = {};
for (const m of canonSrc.matchAll(/'([0-9]+[mhd])'\s*:\s*([0-9]+)/g)) CANON[m[1]] = Number(m[2]);

console.log('\n== the canonical timeframe set, taken from the app itself ==');
{
  ok(Object.keys(CANON).length >= 8,
     `hg-forward.js declares ${Object.keys(CANON).length} timeframes: ${Object.keys(CANON).join(', ')}`);
  for (const [tf, sec] of [['1m', 60], ['5m', 300], ['15m', 900], ['30m', 1800],
                           ['1h', 3600], ['2h', 7200], ['4h', 14400], ['1d', 86400]]){
    ok(CANON[tf] === sec, `${tf} is ${sec}s`);
  }
}

/* Every place that decides whether a bar has closed. Each is a literal table
   in source, so each is read back out of source. */
const TABLES = [
  { file: 'hg-setup-core.js',   re: /var TF_SEC = \{[^}]*\}/,            what: 'getClosedCandles (browser bridge)' },
  { file: 'lib/hg-setup-core.mjs', re: /const TF_SEC = \{[^}]*\}/,       what: 'getClosedCandles (module)' },
  { file: 'index.html',         re: /const sec = \{[^}]*\}\[res\];\s*\n\s*if \(!rows\.length \|\| !sec\)/, what: 'dropForming fallback' },
  { file: 'index.html',         re: /const sec = \{[^}]*\}\[res\];\s*\n\s*if \(!rows \|\| !rows\.length \|\| !sec\)/, what: 'hgBarIsForming' },
  { file: 'startradertab.js',   re: /var sec = \{[^}]*\}\[tf\];/,        what: 'stDropForming' }
];

console.log('\n== every closed-candle table knows every timeframe ==');
for (const t of TABLES){
  const src = read(t.file);
  const hit = src.match(t.re);
  ok(!!hit, `${t.what} (${t.file}) — table located`);
  const got = {};
  for (const m of hit[0].matchAll(/'([0-9]+[mhd])'\s*:\s*([0-9]+)/g)) got[m[1]] = Number(m[2]);
  for (const tf of Object.keys(CANON)){
    ok(got[tf] === CANON[tf],
       `${t.what}: ${tf} = ${CANON[tf]}s` + (got[tf] === undefined ? ' (was MISSING)' : ''));
  }
}

/* And the behaviour, not just the literal — the table could be right while
   the function that reads it is not. */
console.log('\n== getClosedCandles actually drops the forming bar on every timeframe ==');
{
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, parseFloat,
                Number, String, Object, Array, JSON };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('hg-setup-core.js'), ctx, { filename: 'hg-setup-core.js' });
  ok(typeof ctx.getClosedCandles === 'function', 'getClosedCandles is exported to the page');

  const now = Math.floor(Date.UTC(2026, 8, 17, 12, 0, 0) / 1000);
  const bars = (sec, n, lastOpen) => {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push({ t: lastOpen - i * sec, o: 1, h: 1, l: 1, c: 1 + i });
    return out;
  };

  for (const [tf, sec] of Object.entries(CANON)){
    /* a bar that opened one second ago is unambiguously still forming */
    const forming = bars(sec, 5, now - 1);
    const pack = ctx.getClosedCandles(forming, tf, now);
    ok(pack.rows.length === 4,
       `${tf}: a bar 1s old is still forming and is dropped (5 -> ${pack.rows.length})`);

    /* and one that opened a full interval ago has closed */
    const closed = bars(sec, 5, now - sec);
    ok(ctx.getClosedCandles(closed, tf, now).rows.length === 5,
       `${tf}: a bar ${sec}s old has closed and is kept`);
  }

  /* the staleness claim was also unchecked whenever the key was missing */
  const stale5m = ctx.getClosedCandles(bars(300, 5, now - 300 * 10), '5m', now);
  ok(stale5m.stale === true,
     '5m now reports a stale feed too — with no key it returned stale:false without looking');

  /* an unknown timeframe still fails open, but that is now the ONLY way in,
     and the tables above prove no real timeframe takes it */
  const unknown = ctx.getClosedCandles(bars(300, 5, now - 1), '7m', now);
  ok(unknown.rows.length === 5,
     'a genuinely unknown timeframe still passes rows through rather than throwing');
}

console.log(`\n${passed} passed, 0 failed`);
