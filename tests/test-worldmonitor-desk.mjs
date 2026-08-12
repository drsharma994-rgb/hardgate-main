/* HARDGATE — World Monitor desk integration tests (offline). */
import {
  wmMacroFormationBoost,
  wmStressFormationBoost,
  wmGoldFormationBoost,
  wmDeskFormationBoost,
  wmFinalizeDesk,
} from '../lib/worldmonitor-core.mjs';
import { worldmonitorCapabilities } from '../lib/worldmonitor-fetch.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

console.log('== worldmonitor formation boosts ==');
{
  ok(wmMacroFormationBoost('long', { verdict: 'BUY', unavailable: false }) === 10, 'BUY long boost');
  ok(wmMacroFormationBoost('long', { verdict: 'CASH', unavailable: false }) === -5, 'CASH long caution');
  ok(wmStressFormationBoost('long', { label: 'Critical' }) === -10, 'critical stress long');
  ok(wmGoldFormationBoost('long', { unavailable: false, etfFlows: { changeW1Tonnes: 5 } }) >= 6, 'gold ETF inflow long');
  var desk = wmFinalizeDesk({
    source: 'test',
    macro: { verdict: 'BUY', bullishCount: 4, totalCount: 5, unavailable: false },
    stress: { label: 'Low', score: 15 },
    gold: { unavailable: false, goldPrice: 2400, goldChangePct: 0.6 },
    hyperliquid: { assets: [{ symbol: 'BTC', score: 30, alert: false, fundingRate: -0.0002 }] },
  });
  ok(desk.knowledgeScore > 50, 'knowledge score computed');
  ok(wmDeskFormationBoost('long', 'crypto', desk) > 0, 'net long crypto boost positive');
}

console.log('== wiring ==');
{
  ok(/createWorldmonitorApi/.test(fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8')), 'server mounts wm api');
  ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').indexOf('worldmonitor-desk.js') >= 0, 'index loads wm desk');
  ok(/worldmonitor-desk\.js/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'sw shell wm desk');
ok(/hg-v267/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'cache hg-v267');
  ok(fs.readFileSync(path.join(root, 'setup-stack.js'), 'utf8').indexOf('World Monitor') >= 0, 'setup-stack wm bumps');
  ok(fs.readFileSync(path.join(root, 'formation-instr-ui.js'), 'utf8').indexOf('hgWorldMonitorDeskPanelHtml') >= 0, 'formation panel wm');
  var caps = worldmonitorCapabilities({});
  ok(caps.deskRoute === '/api/worldmonitor/desk' && caps.localFallback === true, 'capabilities');
}

console.log('\n' + pass + ' assertions passed');
