/* HARDGATE — "470-read vote engine" was the least informative number on the
   tab, and one scan in five printed a regime nothing had established.

   TWO FINDINGS, both measured against the real cryptoUltraEngine.

   1. THE REGIME WAS DECIDED BY FOUR READS OF THIRTY, AND THE UNDECIDED CASE
      PRINTED AS TREND. countRegime filters to ['chop','adx','vhf','ht_mode'],
      so 26 regime-kind reads are computed, rendered in the vote table looking
      exactly like the four, and never consulted. Over 300 random tapes, 14 of
      those 26 carried a non-zero opinion at least once -- `hurst` and
      `killzone` on EVERY tape, `pfe` on 285, `fdi` on 273, `ravi` on 250, `er`
      on 212.

      regimeSummaryVote returns -1 / 0 / +1, and `< 0 ? 'chop' : 'trend'`
      folded 0 into TREND. Over the same 300 tapes:

        CHOP, 3+ of 4 agree            18   ( 6.0%)
        TREND, 2+ trend and no chop   224   (74.7%)
        TREND by DEFAULT (undecided)   58   (19.3%)

      The gate is NOT changed -- it tests `=== 'chop'`, which 0 never was, so
      an undecided regime passes exactly as before. Which four reads decide is
      NOT changed either: widening that set moves the gate, and that is
      calibration. What changed is that the card stops calling an undecided
      reading a trend, and says how many reads were consulted.

   2. 278 OF THE 470 READS CANNOT BE ANSWERED. Counted from the engine's own
      output: 127 vote, 30 regime, 35 prints ("identical information to X --
      counted once"), 278 n/a ("needs UTXO-level on-chain data -- never
      faked"). 59% of the table, identical on every tape and every symbol.
      That is the engine behaving well -- each row says what it needs and
      refuses to fake it -- but a reader told "470-read vote engine" and
      nothing else will not guess it. The composition is now computed from the
      votes rather than written down, because a hand-kept count is the thing
      that drifts.

   Run: node tests/test-cryptoscan-read-composition.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'order-flow.js',
                   'liquidation-intelligence.js', 'cryptoscan-voting-v3.js',
                   'cryptoultra.js', 'hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const ULTRA = fs.readFileSync(root + 'cryptoultra.js', 'utf8');
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const SEC = 900;

let seed = 1;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function tape(n, drift, vol){
  const rows = []; let px = 100;
  const t0 = Math.floor(Date.UTC(2026, 8, 19, 12, 0, 0) / 1000 / SEC) * SEC - n * SEC;
  for (let i = 0; i < n; i++){
    const o = px, c = px * (1 + (rnd() - 0.5 + drift) * vol);
    rows.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * (1 + rnd() * vol * 0.4),
                l: Math.min(o, c) * (1 - rnd() * vol * 0.4), v: 800 + rnd() * 2000 });
    px = c;
  }
  return rows;
}
const to1h = r => { const o = []; for (let i = 0; i + 4 <= r.length; i += 4){ const q = r.slice(i, i + 4);
  o.push({ t: q[0].t, o: q[0].o, c: q[3].c, h: Math.max(...q.map(x => x.h)),
           l: Math.min(...q.map(x => x.l)), v: q.reduce((a, x) => a + x.v, 0) }); } return o; };
const run = rows => S.cryptoUltraEngine({ rows15m: rows, rows1h: to1h(rows),
  now: (rows[rows.length - 1].t + SEC * 2) * 1000, venueCost: { venue: 'x', rtFrac: 0.001 } });

/* ---------------------------------------------------------------- 1
   THE SWEEP. 300 random tapes through the real engine. */
