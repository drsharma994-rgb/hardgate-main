/* HARDGATE — AI AGENT alert + watch tests (offline). */
import {
  agentSetupKey,
  agentAlertsFresh,
  agentAlertsFormat,
  filterGreatSetups,
  isGreatAgentSetup,
  mergeAgentSetups,
} from '../lib/agent-alerts-core.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

console.log('== agent alert core ==');
{
  var s = {
    sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, clean7: true,
    agentLabel: 'Gate Hunter', score: 12,
  };
  ok(isGreatAgentSetup(s), 'clean setup with levels is great');
  ok(!isGreatAgentSetup({ sym: 'X', dir: 'long' }), 'no levels not great');
  var key = agentSetupKey(s);
  ok(key.indexOf('BTCUSD') >= 0, 'setup key');
  var fr = agentAlertsFresh({}, [s], Date.now(), 300000);
  ok(fr.fresh.length === 1, 'first fresh');
  var fr2 = agentAlertsFresh(fr.keys, [s], Date.now() + 1000, 300000);
  ok(fr2.fresh.length === 0, 'dedup within gap');
  var body = agentAlertsFormat(fr.fresh);
  ok(body.indexOf('ENTRY:') >= 0 && body.indexOf('STOP LOSS:') >= 0 && body.indexOf('TAKE PROFIT') >= 0, 'telegram body has levels');
  ok(body.indexOf('AI AGENT') >= 0, 'telegram header');
}

console.log('== merge setups ==');
{
  var merged = mergeAgentSetups([
    [{ sym: 'ETHUSD', dir: 'short', entry: 3000, stop: 3050, t1: 2900, clean7: true, agentLabel: 'A' }],
    [{ sym: 'ETHUSD', dir: 'short', entry: 3000, stop: 3050, t1: 2900, clean7: true, agentLabel: 'B' }],
  ]);
  ok(merged.length === 1, 'dedupe merged lists');
}

console.log('== browser agent-alerts ==');
{
  var mod = await import('../agent-alerts.js');
  ok(typeof mod.hgAgentAlertsFormat === 'function', 'hgAgentAlertsFormat exported');
  ok(typeof mod.isGreatSetup === 'function', 'isGreatSetup exported');
  ok(mod.isGreatSetup({ sym: 'SOLUSD', dir: 'long', entry: 10, stop: 9.5, t1: 11, clean7: true, score: 12 }), 'browser great filter');
}

console.log('== wiring ==');
{
  ok(/startAgentWatch/.test(fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8')), 'server agent watch');
  ok(/agent-watch/.test(fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8')), 'agent-watch api');
  ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').indexOf('agent-alerts.js') >= 0, 'index loads agent-alerts');
  ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').indexOf('hgAgentAlertsRun') >= 0, 'alert cycle calls agent alerts');
  ok(/hgAgentWorkforceCollect/.test(fs.readFileSync(path.join(root, 'ai-agent.js'), 'utf8')), 'workforce collect export');
  ok(/agent-alerts\.js/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'sw shell agent-alerts');
  ok(/hg-v220/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'cache hg-v220');
}

console.log('\n' + pass + ' assertions passed');
