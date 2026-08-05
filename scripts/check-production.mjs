#!/usr/bin/env node
/* HARDGATE — compare local sw.js cache id vs deployed site (Render/GitHub Pages).
   Usage:
     node scripts/check-production.mjs
     HARDGATE_SITE=https://hardgate-main.onrender.com node scripts/check-production.mjs
   Exit 0 when fetch succeeds (reports match/mismatch); exit 1 on fetch failure. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const site = (process.env.HARDGATE_SITE || 'https://hardgate-main.onrender.com').replace(/\/$/, '');
const localSw = fs.readFileSync(root + 'sw.js', 'utf8');
const localMatch = localSw.match(/const HG_CACHE = '([^']+)'/);
const localCache = localMatch ? localMatch[1] : '(unknown)';

let remoteCache = null;
let err = null;
try{
  const res = await fetch(site + '/sw.js', { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const body = await res.text();
  const rm = body.match(/const HG_CACHE = '([^']+)'/);
  remoteCache = rm ? rm[1] : '(parse failed)';
}catch(e){
  err = e && e.message ? e.message : String(e);
}

console.log('HARDGATE deploy check');
console.log('  site:   ' + site);
console.log('  local:  ' + localCache);
if (err){
  console.log('  remote: fetch failed — ' + err);
  process.exit(1);
}
console.log('  remote: ' + remoteCache);
if (localCache === remoteCache){
  console.log('  status: LIVE — cache ids match');
}else{
  console.log('  status: STALE — merge + redeploy needed (local ahead of production)');
}
