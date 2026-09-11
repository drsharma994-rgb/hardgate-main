/* HARDGATE — goldultra.js unit tests (Node 18+, builtins only, ZERO network).
   Boots goldultra.js ALONE as a classic script (window = {}), the way
   scripts/backtest-goldultra.mjs boots it — proving the self-contained
   kernel needs no global.

   Covers: registration under HG_tabs / HG_warmups; mount never throws and
   prints NOT YET MEASURED when no evidence is baked; the read universe
   (every read has name/kind/why, kinds are only vote/regime/print/n-a, only
   'vote' reads ever carry a vote, market-breadth and beta/corr are n/a, the
   AMA/Aroon-osc/linreg-slope/EWO duplicates are print-only); a clean uptrend
   fires LONG with valid geometry and a downtrend fires SHORT; noise fires
   nothing and names the agreement gate; the forming bar is never read; too
   few bars is honest; the cost floor widens a tight stop and SAYS so; the
   NOT-YET-MEASURED gate blocks tradable fires without allowUnverified;
   determinism.
   Run: node tests/test-goldultra.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('ok    - ' + m); } else { fail++; console.error('FAIL  - ' + m); } }
function boot(){
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'goldultra.js', 'utf8'), { filename: 'goldultra.js' });
  return globalThis.window;
}
const T0 = 1789000000 - (1789000000 % 900);
function mk(n, step, f){ const out = []; for (let i = 0; i < n; i++){ const c = f(i), o = i ? f(i - 1) : c; out.push({ t: T0 + i * step, o, h: Math.max(o, c) + 0.6, l: Math.min(o, c) - 0.6, c, v: 900 + (i % 5) * 40 }); } return out; }
const up15 = mk(320, 900, i => 4300 + i * 0.9 + Math.sin(i / 3) * 0.4);
const dn15 = mk(320, 900, i => 4600 - i * 0.9 + Math.sin(i / 3) * 0.4);
const flat15 = mk(320, 900, i => 4400 + Math.sin(i / 2.3) * 2.5 + Math.cos(i / 7.1) * 1.5);
const mk1h = f => mk(400, 3600, f);
const upNow = (up15[319].t + 900) * 1000;

console.log('== 0) registration + mount ==');
{
  const W = boot();
  const tab = W.HG_tabs.find(t => t.id === 'goldultra');
  assert(!!tab && tab.label === 'GOLD ULTRA' && typeof tab.mount === 'function' && typeof tab.refresh === 'function', 'HG_tabs: id=goldultra, label=GOLD ULTRA, mount+refresh');
  assert(!!(W.HG_warmups || []).find(t => t.id === 'goldultra'), 'HG_warmups entry registered');
  assert(typeof W.goldUltraEngine === 'function' && typeof W.goldUltraVotes === 'function', 'engine + votes exported');
  const stubs = {}; const el = { innerHTML: '', querySelector: s => (stubs[s] = stubs[s] || { innerHTML: '', textContent: '', style: {}, disabled: false, addEventListener(){} }) };
  let threw = false; try{ tab.mount(el); }catch(e){ threw = true; }
  assert(!threw && /GOLD ULTRA/.test(el.innerHTML) && /id="guRun"/.test(el.innerHTML), 'mount renders the panel + SCAN button without throwing');
  const E = W.HG_GOLD_ULTRA_EVIDENCE, panel = stubs['#guCards'].innerHTML;
  assert(!!E && E.oos && E.oos.n >= 50 && isFinite(E.oos.avgR_net_xm), 'VERIFIED evidence is baked (OOS n=' + (E && E.oos ? E.oos.n : '—') + ')');
  assert(/VERIFIED RESULTS/.test(panel) && new RegExp('n=' + E.oos.n).test(panel) && /out-of-sample/.test(panel), 'the panel prints the baked OUT-OF-SAMPLE numbers, not the in-sample pick');
  assert(E.tradable === false && /did NOT pay/.test(E.verdict) && /NOT tradable|did NOT pay/.test(panel), 'the measured verdict is printed straight: this rule did NOT pay after costs, so it is NOT tradable');
  assert(E.rule.minPct === W.HG_GOLD_ULTRA_RULE.minPct && E.rule.regimeGate === W.HG_GOLD_ULTRA_RULE.regimeGate, 'the live RULE is exactly the one the evidence was measured with (no drift between panel and engine)');
  const escT = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  assert(E.limitations.length >= 5 && E.limitations.every(l => panel.indexOf(escT(l)) >= 0), 'every stated limitation is printed verbatim on the panel');
  const visible = el.innerHTML.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/No strategy measures 100%/g, '');
  assert(!/100%/.test(visible), 'no 100% claim anywhere in the visible text but the fixed honesty note');
  let mThrew = false; try{ tab.mount(null); }catch(e){ mThrew = true; }
  assert(!mThrew, 'mount(null) never throws');
  assert(W.goldUltraState() === null, 'state null before the first scan');
}

console.log('== 1) the read universe ==');
{
  const W = boot();
  const r = W.goldUltraEngine({ rows15m: up15, rows1h: mk1h(i => 4200 + i * 0.5), now: upNow, allowUnverified: true });
  assert(r.ok && Array.isArray(r.votes) && r.votes.length >= 130, 'at least 130 reads fed (got ' + (r.votes ? r.votes.length : 0) + ')');
  const kinds = ['vote', 'regime', 'print', 'n/a'];
  assert(r.votes.every(v => v.name && v.why && kinds.indexOf(v.kind) >= 0), 'every read has a name, a rule, and a kind in {vote, regime, print, n/a}');
  assert(r.votes.every(v => v.vote === 1 || v.vote === -1 || v.vote === 0), 'every vote is exactly -1 / 0 / +1');
  assert(r.votes.filter(v => v.kind !== 'vote').every(v => v.vote === 0), 'only vote-kind reads ever carry a vote (regime/print/n-a are always 0)');
  const ids = r.votes.map(v => v.id);
  for (const id of ['br_ad', 'br_trin', 'br_mcc', 'br_mcs', 'beta', 'corr']) assert(r.votes.find(v => v.id === id).kind === 'n/a', id + ' is n/a — a single instrument cannot compute it, never faked');
  for (const id of ['ama', 'aroon_osc', 'lr_slope', 'ewo', 'volosc', 'vroc']) assert(r.votes.find(v => v.id === id).kind === 'print', id + ' is print-only (duplicate information or participation), never counted');
  const want = ['kama', 'alma', 'bb', 'dma', 'donchian', 'dema', 'env', 'cascade', 'fcb', 'gmma', 'hma', 'cloud', 'tk', 'chikou', 'kc', 'lsma', 'mama', 'mcginley', 'mavp', 'psar', 'piv_std', 'piv_fib', 'piv_cam', 'piv_woo', 'piv_dem', 'pchan', 'smma', 'supertrend', 'tema', 't3', 'vwap', 'vwma', 'wma', 'zigzag',
    'apo', 'ao', 'bop', 'cog', 'cmo', 'cci', 'coppock', 'dpo', 'dmi', 'elder', 'fisher', 'fosc', 'gator', 'imi', 'kst', 'macd_line', 'macd_hist', 'mom', 'ppo', 'qqe', 'roc', 'rmi', 'rsi', 'rvi', 'stc', 'smi', 'stoch_fast', 'stoch_slow', 'stoch_full', 'stochrsi', 'trix', 'tsi', 'uo', 'willr',
    'adr', 'atr', 'bbw', 'pctb', 'chv', 'chop', 'hv', 'mass', 'natr', 'sd', 'tr', 'ulcer', 'vstop', 'vortex',
    'adl', 'asi', 'cmf', 'chosc', 'eom', 'efi', 'klinger', 'bwmfi', 'mfi', 'nvi', 'obv', 'pvi', 'pvt', 'vprof',
    'adx', 'adxr', 'aroon', 'tii', 'vhf', 'ht_dcp', 'ht_dcph', 'ht_phasor', 'ht_sine', 'ht_mode', 'lr_angle', 'lr_icpt', 'stderr', 'tsf', 'var',
    'bos', 'fvg', 'cusum', 'tsmom', 'squeeze', 'engulf', 'pin', 'threebar', 'h1_ema50', 'h1_ema200', 'h1_rsi',
    'fwma', 'frama', 'zlema', 'sinwma', 'jma', 'asia_sweep', 'choch', 'eqhl', 'mss', 'ob', 'breaker', 'amat', 'htf_stoch', 'accb', 'nowick', 'avp', 'aobv', 'cvd', 'tpo', 'va_rev', 'skew', 'lrchan', 'seband', 'zscore',
    'mitigation', 'lqvoid', 'ote', 'wavetrend', 'cipherb', 'lorentzian', 'nwe', 'utbot', 'st_ai', 'trendmagic', 'halftrend', 'ssl', 'chandelier', 'didi', 'cybercycle', 'decycler', 'emd', 'ifisher', 'itrend', 'lag_rsi', 'lag_filt', 'roofing', 'supersmoother', 'voss', 'ac', 'tdi', 'ha_smooth', 'ash', 'cci_arrows', 'td_seq', 'rei', 'vwmacd',
    'cdl_abandoned', 'cdl_star', 'cdl_hammer', 'cdl_harami', 'cdl_kicking', 'cdl_marubozu', 'cdl_piercing', 'cdl_3crows', 'cdl_3soldiers', 'cdl_3linestrike',
    'london_box', 'asia_box', 'darvas', 'atr_bands', 'starc', 'bbstop', 'jvb', 'tma', 'dsma', 'hurst', 'zz_channel', 'synth_vix', 'valuechart', 'smieo', 'tsi_macd', 'pro', 'sma_macd', 'gioteen', 'demand_idx', 'delta_wpr', 'waddah', 'aso', 'hoffman_irb', 'trendmeter', 'knn', 'lazybear_sqz',
    'better_volume', 'bsv', 'wad', 'xpfe', 'svp', 'avwap', 'gartley', 'bat', 'butterfly', 'crab', 'cypher', 'shark', 'wolfe', 'crt', 'golden_fib', 'msnr',
    'ema_ribbon', 'impulse_macd', 'hidden_div', 'twc_ratio', 'woodies', 'adhl', 'trendlines', 'alphatrend', 'ott', 'twin_range', 'range_filter', 'hull_suite', 'naive_bayes', 'lr_candles', 'madrid', 'coral', 'pp_supertrend', 'vfi', 'twiggs',
    'jdmx', 'bandpass', 'stoch_cc', 'eot', 'ebsw', 'adaptive_cg', 'fisherized_rsi', 'universal_osc', 'trendflex', 'gann_fan', 'murrey', 'rvi_vol', 'intraday_intensity', 'rainbow', 't3_velocity'];
  for (const id of ['bsmagic', 'footprint', 'bidask_vp', 'sylvester', 'tradeguider', 'im_dxy', 'im_cot', 'prop_1', 'prop_18']) assert(r.votes.find(v => v.id === id) && r.votes.find(v => v.id === id).kind === 'n/a', id + ' is n/a — proprietary / tape / second-series, never faked');
  assert(r.votes.find(v => v.id === 'jma').name.indexOf('public approximation') >= 0 && r.votes.find(v => v.id === 'cvd').name.indexOf('proxy') >= 0, 'JMA and CVD are labelled as the public approximation / proxy they are');
  const missing = want.filter(id => ids.indexOf(id) < 0);
  assert(missing.length === 0, 'every named indicator of the directory is present (missing: ' + (missing.join(',') || 'none') + ')');
  assert(r.count.kinds.vote >= 100, 'at least 100 directional reads can vote (got ' + r.count.kinds.vote + ')');
  assert(!r.votes.some(v => v.kind === 'vote' && v.vote !== 0 && /^—/.test(String(v.read))), 'no read VOTES a side while printing an unreadable value (an unreadable read is neutral, never a vote)');
}

console.log('== 2) direction: trend up fires LONG, trend down fires SHORT, noise fires nothing ==');
{
  const W = boot();
  const vc = { venue: 'XM', rtFrac: 0.0002 };
  const up = W.goldUltraEngine({ rows15m: up15, rows1h: mk1h(i => 4200 + i * 0.5), now: upNow, allowUnverified: true, venueCost: vc });
  assert(up.ok && up.count.lead === 'long' && up.count.long > 2 * up.count.short, 'clean uptrend: long votes dominate (' + up.count.long + ' vs ' + up.count.short + ')');
  assert(up.fire === true && up.dir === 'long', 'clean uptrend FIRES LONG under the default rule (pct ' + Math.round(up.count.pct * 100) + '%)');
  assert(up.plan && up.plan.stop < up.plan.entry && up.plan.t1 > up.plan.entry && up.plan.t2 > up.plan.t1, 'long geometry: stop < entry < TP1 < TP2');
  assert(Math.abs((up.plan.t1 - up.plan.entry) / (up.plan.entry - up.plan.stop) - 1.5) < 1e-9 && Math.abs((up.plan.t2 - up.plan.entry) / (up.plan.entry - up.plan.stop) - 2.5) < 1e-9, 'TP1 = 1.5R, TP2 = 2.5R exactly');
  assert(up.plan.orderType === 'BUY' && up.plan.entry === up15[319].c, 'entry is a market BUY at the last CLOSED bar’s close');
  const dn = W.goldUltraEngine({ rows15m: dn15, rows1h: mk1h(i => 4800 - i * 0.5), now: (dn15[319].t + 900) * 1000, allowUnverified: true, venueCost: vc });
  assert(dn.fire === true && dn.dir === 'short' && dn.plan.stop > dn.plan.entry && dn.plan.t1 < dn.plan.entry, 'clean downtrend FIRES SHORT with stop above / TP below');
  /* contradictory tape: every bar reverses the last one, so the fast reads
     say one thing and the slow reads sit on a tie — nothing agrees */
  const saw15 = mk(320, 900, i => 4400 + (i % 2 ? 2.2 : -2.2) + (i % 6 === 0 ? 0.7 : 0));
  const fl = W.goldUltraEngine({ rows15m: saw15, rows1h: mk1h(i => 4400 + (i % 2 ? 1 : -1)), now: (saw15[319].t + 900) * 1000, allowUnverified: true, venueCost: vc, rule: { regimeGate: true } });
  assert(fl.ok && fl.regime === 'chop' && fl.fire === false, 'a sawtooth tape reads CHOP and, with the regime gate on, does NOT fire (pct ' + Math.round(fl.count.pct * 100) + '%, decisive ' + fl.count.decisive + ')');
  assert(fl.gates.some(g => /REGIME reads CHOP/.test(g)), 'the refusal names the regime gate: ' + fl.gates.join(' | '));
  /* the BAKED rule measured the gate OFF (it did not help out-of-sample) — so
     under the live rule the same tape counts as a fire, printed for the record
     and still never a ticket (the MEASURED NOT TRADABLE gate holds) */
  const flLive = W.goldUltraEngine({ rows15m: saw15, rows1h: mk1h(i => 4400 + (i % 2 ? 1 : -1)), now: (saw15[319].t + 900) * 1000, venueCost: vc });
  assert(flLive.fire === false && flLive.gates.some(g => /MEASURED NOT TRADABLE/.test(g)), 'under the live (baked) rule the count prints but no ticket is issued — MEASURED NOT TRADABLE holds');
  /* and the smooth-but-cyclic tape still fires only when the count really agrees */
  const cyc = W.goldUltraEngine({ rows15m: flat15, rows1h: [], now: (flat15[319].t + 900) * 1000, allowUnverified: true, venueCost: vc });
  assert(cyc.ok && (cyc.fire === false || cyc.count.pct >= 0.70), 'a cyclic tape fires ONLY if the printed agreement actually clears 70% (pct ' + Math.round(cyc.count.pct * 100) + '%)');
}

