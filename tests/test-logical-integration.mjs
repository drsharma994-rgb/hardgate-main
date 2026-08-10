/* HARDGATE — unified integration smoke (gstack + AI agent + trend matrix). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

console.log('== hg-v226 shell ==');
{
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v226/.test(sw), 'cache hg-v226');
  ok(sw.indexOf('gstack-brain.js') >= 0, 'sw precaches gstack-brain');
  ok(sw.indexOf('trendtable.js') >= 0, 'sw precaches trendtable');
}

console.log('== gstack + brain wiring ==');
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const gIdx = html.indexOf('src="gstack-brain.js"');
  const bIdx = html.indexOf('src="brain.js"');
  ok(gIdx >= 0 && bIdx >= 0 && gIdx < bIdx, 'gstack loads before brain');
  ok(/applyGstackBrain/.test(fs.readFileSync(path.join(root, 'brain.js'), 'utf8')), 'brain applies gstack');
}

console.log('== AI agent + trend matrix cross-wire ==');
{
  const agent = fs.readFileSync(path.join(root, 'ai-agent.js'), 'utf8');
  ok(agent.indexOf("'trend-scout'") >= 0, 'trend-scout agent registered');
  ok(/trendmxCrossState/.test(agent), 'collectSetups pulls trend matrix golden');
  ok(/trendmxWarm/.test(agent), 'swarm warms trend matrix');
  ok(/runTrendmxScout/.test(agent), 'trend scout runner wired');
  const stack = fs.readFileSync(path.join(root, 'setup-stack.js'), 'utf8');
  ok(stack.indexOf('trendmx') >= 0, 'setup-stack trend matrix FTS bump');
  const trend = fs.readFileSync(path.join(root, 'trendtable.js'), 'utf8');
  ok(/trendmxGateEval/.test(trend), 'trend matrix uses gate eval');
  ok(/hgFormTicket/.test(trend), 'trend matrix formation ticket path');
}

console.log('== tab alert warm chain ==');
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(html.indexOf('trendmxWarm') >= 0, 'tab alerts warm trend matrix');
  ok(html.indexOf('trendmx:') >= 0, 'HG_TAB_AUTO_SCAN trendmx');
}

console.log('== advanced trend matrix desk ==');
{
  const trend = fs.readFileSync(path.join(root, 'trendtable.js'), 'utf8');
  ok(/GOLDEN CROSS DESK/.test(trend), 'golden cross desk panel');
  ok(/LIMIT BOARD/.test(trend), 'limit board panel');
  ok(/data-r="cards"/.test(trend), 'clean ticket cards mount');
  ok(/hgPaintTrendmxFromSnap/.test(trend), 'snap restore helper');
  ok(fs.readFileSync(path.join(root, 'setup-ui.js'), 'utf8').indexOf('trendmxDesk') >= 0, 'setup-ui trendmx desk');
}

console.log('\n' + pass + ' integration checks passed');
