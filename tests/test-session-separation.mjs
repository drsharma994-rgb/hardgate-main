/* HARDGATE — the factor that decides who may lead on GOLD SCALP, measured.

   goldind demotes every setup formed outside an ICT killzone, and a demoted
   row can never be MOST PROBABLE. On the committed walk that is 1,479 of
   2,605 formed setups off-session (56.8%), 1,157 demoted for it (78.2% — the
   Asian-range strategy is exempt by design), and 0 of 111 MOST PROBABLE rows
   off-session. It is not a tie-break; it decides the leader board outright.

   AND TIME OF DAY SEPARATES NOTHING, on the bar every other gold verdict here
   must clear: four DISJOINT windows agreeing on win% AND gross AND net, at
   BOTH fill bounds. Not one killzone split carries a verdict. The cohort the
   rule most favours (London/NY overlap at maximum weight) points the WRONG
   way; the cohort it demotes reads mildly positive. Neither is unanimous.

   SO THE DEMOTE IS UNCHANGED, AND THAT IS THE POINT. 2 of 4 windows is not a
   verdict either — removing it would be loosening on evidence that does not
   clear the bar, which hg-v920 refused three times. What ships is the
   disclosure and a lever (hgGoldSetOffSessionDemote) that defaults to ON.

   This file pins: the numbers are GENERATED from the replay and round-trip to
   zero drift; the verdict rule is an exported function exercised on MIXED
   inputs (hg-v937's lesson); the default does not move; the lever works; and
   GOLD SWING is untouched, because it states killzones are deliberately not a
   swing gate.

   Run: node tests/test-session-separation.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { run, renderLiteral, splice, verdict, coverage, otherDemotes, DEMOTE_STAMPS,
         SPLITS, BEGIN, END } from '../scripts/session-separation.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };
const src = f => fs.readFileSync(root + f, 'utf8');

console.log('\n1. the literal is GENERATED and round-trips to zero drift');
{
  const res = run();
  const block = renderLiteral(res);
  const cur = src('goldind.js');
  ok(cur.indexOf(BEGIN) > 0 && cur.indexOf(END) > 0, 'goldind.js carries both markers');
  ok(splice(cur, block) === cur,
     'the committed tree round-trips to ZERO DRIFT — no hand-edited number');
  /* idempotence, not just round-trip: hg-v935 shipped a splice whose own
     output was not its fixed point */
  ok(splice(splice(cur, block), block) === cur, 'and the splice is idempotent');
  /* and it rebuilds byte-identical from a corrupted block */
  const broken = cur.replace(/offPct: [\d.]+/, 'offPct: 99.9');
  ok(broken !== cur, 'a corrupted copy really differs');
  ok(splice(broken, block) === cur, 'and is rebuilt byte-identical by the generator');
}

console.log('\n2. a missing marker is FATAL, never skipped');
{
  let threw = false;
  try { splice('no markers here', 'x'); } catch (e) { threw = /BEGIN marker/.test(e.message); }
  ok(threw, 'a file without the BEGIN marker throws rather than silently doing nothing');
  threw = false;
  try { splice(BEGIN + ' only', 'x'); } catch (e) { threw = /END marker/.test(e.message); }
  ok(threw, 'and a file without the END marker too');
}

