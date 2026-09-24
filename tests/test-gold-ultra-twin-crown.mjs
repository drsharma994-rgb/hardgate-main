/* HARDGATE — GOLD ULTRA crowned a mechanic the other gold desks refuse to promote.

   hg-v943 measured that several mechanics on the gold tabs are WIRED OMNIGOLD
   mechanics, so each carries TWO records, and for two of them the records
   disagree in sign with the tab holding the smaller sample. `p9volbar` is one:
   the tab row reads +0.155R on n=72, its exact twin P9-VOLBAR reads -0.499R on
   n=274, z=-2.97 — past the EDGE_VETO_Z of -2 at which OMNIGOLD refuses to
   ticket a mechanic at all. v943 withholds the promotion for exactly that.

   GOLD ULTRA went on CROWNING it. Its `crownable` requires book==='prefer',
   and its prefer book was a HAND-TYPED copy of goldind's table — under a
   comment naming that table as the source. Two desks, one mechanic, one body
   of evidence, opposite answers.

   What this file pins:
     - the prefer book is READ from HG_GOLD_SETUP_EDGE.scalp, so a re-bake
       moves it with no edit here;
     - it FAILS CLOSED: no table, no prefer book, nothing crowned;
     - GU_SHOWN_EXTRA is NOT derived, is said not to be, and its members must
       still exist and not be suppressed;
     - a prefer row whose exact twin is past the bar is SHOWN but NOT CROWNED;
     - the crown is ALL that is withheld — levels, board place, everything else
       is untouched;
     - it FAILS OPEN: an absent verdict reader never withholds a crown;
     - the card says why, naming the twin and both samples.

   Run: node tests/test-gold-ultra-twin-crown.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };
const src = (f) => fs.readFileSync(root + f, 'utf8');

function deskContext(files){
  const ctx = vm.createContext({ Math, Date, JSON, isFinite, isNaN, parseFloat, parseInt,
    Array, Object, String, Number, RegExp, Float64Array, Infinity, NaN,
    console: { log(){}, warn(){}, error(){} },
    setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    document: { getElementById: () => null,
      createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                              querySelector: () => null, querySelectorAll: () => [] }),
      querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
      documentElement: { appendChild(){} }, addEventListener(){} } });
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  for (const f of files){ try { vm.runInContext(src(f), ctx, { filename: f }); } catch (e) {} }
  return ctx;
}
const FULL = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
  'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'structure-levels.js',
  'best-levels.js', 'gold-best-levels.js', 'regime.js', 'milligold.js',
  'gold-extra-strategies.js', 'omnigold.js', 'goldind.js', 'goldultra.js'];

/* a candidate shaped the way guNorm leaves them: complete, legal sides, and
   AGAINST consensus, which is the only confluence this desk crowns */
const cand = (key, over) => Object.assign({
  strategy: key.toUpperCase(), stratKey: key, dir: 'long',
  entry: 4400, stop: 4380, t1: 4440, t2: 4470,
  demoted: false, vetoed: false, tally: 8, confScore: 90, stamps: []
}, over || {});
/* guConfluence returns AGAINST only on a DECISIVE count leading the other way
   (decisive >= minAvail, pct >= x). Passing 0 gives NEUTRAL, which is never
   crowned for reasons that have nothing to do with this pack — the fixture has
   to agree with the setup it claims to be testing. */
const AGAINST = { decisive: 40, pct: 0.7, lead: 'short' };

console.log('\n1. the prefer book is READ from the table, not transcribed');
{
  const ctx = deskContext(FULL);
  const tbl = ctx.HG_GOLD_SETUP_EDGE && ctx.HG_GOLD_SETUP_EDGE.scalp;
  ok(!!tbl, 'goldind exposes the scalp edge table');
  const fromTable = Object.keys(tbl).filter((k) => tbl[k] && tbl[k].action === 'prefer').sort();
  const fromDesk = ctx.goldUltraPreferKeys().slice().sort();
  ok(fromDesk.length > 0 && fromDesk.join(',') === fromTable.join(','),
     'guPreferKeys() equals the table\'s action:\'prefer\' rows (' + fromDesk.join(', ') + ')');
  ok(!/var GU_PREFER =/.test(src('goldultra.js')),
     '  and no hand-typed copy of that answer is left in the file');

  /* LIVE: move the table and the book moves, which a copy cannot do */
  const victim = fromTable[0];
  tbl[victim].action = 'neutral';
  ok(ctx.goldUltraPreferKeys().indexOf(victim) < 0,
     '  a re-bake demoting ' + victim + ' removes it here with no edit');
  tbl.__probe = { action: 'prefer', n: 99, net: 0.5 };
  ok(ctx.goldUltraPreferKeys().indexOf('__probe') >= 0,
     '  and a re-bake promoting a new row adds it');
  delete tbl.__probe; tbl[victim].action = 'prefer';
  ok(ctx.goldUltraPreferKeys().indexOf(victim) >= 0, '  restored');
}

console.log('\n2. it FAILS CLOSED — no table, no prefer book, no crown');
{
  /* goldind absent. The desk's whole thesis is "these are the GOLD SCALP
     prefer rows"; crowning from a stale local list with the source gone is
     worse than crowning nothing (hg-v938). */
  const ctx = deskContext(FULL.filter((f) => f !== 'goldind.js'));
  ok(ctx.goldUltraPreferKeys().length === 0,
     'with the edge table unreadable the prefer book is EMPTY');
  const sel = ctx.goldUltraSelectSetups([cand('p6fail')], AGAINST);
  ok(sel.cards.length === 1, '  the setup still forms and is still shown');
  ok(sel.cards[0].book === 'other' && !sel.cards[0].crownable && !sel.pick,
     '  but nothing is crowned — it does not fall back to a shipped list');
}

