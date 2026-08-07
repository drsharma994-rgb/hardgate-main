/* HARDGATE — Fix Pack 8 productivity: book lots, fade scan UI, pos cache, rate backoff.
   Run: node tests/test-productivity-pack8.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  passed++;
  console.log('  ok —', label);
};

const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const book = fs.readFileSync(ROOT + 'book.js', 'utf8');
const binance = fs.readFileSync(ROOT + 'binance.js', 'utf8');
const brain = fs.readFileSync(ROOT + 'brain.js', 'utf8');
const sw = fs.readFileSync(ROOT + 'sw.js', 'utf8');

console.log('== book Delta lots column ==');
ok(/function bookContractsCell/.test(book), 'bookContractsCell helper');
ok(book.indexOf('<th>Lots</th>') >= 0, 'open positions table has Lots column');
ok(/hgEnsureContractSpecs/.test(book), 'book refresh loads contract specs');

console.log('== funding fade discoverability ==');
ok(/function renderFadeSetupCard/.test(html), 'renderFadeSetupCard defined');
ok(/swingTryFundingFade\(rows, t\)/.test(html), 'SWING scan calls swingTryFundingFade');
ok(/scalpTryFundingFade\(h1, m15, t, minsToFunding\)/.test(html), 'SCALP scan calls scalpTryFundingFade');
ok(/fadeFound/.test(html), 'scan audit tracks fadeFound');

console.log('== positioning snapshot cache ==');
ok(/HG_POS_SNAP_TTL/.test(html), 'HG_POS_SNAP_TTL constant');
ok(/S\.posSnapCache/.test(html), 'smartScanSymbol uses posSnapCache');

console.log('== binance rate-limit backoff ==');
ok(/418|429/.test(binance) && /binanceBackoffUntil/.test(binance), 'binance.js marks backoff on 418/429');
ok(/function hgScanRateOk/.test(html), 'hgScanRateOk gate for scans');
ok(/binanceBackoffUntil/.test(brain), 'brainAlertWarm respects rate limit');

console.log('== cache bump ==');
{
  const m = sw.match(/const HG_CACHE = 'hg-v(\d+)'/);
  ok(m && +m[1] >= 174, 'sw cache at least hg-v174 (pack 8+)');
}

console.log('\n' + passed + ' passed');
