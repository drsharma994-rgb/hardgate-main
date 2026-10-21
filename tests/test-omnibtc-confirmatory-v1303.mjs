/* HARDGATE — hg-v1303: THE CONFIRMATORY SETUP on OMNIBTC.

   THE GAP THIS CLOSES, measured: the desk assembled an independent-evidence
   verdict and showed it to nobody. `crossValidation` and `accuracyScore` were
   stamped on every candidate and read NOWHERE — three write sites, zero read
   sites in the whole repo. The six weighted contributions existed only as inline
   `score +=` lines, so no reader could tell WHICH evidence confirmed a crown. The
   card printed the pine note and the evidence chips, and nothing about the
   cross-validation that actually gates the ticket.

   WHAT THIS GUARD PROVES, behaviourally, through the real omnibtc.js IIFE:
     1. ONE HOME for the weights — the score IS the sum of the parts table, so the
        readout cannot drift from the score
     2. the composer NAMES what confirmed, what disagreed, and what was unread
     3. THREE-STATE — an unread flow is 'unread', never 'against'; a quiet
        fundamental board is never reported as a confirmation
     4. it is a READOUT, not a gate: it cannot mint, move or refuse anything, and
        it mutates none of the fields it reads
     5. the ticket triple gate is reported exactly as the desk applies it
        (7/7 CLEAN + opposite-family sibling + weighted score >= 30)
     6. the HTML renders, carries its own marker, and states the absence case

   Run: node tests/test-omnibtc-confirmatory-v1303.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok -', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* hg-v967: this desk refuses to export a function just so a test can reach it,
   so the three functions are LIFTED from source into a sandbox (the same
   technique test-gold-perfect-gates-v1291.mjs uses for trendmxPineMarks). That
   also means this guard fails loudly if a function is renamed or deleted — the
   lift throws.
   The lift BRACE-COUNTS rather than regex-matching to the first `\n  }`: these
   functions contain nested blocks, so a non-greedy match truncates them and the
   guard then measures a half-function. That bug was hit while building this
   guard — a truncated body summed 0 while the source summed 70.
   `esc` is the desk's own escaper, reduced to identity here because this guard
   asserts structure, not escaping. */
function liftFn(src, name){
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('could not lift ' + name + ' from omnibtc.js (renamed or deleted?)');
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced braces lifting ' + name);
}
function lift(){
  const src = read('omnibtc.js');
  const ctx = { Math, Date, isFinite, isNaN, JSON, Array, Object, Number, String, RegExp, Error, TypeError };
  ctx.esc = s => String(s === null || s === undefined ? '' : s);
  vm.createContext(ctx);
  for (const n of ['hgObtcAccuracyParts', 'hgObtcConfirmatoryRead', 'hgObtcConfirmatoryHtml']){
    vm.runInContext(liftFn(src, n), ctx, { filename: 'lifted:' + n });
  }
  return ctx;
}

/* a fully-confirmed long: every one of the six contributions is on */
function fullRow(){
  return {
    sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135,
    clean: true, engine: 'PINE CONFIRM', omniPrincipal: 'pass',
    crossValidation: 'PASSED: confirmed by opposite family engine',
    takerFlowWith: true, fundamentalAligned: true,
    accuracyParts: null, accuracyScore: null,
    pineAgree: ['HalfTrend', 'Squeeze Momentum'], pineOppose: [], pineFamilies: ['trend', 'momentum'],
    indAgree: ['EMA 20/50'], indOppose: []
  };
}

