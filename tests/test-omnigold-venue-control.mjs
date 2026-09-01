/* HARDGATE — OMNIGOLD execution-venue control (hg-v537).

   The v533 cost machinery priced every stop at a venue named only by a
   window override nobody set, so the tab ran at PAXG costs (0.26% RT,
   formation stop floor 2.08%) while the desk executes gold on XM XAUUSD
   (~0.020% RT, floor 0.16%) — the xm-trader.js MT5 bridge every SEND
   TICKET TO XM button feeds. This suite pins the visible control that
   fixed it:

     PRECEDENCE   window.HG_OG_VENUE override > UI selection (localStorage
                  'hg_og_venue') > PAXG conservative fail-closed
     UI DEFAULT   XM at mount when nothing is stored — the desk's actual
                  execution venue; PAXG when localStorage is UNAVAILABLE
     HONESTY      the AT-PAXG-COSTS disclosure fires at XM, the banner
                  names the active venue with its demotion count AND the
                  other venue's, and the counts strip is real populations

   plus the end-to-end consequence on the real detect->evaluate chain:
   scalp stops of 0.2-1% FORM at XM, the demotion list is exactly the 12
   gross-negative kinds, survivors sort first, and the stood-aside section
   prints the numbers.

   Run: node tests/test-omnigold-venue-control.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function mkEl(tag){
  const e = { tagName: (tag || 'div').toUpperCase(), style: {}, attrs: {}, _html: '',
    value: '', checked: false, disabled: false, textContent: '',
    appendChild(c){ return c; }, removeChild(){}, insertBefore(c){ return c; },
    setAttribute(k, v){ e.attrs[k] = v; }, getAttribute(k){ return k in e.attrs ? e.attrs[k] : null; },
    addEventListener(){}, removeEventListener(){}, remove(){},
    querySelector(){ return mkEl('div'); }, querySelectorAll(){ return []; },
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false } };
  Object.defineProperty(e, 'innerHTML', { get(){ return e._html; }, set(v){ e._html = String(v); } });
  return e;
}

function boot(lsMode){
  const store = {};
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  if (lsMode === 'throws'){
    /* Storage DENIED (private mode, blocked site data): every access throws. */
    ctx.localStorage = { getItem(){ throw new Error('denied'); }, setItem(){ throw new Error('denied'); }, removeItem(){} };
  } else {
    /* A REAL (in-memory) store, so persistence round-trips are observable. */
    ctx.localStorage = { getItem: (k) => (k in store ? store[k] : null),
                         setItem(k, v){ store[k] = String(v); }, removeItem(k){ delete store[k]; } };
  }
  ctx.__store = store;
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.document = { createElement: mkEl, getElementById: () => mkEl('div'),
                   querySelector: () => mkEl('div'), querySelectorAll: () => [],
                   head: mkEl('head'), body: mkEl('body'), documentElement: mkEl('html'), addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'structure-levels.js',
                   'best-levels.js', 'gold-best-levels.js', 'regime.js',
                   'goldind.js', 'pinegoldmath.js', 'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

/* The 12 kinds the replay measured gross-negative at scale (grossR <= -0.05,
   n >= 100) — demoted at ANY venue, because direction was wrong before fees.
   The 10 more that PAXG's 0.26% RT alone demotes (venue-net <= -0.5R) must
   NOT be demoted at XM. Derived from the baked table, checked literally here
   so a silent re-bake moves a test, not just a banner. */
const GROSS_NEGATIVE_12 = ['SPRING', 'LONDON-FIX', 'FVG-HVN', 'NR7-BREAK', 'MFI-SQUAT',
  'PIVOT-REJECT', 'KZ-JUDAS', 'FIB-618', 'PD-EQUILIBRIUM', 'RIBBON-PULLBACK',
  'ICHI-KUMO', 'EMA50-HOLD'].sort();

console.log('== precedence: override > UI selection > PAXG fail-closed ==');
{
  const W = boot();
  ok(W.hgOgVenueCost().venue === 'PAXG', 'no mount, no override -> PAXG (unchanged v533 behavior)');
  ok(W.hgOgVenueInit() === 'XM', 'init with nothing stored -> XM, the desk\'s execution venue');
  ok(W.hgOgVenueCost().venue === 'XM', 'the selection is what hgOgVenueCost reads');
  ok(W.__store['hg_og_venue'] === undefined, 'init is a READ — the default is not written back');
  ok(W.hgOgSetVenue('PAXG') === true && W.hgOgVenueCost().venue === 'PAXG', 'control switches to PAXG');
  ok(W.__store['hg_og_venue'] === 'PAXG', 'the choice persists under hg_og_venue');
  ok(W.hgOgVenueInit() === 'PAXG', 'a stored choice survives remount');
  ok(W.hgOgSetVenue('BINANCE') === false && W.hgOgVenueCost().venue === 'PAXG',
     'an unknown venue is refused — fail closed, nothing changes');
  W.hgOgSetVenue('XM');
  W.HG_OG_VENUE = 'PAXG';
  ok(W.hgOgVenueCost().venue === 'PAXG', 'window.HG_OG_VENUE override wins over the UI selection');
  W.HG_OG_VENUE = 'BOGUS';
  const bogus = W.hgOgVenueCost();
  ok(bogus.venue === 'PAXG' && /unrecognised/.test(bogus.basis),
     'an unrecognised override fails closed to PAXG and says so');
  W.HG_OG_VENUE = undefined;
  ok(W.hgOgVenueCost().venue === 'XM', 'override cleared -> the UI selection is back');
}

console.log('\n== localStorage UNAVAILABLE -> PAXG, the conservative fallback ==');
{
  const W = boot('throws');
  ok(W.hgOgVenueInit() === '', 'denied storage: no selection is restored');
  ok(W.hgOgVenueCost().venue === 'PAXG', 'and the venue stays PAXG — never assume the cheap venue blind');
  ok(W.hgOgSetVenue('XM') === true && W.hgOgVenueCost().venue === 'XM',
     'an explicit in-page choice still applies for this load, unpersisted');
}

console.log('\n== per-venue demotion counts: 12 at XM, 22 at PAXG ==');
{
  const W = boot();
  const xm = W.hgOgVenuePresetCost('XM'), paxg = W.hgOgVenuePresetCost('PAXG');
  ok(Math.abs(xm.rtCostPct - 0.020) < 1e-9, 'XM preset ~0.020% RT');
  ok(Math.abs(paxg.rtCostPct - 0.26) < 1e-9, 'PAXG preset 0.26% RT');
  const kinds = Object.keys(W.HG_OG_REPLAY_EVIDENCE.kinds);
  const demXm = kinds.filter(k => W.hgOgKindDemotion(k, xm)).sort();
  const demPaxg = kinds.filter(k => W.hgOgKindDemotion(k, paxg)).sort();
  ok(W.hgOgDemotedKindCount(xm) === 12 && demXm.length === 12, '12 kinds stand demoted at XM costs');
  ok(W.hgOgDemotedKindCount(paxg) === 22 && demPaxg.length === 22, '22 at PAXG costs');
  ok(JSON.stringify(demXm) === JSON.stringify(GROSS_NEGATIVE_12),
     'the XM 12 are exactly the gross-negative kinds — cheap fees clear no wrong direction');
  ok(demXm.every(k => demPaxg.includes(k)), 'every XM demotion is also a PAXG demotion (fees only add)');
  demXm.forEach(k => {
    const d = W.hgOgKindDemotion(k, xm);
    ok(d.reasons.some(r => /grossR .* direction measured wrong at scale/.test(r)),
       k + ' demoted at XM for measured direction, not fees');
  });
}

console.log('\n== desk-stance banner names the ACTIVE venue and both counts ==');
{
  const W = boot();
  W.hgOgVenueInit();                                   /* -> XM default */
  const atXm = W.hgOgDeskStanceBannerHtml();
  ok(/venue XM XAUUSD ~0\.020% RT — 12 measured-negative kinds stood aside; at PAXG costs \(0\.260% RT\) it would be 22/.test(atXm),
     'XM banner line: 12 stood aside, 22 at PAXG costs');
  W.hgOgSetVenue('PAXG');
  const atPaxg = W.hgOgDeskStanceBannerHtml();
  ok(/venue PAXG ~0\.260% RT — 22 measured-negative kinds stood aside; at XM costs \(0\.020% RT\) it would be 12/.test(atPaxg),
     'PAXG banner line: 22 stood aside, 12 at XM costs');
}

console.log('\n== disclosure integrity at the XM default ==');
{
  const W = boot();
  W.hgOgVenueInit();                                   /* -> XM */
  const note = W.hgOgVenueCostNoteHtml();
  ok(note.length > 0, 'the venue-cost note FIRES at XM (fees differ from the replay\'s)');
  ok(/AT PAXG COSTS/.test(note), 'and states the replay outcomes were measured AT PAXG COSTS');
  W.hgOgSetVenue('PAXG');
  ok(W.hgOgVenueCostNoteHtml() === '', 'at PAXG costs there is nothing to reconcile — no note');
}

console.log('\n== mount: control present, XM applied, counts strip reserved ==');
{
  const W = boot();
  const tab = W.HG_tabs.filter(t => /omnigold/i.test(t.id))[0];
  ok(!!tab, 'omnigold tab registered');
  const el = mkEl('div');
  tab.mount(el);
  ok(/EXECUTION VENUE/.test(el.innerHTML), 'EXECUTION VENUE control renders in the tab header area');
  ok(/id="ogVenueXm"[^>]*data-og-venue="XM">XM XAUUSD</.test(el.innerHTML), 'XM XAUUSD button');
  ok(/id="ogVenuePaxg"[^>]*data-og-venue="PAXG">PAXG</.test(el.innerHTML), 'PAXG button one click away');
  ok(/applies on next scan/.test(el.innerHTML), 'labeled honestly: formation stamps re-price on the next scan');
  ok(/id="ogCounts"/.test(el.innerHTML), 'population counts strip reserved under the banner');
  ok(W.hgOgVenueCost().venue === 'XM', 'mount applied the XM default (nothing stored)');
  ok(/venue XM XAUUSD ~0\.020% RT — 12 measured-negative kinds/.test(el.innerHTML),
     'the banner in the mounted tab prices the XM default');
}

console.log('\n== counts strip is computed from the real partition ==');
{
  const W = boot();
  const cards = [
    { kind: 'STRUCT-BOS', dir: 'long', grade: { ticket: true } },   /* survivor leads ticket+aligned */
    { kind: 'ORB', dir: 'long', grade: { ticket: true } },
    { kind: 'ADR-FADE', dir: 'short', grade: { ticket: false } }    /* non-survivor leads its section */
  ];
  const c = W.hgOgScanCounts(cards, [{}, {}], 'long');
  ok(c.tradable === 3 && c.demoted === 2, 'tradable and demoted are the list lengths, nothing invented');
  ok(c.survivorLedSections === 1, 'one section led by a replay survivor');
  const ui = { counts: mkEl('div') };
  W.hgOgPaintCounts(ui, c);
  ok(ui.counts.textContent === 'tradable setups 3 · demoted 2 · survivors leading 1 section',
     'strip text is the counts, via textContent (no markup path)');
}

console.log('\n== END TO END at the XM default: the real detect->evaluate chain ==');
{
  const W = boot();
  W.hgOgVenueInit();                                   /* XM, as a mounted tab would be */
  ok(W.hgOgVenueCost().venue === 'XM', 'venue is XM before the scan');

  /* The e2e suite's staggered tape battery — real detectors, real gates,
     real plans, real formation stamps. */
  const T0 = 1700000000 - (1700000000 % 86400);
  function tape(seed, n, tfSec, mode, shiftDays){
    let s = seed;
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const rows = []; let p = 2000 + rnd() * 400;
    const shift = (shiftDays || 0) * 86400;
    for (let i = 0; i < n; i++){
      let d;
      if (mode === 'trend') d = 1.1;
      else if (mode === 'range') d = Math.sin(i / 11) * 4;
      else if (mode === 'spike') d = (i % 37 === 0) ? (rnd() > 0.5 ? 18 : -18) : Math.sin(i / 8) * 3;
      else d = (rnd() - 0.5) * 9;
      p += d + (rnd() - 0.5) * 4;
      const o = p, c = p + (rnd() - 0.5) * 5;
      rows.push({ t: T0 + shift + i * tfSec, o, h: Math.max(o, c) + rnd() * 6,
                  l: Math.min(o, c) - rnd() * 6, c, v: 800 + rnd() * 1800 + ((i % 23 === 0) ? 4500 : 0) });
    }
    return rows;
  }
  const HZ = {
    SCALP: { label: 'SCALP', tf: '1h', minRr: 1.5, horizonBars: 24, warm: 60, minAtrPct: 0.05, sessionHard: true },
    SWING: { label: 'SWING', tf: '4h', minRr: 2.0, horizonBars: 20, warm: 45, minAtrPct: 0.12, sessionHard: false }
  };
  const all = [];
  for (const hz of ['SCALP', 'SWING']){
    const cfg = HZ[hz], tfSec = hz === 'SCALP' ? 3600 : 14400;
    for (const mode of ['trend', 'range', 'spike', 'rand']){
      for (let s = 1; s <= 6; s++){
        const rows = tape(s * 7919 + (hz === 'SWING' ? 13 : 0), 300, tfSec, mode, s);
        let hits = [];
        try { hits = W.hgOgDetect(rows, { nowSec: rows[rows.length - 1].t }); } catch (e) { continue; }
        if (!hits.length) continue;
        const livePx = rows[rows.length - 1].c;
        const extra = { htf: null, killzone: null, macro: null, yieldRows: null,
                        nowSec: rows[rows.length - 1].t, adr: W.hgOgAdr(rows, 14),
                        news: null, stats: null, livePx, zoneCtx: null,
                        paxg: livePx * 1.004, srcId: 'gold-spot' };
        try { all.push(...W.hgOgEvaluate(rows, hits, extra, cfg)); } catch (e) {}
      }
    }
  }
  ok(all.length > 100, 'the chain produced candidates (' + all.length + ')');

  /* The same partition runScan makes: formed -> tradable, else stood aside. */
  const formed = all.filter(c => !(c.formation && c.formation.formed === false));
  const demotedCards = all.filter(c => c.formation && c.formation.formed === false);
  const stopPct = c => (c.plan && isFinite(c.plan.entry) && isFinite(c.plan.stop) && c.plan.entry > 0)
    ? Math.abs(c.plan.entry - c.plan.stop) / c.plan.entry * 100 : NaN;

  /* 1. Scalps with 0.2-1% stops FORM at XM (floor 0.16%) unless the KIND is
        demoted — the population PAXG's 2.08% floor used to kill wholesale. */
  const scalpTight = all.filter(c => c.horizon === 'SCALP'
    && isFinite(stopPct(c)) && stopPct(c) >= 0.2 && stopPct(c) <= 1.0
    && !GROSS_NEGATIVE_12.includes(String(c.kind).toUpperCase()));
  ok(scalpTight.length > 0, 'the battery produced scalps with 0.2-1% stops (' + scalpTight.length + ')');
  const refused = scalpTight.filter(c => c.formation && c.formation.formed === false);
  ok(refused.length === 0, 'every one of them FORMS at XM costs'
    + (refused.length ? ' — refused: ' + refused.map(c => c.kind + '@' + stopPct(c).toFixed(2) + '%').join(', ') : ''));
  ok(W.hgOgFormation({ kind: 'ORB', horizon: 'SCALP', plan: { entry: 1000, stop: 998 } }).formed === true,
     'floor check: a 0.2% stop clears the XM 0.16% floor');
  W.hgOgSetVenue('PAXG');
  ok(W.hgOgFormation({ kind: 'ORB', horizon: 'SCALP', plan: { entry: 1000, stop: 998 } }).formed === false,
     'the same stop at PAXG costs does not form (floor 2.08%) — the venue is the difference');
  W.hgOgSetVenue('XM');

  /* 2. Every kind demotion stamped in this scan is one of the XM 12. */
  const demKinds = [...new Set(demotedCards
    .filter(c => c.formation.kindDemotion)
    .map(c => String(c.kind).toUpperCase()))].sort();
  ok(demKinds.length > 0, 'the battery hit demoted kinds (' + demKinds.join(', ') + ')');
  ok(demKinds.every(k => GROSS_NEGATIVE_12.includes(k)),
     'every demotion stamped at XM is in the gross-negative 12 — none of PAXG\'s 10 fee-only demotions');

  /* 3. Survivors sort first: in desk order, any section containing a
        survivor is LED by one. */
  const ordered = W.hgOgDeskOrder(formed, 'none');
  const cls = c => ((c && c.grade && c.grade.ticket) ? 2 : 0);   /* tape 'none' -> no alignment bit */
  const surv = c => !!(c.replaySurvivor || W.hgOgIsSurvivor(c.kind));
  const firstOf = {}, hasSurv = {};
  ordered.forEach(c => {
    const k = cls(c);
    if (!(k in firstOf)) firstOf[k] = c;
    if (surv(c)) hasSurv[k] = true;
  });
  ok(Object.keys(hasSurv).length > 0, 'at least one section contains a replay survivor');
  ok(Object.keys(hasSurv).every(k => surv(firstOf[k])),
     'every section that contains a survivor is led by one');

  /* 4. The MEASURED-NEGATIVE section lists the demoted, with numbers and
        without levels. */
  const sect = W.hgOgDemotedSectionHtml(demotedCards);
  ok(/MEASURED-NEGATIVE KINDS — stood aside/.test(sect), 'section header');
  ok(/replay n=\d+, WR \d+%, gross [+-]?\d/.test(sect), 'each row carries the measured numbers');
  ok(/at XM costs/.test(sect), 'thresholds are stated at the ACTIVE venue');
  ok(!/ENTRY/.test(sect) && !/T1/.test(sect), 'and no levels are printed on a stood-aside card');

  /* 5. The counts strip from this same partition is the real population. */
  const counts = W.hgOgScanCounts(ordered, demotedCards, 'none');
  ok(counts.tradable === formed.length && counts.demoted === demotedCards.length,
     'counts strip: tradable ' + counts.tradable + ' · demoted ' + counts.demoted
     + ' · survivors leading ' + counts.survivorLedSections + ' section(s) — all from the partition');
}

console.log('\nomnigold venue control: ' + passed + ' checks passed');
