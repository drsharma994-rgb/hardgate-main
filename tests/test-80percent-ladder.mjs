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
/* A DOM real enough to carry listeners and querySelectorAll, at file scope
   so every render assertion in this file can DRIVE the tab rather than only
   read its markup. Asserting on innerHTML alone cannot catch a listener that
   was never attached. */
function mkEl(tag){
  const e = { tag, children: [], attrs: {}, listeners: {}, style: {}, _html: '', textContent: '',
    setAttribute(k, v){ this.attrs[k] = String(v); }, getAttribute(k){ return this.attrs[k]; },
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); },
    click(){ (this.listeners.click || []).forEach(f => f()); },
    appendChild(c){ this.children.push(c); },
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false }, dataset: {},
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = String(v); this.children = parseEls(this._html); },
    querySelector(sel){ return this.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel){
      const m = sel.match(/^\[([a-z0-9-]+)\]$/i);
      if (m) return this.children.filter(c => c.attrs[m[1]] !== undefined);
      if (sel.startsWith('#')) return this.children.filter(c => c.attrs.id === sel.slice(1));
      return [];
    } };
  return e;
}
function parseEls(html){
  const out = [];
  const re = /<(button|div|span|textarea)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))){
    const attrs = {};
    const ar = /([a-z0-9-]+)="([^"]*)"/gi;
    let a;
    while ((a = ar.exec(m[2]))) attrs[a[1]] = a[2];
    if (attrs.id || attrs['data-p80-focus'] !== undefined || attrs['data-p80-venue'] !== undefined
        || attrs['data-p80-view'] !== undefined){
      const e = mkEl(m[1]); e.attrs = attrs; out.push(e);
    }
  }
  return out;
}
const settle = async () => { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 0)); };
/* click a control inside the tab body by its data attribute value */
function press(node, attr, value){
  const b = node.querySelector('#p80Body').querySelectorAll('[' + attr + ']')
    .find(x => x.getAttribute(attr) === value);
  if (!b) throw new Error('FAIL: no control ' + attr + '="' + value + '" on the page');
  b.click();
  return b;
}


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
  const node = mkEl('div');
  tab.mount(node);
  await settle();
  /* SIMPLE is the default now, so the analysis this block is about lives one
     click away — press FULL and assert against that */
  press(node, 'data-p80-view', 'full');
  await settle();
  const html = String(node.querySelector('#p80Body').innerHTML);

  ok(html.length > 2000, `the body is not empty (${html.length} chars)`);
  ok(/THE LADDER RIGHT NOW/.test(html), 'the ladder board renders');
  for (const r of ctx.HG_P80_LADDER){
    ok(new RegExp('>' + r.tf + '<').test(html), `${r.tf} has a row on it`);
  }
  ok(/closest, either mechanic/i.test(html),
     'with a closest-to-firing column that walks BOTH mechanics, so a rung one candle from a '
     + 'WIDE entry is not reported as two conditions from a SPEC one');
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
  /* whichever condition is missing, the cell quantifies it: an RSI gap, an
     ATR distance from the EMA, or a named candle. Never a bare "not yet". */
  ok(/RSI [0-9]+\.[0-9] needs/.test(html) || /close is -?[0-9]+\.[0-9]{2} ATR from EMA50/.test(html)
     || /needs a (green|red) close/.test(html),
     'the distance is a NUMBER, not a shrug — this is what replaced the empty panel');
  ok(/WHY THERE IS NOTHING TO TAKE RIGHT NOW/.test(html),
     'and when nothing fired the tab leads with a computed answer to that question, rather than '
     + 'leaving a reader to decode five rows of chips');
  ok(/the session gate is a clock, not a condition/.test(html)
     || /can fire now and did not/.test(html),
     'naming the binding constraint — the session clock, or that the rungs were free to fire');
  for (const v of ctx.HG_P80_VARIANTS){
    ok(new RegExp(v.mech + ' at ' + v.rsiLong + ' / ' + v.rsiShort).test(html),
       `the rendered census names ${v.mech} as wired, with its real thresholds`);
  }
  /* one chip per mechanic, in table order, so a rung carried by a loosened
     mechanic can never read as a rung the spec is producing */
  const chipRe = ctx.HG_P80_VARIANTS
    .map(v => '<span class="statuschip (?:ok|na)">' + v.label + ' [0-9]+</span>')
    .join(' ');
  ok(new RegExp(chipRe).test(html),
     `the board splits each rung's firings across all ${ctx.HG_P80_VARIANTS.length} mechanics `
     + 'rather than pooling them into one count');

  const stat = String(node.querySelector('#p80Stat').textContent);
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

  const iSetups = SRC.indexOf('latestSetupsHtml(shown)');
  const iBoard = SRC.indexOf('ladderBoardHtml(shown)', SRC.indexOf('function render('));
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
  /* the wired/unwired split is DERIVED from the variant table now. It used to
     be a sentence naming P80_VARIANTS[1], which printed the wrong mechanic
     the moment a third one landed between them — the same bug class as the
     header that hand-counted its mechanics. */
  ok(/for \(vk = 0; vk < P80_VARIANTS\.length; vk\+\+\)/.test(SRC)
     && /wired\.push\(hit\.mech/.test(SRC),
     'the census works out which columns are wired by walking the variant table, not by index');
  /* LOGIC, not SRC: the comment explaining WHY the index is gone contains the
     index, and a guard that matches its own rationale is a guard that can
     never be satisfied */
  ok(!/P80_VARIANTS\[1\]/.test(LOGIC),
     'and NOTHING in the tab indexes P80_VARIANTS[1] — inserting a mechanic must not silently '
     + 'change what a sentence names');
  ok(/recorded separately|its own mechanic/.test(SRC), 'and that each records separately');
  ok(/counts are CUMULATIVE/.test(SRC),
     'and warns that a looser census column includes the tighter firings while the mechanic '
     + 'does not');
}

console.log('\n== the board says how often each rung fires ==');
{
  ok(/<th>fired<\/th>/.test(SRC), 'the ladder board has a fired column');
  ok(/c\.total \+ ' in ' \+ r\.scanned/.test(SRC),
     'reporting firings over the bars actually scanned, so the count is never a mystery');
  /* keyed by the variant table. The old ternary — variant === 'wide' ? 'wide'
     : 'spec' — filed every MID firing under SPEC the moment a third mechanic
     existed, inflating the record of the one mechanic here whose numbers are
     supposed to be untouched by the looser ones. */
  ok(/out\.by\[k\]\+\+; out\.total\+\+/.test(SRC),
     'and splitting that count by mechanic KEY, so a rung carried by a loosened one cannot read '
     + 'as a rung the spec is producing');
  /* CODE, not SRC: the comment recording why the ternary went contains the
     ternary. Not LOGIC either — that blanks string literals, so the pattern
     could never match there and the guard would pass vacuously. */
  ok(!new RegExp("variant === 'wide' \\? 'wide' : 'spec'").test(CODE),
     'and the two-mechanic ternary that would have mis-filed the third is gone');

  /* AND BY DIRECTION. Nothing in the protocol favours one side — a bar cannot
     satisfy both trend tests — but a reader could not see that without
     auditing the rows. */
  const dirDef = { tf: '15m', sec: 900, bars: 400, band: 'scalp' };
  const walk2 = (tfSec, n, seed) => {
    const o2 = []; let px = 4358, st = seed;
    const rnd = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff; };
    const vol = 3.3 * Math.sqrt(tfSec / 300);
    const end = Math.floor(Date.UTC(2026, 8, 17, 16, 0, 0) / 1000 / tfSec) * tfSec;
    for (let i = 0; i < n; i++){
      const oo = px, cl = oo + (rnd() - 0.48) * vol;
      o2.push({ t: end - (n - 1 - i) * tfSec, o: oo, h: Math.max(oo, cl) + rnd() * vol * 0.6,
                l: Math.min(oo, cl) - rnd() * vol * 0.6, c: cl, v: 1 });
      px = cl;
    }
    return o2;
  };
  const dirRows = walk2(900, 500, 22);
  const dirOut = ctx.hg80ScanTf(dirRows, dirDef, null);
  const dc = ctx.hg80CountByVariant(dirOut);
  ok(dc.long + dc.short === dc.total,
     `every firing is counted on exactly one side (${dc.long} long + ${dc.short} short = ${dc.total})`);
  ok(dc.long === dirOut.res.signals.filter(x => x.dir === 'long').length
     && dc.short === dirOut.res.signals.filter(x => x.dir === 'short').length,
     'and the split matches the signals themselves');
  ok(/[0-9]+ long<\/span> · /.test(ctx.firedSplitHtml ? ctx.firedSplitHtml(dirOut) : ' long</span> · '),
     'with both directions rendered on the board, so "does this thing ever short?" is a number '
     + 'rather than a search');
}

