/* HARDGATE — hg-v963: the gold news gate was DEFEATED, not missing.

   hgGoldNewsGate (goldind.js) has locked new gold minting 30 min before and
   15 min after CPI / NFP / FOMC / GDP since hg-v554, and it works. It is
   reached inside hgGoldInstFilter, which reads ctx.news and ctx.nowMs.

   GOLD ULTRA (2 sites) and GOLD DIRECTION (3 sites) call that gated mint and
   hand it a literal `news: null`. hgGoldNewsGate returns
   { lock:false, unchecked:true } on null — FAIL-OPEN BY CONSTRUCTION, every
   scan, forever. The snapshot they needed is a global (window.hgNewsState)
   that their sibling SUPER GOLD already reads, so nothing was unavailable.

   The instant matters too: both desks passed the WALL CLOCK (`now =
   Date.now()`), so a scan re-run after a release dated the lock wrong in both
   directions — the hg-v952 SUPER GOLD defect. Each lane now reads its OWN
   signal bar (15m scalp, 4h swing), because one shared instant would mislabel
   one of them (hg-v950).

   Run: node tests/test-gold-news-gate-wire.mjs */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(files, extra){
  const ctx = { window: {}, console, Math, Date, JSON, isFinite, parseFloat, parseInt,
                String, Number, Array, Object, RegExp, Error, isNaN };
  ctx.self = ctx; ctx.globalThis = ctx;
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx.window;
}
const W = boot(['goldind.js', 'gold-formation.js']);

const CPI = Date.UTC(2026, 9, 13, 12, 30);
const SNAP = { events: [{ title: 'US CPI m/m', t: CPI }] };

/* =====================================================================
   1. THE DEFECT, proved on the real gate: null is not "no news".
   ===================================================================== */
{
  const g = W.hgGoldNewsGate;
  eq(typeof g, 'function', 'hgGoldNewsGate is the shipped gate');

  const onNull = g(null, CPI);
  eq(onNull.lock, false, 'a null snapshot does NOT lock');
  eq(onNull.unchecked, true, 'it reads UNCHECKED — fail-open by construction');

  /* and the same instant with a real snapshot DOES lock, so the gate works
     and the literal was the whole defect */
  const real = g(SNAP, CPI - 10 * 60000);
  eq(real.lock, true, 'the same instant with a real snapshot locks');
  ok(/NEWS GATE|FOMC/.test(real.reason || ''), 'and names why');
  eq(g(SNAP, CPI + 3 * 3600000).lock, false, 'and releases well after the window');
}

/* =====================================================================
   2. The shared rule: one home, delegating, keyed on the signal bar.
   ===================================================================== */
{
  const v = W.hgGoldNewsVerdict;
  eq(typeof v, 'function', 'hgGoldNewsVerdict is exported');

  const inside = v(CPI - 10 * 60000, SNAP);
  ok(inside && inside.locked === true, 'it locks inside the window');
  ok(/signal bar/.test(inside.why || ''),
    'and says the verdict is dated by the signal bar, not the wall clock');
  ok(/handoff is withheld/.test(inside.why || ''),
    'and that only the handoff goes — the card and evidence stay');

  const outside = v(CPI + 3 * 3600000, SNAP);
  ok(outside && outside.locked === false, 'and does not lock outside it');

  /* FAILS OPEN at every seam — a gate the desk cannot read is not a reason
     to withhold a setup */
  eq(v(CPI, null), null, 'no snapshot yields NO verdict, never a cheerful open one');
  eq(v(null, SNAP), null, 'no instant yields no verdict');
  eq(v('', SNAP), null, 'an empty instant yields no verdict');
  eq(v('x', SNAP), null, 'an unreadable instant yields no verdict');
  eq(v(0, SNAP), null,
    'and EPOCH ZERO yields no verdict — 0 is a readable number and a failed '
    + 'read, and a gate must not answer on the second (hg-v953)');
  eq(v(-5, SNAP), null, 'nor a negative instant');

  /* AN UNCHECKED READING FROM A NON-NULL SNAPSHOT is the case the `news: null`
     defect actually produced, and it is distinct from no snapshot at all: the
     object exists, the gate cannot read events from it, and it says so via
     `unchecked`. Treating that as "not locked" is the same fail-open one layer
     in — and without this case a mutation doing exactly that survived. */
  eq(v(CPI - 10 * 60000, {}), null,
    'a snapshot the gate reads as UNCHECKED yields no verdict, not an open one');
  eq(v(CPI - 10 * 60000, { somethingElse: 1 }), null,
    'and neither does one carrying no events or fomc key');

  /* seconds and milliseconds both accepted, the hgGoldSignalBarMs convention */
  const sec = v((CPI - 10 * 60000) / 1000, SNAP);
  ok(sec && sec.locked === true, 'a seconds instant is accepted');

  /* it DELEGATES — with goldind absent there is no verdict rather than a
     second copy of a news calendar (hg-v949) */
  const bare = boot(['gold-formation.js']);
  eq(typeof bare.hgGoldNewsVerdict, 'function', 'the shared rule still loads alone');
  eq(bare.hgGoldNewsVerdict(CPI - 10 * 60000, SNAP), null,
    'and with goldind absent it yields NO verdict — it never re-decides what a '
    + 'tier-1 event is');
}

