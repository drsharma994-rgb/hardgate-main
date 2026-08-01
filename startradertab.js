/* =========================================================================
HARDGATE — startradertab.js
STAR TRADER tab — full CFD universe (crypto · gold · oil · indices · forex)
scanned with every gate/strategy module the app already ships.

Pure exports (never throw):
  stDropForming(rows, tf)
  stSynthesize(contract, rows4h, rows1h, rows15m, ticker) -> setup | null
  stTierRank(tier)

Registers window.HG_tabs id 'startrader' label 'STAR TRADER'.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

var CHUNK = 4;
var CHUNK_MS = 160;
var MIN_BARS_4H = 210;

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c];
  });
}
function pxF(n){
  if (typeof W.px === 'function') return W.px(n);
  if (!isFinite(n)) return '—';
  var a = Math.abs(n);
  var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtF(n, d){
  if (typeof W.fmt === 'function') return W.fmt(n, d);
  if (!isFinite(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: (d === undefined ? 2 : d) });
}

var TIER_RANK = { WATCH: 1, HIGH: 2, PRIME: 3 };

function stTierRank(t){ return TIER_RANK[t] || 0; }

function stDropForming(rows, tf){
  try{
    var sec = { '15m':900,'1h':3600,'2h':7200,'4h':14400,'1d':86400 }[tf];
    if (!rows || !rows.length || !sec) return rows || [];
    var now = Math.floor(Date.now() / 1000);
    return (now - rows[rows.length - 1].t < sec) ? rows.slice(0, -1) : rows;
  }catch(e){ return rows || []; }
}

function stMajorityDir(votes){
  var lc = 0, sc = 0;
  for (var i = 0; i < votes.length; i++){
    if (votes[i].dir === 'long') lc++;
    else if (votes[i].dir === 'short') sc++;
  }
  if (lc > sc) return 'long';
  if (sc > lc) return 'short';
  return votes.length ? votes[0].dir : null;
}

/* Multi-strategy synthesis — pure, vm-testable */
function stSynthesize(contract, rows4h, rows1h, rows15m, ticker){
  try{
    contract = contract || {};
    ticker = ticker || { symbol: contract.sym, fundingPct: null };
    if (!rows4h || rows4h.length < MIN_BARS_4H) return null;

    var votes = [];
    var points = 0;
    var isCrypto = contract.klass === 'crypto';

    if (typeof W.swingGateMatrix === 'function'){
      var sw = W.swingGateMatrix(rows4h, ticker);
      if (sw && sw.dir){
        if (sw.clean) votes.push({ src: 'SWING', dir: sw.dir, pts: 3, detail: '7/7 swing gates' });
        else if (sw.passed >= 6) votes.push({ src: 'SWING', dir: sw.dir, pts: 1, detail: sw.passed + '/7 swing gates' });
      }
    }
    if (typeof W.swingTryClean === 'function'){
      var st = W.swingTryClean(rows4h, ticker);
      if (st) votes.push({ src: 'SWING PLAN', dir: st.dir, pts: 3, plan: st, detail: fmtF(st.rr, 2) + 'R swing' });
    }

    if (rows1h && rows15m && rows1h.length >= 60 && rows15m.length >= 60){
      var mins = 120;
      if (isCrypto && typeof W.tickClock === 'function'){
        try{ mins = W.tickClock(); }catch(e){}
      }
      if (typeof W.scalpGateMatrix === 'function'){
        var sc = W.scalpGateMatrix(rows1h, rows15m, isCrypto ? ticker : { fundingPct: null }, mins);
        if (sc && sc.dir && sc.clean) votes.push({ src: 'SCALP', dir: sc.dir, pts: 2, detail: '7/7 scalp gates' });
        else if (sc && sc.dir && sc.passed >= 5) votes.push({ src: 'SCALP', dir: sc.dir, pts: 1, detail: sc.passed + '/7 scalp' });
      }
      if (typeof W.scalpTryClean === 'function'){
        var scp = W.scalpTryClean(rows1h, rows15m, isCrypto ? ticker : { fundingPct: null }, mins);
        if (scp) votes.push({ src: 'SCALP PLAN', dir: scp.dir, pts: 2, plan: scp, detail: fmtF(scp.rr, 2) + 'R scalp' });
      }
    }

    if (typeof W.edgeSwingBias === 'function' && W.edgeSwingBias(rows4h)){
      var es = (typeof W.edgeSignal === 'function') ? W.edgeSignal(rows4h) : null;
      if (es && es.dir){
        var item = { sym: contract.sym, base: contract.base, exchange: 'startrader', turnoverUsd: ticker.turnoverUsd || null };
        if (typeof W.edgeAssess === 'function'){
          var ea = W.edgeAssess(rows4h, item, 'startrader');
          if (ea && ea.sig){
            votes.push({ src: 'EDGE', dir: ea.sig.dir, pts: (ea.tally >= 4 ? 3 : 2),
              detail: 'tally ' + ea.tally, plan: ea.plan, edge: ea });
          }
        } else {
          votes.push({ src: 'EDGE', dir: es.dir, pts: 1, detail: 'edge trigger' });
        }
      }
    }

    if (typeof W.squeezeClassify === 'function' && rows1h && rows1h.length >= 30){
      var sq = W.squeezeClassify(rows4h, rows1h);
      if (sq && sq.state === 'FIRED_LONG') votes.push({ src: 'SQUEEZE', dir: 'long', pts: 2, detail: 'TTM fire long' });
      else if (sq && sq.state === 'FIRED_SHORT') votes.push({ src: 'SQUEEZE', dir: 'short', pts: 2, detail: 'TTM fire short' });
    }

    if (typeof W.mrSignal === 'function'){
      var mr = W.mrSignal(rows4h);
      if (mr && mr.dir) votes.push({ src: 'MEAN REV', dir: mr.dir, pts: 1, detail: mr.kind || 'MR' });
    }

    if (!votes.length) return null;

    for (var v = 0; v < votes.length; v++) points += votes[v].pts;

    var dir = stMajorityDir(votes);
    if (!dir) return null;

    var agree = votes.filter(function(x){ return x.dir === dir; });
    var agreePts = 0;
    for (var a = 0; a < agree.length; a++) agreePts += agree[a].pts;

    var kinds = {};
    for (var k = 0; k < agree.length; k++) kinds[agree[k].src.split(' ')[0]] = true;
    var kindN = Object.keys(kinds).length;

    var tier = 'WATCH';
    var hasCleanSwing = agree.some(function(x){ return x.src.indexOf('SWING') === 0 && x.pts >= 3; });
    var hasCleanScalp = agree.some(function(x){ return x.src.indexOf('SCALP') === 0 && x.pts >= 2; });
    var hasEdgeStrong = agree.some(function(x){ return x.src === 'EDGE' && x.pts >= 3; });

    if (agreePts >= 6 && kindN >= 3 && (hasCleanSwing || hasEdgeStrong)) tier = 'PRIME';
    else if (agreePts >= 4 && kindN >= 2 && (hasCleanSwing || hasCleanScalp || hasEdgeStrong)) tier = 'HIGH';

    var plan = null;
    for (var p = 0; p < agree.length; p++){
      if (agree[p].plan){ plan = agree[p].plan; break; }
    }
    if (!plan && agree[0] && agree[0].edge && agree[0].edge.plan) plan = agree[0].edge.plan;

    return {
      sym: contract.sym,
      label: contract.label || contract.sym,
      klass: contract.klass || 'crypto',
      dir: dir,
      tier: tier,
      points: agreePts,
      totalPts: points,
      votes: agree,
      allVotes: votes,
      plan: plan,
      mark: (ticker && isFinite(ticker.mark)) ? ticker.mark : (rows4h.length ? rows4h[rows4h.length - 1].c : null)
    };
  }catch(e){ return null; }
}

