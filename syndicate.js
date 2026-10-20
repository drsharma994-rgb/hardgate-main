/* =========================================================================
HARDGATE — syndicate.js
SYNDICATE. CoinDCX futures only. Analysis only. Never sends an order.

SUMMARY OF THE DESK, READ BEFORE ANY STAGE RUNS
------------------------------------------------
This file is the whole syndicate. The stages run in this order, and each
one may only use what the previous one handed it plus a feed that actually
returned. A missing feed is named "unread". It is not zero, not a safe
calendar, not a liquidation sweep, and not a leverage number.

  1. News aggregator
     Collects the headlines and the calendar the NEWS tab already parsed.
     It does not write headlines.

  2. News consolidator
     Keeps items that can bear on a setup: whale, wallet, and flow words,
     and bullish or bearish headlines. A headline about a different coin
     does not vote. The lean can agree with a structure or stand a setup
     down. It cannot invent the direction.

  3. Architect
     4h closed bars only. Direction is higher highs and higher lows, or
     the mirror. The zone is the latest unmitigated fair-value gap in that
     direction, else the last opposite candle before it. 1h must agree.
     15m is the ATR tape, not a second vote.

  4. Sniper
     Funding, open interest, liquidation clusters, and the book. CoinDCX
     public marks used here carry a mark, not those four. When they are
     absent the Architect's zone is NOT moved. The card says the entry was
     not placed behind a sweep.

  5. Navigator
     BTC 15m stability, BTC.D and DXY when the regime snapshot has them,
     and a high-impact event inside an hour of the scan. An unread gauge
     is not "all clear". The snapshot stores DXY as RISING or FALLING;
     those words are the same read as UP and DOWN. Any other word stays
     unread. Majors (BTC, ETH, SOL) do not need BTC.D. An alt long still
     uses the house rule: BTC.D above 55, or a rising DXY, refuses the
     long. A BTC bar wider than 2 ATR refuses the timing. A missing
     calendar is named. It is not treated as a blackout. USDT dominance
     is not on a readable series in this house, so it is not a vote.

  6. Memory
     Only a reaction the user logged on a previous card (PERFECT_FILL,
     MISSED_BY_TICKS, STOPPED_OUT). A percent is applied only when the user
     typed one. There is no default 0.8% lesson. The shift happens before
     the quant scores the zone, so a moved limit is the one that has to
     clear 1:2.2. Memory does not cast one of the five votes.

  7. Quant
     Stop is the far side of the zone minus (long) or plus (short) 1.5
     times the 15m ATR(14). Targets are 4h swing prices beyond the entry,
     never a multiple painted where no swing exists. Net R subtracts the
     house CoinDCX round-trip of 0.20% (cryptoscan's published figure, not
     a live fee quote). Below 1:2.2 the setup stands by. The target is not
     widened to make the ratio. Leverage is never suggested: the public
     mark has no maintenance margin, so a liquidation price would be a guess.

  8. Headmaster
     The five votes are the architect, the consolidator, the sniper, the
     navigator, and the quant. The sniper does not vote yes while the book
     and the liquidation map are unread. If fewer than three of those five
     agree, or any stage refuses, the status is STANDBY and the line says
     what to wait for. Three agreeing stages can be a blueprint while the
     other two are unread. The score is "N of 5", not a padded percentage.

24×7 means the tab repeats the same relay every 5 minutes while it is
open. Closing the tab stops it. Nothing on the server keeps talking after
that, and nothing in this file calls an order endpoint.

Classic script, IIFE. CRYPTO group, id syndicate, label SYNDICATE.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var SPEC = {
  id: 'syndicate',
  label: 'SYNDICATE',
  feeRt: 0.002,
  minNetRr: 2.2,
  atrLen: 14,
  atrStopMult: 1.5,
  swing: 2,
  shockAtr: 2,
  btcdAltLong: 55,
  blackoutMin: 60,
  majors: { BTC: 1, ETH: 1, SOL: 1 },
  pollMs: 5 * 60 * 1000,
  votes: 5
};

var SEC = { '15m': 900, '1h': 3600, '4h': 14400 };
var RES = { '15m': '15', '1h': '60', '4h': '240' };

function fin(n){ return typeof n === 'number' && isFinite(n); }
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function px(n){
  if (!fin(n)) return '—';
  var a = Math.abs(n);
  if (a >= 100) return n.toFixed(2);
  if (a >= 1) return n.toFixed(4);
  return n.toFixed(6);
}
function pairOk(pair){
  return /^B-[A-Z0-9]+_(USDT|INR)$/.test(String(pair || ''));
}
function baseOf(pair){
  var m = /^B-([A-Z0-9]+)_(USDT|INR)$/.exec(String(pair || ''));
  return m ? m[1] : null;
}

function synDropForming(rows, tf, nowMs){
  if (!rows || !rows.length) return [];
  var sec = SEC[tf];
  if (!sec || !fin(nowMs)) return rows.slice();
  var last = rows[rows.length - 1];
  var open = barMs(last);
  if (open == null) return rows.slice();
  if (open + sec * 1000 > nowMs) return rows.slice(0, -1);
  return rows.slice();
}

function barMs(row){
  if (!row || row.t == null || row.t === '') return null;
  var t = typeof row.t === 'number' ? row.t : Date.parse(row.t);
  if (!fin(t)) return null;
  if (t > 0 && t < 1e12) t = t * 1000;
  return t;
}

function cleanBars(rows){
  if (!Array.isArray(rows)) return null;
  var out = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r) continue;
    var o = +r.o, h = +r.h, l = +r.l, c = +r.c;
    if (![o, h, l, c].every(fin)) continue;
    if (h < l || h < Math.max(o, c) || l > Math.min(o, c)) continue;
    out.push({ t: barMs(r), o: o, h: h, l: l, c: c, v: fin(+r.v) ? +r.v : 0 });
  }
  out.sort(function(a, b){ return (a.t || 0) - (b.t || 0); });
  return out;
}

function synAtr(rows, len){
  var n = rows.length;
  var out = new Array(n);
  var i;
  for (i = 0; i < n; i++) out[i] = NaN;
  var a = null;
  for (i = 1; i < n; i++){
    var prev = rows[i - 1], r = rows[i];
    var tr = Math.max(r.h - r.l, Math.abs(r.h - prev.c), Math.abs(r.l - prev.c));
    if (a === null){
      if (i >= len){
        var s = 0, k;
        for (k = i - len + 1; k <= i; k++){
          var p = rows[k - 1], q = rows[k];
          s += Math.max(q.h - q.l, Math.abs(q.h - p.c), Math.abs(q.l - p.c));
        }
        a = s / len;
        out[i] = a;
      }
    } else {
      a = (a * (len - 1) + tr) / len;
      out[i] = a;
    }
  }
  return out;
}

function synSwings(rows){
  var L = SPEC.swing, highs = [], lows = [], i, k;
  if (!rows || rows.length < L * 2 + 1) return { highs: highs, lows: lows };
  for (i = L; i < rows.length - L; i++){
    var hi = true, lo = true;
    for (k = i - L; k <= i + L; k++){
      if (k === i) continue;
      if (!(rows[i].h > rows[k].h)) hi = false;
      if (!(rows[i].l < rows[k].l)) lo = false;
    }
    if (hi) highs.push({ i: i, px: rows[i].h });
    if (lo) lows.push({ i: i, px: rows[i].l });
  }
  return { highs: highs, lows: lows };
}

function synTrend(sw){
  if (!sw || sw.highs.length < 2 || sw.lows.length < 2) return null;
  var h1 = sw.highs[sw.highs.length - 2].px, h2 = sw.highs[sw.highs.length - 1].px;
  var l1 = sw.lows[sw.lows.length - 2].px, l2 = sw.lows[sw.lows.length - 1].px;
  if (h2 > h1 && l2 > l1) return 'long';
  if (h2 < h1 && l2 < l1) return 'short';
  return null;
}

function synGaps(rows){
  var out = [], i;
  for (i = 2; i < rows.length; i++){
    if (rows[i].l > rows[i - 2].h){
      out.push({ i: i, dir: 'long', lo: rows[i - 2].h, hi: rows[i].l });
    } else if (rows[i].h < rows[i - 2].l){
      out.push({ i: i, dir: 'short', lo: rows[i].h, hi: rows[i - 2].l });
    }
  }
  return out;
}

function gapOpen(rows, gap){
  if (!(gap.lo < gap.hi)) return false;
  var k;
  for (k = gap.i + 1; k < rows.length; k++){
    if (gap.dir === 'long' && rows[k].l <= gap.hi) return false;
    if (gap.dir === 'short' && rows[k].h >= gap.lo) return false;
  }
  return true;
}

function synOb(rows, dir, from){
  var i;
  for (i = from; i >= 0; i--){
    var up = rows[i].c > rows[i].o;
    var dn = rows[i].c < rows[i].o;
    if (dir === 'long' && dn) return { lo: rows[i].l, hi: rows[i].h, i: i };
    if (dir === 'short' && up) return { lo: rows[i].l, hi: rows[i].h, i: i };
  }
  return null;
}

function synStructure(rows){
  var clean = cleanBars(rows);
  if (!clean || clean.length < 12) return { dir: null, reason: 'tape unread' };
  var sw = synSwings(clean);
  var dir = synTrend(sw);
  if (!dir) return { dir: null, reason: '4h structure is mixed or unfinished', swings: sw };
  var lastHigh = sw.highs[sw.highs.length - 1];
  var lastLow = sw.lows[sw.lows.length - 1];
  var broken = null;
  var close = clean[clean.length - 1].c;
  if (dir === 'long'){
    var j;
    for (j = sw.highs.length - 1; j >= 0; j--){
      if (close > sw.highs[j].px){ broken = sw.highs[j]; break; }
    }
  } else {
    for (j = sw.lows.length - 1; j >= 0; j--){
      if (close < sw.lows[j].px){ broken = sw.lows[j]; break; }
    }
  }
  if (!broken) return { dir: null, reason: '4h has not broken structure', swings: sw, trend: dir };
  var gaps = synGaps(clean), zone = null, kind = null, g;
  for (g = gaps.length - 1; g >= 0; g--){
    if (gaps[g].dir === dir && gapOpen(clean, gaps[g])){ zone = { lo: gaps[g].lo, hi: gaps[g].hi }; kind = 'fvg'; break; }
  }
  if (!zone){
    var ob = synOb(clean, dir, clean.length - 2);
    if (ob && ob.lo < ob.hi){ zone = { lo: ob.lo, hi: ob.hi }; kind = 'ob'; }
  }
  if (!zone) return { dir: null, reason: 'no zone', swings: sw, trend: dir };
  return {
    dir: dir, zone: zone, kind: kind, swings: sw, trend: dir,
    bos: broken.px, lastHigh: lastHigh.px, lastLow: lastLow.px, close: close,
    reason: 'structure'
  };
}

function nearestBeyond(sw, dir, px){
  if (!sw) return { t1: null, t2: null, t3: null };
  var arr = dir === 'long' ? sw.highs : sw.lows;
  var picks = [];
  var i;
  for (i = 0; i < arr.length; i++){
    var p = arr[i].px;
    if (dir === 'long' && p > px) picks.push(p);
    if (dir === 'short' && p < px) picks.push(p);
  }
  picks.sort(function(a, b){ return dir === 'long' ? a - b : b - a; });
  return { t1: picks.length ? picks[0] : null, t2: picks.length > 1 ? picks[1] : null, t3: picks.length > 2 ? picks[2] : null };
}

function impactW(impact){
  if (impact === 'high') return 3;
  if (impact === 'med') return 2;
  if (impact === 'low') return 1;
  return 0;
}

function mentionsBase(title, base){
  var s = String(title || '');
  if (!base) return false;
  var re = new RegExp('\\b' + base + '\\b', 'i');
  if (re.test(s)) return true;
  if (base === 'BTC' && /\bbitcoin\b/i.test(s)) return true;
  if (/\b(crypto|bitcoin|market)\b/i.test(s) && !/\b[A-Z]{2,6}\b/.test(s.replace(new RegExp(base, 'g'), ''))) return true;
  return false;
}

/* A title that names some other ticker and not this base is someone else's news. */
function otherCoin(title, base){
  var s = String(title || '').toUpperCase();
  if (mentionsBase(s, base)) return false;
  return /\b(ETH|SOL|XRP|DOGE|BNB|ADA|AVAX|LINK|TON|SUI)\b/.test(s);
}

