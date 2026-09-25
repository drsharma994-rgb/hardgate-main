/* HARDGATE -- hg-v981: the forward ledger's fill model never received a mark
   from the crypto desks that record, and the bar most of them read was the
   floor of the scan clock.

   hgFwdSettleFill settles a record AS IF THE ORDER HAD TO FILL FIRST and
   needs one field to tell a resting order from a market one: `mark`, the
   price when the plan fired (hgFwdOrderType returns null without it). hg-v980
   forwarded it from every gold desk. On the crypto side CRYPTO SCAN,
   CRYPTOVERSE and 90PERCENT carried it; OMNIROUTE, OMNIPRESENT, SQUEEZE,
   OI FLOW, EDGE, REVERSAL SNIPER, BRAIN, the GATES tab, DEX SCREENER,
   TRENDMX, PINE (both lanes), CONTRACT REPORT and the inline CARD choke
   point (SMC, ORDER BLOCKS, TRAP, DIV, COIL, APEX) passed none -- and all but
   OMNIROUTE passed no bar either (hg-v978's defect: dated on the clock floor,
   first bar of the trade skipped, one firing recorded twice across two clock
   minutes).

   What it cost, on the repo's own evidence: OMNIROUTE prices ENTRY at the
   setup level, not the last close (hg-v424), so every plan RESTS. In its
   committed replay (scripts/backtest-omniroute-v531-results.json) 4,353
   plans opened, 1,495 EXPIRED UNFILLED (34.3%), and of the 2,832 that
   filled NOT ONE filled on its signal bar (barsToFill >= 1 on every row;
   1,459 -- 51.5% -- filled after the first bar). The live ledger settled
   every one of those records as a market order from the signal bar.

   Run: node tests/test-crypto-ledger-fill-mark.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let passed = 0;
function assert(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function strip(src){
  return String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
function boot(files, clock){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Intl, parseInt, parseFloat,
              NaN, Infinity, RegExp, Promise, Error, TypeError, Set, Map };
  s.Date = clock ? new Proxy(Date, { construct(T, a){ return a.length ? new T(...a) : new T(clock.now); },
                                     get(T, k){ return k === 'now' ? () => clock.now : T[k]; } }) : Date;
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = (f) => 0; s.clearTimeout = () => {}; s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){},
                                         querySelector: () => null, querySelectorAll: () => [] }),
                 head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.fetch = () => Promise.reject(new Error('no network in tests'));
  vm.createContext(s);
  for (const f of files) vm.runInContext(read(f), s, { filename: f });
  return s;
}
const WED = Date.UTC(2026, 3, 8, 12, 0, 0), SEC = WED / 1000;
/* a 1h continuation tape after WED: never dips to `never`, reaches `hit` from bar 3 */
function tape(n, o){
  const out = [];
  for (let i = 0; i < n; i++) out.push({ t: SEC + (i + 1) * 3600, o: o.o, h: i >= 3 ? o.hHi : o.h, l: o.l, c: o.c, v: 1 });
  return out;
}

console.log('== 1) the reader every crypto record map now calls, driven on every shape of series ==');
{
  const W = boot(['hg-forward.js']);
  const lb = W.hgFwdLastBar;
  assert(typeof lb === 'function', 'hgFwdLastBar is exported by hg-forward.js');
  const good = lb([{ t: 10, c: 1 }, { t: 3600, o: 99, h: 101, l: 98, c: 100.5, v: 3 }]);
  assert(good.mark === 100.5 && good.barT === 3600, 'a series yields the LAST bar\'s close as the mark and its open time as the bar');
  /* a NUMERIC string close is unreadable too: +'100' would coerce it, and the
     mutation pass found the first cut accepting it (the +null trap's cousin) */
  for (const bad of [null, undefined, [], 'x', 5, {}, [null], [{}], [{ t: 3600, c: null }], [{ t: 3600, c: 'x' }], [{ t: 3600, c: '100' }], [{ t: 3600, c: 0 }], [{ t: 3600, c: -2 }]]){
    const r = lb(bad);
    assert(r && r.mark === undefined, 'no readable close -> mark undefined, never zero (' + JSON.stringify(bad) + ')');
  }
  for (const bad of [[{ t: null, c: 5 }], [{ t: 0, c: 5 }], [{ t: 'x', c: 5 }], [{ c: 5 }]]){
    assert(lb(bad).barT === undefined && lb(bad).mark === 5, 'no readable time -> barT undefined while the mark still reads (' + JSON.stringify(bad) + ')');
  }
  assert(Object.keys(lb([{ t: 1, c: 1 }])).sort().join(',') === 'barT,mark', 'and it returns exactly the two fields, nothing else');
}

