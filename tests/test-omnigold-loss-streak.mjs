/* HARDGATE — a safety control that cannot fire is not a safety control.

   The OMNIGOLD tab advertises two drawdown protections: a -2% weekly
   circuit breaker, and an automatic halving of position size after three
   losses in a row. Both read state.losStreak and state.weekPnl.

   hgOgUpdateDrawdownOnSettle is the ONLY writer of either, and it has no
   call site anywhere in the app. The counters were zero forever. The panel
   was honest about it — "Streak: unavailable" — but being honest about a
   control that does not work is not the same as the control working, and
   the card's own sizing pill went further: it printed a percentage computed
   from confluence and queue depth while the panel a few inches away could
   announce "Sizing: auto-50%". hgOgApplyDrawdownSizing existed to reconcile
   the two and was called by nobody.

   The forward ledger settles every recorded setup — win, loss or expiry —
   with the time the outcome landed. A consecutive-loss streak is exactly
   what that record answers, and unlike weekPnl it needs no account equity
   to do it. Week P&L still cannot be answered here (R to % needs equity and
   risk-per-trade that no tab in this app carries) and stays unavailable
   rather than being invented from a constant.

   Run: node tests/test-omnigold-loss-streak.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* a real localStorage, because the whole point is that the ledger persists */
function boot(seed){
  const store = Object.create(null);
  if (seed) for (const k of Object.keys(seed)) store[k] = seed[k];
  const doc = { getElementById: () => null,
                createElement: () => ({ style: {}, classList: { add(){}, remove(){} },
                                        appendChild(){}, setAttribute(){} }),
                querySelector: () => null, querySelectorAll: () => [],
                head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, document: doc,
                setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {},
                fetch: () => Promise.reject(new Error('no net')),
                localStorage: {
                  getItem: k => (k in store ? store[k] : null),
                  setItem: (k, v) => { store[k] = String(v); },
                  removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'formation.js', 'plans.js', 'hg-gates.js', 'hg-plan.js',
                   'omniroute.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  ctx.__store = store;
  return ctx;
}

/* A settled record in the ledger's own shape. `tab` and `state` and
   `settledT` are the only fields a streak reads; the rest are filled so the
   record is a legal one rather than a fixture that only works here. */
const rec = (tab, state, settledT, barT) => ({
  tab, mechanic: 'ROUND-MAGNET', sym: 'XAUUSD', tf: '1h', dir: 'long',
  entry: 4000, stop: 3980, t1: 4040, risk: 20, rr: 2,
  barT: barT || (settledT - 7200), horizonBars: 20,
  state, r: state === 'stop' ? -1 : (state === 't1' ? 2 : null),
  settledT
});
const LS_KEY = 'hg_forward_v1';
const seedWith = (recs) => ({ [LS_KEY]: JSON.stringify(recs) });
const T = 1700000000;

console.log('== the ledger key this test writes is the one the app reads ==');
{
  /* If the key were wrong every assertion below would pass against an empty
     ledger, so it is established first rather than assumed. */
  const W = boot();
  ok(typeof W.hgFwdAdd === 'function' && typeof W.hgFwdLossStreak === 'function',
     'the ledger and the streak reader are both exported');
  const before = W.hgFwdLossStreak(['OMNIGOLD:SCALP']);
  ok(before.settled === 0, 'an empty ledger reports nothing settled');
  const seeded = boot(seedWith([rec('OMNIGOLD:SCALP', 'stop', T)]));
  ok(seeded.hgFwdLossStreak(['OMNIGOLD:SCALP']).settled === 1,
     `a record written under ${LS_KEY} is read back, so the fixtures are reaching the real store`);
}

console.log('\n== the streak itself ==');
{
  const S = 'OMNIGOLD:SCALP';
  const streak = (recs) => boot(seedWith(recs)).hgFwdLossStreak([S]);

  ok(streak([]).streak === 0 && streak([]).settled === 0,
     'no settled record — zero streak AND zero settled, which is how a reader tells '
     + 'a measured zero from an unfed counter');

  ok(streak([rec(S, 'stop', T)]).streak === 1, 'one loss is a streak of one');
  ok(streak([rec(S, 'stop', T), rec(S, 'stop', T + 100), rec(S, 'stop', T + 200)]).streak === 3,
     'three losses in a row is three');
  ok(streak([rec(S, 'stop', T), rec(S, 'stop', T + 100), rec(S, 't1', T + 200)]).streak === 0,
     'a winner AFTER them ends the run');
  ok(streak([rec(S, 't1', T), rec(S, 'stop', T + 100), rec(S, 'stop', T + 200)]).streak === 2,
     'a winner BEFORE them does not — the run is counted backwards from the newest');

  /* the judgement call, pinned explicitly because it is a choice */
  ok(streak([rec(S, 'stop', T), rec(S, 'expired', T + 100), rec(S, 'stop', T + 200)]).streak === 2,
     'an expired trade is SKIPPED, not counted as a loss and not counted as a winner — '
     + 'a scratch decides nothing, so two stops around it are still two in a row');
  ok(streak([rec(S, 'expired', T), rec(S, 'expired', T + 100)]).streak === 0,
     'and expiries alone are a streak of zero, never of two');
  const onlyExp = streak([rec(S, 'expired', T), rec(S, 'expired', T + 100)]);
  ok(onlyExp.settled === 2 && onlyExp.expired === 2 && onlyExp.losses === 0,
     'though they are still counted as settled, so the panel can say what it saw');

  /* ORDER IS BY OUTCOME, NOT BY SIGNAL. Two setups written on the same bar
     can settle days apart; a streak is about the order outcomes landed in. */
  const outOfOrder = streak([
    rec(S, 'stop', T + 300, T),        /* fired first, settled last  */
    rec(S, 't1',   T + 100, T),        /* fired first, settled first */
    rec(S, 'stop', T + 200, T)
  ]);
  ok(outOfOrder.streak === 2,
     'records stored out of settle order are ordered by settledT, not by position in the array');
  const byBarT = streak([
    rec(S, 't1',   T + 500, T + 10),   /* newest OUTCOME, oldest-but-one signal */
    rec(S, 'stop', T + 100, T + 400)   /* older outcome, newest signal          */
  ]);
  ok(byBarT.streak === 0,
     'and by settledT rather than barT — the newest OUTCOME is the winner, so the run is over');

  /* a settled record with no usable settle time cannot be placed in an order */
  const noTime = streak([rec(S, 'stop', T), Object.assign(rec(S, 'stop', T + 100), { settledT: null })]);
  ok(noTime.settled === 2 && noTime.losses === 2,
     'a settled record with no settle time still counts toward the totals');
  ok(noTime.streak === 1,
     'but is left out of the run, because a streak is an ordering and it has no place in one');

  /* totals */
  const mixed = streak([rec(S, 't1', T), rec(S, 'stop', T + 1), rec(S, 'expired', T + 2),
                        rec(S, 'stop', T + 3), rec(S, 't1', T + 4)]);
  ok(mixed.wins === 2 && mixed.losses === 2 && mixed.expired === 1 && mixed.settled === 5,
     'the totals count each outcome once');
  ok(mixed.lastT === T + 4, 'and lastT is the newest outcome');

  /* open records are not outcomes */
  const withOpen = streak([rec(S, 'stop', T), Object.assign(rec(S, 'stop', T + 1), { state: 'open' })]);
  ok(withOpen.settled === 1 && withOpen.streak === 1, 'an open record is not settled and does not count');
}

console.log('\n== both horizons pool, and other desks do not leak in ==');
{
  const W0 = boot();
  ok(Array.isArray(W0.HG_OG_FWD_TABS) && W0.HG_OG_FWD_TABS.length === 2,
     `the desk pools ${JSON.stringify(W0.HG_OG_FWD_TABS)}`);
  const recs = [
    rec('OMNIGOLD:SCALP', 'stop', T),
    rec('OMNIGOLD:SWING', 'stop', T + 100),
    rec('OMNIGOLD:SCALP', 'stop', T + 200),
    rec('GOLDSCALP',      't1',   T + 300)   /* another desk's winner, newest of all */
  ];
  const W = boot(seedWith(recs));
  const pooled = W.hgOgFwdLossStreak();
  ok(pooled && pooled.streak === 3,
     'three losses across SCALP and SWING are three for the desk — a drawdown control is a '
     + 'property of the desk, not of one horizon');
  ok(pooled.settled === 3, 'and only OMNIGOLD records are counted');
  ok(W.hgFwdLossStreak(['GOLDSCALP']).settled === 1,
     "while another desk's record is still there — it is filtered, not missing");
  ok(W.hgFwdLossStreak(['OMNIGOLD:SCALP']).streak === 2,
     'a single horizon read on its own sees only its own two');
}

console.log('\n== the control actually fires now ==');
{
  const S = 'OMNIGOLD:SCALP';
  const three = [rec(S, 'stop', T), rec(S, 'stop', T + 100), rec(S, 'stop', T + 200)];
  const two = three.slice(0, 2);

  const W3 = boot(seedWith(three));
  const W2 = boot(seedWith(two));
  const W0 = boot();

  ok(W0.hgOgApplyDrawdownSizing(1.0) === 1.0, 'an empty ledger does not halve anything');
  ok(W2.hgOgApplyDrawdownSizing(1.0) === 1.0, 'two losses in a row do not halve anything');
  ok(W3.hgOgApplyDrawdownSizing(1.0) === 0.5,
     'three DO — the auto-50% reduction fires for the first time');
  ok(W3.hgOgApplyDrawdownSizing(0.7) === 0.35, 'and it composes with the other sizing, not replaces it');

  /* the stored path still works when a caller supplies one */
  ok(W0.hgOgApplyDrawdownSizing(1.0, { losStreak: 4 }) === 0.5,
     'an explicitly passed state is still honoured — the ledger is the DEFAULT, not an override');
  ok(W3.hgOgApplyDrawdownSizing(1.0, { losStreak: 0 }) === 1.0, 'in both directions');

  /* THE SIZING PILL ON THE CARD. It read confluence and queue depth only. */
  const pill0 = W0.hgOgRiskBadgeHtml(3, 0);
  const pill3 = W3.hgOgRiskBadgeHtml(3, 0);
  ok(/100% sizing/.test(pill0), `with no losses the card reads 100% (${pill0.replace(/<[^>]+>/g, '')})`);
  ok(/50% sizing/.test(pill3),
     `after three losses the SAME card reads 50% (${pill3.replace(/<[^>]+>/g, '')})`);
  ok(/losses in a row/.test(pill3), 'and says why, rather than changing a number silently');
  ok(pill0 !== pill3, 'so the pill is no longer blind to the control the panel announces');

  /* and it still composes with the confluence and queue rules */
  const thin3 = W3.hgOgRiskBadgeHtml(2, 0);
  ok(/35% sizing/.test(thin3),
     `70% for thin confluence times 50% for the streak is 35% (${thin3.replace(/<[^>]+>/g, '')})`);
  ok(W3.hgOgRiskBadgeHtml(0, 0) === '', 'a zero-gate setup still renders no pill at all');
}

console.log('\n== the panel reports what it has and no more ==');
{
  const S = 'OMNIGOLD:SCALP';
  const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
                              .replace(/&middot;/g, '·').replace(/\s+/g, ' ').trim();

  const empty = strip(boot().hgOgDrawdownMetricsHtml());
  ok(/Streak: unavailable/.test(empty), `an unfed ledger still says unavailable: "${empty}"`);
  ok(/Week P&L: unavailable/.test(empty), 'and so does Week P&L');
  ok(!/0L/.test(empty), 'no fabricated 0L');

  const W = boot(seedWith([rec(S, 't1', T), rec(S, 'stop', T + 100),
                           rec(S, 'expired', T + 150), rec(S, 'stop', T + 200)]));
  const fed = strip(W.hgOgDrawdownMetricsHtml());
  ok(/Streak: 2L/.test(fed), `a fed ledger reports the run: "${fed}"`);
  ok(/4 settled trades/.test(fed), 'with the sample it rests on');
  ok(/1W\/2L/.test(fed) && /1 expired/.test(fed), 'and the split, so the streak can be checked against it');
  ok(/Week P&L: unavailable \(no equity basis/.test(fed),
     'while Week P&L stays unavailable — the ledger measures in R and no tab here carries equity, '
     + 'so that half is NOT quietly filled in');

  /* the auto-50% line appears only when it is true */
  ok(!/auto-50%/.test(fed), 'a two-loss run does not announce the halving');
  const W3 = boot(seedWith([rec(S, 'stop', T), rec(S, 'stop', T + 1), rec(S, 'stop', T + 2)]));
  const fed3 = strip(W3.hgOgDrawdownMetricsHtml());
  ok(/Streak: 3L/.test(fed3) && /auto-50%/.test(fed3), `a three-loss run does: "${fed3}"`);

  /* THE TWO NUMBERS AGREE. This is the thing that was wrong. */
  const pill = strip(W3.hgOgRiskBadgeHtml(3, 0));
  ok(/50% sizing/.test(pill) && /auto-50%/.test(fed3),
     `the panel says auto-50% and the card says "${pill}" — the same number in both places`);

  /* and the renderer survives a corrupt ledger */
  for (const junk of ['not json', '{}', '[]', 'null', '[null,1,"x"]',
                      JSON.stringify([{ tab: 'OMNIGOLD:SCALP', state: 'stop' }]),
                      JSON.stringify([{ tab: 'OMNIGOLD:SCALP', state: 'stop', settledT: 'x' }])]){
    const B = boot({ [LS_KEY]: junk });
    let html, sz;
    try { html = B.hgOgDrawdownMetricsHtml(); sz = B.hgOgRiskBadgeHtml(3, 0); }
    catch (e) { throw new Error('FAIL: a corrupt ledger threw — ' + junk + ' — ' + e.message); }
    if (/NaN|undefined|\[object/.test(strip(html) + strip(sz)))
      throw new Error('FAIL: a corrupt ledger rendered "' + strip(html) + '" / "' + strip(sz) + '"');
  }
  ok(true, 'seven corrupt ledgers render without throwing and without printing NaN or undefined');

  /* absent ledger module: the tab must degrade, not break */
  const NF = boot();
  NF.hgFwdLossStreak = undefined;
  ok(NF.hgOgFwdLossStreak() === null, 'with no ledger the reader answers null rather than guessing');
  ok(NF.hgOgApplyDrawdownSizing(1.0) === 1.0, 'and sizing is unreduced rather than halved on no evidence');
  ok(/Streak: unavailable/.test(strip(NF.hgOgDrawdownMetricsHtml())),
     'and the panel says unavailable');
}

console.log('\n' + passed + ' passed, 0 failed');
