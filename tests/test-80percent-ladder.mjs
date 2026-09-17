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
  /* 2.6 drives RSI under 45 (the spec fires); 2.0 leaves it near 50, which
     only the wide mechanic takes. That gap is what the variant tests aim at. */
  const dip = o.dip == null ? 2.6 : o.dip;
  const trig = n - 1 - tail;
  for (let i = 0; i < n; i++){
    const t = base + i * tfSec;
    const oo = px;
    let c;
    if (i < trig - 7)      c = px + 1.2 * up;      /* the trend */
    else if (i < trig)     c = px - dip * up;       /* the pullback, as deep as asked */
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
  /* Once a second mechanic exists the comparison reads a variant's field, so
     a regex counting `rs < P80_RSI_LONG` proves nothing. The property that
     matters is behavioural and is asserted that way below and in the variant
     section: evaluated with NO variant, the thresholds are still 45 and 55. */
  const specV = ctx.HG_P80_VARIANTS[0];
  ok(specV.rsiLong === 45 && specV.rsiShort === 55,
     'the first variant is the supplied spec, at 45 and 55');
  ok(specV.rsiLong === ctx.HG_P80_SPEC.rsiLong && specV.rsiShort === ctx.HG_P80_SPEC.rsiShort,
     'and it agrees with the published spec object, so they cannot drift apart');
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
  /* THE BARS are a fixture; THE VENUE IS NOT. Mocking hgOgVenueCost here is
     what hid the rtFrac/rtCostPct seam bug for four versions: the mock was
     written in the shape the tab expected rather than the shape omnigold
     returns, so the tab and its test agreed with each other while the live
     app rendered nothing. The real function is pure and needs no network,
     so there was never a reason to replace it. */
  ok(typeof ctx.hgOgVenueCost === 'function' && ctx.hgOgVenueCost().rtCostPct > 0,
     'the REAL venue cost is in play for this render, not a stand-in');

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
  ok(/distance to SPEC/i.test(html),
     'with a distance column, measured against the SUPPLIED thresholds even on a rung that '
     + 'just fired the loosened mechanic');
  ok(/it needs/.test(html), 'the required-rate table renders');
  ok(/session rule N\/A/.test(html),
     'and the rungs where the session rule was dropped say so on the board');
  ok(!/NaN|undefined/.test(html), 'and nothing rendered as NaN or undefined');
  ok(/<th>it needs<\/th>/.test(html) && /<b>[0-9]+\.[0-9]{2}%<\/b>/.test(html),
     'the required-rate table shows a REAL cost-adjusted number — the panel that was blank in '
     + 'the live app for four versions');
  ok(/round trip\)/.test(html) && /0\.[0-9]+% (taker|round)/.test(html),
     'and names the venue cost it used, straight from the desk\'s own basis string');
  ok(!/cost-adjusted bar is not shown/.test(html),
     'and does not fall back to the cannot-compute branch when the venue is readable');
  ok(/RSI [0-9]+\.[0-9] needs/.test(html),
     'the distance is a NUMBER, not a shrug — this is what replaced the empty panel');
  ok(/55 \/ 45 column is wired/.test(html),
     'and the rendered census names the loosened column as wired, with its real thresholds');
  ok(/SPEC [0-9]+<\/span> <span class="statuschip na">WIDE [0-9]+/.test(html),
     'the board splits each rung\'s firings by mechanic rather than pooling them into one count');

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
  /* v773 asserted the tab traded the spec column and nothing else. That is
     no longer true and must not keep passing: the 55 column is now wired as
     its own mechanic, and the panel has to say so rather than leave a reader
     with the old promise. */
  ok(!/The tab trades the spec column and nothing else/.test(SRC),
     'the superseded "spec column only" promise is gone, not left behind to mislead');
  /* built from the constants rather than typed as a literal, so the copy
     cannot drift from the thresholds it describes */
  ok(/P80_RSI_WIDE_LONG \+ ' \/ ' \+ P80_RSI_WIDE_SHORT \+ ' column is wired/.test(SRC),
     'the panel says the loosened column is wired, naming it from the constants themselves');
  ok(/recorded separately/.test(SRC), 'and that it records separately');
  ok(/counts in that column are CUMULATIVE/.test(SRC),
     'and warns that the census column includes the spec firings while the mechanic does not');
}

console.log('\n== the board says how often each rung fires ==');
{
  ok(/<th>fired<\/th>/.test(SRC), 'the ladder board has a fired column');
  ok(/c\.total \+ ' in ' \+ r\.scanned/.test(SRC),
     'reporting firings over the bars actually scanned, so the count is never a mystery');
  ok(/>SPEC ' \+ c\.spec[\s\S]{0,200}>WIDE ' \+ c\.wide/.test(SRC),
     'and splitting that count by mechanic, so a rung carried by the loosened one cannot read '
     + 'as a rung the spec is producing');
}

