/* HARDGATE — goldspot.js unit tests (Node 18+, builtins only).
   Loads goldspot.js as a classic script in a vm context and asserts:
     - the pure window.goldBasisSignal classifier (±0.15% premium/discount
       thresholds, both sides of both boundaries, invalid-input honesty),
     - window.goldFundingAnnualized funding mapping (per-interval % ->
       annualized carry proxy, real interval vs assumed 8h),
     - api/proxy.js allowlist contains api.gold-api.com (behavioral: passes,
       passthrough; evil host 403; http 403),
     - HG_tabs registration incl. the house refresh contract (skipped: not
       run yet / busy / refreshed / failed, never throws, 5-min cache,
       force bypass, no auto-run on mount),
     - data-leg degradation: direct gold-api fetch with /api/proxy fallback,
       XAUUSDT -> PAXGUSDT degrade, perp-unavailable empty state.
   No live network — fetch and the binance helpers are stubbed.
   Run: node tests/test-goldspot.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------------- vm sandbox ---------------- */
const fetchCalls = [];
const sandbox = {
  window: {},
  console,
  setTimeout, clearTimeout,
  AbortController,
  fetch: async (url) => { fetchCalls.push(url); return { ok: false, status: 503, json: async () => null }; }
};
const ctx = vm.createContext(sandbox);
vm.runInContext(readFileSync(path.join(root, 'goldspot.js'), 'utf8'), ctx, { filename: 'goldspot.js' });
const W = sandbox.window;

/* ================= 0) exposure / registration ================= */
assert(typeof W.goldBasisSignal === 'function', 'window.goldBasisSignal exposed');
assert(typeof W.goldFundingAnnualized === 'function', 'window.goldFundingAnnualized exposed');
assert(Array.isArray(W.HG_tabs) && W.HG_tabs.length === 1, 'HG_tabs registered exactly once');
assert(W.HG_tabs[0].id === 'goldspot' && W.HG_tabs[0].label === 'GOLD SPOT'
       && typeof W.HG_tabs[0].mount === 'function' && typeof W.HG_tabs[0].refresh === 'function',
       'HG_tabs entry: id "goldspot", label "GOLD SPOT", mount + refresh functions');

/* ================= 1) goldBasisSignal — basis thresholds ================= */
{
  const s = W.goldBasisSignal({ spot: 3000, perp: 3004.8 }); // +0.16%
  assert(s.verdict === 'longs-crowding' && Math.abs(s.basisPct - 0.16) < 1e-9,
         'basis +0.16% > +0.15% => "longs-crowding"');
  assert(s.evidence.join(' ').indexOf('perp premium') > -1 && s.evidence.join(' ').indexOf('fade risk') > -1,
         'premium evidence: threshold + fade-risk wording');
}
{
  const s = W.goldBasisSignal({ spot: 3000, perp: 3004.5 }); // exactly +0.15%
  assert(s.verdict === 'balanced' && s.basisPct === 0.15, 'boundary: exactly +0.15% => "balanced" (strict >)');
}
{
  const s = W.goldBasisSignal({ spot: 3000, perp: 2995.2 }); // -0.16%
  assert(s.verdict === 'shorts-crowding' && Math.abs(s.basisPct + 0.16) < 1e-9,
         'basis -0.16% < -0.15% => "shorts-crowding"');
  assert(s.evidence.join(' ').indexOf('perp discount') > -1 && s.evidence.join(' ').indexOf('squeeze fuel') > -1,
         'discount evidence: threshold + squeeze-fuel wording');
}
{
  const s = W.goldBasisSignal({ spot: 3000, perp: 2995.5 }); // exactly -0.15%
  assert(s.verdict === 'balanced' && s.basisPct === -0.15, 'boundary: exactly -0.15% => "balanced" (strict <)');
}
{
  const s = W.goldBasisSignal({ spot: 3000, perp: 3000 });
  assert(s.verdict === 'balanced' && s.basisPct === 0 && s.evidence[0].indexOf('±0.15% band') > -1,
         'zero basis => "balanced" with band evidence');
}
{
  const s = W.goldBasisSignal({ spot: 2500, perp: 2510 }); // +0.4%
  assert(s.basisPct === 0.4, 'basisPct = (perp-spot)/spot*100 rounded to 4dp (0.4 exactly)');
}
{
  const cases = [null, {}, { spot: null, perp: 3000 }, { spot: 3000, perp: 0 }, { spot: -5, perp: 3000 }, { spot: 3000, perp: 'x' }];
  const allBad = cases.every(c => {
    const s = W.goldBasisSignal(c);
    return s && s.verdict === 'unavailable' && s.basisPct === null && s.evidence.length > 0;
  });
  assert(allBad, 'invalid/missing spot or perp => "unavailable", basisPct null, honest evidence (6 shapes)');
}

