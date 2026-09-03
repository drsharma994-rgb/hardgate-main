/* HARDGATE — OMNIROUTE + OMNIPRESENT replay-edge apply (hg-v590).

   Claims under test:
     1. OMNIROUTE prefer / demote are COMPUTED from the baked v531 table
        (n≥50 + gross+/net+ vs n≥50 + gross≤−0.05), never a hand list.
     2. Toxic kinds refuse formation unless the live forward ledger has paid.
     3. VALUE (n=12) and ORB (near-even) still form.
     4. OMNIPRESENT replay quality still grants nothing (both kinds gross−).
     5. TRIGGERED costR>0.20 is a hard veto; ARMED is AGAINST/WATCH.
     6. Gold perps stand aside from TRIGGERED; ARMED stays a watch note.
     7. Banners cite the replay artifacts. No invented tickets / no loosened
        3+ / 2+ gates.

   Run: node tests/test-omni-replay-edge.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function mkEl(tag){
  const e = { tagName: (tag || 'div').toUpperCase(), style: {}, attrs: {}, _html: '',
    value: '', checked: false, disabled: false, textContent: '',
    appendChild(c){ return c; }, removeChild(){}, insertBefore(c){ return c; },
    setAttribute(k, v){ e.attrs[k] = v; }, getAttribute(k){ return k in e.attrs ? e.attrs[k] : null; },
    addEventListener(){}, removeEventListener(){}, remove(){},
    querySelector(){ return mkEl('div'); }, querySelectorAll(){ return []; },
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false } };
  Object.defineProperty(e, 'innerHTML', { get(){ return e._html; }, set(v){ e._html = String(v); } });
  return e;
}

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: mkEl, getElementById: () => mkEl('div'),
    querySelector: () => mkEl('div'), querySelectorAll: () => [],
    head: mkEl('head'), body: mkEl('body'), documentElement: mkEl('html'), addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','formation.js','omniroute.js','omnipresent.js']){
    try { vm.runInContext(read(f), ctx, { filename: f }); } catch (e) {
      /* formation.js may be optional in some boots — omniroute formTicket
         degrades to UNCHECKED without it. */
      if (f !== 'formation.js') throw e;
    }
  }
  return ctx;
}

function tape(n, seed, start){
  const out = []; let p = start || 100; let s = seed || 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p + (rnd() - 0.48) * 0.8;
    out.push({ t: 1700000000 + i * 14400, o: p - 0.2, h: p + 1.2, l: p - 1.2, c: p, v: 800 + rnd() * 200 });
  }
  return out;
}

const EXPECT_DEMOTE = ['AVWAP-DEFEND','BOS-RETEST','ENGULF-LEVEL','EQH-SWEEP',
  'EQL-SWEEP','FVG-FILL','HTF-PULLBACK','PIN-REJECT','RSI-DIVERGE','SPRING',
  'SWEEP-RECLAIM','THREE-BAR','TREND-RECLAIM','UTAD'].sort();
const EXPECT_PREFER = ['AVWAP-RECLAIM','CUSUM-SHIFT','DONCHIAN-DRIVE','MMOVE','NR7-BREAK'].sort();

console.log('== baked table matches v531 artifact ==');
{
  const W = boot();
  const E = W.HG_OMNI_REPLAY_EVIDENCE;
  ok(E && E.settled === 2832, 'OMNIROUTE bake settled=2832');
  ok(/backtest-omniroute-v531-results/.test(E.src), 'cites v531 JSON');
  const art = JSON.parse(read('scripts/backtest-omniroute-v531-results.json'));
  ok(Math.abs(art.aggregates.overall.avgNetR - E.overall.avgNetR) < 1e-4, 'overall avgNetR matches artifact');
  ok(Math.abs(art.aggregates.byMechanic['AVWAP-RECLAIM'].avgNetR - E.kinds['AVWAP-RECLAIM'].avgNetR) < 1e-4,
     'AVWAP-RECLAIM net matches artifact');
  ok(Math.abs(art.aggregates.byMechanic['PIN-REJECT'].avgNetR - E.kinds['PIN-REJECT'].avgNetR) < 1e-4,
     'PIN-REJECT net matches artifact');
}

console.log('\n== prefer / demote are computed from the table ==');
{
  const W = boot();
  const kinds = Object.keys(W.HG_OMNI_REPLAY_EVIDENCE.kinds);
  const prefer = kinds.filter(k => W.hgOmniKindPrefer(k)).sort();
  const demote = kinds.filter(k => W.hgOmniKindDemotion(k)).sort();
  ok(JSON.stringify(prefer) === JSON.stringify(EXPECT_PREFER),
     'prefer kinds: ' + prefer.join(', '));
  ok(JSON.stringify(demote) === JSON.stringify(EXPECT_DEMOTE),
     'demote kinds: ' + demote.join(', '));
  ok(W.hgOmniDemotedKindCount() === 14, '14 kinds demoted');
  ok(!W.hgOmniKindDemotion('ORB'), 'ORB near-even is not demoted');
  ok(!W.hgOmniKindPrefer('ORB'), 'ORB is not preferred');
  ok(!W.hgOmniKindDemotion('PO3'), 'PO3 gross −0.044 is above the −0.05 floor');
  ok(!W.hgOmniKindPrefer('VOL-EXPANSION'), 'VOL-EXPANSION n=22 is under the prefer floor');
  ok(!W.hgOmniKindDemotion('EDGE'), 'house extras with no baked row fail-open');
  ok(!W.hgOmniKindDemotion('VALUE'), 'VALUE n=12 is under the demote floor');
}

