#!/usr/bin/env node
/* HARDGATE — the 80PERCENT ladder.
   =================================

   hg-v772 took the tab from one timeframe to five. This tests the part that
   is new, and it exists because the change had exactly one way to go wrong:
   quietly loosening the strategy to make setups appear.

   So the assertions here are mostly NEGATIVE. The four conditions must be
   the same four at every rung; the thresholds must be the supplied ones at
   every rung; the one rule that genuinely cannot apply at 4h and 1d must be
   dropped BY ARITHMETIC, announced, and dropped nowhere else.

   The other half is the thing the user actually asked for: that the tab is
   populated. A tab that renders an empty panel because nothing fired is a
   tab that has failed, so the render is exercised against a series where
   NOTHING fires and asserted to still carry the ladder board, the distance
   to fire, and the arithmetic.
*/
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);

const store = {};
const el = () => ({ style: {}, innerHTML: '', textContent: '', className: '',
  classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
  appendChild(){}, setAttribute(){}, addEventListener(){},
  querySelector: () => null, querySelectorAll: () => [], dataset: {} });
const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
              parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Infinity, NaN,
              Float64Array, setTimeout: fn => { fn(); return 0; }, clearTimeout: () => {},
              localStorage: { getItem: k => (k in store ? store[k] : null),
                              setItem: (k, v) => { store[k] = String(v); },
                              removeItem: k => { delete store[k]; } } };
