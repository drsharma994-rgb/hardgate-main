#!/usr/bin/env node
/* Weekly walk-forward parameter recalibration → data/param-drift.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pdRecalibrate, PD_BASELINES } from '../lib/inc34-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'data', 'param-drift.json');
const scorePath = process.env.HG_SCORE_JSON || path.join(root, 'data', 'scorecard-export.json');

let closed = [];
if (fs.existsSync(scorePath)){
  const raw = JSON.parse(fs.readFileSync(scorePath, 'utf8'));
  const recs = Array.isArray(raw) ? raw : (raw.records || []);
  closed = recs.filter(function(r){ return r && (r.status === 'settled' || r.outcome) && isFinite(+r.r); });
}

let state = { baselines: PD_BASELINES, params: {}, adoptionHistory: [] };
if (fs.existsSync(outPath)){
  try{ state = Object.assign(state, JSON.parse(fs.readFileSync(outPath, 'utf8'))); }catch(e){}
}

const result = pdRecalibrate(closed, state);
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log('Wrote', outPath, '— trades:', result.tradeCount, 'params:', JSON.stringify(result.params));
