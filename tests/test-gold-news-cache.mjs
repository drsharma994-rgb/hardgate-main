/* HARDGATE — the gold news gate reads the desk's calendar, it does not rewrite it.

   hgGoldNewsGate is the hard block that stops GOLD SCALP and GOLD SWING
   minting into CPI / NFP / FOMC / GDP (-30 min / +15 min). To do that it
   walks a list of events, and it built that list like this:

     var evs = hgGoldNewsEvents(news);
     if (Array.isArray(news.fomc)){
       for (...) evs.push(news.fomc[fi]);
     }

   hgGoldNewsEvents returned news.events BY REFERENCE, and news is the news.js
   module singleton — NEWS, the one the NEWS tab renders and newsRiskFromEvents
   walks for every crypto symbol. So every call of this read-only-looking gate
   appended the whole Fed calendar to the desk's live news cache.

   Measured on one real goldScalpSetups pass with a 16-row fomc list:

     events before the scan   2
     events after the scan    210     (13 gate calls x 16 rows = 208 appended)

   At the hardcoded 10-minute sweep that is 1,248 rows an hour from GOLD SCALP
   alone; GOLD SWING evaluates the same gate on the same cache. Sixty scans —
   ten hours of cycles — took the cache from 2 events to 12,482 and the scan
   from 22ms to 55ms, because every gate call re-walks the whole list running
   four regexes per row.

   The appended rows were unit-foreign as well. news.js stores t in SECONDS
   (it computes ev.t * 1000 wherever it reads one); api/fed-calendar.js emits
   epoch MS. After one scan the shared array held both. Nothing misreads them
   TODAY — all four readers of that array test ev.impact first and Fed rows
   carry no impact — so this is a latent mix, not a live misreading, and the
   test below pins both halves of that statement rather than assuming it.

   The gate's own verdict was never wrong: duplicated events lock the same way
   a single one does. What was wrong is that a reader wrote.

   Run: node tests/test-gold-news-cache.mjs */
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
/** The body of a top-level `function name(...)` declaration, comments removed. */
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

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, RegExp,
              parseInt, parseFloat, NaN, Infinity, Intl, Promise, Error, TypeError, RangeError,
              Set, Map, WeakMap, Symbol, Function, Boolean };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = [];
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }), addEventListener(){} };
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'goldind.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const GOLDIND = fs.readFileSync(root + 'goldind.js', 'utf8');

/* Thursday, NY overlap — deliberately away from the Friday gold close so the
   weekend gate plays no part in the scan measured in section 4. */
const NOW = Date.UTC(2026, 8, 17, 14, 0, 0);
const SEC = t => Math.floor(t / 1000);

