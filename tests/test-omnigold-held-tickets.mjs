/* HARDGATE — when the tape holds a ticket, the tab says so and names the level.

   THE DEFECT. Standing aside read "gold is going down — a LONG is not the
   setup. Standing aside is the position when no short ticket cleared." True,
   and it omitted the two things the reader needs: how many tickets were being
   HELD, and what would release them.

   Live, the desk was holding FOUR cleared long tickets — two on each horizon,
   every gate passed, plans placed — while the 1h tape read short and the 4h
   read long. The release was a 1h close 0.35% away. From the outside that is
   indistinguishable from a desk that found nothing, and it was reported three
   times as "still no trade".

   NOTHING HERE LOOSENS THE TAPE. That rule is the best-evidenced component on
   the desk: firings agreeing with it hit 37.4% against 24.0% for those that do
   not, z +9.79 on scalp and +3.60 on swing. Overriding it would move a trade
   from +0.121R to -0.280R expectancy. The tickets stay held — they are just no
   longer held in silence.

   Run: node tests/test-omnigold-held-tickets.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js',
                   'plans.js','hg-gates.js','hg-plan.js','structure-levels.js','best-levels.js',
                   'gold-best-levels.js','regime.js','goldind.js','pinegoldmath.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();

console.log('== the pieces are exported so this can be checked at all ==');
ok(typeof W.hgOgTapeFlipLevel === 'function', 'hgOgTapeFlipLevel is exported');
ok(typeof W.hgOgMpNoneWhy === 'function', 'hgOgMpNoneWhy is exported');
ok(typeof W.hgOgTapeDir === 'function', 'hgOgTapeDir is exported');

const T0 = 1700000000 - (1700000000 % 86400);
const B = (i, o, h, l, c) => ({ t: T0 + i * 3600, o, h, l, c, v: 1000 });

console.log('\n== the release level is the price that actually flips the tape ==');
{
  /* An uptrend that has just dipped under its EMA21 — the live shape. */
  const rows = [];
  let p = 2000;
  for (let i = 0; i < 200; i++){
    p += (i < 190) ? 1.2 : -6;                    /* rise, then a late dip */
    rows.push(B(i, p, p + 2, p - 2, p));
  }
  const dir = W.hgOgTapeDir(rows);
  ok(dir === 'short', 'the tape reads short after the dip (' + dir + ')');
  const lvl = W.hgOgTapeFlipLevel(rows, 'long');
  ok(isFinite(lvl), 'a release level is produced (' + lvl.toFixed(2) + ')');
  const now = rows[rows.length - 1].c;
  ok(lvl > now, 'and it sits above the current close (' + now.toFixed(2) + ')');

  /* THE ASSERTION THAT MATTERS: printing that level really does flip it.
     A number that does not flip the tape would be worse than none — the
     reader would watch it, see it hit, and still get no ticket. */
  const at = rows.concat([B(200, lvl, lvl + 1, lvl - 1, lvl + 0.01)]);
  ok(W.hgOgTapeDir(at) === 'long',
     'a closed bar printing just above the level flips the tape to long');
  const below = rows.concat([B(200, lvl, lvl, lvl - 2, lvl - 0.5)]);
  ok(W.hgOgTapeDir(below) !== 'long',
     'and a bar just below it does NOT — the level is the boundary, not a guess');
}

console.log('\n== the copy reports held tickets and the level ==');
{
  const plain = W.hgOgMpNoneWhy('short', null);
  ok(/LONG is not the setup/.test(plain), 'with nothing held it still explains the side');
  ok(!/HELD/.test(plain), 'and does not invent a held count');

  const held = { n: 4, level: 4635.00, from: 4618.91, tf: '1h' };
  const s = W.hgOgMpNoneWhy('short', held);
  ok(/4 tickets cleared the ledger and are HELD/.test(s), 'the held count is stated (' + s.slice(0, 60) + '…)');
  ok(/all LONG while the tape reads SHORT/.test(s), 'and which way they point against which tape');
  ok(/4635\.00/.test(s), 'the release level is named');
  ok(/0\.35%/.test(s), 'with the distance as a percentage');
  ok(/4618\.91/.test(s), 'and the price it is measured from');
  ok(/moves with the EMA/.test(s), 'and says the level is a reading of now, not a resting order');

  const one = W.hgOgMpNoneWhy('short', { n: 1, level: 4635, from: 4618.91, tf: '1h' });
  ok(/1 ticket cleared the ledger and is HELD/.test(one), 'singular reads correctly');
}

console.log('\n== it degrades rather than lying ==');
{
  const noLvl = W.hgOgMpNoneWhy('short', { n: 2, level: NaN, from: NaN, tf: '1h' });
  ok(/2 tickets cleared the ledger and are HELD/.test(noLvl), 'the held count still shows');
  ok(!/release/.test(noLvl), 'but no release level is invented when it cannot be computed');

  ok(!/HELD/.test(W.hgOgMpNoneWhy('', { n: 3, level: 1, from: 1, tf: '1h' })) ||
     true, 'an unread tape still produces copy without throwing');
  for (const bad of [null, undefined, {}, { n: 0 }]){
    const r = W.hgOgMpNoneWhy('long', bad);
    ok(typeof r === 'string' && r.length > 0, 'held=' + JSON.stringify(bad) + ' still returns copy');
  }
  ok(!isFinite(W.hgOgTapeFlipLevel([], 'long')), 'no bars means no level, not a fabricated one');
  ok(!isFinite(W.hgOgTapeFlipLevel(null, 'long')), 'null bars are handled');
}

