/* HARDGATE — super-gold.js unit tests (Node 18+, no network). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({
  window: {},
  document: { head: { appendChild: function(){} }, createElement: function(){ return { id: '', textContent: '' }; } }
});
ctx.window = ctx;
ctx.globalThis = ctx;

vm.runInContext(fs.readFileSync(path.join(root, 'goldind.js'), 'utf8'), ctx, { filename: 'goldind.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'supersetup.js'), 'utf8'), ctx, { filename: 'supersetup.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'super-gold.js'), 'utf8'), ctx, { filename: 'super-gold.js' });
const W = ctx.window;

let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('ok    - ' + m); } else { fail++; console.error('FAIL  - ' + m); } }

ok(typeof W.buildSnapFromGoldScans === 'function', 'buildSnapFromGoldScans exported');
ok(typeof W.enrichSuperGoldRow === 'function', 'enrichSuperGoldRow exported');
ok(typeof W.superGoldRunScan === 'function', 'superGoldRunScan exported');
ok(typeof W.runGoldDeskAudit === 'function', 'runGoldDeskAudit exported');
ok(typeof W.collectSuperGoldScanHits === 'function', 'collectSuperGoldScanHits exported');
ok(typeof W.superGoldEvaluate === 'function', 'superGoldEvaluate exported');
ok(typeof W.buildGoldRankCtx === 'function', 'buildGoldRankCtx exported');
ok(typeof W.superGoldBuildSnap === 'function', 'superGoldBuildSnap exported');

var evalIdle = W.superGoldEvaluate(W, {});
ok(evalIdle.ready === false && /SUPER GOLD/.test(evalIdle.reason || ''), 'evaluate idle when desk empty');

ok(W.goldCandTier({ grade: 'A', demoted: false, vetoed: false }) === 'clean', 'grade A → clean');
ok(W.goldCandTier({ grade: 'B' }) === 'near', 'grade B → near');
ok(W.goldCandTier({ grade: 'C' }) === null, 'grade C skipped');
ok(W.goldCandTier({ grade: 'A', demoted: true }) === 'near', 'demoted A → near');
ok(W.goldCandTier({ grade: 'A', vetoed: true }) === null, 'vetoed skipped');

var passPill = W.superGoldDeskPill({ minimalLossPass: true });
ok(passPill.label === 'GRADE A PASS' && passPill.cls === 'minloss', 'GRADE A PASS pill');
var watchPill = W.superGoldDeskPill({ tier: 'near', nearWatch: true });
ok(watchPill.label === 'WATCH ONLY', 'WATCH ONLY pill');
var auditHoldPill = W.superGoldDeskPill({ tier: 'clean', goldAudit: { pass: false, reasons: ['Macro HEADWIND vs long'] } });
ok(auditHoldPill.label === 'AUDIT HOLD', 'AUDIT HOLD pill');
var sizeHoldPill = W.superGoldDeskPill({ tier: 'clean', goldAudit: { pass: true }, sizingPass: false, calc: { reason: 'Risk buffer too high' } });
ok(sizeHoldPill.label === 'Risk buffer too high', 'pill shows calc reason not RISK BLOCK');

W.hgInGoldWeekend = function(){ return true; };
var wkAudit = W.runGoldDeskAudit(W, {}, { dir: 'long', tier: 'clean', rr: 2 });
ok(wkAudit.pass === false && /weekend/i.test((wkAudit.reasons || []).join(' ')), 'weekend blocks gold audit');
delete W.hgInGoldWeekend;

W.getGoldMacroCached = function(){ return { realRateHint: 'HEADWIND' }; };
var macAudit = W.runGoldDeskAudit(W, {}, { dir: 'long', tier: 'clean', rr: 2 });
ok(macAudit.pass === false && /Macro HEADWIND/.test((macAudit.reasons || []).join('')), 'macro headwind blocks long');
delete W.getGoldMacroCached;

const now = Date.now();
W.goldscalpScan = function(){
  return {
    at: now - 5 * 60 * 1000,
    cands: [{
      id: 'scalp|long|1', sym: 'XAUTUSD', dir: 'long', grade: 'A', strategy: 'ASIAN BREAKOUT',
      entry: 2400, stop: 2390, t1: 2420, t2: 2430, rr: 2, tally: 9, venue: 'Delta'
    }],
    armed: [{ strategy: 'RANGE BREAK', level: 2395, state: 'armed' }],
    rejected: []
  };
};
W.goldswingScan = function(){
  return {
    at: now - 8 * 60 * 1000,
    cands: [{
      id: 'swing|short|2', sym: 'PAXGUSDT', dir: 'short', grade: 'B', strategy: '4H PULLBACK',
      entry: 2410, stop: 2425, t1: 2380, rr: 2, tally: 6, venue: 'Binance'
    }],
    armed: [],
    rejected: []
  };
};

const snap = W.buildSnapFromGoldScans(W, { balance: 5000, riskPct: 1 });
ok(snap.cands.length === 2, 'merges scalp A + swing B');
ok(snap.audit.clean === 1 && snap.audit.near === 1, 'audit counts clean/near');
ok(snap.armed.length === 1, 'armed strip preserved');
ok(snap.cands.some(function(r){ return r.minimalLossPass === true; }), 'grade A row is trade-ready');

const xauSnap = W.buildSnapFromGoldScans(W, { balance: 1000, riskPct: 1 });
const xauRow = xauSnap.cands.find(function(r){ return r.sym === 'XAUTUSD' && r.dir === 'long'; });
ok(xauRow && xauRow.minimalLossPass === true, 'GRADE A passes with supersetup calcTrade loaded');
ok(xauRow && W.superGoldDeskPill(xauRow).label === 'GRADE A PASS', 'no false RISK BLOCK with supersetup calcTrade');
ok(snap.cands.every(function(r){ return r.positionSize && !r.positionSize.error; }), 'goldAttachPositionSize on rows');

const stale = W.buildSnapFromGoldScans(W, { balance: 1000, riskPct: 1 });
const freshScalp = W.goldscalpScan;
const freshSwing = W.goldswingScan;
W.goldscalpScan = function(){ return { at: now - 25 * 60 * 60 * 1000, cands: [{ id: 'x', dir: 'long', grade: 'A', entry: 1, stop: 2, t1: 3 }] }; };
W.goldswingScan = function(){ return null; };
const strictSnap = W.buildSnapFromGoldScans(W, { balance: 1000, riskPct: 1 });
ok(strictSnap.cands.length === 0, 'strict build ignores stale gold snaps');
W.goldscalpScan = freshScalp;
W.goldswingScan = freshSwing;

const hydrated = W.superGoldSyncDesk(W, { balance: 5000, riskPct: 1 });
ok(hydrated.cands.length === 2 && hydrated.hydrated === true, 'syncDesk hydrates stale snaps');

const src = fs.readFileSync(path.join(root, 'super-gold.js'), 'utf8');
ok(/gsWarm/.test(src) && /gwWarm/.test(src), 'scan cycle warms gold desks');
ok(/goldCalcTrade/.test(src), 'gold-specific calcTrade path');
ok(/goldAttachPositionSize/.test(src), 'spot sizing wired');
ok(/hgApplyGoldBestLevels/.test(src), 'best-levels refine wired');
ok(/sg-send-trade/.test(src), 'Send to Trade Plan button');

ok(/sg-open-scalp/.test(src) && /sg-open-swing/.test(src), 'gold scalp/swing nav buttons');
ok(/hgSuperDeskInjectStyles/.test(src), 'uses shared super desk styles');
ok(!/if \(W\.__hgSuperSetupStyles\) return/.test(src), 'no super-setup style skip bug');
ok(/hg-super-desk hg-super-gold/.test(src), 'super gold uses shared desk shell');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/super-gold\.js\?v=290/.test(html), 'super-gold.js cache-busted in index.html');
ok(/'super-gold'/.test(html), 'super-gold in nav / hooks');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(swCacheOk(sw), 'sw.js cache matches build-stamp (' + HG_VER + ')');
ok(/super-gold\.js/.test(sw), 'super-gold.js in service worker cache');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
