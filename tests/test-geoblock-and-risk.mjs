/* HARDGATE — the regime gauges were not broken. Binance was unreachable.

   Two open items, both traced to the same root cause and both fixed here.

   1. THE GEO-BLOCK. Every scan reported

        regime.js gauges unavailable (unavailable: every gauge source failed)
          — using BTC daily proxy

      and card after card read "OI not published for this contract". Neither
      was true. binance.js fetched api.binance.com directly, got HTTP 451 in a
      blocked country, returned null, and said nothing — so twelve Binance
      functions across seventeen call sites went quietly dark, taking the perp
      gates and half the regime gauges with them.

      The app ships a same-origin proxy and the server runs in Singapore,
      where those hosts resolve normally. The proxy was never in the picture:
      binance.js never tried it, and the allowlist did not contain a single
      Binance host, so it would have refused anyway.

      Both ends fixed. The fallback is sticky — once direct is refused, later
      calls skip straight to the proxy rather than paying for a doomed request
      first — and hgBinanceVia() reports which path is live so a gate can say
      "unreachable" instead of blaming a venue for a block.

   2. THE UNUSED RISK MACHINERY. crypto-position-risk.js has computed
      cost-adjusted R, breakeven win rate, max survivable leverage and
      liquidation clearance since it was written, and no ledger had ever read
      any of it. Every card printed "R:R 2.00" meaning 2R GROSS.

      Two bugs in the first cut of that gate, both caught here: gross R was
      computed with Math.abs while the library computes it signed, so a SHORT
      read "2.00R gross, -2.05R net"; and the cost was priced maker/taker
      while the net figure assumed maker/maker, so the two numbers on one line
      did not reconcile.

   Run: node tests/test-geoblock-and-risk.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const PROXY = fs.readFileSync(path.join(ROOT, 'api/proxy.js'), 'utf8');
const BIN = fs.readFileSync(path.join(ROOT, 'binance.js'), 'utf8');
const REGIME = fs.readFileSync(path.join(ROOT, 'regime.js'), 'utf8');
const ROUTE = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');

console.log('== the proxy will now carry the blocked hosts ==');
{
  const list = PROXY.slice(PROXY.indexOf('ALLOWED_HOSTS'), PROXY.indexOf('const UPSTREAM_TIMEOUT_MS'));
  for (const h of ['api.binance.com', 'fapi.binance.com', 'api.coingecko.com',
                   'api.alternative.me', 'stablecoins.llama.fi']){
    ok(list.indexOf("'" + h + "'") >= 0, h + ' is allowlisted');
  }
  /* An enriched sweep asks four Binance calls per contract; the default
     300/min would have rate-limited the tab against itself. */
  ok(/RATE_MAX_BINANCE = \d+/.test(PROXY), 'Binance has its own rate ceiling');
  ok(/indexOf\('binance\.com'\) !== -1\) \? RATE_MAX_BINANCE/.test(PROXY), 'and the limiter uses it');
  const m = /RATE_MAX_BINANCE = (\d+)/.exec(PROXY);
  ok(parseInt(m[1], 10) > 300, 'higher than the default (' + m[1] + '/min)');

  /* The proxy must not have become an open relay. */
  ok(/target\.protocol !== 'https:' \|\| !ALLOWED_HOSTS\.has\(target\.hostname\)/.test(PROXY),
     'and everything not on the list is still refused');
}

