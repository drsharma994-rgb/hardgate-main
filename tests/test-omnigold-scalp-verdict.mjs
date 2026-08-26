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
  ctx.hgWilson = (wins, n, z) => {
    z = z || 1.96; const p = wins / n, z2 = z * z;
    const denom = 1 + z2 / n;
    const centre = (p + z2 / (2 * n)) / denom;
    const half = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
    return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), p: p };
  };
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
    if (mech === 'FVG-FILL') return { samples: 40, wins: 39, losses: 1, hit: 0.975 };
    return { samples: 0, wins: 0, losses: 0, hit: NaN };
  };
  const ranked = [{
    horizon: 'SCALP', kind: 'FVG-FILL', dir: 'long',
    grade: { ticket: true },
    plan: { entry: 2650, stop: 2640, t1: 2670 }
  }];
  const bag = W.hgOgPickScalpVerdict(ranked, null, 'long');
  ok(bag.go && bag.go.kind === 'FVG-FILL', 'GO verdict when Wilson clears 90%');
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