let sweep = null;
{
  seed = 1;
  const counted = S.HG_CRYPTO_ULTRA_REGIME_COUNTED;
  ok(Array.isArray(counted) && counted.length === 4,
     'the four deciding regime ids are exported (' + (counted || []).join(', ') + ')');

  let n = 0, chop = 0, trendReal = 0, undecided = 0, comp = null, emitted = 0;
  const activeUncounted = {};
  for (let t = 0; t < 300; t++){
    const res = run(tape(400, (rnd() - 0.5) * 0.6, 0.003 + rnd() * 0.04));
    if (!res.ok) continue;
    n++;
    if (!comp) comp = S.__csVoteComposition(res.votes);
    const regs = res.votes.filter(v => v.kind === 'regime');
    emitted = regs.length;
    if (res.regime === 'chop') chop++;
    else if (res.regime === 'trend') trendReal++;
    else if (res.regime === 'undecided') undecided++;
    for (const v of regs) if (counted.indexOf(v.id) < 0 && v.regime !== 0)
      activeUncounted[v.id] = (activeUncounted[v.id] || 0) + 1;
  }
  sweep = { n, chop, trendReal, undecided, comp, emitted, activeUncounted };

  ok(n === 300, 'all 300 tapes produced a reading');
  ok(emitted === 30, 'the engine emits ' + emitted + ' regime reads');
  ok(counted.length < emitted, 'and consults only ' + counted.length + ' of them');

  /* The engine REPORTS both numbers, and the card prints what it reports --
     so the report has to match the reads, not a figure written beside them.
     `emitted` above is counted here from res.votes; regimeCounts.emitted is
     the engine's own claim about the same thing. */
  seed = 31;
  const probe = run(tape(400, 0.1, 0.012));
  ok(probe.ok && probe.regimeCounts, 'a probe tape carries regimeCounts');
  ok(probe.regimeCounts.emitted === probe.votes.filter(v => v.kind === 'regime').length,
     'regimeCounts.emitted (' + probe.regimeCounts.emitted
     + ') equals the regime reads actually emitted');
  ok(probe.regimeCounts.counted === counted.length,
     'and regimeCounts.counted (' + probe.regimeCounts.counted
     + ') equals the length of the deciding list');
  ok(probe.regimeCounts.emitted > probe.regimeCounts.counted,
     'with more emitted than consulted, which is the whole point');

  ok(undecided > 0, undecided + ' tapes (' + (100 * undecided / n).toFixed(1)
     + '%) reach no regime verdict at all');
  ok(undecided / n > 0.15 && undecided / n < 0.25,
     'which is about one scan in five — not a rounding case');
  ok(chop + trendReal + undecided === n, 'and the three states partition the sweep ('
     + chop + ' chop / ' + trendReal + ' trend / ' + undecided + ' undecided)');

  const keys = Object.keys(activeUncounted);
  ok(keys.length >= 10, keys.length + ' of the ' + (emitted - counted.length)
     + ' uncounted regime reads carried an opinion at least once');
  ok(activeUncounted.hurst === n && activeUncounted.killzone === n,
     'hurst and killzone had one on EVERY tape, and neither is consulted');
}

/* ---------------------------------------------------------------- 2
   UNDECIDED IS NOT TREND, and the gate did not move. */
{
  ok(!/regimeSummaryVote\(out\) < 0 \? 'chop' : 'trend'/.test(stripComments(ULTRA)),
     'the two-way fold is gone from the engine');
  ok(/regimeVote > 0 \? 'trend' : 'undecided'/.test(stripComments(ULTRA)),
     'and the middle outcome has its own name');

  /* the gate tests 'chop', which the undecided case never was — so nothing
     that used to pass now fails, and nothing that used to fail now passes */
  const bareU = stripComments(ULTRA), bareS = stripComments(SCAN);
  ok(/res\.regime === 'chop'/.test(bareU), 'the engine gate still tests chop');
  ok(/res\.regime === 'chop'/.test(bareS), 'and so does the tab gate');
  ok(!/regime === 'undecided'/.test(bareU) && !/regime === 'undecided'/.test(bareS),
     'nothing gates on the new state — it is a label, not a rule');
  ok(!/regime === 'trend'/.test(bareU) && !/regime === 'trend'/.test(bareS),
     'and nothing gated on trend either, which is why the third state is safe');

  /* behaviourally: an undecided tape must NOT raise the regime gate */
  seed = 77;
  let checkedUndecided = 0, gatedUndecided = 0;
  for (let t = 0; t < 200 && checkedUndecided < 8; t++){
    const res = run(tape(400, (rnd() - 0.5) * 0.6, 0.003 + rnd() * 0.04));
    if (!res.ok || res.regime !== 'undecided') continue;
    checkedUndecided++;
    if ((res.gates || []).some(g => /regime gate/.test(g))) gatedUndecided++;
  }
  ok(checkedUndecided >= 4, 'found ' + checkedUndecided + ' undecided tapes to check');
  ok(gatedUndecided === 0, 'and none of them raised the regime gate — the gate is unmoved');

  ok(/decided: regimeVote !== 0/.test(ULTRA), 'the counts carry whether it was decided');
}

