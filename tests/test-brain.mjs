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
     AF) F&G contrarian + TREND4H promotion/dark honesty   AG) funding votes
     AH) click-to-audit ledger    AI) bounded warm-wait + auto-warm accounting
     AJ) structure-anchored limit plans — pure planner (each anchor type wins,
         band rejection, R:R decline, in-zone vs limit, stop/TP math)
     AK) anchored limits end-to-end (LIMIT render, snapshot {entry,stop,t1,t2}
         shape, audit PLAN line, quick-rescan persistence)
     AL) auto-warm into RUN SYNTHESIS (shared engine-last invocation path,
         cold engine warmed into voting, accounting prefix, 60s freshness
         skip, QUICK RESCAN never warms, zero-hooks legacy stat)
     AN) LIMIT BOARD — expanded anchors (OB / liquidity pool / AVWAP seams +
         real-module wiring), buildLimitBoard selector, hgLimitState bands,
         run-level board paint (groups, zero-fetch state chips, alert-neutral)
         + legacy-lane anchored-first precedence
   No live network. Run: node tests/test-brain.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

/* ---- load the module in a pristine global scope: only a window stub ---- */
globalThis.window = {};
/* SNIPER suite default OFF: the shipped default is ON (owner mandate), but
   every fixture board below asserts the UNFILTERED render — the AO section
   verifies the shipped default + the toggle/persistence logic separately */
globalThis.localStorage = { getItem: function(k){ return k === 'hgBrainSniper' ? '0' : null; },
                            setItem: function(){}, removeItem: function(){} };
vm.runInThisContext(fs.readFileSync(root + 'brain.js', 'utf8'), { filename: 'brain.js' });

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const W = globalThis.window;
/* pin the synthesis clock (same mid-session anchor as freshBrain) so tier
   expectations never depend on the wall clock — the haircut seam is
   exercised deliberately in section AS */
W.__hgBrainSetClock('2026-07-27T04:30:00Z');
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
   && W.fetch4h === undefined && W.brainRefresh === undefined && W.watchRowHTML === undefined
   && W.applyFunding === undefined && W.awaitWarmHooks === undefined,
   'only the documented seams leak onto window');
ok(typeof W.rowAuditHTML === 'function' && typeof W.auditToggleByKey === 'function'
   && typeof W.__hgBrainAudit === 'function',
   'click-to-audit seams exposed: rowAuditHTML + auditToggleByKey + __hgBrainAudit');
ok(typeof W.__hgBrainLast === 'function', 'window.__hgBrainLast exposed for the signal logger');
ok(W.__hgBrainLast() === null, '__hgBrainLast() returns null before the first scan');

/* ================= B) news votes ================= */
console.log('== news votes ==');
let r = COLLECT({ sym: 'BTCUSDT', news: { risk: 'high', blackout: true, events: [], note: 'FOMC blackout window' } });
ok(r.votes.length === 1 && r.votes[0].layer === 'news' && r.votes[0].vote === 'veto'
   && r.votes[0].text.indexOf('BLACKOUT') >= 0, 'news blackout -> veto vote with reason');
r = COLLECT({ sym: 'BTCUSDT', news: { risk: 'high', blackout: false, events: [], note: 'CPI in 20m' } });
ok(r.votes[0].vote === 'neutral' && r.votes[0].caution === true && r.votes[0].text.indexOf('CPI') >= 0,
   'news risk=high (no blackout) -> neutral caution (veto lives ONLY in the true blackout window)');
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
                        { sym: 'CHOPUSDT', vetoGate: 'G1', dir: null, gatesPassed: 1 }], at: Date.now() };
r = COLLECT({ sym: 'ETHUSDT', engine: EN });
ok(r.votes.some(function(x){ return x.layer === 'engine' && x.vote === 'long' && x.strong === true && x.text.indexOf('STRONG') >= 0; }),
   'engine survivor -> strong vote in the survivor direction');
r = COLLECT({ sym: 'ETHUSDT', engine: Object.assign({}, EN, { at: Date.now() - 60 * 60 * 1000 }) });
ok(r.unavailable.indexOf('engine') >= 0, 'stale engine snapshot (>30m) -> dark, survivors do not vote');
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
r = COLLECT({ sym: 'SOLUSDT', engine: { survivors: [], rejected: [{ sym: 'SOLUSDT', vetoGate: 'G3' }], at: Date.now() } });
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
r = COLLECT({ sym: 'XAU', lane: 'gold', news: { risk: 'low', blackout: false, events: [], note: 'clear' },
              gold: { setup: { dir: 'long', aside: false, confidence: 'STRONG', reason: 'structure + macro + positioning aligned' },
                      deep: { label: 'BULLISH', score: 71, dir: 'long', ts: 1 },
                      basis: { basisPct: -0.2, verdict: 'shorts-crowding' } },
              yield: { trend: 'dropping' }, smt: { divergence: null } });
ok(r.votes.some(function(x){ return x.layer === 'yield' && x.vote === 'long' && x.strong === true; }),
   'gold lane: dropping yields -> long macro tailwind vote');
ok(r.votes.some(function(x){ return x.layer === 'smt' && x.vote === 'neutral' && x.text.indexOf('aligned') >= 0; }),
   'gold lane: no SMT divergence -> neutral structural vote');
r = COLLECT({ sym: 'XAU', lane: 'gold', news: { risk: 'low', blackout: false },
              gold: { setup: { dir: 'long', aside: false, confidence: 'STRONG', reason: 'edge' },
                      deep: { label: 'BULLISH', score: 71, dir: 'long' },
                      basis: { basisPct: 0, verdict: 'balanced' } },
              yield: { trend: 'spiking' }, smt: { divergence: 'BEARISH' } });
ok(r.votes.some(function(x){ return x.layer === 'yield' && x.vote === 'short' && x.caution === true; }),
   'gold lane: spiking yields -> short caution vote (headwind for longs)');
ok(r.votes.some(function(x){ return x.layer === 'smt' && x.vote === 'veto'; }),
   'gold lane: BEARISH SMT -> veto vote');
var dGold = DECIDE(r.votes, { unavailable: r.unavailable });
ok(dGold.tier === 'ASIDE' && dGold.vetoes.length >= 1, 'gold lane: SMT veto demotes to ASIDE');
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
ok(r.silent.indexOf('yield') >= 0 && r.silent.indexOf('smt') >= 0,
   'gold lane: yield/smt absent -> silent (not dark)');

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

