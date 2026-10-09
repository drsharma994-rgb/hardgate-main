/* HARDGATE — goldpine.js
   GOLD PINE tab: combined ported Pine math + gold session/SMC confluence.
   SWING setups on 4H (+ 1D HTF) · SCALP setups on 15m (+ 1H/4H HTF).
   hg-v1005: the desk answers to the FUNDAMENTAL STACK (fundamental-stack.js)
   — a red-folder blackout refuses fresh formations outright (the sections
   print empty with the reason named); outside a blackout the scan-time pass
   demotes a setup the stack stands decisively against (it still prints,
   sunk below every clean row and off the top picks) and chips the rest,
   and the full gold board panel renders above the sections. */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var KL_15M = 280, KL_1H = 220, KL_4H = 280, KL_1D = 280;
var SWING_MIN = 10, SCALP_MIN = 8;
var PINE_GOLD_MAX = 24;
var TOP_SETUPS = 2;

function esc(s){
  return String(s || '').replace(/[&<>"]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
  });
}
function fin(v){ return typeof v === 'number' && isFinite(v); }
function gfn(name){
  try{ if (typeof W[name] === 'function') return W[name]; }catch(e){}
  return null;
}
function pxF(n){
  /* THE DELEGATION IS GONE, AND NOT BECAUSE IT WAS BROKEN.

     This read `if (typeof W.px === 'function') return W.px(n);` and pack 848
     established why that was never true: the house px is declared `const` in
     an index.html inline block, and a top-level const does not attach to the
     global object. Pack 849 then asked whether to revive it by putting px on
     the window, measured what that would do, and decided against it. The
     house px rounds a four-figure price to ONE decimal (a >= 1000 ? 1 : ...)
     and groups it, so reviving the delegation would print gold as 4,050.6
     while OMNIGOLD, GOLD SCALP and GOLD SWING all print 4050.62. The
     delegation would cost this desk a decimal and break it away from its own
     family.

     So the line below is the intended path, not a degradation, and the dead
     guard that implied otherwise is removed rather than left to read as a
     capability this file is waiting for. test-dead-window-guards pins the
     whole class.

     THE FALLBACK WAS String(+n), AND THE FALLBACK IS THE ONLY PATH.

     W.px is never defined: there is no `function px(`, `window.px =` or
     `W.px =` anywhere in this repo, so this branch has always been dead and
     every price this file printed went through String(+n) unrounded. GOLD
     PINE rendered "ENTRY 4050.620761151771 · SL 4069.903921366599" onto a
     card carrying SEND TO TRADE PLAN. The sibling fmtF two lines down falls
     back to toFixed(2), so one file degraded two ways.

     This is the house rule, the one omniroute's fmtPx uses: enough digits for
     a sub-cent alt, two for gold, and the fin() treatment of null / '' /
     undefined rather than the price zero. The W.px delegation stays in case a
     build ever defines it. */
  if (n === null || n === undefined || n === '') return '—';
  var v = +n;
  if (!isFinite(v)) return '—';
  var a = Math.abs(v);
  return v.toFixed(a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : a >= 0.0001 ? 7 : 9);
}
function fmtF(n, d){
  /* Same as pxF above: the house fmt is an inline const and has never been on
     the window, so this guard was always false. Left out rather than left in,
     and toFixed is what this desk wants anyway — the house fmt groups
     thousands, which no other gold card does. */
  if (!fin(+n)) return '—';
  return (+n).toFixed(d === undefined ? 2 : d);
}

var SRC_LABEL = { 'binance-xau': 'BINANCE XAUUSDT', 'binance-paxg': 'BINANCE PAXGUSDT',
  'twelvedata': 'TWELVE DATA', 'yahoo': 'YAHOO GC=F' };

async function fetchGoldBars(){
  /* hg-v1161: a direct PAXG fallback leaves the shared chain, so it is anchored
     here through the one home (gold-iux.js) exactly as getGoldCandles anchors
     its own packs. Module absent or anchor unreadable: the feed's own bars.
     Inside the function on purpose: the suite lifts this function alone. */
  var iuxFn = gfn('hgGoldIuxApplyRows');
  async function iuxRows(rows){
    if (!iuxFn || !rows || !rows.length) return rows;
    try{ var o = await iuxFn(rows, 'binance-paxg'); return (o && o.length) ? o : rows; }catch(eIx){ return rows; }
  }
  /* hg-v979: srcByTf names the feed of EACH leg, for the ledger; `source`
     stays the first leg's label as it always was */
  var out = { rows15m: [], rows1h: [], rows4h: [], rows1d: [], source: null, srcByTf: {} };
  function feedOf(a){ return (a && typeof a.source === 'string' && a.source) ? a.source : null; }
  var ggc = gfn('getGoldCandles');
  if (ggc){
    try{
      var legs = await Promise.all([
        ggc('15m', KL_15M).catch(function(){ return null; }),
        ggc('1h', KL_1H).catch(function(){ return null; }),
        ggc('4h', KL_4H).catch(function(){ return null; }),
        ggc('1d', KL_1D).catch(function(){ return null; })
      ]);
      if (legs[0] && legs[0].rows && legs[0].rows.length){ out.rows15m = legs[0].rows; out.source = legs[0].source; if (feedOf(legs[0])) out.srcByTf['15m'] = feedOf(legs[0]); }
      if (legs[1] && legs[1].rows && legs[1].rows.length){ out.rows1h = legs[1].rows; if (!out.source) out.source = legs[1].source; if (feedOf(legs[1])) out.srcByTf['1h'] = feedOf(legs[1]); }
      if (legs[2] && legs[2].rows && legs[2].rows.length){ out.rows4h = legs[2].rows; if (!out.source) out.source = legs[2].source; if (feedOf(legs[2])) out.srcByTf['4h'] = feedOf(legs[2]); }
      if (legs[3] && legs[3].rows && legs[3].rows.length){ out.rows1d = legs[3].rows; if (!out.source) out.source = legs[3].source; if (feedOf(legs[3])) out.srcByTf['1d'] = feedOf(legs[3]); }
    }catch(e){}
  }
  var bk = gfn('binanceKlines');
  if (bk){
    if (!out.rows15m.length){
      try{ var p = await bk('PAXGUSDT', '15m', KL_15M); if (p && p.length){ p = await iuxRows(p); out.rows15m = p; out.source = out.source || 'binance-paxg'; out.srcByTf['15m'] = 'binance-paxg'; } }catch(e5){}
    }
    if (!out.rows1h.length){
      try{ var q = await bk('PAXGUSDT', '1h', KL_1H);  if (q && q.length){ q = await iuxRows(q); out.rows1h = q; out.srcByTf['1h'] = 'binance-paxg'; } }catch(e6){}
    }
    if (!out.rows4h.length){
      try{ var z = await bk('PAXGUSDT', '4h', KL_4H);  if (z && z.length){ z = await iuxRows(z); out.rows4h = z; out.source = out.source || 'binance-paxg'; out.srcByTf['4h'] = 'binance-paxg'; } }catch(e7){}
    }
    if (!out.rows1d.length){
      try{ var y = await bk('PAXGUSDT', '1d', KL_1D);  if (y && y.length) out.rows1d = await iuxRows(y); }catch(e8){}
    }
  }
  return out;
}

/* hg-v1162: THE FREE FEEDS, ONCE PER SCAN. The crypto Fear & Greed index the
   shell keeps (S.fng), the Binance PAXGUSDT perp funding print, the Delta
   gold-perp payload the live feed already loaded (the PERFECT predicate's
   leverage cycle) and the COT snapshot beside the window -- the same reads
   GOLD SCALP hands its ranker (hg-v1155). Each leg fails open to absent;
   the funding request is bounded so no scan waits on it. */
async function gpFreeFeeds(bars){
  var out = { fng: undefined, fundingRate: undefined, perpNative: undefined, cot: undefined };
  try{ var fg = W.S && W.S.fng; if (fg && typeof fg === 'object' && isFinite(+fg.v)) out.fng = fg; }catch(eF){}
  try{ if (bars && bars.live && bars.live.perp) out.perpNative = bars.live.perp; }catch(eP){}
  try{ if (W.__hgGoldCot && typeof W.__hgGoldCot === 'object') out.cot = W.__hgGoldCot; }catch(eC){}
  try{
    var bf = gfn('binanceFunding');
    if (bf){
      var fr = await Promise.race([
        Promise.resolve().then(function(){ return bf('PAXGUSDT'); }).catch(function(){ return null; }),
        new Promise(function(r){ setTimeout(function(){ r(null); }, 6000); })
      ]);
      if (fr && typeof fr.fundingPct === 'number' && isFinite(fr.fundingPct)) out.fundingRate = fr.fundingPct;
    }
  }catch(eB){}
  return out;
}

function setupFromEval(evalRes, mode, source){
  if (!evalRes || !evalRes.display) return null;
  return {
    mode: mode,
    dir: evalRes.dir,
    sym: 'XAUUSD',
    source: source,
    grade: evalRes.grade,
    score: evalRes.score,
    maxScore: evalRes.maxScore,
    factors: evalRes.factors,
    price: evalRes.price,
    entry: evalRes.entry,
    stop: evalRes.stop,
    t1: evalRes.t1,
    t2: evalRes.t2,
    rr: evalRes.rr,
    planSrc: evalRes.planSrc,
    isNew: evalRes.isNew,
    isRecent: evalRes.isRecent,
    isContext: evalRes.isContext,
    tier: evalRes.tier || 'primary',
    atr: evalRes.atr,
    familyCount: evalRes.familyCount,
    layerLabel: evalRes.layerLabel || null,
    kind: evalRes.kind || 'confluence'
  };
}

function setupFromUniverseItem(item, mode, source){
  if (!item || !item.display || !item.dir) return null;
  return setupFromEval(item, mode, source);
}

/* hg-v973: the instant the borrowed mints judge on is the SIGNAL BAR, not the
   wall clock (hg-v952 / hg-v963: a scan re-run after a release must give the
   release bar's answer). Falls back to the caller's clock when the series
   carries no readable instant. */
function gpMintBarMs(rows, fallback){
  try{
    var fn = gfn('hgGoldSignalBarMs');
    if (fn){ var t = fn(rows); if (isFinite(t) && t > 0) return t; }
  }catch(e){}
  return fallback;
}

