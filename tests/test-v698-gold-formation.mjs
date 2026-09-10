/* HARDGATE — hg-v698 GOLD FORMATION: one contract across all three gold desks.

   WHAT THIS PROVES, per tab (OMNIGOLD / OMNIGOLD 1 / NEW GOLD):

     1  a setup with >= 3 INDEPENDENT confirmations from DISTINCT classes
        (structure / momentum / participation / session-or-HTF) FORMS, and
        every confirmation is NAMED;
     2  a setup with only 2 classes renders WATCH with the MISSING CLASS
        NAMED — never a ticket, never silently dropped;
     3  a measured-demoted kind and a kill-listed (tab, kind) NEVER form;
     4  a stop inside 8x the venue round trip NEVER forms.

   Plus the contract's own invariants: a class counts ONCE however many reads
   inside it agree; geometry gates are never confirmations; the session leg
   confirms only in a measured-non-negative UTC cohort; and the whole verdict
   FAILS CLOSED when the venue-cost machinery is absent.

   Every number asserted here traces to scripts/backtest-omnigold-results.json
   (7,270 settled, PAXGUSDT proxy 2026-03-15..08-29) or to the function that
   already owned the threshold — this ship invented none of its own.

   Run: node tests/test-v698-gold-formation.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, label) => { if (c){ pass++; console.log('  ok   —', label); } else { fail++; console.log('  FAIL —', label); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function mkEl(tag){
  const kids = [];
  const e = { tagName: (tag||'div').toUpperCase(), style:{}, dataset:{}, attrs:{}, children:kids,
    _html:'', value:'', checked:false, disabled:false, textContent:'',
    appendChild(c){ kids.push(c); return c; }, removeChild(){}, insertBefore(c){ kids.push(c); return c; },
    setAttribute(k,v){ e.attrs[k]=v; }, getAttribute(k){ return k in e.attrs ? e.attrs[k] : null; },
    removeAttribute(k){ delete e.attrs[k]; }, hasAttribute(k){ return k in e.attrs; },
    addEventListener(){}, removeEventListener(){}, remove(){}, click(){}, focus(){}, blur(){},
    querySelector(){ return mkEl('div'); }, querySelectorAll(){ return []; },
    closest(){ return null; }, contains(){ return false; }, insertAdjacentHTML(){},
    getBoundingClientRect(){ return {top:0,left:0,width:100,height:100,bottom:100,right:100}; },
    classList:{ add(){}, remove(){}, toggle(){}, contains:()=>false } };
  Object.defineProperty(e,'innerHTML',{ get(){ return e._html; }, set(v){ e._html = String(v); } });
  Object.defineProperty(e,'firstChild',{ get(){ return kids[0]||null; } });
  return e;
}

/* forward-log stub: the ONE place measured evidence enters. Tests drive it. */
const FWD = {};                                 /* 'tab|kind' -> {samples, expR} */

function boot(files){
  const ctx = { console:{ log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object, Number, String,
    Promise, RegExp, Error, TypeError, Map, Set, Symbol, Intl,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent, AbortController };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: mkEl, createTextNode: () => mkEl('span'),
    createDocumentFragment: () => mkEl('div'), getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    head: mkEl('head'), body: mkEl('body'), documentElement: mkEl('html'),
    addEventListener(){}, removeEventListener(){}, visibilityState:'visible', readyState:'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent:'node', onLine:false };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  /* the measured-evidence source both hg-solidity gates read */
  ctx.hgFwdStats = function(tab, kind){
    const r = FWD[String(tab) + '|' + String(kind)];
    return r ? { samples: r.samples, expR: r.expR, wins: 0, losses: 0, open: 0 } : { samples: 0, expR: NaN };
  };
  ctx.HG_OG_VENUE = 'XM';       /* the desk's real execution venue, 0.020% RT */
  return ctx;
}

const CORE = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
  'hg-forward.js','hg-gates.js','hg-plan.js','formation.js','hg-solidity.js',
  'backtest-tab-params.js','gold-session.js','goldind.js','gold-catalog.js',
  'gold-formation.js','omniroute.js','omnigold.js'];

/* synthetic gold tape */
function bars(n, start, step, seed){
  const out = []; let p = start, s = seed || 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  /* base time: a Monday 18:00 UTC close -> NY-PM cohort (measured gross >= 0) */
  const t0 = Math.floor(Date.UTC(2026, 5, 1, 18, 0, 0) / 1000) - n * step;
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.45) * 0.0020);
    const r = p * 0.0016 * (0.5 + rnd());
    out.push({ t: t0 + i * step, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 900 + Math.round(rnd() * 900) });
  }
  return out;
}

