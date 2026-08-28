#!/usr/bin/env node
/* HARDGATE — align index.html script ?v= pins with build-stamp.js.
   Run after bumping build-stamp.js + sw.js HG_CACHE:
     node scripts/sync-cache-bust.mjs
   tests/test-build-stamp.mjs fails CI if pins still drift. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
const verM = stamp.match(/version\s*:\s*['"]([A-Za-z0-9._-]+)['"]/);
if (!verM) {
  console.error('sync-cache-bust: could not parse build-stamp.js version');
  process.exit(1);
}
const pin = verM[1].replace(/^hg-v/, '');
const indexPath = root + 'index.html';
const html = fs.readFileSync(indexPath, 'utf8');
const bustPins = [...new Set([...html.matchAll(/<script[^>]+src="[^"]*\?v=(\d+)"/g)].map(m => m[1]))];
if (bustPins.length >= 1 && bustPins.every(p => p === pin)) {
  console.log('index.html already aligned at ?v=' + pin);
  process.exit(0);
}
const updated = html.replace(/(<script[^>]+src="[^"]*\?)v=\d+/g, '$1v=' + pin);
fs.writeFileSync(indexPath, updated);
console.log('sync-cache-bust: updated index.html script pins to ?v=' + pin + ' (was: ' + bustPins.join(', ') + ')');
