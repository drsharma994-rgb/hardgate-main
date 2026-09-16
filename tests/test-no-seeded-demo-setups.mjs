/* HARDGATE — the desk was seeding itself with invented setups.

   activate-setup-recording.js is loaded by index.html on every page load.
   Inside its initialize() callback, with no flag and no guard, it called
   engine.recordSetup() on six hard-coded rows:

     GOLD      LONG  EMA_CASCADE        entry 2050  conf 0.85  HIGH_CONVICTION
     OMNIGOLD  LONG  FORMATION_BREAKOUT entry 2048
     XAU/USD   SHORT DOUBLE_TOP         entry 2045
     BTC/USDT, ETH/USDT, BTC

   They persisted to localStorage under hg_setup_intelligence_data and
   rendered into #hg-setup-intelligence-dashboard, which index.html declares
   display:block. Gold has not traded near 2050 in years.

   They never reached the gold gates — that evidence lives in hg_forward_v1
   and hg_forward_agg_v1, and neither omnigold.js nor hg-forward.js reads
   this key — so nothing was mismeasured. What they did was put invented
   setups on the page, labelled as recorded, a few divs below a desk that
   will not call anything a ticket without twenty settled out-of-sample
   trades.

   Run: node tests/test-no-seeded-demo-setups.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const SRC = fs.readFileSync(path.join(ROOT, 'activate-setup-recording.js'), 'utf8');

console.log('== nothing records a setup the market never produced ==');
{
  ok(!/const demoSetups\s*=/.test(SRC), 'the demo array is gone');
  ok(!/DEMO SETUPS LOADED/.test(SRC), 'and so is the banner that announced it');
  /* The injection was a forEach over a literal array. What must NOT survive
     is this file recording setups of its own; the two passthroughs on
     window.setupRecording must, because that is how a real setup gets
     recorded and is the whole point of the module. */
  ok(!/\.forEach\(\s*setup\s*=>\s*\{?\s*engine\.recordSetup/.test(SRC),
     'no loop records a batch of literal setups');
  ok(/addSetup: \(data\) => engine\.recordSetup\(data\)/.test(SRC),
     'while the public recording API survives — real setups still get in');
  /* No literal setup object is left anywhere — outside the purge table,
     which must name those exact prices in order to recognise and delete
     them. Everything else in the file has to be free of them. */
  const outsideTable = SRC.replace(/var HG_SEEDED_DEMO_ROWS =[\s\S]*?\n  \];/, '');
  ok(/HG_SEEDED_DEMO_ROWS/.test(SRC) && !/HG_SEEDED_DEMO_ROWS =/.test(outsideTable),
     'the purge table is the one place those prices are allowed');
  ok(!/entryPrice:\s*\d/.test(outsideTable), 'no hard-coded entry price survives outside it');
  ok(!/tier:\s*'HIGH_CONVICTION'/.test(outsideTable), 'and no hard-coded conviction tier');
}

console.log('\n== and what earlier loads stored is purged ==');
{
  const store = {};
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp,
                setTimeout, clearTimeout, setInterval, clearInterval, Map, Set, Error,
                localStorage: { getItem: k => (k in store ? store[k] : null),
                                setItem: (k, v) => { store[k] = String(v); },
                                removeItem: k => { delete store[k]; } },
                document: { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){} }),
                            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                            head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} },
                addEventListener(){}, fetch: () => Promise.reject(new Error('no net')) };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'activate-setup-recording.js' });

  const M = ctx.hgIsSeededDemoRow;
  ok(typeof M === 'function', 'the matcher is exported so it can be checked');

  ok(M({ symbol: 'GOLD', pattern: 'EMA_CASCADE', entryPrice: 2050 }), 'the GOLD row is recognised');
  ok(M({ symbol: 'OMNIGOLD', pattern: 'FORMATION_BREAKOUT', entryPrice: 2048 }),
     'the OMNIGOLD row is recognised at its real seeded price');
  ok(M({ symbol: 'XAU/USD', pattern: 'DOUBLE_TOP', entryPrice: 2045 }), 'and the XAU/USD row');

  /* THE PART THAT MATTERS: this deletes recorded history, so it must not be
     able to delete anything real. All three fields must match. */
  ok(!M({ symbol: 'GOLD', pattern: 'EMA_CASCADE', entryPrice: 4712 }),
     'the same symbol and pattern at a LIVE price is not touched');
  ok(!M({ symbol: 'GOLD', pattern: 'SWEEP', entryPrice: 2050, tier: 'HIGH_CONVICTION', confidence: 0.85 }),
     'nor a real row carrying the same tier and confidence — those are not matched on');
  ok(!M({ symbol: 'OMNIGOLD', pattern: 'FORMATION_BREAKOUT', entryPrice: 2050 }),
     'nor the right symbol and pattern at the wrong price');
  ok(!M(null) && !M(undefined) && !M({}), 'and a missing or empty row is never a match');
}

console.log('\n== the purge runs once, not on every load ==');
{
  const store = {};
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp,
                setTimeout, clearTimeout, setInterval, clearInterval, Map, Set, Error,
                localStorage: { getItem: k => (k in store ? store[k] : null),
                                setItem: (k, v) => { store[k] = String(v); },
                                removeItem: k => { delete store[k]; } },
                document: { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){} }),
                            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                            head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} },
                addEventListener(){}, fetch: () => Promise.reject(new Error('no net')) };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'activate-setup-recording.js' });

  ok(/hg_setup_demo_purged_v1/.test(SRC), 'a once-only marker key exists');
  ok(/localStorage\.getItem\(HG_DEMO_PURGE_KEY\)\) return 0;/.test(SRC),
     'and the purge returns early when it has already run');
  /* a person who later records a real setup resembling one of these must
     not have it removed on their next visit */
  ok(/Runs once per browser/.test(SRC), 'the reason is stated where the next reader will be');
}

console.log('\n== the gold evidence was never in this store ==');
{
  const og = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  const fwd = fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8');
  ok(!/hg_setup_intelligence/.test(og), 'omnigold.js does not read the seeded store');
  ok(!/hg_setup_intelligence/.test(fwd), 'and neither does the forward log');
  ok(/hg_forward_v1/.test(fwd), 'whose own evidence lives under its own key');
}

console.log('\n== the page still loads the recorder, only not the fiction ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/activate-setup-recording\.js/.test(html), 'index.html still loads the recorder');
  ok(/hg-setup-intelligence-dashboard/.test(html), 'and still has its dashboard');
  /* removing the seed must not have removed the tab hooks that record REAL
     activity — that is the feature, the six rows were not */
  ok(/recordTabActivity/.test(SRC), 'real tab activity is still recorded');
}

console.log('\n' + passed + ' passed, 0 failed');
