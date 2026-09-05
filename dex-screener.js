/* =========================================================================
   HARDGATE — dex-screener.js
   DEX SCREENER tab: meme-coin perp universe (Delta + CoinDCX) screened for
   OMNIROUTE explosive setups — squeeze fire, NR7 break, vol expansion,
   compression break, measured moves — before they run.

   No on-chain DEX router: this desk reads the same CEX perp tape OMNIROUTE
   uses, filtered to the meme cluster and ranked by breakout momentum.
   Closed candles only. Never invents tickets.
   ========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : this;

var TF = '4h';
var BARS = 180;
var CHUNK = 4;
var CHUNK_DELAY = 80;
var MIN_BARS = 60;
var MIN_TURNOVER = 500000;
var SHOW_MAX = 24;
var FRESH_MS = 180000;

var DEX_MEME_RE = /^(DOGE|SHIB|PEPE|1000PEPE|WIF|BONK|1000BONK|FLOKI|1000FLOKI|TRUMP|PUMP|MEME|BOME|MEW|POPCAT|NEIRO|PNUT|GOAT|ACT|FARTCOIN|AI16Z|TURBO|BRETT|MOG|PEOPLE|LUNC|1000LUNC|1000SHIB|NOT|MYRO|SLERF|WEN|SAMO|HIPPO|CAT|DOG|BABYDOGE|ELON|AIDOGE)/;

var DEX_EXPLODE_KINDS = {
  'SQUEEZE-FIRE': 5,
  'NR7-BREAK': 5,
  'VOL-EXPANSION': 5,
  'COMPRESSION-BREAK': 4,
  'DONCHIAN-DRIVE': 4,
  'MMOVE': 3,
  'ORB': 3,
  'SPRING': 3,
  'PO3': 2,
  'THREE-BAR': 2,
  'ENGULF-LEVEL': 2,
  'PIN-REJECT': 1,
  'CUSUM-SHIFT': 2
};

var __dex = { busy: false, ran: false, ui: null, snap: null, lastCardsHtml: '', lastStat: '' };

function gfn(n){ return (W && typeof W[n] === 'function') ? W[n] : null; }
function fin(v){
  if (v === null || v === undefined || v === '') return NaN;
  var n = +v;
  return isFinite(n) ? n : NaN;
}
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function dexSleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

function dexBase(item){
  var b = String((item && (item.base || item.sym)) || '').toUpperCase();
  if (b.indexOf('B-') === 0) b = b.slice(2);
  b = b.split('_')[0];
  b = b.replace(/USDT$/, '').replace(/USD$/, '');
  return b;
}

function dexIsMeme(item){
  if (!item) return false;
  var base = dexBase(item);
  if (!base) return false;
  if (DEX_MEME_RE.test(base)) return true;
  if (/MEME|PUMP|DOGE|PEPE|BONK|WIF|FLOKI|TRUMP/.test(base)) return true;
  return false;
}

function dexChg24(item, rows){
  if (item && isFinite(fin(item.chg24))) return fin(item.chg24);
  if (!rows || rows.length < 7) return null;
  var c0 = fin(rows[rows.length - 7].c);
  var c1 = fin(rows[rows.length - 1].c);
  if (!(c0 > 0 && c1 > 0)) return null;
  return (c1 - c0) / c0 * 100;
}

function dexExplodeScore(cand, item, rows){
  var s = 0;
  var kind = String(cand.kind || '').toUpperCase();
  if (DEX_EXPLODE_KINDS[kind]) s += DEX_EXPLODE_KINDS[kind];
  if (cand.grade && cand.grade.ticket) s += 6;
  else if (cand.grade && !(cand.grade.vetoes && cand.grade.vetoes.length)) s += 2;
  var chg = dexChg24(item, rows);
  if (chg !== null){
    if (chg >= 3 && chg <= 14) s += 4;
    else if (chg > 14 && chg <= 18) s += 1;
    else if (chg > 18) s -= 5;
    else if (chg < -6) s -= 3;
  }
  var to = item && item.turnoverUsd;
  if (isFinite(fin(to))){
    if (to >= 30e6) s += 3;
    else if (to >= 10e6) s += 2;
    else if (to >= MIN_TURNOVER) s += 1;
  }
  if (cand.plan && isFinite(fin(cand.plan.rr1)) && fin(cand.plan.rr1) >= 2.5) s += 1;
  cand.dexExplode = s;
  cand.dexChg24 = chg;
  return s;
}

function dexMemeFilter(uni){
  uni = uni || [];
  return uni.filter(function(item){
    if (!item || (item.exchange !== 'delta' && item.exchange !== 'coindcx')) return false;
    if (!dexIsMeme(item)) return false;
    var to = fin(item.turnoverUsd);
    if (isFinite(to) && to < MIN_TURNOVER) return false;
    return true;
  });
}

function dexSetStat(ui, msg, warn){
  __dex.lastStat = msg || '';
  try{
    if (ui && ui.stat) ui.stat.textContent = msg || '';
    if (ui && ui.stat) ui.stat.className = warn ? 'note warn' : 'note';
  }catch(e){}
}

function dexSetProg(ui, frac){
  try{
    if (!ui || !ui.prog) return;
    var bar = ui.prog.firstElementChild || ui.prog.querySelector('i');
    if (bar) bar.style.width = (isFinite(frac) ? Math.max(0, Math.min(100, frac * 100)) : 0) + '%';
  }catch(e){}
}

function dexCardHtml(c, sideRead){
  if (gfn('hgOmniSetupCard')) return W.hgOmniSetupCard(c, sideRead);
  var badge = (c.grade && c.grade.ticket) ? 'TICKET' : 'WATCH';
  var h = '<div class="card"><div class="ttl">' + esc(c.base || c.sym) + ' · ' + esc(c.kind)
    + ' ' + esc(String(c.dir || '').toUpperCase()) + ' <span class="dim">' + badge + '</span>';
  if (isFinite(fin(c.dexExplode))) h += ' <span class="dim">· explode ' + fin(c.dexExplode) + '</span>';
  if (isFinite(fin(c.dexChg24))) h += ' <span class="dim">· 7d ' + fin(c.dexChg24).toFixed(1) + '%</span>';
  h += '</div>';
  if (c.plan){
    h += '<div class="plan">ENTRY ' + esc(String(c.plan.entry)) + ' · STOP ' + esc(String(c.plan.stop))
      + ' · T1 ' + esc(String(c.plan.t1)) + ' · R:R ' + esc(String(c.plan.rr1)) + '</div>';
  }
  h += '<div class="dim">' + esc(c.why || '') + '</div></div>';
  return h;
}

function dexRankRows(rows){
  rows = rows || [];
  rows.sort(function(a, b){
    var ae = fin(a.dexExplode), be = fin(b.dexExplode);
    if (be !== ae) return be - ae;
    var at = (a.grade && a.grade.ticket) ? 1 : 0;
    var bt = (b.grade && b.grade.ticket) ? 1 : 0;
    if (bt !== at) return bt - at;
    if (gfn('hgOmniRank')){
      var ra = W.hgOmniRank([a])[0];
      var rb = W.hgOmniRank([b])[0];
      var ar = ra && ra.plan ? fin(ra.plan.rr1) : 0;
      var br = rb && rb.plan ? fin(rb.plan.rr1) : 0;
      if (br !== ar) return br - ar;
    }
    return String(a.sym || '').localeCompare(String(b.sym || ''));
  });
  return rows;
}

function dexBuildXsRanks(held){
  if (!held || held.length < 8) return null;
  try{
    if (!gfn('hgOmniXsRanks')) return null;
    var xsAll = [];
    var i;
    for (i = 0; i < held.length; i++){
      var f = held[i];
      if (!f || !f.hits || !f.hits.length) continue;
      var j, h;
      for (j = 0; j < f.hits.length; j++){
        h = f.hits[j];
        if (h && h.dir) xsAll.push({ sym: f.item.sym, dir: h.dir, kind: h.kind });
      }
    }
    return W.hgOmniXsRanks(xsAll, held.length);
  }catch(e){ return null; }
}

async function dexRunScan(ui){
  if (__dex.busy) return;
  if (!gfn('xuUniverse') || !gfn('xuCandles') || !gfn('hgOmniDetect') || !gfn('hgOmniEvaluate')){
    dexSetStat(ui, 'OMNIROUTE engine unavailable — load omniroute.js + xuniverse.js first.', true);
    return;
  }
  __dex.busy = true;
  if (ui && ui.btn) ui.btn.disabled = true;
  if (!__dex.lastCardsHtml && ui && ui.cards) ui.cards.innerHTML = '';
  dexSetStat(ui, 'loading meme perp universe (Delta + CoinDCX)…');
  dexSetProg(ui, 0);

  try{
    var uni = await W.xuUniverse(true);
    var list = dexMemeFilter(uni);
    if (!list.length){
      dexSetStat(ui, 'no meme perps cleared the turnover floor — venue list may be thin.', true);
      return;
    }
    dexSetStat(ui, 'pass 1/2 · ' + list.length + ' meme contracts · fetching 4H bars…');

    var held = [], done = 0, thin = 0, failed = 0;
    var drop = gfn('hgOmniDropForming') ? W.hgOmniDropForming : function(r){ return r || []; };
    var detect = W.hgOmniDetect;
    var posFn = gfn('xuPositioning') ? W.xuPositioning : null;

    for (var i = 0; i < list.length; i += CHUNK){
      var slice = list.slice(i, i + CHUNK);
      await Promise.all(slice.map(function(item){
        return Promise.resolve().then(function(){ return W.xuCandles(item, TF, BARS); })
          .then(function(rows){
            done++;
            dexSetProg(ui, done / list.length * 0.45);
            if (done % 3 === 0 || done === list.length){
              dexSetStat(ui, 'pass 1/2 · candles ' + done + '/' + list.length + ' · holding meme names with mechanics…');
            }
            var livePx = (rows && rows.length) ? fin(rows[rows.length - 1].c) : NaN;
            rows = drop(rows, TF);
            if (!rows || rows.length < MIN_BARS){ thin++; return; }
            var pos = null;
            if (posFn){ try{ pos = posFn(item.base || item.sym); }catch(eP){} }
            var hits = detect(rows, pos, null, item.sym) || [];
            held.push({ item: item, rows: rows, hits: hits, livePx: livePx });
          })
          .catch(function(){ failed++; done++; });
      }));
      if (i + CHUNK < list.length) await dexSleep(CHUNK_DELAY);
    }

    if (!held.length){
      dexSetStat(ui, 'meme universe loaded but no contract had enough 4H history.', true);
      return;
    }

    var xsRanks = dexBuildXsRanks(held);
    var pooled = null;
    if (gfn('hgOmniPoolStats') && gfn('hgOmniBacktestAll')){
      try{
        var statsBag = [];
        for (var si = 0; si < held.length; si++){
          statsBag.push(W.hgOmniBacktestAll(held[si].rows, { rMult: 2, horizon: 20, warm: 45 }));
        }
        pooled = W.hgOmniPoolStats(statsBag);
      }catch(eSt){ pooled = null; }
    }

    dexSetStat(ui, 'pass 2/2 · OMNIROUTE full ledger on ' + held.length + ' meme names…');
    var cands = [], graded = 0;
    for (var j = 0; j < held.length; j++){
      var f = held[j];
      var ex = {
        stats: pooled,
        xs: xsRanks,
        sym: f.item.sym,
        livePx: f.livePx,
        ticker: f.item,
        enriched: false
      };
      if (gfn('hgOmniDailyHtf')){ try{ ex.htf = W.hgOmniDailyHtf(f.rows); }catch(eH){} }
      if (gfn('regimeState')){ try{ ex.regime = W.regimeState(); }catch(eR){} }
      try{
        var rows1h = await W.xuCandles(f.item, '1h', BARS).catch(function(){ return []; });
        var rows15 = await W.xuCandles(f.item, '15m', BARS).catch(function(){ return []; });
        ex.rows1h = drop(rows1h, '1h');
        ex.rows15m = drop(rows15, '15m');
        ex.enriched = true;
      }catch(eEn){}
      var pos2 = null;
      if (posFn){ try{ pos2 = posFn(f.item.base || f.item.sym); }catch(eP2){} }
      var found = W.hgOmniEvaluate(f.item, f.rows, pos2, ex) || [];
      var k;
      for (k = 0; k < found.length; k++){
        var c = found[k];
        dexExplodeScore(c, f.item, f.rows);
        if (fin(c.dexExplode) < 2 && !(c.grade && c.grade.ticket)) continue;
        c.meme = true;
        c.exchange = f.item.exchange;
        c.turnoverUsd = f.item.turnoverUsd;
        cands.push(c);
      }
      graded++;
      dexSetProg(ui, 0.45 + (graded / held.length) * 0.55);
      if (graded % 2 === 0 || graded === held.length){
        dexSetStat(ui, 'pass 2/2 · graded ' + graded + '/' + held.length + ' · ' + cands.length + ' explosive setup(s)…');
      }
      f.rows = null;
      if (graded % CHUNK === 0) await dexSleep(0);
    }

    var ranked = dexRankRows(cands);
    var tickets = ranked.filter(function(c){ return c.grade && c.grade.ticket; });
    var show = ranked.slice(0, SHOW_MAX);
    __dex.snap = {
      at: Date.now(),
      scanned: list.length,
      meme: list.length,
      setups: ranked.length,
      tickets: tickets.length,
      rows: ranked
    };
    __dex.ran = true;

    var stat = ranked.length + ' meme setup(s) · ' + tickets.length + ' ticket(s) · '
      + list.length + ' meme perps scanned';
    if (thin) stat += ' · ' + thin + ' too thin';
    if (failed) stat += ' · ' + failed + ' fetch failed';
    dexSetStat(ui, stat);

    var html = '';
    if (!show.length){
      html = '<div class="empty">No explosive OMNIROUTE setups on meme perps right now — '
        + 'the ledger ran; nothing cleared squeeze / NR7 / vol-expansion with momentum.</div>';
    } else {
      var sr = null;
      for (var ri = 0; ri < show.length; ri++) html += dexCardHtml(show[ri], sr);
    }
    if (ui && ui.cards){
      ui.cards.innerHTML = html;
      __dex.lastCardsHtml = html;
    }

    if (gfn('hgPinMostProbablePanel') && tickets.length){
      try{
        var top = tickets[0];
        var mpRow = Object.assign({}, top, top.plan || {});
        mpRow.sym = mpRow.sym || top.sym;
        mpRow.dir = mpRow.dir || top.dir;
        var pick = { row: mpRow, tier: 'clean', source: 'dex-screener' };
        W.hgPinMostProbablePanel(ui.cards, 'dexscreener', pick);
      }catch(eMp){}
    }

    if (gfn('hgFwdRecordScan') && tickets.length){
      try{
        var fwd = tickets.slice(0, 12).map(function(c){
          return {
            sym: c.sym, dir: c.dir,
            entry: c.plan && c.plan.entry, stop: c.plan && c.plan.stop, t1: c.plan && c.plan.t1,
            mechanic: c.kind, ticket: true
          };
        });
        W.hgFwdRecordScan('DEX-SCREENER', TF, fwd, { horizonBars: 20 });
      }catch(eFwd){}
    }
  }catch(e){
    dexSetStat(ui, 'scan failed: ' + ((e && e.message) || e), true);
  }finally{
    __dex.busy = false;
    if (ui && ui.btn) ui.btn.disabled = false;
    dexSetProg(ui, null);
  }
}

function mountDexScreener(el){
  if (!el) return;
  el.innerHTML =
    '<div class="panel">'
    + '<h2>DEX SCREENER <span>meme perps · OMNIROUTE explosive setups · delta + coindcx</span></h2>'
    + '<div class="note hg-lead" style="margin-bottom:10px">Screens the <b>meme-coin perp universe</b> for setups that look ready to run — '
    + '<b>SQUEEZE-FIRE</b>, <b>NR7-BREAK</b>, <b>VOL-EXPANSION</b>, compression breaks, measured moves, and the rest of the OMNIROUTE ledger. '
    + 'Ranked by breakout momentum (7-day change + turnover + mechanic weight), not win probability. '
    + 'Overextended names (+18% 7d) are penalised — chasing tops is how radar dies. '
    + 'No on-chain DEX feed yet: this reads the same CEX perp tape OMNIROUTE uses, filtered to meme bases.</div>'
    + '<div class="row"><button class="btn" id="dexRun">SCAN MEME UNIVERSE</button>'
    + '<span class="note" id="dexStat">idle — press SCAN</span></div>'
    + '<div class="prog" id="dexProg"><i></i></div>'
    + '<div class="cards" id="dexCards"></div>'
    + '<div class="empty" id="dexEmpty" style="display:none">No meme setups yet.</div>'
    + '</div>';

  var ui = {
    btn: el.querySelector('#dexRun'),
    stat: el.querySelector('#dexStat'),
    prog: el.querySelector('#dexProg'),
    cards: el.querySelector('#dexCards')
  };
  __dex.ui = ui;

  if (ui.btn){
    ui.btn.addEventListener('click', function(){
      dexRunScan(ui);
    });
  }
  if (gfn('hgTabFormationDayPaint')) W.hgTabFormationDayPaint('dexscreener');
}

function refreshDexScreener(opts){
  opts = opts || {};
  try{
    if (__dex.busy) return 'busy';
    if (!__dex.ran && !opts.force) return 'skipped: not run yet';
    if (!opts.force && __dex.snap && __dex.snap.at && Date.now() - __dex.snap.at < FRESH_MS) return 'fresh';
    if (__dex.ui) return dexRunScan(__dex.ui).then(function(){ return 'refreshed'; });
    return 'skipped: not run yet';
  }catch(e){ return 'refreshed'; }
}

W.dexIsMeme = dexIsMeme;
W.dexMemeFilter = dexMemeFilter;
W.dexExplodeScore = dexExplodeScore;
W.dexRunScan = function(ui){ return dexRunScan(ui || __dex.ui); };
W.dexScreenerState = function(){
  try{ return __dex.snap ? JSON.parse(JSON.stringify(__dex.snap)) : null; }catch(e){ return null; }
};

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'dexscreener', label: 'DEX SCREENER', mount: mountDexScreener, refresh: refreshDexScreener });

})();
