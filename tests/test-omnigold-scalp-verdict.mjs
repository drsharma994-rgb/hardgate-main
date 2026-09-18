/* HARDGATE — SCALP VERDICT panel: pooled gold forward log, Wilson lower ≥ 90%.

   Run: node tests/test-omnigold-scalp-verdict.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(extra){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  /* NO STUB. hgWilson used to live inline in index.html and in no module, so
     this harness hand-wrote one — and the hand-written one dropped the
     `if (!(n > 0) || !(wins >= 0) || wins > n) return null` guard, answering
     {lo:NaN,...} exactly where the shipped function answers null. These
     assertions were checking the tab's promotion rules against a more
     permissive estimator than the tab ships. It is in fixpack14-core.js now,
     which the loader below already reads. */
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js',
                   'plans.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

console.log('== pooled merge across gold tabs ==');
{
  const W = boot();
  W.hgFwdStats = (tab, mech, ticketOnly) => {
    if (tab === 'OMNIGOLD:SCALP' && mech === 'FVG-FILL' && ticketOnly) return { samples: 8, wins: 7, losses: 1, hit: 0.875 };
    if (tab === 'GOLDSCALP' && mech === 'FVG-FILL' && ticketOnly) return { samples: 6, wins: 6, losses: 0, hit: 1 };
    return { samples: 0, wins: 0, losses: 0, hit: NaN };
  };
  const m = W.hgOgMergeSettledEvidence(['OMNIGOLD:SCALP', 'GOLDSCALP'], 'FVG-FILL');
  ok(m && m.samples === 14 && m.wins === 13, 'pools wins across OMNIGOLD + GOLDSCALP');
  ok(m.wilson && isFinite(m.wilson.lo), 'merged Wilson computed');
}

console.log('\n== pick scalp verdict at 90% bar ==');
{
  const W = boot();
  W.hgFwdStats = (tab, mech, ticketOnly) => {
    if (!ticketOnly) return { samples: 0, wins: 0, losses: 0 };
    /* 78/80 per tab, pooled across the three gold desks -> 234/240.
       THIS FIXTURE WAS 39/40 (117/120 pooled) UNTIL PACK 835. That record's
       Wilson lower is 0.9291 at the uncorrected 1.96 and 0.8797 at the
       Sidak bar over 77 mechanics, so it cleared the 90% verdict only while
       the bar ignored how many mechanics were screened to find it. The
       fixture is strengthened rather than the bar loosened; the next
       assertion pins the old one as no longer sufficient, so the move is
       recorded and not quietly absorbed. */
    if (mech === 'FVG-FILL') return { samples: 80, wins: 78, losses: 2, hit: 0.975 };
    return { samples: 0, wins: 0, losses: 0, hit: NaN };
  };
  const ranked = [{
    horizon: 'SCALP', kind: 'FVG-FILL', dir: 'long',
    grade: { ticket: true },
    plan: { entry: 2650, stop: 2640, t1: 2670 }
  }];
  const bag = W.hgOgPickScalpVerdict(ranked, null, 'long');
  ok(bag.go && bag.go.kind === 'FVG-FILL', 'GO verdict when Wilson clears 90% at the family-corrected bar');
  ok(bag.go.verdictEv && bag.go.verdictEv.wilsonFam && bag.go.verdictEv.wilsonFam.lo >= 0.90,
     `on the corrected bound (${bag.go.verdictEv.wilsonFam.lo.toFixed(4)}), not the displayed one `
     + `(${bag.go.verdictEv.wilson.lo.toFixed(4)})`);
  {
    const W2 = boot();
    W2.hgFwdStats = (tab, mech, ticketOnly) => {
      if (!ticketOnly) return { samples: 0, wins: 0, losses: 0 };
      if (mech === 'FVG-FILL') return { samples: 40, wins: 39, losses: 1, hit: 0.975 };
      return { samples: 0, wins: 0, losses: 0, hit: NaN };
    };
    const bag2 = W2.hgOgPickScalpVerdict(ranked.map(r => Object.assign({}, r)), null, 'long');
    ok(!bag2.go,
       'and the old 117/120 fixture no longer clears it — 97.5% on 120 trades is not enough '
       + 'once the bar counts the 77 mechanics it was picked from');
  }
  ok(!W.hgOgPickScalpVerdict(ranked, null, 'short').go, 'tape filter blocks wrong direction');
}

console.log('\n== mount wiring ==');
{
  const GOLD = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/id="ogVerdict"/.test(GOLD), 'verdict host div');
  ok(/hgOgPaintScalpVerdict/.test(GOLD), 'painted after scan');
  ok(/SCALP VERDICT · 90% SETTLED/.test(GOLD), 'panel titled');
  ok(/OG_SCALP_FWD_TABS/.test(GOLD), 'pools gold tab forward keys');
}

console.log('\nomnigold scalp verdict: ' + passed + ' checks passed');
