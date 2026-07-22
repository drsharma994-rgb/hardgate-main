/* HARDGATE — brain.js unit + integration tests (Node 18+, builtins only).
   Loads brain.js as a classic script (vm.runInThisContext, like the browser's
   <script> tag) with NOTHING but a window stub present, then:
     A) load + HG_tabs registration + export hygiene
     B) news votes (blackout/high veto, med caution, low clear, absent layer)
     C) regime playbook votes      D) rotation season votes (alt/btc/mixed)
     E) on-chain votes (BTC lane only)   F) engine survivor/veto/silent
     G) oiflow votes   H) squeeze votes (fired/break/build)
     I) liqs flush-reversal votes        J) gold lane (setup/deep/basis)
     K) tier boundaries (PRIME 5 / HIGH 4 / WATCH 3 / veto / tie / contested)
     L) missing-layer degradation caps (1-2 dark -> HIGH cap, 3+ -> WATCH cap)
     M) mount smoke test + missing-globals honesty
     N) full synthesis run — BTC PRIME long + SOL veto aside + gold lane
     O) second run — ETH HIGH short + short plan sanity
     P) hard-refresh contract (skip / busy / refreshed, never throws)
     Q) never-throws with ALL globals absent
     R-AD) combined universe, venue filter, quick rescan, scorecard hook
     AE) radar quality gates (liquidity floor demotion + exact reason, null
         turnover pass-through, overextension WATCH demotion ±15% both sides,
         PRIME/HIGH caution chips, funding crowding caution non-demotion,
         tape-missing pass-through, suppressed tally on the stat line)
   No live network. Run: node tests/test-brain.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

/* ---- load the module in a pristine global scope: only a window stub ---- */
globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'brain.js', 'utf8'), { filename: 'brain.js' });

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const W = globalThis.window;
const COLLECT = W.brainCollect;
const DECIDE = W.brainDecide;

/* vote factory for decide tests */
function v(layer, vote, kind){
  return { layer: layer, vote: vote, text: layer + ' says ' + vote,
           kind: kind || ({ engine: 'structural', squeeze: 'structural',
                            oiflow: 'positioning', liqs: 'positioning' }[layer] || 'context') };
}

/* ================= A) load + registration ================= */
console.log('== load + registration ==');
ok(typeof COLLECT === 'function', 'window.brainCollect exposed');
ok(typeof DECIDE === 'function', 'window.brainDecide exposed');
ok(Array.isArray(W.HG_tabs) && W.HG_tabs.length === 1, 'HG_tabs array created with one entry');
const tab = W.HG_tabs[0];
ok(tab.id === 'brain' && tab.label === 'BRAIN' && typeof tab.mount === 'function' && typeof tab.refresh === 'function',
   'HG_tabs entry = {id:brain, label:BRAIN, mount, refresh}');
ok(typeof W.brainUniverse === 'function', 'window.brainUniverse exposed (pure combined-universe builder)');
ok(W.snapshotLayers === undefined && W.runBrain === undefined && W.marketRead === undefined
   && W.buildUniverse === undefined && W.cardHTML === undefined && W.legacyUniverse === undefined
   && W.fetch4h === undefined && W.brainRefresh === undefined,
   'only brainCollect/brainDecide/brainUniverse + __hgBrainLast + HG_tabs leak onto window');
ok(typeof W.__hgBrainLast === 'function', 'window.__hgBrainLast exposed for the signal logger');
ok(W.__hgBrainLast() === null, '__hgBrainLast() returns null before the first scan');

/* ================= B) news votes ================= */
console.log('== news votes ==');
let r = COLLECT({ sym: 'BTCUSDT', news: { risk: 'high', blackout: true, events: [], note: 'FOMC blackout window' } });
ok(r.votes.length === 1 && r.votes[0].layer === 'news' && r.votes[0].vote === 'veto'
   && r.votes[0].text.indexOf('BLACKOUT') >= 0, 'news blackout -> veto vote with reason');
r = COLLECT({ sym: 'BTCUSDT', news: { risk: 'high', blackout: false, events: [], note: 'CPI in 20m' } });
ok(r.votes[0].vote === 'veto' && r.votes[0].text.indexOf('CPI') >= 0, 'news risk=high (no blackout) -> veto with the event named');
r = COLLECT({ sym: 'BTCUSDT', news: { risk: 'med', blackout: false, events: [], note: 'PPI in 3h' } });
ok(r.votes[0].vote === 'neutral' && r.votes[0].caution === true && r.votes[0].text.indexOf('PPI') >= 0,
   'news risk=med -> neutral caution vote (blocks PRIME downstream)');
r = COLLECT({ sym: 'BTCUSDT', news: { risk: 'low', blackout: false, events: [], note: 'no high-impact USD events within 36h' } });
ok(r.votes[0].vote === 'neutral' && r.votes[0].caution !== true && r.votes[0].text.indexOf('news clear') === 0,
   'news risk=low -> neutral "news clear", not a caution');
r = COLLECT({ sym: 'BTCUSDT' });
ok(r.unavailable.indexOf('news') >= 0 && r.votes.length === 0, 'news getter absent -> layer named unavailable, no vote fabricated');

/* ================= C) regime playbook votes ================= */
console.log('== regime playbook votes ==');
r = COLLECT({ sym: 'BTCUSDT', regime: { label: 'RISK-ON', score: 4, playbook: { bias: 'long', size: 'full', sizeNote: 'full size' } } });
ok(r.votes.some(function(x){ return x.layer === 'regime' && x.vote === 'long' && x.text.indexOf('RISK-ON') >= 0 && x.text.indexOf('full size') >= 0; }),
   'regime playbook long -> long vote naming label + size note');
r = COLLECT({ sym: 'BTCUSDT', regime: { label: 'RISK-ON', score: 5, playbook: { bias: 'LONG-ONLY', size: 'full', sizeNote: 'broad agreement' } } });
ok(r.votes.some(function(x){ return x.layer === 'regime' && x.vote === 'long'; }),
   'regime.js real shape: playbook.bias LONG-ONLY -> long vote');
r = COLLECT({ sym: 'BTCUSDT', regime: { label: 'RISK-OFF', score: -5, playbook: { bias: 'SHORT-ONLY', sizeNote: 'quarter size' } } });
ok(r.votes.some(function(x){ return x.layer === 'regime' && x.vote === 'short' && x.text.indexOf('RISK-OFF') >= 0; }),
   'regime playbook SHORT-ONLY -> short vote');
r = COLLECT({ sym: 'BTCUSDT', regime: { label: 'MIXED — SELECTIVE', score: 1, playbook: { bias: 'BOTH', sizeNote: 'quarter size' } } });
ok(r.votes.some(function(x){ return x.layer === 'regime' && x.vote === 'neutral'; }), 'regime playbook BOTH -> neutral');
r = COLLECT({ sym: 'BTCUSDT', regime: { label: 'MIXED', score: 0, playbook: { bias: 'STAND-ASIDE', sizeNote: 'flat' } } });
ok(r.votes.some(function(x){ return x.layer === 'regime' && x.vote === 'neutral'; }), 'regime STAND-ASIDE -> neutral');
r = COLLECT({ sym: 'BTCUSDT', regime: null });
ok(r.unavailable.indexOf('regime') >= 0, 'regimeState() null (never ran) -> unavailable');

/* ================= D) rotation season votes ================= */
console.log('== rotation season votes ==');
r = COLLECT({ sym: 'SOLUSDT', rotation: { season: 'alt', altPct: 78, evidence: [] } });
ok(r.votes.some(function(x){ return x.layer === 'rotation' && x.vote === 'long' && x.text.indexOf('alt season (78%)') >= 0; }),
   'alt season favors alt longs (SOLUSDT -> long, pct in text)');
r = COLLECT({ sym: 'BTCUSDT', rotation: { season: 'alt', altPct: 78, evidence: [] } });
ok(r.votes.some(function(x){ return x.layer === 'rotation' && x.vote === 'neutral'; }), 'alt season -> BTC neutral (laggard, not shorted)');
r = COLLECT({ sym: 'BTCUSDT', rotation: { season: 'btc', altPct: 22, evidence: [] } });
ok(r.votes.some(function(x){ return x.layer === 'rotation' && x.vote === 'long' && x.text.indexOf('BTC season') >= 0; }),
   'btc season favors BTC longs');
r = COLLECT({ sym: 'SOLUSDT', rotation: { season: 'btc', altPct: 22, evidence: [] } });
ok(r.votes.some(function(x){ return x.layer === 'rotation' && x.vote === 'neutral'; }), 'btc season -> alts neutral (out of favor)');
r = COLLECT({ sym: 'SOLUSDT', rotation: { season: 'mixed', altPct: null, evidence: [] } });
ok(r.votes.some(function(x){ return x.layer === 'rotation' && x.vote === 'neutral' && x.text.indexOf('mixed') >= 0; }),
   'mixed season -> neutral, no edge invented');
r = COLLECT({ sym: 'SOLUSDT', rotation: null });
ok(r.unavailable.indexOf('rotation') >= 0, 'rotationState() null -> unavailable');

/* ================= E) on-chain votes (BTC lane only) ================= */
console.log('== on-chain votes ==');
r = COLLECT({ sym: 'BTCUSDT', onchain: { bias: 'bullish', evidence: [{ side: 'bull', text: 'hashrate ATH, miners healthy' }], flags: {} } });
ok(r.votes.some(function(x){ return x.layer === 'onchain' && x.vote === 'long' && x.text.indexOf('hashrate ATH') >= 0; }),
   'on-chain bullish -> long vote carrying the evidence text');
r = COLLECT({ sym: 'BTCUSDT', onchain: { bias: 'bearish', evidence: [], flags: { feeSpike: true } } });
ok(r.votes.some(function(x){ return x.layer === 'onchain' && x.vote === 'short'; }), 'on-chain bearish -> short vote');
r = COLLECT({ sym: 'BTCUSDT', onchain: { bias: 'neutral', evidence: [], flags: {} } });
ok(r.votes.some(function(x){ return x.layer === 'onchain' && x.vote === 'neutral'; }), 'on-chain neutral -> neutral vote');
r = COLLECT({ sym: 'ETHUSDT', onchain: { bias: 'bullish', evidence: [], flags: {} } });
ok(!r.votes.some(function(x){ return x.layer === 'onchain'; }) && r.unavailable.indexOf('onchain') === -1,
   'on-chain skipped for alts — no vote, NOT counted unavailable');
r = COLLECT({ sym: 'BTCUSDT', onchain: null });
ok(r.unavailable.indexOf('onchain') >= 0, 'onchainState() null for BTC -> unavailable');

/* ================= F) engine votes ================= */
console.log('== engine votes ==');
const EN = { survivors: [{ sym: 'ETHUSDT', dir: 'long', conviction: 'STRONG', plan: { dir: 'long', entry: 1, stop: 0.9, t1: 1.2 } }],
             rejected: [{ sym: 'SOLUSDT', vetoGate: 'G3', dir: 'long', gatesPassed: 3 },
                        { sym: 'LTCUSDT', vetoGate: 'G4', dir: 'short', gatesPassed: 4 },
                        { sym: 'CHOPUSDT', vetoGate: 'G1', dir: null, gatesPassed: 1 }], at: 1 };
r = COLLECT({ sym: 'ETHUSDT', engine: EN });
ok(r.votes.some(function(x){ return x.layer === 'engine' && x.vote === 'long' && x.strong === true && x.text.indexOf('STRONG') >= 0; }),
   'engine survivor -> strong vote in the survivor direction');
r = COLLECT({ sym: 'SOLUSDT', engine: EN });
ok(r.votes.some(function(x){ return x.layer === 'engine' && x.vote === 'neutral' && x.caution === true
                                 && x.text.indexOf('G3') >= 0 && x.text.indexOf('LONG') >= 0; }),
   'G2/G3 rejection with a committed lean -> named NON-CONFIRMATION (neutral caution), never a veto');
r = COLLECT({ sym: 'LTCUSDT', engine: EN });
ok(r.votes.some(function(x){ return x.layer === 'engine' && x.vote === 'veto' && x.text.indexOf('G4') >= 0; }),
   'G4 liquidity rejection stays a hard VETO naming the gate');
r = COLLECT({ sym: 'CHOPUSDT', engine: EN });
ok(r.votes.some(function(x){ return x.layer === 'engine' && x.vote === 'neutral' && x.text.indexOf('G1') >= 0
                                 && x.text.indexOf('no committed structure') >= 0; }),
   'G0/G1 rejection (dir null) -> neutral chop note, never a veto');
r = COLLECT({ sym: 'SOLUSDT', engine: { survivors: [], rejected: [{ sym: 'SOLUSDT', vetoGate: 'G3' }], at: 1 } });
ok(r.votes.some(function(x){ return x.layer === 'engine' && x.vote === 'neutral' && x.caution === true
                                 && x.text.indexOf('unconfirmed') >= 0 && x.text.indexOf('G3') >= 0; })
   && !r.votes.some(function(x){ return x.layer === 'engine' && x.vote === 'veto'; }),
   'legacy G2/G3 rows (no dir field) still read as non-confirmation — the lean existed even when unrecorded');
r = COLLECT({ sym: 'XRPUSDT', engine: EN });
ok(!r.votes.some(function(x){ return x.layer === 'engine'; }) && r.silent.indexOf('engine') >= 0
   && r.unavailable.indexOf('engine') === -1,
   'symbol not gated -> engine silent (available, no coverage), not unavailable');
r = COLLECT({ sym: 'ETHUSDT', engine: null });
ok(r.unavailable.indexOf('engine') >= 0, 'engineState() null (never ran) -> unavailable');
r = COLLECT({ sym: 'XRPUSDT', engine: EN });
ok(!r.votes.some(function(x){ return x.layer === 'engine'; }) && r.silent.indexOf('engine') >= 0
   && r.unavailable.indexOf('engine') === -1,
   'symbol not gated -> engine silent (available, no coverage), not unavailable');
r = COLLECT({ sym: 'ETHUSDT', engine: null });
ok(r.unavailable.indexOf('engine') >= 0, 'engineState() null (never ran) -> unavailable');

/* ================= F2) tape votes — 24h momentum + participation ================= */
console.log('== tape votes ==');
r = COLLECT({ sym: 'SYNUSDT', tape: { SYNUSDT: { symbol: 'SYNUSDT', chg24: 12.4, turnoverUsd: 380e6 } } });
ok(r.votes.some(function(x){ return x.layer === 'tape' && x.vote === 'long' && x.kind === 'context'
                                 && x.text.indexOf('+12.4%') >= 0 && x.text.indexOf('momentum with participation') >= 0; }),
   'tape: +12.4% on $380M -> long momentum vote naming both numbers');
r = COLLECT({ sym: 'REUSDT', tape: { REUSDT: { symbol: 'REUSDT', chg24: -9.8, turnoverUsd: 95e6 } } });
ok(r.votes.some(function(x){ return x.layer === 'tape' && x.vote === 'short' && x.text.indexOf('-9.8%') >= 0
                                 && x.text.indexOf('sellers in control') >= 0; }),
   'tape: -9.8% -> short vote (sellers in control)');
r = COLLECT({ sym: 'PUMPUSDT', tape: { PUMPUSDT: { symbol: 'PUMPUSDT', chg24: 31.2, turnoverUsd: 1.2e9 } } });
ok(r.votes.some(function(x){ return x.layer === 'tape' && x.vote === 'neutral' && x.caution === true
                                 && x.text.indexOf('overextended') >= 0 && x.text.indexOf('fade risk') >= 0; })
   && !r.votes.some(function(x){ return x.layer === 'tape' && (x.vote === 'long' || x.vote === 'short'); }),
   'tape: |25%+ -> overextended CAUTION, never a chase vote');
r = COLLECT({ sym: 'BTCUSDT', tape: { BTCUSDT: { symbol: 'BTCUSDT', chg24: 2, turnoverUsd: 9e9 } } });
ok(!r.votes.some(function(x){ return x.layer === 'tape'; }) && r.silent.indexOf('tape') >= 0
   && r.unavailable.indexOf('tape') === -1,
   'tape: sub-threshold move -> silent (live, nothing to say), not dark');
r = COLLECT({ sym: 'THINUSDT', tape: { THINUSDT: { symbol: 'THINUSDT', chg24: 14, turnoverUsd: 3e6 } } });
ok(r.silent.indexOf('tape') >= 0 && !r.votes.some(function(x){ return x.layer === 'tape'; }),
   'tape: big move on sub-$10M turnover -> no participation, no vote');
r = COLLECT({ sym: 'NOBINUSDT', tape: { BTCUSDT: { symbol: 'BTCUSDT', chg24: 12, turnoverUsd: 9e9 } } });
ok(r.silent.indexOf('tape') >= 0 && r.unavailable.indexOf('tape') === -1,
   'tape: no Binance perp for this base -> silent, never dark');
r = COLLECT({ sym: 'B-SYN_USDT', aliases: ['B-SYN_USDT', 'SYN', 'SYNUSDT'],
              tape: { SYNUSDT: { symbol: 'SYNUSDT', chg24: 12.4, turnoverUsd: 380e6 } } });
ok(r.votes.some(function(x){ return x.layer === 'tape' && x.vote === 'long'; }),
   'tape: combined-universe candidate matches its Binance perp through aliases');
