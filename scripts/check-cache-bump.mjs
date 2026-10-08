#!/usr/bin/env node
/* HARDGATE — cache-bump triad check (task #2 automation).
 *
   A deploy must bump THREE places to the same number or clients ship with
   stale cache keys:
     1. sw.js          — const HG_CACHE = 'hg-vNNN'   (service-worker cache id)
     2. build-stamp.js — version: 'hg-vNNN'           (the version the app prints)
     3. index.html     — every <script src="...?v=NNN">(225 of them at v1167)

   Historically these were bumped by hand and could drift silently. This
   script fails with a precise report when they disagree, so CI catches the
   half-bumped deploy instead of production.
   Run: node scripts/check-cache-bump.mjs   (also `npm run check:cache`) */
import fs from 'node:fs';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const sw = read('sw.js');
const stamp = read('build-stamp.js');
const html = read('index.html');

const cacheId = (sw.match(/HG_CACHE\s*=\s*'([^']+)'/) || [])[1];
const stampVer = (stamp.match(/version:\s*'([^']+)'/) || [])[1];

const vNums = new Set();
let htmlTagCount = 0;
for (const m of html.matchAll(/\?v=([0-9]+)/g)){ vNums.add(m[1]); htmlTagCount++; }

/* Runtime-loaded assets hardcode the SAME cachebuster (trendtable.js fetches
   'trendtable-src-' + i + '.js?v=NNN' at line ~10) — a half-bumped deploy
   there serves a stale matrix. Dynamically-built URLs (omnigold.js's
   import('...?v=' + ver)) self-sync and cannot be checked statically. */
const rootDir = new URL('../', import.meta.url);
const runtimeHits = {};
for (const f of fs.readdirSync(rootDir).filter(f => f.endsWith('.js'))){
  const src = fs.readFileSync(new URL('./' + f, rootDir), 'utf8');
  for (const m of src.matchAll(/\?v=([0-9]+)/g)){
    vNums.add(m[1]);
    (runtimeHits[f] = runtimeHits[f] || []).push(m[1]);
  }
}

const problems = [];

if (!/^hg-v([0-9]+)$/.test(cacheId || '')){
  problems.push(`sw.js HG_CACHE must look like 'hg-v<digits>' — found '${cacheId}'`);
}
if (!/^hg-v([0-9]+)$/.test(stampVer || '')){
  problems.push(`build-stamp.js version must look like 'hg-v<digits>' — found '${stampVer}'`);
}
if (cacheId && stampVer && cacheId !== stampVer){
  problems.push(`sw.js HG_CACHE ('${cacheId}') != build-stamp.js version ('${stampVer}') — bump both together`);
}
if (vNums.size === 0){
  problems.push('index.html carries no ?v= cachebusters — every <script src> needs one');
}
if (vNums.size > 1){
  problems.push(`the repo mixes cachebuster versions (${[...vNums].sort().join(', ')}) across index.html and runtime-injected asset literals — a half-bumped deploy`);
}
if (cacheId && vNums.size === 1){
  const n = [...vNums][0];
  if (cacheId !== 'hg-v' + n){
    problems.push(`cachebusters all say ?v=${n} but sw.js HG_CACHE is '${cacheId}' — bump them together`);
  }
}
for (const f of Object.keys(runtimeHits)){
  for (const v of runtimeHits[f]){
    if (vNums.size > 1 || (cacheId && cacheId !== 'hg-v' + v)){
      problems.push(`${f} hardcodes ?v=${v} which does not match the deploy number`);
    }
  }
}

if (problems.length){
  console.error('CACHE-BUMP CHECK FAILED — the deploy triad is out of sync:');
  for (const p of problems) console.error('  - ' + p);
  console.error('\nFix: pick one deploy number NNN, then set ALL of:');
  console.error("  sw.js            HG_CACHE = 'hg-vNNN'");
  console.error("  build-stamp.js  version:  'hg-vNNN'   (+ fresh built: ISO stamp)");
  console.error('  index.html      every <script src="...?v=NNN">');
  console.error('  trendtable.js   the runtime fragment fetch (\'?v=NNN\') and any other root');
  console.error('                  script that hardcodes a ?v= cachebuster');
  process.exit(1);
}

const rt = Object.keys(runtimeHits).map(f => f + ' (x' + runtimeHits[f].length + ')').join(', ') || 'none';
console.log(`cache-bump sync OK: sw.js HG_CACHE='${cacheId}', build-stamp.js version='${stampVer}', index.html ?v=${[...vNums][0]} x${htmlTagCount} tags, runtime-asset literals: ${rt}`);
