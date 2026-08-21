/* HARDGATE — OMNIPRESENT: one side per contract.

   Field report: BZ printed LONG from the bottom (WITH TAPE, ARMED, VETO)
   AND SHORT from the high (AGAINST TAPE, TRIGGERED, VETO) on the same
   CoinDCX card stack. The desk already prints TAKE LONGS / TAKE SHORTS;
   showing both directions on one name is the opposite of a call.

   Contract:
     - one card per base+venue
     - when the tape has a side, that direction wins even if the other
       is TRIGGERED or nearer
     - the shown head does not mix LONG and SHORT for the same name
     - when the tape has a side and there is no with-tape zone, the head
       is empty — we do not substitute the against-tape card

   Run: node tests/test-omnipresent-one-side.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js','omnipresent.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function bzPair(){
  return [
    { base: 'BZ', sym: 'B-BZ_USDT', exchange: 'coindcx', dir: 'long', status: 'ARMED',
      grade: { ticket: false, vetoes: ['exhaustion'] }, score: 50,
      zone: { distAtr: 1.4, confluence: 5 } },
    { base: 'BZ', sym: 'B-BZ_USDT', exchange: 'coindcx', dir: 'short', status: 'TRIGGERED',
      grade: { ticket: false, vetoes: ['exhaustion', 'htf-daily'] }, score: 70,
      zone: { distAtr: 0.7, confluence: 4 } }
  ];
}

const SRC = read('omnipresent.js');
const W = boot();

console.log('== exports ==');
{
  ok(typeof W.opOnePerContract === 'function', 'opOnePerContract exported');
  ok(typeof W.opRankHead === 'function', 'opRankHead exported');
}

console.log('== the BZ report: TAKE LONGS keeps the long, drops the short ==');
{
  const one = W.opOnePerContract(bzPair(), 'long');
  ok(one.length === 1, 'one card, not two (got ' + one.length + ')');
  ok(one[0].dir === 'long', 'WITH TAPE long wins over a nearer TRIGGERED short');
  ok(one[0].status === 'ARMED', 'the surviving card is the armed long from the bottom');

  const head = W.opRankHead(bzPair(), { side: 'long', headline: 'TAKE LONGS' });
  ok(head.top.length === 1, 'shown head is one card');
  ok(head.top[0].dir === 'long', 'shown head is the long');
  ok(!head.top.some(c => c.dir === 'short'), 'AGAINST TAPE short is not on the desk');
}

console.log('== TAKE SHORTS keeps the short ==');
{
  const one = W.opOnePerContract(bzPair(), 'short');
  ok(one.length === 1 && one[0].dir === 'short', 'tape short keeps the short from the high');
}

console.log('== STAND ASIDE still one name, one card ==');
{
  const one = W.opOnePerContract(bzPair(), null);
  ok(one.length === 1, 'aside still collapses the pair');
  ok(one[0].dir === 'short', 'with no tape, TRIGGERED + nearer wins');
}

console.log('== two contracts stay two cards ==');
{
  const mix = bzPair().concat([{
    base: 'ETH', sym: 'ETHUSD', exchange: 'delta', dir: 'long', status: 'ARMED',
    grade: { ticket: false, vetoes: [] }, score: 40, zone: { distAtr: 1.0, confluence: 3 }
  }]);
  const one = W.opOnePerContract(mix, 'long');
  const names = one.map(c => c.base).sort();
  ok(names.join(',') === 'BZ,ETH', 'different names are not collapsed (got ' + names.join(',') + ')');
}

console.log('== no with-tape zone: do not substitute the other side ==');
{
  const shortsOnly = [bzPair()[1]];
  const head = W.opRankHead(shortsOnly, { side: 'long' });
  ok(head.top.length === 0, 'TAKE LONGS with only a short zone shows empty, not the short');
}

console.log('== scan uses the picker, not the raw two-sided found list ==');
{
  ok(/opRankHead\(/.test(SRC), 'runScan ranks through opRankHead');
  ok(/opOnePerContract\(/.test(SRC), 'one-per-contract is the collapse');
  ok(/oneSide/.test(SRC) || /one direction per contract/.test(SRC),
     'OMNIPRESENT copy says the other side is not shown');
}

console.log('== cache stamp ==');
{
  ok(swCacheOk(read('sw.js')), 'cache matches build stamp');
}

console.log('\n' + passed + ' passed');