function setupFromNative(c, mode, source, forming){
  if (!c || !c.dir) return null;
  var tally = fin(+c.tally) ? +c.tally : (fin(+c.agree) ? +c.agree : 0);
  var note = c.strategy || c.stratKey || 'native gold detector';
  if (forming && c.reason) note = (c.strategy || c.stratKey || 'native') + ' — ' + c.reason;
  else if (c.why) note += ' — ' + String(c.why).slice(0, 80);
  return {
    mode: mode,
    dir: c.dir,
    sym: c.sym || 'XAUUSD',
    source: source,
    grade: c.grade || '—',
    score: tally,
    maxScore: PINE_GOLD_MAX,
    factors: [{ cat: forming ? 'Forming' : 'Native', ok: true, pts: tally, note: note }],
    price: fin(+c.entry) ? +c.entry : null,
    entry: c.entry,
    stop: c.stop,
    t1: c.t1,
    t2: c.t2,
    rr: c.rr,
    planSrc: c.strategy || 'GOLD native',
    isNew: false,
    isRecent: false,
    isContext: !!forming,
    tier: forming ? 'forming' : 'native',
    atr: fin(+c.atr) ? +c.atr : null,
    familyCount: fin(+c.agree) ? +c.agree : null,
    nativeStrategy: c.strategy || c.stratKey || null,
    kind: 'native',
    /* hg-v973: the mint's own demote and advisory notes used to stop HERE --
       this adapter kept levels, grade and tally and dropped the rest, so a
       CONF NO TRADE / EDGE DEMOTE / MTF BIAS verdict, or a SPREAD WIDE read,
       never reached the card (hg-v955: a mark nothing reads is ornamental).
       Carried as a MARK: this tab's own solidity, tape and handoff-floor
       rules still decide the leader; nothing is withheld on it. */
    mintDemoted: !!c.demoted,
    mintDemotedWhy: c.demoted
      ? (c.demotedWhy || (Array.isArray(c.stamps) && c.stamps.length ? c.stamps.join(' \u00b7 ') : 'demoted by the borrowed mint'))
      : null,
    mintNotes: Array.isArray(c.notes) ? c.notes.filter(Boolean).map(String) : [],
    /* hg-v1162: the free-feed and indicator-stack marks the borrowed ranker
       made on this row (hg-v1155 / v1158) and the PAXG funding print it read
       -- this adapter dropped them with everything else it did not name.
       Absent stays absent; a row the ranker never marked is marked by the
       desk seam below (gpMarkReads), through the same one home. */
    freeReads: (c.freeReads && typeof c.freeReads === 'object') ? c.freeReads : undefined,
    indReads: (c.indReads && typeof c.indReads === 'object') ? c.indReads : undefined,
    fundingPct: (typeof c.fundingPct === 'number' && isFinite(c.fundingPct)) ? c.fundingPct : undefined
  };
}

/* hg-v1162: THE MARKS, ON EVERY ROW THIS DESK FORMS.

   GOLD PINE forms three kinds of row and only one of them passed through
   goldRankSetups: the native scalp lane is re-ranked there (and the cached
   GOLD SCALP cands already carry its marks), the native swing lane is ranked
   inside the swing mint, and the ten Pine ports (pinegoldmath.js) are scored
   by their own confluence and never see the ranker at all -- so a Pine row
   recorded nothing about what the free feeds or the indicator stack said at
   fire time, and the ledger could not ask whether any of them separates on
   this desk (hg-v955). Every row that reaches the record carries them now:
   a row the ranker already marked keeps its marks (one home, read once); a
   row without them is marked here through the SAME home -- the eight
   free-feed verdicts (hgGoldFreeFeedVerdicts, goldind.js) on the scan
   context this desk fetched, and the indicator stack (gold-catalog.js) off
   the lane's own execution tape (15m scalp, 4h swing, the daily leg beside
   it). Three states, booleans only; absent helper or absent rows mark
   nothing. Marks only: score, tier, sort order, the leader and every gate
   are untouched (asserted). */
function gpMarkReads(list, mode, bars, ctx){
  try{
    if (!Array.isArray(list) || !list.length) return 0;
    var fvFn = gfn('hgGoldFreeFeedVerdicts'), fpFn = gfn('hgGoldFreeFeedFunding');
    var irFn = gfn('hgGoldIndicatorReads'), imFn = gfn('hgGoldIndicatorMarks');
    var rows = bars ? ((mode === 'swing') ? bars.rows4h : bars.rows15m) : null;
    var ir = null;
    if (irFn && imFn && rows && rows.length){
      try{ var got = irFn(rows, { rows1d: bars.rows1d }); if (got && got.ok === true) ir = got; }catch(eIr){ ir = null; }
    }
    var fp = fpFn ? fpFn(ctx) : NaN;
    /* hg-v1165: the Pine stack on the lane's own tape */
    var psFn = gfn('pineGoldLayerStates'), pmFn = gfn('pineGoldPineMarks'), ps = null;
    if (psFn && pmFn && rows && rows.length){
      try{ var ps0 = psFn(rows); if (ps0 && ps0.ok === true) ps = ps0; }catch(ePs){ ps = null; }
    }
    var marked = 0, i, s, k, m, any;
    for (i = 0; i < list.length; i++){
      s = list[i];
      if (!s || (s.dir !== 'long' && s.dir !== 'short')) continue;
      if (s.freeReads && typeof s.freeReads === 'object') continue;   /* the ranker's own marks win */
      m = {}; any = false;
      if (fvFn){
        var fv = fvFn(ctx, s.dir);
        for (k in fv){ if (Object.prototype.hasOwnProperty.call(fv, k) && (fv[k] === true || fv[k] === false)){ m[k] = fv[k]; any = true; } }
      }
      if (ir){
        var im = imFn(ir, s.dir);
        for (k in im){ if (Object.prototype.hasOwnProperty.call(im, k) && (im[k] === true || im[k] === false)){ m[k] = im[k]; any = true; } }
        s.indReads = ir;
      }
      if (ps){
        var pm = pmFn(ps, s.dir);
        for (k in pm){ if (Object.prototype.hasOwnProperty.call(pm, k) && (pm[k] === true || pm[k] === false)){ m[k] = pm[k]; any = true; } }
        s.pineStates = ps;
      }
      if (any){ s.freeReads = m; marked++; }
      if (typeof fp === 'number' && isFinite(fp) && s.fundingPct === undefined) s.fundingPct = fp;
    }
    return marked;
  }catch(e){ return 0; }
}

function tierRank(t){
  if (t === 'primary') return 0;
  if (t === 'native') return 1;
  if (t === 'aligned') return 2;
  if (t === 'forming') return 3;
  return 4;
}

function setupKey(s){
  return (s.kind || 'x') + ':' + (s.layerLabel || s.nativeStrategy || 'conf') + ':' + s.mode + ':' + s.dir;
}

function dedupeSetups(list){
  var out = [];
  var keys = {};
  for (var i = 0; i < list.length; i++){
    var s = list[i];
    if (!s || !s.dir) continue;
    var k = setupKey(s);
    var prev = keys[k];
    if (prev){
      if (tierRank(s.tier) < tierRank(prev.tier) || (s.tier === prev.tier && +s.score > +prev.score)){
        keys[k] = s;
        for (var j = 0; j < out.length; j++){
          if (out[j] === prev){ out[j] = s; break; }
        }
      }
      continue;
    }
    keys[k] = s;
    out.push(s);
  }
  return out;
}

function sortSetups(list){
  list.sort(function(a, b){
    /* hg-v1005: a setup the fundamental stack demoted still prints but
       never leads — it sinks below every row the stack did not speak
       against, before any probability comparison. The same leadership
       exclusion GOLD SCALP's best and GOLD SWING's lead already run. */
    var ad = (a && a.demoted) ? 1 : 0, bd = (b && b.demoted) ? 1 : 0;
    if (ad !== bd) return ad - bd;
    var pr = probScore(b) - probScore(a);
    if (pr) return pr;
    var tr = tierRank(a.tier) - tierRank(b.tier);
    if (tr) return tr;
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
    return (b.score - a.score) || 0;
  });
  return list;
}

function gradeRank(g){
  if (g === 'A+') return 5;
  if (g === 'A') return 4;
  if (g === 'B') return 3;
  if (g === 'C') return 2;
  return 0;
}

function probScore(s){
  if (!s) return -1;
  var base = fin(+s.score) && fin(+s.maxScore) && s.maxScore > 0
    ? (+s.score / s.maxScore) * 100
    : (+s.score || 0);
  var form = 0;
  if (s.isNew) form += 30;
  else if (s.isRecent) form += 22;
  else if (s.tier === 'forming') form += 18;
  else if (s.tier === 'primary') form += 12;
  else if (s.tier === 'native') form += 8;
  var rr = fin(+s.rr) ? Math.min(+s.rr, 4) * 2 : 0;
  var fam = fin(+s.familyCount) ? +s.familyCount * 1.5 : 0;
  return base + form + gradeRank(s.grade) * 3 + rr + fam;
}

function topProbSetups(list, limit){
  limit = (limit > 0) ? limit : TOP_SETUPS;
  if (!list || !list.length) return [];
  return sortSetups(list.slice()).slice(0, limit);
}

/* =======================================================================
   v694: measured-edge wiring.

   GOLD PINE used to rank setups purely on a heuristic probScore
   (isNew/isRecent/tier/grade/rr/familyCount) with NO outcome evidence.
   The rest of the desk (omnigold, omniroute, reversalsniper, newgold)
   already runs the shared measured-edge loop: record fires into the
   forward log, resolve them against later candles, then veto proven
   losers (G6), auto-promote proven winners (G7), and kill the
   destructive kinds (30+ samples, expR < -0.5R).

   This section wires GOLD PINE into that SAME loop so its win rate is
   self-correcting instead of faith-based:

     * hgGpKind          — a stable (scanner, mechanic) key per setup
     * hgGpStampSolidity — attaches W.hgSolidityGrade to every setup
     * hgGpRecord        — writes each fire into the forward log
     * hgGpReorder       — buckets by solidity so proven winners lead

   Every call is feature-checked: if a helper is missing (test harness,
   load failure) GOLD PINE degrades gracefully to its prior behavior.
   ======================================================================= */

/* Stable mechanic identity for forward-log lookups. The SAME string must
   be used for recording (hgFwdRecordScan mechanic) and for the solidity
   G6/G7 lookup (opts.kind) or the two cannot be compared. */
