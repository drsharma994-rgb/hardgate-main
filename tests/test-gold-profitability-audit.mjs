/* HARDGATE — hg-v1298 PROFITABILITY AUDIT guard.
   Covers:
     1. hgOgReplayZ seam fix (reads gate-clear row[5]/row[6], falls back to
        row[0]/row[1] on legacy rows, measures 6 ticket->VETO flips vs 0
        the other way on the committed JSON)
     2. hgGoldAuditPanelHtml returns body for the five audit desks and ''
        for every other caller; lead names hg-v935 / hg-v937 / MILLI GOLD
     3. hgGoldFwdNote appends the audit panel for the four desks the user
        named and for them only
     4. OMNIGOLD panel chain calls hgGoldAuditPanelHtml('omnigold')
     5. GANESH GOLD paint calls hgGoldAuditPanelHtml('ganeshgold')
     6. Walker shape -- exits cleanly on fetch failure, writes
        measured:false with the hg-v990 "note derived from the artifact"
     7. HG_GANESH_WALK literal round-trips zero drift
     8. The literal writer is FATAL on missing markers (hg-v959 trap)
*/

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const results = [];
function ok(label, pass, detail){
  results.push({ label, pass, detail });
  if (!pass) console.error('FAIL:', label, detail || '');
}

/* ================================================================
   SECTION 1 - hgOgReplayZ seam fix (omnigold.js)
================================================================= */
(() => {
  const src = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');
  /* hg-v1298 adds hgOgReplayZOnFormed as a SEPARATE function so pre-existing
     callers of hgOgReplayZ (hgOgEdgeProofPanelHtml and the hg-v756 effN
     arithmetic pin around it) are unchanged. The audit panel reads
     hgOgReplayZOnFormed; hgOgReplayZ stays whole-walk. */
  ok('S1.0 hgOgReplayZ exists (whole-walk reader, unchanged)',
    src.includes('function hgOgReplayZ(row, be)'));
  const fmStart = src.indexOf('function hgOgReplayZOnFormed(row, be)');
  ok('S1.1 hgOgReplayZOnFormed exists', fmStart > 0);
  const fmBody = src.slice(fmStart, fmStart + 1000);
  ok('S1.2 OnFormed reads row[5] for n (gate-clear)',
    /row\s*&&\s*row\[5\]/.test(fmBody));
  ok('S1.3 OnFormed reads row[6] for hit (gate-clear)',
    /row\s*&&\s*row\[6\]/.test(fmBody));
  ok('S1.4 OnFormed falls back to row[0] on legacy rows',
    /row\s*&&\s*row\[0\]/.test(fmBody));
  ok('S1.5 OnFormed falls back to row[1] on legacy rows',
    /row\s*&&\s*row\[1\]/.test(fmBody));
  /* Scan backward 2500 chars to pick up the attribution block above the
     OnFormed function. */
  const fmBodyWithLead = src.slice(Math.max(0, fmStart - 2500), fmStart + 1000);
  ok('S1.6 hg-v1298 attribution comment present on OnFormed',
    /hg-v1298/.test(fmBodyWithLead));
  ok('S1.7 OnFormed exported as window.hgOgReplayZOnFormed',
    src.includes('window.hgOgReplayZOnFormed = hgOgReplayZOnFormed'));

  /* The whole-walk reader stays byte-identical to its hg-v756 shape:
     reads row[0] and row[1], no row[5]/row[6]. */
  const zStart = src.indexOf('function hgOgReplayZ(row, be)');
  const zBody = src.slice(zStart, zStart + 500);
  ok('S1.8 hgOgReplayZ still reads whole-walk row[0]/row[1]',
    /row\s*&&\s*row\[0\]/.test(zBody) && /row\s*&&\s*row\[1\]/.test(zBody));
  ok('S1.9 hgOgReplayZ does NOT read row[5]/row[6]',
    !/row\s*&&\s*row\[5\]/.test(zBody) && !/row\s*&&\s*row\[6\]/.test(zBody));
})();

/* The behavioural check on committed JSON: 6 ticket->VETO flips, 0 the
   other way, exactly the mechanics named in the pack. */
