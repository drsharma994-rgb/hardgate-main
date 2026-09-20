/* HARDGATE — the footer named one blocker in five, and asserted an accuracy
   it had never measured.

   TWO DEFECTS, both left behind by earlier packs of this arc.

   1. Pack 868 built csBlockerTally and the ONLY-blocker column to answer
      "which gate actually closed the block", and its own comment says "defer
      to the tally". The footer deferred for exactly one of five gates. Handing
      it 25 setups blocked by a single gate, once per gate:

        confidence   blames confluence
        regime       blames confluence
        session      NAMED
        voting       blames confluence
        sentiment    blames confluence

      "confluence" names nothing in this pipeline -- the gates are confidence,
      regime, session, voting and sentiment -- and pack 10 of this repo's own
      task list is "stop displaying confluence as a quality signal". It is also
      worse than one in five in practice: the session gate passes 07:00-17:00
      UTC, so during those ten hours session can never be a blocker, clockSole
      is 0 by construction, and the footer reached the confluence line whatever
      had actually happened.

   2. The same paragraph asserted the engine "produces high volume but low
      accuracy" two sentences above "no win rate is claimed from the scan
      window" -- an accuracy claim beside a promise not to make one. Pack 876
      flagged it in a comment and left it standing because nothing could answer
      it. Pack 878's INDEP correction can. csFwdVerdict pools this tab's own
      settled records and corrects the sample for overlap with the same
      hgFwdOverlap, the same hgOmniPoolRead, the same 1.5R breakeven and the
      same family bar the panel below uses, and the sentence reports what came
      back. With nothing settled it says so instead of guessing.

   Run: node tests/test-cryptoscan-blocker-name.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = (() => { const m = {}; return {
    getItem: k => (k in m ? m[k] : null), setItem(k, v){ m[k] = String(v); },
    removeItem(k){ delete m[k]; } }; })();
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'omniroute.js', 'order-flow.js',
                   'liquidation-intelligence.js', 'cryptoscan-voting-v3.js',
                   'hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const SEC = 900, HB = 24;

function setup(gateKeys, over){
  return Object.assign({
    sym: 'BTCUSDT', dir: 'long', threeLayerConfidence: 0.85, layerAgreement: 2,
    externalRisk: { cascadeImminent: false },
    gateKeys: gateKeys, qualityGates: gateKeys.map(k => k + ': x'),
    isHighQuality: gateKeys.length === 0
  }, over || {});
}
const note = (setups, hq, fwd) =>
  text(S.csFooterNote(setups, hq, S.csBlockerTally(setups), fwd));

/* ---------------------------------------------------------------- 1
   EVERY gate gets named, not one of five. */
{
  ok(typeof S.__csTopBlocker === 'function', 'csTopBlocker is exported');
  const GATES = ['confidence', 'regime', 'session', 'voting', 'sentiment'];
  const LABELS = S.CS_GATE_LABELS || {};
  ok(GATES.every(g => LABELS[g]), 'every gate key carries a human label');

  let named = 0;
  for (const g of GATES){
    const setups = []; for (let i = 0; i < 25; i++) setups.push(setup([g]));
    const t = note(setups, 0, null);
    if (t.indexOf(LABELS[g]) >= 0) named++;
    ok(t.indexOf(LABELS[g]) >= 0, g + ' is named in the note: "' + LABELS[g] + '"');
    ok(!/lack sufficient confluence/i.test(t),
       '  and ' + g + ' does not fall back to confluence');
    ok(/25 setups cleared everything else/.test(t), '  and the count is carried');
  }
  ok(named === GATES.length, 'all ' + GATES.length + ' of ' + GATES.length
     + ' named (it was 1 of 5)');

  /* the phrase that named nothing in this pipeline is gone from the source */
  const bare = stripComments(SCAN);
  ok(!/lack sufficient confluence/i.test(bare),
     'and the hardcoded confluence sentence is gone from the code, not just unreached');
  ok(/lack sufficient confluence/.test(SCAN),
     'though the comment still quotes it, so the change stays explicable');
}

