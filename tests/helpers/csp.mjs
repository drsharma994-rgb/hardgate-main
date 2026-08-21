/* Single place the test suite learns the connect-src allowlist.

   The allowlist used to be one long inline string in scripts/server.mjs and a
   second hand-maintained copy in vercel.json, and tests grepped the raw source
   for a host on that one line. server.mjs now builds the directive from a
   CONNECT_SRC array — one host per line with a note naming the module that
   needs it — so a raw grep no longer sees the hosts. Tests ask here instead,
   and get the effective set either file actually ships.

   Companion to build-version.mjs: same reason, same shape. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Hosts scripts/server.mjs permits, read from the CONNECT_SRC array literal. */
export function serverConnectSrc(){
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'server.mjs'), 'utf8');
  const m = src.match(/const CONNECT_SRC = \[([\s\S]*?)\]\.join\(' '\);/);
  if (!m) throw new Error('scripts/server.mjs has no readable CONNECT_SRC array');
  /* Strip the per-host block comments first, so a URL mentioned in a note can
     never be read as a permitted host. 'self' is written with double quotes
     around single ones, so match the double-quoted form first and keep its
     quotes — exactly as the finished header spells it. */
  const clean = m[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Set();
  const re = /"([^"]*)"|'([^']*)'/g;
  let hit;
  while ((hit = re.exec(clean)) !== null) out.add(hit[1] !== undefined ? hit[1] : hit[2]);
  return out;
}

/** Hosts vercel.json permits, read from the finished CSP header string. */
export function vercelConnectSrc(){
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  let csp = '';
  for (const rule of (cfg.headers || [])){
    for (const h of (rule.headers || [])){
      if (String(h.key).toLowerCase() === 'content-security-policy') csp = String(h.value);
    }
  }
  const directive = (csp.split(';').map(d => d.trim())
    .find(d => d.indexOf('connect-src') === 0) || '').replace(/^connect-src\s*/, '');
  return new Set(directive.split(/\s+/).filter(Boolean));
}

/** Both files, keyed by the name the tests print. */
export function connectSrcByFile(){
  return [['scripts/server.mjs', serverConnectSrc()], ['vercel.json', vercelConnectSrc()]];
}