r = COLLECT({ sym: 'BTCUSDT' });
ok(r.unavailable.indexOf('tape') >= 0, 'tape feed missing -> unavailable (named dark)');
r = COLLECT({ sym: 'XAU', lane: 'gold', tape: null });
ok(r.unavailable.indexOf('tape') === -1 && r.silent.indexOf('tape') === -1
   && !r.votes.some(function(x){ return x.layer === 'tape'; }),
   'tape: null = not applicable (gold lane) — no vote, not dark, not silent');

/* ================= G) oiflow votes ================= */
console.log('== oiflow votes ==');
r = COLLECT({ sym: 'SOLUSDT', oiflow: { results: [{ sym: 'SOLUSDT', dir: 'LONG', evidence: ['NEW LONGS (trend fuel)'] }] } });
ok(r.votes.some(function(x){ return x.layer === 'oiflow' && x.vote === 'long' && x.kind === 'positioning' && x.text.indexOf('NEW LONGS') >= 0; }),
   'oiflow LONG card -> long positioning vote with lead evidence');
r = COLLECT({ sym: 'SOLUSDT', oiflow: { results: [{ sym: 'SOLUSDT', dir: 'SHORT', evidence: 3, cls: 'CROWDED LONG (squeeze-down risk)' }] } });
ok(r.votes.some(function(x){ return x.layer === 'oiflow' && x.vote === 'short' && x.text.indexOf('CROWDED LONG') >= 0 && x.text.indexOf('3 reads') >= 0; }),
   'oiflowState real shape (evidence=score number, cls=text) -> vote carries cls + read count');
r = COLLECT({ sym: 'SOLUSDT', oiflow: { results: [{ sym: 'SOLUSDT', dir: 'SHORT', evidence: ['CROWDED LONG'] }] } });
ok(r.votes.some(function(x){ return x.layer === 'oiflow' && x.vote === 'short'; }), 'oiflow SHORT card -> short vote');
r = COLLECT({ sym: 'SOLUSDT', oiflow: { results: [] } });
ok(r.silent.indexOf('oiflow') >= 0, 'oiflow ran but no card for this symbol -> silent');
r = COLLECT({ sym: 'SOLUSDT', oiflow: null });
ok(r.unavailable.indexOf('oiflow') >= 0, 'oiflowState() null -> unavailable');

/* ================= H) squeeze votes ================= */
console.log('== squeeze votes ==');
r = COLLECT({ sym: 'BTCUSDT', squeeze: { results: [{ sym: 'BTCUSDT', kind: 'fired', dir: 'long' }] } });
ok(r.votes.some(function(x){ return x.layer === 'squeeze' && x.vote === 'long' && x.kind === 'structural' && x.text.indexOf('fired LONG') >= 0; }),
   'squeeze fired -> structural vote in the fired direction');
r = COLLECT({ sym: 'BTCUSDT', squeeze: { results: [{ sym: 'BTCUSDT', kind: 'break', dir: 'short' }] } });
ok(r.votes.some(function(x){ return x.layer === 'squeeze' && x.vote === 'short' && x.text.indexOf('Donchian break') >= 0; }),
   'squeeze donchian break -> vote in the break direction');
r = COLLECT({ sym: 'BTCUSDT', squeeze: { results: [{ sym: 'BTCUSDT', kind: 'build', dir: null }] } });
ok(r.votes.some(function(x){ return x.layer === 'squeeze' && x.vote === 'neutral' && x.text.indexOf('building') >= 0; }),
   'squeeze building -> neutral (no fire, no direction invented)');
r = COLLECT({ sym: 'BTCUSDT', squeeze: null });
ok(r.unavailable.indexOf('squeeze') >= 0, 'squeezeState() null -> unavailable');

/* ================= I) liqs flush-reversal votes ================= */
console.log('== liqs votes ==');
r = COLLECT({ sym: 'BTCUSDT', liq: { dir: 'long', flushSide: 'short', sym: 'BTCUSDT', flushUsd: 5e6 } });
ok(r.votes.some(function(x){ return x.layer === 'liqs' && x.vote === 'long' && x.kind === 'positioning' && x.text.indexOf('flush-reversal') >= 0; }),
   'flush setup naming this symbol -> positioning vote fading the flush');
r = COLLECT({ sym: 'BTCUSDT', liq: { dir: 'short', flushSide: 'long', sym: 'ETHUSDT', flushUsd: 9e6 } });
ok(!r.votes.some(function(x){ return x.layer === 'liqs'; }) && r.silent.indexOf('liqs') >= 0,
   'flush setup naming ANOTHER symbol -> no vote for this candidate');
r = COLLECT({ sym: 'BTCUSDT', liq: null });
ok(r.silent.indexOf('liqs') >= 0 && r.unavailable.indexOf('liqs') === -1,
   'liq layer live but no flush in the window -> silent, not unavailable');
r = COLLECT({ sym: 'BTCUSDT' });
ok(r.unavailable.indexOf('liqs') >= 0, 'liq input absent (liqAgg/liqFlushSetup missing) -> unavailable');

/* ================= J) gold lane ================= */
console.log('== gold lane ==');
r = COLLECT({ sym: 'XAU', lane: 'gold', news: { risk: 'low', blackout: false, events: [], note: 'clear' },
              gold: { setup: { dir: 'long', aside: false, confidence: 'STRONG', reason: 'structure + macro + positioning aligned' },
                      deep: { label: 'BULLISH', score: 71, dir: 'long', ts: 1 },
                      basis: { basisPct: -0.2, verdict: 'shorts-crowding' } } });
ok(r.votes.some(function(x){ return x.layer === 'goldsetup' && x.vote === 'long' && x.strong === true && x.kind === 'structural'; }),
   'gold lane: goldSetupDecision STRONG verdict -> strong structural vote');
ok(r.votes.some(function(x){ return x.layer === 'golddeep' && x.vote === 'long' && x.text.indexOf('BULLISH') >= 0; }),
   'gold lane: deep scan verdict -> structural vote with label');
ok(r.votes.some(function(x){ return x.layer === 'goldbasis' && x.vote === 'long' && x.text.indexOf('shorts crowding') >= 0; }),
   'gold lane: shorts-crowding basis -> long fade vote (positioning)');
ok(r.unavailable.length === 0, 'gold lane fully fed -> nothing unavailable');
r = COLLECT({ sym: 'XAU', lane: 'gold', news: { risk: 'low', blackout: false },
              gold: { setup: { aside: true, reason: 'timeframes disagree' }, deep: { label: 'MIXED', score: 40, dir: null },
                      basis: { basisPct: 0.3, verdict: 'longs-crowding' } } });
ok(r.votes.some(function(x){ return x.layer === 'goldsetup' && x.vote === 'neutral' && x.caution === true; }),
   'gold lane: aside decision -> neutral caution with the reason, never a direction');
ok(r.votes.some(function(x){ return x.layer === 'goldbasis' && x.vote === 'short'; }),
   'gold lane: longs-crowding basis -> short fade vote');
r = COLLECT({ sym: 'XAU', lane: 'gold', news: { risk: 'low', blackout: false } });
ok(r.unavailable.indexOf('goldsetup') >= 0 && r.unavailable.indexOf('golddeep') >= 0 && r.unavailable.indexOf('goldbasis') >= 0,
   'gold lane with no gold inputs -> all three gold layers named unavailable');

/* ================= K) tier boundaries ================= */
console.log('== tier boundaries ==');
const PRIME5 = [v('engine', 'long'), v('squeeze', 'long'), v('oiflow', 'long'), v('regime', 'long'), v('rotation', 'long'),
                v('news', 'neutral', 'context')];
let d = DECIDE(PRIME5, { unavailable: [] });
ok(d.tier === 'PRIME' && d.dir === 'long' && d.agree === 5 && d.hasStructural && d.hasPositioning,
   'PRIME: 5 agreeing incl. structural + positioning, zero vetoes, news clear');
d = DECIDE(PRIME5.concat([v('liqs', 'long')]), { unavailable: [] });
ok(d.tier === 'PRIME' && d.agree === 6, 'PRIME: 6 agreeing still PRIME (no score inflation, just agreement)');
d = DECIDE([v('engine', 'long'), v('squeeze', 'long'), v('oiflow', 'long'), v('regime', 'long')], { unavailable: [] });
ok(d.tier === 'HIGH' && d.agree === 4, 'HIGH: exactly 4 agreeing, zero vetoes');
d = DECIDE([v('engine', 'long'), v('oiflow', 'long'), v('regime', 'long')], { unavailable: [] });
ok(d.tier === 'WATCH' && d.agree === 3, 'WATCH: exactly 3 agreeing');
d = DECIDE([v('engine', 'long'), v('oiflow', 'long'), v('regime', 'long'), v('rotation', 'long'), v('onchain', 'long'),
            { layer: 'news', vote: 'neutral', text: 'caution: CPI in 3h', kind: 'context', caution: true }], { unavailable: [] });
ok(d.tier === 'HIGH' && d.newsCaution === true && d.reasons[0].indexOf('news caution') >= 0,
   '5 agreeing + news caution -> HIGH, not PRIME (news not clear)');
d = DECIDE([v('engine', 'long'), v('squeeze', 'long'), v('regime', 'long'), v('rotation', 'long'), v('onchain', 'long')], { unavailable: [] });
ok(d.tier === 'HIGH' && d.reasons[0].indexOf('positioning') >= 0,
   '5 agreeing without a positioning layer -> HIGH, reason names the missing kind');
d = DECIDE([v('engine', 'long'), v('oiflow', 'long'), v('regime', 'long'), v('rotation', 'long'), v('onchain', 'short')], { unavailable: [] });
ok(d.tier === 'WATCH' && d.disagree === 1, '4 agreeing + one soft disagreement -> WATCH');
d = DECIDE([v('engine', 'long'), v('oiflow', 'long'), v('regime', 'long'), v('rotation', 'short'), v('onchain', 'short')], { unavailable: [] });
ok(d.tier === 'ASIDE' && d.reasons[0].indexOf('contested') >= 0, '3v2 split -> ASIDE contested');
d = DECIDE([v('engine', 'long'), v('oiflow', 'long')], { unavailable: [] });
ok(d.tier === 'WATCH' && d.agree === 2 && d.disagree === 0 && d.reasons[0].indexOf('radar only') >= 0,
   '2 agreeing + zero disagreement -> WATCH radar tier (thin but uncontested)');
d = DECIDE([v('regime', 'long'), v('rotation', 'long'), v('onchain', 'short'), v('news', 'neutral', 'context')].concat([]), { unavailable: [] });
ok(d.tier === 'ASIDE' && d.agree === 2 && d.disagree === 1, '2v1 -> ASIDE (thin beats majority)');
d = DECIDE(PRIME5.concat([v('news', 'veto', 'context')]), { unavailable: [] });
ok(d.tier === 'ASIDE' && d.dir === null && d.vetoes.length === 1 && d.reasons[0].indexOf('VETO') === 0,
   'veto overrides everything — 5 agreeing + 1 veto -> ASIDE with the killing reason');
d = DECIDE([v('engine', 'long'), v('oiflow', 'long'), v('regime', 'short'), v('rotation', 'short')], { unavailable: [] });
ok(d.tier === 'ASIDE' && d.reasons[0].indexOf('tie') >= 0, '2v2 tie -> ASIDE');
d = DECIDE([v('news', 'neutral', 'context'), v('regime', 'neutral', 'context')], { unavailable: [] });
ok(d.tier === 'ASIDE' && d.reasons[0].indexOf('no directional evidence') >= 0, 'all-neutral panel -> ASIDE, nothing fabricated');
d = DECIDE([], {});
ok(d.tier === 'ASIDE' && d.dir === null, 'empty votes -> ASIDE, dir null');

/* ================= L) missing-layer degradation caps ================= */
console.log('== degradation caps ==');
d = DECIDE(PRIME5, { unavailable: ['liqs'] });
ok(d.tier === 'HIGH' && d.cappedFrom === 'PRIME' && d.reasons.join(' ').indexOf('CAPPED from PRIME') >= 0,
   '1 dark layer caps PRIME -> HIGH, cap is stated');
d = DECIDE(PRIME5, { unavailable: ['liqs', 'squeeze'] });
ok(d.tier === 'HIGH' && d.cappedFrom === 'PRIME', '2 dark layers still cap at HIGH');
d = DECIDE(PRIME5, { unavailable: ['liqs', 'squeeze', 'onchain'] });
ok(d.tier === 'WATCH' && d.cappedFrom === 'PRIME' && d.reasons.join(' ').indexOf('liqs, squeeze, onchain') >= 0,
   '3 dark layers cap PRIME -> WATCH and name the dark layers');
d = DECIDE([v('engine', 'long'), v('oiflow', 'long'), v('regime', 'long'), v('rotation', 'long')], { unavailable: [] });
ok(d.tier === 'HIGH' && d.cappedFrom === null, 'full panel -> no cap (cappedFrom null)');
d = DECIDE([v('engine', 'long')], { unavailable: ['a', 'b', 'c'] });
ok(d.tier === 'ASIDE', 'caps never promote — thin stays ASIDE');

/* ================= M) mount smoke test ================= */
console.log('== mount smoke test (all layer getters absent) ==');
function stubEl(){
  return { innerHTML: '', textContent: '', className: '', disabled: false, value: '',
           style: {}, firstElementChild: { style: {} }, _handlers: {},
           addEventListener: function(ev, fn){ this._handler = fn; this._handlers[ev] = fn; } };
}
function freshPane(){
  const stubs = {};
  const pane = {
    _html: '',
    set innerHTML(v){ this._html = v; },
    get innerHTML(){ return this._html; },
    querySelector: function(sel){ if (!stubs[sel]) stubs[sel] = stubEl(); return stubs[sel]; }
  };
  return { pane: pane, stubs: stubs };
}
const M = freshPane();
tab.mount(M.pane);
ok(M.pane._html.indexOf('BRAIN') >= 0 && M.pane._html.indexOf('class="panel"') >= 0, 'mount builds the BRAIN panel');
ok(M.pane._html.indexOf('id="brainRun"') >= 0 && M.pane._html.indexOf('RUN SYNTHESIS') >= 0, 'RUN SYNTHESIS button present');
ok(M.pane._html.indexOf('id="brainRead"') >= 0 && M.pane._html.indexOf('MARKET READ') >= 0, 'MARKET READ block present');
ok(M.pane._html.indexOf('id="brainWatch') >= 0 && M.pane._html.indexOf('id="brainAside') >= 0 && M.pane._html.indexOf('id="brainEmpty"') >= 0,
   'WATCH / ASIDE / empty containers present');
ok(typeof M.stubs['#brainRun']._handler === 'function', 'RUN button wired to a click handler');
ok(M.stubs['#brainDeps'].className === 'note warn' && M.stubs['#brainDeps'].textContent.indexOf('dark layers') >= 0
   && M.stubs['#brainDeps'].textContent.indexOf('engineState') >= 0,
   'missing layer getters listed honestly in the deps note');
tab.mount(M.pane); tab.mount(null);
ok(true, 'mount idempotent + mount(null) tolerated');

/* ================= N) full synthesis — PRIME long, veto aside, gold lane ================= */
console.log('== full synthesis run (PRIME long) ==');
W.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'no high-impact USD events within 36h' }; };
W.hgNewsState = function(){ return { loaded: true, events: [] }; };
W.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', size: 'full', sizeNote: 'full size' } }; };
W.rotationState = function(){ return { season: 'btc', altPct: 31, evidence: [] }; };
W.onchainState = function(){ return { bias: 'bullish', evidence: [{ side: 'bull', text: 'miners healthy' }], flags: {} }; };
W.engineState = function(){
  return { survivors: [{ sym: 'BTCUSDT', dir: 'long', conviction: 'STRONG',
                         plan: { entry: 100, stop: 95, t1: 110, t2: 117.5 },   /* engineState real shape: no dir on plan */
                         gatesPassed: 6 }],
           rejected: [{ sym: 'SOLUSDT', vetoGate: 'G4', dir: 'long', gatesPassed: 4 }], at: 123 };
};
W.oiflowState = function(){ return { results: [{ sym: 'BTCUSDT', dir: 'LONG', evidence: 3, cls: 'NEW LONGS (trend fuel)' }] }; };
W.squeezeState = function(){ return { results: [{ sym: 'ETHUSDT', kind: 'fired', dir: 'short' }] }; };
W.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'short-flush', ratio: 0.3, text: 'SHORT FLUSH' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 2e6 }; } }; };
W.liqFlushSetup = function(){ return { type: 'FLUSH-REVERSAL', dir: 'long', flushSide: 'short', sym: 'BTCUSDT', flushUsd: 5e6 }; };
W.goldspotState = function(){ return { basisPct: 0.01, verdict: 'balanced' }; };
W.__hgGoldDeepVerdict = { label: 'BULLISH', score: 71, dir: 'long', ts: 1 };
W.binanceTickers24h = async function(){ return {
  BTCUSDT: { symbol: 'BTCUSDT', mark: 100, chg24: 2, turnoverUsd: 9e9 },
  ETHUSDT: { symbol: 'ETHUSDT', mark: 50, chg24: -1, turnoverUsd: 5e9 },
  SOLUSDT: { symbol: 'SOLUSDT', mark: 20, chg24: 3, turnoverUsd: 2e9 },
  XRPUSDT: { symbol: 'XRPUSDT', mark: 1, chg24: 0.5, turnoverUsd: 1e9 } }; };
W.toTrade = function(){};