console.log('\n== the second mechanic is a second mechanic, not a loosened spec ==');
{
  const V = ctx.HG_P80_VARIANTS;
  ok(V.length === 2, 'two variants are declared');
  ok(V[0].key === 'spec' && V[1].key === 'wide', 'the spec first, the wide one second');
  ok(V[0].mech !== V[1].mech, `they record under different mechanics (${V[0].mech} / ${V[1].mech})`);
  ok(V[1].rsiLong === 55 && V[1].rsiShort === 45,
     'and the wide one is the 55 / 45 column from the census, exactly as it was counted');

  /* ORDERED TIGHTEST FIRST, and each a strict superset of the one before.
     hg80Scan's "first that fires wins" is only a valid disjoint assignment
     because of this, so it is asserted rather than assumed. */
  for (let i = 1; i < V.length; i++){
    ok(V[i].rsiLong > V[i - 1].rsiLong && V[i].rsiShort < V[i - 1].rsiShort,
       `variant ${i} is strictly looser on both sides — every earlier firing also satisfies it`);
  }

  ok(ctx.hg80Variant('spec') === V[0] && ctx.hg80Variant('wide') === V[1], 'both resolve by key');
  ok(ctx.hg80Variant('nonsense') === V[0] && ctx.hg80Variant() === V[0],
     'and an unknown key falls back to the SPEC, never to the looser one');
}

console.log('\n== evaluated with no variant, the thresholds are still the supplied ones ==');
{
  /* dip 2.0 leaves RSI near 50: inside the wide band, outside the spec's.
     A bar the two mechanics disagree about is the only fixture that can
     prove the default did not quietly widen. */
  const rows = series(280, { dip: 2.0 });
  const ind = ctx.hg80Indicators(rows);
  const bare = ctx.hg80SignalAt(rows, ind, rows.length - 1, ctx.hg80Cfg(null));
  const spec = ctx.hg80SignalAt(rows, ind, rows.length - 1, ctx.hg80Cfg(null), ctx.hg80Variant('spec'));
  const wide = ctx.hg80SignalAt(rows, ind, rows.length - 1, ctx.hg80Cfg(null), ctx.hg80Variant('wide'));

  ok(spec.rsi > 45 && spec.rsi < 55, `the bar sits between the two thresholds (RSI ${spec.rsi.toFixed(2)})`);
  ok(spec.dir === null && spec.longChecks.pullback === false,
     'the SPEC turns it away, which is the whole reason it is a marginal bar');
  ok(wide.dir === 'long' && wide.longChecks.pullback === true, 'the WIDE mechanic takes it');
  ok(bare.dir === spec.dir && bare.longChecks.pullback === spec.longChecks.pullback,
     'and calling hg80SignalAt with NO variant behaves exactly as the spec — the default did '
     + 'not widen when the second mechanic landed');
  ok(bare.variant === 'spec', 'the signal says which mechanic judged it');

  for (const k of ['trend', 'trigger']){
    ok(spec.longChecks[k] === wide.longChecks[k],
       `${k} is identical across the two — ONLY the pullback threshold differs`);
  }
  const p1 = ctx.hg80Plan(wide), p2 = ctx.hg80Plan(ctx.hg80SignalAt(rows, ind, rows.length - 1, ctx.hg80Cfg(null), ctx.hg80Variant('wide')));
  ok(near(p1.risk / wide.atr, 4.00, 1e-12) && near(p1.reward / wide.atr, 0.75, 1e-12),
     'and a WIDE plan uses the SAME 4.00 and 0.75 — the exit was not loosened with the entry');
  ok(p1.entry === p2.entry, 'plans are deterministic');
}

