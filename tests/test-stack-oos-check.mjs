/* HARDGATE — the stack OOS checker cannot flatter the claim it is judging.

   scripts/stack-oos-check.mjs replays the frozen SWING stack claim over bars
   that printed after the cutoff. Its whole value is that it CANNOT cheat, so
   every assertion here is about a way it could:
     - a cutoff read from the clock would slide forward and never accumulate;
     - judging a firing whose horizon has not fully printed would count open
       trades as samples;
     - counting bars before the cutoff would leak the in-sample period in;
     - a different gate list or horizon would answer a different question
       while wearing the same verdict.

   The walk is tested functionally with an injected ctx — no network, no VM
   boot — so this runs in CI at full speed.

   Run: node tests/test-stack-oos-check.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const m = await import(pathToFileURL(path.join(ROOT, 'scripts', 'stack-oos-check.mjs')).href);
const SRC = fs.readFileSync(path.join(ROOT, 'scripts', 'stack-oos-check.mjs'), 'utf8');

console.log('== the cutoff is frozen, not read from a clock ==');
{
  ok(m.CUTOFF_SEC === Date.UTC(2026, 7, 28) / 1000,
     'CUTOFF_SEC is exactly 2026-08-28T00:00:00Z (' + m.CUTOFF_SEC + ')');
  const def = SRC.slice(SRC.indexOf('CUTOFF_SEC'), SRC.indexOf('CUTOFF_SEC') + 80);
  ok(/=\s*1787875200/.test(def), 'and it is a literal in source, not derived');
  ok(!/CUTOFF_SEC\s*=\s*[^;]*Date\.now/.test(SRC), 'no Date.now anywhere near the cutoff');
}

console.log('\n== the question is the same one the in-sample claim asked ==');
{
  ok(JSON.stringify(m.KEEP) === JSON.stringify(['regime-fit', 'htf-confirm', 'hurst-regime']),
     'the gate list is exactly the three replicated gates');
  ok(m.GW.horizonBars === 20 && m.GW.minAtrPct === 0.12 && m.GW.sessionHard === false,
     'SWING horizon/thresholds match the in-sample measurement');
  ok(m.GS.horizonBars === 24 && m.GS.minAtrPct === 0.05 && m.GS.sessionHard === true,
     'SCALP control config matches too');
}

console.log('\n== the walk cannot cheat (injected ctx, synthetic bars) ==');
{
  /* 100 bars, cutoff at bar 60. One long hit fires on every bar; the walker
     must count only post-cutoff bars whose full horizon has printed. */
  const H = 5, WARM = 10, N = 100, CUT_I = 60;
  const rows = Array.from({ length: N }, (_, i) => ({ t: 1000 + i * 100, o: 1, h: 1, l: 1, c: 1, v: 1 }));
  const cutoffSec = rows[CUT_I].t;
  const cfg = { label: 'SWING', warm: WARM, horizonBars: H, tfSec: 100, otherTfSec: 100,
                minAtrPct: 0.12, sessionHard: false };

  const calls = [];
  const ctx = {
    hgOgTapeDir: () => 'long',
    hgOgDeskTape: () => 'long',
    hgOgDetect: (pre) => { calls.push(pre.length - 1); return [{ dir: 'long' }]; },
    hgOgAdr: () => 1,
    hgOgGates: () => [{ key: 'regime-fit', pass: true }, { key: 'htf-confirm', pass: true },
                      { key: 'hurst-regime', pass: true }, { key: 'unrelated', pass: false }],
    hgOmniWalkForward: (r, i) => ({ res: i % 2 ? 't1' : 'stop' })
  };

  const [res] = m.walk(ctx, rows, rows, cfg, [2.0], cutoffSec);
  const judgeable = N - H - CUT_I; /* bars CUT_I .. N-H-1 */
  ok(res.all.n === judgeable, 'exactly the post-cutoff, full-horizon bars are judged (' + res.all.n + ')');
  ok(Math.min(...calls) === CUT_I, 'no detection ever runs on a pre-cutoff bar (first: ' + Math.min(...calls) + ')');
  ok(Math.max(...calls) === N - H - 1, 'and none inside the unfinished horizon (last: ' + Math.max(...calls) + ')');
  ok(res.stack3.n === res.all.n, 'all three gates passing puts every tape-aligned firing in the stack');
  ok(res.stack2.n === res.all.n, 'and in the 2-of-3 bucket');
  ok(res.firstT === cutoffSec, 'the first judged bar IS the cutoff bar, not one before it');

  /* against-desk firings must stay out of every conditional bucket */
  const shortCtx = { ...ctx, hgOgDetect: () => [{ dir: 'short' }] };
  const [res2] = m.walk(shortCtx, rows, rows, cfg, [2.0], cutoffSec);
  ok(res2.all.n === judgeable && res2.tape.n === 0 && res2.stack3.n === 0,
     'an against-tape firing counts in ALL but never in tape or stack');

  /* one gate failing must drop the firing from 3-of-3 but keep 2-of-3 */
  const twoCtx = { ...ctx, hgOgGates: () => [{ key: 'regime-fit', pass: true },
    { key: 'htf-confirm', pass: true }, { key: 'hurst-regime', pass: false }] };
  const [res3] = m.walk(twoCtx, rows, rows, cfg, [2.0], cutoffSec);
  ok(res3.stack2.n === res3.tape.n && res3.stack3.n === 0,
     'a failing replicated gate demotes the firing to the 2-of-3 bucket only');

  /* a gate that does not answer cannot count as agreeing */
  const oneCtx = { ...ctx, hgOgGates: () => [{ key: 'regime-fit', pass: true }] };
  const [res4] = m.walk(oneCtx, rows, rows, cfg, [2.0], cutoffSec);
  ok(res4.stack3.n === 0 && res4.stack2.n === 0,
     'fewer than two gates answering keeps the firing out of both stack buckets');

  /* two Rs in one pass must match two separate passes exactly — the fold is
     a cost optimization, never a semantics change */
  const wf2 = { ...ctx, hgOmniWalkForward: (r, i, dir, R) => ({ res: (i + Math.round(R)) % 3 ? 't1' : 'stop' }) };
  const [a2, a1] = m.walk(wf2, rows, rows, cfg, [2.0, 1.0], cutoffSec);
  const [b2] = m.walk(wf2, rows, rows, cfg, [2.0], cutoffSec);
  const [b1] = m.walk(wf2, rows, rows, cfg, [1.0], cutoffSec);
  ok(JSON.stringify([a2.all, a2.stack3]) === JSON.stringify([b2.all, b2.stack3]),
     'folded R=2 leg equals a solo R=2 pass');
  ok(JSON.stringify([a1.all, a1.stack3]) === JSON.stringify([b1.all, b1.stack3]),
     'folded R=1 leg equals a solo R=1 pass');
}

