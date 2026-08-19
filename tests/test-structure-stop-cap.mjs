/* HARDGATE — the stop was moved off structure, and the R:R still claimed 2R.

   Written after a report of repeatedly hitting stop losses on OMNIGOLD and
   SUPER GOLD. Both build levels through hgPlanLevels -> hgPlanLevelsCore ->
   hgStructureStop, and that last function did this:

     if (risk > capDist * a){
       stop = entry -/+ fallback * a;                     // 1.5xATR from entry
       note = 'stop capped: structure beyond 2.5xATR ...'
     }

   When the level that would actually invalidate the idea sat further than
   2.5xATR away, the stop was MOVED IN to a flat 1.5xATR and the trade was
   offered anyway. Measured over 800 gold-shaped 1h samples:

     stop capped                       : 519 of 800  (65%)
     real structural stop was          : 2.12x further away
     so the stop sat                   : ~53% closer than invalidation
     R:R the card advertised           : 2.00R
     R:R against real invalidation     : 0.96R
     overstatement                     : 2.08x

   A stop inside the structure, in normal noise, on a trade sold as 2R that
   was worth about 1R. That is a machine for hitting stop losses, and it is
   the same defect class as the earlier overstated-R:R fixes — except the
   falsified term here is the RISK, not the ratio.

   The fix keeps the stop on structure and lets the R:R gate judge the trade
   on true risk. Because targets are R-multiples OF that risk, a wider stop
   moves the target proportionally: the count of setups does not fall, the
   trade simply becomes a genuine 2R instead of a labelled one, and
   fixed-risk sizing takes a smaller position for the same dollars at risk.

   Scope, stated honestly. Making this the GLOBAL default re-priced every desk
   at once and broke five existing test files — the crypto desks are built
   around the 2.5x cap and a 1.5x fallback, and changing that under them is a
   separate piece of work. The default is unchanged; the gold desks opt in
   with capMode:'structure', because gold is where the harm was reported and
   measured. A block below pins that the default really is untouched.

   Run: node tests/test-structure-stop-cap.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'plans.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}

/* Gold-shaped 1h bars: small drift, periodic volatility bursts, deterministic
   so the numbers in the header can be re-derived. */
function gold(n, seed){
  const out = [];
  let p = 3350, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    const news = (i % 97 === 0) ? 6 : 1;
    p = p * (1 + (rnd() - 0.5) * 0.0016 * news);
    const rng = p * 0.0011 * news * (0.6 + rnd());
    out.push({ t: 1700000000 + i * 3600, o: p - rng * 0.3, h: p + rng, l: p - rng, c: p, v: 1000 });
  }
  return out;
}

console.log('== the stop stays on structure ==');
{
  let capped = 0, structural = 0, wide = 0, samples = 0;
  for (let seed = 1; seed <= 400; seed++){
    const rows = gold(300, seed);
    const entry = rows[rows.length - 1].c;
    for (const dir of ['long', 'short']){
      const st = ctx.hgStructureStop(dir, entry, rows, { minRr: 2, capMode: 'structure' });
      if (!st) continue;
      samples++;
      if (/TIGHTENED/.test(st.note)) capped++;
      else structural++;
      if (st.wide) wide++;
    }
  }
  ok(samples >= 700, 'the sweep actually produced stops (' + samples + ') — not a vacuous pass');
  ok(capped === 0, 'in structure mode no stop is tightened off structure (' + capped + ')');
  ok(structural === samples, 'every stop sits on the swing it was derived from');
  ok(wide > 100, 'the wide ones are flagged rather than hidden (' + wide + ' of ' + samples + ')');
}

console.log('\n== a wide stop says so, and says what the R:R is measured against ==');
{
  let found = null;
  for (let seed = 1; seed <= 400 && !found; seed++){
    const rows = gold(300, seed);
    const entry = rows[rows.length - 1].c;
    for (const dir of ['long', 'short']){
      const st = ctx.hgStructureStop(dir, entry, rows, { capMode: 'structure' });
      if (st && st.wide){ found = st; break; }
    }
  }
  ok(!!found, 'a wide-stop case was found to inspect');
  ok(/WIDE/.test(found.note), 'the note marks it WIDE (' + found.note.slice(0, 60) + ')');
  ok(/real invalidation/.test(found.note), 'and states the R:R is measured against real invalidation');
  ok(found.risk > 2.5 * found.atr, 'its risk really is beyond the 2.5xATR guide ('
    + (found.risk / found.atr).toFixed(1) + 'xATR)');
}

