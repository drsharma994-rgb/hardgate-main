/* HARDGATE — "context, not a veto" has to be true in the grader, not just in
   a comment.

   Four indicator reads were added to the OMNIGOLD ledger marked hard:false,
   with a comment saying they were context and would not cut tickets. They
   cut tickets. hgOmniGrade collected a veto from ANY gate returning false:

     if (g.pass === false) vetoes.push(g.key);

   hard only ever governed what UNCHECKED means — hard+null is WATCH, soft+null
   is degraded. It never governed a FAIL. So a soft gate that read "stoch RSI
   100, buying into an exhausted high" stood the whole trade aside, on a desk
   whose ledger already runs twelve gates, for a reason that has never been
   measured on gold.

   The fix is an explicit info flag. An info gate reports an adverse read and
   the ticket stands; the card names what argued against it under "against:"
   so it is visible rather than swallowed. Gates without the flag are
   completely unchanged, which is the assertion this file exists for — every
   other desk in the app grades through this same function.

   Run: node tests/test-info-gate-grading.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const win = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8'))(win);
const grade = win.hgOmniGrade;

const G = (key, pass, extra) => Object.assign({ key, hard: true, pass, why: key }, extra || {});

console.log('== an ordinary gate is completely unchanged ==');
{
  ok(typeof grade === 'function', 'hgOmniGrade is exported');

  const clean = grade([G('a', true), G('b', true), G('c', true)]);
  ok(clean.ticket === true, 'all-pass grades to a ticket');
  ok(clean.verdict === 'CLEAN', 'and reads CLEAN');
  ok(clean.evaluated === 3 && clean.total === 3, 'with everything evaluated');

  const vetoed = grade([G('a', true), G('b', false), G('c', true)]);
  ok(vetoed.ticket === false, 'a hard fail still vetoes');
  ok(vetoed.vetoes.join() === 'b', 'and is named in vetoes');
  ok(/^VETO — b/.test(vetoed.verdict), 'the verdict leads with the veto (' + vetoed.verdict + ')');

  /* THE REGRESSION THAT MATTERS: a soft gate WITHOUT the info flag must still
     veto on a fail, because every existing desk relies on exactly that. */
  const softFail = grade([G('a', true), G('b', false, { hard: false }), G('c', true)]);
  ok(softFail.ticket === false, 'a hard:false gate with no info flag STILL vetoes — unchanged behaviour');
  ok(softFail.vetoes.join() === 'b', 'and still appears in vetoes');

  const hardUnknown = grade([G('a', true), G('b', null), G('c', true)]);
  ok(hardUnknown.ticket === false, 'a hard UNCHECKED still blocks');
  ok(/^WATCH — no data: b/.test(hardUnknown.verdict), 'and reads WATCH (' + hardUnknown.verdict + ')');

  const softUnknown = grade([G('a', true), G('b', null, { hard: false }), G('c', true)]);
  ok(softUnknown.ticket === true, 'a soft UNCHECKED does not block');
  ok(/^CLEAN · unchecked: b/.test(softUnknown.verdict), 'and is listed as unchecked (' + softUnknown.verdict + ')');
}

console.log('\n== an info gate reports an adverse read without standing the trade aside ==');
{
  const info = { hard: false, info: true };
  const r = grade([G('a', true), G('stoch-rsi', false, info), G('c', true)]);
  ok(r.ticket === true, 'an info FAIL does not veto');
  ok(r.vetoes.length === 0, 'and contributes no veto');
  ok(r.notes.join() === 'stoch-rsi', 'it lands in notes instead');
  ok(/against: stoch-rsi/.test(r.verdict), 'and the card says what argued against it (' + r.verdict + ')');
  ok(r.evaluated === 3, 'it still counts as evaluated — it was read, and it answered');
}

console.log('\n== an adverse info read is never silently dropped ==');
{
  /* The whole risk of a non-vetoing gate is that it becomes invisible and the
     user trades a setup the app quietly disagreed with. */
  const info = { hard: false, info: true };
  const r = grade([G('a', true), G('ichimoku', false, info), G('donchian-pos', false, info)]);
  ok(r.ticket === true, 'two adverse info reads still ticket');
  ok(r.notes.length === 2, 'both are recorded');
  ok(/against: ichimoku, donchian-pos/.test(r.verdict), 'both are named on the card (' + r.verdict + ')');

  const mixed = grade([G('a', true), G('ichimoku', false, info), G('b', null, { hard: false })]);
  ok(/unchecked: b/.test(mixed.verdict) && /against: ichimoku/.test(mixed.verdict),
     'unchecked and against are reported side by side, not one replacing the other (' + mixed.verdict + ')');
}

