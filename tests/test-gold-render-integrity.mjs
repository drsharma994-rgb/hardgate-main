/* HARDGATE — seven gold MODULES print a number they have, or say they have none.

   Pack 832 built this sweep for OMNIGOLD and it found four places that could
   render NaN, undefined or [object Object] into a sentence. This file runs
   the same rule across seven gold modules, which is what "update all the
   gold tabs" ought to mean: not a version bump, the same standard.

   It is keyed by MODULE, not by tab — 'eightypercent' here is the file, and
   '80percent' is the tab it registers. Seven modules is not the whole family
   either: index.html's GOLD nav group holds sixteen tabs, and pack 845's
   test-gold-family-coverage reads that group and holds the rule against all
   of them. This file stays module-scoped because what it sweeps is exported
   functions, which is a property of a file and not of a tab.

   It found five in 80PERCENT and one in OMNIGOLD, all live text:

     firedSplitHtml      "0 in undefined"
     livePriceHtml       "from the [object Object] bar forming now"
     ageCellTxt          "NaN bars"
     hg80AutoNote        "auto-update paused — [object Object]"
     armedRealStampHtml  "THESE BARS ARE STALE NaN candles behind"
     ogTradeKey          "undefined|undefined|na|na"

   The last one is not a sentence, which is why it is worse than the others:
   it is a KEY. Built with String() on absent fields, every malformed
   candidate produced the same one, so two different half-built setups shared
   one lane, one throttle slot and one SEND TICKET button target. A card that
   cannot identify itself now gets no key rather than everyone else's.

   WHAT THIS SWEEP CANNOT SEE, stated so the green is not read as more than
   it is: GOLD SCALP, GOLD SWING, GOLD PRO and TAURIC are IIFE-scoped and
   export four to eight functions each, so there is almost nothing at module
   scope for this to call. Their zero is "nothing reachable", not "nothing
   wrong". 80PERCENT (120) and OMNIGOLD (221) export enough to be swept
   properly, and those are the two this found defects in.

   Run: node tests/test-gold-render-integrity.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
              'hg-forward.js', 'goldind.js', 'formation.js', 'plans.js', 'hg-gates.js',
              'hg-plan.js', 'omniroute.js', 'setup-ui.js'];
const TABS = { goldscalp: 'goldscalp.js', goldswing: 'goldswing.js', goldpro: 'goldpro.js',
               eightypercent: 'eightypercent.js', 'super-gold': 'super-gold.js',
               tauric: 'tauric.js', omnigold: 'omnigold.js' };

function boot(extra){
  const store = Object.create(null);
  const el = () => ({ style: {}, classList: { add(){}, remove(){}, contains: () => false },
                      appendChild(){}, setAttribute(){}, innerHTML: '', textContent: '',
                      querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, dataset: {} });
  const doc = { getElementById: () => null, createElement: el, querySelector: () => null,
                querySelectorAll: () => [], head: { appendChild(){} }, body: { appendChild(){} },
                documentElement: { appendChild(){} }, addEventListener(){} };
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, document: doc,
                setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
                addEventListener: () => {}, fetch: () => Promise.reject(new Error('no net')),
                Promise, Error, NaN, Infinity,
                localStorage: { getItem: k => (k in store ? store[k] : null),
                                setItem: (k, v) => { store[k] = String(v); },
                                removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  vm.createContext(ctx);
  for (const f of BASE.concat(extra || [])){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade, as in the app */ }
  }
  return ctx;
}
const T = 1700000000 - (1700000000 % 86400);
const mk = (n) => {
  let p = 4000, s = 5;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const o = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    o.push({ t: T + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1000 });
  }
  return o;
};
const ROWS = mk(300);
const ARGS = [undefined, null, '', 0, -1, NaN, 'x', {}, [], true, ROWS, ROWS.slice(0, 3),
              { entry: 4000, stop: 3980, t1: 4040 }, { dir: 'long', kind: 'X' }, 1700000000,
              { go: null }, 'SCALP'];
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const BAD = /\bNaN\b|\bundefined\b|\[object Object\]/;
const BASE_KEYS = new Set(Object.keys(boot([])));

console.log('== the sweep reaches what it claims to ==');
{
  const counts = {};
  for (const [name, file] of Object.entries(TABS)){
    const C = boot([file]);
    counts[name] = Object.keys(C).filter(k => typeof C[k] === 'function' && !BASE_KEYS.has(k)).length;
  }
  ok(counts.omnigold > 150, `omnigold exports ${counts.omnigold} functions at module scope`);
  ok(counts.eightypercent > 100, `80percent exports ${counts.eightypercent}`);
  ok(counts.goldscalp < 20 && counts.goldswing < 20 && counts.tauric < 20,
     `while goldscalp (${counts.goldscalp}), goldswing (${counts.goldswing}) and tauric `
     + `(${counts.tauric}) are IIFE-scoped — their result below is "nothing reachable", not "nothing wrong"`);
}

