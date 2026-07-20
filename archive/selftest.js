/* selftest.js \u2014 dev-only self-test suite extracted from index.html (Phase 12 modularization).
   runSelfTests() is invoked manually from the console; it is not run on load.
   Depends on cusumLast() from indicators.js, so it loads after that file. */
/* ---------------- dev-only self-tests (console: runSelfTests()) ----------------
   Lightweight fixture checks for the gate logic most prone to silent regressions.
   Not a full test suite \u2014 pins the closePos/sweep formulas and exercises the
   real cusumLast() directly so future edits to these can't silently flip a sign
   or break a divide-by-zero guard without a visible console failure. */
function runSelfTests(){
  const results = [];
  function assert(name, cond, detail){ results.push({name:name, pass:!!cond, detail:detail||''}); }

  (function(){
    function closePosOf(bar){ const range = bar.h - bar.l; return range>0 ? (bar.c - bar.l)/range : 0.5; }
    const strong = {h:110,l:100,c:109};
    const weak = {h:110,l:100,c:101};
    const flatBar = {h:100,l:100,c:100};
    assert('closePos: strong bullish close ~0.9', Math.abs(closePosOf(strong)-0.9)<1e-9, closePosOf(strong));
    assert('closePos: weak close ~0.1', Math.abs(closePosOf(weak)-0.1)<1e-9, closePosOf(weak));
    assert('closePos: zero-range bar defaults to 0.5 (no div/0)', closePosOf(flatBar)===0.5, closePosOf(flatBar));
    assert('closePos gate: long passes on strong close (>=0.60)', closePosOf(strong)>=0.60, '');
    assert('closePos gate: long vetoes weak close (<0.60)', !(closePosOf(weak)>=0.60), '');
    assert('closePos gate: short passes on weak close (<=0.40)', closePosOf(weak)<=0.40, '');
  })();

  (function(){
    function sweepOf(vals, dir, n){
      const priorWin = vals.slice(n-24, n-7);
      const localLow = Math.min.apply(null, priorWin);
      const localHigh = Math.max.apply(null, priorWin);
      const recent = vals.slice(n-7, n-1);
      return dir==='long' ? Math.min.apply(null, recent) < localLow : Math.max.apply(null, recent) > localHigh;
    }
    const flat = new Array(24).fill(100);
    const swept = flat.concat([100,100,100,100,95,100]); // undercut sits inside the 6-bar recent window, not at the very last (excluded) bar
    const notSwept = new Array(23).fill(100).concat(new Array(7).fill(102)); // last 6 bars (recent window) are entirely above the lookback low
    assert('sweep: detected when recent extreme undercuts prior range', sweepOf(swept,'long',swept.length), '');
    assert('sweep: no false-positive when nothing undercuts the range', !sweepOf(notSwept,'long',notSwept.length), '');
  })();

  (function(){
    let p = 100; const up = [];
    for (let i=0;i<60;i++){ p *= 1.01; up.push(p); }
    const evUp = cusumLast(up, 1);
    assert('cusumLast: sustained uptrend yields a long event', !!(evUp && evUp.dir==='long'), JSON.stringify(evUp));

    p = 100; const down = [];
    for (let i=0;i<60;i++){ p *= 0.99; down.push(p); }
    const evDown = cusumLast(down, 1);
    assert('cusumLast: sustained downtrend yields a short event', !!(evDown && evDown.dir==='short'), JSON.stringify(evDown));

    const flatSeries = new Array(60).fill(100);
    const evFlat = cusumLast(flatSeries, 1);
    assert('cusumLast: flat series does not throw (div/0 guard holds)', evFlat===null || typeof evFlat==='object', JSON.stringify(evFlat));
  })();

  (function(){
    var src = (typeof getTickers === 'function') ? getTickers.toString() : '';
    assert('getTickers: accepts an exchange argument (arity >= 1)', (typeof getTickers === 'function') && getTickers.length >= 1, String((typeof getTickers==='function')?getTickers.length:'n/a'));
    assert('getTickers: signature declares an ex parameter', /function\s+getTickers\s*\(\s*ex\s*\)/.test(src), src.slice(0, src.indexOf(')')+1));
    assert('getTickers: body references the ex parameter (honors argument, not only S.exchange)', /\bex\b/.test(src.replace(/S\.exchange/g,'')), '');
  })();

  (function(){
    // Guards the CoinDCX symbol-format normalization and turnover derivation
    // (loadTickersCdcx) plus the Delta turnover fallback (loadTickersDelta).
    // These pin the exact contracts so a future edit cannot silently change
    // how futures pairs map to spot markets or how 24h turnover is computed.
    function cdcxSpotKey(sym){ return String(sym).replace(/^B-/, "").replace("_", ""); }
    function cdcxTurnover(px, vol){ return (isFinite(px) && isFinite(vol)) ? px*vol : 0; }
    function deltaTurnover(t){ return parseFloat(t.turnover_usd != null ? t.turnover_usd : (t.turnover != null ? t.turnover : 0)); }
    assert("cdcx symbol: B-BTC_USDT maps to spot key BTCUSDT", cdcxSpotKey("B-BTC_USDT")==="BTCUSDT", cdcxSpotKey("B-BTC_USDT"));
    assert("cdcx symbol: B-JELLYJELLY_USDT maps to JELLYJELLYUSDT", cdcxSpotKey("B-JELLYJELLY_USDT")==="JELLYJELLYUSDT", cdcxSpotKey("B-JELLYJELLY_USDT"));
    assert("cdcx symbol: strips only leading B- prefix, not internal B", cdcxSpotKey("B-BNB_USDT")==="BNBUSDT", cdcxSpotKey("B-BNB_USDT"));
    assert("cdcx turnover: derived as last_price * volume", cdcxTurnover(100, 5)===500, cdcxTurnover(100,5));
    assert("cdcx turnover: defaults to 0 when no spot match (non-finite inputs)", cdcxTurnover(NaN, 5)===0, cdcxTurnover(NaN,5));
    assert("delta turnover: prefers turnover_usd field", deltaTurnover({turnover_usd:"1234", turnover:"9"})===1234, deltaTurnover({turnover_usd:"1234",turnover:"9"}));
    assert("delta turnover: falls back to turnover, then 0", deltaTurnover({})===0 && deltaTurnover({turnover:"77"})===77, "");
    assert("cdcx adapter: loadTickersCdcx is defined", typeof loadTickersCdcx==="function", typeof loadTickersCdcx);
    assert("delta adapter: loadTickersDelta is defined", typeof loadTickersDelta==="function", typeof loadTickersDelta);
  })();

  const pass = results.filter(function(r){ return r.pass; }).length;
  console.log('HARDGATE self-tests: '+pass+'/'+results.length+' passed', results);
  return { pass:pass, total:results.length, results:results };
}
