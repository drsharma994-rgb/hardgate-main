/* HARDGATE -- hg-v982: OMNIROUTE's out-of-sample judge counted every resting
   order as if it had opened; the fill-aware rule OMNIGOLD carried inline is
   now ONE rule in hg-forward.js and both desks read it.

   OMNIROUTE's measured-edge gate vetoes a mechanic when the tickets this
   ledger cleared read <= -2 sigma against breakeven out of sample. Every
   order this desk records rests at the setup level (hg-v424); its committed
   replay never fills on the signal bar and leaves 34.3% of what it opens
   unfilled -- and the judge read the actual tally, which settles a resting
   order the tape never reached as a target hit or a stop. Since hg-v981 the
   desk's records carry a mark, so the fill-aware tally exists; nothing read
   it here. OMNIGOLD's judge preferred it, in an inline block. The rule now
   lives once (hgFwdJudgeSample) and is driven on both desks' real gates.

   Run: node tests/test-omniroute-fill-aware-judge.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let passed = 0;
function assert(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function strip(src){
  return String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError, Set, Map,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}
const CHAIN = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
               'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js'];
function tape(n, seed, start){
  const out = []; let p = start || 60000, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    out.push({ t: 1700000000 + i * 14400, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1200 });
  }
  return out;
}
const edgeRow = gates => (gates || []).filter(g => g && g.key === 'measured-edge')[0] || null;

console.log('== 1) the rule, driven directly ==');
{
  const W = boot(['hg-forward.js']);
  const J = W.hgFwdJudgeSample;
  assert(typeof J === 'function', 'hgFwdJudgeSample is exported by hg-forward.js');
  for (const junk of [null, undefined, 5, 'x', {}, { samples: 'x' }, { samples: 30 }]){
    const r = J(junk, 20);
    assert(isNaN(r.n) && isNaN(r.hit) && r.fillAware === false, 'no readable tally -> no sample, never a fabricated one (' + JSON.stringify(junk) + ')');
  }
  const actual = J({ samples: 30, hit: 0.5 }, 20);
  assert(actual.n === 30 && actual.hit === 0.5 && actual.fillAware === false && actual.unfilled === 0, 'a tally with no fill resolution is read as the actual tally');
  /* the floor applies to the actual tally too -- neither desk reaches this
     branch (both choose the population on the floor first), and the mutation
     pass found it unguarded */
  const thinActual = J({ samples: 10, hit: 0.5 }, 20);
  assert(isNaN(thinActual.n) && isNaN(thinActual.hit) && thinActual.fillAware === false, 'an actual tally under the floor with no fill-aware tally is no sample at all');
  const thin = J({ samples: 30, hit: 0.5, fillSamples: 19, fillHit: 0.1, fillUnfilled: 9 }, 20);
  assert(thin.n === 30 && thin.hit === 0.5 && thin.fillAware === false, 'a fill-aware tally UNDER the floor is not preferred: the legacy log decides as before');
  const fill = J({ samples: 30, hit: 0.5, fillSamples: 20, fillHit: 0.1, fillUnfilled: 7, fillUnprovable: 3 }, 20);
  assert(fill.n === 20 && fill.hit === 0.1 && fill.fillAware === true && fill.unfilled === 7 && fill.unprovable === 3, 'AT the floor it is preferred, with the never-filled and unprovable counts beside it');
  const under = J({ samples: 10, hit: 0.5, fillSamples: 25, fillHit: 0.4 }, 20);
  assert(under.n === 25 && under.hit === 0.4 && under.fillAware === true, 'the fill-aware count stands on its own even when the actual tally is under the floor');
  const noFloor = J({ samples: 3, hit: 1, fillSamples: 2, fillHit: 0 }, undefined);
  assert(noFloor.n === 2 && noFloor.fillAware === true, 'no floor means no floor (a junk floor reads as zero, never as infinity)');
  const nanHit = J({ samples: 30, hit: 0.5, fillSamples: 25, fillHit: null }, 20);
  assert(nanHit.fillAware === false && nanHit.n === 30, 'a fill count with no readable hit rate is not a sample (the +null trap)');
}

