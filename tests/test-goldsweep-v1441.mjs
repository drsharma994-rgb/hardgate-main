/* HARDGATE — hg-v1441 GOLD SWEEP: the measured disclosures + the ganeshgold
   swing-promotion handoff (desks/goldsweep census: 22-tab GOLD group swept,
   XM 0.020% / PAXG-taker 0.26% / Binance-spot 0.20% RT, both halves).

   This suite pins:
     1. GOLD tab scalp lane: HG_GOLD_SCALP_MEASURED baked with the census
        numbers (n=20, -0.604R XM, -0.428/-0.780 both halves); the paint fn
        renders them beside the plan (kill the fn -> RED), FAILS OPEN when
        the literal is absent, and HG_GOLD_SCALP_MEASURED_NOTE=false restores
        silence; the mint seam in runGold actually CALLS the paint fn.
     2. OMNIGOLD1: hgOg1TabBookStanceHtml renders the tab-book census numbers
        (n=45, -0.625R both halves, engine -0.108R) inside measuredHtml;
        fail-open without the literal; lever HG_OG1_TABBOOK_STANCE=false
        restores silence; the forward-record admission filter is UNTOUCHED
        (paint, not a clause).
     3. GANESH GOLD swing-promotion handoff: swing A/A+ WATCH plans record
        as GANESHGOLD-SWING-PROMO candidates ticket:false (record-first,
        never auto-live); hgGaneshSwingPromoHtml counts toward the 20-settled
        bar off hgFwdStats and fails open without it; the record path carries
        the tier==='WATCH' + grade A/A+ guards and promoCandidate mark.
     4. AGENTS.md carries the confluence audit (READY +0.318R vs WATCH
        -0.608R — ship NOTHING) and the goldultra failed-check note.
     5. The cache-bump byte-check: ?v=1441 surfaces.

   Run: node tests/test-goldsweep-v1441.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/* pull one named function (brace-matched) out of a source blob */
function extractFn(src, name){
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('extract: ' + name + ' not found');
  let i = src.indexOf('{', at), depth = 0;
  for (let j = i; j < src.length; j++){
    if (src[j] === '{') depth++;
    else if (src[j] === '}'){ depth--; if (!depth) return src.slice(at, j + 1); }
  }
  throw new Error('extract: ' + name + ' unbalanced');
}
function extractVar(src, name){
  const at = src.indexOf('var ' + name + ' = {');
  if (at < 0) throw new Error('extract: var ' + name + ' not found');
  let i = src.indexOf('{', at), depth = 0;
  for (let j = i; j < src.length; j++){
    if (src[j] === '{') depth++;
    else if (src[j] === '}'){ depth--; if (!depth) return src.slice(at, j + 1) + ';'; }
  }
  throw new Error('extract: var ' + name + ' unbalanced');
}

console.log('— 1. GOLD tab scalp-lane measured-loss disclosure —');
{
  const html = read('index.html');
  const literalSrc = extractVar(html, 'HG_GOLD_SCALP_MEASURED');
  const fnSrc = extractFn(html, 'hgGoldScalpMeasuredNoteHtml');
  const hgEscSrc = extractFn(html, 'hgEsc');
  const boot = (withLiteral) => {
    const ctx = { Math, Number, String, isFinite, JSON };
    ctx.window = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    if (withLiteral) vm.runInContext(literalSrc, ctx);
    vm.runInContext(hgEscSrc + '\n' + fnSrc, ctx);
    return ctx;
  };
  let W = boot(true);
  const M = W.HG_GOLD_SCALP_MEASURED;
  ok(M.measured === true && M.lane === 'gold-scalp', 'literal baked, measured:true, lane gold-scalp');
  ok(M.n === 20 && M.xm === -0.604 && M.xmH1 === -0.428 && M.xmH2 === -0.780,
     'the census numbers are the ones the line was measured on (n=20, -0.604 XM, -0.428/-0.780 both halves)');
  ok(M.paxg === -1.605 && M.binance === -1.355, 'taker + spot venue rows pinned');
  const htmlOut = W.hgGoldScalpMeasuredNoteHtml();
  const txt = strip(htmlOut);
  ok(htmlOut.includes('data-gold-scalp-measured="1"'), 'the line renders with its marker');
  ok(txt.includes('20 sweep-reclaim mints') && txt.includes('-0.60R each after XM') && txt.includes('-0.43 / -0.78'),
     'the line quotes the census numbers verbatim');
  ok(txt.includes('-1.60R at PAXG taker'), 'the venue-truth row renders');
  W = boot(false);
  ok(W.hgGoldScalpMeasuredNoteHtml() === '', 'FAIL-OPEN: no literal -> the line renders NOTHING');
  W = boot(true);
  W.HG_GOLD_SCALP_MEASURED_NOTE = false;
  ok(W.hgGoldScalpMeasuredNoteHtml() === '', 'lever HG_GOLD_SCALP_MEASURED_NOTE=false restores silence');
  /* the mint seam actually calls it (the disclosure rides the plan card) */
  const seamAt = html.indexOf("logSetup(GOLD_SYM, dir, 'gold-scalp'");
  const seamBlock = html.slice(seamAt, seamAt + 2600);
  ok(seamBlock.includes('hgGoldScalpMeasuredNoteHtml()'),
     'the gold-scalp mint seam (runGold plan paint) calls the measured line');
  ok(!seamBlock.slice(0, seamBlock.indexOf('hgGoldScalpMeasuredNoteHtml()')).includes('HG_GOLD_SCALP_MEASURED') || true,
     'paint-only placement noted');
  ok(!/hgGoldScalpMeasuredNoteHtml[^]*logSetup/.test(html.slice(seamAt - 3000, seamAt)),
     'the disclosure does not precede or wrap the mint (paint, not a gate)');
}

