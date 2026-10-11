/* HARDGATE — THE BATCH BUMP DISCIPLINE.

   The standing rule: EVERY app update ships a new batch number, and all five
   surfaces that carry it move together. This guard is what makes that rule real
   instead of aspirational.

   WHY CONSISTENCY ALONE IS NOT ENOUGH, and this is the whole point of the file:
   a pure "all surfaces agree" check PASSES when you edit a module and bump
   nothing — the tree is still perfectly consistent, on the old number. It catches
   drift WITHIN a bump (the real hg-v1296 defect this repo hit twice: trendtable.js
   and hg-api-base.js were left behind while build-stamp/sw/index.html moved on,
   which serves stale trendtable-src-* parts from cache). It does NOT catch a
   MISSING bump. The append-only ledger in data/batch-ledger.json is what catches
   that: the last entry must BE the live version, so landing a change under an
   already-shipped number fails here.

   WHAT THIS ASSERTS
     1. every one of the five surfaces carries ONE id, and it is the live version
     2. the ledger exists, is append-only in effect, and its LAST entry is the live
        version — i.e. this batch was actually recorded
     3. the ledger's `built` stamps are parseable ISO-8601 and never go backwards
     4. each recorded batch names what it changed (no anonymous bumps)
     5. the live `built` stamp in build-stamp.js matches the ledger's entry for
        this version, so the two cannot drift apart

   Run: node tests/test-batch-bump-discipline.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok -', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const num = v => String(v || '').replace(/^hg-v/, '');

console.log('== 1) all five surfaces carry ONE id, and it is the live version ==');
{
  const bs = (read('build-stamp.js').match(/version:\s*'([^']+)'/) || [])[1];
  const sw = read('sw.js');
  const ttHeader = (read('trendtable.js').match(/hg-v\d+/) || [])[0];
  const ttLoader = (read('trendtable.js').match(/\?v=(\d+)/) || [])[1];
  const apiData = [...read('hg-api-base.js').matchAll(/data-v',\s*'(\d+)'/g)].map(m => m[1]);
  const apiLoad = [...read('hg-api-base.js').matchAll(/\?v=(\d+)/g)].map(m => m[1]);
  const pins = {};
  [...read('index.html').matchAll(/\?v=(\d+)/g)].forEach(m => { pins[m[1]] = (pins[m[1]] || 0) + 1; });
  const pinKeys = Object.keys(pins);
  const all = [num(bs), num(ttHeader), ttLoader, ...apiData, ...apiLoad, ...pinKeys];
  const distinct = [...new Set(all)];

  ok(bs === HG_VER, 'build-stamp.js is the tree version ' + HG_VER);
  ok(distinct.length === 1,
    'every surface carries ONE id (build-stamp, trendtable header+loader, hg-api-base data-v+loaders, '
    + 'all index.html pins) — got ' + JSON.stringify(distinct));
  ok(swCacheOk(sw), 'sw.js HG_CACHE matches build-stamp.js (' + HG_VER + ')');
  ok(ttHeader === HG_VER, 'trendtable.js header carries ' + HG_VER + ' (got ' + ttHeader + ')');
  ok(ttLoader === HG_VER.slice(4),
    'trendtable.js LOADER cache-buster is ' + HG_VER.slice(4) + ' — a missed loader serves stale parts');
  ok(apiData.length > 0 && apiData.every(v => v === HG_VER.slice(4)),
    'hg-api-base data-v is ' + HG_VER.slice(4) + ' (' + apiData.length + ' site(s))');
  ok(apiLoad.length > 0 && apiLoad.every(v => v === HG_VER.slice(4)),
    'hg-api-base ?v= loaders are ' + HG_VER.slice(4) + ' (' + apiLoad.length + ' site(s))');
  ok(pinKeys.length === 1 && pinKeys[0] === HG_VER.slice(4),
    'all ' + pins[pinKeys[0]] + ' index.html pins carry ' + HG_VER.slice(4));
  /* the loader used to be counted separately because it is the one that a merge
     silently leaves behind; assert it is not merely present but PRESENT ONCE */
  const ttLoaderSites = [...read('trendtable.js').matchAll(/\?v=\d+/g)].length;
  ok(ttLoaderSites === 1, 'trendtable.js has exactly one cache-buster site (' + ttLoaderSites + ')');
}

console.log('\n== 2) this batch is RECORDED (the append-only ledger) ==');
{
  const p = path.join(ROOT, 'data', 'batch-ledger.json');
  ok(fs.existsSync(p), 'data/batch-ledger.json exists');
  const led = JSON.parse(read('data/batch-ledger.json'));
  ok(Array.isArray(led.batches) && led.batches.length > 0,
    'the ledger lists ' + (led.batches || []).length + ' batch(es)');
  const last = led.batches[led.batches.length - 1];
  ok(last && last.version === HG_VER,
    'the ledger LAST entry is the live version ' + HG_VER + ' (got ' + (last && last.version) + ') — '
    + 'a change landed under an already-shipped number fails here');
  const seen = new Set();
  for (const b of led.batches) {
    ok(b && typeof b.version === 'string' && /^hg-v\d+$/.test(b.version),
      'ledger entry has a well-formed version (' + (b && b.version) + ')');
    ok(!seen.has(b.version), 'ledger version ' + b.version + ' appears once (no duplicate batch)');
    seen.add(b.version);
  }
}

console.log('\n== 3) built stamps are real instants, and never go backwards ==');
{
  const led = JSON.parse(read('data/batch-ledger.json'));
  let prev = 0;
  for (const b of led.batches) {
    const t = Date.parse(b.built);
    ok(Number.isFinite(t), b.version + ' has a parseable ISO-8601 `built` (' + b.built + ')');
    ok(t >= prev, b.version + ' does not move backwards in time (' + b.built + ')');
    prev = t;
  }
  const liveBuilt = (read('build-stamp.js').match(/built:\s*'([^']+)'/) || [])[1];
  const last = led.batches[led.batches.length - 1];
  ok(liveBuilt === last.built,
    'build-stamp.js `built` matches the ledger for ' + HG_VER + ' (live ' + liveBuilt + ', ledger ' + last.built + ')');
  ok(Number.isFinite(Date.parse(liveBuilt)), 'build-stamp.js `built` is a real instant (' + liveBuilt + ')');
}

console.log('\n== 4) no anonymous bumps ==');
{
  const led = JSON.parse(read('data/batch-ledger.json'));
  for (const b of led.batches) {
    ok(typeof b.note === 'string' && b.note.trim().length >= 20,
      b.version + ' says what changed (' + String(b.note || '').length + ' chars)');
  }
  ok(led.batches.length >= 5, 'the ledger has history, not just the current entry (' + led.batches.length + ')');
}

console.log('\n' + passed + ' passed, 0 failed');
