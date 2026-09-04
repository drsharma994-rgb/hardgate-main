#!/usr/bin/env node
/* HARDGATE — uniform combined gold setup (hg-v583)
   Same composer + same card on GOLD SCALP / GOLD SWING / OMNIGOLD.
   Never invents dir or levels. Confirmed only when ≥2 CORE families agree.
   "PAID" is the forward ledger read only — never a profit forecast. */
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
vm.runInThisContext(fs.readFileSync(root + 'indicators.js', 'utf8'), { filename: 'indicators.js' });
vm.runInThisContext(fs.readFileSync(root + 'indicators2.js', 'utf8'), { filename: 'indicators2.js' });
vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
vm.runInThisContext(fs.readFileSync(root + 'gold-catalog.js', 'utf8'), { filename: 'gold-catalog.js' });
const W = globalThis.window;

function longPlan(extra){
  return Object.assign({
    dir: 'long', entry: 2400, stop: 2380, t1: 2450, t2: 2480,
    grade: 'A', tally: 9, strategy: 'LIQUIDITY SWEEP REVERSAL',
    stratKey: 'sweep', kind: 'PDH-SWEEP',
    confluence: ['liquidity sweep', 'EMA ribbon pullback', 'RSI divergence'],
    stamps: ['CATALOG LIVE']
  }, extra || {});
}

console.log('== exports ==');
ok(typeof W.hgGoldUniformCompose === 'function', 'hgGoldUniformCompose exported');
ok(typeof W.hgGoldUniformHtml === 'function', 'hgGoldUniformHtml exported');
ok(typeof W.hgGoldUniformTape === 'function', 'hgGoldUniformTape exported');
ok(typeof W.hgGoldUniformAlignedBest === 'function', 'hgGoldUniformAlignedBest exported');

console.log('\n== never invents dir or levels ==');
{
  const src = longPlan();
  const uni = W.hgGoldUniformCompose([src], { horizon: 'SCALP', tape: 'LONG' });
  ok(uni && uni.setup, 'compose returns a setup from the engine list');
  ok(uni.setup.dir === 'long', 'compose keeps LONG');
  ok(uni.setup.entry === 2400 && uni.setup.stop === 2380 && uni.setup.t1 === 2450,
    'compose copies engine levels verbatim');
  const flipped = W.hgGoldUniformCompose([src], { horizon: 'SCALP', tape: 'SHORT' });
  ok(flipped && !flipped.ok && !flipped.confirmed && !flipped.setup,
    'tape SHORT refuses a LONG candidate — does not invent a short');
}

console.log('\n== REDUNDANT / AVOID / demoted never confirmed ==');
{
  const red = longPlan({ stratKey: 'testredun', catalogExclude: true, demoted: true });
  W.HG_GOLD_CATALOG_IND.push([999, 'Test redundant', 'L1', 1, 1, 'Momentum', 'REDUNDANT', '—', 'testredun']);
  const uni = W.hgGoldUniformCompose([red], { horizon: 'SCALP', tape: 'LONG' });
  W.HG_GOLD_CATALOG_IND.pop();
  ok(!uni.confirmed && !uni.ok, 'REDUNDANT/demoted never confirmed');
}

console.log('\n== ≥2 CORE families required ==');
{
  const lone = longPlan({
    stratKey: 'sweep', kind: 'PDH-SWEEP',
    confluence: ['liquidity sweep'],
    stamps: []
  });
  const one = W.hgGoldUniformCompose([lone], { horizon: 'SCALP', tape: '' });
  ok(one.setup && one.families && one.families.length < 2,
    'lone sweep has fewer than 2 CORE families');
  ok(!one.confirmed, 'one family is not confirmed');

  const many = longPlan();
  const two = W.hgGoldUniformCompose([many], { horizon: 'SCALP', tape: 'LONG' });
  ok(two.confirmed && two.ok && two.families.length >= 2,
    'sweep + ribbon + RSI = ≥2 CORE families → confirmed');
}

console.log('\n== sides / grade / drop ==');
{
  const badSide = longPlan({ t1: 2350 });
  const u1 = W.hgGoldUniformCompose([badSide], { horizon: 'SWING', tape: 'LONG' });
  ok(!u1.confirmed && !u1.setup, 'LONG TP1 below entry is refused');

  const gradeC = longPlan({ grade: 'C' });
  const u2 = W.hgGoldUniformCompose([gradeC], { horizon: 'SCALP', tape: 'LONG' });
  ok(!u2.confirmed, 'grade C is not confirmed');

  const lockedC = longPlan({ grade: 'C', locked: true });
  const u3 = W.hgGoldUniformCompose([lockedC], { horizon: 'SCALP', tape: 'LONG' });
  ok(u3.ok && u3.setup && u3.setup.entry === 2400, 'locked grade C may still be the pick');
  ok(!u3.confirmed, 'locked grade C is still not confirmed');

  const drop = longPlan({ dropped: true });
  const u4 = W.hgGoldUniformCompose([drop], { horizon: 'SCALP', tape: '' });
  ok(!u4.setup, 'dropped candidate is ignored');
}