function hgGpKind(s){
  if (!s) return 'confluence';
  if (s.layerLabel) return String(s.layerLabel);
  if (s.nativeStrategy) return String(s.nativeStrategy);
  return String(s.kind || 'confluence');
}

/* Attach a shared 7-gate solidity grade to every setup. Mirrors
   omnigold's hgOgStampSolidity. G1 families reads familyCount (native
   detectors report agree), else falls back to the factors ledger length.
   G2 live-freshness is computed from s.price (the detector's mark) via
   hgLivePriceGrade, so a setup whose price has already run past entry/T1
   or through its stop is honestly demoted (the v679 sanity check). G4
   R:R uses the house 2.0 floor + headroom. Tape (G3) is intentionally
   left unset: GOLD PINE does not compute a tape direction, so the gate
   reads 'unknown' (honest neutral) rather than a fabricated signal. */
function hgGpStampSolidity(list, mode, ctx){
  try {
    var W2 = (typeof window !== 'undefined') ? window : ((typeof globalThis !== 'undefined') ? globalThis : null);
    if (!W2 || typeof W2.hgSolidityGrade !== 'function' || !Array.isArray(list)) return;
    var spotPx = (ctx && ctx.spot && fin(+ctx.spot)) ? +ctx.spot : null;
    for (var i = 0; i < list.length; i++){
      var s = list[i];
      if (!s) continue;
      try {
        var famN = fin(+s.familyCount) ? +s.familyCount
          : (Array.isArray(s.factors) ? s.factors.length : 0);
        var planForSol = {
          dir: s.dir,
          entry: s.entry,
          stop: s.stop,
          t1: s.t1,
          t2: s.t2,
          rr1: fin(+s.rr) ? +s.rr : 0,
          consensus: { nAgree: famN },
          livePx: fin(+s.price) ? +s.price : spotPx
        };
        s.solidity = W2.hgSolidityGrade(planForSol, {
          minRr: 2.0,
          tab: 'GOLDPINE:' + mode,
          kind: hgGpKind(s)
        });
      } catch(eStamp){}
    }
  } catch(eTop){}
}

/* Record every fire that carries a plan into the forward log. The
   mechanic key must equal hgGpKind(s) so the solidity G6/G7 lookup and
   this record resolve to the same (scanner, mechanic) cell. */
/* hg-v979: `bars` is the desk's own fetch. Each lane's rows name the FEED the
   levels were priced on (bars.srcByTf, per timeframe) and the BAR the lane
   read (the last closed bar of its own series, through the one bar reader),
   so the ledger settles these on their own feed and dates them on the bar
   rather than the floor of the scan clock (hg-v978 -- whose census read the
   entry point by name and could not see this desk's alias `rec`). Absent
   stays absent: no rows, no reader, no feed -> the record as before. */
function hgGpRecord(list, mode, bars){
  try {
    var rec = gfn('hgFwdRecordScan');
    if (!rec || !Array.isArray(list) || !list.length) return 0;
    var tf = (mode === 'swing') ? '4h' : '15m';
    var rows = bars ? (mode === 'swing' ? bars.rows4h : bars.rows15m) : null;
    var feed = (bars && bars.srcByTf && typeof bars.srcByTf[tf] === 'string' && bars.srcByTf[tf]) ? bars.srcByTf[tf] : undefined;
    var barMs = (rows && rows.length && typeof W.hgGoldSignalBarMs === 'function') ? W.hgGoldSignalBarMs(rows) : NaN;
    var barT = (typeof barMs === 'number' && isFinite(barMs) && barMs > 0) ? Math.floor(barMs / 1000) : undefined;
    var cands = [];
    for (var i = 0; i < list.length; i++){
      var s = list[i];
      if (!s || !s.dir || !fin(+s.entry) || !fin(+s.stop)) continue;
      cands.push({
        mechanic: hgGpKind(s),
        sym: 'XAUUSD',
        dir: s.dir,
        entry: +s.entry,
        stop: +s.stop,
        t1: +s.t1,
        feed: feed,   /* hg-v979 */
        /* hg-v980: the detector's mark (s.price) -- the price the setup was
           judged at; absent stays absent */
        mark: (fin(+s.price) && +s.price > 0) ? +s.price : undefined,
        barT: barT,   /* hg-v979: the lane's own signal bar */
        /* hg-v1162: the free-feed + indicator-stack marks and the funding
           print, for the ledger's read split and funding split */
        reads: (s.freeReads && typeof s.freeReads === 'object') ? s.freeReads : undefined,
        fundingPct: (typeof s.fundingPct === 'number' && isFinite(s.fundingPct)) ? s.fundingPct : undefined,
        sol: (s.solidity && fin(+s.solidity.score)) ? +s.solidity.score : undefined,
        solTier: (s.solidity && s.solidity.grade) ? s.solidity.grade : undefined
      });
    }
    if (!cands.length) return 0;
    return rec('GOLDPINE:' + mode, tf, cands, { horizonBars: (mode === 'swing') ? 6 : 12 });
  } catch(e){ return 0; }
}

/* Bucket-sort by solidity so PRIME/SOLID/GOOD lead, MIXED follows, THIN/
   WEAK and KILLED sink / drop. Preserves probScore order within a bucket
   so the existing ranker still resolves ties. Returns the reordered array
   with a non-enumerable .killedCount prop (from hgSolidityReorder). */
function hgGpReorder(list){
  try {
    var W2 = (typeof window !== 'undefined') ? window : ((typeof globalThis !== 'undefined') ? globalThis : null);
    if (!W2 || typeof W2.hgSolidityReorder !== 'function' || !Array.isArray(list)) return list;
    return W2.hgSolidityReorder(list, { tab: 'GOLDPINE' });
  } catch(e){ return list; }
}

function collectNativeScalp(bars, ctx, source){
  var out = [];
  var cached = null;
  try{ var sc = gfn('goldscalpScan'); if (sc) cached = sc(); }catch(e0){}
  if (cached && Array.isArray(cached.cands) && cached.cands.length){
    for (var ci = 0; ci < cached.cands.length && out.length < 6; ci++){
      var s0 = setupFromNative(cached.cands[ci], 'scalp', source, false);
      if (s0) out.push(s0);
    }
    if (out.length) return out;
  }
  var fn = gfn('goldScalpSetups');
  var rankFn = gfn('goldRankSetups');
  if (!fn || !bars.rows15m || bars.rows15m.length < 30) return out;
  var got = null;
  try{
    var scInp = { rows15m: bars.rows15m, rows1h: bars.rows1h, rows4h: bars.rows4h,
      /* hg-v973: the daily bars this desk already fetched (the MTF matrix's
         Daily leg was unchecked here), the feed label (the mint distrusts
         PAXG / XAUT volume only when told which feed it is on), and the 15m
         signal bar as the instant */
      dailyCandles: (bars.rows1d && bars.rows1d.length) ? bars.rows1d : undefined,
      candleSource: bars.source || undefined,
      now: gpMintBarMs(bars.rows15m, ctx.now || Date.now()), news: ctx.news || null,
      /* hg-v972: this desk fetched the macro snapshot for its own scoring and
         dropped it at this seam, so the borrowed mint ran its DXY+TNX lock
         unchecked. The desk's own read goes first; the shared feed below
         fills it only when this is null. */
      macro: ctx.macro || null };
    try{ var apS = gfn('hgGoldApplyLiveFeed'); if (apS && bars.live) apS(scInp, bars.live); }catch(eAp){}   /* hg-v971 */
    got = fn(scInp);
  }catch(e){ return out; }
  if (!Array.isArray(got)) return out;
  var ranked = got;
  var rejected = got.rejected || [];
  if (rankFn){
    try{
      /* hg-v1026: the cands are GOLD SCALP mechanics (goldScalpSetups), whose
         measured edge lives in the SOURCE desk's ledger keyed by stratKey.
         Thread that tab so the measured-edge veto v1024 added to
         goldRankSetups also holds on this re-rank — a measured-losing scalp
         mechanic can never crown the GOLD PINE view either. */
      var rk = rankFn(got, Object.assign({}, ctx, { scanner: 'GOLDSCALP' }));
      ranked = rk && rk.ranked ? rk.ranked : got;
      if (rk && rk.rejected) rejected = rejected.concat(rk.rejected);
    }catch(e2){}
  }
  for (var i = 0; i < ranked.length && out.length < 6; i++){
    var s = setupFromNative(ranked[i], 'scalp', source, false);
    if (s) out.push(s);
  }
  for (var r = 0; r < rejected.length && out.length < 8; r++){
    var rf = setupFromNative(rejected[r], 'scalp', source, true);
    if (rf && fin(+rf.entry) && fin(+rf.stop)) out.push(rf);
  }
  return out;
}

function collectNativeSwing(bars, ctx, source){
  var out = [];
  var cached = null;
  try{ var sw = gfn('goldswingScan'); if (sw) cached = sw(); }catch(e0){}
  if (cached && Array.isArray(cached.cands) && cached.cands.length){
    for (var ci = 0; ci < cached.cands.length && out.length < 6; ci++){
      var s0 = setupFromNative(cached.cands[ci], 'swing', source, false);
      if (s0) out.push(s0);
    }
    if (out.length) return out;
  }
  var fn = gfn('goldswingCollectCandidates');
  if (!fn || !bars.rows4h || bars.rows4h.length < 60) return out;
  var leg = { rows4h: bars.rows4h, rows1d: bars.rows1d, rows1h: bars.rows1h };
  var got = null;
  try{
    /* hg-v973: this lane handed the route bars, a wall clock and the raw
       snapshot, and nothing else -- so the swing mint ran here without the
       news gate, the quote, the book or its venue. It is fed the way GOLD
       DIRECTION's swing lane is: the desk's own news + macro, the shared
       live feed where the input carries nothing, and the 4h signal bar. */
    var swCtx = Object.assign({}, ctx, { now: gpMintBarMs(bars.rows4h, ctx.now || Date.now()),
      news: ctx.news || null, macro: ctx.macro || null,
      /* hg-v1162: the ranker reads the indicator stack off rows15m || rows;
         the swing lane's execution tape is the 4h leg, so the 15m one is
         withheld here and the 4h one named */
      rows15m: undefined, rows: bars.rows4h });
    try{ var apW = gfn('hgGoldApplyLiveFeed'); if (apW && bars.live) apW(swCtx, bars.live); }catch(eAp){}
    got = fn(leg, swCtx);
  }catch(e){ return out; }
  if (!Array.isArray(got)) return out;
  for (var i = 0; i < got.length && out.length < 6; i++){
    var s = setupFromNative(got[i], 'swing', source, false);
    if (s) out.push(s);
  }
  return out;
}

