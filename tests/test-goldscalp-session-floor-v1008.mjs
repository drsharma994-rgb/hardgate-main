/* HARDGATE — hg-v1008: GOLDSCALP'S SESSION FLOOR + THE LEDGER'S LAST INCH.

   Gate 1 always knew what TIME it is; until this pack nothing knew whether
   the CROWD showed up. A scalp is a short-horizon trade — it needs
   participation NOW — and a candidate minted on a bar whose volume sits in
   the bottom quintile of ITS OWN session's distribution is in the population
   where scalps drift and die. v1008 adds:

     - hgSessionVolPct (session-volume.js): the judged bar's volume as a
       strict-below percentile of its own session-of-day bucket over the
       loaded tape. Honest nulls: thin tape, <20 same-session samples,
       constant/zero volume (no information), pre-tape instant.
     - hgComexOpenRange / hgComexOrbRead (gold-session.js): today's COMEX
       opening range (the 8:15+8:30 ET grid bars, DST-correct, weekend-shut)
       and whether the judged bar closed OUTSIDE it on the setup's side —
       morning window [8:45, 12:00) ET only. EVIDENCE, never a gate.
     - gsSessionFloorScan (goldscalp.js): demotes 'thin' (DEAD TAPE, never
       MOST PROBABLE), stamps every readable candidate, skips locked/vetoed/
       dropped rows (the trade you are IN keeps running).
     - THE LEDGER'S LAST INCH (hg-forward.js): hgFwdNormalize's whitelist
       silently DROPPED v1006's conf and v1007's regime — "rides the ledger"
       was true of the row, false of the stored record. Now conf / regime /
       sess / orb are enum-gated three-state fields that actually STORE.

   Harness mirrors test-goldscalp-fundamental-v1004.mjs: classic scripts via
   vm.runInThisContext with globalThis.window = {}. The desk seam rides the
   HG_tabs registration (the hg-v967/v968 route) — zero new module-scope
   exports, so the render-integrity guard stays green.

   Run: node tests/test-goldscalp-session-floor-v1008.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

globalThis.window = {};
const W = globalThis.window;
/* the ledger persists under one localStorage key — a stub lets the
   end-to-end test read exactly what hgFwdNormalize STORED */
const __ls = {};
globalThis.localStorage = {
  getItem: k => (k in __ls ? __ls[k] : null),
  setItem: (k, v) => { __ls[k] = String(v); },
  removeItem: k => { delete __ls[k]; }
};
for (const f of ['goldind.js', 'conviction-lock.js', 'session-volume.js', 'gold-session.js', 'hg-forward.js', 'goldscalp.js']){
  vm.runInThisContext(read(f), { filename: f });
}

const reg = (W.HG_tabs || []).filter(t => t && t.id === 'goldscalp')[0] || null;

function cand(dir, over){
  return Object.assign({ sym: 'XAUUSD', dir: dir, strategy: 'TEST SETUP', venue: 'TEST',
                         entry: 2400, stop: 2390, t1: 2420, t2: 2430 }, over || {});
}

/* ---- tuned tapes (the scratchpad sess-verify.js constructions) ---- */
function lcg(seed){ let s = seed; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }
/* Mon..Fri Apr 6-10 2026 (EDT), 96x15m bars/day, t in SECONDS, volume by session:
   ASIAN ~100, LONDON_OPEN ~500, LONDON ~600, US_OPEN ~1000, AFTER_HOURS ~250. */
function week(){
  const rows = []; const t0 = Date.UTC(2026, 3, 6, 0, 0, 0) / 1000;
  const rnd = lcg(42); let c = 2400;
  const base = h => (h < 8 ? 100 : h < 12 ? 500 : h < 17 ? 600 : h < 21 ? 1000 : 250);
  for (let i = 0; i < 5 * 96; i++){
    const t = t0 + i * 900, h = new Date(t * 1000).getUTCHours();
    const o = c; c = c + (rnd() - 0.5) * 4;
    rows.push({ t, o, h: Math.max(o, c) + 1, l: Math.min(o, c) - 1, c, v: Math.round(base(h) * (0.9 + rnd() * 0.2)) });
  }
  return rows;
}
/* the week tape PLUS a COMEX opening-range structure on Wed Apr 8:
   OR bars 12:15/12:30 UTC (8:15/8:30 ET) = 2410..2414 at v 600/650;
   break bar 13:45 UTC (9:45 ET) closes 2416 on v=900 (> the 625 mean). */