console.log('\n=================== SHARED CONTRACT (gold-formation.js) ===================');
{
  const W = boot(['gold-formation.js']);
  const three = W.hgGoldConfluence([
    { cls:'structure', name:'FVG', ok:true },
    { cls:'momentum',  name:'RSI cross', ok:true },
    { cls:'momentum',  name:'VWMA regime', ok:true },
    { cls:'session-htf', name:'4H tape', ok:true }
  ]);
  ok(three.ok === true && three.classCount === 3, '3 distinct classes -> FORMED (4 reads, 3 classes)');
  const two = W.hgGoldConfluence([
    { cls:'structure', name:'FVG', ok:true },
    { cls:'momentum',  name:'RSI cross', ok:true },
    { cls:'momentum',  name:'VWMA regime', ok:true }
  ]);
  ok(two.ok === false && two.state === 'WATCH', '2 distinct classes -> WATCH');
  ok(/MISSING participation, session \/ HTF/.test(two.why), 'WATCH names the missing classes: ' + two.why);
  ok(W.hgGoldConfluenceHtml(two).indexOf('missing classes: participation, session / HTF') > 0,
     'WATCH html names the missing classes');
  /* class counts ONCE, however many reads inside it agree (anti-inflation) */
  const five = W.hgGoldConfluence([
    { cls:'momentum', name:'a', ok:true }, { cls:'momentum', name:'b', ok:true },
    { cls:'momentum', name:'c', ok:true }, { cls:'momentum', name:'d', ok:true },
    { cls:'momentum', name:'e', ok:true }
  ]);
  ok(five.ok === false && five.classCount === 1, '5 momentum reads are ONE class, not five');
  /* measured session cohorts */
  ok(W.hgGoldSessionEdge(Date.UTC(2026,5,1,9,0)).confirms === false, 'LONDON 07-11 (-0.124R n=1428, hg-v700 re-bake) does not confirm');
  ok(W.hgGoldSessionEdge(Date.UTC(2026,5,1,14,0)).confirms === false, 'NY-OVERLAP 12-16 (-0.061R n=2247) does not confirm');
  ok(W.hgGoldSessionEdge(Date.UTC(2026,5,1,18,0)).confirms === true, 'NY-PM 17-20 (+0.053R n=994) confirms');
  ok(W.hgGoldSessionEdge(Date.UTC(2026,5,1,3,0)).confirms === true, 'ASIA 00-06 (+0.066R n=2307, hg-v700 re-bake) confirms');
  ok(/weekend/.test(W.hgGoldSessionEdge(Date.UTC(2026,5,1,3,0)).why), 'ASIA carries the weekend caveat verbatim');
  /* fail closed when the venue floor machinery is absent */
  const noOg = W.hgGoldFormation({ kind:'X', plan:{ entry:1000, stop:998 } },
    { tab:'t', mechanic:'m', confirmations:[
      { cls:'structure', name:'s', ok:true }, { cls:'momentum', name:'m', ok:true },
      { cls:'participation', name:'p', ok:true } ] });
  ok(noOg.formed === false && /venue cost floor unavailable/.test(noOg.reasons[0]),
     'no hgOgFormation -> FAIL CLOSED even with 3 classes');
  /* no threshold of its own: the desk-param aliases resolve to the measured gold rows */
  const W2 = boot(['backtest-tab-params.js']);
  ok(W2.hgNormDeskTab('OMNIGOLD:SWING') === 'gold-swing'
    && W2.hgNormDeskTab('omnigold1:scalp') === 'gold-scalp'
    && W2.hgNormDeskTab('NEWGOLD:1H') === 'gold-scalp'
    && W2.hgNormDeskTab('NEWGOLD:4H') === 'gold-swing',
    'desk-tab-params gold aliases route every gold desk to its measured horizon row');
}