console.log('\n== paid is measured, not promised ==');
{
  const many = longPlan();
  const unpaid = W.hgGoldUniformCompose([many], { horizon: 'SCALP', tape: 'LONG' });
  ok(unpaid.paid === false, 'paid is false without a forward ledger');
  W.hgOgForwardPaid = function(kind, horizon){
    return { read: 'has paid', samples: 40, tab: 'OMNIGOLD:' + horizon };
  };
  const paid = W.hgGoldUniformCompose([many], { horizon: 'SCALP', tape: 'LONG' });
  ok(paid.paid === true, 'paid is true only when forward ledger reads has-paid');
  delete W.hgOgForwardPaid;
}

console.log('\n== HTML is uniform and honest ==');
{
  const many = longPlan();
  const uni = W.hgGoldUniformCompose([many], { horizon: 'SCALP', tape: 'LONG' });
  const html = W.hgGoldUniformHtml(uni);
  ok(/data-hg-gold-uniform="1"/.test(html), 'shared data-hg-gold-uniform pin');
  ok(/grid-column:1\/-1/.test(html), 'full-width lead in the cards grid');
  ok(/CONFIRMED COMBINED SETUP/.test(html), 'confirmed title');
  ok(!/confirmed profitable/i.test(html), 'never prints confirmed profitable as a forecast');
  ok(/not a win probability/i.test(html), 'subtitle is not a win probability');
  ok(/2400/.test(html) && /2380/.test(html) && /2450/.test(html), 'entry / stop / T1 from the engine plan');
  ok(!/forward ledger has paid/.test(html), 'no PAID chip when ledger is empty');

  W.hgOgForwardPaid = function(){ return { read: 'has paid' }; };
  const paidHtml = W.hgGoldUniformHtml(W.hgGoldUniformCompose([many], { horizon: 'SCALP', tape: 'LONG' }));
  ok(/forward ledger has paid/.test(paidHtml), 'PAID chip only when measured');
  delete W.hgOgForwardPaid;

  const aside = W.hgGoldUniformHtml(W.hgGoldUniformCompose([], { horizon: 'SWING', tape: 'LONG' }));
  ok(/STAND ASIDE/.test(aside) && /data-hg-gold-uniform="1"/.test(aside),
    'empty list stands aside with the same pin');
  ok(!/CONFIRMED COMBINED SETUP/.test(aside), 'stand-aside is not titled confirmed');
}

console.log('\n== tape helper matches stack-agreement ==');
{
  const t0 = Math.floor(Date.UTC(2024, 5, 3, 12, 0) / 1000);
  const up = [];
  for (let i = 0; i < 80; i++)
    up.push({ t: t0 + i * 900, o: 2000 + i, h: 2002 + i, l: 1998 + i, c: 2001 + i, v: 80 });
  const tapeUp = W.hgGoldUniformTape(up);
  ok(tapeUp === 'LONG' || tapeUp === 'long', 'rising stack is LONG (got ' + tapeUp + ')');
  const pull = up.slice();
  const last = pull[pull.length - 1];
  pull[pull.length - 1] = { t: last.t, o: last.c, h: last.c, l: last.c - 8, c: last.c - 6, v: 80 };
  const tapePull = W.hgGoldUniformTape(pull);
  ok(tapePull === '' || tapePull === tapeUp,
    'a 1-bar dip in an UP stack is not SHORT (got ' + tapePull + ')');
}

function shortPlan(extra){
  return Object.assign({
    dir: 'short', entry: 2410, stop: 2430, t1: 2360, t2: 2330,
    grade: 'A', tally: 8, strategy: 'ADR EXHAUSTION FADE',
    stratKey: 'adrfade', kind: 'ADR-FADE',
    confluence: ['ADR fade', 'EMA ribbon pullback', 'RSI divergence'],
    stamps: ['CATALOG LIVE']
  }, extra || {});
}

