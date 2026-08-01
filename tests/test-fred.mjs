/* HARDGATE — /api/fred handler tests (Node 18+) */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fredHandler = require('../api/fred.js');

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('  ok —', msg); }
  else { fail++; console.error('  FAIL —', msg); }
}

function mockRes(){
  const res = { statusCode: 0, headers: {}, body: '' };
  res.setHeader = function(k, v){ res.headers[k] = v; };
  res.end = function(b){ res.body = b; };
  return res;
}

console.log('== fred handler ==');
{
  const prev = process.env.FRED_API_KEY;
  delete process.env.FRED_API_KEY;
  const res = mockRes();
  await fredHandler({ method: 'GET', query: { series: 'DGS10' } }, res);
  ok(res.statusCode === 503, 'missing FRED_API_KEY -> 503');
  const j = JSON.parse(res.body);
  ok(j.error && j.error.indexOf('not configured') >= 0, '503 explains missing key');
  if (prev) process.env.FRED_API_KEY = prev;
}

{
  process.env.FRED_API_KEY = 'test-key';
  const origFetch = globalThis.fetch;
  globalThis.fetch = async function(url){
    if (String(url).indexOf('DGS10') >= 0){
      return {
        ok: true,
        json: async () => ({
          observations: [
            { date: '2026-07-29', value: '4.20' },
            { date: '2026-07-30', value: '4.25' }
          ]
        })
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const res = mockRes();
  await fredHandler({ method: 'GET', query: { series: 'DGS10', limit: '10' } }, res);
  ok(res.statusCode === 200, 'configured handler returns 200');
  const j = JSON.parse(res.body);
  ok(j.series === 'DGS10' && j.observations.length === 2 && j.observations[1].value === 4.25, 'observations parsed ascending');
  globalThis.fetch = origFetch;
  delete process.env.FRED_API_KEY;
}

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
