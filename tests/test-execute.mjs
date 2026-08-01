/* HARDGATE — bracket execution payload + API tests */
import { hgBuildBracketPayload, hgExecuteBackendTarget, hgExecuteIdempotencyKey } from '../lib/execute-core.mjs';
import { executeCapabilities } from '../lib/execute-api.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

var p = hgBuildBracketPayload({ sym: 'BTCUSD', side: 'long', qty: 0.5, lev: 10, stop: 99000, t1: 105000 });
ok(p && p.symbol === 'BTCUSD' && p.bracket.stop === 99000 && p.source === 'hardgate-trade-plan', 'bracket payload shape');
ok(p && p.idempotencyKey && String(p.idempotencyKey).indexOf('hgx-') === 0, 'bracket payload includes idempotency key');
ok(hgBuildBracketPayload({ sym: 'X', side: 'long', qty: 0 }) === null, 'invalid qty -> null');

var idem = hgExecuteIdempotencyKey({ sym: 'XAUUSD', side: 'long', qty: 1, stop: 2000, t1: 2020, positionId: 'pos-1' });
ok(idem && idem.indexOf('hgx-') === 0 && idem.length <= 64, 'idempotency key stable prefix');

var prev = process.env.EXECUTE_BACKEND_URL;
process.env.EXECUTE_BACKEND_URL = 'https://example.com/execute';
ok(hgExecuteBackendTarget().indexOf('example.com') >= 0, 'backend target from env');
var caps = executeCapabilities();
ok(caps.ready && caps.mode === 'proxy', 'capabilities ready when env set');
delete process.env.EXECUTE_BACKEND_URL;
ok(executeCapabilities().ready === false, 'capabilities off without env');
process.env.EXECUTE_BACKEND_URL = prev;

var executeJs = fs.readFileSync(path.join(root, 'execute.js'), 'utf8');
ok(executeJs.indexOf('executeBackendReady') >= 0 && executeJs.indexOf('/api/execute') >= 0,
  'execute.js exposes ready check + proxy path');
ok(executeJs.indexOf('execute-blotter') >= 0, 'execute.js records blotter after bracket send');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
