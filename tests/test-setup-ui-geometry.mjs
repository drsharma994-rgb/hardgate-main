/* HARDGATE — the geometry verdict reaches the shared cards.

   The MOST PROBABLE panel is pinned by 29 tabs. hgSetupCardHTML draws the
   scanner cards. hgSetupPanelHTML draws PINE, the nine PINE sub-tabs and
   GOLD PINE. Between them they are how most of this app shows a plan, and
   until now all three drew ENTRY / STOP / T1 / T2 with no idea whether
   price had already walked through them.

   These tests drive the real renderers — not a reimplementation — and
   assert on the HTML a reader would actually see.

   Run: node tests/test-setup-ui-geometry.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

/* setup-ui.js injects styles into a document; a stub is enough for it to
   load and for every renderer under test, none of which touch the DOM. */
const styleEl = { id: '', textContent: '' };
const doc = {
  getElementById: () => null,
  createElement: () => ({ ...styleEl }),
  querySelector: () => null,
  querySelectorAll: () => [],
  head: { appendChild(){} },
  body: { appendChild(){} }
};
const ctx = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
              JSON, Date, RegExp, document: doc, setTimeout: () => 0, clearTimeout: () => {} };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'plans.js', 'hg-plan.js', 'setup-ui.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}

const DEAD = { sym: 'XAUUSD', dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51, t2: 4276.81 };
const DEAD_MARK = 4282.70;          /* T1 sits between this and the entry */
const BREACH_MARK = 4340.00;        /* above the stop: the short already lost */
const FINE_MARK = 4320.00;          /* above the entry, below the stop — a real retest */

const said = (html) => /TARGET BEHIND PRICE|STOP ALREADY BREACHED/.test(html);

console.log('== MOST PROBABLE — the panel 29 tabs pin ==');
{
  const mp = ctx.hgMostProbablePanelHTML;
  const dead = mp('swing', { tier: 'clean', row: { ...DEAD, mark: DEAD_MARK } });
  ok(dead.indexOf('MOST PROBABLE') > -1, 'the panel still renders');
  ok(/TARGET BEHIND PRICE/.test(dead), 'and now says the target is behind price');
  ok(/class="hg-mp-geo"/.test(dead), 'in the panel\'s own styling, not a borrowed class');
  ok(dead.indexOf('4316.20') > -1, 'while still printing the entry it is judging');

  const fine = mp('swing', { tier: 'clean', row: { ...DEAD, mark: FINE_MARK } });
  ok(fine.indexOf('MOST PROBABLE') > -1, 'a live plan renders the same panel');
  ok(!said(fine), 'with no verdict on it');
  ok(!/hg-mp-geo/.test(fine), 'and no empty box where the verdict would go');

  const breached = mp('swing', { tier: 'clean', row: { ...DEAD, mark: BREACH_MARK } });
  ok(/STOP ALREADY BREACHED/.test(breached), 'price through the stop is named as that, not as a crossed target');

  const blind = mp('swing', { tier: 'clean', row: { ...DEAD } });
  ok(blind.indexOf('MOST PROBABLE') > -1, 'a row with no mark still renders its panel');
  ok(!said(blind), 'and makes no claim it cannot support');
}

console.log('\n== the panel judges the T1 it actually printed ==');
{
  /* suOrderRunner can swap T1 and T2 when a desk hands them over inverted.
     The verdict has to judge the level on the card, not the one that came
     in, or the card and its warning would disagree with each other. */
  const mp = ctx.hgMostProbablePanelHTML;
  const html = mp('swing', { tier: 'clean', row: { ...DEAD, mark: DEAD_MARK } });
  const shownT1 = /<i>T1<\/i><b>([\d.]+)<\/b>/.exec(html);
  ok(shownT1, 'the panel prints a T1');
  const g = ctx.hgPlanMarketGeometry({ dir: 'short', entry: DEAD.entry, stop: DEAD.stop, t1: +shownT1[1] }, DEAD_MARK);
  ok(g && g.code === 'target-crossed', 'and the verdict on the card matches the T1 on the card');
}

