/* HARDGATE — /api/coindcx desk + coindcx-fetch cache tests */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  coindcxCacheGet,
  coindcxCacheSet,
  coindcxInstrumentsUrl,
  coindcxMarksUrl,
} from '../lib/coindcx-fetch.mjs';
import { createCoindcxApi } from '../lib/coindcx-api.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('  ok — ' + msg); }
  else { fail++; console.error('  FAIL — ' + msg); }
}

console.log('== coindcx cache ==');
coindcxCacheSet('k1', 200, '{"a":1}');
ok(coindcxCacheGet('k1', 1000) != null, 'cache hit');
ok(coindcxCacheGet('k1', 0) == null, 'cache miss when ttl=0');

console.log('== wiring ==');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(html.indexOf('/api/coindcx/instruments') >= 0, 'index cdcx desk instruments');
ok(html.indexOf('cdcxDeskPath') >= 0, 'index cdcxDeskPath helper');
ok(fs.readFileSync(path.join(root, 'xuniverse.js'), 'utf8').indexOf('cdcxFetchUrl') >= 0, 'xuniverse cdcxFetchUrl');
ok(fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8').indexOf('createCoindcxApi') >= 0, 'server coindcx api');
ok(/hg-v256/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'cache hg-v256');

console.log('== api handler ==');
const handler = createCoindcxApi();
const origFetch = globalThis.fetch;
globalThis.fetch = async function(url){
  if (String(url).indexOf('active_instruments') >= 0){
    return { ok: true, status: 200, text: async function(){ return '["B-BTC_USDT"]'; } };
  }
  if (String(url).indexOf('current_prices') >= 0){
    return { ok: true, status: 200, text: async function(){ return '{"prices":{}}'; } };
  }
  return { ok: false, status: 404, text: async function(){ return ''; } };
};

async function call(pathname){
  const res = { headers: {}, statusCode: 0, body: '' };
  res.setHeader = function(k, v){ res.headers[k] = v; };
  res.end = function(b){ res.body = b; };
  await handler({ method: 'GET', url: pathname }, res);
  return { status: res.statusCode, json: JSON.parse(res.body || '{}') };
}

const inst = await call('/api/coindcx/instruments');
ok(inst.status === 200 && inst.json.ok && Array.isArray(inst.json.data), 'instruments route');
const inst2 = await call('/api/coindcx/instruments');
ok(inst2.json.cached === true, 'instruments second call cached');

const marks = await call('/api/coindcx/marks');
ok(marks.status === 200 && marks.json.ok, 'marks route');

const bad = await call('/api/coindcx/candles');
ok(bad.status === 400, 'candles requires params');

globalThis.fetch = origFetch;
ok(coindcxInstrumentsUrl().indexOf('active_instruments') >= 0, 'instruments url');
ok(coindcxMarksUrl().indexOf('current_prices') >= 0, 'marks url');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