console.log('\n== the second mechanic is a second mechanic, not a loosened spec ==');
{
  const V = ctx.HG_P80_VARIANTS;
  ok(V.length === 3, `three variants are declared (${V.map(v => v.label).join(', ')})`);
  ok(V[0].key === 'spec', 'the supplied spec is first, so it stays the default everywhere');
  ok(V.map(v => v.key).join(',') === 'spec,mid,wide', 'tightest to loosest: spec, mid, wide');

  /* every mechanic records under its own name. Asserted as a SET rather than
     pairwise, so adding a fourth cannot sneak a collision past this. */
  const mechs = V.map(v => v.mech);
  ok(new Set(mechs).size === V.length,
     `each records under its own mechanic (${mechs.join(' / ')}) — no two share a record`);
  const keys = V.map(v => v.key);
  ok(new Set(keys).size === V.length, 'and each has its own key');

  /* every variant has to be a census column, or the census is measuring
     thresholds the tab does not trade and hiding ones it does */
  for (const v of V){
    ok(ctx.HG_P80_CENSUS_LEVELS.indexOf(v.rsiLong) >= 0,
       `${v.mech}'s ${v.rsiLong} / ${v.rsiShort} is a column the census already counts`);
  }
  ok(V[V.length - 1].rsiLong === 55 && V[V.length - 1].rsiShort === 45,
     'and the loosest is still the 55 / 45 column, exactly as it was counted');
  ok(V[1].rsiLong === 50 && V[1].rsiShort === 50,
     'with MID on the RSI midline — the level the index sits at when gain equals loss, and a '
     + 'column the census has been counting since the ladder shipped');

  /* ORDERED TIGHTEST FIRST, and each a strict superset of the one before.
     hg80Scan's "first that fires wins" is only a valid disjoint assignment
     because of this, so it is asserted rather than assumed. */
  for (let i = 1; i < V.length; i++){
    ok(V[i].rsiLong > V[i - 1].rsiLong && V[i].rsiShort < V[i - 1].rsiShort,
       `variant ${i} is strictly looser on both sides — every earlier firing also satisfies it`);
  }

  for (const v of V) ok(ctx.hg80Variant(v.key) === v, `${v.key} resolves by key`);
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
  const V = ctx.HG_P80_VARIANTS;
  const byVar = V.map(v => out.res.signals.filter(x => x.variant === v.key));
  const counts = V.map((v, i) => `${byVar[i].length} ${v.label}`).join(', ');
  /* every mechanic has to be represented or the checks below pass vacuously
     for the ones that are not */
  ok(byVar.every(g => g.length > 0),
     `the fixture produces a firing under EVERY mechanic (${counts}) — without that the checks `
     + 'below would pass vacuously for whichever is missing');

  const byBar = {};
  let dup = 0;
  for (const s2 of out.res.signals){ if (byBar[s2.i]) dup++; byBar[s2.i] = true; }
  ok(dup === 0, 'no bar produces two signals — one bar belongs to exactly one mechanic');

  const ind = ctx.hg80Indicators(rows);

  /* DISJOINT DOWNWARD: a firing filed under a looser mechanic must be a bar
     every TIGHTER one rejected, or the looser record is contaminated with
     trades that belong to the stricter one. */
  let checked = 0;
  for (let i = 1; i < V.length; i++){
    for (const s2 of byVar[i]){
      for (let j = 0; j < i; j++){
        const tighter = ctx.hg80SignalAt(rows, ind, s2.i, out.cfg, V[j]);
        if (tighter.dir !== null) throw new Error(`FAIL: a ${V[i].label} firing at bar ${s2.i}`
          + ` also satisfies ${V[j].label} — the populations overlap and ${V[i].label}'s record`
          + ' is contaminated');
        checked++;
      }
    }
  }
  passed++;
  console.log(`  ok — all ${checked} looser-firing/tighter-mechanic pairs come back rejected — `
    + 'each loosened record holds only the bars the stricter ones turned away, never '
    + 'spec-quality ones wearing its name');

  /* SUPERSET UPWARD: a firing filed under a tighter mechanic must ALSO
     satisfy every looser one — which is exactly why it has to be assigned to
     the tightest, and why pooling the records reconstructs "loose as
     actually traded". */
  let upward = 0, upwardOk = 0;
  for (let i = 0; i < V.length - 1; i++){
    for (const s2 of byVar[i]){
      for (let j = i + 1; j < V.length; j++){
        upward++;
        const looser = ctx.hg80SignalAt(rows, ind, s2.i, out.cfg, V[j]);
        if (looser.dir === s2.dir) upwardOk++;
      }
    }
  }
  ok(upward > 0 && upwardOk === upward,
     `and all ${upward} tighter-firing/looser-mechanic pairs come back firing the SAME side`);

  const known = V.map(v => v.key);
  ok(out.res.signals.every(x => known.indexOf(x.variant) >= 0),
     `every signal is attributed to one of the ${V.length}`);
  ok(byVar.reduce((a, g) => a + g.length, 0) === out.res.signals.length,
     'and the per-mechanic groups account for every signal, with none double-counted');
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

console.log('\n== a LOOSENED card discloses what it is and what it did not buy ==');
{
  /* rendered, not grepped: the note is built from the variant table now, so
     the assertion that matters is that EVERY loosened mechanic produces the
     disclosure and the SPEC produces none. A source regex for one hard-coded
     label would have gone on passing while MID cards said nothing at all. */
  ok(/THIS IS THE ' \+ esc\(v\.label\) \+ ' MECHANIC, NOT THE SUPPLIED SPEC/.test(SRC),
     'the card names itself from the variant table, so every mechanic discloses itself');
  for (const v of ctx.HG_P80_VARIANTS){
    const note = ctx.variantNoteHtml
      ? ctx.variantNoteHtml({ variant: v.key, rsi: 50 })
      : null;
    if (note == null) break;
    if (v.key === 'spec'){
      ok(note === '', 'the SPEC card carries no such note — it IS the supplied spec');
    } else {
      ok(new RegExp('THIS IS THE ' + v.label + ' MECHANIC, NOT THE SUPPLIED SPEC').test(note),
         `a ${v.label} card names itself as not the spec`);
      ok(new RegExp('asks for below ' + v.rsiLong + ' and above ' + v.rsiShort).test(note),
         `and prints ${v.label}'s own thresholds, not the previous mechanic's`);
    }
  }
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

console.log('\n== the tab does not depend on which OTHER tab was opened first ==');
{
  /* THE BUG. hgOgVenueInit() — which applies the persisted venue, or the
     desk's XM default — runs inside the OMNIGOLD tab's mount and nowhere
     else. This sandbox never mounted that tab, exactly like a user who opens
     80PERCENT straight from the nav. Before hg80VenueEnsure() the venue read
     as the PAXG fail-closed fallback, and every required rate on the page was
     priced at 0.26% round trip instead of XM's 0.020% — on 5m the difference
     between "needs 89.74%" and "unreachable". */
  ok(typeof ctx.hgOgVenueInit === 'function', 'omnigold exports hgOgVenueInit');
  ok((CODE.match(/W\.hgOgVenueInit\(\)/g) || []).length === 1,
     'and this tab calls it from exactly one place — the guarded ensure step — so no other '
     + 'code path can re-run it and undo a selection');

  const v = ctx.hg80VenueRt();
  ok(!!v, 'the venue reads');
  ok(v.venue === 'XM',
     `and it is XM — the desk's own default — without the OMNIGOLD tab ever having mounted `
     + `(got ${v.venue})`);
  ok(near(v.rtFrac, 0.00020, 1e-9),
     `at ${(v.rtFrac * 100).toFixed(3)}% round trip, not the 0.260% PAXG fallback`);

  /* the PAXG fallback still exists and is still conservative — it is the
     right answer when there is genuinely no selection, and must not be
     "fixed" into silently assuming the cheap venue */
  const paxg = ctx.hgOgVenuePresetCost('');
  ok(paxg.venue === 'PAXG' && paxg.rtCostPct > v.rtCostPct,
     'an unknown venue still fails closed to the DEARER one, which is the safe direction');
}

console.log('\n== the venue is initialised once, so a choice made here survives ==');
{
  /* hgOgVenueInit() resolves to '' when localStorage is unavailable, and ''
     means PAXG. Re-running it on every scan would therefore undo a selection
     made on this tab the moment storage is denied. */
  ok(/__p80VenueInit/.test(SRC), 'the ensure step is guarded by a once-flag');
  ok(/if \(__p80VenueInit\) return;/.test(SRC), 'returning early on every call after the first');

  const before = ctx.hg80VenueRt().venue;
  ok(ctx.hgOgSetVenue('PAXG') === true, 'a venue change is accepted');
  ok(ctx.hg80VenueRt().venue === 'PAXG', 'and takes effect');
  ctx.hg80VenueEnsure();
  ok(ctx.hg80VenueRt().venue === 'PAXG',
     'a later ensure does NOT reset it — the selection survives the next scan');
  ctx.hgOgSetVenue(before);
  ok(ctx.hg80VenueRt().venue === before, `restored to ${before} for the rest of this file`);
}

console.log('\n== the venue control drives the desk, not a private copy ==');
{
  ok(/W\.hgOgSetVenue\(name\)/.test(SRC),
     'the buttons call the gold desk\'s own hgOgSetVenue — one venue, one place it is stored');
  ok(!/localStorage\.setItem/.test(CODE),
     'and this tab never writes the venue to storage itself, which would be a second source of truth');
  ok(/data-p80-venue/.test(SRC), 'the buttons carry this tab\'s own ids, not OMNIGOLD\'s');
  ok(!/id="ogVenueXm"/.test(SRC),
     'so reusing the desk\'s markup cannot put duplicate element ids on the page');
  ok(/HG_OG_VENUE[\s\S]{0,400}disabled/.test(SRC),
     'an HG_OG_VENUE override disables the buttons rather than letting them pretend to work');
  ok(/wireVenueButtons\(\);/.test(SRC) && (SRC.match(/wireVenueButtons\(\);/g) || []).length >= 2,
     'and the listeners are re-attached on every render, because innerHTML replaces the buttons');
}

console.log('\n== closest-to-firing walks BOTH mechanics, which is the message that was wrong ==');
{
  /* THE DISPLAY BUG, from a live scan. 4h: close BELOW EMA50, EMA50 BELOW
     EMA200, RSI 45.6. Against the spec that is a short missing its pullback
     (needs RSI above 55), so the board reported the LONG side at 1 of 3 —
     the side that was further away — while the WIDE short (pullback is RSI
     above 45) had trend AND pullback and was one red candle from firing. */
  const rows = series(280, { tfSec: 14400, endHour: 4, down: true, dip: 2.0 });
  const ind = ctx.hg80Indicators(rows);
  const cfg = ctx.hg80Cfg({ tf: '4h', sec: 14400 });
  const nr = ctx.hg80Nearest(rows, ind, rows.length - 1, cfg);
  ok(!!nr, 'a nearest is found');
  ok(nr.variant && (nr.variant.key === 'spec' || nr.variant.key === 'wide'),
     `and it names the mechanic it belongs to (${nr.variant.key})`);

  /* whatever the fixture produces, the invariant is what matters: no
     variant/side pair may be strictly closer than the one reported */
  let bestCost = Infinity;
  for (const v of ctx.HG_P80_VARIANTS){
    const sg = ctx.hg80SignalAt(rows, ind, rows.length - 1, cfg, v);
    for (const side of ['long', 'short']){
      const sc = ctx.hg80Score(side === 'long' ? sg.longChecks : sg.shortChecks);
      bestCost = Math.min(bestCost, ctx.hg80MissCost(sc));
    }
  }
  ok(nr.cost === bestCost,
     `the reported nearest (cost ${nr.cost}) is the closest of ALL four variant/side `
     + 'combinations — never a further one that happened to be checked first');

  /* a tie must break toward the TIGHTER mechanic: a spec setup at equal
     distance is worth more than a wide one */
  ok(/vi < P80_VARIANTS\.indexOf\(best\.variant\)/.test(SRC),
     'and a tie breaks toward the tighter mechanic');
  ok(/closest, either mechanic/.test(SRC), 'the column says it covers both');
  ok(!/distance to SPEC/.test(CODE),
     'the spec-only distance column is gone, not left beside the new one to contradict it');
}

console.log('\n== the session clock is reported as a clock ==');
{
  const S = ctx.hg80SecsToSession;
  const day = Date.UTC(2026, 8, 17, 0, 0, 0) / 1000;
  ok(S(day + 13 * 3600) === 0, 'inside the window it is zero');
  ok(S(day + 17 * 3600 + 3599) === 0, 'right up to 17:59:59');
  ok(S(day + 18 * 3600) === 3600 * 19, '18:00 is out, and the next open is 19h away');
  ok(S(day + 5 * 3600) === 8 * 3600, 'at 05:00 the window opens in exactly 8h');
  ok(S(day + 12 * 3600 + 3540) === 60, 'at 12:59 it is one minute away');
  ok(S(day + 23 * 3600) === 14 * 3600, 'and late at night it wraps to the next day');
  ok(S(NaN) === null, 'a nonsense clock returns null rather than a number');
}

console.log('\n== the why-nothing panel answers the question that was asked three times ==');
{
  ok(/WHY THERE IS NOTHING TO TAKE RIGHT NOW/.test(SRC), 'the panel exists');
  ok(/rungs cannot fire at all/.test(SRC), 'it counts the rungs the clock has shut');
  ok(/the session gate is a clock, not a condition/.test(SRC),
     'and says plainly that no price action changes that');
  ok(/Closest' \+ \(closest\.gated \? ' \(and still session-gated\)' : ' that can fire now'\)/.test(SRC),
     'the closest rung is labelled by whether it can actually fire — naming a session-gated rung '
     + 'as "closest" would invite watching a chart that cannot trade for hours');
  ok(/nearestOf\(live\) \|\| nearestOf\(held\)/.test(SRC),
     'and rungs that CAN fire are preferred over gated ones, with gated as the fallback');
  ok(/And these do not wait/.test(SRC), 'it explains why the list below is all history');
  ok(/actionable ON the bar it fires/.test(SRC),
     'stating that this strategy is taken at the firing bar, not from a standing list');
  ok(/medianBars/.test(SRC), 'and the holding time is MEASURED from the fetched windows');

  /* measured, not asserted: the median must come from resolved rows */
  const def = { tf: '15m', sec: 900, bars: 400, band: 'scalp' };
  const walk = (tfSec, n, seed) => {
    const out = []; let px = 4300, st = seed;
    const rnd = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff; };
    const vol = 3.1 * Math.sqrt(tfSec / 300);
    const end = Math.floor(Date.UTC(2026, 8, 17, 16, 0, 0) / 1000 / tfSec) * tfSec;
    for (let i = 0; i < n; i++){
      const o = px, c = o + (rnd() - 0.5) * vol;
      out.push({ t: end - (n - 1 - i) * tfSec, o, h: Math.max(o, c) + rnd() * vol * 0.6,
                 l: Math.min(o, c) - rnd() * vol * 0.6, c, v: 1 });
      px = c;
    }
    return out;
  };
  const out = ctx.hg80ScanTf(walk(900, 400, 22), def, ctx.hg80VenueRt());
  ok(out.resolvedN > 0, `the rung resolved ${out.resolvedN} firings`);
  ok(out.medianBars != null && out.medianBars >= 1,
     `with a median holding time of ${out.medianBars} bars`);
  ok(out.medianBars <= 48,
     'inside the horizon, because anything longer would have expired rather than resolved');
  const spans = out.res.signals.filter(x => x.res && x.status !== 'open').map(x => x.res.bars).sort((a, b) => a - b);
  ok(out.medianBars === spans[Math.floor(spans.length / 2)],
     'and it is the actual median of those rows, recomputed here independently');
}

console.log('\n== the panel suppresses itself when there IS something to take ==');
{
  const def = { tf: '15m', sec: 900, bars: 280, band: 'scalp' };
  const rows = series(280, { tfSec: 900, endHour: 15 });
  const out = ctx.hg80ScanTf(rows, def, ctx.hg80VenueRt());
  ok(out.live.length > 0, 'the fixture fires on its last closed candle');
  ok(/if \(r\.live\.length\) return '';/.test(SRC),
     'and the panel returns nothing in that case — explaining an absence that is not there '
     + 'would bury the setup it is standing next to');
}

console.log('\n== distance is weighted by what each missing condition would COST to satisfy ==');
{
  /* THE SECOND TIME THIS WENT WRONG. Ranking by "how many conditions held"
     put a LONG at 2 of 3 ahead of a SHORT at 2 of 3 on a bar where the short
     had TREND and the long did not. Those are not equally close: the long
     needed price back across its 50 EMA with the EMAs crossed against it —
     days of work on a 4h chart — and the short needed a red candle. */
  const C = ctx.HG_P80_MISS_COST;
  ok(C.trigger < C.pullback && C.pullback < C.session && C.session < C.trend,
     `the weights are ordered by what each takes: trigger ${C.trigger} < pullback ${C.pullback} `
     + `< session ${C.session} < trend ${C.trend}`);
  ok(C.trigger + C.pullback < C.trend,
     'so "missing a trigger AND a pullback" ranks ahead of "missing trend alone" — both of the '
     + 'first two can resolve on the very next bar, and a trend flip cannot');

  const cost = sc => ctx.hg80MissCost(sc);
  ok(cost({ missing: [] }) === 0, 'nothing missing costs nothing');
  ok(cost({ missing: ['trigger'] }) === C.trigger, 'one trigger costs the trigger weight');
  ok(cost({ missing: ['trend', 'pullback'] }) === C.trend + C.pullback, 'and they add');
  ok(cost({ missing: ['nonsense'] }) === 2,
     'an unrecognised condition costs a middling amount rather than zero, so a future condition '
     + 'cannot make a bar look closer than it is by being unknown');

  ok(/nr\.cost <= P80_MISS_COST\.trigger/.test(SRC),
     'the green "nearly there" chip is lit only when the single cheapest thing is missing — one '
     + 'candle. A bar missing its pullback is not one away in any sense a desk can act on');
}

console.log('\n== focusing a rung scans only that rung, and shows everything it fired ==');
{
  /* driven through the real mount and a real click, because the thing under
     test is a button: asserting on the source would not have caught a
     listener that was never attached */
  function mkEl(tag){
    const e = { tag, children: [], attrs: {}, listeners: {}, style: {}, _html: '', textContent: '',
      setAttribute(k, v){ this.attrs[k] = String(v); }, getAttribute(k){ return this.attrs[k]; },
      addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); },
      click(){ (this.listeners.click || []).forEach(f => f()); },
      appendChild(c){ this.children.push(c); },
      classList: { add(){}, remove(){}, toggle(){}, contains: () => false }, dataset: {},
      get innerHTML(){ return this._html; },
      set innerHTML(v){ this._html = String(v); this.children = parseEls(this._html); },
      querySelector(sel){ return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel){
        const m = sel.match(/^\[([a-z0-9-]+)\]$/i);
        if (m) return this.children.filter(c => c.attrs[m[1]] !== undefined);
        if (sel.startsWith('#')) return this.children.filter(c => c.attrs.id === sel.slice(1));
        return [];
      } };
    return e;
  }
  function parseEls(html){
    const out = [];
    const re = /<(button|div|span|textarea)\b([^>]*)>/gi;
    let m;
    while ((m = re.exec(html))){
      const attrs = {};
      const ar = /([a-z0-9-]+)="([^"]*)"/gi;
      let a;
      while ((a = ar.exec(m[2]))) attrs[a[1]] = a[2];
      if (attrs.id || attrs['data-p80-focus'] !== undefined || attrs['data-p80-venue'] !== undefined){
        const e = mkEl(m[1]); e.attrs = attrs; out.push(e);
      }
    }
    return out;
  }
  const walk = (tfSec, n) => {
    const out = []; let px = 4600, st = 99;
    const rnd = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff; };
    const vol = 3.1 * Math.sqrt(tfSec / 300);
    const end = Math.floor(Date.UTC(2026, 8, 17, 0, 0, 0) / 1000 / tfSec) * tfSec;
    for (let i = 0; i < n; i++){
      const o = px, c = o + (rnd() - 0.5) * vol;
      out.push({ t: end - (n - 1 - i) * tfSec, o, h: Math.max(o, c) + rnd() * vol * 0.6,
                 l: Math.min(o, c) - rnd() * vol * 0.6, c, v: 1 });
      px = c;
    }
    return out;
  };
  const secOf = Object.fromEntries(ctx.HG_P80_LADDER.map(r => [r.tf, r.sec]));
  const fetched = [];
  ctx.hgOgFetchRows = (tf, n) => { fetched.push(tf); return Promise.resolve({ rows: walk(secOf[tf], n), source: 'fixture' }); };

  const tab = (ctx.HG_tabs || []).find(t => t && t.id === '80percent');
  const node = mkEl('div');
  tab.mount(node);
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));
  ok(fetched.length === ctx.HG_P80_LADDER.length,
     `mounting scans the whole ladder (${fetched.join(', ')})`);

  const body = node.querySelector('#p80Body');
  const btns = body.querySelectorAll('[data-p80-focus]');
  ok(btns.length === ctx.HG_P80_LADDER.length + 4,
     'there is a button per rung, plus ALL, SCALP, SWING and NO SESSION GATE');
  const b4h = btns.find(b => b.getAttribute('data-p80-focus') === '4h');
  ok(!!b4h, 'including one for 4h');

  fetched.length = 0;
  b4h.click();
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));
  /* FOCUS NARROWS THE PAGE, NOT THE SCAN. It used to narrow the fetch too,
     which made one control do two jobs — and the second job broke the first
     once the tab grew a forward-looking panel: an unfetched rung cannot be
     reported as arming, so a view filter was deciding what a reader was
     allowed to know was coming. */
  ok(fetched.length === ctx.HG_P80_LADDER.length,
     `clicking it still scans the WHOLE ladder (${fetched.join(', ')}) — a view filter must not `
     + 'be able to hide a rung that is one candle from firing');
  ok(/4h shown of 5 scanned/.test(String(node.querySelector('#p80Stat').textContent)),
     'and the status line says what is shown AND what was scanned, so the two are never confused');

  const html = String(node.querySelector('#p80Body').innerHTML);
  ok(/EVERYTHING 4h FIRED/.test(html), 'and the focused panel replaces the pooled one');
  const rowCount = (html.match(/<tr><td>2026-/g) || []).length;
  const fired = (html.match(/([0-9]+) in [0-9]+ evaluable bars/) || [])[1];
  ok(Number(fired) > 0, `the fixture fired ${fired} times on 4h`);
  ok(rowCount === Number(fired),
     `and EVERY one has a row (${rowCount} of ${fired}) — uncapped, because on one timeframe the `
     + 'whole list IS the answer to "show me what fires"');
  ok(/bars held/.test(html), 'with how long each was held');
  ok(/typical holding time/.test(html), 'and the rung\'s typical holding time');

  /* ---- and now the ask that made it a set: 1d TOO, not 1d INSTEAD ---- */
  fetched.length = 0;
  node.querySelector('#p80Body').querySelectorAll('[data-p80-focus]')
      .find(b => b.getAttribute('data-p80-focus') === '1d').click();
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));
  ok(fetched.length === ctx.HG_P80_LADDER.length, 'the scan is still the whole ladder');
  const both = String(node.querySelector('#p80Body').innerHTML);
  ok(/EVERYTHING 4h \+ 1d FIRED/.test(both),
     `clicking 1d ADDS it to the view rather than replacing 4h`);
  ok(/EVERYTHING 4h \+ 1d FIRED/.test(both),
     'the panel holds both, in LADDER order — 4h + 1d, never 1d + 4h whatever the click order');
  ok(/<th>rung<\/th>/.test(both),
     'the merged table gains a rung column, because a merged count would hide which rung '
     + 'produced what — the whole reason for holding two at once');
  const seq = [...both.matchAll(/<tr><td><b>(5m|15m|1h|4h|1d)<\/b><\/td><td>(2026-[0-9-]+ [0-9:]+)/g)]
    .map(m => ({ tf: m[1], t: m[2] }));
  ok(seq.length > 2, `the merged table has ${seq.length} rows across both rungs`);
  ok(seq.every((r, i) => i === 0 || r.t <= seq[i - 1].t),
     'sorted newest first ACROSS rungs, not one rung\'s table stacked on the other\'s');
  ok(new Set(seq.map(r => r.tf)).size === 2, 'and both rungs really are interleaved in it');
  ok(/NOT a common population/.test(both),
     'with the warning that rows from different rungs are not one population — different cost '
     + 'ratios, different stops in percent, different holding periods, different mechanics');

  /* WHAT IS SELECTED is now read off the status line, because the fetch list
     no longer reports it — every rung is fetched on every pass. The status
     line is the right source anyway: it is what a reader sees. */
  const selection = () => {
    const m = String(node.querySelector('#p80Stat').textContent)
      .match(/([0-9a-z+ ]+) shown of [0-9]+ scanned/);
    return m ? m[1].trim().split(' + ') : [];
  };
  const scannedAll = () => fetched.length === ctx.HG_P80_LADDER.length;

  /* clicking a focused rung again drops it */
  fetched.length = 0;
  node.querySelector('#p80Body').querySelectorAll('[data-p80-focus]')
      .find(b => b.getAttribute('data-p80-focus') === '4h').click();
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));
  ok(selection().length === 1 && selection()[0] === '1d',
     `clicking 4h again drops it from the view, leaving ${selection().join(', ')}`);
  ok(scannedAll(), 'and the scan is still the whole ladder');

  /* SWING is exactly the rungs with no session gate — the pair a desk has
     outside 13:00-18:00 UTC, which is why it earns a shortcut */
  fetched.length = 0;
  node.querySelector('#p80Body').querySelectorAll('[data-p80-focus]')
      .find(b => b.getAttribute('data-p80-focus') === 'band:swing').click();
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));
  const swing = ctx.HG_P80_LADDER.filter(d => d.band === 'swing').map(d => d.tf);
  ok(selection().length === swing.length && swing.every(t => selection().indexOf(t) >= 0),
     `SWING selects exactly the swing BAND: ${swing.join(' + ')}`);

  /* and the set that actually matters at 05:00 UTC is NOT that one. 1h is
     banded swing by holding period and is still session-gated, because a 1h
     bar fits inside 13:00-18:00 UTC perfectly well. Claiming SWING was "the
     rungs with no session gate" was a false sentence on the page. */
  const ungated = ctx.hg80UngatedRungs();
  ok(ungated.every(t => !ctx.hg80SessionApplies(ctx.HG_P80_LADDER.find(d => d.tf === t).sec)),
     `NO SESSION GATE is computed from the timeframe: ${ungated.join(' + ')}`);
  ok(ctx.HG_P80_LADDER.filter(d => ungated.indexOf(d.tf) < 0)
       .every(d => ctx.hg80SessionApplies(d.sec)),
     'and it is exhaustive — every rung left out really is gated');
  ok(ungated.length !== swing.length || !ungated.every(t => swing.indexOf(t) >= 0),
     `it is NOT the same set as SWING (${ungated.join('+')} vs ${swing.join('+')}), which is why `
     + 'it needs its own button and its own words');
  ok(new RegExp('which is not the same set as SWING').test(SRC),
     'and the tab says so, rather than leaving a reader to assume the bands answer the question');

  fetched.length = 0;
  node.querySelector('#p80Body').querySelectorAll('[data-p80-focus]')
      .find(b => b.getAttribute('data-p80-focus') === 'set:ungated').click();
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));
  ok(selection().length === ungated.length && ungated.every(t => selection().indexOf(t) >= 0),
     `and its button selects exactly them (${selection().join(', ')})`);

  /* pressing the band button already showing goes back to ALL rather than
     doing nothing, which is the behaviour a toggle owes its user */
  fetched.length = 0;
  node.querySelector('#p80Body').querySelectorAll('[data-p80-focus]')
      .find(b => b.getAttribute('data-p80-focus') === 'set:ungated').click();
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));
  ok(selection().length === 0 && /5\/5 rungs/.test(String(node.querySelector('#p80Stat').textContent)),
     'pressing a group button that is already showing returns the VIEW to the whole ladder');

  /* ---- the paste-back loop: what COPY THESE ROWS actually emits ---- */
  fetched.length = 0;
  node.querySelector('#p80Body').querySelectorAll('[data-p80-focus]')
      .find(b => b.getAttribute('data-p80-focus') === 'set:ungated').click();
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));

  const copyBtn = node.querySelector('#p80Body').querySelector('#p80Copy');
  ok(!!copyBtn, 'the focused panel carries a copy button');
  /* no navigator.clipboard in this sandbox, which is the fallback path and
     the one that must not silently do nothing */
  copyBtn.click();
  const box = node.querySelector('#p80Body').querySelector('#p80CopyBox');
  ok(!!box && box.style.display === 'block',
     'with no clipboard available it reveals a selectable box instead of failing quietly');
  const txt = String(box.value || '');
  ok(txt.length > 200, `which holds the text (${txt.split('\n').length} lines)`);

  /* the header has to make the rows readable without knowing how the tab was
     set — this is the thing a pasted screenshot of the table always lost */
  ok(/^HARDGATE 80PERCENT/.test(txt), 'the copy names itself');
  ok(/venue: (XM|PAXG)/.test(txt), 'and the venue that priced it');
  ok(/spec: EMA50\/200, RSI\(14\) < 45 \/ > 55, TP 0\.75xATR, SL 4xATR/.test(txt),
     'and the spec thresholds in full');
  ok(/wide: same rules, RSI < 55 \/ > 45/.test(txt), 'and the wide mechanic\'s');
  ok(/recorded under P80W/.test(txt), 'naming the mechanic the wide rows are filed under');
  ok(/gross breakeven: 84\.2105%/.test(txt), 'and the bar every row has to clear');

  const tsvRows = txt.split('\n').filter(l => /^(5m|15m|1h|4h|1d)\t/.test(l));
  const ungRungs = ctx.hg80UngatedRungs();
  ok(tsvRows.length > 0, `${tsvRows.length} tab-separated rows`);
  ok(tsvRows.every(l => l.split('\t').length === 13),
     'every row has all thirteen columns, so it pastes into a spreadsheet unaltered');
  ok(tsvRows.every(l => ungRungs.indexOf(l.split('\t')[0]) >= 0),
     'and carries only the focused rungs, never a rung that is not on screen');
  ok(/\brung\twhen_utc\tmech\t/.test(txt), 'with a header row naming the columns');
  ok(ungRungs.every(t => new RegExp('^' + t + ' \\(', 'm').test(txt)),
     'each focused rung gets its own summary line above the rows');
  ok(/Not a backtest, not sequential, no win rate/.test(txt),
     'the disclaimers travel WITH the data — a paste that loses them is how a fetch-window '
     + 'resolution gets quoted as a track record');
  ok(/WATCH/.test(txt), 'and it says both mechanics are unmeasured');
  ok(!/winRate|hit rate|win rate:/i.test(txt), 'no rate is computed into the copy');

  fetched.length = 0;
  node.querySelector('#p80Body').querySelectorAll('[data-p80-focus]')
      .find(b => b.getAttribute('data-p80-focus') === '').click();
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));
  ok(fetched.length === ctx.HG_P80_LADDER.length, 'ALL restores the whole ladder');
  ok(!/EVERYTHING 4h FIRED/.test(String(node.querySelector('#p80Body').innerHTML)),
     'and the focused panel goes away with it');

  ok(!('hg_p80_focus' in store) && !Object.keys(store).some(k => /focus/i.test(k)),
     'the focus is NOT written to storage — the venue is desk-wide state that belongs there, a '
     + 'view filter is not, and a second key would split "what is stored about the gold desk"');
}

