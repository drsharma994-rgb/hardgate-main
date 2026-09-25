/* HARDGATE -- hg-v974: the last two borrowers of the GOLD SCALP mint --
   OMNIGOLD's engine bridge and STAR TRADER's gold lane -- fed at last.

   Every other desk that borrows goldScalpSetups / goldSwingSetups was fed
   over hg-v971..v973. Two callers were left. (1) OMNIGOLD's bridge
   (hgOgRunGoldTabEngines) copied rows, macro and news into the mint input
   and NOTHING ELSE -- while `shared`, built by the same scan, has carried the
   desk's quote (bid / ask / spread / venue from the Delta payload, hg-v969),
   its perp payload and the feed label since those packs shipped. So the two
   borrowed mints ran on OMNIGOLD without the spread lock, the L2 book, the
   OI / funding reads or the volume-trust rule, and on the wall clock.
   (2) STAR TRADER handed the mint `newsState` -- a key the mint has NEVER
   read (its key is `news`), so the news gate failed open there on every
   scan -- and 15m bars alone: no 1h / 4h legs, no macro, the wall clock; and
   its vote read `top.kind`, a field no candidate carries.

   Sections:
     1) the bridge, driven for REAL: quote locks / reports through it, the
        book reports, the feed label withholds proxy volume, the news gate
        locks on the SIGNAL BAR, the perp payload arrives
     2) the feed builder: shared quote / broker quote / payload / nothing
     3) STAR TRADER: the recorded mint input (right key, legs, macro, bar);
        the REAL mint through the real lane: CPI on the signal bar removes
        the GOLD SCALP vote; the vote names the strategy
     4) build stamps
   Run: node tests/test-gold-last-borrowers-fed.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){} }
  return ctx;
}
const MINTS = ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'goldswing.js'];
const OG = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-forward.js',
            'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js', 'gold-formation.js', 'goldind.js', 'goldswing.js', 'omnigold.js'];
const WED = Date.UTC(2026, 3, 8, 12, 0, 0);
function tapeEnding(endMs, n, stepSec, seed, amp, drift){
  let s = seed || 99, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rows = []; let c = 2300;
  const tEnd = Math.floor(endMs / 1000), t0 = tEnd - (n - 1) * stepSec;
  for (let i = 0; i < n; i++){
    const shock = (rnd() < 0.06) ? (rnd() - 0.5) * (amp || 24) : 0;
    const o = c; c = o + (drift || 0) * (stepSec / 14400) + Math.sin(i / 25) * 2.0 + (rnd() - 0.5) * 3.4 + shock;
    const w = 0.8 + rnd() * 2.6;
    rows.push({ t: t0 + i * stepSec, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 700 + rnd() * 2200 });
  }
  return rows;
}
const board = c => [c.entry, c.stop, c.t1, c.dir, c.stratKey, !!c.demoted, (c.stamps || []).join('+')].join('|');
const same = (a, b) => a.length === b.length && a.map(board).join('~') === b.map(board).join('~');
const lv = (p, s) => ({ price: p, size: s });
const BOOK = { bids: [lv(4300.4, 10), lv(4300.3, 10)], asks: [lv(4300.6, 10), lv(4300.7, 10)] };
const WIDE = 0.60;
const PERP = { ok: true, ticker: { bid: 4300.40, ask: 4301.00, spreadUsd: WIDE }, l2: BOOK, oi: [], funding: [] };

console.log('== 1) the OMNIGOLD bridge, driven for real ==');
{
  /* the scalp mint reads the 15m and 1d legs the bridge fetches itself; the
     scan's own 1h / 4h legs come in as arguments. Seed 118 (a tape where the
     volume-trust rule is visible) for scalp; seed 103 falling for swing. */
  const m15 = tapeEnding(WED, 420, 900, 118, 24), r1h = tapeEnding(WED, 220, 3600, 119, 30), r4h = tapeEnding(WED, 300, 14400, 103, 40, -0.3), d1 = tapeEnding(WED, 150, 86400, 106, 60, -0.3);
  function bridge(shared, label, m15x){
    const W = boot(OG);
    W.getGoldCandles = (tf) => Promise.resolve({ rows: tf === '15m' ? (m15x || m15) : (tf === '1d' ? d1 : []), source: 'binance-paxg' });
    return W.hgOgRunGoldTabEngines(shared, r1h, r4h, label);
  }
  const base = await bridge({}, undefined);
  const sc0 = base.scalp ? base.scalp.ranked : [], sw0 = base.swing ? base.swing.ranked : [];
  assert(base && base.ok !== false && sc0.length > 0 && sw0.length > 0, 'REACHABILITY: the bridge mints on both lanes with an empty shared context (scalp ' + sc0.length + ', swing ' + sw0.length + ')');
  const unnamed = await bridge({ spreadUsd: WIDE, bid: 4300.4, ask: 4301, spreadVenue: null });
  assert(unnamed.scalp.ranked.length === 0 && unnamed.swing.ranked.length === 0, 'the SPREAD LOCK reaches both mints through the bridge: a wide UNNAMED quote in shared locks every candidate');
  const named = await bridge({ spreadUsd: WIDE, bid: 4300.4, ask: 4301, spreadVenue: 'delta-xaut' });
  assert(same(named.scalp.ranked, sc0) && same(named.swing.ranked, sw0), 'a wide PROXY quote (the venue hg-v969 stamps) moves NO board on either lane');
  assert(named.scalp.ranked.every(c => (c.notes || []).some(n => /SPREAD WIDE/.test(n) && /delta-xaut/.test(n))) && named.swing.ranked.every(c => (c.notes || []).some(n => /SPREAD WIDE/.test(n))), 'and lands the SPREAD WIDE read on every card of both lanes');
  const booked = await bridge({ perpNative: PERP, spreadVenue: 'delta-xaut' });
  assert(same(booked.scalp.ranked, sc0) && same(booked.swing.ranked, sw0) && booked.swing.ranked.every(c => (c.notes || []).some(n => /L2 READ/.test(n))), 'the L2 BOOK is read off the perp payload in shared: reports on the swing lane, moves nothing');
  const l2direct = await bridge({ l2: Object.assign({ venue: 'delta-xaut' }, BOOK) });
  assert(l2direct.swing.ranked.every(c => (c.notes || []).some(n => /L2 READ/.test(n))), 'a book already on shared is used as is');
  const xm = await bridge({}, 'xm-xauusd'), px = await bridge({}, 'binance-paxg');
  /* the bridge RANKS the mint output (goldRankSetups re-orders and re-grades
     from its own tally), so the honest observable through the bridge is the
     agreeing-read count per mechanic, matched by key rather than by position */
  const byKey = list => { const m = {}; for (const c of list) m[c.stratKey] = c; return m; };
  const kx = byKey(xm.scalp.ranked), kp = byKey(px.scalp.ranked);
  assert(xm.scalp.ranked.length === 4 && px.scalp.ranked.length === 4 && Object.keys(kx).every(k => kp[k] && kp[k].agree === kx[k].agree - 1), 'the FEED LABEL reaches the scalp mint: named binance-paxg withholds the volume votes and every candidate is one agreeing read down (' + Object.keys(kx).map(k => k + ' ' + kx[k].agree + '->' + kp[k].agree).join(', ') + '); the broker label keeps them');
  const kb = byKey(base.scalp.ranked);
  assert(same(base.scalp.ranked, xm.scalp.ranked) && Object.keys(kx).every(k => kb[k] && kb[k].agree === kx[k].agree), 'and with no label the mint trusts the volume exactly as before, read for read (the bridge invents no label -- a mutation defaulting it to the proxy survived the board comparison alone)');
  /* the instant: a CPI 10 minutes AFTER the last 15m bar. The wall clock is
     months away, so only a bridge judging on the SIGNAL BAR can be locked. */
  const lastBar = m15[m15.length - 1].t * 1000;
  const cpi = { events: [{ title: 'US CPI m/m', t: lastBar + 10 * 60000 }] };
  const news = await bridge({ news: cpi });
  assert(news.scalp.ranked.length === 0 && news.swing.ranked.length === 0, 'the NEWS GATE judges on each lane\'s signal bar: a release 10 min after the last bar locks both lanes (the wall clock, months later, could not)');
  const far = await bridge({ news: { events: [{ title: 'US CPI m/m', t: lastBar + 6 * 3600000 }] } });
  assert(far.scalp.ranked.length === sc0.length && far.swing.ranked.length === sw0.length, 'and a release six hours out locks neither');
  /* the swing lane judges on the 4h bar and the scalp lane on the 15m bar --
     two instants, so a release inside one window and outside the other locks
     one lane only */
  const last4h = r4h[r4h.length - 1].t * 1000;
  const swingOnly = await bridge({ news: { events: [{ title: 'US NFP', t: last4h + 10 * 60000 }] } }, undefined, tapeEnding(last4h - 3 * 3600000, 420, 900, 118, 24));
  assert(swingOnly.swing.ranked.length === 0 && swingOnly.scalp.ranked.length > 0, 'two instants: a release 10 min after the 4h bar locks the swing lane and leaves a scalp lane whose 15m bar sits three hours earlier');
  const src = read('omnigold.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert((src.match(/hgOgRunGoldTabEngines\(shared, res\.scalp\.rows, res\.swing\.rows, res\.scalp\.source\)/g) || []).length === 2, 'both call sites hand the bridge the scan\'s own feed label (textual, hg-v956: the scan body is network-bound)');
}

