/* HARDGATE — CRYPTO SCAN blamed the reads when the clock had closed the block.

   isHighQuality needs every quality gate clear AND the pro-grade stamp, and
   one of those gates is a clock:

     var liquidHour = (h >= 7 && h < 12) || (h >= 12 && h < 17);

   The two ranges have no gap, so that is one 10-hour block, 07:00-17:00 UTC,
   and it is fixed UTC. Read as local sessions (Intl, 2026) it means London
   08:00-18:00 and New York 03:00-13:00 in summer, London 07:00-17:00 and New
   York 02:00-12:00 in winter; London is off the offset it assumes on 155 days
   of the year (42%), New York on 127 (35%). Which local hours were meant is
   not recorded anywhere, so the window is NOT moved here — picking an anchor
   is a trading decision, the same call made for the gold session-weight table
   in pack 860.

   What is fixed is the consequence. Ten of 24 hours pass the gate, so for 14
   hours a day — 58% — no setup can be HIGH-QUALITY whatever its confluence,
   and the tab's closing note explained that emptiness entirely as signal
   quality: "most signals lack sufficient confluence". For most of the day that
   is not what emptied it.

   CRYPTO SCAN now carries the WHY EMPTY panel the SWING tab has had since Fix
   Pack 17, with the same ONLY-blocker column cgSoleBlocker introduced: per
   gate, how many setups it blocked, and how many it was the ONLY thing
   blocking. A setup in that last column would have been high-quality if that
   one gate were relaxed, which is what tells you whether you are waiting on
   the clock, the regime, or the reads.

   Run: node tests/test-cryptoscan-why-empty.mjs */
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
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  vm.createContext(s);
  for (const f of ['order-flow.js', 'liquidation-intelligence.js', 'cryptoscan-voting-v3.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');

/** a setup that clears everything except the gates listed */
function setup(gateKeys, over){
  return Object.assign({
    sym: 'BTCUSDT', dir: 'long', threeLayerConfidence: 0.85, layerAgreement: 2,
    externalRisk: { cascadeImminent: false },
    gateKeys: gateKeys, qualityGates: gateKeys.map(k => k + ': x'),
    isHighQuality: gateKeys.length === 0
  }, over || {});
}

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the gate is a clock, and it is shut most of the day');
{
  const src = stripComments(SCAN);
  ok(/var liquidHour = \(h >= 7 && h < 17\);/.test(src),
     'the two decorative ranges are written as the one block they always were');
  ok(!/h >= 7 && h < 12/.test(src), 'the old split is gone');

  let pass = 0;
  for (let h = 0; h < 24; h++) if (h >= 7 && h < 17) pass++;
  ok(pass === 10, 'ten of 24 hours pass it');
  ok(24 - pass === 14, 'so for 14 hours a day nothing can be high-quality');
  ok(Math.round(100 * (24 - pass) / 24) === 58, 'which is 58% of the day');

  /* the DST drift, measured the same way the code comment claims it */
  const offH = (ms, tz) => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date(ms));
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec((p.find(x => x.type === 'timeZoneName') || {}).value || '');
    return m ? (m[1] === '-' ? -1 : 1) * (+m[2] + (+(m[3] || 0)) / 60) : 0;
  };
  const summer = Date.UTC(2026, 6, 15, 12), winter = Date.UTC(2026, 0, 15, 12);
  ok(offH(summer, 'Europe/London') === 1 && offH(winter, 'Europe/London') === 0,
     'London runs UTC+1 in summer and UTC+0 in winter');
  ok(offH(summer, 'America/New_York') === -4 && offH(winter, 'America/New_York') === -5,
     'New York UTC-4 and UTC-5');
  let londonOff = 0, nyOff = 0;
  for (let d = 0; d < 365; d++){
    const ms = Date.UTC(2026, 0, 1, 12) + d * 86400000;
    if (offH(ms, 'Europe/London') !== offH(summer, 'Europe/London')) londonOff++;
    if (offH(ms, 'America/New_York') !== offH(summer, 'America/New_York')) nyOff++;
  }
  ok(londonOff === 155 && nyOff === 127,
     'the window is summer-anchored: London is off it 155 days a year, New York 127');
  ok(/155\s+days of the year \(42%\)/.test(SCAN) && /New York on 127 \(35%\)/.test(SCAN),
     'and those are the numbers written into the code');
  ok(/picking an anchor is a trading decision/.test(SCAN),
     'with the reason the window is disclosed rather than moved');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the tally counts what blocked, and what blocked ALONE');
{
  ok(typeof S.csBlockerTally === 'function', 'csBlockerTally is reachable');
  ok(typeof S.csProReady === 'function', 'and so is csProReady');

  const t = S.csBlockerTally([
    setup([]),                       /* high quality */
    setup(['session']),              /* clock alone */
    setup(['session']),              /* clock alone */
    setup(['session', 'regime']),    /* two gates */
    setup(['confidence']),           /* reads alone */
  ]);
  ok(t.n === 5 && t.hq === 1, 'five scanned, one high-quality');
  ok(t.byGate.session === 3, 'the session gate blocked three');
  ok(t.byGate.regime === 1 && t.byGate.confidence === 1, 'regime and confidence one each');
  ok(t.sole.session === 2, 'but it was the ONLY blocker on two of them');
  ok(t.sole.regime === undefined, 'the two-gate setup counts for neither sole column');

  /* one gate open, but the pro-grade stamp would have stopped it anyway — so
     relaxing that gate would NOT have produced a high-quality signal */
  const t3 = S.csBlockerTally([
    setup(['session']),                                          /* ready */
    setup(['session'], { threeLayerConfidence: 0.50 }),           /* not ready */
    setup(['session'], { layerAgreement: 0 })                     /* not ready */
  ]);
  ok(t3.byGate.session === 3, 'three setups blocked by the clock');
  ok(t3.sole.session === 1,
     'but only the one that would otherwise have qualified is an ONLY-blocker');
  ok(t3.proReady === 1, 'and the tally says so: one of three was pro-ready');
  ok(t.sole.confidence === 1, 'and confidence was sole on one');
  ok(t.proReady === 4, 'four of the five would have been pro-grade with their gates clear');

  /* a setup with no gates that still is not high-quality: the stamp stopped it */
  const t2 = S.csBlockerTally([
    setup([], { isHighQuality: false, threeLayerConfidence: 0.60 }),
    setup([], { isHighQuality: false, layerAgreement: 1 }),
    setup([], { isHighQuality: false, externalRisk: { cascadeImminent: true } })
  ]);
  ok(t2.clean === 3 && t2.proBlocked === 3,
     'three setups cleared every gate and were stopped by the pro-grade stamp itself');
  ok(Object.keys(t2.byGate).length === 0, 'and none of them lands in a gate row');

  ok(S.csProReady(setup([])) === true, 'csProReady: confidence, agreement, no cascade');
  ok(S.csProReady(setup([], { threeLayerConfidence: 0.74 })) === false, 'confidence 0.74 is not ready');
  ok(S.csProReady(setup([], { layerAgreement: 1 })) === false, 'partial agreement is not');
  ok(S.csProReady(setup([], { externalRisk: { cascadeImminent: true } })) === false, 'a cascade is not');
  ok(S.csProReady(null) === false && S.csProReady({}) === false, 'and nothing readable is not');

  const empty = S.csBlockerTally([]);
  ok(empty.n === 0 && empty.hq === 0, 'an empty scan tallies to zero, not to a throw');
  ok(S.csBlockerTally(null).n === 0, 'and so does a missing list');
  ok(S.csBlockerTally([null, undefined, setup(['regime'])]).n === 1,
     'null rows are skipped rather than counted');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the panel says which gate, in the tab\'s own WHY EMPTY shape');
{
  const html = S.csWhyEmptyHTML(S.csBlockerTally([
    setup(['session']), setup(['session']), setup(['regime'])
  ]));
  ok(/WHY THE HIGH-QUALITY BLOCK IS EMPTY/.test(html), 'it names itself when nothing qualified');
  ok(/ONLY blocker/.test(html), 'and carries the ONLY-blocker column');
  ok(/outside 07:00-17:00 UTC/.test(html), 'the session row is labelled by its window');
  ok(/held back by the CLOCK alone/.test(html), 'and the clock is called out in words');
  ok(/10 of 24 hours/.test(html), 'with how much of the day it admits');

  const sized = S.csWhyEmptyHTML(S.csBlockerTally([setup([]), setup(['regime'])]));
  ok(/WHY THE HIGH-QUALITY BLOCK IS THIS SIZE/.test(sized),
     'with one through, the heading stops saying empty');
  ok(!/held back by the CLOCK alone/.test(sized), 'and no clock line when the clock blocked nothing');

  ok(S.csWhyEmptyHTML(S.csBlockerTally([])) === '', 'no signals at all renders nothing');
  ok(S.csWhyEmptyHTML(S.csBlockerTally([setup([])])) === '',
     'and neither does a scan where everything qualified');
  ok(S.csWhyEmptyHTML(null) === '', 'a missing tally renders nothing rather than throwing');

  /* ordering: the biggest blocker first */
  const ordered = S.csWhyEmptyHTML(S.csBlockerTally([
    setup(['regime']), setup(['session']), setup(['session']), setup(['session'])
  ]));
  ok(ordered.indexOf('outside 07:00-17:00 UTC') < ordered.indexOf('regime reads CHOP'),
     'rows are ordered by how much each gate blocked');

  const nasty = S.csWhyEmptyHTML(S.csBlockerTally([setup(['<img src=x onerror=alert(1)>'])]));
  ok(!/<img/.test(nasty) && /&lt;img/.test(nasty), 'an unknown gate key is escaped before it reaches the DOM');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the closing note stops blaming confluence for a shut clock');
{
  const src = stripComments(SCAN);
  ok(/csWhyEmptyHTML\(csBlockerTally\(setups\)\)/.test(src),
     'renderCards paints the panel from the same tally');
  ok(/csFooterNote\(setups, hqSetups\.length, csBlockerTally\(setups\), csFwdVerdict\(\)\)/.test(src),
     'and writes its closing note from it too');

  /* RENDER the note, both branches. A source scan here passed a mutation that
     pinned the condition to false, because the strings stay in the file. */
  ok(typeof S.csFooterNote === 'function', 'csFooterNote is reachable');

  const clockNight = [setup(['session']), setup(['session'])];
  const nightNote = S.csFooterNote(clockNight, 0, S.csBlockerTally(clockNight));
  ok(/outside 07:00-17:00 UTC — not the reads/.test(nightNote),
     'with nothing through and the clock sole, the note blames the clock');
  ok(/2 setups cleared everything else/.test(nightNote), 'and counts them');
  ok(!/lack sufficient confluence/.test(nightNote),
     'and does not also blame confluence');

  /* pack 879: EVERY gate gets named, not only the clock. The old note reached
     a hardcoded "most signals lack sufficient confluence" for four of five. */
  const readsNote = S.csFooterNote([setup(['confidence'])], 0,
                                   S.csBlockerTally([setup(['confidence'])]));
  ok(/price agreement under 75% — not the reads/.test(readsNote),
     'when price agreement is the reason, the note says price agreement');
  ok(!/lack sufficient confluence/.test(readsNote),
     'and never falls back to a phrase naming nothing in this pipeline');
  ok(!/07:00-17:00/.test(readsNote), 'without the clock line');

  const gotOne = [setup([]), setup(['session'])];
  const gotNote = S.csFooterNote(gotOne, 1, S.csBlockerTally(gotOne));
  ok(!/not the reads/.test(gotNote),
     'and with one signal through, no gate is blamed for an empty block that is not empty');

  ok(/Out of 0 total signals, 0 clear/.test(S.csFooterNote([], 0, S.csBlockerTally([]))),
     'an empty scan still renders a coherent note');
  ok(/Out of 0 total/.test(S.csFooterNote(null, null, null)),
     'and missing arguments do not throw');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
