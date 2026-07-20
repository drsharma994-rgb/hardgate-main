/* HARDGATE — rotation.js unit tests (Node 18+, builtins only).
   Loads rotation.js as a classic script in a vm context (like the browser's
   <script> globals) and asserts:
     - the pure window.rotationSignal altseason classifier (75%/25% zone
       boundaries, BTC exclusion from the denominator, missing-data honesty),
     - window.rotationDomSnapshot daily dedupe/sort/cap (one point per UTC
       day, 90 max),
     - window.rotationTrendTag + window.rotationMergeTrending (top-7 merge
       with the markets call, FUEL / EXIT LIQUIDITY / DISTRESS / UNRANKED),
     - window.rotationLeaders ranking,
     - HG_tabs registration incl. the house refresh contract (skipped: not
       run yet / busy / refreshed / failed, never throws, 5-min cache,
       force bypass on hard refresh, no auto-run on mount).
   No live network — fetch/localStorage are stubbed. Run: node tests/test-rotation.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------------- vm sandbox ---------------- */
function makeLocalStorage(){
  return {
    _m: {},
    getItem(k){ return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v){ this._m[k] = String(v); },
    removeItem(k){ delete this._m[k]; }
  };
}
const fetchCalls = [];
const sandbox = {
  window: {},
  console,
  setTimeout, clearTimeout,
  AbortController,
  localStorage: makeLocalStorage(),
  fetch: async (url) => { fetchCalls.push(url); return { ok: false, status: 503, json: async () => null }; }
};
const ctx = vm.createContext(sandbox);
vm.runInContext(readFileSync(path.join(root, 'rotation.js'), 'utf8'), ctx, { filename: 'rotation.js' });
const W = sandbox.window;

/* ---------------- fixture helpers ---------------- */
function mkt(symbol, chg30, id){
  return { id: id || String(symbol).toLowerCase(), symbol: symbol,
           price_change_percentage_30d_in_currency: chg30 };
}
/* n alts: `beats` of them outperform btcChg, rest underperform */
function altFixture(btcChg, beats, total){
  const out = [mkt('BTC', btcChg, 'bitcoin')];
  for (let i = 0; i < total; i++) out.push(mkt('ALT' + i, i < beats ? btcChg + 5 : btcChg - 5));
  return out;
}

/* ================= 0) exposure / registration ================= */
assert(typeof W.rotationSignal === 'function', 'window.rotationSignal exposed');
assert(typeof W.rotationDomSnapshot === 'function', 'window.rotationDomSnapshot exposed');
assert(typeof W.rotationTrendTag === 'function', 'window.rotationTrendTag exposed');
assert(typeof W.rotationMergeTrending === 'function', 'window.rotationMergeTrending exposed');
assert(typeof W.rotationLeaders === 'function', 'window.rotationLeaders exposed');
assert(Array.isArray(W.HG_tabs) && W.HG_tabs.length === 1, 'HG_tabs registered exactly once');
assert(W.HG_tabs[0].id === 'rotation' && W.HG_tabs[0].label === 'ROTATION'
       && typeof W.HG_tabs[0].mount === 'function' && typeof W.HG_tabs[0].refresh === 'function',
       'HG_tabs entry: id "rotation", label "ROTATION", mount + refresh functions');

