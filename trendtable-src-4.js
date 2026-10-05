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
  var uniPack = await W.hgDeskLoadUniverse({ force: true, minTurnover: TURNOVER_FLOOR });
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
    if (typeof W.xuCoinDCXRows === 'function' && typeof W.hgDeskLoadCoinDCXAll === 'function'){
      var allPack = await W.hgDeskLoadCoinDCXAll({ force: false, minTurnover: 0, includeUnknown: true });
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
    var cdcxSyms = await tmLoadCoinDcxContracts();
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
  var results = [], failed = 0;
  for (var i = 0; i < items.length; i += CHUNK){
    var chunk = items.slice(i, i + CHUNK);
    if (typeof hooks.setProg === 'function') hooks.setProg((i + chunk.length) / items.length);
    var rs = await Promise.all(chunk.map(function(item){
      return fetchK(item, '4h', 260).then(function(r4){
          if (r4 && r4.length >= 210) return r4;
          return tmBinanceTwin(item, '4h', 260).then(function(twin){
            if (twin && twin.length > ((r4 && r4.length) || 0)) return twin;
            return (r4 && r4.length) ? r4 : [];
          });
        }).then(function(r4){
          if (!r4 || !r4.length) return tmUnreadRow(item);
          return Promise.all([
            fetchK(item, '1d', 260).then(function(r1){ return (r1 && r1.length) ? r1 : tmBinanceTwin(item, '1d', 260); }),
            fetchK(item, '1h', 120).then(function(r1h){ return (r1h && r1h.length) ? r1h : tmBinanceTwin(item, '1h', 120); })
          ]).then(function(rr){
            var r1 = rr[0], r1h = rr[1];
            if (!r1 || !r1.length) return tmUnreadRow(item);
            var ts = trendScore(r1, r4);
            var row = {
              sym: item.sym, base: item.base, exchange: item.exchange || 'binance', alsoOn: item.alsoOn,
              xu: item, score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx,
              rsi: ts.rsi,   /* hg-v1019: the momentum witness rides the row — chips/tier/collector read the stamp, never recompute */
              volDiv: ts.volDiv, volConf: ts.volConf,   /* hg-v1020: the volume witness's stamps, same seam */
              price: r1[r1.length - 1].c, rows4h: r4, rows1h: (r1h && r1h.length) ? r1h : null,
              fundingPct: item.fundingPct, turnoverUsd: item.turnoverUsd, mark: item.mark
            };
            var dir = tmDirOf(row);
            row.gate = dir ? trendmxGateEval(row, dir) : null;
            return row;
          });
        }).catch(function(){ return null; });
    }));
    for (var j = 0; j < rs.length; j++){ if (rs[j]) results.push(rs[j]); else failed++; }
    if (i + CHUNK < items.length) await sleepMs(CHUNK_SLEEP_MS);
  }
  return {
    rows: results, failed: failed, uniLen: uniPack.rawLen || items.length,
    scanned: items.length, at: Date.now(), note: uniPack.note, source: uniPack.source,
    venueCounts: uniPack.venueCounts
  };
}

async function trendmxScan(opts){
  opts = opts || {};
  var maxAge = (opts.maxAgeMs > 0) ? opts.maxAgeMs : (5 * 60 * 1000);
  if (!opts.force && __tmScanSnap && __tmScanSnap.at && (Date.now() - __tmScanSnap.at) < maxAge){
    return __tmScanSnap;
  }
  var core = await trendmxScanCore(opts);
  trendmxStampBtcStructure(core.rows);
  var golden = trendmxGoldenCrossSetups(core.rows);
  var death = trendmxDeathCrossSetups(core.rows);   /* hg-v1014: the mirrored desk */
  tmSmcScanPass(core.rows, golden, death);
  /* hg-v1012: the evidence layer — one capped, paced pass over the promoted
     slice, AFTER the tier inputs (score/gate/conviction) exist and BEFORE
     the snap the boards read. Never throws; what it cannot read it leaves
     unstamped, and an unstamped row is an unjudged row. */
  var flow = null;
  try{ flow = await trendmxFlowScan(core.rows); }catch(eFl){ flow = null; }
  /* hg-v1067: the shared-perfect evidence pass — the OMNIBTC read stack */
  try{ await trendmxPerfectEvidencePass(core.rows); }catch(ePf3){ }
  __tmScanSnap = {
    at: core.at, rows: core.rows, failed: core.failed, uniLen: core.uniLen, scanned: core.scanned,
    goldenCross: golden, deathCross: death, note: core.note, source: core.source, venueCounts: core.venueCounts,
    flow: flow
  };
  publishTrendmxSnap(core.rows);
  return __tmScanSnap;
}

