#!/usr/bin/env node
/* HARDGATE — Delta OI-trap + funding extreme + Fed FOMC + FRED bias (hg-v554) */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..') + '/';
const require = createRequire(import.meta.url);

let passed = 0, failed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok —', msg); }
  else { failed++; console.log('  FAIL —', msg); }
}

const delta = require(root + 'lib/delta-perp-history.cjs');
const fed = require(root + 'api/fed-calendar.js');
const fedT = fed._test;

console.log('== Delta history parse / symbol contract ==');
ok(typeof delta.fetchDeltaPerpHistory === 'function', 'fetchDeltaPerpHistory exported');
ok(delta.DELTA_PERP_DEFAULT_SYMBOL === 'XAUTUSD', 'default symbol XAUTUSD');
const parsed = delta.parseDeltaCandles({
  result: [
    { time: 100, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
    { time: 50, open: 1, high: 1.2, low: 0.9, close: 1.1, volume: 5 }
  ]
});
ok(parsed.length === 2 && parsed[0].t === 50 && parsed[1].c === 1.5, 'parseDeltaCandles sorts ascending');
const tick = delta.parseDeltaTicker({
  result: { oi_contracts: '100', oi_value_usd: '44000', mark_price: '4320', funding_rate: 0.01, symbol: 'XAUTUSD' }
});
ok(tick && tick.oiContracts === 100 && tick.fundingPct === 0.01 && tick.mark === 4320,
   'parseDeltaTicker maps oi/funding/mark');

console.log('\n== Fed calendar helpers ==');
ok(fedT.parseFedClock('2:30 p.m.').h === 14 && fedT.parseFedClock('2:30 p.m.').m === 30, 'parse 2:30 p.m.');
ok(fedT.parseFedClock('8:30 a.m.').h === 8, 'parse 8:30 a.m.');
ok(fedT.dayToken('15-16') === 16 && fedT.dayToken('9') === 9, 'dayToken uses last day of range');
ok(fedT.isFomcDecision({ type: 'FOMC', title: 'FOMC Press Conference' }), 'press conference is decision');
ok(!fedT.isFomcDecision({ type: 'FOMC', title: 'FOMC Minutes' }), 'minutes are not hard-block decision');
const nev = fedT.normalizeFedEvent({
  type: 'FOMC', title: 'FOMC Press Conference', month: '2026-09', days: '16', time: '2:30 p.m.'
});
ok(nev && nev.fomcDecision && isFinite(nev.t), 'normalizeFedEvent yields epoch ms');

console.log('\n== goldind detectors (vm) ==');
globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'indicators.js', 'utf8'), { filename: 'indicators.js' });
vm.runInThisContext(fs.readFileSync(root + 'indicators2.js', 'utf8'), { filename: 'indicators2.js' });
vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
const W = globalThis.window;

ok(typeof W.hgGoldOiTrap === 'function', 'hgGoldOiTrap exported');
ok(typeof W.hgGoldFundingExtreme === 'function', 'hgGoldFundingExtreme exported');
ok(typeof W.hgGoldDollarBias === 'function', 'hgGoldDollarBias exported');
ok(typeof W.hgGoldMergeFedFomc === 'function', 'hgGoldMergeFedFomc exported');
ok(typeof W.hgGoldLoadDeltaPerp === 'function', 'hgGoldLoadDeltaPerp exported');

function synthPriceOiTrap(){
  /* Build flat range then spike high with reclaim; OI rising. */
  const rows = [], oi = [];
  const t0 = 1_700_000_000;
  for (let i = 0; i < 40; i++){
    const t = t0 + i * 900;
    const base = 2300;
    rows.push({ t, o: base, h: base + 1.5, l: base - 1.5, c: base, v: 100 });
    /* Front of window low OI, then sharp build into the last bars. */
    const oiC = (i < 30) ? 1000 : (1000 + (i - 30) * 80);
    oi.push({ t, o: oiC, h: oiC, l: oiC, c: oiC, v: 0 });
  }
  /* last bar: wick above prior high, close back inside, OI still elevated */
  const last = rows[rows.length - 1];
  const priorHi = 2301.5;
  last.h = priorHi + 4;
  last.l = 2298;
  last.c = 2300.2;
  last.o = 2300;
  oi[oi.length - 1].c = 1000 + 10 * 80;
  return { rows, oi };
}