console.log('\n== binance.js falls back instead of going dark ==');
{
  ok(/__binProxied/.test(BIN), 'there is a proxied URL builder');
  ok(/'\/api\/proxy\?url=' \+ encodeURIComponent\(url\)/.test(BIN), 'pointing at the same-origin proxy');
  ok(/__BIN_VIA/.test(BIN), 'and the transport state is tracked');
  ok(/if \(__BIN_VIA\.mode !== 'proxy'\)/.test(BIN),
     'the fallback is STICKY — a known block skips the doomed direct call');
  ok(/root\.hgBinanceVia = __binVia;/.test(BIN), 'and is exported for the UI to read');

  /* Behavioural: run the module against a fetch that 451s directly and
     succeeds through the proxy, exactly like a blocked browser. */
  const ctx = { console: { log(){}, warn(){} }, Math, Date, isFinite, JSON, Array, Object, Number,
                String, Promise, setTimeout, clearTimeout, AbortController, encodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx;
  const seen = [];
  ctx.fetch = (url) => {
    seen.push(url);
    if (String(url).indexOf('/api/proxy') === 0){
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ ok: 1 }]) });
    }
    return Promise.resolve({ ok: false, status: 451, json: () => Promise.resolve(null) });
  };
  vm.createContext(ctx);
  vm.runInContext(BIN, ctx, { filename: 'binance.js' });
  {
    ok(ctx.hgBinanceVia() === 'unknown', 'transport starts unknown');
    const first = await ctx.__binFetchJson('https://api.binance.com/api/v3/ping');
    ok(first !== null, 'a 451 direct call still returns data, via the proxy');
    ok(ctx.hgBinanceVia() === 'proxy', 'and the transport is recorded as proxy');
    ok(seen.length === 2, 'the first call tried direct then proxy (' + seen.length + ' fetches)');
    ok(seen[1].indexOf('/api/proxy?url=') === 0, 'the second went through the proxy');

    seen.length = 0;
    await ctx.__binFetchJson('https://api.binance.com/api/v3/ping');
    ok(seen.length === 1, 'the SECOND call skips the doomed direct attempt (' + seen.length + ' fetch)');
    ok(seen[0].indexOf('/api/proxy?url=') === 0, 'going straight to the proxy');
  }
}