ctx.document = { createElement: el, getElementById: () => null, querySelector: () => null,
                 querySelectorAll: () => [], head: el(), body: el(), documentElement: el(),
                 addEventListener(){}, readyState: 'complete' };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                 'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js',
                 'omnigold.js', 'eightypercent.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade */ }
}
const SRC = fs.readFileSync(path.join(ROOT, 'eightypercent.js'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
/* comments AND string literals stripped: what is left is only logic, so a
   regex looking for arithmetic cannot be fooled by display copy */
const LOGIC = CODE.replace(/'(\\.|[^'\\])*'/g, "''");

/* A series that MUST fire a long on its last bar, on any timeframe: a long
   uptrend (EMA50 > EMA200, close > EMA50), a run of red bars to drive RSI
   under 45, one green trigger. `endUtc` anchors the last bar's open hour so
   the session filter can be aimed deliberately. */
function series(n, o){
  o = o || {};
  const tfSec = o.tfSec == null ? 300 : o.tfSec;
  const endHour = o.endHour == null ? 15 : o.endHour;
  const base = Date.UTC(2026, 8, 16, endHour, 0, 0) / 1000 - (n - 1) * tfSec;
  const rows = [];
  let px = o.start == null ? 4000 : o.start;
  const up = o.down ? -1 : 1;
  const tail = o.tail == null ? 0 : o.tail;
  const trig = n - 1 - tail;
  for (let i = 0; i < n; i++){
    const t = base + i * tfSec;
    const oo = px;
    let c;
    if (i < trig - 7)      c = px + 1.2 * up;      /* the trend */
    else if (i < trig)     c = px - 2.6 * up;      /* the pullback */
    else if (i === trig)   c = px + 1.4 * up;      /* the trigger */
    /* the tail closes the WRONG way, so it fails the candle-direction
       trigger and cannot fire — and moves too little to resolve anything.
       That is what makes the trigger bar the LATEST firing rather than the
       last one, which is the normal case this file is about. */
    else                   c = px - 0.02 * up;
    rows.push({ t, o: oo, h: Math.max(oo, c) + 0.4, l: Math.min(oo, c) - 0.4, c, v: 100 });
    px = c;
  }
  return rows;
}

console.log('== the ladder is declared, ordered, and spans both bands ==');
{
  const L = ctx.HG_P80_LADDER;
  ok(Array.isArray(L) && L.length >= 4, `the ladder is published (${L.length} rungs)`);
  ok(L.some(r => r.band === 'scalp') && L.some(r => r.band === 'swing'),
     'covering scalp AND swing, which is what the tab was asked for');
  const secs = L.map(r => r.sec);
  ok(secs.every((v, i) => i === 0 || v > secs[i - 1]), 'ordered shortest to longest');
  ok(L.every(r => r.bars > 200 + 40),
     'every rung asks for more bars than EMA200 eats, so each has a real scan window');
  ok(L.some(r => r.tf === ctx.HG_P80_SPEC.tf),
     'and the spec\'s own timeframe is one of the rungs, not replaced by them');
}

console.log('\n== the session rule is dropped by arithmetic, and only where it cannot apply ==');
{
  const A = ctx.hg80SessionApplies;
  ok(A(300) === true && A(900) === true && A(3600) === true,
     '5m, 15m and 1h bars can sit wholly inside 13:00-18:00 UTC');
  ok(A(14400) === false,
     '4h cannot: its aligned opens are 00/04/08/12/16/20 and 12:00 starts early, 16:00 ends late');
  ok(A(86400) === false, 'and a daily bar is longer than the five-hour window');
  /* length alone does not decide it — ALIGNMENT does, and that is the whole
     point of computing this instead of eyeballing it. A five-hour bar is
     exactly the width of the window and still cannot sit inside it, because
     its opens fall at 00:00/05:00/10:00/15:00/20:00 UTC and none of those is
     13:00. A 2h30m bar is narrower and DOES fit, at 13:00 and 15:30. */
  ok(A(18000) === false,
     'a bar exactly as wide as the window still misses it — its opens land at 10:00 and 15:00');
  ok(A(9000) === true, 'while a 2h30m bar fits twice over, at 13:00 and 15:30');
  ok(A(7200) === true, 'and a 2h bar fits at 14:00 and again at 16:00');
  ok(A(0) === false && A(-1) === false && A(NaN) === false,
     'and a nonsense timeframe drops it rather than throwing');
  ok(!/case\s*'4h'|tf\s*===\s*'4h'|\[\s*'4h'\s*,\s*'1d'\s*\]/.test(CODE),
     'no hand-written list of exempt timeframes — the seconds decide, so a new rung cannot drift');
}

console.log('\n== the four conditions are the same four at every rung ==');
{
  ok((CODE.match(/rs\s*<\s*P80_RSI_LONG/g) || []).length === 1,
     'the long pullback threshold is read in exactly one place');
  ok((CODE.match(/rs\s*>\s*P80_RSI_SHORT/g) || []).length === 1, 'and the short one likewise');
  /* A regex hunting for arithmetic on the thresholds cannot tell display
     copy from logic, and the header legitimately prints 45 and 55. So this
     is asserted STRUCTURALLY instead, which is stronger: a rung's config is
     the ONLY thing that varies between timeframes, and if it carries no
     threshold and no multiple then no rung can change one. */
  const cfgKeys = Object.keys(ctx.hg80Cfg({ tf: '4h', sec: 14400, band: 'swing' })).sort();
  ok(cfgKeys.join(',') === 'band,session,tf,tfSec',
     `a rung's config is exactly {${cfgKeys.join(', ')}} — no threshold, no multiple, no target`);
  ok(cfgKeys.every(k => !/rsi|atr|tp|sl|ema/i.test(k)),
     'so there is no channel through which a rung could loosen the strategy');

  /* and proved by running it: same bars, same session answer, absurd
     seconds — every condition must come out identically */
  {
    const rows = series(280, { tfSec: 300, endHour: 15 });
    const ind = ctx.hg80Indicators(rows);
    const a = ctx.hg80SignalAt(rows, ind, rows.length - 1, { tf: '5m', tfSec: 300, session: true });
    const b = ctx.hg80SignalAt(rows, ind, rows.length - 1, { tf: 'X', tfSec: 999999, session: true });
    ok(a.dir === b.dir && a.dir === 'long', 'both configs fire the same direction');
    ok(JSON.stringify(a.longChecks) === JSON.stringify(b.longChecks)
       && JSON.stringify(a.shortChecks) === JSON.stringify(b.shortChecks),
       'and every named condition agrees — the timeframe decides which bars, never which rules');
  }

  const cfg5 = ctx.hg80Cfg({ tf: '5m', sec: 300 });
  const cfg1d = ctx.hg80Cfg({ tf: '1d', sec: 86400 });
  ok(cfg5.session === true && cfg1d.session === false, 'a rung carries only its session answer');
  ok(ctx.hg80Cfg(null).tf === ctx.HG_P80_SPEC.tf && ctx.hg80Cfg(null).tfSec === 300,
     'and the default config is the spec\'s own 5m, so every pre-ladder caller is unchanged');
}

console.log('\n== the dropped rule changes ONE thing: whether the session gate runs ==');
{
  /* 04:00 UTC — dead outside the window. At 5m that kills it. At 1d the
     window is inapplicable, so the same bars fire. Nothing else differs. */
  const rows = series(280, { tfSec: 86400, endHour: 4 });
  const ind = ctx.hg80Indicators(rows);
  const as5m = ctx.hg80SignalAt(rows, ind, rows.length - 1, ctx.hg80Cfg({ tf: '5m', sec: 300 }));
  const as1d = ctx.hg80SignalAt(rows, ind, rows.length - 1, ctx.hg80Cfg({ tf: '1d', sec: 86400 }));

  ok(as5m.longChecks.session === false && as5m.dir === null,
     'read as 5m, a 04:00 bar fails the session gate and fires nothing');
  ok(!('session' in as1d.longChecks),
     'read as 1d, the session key is ABSENT — not a green chip for a rule that never ran');
  ok(as1d.dir === 'long', 'and the identical bar fires');
  for (const k of ['trend', 'pullback', 'trigger']){
    ok(as5m.longChecks[k] === as1d.longChecks[k],
       `${k} is decided identically at both rungs — only the session gate differs`);
  }
  ok(ctx.hg80Score(as5m.longChecks).total === 4 && ctx.hg80Score(as1d.longChecks).total === 3,
     'so the card can say "3 needed" at 1d and "4 needed" at 5m, honestly');
}

console.log('\n== the deviation is announced, not buried ==');
{
  ok(/not applied at/.test(SRC), 'the card states the filter was not applied');
  ok(/stated deviation from the spec/.test(SRC), 'and names it a deviation from the spec');
  ok(/rather than a rule that passed/.test(SRC),
     'explicitly distinguishing it from a rule that was satisfied');
  ok(/Three conditions ran here, not four/.test(SRC), 'and says how many conditions actually ran');
}

console.log('\n== resolution: the tab owns it, and the walk uses the tab\'s copy ==');
{
  ok(typeof ctx.hg80Resolve === 'function', 'hg80Resolve is exported from the tab');
  const WALK = fs.readFileSync(path.join(ROOT, 'scripts/walk-80percent.mjs'), 'utf8');
  ok(/hg80Resolve/.test(WALK), 'and the walk calls it');
  const wcode = WALK.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/const\s+gapS\s*=|hitT\s*&&\s*hitS/.test(wcode),
     'with no second copy of the exit rule left behind in the walk');

  const P = { dir: 'long', entry: 100, t1: 102, stop: 92 };
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c });
  const seed = [bar(0, 99, 100.2, 98.8, 100)];
  const win = ctx.hg80Resolve(seed.concat([bar(300, 100, 102.5, 99, 102)]), 0, P, 50);
  ok(win.outcome === 'win' && near(win.exit, 102), 'a bar reaching the target wins, filled AT it');
  const gap = ctx.hg80Resolve(seed.concat([bar(300, 89, 90, 88, 88.5)]), 0, P, 50);
  ok(gap.gapped === true && gap.rMultiple < -1,
     `a gap through the stop fills at the open and costs ${gap.rMultiple.toFixed(4)}R — worse than -1R`);
  const amb = ctx.hg80Resolve(seed.concat([bar(300, 100, 103, 91, 95)]), 0, P, 50);
  ok(amb.ambiguous === true && amb.outcome === 'win',
     'and a bar covering both levels is flagged, not decided');
}