console.log('\n== SIMPLE is the default, and it reads as a trade ==');
{
  ok(/view: 'simple'/.test(SRC), 'the tab opens in SIMPLE');
  ok(/data-p80-view/.test(SRC), 'with a toggle to FULL');
  ok(/a view change is a re-render, not a re-fetch/.test(SRC),
     'and switching view re-renders the bars in hand rather than refetching them');

  const walk = (tfSec, n) => {
    const out = []; let px = 4300, st = tfSec;
    const rnd = () => { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff; };
    const vol = 3.1 * Math.sqrt(tfSec / 300);
    const end = Math.floor(Date.UTC(2026, 8, 17, 16, 0, 0) / 1000 / tfSec) * tfSec;
    for (let i = 0; i < n; i++){
      const o = px, c = o + (rnd() - 0.5) * vol;
      out.push({ t: end - (n - 1 - i) * tfSec, o, h: Math.max(o, c) + rnd() * vol * 0.6,
                 l: Math.min(o, c) - rnd() * vol * 0.6, c, v: 1 });
      px = c;
    }
    return out;
  };
  const secOf = Object.fromEntries(ctx.HG_P80_LADDER.map(r => [r.tf, r.sec]));
  ctx.hgOgFetchRows = (tf, n) => Promise.resolve({ rows: walk(secOf[tf], n), source: 'fixture' });

  const node = mkEl('div');
  const tab = (ctx.HG_tabs || []).find(t => t && t.id === '80percent');
  tab.mount(node);
  await settle();
  /* an earlier block in this file switched the view to FULL, and the module
     keeps that across mounts — so this asserts SIMPLE explicitly rather than
     relying on a default another test may have moved */
  press(node, 'data-p80-view', 'simple');
  await settle();
  const html = String(node.querySelector('#p80Body').innerHTML);

  ok(/<h2>SETUPS/.test(html), 'SETUPS is the first panel, not the arithmetic');
  ok(/ENTRY/.test(html) && /STOP LOSS/.test(html) && /TAKE PROFIT/.test(html),
     'every card names entry, stop loss and take profit in those words');
  ok(/BUY XAUUSD|SELL XAUUSD/.test(html), 'and says BUY or SELL rather than long/short');

  /* the default view must NOT open with the analysis that buried the setups */
  ok(!/WHAT THIS CONFIGURATION HAS TO HIT/.test(html), 'the required-rate table is not in SIMPLE');
  ok(!/THE LADDER RIGHT NOW/.test(html), 'nor the ladder board');
  ok(!/NEAR MISSES/.test(html), 'nor the near misses');
  ok(!/WHY SO FEW/.test(html), 'nor the census');
  ok(/Switch to <b>FULL<\/b>/.test(html), 'but it says where they went');

  /* the honesty that must survive the simplification */
  ok(/WATCH — not a signal to act on/.test(html),
     'and the WATCH tag is on the card — simplifying the layout is not licence to drop the one '
     + 'line that separates a setup from a recommendation');
  ok(/no measured record on this desk/.test(html), 'saying why');

  /* THE RATIO, THE RIGHT WAY ROUND. p.rr is risk/reward = 5.33. Printed as
     "1:0.19" it reads as though the reward were the 1 — the flattering way
     round, and wrong. */
  ok(/risked for every 1 gained/.test(html), 'the ratio is stated as risk for reward');
  ok(/5\.33 risked for every 1 gained/.test(html),
     'and it is 5.33 risked per 1 gained, not "1:0.19" with the reward as the unit');
  ok(!/reward:risk 1:0\.19/.test(html), 'the inverted phrasing is gone');
  const m = html.match(/You risk ([0-9.]+) to make ([0-9.]+)/);
  ok(!!m, 'the card states both legs in points');
  ok(Number(m[1]) > Number(m[2]),
     `and the risk (${m[1]}) really is the larger number (${m[2]}) — a card that printed it the `
     + 'other way round would be describing a trade this strategy never takes');

  ok(!/ENTRY<\/b><\/td><td[^>]*>[0-9.]+<\/td><td[^>]*>[0-9.]+ away/.test(html),
     'the ENTRY row carries no distance-from-itself — "+0.00 (+0.00%)" in the place the eye goes '
     + 'first is noise');
  ok(!/ 1 bars ago/.test(html), 'and ages are pluralised properly');
}

