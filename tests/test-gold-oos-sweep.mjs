/* HARDGATE — THE SEARCH THAT CAME BACK EMPTY, RECORDED SO IT IS NOT RE-RUN.

   Packs 909-914 worked through the gold evidence and shipped what held up:
   measurements that were on disk and never applied, a cost gate that
   demoted where it should have rejected, citations that named the wrong
   file, a ranking nobody had checked. Pack 914 then took the obvious next
   idea — reject the demoted kinds too — and REFUTED it out of sample.

   This file asks whether anything else is left that can be found offline.
   It sweeps every dimension the two desks' own trade rows expose, fits a
   keep-rule on the first part of each book, and applies it to the held-out
   rest, at three splits.

   TWENTY PRE-REGISTERED RULES. Ten on GOLD SCALP (stop distance, stopAtr
   multiple, planned R:R, UTC hour, order type, direction, grade, confluence
   tally, bars held, killzone weight) and ten on OMNIGOLD (tier, horizon,
   direction, ticket flag, order type, checksPass, gateConf, confluence
   band, kind, UTC hour). A rule ships only if it improves the out-of-sample
   book at ALL THREE splits, leaves it positive, and clears t > 1.96.

   NOT ONE DOES.

   The one that comes closest on GOLD SCALP is `bars held`, which flips the
   OOS book positive at every split (+0.049, +0.052, +0.025) and never
   reaches significance. It is also the one rule in the sweep that CANNOT BE
   USED: how long a trade will be held is not known when the setup forms.
   That the only rule to improve everywhere is the one carrying look-ahead
   is what you would expect if the rest is noise, and it is the reason this
   file keeps it rather than quietly dropping it.

   AND IT SETTLES THE OMNIGOLD VENUE QUESTION. Re-priced at the XM round
   trip the desk's own order path uses, by the repo's own exact rule, the
   OMNIGOLD book is:

     at the baked PAXG 0.26% RT    n=8132  -1.241R  t=-41.29
     at the XM 0.020% RT           n=8132  -0.116R  t= -7.55

   Switching venue is an enormous improvement and NOT a fix. The book is
   still significantly negative at the cheapest venue the desk can trade,
   so the twelve net-positive kinds do not carry it. That is worth knowing
   before anyone flips a fail-closed default expecting one.

   WHAT THIS FILE IS FOR. Twenty tests at 95% expect one false positive by
   chance, so a search like this is only honest if the count is reported
   and the empty result is recorded. It re-runs the whole sweep rather than
   remembering the conclusion: if a re-bake makes something survive, this
   goes red and someone looks.

   Run: node tests/test-gold-oos-sweep.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const mean = v => v.reduce((a, b) => a + b, 0) / v.length;
const tstat = v => {
  if (v.length < 2) return NaN;
  const m = mean(v);
  const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1));
  return m / (sd / Math.sqrt(v.length));
};
const band = (x, edges) => {
  if (typeof x !== 'number' || !isFinite(x)) return null;
  for (const e of edges) if (x < e) return '<' + e;
  return '>=' + edges[edges.length - 1];
};
const SPLITS = [0.5, 0.6, 0.7];

/* Fit a keep-set on the in-sample part, apply it to the rest. */
function walk(book, keyOf, R, minFit, minKeep){
  const out = [];
  for (const share of SPLITS){
    const cut = Math.floor(book.length * share);
    const ins = book.slice(0, cut), oos = book.slice(cut);
    const g = new Map();
    for (const t of ins){
      const k = keyOf(t);
      if (k === null || k === undefined) continue;
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(R(t));
    }
    const good = new Set();
    for (const [k, v] of g) if (v.length >= minFit && mean(v) > 0) good.add(k);
    const keep = oos.filter(t => good.has(keyOf(t))).map(R);
    if (keep.length < minKeep){ out.push(null); continue; }
    const base = oos.map(R);
    out.push({ base: mean(base), cut: mean(keep), t: tstat(keep), keptShare: keep.length / base.length });
  }
  return out;
}
const survives = rows => rows.every(r => r && r.cut > r.base && r.cut > 0 && r.t > 1.96);

/* ---------------- GOLD SCALP ---------------- */
const riskPct = t => {
  const e = t.entry, s = t.stop;
  return (typeof e === 'number' && typeof s === 'number' && e > 0) ? Math.abs(e - s) / e * 100 : null;
};
const SCALP = J('scripts/backtest-goldscalp-results-floor.json').trades
  .filter(t => typeof t.netR === 'number' && !t.shadow && (riskPct(t) ?? 0) >= 0.16)
  .sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)));

const SCALP_RULES = {
  'stop distance %':  t => band(riskPct(t), [0.24, 0.32, 0.40, 0.55]),
  'stopAtr multiple': t => band(t.stopAtr, [1.6, 1.8, 2.2, 3.0]),
  'planned R:R':      t => band(t.rr, [1.5, 2.0, 2.5, 3.5]),
  'UTC hour block':   t => (typeof t.utcHour === 'number' ? 'h' + (Math.floor(t.utcHour / 4) * 4) : null),
  'order type':       t => t.orderType ?? null,
  'direction':        t => t.dir ?? null,
  'grade':            t => t.grade ?? null,
  'confluence tally': t => band(t.tally, [4, 6, 8, 10]),
  'bars held':        t => band(t.barsHeld, [4, 8, 16, 32]),
  'killzone weight':  t => band(t.killzoneWeight, [0.5, 1.0, 1.5])
};