function klassChip(k){
  var labels = { crypto: 'CRYPTO', metal: 'METAL', oil: 'OIL', index: 'INDEX', fx: 'FX' };
  return labels[k] || String(k || '').toUpperCase();
}

function cardHTML(r){
  var p = r.plan;
  var entry = p && isFinite(p.entry) ? p.entry : null;
  var stop = p && isFinite(p.stop) ? p.stop : null;
  var t1 = p && isFinite(p.t1) ? p.t1 : null;
  var tierCls = r.tier === 'PRIME' ? 'prime' : (r.tier === 'HIGH' ? 'high' : 'watch');
  var voteTxt = r.votes.map(function(v){ return v.src + ' (' + v.detail + ')'; }).join(' · ');
  var planBlk = '';
  if (entry != null && stop != null && typeof W.planBlock === 'function'){
    planBlk = W.planBlock(r.dir, entry, stop, t1, p && p.t2, r.tier + ' multi-strategy confluence');
  } else if (entry != null && stop != null){
    planBlk = '<div class="plan">entry ' + pxF(entry) + ' · stop ' + pxF(stop)
      + (t1 != null ? ' · T1 ' + pxF(t1) : '') + '</div>';
  }
  return '<div class="card ' + tierCls + '">'
    + '<div class="chead"><span class="sym">' + esc(r.sym) + '</span>'
    + '<span class="gpip">' + klassChip(r.klass) + '</span>'
    + '<span class="dir">' + r.dir.toUpperCase() + ' · ' + r.tier + '</span></div>'
    + '<div class="cbody">'
    + '<span class="k">asset</span><span>' + esc(r.label) + '</span>'
    + '<span class="k">confluence</span><span>' + r.points + ' pts · ' + r.votes.length + ' reads agree</span>'
    + '<span class="k">strategies</span><span>' + esc(voteTxt) + '</span>'
    + '<span class="k">mark</span><span>' + pxF(r.mark) + '</span>'
  + '</div>' + planBlk + '</div>';
}

