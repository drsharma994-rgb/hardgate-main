/* HARDGATE -- hg-v994: THE ROTATION SEASON REACHED ONE OF ITS FOUR CONSUMERS.

   rotation.js snapshots season 'alt' | 'btc' | 'mixed' (+ altPct). BRAIN read
   it. STAR TRADER fed the snapshot back into rotationSignal (which wants the
   raw market list, so it answered 'mixed' every time) and compared against
   'altseason' / 'btcseason', strings the signal never emits -- its ROTATION
   vote never fired. The FTS setup stack read `rot.btcSeason`, never carried
   -- its caution never fired. AI AGENT read `rot.leader`, never carried.

   The two directional reads live once now (hgRotationAgainst / Favours in
   rotation.js), the three consumers read the season the snapshot carries,
   and the forward ledger records season, alt share and the against verdict.
   Nothing is gated on the marks. Node 18+, no network. */
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
function trendRows(n, stepSec){
  const rows = []; let c = 100;
  for (let i = 0; i < n; i++){ c += 0.3; rows.push({ t: 1700000000 + i * stepSec, o: c, h: c + 0.2, l: c - 0.2, c, v: 1000 }); }
  return rows;
}

console.log('1. rotation.js: the two directional reads, one home, three states');
{
  const S = boot(['indicators.js', 'cryptogates.js', 'plans.js', 'rotation.js']);
  const A = S.hgRotationAgainst, F = S.hgRotationFavours;
  ok(typeof A === 'function' && typeof F === 'function' && typeof S.hgRotationMark === 'function', 'hgRotationAgainst, hgRotationFavours and hgRotationMark are exported');
  ok(A('btc', 'long', 'ETHUSDT') === true && A('btc', 'long', 'SOL-PERP') === true, 'BTC season is a headwind for an alt long');
  ok(A('btc', 'long', 'BTCUSDT') === false && A('btc', 'long', 'BTC-PERP') === false && A('btc', 'long', 'BTCUSD') === false && A('btc', 'long', 'BTC') === false, 'and never for a BTC long, under any of the contract spellings');
  ok(A('btc', 'short', 'ETHUSDT') === false && A('alt', 'long', 'ETHUSDT') === false && A('mixed', 'long', 'ETHUSDT') === false, 'a short, alt season or a mixed read is not against');
  ok(A('altseason', 'long', 'ETHUSDT') === undefined && A('btcseason', 'long', 'BTCUSDT') === undefined, 'the strings STAR TRADER used to compare against are not seasons -- no verdict');
  ok(A('', 'long', 'ETHUSDT') === undefined && A(undefined, 'long', 'ETHUSDT') === undefined && A('btc', 'flat', 'ETHUSDT') === undefined && A('btc', '', 'ETHUSDT') === undefined, 'an unknown season or no direction is no verdict');
  ok(A('BTC', 'LONG', 'ethusdt') === true, 'case is normalised on every argument');
  ok(F('alt', 'long', 'SOLUSDT') === true && F('alt', 'long', 'BTCUSDT') === false, 'alt season favours an alt long, not a BTC long');
  ok(F('btc', 'long', 'BTCUSD') === true && F('btc', 'long', 'ETHUSDT') === false, 'BTC season favours a BTC long, not an alt long');
  ok(F('alt', 'short', 'SOLUSDT') === false && F('btc', 'short', 'BTCUSDT') === false && F('mixed', 'long', 'SOLUSDT') === false, 'this layer has never voted a short, and a mixed read favours nothing');
  ok(F('altseason', 'long', 'SOLUSDT') === undefined && F('alt', 'flat', 'SOLUSDT') === undefined, 'unknown season or direction: no verdict');
  /* the mark reads the live snapshot */
  const NOW = Date.now();
  S.rotationState = () => null;
  let m = S.hgRotationMark('long', 'ETHUSDT');
  ok(m.season === undefined && m.altPct === undefined && m.against === undefined && m.ageMin === undefined, 'a dark snapshot records nothing');
  S.rotationState = () => ({ season: 'btc', altPct: 22.5, evidence: [], at: NOW - 45 * 60000 });
  m = S.hgRotationMark('long', 'ETHUSDT');
  ok(m.season === 'btc' && m.altPct === 22.5 && m.against === true && m.ageMin === 45, 'BTC season at 45 min: an alt long reads against, the alt share and the age ride');
  m = S.hgRotationMark('long', 'BTCUSDT');
  ok(m.season === 'btc' && m.against === false, 'a BTC long under BTC season is not against');
  m = S.hgRotationMark('long', 'XAUUSD');
  ok(m.season === undefined && m.altPct === undefined && m.against === undefined, 'a gold-lane symbol gets nothing -- the altseason index does not speak for gold');
  S.rotationState = () => ({ season: 'alt', altPct: '80', at: '5' });
  m = S.hgRotationMark('long', 'SOLUSDT');
  ok(m.season === 'alt' && m.altPct === undefined && m.ageMin === undefined && m.against === false, 'a string alt share or stamp is not a read (never coerced); the season still lands');
  S.rotationState = () => ({ season: 'altseason', altPct: 80, at: NOW });
  m = S.hgRotationMark('long', 'SOLUSDT');
  ok(m.season === undefined && m.against === undefined && m.altPct === 80, 'an unknown season string records no season and no verdict');
  S.rotationState = () => { throw new Error('boom'); };
  m = S.hgRotationMark('long', 'SOLUSDT');
  ok(m.season === undefined && m.against === undefined, 'a throwing snapshot records nothing');
}