function synConsolidate(headlines, whale, base){
  var out = { lean: null, unread: false, opposeImpact: null, titles: [], note: '' };
  if (headlines == null && whale == null){
    out.unread = true;
    out.note = 'headlines and the whale tape are unread';
    return out;
  }
  var bull = 0, bear = 0, topOpp = null, titles = [], i;
  if (headlines == null){
    out.note = 'headlines unread';
  } else {
    for (i = 0; i < headlines.length; i++){
      var h = headlines[i];
      if (!h || !h.title) continue;
      if (otherCoin(h.title, base)) continue;
      if (!mentionsBase(h.title, base) && !/\b(whale|wallet|crypto|bitcoin|market)\b/i.test(h.title)) continue;
      var sent = h.sentiment;
      if (sent !== 'bullish' && sent !== 'bearish') continue;
      var w = impactW(h.impact);
      if (!w) continue;
      if (sent === 'bullish') bull += w; else bear += w;
      titles.push(String(h.title));
      if (w >= 2) topOpp = h.impact;
    }
  }
  var parts = [];
  if (headlines == null) parts.push('headlines unread');
  else if (!titles.length) parts.push('no loaded headline names this market');
  var hLean = titles.length ? (bull === bear ? null : (bull > bear ? 'bullish' : 'bearish')) : null;
  var wLean = null;
  if (whale == null) parts.push('whale tape unread');
  else if (whale.vetoDistribution === true && whale.accumulateAlt === true) parts.push('whale tape is both ways');
  else if (whale.vetoDistribution === true) wLean = 'bearish';
  else if (whale.accumulateAlt === true) wLean = 'bullish';
  if (hLean && wLean && hLean !== wLean){
    out.lean = null;
    out.conflict = true;
    out.note = 'headlines and the whale tape disagree';
    out.titles = titles.slice(0, 4);
    return out;
  }
  var leanSide = hLean || wLean;
  out.lean = leanSide;
  out.titles = titles.slice(0, 4);
  out.opposeImpact = (leanSide && topOpp) ? topOpp : (wLean ? 'high' : null);
  if (leanSide) parts.unshift(leanSide + ' from ' + (hLean ? 'headlines' : 'the whale tape'));
  out.note = parts.join('; ') || 'nothing in the loaded news names this market';
  return out;
}