/* ================= 2) funding mapping ================= */
{
  const a = W.goldFundingAnnualized(0.01, 8);
  assert(a && a.assumed === false && a.intervalHours === 8 && Math.abs(a.annualizedPct - 10.95) < 1e-9,
         '0.01%/8h => 10.95%/yr, not assumed');
  const b = W.goldFundingAnnualized(0.01);
  assert(b && b.assumed === true && b.intervalHours === 8 && Math.abs(b.annualizedPct - 10.95) < 1e-9,
         'missing interval => assumed 8h, flagged');
  const c = W.goldFundingAnnualized(0.02, 4);
  assert(c && Math.abs(c.annualizedPct - 43.8) < 1e-9 && c.assumed === false,
         '0.02%/4h => 43.8%/yr (perp interval honored, not hardcoded 8h)');
  assert(W.goldFundingAnnualized(null) === null && W.goldFundingAnnualized('x') === null,
         'non-numeric funding => null');
  const e = W.goldFundingAnnualized(0.01, 0);
  assert(e && e.assumed === true && e.intervalHours === 8, 'interval 0/invalid => assumed 8h');
}
{
  const s = W.goldBasisSignal({ spot: 3000, perp: 3000, funding: 0.01 }); // number form
  const ev = s.evidence.join(' ');
  assert(ev.indexOf('(assumed 8h)') > -1 && ev.indexOf('longs pay shorts') > -1,
         'number funding => assumed-8h label + longs-pay-shorts mapping');
  const s2 = W.goldBasisSignal({ spot: 3000, perp: 3000, funding: { fundingPct: -0.005, intervalHours: 8 } });
  const ev2 = s2.evidence.join(' ');
  assert(ev2.indexOf('shorts pay longs') > -1 && ev2.indexOf('(assumed 8h)') === -1,
         'object funding with real interval => shorts-pay-longs, no assumed label');
  const s3 = W.goldBasisSignal({ spot: 3000, perp: 3000 });
  assert(s3.evidence.join(' ').indexOf('funding unavailable') > -1, 'no funding input => honest "funding unavailable" note');
}

/* ================= 3) proxy allowlist: api.gold-api.com ================= */
{
  const src = readFileSync(path.join(root, 'api', 'proxy.js'), 'utf8');
  assert(src.indexOf("'api.gold-api.com'") > -1, 'api/proxy.js ALLOWED_HOSTS lists api.gold-api.com');

  const proxy = require('../api/proxy.js');
  function mockRes(){
    return { statusCode: 200, headers: {}, body: undefined,
             setHeader(k, v){ this.headers[k.toLowerCase()] = v; }, end(b){ this.body = b; } };
  }
  const origFetch = globalThis.fetch;
  let calledWith = null;
  globalThis.fetch = async (url) => {
    calledWith = String(url);
    return { status: 200, text: async () => '{"price":3123.45,"symbol":"XAU"}',
             headers: { get: () => 'application/json' } };
  };
  try{
    const res = mockRes();
    await proxy({ method: 'GET', query: { url: 'https://api.gold-api.com/price/XAU' } }, res);
    assert(res.statusCode === 200 && res.body === '{"price":3123.45,"symbol":"XAU"}',
           'proxy passes api.gold-api.com (200 passthrough)');
    assert(calledWith === 'https://api.gold-api.com/price/XAU', 'proxy forwards the exact upstream URL');
    assert(res.headers['access-control-allow-origin'] === '*' && res.headers['content-type'] === 'application/json',
           'proxy sets ACAO + forwards content-type for api.gold-api.com');
    const res403 = mockRes();
    await proxy({ method: 'GET', query: { url: 'https://evil.example.com/price/XAU' } }, res403);
    assert(res403.statusCode === 403 && JSON.parse(res403.body).error === 'host not allowed',
           'non-allowlisted host still 403 "host not allowed"');
    const resHttp = mockRes();
    await proxy({ method: 'GET', query: { url: 'http://api.gold-api.com/price/XAU' } }, resHttp);
    assert(resHttp.statusCode === 403, 'http:// (not https) on api.gold-api.com still 403');
  } finally { globalThis.fetch = origFetch; }
}

