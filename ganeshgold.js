/* GANESH GOLD TRADING FIRM (hg-v1072)
   The full SMC/ICT gold framework as a working desk, scalp (15m) and swing
   (4h), on the one XAUUSD chain the house uses (getXAUCandles):

   1 HTF bias -> 2 structure -> 3 liquidity -> 4 key levels ->
   5 premium/discount -> 6 session -> 7 DXY + yields -> 8 news ->
   9 sweep -> 10 displacement -> 11 MSS/BOS -> 12 FVG/OB retest ->
   13 entry -> 14 structural SL -> 15 liquidity TP -> 16 size/risk ->
   17 management.

   Both models (LONG / SHORT) are graded on the same tape (12 independent
   checklist legs; A+ >= 10, A >= 8, B >= 5). The better A/A+ grade crowns;
   the plan mints only when the structural R:R clears the style minimum.
   Every read that cannot speak prints UNREAD. Evidence, never a gate. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
function escH(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fin(v){ return (typeof v === 'number' && isFinite(v)); }
var MIN_RR = { scalp: 1.2, swing: 1.5 };
var __gg = { snap: null, busy: false, run: null, ranOnce: false, lastBar: 0 };

/* hg-v1154: the bar instant, read once. Candle rows carry `t` in SECONDS on
   this chain (the ledger and every gold desk read them so); `new Date(+t)`
   on a seconds value is January 1970, which is what sessOf() had been
   judging the session leg on. Seconds or milliseconds in, milliseconds
   out; an unreadable or epoch-zero instant is NO instant (the +null === 0
   trap), never 1970. */
function ggBarMs(t){
  var n = +t;
  if (!isFinite(n) || n <= 0) return null;
  return n < 1e12 ? n * 1000 : n;
}
/* hg-v1154: the gold calendar on THIS desk. GANESH GOLD writes ticket:true
   XAUUSD rows into the forward ledger and had no weekend or news reference
   of any kind, on a chain that ends in 24/7 proxies (hg-v949's
   contamination). The rule lives once, in gold-formation.js (hgGoldGateAt:
   both calendars on ONE instant, hg-v964); this file carries lookup guards
   and no calendar of its own. The route answers truthy-when-shut /
   null-when-open, the shape the coverage reporter calls (hg-v952). */
function ggWeekendVerdict(atMs){
  try{
    var f = W.hgGoldWeekendVerdict;
    if (typeof f !== 'function') return null;
    var ms = ggBarMs(atMs);
    if (ms === null) return null;
    var v = f(ms);
    return (v && v.inWeekend === true) ? v : null;
  }catch(e){ return null; }
}
function ggGateAt(atMs){
  try{
    var ms = ggBarMs(atMs);
    if (ms === null) return null;
    var f = W.hgGoldGateAt;
    if (typeof f === 'function') return f(ms);
    var wf = W.hgGoldWeekendVerdict;
    return { atMs: ms, weekend: (typeof wf === 'function') ? wf(ms) : null, news: null };
  }catch(e){ return null; }
}
/* What the calendar withholds: the TICKET CLAIM and nothing else. The plan
   keeps its levels, grade and R:R, paints as HELD, and its record is still
   written -- ticket:false, with the weekend mark -- so the population can be
   separated later (hg-v955). Fails OPEN: no gate, no hold. */
function ggHold(plan, gate){
  if (!plan || !gate) return plan;
  var why = null;
  if (gate.weekend && gate.weekend.inWeekend === true) why = 'GOLD SHUT - ' + (gate.weekend.why || 'gold weekend');
  else if (gate.news && gate.news.locked === true) why = 'NEWS LOCK - ' + (gate.news.why || 'tier-1 gold news window');
  if (!why) return plan;
  plan.held = why;
  if (plan.tier === 'TICKET'){ plan.tier = 'WATCH'; plan.ticketWithheld = true; }
  return plan;
}
/* hg-v979: the feed the levels were priced on -- the shell's per-timeframe
   record, the same one the DATA chip reads. Absent stays absent. */
function ggFeed(tf){
  try{
    var S = W.S;
    var v = (S && S.goldSrcByTf) ? S.goldSrcByTf[tf] : null;
    return (typeof v === 'string' && v) ? v : undefined;
  }catch(e){ return undefined; }
}

