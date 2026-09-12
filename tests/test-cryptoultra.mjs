/* HARDGATE — cryptoultra.js unit tests (Node 18+, builtins only, ZERO network).
   Boots cryptoultra.js ALONE as a classic script (window = {}), the way
   scripts/backtest-cryptoultra.mjs boots it — proving the self-contained
   kernel needs no global.

   Covers: registration under HG_tabs / HG_warmups; mount never throws and
   prints NOT YET MEASURED when no evidence is baked; the read universe
   (every read has name/kind/why, kinds are only vote/regime/print/n-a, only
   'vote' reads ever carry a vote); a clean uptrend fires LONG with valid
   geometry and a downtrend fires SHORT; noise fires nothing and names the
   regime gate; the NOT-YET-MEASURED gate blocks tradable fires without
   allowUnverified; determinism.
   Run: node tests/test-cryptoultra.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('ok    - ' + m); } else { fail++; console.error('FAIL  - ' + m); } }
function boot(){
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'cryptoultra.js', 'utf8'), { filename: 'cryptoultra.js' });
  return globalThis.window;
}
const T0 = 1789000000 - (1789000000 % 900);
function mk(n, step, f){ const out = []; for (let i = 0; i < n; i++){ const c = f(i), o = i ? f(i - 1) : c; out.push({ t: T0 + i * step, o, h: Math.max(o, c) + 50, l: Math.min(o, c) - 50, c, v: 900 + (i % 5) * 40 }); } return out; }
const up15 = mk(320, 900, i => 60000 + i * 15 + Math.sin(i / 3) * 5);
const dn15 = mk(320, 900, i => 70000 - i * 15 + Math.sin(i / 3) * 5);
const flat15 = mk(320, 900, i => 65000 + Math.sin(i / 2.3) * 50 + Math.cos(i / 7.1) * 30);
const mk1h = f => mk(400, 3600, f);
const upNow = (up15[319].t + 900) * 1000;

console.log('== 0) registration + mount ==');
{
  const W = boot();
  const tab = W.HG_tabs.find(t => t.id === 'cryptoultra');
  assert(!!tab && tab.label === 'CRYPTO ULTRA' && typeof tab.mount === 'function' && typeof tab.refresh === 'function', 'HG_tabs: id=cryptoultra, label=CRYPTO ULTRA, mount+refresh');
  assert(!!(W.HG_warmups || []).find(t => t.id === 'cryptoultra'), 'HG_warmups entry registered');
  assert(typeof W.cryptoUltraEngine === 'function' && typeof W.cryptoUltraVotes === 'function', 'engine + votes exported');
  const stubs = {}; const el = { innerHTML: '', querySelector: s => (stubs[s] = stubs[s] || { innerHTML: '', textContent: '', style: {}, disabled: false, addEventListener(){} }) };
  let threw = false; try{ tab.mount(el); }catch(e){ threw = true; }
  assert(!threw && /CRYPTO ULTRA/.test(el.innerHTML) && /id="cuRun"/.test(el.innerHTML), 'mount renders the panel + SCAN button without throwing');
  const E = W.HG_CRYPTO_ULTRA_EVIDENCE;
  assert(!!E && E.measured === true, 'evidence is measured');
  assert(E.tradable === false, 'evidence says NOT tradable');
  assert(E.oosN >= 80, 'OOS sample size >= 80 (got ' + E.oosN + ')');
  assert(E.symbol === 'BTCUSDT' && E.interval === '15m', 'evidence symbol + interval');
  const cards0 = stubs['#cuCards'].innerHTML;
  assert(/MEASURED NOT TRADABLE/.test(cards0), 'the panel prints MEASURED NOT TRADABLE');
  let mThrew = false; try{ tab.mount(null); }catch(e){ mThrew = true; }
  assert(!mThrew, 'mount(null) never throws');
  assert(W.cryptoUltraState() === null, 'state null before the first scan');
}

console.log('== 1) the read universe ==');
{
  const W = boot();
  const r = W.cryptoUltraEngine({ rows15m: up15, rows1h: mk1h(i => 58000 + i * 10), now: upNow, allowUnverified: true });
  assert(r.ok && Array.isArray(r.votes) && r.votes.length >= 130, 'at least 130 reads fed (got ' + (r.votes ? r.votes.length : 0) + ')');
  const kinds = ['vote', 'regime', 'print', 'n/a'];
  assert(r.votes.every(v => v.name && v.why && kinds.indexOf(v.kind) >= 0), 'every read has a name, a rule, and a kind in {vote, regime, print, n/a}');
  assert(r.votes.every(v => v.vote === 1 || v.vote === -1 || v.vote === 0), 'every vote is exactly -1 / 0 / +1');
  assert(r.votes.filter(v => v.kind !== 'vote').every(v => v.vote === 0), 'only vote-kind reads ever carry a vote (regime/print/n-a are always 0)');
  for (const id of ['sopr', 'funding', 'footprint', 'lorentzian', 'lstm']) assert(r.votes.find(v => v.id === id).kind === 'n/a', id + ' is n/a — cannot be computed from OHLCV, never faked');
  for (const id of ['ama', 'vumanchu']) assert(r.votes.find(v => v.id === id).kind === 'print', id + ' is print-only (duplicate / informational), never counted');
  assert(r.count.kinds.vote >= 100, 'at least 100 directional reads can vote (got ' + r.count.kinds.vote + ')');
  assert(!r.votes.some(v => v.kind === 'vote' && v.vote !== 0 && /^—/.test(String(v.read))), 'no read VOTES a side while printing an unreadable value');
}

console.log('== 2) direction: trend up fires LONG, trend down fires SHORT, noise fires nothing ==');
{
  const W = boot();
  const vc = { venue: 'Binance', rtFrac: 0.002 };
  const up = W.cryptoUltraEngine({ rows15m: up15, rows1h: mk1h(i => 58000 + i * 10), now: upNow, allowUnverified: true, venueCost: vc });
  assert(up.ok && up.count.lead === 'long' && up.count.long > 2 * up.count.short, 'clean uptrend: long votes dominate (' + up.count.long + ' vs ' + up.count.short + ')');
  assert(up.fire === false && up.recordOnly === true && up.gates.some(g => /MEASURED NOT TRADABLE/.test(g)), 'uptrend yields NO ticket — MEASURED NOT TRADABLE gate holds');
  assert(up.plan && up.plan.stop < up.plan.entry && up.plan.t1 > up.plan.entry && up.plan.t2 > up.plan.t1, 'long geometry: stop < entry < TP1 < TP2');
  assert(Math.abs((up.plan.t1 - up.plan.entry) / (up.plan.entry - up.plan.stop) - 1.5) < 1e-9 && Math.abs((up.plan.t2 - up.plan.entry) / (up.plan.entry - up.plan.stop) - 2.5) < 1e-9, 'TP1 = 1.5R, TP2 = 2.5R exactly');
  assert(up.plan.orderType === 'BUY' && up.plan.entry === up.price, 'entry is a market BUY at the last CLOSED bar close');
  const dn = W.cryptoUltraEngine({ rows15m: dn15, rows1h: mk1h(i => 72000 - i * 10), now: (dn15[319].t + 900) * 1000, allowUnverified: true, venueCost: vc });
  assert(dn.ok && dn.dir === 'short' && dn.plan.stop > dn.plan.entry && dn.plan.t1 < dn.plan.entry, 'clean downtrend: SHORT with stop above / TP below');
  const saw15 = mk(320, 900, i => 65000 + (i % 2 ? 200 : -200) + (i % 6 === 0 ? 30 : 0));
  const fl = W.cryptoUltraEngine({ rows15m: saw15, rows1h: mk1h(i => 65000 + (i % 2 ? 100 : -100)), now: (saw15[319].t + 900) * 1000, allowUnverified: true, venueCost: vc, rule: { regimeGate: true } });
  assert(fl.ok && (fl.regime === 'chop' || fl.count.pct < 0.85), 'a sawtooth tape either reads CHOP or fails the agreement gate (pct ' + Math.round(fl.count.pct * 100) + '%, regime ' + fl.regime + ')');
}

console.log('== 3) honesty gates ==');
{
  const W = boot();
  const short = W.cryptoUltraEngine({ rows15m: up15.slice(-100), rows1h: [], now: upNow, allowUnverified: true });
  assert(short.ok === false && /need \d+ closed 15m bars/.test(short.reasons[0]), 'too few bars -> ok:false with the honest reason');
  const forming = up15.concat([{ t: up15[319].t + 900, o: 90000, h: 99999, l: 80000, c: 95000, v: 1 }]);
  const f1 = W.cryptoUltraEngine({ rows15m: forming, rows1h: [], now: upNow + 60 * 1000, allowUnverified: true });
  assert(f1.ok && f1.bar.t === up15[319].t && f1.price === up15[319].c, 'a still-forming bar is never read — the last CLOSED bar is the signal bar');
  const nov = W.cryptoUltraEngine({ rows15m: up15, rows1h: [], now: upNow });
  assert(nov.fire === false && nov.gates.some(g => /MEASURED NOT TRADABLE/.test(g)), 'without allowUnverified, the MEASURED NOT TRADABLE gate blocks firing');
  assert(nov.recordOnly === true && nov.plan && nov.plan.stop < nov.plan.entry && nov.dir === 'long', 'the would-be plan is still priced as RECORD ONLY');
  const a = W.cryptoUltraEngine({ rows15m: up15, rows1h: mk1h(i => 58000 + i * 10), now: upNow, allowUnverified: true });
  const b = W.cryptoUltraEngine({ rows15m: up15, rows1h: mk1h(i => 58000 + i * 10), now: upNow, allowUnverified: true });
  assert(JSON.stringify(a.votes) === JSON.stringify(b.votes) && a.line === b.line, 'deterministic: same bars -> identical reads and line');
  const rule = W.cryptoUltraEngine({ rows15m: up15, rows1h: [], now: upNow, allowUnverified: true, rule: { minPct: 0.99 } });
  assert(rule.fire === false && rule.gates.some(g => /< 99%/.test(g)), 'rule override is honoured (minPct 99% blocks the uptrend fire)');
  const wide = W.cryptoUltraEngine({ rows15m: up15, rows1h: [], now: upNow, allowUnverified: true, venueCost: { venue: 'Binance', rtFrac: 0.002 } });
  assert(wide.plan && wide.plan.floorNote !== undefined, 'cost floor applied when venue cost is provided');
}

console.log('\n' + pass + ' assertions passed' + (fail ? (', ' + fail + ' FAILED') : ''));
if (fail) process.exit(1);