console.log('== 2) the ledger rule on an OMNIROUTE-shaped record, the defect first ==');
{
  const clock = { now: WED + 5 * 60000 };
  const W = boot(['hg-forward.js'], clock);
  const recs = tab => W.hgFwdRecords(tab);
  /* OMNIROUTE prices ENTRY at the setup level (hg-v424): a long whose level 100
     sits BELOW a mark of 102; a tape that never trades down to 100 and reaches
     the 106 target from its fourth bar */
  const row = x => Object.assign({ sym: 'SOLUSDT', dir: 'long', entry: 100, stop: 98, t1: 106, mechanic: 'FVG-FILL', barT: SEC }, x || {});
  const never = tape(30, { o: 102.5, h: 103, hHi: 107, l: 101, c: 102.4 });
  assert(W.hgFwdRecordScan('LEGACY', '1h', [row()], { horizonBars: 20 }) === 1 && recs('LEGACY')[0].mark === undefined, 'REACHABILITY: a row with no mark records with mark undefined (every OMNIROUTE record before this pack)');
  W.hgFwdResolve('SOLUSDT', '1h', never, undefined);
  const leg = recs('LEGACY')[0];
  assert(leg.state === 't1' && leg.fillState === undefined && leg.orderType === undefined, 'THE DEFECT: the markless resting order is settled as a market order -- a TARGET HIT on a tape that never reached its entry, and no fill verdict at all');
  assert(W.hgFwdRecordScan('OR', '1h', [row({ mark: 102 })], { horizonBars: 20 }) === 1 && recs('OR')[0].mark === 102, 'c.mark is recorded on the row');
  W.hgFwdResolve('SOLUSDT', '1h', never, undefined);
  const a = recs('OR')[0];
  assert(a.state === 't1' && a.orderType === 'BUY_LIMIT' && a.fillState === 'unfilled', 'with the mark the SAME record is a BUY_LIMIT that NEVER FILLED (the actual tally stays t1 by design; the fill-aware pass is counted beside it)');
  /* the same plan on a tape that does trade down to the level first */
  const fills = tape(30, { o: 102.5, h: 103, hHi: 107, l: 99.5, c: 102.4 });
  assert(W.hgFwdRecordScan('OR2', '1h', [row({ mark: 102 })], { horizonBars: 20 }) === 1, 'a second copy on a tape that reaches the level');
  W.hgFwdResolve('SOLUSDT', '1h', fills, undefined);
  const b = recs('OR2')[0];
  assert(b.orderType === 'BUY_LIMIT' && b.fillState === 'filled' && b.stateFill === 't1', 'a limit the tape reaches is FILLED and then judged on the walk after the fill (stateFill t1)');
  /* a market order (OMNIPRESENT TRIGGERED, EDGE MARKET): mark AT the entry */
  assert(W.hgFwdRecordScan('MK', '1h', [row({ mark: 100 })], { horizonBars: 20 }) === 1, 'a mark at the entry is a market order');
  W.hgFwdResolve('SOLUSDT', '1h', never, undefined);
  assert(recs('MK')[0].orderType === 'BUY' && recs('MK')[0].stateFill === 't1', 'and a market order fills at once and settles t1 both ways');
  /* the stats the reader below prints */
  const st = W.hgFwdStats('OR', 'FVG-FILL', false);
  assert(st && st.samples === 1 && st.fillUnfilled === 1 && st.fillSamples === 0, 'hgFwdStats counts the never-filled record beside an actual tally of one target hit');
}

