/* backtest-ui.js -- backtest result/helper UI extracted from index.html
   backtestSummaryHTML2 (result renderer, used by gold/finder backtests) plus
   runFinderGoldBacktest and runFinderCryptoBacktest. No credentials, no network.
   Call-time deps (getXAUCandles, runBacktestWorker, etc.) resolve via globals. */
function backtestSummaryHTML2(label, rows, results, note){
  const fmtD = t => new Date(t*1000).toISOString().slice(0,10);
  const total = results.length;
  const wins = results.filter(r=>r.outcome==='target1'||r.outcome==='target2').length;
  const stops = results.filter(r=>r.outcome==='stop').length;
  const openCt = results.filter(r=>r.outcome==='unresolved').length;
  const resolved = results.filter(r=>r.outcome!=='unresolved');
  const winRate = total ? (wins/total*100) : NaN;
  const avgR = resolved.length ? (resolved.reduce((a,r)=>a+r.rMult,0)/resolved.length) : NaN;
  const rangeNote = rows.length ? (fmtD(rows[0].t)+' to '+fmtD(rows[rows.length-1].t)) : 'n/a';
  const smallNote = total<10 ? '<div class="note warn">Sample size is small ('+total+' signals) \u2014 treat as directional evidence, not a reliable win rate.</div>' : '';
  return '<div class="panel"><h2>'+label+' BACKTEST <span>Twelve Data history \u00b7 '+rangeNote+'</span></h2>'
  + '<div class="note">'+note+'</div>'
  + '<div class="kv"><span class="k">Signals found</span><span class="v">'+total+'</span></div>'
  + '<div class="kv"><span class="k">Hit target first</span><span class="v">'+wins+' ('+(total?winRate.toFixed(1):'0.0')+'%)</span></div>'
  + '<div class="kv"><span class="k">Hit stop first</span><span class="v">'+stops+'</span></div>'
  + '<div class="kv"><span class="k">Still open at horizon end</span><span class="v">'+openCt+'</span></div>'
  + '<div class="kv"><span class="k">Avg R (resolved trades)</span><span class="v">'+(isFinite(avgR)?avgR.toFixed(2)+'R':'n/a')+'</span></div>'
  + smallNote + '</div>';
}


async function runFinderGoldBacktest(){
  const out = document.getElementById('finderBacktestOut');
  out.innerHTML = 'running backtest\u2026';
  try{
    const d1 = await getXAUCandles('1d',4990);
    const h4 = await getXAUCandles('4h',4990);
    const h1 = await getXAUCandles('1h',3000);
    const m15 = await getXAUCandles('15m',5000);
    const swingRes = backtestGoldSwingTD(d1, h4);
    const judasRes = backtestJudasTD(d1, h1, m15);
    out.innerHTML = backtestSummaryHTML2('GOLD SWING', h4, swingRes, "Replays this app's own gold SWING gates (GS1-GS7) bar-by-bar on real Twelve Data 4H history.")
      + backtestSummaryHTML2('GOLD JUDAS SWEEP', m15, judasRes, "Replays the kill-zone liquidity-sweep-and-reclaim gates (JS1-JS6) bar-by-bar on real Twelve Data 15m history.");
  }catch(e){ out.innerHTML = '<div class="note warn">'+e.message+'</div>'; }
}

async function runFinderCryptoBacktest(base){
  const out = document.getElementById('finderBacktestOut');
  out.innerHTML = 'running backtest\u2026';
  try{
    const h1 = await getCryptoCandlesTD(base,'1h',3000);
    const m15 = await getCryptoCandlesTD(base,'15m',5000);
    const d1 = await getCryptoCandlesTD(base,'1d',300);
    const c4rows = await getCryptoCandlesTD(base,'4h',5000);
    const [swingRes, scalpRes, judasRes] = await Promise.all([
      runBacktestWorker('swing', {c4: c4rows}),
      runBacktestWorker('scalp', {h1: h1, m15: m15}),
      runBacktestWorker('judas', {d1: d1, h1: h1, m15: m15})
    ]);
    out.innerHTML = backtestSummaryHTML2(base+' SWING', c4rows, swingRes, "Replays this app's SWING gates bar-by-bar. Funding and volume-z gates excluded (Twelve Data doesn't provide historical funding or reliable crypto volume).")
      + backtestSummaryHTML2(base+' SCALP', m15, scalpRes, "Replays this app's SCALP gates (1H trend, sweep+reclaim, RSI band, funding-window timing, ATR vol-alive, wick commit, R:R) bar-by-bar. Funding rate and volume-z excluded for the same data-availability reason.")
      + backtestSummaryHTML2(base+' JUDAS SWEEP', m15, judasRes, "Replays the kill-zone liquidity-sweep-and-reclaim gates bar-by-bar.");
  }catch(e){ out.innerHTML = '<div class="note warn">'+e.message+'</div>'; }
}
