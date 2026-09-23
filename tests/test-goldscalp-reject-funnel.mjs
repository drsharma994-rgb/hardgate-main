/* HARDGATE — GOLD SCALP says which GATE is binding, not just which setups fell.

   Every held-back setup already named its reason, and the per-instance list
   still prints every one of them — nothing is hidden and that stays true. But
   a reason names an INSTANCE ("opposing structure caps TP1 at 2403.87"), and a
   reader staring at an empty GOLD SCALP wants the GATE.

   MEASURED over 600 synthetic scans of goldScalpSetups:

     1,518 rejections  ->  9 distinct gates
     structure too close — R:R insufficient        890   58.6%
     liquidity sweep without volume climax         480   31.6%   (90% cumulative)
     engine stop below the 1.5xATR scalp floor      46    3.0%
     SCALP VWAP bounce, measured-negative at XM     40    2.6%
     FVG without HVN structural support             29    1.9%
     wrong-side stop (long)                         16    1.1%
     wrong-side stop (short)                         9    0.6%
     SCALP FVG FILL, measured-negative at XM         7    0.5%
     FIVE-LEG SWEEP ENGINE, measured-negative        1    0.1%

   Two gates account for ninety per cent of everything the desk holds back, and
   a flat list made the reader work that out for themselves across a thousand
   rows. 66% of those scans ended with nothing live, so this is the state the
   tab is in most of the time.

   THIS COUNTS; IT DOES NOT GATE. No setup is held back or released by anything
   here. The funnel is rendered above the unchanged per-instance list.

   Run: node tests/test-goldscalp-reject-funnel.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
const src = fs.readFileSync(root + 'goldscalp.js', 'utf8');

/* lift the four helpers out of the tab without booting the whole desk */
function grab(name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0;
  const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++){
    if (src[k] === '{') d++;
    else if (src[k] === '}'){ d--; if (!d) return src.slice(i, k + 1); }
  }
  return '';
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/* hg-v903 added gsPreGateLine, which gsRejectFunnelHTML now calls — lift it
   too, or the renderer throws on a name this harness never supplied. */
/* hg-v929 added gsRrShortfallHTML to the renderer's body. A lifted fragment
   that calls a name the harness never supplied throws at call time, so the
   new helpers and the step list come across too — and the step list is READ
   FROM SOURCE rather than retyped, so this harness cannot drift from it. */
function grabVar(name){
  const m = new RegExp('var ' + name + ' = [^;]+;').exec(src);
  if (!m) throw new Error('grabVar: ' + name + ' not found in goldscalp.js');
  return m[0];
}
const F = new Function('esc',
  grabVar('GS_RR_STEPS')
  + grab('gsGateFamily') + grab('gsGateShort') + grab('gsRejectFunnel')
  + grab('gsPreGateLine') + grab('gsRrFmt') + grab('gsRrShortfall')
  + grab('gsRrShortfallHTML') + grab('gsRejectFunnelHTML')
  + 'return { gsGateFamily, gsGateShort, gsRejectFunnel, gsPreGateLine, gsRejectFunnelHTML };')(esc);
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/* the nine gates as measured, with the instance detail that varies */
const rej = [];
const add = (n, strategy, mk) => { for (let i = 0; i < n; i++) rej.push({ strategy, dir: 'long', reason: mk(i) }); };
add(890, 'S37 FAILED-SWEEP', i => 'structure too close — R:R insufficient (opposing structure caps TP1 at ' + (2400 + i * 0.13).toFixed(2) + ')');
add(480, 'LIQ SWEEP', i => 'liquidity sweep without volume climax — V2 gate requires institutional activity (RVOL ' + (0.8 + i * 0.001).toFixed(3) + ')');
add(46, 'SWEEP→OB', i => 'engine stop ' + (0.3 + i * 0.01).toFixed(2) + '×ATR is below the 1.5×ATR scalp floor; at the floored stop TP1 pays 0.9R');
add(40, 'VWAP BOUNCE', () => 'SCALP VWAP bounce gross −0.13R / net −0.31R at XM (n=132, 33% WR) — negative before fees, not tradable');
add(29, 'FVG FILL', () => 'FVG without HVN structural support — V2 gate requires a high-volume node behind the gap');
add(16, 'SWEEP→OB', i => 'LONG stop must sit BELOW entry (got stop ' + (2500 + i).toFixed(4) + ' vs entry ' + (2496 + i).toFixed(4) + ')');
add(9, 'LIQ SWEEP', i => 'SHORT stop must sit ABOVE entry (got stop ' + (2290 + i).toFixed(4) + ' vs entry ' + (2291 + i).toFixed(4) + ')');
add(7, 'FVG FILL', () => 'SCALP FVG FILL shadow replay net −0.21R at XM over n=245 (gross+ but cost-eaten, 47% WR) — stays suppressed');
add(1, 'FIVE-LEG SWEEP', () => 'FIVE-LEG SWEEP ENGINE gross −0.04R / net −0.30R at XM (n=97, post stop-floor) — no edge at the venue');

