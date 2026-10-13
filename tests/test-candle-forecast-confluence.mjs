/* HARDGATE — hg-v1314: the CANDLE FORECAST CONFLUENCE read.

   WHAT IT IS. CANDLE FORECAST could name a pattern, a side, a stop and two targets
   and read NOTHING else — no indicators, no core strategies, no fundamentals. So it
   could call a long on a hammer while the whole gold stack pointed the other way and
   it had no way to know. hgCfConfluence composes the SHARED readers (hg-v949: one
   home per derivation) and puts them beside the candle read.

   THE INVARIANTS THIS GUARD PROTECTS
     1. It COMPOSES — it re-derives no indicator, catalog or fundamental value.
     2. The vote is a COUNT of independent families, never a score, and there is no
        numeric threshold in it that anyone invented (hg-v966).
     3. UNREAD IS NEVER AGREEMENT. A dark feed cannot make a ticket easier, and it
        cannot make one harder either.
     4. It fails open: a missing reader is named, and the candle read survives.
     5. It is a READ. Nothing in it gates, scores or prices anything.

   Run: node tests/test-candle-forecast-confluence.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok - ' + m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = read('goldind.js');

function liftFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('could not lift ' + name + ' (renamed or deleted?)');
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced braces lifting ' + name);
}
function boot(files) {
  const ctx = {
    console, Math, Date, JSON, Number, String, Object, Array, RegExp, Error, TypeError, Promise,
    isFinite, isNaN, parseFloat, parseInt, Infinity, NaN,
    document: { createElement: () => ({ style: {}, innerHTML: '', appendChild() {}, setAttribute() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }), getElementById: () => null, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of files) {
    try { vm.runInContext(read(f), ctx, { filename: f }); } catch (e) { /* a leg may be absent */ }
  }
  return ctx;
}
const bar = (o, h, l, c, v) => ({ o, h, l, c, v: v || 1000, t: 0 });
/* a 120-bar tape with a named pattern at the end */
function tape() {
  const rows = []; let c = 2300;
  for (let i = 0; i < 110; i++) { c += (i % 4 === 0 ? -0.6 : 0.7); rows.push(bar(c - 0.4, c + 0.9, c - 1.0, c)); }
  rows.push(bar(c - 0.2, c + 2.2, c - 2.0, c + 2.0));
  rows.push(bar(c + 2.0, c + 2.6, c + 1.2, c + 1.4));
  rows.push(bar(c + 1.4, c + 4.2, c + 0.4, c + 4.0));
  return rows;
}

