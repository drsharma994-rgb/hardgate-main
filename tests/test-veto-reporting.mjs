/* HARDGATE — "still no tickets in both the tabs". Two live scans, one gate.

   Gold:   11 setups,   0 tickets — news-window vetoed all 3 visible cards.
   Crypto: 1240 setups, 0 tickets — news-window vetoed all 10 visible cards.

   Every one of them carried the same eight words: "news risk high — blackout
   window". There was no blackout. news.js puts two different facts on the
   same object:

     blackout : now is inside [event - 60m, event + 60m] of a high-impact
                print. Trading is genuinely suspended.
     risk     : 'high' when a blackout is active OR a high-impact USD event
                lands within the next TWENTY-FOUR HOURS.

   Both desks vetoed on risk === 'high'. The US calendar has a high-impact
   release within 24h on most weekdays — CPI, NFP, FOMC, PPI, PCE, GDP, and
   weekly jobless claims every Thursday — so the gate was not occasionally on,
   it was permanently on. Both desks were dark for days, and the card said
   "blackout window" while no blackout existed.

   brain.js hit this on 2026-07-30 and fixed it there, with a comment: "an
   event hours away is context — a caution chip, never a kill". engine.js and
   book.js veto on blackout alone too. omnigold and omniroute were the last
   two consumers killing on the forecast, which is why the rest of the app
   kept working while both tabs sat empty.

   Two reporting defects rode along with it and are fixed here as well: the
   consensus tie-break blamed a missing regime read on cards whose regime-fit
   gate had just printed WEAK TREND, and a zero-ticket scan named no gate at
   all, leaving the common veto to be found by reading every card.

   Run: node tests/test-veto-reporting.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();
const GOLD = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
const ROUTE = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');

const T0 = 1700000000 - (1700000000 % 86400);
function tape(n, seed, mode){
  const out = []; let p = 3300, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    const d = mode === 'trend' ? 0.09 : mode === 'range' ? Math.sin(i / 30) * 0.22 : 0;
    p = p * (1 + (rnd() - 0.48 + d) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    out.push({ t: T0 + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 800 + rnd() * 1200 });
  }
  return out;
}
const ROWS = tape(400, 7, 'trend');
const gate = (g, k) => (g || []).filter(x => x && x.key === k)[0] || null;

console.log('== THE DEFECT: a 24h forecast was vetoing as though it were a blackout ==');
{
  /* Exactly the live shape: a red print inside 24h, no blackout active. */
  const g = W.hgOgGates(ROWS, { dir: 'long', mech: 'ORB' }, {
    news: { risk: 'high', blackout: false,
            note: 'high-impact USD event in 19h 12m: US CPI (YoY)' } });
  const nw = gate(g, 'news-window');
  ok(!!nw, 'the news-window gate is on the ledger');
  ok(nw.info === true, 'a horizon event is INFO — it can no longer kill a ticket');
  ok(/caution, not a veto/.test(nw.why), 'and says so: ' + nw.why);
  ok(/OUTSIDE the blackout window/.test(nw.why), 'naming the distinction that was collapsed');
  ok(/US CPI/.test(nw.why), 'while still naming the event');
  ok(/19h 12m/.test(nw.why), 'and how far away it is, which is the whole point');
  ok(!/TRADING BLOCKED/.test(nw.why), 'with no blocked banner, because trading is not blocked');
  /* The string the user saw on twenty-one cards across two desks. */
  ok(!/risk high . blackout window/.test(nw.why) && !/^news risk/.test(nw.why),
     'and the exact live string is gone — the only mention of a blackout window says OUTSIDE it');
}

console.log('\n== a REAL blackout still stops everything, and says what for ==');
{
  const g = W.hgOgGates(ROWS, { dir: 'long', mech: 'ORB' }, {
    news: { risk: 'high', blackout: true,
            note: 'BLACKOUT: US CPI (YoY) — within the 60m/60m high-impact window' } });
  const nw = gate(g, 'news-window');
  ok(nw.pass === false, 'an active blackout vetoes');
  ok(nw.info !== true, 'as a real veto, not a caution');
  ok(/NEWS BLACKOUT/.test(nw.why), 'and leads with what it is: ' + nw.why);
  ok(/TRADING BLOCKED/.test(nw.why), 'saying plainly that trading is blocked');
  ok(/US CPI/.test(nw.why) && /60m\/60m/.test(nw.why),
     'and NAMES THE EVENT and the window, so the reader knows when it lifts');
}

