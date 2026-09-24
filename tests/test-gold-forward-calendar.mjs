/* HARDGATE — hg-v955: the gold calendar mark was written by eight files and
   read by none, and the forward ledger discarded it at the door.

   hg-v952 marked TAURIC's rows. hg-v953 marked the GOLD SCALP / GOLD SWING
   mints. hg-v954 marked GOLD DIRECTION's and GOLD ULTRA's ticket rows. Every
   one of those packs justified MARKING rather than withholding on the same
   grounds: the rows need the mark so the population can be SEPARATED later.

   The separation was impossible. `hgFwdNormalize` builds an explicit
   fifteen-key record and `goldShut` was not among them, so every mark was
   dropped on the way into storage. `hgFwdRecordScan` had its own explicit
   field list and dropped it a second time. And GOLD SCALP / GOLD SWING
   REBUILD the row in a .map() that dropped it a third time — so v953's mint
   mark never left the candidate either.

   That is hg-v932's finding ("the work was done and dropped on the way out"),
   and this time in my own packs. The precedent sits three fields above the
   hole: `mark` was accepted-but-never-forwarded for exactly this reason.

   THREE STATES, NOT TWO, is the design point. Every record written before
   this carries no mark, and reading "not shut" as "tradeable" would count the
   whole legacy ledger as gold-open — the same error one layer out, and
   exactly what made NEW GOLD's record read positive (hg-v949). `undefined`
   means NOT RECORDED, is counted separately, and never folds into either side.

   Covers:
     1) the field survives hgFwdNormalize, in all three states
     2) an absent mark stays absent — no substitute value
     3) hgFwdRecordScan forwards it
     4) GOLD SCALP / GOLD SWING carry the mint mark onto the row
     5) the aggregate folds tradeable and weekend separately
     6) unmarked records land in NEITHER fold
     7) the split reader reports three buckets and per-side R
     8) the panel renders nothing when no record carries the mark
     9) it reports and gates nothing
   Run: node tests/test-gold-forward-calendar.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function store(){
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null),
           setItem: (k, v) => m.set(k, String(v)),
           removeItem: k => m.delete(k), clear: () => m.clear(), _m: m };
}
function boot(files, opts){
  opts = opts || {};
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  if (opts.nowMs != null){
    const W = opts.nowMs;
    function FakeDate(...a){ return a.length ? new Date(...a) : new Date(W); }
    FakeDate.prototype = Date.prototype; FakeDate.now = () => W;
    FakeDate.parse = Date.parse; FakeDate.UTC = Date.UTC;
    ctx.Date = FakeDate;
  } else ctx.Date = Date;
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = store(); ctx.sessionStorage = store();
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of files){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch(e){ /* reported by the assertions below */ }
  }
  return ctx;
}

/* a bar time well in the past so records are settleable/prunable as normal */
const BAR = Math.floor(Date.UTC(2026, 3, 8, 12, 0, 0) / 1000);
function rec(over){
  return Object.assign({ tab: 'GOLDSCALP', mechanic: 'PROBE', sym: 'XAUUSD', tf: '15m',
    dir: 'long', entry: 2300, stop: 2290, t1: 2315, barT: BAR, horizonBars: 96 }, over || {});
}

/* SETTLE THROUGH THE STORE, not through a returned copy. hgFwdRecords parses
   localStorage on every call, so mutating what it hands back is discarded —
   the first cut of this guard did exactly that and two of its assertions
   passed on null === null. Write the settled state back under the module's
   own key, then assert the row count FIRST so nothing below can pass on an
   empty ledger. */
const LS_KEY = 'hg_forward_v1';
function settleAll(ctx, marks){
  const raw = JSON.parse(ctx.localStorage.getItem(LS_KEY) || '[]');
  for (const r of raw){
    const m = marks[r.mechanic];
    if (!m) continue;
    r.state = m.state; r.rr = 1.5;
  }
  ctx.localStorage.setItem(LS_KEY, JSON.stringify(raw));
  return raw.filter(r => r.state === 't1' || r.state === 'stop').length;
}