(() => {
  const artifact = JSON.parse(readFileSync(resolve(ROOT, 'scripts/omnigold-replay-evidence.json'), 'utf8'));
  const RATIO = 0.406;
  const effN = n => Math.max(1, n * RATIO);
  const BE = 1 / 3;
  const whole = artifact.perKind || {};
  const formed = artifact.sequentialBake?.formedByKind || {};
  function zFixed(n, hit){
    return (hit - BE) / Math.sqrt(BE * (1 - BE) / effN(n));
  }
  const measured = Object.keys(whole).filter(k => whole[k].n >= 20);
  const flipsIn = [], flipsOut = [];
  for (const k of measured){
    const w = whole[k], f = formed[k];
    if (!f || !isFinite(f.n) || f.n < 20) continue;
    const zW = zFixed(w.n, w.winRate);
    const zF = zFixed(f.n, f.winRate);
    const wV = zW <= -2, fV = zF <= -2;
    if (fV && !wV) flipsIn.push(k);
    if (wV && !fV) flipsOut.push(k);
  }
  ok('S1.11 exactly 6 ticket->VETO flips on committed JSON',
    flipsIn.length === 6, `got ${flipsIn.length}: ${flipsIn.join(',')}`);
  ok('S1.12 zero VETO->ticket flips',
    flipsOut.length === 0, `got ${flipsOut.length}: ${flipsOut.join(',')}`);
  for (const m of ['THREE-BAR','P9-VOLBAR','PD-EQUILIBRIUM','ADR-FADE','PIN-REJECT','SPRING']){
    ok(`S1.10 ${m} would flip ticket->VETO under hgOgReplayZOnFormed`, flipsIn.includes(m));
  }
})();

/* ================================================================
   SECTION 2 - hgGoldAuditPanelHtml exported shape (goldind.js)
================================================================= */
(() => {
  const src = readFileSync(resolve(ROOT, 'goldind.js'), 'utf8');
  for (const sym of ['hgGoldAuditPanelHtml','hgGoldAuditLead','hgGoldAuditScalpHtml','hgGoldAuditSwingHtml','hgGoldAuditOmniHtml','hgGoldAuditPineHtml','hgGoldAuditGaneshHtml']){
    ok(`S2.0 ${sym} exported`, src.includes(`W.${sym} = ${sym}`));
    ok(`S2.1 ${sym} defined`, src.includes(`function ${sym}(`));
  }
  const leadIdx = src.indexOf('function hgGoldAuditLead(');
  const leadBody = src.slice(leadIdx, leadIdx + 2000);
  ok('S2.2 lead names hg-v935', /hg-v935/.test(leadBody));
  ok('S2.3 lead names hg-v937', /hg-v937/.test(leadBody));
  ok('S2.4 lead names MILLI GOLD', /MILLI GOLD/.test(leadBody));
  ok('S2.5 lead says gates nothing', /gates nothing/i.test(leadBody));
  const panel = src.indexOf('function hgGoldAuditPanelHtml(deskId)');
  const panelBody = src.slice(panel, panel + 2000);
  for (const d of ['goldscalp','goldswing','goldpine','omnigold','ganeshgold']){
    ok(`S2.6 panel routes to '${d}'`, panelBody.includes(`'${d}'`));
  }
})();

/* ================================================================
   SECTION 3 - hgGoldFwdNote appends audit for the four desks
================================================================= */
(() => {
  const src = readFileSync(resolve(ROOT, 'gold-forward-read.js'), 'utf8');
  ok('S3.0 hgGoldFwdNote calls hgGoldAuditPanelHtml',
    /hgGoldAuditPanelHtml\s*\(\s*tabId\s*\)/.test(src));
  ok('S3.1 call sits in a try/catch (fails open)',
    /try\s*\{\s*\n[^}]*hgGoldAuditPanelHtml\(tabId\)[\s\S]{0,200}\}\s*catch/.test(src));
  const noteBody = src.slice(src.indexOf('function hgGoldFwdNote'), src.length);
  const retIdx = noteBody.indexOf('return ');
  ok('S3.2 auditHtml appended last in return',
    noteBody.slice(retIdx).includes('+ auditHtml'));
})();

