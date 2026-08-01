/* HARDGATE — cryptogates.js unit tests */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const load = f => vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });

globalThis.window = globalThis;
load('indicators.js');
load('indicators2.js');
load('cryptogates.js');

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok —', msg); }
  else { fail++; console.error('FAIL —', msg); }
}

function synthRows(n, start){
  const out = [];
  for (let i = 0; i < n; i++){
    const c = start + i * 10;
    out.push({ t: i, o: c, h: c + 5, l: c - 5, c: c, v: 1000 });
  }
  return out;
}

const rows = synthRows(260, 50000);
const ticker = { symbol: 'BTCUSDT', fundingPct: 0.01, mark: rows[rows.length - 1].c };
const m = globalThis.swingGateMatrix(rows, ticker);
ok(m && m.dir === 'long' && m.passed >= 1, 'swingGateMatrix returns aligned long with gate tally');
ok(typeof globalThis.swingTryClean === 'function', 'swingTryClean exported');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