/* ===== AUDIT FIXES (hg-v698) - locked in so they cannot silently regress ==== */
console.log('\n=================== AUDIT FIXES ===================');
{
  const W = boot(['gold-formation.js']);
  /* 1. a fail-open VETO row is not a confirmation. `inst-filter` defaults to
        pass=true and stays true when goldind is not loaded (omnigold.js:4194,
        4197-4199), so counting it satisfied the participation class on 100%
        of cards on a volume-less gold feed with no participation data read. */
  ok(W.hgGoldConfClassOfGate('inst-filter') === null,
     'inst-filter is NOT a confirmation - its pass means "nothing objected"');
  ok(W.hgGoldConfClassOfGate('participation') === 'participation'
    && W.hgGoldConfClassOfGate('spot-basis') === 'participation',
     'the participation class keeps its two POSITIVE reads (volume, PAXG basis)');
  const instOnly = W.hgGoldConfluence(W.hgGoldConfluenceFromGates([
    { key:'consensus', pass:true, why:'1 family agrees' },
    { key:'trend',     pass:true, why:'EMA21 >= EMA50' },
    { key:'inst-filter', pass:true, why:'institutional gold filter OK' },
    { key:'participation', pass:null, why:'this gold feed publishes no volume' },
    { key:'spot-basis',    pass:null, why:'no PAXG print this scan' }
  ]), {});
  ok(instOnly.ok === false && instOnly.missing.indexOf('participation') >= 0,
     'a card whose only participation row is inst-filter is WATCH, missing participation');

  /* 2. OMNIGOLD 1 placeability ROWS never confirm - the same rule that keeps
        OMNIGOLD's fill-path gate out. 'Clean Path' IS fill-path by another
        name (omnigold1.js:666); 'Volatility & Target Realism' asks whether
        TP1 is reachable (omnigold1.js:624), not what confirms the side. */
  const placeOnly = W.hgGoldConfluenceFromMatrix([
    { name:'Clean Path', family:'Volume Profile', got:1, pts:1, evidence:'LVN in path' },
    { name:'Volatility & Target Realism', family:'Volatility', got:1, pts:1, evidence:'TP1 reachable' },
    { name:'Trend & Location Alignment', family:'Trend', got:2, pts:2, evidence:'bias agrees' }
  ]);
  ok(placeOnly.length === 1 && placeOnly[0].name === 'Trend & Location Alignment',
     'OG1 placeability rows (Clean Path, Volatility & Target Realism) never enter the confluence');
  ok(W.hgGoldConfluenceFromMatrix([{ name:'Execution Quality', family:'Execution', got:1, pts:1 }]).length === 1,
     'Execution Quality DOES - its pass requires RVOL >= 0.7, a measured participation read');

  /* 3. the session leg is a function of the CLOSED SIGNAL BAR, not the wall
        clock. Bucketed on the signal bar's own timestamp because that is the
        field the cohorts were computed from (trades[].tISO). */
  const barAt = h => [{ t: Math.floor(Date.UTC(2026, 5, 1, h, 0, 0) / 1000) }];
  ok(W.hgGoldSignalBarMs(barAt(18)) === Date.UTC(2026, 5, 1, 18, 0, 0),
     'hgGoldSignalBarMs reads the last bar OPEN instant (seconds or ms)');
  [null, [], [{}], [{ t: 'x' }], undefined].forEach(bad => {
    const c = W.hgGoldApplySessionLeg([{ cls:'session-htf', name:'s', ok:true }], 's', W.hgGoldSignalBarMs(bad));
    ok(c[0].ok === false && /fail closed/.test(c[0].detail),
       'unreadable bars -> the session leg fails closed, never the wall clock (' + JSON.stringify(bad) + ')');
  });
  const legAt = h => W.hgGoldApplySessionLeg([{ cls:'session-htf', name:'s', ok:true }], 's',
    W.hgGoldSignalBarMs(barAt(h)))[0].ok;
  ok(legAt(3) === true && legAt(18) === true && legAt(9) === false && legAt(14) === false && legAt(22) === false,
     'and it maps every UTC cohort exactly: ASIA/NY-PM confirm, LONDON/NY-OVERLAP/OFF do not');
}