function sessOf(t){
  try{ var ms = ggBarMs(t); if (ms === null) return 'UNREAD';
    var h = new Date(ms).getUTCHours();
    if (h < 8) return 'ASIA'; if (h < 12) return 'LONDON';
    if (h < 16) return 'NY-OVERLAP'; if (h < 21) return 'NEW YORK'; return 'LATE';
  }catch(e){ return 'UNREAD'; }
}
function atrVal(rows){ try{ var a = W.atr(rows, 14); return (a && a.length) ? +a[a.length-1] : NaN; }catch(e){ return NaN; } }
function emaLast(rows, len){ try{ var e = W.ema(rows.map(function(r){ return r.c; }), len); return (e && e.length) ? +e[e.length-1] : NaN; }catch(e){ return NaN; } }
function swings(rows, look){
  var hs = [], ls = [];
  for (var i = look; i < rows.length - look; i++){
    var hh = true, ll = true, j;
    for (j = i - look; j <= i + look; j++){
      if (j === i) continue;
      if (+rows[j].h >= +rows[i].h) hh = false;
      if (+rows[j].l <= +rows[i].l) ll = false;
    }
    if (hh) hs.push({ i: i, p: +rows[i].h, t: +rows[i].t });
    if (ll) ls.push({ i: i, p: +rows[i].l, t: +rows[i].t });
  }
  return { hs: hs, ls: ls };
}
function dayLevels(day){
  var out = { pdh: NaN, pdl: NaN, wkH: NaN, wkL: NaN };
  try{
    if (day && day.length >= 2){ out.pdh = +day[day.length-2].h; out.pdl = +day[day.length-2].l; }
    if (day && day.length >= 8){
      var wh = -Infinity, wl = Infinity;
      for (var i = day.length - 6; i < day.length - 1; i++){ if (+day[i].h > wh) wh = +day[i].h; if (+day[i].l < wl) wl = +day[i].l; }
      out.wkH = wh; out.wkL = wl;
    }
  }catch(e){}
  return out;
}
function asiaBox(rows){
  try{
    var lo = Infinity, hi = -Infinity;
    for (var i = rows.length - 1; i >= 0; i--){
      /* hg-v1288: route the instant through ggBarMs so seconds-based rows
         (hg-v1154 trap) don't read in 1970 and break on the first bar. */
      var ms = ggBarMs(rows[i].t);
      if (ms === null) continue;
      if (new Date(ms).getUTCHours() >= 8) break;
      if (+rows[i].h > hi) hi = +rows[i].h;
      if (+rows[i].l < lo) lo = +rows[i].l;
    }
    return (hi > -Infinity && lo < Infinity) ? { hi: hi, lo: lo } : null;
  }catch(e){ return null; }
}
function fvgFind(rows){
  for (var i = rows.length - 1; i >= 2; i--){
    if (+rows[i].low > +rows[i-2].high) return { dir: 'bull', hi: +rows[i].low, lo: +rows[i-2].high, i: i };
    if (+rows[i].high < +rows[i-2].low) return { dir: 'bear', hi: +rows[i-2].low, lo: +rows[i].high, i: i };
  }
  return null;
}
function dispFind(rows, atrV){
  var best = null, bestRange = -Infinity;
  for (var i = rows.length - 1; i >= Math.max(0, rows.length - 12); i--){
    var r = rows[i], range = +r.h - +r.l, body = Math.abs(+r.c - +r.o);
    if (range >= 1.5 * atrV && body >= 0.6 * range && range > bestRange){
      bestRange = range; best = { i: i, dir: (+r.c > +r.o) ? 'bull' : 'bear', r: r };
    }
  }
  return best;
}
function obFind(rows, disp){
  if (!disp) return null;
  for (var i = disp.i - 1; i >= disp.i - 4; i--){
    if (i < 0) break;
    var r = rows[i], bear = +r.c < +r.o, bull = +r.c > +r.o;
    if (disp.dir === 'bull' && bear) return { dir: 'bull', hi: +r.h, lo: +r.l };
    if (disp.dir === 'bear' && bull) return { dir: 'bear', hi: +r.h, lo: +r.l };
  }
  return null;
}
function vpMini(rows){
  try{
    var pr = rows.slice(-60), bins = 24, lo = Infinity, hi = -Infinity;
    for (var i = 0; i < pr.length; i++){ if (+pr[i].l < lo) lo = +pr[i].l; if (+pr[i].h > hi) hi = +pr[i].h; }
    if (!fin(lo) || !fin(hi) || hi <= lo) return null;
    var step = (hi - lo) / bins, vol = [], k;
    for (k = 0; k < bins; k++) vol.push(0);
    for (i = 0; i < pr.length; i++){
      var mid = (+pr[i].h + +pr[i].l + +pr[i].c) / 3;
      vol[Math.min(bins - 1, Math.max(0, Math.floor((mid - lo) / step)))] += (+pr[i].v || 0);
    }
    var best = 0, total = 0; for (k = 0; k < bins; k++){ total += vol[k]; if (vol[k] > vol[best]) best = k; }
    if (total <= 0) return null;
    var val = lo, vah = hi, cum = 0;
    for (k = 0; k < bins; k++){ cum += vol[k]; if (cum >= total * 0.7){ val = lo + step * k; break; } }
    cum = 0;
    for (k = bins - 1; k >= 0; k--){ cum += vol[k]; if (cum >= total * 0.7){ vah = lo + step * (k + 1); break; } }
    return { poc: lo + step * (best + 0.5), vah: vah, val: val };
  }catch(e){ return null; }
}
function squeezeState(rows){
  try{
    var c = rows.map(function(r){ return r.c; });
    var bb = W.bollinger(c, 20, 2), kc = W.keltner(rows, 20, 1.5);
    if (!bb || !kc || !bb.upper || !kc.up) return null;
    var i = rows.length - 1;
    return (+bb.upper[i] < +kc.up[i] && +bb.lower[i] > +kc.lo[i]) ? 'SQUEEZE' : 'EXPANDED';
  }catch(e){ return null; }
}

