/* HARDGATE — a claim about a mechanic is measured on that mechanic.

   Three populations can answer for one row on the OMNIGOLD tab:

     the mechanic's own pooled TICKET record
     the desk-wide scalp pool     (every mechanic, one direction)
     the scorecard's gold log     (every gold trade, one direction)

   The last two are not about this mechanic at all. The rule was "whichever
   has the highest Wilson lower bound wins", which is picking the most
   flattering population and then testing it against a fixed 95% bar. It
   broke in both directions, and both are driven below.

   PROMOTION. A mechanic whose own record is 5/20 — Wilson lower 0.11, a
   demonstrably bad mechanic — read 95% SETTLED EXECUTE true and 90% SCALP
   VERDICT true off a 294/300 scorecard record. The panel headed "PROVEN
   EDGE · FORWARD-TESTED" showed a setup whose own forward evidence said the
   opposite.

   DEMOTION. A mechanic with a real edge — 20/30 at avgRr 2.0, lower bound
   0.488 against a 0.333 breakeven, clearing by 15.4 points — read PROVEN
   EDGE false once a 32/40 scorecard record outscored it on RAW HIT RATE.
   The scorecard carries no avgRr, so the swap took the reward multiple with
   it and hgOgProvenEdgeOk had no breakeven left to test.

   That second one is the error hgOgEdgeMargin exists to prevent, pointed at
   the evidence instead of at the ranking. The file says it plainly: "a
   mechanic with a smaller hit rate but a bigger payoff can carry more edge
   than a higher-hit one". Raw hit rate is not comparable across payoffs, and
   choosing BETWEEN populations on it is exactly that comparison.

   Run: node tests/test-omnigold-evidence-scope.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

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
                localStorage: { getItem: k => (k in store ? store[k] : null),
                                setItem: (k, v) => { store[k] = String(v); },
                                removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'scorecard.js', 'formation.js', 'plans.js', 'hg-gates.js',
                   'hg-plan.js', 'omniroute.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  return ctx;
}

const T = 1700000000;
const FWD = 'hg_forward_v1', SCORE = 'hg_score_v1';
/* settled TICKETs for one mechanic at a stated reward multiple */
const recs = (tab, mech, n, wins, rr) => {
  const out = [];
  for (let i = 0; i < n; i++){
    const w = i < wins;
    out.push({ tab, mechanic: mech, sym: 'XAUUSD', tf: '1h', dir: 'long',
               entry: 4000, stop: 3980, t1: 4000 + 20 * rr, risk: 20, rr,
               /* 48h apart: horizonBars 20 on a 1h tf is a 20-hour hold, so
                  closer firings overlap and pack 836 deflates them for it.
                  This file is about which POPULATION answers for a row, so
                  its fixtures are genuinely independent trades. */
               barT: T + i * 172800, horizonBars: 20,
               state: w ? 't1' : 'stop', r: w ? rr : -1, settledT: T + i * 172800 + 3600,
               ticket: true, gateClear: true, shown: true });
  }
  return out;
};
/* the scorecard's own gold log — note it carries NO reward multiple */
const score = (n, wins) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ status: 'settled', r: i < wins ? 0.4 : -1, sym: 'XAUUSD', dir: 'long' });
  return out;
};
const ROW = { horizon: 'SWING', kind: 'ROUND-MAGNET', dir: 'long' };

console.log('== the fixtures reach the real stores ==');
{
  /* Establish this first: with the wrong key every assertion below would
     pass against empty evidence. */
  const W = boot({ [FWD]: JSON.stringify(recs('OMNIGOLD:SWING', 'ROUND-MAGNET', 30, 20, 2)) });
  ok(typeof W.hgWilson === 'function',
     'hgWilson is loaded — without it every interval is null and nothing here means anything');
  const ev = W.hgOgSettledEvidence(ROW);
  ok(ev && ev.samples === 30 && ev.wins === 20, 'the forward fixture is read back as 20/30');
  ok(ev.avgRr === 2, 'carrying the reward multiple its winners actually paid');
  const S = boot({ [SCORE]: JSON.stringify(score(40, 32)) });
  const sev = S.hgOgSettledEvidence(ROW);
  ok(sev && sev.samples === 40, 'the scorecard fixture is read back as 40 settled');
  ok(sev.avgRr === undefined,
     'and carries NO reward multiple — which is the whole reason substituting it destroys a breakeven');
}