function synQuant(dir, zone, atr, target, feeRt){
  var fail = function(reason){ return { ok: false, reason: reason, leverage: null }; };
  if (dir !== 'long' && dir !== 'short') return fail('no direction');
  if (!zone || !fin(zone.lo) || !fin(zone.hi) || !(zone.lo < zone.hi)) return fail('zone unread');
  if (!fin(atr) || !(atr > 0)) return fail('atr unread');
  if (!fin(target)) return fail('no structural target');
  if (!fin(feeRt) || !(feeRt > 0)) return fail('fee unread');
  var e1, e2, avg, stop;
  if (dir === 'long'){
    e1 = zone.lo;
    e2 = (zone.lo + zone.hi) / 2;
    avg = (e1 + e2) / 2;
    stop = zone.lo - SPEC.atrStopMult * atr;
    if (!(stop < zone.lo) || !(target > avg)) return fail('target is not beyond the entry');
  } else {
    e1 = zone.hi;
    e2 = (zone.lo + zone.hi) / 2;
    avg = (e1 + e2) / 2;
    stop = zone.hi + SPEC.atrStopMult * atr;
    if (!(stop > zone.hi) || !(target < avg)) return fail('target is not beyond the entry');
  }
  var feePx = avg * feeRt;
  var risk = Math.abs(avg - stop) + feePx;
  var reward = Math.abs(target - avg) - feePx;
  if (!(risk > 0) || !(reward > 0)){
    return { ok: false, reason: 'net reward does not clear the fee', leverage: null,
      entry1: e1, entry2: e2, avg: avg, stop: stop, target: target, rr: null };
  }
  var rr = reward / risk;
  return {
    ok: rr + 1e-12 >= SPEC.minNetRr,
    reason: rr + 1e-12 >= SPEC.minNetRr ? 'net r clears 2.2' : 'net r ' + rr.toFixed(2) + ' is below 2.2',
    rr: rr, entry1: e1, entry2: e2, avg: avg, stop: stop, target: target, feePx: feePx, leverage: null
  };
}

