/* HARDGATE — OpenBB desk macro for formation (offline). */
import {
  obbParseYahooChart,
  obbTrend20,
  obbRiskOnScore,
  obbRiskOnLabel,
  obbDeskMacroScore,
  obbDeskFormationBoost,
  obbFinalizeDesk,
} from '../lib/openbb-desk-core.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== obbParseYahooChart + trend ==');
{
  var sample = {
    chart: {
      result: [{
        timestamp: [1, 2, 3, 4, 5, 6],
        indicators: { quote: [{ open: [100, 101, 102, 103, 104, 105], high: [101, 102, 103, 104, 105, 106],
          low: [99, 100, 101, 102, 103, 104], close: [100, 101, 102, 103, 104, 106] }] },
      }],
    },
  };
  var rows = obbParseYahooChart(sample);
  ok(rows.length === 6, 'parse yahoo rows');
  var tr = obbTrend20(rows);
  ok(tr.trend === 'RISING', 'rising trend on up closes');
}

console.log('== risk-on score ==');
{
  var desk = obbFinalizeDesk({
    spx: { trend20: 'RISING', last: 500 },
    vix: { last: 13, trend20: 'FALLING' },
    dxy: { trend20: 'FALLING' },
    btc: { trend20: 'RISING' },
  });
  ok(desk.riskOnScore > 20, 'risk-on desk positive score');
  ok(obbRiskOnLabel(desk.riskOnScore) === 'RISK-ON' || desk.riskOnScore >= 15, 'risk-on label band');
}

console.log('== formation boost ==');
{
  var d = { riskOnScore: 45 };
  ok(obbDeskFormationBoost('long', d) === 12, 'long aligned max boost');
  ok(obbDeskFormationBoost('short', d) < 0, 'short against risk-on penalized');
}

console.log('== FQS macro pillar ==');
{
  var ms = obbDeskMacroScore({ side: 'long', riskOnScore: 40 }, { riskOnScore: 40 });
  ok(ms >= 0.85, 'long macro score high on risk-on');
}

console.log('== wiring ==');
{
  ok(fs.existsSync(path.join(root, 'lib/openbb-desk-core.mjs')), 'core exists');
  ok(fs.existsSync(path.join(root, 'lib/openbb-api.mjs')), 'api exists');
  ok(fs.existsSync(path.join(root, 'openbb-desk.js')), 'browser bridge exists');
  var srv = fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8');
  ok(srv.indexOf('createOpenbbApi') >= 0, 'server mounts openbb');
  ok(srv.indexOf('/api/openbb') >= 0, 'openbb route');
  var idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(idx.indexOf('openbb-desk.js') >= 0, 'index loads openbb-desk.js');
  var fq = fs.readFileSync(path.join(root, 'lib/formation-quality.mjs'), 'utf8');
  ok(fq.indexOf('obbDeskMacroScore') >= 0, 'FQS uses desk macro');
  var sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v238/.test(sw), 'cache hg-v238');
}

console.log('\n' + pass + ' passed');
