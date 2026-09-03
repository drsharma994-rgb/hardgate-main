#!/usr/bin/env node
/* HARDGATE — uniform combined crypto setup (hg-v588)
   Same composer + same card on OMNIROUTE + OMNIPRESENT.
   Every scanned contract is scored LONG vs SHORT from the Master Catalog
   (118 indicators + 85 strategies). One vote per CORE family. The
   combination with the most agrees wins and completes the setup only from
   an existing legal ticket. Never invents dir or levels. Not a win
   probability. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..') + '/';

let passed = 0, failed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok —', msg); }
  else { failed++; console.log('  FAIL —', msg); }
}

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'crypto-catalog.js', 'utf8'), { filename: 'crypto-catalog.js' });
const W = globalThis.window;

function longTicket(extra){
  return Object.assign({
    sym: 'BTCUSD', dir: 'long', kind: 'PO3',
    entry: 100, stop: 90, t1: 120, t2: 140,
    plan: { entry: 100, stop: 90, t1: 120, t2: 140, rr1: 2 },
    grade: { ticket: true, evaluated: 8, total: 10, letter: 'A' },
    catalogFamilyVotes: { Structure: 'agree', Trend: 'agree' },
    catalogExclude: false, demoted: false
  }, extra || {});
}

console.log('== exports ==');
ok(typeof W.hgCryptoUniformCompose === 'function', 'hgCryptoUniformCompose exported');
ok(typeof W.hgCryptoUniformHtml === 'function', 'hgCryptoUniformHtml exported');

console.log('\n== never invents dir or levels ==');
{
  const src = longTicket();
  const uni = W.hgCryptoUniformCompose([src], { desk: 'OMNIROUTE', tape: 'LONG' });
  ok(uni && uni.setup, 'compose returns a setup from the ticket list');
  ok(uni.setup.dir === 'long', 'compose keeps LONG');
  ok(+uni.setup.entry === 100 && +uni.setup.stop === 90 && +uni.setup.t1 === 120,
    'compose copies ticket levels verbatim');
  const flipped = W.hgCryptoUniformCompose([src], { desk: 'OMNIROUTE', tape: 'SHORT' });
  ok(flipped && !flipped.ok && !flipped.confirmed && !flipped.setup,
    'tape SHORT refuses a LONG candidate — does not invent a short');
}

console.log('\n== catalog exclude / GRID never confirmed ==');
{
  const grid = longTicket({ kind: 'GRID', catalogExclude: true, demoted: true });
  const uni = W.hgCryptoUniformCompose([grid], { desk: 'OMNIROUTE', tape: 'LONG' });
  ok(!uni.confirmed && !uni.ok, 'GRID / catalogExclude never confirmed');
}

console.log('\n== ≥2 CORE families required ==');
{
  const lone = longTicket({ catalogFamilyVotes: { Structure: 'agree' } });
  const one = W.hgCryptoUniformCompose([lone], { desk: 'OMNIPRESENT', tape: 'LONG' });
  ok(one.setup && one.families && one.families.length < 2,
    'one family is not enough');
  ok(!one.confirmed, 'one family is not confirmed');

  const many = longTicket();
  const two = W.hgCryptoUniformCompose([many], { desk: 'OMNIROUTE', tape: 'LONG' });
  ok(two.confirmed && two.ok && two.families.length >= 2,
    'Structure + Trend agree → confirmed');
}

console.log('\n== sides / no-ticket / drop ==');
{
  const badSide = longTicket({ t1: 80, plan: { entry: 100, stop: 90, t1: 80 } });
  const u1 = W.hgCryptoUniformCompose([badSide], { desk: 'OMNIROUTE', tape: 'LONG' });
  ok(!u1.confirmed && !u1.setup, 'LONG TP1 below entry is refused');

  const watch = longTicket({ grade: { ticket: false, evaluated: 6, total: 10 } });
  const u2 = W.hgCryptoUniformCompose([watch], { desk: 'OMNIPRESENT', tape: 'LONG' });
  ok(!u2.confirmed, 'WATCH / no ticket is not a confirmed setup');

  const drop = longTicket({ dropped: true });
  const u3 = W.hgCryptoUniformCompose([drop], { desk: 'OMNIROUTE', tape: '' });
  ok(!u3.setup, 'dropped candidate is ignored');
}

console.log('\n== HTML is uniform and honest ==');
{
  const many = longTicket();
  const uni = W.hgCryptoUniformCompose([many], { desk: 'OMNIROUTE', tape: 'LONG' });
  const html = W.hgCryptoUniformHtml(uni);
  ok(/data-hg-crypto-uniform="1"/.test(html), 'shared data-hg-crypto-uniform pin');
  ok(/grid-column:1\/-1/.test(html), 'full-width lead in the cards grid');
  ok(/CONFIRMED COMBINED SETUP/.test(html), 'confirmed title');
  ok(!/confirmed profitable/i.test(html), 'never prints confirmed profitable as a forecast');
  ok(/not a win probability/i.test(html), 'subtitle is not a win probability');
  ok(/100/.test(html) && /90/.test(html) && /120/.test(html), 'entry / stop / T1 from the ticket');
  ok(/OMNIROUTE/.test(html) || /OMNIPRESENT/.test(html) || /crypto catalog/i.test(html),
    'names the crypto catalog desks');

  const aside = W.hgCryptoUniformHtml(W.hgCryptoUniformCompose([], { desk: 'OMNIPRESENT', tape: 'LONG' }));
  ok(/STAND ASIDE/.test(aside) && /data-hg-crypto-uniform="1"/.test(aside),
    'empty list stands aside with the same pin');
  ok(!/CONFIRMED COMBINED SETUP/.test(aside), 'stand-aside is not titled confirmed');
}

console.log('\n== both desks paint the composer ==');
{
  const or = fs.readFileSync(root + 'omniroute.js', 'utf8');
  const op = fs.readFileSync(root + 'omnipresent.js', 'utf8');
  ok(/hgCryptoUniformCompose/.test(or) && /hgCryptoUniformHtml/.test(or),
    'OMNIROUTE paints the crypto uniform card');
  ok(/hgCryptoUniformCompose/.test(op) && /hgCryptoUniformHtml/.test(op),
    'OMNIPRESENT paints the crypto uniform card');
  ok(/data-hg-crypto-uniform/.test(or) || /hgOmniUniformLeadHtml/.test(or),
    'OMNIROUTE lead helper or pin');
  ok(/if \(snapRows\[i\]\) cands\.push\(snapRows\[i\]\)/.test(or),
    'OMNIROUTE feeds every snap row into the composer, not tickets only');
  ok(/opUniformLeadHtml\(ranked\.one/.test(op),
    'OMNIPRESENT feeds every ranked contract into the composer, not the carded top only');
  ok(/opUniformLeadHtml\(__op\.lastView\.one/.test(op),
    'OMNIPRESENT remount still composes from the full ranked list');
}

console.log('\n== applyVerdict scores both sides ==');
{
  const blank = { dir: 'long', kind: 'PO3' };
  W.hgCryptoCatalogApplyVerdict(blank, null);
  ok(blank.dir === 'long', 'applyVerdict never flips dir while scoring the other side');
  ok(blank.catalogSides && typeof blank.catalogSides.long === 'object'
    && typeof blank.catalogSides.short === 'object',
    'applyVerdict stamps LONG and SHORT combination tallies');
}

console.log('\n== winning combination across every contract ==');
{
  ok(typeof W.hgCryptoCatalogScoreSides === 'function', 'hgCryptoCatalogScoreSides exported');
  const scored = W.hgCryptoCatalogScoreSides([], {
    long:  { nFam: 3, nInd: 8, nStrat: 4, n: 3084, families: ['Structure', 'Trend', 'Flow'] },
    short: { nFam: 1, nInd: 2, nStrat: 0, n: 1020, families: ['Momentum'] }
  });
  ok(scored.winner === 'long' && scored.margin === 3084 - 1020,
    'scoreSides picks the combination with more families / indicators / strategies');

  const weak = longTicket({
    sym: 'ETHUSD',
    catalogFamilyVotes: { Structure: 'agree' },
    catalogSides: {
      winner: 'long',
      long:  { nFam: 1, nInd: 2, nStrat: 1, n: 1000, families: ['Structure'] },
      short: { nFam: 0, nInd: 0, nStrat: 0, n: 0, families: [] }
    }
  });
  const strong = longTicket({
    sym: 'BTCUSD',
    catalogFamilyVotes: { Structure: 'agree', Trend: 'agree', Flow: 'agree' },
    catalogSides: {
      winner: 'long',
      long:  { nFam: 3, nInd: 8, nStrat: 4, n: 3084, families: ['Structure', 'Trend', 'Flow'] },
      short: { nFam: 1, nInd: 2, nStrat: 0, n: 1020, families: ['Momentum'] }
    }
  });
  const uni = W.hgCryptoUniformCompose([weak, strong], { desk: 'OMNIROUTE', tape: 'LONG' });
  ok(uni && uni.setup && uni.setup.sym === 'BTCUSD',
    'the combination with more agreeing families/indicators/strategies wins');
  ok(uni.confirmed, 'winner with a legal ticket completes the setup');
  ok(uni.tally && uni.tally.long && uni.tally.long.nFam === 3,
    'tally records how many families made the winning side');
  ok(+uni.setup.t2 === 140, 'complete setup copies T2 from the winning ticket');

  const watchWin = longTicket({
    sym: 'SOLUSD',
    grade: { ticket: false, evaluated: 6, total: 10 },
    catalogSides: {
      winner: 'long',
      long:  { nFam: 5, nInd: 12, nStrat: 6, n: 5126, families: ['Structure'] },
      short: { nFam: 0, nInd: 0, nStrat: 0, n: 0, families: [] }
    }
  });
  const aside = W.hgCryptoUniformCompose([watchWin, weak], { desk: 'OMNIPRESENT', tape: 'LONG' });
  ok(aside && !aside.confirmed,
    'a watch-only winner does not invent a complete setup');
  ok(aside.tally && aside.tally.winner === 'long' && aside.tally.long.nFam === 5,
    'stand-aside still names the winning combination counts');

  const tied = longTicket({
    catalogSides: {
      winner: '',
      tie: true,
      long:  { nFam: 2, nInd: 4, nStrat: 2, n: 2042, families: ['Structure', 'Trend'] },
      short: { nFam: 2, nInd: 4, nStrat: 2, n: 2042, families: ['Flow', 'Momentum'] }
    }
  });
  const tieU = W.hgCryptoUniformCompose([tied], { desk: 'OMNIROUTE', tape: '' });
  ok(tieU && !tieU.confirmed && !tieU.setup, 'tied LONG vs SHORT combination stands aside');
  ok(/LONG and SHORT combinations tie/i.test(String(tieU.why || '')),
    'tie names both combinations instead of picking one');
}

console.log('\n== HTML names the winning combination ==');
{
  const strong = longTicket({
    catalogSides: {
      winner: 'long',
      long:  { nFam: 3, nInd: 8, nStrat: 4, n: 3084, families: ['Structure', 'Trend', 'Flow'] },
      short: { nFam: 1, nInd: 2, nStrat: 0, n: 1020, families: ['Momentum'] }
    }
  });
  const html = W.hgCryptoUniformHtml(W.hgCryptoUniformCompose([strong], { desk: 'OMNIROUTE', tape: 'LONG' }));
  ok(/WINNING COMBINATION|winning combination/i.test(html), 'card names the winning combination');
  ok(/3/.test(html) && /8/.test(html) && /4/.test(html), 'card prints family / indicator / strategy counts');
  ok(/140/.test(html), 'complete setup prints T2 from the ticket');
}

console.log('\n== stamp ==');
{
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  ok(swCacheOk(sw), 'sw cache matches stamp ' + HG_VER);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