async function ganeshGoldEval(style){
  style = (style === 'swing') ? 'swing' : 'scalp';
  var exTf = (style === 'scalp') ? '15m' : '4h';
  var ex = null, h4 = null, day = null, failed = [];
  try{ ex = await W.getXAUCandles(exTf, 400); }catch(e){ failed.push(exTf); }
  if (style === 'scalp'){ try{ h4 = await W.getXAUCandles('4h', 400); }catch(e){ failed.push('4h'); } }
  try{ day = await W.getXAUCandles('1d', 120); }catch(e){ failed.push('1d'); }
  if (!ex || ex.length < 60) return { ok: false, note: 'XAUUSD ' + exTf + ' candles unavailable (' + failed.join(',') + ')' };
  ex = ex.slice(-240);
  var ctx = (style === 'scalp') ? (h4 && h4.length >= 60 ? h4 : ex) : ex;
  var atrEx = atrVal(ex), atrCtx = atrVal(ctx);
  var px = +ex[ex.length - 1].c, lastT = +ex[ex.length - 1].t;
  /* hg-v1154: the shared tape-sanity rule (gold-tape-sanity.js) on the
     execution series -- a stale, gapped or non-continuous tape is said on
     the card rather than graded as if it were whole. '' when the rule is
     absent or the tape is clean. */
  var tapeNote = '';
  try{ if (typeof W.hgGoldTapeNotes === 'function') tapeNote = String(W.hgGoldTapeNotes(ex, exTf) || ''); }catch(eTn){ tapeNote = ''; }
  var swEx = swings(ex, 3), swCtx = swings(ctx, 3);
  var lv = dayLevels(day), ab = asiaBox(ex);
  var hs = swCtx.hs.slice(-3), ls = swCtx.ls.slice(-3);
  var lastHH = hs.length ? hs[hs.length - 1].p : NaN, lastHL = ls.length ? ls[ls.length - 1].p : NaN;
  var e50 = emaLast(ctx, 50), e20 = emaLast(ctx, 20);
  var e50d = day && day.length ? emaLast(day, 50) : NaN, e20d = day && day.length ? emaLast(day, 20) : NaN;
  var htfBias = null;
  if (fin(e50) && fin(e20) && fin(px)) htfBias = (px > e20 && e20 > e50) ? 'bull' : ((px < e20 && e20 < e50) ? 'bear' : null);
  var struct = null;
  if (hs.length >= 2 && ls.length >= 2){
    struct = (hs[hs.length-1].p > hs[hs.length-2].p && ls[ls.length-1].p > ls[ls.length-2].p) ? 'up'
      : ((hs[hs.length-1].p < hs[hs.length-2].p && ls[ls.length-1].p < ls[ls.length-2].p) ? 'down' : 'range');
  }
  var disp = dispFind(ex, atrEx);
  var fvg = fvgFind(ex), ob = obFind(ex, disp);
  var zone = fvg || ob || null;
  var sweptSell = false, sweptBuy = false;
  var sellLiq = lv.pdl, buyLiq = lv.pdh;
  if (ab){ sellLiq = fin(sellLiq) ? Math.min(sellLiq, ab.lo) : ab.lo; buyLiq = fin(buyLiq) ? Math.max(buyLiq, ab.hi) : ab.hi; }
  for (var i = ex.length - 12; i < ex.length; i++){
    if (fin(sellLiq) && +ex[i].l < sellLiq && +ex[i].c > sellLiq) sweptSell = true;
    if (fin(buyLiq) && +ex[i].h > buyLiq && +ex[i].c < buyLiq) sweptBuy = true;
  }
  var mssUp = false, mssDown = false;
  if (disp && disp.dir === 'bull' && fin(lastHH)) mssUp = +disp.r.c > lastHH;
  if (disp && disp.dir === 'bear' && fin(lastHL)) mssDown = +disp.r.c < lastHL;
  var retest = false;
  if (zone && disp){
    if (disp.dir === 'bull') retest = (px <= zone.hi + 0.4 * atrEx && px >= zone.lo - 0.6 * atrEx);
    else retest = (px >= zone.lo - 0.4 * atrEx && px <= zone.hi + 0.6 * atrEx);
  }
  var eqH = null, eqL = null;
  if (hs.length >= 2 && Math.abs(hs[hs.length-1].p - hs[hs.length-2].p) <= 0.3 * atrCtx) eqH = hs[hs.length-1].p;
  if (ls.length >= 2 && Math.abs(ls[ls.length-1].p - ls[ls.length-2].p) <= 0.3 * atrCtx) eqL = ls[ls.length-1].p;
  var rangeHi = hs.length ? hs[hs.length-1].p : NaN, rangeLo = ls.length ? ls[ls.length-1].p : NaN;
  var mid = (fin(rangeHi) && fin(rangeLo)) ? (rangeHi + rangeLo) / 2 : NaN;
  var pd = fin(mid) ? ((px >= mid) ? 'PREMIUM' : 'DISCOUNT') : 'UNREAD';
  var vw = null;
  try{
    var anchor = 0;
    for (var a2 = ex.length - 1; a2 >= 0; a2--){
      /* hg-v1288: route the instant through ggBarMs so the 00:00-UTC anchor
         actually lands on the daily session boundary; the earlier code did
         new Date(+ex[a2].t).getUTCHours() on seconds-based rows and never
         saw hour 0, so the AVWAP anchor drifted to the oldest bar. */
      var dms = ggBarMs(ex[a2].t);
      if (dms === null) continue;
      var dd = new Date(dms);
      if (dd.getUTCHours() === 0 && a2 < ex.length - 1){ anchor = a2; break; }
    }
    var av = W.hgAVWAP(ex, anchor);
    if (av && fin(+av.value)) vw = { v: +av.value, devPct: (px - +av.value) / +av.value * 100 };
  }catch(e){}
  var atrRegime = null;
  try{
    var aArr = W.atr(ex, 14);
    if (aArr && aArr.length >= 21){
      var prev = aArr.slice(-21, -1), mean = prev.reduce(function(a, b){ return a + b; }, 0) / prev.length;
      var now = +aArr[aArr.length - 1];
      if (mean > 0) atrRegime = (now > 1.3 * mean) ? 'EXPANDING' : ((now < 0.7 * mean) ? 'DEAD' : 'HEALTHY');
    }
  }catch(e){}
  var vp = vpMini(ex), sq = squeezeState(ex);
  var dxT = null, tnxT = null;
  try{
    var rg = (typeof W.regimeState === 'function') ? W.regimeState() : null;
    if (rg && rg.dxy) dxT = rg.dxy.trend20 || rg.dxy.trend || null;
    if (rg && rg.tnx) tnxT = rg.tnx.trend || rg.tnx.trend20 || null;
  }catch(e){}
  var news = null;
  try{ if (typeof W.hgNewsRisk === 'function'){ var nw = W.hgNewsRisk('XAUUSD'); if (nw && nw.blackout) news = 'BLACKOUT'; else news = 'CLEAR'; } }catch(e){}
  /* hg-v1163: THE FREE FEEDS AND THE INDICATOR STACK, read once per eval so the
     plan this model crowns records what the gold stack's free internet feeds
     and the bar-computed stack said on the bar it read -- the macro snapshot
     (cached first, a bounded fetch when none), the spot read, Fear & Greed,
     COT and the PAXG funding print, each through the one home the other
     gold desks read (hgGoldFreeFeedVerdicts / hgGoldIndicatorReads), the
     stack off the execution tape with the daily leg beside it. Every leg
     fails open to absent; nothing in the twelve-step model reads them. */
  var feeds = { macro: null, spot: null, fng: undefined, cot: undefined, fundingRate: undefined };
  try{ var mc = (typeof W.getGoldMacroCached === 'function') ? W.getGoldMacroCached() : null; if (mc && typeof mc === 'object') feeds.macro = mc; }catch(e){}
  try{
    if (!feeds.macro && typeof W.getGoldMacro === 'function'){
      var mg = await Promise.race([Promise.resolve().then(function(){ return W.getGoldMacro(); }).catch(function(){ return null; }),
                                   new Promise(function(r){ setTimeout(function(){ r(null); }, 6000); })]);
      if (mg && typeof mg === 'object') feeds.macro = mg;
    }
  }catch(e){}
  try{ if (typeof W.goldspotState === 'function') feeds.spot = W.goldspotState() || null; }catch(e){}
  try{ if (W.S && W.S.fng && isFinite(+W.S.fng.v)) feeds.fng = W.S.fng; }catch(e){}
  try{ if (W.__hgGoldCot && typeof W.__hgGoldCot === 'object') feeds.cot = W.__hgGoldCot; }catch(e){}
  try{
    if (typeof W.binanceFunding === 'function'){
      var fr = await Promise.race([Promise.resolve().then(function(){ return W.binanceFunding('PAXGUSDT'); }).catch(function(){ return null; }),
                                   new Promise(function(r){ setTimeout(function(){ r(null); }, 6000); })]);
      if (fr && typeof fr.fundingPct === 'number' && isFinite(fr.fundingPct)) feeds.fundingRate = fr.fundingPct;
    }
  }catch(e){}
  var ir = null;
  try{ if (typeof W.hgGoldIndicatorReads === 'function'){ var ir0 = W.hgGoldIndicatorReads(ex, { rows1d: day }); if (ir0 && ir0.ok === true) ir = ir0; } }catch(e){ ir = null; }
  /* hg-v1165: the Pine stack on the execution tape */
  var ps = null;
  try{ if (typeof W.pineGoldLayerStates === 'function'){ var ps0 = W.pineGoldLayerStates(ex); if (ps0 && ps0.ok === true) ps = ps0; } }catch(e){ ps = null; }
  var sess = sessOf(lastT);
  var ev = { style: style, px: px, atrEx: atrEx, atrCtx: atrCtx, htfBias: htfBias, struct: struct,
    feeds: feeds, ir: ir, ps: ps,
    lv: lv, ab: ab, sellLiq: sellLiq, buyLiq: buyLiq, eqH: eqH, eqL: eqL, pd: pd, mid: mid,
    sweptSell: sweptSell, sweptBuy: sweptBuy, disp: disp, mssUp: mssUp, mssDown: mssDown,
    fvg: fvg, ob: ob, zone: zone, retest: retest, vw: vw, atrRegime: atrRegime, vp: vp,
    sq: sq, dxT: dxT, tnxT: tnxT, news: news, sess: sess, lastT: lastT, rangeHi: rangeHi, rangeLo: rangeLo,
    tapeNote: tapeNote, rows: ex };
  return { ok: true, ev: ev };
}