console.log('2. STAR TRADER casts the ROTATION vote it never cast');
{
  const files = ['indicators.js', 'cryptogates.js', 'edge.js', 'setup-stack.js', 'startradertab.js', 'rotation.js'];
  const S = boot(files);
  const rows = trendRows(80, 14400);
  S.hgNewsRisk = () => ({ risk: 'low' });
  const votesFor = (sym, dir) => S.stContextVotes({ sym, klass: 'crypto' }, dir, S.stBuildContext(), { mark: 100 }, rows, rows, rows);
  const rot = (r) => (r.votes || []).filter(v => v.src === 'ROTATION');
  S.rotationState = () => ({ season: 'alt', altPct: 80, evidence: [], at: Date.now() });
  let r = votesFor('SOLUSD', 'long');
  ok(!r.veto && rot(r).length === 1 && rot(r)[0].pts === 1 && /altseason/.test(rot(r)[0].detail), 'alt season: an alt long gets the +1 altseason vote -- for the first time');
  ok(rot(votesFor('BTCUSD', 'long')).length === 0 && rot(votesFor('SOLUSD', 'short')).length === 0, 'alt season: no vote for a BTC long or any short');
  S.rotationState = () => ({ season: 'btc', altPct: 20, evidence: [], at: Date.now() });
  r = votesFor('BTCUSD', 'long');
  ok(rot(r).length === 1 && /BTC season/.test(rot(r)[0].detail), 'BTC season: a BTC long gets the vote');
  ok(rot(votesFor('SOLUSD', 'long')).length === 0, 'BTC season: an alt long gets NO vote -- and no against-vote either, because this desk never had one (nothing new is wired)');
  S.rotationState = () => ({ season: 'mixed', altPct: 50, evidence: [], at: Date.now() });
  ok(rot(votesFor('SOLUSD', 'long')).length === 0, 'a mixed read votes nothing');
  S.rotationState = () => ({ season: 'altseason', altPct: 80 });
  ok(rot(votesFor('SOLUSD', 'long')).length === 0, 'the string the old code compared against is not a season the snapshot can carry -- no vote');
  const S0 = boot(['indicators.js', 'cryptogates.js', 'edge.js', 'setup-stack.js', 'startradertab.js']);
  S0.hgNewsRisk = () => ({ risk: 'low' });
  S0.rotationState = () => ({ season: 'alt', altPct: 80 });
  const r0 = S0.stContextVotes({ sym: 'SOLUSD', klass: 'crypto' }, 'long', S0.stBuildContext(), { mark: 100 }, rows, rows, rows);
  ok(rot(r0).length === 0 && !r0.veto, 'with the one home absent the desk casts no ROTATION vote rather than carrying a second rule');
  const src = read('startradertab.js');
  ok(!/'altseason'|'btcseason'/.test(src) || !/season === 'altseason'|season === 'btcseason'/.test(src), 'no comparison against altseason / btcseason survives (textual)');
  ok(!/rotationSignal\(ctx\.rotation\)/.test(src), 'the snapshot is no longer fed back into the classifier (textual)');
}

