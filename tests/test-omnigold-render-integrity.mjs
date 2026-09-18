/* HARDGATE — the tab never prints a number it does not have.

   Every panel on OMNIGOLD is built around one rule: a figure is quoted from
   the record or it is not quoted. "unavailable" is an acceptable answer
   everywhere on this tab; a fabricated zero is not.

   `NaN` breaks that rule harder than a zero does, because it appears in the
   sentence shaped like a real number. Fuzzing the exported render surface
   turned up four places it could:

     hgOgScalpVerdictPanelHtml   "Wilson lower >= NaN% - min undefined settled"
     hgOgSettledExecutePanelHtml "none has undefined+ settled TICKETs"
     hgOgHeldQueueHtml           "undefined - undefined LONG", and a sentence
                                 ending "while gold tape reads ."
     hgOgMpHorizonHtml           "NaN - STAND ASIDE" as a card headline

   The mechanism in the two panels is `bag = bag || { ...defaults }`. That
   reads like a default and is not one: it fires only when the bag is
   entirely falsy, so a bag arriving with SOME fields set takes none of the
   defaults and renders the holes. This file already carries the antidote and
   its post-mortem — hgOgNormalizeDrawdownState, written after a legacy state
   missing two fields turned both counters into NaN and silently disabled the
   drawdown breaker. Same shape, same fix.

   SCOPE, STATED PLAINLY. No call site reaches any of these with a partial
   bag today; both pickers populate every field, and the held queue's single
   caller guards its tape. This is the exported surface being held to the
   promise the rest of the tab keeps, not a live wrong number corrected. The
   sweep at the end is the part that earns its keep over time: it holds EVERY
   exported renderer to the rule, so the next one cannot land quietly.

   Run: node tests/test-omnigold-render-integrity.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const store = Object.create(null);
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
                   'hg-forward.js', 'formation.js', 'plans.js', 'hg-gates.js', 'hg-plan.js',
                   'omniroute.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  return ctx;
}
const W = boot();
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
                            .replace(/&middot;/g, '·').replace(/\s+/g, ' ').trim();
const BAD = /\bNaN\b|\bundefined\b|\[object Object\]/;

const T = 1700000000 - (1700000000 % 86400);
const mk = (n) => {
  let p = 4000, s = 9;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const o = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    o.push({ t: T + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1000 });
  }
  return o;
};

console.log('== the two evidence panels quote the desk thresholds, or nothing ==');
{
  ok(typeof W.hgOgScalpVerdictPanelHtml === 'function'
     && typeof W.hgOgSettledExecutePanelHtml === 'function', 'both panels are exported');

  /* THE OLD IDIOM, so the claim is checkable rather than asserted. */
  const oldWay = (bag) => {
    bag = bag || { go: null, alternates: [], bestBelow: [], minLo: 0.90, minN: 10 };
    return 'Wilson lower >= ' + (bag.minLo * 100).toFixed(0) + '% · min ' + bag.minN + ' settled';
  };
  ok(!BAD.test(oldWay(null)), 'a WHOLLY absent bag took the defaults, which is why this looked fine');
  ok(/NaN/.test(oldWay({ go: null })) && /undefined/.test(oldWay({ go: null })),
     `but a PARTIAL one rendered "${oldWay({ go: null })}"`);

  /* every partial shape the pickers could plausibly hand over */
  const partials = [
    {}, { go: null }, { go: null, alternates: [] }, { minLo: 0.9 }, { minN: 10 },
    { tabs: [] }, { tabs: null }, { minLo: null, minN: null }, { minLo: 'x', minN: 'x' },
    { minLo: NaN, minN: undefined }, { alternates: null, bestBelow: null },
    { go: 'x' }, { execute: null, proven: null, best: null }, { edgeMinN: null },
    { edgeMinN: '', edgeMargin: NaN }
  ];
  let calls = 0, nonEmpty = 0;
  for (const fn of ['hgOgScalpVerdictPanelHtml', 'hgOgSettledExecutePanelHtml']){
    for (const bag of [undefined, null, ...partials]){
      let html;
      try { html = W[fn](bag); }
      catch (e) { throw new Error('FAIL: ' + fn + ' threw on ' + JSON.stringify(bag) + ' — ' + e.message); }
      calls++;
      const txt = strip(html);
      if (txt) nonEmpty++;
      if (BAD.test(txt)) throw new Error('FAIL: ' + fn + ' on ' + JSON.stringify(bag) + ' rendered: ' + txt.slice(0, 160));
    }
  }
  ok(calls === 34 && nonEmpty === 34,
     `${calls} partial bags across both panels: every one rendered a real panel, none printed NaN or undefined`);

  /* and the fallback is the DESK'S OWN THRESHOLD, not an arbitrary safe value */
  const v = strip(W.hgOgScalpVerdictPanelHtml({ go: null }));
  ok(/Wilson lower ≥ 90%/.test(v), `the verdict panel falls back to its real 90% bar: "${v.slice(0, 120)}"`);
  ok(/min 10 settled/.test(v), 'and its real 10-trade minimum');
  ok(/OMNIGOLD/.test(v), 'and names the pooled tabs rather than an empty list');
  const e = strip(W.hgOgSettledExecutePanelHtml({ proven: null }));
  ok(/min 25 trades/.test(e), `the execute panel falls back to its real 25-trade bar: "${e.slice(0, 110)}"`);

  /* a caller's real value still wins over the fallback */
  const custom = strip(W.hgOgScalpVerdictPanelHtml({ go: null, minLo: 0.75, minN: 3 }));
  ok(/Wilson lower ≥ 75%/.test(custom) && /min 3 settled/.test(custom),
     'a bag that DOES carry thresholds is still quoted, so this is a fallback and not an override');
}

