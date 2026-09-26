/* HARDGATE -- hg-v993: THE REGIME LAYER'S TWO RULES, RECORDED WHERE THEY ARE
   APPLIED AND WHERE THEY ARE NOT.

   (1) The REGIME playbook bias (LONG-ONLY / SHORT-ONLY / BOTH / STAND-ASIDE)
       is a HARD block on PINE, an 'against' on the FTS stack, a +2 vote on
       STAR TRADER and a BRAIN layer. Its rule now lives once (regime.js
       hgRegimeBiasBlocks); the PINE gate delegates to it; the forward ledger
       records its verdict, the bias and the snapshot's age at fire time.
   (2) The per-symbol tape regime (detectRegime: volatile / compression /
       trend / range / weak_trend) is a HARD veto through hgRegimeAllowsSetup
       on SWING, SCALP, BEST, SUPER SETUP, CHART VISION, CONTRACT REPORT and
       the FTS stack, asked by none of the crypto desks that record most, and
       recorded nowhere. hgTapeRegimeMark reads it; the ledger records the
       key and the veto the gate in force would have applied.

   Nothing is gated on either mark. Node 18+, no network. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const text = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

function boot(files, extra){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, TypeError, Set, Map, encodeURIComponent, setTimeout, clearTimeout, AbortController };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {}; s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }),
                 head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  s.__store = store;
  s.location = { href: 'https://x/', search: '', protocol: 'https:' }; s.navigator = { userAgent: 'node' }; s.fetch = async () => ({ ok: false, status: 500, text: async () => '' });
  if (extra) Object.assign(s, extra);
  vm.createContext(s);
  for (const f of files) vm.runInContext(read(f), s, { filename: f });
  return s;
}

/* ---- synthetic tapes that reach each detectRegime key (asserted reachable) ---- */
function rng(seed){ let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
function mkRows(n, gen){
  const rows = []; let px = 100;
  for (let i = 0; i < n; i++){
    const g = gen(i, px);
    const o = px, c = px + g.drift, hi = Math.max(o, c) + g.wick, lo = Math.min(o, c) - g.wick;
    rows.push({ t: 1700000000 + i * 14400, o, h: hi, l: lo, c, v: 1000 });
    px = c;
  }
  return rows;
}
function shapes(seed){
  const r = rng(seed), noise = () => (r() - 0.5);
  return {
    volatile: mkRows(120, (i) => ({ drift: noise() * 0.4, wick: i >= 116 ? 6 + r() * 4 : 0.2 + r() * 0.2 })),
    compression: mkRows(120, (i) => ({ drift: i < 95 ? noise() * 3 : noise() * 0.05, wick: i < 95 ? 1.5 : 0.02 })),
    trend: mkRows(120, (i) => ({ drift: 0.6 + r() * 0.3 + (i > 100 ? i * 0.03 : 0), wick: 0.2 + (i > 100 ? i * 0.02 : 0) })),
    range: mkRows(120, () => ({ drift: noise() * 0.6, wick: 0.3 + r() * 0.2 })),
    weak: mkRows(120, (i) => ({ drift: (i % 7 < 4 ? 0.35 : -0.25) + noise() * 0.3, wick: 0.3 + r() * 0.2 }))
  };
}
function findTapes(S){
  const want = ['volatile', 'compression', 'trend', 'range', 'weak_trend'], found = {};
  for (let seed = 1; seed < 400 && Object.keys(found).length < want.length; seed++){
    const sh = shapes(seed);
    for (const k in sh){
      const dr = S.detectRegime(sh[k]);
      if (dr && want.indexOf(dr.regime) >= 0 && !found[dr.regime]) found[dr.regime] = sh[k];
    }
  }
  return found;
}

console.log('1. regime.js: the bias rule, one home, three states');
{
  const S = boot(['indicators.js', 'cryptogates.js', 'plans.js', 'regime.js']);
  const B = S.hgRegimeBiasBlocks;
  ok(typeof B === 'function' && typeof S.hgRegimeBiasMark === 'function', 'hgRegimeBiasBlocks and hgRegimeBiasMark are exported');
  ok(B('STAND-ASIDE', 'long') === true && B('STAND-ASIDE', 'short') === true, 'STAND-ASIDE stands both sides down');
  ok(B('LONG-ONLY', 'short') === true && B('LONG-ONLY', 'long') === false, 'LONG-ONLY blocks a short and lets a long through');
  ok(B('SHORT-ONLY', 'long') === true && B('SHORT-ONLY', 'short') === false, 'SHORT-ONLY blocks a long and lets a short through');
  ok(B('BOTH', 'long') === false && B('BOTH', 'short') === false, 'BOTH blocks nothing');
  ok(B('long-only', 'SHORT') === true, 'case is normalised on both arguments');
  ok(B('', 'long') === undefined && B(undefined, 'long') === undefined && B('RISK-ON', 'long') === undefined, 'an unknown bias is no verdict');
  ok(B('STAND-ASIDE', '') === undefined && B('STAND-ASIDE', 'flat') === undefined, 'no direction is no verdict, even under STAND-ASIDE');
  /* the mark reads the live snapshot */
  S.regimeState = () => null;
  let m = S.hgRegimeBiasMark('long', 'BTCUSDT');
  ok(m.bias === undefined && m.against === undefined && m.ageMin === undefined, 'a dark snapshot records nothing');
  const NOW = Date.now();
  S.regimeState = () => ({ label: 'RISK-ON', score: 5, playbook: { bias: 'LONG-ONLY' }, at: NOW - 90 * 60000 });
  m = S.hgRegimeBiasMark('short', 'ETHUSDT');
  ok(m.bias === 'LONG-ONLY' && m.against === true && m.ageMin === 90, 'LONG-ONLY at 90 min: a short reads against, age 90');
  m = S.hgRegimeBiasMark('long', 'ETHUSDT');
  ok(m.bias === 'LONG-ONLY' && m.against === false, 'and a long reads allowed');
  m = S.hgRegimeBiasMark('long', 'XAUUSD');
  ok(m.bias === undefined && m.against === undefined && m.ageMin === undefined, 'a gold-lane symbol gets no verdict -- a crypto regime does not speak for gold');
  S.regimeState = () => ({ label: 'MIXED', score: 0, playbook: { bias: 'STAND-ASIDE' }, at: 0 });
  m = S.hgRegimeBiasMark('long', 'SOLUSDT');
  ok(m.bias === 'STAND-ASIDE' && m.against === true && m.ageMin === undefined, 'STAND-ASIDE stands a long down; an epoch-zero stamp is not an age');
  S.regimeState = () => ({ label: 'MIXED', score: 1, playbook: { bias: 'BOTH' }, at: String(NOW) });
  m = S.hgRegimeBiasMark('short', 'SOLUSDT');
  ok(m.bias === 'BOTH' && m.against === false && m.ageMin === undefined, 'BOTH allows; a string stamp is not an age (never coerced)');
  S.regimeState = () => ({ label: 'RISK-ON', score: 4, playbook: { bias: 'risk-on' }, at: NOW });
  m = S.hgRegimeBiasMark('long', 'SOLUSDT');
  ok(m.bias === undefined && m.against === undefined && m.ageMin === 0, 'an unknown bias string records no bias and no verdict; the age is still read');
  S.regimeState = () => { throw new Error('boom'); };
  m = S.hgRegimeBiasMark('long', 'SOLUSDT');
  ok(m.bias === undefined && m.against === undefined, 'a throwing snapshot records nothing');
}

console.log('2. the PINE hard block reads the same rule');
{
  const S = boot(['regime.js', 'pinegate.js']);
  const cands = [
    { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, tally: 4 },
    { sym: 'ETHUSD', dir: 'short', entry: 2000, stop: 2100, t1: 1800, tally: 5 }
  ];
  const snap = (bias) => ({ swingCands: cands, scalpCands: cands, edgeCands: cands, bestClean: cands,
    brainRows: [{ sym: 'BTCUSD', dir: 'long', tier: 'HIGH' }, { sym: 'ETHUSD', dir: 'short', tier: 'PRIME' }],
    trendmxRows: [{ sym: 'BTCUSDT', score: 3 }, { sym: 'ETHUSDT', score: -3 }],
    regime: bias === null ? null : { playbook: { bias } } });
  const blocked = (bias) => S.pineGateIntersect(snap(bias)).funnel.regimeBlocked;
  /* parity, bias by bias, against the one rule */
  for (const bias of ['LONG-ONLY', 'SHORT-ONLY', 'BOTH', 'STAND-ASIDE']){
    const expect = (S.hgRegimeBiasBlocks(bias, 'long') === true ? 1 : 0) + (S.hgRegimeBiasBlocks(bias, 'short') === true ? 1 : 0);
    ok(blocked(bias) === expect, 'PINE blocks exactly what hgRegimeBiasBlocks says under ' + bias + ' (' + expect + ')');
  }
  ok(blocked('STAND-ASIDE') === 2 && blocked('LONG-ONLY') === 1 && blocked('BOTH') === 0, 'and the counts are the ones the gate always produced');
  ok(blocked(null) === 0 && blocked('RISK-ON') === 0, 'no snapshot, or an unknown bias, blocks nothing (fail open)');
  const r = S.pineGateIntersect(snap('LONG-ONLY'));
  ok(r.eligible.length === 1 && r.eligible[0].sym === 'BTCUSD', 'the short is the one removed');
  /* with regime.js absent the gate has no rule and fails OPEN, saying so */
  const S2 = boot(['pinegate.js']);
  const r2 = S2.pineGateIntersect(snap('LONG-ONLY'));
  ok(r2.funnel.regimeBlocked === 0 && r2.eligible.length === 2, 'with the one home absent, PINE blocks nothing rather than carrying a second bias table');
  ok(!/=== 'STAND-ASIDE'|=== 'LONG-ONLY'|=== 'SHORT-ONLY'/.test(read('pinegate.js')), 'pinegate.js carries no inline copy of the bias table (textual: one rule, one home)');
}

console.log('3. plans.js: the tape regime mark equals the veto in force on every readable series');
{
  const S = boot(['indicators.js', 'cryptogates.js', 'plans.js']);
  const T = findTapes(S);
  const KEYS = ['volatile', 'compression', 'trend', 'range', 'weak_trend'];
  ok(KEYS.every(k => T[k]), 'a synthetic tape reaches every detectRegime key (' + KEYS.filter(k => T[k]).join(', ') + ')');
  let checked = 0;
  for (const k of KEYS){
    for (const style of ['swing', 'scalp', 'best', 'edge', 'meanrev']){
      const m = S.hgTapeRegimeMark(T[k], style), g = S.hgRegimeAllowsSetup(T[k], style);
      if (!(m.regime === k && m.veto === (g.allow === false))) throw new Error('FAIL: mark/gate disagree on ' + k + '/' + style + ': ' + JSON.stringify(m) + ' vs ' + JSON.stringify(g));
      checked++;
    }
  }
  ok(checked === 25, 'mark equals gate on ' + checked + ' (tape, style) pairs');
  ok(S.hgTapeRegimeMark(T.volatile, 'swing').veto === true && S.hgTapeRegimeMark(T.volatile, 'scalp').veto === true && S.hgTapeRegimeMark(T.volatile, 'best').veto === false, 'VOLATILE vetoes swing and scalp, not best');
  ok(S.hgTapeRegimeMark(T.compression, 'swing').veto === true && S.hgTapeRegimeMark(T.compression, 'scalp').veto === false && S.hgTapeRegimeMark(T.compression, 'meanrev').veto === false, 'COMPRESSION vetoes swing, not scalp, and is friendly to mean reversion');
  ok(S.hgTapeRegimeMark(T.trend, 'swing').veto === false && S.hgTapeRegimeMark(T.range, 'swing').veto === false && S.hgTapeRegimeMark(T.weak_trend, 'swing').veto === false, 'TREND, RANGE and WEAK TREND pass');
  ok(S.hgTapeRegimeMark(T.volatile, 'swing').label === 'VOLATILE EXPANSION', 'the human label rides beside the key');
  const thin = S.hgTapeRegimeMark(T.trend.slice(-40), 'swing'), gThin = S.hgRegimeAllowsSetup(T.trend.slice(-40), 'swing');
  ok(thin.regime === undefined && thin.veto === undefined && gThin.allow === true, 'a thin series: the gate fails OPEN, the mark says NOT RECORDED -- allowed is the wrong word for unread');
  ok(S.hgTapeRegimeMark(null, 'swing').veto === undefined && S.hgTapeRegimeMark('rows', 'swing').veto === undefined, 'no series, no verdict');
  const S0 = boot(['cryptogates.js', 'plans.js']);
  ok(S0.hgTapeRegimeMark(T.volatile, 'swing').regime === undefined, 'with detectRegime absent there is no reading, never a guess');
}

console.log('4. the ledger records both, folds them and prints two splits');
{
  const S = boot(['indicators.js', 'cryptogates.js', 'plans.js', 'regime.js', 'hg-forward.js']);
  const T = findTapes(S);
  const sec = 3600, bar = Math.floor(Date.now() / sec) * sec - 2 * sec;
  const row = (sym, dir, extra) => Object.assign({ sym, dir, entry: 100, stop: dir === 'long' ? 99 : 101, t1: dir === 'long' ? 102 : 98, mark: 100, barT: bar }, extra || {});
  const by = {}; const refresh = () => S.hgFwdRecords('T').forEach(x => { by[x.sym] = x; });
  /* dark: nothing */
  S.regimeState = () => null;
  S.hgFwdRecordScan('T', '4h', [row('AUSD', 'long')], { horizonBars: 20 });
  refresh();
  ok(by.AUSD.regimeBias === undefined && by.AUSD.regimeAgainst === undefined && by.AUSD.regimeAgeMin === undefined && by.AUSD.tapeRegime === undefined && by.AUSD.tapeVeto === undefined, 'a dark snapshot and no series: all five NOT RECORDED');
  /* LONG-ONLY at 30 min; rows under the names the writers use */
  const NOW = Date.now();
  S.regimeState = () => ({ label: 'RISK-ON', score: 5, playbook: { bias: 'LONG-ONLY' }, at: NOW - 30 * 60000 });
  S.hgFwdRecordScan('T', '4h', [
    row('BUSD', 'long', { rows: T.volatile }),
    row('CUSD', 'short', { rows4h: T.trend }),
    row('DUSD', 'long', { rows1h: T.compression }),
    row('EUSD', 'long', { rows: T.trend.slice(-40) }),
    row('XAUUSD', 'long', { rows: T.trend })
  ], { horizonBars: 20 });
  refresh();
  ok(by.BUSD.regimeBias === 'LONG-ONLY' && by.BUSD.regimeAgainst === false && by.BUSD.regimeAgeMin === 30, 'a long under LONG-ONLY at 30 min: bias, allowed, age');
  ok(by.CUSD.regimeAgainst === true, 'a short under LONG-ONLY: the playbook would have stood it down');
  ok(by.BUSD.tapeRegime === 'volatile' && by.BUSD.tapeVeto === true, 'rows: a volatile 4h tape, the swing veto would have removed it');
  ok(by.CUSD.tapeRegime === 'trend' && by.CUSD.tapeVeto === false, 'rows4h: a trending tape passes');
  ok(by.DUSD.tapeRegime === 'compression' && by.DUSD.tapeVeto === true, 'rows1h: compression on a 4h record is judged under the swing rule -- vetoed');
  ok(by.EUSD.tapeRegime === undefined && by.EUSD.tapeVeto === undefined && by.EUSD.regimeAgainst === false, 'a thin series records no tape verdict while the playbook verdict still lands');
  ok(by.XAUUSD.regimeBias === undefined && by.XAUUSD.regimeAgainst === undefined && by.XAUUSD.tapeRegime === 'trend', 'gold: no playbook verdict (crypto regime), the tape is still read');
  /* the timeframe decides the style: compression on a 15m record is the scalp rule, which does not veto it */
  S.hgFwdRecordScan('T', '15m', [row('FUSD', 'long', { rows: T.compression }), row('GUSD', 'long', { rows: T.volatile })], { horizonBars: 20 });
  refresh();
  ok(by.FUSD.tapeRegime === 'compression' && by.FUSD.tapeVeto === false && by.GUSD.tapeVeto === true, 'on a 15m record compression is allowed and volatile is vetoed -- the scalp rule');
  /* desk hand-ins: valid wins, junk is ignored and the shared read decides */
  S.hgFwdRecordScan('T', '4h', [
    row('HUSD', 'long', { tapeRegime: 'range', tapeVeto: false, regimeBias: 'STAND-ASIDE', regimeAgainst: true, regimeAgeMin: 5, rows: T.volatile }),
    row('IUSD', 'long', { tapeRegime: 'CHOP', tapeVeto: 1, regimeBias: 'long-only', regimeAgainst: 'yes', regimeAgeMin: -5, rows: T.volatile })
  ], { horizonBars: 20 });
  refresh();
  ok(by.HUSD.tapeRegime === 'range' && by.HUSD.tapeVeto === false && by.HUSD.regimeBias === 'STAND-ASIDE' && by.HUSD.regimeAgainst === true && by.HUSD.regimeAgeMin === 5, 'a desk that hands valid values in wins over the shared read on all five -- H is a long the shared read would call allowed, and the desk said stood down');
  ok(by.IUSD.tapeRegime === 'volatile' && by.IUSD.tapeVeto === true && by.IUSD.regimeBias === 'LONG-ONLY' && by.IUSD.regimeAgainst === false && by.IUSD.regimeAgeMin === 30, 'junk hand-ins (CHOP, 1, long-only, yes, -5) are ignored and the shared read decides -- a long under LONG-ONLY is allowed, whatever the string said');
  /* the first READABLE series wins, not the first array; a desk naming the regime with a junk veto records the regime and no veto */
  S.hgFwdRecordScan('T', '4h', [row('LUSD', 'long', { rows: T.trend.slice(-40), rows4h: T.trend }), row('MUSD', 'long', { tapeRegime: 'trend', tapeVeto: 'no' })], { horizonBars: 20 });
  refresh();
  ok(by.LUSD.tapeRegime === 'trend' && by.LUSD.tapeVeto === false, 'a thin `rows` beside a readable `rows4h`: the readable series is the one read');
  ok(by.MUSD.tapeRegime === 'trend' && by.MUSD.tapeVeto === undefined, 'a desk that names the regime and hands a junk veto records the regime and NO veto -- never coerced');
  /* the direct door refuses the same junk */
  const nj = S.hgFwdNormalize(Object.assign(row('JUSD', 'long'), { tab: 'T', tf: '4h', mechanic: 'X', regimeBias: 'long-only', regimeAgainst: 1, regimeAgeMin: '30', tapeRegime: 'VOLATILE', tapeVeto: 0 }));
  ok(nj && nj.regimeBias === undefined && nj.regimeAgainst === undefined && nj.regimeAgeMin === undefined && nj.tapeRegime === undefined && nj.tapeVeto === undefined, 'through the direct door every junk value reads NOT RECORDED');
  const nk = S.hgFwdNormalize(Object.assign(row('KUSD', 'long'), { tab: 'T', tf: '4h', mechanic: 'X', regimeBias: 'BOTH', regimeAgainst: false, regimeAgeMin: 0, tapeRegime: 'weak_trend', tapeVeto: true }));
  ok(nk && nk.regimeBias === 'BOTH' && nk.regimeAgainst === false && nk.regimeAgeMin === 0 && nk.tapeRegime === 'weak_trend' && nk.tapeVeto === true, 'and the valid values pass, an age of exactly zero included');
  /* settle: A unmarked; B win; C lose; D win; E lose; F win; G lose; H win; I lose (XAU, L, M unresolved) */
  const win = [{ t: bar + sec, o: 100, h: 103, l: 99.5, c: 102.5 }], lose = [{ t: bar + sec, o: 100, h: 100.5, l: 98.5, c: 98.7 }];
  const winS = [{ t: bar + sec, o: 100, h: 100.5, l: 97, c: 97.5 }], loseS = [{ t: bar + sec, o: 100, h: 101.5, l: 99.5, c: 101.2 }];
  const sec15 = 900;
  S.hgFwdResolve('AUSD', '4h', win); S.hgFwdResolve('BUSD', '4h', win); S.hgFwdResolve('CUSD', '4h', loseS); S.hgFwdResolve('DUSD', '4h', win); S.hgFwdResolve('EUSD', '4h', lose);
  S.hgFwdResolve('FUSD', '15m', [{ t: bar + sec15, o: 100, h: 103, l: 99.5, c: 102.5 }]); S.hgFwdResolve('GUSD', '15m', [{ t: bar + sec15, o: 100, h: 100.5, l: 98.5, c: 98.7 }]);
  S.hgFwdResolve('HUSD', '4h', win); S.hgFwdResolve('IUSD', '4h', lose);
  const rs = S.hgFwdRegimeSplit('T');
  ok(rs.settled === 9 && rs.against === 2 && rs.ok === 6 && rs.unmarked === 1, 'regime split: 9 settled, 2 stood down (C, H), 6 allowed, 1 NEITHER (the dark record)');
  ok(Math.abs(rs.againstR - 0.5) < 1e-9 && Math.abs(rs.againstHit - 0.5) < 1e-9 && Math.abs(rs.okR - 0.5) < 1e-9, 'the stood-down cohort: one win of two at +2R; the allowed cohort three of six');
  ok(rs.byBias['LONG-ONLY'].n === 7 && rs.byBias['STAND-ASIDE'].n === 1 && rs.byBias.BOTH.n === 0, 'per-bias cells partition the marked set');
  ok(rs.ageMedianMin === 30, 'the median snapshot age at fire is read (30 min)');
  const ts = S.hgFwdTapeRegimeSplit('T');
  ok(ts.settled === 9 && ts.veto === 4 && ts.ok === 3 && ts.unmarked === 2, 'tape split: 4 would-veto (B, D, G, I), 3 allowed (C, F, H), 2 NEITHER (dark, thin)');
  ok(ts.labels.volatile.n === 3 && ts.labels.compression.n === 2 && ts.labels.trend.n === 1 && ts.labels.range.n === 1 && ts.labels.weak_trend.n === 0, 'per-tape cells: volatile 3, compression 2, trend 1, range 1');
  const h1 = text(S.hgFwdRegimeSplitHtml('T')), h2 = text(S.hgFwdTapeRegimeSplitHtml('T'));
  ok(/REGIME PLAYBOOK SPLIT/.test(h1) && /2 of 8 marked settled records/.test(h1) && /stood down \+0\.500R at 50% on n=2/.test(h1) && /allowed \+0\.500R at 50% on n=6/.test(h1) && /snapshot age at fire: median 30 min/.test(h1) && /1 carry no mark/.test(h1) && /Reported, not gated/.test(h1), 'the playbook line names both cohorts, the bias cells, the age and the unmarked count');
  ok(/TAPE REGIME SPLIT/.test(h2) && /4 of 7 marked settled records/.test(h2) && /by tape: volatile/.test(h2) && /2 carry no mark/.test(h2) && /applied nowhere new/.test(h2), 'the tape line names both cohorts, the tape cells and the unmarked count');
  ok(S.hgFwdRegimeSplitHtml('NOPE') === '' && S.hgFwdTapeRegimeSplitHtml('NOPE') === '', 'a desk with no marks renders NOTHING');
  const fold = S.hgFwdFold({}, S.hgFwdRecords('T'))['T|4h'];
  ok(fold && fold.ra && fold.ro && fold.ra.wins === 1 && fold.ra.losses === 1 && fold.ro.wins === 2 && fold.ro.losses === 2, 'the fold carries the playbook pair (settled 4h rows: 2 stood down, 4 allowed; the open records fold nothing)');
  ok(fold.tp && fold.tp.volatile && fold.tp.volatile.wins + fold.tp.volatile.losses === 2 && fold.tp.trend && fold.tp.compression && fold.tp.range && fold.tv && fold.tw, 'and the tape cells and the veto pair');
  const panel = text(S.hgFwdPanelHTML('T'));
  ok(/REGIME PLAYBOOK SPLIT/.test(panel) && /TAPE REGIME SPLIT/.test(panel), 'the shared forward panel carries both lines');
}

console.log('5. nothing is gated on the marks');
{
  const gateFiles = ['hg-gates.js', 'engine.js', 'cryptogates.js', 'hg-setup-core.js', 'setup-stack.js', 'pinegate.js', 'omniroute.js', 'omnipresent.js', 'startradertab.js'];
  const bad = gateFiles.filter(f => /\b(regimeAgainst|tapeVeto|regimeAgeMin|hgFwdRegimeSplit|hgFwdTapeRegimeSplit)\b/.test(read(f)));
  ok(bad.length === 0, 'no gate module or desk reads the record marks or the splits' + (bad.length ? ' (' + bad.join(', ') + ')' : ''));
  const plans = read('plans.js');
  ok(/function hgRegimeAllowsSetup\(rows, style\)\{/.test(plans) && !/tapeVeto|hgTapeRegimeMark\(/.test(plans.slice(plans.indexOf('function hgRegimeAllowsSetup'), plans.indexOf('function hgTapeRegimeMark'))), 'the gate itself does not read the mark');
  const fwd = read('hg-forward.js');
  ok((fwd.match(/typeof W\.hgRegimeBiasMark !== 'function'/g) || []).length === 1 && (fwd.match(/W\.hgRegimeBiasMark\(/g) || []).length === 1, 'the ledger reads the playbook mark through one guard-and-call pair');
  ok((fwd.match(/typeof W\.hgTapeRegimeMark !== 'function'/g) || []).length === 1 && (fwd.match(/W\.hgTapeRegimeMark\(/g) || []).length === 1, 'and the tape mark through one');
}

console.log('6. version stamps');
{
  const v = (read('build-stamp.js').match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(/^hg-v\d+$/.test(v) && parseInt(v.slice(4), 10) >= 993, 'build-stamp version ' + v);
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
}
console.log('\n' + passed + ' assertions passed');