console.log('== 3) OMNIPRESENT: the assessor stamps the mark it priced on and the bar it read ==');
{
  const W = boot(['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'plans.js', 'hg-mechanics.js',
                  'hg-forward.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js', 'omnigold.js', 'omnipresent.js']);
  function topTape(n){
    const out = []; let s = 5;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < n; i++){
      let p; const tail = n - i;
      if (tail > 70) p = 95 + Math.sin(i / 9) * 3 + (rnd() - 0.5) * 0.6;
      else if (tail > 50) p = 96 + (70 - tail) * 0.72;
      else if (tail > 40) p = 110.4 - (50 - tail) * 0.42;
      else if (tail > 30) p = 106.2 + (40 - tail) * 0.40;
      else p = 110.2 - (30 - tail) * 0.06 - Math.sin(i / 5) * 0.2;
      out.push({ t: 1700000000 + i * 3600, o: p - 0.2, h: p + 0.35, l: p - 0.55, c: p, v: 700 + rnd() * 200 });
    }
    return out;
  }
  const rows = topTape(360);
  const live = rows[rows.length - 1].c;
  const cands = W.opAssess(rows, live);
  const short = cands.filter(c => c.dir === 'short')[0];
  assert(!!short && short.status === 'ARMED', 'REACHABILITY: an ARMED short forms under the overhead zone');
  assert(cands.length > 0 && cands.every(c => c.mark === live), 'every candidate carries mark === the live price it was assessed against');
  assert(cands.every(c => c.barT === rows[rows.length - 1].t), 'and barT === the open time of the last bar of the series it read');
  assert(short.entry !== short.mark, 'an ARMED entry rests at the zone edge, away from the mark -- a resting order the fill model can now type');
  const t0 = rows[rows.length - 1].t;
  const swept = rows.concat([
    { t: t0 + 3600, o: live, h: short.zone.hi + 0.2, l: live - 0.3, c: short.zone.lo + 0.05, v: 2400 },
    { t: t0 + 7200, o: short.zone.lo, h: short.zone.lo + 0.2, l: short.zone.lo - 1.1, c: short.zone.lo - 0.9, v: 1900 }
  ]);
  const liveNow = short.zone.lo - 1.0;
  const after = W.opAssess(swept, liveNow).filter(c => c.dir === 'short')[0];
  assert(!!after && after.status === 'TRIGGERED', 'after the sweep-and-reject the candidate reads TRIGGERED');
  assert(after.mark === liveNow && Math.abs(after.entry - after.mark) < 1e-9 && after.barT === t0 + 7200,
    'a TRIGGERED entry IS the mark (a market order, as hg-v421 says) and the bar is the rejection bar');
  /* the record map forwards both: bounded to the OMNIPRESENT record statement */
  const src = strip(read('omnipresent.js'));
  const at = src.indexOf("hgFwdRecordScan('OMNIPRESENT'");
  const stmt = src.slice(src.lastIndexOf('var fwd = ', at), at);
  assert(/mark: c\.mark, barT: c\.barT/.test(stmt), 'and the OMNIPRESENT record map forwards mark and barT off the candidate (textual, hg-v956: the map lives inside the scan closure)');
}