console.log('\n== a fired setup whose horizon has not elapsed is OPEN, not expired ==');
{
  const def = { tf: '5m', sec: 300, bars: 280, band: 'scalp' };
  const rows = series(280, { tfSec: 300, endHour: 15, tail: 2 });
  const out = ctx.hg80ScanTf(rows, def, { rtFrac: 0.00020, venue: 'XM' });
  ok(out.ok === true, 'the rung scans');
  const fired = out.res.signals.filter(s => s.i === rows.length - 3);
  ok(fired.length === 1, 'the engineered trigger fires three bars from the end');
  ok(fired[0].status === 'open',
     'and is OPEN: two bars is not the 48-bar horizon, so the bars ran out, the horizon did not');
  ok(out.tally.open >= 1, 'counted as open in the tally');
  ok(fired[0].res.outcome === 'expired',
     'even though the resolver said "expired" — the rung, not the resolver, makes that call');
  ok(/horizon has not elapsed/.test(SRC), 'and the panel says what "still open" means');
}

console.log('\n== the record carries the rung, so 5m and 1d never share one ==');
{
  for (const k of Object.keys(store)) delete store[k];
  const rows = series(280, { tfSec: 86400, endHour: 4 });
  const cfg = ctx.hg80Cfg({ tf: '1d', sec: 86400 });
  const ind = ctx.hg80Indicators(rows);
  const sig = ctx.hg80SignalAt(rows, ind, rows.length - 1, cfg);
  sig.plan = ctx.hg80Plan(sig);
  const rec = ctx.hg80Record(sig, cfg);
  ok(rec.ok === true && rec.reason === 'recorded', 'a 1d setup records');
  const log = ctx.hgFwdRecords(ctx.HG_P80_TAB) || [];
  ok(log.length === 1, 'asserted against the LOG, not the recorder\'s return');
  ok(log[0].mechanic === 'P80-1D-LONG',
     `the mechanic names the rung (${log[0].mechanic}) — a daily dip-buy is not a 5m one`);
  ok(log[0].tf === '1d', 'the record carries the timeframe');
  ok(log[0].barT % 86400 === 0,
     'and barT floors to the 1d bar, not to 300 — otherwise the log could not dedup it');
  ok(log[0].ticket === false && log[0].gateClear !== true,
     'still a non-ticket that cleared no gate');
  for (const k of Object.keys(store)) delete store[k];
}

