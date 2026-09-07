#!/usr/bin/env node
/* Weekly per-symbol tier assignment → data/symbol-tier.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stBuildTiers } from '../lib/inc34-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'data', 'symbol-tier.json');
const scorePath = process.env.HG_SCORE_JSON || path.join(root, 'data', 'scorecard-export.json');

let records = [];
if (fs.existsSync(scorePath)){
  const raw = JSON.parse(fs.readFileSync(scorePath, 'utf8'));
  records = Array.isArray(raw) ? raw : (raw.records || []);
}

const tiers = stBuildTiers(records);
tiers.version = 1;
tiers.note = 'Per-symbol quality tiers from scorecard/LOG';
fs.writeFileSync(outPath, JSON.stringify(tiers, null, 2) + '\n');
console.log('Wrote', outPath, '— symbols:', Object.keys(tiers.symbols || {}).length);
