/* HARDGATE — OMNIROUTE + OMNIPRESENT replay-edge apply (hg-v590, re-baked
   hg-v703 from scripts/backtest-omniroute-v701-results.json).

   Claims under test:
     1. OMNIROUTE suppress / demote / prefer are COMPUTED from the baked
        v701 table (2,823 settled, scanErrors=0), never a hand list:
          suppress  n≥60 & gross<0 & net≤−0.60 → formation refuses, named
                    reason line (PIN-REJECT −0.877/114, THREE-BAR −0.830/165,
                    RSI-DIVERGE −0.645/61);
          demote    net≤−0.10 at n≥30, small-n catastrophic (n≥20 &
                    net≤−0.60: POC-REVERT −0.801/24), or a measured-negative
                    conviction-roster kind (COMPRESSION-BREAK −0.387/21) →
                    forms and PAINTS its measured row, never leads;
          prefer    n≥60 & gross>0 & net≥+0.15 → AVWAP-RECLAIM +0.387/80,
                    CUSUM-SHIFT +0.237/85 only.
     2. RETIRED rows (fresh evidence contradicts the v531 bake, both cited):
        PO3 demote (−0.223/73 → −0.037/77), DONCHIAN-DRIVE prefer
        (+0.072/53 → −0.142/52, now demote), MMOVE prefer (+0.058/188 →
        +0.024/191), NR7-BREAK prefer (+0.052/150 → −0.059/136).
     3. Suppressed kinds refuse formation unless the live forward ledger
        has paid (the v689/G7 pattern — the only un-demotion route).
     4. All six conviction mechanics measured negative → the cert paints
        but confers no lead/rank privilege (20x quality floor, APEX rule 1,
        desk order, MOST PROBABLE).
     5. VALUE (n=15) and ORB (near-even) still form.
     6. OMNIPRESENT replay quality still grants nothing (both kinds gross−).
     7. TRIGGERED costR>0.12 is a hard veto; ARMED is AGAINST/WATCH.
     8. Gold perps stand aside from TRIGGERED; ARMED stays a watch note.
     9. Banners cite the replay artifacts. No invented tickets / no loosened
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

/* hg-v703 expected partitions, verified against
   scripts/backtest-omniroute-v701-results.json aggregates.byMechanic. */
const EXPECT_SUPPRESS = ['PIN-REJECT','RSI-DIVERGE','THREE-BAR'].sort();
const EXPECT_DEMOTE = ['AVWAP-DEFEND','BOS-RETEST','COMPRESSION-BREAK','DONCHIAN-DRIVE',
  'ENGULF-LEVEL','EQH-SWEEP','EQL-SWEEP','EXHAUST-REVERT','FVG-FILL','HTF-PULLBACK',
  'POC-REVERT','SPRING','SWEEP-RECLAIM','TREND-RECLAIM','UTAD'].sort();
const EXPECT_PREFER = ['AVWAP-RECLAIM','CUSUM-SHIFT'].sort();

console.log('== baked table matches v701 artifact ==');
{
  const W = boot();
  const E = W.HG_OMNI_REPLAY_EVIDENCE;
  ok(E && E.settled === 2823, 'OMNIROUTE bake settled=2823');
  ok(E.suppressNetR === -0.60 && E.suppressMinN === 60, 'suppress bar −0.60 at n≥60');
  ok(E.demoteNetR === -0.10 && E.demoteMinN === 30, 'demote bar −0.10 at n≥30');
  ok(E.preferNetR === 0.15 && E.preferMinN === 60, 'prefer bar +0.15 at n≥60');
  ok(/backtest-omniroute-v701-results/.test(E.src), 'cites v701 JSON');
  const art = JSON.parse(read('scripts/backtest-omniroute-v701-results.json'));
  ok(Math.abs(art.aggregates.overall.avgNetR - E.overall.avgNetR) < 1e-4, 'overall avgNetR matches artifact');
  for (const k of Object.keys(E.kinds)){
    const a = art.aggregates.byMechanic[k];
    if (!a) throw new Error('FAIL: baked kind ' + k + ' missing from artifact');
    if (Math.abs(a.avgNetR - E.kinds[k].avgNetR) > 1e-4 || a.n !== E.kinds[k].n)
      throw new Error('FAIL: baked row drifted from artifact for ' + k);
  }
  passed++; console.log('  ok — every baked row (n + net) matches the v701 artifact');
  ok(Object.keys(E.kinds).length === Object.keys(art.aggregates.byMechanic).length,
     'no artifact kind left out of the bake');
}