console.log('\n== near misses are near misses, never setups ==');
{
  const def = { tf: '1h', sec: 3600, bars: 280, band: 'swing' };
  const rows = series(280, { tfSec: 3600, endHour: 15 });
  const out = ctx.hg80ScanTf(rows, def, { rtFrac: 0.00020, venue: 'XM' });
  for (const m of out.misses){
    ok(m.sig.dir === null, 'a listed near miss did NOT fire');
    ok(m.score.met === m.score.total - 1,
       `and is exactly one condition short (${m.score.met}/${m.score.total}, missing ${m.score.missing.join(',')})`);
  }
  ok(out.misses.length <= 3, 'the list is capped so one quiet rung cannot flood the page');
  ok(/These did NOT fire and are not setups/.test(SRC),
     'and the panel says so where a reader will see it');
  ok(!/setupCardHtml\(\s*[a-z]*\.?m\b|misses\[[^\]]*\]\.sig,\s*[a-z]+\.be/.test(CODE),
     'near misses are never rendered through the setup card');
}

console.log('\n== the tab is POPULATED when nothing fires ==');
{
  /* the failure this version exists to fix: five rungs, not one firing
     between them, and the tab still has to say something true */
  const quiet = (tfSec, n) => {
    const rows = [];
    const end = Math.floor(Date.UTC(2026, 8, 17, 16, 0, 0) / 1000 / tfSec) * tfSec;
    let px = 4358, s = 7;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const vol = 3.3 * Math.sqrt(tfSec / 300);
    for (let i = 0; i < n; i++){
      const o = px, c = o + (rnd() - 0.5) * vol;
      rows.push({ t: end - (n - 1 - i) * tfSec, o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c, v: 1 });
      px = c;
    }
    return rows;
  };
  const secOf = Object.fromEntries(ctx.HG_P80_LADDER.map(r => [r.tf, r.sec]));
  ctx.hgOgFetchRows = (tf, n) => Promise.resolve({ rows: quiet(secOf[tf], n), source: 'fixture' });
  ctx.hgOgVenueCost = () => ({ rtFrac: 0.00020, venue: 'XM' });

  const tab = (ctx.HG_tabs || []).find(t => t && t.id === '80percent');
  const node = { innerHTML: '', _q: {}, querySelector(sel){ if (!this._q[sel]) this._q[sel] = el(); return this._q[sel]; } };
  tab.mount(node);
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));
  const html = String(node._q['#p80Body'].innerHTML);

  ok(html.length > 2000, `the body is not empty (${html.length} chars)`);
  ok(/THE LADDER RIGHT NOW/.test(html), 'the ladder board renders');
  for (const r of ctx.HG_P80_LADDER){
    ok(new RegExp('>' + r.tf + '<').test(html), `${r.tf} has a row on it`);
  }
  ok(/distance to fire/i.test(html), 'with a distance-to-fire column');
  ok(/it needs/.test(html), 'the required-rate table renders');
  ok(/session rule N\/A/.test(html),
     'and the rungs where the session rule was dropped say so on the board');
  ok(!/NaN|undefined/.test(html), 'and nothing rendered as NaN or undefined');
  ok(/RSI [0-9]+\.[0-9] needs/.test(html),
     'the distance is a NUMBER, not a shrug — this is what replaced the empty panel');

  const stat = String(node._q['#p80Stat'].textContent);
  ok(/rungs/.test(stat), `the status line reports the ladder: "${stat}"`);
}

