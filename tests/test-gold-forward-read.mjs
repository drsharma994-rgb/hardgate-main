/* HARDGATE — THE GOLD DESKS READ THE RECORDS THEY WRITE.

   Thirteen of the fifteen gold tabs that can be driven write a forward
   record on every scan. FOUR read any back. Nine write into a log that,
   from their own board, may as well not exist.

   MEASURED (pack 913) across the gold family:

     write a forward record  13
     read one back            4   omnigold omnigold1 golddirection 80percent
     write and never read     9   super-gold optigold newgold goldswing
                                  goldscalp goldultra goldpro goldpine tauric

   GOLDSCALP and GOLDSWING are a partial exception worth naming rather than
   counting as read: OMNIGOLD pools their records into ITS gate, so they are
   consulted — by a different desk, for a different board. The desk that
   wrote them never sees them. GOLDULTRA, NEWGOLD, OPTI GOLD and GOLDPRO are
   pooled by nobody at all.

   WHAT THIS IS NOT. It does not reimplement OMNIGOLD's measured-edge gate:
   all/ticket/gate-clear populations, cross-tab pooling, an effective-n
   overlap correction, a multiple-comparison bar counted from the horizon
   table. Two copies of that would be two things to drift. This is the small
   honest version for the desks that have nothing — what does my own log say
   about me, and is it enough to say anything.

   THE ARITHMETIC IS THE REPO'S OWN. A desk pays if its win rate beats the
   breakeven its own measured R:R implies, and fails if it cannot. Both
   sides are Wilson bounds at the accuracy floor's z, through the same
   exported hgWilsonLower:

     breakeven   = 1 / (1 + avgRr)
     PAYING      Wilson LOWER > breakeven
     LOSING      Wilson UPPER < breakeven
     UNMEASURED  the interval straddles it, or n is under 20

   Wilson's upper is 1 - lower(losses, n) by the symmetry of the interval.
   This file verifies that to 3.3e-16 across every (w, n) up to 500 rather
   than taking it on trust, so the repo keeps ONE interval implementation.

   IT REPORTS. A LOSING verdict demotes, never suppresses, and only at
   OMNIGOLD's own 30-sample bar — borrowing that desk's threshold is honest
   where inventing one is not. UNMEASURED changes nothing: an empty log is
   the normal state of a desk that has not traded, and a desk that has not
   traded must not read as a desk that has failed.

   Run: node tests/test-gold-forward-read.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const S = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function boot(){
  const store = Object.create(null);
  const c = { Math, isFinite, isNaN, Number, String, Array, Object, JSON, RegExp, Date, Intl,
              parseFloat, parseInt, console: { log(){}, warn(){}, error(){} },
              localStorage: { getItem: k => (k in store ? store[k] : null),
                              setItem: (k, v) => { store[k] = String(v); },
                              removeItem: k => { delete store[k]; } } };
  c.window = c; vm.createContext(c);
  for (const f of ['hg-forward.js', 'accuracy-floor.js', 'gold-forward-read.js'])
    vm.runInContext(S(f), c, { filename: f });
  return c;
}
const C = boot();

console.log('== the write/read split this pack closes ==');
{
  const GOLD = ['super-gold','omnigold','omnigold1','optigold','newgold','golddirection',
                'goldswing','goldscalp','goldultra','goldpro','goldspot','goldcoint',
                'goldpine','tauric','eightypercent'];
  const FILE = { eightypercent: 'eightypercent.js' };
  const writes = [], readsNow = [];
  for (const id of GOLD){
    const f = FILE[id] || (id + '.js');
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    const src = S(f);
    if (/hgFwdRecordScan|hgFwdRecord\b/.test(src)) writes.push(id);
    if (/hgGoldFwdNote|hgFwdStats|hgFwdPool/.test(src)) readsNow.push(id);
  }
  ok(writes.length === 13, `${writes.length} gold tabs write a forward record`);
  const deaf = writes.filter(id => readsNow.indexOf(id) < 0);
  ok(deaf.length === 0,
     'and after this pack every one of them also reads one back'
     + (deaf.length ? (' — still deaf: ' + deaf.join(', ')) : ''));
  /* The nine this pack wired, named so the claim is checkable. */
  for (const id of ['super-gold','optigold','newgold','goldswing','goldscalp',
                    'goldultra','goldpro','goldpine','tauric']){
    const f = FILE[id] || (id + '.js');
    ok(new RegExp("hgGoldFwdNote\\('" + id + "'\\)").test(S(f)),
       `${id} renders its own forward verdict, keyed to its own roster id`);
  }
}

