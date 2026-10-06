          if (!cv || cv.source !== 'taker' || !isFinite(cv.delta) || cv.bars < TM_FLOW_MIN_WIN || cv.delta === 0){
            r.flow = { verdict: 'unreadable', why: 'no real-flow verdict', sym: bSym }; out.unreadable++; return;
          }
          var withDir = (dir === 'long') ? (cv.delta > 0) : (cv.delta < 0);
          r.flow = { verdict: withDir ? 'with' : 'against',
                     delta: Math.round(cv.delta * 100) / 100, bars: cv.bars,
                     divergence: cv.divergence || null, sym: bSym };
          if (withDir) out.with++; else out.against++;
        });
      }).catch(function(){
        try{ r.flow = { verdict: 'unreadable', why: 'fetch failed' }; out.unreadable++; }catch(e2){}
      });
    })).then(function(){
      if (idx < cands.length) return sleepMs(CHUNK_SLEEP_MS).then(oneChunk);
    });
  }
  return oneChunk().then(function(){ return out; }, function(){ return out; });
}

/* The chips — read the verdict the scan stamped, never recompute (the same
   rule as goldscalp's gsTakerFlowChipHtml). bad on AGAINST, ok on WITH,
   neutral on UNREAD (the desk looked and could not read — said, because a
   read that looked and could not speak is different from one that never
   looked), nothing when the stamp is absent (a row outside the promoted
   slice was never judged). Same stamp-with-margin markup as hgSmcChipHtml
   so the chip sits naturally beside it on every card. */
function trendmxFlowChipHtml(r){
  try{
    var f = r && r.flow;
    if (!f || !f.verdict) return '';
    var dir = tmDirOf(r) || '';
    if (f.verdict === 'against'){
      return '<span class="stamp bad" style="margin-left:6px" title="' + escH('trendmx evidence layer (hg-v1012): real Binance taker flow over '
        + (f.bars || '?') + ' 4h windows on ' + (f.sym || 'the Binance twin') + ' reads net against this ' + dir
        + ' (delta ' + (f.delta != null ? f.delta : '?') + ')'
        + (f.divergence ? ' — ' + f.divergence + ' divergence on the tape' : '')
        + '. Held off the LIMIT BOARD, never CLEAN — the row paints, the reason is named.') + '">TAKER FLOW AGAINST · HELD OFF</span>';
    }
    if (f.verdict === 'with'){
      return '<span class="stamp pass" style="margin-left:6px" title="' + escH('trendmx evidence layer (hg-v1012): real Binance taker flow over '
        + (f.bars || '?') + ' 4h windows on ' + (f.sym || 'the Binance twin') + ' backs this ' + dir
        + ' (delta ' + (f.delta != null ? f.delta : '?') + ')'
        + (f.divergence ? ' — ' + f.divergence + ' divergence on the tape' : '')
        + '. Evidence, never a composite point.') + '">TAKER FLOW WITH IT</span>';
    }
    return '<span class="stamp" style="margin-left:6px" title="' + escH('trendmx evidence layer (hg-v1012): '
      + (f.why || 'no real-flow read for this row') + ' — the read cannot speak, and what cannot speak holds nothing off') + '">TAKER FLOW UNREAD</span>';
  }catch(e){ return ''; }
}

/* FUNDING CROWDING — the fundingPct the universe already carried, read
   through the ONE house rule (hg-setup-core.js hgFundingAgainstMark — the
   G4 directional bar — so this chip can never disagree with the ledger's
   fundAgainst mark on the same row). Leaning the same way as the row's
   direction = the crowd is already stacked here = squeeze risk: a caution
   chip, never a gate, the tier unchanged — brain.js's own funding-crowding
   pattern. Absent rule, absent funding or a non-crowded read: no chip. */
function trendmxFundingChipHtml(r){
  try{
    var dir = tmDirOf(r);
    var fp = r && r.fundingPct;
    if (!dir || typeof fp !== 'number' || !isFinite(fp)) return '';
    var markFn = (typeof W.hgFundingAgainstMark === 'function') ? W.hgFundingAgainstMark : null;
    if (!markFn) return '';
    var m = markFn(fp, dir);
    if (!m || m.against !== true) return '';
    return '<span class="stamp" style="margin-left:6px" title="' + escH('funding crowding (hg-v1012, the one rule in hg-setup-core.js): funding '
      + fp.toFixed(4) + '%/interval leans the same way as this ' + dir
      + ' — the crowd is already stacked here, squeeze risk. A caution chip, never a gate, the tier unchanged.') + '">FUNDING CROWDED</span>';
  }catch(e){ return ''; }
}