console.log('\n== suppress / demote / prefer are computed from the table ==');
{
  const W = boot();
  const kinds = Object.keys(W.HG_OMNI_REPLAY_EVIDENCE.kinds);
  const prefer = kinds.filter(k => W.hgOmniKindPrefer(k)).sort();
  const acts = kinds.map(k => [k, W.hgOmniKindDemotion(k)]).filter(([, d]) => !!d);
  const suppress = acts.filter(([, d]) => (d.action || 'suppress') === 'suppress').map(([k]) => k).sort();
  const demote = acts.filter(([, d]) => d.action === 'demote').map(([k]) => k).sort();
  ok(JSON.stringify(prefer) === JSON.stringify(EXPECT_PREFER),
     'prefer kinds: ' + prefer.join(', '));
  ok(JSON.stringify(suppress) === JSON.stringify(EXPECT_SUPPRESS),
     'suppress kinds: ' + suppress.join(', '));
  ok(JSON.stringify(demote) === JSON.stringify(EXPECT_DEMOTE),
     'demote kinds: ' + demote.join(', '));
  ok(W.hgOmniDemotedKindCount() === 18, '18 kinds carry an action (3 suppress + 15 demote)');
  ok(!W.hgOmniKindDemotion('ORB'), 'ORB near-even (net +0.005/218) is not demoted');
  ok(!W.hgOmniKindPrefer('ORB'), 'ORB is not preferred');
  /* SPRING (−0.464/81) meets a −0.40 suppress bar but the action spec keeps
     it demote — the −0.60 bar exists so the computed set matches the spec. */
  ok(W.hgOmniKindDemotion('SPRING').action === 'demote', 'SPRING −0.464/81 demotes, not suppresses');
  ok(W.hgOmniKindDemotion('PIN-REJECT').action === 'suppress', 'PIN-REJECT −0.877/114 suppresses');
  const poc = W.hgOmniKindDemotion('POC-REVERT');
  ok(poc && poc.action === 'demote' && poc.smallN === true,
     'POC-REVERT −0.801/24 under the n bar → demote with small-n note');
  const cbk = W.hgOmniKindDemotion('COMPRESSION-BREAK');
  ok(cbk && cbk.action === 'demote' && cbk.convictionRoster === true && cbk.smallN === true,
     'COMPRESSION-BREAK −0.387/21 demoted via the conviction-roster rule (small n)');
  const exr = W.hgOmniKindDemotion('EXHAUST-REVERT');
  ok(exr && exr.action === 'demote', 'EXHAUST-REVERT −0.165/31 demoted (conviction roster, n≥30)');
  /* RETIRED rows — the fresh evidence contradicts the v531 bake: */
  ok(!W.hgOmniKindDemotion('PO3'), 'RETIRED: PO3 demote (v531 −0.223/73 → v701 −0.037/77, flat)');
  ok(!W.hgOmniKindPrefer('DONCHIAN-DRIVE') && W.hgOmniKindDemotion('DONCHIAN-DRIVE').action === 'demote',
     'RETIRED: DONCHIAN-DRIVE prefer (v531 +0.072/53 → v701 −0.142/52 — flipped to demote)');
  ok(!W.hgOmniKindPrefer('MMOVE') && !W.hgOmniKindDemotion('MMOVE'),
     'RETIRED: MMOVE prefer (v531 +0.058/188 → v701 +0.024/191, under the +0.15 bar) — neutral');
  ok(!W.hgOmniKindPrefer('NR7-BREAK') && !W.hgOmniKindDemotion('NR7-BREAK'),
     'RETIRED: NR7-BREAK prefer (v531 +0.052/150 → v701 −0.059/136) — neutral');
  ok(!W.hgOmniKindDemotion('VWAP-REVERT') && !W.hgOmniKindDemotion('SQUEEZE-FIRE'),
     'near-flat book (VWAP-REVERT −0.094, SQUEEZE-FIRE −0.049) stays neutral');
  ok(!W.hgOmniKindPrefer('VOL-EXPANSION'), 'VOL-EXPANSION n=30 is under the prefer floor');
  ok(!W.hgOmniKindDemotion('EDGE'), 'house extras with no baked row fail-open');
  ok(!W.hgOmniKindDemotion('VALUE'), 'VALUE n=15 is under the demote floor');
  /* every action row carries its measured numbers + why citing the artifact */
  for (const [k, d] of acts){
    if (!(d.n > 0) || !isFinite(d.grossR) || !isFinite(d.netR) || !d.reasons || !d.reasons.length)
      throw new Error('FAIL: action row for ' + k + ' missing n/gross/net/why');
    if (!/backtest-omniroute-v701-results\.json/.test(d.reasons.join(' ')))
      throw new Error('FAIL: action row for ' + k + ' does not cite the v701 artifact');
  }
  passed++; console.log('  ok — every action row carries n/gross/net and cites the v701 artifact');
}