console.log('\n== opposite-side SHORT is held, never confirmed ==');
{
  const long = longPlan();
  const short = shortPlan();
  const uni = W.hgGoldUniformCompose([long, short], { horizon: 'SCALP', tape: 'LONG' });
  ok(uni && uni.confirmed && uni.setup && uni.setup.dir === 'long',
    'confirmed combined setup stays LONG on an UP tape');
  ok(uni.setup.entry === 2400 && uni.setup.stop === 2380 && uni.setup.t1 === 2450,
    'confirmed levels stay the LONG engine plan');
  ok(uni.held && uni.held.dir === 'short',
    'compose keeps the legal SHORT as held (got ' + (uni.held && uni.held.dir) + ')');
  ok(uni.held.entry === 2410 && uni.held.stop === 2430 && uni.held.t1 === 2360,
    'held SHORT copies engine levels verbatim — does not invent a short');
  ok(uni.held !== uni.setup, 'held is a different plan than the confirmed setup');

  const html = W.hgGoldUniformHtml(uni);
  ok(/CONFIRMED COMBINED SETUP/.test(html), 'confirmed title still prints for the LONG');
  ok(/data-hg-gold-uniform-held="1"/.test(html), 'held SHORT block is tagged');
  ok(/HELD/.test(html) && /NOT CONFIRMED/.test(html),
    'held SHORT is labeled HELD · NOT CONFIRMED');
  ok(/2410/.test(html) && /2430/.test(html) && /2360/.test(html),
    'held SHORT ENTRY / STOP / T1 are printed');
  ok(/SHORT/.test(html), 'the word SHORT appears on the shared card');
  const heldChunk = html.split('data-hg-gold-uniform-held')[1] || '';
  ok(!/CONFIRMED COMBINED SETUP/.test(heldChunk),
    'held block never claims CONFIRMED COMBINED SETUP');
  ok(!/SETUP ACTIVATED/.test(html), 'uniform card never claims SETUP ACTIVATED');

  const onlyShort = W.hgGoldUniformCompose([short], { horizon: 'SCALP', tape: 'LONG' });
  ok(onlyShort && !onlyShort.confirmed && !onlyShort.setup,
    'a lone SHORT on an UP tape is not confirmed and does not invent a LONG');
  ok(onlyShort.held && onlyShort.held.dir === 'short' && onlyShort.held.entry === 2410,
    'the lone SHORT is still held with its own levels');
  const onlyHtml = W.hgGoldUniformHtml(onlyShort);
  ok(/STAND ASIDE/.test(onlyHtml) && /2410/.test(onlyHtml) && /HELD/.test(onlyHtml),
    'stand-aside still names the held SHORT trade');
  ok(!/CONFIRMED COMBINED SETUP/.test(onlyHtml),
    'lone against-tape SHORT is not titled confirmed');

  const noOpp = W.hgGoldUniformCompose([long], { horizon: 'SCALP', tape: 'LONG' });
  ok(!noOpp.held, 'no held SHORT is invented when none exists');
  const noOppHtml = W.hgGoldUniformHtml(noOpp);
  ok(!/data-hg-gold-uniform-held/.test(noOppHtml),
    'held block is omitted when there is no opposite plan');

  const aligned = W.hgGoldUniformAlignedBest([short, long], 'LONG');
  ok(aligned && aligned.dir === 'long', 'alignedBest on UP tape is the LONG, not the SHORT');
  const alignedNone = W.hgGoldUniformAlignedBest([short], 'LONG');
  ok(!alignedNone, 'alignedBest returns null when only a SHORT exists on an UP tape');
}

console.log('\n== three gold tabs share the composer ==');
{
  const gs = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const gw = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgGoldUniformCompose/.test(gs) && /hgGoldUniformHtml/.test(gs), 'GOLD SCALP wires composer');
  ok(/hgGoldUniformCompose/.test(gw) && /hgGoldUniformHtml/.test(gw), 'GOLD SWING wires composer');
  ok(/hgGoldUniformCompose/.test(og) && /hgGoldUniformHtml/.test(og), 'OMNIGOLD wires composer');
  ok(/hgGoldUniformAlignedBest/.test(gs) && /AGAINST GOLD TAPE/.test(gs),
    'GOLD SCALP tape-aligns MOST PROBABLE and stamps opposite cards');
  ok(/hgGoldUniformAlignedBest/.test(gw) && /AGAINST GOLD TAPE/.test(gw),
    'GOLD SWING tape-aligns MOST PROBABLE and stamps opposite cards');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const V = HG_VER.replace(/^hg-v/, '');
  const m = stamp.match(/version:\s*'([^']+)'/);
  ok(m && m[1] === HG_VER, 'stamp (got ' + (m && m[1]) + ')');
  ok(swCacheOk(sw), 'sw cache');
  ok(new RegExp('gold-catalog\\.js\\?v=' + V).test(html), 'index gold-catalog pin');
  ok(new RegExp('goldscalp\\.js\\?v=' + V).test(html)
    && new RegExp('goldswing\\.js\\?v=' + V).test(html)
    && new RegExp('omnigold\\.js\\?v=' + V).test(html), 'three gold tabs pinned');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