/* =====================================================================
   3. NOT ONE `news: null` SURVIVES in code on either desk.
      Comments legitimately name the literal (they explain the defect), so
      the check strips them — the hg-v959 both-directions rule.
   ===================================================================== */
{
  for (const f of ['goldultra.js', 'golddirection.js']){
    const src = read(f);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    ok(!/news:\s*null/.test(code),
      f + ' passes the gated mint no literal null snapshot in CODE');
    ok(/news:\s*null/.test(src),
      f + ' still NAMES the literal in a comment, so the defect is recorded');
    ok(/hgGoldNewsSnapshot/.test(code), f + ' reads the live snapshot instead');
    ok(/hgGoldSignalBarMs/.test(code), f + ' and dates it by the signal bar');
  }
}

/* =====================================================================
   4. GOLD DIRECTION keys each lane on its OWN series.
      One shared instant would mislabel one of them, and the two lanes read
      different timeframes (15m scalp, 4h swing) — hg-v950's per-shape rule.
   ===================================================================== */
{
  const src = read('golddirection.js');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/gdNewsCtx\(gold && gold\.rows15m/.test(code), 'the scalp lane reads 15m');
  ok(/gdNewsCtx\(gold && gold\.rows4h/.test(code), 'the swing lane reads 4h');
  ok(!/gdNewsCtx\(gold && gold\.rows15m[\s\S]{0,400}gdNewsCtx\(gold && gold\.rows15m/.test(code),
    'and the swing lane does not reuse the scalp series');

  /* the helper is ONE definition serving both lanes, not two copies */
  const defs = (code.match(/function gdNewsCtx\(/g) || []).length;
  eq(defs, 1, 'gdNewsCtx is defined exactly once');

  /* AND IT IS EXECUTED, not grepped. Deleting the snapshot assignment and the
     signal-bar read both survived a source check, because the gfn() lookup
     lines above them keep the names present — the same grep-satisfiable shape
     as the GOLD ULTRA section above. */
  const from = src.indexOf('function gdNewsCtx(');
  ok(from > 0, 'gdNewsCtx is locatable');
  const to = src.indexOf('\n}', from);
  ok(to > from, 'and terminated');
  const helper = src.slice(from, to + 2);

  function runHelper(opts){
    const sandbox = { isFinite, gfn: (name) => {
      if (opts.absent && opts.absent.indexOf(name) >= 0) return null;
      if (name === 'hgGoldNewsSnapshot') return () => opts.snap;
      if (name === 'hgGoldSignalBarMs') return (rows) => (rows && rows.length)
        ? rows[rows.length - 1].t : NaN;
      return null;
    } };
    vm.createContext(sandbox);
    vm.runInContext(helper + '\n;__out = gdNewsCtx(' + JSON.stringify(opts.rows)
      + ', ' + opts.now + ');', sandbox);
    return sandbox.__out;
  }

  const WALL2 = 1700000000000, BAR2 = 1600000000000;
  const h = runHelper({ rows: [{ t: BAR2 }], now: WALL2, snap: SNAP });
  eq(h.snap, SNAP, 'the helper really READS the live snapshot');
  eq(h.at, BAR2, 'and dates it by the series signal bar, not the wall clock');
  eq(runHelper({ rows: [], now: WALL2, snap: SNAP }).at, WALL2,
    'an unreadable series falls back to the wall clock');
  eq(runHelper({ rows: [{ t: BAR2 }], now: WALL2, snap: SNAP,
                 absent: ['hgGoldNewsSnapshot'] }).snap, null,
    'gold-formation absent leaves the snapshot null — the gate then fails open');

  /* and the two lanes really get DIFFERENT instants from their own series,
     which is the whole reason the helper takes rows rather than reading one */
  const scalpBar = 1610000000000, swingBar = 1620000000000;
  eq(runHelper({ rows: [{ t: scalpBar }], now: WALL2, snap: SNAP }).at, scalpBar,
    'the 15m series gives the scalp instant');
  eq(runHelper({ rows: [{ t: swingBar }], now: WALL2, snap: SNAP }).at, swingBar,
    'and the 4h series a different one — one shared instant would mislabel a lane');
}

/* =====================================================================
   5. GOLD ULTRA reads the snapshot ONCE for both of its sites.
   ===================================================================== */
{
  const code = read('goldultra.js').replace(/\/\*[\s\S]*?\*\//g, '');
  eq((code.match(/news:\s*newsSnap/g) || []).length, 2,
    'both call sites use the one snapshot, so they cannot drift apart');
  eq((code.match(/now:\s*newsAt/g) || []).length, 2, 'and both are dated by the same instant');

  /* LIFTED AND EXECUTED, not grepped. A count of the name `hgGoldNewsSnapshot`
     is satisfied by the gfn() lookup line alone, so deleting the assignment
     below it survived — as did reverting the instant to the wall clock and
     dropping the signal-bar read. Three grep-satisfiable assertions in one
     section; the block is run under stubs instead (the hg-v951 technique). */
  const src = read('goldultra.js');
  const from = src.indexOf('var newsSnap = null, newsAt = now;');
  ok(from > 0, 'the news block is locatable in goldultra.js');
  const to = src.indexOf('catch(eN){ newsSnap = null; }', from);
  ok(to > from, 'and terminated');
  const lifted = src.slice(from, to + 'catch(eN){ newsSnap = null; }'.length);

  function runLifted(opts){
    const calls = [];
    const sandbox = {
      now: opts.now,
      gold: { rows15m: opts.rows },
      isFinite,
      gfn: (name) => {
        calls.push(name);
        if (opts.absent && opts.absent.indexOf(name) >= 0) return null;
        if (name === 'hgGoldNewsSnapshot') return () => opts.snap;
        if (name === 'hgGoldSignalBarMs') return (rows) => (rows && rows.length)
          ? rows[rows.length - 1].t : NaN;
        return null;
      }
    };
    vm.createContext(sandbox);
    vm.runInContext(lifted + '\n;__out = { snap: newsSnap, at: newsAt };', sandbox);
    return { out: sandbox.__out, calls };
  }

  const WALL = 1700000000000, BAR = 1600000000000;
  const got = runLifted({ now: WALL, rows: [{ t: BAR }], snap: SNAP });
  eq(got.out.snap, SNAP, 'the lane really READS the live snapshot');
  eq(got.out.at, BAR,
    'and dates it by the SIGNAL BAR, not the wall clock (' + got.out.at + ')');
  ok(got.out.at !== WALL, 'the two instants are genuinely different in this fixture');

  /* fails open, and falls back to the wall clock only when the bar is unreadable */
  const noBar = runLifted({ now: WALL, rows: [], snap: SNAP });
  eq(noBar.out.at, WALL, 'an unreadable series falls back to the wall clock');
  eq(noBar.out.snap, SNAP, 'and still reads the snapshot');
  const noSnapFn = runLifted({ now: WALL, rows: [{ t: BAR }], snap: SNAP,
                               absent: ['hgGoldNewsSnapshot'] });
  eq(noSnapFn.out.snap, null,
    'gold-formation absent leaves the snapshot null — the gate then fails open, '
    + 'which is exactly the behaviour when there is genuinely no news');
  eq(noSnapFn.out.at, BAR, 'and the instant is still the signal bar');
}

/* =====================================================================
   6. The coverage reporter is DERIVED from the census and VERIFIES.
   ===================================================================== */
{
  const c = W.hgGoldNewsCoverage();
  ok(c, 'hgGoldNewsCoverage reports');
  eq(c.shared, 'VERIFIED',
    'the shared route is proved behaviourally — it tells an in-window instant '
    + 'from an out-of-window one');

  /* The buckets partition the census, checked against the SOURCE count the
     reporter itself saw — not against a number typed here, which is the
     stale-list defect this pack is about, one layer along. */
  const total = c.verified.length + c.uncovered.length + c.notLoaded.length;
  eq(total, c.censusSize,
    'every minting gold desk in the census is bucketed exactly once ('
    + total + ' of ' + c.censusSize + ')');
  ok(c.censusSize > 10, 'and the census really is the full gold desk list (' + c.censusSize + ')');
  const tabs = [...c.verified, ...c.uncovered, ...c.notLoaded].map(r => r.tab);
  eq(new Set(tabs).size, tabs.length, 'and no desk lands in two buckets');

  /* the two desks this pack fixed are routed */
  const routed = new Set([...c.verified, ...c.notLoaded].map(r => r.tab));
  ok(routed.has('goldultra'), 'GOLD ULTRA is routed');
  ok(routed.has('golddirection'), 'GOLD DIRECTION is routed');

  /* and the gaps NAME THEMSELVES rather than living in prose */
  /* hg-v965: this asserted `c.uncovered.length > 0` -- "gaps name themselves"
     tested by requiring a gap to EXIST in the shipped tree. hg-v965 routed the
     last four desks and the bucket went legitimately empty, turning this red
     with nothing wrong. That is the SAME stale-expectation defect the comment
     below already records one line along, and the fix is the same one hg-v950
     used: a bucket nothing can land in proves nothing, so MAKE a gap and
     require the reporter to name it, rather than depending on one being left. */
  const probeCensus = W.HG_GOLD_WEEKEND_MINTERS;
  probeCensus.push({ desk: 'SYNTHETIC', tab: 'synthetic-newsless', probe: 'hgNoSuchProbe' });
  const cGap = W.hgGoldNewsCoverage();
  probeCensus.pop();
  eq(cGap.uncovered.length, c.uncovered.length + 1,
    'a routeless desk added to the census is reported UNCOVERED — gaps name themselves');
  ok(cGap.uncovered.some(r => r.tab === 'synthetic-newsless'),
    'and it is named, not merely counted');
  eq(W.hgGoldNewsCoverage().uncovered.length, c.uncovered.length,
    'and removing it restores the report — the probe left no residue');

  /* DERIVED, not a typed list of tabs. The first cut named the four raw-bar
     minters hg-v950 listed — and hg-v964 wired one of them (GOLD PRO), which
     turned this red with nothing wrong. A guard that has to be edited every
     time a desk is covered is the stale-list defect these packs keep finding,
     living in the guard. What must hold is the PROPERTY: every desk in the
     uncovered bucket genuinely has no route, and every routed desk is not in
     it. */
  const routeMap = W.HG_GOLD_NEWS_ROUTES || {};
  for (const r of c.uncovered){
    ok(!routeMap[r.tab],
      r.tab + ' is in the uncovered bucket and genuinely has no route');
    eq(r.route, null, r.tab + ' carries no route string either');
  }
  for (const r of [...c.verified, ...c.notLoaded]){
    ok(!!routeMap[r.tab], r.tab + ' is routed and has a route entry');
    ok(!c.uncovered.some(u => u.tab === r.tab), r.tab + ' is not also uncovered');
  }

  /* the probe is NOT a rubber stamp: a route that cannot tell the two
     instants apart must read BROKEN (a bucket nothing can land in is a
     rubber stamp — hg-v950) */
  const stuck = boot(['gold-formation.js']);   /* goldind absent -> no verdict */
  eq(stuck.hgGoldNewsProbe(), 'BROKEN',
    'a route that cannot answer at all reads BROKEN, never VERIFIED');

  /* AND a route that DOES answer but cannot tell the two instants apart is
     BROKEN too — a stuck rule is not a gate. Without this the probe's final
     comparison could be deleted and nothing noticed: the case above only
     exercises the "no verdict" branch. Driven with the gate stubbed to never
     lock, so inside and outside both exist and both read open. */
  const neverLocks = boot(['gold-formation.js'], {});
  neverLocks.hgGoldNewsGate = () => ({ lock: false, unchecked: false, title: null, reason: null });
  eq(neverLocks.hgGoldNewsProbe(), 'BROKEN',
    'a gate that never locks reads BROKEN — it answered, and could not distinguish');
  neverLocks.hgGoldNewsGate = () => ({ lock: true, unchecked: false, title: 'x', reason: 'y' });
  eq(neverLocks.hgGoldNewsProbe(), 'BROKEN',
    'and one that ALWAYS locks reads BROKEN for the same reason');
}

/* =====================================================================
   7. The route table is not a second census.
   ===================================================================== */
{
  const src = read('gold-formation.js');
  ok(/HG_GOLD_WEEKEND_MINTERS/.test(src.slice(src.indexOf('function hgGoldNewsCoverage'))),
    'the reporter derives its desk list from the existing census');
  const routes = W.HG_GOLD_NEWS_ROUTES;
  ok(routes && typeof routes === 'object', 'the route map is exported');
  /* every routed tab must be a real census tab — a route for a desk that does
     not exist is the stale-list failure one layer along */
  const c = W.hgGoldNewsCoverage();
  const known = new Set([...c.verified, ...c.uncovered, ...c.notLoaded].map(r => r.tab));
  for (const k of Object.keys(routes))
    ok(known.has(k), 'route names a real census desk: ' + k);
}

console.log('\nOK — ' + n + ' assertions passed (gold news gate wire)');