console.log('== 3) honesty gates ==');
{
  const W = boot();
  const short = W.goldUltraEngine({ rows15m: up15.slice(-100), rows1h: [], now: upNow, allowUnverified: true });
  assert(short.ok === false && /not enough closed 15m bars/.test(short.reasons[0]), 'too few bars -> ok:false with the honest reason');
  const forming = up15.concat([{ t: up15[319].t + 900, o: 9000, h: 9999, l: 8000, c: 9500, v: 1 }]);
  const f1 = W.goldUltraEngine({ rows15m: forming, rows1h: [], now: upNow + 60 * 1000, allowUnverified: true });
  assert(f1.ok && f1.bar.t === up15[319].t && f1.price === up15[319].c, 'a still-forming bar (t+900 > now) is never read — the last CLOSED bar is the signal bar');
  const nov = W.goldUltraEngine({ rows15m: up15, rows1h: [], now: upNow });
  assert(nov.fire === false && nov.gates.some(g => /MEASURED NOT TRADABLE/.test(g)), 'with the measured-negative evidence baked, a perfect uptrend still yields NO ticket — the gate says MEASURED NOT TRADABLE');
  const wide = W.goldUltraEngine({ rows15m: up15, rows1h: [], now: upNow, allowUnverified: true, venueCost: { venue: 'PAXG', rtFrac: 0.0026 } });
  assert(wide.fire && wide.plan.floorNote && /widened/.test(wide.plan.floorNote) && wide.plan.risk >= 8 * 0.0026 * wide.plan.entry - 1e-9, 'a stop tighter than 8x the PAXG round trip is widened to the floor and the card SAYS so');
  const novc = W.goldUltraEngine({ rows15m: up15, rows1h: [], now: upNow, allowUnverified: true });
  assert(novc.fire && novc.gates.some(g => /venue cost unknown/.test(g)), 'no venue cost -> floor skipped and SAID, never silently');
  const noH1 = novc.votes.filter(v => ['h1_ema50', 'h1_ema200', 'h1_rsi'].indexOf(v.id) >= 0);
  assert(noH1.length === 3 && noH1.every(v => v.kind === 'print' && v.vote === 0), 'without a 1h leg the three HTF reads print "not available" and never vote');
  const a = W.goldUltraEngine({ rows15m: up15, rows1h: mk1h(i => 4200 + i * 0.5), now: upNow, allowUnverified: true });
  const b = W.goldUltraEngine({ rows15m: up15, rows1h: mk1h(i => 4200 + i * 0.5), now: upNow, allowUnverified: true });
  assert(JSON.stringify(a.votes) === JSON.stringify(b.votes) && a.line === b.line, 'deterministic: same bars -> identical reads and line');
  const rule = W.goldUltraEngine({ rows15m: up15, rows1h: [], now: upNow, allowUnverified: true, rule: { minPct: 0.99 } });
  assert(rule.fire === false && rule.gates.some(g => /< 99%/.test(g)), 'rule override is honoured (minPct 99% blocks the uptrend fire)');
}

console.log('\n' + pass + ' assertions passed' + (fail ? (', ' + fail + ' FAILED') : ''));
if (fail) process.exit(1);
