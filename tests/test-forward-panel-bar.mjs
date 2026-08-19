/* HARDGATE — every forward panel in the app was judged by the CRYPTO desk's
   mechanic count, and I caused it.

   v380 fixed the in-sample pool table: it had been labelling "has paid" at
   +2.00 sigma while the measured-edge gate credits a mechanic only at the
   family-wise bar. Part of that fix made hgOmniPoolRead default to the
   family-wise bar when a caller supplies none, so that forgetting the
   argument could not quietly restore the defect.

   hg-forward.js calls it in two places and supplies no bar:

     v = readFn ? readFn(p, minRr, 20) : null;

   Before v380 that meant +2.00. After it, every forward panel in the app —
   gold, EDGE, OIFLOW, SQUEEZE, REVERSALSNIPER and the all-tabs ledger —
   silently inherited omniroute's 27-MECHANIC default. A gold panel judged by
   the crypto count.

   Its own comment made the wrong promise too: "the forward column is judged
   by exactly the same +/-2 sigma bar as the in-sample one". That had already
   stopped being true in both directions.

   THE RIGHT BAR is the number of rows the panel is actually rendering. A
   reader looking at a table of N mechanics and picking the best one has
   searched N ways, whether the numbers are in-sample or out-of-sample, and
   the correction should reflect the table in front of them rather than
   another desk's. The all-tabs ledger counts every row across every tab,
   because the search a reader performs over it is wider than any one desk's.

   The negative side keeps -2 sigma throughout: noticing that one named
   mechanic is losing is not a search.

   Run: node tests/test-forward-panel-bar.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const FWD = read('hg-forward.js');

function boot(){
  const store = {};
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','omniroute.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

console.log('== the call now carries a bar, in both panels ==');
{
  ok(!/readFn\(p, minRr, 20\)/.test(FWD), 'neither call reads without a bar any more');
  ok((FWD.match(/readFn\(p, minRr, 20, barZ\)/g) || []).length === 2,
     'both the per-tab panel and the all-tabs ledger pass one');
  ok(/hgOmniFamilyZ\(Math\.max\(1, keys\.length\)\)/.test(FWD),
     'the per-tab panel derives it from the rows it renders');
  ok(/hgOmniFamilyZ\(Math\.max\(1, ledgerRows\)\)/.test(FWD),
     'and the all-tabs ledger from every row across every tab');
  ok(/isFinite\(\+o\.barZ\) && \+o\.barZ > 0/.test(FWD), 'a caller may still state its own');
  ok(!/exactly the same \+\/-2 sigma bar as the in-sample/.test(FWD),
     'the comment no longer promises a bar that is not used');
  ok(/27-MECHANIC default/.test(FWD), 'and records what went wrong instead');
}

console.log('\n== the bar really does scale with the table ==');
{
  const W = boot();
  ok(typeof W.hgOmniFamilyZ === 'function', 'the family-wise function is reachable');
  const b1 = W.hgOmniFamilyZ(1), b8 = W.hgOmniFamilyZ(8), b31 = W.hgOmniFamilyZ(31);
  ok(b1 < b8 && b8 < b31, 'more rows means a higher bar (' + b1.toFixed(2) + ' < '
     + b8.toFixed(2) + ' < ' + b31.toFixed(2) + ')');
  ok(Math.abs(b1 - 1.64) < 0.03, 'one row is the plain 5% threshold (+' + b1.toFixed(2) + ')');
  ok(b31 > 2.9, 'thirty-one rows is near +2.94');
}

console.log('\n== and it changes a verdict at the margin, which is the point ==');
{
  const W = boot();
  /* A record that clears the one-row bar but not a wide table's. */
  const pBreak = 1/3, n = 60;
  const se = Math.sqrt(pBreak*(1-pBreak)/n);
  const hit = pBreak + 2.2 * se;                 /* +2.2 sigma */
  const pool = { samples: n, hit: hit, expR: 0 };
  const narrow = W.hgOmniPoolRead(pool, 2, 20, W.hgOmniFamilyZ(1));
  const wide   = W.hgOmniPoolRead(pool, 2, 20, W.hgOmniFamilyZ(31));
  ok(Math.abs(narrow.z - 2.2) < 0.05, 'the record reads +' + narrow.z.toFixed(2) + ' sigma');
  ok(narrow.read === 'has paid', 'in a one-row panel it HAS PAID');
  ok(wide.read === 'within noise', 'in a thirty-one-row panel the same record is within noise');
  ok(narrow.read !== wide.read, 'so the correction is doing real work, not decoration');
}