console.log('3. the FTS setup stack cautions what it never cautioned, and only that');
{
  const S = boot(['indicators.js', 'cryptogates.js', 'plans.js', 'setup-stack.js', 'rotation.js']);
  const items = (out) => out.fundamental.items.filter(it => it.label === 'rotation');
  let out = S.hgSetupStack({ dir: 'long', sym: 'ETHUSDT', asset: 'crypto', rotation: { season: 'btc', altPct: 20 } });
  ok(items(out).length === 1 && items(out)[0].align === 'caution' && /BTC SEASON \(20% alts\)/.test(items(out)[0].detail) && out.cautions.some(c => /^rotation/.test(c)), 'BTC season on an alt long: a caution, naming the season and the alt share');
  out = S.hgSetupStack({ dir: 'long', sym: 'BTCUSDT', asset: 'crypto', rotation: { season: 'btc', altPct: 20 } });
  ok(items(out).length === 1 && items(out)[0].align === 'neutral' && out.cautions.length === 0, 'BTC season on a BTC long: neutral, never a caution');
  out = S.hgSetupStack({ dir: 'long', sym: 'ETHUSDT', asset: 'crypto', rotation: { season: 'alt', altPct: 78 } });
  ok(items(out).length === 1 && items(out)[0].align === 'neutral' && /ALT SEASON \(78% alts\)/.test(items(out)[0].detail), 'alt season on an alt long: neutral (no +1 is invented here)');
  out = S.hgSetupStack({ dir: 'short', sym: 'ETHUSDT', asset: 'crypto', rotation: { season: 'btc', altPct: null } });
  ok(items(out).length === 1 && items(out)[0].align === 'neutral' && !/alts\)/.test(items(out)[0].detail), 'a short is never cautioned; a null alt share prints no share (never 0%)');
  out = S.hgSetupStack({ dir: 'long', sym: 'ETHUSDT', asset: 'crypto', rotation: { btcSeason: 'BTC SEASON' } });
  ok(items(out).length === 0, 'the field the old code read is not a season -- nothing is bumped');
  out = S.hgSetupStack({ dir: 'long', sym: 'XAUUSD', asset: 'gold', rotation: { season: 'btc', altPct: 20 } });
  ok(items(out).length === 0, 'a gold setup takes no rotation item');
  const S0 = boot(['indicators.js', 'cryptogates.js', 'plans.js', 'setup-stack.js']);
  out = S0.hgSetupStack({ dir: 'long', sym: 'ETHUSDT', asset: 'crypto', rotation: { season: 'btc', altPct: 20 } });
  ok(items(out).length === 0, 'with the one home absent nothing is bumped rather than a second rule applied');
  ok(!/rot\.btcSeason/.test(read('setup-stack.js')), 'the dead read (rot.btcSeason) is gone from setup-stack.js (textual)');
}

console.log('4. AI AGENT reports the season and invents no finding');
{
  const S = boot(['ai-agent.js']);
  S.rotationState = () => ({ season: 'alt', altPct: 78.4, at: Date.now() });
  let r = await S.hgAgentRunOne('market-analyst');
  ok(r && r.ok !== false && /rotation alt \(78% alts\)/.test(String(r.summary || '')), 'the Market Analyst names the season and the alt share in its summary');
  ok(!(r.findings || []).some(f => f && f.src === 'ROTATION'), 'and pushes no ROTATION finding from it');
  S.rotationState = () => ({ leader: 'SOL' });
  r = await S.hgAgentRunOne('market-analyst');
  ok(!(r.findings || []).some(f => f && f.src === 'ROTATION') && !/rotation/.test(String(r.summary || '')), 'the field the old code read (leader) produces neither a finding nor a note');
  S.rotationState = () => ({ season: 'altseason', altPct: 80 });
  r = await S.hgAgentRunOne('market-analyst');
  ok(!/rotation/.test(String(r.summary || '')), 'an unknown season string is not reported as a season');
  ok(!/rot\.leader/.test(read('ai-agent.js')), 'the dead read is gone from ai-agent.js (textual)');
}