/* ================= 1) rotationSignal — season math ================= */
{
  const s = W.rotationSignal({ markets: altFixture(5, 40, 49) });
  assert(s.season === 'alt' && s.altPct > 75, 'strong breadth (40/49 = 81.6%) => season "alt"');
  assert(s.evidence.join(' ').indexOf('40/49') > -1 && s.evidence.join(' ').indexOf('ALT SEASON') > -1,
         'evidence reports beats/total and the ALT SEASON zone note');
}
{
  const s = W.rotationSignal({ markets: altFixture(5, 15, 20) }); // 15/20 = 75.0 exactly
  assert(s.season === 'alt' && s.altPct === 75, 'boundary: exactly 75% => "alt" (>= 75)');
}
{
  const s = W.rotationSignal({ markets: altFixture(5, 5, 20) }); // 5/20 = 25.0 exactly
  assert(s.season === 'btc' && s.altPct === 25, 'boundary: exactly 25% => "btc" (<= 25)');
}
{
  const hi = W.rotationSignal({ markets: altFixture(5, 37, 50) }); // 74%
  const lo = W.rotationSignal({ markets: altFixture(5, 13, 50) }); // 26%
  assert(hi.season === 'mixed' && hi.altPct === 74, '74% (inside band) => "mixed"');
  assert(lo.season === 'mixed' && lo.altPct === 26, '26% (inside band) => "mixed"');
}
{
  /* BTC exclusion: BTC + 4 alts, 3 beat. Excluded denominator => 3/4 = 75%;
     a buggy BTC-inclusive count would give 3/5 = 60% (mixed). */
  const s = W.rotationSignal({ markets: altFixture(5, 3, 4) });
  assert(s.altPct === 75 && s.season === 'alt', 'BTC excluded from both numerator and denominator (3/4 = 75%)');
  /* BTC itself never counted as beating itself even when it leads the list */
  const s2 = W.rotationSignal({ markets: altFixture(100, 0, 49) });
  assert(s2.altPct === 0 && s2.season === 'btc', 'BTC at +100% with all alts behind => 0% => "btc"');
}
{
  const s = W.rotationSignal({ markets: [mkt('ETH', 10), mkt('SOL', 20)] });
  assert(s.season === 'mixed' && s.altPct === null && s.evidence.join(' ').indexOf('BTC missing') > -1,
         'BTC absent from list => altPct null, mixed, honest evidence');
  const s2 = W.rotationSignal({ markets: [mkt('BTC', null), mkt('ETH', 10)] });
  assert(s2.altPct === null && s2.evidence.join(' ').indexOf('BTC 30d change unavailable') > -1,
         'BTC present but 30d change missing => altPct null with honest evidence');
}
{
  const s = W.rotationSignal({ markets: [] });
  assert(s.season === 'mixed' && s.altPct === null && s.evidence[0].indexOf('unavailable') > -1,
         'empty markets => mixed/null with "unavailable" evidence');
  const s2 = W.rotationSignal(null);
  assert(s2.season === 'mixed' && s2.altPct === null, 'null input never throws => mixed/null');
  const s3 = W.rotationSignal({ markets: [mkt('BTC', 5)] });
  assert(s3.altPct === null && s3.evidence.join(' ').indexOf('no alts') > -1,
         'list with only BTC => "no alts" evidence');
}
{
  /* alts with missing 30d change excluded from denominator, noted honestly */
  const mk = [mkt('BTC', 5), mkt('ETH', 10), mkt('SOL', null), mkt('XRP', 0)];
  const s = W.rotationSignal({ markets: mk });
  assert(s.altPct === 50 && s.evidence.join(' ').indexOf('1 alt lacked a 30d change') > -1,
         'null-change alt excluded from denominator (1/2 = 50%) and reported');
}
{
  const s = W.rotationSignal({ markets: altFixture(5, 30, 49),
                               global: { btcDom: 55.5, ethDom: 15.25, mcapChg24: 1.5 } });
  const ev = s.evidence.join(' ');
  assert(ev.indexOf('BTC dominance 55.5%') > -1 && ev.indexOf('ETH 15.3%') > -1 && ev.indexOf('+1.5%') > -1,
         'global evidence line: BTC/ETH dominance + total mcap 24h');
}

