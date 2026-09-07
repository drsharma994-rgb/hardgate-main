/* HARDGATE — positioning/regime audit regression (hg-v631)
   Static source contracts for SMART $, SQUEEZE, REGIME, CARRY fixes. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const squeeze = fs.readFileSync(path.join(ROOT, 'squeeze.js'), 'utf8');
const carry = fs.readFileSync(path.join(ROOT, 'carry.js'), 'utf8');
const regime = fs.readFileSync(path.join(ROOT, 'regime.js'), 'utf8');
const positioning = fs.readFileSync(path.join(ROOT, 'positioning.js'), 'utf8');
const oiflow = fs.readFileSync(path.join(ROOT, 'oiflow.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

ok(swCacheOk(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js matches ' + HG_VER);

/* SQUEEZE — closed-bar 1D hard gate */
ok(/function sqDropForming/.test(squeeze), 'squeeze: sqDropForming helper present');
ok(/rows1d = sqDropForming\(rows1d, '1d'\)/.test(squeeze), 'squeeze: dailyTrend drops forming 1D bar');
ok(/rows4h = sqDropForming\(rows4h, '4h'\)/.test(squeeze), 'squeeze: classify drops forming 4H bar');
ok(/if \(trend !== 'UP'\)/.test(squeeze) && /if \(trend !== 'DOWN'\)/.test(squeeze),
   'squeeze: 1D trend is a hard veto on fired states');

/* CARRY — Delta APR via carryAnnualize, not hardcoded 3*365 in spread core */
ok(/DELTA_FUNDING_INTERVAL_HOURS = 8/.test(carry), 'carry: Delta 8h interval constant');
ok(/carryAnnualize\(deltaRatePct8h, DELTA_FUNDING_INTERVAL_HOURS\)/.test(carry),
   'carry: Delta leg uses carryAnnualize helper');
ok(/deltaIntervalAssumed/.test(carry), 'carry: delta interval assumption flagged on spread result');

/* REGIME — doc reflects 9 scored / max ±9 */
ok(/theoretical max \|score\| = 9/.test(regime), 'regime: max score documented as ±9');
ok(/R7 GOLD.*HEDGE DEMAND/.test(regime), 'regime: R7 gold gauge documented');

/* POSITIONING — unit-asymmetry note */
ok(/position-weighted/.test(positioning) && /account-weighted/.test(positioning),
   'positioning: top vs retail unit asymmetry documented');

/* OI FLOW — funding z window in prints, not calendar days */
ok(/funding z\(90\)/.test(oiflow) && /90 prints/.test(oiflow),
   'oiflow: funding z label uses print count not "30-day"');

/* BASIS tab — cross-venue price gap label (informational) */
ok(/Cross-Venue Basis/.test(html) || /cross-venue price/i.test(html),
   'basis tab: cross-venue framing present in index.html');

/* Pure carrySpread still annualizes identically for 8h legs */
{
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(carry, ctx, { filename: 'carry.js' });
  const cs = ctx.window.carrySpread;
  const r = cs(0.05, 0.01);
  ok(r && Math.abs(r.spreadAPR - 43.8) < 1e-9, 'carrySpread: 8h math unchanged (43.8% spread)');
  ok(r.deltaIntervalHours === 8 && r.deltaIntervalAssumed === true, 'carrySpread: interval metadata on result');
}

/* Pure squeezeClassify hard veto (vm) */
{
  const ctx = vm.createContext({ window: {} });
  for (const f of ['indicators.js', 'indicators2.js', 'squeeze.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  function trendRows(n, start, step){
    const r = [];
    for (let i = 0; i < n; i++){
      const c = start + (i + 1) * step, o = c - step;
      r.push({ t: i, o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c, v: 1000 });
    }
    return r;
  }
  const dDn = trendRows(120, 140, -0.5);
  const flat = [];
  for (let i = 0; i < 60; i++) flat.push({ t: i, o: 50, h: 51, l: 49, c: 50, v: 1000 });
  const full = flat.concat(trendRows(30, 50, 1, 1000));
  const ttm = ctx.ttmSqueeze(full);
  const fIdx = ttm.fired.findIndex(Boolean);
  ok(fIdx > 0, 'squeeze audit fixture: fire index found');
  const cls = ctx.window.squeezeClassify(full.slice(0, fIdx + 1), dDn);
  ok(cls.state === 'NONE' && cls.trendAgree === false,
     'squeezeClassify: FIRED_LONG hard-vetoed on 1D downtrend');
}

console.log('\n' + passed + ' assertions passed');