{
  const { rows, oi } = synthPriceOiTrap();
  const hit = W.hgGoldOiTrap(rows, oi, { look: 8, buildPct: 0.04 });
  ok(hit.ok === true && hit.dir === 'short', 'OI-trap short on failed high + OI build — got ' + JSON.stringify({ ok: hit.ok, dir: hit.dir, why: hit.why }));
}

{
  const fund = [];
  const t0 = 1_700_000_000;
  for (let i = 0; i < 30; i++){
    fund.push({ t: t0 + i * 3600, o: 0.08, h: 0.09, l: 0.07, c: 0.08, v: 0 });
  }
  const ext = W.hgGoldFundingExtreme(fund, {});
  ok(ext.ok && ext.dir === 'short' && ext.extreme, 'funding extreme +0.08% → short bias');
  const mild = W.hgGoldFundingExtreme(
    fund.map((r) => Object.assign({}, r, { c: 0.01 })), {});
  ok(!mild.ok && !mild.extreme, 'funding inside band → not extreme');
}

{
  const bias = W.hgGoldRealYieldBias({
    realRateMeasured: { measured: true, trend: 'FALLING', level: 1.5 }
  });
  ok(bias.dir === 'long' && bias.source === 'fred-dfii10', 'FRED DFII10 falling → long bias');
  const dol = W.hgGoldDollarBias({ dxyOfficial: { trend20: 'RISING' } });
  ok(dol.dir === 'short' && /dollar firming/i.test(dol.reason), 'DTWEXBGS rising → gold headwind');
}

{
  const now = Date.UTC(2026, 8, 16, 18, 30, 0); /* ~2:30pm EDT */
  const fedEv = {
    title: 'FOMC Press Conference', t: now, fomcDecision: true, type: 'FOMC'
  };
  const merged = W.hgGoldMergeFedFomc({ events: [] }, { fomc: [fedEv] });
  const gate = W.hgGoldNewsGate(merged, now);
  ok(gate.lock === true && /FOMC/i.test(gate.reason || ''), 'Fed FOMC press hard-blocks news gate');
}

{
  const stack = W.hgGoldFormingStack({
    rows15m: synthPriceOiTrap().rows,
    oiRows: synthPriceOiTrap().oi,
    fundingRows: Array.from({ length: 30 }, (_, i) => ({
      t: 1_700_000_000 + i * 3600, o: 0.08, h: 0.09, l: 0.07, c: 0.08, v: 0
    }))
  });
  ok(stack.oiTrap && typeof stack.oiTrap.ok === 'boolean', 'forming stack carries oiTrap');
  ok(stack.fundingExtreme && stack.fundingExtreme.ok, 'forming stack carries funding extreme');
  ok(Array.isArray(stack.watches) && stack.watches.some((w) => w.stratKey === 'oitrap'),
     'forming watches include oitrap');
  ok(Array.isArray(stack.watches) && stack.watches.some((w) => w.stratKey === 'fundext'),
     'forming watches include fundext');
  const html = W.hgGoldFormingStackHtml(stack);
  ok(/FORMING LAYERS/.test(html), 'forming HTML still paints');
}

console.log('\n== source wiring ==');
const scalp = fs.readFileSync(root + 'goldscalp.js', 'utf8');
const swing = fs.readFileSync(root + 'goldswing.js', 'utf8');
const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
const server = fs.readFileSync(root + 'scripts/server.mjs', 'utf8');
ok(/hgGoldLoadDeltaPerp/.test(scalp) && /hgGoldLoadFedCalendar/.test(scalp), 'GOLD SCALP loads Delta+Fed');
ok(/hgGoldLoadDeltaPerp/.test(swing) && /hgGoldApplyPerpNative/.test(swing), 'GOLD SWING loads Delta + applies perp native');
ok(/hgGoldLoadDeltaPerp/.test(og) && /perpNative/.test(og), 'OMNIGOLD loads Delta perp native');
ok(/\/api\/delta\/perp-history/.test(server) && /\/api\/fed-calendar/.test(server),
   'server routes /api/delta/perp-history + /api/fed-calendar');

console.log('\n' + passed + ' assertions passed' + (failed ? ', ' + failed + ' FAILED' : ''));
process.exit(failed ? 1 : 0);
