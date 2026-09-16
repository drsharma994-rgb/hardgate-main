/* HARDGATE — the forward log records the firehose; now it says which of it
   reached the screen, and measures its own overlap.

   Two gaps this closes.

   SHOWN. hg-v753's lane throttle means OMNIGOLD forms ~46 plans a day and
   shows about 6. The recording deliberately stays unthrottled — the
   in-sample pool measures the raw mechanic, so the forward pool must
   measure the same thing or the two cannot be compared — but nothing
   marked which firings a reader actually saw, so in six months the log
   could only answer "how did the MECHANIC do", never "how did the cards I
   saw do".

   OVERLAP. omnigold.js corrects its REPLAY intervals with a ratio measured
   on the backtest (hgOgEffN, 0.406). v753 deliberately refused to apply it
   to forward stats, because importing a constant measured on one
   population into another is the error it exists to fix. It never had to
   be imported: every record carries barT, tf and horizonBars, which is
   exactly enough to measure THIS log's own overlap.

   Run: node tests/test-forward-shown-overlap.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const store = {};
const ctx = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
              JSON, Date, RegExp, setTimeout: () => 0, clearTimeout: () => {},
              localStorage: {
                getItem: k => (k in store ? store[k] : null),
                setItem: (k, v) => { store[k] = String(v); },
                removeItem: k => { delete store[k]; }
              } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8'), ctx, { filename: 'hg-forward.js' });

const H = 3600;
const rec = (o) => Object.assign({
  tab: 'OMNIGOLD:SCALP', mechanic: 'MMOVE', sym: 'XAUUSD', tf: '1h', dir: 'long',
  entry: 4700, stop: 4670, t1: 4760, barT: 1700000000, horizonBars: 24
}, o);

console.log('== shown is recorded, and absent means absent ==');
{
  const N = ctx.hgFwdNormalize;
  ok(N(rec({ shown: true })).shown === true, 'shown:true is kept');
  ok(N(rec({ shown: false })).shown === false, 'shown:false is kept');
  /* a tab with no throttle has not told us its cards were hidden, and
     defaulting to false would silently claim every one of them was shown */
  ok(N(rec({})).shown === undefined, 'a caller that says nothing records undefined, not false');
  ok(N(rec({ shown: null })).shown === undefined, 'and null is treated as unsaid');
  ok(N(rec({ shown: 'yes' })).shown === false, 'a non-true value is not promoted to true');
  ok(N(rec({})).ticket === false, 'the older ticket flag still defaults the way it always did');
}

console.log('\n== stamping shown afterwards is write-once ==');
{
  const M = ctx.hgFwdMarkShownOf, K = ctx.hgFwdKey;
  const a = ctx.hgFwdNormalize(rec({ barT: 1700000000 }));
  const b = ctx.hgFwdNormalize(rec({ barT: 1700003600 }));
  const list = [a, b];
  const keys = {}; keys[K(a)] = 1;

  ok(M(list, keys, true) === 1, 'one row matches and is stamped');
  ok(a.shown === true, 'the matched row is now shown');
  ok(b.shown === undefined, 'the unmatched row is untouched — not stamped false by omission');

  /* a re-scan of the same bar must not be able to flip a card's history */
  ok(M(list, keys, false) === 0, 'a second pass changes nothing — write-once');
  ok(a.shown === true, 'and the original verdict stands');

  const keysB = {}; keysB[K(b)] = 1;
  ok(M(list, keysB, false) === 1, 'a row that was never stamped can still be marked hidden');
  ok(b.shown === false, 'and it reads hidden');

  ok(M(list, null, true) === 0, 'no key set changes nothing rather than throwing');
  ok(M(null, keys, true) === 0, 'and neither does no list');
}

