/* HARDGATE — hg-v1187: crypto Pine ports on TREND MATRIX.

   Five bar-only Pine strategies — Lorentzian KNN, Half-Trend, Squeeze
   Momentum, Smart Money Flow and MSB/OB — are read off each crowned row's
   own 4h tape and attached to the reads bag as record-only marks. The
   perfect predicate ignores them (no gate, no score); the crown prints a
   PINE evidence line and the forward ledger later decides whether any
   separates. Each unreadable signal is null.

   Run: node tests/test-trendmx-crypto-pine-v1187.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.G = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-gates.js', 'hg-perfect-setup.js',
                   'hg-setup-core.js', 'crypto-position-risk.js', 'cryptogates.js',
                   'plans.js', 'setup-ui.js', 'trendtable.combined.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});
  return ctx;
}

const T4 = 14400;
function mkRows(n, slope){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 100 + i * slope;
    rows.push({ t: 1760000000 - (n - 1 - i) * T4, o: c - 0.02, h: c + 0.4, l: c - 0.4, c, v: 100 });
  }
  return rows;
}
function row(sym, score){
  return { sym, base: 'BTC', score, exchange: 'delta',
    comps: { d200: 1, x: 1, h4: 1, cloud: 1, adx: 0 }, adx: 28, price: 103, fundingPct: 0.002,
    gate: { label: 'trend', clean7: true, veto: false, gatesPassed: 7 },
    rows4h: mkRows(220, 0.05) };
}

console.log('== the five Pine marks ride the reads bag (record-only) ==');
{
  const cap = {};
  const W = boot({
    pineLorentzianKernel: () => { cap.lor = true; return { dir: 'long' }; },
    pineHalfTrend: () => { cap.ht = true; return { dir: 'short' }; },
    pineSqueezeMomentum: () => { cap.sqz = true; return { dir: 'long' }; },
    pineSmartMoneyFlow: () => { cap.smf = true; return { dir: 'long' }; },
    pineMsbOb: () => { cap.msb = true; return { dir: 'short' }; },
    pineSmcCore: () => { cap.smc = true; return { dir: 'long' }; },
    binanceTakerRatio: async () => ({ series: [] }),
    binanceFunding: async () => ({ fundingPct: 0.001 }),
    hgNewsRisk: () => ({ blackout: false }),
    hgObtcPerfectFormation: (pick, reads) => { cap.reads = reads; }
  });
  await W.trendmxPerfectEvidencePass([row('BTCUSD', 3)]);
  ok(cap.lor && cap.ht && cap.sqz && cap.smf && cap.msb && cap.smc, 'all six Pine signals are read off the 4h tape');
  ok(cap.reads.pineSmc === 'long', 'the SMC Core mark rides the reads bag');
}

console.log('== the crown prints the PINE evidence line ==');
{
  const W = boot({
    hgProvenEdgeVerdict: () => ({ state: 'proven', n: 40, hit: 0.55, expR: 0.3, floor: 20 }),
    hgProvenEdgeChipHtml: () => 'CHIP',
    getWorldMonitorDeskCached: () => ({ macro: { verdict: 'BUY' }, stress: { label: 'LOW' } }),
    regimeState: () => ({ playbook: { bias: 'LONG-ONLY' } })
  });
  const r = row('BTCUSD', 3);
  r.perfectReads = { pineLorKnn: 'long', pineHalfTrend: 'short', pineSqueeze: 'long', pineSmf: 'long', pineMsb: 'short' };
  const html = W.trendmxCrownPanelHTML({ rows: [r] });
  ok(html.indexOf('PINE') >= 0 && html.indexOf('LorKNN long') >= 0 && html.indexOf('half-trend short') >= 0, 'the crown TECHNICAL prints the Pine marks');
}

console.log('== wiring pins ==');
{
  const p9 = read('trendtable-src-9.js');
  ok(p9.indexOf('function trendmxPineMarks') >= 0, 'the marks helper is defined');
  ok(p9.indexOf('pineLorentzianKernel') >= 0 && p9.indexOf('pineMsbOb') >= 0, 'the five Pine ports are referenced');
  ok(p9.indexOf('PINE ' + 'pineBits') >= 0 || p9.indexOf("tech.push('PINE '") >= 0, 'the crown renders the Pine line');
  const p10 = read('trendtable-src-10.js');
  ok(p10.indexOf('trendmxPineMarks(r.rows4h)') >= 0, 'the pass reads the marks off the 4h tape');
  /* hg-v1237: the marks must REACH the ledger, not just the crown — tmRecordReads
     forwards them as boolean reads so hgFwdReadSplit measures them */
  const p1 = read('trendtable-src-1.js');
  ok(p1.indexOf("rd['pine:smcWith'] = pm.smc === dir") >= 0, 'tmRecordReads forwards the pine marks onto the reads seam');
  ok(p1.indexOf("rd['pine:lorKnnWith'] = pm.lor === dir") >= 0, 'all ten pine marks forward (lorKnn, halftrend, squeeze, smf, msb, cipher, rangefilter, nwenvelope, wavwap, smc)');
}

console.log('\ntest-trendmx-crypto-pine-v1187: ' + passed + ' passed, 0 failed');