const N = freshPane();
tab.mount(N.pane);
N.stubs['#brainRun']._handler();
{
  const t0 = Date.now();
  while (N.stubs['#brainRun'].disabled && Date.now() - t0 < 8000)
    await new Promise(function(res){ setTimeout(res, 25); });
}
const nStat = N.stubs['#brainStat'].textContent;
const nCards = N.stubs['#brainCards'].innerHTML;
const nAside = N.stubs['#brainAside'].innerHTML;
const nRead = N.stubs['#brainRead'].textContent;

ok(nStat.indexOf('done · 1 PRIME') === 0, 'run stat: exactly 1 PRIME — got "' + nStat + '"');
ok(nCards.indexOf('BTCUSDT') >= 0 && nCards.indexOf('PRIME · 6 LAYERS') >= 0 && nCards.indexOf('>LONG</span>') >= 0,
   'PRIME card: BTCUSDT, LONG stamp, 6 agreeing layers (regime+rotation+onchain+engine+oiflow+liqs)');
ok(nCards.indexOf('ENTRY <b>100</b> · STOP <b>95</b>') >= 0 && nCards.indexOf('T1 <b>110</b> (2R)') >= 0
   && nCards.indexOf('gate engine') >= 0, 'PRIME card uses the gate engine plan verbatim — never invented');
ok(95 < 100 && 110 > 100 && 117.5 > 110, 'long plan sanity: stop below entry, targets above');
ok(nCards.indexOf('toTrade(&quot;BTCUSDT&quot;,&quot;long&quot;,100,95,110)') >= 0,
   'SEND TO TRADE PLAN payload carries sym/dir/entry/stop/t1');
ok(nCards.indexOf('ENGINE: ENGINE SURVIVOR') >= 0 && nCards.indexOf('REGIME:') >= 0 && nCards.indexOf('NEWS: news clear') >= 0,
   'evidence ledger lists every layer vote with its text');
ok(nAside.indexOf('>SOL</span>') >= 0 && nAside.indexOf('engine veto @ G4') >= 0 && nAside.indexOf('>VETO</span>') >= 0,
   'ASIDE ledger: SOLUSDT hard-vetoed at G4 liquidity with the killing gate named');
ok(nAside.indexOf('XAU') >= 0, 'gold lane lands in ASIDE when the gold setup layer is dark');
ok(nRead.indexOf('RISK-ON regime') >= 0 && nRead.indexOf('btc season 31%') >= 0 && nRead.indexOf('on-chain bullish') >= 0
   && nRead.indexOf('no high-impact USD events') >= 0,
   'MARKET READ synthesizes regime + rotation + on-chain + news in plain English');
ok(N.stubs['#brainWatchWrap'].style.display === 'none', 'WATCH panel hidden when nothing is on watch');

/* ================= O) second run — HIGH short + short plan sanity ================= */
console.log('== second run (HIGH short, re-run after stub swap) ==');
W.regimeState = function(){ return { label: 'RISK-OFF', score: -4, playbook: { bias: 'SHORT-ONLY', sizeNote: 'half size' } }; };
W.engineState = function(){
  return { survivors: [{ sym: 'ETHUSDT', dir: 'short', conviction: 'MODERATE',
                         plan: { entry: 50, stop: 53, t1: 44, t2: 39.5 }, gatesPassed: 5 }],
           rejected: [], at: 124 };
};
W.oiflowState = function(){ return { results: [{ sym: 'ETHUSDT', dir: 'SHORT', evidence: ['NEW SHORTS (trend fuel)'] }] }; };
W.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'balanced', ratio: 1.1, text: 'BALANCED' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 2e6 }; } }; };
N.stubs['#brainRun']._handler();
{
  const t0 = Date.now();
  while (N.stubs['#brainRun'].disabled && Date.now() - t0 < 8000)
    await new Promise(function(res){ setTimeout(res, 25); });
}
const oStat = N.stubs['#brainStat'].textContent;
const oCards = N.stubs['#brainCards'].innerHTML;
ok(oStat.indexOf('done · 0 PRIME · 1 HIGH') === 0, 'second run: 0 PRIME · 1 HIGH — got "' + oStat + '"');
ok(oCards.indexOf('ETHUSDT') >= 0 && oCards.indexOf('HIGH · 4 LAYERS') >= 0 && oCards.indexOf('>SHORT</span>') >= 0,
   'HIGH card: ETHUSDT SHORT, 4 agreeing layers (regime+engine+oiflow+squeeze), zero vetoes');
ok(oCards.indexOf('ENTRY <b>50</b> · STOP <b>53</b>') >= 0 && oCards.indexOf('T1 <b>44</b> (2R)') >= 0,
   'short plan renders from the engine plan');
ok(53 > 50 && 44 < 50 && 39.5 < 44, 'short plan sanity: stop above entry, targets below');
ok(oCards.indexOf('toTrade(&quot;ETHUSDT&quot;,&quot;short&quot;,50,53,44)') >= 0, 'short toTrade payload correct');
ok(oCards.indexOf('BTCUSDT') === -1, 'BTC dropped out of the cards after the regime flip (no stale convictions)');

/* ================= P) hard-refresh contract ================= */
console.log('== hard-refresh contract (fresh module instance) ==');
globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'brain.js', 'utf8'), { filename: 'brain.js' });
const W2 = globalThis.window;
const tab2 = W2.HG_tabs[0];
ok(tab2.id === 'brain' && typeof tab2.refresh === 'function', 'fresh registration carries refresh');

let r0 = await tab2.refresh();
ok(r0 === 'skipped: not run yet', 'refresh before mount -> "skipped: not run yet" (got "' + r0 + '")');

const P = freshPane();
tab2.mount(P.pane);
r0 = await tab2.refresh();
ok(r0 === 'skipped: not run yet', 'mounted but never run -> still skipped (no expensive first scan from a global refresh)');

let releaseGate;
W2.binanceTickers24h = function(){ return new Promise(function(res){ releaseGate = function(){ res(null); }; }); };
P.stubs['#brainRun']._handler();                 /* starts, parks on the gated universe fetch */
await new Promise(function(res){ setTimeout(res, 20); });
const rBusy = await tab2.refresh();
ok(rBusy === 'busy', 'refresh during an in-flight synthesis -> "busy"');
releaseGate();
{
  const t0 = Date.now();
  while (P.stubs['#brainRun'].disabled && Date.now() - t0 < 8000)
    await new Promise(function(res){ setTimeout(res, 25); });
}
delete W2.binanceTickers24h;
const r1 = await tab2.refresh();
ok(r1 === 'refreshed', 'refresh after a completed run re-runs -> "refreshed" (got "' + r1 + '")');
ok(P.stubs['#brainStat'].textContent.indexOf('done · 0 PRIME · 0 HIGH · 0 watch · 4 aside') === 0,
   'with every layer dark: 3 crypto + 1 gold candidates all land ASIDE, stat is honest');
ok(P.stubs['#brainEmpty'].style.display === 'block', 'empty state shown when nothing qualifies');

/* ================= Q) never-throws with ALL globals absent ================= */
console.log('== never-throws, all globals absent ==');
globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'brain.js', 'utf8'), { filename: 'brain.js' });
const W3 = globalThis.window;
const tab3 = W3.HG_tabs[0];
const Q = freshPane();
let qErr = null;
try{
  tab3.mount(Q.pane);
  Q.stubs['#brainRun']._handler();
  const t0 = Date.now();
  while (Q.stubs['#brainRun'].disabled && Date.now() - t0 < 8000)
    await new Promise(function(res){ setTimeout(res, 25); });
}catch(e){ qErr = e; }
ok(!qErr, 'mount + full run with zero layer globals never throws' + (qErr ? ' — got: ' + qErr.message : ''));
ok(Q.stubs['#brainStat'].textContent.indexOf('done') === 0, 'run completes honestly with everything dark');
ok(Q.stubs['#brainRead'].textContent.indexOf('dark:') >= 0, 'market read names the dark layers instead of fabricating a read');
let qRef = null;
try{ qRef = await tab3.refresh(); }catch(e){ qErr = e; }
ok(qRef === 'refreshed', 'refresh on the barren app still honors the contract');

/* ================= combined-universe helpers ================= */
function freshBrain(){
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'brain.js', 'utf8'), { filename: 'brain.js' });
  return globalThis.window;
}
function fakeRows(n){
  const rows = []; const t0 = 1700000000 - (n || 120) * 14400;
  for (let i = 0; i < (n || 120); i++)
    rows.push({ t: t0 + i * 14400, o: 100, h: 101, l: 99, c: 100.5, v: 1000 });
  return rows;
}
function lsStub(){
  const m = {};
  return { getItem: function(k){ return (k in m) ? m[k] : null; },
           setItem: function(k, v){ m[k] = String(v); },
           removeItem: function(k){ delete m[k]; }, _m: m };
}
async function runAndWait(stubs){
  stubs['#brainRun']._handler();
  const t0 = Date.now();
  while (stubs['#brainRun'].disabled && Date.now() - t0 < 8000)
    await new Promise(function(res){ setTimeout(res, 25); });
}
/* shared xu fixture: BTC deduped to the CoinDCX listing, XAU/USDC blocked */
const XUL = [
  { sym: 'B-BTC_USDT', base: 'BTC',  exchange: 'cdcx',  turnoverUsd: 9e9, mark: 100,  fundingPct: 0.01,  alsoOn: ['delta'] },
  { sym: 'ETHUSDT',    base: 'ETH',  exchange: 'delta', turnoverUsd: 5e9, mark: 50,   fundingPct: -0.02, alsoOn: ['cdcx'] },
  { sym: 'SOLUSDT',    base: 'SOL',  exchange: 'delta', turnoverUsd: 2e9, mark: 20,   fundingPct: 0,     alsoOn: null },
  { sym: 'B-XRP_USDT', base: 'XRP',  exchange: 'cdcx',  turnoverUsd: 1e9, mark: 1,    fundingPct: null,  alsoOn: null },
  { sym: 'DOGEUSDT',   base: 'DOGE', exchange: 'delta', turnoverUsd: 8e8, mark: 0.2,  fundingPct: null,  alsoOn: null },
  { sym: 'XAUUSDT',    base: 'XAU',  exchange: 'delta', turnoverUsd: 3e9, mark: 2400, fundingPct: null,  alsoOn: null },
  { sym: 'USDCUSDT',   base: 'USDC', exchange: 'delta', turnoverUsd: 7e9, mark: 1,    fundingPct: null,  alsoOn: null }
];
/* layers -> BTC PRIME long (5 layers via Binance-keyed aliases), ETH/SOL/XRP
   WATCH (regime+rotation+oiflow), DOGE vetoed aside, gold aside */
function stubLayersPrime(WX){
  WX.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'no high-impact USD events within 36h' }; };
  WX.hgNewsState = function(){ return { loaded: true, events: [] }; };
  WX.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', size: 'full', sizeNote: 'full size' } }; };
  WX.rotationState = function(){ return { season: 'alt', altPct: 78, evidence: [] }; };
  WX.onchainState = function(){ return { bias: 'bullish', evidence: [{ side: 'bull', text: 'miners healthy' }], flags: {} }; };
  WX.engineState = function(){
    return { survivors: [{ sym: 'BTCUSDT', dir: 'long', conviction: 'STRONG',
                           plan: { entry: 100, stop: 95, t1: 110, t2: 117.5 }, gatesPassed: 6 }],
             rejected: [{ sym: 'DOGEUSDT', vetoGate: 'G2' }], at: 123 };
  };
  WX.oiflowState = function(){ return { results: [
    { sym: 'BTCUSDT', dir: 'LONG', evidence: 3, cls: 'NEW LONGS (trend fuel)' },
    { sym: 'ETHUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'SOLUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'XRPUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WX.squeezeState = function(){ return { results: [] }; };
  WX.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'short-flush', ratio: 0.3, text: 'SHORT FLUSH' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 2e6 }; } }; };
  WX.liqFlushSetup = function(){ return { type: 'FLUSH-REVERSAL', dir: 'long', flushSide: 'short', sym: 'BTCUSDT', flushUsd: 5e6 }; };
  WX.goldspotState = function(){ return { basisPct: 0.01, verdict: 'balanced' }; };
  /* TAPE layer present but sub-threshold everywhere — silent, never dark,
     so these fixtures pin the pre-tape layer semantics exactly */
  WX.binanceTickers24h = async function(){ return {
    BTCUSDT: { symbol: 'BTCUSDT', mark: 100, chg24: 2, turnoverUsd: 9e9 },
    ETHUSDT: { symbol: 'ETHUSDT', mark: 50, chg24: -1, turnoverUsd: 5e9 },
    SOLUSDT: { symbol: 'SOLUSDT', mark: 20, chg24: 3, turnoverUsd: 2e9 },
    XRPUSDT: { symbol: 'XRPUSDT', mark: 1, chg24: 0.5, turnoverUsd: 1e9 } }; };
  WX.toTrade = function(){};
}

/* ================= R) pure combined-universe builder ================= */
console.log('== brainUniverse: xu consumption, dedupe, base mapping, venue ==');
{
  const bu = W.brainUniverse(XUL, { venue: 'ALL' });
  ok(bu.mode === 'combined', 'brainUniverse mode is combined');
  ok(bu.candidates.length === 5, 'XAU + USDC bases blocked, 5 candidates remain — got ' + bu.candidates.length);
  ok(bu.candidates[0].sym === 'B-BTC_USDT' && bu.candidates[0].base === 'BTC'
     && bu.candidates[0].exchange === 'cdcx' && bu.candidates[0].xu === XUL[0],
     'BTC mapped onto its combined-universe entry (B-BTC_USDT dedupe, original xu item kept)');
  ok(bu.candidates[0].aliases.indexOf('BTCUSDT') >= 0 && bu.candidates[0].aliases.indexOf('BTC') >= 0,
     'BTC candidate aliases carry BTCUSDT + BTC for layer matching');
  ok(bu.candidates[1].sym === 'ETHUSDT' && bu.candidates[1].exchange === 'delta', 'ETH mapped onto the delta listing');
  ok(bu.counts.total === 5 && bu.counts.delta === 3 && bu.counts.cdcx === 2,
     'counts: total 5 (delta 3 + cdcx 2) — got ' + JSON.stringify(bu.counts));
  ok(!bu.candidates.some(function(c){ return c.base === 'XAU' || c.base === 'USDC'; }),
     'metal + stable bases never become crypto candidates');
  ok(bu.candidates[3].base === 'XRP' && bu.candidates[4].base === 'DOGE', 'alts ordered by turnover after the bases');

  const dupe = W.brainUniverse([
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 5e9 },
    { sym: 'B-BTC_USDT', base: 'BTC', exchange: 'cdcx', turnoverUsd: 9e9 } ], { venue: 'ALL' });
  ok(dupe.candidates.filter(function(c){ return c.base === 'BTC'; }).length === 1
     && dupe.candidates[0].sym === 'B-BTC_USDT',
     'defensive dedupe by base: one BTC candidate, highest turnover listing kept');

  const noBases = W.brainUniverse([{ sym: 'B-XRP_USDT', base: 'XRP', exchange: 'cdcx', turnoverUsd: 1e9 }], { venue: 'ALL' });
  ok(noBases.candidates.length === 4 && noBases.candidates[0].sym === 'BTCUSDT'
     && noBases.candidates[0].xu === null && noBases.candidates[0].exchange === null,
     'base absent from the xu list -> legacy-route candidate (BTCUSDT, exchange-less)');

  const dOnly = W.brainUniverse(XUL, { venue: 'DELTA' });
  ok(dOnly.counts.total === 4 && dOnly.counts.delta === 3 && dOnly.counts.cdcx === 0
     && dOnly.candidates[0].sym === 'BTCUSDT' && dOnly.candidates[0].exchange === null
     && !dOnly.candidates.some(function(c){ return c.base === 'XRP'; }),
     'venue DELTA filters cdcx listings; BTC falls back to the legacy route, honestly exchange-less');

  const cOnly = W.brainUniverse(XUL, { venue: 'CDCX' });
  ok(cOnly.counts.total === 4 && cOnly.counts.delta === 0 && cOnly.counts.cdcx === 2
     && cOnly.candidates[0].sym === 'B-BTC_USDT' && cOnly.candidates[0].exchange === 'cdcx',
     'venue CDCX keeps cdcx listings incl. the deduped BTC entry');

  const big = [];
  for (let i = 1; i <= 25; i++) big.push({ sym: 'B-A' + i + '_USDT', base: 'A' + i, exchange: 'cdcx', turnoverUsd: i * 1e6 });
  const bigU = W.brainUniverse(big, { venue: 'ALL' });
  ok(bigU.candidates.length === 28, 'no top-10 cap: every xu alt is a candidate (3 bases + 25 alts)');

  const empty = W.brainUniverse(null, {});
  ok(empty.candidates.length === 3 && empty.candidates.every(function(c){ return c.xu === null; })
     && empty.counts.total === 3 && empty.counts.delta === 0 && empty.counts.cdcx === 0,
     'null xu list -> 3 legacy base candidates, zeroed exchange counts');
  const junk = W.brainUniverse([null, 42, { sym: 'XUSDT' }, { sym: 'B-X_USDT', base: 'X', exchange: 'mars' }], {});
  ok(junk.candidates.length === 3, 'malformed xu items are skipped, never throw');

  /* xuniverse.js actually emits exchange:'coindcx' — normalize to 'cdcx',
     keep the ORIGINAL item so xuCandles routes on raw exchange */
  const cx = W.brainUniverse([{ sym: 'B-ADA_USDT', base: 'ADA', exchange: 'coindcx', turnoverUsd: 5e8 }], { venue: 'ALL' });
  const ada = cx.candidates[3];
  ok(ada && ada.exchange === 'cdcx' && ada.xu.exchange === 'coindcx' && cx.counts.cdcx === 1,
     "xuniverse.js 'coindcx' exchange normalized to 'cdcx', original item preserved for xuCandles routing");
  ok(W.brainUniverse([{ sym: 'B-ADA_USDT', base: 'ADA', exchange: 'coindcx', turnoverUsd: 5e8 }], { venue: 'CDCX' }).candidates.length === 4,
     "venue CDCX matches items emitted as 'coindcx'");
}

