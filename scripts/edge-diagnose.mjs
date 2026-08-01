/* Quick EDGE funnel diagnostic against live Delta/CoinDCX (no browser). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ window: {}, fetch: globalThis.fetch, setTimeout, clearTimeout, Promise });
ctx.window = ctx;
for (const f of ['indicators.js', 'indicators2.js', 'liqs.js', 'meanrev.js', 'xuniverse.js', 'edge.js']) {
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const W = ctx.window;

const uni = await W.xuUniverse(true);
console.log('universe', uni.length, W.xuUniverseNote?.() || '');
const MIN_TURNOVER = 500000;
const MAX_UNIVERSE = 50;
let list = uni.filter(it => {
  if (!it?.sym) return false;
  const t = it.turnoverUsd;
  if (t == null) return true;
  return t >= MIN_TURNOVER;
});
list.sort((a, b) => (b.turnoverUsd ?? 0) - (a.turnoverUsd ?? 0));
list = list.slice(0, MAX_UNIVERSE);

let thin = 0, sig0 = 0, veto = 0, tallyLow = 0, pass = 0;
for (const item of list) {
  const rows = await W.xuCandles(item, '4h', 300);
  if (!rows || rows.length < 85) { thin++; continue; }
  const sig = W.edgeSignal(rows);
  if (!sig) { sig0++; continue; }
  const en = W.edgeEnrich(sig, rows, item, W.xuCandles.lastSource);
  if (en.veto) { veto++; continue; }
  if (en.tally < 3) { tallyLow++; continue; }
  pass++;
  console.log('PASS', item.sym, item.exchange, 'tally', en.tally, sig.dir);
}
console.log({ scanned: list.length, thin, noSignal: sig0, veto, tallyBelow3: tallyLow, pass });
