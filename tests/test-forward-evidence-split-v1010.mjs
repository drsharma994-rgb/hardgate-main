/* HARDGATE — hg-v1010: THE EVIDENCE SPLIT — the read the stamps were written FOR.

   Run: node tests/test-forward-evidence-split-v1010.mjs

   hg-v1006 stamped row.conf, hg-v1007 row.regime, hg-v1008 row.sess/orb —
   and hg-v1008's last-inch fix is why any of them actually STORE. But a mark
   nothing selects is ornamental. This pack is the select: hgFwdEvidenceSplit
   buckets a tab's SETTLED rows (t1/stop — expired excluded, as in every
   sibling split) by each of the four evidence fields and reports hit rate
   and mean R per bucket, with the house's honesty rules:

     - rows without a mark are counted as NEITHER and named, never folded
       into a side (they predate the stamp, or the desk never stamps)
     - a side under ~20 settled prints its n with "descriptive, not a
       verdict" — the house's own per-side floor, not a new threshold
     - silent ('') on a tab whose records carry none of the marks — an
       absent split is not a clean one
     - the collecting state: marked OPEN rows with nothing settled yet say
       the stamps are live and the answers arrive as horizons close
     - reported, never gated: nothing on the panel withholds a setup

   The end-to-end scenario below records through the real hgFwdRecordScan and
   settles through the real hgFwdResolve, so the numbers asserted are the
   pipeline's own, never hand-built rows (except the one scenario that
   hand-injects a legacy row with an off-enum value, to prove the reader
   never buckets what it does not understand). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok —', m); }
                       else { failed++; console.error('  FAIL —', m); } };

function boot(){
  const store = {};
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8'), ctx, { filename: 'hg-forward.js' });
  return ctx;
}

const BASE = 1773000000 - (1773000000 % 900);   /* a fixed past 15m boundary */
const winBars  = b => [ { t: b + 900,  o: 2400, h: 2405, l: 2395, c: 2403, v: 100 },
                        { t: b + 1800, o: 2403, h: 2425, l: 2396, c: 2422, v: 100 } ];  /* t1, never the stop: +2R */
const loseBars = b => [ { t: b + 900,  o: 2400, h: 2402, l: 2385, c: 2388, v: 100 } ];  /* the stop, never t1: -1R */
const flatBars = (b, n) => { const r = []; for (let i = 1; i <= n; i++)
  r.push({ t: b + i * 900, o: 2400, h: 2403, l: 2397, c: 2400, v: 100 }); return r; };    /* neither level */

let seq = 0;
/* one record-and-settle stage per intended outcome, so a shared resolution
   tape can never blur two records: fire on a fresh 15m boundary, then hand
   the ledger bars that settle THAT firing the intended way. */
function rec(stamps, over){
  seq++;
  return Object.assign({ sym: 'XAUUSD', dir: 'long', entry: 2400, stop: 2390, t1: 2420,
                         signalT: (BASE + seq * 900 * 12) * 1000, mechanic: 'EVIDTEST' }, stamps || {}, over || {});
}
function barBase(){ return BASE + seq * 900 * 12; }   /* the barT of the record just written */