/* The news.js cache shape: t in SECONDS, impact + country on every row. */
function newsCache(){
  return { loaded: true, calendarOk: true, at: NOW, headlines: [], fng: null, errors: [],
           events: [
             { title: 'US CPI m/m', impact: 'high', country: 'USD', t: SEC(Date.UTC(2026, 8, 10, 12, 30, 0)) },
             { title: 'Retail Sales m/m', impact: 'med', country: 'USD', t: SEC(Date.UTC(2026, 8, 22, 12, 30, 0)) }
           ] };
}
/* The /api/fed-calendar shape: t in epoch MS, no impact, no country. */
function fedCal(n){
  const fomc = [];
  for (let k = 0; k < (n || 16); k++){
    fomc.push({ title: 'FOMC Meeting ' + k, t: Date.UTC(2026, 9, 28, 18, 0, 0) + k * 86400000,
                type: 'FOMC', fomcDecision: true, source: 'federalreserve.gov/json/calendar.json' });
  }
  return { ok: true, at: NOW, fomc: fomc, events: fomc.slice(), counts: { events: fomc.length, fomc: fomc.length } };
}

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the gate, the reader, and the cache they are pointed at');
{
  ok(typeof S.hgGoldNewsGate === 'function', 'hgGoldNewsGate is reachable');
  ok(typeof S.hgGoldNewsEvents === 'function' || /function hgGoldNewsEvents\(/.test(GOLDIND),
     'hgGoldNewsEvents exists underneath it');
  ok(typeof S.hgGoldMergeFedFomc === 'function', 'and hgGoldMergeFedFomc, which the desks call first');

  const scalp = stripComments(fs.readFileSync(root + 'goldscalp.js', 'utf8'));
  const swing = stripComments(fs.readFileSync(root + 'goldswing.js', 'utf8'));
  ok(/hgNewsState/.test(scalp) && /hgGoldMergeFedFomc/.test(scalp),
     'GOLD SCALP feeds the gate hgNewsState() merged with the Fed calendar');
  ok(/hgNewsState/.test(swing) && /hgGoldMergeFedFomc/.test(swing),
     'GOLD SWING does the same — one shared cache, two desks');

  const newsSrc = stripComments(fs.readFileSync(root + 'news.js', 'utf8'));
  ok(/var NEWS = \{/.test(newsSrc) && /function hgNewsState\(\)\{ return NEWS; \}/.test(newsSrc),
     'hgNewsState() hands out the module singleton itself, not a snapshot');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the reader hands out a copy, never the live array');
{
  const n = newsCache();
  const a = S.hgGoldNewsEvents(n);
  ok(Array.isArray(a) && a.length === 2, 'object form: the two calendar rows come back');
  ok(a !== n.events, 'object form: and it is NOT the cache array');
  a.push({ title: 'scribble' });
  ok(n.events.length === 2, 'writing to what came back does not reach the cache');

  const bare = newsCache().events;
  const b = S.hgGoldNewsEvents(bare);
  ok(Array.isArray(b) && b.length === 2 && b !== bare, 'bare-array form is copied too');
  b.length = 0;
  ok(bare.length === 2, 'and emptying the copy leaves the original whole');

  ok(S.hgGoldNewsEvents(null).length === 0 && S.hgGoldNewsEvents({}).length === 0
     && S.hgGoldNewsEvents({ events: 'nope' }).length === 0,
     'nothing readable still yields an empty list, not a throw');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the gate does not write to the news object it was handed');
{
  const n = newsCache();
  const merged = S.hgGoldMergeFedFomc(n, fedCal(16));
  const before = n.events.length;
  for (let i = 0; i < 25; i++) S.hgGoldNewsGate(merged, NOW);
  ok(n.events.length === before, '25 gate calls leave the shared cache at ' + before + ' events');
  ok(n.events.every(e => String(e.t).length === 10),
     'and every t in it is still the seconds-wide value news.js wrote');
  ok(!n.events.some(e => e.fomcDecision), 'no Fed row leaked into the calendar the NEWS tab renders');

  const bare = newsCache().events;
  for (let i = 0; i < 25; i++) S.hgGoldNewsGate(bare, NOW);
  ok(bare.length === 2, 'the bare-array form is left alone as well');

  /* merged is a shallow copy, so merged.events still aliases the cache — that
     is only safe for as long as nothing on this path writes. Pin it. */
  ok(merged.events.length === before,
     'the merged object shares that array, and it is intact after all of it');
  ok(Array.isArray(merged.fomc) && merged.fomc.length === 16,
     'the Fed rows live on .fomc, where the gate reads them from');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. a real goldScalpSetups pass, which is where the 208 rows came from');
{
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const rows = []; let px = 4300;
  for (let i = 0; i < 480; i++){
    const o = px, c = px + (rnd() - 0.45) * 3.2;
    rows.push({ t: NOW - (480 - i) * 15 * 60 * 1000, o: o, c: c,
                h: Math.max(o, c) + rnd() * 2.0, l: Math.min(o, c) - rnd() * 2.0,
                v: 900 + rnd() * 1400 });
    px = c;
  }
  const n = newsCache();
  const merged = S.hgGoldMergeFedFomc(n, fedCal(16));
  const snap = JSON.stringify(n.events);

  const cands = S.goldScalpSetups({ rows15m: rows, now: NOW, news: merged });
  ok(Array.isArray(cands), 'the scan runs and returns its candidate list');
  ok(n.events.length === 2, 'one scan appends 0 rows to the cache (it appended 208)');
  ok(JSON.stringify(n.events) === snap, 'the cache is byte-identical to what it was before the scan');

  for (let cyc = 0; cyc < 12; cyc++) S.goldScalpSetups({ rows15m: rows, now: NOW, news: merged });
  ok(n.events.length === 2, 'twelve more scans — two hours of the 10-minute sweep — still 2 events');
  ok(JSON.stringify(n.events) === snap, 'and still byte-identical');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the verdict the gate was already giving is unchanged');
{
  const gate = (evs, fomc, at) => S.hgGoldNewsGate(
    { events: evs || [], fomc: fomc || [] }, at == null ? NOW : at);
  const cpi = ms => ({ title: 'US CPI m/m', impact: 'high', country: 'USD', t: SEC(ms) });

  ok(gate([cpi(NOW + 10 * 60 * 1000)]).lock === true, 'CPI 10 min out locks');
  ok(gate([cpi(NOW + 29 * 60 * 1000)]).lock === true, 'CPI 29 min out locks');
  ok(gate([cpi(NOW + 31 * 60 * 1000)]).lock === false, 'CPI 31 min out does not');
  ok(gate([cpi(NOW - 14 * 60 * 1000)]).lock === true, 'CPI 14 min ago still locks');
  ok(gate([cpi(NOW - 16 * 60 * 1000)]).lock === false, 'CPI 16 min ago is released');
  ok(/NEWS GATE/.test(gate([cpi(NOW)]).reason || ''), 'the lock names itself on the card');

  /* both unit conventions, because the two feeds disagree and the gate reads both */
  const ms = { title: 'FOMC Meeting', t: NOW + 5 * 60 * 1000, fomcDecision: true };
  ok(gate([], [ms]).lock === true, 'a Fed row on .fomc, t in epoch MS, locks');
  ok(/FOMC GATE/.test(gate([], [ms]).reason || ''), 'and it is stamped as the Fed calendar block');
  ok(gate([], [{ title: 'FOMC Meeting', t: NOW + 40 * 60 * 1000, fomcDecision: true }]).lock === false,
     'a Fed row 40 min out does not lock');
  ok(gate([{ title: 'US CPI m/m', impact: 'high', t: SEC(NOW + 5 * 60 * 1000) }]).lock === true,
     'a calendar row, t in seconds, locks on the same window');

  ok(gate([], [null, undefined, ms]).lock === true, 'falsy fomc rows are skipped, not counted');
  ok(gate([{ title: 'Building Permits', impact: 'med', t: SEC(NOW) }]).lock === false,
     'a non-tier-1 release at the same instant does not lock');
  ok(S.hgGoldNewsGate(null, NOW).unchecked === true, 'no news object at all reads unchecked');
  ok(S.hgGoldNewsGate({ events: [], fomc: [] }, NOW).lock === false,
     'an empty calendar does not invent a lock');

  /* growth used to be the only thing changing here — prove it never was */
  const n = newsCache();
  n.events.push(cpi(NOW + 5 * 60 * 1000));
  const merged = S.hgGoldMergeFedFomc(n, fedCal(16));
  const first = S.hgGoldNewsGate(merged, NOW);
  for (let i = 0; i < 40; i++) S.hgGoldNewsGate(merged, NOW);
  const last = S.hgGoldNewsGate(merged, NOW);
  ok(first.lock === true && last.lock === true && first.title === last.title,
     'the 42nd call gives the same verdict as the first');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the two lines, pinned in source');
{
  const reader = fnBody(GOLDIND, 'hgGoldNewsEvents');
  ok(reader.length > 0, 'hgGoldNewsEvents is a top-level declaration');
  ok(/news\.events\.slice\(\)/.test(reader) && /return news\.slice\(\)/.test(reader),
     'both of its array returns are copies');
  ok(!/return news\.events;/.test(reader) && !/return news;/.test(reader),
     'and neither hands out the caller argument itself');

  const g = fnBody(GOLDIND, 'hgGoldNewsGate');
  ok(g.length > 0, 'hgGoldNewsGate is a top-level declaration');
  ok(/evs = evs\.concat\(/.test(g), 'the gate builds its list with concat');
  ok(!/\bevs\.push\(/.test(g), 'and never pushes into it — this is the line that was the bug');
  ok(!/\.push\(/.test(g), 'the gate body contains no push at all');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. the unit mix that push created, and why nothing reads it wrong today');
{
  const newsSrc = stripComments(fs.readFileSync(root + 'news.js', 'utf8'));
  ok(/ev\.t\*1000|e\.t\*1000|\.t \* 1000/.test(newsSrc),
     'news.js multiplies t by 1000 — its calendar is in seconds');
  const fedSrc = stripComments(fs.readFileSync(root + 'api/fed-calendar.js', 'utf8'));
  ok(/const t = Date\.UTC\(/.test(fedSrc), 'api/fed-calendar.js emits Date.UTC — epoch ms');
  ok(!/impact/.test(fedSrc), 'and it sets no impact field on the rows it emits');

  /* every reader of NEWS.events gates on impact first, which is the only
     reason the ms rows never surfaced as a misread date. Named, not assumed. */
  ok(/ev\.impact !== 'high' && ev\.impact !== 'med'/.test(newsSrc),
     'newsRiskFromEvents skips anything without high/med impact');
  ok(/e\.impact === 'high' \|\| e\.impact === 'med'/.test(newsSrc),
     "the NEWS tab timeline filters on impact and country === 'USD'");
  const caution = fnBody(GOLDIND, '__newsCaution');
  ok(/ev\.impact !== 'high'/.test(caution), 'goldNewsCaution skips anything not high impact');
  const swing = stripComments(fs.readFileSync(root + 'goldswing.js', 'utf8'));
  ok(/ev\.impact !== 'high'/.test(swing), "GOLD SWING's own fallback loop does the same");

  /* and the gate itself reads both conventions, which is why its verdict was
     never the thing that was wrong */
  ok(/< 1e12/.test(fnBody(GOLDIND, 'hgGoldNewsGate')),
     'the gate normalises seconds and ms with the 1e12 split before comparing');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
