/* HARDGATE — "191 open" was not 191 trades still running.

   Settlement needs BARS for that symbol to arrive. hgFwdResolve is called
   with fresh candles during a scan, and only records for that symbol move.
   So if a contract is delisted, renamed, or simply drops out of the universe,
   the bars never come and the record stays 'open' for ever — there was no
   wall-clock expiry anywhere in the module.

   A live desk showed roughly 1,200 open records across its mechanics, read as
   "trades still in flight". Some fraction of those could never settle, and
   nothing distinguished them. They also sit inside the 4,000-record cap,
   pushing newer evidence out.

   'stale' is now reported apart from 'open'. It is NOT a settlement: we do
   not know the outcome and must never guess one, so it counts as neither a
   win, a loss, nor an expiry, and never enters the hit rate. It answers a
   different question — "is this still evidence in flight, or did the contract
   go quiet?" — and those are not the same fact.

   Three horizons is the threshold: well beyond any normal settle, so a
   genuinely slow resolution is never mislabelled.

   Run: node tests/test-stale-records.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const store = {};
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String };
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8'), ctx, { filename: 'hg-forward.js' });
  return ctx;
}

const HR = 3600;
const NOW = Math.floor(Date.now() / 1000);
/* A 4h record with a 20-bar horizon: 80 hours. Stale past 3x = 240 hours. */
const add = (W, agoHours, mech, tf, hz) => W.hgFwdRecord({
  tab: 'T', mechanic: mech, sym: 'S' + mech, tf: tf || '4h', dir: 'long',
  entry: 100, stop: 98, t1: 104, barT: NOW - agoHours * HR, horizonBars: hz || 20 });

console.log('== open and stale are different facts ==');
{
  const W = boot();
  add(W, 4,    'FRESH');      /* well inside the horizon           */
  add(W, 60,   'RECENT');     /* inside the 80h horizon            */
  add(W, 200,  'WAITING');    /* past the horizon, under 3x        */
  add(W, 400,  'DEAD');       /* past 3x — the bars are not coming */
  add(W, 5000, 'ANCIENT');
  const s = W.hgFwdStats('T', null, false);
  ok(s.open === 3, 'three records can still settle (' + s.open + ')');
  ok(s.stale === 2, 'two are stale (' + s.stale + ')');
  ok(s.open + s.stale === 5, 'and together they account for every open record');
  ok(s.samples === 0, 'neither counts as a settled sample');
  ok(s.wins === 0 && s.losses === 0 && s.expired === 0,
     'stale is not a win, not a loss, and not an expiry — the outcome is unknown');
  ok(!isFinite(s.hit), 'so it never enters the hit rate');
}

console.log('\n== the threshold is three horizons, not an arbitrary age ==');
{
  const W = boot();
  /* 1h x 24 bars  -> 24h horizon  -> stale past 72h
     1d x 20 bars  -> 480h horizon -> stale past 1440h
     The SAME wall-clock age means different things to the two, which is
     exactly why the threshold is derived per record rather than fixed. */
  add(W, 50,  'SCALP_LIVE', '1h', 24);    /* 50h: past the 24h horizon, under 72h */
  add(W, 100, 'DAILY_LIVE', '1d', 20);    /* 100h: nowhere near 1440h             */
  const a = W.hgFwdStats('T', 'SCALP_LIVE', false);
  const b = W.hgFwdStats('T', 'DAILY_LIVE', false);
  ok(a.stale === 0 && a.open === 1, 'a 1h record at 50h is still live — past its horizon but under 3x');
  ok(b.stale === 0 && b.open === 1, 'and a daily record at 100h is nowhere near its own threshold');

  const W2 = boot();
  add(W2, 100, 'SCALP_DEAD', '1h', 24);   /* 100h > 72h -> stale */
  ok(W2.hgFwdStats('T', 'SCALP_DEAD', false).stale === 1,
     'the same 100h IS stale for a 1h/24-bar record, because its horizon is shorter');
  const W3 = boot();
  add(W3, 2000, 'DAILY_DEAD', '1d', 20);  /* 2000h > 1440h -> stale */
  ok(W3.hgFwdStats('T', 'DAILY_DEAD', false).stale === 1,
     'and a daily record needs ' + (20 * 24 * 3) + 'h before it is — 20x longer than the 1h one');
}