console.log('\n3. what the demote actually withholds');
{
  const c = coverage();
  ok(c.n > 2000, 'the walk is the committed one (n=' + c.n + ')');
  ok(c.off > 1000, c.off + ' formed setups carry the OFF-SESSION stamp ('
     + c.offPct + '% of the walk) — which is what makes it look decisive');
  /* THE NUMBER THAT MATTERS. hg-v184 / hg-v929: a share is not a cost. */
  ok(c.sole < c.off * 0.05,
     '  but it is the SOLE demote on only ' + c.sole + ' rows (' + c.solePctOfOff
     + '% of those) — relaxing it would return ' + c.sole + ' setups, not ' + c.off);
  ok(c.solePctOfBook < 1,
     '  which is ' + c.solePctOfBook + '% of the whole walk');
  ok(Array.isArray(c.coTop) && c.coTop.length >= 3 && c.coTop[0][1] > c.sole * 10,
     '  and the real demotes are named and far larger: '
     + c.coTop.map(x => x[0] + ' ' + x[1]).join(', '));
  /* DERIVED independently from the raw walk, not just compared to 0: the true
     value IS 0, so asserting `=== 0` cannot tell a real count from a hardcoded
     one. Recompute both sides here and require the generator to agree. */
  const raw = JSON.parse(fs.readFileSync(root + 'scripts/backtest-goldscalp-results-floor.json', 'utf8')).trades;
  const rawTyped = raw.filter(t => typeof t.killzoneWeight === 'number');
  const rawLed = rawTyped.filter(t => t.mp);
  const rawLedOff = rawLed.filter(t => t.killzoneWeight === 0).length;
  /* coverage() counts the OFF-SESSION STAMP, not killzoneWeight===0: the two
     differ by the Asian-range carve-out, which is exempted before the stamp is
     applied. Counting the weight here would test a different quantity. */
  const rawOff = rawTyped.filter(t => (t.stamps || []).indexOf('OFF-SESSION') >= 0).length;
  ok(c.led === rawLed.length && c.off === rawOff,
     'the generator\'s leader and off-session totals match an independent count');
  ok(c.ledOff === rawLedOff,
     '  and so does ledOff (' + c.ledOff + ') — a derived number, not a literal');
  ok(rawLedOff === 0,
     'ZERO of the ' + c.led + ' MOST PROBABLE rows were off-session — the demote '
     + 'decides the leader board, it does not merely tilt it');
  ok(rawOff > 0, '  while ' + rawOff + ' off-session setups were formed');

  /* THE TRUE VALUE IS ZERO, so no assertion against this walk can tell a
     derived 0 from a hardcoded one — `ledOff = 0` passes every check above.
     So drive coverage() against a fixture where the answer MUST be non-zero. */
  const fx = path.join(os.tmpdir(), 'hg-sessionsep-fixture-' + process.pid + '.json');
  fs.writeFileSync(fx, JSON.stringify({ trades: [
    { killzoneWeight: 0, demoted: true,  mp: true,  stamps: ['OFF-SESSION'] },
    { killzoneWeight: 0, demoted: true,  mp: true,  stamps: ['OFF-SESSION', 'EDGE DEMOTE'] },
    { killzoneWeight: 0, demoted: false, mp: false, stamps: ['OFF-SESSION'] },
    { killzoneWeight: 3, demoted: false, mp: true,  stamps: [] },
    { killzoneWeight: 1, demoted: true,  mp: false, stamps: ['CHOP'] }
  ] }));
  try {
    const f = coverage(fx);
    ok(f.n === 5, 'fixture: 5 trades counted');
    ok(f.off === 3, '  3 off-session (counted whether or not they were demoted)');
    ok(f.offDemoted === 2, '  2 of those demoted');
    ok(f.sole === 2, '  2 sole-blocked — the third also carries EDGE DEMOTE');
    ok(f.coTop.length === 1 && f.coTop[0][0] === 'EDGE DEMOTE',
       '  and the co-blocker is named');
    ok(f.led === 3, '  3 leaders');
    ok(f.ledOff === 2,
       '  and ledOff is 2 — a HARDCODED zero fails here, which the real walk cannot show');
  } finally { try { fs.unlinkSync(fx); } catch (e) {} }
}

console.log('\n3b. the sole-blocker count is auditable, not asserted');
{
  ok(DEMOTE_STAMPS instanceof Set && DEMOTE_STAMPS.size >= 10,
     'the demote-stamp set is ENUMERATED (' + DEMOTE_STAMPS.size + ' stamps), so the '
     + 'sole count can be audited — a missing stamp would inflate it');
  ok(otherDemotes({ stamps: ['OFF-SESSION'] }).length === 0,
     'a row with only OFF-SESSION has no other demote');
  ok(otherDemotes({ stamps: ['OFF-SESSION', 'EDGE DEMOTE'] }).length === 1,
     'a row also carrying EDGE DEMOTE does');
  ok(otherDemotes({ stamps: ['OFF-SESSION', 'CONF 27/NO_TRADE'] })[0] === 'CONF NO TRADE',
     'the scored CONF stamp normalises — the score is in the text, so a raw match '
     + 'would miss every one of them');
  ok(otherDemotes({ stamps: ['OFF-SESSION', 'CVD PROXY', 'VP TARGETS'] }).length === 0,
     'and informational stamps are NOT counted as demotes');
  ok(otherDemotes(null).length === 0 && otherDemotes({}).length === 0, 'null-safe');
}

console.log('\n4. nothing carries a verdict, and the rule that says so is testable');
{
  const res = run();
  ok(res.anyVerdict === false, 'no killzone split is unanimous at both bounds');
  for (const [k] of SPLITS) ok(res.verdicts[k] === null, '  ' + k + ': no verdict');

  /* hg-v937: an inline `every` over inputs that all agree survives mutation to
     `some`. So the rule is exported and exercised on MIXED inputs. */
  const U = (sign) => ({ unanimous: true, sign, thin: false });
  ok(verdict({ 'as-recorded': U('better'), lower: U('better') }) === 'better',
     'both bounds unanimous and agreeing -> a verdict');
  ok(verdict({ 'as-recorded': U('better'), lower: U('worse') }) === null,
     'bounds that DISAGREE in sign -> no verdict');
  /* the fixture must not agree with the mutation: a non-unanimous side whose
     sign is NULL is rejected by the sign check too, so it cannot tell whether
     the unanimity check ran. Give it a MATCHING sign. */
  ok(verdict({ 'as-recorded': U('better'), lower: { unanimous: false, sign: 'better', thin: false } }) === null,
     'one bound not unanimous -> no verdict, even when the signs agree');
  ok(verdict({ 'as-recorded': { unanimous: false, sign: 'better', thin: false }, lower: U('better') }) === null,
     '  and in either order');
  /* likewise a thin side that is otherwise perfect — a bare {thin:true} is
     rejected by the unanimity check and proves nothing about the thin guard */
  ok(verdict({ 'as-recorded': { thin: true, unanimous: true, sign: 'better' }, lower: U('better') }) === null,
     'a thin side -> no verdict, even when it claims to be unanimous and agreeing');
  ok(verdict(null) === null && verdict({}) === null, 'missing input -> no verdict');
}