console.log('\n== the other horizon is only readable once its bar has CLOSED ==');
{
  /* THE LEAK THIS GUARDS (caught in adversarial review): bar timestamps are
     OPEN times, so advancing the other-horizon pointer on open <= open let
     the 1h walk read a 4h close up to three hours in the future — three of
     every four hourly bars decided tape membership with information that had
     not printed. The rule is close-by-close: other bar t + otherTfSec must
     be <= decision bar t + tfSec. */
  /* rows: 1h bars. other: 4h bars, MORE than the 55-bar minimum the walk
     needs before it reads the other tape at all — otherwise this assertion
     would pass vacuously. */
  const H = 3, WARM = 8;
  const rows = Array.from({ length: 400 }, (_, i) => ({ t: 900000 + i * 3600, o: 1, h: 1, l: 1, c: 1, v: 1 }));
  const other = Array.from({ length: 90 }, (_, i) => ({ t: i * 14400, o: 1, h: 1, l: 1, c: 1, v: 1 }));
  const cfg = { label: 'SCALP', warm: WARM, horizonBars: H, tfSec: 3600, otherTfSec: 14400,
                minAtrPct: 0.05, sessionHard: true };
  let decisionT = null, worstLeak = -Infinity, otherReads = 0;
  const ctx = {
    /* walk computes myDir (1h prefix) before otherDir (4h prefix) on every
       bar, so decisionT is fresh when the other read arrives; the series
       are told apart by their bar spacing */
    hgOgTapeDir: (pre) => {
      const spacing = pre.length >= 2 ? pre[1].t - pre[0].t : 0;
      const last = pre[pre.length - 1];
      if (spacing === 3600){ decisionT = last.t; }
      else if (spacing === 14400 && decisionT !== null){
        otherReads++;
        worstLeak = Math.max(worstLeak, (last.t + 14400) - (decisionT + 3600));
      }
      return 'long';
    },
    hgOgDeskTape: () => 'long',
    hgOgDetect: () => [{ dir: 'long' }],
    hgOgAdr: () => 1,
    hgOgGates: () => [],
    hgOmniWalkForward: () => ({ res: 't1' })
  };
  m.walk(ctx, rows, other, cfg, [2.0], 0);
  ok(otherReads > 100, 'the other tape was actually read (' + otherReads + ' reads) — not vacuous');
  ok(worstLeak <= 0,
     'no exposed 4h bar closes after the 1h decision bar closes (worst slack ' + worstLeak + 's)');
}