/* ---------------------------------------------------------------- 2
   It picks the LARGEST only-blocker, and says which KIND of claim it is. */
{
  const T = S.__csTopBlocker;
  const mix = [];
  for (let i = 0; i < 3; i++) mix.push(setup(['session']));
  for (let i = 0; i < 9; i++) mix.push(setup(['regime']));
  const top = T(S.csBlockerTally(mix));
  ok(top && top.key === 'regime' && top.n === 9 && top.kind === 'sole',
     'the largest sole blocker wins (' + (top && top.key) + ' x' + (top && top.n) + ')');
  const t = note(mix, 0, null);
  ok(/regime reads CHOP/.test(t) && !/outside 07:00-17:00/.test(t),
     'and only that one is named, not the smaller clock count');

  /* every gate clear, stopped by the pro-grade stamp — a different claim */
  const proOnly = [setup([], { isHighQuality: false, threeLayerConfidence: 0.50 }),
                   setup([], { isHighQuality: false, layerAgreement: 0 })];
  const tp = S.csBlockerTally(proOnly);
  ok(tp.proBlocked === 2 && !Object.keys(tp.sole).length, 'the fixture has no sole gate');
  const pt = T(tp);
  ok(pt && pt.kind === 'pro' && pt.n === 2, 'csTopBlocker reports the pro-grade stamp');
  ok(/pro-grade stamp itself/.test(note(proOnly, 0, null)),
     'and the note says the gates were clear and the stamp stopped them');

  /* several gates open on every setup — the weakest claim, and labelled so */
  const multi = [setup(['session', 'regime']), setup(['session', 'confidence']),
                 setup(['session', 'voting'])];
  const mt = T(S.csBlockerTally(multi));
  ok(mt && mt.kind === 'multi' && mt.key === 'session' && mt.n === 3,
     'with no sole blocker it falls to the commonest gate');
  const mtxt = note(multi, 0, null);
  ok(/No single gate closed the block/.test(mtxt),
     'and says plainly that no single gate closed the block');
  ok(/commonest was outside 07:00-17:00 UTC/.test(mtxt), 'before naming it');
  ok(!/not the reads/.test(mtxt),
     'it does not borrow the stronger sole-blocker wording');

  /* nothing to blame when something got through. csTopBlocker still ANSWERS
     for that tally -- the clock did block one -- so it is csFooterNote that
     must decline to ask, which is where the old note also got it right. */
  const gotOne = [setup([]), setup(['session'])];
  const tb = T(S.csBlockerTally(gotOne));
  ok(tb && tb.key === 'session', 'csTopBlocker still reports the gate that blocked');
  ok(!/not the reads/.test(note(gotOne, 1, null)),
     'but with a signal through the note blames nothing');
  ok(/not the reads/.test(note(gotOne, 0, null)),
     'and with none through, the same tally does produce the sentence');
  ok(S.__csBlockerSentence(null) === '', 'no blocker, no sentence');
  ok(S.__csBlockerSentence({ key: 'session', n: 0, kind: 'sole' }) === '',
     'a zero count is not a blocker');
}

/* ---------------------------------------------------------------- 3
   The session gate keeps the one extra fact that is a fact. */
{
  const s25 = []; for (let i = 0; i < 25; i++) s25.push(setup(['session']));
  const t = note(s25, 0, null);
  ok(/10 of 24 hours/.test(t), 'the clock still carries its own arithmetic');
  ok(/14 a day nothing here can be high-quality/.test(t), 'and the consequence');

  const r25 = []; for (let i = 0; i < 25; i++) r25.push(setup(['regime']));
  ok(!/10 of 24 hours/.test(note(r25, 0, null)),
     'and no other gate borrows it');
}