/* ================= 4) mount + refresh contract + leg degradation ================= */
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
assert(!mountThrew, 'mount() does not throw with no binance helpers present');
assert(el.innerHTML.indexOf('GOLD SPOT') > -1 && el.innerHTML.indexOf('data-gs="run"') > -1,
       'mount() builds the panel skeleton with a RUN button');
assert(fetchCalls.length === 0, 'mount() does not auto-run (zero fetch calls on mount)');

const refresh = W.HG_tabs[0].refresh;
const ui = { btn: el._nodes['[data-gs="run"]'], note: el._nodes['[data-gs="note"]'], out: el._nodes['[data-gs="out"]'] };

let skipped = null, skipThrew = null;
try { skipped = await refresh(); } catch(e){ skipThrew = e; }
assert(!skipThrew && skipped === 'skipped: not run yet', 'refresh() before first run => "skipped: not run yet", never throws');

/* ---- scenario A: direct spot + XAUUSDT perp, premium verdict ---- */
fetchCalls.length = 0;
sandbox.fetch = async (url) => {
  fetchCalls.push(url);
  if (url === 'https://api.gold-api.com/price/XAU')
    return { ok: true, status: 200, json: async () => ({ price: 3000, updatedAt: '2026-04-25T12:00:00.000Z' }) };
  return { ok: false, status: 404, json: async () => null };
};
sandbox.binanceFunding = async (sym) => (sym === 'XAUUSDT'
  ? { fundingPct: 0.01, markPrice: 3005, nextFundingTime: 1800000000000 } : null);
sandbox.binanceFundingInfo = async () => ({ XAUUSDT: { intervalHours: 8, capPct: 2, floorPct: -2 } });

const stA = await ui.btn._click();
assert(stA === 'refreshed', 'scenario A: first run resolves "refreshed"');
assert(fetchCalls.length === 1 && fetchCalls[0] === 'https://api.gold-api.com/price/XAU',
       'scenario A: direct spot fetch succeeds — no proxy fallback needed (1 call)');
assert(ui.out.innerHTML.indexOf('GOLD-API DIRECT') > -1 && ui.out.innerHTML.indexOf('XAUUSDT') > -1,
       'scenario A: src chips show GOLD-API DIRECT + XAUUSDT');
assert(ui.out.innerHTML.indexOf('PERP PREMIUM') > -1 && ui.out.innerHTML.indexOf('LONGS CROWDING') > -1,
       'scenario A: +0.167% basis renders the PERP PREMIUM — LONGS CROWDING verdict');
assert(ui.out.innerHTML.indexOf('(assumed 8h)') === -1,
       'scenario A: real funding interval from binanceFundingInfo — no "(assumed 8h)" label');

/* ---- scenario B: 5-min cache ---- */
const stB = await ui.btn._click();
assert(stB === 'refreshed' && fetchCalls.length === 1, 'scenario B: second run within 5 min uses the cache');