console.log('== 1) it COMPOSES the shared readers instead of re-deriving them ==');
{
  /* every reader it may use must be referenced by name, and it must not carry its
     own copy of any of their maths */
  ok(/hgGoldIndicatorReads/.test(SRC), 'it reads hgGoldIndicatorReads (the shared indicator bag)');
  ok(/hgGoldCatalogEngine/.test(SRC), 'it reads hgGoldCatalogEngine (the Master Catalog)');
  ok(/hgFundamentalRegime/.test(SRC), 'it reads hgFundamentalRegime (the shared fundamental stack)');
  const body = liftFn(SRC, 'hgCfConfluence');
  /* a re-derivation would need the raw maths; these are the tells */
  ok(!/function\s+\w*[Aa]tr|Math\.sqrt\(\s*14|smaOf|rsiOf/.test(body),
    'it defines no ATR / RSI / SMA maths of its own');
  ok(!/for\s*\([^)]*\)\s*\{[^}]*closes\[/.test(body), 'and no close-array loop that would be a second indicator home');
}

console.log('\n== 2) the vote is a COUNT of families, never a score ==');
{
  const body = liftFn(SRC, 'hgCfConfluence');
  ok(!/score|weight|points|rating/i.test(body.replace(/\/\*[\s\S]*?\*\//g, ' ')),
    'no score / weight / points / rating anywhere in the composer');
  ok(/familiesWith/.test(body) && /familiesAgainst/.test(body),
    'the verdict counts families WITH and AGAINST');
  const ticketLine = (body.match(/out\.ticket\s*=[^\n]*/) || [''])[0];
  ok(/famWith\s*>=\s*2/.test(ticketLine) && /famAgainst\s*===\s*0/.test(ticketLine) && /nPat\s*>\s*0/.test(ticketLine),
    'a ticket needs a named pattern, two families with the call, and none against (' + ticketLine.trim() + ')');
}

console.log('\n== 3) UNREAD is never counted as agreement ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js']);   /* NO catalog, NO fundamentals */
  const rows = tape();
  const fc = ctx.goldCandleForecast(rows);
  const cf = ctx.hgCfConfluence(rows, {}, fc);
  ok(cf.ok === true, 'the composer runs even with two readers absent');
  const strat = cf.voters.filter(v => v.family === 'strategies');
  const fund = cf.voters.filter(v => v.family === 'fundamentals');
  ok(strat.length && strat.every(v => v.lean === null), 'a missing catalog votes UNREAD, not WITH');
  ok(fund.length && fund.every(v => v.lean === null), 'a missing fundamental stack votes UNREAD, not WITH');
  ok(cf.missing.length >= 1, 'and the missing readers are NAMED (' + cf.missing.join(' | ') + ')');
  /* the decisive check: unread must not have been folded into the with count */
  const withFromVoters = cf.voters.filter(v => v.lean === true).length;
  ok(cf.with_ === withFromVoters, 'with_ equals the number of voters actually reading WITH (' + cf.with_ + ')');
  const unreadFromVoters = cf.voters.filter(v => v.lean === null).length;
  ok(cf.unread === unreadFromVoters, 'and unread_ equals the unread voters (' + cf.unread + ')');
}

console.log('\n== 4) all readers present: a real confluence, honestly tallied ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'gold-catalog.js', 'fundamental-stack.js', 'goldind.js']);
  const rows = tape();
  const fc = ctx.goldCandleForecast(rows);
  const cf = ctx.hgCfConfluence(rows, {}, fc);
  ok(cf.ok === true && cf.dir === fc.dir, 'the confluence takes the candle read\'s own direction (' + cf.dir + ')');
  ok(cf.familiesWith + cf.familiesAgainst <= 4, 'at most four families are counted');
  ok(cf.voters.length >= 4, 'every family is represented among the voters (' + cf.voters.length + ')');
  const fams = [...new Set(cf.voters.map(v => v.family))];
  ok(fams.indexOf('candles') >= 0 && fams.indexOf('technicals') >= 0
    && fams.indexOf('strategies') >= 0 && fams.indexOf('fundamentals') >= 0,
    'all four families vote: ' + fams.join(', '));
  /* the technicals must be real reads, not placeholders */
  const tech = cf.voters.filter(v => v.family === 'technicals');
  ok(tech.some(v => v.lean === true) || tech.some(v => v.lean === false),
    'the indicator bag produced at least one real directional read');
  /* hg-v1316: the bag carries 35 keys and this composer used to vote SIX. These four
     were added because each answers a question the six cannot — a state change, a
     bar-by-bar directional fight, and two persistence regimes. */
  const TECH_NAMES = tech.map(v => v.name);
  for (const n of ['squeeze release', 'DMI spread (+DI vs -DI)', 'Hurst regime', 'return autocorrelation']) {
    ok(TECH_NAMES.indexOf(n) >= 0, 'the bag now votes ' + JSON.stringify(n));
  }
  ok(tech.length >= 10, 'so the technical family carries at least ten reads (' + tech.length + ')');
  /* every one of them is three-state — an unread feed must never read as agreement */
  ok(tech.every(v => v.lean === true || v.lean === false || v.lean === null),
    'every technical voter is three-state (with / against / unread)');
  ok(cf.with_ === cf.voters.filter(v => v.lean === true).length,
    'and the with count still equals the voters actually reading WITH');
  /* the raw regime values, when the desk publishes them, ride beside the votes as
     disclosure rather than being folded into the tally */
  const cfl = cf.families.candles;
  ok(cfl && typeof cfl === 'object', 'the candle family bag is carried for context');
  const disclosedKeys = ['hurst', 'ac1', 'squeeze', 'volRegime', 'volumeRatio', 'atrRegime'].filter(k => k in cfl);
  ok(disclosedKeys.every(k => cfl[k] === null || cfl[k] === undefined || typeof cfl[k] === 'string' || typeof cfl[k] === 'number'),
    'any disclosed regime value is a plain scalar, never a nested vote (' + disclosedKeys.join(', ') + ')');
  ok(cf.why.length > 0, 'the verdict carries a stated reason (' + cf.why + ')');
  /* the catalog frame is disclosed, never turned into a side */
  const s = cf.voters.find(v => v.family === 'strategies');
  ok(s && s.lean === null, 'the Master Catalog frame never votes a side — it is a frame, not a direction');
  ok(cf.families.strategies && cf.families.strategies.usedN > 0,
    'but its USED / UNCHECKED counts are disclosed (' + (cf.families.strategies || {}).usedN + ')');
}

console.log('\n== 5) a NEUTRAL candle read confluences nothing ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'gold-catalog.js', 'fundamental-stack.js', 'goldind.js']);
  /* a dead-flat tape: the forecast is NEUTRAL, so there is no call to confluence */
  const flat = [];
  for (let i = 0; i < 60; i++) flat.push(bar(2300, 2301, 2299, 2300, 1000));
  const fc = ctx.goldCandleForecast(flat);
  ok(fc && fc.dir === 'NEUTRAL', 'the flat tape reads NEUTRAL');
  const cf = ctx.hgCfConfluence(flat, {}, fc);
  ok(cf.ok === true && cf.ticket === false, 'and the confluence issues no ticket');
  ok(/NEUTRAL/.test(cf.why), 'and says why rather than reporting zero agreement as disagreement (' + cf.why + ')');
}

console.log('\n== 6) it fails open and never throws ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js']);
  ok(ctx.hgCfConfluence(null, {}, null).ok === false, 'null rows -> ok:false, not a throw');
  ok(ctx.hgCfConfluence([], {}, null).ok === false, 'empty rows -> ok:false');
  /* no forecast handed in: the composer derives one itself rather than refusing,
     which is the more useful contract — assert THAT, not a refusal */
  const derived = ctx.hgCfConfluence(tape(), {}, null);
  ok(derived.ok === true && (derived.dir === 'BULL' || derived.dir === 'BEAR' || derived.dir === 'NEUTRAL'),
    'no forecast -> it derives the candle read itself (' + derived.dir + ')');
  let threw = false;
  try { ctx.hgCfConfluence(tape(), {}, { dir: 'BULL' }); } catch (e) { threw = true; }
  ok(!threw, 'a forecast with no pattern fields never throws');
}

