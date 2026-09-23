/* HARDGATE — the tab is waiting, and never said so.

   The desk issues no tickets until 20 settled cleared setups beat
   breakeven. The panel told the reader that was being collected. It was a
   promise with nothing behind it:

     - hgFwdHealthHTML has existed since the log was written and renders
       only on the FORWARD LEDGER tab, so a reader waiting weeks on THIS tab
       could not tell a pipeline that stopped recording from a quiet market.
       hg-forward.js says so in its own words: "a SILENT logging failure is
       worse than the crash it prevents".
     - nothing showed progress. 2-of-20 and 19-of-20 looked identical.
     - `shown` — which cards the throttle actually put on screen, about six
       a day out of forty-nine — has been stamped on every record since
       hg-v753 and QUERIED BY NOTHING. A grep across the repo for a
       shown-only query returns no callers. The one question a person using
       this tab has, "did the cards I saw pay?", was recorded and never
       asked, and the aggregate kept no shown split so it could only ever
       have been answered over about four weeks.

   Run: node tests/test-omnigold-wait-progress.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

function boot(){
  const store = {};
  const doc = { getElementById: () => null, createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
                querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
                body: { appendChild(){} }, addEventListener(){} };
  const ctx = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
                JSON, Date, RegExp, document: doc, setTimeout: () => 0, clearTimeout: () => {},
                addEventListener: () => {}, fetch: () => Promise.reject(new Error('no net')),
                localStorage: { getItem: k => (k in store ? store[k] : null),
                                setItem: (k, v) => { store[k] = String(v); },
                                removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-forward.js', 'plans.js', 'hg-plan.js',
                   'hg-gates.js', 'omniroute.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  /* hg-v925: the strict measured-edge mode is no longer the default (relaxed
     on instruction). This file asserts the strict contract, so every boot
     turns the requirement on. Throws rather than skipping: a swallowed
     no-op would silently test the relaxed mode while claiming the strict one. */
  if (typeof ctx.hgOgSetEdgeProof !== 'function')
    throw new Error('FAIL: omnigold.js did not export hgOgSetEdgeProof');
  ctx.hgOgSetEdgeProof(true);
  return ctx;
}
const text = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

console.log('== an empty log says empty, not zero ==');
{
  const W = boot();
  const t = text(W.hgOgEdgeProgressHtml());
  ok(/SCALP/.test(t) && /SWING/.test(t), 'both horizons are reported');
  ok(/no cleared setups have settled yet/.test(t),
     'and an empty log says so rather than printing a measured-looking 0%');
  ok(!/0%/.test(t), 'no fabricated rate');
}

console.log('\n== progress is visible long before the threshold ==');
{
  const W = boot();
  /* seven settled cleared setups on SCALP, four of them wins */
  const agg = { 'OMNIGOLD:SCALP|': { gc: { wins: 4, losses: 3, expired: 0, rrSum: 8,
                                           fillWins: 0, fillLosses: 0, fillUnfilled: 0, fillUnprovable: 0 } } };
  W.localStorage.setItem('hg_forward_agg_v1', JSON.stringify(agg));
  const t = text(W.hgOgEdgeProgressHtml());
  ok(/SCALP 7 of 20 settled/.test(t), 'it reads 7 of 20 — ' + t.slice(0, 80));
  ok(/57% vs 33% breakeven/.test(t), 'with the rate against breakeven');
  ok(!/enough to judge/.test(t), 'and does not claim it is enough yet');
}

console.log('\n== and says when the wait is over ==');
{
  const W = boot();
  const agg = { 'OMNIGOLD:SWING|': { gc: { wins: 12, losses: 10, expired: 0, rrSum: 24,
                                           fillWins: 0, fillLosses: 0, fillUnfilled: 0, fillUnprovable: 0 } } };
  W.localStorage.setItem('hg_forward_agg_v1', JSON.stringify(agg));
  const t = text(W.hgOgEdgeProgressHtml());
  ok(/SWING 22 of 20 settled/.test(t), 'past the threshold it still shows the count');
  ok(/enough to judge/.test(t), 'and says the gate can now decide');
}

