/* HARDGATE — formation.js FVG POI regression guard (hgDetectFvg polymorphism). */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
function ok(c, m){ assert.ok(c, m); pass++; console.log('ok    - ' + m); }

function loadChain(files){
  const sandbox = {
    window: {}, console, setTimeout, clearTimeout, Math, JSON, Date,
    G: null
  };
  sandbox.window = sandbox;
  sandbox.G = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of files){
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return sandbox;
}

const rows = [
  { t: 1, o: 100, h: 101, l: 99, c: 100, v: 10 },
  { t: 2, o: 100, h: 102, l: 99, c: 101, v: 10 },
  { t: 3, o: 101, h: 115, l: 101, c: 114, v: 100 },
  { t: 4, o: 114, h: 120, l: 106, c: 118, v: 20 },
  { t: 5, o: 118, h: 119, l: 115, c: 116, v: 10 }
];

const W = loadChain(['structure-levels.js', 'structure-core.js', 'formation.js']);
ok(typeof W.hgDetectFvg === 'function', 'hgDetectFvg available to formation');

const fvg = W.hgDetectFvg(rows, 'long');
ok(fvg && isFinite(+fvg.entry), 'legacy hgDetectFvg(rows, dir) returns numeric entry for formation POI');

function fin(v){ return typeof v === 'number' && isFinite(v); }
const finEntry = fin(+fvg.entry);
ok(finEntry, '+fvg.entry is not NaN — formation FVG branch stays alive');

console.log('\nformation-fvg: ' + pass + ' passed');