console.log('== 2) the feed builder ==');
{
  const W = boot(OG);
  const fb = W.hgOgBridgeFeedFromShared;
  assert(typeof fb === 'function', 'hgOgBridgeFeedFromShared is exported');
  const a = fb({ spreadUsd: WIDE, bid: 4300.4, ask: 4301, spreadVenue: 'delta-xaut', perpNative: PERP });
  assert(a.quote && Math.abs(a.quote.spreadUsd - WIDE) < 1e-9 && a.quote.venue === 'delta-xaut' && a.quote.bid === 4300.4, 'the hg-v969 quote fields on shared become the applier quote, venue carried');
  assert(a.l2 && a.l2.bids.length === 2 && a.l2.venue === 'delta-xaut' && a.perp === PERP, 'the book is read off the payload through hgGoldL2FromPerp, and the payload rides along');
  const b = fb({ quote: { bid: 4300.50, ask: 4300.60 } });
  assert(b.quote && Math.abs(b.quote.spreadUsd - 0.10) < 1e-9 && b.quote.venue === null, 'a broker quote on shared (no venue) is used as is -- and, naming no venue, it stays under the broker bar');
  const c = fb({ quote: { bid: 4300.50, ask: 4300.60 }, spreadUsd: 9, spreadVenue: 'delta-xaut' });
  assert(Math.abs(c.quote.spreadUsd - 0.10) < 1e-9, 'a broker quote WINS over the proxy fields beside it');
  const d = fb({ l2: BOOK, perpNative: PERP });
  assert(d.l2 === BOOK, 'a book already on shared wins over the payload read');
  const e = fb({ perpNative: { ok: false } });
  assert(e.perp === null && e.l2 === null, 'a failed payload attaches nothing');
  const f = fb({}), g = fb(null), h = fb({ spreadUsd: null, quote: { bid: null, ask: 1 } });
  assert(f.quote === null && g.quote === null && h.quote === null && f.l2 === null && f.perp === null && f.macro === null, 'nothing in, nothing out -- no quote invented from a null (isFinite(+null) is the trap)');
}