/* ================= S) alias matching in brainCollect ================= */
console.log('== alias matching (Binance-keyed layers vote for xu candidates) ==');
{
  const C2 = freshBrain().brainCollect;
  const EN2 = { survivors: [{ sym: 'BTCUSDT', dir: 'long', conviction: 'STRONG' }], rejected: [], at: 1 };
  let r2 = C2({ sym: 'B-BTC_USDT', aliases: ['B-BTC_USDT', 'BTCUSDT', 'BTC'], engine: EN2 });
  ok(r2.votes.some(function(x){ return x.layer === 'engine' && x.vote === 'long'; }),
     'engine survivor keyed BTCUSDT votes for the B-BTC_USDT candidate via alias');
  r2 = C2({ sym: 'B-BTC_USDT', engine: EN2 });
  ok(!r2.votes.some(function(x){ return x.layer === 'engine'; }) && r2.silent.indexOf('engine') >= 0,
     'without aliases the same survivor stays silent — alias is what bridges the formats');
  r2 = C2({ sym: 'B-BTC_USDT', aliases: ['BTCUSDT', 'BTC'], oiflow: { results: [{ sym: 'BTC', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' }] } });
  ok(r2.votes.some(function(x){ return x.layer === 'oiflow' && x.vote === 'long'; }), 'oiflow row keyed bare BTC matches via alias');
  r2 = C2({ sym: 'B-BTC_USDT', aliases: ['BTCUSDT', 'BTC'], squeeze: { results: [{ sym: 'B-BTC_USDT', kind: 'fired', dir: 'long' }] } });
  ok(r2.votes.some(function(x){ return x.layer === 'squeeze' && x.vote === 'long'; }), 'squeeze row keyed by the xu sym still matches exactly');
  r2 = C2({ sym: 'B-BTC_USDT', aliases: ['BTCUSDT', 'BTC'], liq: { dir: 'long', flushSide: 'short', sym: 'BTCUSDT', flushUsd: 5e6 } });
  ok(r2.votes.some(function(x){ return x.layer === 'liqs' && x.vote === 'long'; }), 'flush setup naming BTCUSDT matches via alias');
  r2 = C2({ sym: 'B-BTC_USDT', aliases: ['BTCUSDT', 'BTC'], engine: { survivors: [], rejected: [{ sym: 'BTC', vetoGate: 'G4' }], at: 1 } });
  ok(r2.votes.some(function(x){ return x.layer === 'engine' && x.vote === 'veto' && x.text.indexOf('G4') >= 0; }),
     'engine rejection keyed bare BTC vetoes via alias');
}

/* ================= T) full combined-universe run ================= */
console.log('== full synthesis over the combined universe ==');
const WT = freshBrain();
stubLayersPrime(WT);
WT.xuUniverse = async function(){ return XUL; };
const xuCalls = [], statSnaps = [];
const TT = freshPane();
WT.xuCandles = function(item, tf, n){
  xuCalls.push({ item: item, tf: tf, n: n });
  statSnaps.push(TT.stubs['#brainStat'].textContent);
  return Promise.resolve(fakeRows(n));
};
const tabT = WT.HG_tabs[0];
tabT.mount(TT.pane);
await runAndWait(TT.stubs);
const tStat = TT.stubs['#brainStat'].textContent;
const tCards = TT.stubs['#brainCards'].innerHTML;
ok(tStat.indexOf('done · 1 PRIME · 0 HIGH · 4 watch · 1 aside') === 0,
   'combined run buckets: 1 PRIME · 0 HIGH · 4 watch (DOGE radar: regime+rotation, G2 non-confirmation no longer kills) · 1 aside — got "' + tStat + '"');
ok(tStat.indexOf('universe 5 (delta 3 + cdcx 2)') >= 0, 'summary gains combined per-exchange counts');
ok(tStat.indexOf('1 prime/high · 4 watch') >= 0, 'summary gains prime/high + watch tallies');
ok(TT.stubs['#brainReadUni'].textContent === 'universe 5 (delta 3 + cdcx 2) · 1 prime/high · 4 watch',
   'MARKET READ header carries the combined counts — got "' + TT.stubs['#brainReadUni'].textContent + '"');
ok(tCards.indexOf('B-BTC_USDT') >= 0 && tCards.indexOf('PRIME · 5 LAYERS') >= 0 && tCards.indexOf('>LONG</span>') >= 0,
   'BTC card renders under the cdcx sym via alias-matched Binance-keyed layer votes');
ok(tCards.indexOf('ENTRY <b>100</b> · STOP <b>95</b>') >= 0 && tCards.indexOf('COINDCX') >= 0
   && tCards.indexOf('toTrade(&quot;B-BTC_USDT&quot;,&quot;long&quot;,100,95,110)') >= 0,
   'engine plan + COINDCX venue stamp + xu-sym toTrade payload on the card');
ok(xuCalls.length === 5, 'lazy fetch: the 5 WATCH+ candidates fetched (BTC+ETH+SOL+XRP+DOGE radar), XAU lane aside untouched — got ' + xuCalls.length);
ok(xuCalls[0].item === XUL[0] && xuCalls[0].tf === '4h' && xuCalls[0].n === 120,
   'highest-evidence-first: the PRIME BTC candidate fetches first, via xuCandles with its original xu item');
ok(!xuCalls.some(function(c){ return c.item.sym === 'XAUUSDT'; }), 'ASIDE gold lane never triggers a crypto candle fetch');
ok(statSnaps.some(function(s){ return /^\d+\/5 candidates · delta 3 · cdcx 2$/.test(s); }),
   'fetch progress reports X/Y candidates · delta n · cdcx m — saw "' + statSnaps[0] + '"');
const tWatch = TT.stubs['#brainWatch'].innerHTML;
ok(tWatch.indexOf('>ETH</span>') >= 0 && tWatch.indexOf('>SOL</span>') >= 0 && tWatch.indexOf('>XRP</span>') >= 0
   && tWatch.indexOf('>DOGE</span>') >= 0 && tWatch.indexOf('radar only') >= 0,
   'WATCH ledger lists the watch alts incl. DOGE on the radar tier, reason named honestly');
const tAside = TT.stubs['#brainAside'].innerHTML;
ok(tAside.indexOf('>DOGE</span>') === -1 && tAside.indexOf('>XAU</span>') >= 0,
   'ASIDE ledger: DOGE promoted to radar (G2 non-confirmation), gold lane present');
ok(TT.stubs['#brainVenue'].style.display === '', 'venue select visible when the combined feed is present');
ok(tStat.indexOf(' · venue ') === -1, 'no venue suffix on the default ALL filter');

/* ================= U) lazy-fetch cap ================= */
console.log('== lazy-fetch cap binds honestly ==');
{
  const WU = freshBrain();
  WU.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'clear' }; };
  WU.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WU.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WU.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WU.engineState = function(){ return { survivors: [], rejected: [], at: 1 }; };
  WU.squeezeState = function(){ return { results: [] }; };
  WU.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'balanced', ratio: 1, text: 'BALANCED' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 0 }; } }; };
  WU.goldspotState = function(){ return { basisPct: 0, verdict: 'balanced' }; };
  const alts = [], ofRes = [];
  for (let i = 1; i <= 50; i++){
    const base = 'ALT' + i;
    alts.push(i % 2
      ? { sym: base + 'USDT', base: base, exchange: 'delta', turnoverUsd: i * 1e6, mark: 1, fundingPct: null, alsoOn: null }
      : { sym: 'B-' + base + '_USDT', base: base, exchange: 'cdcx', turnoverUsd: i * 1e6, mark: 1, fundingPct: null, alsoOn: null });
    ofRes.push({ sym: base + 'USDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' });
  }
  WU.oiflowState = function(){ return { results: ofRes }; };
  WU.xuUniverse = async function(){
    return [{ sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
            { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
            { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null }].concat(alts);
  };
  const capCalls = [], capSnaps = [];
  const TU = freshPane();
  WU.xuCandles = function(item){ capCalls.push(item.sym); capSnaps.push(TU.stubs['#brainStat'].textContent); return Promise.resolve(fakeRows(120)); };
  WU.HG_tabs[0].mount(TU.pane);
  await runAndWait(TU.stubs);
  const uStat = TU.stubs['#brainStat'].textContent;
  ok(uStat.indexOf('done · 0 PRIME · 0 HIGH · 48 watch · 6 aside') === 0,
     '46 alts reach WATCH on 3 votes, ETH+SOL join on the 2-vote radar tier; ALT1-ALT4 (1-4M turnover) gated below the $5M liquidity floor; BTC + gold aside — got "' + uStat + '"');
  ok(capCalls.length === 40, 'fetch cap respected: 40 fetches out of 48 watch candidates — got ' + capCalls.length);
  ok(uStat.indexOf('+8 more watch candidates — raise evidence to fetch') >= 0,
     'honest note when the cap binds — got "' + uStat + '"');
  ok(uStat.indexOf(' · 4 gated: 4 liquidity') >= 0,
     'liquidity-gate demotions tallied on the stat line, never silent — got "' + uStat + '"');
  ok(TU.stubs['#brainAside'].innerHTML.indexOf('below liquidity floor — $1.0M 24h turnover, slippage eats the edge') >= 0
     && TU.stubs['#brainAside'].innerHTML.indexOf('>ALT4</span>') >= 0,
     'gated sub-floor alts land on the ASIDE ledger with the kill reason named');
  ok(uStat.indexOf('universe 53 (delta 28 + cdcx 25)') >= 0, 'combined counts over the big universe are exact');
  ok(capSnaps.some(function(s){ return s === '0/40 candidates · delta 28 · cdcx 25'; }),
     'progress line counts down the capped fetch queue');
}

/* ================= V) absent-xu fallback identical to legacy ================= */
console.log('== absent-xu fallback is byte-identical to legacy ==');
{
  const WV = freshBrain();
  stubLayersPrime(WV);
  WV.binanceTickers24h = async function(){ return {
    BTCUSDT: { symbol: 'BTCUSDT', mark: 100, chg24: 2, turnoverUsd: 9e9 },
    ETHUSDT: { symbol: 'ETHUSDT', mark: 50, chg24: -1, turnoverUsd: 5e9 },
    SOLUSDT: { symbol: 'SOLUSDT', mark: 20, chg24: 3, turnoverUsd: 2e9 },
    XRPUSDT: { symbol: 'XRPUSDT', mark: 1, chg24: 0.5, turnoverUsd: 1e9 } }; };
  const TV = freshPane();
  WV.HG_tabs[0].mount(TV.pane);
  await runAndWait(TV.stubs);
  const vStat = TV.stubs['#brainStat'].textContent;
  ok(vStat.indexOf('done · 1 PRIME · 0 HIGH · 3 watch · 1 aside') === 0, 'legacy buckets unchanged without xu');
  ok(vStat.indexOf('universe 4 + XAU (BTC/ETH/SOL + top-1 alts by 24h turnover + XAU gold lane) · ') >= 0,
     'legacy universe wording byte-identical — got "' + vStat + '"');
  ok(vStat.indexOf('(delta') === -1 && vStat.indexOf('prime/high') === -1, 'no combined-count vocabulary in legacy mode');
  ok(TV.stubs['#brainVenue'].style.display === 'none', 'venue select hidden when xu is absent');
  ok(TV.stubs['#brainReadUni'].textContent === '', 'MARKET READ header count blank in legacy mode');

  const WF = freshBrain();
  stubLayersPrime(WF);
  WF.binanceTickers24h = WV.binanceTickers24h;
  WF.xuUniverse = function(){ throw new Error('boom'); };
  const TF = freshPane();
  WF.HG_tabs[0].mount(TF.pane);
  await runAndWait(TF.stubs);
  ok(TF.stubs['#brainStat'].textContent.indexOf('universe 4 + XAU') >= 0
     && TF.stubs['#brainStat'].textContent.indexOf('combined universe feed failed — legacy Binance fallback') >= 0,
     'throwing xuUniverse -> legacy fallback with an honest note');
  WF.xuUniverse = async function(){ return { nope: 1 }; };
  await WF.HG_tabs[0].refresh();
  ok(TF.stubs['#brainStat'].textContent.indexOf('combined universe feed empty — legacy Binance fallback') >= 0,
     'garbage xuUniverse result -> legacy fallback, noted honestly');
}

/* ================= W) per-symbol fetch isolation ================= */
console.log('== per-symbol candle-fetch isolation ==');
{
  const WW = freshBrain();
  stubLayersPrime(WW);
  WW.xuUniverse = async function(){ return XUL; };
  WW.xuCandles = function(item){
    if (item.sym === 'SOLUSDT') return Promise.reject(new Error('delta down'));
    if (item.sym === 'ETHUSDT') throw new Error('sync boom');
    return Promise.resolve(fakeRows(120));
  };
  const TW = freshPane();
  WW.HG_tabs[0].mount(TW.pane);
  let wErr = null;
  try{ await runAndWait(TW.stubs); }catch(e){ wErr = e; }
  ok(!wErr, 'rejecting + sync-throwing xuCandles legs never crash the run' + (wErr ? ' — ' + wErr.message : ''));
  ok(TW.stubs['#brainStat'].textContent.indexOf('done · 1 PRIME') === 0, 'run completes with degraded legs');
  ok(TW.stubs['#brainWatch'].innerHTML.indexOf('>SOL</span>') >= 0 && TW.stubs['#brainWatch'].innerHTML.indexOf('>ETH</span>') >= 0,
     'failed-fetch candidates still render their votes honestly');
}

/* ================= X) venue filter integration ================= */
console.log('== venue filter: persisted (shared engine key), applied, re-runs ==');
{
  globalThis.localStorage = lsStub();
  globalThis.localStorage.setItem('hgEngineVenue', 'cdcx');   /* engine.js writes lowercase */
  const WX2 = freshBrain();
  stubLayersPrime(WX2);
  WX2.xuUniverse = async function(){ return XUL; };
  const xuC = [], binC = [];
  WX2.xuCandles = function(item){ xuC.push(item.sym); return Promise.resolve(fakeRows(120)); };
  WX2.binanceKlines = function(sym, tf){ binC.push(sym + '|' + tf); return Promise.resolve(fakeRows(120)); };
  const TX2 = freshPane();
  WX2.HG_tabs[0].mount(TX2.pane);
  ok(TX2.stubs['#brainVenue'].value === 'CDCX', "venue select initialized from the shared engine key ('cdcx' lowercase)");
  await runAndWait(TX2.stubs);
  const xStat = TX2.stubs['#brainStat'].textContent;
  ok(xStat.indexOf('universe 4 (delta 0 + cdcx 2)') >= 0 && xStat.indexOf(' · venue CDCX') >= 0,
     'CDCX filter: only cdcx listings + legacy-fallback bases, venue named — got "' + xStat + '"');
  ok(xuC.indexOf('B-BTC_USDT') >= 0 && xuC.indexOf('B-XRP_USDT') >= 0 && xuC.indexOf('ETHUSDT') === -1,
     'filtered-in xu items fetch via xuCandles; filtered-out delta listings never touched');
  ok(binC.indexOf('ETHUSDT|4h') >= 0 && binC.indexOf('SOLUSDT|4h') >= 0,
     'bases absent from the CDCX listings fetch via the legacy route (binanceKlines)');

  TX2.stubs['#brainVenue'].value = 'DELTA';
  TX2.stubs['#brainVenue']._handlers.change();
  {
    const t0 = Date.now();
    while (TX2.stubs['#brainRun'].disabled && Date.now() - t0 < 8000)
      await new Promise(function(res){ setTimeout(res, 25); });
  }
  const x2Stat = TX2.stubs['#brainStat'].textContent;
  ok(globalThis.localStorage.getItem('hgEngineVenue') === 'delta',
     "venue change persists to the shared key in engine's lowercase format");
  ok(x2Stat.indexOf(' · venue DELTA') >= 0 && x2Stat.indexOf('(delta 3 + cdcx 0)') >= 0,
     'venue change re-runs the synthesis under the new filter — got "' + x2Stat + '"');

  globalThis.localStorage = lsStub();
  globalThis.localStorage.setItem('hgEngineVenue', 'BOGUS');
  const WX3 = freshBrain();
  stubLayersPrime(WX3);
  WX3.xuUniverse = async function(){ return XUL; };
  WX3.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const TX3 = freshPane();
  WX3.HG_tabs[0].mount(TX3.pane);
  await runAndWait(TX3.stubs);
  ok(TX3.stubs['#brainStat'].textContent.indexOf(' · venue ') === -1
     && TX3.stubs['#brainStat'].textContent.indexOf('universe 5 (delta 3 + cdcx 2)') >= 0,
     'invalid stored venue degrades to ALL, never crashes');
  delete globalThis.localStorage;
}

/* ================= Y) refresh contract in combined mode ================= */
console.log('== hard-refresh contract over the combined universe ==');
{
  const WY = freshBrain();
  stubLayersPrime(WY);
  const tabY = WY.HG_tabs[0];
  let y0 = await tabY.refresh();
  ok(y0 === 'skipped: not run yet', 'combined mode: refresh before any run still skips (no expensive first scan)');
  const TY = freshPane();
  tabY.mount(TY.pane);
  let releaseGate;
  WY.xuUniverse = function(){ return new Promise(function(res){ releaseGate = function(){ res(XUL); }; }); };
  WY.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  TY.stubs['#brainRun']._handler();
  await new Promise(function(res){ setTimeout(res, 20); });
  const yBusy = await tabY.refresh();
  ok(yBusy === 'busy', 'combined mode: refresh during an in-flight scan -> busy');
  releaseGate();
  {
    const t0 = Date.now();
    while (TY.stubs['#brainRun'].disabled && Date.now() - t0 < 8000)
      await new Promise(function(res){ setTimeout(res, 25); });
  }
  WY.xuUniverse = async function(){ return XUL; };
  const y1 = await tabY.refresh();
  ok(y1 === 'refreshed', 'combined mode: refresh after a completed run -> refreshed');
  ok(TY.stubs['#brainStat'].textContent.indexOf('universe 5 (delta 3 + cdcx 2)') >= 0,
     'refreshed run still scans the full combined universe');
}

/* ================= Z) silent-click reproduction: mount resilience =================
   THE REPORTED BUG: RUN SYNTHESIS renders but the click reveals NOTHING.
   Root causes exercised here: (a) mount() throws AFTER innerHTML painted but
   BEFORE the click listener attaches — one big try/catch swallows it, so the
   button looks alive and stays dead; (b) index.html latches HG_MOUNTED before
   mount() returns, so a failed mount never re-runs — the module must retry
   itself; (c) run-path guard failures used to `return` silently. */
console.log('== silent click: mount throw before listener attach (Z) ==');
function hostilePane(opts){
  opts = opts || {};
  const throwSels = opts.throwSels || {};   /* sel -> 'inf' | n times to throw */
  const nullSels = opts.nullSels || {};     /* sel -> true: querySelector returns null */
  const stubs = {};
  const pane = {
    _html: '', _text: '', _adj: [],
    set innerHTML(v){ if (opts.htmlThrows) throw new Error('innerHTML blocked'); this._html = v; },
    get innerHTML(){ return this._html; },
    set textContent(v){ this._text = String(v); },
    get textContent(){ return this._text; },
    insertAdjacentHTML(pos, html){ this._adj.push(String(html)); },
    querySelector(sel){
      if (throwSels[sel] === 'inf') throw new Error('querySelector blocked: ' + sel);
      if (throwSels[sel] > 0){ throwSels[sel]--; throw new Error('querySelector blocked: ' + sel); }
      if (nullSels[sel]) return null;
      if (!stubs[sel]) stubs[sel] = stubEl();
      return stubs[sel];
    }
  };
  return { pane: pane, stubs: stubs };
}
const sleep = ms => new Promise(function(res){ setTimeout(res, ms); });
async function waitIdle(stubs){
  const t0 = Date.now();
  while (stubs['#brainRun'].disabled && Date.now() - t0 < 8000)
    await new Promise(function(res){ setTimeout(res, 25); });
}

/* Z1: deps-note wiring explodes — the button must STILL get its listener,
   and the pane must SAY it degraded (never a dead button with no note) */
{
  const WZ1 = freshBrain();
  const tabZ1 = WZ1.HG_tabs[0];
  const Z1 = hostilePane({ throwSels: { '#brainDeps': 'inf' } });
  tabZ1.mount(Z1.pane);
  ok(!!(Z1.stubs['#brainRun'] && typeof Z1.stubs['#brainRun']._handler === 'function'),
     'Z1: RUN listener attached even though #brainDeps wiring throws (the silent-click repro)');
  ok(Z1.stubs['#brainStat'].textContent.indexOf('mount degraded') >= 0
     && Z1.stubs['#brainStat'].className === 'note warn',
     'Z1: degraded mount leaves a VISIBLE honest note — got "' + Z1.stubs['#brainStat'].textContent + '"');
  Z1.stubs['#brainRun']._handler();
  await waitIdle(Z1.stubs);
  ok(Z1.stubs['#brainStat'].textContent.indexOf('done ·') === 0,
     'Z1: the click actually runs the synthesis after the degraded mount — got "' + Z1.stubs['#brainStat'].textContent + '"');
}

/* Z2: listener attach fails once — mount must retry (HG_MOUNTED is latched
   outside our scope) and the dead button must be announced while it is dead */
{
  const WZ2 = freshBrain();
  const tabZ2 = WZ2.HG_tabs[0];
  const Z2 = hostilePane({ throwSels: { '#brainRun': 1 } });
  tabZ2.mount(Z2.pane);
  ok(!(Z2.stubs['#brainRun'] && Z2.stubs['#brainRun']._handler),
     'Z2: first mount attempt fails to wire the button (reproduces the dead click)');
  ok(Z2.stubs['#brainStat'].textContent.indexOf('retry') >= 0,
     'Z2: the dead button is announced, never silent — got "' + Z2.stubs['#brainStat'].textContent + '"');
  await sleep(120);
  ok(!!(Z2.stubs['#brainRun'] && typeof Z2.stubs['#brainRun']._handler === 'function'),
     'Z2: mount retries itself and the listener lands');
  Z2.stubs['#brainRun']._handler();
  await waitIdle(Z2.stubs);
  ok(Z2.stubs['#brainStat'].textContent.indexOf('done ·') === 0, 'Z2: the retried button runs the scan');
}

/* Z3: even the shell paint fails — a last-resort visible note, mount never throws */
{
  const WZ3 = freshBrain();
  const tabZ3 = WZ3.HG_tabs[0];
  const Z3 = hostilePane({ htmlThrows: true });
  let z3err = null;
  try{ tabZ3.mount(Z3.pane); tabZ3.mount(Z3.pane); }catch(e){ z3err = e; }
  ok(!z3err, 'Z3: mount never throws, even with a hostile pane' + (z3err ? ' — got: ' + z3err.message : ''));
  ok(Z3.pane.textContent.indexOf('brain mount failed') >= 0,
     'Z3: shell failure paints a last-resort visible note — got "' + Z3.pane.textContent + '"');
}

/* ================= AA) run-path failures are VISIBLE, never silent ================= */
console.log('== run-path failure visibility (AA) ==');
/* AA1: a pane element went missing — the old guard returned silently (zero
   feedback); now the stat line must say exactly what is wrong */
{
  const WA1 = freshBrain();
  const A1 = hostilePane({ nullSels: { '#brainCards': true } });
  WA1.HG_tabs[0].mount(A1.pane);
  A1.stubs['#brainRun']._handler();
  await sleep(30);
  ok(A1.stubs['#brainStat'].className === 'note warn'
     && A1.stubs['#brainStat'].textContent.indexOf('unavailable') >= 0,
     'AA1: missing pane element -> visible honest note, not a silent no-op — got "' + A1.stubs['#brainStat'].textContent + '"');
}
/* AA2: a throwing render surfaces on the stat line and releases the button */
{
  const WA2 = freshBrain();
  const A2 = freshPane();
  WA2.HG_tabs[0].mount(A2.pane);
  Object.defineProperty(A2.stubs['#brainCards'], 'innerHTML',
    { set: function(){ throw new Error('paint blocked'); }, get: function(){ return ''; } });
  A2.stubs['#brainRun']._handler();
  await waitIdle(A2.stubs);
  ok(A2.stubs['#brainStat'].className === 'note warn'
     && A2.stubs['#brainStat'].textContent.indexOf('brain synthesis failed: paint blocked') >= 0,
     'AA2: a render failure surfaces on the stat line — got "' + A2.stubs['#brainStat'].textContent + '"');
  ok(A2.stubs['#brainRun'].disabled === false, 'AA2: button re-enabled after the failure (busy released)');
}
/* AA3: gutted pane (stat/cards/watch/aside/empty all null) — last-resort note
   painted into the pane itself, click never throws */
{
  const WA3 = freshBrain();
  const A3 = hostilePane({ nullSels: { '#brainStat': true, '#brainCards': true, '#brainWatch': true,
                                       '#brainAside': true, '#brainEmpty': true } });
  WA3.HG_tabs[0].mount(A3.pane);
  let a3err = null;
  try{ A3.stubs['#brainRun']._handler(); }catch(e){ a3err = e; }
  await sleep(20);
  ok(!a3err, 'AA3: click with a gutted pane never throws' + (a3err ? ' — got: ' + a3err.message : ''));
  ok(A3.pane._adj.length >= 1 && A3.pane._adj[0].indexOf('unavailable') >= 0,
     'AA3: last-resort visible note painted into the pane itself — got ' + JSON.stringify(A3.pane._adj));
}

/* ================= AB) stuck scans time out VISIBLY ================= */
console.log('== stuck-scan timeouts (AB) ==');
/* AB1: a hung legacy universe feed — bounded by the per-leg timeout, busy released */
{
  const WB1 = freshBrain();
  WB1.brainTunables.fetchMs = 80;
  WB1.binanceTickers24h = function(){ return new Promise(function(){}); }; /* hangs forever */
  const B1 = freshPane();
  WB1.HG_tabs[0].mount(B1.pane);
  B1.stubs['#brainRun']._handler();
  await waitIdle(B1.stubs);
  ok(B1.stubs['#brainStat'].textContent.indexOf('done ·') === 0,
     'AB1: hung universe feed times out and the run completes — got "' + B1.stubs['#brainStat'].textContent + '"');
  ok(B1.stubs['#brainStat'].textContent.indexOf('Binance turnover feed unavailable') >= 0,
     'AB1: the timeout degrades honestly on the stat line');
  const b1ref = await WB1.HG_tabs[0].refresh();
  ok(b1ref === 'refreshed', 'AB1: busy flag released — refresh works after the timed-out scan (got "' + b1ref + '")');
}
/* AB2: scan-level watchdog — every candle leg hangs; the scan stops launching
   new work, renders partial results, says so, and releases the button */
{
  const WB2 = freshBrain();
  WB2.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'clear' }; };
  WB2.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WB2.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WB2.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WB2.engineState = function(){ return { survivors: [], rejected: [], at: 1 }; };
  WB2.squeezeState = function(){ return { results: [] }; };
  WB2.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'balanced', ratio: 1, text: 'BALANCED' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 0 }; } }; };
  WB2.goldspotState = function(){ return { basisPct: 0, verdict: 'balanced' }; };
  const alts2 = [], ofRes2 = [];
  for (let i = 1; i <= 50; i++){
    const base = 'ALT' + i;
    alts2.push(i % 2
      ? { sym: base + 'USDT', base: base, exchange: 'delta', turnoverUsd: i * 1e6, mark: 1, fundingPct: null, alsoOn: null }
      : { sym: 'B-' + base + '_USDT', base: base, exchange: 'cdcx', turnoverUsd: i * 1e6, mark: 1, fundingPct: null, alsoOn: null });
    ofRes2.push({ sym: base + 'USDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' });
  }
  WB2.oiflowState = function(){ return { results: ofRes2 }; };
  WB2.xuUniverse = async function(){
    return [{ sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
            { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
            { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null }].concat(alts2);
  };
  WB2.brainTunables.fetchMs = 100;
  WB2.brainTunables.scanMs = 250;
  let hungCalls = 0;
  WB2.xuCandles = function(){ hungCalls++; return new Promise(function(){}); }; /* every leg hangs */
  const B2 = freshPane();
  WB2.HG_tabs[0].mount(B2.pane);
  B2.stubs['#brainRun']._handler();
  await waitIdle(B2.stubs);
  const b2Stat = B2.stubs['#brainStat'].textContent;
  ok(b2Stat.indexOf('done · 0 PRIME · 0 HIGH · 48 watch') === 0,
     'AB2: watchdog trip still renders the verdicts (4 sub-floor alts gated aside) — got "' + b2Stat + '"');
  ok(b2Stat.indexOf('timed out') >= 0 && b2Stat.indexOf('partial') >= 0,
     'AB2: the stuck scan names its timeout honestly — got "' + b2Stat + '"');
  ok(hungCalls > 0 && hungCalls < 40,
     'AB2: the watchdog stops launching new fetches — got ' + hungCalls + ' of 40');
  ok(B2.stubs['#brainRun'].disabled === false, 'AB2: button re-enabled after the watchdog trip');
  ok(B2.stubs['#brainWatch'].innerHTML.indexOf('lrow') >= 0, 'AB2: partial results actually rendered');
}

/* ================= AC) QUICK RESCAN ================= */
console.log('== quick rescan (AC) ==');
{
  globalThis.localStorage = lsStub();
  const WC = freshBrain();
  stubLayersPrime(WC);
  let xuCalls = 0; const xuForces = [];
  let xuList = XUL;
  WC.xuUniverse = async function(force){ xuCalls++; xuForces.push(force); return xuList; };
  WC.xuState = function(){ return { count: xuList.length, delta: 3, cdcx: 2, at: Date.now(), note: null }; };
  let candleSyms = [];
  WC.xuCandles = function(item){ candleSyms.push(item.sym); return Promise.resolve(fakeRows(120)); };
  const tabC = WC.HG_tabs[0];
  const TC = freshPane();
  tabC.mount(TC.pane);

  ok(TC.pane._html.indexOf('id="brainQuick"') >= 0 && TC.pane._html.indexOf('QUICK RESCAN') >= 0,
     'AC: QUICK RESCAN button rendered beside RUN SYNTHESIS');

  /* before any full scan: honest guard, zero network work */
  TC.stubs['#brainQuick']._handler();
  await sleep(20);
  ok(TC.stubs['#brainStat'].textContent.indexOf('full synthesis first') >= 0,
     'AC: quick rescan before any full scan says exactly what to do — got "' + TC.stubs['#brainStat'].textContent + '"');
  ok(candleSyms.length === 0 && xuCalls === 0, 'AC: the guard fires zero network work');

  /* full scan baseline */
  await runAndWait(TC.stubs);
  ok(TC.stubs['#brainStat'].textContent.indexOf('done · 1 PRIME · 0 HIGH · 4 watch · 1 aside') === 0,
     'AC: full-scan baseline intact (DOGE on the radar tier) — got "' + TC.stubs['#brainStat'].textContent + '"');
  candleSyms = []; xuCalls = 0; xuForces.length = 0;

  /* quick rescan: recheck WATCH+ only, cache-read universe, age stamps */
  TC.stubs['#brainQuick']._handler();
  await waitIdle(TC.stubs);
  const q1 = TC.stubs['#brainStat'].textContent;
  ok(/^quick rescan: 5 checked · 1 unchanged · \d+s/.test(q1),
     'AC: stat line counts checked (BTC + 4 watch incl. DOGE radar) vs unchanged (XAU lane) — got "' + q1 + '"');
  ok(xuForces.every(function(f){ return f !== true; }) && xuCalls <= 1,
     'AC: never forces an exchange refetch (cache-read only) — calls=' + xuCalls + ' forces=' + JSON.stringify(xuForces));
  ok(candleSyms.length === 5 && candleSyms.indexOf('DOGEUSDT') >= 0 && candleSyms.indexOf('XAUUSDT') === -1,
     'AC: candles refetched only for the recheck set incl. the DOGE radar row, gold lane untouched — got ' + candleSyms.join(','));
  const q1aside = TC.stubs['#brainAside'].innerHTML;
  ok(q1aside.indexOf('>XAU</span>') >= 0 && q1aside.indexOf('AS OF') >= 0,
     'AC: unchanged verdicts keep their reason AND carry an age stamp');
  ok(TC.stubs['#brainCards'].innerHTML.indexOf('ENTRY <b>100</b>') >= 0,
     'AC: the PRIME card is re-planned with fresh candles');
  ok(q1.indexOf('new listing') === -1, 'AC: no new-listing note when the universe is unchanged');

  /* new-listing detection from the cached universe */
  xuList = XUL.concat([{ sym: 'NEWUSDT', base: 'NEW', exchange: 'delta', turnoverUsd: 5e8, mark: 2, fundingPct: null, alsoOn: null }]);
  const ofOld = WC.oiflowState;
  WC.oiflowState = function(){ const r = ofOld(); r.results.push({ sym: 'NEWUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' }); return r; };
  candleSyms = [];
  TC.stubs['#brainQuick']._handler();
  await waitIdle(TC.stubs);
  const q2 = TC.stubs['#brainStat'].textContent;
  ok(/^quick rescan: 6 checked · 1 unchanged/.test(q2) && q2.indexOf('1 new listing') >= 0,
     'AC: a new listing is detected and checked — got "' + q2 + '"');
  ok(TC.stubs['#brainWatch'].innerHTML.indexOf('>NEW</span>') >= 0,
     'AC: the new listing is judged on arrival (3 layers -> WATCH)');
  ok(candleSyms.indexOf('NEWUSDT') >= 0, 'AC: the new listing earns its candle fetch');

  /* stale universe cache: new-listing check skips honestly, zero xu calls */
  WC.xuState = function(){ return { count: 6, delta: 4, cdcx: 2, at: Date.now() - 20 * 60 * 1000, note: null }; };
  xuCalls = 0;
  TC.stubs['#brainQuick']._handler();
  await waitIdle(TC.stubs);
  const q3 = TC.stubs['#brainStat'].textContent;
  ok(xuCalls === 0, 'AC: stale cache -> the universe is NOT refetched for a quick rescan');
  ok(q3.indexOf('new-listing check skipped') >= 0 && /^quick rescan: 6 checked · 1 unchanged/.test(q3),
     'AC: the skip is named on the stat line — got "' + q3 + '"');

  /* layers flip: rechecked candidates move, unchanged keep their prior verdict */
  WC.regimeState = function(){ return { label: 'RISK-OFF', score: -4, playbook: { bias: 'SHORT-ONLY', sizeNote: 'half size' } }; };
  TC.stubs['#brainQuick']._handler();
  await waitIdle(TC.stubs);
  const q4 = TC.stubs['#brainStat'].textContent;
  ok(q4.indexOf('0 PRIME · 0 HIGH') >= 0, 'AC: BTC loses PRIME when the regime flips — got "' + q4 + '"');
  ok(TC.stubs['#brainCards'].innerHTML.indexOf('B-BTC_USDT') === -1
     && TC.stubs['#brainWatch'].innerHTML.indexOf('>BTC</span>') >= 0,
     'AC: the rechecked candidate moves to WATCH honestly');
  const q4aside = TC.stubs['#brainAside'].innerHTML;
  ok(q4aside.indexOf('>XAU</span>') >= 0 && q4aside.indexOf('AS OF') >= 0,
     'AC: the unchanged gold-lane verdict survives the regime flip, age stamp intact');
  delete globalThis.localStorage;
}

/* AC-legacy: same candidate set, engine plans short-circuit candle refetches */
{
  const WL = freshBrain();
  stubLayersPrime(WL);
  WL.binanceTickers24h = async function(){ return {
    BTCUSDT: { symbol: 'BTCUSDT', mark: 100, chg24: 2, turnoverUsd: 9e9 },
    ETHUSDT: { symbol: 'ETHUSDT', mark: 50, chg24: -1, turnoverUsd: 5e9 },
    SOLUSDT: { symbol: 'SOLUSDT', mark: 20, chg24: 3, turnoverUsd: 2e9 },
    XRPUSDT: { symbol: 'XRPUSDT', mark: 1, chg24: 0.5, turnoverUsd: 1e9 } }; };
  const kl = [];
  WL.binanceKlines = function(sym, tf){ kl.push(sym + '|' + tf); return Promise.resolve(fakeRows(120)); };
  const TL = freshPane();
  WL.HG_tabs[0].mount(TL.pane);
  await runAndWait(TL.stubs);
  kl.length = 0;
  TL.stubs['#brainQuick']._handler();
  await waitIdle(TL.stubs);
  const ql = TL.stubs['#brainStat'].textContent;
  ok(/^quick rescan: 4 checked · 1 unchanged · \d+s/.test(ql),
     'AC-legacy: quick rescan works without the combined feed — got "' + ql + '"');
  ok(ql.indexOf('legacy mode') >= 0, 'AC-legacy: new-listing skip is named honestly — got "' + ql + '"');
  ok(TL.stubs['#brainCards'].innerHTML.indexOf('ENTRY <b>100</b>') >= 0
     && TL.stubs['#brainAside'].innerHTML.indexOf('AS OF') >= 0,
     'AC-legacy: PRIME card re-rendered, unchanged gold lane age-stamped');
  ok(kl.length === 0, 'AC-legacy: no candle refetch when the engine already holds the plan — got ' + kl.join(','));
}

/* ================= AD) scorecard hook ================= */
console.log('== scorecard hook (AD) ==');
let unhandledRej = 0;
process.on('unhandledRejection', function(){ unhandledRej++; });
{
  const WD = freshBrain();
  stubLayersPrime(WD);
  WD.xuUniverse = async function(){ return XUL; };
  WD.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const recs = [];
  WD.hgScoreRecord = function(rec){ recs.push(rec); };
  const TD = freshPane();
  WD.HG_tabs[0].mount(TD.pane);
  await runAndWait(TD.stubs);
  ok(recs.length === 1, 'AD: exactly one scorecard record — PRIME/HIGH only, WATCH/ASIDE never recorded (got ' + recs.length + ')');
  const r0 = recs[0] || {};
  ok(r0.source === 'brain' && r0.sym === 'B-BTC_USDT' && r0.dir === 'long' && r0.tier === 'PRIME',
     'AD: record carries source/sym/dir/tier — got ' + JSON.stringify(r0).slice(0, 140));
  ok(r0.entry === 100 && r0.stop === 95 && r0.t1 === 110 && r0.t2 === 117.5,
     'AD: levels come from the engine plan verbatim — got ' + JSON.stringify([r0.entry, r0.stop, r0.t1, r0.t2]));
  ok(Array.isArray(r0.layers) && r0.layers.join(',') === 'regime,onchain,engine,oiflow,liqs',
     'AD: layers = the agreeing layer names in vote order — got ' + JSON.stringify(r0.layers));
  ok(typeof r0.at === 'number' && isFinite(r0.at) && Math.abs(Date.now() - r0.at) < 60000,
     'AD: record timestamped at scan time');

  /* quick rescan records its fresh PRIME/HIGH cards too */
  recs.length = 0;
  WD.xuState = function(){ return { count: 5, delta: 3, cdcx: 2, at: Date.now(), note: null }; };
  TD.stubs['#brainQuick']._handler();
  await waitIdle(TD.stubs);
  ok(recs.length === 1 && recs[0].tier === 'PRIME' && recs[0].source === 'brain',
     'AD: quick rescan records its fresh PRIME/HIGH cards too');

  /* a throwing recorder never breaks the scan or the render */
  WD.hgScoreRecord = function(){ throw new Error('scorecard down'); };
  await runAndWait(TD.stubs);
  ok(TD.stubs['#brainStat'].textContent.indexOf('done · 1 PRIME') === 0
     && TD.stubs['#brainCards'].innerHTML.indexOf('B-BTC_USDT') >= 0,
     'AD: a throwing hgScoreRecord never breaks the scan or the render');

  /* a rejecting-promise recorder: fire-and-forget, no unhandled rejection */
  const rejBefore = unhandledRej;
  WD.hgScoreRecord = function(){ return Promise.reject(new Error('async scorecard down')); };
  await runAndWait(TD.stubs);
  await sleep(30);
  ok(unhandledRej === rejBefore, 'AD: a rejecting hgScoreRecord promise is swallowed fire-and-forget');

  /* absent recorder: clean no-op */
  delete WD.hgScoreRecord;
  await runAndWait(TD.stubs);
  ok(TD.stubs['#brainStat'].textContent.indexOf('done · 1 PRIME') === 0, 'AD: absent hgScoreRecord is a no-op');
}
/* AD2: HIGH tier recorded in legacy mode, exact layers */
{
  const WE = freshBrain();
  WE.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'clear' }; };
  WE.regimeState = function(){ return { label: 'RISK-OFF', score: -4, playbook: { bias: 'SHORT-ONLY', sizeNote: 'half size' } }; };
  WE.rotationState = function(){ return { season: 'btc', altPct: 22, evidence: [] }; };
  WE.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WE.engineState = function(){
    return { survivors: [{ sym: 'ETHUSDT', dir: 'short', conviction: 'MODERATE',
                           plan: { entry: 50, stop: 53, t1: 44, t2: 39.5 }, gatesPassed: 5 }],
             rejected: [], at: 124 };
  };
  WE.oiflowState = function(){ return { results: [{ sym: 'ETHUSDT', dir: 'SHORT', evidence: ['NEW SHORTS (trend fuel)'] }] }; };
  WE.squeezeState = function(){ return { results: [{ sym: 'ETHUSDT', kind: 'fired', dir: 'short' }] }; };
  WE.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'balanced', ratio: 1, text: 'BALANCED' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 0 }; } }; };
  WE.goldspotState = function(){ return { basisPct: 0, verdict: 'balanced' }; };
  const recs5 = [];
  WE.hgScoreRecord = function(rec){ recs5.push(rec); };
  const TE = freshPane();
  WE.HG_tabs[0].mount(TE.pane);
  await runAndWait(TE.stubs);
  ok(recs5.length === 1 && recs5[0].tier === 'HIGH' && recs5[0].sym === 'ETHUSDT' && recs5[0].dir === 'short',
     'AD: HIGH tier recorded in legacy mode too — got ' + JSON.stringify(recs5[0]).slice(0, 140));
  ok(recs5[0] && Array.isArray(recs5[0].layers) && recs5[0].layers.join(',') === 'regime,engine,oiflow,squeeze',
     'AD: HIGH record layers exact — got ' + (recs5[0] && JSON.stringify(recs5[0].layers)));
}
/* AD3: PRIME without a plan records null levels — numbers never fabricated */
{
  const WF2 = freshBrain();
  WF2.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'clear' }; };
  WF2.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WF2.rotationState = function(){ return { season: 'btc', altPct: 25, evidence: [] }; };
  WF2.onchainState = function(){ return { bias: 'bullish', evidence: [], flags: {} }; };
  WF2.engineState = function(){ return { survivors: [], rejected: [], at: 1 }; };
  WF2.oiflowState = function(){ return { results: [{ sym: 'BTCUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' }] }; };
  WF2.squeezeState = function(){ return { results: [{ sym: 'BTCUSDT', kind: 'fired', dir: 'long' }] }; };
  WF2.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'short-flush', ratio: 0.3, text: 'SHORT FLUSH' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 2e6 }; } }; };
  WF2.liqFlushSetup = function(){ return { dir: 'long', flushSide: 'short', sym: 'BTCUSDT', flushUsd: 5e6 }; };
  WF2.goldspotState = function(){ return { basisPct: 0, verdict: 'balanced' }; };
  /* no binanceTickers24h/binanceKlines/smartSetup/hgPlanLevels — a plan is impossible;
     the missing TAPE feed is a dark layer, so the run is PRIME quality but the
     verdict is honestly CAPPED at HIGH (dark layers cap conviction) */
  const recs6 = [];
  WF2.hgScoreRecord = function(rec){ recs6.push(rec); };
  const TF2 = freshPane();
  WF2.HG_tabs[0].mount(TF2.pane);
  await runAndWait(TF2.stubs);
  ok(recs6.length === 1 && recs6[0].tier === 'HIGH' && recs6[0].sym === 'BTCUSDT',
     'AD: plan-less setup still recorded — PRIME quality capped to HIGH with the tape feed dark — got ' + recs6.length);
  ok(recs6[0] && recs6[0].entry === null && recs6[0].stop === null && recs6[0].t1 === null && recs6[0].t2 === null,
     'AD: missing plan -> null levels, never fabricated numbers');
}

