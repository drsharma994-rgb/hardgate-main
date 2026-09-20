/* HARDGATE — the footer measured the population it tells you not to trade.

   Two sentences of CRYPTO SCAN's closing note, one line apart:

     "Lower-quality signals shown for reference but not recommended for
      trading."
     "Its own settled records: N at X% T1-first ..."

   The second was computed over the first. csFwdVerdict read hgFwdPool, and
   hgFwdPool calls hgFwdStats with ticketOnly hardcoded false, so every
   VOTE-WEAK and VOTE-STANDARD row this desk has ever written was averaged
   into the number offered as the tab's own accuracy. Pack 872 recorded
   `ticket: !!s.isHighQuality` calling it "the split that lets someone later
   ask whether the tab's strongest claim paid". Nobody ever asked it.

   Measured on a day of this desk's real shape -- 96 bars, 40 contracts a bar,
   the high-quality tier at the 5% the live sweeps show, recommended rows
   hitting 60% and the rest 34%:

     high-quality share of the log        5.0%
     POOLED          3,840 settled, 34.8% hit   BELOW the 40% breakeven
     HIGH-QUALITY      192 settled, 59.9% hit   ABOVE it

   Opposite sides of this tab's own 1/(1+1.5R) breakeven. The recommended
   subset is outvoted nineteen to one by rows the same paragraph disclaims.

   The read is now done per population, with BOTH legs -- the stats and the
   overlap correction -- filtered the same way, and the footer leads with the
   block it recommends. gateClear rather than ticket, because only the
   gateClear split is folded into the uncapped aggregate: a ticket query is a
   view of the last few weeks that thins as records prune, a gateClear query
   reads all time, and for this tab they are the same population.

   Run: node tests/test-cryptoscan-recommended-pool.mjs */
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
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null),
                     setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.fetch = () => Promise.reject(new Error('no network in tests'));
  vm.createContext(s);
  for (const f of ['order-flow.js', 'liquidation-intelligence.js', 'cryptoscan-voting-v3.js',
                   'hg-forward.js', 'omniroute.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const FWD = fs.readFileSync(root + 'hg-forward.js', 'utf8');
const LS = 'hg_forward_v1', AGG = 'hg_forward_agg_v1';
const SEC = 900, BAR0 = 1700000000, HZ = 24;

function rec(tier, hq, bar, win, sym){
  return { tab: 'CRYPTO SCAN', mechanic: 'VOTE-' + tier.toUpperCase() + '@V5',
           sym: sym, tf: '15m', dir: 'long', entry: 100, stop: 95, t1: 107.5,
           risk: 5, rr: 1.5, barT: bar, horizonBars: HZ,
           state: win ? 't1' : 'stop',
           ticket: hq, gateClear: hq ? true : undefined };
}
/* a day of this desk's real shape, deterministic */
function buildDay(){
  const out = [];
  let n = 0;
  for (let b = 0; b < 96; b++){
    const bar = BAR0 + b * SEC;
    for (let i = 0; i < 38; i++)
      out.push(rec(i % 3 === 0 ? 'weak' : 'standard', false, bar, (n++ % 100) < 34, 'S' + i));
    for (let i = 0; i < 2; i++)
      out.push(rec('professional', true, bar, (b * 2 + i) % 5 < 3, 'H' + i));
  }
  return out;
}
const wipe = () => { S.localStorage.removeItem(LS); S.localStorage.removeItem(AGG); };
const write = rows => S.localStorage.setItem(LS, JSON.stringify(rows));

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the pool the footer read could not answer the question');
{
  const fwd = stripComments(FWD);
  ok(/out\[m\] = hgFwdStats\(recs, tab, m, false, agg\);/.test(fwd),
     'hgFwdPool calls hgFwdStats with ticketOnly hardcoded FALSE');
  ok(/function hgFwdStats\(list, tab, mechanic, ticketOnly/.test(fwd),
     'while hgFwdStats takes a filter it never gets from there');
  ok(/wantGateClear === true && r\.gateClear !== true\) continue;/.test(fwd),
     'and knows how to keep only the gate-clear population');
  ok(/var wantGc = !!\(opts && opts\.gateClear === true\);/.test(fwd),
     'hgFwdOverlap takes the SAME filter, so the two cannot describe different populations');

  const src = stripComments(SCAN);
  ok(/ticket: !!s\.isHighQuality/.test(src),
     'and this tab has recorded the split on every row since pack 872');
  /* the contradiction, in the footer's own words */
  ok(/Lower-quality signals shown for reference but not recommended for trading/.test(src),
     'the footer disclaims the lower-quality rows');
  ok(/csAccuracySentence\(fwd\)/.test(src), 'and then prints an accuracy sentence beside it');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the two populations, on a day of this desk\'s real shape');
{
  wipe();
  const day = buildDay();
  write(day);
  const hqRows = day.filter(r => r.ticket === true).length;
  ok(Math.abs(100 * hqRows / day.length - 5) < 0.6,
     'the high-quality rows are ' + (100 * hqRows / day.length).toFixed(1) + '% of the log');

  const all = S.__csFwdRead(false);
  const hq = S.__csFwdRead(true);
  ok(all.settled === day.length, 'the whole book settles ' + all.settled + ' records');
  ok(hq.settled === hqRows, 'the recommended block settles ' + hq.settled);
  ok(hq.settled < all.settled / 10, 'which is under a tenth of the log');

  const be = 1 / (1 + 1.5);
  ok(Math.abs(be - 0.4) < 1e-9, 'the breakeven at this tab\'s 1.5R ladder is 40%');
  ok(all.hit < be, 'POOLED reads BELOW breakeven (' + (100 * all.hit).toFixed(1) + '%)');
  ok(hq.hit > be, 'RECOMMENDED reads ABOVE it (' + (100 * hq.hit).toFixed(1) + '%)');
  ok((all.hit < be) !== (hq.hit < be),
     'so the pooled number and the recommended one fall on opposite sides of the tab\'s own bar');

  /* and the independence barely moves, because the redundancy here is
     cross-sectional rather than along the clock */
  ok(isFinite(all.effN) && isFinite(hq.effN), 'both populations carry an overlap correction');
  ok(Math.abs(all.effN - hq.effN) < 0.05,
     'narrowing to 5% of the rows leaves effN essentially unchanged ('
     + all.effN.toFixed(2) + ' vs ' + hq.effN.toFixed(2) + ') — the subset is 19x smaller '
     + 'and carries the same independent evidence');
  ok(all.effN < 10, 'a day of this desk is only about five independent observations');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. both legs of the read are filtered, not just the stats');
{
  /* WHAT effN ACTUALLY DEPENDS ON. Every record here carries the same
     horizon, so hgFwdOverlap's weighted total is n x span and its union
     denominator is the stretch of clock covered: effN collapses to
     coverage / horizon and does NOT move with the record count. That is why
     section 2's 19x narrowing left it unchanged — and it is also what makes
     this section a real test rather than a restatement. To separate the two
     populations the SPANS have to differ, not the counts.

     So: the lower-quality rows fire across 384 bars, the recommended ones
     across the first 96. If the overlap leg ignored the filter, the subset
     would inherit the whole log's coverage and claim four times the
     independent evidence it has. */
  wipe();
  const rows = [];
  for (let b = 0; b < 384; b++)
    for (let i = 0; i < 5; i++) rows.push(rec('weak', false, BAR0 + b * SEC, i % 3 === 0, 'L' + i));
  for (let b = 0; b < 96; b++)
    rows.push(rec('professional', true, BAR0 + b * SEC, b % 2 === 0, 'H0'));
  write(rows);

  const all = S.__csFwdRead(false), hq = S.__csFwdRead(true);
  ok(hq.settled === 96 && all.settled === 384 * 5 + 96, 'both populations are counted');
  ok(hq.effN < all.effN,
     'the recommended rows span a quarter of the clock, so they carry FEWER independent '
     + 'observations (' + hq.effN.toFixed(2) + ' vs ' + all.effN.toFixed(2)
     + ') — they would inherit the whole log\'s if the overlap leg ignored the filter');
  ok(all.effN / hq.effN > 3,
     'and the gap tracks the coverage ratio, not the 20x difference in record count');

  const ovAll = S.hgFwdOverlap('CRYPTO SCAN', null, {});
  const ovHq = S.hgFwdOverlap('CRYPTO SCAN', null, { gateClear: true });
  ok(Math.abs(hq.effN - ovHq.effN) < 1e-9 && Math.abs(all.effN - ovAll.effN) < 1e-9,
     'and each read carries exactly the overlap of its own population');

  const src = stripComments(SCAN);
  ok(/W\.hgFwdOverlap\('CRYPTO SCAN', null, gateClear \? \{ gateClear: true \} : \{\}\)/.test(src),
     'the source passes the same filter to the overlap leg');
  ok(/W\.hgFwdStats\('CRYPTO SCAN', keys\[i\], filter\)/.test(src),
     'and to the stats leg');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. gateClear, not ticket — because only one survives pruning');
{
  wipe();
  const day = buildDay();
  write(day);
  /* fold every settled record into the uncapped aggregate and drop the live
     list, which is what pruning does over time */
  const agg = S.hgFwdFold(JSON.parse(S.localStorage.getItem(AGG) || '{}'), day);
  S.localStorage.setItem(AGG, JSON.stringify(agg));
  write([]);

  const hqAfter = S.__csFwdRead(true);
  ok(hqAfter.settled > 0,
     'after every live record is pruned the recommended population still reads '
     + hqAfter.settled + ' settled');
  const ticketAfter = S.hgFwdStats('CRYPTO SCAN', 'VOTE-PROFESSIONAL@V5', true);
  ok(ticketAfter.samples === 0,
     'while the same question asked as a TICKET query reads 0 — the aggregate keeps no ticket split');
  ok(/the aggregate keeps no ticket\/shown split/.test(FWD),
     'which hg-forward.js says in as many words');
  ok(/if \(r\.gateClear === true\) tally\(out\[key\]\.gc/.test(stripComments(FWD)),
     'and the gate-clear split is the one it folds');

  /* the two are the same population for THIS tab, which is why the swap is free */
  ok(/gateClear: \(rec\.gateClear === undefined \|\| rec\.gateClear === null\)/.test(FWD)
     && /\? \(rec\.ticket === true \? true : undefined\)/.test(FWD),
     'a ticket is recorded as gate-clear by definition');
  const src = stripComments(SCAN);
  const rowBuilder = src.slice(src.indexOf('function csFwdRows'),
                               src.indexOf('function csCoverage'));
  ok(/ticket: !!s\.isHighQuality/.test(rowBuilder) && !/gateClear/.test(rowBuilder),
     'so this tab records only `ticket` and inherits gateClear, rather than stating it twice');
  ok(/isHighQuality: [^\n]*/.test(src), 'and isHighQuality is every gate clear AND the pro stamp');
}

/* ---------------------------------------------------------------- 4b */
console.log('\n4b. settled and open are different counts, and only one is the rate');
{
  /* A LIVE LOG IS MOSTLY OPEN. Every fixture above settles every row, which
     cannot tell a hit rate over SETTLED records from one that quietly divides
     by settled-plus-still-running -- the second understates a desk purely for
     having positions on. Here half the recommended rows are still open.

     AND THEY HAVE TO BE RECENT. hgFwdStats splits an open record that is more
     than STALE_HORIZONS past its own horizon into `stale` and counts it as
     neither a sample nor an open position -- "a record whose bars were never
     going to arrive is not a trade still running". A row stamped 2023 with a
     6-hour horizon is stale, not open, so the still-running rows are anchored
     to the current bar. */
  wipe();
  const NOWBAR = Math.floor(Date.now() / 1000 / SEC) * SEC;
  const rows = [];
  for (let b = 0; b < 40; b++){
    rows.push(rec('weak', false, BAR0 + b * SEC, b % 4 === 0, 'L'));
    /* recommended: 40 settled at 3-in-4, and 40 genuinely still running */
    rows.push(rec('professional', true, BAR0 + b * SEC, b % 4 !== 0, 'H'));
    rows.push(Object.assign(rec('professional', true, NOWBAR - b * SEC, false, 'H2'),
                            { state: 'open' }));
  }
  write(rows);
  /* the distinction is real and worth pinning beside the counts */
  const staleRow = rec('professional', true, BAR0, false, 'OLD');
  staleRow.state = 'open';
  ok(S.hgFwdIsStale(staleRow, Math.floor(Date.now() / 1000)) === true,
     'a row stamped years ago with a 6-hour horizon reads as stale, not open');
  ok(S.hgFwdIsStale({ sym: 'H2', tf: '15m', state: 'open', barT: NOWBAR, horizonBars: HZ },
                    Math.floor(Date.now() / 1000)) === false,
     'while one stamped on the current bar is genuinely still running');
  const hq = S.__csFwdRead(true);
  ok(hq.settled === 40, 'the recommended population settled 40 records');
  ok(hq.open === 40, 'and carries 40 still open, counted separately (' + hq.open + ')');
  ok(Math.abs(hq.hit - 0.75) < 1e-9,
     'the hit rate is wins over SETTLED (' + (100 * hq.hit).toFixed(1)
     + '%), not over settled-plus-open — a desk is not worse for having positions on');
  ok(hq.hit > 0.5, 'which is well clear of what the wrong denominator would give (37.5%)');

  /* a population with NOTHING settled makes no claim at all */
  wipe();
  write(rows.map(r => r.ticket
    ? Object.assign({}, r, { state: 'open', barT: NOWBAR }) : r));
  const none = S.__csFwdRead(true);
  ok(none.settled === 0 && none.open === 80, 'an all-open population settles nothing');
  ok(!isFinite(none.hit), 'so it has no hit rate');
  ok(!isFinite(none.effN) && none.read === null,
     'and it is not put through an overlap correction or a pooled read at all — '
     + 'there is nothing to correct');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the sentence leads with the block the tab recommends');
{
  wipe(); write(buildDay());
  const v = S.csFwdVerdict();
  ok(v && v.hq, 'csFwdVerdict carries both populations');
  ok(v.settled > v.hq.settled, 'the flat fields stay the WHOLE-BOOK read, so old callers keep their meaning');

  const sentence = S.__csAccuracySentence(v);
  ok(/setups this tab RECOMMENDS/.test(sentence), 'the recommended block is named');
  ok(sentence.indexOf('RECOMMENDS') < sentence.indexOf('Across every record'),
     'and it comes FIRST, before the whole book');
  ok(new RegExp(v.hq.settled + ' at ').test(sentence), 'carrying the recommended count');
  ok(new RegExp(v.settled + ' at ').test(sentence), 'and the whole-book count beside it');
  ok(/40% breakeven/.test(sentence), 'against this tab\'s own 1.5R breakeven, not the helper\'s 2R');
  /* the clause is not just counts: it ends with what the pooled read MAKES of
     them, and a clause without that is a number with no verdict attached */
  const word = (v.hq.read && v.hq.read.read) ? v.hq.read.read : 'unjudged';
  ok(word && sentence.indexOf(word) > 0,
     'and each clause ends with the verdict the pooled read returned ("' + word + '")');
  ok((sentence.match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === 2,
     'once for the recommended block and once for the whole book');

  /* the honest empty case: recommended rows exist but none has settled */
  const nowBar = Math.floor(Date.now() / 1000 / SEC) * SEC;
  const open = buildDay().map(r => r.ticket
    ? Object.assign({}, r, { state: 'open', barT: nowBar }) : r);
  wipe(); write(open);
  const v2 = S.csFwdVerdict();
  ok(v2.settled > 0 && v2.hq.settled === 0, 'the whole book has settled rows and the recommended block has none');
  const s2 = S.__csAccuracySentence(v2);
  ok(/nothing has settled yet/.test(s2) && /no accuracy is claimed for them/.test(s2),
     'which is said plainly');
  ok(new RegExp('\\(' + v2.hq.open + ' still open\\)').test(s2),
     'naming how many of them are still running (' + v2.hq.open + ') rather than just going quiet');
  ok(!/RECOMMENDS — \d+ at/.test(s2),
     'and the pooled number is NOT quietly offered in its place');
  ok(/Across every record it has written/.test(s2),
     'though the whole book is still reported, labelled as what it is');

  /* nothing at all */
  wipe();
  ok(/nothing of its own has settled yet/.test(S.__csAccuracySentence(S.csFwdVerdict())),
     'an empty log still says so');
  ok(S.__csAccuracySentence(null).length > 0, 'and a null verdict does not throw');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the family bar counts the tiers that carry evidence');
{
  wipe();
  const rows = [];
  /* three tiers in the log, but only ONE of them is recommended */
  for (let b = 0; b < 40; b++){
    rows.push(rec('weak', false, BAR0 + b * SEC, b % 4 === 0, 'A'));
    rows.push(rec('standard', false, BAR0 + b * SEC, b % 3 === 0, 'B'));
    rows.push(rec('professional', true, BAR0 + b * SEC, b % 2 === 0, 'C'));
  }
  write(rows);
  const all = S.__csFwdRead(false), hq = S.__csFwdRead(true);
  ok(all.mechanics === 3, 'the whole book spans three tiers that carry settled records');
  ok(hq.mechanics === 1,
     'the recommended population spans one — a tier with nothing settled is not a family the reader chose between');
  const src = stripComments(SCAN);
  ok(/if \(\(st\.samples \|\| 0\) > 0\) families\+\+;/.test(src),
     'the count is of tiers with settled records, not of tiers that exist');
  ok(/W\.hgOmniFamilyZ\(Math\.max\(1, families\)\)/.test(src),
     'and that is what sets the multiple-comparison bar');

  /* end to end, through the footer the reader sees */
  wipe(); write(buildDay());
  const foot = text(S.csFooterNote([{ sym: 'X' }], 0, null, S.csFwdVerdict()));
  ok(/setups this tab RECOMMENDS/.test(foot), 'the rendered footer carries the recommended clause');
  ok(/not recommended for trading/.test(foot), 'beside the disclaimer it used to contradict');
  ok(foot.indexOf('RECOMMENDS') > foot.indexOf('not recommended for trading'),
     'the disclaimer is now followed by a measurement of the OTHER population, not of itself');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