/* ---------------------------------------------------------------- 3
   THE CARD SAYS SO. */
{
  const rc = { chop: 0, trend: 1, decided: false, counted: 4, emitted: 30 };
  const note = S.__csRegimeNote({ regimeCounts: rc });
  ok(/4 of 30 regime reads decide/.test(note),
     'the chip says how many reads were consulted: "' + note.trim() + '"');
  ok(S.__csRegimeNote({}) === '', 'with no counts it says nothing rather than guessing');
  ok(S.__csRegimeNote(null) === '', 'and does not throw on a missing setup');
  /* the numbers come from the engine, not from this file */
  ok(!/4 of 30/.test(stripComments(SCAN)),
     'neither number is written into the tab — both ride on regimeCounts');
  ok(/regimeCounts: res\.regimeCounts/.test(stripComments(SCAN)),
     'which the scan carries onto the setup');
}

/* ---------------------------------------------------------------- 4
   THE COMPOSITION, counted rather than written down. */
{
  const c = sweep.comp;
  ok(c.total === 470, 'the engine emits ' + c.total + ' reads');
  ok(c.vote === 127, 'of which ' + c.vote + ' can vote');
  ok(c.regime === 30 && c.print === 35 && c.na === 278,
     c.regime + ' regime, ' + c.print + ' prints, ' + c.na + ' n/a');
  ok(c.vote + c.regime + c.print + c.na === c.total, 'and the four kinds account for all of them');
  ok(c.na / c.total > 0.55,
     Math.round(100 * c.na / c.total) + '% of the table needs a feed this app does not have');
  ok(c.regimeCounted === 4, 'four regime reads are marked as deciding');
  ok(c.naGroups >= 5, 'the n/a reads span ' + c.naGroups + ' groups');

  const line = S.__csCompositionNote(c);
  ok(/470 reads/.test(line) && /127<\/b> can vote/.test(line), 'the note leads with what votes');
  ok(/278<\/b> need a feed this app does not have/.test(line), 'and names the dead bulk');
  ok(/4 of them decide/.test(line), 'and which regime reads decide');
  ok(S.__csCompositionNote(null) === '' && S.__csCompositionNote({ total: 0 }) === '',
     'no reads, no note');

  /* nothing hand-counted: the composition must follow the votes it is given */
  const fake = [{ kind: 'vote', id: 'a', group: 'G' }, { kind: 'vote', id: 'b', group: 'G' },
                { kind: 'n/a', id: 'c', group: 'X' }, { kind: 'print', id: 'd', group: 'G' },
                { kind: 'regime', id: 'chop', group: 'G' }, { kind: 'regime', id: 'zzz', group: 'G' }];
  const f = S.__csVoteComposition(fake);
  ok(f.total === 6 && f.vote === 2 && f.na === 1 && f.print === 1 && f.regime === 2,
     'a six-read fixture counts as six, not as 470');
  ok(f.regimeCounted === 1, 'and only the id the engine consults is marked as deciding');
  ok(S.__csVoteComposition(null).total === 0, 'a missing vote list counts zero');
}