console.log('\n3. GU_SHOWN_EXTRA is not derived, and says so');
{
  const ctx = deskContext(FULL);
  const tbl = ctx.HG_GOLD_SETUP_EDGE.scalp;
  ok(Array.isArray(ctx.GU_SHOWN_EXTRA) && ctx.GU_SHOWN_EXTRA.length > 0,
     'the shown-but-never-crowned extras are an explicit named list');
  for (const k of ctx.GU_SHOWN_EXTRA){
    ok(!!tbl[k], '  ' + k + ' still exists in the edge table');
    ok(tbl[k].action !== 'suppress',
       '  and is not suppressed — a re-bake turning it toxic is caught here');
  }
  const shown = ctx.goldUltraShownKeys();
  ok(ctx.goldUltraPreferKeys().every((k) => shown.indexOf(k) >= 0),
     '  shown is a superset of prefer, as the tiering assumes');
}

console.log('\n4. a prefer row whose twin is past the bar is SHOWN, not CROWNED');
{
  const ctx = deskContext(FULL);
  const v = ctx.hgGoldTwinVerdict && ctx.hgGoldTwinVerdict('p9volbar');
  ok(v && v.vetoed === true && v.twin === 'P9-VOLBAR',
     'p9volbar\'s twin really is past the bar (n=' + (v && v.n) + ', z='
       + (v && v.z.toFixed(2)) + ')');
  ok(ctx.goldUltraPreferKeys().indexOf('p9volbar') >= 0,
     '  and it really is a prefer row on this desk\'s book');

  const sel = ctx.goldUltraSelectSetups([cand('p9volbar')], AGAINST);
  const c = sel.cards[0];
  ok(sel.cards.length === 1 && c.book === 'prefer',
     'it keeps its prefer tier — the book is not rewritten');
  ok(c.crownable === false && !sel.pick, '  and it is NOT crowned');
  ok(c.twinVeto && c.twinVeto.twin === 'P9-VOLBAR',
     '  carrying the verdict that withheld it, for the card to print');
  /* THE CROWN AND NOTHING ELSE */
  ok(c.entry === 4400 && c.stop === 4380 && c.t1 === 4440,
     '  levels untouched — the crown is all that is withheld (hg-v943)');
  ok(c.demoted !== true && c.vetoed !== true,
     '  it is not demoted and not vetoed by this');

  /* the clean prefer row still crowns, so this is not a blanket veto */
  const sel2 = ctx.goldUltraSelectSetups([cand('p6fail')], AGAINST);
  ok(ctx.goldUltraPreferKeys().indexOf('p6fail') >= 0
     && !(ctx.hgGoldTwinVerdict('p6fail') || {}).vetoed,
     'p6fail\'s twin is NOT past the bar');
  ok(sel2.cards[0].crownable === true && sel2.pick === sel2.cards[0],
     '  and it is still crowned — the rule is specific, not blanket');
}

console.log('\n5. it FAILS OPEN — an absent verdict reader never withholds');
{
  const ctx = deskContext(FULL);
  ctx.hgGoldTwinVerdict = undefined;
  const sel = ctx.goldUltraSelectSetups([cand('p9volbar')], AGAINST);
  ok(sel.cards[0].crownable === true && !sel.cards[0].twinVeto,
     'with no reader the crown stands — a missing verdict is not a negative one');
  ctx.hgGoldTwinVerdict = () => { throw new Error('boom'); };
  const sel2 = ctx.goldUltraSelectSetups([cand('p9volbar')], AGAINST);
  ok(sel2.cards[0].crownable === true, '  and a throwing reader costs nothing');
}

console.log('\n5b. hg-v943\'s lever reverses it here too — ONE switch, not two');
{
  const ctx = deskContext(FULL);
  ok(ctx.goldUltraSelectSetups([cand('p9volbar')], AGAINST).cards[0].crownable === false,
     'on by default, as on GOLD SCALP and GOLD SWING');
  ctx.hgGoldSetTwinCheck(false);
  const off = ctx.goldUltraSelectSetups([cand('p9volbar')], AGAINST).cards[0];
  ok(off.crownable === true && !off.twinVeto,
     '  hgGoldSetTwinCheck(false) restores the crown — the same call, not a new one');
  ctx.hgGoldSetTwinCheck(true);
  ok(ctx.goldUltraSelectSetups([cand('p9volbar')], AGAINST).cards[0].crownable === false,
     '  and turning it back on withholds it again');
}

console.log('\n6. the card says WHY the crown was withheld');
{
  const ctx = deskContext(FULL);
  const sel = ctx.goldUltraSelectSetups([cand('p9volbar')], AGAINST);
  const html = String(ctx.goldUltraSetupCardHTML(sel.cards[0], 4400, false));
  ok(/CROWN WITHHELD/.test(html), 'the card carries a CROWN WITHHELD chip');
  ok(/P9-VOLBAR/.test(html), '  naming the twin');
  ok(/n=274/.test(html), '  with the twin\'s sample, not just a verdict');
  ok(/OMNIGOLD/.test(html) && /1h horizon/.test(html),
     '  attributing the record to OMNIGOLD\'s gates and its horizon');
  ok(/still forms/.test(html) && /keeps its levels/.test(html),
     '  and saying plainly that nothing else is withheld');

  const clean = String(ctx.goldUltraSetupCardHTML(
    ctx.goldUltraSelectSetups([cand('p6fail')], AGAINST).cards[0], 4400, true));
  ok(!/CROWN WITHHELD/.test(clean),
     '  and a row that was not withheld says nothing about it');
}

console.log('\n' + passed + ' assertions passed');