function shiftZone(zone, dir, offsetPct){
  if (!zone || !fin(offsetPct) || offsetPct <= 0 || offsetPct >= 20) return null;
  var m = offsetPct / 100;
  var lo = dir === 'long' ? zone.lo * (1 - m) : zone.lo * (1 + m);
  var hi = dir === 'long' ? zone.hi * (1 - m) : zone.hi * (1 + m);
  if (!(lo < hi)) return null;
  return { lo: lo, hi: hi };
}

function synMemory(memory, pair, dir, kind){
  var note = 'no logged reaction for this pair — no offset';
  if (!Array.isArray(memory) || !memory.length) return { zone: null, note: note, applied: false };
  var i, hit = null;
  for (i = memory.length - 1; i >= 0; i--){
    var m = memory[i];
    if (!m || m.pair !== pair || m.dir !== dir || m.kind !== kind) continue;
    hit = m;
    break;
  }
  if (!hit) return { zone: null, note: note, applied: false };
  if (hit.reaction === 'PERFECT_FILL'){
    return { zone: null, note: 'last logged fill was perfect — zone not moved', applied: false };
  }
  if (!fin(hit.offsetPct)){
    return { zone: null, note: 'a reaction is logged with no measured percent — zone not moved', applied: false };
  }
  return { offsetPct: hit.offsetPct, note: hit.reaction + ' logged at ' + hit.offsetPct + '% — zone shifted by that percent only', applied: true };
}

function shockTape(rows){
  var clean = cleanBars(rows);
  if (!clean || clean.length < SPEC.atrLen + 2) return null;
  var atr = synAtr(clean, SPEC.atrLen);
  var last = atr[clean.length - 1];
  if (!fin(last) || !(last > 0)) return null;
  var from = Math.max(1, clean.length - 8), i;
  for (i = from; i < clean.length; i++){
    if ((clean[i].h - clean[i].l) > SPEC.shockAtr * last) return true;
  }
  return false;
}

function inBlackout(events, nowMs){
  if (!Array.isArray(events) || !fin(nowMs)) return null;
  var i;
  for (i = 0; i < events.length; i++){
    var ev = events[i];
    if (!ev || ev.impact !== 'high' || !fin(ev.t)) continue;
    var ms = ev.t > 1e12 ? ev.t : ev.t * 1000;
    if (Math.abs(nowMs - ms) <= SPEC.blackoutMin * 60000) return ev;
  }
  return false;
}

function normDxy(v){
  var s = String(v == null ? '' : v).toUpperCase();
  if (s === 'UP' || s === 'RISING') return 'UP';
  if (s === 'DOWN' || s === 'FALLING') return 'DOWN';
  if (s === 'FLAT') return 'FLAT';
  return null;
}