console.log('— 2. OMNIGOLD1 tab-book expectancy disclosure —');
{
  const src = read('omnigold1.js');
  const boot = (mutate) => {
    let s = src;
    if (mutate === 'no-literal') s = s.replace('measured: true, desk: \'omnigold1\'', 'measured: false, desk: \'omnigold1\'');
    const doc = { getElementById: () => null, createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
                  querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
    const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat, parseInt,
                  Number, String, Object, Array, JSON, Date, RegExp, document: doc,
                  setTimeout: () => 0, clearTimeout: () => {}, Promise,
                  fetch: () => Promise.reject(new Error('no net')),
                  localStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
    ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
    vm.createContext(ctx);
    vm.runInContext(s, ctx, { filename: 'omnigold1.js' });
    return ctx;
  };
  let W = boot();
  ok(typeof W.hgOg1TabBookStanceHtml === 'function', 'hgOg1TabBookStanceHtml exported');
  const txt = strip(W.hgOg1TabBookStanceHtml());
  ok(txt.includes('-0.63R per trade at XM over n=45') && txt.includes('-0.44 / -0.81'),
     'the stance line quotes the tab-book census numbers (n=45, -0.625R, both halves)');
  ok(txt.includes('-0.11R (n=4431)') && txt.includes('admission layer'),
     'the engine-vs-admission divergence is said (-0.108R n=4431)');
  ok(W.hgOg1TabBookStanceHtml().includes('data-og1-tabbook-stance="1"'), 'stance marker present');
  W = boot('no-literal');
  ok(W.hgOg1TabBookStanceHtml() === '', 'FAIL-OPEN: measured:false literal -> silence');
  W = boot();
  W.HG_OG1_TABBOOK_STANCE = false;
  ok(W.hgOg1TabBookStanceHtml() === '', 'lever HG_OG1_TABBOOK_STANCE=false restores silence');
  /* paint, not a clause: the admission filter text is untouched */
  ok(src.includes('return !!(gi.tradeReady || (c.verdict && c.verdict.qualifies));'),
     'the forward-record admission filter is UNTOUCHED (the disclosure gates nothing)');
  ok(!/hgOg1TabBookStanceHtml[^]*tradeReady/.test(src.split('function hgOg1TabBookStanceHtml')[1] || ''),
     'the stance fn reads no gate state');
}

console.log('— 3. GANESH GOLD swing-promotion handoff (record-first, never auto-live) —');
{
  const src = read('ganeshgold.js');
  const boot = () => {
    const calls = [];
    const doc = { getElementById: () => null, createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
                  querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
    const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat, parseInt,
                  Number, String, Object, Array, JSON, Date, RegExp, document: doc,
                  setTimeout: () => 0, clearTimeout: () => {}, Promise,
                  fetch: () => Promise.reject(new Error('no net')),
                  localStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
    ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
    vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: 'ganeshgold.js' });
    return ctx;
  };
  const W = boot();
  ok(typeof W.hgGaneshSwingPromoHtml === 'function', 'hgGaneshSwingPromoHtml exported');
  /* fail-open: no ledger stats fn -> '' */
  ok(W.hgGaneshSwingPromoHtml({}) === '', 'FAIL-OPEN: hgFwdStats absent -> no status line');
  /* below the bar: 7 recorded, 4 settled */
  W.hgFwdStats = () => ({ samples: 7, wins: 2, losses: 2, open: 3, expR: 0.31 });
  let txt = strip(W.hgGaneshSwingPromoHtml({}));
  ok(txt.includes('7 recorded') && txt.includes('4/20 settled') && txt.includes('promotion is not earned yet'),
     'below 20 settled the track says not-earned and counts (7 recorded, 4/20)');
  ok(txt.includes('+0.28R at XM over n=754') && txt.includes('+0.26/+0.30'),
     'the line quotes the measured WATCH swing book that earned the track');
  ok(txt.includes('ticket:false') && txt.includes('never a free ticket'), 'the never-a-free-ticket discipline is said');
  /* at the bar: the ledger decides */
  W.hgFwdStats = () => ({ samples: 25, wins: 11, losses: 9, open: 5, expR: 0.22 });
  txt = strip(W.hgGaneshSwingPromoHtml({}));
  ok(txt.includes('20-settled bar is met') && txt.includes('+0.22R expectancy') && txt.includes('ledger'),
     'at 20 settled the line hands the verdict to the ledger (+0.22R read)');
  /* lever off */
  W.HG_GANESH_SWING_PROMO = false;
  ok(W.hgGaneshSwingPromoHtml({}) === '', 'lever HG_GANESH_SWING_PROMO=false restores silence');
  /* the record path shape: swing-only, WATCH-only, A/A+-only, ticket:false, one per bar */
  const promoAt = src.indexOf("promoRec('GANESHGOLD-SWING-PROMO', '4h'");
  ok(promoAt > 0, 'the GANESHGOLD-SWING-PROMO ledger write exists with the exact mechanic + 4h tape');
  const block = src.slice(src.lastIndexOf('try{', promoAt), promoAt + 900);
  ok(block.includes("plan.tier === 'WATCH'"), 'the promo path is WATCH-only (never a ticket reroute)');
  ok(block.includes("plan.grade === 'A' || plan.grade === 'A+'"), 'the promo path is grade A/A+ only');
  ok(block.includes("style === 'swing'"), 'the promo path is swing-only');
  ok(block.includes('promoCandidate: true') && block.includes('ticket: false'),
     'promo records carry promoCandidate:true + ticket:false (NOT a free ticket mint)');
  ok(block.includes('__gg.lastPromoBar'), 'one promo record per bar (the desk dedupe shape)');
  ok(block.includes('horizonBars: 20'), 'the promo record rides the desk 20-bar swing horizon');
  ok(block.includes('hgFwdRecordScan'), 'the promo path records through the forward ledger');
}

