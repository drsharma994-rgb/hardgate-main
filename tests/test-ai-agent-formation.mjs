/* HARDGATE — AI AGENT formation improvements (offline). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isGreatAgentSetup,
  agentSetupScore,
  agentSetupRr,
  AGENT_MIN_SCORE_NEAR,
} from '../lib/agent-alerts-core.mjs';
import { applyAtomicFormation } from '../lib/atomic-agent-formation.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('  ok — ' + m); } else { fail++; console.error('  FAIL — ' + m); } }

console.log('== tightened great-setup filter ==');
{
  ok(isGreatAgentSetup({
    sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, clean7: true, score: 12, style: 'swing',
  }), '7/7 clean passes');
  ok(!isGreatAgentSetup({
    sym: 'ETHUSD', dir: 'long', entry: 100, stop: 98, t1: 101, nearClean: true, score: 6, style: 'swing',
  }), '6/7 near with low score rejected');
  ok(isGreatAgentSetup({
    sym: 'ETHUSD', dir: 'long', entry: 100, stop: 95, t1: 112, nearClean: true, score: 20, style: 'swing',
  }), '6/7 near with strong score passes');
  ok(!isGreatAgentSetup({
    sym: 'SOLUSD', dir: 'long', entry: 10, stop: 9.8, t1: 10.2, clean7: true, style: 'swing',
  }), 'sub-min R:R rejected');
  ok(isGreatAgentSetup({
    sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, tier: 'PRIME', score: 25, style: 'swing',
  }), 'PRIME brain row without clean7 can pass at higher bar');
}

console.log('== atomic formation pipeline ==');
{
  ok(typeof applyAtomicFormation === 'function', 'applyAtomicFormation exported');
  const formSrc = fs.readFileSync(path.join(root, 'lib/atomic-agent-formation.mjs'), 'utf8');
  ok(/hgFormTicket/.test(formSrc) && /hgPostGateSetupVeto/.test(formSrc), 'formation module runs post-gate + hgFormTicket');
  const bad = await applyAtomicFormation({ dir: 'long', entry: 100, stop: 95, t1: 110, a4: 1 }, { rows: [] });
  ok(bad === null, ' rejects missing rows honestly');
}

console.log('== wiring ==');
{
  const ai = fs.readFileSync(path.join(root, 'ai-agent.js'), 'utf8');
  const alerts = fs.readFileSync(path.join(root, 'agent-alerts.js'), 'utf8');
  const scan = fs.readFileSync(path.join(root, 'lib/atomic-agent-scan.mjs'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/warmAgentGateScans/.test(ai), 'swarm warms gate scans');
  ok(/cryptoScanWarm\('swing'\)/.test(alerts), 'agent alerts warm swing');
  ok(/applyAtomicFormation/.test(scan), 'atomic scan uses formation');
  ok(/MEDIUM/.test(ai) === false || !/tier !== 'HIGH' && tier !== 'PRIME' && tier !== 'MEDIUM'/.test(ai),
    'brain echo drops MEDIUM tier');
  ok(/applyAgentConfluence/.test(ai), 'confluence boost wired');
  ok(/hg-v253/.test(sw), 'cache hg-v253');
}

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exit(1);