console.log('\n== the two populations are disjoint ==');
{
  /* a random walk, because the engineered fixture fires once and a
     disjointness check over one signal proves nothing */
  const walk = (tfSec, n, seed) => {
    const out = [];
    let px = 4358, st = seed;
    const rnd = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff; };
    const vol = 3.3 * Math.sqrt(tfSec / 300);
    const end = Math.floor(Date.UTC(2026, 8, 17, 16, 0, 0) / 1000 / tfSec) * tfSec;
    for (let i = 0; i < n; i++){
      const o = px, cl = o + (rnd() - 0.48) * vol;
      out.push({ t: end - (n - 1 - i) * tfSec, o, h: Math.max(o, cl) + rnd() * vol * 0.6,
                 l: Math.min(o, cl) - rnd() * vol * 0.6, c: cl, v: 1 });
      px = cl;
    }
    return out;
  };
  const def = { tf: '15m', sec: 900, bars: 500, band: 'scalp' };
  const rows = walk(900, 500, 22);
  const out = ctx.hg80ScanTf(rows, def, { rtFrac: 0.00020, venue: 'XM' });
  const spec = out.res.signals.filter(x => x.variant === 'spec');
  const wide = out.res.signals.filter(x => x.variant === 'wide');
  ok(spec.length > 0 && wide.length > 0,
     `the fixture produces BOTH kinds (${spec.length} spec, ${wide.length} wide) — without that `
     + 'everything below would pass vacuously');

  const byBar = {};
  let dup = 0;
  for (const s2 of out.res.signals){ if (byBar[s2.i]) dup++; byBar[s2.i] = true; }
  ok(dup === 0, 'no bar produces two signals — one bar belongs to exactly one mechanic');

  const ind = ctx.hg80Indicators(rows);
  let checked = 0;
  for (const s2 of wide){
    const asSpec = ctx.hg80SignalAt(rows, ind, s2.i, out.cfg, ctx.hg80Variant('spec'));
    if (asSpec.dir !== null) throw new Error('FAIL: a WIDE firing at bar ' + s2.i
      + ' also satisfies the SPEC — the populations overlap and WIDE\'s record is contaminated');
    checked++;
  }
  passed++;
  console.log('  ok — every one of the ' + checked + ' WIDE firings is a bar the SPEC rejected — '
    + 'WIDE\'s record holds only marginal bars, never spec-quality ones wearing its name');

  let specAlsoWide = 0;
  for (const s2 of spec){
    const asWide = ctx.hg80SignalAt(rows, ind, s2.i, out.cfg, ctx.hg80Variant('wide'));
    if (asWide.dir === s2.dir) specAlsoWide++;
  }
  ok(specAlsoWide === spec.length,
     `and all ${spec.length} SPEC firings would ALSO satisfy WIDE — which is exactly why they `
     + 'have to be assigned to the tighter one, and why pooling the two records reconstructs '
     + '"wide as actually traded"');
  ok(out.res.signals.every(x => x.variant === 'spec' || x.variant === 'wide'),
     'every signal is attributed to one of the two');
}