console.log('\n== the clock is shown in the reader\'s own zone, from the runtime ==');
{
  /* Every rule here is written in UTC and every time was printed in UTC,
     which is correct and unreadable. A desk in India reading "13:00 UTC" has
     to do five-and-a-half hours of arithmetic before it knows whether that is
     lunchtime or bedtime. */
  const tz0 = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Kolkata';
    const ist = ctx.hg80SessionLocalTxt();
    ok(/18:30-23:30/.test(ist), `in Kolkata the window reads ${ist} — 18:30 to 23:30`);

    process.env.TZ = 'UTC';
    const utc = ctx.hg80SessionLocalTxt();
    ok(/13:00-18:00/.test(utc), `in UTC the same window reads ${utc}`);

    process.env.TZ = 'America/New_York';
    const ny = ctx.hg80SessionLocalTxt();
    ok(/09:00-14:00|08:00-13:00/.test(ny), `and in New York ${ny}`);

    ok(ist !== utc && utc !== ny,
       'three zones, three answers — the offset comes from the RUNTIME, so it is right after a '
       + 'daylight-saving change nobody remembered to code for');
    ok(!/5\.5|19800|\+ 5 \* 3600|330 \* 60/.test(CODE),
       'and no offset is hardcoded anywhere — a fixed IST would be wrong for every other reader '
       + 'and wrong in India the day the rule changes');
    ok(/toLocaleString|toLocaleTimeString|toLocaleDateString/.test(CODE),
       'the conversion formats a real instant rather than adding hours by hand, which is what '
       + 'makes a half-hour zone and a window crossing midnight both come out right');

    /* a half-hour zone is the case hand-rolled offset maths gets wrong */
    process.env.TZ = 'Asia/Kolkata';
    const w = ctx.hg80WhenTxt(Date.UTC(2026, 8, 16, 17, 50, 0) / 1000, true);
    ok(/23:20/.test(w), `a 17:50 UTC bar reads 23:20 locally (${w})`);
    ok(/17:50 UTC/.test(w), 'with the UTC time kept beside it, because the rules are written in UTC');
    ok(!/2026-09-16 17:50 UTC/.test(w),
       'and the date is carried once, by the local half — repeating it doubles every card header '
       + 'for no information');
  } finally {
    if (tz0 === undefined) delete process.env.TZ; else process.env.TZ = tz0;
  }
}

