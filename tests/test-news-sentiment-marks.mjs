/* hg-v992 — THE NEWS BLACKOUT AND THE SENTIMENT GUARD ARE APPLIED ON THE DESKS
   THIS LIST NAMES AND MEASURED NOWHERE; AN UNLOADED CALENDAR READ AS CLEAR ON
   GATES AND CAST A "CALENDAR CLEAR" VOTE ON STAR TRADER.

   hgNewsRisk answered risk 'low' / blackout false before its first fetch, and
   also whenever the calendar leg failed while another leg (Fear & Greed,
   headlines) loaded -- an EMPTY event list classified as "no high-impact USD
   events within 48h". GATES G5 read any answer as `newsClear`; STAR TRADER
   cast a +1 NEWS vote on it (and, since hg-v991, a vote:NEWS mark on the
   forward record). Neither verdict -- the blackout GATES / STAR TRADER / BOOK
   veto on, the F&G extreme BIAS S2 and hgOmniMarketSide stand aside on -- was
   ever recorded beside an outcome.

   This pack: hgNewsRisk carries `unchecked: true` for both dark states
   (values unchanged for old callers); hgNewsGate, GATES G5 and STAR TRADER
   read the flag; hgNewsMark and hgFngExtremeMark are the two reads as
   three-state marks in one home (news.js); the ledger stamps newsRisk, fng
   and fngVeto on every record at hgFwdRecordScan, folds them, and prints
   NEWS CALENDAR SPLIT and SENTIMENT GUARD SPLIT on the shared panel.
   Nothing is gated on any of it.

   Run: node tests/test-news-sentiment-marks.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = src => String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

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
const now = Math.floor(Date.now() / 1000);
const CPI_SOON = { title: 'CPI m/m', country: 'USD', impact: 'high', t: Math.floor(Date.now() / 1000) + 30 * 60, when: null };   /* inside the 60m blackout */
const CPI_LATER = { title: 'CPI m/m', country: 'USD', impact: 'high', t: Math.floor(Date.now() / 1000) + 5 * 3600, when: null };  /* red print inside 24h: high, no blackout */
const EUR_ONLY = { title: 'EUR GDP', country: 'EUR', impact: 'high', t: Math.floor(Date.now() / 1000) + 3600, when: null };

console.log('1. news.js: an unchecked calendar says so, and the two marks');
{
  const S = boot(['news.js']);
  const cold = S.hgNewsRisk('BTCUSDT');
  ok(cold.unchecked === true && cold.risk === 'low' && cold.blackout === false && cold.note === 'news not loaded', 'cold cache: the old values and the new flag');
  S.__hgNewsSeed([], { value: 40, classification: 'Fear', t: null }, []);
  const noCal = S.hgNewsRisk('BTCUSDT');
  ok(noCal.unchecked === true && /calendar not loaded/.test(noCal.note), 'loaded WITHOUT a calendar (F&G landed, the calendar leg failed) is UNCHECKED -- the defect: this used to read "no high-impact USD events within 48h"');
  ok(S.hgNewsMark('BTCUSDT') === undefined, 'and the mark is NOT RECORDED, never low');
  S.__hgNewsSeed([EUR_ONLY], { value: 40 }, []);
  const clear = S.hgNewsRisk('BTCUSDT');
  ok(clear.unchecked === undefined && clear.risk === 'low' && S.hgNewsMark('BTCUSDT').risk === 'low', 'a loaded calendar with no USD event is a READ low');
  S.__hgNewsSeed([CPI_LATER], null, []);
  ok(S.hgNewsRisk('BTCUSDT').risk === 'high' && S.hgNewsRisk('BTCUSDT').blackout === false && S.hgNewsMark('BTCUSDT').risk === 'high', 'a red print 5h out reads high (no blackout): the mark says high');
  S.__hgNewsSeed([CPI_SOON], null, []);
  ok(S.hgNewsRisk('BTCUSDT').blackout === true && S.hgNewsMark('BTCUSDT').risk === 'blackout', 'a red print 30m out is a BLACKOUT: the mark says blackout');
  ok(S.hgNewsMark('XAUUSD').risk === 'blackout', 'USD events flag gold too, as the module documents');
  S.__hgNewsReset();
  ok(S.hgNewsMark('BTCUSDT') === undefined, 'reset: not recorded again');
  /* the sentiment guard as a mark: BIAS S2, 80 / 20 */
  const G = S.HG_FNG_GUARD;
  ok(G.greed === 80 && G.fear === 20, 'the guard bar is 80 / 20 (BIAS S2, hgOmniMarketSide)');
  ok(S.hgFngExtremeMark(80, 'long') === true && S.hgFngExtremeMark(79, 'long') === false && S.hgFngExtremeMark(20, 'short') === true && S.hgFngExtremeMark(21, 'short') === false, 'long vetoed at >= 80, short at <= 20, inclusive');
  ok(S.hgFngExtremeMark(85, 'short') === false && S.hgFngExtremeMark(10, 'long') === false, 'greed does not veto a short, fear does not veto a long');
  ok(S.hgFngExtremeMark(null, 'short') === undefined && S.hgFngExtremeMark('', 'short') === undefined && S.hgFngExtremeMark('15', 'short') === undefined, 'null, empty and a numeric string are NOT a read (+null is 0, which would read as extreme fear)');
  ok(S.hgFngExtremeMark(90, undefined) === undefined && S.hgFngExtremeMark(90, 'LONG') === undefined, 'no direction, no verdict');
  ok(S.hgFngExtremeMark(90, 'long', 'XAUUSD') === undefined && S.hgFngExtremeMark(90, 'long', 'PAXGUSDT') === undefined && S.hgFngExtremeMark(90, 'long', 'BTCUSDT') === true, 'a gold-lane symbol gets no verdict from a crypto sentiment index');
}

