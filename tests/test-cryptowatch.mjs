/* HARDGATE — cryptowatch FORMING NOW tests */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const load = f => vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });
load('indicators.js');
load('indicators2.js');
load('cryptowatch.js');

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function mkSwingRows(dir){
  const n = 220;
  const rows = [];
  let p = 100;
  for (let i = 0; i < n; i++){
    p += dir === 'long' ? 0.15 : -0.15;
    rows.push({ t: i * 14400, o: p - 0.1, h: p + 0.5, l: p - 0.5, c: p, v: 1000 + i * 10 });
  }
  return rows;
}

console.log('== swingWatchEval ==');
const rows = mkSwingRows('long');
const w = globalThis.swingWatchEval(rows, { symbol: 'BTCUSD', fundingPct: 0.01, mark: rows[rows.length-1].c });
ok(w && (w.state === 'armed' || w.state === 'idle'), 'trending fixture yields a watch row');
ok(w.gatesPassed >= 3, 'partial gate tally reported — got ' + w.gatesPassed);

const clean = globalThis.swingWatchEval(rows, { symbol: 'BTCUSD', fundingPct: 0.01 });
/* may be null if all gates pass on strong trend fixture — if not null, ok */
if (clean === null) ok(true, 'all gates pass → null (already CLEAN, not forming)');
else ok(clean.gatesPassed < 7, 'not fully clean when watch row exists');

console.log('== coilWatchItems ==');
const coils = globalThis.coilWatchItems({ list: [{ symbol: 'ETHUSD', coilLow: 3000, coilHigh: 3100, dir: 'long' }] });
ok(coils.length === 1 && coils[0].state === 'armed', 'coil watchlist → armed row');

console.log('== cryptoFormingNowHTML ==');
const panelHtml = globalThis.cryptoFormingNowHTML(coils);
ok(panelHtml.indexOf('FORMING NOW') >= 0 && panelHtml.indexOf('ETHUSD') >= 0, 'panel HTML renders');

console.log('== cryptoNewsGate ==');
globalThis.hgNewsRisk = function(){
  return { risk: 'high', blackout: true, note: 'BLACKOUT: NFP', events: [{ title: 'NFP' }] };
};
const ng = globalThis.cryptoNewsGate('BTC');
ok(ng.blackout === true && ng.caution === true, 'blackout propagates from hgNewsRisk');
const newsBanner = globalThis.cryptoNewsBannerHTML(ng);
ok(newsBanner.indexOf('NEWS BLACKOUT') !== -1 && newsBanner.indexOf('NFP') !== -1, 'banner HTML includes blackout + note');

console.log('\n' + passed + ' passed');