console.log('\n== the negative side is unaffected by table width ==');
{
  const W = boot();
  const pool = { samples: 200, hit: 0.20, expR: -0.4 };
  for (const rows of [1, 8, 31, 200]){
    const v = W.hgOmniPoolRead(pool, 2, 20, W.hgOmniFamilyZ(rows));
    ok(v.read === 'has not paid', rows + ' rows: a losing mechanic still reads "has not paid"');
  }
}

console.log('\n== a real panel renders and judges without throwing ==');
{
  const W = boot();
  const NOW = Math.floor(Date.now() / 1000);
  /* One mechanic with a settled, winning record. */
  for (let i = 0; i < 40; i++){
    W.hgFwdRecord({ tab:'T', mechanic:'GOOD', sym:'S'+i, tf:'4h', dir:'long',
                    entry:100, stop:98, t1:104, barT: NOW-(500+i)*3600, horizonBars:20 });
    const bars = [];
    for (let k = 1; k <= 6; k++)
      bars.push({ t: NOW-(500+i)*3600+k*4*3600, o:100, h: k===3?105:101, l:99, c:100, v:1 });
    W.hgFwdResolve('S'+i, '4h', bars);
  }
  let threw = null, html = null;
  try { html = W.hgFwdPanelHTML('T', { minRr: 2 }); } catch (e){ threw = e; }
  ok(!threw, 'the panel renders' + (threw ? ' — ' + threw.message : ''));
  ok(typeof html === 'string' && html.length > 100, 'and returns real markup');
  ok(!/NaN|undefined/.test(html), 'with no NaN or undefined in it');
  ok(/GOOD/.test(html), 'listing the mechanic');
  /* An explicit bar must win over the derived one. */
  const forced = W.hgFwdPanelHTML('T', { minRr: 2, barZ: 99 });
  ok(!/has paid/.test(forced), 'an explicit impossible bar suppresses the claim');
  ok(/has paid/.test(W.hgFwdPanelHTML('T', { minRr: 2, barZ: 1 })), 'and a low one permits it');
}

console.log('\n== an empty or broken panel degrades quietly ==');
{
  const W = boot();
  let threw = null, out = null;
  try { out = W.hgFwdPanelHTML('NOSUCHTAB', { minRr: 2 }); } catch (e){ threw = e; }
  ok(!threw, 'an unknown tab does not throw');
  ok(typeof out === 'string', 'and still returns markup');
  for (const bad of [null, undefined, {}, { minRr: 'x' }, { barZ: -5 }]){
    let t2 = null;
    try { W.hgFwdPanelHTML('T', bad); } catch (e){ t2 = e; }
    ok(!t2, 'opts=' + JSON.stringify(bad) + ' does not throw');
  }
  /* Math.max(1, ...) guarantees the bar is always computable. */
  ok(/Math\.max\(1, keys\.length\)/.test(FWD), 'an empty pool cannot ask for familyZ(0)');
  ok(/Math\.max\(1, ledgerRows\)/.test(FWD), 'nor can an empty ledger');
}

console.log('\n== every caller still works untouched ==');
{
  /* The fix is inside hg-forward.js, so no tab had to change. */
  for (const f of ['edge.js','oiflow.js','reversalsniper.js','squeeze.js']){
    ok(/hgFwdPanelHTML\(/.test(read(f)), f + ' still calls the panel the same way');
    ok(!/barZ/.test(read(f)), f + ' did not need to learn about the bar');
  }
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL FORWARD PANEL BAR TESTS PASSED');