console.log('\n== the verdict refuses to speak early and speaks plainly late ==');
{
  ok(m.verdictOf({ n: 39, w: 20 }, { n: 500, w: 160 }).status === 'accumulating',
     '39 settled stack firings is still "accumulating" — the panel threshold is 40');
  ok(m.verdictOf(null, null).status === 'accumulating', 'no data at all is also just accumulating');
  const holds = m.verdictOf({ n: 100, w: 50 }, { n: 500, w: 150 });
  ok(holds.status === 'holds', 'a clear out-of-sample edge reads "holds" (' + holds.text + ')');
  const dead = m.verdictOf({ n: 100, w: 15 }, { n: 500, w: 160 });
  ok(dead.status === 'refuted', 'a clear failure reads "refuted" (' + dead.text + ')');
  ok(m.verdictOf({ n: 100, w: 33 }, { n: 500, w: 160 }).status === 'undecided',
     'no separation reads "undecided", not a soft win');
}

console.log('\n== z is guarded the way every other measurement here guards it ==');
{
  ok(!isFinite(m.z2({ n: 29, w: 10 }, { n: 500, w: 150 })), 'below 30 samples z refuses to answer');
  ok(m.z2({ n: 100, w: 30 }, { n: 100, w: 30 }) === 0, 'identical rates give z=0');
  ok(m.z2({ n: 100, w: 50 }, { n: 100, w: 30 }) > 0, 'a better stack gives positive z');
}

console.log('\n== the scheduled workflow actually runs this and commits state ==');
{
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'stack-oos.yml'), 'utf8');
  ok(/scripts\/stack-oos-check\.mjs/.test(wf), 'the workflow runs the checker');
  ok(/stack-oos-state\.json/.test(wf), 'and commits the state file');
  ok(/schedule:/.test(wf) && /workflow_dispatch/.test(wf), 'on a schedule, with a manual trigger');
  ok(!/npm ci/.test(wf), 'no npm ci — the script needs only node builtins, so the job stays fast');
  const st = JSON.parse(fs.readFileSync(path.join(ROOT, 'stack-oos-state.json'), 'utf8'));
  ok(st.cutoff === '2026-08-28T00:00:00Z', 'the committed state names the frozen cutoff');
  ok(typeof st.verdict === 'string' && st.status, 'and carries a status + human verdict');
}

console.log('\nstack oos check: ' + passed + ' checks passed');
