/* HARDGATE — the Silver Bullet windows keep the hour they are named after.

   hgGoldSessionBoundWindow decides whether the clock is inside one of two
   session-bound windows; GOLD SCALP mints `silverb` from it, GOLD SWING
   stamps SILVER BULLET, and the forming panel paints it on all three gold
   desks. Its edges were UTC constants, and the line beside the first one
   said what they were supposed to mean:

     var HG_GOLD_SB_LON_START = 7.0;   // UTC hours
     var HG_GOLD_SB_LON_END = 9.5;     // 09:30 - first 60-90 min after London open

   London opens at 08:00 London time. That is 07:00 UTC in BST and 08:00 UTC
   in GMT, so for the five months London spends on GMT this window opened an
   hour BEFORE the open it is named after and shut half an hour after it. The
   NY pair is the same shape against the 09:30 New York open: 12:00-13:30 UTC
   is 08:00-09:30 in EDT, the ninety minutes into the open, and 07:00-08:30 in
   EST, before the market is there.

   The numbers were the summer rendering of a local rule, written down as if
   they were the rule. They are the rule now: 08:00-10:30 London and
   08:00-09:30 New York, resolved per instant. Measured against the previous
   build at 30-minute steps across 2026, 1128 of 17520 verdicts change
   (6.4%), every one of them in the winter months and in six UTC hours;
   summer is byte-identical.

   The existing tests/test-gold-session-bound-sweep.mjs could never have
   caught this: its fixtures are all in June, where the old numbers were
   already right. That is checked below rather than asserted.

   NOT CHANGED: the session-weight table in hgGoldSessionGate, which is
   documented in UTC, means UTC, and is not internally consistent about a
   season anyway — its London pair reads winter-anchored and its NY pair
   summer-anchored. Section 5 measures its drift (20% of hours get a
   different name, 15% a different weight) and pins that it is still in UTC,
   so the number is recorded rather than quietly changed. Choosing one local
   anchor for it is a trading decision.

   Run: node tests/test-gold-silver-bullet-clock.mjs */
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

