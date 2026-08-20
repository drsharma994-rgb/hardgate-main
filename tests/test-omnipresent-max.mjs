/* HARDGATE — OMNIPRESENT setups to the desk's own claims, then higher.

   The tab already SAID: 3+ sources is a zone; two exhaustion reads is a
   setup; an adverse third of the context panel stands the fade aside; a
   fade wants a stretched tape, not a running one. The ledger did not
   enforce those. Two-source zones were AGAINST-but-still-TICKET; one
   exhaustion read was the same; ARMED (no rejection yet) could grade
   TICKET; a daily rally did not stop a short from the high.

   Max-quality policy:
     1. confluence < 3 is a HARD veto (matches "3+ sources is a ZONE")
     2. exhaustion < 2 is a HARD veto (matches "a level, not a setup")
     3. ARMED cannot TICKET — rejection is UNCHECKED until the 1h close
     4. daily stack against a fade VETOES (shorts in a rally)
     5. running ADX without RSI divergence VETOES (stretch is the trend)
     6. adverse context panel is a real veto, not an AGAINST note
     7. a losing OMNIPRESENT mechanic at 20+ samples VETOES
     8. STRONGEST / shown head prefers tickets, then clean ARMED watches

   Run: node tests/test-omnipresent-max.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = read('omnipresent.js');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js','omnipresent.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();

function tape(n, seed, drift){
  const out = []; let p = 100, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - drift) * 0.004);
    const r = p * 0.004 * (0.4 + rnd());
    out.push({ t: 1700000000 + i * 3600, o: p - r * 0.2, h: p + r, l: p - r, c: p, v: 800 + rnd() * 200 });
  }
  return out;
}
const ROWS = tape(400, 3, 0.35); /* mild up drift so daily stack can read UP */

function baseCand(over){
  return Object.assign({
    dir: 'short', status: 'TRIGGERED',
    zone: { lo: 110, hi: 110.4, confluence: 3, distAtr: 1.1,
            srcs: ['swing high', 'round number', 'Donchian 20 high'] },
    entry: 109.2, stop: 110.7, t1: 107.2, t2: 101.7, risk: 1.5, rr1: 2, rr2: 5, atr: 1.0,
    evidence: [
      'bearish RSI divergence — higher high in price, lower high in RSI',
      'stretched +1.8xATR above EMA21 — rubber band'
    ]
  }, over || {});
}
function gate(cand, live, extraRows){
  const rows = extraRows || ROWS;
  const px = (live === undefined) ? 109.2 : live;
  return W.opGates(rows, cand, px, 'TESTUSD');
}
function g(list, key){ return (list || []).filter(x => x && x.key === key)[0]; }

console.log('== 1. confluence < 3 is a HARD veto, not an AGAINST note ==');
{
  const thin = gate(baseCand({ zone: { lo: 110, hi: 110.2, confluence: 2, srcs: ['a', 'b'], distAtr: 1 } }));
  const cf = g(thin, 'confluence');
  ok(cf && cf.pass === false && cf.info !== true, 'two sources VETO — the tab promised 3+ is a zone');
  ok(cf.hard === true, 'and the veto is hard');
  ok(W.hgOmniGrade(thin).ticket === false, 'so hgOmniGrade will not TICKET a two-source zone');

  const fat = g(gate(baseCand()), 'confluence');
  ok(fat && fat.pass === true, 'three sources still PASS');
}

console.log('\n== 2. one exhaustion read is a HARD veto — a level, not a setup ==');
{
  const one = gate(baseCand({ evidence: ['stretched +1.8xATR above EMA21 — rubber band'] }));
  const ex = g(one, 'exhaustion');
  ok(ex && ex.pass === false && ex.info !== true, 'one read VETOES');
  ok(ex.hard === true, 'hard — the card used to TICKET this as AGAINST');
  ok(W.hgOmniGrade(one).ticket === false, 'no ticket on a single rubber-band');

  const two = g(gate(baseCand()), 'exhaustion');
  ok(two && two.pass === true, 'two independent reads still PASS');
}

console.log('\n== 3. ARMED cannot TICKET — there is no rejection yet ==');
{
  const armed = gate(baseCand({ status: 'ARMED' }));
  const rj = g(armed, 'rejection');
  ok(!!rj, 'rejection is on the ledger');
  ok(rj.pass === null && rj.hard === true,
     'ARMED is hard UNCHECKED — WATCH, not a quiet pass and not a VETO badge');
  const graded = W.hgOmniGrade(armed);
  ok(graded.ticket === false, 'ARMED does not TICKET');
  ok(!(graded.vetoes || []).includes('rejection'),
     'rejection is not named as a veto — the zone is waiting, not failed');

  const trig = g(gate(baseCand({ status: 'TRIGGERED' })), 'rejection');
  ok(trig && trig.pass === true, 'TRIGGERED rejection PASSES');
}