/* hg-v1042: SESSION PARTICIPATION — the fire bar's volume against ITS OWN
   time-of-day slot (hgSlotMeanVol, the same correction omniroute applies).
   A quiet-hours fire on a strong composite is evidence, never a gate. */
function trendmxSlotChipHtml(r){
  try{
    if (!r || !Array.isArray(r.rows4h) || r.rows4h.length < 21) return '';
    var slotFn = (typeof W.hgSlotMeanVol === 'function') ? W.hgSlotMeanVol : null;
    if (!slotFn) return '';
    var slot = slotFn(r.rows4h, 20);
    if (!slot || !isFinite(slot.mean) || !(slot.mean > 0)) return '';
    var lv = +r.rows4h[r.rows4h.length - 1].v;
    if (!isFinite(lv) || lv <= 0) return '';
    var rv = lv / slot.mean;
    if (rv >= 0.7) return '';
    return '<span class="stamp" style="margin-left:6px" title="' + escH('session participation (hg-v1042): the fire bar traded ' + rv.toFixed(2) + 'x its own time-of-day norm — quiet hours fire on thin participation. Evidence, never a gate.') + '">SESSION THIN</span>';
  }catch(e){ return ''; }
}

/* hg-v1042: DAY-RANGE EXHAUSTION — today's range against the trailing
   20-day mean. A crown at 85%+ consumed is chasing a move already spent. */
function trendmxDayChipHtml(r){
  try{
    if (!r || !Array.isArray(r.rows4h) || r.rows4h.length < 30) return '';
    var days = {}, i, t, key, d;
    for (i = 0; i < r.rows4h.length; i++){
      t = +r.rows4h[i].t; if (!isFinite(t)) continue;
      key = String(Math.floor(t / 86400));
      d = days[key];
      if (!d) days[key] = { hi: r.rows4h[i].h, lo: r.rows4h[i].l };
      else { if (+r.rows4h[i].h > d.hi) d.hi = +r.rows4h[i].h; if (+r.rows4h[i].l < d.lo) d.lo = +r.rows4h[i].l; }
    }
    var keys = Object.keys(days).sort(), ranges = [], k;
    for (i = 0; i < keys.length; i++){
      var dd = days[keys[i]];
      if (dd.hi > dd.lo) ranges.push(dd.hi - dd.lo);
    }
    if (ranges.length < 5) return '';
    var prev = ranges.slice(-21, -1);
    if (!prev.length) return '';
    var mean = 0;
    for (k = 0; k < prev.length; k++) mean += prev[k];
    mean /= prev.length;
    if (!(mean > 0)) return '';
    var pct = Math.round(ranges[ranges.length - 1] / mean * 100);
    if (pct < 85) return '';
    return '<span class="stamp bad" style="margin-left:6px" title="' + escH('day-range exhaustion (hg-v1042): ' + pct + '% of the average daily range already consumed — chasing a move that may be spent. Evidence, never a gate.') + '">DAY ' + pct + '% SPENT</span>';
  }catch(e){ return ''; }
}

/* hg-v1042: ROUND-TRIP COST — fees as R of the stop window (the house
   hgCryptoCostR). A crown whose fees eat over a quarter of its stop is
   COST-HEAVY — the gold ledger measured that cohort to bleed. Evidence,
   never a gate. */
function trendmxCostChipHtml(r, plan){
  try{
    if (!plan || !isFinite(+plan.entry) || !isFinite(+plan.stop)) return '';
    var costFn = (typeof W.hgCryptoCostR === 'function') ? W.hgCryptoCostR : null;
    if (!costFn) return '';
    var costR = costFn(+plan.entry, +plan.stop, 'taker', 'taker');
    if (!isFinite(costR)) return '';
    if (costR > 0.25){
      return '<span class="stamp bad" style="margin-left:6px" title="' + escH('round-trip cost (hg-v1042): fees eat ' + costR.toFixed(2) + 'R of the stop window — COST-HEAVY. The gold ledger measured this cohort to bleed. Evidence, never a gate.') + '">COST-HEAVY ' + costR.toFixed(2) + 'R</span>';
    }
    return '<span class="stamp ok" style="margin-left:6px" title="' + escH('round-trip cost (hg-v1042): ' + costR.toFixed(2) + 'R of the stop window. Evidence, never a gate.') + '">COST ' + costR.toFixed(2) + 'R</span>';
  }catch(e){ return ''; }
}