function weekWithOrb(){
  const rows = week();
  const at = ms => rows.findIndex(r => r.t * 1000 === ms);
  const o1 = at(Date.UTC(2026, 3, 8, 12, 15)), o2 = at(Date.UTC(2026, 3, 8, 12, 30)),
        bk = at(Date.UTC(2026, 3, 8, 13, 45));
  rows[o1].h = 2414;   rows[o1].l = 2410;   rows[o1].c = 2412; rows[o1].v = 600;
  rows[o2].h = 2413.5; rows[o2].l = 2410.5; rows[o2].c = 2411; rows[o2].v = 650;
  rows[bk].c = 2416;   rows[bk].h = 2416.5; rows[bk].l = 2411.5; rows[bk].v = 900;
  return rows;
}
const DEAD_T  = Date.UTC(2026, 3, 8, 17, 15, 0);   /* US_OPEN bar we force to v=100 */
const STRONG_T = Date.UTC(2026, 3, 8, 18, 0, 0);   /* US_OPEN bar we force to v=1250 */
const BREAK_T = Date.UTC(2026, 3, 8, 13, 45, 0);   /* the ORB break bar (9:45 ET) */
function deadTape(){  /* week tape with the DEAD_T bar at v=100 and STRONG_T at v=1250 */
  const rows = weekWithOrb();
  rows[rows.findIndex(r => r.t * 1000 === DEAD_T)].v = 100;
  rows[rows.findIndex(r => r.t * 1000 === STRONG_T)].v = 1250;
  return rows;
}

console.log('== hgSessionVolPct — the session-relative participation read ==');
{
  const wk = deadTape();
  const dead = W.hgSessionVolPct(wk, DEAD_T);
  ok(dead && dead.pct === 0 && dead.session === 'US_OPEN' && dead.n === 79,
    'a 100-tick bar in US_OPEN (~900-1100) sits at the 0th percentile of its own session (79 other samples)');
  ok(W.hgSessionVolPct(wk, DEAD_T / 1000).pct === 0, 'the same instant in SECONDS reads identically');
  ok(W.hgSessionVolPct(wk, Date.UTC(2026, 3, 8, 17, 22, 0)).pct === 0,
    'a wall-clock instant lands on the bar then forming (17:22 -> the 17:15 bar), never an exact-match miss');
  const asian = W.hgSessionVolPct(wk, Date.UTC(2026, 3, 8, 3, 0, 0));
  ok(asian && asian.session === 'ASIAN' && asian.pct > 20,
    'the SAME ~100-tick volume at 03:00 UTC reads participating in ASIAN — only the session-relative read knows');
  const strong = W.hgSessionVolPct(wk, STRONG_T);
  ok(strong && strong.pct === 100, 'a 1250-tick US_OPEN bar tops its session distribution');
  ok(W.hgSessionVolPct(wk, 'x') === null && W.hgSessionVolPct(wk, null) === null,
    'an unreadable instant is null, never a fabricated percentile');
  for (const bad of [null, [], 'x', {}, wk.slice(0, 10)])
    ok(W.hgSessionVolPct(bad, DEAD_T) === null, 'junk / thin (<30 bar) tapes are null');
  ok(W.hgSessionVolPct(wk.map(r => Object.assign({}, r, { v: 700 })), DEAD_T) === null,
    'a feed printing one repeated figure carries no information — null (the hg-v1006 constant-volume rule)');
  ok(W.hgSessionVolPct(wk.map(r => Object.assign({}, r, { v: 0 })), DEAD_T) === null,
    'all-zero volume is null too — zero variance is not "dead tape", it is no tape');
  ok(W.hgSessionVolPct(wk, Date.UTC(2026, 3, 1)) === null, 'an instant before the tape is null');
}