console.log('\n== 7) it is a READ — wired, and gating nothing ==');
{
  ok(/window\.hgCfConfluence\s*=\s*hgCfConfluence/.test(SRC), 'the composer is exported beside the forecast');
  const tab = read('gold-candle-forecast.js');
  ok(/window\.hgCfConfluence\(candles/.test(tab), 'the tab calls it after the forecast');
  ok(/data-cf-confluence="1"/.test(tab), 'and renders a confluence block');
  ok(/data-cf-confluence="unread"/.test(tab), 'with a distinct unread state');
  ok(/CONFLUENCE READ/.test(tab) && /NOT A TICKET/.test(tab), 'short of a ticket it says so plainly');
  ok(/Unread is never counted as agreement/.test(tab), 'and the card states the unread rule to the reader');
  /* the tab must not compute any confluence value itself. Anchor the pattern so it
     matches an ASSIGNMENT to a bare identifier and not a read of `cfl.familiesWith` —
     the first version of this check matched the read and reported a defect that was
     not there. */
  ok(!/(^|[^.\w])(familiesWith|familiesAgainst|with_|against_)\s*=[^=]/.test(tab),
    'the tab computes no family tally of its own — it renders the composer\'s');
  ok(/cfl\.familiesWith/.test(tab), 'it reads the tally off the composer (' + 'cfl.familiesWith' + ')');
  ok(/hg-v1314/.test(SRC), 'the pack is identified in the source (hg-v956 textual pin)');
}

console.log('\ntest-candle-forecast-confluence: ' + pass + ' passed, 0 failed');