console.log('\n== the ticket actually survives a horizon event now ==');
{
  /* The behavioural claim that matters. hgOmniGrade counts any pass===false as
     a veto UNLESS info:true — so this is what decides whether the desk goes
     dark, and asserting the message alone would prove nothing. */
  const clean = [{ key: 'trend', hard: true, pass: true, why: 'ok' },
                 { key: 'vol-alive', hard: true, pass: true, why: 'ok' }];
  const horizon = { key: 'news-window', hard: false, info: true, pass: false,
                    why: 'red event on the horizon, OUTSIDE the blackout window — caution, not a veto' };
  const blackout = { key: 'news-window', hard: false, pass: false, why: 'NEWS BLACKOUT — TRADING BLOCKED' };
  const gA = W.hgOmniGrade(clean.concat([horizon]));
  const gB = W.hgOmniGrade(clean.concat([blackout]));
  ok(gA.ticket === true, 'a clean setup with a red event 19h out is a TICKET again');
  ok(gB.ticket === false, 'and a clean setup inside a real blackout is still not');
  ok((gA.vetoes || []).indexOf('news-window') < 0, 'the horizon event is not counted a veto');
  ok((gB.vetoes || []).indexOf('news-window') >= 0, 'the blackout is');
}

console.log('\n== a blackout with NO event named still admits it ==');
{
  const nw = gate(W.hgOgGates(ROWS, { dir: 'long', mech: 'ORB' },
                  { news: { blackout: true, risk: 'high' } }), 'news-window');
  ok(nw.pass === false, 'a blackout with no note still vetoes');
  ok(/no event named/.test(nw.why), 'but admits it cannot name the event: ' + nw.why);
  ok(/check the news tab/.test(nw.why), 'and points at where to look');
}

console.log('\n== a calm feed passes, and does not shout ==');
{
  for (const risk of ['low', 'med']){
    const nw = gate(W.hgOgGates(ROWS, { dir: 'long', mech: 'ORB' },
                    { news: { risk: risk, note: 'nothing inside 24h' } }), 'news-window');
    ok(nw.pass === true, risk + ' risk passes');
    ok(nw.info !== true, 'as a genuine pass, not a caution');
    ok(!/BLACKOUT|TRADING BLOCKED/.test(nw.why), 'with no blocked banner (' + nw.why + ')');
    ok(/nothing inside 24h/.test(nw.why), 'and still carrying the note');
  }
}

console.log('\n== both desks were fixed, not just the one that was reported ==');
{
  /* The decision moved to hg-gates.js. It was byte-identical in both desks
     (2,730 chars, verbatim) precisely because this fix had to be written
     twice — so keeping ONE copy is the durable form of "both desks were
     fixed". Each desk is still asserted to call it. */
  const SHARED = fs.readFileSync(path.join(ROOT, 'hg-gates.js'), 'utf8');
  ok(/var nwBlack = \(news\.blackout === true\);/.test(SHARED), 'the shared gate reads blackout on its own');
  ok(/\n      nw = !nwBlack;/.test(SHARED), 'and vetoes on the blackout alone');
  ok(!/nw = !\(news\.blackout === true \|\| String\(news\.risk\) === 'high'\)/.test(SHARED),
     'it no longer vetoes on the 24h forecast');
  ok(/caution, not a veto/.test(SHARED), 'it reports the horizon event as a caution');
  ok(/jobless\s+claims/i.test(SHARED), 'and records WHY 24h is permanently on, so it is not tidied away again');
  for (const [n, src] of [['omnigold', GOLD], ['omniroute', ROUTE]]){
    ok(/hgNewsGate\(x\.news\)/.test(src), n + ' calls the shared gate');
    ok(!/var nwBlack =/.test(src), n + ' keeps no second copy of the decision');
  }
  /* The rest of the app already had this right; it must stay that way. */
  const BRAIN = fs.readFileSync(path.join(ROOT, 'brain.js'), 'utf8');
  ok(/vetoed the board PERMANENTLY/.test(BRAIN), 'brain.js still carries the original diagnosis');
  ok(/if \(n\.blackout === true\)/.test(BRAIN), 'and still vetoes on blackout alone');
}