console.log('\n== hgComexOpenRange / hgComexOrbRead — the COMEX opening range, DST-correct ==');
{
  const wk = weekWithOrb();
  const or = W.hgComexOpenRange(wk, BREAK_T);
  ok(or && or.hi === 2414 && or.lo === 2410 && or.nyDate === '2026-04-08' && or.bars === 2
      && or.t0 === Date.UTC(2026, 3, 8, 12, 15, 0),
    'the range is the 8:15+8:30 ET grid bars (12:15/12:30 UTC in EDT), 2410-2414');
  const withIt = W.hgComexOrbRead(wk, 'long', BREAK_T);
  ok(withIt.state === 'with' && withIt.volOk === true,
    'a long judged on the break bar runs WITH the morning break, volume confirmed (> range-bar mean)');
  ok(W.hgComexOrbRead(wk, 'short', BREAK_T).state === 'against',
    'the same break reads AGAINST a short — evidence, never a gate');
  /* inside bar: close set EXPLICITLY inside the range (the LCG walk drifts) */
  const wk2 = weekWithOrb();
  const i56 = wk2.findIndex(r => r.t * 1000 === Date.UTC(2026, 3, 8, 14, 0, 0));
  wk2[i56].c = 2412; wk2[i56].h = 2412.5; wk2[i56].l = 2411;
  const inside = W.hgComexOrbRead(wk2, 'long', Date.UTC(2026, 3, 8, 14, 0, 0));
  ok(inside.state === 'none' && /INSIDE/.test(inside.why), 'a close inside the range is no break in play');
  ok(W.hgComexOrbRead(wk, 'long', Date.UTC(2026, 3, 8, 12, 30, 0)).state === 'none',
    'before 8:45 ET the range has not finished printing — none, honestly');
  ok(W.hgComexOrbRead(wk, 'long', Date.UTC(2026, 3, 8, 16, 30, 0)).state === 'none',
    'after 12:00 ET the opening range is stale structure, not an opening-range play');
  /* EST: Mon Jan 12 2026 — the OR grid bars move to 13:15/13:30 UTC */
  const jan = (() => {
    const rows = []; const t0 = Date.UTC(2026, 0, 12, 0, 0, 0) / 1000; let c = 2600;
    const rnd = lcg(11);
    for (let i = 0; i < 96; i++){ const t = t0 + i * 900, o = c; c = c + (rnd() - .5) * 3;
      rows.push({ t, o, h: Math.max(o, c) + 1, l: Math.min(o, c) - 1, c, v: 500 }); }
    rows[53].h = 2614; rows[53].l = 2610; rows[53].c = 2612;   /* 13:15 UTC = 8:15 EST */
    rows[54].h = 2613; rows[54].l = 2610.5; rows[54].c = 2611; /* 13:30 UTC */
    rows[59].c = 2616; rows[59].h = 2616.5; rows[59].l = 2611; /* 14:45 UTC = 9:45 EST */
    return rows;
  })();
  const orJan = W.hgComexOpenRange(jan, Date.UTC(2026, 0, 12, 14, 45, 0));
  ok(orJan && orJan.t0 === Date.UTC(2026, 0, 12, 13, 15, 0) && orJan.hi === 2614 && orJan.lo === 2610,
    'EST day: the range is at 13:15 UTC — DST handled by Intl, never a hardcoded offset');
  ok(W.hgComexOrbRead(jan, 'long', Date.UTC(2026, 0, 12, 14, 45, 0)).state === 'with', 'EST break reads WITH');
  /* Saturday: COMEX shut, bars printing is not the exchange opening */
  const sat = (() => { const rows = []; const t0 = Date.UTC(2026, 3, 11, 0, 0, 0) / 1000; let c = 2400;
    for (let i = 0; i < 96; i++){ const t = t0 + i * 900, o = c; c += 0.1;
      rows.push({ t, o, h: c + 1, l: o - 1, c, v: 100 }); } return rows; })();
  const satR = W.hgComexOrbRead(sat, 'long', Date.UTC(2026, 3, 11, 14, 0, 0));
  ok(satR.state === 'unreadable' && /COMEX shut/.test(satR.why), 'a weekend ET date is UNREADABLE, decided from the date alone');
  ok(W.hgComexOrbRead(wk, 'up', BREAK_T).state === 'unreadable'
      && W.hgComexOrbRead(null, 'long', BREAK_T).state === 'unreadable'
      && W.hgComexOrbRead(wk, 'long', null).state === 'unreadable',
    'no direction / no tape / no instant — unreadable, never inferred');
  /* no Intl: Node vm realms carry their own Intl intrinsic, so omission does
     NOT remove it — replace it with a throwing stub for the honest path */
  const savedIntl = globalThis.Intl;
  globalThis.Intl = { DateTimeFormat: function(){ throw new Error('no tz data'); } };
  let noIntl = null;
  try{ noIntl = W.hgComexOrbRead(wk, 'long', BREAK_T); }catch(e){ noIntl = { state: 'threw' }; }
  globalThis.Intl = savedIntl;
  ok(noIntl && noIntl.state === 'unreadable' && /no Intl timezone data/.test(noIntl.why),
    'without Intl, 8:20 ET cannot be located honestly — UNREADABLE, never a UTC approximation');
}