console.log('\n== DEMOTION: a real edge is no longer erased by a stranger ==');
{
  const own = recs('OMNIGOLD:SWING', 'ROUND-MAGNET', 30, 20, 2);
  const A = boot({ [FWD]: JSON.stringify(own) });
  const B = boot({ [FWD]: JSON.stringify(own), [SCORE]: JSON.stringify(score(40, 32)) });

  const a = A.hgOgSettledEvidence(ROW);
  ok(A.hgOgProvenEdgeOk(a, 25, 0.02) === true,
     `the mechanic's own record proves an edge: lo ${a.wilson.lo.toFixed(4)} against a `
     + `${A.hgOgBreakevenHit(a.avgRr).toFixed(4)} breakeven`);
  /* the margin is measured off the FAMILY-CORRECTED bound from pack 835 on,
     which is the bar that decides — 4.9 points, not the 15.4 the displayed
     95% bound would have flattered it with */
  ok(Math.abs(A.hgOgEdgeMargin(a) - 0.0487) < 0.001,
     `clearing it by ${(A.hgOgEdgeMargin(a) * 100).toFixed(1)} points at the corrected bar`);
  ok(Math.abs((a.wilson.lo - A.hgOgBreakevenHit(a.avgRr)) - 0.1544) < 0.001,
     'while the displayed 95% bound sits 15.4 points clear, which is why the two are kept apart');

  /* THE OLD RULE, reimplemented, so the harm is demonstrated not asserted */
  const scOnly = boot({ [SCORE]: JSON.stringify(score(40, 32)) }).hgOgSettledEvidence(ROW);
  ok(scOnly.wilson.lo > a.wilson.lo,
     `the scorecard's raw hit rate does outscore it (${scOnly.wilson.lo.toFixed(4)} vs `
     + `${a.wilson.lo.toFixed(4)}) — which is why the old max-of-k rule swapped them`);
  ok(B.hgOgProvenEdgeOk(scOnly, 25, 0.02) === false && !isFinite(B.hgOgEdgeMargin(scOnly)),
     'and the swapped-in record proves nothing at all, because it has no payoff to break even against');

  const b = B.hgOgSettledEvidence(ROW);
  ok(b.source === a.source && b.samples === 30,
     `the shipped build keeps the mechanic's own record (${b.source})`);
  ok(b.avgRr === 2 && B.hgOgProvenEdgeOk(b, 25, 0.02) === true,
     'so the edge survives the scorecard being present');
  ok(b.specific === true, 'and it is marked as the mechanic\'s own population');
}

console.log('\n== PROMOTION: a bad mechanic is no longer carried by a stranger ==');
{
  const weak = recs('OMNIGOLD:SWING', 'ROUND-MAGNET', 20, 5, 2);
  const A = boot({ [FWD]: JSON.stringify(weak) });
  const B = boot({ [FWD]: JSON.stringify(weak), [SCORE]: JSON.stringify(score(300, 294)) });

  const a = A.hgOgSettledEvidence(ROW);
  ok(a.wilson.lo < 0.2, `its own record is 5/20 — lower bound ${a.wilson.lo.toFixed(4)}`);
  ok(A.hgOgSettledExecuteOk(a, 0.95, 15) === false && A.hgOgSettledExecuteOk(a, 0.90, 10) === false,
     'which clears nothing, correctly');

  const strangerOnly = boot({ [SCORE]: JSON.stringify(score(300, 294)) }).hgOgSettledEvidence(ROW);
  ok(strangerOnly.wilson.lo > 0.95,
     `the scorecard's record clears the 95% bar on its own (${strangerOnly.wilson.lo.toFixed(4)})`);

  const b = B.hgOgSettledEvidence(ROW);
  ok(b.samples === 20 && b.wilson.lo < 0.2,
     'the shipped build still reads the mechanic on its own 5/20 record');
  ok(B.hgOgSettledExecuteOk(b, 0.95, 15) === false,
     'so it does not appear in the 95% SETTLED EXECUTE tier');
  ok(B.hgOgSettledExecuteOk(b, 0.90, 10) === false, 'nor clear the 90% SCALP VERDICT bar');
}