console.log('\n== DEFECT 2: the tie-break says WHICH failure, not always "no regime read" ==');
{
  ok(/it cannot break its own tie/.test(GOLD), 'omnigold names the split-favoured-family case');
  ok(/it cannot break its own tie/.test(ROUTE), 'omniroute does too');
  ok(/has nothing here to favour/.test(GOLD) && /has nothing here to favour/.test(ROUTE),
     'and the family-did-not-fire case, on both desks');

  /* The behavioural half. Consensus reads x.allHits, so the three tie-break
     failures can each be built exactly rather than fished for. */
  const con = (allHits, dir) => gate(W.hgOgGates(ROWS, { dir: dir || 'long', kind: 'SPRING', mech: 'SPRING' },
                                                 { allHits: allHits }), 'consensus');
  ok(/trend/i.test(String((W.detectRegime(ROWS) || {}).regime || '')), 'the test tape reads as a trend regime');

  /* 1 agree (SWEEP) vs 1 against (REVERSION) — a tie — with TREND split. */
  const split = con([{ kind: 'SPRING', dir: 'long' }, { kind: 'VALUE', dir: 'short' },
                     { kind: 'ORB', dir: 'long' }, { kind: 'MMOVE', dir: 'short' }]);
  ok(split.pass === false, 'a tie the regime cannot break still vetoes — the verdict is unchanged');
  ok(/TREND is itself split/.test(split.why), 'and says the favoured family is split: ' + split.why);
  ok(/cannot break its own tie/.test(split.why), 'which is why it cannot decide');
  ok(!/no regime read/.test(split.why), 'it does NOT claim there is no regime read — this was the defect');

  /* The same tie with TREND absent entirely is a different fact. */
  const absent = con([{ kind: 'SPRING', dir: 'long' }, { kind: 'VALUE', dir: 'short' }]);
  ok(absent.pass === false, 'a tie with the favoured family absent also vetoes');
  ok(/TREND did not fire at all/.test(absent.why), 'and says so plainly: ' + absent.why);
  ok(!/no regime read/.test(absent.why), 'again without blaming a missing regime read');
  ok(absent.why !== split.why, 'the two failures do not print the same sentence');

  /* Only a genuinely absent regime may print the original message. A regime
     the tie-break vocabulary does not recognise is exactly that case — it is
     also what a future regime label would look like before anyone wires it in. */
  const W2 = boot();
  W2.detectRegime = () => ({ regime: 'unclassified', label: 'UNCLASSIFIED' });
  const noReg = (W2.hgOgGates(ROWS, { dir: 'long', kind: 'SPRING', mech: 'SPRING' },
                  { allHits: [{ kind: 'SPRING', dir: 'long' }, { kind: 'VALUE', dir: 'short' }] })
                 || []).filter(g => g && g.key === 'consensus')[0];
  ok(noReg.pass === false, 'with an unrecognised regime the tie still vetoes');
  ok(/no regime read to break it/.test(noReg.why),
     'and THAT is when "no regime read" is the honest answer');

  /* The tie-break must still WORK when it can: 2 vs 2 with TREND on our side. */
  const broken = con([{ kind: 'SPRING', dir: 'long' }, { kind: 'ORB', dir: 'long' },
                      { kind: 'VALUE', dir: 'short' }, { kind: 'FVG-FILL', dir: 'short' }]);
  ok(broken.pass === true, 'a tie the trend regime CAN break still passes');
  ok(/broken by the trend regime/.test(broken.why), 'saying which regime broke it: ' + broken.why);
}

console.log('\n== DEFECT 3: a scan with no tickets names the gate responsible ==');
{
  for (const [n, src] of [['omnigold', GOLD], ['omniroute', ROUTE]]){
    ok(/NO TICKETS: /.test(src), n + ' status line reports the blocking gate');
    ok(/vetoed /.test(src) && /of ' \+ ranked\.length \+ ' setups'/.test(src),
       n + ' says how many of how many setups it vetoed');
    ok(/bg\.pass === false && bg\.info !== true/.test(src),
       n + ' counts only real vetoes — an info gate never blocked anything');
    ok(/WhyNoTickets\(\)/.test(src), n + ' points at the full tally');
  }
  /* Only when there is something to explain. A desk with tickets must not
     carry a NO TICKETS banner. */
  ok(/if \(!tickets && ranked\.length\)/.test(GOLD) && /if \(!tickets && ranked\.length\)/.test(ROUTE),
     'and only when there are setups and no tickets');
}

console.log('\n== the whole ledger still works — this changed reporting, not verdicts ==');
{
  const base = W.hgOgGates(ROWS, { dir: 'long', mech: 'ORB' }, {});
  ok(base.length > 20, 'the gold ledger still has ' + base.length + ' gates');
  ok(base.every(g => g && typeof g.key === 'string' && 'pass' in g && 'why' in g),
     'every gate has a key, a verdict and a reason');
  ok(base.every(g => g.pass === true || g.pass === false || g.pass === null),
     'and every verdict is pass, veto or UNCHECKED — never undefined');
  ok(base.every(g => String(g.why).length > 0 && !/undefined|NaN/.test(String(g.why))),
     'with no undefined or NaN anywhere in the reasons');
  /* Same news input, same verdict as before the message changed. */
  const blocked = gate(W.hgOgGates(ROWS, { dir: 'long', mech: 'ORB' }, { news: { blackout: true, risk: 'medium' } }), 'news-window');
  ok(blocked.pass === false, 'a blackout at medium risk still vetoes, as it always did');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL VETO REPORTING TESTS PASSED');
