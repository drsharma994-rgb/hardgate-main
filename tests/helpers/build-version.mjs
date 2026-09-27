/* Single place the test suite learns the current build version.
   Before this, 30 test files hardcoded the cache string, so every release
   needed 30 edits and forgetting one broke the suite. Now they ask here. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readVersion(){
  const src = fs.readFileSync(path.join(ROOT, 'build-stamp.js'), 'utf8');
  const m = src.match(/version\s*:\s*['"]([A-Za-z0-9._-]{1,64})['"]/);
  if (!m) throw new Error('build-stamp.js has no readable version');
  return m[1];
}

export const HG_VER = readVersion();

/** True when sw.js is stamped with the same version as build-stamp.js. */
export function swCacheOk(swText){
  if (typeof swText !== 'string' || !swText) return false;
  return new RegExp('HG_CACHE\\s*=\\s*[\'"]' + HG_VER + '[\'"]').test(swText);
}

/* hg-v1000: numeric version compare — a STRING compare lies across the
   4-digit boundary: 'hg-v1000' >= 'hg-v661' is FALSE as a string ('1' < '6'),
   which failed 39 version guards the day the build crossed v1000 even though
   their regexes already allowed \d{4,}. Compare the numbers. */
export function hgVerGte(a, b){
  const n = s => { const m = String(s).match(/(\d+)\s*$/); return m ? +m[1] : 0; };
  return n(a) >= n(b);
}