console.log('== 3) STAR TRADER\'s gold lane ==');
{
  const ST = ['indicators.js', 'cryptogates.js', 'edge.js', 'setup-stack.js', 'startradertab.js'];
  const W = boot(ST);
  const rows15 = tapeEnding(WED, 60, 900, 6, 24), rows1h = tapeEnding(WED, 80, 3600, 7, 30), rows4h = tapeEnding(WED, 120, 14400, 8, 40);
  const calls = [];
  W.goldScalpSetups = inp => { calls.push(inp); return [{ dir: 'long', strategy: 'LIQ SWEEP REVERSAL', stratKey: 'liqsweep' }]; };
  W.hgGoldSignalBarMs = rows => rows[rows.length - 1].t * 1000;
  const SNAP = { events: [{ title: 'US CPI m/m', t: WED }], fng: { value: 45 } };
  const MAC = { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' };
  const cx = W.stContextVotes({ gold: true, sym: 'XAUUSD', klass: 'metal' }, 'long', { newsState: SNAP, goldMacro: MAC }, {}, rows4h, rows1h, rows15);
  assert(calls.length === 1, 'the gold lane calls the mint once');
  const inp = calls[0];
  assert(inp.news === SNAP && !('newsState' in inp), 'the snapshot travels under the key the mint READS (`news`), and the dead key is gone');
  assert(inp.rows15m === rows15 && inp.rows1h === rows1h && inp.rows4h === rows4h, 'the 1h and 4h legs travel with the 15m bars');
  assert(inp.macro === MAC, 'the desk\'s own getGoldMacro read reaches the mint (the lock can run)');
  assert(inp.now === rows15[rows15.length - 1].t * 1000, 'the instant is the 15m signal bar');
  const v = (cx.votes || []).find(x => x.src === 'GOLD SCALP');
  assert(v && v.detail === 'LIQ SWEEP REVERSAL', 'the vote names the strategy the candidate carries (top.kind was a field no candidate has)');
  /* no goldMacro on ctx: the cached snapshot, and with none, null */
  const calls2 = []; W.goldScalpSetups = inp => { calls2.push(inp); return []; };
  W.getGoldMacroCached = () => ({ cached: true });
  W.stContextVotes({ gold: true, sym: 'XAUUSD' }, 'long', { newsState: null }, {}, rows4h, rows1h, rows15);
  assert(calls2.length === 1 && calls2[0].macro && calls2[0].macro.cached === true && calls2[0].news === null, 'with no warmed read the cached snapshot fills macro; a null snapshot travels as null');
  delete W.getGoldMacroCached; delete W.hgGoldSignalBarMs;
  const calls3 = []; W.goldScalpSetups = inp => { calls3.push(inp); return []; };
  W.stContextVotes({ gold: true, sym: 'XAUUSD' }, 'long', {}, {}, rows4h, rows1h, rows15);
  assert(calls3.length === 1 && calls3[0].macro === null && calls3[0].now === undefined, 'with neither, null macro and no instant invented');
  /* the REAL mint through the real lane: seed 102 forms shorts on the 15m
     tape; a CPI ten minutes after the signal bar removes the vote */
  const R = boot(['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'cryptogates.js', 'edge.js', 'setup-stack.js', 'startradertab.js']);
  const s15 = tapeEnding(WED, 420, 900, 102, 24), s1h = tapeEnding(WED, 220, 3600, 103, 30), s4h = tapeEnding(WED, 140, 14400, 104, 40);
  const open = R.stContextVotes({ gold: true, sym: 'XAUUSD' }, 'short', { newsState: null }, {}, s4h, s1h, s15);
  assert((open.votes || []).some(x => x.src === 'GOLD SCALP' && x.dir === 'short'), 'REACHABILITY: the real mint casts a GOLD SCALP short vote on seed 102');
  const lastBar = s15[s15.length - 1].t * 1000;
  const locked = R.stContextVotes({ gold: true, sym: 'XAUUSD' }, 'short', { newsState: { events: [{ title: 'US CPI m/m', t: lastBar + 10 * 60000 }] } }, {}, s4h, s1h, s15);
  assert(!(locked.votes || []).some(x => x.src === 'GOLD SCALP'), 'a CPI ten minutes after the signal bar LOCKS the mint and the vote is gone -- the gate that never fired here');
  const src = read('startradertab.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert(!/newsState: ctx\.newsState/.test(src), 'no call hands the mint `newsState` any more');
}

console.log('== 4) build stamps ==');
{
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