function modelGrade(ev, dir){
  var checks = [], k;
  var bull = (dir === 'long');
  checks.push({ k: 'htf', on: ev.htfBias === (bull ? 'bull' : 'bear') });
  checks.push({ k: 'zone', on: (bull && ev.pd === 'DISCOUNT') || (!bull && ev.pd === 'PREMIUM') });
  checks.push({ k: 'liq', on: bull ? fin(ev.sellLiq) : fin(ev.buyLiq) });
  checks.push({ k: 'sweep', on: bull ? ev.sweptSell : ev.sweptBuy });
  checks.push({ k: 'disp', on: ev.disp && ev.disp.dir === (bull ? 'bull' : 'bear') });
  checks.push({ k: 'mss', on: bull ? ev.mssUp : ev.mssDown });
  checks.push({ k: 'fvgob', on: ev.zone && ev.zone.dir === (bull ? 'bull' : 'bear') });
  checks.push({ k: 'retest', on: ev.retest });
  checks.push({ k: 'dxy', on: !(bull ? (ev.dxT === 'RISING') : (ev.dxT === 'FALLING')) });
  checks.push({ k: 'yields', on: !(bull ? (ev.tnxT === 'RISING') : (ev.tnxT === 'FALLING')) });
  checks.push({ k: 'news', on: ev.news !== 'BLACKOUT' });
  checks.push({ k: 'session', on: (ev.style === 'swing') ? true : (ev.sess !== 'ASIA' && ev.sess !== 'LATE') });
  var n = 0; for (k = 0; k < checks.length; k++){ if (checks[k].on) n++; }
  var grade = (n >= 10) ? 'A+' : ((n >= 8) ? 'A' : ((n >= 5) ? 'B' : null));
  return { dir: dir, n: n, checks: checks, grade: grade };
}

function planFor(ev, m){
  try{
    var bull = (m.dir === 'long');
    var atr = fin(ev.atrEx) ? ev.atrEx : NaN;
    var zone = ev.zone;
    var entry = null;
    if (zone && fin(atr)){
      entry = (zone.hi + zone.lo) / 2;
      if (bull && ev.px > zone.hi + 0.5 * atr) entry = zone.hi;
      if (!bull && ev.px < zone.lo - 0.5 * atr) entry = zone.lo;
    }
    if (!fin(entry)) entry = ev.px;
    var extreme = bull ? ev.sellLiq : ev.buyLiq;
    var stop = fin(extreme) && fin(atr) ? (bull ? extreme - 0.5 * atr : extreme + 0.5 * atr) : NaN;
    if (!fin(stop) || stop === entry) return null;
    var tp1 = bull ? ev.lv.pdh : ev.lv.pdl;
    var tp2 = bull ? (fin(ev.eqH) ? ev.eqH : ev.lv.wkH) : (fin(ev.eqL) ? ev.eqL : ev.lv.wkL);
    var tp3 = bull ? ev.rangeHi : ev.rangeLo;
    if (!fin(tp1)) tp1 = NaN; if (!fin(tp2)) tp2 = NaN; if (!fin(tp3)) tp3 = NaN;
    var risk = Math.abs(entry - stop);
    var rr1 = fin(tp1) ? Math.abs(tp1 - entry) / risk : NaN;
    var rr2 = fin(tp2) ? Math.abs(tp2 - entry) / risk : NaN;
    var minRr = MIN_RR[ev.style] || 1.2;
    var ok = fin(rr1) && rr1 >= minRr - 1e-9;
    return { dir: m.dir, entry: entry, stop: stop, t1: tp1, t2: tp2, t3: tp3, rr1: rr1, rr2: rr2,
      grade: m.grade, ok: ok, tier: (ok && (m.grade === 'A+' || m.grade === 'A')) ? 'TICKET' : ((m.grade === 'B' || (m.grade && !ok)) ? 'WATCH' : null) };
  }catch(e){ return null; }
}

/* hg-v1163: the marks on ONE plan, through the one home each; booleans
   only, absent when nothing read. Nothing reads them back. */
function ggMarkPlan(plan, ev){
  try{
    if (!plan || (plan.dir !== 'long' && plan.dir !== 'short') || !ev) return false;
    var m = {}, any = false, k;
    if (typeof W.hgGoldFreeFeedVerdicts === 'function' && ev.feeds){
      var fv = W.hgGoldFreeFeedVerdicts(ev.feeds, plan.dir);
      for (k in fv){ if (Object.prototype.hasOwnProperty.call(fv, k) && (fv[k] === true || fv[k] === false)){ m[k] = fv[k]; any = true; } }
    }
    if (ev.ir && typeof W.hgGoldIndicatorMarks === 'function'){
      var im = W.hgGoldIndicatorMarks(ev.ir, plan.dir);
      for (k in im){ if (Object.prototype.hasOwnProperty.call(im, k) && (im[k] === true || im[k] === false)){ m[k] = im[k]; any = true; } }
      plan.indReads = ev.ir;
    }
    if (ev.ps && typeof W.pineGoldPineMarks === 'function'){   /* hg-v1165 */
      var pm = W.pineGoldPineMarks(ev.ps, plan.dir);
      for (k in pm){ if (Object.prototype.hasOwnProperty.call(pm, k) && (pm[k] === true || pm[k] === false)){ m[k] = pm[k]; any = true; } }
      plan.pineStates = ev.ps;
    }
    if (any) plan.freeReads = m;
    var fp = (typeof W.hgGoldFreeFeedFunding === 'function') ? W.hgGoldFreeFeedFunding(ev.feeds) : NaN;
    if (typeof fp === 'number' && isFinite(fp)) plan.fundingPct = fp;
    return any;
  }catch(e){ return false; }
}
function ggReadsHtml(p){
  try{
    if (!p) return '';
    var h = '';
    if (typeof W.hgGoldFreeFeedLineHtml === 'function' && p.freeReads && typeof p.freeReads === 'object') h += W.hgGoldFreeFeedLineHtml(p.freeReads, { fundingPct: p.fundingPct }) || '';
    if (typeof W.hgGoldIndicatorStackHtml === 'function' && p.indReads) h += W.hgGoldIndicatorStackHtml(p.indReads, p.freeReads) || '';
    if (typeof W.pineGoldStackLineHtml === 'function' && p.pineStates) h += W.pineGoldStackLineHtml(p.pineStates, p.freeReads) || '';   /* hg-v1165 */
    return h;
  }catch(e){ return ''; }
}