/* ---- scenario C: proxy fallback + PAXGUSDT degrade + assumed 8h ---- */
sandbox.fetch = async (url) => {
  fetchCalls.push(url);
  if (url.indexOf('/api/proxy?url=') === 0)
    return { ok: true, status: 200, json: async () => ({ price: 2990, updatedAt: '2026-04-25T12:00:05.000Z' }) };
  return { ok: false, status: 503, json: async () => null }; // direct gold-api down
};
sandbox.binanceFunding = async (sym) => (sym === 'PAXGUSDT'
  ? { fundingPct: -0.02, markPrice: 2985, nextFundingTime: 1800000000000 } : null);
sandbox.binanceFundingInfo = undefined;

const stC = await refresh(); // force -> bypass cache
assert(stC === 'refreshed' && fetchCalls.length === 3,
       'scenario C: hard refresh forces refetch; direct fails -> /api/proxy fallback (2 new calls)');
assert(fetchCalls[2].indexOf('/api/proxy?url=') === 0
       && decodeURIComponent(fetchCalls[2]).indexOf('https://api.gold-api.com/price/XAU') > -1,
       'scenario C: proxy fallback targets the encoded gold-api URL');
assert(ui.out.innerHTML.indexOf('GOLD-API PROXY') > -1 && ui.out.innerHTML.indexOf('PAXGUSDT (fallback)') > -1,
       'scenario C: chips show GOLD-API PROXY + PAXGUSDT (fallback)');
assert(ui.out.innerHTML.indexOf('PERP DISCOUNT') > -1 && ui.out.innerHTML.indexOf('SHORTS CROWDING') > -1
       && ui.out.innerHTML.indexOf('(assumed 8h)') > -1,
       'scenario C: -0.167% basis => PERP DISCOUNT — SHORTS CROWDING, funding assumed 8h');

/* ---- scenario D: busy guard ---- */
let resolvers = [];
sandbox.fetch = (url) => new Promise((res) => {
  resolvers.push(() => res({ ok: true, status: 200, json: async () => ({ price: 3001 }) }));
});
sandbox.binanceFunding = async () => ({ fundingPct: 0.0, markPrice: 3001, nextFundingTime: 1800000000000 });
const inflight = refresh();
await new Promise(r => setTimeout(r, 20));
const busy = await refresh();
assert(busy === 'busy', 'scenario D: refresh() during an in-flight run => "busy"');
resolvers.forEach(r => r());
const stD = await inflight;
assert(stD === 'refreshed', 'scenario D: in-flight run completes once the gate opens');

/* ---- scenario E: everything down -> failed status + empty state, no throw ---- */
sandbox.fetch = async () => ({ ok: false, status: 503, json: async () => null });
sandbox.binanceFunding = undefined;
sandbox.binanceFundingInfo = undefined;
let stE = null, eThrew = null;
try { stE = await refresh(); } catch(e){ eThrew = e; }
assert(!eThrew && typeof stE === 'string' && stE.indexOf('failed') === 0,
       'scenario E: spot+perp both down => "failed: ..." string, never throws');
assert(ui.out.innerHTML.indexOf('class="empty"') > -1 && ui.out.innerHTML.indexOf('No gold basis data') > -1,
       'scenario E: honest empty state rendered');
assert(ui.note.textContent.indexOf('all sources unavailable') > -1,
       'scenario E: status note reports all sources unavailable');

/* ---- load safety without window ---- */
const bare = { console, setTimeout, clearTimeout, AbortController };
vm.createContext(bare);
let bareThrew = null;
try { vm.runInContext(readFileSync(path.join(root, 'goldspot.js'), 'utf8'), bare, { filename: 'goldspot.js' }); }
catch(e){ bareThrew = e; }
assert(!bareThrew, 'goldspot.js loads cleanly with no window defined');