function boot(opts){
  opts = opts || {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, RegExp,
              parseInt, parseFloat, NaN, Infinity, Promise, Error, TypeError, RangeError,
              Set, Map, WeakMap, Symbol, Function, Boolean };
  s.Intl = Intl;
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = [];
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }), addEventListener(){} };
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  /* a vm context carries its own Intl whatever the sandbox says, so removing
     it takes a delete inside — the 859 lesson, kept */
  if (opts.noIntl) vm.runInContext('delete globalThis.Intl; delete this.Intl;', s);
  for (const f of ['indicators.js', 'indicators2.js', 'goldind.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const win = ms => (S.hgGoldSessionBoundWindow(ms) || {}).name || null;
/* the rule as it was: fixed UTC hours */
function winFixed(ms){
  const d = new Date(ms), h = d.getUTCHours() + d.getUTCMinutes() / 60;
  if (h >= 7 && h < 9.5) return 'LONDON_SB';
  if (h >= 12 && h < 13.5) return 'NY_SB';
  return null;
}

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the window is stated in local hours');
{
  ok(typeof S.hgGoldSbIn === 'function', 'hgGoldSbIn decides membership');
  ok(S.HG_GOLD_SB_LON_LOCAL_START === 8 && S.HG_GOLD_SB_LON_LOCAL_END === 10.5,
     'London 08:00-10:30 local — the open, and 60-90 minutes after it');
  ok(S.HG_GOLD_SB_NY_LOCAL_START === 8 && S.HG_GOLD_SB_NY_LOCAL_END === 9.5,
     'New York 08:00-09:30 local — up to the equity open');
  const src = stripComments(fs.readFileSync(root + 'goldind.js', 'utf8'));
  ok(/HG_GOLD_SB_LON_TZ\s*=\s*'Europe\/London'/.test(src)
     && /HG_GOLD_SB_NY_TZ\s*=\s*'America\/New_York'/.test(src),
     'each window names the zone it is anchored in');
  ok(!/h >= HG_GOLD_SB_LON_START/.test(src),
     'and the window no longer compares a UTC hour against the old constants');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. summer — the old numbers were already right, so nothing moves');
{
  let same = 0, n = 0;
  for (let ms = Date.UTC(2026, 6, 1); ms < Date.UTC(2026, 7, 1); ms += 1800000){
    n++;
    if (win(ms) === winFixed(ms)) same++;
  }
  ok(same === n, `all ${n} half-hours of July read exactly as the fixed-UTC rule did`);
  ok(win(Date.UTC(2026, 6, 17, 7, 15)) === 'LONDON_SB', 'July 07:15 UTC is 08:15 London — inside');
  ok(win(Date.UTC(2026, 6, 17, 6, 15)) === null, 'July 06:15 UTC is 07:15 London — outside');
  ok(win(Date.UTC(2026, 6, 17, 12, 15)) === 'NY_SB', 'July 12:15 UTC is 08:15 New York — inside');
  ok(win(Date.UTC(2026, 6, 17, 13, 45)) === null, 'July 13:45 UTC is 09:45 New York — past the open');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. winter — the hour the windows were missing');
{
  ok(win(Date.UTC(2026, 0, 16, 7, 15)) === null,
     'January 07:15 UTC is 07:15 London, before the open — outside now');
  ok(winFixed(Date.UTC(2026, 0, 16, 7, 15)) === 'LONDON_SB',
     '   ... and the fixed rule really did call it LONDON_SB, so this is the flip');
  ok(win(Date.UTC(2026, 0, 16, 8, 15)) === 'LONDON_SB', 'January 08:15 UTC is the open hour — inside');
  ok(win(Date.UTC(2026, 0, 16, 10, 15)) === 'LONDON_SB',
     'January 10:15 UTC is 10:15 London, still inside the 60-90 minutes');
  ok(winFixed(Date.UTC(2026, 0, 16, 10, 15)) === null, '   ... which the fixed rule had already shut');
  ok(win(Date.UTC(2026, 0, 16, 10, 45)) === null, 'and 10:45 London is past it');
  ok(win(Date.UTC(2026, 0, 16, 12, 15)) === null, 'January 12:15 UTC is 07:15 New York — too early now');
  ok(win(Date.UTC(2026, 0, 16, 13, 15)) === 'NY_SB', 'January 13:15 UTC is 08:15 New York — inside');
  ok(win(Date.UTC(2026, 0, 16, 14, 15)) === 'NY_SB', 'and 14:15 UTC is 09:15, still before the equity open');
  ok(win(Date.UTC(2026, 0, 16, 14, 45)) === null, 'while 09:45 New York is past it');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the whole year, and the fallback');
{
  let changed = 0, total = 0;
  const hours = {}, months = new Set();
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 1800000){
    total++;
    if (win(ms) !== winFixed(ms)){
      changed++;
      hours[new Date(ms).getUTCHours()] = 1;
      months.add(new Date(ms).getUTCMonth());
    }
  }
  ok(total === 17520, `${total} half-hours walked`);
  ok(changed === 1128, `${changed} verdicts differ from the fixed-UTC rule (${(changed / total * 100).toFixed(1)}%)`);
  const hl = Object.keys(hours).map(Number).sort((a, b) => a - b);
  ok(hl.length === 6 && hl.join(',') === '7,9,10,12,13,14',
     `and only in six UTC hours (${hl.join(', ')}) — no other hour of the year moved`);
  ok(!months.has(5) && !months.has(6) && !months.has(7),
     'none of them in June, July or August — which is why the June-dated fixtures in '
     + 'test-gold-session-bound-sweep.mjs could never have caught this');

  const bare = boot({ noIntl: true });
  ok(vm.runInContext('typeof Intl', bare) === 'undefined', 'a runtime with no Intl at all');
  let drift = 0;
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 1800000){
    const nm = (bare.hgGoldSessionBoundWindow(ms) || {}).name || null;
    if (nm !== winFixed(ms)) drift++;
  }
  ok(drift === 0, 'and without it every verdict falls back to the old UTC rule exactly');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the session-weight table, measured and left alone');
{
  const src = stripComments(fs.readFileSync(root + 'goldind.js', 'utf8'));
  const body = src.slice(src.indexOf('function hgGoldSessionGate'),
                         src.indexOf('function hgGoldSessionGate') + 1400);
  ok(/h >= 8 && h < 9/.test(body) && /LONDON_OPEN/.test(body),
     'hgGoldSessionGate still bands on a UTC hour, deliberately');
  /* the drift, recomputed here rather than quoted from the commit message */
  function off(ms, tz){
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date(ms)).find(x => x.type === 'timeZoneName').value;
    const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(p);
    return m ? (+m[1] + (m[2] ? Math.sign(+m[1]) * (+m[2] / 60) : 0)) : 0;
  }
  const fixed = h => h >= 8 && h < 9 ? 'LONDON_OPEN' : h >= 12 && h < 16 ? 'NY_OVERLAP'
                   : h >= 7 && h < 10 ? 'LONDON' : h >= 10 && h < 12 ? 'NY_AM'
                   : h >= 16 && h < 20 ? 'NY_PM' : h >= 0 && h < 8 ? 'ASIAN' : 'OFF';
  const local = ms => {
    const u = new Date(ms).getUTCHours();
    const lh = (u + off(ms, 'Europe/London') + 24) % 24, nh = (u + off(ms, 'America/New_York') + 24) % 24;
    return lh >= 8 && lh < 9 ? 'LONDON_OPEN' : nh >= 7 && nh < 11 ? 'NY_OVERLAP'
         : lh >= 7 && lh < 10 ? 'LONDON' : nh >= 5 && nh < 7 ? 'NY_AM'
         : nh >= 11 && nh < 15 ? 'NY_PM' : lh >= 0 && lh < 8 ? 'ASIAN' : 'OFF';
  };
  let diff = 0, n = 0;
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 3600000){
    n++;
    if (fixed(new Date(ms).getUTCHours()) !== local(ms)) diff++;
  }
  const pct = diff / n * 100;
  ok(pct > 15 && pct < 25,
     `read as local hours instead, ${diff} of ${n} hours (${pct.toFixed(1)}%) would carry a different `
     + 'session name — recorded, not changed, because that table is documented in UTC and means it');
}

console.log('\n' + passed + ' passed, ' + (process.exitCode ? 'see FAILs above' : '0 failed'));