/* ---------------------------------------------------------------- 4
   THE ACCURACY CLAIM IS NOW A MEASUREMENT. */
{
  ok(typeof S.csFwdVerdict === 'function', 'csFwdVerdict is exported');
  S.localStorage.removeItem('hg_forward_v1');
  S.localStorage.removeItem('hg_forward_agg_v1');

  const empty = S.csFwdVerdict();
  ok(empty === null || !empty.settled, 'with no records it has nothing to report');
  const et = note([setup(['regime'])], 0, empty);
  ok(/not asserted here/.test(et) && /nothing of its own has settled yet/.test(et),
     'and the note says so rather than asserting low accuracy');
  ok(!/high volume but low accuracy/.test(et), 'the old assertion is gone');

  /* record this desk's real cross-sectional shape and settle it at 55% */
  const t0 = Math.floor(Date.now() / 1000 / SEC) * SEC - (120 + HB + 2) * SEC;
  for (let b = 0; b < 120; b++){
    const batch = [];
    for (let k = 0; k < 25; k++)
      batch.push({ sym: 'S' + k, dir: 'long', mechanic: 'VOTE-STRONG@V5',
                   entry: 100, stop: 95, t1: 107.5, mark: 100, barT: t0 + b * SEC });
    S.hgFwdRecordScan('CRYPTO SCAN', '15m', batch, { horizonBars: HB });
  }
  const j = JSON.parse(S.localStorage.getItem('hg_forward_v1') || '{}');
  const arr = j.rows || j;
  let i = 0;
  for (const r of arr){ const w = (i++ % 20) < 11; r.state = w ? 't1' : 'stop'; r.rr = w ? 1.5 : 0; }
  S.localStorage.setItem('hg_forward_v1', JSON.stringify(j));

  const v = S.csFwdVerdict();
  ok(v && v.settled === 3000, 'it pools all ' + (v && v.settled) + ' settled records');
  ok(v && Math.abs(v.hit - 0.55) < 0.01, 'at the hit rate they carry ('
     + (v && (v.hit * 100).toFixed(0)) + '%)');
  ok(v && isFinite(v.effN) && v.effN < 10,
     'and corrects the sample to ' + (v && v.effN.toFixed(2)) + ' independent observations');
  ok(v && v.read && v.read.read === 'too few to judge',
     'which the shared reader calls "' + (v && v.read && v.read.read) + '"');

  /* the raw count would have said the opposite */
  const rawRead = S.hgOmniPoolRead({ samples: v.settled, hit: v.hit }, S.CS_FWD_MIN_RR, 20, 2);
  ok(rawRead.read === 'has paid',
     'on the uncorrected 3000 the same reader says "has paid" — which is the claim avoided');

  const vt = note([setup(['regime'])], 0, v);
  ok(/3000 at 55% T1-first/.test(vt), 'the note reports the measured rate');
  ok(/40% breakeven/.test(vt), 'against this desk\'s own 1.5R breakeven, not the helper\'s 2R');
  ok(/independent observation/.test(vt) && /too few to judge/.test(vt),
     'and the corrected verdict, not the raw one');
  ok(!/has paid/.test(vt), 'the raw-count verdict is not what the footer states');
  ok(!/high volume but low accuracy/.test(vt), 'and nothing is asserted about accuracy');

  /* THE LADDER IS THE DESK'S, NOT THE HELPER'S. hgFwdPanelHTML defaults to
     2R; cryptoultra prices T1 at RULE.t1R = 1.5. Those are different breakeven
     rates -- 33% against 40% -- and at a large enough sample they give
     different verdicts on the SAME pool. A fixture where they disagree is the
     only thing that can prove which one csFwdVerdict used. */
  S.localStorage.removeItem('hg_forward_v1');
  S.localStorage.removeItem('hg_forward_agg_v1');
  const u0 = Math.floor(Date.now() / 1000 / SEC) * SEC - (936 + HB + 2) * SEC;
  for (let b = 0; b < 936; b++)
    S.hgFwdRecordScan('CRYPTO SCAN', '15m',
      [{ sym: 'U', dir: 'long', mechanic: 'VOTE-MID@V5', entry: 100, stop: 95, t1: 107.5,
         mark: 100, barT: u0 + b * SEC }], { horizonBars: HB });
  const uj = JSON.parse(S.localStorage.getItem('hg_forward_v1') || '{}');
  const ua = uj.rows || uj;
  let ui = 0;
  for (const r of ua){ const w = (ui++ % 20) < 10; r.state = w ? 't1' : 'stop'; r.rr = w ? 1.5 : 0; }
  S.localStorage.setItem('hg_forward_v1', JSON.stringify(uj));

  const uv = S.csFwdVerdict();
  const uBar = S.hgOmniFamilyZ(Math.max(1, uv.mechanics));
  const at15 = S.hgOmniPoolRead({ samples: uv.effN, hit: uv.hit }, 1.5, 20, uBar).read;
  const at20 = S.hgOmniPoolRead({ samples: uv.effN, hit: uv.hit }, 2, 20, uBar).read;
  ok(uv.effN >= 20, 'a 936-bar one-per-bar log corrects to ' + uv.effN.toFixed(1)
     + ' observations, past the 20 floor');
  ok(at15 !== at20,
     'at that size the two ladders DISAGREE: 1.5R says "' + at15 + '", 2R says "' + at20 + '"');
  ok(uv.read && uv.read.read === at15,
     'and csFwdVerdict followed this desk\'s 1.5R ladder, not the helper\'s 2R default');
  ok(uv.read && uv.read.read !== at20,
     'so the pool is not credited with a verdict for a plan the desk does not place');

  /* it must be able to say something positive, or it is just a refusal */
  const strong = S.__csAccuracySentence({ settled: 900, open: 0, mechanics: 1, hit: 0.85,
                                          effN: 40,
                                          read: S.hgOmniPoolRead({ samples: 40, hit: 0.85 },
                                                                 S.CS_FWD_MIN_RR, 20, 2) });
  ok(/has paid/.test(strong),
     'a pool that clears the bar on INDEP reads "has paid" in the footer too');
  ok(/40 independent observations/.test(strong), 'with the count it cleared it on');
}

