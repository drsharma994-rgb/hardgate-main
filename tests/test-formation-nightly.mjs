/* HARDGATE — nightly formation rebake (pure + live apply). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';
import {
  nightlyDue, dayAsideKinds, dayPreferKinds, tightenCostCeil, pickOg1Apply,
  buildNightlyApply, clampOg1Floors, nightlyBannerText, statsFromBacktestAll,
  BAKED_OP_COST_CEIL, BAKED_OG1_MIN_RISK, BAKED_OG1_MIN_DISP, NIGHTLY_HOUR_UTC
} from '../lib/formation-nightly.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function bootDesks(nightly){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
    parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
    setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){} }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  ctx.fetch = async () => ({ ok: false, json: async () => ({}) });
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'plans.js',
                   'hg-mechanics.js', 'hg-forward.js', 'hg-gates.js', 'hg-plan.js',
                   'omniroute.js', 'omnipresent.js', 'gold-seven-step.js', 'omnigold1.js',
                   'formation-nightly.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  if (nightly) ctx.hgFormationNightlyApply(nightly);
  return ctx;
}

console.log('== schedule ==');
{
  ok(NIGHTLY_HOUR_UTC === 21, 'rebake after 21:00 UTC (London close)');
  const day = new Date('2026-09-05T21:30:00Z');
  ok(nightlyDue(null, day) === true, 'first night is due');
  ok(nightlyDue('2026-09-05T21:31:00Z', day) === false, 'same UTC day not due again');
  ok(nightlyDue('2026-09-04T21:31:00Z', day) === true, 'next UTC day is due');
  ok(nightlyDue(null, new Date('2026-09-05T20:59:00Z')) === false, 'before 21:00 UTC is not due');
}

console.log('== day aside / prefer ==');
{
  const bags = {
    PO3: { n: 10, avgGross: -0.08, avgNet: -0.22 },
    ORB: { n: 12, avgGross: 0.04, avgNet: -0.01 },
    MMOVE: { n: 9, avgGross: 0.20, avgNet: 0.08 },
    THIN: { n: 3, avgGross: -1, avgNet: -1 }
  };
  ok(JSON.stringify(dayAsideKinds(bags)) === JSON.stringify(['PO3']), 'PO3 day-toxic aside');
  ok(JSON.stringify(dayPreferKinds(bags, 8, ['PO3'])) === JSON.stringify(['MMOVE']), 'MMOVE day-prefer');
  ok(!dayAsideKinds(bags).includes('ORB'), 'ORB near-even is not day-aside');
  ok(!dayAsideKinds(bags).includes('THIN'), 'n<8 does not aside');
}

console.log('== cost ceiling never loosens ==');
{
  ok(tightenCostCeil({ n: 20, avgNet: -0.40 }, 0.12) === 0.08, 'toxic fade day tightens to 0.08');
  ok(tightenCostCeil({ n: 20, avgNet: -0.18 }, 0.12) === 0.10, 'mild toxic fade tightens to 0.10');
  ok(tightenCostCeil({ n: 20, avgNet: 0.05 }, 0.12) === 0.12, 'green fade day keeps baked 0.12 — never loosens');
  ok(tightenCostCeil({ n: 3, avgNet: -1 }, 0.12) === 0.12, 'thin day does not move the ceiling');
}

console.log('== OG1 picker stays on tighten-only whitelist ==');
{
  const v = {
    raw: { resolved: 20, expR: -0.27 },
    'minRisk5+disp0.5': { resolved: 16, expR: -0.20 },
    'gated+bias': { resolved: 8, expR: 0.50 }
  };
  const a = pickOg1Apply(v);
  ok(a.bestNamed === 'minRisk5+disp0.5', 'ignores gated+bias even if it prints better');
  ok(a.minRisk >= BAKED_OG1_MIN_RISK && a.minDisp >= BAKED_OG1_MIN_DISP, 'floors stay');
  const rawBest = pickOg1Apply({ raw: { resolved: 20, expR: -0.10 }, 'minRisk5+disp0.5': { resolved: 16, expR: -0.40 } });
  ok(rawBest.bestNamed === 'raw', 'raw can win the day walk');
  ok(rawBest.minRisk === 5 && rawBest.minDisp === 0.5, 'raw win still keeps SL$ / disp floors');
  const clamped = clampOg1Floors({ minRisk: 2, minDisp: 0.1, gated: true });
  ok(clamped.minRisk === 5 && clamped.minDisp === 0.5 && clamped.gated === true, 'clamp refuses a looser floor');
}

console.log('== apply object ==');
{
  const j = buildNightlyApply({
    asOf: '2026-09-05T21:30:00Z',
    dayUtc: '2026-09-05',
    omnirouteBags: {
      PO3: { n: 10, avgGross: -0.08, avgNet: -0.22 },
      MMOVE: { n: 9, avgGross: 0.20, avgNet: 0.08 }
    },
    omnipresentBag: { n: 12, avgGross: -0.05, avgNet: -0.28 },
    og1Variants: { raw: { resolved: 10, expR: -0.3 }, 'minRisk5+disp0.5': { resolved: 8, expR: -0.2 } }
  });
  ok(j.omniroute.dayAside.includes('PO3'), 'apply asides PO3');
  ok(j.omniroute.dayPrefer.includes('MMOVE'), 'apply prefers MMOVE');
  ok(j.omnipresent.costCeilingR <= BAKED_OP_COST_CEIL, 'OP cost never above baked');
  ok(j.omnipresent.standAsideTriggered === true, 'toxic fade day stands TRIGGERED aside');
  ok(j.omnipresent.goldAside === true, 'gold perps stay aside');
  ok(j.neverLoosen.indexOf('G1-G7') >= 0, 'never-loosen list names G1–G7');
  ok(/NIGHTLY FORMATION 2026-09-05/.test(nightlyBannerText(j)), 'banner names the UTC day');
  ok(!/% chance|win rate|probability/i.test(nightlyBannerText(j)), 'banner has no probability language');
}

console.log('== statsFromBacktestAll ==');
{
  const bags = statsFromBacktestAll({ PO3: { samples: 10, expR: -0.2 }, ORB: { samples: 2, expR: 0.1 } });
  ok(bags.PO3.n === 10 && bags.PO3.avgGross === -0.2, 'maps expR to avgGross');
  ok(bags.ORB && bags.ORB.n === 2, 'thin kinds stay in the bag; aside still requires n≥8');
  ok(!dayAsideKinds(bags).includes('ORB'), 'n=2 never asides');
}

console.log('== live desks honour nightly overlay ==');
{
  const nightly = buildNightlyApply({
    asOf: '2026-09-05T21:30:00Z', dayUtc: '2026-09-05',
    omnirouteBags: {
      VALUE: { n: 10, avgGross: -0.3, avgNet: -0.4 },
      MMOVE: { n: 9, avgGross: 0.25, avgNet: 0.10 }
    },
    omnipresentBag: { n: 12, avgNet: -0.28, avgGross: -0.1 },
    og1Variants: { 'minRisk5+disp0.5': { resolved: 8, expR: -0.2 } }
  });
  const W = bootDesks(nightly);
  ok(typeof W.hgFormationNightlyApply === 'function', 'hgFormationNightlyApply export');
  ok(!!W.hgOmniKindDemotion('VALUE'), 'VALUE n=12 baked-open becomes day-aside');
  ok(!!W.hgOmniKindDemotion('PO3'), 'baked PO3 demote still fires');
  ok(W.hgOmniKindPrefer('MMOVE') === true, 'day-prefer MMOVE (already baked-prefer or nightly)');
  ok(W.hgOmniKindPrefer('VALUE') === false, 'aside kind is never preferred');
  const ev = W.HG_OP_REPLAY_EVIDENCE;
  ok(ev.costToxic.thresholdR <= 0.12, 'OP cost overlay did not loosen');
  ok(ev.costToxic.thresholdR <= nightly.omnipresent.costCeilingR + 1e-9, 'OP cost follows nightly tighten');
  ok(W.HG_OG1_FORM_EDGE.minRisk >= 5 && W.HG_OG1_FORM_EDGE.minDisp >= 0.5, 'OG1 overlay keeps floors');
  ok(typeof W.opGates === 'function', 'opGates export');
  const gates = W.opGates([], {
    dir: 'short', status: 'TRIGGERED',
    entry: 100, stop: 102, atr: 1, rr1: 2.5,
    zone: { lo: 99, hi: 101, confluence: 3, srcs: ['PDH', 'VWAP', 'POC'] },
    evidence: ['wick rejection', 'RSI divergence']
  }, 100.2, 'BTCUSDT');
  const day = (gates || []).find(g => g && g.key === 'replay-day');
  ok(day && day.hard === true && day.pass === false, 'OP TRIGGERED stands aside on toxic fade day');
}

console.log('== wiring + stamp ==');
{
  const html = read('index.html');
  ok(/formation-nightly\.js\?v=/.test(html), 'index loads formation-nightly.js');
  ok(/omnigold1\.js/.test(html) && html.indexOf('formation-nightly.js') > html.indexOf('omnigold1.js'),
     'nightly overlay loads after OMNIGOLD 1');
  ok(/omnipresent\.js/.test(html) && html.indexOf('formation-nightly.js') > html.indexOf('omnipresent.js'),
     'nightly overlay loads after OMNIPRESENT');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches ' + HG_VER);
  ok(/formation-nightly\.js/.test(read('sw.js')), 'sw.js precaches formation-nightly.js');
  ok(/formation-nightly/.test(read('scripts/server.mjs')), 'server mounts formation-nightly API');
  ok(fs.existsSync(path.join(ROOT, 'scripts/nightly-formation-rebake.mjs')), 'rebake harness exists');
  ok(fs.existsSync(path.join(ROOT, '.github/workflows/formation-nightly.yml')), 'nightly workflow exists');
}

console.log('\nall ok —', pass, 'assertions');