console.log('\n== gsSessionFloorScan — the floor demotes dead tape, stamps everything readable ==');
{
  ok(reg && typeof reg.sessionFloorScan === 'function', 'the HG_tabs registration carries sessionFloorScan (the hg-v967 route)');
  ok(typeof W.gsSessionFloorScan === 'undefined' && typeof W.gsSessionChipHtml === 'undefined'
      && typeof W.GS_SESS_FLOOR_PCT === 'undefined',
    'zero new module-scope exports — the render-integrity guard stays green');
  const wk = deadTape();
  const thin = cand('long', { signalT: DEAD_T });
  const strong = cand('short', { signalT: STRONG_T });
  const res = reg.sessionFloorScan([thin, strong], wk);
  ok(res.demoted === 1 && res.stamped === 2, 'counts: one demoted, both stamped');
  ok(thin.demoted === true && thin.stamps.indexOf('DEAD TAPE') >= 0
      && thin.sessionFloor && thin.sessionFloor.verdict === 'thin'
      && thin.sessionFloor.session === 'US_OPEN' && thin.sessionFloor.pct === 0,
    'the dead-tape candidate is demoted + stamped DEAD TAPE with its session named — it can never be MOST PROBABLE');
  ok(/dead tape/.test((thin.gateNotes || []).join(' ')) && /20/.test((thin.gateNotes || []).join(' ')),
    'the gate note names the reason and the stated floor');
  ok(!strong.demoted && strong.sessionFloor.verdict === 'participating' && strong.sessionFloor.pct === 100,
    'a participating bar is stamped and left alone');
  ok(thin.sessionFloor.orb === 'none' && strong.sessionFloor.orb === 'none',
    '13:15/14:00 ET is past the ORB morning — state none, carried as evidence');
}