/* ================= 2) rotationDomSnapshot — daily dedupe ================= */
{
  const h1 = W.rotationDomSnapshot([], '2026-04-25', 55.1, 15.0);
  assert(Array.isArray(h1) && h1.length === 1 && h1[0].d === '2026-04-25' && h1[0].btc === 55.1 && h1[0].eth === 15.0,
         'push into empty history => one point {d, btc, eth}');
  const h2 = W.rotationDomSnapshot(h1, '2026-04-25', 56.4, 15.5);
  assert(h2.length === 1 && h2[0].btc === 56.4 && h2[0].eth === 15.5,
         'same UTC day pushed twice => deduped (replaced, not duplicated)');
  const h3 = W.rotationDomSnapshot(h2, '2026-04-23', 54.0, null);
  assert(h3.length === 2 && h3[0].d === '2026-04-23' && h3[1].d === '2026-04-25',
         'out-of-order day inserted => history stays sorted ascending');
  assert(h3[0].eth === null, 'missing eth dominance tolerated as null');
  assert(h1.length === 1 && h1[0].btc === 55.1, 'input array not mutated (pure)');
}
{
  let h = [];
  for (let i = 0; i < 95; i++){
    h = W.rotationDomSnapshot(h, '2026-01-01', i, null, 90); // same day -> still 1
  }
  assert(h.length === 1 && h[0].btc === 94, 'same-day rewrite loop stays at 1 point, latest wins');
  let big = [];
  for (let i = 0; i < 100; i++){
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    big = W.rotationDomSnapshot(big, day, 50 + i, null, 90);
  }
  assert(big.length === 90, 'cap: 100 distinct days => newest 90 kept');
  assert(big[big.length - 1].btc === 149 && big[0].d === new Date(Date.UTC(2026, 0, 11)).toISOString().slice(0, 10),
         'cap drops the OLDEST points (first kept day = day 11)');
}
{
  const junk = [null, {}, { d: 'not-a-date', btc: 1 }, { d: '2026-04-25', btc: 'abc' }, { d: '2026-04-25', btc: 55 }];
  const h = W.rotationDomSnapshot(junk, null, null, null);
  assert(h.length === 1 && h[0].btc === 55, 'junk entries (bad shape/date/btc) dropped on load');
  const h2 = W.rotationDomSnapshot(h, 'bogus-day', 60, null);
  assert(h2.length === 1 && h2[0].btc === 55, 'invalid day argument adds nothing');
  const h3 = W.rotationDomSnapshot('garbage', '2026-04-26', 57, null);
  assert(h3.length === 1 && h3[0].d === '2026-04-26', 'non-array history tolerated');
}