console.log('\n== the tab says WHEN it can fire, and refuses to say WHETHER ==');
{
  ok(/WHEN THESE CAN FIRE/.test(SRC), 'SIMPLE carries a session-clock panel');
  ok(/your clock: /.test(SRC), 'naming the reader\'s zone so the times are not ambiguous');
  ok(/no session rule applies at those timeframes/.test(SRC),
     'and separating the rungs that can fire at any hour from the ones on a clock');
  ok(/The window is the only part that can be put in a diary/.test(SRC),
     'it says the window is schedulable');
  ok(/a setup exists once a candle closes, not before/.test(SRC),
     'and that whether the conditions line up inside it is NOT knowable in advance — the honest '
     + 'answer to "show me setups that are going to happen"');
  /* the assertive forms only — "it is not a forecast" is the disclaimer,
     not the claim, and a pattern blunt enough to catch both catches the
     wrong one */
  ok(!/will fire|upcoming setup|predicted|is a forecast|expect(ed)? to fire/i.test(CODE),
     'nothing in the code claims a future setup');
  ok(/not a forecast/.test(CODE), 'and it says so where a reader might assume otherwise');
}

console.log('\n== ARMED: the forward-looking half that was missing ==');
{
  /* "A setup exists once a candle closes, not before" was true and was not
     the whole truth. THREE of the four conditions are already settled on the
     last closed candle — trend, pullback, session. Only the trigger waits.
     A rung with the other three holding is one candle away, and what would
     trip it can be stated exactly. */

  const B = ctx.hg80SecsToBarClose;
  for (const sec of [300, 900, 3600, 14400, 86400]){
    const t = 1789000000;
    const left = B(sec, t);
    ok(left > 0 && left <= sec, `${sec}s bars: ${left}s left, inside (0, ${sec}]`);
    ok((Math.floor(t / sec) * sec) + sec === t + left, 'and it lands exactly on the bar boundary');
  }
  ok(B(3600, 1789000000 - (1789000000 % 3600)) === 3600,
     'a bar that just opened has a full period left, never zero');
  ok(B(0, 1) === null && B(3600, NaN) === null, 'nonsense returns null rather than a number');

  /* a fixture that is armed: trend, pullback and session hold, and the last
     candle closed the WRONG way */
  const rows = series(280, { tfSec: 900, endHour: 15 });
  const lastBar = rows[rows.length - 1];
  lastBar.c = lastBar.o - 0.5;                      /* red close kills the LONG trigger */
  lastBar.l = Math.min(lastBar.l, lastBar.c - 0.2);
  const def = { tf: '15m', sec: 900, bars: 280, band: 'scalp' };
  const out = ctx.hg80ScanTf(rows, def, ctx.hg80VenueRt());
  const ind = ctx.hg80Indicators(rows);
  const chk = ctx.hg80SignalAt(rows, ind, rows.length - 1, out.cfg, ctx.hg80Variant('spec'));
  ok(chk.longChecks.trend && chk.longChecks.pullback && chk.longChecks.session,
     'the fixture has trend, pullback and session holding for a long');
  ok(chk.longChecks.trigger === false && chk.dir === null,
     'and only the candle direction missing, so it did NOT fire');

  const armed = ctx.hg80Armed([out]);
  ok(armed.length >= 1, `it reports as armed (${armed.length})`);
  const a = armed.find(x => x.side === 'long');
  ok(!!a, 'on the long side');
  ok(a.rung.def.tf === '15m' && !!a.variant.key, 'naming the rung and the mechanic');

  /* the projected levels use the SPEC's own multiples, not a softened pair */
  ok(near((a.entryEst - a.stopEst) / a.atr, 4.00, 1e-9),
     'the projected stop is the spec\'s 4.00 x ATR below the level');
  ok(near((a.targetEst - a.entryEst) / a.atr, 0.75, 1e-9), 'and the target its 0.75 x ATR above');
  ok(a.closesIn > 0 && a.closesIn <= 900, 'with the countdown to this bar\'s close');

  /* ONLY the trigger may be missing. A rung missing its trend is days away
     on a 4h chart and calling it "one candle" would be the same flattery as
     printing the risk:reward upside down. */
  ok(armed.length > 0, 'there are armed rows to check — otherwise the loop below proves nothing');
  for (const x of armed){
    const sc = ctx.hg80Score(x.side === 'long' ? x.sig.longChecks : x.sig.shortChecks);
    ok(sc.missing.length === 1 && sc.missing[0] === 'trigger',
       `${x.rung.def.tf} ${x.side} is missing the trigger and nothing else`);
  }
  /* and the negative: a series whose trend is against the long side must not
     produce an armed long however close the other conditions are */
  const rows2 = series(280, { tfSec: 900, endHour: 15, down: true });
  const out2 = ctx.hg80ScanTf(rows2, def, ctx.hg80VenueRt());
  const ind2 = ctx.hg80Indicators(rows2);
  const c2 = ctx.hg80SignalAt(rows2, ind2, rows2.length - 1, out2.cfg, ctx.hg80Variant('spec'));
  ok(c2.longChecks.trend === false, 'the downtrend fixture fails the long trend condition');
  ok(!ctx.hg80Armed([out2]).some(x => x.side === 'long'),
     'and no armed LONG is reported for it — a rung missing its trend is days away on a 4h '
     + 'chart, and calling that "one candle" would be the same flattery as printing the '
     + 'risk:reward upside down');
  const outOfSession = ctx.hg80ScanTf(series(280, { tfSec: 900, endHour: 4 }), def, ctx.hg80VenueRt());
  ok(ctx.hg80Armed([outOfSession]).every(x => {
       const sc = ctx.hg80Score(x.side === 'long' ? x.sig.longChecks : x.sig.shortChecks);
       return sc.missing.length === 1 && sc.missing[0] === 'trigger';
     }),
     'a rung outside its session window is never called armed — the clock is not a candle');

  /* soonest decision first */
  const many = ctx.hg80Armed([out, outOfSession]);
  ok(many.every((x, i) => i === 0 || x.closesIn >= many[i - 1].closesIn),
     'armed rows are ordered by which candle closes first — a 5m bar closing in 90 seconds is '
     + 'more use than a daily one closing in nine hours');
}