console.log('\n== the held queue names its rows, or drops them ==');
{
  const card = (over) => Object.assign({ horizon: 'SCALP', kind: 'ROUND-MAGNET', dir: 'long' }, over || {});
  const full = strip(W.hgOgHeldQueueHtml([card()], 'short'));
  ok(/SCALP · ROUND-MAGNET LONG/.test(full), `a complete card names itself: "${full.slice(0, 120)}"`);
  ok(/tape reads SHORT/.test(full), 'and the sentence names the tape');

  const noTape = strip(W.hgOgHeldQueueHtml([card()], null));
  ok(!BAD.test(noTape), 'an unreadable tape prints no undefined');
  ok(!/reads \./.test(noTape) && /unreadable/.test(noTape),
     `and says so instead of trailing off: "${noTape.slice(0, 150)}"`);

  const halfCard = strip(W.hgOgHeldQueueHtml([card({ kind: null })], 'short'));
  ok(/SCALP LONG/.test(halfCard) && !BAD.test(halfCard),
     `a card missing its mechanic still names what it has: "${halfCard.slice(0, 120)}"`);

  const nameless = W.hgOgHeldQueueHtml([card({ horizon: null, kind: null })], 'short');
  ok(nameless === '',
     'a card that can name NEITHER is dropped — an unnamed row in a queue is worse than a shorter queue');
  const mixed = strip(W.hgOgHeldQueueHtml([card(), card({ horizon: null, kind: null })], 'short'));
  ok(/1 cleared LONG ticket\b/.test(mixed),
     `and the count follows the rows actually shown, not the input length: "${mixed.slice(0, 90)}"`);
  ok(W.hgOgHeldQueueHtml([], 'short') === '' && W.hgOgHeldQueueHtml(null, 'short') === '',
     'an empty queue renders nothing at all');
}

console.log('\n== a horizon card is headed by a name ==');
{
  const head = (l) => strip(W.hgOgMpHorizonHtml(l, null, null, null, null, null)).slice(0, 40);
  ok(/^SCALP/.test(head('SCALP')), `a real label heads the card: "${head('SCALP')}"`);
  for (const bad of [NaN, null, undefined, {}, [], 0, '', '   ', true]){
    const h = head(bad);
    if (BAD.test(h)) throw new Error('FAIL: label ' + JSON.stringify(bad) + ' rendered "' + h + '"');
    ok(/^HORIZON/.test(h), `a ${JSON.stringify(bad)} label falls back to a word, not to "${String(bad)}"`);
  }
}