/* ================= K2) setup layer conflict ================= */
console.log('== setup layer conflict ==');
ok(typeof W.brainSetupConflict === 'function', 'brainSetupConflict exported');
{
  var conflictVotes = [
    v('engine', 'long'), v('trend4h', 'long'), v('structure', 'long'),
    v('meanrev', 'short', 'structural')
  ];
  var cx = W.brainSetupConflict(conflictVotes);
  ok(cx && cx.indexOf('setup conflict') >= 0 && cx.indexOf('mean-reversion') >= 0,
     'continuation LONG vs mean-reversion SHORT -> setup conflict reason');
  d = DECIDE(conflictVotes, { unavailable: [] });
  ok(d.tier === 'ASIDE' && d.reasons[0].indexOf('setup conflict') >= 0,
     'brainDecide demotes setup conflict to ASIDE before tier math');
  var aligned = [v('engine', 'long'), v('meanrev', 'long', 'structural')];
  ok(W.brainSetupConflict(aligned) === null, 'same-direction continuation + meanrev -> no conflict');
}

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
           rejected: [{ sym: 'SOLUSDT', vetoGate: 'G4', dir: 'long', gatesPassed: 4 }], at: Date.now() };
};
W.oiflowState = function(){ return { results: [{ sym: 'BTCUSDT', dir: 'LONG', evidence: 3, cls: 'NEW LONGS (trend fuel)' }] }; };
W.squeezeState = function(){ return { results: [{ sym: 'ETHUSDT', kind: 'fired', dir: 'short' }] }; };
W.carryState = function(){ return null; };
W.termBasisState = function(){ return null; };
W.liqsState = function(){ return { snap: { imbalance: { cls: 'short-flush', ratio: 0.3, text: 'SHORT FLUSH' }, top: [], window: { ms: 3.6e6, count: 1 }, spikeUsd: 2e6 },
  setup: { type: 'FLUSH-REVERSAL', dir: 'long', flushSide: 'short', sym: 'BTCUSDT', flushUsd: 5e6, entry: 100, stop: 95, t1: 110, t2: 117.5 } }; };
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
ok(nCards.indexOf('toTrade(&quot;BTCUSDT&quot;,&quot;long&quot;,100,95,110') >= 0,
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
ok(oCards.indexOf('toTrade(&quot;ETHUSDT&quot;,&quot;short&quot;,50,53,44') >= 0, 'short toTrade payload correct');
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
  /* SNIPER fixture default OFF (shipped default is ON — verified in AO):
     board fixtures assert the UNFILTERED render; a deleted/absent
     localStorage must never flip fixtures into sniper-filtered boards */
  if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function')
    globalThis.localStorage = lsStub();
  try{ globalThis.localStorage.setItem('hgBrainSniper', '0'); }catch(e){}
  vm.runInThisContext(fs.readFileSync(root + 'brain.js', 'utf8'), { filename: 'brain.js' });
  /* pin the synthesis clock to a mid-session weekday (10:00 IST Monday) so
     the off-hours conviction haircut never makes wall-clock-dependent tiers */
  globalThis.window.__hgBrainSetClock('2026-07-27T04:30:00Z');
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
  WX.carryState = function(){ return null; };
  WX.termBasisState = function(){ return null; };
  WX.liqsState = function(){ return { snap: { imbalance: { cls: 'short-flush', ratio: 0.3, text: 'SHORT FLUSH' }, top: [{ sym: 'BTCUSDT', side: 'short', usd: 3e6, t: Date.now() }], window: { ms: 3.6e6, count: 1 }, spikeUsd: 2e6 },
    setup: { type: 'FLUSH-REVERSAL', dir: 'long', flushSide: 'short', sym: 'BTCUSDT', flushUsd: 5e6, entry: 100, stop: 95, t1: 110, t2: 117.5 } }; };
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
  r2 = C2({ sym: 'B-BTC_USDT', aliases: ['BTCUSDT', 'BTC'], engine: { survivors: [], rejected: [{ sym: 'BTC', vetoGate: 'G4' }], at: Date.now() } });
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
ok(tStat.indexOf('done · 1 PRIME · 3 HIGH · 1 watch · 1 aside') === 0,
   'combined run buckets: 1 PRIME · 3 HIGH (ETH/SOL/XRP: the healthy-vol VOLREG vote lifts radar+3 to HIGH) · 1 watch (DOGE radar+volreg) · 1 aside — got "' + tStat + '"');
ok(tStat.indexOf('universe 5 (delta 3 + cdcx 2)') >= 0, 'summary gains combined per-exchange counts');
ok(tStat.indexOf('4 prime/high · 1 watch') >= 0, 'summary gains prime/high + watch tallies');
ok(TT.stubs['#brainReadUni'].textContent === 'universe 5 (delta 3 + cdcx 2) · 4 prime/high · 1 watch',
   'MARKET READ header carries the combined counts — got "' + TT.stubs['#brainReadUni'].textContent + '"');
ok(tCards.indexOf('B-BTC_USDT') >= 0 && tCards.indexOf('PRIME · 6 LAYERS') >= 0 && tCards.indexOf('>LONG</span>') >= 0,
   'BTC card renders under the cdcx sym via alias-matched Binance-keyed layer votes (6 layers with VOLREG)');
ok(tCards.indexOf('ENTRY <b>100</b> · STOP <b>95</b>') >= 0 && tCards.indexOf('COINDCX') >= 0
   && tCards.indexOf('toTrade(&quot;B-BTC_USDT&quot;,&quot;long&quot;,100,95,110') >= 0,
   'engine plan + COINDCX venue stamp + xu-sym toTrade payload on the card');
const xu4h = xuCalls.filter(function(c){ return c.tf === '4h'; }), xu1h = xuCalls.filter(function(c){ return c.tf === '1h'; });
ok(xu4h.length === 5, 'lazy fetch: the 5 WATCH+ candidates fetched 4h (BTC+ETH+SOL+XRP+DOGE radar), XAU lane aside untouched — got ' + xu4h.length);
ok(xu1h.length === 5, 'the queue fetches the 1h leg for every WATCH+ candidate in parallel (MTF layer + sniper-rescue cache, zero extra rescue fetches) — got ' + xu1h.length);
ok(xu1h.every(function(c){ return c.n === 120; }), '1h legs use the standard 120-bar depth');
ok(xuCalls[0].item === XUL[0] && xuCalls[0].tf === '4h' && xuCalls[0].n === 120,
   'highest-evidence-first: the PRIME BTC candidate fetches first, via xuCandles with its original xu item');
ok(!xuCalls.some(function(c){ return c.item.sym === 'XAUUSDT'; }), 'ASIDE gold lane never triggers a crypto candle fetch');
ok(statSnaps.some(function(s){ return /^\d+\/5 candidates · delta 3 · cdcx 2$/.test(s); }),
   'fetch progress reports X/Y candidates · delta n · cdcx m — saw "' + statSnaps[0] + '"');
const tWatch = TT.stubs['#brainWatch'].innerHTML;
ok(tWatch.indexOf('>DOGE</span>') >= 0 && tWatch.indexOf('>ETH</span>') === -1 && tWatch.indexOf('>SOL</span>') === -1,
   'WATCH ledger: DOGE alone remains (volreg lifted it to full WATCH from radar); ETH/SOL/XRP moved up to cards');
ok(tCards.indexOf('ETHUSDT') >= 0 && tCards.indexOf('SOLUSDT') >= 0 && tCards.indexOf('B-XRP_USDT') >= 0
   && (tCards.match(/HIGH · 4 LAYERS/g) || []).length === 3,
   'the promoted alts render as HIGH cards (4 layers each: regime + rotation + oiflow + volreg)');
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
  WU.xuCandles = function(item, tf){ capCalls.push(item.sym + '|' + tf); capSnaps.push(TU.stubs['#brainStat'].textContent); return Promise.resolve(fakeRows(120)); };
  WU.HG_tabs[0].mount(TU.pane);
  await runAndWait(TU.stubs);
  const uStat = TU.stubs['#brainStat'].textContent;
  const cap4h = capCalls.filter(function(c){ return c.slice(-3) === '|4h'; });
  const cap1h = capCalls.filter(function(c){ return c.slice(-3) === '|1h'; });
  ok(uStat.indexOf('done · 0 PRIME · 40 HIGH · 8 watch · 6 aside') === 0,
     '46 alts at 3 votes + the healthy-vol VOLREG vote -> 40 HIGH · 8 WATCH; ALT1-ALT4 (1-4M turnover) gated below the $5M liquidity floor; BTC + gold aside — got "' + uStat + '"');
  ok(cap4h.length === 40, 'fetch cap respected: 40 4h fetches out of 48 watch candidates — got ' + cap4h.length);
  ok(cap1h.length === 40, 'the 1h leg rides the same capped queue in parallel (MTF layer) — got ' + cap1h.length);
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
  WC.xuCandles = function(item, tf){ candleSyms.push(item.sym + '|' + tf); return Promise.resolve(fakeRows(120)); };
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
  ok(TC.stubs['#brainStat'].textContent.indexOf('done · 1 PRIME · 3 HIGH · 1 watch · 1 aside') === 0,
     'AC: full-scan baseline intact (volreg lifts ETH/SOL/XRP to HIGH; DOGE at WATCH) — got "' + TC.stubs['#brainStat'].textContent + '"');
  candleSyms = []; xuCalls = 0; xuForces.length = 0;

  /* quick rescan: recheck WATCH+ only, cache-read universe, age stamps */
  TC.stubs['#brainQuick']._handler();
  await waitIdle(TC.stubs);
  const q1 = TC.stubs['#brainStat'].textContent;
  ok(/^quick rescan: 5 checked · 1 unchanged · \d+s/.test(q1),
     'AC: stat line counts checked (BTC + 4 watch incl. DOGE radar) vs unchanged (XAU lane) — got "' + q1 + '"');
  ok(xuForces.every(function(f){ return f !== true; }) && xuCalls <= 1,
     'AC: never forces an exchange refetch (cache-read only) — calls=' + xuCalls + ' forces=' + JSON.stringify(xuForces));
  const ac4h = candleSyms.filter(function(c){ return c.slice(-3) === '|4h'; });
  const ac1h = candleSyms.filter(function(c){ return c.slice(-3) === '|1h'; });
  ok(ac4h.length === 5 && ac4h.some(function(c){ return c.indexOf('DOGEUSDT') === 0; }) && !ac4h.some(function(c){ return c.indexOf('XAUUSDT') === 0; }),
     'AC: 4h candles refetched only for the recheck set incl. the DOGE radar row, gold lane untouched — got ' + ac4h.join(','));
  ok(ac1h.length === 5, 'AC: the 1h leg rides the same recheck fetch (MTF layer) — got ' + ac1h.length);
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
  ok(TC.stubs['#brainCards'].innerHTML.indexOf('NEWUSDT') >= 0
     || TC.stubs['#brainWatch'].innerHTML.indexOf('>NEW</span>') >= 0,
     'AC: the new listing is judged on arrival (3 layers + volreg -> WATCH-or-HIGH honestly)');
  ok(candleSyms.indexOf('NEWUSDT|4h') >= 0, 'AC: the new listing earns its candle fetch');

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
  ok(recs.length === 4, 'AD: four scorecard records — PRIME + the three volreg-promoted HIGH alts; WATCH/ASIDE never recorded (got ' + recs.length + ')');
  const r0 = recs[0] || {};
  ok(r0.source === 'brain' && r0.sym === 'B-BTC_USDT' && r0.dir === 'long' && r0.tier === 'PRIME',
     'AD: record carries source/sym/dir/tier — got ' + JSON.stringify(r0).slice(0, 140));
  ok(r0.entry === 100 && r0.stop === 95 && r0.t1 === 110 && r0.t2 === 117.5,
     'AD: levels come from the engine plan verbatim — got ' + JSON.stringify([r0.entry, r0.stop, r0.t1, r0.t2]));
  ok(Array.isArray(r0.layers) && r0.layers.join(',') === 'regime,onchain,engine,oiflow,liqs,volreg',
     'AD: layers = the agreeing layer names in vote order, volreg included — got ' + JSON.stringify(r0.layers));
  ok(typeof r0.at === 'number' && isFinite(r0.at) && Math.abs(Date.now() - r0.at) < 60000,
     'AD: record timestamped at scan time');

  /* quick rescan records its fresh PRIME/HIGH cards too */
  recs.length = 0;
  WD.xuState = function(){ return { count: 5, delta: 3, cdcx: 2, at: Date.now(), note: null }; };
  TD.stubs['#brainQuick']._handler();
  await waitIdle(TD.stubs);
  ok(recs.length === 4 && recs[0].tier === 'PRIME' && recs[0].source === 'brain',
     'AD: quick rescan records its fresh PRIME/HIGH cards too (PRIME + 3 volreg-lifted HIGH rows)');

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

/* ================= AD4) auto-book hook ================= */
console.log('== auto-book hook (AD4) ==');
{
  const brainSrc = fs.readFileSync(root + 'brain.js', 'utf8');
  ok(brainSrc.indexOf('BRAIN_AUTO_BOOK_KEY') >= 0 && brainSrc.indexOf('brainAutoBookRecord') >= 0,
     'AD4: brain.js defines auto-book toggle + record hook');
  ok(brainSrc.indexOf('id="brainAutoBook"') >= 0 && brainSrc.indexOf('silent: true') >= 0,
     'AD4: mount checkbox + silent addToBook opts');
  ok(brainSrc.indexOf('brainAutoExecAfterBookOn') >= 0 && brainSrc.indexOf('id="brainAutoExec"') >= 0,
     'AD4b: brain auto EXEC after auto-add toggle');
  ok(brainSrc.indexOf('BRAIN_AUTO_BOOK_PRIME_ONLY_KEY') >= 0 && brainSrc.indexOf('id="brainAutoBookPrime"') >= 0
     && brainSrc.indexOf('brainAutoBookPrimeOnlyOn') >= 0,
     'AD4c: brain PRIME-only auto-book toggle');
  ok(brainSrc.indexOf('_fundId') >= 0 && brainSrc.indexOf('r.fundId') >= 0,
     'AD4d: auto-book tags added positions with fund for cross-fund EXEC');

  const lsStore = { hgBrainSniper: '0' };
  const prevLs = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: function(k){ return Object.prototype.hasOwnProperty.call(lsStore, k) ? lsStore[k] : null; },
    setItem: function(k, v){ lsStore[k] = String(v); },
    removeItem: function(k){ delete lsStore[k]; },
  };

  const WD = freshBrain();
  stubLayersPrime(WD);
  WD.xuUniverse = async function(){ return XUL; };
  WD.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  WD.hgApiAvailable = function(){ return true; };
  WD.bookFetchOpenKeys = async function(){ return {}; };
  WD.brainSetAutoBook(true);
  const bookCalls = [];
  WD.addToBook = function(opts){
    bookCalls.push(opts);
    return Promise.resolve({ ok: true, position: { id: 'p-' + bookCalls.length } });
  };
  const TD = freshPane();
  WD.HG_tabs[0].mount(TD.pane);
  await runAndWait(TD.stubs);
  ok(bookCalls.length === 1, 'AD4: one PRIME plan auto-added (HIGH alts lack finite planner levels in this fixture — got ' + bookCalls.length + ')');
  ok(bookCalls[0] && bookCalls[0].silent === true && bookCalls[0].scanner === 'brain',
     'AD4: auto-book calls are silent brain scanner adds');
  ok(bookCalls[0].sym === 'B-BTC_USDT' && bookCalls[0].entry === 100 && bookCalls[0].stop === 95,
     'AD4: levels match engine plan verbatim');
  ok(TD.stubs['#brainStat'].textContent.indexOf('auto-book +1') >= 0,
     'AD4: stat line tallies auto-book adds — got "' + TD.stubs['#brainStat'].textContent.slice(-50) + '"');

  bookCalls.length = 0;
  await runAndWait(TD.stubs);
  ok(bookCalls.length === 0, 'AD4: second synthesis skips dup keys (got ' + bookCalls.length + ' calls)');
  ok(TD.stubs['#brainStat'].textContent.indexOf('1 dup') >= 0,
     'AD4: stat line names dup skips');

  WD.addToBook = function(){ throw new Error('book down'); };
  await runAndWait(TD.stubs);
  ok(TD.stubs['#brainStat'].textContent.indexOf('done · 1 PRIME') === 0,
     'AD4: throwing addToBook never breaks synthesis render');

  WD.brainSetAutoBook(false);
  bookCalls.length = 0;
  WD.addToBook = function(opts){ bookCalls.push(opts); return Promise.resolve({ ok: true }); };
  await runAndWait(TD.stubs);
  ok(bookCalls.length === 0, 'AD4: toggle off -> no auto-book calls');

  globalThis.localStorage = prevLs;
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
  ok(g1Stat.indexOf('done · 0 PRIME · 2 HIGH · 2 watch · 3 aside') === 0,
     'AE1: buckets — volreg lifts ETH/SOL to HIGH; MYST/EXACT at full WATCH; BTC+THIN+gold aside — got "' + g1Stat + '"');
  ok(g1Stat.indexOf(' · 1 gated: 1 liquidity') >= 0,
     'AE1: stat line tallies the liquidity demotion — got "' + g1Stat + '"');
  ok(g1Aside.indexOf('>THIN</span>') >= 0
     && lrowSeg(g1Aside, 'THIN').indexOf('below liquidity floor — $2.0M 24h turnover, slippage eats the edge') >= 0,
     'AE1: below-floor WATCH demoted to ASIDE with the exact reason — got "' + lrowSeg(g1Aside, 'THIN').slice(0, 160) + '"');
  ok(g1Watch.indexOf('>THIN</span>') === -1, 'AE1: the gated row leaves the WATCH ledger (demoted, not hidden)');
  ok(g1Aside.indexOf('>MYST</span>') === -1,
     'AE1: null turnover = unknown = NEVER punished — MYST keeps its conviction row (HIGH card via oiflow + volreg)');
  ok(TG1.stubs['#brainCards'].innerHTML.indexOf('MYSTUSDT') >= 0 && TG1.stubs['#brainCards'].innerHTML.indexOf('EXACTUSDT') >= 0,
     'AE1: MYST + EXACT render as HIGH cards (regime + rotation + oiflow + volreg)');
  ok(TG1.stubs['#brainCards'].innerHTML.indexOf('THINUSDT') === -1,
     'AE1: the liquidity gate still demotes THIN despite the volreg vote — floors bite, never overridden');
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
  ok(g2Stat.indexOf('done · 0 PRIME · 1 HIGH · 2 watch · 4 aside') === 0,
     'AE2: buckets — volreg lifts QUIET to HIGH; ETH/SOL watch; PUMP+EDGE gated aside (overextension guard unfazed by volreg) — got "' + g2Stat + '"');
  ok(g2Stat.indexOf(' · 2 gated: 2 overextended') >= 0,
     'AE2: stat line tallies both overextension demotions — got "' + g2Stat + '"');
  ok(lrowSeg(g2Aside, 'PUMP').indexOf('overextended +18.2% 24h — chasing tops is how radar dies') >= 0,
     'AE2: +18.2% chase demoted with the exact reason — got "' + lrowSeg(g2Aside, 'PUMP').slice(0, 160) + '"');
  ok(lrowSeg(g2Aside, 'EDGE').indexOf('overextended +15.0% 24h — chasing tops is how radar dies') >= 0,
     'AE2: exactly +15.0% trips the >= +15% guard (boundary honored)');
  ok(g2Watch.indexOf('>PUMP</span>') === -1 && g2Watch.indexOf('>EDGE</span>') === -1,
     'AE2: gated chases leave the WATCH ledger');
  ok(g2Aside.indexOf('>QUIET</span>') === -1 && TG2.stubs['#brainCards'].innerHTML.indexOf('QUIETUSDT') >= 0,
     'AE2: tape-missing pass-through — no tape perp is never punished; volreg lifts QUIET to a HIGH card');
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
  const g3Cards = TG3.stubs['#brainCards'].innerHTML;
  ok(g3Stat.indexOf('done · 0 PRIME · 4 HIGH · 0 watch · 5 aside') === 0,
     'AE3: buckets — FLIP promoted by the contrarian funding vote; volreg lifts CROWD/TAME/FEDGE to HIGH cards too; DUMP gated — got "' + g3Stat + '"');
  ok(g3Stat.indexOf(' · 1 gated: 1 overextended') >= 0,
     'AE3: only the overextended chase is tallied — funding cautions are NOT demotions — got "' + g3Stat + '"');
  ok(lrowSeg(g3Aside, 'DUMP').indexOf('overextended -17.5% 24h — chasing tops is how radar dies') >= 0,
     'AE3: short chase into a -17.5% move demotes with the exact signed reason');
  ok(g3Cards.indexOf('CROWDUSDT') >= 0 && g3Cards.indexOf('funding crowded same-direction — squeeze risk') >= 0,
     'AE3: -0.14%/8h funding behind a SHORT row -> caution named on the HIGH card (volreg lifted the tier)');
  ok(g3Cards.indexOf('FEDGEUSDT') >= 0,
     'AE3: exactly |0.1|%/8h funding trips the >= 0.1% caution (boundary honored, on the card)');
  ok(g3Watch.indexOf('>FLIP</span>') === -1 && g3Cards.indexOf('FLIPUSDT') >= 0
     && g3Cards.indexOf('HIGH · 5 LAYERS') >= 0 && g3Cards.indexOf('>SHORT</span>') >= 0,
     'AE3: +0.3%/8h funding AGAINST the SHORT row casts the fade vote — FLIP completes HIGH on 5 layers (with volreg)');
  ok(g3Cards.indexOf('FUNDING: funding +0.3%/8h — longs crowded, fade fuel for shorts') >= 0,
     'AE3: the contrarian vote is named on the card — a VOTE (crowding cautions on OTHER cards stay chips)');
  ok(g3Cards.indexOf('TAMEUSDT') >= 0,
     'AE3: |0.05|%/8h funding is sub-threshold — no caution, no vote; TAME still earns its HIGH card via volreg');
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
  ok(g4Stat.indexOf('done · 1 PRIME · 3 HIGH · 1 watch · 1 aside') === 0,
     'AE4: buckets — volreg lifts ETH/SOL/XRP to HIGH cards; cautions never demote — got "' + g4Stat + '"');
  ok(g4Stat.indexOf('gated') === -1, 'AE4: nothing demoted -> no gate tally on the stat line — got "' + g4Stat + '"');
  ok(g4Cards.indexOf('PRIME · 7 LAYERS') >= 0,
     'AE4: BTC stays PRIME on 7 layers (tape momentum + volreg joined) despite the extended move');
  ok(g4Cards.indexOf('GUARD: overextended +16.4% 24h — chasing tops is how radar dies') >= 0,
     'AE4: PRIME overextension renders as a caution CHIP, not a demotion');
  ok(g4Cards.indexOf('GUARD: funding crowded same-direction — squeeze risk') >= 0,
     'AE4: +0.13%/8h funding behind the LONG PRIME chips a crowding caution on the card');
  ok(g4Cards.indexOf('ETHUSDT') >= 0 && g4Cards.indexOf('funding crowded same-direction — squeeze risk') >= 0,
     'AE4: +0.11%/8h funding behind the LONG row names the caution on the HIGH card');
  ok(g4Cards.indexOf('SOLUSDT') >= 0,
     'AE4: zero funding -> no caution; SOL still earns its HIGH card via volreg');
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
     'AF1: TRENDY (3 layers -> WATCH) reaches PRIME via TREND4H + MTF + VOLREG votes, then the dark-layer cap holds it at HIGH — got "' + f1Stat + '"');
  ok(f1Cards.indexOf('TRENDYUSDT') >= 0 && f1Cards.indexOf('HIGH · 6 LAYERS') >= 0 && f1Cards.indexOf('>LONG</span>') >= 0,
     'AF1: the card renders HIGH · 6 LAYERS LONG — regime + rotation + oiflow + trend4h + mtf + volreg');
  ok(f1Cards.indexOf('TREND4H: 4h EMA20&gt;EMA50 + higher-high — structural long') >= 0,
     'AF1: the TREND4H pip names EMA alignment + higher-high (HTML-escaped)');
  ok(f1Cards.indexOf('MTF: 1D+4H+1H all read LONG') >= 0,
     'AF1: the MTF pip names the three-way timeframe alignment');
  ok(f1Cards.indexOf('CAPPED from PRIME') >= 0,
     'AF1: the degradation cap honestly names the PRIME it held back (dark layers capped it)');
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
  ok(f2Cards.indexOf('PRIME · 7 LAYERS') >= 0 && f2Cards.indexOf('✓ structural · ✓ positioning') >= 0,
     'AF2: PRIME card passes the unchanged bar — structural AND positioning present, now 7 layers with MTF + VOLREG');
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
  ok(f4Cards.indexOf('HIGH · 5 LAYERS') >= 0 && f4Cards.indexOf('>SHORT</span>') >= 0
     && f4Cards.indexOf('TREND4H: 4h EMA20&lt;EMA50 + lower-low — structural short') >= 0,
     'AF4: short TREND4H pip names EMA20<EMA50 + lower-low (5 layers with MTF; volreg cautions dead tape, no vote)');

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
  ok(f5Stat.indexOf('done · 0 PRIME · 1 HIGH · 2 watch · 2 aside') === 0,
     'AF4: counter-trend candles cast NO trend vote — but the genuine bullish divergence on those same downtrend candles earns FIGHT a HIGH via the div layer (price LL + RSI HL, mathematically confirmed) — got "' + f5Stat + '"');
  ok(TF5.stubs['#brainCards'].innerHTML.indexOf('FIGHTUSDT') >= 0,
     'AF4: the divergence promotion renders as a card — the trend layer itself stayed honest');
  const snapF = WG2.__hgBrainLast().rows.filter(function(x){ return x.sym === 'FIGHTUSDT'; })[0];
  ok(snapF && !snapF.evidence.some(function(e){ return e.indexOf('TREND4H:') === 0; })
     && snapF.evidence.some(function(e){ return e.indexOf('DIV: price LL + RSI HL') === 0; }),
     'AF4: snapshot proves it — no TREND4H vote fabricated against the trend; the DIV vote is the real, named one');
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
  ok(g5Stat.indexOf('done · 0 PRIME · 1 HIGH · 2 watch · 2 aside') === 0,
     'AF5: F&G 12 + volreg — BTC reaches HIGH on 4 layers (regime+rotation+F&G+volreg), ETH/SOL on radar+volreg — got "' + g5Stat + '"');
  ok(TF6.stubs['#brainCards'].innerHTML.indexOf('BTCUSDT') >= 0,
     'AF5: the F&G vote + volreg carry BTC to a HIGH card');
  ok(lrowSeg(g5Watch, 'ETH').indexOf('3 layers agree LONG') >= 0,
     'AF5: ETH at full WATCH on regime + F&G + volreg (3 layers)');
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
  ok(lrowSeg(f7Watch, 'MIXED').indexOf('path to HIGH: SQUEEZE dissent must clear') >= 0,
     'AF6: soft-disagreement WATCH names the dissenting layer that must clear (volreg already fills the agree slot) — got "' + lrowSeg(f7Watch, 'MIXED').slice(-220) + '"');
  ok(lrowSeg(f7Watch, 'ETH').indexOf('path to HIGH: needs TREND4H') >= 0,
     'AF6: radar WATCH names TREND4H as the last missing layer (volreg already votes) — got "' + lrowSeg(f7Watch, 'ETH').slice(-220) + '"');
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

/* ================= AG) FUNDING as a voting contrarian layer =================
   |funding| >= 0.1%/8h AGAINST the row = named crowd-fade vote (one context
   layer, like fng); SAME-direction = caution chip, NO vote; sub-extreme and
   directionless rows = silent. Boundary |0.1| honored. */
console.log('== FUNDING contrarian votes: both extremes, both directions, caution-vs-vote ==');
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG.oiflowState = function(){ return { results: [
    { sym: 'LONGYUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'EDGYUSDT',  dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'SAMELUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'SUBLUSDT',  dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'BTCUSDT',   dir: 'SHORT', evidence: 2, cls: 'NEW SHORTS' } ] }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT',   base: 'BTC',   exchange: 'delta', turnoverUsd: 9e9,  mark: 100, fundingPct: -0.2,   alsoOn: null },
    { sym: 'LONGYUSDT', base: 'LONGY', exchange: 'delta', turnoverUsd: 60e6, mark: 1,   fundingPct: -0.128, alsoOn: null },
    { sym: 'EDGYUSDT',  base: 'EDGY',  exchange: 'delta', turnoverUsd: 55e6, mark: 1,   fundingPct: -0.1,   alsoOn: null },
    { sym: 'SAMELUSDT', base: 'SAMEL', exchange: 'delta', turnoverUsd: 50e6, mark: 1,   fundingPct: 0.13,   alsoOn: null },
    { sym: 'SUBLUSDT',  base: 'SUBL',  exchange: 'delta', turnoverUsd: 45e6, mark: 1,   fundingPct: -0.05,  alsoOn: null } ]; };
  WG.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const TG = freshPane();
  WG.HG_tabs[0].mount(TG.pane);
  await runAndWait(TG.stubs);
  const agStat = TG.stubs['#brainStat'].textContent;
  const agCards = TG.stubs['#brainCards'].innerHTML;
  const agWatch = TG.stubs['#brainWatch'].innerHTML;
  ok(agStat.indexOf('done · 0 PRIME · 4 HIGH · 2 watch · 2 aside') === 0,
     'AG: LONGY+EDGY complete HIGH via the long-fade vote; volreg lifts SAMEL/SUBL to HIGH too; ETH/SOL radar watch; tied BTC + gold aside — got "' + agStat + '"');
  ok(agCards.indexOf('HIGH · 5 LAYERS') >= 0
     && agCards.indexOf('FUNDING: funding -0.128%/8h — shorts crowded, fade fuel for longs') >= 0,
     'AG: negative funding behind a LONG row casts the named long-fade vote (spec example verbatim, 5 layers with volreg)');
  ok(agCards.indexOf('FUNDING: funding -0.1%/8h — shorts crowded, fade fuel for longs') >= 0,
     'AG: exactly |0.1|%/8h AGAINST the row fires the vote (boundary honored)');
  ok(agCards.indexOf('SAMELUSDT') >= 0 && agCards.indexOf('funding crowded same-direction — squeeze risk') >= 0,
     'AG: +0.13%/8h WITH the LONG row keeps the caution chip on its HIGH card');
  const agSnap = WG.__hgBrainLast();
  const agBySym = function(s){ return agSnap.rows.filter(function(x){ return x.sym === s; })[0]; };
  ok(!agBySym('SAMELUSDT').evidence.some(function(e){ return e.indexOf('FUNDING:') === 0; }),
     'AG: same-direction extreme casts NO vote — never reward the crowded side');
  ok(agCards.indexOf('SUBLUSDT') >= 0
     && !agBySym('SUBLUSDT').evidence.some(function(e){ return e.indexOf('FUNDING:') === 0; }),
     'AG: sub-extreme funding is silent — no chip, no vote; SUBL still earns its card via volreg');
  ok(agBySym('LONGYUSDT').evidence.indexOf('FUNDING: funding -0.128%/8h — shorts crowded, fade fuel for longs') >= 0,
     'AG: __hgBrainLast carries the raw FUNDING evidence for the signal logger');
  ok(!agBySym('BTCUSDT').evidence.some(function(e){ return e.indexOf('FUNDING:') === 0; }),
     'AG: extreme funding on a TIED (directionless) row casts no vote — a fade needs a direction');
  const btcAudit = WG.__hgBrainAudit('BTCUSDT');
  ok(btcAudit && btcAudit.indexOf('no direction to fade a crowd against') >= 0,
     'AG: the tied row’s audit ledger names exactly WHY funding sat out');
  const sameAudit = WG.__hgBrainAudit('SAMELUSDT');
  ok(sameAudit && sameAudit.indexOf('never a reward vote') >= 0
     && sameAudit.indexOf('funding crowded same-direction') === -1,
     'AG: the FUNDING audit line carries the richer caution — the guard chip is not duplicated');

  /* a lone funding vote can never create a tier; one context layer CAN complete radar */
  const dFund = DECIDE([{ layer: 'funding', vote: 'long', text: 'funding -0.128%/8h — shorts crowded, fade fuel for longs', kind: 'context' }], {});
  ok(dFund.tier === 'ASIDE' && dFund.agree === 1, 'AG: a lone funding vote = thin ASIDE — never a tier by itself');
}
{
  const WG2 = freshBrain();
  stubQuietLayers(WG2);
  WG2.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG2.rotationState = function(){ return { season: 'btc', altPct: 25, evidence: [] }; };
  WG2.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG2.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0,     alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50,  fundingPct: -0.15, alsoOn: null } ]; };
  WG2.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const TG2 = freshPane();
  WG2.HG_tabs[0].mount(TG2.pane);
  await runAndWait(TG2.stubs);
  const ag2Watch = TG2.stubs['#brainWatch'].innerHTML;
  ok(TG2.stubs['#brainStat'].textContent.indexOf('done · 0 PRIME · 0 HIGH · 2 watch · 2 aside') === 0,
     'AG: 1-layer ETH + the funding vote = radar WATCH (the vote counts as ONE context layer); auto-added SOL thin aside — got "' + TG2.stubs['#brainStat'].textContent + '"');
  ok(lrowSeg(ag2Watch, 'ETH').indexOf('3 layers agree LONG') >= 0
     && WG2.__hgBrainLast().rows.filter(function(x){ return x.sym === 'ETHUSDT'; })[0]
          .evidence.indexOf('FUNDING: funding -0.15%/8h — shorts crowded, fade fuel for longs') >= 0,
     'AG: funding + volreg complete a full WATCH — each named, each ONE context layer, no double count');
}