console.log('\n=================== OMNIGOLD ===================');
{
  const W = boot(CORE);
  const rows = bars(200, 4530, 3600, 11);
  const lvl = Math.round(rows[rows.length - 1].c / 10) * 10;
  const daily = W.hgOgResample ? null : null;
  /* the LIVE scan supplies killzone + htf + macro (omnigold.js runScan) */
  const closes = rows.map(r => r.c);
  const htfUp = { e21: closes[closes.length-1] * 1.001, e50: closes[closes.length-1] * 0.999 };
  const nowSec = rows[rows.length - 1].t + 3600;
  const extraFull = { livePx: lvl + 1, nowSec, sessionHard: true,
    killzone: { zone: 'NY_AM', label: 'NY AM' }, htf: htfUp,
    macro: { realRateHint: 'TAILWIND' }, adr: W.hgOgAdr(rows, 14) };
  const hit = { kind: 'ROUND-MAGNET', dir: 'long', level: lvl, why: 'round' };

  /* --- 1. 3+ classes FORMS --- */
  const full = W.hgOgEvaluate(rows, [hit], extraFull, { minRr: 1.5, label: 'SCALP', sessionHard: true })[0];
  const cf = full.formation.confluence;
  console.log('     confluence:', cf.classCount + '/3', cf.present.join(','), '|', cf.why.slice(0, 150));
  ok(cf.classCount >= 3 && full.formation.formed === true,
     'OMNIGOLD: a >=3-class setup FORMS (classes: ' + cf.present.join(', ') + ')');
  ok(cf.confirmed.length > 0 && cf.confirmed.every(x => x.name && x.detail !== undefined),
     'OMNIGOLD: every confirmation is NAMED on the card (' + cf.confirmed.map(x=>x.name).join(', ') + ')');

  /* --- 2. 2 classes -> WATCH with the missing class named ---
     Driven through the REAL hgOgConfluenceFor with a ledger in which only the
     structure and momentum gates pass — the shape a card takes when the
     participation feed is silent and neither the clock nor the daily agrees. */
  const thinGates = [
    { key:'consensus',      pass:true,  why:'2 families agree LONG' },
    { key:'trend',          pass:true,  why:'EMA21 >= EMA50 — with the setup' },
    { key:'ema-stack',      pass:true,  why:'stack aligned' },
    { key:'participation',  pass:null,  why:'this gold feed publishes no volume' },
    { key:'inst-filter',    pass:null,  why:'not judged' },
    { key:'spot-basis',     pass:null,  why:'unavailable' },
    { key:'session',        pass:true,  why:'session LONDON KILLZONE' },   /* clock passes, cohort refuses */
    { key:'htf-daily',      pass:null,  why:'daily bars unavailable' },
    { key:'macro-realrate', pass:null,  why:'macro module has not run' },
    { key:'dxy-inverse',    pass:null,  why:'unavailable' },
    { key:'gold-season',    pass:null,  why:'unavailable' },
    { key:'plan-levels',    pass:true,  why:'geometry gate — never a confirmation' },
    { key:'stop-width',     pass:true,  why:'geometry gate — never a confirmation' }
  ];
  /* AUDIT FIX (hg-v698): the session leg is read on the CLOSED SIGNAL BAR,
     not on the wall clock, so the instant is injected as `barMs` (or as the
     `rows` it is derived from) — never as runScan's Date.now()-derived
     nowSec, which let the SAME closed bar answer FORMED on one scan and
     WATCH on the next. Same LONDON instant, same assertion. */
  const LON_MS = Date.UTC(2026, 5, 1, 9, 0, 0);
  const tf = W.hgOgConfluenceFor(thinGates, { barMs: LON_MS });
  ok(W.hgOgConfluenceFor(thinGates, { rows: [{ t: Math.floor(LON_MS / 1000) }] }).classCount === tf.classCount,
     'OMNIGOLD: the same verdict comes from the bar itself, not from a passed instant');
  ok(W.hgOgConfluenceFor(thinGates, {}).unconfirmed
       .filter(x => x.name === 'session')[0].detail.indexOf('fail closed') >= 0,
     'OMNIGOLD: no readable signal bar -> the session leg fails closed, never falls back to the wall clock');
  ok(tf.classCount === 2 && tf.ok === false,
     'OMNIGOLD: a 2-class ledger does NOT clear the bar (classes ' + tf.classCount + '/3: ' + tf.present.join(', ') + ')');
  ok(tf.missing.indexOf('session-htf') >= 0 && tf.missing.indexOf('participation') >= 0 && /MISSING/.test(tf.why),
     'OMNIGOLD: the missing classes are NAMED — ' + tf.why.slice(-70));
  const sessionEntry = tf.unconfirmed.filter(x => x.name === 'session')[0];
  ok(!!sessionEntry && /LONDON 07-11 UTC measured gross -0.124R at n=1428/.test(sessionEntry.detail),
     'OMNIGOLD: a passing `session` gate in LONDON is NOT a confirmation, and says why');
  ok(/plan-levels|stop-width/.test(JSON.stringify(tf)) === false,
     'OMNIGOLD: geometry gates never enter the confluence at all');
  const thin = JSON.parse(JSON.stringify({ horizon:'SCALP', kind:'ROUND-MAGNET', dir:'long',
    plan: full.plan, grade: full.grade, consensus: full.consensus,
    formation: { formed:false, confluenceShort:true, confluence: tf, reasons:[tf.why] } }));
  const watchHtml = W.hgOgWatchSectionHtml([thin]);
  ok(/WATCH — short of the confluence bar/.test(watchHtml)
    && /missing class/.test(watchHtml)
    && !/ENTRY/.test(watchHtml),
    'OMNIGOLD: WATCH section renders it, names the missing class, prints NO levels');
  ok(W.hgOgPickFor([thin], 'SCALP', 'none') === null, 'OMNIGOLD: a WATCH card is never the MOST PROBABLE pick');
  const split = W.hgOgDemotedSectionHtml([thin]);
  ok(/WATCH — short of the confluence bar/.test(split) && !/MEASURED-NEGATIVE/.test(split),
     'OMNIGOLD: a WATCH card is NOT filed under MEASURED-NEGATIVE');
  /* AUDIT FIX: the COLLAPSED wrapper runScan prints around that block is the
     only text a reader sees before expanding, and it called every stood-aside
     card "measured-negative" - including these. Both counts now come from one
     shared predicate, so the wrapper and the status tally cannot disagree. */
  const demCard = JSON.parse(JSON.stringify({ horizon:'SCALP', kind:'NR7-BREAK', dir:'long',
    plan: full.plan, formation: { formed:false, kindDemotion:{ kind:'NR7-BREAK' }, reasons:['measured-negative'] } }));
  const sa = W.hgOgStoodAsideSplit([thin, demCard]);
  ok(sa.watch.length === 1 && sa.watch[0].kind === 'ROUND-MAGNET'
    && sa.neg.length === 1 && sa.neg[0].kind === 'NR7-BREAK',
     'OMNIGOLD: hgOgStoodAsideSplit separates WATCH from measured-negative for BOTH the tally and the wrapper');
  ok(W.hgOgStoodAsideSplit([]).watch.length === 0 && W.hgOgStoodAsideSplit(null).neg.length === 0,
     'OMNIGOLD: the split helper is safe on an empty / absent list');

  /* --- 3. demoted / kill-listed kind never forms --- */
  const demHit = { kind: 'NR7-BREAK', dir: 'long', level: lvl, why: 'nr7' };  /* gross -0.222 at n=115 */
  const dem = W.hgOgEvaluate(rows, [demHit], extraFull, { minRr: 1.5, label: 'SCALP', sessionHard: true })[0];
  ok(dem.formation.formed === false && !!dem.formation.kindDemotion,
     'OMNIGOLD: a measured-negative kind never forms — ' + (dem.formation.reasons[0] || '').slice(0, 110));
  FWD['OMNIGOLD:SCALP|ROUND-MAGNET'] = { samples: 40, expR: -0.9 };  /* n>=30, expR<-0.5 -> KILL */
  ok(W.hgSolidityIsKilled('OMNIGOLD:SCALP', 'ROUND-MAGNET').killed === true,
     'OMNIGOLD: the kill-list fires on the shared hgSolidityIsKilled');
  const stamped = [JSON.parse(JSON.stringify({
    horizon:'SCALP', kind:'ROUND-MAGNET', dir:'long', plan: full.plan, grade: full.grade,
    consensus: full.consensus, formation: { formed: true } }))];
  W.hgOgStampSolidity(stamped, 'long');    /* mutates in place */
  ok(stamped[0].solidity && stamped[0].solidity.killed === true
     && W.hgOgPickFor(stamped, 'SCALP', 'none') === null,
     'OMNIGOLD: a kill-listed kind is stamped killed and never picked');
  delete FWD['OMNIGOLD:SCALP|ROUND-MAGNET'];

  /* --- 4. stop inside the venue cost floor never forms --- */
  const tight = W.hgOgFormation({ kind: 'ROUND-MAGNET', horizon: 'SCALP',
    plan: { entry: 4000, stop: 3999.6 } });          /* 0.01% stop vs XM 0.020% RT */
  ok(tight.formed === false && !!tight.stopFloor,
     'OMNIGOLD: a stop inside 8x the venue round trip never forms — ' + (tight.reasons[0]||'').slice(0,110));
  const wide = W.hgOgFormation({ kind: 'ROUND-MAGNET', horizon: 'SCALP', plan: { entry: 4000, stop: 3992 } });
  ok(wide.formed === true, 'OMNIGOLD: a 0.20% stop clears the XM 0.16% floor');
}