console.log('\n== the setups are at the TOP, and are the most recent firing, not only the last candle ==');
{
  /* the complaint this section exists for: the tab held setups and read as
     though it held none, because only a firing on the LAST candle was
     promoted and that happens roughly three times in a thousand bars */
  const def = { tf: '15m', sec: 900, bars: 280, band: 'scalp' };
  const rows = series(280, { tfSec: 900, endHour: 15, tail: 4 });
  const out = ctx.hg80ScanTf(rows, def, { rtFrac: 0.00020, venue: 'XM' });
  ok(out.res.signals.length > 0, 'the fixture fires');
  ok(!out.live.length, 'but NOT on the last closed candle — which is the normal case');
  ok(!!out.latest, 'the rung still carries a latest setup');
  ok(out.latest.i === out.res.signals[out.res.signals.length - 1].i,
     'and it is the most recent firing, not the first');
  ok(out.latest.ageBars === (rows.length - 1) - out.latest.i,
     `with its age in bars (${out.latest.ageBars})`);
  ok(out.latest.ageSec === out.latest.ageBars * 900,
     'and in wall time at THIS rung\'s seconds — three bars is 45m here and 3 days on 1d');
  ok(!!out.latest.plan && out.latest.plan.entry > 0, 'carrying its levels, so it can be acted on');

  const iSetups = SRC.indexOf('latestSetupsHtml(rungs)');
  const iBoard = SRC.indexOf('ladderBoardHtml(rungs)', SRC.indexOf('function render('));
  ok(iSetups > 0 && iBoard > 0 && iSetups < iBoard,
     'and the SETUPS panel is rendered ABOVE the ladder board, not buried under it');
}

console.log('\n== no setup is shown twice ==');
{
  ok(/if \(r\.latest && s\.i === r\.latest\.i\) continue;/.test(SRC),
     'the history panels skip whatever the SETUPS panel already carded');
  /* endHour 17 with a 4-bar tail puts the 1h trigger at 13:00 UTC — inside
     the session. At endHour 15 it would land at 11:00 and fire nothing, which
     would make this assertion pass vacuously. */
  const def = { tf: '1h', sec: 3600, bars: 280, band: 'swing' };
  const rows = series(280, { tfSec: 3600, endHour: 17, tail: 4 });
  const out = ctx.hg80ScanTf(rows, def, { rtFrac: 0.00020, venue: 'XM' });
  ok(out.res.signals.length >= 1, `the 1h fixture fires (${out.res.signals.length})`);
  const rest = out.res.signals.filter(x => !out.latest || x.i !== out.latest.i);
  ok(rest.length === out.res.signals.length - 1,
     'exactly one signal is claimed by the SETUPS panel and the rest fall through to history');
}

console.log('\n== the census counts what the threshold turned away, and agrees with the scan ==');
{
  /* the strongest check available: the census re-derives the spec column
     independently, so if it disagreed with the scan one of the two would be
     measuring rules the tab does not trade */
  for (const [tf, sec] of [['5m', 300], ['15m', 900], ['1h', 3600], ['1d', 86400]]){
    const def = { tf, sec, bars: 280, band: sec > 3600 ? 'swing' : 'scalp' };
    const rows = series(280, { tfSec: sec, endHour: 15 });
    const out = ctx.hg80ScanTf(rows, def, { rtFrac: 0.00020, venue: 'XM' });
    const spec = out.census.levels.find(l => l.isSpec);
    ok(!!spec, `${tf}: the census marks the spec column`);
    ok(spec.rsiLong === ctx.HG_P80_SPEC.rsiLong && spec.rsiShort === ctx.HG_P80_SPEC.rsiShort,
       `${tf}: and it is the supplied 45 / 55, not a nearby number`);
    ok(spec.fires === out.res.signals.length,
       `${tf}: the spec column equals the scan exactly (${spec.fires} = ${out.res.signals.length}) `
       + '— the census measures the rules the tab trades');
  }
}