function collectPineUniverse(bars, mode, scanOpts, source){
  var uniFn = gfn('pineGoldUniverse');
  if (typeof uniFn !== 'function') return [];
  var rows = mode === 'swing' ? bars.rows4h : bars.rows15m;
  var htf = mode === 'swing' ? bars.rows1d : (bars.rows1h || bars.rows4h);
  var min = mode === 'swing' ? 60 : 30;
  if (!rows || rows.length < min) return [];
  var u = uniFn(rows, Object.assign({ mode: mode, htfRows: htf }, scanOpts));
  var list = [];
  (u.setups || []).forEach(function(item){
    var s = setupFromUniverseItem(item, mode, source);
    if (s) list.push(s);
  });
  /* hg-v1164: the record-only layers, on the same series, after the ten */
  list = list.concat(gpRecordLayerSetups(rows, mode, source));
  return list;
}

/* =======================================================================
   hg-v1164: RECORD-ONLY PINE LAYERS, AND THE ONE WAY OUT OF RECORD-ONLY.

   pinegoldmath.js mints the five new layers (Supertrend, Ichimoku TK cross,
   Donchian 20/10, EMA 8/21 + RSI50, Keltner pullback) in a table of their
   own and stamps them record-only + demoted. This desk carries them across
   the setupFromEval seam (which names what it keeps and drops the rest --
   the hg-v955 seam, so the stamp is re-applied here from the item), writes
   them into the ledger like any other row (hgGpRecord, mechanic = the layer
   label, pool GOLDPINE:<mode>), prints their levels, and WITHHOLDS the two
   handoffs and the MOST PROBABLE pin.

   The release is a measurement, not a switch: hgFwdStats for that mechanic
   on that lane, read through hgFwdJudgeSample (the one judge every desk's
   measured-edge gate reads, hg-v982), at the house floor HG_GOLD_FWD_MIN_JUDGE
   -- at or over the floor AND paying (expectancy over zero on the sample the
   judge chose, fill-aware when that clears the floor on its own) releases the
   row: it forms like the ten layers above it. Measured and not paying stays
   record-only and says so; under the floor says how far. With no ledger
   loaded nothing can be measured and nothing is released. The solidity
   grader's G6 / KILLED still read the same pool, so a layer that measures
   badly is vetoed or removed exactly as any other kind. */
function gpRecordFloor(){
  var f = +W.HG_GOLD_FWD_MIN_JUDGE;
  return (isFinite(f) && f > 0) ? f : 20;
}
function gpRecordLayerJudge(s, mode){
  /* hg-v1166: ONE home -- pineGoldRecordJudge (pinegoldmath.js) is the rule
     GOLD SCALP and GOLD SWING read for the same layers; a second copy here
     would be a second rule (hg-v949). The pool and mechanic are this desk's. */
  if (!s) return s;
  var fn = gfn('pineGoldRecordJudge');
  if (typeof fn !== 'function'){ s.recordJudge = { n: 0, expR: NaN, floor: gpRecordFloor(), fillAware: false, measured: false, paying: false, unfilled: 0 }; return s; }
  return fn(s, 'GOLDPINE:' + mode, hgGpKind(s));
}
function gpRecordLayerSetups(rows, mode, source){
  var out = [];
  try{
    var fn = gfn('pineGoldRecordLayerSetups');
    if (typeof fn !== 'function' || !rows || !rows.length) return out;
    var items = fn(rows, mode) || [];
    for (var i = 0; i < items.length; i++){
      var it = items[i];
      if (!it || !it.recordOnly) continue;
      var s = setupFromUniverseItem(it, mode, source);
      if (!s) continue;
      s.recordOnly = true;
      s.recordLayer = it.recordLayer || null;
      s.recordTwin = it.recordTwin || null;
      s.demoted = true;
      s.demotedWhy = it.demotedWhy || ('RECORD ONLY \u2014 ' + hgGpKind(s) + ' has no measured record on this desk');
      gpRecordLayerJudge(s, mode);
      out.push(s);
    }
  }catch(e){}
  return out;
}
/** The rows the MOST PROBABLE pin may choose from: never a record-only one. */
function gpMayLead(s){ return !!(s && !s.recordOnly && !s.pineBlock); }
function gpSgnR(v){ return (isFinite(v) ? ((v >= 0 ? '+' : '\u2212') + Math.abs(v).toFixed(3)) : '?') + 'R'; }
function gpRecordTwinLine(s){
  if (!s || !s.recordTwin) return '';
  var fn = gfn('hgGoldSiblingRecord');
  var rec = (fn && s.recordLayer) ? fn(s.recordLayer) : null;
  if (!rec) return ' Nearest OMNIGOLD mechanic ' + esc(String(s.recordTwin)) + ': no gate-clear record to quote.';
  return ' Nearest measured twin: OMNIGOLD ' + esc(String(rec.twin)) + ', gate-clear n=' + rec.n + ', ' + rec.settled + ' settled, '
    + gpSgnR(rec.netXm) + ' net at XM, z ' + (fin(+rec.zBreakeven) ? ((+rec.zBreakeven >= 0 ? '+' : '\u2212') + Math.abs(+rec.zBreakeven).toFixed(2)) : '?')
    + ' \u2014 OMNIGOLD\u2019s gates and 1h horizon, not this desk\u2019s record.';
}
function gpRecordChipHtml(s){
  if (!s) return '';
  var j = s.recordJudge || {};
  if (s.recordReleased) return ' <span class="gpip" title="released by the forward ledger: ' + j.n + ' settled at ' + gpSgnR(j.expR) + (j.fillAware ? ' (fill-aware)' : '') + '">MEASURED \u00b7 ' + j.n + ' settled ' + gpSgnR(j.expR) + '</span>';
  if (!s.recordOnly) return '';
  return ' <span class="gpip" title="' + esc(String(s.demotedWhy || 'record only')) + '">RECORD ONLY \u00b7 ' + (j.measured ? ('measured ' + j.n + ' at ' + gpSgnR(j.expR)) : (j.n + ' of ' + j.floor + ' settled')) + '</span>';
}
function gpRecordNoteHtml(s){
  var j = s.recordJudge || {};
  var floor = fin(+j.floor) ? +j.floor : gpRecordFloor();
  return '<div class="note warn" style="margin-top:8px">NO TRADE HANDOFF \u2014 RECORD ONLY. ' + esc(hgGpKind(s))
    + ' is a new Pine layer with no measured record on this desk: '
    + (j.measured ? ('measured ' + j.n + ' settled at ' + gpSgnR(j.expR) + ', not paying') : (j.n + ' of ' + floor + ' settled'))
    + '. Every signal bar is recorded under GOLDPINE:' + esc(String(s.mode || 'swing'))
    + '; the handoff and the MOST PROBABLE pin open only when the ledger reads it paying at or over ' + floor
    + ' settled. The levels are shown to be read, not sent.' + gpRecordTwinLine(s) + '</div>';
}

/* hg-v950: the shared gold calendar, read from a SERIES' last closed bar,
   because a GOLD PINE setup carries no instant of its own. Delegates to
   hgGoldSignalBarMs and hgGoldWeekendVerdict; null when either is absent or
   the series is empty, and the caller then changes nothing. */
function gpWeekendVerdict(rows){
  try{
    if (!rows || !rows.length) return null;
    var barFn = gfn('hgGoldSignalBarMs');
    var vFn = gfn('hgGoldWeekendVerdict');
    if (typeof vFn !== 'function') return null;
    var ms = (typeof barFn === 'function') ? barFn(rows) : NaN;
    if (!isFinite(+ms)) return null;
    var v = vFn(ms);
    return (v && v.inWeekend === true) ? v : null;
  }catch(e){ return null; }
}