console.log('\n== formation: suppress refuses, demote paints, VALUE keeps forming ==');
{
  const W = boot();
  const rows = tape(180, 11, 60000);
  const LIVE = rows[rows.length - 1].c;
  const valHit = { kind: 'VALUE', dir: 'long', level: LIVE - 420, why: 'VAL' };
  const valPl = W.hgOmniPlanForHit(valHit, rows, { livePx: LIVE });
  const valForm = W.hgOmniFormTicket(valPl, valHit, rows, { livePx: LIVE, sym: 'BTCUSD' });
  ok(valForm && valForm.ok !== false, 'VALUE still forms (n=15, under every bar)');

  const pinHit = { kind: 'PIN-REJECT', dir: 'long', level: LIVE - 200, why: 'pin' };
  const pinPl = W.hgOmniPlanForHit(pinHit, rows, { livePx: LIVE })
    || { dir: 'long', entry: LIVE - 200, stop: LIVE - 800, t1: LIVE + 400, rr1: 2 };
  const pinForm = W.hgOmniFormTicket(pinPl, pinHit, rows, { livePx: LIVE, sym: 'BTCUSD' });
  ok(pinForm && pinForm.ok === false, 'PIN-REJECT (suppress tier) formation refuses');
  ok(/replay-suppressed/.test(String(pinForm.reason || '')), 'reason is the named suppression line');
  ok(/n=114/.test(String(pinForm.reason || '')) && /-0\.877/.test(String(pinForm.reason || '')),
     'suppression reason carries the measured row (n=114, net −0.877)');

  /* demote tier: SPRING (−0.464/81) FORMS and paints its row — never leads */
  const spHit = { kind: 'SPRING', dir: 'long', level: LIVE - 420, why: 'spring' };
  const spPl = W.hgOmniPlanForHit(spHit, rows, { livePx: LIVE });
  const spForm = W.hgOmniFormTicket(spPl, spHit, rows, { livePx: LIVE, sym: 'BTCUSD' });
  ok(spForm && spForm.ok !== false, 'SPRING (demote tier) still forms — paints, never leads');
  ok(spForm.plan && spForm.plan.kindDemotion && spForm.plan.kindDemotion.action === 'demote',
     'formed SPRING carries its kindDemotion row');
  ok(!/replay-suppressed/.test(String(spForm.reason || '')), 'SPRING is not suppressed');

  const prefHit = { kind: 'AVWAP-RECLAIM', dir: 'long', level: LIVE - 300, why: 'avwap' };
  const prefPl = W.hgOmniPlanForHit(prefHit, rows, { livePx: LIVE })
    || { dir: 'long', entry: LIVE - 300, stop: LIVE - 900, t1: LIVE + 500, rr1: 2 };
  const prefForm = W.hgOmniFormTicket(prefPl, prefHit, rows, { livePx: LIVE, sym: 'BTCUSD' });
  ok(prefForm && prefForm.ok !== false, 'AVWAP-RECLAIM still forms');
  ok(prefForm.plan && prefForm.plan.replaySurvivor === true, 'prefer kind stamps replaySurvivor');

  /* demoted kinds never MOST PROBABLE — both tiers */
  const spTicket = {
    sym: 'BTCUSD', base: 'BTC', kind: 'SPRING', dir: 'long',
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
  const few = W.hgOmniPickFew([spTicket, prefTicket], 'long', 3);
  ok(few.length === 1 && few[0].kind === 'MMOVE',
     'demoted SPRING never MOST PROBABLE even as a synthetic ticket');

  /* desk order: a demoted kind can never outrank a clean kind — even a
     stale topPick flag does not put it back on top (hg-v703 lead-block) */
  const spTop = Object.assign({}, spTicket, { topPick: true, edgeScore: 100 });
  const ordered = W.hgOmniDeskOrder([spTop, prefTicket], 'long');
  ok(ordered[0].kind === 'MMOVE' && ordered[1].kind === 'SPRING',
     'clean MMOVE orders above demoted SPRING despite topPick + edgeScore 100');

  ok(W.hgOmniReplayKind('SNIPER') === 'PIN-REJECT', 'house SNIPER maps to PIN-REJECT');
  ok(W.hgOmniReplayKind('SMC') === 'FVG-FILL', 'house SMC maps to FVG-FILL');
  ok(W.hgOmniReplayKind('HOUSE-SQUEEZE') === 'SQUEEZE-FIRE', 'house squeeze maps to SQUEEZE-FIRE');
  ok(W.hgOmniReplayKind('SCALP') === 'NR7-BREAK', 'house SCALP maps to NR7-BREAK');
  ok(W.hgOmniReplayKind('MR') === 'VWAP-REVERT', 'house MR maps to VWAP-REVERT');
  ok(!!W.hgOmniKindDemotion('SNIPER'), 'house SNIPER inherits PIN-REJECT suppression');
  ok(!!W.hgOmniKindDemotion('SMC'), 'house SMC inherits FVG-FILL demote');
  ok(!W.hgOmniKindPrefer('SNIPER'), 'alias map does not invent a SNIPER prefer');

  const snHit = { kind: 'SNIPER', dir: 'long', level: LIVE - 200, why: 'bounce' };
  const snPl = { dir: 'long', entry: LIVE - 200, stop: LIVE - 800, t1: LIVE + 400, rr1: 2 };
  const snForm = W.hgOmniFormTicket(snPl, snHit, rows, { livePx: LIVE, sym: 'ETHUSD' });
  ok(snForm && snForm.ok === false, 'house SNIPER formation refuses');
  ok(/replay-suppressed/.test(String(snForm.reason || '')), 'SNIPER refuse is the named suppression line');
  ok(W.hgOmniHouseRawAllowed('SNIPER', { dir: 'long', entry: LIVE, conviction: 8 }) === false,
     'house SNIPER raw is not allowed onto the extra-vote list');
  ok(W.hgOmniHouseHits(rows, { sym: 'ETHUSD' }, {}).filter(function(h){ return h && h.kind === 'SNIPER'; }).length === 0,
     'hgOmniHouseHits does not emit a SNIPER extra');
}

console.log('\n== conviction lead-block: the cert pays nothing while the row is red ==');
{
  const W = boot();
  /* All six roster mechanics measured negative in v701 — the cert paints
     but must not serve as the 20x quality floor or APEX rule 1 while the
     forward ledger is unpaid (the v689/G7 pattern is the only way back). */
  for (const k of ['AVWAP-DEFEND','COMPRESSION-BREAK','SWEEP-RECLAIM','HTF-PULLBACK','DONCHIAN-DRIVE','EXHAUST-REVERT']){
    const d = W.hgOmniKindDemotion(k);
    if (!d || d.action !== 'demote') throw new Error('FAIL: conviction kind ' + k + ' not demoted');
  }
  passed++; console.log('  ok — all six conviction mechanics demoted on their v701 rows');
  const P = W.hgOmni20xParams ? W.hgOmni20xParams() : null;
  const mkCand = (kind) => ({
    sym: 'BTCUSD', base: 'BTC', kind, dir: 'long',
    conviction: { confirmations: ['a','b','c'], count: 3, classes: ['structure','momentum','participation'], costGate: 'passed', costR: 0.09 },
    rows: tape(120, 5, 50000),
    plan: { entry: 100, stop: 98.5, t1: 103, t2: 105, rr1: 2 }
  });
  if (P){
    const g = W.hgOmni20xGateRun(mkCand('SWEEP-RECLAIM'), mkCand('SWEEP-RECLAIM').plan, P);
    const qFail = (g.fails || []).filter(f => f.gate === 'quality')[0];
    ok(!(g.q && g.q.quality === 'conviction'),
       '20x quality floor: demoted SWEEP-RECLAIM cert does not read as conviction quality');
    ok(!qFail || /set aside/.test(qFail.why || '') || /forward ledger/.test(qFail.why || ''),
       '20x quality-why names the set-aside (or another floor covered it)');
  } else {
    /* hg-v703 (suite-not-vacuous closeout): assert the skip's PREMISE so
       this branch fails loudly the day the export appears — a bare ok(true)
       is a silent pass the vacuous-suite guard rightly rejects. */
    ok(typeof W.hgOmni20xParams !== 'function' && typeof W.hgOmni20xGateRun !== 'function',
       'premise checked: hgOmni20xParams/hgOmni20xGateRun not exported in this boot — the 20x quality floor is exercised via the APEX check below');
  }
  const apx = W.hgOmniApexCheck(mkCand('AVWAP-DEFEND'));
  const pe = (apx.fails || []).filter(f => f.rule === 'proven-edge')[0];
  ok(!!pe, 'APEX rule 1: demoted AVWAP-DEFEND cert is not a proven edge');
  ok(/set aside/.test(pe.why || ''), 'APEX why names the cert set-aside with its measured row');
  /* forward-paid restores the privilege — the v689/G7 route */
  const orig20 = W.hgOmni20xForwardPaid;
  W.hgOmni20xForwardPaid = function(c){
    if (c && c.kind === 'AVWAP-DEFEND') return { read: 'has paid', samples: 40, z: 3 };
    return orig20 ? orig20.call(W, c) : null;
  };
  const apx2 = W.hgOmniApexCheck(mkCand('AVWAP-DEFEND'));
  ok(!(apx2.fails || []).some(f => f.rule === 'proven-edge'),
     'forward ledger has paid → AVWAP-DEFEND passes APEX rule 1 again');
  W.hgOmni20xForwardPaid = orig20;
}

console.log('\n== nightly 40-day book asides BEST kinds that lost ==');
{
  const W = boot();
  vm.runInContext(read('formation-nightly.js'), W, { filename: 'formation-nightly.js' });
  const night = JSON.parse(read('scripts/formation-nightly.json'));
  W.hgFormationNightlyApply(night);
  ok(!!W.hgOmniKindDemotion('AVWAP-RECLAIM'), 'AVWAP-RECLAIM day-aside on 40-day book');
  ok(!!W.hgOmniKindDemotion('MMOVE'), 'MMOVE day-aside on 40-day book');
  ok(!!W.hgOmniKindDemotion('NR7-BREAK'), 'NR7-BREAK day-aside on 40-day book');
  ok(!!W.hgOmniKindDemotion('ORB'), 'ORB day-aside on 40-day book');
  ok(!!W.hgOmniKindDemotion('VALUE'), 'VALUE day-aside (baked row n=15 is under every bar)');
  ok(!!W.hgOmniKindDemotion('SCALP'), 'house SCALP follows NR7 day-aside');
  ok(!!W.hgOmniKindDemotion('HOUSE-SQUEEZE'), 'house squeeze follows SQUEEZE-FIRE day-aside');
  ok(!!W.hgOmniKindDemotion('MR'), 'house MR follows VWAP-REVERT day-aside');
  ok(!W.hgOmniKindPrefer('AVWAP-RECLAIM'), 'day-aside BEST kind is not preferred');
  ok(W.hgOmniKindPrefer('CUSUM-SHIFT') === true, 'CUSUM-SHIFT stays preferred (day-prefer / baked)');
  const rows = tape(180, 11, 60000);
  const LIVE = rows[rows.length - 1].c;
  const avHit = { kind: 'AVWAP-RECLAIM', dir: 'long', level: LIVE - 300, why: 'avwap' };
  const avPl = { dir: 'long', entry: LIVE - 300, stop: LIVE - 900, t1: LIVE + 500, rr1: 2 };
  const avForm = W.hgOmniFormTicket(avPl, avHit, rows, { livePx: LIVE, sym: 'BTCUSD' });
  ok(avForm && avForm.ok === false, 'AVWAP-RECLAIM formation refuses on the day-aside book');
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
  ok(/REPLAY STANCE/.test(html) && /backtest-omniroute-v701-results/.test(html),
     'banner cites the v701 artifact');
  ok(/3 kinds suppressed/.test(html) && /15 demoted/.test(html),
     'banner names the suppress + demote counts');
  ok(/conviction cert\s+confers no lead\/rank privilege/.test(html.replace(/\s+/g, ' ')),
     'banner states the conviction lead-block');
  ok(/AVWAP-RECLAIM/.test(html) && /CUSUM-SHIFT/.test(html), 'banner names the two prefer kinds');
  ok(!/MMOVE, NR7-BREAK/.test(html), 'retired prefers are REMOVED, not annotated');
  ok(/Never invents tickets/.test(html), 'banner says it does not invent tickets');
  ok(/SNIPER→PIN-REJECT/.test(html), 'banner names house-extra analogue map');
}

console.log('\n== OMNIPRESENT replay quality still grants nothing ==');
{
  const W = boot();
  ok(W.opX20ReplayQuality('OP-HIGH-REJECT') == null, 'HIGH-REJECT is not replay-quality');
  ok(W.opX20ReplayQuality('OP-LOW-REJECT') == null, 'LOW-REJECT is not replay-quality');
  const E = W.HG_OP_REPLAY_EVIDENCE;
  ok(E.settled === 8522 && E.costToxic && E.costToxic.thresholdR === 0.12, 'costToxic baked at 0.12');
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
     'tight TRIGGERED costR>0.12 is a HARD veto');

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