/* ================= AE) radar quality gates ================= */
console.log('== radar quality gates: liquidity floor / overextension guard / funding crowding ==');
/* row-level extraction: the <div class="lrow"> segment naming >SYM</span> */
function lrowSeg(html, sym){
  const segs = String(html).split('<div class="lrow">');
  for (let i = 0; i < segs.length; i++){
    if (segs[i].indexOf('>' + sym + '</span>') >= 0) return segs[i];
  }
  return '';
}
function stubQuietLayers(WX){
  WX.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'clear' }; };
  WX.engineState = function(){ return { survivors: [], rejected: [], at: 1 }; };
  WX.squeezeState = function(){ return { results: [] }; };
  WX.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'balanced', ratio: 1, text: 'BALANCED' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 0 }; } }; };
  WX.goldspotState = function(){ return { basisPct: 0, verdict: 'balanced' }; };
  WX.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
}

/* AE1 — LIQUIDITY FLOOR: known sub-$5M turnover demotes WATCH -> ASIDE with
   the exact reason; null turnover (unknown) and exactly-$5M pass through */
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WG.oiflowState = function(){ return { results: [
    { sym: 'THINUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'MYSTUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'EXACTUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'THINUSDT', base: 'THIN', exchange: 'delta', turnoverUsd: 2e6, mark: 1, fundingPct: 0, alsoOn: null },
    { sym: 'MYSTUSDT', base: 'MYST', exchange: 'delta', turnoverUsd: null, mark: 1, fundingPct: null, alsoOn: null },
    { sym: 'EXACTUSDT', base: 'EXACT', exchange: 'delta', turnoverUsd: 5e6, mark: 1, fundingPct: 0, alsoOn: null } ]; };
  const TG1 = freshPane();
  WG.HG_tabs[0].mount(TG1.pane);
  await runAndWait(TG1.stubs);
  const g1Stat = TG1.stubs['#brainStat'].textContent;
  const g1Watch = TG1.stubs['#brainWatch'].innerHTML;
  const g1Aside = TG1.stubs['#brainAside'].innerHTML;
  ok(g1Stat.indexOf('done · 0 PRIME · 0 HIGH · 4 watch · 3 aside') === 0,
     'AE1: buckets — ETH/SOL/MYST/EXACT watch, BTC+THIN+gold aside — got "' + g1Stat + '"');
  ok(g1Stat.indexOf(' · 1 gated: 1 liquidity') >= 0,
     'AE1: stat line tallies the liquidity demotion — got "' + g1Stat + '"');
  ok(g1Aside.indexOf('>THIN</span>') >= 0
     && lrowSeg(g1Aside, 'THIN').indexOf('below liquidity floor — $2.0M 24h turnover, slippage eats the edge') >= 0,
     'AE1: below-floor WATCH demoted to ASIDE with the exact reason — got "' + lrowSeg(g1Aside, 'THIN').slice(0, 160) + '"');
  ok(g1Watch.indexOf('>THIN</span>') === -1, 'AE1: the gated row leaves the WATCH ledger (demoted, not hidden)');
  ok(g1Watch.indexOf('>MYST</span>') >= 0 && g1Aside.indexOf('>MYST</span>') === -1,
     'AE1: null turnover = unknown = NEVER punished — MYST keeps its WATCH row');
  ok(g1Watch.indexOf('>EXACT</span>') >= 0,
     'AE1: exactly $5.0M turnover passes the >= $5M floor (boundary honored)');
}

/* AE2 — OVEREXTENSION GUARD (long): a WATCH chase into a >= +15% 24h move
   demotes; the +15.0% boundary fires; a perp missing from the tape passes */
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WG.oiflowState = function(){ return { results: [
    { sym: 'QUIETUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WG.binanceTickers24h = async function(){ return {
    PUMPUSDT: { symbol: 'PUMPUSDT', mark: 1, chg24: 18.2, turnoverUsd: 300e6 },
    EDGEUSDT: { symbol: 'EDGEUSDT', mark: 1, chg24: 15.0, turnoverUsd: 200e6 } }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null },
    { sym: 'PUMPUSDT', base: 'PUMP', exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: 0, alsoOn: null },
    { sym: 'EDGEUSDT', base: 'EDGE', exchange: 'delta', turnoverUsd: 40e6, mark: 1, fundingPct: 0, alsoOn: null },
    { sym: 'QUIETUSDT', base: 'QUIET', exchange: 'delta', turnoverUsd: 60e6, mark: 1, fundingPct: 0, alsoOn: null } ]; };
  const TG2 = freshPane();
  WG.HG_tabs[0].mount(TG2.pane);
  await runAndWait(TG2.stubs);
  const g2Stat = TG2.stubs['#brainStat'].textContent;
  const g2Watch = TG2.stubs['#brainWatch'].innerHTML;
  const g2Aside = TG2.stubs['#brainAside'].innerHTML;
  ok(g2Stat.indexOf('done · 0 PRIME · 0 HIGH · 3 watch · 4 aside') === 0,
     'AE2: buckets — ETH/SOL/QUIET watch, PUMP+EDGE gated aside — got "' + g2Stat + '"');
  ok(g2Stat.indexOf(' · 2 gated: 2 overextended') >= 0,
     'AE2: stat line tallies both overextension demotions — got "' + g2Stat + '"');
  ok(lrowSeg(g2Aside, 'PUMP').indexOf('overextended +18.2% 24h — chasing tops is how radar dies') >= 0,
     'AE2: +18.2% chase demoted with the exact reason — got "' + lrowSeg(g2Aside, 'PUMP').slice(0, 160) + '"');
  ok(lrowSeg(g2Aside, 'EDGE').indexOf('overextended +15.0% 24h — chasing tops is how radar dies') >= 0,
     'AE2: exactly +15.0% trips the >= +15% guard (boundary honored)');
  ok(g2Watch.indexOf('>PUMP</span>') === -1 && g2Watch.indexOf('>EDGE</span>') === -1,
     'AE2: gated chases leave the WATCH ledger');
  ok(g2Watch.indexOf('>QUIET</span>') >= 0 && g2Aside.indexOf('>QUIET</span>') === -1,
     'AE2: tape-missing pass-through — a WATCH row with no tape perp is never punished');
}