console.log('== 2) OMNIROUTE: the measured-edge gate judges the cleared tickets on the fill-aware tally ==');
{
  const W = boot(CHAIN);
  const rows = tape(180, 11, 60000);
  const LIVE = rows[rows.length - 1].c;
  const hit = { kind: 'VALUE', dir: 'long', level: LIVE - 420, why: 'VAL reject' };
  const inSample = { samples: 60, hit: 0.5, expR: 0.3 };
  const gate = fwd => edgeRow(W.hgOmniGates(rows, hit, null, { stats: inSample, fwd: fwd, minRr: 2 }));
  /* the actual tally on the cleared tickets: 30 settled, half won -- a PASS */
  const legacy = gate({ samples: 40, hit: 0.5, ticketOnly: { samples: 30, hit: 0.5 } });
  assert(!!legacy && legacy.pass === true && /30 settled TICKETS/.test(legacy.why), 'REACHABILITY: 30 cleared tickets at 50% pass the gate, judged on the actual tally: ' + legacy.why);
  /* THE DEFECT: the same 30 tickets, of which only 22 ever opened and those 22
     lost -- the actual tally still passes, because the 8 that never filled
     were settled as wins the tape never gave anybody */
  const opened = { samples: 30, hit: 0.5, fillSamples: 22, fillHit: 0.09, fillUnfilled: 8 };
  const judged = gate({ samples: 40, hit: 0.5, ticketOnly: opened });
  assert(!!judged && judged.pass === false, 'with the fill-aware tally the gate VETOES: the tickets that actually opened have not paid');
  assert(/22 FILLED TICKETS/.test(judged.why) && /9% T1-first/.test(judged.why) && /8 never filled, excluded/.test(judged.why), 'and says so, naming the filled count, its hit rate and the never-filled excluded: ' + judged.why);
  /* below the floor the legacy behaviour holds exactly */
  const thin = gate({ samples: 40, hit: 0.5, ticketOnly: { samples: 30, hit: 0.5, fillSamples: 19, fillHit: 0.09, fillUnfilled: 11 } });
  assert(!!thin && thin.pass === true && /30 settled TICKETS/.test(thin.why) && !/FILLED/.test(thin.why), 'a fill-aware tally under FWD_MIN_JUDGE is not preferred: the actual tally decides, exactly as before');
  /* a good fill-aware tally keeps the pass and still says which it read */
  const good = gate({ samples: 40, hit: 0.5, ticketOnly: { samples: 30, hit: 0.5, fillSamples: 24, fillHit: 0.5 } });
  assert(!!good && good.pass === true && /24 FILLED TICKETS/.test(good.why) && !/never filled/.test(good.why), 'a fill-aware tally that pays passes, labelled FILLED, with no excluded note when none was excluded');
  /* the in-sample block and the all-firings figure are untouched */
  assert(/measured out-of-sample on cleared setups|have not paid/.test(judged.why), 'the verdict text is the gate\'s own');
  const none = gate(null);
  assert(!!none && /in-sample/.test(none.why), 'no forward record: the in-sample number stands, labelled in-sample');
}

console.log('== 3) OMNIGOLD reads the same rule and decides exactly as it did ==');
{
  const W = boot(CHAIN);
  const src = strip(read('omnigold.js'));
  assert(/hgFwdJudgeSample\(judgeSrc, FWD_MIN_JUDGE\)/.test(src), 'OMNIGOLD\'s judge calls the shared rule on the population it chose');
  assert(!/judgeSrc\.fillSamples/.test(src) && !/fillN >= FWD_MIN_JUDGE/.test(src), 'and carries no second copy of the rule (the inline block is gone)');
  assert(!/fillSamples/.test(strip(read('omniroute.js'))), 'OMNIROUTE carries none either: neither desk reads fillSamples itself');
  /* drive OMNIGOLD's gate the way its own guards do; its measured-edge row
     reads x.fwd exactly as OMNIROUTE's does */
  const rows = tape(220, 5, 4000);
  const h = { dir: 'long', kind: 'POC-REVERT', mech: 'POC-REVERT', level: rows[rows.length - 1].c * 0.99 };
  const gate = fwd => (W.hgOgGates(rows, h, { stats: { samples: 60, hit: 0.5, expR: 0.3 }, fwd: fwd }) || []).filter(g => g && g.key === 'measured-edge')[0] || null;
  const legacy = gate({ samples: 40, hit: 0.5, ticketOnly: { samples: 30, hit: 0.5 } });
  const judged = gate({ samples: 40, hit: 0.5, ticketOnly: { samples: 30, hit: 0.5, fillSamples: 22, fillHit: 0.09, fillUnfilled: 8 } });
  assert(!!legacy && !!judged, 'REACHABILITY: OMNIGOLD\'s measured-edge row renders on both inputs');
  assert(legacy.pass !== false && /30 settled TICKETS/.test(legacy.why), 'the actual tally is not condemned (OMNIGOLD\'s hard gate reads an unproven sample as not-proof, never as a veto): ' + legacy.why);
  assert(judged.pass === false && /22 FILLED TICKETS/.test(judged.why) && /8 never filled, excluded/.test(judged.why), 'the fill-aware tally vetoes, labelled as OMNIGOLD always labelled it: ' + judged.why);
}

console.log('== 4) the stamp ==');
{
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
  assert(/hg-v982/.test(read('AGENTS.md')), 'AGENTS.md records hg-v982');
}
console.log('\n' + (process.exitCode ? 'FAILED' : 'PASSED') + ' ' + passed + ' assertions');