async function ganeshGoldScan(opts){
  opts = opts || {};
  var style = (opts.style === 'swing') ? 'swing' : 'scalp';
  if (__gg.busy) return 'busy';
  __gg.busy = true;
  try{
    var r = await ganeshGoldEval(style);
    if (!r.ok){ __gg.snap = { ok: false, note: r.note, at: Date.now(), style: style }; return __gg.snap; }
    var ev = r.ev;
    var mL = modelGrade(ev, 'long'), mS = modelGrade(ev, 'short');
    var pL = planFor(ev, mL), pS = planFor(ev, mS);
    ggMarkPlan(pL, ev); ggMarkPlan(pS, ev);   /* hg-v1163 */
    function ggPineHold(plan){
      if (!plan || !ev.ps || typeof W.pineGoldBlocksLead !== 'function') return plan;
      var why = W.pineGoldBlocksLead(ev.ps, plan.dir);
      if (!why) return plan;
      plan.pineBlock = why;
      if (plan.tier === 'TICKET') plan.tier = 'WATCH';
      return plan;
    }
    pL = ggPineHold(pL); pS = ggPineHold(pS);
    var gsAudit = null;
    try{
      if (style === 'scalp' && typeof W.getSilverCandles === 'function'){
        var sv = await W.getSilverCandles('15m', 120);
        if (sv && sv.rows && sv.rows.length) W.__hgSilverRows = sv.rows;
      }
    }catch(eSv){}
    try{
      if (style === 'scalp' && typeof W.HG_GaneshGoldEngine === 'function' && ev.rows){
        gsAudit = new W.HG_GaneshGoldEngine().auditSevenSteps(ev.rows, [], (ev.feeds && ev.feeds.macro) || null, W.__hgSilverRows);
      }
    }catch(eGs){ gsAudit = null; }
    function ggInstHold(plan){
      if (!plan) return plan;
      var why = null;
      try{
        if (typeof W.hgGoldInstBlocks === 'function'){
          why = W.hgGoldInstBlocks(plan.dir, ev.rows || [], (ev.feeds && ev.feeds.macro) || null, { desk: style === 'scalp' ? 'ganesh' : 'ganesh-swing', horizon: style });
        }
      }catch(eIb){ why = null; }
      if (why){ plan.instBlock = why; plan.held = plan.held || why; if (plan.tier === 'TICKET') plan.tier = 'WATCH'; }
      if (style === 'scalp' && gsAudit && !gsAudit.qualified && plan.tier === 'TICKET'){
        plan.tier = 'WATCH';
        plan.held = plan.held || ('GS1-GS7 ' + gsAudit.passedCount + '/' + gsAudit.totalSteps + ' — not a ticket');
        plan.gsAudit = gsAudit;
      } else if (gsAudit) plan.gsAudit = gsAudit;
      return plan;
    }
    pL = ggInstHold(pL); pS = ggInstHold(pS);
    function ggTapeHold(plan){
      if (!plan || typeof W.pineGoldTapeVeto !== 'function' || !ev.rows) return plan;
      var why = null;
      try{
        why = W.pineGoldTapeVeto(ev.rows, plan.dir, {
          mode: style === 'swing' ? 'swing' : 'scalp',
          now: ev.lastT,
          macro: (ev.feeds && ev.feeds.macro) || null,
          silverRows: W.__hgSilverRows || null
        });
      }catch(eTp){ why = null; }
      if (!why) return plan;
      plan.pineBlock = plan.pineBlock || why;
      plan.held = plan.held || why;
      if (plan.tier === 'TICKET') plan.tier = 'WATCH';
      return plan;
    }
    pL = ggTapeHold(pL); pS = ggTapeHold(pS);
    try{
      if (gsAudit && gsAudit.qualified && typeof W.HG_quantEmit === 'function'){
        var gsSide = gsAudit.direction === 'BEAR' ? pS : pL;
        if (gsSide && gsSide.tier === 'TICKET'){
          W.HG_quantEmit(Object.assign({ status: 'ARMED', timeframe: '15m', targetPrice: gsAudit.takeProfit, gatesPassed: gsAudit.passedCount, totalGates: gsAudit.totalSteps }, gsAudit));
        }
      }
    }catch(eEmit){}
    /* hg-v1154: both calendars on the LAST CLOSED execution bar, never the
       wall clock (hg-v952 / hg-v978) -- a Monday re-run over Friday's bars
       gives Friday's answer. */
    var barMs = ggBarMs(ev.lastT), gate = ggGateAt(barMs);
    pL = ggHold(pL, gate); pS = ggHold(pS, gate);
    var pick = null, plan = null, alt = null;
    if (pL && pL.tier === 'TICKET' && (!pS || pS.tier !== 'TICKET' || (pS.rr1 < pL.rr1))){ pick = 'long'; plan = pL; alt = pS; }
    else if (pS && pS.tier === 'TICKET'){ pick = 'short'; plan = pS; alt = pL; }
    else if (pL && (pL.grade === 'A' || pL.grade === 'A+')){ pick = 'long'; plan = pL; alt = pS; }
    else if (pS && (pS.grade === 'A' || pS.grade === 'A+')){ pick = 'short'; plan = pS; alt = pL; }
    __gg.snap = { ok: true, at: Date.now(), style: style, ev: ev, mL: mL, mS: mS,
      planL: pL, planS: pS, pick: pick, plan: plan, alt: alt, gate: gate,
      gsHtml: (gsAudit && typeof W.hgGaneshAuditHtml === 'function') ? W.hgGaneshAuditHtml(gsAudit) : '' };
    /* the forward record: one mint per closed bar, TICKET only -- and
       (hg-v1154) a ticket the calendar WITHHELD, written ticket:false with
       the weekend mark, so the weekend population is separable rather than
       silently absent. */
    try{
      var shutRead = (gate && gate.weekend && (gate.weekend.inWeekend === true || gate.weekend.inWeekend === false))
        ? gate.weekend.inWeekend : undefined;
      if (plan && (plan.tier === 'TICKET' || plan.ticketWithheld === true) && typeof W.hgFwdRecordScan === 'function' && ev.lastT !== __gg.lastBar){
        __gg.lastBar = ev.lastT;
        W.hgFwdRecordScan('GANESHGOLD', (style === 'scalp') ? '15m' : '4h', [{
          sym: 'XAUUSD', dir: plan.dir, entry: +plan.entry, stop: +plan.stop,
          t1: fin(plan.t1) ? +plan.t1 : undefined, t2: fin(plan.t2) ? +plan.t2 : undefined,
          /* hg-v1154: dated on the bar the model read (hg-v978), the feed
             those bars came from (hg-v979), and the gold calendar's verdict
             on that bar -- absent when the calendar could not read it,
             never a guessed false. */
          signalT: barMs !== null ? barMs : undefined,
          feed: ggFeed((style === 'scalp') ? '15m' : '4h'),
          goldShut: shutRead,
          goldShutWhy: (shutRead === true && gate.weekend.why) ? String(gate.weekend.why) : undefined,
          held: plan.held || undefined,
          /* hg-v1150: THE MARK CARRIER — the ledger census requires every
             record writer to carry the price the plan was minted against
             (without it the fill-aware settlement stands aside, and a limit
             that never filled could be settled as a market order). ev.px is
             the last closed tape price the whole model read. */
          mark: fin(ev.px) ? +ev.px : undefined,
          /* hg-v1163: the free-feed + indicator-stack marks and the PAXG funding
             print (the ledger derives the G4 verdict from it) */
          reads: (plan.freeReads && typeof plan.freeReads === 'object') ? plan.freeReads : undefined,
          fundingPct: (typeof plan.fundingPct === 'number' && isFinite(plan.fundingPct)) ? plan.fundingPct : undefined,
          mechanic: 'GANESHGOLD-' + (style === 'scalp' ? 'SCALP' : 'SWING'),
          ticket: plan.ticketWithheld !== true, style: 'ganeshgold-' + style
        }]);
      }
    }catch(eRec){ }
    return __gg.snap;
  }catch(e){
    __gg.snap = { ok: false, note: 'scan failed: ' + String(e && e.message ? e.message : e), at: Date.now(), style: style };
    return __gg.snap;
  }finally{ __gg.busy = false; }
}