console.log('== end-to-end: record through hgFwdRecordScan, settle through hgFwdResolve ==');
{
  const W = boot();
  const fire = (tab, tf, stamps, hz) => { W.hgFwdRecordScan(tab, tf, [rec(stamps)], { horizonBars: hz || 8 }); return barBase(); };
  /* CONF field (the OPTI GOLD stamps): confirmed W, confirmed L, unconfirmed L,
     unconfirmed L, unverified W */
  W.hgFwdResolve('XAUUSD', '1h', winBars(fire('OPTI GOLD', '1h', { conf: 'confirmed' })));
  W.hgFwdResolve('XAUUSD', '1h', loseBars(fire('OPTI GOLD', '1h', { conf: 'confirmed' })));
  W.hgFwdResolve('XAUUSD', '1h', loseBars(fire('OPTI GOLD', '1h', { conf: 'unconfirmed' })));
  W.hgFwdResolve('XAUUSD', '1h', loseBars(fire('OPTI GOLD', '1h', { conf: 'unconfirmed' })));
  W.hgFwdResolve('XAUUSD', '1h', winBars(fire('OPTI GOLD', '1h', { conf: 'unverified' })));
  /* REGIME field: favored W, against L */
  W.hgFwdResolve('XAUUSD', '1h', winBars(fire('OPTI GOLD', '1h', { regime: 'favored' })));
  W.hgFwdResolve('XAUUSD', '1h', loseBars(fire('OPTI GOLD', '1h', { regime: 'against' })));
  /* SESS field (the GOLDSCALP stamps): participating W, thin L, thin L */
  W.hgFwdResolve('XAUUSD', '15m', winBars(fire('GOLDSCALP', '15m', { sess: 'participating' })));
  W.hgFwdResolve('XAUUSD', '15m', loseBars(fire('GOLDSCALP', '15m', { sess: 'thin' })));
  W.hgFwdResolve('XAUUSD', '15m', loseBars(fire('GOLDSCALP', '15m', { sess: 'thin' })));
  /* ORB field: with W, against L */
  W.hgFwdResolve('XAUUSD', '15m', winBars(fire('GOLDSCALP', '15m', { orb: 'with' })));
  W.hgFwdResolve('XAUUSD', '15m', loseBars(fire('GOLDSCALP', '15m', { orb: 'against' })));
  /* an UNMARKED settled row (the whole legacy ledger's shape) and an EXPIRED one */
  W.hgFwdResolve('XAUUSD', '15m', winBars(fire('GOLDSCALP', '15m', null)));
  W.hgFwdResolve('XAUUSD', '15m', flatBars(fire('GOLDSCALP', '15m', { sess: 'thin' }, 2), 4));
  /* and two stamped rows left OPEN forever — the collecting state beside real answers */
  fire('GOLDSCALP', '15m', { sess: 'participating' });
  fire('GOLDSCALP', '15m', { orb: 'with' });

  const sp = W.hgFwdEvidenceSplit(['OPTI GOLD', 'GOLDSCALP']);
  ok(sp && sp.settled === 13, 'thirteen rows settled as t1/stop (the expired one is excluded by construction)');
  ok(sp.openMarked === 2, 'the two never-resolved stamped rows count as the live collection');
  const F = sp.fields;
  ok(F.conf.stamped === 5 && F.conf.cells.confirmed.n === 2 && F.conf.cells.confirmed.wins === 1
      && Math.abs(F.conf.cells.confirmed.r - 0.5) < 1e-9 && Math.round(100 * F.conf.cells.confirmed.hit) === 50,
    'conf: confirmed 1W/1L at 2R -> +0.500R at 50% on n=2');
  ok(F.conf.cells.unconfirmed.n === 2 && F.conf.cells.unconfirmed.wins === 0
      && Math.abs(F.conf.cells.unconfirmed.r - -1) < 1e-9,
    'conf: unconfirmed 0W/2L -> -1.000R at 0%');
  ok(F.conf.cells.unverified.n === 1 && F.conf.cells.unverified.wins === 1,
    'conf: unverified 1W/0L');
  ok(F.regime.stamped === 2 && F.regime.cells.favored.n === 1 && F.regime.cells.against.n === 1,
    'regime: favored and against one each');
  ok(F.sess.stamped === 3 && F.sess.cells.participating.n === 1 && F.sess.cells.thin.n === 2
      && F.sess.cells.thin.wins === 0,
    'sess: participating 1W, thin 0W/2L — the dead-tape question now has a column');
  ok(F.orb.stamped === 2 && F.orb.cells.with.n === 1 && F.orb.cells.against.n === 1,
    'orb: with and against one each');
  ok(F.sess.unmarked === 13 - 3 && F.conf.unmarked === 13 - 5,
    'every settled row without the mark is counted as NEITHER, per field');
  /* the expired stamped row is in NO cell: expired is not a verdict */
  ok(F.sess.cells.thin.n === 2, 'the expired thin row never entered a bucket — expiry is not a loss');

  const html = W.hgFwdEvidenceSplitHtml(['OPTI GOLD', 'GOLDSCALP']);
  ok(/EVIDENCE SPLIT/.test(html), 'the panel renders');
  ok(/CONFIRMATION FLOOR/.test(html) && /do CONFIRMED breaks pay better than UNCONFIRMED ones/.test(html)
      && /SESSION FLOOR/.test(html) && /does DEAD TAPE underperform/.test(html)
      && /COMEX ORB/.test(html) && /HOUSE REGIME/.test(html),
    'all four questions are named with their packs');
  ok(/confirmed \+0\.500R at 50% on n=2/.test(html) && /unconfirmed -1\.000R at 0% on n=2/.test(html),
    'the conf line prints both sides with their n');
  ok(/counted as NEITHER/.test(html), 'the unmarked rows are named, not folded into a side');
  ok(/under ~20 settled on a side — descriptive, not a verdict/.test(html),
    'the small-n caveat prints — no percentage dressed as a verdict');
  ok(/Reads the live window/.test(html) && /Reported, not gated/.test(html),
    'the live-window scope and the never-a-gate rule are stated');
  ok(!/no settled row carries the mark yet/.test(html),
    'every field has at least one stamped row here, so the empty-field line never prints');
}