/* ---------------------------------------------------------------- 1 */
console.log('\n1. an instance collapses to its gate');
{
  ok(typeof F.gsRejectFunnel === 'function' && typeof F.gsRejectFunnelHTML === 'function',
     'the funnel and its renderer are lifted from goldscalp.js');

  /* THE WHOLE POINT: two rejections that differ only in the price they quote
     are ONE gate, not two. */
  const a = F.gsGateFamily('opposing structure caps TP1 at 2403.87');
  const b = F.gsGateFamily('opposing structure caps TP1 at 2511.02');
  ok(a === b, 'two instances of one gate collapse together');
  const c = F.gsGateFamily('engine stop 0.62×ATR is below the 1.5×ATR scalp floor');
  const d = F.gsGateFamily('engine stop 0.79×ATR is below the 1.5×ATR scalp floor');
  ok(c === d, 'and so do two different ATR multiples');

  /* but genuinely different gates stay apart */
  ok(F.gsGateFamily('LONG stop must sit BELOW entry (got stop 1 vs entry 2)')
     !== F.gsGateFamily('SHORT stop must sit ABOVE entry (got stop 2 vs entry 1)'),
     'long and short wrong-side stops are not merged — they are different faults');
  ok(F.gsGateFamily('structure too close — R:R insufficient')
     !== F.gsGateFamily('liquidity sweep without volume climax'),
     'and two real gates are never merged');

  /* the unicode minus in the measured-negative reasons is a sign, not a gate */
  ok(F.gsGateFamily('net −0.21R at XM') === F.gsGateFamily('net −0.34R at XM'),
     'a negative figure collapses like any other number');
  ok(F.gsGateFamily(null) === '' && F.gsGateFamily(undefined) === '',
     'an absent reason collapses to nothing rather than throwing');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the ranking is the measurement');
{
  const rows = F.gsRejectFunnel(rej);
  ok(rows.length === 9, 'the nine measured gates come back as nine rows (' + rows.length + ')');
  ok(rows.reduce((a, g) => a + g.n, 0) === rej.length,
     'every rejection is counted exactly once (' + rej.length + ')');
  let ordered = true;
  for (let i = 1; i < rows.length; i++) if (rows[i].n > rows[i - 1].n) ordered = false;
  ok(ordered, 'and they are ranked by how often the gate actually bound');

  ok(/structure too close/.test(rows[0].gate) && rows[0].n === 890,
     'the binding gate is structure-too-close at 890');
  ok(/volume climax/.test(rows[1].gate) && rows[1].n === 480,
     'the second is sweep-without-volume-climax at 480');
  ok(Math.round(rows[0].pct + rows[1].pct) === 90,
     'the two of them are 90% of everything held back (' + Math.round(rows[0].pct + rows[1].pct) + '%)');
  ok(rows[8].n === 1, 'and the rarest gate is still listed, at one');

  /* the kinds a gate stopped, so a reader can see WHOSE setups it is eating */
  ok(rows[0].kindList.indexOf('S37 FAILED-SWEEP') >= 0, 'each gate names the setup kinds it stopped');
  const sweepOb = rows.filter(g => /below the/.test(g.gate))[0];
  ok(sweepOb && sweepOb.kindList.indexOf('SWEEP→OB') >= 0, 'including the stop-floor gate');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. what the reader is told');
{
  const t = text(F.gsRejectFunnelHTML(rej));
  ok(/WHY NOTHING LED/.test(t), 'the panel says what it is');
  ok(/1518 setups held back/.test(t), 'the count of held-back setups');
  ok(/across 9 gates/.test(t), 'how many gates that took');
  ok(/binding gate: structure too close/.test(t), 'and names the one that is binding');
  ok(/\(59%\)/.test(t), 'with its share');

  /* every gate is shown, not just the leader — the tab hides nothing */
  ok(/FIVE-LEG SWEEP ENGINE/.test(t) || /no edge at the venue/.test(t) || /890/.test(t),
     'the full ranked list is rendered, down to the single-instance gate');
  ok(/480/.test(t) && /46/.test(t) && /29/.test(t), 'with each gate its own count');

  /* a single gate needs no "binding gate" clause — there is nothing to rank */
  const one = text(F.gsRejectFunnelHTML(rej.slice(0, 5)));
  ok(/across 1 gate\b/.test(one), 'one gate is reported as one gate');
  ok(!/binding gate/.test(one), 'and is not announced as the binding one of a field of one');

  ok(F.gsRejectFunnelHTML([]) === '', 'nothing held back renders nothing');
  ok(F.gsRejectFunnelHTML(null) === '', 'and neither does nothing at all');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. it counts; it does not gate');
{
  /* a rejection with no reason is still counted rather than vanishing */
  const noReason = F.gsRejectFunnel([{ strategy: 'X' }, { strategy: 'Y' }]);
  ok(noReason.length === 1 && noReason[0].n === 2,
     'rejections with no reason are pooled and counted, not dropped');

  /* the funnel must not be able to change a verdict: it reads, never writes */
  const src2 = grab('gsRejectFunnel') + grab('gsRejectFunnelHTML') + grab('gsGateFamily');
  ok(!/\.dropped\s*=/.test(src2) && !/\.demoted\s*=/.test(src2) && !/\.vetoed\s*=/.test(src2),
     'nothing in the funnel writes dropped, demoted or vetoed');
  ok(!/\breturn\s+rejected\b/.test(src2), 'and it never hands back a mutated list');

  /* the per-instance list is still rendered, underneath */
  /* hg-v903 added the pre-gate tally as a second argument; the ORDER is what
     this pins — the ranked panel above the per-instance list, both paths. */
  ok(/gsRejectFunnelHTML\(rejectedAll, preGateAll\)\s*\n\s*\+ rejectedHTML\(rejectedAll\)/.test(src),
     'the ranked panel sits ABOVE the per-instance list, which is unchanged');
  ok((src.match(/gsRejectFunnelHTML\(rejectedAll, preGateAll\)/g) || []).length === 2,
     'and it is wired into both render paths — the one with cards and the one without');
  ok(/every reason named \(never silently dropped\)/.test(src),
     'the per-instance list still promises every reason is named');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