console.log('\n== the census is a census, never a second strategy ==');
{
  const lv = ctx.hg80PullbackCensus ? true : false;
  ok(lv, 'the census is exported so it can be checked');
  ok(!/hg80SignalAt\([^)]*,\s*\d/.test(LOGIC),
     'no threshold is ever passed into the signal evaluator — it re-reads what was computed');
  /* and the decisive one: a census cannot produce something tradeable. It
     returns counts. If it ever returned a plan it would be a second spec
     wearing a census's name, and the panel's promise would be false. */
  const shape = ctx.hg80PullbackCensus(series(280, { tfSec: 3600, endHour: 15 }),
                                       ctx.hg80Indicators(series(280, { tfSec: 3600, endHour: 15 })),
                                       ctx.hg80Cfg({ tf: '1h', sec: 3600 }));
  ok(!('plan' in shape) && !('signals' in shape) && !('entry' in shape),
     'the census returns no plan, no signals and no entry — only counts');
  ok(shape.levels.every(l => typeof l.fires === 'number' && !('plan' in l) && !('entry' in l)),
     'and neither does any of its levels');
  /* monotonicity needs a series with real spread across the levels — on the
     engineered single-trigger fixture every column is 1 and the assertion
     would hold without meaning anything */
  const walk = (tfSec, n) => {
    const out = [];
    let px = 4358, st = 7;
    const rnd = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff; };
    for (let i = 0; i < n; i++){
      const o = px, cl = o + (rnd() - 0.5) * 3.3 * Math.sqrt(tfSec / 300);
      out.push({ t: 1789000000 - (n - 1 - i) * tfSec, o, h: Math.max(o, cl) + 0.3,
                 l: Math.min(o, cl) - 0.3, c: cl, v: 1 });
      px = cl;
    }
    return out;
  };
  const rows = walk(86400, 420);
  const ind = ctx.hg80Indicators(rows);
  const c = ctx.hg80PullbackCensus(rows, ind, ctx.hg80Cfg({ tf: '1d', sec: 86400 }));
  const fires = c.levels.map(l => l.fires);
  ok(fires.every((v, i) => i === 0 || v >= fires[i - 1]),
     `looser thresholds can only ever fire more, never fewer (${fires.join(' <= ')})`);
  ok(fires[fires.length - 1] > fires[0],
     `and the spread is real, not a row of equal numbers — ${fires[0]} at the spec, `
     + `${fires[fires.length - 1]} at the loosest, which is the trade-off the panel prices`);
  ok(c.armedLong + c.armedShort <= c.bars,
     'armed bars are a subset of evaluated bars');

  /* the point the panel makes, asserted rather than claimed: relaxing the
     pullback does not move the bar the trade has to clear */
  const be = ctx.hg80Breakeven(5, 4000, 0.00020);
  ok(near(be.gross, 4 / 4.75, 1e-12),
     'the gross breakeven is a function of the stop and target alone');
  ok(!/RSI|rsi/.test(String(ctx.hg80Breakeven)),
     'and the breakeven function never reads an RSI threshold at all');
  ok(/Moving the threshold does not change/.test(SRC), 'which is what the panel says');
  ok(/The tab trades the spec column and nothing else/.test(SRC),
     'and it states which column is actually traded');
}

console.log('\n== the board says how often each rung fires ==');
{
  ok(/<th>fired<\/th>/.test(SRC), 'the ladder board has a fired column');
  ok(/r\.res\.signals\.length \+ ' in ' \+ r\.scanned/.test(SRC),
     'reporting firings over the bars actually scanned, so the count is never a mystery');
}

console.log('\n== and it still refuses to invent a rate from what it resolved ==');
{
  ok(!/winRate|hitRate/.test(CODE), 'no win rate is computed anywhere in the code');
  ok(/no win rate is shown from this table/.test(SRC),
     'the resolved list says so in as many words');
  ok(/one fetch is not a sample/.test(SRC), 'and says why');
  ok(/walk-80percent/.test(SRC), 'pointing at the thing that can answer it instead');
}

console.log(`\n${passed} passed, 0 failed`);
