/* HARDGATE — Increment 5/6/7 roadmap wiring tests */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok —', m); };

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(html.indexOf('exchange_netflow.js') >= 0, 'exchange_netflow.js loaded');
ok(html.indexOf('whale_alerts.js') >= 0, 'whale_alerts.js loaded');
ok(html.indexOf('inc567-config-loader.js') >= 0, 'inc567-config-loader.js loaded');
ok(html.indexOf('inc567-regime-panels.js') >= 0, 'inc567-regime-panels.js loaded');
ok(html.indexOf('smartWhale') >= 0, 'SMART$ whale ticker mount');
ok(fs.existsSync(path.join(root, 'data/strategy-weights.json')), 'strategy-weights.json exists');
ok(fs.existsSync(path.join(root, 'data/strategy-regime-state.json')), 'strategy-regime-state.json exists');
ok(fs.existsSync(path.join(root, 'data/fund-config.json')), 'fund-config.json exists');
ok(fs.existsSync(path.join(root, 'tests/labeled/BTCUSD_4h.csv')), 'labeled dataset sample exists');
ok(fs.existsSync(path.join(root, 'structure/fvg.js')), 'structure/fvg.js exists');
ok(fs.existsSync(path.join(root, 'primitives/cusum.js')), 'primitives/cusum.js exists');

const regime = fs.readFileSync(path.join(root, 'regime.js'), 'utf8');
ok(regime.indexOf('R10') >= 0 && regime.indexOf('EXCHANGE NETFLOW') >= 0, 'REGIME R10 netflow gauge');
ok(regime.indexOf('hgInc567RegimePanelsHtml') >= 0, 'REGIME cycle context panel hook');

const api = fs.readFileSync(path.join(root, 'api/onchain-alt.js'), 'utf8');
ok(api.indexOf('fetchWhaleAlertTxs') >= 0, 'whale-alert API integration');

const tab = fs.readFileSync(path.join(root, 'tabalerts.js'), 'utf8');
ok(tab.indexOf('hgTabAlertsOnchainAlt') >= 0, 'tether print alert hook');

console.log('\ninc567-roadmap: ' + n + ' passed');
