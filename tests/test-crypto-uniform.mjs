#!/usr/bin/env node
/* HARDGATE — uniform combined crypto setup (hg-v586)
   Same composer + same card on OMNIROUTE + OMNIPRESENT.
   Uses the Master Catalog (118 indicators + 85 strategies): one vote per
   CORE family. Never invents dir or levels. Confirmed only when ≥2 CORE
   families agree on an existing ticket. Not a win probability. */
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
}

console.log('\n== stamp ==');
{
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  ok(swCacheOk(sw), 'sw cache matches stamp ' + HG_VER);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