/* ---- 1+2) the field survives normalize, in all three states ---- */
const F = boot(['hg-forward.js']);
assert(typeof F.hgFwdRecord === 'function', 'hgFwdRecord is exported');
assert(typeof F.hgFwdRecords === 'function', 'hgFwdRecords is exported');
{
  assert(F.hgFwdRecord(rec({ mechanic: 'SHUT', goldShut: true })) === 'recorded', 'a shut row records');
  assert(F.hgFwdRecord(rec({ mechanic: 'OPEN', goldShut: false })) === 'recorded', 'an open row records');
  assert(F.hgFwdRecord(rec({ mechanic: 'BARE' })) === 'recorded', 'an unmarked row records');
  const all = F.hgFwdRecords('GOLDSCALP');
  const by = k => all.find(r => r.mechanic === k);
  assert(all.length === 3, 'REACHABILITY: three records are in the ledger (' + all.length + ')');
  assert(by('SHUT') && by('SHUT').goldShut === true,
    'NORMALIZE: goldShut:true survives into storage — the field hg-v952/v953/v954 were writing into a void');
  assert(by('OPEN') && by('OPEN').goldShut === false, 'NORMALIZE: goldShut:false survives as false');
  assert(by('BARE') && by('BARE').goldShut === undefined,
    'NO SUBSTITUTE: an unmarked row stays undefined — never coerced to false, which would read as gold-open');
  assert(!('goldShut' in by('BARE')) || by('BARE').goldShut === undefined,
    'an unmarked row carries no truthy mark of any kind');
  /* null is a caller saying nothing, not a caller saying open */
  F.hgFwdRecord(rec({ mechanic: 'NULLED', goldShut: null }));
  const n = F.hgFwdRecords('GOLDSCALP').find(r => r.mechanic === 'NULLED');
  assert(n && n.goldShut === undefined, 'a null mark reads as NOT RECORDED, not as open');
  /* ONLY THE TWO BOOLEANS. `=== true` alone reads a truthy 1 as FALSE, which
     is gold-OPEN — this field's own error arriving by coercion instead of by
     omission. `!!` fails the mirror, reading the string 'no' as shut. Both
     are caught here. */
  for (const [k, v] of [['ONE', 1], ['ZERO', 0], ['STR', 'no'], ['EMPTY', ''], ['OBJ', {}]]){
    F.hgFwdRecord(rec({ mechanic: k, goldShut: v }));
    const got = F.hgFwdRecords('GOLDSCALP').find(r => r.mechanic === k);
    assert(got && got.goldShut === undefined,
      'NEITHER BOOLEAN: goldShut=' + JSON.stringify(v) + ' reads as NOT RECORDED, never as open or shut');
  }
}

/* ---- 3) hgFwdRecordScan forwards it ---- */
{
  const S = boot(['hg-forward.js']);
  const n = S.hgFwdRecordScan('GOLDULTRA', '15m', [
    { sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2290, t1: 2315, mechanic: 'A', ticket: true, goldShut: true },
    { sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2290, t1: 2315, mechanic: 'B', ticket: true, goldShut: false },
    { sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2290, t1: 2315, mechanic: 'C', ticket: true }
  ], { horizonBars: 24 });
  assert(n === 3, 'REACHABILITY: hgFwdRecordScan wrote three rows (' + n + ')');
  const all = S.hgFwdRecords('GOLDULTRA');
  const by = k => all.find(r => r.mechanic === k);
  assert(by('A').goldShut === true && by('B').goldShut === false && by('C').goldShut === undefined,
    'SCAN ENTRY POINT: it forwards the mark — hg-v954 set this field and this function dropped it');
  assert(by('A').ticket === true, 'the row is still a ticket — the mark changes nothing else');
}

/* ---- 4) GOLD SCALP / GOLD SWING carry the mint mark onto the row ---- */
/* The .map() that builds the ledger row is lifted out of each desk and RUN,
   rather than grepped — the hg-v951 lesson. */