console.log('\n== the armed panel says what would trip it, and what it does not promise ==');
{
  ok(/ARMED — ONE CANDLE AWAY/.test(SRC), 'the panel exists');
  ok(/Fires if this candle closes/.test(SRC), 'it states the condition that would trip it');
  ok(/ABOVE' : 'BELOW/.test(SRC), 'in the right direction for each side');
  ok(/so watch that level/.test(SRC), 'and gives the price to watch');
  ok(/Candle closes in/.test(SRC), 'with a countdown to the decision');
  ok(/likely ENTRY/.test(SRC) && /likely STOP LOSS/.test(SRC) && /likely TAKE PROFIT/.test(SRC),
     'and the three levels, marked LIKELY rather than stated as facts');

  ok(/<b>Armed is not a promise\.<\/b>/.test(SRC), 'the disclaimer is on every armed card');
  /* flattened, because the sentence is built by concatenation across lines */
  const FLAT0 = SRC.replace(/'\s*\+\s*'/g, '').replace(/\s+/g, ' ');
  ok(/any of them can drop out before it closes/.test(FLAT0),
     'saying the other conditions are recomputed on the new candle too');
  ok(/on the rungs where a bar can fit inside the window/.test(FLAT0),
     'and qualifying the session, which 4h and 1d never ran — claiming a condition a rung did '
     + 'not evaluate is the same lie as a green session chip on a card that skipped the filter');
  /* the sentence is built by concatenation, so it is flattened before
     matching — a regex that only sees one source line would miss it */
  const FLAT = SRC.replace(/'\s*\+\s*'/g, '').replace(/\s+/g, ' ');
  ok(/the real ones are set by whichever candle actually fires/.test(FLAT),
     'and that the projected levels are not the ones that will be used');
  ok(/armedHtml\(rungs, gradePx\);/.test(SRC), 'wired into SIMPLE');
  const iArmed = SRC.indexOf('h += armedHtml(rungs, gradePx);');
  const iSetups = SRC.indexOf('h += simpleSetupsHtml(shown, gradePx);');
  ok(iArmed > 0 && iSetups > 0 && iArmed < iSetups,
     'and rendered ABOVE the finished setups — what might happen next is worth more than what '
     + 'already did');
  /* THE WHOLE LADDER, not the focused subset. Everything backward-looking
     takes `shown`; this one takes `rungs`, and that difference is the point
     — a view filter must not be able to hide a rung about to fire. */
  ok(!/armedHtml\(shown/.test(SRC),
     'and it reads the WHOLE ladder, never the focus-filtered set');

  /* AND NEITHER DOES THE LOG. The recording loop always read `rungs`, but
     `rungs` used to BE the focused subset, so a 5m firing went unrecorded
     whenever somebody happened to be looking at 1d. A record that exists or
     not according to a view setting is not evidence of anything. */
  const RUN = SRC.slice(SRC.indexOf('function run('));
  ok(/for \(i = 0; i < rungs\.length; i\+\+\)\{[\s\S]{0,400}hg80Record/.test(RUN),
     'the forward log records over every rung scanned, not the focused subset');
  ok(!/hg80Shown/.test(RUN.slice(0, RUN.indexOf('render('))),
     'and nothing between the scan and the render narrows what gets recorded');
  ok((SRC.slice(SRC.indexOf('function render(')).match(/armedHtml\(rungs, gradePx\)/g) || []).length >= 2,
     'in both views');
  /* GRADED ON THE FEED, NOT ON SPOT. __p.spot is the cross-check and must
     never reach a card. */
  ok(!/armedHtml\(rungs, spot\)|simpleSetupsHtml\(shown, spot\)/.test(SRC),
     'and no card is ever graded against the foreign spot price');
}

console.log('\n== ONE STEP BEHIND: what is two away, when the second thing can move ==');
{
  const def = { tf: '15m', sec: 900, bars: 280, band: 'scalp' };

  /* (1) TREND HOLDS, RSI NOWHERE NEAR: a long whose pullback never happened.
     Missing = trigger + pullback, which is the row a reader wants when
     nothing is armed and the tab would otherwise show them nothing. */
  const rowsP = series(280, { tfSec: 900, endHour: 15, dip: 0.2 });
  const lp = rowsP[rowsP.length - 1];
  lp.c = lp.o - 0.5; lp.l = Math.min(lp.l, lp.c - 0.2);   /* red close kills the trigger */
  const outP = ctx.hg80ScanTf(rowsP, def, ctx.hg80VenueRt());
  const indP = ctx.hg80Indicators(rowsP);
  const cP = ctx.hg80SignalAt(rowsP, indP, rowsP.length - 1, outP.cfg, ctx.hg80Variant('spec'));
  ok(cP.longChecks.trend && cP.longChecks.session
     && !cP.longChecks.pullback && !cP.longChecks.trigger,
     'the fixture has trend and session holding, and BOTH the pullback and the trigger missing');
  ok(ctx.hg80Armed([outP]).length === 0, 'so nothing is armed on it — two conditions short');

  const armP = ctx.hg80Arming([outP], []);
  const aP = armP.find(x => x.side === 'long');
  ok(!!aP, 'but it IS reported one step behind, on the long side');
  ok(aP.need.kind === 'pullback', 'with the RSI pullback named as the outstanding condition');
  ok(near(aP.need.rsi, cP.rsi, 1e-9) && aP.need.gap > 0,
     `quantified rather than shrugged at: RSI ${aP.need.rsi.toFixed(1)}, `
     + `${aP.need.gap.toFixed(1)} points to travel`);
  ok(/has to get below/.test(aP.need.txt) && new RegExp(String(aP.need.want)).test(aP.need.txt),
     `and written out in words: "${aP.need.txt}"`);

  /* THE NEAREST THRESHOLD, NOT THE TIGHTEST MECHANIC. Breaking on the first
     variant that qualified printed the SPEC's 45 — 40 points away — while
     WIDE's 55 was ten points nearer and is the one that would trip first.
     Same error the ladder board made before the distance was weighted. */
  let nearest = null;
  for (const v of ctx.HG_P80_VARIANTS){
    const g = Math.abs(cP.rsi - v.rsiLong);
    if (nearest == null || g < nearest) nearest = g;
  }
  ok(near(aP.need.gap, nearest, 1e-9),
     `it measures to the NEAREST mechanic's threshold (${aP.variant.label} at ${aP.need.want}), `
     + 'not the tightest one — the right distance to the wrong place is still the wrong answer');

  /* (2) THE CLOCK, which is the other thing that moves on its own. */
  const rowsS = series(280, { tfSec: 900, endHour: 4, dip: 2.6 });
  const ls = rowsS[rowsS.length - 1];
  ls.c = ls.o - 0.5; ls.l = Math.min(ls.l, ls.c - 0.2);
  const outS = ctx.hg80ScanTf(rowsS, def, ctx.hg80VenueRt());
  const armS = ctx.hg80Arming([outS], []);
  const aS = armS.find(x => x.side === 'long');
  ok(!!aS && aS.need.kind === 'session',
     'a rung whose only other gap is the session names the CLOCK, not an indicator');
  ok(aS.need.secs > 0 && /opens in/.test(aS.need.txt),
     `with the wait stated: "${aS.need.txt}"`);

  /* (3) TREND IS NEVER THE SECOND THING. A rung needing its EMAs to recross
     is not two conditions from a trade in any sense worth showing next to
     one that needs a red candle — the same line hg80Armed draws. */
  const rowsD = series(280, { tfSec: 900, endHour: 15, down: true });
  const outD = ctx.hg80ScanTf(rowsD, def, ctx.hg80VenueRt());
  ok(!ctx.hg80Arming([outD], []).some(x => x.side === 'long'),
     'a downtrend fixture reports no LONG one step behind, however close the rest is');
  for (const x of ctx.hg80Arming([outP, outS, outD], [])){
    const sc = ctx.hg80Score(x.side === 'long' ? x.sig.longChecks : x.sig.shortChecks);
    ok(sc.missing.indexOf('trend') < 0,
       `${x.rung.def.tf} ${x.side} is not listed with its trend missing`);
    ok(sc.missing.length === 2 && sc.missing.indexOf('trigger') >= 0,
       'and is exactly two away, one of them the trigger');
  }

  /* (4) THE STRONGER ROW WINS. A rung/side already ARMED must not appear a
     second time in the weaker tier. */
  const rowsA = series(280, { tfSec: 900, endHour: 15 });
  const la = rowsA[rowsA.length - 1];
  la.c = la.o - 0.5; la.l = Math.min(la.l, la.c - 0.2);
  const outA = ctx.hg80ScanTf(rowsA, def, ctx.hg80VenueRt());
  const armedA = ctx.hg80Armed([outA]);
  ok(armedA.some(x => x.side === 'long'), 'the armed fixture is armed long');
  ok(!ctx.hg80Arming([outA], armedA).some(x => x.side === 'long'),
     'and it is NOT repeated one step behind — the stronger row is the one that belongs');
  ok(ctx.hg80Arming([outA], []).length >= 0, 'passing no armed list is not an error');
}

console.log('\n== the panel groups scalp and swing, and counts both sides ==');
{
  const def15 = { tf: '15m', sec: 900, bars: 280, band: 'scalp' };
  const def1d = { tf: '1d', sec: 86400, bars: 280, band: 'swing' };
  const mk = (o, d) => {
    const r = series(280, o);
    const l = r[r.length - 1];
    l.c = l.o - 0.5; l.l = Math.min(l.l, l.c - 0.2);
    return ctx.hg80ScanTf(r, d, ctx.hg80VenueRt());
  };
  const scalp = mk({ tfSec: 900, endHour: 15 }, def15);
  const swing = mk({ tfSec: 86400, endHour: 15 }, def1d);
  const html = ctx.armedHtml([scalp, swing]);
  ok(html.length > 0, 'the panel renders for a ladder with rows in both bands');
  ok(/WHAT IS COMING/.test(html), 'under a heading that says what it is');
  ok(/>SCALP</.test(html) && /<b>SWING<\/b>/.test(html),
     'with SCALP and SWING as separate blocks — a 5m row and a 1d row share every rule and '
     + 'nothing about how long you sit in them');
  ok(/[0-9]+ long/.test(html) && /[0-9]+ short/.test(html),
     'and both directions counted on the page, so "does this thing ever short?" is not a '
     + 'question a reader has to audit the rows to answer');
  ok(!/NaN|undefined/.test(html), 'and nothing renders as NaN or undefined');

  /* the forward panel reads the WHOLE ladder even when the focus is narrow */
  ok(ctx.hg80Shown([scalp, swing]).length === 2, 'with no focus set, every rung is shown');
}

console.log('\n== what the venue takes out of the win, on the card itself ==');
{
  const V = (cost, target) => ctx.hg80CostVerdict({ cost, target, risk: target * 4 / 0.75,
                                                    net: null, gross: 0.842105 });
  ok(ctx.hg80CostVerdict(null).key === 'unknown', 'no breakeven means UNKNOWN, never a guess');
  ok(ctx.hg80CostVerdict({ cost: NaN, target: 2 }).key === 'unknown',
     'and an unreadable venue is unknown too, not silently treated as free');

  const gone = V(3.0, 2.0);
  ok(gone.key === 'gone' && gone.share > 1,
     'a round trip larger than the target is GONE — that is a fact, not a preference');

  const clear = V(0.02, 2.39);
  ok(clear.key === 'clear' && clear.expR > 0,
     `a cost that is ${(clear.share * 100).toFixed(1)}% of the target is a small share`);

  const heavy = V(0.87, 2.39);
  ok(heavy.share > ctx.HG_P80_COST_HEAVY,
     `the real 5m number from the live desk — 0.87 against a 2.39 target — is `
     + `${(heavy.share * 100).toFixed(0)}% of the winner`);
  ok(heavy.key === 'heavy' || heavy.key === 'negative',
     `and is flagged (${heavy.key}) rather than shown as an ordinary setup`);

  /* the threshold is a DISPLAY line and is named as one; the two verdicts
     that are not judgement calls are asserted to be arithmetic */
  ok(ctx.HG_P80_COST_HEAVY > 0 && ctx.HG_P80_COST_HEAVY < 1,
     'the cost-heavy line is a fraction of the target');
  ok(/display threshold/.test(SRC),
     'and the source says it is a display threshold, not a measured one');

  const line = ctx.costLineHtml ? ctx.costLineHtml({ cost: 0.87, target: 2.39, risk: 12.7 }, 'XM') : '';
  if (line){
    ok(/36% of the winner/.test(line), `the card states the share in words: it renders "36%"`);
    ok(/XM/.test(line), 'naming the venue that charged it');
  }
  /* a breakeven with no stop distance still has a true cost SHARE and no
     expectancy; the line must say so rather than print NaN */
  const noRisk = ctx.costLineHtml({ cost: 0.87, target: 2.39 }, 'XM');
  ok(!/NaN/.test(noRisk),
     'a rung with no stop distance renders no NaN — the share is still true, the R figure is '
     + 'simply not available and is named as such');
  ok(/36% of the winner/.test(noRisk), 'and the share it CAN compute is still shown');

  ok(/costLineHtml\(rung\.be/.test(SRC), 'and it is wired into the setup card');
  ok(/costLineHtml\(a\.rung\.be/.test(SRC), 'and onto the armed rows too');
}

console.log('\n== the forming bar is not a closed bar, and 5m was reading it as one ==');
{
  /* THE BUG. The feed strips the unfinished bar via dropForming(rows, tf) ->
     getClosedCandles(rows, tf, now). Both look the timeframe up in a table,
     and neither table lists 5m — getClosedCandles hits `if (!sec) return
     clean` and hands back every row including the forming one. So four rungs
     of this ladder dropped it and the finest did not. */
  const CORE = fs.readFileSync(path.join(ROOT, 'hg-setup-core.js'), 'utf8');
  const tfTable = (CORE.match(/var TF_SEC = \{([^}]*)\}/) || [])[1] || '';
  /* The shared table has since been fixed for every desk (see
     test-closed-candle-tables.mjs), so the feed now strips 5m correctly on
     its own. This rung keeps its own split anyway and that is deliberate:
     the split is idempotent, it costs one comparison, and it is the reason
     this tab did not have to wait for a repo-wide change to stop scanning
     an unfinished candle. Depending on no lookup table is the property
     worth keeping, not a workaround to retire. */
  ok(/'5m'/.test(tfTable),
     'the shared getClosedCandles table now knows 5m — fixed for every desk, not just this tab');

  /* ...and this rung still does its own, from seconds it already owns. */
  const now = Math.floor(Date.UTC(2026, 8, 17, 12, 2, 30) / 1000);   /* 150s into a 5m bar */
  const mk = (tfSec, n) => {
    const out = [], last = Math.floor(now / tfSec) * tfSec;
    for (let i = n - 1; i >= 0; i--) out.push({ t: last - i * tfSec, o: 4300, h: 4301, l: 4299,
                                                c: 4300 + i, v: 1 });
    return out;
  };

  const five = mk(300, 5);
  const sp5 = ctx.hg80SplitForming(five, 300, now);
  ok(sp5.closed.length === five.length - 1,
     `a 5m bar 150s old is still forming, so it is dropped (${five.length} -> ${sp5.closed.length})`);
  ok(sp5.forming === five[five.length - 1],
     'and handed back separately rather than thrown away');

  /* every coarser rung: the same bar age is NOT forming, nothing is dropped */
  for (const [tf, sec] of [['15m', 900], ['1h', 3600], ['4h', 14400], ['1d', 86400]]){
    const rows = mk(sec, 5);
    const sp = ctx.hg80SplitForming(rows, sec, now + sec);   /* a bar that HAS closed */
    ok(sp.closed.length === rows.length && sp.forming === null,
       `${tf}: a closed bar is left alone — the split is idempotent where the feed already did it`);
  }

  /* the rule is arithmetic on the rung's own seconds, so it cannot acquire a
     missing-key bug the way the shared table did */
  ok(ctx.hg80SplitForming(mk(300, 5), 300, now + 300).forming === null,
     'once the interval has elapsed the same bar counts as closed');
  ok(!/TF_SEC|\{ *'15m'/.test(SRC.slice(SRC.indexOf('function hg80SplitForming'),
                                         SRC.indexOf('function hg80SplitForming') + 700)),
     'and it uses NO timeframe lookup table of its own');

  /* degenerate inputs never throw */
  ok(ctx.hg80SplitForming([], 300, now).closed.length === 0, 'empty rows are safe');
  ok(ctx.hg80SplitForming(null, 300, now).forming === null, 'null rows are safe');
  ok(ctx.hg80SplitForming(mk(300, 3), 0, now).forming === null,
     'a zero timeframe drops nothing rather than guessing');
  const ms = [{ t: (now - 60) * 1000, o: 1, h: 1, l: 1, c: 1 }];
  ok(ctx.hg80SplitForming(ms, 300, now).forming === ms[0],
     'millisecond timestamps are handled, same rule the desk uses');

  /* AND THE WIRING: the scan applies it to every rung, by def.sec */
  ok(/hg80SplitForming\(rows, def\.sec/.test(SRC),
     'the scan splits every rung by ITS OWN seconds, not by a lookup');
  ok(/rows = split\.closed;/.test(SRC), 'and scans only the closed remainder');

  /* AND THE ORDER MATTERS. hgFwdResolve settles this rung's OPEN forward
     records against these bars. If it ran before the split, a 5m record
     could be settled — won or lost — by the wick of a candle that had not
     closed and might not end there. */
  const FETCH = SRC.slice(SRC.indexOf('var rows = (got && got.rows)'),
                          SRC.indexOf('rungs.push(hg80ScanTf'));
  ok(FETCH.indexOf('split.closed') < FETCH.indexOf('hgFwdResolve'),
     'the forming bar is dropped BEFORE the forward log settles against these rows — a record '
     + 'must not be won or lost by a candle that has not closed');
  ok(FETCH.indexOf('split.closed') < FETCH.indexOf('formingPx.push'),
     'and the live price is taken from the bar that was dropped, not from one still in the scan');
}

console.log('\n== and the tab really does refuse the forming bar end to end ==');
{
  /* the assertions above are about a helper. This one DRIVES the tab with a
     feed that hands back an unfinished bar on EVERY rung — which is exactly
     what the real feed does on 5m, because its strip has no 5m key — and
     reads what each rung ended up scanning off the rendered board. */
  for (const k of Object.keys(store)) delete store[k];
  const secOf = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
  const nowS = Math.floor(Date.now() / 1000);
  const handed = {};
  ctx.hgOgFetchRows = (tf, n) => {
    const tfSec = secOf[tf], out = [], lastOpen = Math.floor(nowS / tfSec) * tfSec;
    let px = 4300;
    for (let i = n - 1; i >= 0; i--){
      const o = px, c = px + (i % 3 === 0 ? 1.1 : -0.7);
      out.push({ t: lastOpen - i * tfSec, o, h: Math.max(o, c) + 0.3,
                 l: Math.min(o, c) - 0.3, c, v: 1 });
      px = c;
    }
    handed[tf] = out[out.length - 1].t;      /* the still-forming bar */
    return Promise.resolve({ rows: out, source: 'fixture' });
  };
  ctx.hgGoldLiveSpot = undefined;

  const tab = (ctx.HG_tabs || []).find(t => t && t.id === '80percent');
  const node = mkEl('div');
  tab.mount(node);
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));
  press(node, 'data-p80-view', 'full');
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 0));

  const html = String(node.querySelector('#p80Body').innerHTML);
  ok(/THE LADDER RIGHT NOW/.test(html), 'the board rendered, so there is something to read');

  /* <td><b>5m</b></td><td>scalp</td><td>09-17 12:00</td> — the board prints
     each rung's last SCANNED bar, which is the thing under test */
  const seen = {};
  for (const m of html.matchAll(
      /<tr><td><b>(5m|15m|1h|4h|1d)<\/b><\/td><td>[a-z]+<\/td><td>([0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2})<\/td>/g)){
    seen[m[1]] = m[2];
  }
  ok(Object.keys(seen).length === ctx.HG_P80_LADDER.length,
     `every rung reports a last bar on the board (${Object.keys(seen).length})`);

  const yr = new Date(nowS * 1000).getUTCFullYear();
  for (const tf of Object.keys(seen)){
    const t = Math.floor(Date.parse(yr + '-' + seen[tf].replace(' ', 'T') + ':00Z') / 1000);
    const sec = secOf[tf];
    ok(t !== handed[tf],
       `${tf}: the newest bar the feed handed over was still forming, and is NOT the one the `
       + 'rung scanned');
    ok((nowS - t) >= sec,
       `${tf}: the bar it DID scan opened at least one full ${sec}s interval ago, so it closed`);
  }
}

console.log('\n== the live gold price, and what it says about a setup ==');
{
  ok(typeof ctx.hgLivePriceGrade === 'function',
     'the desk\'s shared live-price grader is loaded — this tab delegates to it rather than '
     + 'writing a second definition of "past the stop"');

  /* BOTH HELPERS HAVE TO BE ON THE PAGE BEFORE THIS TAB. The lookups are by
     name at CALL time, so a reorder degrades to "not available" rather than
     throwing — but degraded is not the same as working, and the thing that
     makes it work in the browser is this ordering. */
  const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = f => HTML.indexOf('src="' + f + '?');
  ok(at('omniroute.js') > 0 && at('goldscalp.js') > 0 && at('eightypercent.js') > 0,
     'omniroute.js, goldscalp.js and eightypercent.js are all on the page');
  ok(at('omniroute.js') < at('eightypercent.js'),
     'omniroute.js loads first — it defines hgLivePriceGrade');
  ok(at('goldscalp.js') < at('eightypercent.js'),
     'and goldscalp.js loads first — it defines hgGoldLiveSpot');
  ok(/gfn\('hgGoldLiveSpot'\)/.test(SRC) && /gfn\('hgLivePriceGrade'\)/.test(SRC),
     'and both are looked up by name at call time, so a reorder degrades rather than throws');

  /* ---- the bounded read ---- */
  const realSetTimeout = ctx.setTimeout;
  ctx.hgGoldLiveSpot = undefined;
  const noReader = await ctx.hg80LiveSpot(4300);
  ok(Number.isNaN(noReader), 'with no spot reader loaded the read resolves NaN, never throws');

  ctx.hgGoldLiveSpot = () => { throw new Error('boom'); };
  ok(Number.isNaN(await ctx.hg80LiveSpot(4300)),
     'a reader that throws resolves NaN — a price endpoint cannot break the scan');

  ctx.hgGoldLiveSpot = () => Promise.resolve(-1);
  ok(Number.isNaN(await ctx.hg80LiveSpot(4300)), 'and a nonsense price is rejected, not shown');

  /* THE HARNESS FIRES setTimeout IMMEDIATELY, so the bounded read's race
     would always be won by its own timeout and the happy path would never
     run. Swap in Node's real timer for this one check — otherwise the
     assertion that a price comes back would be structurally unreachable. */
  ctx.setTimeout = (fn, ms) => globalThis.setTimeout(fn, ms);
  ctx.hgGoldLiveSpot = () => Promise.resolve(4312.4);
  const got = await ctx.hg80LiveSpot(4300);
  ok(got === 4312.4, `a reader that answers gives the price back (${got})`);
  ctx.setTimeout = realSetTimeout;

  /* ---- the grades, and which of them are still a trade ---- */
  const plan = { dir: 'long', entry: 4300, stop: 4288, t1: 4302.25 };
  const sig = { dir: 'long', plan: plan };
  ok(ctx.hg80LiveGrade(sig, NaN) === null, 'no live price means no grade — never a guess');
  ok(ctx.hg80LiveGrade({ dir: 'long' }, 4300) === null, 'and no plan means no grade');

  ok(ctx.hg80LiveGrade(sig, 4280) === 'past-stop',
     'a long whose stop has traded through grades past-stop');
  ok(ctx.hg80LiveGrade(sig, 4310) === 'past-t1', 'and one past its target grades past-t1');
  ok(ctx.hg80LiveGrade(sig, 4295) === 'pending',
     'price on the pullback side of entry is pending — the fill is still ahead');

  const shortSig = { dir: 'short', plan: { dir: 'short', entry: 4300, stop: 4312, t1: 4297.75 } };
  ok(ctx.hg80LiveGrade(shortSig, 4320) === 'past-stop',
     'and a SHORT is graded the right way round — 4320 is through a 4312 stop, not under it');
  ok(ctx.hg80LiveGrade(shortSig, 4290) === 'past-t1', 'with its target BELOW the entry');

  ok(ctx.hg80LiveActs('past-stop') === false && ctx.hg80LiveActs('past-t1') === false,
     'past-stop and past-t1 are NOT actionable — that is the whole point of reading the price');
  for (const g of ['fresh', 'pending', 'past-entry']){
    ok(ctx.hg80LiveActs(g) === true, `${g} is still actionable`);
  }
  ok(ctx.hg80LiveActs(null) === true,
     'and an ungraded setup stays actionable — with no price read, the tab makes no claim '
     + 'either way rather than silently killing every card');

  /* every grade the shared grader can return has an entry here, or a card
     hits the fallback and says nothing */
  for (const g of ['fresh', 'pending', 'past-entry', 'past-t1', 'past-stop']){
    ok(!!ctx.HG_P80_LIVE_STATE[g] && typeof ctx.HG_P80_LIVE_STATE[g].txt === 'string',
       `${g} has words a reader can act on`);
  }
}

console.log('\n== a setup gold has already run past is NOT offered as one you could act on ==');
{
  /* THE BUG THIS EXISTS FOR. "STILL OPEN — neither the stop nor the target
     has been touched yet" was a statement about the FETCHED BARS, which end
     at the last close. A firing from four bars ago could be through its stop
     in the live market and this panel counted it under "setups you could act
     on" and printed an entry for it. */
  const def = { tf: '15m', sec: 900, bars: 320, band: 'scalp' };
  const rows = series(320, { tfSec: 900, endHour: 15, tail: 3 });
  const out = ctx.hg80ScanTf(rows, def, ctx.hg80VenueRt());
  const opens = out.res.signals.filter(x => x.status === 'open');
  ok(opens.length > 0, `the fixture leaves ${opens.length} setup(s) open at the last close`);

  const victim = opens[opens.length - 1];
  ok(victim.dir === 'long', 'the open one is a long');

  /* with NO live price the panel behaves exactly as it did before */
  const blind = ctx.simpleSetupsHtml([out], NaN);
  ok(/you could act on/.test(blind), 'with no live price the panel still offers the open setup');
  ok(!/NO LONGER TAKEABLE/.test(blind), 'and marks nothing dead on a price it never read');

  /* now put gold through the stop */
  const through = victim.plan.stop - 5;
  const graded = ctx.simpleSetupsHtml([out], through);
  ok(/NO LONGER TAKEABLE/.test(graded),
     `with gold at ${through.toFixed(2)} — below the ${victim.plan.stop.toFixed(2)} stop — the `
     + 'setup is marked no longer takeable');
  ok(/DEAD — gold is already through the stop/.test(graded),
     'in words, with the reason, not just a greyed-out chip');
  ok(!/[0-9]+ setups? you could act on/.test(graded)
     || /Nothing here is still takeable/.test(graded),
     'and it is NOT counted under "setups you could act on" — the count is the thing that was '
     + 'lying');

  /* and the honest opposite: price sitting on the entry is the best kind */
  const atEntry = ctx.simpleSetupsHtml([out], victim.plan.entry);
  ok(/AT ENTRY — gold is at this level right now/.test(atEntry),
     'price sitting on the entry says so');
  ok(/you could act on/.test(atEntry), 'and that one IS offered');

  /* THE RENDERERS TAKE THE PRICE, they do not reach for it. Passing it in is
     what makes all of the above assertable at all, and it is the same shape
     render() already uses for the venue. */
  ok(/function simpleSetupsHtml\(rungs, livePx\)/.test(SRC)
     && /function livePriceHtml\(gradePx, gradeTf, spot, feedRef, rungs\)/.test(SRC)
     && /function armedHtml\(rungs, livePx\)/.test(SRC),
     'livePriceHtml, armedHtml and simpleSetupsHtml all take the live price as an argument');
  ok(!/function (livePriceHtml|armedLiveHtml|simpleSetupsHtml)[\s\S]{0,300}__p\.spot/.test(SRC),
     'and none of them reads __p.spot out of module state');
}

console.log('\n== an armed row says which way the forming candle is leaning ==');
{
  /* the trigger is "closes the right side of its open", and the open is what
     the last bar closed at — so live price against that level says which
     side the unfinished candle is currently on. Not where it ends; nothing
     can say that. */
  const a = { side: 'long', level: 4300, rung: { def: { tf: '5m' } } };
  ok(ctx.armedLiveHtml(a, NaN) === '', 'with no live price the row says nothing extra');

  const up = ctx.armedLiveHtml(a, 4303.2);
  ok(/Leaning the right way/.test(up),
     'gold above the level leans the RIGHT way for a long needing a green close');
  ok(/3\.20<\/b> above/.test(up), 'with the distance stated');
  ok(/green close/.test(up), 'and the close it needs named');

  const down = ctx.armedLiveHtml(a, 4296.8);
  ok(/Leaning the wrong way/.test(down), 'gold below it leans the wrong way');
  ok(/3\.20<\/b> below/.test(down), 'with the distance the other way');

  /* and the mirror image, which is the half a long-only reading would miss */
  const sh = { side: 'short', level: 4300, rung: { def: { tf: '5m' } } };
  ok(/Leaning the right way/.test(ctx.armedLiveHtml(sh, 4296.8)),
     'a SHORT leans the right way when gold is BELOW the level');
  ok(/Leaning the wrong way/.test(ctx.armedLiveHtml(sh, 4303.2)),
     'and the wrong way when it is above — the test a long-only reading inverts');
  ok(/red close/.test(ctx.armedLiveHtml(sh, 4296.8)), 'needing a red close, not a green one');

  ok(/not finished/.test(up),
     'and every one of them says the candle is not finished — this is where it stands, not '
     + 'where it ends');
  ok(!/NaN|undefined/.test(up + down), 'nothing renders as NaN or undefined');
}

console.log('\n== the live price panel names which price grades, and which only cross-checks ==');
{
  const def = { tf: '15m', sec: 900, bars: 320, band: 'scalp' };
  const rungs = [ctx.hg80ScanTf(series(320, { tfSec: 900, endHour: 15 }), def, ctx.hg80VenueRt())];
  const ref = rungs[0].lastPx;

  const none = ctx.livePriceHtml(NaN, null, NaN, NaN, rungs);
  ok(/LIVE GOLD: not available this scan/.test(none),
     'with no feed-native price the panel says so plainly');
  ok(/no rung returned an unfinished bar/i.test(none),
     'and says exactly why there is none');
  ok(/comes from the last closed candle/.test(none),
     'and what the numbers below it are based on instead');

  const got = ctx.livePriceHtml(ref + 1.2, '5m', ref * 1.0009, ref, rungs);
  ok(/LIVE GOLD/.test(got) && new RegExp((ref + 1.2).toFixed(2)).test(got),
     'with one, it shows the price');
  ok(/from the 5m bar forming right now/.test(got),
     'naming the rung it came from — the freshest unfinished bar on the ladder');
  ok(/same feed the levels came from/.test(got),
     'and that it is the SAME feed as the levels, which is the entire reason it can grade them');

  /* THE ARGUMENT, WITH MEASURED NUMBERS. An earlier draft of this panel
     multiplied two constants and printed 3.000% for a target nearer 0.055%.
     The figure has to come from the rungs actually scanned. */
  const share = ctx.hg80TargetSharePct(rungs);
  ok(share !== null && share > 0 && share < 0.5,
     `the tightest target is measured off the ladder, not assumed (${share.toFixed(3)}% of price)`);
  ok(new RegExp(share.toFixed(3) + '% of').test(got.replace(/<[^>]+>/g, '')),
     'and that measured figure is what the panel prints');
  ok(ctx.hg80TargetSharePct([]) === null && ctx.hg80TargetSharePct(null) === null,
     'with nothing priced it returns null rather than a made-up number');

  ok(/Spot cross-check/.test(got), 'spot is shown');
  ok(/does not grade anything/.test(got),
     'and explicitly does NOT grade anything — a foreign feed cannot resolve a target this '
     + 'narrow');
  ok(/decide every card on the gap between the feeds/.test(got),
     'with the reason stated: the comparison would measure the feeds, not the market');
  ok(!/NaN|undefined/.test(got + none), 'and none of it renders as NaN or undefined');
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