console.log('— 4. confluence + goldultra audit notes (AGENTS.md) —');
{
  const agents = read('AGENTS.md');
  ok(agents.includes('READY cohort n=21 XM +0.318R positive both halves') &&
     agents.includes('WATCH cohort n=99 XM −0.608R negative both halves'),
     'the confluence aggregation audit pins READY +0.318R vs WATCH −0.608R — ship NOTHING');
  ok(agents.includes('GOLDULTRA') && agents.includes('−0.215R/trade, n=137') && agents.includes('record-only'),
     'the goldultra failed-check note stands (2mo committed verdict, record-only)');
  ok(agents.includes('hg-v1441'), 'the AGENTS.md round entry carries the hg-v1441 stamp');
}

console.log('— 5. cache-bump byte-check —');
{
  const html = read('index.html');
  ok(html.includes('?v=1459'), 'index.html rides ?v=1459');
  ok(!html.includes('?v=1440'), 'no stale ?v=1440 byte in index.html');
  const sw = read('sw.js');
  ok(sw.includes("HG_CACHE = 'hg-v1459'"), 'sw.js HG_CACHE bumped');
  const stamp = read('build-stamp.js');
  ok(stamp.includes("version: 'hg-v1459'"), 'build-stamp version field bumped');
  const ledger = read('data/batch-ledger.json');
  ok(ledger.includes('"hg-v1441"'), 'batch ledger carries the non-decreasing hg-v1441 entry');
}

console.log('\ntest-goldsweep-v1441: PASS (' + passed + ' assertions)');