function hgSyndicateRead(input){
  input = input || {};
  var pair = String(input.pair || '');
  var base = baseOf(pair);
  var lines = [];
  var agreed = 0;
  var result = {
    status: 'standby',
    reason: '',
    pair: pairOk(pair) ? pair : null,
    dir: null,
    agreed: 0,
    of: SPEC.votes,
    leverage: null,
    blueprint: null,
    lines: lines,
    stages: {}
  };
  function stop(reason){
    result.reason = reason;
    result.agreed = agreed;
    result.lines = lines;
    return result;
  }

  if (!pairOk(pair)) return stop('pair unread — want B-<ASSET>_USDT or B-<ASSET>_INR');

  var news = synConsolidate(input.headlines, input.whale, base);
  result.stages.news = news;
  lines.push('Aggregator → Consolidator: '
    + (input.headlines == null ? 'headlines unread' : (input.headlines.length + ' headlines loaded'))
    + '. ' + (input.whale == null ? 'Whale tape unread.' : 'Whale tape loaded.')
    + ' Neither source is written by this desk.');
  lines.push('Consolidator → Architect: ' + news.note
    + (news.titles.length ? ' (' + news.titles[0] + ')' : '')
    + '. A lean is not an entry.');

  var h4 = synStructure(input.bars && input.bars['4h']);
  var h1 = synStructure(input.bars && input.bars['1h']);
  result.stages.architect = { h4: h4, h1: h1.dir || null, h1Reason: h1.reason };
  if (!h4.dir || !h4.zone){
    lines.push('Architect → Sniper: ' + (h4.reason || 'no structure') + '. Nothing to sharpen.');
    return stop(h4.reason || 'no structure');
  }
  if (h1.dir !== h4.dir){
    lines.push('Architect → Sniper: 4h is ' + h4.dir + ' but 1h does not agree (' + (h1.reason || 'mixed') + ').');
    return stop('1h does not agree with the 4h');
  }
  agreed++;
  var zone = { lo: h4.zone.lo, hi: h4.zone.hi };
  lines.push('Architect → Sniper: 4h ' + h4.dir + ', ' + h4.kind + ' zone ' + px(zone.lo) + '–' + px(zone.hi)
    + '. Broken level ' + px(h4.bos) + '. 1h agrees. The live mark is not the entry.');

  var funding = fin(input.fundingPct) ? input.fundingPct : null;
  var sniperMoved = false;
  var sniperNote = 'funding ' + (funding == null ? 'unread' : (funding + '%'))
    + ', open interest ' + (fin(input.oi) ? String(input.oi) : 'unread')
    + ', liquidation clusters unread, book unread. The zone is not moved.';
  if (input.liq || input.book){
    sniperNote = 'a liquidation or book payload arrived in a shape this desk does not read. The zone is not moved.';
  }
  result.stages.sniper = { moved: sniperMoved, funding: funding, note: sniperNote };
  lines.push('Sniper → Navigator: ' + sniperNote);

  if (news.conflict){
    lines.push('Headmaster: headlines and the whale tape disagree. Stand by.');
    return stop('headlines and the whale tape disagree');
  }
  if (news.lean === 'bearish' && h4.dir === 'long'){
    lines.push('Headmaster: the consolidator is bearish against a long. Stand by. The headline does not become a short entry.');
    return stop('news leans bearish against the long');
  }
  if (news.lean === 'bullish' && h4.dir === 'short'){
    lines.push('Headmaster: the consolidator is bullish against a short. Stand by.');
    return stop('news leans bullish against the short');
  }
  var newsAgrees = (news.lean === 'bullish' && h4.dir === 'long') || (news.lean === 'bearish' && h4.dir === 'short');
  if (newsAgrees) agreed++;

  var navNote = '';
  var btcRows = (base === 'BTC') ? (input.bars && input.bars['15m']) : input.btcBars15;
  var shock = shockTape(btcRows);
  if (shock === null){
    navNote = 'BTC 15m stability unread. ';
  } else if (shock === true){
    lines.push('Navigator → Quant: a BTC 15m bar is wider than 2 ATR. Timing refused.');
    return stop('BTC printed a bar wider than 2 ATR — wait for a calm 15m');
  } else {
    navNote = 'BTC 15m is inside 2 ATR. ';
  }
  var blackout = inBlackout(input.events, input.nowMs);
  if (blackout === null && input.events == null){
    navNote += 'Calendar unread. ';
  } else if (blackout && blackout.title){
    lines.push('Navigator → Quant: high-impact event inside the hour (' + blackout.title + '). Timing refused.');
    return stop('high-impact event inside the hour — ' + blackout.title);
  } else {
    navNote += 'No high-impact event inside the hour on the loaded calendar. ';
  }
  if (!SPEC.majors[base]){
    var dxy = normDxy(input.dxyTrend);
    if (!fin(input.btcDominance) && dxy == null){
      lines.push('Navigator → Quant: ' + navNote + 'BTC.D and DXY are unread, so an alt is not called safe.');
      return stop('alt macro unread — BTC.D and DXY were not in the regime snapshot');
    }
    if (fin(input.btcDominance) && input.btcDominance > SPEC.btcdAltLong && h4.dir === 'long'){
      lines.push('Navigator → Quant: BTC.D ' + input.btcDominance + '% is above 55. Alt long refused.');
      return stop('BTC.D above 55 — alt long stands by');
    }
    if (dxy === 'UP' && h4.dir === 'long'){
      lines.push('Navigator → Quant: DXY is rising. Alt long refused.');
      return stop('DXY rising — alt long stands by');
    }
    navNote += 'Alt macro does not refuse the ' + h4.dir + '.';
  } else {
    navNote += base + ' is a major, so BTC.D is not a gate'
      + (fin(input.btcDominance) ? ' (read at ' + input.btcDominance + '%).' : ' (unread, and not filled in).');
  }
  if (shock === null){
    lines.push('Navigator → Quant: ' + navNote + ' Stability was not confirmed.');
    return stop('BTC 15m unread — timing not confirmed');
  }
  agreed++;
  result.stages.navigator = { note: navNote };
  lines.push('Navigator → Quant: ' + navNote);

  var mem = synMemory(input.memory, pair, h4.dir, h4.kind);
  if (mem.applied){
    var shifted = shiftZone(zone, h4.dir, mem.offsetPct);
    if (!shifted){
      lines.push('Memory: ' + mem.note + ' The shift was rejected because it did not leave a zone.');
    } else {
      zone = shifted;
      lines.push('Memory: ' + mem.note + ' Zone is now ' + px(zone.lo) + '–' + px(zone.hi) + '.');
    }
  } else {
    lines.push('Memory: ' + mem.note + '.');
  }
  result.stages.memory = mem;

  var m15 = cleanBars(input.bars && input.bars['15m']);
  var atrArr = m15 ? synAtr(m15, SPEC.atrLen) : null;
  var atr = (atrArr && m15.length) ? atrArr[m15.length - 1] : NaN;
  var targets = nearestBeyond(h4.swings, h4.dir, (zone.lo + zone.hi) / 2);
  var q = synQuant(h4.dir, zone, fin(atr) ? atr : NaN, targets.t1, fin(input.feeRt) ? input.feeRt : SPEC.feeRt);
  result.stages.quant = q;
  if (!q.ok){
    lines.push('Quant → Headmaster: ' + q.reason + '. The target was not widened, and no leverage was assigned.');
    lines.push('Headmaster: the weak point is the quant line above. Status STANDBY. Nobody sends an order.');
    return stop(q.reason);
  }
  agreed++;
  if (agreed < 3){
    lines.push('Headmaster: only ' + agreed + ' of 5 stages agreed. Status STANDBY.');
    return stop('fewer than 3 stages agreed');
  }

  result.status = 'blueprint';
  result.dir = h4.dir;
  result.agreed = agreed;
  result.reason = 'blueprint';
  result.blueprint = {
    pair: pair,
    dir: h4.dir,
    agreed: agreed,
    of: SPEC.votes,
    entry1: q.entry1,
    entry2: q.entry2,
    stop: q.stop,
    stopWhy: 'beyond the zone by 1.5 times the 15m ATR (' + px(atr) + ')',
    t1: q.target,
    t2: targets.t2,
    t3: targets.t3,
    rr: q.rr,
    leverage: null,
    kind: h4.kind,
    zone: zone
  };
  lines.push('Quant → Headmaster: stop ' + px(q.stop) + ' (' + result.blueprint.stopWhy + '). TP1 ' + px(q.target)
    + ' is a 4h swing. Net R ' + q.rr.toFixed(2) + ' after the 0.20% house round-trip. Leverage unread.');
  lines.push('Headmaster: ' + agreed + ' of 5 stages agreed. Sniper did not refine the zone. Status is a blueprint for manual review, not an order.');
  result.lines = lines;
  return result;
}