console.log('\n2. the shared news gate and GATES G5 read the flag');
{
  const S = boot(['hg-gates.js']);
  const g = S.hgNewsGate({ risk: 'low', blackout: false, unchecked: true, note: 'anything' });
  ok(g.pass === null && /news not checked/.test(g.why), 'hgNewsGate: unchecked -> UNCHECKED, whatever the note says');
  ok(S.hgNewsGate({ risk: 'low', blackout: false, note: 'no high-impact USD events within 48h' }).pass === true, 'a real low read still passes');
  ok(S.hgNewsGate({ risk: 'high', blackout: true, note: 'BLACKOUT: CPI' }).pass === false, 'a blackout still fails');
  /* GATES G5 through the real engine, the harness its own test uses */
  const E = boot(['engine.js']);
  function mkRows(n, lastClose, wickUp, wickDown){ const rows = []; for (let i = 0; i < n; i++){ const c = lastClose - 0.1 * (n - 1 - i); const isLast = i === n - 1; rows.push({ t: 1700000000 + i * 14400, o: c - 0.3, h: isLast ? lastClose + wickUp : c + 0.5, l: isLast ? lastClose - wickDown : c - 0.5, c, v: 1000 }); } return rows; }
  E.ema = (vals, p) => { const lc = vals[vals.length - 1]; const t = { 9: lc + 4, 20: lc + 2, 21: lc - 1, 50: lc - 6, 200: lc - 16 }; return vals.map(() => t[p]); };
  E.rsi = () => [50, 58]; E.atr = rows => rows.map(() => 2); E.volZ = () => 1.2;
  const inp = () => { const i = { sym: 'BTCUSDT', source: 'test', rows4h: mkRows(260, 106, 0.25, 1.0), rows1h: mkRows(120, 106, 0.25, 1.0), chg24: 2, turnoverUsd: 800e6, fundingPct: 0.01, oiChgPct: 3, retailLongPct: 50, topLongPct: 55, takerRatio: 1.1 }; return i; };
  E.hgNewsRisk = () => ({ risk: 'low', events: [], blackout: false, unchecked: true, note: 'news not loaded' });
  let r = E.gateCandidate(inp());
  ok(r.trail && r.trail[5] && r.trail[5].ok === null && /news calendar not loaded/.test(r.trail[5].note), 'G5 with an unchecked module: N/A with the manual-calendar note -- it used to print "no high-impact events inside the blackout window"');
  E.hgNewsRisk = () => ({ risk: 'low', events: [], blackout: false, note: 'no high-impact USD events within 48h' });
  r = E.gateCandidate(inp());
  ok(r.trail[5].ok === true && /no high-impact events inside the blackout window/.test(r.trail[5].note), 'G5 with a real low read: PASS, as before');
  E.hgNewsRisk = () => ({ risk: 'high', events: [], blackout: true, note: 'BLACKOUT: CPI' });
  r = E.gateCandidate(inp());
  ok(r.pass === false && r.vetoGate === 'G5', 'G5 with a blackout: VETO, as before');
}

