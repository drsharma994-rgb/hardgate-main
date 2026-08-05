/* HARDGATE — bracket execution payload + API tests */
import { hgBuildBracketPayload, hgExecuteBackendTarget, hgExecuteIdempotencyKey, hgParseExecuteFillResponse, hgExecuteCcxtConfigured } from '../lib/execute-core.mjs';
import { executeCapabilities } from '../lib/execute-api.mjs';
import { hgExecuteFillPollTarget, hgBuildFillPollQuery, hgPollExecuteFill } from '../lib/execute-poll.mjs';
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
var pEntry = hgBuildBracketPayload({ sym: 'PAXGUSDT', side: 'long', qty: 1, stop: 2640, t1: 2660, entry: 2650.5 });
ok(pEntry && pEntry.entry === 2650.5, 'bracket payload includes optional entry for CCXT limit');

var fillParsed = hgParseExecuteFillResponse('{"filledQty":0.5,"qty":1,"avgPrice":100}');
ok(fillParsed && fillParsed.filledQty === 0.5 && fillParsed.qty === 1, 'parse execute fill response JSON');

var idem = hgExecuteIdempotencyKey({ sym: 'XAUUSD', side: 'long', qty: 1, stop: 2000, t1: 2020, positionId: 'pos-1' });
ok(idem && idem.indexOf('hgx-') === 0 && idem.length <= 64, 'idempotency key stable prefix');

var prev = process.env.EXECUTE_BACKEND_URL;
var prevPoll = process.env.EXECUTE_FILL_POLL_URL;
delete process.env.EXECUTE_FILL_POLL_URL;
process.env.EXECUTE_BACKEND_URL = 'https://example.com/execute';
ok(hgExecuteBackendTarget().indexOf('example.com') >= 0, 'backend target from env');
ok(hgExecuteFillPollTarget() === 'https://example.com/fill-status', 'fill poll target derived from execute URL');
var caps = executeCapabilities();
ok(caps.ready && caps.mode === 'proxy' && caps.fillPoll, 'capabilities ready + fill poll when env set');
process.env.EXECUTE_FILL_POLL_URL = 'https://custom.example/poll';
ok(hgExecuteFillPollTarget() === 'https://custom.example/poll', 'fill poll target env override');
delete process.env.EXECUTE_FILL_POLL_URL;
delete process.env.EXECUTE_BACKEND_URL;
ok(executeCapabilities().ready === false, 'capabilities off without env');
process.env.EXECUTE_BACKEND_URL = prev;
if (prevPoll) process.env.EXECUTE_FILL_POLL_URL = prevPoll;

var pollQty = hgBuildFillPollQuery({ positionId: 'p1', notionalUsd: 1000, mark: 100 });
ok(pollQty.qty === 10, 'fill poll query derives qty from notional/mark');
var origFetch = globalThis.fetch;
globalThis.fetch = async function(url, init){
  if (init && init.method === 'POST'){
    return { ok: true, status: 200, text: async () => '{"filledQty":0.5,"qty":1}' };
  }
  return { ok: false, status: 404, text: async () => 'not found' };
};
process.env.EXECUTE_BACKEND_URL = 'https://example.com/execute';
var polled = await hgPollExecuteFill({ positionId: 'p1', sym: 'BTCUSD', qty: 1 });
ok(polled.ok && polled.fill && polled.fill.filledQty === 0.5, 'fill poll parses POST response');
globalThis.fetch = origFetch;
process.env.EXECUTE_BACKEND_URL = prev;

var executeJs = fs.readFileSync(path.join(root, 'execute.js'), 'utf8');
ok(executeJs.indexOf('executeBackendReady') >= 0 && executeJs.indexOf('/api/execute') >= 0,
  'execute.js exposes ready check + proxy path');
ok(executeJs.indexOf('execute-blotter') >= 0, 'execute.js records blotter after bracket send');
ok(executeJs.indexOf('execute-fill') >= 0 && executeJs.indexOf('parseExecuteFill') >= 0,
  'execute.js auto-records fill when backend returns fill fields');
ok(executeJs.indexOf('plan.fund') >= 0, 'execute.js routes blotter to position fund');
ok(executeJs.indexOf('entry: isFinite(plan.entry)') >= 0, 'execute.js forwards entry/limit to bracket payload');
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
ok(bookJs.indexOf('bookBracketExportLabel') >= 0 && bookJs.indexOf(',stop,t1,t2,') >= 0,
  'book.js position CSV includes stop/t1/t2 columns');
ok(bookJs.indexOf('bookFillExportLabel') >= 0 && bookJs.indexOf(',bracket,fill,') >= 0,
  'book.js position CSV includes fill column');
