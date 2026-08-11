/* HARDGATE — meta-label module tests. Run: node tests/test-meta-label.mjs */
import { hgMetaLabel, HG_META_FLOOR } from '../lib/meta-label.mjs';

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

console.log('== meta-label exports ==');
{
  ok(typeof hgMetaLabel === 'function', 'hgMetaLabel');
  ok(HG_META_FLOOR === 0.52, 'HG_META_FLOOR');
}

console.log('== skip when no plan ==');
{
  const r = hgMetaLabel(null, {}, []);
  ok(r.verdict === 'SKIP' && r.take === false, 'null plan -> SKIP');
}

console.log('== feature-only scoring ==');
{
  const plan = { sym: 'BTCUSDT', dir: 'long', tier: 'PRIME', poi: 'sweep', formationScore: 75, fillProb: 55, rr: 2.5, htfAlign: true };
  const r = hgMetaLabel(plan, {}, []);
  ok(r.take === true, 'strong features -> take');
  ok(r.prob >= HG_META_FLOOR, 'prob above floor');
}

console.log('== ledger bucket boosts thin history ==');
{
  const ledger = [
    { sym: 'BTCUSDT', dir: 'long', tier: 'prime', poi: 'sweep', status: 'settled', r: 2 },
    { sym: 'BTCUSDT', dir: 'long', tier: 'prime', poi: 'sweep', status: 'settled', r: 1.5 },
    { sym: 'BTCUSDT', dir: 'long', tier: 'prime', poi: 'sweep', status: 'settled', r: -1 },
    { sym: 'BTCUSDT', dir: 'long', tier: 'prime', poi: 'sweep', status: 'settled', r: 2 },
    { sym: 'BTCUSDT', dir: 'long', tier: 'prime', poi: 'sweep', status: 'settled', r: 1 },
  ];
  const plan = { sym: 'BTCUSDT', dir: 'long', tier: 'PRIME', poi: 'sweep', formationScore: 60, fillProb: 40, rr: 2 };
  const r = hgMetaLabel(plan, {}, ledger);
  ok(r.bucket && r.bucket.n === 5, 'ledger bucket matched n=5');
  ok(r.reason.includes('ledger'), 'reason cites ledger');
}

console.log('== weak plan skipped ==');
{
  const plan = { sym: 'XYZUSDT', dir: 'short', tier: 'na', poi: 'none', formationScore: 30, fillProb: 10, rr: 1.2, htfAlign: false, eventBlackout: true };
  const r = hgMetaLabel(plan, { newsRisk: 'high' }, []);
  ok(r.take === false, 'weak features -> skip');
}

console.log('\nPassed:', passed);
