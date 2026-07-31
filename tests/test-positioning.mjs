/* HARDGATE — positioning cross-check tests */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const load = f => vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });
load('positioning.js');

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

console.log('== positioningCrossCheck ==');
const C = globalThis.positioningCrossCheck;

let x = C({ fundingPct: 0.06, retailLongPct: 70, oiChgPct: 5 },
  { fundingPct: 0.055, retailLongPct: 68, oiChgPct: 4 });
ok(x.status === 'confirmed' && x.conflict === 0, 'both venues crowded long + OI agree → confirmed');
ok(x.notes.some(n => n.indexOf('funding crowding confirmed') >= 0), 'names funding confirmation');

x = C({ fundingPct: 0.06, retailLongPct: 50, oiChgPct: 5 },
  { fundingPct: -0.04, retailLongPct: 50, oiChgPct: -3 });
ok(x.status === 'conflict', 'opposite funding extremes → conflict');

x = C({ fundingPct: 0.01, retailLongPct: 50, oiChgPct: 1 }, null);
ok(x.status === 'bybit-dark', 'missing Bybit leg degrades honestly');

x = C(null, { fundingPct: 0.01 });
ok(x.status === 'no-bin', 'missing Binance leg named');

console.log('\n' + passed + ' passed');
