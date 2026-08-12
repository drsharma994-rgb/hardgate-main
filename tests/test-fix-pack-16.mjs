/* HARDGATE — fix pack 16 regression guards (gold deep families + provenance). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hgGateFamilies, hgFamilyRollup, hgFamilyDissentLine, hgDeepSwingGateIds,
} from '../lib/gate-families.mjs';
import { hgFamilyVerdict } from '../lib/family-verdict.mjs';
import { hgVolumeTrust } from '../lib/volume-trust.mjs';
import {
  hgGoldSrcFinalize, hgGoldSrcAssign, hgMixedFeedReason,
} from '../lib/gold-src-provenance.mjs';
import { hgDeepGateAudit, hgDeepFamilyAudit } from '../lib/gold-tally-audit.mjs';
import { hgGoldAPlus } from '../lib/gold-aplus.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const gs = fs.readFileSync(path.join(root, 'goldscalp.js'), 'utf8');
const gsw = fs.readFileSync(path.join(root, 'goldswing.js'), 'utf8');
const gind = fs.readFileSync(path.join(root, 'goldind.js'), 'utf8');

let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

function mkLedger(states) {
  const meta = hgGateFamilies();
  return Object.keys(meta).map((id) => [id, meta[id].label, states[id] || 'pass', 'detail']);
}

console.log('== gate families ==');
{
  const meta = hgGateFamilies();
  const ids = hgDeepSwingGateIds();
  ok(ids.length === 37, 'family map covers 37 swing gates');
  const trend = ids.filter((id) => meta[id].family === 'trend');
  ok(trend.length === 16, 'trend family holds exactly 16 members');
  const seen = new Set(ids);
  ok(seen.size === 37, 'every gate id appears exactly once');
  for (const m of html.matchAll(/sg\.push\(\['(G\d+)'/g)) {
    ok(seen.has(m[1]), 'index.html gate ' + m[1] + ' in family map');
  }
}

console.log('== family rollup ==');
{
  const states = {};
  Object.keys(hgGateFamilies()).forEach((id) => { states[id] = 'pass'; });
  states.G8 = 'veto';
  states.G36 = 'veto';
  const rollup = hgFamilyRollup(mkLedger(states));
  const trend = rollup.find((r) => r.family === 'trend');
  ok(trend && trend.verdict === 'SPLIT', 'SPLIT when trend members disagree');
  ok(trend.dissent.length === 2, 'named dissenters on SPLIT');
  const line = hgFamilyDissentLine(trend);
  ok(/G8/.test(line) && /G36/.test(line), 'dissent line names gate ids');
  ok(/fast members flipping/.test(line), 'fast-member dissent tagged for trend');
}

console.log('== family verdict ==');
{
  const allPass = mkLedger(Object.fromEntries(hgDeepSwingGateIds().map((id) => [id, 'pass'])));
  const rollup = hgFamilyRollup(allPass);
  const fv = hgFamilyVerdict(rollup, { legacyScore: 95 });
  ok(fv.total === 12, 'counts 12 families not 37');
  ok(fv.legacyScore === 95, 'legacy percentage preserved');
  ok(fv.label === 'STRONG', 'STRONG at 10+ agree 0 oppose');

  const timing = mkLedger({ G29: 'veto' });
  const tr = hgFamilyRollup(timing);
  const tv = hgFamilyVerdict(tr, { legacyScore: 99 });
  ok(tv.timingVeto && tv.tier === 'veto', 'G29 timing veto cannot be outvoted');

  const rrV = hgFamilyVerdict(rollup, { structuralRrVeto: true, legacyScore: 99 });
  ok(rrV.blockers.includes('GS7/GC6'), 'structural R:R veto cannot be outvoted');
}

console.log('== per-timeframe source ==');
{
  let out = hgGoldSrcAssign({ src: {} }, '15m', 'xm-xauusd', 'rows15m', [{ t: 1 }]);
  out = hgGoldSrcAssign(out, '4h', 'binance-paxg', 'rows4h', [{ t: 2 }]);
  hgGoldSrcFinalize(out, '15m');
  ok(out.src['15m'] === 'xm-xauusd' && out.src['4h'] === 'binance-paxg', 'src[tf] at every assignment');
  ok(out.mixed === true, 'mixed:true when providers differ');
  ok(out.source === 'xm-xauusd', 'legacy source = 15m provider');

  ok(gs.includes("srcSet('1h', 'binance-paxg'") || gs.includes('srcSet(\'1h\', \'binance-paxg\''),
    'goldscalp PAXG 1h fallback sets src');
  ok(gs.includes("srcSet('4h', 'binance-paxg'") || gs.includes('srcSet(\'4h\', \'binance-paxg\''),
    'goldscalp PAXG 4h fallback sets src');
  ok(gsw.includes('binance-paxg'), 'goldswing PAXG fallbacks set src');
  ok(html.includes('mixed14') && html.includes('G1'), 'deep scan gates G1-G3 on mixed 1d/4h');
  ok(html.includes('mixed15h') || html.includes('gc4Mixed'), 'GC4/C4 mixed 15m/1h gate');
}

console.log('== mixed feed + A+ ==');
{
  const reason = hgMixedFeedReason({ '1d': 'xm-xauusd', '4h': 'binance-paxg' }, '1d', '4h');
  ok(reason && /mixed feed/.test(reason), 'mixed feed reason string');
  const cand = { dir: 'long', barAge: 0, htfAlign: true, rr: 2.2, anchor: 'OB', er: 0.4 };
  const ctx = {
    style: 'goldscalp', mixedFeed: true,
    metalsComplex: { verdict: 'COMPLEX CONFIRMS' },
    realRate: { measured: true, trend: 'FALLING' },
    cot: { crowding: 'NEUTRAL' },
    goldVenueSpread: { gated: false },
    edge: { tier: 'UNPROVEN' },
    volRegime: { regime: 'NORMAL' },
  };
  const ap = hgGoldAPlus(cand, ctx);
  ok(ap.darkLegs.includes('L2 HTF alignment') && !ap.aplus, 'mixed feed darkens L2 and blocks A+');
}

console.log('== volume trust ==');
{
  ok(hgVolumeTrust('binance-paxg', '4h').trusted === false, 'binance-paxg UNTRUSTED');
  ok(hgVolumeTrust('some-new-provider', '4h').trusted === false, 'unknown provider default-deny');
  ok(html.includes('volFlowOk') && html.includes('volFlowNaReason'), 'deep scan volume trust wiring');
  ok(html.includes("sg.push(['G22'") && !html.includes("G22','Elder Ray',hasVol4"), 'G22 Elder Ray has NO volume guard');
  ok(gind.includes('volumeTrusted === false'), 'goldMFI accepts volumeTrusted flag');
  ok(gind.includes('goldVolSqueeze(rows, opts)'), 'goldVolSqueeze accepts opts');
  const mfiBlock = gind.match(/function goldMFI[\s\S]*?return out;\s*\}/);
  ok(mfiBlock && mfiBlock[0].includes('volumeTrusted === false'), 'goldMFI returns NONE when volume untrusted');
}

console.log('== deep gate audit ==');
{
  const recs = [];
  for (let i = 0; i < 20; i++) {
    recs.push({
      status: 'settled', r: i % 3 ? 0.4 : -0.2,
      gateStates: { G27: 'pass', G8: i % 2 ? 'pass' : 'veto' },
    });
  }
  const famAudit = hgDeepFamilyAudit(recs);
  ok(famAudit.familyAudit.length >= 1, 'family-level audit rows');
  ok(famAudit.familyAudit[0].primary === true, 'family lift is primary');
  ok(famAudit.gateAudit.length === 37, 'per-gate audit is diagnostic');
  const g27 = famAudit.gateAudit.find((g) => g.gate === 'G27');
  ok(g27 && g27.effectiveN != null, 'effective n beside measured lift');
}

console.log('== sw cache + execute ==');
{
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(sw.includes("'hg-v266'"), 'sw.js cache hg-v266');
  ok(sw.includes('fixpack16-core.js'), 'fixpack16-core precached');
  const exec = fs.readFileSync(path.join(root, 'execute.js'), 'utf8');
  ok(!/hgFamilyRollup|hgVolumeTrust/.test(exec), 'execute.js stays disarmed');
}

console.log('== browser copy (fixpack16-core.js) matches the daemon copy ==');
{
  const core = fs.readFileSync(path.join(root, 'fixpack16-core.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(core, sandbox);
  const W = sandbox.window;
  ok(typeof W.hgVolumeTrust === 'function', 'browser copy exports hgVolumeTrust');

  // The browser file is what actually runs in the gold tabs; it must not drift
  // from lib/volume-trust.mjs (the daemon copy) or the two disagree on live trades.
  const feeds = ['yahoo', 'xm-xauusd', 'twelvedata', 'delta-xaut', 'binance-paxg',
    'paxg', 'xaut', 'fred', 'spot', 'gold-api', 'frankfurter', 'brand-new-feed', ''];
  for (const f of feeds) {
    ok(W.hgVolumeTrust(f, '4h').trusted === hgVolumeTrust(f, '4h').trusted,
      'volume trust parity browser/daemon for ' + (f || '(empty)'));
  }

  ok(W.hgVolumeTrust('delta-xaut', '4h').trusted === false,
    'delta-xaut is tokenised gold — UNTRUSTED in the browser copy');
  ok(hgVolumeTrust('delta-xaut', '4h').trusted === false,
    'delta-xaut is tokenised gold — UNTRUSTED in the daemon copy');
  ok(W.hgVolumeTrust('yahoo', '4h').trusted === true, 'yahoo GC=F volume still trusted');
  ok(W.hgVolumeTrust('gold-api', '4h').trusted === false, 'browser copy default-denies unknown feeds');

  // Undefined CSS custom properties fall back to currentColor, which rendered the
  // 12 family rows with white borders on the dark terminal.
  const cssVars = new Set((html.match(/--[a-z0-9]+(?=\s*:)/g) || []));
  for (const v of (core.match(/var\((--[a-z0-9]+)\)/g) || [])) {
    const name = v.slice(4, -1);
    ok(cssVars.has(name), 'fixpack16-core CSS var ' + name + ' is defined in index.html');
  }
}

console.log('== scalp + swing surface the mixed-feed warning ==');
{
  // Provenance was computed in both tabs and then thrown away: neither read .mixed,
  // so a 15m/4h split across two different markets rendered as clean alignment.
  for (const [name, src] of [['goldscalp', gs], ['goldswing', gsw]]) {
    ok(/gold\.mixed/.test(src), name + ' reads the mixed flag it computes');
    ok(src.includes('MIXED FEED'), name + ' surfaces a MIXED FEED warning');
    ok(/hgGoldSrcMixedLabel/.test(src), name + ' names the per-timeframe providers');
    ok(/hgGoldSrcAssign/.test(src), name + ' routes provenance through hgGoldSrcAssign');
  }
}

console.log('\nPASS fix-pack-16 — ' + pass + ' assertions');
