/* HARDGATE — the gold tabs' spot alignment must run AFTER every engine
   that rewrites levels, or it is decoration.

   The defect, verbatim from the 2026-08 audit: goldAlignLevelsToSpot ran
   early in the scan, then goldApplyBestLevelsBatch (and the hgFormTicket
   fallback behind it) re-derived entry/stop/targets from the raw FEED
   rows and wrote them back over the spot-scaled levels for every
   non-locked candidate. The scale was silently undone; the card showed
   levels priced off a feed the reader does not trade, against a broker
   market that sits half a percent away — "the gold levels are not
   matching the live levels", from a tab that had already computed the
   correct ones and thrown them away.

   The contract now, in BOTH gold tabs:

     derive levels (feed basis, all engines)  ->  align to spot ONCE, LAST
     ->  conviction lock restores its stored spot-basis levels verbatim
         (so locked cards are never double-scaled)

   Run: node tests/test-spot-align-order.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

for (const f of ['goldscalp.js', 'goldswing.js']){
  const S = read(f);
  console.log('== ' + f + ' ==');

  /* the call passed (klineSpot, liveSpot); the definition's params are
     (klineRef, liveRef) — match the call, not the function line */
  ok(!/goldAlignLevelsToSpot\(cands, klineSpot, liveSpot\)/.test(S),
     'the early alignment call is gone — it was overwritten by every level engine that ran after it');

  const aligns = S.match(/goldAlignLevelsToSpot\(ranked/g) || [];
  ok(aligns.length === 1, 'exactly one alignment call remains (found ' + aligns.length + ')');

  const iAlign = S.indexOf('goldAlignLevelsToSpot(ranked');
  const iBatch = S.indexOf('goldApplyBestLevelsBatch(ranked');
  const iForm = S.indexOf("var formFn = gfn('hgFormTicket')");
  const iLock = S.indexOf('var lock = applyConviction(ranked');  /* the call, not the definition */
  ok(iBatch >= 0 && iAlign > iBatch, 'alignment runs AFTER the best-levels batch that rewrites levels');
  ok(iForm >= 0 && iAlign > iForm, 'and after the hgFormTicket fallback path');
  ok(iLock >= 0 && iAlign < iLock, 'and BEFORE the conviction lock, which restores stored spot-basis levels verbatim');

  ok(/Math\.abs\(klineSpot \/ liveSpot - 1\) \* 100 > 0\.5\)\{\s*\n\s*goldAlignLevelsToSpot\(ranked/.test(S),
     'the late call keeps the same 0.5% drift threshold the early one had');

  /* The pure function itself must still scale the full level set. */
  const fnBody = S.slice(S.indexOf('function goldAlignLevelsToSpot'), S.indexOf('function goldAlignLevelsToSpot') + 1200);
  for (const key of ["'entry'", "'stop'", "'t1'", "'t2'", "'t3'", "'anchor'"]){
    ok(fnBody.indexOf(key) >= 0, 'the scaler still covers ' + key);
  }
  ok(/c\.zone\.lo \*= ratio/.test(fnBody) && /c\.zone\.hi \*= ratio/.test(fnBody), 'and the entry zone');
  ok(/c\.spotAligned = true/.test(fnBody), 'and stamps the candidate as aligned');
}

console.log('\npassed: ' + passed);