function chip(v, cls){ return '<span class="gpip' + (cls || '') + '">' + escH(v) + '</span>'; }
function stepRow(n, label, v, cls){ return '<div class="kv"><span class="k">' + n + '. ' + label + '</span><span class="v">' + v + '</span></div>'; }

function pipelineHtml(snap){
  var ev = snap.ev, rows = [];
  rows.push(stepRow(1, 'HTF bias', ev.htfBias ? ev.htfBias.toUpperCase() : 'UNREAD', ev.htfBias ? '' : ''));
  rows.push(stepRow(2, 'Market structure', ev.struct ? String(ev.struct).toUpperCase() : 'UNREAD'));
  rows.push(stepRow(3, 'Major liquidity', 'sell ' + (fin(ev.sellLiq) ? ev.sellLiq.toFixed(2) : 'UNREAD') + ' | buy ' + (fin(ev.buyLiq) ? ev.buyLiq.toFixed(2) : 'UNREAD')));
  rows.push(stepRow(4, 'Key levels', 'PDH ' + (fin(ev.lv.pdh) ? ev.lv.pdh.toFixed(2) : 'UNREAD') + ' | PDL ' + (fin(ev.lv.pdl) ? ev.lv.pdl.toFixed(2) : 'UNREAD') + ' | Wk ' + (fin(ev.lv.wkH) ? ev.lv.wkH.toFixed(0) + '/' + ev.lv.wkL.toFixed(0) : 'UNREAD')));
  rows.push(stepRow(5, 'Premium / discount', ev.pd));
  rows.push(stepRow(6, 'Session context', ev.sess + (ev.sess === 'ASIA' ? ' - quiet hours' : '')));
  rows.push(stepRow(7, 'DXY + yields', 'DXY ' + (ev.dxT || 'UNREAD') + ' | TNX ' + (ev.tnxT || 'UNREAD')));
  rows.push(stepRow(8, 'News / macro', ev.news || 'UNREAD'));
  rows.push(stepRow(9, 'Liquidity sweep', (ev.sweptSell ? 'sell-side SWEPT ' : 'sell-side no ') + '| ' + (ev.sweptBuy ? 'buy-side SWEPT' : 'buy-side no')));
  rows.push(stepRow(10, 'Displacement', ev.disp ? ('1.5xATR ' + ev.disp.dir.toUpperCase()) : 'none in the last 4 bars'));
  rows.push(stepRow(11, 'MSS / BOS', (ev.mssUp ? 'BOS UP ' : '') + (ev.mssDown ? 'BOS DOWN' : '') || 'none'));
  rows.push(stepRow(12, 'FVG / OB retest', ev.zone ? (ev.zone.dir.toUpperCase() + ' ' + ev.zone.lo.toFixed(2) + '-' + ev.zone.hi.toFixed(2) + (ev.retest ? ' - PRICE IN ZONE' : ' - not yet retested')) : 'none'));
  rows.push(stepRow(13, 'Entry', snap.plan ? String(snap.plan.dir).toUpperCase() + ' @ ' + snap.plan.entry.toFixed(2) : 'no minted plan'));
  rows.push(stepRow(14, 'Structural SL', snap.plan ? snap.plan.stop.toFixed(2) + ' (sweep extreme + 0.5xATR)' : 'n/a'));
  rows.push(stepRow(15, 'Liquidity TP', snap.plan ? ('TP1 ' + (fin(snap.plan.t1) ? snap.plan.t1.toFixed(2) : 'n/a') + ' | TP2 ' + (fin(snap.plan.t2) ? snap.plan.t2.toFixed(2) : 'n/a') + ' | TP3 ' + (fin(snap.plan.t3) ? snap.plan.t3.toFixed(2) : 'n/a')) : 'n/a'));
  rows.push(stepRow(16, 'Size / risk', 'fixed fraction 0.25-1% of equity - size from the SL distance, never the target'));
  rows.push(stepRow(17, 'Management', 'scale 50% at TP1, stop to breakeven, ride to liquidity'));
  return '<div class="panel" style="margin-top:10px"><h3>THE 17-STEP PIPELINE <span>HTF bias to trade management - every step measured on the live tape</span></h3>' + rows.join('') + '</div>';
}

function modelHtml(title, m, plan){
  var labels = { htf: 'HTF bias', zone: 'Premium/discount', liq: 'Liquidity identified', sweep: 'Liquidity swept',
    disp: 'Displacement', mss: 'MSS/BOS', fvgob: 'FVG/OB created', retest: 'FVG/OB retest',
    dxy: 'DXY not fighting', yields: 'Yields not fighting', news: 'No red news', session: 'Session valid' };
  var rows = [];
  for (var i = 0; i < m.checks.length; i++){
    var c = m.checks[i];
    rows.push('<div class="kv"><span class="k">' + labels[c.k] + '</span><span class="v' + (c.on ? ' ok' : '') + '">' + (c.on ? 'YES' : 'no') + '</span></div>');
  }
  var head = '<div class="panel" style="margin-top:10px"><h3>' + title + ' <span>' + m.n + '/12 legs - grade ' + (m.grade || 'NONE') + '</span></h3>';
  if (plan){
    head += '<div style="font-size:12px;margin-bottom:6px">' + (plan.held ? ('HELD - ' + escH(plan.held)) : (plan.tier === 'TICKET' ? 'TICKET' : (plan.tier === 'WATCH' ? 'WATCH ONLY' : 'no plan'))) + (plan.ok ? '' : ' - R:R below the style minimum') + '</div>';
  }
  return head + rows.join('') + '</div>';
}

/* hg-v1154: the shared ANTI-CHASE geometry verdict (hg-plan.js) on the
   crowned plan against the mark it was priced on -- a stop already breached
   or a target already behind the entry is said on the card. '' when the rule
   is absent or the geometry is sound. */
function ggGeoLine(p, snap){
  try{
    if (typeof W.hgPlanGeometryLineHtml !== 'function' || !p || !snap || !snap.ev) return '';
    return W.hgPlanGeometryLineHtml({ dir: p.dir, entry: p.entry, stop: p.stop, t1: p.t1 },
                                    fin(snap.ev.px) ? snap.ev.px : NaN, { cls: 'note warn', style: 'margin-top:6px' }) || '';
  }catch(e){ return ''; }
}