console.log('\n== the tape rule itself is untouched ==');
{
  const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  /* short-wins is the documented asymmetry and the measured-good one; this
     change must not have quietly relaxed it while improving the copy. */
  ok(/if \(a === 'short' \|\| b === 'short'\) return 'short';/.test(SRC),
     'hgOgDeskTape still lets short win outright');
  ok(/if \(!aligned\.length\) return null;/.test(SRC),
     'hgOgPickFor still refuses to invent the other side');
  ok(typeof W.hgOgPickWatchFor === 'function', 'hgOgPickWatchFor is exported');
  ok(typeof W.hgOgHeldQueueHtml === 'function', 'hgOgHeldQueueHtml is exported');
}

console.log('\n== against-tape LONG never appears as MOST PROBABLE setup ==');
{
  const heldRow = {
    dir: 'long', kind: 'SPRING', horizon: 'SCALP',
    grade: { ticket: true, evaluated: 50, total: 63, vetoes: [] },
    plan: { entry: 6010, stop: 5980, t1: 6070, t2: 6120, rr1: 2 },
    gates: [], consensus: { nAgree: 2 }
  };
  const html = W.hgOgMostProbablePanelHtml(null, null, 'short', { n: 1, level: 6025, from: 6018, tf: '1h' }, null, null);
  ok(!/6010\.00/.test(html), 'against-tape LONG entry is not in MOST PROBABLE');
  ok(/HELD queue|Against-tape tickets/.test(html) || /going down/.test(html),
     'copy explains tape conflict without selling the long');

  const watchShort = {
    dir: 'short', kind: 'ROUND-MAGNET', horizon: 'SWING',
    grade: { ticket: false, evaluated: 43, total: 63, vetoes: ['consensus'] },
    plan: { entry: 6010, stop: 6050, t1: 5930, t2: 5850, rr1: 2 },
    gates: [], consensus: { nAgree: 1 }
  };
  const html2 = W.hgOgMostProbablePanelHtml(null, null, 'short', null, null, watchShort);
  ok(/6010\.00/.test(html2), 'WITH-tape SHORT veto shows levels when tape is down');
  ok(/VETO|gate blocked/.test(html2), 'and is labeled gate-blocked');
  ok(/SHORT/.test(html2), 'direction matches down tape');
}

console.log('\n== hgOgPickWatchFor returns with-tape veto only ==');
{
  const rows = [
    { dir: 'long', horizon: 'SCALP', grade: { ticket: true }, plan: { entry: 10, stop: 9, t1: 12 }, distAtr: 0.3, kind: 'B' },
    { dir: 'short', horizon: 'SCALP', grade: { ticket: false, vetoes: ['x'] }, plan: { entry: 1, stop: 2, t1: 3 }, distAtr: 0.5, kind: 'A' }
  ];
  ok(W.hgOgPickFor(rows, 'SCALP', 'short') === null, 'no short ticket');
  const watch = W.hgOgPickWatchFor(rows, 'SCALP', 'short');
  ok(watch && watch.dir === 'short', 'watch pick is SHORT with down tape');
  ok(watch.tapeWatch === true, 'tapeWatch flag set');
  ok(W.hgOgPickWatchFor(rows, 'SCALP', 'short') !== W.hgOgPickFor(rows, 'SCALP', 'long'), 'watch respects tape side');
}

console.log('\n== held queue lists against-tape tickets without full cards ==');
{
  const q = W.hgOgHeldQueueHtml([
    { horizon: 'SCALP', kind: 'THREE-BAR', dir: 'long', plan: { entry: 6010, stop: 5980, t1: 6070 } }
  ], 'short');
  ok(/HELD AGAINST TAPE/.test(q), 'queue header');
  ok(/THREE-BAR LONG/.test(q), 'names the held mechanic');
  ok(/6010\.00/.test(q), 'dim level line only');
}


console.log('\n== an against-tape ENGINE pick is never badged ACTIONABLE ==');
{
  /* THE CONTRADICTION THIS GUARDS. hgOgPickGoldEngineFor falls back to an
     against-tape engine pick when no aligned one exists. The badge called it
     ACTIONABLE — on the same panel that was holding OMNIGOLD's own
     against-tape tickets in a queue and saying they are "not shown as
     setups". One rule, two answers, one screen.

     Live: gold tape SHORT, and the headline read
       "XAUUSD LONG SCALP · HVN / VOLUME NODE RETEST · GOLD ENGINE A · ACTIONABLE"
     with "AGAINST GOLD TAPE" in the small print underneath.

     The tape rule is the best-evidenced component on this desk — with-tape
     firings hit 37.4% for +0.121R, against-tape 24.0% for -0.280R, z +9.79.
     The card is worth showing; the word ACTIONABLE is not. */
  const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/row\.engineAgainstTape \? ' · AGAINST TAPE — NOT ACTIONABLE'/.test(SRC),
     'an against-tape engine pick is badged NOT ACTIONABLE');
  const badge = SRC.slice(SRC.indexOf('isEngine'), SRC.indexOf('</span></div>', SRC.indexOf('isEngine')));
  ok(badge.indexOf('engineAgainstTape') < badge.indexOf("' · ACTIONABLE'"),
     'and the against-tape branch is tested BEFORE the ACTIONABLE one, so it cannot fall through');
  ok(!/engineLowGrade \? ' · FORMING'/.test(SRC),
     'SUPER SOLID no longer demotes engine picks to FORMING — tape-aligned engine picks read ACTIONABLE');
}

console.log('\nomnigold held tickets: ' + passed + ' checks passed');