console.log('\n=================== OMNIGOLD 1 ===================');
{
  const W = boot(CORE.concat(['gold-seven-step.js','omnigold1.js']));
  /* og1Formation is exported; drive it directly with a synthetic ctx/best. */
  const rows = bars(120, 4530, 3600, 5);
  const ctx = { horizon: 'SWING', rows1h: rows, tf: 3600 };
  const mkBest = (matrixRows, cand) => ({ rows: matrixRows, cand });
  const cand3 = { sid: 'S12', dir: 'long', entry: 4000, stop: 3980, t1: 4040, rr1: 2.0, risk: 20 };

  /* --- 1. 3 classes FORMS --- */
  const rows3 = [
    { name:'Structural Liquidity Sweep (SMC)', family:'Structure', got:1, pts:1, evidence:'pool swept' },
    { name:'Trend & Location Alignment', family:'Trend', got:2, pts:2, evidence:'bias agrees' },
    { name:'Order Flow & Delta Divergence', family:'Flow', got:2, pts:2, evidence:'CVD higher low' }
  ];
  const f3 = W.hgOg1Formation(ctx, mkBest(rows3, cand3));
  console.log('     confluence:', f3.confluence.classCount + '/3', f3.confluence.present.join(','));
  ok(f3.formed === true && f3.confluence.classCount === 3,
     'OMNIGOLD 1: a >=3-class candidate FORMS (' + f3.confluence.present.join(', ') + ')');
  ok(f3.confluence.confirmed.map(x=>x.name).join('|').indexOf('Structural Liquidity Sweep') >= 0,
     'OMNIGOLD 1: every confirmation is NAMED — ' + f3.confluence.confirmed.map(x=>x.name).join(', '));

  /* --- 2. 2 classes -> WATCH with the missing class named --- */
  const rows2 = [
    { name:'Structural Liquidity Sweep (SMC)', family:'Structure', got:1, pts:1, evidence:'pool swept' },
    { name:'Trend & Location Alignment', family:'Trend', got:2, pts:2, evidence:'bias agrees' },
    { name:'Statistical Positioning (VWAP / Z)', family:'Statistical', got:1, pts:1, evidence:'retest held' }
  ];
  const f2 = W.hgOg1Formation(ctx, mkBest(rows2, cand3));
  ok(f2.formed === false && f2.state === 'WATCH' && f2.confluence.classCount === 2,
     'OMNIGOLD 1: a 2-class candidate is WATCH, not a ticket');
  ok(f2.confluence.missing.indexOf('participation') >= 0 && /MISSING/.test(f2.confluence.why),
     'OMNIGOLD 1: the missing class is NAMED — ' + f2.confluence.why.slice(-70));
  const g = W.hgOg1Grade({ sid:'S12', dir:'long', rr1:2.0, grade:'A', reclaimed:true,
    matrix:{ score:14, families:['a','b','c','d'], spreadOk:true, held:false, rows: rows2 },
    gates:{ pass:12 }, verdict:{ formation: f2 } });
  ok(g.tradeReady === false && g.why.join(' ').indexOf('capped at C') >= 0,
     'OMNIGOLD 1: a WATCH candidate is capped at C and is never trade-ready');

  /* the session leg is class credit only, decided by the measured cohort */
  const sessRow = [{ name:'Session Volatility Filter', family:'Time', got:1, pts:1, evidence:'overlap' }];
  const lonRows = bars(4, 4530, 3600, 3).map((r,i) => ({ ...r, t: Math.floor(Date.UTC(2026,5,1,8,0,0)/1000) - 3600 }));
  const cLon = W.hgOg1Confirmations({ horizon:'SWING', rows1h: lonRows, tf: 3600 }, mkBest(sessRow, cand3));
  ok(cLon[0].ok === false && /LONDON/.test(cLon[0].detail),
     'OMNIGOLD 1: the session leg does NOT confirm in LONDON 07-11 (-0.124R n=1428)');
  const nyRows = [{ t: Math.floor(Date.UTC(2026,5,1,18,0,0)/1000) - 3600, o:1,h:1,l:1,c:1,v:1 }];
  const cNy = W.hgOg1Confirmations({ horizon:'SWING', rows1h: nyRows, tf: 3600 }, mkBest(sessRow, cand3));
  ok(cNy[0].ok === true && /NY-PM/.test(cNy[0].detail),
     'OMNIGOLD 1: the session leg DOES confirm in NY-PM 17-20 (+0.053R n=994)');

  /* --- 3. kill-listed mechanic never forms --- */
  FWD['omnigold1|S12-SWING'] = { samples: 45, expR: -0.8 };
  const fk = W.hgOg1Formation(ctx, mkBest(rows3, cand3));
  ok(fk.formed === false && fk.state === 'KILLED' && /KILL-LIST/.test(fk.reasons.join(' ')),
     'OMNIGOLD 1: a kill-listed mechanic never forms — ' + fk.reasons[0].slice(0, 100));
  delete FWD['omnigold1|S12-SWING'];
  /* a measured-negative OMNIGOLD kind is refused for OG1 too (same table) */
  const fdem = W.hgOg1Formation(ctx, mkBest(rows3, { ...cand3, sid: 'NR7-BREAK' }));
  ok(fdem.formed === false && !!fdem.kindDemotion,
     'OMNIGOLD 1: the SAME measured kind-demotion table applies — ' + (fdem.reasons[0]||'').slice(0, 100));

  /* --- 4. stop inside the venue cost floor never forms --- */
  const fTight = W.hgOg1Formation(ctx, mkBest(rows3, { sid:'S12', dir:'long', entry:4000, stop:3999.6, t1:4001, rr1:2, risk:0.4 }));
  ok(fTight.formed === false && !!fTight.stopFloor,
     'OMNIGOLD 1: a stop inside 8x the venue round trip never forms — ' + (fTight.reasons[0]||'').slice(0, 110));
}