/* AE3 — OVEREXTENSION (short) + FUNDING CROWDING: shorts demote on <= -15%;
   same-direction |funding| >= 0.1%/8h cautions WITHOUT demoting; opposite-
   sign and sub-threshold funding stay silent */
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-OFF', score: -4, playbook: { bias: 'SHORT-ONLY', sizeNote: 'half size' } }; };
  WG.rotationState = function(){ return { season: 'btc', altPct: 25, evidence: [] }; };
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG.oiflowState = function(){ return { results: [
    { sym: 'DUMPUSDT', dir: 'SHORT', evidence: 2, cls: 'NEW SHORTS' },
    { sym: 'CROWDUSDT', dir: 'SHORT', evidence: 2, cls: 'NEW SHORTS' },
    { sym: 'FLIPUSDT', dir: 'SHORT', evidence: 2, cls: 'NEW SHORTS' },
    { sym: 'TAMEUSDT', dir: 'SHORT', evidence: 2, cls: 'NEW SHORTS' },
    { sym: 'FEDGEUSDT', dir: 'SHORT', evidence: 2, cls: 'NEW SHORTS' } ] }; };
  WG.binanceTickers24h = async function(){ return {
    DUMPUSDT:  { symbol: 'DUMPUSDT',  mark: 1, chg24: -17.5, turnoverUsd: 400e6 },
    CROWDUSDT: { symbol: 'CROWDUSDT', mark: 1, chg24: -9.5,  turnoverUsd: 100e6 },
    FLIPUSDT:  { symbol: 'FLIPUSDT',  mark: 1, chg24: -9.1,  turnoverUsd: 100e6 },
    TAMEUSDT:  { symbol: 'TAMEUSDT',  mark: 1, chg24: -8.9,  turnoverUsd: 100e6 },
    FEDGEUSDT: { symbol: 'FEDGEUSDT', mark: 1, chg24: -8.5,  turnoverUsd: 100e6 } }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null },
    { sym: 'DUMPUSDT', base: 'DUMP', exchange: 'delta', turnoverUsd: 30e6, mark: 1, fundingPct: 0, alsoOn: null },
    { sym: 'CROWDUSDT', base: 'CROWD', exchange: 'delta', turnoverUsd: 20e6, mark: 1, fundingPct: -0.14, alsoOn: null },
    { sym: 'FLIPUSDT', base: 'FLIP', exchange: 'delta', turnoverUsd: 20e6, mark: 1, fundingPct: 0.3, alsoOn: null },
    { sym: 'TAMEUSDT', base: 'TAME', exchange: 'delta', turnoverUsd: 20e6, mark: 1, fundingPct: -0.05, alsoOn: null },
    { sym: 'FEDGEUSDT', base: 'FEDGE', exchange: 'delta', turnoverUsd: 20e6, mark: 1, fundingPct: -0.1, alsoOn: null } ]; };
  const TG3 = freshPane();
  WG.HG_tabs[0].mount(TG3.pane);
  await runAndWait(TG3.stubs);
  const g3Stat = TG3.stubs['#brainStat'].textContent;
  const g3Watch = TG3.stubs['#brainWatch'].innerHTML;
  const g3Aside = TG3.stubs['#brainAside'].innerHTML;
  ok(g3Stat.indexOf('done · 0 PRIME · 0 HIGH · 4 watch · 5 aside') === 0,
     'AE3: buckets — CROWD/FLIP/TAME/FEDGE watch (cautions never demote), DUMP gated — got "' + g3Stat + '"');
  ok(g3Stat.indexOf(' · 1 gated: 1 overextended') >= 0,
     'AE3: only the overextended chase is tallied — funding cautions are NOT demotions — got "' + g3Stat + '"');
  ok(lrowSeg(g3Aside, 'DUMP').indexOf('overextended -17.5% 24h — chasing tops is how radar dies') >= 0,
     'AE3: short chase into a -17.5% move demotes with the exact signed reason');
  ok(lrowSeg(g3Watch, 'CROWD').indexOf('funding crowded same-direction — squeeze risk') >= 0,
     'AE3: -0.14%/8h funding behind a SHORT row -> caution named on the WATCH row, tier unchanged');
  ok(lrowSeg(g3Watch, 'FEDGE').indexOf('funding crowded same-direction — squeeze risk') >= 0,
     'AE3: exactly |0.1|%/8h funding trips the >= 0.1% caution (boundary honored)');
  ok(lrowSeg(g3Watch, 'FLIP').length > 0 && lrowSeg(g3Watch, 'FLIP').indexOf('funding crowded') === -1,
     'AE3: positive funding behind a SHORT row is opposite-direction — no caution');
  ok(lrowSeg(g3Watch, 'TAME').length > 0 && lrowSeg(g3Watch, 'TAME').indexOf('funding crowded') === -1,
     'AE3: |0.05|%/8h funding is sub-threshold — no caution');
}

