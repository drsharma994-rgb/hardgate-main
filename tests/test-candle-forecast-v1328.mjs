/* hg-v1329: the shared perfect bar, an in-sample walk, and the forward ledger.
   Perfect is a badge. It does not form a setup and it does not move a stop.
   The walk counts only. It is not a forward result and not a probability. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok -', m); };
const src = fs.readFileSync(path.join(root, 'goldind.js'), 'utf8');
const tab = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');

function lift(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i++; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}

const ctx = {
  console, Math, Date, JSON, Number, String, Object, Array, RegExp, Error, isFinite, isNaN
};
ctx.window = undefined;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(
  ['hgCfHost', 'hgCfPerfectReads', 'hgCfPerfectAsk', 'hgCfWalk', 'hgCfForwardMark', 'hgCfMeasure']
    .map(lift).join('\n'),
  ctx
);

function tape(n, step) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const c = 2300 + i * (step || 0.1);
    rows.push({ t: 1_700_000_000_000 + i * 900_000, o: c - 0.4, h: c + 0.8, l: c - 0.9, c: c, v: 10 });
  }
  return rows;
}

console.log('== perfect bar ==');
{
  const setup = { formed: true, dir: 'BULL', entry: 100, stop: 99, tp1: 101, confluenceView: { familiesAgainst: 0 } };
  const missing = ctx.hgCfPerfectAsk(setup, setup.confluenceView);
  ok(/not loaded/i.test(missing.line), 'without the home, nothing is called perfect (' + missing.line + ')');
  ok(missing.perfect === false, 'and the flag stays false');

  let seen = null;
  ctx.hgPerfectFormation = function (c) {
    seen = c;
    return { perfect: false, plus: false, why: ['grade unread (needs top)'] };
  };
  const asked = ctx.hgCfPerfectAsk(setup, setup.confluenceView);
  ok(asked.why[0] === 'grade unread (needs top)', 'the shared why is passed through (' + asked.line + ')');
  ok(/Not perfect/.test(asked.line) && /unchanged/.test(asked.line), 'the line says the setup is unchanged');
  ok(seen && seen.grade == null && seen.tally == null, 'grade and tally were not invented');
  ok(seen.dir === 'long' && seen.oppose === 0 && seen.t1 === 101 && seen.stop === 99, 'the bracket already on the setup is what was asked');
  ok(setup.formed === true && setup.stop === 99 && setup.tp1 === 101, 'asking did not move the setup');

  const none = ctx.hgCfPerfectAsk({ formed: false, dir: 'BULL' }, null);
  ok(/not asked to mint/i.test(none.line), 'an unformed read is not minted into a perfect setup');
}

console.log('== in-sample walk ==');
{
  const bad = tape(50);
  bad[10].t = bad[9].t;
  const refused = ctx.hgCfWalk(bad, { tf: '15m', horizonBars: 32 });
  ok(refused.formed === 0 && refused.tp1 === 0, 'a non-increasing tape counts nothing');
  ok(/strictly increasing/.test(refused.why) && /Nothing was counted as a win/.test(refused.why),
    'and it says why (' + refused.why + ')');

  ctx.goldCandleForecast = function () { return { dir: 'NEUTRAL' }; };
  ctx.hgCfBuildSetup = function () { return { formed: false, dir: 'NEUTRAL' }; };
  const quiet = ctx.hgCfWalk(tape(80), { tf: '15m', horizonBars: 32 });
  ok(quiet.formed === 0 && quiet.tp1 === 0 && quiet.stop === 0, 'no setup means no win count');
  ok(/Nothing was counted as a win/.test(quiet.why), 'and it says nothing was counted as a win');
  ok(/in-sample/.test(quiet.why) && /Not a forward result/.test(quiet.why) && /not a probability/.test(quiet.why),
    'and it is labelled in-sample (' + quiet.why + ')');
  ok(/Higher frames were not fed/.test(quiet.why), 'higher frames are named as not fed');

  let tapesFed = false;
  let settled = 0;
  ctx.goldCandleForecast = function (rows, macro, tapes) {
    if (tapes) tapesFed = true;
    const c = rows[rows.length - 1].c;
    return { dir: 'BULL', close: c, sl: c - 1, tp1: c + 1, tp2: c + 2 };
  };
  ctx.hgCfBuildSetup = function (rows, opts, fc) {
    return { formed: true, dir: 'BULL', entry: fc.close, stop: fc.sl, tp1: fc.tp1, tf: opts.tf };
  };
  ctx.hgFwdSettleOne = function (rec) {
    settled++;
    if (!(rec.barT > 0) || rec.state !== 'open' || !(rec.risk > 0)) throw new Error('bad record');
    return { state: 't1' };
  };
  const walked = ctx.hgCfWalk(tape(80), { tf: '15m', horizonBars: 32 });
  ok(!tapesFed, 'the walk does not pass a higher tape');
  ok(walked.formed > 0 && walked.formed === walked.tp1 && walked.stop === 0, 'a settled TP1 is a count, not a rate (' + walked.why + ')');
  ok(settled === walked.formed, 'every formed setup went through the settler');
  ok(/in-sample/.test(walked.why) && /Not a forward result/.test(walked.why), 'the counted walk stays labelled in-sample');

  delete ctx.hgFwdSettleOne;
  const noSettle = ctx.hgCfWalk(tape(80), { tf: '15m', horizonBars: 32 });
  ok(/settler is not loaded/.test(noSettle.why), 'without the settler, nothing is counted (' + noSettle.why + ')');
  ok(noSettle.formed === 0 && noSettle.tp1 === 0, 'and a missing settler is not a win');
}

console.log('== forward ledger ==');
{
  delete ctx.hgFwdResolve;
  delete ctx.hgFwdRecordScan;
  const rows = tape(80);
  const unloaded = ctx.hgCfForwardMark({ formed: true, dir: 'BULL', entry: 10, stop: 9, tp1: 11 }, rows, '15m');
  ok(/not loaded/.test(unloaded.why) && unloaded.recorded === 0, 'without the ledger, nothing is recorded (' + unloaded.why + ')');

  let saved = null;
  ctx.hgFwdResolve = function (sym, tf) { return (sym === 'XAUUSD' && tf === '4h') ? 1 : 0; };
  ctx.hgFwdRecordScan = function (tabName, tf, cands, opts) {
    saved = { tabName, tf, cands, opts };
    return 1;
  };
  const swing = { formed: true, dir: 'BEAR', entry: 100, stop: 101, tp1: 98, ticket: true };
  const marked = ctx.hgCfForwardMark(swing, rows, '4h');
  ok(marked.recorded === 1, 'a formed swing is recorded');
  ok(saved.tabName === 'CANDLE FORECAST' && saved.tf === '4h' && saved.cands[0].mechanic === 'SWING', 'the tab, frame and mechanic are the swing');
  ok(saved.cands[0].mark === saved.cands[0].entry && saved.cands[0].perfect === undefined, 'the mark is the entry and perfect is not invented');
  ok(saved.opts.horizonBars === 20 && saved.cands[0].dir === 'short' && saved.cands[0].sym === 'XAUUSD', 'the swing horizon is 20 bars of 4h');

  const scalp = { formed: true, dir: 'BULL', entry: 10, stop: 9, tp1: 11, perfect: true };
  ctx.hgCfForwardMark(scalp, rows, '15m');
  ok(saved.tf === '15m' && saved.cands[0].mechanic === 'SCALP' && saved.opts.horizonBars === 96, 'the scalp horizon is 96 bars of 15m');
  ok(saved.cands[0].perfect === true, 'a true perfect mark is forwarded');

  const idle = ctx.hgCfForwardMark({ formed: false, dir: 'BULL' }, rows, '15m');
  ok(/not formed is not a forward test/.test(idle.why) && idle.recorded === 0, 'an unformed read is not recorded');
}

console.log('== measure does not rewrite the setup ==');
{
  const scalp = { formed: true, ok: true, dir: 'BULL', entry: 10, stop: 9, tp1: 11, confluenceView: { familiesAgainst: 1 } };
  const swing = { formed: false, ok: false, tf: '4h', why: 'the 4h gold tape could not be read' };
  ctx.hgPerfectFormation = function () { return { perfect: false, plus: false, why: ['grade unread (needs top)'] }; };
  ctx.goldCandleForecast = function () { return null; };
  const m = ctx.hgCfMeasure(scalp, swing, tape(80), null);
  ok(scalp.formed === true && scalp.stop === 9 && scalp.tp1 === 11, 'measure leaves the bracket where it was');
  ok(scalp.perfect !== true, 'a failed bar does not stamp perfect');
  ok(/grade unread/.test(m.scalpAsk.line), 'the scalp line names the unread grade');
  ok(/too thin|Nothing was counted as a win/.test(m.walk4.why), 'a missing 4h tape walks nothing (' + m.walk4.why + ')');
}

console.log('== a desk candidate keeps its own perfect bar ==');
{
  const deskSrc = lift('hgCfDeskVotes');
  ok(!/score|weight|points/i.test(deskSrc.replace(/\/\*[\s\S]*?\*\//g, ' ')), 'the desk reader still has no score, weight or points');
  const dctx = { console, Math, Date, JSON, Number, String, Object, Array, isFinite, isNaN };
  dctx.globalThis = dctx;
  dctx.window = dctx;
  vm.createContext(dctx);
  vm.runInContext(deskSrc, dctx);
  dctx.hgPerfectFormation = function (c) {
    return (c.grade === 'A' && c.oppose === 0 && c.tally > 0)
      ? { perfect: true, plus: false, why: [] }
      : { perfect: false, plus: false, why: ['grade unread (needs top)'] };
  };
  dctx.goldScalpSetups = function () { return [{ dir: 'long', grade: 'A', oppose: 0, tally: 4 }]; };
  dctx.goldSwingSetups = function () { return [{ dir: 'long' }]; };
  const rows = tape(40).map(function (b) { return { o: b.o, h: b.h, l: b.l, c: b.c, v: 1, t: 0 }; });
  const dv = dctx.hgCfDeskVotes(rows, {}, 'BULL');
  const scalp = dv.desks.find(function (d) { return d.desk === 'GOLD SCALP'; });
  const swing = dv.desks.find(function (d) { return d.desk === 'GOLD SWING'; });
  ok(scalp && scalp.lean === true && scalp.perfect === true, 'a desk candidate that already passes is named PERFECT');
  ok(/own candidate/.test(scalp.perfectWhy), 'and the line says it is that desk\'s own candidate');
  ok(swing && swing.lean === true && swing.perfect !== true && /grade unread/.test(swing.perfectWhy),
    'a desk candidate with no grade is not called perfect (' + (swing && swing.perfectWhy) + ')');
  ok(scalp.long === 1 && scalp.short === 0, 'the badge did not change the formed count');
}

console.log('== the card ==');
{
  ok(/data-cf-measure="1"/.test(tab), 'the card has a measure block');
  ok(/PERFECT, BACKTEST, FORWARD/.test(tab), 'the card names the three reads');
  ok(/not a forward result and not a probability/.test(tab), 'the card says the walk is not a probability');
  ok(/It does not form the setup and it does not move the stop/.test(tab), 'perfect is not a gate');
  ok(/window\.hgCfMeasure\(/.test(tab), 'the tab asks the measure');
  const iMeas = tab.indexOf('window.hgCfMeasure(');
  const iRend = tab.indexOf('this.renderResult(resultArea, statusEl, forecast);');
  ok(iMeas > 0 && iMeas < iRend, 'the measure is asked before the card is painted');
  ok(/this\.renderResult\(resultArea, statusEl, forecast\);[\s\S]{0,500}hgUltimateConfluence\(candles\)/.test(tab),
    'the wide tally still paints after the card');
  ok(!/bothBrackets/.test(tab), 'the card does not paint both brackets');
  ok(!/tp1\s*=\s*[^=]/.test(tab) && !/stop\s*=\s*[^=]/.test(tab), 'the tab still computes no stop or target');
  ok(/not the same risk/.test(tab), 'the scalp and swing stops are still not the same risk');
  const askSrc = lift('hgCfPerfectAsk');
  ok(!/cand\.grade\s*=/.test(askSrc) && !/cand\.tally\s*=/.test(askSrc), 'the ask source invents neither grade nor tally');
  const walkSrc = lift('hgCfWalk');
  ok(/hgFwdSettleOne/.test(walkSrc) && !/hitStop/.test(walkSrc), 'the walk uses the settler and does not copy it');
  ok(/goldCandleForecast\(slice, null, null\)/.test(walkSrc), 'the walk passes no higher tape');
}

console.log('\ntest-candle-forecast-v1328: ' + pass + ' passed');