console.log('\n== the collecting state: stamps live, nothing settled yet ==');
{
  const W = boot();
  W.hgFwdRecordScan('GOLDSCALP', '15m', [rec({ sess: 'thin', orb: 'against' })], { horizonBars: 8 });
  const sp = W.hgFwdEvidenceSplit('GOLDSCALP');
  ok(sp && sp.rows === 1 && sp.settled === 0 && sp.openMarked === 1 && sp.fields.sess.stamped === 0,
    'one open marked row, nothing settled, no buckets');
  const html = W.hgFwdEvidenceSplitHtml('GOLDSCALP');
  ok(/the stamps are live/.test(html) && /none settled yet/.test(html),
    'the panel says the machinery is alive and the answers arrive as horizons close');
  ok(!/at 0% on n=0/.test(html) && !/NaN/.test(html), 'and prints no fabricated zero-rate');
}

console.log('\n== silence: no marks anywhere, or no rows at all ==');
{
  const W = boot();
  const fire = (tab, tf, stamps, hz) => { W.hgFwdRecordScan(tab, tf, [rec(stamps)], { horizonBars: hz || 8 }); return barBase(); };
  ok(W.hgFwdEvidenceSplitHtml('GOLDSCALP') === '', 'an empty ledger renders nothing');
  W.hgFwdResolve('XAUUSD', '15m', winBars(fire('GOLDSCALP', '15m', null)));
  const sp = W.hgFwdEvidenceSplit('GOLDSCALP');
  ok(sp && sp.settled === 1 && sp.fields.sess.unmarked === 1 && sp.openMarked === 0,
    'a settled unmarked row is counted (as NEITHER) by the reader…');
  ok(W.hgFwdEvidenceSplitHtml('GOLDSCALP') === '',
    '…but the panel stays SILENT — an absent split is not a clean one (the siblings\' own rule)');
  ok(W.hgFwdEvidenceSplitHtml('NEVER-HEARD-OF-TAB') === '', 'an unknown tab renders nothing');
}