console.log('\n3. STAR TRADER casts no NEWS vote on an unchecked calendar');
{
  const S = boot(['indicators.js', 'indicators2.js', 'cryptogates.js', 'plans.js', 'edge.js', 'setup-stack.js', 'hg-forward.js', 'news.js', 'startradertab.js']);
  const c = { sym: 'BTCUSD', base: 'BTC', klass: 'crypto' };
  const votesOf = (r) => (r.votes || []).filter(v => v.src === 'NEWS');
  ok(votesOf(S.stContextVotes(c, 'long', {}, {}, null, null, null)).length === 0, 'cold cache: NO news vote (it used to be +1 "calendar clear")');
  S.__hgNewsSeed([], { value: 40 }, []);
  ok(votesOf(S.stContextVotes(c, 'long', {}, {}, null, null, null)).length === 0, 'calendar leg failed: NO news vote');
  S.__hgNewsSeed([EUR_ONLY], null, []);
  const v = votesOf(S.stContextVotes(c, 'long', {}, {}, null, null, null));
  ok(v.length === 1 && v[0].pts === 1 && v[0].detail === 'calendar clear', 'a READ clear calendar still votes +1');
  S.__hgNewsSeed([CPI_LATER], null, []);
  const v2 = votesOf(S.stContextVotes(c, 'long', {}, {}, null, null, null));
  ok(v2.length === 1 && v2[0].pts === 0 && v2[0].caution === true, 'a red print on the horizon still cautions');
  S.__hgNewsSeed([CPI_SOON], null, []);
  ok(S.stContextVotes(c, 'long', {}, {}, null, null, null).veto === true, 'a blackout still vetoes');
  /* and the vote:NEWS read mark follows: absent on an unchecked calendar */
  S.__hgNewsReset();
  const setup = { dir: 'long', allVotes: S.stContextVotes(c, 'long', {}, {}, null, null, null).votes };
  ok(!S.stReadMarks(setup) || S.stReadMarks(setup)['vote:NEWS'] === undefined, 'so the hg-v991 vote:NEWS mark is ABSENT rather than a fabricated true');
}