console.log('== 4) the reader: KIND PERFORMANCE prints the fill split, and prints nothing without one ==');
{
  const clock = { now: WED + 5 * 60000 };
  const W = boot(['hg-forward.js', 'hg-perf-panel.js'], clock);
  assert(typeof W.hgPerfFillHtml === 'function', 'hgPerfFillHtml is exported');
  assert(W.hgPerfFillHtml(null) === '' && W.hgPerfFillHtml({}) === '' && W.hgPerfFillHtml({ samples: 40, hit: 0.5, expR: 0.2 }) === '',
    'a stat with no fill resolution renders NOTHING -- a legacy log is not evidence about fills');
  const h = W.hgPerfFillHtml({ fillWins: 3, fillLosses: 2, fillUnfilled: 4, fillUnprovable: 1 });
  assert(/fill 5 \(3W\/2L 60%\)/.test(h) && /4 unfilled/.test(h) && /1 unprovable/.test(h), 'and prints filled-and-settled with W/L and hit, then unfilled and unprovable: ' + h.replace(/<[^>]+>/g, ''));
  assert(!/unprovable/.test(W.hgPerfFillHtml({ fillWins: 1, fillLosses: 0, fillUnfilled: 0, fillUnprovable: 0 })), 'zero buckets are not printed');
  assert(/fill 0 \(0W\/0L —\)/.test(W.hgPerfFillHtml({ fillWins: 0, fillLosses: 0, fillUnfilled: 2, fillUnprovable: 0 })), 'a pool with only never-filled records prints a dash for the hit rate, never NaN');
  /* end to end: OMNIROUTE-shaped resting records through the real ledger and the real panel */
  const never = tape(30, { o: 102.5, h: 103, hHi: 107, l: 101, c: 102.4 });
  const fills = tape(30, { o: 102.5, h: 103, hHi: 107, l: 99.5, c: 102.4 });
  const mk = (i, tab) => ({ sym: 'S' + i, dir: 'long', entry: 100, stop: 98, t1: 106, mechanic: 'FVG-FILL', barT: SEC, mark: 102 });
  const rowsA = []; for (let i = 0; i < 24; i++) rowsA.push(mk(i));
  assert(W.hgFwdRecordScan('OMNIROUTE', '1h', rowsA, { horizonBars: 20 }) === 24, '24 OMNIROUTE resting records');
  for (let i = 0; i < 24; i++) W.hgFwdResolve('S' + i, '1h', i < 16 ? fills : never, undefined);
  const html = W.hgPerfPanelHtml('OMNIROUTE');
  assert(/FVG-FILL/.test(html) && /n=24/.test(html), 'the panel lists the mechanic on its actual tally of 24');
  assert(/fill 16 \(16W\/0L 100%\)/.test(html) && /8 unfilled/.test(html), 'and beside it the fill split: 16 filled and settled, 8 never filled -- which the actual tally counts as 8 more target hits');
  /* the same records stripped of their mark: the panel is silent about fills */
  const W2 = boot(['hg-forward.js', 'hg-perf-panel.js'], clock);
  W2.hgFwdRecordScan('OMNIROUTE', '1h', rowsA.map(r => Object.assign({}, r, { mark: undefined })), { horizonBars: 20 });
  for (let i = 0; i < 24; i++) W2.hgFwdResolve('S' + i, '1h', i < 16 ? fills : never, undefined);
  const html2 = W2.hgPerfPanelHtml('OMNIROUTE');
  assert(/n=24/.test(html2) && !/fill \d/.test(html2) && !/unfilled/.test(html2), 'THE DEFECT, on the panel: the markless records settle 24 target hits and say nothing about fills');
}