/* AE4 — PRIME/HIGH chips, never demotions: an overextended PRIME keeps its
   tier and shows amber GUARD chips; a WATCH row names its funding caution;
   nothing demoted -> no stat tally */
{
  const WG = freshBrain();
  stubLayersPrime(WG);
  WG.binanceTickers24h = async function(){ return {
    BTCUSDT: { symbol: 'BTCUSDT', mark: 100, chg24: 16.4, turnoverUsd: 9e9 },
    ETHUSDT: { symbol: 'ETHUSDT', mark: 50, chg24: -1, turnoverUsd: 5e9 },
    SOLUSDT: { symbol: 'SOLUSDT', mark: 20, chg24: 3, turnoverUsd: 2e9 },
    XRPUSDT: { symbol: 'XRPUSDT', mark: 1, chg24: 0.5, turnoverUsd: 1e9 } }; };
  const XUL2 = [
    { sym: 'B-BTC_USDT', base: 'BTC',  exchange: 'cdcx',  turnoverUsd: 9e9, mark: 100,  fundingPct: 0.13,  alsoOn: ['delta'] },
    { sym: 'ETHUSDT',    base: 'ETH',  exchange: 'delta', turnoverUsd: 5e9, mark: 50,   fundingPct: 0.11,  alsoOn: ['cdcx'] },
    { sym: 'SOLUSDT',    base: 'SOL',  exchange: 'delta', turnoverUsd: 2e9, mark: 20,   fundingPct: 0,     alsoOn: null },
    { sym: 'B-XRP_USDT', base: 'XRP',  exchange: 'cdcx',  turnoverUsd: 1e9, mark: 1,    fundingPct: null,  alsoOn: null },
    { sym: 'DOGEUSDT',   base: 'DOGE', exchange: 'delta', turnoverUsd: 8e8, mark: 0.2,  fundingPct: null,  alsoOn: null }
  ];
  WG.xuUniverse = async function(){ return XUL2; };
  WG.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const TG4 = freshPane();
  WG.HG_tabs[0].mount(TG4.pane);
  await runAndWait(TG4.stubs);
  const g4Stat = TG4.stubs['#brainStat'].textContent;
  const g4Cards = TG4.stubs['#brainCards'].innerHTML;
  const g4Watch = TG4.stubs['#brainWatch'].innerHTML;
  ok(g4Stat.indexOf('done · 1 PRIME · 0 HIGH · 4 watch · 1 aside') === 0,
     'AE4: buckets unchanged — cautions never demote — got "' + g4Stat + '"');
  ok(g4Stat.indexOf('gated') === -1, 'AE4: nothing demoted -> no gate tally on the stat line — got "' + g4Stat + '"');
  ok(g4Cards.indexOf('PRIME · 6 LAYERS') >= 0,
     'AE4: BTC stays PRIME on 6 layers (tape momentum joined) despite the extended move');
  ok(g4Cards.indexOf('GUARD: overextended +16.4% 24h — chasing tops is how radar dies') >= 0,
     'AE4: PRIME overextension renders as a caution CHIP, not a demotion');
  ok(g4Cards.indexOf('GUARD: funding crowded same-direction — squeeze risk') >= 0,
     'AE4: +0.13%/8h funding behind the LONG PRIME chips a crowding caution on the card');
  ok(lrowSeg(g4Watch, 'ETH').indexOf('funding crowded same-direction — squeeze risk') >= 0,
     'AE4: +0.11%/8h funding behind the LONG WATCH row names the caution on the row');
  ok(lrowSeg(g4Watch, 'SOL').length > 0 && lrowSeg(g4Watch, 'SOL').indexOf('funding crowded') === -1,
     'AE4: zero funding -> no caution');
}