console.log('\n=================== NEW GOLD ===================');
{
  const W = boot(CORE.concat(['newgold.js']));
  const base = { dir:'long',
    fvg:{ top: 4010, bot: 3990, ageBars: 3 },
    ml:{ baseline: 3995, regime: 'bullish' },
    rsi:{ now: 55, sma: 50 },
    entry: 4000, stop: 3980, t1: 4030, rr1: 1.5, kind: 'TRIPLE-CONF' };
  const NYPM = Date.UTC(2026, 5, 1, 18, 0);
  const LON  = Date.UTC(2026, 5, 1, 9, 0);

  /* --- 1. 3 classes FORMS (structure + momentum + session/HTF) --- */
  const c3 = W.ngConfirmations(base, { tape: { dir:'long', src:'4H VWMA-50 regime' }, nowMs: NYPM });
  const f3 = W.hgGoldFormation(
    { kind:'TRIPLE-CONF', horizon:'1H', dir:'long', plan:{ entry:4000, stop:3980, t1:4030, rr1:1.5 } },
    { tab:'NEWGOLD:1H', mechanic:'TRIPLE-CONF', confirmations: c3 });
  console.log('     confluence:', f3.confluence.classCount + '/3', f3.confluence.present.join(','));
  ok(f3.formed === true && f3.confluence.classCount === 3,
     'NEW GOLD: FVG + momentum + real HTF/session -> FORMS (' + f3.confluence.present.join(', ') + ')');
  ok(f3.confluence.confirmed.map(x => x.name).join(', ').indexOf('FVG mitigation zone') >= 0,
     'NEW GOLD: every confirmation is NAMED — ' + f3.confluence.confirmed.map(x=>x.name).join(', '));

  /* --- 2. 2 classes -> WATCH with the missing class named --- */
  const c2 = W.ngConfirmations(base, { tape: { dir:'', src:'' }, nowMs: LON });
  const f2 = W.hgGoldFormation(
    { kind:'TRIPLE-CONF', horizon:'1H', dir:'long', plan:{ entry:4000, stop:3980, t1:4030, rr1:1.5 } },
    { tab:'NEWGOLD:1H', mechanic:'TRIPLE-CONF', confirmations: c2 });
  ok(f2.formed === false && f2.state === 'WATCH' && f2.confluence.classCount === 2,
     'NEW GOLD: no HTF read + LONDON session -> WATCH (' + f2.confluence.classCount + '/3)');
  ok(f2.confluence.missing.join(',') === 'participation,session-htf',
     'NEW GOLD: the missing classes are NAMED — ' + f2.confluence.why.slice(-80));
  const html = W.hgGoldConfluenceHtml(f2.confluence);
  ok(/missing classes: participation, session \/ HTF/.test(html), 'NEW GOLD: the card names them in HTML');
  /* the fabricated self-confirming tape is gone */
  const src = read('newgold.js');
  /* the CODE, not the block comment that documents its removal */
  const selfTape = src.split('\n').filter(l => /^\s*tape:\s*(setup|ogSetup)\.dir\s*,/.test(l));
  ok(selfTape.length === 0, 'NEW GOLD: no `tape: setup.dir` assignment survives in code');
  ok(/tape: tape\.dir \|\| ''/.test(src) && /tape: laneTape\.dir \|\| ''/.test(src),
     'NEW GOLD: both solidity calls now take the REAL htf tape (or nothing)');
  ok(typeof W.ngHtfTape === 'function' && W.ngHtfTape('4H', []).dir === '',
     'NEW GOLD: an unreadable HTF tape returns nothing, never a guess');
  /* participation is named absent, never fabricated from volume */
  const part = c3.filter(x => x.cls === 'participation')[0];
  ok(part && part.ok === false && /no taker delta/.test(part.detail),
     'NEW GOLD: participation is reported ABSENT with the reason, never filled with volume');

  /* --- 3. demoted / kill-listed kind never forms --- */
  FWD['NEWGOLD:1H|TRIPLE-CONF'] = { samples: 40, expR: -0.85 };
  const fk = W.hgGoldFormation(
    { kind:'TRIPLE-CONF', horizon:'1H', dir:'long', plan:{ entry:4000, stop:3980, t1:4030 } },
    { tab:'NEWGOLD:1H', mechanic:'TRIPLE-CONF', confirmations: c3 });
  ok(fk.formed === false && fk.state === 'KILLED',
     'NEW GOLD: a kill-listed kind never forms — ' + fk.reasons[0].slice(0, 100));
  delete FWD['NEWGOLD:1H|TRIPLE-CONF'];
  /* the OMNI hybrid is judged on its UNDERLYING measured-negative kind */
  const fh = W.hgGoldFormation(
    { kind:'TRIPLE-CONF+OMNI:NR7-BREAK', horizon:'OMNI-4H', dir:'long', plan:{ entry:4000, stop:3980, t1:4030 } },
    { tab:'NEWGOLD:OMNI-4H', mechanic:'TRIPLE-CONF+OMNI:NR7-BREAK', alsoKinds:['NR7-BREAK'], confirmations: c3 });
  ok(fh.formed === false && !!fh.kindDemotion,
     'NEW GOLD: a hybrid on a measured-negative OMNIGOLD kind never forms — ' + (fh.reasons[0]||'').slice(0, 110));

  /* --- 4. stop inside the venue cost floor never forms --- */
  const ft = W.hgGoldFormation(
    { kind:'TRIPLE-CONF', horizon:'1H', dir:'long', plan:{ entry:4000, stop:3999.6, t1:4001 } },
    { tab:'NEWGOLD:1H', mechanic:'TRIPLE-CONF', confirmations: c3 });
  ok(ft.formed === false && !!ft.stopFloor,
     'NEW GOLD: a stop inside 8x the venue round trip never forms — ' + (ft.reasons[0]||'').slice(0, 110));
}