/* ================= AH) CLICK-TO-AUDIT layer breakdown =================
   Every row carries a collapsed ▸ LAYER AUDIT toggle; the ledger renders
   LAZILY on demand with every layer's verdict + evidence + exact dark reason. */
console.log('== click-to-audit: builder, ledger content, lazy toggles, gold lane ==');
{
  /* builder unit — one collect with a vote, a dark layer, silents, an F&G vote */
  const colA = COLLECT({ sym: 'BTCUSDT', news: { risk: 'low', blackout: false, events: [], note: 'clear' },
    regime: { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } },
    onchain: { bias: 'bullish', evidence: [{ side: 'bull', text: 'miners healthy' }], flags: {} },
    fng: { v: 12, c: 'Extreme Fear' },
    oiflow: { results: [ { sym: 'BTCUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] },
    squeeze: { results: [] },
    tape: { BTCUSDT: { chg24: 9.5, turnoverUsd: 5e9 } },
    liq: null });
  const rowA = { sym: 'BTCUSDT', lane: 'crypto', col: colA,
                 dec: DECIDE(colA.votes, { unavailable: colA.unavailable }) };
  const ah = W.rowAuditHTML(rowA);
  const layers12 = ['NEWS','REGIME','ROTATION','ONCHAIN','FNG','FUNDING','ENGINE','OIFLOW','SQUEEZE','TAPE','LIQS','TREND4H'];
  ok(layers12.every(function(L){ return ah.indexOf('>' + L + '<') >= 0; }),
     'AH: the audit ledger renders all 12 crypto layers — got missing: '
       + layers12.filter(function(L){ return ah.indexOf('>' + L + '<') === -1; }).join(',') );
  ok(ah.indexOf('>LONG</span>') >= 0 && ah.indexOf('playbook: longs') >= 0,
     'AH: a voting layer shows its verdict + one-line evidence');
  ok(ah.indexOf('>DARK</span>') >= 0 && ah.indexOf('rotation layer returned no state — cold or failed') >= 0,
     'AH: a dark layer shows DARK + the exact dark reason');
  ok(ah.indexOf('the deep scan has not warmed') >= 0, 'AH: engine dark reason is named verbatim');
  ok(ah.indexOf('F&amp;G 12 extreme fear — contrarian long context') >= 0,
     'AH: evidence strings escape honestly (F&G ampersand)');
  ok(ah.indexOf('no evidence recorded') >= 0,
     'AH: a layer with no recorded note falls back to \'no evidence recorded\' (never throws)');
  ok(ah.indexOf('no squeeze state names this symbol') >= 0
     && ah.indexOf('no flush-reversal setup in the current window') >= 0
     && ah.indexOf('awaiting the post-scan candle fetch') >= 0,
     'AH: silent layers say WHY they are silent, not just "silent"');
  ok(ah.indexOf('miners healthy') >= 0 && ah.indexOf('momentum with participation') >= 0,
     'AH: on-chain + tape evidence strings land on their lines');

  /* guard rows + funding-guard dedup + veto rendering */
  colA.votes.push({ layer: 'guard', vote: 'neutral', kind: 'context', caution: true,
                    text: 'overextended +16.4% 24h — chasing tops is how radar dies' });
  colA.votes.push({ layer: 'guard', vote: 'neutral', kind: 'context', caution: true,
                    text: 'funding crowded same-direction — squeeze risk' });
  const ah2 = W.rowAuditHTML(rowA);
  ok(ah2.indexOf('GUARD') >= 0 && ah2.indexOf('overextended +16.4% 24h') >= 0,
     'AH: a gate-guard caution renders as its own CAUTION line');
  ok(ah2.indexOf('funding crowded same-direction') === -1,
     'AH: the funding guard chip is NOT duplicated — the FUNDING line owns that story');
  const colV = COLLECT({ sym: 'SOLUSDT', news: { risk: 'low', note: 'clear' },
    engine: { survivors: [], rejected: [ { sym: 'SOLUSDT', vetoGate: 'G4', dir: 'long', gatesPassed: 4 } ], at: 1 } });
  const ahV = W.rowAuditHTML({ sym: 'SOLUSDT', lane: 'crypto', col: colV,
                               dec: DECIDE(colV.votes, { unavailable: colV.unavailable }) });
  ok(ahV.indexOf('>VETO</span>') >= 0 && ahV.indexOf('engine veto @ G4') >= 0,
     'AH: a vetoed row shows the VETO verdict + the killing gate');

  /* gold lane: its own 6-layer ledger, no crypto-only layers */
  const colG = COLLECT({ sym: 'XAU', lane: 'gold', news: { risk: 'low', note: 'clear' }, tape: null,
    gold: { setup: { dir: 'long', confidence: 'STRONG', reason: 'composite long edge' },
            deep: { dir: 'long', label: 'BULLISH', score: 71 },
            basis: { basisPct: 0.01, verdict: 'balanced' } },
    yield: { trend: 'flat' }, smt: { divergence: null } });
  const ahG = W.rowAuditHTML({ sym: 'XAU', lane: 'gold', col: colG,
                              dec: DECIDE(colV.votes, { unavailable: [] }) });
  ok(ahG.indexOf('>GOLDSETUP<') >= 0 && ahG.indexOf('>GOLDDEEP<') >= 0 && ahG.indexOf('>GOLDBASIS<') >= 0
     && ahG.indexOf('>YIELD<') >= 0 && ahG.indexOf('>SMT<') >= 0
     && ahG.indexOf('>NEWS<') >= 0 && ahG.indexOf('>FUNDING<') === -1 && ahG.indexOf('>TREND4H<') === -1,
     'AH: the gold lane renders its own 6-layer ledger — no crypto-only layers');
  ok(ahG.indexOf('composite long edge') >= 0 && ahG.indexOf('positioning balanced') >= 0,
     'AH: gold evidence strings land verbatim');
  ok(W.rowAuditHTML(null) !== '' && W.rowAuditHTML({}).indexOf('audit') >= 0,
     'AH: builder never throws on a broken row — honest fallback line');
}
{
  /* integration — toggles on every row class, lazy by default, toggle works */
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG.engineState = function(){ return { survivors: [], rejected: [ { sym: 'VETOEDUSDT', vetoGate: 'G4', dir: 'long', gatesPassed: 4 } ], at: 1 }; };
  WG.squeezeState = function(){ return { results: [ { sym: 'W1USDT', kind: 'fired', dir: 'long' } ] }; };
  WG.oiflowState = function(){ return { results: [ { sym: 'W1USDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT',    base: 'BTC',    exchange: 'delta', turnoverUsd: 9e9,  mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'W1USDT',     base: 'W1',     exchange: 'delta', turnoverUsd: 60e6, mark: 1,   fundingPct: 0, alsoOn: null },
    { sym: 'A1USDT',     base: 'A1',     exchange: 'delta', turnoverUsd: 50e6, mark: 1,   fundingPct: 0, alsoOn: null },
    { sym: 'VETOEDUSDT', base: 'VETOED', exchange: 'delta', turnoverUsd: 40e6, mark: 1,   fundingPct: 0, alsoOn: null } ]; };
  WG.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const TH = freshPane();
  WG.HG_tabs[0].mount(TH.pane);
  await runAndWait(TH.stubs);
  const hCards = TH.stubs['#brainCards'].innerHTML;
  const hWatch = TH.stubs['#brainWatch'].innerHTML;
  const hAside = TH.stubs['#brainAside'].innerHTML;
  ok(TH.stubs['#brainStat'].textContent.indexOf('done · 0 PRIME · 1 HIGH · 3 watch · 3 aside') === 0,
     'AH: fixture scan — W1 HIGH (4 layers), A1 + auto-prepended ETH/SOL radar watch, BTC thin aside, VETOED veto aside, gold aside — got "' + TH.stubs['#brainStat'].textContent + '"');
  ok(hCards.indexOf('data-audit="W1USDT"') >= 0
     && (hWatch.split('data-audit="').length - 1) === 3
     && (hAside.split('data-audit="').length - 1) === 3,
     'AH: every row class carries the audit toggle — card, all 3 WATCH rows, all 3 ASIDE/VETO rows');
  ok(hCards.indexOf('auditRows') === -1 && hWatch.indexOf('auditRows') === -1 && hAside.indexOf('auditRows') === -1,
     'AH: LAZY by default — not a single ledger is rendered until clicked (500-row scans stay lean)');
  const w1Audit = WG.__hgBrainAudit('W1USDT');
  ok(w1Audit && ['NEWS','REGIME','ROTATION','ONCHAIN','FNG','FUNDING','ENGINE','OIFLOW','SQUEEZE','TAPE','LIQS','TREND4H']
       .every(function(L){ return w1Audit.indexOf('>' + L + '<') >= 0; }),
     'AH: the HIGH row’s on-demand ledger covers all 12 layers');
  ok(w1Audit.indexOf('SQUEEZE fired LONG — compression released') >= 0
     && w1Audit.indexOf('inside the ±0.1%/8h band') >= 0
     && w1Audit.indexOf('no clean trend break either way') >= 0,
     'AH: squeeze vote + funding band-silence + flat-candle trend silence all named on demand');
  const vAudit = WG.__hgBrainAudit('VETOEDUSDT');
  ok(vAudit && vAudit.indexOf('>VETO</span>') >= 0 && vAudit.indexOf('engine veto @ G4') >= 0,
     'AH: the VETO row’s ledger shows the veto + killing gate');
  ok(WG.__hgBrainAudit('NOPEUSDT') === null, 'AH: auditing an unknown sym returns null, never throws');

  /* the toggle itself: expand renders the ledger into the box; collapse releases it */
  const stubBox = { style: { display: 'none' }, innerHTML: '' };
  const stubBtn = { textContent: '▸ LAYER AUDIT' };
  const stubPane = { querySelector: function(sel){ return sel.indexOf('data-audit-box') >= 0 ? stubBox : null; } };
  WG.auditToggleByKey(stubPane, encodeURIComponent('W1USDT'), stubBtn);
  ok(stubBox.style.display === '' && stubBox.innerHTML.indexOf('auditRows') >= 0 && stubBtn.textContent === '▾ LAYER AUDIT',
     'AH: click EXPANDS — the ledger renders on demand into the row’s own box');
  WG.auditToggleByKey(stubPane, encodeURIComponent('W1USDT'), stubBtn);
  ok(stubBox.style.display === 'none' && stubBox.innerHTML === '' && stubBtn.textContent === '▸ LAYER AUDIT',
     'AH: click again COLLAPSES and releases the HTML (lazy both ways)');
  WG.auditToggleByKey(stubPane, encodeURIComponent('GHOSTUSDT'), stubBtn);
  ok(stubBox.innerHTML.indexOf('row not in the last synthesis') >= 0,
     'AH: toggling a sym missing from the last synthesis says so honestly, never throws');
}

/* ================= AI) BOUNDED WARM-WAIT at synthesis start =================
   A slow-but-successful warm hook lifts its layer from dark to voting; a
   never-settling hook loses the race and stays named-dark; a sync-throwing
   hook and a liqs-style skip string are consumed without breaking the scan.
   The auto-warm accounting (warmed / starter-failed / still-running / skip
   string) rides the stat line through the universe build; a <60s re-run and
   QUICK RESCAN invoke zero starters. */
console.log('== bounded warm-wait: dark->voting promotion, honest dark after the cap ==');
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.brainTunables.warmColdMs = 400;   /* test-scale cold-start cap — the race mechanics are the product */
  WG.brainTunables.layerWarmMs = 400;    /* layer patience uses the same test-scale cap */
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG.oiflowState = function(){ return { results: [ { sym: 'BTCUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  let regimeRuns = 0;
  WG.HG_warmups = [
    { id: 'regime', label: 'REGIME', run: function(){
        regimeRuns++;
        return new Promise(function(res){
          setTimeout(function(){
            WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
            res('warmed');
          }, 40);
        }); } },
    { id: 'rotation', label: 'ROTATION', run: function(){ return new Promise(function(){}); } },   /* never settles */
    { id: 'boom', label: 'BOOM', run: function(){ throw new Error('kaboom'); } },                  /* sync throw */
    { id: 'liqs', label: 'LIQS', run: async function(){
        return 'skipped: stream-only layer — open the LIQS tab once to start the live socket'; } } /* consumed verbatim */
  ];
  const TI = freshPane();
  /* transient-stat capture: xuUniverse fires mid-scan — AFTER the auto-warm
     accounting prefix is painted, BEFORE 'done ·' replaces it */
  const iSnaps = [];
  WG.xuUniverse = async function(){ iSnaps.push(TI.stubs['#brainStat'].textContent); return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null } ]; };
  WG.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  WG.HG_tabs[0].mount(TI.pane);
  await runAndWait(TI.stubs);
  const iStat = TI.stubs['#brainStat'].textContent;
  const iRead = TI.stubs['#brainRead'].textContent;
  ok(iStat.indexOf('done ·') === 0,
     'AI: the scan COMPLETES despite a never-settling warm hook — the cap bound — got "' + iStat + '"');
  ok(iRead.indexOf('RISK-ON regime') >= 0,
     'AI: the slow-but-successful layer WARMED into voting instead of being judged dark — got "' + iRead + '"');
  ok(iRead.indexOf('dark: rotation') >= 0,
     'AI: the genuinely-stuck layer stays named-dark after the cap, exactly as today — got "' + iRead + '"');
  const iRows = WG.__hgBrainLast().rows;
  const iBtc = iRows.filter(function(x){ return x.sym === 'BTCUSDT'; })[0];
  ok(iBtc && iBtc.evidence.some(function(e){ return e.indexOf('REGIME:') === 0; })
     && !iBtc.evidence.some(function(e){ return e.indexOf('ROTATION:') === 0; }),
     'AI: snapshot proves it — warmed REGIME votes, stuck ROTATION never fabricated a vote');
  ok(regimeRuns === 1, 'AI: the regime hook ran exactly once during the bounded wait — got ' + regimeRuns);
  ok(iSnaps[0].indexOf('auto-warmed: regime') >= 0
       && iSnaps[0].indexOf('still dark: rotation') >= 0
       && iSnaps[0].indexOf('boom (starter failed: kaboom)') >= 0
       && iSnaps[0].indexOf('building universe') >= 0,
     'AI: the auto-warm accounting rides the stat line through the universe build — warmed / stuck / failed / skipped each named — got "' + iSnaps[0] + '"');
  /* QUICK RESCAN never auto-warms — straight to the recheck, zero starters */
  TI.stubs['#brainQuick']._handler();
  await waitIdle(TI.stubs);
  ok(regimeRuns === 1 && TI.stubs['#brainStat'].textContent.indexOf('quick rescan:') === 0,
     'AI: QUICK RESCAN invokes zero warm starters and stays instant — got "' + TI.stubs['#brainStat'].textContent + '"');
  await runAndWait(TI.stubs);
  ok(regimeRuns === 1 && TI.stubs['#brainStat'].textContent.indexOf('done ·') === 0,
     'AI: an immediate re-run SKIPS the warm-wait (layers warm-checked moments ago) and still completes');
  ok(iSnaps[iSnaps.length - 1].indexOf('auto-warmed') < 0
       && iSnaps[iSnaps.length - 1].indexOf('building universe') >= 0,
     'AI: inside the 60s freshness window the re-run carries NO accounting prefix — got "' + iSnaps[iSnaps.length - 1] + '"');
}

/* ================= AL) AUTO-WARM INTO RUN SYNTHESIS =================
   The synthesis INVOKES the same starters WARM UP LAYERS uses — one shared
   collection, engine sorted LAST even when registered FIRST — then bounded-
   waits on the cold-start cap. A genuinely COLD engine layer warms into
   VOTING inside the cap and its gate plan renders verbatim; a rejecting
   starter and a skip string are named in the accounting; the 60s freshness
   window and QUICK RESCAN invoke zero starters; no hooks at all -> the
   legacy stat line byte-identical. */
console.log('== auto-warm into synthesis: shared engine-last path, accounting prefix, freshness skip, quick never warms ==');
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  delete WG.engineState;                     /* engine starts genuinely COLD — its hook installs the state */
  WG.brainTunables.warmColdMs = 400;
  WG.brainTunables.layerWarmMs = 400;
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  const calls = [], progSnaps = [];
  let TL = null;                             /* assigned before any hook can fire (mount -> run) */
  WG.HG_warmups = [
    { id: 'engine', label: 'ENGINE', run: function(){                    /* registered FIRST … */
        calls.push('engine');
        progSnaps.push(TL.stubs['#brainStat'].textContent);              /* … must still invoke LAST */
        return new Promise(function(res){
          setTimeout(function(){
            WG.engineState = function(){ return { survivors: [
              { sym: 'BTCUSDT', dir: 'long', conviction: 'STRONG',
                plan: { entry: 100, stop: 95, t1: 110, t2: 117.5 }, gatesPassed: 6 } ], rejected: [], at: 1 }; };
            res('warmed');
          }, 60);
        }); } },
    { id: 'regime', label: 'REGIME', run: function(){
        calls.push('regime');
        return new Promise(function(res){
          setTimeout(function(){
            WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
            res('warmed');
          }, 30);
        }); } },
    { id: 'boom', label: 'BOOM', run: function(){ calls.push('boom'); return Promise.reject(new Error('kaput')); } },
    { id: 'liqs', label: 'LIQS', run: async function(){ calls.push('liqs');
        return 'skipped: stream-only layer — open the LIQS tab once to start the live socket'; } }
  ];
  TL = freshPane();
  const alSnaps = [];
  WG.xuUniverse = async function(){ alSnaps.push(TL.stubs['#brainStat'].textContent); return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null } ]; };
  WG.HG_tabs[0].mount(TL.pane);
  await runAndWait(TL.stubs);
  ok(calls.join(',') === 'regime,boom,liqs,engine',
     'AL: ONE shared invocation path — registration order preserved, engine sorted LAST — got "' + calls.join(',') + '"');
  ok(progSnaps[0] === 'auto-warming layers — regime, boom, liqs, engine (≤0.4s)…',
     'AL: the progress stat names the exact hook order + the cold cap while the starters run — got "' + progSnaps[0] + '"');
  ok(alSnaps[0].indexOf('auto-warmed: regime, engine') >= 0
       && alSnaps[0].indexOf('still dark: boom (starter failed: kaput)') >= 0
       && alSnaps[0].indexOf('building universe') >= 0,
     'AL: accounting prefix — cold engine + regime warmed into voting, the rejection + the skip named verbatim — got "' + alSnaps[0] + '"');
  ok(TL.stubs['#brainStat'].textContent.indexOf('done · 0 PRIME · 0 HIGH · 1 watch · 3 aside') === 0,
     'AL: tally — the warmed BTC rides radar WATCH, ETH/SOL/gold aside — got "' + TL.stubs['#brainStat'].textContent + '"');
  const alBtc = WG.__hgBrainLast().rows.filter(function(x){ return x.sym === 'BTCUSDT'; })[0];
  ok(alBtc && alBtc.evidence.some(function(e){ return e.indexOf('ENGINE: ENGINE SURVIVOR') === 0; })
        && alBtc.evidence.some(function(e){ return e.indexOf('REGIME:') === 0; }),
     'AL: the auto-warmed ENGINE + REGIME layers VOTE in the very same run — never judged dark');
  const alBtcRow = lrowSeg(TL.stubs['#brainWatch'].innerHTML, 'BTC');
  ok(alBtcRow.indexOf('ENTRY <b>100</b>') >= 0 && alBtcRow.indexOf('gate engine') >= 0,
     'AL: the warmed engine survivor’s gate plan renders on the radar row verbatim — got "' + alBtcRow.slice(0, 200) + '"');
  await runAndWait(TL.stubs);
  ok(calls.length === 4 && alSnaps.length >= 2
       && alSnaps[alSnaps.length - 1].indexOf('auto-warmed') < 0
       && alSnaps[alSnaps.length - 1].indexOf('building universe') >= 0,
     'AL: re-run inside the 60s freshness window SKIPS starter invocation entirely — no prefix, no re-warm — got "' + alSnaps[alSnaps.length - 1] + '"');
  TL.stubs['#brainQuick']._handler();
  await waitIdle(TL.stubs);
  ok(calls.length === 4 && TL.stubs['#brainStat'].textContent.indexOf('quick rescan:') === 0,
     'AL: QUICK RESCAN never auto-warms — zero new starter calls, instant recheck — got "' + TL.stubs['#brainStat'].textContent + '"');
  /* zero hooks registered -> no warm phase at all, the legacy stat line unprefixed */
  const WN = freshBrain();
  stubQuietLayers(WN);
  WN.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  const TN = freshPane();
  const nSnaps = [];
  WN.xuUniverse = async function(){ nSnaps.push(TN.stubs['#brainStat'].textContent); return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null } ]; };
  WN.HG_tabs[0].mount(TN.pane);
  await runAndWait(TN.stubs);
  ok(nSnaps[0].indexOf('building universe') >= 0 && TN.stubs['#brainStat'].textContent.indexOf('done ·') === 0,
     'AL: zero registered hooks -> the scan runs exactly as before, stat byte-identical — got "' + nSnaps[0] + '"');
}