async function trendmxWarm(opts){
  try{
    var r = await trendmxScan({ force: !!(opts && opts.force) });
    if (r && r.rows && r.rows.length) return 'warmed';
    return 'unavailable: trend matrix scan returned no rows';
  }catch(e){ return 'error: ' + ((e && e.message) || e); }
}

function trendmxCompPipsHtml(comps){
  comps = comps || {};
  return ''
    + '<span class="gpip ' + (comps.d1Trend > 0 ? 'ok' : (comps.d1Trend < 0 ? 'bad' : '')) + '" title="1D trend">1D</span>'
    + '<span class="gpip ' + (comps.d1Cross > 0 ? 'ok' : (comps.d1Cross < 0 ? 'bad' : '')) + '" title="EMA cross">X</span>'
    + '<span class="gpip ' + (comps.h4Cascade > 0 ? 'ok' : (comps.h4Cascade < 0 ? 'bad' : '')) + '" title="4H cascade">4H</span>'
    + '<span class="gpip ' + (comps.cloud > 0 ? 'ok' : (comps.cloud < 0 ? 'bad' : '')) + '" title="Cloud">CL</span>'
    + '<span class="gpip ' + (comps.adxPt !== 0 ? 'ok' : '') + '" title="ADX strength">ADX</span>';
}

function trendmxRowTier(r, plan){
  if (!r) return 'forming';
  if (plan && plan.omniDemoted) return 'near';
  if (r.gate && r.gate.veto) return 'forming';
  /* hg-v1012: real taker flow AGAINST the row's own majority caps the row
     at NEAR — it paints, the chip names why, it can never be CLEAN or sit
     on the LIMIT BOARD (the same leadership pattern as the omni principal
     above it). An unread flow caps nothing. */
  if (r.flow && r.flow.verdict === 'against') return 'near';
  /* hg-v1019: the momentum witness caps the same way — a row whose 1D RSI
     range has TURNED against its direction can never be CLEAN. An unread
     or abstaining witness caps nothing. */
  if (trendmxMomState(r, tmDirOf(r)) === 'against') return 'near';
  /* hg-v1020: and the volume witness — a swing rally the OBV trend refuses
     to confirm (or a fall it refuses to join) caps at NEAR the same way. */
  if (trendmxVolState(r, tmDirOf(r)) === 'against') return 'near';
  /* hg-v1034: the fundamental + sentiment witness caps the same way — a row
     whose coin sits in a red-folder blackout (refuse) or against a 2+ net
     checked headwind (against) can never be CLEAN. */
  var fundSt = trendmxFundState(r, tmDirOf(r));
  if (fundSt === 'refuse' || fundSt === 'against') return 'near';
  /* hg-v1057: the trend-quality witness caps the same way — a row whose own
     4h tape is CHOPPY (Choppiness >= 61.8 AND Efficiency Ratio < 0.3, the two
     instruments agreeing) can never be CLEAN: this desk trades trends and
     that tape has none to ride. Mixed or unreadable caps nothing (fail open
     — one instrument alone is not a verdict). */
  var chopSt = trendmxChopState(r);
  if (chopSt && chopSt.state === 'chop') return 'near';
  if (plan && tmValidSetup(plan) && r.gate && r.gate.clean7) return 'clean';
  if (r.gate && r.gate.nearClean) return 'near';
  return 'forming';
}