function runGoldPineScan(bars, ctx){
  ctx = ctx || {};
  var lvFn = gfn('pineGoldLevelsFromBars');
  if (typeof gfn('pineGoldUniverse') !== 'function' && typeof gfn('pineGoldConfluence') !== 'function'){
    return { swing: [], scalp: [], error: 'pinegoldmath' };
  }

  /* v694: settle open forward records against fresh candles BEFORE
     recording this scan's fires. Mirrors omnigold's resolve-at-scan-start
     so the measured-edge stats reflect real outcomes, not stale opens. */
  try {
    var fwdResolve = gfn('hgFwdResolve');
    if (fwdResolve){
      /* hg-v979: each against its own feed */
      if (bars.rows4h && bars.rows4h.length) fwdResolve('XAUUSD', '4h', bars.rows4h, bars.srcByTf && bars.srcByTf['4h']);
      if (bars.rows15m && bars.rows15m.length) fwdResolve('XAUUSD', '15m', bars.rows15m, bars.srcByTf && bars.srcByTf['15m']);
    }
  } catch(eResolve){}

  var levels = lvFn ? lvFn(bars.rows1d, bars.rows15m) : {};
  var source = SRC_LABEL[bars.source] || bars.source || 'GOLD';
  /* hg-v1161: a feed moved onto the IUX anchor says so; the label is derived, never typed */
  try{ var ixf = gfn('hgGoldIuxFeedLabel'); if (ixf) source = ixf(bars.source, source); }catch(eIx){}
  var macro = ctx.macro || null;
  var spot = ctx.spot || null;
  try{
    if (!spot){
      var gs = gfn('goldspotState');
      if (gs) spot = gs();
    }
  }catch(e){}

  var swing = [];
  var scalp = [];
  var scanOpts = { macro: macro, spot: spot, levels: levels };

  swing = swing.concat(collectPineUniverse(bars, 'swing', scanOpts, source));
  scalp = scalp.concat(collectPineUniverse(bars, 'scalp', scanOpts, source));

  /* hg-v1162: the free feeds this desk fetches ride the scan context, so the
     borrowed ranker (native scalp lane) scores by them exactly as GOLD SCALP
     does -- the hg-v972 shape: parity with the home desk's mint, not a new
     rule -- and the desk seam marks the Pine rows with the same verdicts.
     The tapes ride too: the ranker computes the indicator stack off
     rows15m (the daily leg beside it) and the PERFECT predicate reads
     rows4h + perpNative. Absent stays absent. */
  var scanCtx = { macro: macro, spot: spot, now: Date.now(), news: null,
    fng: (ctx.fng && typeof ctx.fng === 'object') ? ctx.fng : undefined,
    fundingRate: (typeof ctx.fundingRate === 'number' && isFinite(ctx.fundingRate)) ? ctx.fundingRate : undefined,
    perpNative: ctx.perpNative || undefined,
    cot: (ctx.cot && typeof ctx.cot === 'object') ? ctx.cot : undefined,
    rows15m: bars.rows15m, rows1h: bars.rows1h, rows4h: bars.rows4h, rows1d: bars.rows1d };
  try{
    var ns = gfn('hgNewsState');
    if (ns) scanCtx.news = ns();
  }catch(eN){}
  swing = swing.concat(collectNativeSwing(bars, scanCtx, source));
  scalp = scalp.concat(collectNativeScalp(bars, scanCtx, source));

  swing = sortSetups(dedupeSetups(swing.filter(Boolean)));
  scalp = sortSetups(dedupeSetups(scalp.filter(Boolean)));

  /* hg-v1162: every row carries the marks before it is recorded */
  gpMarkReads(swing, 'swing', bars, scanCtx);
  gpMarkReads(scalp, 'scalp', bars, scanCtx);

  /* v694: stamp solidity, record fires, then reorder so proven-winning
     kinds lead and proven-losing kinds are vetoed/killed. The reordered
     arrays carry a non-enumerable .killedCount for the UI's killed note. */
  hgGpStampSolidity(swing, 'swing', scanCtx);
  hgGpStampSolidity(scalp, 'scalp', scanCtx);
  hgGpRecord(swing, 'swing', bars);
  hgGpRecord(scalp, 'scalp', bars);
  swing = hgGpReorder(swing);
  scalp = hgGpReorder(scalp);

  /* v728: SMC context (record-only). Swing rows read the 4h leg, scalp rows
     the 15m leg — the same candles each list was formed on. Adds row.smc and
     one Setup Intelligence signal; never touches score, tier, sort order,
     filtering or visibility. Feature-checked so a harness without
     smc-setups.js loaded behaves exactly as before. */
  try {
    if (bars && typeof W.hgSmcEnrich === 'function'){
      for (var gsi = 0; gsi < swing.length; gsi++){
        if (swing[gsi]) W.hgSmcEnrich(swing[gsi], { rows: bars.rows4h, tab: 'GOLDPINE:swing' });
      }
      for (var gci = 0; gci < scalp.length; gci++){
        if (scalp[gci]) W.hgSmcEnrich(scalp[gci], { rows: bars.rows15m, tab: 'GOLDPINE:scalp' });
      }
    }
  } catch(eSmc){}

  /* The tape belongs to the SCAN, not to the paint: goldPineScan() is what
     every other consumer reads, so the verdict travels with the rows. Swing
     against the 4H leg, scalp against the 15m one — the same candles each
     list was formed on, the same split hgSmcEnrich uses just above. */
  var tapeSwing = gpTapeOf(bars && bars.rows4h);
  var tapeScalp = gpTapeOf(bars && bars.rows15m);
  gpTapeStamp(swing, tapeSwing);
  gpTapeStamp(scalp, tapeScalp);

  /* hg-v950: did the bar these setups were read on print while GOLD WAS
     SHUT? PER MODE, from that mode's own last closed bar — swing evaluates
     on 4h and scalp on 15m, so one instant for both would mislabel one of
     them. These setups carry no timestamp of their own, which is why the
     instant comes from the series rather than from the setup. Null when the
     calendar or the bars cannot be read, and then nothing changes. */
  var gpShutSwing = gpWeekendVerdict(bars.rows4h);
  var gpShutScalp = gpWeekendVerdict(bars.rows15m);
  var gpI;
  for (gpI = 0; gpI < swing.length; gpI++) if (swing[gpI]) swing[gpI].goldShut = gpShutSwing;
  for (gpI = 0; gpI < scalp.length; gpI++) if (scalp[gpI]) scalp[gpI].goldShut = gpShutScalp;

  /* hg-v1005: THE FUNDAMENTAL STACK, at the scan seam every other gold desk
     runs it at. A red-folder blackout refuses fresh formations outright —
     the sections print empty with the reason named and the stood-down count
     carried for the board, mirroring the entry veto GOLD SCALP runs and the
     no-mint lock GOLD SWING runs. An unchecked calendar answers false and
     refuses nothing (a dark board blocks nothing). Outside a blackout the
     shared per-candidate pass demotes a setup the stack stands decisively
     against (s.demoted + the stamp + the gate note, and the compact
     s.fundGate the card chip reads) — it still prints and is still
     recorded, sunk below every clean row by sortSetups. */
  var fundBlackout = false;
  try{
    var fbFn = gfn('hgFundamentalBlackout');
    if (fbFn) fundBlackout = fbFn('XAUUSD') === true;
  }catch(eFB){ fundBlackout = false; }
  if (fundBlackout){
    return { swing: [], scalp: [], levels: levels, source: source,
             goldShut: { swing: gpShutSwing, scalp: gpShutScalp },
             tape: { swing: tapeSwing, scalp: tapeScalp }, at: Date.now(),
             fundBlackout: true, fundStoodDown: swing.length + scalp.length };
  }
  try{
    var fsFn = gfn('hgFundamentalScanCands');
    if (fsFn){
      fsFn(swing, { scanner: 'goldpine' });
      fsFn(scalp, { scanner: 'goldpine' });
      /* the demotes land after the first ordering, so order once more —
         sortSetups sinks a demoted row below every clean one */
      swing = sortSetups(swing);
      scalp = sortSetups(scalp);
    }
  }catch(eFS){}
  try{
    var blk = gfn('pineGoldBlocksLead'), stFn = gfn('pineGoldLayerStates');
    function holdPine(list, rows){
      if (!blk || !stFn || !rows || !list) return;
      var ps = stFn(rows);
      if (!ps || ps.ok !== true) return;
      for (var z = 0; z < list.length; z++){
        if (!list[z] || list[z].recordOnly) continue;
        var why = blk(ps, list[z].dir);
        if (!why) continue;
        list[z].pineBlock = why;
        list[z].demoted = true;
        list[z].demotedWhy = why;
      }
    }
    holdPine(swing, bars && bars.rows4h);
    holdPine(scalp, bars && bars.rows15m);
    if (typeof W.hgGoldInstApply === 'function'){
      W.hgGoldInstApply(scalp, bars && bars.rows15m, macro, { desk: 'goldpine', horizon: 'scalp' });
      W.hgGoldInstApply(swing, bars && bars.rows15m, macro, { desk: 'goldpine', horizon: 'swing' });
    }
    swing = sortSetups(swing);
    scalp = sortSetups(scalp);
  }catch(ePB){}
  return { swing: swing, scalp: scalp, levels: levels, source: source,
           goldShut: { swing: gpShutSwing, scalp: gpShutScalp },
           tape: { swing: tapeSwing, scalp: tapeScalp }, at: Date.now(),
           /* hg-v1162: the context the marks were read on, for the one
              catalog census the board paints */
           catalogCtx: scanCtx };
}

/* hg-v1162: the two read lines on a card -- gold-catalog.js owns the
   indicator-stack renderer, goldind.js the free-feed one; this desk hands
   each the row's own fields. A row with no reads prints nothing. */
function gpReadsHtml(s){
  try{
    if (!s) return '';
    var h = '';
    var ff = gfn('hgGoldFreeFeedLineHtml');
    if (ff && s.freeReads && typeof s.freeReads === 'object') h += ff(s.freeReads, { fundingPct: s.fundingPct }) || '';
    var st = gfn('hgGoldIndicatorStackHtml');
    if (st && s.indReads) h += st(s.indReads, s.freeReads) || '';
    var pn = gfn('pineGoldStackLineHtml');   /* hg-v1165 */
    if (pn && s.pineStates) h += pn(s.pineStates, s.freeReads) || '';
    return h;
  }catch(e){ return ''; }
}
/* hg-v1162: the Gold Master Catalog census, ONCE on the board, handed the
   scan context the marks were read on (COT from the window beside it, as
   GOLD SCALP does) and the leader's indicator reads -- so USED means read
   this scan. The first GOLD SCALP cut painted two censuses with two USED
   numbers (hg-v1158); this desk paints exactly one. */
function gpCatalogHtml(result, bars){
  try{
    var cFn = gfn('hgGoldCatalogHtml'), cEn = gfn('hgGoldCatalogEngine');
    if (!cFn || !cEn || !result) return '';
    var cx = result.catalogCtx || null;
    if (cx && !cx.cot && W.__hgGoldCot) cx = Object.assign({}, cx, { cot: W.__hgGoldCot });
    var lead = (result.scalp && result.scalp[0]) || (result.swing && result.swing[0]) || null;
    var rows = (bars && bars.rows15m && bars.rows15m.length) ? bars.rows15m : ((bars && bars.rows4h) || []);
    return cFn(cEn(rows, { ctx: cx, ind: (lead && lead.indReads) || null, killzone: '' })) || '';
  }catch(e){ return ''; }
}

function factorsHTML(factors){
  if (!factors || !factors.length) return '';
  var byCat = {};
  factors.forEach(function(f){
    if (!f.ok) return;
    byCat[f.cat] = byCat[f.cat] || [];
    byCat[f.cat].push(f.note);
  });
  var parts = [];
  Object.keys(byCat).forEach(function(cat){
    parts.push('<b>' + esc(cat) + '</b>: ' + esc(byCat[cat].join(' · ')));
  });
  return parts.join('<br>');
}

/* THE GOLD TAPE, WHICH THIS TAB DID NOT READ.

   GOLD SCALP, GOLD SWING, OMNIGOLD and GOLD DIRECTION all read one shared
   gold tape (hgGoldUniformTape in gold-catalog.js: last close vs EMA21 AND
   EMA21 vs EMA50 on their own rows) and hold anything pointing the other
   way. The rule is stated outright in AGENTS.md: against-tape plans are
   stamped AGAINST GOLD TAPE · HELD and are never MOST PROBABLE, SETUP
   ACTIVATED or CONFIRMED COMBINED.

   GOLD PINE never called it. Measured by feeding the whole gold family one
   synthetic tape and sweeping what each tab renders, it pinned

     MOST PROBABLE SETUP · XAUUSD LONG · GOOD 66 · GOLDPINE · LEADER
     This is the ranked leader on GOLDPINE. Levels are the live ticket.
     ENTRY 3671.14 ...

   on a tape reading SHORT, and on the mirrored bars pinned a SHORT leader
   on a tape reading LONG. Not a bias — it simply had no tape in its path,
   so its leader was whatever scored highest.

   The side is read per horizon, not blended: the swing rows are judged
   against the 4H tape and the scalp rows against the 15m one, which is the
   same leg each sibling desk uses for its own half. An unread tape (a thin
   or flat stack, or fewer than 55 bars) holds nothing, so this can only
   ever remove a claim, never invent one. */