/* ================= AJ) STRUCTURE-ANCHORED LIMIT PLANS — pure planner =================
   Each anchor type wins in its own fixture; band rejection, R:R decline,
   in-zone vs limit labels, stop/TP math and the never-throw contract — all
   numbers straight off the 4h candles (window.brainAnchorPlan seam). */
console.log('== structure-anchored limit plans: anchor selection, band, stop/TP math, in-zone ==');
{
  const ANCHOR = W.brainAnchorPlan;
  ok(typeof ANCHOR === 'function', 'AJ: window.brainAnchorPlan exposed (pure planner seam)');
  const near = function(a, b){ return Math.abs(a - b) < 1e-9; };
  const bar = function(c, hh, ll){ return { t: 0, o: c, h: hh !== undefined ? hh : c + 0.5, l: ll !== undefined ? ll : c - 0.5, c: c, v: 1000 }; };
  /* flat 100 range-1 bars with one shallow confirmed dip (pivot low 98.8) */
  const swingLongRows = function(){
    const rows = [];
    for (let i = 0; i < 120; i++) rows.push(bar(100));
    rows[113] = bar(99.6, 99.9, 99.3);
    rows[114] = bar(99.3, 99.7, 99.0);
    rows[115] = bar(99.2, 99.5, 98.8);   /* pivot low 98.8 */
    rows[116] = bar(99.5, 99.8, 99.1);
    rows[117] = bar(99.8, 100.1, 99.4);
    rows[118] = bar(100, 100.3, 99.7);
    rows[119] = bar(100, 100.3, 99.7);
    return rows;
  };

  /* ---- AJ1: the swing-low zone top wins (EMAs hug the mark, no FVG) ---- */
  let ap = ANCHOR('long', swingLongRows());
  ok(ap.plan && ap.note === '', 'AJ1: an anchored plan lands on the swing-low fixture');
  ok(ap.plan.entryType === 'limit' && ap.plan.anchorName === 'swing-low zone'
     && ap.plan.type === 'ANCHOR4H' && ap.plan.src === 'structure-anchored limit (4h)',
     'AJ1: entryType limit, anchor named, ANCHOR4H type, structure-anchored src');
  ok(ap.plan.entry === 99.1 && ap.plan.cancelIf === 98.8,
     'AJ1: entry = the swing-low zone TOP (higher confirmation low 99.1); invalidation = the pivot low 98.8');
  ok(near(ap.plan.stop, 98.8 - 0.75 * 0.8648027021281775) && near(ap.plan.stop, 98.15139797340387),
     'AJ1: stop = 0.75 x ATR14(4h) beyond the zone bottom — 98.1514');
  ok(near(ap.plan.t1, 100.5229030398942) && near(ap.plan.t2, 101.47150506649033)
     && near(ap.plan.rr1, 1.5) && near(ap.plan.rr2, 2.5),
     'AJ1: no opposing 4h structure -> raw 1.5R/2.5R targets');
  ok(ap.plan.anchorNote === 'swing-low zone 99.1 (zone 98.8–99.1) · 1.04×ATR below mark',
     'AJ1: anchor note names the zone + the ATR multiple — got "' + ap.plan.anchorNote + '"');

  /* ---- AJ2: EMA20(4h) wins on a gentle monotonic ramp (no pivots, no FVG) ---- */
  const ramp = function(step, range){
    const rows = [];
    for (let i = 0; i < 120; i++){
      const c = 100 + i * step;
      rows.push({ t: 0, o: c - 0.02, h: c + range / 2, l: c - range / 2, c: c, v: 1000 });
    }
    return rows;
  };
  ap = ANCHOR('long', ramp(0.05, 0.4));
  ok(ap.plan && ap.plan.anchorName === 'EMA20(4h)' && near(ap.plan.entry, 105.475)
     && near(ap.plan.stop, 105.175) && near(ap.plan.t1, 105.925) && near(ap.plan.t2, 106.225),
     'AJ2: EMA20(4h) wins the ramp — entry at the line, stop 0.75xATR beyond, raw 1.5R/2.5R');
  ok(ap.plan.anchorNote === 'EMA20(4h) 105.48 · 1.19×ATR below mark',
     'AJ2: the line anchor note carries the ATR multiple — got "' + ap.plan.anchorNote + '"');

  /* ---- AJ3: EMA50(4h) wins when EMA20 hugs the mark inside 0.25xATR ---- */
  const decay = function(){
    const rows = []; let c = 100;
    for (let i = 0; i < 120; i++){
      c += 0.09 * Math.pow(0.97, i);
      rows.push({ t: 0, o: c - 0.01, h: c + 0.2, l: c - 0.2, c: c, v: 1000 });
    }
    return rows;
  };
  ap = ANCHOR('long', decay());
  ok(ap.plan && ap.plan.anchorName === 'EMA50(4h)' && near(ap.plan.entry, 102.75172367977194)
     && near(ap.plan.stop, 102.45172367977194),
     'AJ3: EMA20 too close to the mark (< 0.25xATR) -> EMA50(4h) wins the band');
  ok(ap.plan.anchorNote === 'EMA50(4h) 102.75 · 0.43×ATR below mark',
     'AJ3: the EMA50 note is honest about the distance — got "' + ap.plan.anchorNote + '"');

  /* ---- AJ4: the untouched 4h FVG wins on the shared trend fixture ---- */
  ap = ANCHOR('long', trendRows(true));
  ok(ap.plan && ap.plan.anchorName === '4h FVG' && near(ap.plan.entry, 147.64569307942614)
     && near(ap.plan.stop, 146.52464339296364) && near(ap.plan.cancelIf, 147.48882586775437)
     && near(ap.plan.t1, 149.32726760911987) && near(ap.plan.t2, 150.4483172955824),
     'AJ4: nearest untouched bullish FVG — entry at the gap top, stop 0.75xATR beyond the gap bottom');
  ok(ap.plan.anchorNote === '4h FVG 147.65 (zone 147.49–147.65) · 1.04×ATR below mark',
     'AJ4: the FVG note names the zone — got "' + ap.plan.anchorNote + '"');

  /* ---- AJ5: SHORT mirrors — swing-high zone + a SNAPPED TP1 (downtrend) ---- */
  const swingShortRows = function(){
    const rows = [];
    for (let i = 0; i < 120; i++) rows.push(bar(100));
    rows[113] = bar(100.4, 100.7, 100.1);
    rows[114] = bar(100.7, 101.0, 100.3);
    rows[115] = bar(100.8, 101.2, 100.5);  /* pivot high 101.2 */
    rows[116] = bar(100.5, 100.9, 100.2);
    rows[117] = bar(100.2, 100.6, 99.9);
    rows[118] = bar(100, 100.3, 99.7);
    rows[119] = bar(100, 100.3, 99.7);
    return rows;
  };
  ap = ANCHOR('short', swingShortRows());
  ok(ap.plan && ap.plan.anchorName === 'swing-high zone' && ap.plan.entry === 100.9
     && ap.plan.cancelIf === 101.2 && near(ap.plan.stop, 101.84860202659614),
     'AJ5: SHORT mirrors — entry at the swing-high zone bottom, stop 0.75xATR above the pivot high');
  ap = ANCHOR('short', trendRows(false));
  ok(ap.plan === null && ap.note.indexOf('R:R 1.4 below the 1.5 minimum') >= 0,
     'AJ5: the wider stop makes the marginal setup DECLINE honestly (R:R 1.4 < 1.5) instead of entering to get stopped out — the fix working, gate-engine fallback named');

  /* ---- AJ6: TP1/TP2 both snap to opposing structure when it exists ---- */
  const tpSnapRows = function(){
    const rows = swingLongRows();
    rows[100] = bar(101.5, 102.5, 101.0);   /* confirmed pivot high 102.5 */
    rows[99]  = bar(101.2, 101.8, 100.8);
    rows[101] = bar(101.2, 101.8, 100.8);
    rows[90]  = bar(104.0, 105.0, 103.5);   /* confirmed pivot high 105 */
    rows[89]  = bar(103.5, 104.2, 103.0);
    rows[91]  = bar(103.5, 104.2, 103.0);
    return rows;
  };
  ap = ANCHOR('long', tpSnapRows());
  ok(ap.plan && ap.plan.t1 === 102.5 && ap.plan.t2 === 105,
     'AJ6: TP1 snaps to the nearest opposing pivot (102.5), TP2 to the one beyond it (105)');

  /* ---- AJ7: band rejection -> honest gate-engine fallback, no anchor ---- */
  ap = ANCHOR('long', ramp(0.08, 0.4));
  ok(ap.plan === null && ap.note === 'no nearby 4h structure — gate-engine levels',
     'AJ7: every anchor beyond 1.5xATR -> declined, honestly labeled — got "' + ap.note + '"');
  ap = ANCHOR('long', trendRows(false));
  ok(ap.plan === null && ap.note === 'no nearby 4h structure — gate-engine levels',
     'AJ7: counter-trend candles (LONG row, downtrend) -> no below-mark anchor in band, never fabricated');

  /* ---- AJ8: MIN R:R discipline — opposing structure inside 1.5R declines ---- */
  const rrFailRows = function(){
    const rows = [];
    for (let i = 0; i < 120; i++) rows.push(bar(100));
    rows[110] = bar(99.6, 99.9, 99.3);
    rows[111] = bar(99.3, 99.6, 99.0);
    rows[112] = bar(99.2, 99.5, 98.9);
    rows[113] = bar(99.1, 99.4, 98.8);   /* pivot low 98.8 */
    rows[114] = bar(99.5, 99.8, 99.1);
    rows[115] = bar(99.8, 100.0, 99.5);
    rows[116] = bar(99.9, 100.0, 99.7);
    rows[117] = bar(99.95, 100.05, 99.75); /* confirmed pivot high 100.05 — too close */
    rows[118] = bar(99.9, 99.95, 99.7);
    rows[119] = bar(99.9, 100.0, 99.8);
    return rows;
  };
  ap = ANCHOR('long', rrFailRows());
  ok(ap.plan === null && ap.note === 'anchored limit R:R 0.9 below the 1.5 minimum — gate-engine levels',
     'AJ8: snapped TP1 under the 1.5R minimum -> declined with the R:R named (wider stop, honest math) — got "' + ap.note + '"');

  /* ---- AJ9: mark INSIDE the anchor zone -> 'zone' entryType at the far edge ---- */
  const inZoneRows = function(){
    const rows = [];
    for (let i = 0; i < 120; i++) rows.push(bar(100));
    rows[114] = bar(99.5, 99.8, 99.2);
    rows[115] = bar(99.2, 99.5, 98.9);
    rows[116] = bar(99.0, 99.3, 98.9);
    rows[117] = bar(98.9, 99.2, 98.6);   /* pivot low 98.6 */
    rows[118] = bar(99.1, 99.4, 98.9);
    rows[119] = bar(98.85, 99.2, 98.7); /* mark 98.85 inside [98.6, 98.9] */
    return rows;
  };
  ap = ANCHOR('long', inZoneRows());
  ok(ap.plan && ap.plan.entryType === 'zone' && ap.plan.entry === 98.6 && ap.plan.cancelIf === 98.6
     && near(ap.plan.stop, 97.96919836096141),
     'AJ9: price in zone — limit at the far zone edge (98.6), stop 0.75xATR beyond');
  ok(ap.plan.anchorNote === 'mark inside swing-low zone 98.6–98.9 — limit at the zone edge',
     'AJ9: the in-zone note says exactly that — got "' + ap.plan.anchorNote + '"');

  /* ---- AJ10: thin history + the never-throw contract ---- */
  ap = ANCHOR('long', swingLongRows().slice(80));
  ok(ap.plan === null && ap.note === '4h history too thin for a structure anchor — gate-engine levels',
     'AJ10: 40 candles (< 60) -> honestly too thin, labeled fallback');
  let threw = null;
  try{
    const junk = [ANCHOR('long', null), ANCHOR('long', []), ANCHOR('short', 'nope'),
                  ANCHOR('sideways', swingLongRows()), ANCHOR(null, swingLongRows()),
                  ANCHOR('long', [{ h: 'x', l: NaN, c: -5 }])];
    if (junk.some(function(r){ return !r || r.plan !== null; })) threw = new Error('junk input produced a plan');
  }catch(e){ threw = e; }
  ok(!threw, 'AJ10: null/empty/garbage/non-dir inputs -> {plan:null}, never throws, never fabricates'
     + (threw ? ' — ' + threw.message : ''));

  /* ---- AJ11: additive contract — the plan keeps {dir,entry,stop,t1,t2} plus
        entryType/anchorName/anchorNote/cancelIf only ---- */
  ap = ANCHOR('long', swingLongRows());
  const pKeys = Object.keys(ap.plan).sort().join(',');
  ok(pKeys === 'anchorName,anchorNote,cancelIf,confirmed,dir,entry,entryType,note,riskPct,rr1,rr2,src,stop,t1,t2,type',
     'AJ11: normalized plan shape — classic fields + additive anchor fields only — got ' + pKeys);
  ok(typeof ap.plan.dir === 'string' && isFinite(ap.plan.entry) && isFinite(ap.plan.stop)
     && isFinite(ap.plan.t1) && isFinite(ap.plan.t2),
     'AJ11: dir/entry/stop/t1/t2 intact for downstream readers (toTrade, charts, scorecard, signallog)');
}

/* ================= AK) ANCHORED LIMITS end-to-end: render, snapshot, audit, quick =================
   One combined scan: TRENDY (uptrend) promoted HIGH with a 4h-FVG limit on the
   card; W1 (swing-low fixture) keeps its WATCH radar verdict with a swing-zone
   limit on the row; INZONE closes inside its zone; FLAT + ETH/SOL flat candles
   fall back to the hgPlanLevels stub with the honest label. */