async function tmLoadCoinDcxContracts(){
  var urls = [
    '/api/coindcx/instruments',
    '/api/proxy?url=' + encodeURIComponent('https://api.coindcx.com/exchange/v1/derivatives/futures/data/active_instruments?margin_currency_short_name[]=USDT')
  ];
  var last = 'coindcx list failed';
  for (var i = 0; i < urls.length; i++){
    try{
      var r = await fetch(urls[i]);
      if (!r || !r.ok){ last = 'HTTP ' + (r ? r.status : '?'); continue; }
      var j = await r.json();
      var list = Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : (j && Array.isArray(j.instruments) ? j.instruments : null));
      if (!list){ last = 'bad shape'; continue; }
      var out = [];
      for (var k = 0; k < list.length; k++){
        var s = String((list[k] && list[k].symbol) ? list[k].symbol : (list[k] || ''));
        if (/^B-[A-Z0-9]+_USDT$/.test(s) && out.indexOf(s) < 0) out.push(s);
      }
      if (out.length) return out;
    }catch(e){ last = (e && e.message) || String(e); }
  }
  throw new Error(last);
}
function tmBinanceTwin(item, tf, n){
  try{
    var base = item && item.base ? String(item.base).toUpperCase() : '';
    if (!base || typeof W.binanceKlines !== 'function') return Promise.resolve([]);
    return W.binanceKlines(base + 'USDT', tf, n).then(function(rows){ return Array.isArray(rows) ? rows : []; }).catch(function(){ return []; });
  }catch(e){ return Promise.resolve([]); }
}
function tmUnreadRow(item){
  return {
    sym: item && item.sym, base: item && item.base, exchange: (item && item.exchange) || 'coindcx',
    alsoOn: item && item.alsoOn, xu: item, score: null, comps: null, freshCross: null, adx: NaN,
    unread: true, price: null, rows4h: null, rows1h: null,
    fundingPct: item && item.fundingPct, turnoverUsd: item && item.turnoverUsd, mark: item && item.mark
  };
}
async function trendmxScanCore(hooks){
  hooks = hooks || {};
/* Map before asking Binance — a venue code means nothing to fapi. This is the
   same defect fixed in desk-scan-universe.js (v431) and brain.js (v450);
   reuse the mapping those export rather than a fifth private copy. When it is
   unavailable the Binance leg is skipped: no usable symbol means no Binance
   data, and inventing one is how this family started. */
  var fetchK = (typeof W.hgDeskFetchKlines === 'function') ? W.hgDeskFetchKlines.bind(W)
    : function(it, tf, n){
        var bSym = (typeof W.hgDeskBinanceSym === 'function')
          ? W.hgDeskBinanceSym(typeof it === 'string' ? { sym: it } : it)
          : (typeof it === 'string' ? it : null);
        return bSym ? W.binanceKlines(bSym, tf, n) : Promise.resolve([]);
      };
  if (typeof W.hgDeskLoadUniverse !== 'function'
      && (typeof W.binancePerpUniverse !== 'function' || typeof W.binanceKlines !== 'function')){
    throw new Error('missing universe layer (hgDeskLoadUniverse or binancePerpUniverse)');
  }
  var cdcxAllP = (typeof W.xuCoinDCXRows === 'function' && typeof W.hgDeskLoadCoinDCXAll === 'function')
    ? W.hgDeskLoadCoinDCXAll({ force: false, minTurnover: 0, includeUnknown: true }).catch(function(){ return null; })
    : Promise.resolve(null);
  var cdcxSymP = tmLoadCoinDcxContracts().catch(function(){ return []; });
  var uniPack = await W.hgDeskLoadUniverse({ force: true, minTurnover: TURNOVER_FLOOR });
  var allPackEarly = await cdcxAllP;
  var cdcxSymsEarly = await cdcxSymP;
  var items = uniPack.items || [];
  /* hg-v1048/hg-v1074: ALL COINDCX FUTURES - the floored universe drops
     small CoinDCX contracts, so the matrix re-reads the universe at floor 0
     and merges in every CoinDCX future it missed (deduped on venue+sym).
     hg-v1074 reads the RAW CoinDCX leg (hgDeskLoadCoinDCXAll), not the
     deduped merged universe: xuMergeLegs tags one 'exchange' per base and
     the higher-turnover venue wins, so a CoinDCX contract also listed on
     Delta/Startrader was invisible to a ['coindcx'] filter on the merged
     list. Every CoinDCX active_instruments contract now appears regardless.
     The other venues keep their floor. */
  try{
    /* Raw CoinDCX only makes sense when a CoinDCX data source exists
       (xuniverse.js). Guarding on xuCoinDCXRows also avoids a pointless
       second universe fetch on the Binance-only fallback path. */
    if (allPackEarly){
      var allPack = allPackEarly;
      var cdcxAll = Array.isArray(allPack.items) ? allPack.items : [];
      var seenU = {};
      for (var ui = 0; ui < items.length; ui++) seenU[String(items[ui].exchange || '') + '|' + String(items[ui].sym || '')] = 1;
      for (var uj = 0; uj < cdcxAll.length; uj++){
        var uitem = cdcxAll[uj];
        var uk = String(uitem.exchange || '') + '|' + String(uitem.sym || '');
        if (!seenU[uk]){ items.push(uitem); seenU[uk] = 1; }
      }
    }
  }catch(eUni){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('trendmx', eUni); }catch(eWu){} }
  /* BATCH 1130 — the instrument list is the source of truth. Every active
     CoinDCX USDT future is on the board, including contracts the merged
     universe dropped because another venue won the base or the $5M floor
     cut them. A symbol already queued is not added twice. */
  try{
    var cdcxSyms = cdcxSymsEarly || [];
    var seenSym = {};
    for (var si = 0; si < items.length; si++) seenSym[String(items[si].sym || '')] = 1;
    for (var ci2 = 0; ci2 < cdcxSyms.length; ci2++){
      var csym = cdcxSyms[ci2];
      if (seenSym[csym]) continue;
      items.push({
        sym: csym,
        base: csym.replace(/^B-/, '').replace(/_USDT$/, ''),
        exchange: 'coindcx',
        turnoverUsd: null, mark: null, fundingPct: null, alsoOn: null
      });
      seenSym[csym] = 1;
    }
    uniPack.cdcxListed = cdcxSyms.length;
  }catch(eCdx){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('trendmx', eCdx); }catch(eW2){} }
  if (!items.length) throw new Error('universe empty' + (uniPack.note ? ' — ' + uniPack.note : ''));
  function tmFetchTf(item, tf, n, minLen){
    return fetchK(item, tf, n).then(function(rows){
      if (rows && rows.length >= minLen) return rows;
      return tmBinanceTwin(item, tf, n).then(function(twin){
        if (twin && twin.length > ((rows && rows.length) || 0)) return twin;
        return (rows && rows.length) ? rows : [];
      });
    }).catch(function(){ return []; });
  }
  var results = [], failed = 0;
  for (var i = 0; i < items.length; i += CHUNK){
    var chunk = items.slice(i, i + CHUNK);
    if (typeof hooks.setProg === 'function') hooks.setProg((i + chunk.length) / items.length);
    var rs = await Promise.all(chunk.map(function(item){
      return Promise.all([
        tmFetchTf(item, '4h', 260, 210),
        tmFetchTf(item, '1d', 260, 1),
        tmFetchTf(item, '1h', 72, 1)
      ]).then(function(got){
        var r4 = got[0], r1 = got[1], r1h = got[2];
        if (!r4 || !r4.length || !r1 || !r1.length) return tmUnreadRow(item);
        /* Score, gates and plan formation must share one closed-bar snapshot.
           The 15m confirmation and forward ledger already judge closed bars;
           partial daily / 4H candles let the same row disagree with them. */
        var r4c = tmClosedRows(r4, 14400);
        var r1c = tmClosedRows(r1, 86400);
        var r1hc = tmClosedRows(r1h, 3600);
        if (!r4c.length || !r1c.length) return tmUnreadRow(item);
        var ts = trendScore(r1c, r4c);
        var row = {
          sym: item.sym, base: item.base, exchange: item.exchange || 'binance', alsoOn: item.alsoOn,
          xu: item, score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx,
          rsi: ts.rsi,
          volDiv: ts.volDiv, volConf: ts.volConf,
          price: r4c[r4c.length - 1].c, rows4h: r4c, rows1d: r1c, rows1h: r1hc.length ? r1hc : null,
          fundingPct: item.fundingPct, turnoverUsd: item.turnoverUsd, mark: item.mark
        };
        var dir = tmDirOf(row);
        row.gate = dir ? trendmxGateEval(row, dir) : null;
        return row;
      }).catch(function(){ return null; });
    }));
    for (var j = 0; j < rs.length; j++){ if (rs[j]) results.push(rs[j]); else failed++; }
    if (typeof hooks.onBatch === 'function'){
      try {
        hooks.onBatch({
          rows: results.slice(),
          done: Math.min(i + chunk.length, items.length),
          total: items.length,
          batch: Math.floor(i / CHUNK) + 1,
          batches: Math.ceil(items.length / CHUNK),
          failed: failed
        });
      } catch (eBatch) {}
    }
    if (i + CHUNK < items.length) await sleepMs(CHUNK_SLEEP_MS);
  }
  return {
    rows: results, failed: failed, uniLen: uniPack.rawLen || items.length,
    scanned: items.length, at: Date.now(), note: uniPack.note, source: uniPack.source,
    venueCounts: uniPack.venueCounts
  };
}