function hgSyndicateHtml(read){
  read = read || { status: 'standby', reason: 'tape unread', lines: [], leverage: null, agreed: 0, of: 5 };
  var lines = read.lines || [];
  var h = '<div class="panel"><h2>SYNDICATE <span>CoinDCX futures · analysis only</span></h2>'
    + '<p class="note">News is aggregated, then consolidated. The Architect, Sniper, Navigator, Quant and Memory hand that work along. The Headmaster prints one blueprint or stands by. '
    + 'The relay repeats every 5 minutes while this tab is open. Closing the tab stops it. Nothing here sends an order. Leverage is not suggested.</p></div>';
  h += '<div class="card"><div class="card-h">Stage 1 · relay</div>';
  if (!lines.length) h += '<p class="note">No relay yet.</p>';
  for (var i = 0; i < lines.length; i++) h += '<p>' + esc(lines[i]) + '</p>';
  h += '</div>';
  h += '<div class="card"><div class="card-h">Stage 2 · Headmaster</div><p>'
    + esc(lines.length ? lines[lines.length - 1] : 'No check yet.') + '</p></div>';
  if (read.status === 'blueprint' && read.blueprint){
    var b = read.blueprint;
    h += '<div class="card"><div class="card-h">Stage 3 · STATUS BLUEPRINT</div><table><tbody>'
      + row('CoinDCX futures pair', esc(b.pair))
      + row('Setup direction', esc(String(b.dir || '').toUpperCase()))
      + row('Synergy', esc(b.agreed + ' of ' + b.of + ' stages agreed. Unread stages are not counted as agreement.'))
      + row('Staggered entry', 'Limit 1 (50%) ' + px(b.entry1) + ' · Limit 2 (50%) ' + px(b.entry2) + '. Not the live print.')
      + row('Hard stop', px(b.stop) + ' — ' + esc(b.stopWhy))
      + row('Take profit', 'TP1 ' + px(b.t1) + ' · TP2 ' + px(b.t2) + ' · TP3 ' + px(b.t3))
      + row('Suggested leverage', 'not suggested — maintenance margin is not on the public mark')
      + row('Net risk-to-reward', '1 : ' + (fin(b.rr) ? b.rr.toFixed(2) : '—'))
      + '</tbody></table></div>';
  } else {
    h += '<div class="card"><div class="card-h">Stage 3 · STATUS STANDBY</div><p>'
      + esc(read.reason || 'no setup') + '</p><p class="note">Wait for that condition. No entry, stop, or target is issued in its place.</p></div>';
  }
  h += '<div class="card"><div class="card-h">Stage 4 · what did price do at the zone?</div>'
    + '<p class="note">Logged on this browser only. A percent is applied next time only if you type one. There is no default offset.</p>'
    + '<p><button type="button" class="btn" id="synPerfect">PERFECT FILL</button> '
    + '<button type="button" class="btn" id="synMissed">MISSED BY TICKS</button> '
    + '<button type="button" class="btn" id="synStopped">STOPPED OUT</button> '
    + '<input id="synOffset" inputmode="decimal" placeholder="percent, only if you measured one">'
    + '</p></div>';
  return h;
  function row(k, v){ return '<tr><td>' + esc(k) + '</td><td>' + v + '</td></tr>'; }
}