/* ================= 3) trend tags + trending merge ================= */
{
  assert(W.rotationTrendTag(20) === 'EXIT LIQUIDITY', 'tag boundary: +20% exactly => EXIT LIQUIDITY');
  assert(W.rotationTrendTag(19.99) === 'FUEL', 'tag: +19.99% => FUEL');
  assert(W.rotationTrendTag(0) === 'FUEL', 'tag: 0% => FUEL');
  assert(W.rotationTrendTag(-20) === 'DISTRESS', 'tag boundary: -20% exactly => DISTRESS');
  assert(W.rotationTrendTag(-19.99) === 'FUEL', 'tag: -19.99% => FUEL');
  assert(W.rotationTrendTag(null) === 'UNRANKED' && W.rotationTrendTag('x') === 'UNRANKED',
         'tag: missing/non-numeric change => UNRANKED');
}
{
  const markets = [mkt('BTC', 5), mkt('ETH', 10), mkt('SOL', 30), mkt('PEPE', -25)];
  const trending = [
    { item: { id: 'ethereum', symbol: 'eth', name: 'Ethereum' } },   // symbol match (case-insensitive)
    { item: { id: 'solana', symbol: 'SOL', name: 'Solana' } },
    { item: { id: 'pepe', symbol: 'PEPE', name: 'Pepe' } },
    { item: { id: 'dogwifhat', symbol: 'WIF', name: 'dogwifhat' } }  // not in top-50 list
  ];
  // id-based fallback: market id 'solana'
  markets[2].id = 'solana';
  const m = W.rotationMergeTrending(trending, markets);
  assert(m.length === 4 && m[0].rank === 1 && m[3].rank === 4, 'merge keeps top-7 order with sequential ranks');
  assert(m[0].chg30 === 10 && m[0].tag === 'FUEL', 'symbol match (lowercase item) pulls 30d change => FUEL');
  assert(m[1].chg30 === 30 && m[1].tag === 'EXIT LIQUIDITY', 'pumped trending coin => EXIT LIQUIDITY');
  assert(m[2].chg30 === -25 && m[2].tag === 'DISTRESS', 'dumping trending coin => DISTRESS');
  assert(m[3].chg30 === null && m[3].tag === 'UNRANKED', 'coin outside markets list => UNRANKED');
  const nine = W.rotationMergeTrending(new Array(9).fill({ item: { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' } }), markets);
  assert(nine.length === 7, 'merge caps at top-7 even when more items arrive');
  const bare = W.rotationMergeTrending([{ id: 'ethereum', symbol: 'ETH', name: 'Ethereum' }], markets);
  assert(bare.length === 1 && bare[0].chg30 === 10, 'bare coin objects (no .item wrapper) handled');
  assert(W.rotationMergeTrending(null, null).length === 0, 'null inputs => empty merge, no throw');
}

/* ================= 4) rotationLeaders ================= */
{
  const mk = [mkt('BTC', 5), mkt('A', 40), mkt('B', -30), mkt('C', 20), mkt('D', null), mkt('E', -10), mkt('F', 1), mkt('G', 7)];
  const r = W.rotationLeaders(mk, 2);
  assert(r.leaders.length === 2 && r.leaders[0].symbol === 'A' && r.leaders[1].symbol === 'C',
         'leaders: top-2 by 30d desc');
  assert(r.laggards.length === 2 && r.laggards[0].symbol === 'B' && r.laggards[1].symbol === 'E',
         'laggards: worst-2 first');
  assert(r.leaders.concat(r.laggards).every(x => x.symbol !== 'D'), 'null 30d change excluded from ranking');
  assert(W.rotationLeaders(null, 5).leaders.length === 0, 'null markets => empty leaders, no throw');
}

/* ================= 5) mount + refresh contract ================= */
function fakeNode(id){
  return {
    id: id, innerHTML: '', textContent: '', style: {}, disabled: false,
    firstElementChild: { style: {} },
    _click: null,
    addEventListener(ev, fn){ if (ev === 'click') this._click = fn; }
  };
}
function fakeEl(){
  return {
    innerHTML: '',
    _nodes: {},
    querySelector(sel){
      if (!this._nodes[sel]) this._nodes[sel] = fakeNode(sel);
      return this._nodes[sel];
    }
  };
}

const el = fakeEl();
let mountThrew = null;
try { W.HG_tabs[0].mount(el); } catch(e){ mountThrew = e; }
assert(!mountThrew, 'mount() does not throw with a stub DOM');
assert(el.innerHTML.indexOf('ROTATION') > -1 && el.innerHTML.indexOf('data-rot="run"') > -1,
       'mount() builds the panel skeleton with a RUN button');

const refresh = W.HG_tabs[0].refresh;
const ui = { btn: el._nodes['[data-rot="run"]'], note: el._nodes['[data-rot="note"]'], out: el._nodes['[data-rot="out"]'] };

/* contract: before the first run, refresh skips (no scan triggered) */
let skipped = null, skipThrew = null;
try { skipped = await refresh(); } catch(e){ skipThrew = e; }
assert(!skipThrew && skipped === 'skipped: not run yet', 'refresh() before first run => "skipped: not run yet", never throws');

/* mount must not auto-run: zero network activity on mount */
assert(fetchCalls.length === 0, 'mount() does not auto-run (zero fetch calls on mount)');

/* live CoinGecko stub */
const CG_MARKETS = [mkt('BTC', 5, 'bitcoin'), mkt('ETH', 12), mkt('SOL', 22), mkt('XRP', 6),
                    mkt('DOGE', 8), mkt('ADA', -3), mkt('AVAX', 18), mkt('LINK', 6),
                    mkt('DOT', -8), mkt('NEAR', 25), mkt('LTC', 9)]; // 8/10 = 80% alt season
fetchCalls.length = 0;
sandbox.fetch = async (url) => {
  fetchCalls.push(url);
  let body = null;
  if (url.indexOf('/coins/markets') > -1) body = CG_MARKETS;
  else if (url.indexOf('/global') > -1) body = { data: { market_cap_percentage: { btc: 55.0, eth: 15.0 }, market_cap_change_percentage_24h_usd: 1.2 } };
  else if (url.indexOf('/search/trending') > -1) body = { coins: [ { item: { id: 'sol', symbol: 'SOL', name: 'Solana' } }, { item: { id: 'wif', symbol: 'WIF', name: 'dogwifhat' } } ] };
  return { ok: body !== null, status: body !== null ? 200 : 404, json: async () => body };
};

/* first run via the button */
let p = ui.btn._click();
assert(p && typeof p.then === 'function', 'RUN button returns a promise');
const st1 = await p;
assert(st1 === 'refreshed', 'first run resolves "refreshed"');
assert(fetchCalls.length === 3, 'first run fires exactly 3 CoinGecko legs (markets + global + trending)');
assert(ui.out.innerHTML.indexOf('ALTSEASON INDEX') > -1 && ui.out.innerHTML.indexOf('80.0%') > -1
       && ui.out.innerHTML.indexOf('ALT SEASON') > -1, 'gauge panel renders the 80% ALT SEASON reading');
assert(ui.out.innerHTML.indexOf('DOMINANCE') > -1 && ui.out.innerHTML.indexOf('RETAIL ATTENTION') > -1
       && ui.out.innerHTML.indexOf('LEADERS') > -1, 'dominance + trending + leaders panels render');
assert(ui.out.innerHTML.indexOf('EXIT LIQUIDITY') > -1 && ui.out.innerHTML.indexOf('UNRANKED') > -1,
       'trending rows tagged (SOL +22% => EXIT LIQUIDITY, WIF absent => UNRANKED)');
assert(ui.note.textContent.indexOf('done') === 0, 'status note reports done');

/* dominance snapshot persisted, one point for today */
const today = new Date().toISOString().slice(0, 10);
const histRaw = JSON.parse(sandbox.localStorage.getItem('hg_dom_history'));
assert(Array.isArray(histRaw) && histRaw.length === 1 && histRaw[0].d === today && histRaw[0].btc === 55.0,
       'daily dominance snapshot persisted to hg_dom_history (1 point, today, btc 55)');

/* 5-min cache: second run fires no new fetches */
const st2 = await ui.btn._click();
assert(st2 === 'refreshed' && fetchCalls.length === 3, 'second run within 5 min uses the cache (no new fetches)');

/* busy guard: an in-flight FORCED refresh (network hanging) blocks overlaps */
let resolvers = [];
sandbox.fetch = (url) => new Promise((res) => {
  resolvers.push(() => res({ ok: true, status: 200, json: async () => (url.indexOf('/global') > -1
    ? { data: { market_cap_percentage: { btc: 55, eth: 15 }, market_cap_change_percentage_24h_usd: 1 } }
    : (url.indexOf('/coins/markets') > -1 ? CG_MARKETS : { coins: [] })) }));
});
const inflight = refresh(); // force:true -> actually hits the (hanging) network
await new Promise(r => setTimeout(r, 20));
const busy = await refresh();
assert(busy === 'busy', 'refresh() during an in-flight run => "busy"');
resolvers.forEach(r => r());
const stInflight = await inflight;
assert(stInflight === 'refreshed', 'the in-flight run completes once the gate opens');

/* hard refresh: forces a fresh fetch (bypasses the 5-min cache) */
fetchCalls.length = 0;
sandbox.fetch = async (url) => {
  fetchCalls.push(url);
  const body = url.indexOf('/coins/markets') > -1 ? CG_MARKETS
    : (url.indexOf('/global') > -1 ? { data: { market_cap_percentage: { btc: 56.0, eth: 14.8 }, market_cap_change_percentage_24h_usd: 0.5 } }
    : { coins: [] });
  return { ok: true, status: 200, json: async () => body };
};
const st3 = await refresh();
assert(st3 === 'refreshed' && fetchCalls.length === 3, 'refresh() after a run => "refreshed" with fresh fetches (force bypasses cache)');
const hist2 = JSON.parse(sandbox.localStorage.getItem('hg_dom_history'));
assert(hist2.length === 1 && hist2[0].btc === 56.0, 'same-day refresh rewrites (dedupes) the dominance point');

/* dead fetch: refresh reports failure as a status string, never throws */
sandbox.localStorage.removeItem('hg_dom_history'); // no local history -> honest empty state
sandbox.fetch = async () => ({ ok: false, status: 503, json: async () => null });
let deadThrew = null, deadStatus = null;
try { deadStatus = await refresh(); } catch(e){ deadThrew = e; }
assert(!deadThrew && typeof deadStatus === 'string' && deadStatus.indexOf('failed') === 0,
       'refresh() with all legs down => "failed: ..." string, never throws');
assert(ui.out.innerHTML.indexOf('class="empty"') > -1, 'all-sources-down render shows the honest empty state');

/* load-safety: module must not throw without a window (pure worker global) */
const bare = { console, setTimeout, clearTimeout, AbortController };
vm.createContext(bare);
let bareThrew = null;
try { vm.runInContext(readFileSync(path.join(root, 'rotation.js'), 'utf8'), bare, { filename: 'rotation.js' }); }
catch(e){ bareThrew = e; }
assert(!bareThrew, 'rotation.js loads cleanly with no window defined');

/* ================= 6) BRAIN state getter — window.rotationState =================
   Fresh context: getter exposed; null pre-run; populated with the last
   rotationSignal result + `at` after a successful run; deep-frozen fresh
   copies; a failed re-run (all legs down) keeps the previous good snapshot
   with its original `at`; sabotaged internals -> null, no throw. */
{
  const s2 = {
    window: {}, console, setTimeout, clearTimeout, AbortController,
    localStorage: makeLocalStorage(),
    fetch: async () => ({ ok: false, status: 503, json: async () => null })
  };
  const ctx2 = vm.createContext(s2);
  vm.runInContext(readFileSync(path.join(root, 'rotation.js'), 'utf8'), ctx2, { filename: 'rotation.js' });
  const W2 = s2.window;
  const tab2 = W2.HG_tabs[0];

  assert(typeof W2.rotationState === 'function', 'state: window.rotationState exposed');
  assert(W2.rotationState() === null, 'state: null before the first successful run');
  assert(W2.rotationState() === null, 'state: still null after a skipped refresh (never run)');

  const MK2 = altFixture(5, 8, 10); // 8/10 = 80% -> ALT SEASON
  s2.fetch = async (url) => {
    const u = String(url);
    if (u.indexOf('/coins/markets') > -1) return { ok: true, status: 200, json: async () => MK2 };
    if (u.indexOf('/global') > -1) return { ok: true, status: 200, json: async () => ({ data: { market_cap_percentage: { btc: 55, eth: 15 }, market_cap_change_percentage_24h_usd: 1 } }) };
    if (u.indexOf('/search/trending') > -1) return { ok: true, status: 200, json: async () => ({ coins: [] }) };
    return { ok: false, status: 404, json: async () => null };
  };
  const el2 = fakeEl();
  tab2.mount(el2);
  const ui2 = { btn: el2._nodes['[data-rot="run"]'], note: el2._nodes['[data-rot="note"]'], out: el2._nodes['[data-rot="out"]'] };
  const stRun = await ui2.btn._click();
  assert(stRun === 'refreshed', 'state: fixture run resolves "refreshed"');

  const st = W2.rotationState();
  assert(st && typeof st === 'object' && typeof st.at === 'number' && isFinite(st.at),
         'state: populated after the successful run (signal + at)');
  assert(Object.keys(st).sort().join(',') === 'altPct,at,evidence,season',
         'state: keys exactly {season, altPct, evidence, at}');
  assert(st.season === 'alt' && st.altPct === 80 && Array.isArray(st.evidence)
         && st.evidence.join(' ').indexOf('8/10') > -1,
         'state: content mirrors the last rotationSignal result (alt, 80%, 8/10 evidence)');
  assert(Object.isFrozen(st) && Object.isFrozen(st.evidence), 'state: the view is frozen (state + evidence)');
  const st2 = W2.rotationState();
  assert(st2 !== st && st2.evidence !== st.evidence && JSON.stringify(st2) === JSON.stringify(st),
         'state: each call hands a fresh copy with identical content');

  /* failed re-run (every leg down) keeps the PREVIOUS good snapshot + original at */
  s2.fetch = async () => ({ ok: false, status: 503, json: async () => null });
  let failStatus = null, failThrew = null;
  try{ failStatus = await tab2.refresh(); }catch(e){ failThrew = e; }
  assert(!failThrew && typeof failStatus === 'string' && failStatus.indexOf('failed') === 0,
         'state: the failing re-run reports "failed: ...", never throws');
  const st3 = W2.rotationState();
  assert(st3 && st3.at === st.at && st3.altPct === 80 && st3.season === 'alt',
         'state: stale-good snapshot preserved after the failed re-run (same at, same content)');

  /* sabotaged internals: getter degrades to null, never throws, then recovers */
  let sThrew = null, sGot = 'unset';
  vm.runInContext('globalThis.__keepIA = Array.isArray; Array.isArray = undefined;', ctx2);
  try{ sGot = W2.rotationState(); }catch(e){ sThrew = e; }
  vm.runInContext('Array.isArray = globalThis.__keepIA; delete globalThis.__keepIA;', ctx2);
  assert(!sThrew && sGot === null,
         'state: getter never throws with sabotaged internals (Array.isArray removed) — returns null');
  assert(W2.rotationState() !== null, 'state: getter recovers once internals are restored');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
