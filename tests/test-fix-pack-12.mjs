/* HARDGATE — fix pack 12 regression guards. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== proxy hardening ==');
{
  const proxy = fs.readFileSync(path.join(root, 'api/proxy.js'), 'utf8');
  ok(proxy.indexOf('RATE_MAX_DEFAULT = 300') >= 0, 'proxy rate 300/min default');
  ok(proxy.indexOf('RATE_MAX_COINDCX = 800') >= 0, 'proxy coindcx rate 800/min');
  ok(proxy.indexOf('ALLOWED_ORIGINS') >= 0, 'proxy origin allowlist');
  ok(proxy.indexOf("'Access-Control-Allow-Origin': '*'") < 0, 'no ACAO *');
}

console.log('== package + render ==');
{
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  ok(pkg.dependencies && pkg.dependencies.ccxt, 'ccxt in dependencies');
  ok(pkg.scripts.test.indexOf('run-tests.mjs') >= 0, 'npm test uses run-tests.mjs');
  const render = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  ok(render.indexOf('npm ci') >= 0, 'render.yaml uses npm ci');
}

console.log('== CSP ==');
{
  const server = fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8');
  ok(server.indexOf('Content-Security-Policy') >= 0, 'server CSP header');
  ok(server.indexOf('wss://public-socket.india.delta.exchange') >= 0, 'CSP allows Delta India public WS');
  ok(server.indexOf('https://api.india.delta.exchange') >= 0, 'CSP allows Delta India REST');
  const vercel = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
  ok(vercel.indexOf('"public": true') < 0, 'vercel.json not public listing');
  ok(vercel.indexOf('Content-Security-Policy') >= 0, 'vercel CSP');
  ok(vercel.indexOf('wss://public-socket.india.delta.exchange') >= 0, 'vercel CSP allows Delta India public WS');
}

console.log('== cache ==');
{
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v239/.test(sw), 'cache hg-v239');
  ok(sw.indexOf('api-client.js') >= 0, 'sw shell includes api-client.js');
}

console.log('\n' + pass + ' passed');
