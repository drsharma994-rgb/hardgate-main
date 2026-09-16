/* HARDGATE — the gate that became the only thing able to clear itself.

   hg-v756 made measured-edge hard, which was the intent. What it did not
   trace was the promotion path: measured-edge turns a mechanic PASS only on
   FWD_MIN_JUDGE settled TICKETS, and the recorder stamps
   `ticket: !!(c.grade && c.grade.ticket)`. With the gate hard, that is false
   on every card the desk produces, so ticketOnly can never reach the
   threshold and the promotion branch is unreachable. The desk could never
   trade again on any amount of evidence.

   `ticket` stopped being the right population at that moment. `gateClear` —
   every gate passed except measured-edge itself — is the one that replaced
   it, and it keeps accumulating.

   It is NOT the circularity `ticket` was guarding against. Judging on ALL
   firings condemns a mechanic using setups the ledger refused for reasons
   of its own, which is what emptied both tabs. This population is still
   only setups the ledger cleared; it just does not require the gate under
   test to have already passed before its own evidence counts.

   Run: node tests/test-omnigold-gate-clear.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

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
const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

console.log('== the lockout was real, and is asserted here so it cannot return ==');
{
  /* the promotion branch requires FWD_MIN_JUDGE of SOME cleared population.
     If tickets were the only one, a hard gate makes it unreachable. */
  ok(/var tix = fwd\.ticketOnly;/.test(SRC), 'the ticket population is still read');
  ok(/var clr = fwd\.gateClear;/.test(SRC), 'and a second, still-growing population beside it');
  ok(/judgeLabel/.test(SRC), 'the card says which of the two it judged on');
  /* tickets still win when there are enough — old records decide as before */
  ok(/if \(isFinite\(tN\) && tN >= FWD_MIN_JUDGE\)\{[\s\S]{0,120}judgeLabel = 'settled TICKETS'/.test(SRC),
     'tickets are preferred when there are enough, so pre-v757 records are unaffected');
}

console.log('\n== gateClear says what the card said ==');
{
  const G = ctx.hgOgGateClear;
  ok(typeof G === 'function', 'hgOgGateClear is exported');

  ok(G({ ticket: true, vetoes: [], unknown: [] }) === true, 'a ticket cleared everything by definition');
  ok(G({ ticket: false, vetoes: [], unknown: ['measured-edge'] }) === true,
     'a setup blocked ONLY by the edge gate is gate-clear — the population that replaced tickets');
  ok(G({ ticket: false, vetoes: ['measured-edge'], unknown: [] }) === true,
     'whether the edge gate vetoed it or merely could not judge it');

  ok(G({ ticket: false, vetoes: ['trend'], unknown: [] }) === false,
     'a setup the ledger rejected for its OWN reasons is NOT gate-clear');
  ok(G({ ticket: false, vetoes: [], unknown: ['vol-alive'] }) === false,
     'nor one missing other data');
  ok(G({ ticket: false, vetoes: ['trend'], unknown: ['measured-edge'] }) === false,
     'nor one where the edge gate is only part of the problem');

  /* "we could not tell" must never be recorded as "it failed" */
  ok(G(null) === undefined, 'no grade yields undefined, not false');
  ok(G({ ticket: false }) === undefined, 'and a malformed grade does too');
}

console.log('\n== the log records it, and refuses to infer it ==');
{
  const N = ctx.hgFwdNormalize;
  const rec = o => Object.assign({ tab: 'OMNIGOLD:SCALP', mechanic: 'MMOVE', sym: 'XAUUSD',
    tf: '1h', dir: 'long', entry: 4700, stop: 4670, t1: 4760, barT: 1700000000,
    horizonBars: 24 }, o);

  ok(N(rec({ gateClear: true })).gateClear === true, 'gateClear:true is kept');
  ok(N(rec({ gateClear: false })).gateClear === false, 'gateClear:false is kept');
  /* a record from a tab that has never heard of this must not read as false */
  ok(N(rec({})).gateClear === undefined, 'a caller that says nothing records undefined');
  /* except a ticket, which cleared everything by definition */
  ok(N(rec({ ticket: true })).gateClear === true,
     'a legacy TICKET record is gate-clear without having to be told');
  ok(N(rec({ ticket: false })).gateClear === undefined,
     'but a legacy non-ticket is unknown, not false — it may have been blocked by anything');
}

console.log('\n== stats can ask for the population that still grows ==');
{
  const S = ctx.hgFwdStatsOf;
  const H = 3600;
  const mk = (i, o) => Object.assign(ctx.hgFwdNormalize({
    tab: 'OMNIGOLD:SCALP', mechanic: 'MMOVE', sym: 'XAUUSD', tf: '1h', dir: 'long',
    entry: 4700, stop: 4670, t1: 4760, barT: 1700000000 + i * H, horizonBars: 24
  }), o);

  const list = [
    mk(0, { gateClear: true, state: 't1' }),
    mk(1, { gateClear: true, state: 'stop' }),
    mk(2, { gateClear: false, state: 't1' }),
    mk(3, { state: 't1' })                       /* legacy: unknown */
  ];

  const all = S(list, 'OMNIGOLD:SCALP', 'MMOVE', false, null);
  ok(all.wins + all.losses === 4, 'unfiltered counts every settled record');

  const gc = S(list, 'OMNIGOLD:SCALP', 'MMOVE', { gateClear: true }, null);
  ok(gc.wins === 1 && gc.losses === 1, 'gate-clear counts only the two that cleared');
  ok(gc.wins + gc.losses === 2, 'and a record with no gateClear field is excluded, not assumed');

  /* the boolean form must keep meaning exactly what it meant */
  const tk = S(list, 'OMNIGOLD:SCALP', 'MMOVE', true, null);
  ok(tk.wins + tk.losses === 0, 'the boolean form still means ticket-only, unchanged');
}

console.log('\n== the desk asks for it, and the panel stops lying about it ==');
{
  /* `tabs`, not `tab`: hg-v758 pools the three gold tabs that run these
     same mechanics, which the settled-evidence panel had always done. */
  ok(/hgFwdStats\(tabs, mechanic, \{ gateClear: true \}\)/.test(SRC),
     'hgOgFwdFor fetches the gate-clear record across the pooled tabs');
  ok(/all\.gateClear = /.test(SRC), 'and hands it to the gate beside ticketOnly');
  ok(/gateClear: hgOgGateClear\(c\.grade\)/.test(SRC), 'the recorder stamps it from the grade');

  /* hg-v756's panel promised the forward log was accumulating tickets. It
     was accumulating firings, which could never promote anything. */
  const html = ctx.hgOgEdgeProofPanelHtml();
  ok(html, 'the panel still renders');
  ok(!/forward log is accumulating them/.test(html),
     'and no longer claims the log is accumulating the thing it cannot accumulate');
  ok(/whether or not they ticket/.test(html),
     'it says what is actually being collected');
  ok(/only thing able to clear itself/.test(html),
     'and names the deadlock it exists on the other side of');
}

console.log('\n' + passed + ' passed, 0 failed');