console.log('\n== a real veto still outranks an info note ==');
{
  const info = { hard: false, info: true };
  const r = grade([G('news-window', false), G('ichimoku', false, info)]);
  ok(r.ticket === false, 'a genuine veto alongside an info note still stands the trade aside');
  ok(/^VETO — news-window/.test(r.verdict), 'and the verdict leads with the veto, not the note (' + r.verdict + ')');
  ok(r.notes.join() === 'ichimoku', 'the note is still recorded for the card');
}

console.log('\n== info does not become a way to pass an unknown ==');
{
  /* "Unknown reads UNCHECKED, never PASS" is the app's rule, and the info
     flag must not create an exception to it. */
  const r = grade([G('a', true), G('ichimoku', null, { hard: false, info: true })]);
  ok(r.ticket === true, 'an unreadable soft info gate does not block');
  ok(r.degraded.join() === 'ichimoku', 'but it is reported as UNCHECKED, not as a pass');
  ok(r.notes.length === 0, 'and an unknown is not an "against" — it is an unknown');
  ok(r.evaluated === 1, 'and it does NOT count toward the evaluated total');

  const rHard = grade([G('a', true), G('x', null, { hard: true, info: true })]);
  ok(rHard.ticket === false, 'a HARD info gate that cannot be read still blocks — hard still means hard');
}

console.log('\n== the four gold context gates carry the flag ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  for (const k of ['ichimoku', 'donchian-pos', 'stoch-rsi', 'hurst-regime']){
    ok(new RegExp("key:'" + k + "', hard:false, info:true").test(src),
       k + ' is declared hard:false, info:true');
  }
  for (const k of ['adx-trend', 'squeeze-state', 'keltner-pos', 'atr-percentile', 'structure-shift',
                   'macd-momentum', 'bollinger-pctb', 'volume-z', 'regression-slope', 'value-area',
                   'htf-confirm', 'regime-fit', 'vol-forecast']){
    ok(new RegExp("key:'" + k + "', hard:false, info:true").test(src),
       k + ' is declared hard:false, info:true');
  }

  /* And nothing else in the app has quietly become non-vetoing. The info flag
     is for INDICATOR CONTEXT reads only — a gate that encodes a risk rule
     (news blackout, cost drag, session) must still be able to stand a trade
     aside, and silently flipping one to info would remove a real veto while
     every test kept passing. */
  const CONTEXT_ONLY = ['ichimoku', 'donchian-pos', 'stoch-rsi', 'hurst-regime',
                        'adx-trend', 'squeeze-state', 'keltner-pos', 'atr-percentile', 'structure-shift',
                        'macd-momentum', 'bollinger-pctb', 'volume-z', 'regression-slope', 'value-area',
                        'htf-confirm', 'regime-fit', 'vol-forecast'];
  const all = [];
  for (const f of ['omnigold.js', 'omniroute.js']){
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    (s.match(/gates\.push\(\{ key:'([a-z0-9-]+)'[^}]*info:true/g) || [])
      .forEach(m => all.push(/key:'([a-z0-9-]+)'/.exec(m)[1]));
  }
  ok(all.length === CONTEXT_ONLY.length, 'the app has ' + CONTEXT_ONLY.length + ' info gates (' + all.length + ')');
  all.forEach(k => ok(CONTEXT_ONLY.indexOf(k) >= 0, '"' + k + '" is an indicator context read, not a risk rule'));
}

console.log('\n== the card must not print VETO on a gate that did not veto ==');
{
  /* A row reading VETO beside a TICKET badge contradicts the card, and the
     user resolves that contradiction however they like — which is the whole
     failure this flag was meant to prevent. */
  const src = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/var vetoed = \(g\.pass === false\) && !g\.info;/.test(src),
     'the gate row only calls it a VETO when it actually vetoed');
  ok(/'AGAINST'/.test(src), 'an adverse info read renders as AGAINST');
  ok(!/g\.pass === false \? 'VETO'/.test(src), 'the old unconditional VETO label is gone');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL INFO GATE GRADING TESTS PASSED');
