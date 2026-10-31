#!/usr/bin/env node
/* Per-symbol / per-window robustness breakdown of the lab's final config vs
   the desk baseline, off the cached Phase-A records. Read-only. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cachedKlines, DEFAULT_SYMBOLS } from './backtest-trendmx.mjs';
import { baseConfig, evalConfig, windowAgg, LAB_CACHE } from './trendmx-winrate-lab.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const rep = JSON.parse(fs.readFileSync(path.join(HERE, 'trendmx-winrate-lab-results.json'), 'utf8'));
const finalCfg = rep.final.config;

const data = JSON.parse(fs.readFileSync(LAB_CACHE, 'utf8'));
for (const sym of DEFAULT_SYMBOLS) data[sym].h4 = await cachedKlines(sym, '4h', 2200, { log: () => {} });

const outcomes = {};
const base = evalConfig(data, baseConfig(), outcomes);
const fin = evalConfig(data, finalCfg, outcomes);

let tMin = Infinity, tMax = -Infinity;
for (const sym of DEFAULT_SYMBOLS) for (const r of data[sym].recs){ if (r.t < tMin) tMin = r.t; if (r.t > tMax) tMax = r.t; }
const span = tMax - tMin, E = [];
for (let w = 0; w <= 4; w++) E.push(tMin + Math.floor(span * w / 4));

const fmt = a => a.n ? ('n=' + String(a.n).padStart(4) + ' win=' + (100 * a.win).toFixed(1).padStart(5) + '% net=' + (a.net >= 0 ? '+' : '') + a.net.toFixed(3) + 'R') : 'n=0';
console.log('symbol      | baseline                | final config');
for (const sym of DEFAULT_SYMBOLS){
  const b = windowAgg(base.filter(t => t.sym === sym), -Infinity, Infinity);
  const f = windowAgg(fin.filter(t => t.sym === sym), -Infinity, Infinity);
  console.log(sym.padEnd(12) + '| ' + fmt(b).padEnd(24) + '| ' + fmt(f));
}
console.log('\nwindow | baseline | final');
for (let w = 0; w < 4; w++){
  console.log('W' + (w + 1) + '     | ' + fmt(windowAgg(base, E[w], E[w + 1])) + ' | ' + fmt(windowAgg(fin, E[w], E[w + 1])));
}
const dirB = d => windowAgg(base.filter(t => t.dir === d), -Infinity, Infinity);
const dirF = d => windowAgg(fin.filter(t => t.dir === d), -Infinity, Infinity);
console.log('\nlongs:  base ' + fmt(dirB('long')) + ' | final ' + fmt(dirF('long')));
console.log('shorts: base ' + fmt(dirB('short')) + ' | final ' + fmt(dirF('short')));