function callHtml(snap){
  try{
    if (!snap.plan) return '<div class="panel" style="margin-top:10px"><h3>THE CALL</h3><div style="font-size:15px;font-weight:700">STAND ASIDE</div><div class="note" style="margin-top:4px">neither model cleared grade A on this tape - liquidity is the setup, patience is the edge.</div></div>';
    var p = snap.plan;
    var color = p.dir === 'long' ? '#26a69a' : '#ef5350';
    var html = '<div class="panel" style="margin-top:10px;border-top:3px solid ' + color + '"><h3>THE CALL</h3>'
      + '<div style="font-size:16px;font-weight:700">' + p.dir.toUpperCase() + ' - ' + (p.held ? 'HELD' : (p.tier === 'TICKET' ? 'TICKET' : 'WATCH ONLY')) + ' - XAUUSD - ' + (snap.style === 'scalp' ? 'SCALP 15m' : 'SWING 4h') + ' - grade ' + p.grade + '</div>'
      + (p.held ? '<div class="note warn" style="margin-top:4px">' + escH(p.held) + ' - the TICKET claim is withheld on the bar the model read; levels kept, recorded ticket:false for the ledger.</div>' : '')
      + '</div>';
    var payload = { v: 1, id: 'GG-XAUUSD', venue: 'delta', symbol: 'XAUUSD', side: p.dir,
      entry: +p.entry, stop: +p.stop, t1: fin(p.t1) ? +p.t1 : null, t2: fin(p.t2) ? +p.t2 : null,
      style: snap.style, grade: p.grade, rr1: fin(p.rr1) ? +p.rr1.toFixed(2) : null,
      measured: 'UNREAD', exitPolicy: 'scale50_t1_be_trail', ts: Math.floor(Date.now() / 1000) };
    html += '<div class="panel" style="margin-top:10px"><h3>SETUP CARD <span>the firm\u2019s template on the crowned model</span></h3>'
      + '<div class="kv"><span class="k">Market Thesis</span><span class="v">' + escH((p.dir === 'long' ? 'sell-side' : 'buy-side') + ' liquidity swept, displacement + ' + (snap.ev.mssUp || snap.ev.mssDown ? 'MSS' : 'structure') + ', entry on the ' + (snap.ev.zone ? snap.ev.zone.dir.toUpperCase() + ' retest' : 'zone') + ', targets at the opposing liquidity.') + '</span></div>'
      + '<div class="kv"><span class="k">Bias</span><span class="v ' + (p.dir === 'long' ? 'pos' : 'neg') + '">' + p.dir.toUpperCase() + '</span></div>'
      + '<div class="kv"><span class="k">Entry Zone</span><span class="v">[' + p.entry.toFixed(2) + ']' + (snap.ev.zone ? ' (' + snap.ev.zone.lo.toFixed(2) + ' - ' + snap.ev.zone.hi.toFixed(2) + ')' : '') + '</span></div>'
      + '<div class="kv"><span class="k">Invalidation (SL)</span><span class="v">' + p.stop.toFixed(2) + ' - beyond the sweep extreme + 0.5xATR buffer</span></div>'
      + '<div class="kv"><span class="k">Targets</span><span class="v">TP1 ' + (fin(p.t1) ? p.t1.toFixed(2) + ' (nearest liquidity)' : 'n/a') + ' | TP2 ' + (fin(p.t2) ? p.t2.toFixed(2) + ' (equal highs/lows or week level)' : 'n/a') + ' | TP3 ' + (fin(p.t3) ? p.t3.toFixed(2) + ' (HTF swing)' : 'n/a') + '</span></div>'
      + '<div class="kv"><span class="k">R:R</span><span class="v">' + (fin(p.rr1) ? p.rr1.toFixed(1) + 'R to TP1' : 'UNREAD') + (fin(p.rr2) ? ' / ' + p.rr2.toFixed(1) + 'R to TP2' : '') + '</span></div>'
      + ggGeoLine(p, snap)
      + ggReadsHtml(p)   /* hg-v1163 */
      + '<div class="kv"><span class="k">Risk</span><span class="v">0.25-1% of equity per trade - sized from the SL, never the target</span></div>'
      + '<div class="kv"><span class="k">Automation Blueprint</span><span class="v"><pre style="margin:4px 0;white-space:pre-wrap;font-size:10px">' + escH(JSON.stringify(payload, null, 2)) + '</pre>' + (p.tier === 'TICKET' ? '' : '<div class="note warn" style="margin-top:4px">formation WATCH ONLY - the bridge must drop this payload.</div>') + '</span></div>'
      + '</div>';
    return html;
  }catch(e){ return ''; }
}

function ggCoreHtml(rows){
  var suite = W.HG_GoldSuite;
  var fn = suite && suite.ganeshHits;
  if (typeof fn !== 'function') return '';
  var hits = [];
  try{ hits = fn(rows, null) || []; }catch(e){ return ''; }
  if (!hits.length) return '<div class="note" style="margin-top:8px">GANESH CORE — no seven-step pass, Gann square rejection, time-price square, or 3-hour boundary turn on the last closed bar.</div>';
  var html = '<div class="panel" style="margin-top:8px"><h3>GANESH CORE</h3>';
  for (var i = 0; i < hits.length; i++){
    var h = hits[i];
    html += '<div class="kv"><span class="k">' + escH(h.id + ' ' + String(h.dir || '').toUpperCase()) + '</span><span class="v">'
      + escH(h.name || '') + ' · ' + escH(h.why || '')
      + ' Entry ' + (isFinite(+h.entry) ? (+h.entry).toFixed(2) : 'n/a')
      + ' · SL ' + (isFinite(+h.stop) ? (+h.stop).toFixed(2) : 'n/a')
      + ' · TP ' + (isFinite(+h.target) ? (+h.target).toFixed(2) : 'n/a') + '</span></div>';
  }
  return html + '</div>';
}

