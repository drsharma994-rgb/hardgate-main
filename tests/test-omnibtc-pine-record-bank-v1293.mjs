/* HARDGATE - hg-v1293: the OMNIBTC record-only bank of generic Pine ports.

   THE ASK: wire "the latest BTC-specific pine scripts, core strategies,
   indicators, fundamental, technical" into the OMNIBTC tab.

   WHAT THE AUDIT FOUND, said first because it decides everything below:
   fundamentals are already carried (hgObtcFundamentalLegs / Regime /
   PanelHtml inside omnibtc-engines.js), the technical bank already reads
   EMA-20/50, MACD histogram and Donchian fresh crosses (hgObtcIndBook), the
   core strategies already vote (hgObtcCoreAgree), and hg-v1292 already
   shipped the pine agreement gate. The real gap was seventeen GENERIC,
   timeframe-agnostic ports implemented and tested in this repo - they carry a
   `pineGold` prefix only because the gold desks built them first - that
   OMNIBTC read nowhere.

   WHY THEY DO NOT VOTE. The repo has measured three separate times that no
   signal-time read separates on the OMNI family (hg-v987: none of 36 reads
   on OMNIROUTE's 2,833-trade replay; hg-v945: the additive well is dry on
   this desk's own evidence; hg-v922: nothing either desk ranks by separates
   across four disjoint windows). And this desk's pine book has TWO outcomes
   per port: an agreeing port grows `pineFamilies` and makes the hg-v1292
   two-family ticket EASIER, while a disagreeing port hits
   `if (oppose.length) return hgObtcDemoteWatch(...)` and stands a good crown
   down. Unmeasured weight that can both flood the ticket side and veto is the
   hg-v966 trap. So the bank RECORDS and does not SCORE.

   THE STATE-VS-EVENT DEFECT, found while building this and pinned here: the
   first draft called each port and read `res.dir`, which is the port's SIGNAL
   EVENT, not its state. Driven on 400-bar clean up, down, flat and oscillating
   tapes exactly ONE of seventeen ports ever produced a read. The gold desks
   had already solved it - `pineGoldLayerStates` reads the port's underlying
   SERIES and takes the current side every record, and says so in its own
   comment ("the state read for the record stack, not the port's signal
   event"). This bank now CALLS that one reader instead of writing a second
   copy of seventeen state derivations (hg-v949's one home).

   WHY THIS IS NOT THE hg-v955 DEFECT (a field written and never read): the
   marks ride the forward ledger under the `pine:<id>` namespace its key
   validator accepts, and scripts/obtc-factor-separation.mjs is the reader
   that measures them. A port can only be promoted into the voting OBTC_PINE
   table once that measurement releases it.

   Run: node tests/test-omnibtc-pine-record-bank-v1293.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok -', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = read('omnibtc.js');

/* The expected bank: ledger id -> the pineGoldLayerStates key it reads. */
const EXPECTED = {
  'supertrend': 'supertrend', 'psar-flip': 'psar', 'hull-turn': 'hullma', 'qqe': 'qqe',
  'stoch-cross': 'stoch', 'ema-cross-rsi': 'emacross', 'fisher-zero': 'fisher',
  'trix-cross': 'trix', 'williams-reentry': 'williams', 'cci-reentry': 'cci',
  'keltner-pullback': 'keltner', 'chandelier-exit': 'chandelier', 'ichimoku': 'ichimoku',
  'adx-di': 'adx', 'aroon-cross': 'aroon', 'efficiency': 'efficiency', 'ote': 'ote'
};
const IDS = Object.keys(EXPECTED);

