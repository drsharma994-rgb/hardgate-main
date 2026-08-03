/* HARDGATE — macro-feeds.js unit tests (Node 18+, no network).
   Run: node tests/test-macro-feeds.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

function loadScripts(files){
  globalThis.window = globalThis.window || {};
  globalThis.window.__hgMacroFeedsNoAuto = true;
  for (const f of files){
    vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });
  }
  return globalThis.window;
}

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

console.log('== macro-feeds publish + fetch (mocked) ==');
{
  const W = loadScripts(['goldind.js', 'macro-feeds.js']);

  const DAY = Math.floor(Date.now() / 1000) - 86400 * 3;
  function rows(base, n){
    const r = [];
    for (let i = 0; i < n; i++){
      r.push({ t: DAY + i * 900, o: base, h: base + 2, l: base - 2, c: base, v: 1000 });
    }
    return r;
  }
  const xau = rows(100, 25);
  const xag = rows(25, 25);
  xau.push({ t: DAY + 25 * 900, o: 100, h: 103.5, l: 99.5, c: 102, v: 2000 });
  xag.push({ t: DAY + 25 * 900, o: 25, h: 26.5, l: 24.5, c: 25.5, v: 2000 });

  globalThis.getGoldCandles = async () => ({ rows: xau, source: 'test-xau' });
  globalThis.getSilverCandles = async () => ({ rows: xag, source: 'test-xag' });
  globalThis.getUST10YCandles = async () => [
    { t: 1, c: 4.10 }, { t: 2, c: 4.11 }, { t: 3, c: 4.12 }, { t: 4, c: 4.15 }, { t: 5, c: 4.18 },
    { t: 6, c: 4.22 }
  ].map(function(r){ return { t: r.t, o: r.c, h: r.c, l: r.c, c: r.c, v: 0 }; });

  const smt = await W.fetchSilverData();
  ok(smt && smt.smtActive && smt.divergence === 'BEARISH', 'fetchSilverData maps BEARISH_SMT -> BEARISH for brain');

  const yld = await W.fetchUS10YYield();
  ok(yld && yld.trend === 'spiking' && yld.current === 4.22, 'fetchUS10YYield: rising yield series -> spiking');

  const upd = await W.updateMacroFeeds();
  ok(upd && upd.yield && upd.smt, 'updateMacroFeeds returns both legs');
  ok(W.hgYieldState().trend === 'spiking', 'hgYieldState reads macro-feeds publish');
  ok(W.hgSmtState().divergence === 'BEARISH', 'hgSmtState reads macro-feeds publish');

  W.stopMacroFeeds();
  ok(typeof W.startMacroFeeds === 'function', 'start/stop seams exported');
}

console.log('\n' + passed + ' assertions passed');