function paint(el, snap){
  if (!snap.ok){
    el.innerHTML = '<div class="note warn" style="margin-top:10px">' + escH(snap.note || 'scan failed') + '</div>';
    return;
  }
  var html = (snap.ev && snap.ev.tapeNote ? snap.ev.tapeNote : '')
    + (snap.gsHtml || '')
    + '<div class="gg-board"><aside class="gg-mp-col" aria-label="Most probable setup">'
    + '<div class="gg-eye">MOST PROBABLE</div>'
    + callHtml(snap)
    + ggCoreHtml(snap.ev && snap.ev.rows)
    + '</aside><div class="gg-rest">'
    + pipelineHtml(snap)
    + modelHtml('GOLD LONG MODEL', snap.mL, snap.planL)
    + modelHtml('GOLD SHORT MODEL', snap.mS, snap.planS);
  if (snap.alt){
    html += '<div class="panel" style="margin-top:10px"><h3>ALT SIDE</h3><div class="kv"><span class="k">' + snap.alt.dir.toUpperCase() + '</span><span class="v">grade ' + (snap.alt.grade || 'NONE') + (snap.alt.tier ? ' - ' + snap.alt.tier : '') + '</span></div></div>';
  }
  html += '</div></div>';
  el.innerHTML = html;
  try{
    var fwd = el.querySelector('[data-r="ggfwd"]');
    if (fwd && typeof W.hgFwdPanelHTML === 'function') fwd.innerHTML = W.hgFwdPanelHTML('GANESHGOLD', { title: 'FORWARD - has the firm\u2019s pipeline paid?' });
  }catch(eF){}
  /* hg-v1298: PROFITABILITY AUDIT panel on this desk. Says plainly that no
     committed walk exists for GANESH GOLD so nothing can be filtered as
     profitable here; names scripts/backtest-ganeshgold.mjs as the walker
     to run on a machine with network. Appended to the ggfwd slot after the
     forward panel so a reader sees "has it paid?" first, then "can it be
     measured?". Returns '' when goldind.js is absent. */
  try{
    var fwd2 = el.querySelector('[data-r="ggfwd"]');
    if (fwd2 && typeof W.hgGoldAuditPanelHtml === 'function'){
      fwd2.innerHTML = (fwd2.innerHTML || '') + (W.hgGoldAuditPanelHtml('ganeshgold') || '');
    }
  }catch(eA){}
}

function mount(el){
  if (!el) return;
  el.innerHTML = '<style>.gg-board{display:grid;grid-template-columns:minmax(300px,400px) minmax(0,1fr);gap:14px;align-items:start;margin-top:12px}'
    + '.gg-mp-col{position:sticky;top:78px}.gg-eye{font-size:10px;letter-spacing:.22em;font-weight:800;color:#A67C12;margin-bottom:6px}'
    + '@media(max-width:980px){.gg-board{grid-template-columns:1fr}.gg-mp-col{position:static}}</style>'
    + '<div class="panel">'
    + '<h2>GANESH GOLD TRADING FIRM <span>structure + liquidity + levels + confirmation + risk - XAUUSD</span></h2>'
    + '<div class="note" style="margin-bottom:8px">The full 17-step pipeline, both models graded on the live tape: HTF bias, BOS/CHOCH/MSS, buy-side and sell-side liquidity, PDH/PDL/week levels, premium/discount, order blocks and FVGs, displacement, volume, VWAP, ATR, DXY + yields, the news calendar and the sessions. No single indicator makes a setup - agreement makes a setup.</div>'
    + '<div class="row"><button class="btn" id="ggRun">RUN GOLD SCAN</button>'
    + '<label class="note" style="margin-left:10px">Grid <select id="ggStyle"><option value="scalp" selected>SCALP 15m</option><option value="swing">SWING 4h</option></select></label>'
    + '<span class="note" id="ggStat">idle</span></div>'
    + '<div class="prog" id="ggProg" style="display:none"><i style="width:0"></i></div>'
    + '<div id="ggBody"></div>'
    + '<div data-r="ggfwd"></div>'
    + '</div>';
  var btn = el.querySelector('#ggRun'), statEl = el.querySelector('#ggStat');
  var bodyEl = el.querySelector('#ggBody'), styleSel = el.querySelector('#ggStyle');
  var progEl = el.querySelector('#ggProg');
  function setStat(t, warn){ statEl.textContent = t; statEl.className = warn ? 'note warn' : 'note'; }
  __gg.run = async function(opts){
    opts = opts || {};
    if (btn) btn.disabled = true;
    if (progEl) progEl.style.display = 'block';
    setStat('scanning XAUUSD - the 17-step pipeline\u2026');
    var t0 = Date.now();
    try{
      var snap = await ganeshGoldScan({ style: (opts.style) || (styleSel ? styleSel.value : 'scalp') });
      paint(bodyEl, snap);
      var secs = ((Date.now() - t0) / 1000).toFixed(0);
      setStat(snap.ok ? (snap.plan ? ('crown: ' + snap.plan.dir.toUpperCase() + ' - ' + snap.plan.tier + ' (' + snap.plan.grade + ')') : 'stand aside - neither model cleared grade A') + ' . ' + secs + 's' : 'failed', !snap.ok);
      return snap;
    }catch(e){
      setStat('scan failed: ' + String(e && e.message ? e.message : e), true);
      return { ok: false, note: String(e) };
    }finally{
      if (btn) btn.disabled = false;
      if (progEl) progEl.style.display = 'none';
    }
  };
  if (btn) btn.addEventListener('click', function(){ __gg.run(); });
  setTimeout(function(){ if (!__gg.ranOnce && typeof __gg.run === 'function'){ __gg.ranOnce = true; __gg.run(); } }, 500);
}

async function ganeshGoldRefresh(){
  try{
    if (__gg.busy) return 'busy';
    if (typeof __gg.run === 'function'){ return await __gg.run(); }
    return 'skipped: not run yet';
  }catch(e){ return 'error'; }
}

async function ganeshGoldWarm(opts){
  opts = opts || {};
  try{ var s = await ganeshGoldScan({ style: opts.style || 'scalp' }); return s && s.ok ? 'ganeshgold warm ok' : ('ganeshgold warm: ' + (s && s.note)); }
  catch(e){ return 'ganeshgold warm failed'; }
}

W.ganeshGoldState = function(){ try{ return __gg.snap ? JSON.parse(JSON.stringify(__gg.snap)) : null; }catch(e){ return null; } };
W.ganeshGoldScan = ganeshGoldScan;
W.ganeshGoldEval = ganeshGoldEval;
W.ganeshGoldWarm = ganeshGoldWarm;
W.ggWeekendVerdict = ggWeekendVerdict;   /* hg-v1154: the census route */

/* hg-v1298 — HG_GANESH_WALK is the evidence literal, written from
   scripts/backtest-ganeshgold-results.json by scripts/ganeshgold-evidence-
   literal.mjs. Measured:false until the first machine with network bakes
   it; the audit panel on this desk reads it and says NO MEASURED RECORD
   so a reader knows nothing on GANESH GOLD can be filtered by
   profitability until the ledger has one. */
/* --- BEGIN GENERATED HG_GANESH_WALK (hg-v1298) --- */
W.HG_GANESH_WALK = {
  measured: false,
  n: 0,
  span: null,
  note: "scripts/backtest-ganeshgold-results.json does not exist: the GANESH GOLD walk has not run on a machine that can fetch bars. The walker is wired at scripts/backtest-ganeshgold.mjs (hg-v1298). Until this bakes, nothing on this desk can be filtered by profitability — hg-v966 forbids a gate on measurement that has not happened."
};
/* --- END GENERATED HG_GANESH_WALK --- */

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'ganeshgold', label: 'GANESH GOLD', mount: mount, refresh: ganeshGoldRefresh });
})();