console.log('\n== stats can ask for the cards that were shown ==');
{
  const S = ctx.hgFwdStatsOf;
  const mk = (i, shown, state) => Object.assign(
    ctx.hgFwdNormalize(rec({ barT: 1700000000 + i * H })), { shown, state });
  const list = [mk(0, true, 't1'), mk(1, true, 'stop'), mk(2, false, 't1'),
                mk(3, false, 't1'), mk(4, undefined, 't1')];

  const all = S(list, 'OMNIGOLD:SCALP', 'MMOVE', false, null);
  ok(all.wins === 4 && all.losses === 1, 'unfiltered counts every record (4W 1L)');

  const shown = S(list, 'OMNIGOLD:SCALP', 'MMOVE', { shown: true }, null);
  ok(shown.wins === 1 && shown.losses === 1, 'shown-only counts the two that reached the screen');

  /* a record written before the flag existed must not be counted as shown */
  ok(shown.wins + shown.losses === 2, 'and a record with no shown field is excluded, not assumed');

  const ticket = S(list, 'OMNIGOLD:SCALP', 'MMOVE', true, null);
  ok(ticket.wins + ticket.losses === 0, 'the boolean form still means ticket-only, unchanged');
  ok(S(list, 'OMNIGOLD:SCALP', 'MMOVE', { ticket: true }, null).wins === ticket.wins,
     'and the object form agrees with it');
}

console.log('\n== the log measures its OWN overlap, borrowing nothing ==');
{
  const O = ctx.hgFwdOverlapOf;
  const mk = i => ctx.hgFwdNormalize(rec({ barT: 1700000000 + i * H, horizonBars: 24, tf: '1h' }));

  /* ten records one hour apart, each running 24h: heavily overlapping */
  const dense = Array.from({ length: 10 }, (_, i) => mk(i));
  const d = O(dense, 'OMNIGOLD:SCALP', 'MMOVE');
  ok(d, 'a dense log yields an overlap reading');
  ok(d.meanConcurrency > 2, 'it sees real concurrency — mean ' + d.meanConcurrency.toFixed(2) + ' open');
  ok(d.effN < d.n, 'so the effective sample is below the row count (' + d.effN.toFixed(1) + ' of ' + d.n + ')');
  ok(d.effN >= 1, 'and never below one observation');

  /* the same ten, spaced so none overlaps: effN must equal n */
  const sparse = Array.from({ length: 10 }, (_, i) =>
    ctx.hgFwdNormalize(rec({ barT: 1700000000 + i * 48 * H, horizonBars: 24, tf: '1h' })));
  const sp = O(sparse, 'OMNIGOLD:SCALP', 'MMOVE');
  ok(sp && Math.abs(sp.meanConcurrency - 1) < 1e-9, 'a non-overlapping log reads concurrency 1');
  ok(sp.effN === sp.n, 'so its effective sample IS its row count — no deflation invented');

  /* refusing to guess is the point */
  ok(O([mk(0)], 'OMNIGOLD:SCALP', 'MMOVE') === null, 'a single record yields null, not 1');
  ok(O([], 'OMNIGOLD:SCALP', 'MMOVE') === null, 'an empty log yields null');
  const noTiming = [ctx.hgFwdNormalize(rec({ tf: 'nonsense' })), ctx.hgFwdNormalize(rec({ tf: 'nonsense', barT: 1700003600 }))];
  ok(O(noTiming, 'OMNIGOLD:SCALP', 'MMOVE') === null,
     'records with no usable timeframe yield null — a missing measurement is not a measurement of 1');

  ok(O(dense, 'OTHER:TAB', 'MMOVE') === null, 'and the filter really filters');
}

console.log('\n== omnigold stamps the key it actually recorded ==');
{
  /* the throttle marks records by key; reconstructing that key downstream
     would mean guessing whether the tab string came from cfg.label or
     c.horizon. It is stamped once, at record time, from the same values. */
  const og = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/c\.__fwdKey = \['OMNIGOLD:' \+ cfg\.label, c\.kind, 'XAUUSD', c\.dir, barT\]\.join\('\|'\)/.test(og),
     'the exact forward key is stamped on the candidate as it is recorded');
  ok(/hgFwdMarkShown/.test(og), 'and the throttle marks shown/hidden through it');
  ok(/shown: undefined/.test(og), 'the record itself leaves shown unset — the throttle has not run yet');

  /* key agreement, checked rather than assumed */
  const k = ctx.hgFwdKey(ctx.hgFwdNormalize(rec({ barT: 1700000000 })));
  ok(k === ['OMNIGOLD:SCALP', 'MMOVE', 'XAUUSD', 'long', 1700000000].join('|'),
     'and hgFwdKey builds the same shape omnigold stamps');
}

console.log('\n' + passed + ' passed, 0 failed');
