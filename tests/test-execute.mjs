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
var p2 = hgBuildBracketPayload({ sym: 'BTCUSD', side: 'long', qty: 0.5, stop: 99000, t1: 105000, t2: 112000 });
ok(p2 && p2.bracket.takeProfit === 105000 && p2.bracket.takeProfit2 === 112000, 'bracket payload includes optional T2');
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
ok(executeJs.indexOf('plan.fund') >= 0, 'execute.js routes blotter to position fund');
ok(executeJs.indexOf('skipConfirm') >= 0, 'execute.js supports silent auto-exec path');

var bookJs = fs.readFileSync(path.join(root, 'book.js'), 'utf8');
ok(bookJs.indexOf('bookMaybeAutoExecute') >= 0 && bookJs.indexOf('BOOK_AUTO_EXEC_KEY') >= 0,
  'book.js auto EXEC on add hook');
ok(bookJs.indexOf('bookMaybeAutoExecPending') >= 0 && bookJs.indexOf('BOOK_AUTO_EXEC_PENDING_KEY') >= 0
  && bookJs.indexOf('Auto EXEC pending on refresh') >= 0,
  'book.js auto EXEC pending on mark refresh');
ok(bookJs.indexOf('bookMaybeAutoRetryFailed') >= 0 && bookJs.indexOf('BOOK_AUTO_RETRY_FAILED_KEY') >= 0
  && bookJs.indexOf('Auto retry failed on refresh') >= 0,
  'book.js auto retry failed on mark refresh');
ok(bookJs.indexOf('bookBracketExportLabel') >= 0 && bookJs.indexOf(',bracket,') >= 0,
  'book.js position CSV includes bracket column');
ok(bookJs.indexOf('bookAutoExecScope') >= 0 && bookJs.indexOf('BOOK_AUTO_EXEC_CROSS_FUND_KEY') >= 0
  && bookJs.indexOf('Auto pending/retry all funds') >= 0,
  'book.js cross-fund auto pending/retry on refresh');
ok(bookJs.indexOf('bookExportConsolidatedCSV') >= 0 && bookJs.indexOf('EXPORT ALL CSV') >= 0
  && bookJs.indexOf('bookDeskExecPending') >= 0,
  'book.js consolidated CSV + desk rollup EXEC shortcuts');
ok(bookJs.indexOf('all.closed') >= 0 && bookJs.indexOf('closedAt') >= 0
  && bookJs.indexOf('bookFetchAllPositions') >= 0,
  'book.js consolidated export includes closed trades across funds');
ok(bookJs.indexOf('bookBlotterExecOnlyOn') >= 0 && bookJs.indexOf('bookFilterBlotterRows') >= 0
  && bookJs.indexOf('id="bookBlotterExecOnly"') >= 0,
  'book.js EXEC-only blotter filter toggle');
ok(bookJs.indexOf('bookDailyLossHalted') >= 0 && bookJs.indexOf('DAY HALT') >= 0
  && bookJs.indexOf('bookDayHalt') >= 0,
  'book.js daily loss halt banner + status chip');
ok(bookJs.indexOf('W.bookRefresh = bookRefresh') >= 0, 'book.js exports bookRefresh for blotter sync');
ok(bookJs.indexOf('deskExecStatusHTML') >= 0 && bookJs.indexOf('closedRowHTML') >= 0,
  'book.js desk exec status bar + closed trade source chips');
ok(bookJs.indexOf('opts.silent') >= 0 && bookJs.indexOf('bookFetchOpenKeys') >= 0,
  'book.js silent add + cross-fund open-key dedup');
ok(bookJs.indexOf('posExecChipHTML') >= 0 && bookJs.indexOf('BRACKET OK') >= 0,
  'book.js per-position bracket status chips');
ok(bookJs.indexOf('bookDigestExecuteSummary') >= 0 && bookJs.indexOf('BRAIN auto-book') >= 0,
  'book.js exec bar 7d rollup + brain auto-book chip');
ok(bookJs.indexOf('brainAutoBookPrimeOnlyOn') >= 0 && bookJs.indexOf('BRAIN auto-book PRIME') >= 0,
  'book.js exec bar reflects PRIME-only auto-book mode');
ok(bookJs.indexOf('bookExecuteBatchPositions') >= 0 && bookJs.indexOf('bookExecuteFromPosition') >= 0,
  'book.js batch execute from position objects');
ok(bookJs.indexOf('EXEC PENDING (') >= 0 && bookJs.indexOf('data-exec=') >= 0 && bookJs.indexOf('Click to send EXEC') >= 0,
  'book.js pending counts + clickable bracket chips');
ok(bookJs.indexOf('bookExecuteAllFundsPending') >= 0 && bookJs.indexOf('bookFetchAllPositions') >= 0
  && bookJs.indexOf('ALL FUNDS PENDING') >= 0 && bookJs.indexOf('bookBlotterAll') >= 0,
  'book.js cross-fund EXEC batch + consolidated blotter panel');
ok(bookJs.indexOf('_fundId') >= 0 && bookJs.indexOf('consolidatedAll') >= 0,
  'book.js tags cross-fund positions and caches consolidated snapshot');
ok(bookJs.indexOf('bookExportBlotterCSV') >= 0 && bookJs.indexOf('EXPORT BLOTTER') >= 0
  && bookJs.indexOf('hardgate-blotter') >= 0,
  'book.js exports execution blotter CSV');

var apiJs = fs.readFileSync(path.join(root, 'lib/paperbook-api.mjs'), 'utf8');
ok(apiJs.indexOf('executeProxy') >= 0, 'book capabilities expose executeProxy flag');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
