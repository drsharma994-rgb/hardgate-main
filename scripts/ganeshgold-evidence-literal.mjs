#!/usr/bin/env node
/* HARDGATE — HG_GANESH_WALK evidence literal writer. hg-v1298.
   Run: node scripts/ganeshgold-evidence-literal.mjs            (drift check)
        node scripts/ganeshgold-evidence-literal.mjs --write    (rewrite)

   hg-v921 rule: a generated thing writes itself. The literal lives at a
   named marker pair in ganeshgold.js so a reader cannot wonder which
   number is live. A missing marker is FATAL, never silently skipped — the
   hg-v959 trap one file along. Zero-drift round-trip is the suite's
   contract (test-gold-profitability-audit.mjs).

   Reads scripts/backtest-ganeshgold-results.json (the hg-v1298 walker's
   output). If the artifact is absent or measured:false, the literal is
   written null-pointing and the audit panel on GANESH GOLD reads NO
   MEASURED RECORD, which is what it IS. The hg-v990 shape: a note
   derived from the missing file, not a sentence quoted from memory. */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GANESH_PATH = resolve(__dirname, '..', 'ganeshgold.js');
const ARTIFACT_PATH = resolve(__dirname, 'backtest-ganeshgold-results.json');
const WRITE = process.argv.includes('--write');

const BEGIN_MARK = '/* --- BEGIN GENERATED HG_GANESH_WALK (hg-v1298) --- */';
const END_MARK = '/* --- END GENERATED HG_GANESH_WALK --- */';

function buildLiteral(){
  if (!existsSync(ARTIFACT_PATH)){
    return [
      BEGIN_MARK,
      'W.HG_GANESH_WALK = {',
      '  measured: false,',
      '  n: 0,',
      '  span: null,',
      '  note: "scripts/backtest-ganeshgold-results.json does not exist: the GANESH GOLD walk has not run on a machine that can fetch bars. The walker is wired at scripts/backtest-ganeshgold.mjs (hg-v1298). Until this bakes, nothing on this desk can be filtered by profitability — hg-v966 forbids a gate on measurement that has not happened."',
      '};',
      END_MARK
    ].join('\n');
  }
  let art;
  try{
    art = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
  }catch(e){
    return [
      BEGIN_MARK,
      'W.HG_GANESH_WALK = {',
      '  measured: false,',
      '  n: 0,',
      '  span: null,',
      '  note: "scripts/backtest-ganeshgold-results.json is unreadable (" + ' + JSON.stringify(String(e.message || e)) + ' + "). The walker is wired at scripts/backtest-ganeshgold.mjs (hg-v1298)."',
      '};',
      END_MARK
    ].join('\n');
  }
  if (!art || !art.measured){
    const note = (art && art.meta && art.meta.note) || 'the walk did not complete';
    return [
      BEGIN_MARK,
      'W.HG_GANESH_WALK = {',
      '  measured: false,',
      '  n: 0,',
      '  span: ' + JSON.stringify((art && art.meta && art.meta.span) || null) + ',',
      '  note: ' + JSON.stringify(note),
      '};',
      END_MARK
    ].join('\n');
  }
  /* Measured artifact: trades + perMechanic. The literal carries headline
     counts; the real artifact stays on disk for a later reader. */
  return [
    BEGIN_MARK,
    'W.HG_GANESH_WALK = {',
    '  measured: true,',
    '  n: ' + ((art.trades && art.trades.length) || 0) + ',',
    '  span: ' + JSON.stringify((art.meta && art.meta.span) || null) + ',',
    '  note: ' + JSON.stringify((art.meta && art.meta.note) || 'measured'),
    '};',
    END_MARK
  ].join('\n');
}

function main(){
  const src = readFileSync(GANESH_PATH, 'utf8');
  const beginIdx = src.indexOf(BEGIN_MARK);
  const endIdx = src.indexOf(END_MARK);
  if (beginIdx < 0 || endIdx < 0 || endIdx < beginIdx){
    console.error('FATAL: hg-v921 markers not found in ganeshgold.js');
    console.error('  looking for: ' + BEGIN_MARK + ' ... ' + END_MARK);
    process.exit(1);
  }
  const before = src.slice(0, beginIdx);
  const after = src.slice(endIdx + END_MARK.length);
  const fresh = buildLiteral();
  const current = src.slice(beginIdx, endIdx + END_MARK.length);
  if (current === fresh){
    console.log('HG_GANESH_WALK is up to date.');
    return;
  }
  if (!WRITE){
    console.error('DRIFT: HG_GANESH_WALK differs from the artifact. Run with --write to update.');
    console.error('---expected---');
    console.error(fresh);
    console.error('---actual---');
    console.error(current);
    process.exit(1);
  }
  writeFileSync(GANESH_PATH, before + fresh + after);
  console.log('HG_GANESH_WALK written.');
}

main();