console.log('\n== the reader never buckets what it does not understand ==');
{
  const W = boot();
  /* a legacy / foreign row hand-injected straight into the store, with an
     off-enum sess — the split must count it NEITHER, never bucket it */
  const rows = [ { tab: 'GOLDSCALP', mechanic: 'LEGACY', sym: 'XAUUSD', tf: '15m', dir: 'long',
                   entry: 2400, stop: 2390, t1: 2420, risk: 10, rr: 2, barT: BASE,
                   horizonBars: 20, sess: 'bogus', state: 't1', r: 2, settledT: BASE + 900, at: BASE },
                 { tab: 'GOLDSCALP', mechanic: 'LEGACY', sym: 'XAUUSD', tf: '15m', dir: 'long',
                   entry: 2400, stop: 2390, t1: 2420, risk: 10, rr: 2, barT: BASE + 7200,
                   horizonBars: 20, sess: 'thin', state: 'stop', r: -1, settledT: BASE + 8100, at: BASE + 7200 } ];
  W.localStorage.setItem('hg_forward_v1', JSON.stringify(rows));
  const sp = W.hgFwdEvidenceSplit('GOLDSCALP');
  ok(sp && sp.settled === 2 && sp.fields.sess.stamped === 1 && sp.fields.sess.unmarked === 1
      && sp.fields.sess.cells.thin.n === 1 && !sp.fields.sess.cells.bogus,
    "'bogus' never becomes a bucket — the enum the normaliser keeps is the enum the reader reads");
  ok(/thin -1\.000R at 0% on n=1/.test(W.hgFwdEvidenceSplitHtml('GOLDSCALP')),
    'and the one honest row still prints');
}

console.log('\n== scope: one tab, an array of pools, or the whole book ==');
{
  const W = boot();
  const fire = (tab, tf, stamps, hz) => { W.hgFwdRecordScan(tab, tf, [rec(stamps)], { horizonBars: hz || 8 }); return barBase(); };
  W.hgFwdResolve('XAUUSD', '1h', winBars(fire('OPTI GOLD', '1h', { conf: 'confirmed' })));
  W.hgFwdResolve('XAUUSD', '15m', loseBars(fire('GOLDSCALP', '15m', { sess: 'thin' })));
  const og = W.hgFwdEvidenceSplit('OPTI GOLD');
  const gs = W.hgFwdEvidenceSplit(['GOLDSCALP']);
  const all = W.hgFwdEvidenceSplit(null);
  ok(og.settled === 1 && og.fields.conf.stamped === 1 && og.fields.sess.stamped === 0,
    'a single tab id reads only its own rows');
  ok(gs.settled === 1 && gs.fields.sess.stamped === 1 && gs.fields.conf.stamped === 0,
    'an array of pool names reads only those pools (the gold desks\' own resolution)');
  ok(all.settled === 2 && all.fields.conf.stamped === 1 && all.fields.sess.stamped === 1,
    'null reads the whole book — the house-wide question stays askable');
}

console.log('\n== wiring pins — the shipped source, not a copy ==');
{
  const fwd = fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8');
  ok(/W\.hgFwdEvidenceSplit = function/.test(fwd) && /W\.hgFwdEvidenceSplitHtml = function/.test(fwd),
    'both seams export from the ledger module itself');
  ok(/try \{ h \+= W\.hgFwdEvidenceSplitHtml\(tab\) \|\| ''; \} catch \(eEv\)\{\}\s+\/\* hg-v1010 \*\//.test(fwd)
      && fwd.indexOf('hgFwdTrendMatrixSplitHtml(tab)') < fwd.indexOf('hgFwdEvidenceSplitHtml(tab)'),
    'the split rides the panel chain beside its nine siblings, after Trend Matrix');
  const gfr = fs.readFileSync(path.join(ROOT, 'gold-forward-read.js'), 'utf8');
  ok(/hgFwdEvidenceSplitHtml\(evPools\)/.test(gfr) && /evPools && evPools\.length/.test(gfr),
    'the gold banner resolves the desk\'s own pools first — never a house-wide split wearing one desk\'s name');
  ok(/EVIDENCE MIN = 20/.test(fwd.replace(/_/g, ' ')) || /HG_EVIDENCE_MIN = 20/.test(fwd),
    'the per-side floor is the house\'s own 20 — borrowed, not invented');
}

console.log('\ntest-forward-evidence-split-v1010: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