function gpTapeOf(rows){
  var fn = (typeof W.hgGoldUniformTape === 'function') ? W.hgGoldUniformTape : null;
  if (!fn || !Array.isArray(rows) || !rows.length) return '';
  try{ return String(fn(rows) || '').toLowerCase(); }catch(e){ return ''; }
}

function gpTapeStamp(list, tape){
  if (!Array.isArray(list)) return;
  for (var i = 0; i < list.length; i++) if (list[i]) list[i].goldTape = tape;
}

/** Same two chips GOLD SCALP and GOLD SWING print, on the same wording. */
function gpTapeChipHtml(s){
  var t = String((s && s.goldTape) || '').toLowerCase();
  var d = String((s && s.dir) || '').toLowerCase();
  if ((t !== 'long' && t !== 'short') || (d !== 'long' && d !== 'short')) return '';
  return d === t
    ? '<span class="gpip ok">WITH GOLD TAPE</span>'
    : '<span class="gpip">AGAINST GOLD TAPE \u00b7 HELD</span>';
}

/* hg-v1005: the fundamental-stack verdict chip — the same .gpip the other
   gold desks print, fed by the compact fundGate the scan-time pass stamped
   (refuse / demote / chips). '' when the stack saw nothing to say. */
function gpFundChipHtml(s){
  try{
    var fn = gfn('hgFundamentalChipHtml');
    var g = s && s.fundGate;
    if (!fn || !g || !Array.isArray(g.chips) || !g.chips.length) return '';
    return fn(g) || '';
  }catch(e){ return ''; }
}

/* The full gold fundamental board — the same panel every gold desk shows,
   rendered above the sections so the reader sees sentiment, positioning,
   real rates, COT and the calendar beside the formations. */
function gpFundPanelHtml(){
  try{
    var rFn = gfn('hgFundamentalRegime'), pFn = gfn('hgFundamentalPanelHtml');
    if (!rFn || !pFn) return '';
    return pFn(rFn('gold')) || '';
  }catch(e){ return ''; }
}

/* hg-v973: the borrowed mint's verdicts, READ. A demote the mint applied
   (CONF NO TRADE, EDGE DEMOTE, MTF BIAS, ...) is named on the card; an
   advisory it wrote (SPREAD WIDE / L2 READ on a proxy venue) is printed once.
   Neither moves this tab's leader -- that is a policy this pack does not set. */
function gpMintMarkChipHtml(s){
  if (!s || !s.mintDemoted) return '';
  var why = String(s.mintDemotedWhy || 'demoted by the borrowed mint');
  return ' <span class="gpip" title="' + esc(why) + '">MINT DEMOTED \u00b7 ' + esc(why.length > 48 ? why.slice(0, 45) + '\u2026' : why) + '</span>';
}
function gpMintNotesHtml(s){
  var notes = (s && Array.isArray(s.mintNotes)) ? s.mintNotes : [];
  if (!notes.length) return '';
  return '<div class="note" style="margin-top:4px;font-size:11px">' + notes.map(function(n){ return esc(n); }).join('<br>') + '</div>';
}

/** The rows that may lead. Cards still render either way — this only
    decides what the MOST PROBABLE pin is allowed to choose from. */
function gpTapeAligned(list){
  var out = [], i, s, t, d;
  for (i = 0; i < (list || []).length; i++){
    s = list[i];
    if (!s) continue;
    t = String(s.goldTape || '').toLowerCase();
    d = String(s.dir || '').toLowerCase();
    if (t !== 'long' && t !== 'short'){ out.push(s); continue; }
    if (d === t) out.push(s);
  }
  return out;
}

function cardHTML(s, rank){
  var tier = (s.tier === 'forming' || s.isRecent) ? 'forming'
    : ((s.tier === 'aligned' || s.isContext) ? 'near' : 'clean');
  if (typeof W.hgSetupPanelHTML === 'function' && (s.tier === 'forming' || s.isRecent || s.isContext)){
    var sig = {
      sym: 'XAUUSD', dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1, t2: s.t2,
      price: s.price, planSrc: s.planSrc || 'Gold Pine', isNew: s.isNew, isRecent: s.isRecent,
      isContext: s.isContext, tier: s.tier, scriptLabel: (s.mode === 'swing' ? 'GOLD PINE SWING' : 'GOLD PINE SCALP')
    };
    var html = W.hgSetupPanelHTML(sig, { scanner: 'goldpine', label: sig.scriptLabel });
    if (rank) html = html.replace('</h2>', ' <span class="stamp pass">#' + rank + ' PICK</span></h2>');
    /* v728: SMC context chip in the shared panel head. Empty string when
       smc-setups.js is absent or the row carries no .smc — html untouched. */
    try{
      if (typeof W.hgSmcChipHtml === 'function'){
        var smcHead = W.hgSmcChipHtml(s) || '';
        if (smcHead) html = html.replace('</h2>', ' ' + smcHead + '</h2>');
      }
    }catch(eSmcP){}
    var tapeHead = gpTapeChipHtml(s);
    if (tapeHead) html = html.replace('</h2>', ' ' + tapeHead + '</h2>');
    /* hg-v1162: the read lines, inside the shared panel */
    var sharedReads = gpReadsHtml(s);
    if (sharedReads) html = html.replace(/<\/div>\s*$/, sharedReads + '</div>');
    return html;
  }
  var cls = s.dir === 'long' ? 'long' : 'short';
  var rankBadge = rank ? '<span class="stamp pass" style="margin-left:6px">#' + rank + ' PICK</span>' : '';
  var badge = s.isNew ? '<span class="stamp pass" style="margin-left:6px">NEW</span>'
    : (s.isRecent ? '<span class="stamp" style="margin-left:6px">RECENT</span>'
      : (s.tier === 'native' ? '<span class="stamp pass" style="margin-left:6px">NATIVE</span>'
        : (s.tier === 'forming' ? '<span class="stamp" style="margin-left:6px">FORMING</span>'
          : ((s.isContext || s.tier === 'aligned') ? '<span class="stamp" style="margin-left:6px">ALIGNED</span>' : ''))));
  var tierNote = s.tier === 'primary' ? ' · PRIMARY' : (s.tier === 'native' ? ' · NATIVE'
    : (s.tier === 'forming' ? ' · FORMING' : (s.tier === 'aligned' ? ' · WATCH' : '')));
  var modeLabel = s.mode === 'swing' ? 'SWING · 4H' : 'SCALP · 15m';
  if (s.layerLabel) modeLabel += ' · ' + esc(s.layerLabel);
  else if (s.nativeStrategy) modeLabel += ' · ' + esc(s.nativeStrategy);
  var gpStack = s.stack;
  if (!gpStack && typeof W.hgSetupStackForPineSig === 'function'){
    try{
      gpStack = W.hgSetupStackForPineSig({
        sym: 'XAUUSD', dir: s.dir, isNew: s.tier === 'primary' || s.tier === 'native',
        isRecent: s.isRecent, isContext: s.isContext || s.tier === 'aligned', tier: s.tier
      }, { style: 'goldpine', asset: 'gold' });
    }catch(eGp){}
  }
  var gpStackHtml = (gpStack && typeof W.hgSetupStackMiniHtml === 'function') ? W.hgSetupStackMiniHtml(gpStack) : '';
  /* v694: SOLIDITY chip with a per-gate tooltip (5-7 gate reasons). */
  var solChip = (s.solidity && typeof W.hgSolidityChipHtml === 'function')
    ? W.hgSolidityChipHtml(s.solidity) : '';
  /* v728: SMC context chip — '' when smc-setups.js is absent or s.smc unset. */
/* THE HANDOFF FLOOR, WHICH THIS TAB DID NOT HAVE.

   Every other gold desk refuses to hand a setup over below a minimum reward
   for the risk: GOLD SCALP floors at HG_GOLD_SCALP_MIN_RR, GOLD SWING at
   HG_GOLD_SWING_MIN_RR, and the shared plan layer states the rule outright —
   a structural target below the floor REJECTS rather than pushing T1 out to
   meet it. GOLD PINE emitted SEND TO TRADE PLAN and ADD TO BOOK on every card
   it drew, with no reward test anywhere in the path.

   What that looks like in practice, caught by reading what this tab actually
   renders: a PRIMARY pick, stamped SOLIDITY GOOD, carrying both buttons, at

     ENTRY 4050.62 · SL 4069.90 · T1 4045.59     R:R 0.26

   — 19.28 points of risk for 5.03 of reward. SOLIDITY did not miss it; its
   R:R gate is one of seven and a card can fail it and still score GOOD. A
   score out of seven is a summary, not a floor, and this tab had no floor.

   So: below the floor the card STAYS — the levels are worth reading and the
   sibling desks keep demoted cards visible too — but the two action buttons
   are replaced by a line naming the number, the floor and the shortfall. A
   setup whose reward cannot be measured at all is left exactly as it was:
   unmeasured is not a failing grade anywhere else in this desk and it is not
   one here.

   The floors are read from the globals at call time so this tab tracks the
   house rather than carrying its own copy of a number that can drift. */
function gpHandoffFloor(mode){
  var scalp = fin(+W.HG_GOLD_SCALP_MIN_RR) ? +W.HG_GOLD_SCALP_MIN_RR : 1.2;
  var swing = fin(+W.HG_GOLD_SWING_MIN_RR) ? +W.HG_GOLD_SWING_MIN_RR : 1.5;
  return (String(mode) === 'scalp') ? scalp : swing;
}
function gpHandoffBlock(s){
  var rr = fin(+s.rr) ? +s.rr : NaN;
  if (!isFinite(rr)) return null;            /* unmeasured is not a veto */
  var floor = gpHandoffFloor(s.mode);
  if (rr >= floor) return null;
  return { rr: rr, floor: floor };
}

  var smcChip = '';
  try{ if (typeof W.hgSmcChipHtml === 'function') smcChip = W.hgSmcChipHtml(s) || ''; }catch(eSmcC){ smcChip = ''; }
  var block = gpHandoffBlock(s);
  var actions = s.recordOnly
    ? gpRecordNoteHtml(s)   /* hg-v1164: record-only withholds both handoffs */
    : block
    ? ('<div class="note warn" style="margin-top:8px">NO TRADE HANDOFF — R:R '
       + fmtF(block.rr, 2) + ' is below this desk\u2019s ' + fmtF(block.floor, 2)
       + ' floor for ' + esc(String(s.mode || 'swing')).toUpperCase()
       + (block.rr < 1
            ? ', and the target is nearer than the stop'
            : ', short by ' + fmtF(block.floor - block.rr, 2) + 'R')
       + '. The levels are shown to be read, not sent.</div>')
    : (((typeof W.hgToTradePlanOnclickAttr === 'function')
        ? '<button class="toTrade" onclick="' + W.hgToTradePlanOnclickAttr('XAUUSD', s.dir, s.entry, s.stop, s.t1, { t2: s.t2, stack: gpStack, scanner: 'goldpine', strategy: s.mode || 'goldpine' }) + '">SEND TO TRADE PLAN \u2192</button>'
        : '<button class="toTrade" onclick="toTrade(\'XAUUSD\',\'' + s.dir + '\',' + s.entry + ',' + s.stop + ',' + s.t1 + ')">SEND TO TRADE PLAN \u2192</button>')
      + (typeof W.hgBookBtn === 'function'
        ? W.hgBookBtn('XAUUSD', s.dir, s.entry, s.stop, s.t1, { scanner: 'goldpine', strategy: s.mode, t2: s.t2, stack: gpStack })
        : ''));

  return '<div class="panel ' + cls + ' tier-' + tier + '" style="margin-bottom:12px">'
    + '<h2>XAUUSD <span>' + esc(s.dir.toUpperCase()) + ' · ' + modeLabel + ' · Grade ' + esc(s.grade)
    + rankBadge + badge + gpTapeChipHtml(s) + gpMintMarkChipHtml(s) + gpRecordChipHtml(s) + gpFundChipHtml(s)
    + ((typeof W.hgBookStampChip === 'function')
      ? W.hgBookStampChip('XAUUSD', s.dir, { scanner: 'goldpine', strategy: s.mode || 'goldpine', klass: 'metals', fund: 'gold' })
      : '')
    + '</span></h2>'
    + '<div class="note">Confluence <b>' + s.score + '/' + s.maxScore + '</b>'
    + tierNote
    + ' · families <b>' + (s.familyCount != null ? s.familyCount : '—') + '</b>'
    + ' · mark ' + pxF(s.price) + ' · ' + esc(s.source)
    + (fin(+s.rr) ? (' · R:R ' + fmtF(s.rr, 2)) : '')
    + (solChip ? (' ' + solChip) : '')
    + (smcChip ? (' ' + smcChip) : '')
    + '</div>'
    + '<div class="note" style="margin-top:6px;font-size:11px">' + factorsHTML(s.factors) + '</div>'
    + gpMintNotesHtml(s)
    + gpStackHtml
    + '<div class="plan">' + (typeof W.planBlock === 'function'
      ? W.planBlock(s.dir, s.entry, s.stop, s.t1, s.t2, s.planSrc || 'Gold Pine')
      : ('ENTRY ' + pxF(s.entry) + ' · SL ' + pxF(s.stop) + ' · T1 ' + pxF(s.t1))) + '</div>'
    + actions
    /* hg-v1162: the two read lines close the card, BELOW the plan and the
       handoff -- the house guard reads the R:R that belongs to a handoff
       button a bounded distance behind it, and eighteen indicator cells
       between the two would push it out of reach */
    + gpReadsHtml(s)
    + '</div>';
}

