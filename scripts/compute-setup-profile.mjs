#!/usr/bin/env node
/* Build data/setup-profile.json from local scorecard export or synthetic fixtures. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scBuildProfileFromSources } from '../lib/setup-calibration-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'data', 'setup-profile.json');

let logEntries = [];
let scoreRecords = [];

const logPath = process.env.HG_LOG_JSON;
if (logPath && fs.existsSync(logPath)){
  logEntries = JSON.parse(fs.readFileSync(logPath, 'utf8'));
}

const scorePath = process.env.HG_SCORE_JSON || path.join(root, 'data', 'scorecard-export.json');
if (fs.existsSync(scorePath)){
  const raw = JSON.parse(fs.readFileSync(scorePath, 'utf8'));
  scoreRecords = Array.isArray(raw) ? raw : (raw.records || []);
}

const profile = scBuildProfileFromSources(logEntries, scoreRecords, { minSample: 20 });
const seed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
profile.timeStopDefaults = seed.timeStopDefaults || profile.timeStopDefaults;
profile.note = seed.note;

fs.writeFileSync(outPath, JSON.stringify(profile, null, 2) + '\n');
console.log('Wrote', outPath, '— setups:', Object.keys(profile.setups || {}).join(', ') || '(empty)');