console.log('== 5) every crypto record map forwards the mark it had in hand (textual, hg-v956: each lives inside its scan closure) ==');
{
  const T = (file, re, why) => assert(re.test(strip(read(file))), file + ': ' + why);
  T('omniroute.js', /mark: \(num\(held\[j\]\.livePx\) > 0\) \? num\(held\[j\]\.livePx\) : undefined,/, 'the decision bar\'s close (the evaluator\'s own livePx) is the mark');
  T('omnipresent.js', /mark: livePx,\s*barT: \(rows\[rows\.length - 1\] && isFinite\(\+rows\[rows\.length - 1\]\.t\) && \+rows\[rows\.length - 1\]\.t > 0\) \? \+rows\[rows\.length - 1\]\.t : undefined,/, 'opAssess stamps livePx and the last bar on every candidate');
  T('squeeze.js', /var lb = \(typeof W\.hgFwdLastBar === 'function'\) \? W\.hgFwdLastBar\(fr\.rows4h\) : \{\};\s*fwd\.push\(\{ sym: fr\.sym, dir: fr\.dir, entry: \+fr\.entry, stop: \+fr\.stop, t1: \+fr\.t1,\s*mark: lb\.mark, barT: lb\.barT,/, 'SQUEEZE reads its 4h series through the one reader');
  T('oiflow.js', /var lb = \(typeof W\.hgFwdLastBar === 'function'\) \? W\.hgFwdLastBar\(fr\.rows4h\) : \{\};\s*fwd\.push\(\{ sym: fr\.sym, dir: fr\.cls\.dir, entry: \+fs\.entry, stop: \+fs\.stop, t1: \+fs\.t1,\s*mark: lb\.mark, barT: lb\.barT,/, 'OI FLOW reads its 4h series through the one reader');
  T('reversalsniper.js', /var lb = \(typeof W\.hgFwdLastBar === 'function'\) \? W\.hgFwdLastBar\(c\.rows\) : \{\};\s*return \{ sym: c\.sym, dir: c\.dir, entry: \+c\.entry, stop: \+c\.stop, t1: \+c\.t1,\s*mark: lb\.mark, barT: lb\.barT,/, 'REVERSAL SNIPER reads the candidate\'s rows through the one reader');
  T('edge.js', /mark: \(f\.sig && isFinite\(\+f\.sig\.mark\) && \+f\.sig\.mark > 0\) \? \+f\.sig\.mark : undefined,\s*barT: \(typeof W\.hgFwdLastBar === 'function'\) \? W\.hgFwdLastBar\(f\.rows4h\)\.barT : undefined,/, 'EDGE forwards the mark its signal decided MARKET vs LIMIT on, and the bar off its 4h rows');
  T('brain.js', /mark: \(function\(\)\{ var bm = boardMarkFor\(fr\); return \(isFinite\(bm\) && bm > 0\) \? bm : undefined; \}\)\(\),/, 'BRAIN forwards the row\'s own zero-fetch mark (no series rides a BRAIN row, so no bar is claimed)');
  T('engine.js', /svBar\.push\(\(typeof G\.hgFwdLastBar === 'function'\) \? G\.hgFwdLastBar\(rec\.rows4h\) : \{\}\);\s*sv\.push\(\{ sym: rec\.sym, dir: res\.dir, conviction: res\.conviction, plan: plan,/, 'the GATES tab reads each survivor\'s own 4h series beside the state row (whose shape is BRAIN\'s contract, pinned by test-engine)');
  T('engine.js', /fwd\.push\(\{ sym: s0\.sym, dir: s0\.dir, entry: e0, stop: st0, t1: t10,\s*mark: \(svBar\[i\] \|\| \{\}\)\.mark, barT: \(svBar\[i\] \|\| \{\}\)\.barT,/, 'and its record map forwards both from that array at the same index');
  T('dex-screener.js', /if \(gfn\('hgFwdLastBar'\)\)\{ var lbDex = W\.hgFwdLastBar\(f\.rows\); c\.mark = lbDex\.mark; c\.barT = lbDex\.barT; \}/, 'DEX SCREENER stamps each candidate off the series it was evaluated on');
  T('dex-screener.js', /t1: c\.plan && c\.plan\.t1,\s*mark: c\.mark, barT: c\.barT,/, 'and its record map forwards both');
  T('trendtable.js', /mark: \(c\.plan && isFinite\(\+c\.plan\.mark\) && \+c\.plan\.mark > 0\) \? \+c\.plan\.mark : undefined,\s*barT: \(typeof W\.hgFwdLastBar === 'function'\) \? W\.hgFwdLastBar\(c\.row && c\.row\.rows4h\)\.barT : undefined,/, 'TRENDMX forwards the mark trendmxAttachMeta kept and the bar off the row\'s series');
  T('pine.js', /mark: \(isFinite\(\+sg\.price\) && \+sg\.price > 0\) \? \+sg\.price : undefined,\s*barT: \(typeof W\.hgFwdLastBar === 'function'\) \? W\.hgFwdLastBar\(sg\.rows\)\.barT : undefined,/, 'PINE forwards the signal\'s own close and its rows\' last bar');
  T('pine-sub.js', /mark: \(isFinite\(\+sg\.price\) && \+sg\.price > 0\) \? \+sg\.price : undefined,\s*barT: \(typeof W\.hgFwdLastBar === 'function'\) \? W\.hgFwdLastBar\(sg\.rows\)\.barT : undefined,/, 'PINE sub-tabs likewise');
  T('super-best.js', /var lb = \(typeof W\.hgFwdLastBar === 'function'\) \? W\.hgFwdLastBar\(c\.rows\) : \{\};\s*return \{ sym: c\.sym, dir: c\.dir, entry: \+c\.entry, stop: \+c\.stop, t1: \+c\.t1,\s*mark: \(isFinite\(\+c\.mark\) && \+c\.mark > 0\) \? \+c\.mark : lb\.mark, barT: lb\.barT,/, 'SUPER BEST forwards the pick\'s own mark, else the last bar of its rows');
  T('super-sniper.js', /var lb = \(typeof W\.hgFwdLastBar === 'function'\) \? W\.hgFwdLastBar\(c\.rows\) : \{\};\s*return \{ sym: c\.sym, dir: c\.dir, entry: \+c\.entry, stop: \+c\.stop, t1: \+c\.t1,\s*mark: lb\.mark, barT: lb\.barT,/, 'SUPER SNIPER reads the pick\'s rows through the one reader');
  T('contract-report.js', /mark: \(isFinite\(fin\(p\.mark\)\) && fin\(p\.mark\) > 0\) \? fin\(p\.mark\) : undefined,/, 'CONTRACT REPORT forwards planFrom\'s last close');
  const shell = strip(read('index.html'));
  assert(/const fwdMark = \(typeof hgMpMarkOf === 'function'\) \? hgMpMarkOf\(bookMeta, bookMeta, \{\}\) : NaN;\s*const fwdBar = \(typeof hgFwdLastBar === 'function'\) \? hgFwdLastBar\(bookMeta\.rows\) : \{\};\s*hgFwdRecordScan\('CARD:' \+ scanId, '4h',\s*\[\{ sym: sym, dir: dir, entry: entry, stop: stop, t1: t1,\s*mark: \(isFinite\(fwdMark\) && fwdMark > 0\) \? fwdMark : undefined, barT: fwdBar\.barT,/.test(shell),
    'index.html: the inline CARD choke point (SMC, ORDER BLOCKS, TRAP, DIV, COIL, APEX) forwards the mark its own geometry line reads and the bar off bookMeta.rows');
  assert((shell.match(/\.\.\.c, barT: \(typeof hgFwdLastBar === 'function'\) \? hgFwdLastBar\(c\.rows\)\.barT : undefined, mechanic: kind\.toUpperCase\(\) \+ '-(CLEAN|NEAR)'/g) || []).length === 2,
    'index.html: the BEST/SWING/SCALP publish spreads the candidate (its mark rides the spread) and reads the bar off its rows, CLEAN and NEAR alike');
}

console.log('== 6) the census, derived by call shape: every record writer carries a mark ==');
{
  /* Every hgFwdRecordScan call site in the repo (definition excluded). The
     record literal is the innermost object holding `entry:` nearest the call;
     it carries a mark when it names `mark:`, spreads its candidate (`...c`,
     whose mark hgFwdRecordScan reads), or the desk assigns `.mark =` on the
     row inside the same window (GOLD DIRECTION / GOLD ULTRA, hg-v980). */
  function literalAround(text, idx){
    let d = 0, i = idx;
    for (; i >= 0; i--){ const ch = text[i]; if (ch === '}') d++; else if (ch === '{'){ if (d === 0) break; d--; } }
    const start = Math.max(0, i); d = 0; let j = start;
    for (; j < text.length; j++){ const ch = text[j]; if (ch === '{') d++; else if (ch === '}'){ d--; if (d === 0) break; } }
    return text.slice(start, j + 1);
  }
  const files = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f));
  const writers = [], bare = [];
  for (const f of files){
    const src = strip(read(f));
    const re = /hgFwdRecordScan\s*\(/g; let m;
    while ((m = re.exec(src))){
      const before = src.slice(Math.max(0, m.index - 30), m.index);
      if (/function\s+$/.test(before) || /=\s*function\s*$/.test(src.slice(m.index, m.index + 40))) continue;
      if (/hgFwdRecordScan = function/.test(src.slice(m.index, m.index + 40))) continue;
      const span = src.slice(m.index, m.index + 900);
      const tab = (span.match(/\(\s*('[^']+'|[A-Za-z_$][\w$]*)/) || [])[1];
      const winStart = Math.max(0, m.index - 3000);
      const pre = src.slice(winStart, m.index);          /* what precedes the call */
      const spread = /\.\.\.c\b/.test(span);
      /* WHERE THE RECORD LITERAL LIVES, by call shape: rows built by a named
         function (csFwdRows, cvFwdRows, npFwdRows) -> that function's body;
         rows built before the call (push / map into a variable) -> the last
         `entry:` before the call; an inline literal or map in the argument ->
         the first `entry:` inside the call. The first cut took the last
         `entry:` in a window that ran past the call and read OMNIPRESENT's and
         SQUEEZE's maps off a LATER literal that carries no mark. */
      const arg3 = (span.match(/^hgFwdRecordScan\s*\(\s*[^,]+,\s*[^,]+,\s*([A-Za-z_$][\w$]*)\s*,/) || [])[1];
      let region = null, li = -1;
      if (arg3){
        const asg = pre.match(new RegExp('\\b' + arg3 + '\\s*=\\s*([A-Za-z_$][\\w$]*)\\s*\\('));
        const at = asg ? src.indexOf('function ' + asg[1] + '(') : -1;
        region = at >= 0 ? src.slice(at, at + 2500) : pre;
        for (const em of region.matchAll(/\bentry\s*:/g)) li = em.index;
      } else {
        region = span;
        const em = region.match(/\bentry\s*:/); li = em ? em.index : -1;
      }
      if (li < 0 && !spread) continue;               /* no record literal: not a writer */
      const lit = li >= 0 ? literalAround(region, li) : '';
      const carried = spread || /\bmark\s*:/.test(lit) || /\.mark = /.test(region) || /\.mark = /.test(pre);
      writers.push(f + ' -> ' + tab);
      if (!carried) bare.push(f + ' -> ' + tab);
    }
  }
  assert(writers.length >= 27, 'the census sees the record writers (' + writers.length + ')');
  assert(bare.length === 0, 'none records without a mark carrier' + (bare.length ? ' -- BARE: ' + bare.join(', ') : ''));
  for (const need of ['omniroute.js', 'omnipresent.js', 'squeeze.js', 'oiflow.js', 'edge.js', 'reversalsniper.js', 'brain.js', 'engine.js', 'dex-screener.js', 'trendtable.js', 'pine.js', 'pine-sub.js', 'contract-report.js', 'index.html', 'cryptoscan.js', 'cryptoverse.js', 'ninetypercent.js', 'super-best.js', 'super-sniper.js'])
    assert(writers.some(w => w.startsWith(need + ' ')), 'the census counts ' + need);
}

console.log('== 7) the stamp ==');
{
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
  assert(/hg-v981/.test(read('AGENTS.md')), 'AGENTS.md records hg-v981');
}

console.log('\n' + (process.exitCode ? 'FAILED' : 'PASSED') + ' ' + passed + ' assertions');
