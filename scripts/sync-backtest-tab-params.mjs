#!/usr/bin/env node
/* Sync data/desk-tab-params.json + setup-profile + strategy-regime-state from offline backtests. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncBacktestTabParams } from '../lib/backtest-tab-params.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = syncBacktestTabParams(root);
console.log('Wrote', result.deskOut);
console.log('Wrote', result.profilePath);
console.log('Wrote', result.regimePath);
console.log('Tabs configured:', result.tabCount);
if (result.notes && result.notes.length){
  console.log('\nTightening notes:');
  result.notes.slice(0, 12).forEach(function(n){ console.log('  ·', n); });
  if (result.notes.length > 12) console.log('  … +' + (result.notes.length - 12) + ' more');
}