console.log('\n== a hole in the bar array is not a crash ==');
{
  /* closesOf() in hg-mechanics.js documents this hazard from a real incident:
     "a feed that drops a bar leaves a hole in the middle, and reaching
     through it threw from inside whatever gate happened to call this first."
     Four bar-walkers still reached through it. */
  const clean = mk(60);
  const holed = mk(60); holed[30] = null; holed[58] = undefined;

  for (const [nm, args] of [['hgOgAtrOf', [holed, 14]], ['hgMechAtrOf', [holed, 14]],
                            ['hgOgWindowStart', [holed, T + 40 * 3600]], ['hgOgBtLastSec', [holed]]]){
    ok(typeof W[nm] === 'function', nm + ' is exported');
    let r;
    try { r = W[nm](...args); }
    catch (e) { throw new Error('FAIL: ' + nm + ' threw on a holed array — ' + e.message); }
    ok(r !== undefined, `${nm} answers over a holed array (${r})`);
  }

  /* the hole DROPS OUT — it is not read as a zero, which was the other half
     of this class and is what pack 824 and 828 were about */
  const a1 = W.hgOgAtrOf(clean, 14), a2 = W.hgOgAtrOf(holed, 14);
  ok(isFinite(a1) && isFinite(a2) && Math.abs(a1 - a2) < a1 * 0.05,
     `ATR reads ${a2.toFixed(3)} over the holed array against ${a1.toFixed(3)} clean — the hole drops out`);
  ok(W.hgOgBtLastSec(holed) === W.hgOgBtLastSec(clean),
     'and the replay clock steps past a trailing hole to the newest real bar');
  ok(!isFinite(W.hgOgBtLastSec([null, undefined])), 'an array of nothing but holes is not a clock');
}

console.log('\n== and the rule holds across every exported renderer ==');
{
  /* THE STANDING GUARD. Not one of the specific bugs above — the class. Any
     exported hgOg* function is called across an argument matrix and its
     output held to the tab's rule. A new panel that prints NaN fails here
     without anyone having to think of it. */
  const rows = mk(300);
  const ARGS = [undefined, null, '', 0, -1, NaN, 'x', {}, [], true, rows, rows.slice(0, 3),
                { entry: 4000, stop: 3980, t1: 4040 }, { dir: 'long', kind: 'X' }, 1700000000,
                { go: null }, { proven: null }, { horizon: 'SCALP' }, [null], 'SCALP'];
  const names = Object.keys(W).filter(k => /^hgOg/.test(k) && typeof W[k] === 'function');
  ok(names.length > 150, `${names.length} exported hgOg* functions to sweep`);

  const offenders = [];
  let calls = 0, htmlOut = 0;
  for (const nm of names){
    const f = W[nm];
    const arity = Math.min(f.length || 1, 3);
    for (const a of ARGS){
      for (const b of (arity > 1 ? ARGS : [undefined])){
        for (const c of (arity > 2 ? ARGS : [undefined])){
          let r;
          try { r = f(a, b, c); } catch (e) { continue; }   /* throws are the next section's problem */
          calls++;
          if (typeof r !== 'string' || !r) continue;
          htmlOut++;
          if (BAD.test(strip(r)) && !offenders.some(o => o[0] === nm))
            offenders.push([nm, strip(r).slice(0, 140)]);
        }
      }
    }
  }
  ok(offenders.length === 0,
     `${calls} calls, ${htmlOut} of them returning text — not one printed NaN, undefined or [object Object]`
     + (offenders.length ? ('\n      ' + offenders.map(o => o[0] + ' :: ' + o[1]).join('\n      ')) : ''));
  ok(htmlOut > 2000,
     `and the sweep is not vacuous — ${htmlOut} string results were actually inspected`);
}

console.log('\n' + passed + ' passed, 0 failed');
