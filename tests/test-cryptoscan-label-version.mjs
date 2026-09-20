/* HARDGATE — the forward log pooled tiers computed by four different rules.

   hg-forward.js pools settled records by tab + mechanic (hgFwdKey, hgFwdStats)
   and splits `ticketOnly` INSIDE a mechanic. So "VOTE-PROFESSIONAL, n=40,
   +0.3R" is evidence about one thing only if all forty rows were labelled by
   the same rule.

   They were not. The pipeline producing voteTier and isHighQuality has changed
   four times, and every change moved which setups land in which bucket:

     v1  the original three-layer blend
     v2  pack 863 — sentiment taken relative to the trade. Shorts had been
         scored with the raw market sign, so a bullish read PROMOTED a short;
         37 of 200 swept shorts held the pro-grade bar only on that.
     v3  pack 864 — order flow taken relative to the trade, and a neutral
         reading stopped counting as dissent. 166 of 6,840 cells changed tier
         and shouldTrade.
     v4  pack 865 — a sentiment row past its own ttl scores 0 and no longer
         gates. 144 of 280 BTC/ETH/SOL cells changed tier.
     v5  pack 877 — layer 2 reads the same CLOSED bars layer 1 voted on rather
         than the raw fetch. 34 of 476 swept cells changed tier, 27 changed
         shouldTrade, 9 changed PROFESSIONAL-GRADE. v1–v4 labels had also read
         a bar inside their own record's settlement window.

   v5 is also why section 3's hash now covers the TAPE each layer is handed,
   not only the arithmetic applied to it. The v5 change moved 7.1% of tiers
   without touching a single hashed byte, because it is entirely upstream of
   the formula — a guard that only watches the formula would have let it past.

   Records written under v1 sit in a live tab's localStorage pooling with v5
   records under identical keys, and nothing marked them. This repo already
   knew the answer: hg-forward.js writes `solV`, "the stamp version", beside
   the solidity score for exactly this reason.

   The version now rides in the mechanic, which IS the pooling key. And because
   a version nobody remembers to bump is worse than none, section 3 hashes the
   label pipeline and fails when it moves — so the decision is made on purpose.

   Run: node tests/test-cryptoscan-label-version.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
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
function fnBody(src, name){
  const s = stripComments(src);
  const at = s.indexOf('\nfunction ' + name + '(');
  if (at < 0) return '';
  const open = s.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < s.length; i++){
    if (s[i] === '{') depth++;
    else if (s[i] === '}'){ depth--; if (!depth) return s.slice(open, i + 1); }
  }
  return '';
}
const norm = s => String(s).replace(/\s+/g, ' ').trim();

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.fetch = () => Promise.reject(new Error('no network in tests'));
  vm.createContext(s);
  for (const f of ['sentiment.js', 'order-flow.js', 'liquidation-intelligence.js',
                   'cryptoscan-voting-v3.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const VOTE = fs.readFileSync(root + 'cryptoscan-voting-v3.js', 'utf8');
const SENT = fs.readFileSync(root + 'sentiment.js', 'utf8');
const FWD  = fs.readFileSync(root + 'hg-forward.js', 'utf8');

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the mechanic IS the pooling key, so the label belongs in it');
{
  const fwd = stripComments(FWD);
  ok(/\[rec\.tab, rec\.mechanic, rec\.sym, rec\.dir, rec\.barT\]\.join\('\|'\)/.test(fwd),
     'hgFwdKey keys a record on tab + mechanic + sym + dir + bar');
  ok(/function hgFwdStats\(list, tab, mechanic, ticketOnly/.test(fwd),
     'and hgFwdStats pools per mechanic, with ticketOnly splitting INSIDE one');
  ok(/solV/.test(FWD) && /the stamp version/.test(FWD),
     'this repo already versions a score that can be recomputed: solV');

  ok(typeof S.CS_LABEL_V === 'number' && S.CS_LABEL_V >= 1,
     'CRYPTO SCAN publishes a label version (v' + S.CS_LABEL_V + ')');
  ok(S.CS_LABEL_V === 5, 'which is 5 — four bumps, packs 863, 864, 865 and 877');
  ok(/pack 863/.test(SCAN) && /pack 864/.test(SCAN) && /pack 865/.test(SCAN),
     'and the changelog beside it names each one');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the version rides the key, and nothing else moved');
{
  const mk = (sym, tier, hq) => ({ sym: sym, dir: 'long', voteTier: tier, isHighQuality: hq,
                                   plan: { entry: 100, stop: 95, t1: 110 } });
  const rows = S.__csFwdRows([mk('A', 'professional-grade', true), mk('B', 'weak', false)]);
  ok(rows.length === 2, 'both rows still record');
  ok(rows[0].mechanic === 'VOTE-PROFESSIONAL-GRADE@V' + S.CS_LABEL_V,
     'the longest tier carries the version (' + rows[0].mechanic + ')');
  ok(rows[0].mechanic.length <= 28,
     'and fits the 28 characters hgFwdNormalize keeps (' + rows[0].mechanic.length + ')');
  ok(/28/.test(stripComments(SCAN).match(/slice\(0, 28\)/) ? '28' : ''),
     'the slice that enforces it is still there');
  ok(rows[0].ticket === true && rows[1].ticket === false,
     'the ticket split is untouched — it is applied inside a mechanic, so the key protects it');
  ok(rows[0].entry === 100 && rows[0].stop === 95 && rows[0].t1 === 110,
     'and the levels are unchanged');

  /* the point of the whole thing: two versions cannot pool */
  const older = 'VOTE-WEAK@V' + (S.CS_LABEL_V - 1);
  ok(rows[1].mechanic !== older, 'an older-version row and a current one do not share a key');
  ok(S.__csFwdRows([mk('C', null, false)])[0].mechanic === 'VOTE-WEAK@V' + S.CS_LABEL_V,
     'a missing tier still defaults to weak, versioned');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the pipeline is hashed, so the version cannot be forgotten');
{
  /* Everything that decides voteTier or isHighQuality. If any of it changes,
     someone has to decide whether the change moves setups between buckets. */
  const pieces = [
    fnBody(VOTE, 'hgComputeThreeLayerConfidence'),
    fnBody(VOTE, 'hgIsProGradeSetup'),
    fnBody(SENT, 'hgSentimentGet'),
    fnBody(SENT, 'hgSentimentScoreSignal'),
    fnBody(SENT, 'hgSentimentGate'),
    (stripComments(SCAN).match(/addGate\('[a-z]+',[^;]*\);/g) || []).join('\n'),
    (stripComments(SCAN).match(/isHighQuality: [^\n]*/g) || []).join('\n'),
    (stripComments(SCAN).match(/var sentimentLive = [^\n]*/g) || []).join('\n'),
    (stripComments(SCAN).match(/var liquidHour = [^\n]*/g) || []).join('\n'),
    /* WHICH BARS each layer is handed. Pack 877 moved 34 of 476 tiers without
       touching one byte above: it changed layer 2's tape, not its arithmetic.
       A guard that watches only the formula is blind to exactly the class of
       change that caused this file to exist. */
    fnBody(SCAN, 'csTrimToBar'),
    fnBody(SCAN, 'csClosedRows'),
    (stripComments(SCAN).match(/var closed1?5?h? = cs(TrimToBar|ClosedRows)\([^\n]*/g) || []).join('\n'),
    (stripComments(SCAN).match(/hgOrderFlowScore\([^\n]*/g) || []).join('\n')
  ];
  ok(pieces.every(p => p && p.length > 10),
     'every piece of the label pipeline was found (' + pieces.map(p => p.length).join(', ') + ')');

  const hash = crypto.createHash('sha256').update(pieces.map(norm).join('\u0000')).digest('hex').slice(0, 16);
  const RECORDED = '246775bbe517d7db';
  if (hash !== RECORDED){
    /* the guidance belongs on the failure path only — a guard that prints a
       wall of instructions every green run trains people to skip its output */
    console.error('\n       The code that decides a setup\'s tier or its HIGH-QUALITY flag has');
    console.error('       changed. Ask whether the change moves setups between buckets.');
    console.error('       If it does: bump CS_LABEL_V in cryptoscan.js AND record the new');
    console.error('       hash here, so old records stop pooling with new ones.');
    console.error('       If it provably cannot (a rename, a reworded string): record the');
    console.error('       new hash alone and say why in the commit.');
    console.error('       recorded ' + RECORDED);
    console.error('       now      ' + hash + '\n');
  }
  ok(hash === RECORDED,
     'the label pipeline still hashes to what was recorded for v' + S.CS_LABEL_V
     + ' (' + RECORDED + ')');

  /* the guard has to be able to fail, or it is decoration */
  const mutated = pieces.slice();
  mutated[0] = mutated[0].replace('0.40', '0.41');
  const mutHash = crypto.createHash('sha256').update(mutated.map(norm).join('\u0000')).digest('hex').slice(0, 16);
  ok(mutHash !== hash, 'changing one weight in the blend changes the hash');
  const cosmetic = pieces.slice();
  cosmetic[0] = '  ' + cosmetic[0].replace(/\n/g, '\n  ') + '\n';
  const cosHash = crypto.createHash('sha256').update(cosmetic.map(norm).join('\u0000')).digest('hex').slice(0, 16);
  ok(cosHash === hash, 'while reindenting it does not — comments and whitespace are stripped first');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. what the version is claimed to cover is actually there');
{
  const vote = fnBody(VOTE, 'hgComputeThreeLayerConfidence');
  ok(/l3Aligned \* 0\.25/.test(vote), 'v2: sentiment enters aligned to the trade');
  ok(/l2Aligned \* 0\.35/.test(vote), 'v3: so does order flow');
  ok(/l2Dir/.test(vote), 'v3: and a neutral flow is not read as dissent');
  const get = fnBody(SENT, 'hgSentimentGet');
  ok(/stale: !fresh \|\| !!entry\.stale/.test(get), 'v4: a row past its ttl reads stale');
  ok(/sentiment\.stale/.test(fnBody(SENT, 'hgSentimentScoreSignal')), 'v4: and is not scored');
  ok(/sentiment\.stale/.test(fnBody(SENT, 'hgSentimentGate')), 'v4: nor gated on');
  ok(/sentimentLive = \(sentiment && sentiment\.stale\) \? 0/.test(stripComments(SCAN)),
     'v4: and the tab feeds the blend a zero for it');
  const bare = stripComments(SCAN);
  ok(/hgOrderFlowScore\(\s*item\.sym\s*,\s*closed15\s*,\s*closed1h\s*\)/.test(bare),
     'v5: layer 2 is handed the trimmed tapes');
  ok(!/hgOrderFlowScore\([^)]*rows1?5?h?m?\b[^)]*\)/.test(bare.replace(/closed1?5?h?/g, 'X')),
     'v5: and never the raw fetch');
  ok(/var closed15 = csTrimToBar\(rows15m, res\.bar/.test(bare),
     'v5: the 15m tape ends on the bar layer 1 voted on');
  ok(/var closed1h = csClosedRows\(rows1h \|\| \[\], 3600, now\)/.test(bare),
     'v5: the 1h tape ends on the last closed hour');
  ok(/var smcRows = closed15;/.test(bare), 'v5: SMC shares that same tape');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
