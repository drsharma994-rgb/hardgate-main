/* HARDGATE — the six inline tabs learn where price is.

   cardHTML in index.html is the choke point the forward log already uses:
   SMC, ORDER BLOCKS, TRAP, DIV, COIL and APEX all render through it, and
   hgSetupCardHTML in setup-ui.js delegates to it for every CLEAN card. So
   wiring setup-ui.js alone would have missed exactly the cards that carry
   committed levels — the ones with a SEND TO TRADE PLAN button on them.

   The mark reaches it two ways, and both are the same old bug at opposite
   ends of the app: a whitelist that dropped the one field saying where
   price IS. hgStrategyBookFields now carries `mark` (cryptogates puts it
   on every hit it builds, right next to entry/stop/t1), and bookMeta.rows
   supplies a last close for the scans that pass bars instead.

   cardHTML is extracted from index.html by brace matching rather than
   copied, so this test fails if the real function stops looking like this.

   Run: node tests/test-card-html-geometry.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

/* ---- lift cardHTML out of index.html, matching braces ---- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const start = html.indexOf('function cardHTML(sym, dir, mini, gates, plan, entry, stop, t1, chartId, bookMeta){');
ok(start > -1, 'cardHTML is still where and what this test expects');
let depth = 0, end = -1;
for (let i = html.indexOf('{', start); i < html.length; i++){
  if (html[i] === '{') depth++;
  else if (html[i] === '}'){ depth--; if (depth === 0){ end = i + 1; break; } }
}
ok(end > start, 'and its body brace-matches cleanly');
const cardSrc = html.slice(start, end);

const ctx = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
              JSON, Date, RegExp };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
/* the real shared layer — nothing about geometry is stubbed */
for (const f of ['indicators.js', 'plans.js', 'hg-plan.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(cardSrc, ctx, { filename: 'index.html:cardHTML' });
const cardHTML = ctx.cardHTML;

const MINI = [['mark', '4282.70']];
const GATES = ['G1', 'G2'];
const DEAD = { dir: 'short', entry: 4316.20, stop: 4326.05, t1: 4296.51 };
const DEAD_MARK = 4282.70;
const FINE_MARK = 4320.00;
const BREACH_MARK = 4340.00;

const draw = (meta) => cardHTML('XAUUSD', DEAD.dir, MINI, GATES, 'ENTRY 4316.20',
                                DEAD.entry, DEAD.stop, DEAD.t1, null, meta);
const said = (h) => /TARGET BEHIND PRICE|STOP ALREADY BREACHED/.test(h);

console.log('\n== the verdict lands on the card ==');
{
  const dead = draw({ scanner: 'smc', strategy: 'smc', tier: 'clean', mark: DEAD_MARK });
  ok(dead.indexOf('class="card') > -1, 'the card still renders');
  ok(/TARGET BEHIND PRICE/.test(dead), 'and says the target is behind price');
  ok(dead.indexOf('ENTRY 4316.20') > -1, 'while still showing the plan it is judging');
  ok(dead.indexOf('SEND TO TRADE PLAN') > -1, 'a CLEAN card keeps its trade button — this warns, it does not censor');

  ok(/STOP ALREADY BREACHED/.test(draw({ scanner: 'smc', tier: 'clean', mark: BREACH_MARK })),
     'price through the stop is named as that instead');
  ok(!said(draw({ scanner: 'smc', tier: 'clean', mark: FINE_MARK })), 'and a live plan gets nothing');
}

console.log('\n== the verdict sits with the plan, not at the end of the card ==');
{
  const dead = draw({ scanner: 'smc', tier: 'clean', mark: DEAD_MARK });
  const planAt = dead.indexOf('ENTRY 4316.20');
  const geoAt = dead.indexOf('TARGET BEHIND PRICE');
  const btnAt = dead.indexOf('SEND TO TRADE PLAN');
  ok(planAt > -1 && geoAt > planAt, 'it reads after the levels it is about');
  ok(btnAt === -1 || geoAt < btnAt, 'and before the button, so it is read before it is clicked');
}

console.log('\n== both routes to a mark ==');
{
  ok(/TARGET BEHIND PRICE/.test(draw({ scanner: 'smc', tier: 'clean', mark: DEAD_MARK })),
     'a scan that passes mark is judged');
  ok(/TARGET BEHIND PRICE/.test(draw({ scanner: 'coil', tier: 'forming', rows: [{ c: 4300 }, { c: DEAD_MARK }] })),
     'and so is one that passes only bars — the last close is the mark');
  ok(!said(draw({ scanner: 'basis', tier: 'clean' })), 'a scan that passes neither makes no claim');
}

console.log('\n== hgStrategyBookFields carries the mark, and only a real one ==');
{
  const f = ctx.hgStrategyBookFields;
  ok(f({ mark: 4282.70 }).mark === 4282.70, 'a real mark travels with the strategy fields');
  ok(f({ mark: 0 }).mark === undefined, 'zero does not');
  ok(f({ mark: -1 }).mark === undefined, 'nor does a negative');
  ok(f({ mark: 'n/a' }).mark === undefined, 'nor a string');
  ok(f({}).mark === undefined, 'and an absent mark stays absent, not 0');
  ok(f({ entry: 4316.20 }).mark === undefined, 'an entry is never promoted to a mark');

  /* end to end: a cryptogates-shaped hit through the real helper into the
     real card — the path a SWING ticket actually takes */
  const hit = { dir: 'short', entry: DEAD.entry, stop: DEAD.stop, t1: DEAD.t1, mark: DEAD_MARK,
                strategyConfirm: 'WITH' };
  const meta = Object.assign({ scanner: 'swing', strategy: 'swing', tier: 'clean' }, f(hit));
  ok(/TARGET BEHIND PRICE/.test(draw(meta)), 'a SWING hit reaches the card with its mark intact');
}

console.log('\n== nothing invented, nothing thrown ==');
{
  for (const meta of [{}, { mark: null }, { mark: NaN }, { rows: [] }, { rows: null },
                      { rows: [{ o: 1 }] }, { mark: 'x', rows: 'y' }]){
    const h = draw(meta);
    ok(typeof h === 'string' && h.indexOf('class="card') > -1,
       'renders for bookMeta ' + JSON.stringify(meta));
    ok(!said(h), '...and claims nothing for it');
  }
  ok(typeof draw(undefined) === 'string', 'even with no bookMeta at all');
}

console.log('\n== a long, mirrored ==');
{
  const h = cardHTML('BTCUSDT', 'long', MINI, GATES, 'plan', 100, 95, 110, null,
                     { scanner: 'ob', tier: 'clean', mark: 115 });
  ok(/TARGET BEHIND PRICE/.test(h), 'a long whose T1 is behind price is caught too');
  const live = cardHTML('BTCUSDT', 'long', MINI, GATES, 'plan', 100, 95, 110, null,
                        { scanner: 'ob', tier: 'clean', mark: 102 });
  ok(!said(live), 'and one price has not reached is left alone');
  const dead = cardHTML('BTCUSDT', 'long', MINI, GATES, 'plan', 100, 95, 110, null,
                        { scanner: 'ob', tier: 'clean', mark: 94 });
  ok(/STOP ALREADY BREACHED/.test(dead), 'and a long already under its stop is breached, not crossed');
}

console.log('\n' + passed + ' passed, 0 failed');