console.log('\n== formation refuses toxic kinds, keeps VALUE ==');
{
  const W = boot();
  const rows = tape(180, 11, 60000);
  const LIVE = rows[rows.length - 1].c;
  const valHit = { kind: 'VALUE', dir: 'long', level: LIVE - 420, why: 'VAL' };
  const valPl = W.hgOmniPlanForHit(valHit, rows, { livePx: LIVE });
  const valForm = W.hgOmniFormTicket(valPl, valHit, rows, { livePx: LIVE, sym: 'BTCUSD' });
  ok(valForm && valForm.ok !== false, 'VALUE still forms (n<50)');

  const pinHit = { kind: 'PIN-REJECT', dir: 'long', level: LIVE - 200, why: 'pin' };
  const pinPl = W.hgOmniPlanForHit(pinHit, rows, { livePx: LIVE })
    || { dir: 'long', entry: LIVE - 200, stop: LIVE - 800, t1: LIVE + 400, rr1: 2 };
  const pinForm = W.hgOmniFormTicket(pinPl, pinHit, rows, { livePx: LIVE, sym: 'BTCUSD' });
  ok(pinForm && pinForm.ok === false, 'PIN-REJECT formation refuses');
  ok(/replay-demoted/.test(String(pinForm.reason || '')), 'reason names replay-demoted');

  const prefHit = { kind: 'AVWAP-RECLAIM', dir: 'long', level: LIVE - 300, why: 'avwap' };
  const prefPl = W.hgOmniPlanForHit(prefHit, rows, { livePx: LIVE })
    || { dir: 'long', entry: LIVE - 300, stop: LIVE - 900, t1: LIVE + 500, rr1: 2 };
  const prefForm = W.hgOmniFormTicket(prefPl, prefHit, rows, { livePx: LIVE, sym: 'BTCUSD' });
  ok(prefForm && prefForm.ok !== false, 'AVWAP-RECLAIM still forms');
  ok(prefForm.plan && prefForm.plan.replaySurvivor === true, 'prefer kind stamps replaySurvivor');

  const pinTicket = {
    sym: 'BTCUSD', base: 'BTC', kind: 'PIN-REJECT', dir: 'long',
    grade: { ticket: true, vetoes: [], evaluated: 40, total: 47 },
    plan: { entry: 100, stop: 90, t1: 120, rr1: 2 },
    distAtr: 0.2
  };
  const prefTicket = {
    sym: 'ETHUSD', base: 'ETH', kind: 'MMOVE', dir: 'long',
    grade: { ticket: true, vetoes: [], evaluated: 40, total: 47 },
    plan: { entry: 100, stop: 90, t1: 120, rr1: 2 },
    distAtr: 1.8
  };
  const few = W.hgOmniPickFew([pinTicket, prefTicket], 'long', 3);
  ok(few.length === 1 && few[0].kind === 'MMOVE',
     'demoted PIN-REJECT never MOST PROBABLE even as a synthetic ticket');
}

console.log('\n== forward-paid un-demotes ==');
{
  const W = boot();
  const rows = tape(180, 11, 60000);
  const LIVE = rows[rows.length - 1].c;
  const orig = W.hgOmni20xForwardPaid;
  W.hgOmni20xForwardPaid = function(c){
    if (c && c.kind === 'PIN-REJECT') return { read: 'has paid', samples: 40, z: 3 };
    return orig ? orig.call(W, c) : null;
  };
  const pinHit = { kind: 'PIN-REJECT', dir: 'long', level: LIVE - 200, why: 'pin' };
  const pinPl = { dir: 'long', entry: LIVE - 200, stop: LIVE - 800, t1: LIVE + 400, rr1: 2 };
  const pinForm = W.hgOmniFormTicket(pinPl, pinHit, rows, { livePx: LIVE, sym: 'BTCUSD' });
  ok(pinForm && pinForm.ok !== false, 'PIN-REJECT forms when forward ledger has paid');
  ok(pinForm.plan && pinForm.plan.unDemoted, 'unDemoted carries the demotion + forward read');
}

console.log('\n== OMNIROUTE banner cites the replay ==');
{
  const W = boot();
  const html = W.hgOmniDeskStanceBannerHtml();
  ok(/REPLAY STANCE/.test(html) && /backtest-omniroute-v531-results/.test(html),
     'banner cites v531');
  ok(/14 kinds stood aside/.test(html), 'banner names the demotion count');
  ok(/AVWAP-RECLAIM/.test(html) && /MMOVE/.test(html), 'banner names prefer kinds');
  ok(/Never invents tickets/.test(html), 'banner says it does not invent tickets');
}