console.log('\n== scanner cards ==');
{
  const card = ctx.hgSetupCardHTML;
  const dead = card({ tier: 'near', sym: 'XAUUSD', dir: 'short', entry: DEAD.entry, stop: DEAD.stop,
                      t1: DEAD.t1, mark: DEAD_MARK, plan: 'ENTRY 4316.20' });
  ok(/TARGET BEHIND PRICE/.test(dead), 'a scanner card carries the verdict too');
  const fine = card({ tier: 'near', sym: 'XAUUSD', dir: 'short', entry: DEAD.entry, stop: DEAD.stop,
                      t1: DEAD.t1, mark: FINE_MARK, plan: 'ENTRY 4316.20' });
  ok(!said(fine), 'and stays quiet on a live one');

  /* setup.plan is a STRING on this renderer — it is pre-rendered HTML, not
     a plan object. Reading a mark off it must not throw or invent one. */
  const strPlan = card({ tier: 'near', sym: 'X', dir: 'long', entry: 100, stop: 95, t1: 110,
                         plan: '<b>ENTRY 100</b>' });
  ok(typeof strPlan === 'string' && strPlan.indexOf('ENTRY 100') > -1, 'a string plan renders unharmed');
  ok(!said(strPlan), 'and produces no verdict out of thin air');
}

console.log('\n== PINE panels, and the stale-price trap ==');
{
  const panel = ctx.hgSetupPanelHTML;
  const sig = { sym: 'XAUUSD', dir: 'short', entry: DEAD.entry, stop: DEAD.stop, t1: DEAD.t1, t2: DEAD.t2 };

  const fresh = panel({ ...sig, isNew: true, barsAgo: 0, price: DEAD_MARK });
  ok(/TARGET BEHIND PRICE/.test(fresh), 'a fresh signal is judged against its own bar close');

  /* pinemath sets price = closes[bi], the close of the bar that SIGNALLED.
     Four bars later that is not price now, and a verdict built on it would
     describe where price was. */
  const stale = panel({ ...sig, isRecent: true, barsAgo: 4, price: DEAD_MARK });
  ok(!said(stale), 'a RECENT signal is NOT judged against a four-bar-old close');
  ok(stale.indexOf('4316.20') > -1, 'though the panel still renders its plan in full');

  const staleButKnown = panel({ ...sig, isRecent: true, barsAgo: 4, price: 9999, mark: DEAD_MARK });
  ok(/TARGET BEHIND PRICE/.test(staleButKnown), 'a RECENT signal that carries a real mark IS judged');

  const fine = panel({ ...sig, isNew: true, barsAgo: 0, price: FINE_MARK });
  ok(!said(fine), 'and a live plan gets no verdict');
}

console.log('\n== absent stays absent ==');
{
  /* repo rule: an absent value must never render as a number, and that
     applies to a verdict as much as to a price */
  const mp = ctx.hgMostProbablePanelHTML;
  for (const mark of [null, undefined, 0, NaN, '', 'n/a']){
    const html = mp('swing', { tier: 'clean', row: { ...DEAD, mark } });
    /* String(), not JSON.stringify() — the latter turns NaN into "null" and
       would print two identical-looking cases */
    ok(!said(html), 'mark ' + (mark === '' ? '(empty string)' : String(mark)) + ' yields no verdict');
  }
}

console.log('\n== the renderers survive a missing rule ==');
{
  /* hg-plan.js is loaded after plans.js in the browser; a renderer that
     ran before it must degrade to the old markup, not throw. */
  const bare = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
                 JSON, Date, RegExp, document: doc, setTimeout: () => 0, clearTimeout: () => {} };
  bare.window = bare; bare.globalThis = bare;
  vm.createContext(bare);
  for (const f of ['indicators.js', 'plans.js', 'setup-ui.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), bare, { filename: f });
  }
  ok(typeof bare.hgPlanGeometryLineHtml !== 'function', 'the rule really is absent in this context');
  const html = bare.hgMostProbablePanelHTML('swing', { tier: 'clean', row: { ...DEAD, mark: DEAD_MARK } });
  ok(html.indexOf('MOST PROBABLE') > -1, 'and the panel renders anyway');
  ok(!said(html), 'just without the verdict it cannot compute');
}

console.log('\n' + passed + ' passed, 0 failed');