console.log('\n== a settled record is never called stale, however old ==');
{
  const W = boot();
  add(W, 5000, 'OLD_WIN');
  /* Settle it with bars that reach T1. */
  const later = [];
  for (let k = 1; k <= 6; k++) later.push({ t: NOW - 5000 * HR + k * 4 * HR, o: 100, h: k === 3 ? 105 : 101, l: 99, c: 100, v: 1 });
  /* add() names the symbol 'S' + mechanic, so this is SOLD_WIN. */
  W.hgFwdResolve('SOLD_WIN', '4h', later);
  const s = W.hgFwdStats('T', 'OLD_WIN', false);
  ok(s.stale === 0, 'a record that SETTLED is never stale, whatever its age (stale=' + s.stale + ')');
  ok(s.samples === 1 || s.open === 0, 'it resolved rather than lingering');
}

console.log('\n== degenerate records never throw and are never guessed at ==');
{
  const W = boot();
  /* A record with no horizon, no timeframe or a broken barT cannot be aged,
     and must count as open rather than being quietly written off. */
  W.hgFwdRecord({ tab: 'T', mechanic: 'NOHZ', sym: 'A', tf: '4h', dir: 'long',
                  entry: 100, stop: 98, t1: 104, barT: NOW - 5000 * HR, horizonBars: 0 });
  W.hgFwdRecord({ tab: 'T', mechanic: 'NOTF', sym: 'B', dir: 'long',
                  entry: 100, stop: 98, t1: 104, barT: NOW - 5000 * HR, horizonBars: 20 });
  let threw = null, s = null;
  try { s = W.hgFwdStats('T', null, false); } catch (e) { threw = e; }
  ok(!threw, 'stats over degenerate records does not throw');
  ok(s.open + s.stale >= 1, 'and they are still counted somewhere rather than vanishing');
  const noHz = W.hgFwdStats('T', 'NOHZ', false);
  ok(noHz.stale === 0 && noHz.open === 1,
     'a record with no horizon cannot be aged, so it stays OPEN rather than being written off');
}

console.log('\n== the panels say which is which ==');
{
  const FWD = fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8');
  const ROUTE = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
  const GOLD = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/stale: stale,/.test(FWD), 'stats returns it');
  ok(/' stale<\/span>'|stale<\/span>/.test(FWD), 'the shared forward panel shows it');
  for (const [n, src] of [['omniroute', ROUTE], ['omnigold', GOLD]]){
    ok(/f\.stale > 0/.test(src), n + ' forward cell shows stale apart from open');
  }
  ok(/STALE = recorded, then the bars to settle it never arrived/.test(GOLD),
     'and hgOgReport explains what stale means rather than printing a bare number');
  ok(/nothing settled — ' \+ p\.stale \+ ' stale'/.test(FWD),
     'a mechanic with only stale records does not read "never fired"');
}

console.log('\n== nothing that used to settle stopped settling ==');
{
  /* The split must not have changed how a real trade resolves. */
  const W = boot();
  W.hgFwdRecord({ tab: 'T', mechanic: 'M', sym: 'X', tf: '4h', dir: 'long',
                  entry: 100, stop: 98, t1: 104, barT: NOW - 40 * HR, horizonBars: 20 });
  const bars = [];
  for (let k = 1; k <= 6; k++) bars.push({ t: NOW - 40 * HR + k * 4 * HR, o: 100, h: k === 3 ? 105 : 101, l: 99, c: 100, v: 1 });
  W.hgFwdResolve('X', '4h', bars);
  const s = W.hgFwdStats('T', 'M', false);
  ok(s.samples === 1 && s.wins === 1, 'a winner still settles as a win');
  ok(s.stale === 0 && s.open === 0, 'and is neither open nor stale afterwards');
  ok(s.hit === 1, 'with the hit rate intact');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL STALE RECORD TESTS PASSED');