console.log('\n== OMNIPRESENT replay quality still grants nothing ==');
{
  const W = boot();
  ok(W.opX20ReplayQuality('OP-HIGH-REJECT') == null, 'HIGH-REJECT is not replay-quality');
  ok(W.opX20ReplayQuality('OP-LOW-REJECT') == null, 'LOW-REJECT is not replay-quality');
  const E = W.HG_OP_REPLAY_EVIDENCE;
  ok(E.settled === 8522 && E.costToxic && E.costToxic.thresholdR === 0.20, 'costToxic baked');
  ok(E.goldVenue && E.goldVenue.n === 564, 'goldVenue baked');
}

console.log('\n== OMNIPRESENT cost-geometry + gold venue ==');
{
  const W = boot();
  ok(W.opReplayGoldSym('XAUUSDT') && W.opReplayGoldSym('XAGUSDT') && W.opReplayGoldSym('PAXGUSDT'),
     'gold perps match');
  ok(!W.opReplayGoldSym('BTCUSD') && !W.opReplayGoldSym('TESTUSD'), 'crypto names do not match');

  const rows = tape(200, 3, 100);
  const wide = {
    dir: 'short', status: 'TRIGGERED',
    zone: { lo: 110, hi: 110.4, confluence: 3, distAtr: 1.1, srcs: ['a','b','c'] },
    entry: 109.2, stop: 110.7, t1: 107.2, rr1: 2, atr: 1.0,
    evidence: ['RSI divergence', 'volume climax']
  };
  const gWide = (W.opGates(rows, wide, 109.2, 'TESTUSD') || []).filter(g => g.key === 'cost-geometry')[0];
  ok(gWide && gWide.pass === true, 'wide-stop TRIGGERED passes cost-geometry (got ' + (gWide && gWide.why) + ')');

  const tight = Object.assign({}, wide, { entry: 110, stop: 110.08, risk: 0.08, rr1: 2 });
  const gTight = (W.opGates(rows, tight, 110, 'TESTUSD') || []).filter(g => g.key === 'cost-geometry')[0];
  ok(gTight && gTight.pass === false && gTight.hard === true,
     'tight TRIGGERED costR>0.20 is a HARD veto');

  const armedTight = Object.assign({}, tight, { status: 'ARMED' });
  const gArmed = (W.opGates(rows, armedTight, 109, 'TESTUSD') || []).filter(g => g.key === 'cost-geometry')[0];
  ok(gArmed && gArmed.pass === false && gArmed.info === true,
     'tight ARMED is AGAINST / WATCH, not a hard veto');

  const goldTrig = Object.assign({}, wide, { sym: 'XAUUSDT' });
  const gGold = (W.opGates(rows, goldTrig, 109.2, 'XAUUSDT') || []).filter(g => g.key === 'replay-venue')[0];
  ok(gGold && gGold.pass === false && gGold.hard === true, 'TRIGGERED gold perp is a HARD venue veto');

  const goldArmed = Object.assign({}, wide, { status: 'ARMED', sym: 'XAUUSDT' });
  const gGoldA = (W.opGates(rows, goldArmed, 109.2, 'XAUUSDT') || []).filter(g => g.key === 'replay-venue')[0];
  ok(gGoldA && gGoldA.pass === false && gGoldA.info === true, 'ARMED gold perp is AGAINST, still a watch');

  const cryptoV = (W.opGates(rows, wide, 109.2, 'BTCUSD') || []).filter(g => g.key === 'replay-venue')[0];
  ok(cryptoV && cryptoV.pass === true, 'crypto symbol passes replay-venue');
}

console.log('\n== OMNIPRESENT ranking prefers cheaper tickets ==');
{
  const W = boot();
  const cheap = { dir: 'short', status: 'TRIGGERED', score: 30, costR: 0.08,
    grade: { ticket: true, vetoes: [] }, zone: { distAtr: 0.8 }, formationScore: 10 };
  const dear = { dir: 'short', status: 'TRIGGERED', score: 40, costR: 0.19,
    grade: { ticket: true, vetoes: [] }, zone: { distAtr: 0.3 }, formationScore: 20 };
  ok(W.opBetterCand(cheap, dear, 'short') === true, 'cheaper ticket beats a higher-score dear one');
}

console.log('\n== OMNIPRESENT banner + 3+/2+ still hard ==');
{
  const W = boot();
  const html = W.opDeskStanceBannerHtml();
  ok(/REPLAY STANCE/.test(html) && /backtest-omnipresent-results/.test(html),
     'OP banner cites the full-run JSON');
  ok(/not loosened/.test(html), 'banner says gated 3+/2+ is not loosened');
  ok(/No third mechanic/.test(html), 'banner refuses a third mechanic');
  const src = read('omnipresent.js');
  ok(/confluence >= 3/.test(src) && /evidence\.length >= 2/.test(src),
     'hard 3+ / 2+ gates are still in source');
}

console.log('\n== cache stamp ==');
{
  ok(/^hg-v\d+$/.test(HG_VER) && Number(String(HG_VER).replace(/^hg-v/, '')) >= 590,
     'build is hg-v590+ (got ' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp');
}

console.log('\npassed: ' + passed);