console.log('== 1) the weights have ONE home: the score IS the table sum ==');
{
  const W = lift();
  ok(typeof W.hgObtcAccuracyParts === 'function', 'hgObtcAccuracyParts is exported');
  ok(typeof W.hgObtcConfirmatoryRead === 'function', 'hgObtcConfirmatoryRead is exported');
  ok(typeof W.hgObtcConfirmatoryHtml === 'function', 'hgObtcConfirmatoryHtml is exported');
  const src = read('omnibtc.js');
  const sumSites = (src.match(/score \+= /g) || []).length;
  ok(sumSites === 1,
    'exactly ONE `score +=` site remains and it sums the parts table (found ' + sumSites + ')');
  ok(/for \(var qi = 0; qi < parts\.length; qi\+\+\) score \+= parts\[qi\]\.weight;/.test(src),
    'and that site is the parts-sum loop');

  const parts = W.hgObtcAccuracyParts(fullRow(), true);
  ok(parts.length === 6, 'the table has six weighted contributions (' + parts.length + ')');
  const sum = parts.reduce((a, p) => a + p.weight, 0);
  ok(sum === 70, 'all six on sums to the documented ceiling of 70 (got ' + sum + ')');
  const keys = parts.map(p => p.key).join(',');
  ok(keys === 'gates,sibling,pine,flow,fundamental,principal',
    'the table keeps the historical six, by key (' + keys + ')');
  /* the historic weights are preserved exactly */
  const byKey = {}; parts.forEach(p => { byKey[p.key] = p.weight; });
  ok(byKey.gates === 20 && byKey.sibling === 15 && byKey.pine === 10
     && byKey.flow === 10 && byKey.fundamental === 10 && byKey.principal === 5,
    'the historic weights are unchanged: 20 / 15 / 10 / 10 / 10 / 5');
}

console.log('\n== 2) the composer NAMES the confirmations ==');
{
  const W = lift();
  const r = W.hgObtcConfirmatoryRead(fullRow());
  ok(r.withCount === 6, 'all six contributions read as WITH (' + r.withCount + ')');
  ok(r.absentCount === 0, 'and none is reported absent (' + r.absentCount + ')');
  ok(r.score === 70, 'the read carries the same weighted total as the table (' + r.score + ')');
  ok(r.ticket === true, 'a fully-confirmed CLEAN pick reads as a confirmatory setup');
  ok(r.crossValidation === 'PASSED: confirmed by opposite family engine',
    'the cross-validation verdict is surfaced verbatim, not swallowed');
  ok(JSON.stringify(r.pineAgree) === JSON.stringify(['HalfTrend', 'Squeeze Momentum']),
    'the agreeing pine families are named');
  ok(JSON.stringify(r.pineFamilies) === JSON.stringify(['trend', 'momentum']),
    'and the distinct families they span');
  ok(r.takerFlowState === 'with' && r.fundamentalAligned === true,
    'the flow and fundamental readings are surfaced');
}

console.log('\n== 3) THREE-STATE: absence is never reported as agreement OR as disagreement ==');
{
  const W = lift();
  /* nothing confirmed at all: unread flow, quiet fundamentals, no sibling */
  const bare = {
    sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 90, t1: 120,
    clean: false, engine: 'SWING', omniPrincipal: null,
    crossValidation: 'FAILED: no sibling confirmation from opposite family',
    accuracyParts: W.hgObtcAccuracyParts({ clean: false, engine: 'SWING' }, false)
  };
  const r = W.hgObtcConfirmatoryRead(bare);
  ok(r.withCount === 0, 'nothing is reported as WITH when nothing confirmed');
  ok(r.takerFlowState === 'unread', 'an unstamped flow reads UNREAD, never against (' + r.takerFlowState + ')');
  ok(r.fundamentalAligned === null, 'a quiet fundamental board is null, not a confirmation');
  ok(r.ticket === false, 'and it is not a ticket');
  /* an explicit AGAINST flow must read as against */
  const against = Object.assign({}, bare, { takerFlowWith: false });
  ok(W.hgObtcConfirmatoryRead(against).takerFlowState === 'against',
    'an EXPLICIT false reads as against — the state really is three-valued');
  /* unread flow must not be counted as a contribution */
  const noFlow = W.hgObtcAccuracyParts({ clean: true, engine: 'X' }, false);
  const flowPart = noFlow.filter(p => p.key === 'flow')[0];
  ok(flowPart.weight === 0 && flowPart.on === false,
    'an unread flow contributes ZERO weight and reads not-on');
}

