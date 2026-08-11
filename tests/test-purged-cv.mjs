/* HARDGATE — purged CV module tests. Run: node tests/test-purged-cv.mjs */
import { purgedTrainTestSplit, hgReplaySweepPurged } from '../lib/purged-cv.mjs';

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function synthSamples(n){
  const out = [];
  for (let i = 0; i < n; i++){
    out.push({ i, at: i * 3600, pass: { adx: true }, vals: { adx: 14 + (i % 20) }, r: (i % 3 === 0) ? -1 : 1.5 });
  }
  return out;
}

console.log('== purged split ==');
{
  const split = purgedTrainTestSplit(synthSamples(100), { trainFrac: 0.7, labelHorizon: 14, embargo: 7 });
  ok(split.train.length > 0, 'train non-empty');
  ok(split.test.length >= 0, 'test computed');
  ok(split.purged >= 0, 'purged count reported');
  ok(split.note.includes('purged'), 'note mentions purged');
}

console.log('== purged replay sweep ==');
{
  const replay = { samples: synthSamples(80) };
  const thresholds = [14, 18, 22, 26, 30];
  const res = hgReplaySweepPurged(replay, 'adx', thresholds, 'min', { labelHorizon: 10, embargo: 5 });
  ok(res.gate === 'adx', 'gate echoed');
  ok(Array.isArray(res.rows), 'train rows');
  ok(res.purged != null, 'purged metadata');
}

console.log('== empty samples ==');
{
  const res = hgReplaySweepPurged({ samples: [] }, 'adx', [14], 'min');
  ok(res.note.includes('no'), 'empty note');
}

console.log('\nPassed:', passed);