var __st = { busy: false, ranOnce: false, run: null };

function mount(el){
  el.innerHTML =
    '<div class="panel">'
    + '<h2>STAR TRADER <span>full CFD universe · crypto · gold · oil · indices · forex · multi-strategy confluence</span></h2>'
    + '<div class="note" style="margin-bottom:10px">Scans every STARTRADER contract using the app\'s existing gate engines: '
    + '<b>SWING</b> (4H cascade + funding + CUSUM) · <b>SCALP</b> (1H/15m Judas) · <b>EDGE</b> (swing-aligned entries) · '
    + '<b>SQUEEZE</b> · <b>MEAN REV</b>. '
    + 'Crypto uses Binance USD-M proxy; gold uses XAUUSDT/PAXG chain; oil/FX/indices use Yahoo via /api/proxy. '
    + '<b>PRIME</b> = 3+ strategy families agree with a clean swing or strong EDGE; <b>HIGH</b> = 2+ families with a clean plan. '
    + 'Trade execution stays on STARTRADER — this tab is scan + plan only.</div>'
    + '<div class="row"><button class="btn" id="stRun">SCAN STAR TRADER</button>'
    + '<span class="note" id="stStat"></span></div>'
    + '<div class="prog" id="stProg"><i></i></div>'
    + '</div>'
    + '<div class="cards" id="stCards"></div>'
    + '<div class="empty" id="stEmpty" style="display:none">No solid STARTRADER setups right now. Standing aside is a position.</div>';

  var btn = el.querySelector('#stRun');
  var stat = el.querySelector('#stStat');
  var prog = el.querySelector('#stProg');
  var cards = el.querySelector('#stCards');
  var empty = el.querySelector('#stEmpty');

  function setProg(f){
    if (!prog) return;
    prog.style.display = (f === null) ? 'none' : 'block';
    if (f !== null && prog.firstElementChild) prog.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
  }
  function setStat(txt, warn){
    if (!stat) return;
    stat.textContent = txt || '';
    stat.className = warn ? 'note warn' : 'note';
  }

  if (typeof startraderAllContracts !== 'function'){
    setStat('startrader.js not loaded', true);
    btn.disabled = true;
    return;
  }

  btn.addEventListener('click', function(){ runScan(); });

  async function runScan(){
    if (__st.busy) return 'busy';
    __st.busy = true;
    __st.ranOnce = true;
    btn.disabled = true;
    cards.innerHTML = '';
    empty.style.display = 'none';
    setProg(0);
    var t0 = Date.now();
    var skipped = 0, found = [];
    try{
      var contracts = startraderAllContracts();
      var tickers = (typeof startraderFullTickers === 'function') ? await startraderFullTickers() : [];
      var tmap = {};
      for (var ti = 0; ti < tickers.length; ti++) tmap[tickers[ti].symbol] = tickers[ti];

      for (var ci = 0; ci < contracts.length; ci += CHUNK){
        var chunk = contracts.slice(ci, ci + CHUNK);
        await Promise.all(chunk.map(async function(c, idx){
          var i = ci + idx;
          setProg((i + 1) / contracts.length);
          setStat('scanning ' + (i + 1) + '/' + contracts.length + ' · ' + c.sym + ' · '
            + Math.floor((Date.now() - t0) / 1000) + 's');
          try{
            var h4 = stDropForming(await startraderCandles(c.sym, '4h', 280), '4h');
            var h1 = stDropForming(await startraderCandles(c.sym, '1h', 160), '1h');
            var m15 = stDropForming(await startraderCandles(c.sym, '15m', 180), '15m');
            if (!h4 || h4.length < MIN_BARS_4H){ skipped++; return; }
            var tk = tmap[c.sym] || { symbol: c.sym, fundingPct: null, mark: null };
            var setup = stSynthesize(c, h4, h1, m15, tk);
            if (setup) found.push(setup);
          }catch(e){ skipped++; }
        }));
        await sleep(CHUNK_MS);
      }

      found.sort(function(a, b){
        return stTierRank(b.tier) - stTierRank(a.tier) || b.points - a.points;
      });

      var show = found.filter(function(x){ return x.tier === 'PRIME' || x.tier === 'HIGH'; });
      if (!show.length) show = found.slice(0, 12);

      if (!show.length){
        empty.style.display = 'block';
        setStat('done — 0 setups / ' + contracts.length + ' contracts · ' + skipped + ' thin · '
          + Math.floor((Date.now() - t0) / 1000) + 's');
        return;
      }
      cards.innerHTML = show.map(cardHTML).join('');
      var primes = show.filter(function(x){ return x.tier === 'PRIME'; }).length;
      var highs = show.filter(function(x){ return x.tier === 'HIGH'; }).length;
      setStat('done — ' + show.length + ' shown (' + primes + ' PRIME · ' + highs + ' HIGH) / '
        + contracts.length + ' contracts · ' + Math.floor((Date.now() - t0) / 1000) + 's');
    }catch(e){
      setStat('scan failed: ' + ((e && e.message) || e), true);
    }finally{
      setProg(null);
      btn.disabled = false;
      __st.busy = false;
    }
    return 'refreshed';
  }

  __st.run = runScan;
}

function startraderTabRefresh(){
  try{
    if (__st.busy) return 'busy';
    if (!__st.ranOnce || typeof __st.run !== 'function') return 'skipped: not run yet';
    return __st.run();
  }catch(e){ return 'refreshed'; }
}

W.stDropForming = stDropForming;
W.stSynthesize = stSynthesize;
W.stTierRank = stTierRank;

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'startrader', label: 'STAR TRADER', mount: mount, refresh: startraderTabRefresh });

})();