/* ================================================================
   SECTION 4 - OMNIGOLD panel chain call
================================================================= */
(() => {
  const src = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');
  ok('S4.0 omnigold panel chain calls hgGoldAuditPanelHtml("omnigold")',
    /hgGoldAuditPanelHtml\s*\(\s*['"]omnigold['"]\s*\)/.test(src));
  ok('S4.1 the call sits in the panel chain near hg-v935 refusal',
    src.indexOf('hgOgSelectionRefusedHtml()') < src.indexOf("hgGoldAuditPanelHtml('omnigold')"));
})();

/* ================================================================
   SECTION 5 - GANESH GOLD paint call
================================================================= */
(() => {
  const src = readFileSync(resolve(ROOT, 'ganeshgold.js'), 'utf8');
  ok('S5.0 ganeshgold paint calls hgGoldAuditPanelHtml("ganeshgold")',
    /hgGoldAuditPanelHtml\s*\(\s*['"]ganeshgold['"]\s*\)/.test(src));
  ok('S5.1 the call sits in a try/catch (fails open)',
    /try\s*\{[^}]*hgGoldAuditPanelHtml\(['"]ganeshgold['"]\)[\s\S]{0,200}\}\s*catch/.test(src));
})();

/* ================================================================
   SECTION 6 - Walker shape (scripts/backtest-ganeshgold.mjs)
   Behaviour: on fetch failure (which is what happens here with
   HG_KLINES_BASE pointing at a dead host), writes measured:false
   artifact and exits 0.
================================================================= */
(() => {
  const tmp = resolve(ROOT, 'scripts/.test-ganesh-walk.json');
  try{ rmSync(tmp); }catch(e){}
  const r = spawnSync(process.execPath, [resolve(ROOT, 'scripts/backtest-ganeshgold.mjs'), `--out=${tmp}`, '--smoke'], {
    env: { ...process.env, HG_KLINES_BASE: 'https://this-host-does-not-exist-12345.invalid' },
    timeout: 30000
  });
  ok('S6.0 walker exits 0 on fetch failure', r.status === 0, `exit ${r.status}`);
  ok('S6.1 artifact written', existsSync(tmp));
  if (existsSync(tmp)){
    const art = JSON.parse(readFileSync(tmp, 'utf8'));
    ok('S6.2 artifact marked measured:false', art.measured === false);
    ok('S6.3 artifact names the walker', art.meta && art.meta.walker && art.meta.walker.includes('backtest-ganeshgold'));
    ok('S6.4 artifact names the symbol', art.meta && art.meta.symbol === 'PAXGUSDT');
    ok('S6.5 artifact says why it did not measure', art.meta && /fetch|failed/i.test(art.meta.note || ''));
    ok('S6.6 artifact lists limitations', Array.isArray(art.limitations) && art.limitations.length > 0);
  }
  try{ rmSync(tmp); }catch(e){}
})();

/* ================================================================
   SECTION 7 - Literal writer and marker contract
================================================================= */
(() => {
  const genPath = resolve(ROOT, 'scripts/ganeshgold-evidence-literal.mjs');
  const r = spawnSync(process.execPath, [genPath], { timeout: 10000 });
  ok('S7.0 literal writer drift check passes on committed tree', r.status === 0, r.stderr.toString().slice(0,400));
  const ganesh = readFileSync(resolve(ROOT, 'ganeshgold.js'), 'utf8');
  const beginIdx = ganesh.indexOf('/* --- BEGIN GENERATED HG_GANESH_WALK');
  const endIdx = ganesh.indexOf('/* --- END GENERATED HG_GANESH_WALK');
  ok('S7.1 BEGIN marker present', beginIdx > 0);
  ok('S7.2 END marker present', endIdx > beginIdx);
  ok('S7.3 literal contains measured:false (null-pointing until bake)',
    ganesh.slice(beginIdx, endIdx).includes('measured: false'));
  ok('S7.4 literal names scripts/backtest-ganeshgold.mjs',
    ganesh.slice(beginIdx, endIdx).includes('scripts/backtest-ganeshgold.mjs'));

  /* FATAL on missing markers (hg-v959 trap): point the writer at a file
     without markers and verify it exits 1. */
  const BAD_PATH = resolve(ROOT, 'scripts/.test-ganesh-no-markers.js');
  writeFileSync(BAD_PATH, '/* nothing to see */\n');
  const writerSrc = readFileSync(genPath, 'utf8');
  const forkPath = resolve(ROOT, 'scripts/.test-ganesh-literal-fork.mjs');
  writeFileSync(forkPath, writerSrc.replace("resolve(__dirname, '..', 'ganeshgold.js')", JSON.stringify(BAD_PATH)));
  const r2 = spawnSync(process.execPath, [forkPath], { timeout: 10000 });
  ok('S7.5 literal writer FATAL on missing markers', r2.status === 1);
  ok('S7.6 FATAL error names the marker contract', /marker|FATAL/i.test((r2.stderr || Buffer.from('')).toString()));
  try{ rmSync(BAD_PATH); rmSync(forkPath); }catch(e){}
})();

/* ================================================================
   SECTION 8 - Audit panel BEHAVIOUR under driven inputs
   Boots goldind.js in a sandbox with a window stub, then calls the
   exports with constructed state and verifies output shape and silence.
================================================================= */
(() => {
  const sandbox = { console, Math, Array, Object, Number, Date, JSON };
  sandbox.window = sandbox.self = sandbox.globalThis = sandbox;

  /* Minimum fixtures goldind.js needs to boot: indicators.js helpers.
     Rather than booting indicators.js too (hundreds of exports), we
     ship stubs for the handful goldind.js reads at load time. */
  sandbox.ema = (xs, n) => xs.map(() => NaN);
  sandbox.rsi = () => NaN;
  sandbox.atr = () => NaN;
  sandbox.hgMedian = xs => xs[0];

  vm.createContext(sandbox);
  const code = readFileSync(resolve(ROOT, 'goldind.js'), 'utf8');
  try{
    vm.runInContext(code, sandbox, { timeout: 10000 });
  }catch(e){
    /* goldind.js reads a lot at load time; if it fails to boot in a
       bare sandbox we report that and skip the behavioural half. The
       SOURCE assertions above still catch the shape. */
    ok('S8.0 goldind.js boots in sandbox (optional)', false, String(e).slice(0, 200));
    return;
  }

  ok('S8.0 goldind.js boots in sandbox', typeof sandbox.hgGoldAuditPanelHtml === 'function');
  if (typeof sandbox.hgGoldAuditPanelHtml !== 'function') return;

  /* Returns '' for unknown desks. */
  ok('S8.1 returns "" for optigold', sandbox.hgGoldAuditPanelHtml('optigold') === '');
  ok('S8.2 returns "" for goldpro', sandbox.hgGoldAuditPanelHtml('goldpro') === '');
  ok('S8.3 returns "" for newgold', sandbox.hgGoldAuditPanelHtml('newgold') === '');
  ok('S8.4 returns "" for null/undefined deskId', sandbox.hgGoldAuditPanelHtml(null) === '' && sandbox.hgGoldAuditPanelHtml(undefined) === '');

  /* With HG_GOLD_SETUP_EDGE present (goldind.js defines it), goldscalp returns body. */
  const scalpHtml = sandbox.hgGoldAuditPanelHtml('goldscalp');
  ok('S8.5 goldscalp panel renders body', scalpHtml && scalpHtml.includes('GOLD SCALP'));
  ok('S8.6 goldscalp panel names PREFER / SUPPRESS / DEMOTE / NEUTRAL',
    scalpHtml && /PREFER/.test(scalpHtml) && /SUPPRESS/.test(scalpHtml) && /DEMOTE/.test(scalpHtml) && /NEUTRAL/.test(scalpHtml));
  ok('S8.7 goldscalp panel carries PROFITABILITY AUDIT lead',
    scalpHtml && scalpHtml.includes('PROFITABILITY AUDIT'));

  const swingHtml = sandbox.hgGoldAuditPanelHtml('goldswing');
  ok('S8.8 goldswing panel renders body', swingHtml && swingHtml.includes('GOLD SWING'));

  /* GOLD PINE needs PINE_GOLD_LAYERS from pinegoldmath.js. In this sandbox
     that global isn't present, so the panel returns '' (fails open). */
  const pineHtmlNoDeps = sandbox.hgGoldAuditPanelHtml('goldpine');
  ok('S8.9 goldpine returns "" when PINE_GOLD_LAYERS is absent (fails open)', pineHtmlNoDeps === '');

  /* Supply the pine globals and re-check. */
  sandbox.PINE_GOLD_LAYERS = new Array(10);
  sandbox.PINE_GOLD_RECORD_LAYERS = new Array(27);
  const pineHtml = sandbox.hgGoldAuditPanelHtml('goldpine');
  ok('S8.10 goldpine panel renders body when PINE_GOLD_LAYERS present',
    pineHtml && pineHtml.includes('GOLD PINE'));
  ok('S8.11 goldpine panel counts 10 scored + 27 record-only',
    pineHtml && pineHtml.includes('10') && pineHtml.includes('27'));

  /* GANESH GOLD: no walk literal, panel reads NO MEASURED RECORD. */
  const ganeshHtml = sandbox.hgGoldAuditPanelHtml('ganeshgold');
  ok('S8.12 ganeshgold panel renders NO MEASURED RECORD by default',
    ganeshHtml && /NO MEASURED RECORD/.test(ganeshHtml));
  ok('S8.13 ganeshgold panel names scripts/backtest-ganeshgold.mjs',
    ganeshHtml && ganeshHtml.includes('scripts/backtest-ganeshgold.mjs'));

  /* With a measured HG_GANESH_WALK, panel switches wording. */
  sandbox.HG_GANESH_WALK = { measured: true, n: 500, span: '2026-01-01..2026-06-01', note: 'baked on PAXGUSDT' };
  const ganeshMeasured = sandbox.hgGoldAuditPanelHtml('ganeshgold');
  ok('S8.14 ganeshgold panel reads measured HG_GANESH_WALK',
    ganeshMeasured && ganeshMeasured.includes('500') && ganeshMeasured.includes('trades walked'));

  /* OMNIGOLD: panel returns '' when HG_OG_REPLAY_EVIDENCE is absent. */
  const ogNone = sandbox.hgGoldAuditPanelHtml('omnigold');
  ok('S8.15 omnigold returns "" when HG_OG_REPLAY_EVIDENCE is absent (fails open)', ogNone === '');

  /* Supply a tiny OMNIGOLD evidence shape and the panel renders. */
  sandbox.HG_OG_REPLAY_EVIDENCE = {
    kinds: {
      'MOCK-GOOD':  [500, 0.4, 0, 0, 0, 400, 0.42, 0.1, 0.05],  // high hit, no veto
      'MOCK-FAIL':  [500, 0.3, 0, 0, 0, 400, 0.10, -0.5, -0.3]  // low hit, veto
    }
  };
  sandbox.hgOgReplayZOnFormed = (row, be) => {
    const n = row[5] > 0 ? row[5] : row[0];
    const hit = row[5] > 0 ? row[6] : row[1];
    const effN = Math.max(1, n * 0.406);
    return (hit - be) / Math.sqrt(be * (1 - be) / effN);
  };
  sandbox.hgOgReplayFamilySize = () => 2;
  sandbox.hgOgFamilyZ = () => 3.21;
  sandbox.HG_OG_MIN_SAMPLES = 20;
  sandbox.HG_OG_EDGE_VETO_Z = -2;
  const ogHtml = sandbox.hgGoldAuditPanelHtml('omnigold');
  ok('S8.16 omnigold panel renders with evidence',
    ogHtml && ogHtml.includes('OMNIGOLD') && ogHtml.includes('mechanics measured'));
  ok('S8.17 omnigold panel counts VETO mechanics',
    ogHtml && /fail outright/.test(ogHtml));
})();

/* ================================================================
   SUMMARY
================================================================= */
const pass = results.filter(r => r.pass).length;
const fail = results.filter(r => !r.pass).length;
console.log(`\n${pass}/${results.length} passed, ${fail} failed`);
if (fail) process.exit(1);
