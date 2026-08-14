/* HARDGATE — super-book.js unit tests */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ window: {}, document: { head: { appendChild: function(){} } } });
ctx.window = ctx;
ctx.globalThis = ctx;

vm.runInContext(fs.readFileSync(path.join(root, 'super-desk-common.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'super-book.js'), 'utf8'), ctx);
const W = ctx.window;

let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('ok    - ' + m); } else { fail++; console.error('FAIL  - ' + m); } }

W.bookState = function(){
  return {
    summary: { heatPct: 0.04, heatUsd: 400, openCount: 2, dailyLossHalt: false },
    book: {
      positions: [{
        id: 'p1', sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, mark: 98.2, riskUsd: 50
      }]
    }
  };
};

const snap = W.buildSnapFromBook(W);
ok(snap.cands.length === 1, 'maps open position');
ok(snap.cands[0].invalidNear === true, 'flags near stop');
ok(/heat 4/.test(snap.stat), 'stat mentions heat');

const pill = W.superBookDeskPill(snap.cands[0], snap.deskMeta);
ok(pill.label === 'NEAR STOP', 'NEAR STOP pill');

ok(/super-book\.js\?v=292/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')), 'index wired');
ok(swCacheOk(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'sw ' + HG_VER);

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