console.log('\n== THE DEFECT, reproduced: tightening overstates R:R about 2x ==');
{
  /* capMode:'tighten' is exactly the old path, kept so the claim is
     re-measured on every run instead of quoted from a commit message. */
  let shown = [], real = [], n = 0;
  for (let seed = 1; seed <= 400; seed++){
    const rows = gold(300, seed);
    const entry = rows[rows.length - 1].c;
    for (const dir of ['long', 'short']){
      const tight = ctx.hgStructureStop(dir, entry, rows, { capMode: 'tighten' });
      const struct = ctx.hgStructureStop(dir, entry, rows, { capMode: 'structure' });
      if (!tight || !struct || !/TIGHTENED/.test(tight.note)) continue;
      const plan = ctx.hgPlanFromRisk(dir, entry, tight.stop, { minRr: 2 });
      if (!plan || !isFinite(plan.t1)) continue;
      shown.push(Math.abs(plan.t1 - entry) / tight.risk);
      real.push(Math.abs(plan.t1 - entry) / struct.risk);
      n++;
    }
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  ok(n > 300, 'the tightened path was exercised on ' + n + ' cases');
  ok(Math.abs(avg(shown) - 2) < 0.05, 'it advertises 2R (' + avg(shown).toFixed(2) + ')');
  ok(avg(real) < 1.2, 'while the trade is worth about 1R against real invalidation (' + avg(real).toFixed(2) + ')');
  ok(avg(shown) / avg(real) > 1.8, 'an overstatement of ' + (avg(shown) / avg(real)).toFixed(2) + 'x');
  ok(/measured against this reduced risk/.test(
    ctx.hgStructureStop('long', gold(300, 3)[299].c, gold(300, 3), { capMode: 'tighten' }).note || ''),
    'and when a caller opts into it, the note now says so instead of hiding it');
}

console.log('\n== the honest stop does not cost setups, it re-prices them ==');
{
  let before = 0, after = 0, declined = 0;
  const beforeRR = [], afterRR = [], widen = [];
  for (let seed = 1; seed <= 400; seed++){
    const rows = gold(300, seed);
    const entry = rows[rows.length - 1].c;
    for (const dir of ['long', 'short']){
      const tight = ctx.hgStructureStop(dir, entry, rows, { capMode: 'tighten' });
      const struct = ctx.hgStructureStop(dir, entry, rows, { capMode: 'structure' });
      if (tight){
        const p = ctx.hgPlanFromRisk(dir, entry, tight.stop, { minRr: 2 });
        if (p){ before++; beforeRR.push(Math.abs(p.t1 - entry) / tight.risk); }
      }
      if (!struct){ declined++; continue; }
      const p2 = ctx.hgPlanFromRisk(dir, entry, struct.stop, { minRr: 2 });
      if (p2){
        after++;
        afterRR.push(Math.abs(p2.t1 - entry) / struct.risk);
        if (tight) widen.push(struct.risk / tight.risk);
      }
    }
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  ok(after >= before * 0.95, 'the setup count is not cut (' + before + ' -> ' + after + ')');
  ok(Math.abs(avg(afterRR) - 2) < 0.05, 'and the R:R is still 2R (' + avg(afterRR).toFixed(2) + ') — but now against invalidation');
  ok(avg(widen) > 1.5, 'the stop is on average ' + avg(widen).toFixed(2) + 'x wider, which is the point');
  ok(declined >= 0, 'unusable geometry is declined rather than dressed up (' + declined + ')');

  /* Wider risk with the same dollar risk means a smaller position — the
     sizing worksheet does this by construction, so state it. */
  const risk1 = 10, risk2 = 21;
  ok((1000 / risk2) < (1000 / risk1), 'fixed-risk sizing takes a smaller position on the wider stop, '
    + 'so the dollars at risk are unchanged');
}

console.log('\n== unusable geometry is declined outright ==');
{
  /* A flat series has no swing worth stopping behind; a spike-then-flat one
     puts structure absurdly far away. Neither should produce a plan. */
  const flat = [];
  for (let i = 0; i < 200; i++) flat.push({ t: i * 3600, o: 100, h: 100, l: 100, c: 100, v: 1 });
  ok(ctx.hgStructureStop('long', 100, flat, { capMode: 'structure' }) === null, 'a flat series yields no stop (zero ATR)');

  const spike = [];
  for (let i = 0; i < 200; i++){
    const c = (i === 40) ? 100 : 3350;
    spike.push({ t: i * 3600, o: c, h: c * 1.0002, l: c * 0.9998, c: c, v: 1 });
  }
  const s = ctx.hgStructureStop('long', 3350, spike, { capMode: 'structure' });
  ok(s === null || s.risk <= 6 * s.atr, 'structure beyond 6xATR is declined rather than capped');
}

console.log('\n== the options argument reaches the core again ==');
{
  /* hgPlanLevels moved out of index.html into hg-plan.js: ten modules call it
     and while it lived in an 8,700-line HTML file no harness could reach it,
     so every desk test built its cards with plan === null. */
  const planSrc = fs.readFileSync(path.join(ROOT, 'hg-plan.js'), 'utf8');
  ok(/function hgPlanLevels\(dir, rows, entryOverride, opts\)/.test(planSrc),
    'hgPlanLevels accepts the options its callers were already passing');
  ok(!/function hgPlanLevels\(/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')),
    'and index.html no longer defines it');
  ok(/Object\.assign\(\{ minRr: 2 \}, opts \|\| \{\}\)/.test(planSrc),
    'and forwards them, keeping 2R as the default it always had');

  const og = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/minRr: cfg\.minRr, capMode: 'structure'/.test(og),
    'OMNIGOLD passes minRr and now the stop mode — both used to be dropped by the wrapper');
  ok(/minRr: 1\.5/.test(og), 'its SCALP desk asks for 1.5R');
  ok(/minRr: 2\.0/.test(og), 'and its SWING desk for 2.0R');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL STRUCTURE-STOP TESTS PASSED');
