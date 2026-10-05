/* HARDGATE — shivagold.js (hg-v1110)
   SHIVA GOLD TRADING FIRM. One scalp lane and one swing lane.
   A setup exists only when the chain is complete: higher-timeframe structure,
   a liquidity sweep, displacement, a structure shift, and a retest of the
   imbalance or the order block. RSI, MACD and moving-average crosses are not
   read. A missing feed is not a yes. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
if (W.__hgShivaBoot === 1110) return;
W.__hgShivaBoot = 1110;

function num(v){ return (typeof v === 'number' && isFinite(v)) ? v : NaN; }
function px(v){ v = num(v); return isFinite(v) ? v.toFixed(2) : '—'; }
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>]/g, function(c){
    return c === '&' ? '&' : c === '<' ? '<' : '>';
  });
}
function closedOf(rows){
  if (!rows || rows.length < 40) return null;
  return rows.slice(0, rows.length - 1);
}
function atr(rows, n){
  n = n || 14;
  if (!rows || rows.length < n + 1) return null;
  var i, sum = 0, prev, cur, tr;
  for (i = rows.length - n; i < rows.length; i++){
    prev = rows[i - 1];
    cur = rows[i];
    tr = Math.max(cur.h - cur.l, Math.abs(cur.h - prev.c), Math.abs(cur.l - prev.c));
    sum += tr;
  }
  return sum / n;
}
function pivots(rows, wing){
  var hi = [], lo = [], i, j, ok;
  wing = wing || 3;
  if (!rows || rows.length < wing * 2 + 5) return { hi: hi, lo: lo };
  for (i = wing; i < rows.length - wing; i++){
    ok = true;
    for (j = i - wing; j <= i + wing; j++){
      if (j !== i && rows[j].h > rows[i].h){ ok = false; break; }
    }
    if (ok) hi.push(i);
    ok = true;
    for (j = i - wing; j <= i + wing; j++){
      if (j !== i && rows[j].l < rows[i].l){ ok = false; break; }
    }
    if (ok) lo.push(i);
  }
  return { hi: hi, lo: lo };
}
function biasOf(rows){
  var p = pivots(rows, 3);
  if (p.hi.length < 2 || p.lo.length < 2) return { side: 'none', why: 'not enough swings' };
  var h1 = rows[p.hi[p.hi.length - 2]].h;
  var h2 = rows[p.hi[p.hi.length - 1]].h;
  var l1 = rows[p.lo[p.lo.length - 2]].l;
  var l2 = rows[p.lo[p.lo.length - 1]].l;
  var side = 'range';
  if (h2 > h1 && l2 > l1) side = 'long';
  else if (h2 < h1 && l2 < l1) side = 'short';
  return { side: side, high: h2, low: l2, hi: p.hi, lo: p.lo };
}
function rangeOf(rows){
  var b = biasOf(rows);
  if (!(b.high > 0) || !(b.low > 0) || b.high <= b.low) return null;
  return { high: b.high, low: b.low, eq: (b.high + b.low) / 2, side: b.side };
}
function sessionOf(date){
  var mins = date.getUTCHours() * 60 + date.getUTCMinutes();
  var london = mins >= 420 && mins < 960;
  var ny = mins >= 720 && mins < 1260;
  var name = (london && ny) ? 'London–New York' : london ? 'London' : ny ? 'New York' : 'Asia';
  return { tradable: london || ny, name: name };
}
function dayKey(sec){ return new Date(sec * 1000).toISOString().slice(0, 10); }
function dailyLevels(daily){
  var c = closedOf(daily);
  if (!c || c.length < 10) return null;
  var prev = c[c.length - 1];
  var older = c.slice(-10, -5);
  var hi = -Infinity, lo = Infinity, i;
  for (i = 0; i < older.length; i++){
    if (older[i].h > hi) hi = older[i].h;
    if (older[i].l < lo) lo = older[i].l;
  }
  return { pdh: prev.h, pdl: prev.l, weekHi: hi, weekLo: lo };
}
function asianOf(rows, now){
  if (!rows || rows.length < 8) return null;
  var end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0);
  if (now.getTime() < end) end -= 86400000;
  var start = end - 8 * 3600000;
  var hi = -Infinity, lo = Infinity, n = 0, i, ms;
  for (i = 0; i < rows.length; i++){
    ms = rows[i].t * 1000;
    if (ms >= start && ms < end){
      if (rows[i].h > hi) hi = rows[i].h;
      if (rows[i].l < lo) lo = rows[i].l;
      n++;
    }
  }
  if (n < 3 || !(hi > lo)) return null;
  return { high: hi, low: lo };
}
function pools(side, levels, asian, swings){
  var out = [];
  function add(name, level){ if (level > 0) out.push({ name: name, level: level }); }
  if (side === 'long'){
    if (levels) add('previous day low', levels.pdl);
    if (asian) add('Asian low', asian.low);
    if (levels) add('previous week low', levels.weekLo);
  } else {
    if (levels) add('previous day high', levels.pdh);
    if (asian) add('Asian high', asian.high);
    if (levels) add('previous week high', levels.weekHi);
  }
  var i;
  for (i = 0; i < swings.length; i++) add('swing', swings[i]);
  return out;
}
function targets(side, entry, levels, asian, swings){
  var raw = [];
  function add(name, level){
    if (!(level > 0)) return;
    if (side === 'long' && level > entry) raw.push({ name: name, level: level });
    if (side === 'short' && level < entry) raw.push({ name: name, level: level });
  }
  if (levels){
    add('previous day high', levels.pdh);
    add('previous day low', levels.pdl);
    add('previous week high', levels.weekHi);
    add('previous week low', levels.weekLo);
  }
  if (asian){
    add('Asian high', asian.high);
    add('Asian low', asian.low);
  }
  var i;
  for (i = 0; i < swings.length; i++) add('swing liquidity', swings[i]);
  raw.sort(function(a, b){ return side === 'long' ? a.level - b.level : b.level - a.level; });
  var out = [], seen = {};
  for (i = 0; i < raw.length; i++){
    var k = raw[i].level.toFixed(2);
    if (seen[k]) continue;
    seen[k] = 1;
    out.push(raw[i]);
  }
  return out;
}
function findSweep(rows, side, poolLevels, look){
  var start = Math.max(1, rows.length - look);
  var i, j, bar, pool, best = null;
  for (i = rows.length - 1; i >= start; i--){
    bar = rows[i];
    for (j = 0; j < poolLevels.length; j++){
      pool = poolLevels[j];
      if (side === 'long' && bar.l < pool.level && bar.c > pool.level){
        best = { index: i, level: pool.level, name: pool.name, wick: bar.l };
        return best;
      }
      if (side === 'short' && bar.h > pool.level && bar.c < pool.level){
        best = { index: i, level: pool.level, name: pool.name, wick: bar.h };
        return best;
      }
    }
  }
  return best;
}
function findImpulse(rows, side, from, a){
  var i, bar, span, loc;
  for (i = from; i < rows.length; i++){
    bar = rows[i];
    span = bar.h - bar.l;
    if (!(span >= 1.2 * a)) continue;
    loc = span > 0 ? (bar.c - bar.l) / span : 0;
    if (side === 'long' && bar.c > bar.o && loc >= 0.7) return i;
    if (side === 'short' && bar.c < bar.o && loc <= 0.3) return i;
  }
  return -1;
}
function shifted(rows, piv, side, sweepIndex, after){
  var list = side === 'long' ? piv.hi : piv.lo;
  var level = null, i, idx;
  for (i = list.length - 1; i >= 0; i--){
    idx = list[i];
    if (idx < sweepIndex){
      level = side === 'long' ? rows[idx].h : rows[idx].l;
      break;
    }
  }
  if (level == null) return null;
  for (i = Math.max(after, sweepIndex); i < rows.length; i++){
    if (side === 'long' && rows[i].c > level) return { index: i, level: level };
    if (side === 'short' && rows[i].c < level) return { index: i, level: level };
  }
  return null;
}
function findGap(rows, side, from){
  var i, top, bot, k, filled, gap = null;
  for (i = Math.max(from, 2); i < rows.length; i++){
    if (side === 'long' && rows[i].l > rows[i - 2].h){
      bot = rows[i - 2].h;
      top = rows[i].l;
      filled = false;
      for (k = i + 1; k < rows.length; k++) if (rows[k].l <= bot){ filled = true; break; }
      if (!filled) gap = { index: i, top: top, bot: bot };
    }
    if (side === 'short' && rows[i].h < rows[i - 2].l){
      top = rows[i - 2].l;
      bot = rows[i].h;
      filled = false;
      for (k = i + 1; k < rows.length; k++) if (rows[k].h >= top){ filled = true; break; }
      if (!filled) gap = { index: i, top: top, bot: bot };
    }
  }
  return gap;
}
function findBlock(rows, side, impulse){
  var i, bar;
  for (i = impulse - 1; i >= Math.max(0, impulse - 6); i--){
    bar = rows[i];
    if (side === 'long' && bar.c < bar.o) return { index: i, top: bar.h, bot: bar.l };
    if (side === 'short' && bar.c > bar.o) return { index: i, top: bar.h, bot: bar.l };
  }
  return null;
}
function inside(price, zone){
  return !!(zone && price <= zone.top && price >= zone.bot);
}
function leftTheZone(rows, side, zone){
  var i, bar;
  for (i = zone.index + 1; i < rows.length; i++){
    bar = rows[i];
    if (side === 'long' && bar.h > zone.top) return true;
    if (side === 'short' && bar.l < zone.bot) return true;
  }
  return false;
}
function brokenAfter(rows, side, sweep){
  var i;
  for (i = sweep.index + 1; i < rows.length; i++){
    if (side === 'long' && rows[i].l < sweep.wick) return true;
    if (side === 'short' && rows[i].h > sweep.wick) return true;
  }
  return false;
}

function chain(rows, side, poolLevels, mark, targetLevels, asian, swings, a){
  var sweep = findSweep(rows, side, poolLevels, 12);
  if (!sweep) return { status: 'none', why: 'no liquidity sweep on the last 12 closed bars' };
  if (brokenAfter(rows, side, sweep)) return { status: 'none', why: 'price already ran through the sweep, so the idea is invalid' };
  var impulse = findImpulse(rows, side, sweep.index, a);
  if (impulse < 0) return { status: 'none', why: 'the sweep did not displace' };
  var piv = pivots(rows, 2);
  var mss = shifted(rows, piv, side, sweep.index, impulse);
  if (!mss) return { status: 'none', why: 'displacement did not break structure' };
  var gap = findGap(rows, side, impulse);
  var block = findBlock(rows, side, impulse);
  var zone = null, kind = '';
  if (gap && inside(mark, gap)){ zone = gap; kind = 'fair value gap'; }
  else if (block && inside(mark, block)){ zone = block; kind = 'order block'; }
  else if (gap){ zone = gap; kind = 'fair value gap'; }
  else if (block){ zone = block; kind = 'order block'; }
  if (!zone) return { status: 'none', why: 'no unfilled imbalance or order block after the shift' };
  if (!leftTheZone(rows, side, zone) || !inside(mark, zone)){
    return { status: 'armed', why: 'sweep, displacement and the structure shift are in. Waiting for price to come back into the ' + kind, sweep: sweep, kind: kind };
  }
  var stop = side === 'long' ? sweep.wick - 0.15 * a : sweep.wick + 0.15 * a;
  var risk = Math.abs(mark - stop);
  if (!(risk > 0)) return { status: 'none', why: 'the stop has no distance' };
  var tps = targets(side, mark, targetLevels, asian, swings);
  var pay = [];
  var i, dist;
  for (i = 0; i < tps.length; i++){
    dist = Math.abs(tps[i].level - mark);
    if (dist >= 1.5 * risk) pay.push(tps[i]);
  }
  if (!pay.length) return { status: 'none', why: 'the next liquidity is closer than 1.5R, so there is no trade' };
  return {
    status: 'setup',
    why: 'swept ' + sweep.name + ' at ' + px(sweep.level) + ', displaced, shifted structure, and price is back in the ' + kind,
    sweep: sweep,
    kind: kind,
    entry: mark,
    stop: stop,
    t1: pay[0],
    t2: pay[1] || null,
    r1: Math.abs(pay[0].level - mark) / risk
  };
}

function htfSide(dailyBias, h4Bias){
  if (!dailyBias || !h4Bias) return { side: 'none', why: 'higher-timeframe structure unread' };
  if (dailyBias.side === 'long' && h4Bias.side === 'short') return { side: 'none', why: 'daily is bullish and 4h is bearish' };
  if (dailyBias.side === 'short' && h4Bias.side === 'long') return { side: 'none', why: 'daily is bearish and 4h is bullish' };
  if (dailyBias.side === 'long' && h4Bias.side !== 'short') return { side: 'long', why: 'daily higher highs and higher lows' + (h4Bias.side === 'range' ? ', 4h is ranging' : '') };
  if (dailyBias.side === 'short' && h4Bias.side !== 'long') return { side: 'short', why: 'daily lower highs and lower lows' + (h4Bias.side === 'range' ? ', 4h is ranging' : '') };
  if (h4Bias.side === 'long' && dailyBias.side !== 'short') return { side: 'long', why: '4h higher highs and higher lows' };
  if (h4Bias.side === 'short' && dailyBias.side !== 'long') return { side: 'short', why: '4h lower highs and lower lows' };
  return { side: 'none', why: 'higher-timeframe structure is a range' };
}

function tooClose(side, price, h4, a4){
  if (!h4 || !(a4 > 0)) return null;
  var piv = pivots(h4, 3);
  var i, level, dist;
  if (side === 'long'){
    for (i = piv.hi.length - 1; i >= 0; i--){
      level = h4[piv.hi[i]].h;
      if (level > price){
        dist = level - price;
        if (dist <= 0.3 * a4) return '4h resistance is ' + px(dist) + ' away — too close to buy';
        return null;
      }
    }
  } else {
    for (i = piv.lo.length - 1; i >= 0; i--){
      level = h4[piv.lo[i]].l;
      if (level < price){
        dist = price - level;
        if (dist <= 0.3 * a4) return '4h support is ' + px(dist) + ' away — too close to sell';
        return null;
      }
    }
  }
  return null;
}

function macroBlock(side, macro){
  if (!macro) return 'DXY and yields unread';
  var dxy = macro.dxy && macro.dxy.trend20;
  var real = macro.realYieldTrend;
  var nom = macro.tnxTrend;
  if (dxy !== 'RISING' && dxy !== 'FALLING' && dxy !== 'FLAT') return 'DXY unread';
  if (real !== 'RISING' && real !== 'FALLING' && real !== 'FLAT' && nom !== 'RISING' && nom !== 'FALLING' && nom !== 'FLAT') return 'yields unread';
  if (side === 'long' && dxy === 'RISING') return 'DXY is rising';
  if (side === 'short' && dxy === 'FALLING') return 'DXY is falling';
  if (side === 'long' && (real === 'RISING' || nom === 'RISING')) return 'yields are rising';
  if (side === 'short' && (real === 'FALLING' || nom === 'FALLING')) return 'yields are falling';
  return '';
}
function newsBlock(news){
  if (!news || news.unchecked) return 'the calendar is unread, so a news bar cannot be cleared';
  if (news.blackout) return 'a high-impact release is in the window — no trade';
  return '';
}

function evaluate(name, execRows, mark, htf, h4rows, poolLevels, levels, asian, targetSwings, macro, news, sessionOk, sessionName){
  var steps = [];
  function fail(step, why){
    steps.push([step, 'no']);
    return { name: name, status: 'none', why: why, steps: steps };
  }
  if (!execRows) return fail('tape', name + ' tape unread');
  steps.push(['tape', 'yes']);
  if (!sessionOk) return fail('session', 'the ' + sessionName + ' session is not where this lane takes an entry');
  steps.push(['session', 'yes']);
  var nb = newsBlock(news);
  if (nb) return fail('calendar', nb);
  steps.push(['calendar', 'yes']);
  if (!htf || htf.side === 'none') return fail('higher timeframe', htf ? htf.why : 'higher-timeframe structure unread');
  steps.push(['higher timeframe', 'yes']);
  var a = atr(execRows, 14);
  var a4 = atr(h4rows, 14);
  if (!(a > 0)) return fail('volatility', 'ATR unread, so the stop would be a guess');
  steps.push(['volatility', 'yes']);
  var deal = rangeOf(h4rows);
  if (!deal) return fail('premium / discount', 'the 4h dealing range is unread');
  if (htf.side === 'long' && mark >= deal.eq) return fail('premium / discount', 'price is not in a 4h discount');
  if (htf.side === 'short' && mark <= deal.eq) return fail('premium / discount', 'price is not in a 4h premium');
  steps.push(['premium / discount', 'yes']);
  var near = tooClose(htf.side, mark, h4rows, a4);
  if (near) return fail('room', near);
  steps.push(['room', 'yes']);
  var mb = macroBlock(htf.side, macro);
  if (mb) return fail('dollar and yields', mb);
  steps.push(['dollar and yields', 'yes']);
  var result = chain(execRows, htf.side, poolLevels, mark, levels, asian, targetSwings, a);
  steps.push(['sweep → displacement → shift → retest', result.status === 'setup' ? 'yes' : 'no']);
  result.name = name;
  result.side = htf.side;
  result.steps = steps;
  result.session = sessionName;
  result.htf = htf.why;
  return result;
}

function swingSwings(rows){
  var p = pivots(rows, 3), out = [], i;
  for (i = 0; i < p.hi.length; i++) out.push(rows[p.hi[i]].h);
  for (i = 0; i < p.lo.length; i++) out.push(rows[p.lo[i]].l);
  return out;
}

function render(result){
  var head, body;
  if (result.status === 'setup'){
    head = result.name + ' · ' + (result.side === 'long' ? 'LONG' : 'SHORT');
    body = result.why
      + '<br>Entry ' + px(result.entry) + ' · Stop ' + px(result.stop)
      + ' · T1 ' + px(result.t1.level) + ' (' + result.t1.name + ', ' + result.r1.toFixed(2) + 'R)'
      + (result.t2 ? ' · T2 ' + px(result.t2.level) + ' (' + result.t2.name + ')' : '')
      + '<br><span class="dim">Stop is the sweep, not a fixed dollar stop. Risk 0.5% of equity. Size = 0.005 × equity / stop distance. Equity is not on this desk.</span>';
  } else if (result.status === 'armed'){
    head = result.name + ' · WAITING FOR THE RETEST';
    body = result.why + '. This is not an entry.';
  } else {
    head = result.name + ' · NO SETUP';
    body = result.why || 'the chain is not complete';
  }
  var cls = result.status === 'setup' ? 'note' : 'note warn';
  var h = '<div class="' + cls + '"><b>' + esc(head) + '</b><br>' + body + '</div>';
  h += '<div class="cr-ind-wrap">';
  var i, step;
  for (i = 0; i < result.steps.length; i++){
    step = result.steps[i];
    h += '<div class="kv"><span class="k">' + esc(step[0]) + '</span><span class="v">' + (step[1] === 'yes' ? 'in line' : 'not in line') + '</span></div>';
  }
  if (result.htf) h += '<div class="kv"><span class="k">Structure</span><span class="v">' + esc(result.htf) + '</span></div>';
  if (result.session) h += '<div class="kv"><span class="k">Session</span><span class="v">' + esc(result.session) + '</span></div>';
  return h + '</div>';
}

async function loadRows(res, count){
  if (typeof W.getGoldCandles === 'function'){
    var got = await W.getGoldCandles(res, count);
    if (got && got.rows && got.rows.length) return { rows: got.rows, source: got.source || res };
  }
  return { rows: null, source: null };
}
async function loadFast(interval, count){
  if (typeof W.binanceKlines !== 'function') return { rows: null, source: null };
  var rows = await W.binanceKlines('XAUUSDT', interval, count);
  if (rows && rows.length) return { rows: rows, source: 'binance-xau ' + interval };
  rows = await W.binanceKlines('PAXGUSDT', interval, count);
  if (rows && rows.length) return { rows: rows, source: 'binance-paxg ' + interval };
  return { rows: null, source: null };
}

var painting = false;
async function refresh(){
  if (painting) return 'skip';
  painting = true;
  var out = document.getElementById('shivaOut');
  try{
    var daily = await loadRows('1d', 120);
    var h4 = await loadRows('4h', 240);
    var h1 = await loadRows('1h', 240);
    var m15 = await loadRows('15m', 240);
    var m5 = await loadFast('5m', 300);
    var macro = null, news = null;
    try{ if (typeof W.getGoldMacro === 'function') macro = await W.getGoldMacro(); }catch(e1){ macro = null; }
    try{
      if (typeof W.hgNewsRefresh === 'function') await W.hgNewsRefresh(false);
      if (typeof W.hgNewsRisk === 'function') news = W.hgNewsRisk('XAUUSD');
    }catch(e2){ news = null; }
    var now = new Date();
    var session = sessionOf(now);
    var dClosed = closedOf(daily.rows);
    var h4Closed = closedOf(h4.rows);
    var h1Closed = closedOf(h1.rows);
    var m5Closed = closedOf(m5.rows);
    var levels = dailyLevels(daily.rows);
    var asian = asianOf(m15.rows, now);
    var htf = htfSide(dClosed ? biasOf(dClosed) : null, h4Closed ? biasOf(h4Closed) : null);
    var mark5 = (m5.rows && m5.rows.length) ? m5.rows[m5.rows.length - 1].c : NaN;
    var mark1 = (h1.rows && h1.rows.length) ? h1.rows[h1.rows.length - 1].c : NaN;
    var sellPools = [], buyPools = [];
    if (m5Closed){
      var ps = pivots(m5Closed, 2);
      var i;
      for (i = 0; i < ps.lo.length; i++) sellPools.push(m5Closed[ps.lo[i]].l);
      for (i = 0; i < ps.hi.length; i++) buyPools.push(m5Closed[ps.hi[i]].h);
    }
    var scalpPools = htf.side === 'short'
      ? pools('short', levels, asian, buyPools)
      : pools('long', levels, asian, sellPools);
    var scalp = evaluate('SCALP', m5Closed, mark5, htf, h4Closed, scalpPools, levels, asian, h4Closed ? swingSwings(h4Closed) : [], macro, news, session.tradable, session.name);
    var swingPools = htf.side === 'short'
      ? pools('short', levels, asian, h4Closed ? swingSwings(h4Closed) : [])
      : pools('long', levels, asian, h4Closed ? swingSwings(h4Closed) : []);
    var swing = evaluate('SWING', h4Closed, mark1, htf, h4Closed, swingPools, levels, asian, dClosed ? swingSwings(dClosed) : [], macro, news, true, 'swing — any session');
    var src = [daily.source, h4.source, m5.source].filter(Boolean).join(' · ') || 'no tape';
    var html = '<div class="note"><b>SHIVA GOLD TRADING FIRM</b>'
      + '<br><span class="dim">Higher-timeframe structure, then liquidity, then a sweep, displacement, a structure shift, and a retest. No RSI. No MACD. No moving-average cross. ' + esc(src) + '.</span></div>';
    html += render(scalp) + render(swing);
    if (out) out.innerHTML = html;
  }catch(err){
    if (out) out.innerHTML = '<div class="note warn"><b>SHIVA GOLD · NO SETUP</b><br>' + esc(err && err.message ? err.message : 'the read failed') + '</div>';
  }
  painting = false;
  return 'ok';
}

function mount(pane){
  pane.innerHTML = '<div class="panel"><h2>SHIVA GOLD TRADING FIRM <span>structure · liquidity · displacement</span></h2><div id="shivaOut"><div class="note">reading the tape…</div></div></div>';
}

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'shivagold', label: 'SHIVA GOLD', mount: mount, refresh: refresh });
W.hgShivaEvaluate = evaluate;
W.hgShivaBias = biasOf;
W.hgShivaChain = chain;
W.hgShivaSession = sessionOf;
})();
