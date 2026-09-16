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
const external = hit => hit.startsWith('http://') || hit.startsWith('https://') || hit.startsWith('//');
let n = 0, css = 0;
let out = src.replace(/src="([^"]+\.js(?:\?v=\d+)?)"/g, (whole, hit) => {
  if (external(hit)) return whole;
  n++;
  const base = hit.replace(/\?v=\d+$/, '');
  return `src="${base}?v=${ver}"`;
});
/* STYLESHEETS TOO. This stamped only <script src> and left every
   <link href="...css"> to be edited by hand at each bump, so the two
   local stylesheets carried a stale ?v= into v750 — caught by the
   cache-buster check in test-smc-setups.mjs, which reads EVERY ?v= in the
   file and not just the ones this script maintained. A CSS file served
   from a 4h edge cache after a deploy is the same failure that motivated
   this script in v649; there is no reason the rule stopped at .js. */
out = out.replace(/href="([^"]+\.css(?:\?v=\d+)?)"/g, (whole, hit) => {
  if (external(hit)) return whole;
  css++;
  const base = hit.replace(/\?v=\d+$/, '');
  return `href="${base}?v=${ver}"`;
});
writeFileSync(htmlPath, out);
console.log(`stamped ${n} <script> tags and ${css} <link> stylesheets with ?v=${ver}`);