for (const [file, needle] of [['goldscalp.js', "W.hgFwdRecordScan('GOLDSCALP'"],
                              ['goldswing.js', "W.hgFwdRecordScan('GOLDSWING'"]]){
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const at = src.indexOf(needle);
  assert(at > 0, file + ': the record call is locatable');
  const mapAt = src.indexOf('.map(function(c){', at);
  assert(mapAt > at, file + ': the row-building map follows it');
  const retAt = src.indexOf('return {', mapAt);
  const endAt = src.indexOf('};', retAt);
  const body = src.slice(retAt, endAt + 2);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext('this.mk = function(c){ ' + body + ' };', sandbox, { filename: file + '-lift' });
  const shut = sandbox.mk({ dir: 'long', entry: 2300, stop: 2290, t1: 2315, stratKey: 'k', goldShut: true });
  const open = sandbox.mk({ dir: 'long', entry: 2300, stop: 2290, t1: 2315, stratKey: 'k', goldShut: false });
  const bare = sandbox.mk({ dir: 'long', entry: 2300, stop: 2290, t1: 2315, stratKey: 'k' });
  assert(shut.goldShut === true && open.goldShut === false && bare.goldShut === undefined,
    file + ': the lifted row builder carries the mint mark in all three states');
  assert(shut.entry === 2300 && shut.sym === 'XAUUSD', file + ': the rest of the row is unchanged');
}

/* ---- 5+6) the aggregate folds each side, and unmarked lands in NEITHER ---- */
/* The REAL fold is driven here. The first cut of this section grepped
   hg-forward.js for the two `if` lines — the brittle shape this session has
   corrected four times, and one that cannot see whether a branch is
   reachable. hgFwdFold is exported and called. */
{
  const A = boot(['hg-forward.js']);
  assert(typeof A.hgFwdFold === 'function', 'hgFwdFold is exported so the fold can be driven');
  const row = (mech, gs, state) => {
    const r = { tab: 'GOLDSWING', mechanic: mech, tf: '4h', dir: 'long',
                entry: 2300, stop: 2290, t1: 2315, rr: 1.5, barT: BAR, state: state };
    if (gs !== undefined) r.goldShut = gs;
    return r;
  };
  const recs = [row('M', true, 't1'), row('M', true, 'stop'),
                row('M', false, 't1'), row('M', false, 'stop'),
                row('M', undefined, 't1')];
  const agg = A.hgFwdFold({}, recs);
  const keys = Object.keys(agg);
  assert(keys.length === 1, 'REACHABILITY: the fold produced one aggregate row (' + keys.length + ')');
  const g = agg[keys[0]];
  assert(!!g, 'the aggregate row exists');
  assert(!!g.tr && !!g.wk, 'FOLD: both a tradeable and a weekend bucket were created');
  assert(g.tr.wins === 1 && g.tr.losses === 1,
    'FOLD: the tradeable bucket holds exactly the goldShut===false rows (' + g.tr.wins + 'W/' + g.tr.losses + 'L)');
  assert(g.wk.wins === 1 && g.wk.losses === 1,
    'FOLD: the weekend bucket holds exactly the goldShut===true rows (' + g.wk.wins + 'W/' + g.wk.losses + 'L)');
  const inBuckets = g.tr.wins + g.tr.losses + g.tr.expired + g.wk.wins + g.wk.losses + g.wk.expired;
  assert(inBuckets === 4,
    'UNMARKED IS IN NEITHER: 4 of the 5 rows landed in a bucket (' + inBuckets + ') — the unmarked row is in no fold');
  assert((g.wins || 0) + (g.losses || 0) + (g.expired || 0) === 5,
    'and all five still count in the unsplit total, so nothing is lost');

  /* STRICT equality proved by a row that is truthy-but-not-true */
  const odd = A.hgFwdFold({}, [row('N', true, 't1')]);
  const oddKey = Object.keys(odd)[0];
  assert(odd[oddKey].wk && odd[oddKey].wk.wins === 1, 'a true mark folds weekend');
  const loose = [{ tab: 'GOLDSWING', mechanic: 'N', tf: '4h', dir: 'long', entry: 2300,
                   stop: 2290, t1: 2315, rr: 1.5, barT: BAR, state: 't1', goldShut: 0 }];
  const lg = A.hgFwdFold({}, loose);
  const lk = Object.keys(lg)[0];
  assert(!lg[lk].tr && !lg[lk].wk,
    'STRICT: a goldShut of 0 is neither true nor false and folds into NEITHER bucket');
}