console.log('\n== the record follows the mechanic, and the card says what was written ==');
{
  for (const k of Object.keys(store)) delete store[k];
  const rows = series(280, { dip: 2.0, tfSec: 900 });
  const cfg = ctx.hg80Cfg({ tf: '15m', sec: 900 });
  const ind = ctx.hg80Indicators(rows);
  const sig = ctx.hg80SignalAt(rows, ind, rows.length - 1, cfg, ctx.hg80Variant('wide'));
  sig.plan = ctx.hg80Plan(sig);
  const rec = ctx.hg80Record(sig, cfg);
  ok(rec.ok === true, 'a WIDE setup records');
  ok(rec.mechanic === 'P80W-15M-LONG',
     `and the recorder REPORTS the mechanic it wrote (${rec.mechanic})`);
  const log = ctx.hgFwdRecords(ctx.HG_P80_TAB) || [];
  ok(log.length === 1 && log[0].mechanic === rec.mechanic,
     'which is the string actually in the log — asserted against the LOG, not the return value');
  ok(!/^P80-/.test(log[0].mechanic),
     'a WIDE firing is never filed under the spec\'s mechanic, which is the bug this check exists for');
  ok(/rec\.mechanic/.test(SRC),
     'and the card prints the returned mechanic rather than rebuilding the name a second time');
  ok(!/as P80-' \+/.test(SRC), 'with no stale second copy of that name left at the call site');
  for (const k of Object.keys(store)) delete store[k];
}

console.log('\n== a WIDE card discloses what it is and what it did not buy ==');
{
  ok(/THIS IS THE WIDE MECHANIC, NOT THE SUPPLIED SPEC/.test(SRC),
     'the card names itself as the second mechanic');
  ok(/which the spec turned away/.test(SRC), 'says the spec rejected this bar');
  ok(/the entry got easier and <b>the bar did not move<\/b>/.test(SRC),
     'and states the trade-off: a looser entry bought no relief on the exit');
  ok(/judged on its own record and never lends its numbers to/.test(SRC),
     'and that the two records stay apart');
  ok(/variantNoteHtml\(sig\)/.test(SRC), 'wired into the setup card, not just declared');
}

console.log('\n== the default population did not change under existing callers ==');
{
  /* the walk measures the spec. If hg80Scan had started returning WIDE
     signals by default, the walk would silently have become a measurement
     of a different strategy. */
  const rows = series(280, { dip: 2.0 });
  const bare = ctx.hg80Scan(rows);
  ok(bare.variants.length === 1 && bare.variants[0].key === 'spec',
     'hg80Scan with no options scans the SPEC only');
  ok(bare.signals.every(x => x.variant === 'spec'), 'and returns nothing else');
  const both = ctx.hg80Scan(rows, { variants: ctx.HG_P80_VARIANTS });
  ok(both.signals.length >= bare.signals.length,
     `asking for both can only add (${bare.signals.length} -> ${both.signals.length})`);
  ok(both.signals.filter(x => x.variant === 'spec').length === bare.signals.length,
     'and the spec half of the combined scan is exactly the spec-only scan — unchanged, not re-derived');
  const WALK = fs.readFileSync(path.join(ROOT, 'scripts/walk-80percent.mjs'), 'utf8');
  ok(!/variants/.test(WALK.replace(/\/\*[\s\S]*?\*\//g, '')),
     'and the walk asks for no variants, so it still measures what it was written to measure');
}

console.log('\n== the venue seam is tested against the REAL function, not a mock of it ==');
{
  /* THE BUG THIS SECTION EXISTS FOR. From hg-v770 to hg-v774 hg80VenueRt()
     read `rtFrac` from hgOgVenueCost(), which returns `rtCostPct`. It
     therefore returned null on every call and the required-rate table — the
     single most useful thing on this tab — never rendered in the live app.
     Every test passed throughout, because they handed the tab a mock in the
     shape the tab expected instead of the shape omnigold actually returns.
     Two sides of a broken seam agreeing with each other is not a test.

     So: no mock. This calls omnigold's own hgOgVenueCost, loaded above. */
  ok(typeof ctx.hgOgVenueCost === 'function',
     'omnigold.js is loaded and exports hgOgVenueCost');
  /* built from fragments so the pattern cannot match its own source line */
  const assignRe = new RegExp('ctx' + '\\.hgOg' + 'VenueCost\\s*=\\s*[^=]');
  ok(!assignRe.test(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')),
     'and NOTHING in this file replaces it — a mocked venue is how this seam broke unseen');
  const raw = ctx.hgOgVenueCost();
  ok(!!raw, 'it returns an object');
  ok(typeof raw.rtCostPct === 'number' && isFinite(raw.rtCostPct) && raw.rtCostPct > 0,
     `whose cost field is rtCostPct (${raw.rtCostPct}) — the name the tab must read`);
  ok(raw.rtFrac === undefined,
     'and there is NO rtFrac on it, which is exactly why reading one returned null forever');
  ok(raw.rtCostPct < 1,
     `it is a PERCENT, not a fraction (${raw.rtCostPct} means ${raw.rtCostPct}%, not `
     + `${(raw.rtCostPct * 100).toFixed(1)}%) — reading it as a fraction would overstate cost 100x`);

  const got = ctx.hg80VenueRt ? ctx.hg80VenueRt() : null;
  ok(!!got, 'the tab reads it successfully — this is the assertion that was missing');
  ok(near(got.rtFrac, raw.rtCostPct / 100, 1e-12),
     `converting percent to fraction exactly once (${raw.rtCostPct}% -> ${got.rtFrac})`);
  ok(got.venue === raw.venue, `carrying the venue name through (${got.venue})`);

  /* and end to end: a breakeven priced off the real venue must be finite,
     above the gross bar, and sane */
  const be = ctx.hg80Breakeven(3.316, 4293.73, got.rtFrac);
  ok(be.net != null && isFinite(be.net), `the net bar computes (${(be.net * 100).toFixed(2)}%)`);
  ok(be.net > be.gross, 'and sits above the gross bar, because cost can only raise it');
  ok(be.net < 2, 'and is not an absurd number from a units mix-up');
}

console.log('\n== when the venue genuinely cannot be read, the panel says WHICH half is missing ==');
{
  ok(/venue cost could not be read from the gold desk \(hgOgVenueCost\)/.test(SRC),
     'the fallback copy names the function that failed');
  ok(/DID report a live ATR, so the missing half is/.test(SRC),
     'and counts the rungs that DID report an ATR, so "no live ATR or no venue cost" can never '
     + 'again hide which one it was');
  ok(!/no live ATR or no venue cost/.test(CODE),
     'the old ambiguous sentence that hid this for four versions no longer reaches the page '
     + '(it survives only in the comment explaining why it was removed)');
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