console.log('\n== 4) it is a READOUT, not a gate — nothing is minted or moved ==');
{
  const W = lift();
  const row = fullRow();
  const before = JSON.stringify(row);
  W.hgObtcConfirmatoryRead(row);
  W.hgObtcConfirmatoryHtml(row);
  ok(JSON.stringify(row) === before, 'the composer and the renderer MUTATE NOTHING on the row');
  const src = read('omnibtc.js');
  /* Strip comments before the assignment scan: the first version of this check
     matched a word inside the function's OWN comment ("no stamp means...") and
     reported a mutation that does not exist. Assert against code, not prose. */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  const fn = strip(liftFn(src, 'hgObtcConfirmatoryRead'));
  ok(!/["']?clean["']?\s*=[^=]/.test(fn) && !/["']?tier["']?\s*=[^=]/.test(fn)
     && !/["']?demoted["']?\s*=[^=]/.test(fn) && !/["']?near["']?\s*=[^=]/.test(fn),
    'the composer never assigns clean / tier / demoted / near — it cannot demote or promote');
  const hfn = strip(liftFn(src, 'hgObtcConfirmatoryHtml'));
  ok(!/["']?clean["']?\s*=[^=]/.test(hfn) && !/["']?tier["']?\s*=[^=]/.test(hfn)
     && !/["']?demoted["']?\s*=[^=]/.test(hfn),
    'and neither does the renderer');
  /* the ticket triple gate, restated precisely */
  const t = (o) => W.hgObtcConfirmatoryRead(o).ticket;
  ok(t(fullRow()) === true, 'triple gate: all three present -> a ticket');
  ok(t(Object.assign(fullRow(), { clean: false })) === false, 'drop CLEAN -> not a ticket');
  ok(t(Object.assign(fullRow(), { crossValidation: 'FAILED: no sibling confirmation from opposite family' })) === false,
    'drop the sibling confirmation -> not a ticket');
  ok(t(Object.assign(fullRow(), {
    clean: true, engine: 'X', omniPrincipal: null, takerFlowWith: null, fundamentalAligned: null,
    crossValidation: 'PASSED: confirmed by opposite family engine', accuracyScore: 35
  })) === true, 'sibling + CLEAN at the 30 floor -> a ticket');
  ok(t(Object.assign(fullRow(), {
    clean: true, engine: 'X', omniPrincipal: null, takerFlowWith: null, fundamentalAligned: null,
    crossValidation: 'PASSED: confirmed by opposite family engine', accuracyScore: 29
  })) === false, 'one point under the floor -> not a ticket');
}

console.log('\n== 5) the HTML renders, marks itself, and states the absence case ==');
{
  const W = lift();
  const yes = W.hgObtcConfirmatoryHtml(fullRow());
  ok(yes.indexOf('data-obtc-confirmatory="1"') >= 0, 'the readout carries its own DOM marker');
  ok(/CONFIRMATORY SETUP/.test(yes), 'a confirmed ticket reads CONFIRMATORY SETUP');
  ok(/WITH:/.test(yes) && /house gates CLEAN/.test(yes), 'it names the WITH evidence');
  ok(/weighted accuracy 70\/70/.test(yes), 'it shows the weighted total against the ceiling');
  ok(/cross-validation: PASSED/.test(yes), 'and the cross-validation verdict');
  ok(!/not sent/.test(yes), 'a ticket does NOT print the stand-aside explanation');

  const no = W.hgObtcConfirmatoryHtml({
    sym: 'BTCUSDT', dir: 'short', clean: false, engine: 'SWING',
    crossValidation: 'FAILED: no sibling confirmation from opposite family',
    accuracyParts: W.hgObtcAccuracyParts({ clean: false, engine: 'SWING' }, false)
  });
  ok(/NOT A TICKET/.test(no), 'a short-of-the-gate read says NOT A TICKET');
  ok(/nothing independent confirmed this yet/.test(no), 'and says plainly that nothing confirmed it');
  ok(/needs all three/.test(no), 'and states the triple gate so the reader knows what was missing');
  ok(/taker flow: unread/.test(no), 'unread evidence is reported as unread in the render');

  /* an empty row renders nothing rather than an empty shell */
  ok(W.hgObtcConfirmatoryHtml({}) === '', 'a row with no verdict renders nothing at all');
}

console.log('\n== 6) the readout is WIRED into the winner card ==');
{
  const src = read('omnibtc.js');
  ok(/html \+= hgObtcConfirmatoryHtml\(r\);/.test(src),
    'the winner card calls the readout (hg-v956: a rename or removal trips here)');
  const card = src.slice(src.indexOf('data-obtc-winner'));
  ok(card.indexOf('hgObtcConfirmatoryHtml') < 2000,
    'and it is inside the winner card block, beside the pine note');
}

console.log('\n' + passed + ' passed, 0 failed');
