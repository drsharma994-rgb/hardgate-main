/* Max-accuracy gold plan. Closed bars only for the signal.
   Fill = next open ± cost. Stop = swept wick ∓ 0.25×ATR ∓ cost.
   Target = the desk multiple of that cash risk. Same-bar stop wins.
   A gap through the stop is not a trade. Never uses the signal close as the fill.
   Loaded by gold-best-levels.js. Also safe to boot alone in a test. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function fin(v){ return typeof v === 'number' && isFinite(v); }
function gaTick(v){
  if (typeof G.hgGoldTickPx === 'function'){
    var t = G.hgGoldTickPx(v);
    if (typeof t === 'number' && isFinite(t)) return t;
  }
  return Math.round((+v) * 100) / 100;
}
function gaBarSec(rows){
  var d = [], i, a, b;
  for (i = Math.max(1, rows.length - 30); i < rows.length; i++){
    a = +(rows[i] && rows[i].t); b = +(rows[i - 1] && rows[i - 1].t);
    if (isFinite(a) && isFinite(b) && a > b) d.push(a - b);
  }
  if (!d.length) return NaN;
  d.sort(function(x, y){ return x - y; });
  var sp = d[Math.floor(d.length / 2)];
  if (sp > 1e6) sp = sp / 1000;
  return sp;
}
function gaOpenSec(bar){
  var t = bar && +bar.t;
  if (!isFinite(t) || !(t > 0)) return NaN;
  return t > 1e12 ? t / 1000 : t;
}
function gaSplitTape(rows, nowMs){
  if (!Array.isArray(rows) || rows.length < 2) return { closed: rows || [], forming: null };
  var sp = gaBarSec(rows);
  var last = rows[rows.length - 1];
  var open = gaOpenSec(last);
  var now = (isFinite(+nowMs) && +nowMs > 0) ? (+nowMs > 1e12 ? +nowMs / 1000 : +nowMs) : (Date.now() / 1000);
  if (isFinite(sp) && sp > 0 && isFinite(open) && (now - open) < sp){
    return { closed: rows.slice(0, -1), forming: last };
  }
  return { closed: rows.slice(), forming: null };
}
function gaAtr(rows, len){
  if (!rows || rows.length < len + 1) return NaN;
  var trs = [], i, h, l, pc, tr, a, k;
  for (i = 1; i < rows.length; i++){
    h = +rows[i].h; l = +rows[i].l; pc = +rows[i - 1].c;
    if (!(isFinite(h) && isFinite(l) && isFinite(pc))) return NaN;
    tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trs.push(tr);
  }
  if (trs.length < len) return NaN;
  a = 0;
  for (i = 0; i < len; i++) a += trs[i];
  a = a / len;
  for (k = len; k < trs.length; k++) a = (a * (len - 1) + trs[k]) / len;
  return a;
}
function gaExtreme(rows, key){
  var i, v, x = NaN;
  for (i = 0; i < rows.length; i++){
    v = +rows[i][key];
    if (!isFinite(v)) continue;
    if (!isFinite(x) || (key === 'l' ? v < x : v > x)) x = v;
  }
  return x;
}
function gaLeg(dir, entry, stop, target){
  if (typeof G.hgGoldLegR === 'function') return G.hgGoldLegR(dir, entry, stop, target);
  var risk = dir === 'long' ? entry - stop : stop - entry;
  var rew = dir === 'long' ? target - entry : entry - target;
  if (!(risk > 0 && rew > 0)) return null;
  return rew / risk;
}
function gaAccurateAt(closed, forming, i, o){
  var prior = closed.slice(i - o.swingBars, i);
  var bar = closed[i];
  var priorLow = gaExtreme(prior, 'l');
  var priorHigh = gaExtreme(prior, 'h');
  if (!(isFinite(priorLow) && isFinite(priorHigh) && bar)) return { ok: false, attempted: false };
  var lo = +bar.l, hi = +bar.h, cl = +bar.c;
  if (!(isFinite(lo) && isFinite(hi) && isFinite(cl))) return { ok: false, attempted: false };
  var longSweep = lo < priorLow && cl > priorLow;
  var shortSweep = hi > priorHigh && cl < priorHigh;
  if (!longSweep && !shortSweep) return { ok: false, attempted: false, reason: 'no sweep-reclaim' };
  var dir;
  if (longSweep && shortSweep){
    var wickDn = priorLow - lo, wickUp = hi - priorHigh;
    if (!(wickDn > wickUp) && !(wickUp > wickDn)){
      return { ok: false, attempted: true, reason: 'the bar swept both sides by the same wick — not one setup' };
    }
    dir = wickDn > wickUp ? 'long' : 'short';
  } else {
    dir = longSweep ? 'long' : 'short';
  }
  var nextOpen = NaN, entryBar = null;
  if (i < closed.length - 1){
    entryBar = closed[i + 1];
    nextOpen = +entryBar.o;
  } else if (forming && isFinite(+forming.o)){
    entryBar = forming;
    nextOpen = +forming.o;
  }
  if (!isFinite(nextOpen)){
    return { ok: false, attempted: true, reason: 'next open unread — the signal close is not the fill' };
  }
  var atr = gaAtr(closed.slice(0, i + 1), 14);
  if (!(isFinite(atr) && atr > 0)){
    return { ok: false, attempted: true, reason: 'ATR is not readable on the closed bars' };
  }
  var swept = dir === 'long' ? lo : hi;
  var rawStop = dir === 'long'
    ? (swept - o.securityAtr * atr - o.cost)
    : (swept + o.securityAtr * atr + o.cost);
  var rawEntry = dir === 'long' ? (nextOpen + o.cost) : (nextOpen - o.cost);
  if (dir === 'long' && !(nextOpen > rawStop)){
    return { ok: false, attempted: true, reason: 'gap through the stop — the next open is already through the long stop' };
  }
  if (dir === 'short' && !(nextOpen < rawStop)){
    return { ok: false, attempted: true, reason: 'gap through the stop — the next open is already through the short stop' };
  }
  var rawRisk = dir === 'long' ? (rawEntry - rawStop) : (rawStop - rawEntry);
  if (!(rawRisk > 0)){
    return { ok: false, attempted: true, reason: 'the stop is not beyond the entry' };
  }
  var riskAtr = rawRisk / atr;
  if (riskAtr < o.minRiskAtr){
    return { ok: false, attempted: true, reason: 'stop is inside ' + o.minRiskAtr + '×ATR — not widened, and not a setup' };
  }
  if (riskAtr > o.maxRiskAtr){
    return { ok: false, attempted: true, reason: 'stop is wider than ' + o.maxRiskAtr + '×ATR and is not pulled in to manufacture the target' };
  }
  var entry = gaTick(rawEntry), stop = gaTick(rawStop);
  var risk = dir === 'long' ? (entry - stop) : (stop - entry);
  if (!(risk > 0) || !(entry > 0)){
    return { ok: false, attempted: true, reason: 'the stop is not beyond the entry after the tick' };
  }
  var opposing = dir === 'long' ? priorHigh : priorLow;
  var room = dir === 'long' ? (opposing - entry) : (entry - opposing);
  if (isFinite(room) && room > 0 && (room / risk) + 1e-12 < o.minRr){
    return { ok: false, attempted: true, reason: 'opposing structure caps the reward under the ' + o.minRr + 'R minimum' };
  }
  var t1 = dir === 'long' ? (entry + o.rewardR * risk) : (entry - o.rewardR * risk);
  var t2 = (o.rewardR2 != null)
    ? (dir === 'long' ? (entry + o.rewardR2 * risk) : (entry - o.rewardR2 * risk))
    : null;
  var rr = gaLeg(dir, entry, stop, t1);
  if (!(fin(rr) && Math.abs(rr - o.rewardR) < 1e-6)){
    return { ok: false, attempted: true, reason: 'the target is not exactly ' + o.rewardR + 'R of the cash risk' };
  }
  var after = closed.slice(i + 1);
  if (forming && i === closed.length - 1) after = after.concat([forming]);
  var b, hitStop, hitT1, bx;
  for (b = 0; b < after.length; b++){
    bx = after[b];
    if (!bx) continue;
    if (dir === 'long'){
      hitStop = isFinite(+bx.l) && +bx.l <= stop;
      hitT1 = isFinite(+bx.h) && +bx.h >= t1;
    } else {
      hitStop = isFinite(+bx.h) && +bx.h >= stop;
      hitT1 = isFinite(+bx.l) && +bx.l <= t1;
    }
    if (hitStop){
      return { ok: false, attempted: true, reason: 'price traded through the stop — same-bar stop wins, so this is not an open setup' };
    }
    if (hitT1){
      return { ok: false, attempted: true, reason: 'target already hit — not an open setup' };
    }
  }
  var markBar = forming || closed[closed.length - 1];
  var mark = markBar && +markBar.c;
  if (isFinite(mark) && t1 !== entry){
    var traveled = dir === 'long' ? ((mark - entry) / (t1 - entry)) : ((entry - mark) / (entry - t1));
    if (isFinite(traveled) && traveled >= o.chaseFrac){
      return { ok: false, attempted: true, reason: 'do not chase — price has already covered ' + Math.round(o.chaseFrac * 100) + '% of the reward' };
    }
  }
  var plan = {
    ok: true,
    dir: dir,
    entry: entry,
    stop: stop,
    t1: t1,
    t2: t2,
    rr: rr,
    rr1: rr,
    rr2: (t2 != null) ? gaLeg(dir, entry, stop, t2) : null,
    atr: atr,
    risk: risk,
    riskAtr: risk / atr,
    nextOpen: nextOpen,
    signalClose: cl,
    swept: swept,
    opposing: opposing,
    mark: isFinite(mark) ? mark : null,
    signalT: bar && +bar.t,
    geometryOk: true,
    planSrc: 'max-accuracy structure',
    trigger: 'failed-sweep reclaim',
    reason: null,
    why: 'Entry is the next open ' + (dir === 'long' ? 'plus' : 'minus') + ' cost, not the signal close. Stop is '
      + o.securityAtr + '×ATR and the cost beyond the swept wick. Target is exactly ' + o.rewardR + 'R of that cash risk.'
  };
  if (typeof G.hgSealGoldSetup === 'function'){
    G.hgSealGoldSetup(plan);
    if (plan.geometryOk !== true){
      return { ok: false, attempted: true, reason: plan.geometryReason || 'stop or target is not beyond the entry' };
    }
    plan.ok = true;
  }
  return plan;
}

function hgGoldAccuratePlan(rows, spec){
  spec = spec || {};
  var cost = fin(+spec.cost) ? +spec.cost : 0.30;
  var swingBars = (fin(+spec.swingBars) && +spec.swingBars >= 2) ? Math.floor(+spec.swingBars) : 8;
  var securityAtr = fin(+spec.securityAtr) ? +spec.securityAtr : 0.25;
  var lookback = (fin(+spec.triggerLookback) && +spec.triggerLookback >= 1) ? Math.floor(+spec.triggerLookback) : 2;
  var minRiskAtr = fin(+spec.minRiskAtr) ? +spec.minRiskAtr : 0.5;
  var maxRiskAtr = fin(+spec.maxRiskAtr) ? +spec.maxRiskAtr : 3.5;
  var rewardR = fin(+spec.rewardR) && +spec.rewardR > 0 ? +spec.rewardR : 1.5;
  var rewardR2 = fin(+spec.rewardR2) && +spec.rewardR2 > rewardR ? +spec.rewardR2 : null;
  var minRr = fin(+spec.minRr) ? +spec.minRr : 1.2;
  var chaseFrac = fin(+spec.chaseFrac) ? +spec.chaseFrac : 0.85;
  var split = gaSplitTape(rows, spec.nowMs);
  var closed = split.closed;
  if (!closed || closed.length < swingBars + 16){
    return { ok: false, reason: 'not enough closed bars to measure the swing and the ATR' };
  }
  var fail = null;
  var lastI = closed.length - 1;
  var from = Math.max(swingBars, lastI - lookback + 1);
  var i, built, opt;
  opt = {
    cost: cost, swingBars: swingBars, securityAtr: securityAtr,
    minRiskAtr: minRiskAtr, maxRiskAtr: maxRiskAtr,
    rewardR: rewardR, rewardR2: rewardR2, minRr: minRr, chaseFrac: chaseFrac
  };
  for (i = lastI; i >= from; i--){
    built = gaAccurateAt(closed, split.forming, i, opt);
    if (built && built.ok) return built;
    if (built && built.attempted && !fail) fail = built;
  }
  if (fail) return { ok: false, reason: fail.reason, attempted: true };
  return { ok: false, reason: 'no sweep-reclaim on the last ' + lookback + ' closed bars' };
}

G.hgGoldAccuratePlan = hgGoldAccuratePlan;
})();
