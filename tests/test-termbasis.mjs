/* HARDGATE — termbasis.js pure math + module wiring */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const load = f => vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

console.log('== termBasisCurve pure ==');
globalThis.window = globalThis;
load('termbasis.js');
ok(typeof globalThis.termBasisCurve === 'function', 'termBasisCurve exported');
ok(typeof globalThis.termBasisScore === 'function', 'termBasisScore exported');

const flat = globalThis.termBasisCurve(1, 1, 1);
ok(flat && flat.regime === 'flat' && flat.spreadCur === 0, 'equal legs → flat regime');

const cont = globalThis.termBasisCurve(5, 3, 1);
ok(cont && cont.regime === 'contango' && cont.spreadCur > 0 && cont.slope > 0,
  'upward curve → contango');

const back = globalThis.termBasisCurve(-4, -2, 0.5);
ok(back && back.regime === 'backwardation', 'downward curve → backwardation');

ok(globalThis.termBasisCurve(NaN, 1, 1) === null, 'non-finite → null');
ok(globalThis.termBasisScore(cont) > globalThis.termBasisScore(flat), 'larger spread scores higher');

const tabs = globalThis.window.HG_tabs || [];
const mod = tabs.find(t => t && t.id === 'termbasis');
ok(!!mod && mod.label === 'TERM BASIS' && typeof mod.mount === 'function' && typeof mod.refresh === 'function',
  'HG_tabs termbasis registered with refresh');

console.log('\n' + passed + ' passed');
if (!passed) process.exit(1);
