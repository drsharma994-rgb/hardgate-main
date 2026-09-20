/* HARDGATE — the empty state said "The other 0 were never read".

   Pack 869 built CRYPTO SCAN's empty state so a broken scan could not be
   reported as a quiet market, and its rule is: nothing is claimed about a
   contract that was never read.

   Pack 882 then added a counter for contracts that WERE read and voted on and
   whose scoring -- this app's own code, not the feed -- then threw, and folded
   it into `partial` without reaching this sentence. `partial` was what chose
   the wording. So a run where every contract was read and two crashed in
   scoring rendered:

     No setups — 300 of 300 contracts reached the engine and none produced a
     directional signal. The other 0 were never read, so nothing is claimed
     about them.
     COVERAGE · 300 of 300 contracts read (100%) · 2 read and voted, then
     scoring threw: TypeError: bad row (2)

   "The other 0 were never read" is not a sentence, and the line beneath it
   names two contracts the line above says nothing about -- the two lines
   contradict each other on one card.

   The deeper error is the claim. A contract whose scoring threw might well
   have produced a signal, so "none produced a directional signal" can no more
   be said of it than of one that was never fetched. The claim now covers the
   contracts actually JUDGED (read minus crashed), and each silence is named
   only when it happened.

   Run: node tests/test-cryptoscan-empty-accounting.mjs */
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
  for (const f of ['order-flow.js', 'liquidation-intelligence.js',
                   'cryptoscan-voting-v3.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');

/** an empty run, 300 contracts, with whatever went wrong overlaid */
const run = over => Object.assign({ universe: 300, scanned: 300, skipped: 0, errors: 0,
                                    unread: 0, setups: [] }, over || {});
const E = over => text(S.csEmptyHTML(run(over)));
/** just the sentence, without the COVERAGE line that follows it */
const sentence = over => E(over).split('COVERAGE')[0].trim();

/* ---------------------------------------------------------------- 1
   THE DEFECT: scoring crashes with nothing unread. */
{
  const t = sentence({ scoreFailed: 2, scoreWhy: { 'TypeError: bad row': 2 } });
  ok(!/The other 0/.test(t), 'no "The other 0" — that branch cannot be reached by an empty count');
  ok(!/0 were never read/.test(t), 'and nothing is described as zero contracts');
  ok(!/never read/.test(t), 'with nothing unread, the never-read clause is absent entirely');
  ok(/2 were read and voted on, then scoring threw/.test(t),
     'the two crashes are named: "' + t + '"');
  ok(/nothing is claimed about them/.test(t), 'and nothing is claimed about them');

  /* the claim shrinks to what was actually judged */
  ok(/298 of 300 contracts were judged/.test(t),
     '298, not 300 — a contract whose scoring threw was never judged');
  ok(!/300 of 300 contracts reached the engine and none produced/.test(t),
     'so the old over-claim is gone');

  /* and the sentence no longer contradicts the COVERAGE line under it */
  const full = E({ scoreFailed: 2, scoreWhy: { 'TypeError: bad row': 2 } });
  ok(/scoring threw/.test(full.split('COVERAGE')[0]) && /scoring threw/.test(full.split('COVERAGE')[1]),
     'both lines now mention the crashes, instead of one omitting what the other reports');
}

/* ---------------------------------------------------------------- 2
   Every other shape still reads correctly. */
{
  ok(/all 300 contracts were read and none produced a directional signal/.test(sentence({})),
     'a clean empty run is unchanged');
  ok(!/judged/.test(sentence({})), 'and does not gain vocabulary it does not need');

  const thin = sentence({ skipped: 40 });
  ok(/260 of 300 contracts were judged/.test(thin), '40 thin contracts leave 260 judged');
  ok(/40 were never read, so nothing is claimed about them/.test(thin), 'and are named');
  ok(!/scoring threw/.test(thin), 'with no crashes, that clause is absent');

  const both = sentence({ skipped: 40, scoreFailed: 3, scoreWhy: { 'Error: x': 3 } });
  ok(/257 of 300 contracts were judged/.test(both), '40 thin and 3 crashed leave 257 judged');
  ok(/40 were never read/.test(both) && /3 were read and voted on/.test(both),
     'both silences are named, separately');
  ok(both.indexOf('never read') < both.indexOf('scoring threw'),
     'in the order the scan met them');

  const none = sentence({ skipped: 300 });
  ok(/none of the 300 contracts could be read, so the engine never ran/.test(none),
     'nothing read at all still says the engine never ran');
  ok(/finding about the scan, not about the market/.test(none), 'in those words');

  /* everything read, everything crashed: the engine RAN, and we still know
     nothing — a case the old code had no branch for */
  const allCrash = sentence({ scoreFailed: 300, scoreWhy: { 'Error: x': 300 } });
  ok(/all 300 contracts that were read crashed during scoring/.test(allCrash),
     'all-crashed says so: "' + allCrash + '"');
  ok(/none of them was judged/.test(allCrash), 'and that none was judged');
  ok(/finding about the scan, not about the market/.test(allCrash),
     'which is a finding about the scan');
  ok(!/produced a directional signal/.test(allCrash),
     'it never claims anything about signals');

  ok(/has not run in this session yet/.test(S.csEmptyHTML(null)),
     'no run at all is still its own sentence');
}

/* ---------------------------------------------------------------- 3
   Singular and plural, and counts that cannot go negative. */
{
  const one = sentence({ scoreFailed: 1, scoreWhy: { 'Error: x': 1 } });
  ok(/1 was read and voted on/.test(one), 'one crash is singular');
  ok(/nothing is claimed about it\./.test(one), 'and refers to it, not them');
  ok(!/ either/.test(one), 'with no prior silence, there is no "either"');

  const oneThin = sentence({ skipped: 1 });
  ok(/1 was never read, so nothing is claimed about it\./.test(oneThin),
     'one unread contract is singular too');

  const chained = sentence({ skipped: 2, scoreFailed: 1, scoreWhy: { 'Error: x': 1 } });
  ok(/either\./.test(chained), 'and "either" appears only when something came before it');

  /* counts that overrun cannot produce a negative judged count */
  const absurd = sentence({ scanned: 10, universe: 10, scoreFailed: 99 });
  ok(!/-\d/.test(absurd), 'a scoreFailed larger than read never prints a negative');
  ok(absurd.length > 20, 'and still renders a sentence (' + absurd + ')');

  const nanRun = sentence({ scoreFailed: 'x' });
  ok(/all 300 contracts were read and none produced a directional signal/.test(nanRun),
     'an unreadable scoreFailed reads as zero, so the run is simply clean');
  ok(!/NaN/.test(nanRun) && !/undefined/.test(nanRun),
     'with no NaN or undefined anywhere in it');
  ok(!/NaN/.test(sentence({ skipped: null, errors: undefined, unread: '' })),
     'nor when the other counts are absent rather than zero');
}

/* ---------------------------------------------------------------- 4
   The wording is driven by counts, not by the partial flag. */
{
  const bare = stripComments(SCAN);
  ok(/var neverRead = c\.skipped \+ c\.errors \+ c\.unread;/.test(bare),
     'the never-read count is computed once and named');
  ok(/var judged = Math\.max\(0, c\.read - c\.scoreFailed\);/.test(bare),
     'and the judged count subtracts the crashes, floored at zero');
  ok(!/\} else if \(c\.partial\)\{/.test(bare),
     'the partial flag no longer chooses the wording');
  ok(/if \(neverRead\)\{/.test(bare) && /if \(c\.scoreFailed\)\{/.test(bare),
     'each clause is added only when its own count is non-zero');
  /* csCoverage still reports partial — it colours the COVERAGE line */
  ok(/partial: \(skipped \+ errors \+ unread \+ scoreFailed\) > 0/.test(bare),
     'partial itself is unchanged, and still includes scoring crashes');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