/* ---------------------------------------------------------------- 5
   Degrades without throwing. */
{
  ok(S.__csAccuracySentence(null).length > 0, 'a null verdict still produces a sentence');
  ok(/12 still open/.test(S.__csAccuracySentence({ settled: 0, open: 12 })),
     'nothing settled but records open says how many');
  ok(/too few to measure their overlap/.test(
       S.__csAccuracySentence({ settled: 4, open: 0, hit: 0.5, effN: NaN })),
     'settled records with no measurable overlap say exactly that');
  ok(text(S.csFooterNote(null, null, null, null)).indexOf('Out of 0 total') >= 0,
     'missing arguments still render a coherent note');

  /* the caller passes the verdict in, so the note stays pure */
  const bare = stripComments(SCAN);
  ok(/csFooterNote\(setups, hqSetups\.length, csBlockerTally\(setups\), csFwdVerdict\(\)\)/.test(bare),
     'renderCards supplies the verdict rather than the note reading it');
  const body = (src, name) => {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) return '';
    let d = 0, i = src.indexOf('{', start);
    for (; i < src.length; i++){
      const c = src[i];
      if (c === '{') d++;
      else if (c === '}'){ d--; if (!d) break; }
    }
    return src.slice(start, i + 1);
  };
  const fb = body(bare, 'csFooterNote');
  ok(fb.length > 200, 'csFooterNote body located (' + fb.length + ' chars)');
  ok(!/hgFwdPool|hgFwdOverlap|localStorage|csFwdVerdict/.test(fb),
     'and it touches no storage and calls no reader — the verdict arrives as an argument');
  const sb = body(bare, 'csAccuracySentence');
  ok(sb.length > 100 && !/hgFwdPool|hgFwdOverlap|localStorage/.test(sb),
     'nor does the sentence builder');
  ok(/hgFwdPool/.test(body(bare, 'csFwdVerdict')),
     'only csFwdVerdict reads the log, which is why it is the one that is impure');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