console.log('\n== a thin mechanic still borrows, and the card says so ==');
{
  /* The fallback is not removed — a mechanic below the minimum genuinely
     cannot speak, and showing the wider log is more use than showing
     nothing. What changes is that it is chosen by a rule fixed in advance,
     marked, and barred from promoting. */
  const thin = recs('OMNIGOLD:SWING', 'ROUND-MAGNET', 3, 2, 2);
  const A = boot({ [FWD]: JSON.stringify(thin) });
  const a = A.hgOgSettledEvidence(ROW);
  ok(a.samples === 3 && a.specific === true,
     'a THIN own record is still the mechanic\'s own — three trades is a small record, not someone else\'s');
  ok(A.hgOgEvidenceScopeTxt(a) === '', 'so the card adds no disclaimer to it');

  const B = boot({ [FWD]: JSON.stringify(thin), [SCORE]: JSON.stringify(score(60, 48)) });
  const b = B.hgOgSettledEvidence(ROW);
  ok(b.source === 'scorecard-gold' && b.samples === 60,
     'below the minimum, the wider gold log is shown in its place');
  ok(b.specific === false, 'marked as NOT this mechanic\'s population');
  const scope = B.hgOgEvidenceScopeTxt(b);
  ok(/NOT this mechanic/.test(scope) && /ROUND-MAGNET/.test(scope) && /10-trade minimum/.test(scope),
     `and the card says so in words: "${scope.trim()}"`);
  ok(B.hgOgSettledExecuteOk(b, 0.90, 10) === false && B.hgOgProvenEdgeOk(b, 10, 0.02) === false,
     'a borrowed record informs the reader and promotes nothing');

  /* and with nothing of its own at all */
  const C = boot({ [SCORE]: JSON.stringify(score(300, 294)) });
  const c = C.hgOgSettledEvidence(ROW);
  ok(c && c.specific === false && C.hgOgSettledExecuteOk(c, 0.95, 15) === false,
     'a mechanic with NO record of its own cannot be promoted by the desk\'s aggregate either');
  ok(/NOT this mechanic/.test(C.hgOgEvidenceScopeTxt(c)), 'and is labelled the same way');
}

console.log('\n== the disclosure reaches the rendered panel ==');
{
  const W = boot({ [FWD]: JSON.stringify(recs('OMNIGOLD:SWING', 'ROUND-MAGNET', 3, 2, 2)),
                   [SCORE]: JSON.stringify(score(60, 48)) });
  const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
                              .replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
  const cand = { horizon: 'SWING', kind: 'ROUND-MAGNET', dir: 'long',
                 plan: { entry: 4000, stop: 3980, t1: 4040, t2: 4080 } };
  cand.settledEv = W.hgOgSettledEvidence(cand);
  ok(cand.settledEv && cand.settledEv.specific === false, 'the fixture row carries borrowed evidence');
  const html = strip(W.hgOgSettledExecutePanelHtml({ proven: [], best: [cand] }));
  ok(/scorecard-gold/.test(html), 'the panel names the source');
  ok(/NOT this mechanic/.test(html),
     'and states the scope in the sentence a reader actually reads, not only in a source string');
  ok(!/NaN|undefined/.test(html), 'without printing NaN or undefined');

  /* a specific record renders no disclaimer */
  const W2 = boot({ [FWD]: JSON.stringify(recs('OMNIGOLD:SWING', 'ROUND-MAGNET', 40, 34, 2)) });
  const cand2 = { horizon: 'SWING', kind: 'ROUND-MAGNET', dir: 'long',
                  plan: { entry: 4000, stop: 3980, t1: 4040, t2: 4080 } };
  cand2.settledEv = W2.hgOgSettledEvidence(cand2);
  ok(cand2.settledEv.specific === true && W2.hgOgProvenEdgeOk(cand2.settledEv, 25, 0.02) === true,
     'a 34/40 own record still proves an edge');
  const html2 = strip(W2.hgOgSettledExecutePanelHtml({ proven: [cand2], best: [] }));
  ok(!/NOT this mechanic/.test(html2), 'and its panel carries no disclaimer');
  ok(/OMNIGOLD:SWING/.test(html2), 'naming its own record as the source');
}

console.log('\n' + passed + ' passed, 0 failed');