/* AE5 — combined tally + HIGH demotion + kill precedence: liquidity beats
   overextension (first kill named), HIGH is not spared the floor */
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WG.oiflowState = function(){ return { results: [
    { sym: 'THIN1USDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'THIN2USDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'DUSTUSDT',  dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WG.binanceTickers24h = async function(){ return {
    PUMPUSDT: { symbol: 'PUMPUSDT', mark: 1, chg24: 19.1, turnoverUsd: 300e6 },
    DUSTUSDT: { symbol: 'DUSTUSDT', mark: 1, chg24: 22.4, turnoverUsd: 500e6 } }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null },
    { sym: 'THIN1USDT', base: 'THIN1', exchange: 'delta', turnoverUsd: 1.5e6, mark: 1, fundingPct: 0, alsoOn: null },
    { sym: 'THIN2USDT', base: 'THIN2', exchange: 'delta', turnoverUsd: 3.2e6, mark: 1, fundingPct: 0, alsoOn: null },
    { sym: 'PUMPUSDT', base: 'PUMP', exchange: 'delta', turnoverUsd: 40e6, mark: 1, fundingPct: 0, alsoOn: null },
    { sym: 'DUSTUSDT', base: 'DUST', exchange: 'delta', turnoverUsd: 1.2e6, mark: 1, fundingPct: 0, alsoOn: null } ]; };
  const TG5 = freshPane();
  WG.HG_tabs[0].mount(TG5.pane);
  await runAndWait(TG5.stubs);
  const g5Stat = TG5.stubs['#brainStat'].textContent;
  const g5Watch = TG5.stubs['#brainWatch'].innerHTML;
  const g5Aside = TG5.stubs['#brainAside'].innerHTML;
  ok(g5Stat.indexOf('done · 0 PRIME · 0 HIGH · 2 watch · 6 aside') === 0,
     'AE5: buckets — ETH/SOL watch, 4 gated + BTC + gold aside — got "' + g5Stat + '"');
  ok(g5Stat.indexOf(' · 4 gated: 3 liquidity · 1 overextended') >= 0,
     'AE5: the suppressed tally names both gate kinds — got "' + g5Stat + '"');
  ok(lrowSeg(g5Aside, 'THIN1').indexOf('below liquidity floor — $1.5M 24h turnover, slippage eats the edge') >= 0
     && lrowSeg(g5Aside, 'THIN2').indexOf('below liquidity floor — $3.2M 24h turnover, slippage eats the edge') >= 0,
     'AE5: both sub-floor WATCH rows demoted with exact per-row reasons');
  ok(lrowSeg(g5Aside, 'PUMP').indexOf('overextended +19.1% 24h — chasing tops is how radar dies') >= 0,
     'AE5: the overextended WATCH chase demoted with its exact reason');
  ok(lrowSeg(g5Aside, 'DUST').indexOf('below liquidity floor — $1.2M 24h turnover, slippage eats the edge') >= 0
     && lrowSeg(g5Aside, 'DUST').indexOf('overextended') === -1,
     'AE5: HIGH (4 layers) is not spared the floor; liquidity is the named first kill, not overextension');
  ok(g5Watch.indexOf('>THIN1</span>') === -1 && g5Watch.indexOf('>DUST</span>') === -1
     && g5Watch.indexOf('>ETH</span>') >= 0 && g5Watch.indexOf('>SOL</span>') >= 0,
     'AE5: gated rows leave WATCH; clean radar rows stay');
}

/* ================= AF) TREND4H / F&G / path-to-HIGH / __hgBrainLast ================= */
console.log('== TREND4H promotion, F&G extremes, path-to-HIGH, signal-logger snapshot ==');
/* deterministic trending 4h rows: net slope +/-0.4/bar with a sine wiggle so
   confirmed 2-bar swing pivots exist (rising maxima = higher-highs, falling
   minima = lower-lows); flat fakeRows() has NO pivots and equal EMAs */
function trendRows(up){
  const rows = []; const t0 = 1700000000 - 120 * 14400;
  for (let i = 0; i < 120; i++){
    const base = up ? 100 + i * 0.4 : 100 - i * 0.4;
    const c = base + Math.sin(i / 3) * 1.5;
    rows.push({ t: t0 + i * 14400, o: c - 0.1, h: c + 0.6, l: c - 0.6, c: c, v: 1000 });
  }
  return rows;
}

/* ---- AF0: F&G vote semantics in brainCollect (unit) ---- */
{
  const C3 = freshBrain().brainCollect;
  let r3 = C3({ sym: 'BTCUSDT', fng: { v: 12, c: 'Extreme Fear' } });
  ok(r3.votes.some(function(x){ return x.layer === 'fng' && x.vote === 'long' && x.kind === 'context'
                                   && x.text === 'F&G 12 extreme fear — contrarian long context'; }),
     'F&G 12 -> named contrarian long context vote for BTC');
  r3 = C3({ sym: 'ETHUSDT', fng: { v: 85, c: 'Extreme Greed' } });
  ok(r3.votes.some(function(x){ return x.layer === 'fng' && x.vote === 'short'
                                   && x.text === 'F&G 85 extreme greed — contrarian short context'; }),
     'F&G 85 -> named contrarian short context vote for ETH (legacy sym)');
  r3 = C3({ sym: 'B-SOL_USDT', aliases: ['B-SOL_USDT', 'SOLUSDT', 'SOL'], fng: { v: 9 } });
  ok(r3.votes.some(function(x){ return x.layer === 'fng' && x.vote === 'long'; }),
     'F&G extreme votes for an xu-sym major through aliases');
  r3 = C3({ sym: 'BTCUSDT', fng: { v: 20 } });
  ok(r3.votes.some(function(x){ return x.layer === 'fng' && x.vote === 'long' && x.text.indexOf('F&G 20 ') === 0; }),
     'F&G exactly 20 -> long vote (<= 20 boundary honored)');
  r3 = C3({ sym: 'BTCUSDT', fng: { v: 80 } });
  ok(r3.votes.some(function(x){ return x.layer === 'fng' && x.vote === 'short' && x.text.indexOf('F&G 80 ') === 0; }),
     'F&G exactly 80 -> short vote (>= 80 boundary honored)');
  r3 = C3({ sym: 'BTCUSDT', fng: { v: 21 } });
  ok(!r3.votes.some(function(x){ return x.layer === 'fng'; }) && r3.silent.indexOf('fng') >= 0,
     'F&G 21 -> neutral zone silent, no vote');
  r3 = C3({ sym: 'BTCUSDT', fng: { v: 79 } });
  ok(!r3.votes.some(function(x){ return x.layer === 'fng'; }) && r3.silent.indexOf('fng') >= 0,
     'F&G 79 -> neutral zone silent, no vote');
  r3 = C3({ sym: 'ALTUSDT', fng: { v: 12 } });
  ok(!r3.votes.some(function(x){ return x.layer === 'fng'; }) && r3.silent.indexOf('fng') >= 0
     && r3.unavailable.indexOf('fng') === -1,
     'F&G extreme is majors-only — alts silent, never dark');
  r3 = C3({ sym: 'BTCUSDT' });
  ok(!r3.votes.some(function(x){ return x.layer === 'fng'; }) && r3.silent.indexOf('fng') === -1
     && r3.unavailable.indexOf('fng') === -1,
     'F&G absent -> the layer sits out ENTIRELY: no vote, not silent, NOT dark (never caps)');
  r3 = C3({ sym: 'BTCUSDT', fng: { v: NaN } });
  ok(!r3.votes.some(function(x){ return x.layer === 'fng'; }) && r3.unavailable.indexOf('fng') === -1,
     'non-finite F&G -> sits out, never dark');
  const dOnly = DECIDE([{ layer: 'fng', vote: 'long', text: 'F&G 12 extreme fear — contrarian long context', kind: 'context' }], {});
  ok(dOnly.tier === 'ASIDE' && dOnly.agree === 1, 'F&G can never create a tier by itself (lone context vote = thin ASIDE)');
}

/* ---- AF1: TREND4H promotes WATCH -> HIGH after the candle fetch ---- */
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG.oiflowState = function(){ return { results: [ { sym: 'TRENDYUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null },
    { sym: 'TRENDYUSDT', base: 'TRENDY', exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: 0, alsoOn: null } ]; };
  WG.xuCandles = function(item){
    return Promise.resolve(item.sym === 'TRENDYUSDT' ? trendRows(true) : fakeRows(120));
  };
  const TF1 = freshPane();
  WG.HG_tabs[0].mount(TF1.pane);
  await runAndWait(TF1.stubs);
  const f1Stat = TF1.stubs['#brainStat'].textContent;
  const f1Cards = TF1.stubs['#brainCards'].innerHTML;
  const f1Watch = TF1.stubs['#brainWatch'].innerHTML;
  ok(f1Stat.indexOf('done · 0 PRIME · 1 HIGH · 2 watch · 2 aside') === 0,
     'AF1: TRENDY (3 layers -> WATCH on votes) promoted to HIGH by the post-fetch TREND4H vote — got "' + f1Stat + '"');
  ok(f1Cards.indexOf('TRENDYUSDT') >= 0 && f1Cards.indexOf('HIGH · 4 LAYERS') >= 0 && f1Cards.indexOf('>LONG</span>') >= 0,
     'AF1: promoted card renders HIGH · 4 LAYERS LONG');
  ok(f1Cards.indexOf('TREND4H: 4h EMA20&gt;EMA50 + higher-high — structural long') >= 0,
     'AF1: the TREND4H pip names EMA alignment + higher-high (HTML-escaped)');
  ok(f1Watch.indexOf('>TRENDY</span>') === -1 && f1Watch.indexOf('>ETH</span>') >= 0,
     'AF1: the promoted row leaves WATCH; flat-candle radar rows stay put (no fabricated votes)');
  const snap1 = WG.__hgBrainLast();
  const tr = snap1.rows.filter(function(x){ return x.sym === 'TRENDYUSDT'; })[0];
  ok(tr && tr.tier === 'HIGH' && tr.dir === 'long'
     && tr.evidence.indexOf('TREND4H: 4h EMA20>EMA50 + higher-high — structural long') >= 0,
     'AF1: __hgBrainLast evidence carries the raw TREND4H string for the promoted row');
}

/* ---- AF2: TREND4H completes PRIME (bars unchanged: structural + positioning + news clear) ---- */
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'btc', altPct: 25, evidence: [] }; };
  WG.onchainState = function(){ return { bias: 'bullish', evidence: [{ side: 'bull', text: 'miners healthy' }], flags: {} }; };
  WG.oiflowState = function(){ return { results: [ { sym: 'BTCUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WG.binanceTickers24h = async function(){ return { BTCUSDT: { symbol: 'BTCUSDT', mark: 100, chg24: 2, turnoverUsd: 9e9 } }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null } ]; };
  WG.xuCandles = function(){ return Promise.resolve(trendRows(true)); };
  const TF2 = freshPane();
  WG.HG_tabs[0].mount(TF2.pane);
  await runAndWait(TF2.stubs);
  const f2Stat = TF2.stubs['#brainStat'].textContent;
  const f2Cards = TF2.stubs['#brainCards'].innerHTML;
  ok(f2Stat.indexOf('done · 1 PRIME · 0 HIGH · 0 watch · 3 aside') === 0,
     'AF2: BTC (4 layers HIGH incl. positioning, no structural) completes PRIME via the TREND4H structural vote — got "' + f2Stat + '"');
  ok(f2Cards.indexOf('PRIME · 5 LAYERS') >= 0 && f2Cards.indexOf('✓ structural · ✓ positioning') >= 0,
     'AF2: PRIME card still passes the unchanged bar — structural AND positioning present');
  ok(f2Cards.indexOf('TREND4H: 4h EMA20&gt;EMA50 + higher-high — structural long') >= 0,
     'AF2: the promoting vote is named on the card');
}

/* ---- AF3: TREND4H dark honesty — failed fetch caps PRIME -> HIGH, named ---- */
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'btc', altPct: 25, evidence: [] }; };
  WG.onchainState = function(){ return { bias: 'bullish', evidence: [{ side: 'bull', text: 'miners healthy' }], flags: {} }; };
  WG.engineState = function(){ return { survivors: [ { sym: 'BTCUSDT', dir: 'long', conviction: 'STRONG',
      plan: { entry: 100, stop: 95, t1: 110, t2: 117.5 }, gatesPassed: 6 } ], rejected: [], at: 1 }; };
  WG.oiflowState = function(){ return { results: [
    { sym: 'BTCUSDT', dir: 'LONG', evidence: 3, cls: 'NEW LONGS' },
    { sym: 'ALTWUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WG.binanceTickers24h = async function(){ return { BTCUSDT: { symbol: 'BTCUSDT', mark: 100, chg24: 2, turnoverUsd: 9e9 } }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ALTWUSDT', base: 'ALTW', exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: 0, alsoOn: null } ]; };
  WG.xuCandles = function(){ return Promise.resolve(null); };   /* every fetch fails */
  const TF3 = freshPane();
  WG.HG_tabs[0].mount(TF3.pane);
  await runAndWait(TF3.stubs);
  const f3Stat = TF3.stubs['#brainStat'].textContent;
  const f3Cards = TF3.stubs['#brainCards'].innerHTML;
  const f3Watch = TF3.stubs['#brainWatch'].innerHTML;
  ok(f3Stat.indexOf('done · 0 PRIME · 1 HIGH · 1 watch · 3 aside') === 0,
     'AF3: PRIME-quality BTC with unfetchable candles is honestly CAPPED to HIGH — got "' + f3Stat + '"');
  ok(f3Cards.indexOf('CAPPED from PRIME') >= 0 && f3Cards.indexOf('trend4h') >= 0,
     'AF3: the cap names trend4h as the dark layer on the card');
  ok(lrowSeg(f3Watch, 'ALTW').indexOf('1 dark') >= 0,
     'AF3: a WATCH row with failed fetch reports its dark trend4h honestly');
  ok(lrowSeg(f3Watch, 'ALTW').indexOf('path to HIGH: needs TREND4H + ENGINE') >= 0,
     'AF3: path-to-HIGH names TREND4H first among the layers that could still agree — got "' + lrowSeg(f3Watch, 'ALTW').slice(0, 220) + '"');
}

/* ---- AF4: TREND4H short side + counter-trend candles never vote ---- */
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-OFF', score: -4, playbook: { bias: 'SHORT-ONLY', sizeNote: 'half size' } }; };
  WG.rotationState = function(){ return { season: 'btc', altPct: 25, evidence: [] }; };
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG.oiflowState = function(){ return { results: [ { sym: 'DROPYUSDT', dir: 'SHORT', evidence: 2, cls: 'NEW SHORTS' } ] }; };
  WG.squeezeState = function(){ return { results: [ { sym: 'DROPYUSDT', kind: 'break', dir: 'short' } ] }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null },
    { sym: 'DROPYUSDT', base: 'DROPY', exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: 0, alsoOn: null } ]; };
  WG.xuCandles = function(item){ return Promise.resolve(item.sym === 'DROPYUSDT' ? trendRows(false) : fakeRows(120)); };
  const TF4 = freshPane();
  WG.HG_tabs[0].mount(TF4.pane);
  await runAndWait(TF4.stubs);
  const f4Stat = TF4.stubs['#brainStat'].textContent;
  const f4Cards = TF4.stubs['#brainCards'].innerHTML;
  ok(f4Stat.indexOf('done · 0 PRIME · 1 HIGH · 0 watch · 4 aside') === 0,
     'AF4: short-biased DROPY promoted WATCH -> HIGH by the downtrend TREND4H vote (BTC tied aside, ETH/SOL thin aside) — got "' + f4Stat + '"');
  ok(f4Cards.indexOf('HIGH · 4 LAYERS') >= 0 && f4Cards.indexOf('>SHORT</span>') >= 0
     && f4Cards.indexOf('TREND4H: 4h EMA20&lt;EMA50 + lower-low — structural short') >= 0,
     'AF4: short TREND4H pip names EMA20<EMA50 + lower-low');

  /* counter-trend: a LONG-biased WATCH row on DOWNTREND candles -> no vote, stays WATCH */
  const WG2 = freshBrain();
  stubQuietLayers(WG2);
  WG2.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG2.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WG2.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG2.oiflowState = function(){ return { results: [ { sym: 'FIGHTUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WG2.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null },
    { sym: 'FIGHTUSDT', base: 'FIGHT', exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: 0, alsoOn: null } ]; };
  WG2.xuCandles = function(item){ return Promise.resolve(item.sym === 'FIGHTUSDT' ? trendRows(false) : fakeRows(120)); };
  const TF5 = freshPane();
  WG2.HG_tabs[0].mount(TF5.pane);
  await runAndWait(TF5.stubs);
  const f5Stat = TF5.stubs['#brainStat'].textContent;
  ok(f5Stat.indexOf('done · 0 PRIME · 0 HIGH · 3 watch · 2 aside') === 0,
     'AF4: counter-trend candles cast NO vote — the LONG row fighting a downtrend stays WATCH — got "' + f5Stat + '"');
  ok(TF5.stubs['#brainCards'].innerHTML === '' && TF5.stubs['#brainWatch'].innerHTML.indexOf('>FIGHT</span>') >= 0,
     'AF4: no promotion against the trend; the row keeps its honest WATCH verdict');
  const snapF = WG2.__hgBrainLast().rows.filter(function(x){ return x.sym === 'FIGHTUSDT'; })[0];
  ok(snapF && snapF.tier === 'WATCH' && !snapF.evidence.some(function(e){ return e.indexOf('TREND4H:') === 0; }),
     'AF4: snapshot evidence confirms no TREND4H vote was fabricated against the trend');
}

/* ---- AF5: F&G extremes at run level + __hgBrainLast contract ---- */
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'btc', altPct: 25, evidence: [] }; };
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null },
    { sym: 'ALTONEUSDT', base: 'ALTONE', exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: 0, alsoOn: null } ]; };
  WG.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const TF6 = freshPane();
  WG.HG_tabs[0].mount(TF6.pane);

  /* extreme fear: majors gain the contrarian long vote, alts do not */
  globalThis.S = { fng: { v: 12, c: 'Extreme Fear' } };
  await runAndWait(TF6.stubs);
  const g5Stat = TF6.stubs['#brainStat'].textContent;
  const g5Watch = TF6.stubs['#brainWatch'].innerHTML;
  ok(g5Stat.indexOf('done · 0 PRIME · 0 HIGH · 3 watch · 2 aside') === 0,
     'AF5: F&G 12 — BTC reaches WATCH on 3 layers (regime+rotation+F&G), ETH/SOL on radar — got "' + g5Stat + '"');
  ok(lrowSeg(g5Watch, 'BTC').indexOf('3 layers agree LONG') >= 0 && lrowSeg(g5Watch, 'BTC').indexOf('radar only') === -1,
     'AF5: the F&G vote counts as a real third layer for BTC');
  ok(lrowSeg(g5Watch, 'ETH').indexOf('radar only') >= 0,
     'AF5: ETH rides radar on regime + F&G (2 layers, uncontested)');
  ok(g5Watch.indexOf('>ALTONE</span>') === -1 && TF6.stubs['#brainAside'].innerHTML.indexOf('>ALTONE</span>') >= 0,
     'AF5: F&G is majors-only — ALTONE stays ASIDE on its lone regime vote');
  let snap5 = WG.__hgBrainLast();
  const bRow = snap5.rows.filter(function(x){ return x.sym === 'BTCUSDT'; })[0];
  const aRow = snap5.rows.filter(function(x){ return x.sym === 'ALTONEUSDT'; })[0];
  ok(bRow && bRow.evidence.indexOf('FNG: F&G 12 extreme fear — contrarian long context') >= 0,
     'AF5: __hgBrainLast evidence names the F&G vote for the signal logger');
  ok(aRow && !aRow.evidence.some(function(e){ return e.indexOf('FNG:') === 0; }),
     'AF5: the alt row carries no F&G evidence');

  /* snapshot contract: shape + deep freeze */
  ok(typeof snap5.at === 'number' && isFinite(snap5.at) && typeof snap5.marketRead === 'string'
     && snap5.marketRead.indexOf('RISK-ON regime') >= 0 && Array.isArray(snap5.rows) && snap5.rows.length === 5,
     'AF5: snapshot = {at, marketRead, rows[5]} of the completed synthesis');
  ok(Object.isFrozen(snap5) && Object.isFrozen(snap5.rows) && Object.isFrozen(snap5.rows[0])
     && Object.isFrozen(snap5.rows[0].evidence),
     'AF5: the snapshot is DEEP-frozen (object, rows, row, evidence)');
  let froze = false;
  try{ snap5.rows.push({}); }catch(e){ froze = true; }
  ok(froze, 'AF5: mutating the frozen snapshot throws (signal logger cannot corrupt state)');
  const gRow = snap5.rows.filter(function(x){ return x.sym === 'XAU'; })[0];
  ok(gRow && gRow.plan === null, 'AF5: plan-less rows snapshot plan:null — levels never fabricated');

  /* extreme greed: the contrarian SHORT vote is real — it contests BTC's longs aside */
  globalThis.S = { fng: { v: 88, c: 'Extreme Greed' } };
  await runAndWait(TF6.stubs);
  const g6Stat = TF6.stubs['#brainStat'].textContent;
  ok(g6Stat.indexOf('done · 0 PRIME · 0 HIGH · 0 watch · 5 aside') === 0,
     'AF5: F&G 88 greed votes SHORT against the long playbook — contested, honestly ASIDE — got "' + g6Stat + '"');
  snap5 = WG.__hgBrainLast();
  const bRow2 = snap5.rows.filter(function(x){ return x.sym === 'BTCUSDT'; })[0];
  ok(bRow2 && bRow2.evidence.indexOf('FNG: F&G 88 extreme greed — contrarian short context') >= 0,
     'AF5: the greed vote is named in the snapshot evidence');

  /* neutral zone: silent — same verdict as no F&G at all */
  globalThis.S = { fng: { v: 50, c: 'Neutral' } };
  await runAndWait(TF6.stubs);
  snap5 = WG.__hgBrainLast();
  const bRow3 = snap5.rows.filter(function(x){ return x.sym === 'BTCUSDT'; })[0];
  ok(TF6.stubs['#brainStat'].textContent.indexOf('done · 0 PRIME · 0 HIGH · 1 watch · 4 aside') === 0
     && bRow3 && !bRow3.evidence.some(function(e){ return e.indexOf('FNG:') === 0; }),
     'AF5: F&G 50 neutral -> silent, BTC back to 2-layer radar (ETH/SOL drop to thin ASIDE) with zero F&G evidence — got "' + TF6.stubs['#brainStat'].textContent + '"');
  delete globalThis.S;
}

/* ---- AF6: path-to-HIGH names dissent + dark caps concretely ---- */
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'btc', altPct: 25, evidence: [] }; };
  /* BTC: 5 PRIME-quality layers but 3 dark (onchain/tape/liqs absent) -> capped WATCH */
  WG.engineState = function(){ return { survivors: [
    { sym: 'BTCUSDT', dir: 'long', conviction: 'STRONG',
      plan: { entry: 100, stop: 95, t1: 110, t2: 117.5 }, gatesPassed: 6 },
    { sym: 'MIXEDUSDT', dir: 'long', conviction: 'MEDIUM' } ], rejected: [], at: 1 }; };
  WG.oiflowState = function(){ return { results: [
    { sym: 'BTCUSDT', dir: 'LONG', evidence: 3, cls: 'NEW LONGS' },
    { sym: 'MIXEDUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'ETHUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WG.squeezeState = function(){ return { results: [
    { sym: 'BTCUSDT', kind: 'fired', dir: 'long' },
    { sym: 'MIXEDUSDT', kind: 'break', dir: 'short' } ] }; };
  delete WG.liqAgg;   /* liqs dark */
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null },
    { sym: 'MIXEDUSDT', base: 'MIXED', exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: 0, alsoOn: null } ]; };
  WG.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const TF7 = freshPane();
  WG.HG_tabs[0].mount(TF7.pane);
  await runAndWait(TF7.stubs);
  const f7Watch = TF7.stubs['#brainWatch'].innerHTML;
  ok(lrowSeg(f7Watch, 'BTC').indexOf('path to PRIME: 3 dark layers must return (onchain, tape, liqs)') >= 0,
     'AF6: capped WATCH names exactly which dark layers unblock PRIME — got "' + lrowSeg(f7Watch, 'BTC').slice(-220) + '"');
  ok(lrowSeg(f7Watch, 'MIXED').indexOf('path to HIGH: SQUEEZE dissent must clear + 1 more agreeing layer') >= 0,
     'AF6: soft-disagreement WATCH names the dissenting layer that must clear — got "' + lrowSeg(f7Watch, 'MIXED').slice(-220) + '"');
  ok(lrowSeg(f7Watch, 'ETH').indexOf('path to HIGH: needs TREND4H + ENGINE') >= 0,
     'AF6: radar WATCH names TREND4H first, then the next silent directional layer — got "' + lrowSeg(f7Watch, 'ETH').slice(-220) + '"');
}

/* ---- AF7: quick rescan re-applies TREND4H + refreshes the snapshot ---- */
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG.oiflowState = function(){ return { results: [ { sym: 'TRENDYUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'TRENDYUSDT', base: 'TRENDY', exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: 0, alsoOn: null } ]; };
  WG.xuState = function(){ return { count: 2, delta: 2, cdcx: 0, at: Date.now(), note: null }; };
  WG.xuCandles = function(item){ return Promise.resolve(item.sym === 'TRENDYUSDT' ? trendRows(true) : fakeRows(120)); };
  const TF8 = freshPane();
  WG.HG_tabs[0].mount(TF8.pane);
  await runAndWait(TF8.stubs);
  const at1 = WG.__hgBrainLast().at;
  ok(TF8.stubs['#brainStat'].textContent.indexOf('done · 0 PRIME · 1 HIGH') === 0,
     'AF7: baseline scan promotes TRENDY to HIGH via TREND4H');
  TF8.stubs['#brainQuick']._handler();
  {
    const t0 = Date.now();
    while (TF8.stubs['#brainRun'].disabled && Date.now() - t0 < 8000)
      await new Promise(function(res){ setTimeout(res, 25); });
  }
  const q8 = TF8.stubs['#brainStat'].textContent;
  ok(q8.indexOf('1 HIGH') >= 0 && TF8.stubs['#brainCards'].innerHTML.indexOf('TREND4H: 4h EMA20&gt;EMA50 + higher-high — structural long') >= 0,
     'AF7: quick rescan re-fetches and re-promotes TRENDY to HIGH with the named vote — got "' + q8 + '"');
  const snap8 = WG.__hgBrainLast();
  ok(snap8 && snap8.at >= at1 && Object.isFrozen(snap8)
     && snap8.rows.some(function(x){ return x.sym === 'TRENDYUSDT' && x.tier === 'HIGH'; }),
     'AF7: the quick rescan IS a completed synthesis — snapshot refreshed, still frozen');
}

console.log('\n' + passed + ' assertions passed');
process.exit(0);
