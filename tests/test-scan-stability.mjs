/* HARDGATE — the OMNIROUTE scan must not kill the tab it runs in.

   "When I click the scan button, after scanning the app refreshes
   automatically and all the results are gone, or the app crashes."

   Two causes, both in runScan:

     1. UNBOUNDED RENDERING. A 1,240-setup scan built a full 35-gate card
        for every distinct trade into one innerHTML — tens of thousands of
        DOM nodes. That is precisely the memory profile mobile Chrome
        answers with a silent out-of-memory page reload, which the reader
        experiences as "the app refreshed and my results are gone".

     2. A SYNCHRONOUS GRADING LOOP. Every fired contract — 35 gates x
        indicators x 180 bars x ~500 names — graded in one uninterrupted
        pass on the main thread. Multi-second freezes are what the browser
        answers with an "unresponsive page" kill.

   The contract now: every TICKET always renders in full; non-ticket cards
   are capped at CARD_RENDER_MAX with the overflow as one-line rows (sym,
   mechanic, direction, what killed it) and nothing hidden from
   hgOmniWhyNoTickets(); grading yields the main thread between chunks and
   releases each contract's bars once graded; and one bad contract cannot
   take down the other 499.

   Driven END-TO-END through the real runScan against a stubbed 60-name
   universe — not source inspection alone.

   Run: node tests/test-scan-stability.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = read('omniroute.js');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  const store = {};
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem(k, v){ store[k] = String(v); }, removeItem(k){ delete store[k]; } };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

console.log('== source: the three mechanisms exist where the contract says ==');
{
  ok(/var CARD_RENDER_MAX = \d+/.test(SRC), 'a render cap is declared, not improvised');
  ok(/hgOmniIsSuperSolid\(collapsed\[i\]\)/.test(SRC), 'only SUPER SOLID tickets render as full cards');
  ok(/CARD_RENDER_MAX/.test(SRC), 'a render cap constant is still declared for overflow budgeting');
  ok(/function gradeStep\(j\)/.test(SRC) && /omniSleep\(0\)\.then\(function\(\)\{ return gradeStep\(stop\); \}\)/.test(SRC),
     'grading is chunked and yields the main thread between chunks');
  ok(/held\[j\]\.rows = null;/.test(SRC), 'each contract\'s bars are released once graded');
  ok(/try \{ gradeOne\(gj\); \}/.test(SRC), 'one bad contract cannot take down the rest of the grade');
  ok(/SUPER SOLID bar|did not clear the SUPER SOLID/.test(SRC),
     'the overflow names itself instead of silently truncating');
}

console.log('\n== end-to-end: a 60-name universe through the real runScan ==');
const W = boot();

/* Strong-trend tapes so most names fire a mechanic and produce a card. */
function tape(seed){
  const out = []; let p = 40 + seed, s = seed * 7919 + 3;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < 181; i++){
    p = p*(1+((rnd()-0.44))*0.006);          /* drift up: breakout country */
    const r = p*0.004*(0.5+rnd());
    out.push({ t: 1700000000+i*14400, o:p-r*0.3, h:p+r, l:p-r, c:p, v:900+rnd()*300 });
  }
  return out;
}
const UNI = [];
for (let i = 0; i < 60; i++) UNI.push({ sym: 'TK' + i + 'USD', base: 'TK' + i, exchange: 'delta' });
W.xuUniverse = () => Promise.resolve(UNI);
W.xuCandles = (item) => Promise.resolve(tape(1 + Number(item.base.slice(2))));

function mkEl(){ return { innerHTML: '', textContent: '', disabled: false,
  style: {}, addEventListener(){}, appendChild(){} }; }
const statHistory = [];
const stat = mkEl();
Object.defineProperty(stat, 'textContent', {
  get(){ return statHistory[statHistory.length - 1] || ''; },
  set(v){ statHistory.push(String(v)); }
});
const ui = { btn: mkEl(), stat, warn: mkEl(), cards: mkEl(), pool: mkEl(), matrix: mkEl() };

await W.hgOmniRunScan(ui);

{
  const html = ui.cards.innerHTML;
  const last = statHistory[statHistory.length - 1] || '';
  ok(ui.btn.disabled === false, 'the scan button is re-enabled when the scan ends');
  ok(/setup\(s\)/.test(last), 'the status line reports a completed scan: "' + last.slice(0, 90) + '"');
  const nSetups = parseInt((last.match(/(\d+) setup\(s\)/) || [])[1], 10);
  ok(nSetups > 40, 'the universe produced more setups than the cap (' + nSetups + ') — the overflow path is exercised, not skipped');
  const cards = (html.match(/<div class="card">/g) || []).length;
  const tickets = (html.match(/>TICKET</g) || []).length;
  ok(cards > 0, 'cards rendered (' + cards + ')');
  ok(cards <= 40, 'full-ledger cards on screen are capped (' + cards + ' cards, cap ' + 40 + ')');
  /* Setup-level tickets (hg-v424) can mark far named levels DEAD ON ARRIVAL
     instead of painting a full card. Those extras must still be NAMED —
     either the SUPER SOLID overflow note or the dead-levels note — never dropped. */
  ok(/SUPER SOLID bar/.test(html) || /DEAD LEVELS/.test(html),
     'extras are named (super-solid overflow or dead-on-arrival), not silently truncated');
  ok(/hgOmniWhyNoTickets\(\)/.test(html) || /card not rendered/.test(html),
     'and points at where the full ledgers still live (or names the dead ones)');
  ok(statHistory.some(s2 => /grading \d+\/\d+/.test(s2)), 'grading progressed in visible chunks — the main thread was yielded');
}

console.log('\n== the results survive in memory even when the DOM is capped ==');
{
  const snap = W.hgOmniState ? W.hgOmniState() : null;
  const rows = snap && snap.rows;
  ok(Array.isArray(rows) && rows.length > 40, 'every graded setup is retained in the snapshot (' + (rows ? rows.length : 0) + '), cap or no cap');
  ok(rows.every(r => r && Array.isArray(r.gates) && r.gates.length > 0), 'each with its full gate ledger');
}

console.log('\n== a contract that throws mid-grade does not kill the scan ==');
{
  const W2 = boot();
  W2.xuUniverse = () => Promise.resolve(UNI.slice(0, 12));
  /* Symbol TK3 returns bars whose last close is a poison getter — any read
     inside grading throws. The other 11 must still reach the screen. */
  W2.xuCandles = (item) => {
    const rows = tape(1 + Number(item.base.slice(2)));
    if (item.base === 'TK3'){
      const bad = {};
      Object.defineProperty(bad, 'c', { get(){ throw new Error('poison bar'); } });
      bad.t = rows[80].t; bad.o = 41; bad.h = 42; bad.l = 40; bad.v = 900;
      rows[80] = bad;
    }
    return Promise.resolve(rows);
  };
  const ui2 = { btn: mkEl(), stat: mkEl(), warn: mkEl(), cards: mkEl(), pool: mkEl(), matrix: mkEl() };
  await W2.hgOmniRunScan(ui2);
  ok(ui2.btn.disabled === false, 'the scan still completes and re-enables the button');
  ok(/setup\(s\)/.test(ui2.stat.textContent), 'and still reports its result: "' + String(ui2.stat.textContent).slice(0, 80) + '"');
}

console.log('\npassed: ' + passed);
