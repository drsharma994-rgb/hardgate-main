/* HARDGATE — GOLD SCALP: what never reached a gate at all.

   hg-v900 gave the tab a ranked funnel: "N setups held back across M gates".
   It ranks the NAMED rejections, which is every setup that formed and was
   then stopped by a gate. But a strategy attempt can end before any gate
   runs, and __gsCand did that with a bare `return null`.

   MEASURED over 600 synthetic scans: 2,667 attempts into __gsCand, of which
   937 (35.1%) ended there.

     378  fewer than two agreeing reads  -> no setup formed at all
     559  OUTVOTED: opposing reads matched or beat the agreeing ones

   Those are not the same thing. The thin ones are honestly silent — naming
   every strategy that did not trigger would bury the ones that did. The
   outvoted ones are a desk that HAD a directional read and whose own evidence
   book went against it, and the funnel's headline gave no hint that a set
   larger than the one it ranked never got that far.

   THIS COUNTS; IT DOES NOT GATE. The condition in __gsCand is unchanged, and
   nothing is held back or released by any of it.

   Run: node tests/test-goldscalp-pregate.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
const GS = fs.readFileSync(root + 'goldscalp.js', 'utf8');
const GI = fs.readFileSync(root + 'goldind.js', 'utf8');

function grab(src, name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0;
  const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++){
    if (src[k] === '{') d++;
    else if (src[k] === '}'){ d--; if (!d) return src.slice(i, k + 1); }
  }
  return '';
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const F = new Function('esc', grab(GS, 'gsGateFamily') + grab(GS, 'gsGateShort')
  + grab(GS, 'gsRejectFunnel') + grab(GS, 'gsPreGateLine') + grab(GS, 'gsRejectFunnelHTML')
  + 'return { gsPreGateLine, gsRejectFunnelHTML };')(esc);
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/* the real engine, to prove the tally is produced and not just rendered */
function loadGoldind(){
  const ctx = { window: {}, console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
                Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
                parseInt, parseFloat, NaN, Infinity, RegExp, Set, Map, Error,
                setTimeout: () => 0, clearTimeout: () => {} };
  ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'structure-levels.js',
                   'gold-session.js', 'goldind.js']){
    try { vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f }); } catch (e) {}
  }
  return ctx.window;
}
const W = loadGoldind();
function tape(seed, n, sec, t0, drift){
  let x = seed;
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const r = [];
  let c = 2400;
  for (let i = 0; i < n; i++){
    const o = c; c = o + (rnd() - 0.5) * 4 + (drift || 0);
    r.push({ t: t0 + i * sec, o, h: Math.max(o, c) + rnd() * 1.8, l: Math.min(o, c) - rnd() * 1.8, c, v: 900 });
  }
  return r;
}

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the engine counts what it used to drop in silence');
{
  const NOW = Date.now();
  let attempts = 0, thin = 0, outvoted = 0, scans = 0;
  for (let seed = 1; seed <= 300; seed++){
    const drift = [0, 0.35, -0.35, 0.15, -0.15][seed % 5];
    const got = W.goldScalpSetups({
      rows15m: tape(seed, 400, 900, Math.floor((NOW / 1000 - 400 * 900) / 900) * 900, drift),
      rows1h: tape(seed + 5, 400, 3600, Math.floor((NOW / 1000 - 400 * 3600) / 3600) * 3600, drift * 4),
      rows4h: tape(seed + 9, 400, 14400, Math.floor((NOW / 1000 - 400 * 14400) / 14400) * 14400, drift * 16),
      now: NOW, news: null });
    const t = got && got.preGate;
    if (!t) continue;
    scans++; attempts += t.attempts; thin += t.thin; outvoted += t.outvoted;
  }
  ok(scans > 250, 'the tally came back on ' + scans + ' scans');
  ok(attempts > 800, 'counting ' + attempts + ' strategy attempts');
  ok(thin > 0 && outvoted > 0,
     'split into ' + thin + ' thin and ' + outvoted + ' outvoted — both paths are real');
  ok(thin + outvoted < attempts,
     'and they are a SUBSET of the attempts (' + (thin + outvoted) + ' of ' + attempts
     + '), not the whole thing — the rest reached a gate or became a setup');

  /* the tally rides the documented side-channel, like .rejected */
  ok(/out\.preGate = D\.__gsTally;/.test(GI), 'attached beside .rejected on the returned array');
  ok(/D\.__gsTally = \{ thin: 0, outvoted: 0, attempts: 0 \};/.test(GI),
     'and reset once per scan, so it cannot accumulate across scans');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. thin and outvoted are counted apart, because they are not the same');
{
  ok(/if \(myEv\.length < 2\) D\.__gsTally\.thin\+\+;/.test(GI),
     'fewer than two agreeing reads counts as thin');
  ok(/else D\.__gsTally\.outvoted\+\+;/.test(GI),
     'and opposition at or above agreement counts as outvoted');

  /* the gate condition itself must be untouched */
  ok(/if \(myEv\.length < 2 \|\| myEv\.length <= oppose\)\{/.test(GI),
     'the condition is the same one it always was');
  const blk = GI.slice(GI.indexOf('if (myEv.length < 2 || myEv.length <= oppose){'));
  const body = blk.slice(0, blk.indexOf('\n    }') + 6);
  ok(/return null;/.test(body), 'and it still returns null — this counts, it does not gate');
  ok(!/dropped: true/.test(body),
     'it does not fabricate a named rejection for a setup that never formed');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the panel completes its own accounting');
{
  const rej = [{ strategy: 'A', reason: 'structure too close — R:R insufficient (caps TP1 at 0.9R)' },
               { strategy: 'B', reason: 'structure too close — R:R insufficient (caps TP1 at 1.1R)' },
               { strategy: 'C', reason: 'liquidity sweep without volume climax — V2 gate' }];
  const t = text(F.gsRejectFunnelHTML(rej, { attempts: 2667, thin: 378, outvoted: 559 }));
  ok(/3 setups held back across 2 gates/.test(t), 'the ranked gates still lead');
  ok(/937 never reached a gate/.test(t), 'and the pre-gate total follows');
  ok(/of 2667 strategy-builder attempts/.test(t),
     'naming its own denominator, so the figure is not read against the gate count');
  ok(/559 outvoted by the desk's own evidence book/.test(t), 'naming the outvoted count');
  ok(/378 with fewer than two agreeing reads/.test(t), 'and the thin count');
  ok(/no setup formed/.test(t), 'saying plainly that a thin attempt is not a held-back setup');

  /* the two are never conflated into one number */
  ok(!/937 outvoted/.test(t) && !/937 with fewer/.test(t),
     'the total is never attributed to either half alone');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. it keeps quiet when it has nothing to add');
{
  ok(F.gsRejectFunnelHTML([], null) === '', 'no gates and no tally renders nothing at all');
  ok(F.gsRejectFunnelHTML([], { attempts: 0, thin: 0, outvoted: 0 }) === '',
     'and a tally of zeroes is not a finding');
  ok(F.gsPreGateLine(null) === '' && F.gsPreGateLine(undefined) === '',
     'an absent tally prints no line');

  /* a scan whose gates were all quiet but whose attempts were outvoted still
     gets a panel — that IS the answer to "why is this board empty" */
  const only = text(F.gsRejectFunnelHTML([], { attempts: 900, thin: 0, outvoted: 40 }));
  ok(/WHY NOTHING LED/.test(only), 'outvoted attempts alone still open the panel');
  ok(/40 outvoted/.test(only), 'and report the count');
  ok(/of 900 strategy-builder attempts/.test(only), 'against its own denominator');
  ok(!/held back across/.test(only), 'without claiming gates that never fired');

  /* the ranked half is unaffected when no tally is passed */
  const noTally = text(F.gsRejectFunnelHTML(
    [{ strategy: 'A', reason: 'structure too close — R:R insufficient (caps TP1 at 0.9R)' }], null));
  ok(/1 setup held back across 1 gate/.test(noTally), 'gates render exactly as before without a tally');
  ok(!/never reached a gate/.test(noTally), 'and no pre-gate line is invented');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. summed across venues, and wired into both render paths');
{
  ok(/var preGateAll = \{ attempts: 0, thin: 0, outvoted: 0 \};/.test(GS),
     'the tab sums the tally across venues');
  ok(/preGateAll\.outvoted \+= \(\+got\.preGate\.outvoted \|\| 0\);/.test(GS),
     'adding each venue leg rather than overwriting');
  ok((GS.match(/gsRejectFunnelHTML\(rejectedAll, preGateAll\)/g) || []).length === 2,
     'and passes it on both render paths — the one with cards and the one without');

  const body = grab(GS, 'gsPreGateLine') + grab(GS, 'gsRejectFunnelHTML');
  ok(!/\.dropped\s*=/.test(body) && !/\.demoted\s*=/.test(body) && !/\.vetoed\s*=/.test(body),
     'nothing in the panel writes dropped, demoted or vetoed');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. two tallies, not two parts of one — a correction to hg-v903');
{
  /* hg-v903 printed this line as "and N strategy attempts never reached a
     gate" directly under "N setups held back across M gates". The `and` reads
     as a sum, and it is not one.

     __gsTally counts entries into __gsCand, the strategy-candidate builder.
     The ranked gates above ALSO hold back setups minted by the engine
     detectors — liqsweep, sweepob, p6fail, p8range and the rest — which never
     pass through that counter. Measured over 400 scans: 1,962 builder
     attempts, but candidates plus ranked rejections plus this tally came to
     2,306, overshooting on 317 of the 400 scans. */
  const t = text(F.gsRejectFunnelHTML(
    [{ strategy: 'X', stratKey: 'liqsweep', reason: 'liquidity sweep without volume climax — V2 gate' }],
    { attempts: 1962, thin: 378, outvoted: 559 }));

  ok(/separately, of 1962 strategy-builder attempts/.test(t),
     'the line says "separately" and names the population it counts');
  ok(!/\band 937 strategy attempts never reached/.test(t),
     'and no longer opens with an "and" that reads as a sum');
  ok(/do not pass through this counter/.test(t),
     'it states that the gates above cover mints this counter never saw');
  ok(/separate tallies rather than parts of one/.test(t),
     'and says outright that the two must not be added');

  /* the engine-detector mints really are in the gate half and not the tally:
     a rejection keyed to one of them is ranked, while the tally is untouched */
  const engineOnly = text(F.gsRejectFunnelHTML(
    [{ strategy: 'FIVE-LEG SWEEP', stratKey: 'liqsweep', reason: 'engine stop 0.6xATR below the 1.5xATR floor' },
     { strategy: 'SWEEP-OB', stratKey: 'sweepob', reason: 'engine stop 0.9xATR below the 1.5xATR floor' }],
    { attempts: 40, thin: 0, outvoted: 0 }));
  ok(/2 setups held back/.test(engineOnly),
     'engine-detector rejections are counted by the ranked gates');
  ok(!/never reached a gate/.test(engineOnly),
     'while a tally with nothing in it adds no line, even though attempts were made');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
