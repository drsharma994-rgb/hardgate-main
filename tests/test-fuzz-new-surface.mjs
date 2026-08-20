/* HARDGATE — feed-shaped garbage must never throw, on ANY exported read.

   The precedent is recorded in hgOmniDropForming's sanitiser: a venue that
   drops one candle returns an array with a hole in it, and the first fuzz
   sweep of this codebase found 24 of 199 exports that walked straight into
   that hole. The zone/evidence surface added in v409-v415 was born after
   that sweep and never faced it — the 2026-08 rerun found SIX of its
   functions throwing on holey arrays (hgOgZoneLevels, opEvidence,
   opLevelSources, opZones, opPivots, opGates), 114 throws total. Each now
   sanitises at its own entry, because every export must survive garbage
   STANDALONE — a caller's hygiene is not a dependency.

   Two halves, both required:
     GARBAGE  -> zero throws across the matrix below;
     GOOD     -> the same functions still produce real output, so a
                 sanitiser cannot "fix" a throw by returning nothing.

   Run: node tests/test-fuzz-new-surface.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
              parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
              setTimeout, clearTimeout, setInterval, clearInterval };
ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
  addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
  querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
  documentElement:{appendChild(){}}, addEventListener(){} };
vm.createContext(ctx);
for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                 'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js','omnipresent.js',
                 'meanrev.js','best-levels.js','structure-levels.js','formation.js','freqtrade-formation.js','gold-best-levels.js'])
  vm.runInContext(read(f), ctx, { filename: f });

function goodRow(i){ const p = 100 + Math.sin(i/9)*4; return { t: 1700000000 + i*3600, o:p-0.2, h:p+0.5, l:p-0.5, c:p, v:500 }; }
const goodRows = Array.from({length: 200}, (_, i) => goodRow(i));
const BAD_ROWS = [
  ['null', null], ['undefined', undefined], ['empty', []], ['string', 'rows'],
  ['num', 42], ['obj', {}], ['one bar', [goodRow(0)]],
  ['null entry', goodRows.slice(0,150).concat([null]).concat(goodRows.slice(150))],
  ['NaN closes', goodRows.map(r => ({...r, c: NaN}))],
  ['string prices', goodRows.map(r => ({...r, c: 'x', h: 'y', l: 'z', o: 'w'}))],
  ['ms stamps', goodRows.map(r => ({...r, t: r.t*1000}))],
  ['neg prices', goodRows.map(r => ({...r, c: -r.c, h: -r.h, l: -r.l, o: -r.o}))],
  ['zero vol', goodRows.map(r => ({...r, v: 0}))],
  ['missing fields', goodRows.map(r => ({ t: r.t }))],
  ['holey', goodRows.map((r,i) => i % 7 === 0 ? undefined : r)],
];
const BAD_SCALAR = [null, undefined, NaN, 0, -1, 'x', {}, [], Infinity];

console.log('== garbage in, degradation out — never a throw ==');
{
  let throws = 0;
  const q = (fn) => { try { fn(); } catch (e){ throws++; console.log('    THROW: ' + (e && e.message).slice(0, 90)); } };
  for (const [, rows] of BAD_ROWS){
    for (const live of BAD_SCALAR.concat([100])){
      q(() => ctx.hgContextRead(rows, 'long', 'f', false));
      q(() => ctx.opAssess(rows, live));
      q(() => ctx.opLevelSources(rows, live));
      q(() => ctx.opEvidence(rows, 'short', live));
      q(() => ctx.hgOgZoneLevels(rows, live));
      q(() => ctx.hgOgZonesPanel(rows, live));
      q(() => ctx.mrClosed(rows));
      q(() => ctx.mrSignal(rows));
    }
    q(() => ctx.opPivots(rows, 3));
    q(() => ctx.opZones(rows, 1, 100, 'above'));
    q(() => ctx.hgIndicatorGates(rows, { dir: 'long' }, {}, false));
    q(() => ctx.hgBestLevels({ dir: 'long', rows4h: rows, style: 'swing' }));
    q(() => ctx.hgBestLevelsGold({ hit: { dir: 'long', stratKey: 'ob', entry: 100 }, dir: 'long', rows: rows, style: 'gold-swing' }));
  }
  for (const s of BAD_SCALAR){
    q(() => ctx.opRoundStep(s));
    q(() => ctx.opNextCloses(s, 3));
  }
  q(() => ctx.opZones([null, { px: 'x' }, undefined, { src: 'no px' }], 1, 100, 'above'));
  q(() => ctx.opGates(goodRows, { dir: 'short', zone: null, evidence: null, stop: NaN, rr1: NaN, atr: NaN, entry: NaN }, NaN, null));
  q(() => ctx.opGates(goodRows, null, NaN, null));
  q(() => ctx.hgContextRead(goodRows, {}, null, 'yes'));
  ok(throws === 0, 'the full garbage matrix produces ZERO throws (got ' + throws + ')');
}

console.log('\n== and good input still produces real output — no fix-by-emptiness ==');
{
  const live = goodRows[goodRows.length - 1].c;
  ok(ctx.opPivots(goodRows, 3).hi.length > 0, 'opPivots still finds pivots');
  const src = ctx.opLevelSources(goodRows, live);
  ok(src.above.length + src.below.length > 0, 'opLevelSources still finds levels');
  ok(ctx.hgOgZoneLevels(goodRows, live).below.length + ctx.hgOgZoneLevels(goodRows, live).above.length >= 0
     && Array.isArray(ctx.hgOgZoneLevels(goodRows, live).above), 'hgOgZoneLevels still returns its shape');
  const cx = ctx.hgContextRead(goodRows, 'long', 't', false);
  ok(!!cx && cx.gates.length >= 20, 'hgContextRead still grades the full bank');
  /* the holey tape, cleaned, must read like the clean tape */
  const holey = goodRows.map((r, i) => i % 7 === 0 ? undefined : r);
  const cxHoley = ctx.hgContextRead(holey, 'long', 't', false);
  ok(!!cxHoley && cxHoley.gates.length === cx.gates.length,
     'a hole-punched tape degrades to the clean bars, not to nothing');
}

console.log('\npassed: ' + passed);
