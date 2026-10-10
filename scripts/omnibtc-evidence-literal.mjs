#!/usr/bin/env node
/* HARDGATE — write HG_OBTC_WALK into omnibtc.js from the walker artifact. hg-v1294.
   Run:  node scripts/omnibtc-evidence-literal.mjs [--write] [--artifact=path]

   The hg-v921 rule: a generated thing writes itself. The literal lives
   between markers in omnibtc.js, and this script is the only writer. Without
   `--write` it reports drift and exits 1 on mismatch; with it, it rewrites
   the block.

   With no artifact present (this environment: 403 CONNECT on every route),
   the literal reads `measured: false` and carries a note derived from the
   missing artifact (the hg-v990 shape). The desk panel renders "REPLAY · NOT
   YET MEASURED" and the forward ledger stays the only evidence this desk has.

   Nothing baked here is a gate. The literal is read by `hgObtcReplayPanelHtml`
   and by nothing else. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTIFACT } from './backtest-omnibtc.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OMNIBTC = path.join(ROOT, 'omnibtc.js');
const BEGIN = '/* --- BEGIN GENERATED HG_OBTC_WALK (scripts/omnibtc-evidence-literal.mjs) ---';
const END = '/* --- END GENERATED HG_OBTC_WALK --- */';

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => { const a = argv.find(x => x.startsWith(name + '=')); return a ? a.slice(name.length + 1) : dflt; };

function readArtifact(artPath){
  if (!fs.existsSync(artPath)) return null;
  try { return JSON.parse(fs.readFileSync(artPath, 'utf8')); }
  catch (e){ return null; }
}

/* On a missing or unreadable artifact, write a note derived FROM the missing
   file (hg-v990's shape): say which path is missing and what that means. On
   a walk that fetched zero bars, say so differently; on a walk that fired
   nothing, say that differently again. */
function noteFor(artPath, data){
  if (!data){
    return 'scripts/' + path.basename(artPath) + ' does not exist: the OMNIBTC replay (scripts/backtest-omnibtc.mjs) has not run on a machine that can fetch bars. The hg-v1291/v1292 gates and the hg-v1293 record-only Pine marks remain unmeasured against their complement until it does; the forward ledger is the only evidence this desk has.';
  }
  if (data.ok === false){
    return 'the OMNIBTC walk did not complete: ' + (data.reason || 'unknown reason') + '. No rows were written; the forward ledger is the only evidence this desk has.';
  }
  const n = data.summary && data.summary.n;
  if (!n){
    return 'the OMNIBTC walk fetched bars but recorded no rows; the gate chain stood every candidate aside. Investigate the walker before trusting this.';
  }
  const nT = data.summary.nTicket, nH = data.summary.nHeld;
  const ticketNet = data.summary.ticket && data.summary.ticket.netR;
  const heldNet = data.summary.held && data.summary.held.netR;
  const fmtR = v => (v === null || !isFinite(+v)) ? 'n/a' : (((+v) >= 0 ? '+' : '') + (+v).toFixed(3) + 'R');
  const parts = [];
  parts.push(n + ' rows settled across the walk');
  if (nT) parts.push(nT + ' tickets at net ' + fmtR(ticketNet) + ' per ticket');
  if (nH) parts.push(nH + ' held (watch) at net ' + fmtR(heldNet) + ' per held');
  return parts.join(' · ') + '. The hg-v1291/v1292 gate decides ticket vs watch; the walk measures whether the ticket population earns its claim.';
}

function literalFromData(artPath, data){
  const stamp = {
    artifact: path.basename(artPath),
    n: data && data.summary ? data.summary.n : 0,
    measured: !!(data && data.ok === true && data.summary && data.summary.n > 0),
    span: data && data.meta ? data.meta.span : null,
    horizonBars: data && data.meta ? data.meta.horizonBars : 20,
    costFrac: data && data.meta ? data.meta.costFrac : 0.0008,
    tab: 'OMNIBTC',
    forwardOnly: ['postgate:accuracy','flow','netflow','basis','liq','fundAgainst','venueAgreeCount','macroBlocked'],
    rules: [
      'hg-v1291 PINE CONFIRM: ≥2 independent fresh Pine cores on the pick\'s direction, none against',
      'hg-v1292 PINE + CORE / PINE + INDICATOR tiebreak: 1 family + 2nd house strategy or EMA/MACD/Donchian fresh cross',
      'hg-v1293 ten pine* three-state marks on every record for the hg-v1065 PERFECT COHORT SPLIT and hg-v989 read-split'
    ],
    note: noteFor(artPath, data),
    summary: data && data.summary ? data.summary : null,
    limitations: data && data.meta && Array.isArray(data.meta.limitations) ? data.meta.limitations : [
      'walk has not run — no limitations to list beyond the single one: no evidence'
    ],
    rows: data && data.ok && Array.isArray(data.rows) ? data.rows.slice(0, 1000) : []
  };
  return stamp;
}

export function renderBlock(data, artPath){
  artPath = artPath || ARTIFACT;
  const lit = literalFromData(artPath, data);
  const body = JSON.stringify(lit, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? '  var HG_OBTC_WALK = ' + line : '  ' + line))
    .join('\n') + ';';
  const header = [
    BEGIN,
    '     Re-derive with `node scripts/omnibtc-evidence-literal.mjs --write` after `node scripts/backtest-omnibtc.mjs`.',
    '     Do not hand-edit — generated literals write themselves (hg-v921). Every figure is',
    '     read off ' + path.basename(artPath) + '; the guard re-runs the generator and fails on drift. */',
    body,
    END
  ];
  return header.join('\n');
}

function spliceInto(src, block){
  const start = src.indexOf(BEGIN);
  const end = src.indexOf(END);
  if (start < 0 || end < 0 || end < start){
    throw new Error('OMNIBTC generated block markers not found in omnibtc.js — add them around the HG_OBTC_WALK literal first.');
  }
  const before = src.slice(0, start);
  const after = src.slice(end + END.length);
  return before + block + after;
}

async function main(){
  const artPath = opt('--artifact', ARTIFACT);
  const data = readArtifact(artPath);
  const block = renderBlock(data, artPath);
  const src = fs.readFileSync(OMNIBTC, 'utf8');
  const next = spliceInto(src, block);
  if (next === src){
    process.stdout.write('no drift: HG_OBTC_WALK already matches ' + path.basename(artPath) + '\n');
    return;
  }
  if (!has('--write')){
    process.stdout.write('DRIFT: HG_OBTC_WALK does not match the artifact. Re-run with --write to update.\n');
    process.exit(1);
  }
  fs.writeFileSync(OMNIBTC, next);
  process.stdout.write('wrote HG_OBTC_WALK into omnibtc.js (' + (data ? ((data.summary && data.summary.n) || 0) + ' rows' : 'no artifact — measured:false') + ')\n');
}

const invoked = (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (invoked) main().catch(e => { process.stderr.write('literal writer failed: ' + (e.stack || e.message || e) + '\n'); process.exit(1); });