function sectionHTML(title, setups, emptyMsg, opts){
  opts = opts || {};
  if (!setups.length){
    return '<div class="panel"><h2>' + esc(title) + '</h2>'
      + '<div class="empty">' + esc(emptyMsg) + '</div></div>';
  }
  var total = fin(+opts.total) ? +opts.total : setups.length;
  var hdr = (total > setups.length)
    ? ('Top ' + setups.length + ' of ' + total + ' · highest-probability formation')
    : (setups.length + ' setup(s)');
  return '<div class="panel"><h2>' + esc(title) + ' <span>' + hdr + '</span></h2></div>'
    + setups.map(function(s, i){ return cardHTML(s, i + 1); }).join('');
}

var __goldPineSnap = null;
var __goldPineTab = { busy: false, hasRun: false, run: null, __timer: null, __mountEl: null };

/* v693: auto-refresh cadence for GOLD PINE, mirroring the v691 pattern
   already proven on NEW GOLD. Fetches gold candles + re-scores swing +
   scalp every 5 minutes while the tab is mounted so setups stay live
   without needing a manual RUN GOLD PINE SCAN click. Pattern mirrors
   omnigold's __og.__uniTimer (mount-time only, never module load) so
   Node test processes never hang on a stray interval. */
var GOLDPINE_AUTO_REFRESH_MS = 5 * 60 * 1000;

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>GOLD PINE <span>Pine layers + confluence + native gold detectors</span></h2>'
    + '<div class="note">Universe scan: every aligned Pine layer (NEW/RECENT/ALIGNED), HTF bias, confluence PRIMARY/ALIGNED/FORMING, '
    + 'plus native GOLD SWING/SCALP candidates. UI shows the <b>top ' + TOP_SETUPS + ' highest-probability formations</b> per section '
    + '(NEW/RECENT/FORMING weighted). '
    + '<b>PRIMARY</b> = strict (≥' + SWING_MIN + ' swing / ≥' + SCALP_MIN + ' scalp). '
    + 'A scalp primary does not pass in premium or discount without a sweep, during a London fix, or when it fades an Asian range that already expanded. '
    + 'A continuation does not pass once the day has used its average range. Gold RSI divergence against the trade does not pass. '
    + '<b>ALIGNED</b> = per-layer or watch context. <b>NATIVE</b> = goldind strategies.</div>'
    + '<div class="row" style="margin-top:10px">'
    + '<button class="btn" id="goldPineRun">RUN GOLD PINE SCAN</button>'
    + '<span class="note" id="goldPineStat">Fetches XAU/PAXG candles then scores swing + scalp.</span>'
    + '</div>'
    + '<div class="prog" id="goldPineProg"><i></i></div>'
    + '<div id="goldPineLevels" style="margin-top:8px"></div>'
    + '<div id="goldPineDesk"></div>'
    + '<div id="goldPineOut" style="margin-top:12px"><div class="empty">Press RUN GOLD PINE SCAN.</div></div>'
    + '</div>';

  var btn = el.querySelector('#goldPineRun');
  var stat = el.querySelector('#goldPineStat');
  var prog = el.querySelector('#goldPineProg');
  var out = el.querySelector('#goldPineOut');
  var lvEl = el.querySelector('#goldPineLevels');

  try{
    var gpDesk = el.querySelector('#goldPineDesk');
    if (gpDesk && typeof W.hgSetupDeskBannerHTML === 'function'){
      gpDesk.innerHTML = W.hgSetupDeskBannerHTML({ kind: 'goldpine', tab: 'GOLD PINE', note: 'PRIMARY = ticket · ALIGNED/FORMING = watch · top picks by probability score.' });
    }
    if (typeof W.hgSetupInjectStyles === 'function') W.hgSetupInjectStyles();
  }catch(eGp){}

  function setProg(p){
    if (!prog) return;
    if (p === null || p === undefined){ prog.classList.remove('on'); prog.querySelector('i').style.width = '0'; return; }
    prog.classList.add('on');
    prog.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
  }

  async function runScan(){
    if (__goldPineTab.busy) return 'busy';
    __goldPineTab.busy = true;
    __goldPineTab.hasRun = true;
    if (btn) btn.disabled = true;
    setProg(0.05);
    var t0 = Date.now();
    try{
      if (stat) stat.textContent = 'Fetching gold candles + macro…';
      var bars = await fetchGoldBars();
      /* hg-v971: the live quote + book for the borrowed GOLD SCALP mint */
      try{ var lfFn = gfn('hgGoldLiveFeed'); bars.live = lfFn ? await lfFn({ symbol: 'XAUTUSD' }) : null; }catch(eLive){ bars.live = null; }
      var macro = null;
      try{
        var mg = gfn('getGoldMacro');
        if (mg) macro = await mg();
      }catch(eM){}
      /* hg-v1162: the free internet feeds the ranker scores by, fetched once */
      var feeds = await gpFreeFeeds(bars);
      setProg(0.35);
      if (!bars.rows4h.length && !bars.rows15m.length){
        if (out) out.innerHTML = '<div class="empty">No gold candle data — check network / macro.js feeds.</div>';
        if (stat) stat.textContent = 'failed · no data';
        return 'failed';
      }
      if (stat) stat.textContent = 'Scoring Pine + gold confluence…';
      try{
        var gsv = gfn('getSilverCandles');
        if (gsv){
          var silverPack = await gsv('15m', 120);
          if (silverPack && silverPack.rows && silverPack.rows.length) W.__hgSilverRows = silverPack.rows;
        }
      }catch(eSv){}
      var result = runGoldPineScan(bars, { macro: macro, fng: feeds.fng, fundingRate: feeds.fundingRate,
                                           perpNative: feeds.perpNative, cot: feeds.cot });
      setProg(0.9);
      /* v694: the lists are already reordered by solidity in
         runGoldPineScan, so slice directly instead of re-sorting via
         topProbSetups (which would undo the measured-edge bucket order). */
      /* runGoldPineScan already stamped every row and recorded the verdict;
         the paint just reads it, so the cards and the pin cannot disagree
         with what goldPineScan() hands anyone else. */
      var tapeSwing = (result.tape && result.tape.swing) || '';
      var tapeScalp = (result.tape && result.tape.scalp) || '';
      var swingTop = result.swing.slice(0, TOP_SETUPS);
      var scalpTop = result.scalp.slice(0, TOP_SETUPS);
      result.swingTop = swingTop;
      result.scalpTop = scalpTop;
      __goldPineSnap = result;

      if (lvEl && result.levels){
        var lv = result.levels;
        lvEl.innerHTML = '<div class="note">Levels · PDH <b>' + pxF(lv.pdh) + '</b> · PDL <b>' + pxF(lv.pdl)
          + '</b> · Asia <b>' + pxF(lv.asiaLo) + '–' + pxF(lv.asiaHi) + '</b> · feed <b>' + esc(result.source) + '</b></div>';
      }

      /* v694: killed note surfaces proven-losing kinds the reorder hid. */
      var killedNote = (typeof W.hgSolidityKilledNoteHtml === 'function')
        ? (W.hgSolidityKilledNoteHtml(result.swing) + W.hgSolidityKilledNoteHtml(result.scalp))
        : '';
      /* Only tape-aligned rows may be pinned as the leader. When that
         empties a ranked list the panel says so rather than vanishing —
         a silent desk is the thing this family keeps having to fix. */
      /* hg-v1164: a record-only layer never leads; it is counted and named */
      var mpList = gpTapeAligned(swingTop.concat(scalpTop).filter(gpMayLead));
      var ranked = swingTop.filter(gpMayLead).length + scalpTop.filter(gpMayLead).length;
      var recordRows = result.swing.concat(result.scalp).filter(function(s){ return s && s.recordOnly; });
      var releasedRows = result.swing.concat(result.scalp).filter(function(s){ return s && s.recordReleased; });
      var recordNote = recordRows.length
        ? ('<div class="note">' + recordRows.length + ' RECORD-ONLY Pine layer' + (recordRows.length === 1 ? '' : 's')
           + ' on this scan (' + recordRows.map(function(s){ return esc(hgGpKind(s)) + ' ' + esc(String(s.dir).toUpperCase()); }).join(' \u00b7 ')
           + ') \u2014 recorded under GOLDPINE, withheld from MOST PROBABLE and the handoff until the ledger measures it paying.</div>')
        : '';
      if (releasedRows.length) recordNote += '<div class="note">' + releasedRows.length + ' Pine layer' + (releasedRows.length === 1 ? '' : 's')
        + ' released by the forward ledger (' + releasedRows.map(function(s){ return esc(hgGpKind(s)); }).join(' \u00b7 ') + ').</div>';
      /* hg-v1164: a demoted row sinks below the two-card cut (hg-v1005), so a
         record-only layer that fired would never be SEEN; it paints in a
         section of its own, below the two lanes, as a full card with the
         handoff withheld -- visible, recorded, not led. A row that did make
         the cut (a thin board) is not painted twice. */
      var recordSection = '';
      var recordShown = recordRows.filter(function(s){ return swingTop.indexOf(s) < 0 && scalpTop.indexOf(s) < 0; });
      if (recordShown.length){
        recordSection = '<div class="panel"><h2>GOLD PINE \u2014 RECORD-ONLY LAYERS <span>' + recordShown.length
          + ' fired this scan \u00b7 recorded under GOLDPINE \u00b7 not led, not sent until measured</span></h2></div>'
          + recordShown.map(function(s){ return cardHTML(s, 0); }).join('');
      }
      var heldNote = (ranked && !mpList.length)
        ? ('<div class="note warn">MOST PROBABLE stands empty \u2014 every ranked formation on this scan '
           + 'points against the gold tape (4H ' + esc(tapeSwing || 'unread')
           + ' \u00b7 15m ' + esc(tapeScalp || 'unread') + '). '
           + 'The cards below still print their levels, stamped AGAINST GOLD TAPE \u00b7 HELD.</div>')
        : '';
      /* Pack 907: GOLD PINE draws four legs and moved its numbers on a
         malformed tape without saying so. One note per leg that arrived,
         ahead of everything drawn from it. */
      /* hg-v913: this desk reads the records it writes. */
      var tapeNote = (typeof W.hgGoldFwdNote === 'function' ? W.hgGoldFwdNote('goldpine') : '');
      if (typeof W.hgGoldTapeNotes === 'function'){
        [['rows15m','15m'],['rows1h','1h'],['rows4h','4h'],['rows1d','1d']].forEach(function(L){
          var rws = bars && bars[L[0]];
          if (rws && rws.length) tapeNote += W.hgGoldTapeNotes(rws, L[1]);
        });
      }
      /* hg-v1005: the fundamental stack, on the board. A blackout names
         itself ahead of everything drawn from the scan; the full gold
         board panel renders above the sections either way. */
      var fundNote = '';
      if (result.fundBlackout){
        fundNote = '<div class="note warn" style="margin-bottom:10px;padding:8px 10px;border-left:3px solid #b45309">'
          + '<b>EVENT BLACKOUT</b> — a red-folder macro print is inside its window; no fresh setup '
          + 'forms into it.'
          + (result.fundStoodDown ? ' ' + result.fundStoodDown + ' formation'
              + (result.fundStoodDown === 1 ? '' : 's') + ' stood down.' : '')
          + ' The sections stay empty until the window clears; the board below still shows the '
          + 'stack\'s full read.</div>';
      }
      var html = fundNote + gpFundPanelHtml() + tapeNote + heldNote + killedNote + recordNote
        + sectionHTML('GOLD PINE — SWING SETUPS (4H)', swingTop,
          'No swing formations — check gold feed (4h bars). Layers need ~280×4h for full Pine stack.',
          { total: result.swing.length })
        + sectionHTML('GOLD PINE — SCALP SETUPS (15m)', scalpTop,
          'No scalp formations — check gold feed (15m bars). Native strategies need 15m/1h/4h legs.',
          { total: result.scalp.length })
        + recordSection
        + gpCatalogHtml(result, bars);   /* hg-v1162: one census */

      if (out) out.innerHTML = html;
      try { if (typeof W.hgMpPin === 'function') W.hgMpPin('goldpine', mpList, null, out); } catch (eMp) {}
      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (stat) stat.textContent = 'done · top ' + swingTop.length + '/' + result.swing.length + ' swing · top '
        + scalpTop.length + '/' + result.scalp.length + ' scalp'
        + (recordRows.length ? (' · ' + recordRows.length + ' record-only') : '')
        + (result.fundBlackout ? ' · EVENT BLACKOUT — no fresh formations' : '') + ' · ' + dt + 's';
      setProg(null);
      return 'refreshed';
    }catch(e){
      if (stat) stat.textContent = 'error: ' + ((e && e.message) || e);
      if (out) out.innerHTML = '<div class="empty">Scan failed: ' + esc(String(e && e.message || e)) + '</div>';
      return 'error';
    }finally{
      if (btn) btn.disabled = false;
      setProg(null);
      __goldPineTab.busy = false;
    }
  }

  if (btn) btn.addEventListener('click', function(){ runScan(); });
  __goldPineTab.run = runScan;
  setTimeout(function(){
    if (!__goldPineTab.hasRun && !__goldPineTab.busy) runScan();
  }, 150);

  /* v693: auto-refresh every 5 minutes while the tab is mounted.
     Timer is stored on module state so a subsequent mount (tab close +
     reopen, hot reload) clears the prior timer instead of stacking.
     The interval calls the exact same runScan the button uses, so a
     manual click and an auto-tick are indistinguishable except for
     origin. Also self-heals: if runScan is busy, the tick becomes a
     no-op via __goldPineTab.busy inside runScan; the next tick tries
     again 5 minutes later. And if the mount element leaves the DOM
     (user unmounted the tab), the timer clears itself and both fields
     null out. */
  try {
    if (__goldPineTab.__timer){
      clearInterval(__goldPineTab.__timer);
      __goldPineTab.__timer = null;
    }
    __goldPineTab.__mountEl = el;
    if (typeof setInterval === 'function'){
      __goldPineTab.__timer = setInterval(function(){
        try {
          if (__goldPineTab.__mountEl && !document.body.contains(__goldPineTab.__mountEl)){
            clearInterval(__goldPineTab.__timer);
            __goldPineTab.__timer = null;
            __goldPineTab.__mountEl = null;
            return;
          }
        } catch(eDoc){}
        try { runScan(); } catch(eTick){}
      }, GOLDPINE_AUTO_REFRESH_MS);
    }
  } catch(eTimer){}
}