console.log('\n4. the ledger stamps the calendar class and the sentiment guard on every record');
{
  const S = boot(['hg-forward.js', 'news.js']);
  const sec = 3600, bar = Math.floor(now / sec) * sec - 2 * sec;
  const row = (sym, dir, extra) => Object.assign({ sym, dir, entry: 100, stop: dir === 'long' ? 99 : 101, t1: dir === 'long' ? 102 : 98, mark: 100, barT: bar }, extra || {});
  /* dark module: nothing recorded */
  S.hgFwdRecordScan('T', '1h', [row('AUSD', 'long')], { horizonBars: 20 });
  let r = S.hgFwdRecords('T')[0];
  ok(r.newsRisk === undefined && r.fng === undefined && r.fngVeto === undefined, 'with the news module cold, all three are NOT RECORDED');
  /* calendar failed, F&G loaded at greed */
  S.__hgNewsSeed([], { value: 85, classification: 'Extreme Greed' }, []);
  S.hgFwdRecordScan('T', '1h', [row('BUSD', 'long'), row('CUSD', 'short'), row('XAUUSD', 'long')], { horizonBars: 20 });
  const by = {}; S.hgFwdRecords('T').forEach(x => { by[x.sym] = x; });
  ok(by.BUSD.newsRisk === undefined && by.BUSD.fng === 85 && by.BUSD.fngVeto === true, 'a long at F&G 85 with the calendar unchecked: news NOT RECORDED, fng 85, the guard would have VETOED');
  ok(by.CUSD.fngVeto === false, 'a short at 85 is not vetoed by the guard');
  ok(by.XAUUSD.fng === 85 && by.XAUUSD.fngVeto === undefined, 'a gold record carries the value and NO verdict -- the index does not speak for gold');
  /* calendar loaded: blackout, high, low */
  S.__hgNewsSeed([CPI_SOON], { value: 50 }, []);
  S.hgFwdRecordScan('T', '1h', [row('DUSD', 'long')], { horizonBars: 20 });
  S.__hgNewsSeed([CPI_LATER], { value: 50 }, []);
  S.hgFwdRecordScan('T', '1h', [row('EUSD', 'long')], { horizonBars: 20 });
  S.__hgNewsSeed([EUR_ONLY], { value: 50 }, []);
  S.hgFwdRecordScan('T', '1h', [row('FUSD', 'long'), row('GUSD', 'long', { newsRisk: 'blackout', fngVeto: true, fng: 99 })], { horizonBars: 20 });
  S.hgFwdRecords('T').forEach(x => { by[x.sym] = x; });
  ok(by.DUSD.newsRisk === 'blackout' && by.EUSD.newsRisk === 'high' && by.FUSD.newsRisk === 'low', 'blackout, high and low are read from the one home at fire time');
  ok(by.FUSD.fngVeto === false && by.FUSD.fng === 50, 'F&G 50 on a long: allowed');
  ok(by.GUSD.newsRisk === 'blackout' && by.GUSD.fngVeto === true && by.GUSD.fng === 99, 'a desk that hands valid values in wins over the shared read');
  S.hgFwdRecordScan('T', '1h', [row('HUSD', 'long', { newsRisk: 'LOW', fng: '55', fngVeto: 1 })], { horizonBars: 20 });
  S.hgFwdRecords('T').forEach(x => { by[x.sym] = x; });
  ok(by.HUSD.newsRisk === 'low' && by.HUSD.fng === 50 && by.HUSD.fngVeto === false, 'junk hand-ins (LOW, "55", 1) are ignored and the shared read decides -- never coerced');
  /* a desk verdict that DISAGREES with the shared read wins: F&G 50 on a long reads allowed, the desk says vetoed */
  S.hgFwdRecordScan('T', '1h', [row('IUSD', 'long', { fng: 50, fngVeto: true })], { horizonBars: 20 });
  S.hgFwdRecords('T').forEach(x => { by[x.sym] = x; });
  ok(by.IUSD.fng === 50 && by.IUSD.fngVeto === true, 'a valid desk verdict wins over the shared read even when the two disagree');
  /* the second door: hgFwdRecord / hgFwdNormalize take a record with no scan helpers in front of them, so the normaliser itself must refuse junk */
  const nj = S.hgFwdNormalize(Object.assign(row('JUSD', 'long'), { tab: 'T', tf: '1h', mechanic: 'X', newsRisk: 'LOW', fng: 55, fngVeto: 1 }));
  ok(nj && nj.newsRisk === undefined && nj.fngVeto === undefined && nj.fng === 55, 'through the direct door, LOW is not a class and 1 is not a boolean -- NOT RECORDED, never coerced; the number is kept');
  const nk = S.hgFwdNormalize(Object.assign(row('KUSD', 'short'), { tab: 'T', tf: '1h', mechanic: 'X', newsRisk: 'med', fng: '55', fngVeto: false }));
  ok(nk && nk.newsRisk === 'med' && nk.fngVeto === false && nk.fng === undefined, 'and the four classes and the two booleans pass; a string F&G does not');
  /* settle and split */
  const win = [{ t: bar + sec, o: 100, h: 103, l: 99.5, c: 102.5 }], lose = [{ t: bar + sec, o: 100, h: 100.5, l: 98.5, c: 98.7 }], winS = [{ t: bar + sec, o: 100, h: 100.5, l: 97, c: 97.5 }];
  S.hgFwdResolve('AUSD', '1h', win); S.hgFwdResolve('BUSD', '1h', lose); S.hgFwdResolve('CUSD', '1h', winS); S.hgFwdResolve('DUSD', '1h', lose); S.hgFwdResolve('EUSD', '1h', win); S.hgFwdResolve('FUSD', '1h', win); S.hgFwdResolve('GUSD', '1h', lose); S.hgFwdResolve('HUSD', '1h', win);
  const ns = S.hgFwdNewsSplit('T');
  ok(ns.settled === 8 && ns.marked === 5 && ns.unmarked === 3, 'news split: 8 settled, 5 carry a class, 3 (cold, calendar-failed, gold-under-failed) count as NEITHER');
  ok(ns.classes.blackout.n === 2 && ns.classes.blackout.wins === 0 && ns.classes.high.n === 1 && ns.classes.low.n === 2 && ns.classes.low.hit === 1 && ns.classes.med.n === 0, 'the classes partition the marked set (blackout 2, high 1, low 2)');
  const ss = S.hgFwdSentimentSplit('T');
  /* the XAUUSD record is never resolved (no gold bars are handed in), so it is not settled; H reads the shared F&G 50 and is allowed */
  ok(ss.settled === 8 && ss.veto === 2 && ss.ok === 5 && ss.unmarked === 1, 'sentiment split: 2 would-veto (B, G), 5 allowed (C, D, E, F, H), 1 unmarked (the cold record)');
  ok(ss.vetoR === -1 && Math.abs(ss.okHit - 0.8) < 1e-9 && Math.abs(ss.okR - 1.4) < 1e-9, 'the would-veto cohort lost both, the allowed cohort won four of five');
  const h1 = text(S.hgFwdNewsSplitHtml('T')), h2 = text(S.hgFwdSentimentSplitHtml('T'));
  ok(/NEWS CALENDAR SPLIT/.test(h1) && /blackout -1\.000R at 0% on n=2/.test(h1) && /3 carry no class and are counted as NEITHER/.test(h1) && /Reported, not gated/.test(h1), 'the news line names each class and the unmarked count');
  ok(/SENTIMENT GUARD SPLIT/.test(h2) && /2 of 7 marked settled records/.test(h2) && /vetoed -1\.000R at 0% on n=2/.test(h2) && /allowed \+1\.400R at 80% on n=5/.test(h2) && /1 carry no mark/.test(h2), 'the sentiment line names both cohorts and the unmarked count');
  ok(S.hgFwdNewsSplitHtml('NOPE') === '' && S.hgFwdSentimentSplitHtml('NOPE') === '', 'a desk with no marks renders NOTHING');
  const fold = S.hgFwdFold({}, S.hgFwdRecords('T'))['T|1h'];
  ok(fold.nw && fold.nw.blackout.losses === 2 && fold.nw.high.wins === 1 && fold.nw.low.wins === 2 && !fold.nw.med && fold.fv.losses === 2 && fold.fo.wins === 4, 'the fold carries the classes and the guard pair; unmarked into neither');
  S.localStorage.setItem('hg_forward_agg_v1', JSON.stringify({ 'T|1h': { tab: 'T', wins: 1, losses: 1, expired: 0, rrSum: 2, nw: { blackout: { wins: 1, losses: 9, expired: 0 } }, fv: { wins: 2, losses: 8, expired: 0 } } }));
  ok(S.hgFwdNewsSplit('T').agg.blackout.losses === 9 && S.hgFwdSentimentSplit('T').agg.veto.losses === 8, 'the folded tails beyond the live cap read back');
  ok(/folded beyond the live cap: blackout 1W\/9L/.test(text(S.hgFwdNewsSplitHtml('T'))) && /vetoed 2W\/8L/.test(text(S.hgFwdSentimentSplitHtml('T'))), 'and print');
  ok(/NEWS CALENDAR SPLIT/.test(S.hgFwdPanelHTML('T', { minRr: 2 })) && /SENTIMENT GUARD SPLIT/.test(S.hgFwdPanelHTML('T', { minRr: 2 })), 'the shared forward panel carries both lines');
}