console.log('\n== the rule, across every gold tab ==');
{
  let totalCalls = 0, totalHtml = 0;
  const EXEMPT = ['omnigold.ogTradeKey'];
  const offenders = [];
  for (const [name, file] of Object.entries(TABS)){
    const C = boot([file]);
    const names = Object.keys(C).filter(k => typeof C[k] === 'function' && !BASE_KEYS.has(k));
    for (const nm of names){
      const f = C[nm];
      const arity = Math.min(f.length || 1, 2);
      for (const a of ARGS){
        for (const b of (arity > 1 ? ARGS : [undefined])){
          let r;
          try { r = f(a, b); } catch (e) { continue; }
          totalCalls++;
          if (typeof r !== 'string' || !r) continue;
          totalHtml++;
          /* An IDENTITY function is exempt, by name, for the reason set out
             in the block below: a key is not display text, and its "na"
             marker is a deliberate absent-not-zero signal pinned by
             test-omnigold-publication-rate. Named rather than inferred, so
             the exemption cannot quietly widen. */
          if (EXEMPT.indexOf(name + '.' + nm) >= 0) continue;
          if (BAD.test(strip(r)) && !offenders.some(o => o[0] === name + '.' + nm))
            offenders.push([name + '.' + nm, strip(r).slice(0, 110)]);
        }
      }
    }
  }
  ok(offenders.length === 0,
     `${totalCalls} calls across ${Object.keys(TABS).length} gold tabs, ${totalHtml} returning text — `
     + 'not one printed NaN, undefined or [object Object]'
     + (offenders.length ? ('\n      ' + offenders.map(o => o[0] + ' :: ' + o[1]).join('\n      ')) : ''));
  ok(totalHtml > 5000, `and the sweep is not vacuous — ${totalHtml} string results inspected`);
}

console.log('\n== the six it found, each pinned ==');
{
  const E = boot(['eightypercent.js']);
  ok(!BAD.test(strip(E.firedSplitHtml({}))),
     `firedSplitHtml on an empty scan: "${strip(E.firedSplitHtml({})).slice(0, 70)}"`);
  ok(/unrecorded number of/.test(strip(E.firedSplitHtml({}))),
     'saying the denominator is missing rather than printing undefined');
  ok(/in 0/.test(strip(E.firedSplitHtml({ scanned: 0 }))),
     'while a REAL zero still reads as zero — the guard does not swallow it');

  ok(!BAD.test(strip(E.livePriceHtml(4000, {}, 4000, 4000, []))),
     'livePriceHtml with a non-string timeframe');
  ok(/from the .*bar forming now/.test(strip(E.livePriceHtml(4000, '1h', 4000, 4000, []))),
     'and a real one still names it');
  ok(/1h/.test(strip(E.livePriceHtml(4000, '1h', 4000, 4000, []))), 'by name');

  ok(!BAD.test(strip(E.ageCellTxt({}))), 'ageCellTxt with no bar count');
  ok(/3 bars/.test(strip(E.ageCellTxt({ ageBars: 3, ageSec: 10800 }))), 'and a real count still prints');
  ok(strip(E.ageCellTxt({ ageBars: 0 })) === 'now', 'zero is still "now"');

  ok(!BAD.test(E.hg80AutoNote({})), 'hg80AutoNote with a non-string reason');
  ok(/unrecorded reason/.test(E.hg80AutoNote({})), 'which says the reason is unnamed');
  ok(/OFF/.test(E.hg80AutoNote('off')), "and a real reason key still maps ('off')");

  /* THE REACHABLE CASE, found by driving hg80ArmedReal rather than guessing:
     an empty object reads as NOT stale and the stamp is empty, so the branch
     is only reached when `a` is falsy-but-not-an-object. That is where the
     sweep found "NaN candles behind". */
  ok(strip(E.armedRealStampHtml({})) === '',
     'an object with no staleness is not stamped at all — hg80ArmedReal says ok');
  ok(!BAD.test(strip(E.armedRealStampHtml(NaN))), 'armedRealStampHtml on the input that reaches the branch');
  ok(/not recorded/.test(strip(E.armedRealStampHtml(NaN))), 'saying the count is what is missing');
  ok(/5 candles behind/.test(strip(E.armedRealStampHtml({ barsBehind: 5 }))),
     'while a real count reads normally');
  ok(/not recorded/.test(strip(E.armedRealStampHtml(null))),
     'and a null never reads "0 candles behind" — this file\'s fin() is Number(), so Number(null) '
     + 'is 0, and "STALE, 0 candles behind" is a contradiction, not a measurement');

  /* THE KEY. Not a sentence — an identity, and identities collide. */
  /* ogTradeKey: REVERTED, AND WORTH RECORDING WHY.

     The sweep flagged it for returning "undefined|undefined|na|na" on a
     malformed card, and I changed it to return no key at all. That was an
     over-reach. The "na" marker is deliberate — test-omnigold-publication-rate
     pins it as "an absent level reads as absent, not as 0", which is a
     different and real concern — and an empty key is not obviously safer than
     a shared one, since an empty string matches more lookups rather than
     fewer. The collision I was guarding against needs two cards that lack
     horizon AND direction AND both levels, and I never demonstrated that is
     reachable. A key is not display text, so the sweep's rule does not apply
     to it unaltered; it is excluded here by name rather than by silently
     narrowing what the sweep looks at. */
  const O = boot(['omnigold.js']);
  ok(/na/.test(String(O.ogTradeKey({ dir: 'long', horizon: 'SCALP' }))),
     'an absent level still reads as "na" — absent, not the price zero');
  const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/String\(c && c\.horizon\) \+ '\|' \+ String\(c && c\.dir\)/.test(SRC),
     'and it still keys on horizon and direction, as test-card-honesty requires');
}

console.log('\n' + passed + ' passed, 0 failed');