console.log('\n== 4. daily stack against a fade VETOES ==');
{
  const dailyUp = tape(500, 7, 0.28); /* stronger up drift */
  const short = g(gate(baseCand({ dir: 'short' }), 109.2, dailyUp), 'htf-daily');
  ok(short && short.pass === false, 'SHORT from the high against a rising daily is VETOED');
  ok(/daily/.test(short.why), 'naming the daily: ' + (short.why || '').slice(0, 90));

  const long = g(gate(baseCand({ dir: 'long',
    evidence: ['bullish RSI divergence — lower low in price, higher low in RSI',
               'stretched -1.8xATR below EMA21 — rubber band']
  }), 90, dailyUp), 'htf-daily');
  ok(long && long.pass !== false, 'the same daily UP does not veto a LONG from a low');
}

console.log('\n== 5. running ADX without RSI divergence VETOES ==');
{
  const W2 = boot();
  const n = ROWS.length;
  W2.adx = () => ({
    adx: Array(n).fill(32),
    plusDI: Array(n).fill(28),
    minusDI: Array(n).fill(12)
  });
  const stretchOnly = W2.opGates(ROWS, baseCand({
    evidence: ['stretched +2.1xATR above EMA21 — rubber band',
               'volume climax — 2.4σ participation on the approach']
  }), 109.2, 'TESTUSD');
  const tg = g(stretchOnly, 'trend-guard');
  ok(tg && tg.pass === false, 'stretch + climax into ADX 32 UP is a VETO — that IS the trend');
  ok(/divergence/i.test(tg.why) || /RUNNING/.test(tg.why), 'and says why: ' + (tg.why || '').slice(0, 90));

  const withDiv = W2.opGates(ROWS, baseCand(), 109.2, 'TESTUSD');
  const tg2 = g(withDiv, 'trend-guard');
  ok(tg2 && tg2.pass === true, 'RSI divergence is the exhaustion that can fade a running tape');
}

console.log('\n== 6. adverse context panel is a real veto ==');
{
  ok(/context-gates/.test(SRC), 'context-gates is on the gold/omni ledger path');
  /* When the panel is adverse, the push must NOT carry info:true — info cannot stop a ticket. */
  ok(/cx\.adverse/.test(SRC), 'the adverse flag from hgContextRead is consulted');
  const W3 = boot();
  W3.hgContextRead = () => ({
    adverse: true, clean: false, withN: 2, againstN: 9, na: 0, gates: [],
    read: 'indicator context 2 with / 9 against of 20'
  });
  const cx = g(W3.opGates(ROWS, baseCand(), 109.2, 'TESTUSD'), 'context-gates');
  ok(cx && cx.pass === false && cx.info !== true,
     'a third of the panel against VETOES, it does not leave an AGAINST note');
  ok(W3.hgOmniGrade([
    { key: 'trend-guard', hard: true, pass: true, why: 'ok' },
    { key: 'confluence', hard: true, pass: true, why: 'ok' },
    { key: 'exhaustion', hard: true, pass: true, why: 'ok' },
    { key: 'level-fresh', hard: true, pass: true, why: 'ok' },
    { key: 'min-rr', hard: true, pass: true, why: 'ok' },
    { key: 'rejection', hard: true, pass: true, why: 'ok' },
    cx
  ]).ticket === false, 'and the grade will not TICKET');
}

console.log('\n== 7. a losing OMNIPRESENT mechanic at 20+ samples VETOES ==');
{
  const W4 = boot();
  W4.hgFwdStats = () => ({ samples: 22, hit: 0.18, expR: -0.45, wins: 4, losses: 18 });
  const ed = g(W4.opGates(ROWS, baseCand(), 109.2, 'TESTUSD'), 'measured-edge');
  ok(ed && ed.pass === false && ed.info !== true, '22 samples at a losing rate is a VETO');
  ok(/has not paid|below breakeven/i.test(ed.why), 'and says the mechanic has not paid: ' + (ed.why || '').slice(0, 90));

  const none = g(gate(baseCand()), 'measured-edge');
  ok(none && none.pass === null, 'with no forward record the gate is UNCHECKED, never a fabricated pass');
}

console.log('\n== 8. the shown head prefers tickets, then clean ARMED watches ==');
{
  ok(/opShowable|grade\.ticket/.test(SRC) && /ARMED/.test(SRC),
     'the scan ranks a showable head, not the first six vetoes');
  ok(/bookBtnHTML/.test(SRC) && /hgToTradePlanOnclickAttr/.test(SRC),
     'TICKET cards carry ADD TO BOOK + SEND TO TRADE PLAN');
  ok(/hgBookStampChip/.test(SRC), 'and an IN BOOK stamp');
  ok(/omnipresent:/.test(read('index.html')),
     'opening the tab auto-runs the scan (HG_TAB_AUTO_SCAN)');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIPRESENT MAX-QUALITY TESTS PASSED');