ok(bookJs.indexOf('bookPollFills') >= 0 && bookJs.indexOf('BOOK_AUTO_POLL_FILLS_KEY') >= 0
  && bookJs.indexOf('poll-fills') >= 0 && bookJs.indexOf('bookDeskPollFills') >= 0,
  'book.js broker fill polling UI + auto poll on refresh');
ok(bookJs.indexOf('data-poll-fill') >= 0 && bookJs.indexOf('bookPollFillPosition') >= 0
  && bookJs.indexOf('UNFILLED</span>') >= 0,
  'book.js per-row UNFILLED chip + click-to-poll');
ok(bookJs.indexOf('posFillChipHTML') >= 0 && bookJs.indexOf('FILL OK') >= 0,
  'book.js broker fill status chips');
ok(bookJs.indexOf('desk.fill') >= 0 && bookJs.indexOf('Broker fills:') >= 0,
  'book.js desk rollup fill backlog line');
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
ok(bookJs.indexOf('execute_fill') >= 0 && bookJs.indexOf('live_send') >= 0
  && bookJs.indexOf('bookFilterBlotterRows') >= 0,
  'book.js EXEC blotter filter includes fill + live rows');
ok(bookJs.indexOf('bookFindPosAny') >= 0 && bookJs.indexOf('showFund') >= 0
  && bookJs.indexOf('data-fund') >= 0,
  'book.js multi-fund positions table + fund-routed OMS actions');
ok(bookJs.indexOf('bookExecBarFillFilter') >= 0 && bookJs.indexOf('BOOK_POSITIONS_FILL_FILTER_KEY') >= 0,
  'book.js fill backlog positions filter toggle');
ok(bookJs.indexOf('bookExecBarBracketFilter') >= 0 && bookJs.indexOf('BOOK_POSITIONS_BRACKET_FILTER_KEY') >= 0,
  'book.js bracket pending positions filter toggle');
ok(bookJs.indexOf('poll-fill') >= 0 && bookJs.indexOf('/api/book/poll-fill') >= 0,
  'book.js single-position poll-fill API');
ok(bookJs.indexOf('bookDailyLossHalted') >= 0 && bookJs.indexOf('DAY HALT') >= 0
  && bookJs.indexOf('bookDayHalt') >= 0,
  'book.js daily loss halt banner + status chip');
ok(bookJs.indexOf('hgBookStampRefreshThrottled') >= 0, 'book.js refreshes open keys for IN BOOK stamps');
ok(bookJs.indexOf('hgBookStampForMeta') >= 0, 'book.js exports hgBookStampForMeta fund-aware stamp');
ok(bookJs.indexOf('hgBookStampChip') >= 0 && bookJs.indexOf('hgBookStampSlot') >= 0,
  'book.js exports slotted hgBookStampChip for scanner UI');
ok(bookJs.indexOf('hgBookStampRepaintDom') >= 0, 'book.js repaints slotted stamps after key sync');
ok(bookJs.indexOf('W.toTrade(p.sym') < 0, 'book MANAGE no longer falls back to bare toTrade');
ok(bookJs.indexOf('hgToTradePlanFromBook') >= 0, 'book MANAGE uses hgToTradePlanFromBook handoff');
ok(bookJs.indexOf('deskExecStatusHTML') >= 0 && bookJs.indexOf('closedRowHTML') >= 0,
  'book.js desk exec status bar + closed trade source chips');
ok(bookJs.indexOf('opts.silent') >= 0 && bookJs.indexOf('bookFetchOpenKeys') >= 0,
  'book.js silent add + cross-fund open-key dedup');
ok(bookJs.indexOf('posExecChipHTML') >= 0 && bookJs.indexOf('BRACKET OK') >= 0
  && bookJs.indexOf('LIVE OK') >= 0 && bookJs.indexOf('live_send') >= 0,
  'book.js per-position bracket + live status chips');
ok(bookJs.indexOf('bookClosedTitle') >= 0 && bookJs.indexOf('consolidated.closed') >= 0
  && bookJs.indexOf('Recently closed (all funds)') >= 0,
  'book.js cross-fund recently closed panel');

var indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(indexHtml.indexOf("scanner: 'trade-plan'") >= 0 && indexHtml.indexOf('bookBtnHTML') >= 0,
  'trade plan exposes ADD TO BOOK when plan valid');
ok(indexHtml.indexOf('hgTradeHandoffFor') >= 0 && indexHtml.indexOf('handoff.stack') >= 0,
  'trade plan passes FTS stack from card handoff');