function trendmxSummaryLine(rows, golden, venueCounts){
  rows = rows || [];
  golden = golden || [];
  var sl = 0, ss = 0, fx = 0, clean = 0, near = 0, flowW = 0, flowA = 0;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r) continue;
    if (r.score >= 4) sl++;
    if (r.score <= -4) ss++;
    if (r.freshCross) fx++;
    /* hg-v1012: the flow split, read off the stamps the scan left — the
       summary names the evidence the same way the cards do */
    if (r.flow && r.flow.verdict === 'with') flowW++;
    else if (r.flow && r.flow.verdict === 'against') flowA++;
    var dir = tmDirOf(r);
    var plan = dir ? trendmxPlan(Object.assign({}, r, { dir: dir })) : null;
    var tier = trendmxRowTier(r, plan);
    if (tier === 'clean') clean++;
    else if (tier === 'near') near++;
  }
  var vc = venueCounts || {};
  var cdxN = 0;
  for (var ci = 0; ci < rows.length; ci++) if (rows[ci] && String(rows[ci].exchange || '').toLowerCase() === 'coindcx') cdxN++;
  var ven = ' · Δ' + (vc.delta || 0) + ' · CDX ' + cdxN + ' contracts · BN' + (vc.binance || 0);
  return 'scanned ' + rows.length + ven
    + ' · golden ' + golden.length
    + ' · strong +' + sl + '/−' + ss + ' · fresh crosses ' + fx
    + ' · CLEAN ' + clean + ' · NEAR ' + near
    + ((flowW + flowA) > 0 ? ' · taker flow ' + flowW + ' with / ' + flowA + ' held off' : '');
}

/* hg-v1014: one card serves both cross kinds — golden (bull, green) and
   death (bear, red). The stamp, the strategy tag and the palette read the
   ticket's own freshCross/dir; everything else is identical, because the
   desks are the same bar in both directions. */
function trendmxCrossCardHTML(g){
  if (!g || !fin(+g.entry) || !fin(+g.stop) || !fin(+g.t1)) return '';
  var isDeath = (g.freshCross === 'DEATH') || (g.dir === 'short');
  var col = isDeath ? '#b91c1c' : '#047857';
  var strat = isDeath ? 'trendmx-death' : 'trendmx-golden';
  var tradeOn = (typeof hgToTradePlanOnclickAttr === 'function')
    ? hgToTradePlanOnclickAttr(g.sym, g.dir, g.entry, g.stop, g.t1, { t2: g.t2, scanner: 'trendmx', strategy: strat })
    : '';
  var tradeBtn = tradeOn ? '<button class="toTrade" onclick="' + tradeOn + '">SEND TO TRADE PLAN →</button>' : '';
  var bookBtn = (typeof bookBtnHTML === 'function')
    ? bookBtnHTML(g.sym, g.dir, g.entry, g.stop, g.t1, { scanner: 'trendmx', strategy: strat, t2: g.t2 }) : '';
  return '<div style="flex:1 1 280px;max-width:380px;border:1px solid ' + (isDeath ? 'rgba(185,28,28,.45)' : 'rgba(5,150,105,.45)') + ';border-left:4px solid ' + col + ';border-radius:8px;padding:12px;background:' + (isDeath ? 'rgba(185,28,28,.06)' : 'rgba(5,150,105,.06)') + '">'
    + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">'
    + '<span style="font-size:14px;font-weight:800">' + escH(g.sym) + tmVenueChip(g) + '</span>'
    + '<span class="stamp ' + (isDeath ? 'bad' : 'pass') + '">' + (isDeath ? '⚡DEATH' : '⚡GOLDEN') + '</span>'
    + '<span class="stamp pass">' + escH(g.conviction || g.tier || 'CONVICTION') + '</span>'
    + '<span class="stamp ' + (isDeath ? 'bad' : 'pass') + '">' + (isDeath ? 'SHORT' : 'LONG') + '</span>'
    + tmSmcChip(g)
    + '</div>'
    + '<div style="margin-top:6px;font-size:10px;color:#64748B">' + escH(g.note || '') + '</div>'
    + '<div style="font-size:22px;font-weight:800;color:' + col + ';margin-top:6px">' + pxFmt(g.entry) + '</div>'
    + '<div class="plan" style="margin-top:6px">' + trendmxPlanHTML(g) + '</div>'
    + tradeBtn + bookBtn
    + '</div>';
}

/* hg-v1015: TWO CROSS DESKS — the v1014 combined panel is split at the
   operator's ask: the bull desk and the bear desk stand on their own, each
   its own panel, its own palette, its own sub-line. The card renderer