console.log('\n5. the mark equals the guards in force');
{
  /* hgOmniMarketSide stands aside at the same bar */
  const S = boot(['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'plans.js', 'hg-mechanics.js', 'hg-forward.js', 'hg-gates.js', 'hg-plan.js', 'news.js', 'omniroute.js']);
  const up = { longs: 4, shorts: 0, mixed: 0, total: 4, majority: 'long', rows: [] };
  let agree = 0, tried = 0;
  for (const v of [0, 10, 19, 20, 21, 50, 79, 80, 81, 100]){
    const ms = S.hgOmniMarketSide(up, { v, c: 'x' });
    const aside = ms && /ASIDE/i.test(String(ms.call || ms.side || ms.verdict || JSON.stringify(ms)));
    const mark = S.hgFngExtremeMark(v, 'long', 'BTCUSDT');
    tried++; if (aside === mark) agree++;
  }
  ok(tried === 10 && agree === 10, 'on a long tape, hgOmniMarketSide stands aside exactly where the mark says the guard vetoes (10/10 F&G values)');
  const idx = strip(read('index.html'));
  ok(/\(dailyDir==='long'&&v>=80\)\|\|\(dailyDir==='short'&&v<=20\)/.test(idx), 'BIAS S2 in the shell reads the same 80 / 20 bar (textual: the inline runBias)');
  ok(/fv >= 75 && dir === 'long'/.test(strip(read('startradertab.js'))), 'STAR TRADER votes SENTIMENT at 75 / 25 -- a different bar, left as it is and named');
  const fwd = strip(read('hg-forward.js'));
  ok(!/hgNewsMark|hgFngExtremeMark/.test(strip(read('hg-gates.js')) + strip(read('hg-solidity.js')) + strip(read('cryptogates.js'))), 'no gate module reads the marks');
  ok((fwd.match(/hgFngExtremeMark/g) || []).length === 2 && (fwd.match(/hgNewsMark/g) || []).length === 2, 'the ledger reads each mark through one guard-and-call pair');
}

console.log('\n6. version stamps');
{
  const v = (read('build-stamp.js').match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(/^hg-v\d+$/.test(v) && parseInt(v.slice(4), 10) >= 992, 'build-stamp version ' + v);
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
}

console.log('\n' + passed + ' assertions passed');