console.log('\n5. the favoured cohort points the wrong way, the demoted one does not');
{
  const res = run();
  const mx = res.splits.kzMax, off = res.splits.offSession;
  ok(mx['as-recorded'].dNet < 0 && mx.lower.dNet < 0,
     'the MAXIMUM-weight cohort is negative at both bounds ('
     + mx['as-recorded'].dNet + ' / ' + mx.lower.dNet + ')');
  ok(off['as-recorded'].dNet > 0 && off.lower.dNet > 0,
     'the DEMOTED off-session cohort is positive at both bounds ('
     + off['as-recorded'].dNet + ' / ' + off.lower.dNet + ')');
  ok(off['as-recorded'].windows === '2/4' && off.lower.windows === '2/4',
     '  and is 2 of 4 windows at each bound — NOT a verdict, which is exactly '
     + 'why the demote is not removed');
}

console.log('\n6. the default does not move, and the lever does');
{
  globalThis.window = globalThis; globalThis.self = globalThis;
  const S = {};
  globalThis.localStorage = { getItem: k => (k in S ? S[k] : null),
    setItem: (k, v) => { S[k] = String(v); }, removeItem: k => { delete S[k]; } };
  globalThis.document = { getElementById: () => null,
    createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
    querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  vm.runInThisContext(src('goldind.js'), { filename: 'goldind.js' });

  ok(globalThis.hgGoldOffSessionDemoteOn() === true,
     'the off-session demote is ON by default — this pack changes no behaviour');
  globalThis.hgGoldSetOffSessionDemote(false);
  ok(globalThis.hgGoldOffSessionDemoteOn() === false, 'the lever turns it off');
  globalThis.hgGoldSetOffSessionDemote(true);
  ok(globalThis.hgGoldOffSessionDemoteOn() === true, '  and back on');
  /* COLD START. The earlier setOffSessionDemote(true) wrote '1' to the store,
     which would make a parser mutated to `v === '1'` still read ON. Clear it
     so this asserts the real first-run path. */
  delete S[Object.keys(S).find(k => /offsession/i.test(k))];
  globalThis.hgGoldOffSessionDemoteInit();
  ok(globalThis.hgGoldOffSessionDemoteOn() === true,
     'with NOTHING stored — the true cold start — init resolves to ON');

  const gi = src('goldind.js');
  ok(/hgGoldOffSessionDemoteOn\(\)\s*\n?\s*&&\s*!inKillzone/.test(gi)
     || /hgGoldOffSessionDemoteOn\(\)[\s\S]{0,80}!inKillzone/.test(gi),
     'the demote site reads the lever');
}

console.log('\n7. the panel says what it must, and invents nothing');
{
  const h = globalThis.hgGoldSessionSepPanelHtml();
  const t = String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const c = coverage();
  ok(t.length > 0, 'the panel renders');
  ok(t.indexOf(String(c.off)) >= 0 && t.indexOf(String(c.n)) >= 0,
     'it names how much of the book is off-session (' + c.off + ' of ' + c.n + ')');
  ok(t.indexOf(String(c.offDemoted)) >= 0, '  and how many of those are demoted');
  ok(new RegExp(c.ledOff + ' of ' + c.led + ' *</?b?>? *leaders were off-session', 'i')
       .test(t) || /leaders were off-session/i.test(t),
     '  and that no leader was off-session, in those words — a bare "0 of 111" '
     + 'could be any count');
  ok(t.indexOf(String(c.led)) >= 0, '  naming the leader total it is 0 of');
  ok(/none/i.test(t), 'it says no split carries a verdict');
  ok(/wrong way/i.test(t), '  and that the favoured cohort points the wrong way');
  ok(/nothing here is acted on/i.test(t),
     'it states plainly that nothing is acted on');
  ok(/hgGoldSetOffSessionDemote/.test(String(h)), '  and names the lever');
  ok(t.indexOf('sole demote on ' + c.sole) >= 0 || new RegExp('sole demote on\\s*' + c.sole).test(t),
     'the panel LEADS with the sole-blocker count (' + c.sole + '), not the share');
  ok(t.indexOf(String(c.coTop[0][0])) >= 0,
     '  and names what is actually demoting those rows (' + c.coTop[0][0] + ')');
  ok(/not what is emptying this board/i.test(t),
     '  and says so in the heading, so the share cannot be misread as the cost');
  ok(/moved lead-eligible candidates by zero/i.test(t),
     'it reports that pulling the lever measured ZERO change on the real mint');

  ok(/verdict/i.test(t), 'the table carries a verdict column');

  /* NO LITERAL, NO PANEL — and proved by loading goldind with the generated
     block genuinely replaced, in its own context. Nulling a global does not
     touch the closure variable the renderer actually reads, so the obvious
     version of this test passes against a renderer that fabricates. */
  const nulled = src('goldind.js').replace(
    src('goldind.js').slice(src('goldind.js').indexOf(BEGIN),
                            src('goldind.js').indexOf(END) + END.length),
    'var HG_GOLD_SESSION_SEP = null;');
  ok(nulled.indexOf('var HG_GOLD_SESSION_SEP = null;') > 0, 'the literal really was nulled');
  const c2 = vm.createContext({ Math, Date, JSON, isFinite, isNaN, parseFloat, parseInt,
    Array, Object, String, Number, RegExp, Float64Array, Infinity, NaN,
    console: { log(){}, warn(){}, error(){} }, setTimeout: () => 0, clearTimeout(){},
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    document: { getElementById: () => null,
      createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
      querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
      documentElement: { appendChild(){} }, addEventListener(){} } });
  c2.window = c2; c2.self = c2; c2.globalThis = c2;
  try { vm.runInContext(nulled, c2, { filename: 'goldind-nulled.js' }); } catch (e) {}
  ok(typeof c2.hgGoldSessionSepPanelHtml === 'function', 'the renderer still loads');
  ok(c2.hgGoldSessionSepPanelHtml() === '',
     'with no literal it renders NOTHING — never a zero-filled panel');

  /* hg-v935's lesson: today the answer is "none", so a renderer that HARDCODES
     "none" is indistinguishable from one that branches. Feed it a literal that
     DOES carry a verdict and require the panel to say so — otherwise a future
     bake that finds one stays hidden behind today's answer. */
  const withVerdict = src('goldind.js').replace(
    src('goldind.js').slice(src('goldind.js').indexOf(BEGIN),
                            src('goldind.js').indexOf(END) + END.length),
    "var HG_GOLD_SESSION_SEP = { windows: 4, anyVerdict: true,"
    + " coverage: { n: 10, off: 6, offPct: 60, offDemoted: 5, offDemotedPct: 83,"
    + " led: 4, ledOff: 1, ledOffPct: 25 },"
    + " splits: { offSession: { dWin: [1,1], dGross: [0.1,0.1], dNet: [0.1,0.1],"
    + " windows: ['4/4','4/4'], verdict: 'better' } } };");
  const c3 = vm.createContext({ Math, Date, JSON, isFinite, isNaN, parseFloat, parseInt,
    Array, Object, String, Number, RegExp, Float64Array, Infinity, NaN,
    console: { log(){}, warn(){}, error(){} }, setTimeout: () => 0, clearTimeout(){},
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    document: { getElementById: () => null,
      createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
      querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
      documentElement: { appendChild(){} }, addEventListener(){} } });
  c3.window = c3; c3.self = c3; c3.globalThis = c3;
  try { vm.runInContext(withVerdict, c3, { filename: 'goldind-verdict.js' }); } catch (e) {}
  const tv = String(c3.hgGoldSessionSepPanelHtml())
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  ok(tv.length > 0, 'a literal carrying a verdict still renders');
  ok(!/None does/i.test(tv),
     'and the panel does NOT say "none does" — it branches on the verdict');
  ok(/carries one/i.test(tv), '  it announces that a split carries one');
  ok(/BETTER/.test(tv), '  and prints that verdict in the table');
}

console.log('\n8. GOLD SWING is untouched, deliberately');
{
  const gsw = src('goldswing.js');
  ok(/killzones are deliberately NOT a case here/i.test(gsw)
     || /never a swing gate/i.test(gsw),
     'goldswing.js states killzones are not a swing gate — so the desk difference '
     + 'is a documented choice, not drift');
  ok(!/hgGoldSessionSepPanelHtml/.test(gsw),
     '  and the panel is not bolted onto a desk the rule does not govern');
  ok(/hgGoldSessionSepPanelHtml/.test(src('goldscalp.js')),
     'GOLD SCALP, which the rule does govern, renders it on WHY SILENT');
}

console.log('\n' + passed + ' assertions passed');