console.log('\n== one roster, and one interval implementation ==');
{
  ok(typeof C.HG_ACCURACY_TABS === 'object' && C.HG_ACCURACY_TABS,
     'the accuracy roster map is exported, so this module resolves the SAME pool names');
  ok(typeof C.hgAccuracyPools === 'function',
     'and so is its family resolver, which is the only thing that can expand GOLDPINE:* and NEWGOLD:*');
  ok(!/HG_GOLD_FWD_TABS|var ROSTER|POOLS = \{/.test(S('gold-forward-read.js')),
     'and this module carries no roster of its own — two rosters would be two chances to name different pools');

  /* The symmetry the module relies on, checked rather than trusted. */
  const L = C.hgWilsonLower;
  const direct = (w, n, z) => { const p = w / n, d = 1 + z * z / n;
    return (p + z * z / (2 * n) + z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; };
  let worst = 0;
  for (const n of [1, 2, 5, 10, 30, 100, 500])
    for (let w = 0; w <= n; w++) worst = Math.max(worst, Math.abs(direct(w, n, 1.96) - (1 - L(n - w, n, 1.96))));
  ok(worst < 1e-12,
     `Wilson upper = 1 - lower(losses) holds to ${worst.toExponential(1)} across every (w,n) to 500`);
  ok(!/function wilsonUpperImpl|Math\.sqrt\(p \* \(1 - p\)/.test(S('gold-forward-read.js')),
     'so the module computes no interval of its own');
}

console.log('\n== the verdict, at every point of the range ==');
{
  const V = st => { const v = C.hgGoldFwdVerdict(st); return v && v.verdict; };
  ok(C.hgGoldFwdVerdict(null) === null, 'no stat at all returns null — nothing to judge is not a judgement');
  ok(V({ samples: 0, wins: 0, avgRr: 2 }) === 'unmeasured', 'an empty log is unmeasured');
  ok(V({ samples: 3, wins: 2, avgRr: 2 }) === 'unmeasured', '3 settled is unmeasured — under the 20 bar');
  ok(V({ samples: 19, wins: 19, avgRr: 2 }) === 'unmeasured',
     'and 19 straight wins is STILL unmeasured — the bar is on the count, not on how good it looks');
  ok(V({ samples: 25, wins: 10, avgRr: 2 }) === 'unmeasured',
     '40% on a 2:1 (breakeven 33%) at n=25 is unmeasured — the interval straddles');
  ok(V({ samples: 60, wins: 3, avgRr: 2 }) === 'losing', '5% on a 2:1 at n=60 is losing');
  ok(V({ samples: 60, wins: 54, avgRr: 2 }) === 'paying', '90% on a 2:1 at n=60 is paying');
  /* A missing R:R must ABSTAIN, not fall back to an assumed one. The case
     has to be chosen so the two differ: 30 of 60 sits on breakeven under an
     assumed 1:1 and reads unmeasured either way, which is how an earlier
     draft of this line let a silent rr=1 default survive a mutation run.
     180 of 200 would read PAYING under that default. */
  ok(V({ samples: 200, wins: 180, avgRr: 0 }) === 'unmeasured',
     'with no measured R:R there is no breakeven, so no verdict — 90% over n=200 still abstains');
  ok(V({ samples: 200, wins: 180, avgRr: 1 }) === 'paying',
     'and the same record with a REAL 1:1 in the log reads paying — the abstain is the missing R:R, not the numbers');
  ok(V({ samples: 60, wins: 30, avgRr: 0 }) === 'unmeasured', 'an absent R:R abstains at any sample size');

  /* The R:R is what sets the bar, so the same win rate must be able to read
     both ways. Otherwise the breakeven is decorative. */
  ok(V({ samples: 200, wins: 90, avgRr: 4 }) === 'paying' && V({ samples: 200, wins: 90, avgRr: 0.5 }) === 'losing',
     '45% pays at 4:1 and loses at 0.5:1 — the breakeven is doing real work');
}

console.log('\n== it demotes only on a measured failure, at a borrowed bar ==');
{
  ok(C.HG_GOLD_FWD_DEMOTE_SAMPLES === 30,
     'the demote bar is 30 settled — OMNIGOLD\'s own EDGE_VETO_SAMPLES, not a new number');
  ok(C.HG_GOLD_FWD_MIN_JUDGE === 20, 'and no verdict at all under 20 settled');
  ok(/EDGE_VETO_SAMPLES/.test(S('gold-forward-read.js')),
     'and the source names where the bar came from, so the borrowing is visible');
  ok(/EDGE_VETO_SAMPLES = 30/.test(S('omnigold.js')),
     'and OMNIGOLD really does still set it to 30 — the moment it does not, these two disagree');

  const mk = (samples, wins) => ({ samples, wins, hit: wins / samples, avgRr: 2, open: 0, losses: samples - wins });
  ok(C.hgGoldFwdVerdict(mk(25, 1)).verdict === 'losing', 'a desk can be measured losing at n=25');
  /* ...and still not be demoted for it. */
  const src = S('gold-forward-read.js');
  ok(/demote: !!\(v && v\.verdict === 'losing' && \+stat\.samples >= FWD_DEMOTE_SAMPLES\)/.test(src),
     'but demote requires BOTH the losing verdict and the 30-sample bar');
  ok(!/dropped|suppress/.test(src.slice(src.indexOf('function hgGoldFwdRead'), src.indexOf('function pct'))),
     'and nothing here ever suppresses — a demote is the most it asks for');
}

console.log('\n== the note says which of the three it found ==');
{
  /* Drive the real note through the real stats layer by seeding the log. */
  /* Built in the log's OWN shape and settled through its own state field,
     rather than hand-rolled: an earlier draft of this file invented a record
     shape, hgFwdStats counted 0 of them, and the test would have passed on a
     reader that read nothing. The fields here come from hgFwdNormalize. */
  const now = Math.floor(Date.now() / 1000);
  const seed = (n, wins) => {
    const recs = [];
    for (let i = 0; i < n; i++){
      const win = i < wins;
      recs.push({ tab: 'GOLDULTRA', mechanic: 'M', sym: 'XAUUSD', tf: '15m', dir: 'long',
                  entry: 100, stop: 99, t1: 102, risk: 1, rr: 2,
                  barT: now - 86400 * 30 - i * 3600, horizonBars: 24, ticket: true,
                  state: win ? 't1' : 'stop', settledT: now - 86400 * 29 });
    }
    C.localStorage.setItem('hg_forward_v1', JSON.stringify(recs));
  };
  seed(60, 3);
  const r = C.hgGoldFwdRead('goldultra');
  ok(r && r.pools && r.pools[0] === 'GOLDULTRA', 'the read resolves GOLDULTRA from the shared roster');
  ok(r && r.stat && r.stat.samples === 60, `and pools ${r && r.stat && r.stat.samples} settled records out of the log`);
  const note = strip(C.hgGoldFwdNote('goldultra'));
  ok(/LOSING/i.test(note), 'a losing desk is told so');
  ok(/60 settled/.test(note) && /breakeven|break even/.test(note), 'with the count and the breakeven it failed');
  ok(/demoted/.test(note), 'and that cards are demoted, since 60 clears the 30 bar');
  ok(/pool: GOLDULTRA/.test(note), 'and which pool it read');

  C.localStorage.setItem('hg_forward_v1', JSON.stringify([]));
  const empty = strip(C.hgGoldFwdNote('goldultra'));
  ok(/HAS NOT MEASURED ITSELF YET/.test(empty), 'an empty log reads as not-yet-measured');
  ok(/not a desk that has failed/.test(empty),
     'and says so in as many words — the distinction this whole module exists for');
  ok(!/demoted|LOSING/i.test(empty.replace(/Nothing is demoted or promoted[\s\S]*$/, ' ')),
     'with no losing language anywhere before the promise');
}

console.log('\n== absent is absent, and nothing throws ==');
{
  for (const bad of ['nope', '', null, undefined, 42])
    ok(C.hgGoldFwdNote(bad) === '', `a tab id that is not on the roster renders nothing (${JSON.stringify(bad)})`);
  ok(C.hgGoldFwdPools('nope') === null, 'and resolves to null rather than an empty promise');

  /* The module must survive a page where the log layer never loaded. */
  const bare = { Math, isFinite, isNaN, Number, String, Array, Object, JSON, RegExp };
  bare.window = bare; vm.createContext(bare);
  vm.runInContext(S('gold-forward-read.js'), bare, { filename: 'gold-forward-read.js' });
  ok(bare.hgGoldFwdRead('goldscalp') === null && bare.hgGoldFwdNote('goldscalp') === '',
     'with no hgFwdStats and no roster it returns null and renders nothing, rather than throwing');
}

console.log('\n== it resolves at call time, so load order cannot break it ==');
{
  /* index.html loads accuracy-floor AFTER several gold tabs. That is fine
     because every dependency is read inside a function, at render time —
     but "fine" is worth proving rather than asserting. */
  const idx = S('index.html');
  const at = f => idx.indexOf('<script src="' + f);
  ok(at('gold-forward-read.js') > 0, 'index.html loads the module');
  ok(at('accuracy-floor.js') > at('goldpro.js'),
     'and the roster really does load AFTER a gold tab, so call-time resolution is load-bearing');

  const late = { Math, isFinite, isNaN, Number, String, Array, Object, JSON, RegExp, Date, Intl,
                 parseFloat, parseInt, console: { log(){}, warn(){}, error(){} } };
  const st = Object.create(null);
  late.localStorage = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem(){} };
  late.window = late; vm.createContext(late);
  vm.runInContext(S('gold-forward-read.js'), late, { filename: 'gold-forward-read.js' });   /* FIRST */
  ok(late.hgGoldFwdNote('goldscalp') === '', 'loaded first, it is silent rather than broken');
  vm.runInContext(S('hg-forward.js'), late, { filename: 'hg-forward.js' });                 /* then its deps */
  vm.runInContext(S('accuracy-floor.js'), late, { filename: 'accuracy-floor.js' });
  ok(late.hgGoldFwdPools('goldscalp') && late.hgGoldFwdPools('goldscalp')[0] === 'GOLDSCALP',
     'and once they arrive it resolves — nothing was captured at load time');
  ok(/HAS NOT MEASURED ITSELF YET/.test(strip(late.hgGoldFwdNote('goldscalp'))),
     'rendering the honest empty-log note');
  ok(/'\.\/gold-forward-read\.js'/.test(S('sw.js')), 'and the offline shell caches it');
}

console.log(`\n${passed} passed, 0 failed`);