console.log('5. the ledger records the season, folds it and prints the split');
{
  const S = boot(['indicators.js', 'cryptogates.js', 'plans.js', 'rotation.js', 'hg-forward.js']);
  const sec = 3600, bar = Math.floor(Date.now() / sec) * sec - 2 * sec;
  const row = (sym, dir, extra) => Object.assign({ sym, dir, entry: 100, stop: dir === 'long' ? 99 : 101, t1: dir === 'long' ? 102 : 98, mark: 100, barT: bar }, extra || {});
  const by = {}; const refresh = () => S.hgFwdRecords('T').forEach(x => { by[x.sym] = x; });
  S.rotationState = () => null;
  S.hgFwdRecordScan('T', '4h', [row('AUSD', 'long')], { horizonBars: 20 });
  refresh();
  ok(by.AUSD.rotSeason === undefined && by.AUSD.rotAltPct === undefined && by.AUSD.rotAgainst === undefined, 'a dark snapshot: all three NOT RECORDED');
  S.rotationState = () => ({ season: 'btc', altPct: 21.7, evidence: [], at: Date.now() - 600000 });
  S.hgFwdRecordScan('T', '4h', [row('ETHUSDT', 'long'), row('BTCUSDT', 'long'), row('SOLUSDT', 'short'), row('XAUUSD', 'long')], { horizonBars: 20 });
  refresh();
  ok(by.ETHUSDT.rotSeason === 'btc' && by.ETHUSDT.rotAltPct === 21.7 && by.ETHUSDT.rotAgainst === true, 'BTC season: an alt long records season, share and AGAINST');
  ok(by.BTCUSDT.rotAgainst === false && by.SOLUSDT.rotAgainst === false, 'a BTC long and a short record not-against');
  ok(by.XAUUSD.rotSeason === undefined && by.XAUUSD.rotAgainst === undefined, 'gold records nothing');
  S.hgFwdRecordScan('T', '4h', [
    row('DUSD', 'long', { rotSeason: 'alt', rotAltPct: 70, rotAgainst: true }),
    row('EUSD', 'short', { rotSeason: 'BTC', rotAltPct: '20', rotAgainst: 'yes' }),
    row('FUSD', 'long', { rotSeason: 'mixed' }),
    row('BTC-PERP', 'long', { rotAgainst: true })
  ], { horizonBars: 20 });
  refresh();
  ok(by.DUSD.rotSeason === 'alt' && by.DUSD.rotAltPct === 70 && by.DUSD.rotAgainst === true, 'a desk that hands valid values in wins on all three -- even a verdict the shared read would not give');
  ok(by.EUSD.rotSeason === 'btc' && by.EUSD.rotAltPct === 21.7 && by.EUSD.rotAgainst === false, 'junk hand-ins (BTC, "20", yes) are ignored and the shared read decides -- a short is not against, whatever the string said');
  ok(by['BTC-PERP'].rotAgainst === true && by['BTC-PERP'].rotSeason === 'btc' && by['BTC-PERP'].rotAltPct === 21.7, 'a desk verdict that DISAGREES with the shared read wins while the shared read fills the fields the desk left blank');
  ok(by.FUSD.rotSeason === 'mixed' && by.FUSD.rotAltPct === 21.7 && by.FUSD.rotAgainst === true, 'a partial hand-in keeps its season and takes the rest from the shared read');
  const nj = S.hgFwdNormalize(Object.assign(row('JUSD', 'long'), { tab: 'T', tf: '4h', mechanic: 'X', rotSeason: 'ALT', rotAltPct: '70', rotAgainst: 1 }));
  ok(nj && nj.rotSeason === undefined && nj.rotAltPct === undefined && nj.rotAgainst === undefined, 'through the direct door every junk value reads NOT RECORDED');
  const nk = S.hgFwdNormalize(Object.assign(row('KUSD', 'long'), { tab: 'T', tf: '4h', mechanic: 'X', rotSeason: 'mixed', rotAltPct: 0, rotAgainst: false }));
  ok(nk && nk.rotSeason === 'mixed' && nk.rotAltPct === 0 && nk.rotAgainst === false, 'and the valid values pass, an alt share of exactly zero included');
  /* settle: A unmarked win; ETH lose; BTC win; SOL(short) win; D lose; E(short) win; F lose (XAU, BTC-PERP unresolved) */
  const win = [{ t: bar + sec, o: 100, h: 103, l: 99.5, c: 102.5 }], lose = [{ t: bar + sec, o: 100, h: 100.5, l: 98.5, c: 98.7 }], winS = [{ t: bar + sec, o: 100, h: 100.5, l: 97, c: 97.5 }];
  S.hgFwdResolve('AUSD', '4h', win); S.hgFwdResolve('ETHUSDT', '4h', lose); S.hgFwdResolve('BTCUSDT', '4h', win); S.hgFwdResolve('SOLUSDT', '4h', winS);
  S.hgFwdResolve('DUSD', '4h', lose); S.hgFwdResolve('EUSD', '4h', winS); S.hgFwdResolve('FUSD', '4h', lose);
  const sp = S.hgFwdRotationSplit('T');
  ok(sp.settled === 7 && sp.against === 3 && sp.ok === 3 && sp.unmarked === 1, 'split: 7 settled, 3 cautioned (ETH, D, F), 3 not (BTC, SOL, E), 1 NEITHER');
  ok(sp.againstR === -1 && sp.againstHit === 0 && Math.abs(sp.okR - 2) < 1e-9 && sp.okHit === 1, 'the cautioned cohort lost all three; the other cohort won all three');
  ok(sp.seasons.btc.n === 4 && sp.seasons.alt.n === 1 && sp.seasons.mixed.n === 1, 'per-season cells partition the marked set (btc 4, alt 1, mixed 1)');
  const h = text(S.hgFwdRotationSplitHtml('T'));
  ok(/ROTATION SEASON SPLIT/.test(h) && /3 of 6 marked settled records/.test(h) && /cautioned -1\.000R at 0% on n=3/.test(h) && /not cautioned \+2\.000R at 100% on n=3/.test(h) && /by season: alt/.test(h) && /1 carry no mark/.test(h) && /Reported, not gated/.test(h), 'the line names both cohorts, the season cells and the unmarked count');
  ok(S.hgFwdRotationSplitHtml('NOPE') === '', 'a desk with no marks renders NOTHING');
  const fold = S.hgFwdFold({}, S.hgFwdRecords('T'))['T|4h'];
  ok(fold && fold.rta && fold.rto && fold.rta.wins === 0 && fold.rta.losses === 3 && fold.rto.wins === 3 && fold.rto.losses === 0, 'the fold carries the against pair (0W/3L cautioned, 3W/0L not; the open records fold nothing)');
  ok(fold.rt && fold.rt.btc && fold.rt.btc.wins + fold.rt.btc.losses === 4 && fold.rt.alt && fold.rt.mixed, 'and the season cells');
  ok(/ROTATION SEASON SPLIT/.test(text(S.hgFwdPanelHTML('T'))), 'the shared forward panel carries the line');
}