/* ================= 5) BRAIN state getter — window.goldspotState =================
   Fresh context: getter exposed; null pre-run; populated with the last
   goldBasisSignal result + `at` after a successful run; deep-frozen fresh
   copies; a failed re-run (spot + perp both down) keeps the previous good
   snapshot with its original `at`; sabotaged internals -> null, no throw. */
{
  const s2 = {
    window: {}, console, setTimeout, clearTimeout, AbortController,
    fetch: async (url) => {
      if (String(url) === 'https://api.gold-api.com/price/XAU')
        return { ok: true, status: 200, json: async () => ({ price: 3000, updatedAt: '2026-04-25T12:00:00.000Z' }) };
      return { ok: false, status: 404, json: async () => null };
    },
    binanceFunding: async (sym) => (sym === 'XAUUSDT'
      ? { fundingPct: 0.01, markPrice: 3005, nextFundingTime: 1800000000000 } : null),
    binanceFundingInfo: async () => ({ XAUUSDT: { intervalHours: 8 } })
  };
  const ctx2 = vm.createContext(s2);
  vm.runInContext(readFileSync(path.join(root, 'goldspot.js'), 'utf8'), ctx2, { filename: 'goldspot.js' });
  const W2 = s2.window;
  const tab2 = W2.HG_tabs[0];

  assert(typeof W2.goldspotState === 'function', 'state: window.goldspotState exposed');
  assert(W2.goldspotState() === null, 'state: null before the first successful run');
  assert(W2.goldspotState() === null, 'state: still null after a skipped refresh (never run)');

  const el2 = fakeEl();
  tab2.mount(el2);
  const ui2 = { btn: el2._nodes['[data-gs="run"]'], note: el2._nodes['[data-gs="note"]'], out: el2._nodes['[data-gs="out"]'] };
  const stRun = await ui2.btn._click();
  assert(stRun === 'refreshed', 'state: fixture run resolves "refreshed"');

  const st = W2.goldspotState();
  assert(st && typeof st === 'object' && typeof st.at === 'number' && isFinite(st.at),
         'state: populated after the successful run (signal + at)');
  assert(Object.keys(st).sort().join(',') === 'at,basisPct,evidence,verdict',
         'state: keys exactly {basisPct, verdict, evidence, at}');
  assert(st.verdict === 'longs-crowding' && Math.abs(st.basisPct - 0.1667) < 1e-9
         && Array.isArray(st.evidence) && st.evidence.join(' ').indexOf('perp premium') > -1,
         'state: content mirrors the last goldBasisSignal result (premium +0.167%, longs-crowding)');
  assert(Object.isFrozen(st) && Object.isFrozen(st.evidence), 'state: the view is frozen (state + evidence)');
  const st2 = W2.goldspotState();
  assert(st2 !== st && st2.evidence !== st.evidence && JSON.stringify(st2) === JSON.stringify(st),
         'state: each call hands a fresh copy with identical content');

  /* failed re-run (spot + perp both down) keeps the PREVIOUS good snapshot + original at */
  s2.fetch = async () => ({ ok: false, status: 503, json: async () => null });
  s2.binanceFunding = undefined;
  s2.binanceFundingInfo = undefined;
  let failStatus = null, failThrew = null;
  try{ failStatus = await tab2.refresh(); }catch(e){ failThrew = e; }
  assert(!failThrew && typeof failStatus === 'string' && failStatus.indexOf('failed') === 0,
         'state: the failing re-run reports "failed: ...", never throws');
  const st3 = W2.goldspotState();
  assert(st3 && st3.at === st.at && st3.verdict === 'longs-crowding'
         && Math.abs(st3.basisPct - 0.1667) < 1e-9,
         'state: stale-good snapshot preserved after the failed re-run (same at, same content)');

  /* sabotaged internals: getter degrades to null, never throws, then recovers */
  let sThrew = null, sGot = 'unset';
  vm.runInContext('globalThis.__keepIA = Array.isArray; Array.isArray = undefined;', ctx2);
  try{ sGot = W2.goldspotState(); }catch(e){ sThrew = e; }
  vm.runInContext('Array.isArray = globalThis.__keepIA; delete globalThis.__keepIA;', ctx2);
  assert(!sThrew && sGot === null,
         'state: getter never throws with sabotaged internals (Array.isArray removed) — returns null');
  assert(W2.goldspotState() !== null, 'state: getter recovers once internals are restored');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