var __el = null;
var __timer = null;
var __last = null;

function memoryLoad(){
  try{
    if (!W.localStorage) return [];
    var raw = W.localStorage.getItem('hg_syndicate_memory');
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){ return []; }
}
function memorySave(arr){
  try{
    if (!W.localStorage) return;
    W.localStorage.setItem('hg_syndicate_memory', JSON.stringify(arr.slice(-50)));
  }catch(e){}
}

function parseCandles(pack){
  var rows = null;
  if (Array.isArray(pack)) rows = pack;
  else if (pack && Array.isArray(pack.data)) rows = pack.data;
  else if (pack && pack.data && Array.isArray(pack.data.data)) rows = pack.data.data;
  else if (pack && pack.data && Array.isArray(pack.data)) rows = pack.data;
  if (!rows) return null;
  var out = [];
  for (var i = 0; i < rows.length; i++){
    var b = rows[i];
    if (!b) continue;
    if (b.o != null && b.h != null) out.push(b);
    else if (b.open != null){
      out.push({
        t: b.time != null ? b.time : b.t,
        o: +b.open, h: +b.high, l: +b.low, c: +b.close, v: +b.volume
      });
    }
  }
  return out.length ? out : null;
}

async function fetchJson(url){
  if (typeof W.fetch !== 'function') return null;
  try{
    var res = await W.fetch(url, { cache: 'no-store' });
    if (!res || !res.ok) return null;
    return await res.json();
  }catch(e){ return null; }
}

async function fetchTf(pair, tf, nowMs){
  var sec = SEC[tf];
  var from = nowMs - 320 * sec * 1000;
  var url = '/api/coindcx/candles?pair=' + encodeURIComponent(pair)
    + '&from=' + from + '&to=' + nowMs + '&resolution=' + RES[tf];
  var pack = await fetchJson(url);
  var rows = parseCandles(pack);
  if (!rows) return null;
  return synDropForming(rows, tf, nowMs);
}

function markOf(pack, pair){
  if (!pack) return null;
  var body = pack.data && pack.data.prices ? pack.data : (pack.prices ? pack : null);
  if (!body || !body.prices) return null;
  var p = body.prices[pair];
  if (p && typeof p === 'object'){
    var m = +((p.mp != null) ? p.mp : p.ls);
    return fin(m) ? m : null;
  }
  return fin(+p) ? +p : null;
}

async function gather(pair){
  var nowMs = Date.now();
  var bars = { '4h': null, '1h': null, '15m': null };
  var four = fetchTf(pair, '4h', nowMs);
  var one = fetchTf(pair, '1h', nowMs);
  var fifteen = fetchTf(pair, '15m', nowMs);
  bars['4h'] = await four;
  bars['1h'] = await one;
  bars['15m'] = await fifteen;
  var btc = null;
  if (baseOf(pair) !== 'BTC') btc = await fetchTf('B-BTC_USDT', '15m', nowMs);
  var marks = await fetchJson('/api/coindcx/marks');
  var headlines = null, events = null;
  try{
    if (typeof W.hgNewsRefresh === 'function') await W.hgNewsRefresh(false);
    if (typeof W.hgNewsState === 'function'){
      var st = W.hgNewsState();
      if (st && st.loaded){
        headlines = Array.isArray(st.headlines) ? st.headlines.map(function(h){
          var scored = (typeof W.scoreHeadline === 'function') ? W.scoreHeadline(h.title) : null;
          return {
            title: h.title,
            source: h.source,
            impact: (scored && scored.impact) || h.impact,
            sentiment: (scored && scored.sentiment) || h.sentiment,
            score: scored ? scored.score : h.score
          };
        }) : [];
        events = Array.isArray(st.events) ? st.events : [];
      }
    }
  }catch(eN){ headlines = null; events = null; }
  var whale = null;
  try{
    if (typeof W.hgOnchainAltFetch === 'function' && typeof W.hgWhaleFlowAnalysis === 'function'){
      var snap = await W.hgOnchainAltFetch();
      if (snap && Array.isArray(snap.whaleTxs) && snap.whaleTxs.length){
        whale = W.hgWhaleFlowAnalysis(snap.whaleTxs, baseOf(pair));
      }
    }
  }catch(eW){ whale = null; }
  var btcd = null, dxy = null;
  try{
    if (typeof W.hgBtcdPct === 'function'){
      var b = W.hgBtcdPct();
      if (fin(b)) btcd = b;
    }
    if (typeof W.hgDxyTrend === 'function') dxy = normDxy(W.hgDxyTrend());
    if ((btcd == null || dxy == null) && typeof W.regimeState === 'function'){
      var rs = W.regimeState();
      /* +null is 0. A dark BTC.D gauge is unread, not dominance of zero. */
      if (btcd == null && rs && rs.btcdPct != null && fin(+rs.btcdPct)) btcd = +rs.btcdPct;
      if (dxy == null && rs) dxy = normDxy(rs.dxyTrend);
    }
  }catch(eD){}
  return {
    pair: pair,
    nowMs: nowMs,
    bars: bars,
    btcBars15: btc,
    mark: markOf(marks, pair),
    fundingPct: null,
    oi: null,
    headlines: headlines,
    events: events,
    whale: whale,
    btcDominance: btcd,
    dxyTrend: dxy,
    memory: memoryLoad(),
    tapeNote: (!bars['4h'] || !bars['1h'] || !bars['15m']) ? 'CoinDCX candles unread' : null
  };
}