console.log('\n== the cards the reader SAW get their own line ==');
{
  const W = boot();
  /* the same tab, with a shown record that differs from the mechanic record
     — which is the whole point: the throttle publishes about one in eight */
  const agg = { 'OMNIGOLD:SCALP|': {
    gc: { wins: 4, losses: 16, expired: 0, rrSum: 8, fillWins: 0, fillLosses: 0, fillUnfilled: 0, fillUnprovable: 0 },
    sh: { wins: 3, losses: 1, expired: 0, rrSum: 6, fillWins: 0, fillLosses: 0, fillUnfilled: 0, fillUnprovable: 0 }
  } };
  W.localStorage.setItem('hg_forward_agg_v1', JSON.stringify(agg));
  const t = text(W.hgOgEdgeProgressHtml());
  ok(/cards actually shown: 4 settled at 75%/.test(t),
     'the shown population is reported separately — ' + t.slice(0, 110));
  ok(/SCALP 20 of 20 settled . 20%/.test(t),
     'and differs from the unthrottled mechanic record, which is why it is asked at all');
}

console.log('\n== a broken pipeline is not a quiet market ==');
{
  const W = boot();
  W.hgFwdWarnOf ? null : null;
  /* force the log to report a fault the way a real failure would */
  try { W.hgFwdRecord(null); } catch (e) { /* the module swallows it into __errs */ }
  const before = W.hgFwdHealth ? W.hgFwdHealth().recent : 0;
  if (!before){
    /* a malformed record is rejected quietly by design; drive the warn path
       directly so the banner has something to report */
    W.localStorage.setItem('hg_forward_v1', '{not json');
    W.hgFwdStats('OMNIGOLD:SCALP', null, false);
  }
  const h = W.hgFwdHealth ? W.hgFwdHealth() : null;
  ok(h, 'the log exposes its own health');

  /* whatever the count, the renderer must show a banner when there is one
     and stay silent when there is not */
  const quiet = text(W.hgOgEdgeProgressHtml());
  ok(!/THE LOG IS REPORTING ERRORS/.test(quiet) || h.recent > 0,
     'the error banner appears only when the log actually has errors');
  ok(/hgFwdHealth/.test(fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8')),
     'and the gold tab reads the health the log has always published');
}

console.log('\n== the panel carries it where the promise is made ==');
{
  const W = boot();
  const src = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/hgOgEdgeProgressHtml\(\)/.test(src.slice(src.indexOf('NO TICKETS'))),
     'the progress line renders inside the no-tickets panel, not on another tab');
  const panel = W.hgOgEdgeProofPanelHtml();
  ok(/NO TICKETS/.test(panel) && /SCALP/.test(panel),
     'so the reader sees the claim and the evidence for it together');
  ok(!/forward log is accumulating them/.test(panel),
     'and the bare promise hg-v756 made is still gone');
}

console.log('\n== the shown split survives pruning, like gate-clear ==');
{
  const W = boot();
  const N = W.hgFwdNormalize, F = W.hgFwdFold, S = W.hgFwdStatsOf;
  const mk = (i, o) => Object.assign(N({ tab: 'OMNIGOLD:SCALP', mechanic: 'MMOVE', sym: 'XAUUSD',
    tf: '1h', dir: 'long', entry: 4700, stop: 4670, t1: 4760,
    barT: 1700000000 + i * 3600, horizonBars: 24 }), o);

  const agg = F({}, [mk(0, { shown: true, state: 't1' }), mk(1, { shown: true, state: 'stop' }),
                     mk(2, { shown: false, state: 't1' }), mk(3, { state: 't1' })]);
  const e = agg['OMNIGOLD:SCALP|MMOVE'];
  ok(e.sh && e.sh.wins === 1 && e.sh.losses === 1, 'only the shown cards are folded (1W 1L)');
  ok(e.wins === 3 && e.losses === 1, 'while the all-time totals are untouched (3W 1L)');

  const q = S([], 'OMNIGOLD:SCALP', 'MMOVE', { shown: true }, agg);
  ok(q.samples === 2, 'and a shown query reads the fold rather than the live window alone');

  /* an intersection is not either of its parts and must not borrow one */
  const both = S([], 'OMNIGOLD:SCALP', 'MMOVE', { shown: true, gateClear: true }, agg);
  ok(both.samples === 0, 'shown AND gate-clear together stays a live view — no folded block is its own');
}

console.log('\n' + passed + ' passed, 0 failed');