/* ---- 7) the split reader reports three buckets and per-side R ---- */
{
  const R = boot(['hg-forward.js']);
  assert(typeof R.hgFwdGoldCalendarSplit === 'function', 'hgFwdGoldCalendarSplit is exported');
  const marks = { W1: { state: 't1' }, W2: { state: 'stop' }, W3: { state: 'stop' },
                  T1: { state: 't1' }, T2: { state: 't1' }, T3: { state: 'stop' },
                  U1: { state: 't1' }, U2: { state: 'stop' } };
  for (const [m, gs] of [['W1', true], ['W2', true], ['W3', true],
                         ['T1', false], ['T2', false], ['T3', false],
                         ['U1', undefined], ['U2', undefined]])
    R.hgFwdRecord(rec({ tab: 'TAURIC', tf: '1h', mechanic: m, goldShut: gs }));
  const settled = settleAll(R, marks);
  assert(settled === 8, 'REACHABILITY: eight records are settled in the store (' + settled + ')');
  const sp = R.hgFwdGoldCalendarSplit('TAURIC');
  assert(!!sp, 'the split returned a result');
  assert(sp.shut === 3 && sp.open === 3 && sp.unmarked === 2,
    'SPLIT: 3 shut / 3 open / 2 unmarked (' + sp.shut + '/' + sp.open + '/' + sp.unmarked + ')');
  assert(sp.shutR !== null && sp.openR !== null,
    'REACHABILITY: both sides produced a number — neither is null');
  assert(Math.abs(sp.shutR - ((1.5 - 2) / 3)) < 1e-9,
    'SPLIT: weekend R is computed from its own rows (' + sp.shutR + ')');
  assert(Math.abs(sp.openR - ((3 - 1) / 3)) < 1e-9,
    'SPLIT: gold-open R is computed from its own rows (' + sp.openR + ')');
  assert(sp.shutR !== sp.openR, 'the two sides are genuinely different numbers on this fixture');

  /* the unmarked rows must NOT have moved either figure */
  const R2 = boot(['hg-forward.js']);
  for (const [m, gs] of [['W1', true], ['W2', true], ['W3', true],
                         ['T1', false], ['T2', false], ['T3', false]])
    R2.hgFwdRecord(rec({ tab: 'TAURIC', tf: '1h', mechanic: m, goldShut: gs }));
  assert(settleAll(R2, marks) === 6, 'REACHABILITY: six records settled without the unmarked pair');
  const sp2 = R2.hgFwdGoldCalendarSplit('TAURIC');
  assert(sp2.shutR !== null && sp2.openR !== null, 'REACHABILITY: the second fixture produced numbers too');
  assert(sp2.shutR === sp.shutR && sp2.openR === sp.openR && sp2.unmarked === 0,
    'UNMARKED CHANGES NEITHER FIGURE: dropping the two unmarked rows moves no number');

  const spNone = R.hgFwdGoldCalendarSplit('NOSUCHTAB');
  assert(spNone && spNone.shut === 0 && spNone.open === 0, 'an unknown tab reports zeroes rather than throwing');
}