async function goldPineRefresh(){
  try{
    if (__goldPineTab.busy) return 'busy';
    if (!__goldPineTab.hasRun || typeof __goldPineTab.run !== 'function') return 'skipped: not run yet';
    return await __goldPineTab.run();
  }catch(e){
    return 'error: ' + ((e && e.message) || e);
  }
}

W.runGoldPineScan = runGoldPineScan;
W.topProbSetups = topProbSetups;
/* test seam — the tape verdict is pure and worth checking without a DOM */
W.goldPineTapeChipHtml = gpTapeChipHtml;
/* hg-v1005: the stack seams, exported for the guard — the chip and the
   panel are pure reads of stamped state and never throw. */
W.gpFundChipHtml = gpFundChipHtml;
W.gpFundPanelHtml = gpFundPanelHtml;
W.goldPineTapeAligned = gpTapeAligned;
W.goldPineProbScore = probScore;
W.GOLD_PINE_TOP_SETUPS = TOP_SETUPS;
W.goldPineScan = function(){
  try{ return __goldPineSnap; }catch(e){ return null; }
};
W.goldPineState = function(){
  try{
    if (!__goldPineSnap) return null;
    var rows = [];
    (__goldPineSnap.swing || []).forEach(function(s){
      rows.push({ sym: 'XAUUSD', dir: s.dir, mode: 'swing', grade: s.grade, score: s.score });
    });
    (__goldPineSnap.scalp || []).forEach(function(s){
      rows.push({ sym: 'XAUUSD', dir: s.dir, mode: 'scalp', grade: s.grade, score: s.score });
    });
    return { results: rows, at: __goldPineSnap.at };
  }catch(e){ return null; }
};

/* hg-v950: exported so the calendar wiring is testable as a unit — the
   scan itself needs pinegoldmath, and a guard that cannot reach the rule
   is a guard that proves nothing. */
W.gpWeekendVerdict = gpWeekendVerdict;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'goldpine', label: 'GOLD PINE', mount: mount, refresh: goldPineRefresh,
                 fundamentalChip: gpFundChipHtml, fundPanelHtml: gpFundPanelHtml,
                 /* hg-v1164: the release judge and the lead predicate ride the registration (hg-v967) */
                 recordLayerJudge: gpRecordLayerJudge, mayLead: gpMayLead });

})();