console.log('== 1) the record bank is declared, separate from the voting table ==');
{
  ok(/var OBTC_PINE_RECORD = \[/.test(SRC), 'OBTC_PINE_RECORD is declared');
  const vot = SRC.indexOf('var OBTC_PINE = [');
  const rec = SRC.indexOf('var OBTC_PINE_RECORD = [');
  ok(vot > 0 && rec > 0, 'both tables exist');
  ok(vot < rec, 'the record bank is declared after the voting table');
  const votIds = [...SRC.slice(vot, rec).matchAll(/\{ id: '([a-z0-9-]+)'/g)].map(m => m[1]);
  ok(votIds.length === 10, 'the voting table is untouched at exactly 10 ports (got ' + votIds.length + ')');
  const recBody = SRC.slice(rec, SRC.indexOf('function hgObtcPineRecordBook'));
  const rows = [...recBody.matchAll(/\{ key: '([a-z]+)',\s*id: '([a-z0-9-]+)'/g)].map(m => [m[2], m[1]]);
  ok(rows.length === IDS.length, 'the record bank holds exactly ' + IDS.length + ' rows (got ' + rows.length + ')');
  for (const [id, key] of rows){
    ok(EXPECTED[id] !== undefined, 'record row id is expected: ' + id);
    ok(EXPECTED[id] === key, id + ' reads the shared reader key ' + key);
  }
  for (const id of IDS) ok(rows.some(r => r[0] === id), 'bank carries ' + id);
}

console.log('== 2) the bank CALLS the shared reader, and never reimplements it ==');
{
  ok(/W\.pineGoldLayerStates/.test(SRC), 'the bank reads the shared pineGoldLayerStates');
  ok(/typeof statesFn !== 'function'\) return out;/.test(SRC),
    'an absent reader leaves the bank empty rather than throwing');
  /* the bank must NOT call the ports individually - that was the defect */
  const g0 = SRC.indexOf('function hgObtcPineRecordBook');
  const g1 = SRC.indexOf('function hgObtcPineBook', g0);
  const bank = SRC.slice(g0, g1);
  ok(!/W\[spec\.fn\]|pineGoldSupertrend\(|pineGoldPsarFlip\(|pineGoldHullTurn\(/.test(bank),
    'the bank does not call the ports directly (the state-vs-event defect)');
  ok(/s\[spec\.key\]/.test(bank), 'it indexes the reader output by each row key');
  /* and the reader really exists in the tree */
  ok(/G\.pineGoldLayerStates = pineGoldLayerStates;/.test(read('pinegoldmath.js')),
    'pinegoldmath.js exports the reader the bank calls');
}

console.log('== 3) the bank is READ-ONLY: it can never cast a vote ==');
{
  const g0 = SRC.indexOf('function hgObtcApplyPineAccuracy');
  ok(g0 > 0, 'hgObtcApplyPineAccuracy exists');
  const endMark = SRC.indexOf("return hgObtcDemoteWatch(pick, 'no fresh pine script", g0);
  const gate = SRC.slice(g0, SRC.indexOf('\n  }', endMark));
  const lines = gate.split('\n');
  const recLines = [], voteLines = [];
  lines.forEach((l, i) => {
    if (l.includes('pineRecord') || l.includes('recBook')) recLines.push(i + 1);
    if (/^\s*(var\s+)?(fams|agree|agreeItems|oppose|indAgree|indOppose|h1Agree|h1Oppose|cores)\s*=/.test(l)) voteLines.push(i + 1);
  });
  ok(recLines.length > 0, 'the gate stamps the record bank');
  ok(voteLines.length >= 5, 'the gate builds its vote vectors (found ' + voteLines.length + ')');
  ok(Math.max(...recLines) < Math.min(...voteLines),
    'every record-bank use (' + recLines.join(',') + ') precedes every vote assignment (' + voteLines.join(',') + ')');
  for (const l of lines){
    if (/^\s*(var\s+)?(fams|agree|agreeItems|oppose|indAgree|indOppose|h1Agree|h1Oppose|cores)\s*=/.test(l)){
      ok(!l.includes('recBook') && !l.includes('pineRecord'), 'vote vector built without the record bank: ' + l.trim());
    }
  }
  ok(/fams = hgObtcFamilies\(agreeItems\)/.test(gate), 'fams comes from agreeItems, never the record bank');
  ok(/cores = hgObtcCoreAgree\(cands, pick\.row\)/.test(gate), 'cores comes from the house strategies, never the record bank');
}

console.log('== 4) the three-state contract, DRIVEN on real tapes ==');
{
  /* driven through the real module IIFE (hg-v1022 technique: lift in-context
     rather than exporting a symbol just to test it, hg-v967). */
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseFloat, parseInt };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'pinemath.js', 'pinegoldmath.js']) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  const tail = SRC.lastIndexOf('})();');
  ok(tail > 0, 'the module IIFE closing brace is locatable');
  vm.runInContext(SRC.slice(0, tail) + 'W.__recBank = hgObtcPineRecordBook; W.__table = OBTC_PINE_RECORD;\n' + SRC.slice(tail), ctx, { filename: 'omnibtc.js' });
  const book = ctx.__recBank;
  const table = ctx.__table;
  ok(typeof book === 'function', 'hgObtcPineRecordBook is reachable');
  ok(Array.isArray(table) && table.length === IDS.length, 'the runtime table carries ' + IDS.length + ' rows');

  const mk = (kind, n = 400) => {
    const rows = []; let px = 100;
    for (let i = 0; i < n; i++){
      const drift = kind === 'up' ? 0.004 : kind === 'down' ? -0.004 : 0;
      const o = px, c = px * (1 + drift);
      const h = Math.max(o, c) * (kind === 'flat' ? 1 : 1.002), l = Math.min(o, c) * (kind === 'flat' ? 1 : 0.998);
      rows.push({ t: 1700000000 + i * 14400, o, h, l, c, v: kind === 'flat' ? 1 : 100 + (i % 7) });
      px = c;
    }
    return rows;
  };
  const osc = (n = 400) => { const rows = []; for (let i = 0; i < n; i++){ const c = 100 + 12 * Math.sin(i / 9) + 0.05 * i; rows.push({ t: 1700000000 + i * 14400, o: c - 0.2, h: c + 0.6, l: c - 0.6, c, v: 100 + (i % 5) }); } return rows; };

  const up = book(mk('up'));
  ok(Object.keys(up.states).length >= 10, 'a clean up-trend reads most ports (got ' + Object.keys(up.states).length + ')');
  for (const k of Object.keys(up.states)) ok(up.states[k] === 'long' || up.states[k] === 'short', k + ' reads a real side');
  ok(Object.values(up.states).filter(v => v === 'long').length > Object.values(up.states).filter(v => v === 'short').length,
    'and the up-trend reads predominantly long');
  const down = book(mk('down'));
  ok(Object.values(down.states).filter(v => v === 'short').length > Object.values(down.states).filter(v => v === 'long').length,
    'a clean down-trend reads predominantly short (the state flips with the tape, so these are states, not events)');
  const oscTape = book(osc());
  ok(Object.keys(oscTape.states).length > 0, 'an oscillating tape still reads a side');

  /* absent is unread, never a guessed side */
  ok(book([]).states && Object.keys(book([]).states).length === 0, 'an empty tape invents nothing');
  ok(book(null).states && Object.keys(book(null).states).length === 0, 'a null tape invents nothing');
  const short = mk('up', 20);
  ok(Object.keys(book(short).states).length === 0, 'a tape under the reader floor invents nothing');
  ok(book(short).ran === 0, 'and reports that nothing ran');
  for (const v of Object.values(book(mk('flat')).states)) ok(v === 'long' || v === 'short', 'a flat tape can only read a real side');
  /* every returned state key must be a declared bank id */
  for (const k of Object.keys(up.states)) ok(IDS.includes(k), 'state key is a declared bank id: ' + k);
  /* and never the raw reader key */
  for (const raw of ['hullma', 'emacross', 'psar']) ok(!Object.keys(up.states).includes(raw), 'raw reader key is mapped to the ledger id, not leaked: ' + raw);
}

console.log('== 5) the marks reach the forward ledger, and gate nothing ==');
{
  const ln = SRC.indexOf("W.hgFwdRecordScan('OMNIBTC'");
  ok(ln > 0, 'the OMNIBTC record call exists');
  const lit = SRC.slice(Math.max(0, ln - 7000), ln);
  ok(/pick\.row\.pineRecord/.test(lit), 'the record literal reads the crown row\'s record states');
  ok(/fwdRow\['pine:' \+ rk\]/.test(lit), 'and writes them under the pine: namespace');
  ok(/if \(rv === 'long' \|\| rv === 'short'\)/.test(lit), 'only a readable side is written');
  ok(/Object\.prototype\.hasOwnProperty\.call/.test(lit), 'the loop guards against prototype keys');
  const FWD_READ_KEY = /^[A-Za-z0-9][A-Za-z0-9:_. -]{0,47}$/;
  ok(FWD_READ_KEY.test('pine:supertrend'), 'pine:<id> passes the ledger key validator');
  /* the validator's class genuinely rejects a bad key, so this check has teeth */
  ok(!FWD_READ_KEY.test(':leading-colon'), 'a key starting with a non-alphanumeric is rejected');
  ok(!FWD_READ_KEY.test('pine:' + 'x'.repeat(60)), 'an over-long key is rejected');
  for (const id of IDS) ok(FWD_READ_KEY.test('pine:' + id), 'every bank id yields a valid ledger key: pine:' + id);
  const cap = +(read('hg-forward.js').match(/FWD_READS_MAX = (\d+)/) || [])[1];
  ok(cap === 96, 'the ledger cap is 96 (got ' + cap + ')');
  ok(IDS.length < cap, IDS.length + ' marks fit inside the ' + cap + '-key ceiling');
  for (const f of ['hg-perfect-setup.js', 'setup-stack.js', 'cryptogates.js', 'plans.js', 'hg-gates.js', 'hg-setup-core.js']){
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    const src = read(f);
    for (const id of IDS) ok(!src.includes('pine:' + id), f + ' does not gate on pine:' + id);
  }
}

console.log('\ntest-omnibtc-pine-record-bank-v1293: ' + passed + ' passed, 0 failed');
