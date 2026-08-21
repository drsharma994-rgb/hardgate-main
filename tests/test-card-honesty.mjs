/* HARDGATE — four defects found by reading a real OMNIROUTE scan.

   A live scan of 530 contracts, pasted in full. Everything below came from
   looking at what the tab actually printed, which is the only place three of
   these could have been seen.

   1. A card headed TICKET with VETO rows underneath it:

        MET · TREND-RECLAIM LONG TICKET 10/16 checks
        ...
        VETO adx-trend      ADX 13 — no trend ...
        VETO atr-percentile ATR in the 9th percentile ...

      Those are INFO gates. They argue, they do not veto — the ticket is
      correct and the label is wrong. A row that contradicts its own header
      leaves the reader to resolve it however they like, which is the whole
      failure the info flag exists to prevent. Fixed on the gold desk in v356
      and never carried across.

   2. 147 "tickets" that were not 147 trades. JST printed five cards —
      FVG-FILL, BOS-RETEST, AVWAP-RECLAIM, THREE-BAR, PO3 — every one LONG at
      ENTRY 0.10760, STOP 0.10400, T1 0.11481. One trade wearing five names,
      counted five times. QTUM printed four, PIPPIN four, MET three.

   3. "ATR in the 62th percentile". And 2th, 5th, 9th, 23th, 24th, 32th, 61th.

   4. "TREND-RECLAIM 266 (needs ~35379)". Arithmetically correct and useless:
      a required sample size that large is not a target, it is the statement
      that the observed edge is indistinguishable from zero.

   Run: node tests/test-card-honesty.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ROUTE = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
const GOLD = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
const FWD = fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8');

console.log('== 1. a card that says TICKET cannot show VETO rows ==');
{
  for (const [name, src] of [['omniroute', ROUTE], ['omnigold', GOLD]]){
    ok(/var vetoed\s*=\s*\(g\.pass === false\) && !g\.info;/.test(src),
       name + ' only calls it a VETO when it actually vetoed');
    ok(/'AGAINST'/.test(src), name + ' renders an adverse info read as AGAINST');
    ok(!/g\.pass === false \? 'VETO'/.test(src), name + ' has no unconditional VETO label left');
  }
  /* Behavioural: an info gate that failed must not be marked like a veto. */
  const gl = new Function('g', 'pill', 'esc', ROUTE.slice(ROUTE.indexOf('function gateLine(g){'),
    ROUTE.indexOf('function setupCard(c')).replace(/^function gateLine\(g\)\{/, '') .replace(/\}\s*$/, ''));
  const pill = (t) => '[' + t + ']';
  const esc = s => String(s);
  ok(gl({ pass: false, info: true, key: 'adx-trend', why: 'x' }, pill, esc).indexOf('[AGAINST]') >= 0,
     'a failing INFO gate renders AGAINST');
  ok(gl({ pass: false, key: 'news-window', why: 'x' }, pill, esc).indexOf('[VETO]') >= 0,
     'a failing hard gate still renders VETO');
  ok(gl({ pass: true, key: 'trend', why: 'x' }, pill, esc).indexOf('[PASS]') >= 0, 'a pass renders PASS');
  ok(gl({ pass: null, hard: false, key: 'funding', why: 'x' }, pill, esc).indexOf('[UNCHECKED]') >= 0,
     'a soft unknown renders UNCHECKED');
  ok(gl({ pass: null, hard: true, key: 'x', why: 'x' }, pill, esc).indexOf('[NO DATA]') >= 0,
     'a hard unknown renders NO DATA');
}

