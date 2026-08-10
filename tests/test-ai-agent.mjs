/* HARDGATE — AI AGENT workforce tests (offline). */
import { AGENT_ROSTER, agentCapabilities, agentById } from '../lib/agent-roster.mjs';
import { AgentStateStore } from '../lib/agent-state.mjs';
import { finalizeAgentDesk, buildDeskFromStore } from '../lib/agent-workforce.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

console.log('== agent roster ==');
{
  ok(AGENT_ROSTER.length === 8, 'eight agents defined');
  ok(!!agentById('gate-hunter'), 'gate-hunter exists');
  ok(!!agentById('gold-smith'), 'gold-smith exists');
  var caps = agentCapabilities({});
  ok(caps.routes.desk === '/api/agents/desk', 'desk route');
  ok(caps.agents.length === 8, 'capabilities lists agents');
}

console.log('== agent desk merge ==');
{
  var desk = finalizeAgentDesk({
    agents: {
      'gate-hunter': {
        ok: true,
        label: 'Gate Hunter',
        findings: [{ sym: 'BTCUSD', dir: 'long', clean7: true, score: 12, asset: 'crypto' }],
      },
      'gold-smith': {
        ok: true,
        label: 'Gold Smith',
        findings: [{ sym: 'XAUUSD', dir: 'long', score: 14, asset: 'gold' }],
      },
    },
  });
  ok(desk.swarmScore > 0, 'swarm score computed');
  ok(desk.cryptoSetups === 1 && desk.goldSetups === 1, 'crypto+gold counts');
  ok(desk.topFindings.length >= 2, 'top findings merged');
}

console.log('== agent state ==');
{
  var tmp = path.join(root, '.tmp-agent-state-test.json');
  try{ fs.unlinkSync(tmp); }catch(e){}
  var store = new AgentStateStore(tmp);
  store.load();
  store.ingestReport({
    agentId: 'brain-echo',
    ok: true,
    findings: [{ sym: 'ETHUSD', dir: 'short', score: 12 }],
    at: new Date().toISOString(),
  });
  ok(store.getAgents()['brain-echo'], 'report ingested');
  try{ fs.unlinkSync(tmp); }catch(e2){}
}

console.log('== browser swarm helpers ==');
{
  var mod = await import('../ai-agent.js');
  ok(typeof mod.hgAgentRunOne === 'function', 'hgAgentRunOne exported');
  ok(typeof mod.buildDeskFromAgents === 'function', 'buildDeskFromAgents exported');
  var agents = {
    'gate-hunter': { ok: true, label: 'Gate Hunter', findings: [{ sym: 'SOLUSD', dir: 'long', score: 8 }] },
  };
  var d = mod.buildDeskFromAgents(agents);
  ok(d.topFindings.length === 1, 'browser desk builder');
  var gate = await mod.hgAgentRunOne('gate-hunter');
  ok(gate && gate.agentId === 'gate-hunter', 'gate-hunter offline run');
}

console.log('== wiring ==');
{
  ok(/createAgentApi/.test(fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8')), 'server mounts agent api');
  ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').indexOf('ai-agent.js') >= 0, 'index loads ai-agent');
  ok(/ai-agent\.js/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'sw shell ai-agent');
  ok(/hg-v224/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'cache hg-v224');
  ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').indexOf("'aiagent'") >= 0, 'nav aiagent tab');
  ok(fs.readFileSync(path.join(root, 'setup-stack.js'), 'utf8').indexOf('AI workforce') >= 0, 'setup-stack agent bump');
  ok(/HARDGATE_AGENT_SWARM/.test(fs.readFileSync(path.join(root, 'app.js'), 'utf8')), 'daemon agent swarm hook');
  ok(/runAgentSwarm/.test(fs.readFileSync(path.join(root, 'lib/agent-brain.mjs'), 'utf8')), 'agent-brain puppeteer');
}

console.log('\n' + pass + ' assertions passed');