async function tmProxyJson(url){
  try{
    var r = await fetch('/api/proxy?url=' + encodeURIComponent(url));
    if (!r || !r.ok) return null;
    return await r.json();
  }catch(e){ return null; }
}
async function tmProxyText(url){
  try{
    var r = await fetch('/api/proxy?url=' + encodeURIComponent(url));
    if (!r || !r.ok) return null;
    return await r.text();
  }catch(e){ return null; }
}
function tmYahooChange(j){
  try{
    var q = j.chart.result[0].indicators.quote[0].close.filter(function(v){ return isFinite(v); });
    if (q.length < 2 || !(q[0] > 0)) return null;
    return (q[q.length - 1] - q[0]) / q[0];
  }catch(e){ return null; }
}
function tmSeriesEnds(j, key){
  var caps = j && j[key];
  if (!caps || caps.length < 2) return null;
  var a = +caps[0][1], b = +caps[caps.length - 1][1];
  if (!(a > 0) || !(b > 0)) return null;
  return { a: a, b: b };
}
function tmSpreadChange(total, parts){
  if (!total) return null;
  var a = total.a, b = total.b, i;
  for (i = 0; i < parts.length; i++){
    if (!parts[i]) return null;
    a -= parts[i].a;
    b -= parts[i].b;
  }
  if (!(a > 0)) return null;
  return (b - a) / a;
}
function tmYahooDir(j){
  try{
    var q = j.chart.result[0].indicators.quote[0].close.filter(function(v){ return isFinite(v); });
    if (q.length < 2) return null;
    return q[q.length - 1] > q[q.length - 2];
  }catch(e){ return null; }
}
function tmCapChange(j){
  var caps = j && j.market_caps;
  if (!caps || caps.length < 2) return null;
  var a = caps[0][1], b = caps[caps.length - 1][1];
  if (!(a > 0) || !(b > 0)) return null;
  return (b - a) / a;
}
function tmSessionVwap(rows1h){
  if (!rows1h || !rows1h.length) return NaN;
  var day = Math.floor(Date.now() / 1000 / 86400);
  var pv = 0, vv = 0, n = 0;
  for (var i = 0; i < rows1h.length; i++){
    var r = rows1h[i];
    if (!r) continue;
    var open = tmBarOpenSec(r);
    if (!isFinite(open) || Math.floor(open / 86400) !== day) continue;
    var v = r.v > 0 ? r.v : 0;
    if (!(v > 0)) continue;
    pv += ((r.h + r.l + r.c) / 3) * v;
    vv += v;
    n++;
  }
  return (n >= 2 && vv > 0) ? pv / vv : NaN;
}

function tmWeeklyRows(rowsD){
  if (!rowsD || rowsD.length < 20) return null;
  var weeks = [], cur = null;
  for (var i = 0; i < rowsD.length; i++){
    var r = rowsD[i];
    if (!r) continue;
    var open = tmBarOpenSec(r);
    if (!isFinite(open)) continue;
    var wk = Math.floor(open / (7 * 86400));
    if (!cur || cur.wk !== wk){
      if (cur) weeks.push(cur);
      cur = { wk: wk, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0 };
    } else {
      if (r.h > cur.h) cur.h = r.h;
      if (r.l < cur.l) cur.l = r.l;
      cur.c = r.c;
      cur.v += r.v || 0;
    }
  }
  if (cur) weeks.push(cur);
  return weeks.length >= 8 ? weeks : null;
}
function tmVolumeProfile(rows){
  if (!rows || rows.length < 40) return null;
  var use = rows.slice(-120);
  var lo = Infinity, hi = -Infinity, k;
  for (k = 0; k < use.length; k++){
    if (use[k].l < lo) lo = use[k].l;
    if (use[k].h > hi) hi = use[k].h;
  }
  if (!(hi > lo)) return null;
  var bins = 24, vol = [], step = (hi - lo) / bins;