console.log('\n============================================================');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
console.log('OK - v698: one gold formation contract across OMNIGOLD / OMNIGOLD 1 / NEW GOLD');

/* --- shell wiring: version triple + precache (the ship checklist) --------- */
{
  const { HG_VER } = await import('./helpers/build-version.mjs');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw  = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const qv  = HG_VER.replace(/^hg-v/, '');
  ok(/^hg-v(?:698|699|[7-9]\d\d|\d{4,})$/.test(HG_VER), 'build-stamp version >= hg-v698 (got ' + HG_VER + ')');
  ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw), 'sw.js HG_CACHE matches build-stamp');
  ok(new RegExp('gold-formation\\.js\\?v=' + qv).test(idx), 'index.html loads gold-formation.js at ?v=' + qv);
  ok(idx.indexOf('gold-formation.js?v=') < idx.indexOf('newgold.js?v='),
     'gold-formation.js loads before the gold desks that call it');
  ok(/'\.\/gold-formation\.js'/.test(sw), 'sw.js precaches gold-formation.js');
  ok(/'\.\/newgold\.js'/.test(sw), 'sw.js precaches newgold.js (it was absent — the only gold desk left offline)');
  const nightly = fs.readFileSync(path.join(ROOT, 'formation-nightly.js'), 'utf8');
  ok(/newgold: 1/.test(nightly), 'NEW GOLD is in HG_GOLD_TAB_IDS (it was painting the CRYPTO nightly banner)');
}
console.log('\n' + pass + ' passed, ' + fail + ' failed (incl. shell wiring)');
if (fail) process.exit(1);