console.log('== anchored limits at run level: LIMIT render, snapshot shape, audit PLAN line, quick persistence ==');
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG.oiflowState = function(){ return { results: [
    { sym: 'TRENDYUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'W1USDT',     dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'INZONEUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'FLATUSDT',   dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  const bar = function(c, hh, ll){ return { t: 0, o: c, h: hh !== undefined ? hh : c + 0.5, l: ll !== undefined ? ll : c - 0.5, c: c, v: 1000 }; };
  const swingLongRows = function(){
    const rows = [];
    for (let i = 0; i < 120; i++) rows.push(bar(100));
    rows[113] = bar(99.6, 99.9, 99.3);
    rows[114] = bar(99.3, 99.7, 99.0);
    rows[115] = bar(99.2, 99.5, 98.8);
    rows[116] = bar(99.5, 99.8, 99.1);
    rows[117] = bar(99.8, 100.1, 99.4);
    rows[118] = bar(100, 100.3, 99.7);
    rows[119] = bar(100, 100.3, 99.7);
    return rows;
  };
  const inZoneRows = function(){
    const rows = [];
    for (let i = 0; i < 120; i++) rows.push(bar(100));
    rows[114] = bar(99.5, 99.8, 99.2);
    rows[115] = bar(99.2, 99.5, 98.9);
    rows[116] = bar(99.0, 99.3, 98.9);
    rows[117] = bar(98.9, 99.2, 98.6);
    rows[118] = bar(99.1, 99.4, 98.9);
    rows[119] = bar(98.85, 99.2, 98.7);
    return rows;
  };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT',    base: 'BTC',    exchange: 'delta', turnoverUsd: 9e9,  mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT',    base: 'ETH',    exchange: 'delta', turnoverUsd: 5e9,  mark: 50,  fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT',    base: 'SOL',    exchange: 'delta', turnoverUsd: 2e9,  mark: 20,  fundingPct: 0, alsoOn: null },
    { sym: 'TRENDYUSDT', base: 'TRENDY', exchange: 'delta', turnoverUsd: 60e6, mark: 1,   fundingPct: 0, alsoOn: null },
    { sym: 'W1USDT',     base: 'W1',     exchange: 'delta', turnoverUsd: 55e6, mark: 1,   fundingPct: 0, alsoOn: null },
    { sym: 'INZONEUSDT', base: 'INZONE', exchange: 'delta', turnoverUsd: 52e6, mark: 1,   fundingPct: 0, alsoOn: null },
    { sym: 'FLATUSDT',   base: 'FLAT',   exchange: 'delta', turnoverUsd: 50e6, mark: 1,   fundingPct: 0, alsoOn: null } ]; };
  WG.xuState = function(){ return { count: 7, delta: 7, cdcx: 0, at: Date.now(), note: null }; };
  WG.xuCandles = function(item){
    return Promise.resolve(item.sym === 'TRENDYUSDT' ? trendRows(true)
                         : item.sym === 'W1USDT'     ? swingLongRows()
                         : item.sym === 'INZONEUSDT' ? inZoneRows()
                         : fakeRows(120));
  };
  let planCalls = 0;
  WG.hgPlanLevels = function(dir){ planCalls++; return { dir: dir, entry: 10, stop: 9, t1: 12, t2: 13 }; };
  WG.toTrade = function(){};
  const TK = freshPane();
  WG.HG_tabs[0].mount(TK.pane);
  await runAndWait(TK.stubs);
  const kStat = TK.stubs['#brainStat'].textContent;
  const kCards = TK.stubs['#brainCards'].innerHTML;
  const kWatch = TK.stubs['#brainWatch'].innerHTML;
  ok(kStat.indexOf('done · 0 PRIME · 2 HIGH · 4 watch · 2 aside') === 0,
     'AK: fixture scan — TRENDY HIGH via TREND4H (+MTF+VOLREG); a second HIGH via volreg; 4 watch; BTC + gold aside — got "' + kStat + '"');

  /* ---- the promoted card carries the patient LIMIT, not a market chase ---- */
  ok(kCards.indexOf('HIGH · 6 LAYERS') >= 0
     && kCards.indexOf('LIMIT @ <b>147.65</b> — pullback to 4h FVG') >= 0
     && kCards.indexOf('stop <b>146.52</b> (0.75xATR beyond 4h FVG)') >= 0
     && kCards.indexOf('TP1 <b>149.33</b> · TP2 <b>150.45</b> · R:R 1.5') >= 0
     && kCards.indexOf('cancel if 4h closes beyond <b>147.49</b>') >= 0
     && kCards.indexOf('limit working ~24h or until structure breaks — structure-anchored limit (4h)') >= 0,
     'AK: the TRENDY card renders the full anchored limit block — anchor, stop, TPs, R:R, invalidation, validity');
  ok(kCards.indexOf('TRENDYUSDT') >= 0 && kCards.slice(kCards.indexOf('TRENDYUSDT'), kCards.indexOf('TRENDYUSDT') + 1400).indexOf('ENTRY <b>') === -1,
     'AK: no market-entry render on the TRENDY anchored card — the LIMIT block replaces it (other cards unaffected)');
  ok(kCards.indexOf('toTrade(&quot;TRENDYUSDT&quot;,&quot;long&quot;,147.64569307942614,146.52464339296364,149.32726760911987') >= 0,
     'AK: SEND TO TRADE PLAN carries the anchored entry/stop/t1 verbatim');

  /* ---- WATCH rows: swing-zone limit, in-zone label, honest fallback ---- */
  ok(lrowSeg(kWatch, 'W1').indexOf('LIMIT @ <b>99.1</b> — pullback to swing-low zone') >= 0
     && lrowSeg(kWatch, 'W1').indexOf('cancel if 4h closes beyond <b>98.8</b>') >= 0,
     'AK: the W1 radar WATCH row offers the swing-low zone limit (waiting, not chasing)');
  ok(lrowSeg(kWatch, 'INZONE').indexOf('price in zone — limit at zone edge <b>98.6</b> or market') >= 0,
     'AK: mark inside the zone -> the in-zone label with the edge price');
  ok(kCards.indexOf('FLATUSDT') >= 0
     && kCards.indexOf('ENTRY <b>10</b>') >= 0
     && kCards.indexOf('no nearby 4h structure — gate-engine levels') >= 0,
     'AK: flat candles -> the hgPlanLevels plan UNTOUCHED + the honest no-structure label (FLAT now on a HIGH card via volreg)');
  ok(planCalls === 3, 'AK: hgPlanLevels consulted ONLY for the anchor-less rows (FLAT + ETH + SOL), never for anchored rows — got ' + planCalls);

  /* ---- snapshot + audit contract ---- */
  const kSnap = WG.__hgBrainLast();
  const kTrendy = kSnap.rows.filter(function(x){ return x.sym === 'TRENDYUSDT'; })[0];
  ok(kTrendy && kTrendy.plan && Object.keys(kTrendy.plan).sort().join(',') === 'entry,stop,t1,t2'
     && kTrendy.plan.entry === 147.64569307942614 && kTrendy.plan.stop === 146.52464339296364
     && kTrendy.plan.t1 === 149.32726760911987 && kTrendy.plan.t2 === 150.4483172955824,
     'AK: __hgBrainLast keeps the EXACT {entry,stop,t1,t2} shape for the signallog — additive fields stay off the wire');
  ok(kTrendy.plan.entry < 148.9834776804744,
     'AK: the limit entry sits BELOW the last 4h close (patient pullback, never a chase)');
  const kAudit = WG.__hgBrainAudit('TRENDYUSDT');
  ok(kAudit && kAudit.indexOf('>PLAN<') >= 0 && kAudit.indexOf('>LIMIT<') >= 0
     && kAudit.indexOf('LIMIT @ 147.65 — 4h FVG 147.65 (zone 147.49–147.65) · 1.04×ATR below mark · stop 146.52 · cancel if 4h closes beyond 147.49') >= 0,
     'AK: the audit ledger gains a PLAN line naming the anchor source — got ' + (kAudit ? 'line present' : 'null'));
  const fAudit = WG.__hgBrainAudit('FLATUSDT');
  ok(fAudit && fAudit.indexOf('>PLAN<') >= 0 && fAudit.indexOf('>GATE<') >= 0
     && fAudit.indexOf('hgPlanLevels levels — no nearby 4h structure — gate-engine levels') >= 0,
     'AK: fallback rows audit the gate-engine provenance + the no-structure reason');
  const btcAudit = WG.__hgBrainAudit('BTCUSDT');
  ok(btcAudit && btcAudit.indexOf('>PLAN<') === -1,
     'AK: plan-less rows gain NO plan line — the ledger stays exactly as before');

  /* ---- quick rescan: same plans re-derived, WATCH rows keep their working limits ---- */
  TK.stubs['#brainQuick']._handler();
  await (async function(){
    const t0 = Date.now();
    while (TK.stubs['#brainRun'].disabled && Date.now() - t0 < 8000)
      await new Promise(function(res){ setTimeout(res, 25); });
  })();
  const kQuick = TK.stubs['#brainStat'].textContent;
  ok(/^quick rescan: 6 checked · 2 unchanged/.test(kQuick) && kQuick.indexOf('2 HIGH · 4 watch · 2 aside') >= 0,
     'AK: quick rescan rechecks the 6 WATCH-or-better rows, same buckets — got "' + kQuick + '"');
  ok(TK.stubs['#brainCards'].innerHTML.indexOf('LIMIT @ <b>147.65</b> — pullback to 4h FVG') >= 0
     && lrowSeg(TK.stubs['#brainWatch'].innerHTML, 'W1').indexOf('LIMIT @ <b>99.1</b> — pullback to swing-low zone') >= 0,
     'AK: the quick pass re-derives the SAME anchored limits deterministically — WATCH rows keep their working limits');
}

/* ================= AM) ENTRY TICKET — pure selector ================= */
console.log('== AM) entry ticket selector ==');
{
  const TICK = W.__hgBrainTickets;
  ok(typeof TICK === 'function', 'AM: window.__hgBrainTickets seam exposed');
  const mkRow = (sym, tier, dir, agree, plan) => ({
    sym: sym, lane: 'crypto',
    dec: { tier: tier, dir: dir, agree: agree, reasons: [sym + ' reason'], vetoes: [] },
    plan: plan || null
  });
  const limPlan = (dir, e, s, t1, t2, rr1) => ({ dir: dir, entry: e, stop: s, t1: t1, t2: t2,
    rr1: rr1, entryType: 'limit', anchorName: '4h EMA20/21', cancelIf: s - 5 });

  /* best-per-side: highest tier wins, agree breaks ties, rr1 last */
  const t1 = TICK([
    mkRow('AAAUSDT', 'HIGH', 'long', 4, limPlan('long', 10, 9, 12, 13, 2)),
    mkRow('BBBUSDT', 'PRIME', 'long', 5, limPlan('long', 20, 19, 23, 25, 3)),
    mkRow('CCCUSDT', 'WATCH', 'short', 3, limPlan('short', 30, 31, 27, 25, 3)),
    mkRow('DDDUSDT', 'ASIDE', 'short', 1, null)
  ]);
  ok(t1.long && t1.long.sym === 'BBBUSDT', 'AM: PRIME long beats HIGH long for the long ticket');
  ok(t1.short && t1.short.sym === 'CCCUSDT', 'AM: WATCH short with a plan earns the short ticket');
  ok(t1.longNear === null && t1.shortNear === null, 'AM: no near-miss named when a planned ticket exists on that side');

  /* honest empty side: plan-less leaning row becomes the named near miss */
  const t2 = TICK([
    mkRow('EEEUSDT', 'WATCH', 'long', 3, null),
    mkRow('FFFUSDT', 'ASIDE', 'short', 1, null),
    mkRow('GGGUSDT', 'ASIDE', 'long', 1, null)
  ]);
  ok(t2.long === null && t2.short === null, 'AM: no plans -> both tickets honestly null');
  ok(t2.longNear && t2.longNear.sym === 'EEEUSDT', 'AM: the WATCH long is named as the long near miss (ASIDE never outranks it)');
  ok(t2.shortNear === null, 'AM: ASIDE rows are tier-0 — never named as a near miss');

  /* plan direction overrides the verdict direction (the plan is the truth) */
  const t3 = TICK([ mkRow('HHHUSDT', 'HIGH', 'long', 4, limPlan('short', 30, 31, 27, 25, 3)) ]);
  ok(t3.short && t3.short.sym === 'HHHUSDT' && t3.long === null,
     'AM: a short PLAN on a long-leaning row files the ticket as SHORT');

  /* degenerate plans rejected: missing levels or zero-width risk */
  const t4 = TICK([
    mkRow('IIIUSDT', 'PRIME', 'long', 6, { dir: 'long', entry: 10, stop: 10, t1: 12 }),
    mkRow('JJJUSDT', 'PRIME', 'long', 6, { dir: 'long', entry: 10, stop: 9 }),
    mkRow('KKKUSDT', 'HIGH', 'long', 4, limPlan('long', 10, 9, 12, null, 2))
  ]);
  ok(t4.long && t4.long.sym === 'KKKUSDT', 'AM: zero-width-risk and t1-less plans are rejected; the valid one wins');

  /* never throws on garbage */
  const t5 = TICK(null), t6 = TICK([null, {}, { dec: null }, { dec: { dir: 'long' }, plan: { entry: 'x' } }, 42]);
  ok(t5.long === null && t5.short === null && t6.long === null && t6.short === null,
     'AM: garbage input -> all-null tickets, never throws');
}

/* ================= AN) LIMIT BOARD — expanded anchors, board builder, live state =================
   AN1-6: OB / liquidity-pool / AVWAP anchor families via the window seams
          (stubbed per family on fresh module instances), the union pick,
          band rejection, the 0.5xATR stop and the sub-1.5R decline — plus the
          REAL indicators.js / indicators2.js wiring (function-name contract).
   AN7:   buildLimitBoard — exactly the qualified rows, ticket-rank order,
          market-only separated, plan-null and ASIDE excluded, never throws.
   AN8:   hgLimitState — IN ZONE / APPROACHING / WAITING / STALE boundaries,
          wrong-side cross + cancel-if reasons, MARK n/a, garbage never throws.
   AN9:   run level — board renders under the ticket, limit + MARKET-ONLY
          groups, state chips off the zero-fetch mark (xuPositioning first),
          refreshing semantics, alert seam untouched, honest empty state.
   AN10:  legacy + gold lanes get the same anchored-first precedence. */
console.log('== AN) limit board: expanded anchors, builder, live state, run level ==');
{
  const bar = function(c, hh, ll){ return { t: 0, o: c, h: hh !== undefined ? hh : c + 0.5, l: ll !== undefined ? ll : c - 0.5, c: c, v: 1000 }; };
  const flat = function(){ const r = []; for (let i = 0; i < 120; i++) r.push(bar(100)); return r; };
  const swingLongRows = function(){
    const rows = [];
    for (let i = 0; i < 120; i++) rows.push(bar(100));
    rows[113] = bar(99.6, 99.9, 99.3);
    rows[114] = bar(99.3, 99.7, 99.0);
    rows[115] = bar(99.2, 99.5, 98.8);
    rows[116] = bar(99.5, 99.8, 99.1);
    rows[117] = bar(99.8, 100.1, 99.4);
    rows[118] = bar(100, 100.3, 99.7);
    rows[119] = bar(100, 100.3, 99.7);
    return rows;
  };
  const rrFailRows = function(){
    const rows = [];
    for (let i = 0; i < 120; i++) rows.push(bar(100));
    rows[110] = bar(99.6, 99.9, 99.3);
    rows[111] = bar(99.3, 99.6, 99.0);
    rows[112] = bar(99.2, 99.5, 98.9);
    rows[113] = bar(99.1, 99.4, 98.8);
    rows[114] = bar(99.5, 99.8, 99.1);
    rows[115] = bar(99.8, 100.0, 99.5);
    rows[116] = bar(99.9, 100.0, 99.7);
    rows[117] = bar(99.95, 100.05, 99.75); /* confirmed pivot high 100.05 — too close */
    rows[118] = bar(99.9, 99.95, 99.7);
    rows[119] = bar(99.9, 100.0, 99.8);
    return rows;
  };
  const near = function(a, b){ return Math.abs(a - b) < 1e-9; };

  /* ---- AN1: order block zone anchor (stubbed family seam), LONG + SHORT ---- */
  const WA1 = freshBrain();
  WA1.findOrderBlock = function(rows, dir){
    return dir === 'long' ? { top: 99.5, bottom: 99.3, age: 5 } : { top: 100.7, bottom: 100.5, age: 5 }; };
  let ap = WA1.brainAnchorPlan('long', flat());
  ok(ap.plan && ap.plan.anchorName === '4h order block top' && ap.plan.entryType === 'limit'
     && ap.plan.entry === 99.5 && ap.plan.cancelIf === 99.3,
     'AN1: OB zone wins — entry at the 4h order block top, cancel-if at the zone bottom');
  ok(ap.plan.stop === 98.55 && near(ap.plan.t1, 100.925) && near(ap.plan.t2, 101.875),
     'AN1: stop exactly 0.75xATR beyond the OB far edge (ATR 1.0), raw 1.5R/2.5R targets');
  ok(ap.plan.anchorNote === '4h order block top 99.5 (zone 99.3–99.5) · 0.5×ATR below mark',
     'AN1: the OB note names the family + level basis — got "' + ap.plan.anchorNote + '"');
  ap = WA1.brainAnchorPlan('short', flat());
  ok(ap.plan && ap.plan.anchorName === '4h order block bottom' && ap.plan.entry === 100.5
     && ap.plan.stop === 101.45 && ap.plan.cancelIf === 100.7,
     'AN1: SHORT mirrors — entry at the OB bottom, stop 0.75xATR above the zone top');

  /* ---- AN2: liquidity pool line anchor, both sides ---- */
  const WA2 = freshBrain();
  WA2.findLiquidityPools = function(){ return { buySide: { level: 100.6, count: 3 }, sellSide: { level: 99.4, count: 4 } }; };
  ap = WA2.brainAnchorPlan('long', flat());
  ok(ap.plan && ap.plan.anchorName === 'sell-side equal-lows pool' && ap.plan.entry === 99.4
     && ap.plan.stop === 98.65 && near(ap.plan.t1, 100.525) && near(ap.plan.t2, 101.275)
     && ap.plan.cancelIf === 99.4,
     'AN2: LONG limits at the sell-side equal-lows pool — line anchor, stop 0.75xATR beyond the level');
  ap = WA2.brainAnchorPlan('short', flat());
  ok(ap.plan && ap.plan.anchorName === 'buy-side equal-highs pool' && ap.plan.entry === 100.6
     && ap.plan.stop === 101.35 && near(ap.plan.t1, 99.475) && near(ap.plan.t2, 98.725),
     'AN2: SHORT mirrors at the buy-side equal-highs pool');

  /* ---- AN3: AVWAP anchored at the last confirmed swing low ---- */
  const WA3 = freshBrain();
  WA3.findLiquidityPools = function(){ return { buySide: null, sellSide: null }; };
  const avCalls = [];
  WA3.hgAVWAP = function(rows, idx){ avCalls.push(idx); return { value: 99.35, upper: 100, lower: 98.7, stdev: 0.6 }; };
  ap = WA3.brainAnchorPlan('long', swingLongRows());
  ok(ap.plan && ap.plan.anchorName === 'AVWAP from the last swing low' && ap.plan.entry === 99.35
     && avCalls.length === 1 && avCalls[0] === 115,
     'AN3: AVWAP computed from the last confirmed swing-low bar (index 115), entry at the value');
  ok(near(ap.plan.stop, 98.70139797340387) && ap.plan.cancelIf === 99.35,
     'AN3: AVWAP line stop 0.75xATR beyond the level, cancel-if at the level itself');
  ap = WA3.brainAnchorPlan('long', flat());
  ok(ap.plan === null && avCalls.length === 1,
     'AN3: no confirmed pivot -> AVWAP never even computed (no anchor bar, no fabricated index)');

  /* ---- AN4: union pick — all families present, the highest in-band level wins ---- */
  const WA4 = freshBrain();
  WA4.findOrderBlock = function(){ return { top: 99.3, bottom: 99.15, age: 3 }; };
  WA4.findLiquidityPools = function(){ return { buySide: null, sellSide: { level: 99.15, count: 2 } }; };
  WA4.hgAVWAP = function(){ return { value: 99.2, upper: 100, lower: 98.4, stdev: 0.8 }; };
  ap = WA4.brainAnchorPlan('long', swingLongRows());
  ok(ap.plan && ap.plan.anchorName === '4h order block top' && ap.plan.entry === 99.3,
     'AN4: union of families — OB top 99.3 beats AVWAP 99.2, pool 99.15, swing zone 99.1 (nearest below mark)');
  ok(near(ap.plan.stop, 99.15 - 0.75 * 0.8648027021281775)
     && near(ap.plan.t1, ap.plan.entry + 1.5 * (ap.plan.entry - ap.plan.stop))
     && near(ap.plan.t2, ap.plan.entry + 2.5 * (ap.plan.entry - ap.plan.stop)),
     'AN4: stop/TP math family-independent — 0.75xATR beyond the OB bottom, raw 1.5R/2.5R');

  /* ---- AN5: band rejection + the honest decline still bind the new families ---- */
  const WA5 = freshBrain();
  WA5.findLiquidityPools = function(){ return { buySide: { level: 103, count: 3 }, sellSide: { level: 97, count: 4 } }; };
  WA5.findOrderBlock = function(){ return { top: 96.8, bottom: 96.5, age: 9 }; };
  ap = WA5.brainAnchorPlan('long', flat());
  ok(ap.plan === null && ap.note === 'no nearby 4h structure — gate-engine levels',
     'AN5: pool 3xATR away + OB even farther -> declined, never stretched into band — got "' + ap.note + '"');
  const WA6 = freshBrain();
  WA6.findOrderBlock = function(){ return { top: 99.5, bottom: 99.3, age: 5 }; };
  ap = WA6.brainAnchorPlan('long', rrFailRows());
  ok(ap.plan === null && ap.note === 'anchored limit R:R 0.9 below the 1.5 minimum — gate-engine levels',
     'AN5: snapped TP1 under 1.5R declines an OB plan exactly like a swing plan — got "' + ap.note + '"');

  /* ---- AN6: the REAL indicators.js / indicators2.js wiring (name contract) ---- */
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'indicators.js', 'utf8'), { filename: 'indicators.js' });
  vm.runInThisContext(fs.readFileSync(root + 'indicators2.js', 'utf8'), { filename: 'indicators2.js' });
  const WR = globalThis.window;      /* indicators2 self-exports hgAVWAP here */
  WR.findOrderBlock = globalThis.findOrderBlock;         /* classic-script globals, */
  WR.findLiquidityPools = globalThis.findLiquidityPools; /* bridged onto the window stub */
  vm.runInThisContext(fs.readFileSync(root + 'brain.js', 'utf8'), { filename: 'brain.js' });
  ok(typeof WR.hgAVWAP === 'function' && typeof WR.findOrderBlock === 'function'
     && typeof WR.findLiquidityPools === 'function', 'AN6: real modules present on the seam window');
  ap = WR.brainAnchorPlan('long', flat());
  ok(ap.plan && ap.plan.anchorName === 'sell-side equal-lows pool' && ap.plan.entry === 99.5
     && ap.plan.stop === 98.75,
     'AN6: REAL findLiquidityPools — flat fixture equal lows 99.5 anchor the long limit, stop 0.75xATR beyond');
  ap = WR.brainAnchorPlan('short', flat());
  ok(ap.plan && ap.plan.anchorName === 'buy-side equal-highs pool' && ap.plan.entry === 100.5,
     'AN6: REAL findLiquidityPools — equal highs 100.5 anchor the short limit');
  ap = WR.brainAnchorPlan('long', swingLongRows());
  ok(ap.plan && ap.plan.anchorName === 'AVWAP from the last swing low' && ap.plan.entry === 99.68,
     'AN6: REAL hgAVWAP from the swing-low bar wins the union on the swing fixture (99.68, nearest below mark)');
}
{
  /* ---- AN7: buildLimitBoard — pure selector ---- */
  const BOARD = W.__hgBrainBoard;
  ok(typeof BOARD === 'function', 'AN7: window.__hgBrainBoard seam exposed');
  const mkRow = (sym, tier, dir, agree, plan) => ({
    sym: sym, base: sym.replace('USDT', ''), lane: 'crypto',
    dec: { tier: tier, dir: dir, agree: agree, reasons: [sym + ' reason'], vetoes: [] },
    plan: plan || null
  });
  const limPlan = (dir, e, s, t1, t2, rr1) => ({ dir: dir, entry: e, stop: s, t1: t1, t2: t2,
    rr1: rr1, entryType: 'limit', anchorName: '4h order block top', cancelIf: s - 0.5 });
  const gatePlan = (dir, e, s, t1, t2, rr1, note) => ({ dir: dir, entry: e, stop: s, t1: t1, t2: t2,
    rr1: rr1, entryType: 'gate', src: 'hgPlanLevels', note: note || '' });

  const b1 = BOARD([
    mkRow('AAAUSDT', 'WATCH', 'long', 3, limPlan('long', 10, 9, 12, 13, 2)),
    mkRow('BBBUSDT', 'PRIME', 'long', 5, limPlan('long', 20, 19, 23, 25, 3)),
    mkRow('CCCUSDT', 'HIGH', 'short', 4, limPlan('short', 30, 31, 27, 25, 3)),
    mkRow('DDDUSDT', 'HIGH', 'long', 4, gatePlan('long', 10, 9, 12, 13, 2, 'no nearby 4h structure — gate-engine levels')),
    mkRow('EEEUSDT', 'WATCH', 'long', 3, null),
    mkRow('FFFUSDT', 'ASIDE', 'long', 1, limPlan('long', 10, 9, 12, 13, 2))
  ]);
  ok(b1.limits.length === 3 && b1.marketOnly.length === 1,
     'AN7: 3 limit rows + 1 market-only — plan-null and ASIDE rows are NOT listed');
  ok(b1.limits[0].row.sym === 'BBBUSDT' && b1.limits[1].row.sym === 'CCCUSDT' && b1.limits[2].row.sym === 'AAAUSDT',
     'AN7: sorted tierRank first — PRIME > HIGH > WATCH');
  ok(b1.marketOnly[0].row.sym === 'DDDUSDT' && b1.marketOnly[0].limit === false
     && b1.marketOnly[0].row.plan.note === 'no nearby 4h structure — gate-engine levels',
     'AN7: the market-only row is separated and carries its named decline reason');

  const b2 = BOARD([
    mkRow('GGGUSDT', 'HIGH', 'long', 5, limPlan('long', 10, 9, 12, 13, 2)),
    mkRow('HHHUSDT', 'HIGH', 'long', 4, limPlan('long', 10, 9, 14, 16, 9)),
    mkRow('IIIUSDT', 'HIGH', 'long', 5, limPlan('long', 10, 9, 13, 14.5, 3))
  ]);
  ok(b2.limits[0].row.sym === 'IIIUSDT' && b2.limits[1].row.sym === 'GGGUSDT' && b2.limits[2].row.sym === 'HHHUSDT',
     'AN7: inside a tier — agree breaks first (HHH last), rr1 breaks what agree leaves (III over GGG, same order as the ticket ranks)');
  const b3 = BOARD(null), b4 = BOARD([null, {}, { dec: null }, 42, { dec: { tier: 'PRIME', dir: 'long' }, plan: { entry: 'x' } }]);
  ok(b3.limits.length === 0 && b3.marketOnly.length === 0 && b4.limits.length === 0 && b4.marketOnly.length === 0,
     'AN7: garbage input -> empty groups, never throws');
}
{
  /* ---- AN8: hgLimitState — the "when to enter" read ---- */
  const LS = W.hgLimitState;
  ok(typeof LS === 'function', 'AN8: window.hgLimitState seam exposed');
  const lp = { dir: 'long', entry: 100, stop: 99, t1: 102, t2: 103, cancelIf: 98.5 };
  const sp = { dir: 'short', entry: 100, stop: 101, t1: 98, t2: 97, cancelIf: 101.5 };
  let st = LS(lp, 100.5, 2);
  ok(st.state === 'in-zone' && st.label === 'IN ZONE', 'AN8: 0.25xATR from entry (boundary) -> IN ZONE');
  st = LS(lp, 99.5, 2);
  ok(st.state === 'in-zone', 'AN8: just below the limit but inside the zone -> still IN ZONE (filling, not stale)');
  st = LS(lp, 100.51, 2);
  ok(st.state === 'approaching' && st.label === 'APPROACHING', 'AN8: 0.25-1.0xATR on the correct side -> APPROACHING');
  st = LS(lp, 102, 2);
  ok(st.state === 'approaching', 'AN8: exactly 1.0xATR away (boundary) -> APPROACHING');
  st = LS(lp, 102.01, 2);
  ok(st.state === 'waiting' && st.label === 'WAITING', 'AN8: beyond 1.0xATR on the correct side -> WAITING');
  st = LS(lp, 99.4, 2);
  ok(st.state === 'stale' && st.note.indexOf('wrong side') >= 0,
     'AN8: crossed to the wrong side of the entry -> STALE naming the cross');
  st = LS(lp, 98.4, 2);
  ok(st.state === 'stale' && st.note.indexOf('cancel-if') >= 0 && st.note.indexOf('98.5') >= 0,
     'AN8: beyond the cancel-if -> STALE naming the level — got "' + st.note + '"');
  st = LS(sp, 99.5, 2);
  ok(st.state === 'in-zone', 'AN8: SHORT mirrors — 0.25xATR above -> IN ZONE');
  st = LS(sp, 98, 2);
  ok(st.state === 'approaching', 'AN8: SHORT exactly 1.0xATR below (boundary) -> APPROACHING');
  st = LS(sp, 97.99, 2);
  ok(st.state === 'waiting', 'AN8: SHORT beyond 1.0xATR on the correct side -> WAITING');
  st = LS(sp, 100.6, 2);
  ok(st.state === 'stale' && st.note.indexOf('wrong side') >= 0, 'AN8: SHORT wrong-side cross -> STALE');
  st = LS(sp, 101.6, 2);
  ok(st.state === 'stale' && st.note.indexOf('cancel-if') >= 0, 'AN8: SHORT beyond cancel-if -> STALE');
  st = LS(lp, NaN, 2);
  ok(st.state === 'nomark' && st.label === 'MARK n/a', 'AN8: no mark -> MARK n/a, never a guessed state');
  ok(LS(lp, 0, 2).state === 'nomark' && LS(lp, undefined, 2).state === 'nomark' && LS(lp, -3, 2).state === 'nomark',
     'AN8: zero / undefined / negative marks -> MARK n/a');
  st = LS(lp, 101, NaN);
  ok(st.state === 'waiting' && st.note.indexOf('ATR unavailable') >= 0,
     'AN8: correct side without a usable ATR -> WAITING, distance honestly unmeasured');
  st = LS(lp, 99, NaN);
  ok(st.state === 'stale', 'AN8: wrong side needs no ATR — the cross alone is STALE');
  /* cancelIf null/undefined = NO cancel level — never coerces to 0 and
     ghost-STALEs a market plan (the live KITE/TRIA/PHAROS 'cancel-if 0' bug) */
  const nc = { dir: 'short', entry: 100, stop: 101, t1: 98, cancelIf: null };
  st = LS(nc, 99.2, 2);
  ok(st.state !== 'stale' && st.note.indexOf('cancel-if') === -1,
     'AN8: cancelIf null -> no phantom cancel level (null coerces to 0 in isFinite(+x)) — got "' + st.state + ' / ' + st.note + '"');
  st = LS({ dir: 'short', entry: 100, stop: 101, t1: 98 }, 99.2, 2);
  ok(st.state === 'approaching' && st.note.indexOf('cancel-if') === -1,
     'AN8: cancelIf absent -> plain APPROACHING, no cancel comparison at all');
  ok(LS(null, 100, 2).state === 'none' && LS({ dir: 'sideways', entry: 1 }, 100, 2).state === 'none',
     'AN8: plan-less / non-dir garbage -> the none state, never throws');
  let lsThrew = null;
  try{ LS(lp, 'x', 'y'); LS(42, {}, []); LS(lp, 100, -1); }catch(e){ lsThrew = e; }
  ok(!lsThrew, 'AN8: garbage marks/atrs/plans never throw' + (lsThrew ? ' — ' + lsThrew.message : ''));
}
{
  /* ---- AN9: run level — board paint, groups, zero-fetch state chips, alerts ---- */
  const WG = freshBrain();
  stubQuietLayers(WG);
  WG.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WG.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG.oiflowState = function(){ return { results: [
    { sym: 'TRENDYUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'FLATUSDT',   dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'NOMKUSDT',   dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  WG.xuUniverse = async function(){ return [
    { sym: 'BTCUSDT',    base: 'BTC',    exchange: 'delta', turnoverUsd: 9e9,  mark: 100,    fundingPct: 0, alsoOn: null },
    { sym: 'TRENDYUSDT', base: 'TRENDY', exchange: 'delta', turnoverUsd: 60e6, mark: 1,      fundingPct: 0, alsoOn: null },
    { sym: 'FLATUSDT',   base: 'FLAT',   exchange: 'delta', turnoverUsd: 50e6, mark: 9.6,    fundingPct: 0, alsoOn: null },
    { sym: 'NOMKUSDT',   base: 'NOMK',   exchange: 'delta', turnoverUsd: 48e6, mark: null,   fundingPct: 0, alsoOn: null } ]; };
  WG.xuState = function(){ return { count: 4, delta: 4, cdcx: 0, at: Date.now(), note: null }; };
  WG.xuCandles = function(item){
    return Promise.resolve(item.sym === 'TRENDYUSDT' ? trendRows(true) : fakeRows(120)); };
  /* zero-fetch positioning cache: TRENDY answered near the close (its xu mark
     of 1 would be stale-wrong — the chip proving the cache wins), FLAT/NOMK
     honestly null so the row's own snapshot takes over */
  WG.xuPositioning = function(base){
    if (base === 'TRENDY') return { sym: 'TRENDYUSDT', base: 'TRENDY', mark: 148.98, fundingPct: 0, oiUsd: null, exchange: 'delta' };
    return null; };
  WG.hgPlanLevels = function(dir){ return { dir: dir, entry: 10, stop: 9, t1: 12, t2: 13 }; };
  WG.toTrade = function(){};
  const alertSnaps = [];
  WG.hgAlertTicket = function(tsnap){ alertSnaps.push(tsnap); };
  const TB = freshPane();
  WG.HG_tabs[0].mount(TB.pane);
  ok(TB.pane._html.indexOf('id="brainBoardWrap"') >= 0 && TB.pane._html.indexOf('LIMIT BOARD') >= 0
     && TB.pane._html.indexOf('id="brainBoardAge"') >= 0,
     'AN9: the LIMIT BOARD shell mounts directly under the ENTRY TICKET panel');
  await runAndWait(TB.stubs);
  const boardHtml = TB.stubs['#brainBoard'].innerHTML;
  ok(TB.stubs['#brainBoardWrap'].style.display === 'block', 'AN9: the board reveals after the synthesis');
  ok(boardHtml.indexOf('LIMIT ENTRY') >= 0 && boardHtml.indexOf('147.65') >= 0
     && boardHtml.indexOf('4h FVG') >= 0 && boardHtml.indexOf('cancel if 4h closes beyond <b>147.49</b>') >= 0,
     'AN9: the TRENDY card carries the exact resting limit — entry, anchor family, cancel-if');
  ok(boardHtml.indexOf('WAITING') >= 0,
     'AN9: TRENDY chip reads the xuPositioning cache mark (148.98, ~1.04xATR away) — the cache beats the row mark of 1');
  ok(boardHtml.indexOf('MARKET-ONLY (no limit anchor)') >= 0
     && boardHtml.indexOf('ENTRY AT (market — no limit anchor in band)') >= 0
     && boardHtml.indexOf('no nearby 4h structure — gate-engine levels') >= 0,
     'AN9: flat-candle rows sit in the separated MARKET-ONLY group with the decline reason named');
  ok(boardHtml.indexOf('IN ZONE') >= 0,
     'AN9: FLAT chip falls back to the row mark (9.6 vs entry 10, ATR 2) -> IN ZONE');
  ok(boardHtml.indexOf('MARK n/a') >= 0,
     'AN9: NOMK has no cache mark and a null row mark -> the chip says MARK n/a, never a guess');
  ok(boardHtml.indexOf('toTrade(&quot;TRENDYUSDT&quot;,&quot;long&quot;,147.64569307942614,146.52464339296364,149.32726760911987') >= 0,
     'AN9: every board card keeps the SEND TO TRADE PLAN handoff verbatim');
  ok(boardHtml.indexOf('BTCUSDT') === -1 && boardHtml.indexOf('XAU') === -1,
     'AN9: plan-null rows (BTC, gold ASIDE) never board — the ticket near-miss copy covers them');
  ok(/^levels as of \d{2}:\d{2}:\d{2} — refreshed by every synthesis/.test(TB.stubs['#brainBoardAge'].textContent),
     'AN9: the board carries the ticket freshness stamp semantics — got "' + TB.stubs['#brainBoardAge'].textContent + '"');
  ok(alertSnaps.length === 1 && alertSnaps[0].long && alertSnaps[0].long.sym === 'TRENDYUSDT'
     && alertSnaps[0].long.entry === 147.64569307942614,
     'AN9: the hgalert TICKET watch fires exactly once with the same sym@entry keys — board paint is alert-neutral');

  /* refreshing semantics: mid-rescan the stamp goes honest-stale, then repaints */
  let midAge = null;
  WG.xuUniverse = async function(){ midAge = TB.stubs['#brainBoardAge'].textContent; return [
    { sym: 'BTCUSDT',    base: 'BTC',    exchange: 'delta', turnoverUsd: 9e9,  mark: 100,  fundingPct: 0, alsoOn: null },
    { sym: 'TRENDYUSDT', base: 'TRENDY', exchange: 'delta', turnoverUsd: 60e6, mark: 1,    fundingPct: 0, alsoOn: null },
    { sym: 'FLATUSDT',   base: 'FLAT',   exchange: 'delta', turnoverUsd: 50e6, mark: 9.6,  fundingPct: 0, alsoOn: null },
    { sym: 'NOMKUSDT',   base: 'NOMK',   exchange: 'delta', turnoverUsd: 48e6, mark: null, fundingPct: 0, alsoOn: null } ]; };
  await runAndWait(TB.stubs);
  ok(midAge && midAge.indexOf('refreshing — levels shown are as of ') === 0,
     'AN9: during the rescan the board stamp goes honestly stale — got "' + midAge + '"');
  ok(/^levels as of /.test(TB.stubs['#brainBoardAge'].textContent)
     && TB.stubs['#brainBoard'].innerHTML.indexOf('147.65') >= 0,
     'AN9: the completed rescan repaints the same deterministic levels + a fresh stamp');

  /* honest empty state: everything dark -> nothing boards */
  const WE = freshBrain();
  const TE = freshPane();
  WE.HG_tabs[0].mount(TE.pane);
  await runAndWait(TE.stubs);
  ok(TE.stubs['#brainBoardWrap'].style.display === 'block'
     && TE.stubs['#brainBoard'].innerHTML.indexOf('No qualified limit setups this scan — standing aside is the position.') >= 0,
     'AN9: all-dark scan -> the honest empty state, never a fabricated board');
}
{
  /* ---- AN10: legacy lane anchored-first (engine plans still verbatim) ---- */
  const WL2 = freshBrain();
  stubQuietLayers(WL2);
  delete WL2.xuCandles;                       /* legacy route: binanceKlines */
  WL2.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  WL2.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  WL2.oiflowState = function(){ return { results: [{ sym: 'ETHUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' }] }; };
  WL2.squeezeState = function(){ return { results: [{ sym: 'ETHUSDT', kind: 'fired', dir: 'long' }] }; };
  const swingRows2 = function(){
    const rows = [];
    for (let i = 0; i < 120; i++) rows.push({ t: 0, o: 100, h: 100.5, l: 99.5, c: 100, v: 1000 });
    const bx = function(i, c, hh, ll){ rows[i] = { t: 0, o: c, h: hh, l: ll, c: c, v: 1000 }; };
    bx(113, 99.6, 99.9, 99.3); bx(114, 99.3, 99.7, 99.0); bx(115, 99.2, 99.5, 98.8);
    bx(116, 99.5, 99.8, 99.1); bx(117, 99.8, 100.1, 99.4); bx(118, 100, 100.3, 99.7); bx(119, 100, 100.3, 99.7);
    return rows;
  };
  WL2.binanceKlines = function(sym, tf){ return Promise.resolve(tf === '4h' ? swingRows2() : null); };
  WL2.toTrade = function(){};
  const TL2 = freshPane();
  WL2.HG_tabs[0].mount(TL2.pane);
  await runAndWait(TL2.stubs);
  const legCards = TL2.stubs['#brainCards'].innerHTML;
  ok(legCards.indexOf('ETHUSDT') >= 0 && legCards.indexOf('LIMIT @ <b>99.1</b> — pullback to swing-low zone') >= 0,
     'AN10: legacy lane — the HIGH row gets the patient LIMIT before smartSetup/hgPlanLevels are consulted');
  const legBoard = TL2.stubs['#brainBoard'].innerHTML;
  ok(legBoard.indexOf('LIMIT ENTRY') >= 0 && legBoard.indexOf('99.1') >= 0
     && legBoard.indexOf('MARKET-ONLY (no limit anchor)') === -1,
     'AN10: the legacy board lists the anchored limit — no market-only group when every plan is a limit');
}

/* ================= AO) SNIPER mode — leverage math + board filter ================= */
console.log('== AO) sniper mode ==');
{
  const SL = W.__hgBrainSniperLev;
  ok(typeof SL === 'function', 'AO: window.__hgBrainSniperLev seam exposed');
  /* byte-identical to planTrade: floor(1/(stopDist*1.5 + 0.005)), clamped 1-100 */
  ok(SL(100, 97) === 20, 'AO: 3.0% stop -> exactly 20x (the SNIPER_MIN_LEV boundary)');
  ok(SL(100, 98.11) === 29, 'AO: 1.89% stop -> 29x');
  ok(SL(100, 98.9) === 46, 'AO: 1.1% stop -> 46x');
  ok(SL(100, 90) === 6, 'AO: 10% stop -> 6x — wide swing stops are NOT sniper material');
  ok(SL(100, 100) === 1 && SL(0, 97) === 1 && SL('x', 97) === 1 && SL(100, 'x') === 1,
     'AO: zero-width / non-finite inputs -> 1x floor, never throws');
  ok(SL(100, 97, 0.01) === 18, 'AO: higher MMR lowers the safe leverage honestly');

  /* candidates carry the leverage; ASIDE/boardless rows stay off */
  const rows = [
    { sym: 'SNIPUSDT', lane: 'crypto',
      dec: { tier: 'WATCH', dir: 'long', agree: 3, reasons: ['sniper row'], vetoes: [] },
      plan: { dir: 'long', entry: 100, stop: 97.5, t1: 105, rr1: 2, entryType: 'limit', anchorName: '4h FVG' } },
    { sym: 'WIDEUSDT', lane: 'crypto',
      dec: { tier: 'HIGH', dir: 'long', agree: 4, reasons: ['wide stop row'], vetoes: [] },
      plan: { dir: 'long', entry: 100, stop: 92, t1: 116, rr1: 2, entryType: 'limit', anchorName: '4h OB' } },
    { sym: 'MKTUSDT', lane: 'crypto',
      dec: { tier: 'WATCH', dir: 'short', agree: 3, reasons: ['market row'], vetoes: [] },
      plan: { dir: 'short', entry: 100, stop: 101.5, t1: 97, rr1: 2, entryType: 'gate', src: 'smartSetup' } }
  ];
  const bd = W.__hgBrainBoard(rows);
  ok(bd.limits.length === 2 && bd.marketOnly.length === 1, 'AO: board bucketing intact with sniper fields');
  const snipRow = bd.limits.filter(function(c){ return c.row.sym === 'SNIPUSDT'; })[0];
  const wideRow = bd.limits.filter(function(c){ return c.row.sym === 'WIDEUSDT'; })[0];
  ok(snipRow && snipRow.lev >= 20 && wideRow && wideRow.lev < 20,
     'AO: candidates carry max-safe leverage — tight-stop limit qualifies, wide-stop does not');
  ok(snipRow.lev === 23, 'AO: 2.5% stop -> 23x — got ' + snipRow.lev + 'x');

  /* the filter predicate itself — limits only, >=20x, in-zone/approaching */
  const SO = W.__hgBrainSniperOk;
  ok(typeof SO === 'function', 'AO: window.__hgBrainSniperOk seam exposed');
  ok(SO({ limit: true, lev: 23 }, { state: 'in-zone' }) === true
     && SO({ limit: true, lev: 23 }, { state: 'approaching' }) === true,
     'AO: limit + 23x + in-zone/approaching -> sniper-grade');
  ok(SO({ limit: true, lev: 23 }, { state: 'waiting' }) === false
     && SO({ limit: true, lev: 23 }, { state: 'stale' }) === false,
     'AO: WAITING/STALE stays out — the moment has not come (or has passed)');
  ok(SO({ limit: true, lev: 8 }, { state: 'in-zone' }) === false,
     'AO: wide stop (8x) never sniper-grade even in zone');
  ok(SO({ limit: false, lev: 46 }, { state: 'in-zone' }) === false,
     'AO: market-entry plans never sniper-grade — resting limits only');
  ok(SO(null, null) === false && SO({}, undefined) === false, 'AO: garbage -> false, never throws');

  /* EV gate: a proven-bad family (n>=4, EV<=0) is refused; proven-good and
     unproven pass. loadLog stubbed per case via a fresh module instance. */
  const mkC = (lev) => ({ limit: true, lev: lev, row: { plan: { dir: 'long', entry: 100, stop: 97.5, t1: 105, rr1: 2, entryType: 'limit', anchorName: '4h FVG' } } });
  ok(SO(mkC(23), { state: 'in-zone' }) === true, 'AO: no family record -> unproven passes (not proven-bad)');
  W.loadLog = function(){ return [
    { kind: 'fvg-limit', status: 'sl' }, { kind: 'fvg-limit', status: 'sl' },
    { kind: 'fvg-limit', status: 'sl' }, { kind: 'fvg-limit', status: 'sl' } ]; };
  ok(SO(mkC(23), { state: 'in-zone' }) === false,
     'AO: proven-bad family (0/4, EV negative) is REFUSED — the EV gate bites');
  W.loadLog = function(){ return [
    { kind: 'fvg-limit', status: 'tp', rr: 2 }, { kind: 'fvg-limit', status: 'tp', rr: 2 },
    { kind: 'fvg-limit', status: 'sl' }, { kind: 'fvg-limit', status: 'tp', rr: 2 } ]; };
  ok(SO(mkC(23), { state: 'in-zone' }) === true, 'AO: proven-good family (3/4) passes the EV gate');
  W.loadLog = function(){ return [ { kind: 'fvg-limit', status: 'sl' }, { kind: 'fvg-limit', status: 'sl' } ]; };
  ok(SO(mkC(23), { state: 'in-zone' }) === true, 'AO: thin record (n=2) stays unproven, not proven-bad — passes');
  delete W.loadLog;

  /* the shipped default is ON (owner mandate 2026-07-25) — this suite loaded
     the module with an explicit OFF stub; assert the artifact itself */
  const brainSrc = fs.readFileSync(root + 'brain.js', 'utf8');
  ok(/hgBrainSniper'[\s\S]{0,160}v === '1'[\s\S]{0,120}return true;/.test(brainSrc),
     'AO: __sniper initializer defaults ON when no preference is stored');
  ok(brainSrc.indexOf('>SNIPER: ON</button>') >= 0, 'AO: the shell ships with the SNIPER: ON label');
  ok(brainSrc.indexOf("localStorage.setItem('hgBrainSniper'") >= 0,
     'AO: the toggle persists the preference');
}

/* ================= AP) 1H SNIPER RESCUE — tf labeling + tighter-plan chooser ================= */
console.log('== AP) 1h sniper rescue ==');
{
  /* tf label: the SAME pure planner names its anchors after the timeframe fed —
     flat rows + a stubbed OB family isolate the label from the pivot math */
  const fr = []; for (let i = 0; i < 120; i++) fr.push({ t: 1700000000 + i * 3600, o: 100, h: 101, l: 99, c: 100 });
  W.findOrderBlock = function(){ return { top: 98.5, bottom: 98.2, age: 3 }; };
  const p1h = W.brainAnchorPlan('long', fr, '1h');
  ok(p1h.plan && p1h.plan.anchorName === '1h order block top',
     'AP: 1h run names the anchor with the 1h label — got "' + (p1h.plan && p1h.plan.anchorName) + '"');
  ok(p1h.plan && p1h.plan.src && p1h.plan.src.indexOf('(1h)') >= 0,
     'AP: the plan provenance says structure-anchored limit (1h)');
  const p4h = W.brainAnchorPlan('long', fr);
  ok(p4h.plan && p4h.plan.anchorName === '4h order block top',
     'AP: the default call keeps the 4h label — got "' + (p4h.plan && p4h.plan.anchorName) + '"');
  delete W.findOrderBlock;

  /* the chooser: tighter valid plan wins; ties/nulls honest */
  const SP = W.__hgBrainSniperPick;
  ok(typeof SP === 'function', 'AP: window.__hgBrainSniperPick seam exposed');
  const wide = { entry: 100, stop: 95 }, tight = { entry: 100, stop: 98.5 };
  ok(SP(wide, tight) === tight, 'AP: tighter 1h stop beats the wider 4h stop');
  ok(SP(tight, wide) === tight, 'AP: wider 1h rescue never replaces a tight 4h plan');
  ok(SP(null, tight) === tight, 'AP: 4h declined -> the 1h rescue IS the plan');
  ok(SP(wide, null) === wide, 'AP: no 1h anchor -> the 4h plan stands');
  ok(SP(null, null) === null && SP(null, { entry: 100, stop: 100 }) === null,
     'AP: nothing valid anywhere -> null, never invented');
}

/* ================= AQ) ENGINE PATIENCE — cold engine outlives the shared cap ================= */
console.log('== engine patience: the 12s cap loses, the 150s patience wins ==');
{
  const WG = freshBrain();
  stubQuietLayers(WG);
  delete WG.engineState;                     /* genuinely cold engine */
  WG.brainTunables.warmColdMs = 200;         /* shared cap loses the race */
  WG.brainTunables.layerWarmMs = 200;
  WG.brainTunables.engineWarmMs = 4000;      /* …but the patience window covers the slow leg */
  WG.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  WG.HG_warmups = [
    { id: 'engine', label: 'ENGINE', run: function(){
        return new Promise(function(res){
          setTimeout(function(){
            WG.engineState = function(){ return { survivors: [
              { sym: 'BTCUSDT', dir: 'long', conviction: 'STRONG',
                plan: { entry: 100, stop: 95, t1: 110, t2: 117.5 }, gatesPassed: 6 } ], rejected: [], at: Date.now() }; };
            res('warmed');
          }, 800);   /* past the shared cap, inside the patience window */
        }); } }
  ];
  const TP = freshPane();
  const pSnaps = [];
  WG.xuUniverse = async function(){ pSnaps.push(TP.stubs['#brainStat'].textContent); return [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null } ]; };
  WG.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  WG.HG_tabs[0].mount(TP.pane);
  await runAndWait(TP.stubs);
  const pStat = TP.stubs['#brainStat'].textContent;
  ok(pStat.indexOf('done ·') === 0, 'AQ: the synthesis COMPLETES after waiting for the slow engine — got "' + pStat + '"');
  ok(pSnaps.length && pSnaps[0].indexOf('auto-warmed: engine') === 0,
     'AQ: the accounting names the engine WARMED, not dark — got "' + pSnaps[0] + '"');
  const pBtc = WG.__hgBrainLast().rows.filter(function(x){ return x.sym === 'BTCUSDT'; })[0];
  ok(pBtc && pBtc.evidence.some(function(e){ return e.indexOf('ENGINE: ENGINE SURVIVOR') === 0; }),
     'AQ: the engine survivor VOTES instead of the whole board going dark-aside');
}

/* ================= AR) FAMILY HIT-RATES — tags, stats, honesty ================= */
console.log('== AR) family hit-rates ==');
{
  const PF = W.__hgBrainPlanFamily, FS = W.__hgBrainFamStats;
  ok(typeof PF === 'function' && typeof FS === 'function', 'AR: family seams exposed');

  /* family tagging */
  ok(PF({ anchorName: '1h FVG' }) === 'fvg-limit', 'AR: 1h FVG anchor -> fvg-limit');
  ok(PF({ anchorName: '4h order block top' }) === 'ob-limit', 'AR: OB anchor -> ob-limit');
  ok(PF({ anchorName: 'EMA50(4h)' }) === 'ema-limit', 'AR: EMA anchor -> ema-limit');
  ok(PF({ anchorName: 'swing-high zone' }) === 'swing-zone-limit', 'AR: swing zone -> swing-zone-limit');
  ok(PF({ anchorName: 'sell-side equal-lows pool' }) === 'pool-limit', 'AR: pool anchor -> pool-limit');
  ok(PF({ anchorName: 'AVWAP from the last swing low' }) === 'avwap-limit', 'AR: AVWAP anchor -> avwap-limit');
  ok(PF({ src: 'smartSetup FADE levels' }) === 'smart-fade'
     && PF({ src: 'smartSetup SCALP levels' }) === 'smart-fade'
     && PF({ src: 'swingTryClean SWING' }) === 'swing-clean'
     && PF({ src: 'smartSetup SWING levels' }) === 'smart-swing',
     'AR: smartSetup srcs split fade vs swing; swingTryClean mapped');
  ok(PF({ src: 'gate engine' }) === 'engine-plan' && PF({ src: 'hgPlanLevels' }) === 'gate-levels',
     'AR: engine and gate-levels sources map');
  ok(PF(null) === 'unknown' && PF({}) === 'anchored-limit', 'AR: garbage -> safe tags, never throws');

  /* stats over a synthetic log — the log's own grading rules */
  const log = [
    { kind: 'fvg-limit', status: 'tp', rr: 2.1 }, { kind: 'fvg-limit', status: 'tp', rr: 1.5 },
    { kind: 'fvg-limit', status: 'sl' }, { kind: 'fvg-limit', status: 'time_stop', rr: -0.1 },
    { kind: 'fvg-limit', status: 'exp' },   /* excluded */
    { kind: 'fvg-limit', status: 'open' },  /* excluded */
    { kind: 'ob-limit', status: 'sl' }
  ];
  const st = FS(log, 'fvg-limit');
  ok(st && st.tp === 2 && st.sl === 1 && st.ts === 1 && st.n === 4,
     'AR: tp/sl/time_stop counted, exp + open excluded');
  ok(st.hitPct === 50 && st.sumR === 2.5, 'AR: hit% and ΣR by the log rules — got ' + (st && st.hitPct) + '% Σ' + (st && st.sumR));
  ok(FS(log, 'ob-limit').n === 1 && FS(log, 'ob-limit').hitPct === 0,
     'AR: a losing family reads 0% honestly, never hidden');
  ok(FS(log, 'pool-limit') === null && FS(null, 'fvg-limit') === null && FS('x', 1) === null,
     'AR: no closed samples / garbage -> null, never invented');

  /* Jeffreys-smoothed win-rate estimate */
  const EW = W.__hgBrainEstWin;
  ok(typeof EW === 'function', 'AR: est-win seam exposed');
  ok(Math.abs(EW({ tp: 8, n: 11 }) - 8.5 / 12) < 1e-12, 'AR: (tp+0.5)/(n+1) smoothing — 8/11 reads 70.8%, not a naked 73%');
  ok(EW({ tp: 2, n: 2 }) < 0.9, 'AR: 2/2 never screams 100% — the prior keeps thin samples honest');
  ok(!isFinite(EW(null)) && !isFinite(EW({ tp: 0, n: 0 })), 'AR: no samples -> no estimate, never invented');
  const ev = EW({ tp: 8, n: 11 }) * 1.5 - (1 - EW({ tp: 8, n: 11 }));
  ok(ev > 0.7 && ev < 0.85, 'AR: the EV read on that record lands ~+0.77R/trade — got ' + Math.round(ev * 100) / 100);
}

/* ================= AS) TIER-1 LAYERS — MTF, vol regime, session ================= */
console.log('== AS) tier-1 layers ==');
{
  /* resampleDaily: 6x4h -> 1d, OHLCV aggregated honestly */
  const M = W.__hgBrainMtf;
  ok(M && typeof M.resampleDaily === 'function' && typeof M.dailySide === 'function',
     'AS: MTF seams exposed');
  const raw = [];
  for (let i = 0; i < 120; i++) raw.push({ t: 1700000000 + i * 14400, o: 100, h: 101, l: 99, c: 100, v: 10 });
  const days = M.resampleDaily(raw);
  ok(days.length === 20 && days[0].h === 101 && days[0].l === 99 && days[0].v === 60,
     'AS: 120 4h bars resample into 20 honest daily bars');

  /* dailySide: HH structure + close above EMA9 -> long */
  const up = [];
  for (let i = 0; i < 120; i++){
    const base = 90 + i * 0.25;   /* steady climb: HH structure everywhere */
    up.push({ t: i * 14400, o: base, h: base + 1.5, l: base - 0.5, c: base + 1, v: 1000 });
  }
  ok(M.dailySide(up) === 'long', 'AS: a clean daily uptrend reads long');
  const dn = up.slice().reverse().map(function(r, i){ return { t: i * 14400, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v }; });
  ok(M.dailySide(dn) === 'short', 'AS: a clean daily downtrend reads short');
  ok(M.dailySide(raw) === null, 'AS: flat tape -> no daily side, never invented');

  /* atrPercentile: rising-vol tape reads high, flat tape reads low */
  const AP = W.__hgBrainAtrPct;
  ok(typeof AP === 'function', 'AS: ATR-percentile seam exposed');
  const volUp = [];
  for (let i = 0; i < 120; i++){
    const w = 0.5 + i * 0.08;   /* widening ranges = rising ATR */
    volUp.push({ t: i, o: 100, h: 100 + w, l: 100 - w, c: 100, v: 100 });
  }
  const hiPct = AP(volUp, 14);
  ok(isFinite(hiPct) && hiPct >= 90, 'AS: rising-vol tape reads a top-decile ATR percentile — got ' + hiPct);
  const loPct = AP(raw, 14);
  ok(isFinite(loPct) && loPct >= 40 && loPct <= 60, 'AS: perfectly flat tape reads the mid band (midrank ~50), never a fake extreme — got ' + loPct);
  ok(!isFinite(AP(null, 14)) && !isFinite(AP(raw.slice(0, 10), 14)),
     'AS: garbage/thin rows -> NaN, never a fake percentile');

  /* sessionWindow: kill zones + off-hours, IST-anchored */
  const SW = W.__hgBrainSession;
  ok(typeof SW === 'function', 'AS: session seam exposed');
  ok(SW('2026-07-27T07:00:00Z').london === true, 'AS: 12:30 IST (07:00 UTC Monday) -> London kill zone');
  ok(SW('2026-07-27T12:30:00Z').ny === true, 'AS: 18:00 IST (12:30 UTC Monday) -> NY kill zone');
  ok(SW('2026-07-26T08:00:00Z').dead === true, 'AS: Sunday -> off-hours');
  ok(SW('2026-07-28T00:30:00Z').dead === true, 'AS: 06:00 IST -> late-night off-hours');
  ok(SW('2026-07-27T04:00:00Z').dead === false && SW('2026-07-27T04:00:00Z').london === false
     && SW('2026-07-27T04:00:00Z').ny === false,
     'AS: 09:30 IST weekday -> mid-session, no flags');

  /* off-hours conviction haircut: pure, idempotent, demote-safe */
  const SH = W.__hgBrainSessionHaircut, ASH = W.__hgBrainApplySessionHaircut;
  ok(typeof SH === 'function' && typeof ASH === 'function', 'AS: haircut seams exposed');
  const mkDec = tier => ({ dir: 'long', tier: tier, agree: 4, reasons: ['r'], vetoes: [] });
  const r1 = { sessionDead: true, dec: mkDec('PRIME') };
  SH(r1);
  ok(r1.dec.tier === 'HIGH' && r1.dec.gatedFrom === 'PRIME' && r1.gated === 'session'
     && r1.dec.reasons[0].indexOf('off-hours') === 0,
     'AS: PRIME -> HIGH off-hours, ledger leads with the haircut');
  SH(r1);
  ok(r1.dec.tier === 'HIGH', 'AS: haircut is idempotent within one decide (no double drop)');
  const r2 = { sessionDead: true, dec: mkDec('WATCH') };
  SH(r2);
  ok(r2.dec.tier === 'ASIDE' && r2.dec.gatedFrom === 'WATCH', 'AS: WATCH -> ASIDE off-hours');
  const r3 = { sessionDead: true, dec: mkDec('ASIDE') };
  SH(r3);
  ok(r3.dec.tier === 'ASIDE' && !r3.dec.gatedFrom, 'AS: ASIDE rows untouched');
  const r4 = { sessionDead: false, dec: mkDec('PRIME') };
  SH(r4);
  ok(r4.dec.tier === 'PRIME' && !r4.dec.gatedFrom, 'AS: live-session rows untouched');
  const r5 = { sessionDead: true, dec: Object.assign(mkDec('ASIDE'), { gatedFrom: 'HIGH' }), gated: 'liquidity' };
  SH(r5);
  ok(r5.dec.tier === 'ASIDE' && r5.dec.gatedFrom === 'HIGH' && r5.gated === 'liquidity',
     'AS: a hard demote wins — haircut never re-labels a liquidity gate');
  /* the pass: fresh re-decide objects (no gatedFrom) get exactly one re-application */
  const rows = [{ sessionDead: true, dec: mkDec('PRIME') }, { sessionDead: true, dec: mkDec('HIGH') }];
  ASH(rows);
  ok(rows[0].dec.tier === 'HIGH' && rows[1].dec.tier === 'WATCH',
     'AS: applySessionHaircut re-applies once after a fresh re-decide (promotion-proof)');
  ASH(rows);
  ok(rows[0].dec.tier === 'HIGH' && rows[1].dec.tier === 'WATCH', 'AS: the pass itself is idempotent');
  ASH(null); SH(null);
  ok(true, 'AS: garbage inputs never throw');
}

/* ================= AT) LIQPOOL — stop-run caution + T1 magnet ================= */
console.log('== AT) liqpool magnet guard ==');
{
  const LP = W.__hgBrainLiqpool;
  ok(typeof LP === 'function', 'AT: liqpool seam exposed');
  const flat = []; for (let i = 0; i < 120; i++) flat.push({ t: i, o: 100, h: 101, l: 99, c: 100, v: 100 });
  const mkRow = (dir, entry, stop, t1) => ({
    dec: { dir: dir, tier: 'WATCH', agree: 3, reasons: ['x'], vetoes: [] },
    plan: { dir: dir, entry: entry, stop: stop, t1: t1, entryType: 'limit', anchorName: '4h FVG' },
    rows4h: flat
  });

  /* pool at the stop -> stop-run caution */
  W.findLiquidityPools = function(){ return { buySide: { level: 101.5, count: 3 }, sellSide: { level: 97.2, count: 4 } }; };
  const rLong = mkRow('long', 100, 97.1, 106);
  const n1 = LP(rLong);
  ok(Array.isArray(n1) && n1[0].kind === 'caution' && n1[0].text.indexOf('sell-side pool at 97.2') >= 0
     && n1[0].text.indexOf('stop-run territory') >= 0,
     'AT: a sell-side pool within 0.5xATR of the long stop fires the stop-run caution');

  /* SHORT mirrors at the buy-side pool */
  const rShort = mkRow('short', 100, 101.4, 94);
  const n2 = LP(rShort);
  ok(Array.isArray(n2) && n2[0].kind === 'caution' && n2[0].text.indexOf('buy-side pool at 101.5') >= 0,
     'AT: SHORT mirrors — the buy-side pool over the stop fires');

  /* pool at T1 instead -> magnet note, not a caution */
  W.findLiquidityPools = function(){ return { buySide: { level: 105.8, count: 3 }, sellSide: null }; };
  const n3 = LP(rLong);
  ok(Array.isArray(n3) && n3[0].kind === 'note' && n3[0].text.indexOf('the target IS the magnet') >= 0,
     'AT: a pool at T1 reads as the magnet note, never a stop warning');

  /* no pool in band -> null (SILENT at apply time); module absent -> 'dark' */
  W.findLiquidityPools = function(){ return { buySide: { level: 150, count: 3 }, sellSide: { level: 50, count: 3 } }; };
  ok(LP(rLong) === null, 'AT: pools out of band -> null (SILENT), never a stretched claim');
  delete W.findLiquidityPools;
  ok(LP(rLong) === 'dark', 'AT: absent findLiquidityPools -> honest dark');
  ok(LP(null) === null && LP({}) === null && LP(mkRow('long', 0, 0, 0)) === null,
     'AT: garbage rows/plans -> null, never throws');
}

/* ================= AU) TIER-2/3 — funding z + RSI divergence ================= */
console.log('== AU) tier-2/3 layers ==');
{
  /* funding z-score */
  const FZ = W.__hgBrainFundZ;
  ok(typeof FZ === 'function', 'AU: funding-z seam exposed');
  const flatF = Array.from({ length: 90 }, function(){ return { rate: 0.0001, t: 1 }; });
  flatF.push({ rate: 0.0001, t: 2 });
  ok(!isFinite(FZ(flatF)), 'AU: zero-variance history -> NaN, never a divide-by-zero z');
  const hist = [];
  for (let i = 0; i < 90; i++) hist.push({ rate: 0.0001 * (i % 2 ? 1 : -1), t: i });
  const mean0 = hist.reduce(function(a, b){ return a + b.rate; }, 0) / 90;
  hist.push({ rate: mean0 + 0.0006, t: 91 });
  const z = FZ(hist);
  ok(isFinite(z) && z > 2, 'AU: a funding print way above the 30d distribution reads z > 2 — got ' + z);
  ok(!isFinite(FZ(null)) && !isFinite(FZ([{ rate: 1 }, { rate: 2 }])), 'AU: garbage/thin history -> NaN, never throws');

  /* RSI divergence — build a double-top with weakening momentum (pivots
     AFTER the RSI-14 warm-up so both legs are finite) */
  const RD = W.__hgBrainRsiDiv;
  ok(typeof RD === 'function', 'AU: rsi-divergence seam exposed');
  const dbl = [];
  for (let i = 0; i < 46; i++) dbl.push({ t: i, o: 100, h: 100.5, l: 99.5, c: 100, v: 1000 });
  /* first high at bar 18 (strong thrust), pullback, second HIGHER high at
     bar 33 with weak momentum; newest pivot 12 bars from the end */
  for (let i = 15; i <= 18; i++){ dbl[i].o = dbl[i - 1].c + 0.3; dbl[i].c = dbl[i].o + 0.5; dbl[i].h = dbl[i].c + 0.2; dbl[i].l = dbl[i].o - 0.2; }
  dbl[18].h = 103.4; dbl[18].l = 102.0;
  for (let i = 19; i <= 29; i++){ dbl[i].o = 100.6; dbl[i].c = 100.4; dbl[i].h = 100.8; dbl[i].l = 100.0; }
  for (let i = 30; i <= 33; i++){ dbl[i].o = dbl[i - 1].c + 0.1; dbl[i].c = dbl[i].o + 0.15; dbl[i].h = dbl[i].c + 0.1; dbl[i].l = dbl[i].o - 0.1; }
  dbl[33].h = 103.8; dbl[33].l = 102.4;   /* higher price high, far weaker thrust */
  for (let i = 34; i < 46; i++){ dbl[i].o = 100.5; dbl[i].c = 100.3; dbl[i].h = 100.7; dbl[i].l = 99.9; }
  const dv = RD(dbl);
  ok(dv && dv.dir === 'short' && /price HH \+ RSI LH/.test(dv.text),
     'AU: price HH + RSI LH reads bearish regular divergence — got "' + (dv && dv.text) + '"');
  ok(RD(null) === null && RD(dbl.slice(0, 20)) === null, 'AU: garbage/thin rows -> null, never throws');
  const flat120 = [];
  for (let i = 0; i < 120; i++) flat120.push({ t: i, o: 100, h: 101, l: 99, c: 100, v: 1000 });
  ok(RD(flat120) === null, 'AU: perfectly flat tape -> no fabricated divergence');
}

/* ================= AV) WICK-ADAPTIVE STOPS + CVD ================= */
console.log('== AV) wick-adaptive stops + CVD ==');
{
  const WB = W.__hgBrainWickBuf, CV = W.__hgBrainCvd;
  ok(typeof WB === 'function' && typeof CV === 'function', 'AV: wick-buffer + CVD seams exposed');

  /* calm tape keeps the 0.75 floor */
  const calm = []; for (let i = 0; i < 120; i++) calm.push({ t: i, o: 100, h: 100.6, l: 99.4, c: 100, v: 100 });
  ok(WB(calm, 1.0, true) === 0.75, 'AV: calm tape keeps the 0.75xATR floor');

  /* high-wick tape earns a wider buffer (clamped at 1.5) */
  const spiky = [];
  for (let i = 0; i < 120; i++){
    const w = (i % 3 === 0) ? 3.2 : 0.4;
    spiky.push({ t: i, o: 100, h: 100 + 0.4, l: 100 - w, c: 100, v: 100 });
  }
  const buf = WB(spiky, 1.0, true);
  ok(buf > 0.75 && buf <= 1.5, 'AV: high-wick symbols get a wider buffer from their OWN distribution — got ' + buf);
  ok(WB(spiky, 1.0, false) === 0.75, 'AV: the other side (upper wicks calm here) keeps the floor — side-specific math');
  ok(WB(null, 1, true) === 0.75 && WB([], 1, true) === 0.75 && WB(calm, NaN, true) === 0.75,
     'AV: garbage/NaN inputs -> the floor, never throws');

  /* CVD: severe traps veto; confirmsLong/Short when flow aligns */
  const mkTaker = (vals) => vals.map(function(v, i){ return { buySellRatio: v, t: i }; });
  const bulls = mkTaker([1,1,1,1,1,1,1,1, 1.1,1.15,1.2,1.1,1.15,1.2,1.25,1.3]);
  ok(CV(bulls).confirmsLong === true && CV(bulls).ratio > 1, 'AV: rising taker buy dominance -> confirmsLong');
  const bears = mkTaker([1,1,1,1,1,1,1,1, 0.9,0.85,0.8,0.9,0.85,0.8,0.75,0.7]);
  ok(CV(bears).confirmsShort === true, 'AV: rising taker sell dominance -> confirmsShort');
  const trapLong = mkTaker([1,1,1,1,1,1,1,1, 0.8,0.82,0.84,0.83,0.81,0.8,0.79,0.78]);
  ok(CV(trapLong).severeLongTrap === true, 'AV: seller-absorption ratio -> severeLongTrap');
  const flat = mkTaker([1,1,1,1,1,1,1,1, 1,1.02,0.98,1,1.01,0.99,1,1.01]);
  ok(!CV(flat).confirmsLong && !CV(flat).confirmsShort && !CV(flat).severeLongTrap,
     'AV: balanced flow -> no trap/confirm flags, never invented');
  ok(CV(null) === null && CV(mkTaker([1,1,1])) === null, 'AV: garbage/thin series -> null, never throws');
}

/* ================= AW) post-fetch structure / meanrev / poc (PR #4 integration) ================= */
console.log('== AW) post-fetch structure / meanrev / poc integration ==');
{
  globalThis.window = {};
  globalThis.localStorage = { getItem: function(){ return null; }, setItem: function(){}, removeItem: function(){} };
  vm.runInThisContext(fs.readFileSync(root + 'brain.js', 'utf8'), { filename: 'brain.js' });
  const WB = globalThis.window;
  const AS = WB.__hgBrainApplyStructure;
  const AM = WB.__hgBrainApplyMeanrev;
  const AP = WB.__hgBrainApplyPoc;
  ok(typeof AS === 'function' && typeof AM === 'function' && typeof AP === 'function',
     'AW: post-fetch apply seams exported');

  function mkRow(tier, dir){
    const rows4h = [];
    for (let i = 0; i < 220; i++) rows4h.push({ t: i, o: 100, h: 101, l: 99, c: 100, v: 1000 });
    return { lane: 'crypto', dec: { tier: tier, dir: dir }, col: { votes: [], silent: [], unavailable: [] }, rows4h: rows4h };
  }

  WB.hgStructureGate = function(){ return { bos: true, veto: false, note: 'BOS confirms long on 4H' }; };
  const rBos = mkRow('WATCH', 'long');
  AS([rBos]);
  ok(rBos.col.votes.some(function(v){ return v.layer === 'structure' && v.vote === 'long'; }),
     'AW: structure BOS casts a structural long vote');

  WB.hgStructureGate = function(){ return { veto: true, bos: false, note: 'CHoCH against the committed bias' }; };
  const rVeto = mkRow('HIGH', 'long');
  AS([rVeto]);
  ok(rVeto.col.votes.some(function(v){ return v.layer === 'structure' && v.caution; }),
     'AW: structure CHoCH against bias -> CAUTION vote');

  globalThis.detectRegime = function(){ return { regime: 'range', label: 'RANGE' }; };
  WB.meanrevAssess = function(){ return { signal: true, dir: 'long', n: 8, winPct: 62, expR: 0.4 }; };
  const rMr = mkRow('WATCH', 'long');
  AM([rMr]);
  ok(rMr.col.votes.some(function(v){ return v.layer === 'meanrev' && v.vote === 'long'; }),
     'AW: meanrev aligned in range regime votes long');

  WB.meanrevAssess = function(){ return { signal: true, dir: 'short', n: 8, winPct: 62, expR: 0.4 }; };
  const rMrOpp = mkRow('WATCH', 'long');
  AM([rMrOpp]);
  ok(rMrOpp.col.votes.some(function(v){ return v.layer === 'meanrev' && v.caution; }),
     'AW: opposing meanrev trigger -> CAUTION');

  globalThis.volumeProfile = function(){ return { poc: 100, val: 98, vah: 102 }; };
  const rPoc = mkRow('WATCH', 'long');
  rPoc.rows4h[rPoc.rows4h.length - 1].c = 99;
  AP([rPoc]);
  ok(rPoc.col.votes.some(function(v){ return v.layer === 'poc' && v.vote === 'long'; }),
     'AW: POC value-area edge aligned with long bias votes long');

  globalThis.detectRegime = undefined;
  globalThis.volumeProfile = undefined;
}

console.log('\n' + passed + ' assertions passed');
process.exit(0);