function paint(el, read, stat){
  if (!el) return;
  var root = el.querySelector ? el.querySelector('#synOut') : null;
  var html = hgSyndicateHtml(read);
  if (root) root.innerHTML = html;
  else el.innerHTML = shell() + html;
  var st = el.querySelector ? el.querySelector('#synStat') : null;
  if (st) st.textContent = stat || '';
  wireFeedback(el, read);
}

function shell(){
  return '<div class="panel"><div><button class="btn" id="synScan" type="button">SCAN SYNDICATE</button> '
    + '<input id="synPair" value="B-BTC_USDT" autocomplete="off"> '
    + '<span class="note" id="synStat"></span></div></div><div id="synOut"></div>';
}

function wireFeedback(el, read){
  if (!el || !el.querySelector) return;
  function bind(id, reaction){
    var btn = el.querySelector('#' + id);
    if (!btn || !btn.addEventListener) return;
    btn.addEventListener('click', function(){
      if (!read || !read.blueprint){
        var st = el.querySelector('#synStat');
        if (st) st.textContent = 'nothing to log — the last relay was not a blueprint';
        return;
      }
      var field = el.querySelector('#synOffset');
      var raw = field && String(field.value || '').trim();
      var offset = raw === '' ? null : +raw;
      if (raw !== '' && !fin(offset)){
        var st2 = el.querySelector('#synStat');
        if (st2) st2.textContent = 'that percent is not a number — nothing logged';
        return;
      }
      var arr = memoryLoad();
      arr.push({
        pair: read.blueprint.pair,
        dir: read.blueprint.dir,
        kind: read.blueprint.kind,
        reaction: reaction,
        offsetPct: fin(offset) ? offset : null,
        at: Date.now()
      });
      memorySave(arr);
      var st3 = el.querySelector('#synStat');
      if (st3) st3.textContent = 'logged ' + reaction + (fin(offset) ? (' at ' + offset + '%') : ' with no percent');
    });
  }
  bind('synPerfect', 'PERFECT_FILL');
  bind('synMissed', 'MISSED_BY_TICKS');
  bind('synStopped', 'STOPPED_OUT');
}

async function run(el){
  var field = el && el.querySelector ? el.querySelector('#synPair') : null;
  var pair = field && field.value ? String(field.value).trim().toUpperCase() : 'B-BTC_USDT';
  var st = el && el.querySelector ? el.querySelector('#synStat') : null;
  if (st) st.textContent = 'reading CoinDCX candles, the news cache, and the regime snapshot';
  var input;
  try { input = await gather(pair); }
  catch (e) { input = { pair: pair, headlines: null, whale: null, bars: {} }; }
  if (input.tapeNote){
    var bare = hgSyndicateRead({ pair: pair, headlines: input.headlines, whale: input.whale, events: input.events, nowMs: input.nowMs });
    bare.reason = input.tapeNote + (bare.reason ? ' · ' + bare.reason : '');
    bare.status = 'standby';
    bare.blueprint = null;
    __last = bare;
    paint(el, bare, input.tapeNote);
    return bare;
  }
  var read = hgSyndicateRead(input);
  __last = read;
  paint(el, read, read.status === 'blueprint' ? 'blueprint — not an order' : ('standby — ' + read.reason));
  return read;
}

function mount(el){
  if (!el) return;
  __el = el;
  el.innerHTML = shell() + hgSyndicateHtml(null);
  var btn = el.querySelector && el.querySelector('#synScan');
  if (btn && btn.addEventListener) btn.addEventListener('click', function(){ return run(el); });
  try{
    if (__timer && typeof clearInterval === 'function') clearInterval(__timer);
    __timer = null;
    if (typeof setInterval === 'function'){
      __timer = setInterval(function(){
        try{
          if (__el && W.document && W.document.body && !W.document.body.contains(__el)){
            clearInterval(__timer);
            __timer = null;
            return;
          }
        }catch(e0){}
        try { run(__el); } catch (e1) {}
      }, SPEC.pollMs);
    }
  }catch(eT){}
}

function refresh(){
  if (!__el) return 'skipped';
  return run(__el);
}

W.HG_SYNDICATE_SPEC = SPEC;
W.hgSyndicateRead = hgSyndicateRead;
W.hgSyndicateHtml = hgSyndicateHtml;
W.synStructure = synStructure;
W.synQuant = synQuant;
W.synConsolidate = synConsolidate;
W.synAtr = synAtr;
W.synDropForming = synDropForming;
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: SPEC.id, label: SPEC.label, mount: mount, refresh: refresh });
})();