ok(indexHtml.indexOf('MANAGE from book') >= 0, 'trade plan labels book MANAGE handoff');
ok(indexHtml.indexOf('hgBookStampChip') >= 0, 'index cardHTML shows slotted IN BOOK chip');
ok(indexHtml.indexOf('hgBookStampRefreshThrottled') >= 0, 'showTab triggers throttled book key refresh');
ok(indexHtml.indexOf("scanner: 'gold-setup'") >= 0 && indexHtml.indexOf('hgBookStampChip') >= 0,
  'inline gold setup uses IN BOOK stamp chip');
ok(indexHtml.indexOf("scanner: 'gold-swing'") >= 0 && indexHtml.indexOf("scanner: 'gold-scalp'") >= 0,
  'inline gold swing/scalp verdicts use IN BOOK stamps');
ok(indexHtml.indexOf('renderGoldMacroAuto') >= 0 && indexHtml.indexOf("scanner: 'macro'") >= 0
  && indexHtml.indexOf('hgToTradePlanOnclickAttr(mgp.sym') >= 0,
  'gold macro AUTO panel has IN BOOK stamp + trade handoff');
ok(indexHtml.indexOf('tradeBookStamp') >= 0 && indexHtml.indexOf('planTrade') >= 0,
  'trade plan ledger shows IN BOOK chip on valid plan');
var pineJs = fs.readFileSync(path.join(root, 'pine.js'), 'utf8');
ok(pineJs.indexOf('hgBookStampChip') >= 0, 'pine fallback cardHTML uses IN BOOK chip');
ok(indexHtml.indexOf("scanner: 'swing'") >= 0 && indexHtml.indexOf("scanner: 'scalp'") >= 0,
  'swing and scalp scans use distinct scanner ids');

var squeezeJs = fs.readFileSync(path.join(root, 'squeeze.js'), 'utf8');
var edgeJs = fs.readFileSync(path.join(root, 'edge.js'), 'utf8');
var macroJs = fs.readFileSync(path.join(root, 'macro.js'), 'utf8');
ok(squeezeJs.indexOf("t2: s.t2") >= 0, 'squeeze book CTA passes T2 runner');
ok(edgeJs.indexOf('t2: p.t2') >= 0, 'edge book CTA passes T2 runner');
ok(edgeJs.indexOf('hgToTradePlanOnclickAttr') >= 0 || edgeJs.indexOf('hgToTradePlan') >= 0, 'edge trade handoff uses hgToTradePlan helper');
ok(edgeJs.indexOf('hgBookStampChip') >= 0, 'edge cards use hgBookStampChip');
var brainJs = fs.readFileSync(path.join(root, 'brain.js'), 'utf8');
ok(brainJs.indexOf('hgBookStampChip') >= 0, 'brain cards use slotted IN BOOK chip');
var carryJs = fs.readFileSync(path.join(root, 'carry.js'), 'utf8');
var termbasisJs = fs.readFileSync(path.join(root, 'termbasis.js'), 'utf8');
var goldproJs = fs.readFileSync(path.join(root, 'goldpro.js'), 'utf8');
ok(carryJs.indexOf('carryBookStamp') >= 0, 'carry cards use carryBookStamp');
ok(termbasisJs.indexOf('termBasisBookStamp') >= 0, 'term basis cards use IN BOOK stamp');
ok(goldproJs.indexOf('hgBookStampChip') >= 0, 'goldpro execution levels panel uses IN BOOK chip');
ok(macroJs.indexOf('t2: t2') >= 0 && macroJs.indexOf('macroGoldPlan') >= 0,
  'macro gold plan includes T2 for book add');
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
ok(apiJs.indexOf('execute-fill') >= 0 && apiJs.indexOf('pbApplyExecuteFill') >= 0,
  'book API accepts execute-fill webhook reconcile');
ok(apiJs.indexOf('poll-fills') >= 0 && apiJs.indexOf('pbPositionsNeedingFillPoll') >= 0,
  'book API batch poll-fills endpoint');
ok(apiJs.indexOf('poll-fill') >= 0 && apiJs.indexOf('pollApplyPositionFill') >= 0,
  'book API single poll-fill endpoint');
ok(apiJs.indexOf('hgParseExecuteFillResponse') >= 0 && apiJs.indexOf('auto from live webhook') >= 0,
  'book API live webhook auto-fill');

var execApiJs = fs.readFileSync(path.join(root, 'lib/execute-api.mjs'), 'utf8');
ok(execApiJs.indexOf('fill-status') >= 0 && execApiJs.indexOf('fillPoll') >= 0,
  'execute API exposes fill-status proxy');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