console.log('6. nothing is gated on the marks');
{
  const gateFiles = ['hg-gates.js', 'engine.js', 'cryptogates.js', 'hg-setup-core.js', 'plans.js', 'pinegate.js', 'omniroute.js', 'omnipresent.js', 'startradertab.js', 'setup-stack.js', 'brain.js'];
  const bad = gateFiles.filter(f => /\b(rotAgainst|rotSeason|rotAltPct|hgFwdRotationSplit)\b/.test(read(f)));
  ok(bad.length === 0, 'no gate module or desk reads the record marks or the split' + (bad.length ? ' (' + bad.join(', ') + ')' : ''));
  const fwd = read('hg-forward.js');
  ok((fwd.match(/typeof W\.hgRotationMark !== 'function'/g) || []).length === 1 && (fwd.match(/W\.hgRotationMark\(/g) || []).length === 1, 'the ledger reads the mark through one guard-and-call pair');
  const brain = read('brain.js');
  ok(/ro\.season === 'alt'/.test(brain) && /ro\.season === 'btc'/.test(brain), 'BRAIN still reads the season the snapshot carries (the one consumer that always did)');
}

console.log('7. version stamps');
{
  const v = (read('build-stamp.js').match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(/^hg-v\d+$/.test(v) && parseInt(v.slice(4), 10) >= 994, 'build-stamp version ' + v);
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
}
console.log('\n' + passed + ' assertions passed');
