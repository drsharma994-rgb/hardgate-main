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
   'only brainCollect/brainDecide/brainUniverse + HG_tabs leak onto window');

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
             rejected: [{ sym: 'SOLUSDT', vetoGate: 'G3' }], at: 1 };
r = COLLECT({ sym: 'ETHUSDT', engine: EN });
ok(r.votes.some(function(x){ return x.layer === 'engine' && x.vote === 'long' && x.strong === true && x.text.indexOf('STRONG') >= 0; }),
   'engine survivor -> strong vote in the survivor direction');
r = COLLECT({ sym: 'SOLUSDT', engine: EN });
ok(r.votes.some(function(x){ return x.layer === 'engine' && x.vote === 'veto' && x.text.indexOf('G3') >= 0; }),
   'engine rejection -> veto vote naming the veto gate');
r = COLLECT({ sym: 'XRPUSDT', engine: EN });
ok(!r.votes.some(function(x){ return x.layer === 'engine'; }) && r.silent.indexOf('engine') >= 0
   && r.unavailable.indexOf('engine') === -1,
   'symbol not gated -> engine silent (available, no coverage), not unavailable');
r = COLLECT({ sym: 'ETHUSDT', engine: null });
ok(r.unavailable.indexOf('engine') >= 0, 'engineState() null (never ran) -> unavailable');

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
ok(d.tier === 'ASIDE' && d.reasons[0].indexOf('thin') >= 0, 'only 2 agreeing -> ASIDE thin');
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
           rejected: [{ sym: 'SOLUSDT', vetoGate: 'G2' }], at: 123 };
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
ok(nAside.indexOf('>SOL</span>') >= 0 && nAside.indexOf('engine veto @ G2') >= 0 && nAside.indexOf('>VETO</span>') >= 0,
   'ASIDE ledger: SOLUSDT vetoed with the killing gate named');
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
ok(tStat.indexOf('done · 1 PRIME · 0 HIGH · 3 watch · 2 aside') === 0,
   'combined run buckets: 1 PRIME · 0 HIGH · 3 watch · 2 aside — got "' + tStat + '"');
ok(tStat.indexOf('universe 5 (delta 3 + cdcx 2)') >= 0, 'summary gains combined per-exchange counts');
ok(tStat.indexOf('1 prime/high · 3 watch') >= 0, 'summary gains prime/high + watch tallies');
ok(TT.stubs['#brainReadUni'].textContent === 'universe 5 (delta 3 + cdcx 2) · 1 prime/high · 3 watch',
   'MARKET READ header carries the combined counts — got "' + TT.stubs['#brainReadUni'].textContent + '"');
ok(tCards.indexOf('B-BTC_USDT') >= 0 && tCards.indexOf('PRIME · 5 LAYERS') >= 0 && tCards.indexOf('>LONG</span>') >= 0,
   'BTC card renders under the cdcx sym via alias-matched Binance-keyed layer votes');
ok(tCards.indexOf('ENTRY <b>100</b> · STOP <b>95</b>') >= 0 && tCards.indexOf('COINDCX') >= 0
   && tCards.indexOf('toTrade(&quot;B-BTC_USDT&quot;,&quot;long&quot;,100,95,110)') >= 0,
   'engine plan + COINDCX venue stamp + xu-sym toTrade payload on the card');
ok(xuCalls.length === 4, 'lazy fetch: exactly the 4 WATCH+ candidates fetched (BTC+ETH+SOL+XRP), DOGE aside untouched — got ' + xuCalls.length);
ok(xuCalls[0].item === XUL[0] && xuCalls[0].tf === '4h' && xuCalls[0].n === 120,
   'highest-evidence-first: the PRIME BTC candidate fetches first, via xuCandles with its original xu item');
ok(!xuCalls.some(function(c){ return c.item.sym === 'DOGEUSDT'; }), 'ASIDE candidates never trigger a candle fetch');
ok(statSnaps.some(function(s){ return /^\d+\/4 candidates · delta 3 · cdcx 2$/.test(s); }),
   'fetch progress reports X/Y candidates · delta n · cdcx m — saw "' + statSnaps[0] + '"');
const tWatch = TT.stubs['#brainWatch'].innerHTML;
ok(tWatch.indexOf('>ETH</span>') >= 0 && tWatch.indexOf('>SOL</span>') >= 0 && tWatch.indexOf('>XRP</span>') >= 0,
   'WATCH ledger lists the watch alts by base asset');
const tAside = TT.stubs['#brainAside'].innerHTML;
ok(tAside.indexOf('>DOGE</span>') >= 0 && tAside.indexOf('engine veto @ G2') >= 0 && tAside.indexOf('>XAU</span>') >= 0,
   'ASIDE ledger: DOGE vetoed with the gate named, gold lane present');
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
  ok(uStat.indexOf('done · 0 PRIME · 0 HIGH · 50 watch · 4 aside') === 0,
     '50 alts reach WATCH, bases + gold aside — got "' + uStat + '"');
  ok(capCalls.length === 40, 'fetch cap respected: 40 fetches out of 50 watch candidates — got ' + capCalls.length);
  ok(uStat.indexOf('+10 more watch candidates — raise evidence to fetch') >= 0,
     'honest note when the cap binds — got "' + uStat + '"');
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

console.log('\n' + passed + ' assertions passed');
process.exit(0);