/* ---------------- OMNIGOLD, re-priced at the desk's own venue -------- */
const RRT = J('scripts/omnigold-replay-evidence.json').costModel.rtCostPct;
const XM = 0.35 / 3500 * 100 + 0.010;
const OG = J('scripts/backtest-omnigold-results.json').trades
  .filter(t => typeof t.netR === 'number' && typeof t.rMultiple === 'number')
  .map(t => ({ ...t, xmR: t.rMultiple - (t.rMultiple - t.netR) * (XM / RRT) }))
  .sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)));

const OG_RULES = {
  'tier':            t => t.tier ?? null,
  'horizon':         t => t.horizon ?? null,
  'direction':       t => t.dir ?? null,
  'ticket flag':     t => String(t.ticket),
  'order type':      t => t.orderType ?? null,
  'checksPass':      t => String(t.checksPass),
  'gateConf':        t => String(t.gateConf),
  'confluence band': t => band(t.confluence, [45, 55, 62, 70]),
  'kind':            t => t.kind ?? null,
  'UTC hour block':  t => (String(t.tISO || '').length > 13 ? 'h' + (Math.floor(+String(t.tISO).slice(11, 13) / 4) * 4) : null)
};

console.log('== the two books this sweep runs on ==');
{
  ok(SCALP.length === 1522, `GOLD SCALP: ${SCALP.length} live trades past the shipped cost bar`);
  ok(OG.length === 8132, `OMNIGOLD: ${OG.length} filled trades`);
  ok(Math.abs(XM - 0.02) < 1e-9, `re-priced at the XM preset, ${XM.toFixed(3)}% round trip`);
}

console.log('\n== the OMNIGOLD venue question, answered ==');
{
  const paxg = OG.map(t => t.netR), xm = OG.map(t => t.xmR);
  ok(Math.abs(mean(paxg) + 1.241) < 0.002 && tstat(paxg) < -40,
     `at the baked PAXG ${RRT}% the book is ${mean(paxg).toFixed(3)}R (t=${tstat(paxg).toFixed(2)})`);
  ok(Math.abs(mean(xm) + 0.116) < 0.002,
     `at the XM round trip it is ${mean(xm).toFixed(3)}R — an enormous improvement`);
  ok(tstat(xm) < -1.96,
     `and STILL significantly negative at t=${tstat(xm).toFixed(2)} — switching venue is not a fix`);
  /* The twelve net-positive kinds do not carry the book, and that is the
     point: a per-kind count is not a book. */
  ok(mean(xm) < 0 && mean(xm) > mean(paxg),
     'so the venue default is worth deciding on its own merits, not as a route to a paying desk');
}

console.log('\n== twenty pre-registered rules, fitted in-sample, tested out ==');
{
  const results = [];
  for (const [name, fn] of Object.entries(SCALP_RULES))
    results.push({ desk: 'SCALP', name, rows: walk(SCALP, fn, t => t.netR, 25, 30) });
  for (const [name, fn] of Object.entries(OG_RULES))
    results.push({ desk: 'OMNIGOLD', name, rows: walk(OG, fn, t => t.xmR, 40, 100) });

  ok(results.length === 20, `${results.length} rules swept across the two desks`);
  const fitted = results.filter(r => r.rows.some(x => x));
  ok(fitted.length >= 12, `${fitted.length} of them could be fitted at all at one or more splits`);

  const shipped = results.filter(r => survives(r.rows));
  ok(shipped.length === 0,
     'NOT ONE survives all three splits positive and significant'
     + (shipped.length ? (' — ' + shipped.map(r => r.desk + ':' + r.name).join(', ')) : ''));

  /* The near-miss, kept deliberately. */
  const bars = results.find(r => r.desk === 'SCALP' && r.name === 'bars held');
  ok(bars.rows.every(r => r && r.cut > r.base && r.cut > 0),
     'the closest thing to a winner is SCALP `bars held` — positive and improved at every split');
  ok(bars.rows.every(r => r.t < 1.96),
     `and it never clears significance: t = ${bars.rows.map(r => r.t.toFixed(2)).join(', ')}`);
  ok(true, 'and it is unusable anyway — how long a trade runs is not known when the setup forms, so it carries look-ahead');

  /* Multiple comparisons, stated rather than left for the reader. */
  const expected = 0.05 * results.length;
  ok(expected >= 1,
     `${results.length} tests at 95% expect ~${expected.toFixed(1)} false positives by chance — which is why the empty result is the honest one`);
}

console.log('\n== and the desks were left alone ==');
{
  const gi = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  ok(!/utcHour|killzoneWeight/.test(gi.slice(gi.indexOf('function hgGoldSetupEdgeApply'), gi.indexOf('function hgGoldScalpCostGate'))),
     'no swept dimension was wired into the edge applier on the strength of this search');
  const og = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/var HG_OG_RT_COST_PCT = 0\.26;/.test(og),
     'and the OMNIGOLD venue default is untouched — the measurement informs that decision, it does not make it');
}

console.log(`\n${passed} passed, 0 failed`);