console.log('\n== when neither path works it says BLOCKED, not nothing ==');
{
  const ctx = { console: { log(){}, warn(){} }, Math, Date, isFinite, JSON, Array, Object, Number,
                String, Promise, setTimeout, clearTimeout, AbortController, encodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.fetch = () => Promise.resolve({ ok: false, status: 451, json: () => Promise.resolve(null) });
  vm.createContext(ctx);
  vm.runInContext(BIN, ctx, { filename: 'binance.js' });
  const r = await ctx.__binFetchJson('https://api.binance.com/api/v3/ping');
  ok(r === null, 'a genuinely unreachable host still returns null');
  ok(ctx.hgBinanceVia() === 'blocked', 'but the state says blocked, so a gate can say why');
}

console.log('\n== a transient blip must NOT pin the session to the proxy ==');
{
  /* The first cut of the fallback pinned on ANY direct failure, so one 503
     routed every later call through our own server for the rest of the
     session — hundreds of requests per scan taking a needless detour and
     burning the proxy's rate limit, while Binance was reachable throughout.

     451, 403 and a CORS-shaped throw are the geo-block and are stable, so
     they pin. A readable 5xx is the upstream having a bad minute. */
  const trial = async (directFn, proxyOk) => {
    const ctx = { console: { log(){}, warn(){} }, Math, Date, isFinite, JSON, Array, Object,
                  Number, String, Promise, setTimeout, clearTimeout, AbortController,
                  encodeURIComponent, TypeError };
    ctx.window = ctx; ctx.globalThis = ctx;
    const seen = [];
    ctx.fetch = async (url) => {
      const isProxy = String(url).indexOf('/api/proxy') === 0;
      seen.push(isProxy ? 'PROXY' : 'DIRECT');
      if (isProxy) return proxyOk ? { ok: true, status: 200, json: async () => [1] }
                                  : { ok: false, status: 502, json: async () => null };
      return directFn();
    };
    vm.createContext(ctx);
    vm.runInContext(BIN, ctx, { filename: 'binance.js' });
    await ctx.__binFetchJson('https://api.binance.com/x');
    const via = ctx.hgBinanceVia();
    seen.length = 0;
    await ctx.__binFetchJson('https://api.binance.com/x');
    return { via, next: seen.join('+') };
  };

  const geo = await trial(() => ({ ok: false, status: 451, json: async () => null }), true);
  ok(geo.via === 'proxy', 'a 451 geo-block pins to the proxy');
  ok(geo.next === 'PROXY', 'and later calls skip the doomed direct attempt');

  const forbidden = await trial(() => ({ ok: false, status: 403, json: async () => null }), true);
  ok(forbidden.via === 'proxy', 'so does a 403');

  const cors = await trial(() => { throw new TypeError('Failed to fetch'); }, true);
  ok(cors.via === 'proxy', 'and a CORS-shaped throw, BUT only because the proxy then worked');

  for (const status of [500, 502, 503, 504]){
    const blip = await trial(() => ({ ok: false, status, json: async () => null }), true);
    ok(blip.via !== 'proxy', 'a transient ' + status + ' does NOT pin the session (via=' + blip.via + ')');
    ok(blip.next.indexOf('DIRECT') === 0, 'and the next call tries direct again (' + blip.next + ')');
  }

  /* If the network itself is down, direct throws AND the proxy fails — that
     is not a geo-block and must not be recorded as one. */
  const down = await trial(() => { throw new TypeError('Failed to fetch'); }, false);
  ok(down.via === 'blocked', 'a total outage reads blocked, not proxy (' + down.via + ')');
  ok(down.next.indexOf('DIRECT') === 0, 'and direct is retried when the network may have returned');
}

console.log('\n== regime.js gets the same fallback ==');
{
  ok(/\/api\/proxy\?url=/.test(REGIME), 'regime.js tries the proxy');
  ok(/catch \(eDirect\)/.test(REGIME) && /catch \(eProxy\)/.test(REGIME),
     'and survives a throw on either path');
  ok(REGIME.indexOf('eDirect') < REGIME.indexOf('eProxy'), 'direct first, proxy second');
}

console.log('\n== a blocked venue is not a silent contract ==');
{
  const W = boot();
  const rows = tape();
  const hit = { kind: 'ORB', dir: 'long', level: 60000, why: 't' };
  const PERP = ['funding', 'oi-build', 'retail-contrarian', 'taker-flow', 'book-depth'];
  const at = (via, enriched) => {
    W.hgBinanceVia = via === null ? undefined : () => via;
    return W.hgOmniGates(rows, hit, null, { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2, enriched });
  };
  const blocked = at('blocked', true);
  for (const k of PERP){
    const g = blocked.filter(x => x.key === k)[0];
    ok(/unreachable from this browser and via the proxy/.test(g.why), k + ' names the block');
    ok(/not a statement about this contract/.test(g.why), k + ' refuses to blame the contract');
  }
  const reachable = at('direct', true);
  for (const k of PERP){
    ok(/not published|not reported|not available/.test(reachable.filter(x => x.key === k)[0].why),
       k + ' still reports a genuine venue gap when Binance IS reachable');
  }
  const beyond = at('direct', false);
  ok(/confluence ceiling/.test(beyond.filter(x => x.key === 'funding')[0].why),
     'and past the cap it still says it was never asked — three distinct reasons, three messages');
}

console.log('\n== net-r: the R on the card was gross ==');
{
  const W = boot(['crypto-position-risk.js']);
  const rows = tape();
  const nr = (dir, plan) => W.hgOmniGates(rows, { kind: 'ORB', dir, level: 60000, why: 't' }, null,
    { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2, plan }).filter(g => g.key === 'net-r')[0];

  const wide = nr('long', { entry: 0.05747, stop: 0.04981, t1: 0.07279 });
  ok(/2\.00R gross/.test(wide.why), 'a wide stop states its gross R');
  ok(/net of fees/.test(wide.why), 'and its net');
  ok(/wins to break even/.test(wide.why), 'and the win rate it implies');

  /* THE BUG: a SHORT read "2.00R gross, -2.05R net" because gross used
     Math.abs while the library computes it signed. */
  const short = nr('short', { entry: 423.31, stop: 426.9633, t1: 416.0033 });
  ok(!/-\d/.test(short.why.split('net of fees')[0]), 'a SHORT no longer reports a negative net against a positive gross');
  ok(/2\.00R gross/.test(short.why), 'it reads 2.00R gross (' + short.why.slice(0, 46) + ')');
  ok(short.pass === true, 'and passes — an 0.86% stop is not fee-dominated');

  /* THE OTHER BUG: cost and net priced on different fee sides, so the two
     numbers on one line did not reconcile. */
  const tight = nr('long', { entry: 100, stop: 99.9, t1: 100.2 });
  const g = /(\d+\.\d+)R gross, (\d+\.\d+)R net of fees \(cost (\d+\.\d+)R\)/.exec(tight.why);
  ok(!!g, 'the tight stop reports gross, net and cost (' + tight.why.slice(0, 56) + ')');
  ok(Math.abs((parseFloat(g[1]) - parseFloat(g[3])) - parseFloat(g[2])) < 0.02,
     'and gross minus cost equals net — the three numbers reconcile');
  ok(parseFloat(g[3]) > 0.4, 'a 0.1% stop is genuinely expensive in R (' + g[3] + 'R)');

  /* A broken plan is a broken plan, not an expensive one. */
  const wrong = nr('long', { entry: 100, stop: 98, t1: 95 });
  ok(wrong.pass === false, 'a target on the wrong side of entry fails');
  ok(/wrong side of entry/.test(wrong.why), 'and says exactly that, not "fees"');

  ok(nr('long', null).pass === null, 'no plan reads UNCHECKED');
}

console.log('\n== liq-room: the leverage at which liquidation reaches the stop ==');
{
  const W = boot(['crypto-position-risk.js']);
  const rows = tape();
  const lr = plan => W.hgOmniGates(rows, { kind: 'ORB', dir: 'long', level: 60000, why: 't' }, null,
    { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2, plan }).filter(g => g.key === 'liq-room')[0];

  const wide = lr({ entry: 0.05747, stop: 0.04981, t1: 0.07279 });
  ok(/liquidation clears the stop up to \d+x leverage/.test(wide.why), 'it states the max leverage (' + wide.why + ')');
  const tight = lr({ entry: 100, stop: 99.9, t1: 100.2 });
  const wl = parseInt(/up to (\d+)x/.exec(wide.why)[1], 10);
  const tl = parseInt(/up to (\d+)x/.exec(tight.why)[1], 10);
  ok(tl > wl, 'a tighter stop allows more leverage before liquidation reaches it ('
    + tl + 'x vs ' + wl + 'x)');
  ok(lr(null).pass === null, 'no plan reads UNCHECKED');
}

console.log('\n== both are info: they inform sizing, they do not veto ==');
{
  const W = boot(['crypto-position-risk.js']);
  const gs = W.hgOmniGates(tape(), { kind: 'ORB', dir: 'long', level: 60000, why: 't' }, null,
    { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2,
      plan: { entry: 100, stop: 98, t1: 95 } });
  for (const k of ['net-r', 'liq-room']){
    ok(gs.filter(x => x.key === k)[0].info === true, k + ' is an INFO gate');
  }
  const grade = W.hgOmniGrade(gs);
  ok(grade.vetoes.indexOf('net-r') === -1 && grade.vetoes.indexOf('liq-room') === -1,
     'neither can veto — leverage is the user\'s decision and this desk places no orders');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL GEOBLOCK AND RISK TESTS PASSED');

function boot(extra){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp,
                setTimeout, clearTimeout, encodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  const el = () => ({ style: {}, innerHTML: '', textContent: '', id: '', appendChild(){},
                      setAttribute(){}, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] });
  ctx.document = { createElement: el, getElementById: () => null, querySelector: () => null,
                   querySelectorAll: () => [], head: { appendChild(){} }, body: el(),
                   documentElement: el(), addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'omniroute.js'].concat(extra || [])){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
function tape(){
  const out = []; let p = 60000;
  const T0 = 1700000000 - (1700000000 % 14400);
  for (let i = 0; i < 200; i++){ p = p * (1 + Math.sin(i / 9) * 0.004);
    out.push({ t: T0 + i * 14400, o: p, h: p * 1.002, l: p * 0.998, c: p, v: 1000 }); }
  return out;
}