/* ---- 8) the panel renders nothing when no record carries the mark ---- */
{
  const P = boot(['hg-forward.js']);
  assert(typeof P.hgFwdGoldCalendarHtml === 'function', 'hgFwdGoldCalendarHtml is exported');
  assert(P.hgFwdGoldCalendarHtml('GOLDSCALP') === '',
    'EMPTY IS NOT CLEAN: an unmarked ledger renders NOTHING, never "0 weekend trades"');
  P.hgFwdRecord(rec({ mechanic: 'U1' }));
  P.hgFwdRecord(rec({ mechanic: 'U2' }));
  assert(settleAll(P, { U1: { state: 't1' }, U2: { state: 'stop' } }) === 2,
    'REACHABILITY: two unmarked records are settled');
  assert(P.hgFwdGoldCalendarHtml('GOLDSCALP') === '',
    'a ledger of ONLY unmarked rows still renders nothing — unmarked is not evidence of either state');
  P.hgFwdRecord(rec({ mechanic: 'W1', goldShut: true }));
  P.hgFwdRecord(rec({ mechanic: 'T1', goldShut: false }));
  assert(settleAll(P, { U1: { state: 't1' }, U2: { state: 'stop' },
                        W1: { state: 't1' }, T1: { state: 'stop' } }) === 4,
    'REACHABILITY: four records are settled, two of them marked');
  const html = P.hgFwdGoldCalendarHtml('GOLDSCALP');
  assert(html && /GOLD CALENDAR SPLIT/.test(html), 'once a record carries the mark, the line renders');
  assert(/while gold was shut/.test(html), 'it names what it counted');
  assert(/carry no mark/.test(html) && /NEITHER/.test(html),
    'it names the unmarked rows and says they are counted as neither');
  assert(/Reported, not gated/.test(html), 'it says plainly that nothing is withheld on it');
}

/* ---- 9) it reports and gates nothing ---- */
{
  const G = boot(['hg-forward.js']);
  const before = G.hgFwdRecord(rec({ mechanic: 'X', goldShut: true }));
  assert(before === 'recorded', 'a weekend-formed row is still RECORDED — the mark withholds nothing');
  const all = G.hgFwdRecords('GOLDSCALP');
  assert(all.length === 1 && all[0].entry === 2300 && all[0].stop === 2290 && all[0].t1 === 2315,
    'its levels are untouched');
  /* and the gold note wires the split without disturbing its own verdict */
  /* accuracy-floor.js holds HG_ACCURACY_TABS, which is what maps a tab id to
     its ledger pools — without it the note has no pool to read. */
  const N = boot(['hg-forward.js', 'accuracy-floor.js', 'gold-forward-read.js']);
  assert(typeof N.hgGoldFwdNote === 'function', 'hgGoldFwdNote is exported');
  const note = N.hgGoldFwdNote('goldscalp');
  assert(typeof note === 'string', 'the note still renders a string with no records');
  assert(!/GOLD CALENDAR SPLIT/.test(note), 'and appends no split when nothing is marked');

  /* AND IT APPEARS WHEN THERE IS SOMETHING TO SAY. Asserting only the absent
     case let the whole wiring be deleted and still pass — mutation said so. */
  const pools = (typeof N.hgGoldFwdPools === 'function') ? (N.hgGoldFwdPools('goldscalp') || []) : [];
  assert(pools.length > 0, 'REACHABILITY: goldscalp maps to at least one ledger pool (' + pools.join(',') + ')');
  const pool = pools[0];
  for (const [m, gs] of [['W1', true], ['W2', true], ['T1', false], ['T2', false]])
    N.hgFwdRecord(rec({ tab: pool, mechanic: m, goldShut: gs }));
  assert(settleAll(N, { W1: { state: 't1' }, W2: { state: 'stop' },
                        T1: { state: 't1' }, T2: { state: 'stop' } }) === 4,
    'REACHABILITY: four marked records are settled in that pool');
  assert(N.hgFwdGoldCalendarHtml(pool) !== '', 'REACHABILITY: the split itself renders for that pool');
  const note2 = N.hgGoldFwdNote('goldscalp');
  assert(/GOLD CALENDAR SPLIT/.test(note2),
    'THE NOTE CARRIES THE SPLIT: the one seam every gold desk already renders now shows it');
  assert(/ITS OWN FORWARD LOG|HAS NOT MEASURED/.test(note2),
    'and the note keeps its own verdict — the split is appended, not substituted');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
