/* =========================================================================
scripts/refit-forward-check.mjs

Run the IN-APP solidity forward-refit monitor against an exported forward
pool, offline. The math is NOT duplicated here: the script vm-loads the
shipped omniroute.js and calls window.hgOmniSolidityRefitCheck — the same
function the app runs — so an offline answer can never drift from the
in-app one.

Export the pool from the app console:
  copy(JSON.stringify(hgFwdRecords('OMNIROUTE')))     // or all tabs:
  copy(localStorage.getItem('hg_forward_v1'))
save it to a file, then:
  node scripts/refit-forward-check.mjs path/to/pool.json

Output: the monitor's verdict object as JSON on stdout.
========================================================================= */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const file = process.argv[2];
if (!file){
  console.error('usage: node scripts/refit-forward-check.mjs <pool.json>');
  process.exit(2);
}

let pool;
try {
  pool = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error('cannot read/parse ' + file + ': ' + e.message);
  process.exit(2);
}
if (!Array.isArray(pool)){
  console.error('expected a JSON array of forward records, got ' + typeof pool);
  process.exit(2);
}

/* Same minimal browser stub the repo's vm tests use. */
const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
              parseFloat, parseInt, JSON, Array, Object, Number, String, Promise,
              RegExp, Error, TypeError, setTimeout, clearTimeout };
ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
  addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
  querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
  documentElement:{appendChild(){}}, addEventListener(){} };
vm.createContext(ctx);
for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                 'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js']){
  vm.runInContext(read(f), ctx, { filename: f });
}

if (typeof ctx.hgOmniSolidityRefitCheck !== 'function'){
  console.error('omniroute.js did not export hgOmniSolidityRefitCheck');
  process.exit(1);
}

const out = ctx.hgOmniSolidityRefitCheck(pool);
console.log(JSON.stringify(out, null, 2));