console.log('\n== the trade you are IN keeps running; unreadable tape demotes nothing ==');
{
  const wk = deadTape();
  const locked = cand('long', { signalT: DEAD_T, locked: true, asOf: '09:15' });
  const vetoed = cand('long', { signalT: DEAD_T, vetoed: true });
  const dropped = cand('long', { signalT: DEAD_T, dropped: true });
  const res = reg.sessionFloorScan([locked, vetoed, dropped], wk);
  ok(res.demoted === 0 && res.stamped === 0
      && !locked.demoted && locked.sessionFloor === undefined
      && !vetoed.demoted && !dropped.demoted,
    'locked / vetoed / dropped rows are never re-judged — the fundamental scan\'s own skip list');
  const constTape = wk.map(r => Object.assign({}, r, { v: 700 }));
  const c = cand('long', { signalT: DEAD_T });
  const res2 = reg.sessionFloorScan([c], constTape);
  ok(res2.demoted === 0 && !c.demoted && c.sessionFloor && c.sessionFloor.verdict === 'unreadable',
    'a constant-volume feed makes the floor UNREADABLE — and what cannot speak bars nothing');
  /* "modules absent" = the FILES never loaded. session-volume.js declares
     hgSessionVolPct at top level, so runInThisContext binds it on BOTH
     window (its explicit export) and globalThis (the declaration itself) —
     and gfn checks both. Global function declarations are non-configurable
     (delete fails silently) but writable, so the honest simulation is to
     blank both bindings and restore them after. */
  const savedPctW = W.hgSessionVolPct, savedPctG = globalThis.hgSessionVolPct, savedOrb = W.hgComexOrbRead;
  W.hgSessionVolPct = undefined; globalThis.hgSessionVolPct = undefined; delete W.hgComexOrbRead;
  let threw = null, res3 = null;
  const c2 = cand('long', { signalT: DEAD_T });
  try{ res3 = reg.sessionFloorScan([c2], wk); }catch(e){ threw = e; }
  ok(!threw && res3 && res3.demoted === 0 && res3.stamped === 0 && c2.sessionFloor === undefined,
    'the session modules absent -> the pass is a no-op, never a throw');
  W.hgSessionVolPct = savedPctW; globalThis.hgSessionVolPct = savedPctG; W.hgComexOrbRead = savedOrb;
}

console.log('\n== the chip speaks only what the scan stamped ==');
{
  const wk = deadTape();
  const thin = cand('long', { signalT: DEAD_T });
  const withOrb = cand('long', { signalT: BREAK_T });
  const againstOrb = cand('short', { signalT: BREAK_T });
  reg.sessionFloorScan([thin, withOrb, againstOrb], wk);
  const src = read('goldscalp.js');
  /* gsSessionChipHtml is module-scope only (the render-integrity cap) — the
     stamps it consumes are asserted here, the four chip states are pinned on
     the shipped source below. */
  ok(typeof reg.sessionFloorScan === 'function', 'scan reachable (chip pins below)');
  ok(withOrb.sessionFloor.verdict === 'participating' && withOrb.sessionFloor.orb === 'with'
      && withOrb.sessionFloor.orbVol === true,
    'the ORB break bar at 9:45 ET: participating (v=900 tops LONDON) + WITH + volume-confirmed');
  ok(againstOrb.sessionFloor.orb === 'against', 'the same bar AGAINST a short');
  /* the chip itself: eval the function body in isolation is overreach —
     pin the four states on the shipped source instead, and render through
     the scan stamp + chip contract */
  ok(/DEAD TAPE · never MOST PROBABLE/.test(src) && /SESS FLOOR UNREAD/.test(src)
      && /COMEX ORB WITH IT/.test(src) && /COMEX ORB AGAINST/.test(src),
    'the chip names all four states — bad on dead tape, neutral-unread, ok on WITH, neutral on AGAINST');
  ok(/gpip bad/.test(src) && /evidence, never a gate/.test(src),
    'dead tape renders bad; AGAINST is titled evidence-never-a-gate');
}

