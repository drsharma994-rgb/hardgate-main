/* HARDGATE — live-order surface disabled, and contract sizing on the ticket.
   Owner decision: this build is a signal + paper-measurement terminal. It must
   not be able to route a real order, and because orders are now placed BY HAND
   on Delta, the ticket has to print the number Delta's form actually wants —
   CONTRACTS (lots), not coins. BTCUSD is 1 lot = 0.001 BTC, so typing the coin
   size into the lots field is a 1000x error.
   Run: node tests/test-no-live-trading.mjs                                   */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
console.log('== the live-order path cannot be re-armed from config ==');
{
  let fetched = 0, alerted = '';
  const ctx = {
    console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, setTimeout,
    /* deliberately HOSTILE config: a saved desk override AND a live-looking
       proxy. If the kill switch works, none of it matters. */
    localStorage: {
      getItem: (k) => (k === 'hg_execute_backend_url' ? 'https://broker.example.com/bracket' : null),
      setItem(){}, removeItem(){}
    },
    document: { readyState: 'complete', getElementById: () => null, addEventListener(){} },
    alert: (m) => { alerted = String(m); },
    confirm: () => true,
    fetch: () => { fetched++; return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }); },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.HG_EXECUTE_BACKEND_OVERRIDE = 'https://broker.example.com/bracket';
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'execute.js'), 'utf8'), ctx, { filename: 'execute.js' });
  ok(typeof ctx.hgLiveTradingEnabled === 'function', 'the kill switch is exported for other modules to read');
  ok(ctx.hgLiveTradingEnabled() === false, 'live trading is DISABLED at source');
  ok(ctx.executeBackendReady() === false,
     'executeBackendReady is false despite BOTH a window override and a saved localStorage URL');
  const before = fetched;
  const res = await ctx.executeTrade({ sym: 'BTCUSD', side: 'long', qty: 1, stop: 1, t1: 2 }, { skipConfirm: true });
  ok(res && res.ok === false, 'executeTrade refuses');
  ok(/disabled/i.test(res.reason || ''), 'the refusal names the reason: ' + res.reason);
  ok(fetched === before, 'NO network call was made — refused before the payload was built');
  ok(/disabled/i.test(alerted), 'the user is told, not silently ignored');
}
console.log('== book.js defaults to closed, even if execute.js is missing ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'book.js'), 'utf8');
  ok(/function bookLiveAllowed\(\)/.test(src), 'book.js has a single live-allowed gate');
  ok(/hgLiveTradingEnabled\(\) === true/.test(src),
     'it requires an explicit true — a missing execute.js reads as DISABLED, never open');
  ok(/if \(!bookLiveAllowed\(\)\) return false;/.test(src), 'bookExecuteReady is gated by it');
  ok(/__book\.liveReady = bookLiveAllowed\(\)/.test(src),
     'a server advertising liveExecute is declined client-side');
  ok(/if \(!bookLiveAllowed\(\)\)\{\n\s*try\{ alert\('Live order routing is disabled/.test(src),
     'bookLivePosition refuses before it posts to /api/book/live');
}
console.log('== ticket prints CONTRACTS, the number Delta actually wants ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const S = html.indexOf('const HG_CONTRACT_TTL');
  const E = html.indexOf('function planTrade(){');
  if (S < 0 || E < 0 || E < S) throw new Error('FAIL: contract-spec helper block not found in index.html');
  const ctx = {
    console, Math, isFinite, parseFloat, JSON, Object, Number, String,
    nowSec: () => 1754400000,
    S: { contractSpecs: { BTCUSD: { cv: 0.001, tick: 0.5, unit: 'BTC' },
                          ETHUSD: { cv: 0.01,  tick: 0.05, unit: 'ETH' } } },
    localStorage: { getItem: () => null, setItem(){} },
    document: { getElementById: () => null },
    DELTA: 'https://api.india.delta.exchange',
    fetch: () => Promise.reject(new Error('no net')),
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(html.slice(S, E), ctx, { filename: 'contract-block' });
  /* 0.0234 BTC — what the old ticket printed */
  const btc = ctx.hgQtyToContracts('BTCUSD', 0.0234);
  ok(btc.lots === 23, '0.0234 BTC is 23 lots, not "0.0234"');
  ok(btc.cv === 0.001, 'BTCUSD lot size read from the Delta spec');
  ok(Math.abs(btc.coinActual - 0.023) < 1e-9, 'the real filled size is reported back');
  /* DIRECTION MATTERS and is easy to get backwards. contract_value < 1 means
     the coin number is SMALLER than the lot number, so typing the coin figure
     into the lots field UNDER-sizes by 1/cv. On BTCUSD that is 1000x under —
     you believe you risked 1% and you risked 0.001%. It is only an OVER-size
     for a symbol whose contract_value exceeds 1. */
  ok(Math.abs(btc.raw / 0.0234 - 1000) < 1e-6,
     'the lot number is 1000x the coin number on BTCUSD (cv 0.001)');
  ok(0.0234 * btc.cv < 0.0234,
     'typing the coin figure into the lots field UNDER-sizes, it does not over-size');
  const eth = ctx.hgQtyToContracts('ETHUSD', 0.55);
  ok(eth.lots === 55, 'ETHUSD 0.55 ETH is 55 lots (1 lot = 0.01 ETH)');
  /* rounding must never size ABOVE approved risk */
  const r = ctx.hgQtyToContracts('BTCUSD', 0.0239);
  ok(r.lots === 23, 'partial lots round DOWN — never above the risk you approved');
  ok(r.shortfallPct > 0 && r.shortfallPct < 5, 'the shortfall is reported (' + r.shortfallPct.toFixed(2) + '%)');
  /* a position smaller than one lot must be called out, not silently zeroed */
  const tiny = ctx.hgQtyToContracts('BTCUSD', 0.0004);
  ok(tiny.lots === 0, 'sub-lot position reports 0 lots');
  ok(tiny.raw > 0 && tiny.raw < 1, 'and keeps the raw fraction so the ticket can explain it');
  ok(ctx.hgQtyToContracts('NOTLISTED', 1) === null, 'unknown symbol returns null — never a guessed lot count');
  ok(ctx.hgQtyToContracts('BTCUSD', 0) === null, 'zero qty returns null');
  ok(ctx.hgContractSpec('ETHUSD').unit === 'ETH', 'the unit currency comes from the spec, not a guess');
}
console.log('== quiet candle cache outlives the alert cycle ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ttl = +(/const HG_CANDLE_TTL_QUIET = (\d+);/.exec(html) || [])[1];
  const cycleMs = +(/const HG_TAB_ALERT_MS = (\d+) \* 60 \* 1000;/.exec(html) || [])[1] * 60;
  ok(isFinite(ttl) && isFinite(cycleMs), 'both constants are readable');
  ok(ttl > cycleMs,
     'quiet TTL ' + ttl + 's exceeds the ' + cycleMs + 's cycle — cached candles survive the boundary');
}
/* The browser was never the only way out. The Render worker (app.js) imports a
   CCXT executor and render.yaml used to document arming it via env vars, which
   meant this whole file guarded one of TWO execution routes. Guard both. */
console.log('== the daemon cannot route an order either ==');
{
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  ok(/const HG_DAEMON_EXECUTION_ENABLED = false;/.test(app),
     'app.js carries the source-level kill switch, set to false');
  /* The executor must sit behind the switch, not be called unconditionally —
     constructing it reads API keys and creates an exchange client. */
  ok(/HG_DAEMON_EXECUTION_ENABLED \? hgCcxtExecutorFromEnv\(\) : null/.test(app),
     'hgCcxtExecutorFromEnv() is never invoked while the switch is false — no key is read');
  ok(!/^\s*var executor = hgCcxtExecutorFromEnv\(\);/m.test(app),
     'the old unconditional executor construction is gone');
  /* dryRun must not be derivable purely from env, or a Render dashboard edit
     re-arms live orders with no code review. */
  ok(/dryRun: !HG_DAEMON_EXECUTION_ENABLED \|\|/.test(app),
     'dryRun is forced by the source switch, not just by env vars');
  const yaml = fs.readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');
  ok(!/^\s*-?\s*key:\s*EXECUTE_CCXT_/m.test(yaml),
     'render.yaml declares no EXECUTE_CCXT_* key for an operator to fill in');
  ok(/LIVE EXECUTION IS DISABLED IN SOURCE/.test(yaml),
     'render.yaml states the constraint instead of documenting how to arm it');
}
console.log('\n' + passed + ' passed, 0 failed');