/* ---------------------------------------------------------------- 5
   THE TABLE marks the reads that decide. */
{
  seed = 4;
  const res = run(tape(400, 0.12, 0.012));
  ok(res.ok, 'a tape produced reads to render');
  const html = S.__csVoteTableHTML(res.votes);
  const counted = S.HG_CRYPTO_ULTRA_REGIME_COUNTED;

  ok(/regime · counted/.test(html), 'consulted regime reads are marked "counted"');
  ok(/regime · not counted/.test(html), 'and the rest "not counted"');
  const nCounted = (html.match(/regime · counted/g) || []).length;
  const nNot = (html.match(/regime · not counted/g) || []).length;
  ok(nCounted === counted.length, 'exactly ' + nCounted + ' rows are marked counted');
  ok(nCounted + nNot === 30, 'and the two marks cover all 30 regime rows');

  /* the four marked rows are the four the engine actually consults */
  for (const id of counted){
    const v = res.votes.filter(x => x.id === id)[0];
    ok(!!v && v.kind === 'regime', id + ' is a regime read in the output');
  }

  /* pack 881: the composition line is NOT repeated here. The card body prints
     the same breakdown a few lines above it ("470 reads fed: 127 vote · …"),
     and pack 880 added a second copy inside the same expanded view. The
     per-row counted/not-counted marks are what this table adds. */
  ok(html.indexOf(S.__csCompositionNote(S.__csVoteComposition(res.votes))) < 0,
     'the table does not repeat the composition line the card body already prints');
  ok(/reads fed: /.test(String(S.__csSetupCardHTML(
       { plan: null, count: { total: 470, kinds: { vote: 127, regime: 30, print: 35, na: 278 } },
         line: 'x', dir: 'long', label: 'BTC', pct: 0.8, votes: res.votes }, 0))),
     'and the card body is where that breakdown lives');
  ok(S.__csVoteTableHTML([]) === '', 'an empty vote list renders nothing');

  /* Every n/a row still carries its own refusal, which is the good part and
     the reason none of this is a criticism of the engine. Two shapes of
     refusal, and both are honest: 274 name a feed the app does not have, and
     4 decline on the grounds of not being an indicator at all (lunar phase,
     Gann planetary lines, LLM generators, backtest report matrices). An
     earlier version of this test asserted only the first shape and failed on
     the second -- the engine was right and the assertion was wrong. */
  const nas = res.votes.filter(v => v.kind === 'n/a');
  ok(nas.length === 278, 'all ' + nas.length + ' n/a reads are present');
  ok(nas.every(v => (v.why || '').length > 10),
     'every one carries a reason, none is silently blank');
  const needsFeed = nas.filter(v => /never faked|needs /.test(v.why || ''));
  /* esoteric timing (lunar phase, Gann planetary lines) and meta-tooling
     (LLM generators, backtest report matrices) -- not feeds, not indicators */
  const notAnIndicator = nas.filter(v => /esoteric|meta-tooling/.test(v.why || ''));
  ok(needsFeed.length === 274, needsFeed.length + ' name a feed this app does not have');
  ok(notAnIndicator.length === 4,
     'and ' + notAnIndicator.length + ' decline on the grounds of not being an indicator');
  ok(needsFeed.length + notAnIndicator.length === nas.length,
     'which accounts for every one of them');
}

/* ---------------------------------------------------------------- 6
   No hand-kept 470 left where a real count belongs. */
{
  const bare = stripComments(SCAN);
  ok(!/470-indicator vote table/.test(bare),
     'the card placeholder no longer hard-codes 470');
  ok(/vcomp\.total \+ ' reads, ' \+ vcomp\.vote \+ ' of them voting'/.test(bare),
     'it counts the reads the setup actually carries');
  ok(/\(127 of them vote\)/.test(bare),
     'the header names the engine and says how many of its reads vote');
  ok(/csVoteComposition\(s\.votes\)/.test(bare), 'and the card computes its own line');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