console.log('\n== THE LEDGER\'S LAST INCH — conf / regime / sess / orb actually STORE ==');
{
  const before = JSON.parse(globalThis.localStorage.getItem('hg_forward_v1') || '[]').length;
  W.hgFwdRecordScan('GOLDSCALP', '15m', [
    { sym: 'XAUUSD', dir: 'long', entry: 2400, stop: 2390, t1: 2420,
      signalT: DEAD_T, mechanic: 'V1008TEST', sess: 'thin', orb: 'with',
      conf: 'confirmed', regime: 'favored' },
    { sym: 'XAUUSD', dir: 'long', entry: 2401, stop: 2391, t1: 2421,
      signalT: STRONG_T, mechanic: 'V1008TEST', sess: 'bogus', orb: 'unreadable',
      conf: 'maybe', regime: 'wild' }
  ], { horizonBars: 96 });
  const list = JSON.parse(globalThis.localStorage.getItem('hg_forward_v1') || '[]');
  ok(list.length === before + 2, 'both records landed');
  const good = list[list.length - 2], bad = list[list.length - 1];
  ok(good.sess === 'thin' && good.orb === 'with' && good.conf === 'confirmed' && good.regime === 'favored',
    'the desks\' evidence stamps survive the normaliser — the v1006/v1007 drop is fixed at the root');
  ok(!('sess' in bad) && !('orb' in bad) && !('conf' in bad) && !('regime' in bad),
    'a value outside the enum stores NOTHING, never a coerced string (orb unreadable drops too)');
  ok(good.barT === Math.floor(DEAD_T / 1000 / 900) * 900,
    'and the record is still dated on the bar the mint judged (hg-v978), dedup key untouched');
}

console.log('\n== wiring pins — the shipped source, not a copy ==');
{
  const src = read('goldscalp.js');
  ok(/var sessScan = null;\s*\n\s*try\{ sessScan = gsSessionFloorScan\(ranked, gold && gold\.rows15m\); \}/.test(src),
    'the scan call feeds the desk\'s own 15m tape');
  const fundIdx = src.indexOf('fundScan = gsFundamentalScan(ranked)');
  const sessIdx = src.indexOf('sessScan = gsSessionFloorScan(ranked');
  const leadIdx = src.indexOf('best = goldPickSpotAlignedBest(ranked, spotRef)');
  ok(fundIdx > 0 && sessIdx > fundIdx && leadIdx > sessIdx,
    'the floor runs after the fundamental stack and BEFORE the leader is picked — dead tape can never be crowned');
  ok(src.indexOf('+ gsSessionChipHtml(c)') > 0
      && src.indexOf('+ gsFundChipHtml(c)') < src.indexOf('+ gsSessionChipHtml(c)'),
    'the chip renders on every card beside the fundamental chip');
  ok(/sessionFloorScan: gsSessionFloorScan/.test(src), 'the registration route is the shipped one the test drove');
  ok(/sess: \(c\.sessionFloor && typeof c\.sessionFloor\.verdict === 'string'\)/.test(src)
      && /orb: \(c\.sessionFloor && typeof c\.sessionFloor\.orb === 'string'\)/.test(src),
    'the at-scan verdicts publish with the snapshot — SUPER GOLD / OMNIGOLD hold THIS read');
  ok(/sess: c\.sess, orb: c\.orb,/.test(src),
    'the ledger map reads the snapshot fields (its c IS the snapshot — sessionFloor never crosses publish)');
  ok(/SESSION FLOOR — /.test(src) && /a scalp needs a crowd/.test(src), 'the scan stat line names the demotions');
  ok(/15\) SESSION FLOOR \(hg-v1008/.test(src), 'the file header documents gate 15');
  const fwd = read('hg-forward.js');
  ok(/rec\.sess === 'participating' \|\| rec\.sess === 'thin' \|\| rec\.sess === 'unreadable'/.test(fwd)
      && /rec\.orb === 'with' \|\| rec\.orb === 'against' \|\| rec\.orb === 'none'/.test(fwd)
      && /rec\.conf === 'confirmed' \|\| rec\.conf === 'unconfirmed' \|\| rec\.conf === 'unverified'/.test(fwd)
      && /rec\.regime === 'favored'/.test(fwd),
    'the normaliser enum-gates all four evidence fields');
  ok(/sess: c\.sess,\s*\n\s*orb: c\.orb,/.test(fwd), 'the record-scan assembly forwards them raw — the normaliser decides');
}

console.log('\npassed: ' + passed);