console.log('\n== 2. one trade is one card, however many mechanics found it ==');
{
  for (const [name, src] of [['omniroute', ROUTE], ['omnigold', GOLD]]){
    ok(/alsoKinds/.test(src), name + ' collapses duplicates into one card');
    ok(/also fired here on identical levels/.test(src),
       name + ' names the other mechanics rather than hiding them');
    ok(/mechanics, one trade/.test(src), name + ' says plainly that it is one trade');
  }
  /* The key must be what an exchange would see: symbol, side, entry, stop. */
  /* The key moved to a named function so the ticket COUNT could use the same
     one the render does — the header said "2 ticket(s)" over the pre-collapse
     list while one card rendered. Same key, one definition now. */
  ok(/String\(c && c\.sym\) \+ '\|' \+ String\(c && c\.dir\) \+ '\|' \+ e \+ '\|' \+ st/.test(ROUTE),
     'omniroute keys on symbol, direction, entry and stop');
  ok(/function omniTradeKey\(c\)/.test(ROUTE) && /omniTradeKey\(cur2\)/.test(ROUTE),
     'and the render uses that one definition rather than a private copy');
  /* Gold must ALSO key on horizon: the same levels on SCALP and SWING are two
     genuinely different tickets, with different targets and time stops. */
  ok(/String\(c && c\.horizon\) \+ '\|' \+ String\(c && c\.dir\)/.test(GOLD),
     'omnigold keys on horizon too — SCALP and SWING at the same levels are two trades, not one');
  ok(/function ogTradeKey\(c\)/.test(GOLD) && /ogTradeKey\(cur\)/.test(GOLD),
     'and gold likewise uses one definition for both the count and the render');

  /* Exercise the collapse itself. */
  const fin = v => (v === null || v === undefined || v === '') ? NaN : (isFinite(+v) ? +v : NaN);
  const tradeKey = c => {
    const pl = c.plan || {};
    const e = isFinite(fin(pl.entry)) ? fin(pl.entry).toPrecision(8) : 'na';
    const st = isFinite(fin(pl.stop)) ? fin(pl.stop).toPrecision(8) : 'na';
    return String(c.sym) + '|' + String(c.dir) + '|' + e + '|' + st;
  };
  const JST = k => ({ sym: 'JST', dir: 'long', kind: k, plan: { entry: 0.10760, stop: 0.10400 } });
  const ranked = [JST('FVG-FILL'), JST('BOS-RETEST'), JST('AVWAP-RECLAIM'), JST('THREE-BAR'), JST('PO3'),
                  { sym: 'QTUM', dir: 'long', kind: 'BOS-RETEST', plan: { entry: 0.68330, stop: 0.66832 } },
                  { sym: 'JST', dir: 'short', kind: 'UTAD', plan: { entry: 0.10760, stop: 0.11200 } }];
  const seen = {}, collapsed = [];
  for (const c of ranked){
    const tk = tradeKey(c);
    if (seen[tk] !== undefined){
      const owner = collapsed[seen[tk]];
      (owner.alsoKinds = owner.alsoKinds || []).push(c.kind);
      continue;
    }
    seen[tk] = collapsed.length; collapsed.push(c);
  }
  ok(collapsed.length === 3, 'seven candidates collapse to three trades (' + collapsed.length + ')');
  ok(collapsed[0].alsoKinds.length === 4, 'the JST long names its other four mechanics');
  ok(collapsed[0].kind === 'FVG-FILL', 'and the best-ranked one keeps the card');
  ok(collapsed[1].sym === 'QTUM', 'a different symbol is a different trade');
  ok(collapsed[2].dir === 'short', 'and the SAME symbol on the OTHER side is NOT collapsed away');

  /* A missing plan must not collapse unrelated setups onto one 'na' key. */
  const noPlan = [{ sym: 'A', dir: 'long', kind: 'X', plan: null },
                  { sym: 'B', dir: 'long', kind: 'Y', plan: null }];
  ok(tradeKey(noPlan[0]) !== tradeKey(noPlan[1]),
     'two planless setups on different symbols keep separate keys');
}

console.log('\n== 3. ordinals ==');
{
  for (const [name, src, fn] of [['omniroute', ROUTE, 'ordinal'], ['omnigold', GOLD, 'hgOgOrdinal']]){
    ok(new RegExp('function ' + fn + '\\(n\\)').test(src), name + ' has an ordinal helper');
    ok(!/toFixed\(0\) \+ 'th percentile/.test(src), name + ' no longer hardcodes "th"');
  }
  const src = ROUTE.slice(ROUTE.indexOf('function ordinal(n){'));
  const ordinal = new Function('return ' + src.slice(0, src.indexOf('\n  }') + 4))();
  const got = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 24, 32, 61, 62, 84, 100, 101, 111].map(ordinal);
  const want = ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd',
                '24th', '32nd', '61st', '62nd', '84th', '100th', '101st', '111th'];
  ok(got.join(' ') === want.join(' '), 'every ordinal is right: ' + got.join(' '));
  /* The exact strings the live scan got wrong. */
  for (const [n, s] of [[62, '62nd'], [2, '2nd'], [5, '5th'], [9, '9th'], [23, '23rd'], [61, '61st']]){
    ok(ordinal(n) === s, n + ' reads ' + s);
  }
}

console.log('\n== 4. a sample size nobody can reach is not a target ==');
{
  for (const [name, src] of [['omniroute', ROUTE], ['hg-forward', FWD]]){
    ok(/edge too small to confirm at any realistic sample size/.test(src),
       name + ' says what a huge required-n actually means');
    ok(/need > 5000/.test(src), name + ' draws the line at 5000');
    ok(!/\(needs ~' \+ v\.need/.test(src), name + ' no longer prints a raw five-figure number');
  }
  const src = ROUTE.slice(ROUTE.indexOf('function needText(need){'));
  const needText = new Function('return ' + src.slice(0, src.indexOf('\n  }') + 4))();
  ok(needText(35379).indexOf('too small to confirm') >= 0, '35379 reads as an unconfirmable edge');
  ok(needText(45).indexOf('needs ~45') >= 0, 'a reachable 45 is still shown as a number');
  ok(needText(null) === '', 'no requirement prints nothing');
  ok(needText(NaN) === '', 'and NaN prints nothing rather than "needs ~NaN"');
}

console.log('\n== the live scan that produced all four still reads honestly ==');
{
  /* The card in the report showed measured-edge UNCHECKED with the bar
     stated, which is the correction working — that one was RIGHT and must
     stay. */
  ok(/mechanics scanned, so \+'/.test(ROUTE), 'the significance bar is still quoted on the card');
  ok(/forward-only — no historical funding\/OI to replay/.test(ROUTE),
     'and the forward-only mechanics still explain themselves');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL CARD HONESTY TESTS PASSED');
