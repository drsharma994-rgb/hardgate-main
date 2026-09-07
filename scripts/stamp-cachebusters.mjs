#!/usr/bin/env node
/* Stamp every <script src="X.js"> in index.html with ?v=<HG_VER> so a version
   bump actually invalidates every cached asset behind Cloudflare / S3 (not
   just build-stamp.js). Introduced in v649 after 4 verification passes
   silently ran against a stale cryptogates.js served with 4h TTL.

   Usage:  node scripts/stamp-cachebusters.mjs
   Reads the version from build-stamp.js; rewrites index.html in place.
   Idempotent: existing ?v=NNN suffixes are replaced, not duplicated. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stamp = readFileSync(resolve(ROOT, 'build-stamp.js'), 'utf8');
const m = stamp.match(/version:\s*'hg-v(\d+)'/);
if (!m){ console.error('cannot read version from build-stamp.js'); process.exit(1); }
const ver = m[1];

const htmlPath = resolve(ROOT, 'index.html');
const src = readFileSync(htmlPath, 'utf8');
let n = 0;
const out = src.replace(/src="([^"]+\.js(?:\?v=\d+)?)"/g, (whole, hit) => {
  if (hit.startsWith('http://') || hit.startsWith('https://') || hit.startsWith('//')) return whole;
  n++;
  const base = hit.replace(/\?v=\d+$/, '');
  return `src="${base}?v=${ver}"`;
});
writeFileSync(htmlPath, out);
console.log(`stamped ${n} <script> tags with ?v=${ver}`);
