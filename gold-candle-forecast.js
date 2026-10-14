/* =========================================================================
HARDGATE — gold-candle-forecast.js (v1356)
Predictive Candle Forecasting Module. Uses ATR and momentum to forecast
the next candle's range, direction, TP, and SL.

v1308 fixes two defects that kept the tab painting "Waiting for data..."
on every page load since v1308:

  (1) Registration pattern. v1308 wrote `window.HG_TAB_MODS[mod.id] = mod`.
      That writes to the GLOBAL `window.HG_TAB_MODS`, not the lexically-
      scoped `const HG_TAB_MODS = {}` at the top of index.html's shell
      script (line 11004) that `showTab()` reads. A `const` declared at
      script scope is a LEXICAL binding, not a window property, so the two
      objects are different, and showTab's `const mod = HG_TAB_MODS[id]`
      found nothing. We now push onto `window.HG_tabs` — the array
      `bootHgTabs` iterates — and it copies into the shell's const + auto-
      creates both the nav button and the tab pane in one place.

  (2) Script load order. v1308 placed the script at the body bottom
      (line 11188). `bootHgTabs` is an IIFE at line 11006; it runs
      synchronously and only sees modules whose push already landed. A
      script loading at the body bottom pushes AFTER that iteration, so
      the auto-wire never happened. We also deliberately removed the
      duplicate inlined script tag at the body bottom — the import at
      the top of the body (beside book.js) is the one home.
========================================================================= */
(function() {
  'use strict';

  /**
   * @module GoldCandleForecast
   * Provides predictive analysis for the next candle based on volatility (ATR)
   * and momentum-based price action patterns.
   */
  var __cfPane = null;   /* hg-v1336: the pane already painted, by identity - not a boolean, so a fresh root can still build */

  /* hg-v1349: THE ENGINE BAR FLOOR, named once. goldCandleForecast returns null below
     this count, so every reader here must agree with it. It was 20 in the loader and in
     this module guard while the engine wanted 30, and a 20-29 bar feed produced "Unread /
     The candle read failed closed. Nothing was invented." with no way for a reader to
     tell a thin tape from a broken engine. */
  const CF_MIN_BARS = 30;

  const mod = {
    id: 'candle-forecast',
    label: 'CANDLE FORECAST',
    mount: function(container) {
      if (!container) return;
        /* hg-v1336: THE GUARD ANSWERS "IS THIS PANE ALREADY BUILT?", NOT "HAS THIS TAB
           EVER MOUNTED?".
           It was a bare module flag, so the FIRST mount latched it and every later
           mount returned in silence. In the browser that is invisible — the shell mounts
           each tab's pane once — which is exactly why it survived: nothing exercised a
           second mount. The moment a harness mounts the tab into a SECOND, fresh root
           (to drive it with different data) the pane is never built, nothing renders,
           and the tab reads as unresponsive to its own feed. Measured: fed bars vs
           starved bars produced IDENTICAL output, and the sweep that takes the bars away
           from every gold tab reported this one as flat.
           Storing the container instead of a boolean keeps what the guard was for — the
           shell mounting the same pane twice must not build it twice — while letting a
           mount into a NEW pane proceed. Compared by identity, so a permissive stub that
           answers every selector truthy still cannot make this the reason nothing
           renders: a different (or absent) container simply builds. */
        if (__cfPane && container === __cfPane) return;
        __cfPane = container;

      container.innerHTML = `
        <div class="panel">
          <h2>Candle Forecast <span id="cfVersion"></span></h2>
          <div class="row" style="margin-bottom: 16px;">
            <button class="btn" id="cfRunBtn">SCAN NEXT CANDLE</button>
            <span class="note" id="cfStatus" style="margin-left: 8px; font-weight:700;">Ready</span>
          </div>
          <div id="cfResultArea" class="empty">
            No forecast yet. A scalp is the 15m tape and a swing is the 4h tape. Ultimate AI Confluence names a side only when those two reads agree. It does not invent a third stop. News, headlines, fear and greed, COT and the cached macro feeds are listed on each tape and do not cast a second vote. A wide tally of fifteen reads sits under the card and prints a stop only when that count names a side. Each horizon still prints its own confluence: every named candle shape, what that shape means, the shared indicator values, every catalog read, every fundamental leg, higher-timeframe structure, and every gold tab. A setup prints only when a named candlestick pattern is confirmed, and no higher timeframe is against it. Unread is not agreement. The stop is still the pattern extreme, or one ATR. A formed setup is asked against the shared perfect bar. That bar does not invent a grade. An in-sample walk counts what formed on this tape only. The forward ledger records a formed setup and settles it on later bars. The 4h swing is shown on every scan. A formed swing stays up even when a family nets against. A neutral tape prints no stop. Confirmed swings for the day are still capped at two.
          </div>
        </div>
      `;

      /* hg-v1336: WIRE THE BUTTON THROUGH THE CONTAINER, NOT THE DOCUMENT.
         This read `document.getElementById('cfRunBtn')`, which works in a browser but
         binds the listener to whatever element the DOCUMENT returns — and a harness that
         mounts the pane into its own root (so a tab can be driven without a real page)
         answers that with an element of its own, or none. The sweep that drives every
         gold tab finds a tab's scan control by reading the click handlers wired ON THE
         MOUNTED ROOT, so this tab read as having NO scan control at all while the button
         was visibly on screen — the hg-v955 shape in reverse: the control existed, the
         wiring did not reach it.
         The container is the element the pane was just built into, so it is both the
         correct scope and the one that survives being mounted anywhere. The document
         lookup stays as a fallback for the real-page case, and both are guarded so a
         container without the button cannot throw during mount. */
      var runBtn = (container.querySelector && container.querySelector('#cfRunBtn'))
        || (typeof document !== 'undefined' && document.getElementById ? document.getElementById('cfRunBtn') : null);
      if (runBtn && runBtn.addEventListener) runBtn.addEventListener('click', () => this.runForecast());
      var verEl = container.querySelector('#cfVersion');
      var ver = (window.HG_BUILD && window.HG_BUILD.version) || '';
      if (verEl && ver) verEl.textContent = ver;
    },
    refresh: async function() {
      await this.runForecast();
    }
  };

  mod.stampTicket = function(forecast) {
    if (!forecast) return;
    var cflNow = forecast.confluence;
    if (cflNow && cflNow.desks && cflNow.desks.length) {
      forecast.tabs = cflNow.desks.map(function (d) {
        var side = d.lean === true ? 'with' : (d.lean === false ? 'against' : 'unread');
        return String(d.desk) + ' ' + side;
      }).join(', ');
    }
    if (!(cflNow && cflNow.ticket && (forecast.dir === 'BULL' || forecast.dir === 'BEAR') && !forecast.setup)) return;
    var patNames = (forecast.patterns && forecast.patterns.length) ? forecast.patterns.slice() : [];
    var wantLean = forecast.dir === 'BULL' ? 1 : -1;
    var leans = forecast.patternLeans || [];
    var ai, oneLean;
    for (ai = 0; ai < leans.length; ai++) {
      oneLean = leans[ai];
      if (oneLean && oneLean.lean === wantLean && oneLean.name) patNames.push(oneLean.name);
    }
    if (!patNames.length && forecast.advancedPatterns && forecast.advancedPatterns.length) patNames = forecast.advancedPatterns.slice();
    if (!patNames.length) return;
    var fams = [];
    (cflNow.voters || []).forEach(function (v) {
      if (v && v.lean === true && v.family && v.family !== 'candles' && fams.indexOf(v.family) < 0) fams.push(v.family);
    });
    forecast.setup = forecast.dir === 'BULL' ? 'LONG SETUP' : 'SHORT SETUP';
    forecast.setupParts = patNames.join(', ') + (fams.length ? ' · ' + fams.join(', ') : '');
    var note = String(forecast.note || '').replace(/^No setup formed — the call is the vote only\. /, '');
    forecast.note = forecast.setup + ': ' + forecast.setupParts + '. ' + note;
  };

  /**
   * Main execution flow for the forecast engine.
   */
  mod.runForecast = async function() {
    const statusEl = document.getElementById('cfStatus');
    const resultArea = document.getElementById('cfResultArea');

    if (!statusEl || !resultArea) return;

    // UI Reset
    statusEl.textContent = 'Analyzing...';
    resultArea.className = 'empty';
    resultArea.innerHTML = 'Reading the gold 15m tape...';

    try {
      const loaded = await this.loadGold15m();
      const prepared15 = this.prepareRows(loaded && loaded.rows, '15m');
      const candles = prepared15.rows;
      if (!Array.isArray(candles) || candles.length < CF_MIN_BARS) {
        throw new Error('Gold 15m tape unread. ' + this.unreadReason(candles, '15m', prepared15));
      }

      if (typeof window.goldCandleForecast !== 'function') {
        throw new Error('Predictive Engine (goldCandleForecast) not loaded. Please refresh.');
      }

      const tapes = await this.loadTapes();
      if (tapes && typeof tapes === 'object') {
        tapes.cachedDesks = true;
        tapes.tf = '15m';
      }
      const macroLive = await this.loadMacro();
      const forecast = window.goldCandleForecast(candles, macroLive, tapes);
      if (!forecast) {
        /* hg-v1347: name WHICH gate stopped the engine instead of the one
           line that answered six different causes the same way (hg-v940).
           goldCandleForecast has six distinct null returns and the module
           printed the same shrug for all of them, which is why the user
           saw this message across hg-v1338, v1342 and v1343 and could not
           tell what to do about it. hgCfDiagnose names the specific cause
           and lives beside the engine in goldind.js (one home, hg-v949),
           so the two cannot drift and a re-bake of the engine's null set
           moves the diagnostic with it. The reader fails open: with the
           helper absent, the old line is kept. */
        var diagWhy = (typeof window.hgCfDiagnose === 'function')
          ? (function(){ try { return window.hgCfDiagnose(candles); } catch (eDg) { return null; } })()
          : null;
        var diagText = diagWhy ? String(diagWhy).replace(/</g, '') : '';
        if (!diagText && prepared15 && prepared15.note) diagText = this.unreadReason(candles, '15m', prepared15);
        resultArea.innerHTML = diagText
          ? ('<span class="note warn">' + mod.esc(diagText) + '</span>')
          : 'The candle read failed closed. Nothing was invented.';
        statusEl.textContent = 'Unread';
        return;
      }
      forecast.source = loaded.source || '';
      forecast.feedNote = prepared15.note || '';

      /* hg-v1315: hand the confluence the HOUSE MACRO SNAPSHOT.
         The first cut passed an empty options bag, so `hgFundamentalRegime('GOLD')`
         ran with no `extra` and every macro leg read UNCHECKED — the fundamental
         family could never vote, not because it had no opinion but because nobody
         handed it the readings. `getGoldMacroCached` is the accessor every gold desk
         already reads (macro.js exports it), so this COMPOSES the existing snapshot
         rather than fetching anything new. Deliberately `Cached`: a display tab must
         not trigger a network round-trip, and an absent or cold snapshot stays
         unread, which is the honest state. */
      var macroSnap = null;
      try {
        if (typeof window.getGoldMacroCached === 'function') macroSnap = window.getGoldMacroCached();
      } catch (eMg) { macroSnap = null; }
      forecast.macroRead = !!macroSnap;
      /* hg-v1314: the confluence read, beside the candle read. Composed from the
         SHARED gold readers (indicator bag, Master Catalog, fundamental stack), so
         this tab finally knows what the other gold desks know. It never throws: a
         missing reader is reported as unread, not as agreement, and a failure here
         leaves the candle read intact rather than blanking the tab. */
      try {
        if (typeof window.hgCfConfluence === 'function') {
          forecast.confluence = window.hgCfConfluence(candles, {
            fundExtra: macroSnap || macroLive || {},
            rows1h: tapes && tapes.rows1h,
            rows4h: tapes && tapes.rows4h,
            rows1d: tapes && tapes.rows1d,
            spot: tapes && tapes.spot,
            perp: tapes && tapes.perp,
            macro: macroSnap || macroLive || null,
            ctx: (macroSnap || macroLive) ? { macro: macroSnap || macroLive } : null
          }, forecast);
        }
      } catch (eCf) { forecast.confluence = null; }
      /* A confluence ticket is the setup. The candle engine still owns the
         stop: pattern extreme when it sits 0.25 to 2.5 ATR away, otherwise one
         ATR. No tab price is copied onto that stop. Done before the scalp
         bracket is built, so that bracket sees the setup the ticket earned. */
      this.stampTicket(forecast);

      /* hg-v1318: THE SCALP AND THE SWING.
         The tab printed ONE bracket with no statement of which horizon it belonged
         to. A 15m read and a 4h read are different trades — the scalp lives inside a
         session, the swing rides a move for days — so both are built now, by the SAME
         builder in goldind.js (one home), each on its own tape and each carrying its
         OWN ATR, because risk has to be measured on the timeframe the trade is taken
         on. The 4h tape is fetched through the same loader chain as the 15m one; if it
         cannot be read the swing simply reports why, and the scalp is unaffected. */
      forecast.scalp = (function () {
        try {
          return (typeof window.hgCfBuildSetup === 'function')
            ? window.hgCfBuildSetup(candles, { tf: '15m' }, forecast) : null;
        } catch (eSc) { return null; }
      })();
      forecast.swing = null;
      try {
        var load4 = this.loadGold('4h', 120);
        var loaded4 = await load4;
        var prepared4 = this.prepareRows(loaded4 && loaded4.rows, '4h');
        var c4 = prepared4.rows;
        if (Array.isArray(c4) && c4.length >= CF_MIN_BARS) {
          var fc4 = window.goldCandleForecast(c4, macroSnap || macroLive || null, { rows1d: tapes && tapes.rows1d, rows15m: candles, tf: '4h', cachedDesks: true });
          try {
            if (fc4 && typeof window.hgCfConfluence === 'function') {
              fc4.confluence = window.hgCfConfluence(c4, {
                horizon: 'swing', tf: '4h',
                fundExtra: macroSnap || macroLive || {},
                rows15m: candles,
                rows1h: tapes && tapes.rows1h,
                rows1d: tapes && tapes.rows1d,
                htf1h: false, htf4h: false,
                spot: tapes && tapes.spot, perp: tapes && tapes.perp,
                macro: macroSnap || macroLive || null,
                ctx: (macroSnap || macroLive) ? { macro: macroSnap || macroLive } : null
              }, fc4);
            }
          } catch (eSwC) { if (fc4) fc4.confluence = null; }
          if (fc4) this.stampTicket(fc4);
          forecast.swing = (typeof window.hgCfBuildSetup === 'function')
            ? window.hgCfBuildSetup(c4, { tf: '4h' }, fc4) : null;
          if (forecast.swing) forecast.swing.source = loaded4.source || '';
        } else {
          forecast.swing = { ok: false, tf: '4h', formed: false, why: 'the 4h gold tape could not be read: ' + this.unreadReason(c4, '4h', prepared4) + ' No swing bracket is shown.' };
        }
      } catch (eSw) {
        forecast.swing = { ok: false, tf: '4h', formed: false, why: 'the 4h tape failed: ' + String((eSw && eSw.message) || eSw) };
      }
      try {
        if (typeof window.hgCfUltimate === 'function') forecast.ultimate = window.hgCfUltimate(forecast.scalp, forecast.swing);
      } catch (eUlt) { forecast.ultimate = null; }
      try {
        forecast.measure = (typeof window.hgCfMeasure === 'function')
          ? window.hgCfMeasure(forecast.scalp, forecast.swing, candles, (Array.isArray(c4) ? c4 : null))
          : null;
      } catch (eMeas) { forecast.measure = null; }
      try {
        forecast.daySwings = (typeof window.hgCfDaySwings === 'function')
          ? window.hgCfDaySwings(Array.isArray(c4) ? c4 : null, { live: forecast.swing, limit: 2 })
          : { ok: false, setups: [], why: 'Confirmed swings could not be read. Nothing was invented.' };
      } catch (eDay) {
        forecast.daySwings = { ok: false, setups: [], why: 'Confirmed swings could not be read. Nothing was invented.' };
      }
      this.renderResult(resultArea, statusEl, forecast);

      /* hg-v1325: the wide tally paints AFTER the card. The earlier call sat
         above renderResult, and the card replaces innerHTML, so the tally
         never stayed on screen. A thin count prints no stop. */
      try {
        var conf = (typeof window.hgUltimateConfluence === 'function')
          ? window.hgUltimateConfluence(candles) : null;
        /* The first call is the 15m tally. When the 4h tape was read, ask
           again with that tape so the wide tally can name a swing beside
           the scalp. The house stop is still not this tally's stop. */
        if (conf && Array.isArray(c4) && c4.length >= CF_MIN_BARS && typeof window.hgUltimateConfluence === 'function') {
          var withSwing = window.hgUltimateConfluence(candles, { swingRows: c4 });
          if (withSwing) conf = withSwing;
        }
        if (conf) this.renderConfluence(resultArea, statusEl, conf);
      } catch (eConf) { /* optional read; the card stands on its own */ }

      /* Record a formed bracket after the card and the tally. A non-formed
         read is not recorded. Both horizons stay separate. The marks are
         named, not spread. The ledger does not paint the card. */
      try {
        if (typeof window.hgFwdRecordScan === 'function' && typeof window.hgCfPatternMarks === 'function') {
          var recs = [];
          var mk = function (bracket, tape, source) {
            try {
              if (!bracket || !bracket.formed) return;
              if (!(isFinite(+bracket.entry) && isFinite(+bracket.stop) && isFinite(+bracket.tp1))) return;
              var lastBar = (Array.isArray(tape) && tape.length) ? tape[tape.length - 1] : null;
              recs.push({
                sym: 'XAUUSD',
                dir: (bracket.dir === 'BEAR') ? 'short' : 'long',
                entry: +bracket.entry, stop: +bracket.stop, t1: +bracket.tp1, t2: +bracket.tp2,
                signalT: (lastBar && isFinite(+lastBar.t)) ? +lastBar.t : undefined,
                mark: (lastBar && isFinite(+lastBar.c)) ? +lastBar.c : undefined,
                feed: source || undefined,
                reads: window.hgCfPatternMarks(forecast, tape)
              });
            } catch (eOne) { /* one unreadable bracket must not lose the other */ }
          };
          mk(forecast.scalp, candles, forecast.scalp && forecast.scalp.source);
          mk(forecast.swing, (Array.isArray(c4) ? c4 : null), forecast.swing && forecast.swing.source);
          if (recs.length && typeof window.hgFwdRecordScan === 'function') {
            window.hgFwdRecordScan('CANDLEFORECAST', '15m', recs);
          }
        }
      } catch (eRec) { /* the ledger is a measurement, never a reason the card fails */ }

    } catch (error) {
      console.error('[CandleForecast] Error:', error);
      resultArea.innerHTML = '<span class="note warn">Error: ' + String(error && error.message || error) + '</span>';
      statusEl.textContent = 'Failed';
    }
  };

  mod.esc = function(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  };

  /* hg-v1356: forecast from CLOSED, VALID bars only. Binance klines include the
     still-forming candle; at the first tick that candle can have high === low,
     and the shared engine correctly refuses it as unmeasurable. Dropping that
     one live bar is not a price invention: the previous closed bar is the last
     bar a next-candle forecast is allowed to know. Invalid rows are filtered,
     never repaired. */
  mod.prepareRows = function(rows, tf, nowMs) {
    var out = [];
    var dropped = [];
    var rawCount = Array.isArray(rows) ? rows.length : 0;
    if (!Array.isArray(rows)) return { rows: out, rawCount: rawCount, dropped: ['no candle array'], note: 'no candle array' };
    var seen = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var row = { t: +r.t, o: +r.o, h: +r.h, l: +r.l, c: +r.c, v: +r.v };
      if (!isFinite(row.t) || !isFinite(row.o) || !isFinite(row.h) || !isFinite(row.l) || !isFinite(row.c)) {
        dropped.push('non-numeric bar');
        continue;
      }
      if (!(row.h >= row.l)) {
        dropped.push('high below low');
        continue;
      }
      var key = String(row.t);
      if (seen[key]) {
        dropped.push('duplicate bar time');
        continue;
      }
      seen[key] = true;
      out.push(row);
    }
    out.sort(function(a, b) { return a.t - b.t; });

    var tfSec = ({ '15m': 900, '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400 })[tf] || 0;
    var nowSec = isFinite(+nowMs) ? (+nowMs / 1000) : (Date.now() / 1000);
    if (out.length && tfSec > 0) {
      var live = out[out.length - 1];
      if ((live.t + tfSec) > (nowSec + 30)) {
        out.pop();
        dropped.push('still-forming ' + tf + ' bar excluded');
      }
    }
    if (out.length) {
      var last = out[out.length - 1];
      if (!(last.h > last.l)) {
        out.pop();
        dropped.push('zero-range latest bar excluded');
      }
    }
    return {
      rows: out,
      rawCount: rawCount,
      dropped: dropped,
      note: dropped.length ? ('feed hygiene: ' + dropped.join(', ')) : ''
    };
  };

  mod.unreadReason = function(rows, tf, prepared) {
    var p = prepared || this.prepareRows(rows, tf);
    var clean = p.rows || [];
    var bits = [];
    if (p.note) bits.push(p.note);
    if (!Array.isArray(rows) || !rows.length) bits.push('the feed returned no candles');
    else if (clean.length < CF_MIN_BARS) bits.push('only ' + clean.length + ' closed/valid ' + tf + ' bars remain; the forecast needs ' + CF_MIN_BARS);
    if (typeof window === 'undefined' || typeof window.atr !== 'function' || typeof window.ema !== 'function') {
      bits.push('the shared ATR/EMA helpers are not loaded');
    }
    if (!bits.length) bits.push('the shared engine could not measure this tape');
    return bits.join(' · ') + ' Nothing was invented.';
  };

  /* hg-v1318: ONE loader for every horizon. This was hard-wired to 15m, so the tab
     could only ever describe a scalp; the swing bracket needs the SAME chain on the
     4h tape (house loader -> XAU -> IUX-anchored PAXG). Parameterising it rather than
     adding a second loader keeps one home for the feed order and the PAXG anchor
     (hg-v949) — a copied chain would drift and the two horizons would disagree about
     which feed they came from. */
  mod.loadGold = async function(tf, count) {
    tf = tf || '15m';
    count = count || 80;
    var pack = null;
    if (typeof window.getGoldCandles === 'function') {
      try { pack = await window.getGoldCandles(tf, count); } catch (e) { pack = null; }
    }
    var rows = pack && pack.rows;
    if (rows && rows.length >= CF_MIN_BARS) return { rows: rows, source: pack.source || ('gold tape ' + tf) };
    if (typeof window.binanceKlines === 'function') {
      try {
        var xau = await window.binanceKlines('XAUUSDT', tf, count);
        if (xau && xau.length >= CF_MIN_BARS) return { rows: xau, source: 'BINANCE XAUUSDT ' + tf };
      } catch (e2) {}
      try {
        var paxg = await window.binanceKlines('PAXGUSDT', tf, count);
        if (paxg && paxg.length >= CF_MIN_BARS) {
          /* hg-v1310: a DIRECT PAXG fallback leaves the shared macro chain, so it
             is anchored here through the one home (gold-iux.js), exactly as
             getGoldCandles and goldscalp.js anchor their own packs — PAXG is a
             token, not the metal, and a forecast built on its unanchored level
             would disagree with every other gold desk. Module absent or anchor
             unreadable: the feed's own bars (fail open). */
          try {
            var iuxFn = (typeof window.hgGoldIuxApplyRows === 'function') ? window.hgGoldIuxApplyRows : null;
            if (iuxFn) {
              var anchored = await iuxFn(paxg, 'binance-paxg');
              if (anchored && anchored.length) return { rows: anchored, source: 'BINANCE PAXGUSDT ' + tf + ' · IUX anchored' };
            }
          } catch (eIx) {}
          return { rows: paxg, source: 'BINANCE PAXGUSDT ' + tf };
        }
      } catch (e3) {}
    }
    return { rows: [], source: '' };
  };

  mod.loadGold15m = function () { return mod.loadGold('15m', 80); };

  mod.loadMacro = async function() {
    var cached = null;
    try {
      if (typeof window.getGoldMacroCached === 'function') cached = window.getGoldMacroCached();
    } catch (e0) { cached = null; }
    if (cached && typeof cached === 'object') return cached;
    if (typeof window.getGoldMacro !== 'function') return null;
    try {
      return await Promise.race([
        window.getGoldMacro(),
        new Promise(function(resolve) { setTimeout(function() { resolve(null); }, 4000); })
      ]);
    } catch (e1) { return null; }
  };

  mod.loadTapes = async function() {
    function pack(tf, n) {
      if (typeof window.getGoldCandles !== 'function') return Promise.resolve(null);
      return Promise.race([
        window.getGoldCandles(tf, n).then(function(p) { return p && p.rows && p.rows.length ? p.rows : null; }).catch(function() { return null; }),
        new Promise(function(resolve) { setTimeout(function() { resolve(null); }, 4000); })
      ]);
    }
    var out = { rows1h: null, rows4h: null, rows1d: null, spot: null, perp: null };
    try {
      var got = await Promise.all([pack('1h', 80), pack('4h', 80), pack('1d', 220)]);
      out.rows1h = got[0];
      out.rows4h = got[1];
      out.rows1d = got[2];
    } catch (e2) {}
    return out;
  };

  /**
   * hg-v1333: the live 4h swing is on the card every scan. The day's confirmed
   * list does not hide it. A neutral tape still prints no stop.
   */
  mod.renderResult = function(container, statusEl, forecast) {
    var sw = forecast.swing || null;
    var swDir = (sw && (sw.dir === 'BULL' || sw.dir === 'BEAR')) ? sw.dir : '';
    function swingHasLevels(b) {
      if (!b) return false;
      var dir = b.dir;
      if (dir !== 'BULL' && dir !== 'BEAR') return false;
      var entry = +b.entry, stopPx = +b.stop, t1 = +b.tp1;
      if (!isFinite(entry) || !isFinite(stopPx) || !isFinite(t1)) return false;
      if (!(Math.abs(entry - stopPx) > 0)) return false;
      return dir === 'BULL' ? (t1 > entry) : (t1 < entry);
    }
    function swingLevelsHtml(b) {
      var t2 = isFinite(+b.tp2)
        ? ('<br>TP2 <span class="pos" style="font-weight:700;">' + mod.fmt(b.tp2) + '</span>' + (b.rr == null ? '' : ' <span class="note">(' + b.rr + 'R to TP2)</span>'))
        : '';
      return 'Entry <b>' + mod.fmt(b.entry) + '</b><br><b>Stop:</b> <span class="neg" style="font-weight:700;">' + mod.fmt(b.stop) + '</span> <span class="note">(' + String(b.stopSource || '') + ' &middot; ' + (b.riskAtr == null ? '&mdash;' : (b.riskAtr + 'x ATR')) + ')</span><br>TP1 <span class="pos" style="font-weight:700;">' + mod.fmt(b.tp1) + '</span>' + t2;
    }
    var swHas = swingHasLevels(sw);
    var dirClass = swDir === 'BULL' ? 'long' : (swDir === 'BEAR' ? 'short' : '');
    var missBit = (sw && sw.formed !== true && sw.missing) ? (' · ' + String(sw.missing)) : '';
    var sessionBit = (sw && sw.session) ? (' · session ' + String(sw.session).replace(/</g, '')) : '';
    var dirLabel = swHas
      ? (String((sw.formed === true && sw.label) ? sw.label : (sw.label || (swDir === 'BULL' ? 'LONG READ' : 'SHORT READ'))) + ' · SWING' + (sw.formed === true ? '' : missBit) + sessionBit)
      : ('NO SWING SETUP' + missBit + sessionBit);
    var reasons = (forecast.reasons || []).map(function(r) {
      return '<li>' + String(r).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</li>';
    }).join('');
    var namedPats = (forecast.patterns || []).concat(forecast.advancedPatterns || []);
    var patLine = namedPats.length ? namedPats.join(', ') : 'none';

    /* hg-v1351: WHICH FEED PRICED THESE LEVELS. The loader chain is house gold tape →
       BINANCE XAUUSDT (the metal) → BINANCE PAXGUSDT (a token, IUX-anchored). Those are
       DIFFERENT INSTRUMENTS, and the swing can be read from a different leg than the
       scalp on the same scan — so a reader comparing the two horizons, or checking a
       level against their broker, had no way to know which one they were looking at.
       The value was already carried on `forecast.source` and `swing.source`; nothing
       rendered it. Both legs are named when they differ, because that difference is a
       fact about the read, not a detail. */
    var feedLine = (function () {
      var esc = function (x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
      var s15 = String(forecast.source || '').trim();
      var s4 = String((forecast.swing && forecast.swing.source) || '').trim();
      if (s15 && forecast.feedNote) s15 += ' · ' + String(forecast.feedNote);
      if (!s15 && !s4) return '';
      if (s15 && s4 && s15 !== s4) {
        return '<li><b>Feed:</b> scalp ' + esc(s15) + ' · swing ' + esc(s4)
          + ' <span class="note">(different legs — the levels are not from one instrument)</span></li>';
      }
      return '<li><b>Feed:</b> ' + esc(s15 || s4) + '</li>';
    })();
    var faceFacts = '<div class="note" style="margin-top:4px;"><b>Last close:</b> <span style="font-weight:700;">' + mod.fmt(forecast.close) + '</span></div>'
      + (feedLine ? feedLine.replace('<li>', '<div class="note" style="margin-top:2px;">').replace('</li>', '</div>') : '');

    var levels = '<li><b>Published:</b> the 4h swing is shown on every scan. Confirmed swings for the day are still capped at two. A 15m scalp is not a published setup.</li>'
      + '<li><b>Gold desk:</b> ' + String(forecast.desk || 'unread').replace(/&/g, '&').replace(/</g, '<') + '</li>'
      + '<li><b>Gold tabs:</b> ' + String(forecast.tabs || 'unread').replace(/&/g, '&').replace(/</g, '<') + '</li>'
      + '<li><b>Patterns:</b> ' + patLine.replace(/&/g, '&').replace(/</g, '<') + '</li>'
      + '<li><b>Higher timeframes:</b> ' + String(forecast.higher || 'unread').replace(/&/g, '&').replace(/</g, '<') + '</li>';

    /* hg-v1314: THE CONFLUENCE BLOCK. What the other gold desks know, beside the
       candle read. Rendered straight from the shared readers' own output — nothing
       here is computed, scored or thresholded on this side, so the tab cannot drift
       from the desks it is reading. */
    var cfl = forecast.confluence;
    var conflHtml = '';
    var horizonsHtml = '';
    (function () {
      var wants = [['scalp', 'SCALP', forecast.scalp], ['swing', 'SWING', forecast.swing]];
      if (!wants.some(function (w) { return w[2]; })) return;
      var cells = wants.map(function (w) {
        var bracket = w[2], tag = w[1];
        if (!bracket) return '<td style="vertical-align:top;padding:8px;"><b>' + tag + '</b><div class="note">not read</div></td>';
        if (!bracket.ok) return '<td style="vertical-align:top;padding:8px;"><b>' + tag + '</b><div class="note">' + String(bracket.why).replace(/</g, '') + '</div></td>';
        var showSwing = (tag === 'SWING') && swingHasLevels(bracket);
        var formed = (tag === 'SCALP')
          ? '<span class="note">not published</span>'
          : (showSwing
            ? '<span class="' + (bracket.formed === true ? 'pos' : 'note') + '" style="font-weight:700;">' + String(bracket.label || 'SWING') + '</span>'
            : '<span class="note">no swing setup</span>');
        var lv = (tag === 'SCALP')
          ? '<div class="note" style="margin-top:4px;">Not published. The 4h swing is shown on every scan.</div>'
          : (showSwing
            ? '<div class="note" style="margin-top:4px;">Levels are on the swing above. They are not priced again here.</div>'
            : ('<div class="note" style="margin-top:4px;">' + String((bracket && bracket.why) || 'The 4h tape named no side, so no swing setup is printed. Nothing was invented.').replace(/</g, '') + '</div>'));
        var pat = (bracket.patterns && bracket.patterns.length) ? bracket.patterns.join(', ') : 'no named pattern';
        var adv = (bracket.advancedPatterns && bracket.advancedPatterns.length) ? (' · ' + bracket.advancedPatterns.join(', ')) : '';
        var cv = bracket.confluenceView;
        var conf = cv
          ? ('<div class="note">' + cv.familiesWith + ' families net with' + (cv.familiesAgainst ? (', ' + cv.familiesAgainst + ' net against') : ', none net against') + (cv.ticket ? ' · confluence setup' : '') + '</div>')
          : (bracket.confluenceWhy ? ('<div class="note">' + String(bracket.confluenceWhy).replace(/</g, '') + (bracket.ticket ? ' · confluence setup' : '') + '</div>') : '');
        var hi = bracket.higher ? ('<div class="note">Higher: ' + String(bracket.higher).replace(/</g, '') + '</div>') : '';
        /* hg-v1322: the gold tape's own refusal, when there is one. Without this a
           reader sees "not a setup" and cannot tell "no signal formed" from "the
           tape refused the signal" — the desks withhold a TICKET on exactly these
           tapes, and the reason belongs on the card. */
        var veto = bracket.tapeVeto
          ? ('<div class="note warn">Gold tape veto: ' + String(bracket.tapeVeto).replace(/</g, '') + '</div>')
          : '';
        var pf = bracket.perfectWhy
          ? ('<div class="note">Perfect bar: ' + String(bracket.perfectWhy).replace(/</g, '') + '</div>')
          : '';
        return '<td style="vertical-align:top;padding:8px;border-left:1px solid var(--line);"><b>' + tag + '</b> <span class="note">' + String(bracket.tf || '') + '</span><br>' + formed + '<div class="note" style="margin-top:4px;">' + String(pat).replace(/</g, '') + String(adv).replace(/</g, '') + '</div>' + hi + conf + lv + veto + pf + '</td>';
      }).join('');
      horizonsHtml = '<div class="note" data-cf-horizons="1" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;"><b>SCALP AND SWING</b> <span class="note">— both built by one builder, each on its own tape</span><table style="width:100%; border-collapse:collapse; margin-top:4px;"><tr>' + cells + '</tr></table><div class="note">A scalp stop and a swing stop in dollars are not the same risk: read each against its own ATR above.</div></div>';
    })();
    if (cfl && cfl.ok) {
      var rowsHtml = (cfl.voters || []).map(function(v) {
        var mark = v.lean === true ? '<span class="pos" style="font-weight:700;">WITH</span>' : (v.lean === false ? '<span class="neg" style="font-weight:700;">AGAINST</span>' : '<span class="note">unread</span>');
        var why = v.why ? (' <span class="note">— ' + String(v.why).replace(/&/g, '&').replace(/</g, '<') + '</span>') : '';
        return '<li>' + mark + ' <b>' + String(v.name).replace(/</g, '') + '</b> <span class="note">(' + String(v.family) + ')</span>' + why + '</li>';
      }).join('');
      var verdict = cfl.ticket ? '<b class="pos">CONFLUENCE SETUP</b>' : '<b>CONFLUENCE READ</b> <span class="note">· NOT A TICKET</span>';
      var deskHtml = (function () {
        var ds = cfl.desks || [];
        if (!ds.length) return '';
        var rows2 = ds.map(function (d) {
          var mark = d.lean === true ? '<span class="pos" style="font-weight:700;">WITH</span>' : (d.lean === false ? '<span class="neg" style="font-weight:700;">AGAINST</span>' : '<span class="note">formed nothing</span>');
          return '<li>' + mark + ' <b>' + String(d.desk).replace(/</g, '') + '</b> <span class="note">— ' + String(d.long) + ' long / ' + String(d.short) + ' short' + (d.why ? (' · ' + String(d.why).replace(/&/g, '&').replace(/</g, '<')) : '') + (d.perfectWhy ? (' · ' + String(d.perfectWhy).replace(/</g, '')) : '') + '</span></li>';
        }).join('');
        return '<div class="note" style="margin-top:6px;"><b>GOLD DESKS ON THIS TAPE</b> — <span class="note">' + String(cfl.deskWhy || '').replace(/</g, '') + '</span><ul class="lst">' + rows2 + '</ul></div>';
      })();
      conflHtml = '<div class="note" data-cf-confluence="1" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;">'
        + '<div style="margin-bottom:4px;">' + verdict + ' <span class="note">— ' + String(cfl.why).replace(/</g, '') + '</span></div>'
        + '<div class="note" style="margin-bottom:4px;"><b>' + cfl.familiesWith + ' famil' + (cfl.familiesWith === 1 ? 'y' : 'ies') + ' net with the call' + (cfl.familiesAgainst ? (', ' + cfl.familiesAgainst + ' net AGAINST') : ', no family net against') + '</b> · ' + cfl.with_ + ' read' + (cfl.with_ === 1 ? '' : 's') + ' with, ' + cfl.against + ' against, ' + cfl.unread + ' unread</div>'
        + '<ul class="lst">' + rowsHtml + '</ul>' + deskHtml
        + '<div class="note">Macro snapshot: ' + (forecast.macroRead ? 'read — the fundamental family can vote' : 'not cached this scan, so the fundamental family reads UNREAD (never counted as agreement)') + '</div>'
        + (cfl.missing && cfl.missing.length ? ('<div class="note warn">Not read this scan: ' + cfl.missing.join(' · ') + '</div>') : '')
        + '<div class="note">A confluence setup needs two families net with the call, no family net against, and a named candle pattern. Unread is never counted as agreement. News and the free feeds are listed here and do not vote again. The scalp and the swing each carry their own tape.</div></div>';
    } else if (cfl) {
      conflHtml = '<div class="note" data-cf-confluence="unread" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;"><b>CONFLUENCE</b> — not read: ' + String(cfl.why || 'unavailable').replace(/</g, '') + '</div>';
    }
    var swingView = forecast.swing && forecast.swing.confluenceView;
    var swingConflHtml = '';
    if (swingView && swingView.why) {
      var swRows = (swingView.voters || []).map(function (v) {
        var mark = v.lean === true ? '<span class="pos" style="font-weight:700;">WITH</span>' : (v.lean === false ? '<span class="neg" style="font-weight:700;">AGAINST</span>' : '<span class="note">unread</span>');
        var why = v.why ? (' <span class="note">— ' + String(v.why).replace(/</g, '') + '</span>') : '';
        return '<li>' + mark + ' <b>' + String(v.name).replace(/</g, '') + '</b> <span class="note">(' + String(v.family) + ')</span>' + why + '</li>';
      }).join('');
      var swDesks = (swingView.desks || []).map(function (d) {
        var mark = d.lean === true ? '<span class="pos" style="font-weight:700;">WITH</span>' : (d.lean === false ? '<span class="neg" style="font-weight:700;">AGAINST</span>' : '<span class="note">formed nothing</span>');
        return '<li>' + mark + ' <b>' + String(d.desk).replace(/</g, '') + '</b> <span class="note">— ' + String(d.long) + ' long / ' + String(d.short) + ' short' + (d.why ? (' · ' + String(d.why).replace(/</g, '')) : '') + (d.perfectWhy ? (' · ' + String(d.perfectWhy).replace(/</g, '')) : '') + '</span></li>';
      }).join('');
      var swVerdict = swingView.ticket ? '<b class="pos">CONFLUENCE SETUP</b>' : '<b>CONFLUENCE READ</b> <span class="note">· NOT A TICKET</span>';
      swingConflHtml = '<div class="note" data-cf-swing="1" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;">'
        + '<div style="margin-bottom:4px;"><b>SWING 4h</b> ' + swVerdict + ' <span class="note">— ' + String(swingView.why).replace(/</g, '') + '</span></div>'
        + '<div class="note" style="margin-bottom:4px;"><b>' + swingView.familiesWith + ' famil' + (swingView.familiesWith === 1 ? 'y' : 'ies') + ' net with the call' + (swingView.familiesAgainst ? (', ' + swingView.familiesAgainst + ' net AGAINST') : ', no family net against') + '</b></div>'
        + '<ul class="lst">' + swRows + '</ul>'
        + (swDesks ? ('<div class="note" style="margin-top:6px;"><b>GOLD DESKS ON THE 4h TAPE</b> — <span class="note">' + String(swingView.deskWhy || '').replace(/</g, '') + '</span><ul class="lst">' + swDesks + '</ul></div>') : '')
        + '</div>';
    }
    var ult = forecast.ultimate;
    var ultHtml = '';
    if (ult && ult.ok) {
      var ultCall = ult.formed
        ? (ult.side === 'BULL' ? 'ULTIMATE LONG SETUP' : 'ULTIMATE SHORT SETUP')
        : (ult.side === 'BULL' ? 'LONG READ · NOT AN ULTIMATE SETUP' : (ult.side === 'BEAR' ? 'SHORT READ · NOT AN ULTIMATE SETUP' : (ult.side === 'SPLIT' ? 'SPLIT · NOT A SIDE' : (ult.side === 'NEUTRAL' ? 'NEUTRAL' : 'UNREAD'))));
      ultHtml = '<div class="note" data-cf-ultimate="1" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;">'
        + '<div style="margin-bottom:4px;"><b>ULTIMATE AI CONFLUENCE</b> <span class="' + (ult.formed ? 'pos' : 'note') + '" style="font-weight:700;">' + ultCall + '</span></div>'
        + '<div class="note">' + String(ult.why || '').replace(/</g, '') + '</div>'
        + '<div class="note">' + String(ult.scalp || '').replace(/</g, '') + '</div>'
        + '<div class="note">' + String(ult.swing || '').replace(/</g, '') + '</div>'
        + '<div class="note">The two stops are not combined. Read the scalp against the 15m ATR and the swing against the 4h ATR. News and the free feeds are listed on each tape and do not cast a second vote.</div></div>';
    }
    var m = forecast.measure;
    function cfEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&').replace(/</g, '<'); }
    var measureHtml = '<div class="note" data-cf-measure="1" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;">'
      + '<div style="margin-bottom:4px;"><b>PERFECT, BACKTEST, FORWARD</b></div>';
    if (!m) {
      measureHtml += '<div class="note">The shared perfect bar was not read this scan. Nothing was called perfect. Nothing was counted as a win.</div>';
    } else {
      measureHtml += '<div class="note"><b>Scalp.</b> ' + cfEsc(m.scalpAsk && m.scalpAsk.line) + '</div>'
        + '<div class="note"><b>Swing.</b> ' + cfEsc(m.swingAsk && m.swingAsk.line) + '</div>'
        + '<div class="note"><b>In-sample walk, 15m.</b> ' + cfEsc(m.walk15 && m.walk15.why) + '</div>'
        + '<div class="note"><b>In-sample walk, 4h.</b> ' + cfEsc(m.walk4 && m.walk4.why) + '</div>'
        + '<div class="note"><b>Forward ledger.</b> ' + cfEsc(m.fwd15 && m.fwd15.why) + ' ' + cfEsc(m.fwd4 && m.fwd4.why) + '</div>'
        + (m.fwdHtml || '');
    }
    measureHtml += '<div class="note">Perfect is a badge from the shared bar. It does not form the setup and it does not move the stop. The walk is in-sample on this tape only. It is not a forward result and not a probability. Higher frames were not fed into that walk. The forward ledger is the out-of-sample test.</div></div>';

    var dayHtml = (function () {
      var d = forecast.daySwings || { setups: [], why: 'Confirmed swings could not be read. Nothing was invented.' };
      function esc(x) { return String(x == null ? '' : x).replace(/</g, ''); }
      function clockOf(s) {
        var t = +(s && s.barT);
        if (!(t > 0)) return '<div class="note">time unread</div>';
        var ms = t < 1e12 ? t * 1000 : t;
        var when = '';
        try {
          var dt = new Date(ms);
          if (isFinite(dt.getTime())) when = dt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
        } catch (eClk) { when = ''; }
        var ses = '';
        try {
          if (typeof window.hgCfSessionName === 'function') ses = window.hgCfSessionName([{ t: t }]) || '';
        } catch (eSes) { ses = ''; }
        return '<div class="note">' + (when ? ('time ' + esc(when)) : 'time unread') + (ses ? (' · session ' + esc(ses)) : '') + '</div>';
      }
      var list = d.setups || [];
      var items = list.map(function (s, idx) {
        var same = !!(sw && idx === list.length - 1 && s.dir === sw.dir
          && isFinite(+s.entry) && isFinite(+sw.entry) && +s.entry === +sw.entry
          && isFinite(+s.stop) && isFinite(+sw.stop) && +s.stop === +sw.stop);
        var head = '<li><b>' + (idx + 1) + '. ' + esc(s.label || '') + '</b> <span class="note">4h swing</span>';
        var parts = s.parts ? ('<div class="note">' + esc(s.parts) + '</div>') : '';
        if (same) return head + clockOf(s) + '<div class="note">This is the swing above. It is not priced again here.</div>' + parts + '</li>';
        return head + clockOf(s) + '<br>Entry <b>' + mod.fmt(s.entry) + '</b> · <b>Stop:</b> <span class="neg" style="font-weight:700;">' + mod.fmt(s.stop) + '</span> · TP1 <span class="pos" style="font-weight:700;">' + mod.fmt(s.tp1) + '</span>' + (s.tp2 == null ? '' : (' · TP2 <span class="pos" style="font-weight:700;">' + mod.fmt(s.tp2) + '</span>')) + parts + '</li>';
      }).join('');
      return '<div class="note" data-cf-day-swings="1" style="margin:8px 0; border:1px solid var(--line); padding:8px;"><b>CONFIRMED SWING SETUPS</b> <span class="note">— two are enough for the day</span><div class="note">' + String(d.why || '').replace(/</g, '') + '</div>' + (items ? ('<ul class="lst">' + items + '</ul>') : '<div class="note">None shown.</div>') + '</div>';
    })();
    var fwdFace = (function () {
      var why = (forecast.measure && forecast.measure.fwd4 && forecast.measure.fwd4.why)
        ? String(forecast.measure.fwd4.why)
        : 'The forward ledger was not read this scan. Nothing was counted as a win.';
      return '<div class="note" data-cf-forward="1" style="margin:8px 0;"><b>Forward ledger, 4h.</b> ' + why.replace(/</g, '') + ' <span class="note">Out of sample. Not a probability.</span></div>';
    })();
    var alwaysHtml = (function () {
      var body;
      if (swHas) {
        body = '<div style="margin-top:4px;">' + swingLevelsHtml(sw) + '</div>'
          + faceFacts
          + (sw.formed === true
            ? '<div class="note">Shown on every scan. The day list does not hide this swing.</div>'
            : '<div class="note">Shown on every scan. Not a formed setup. These are the 4h call\'s own levels. Nothing new was priced.</div>');
      } else {
        body = '<span class="note">' + String((sw && sw.why) || 'The 4h tape named no side, so no swing setup is printed. Nothing was invented.').replace(/</g, '') + '</span>'
          + faceFacts;
      }
      return '<div class="note" data-cf-swing-always="1" style="margin:8px 0; border:1px solid var(--line); padding:8px;"><b>SWING</b> <span class="note">— shown on every scan</span><div style="margin-top:4px;">' + body + '</div></div>';
    })();
    container.className = '';
    container.innerHTML = `
      <div class="omni-side ${dirClass}" style="margin: 0; border-left-width: 4px;">
        <div class="omni-side-call">${dirLabel}</div>
        ${alwaysHtml}
        ${dayHtml}
        ${fwdFace}
        <details data-cf-rest="1" style="margin-top:8px;">
          <summary class="note">The rest of the read</summary>
        <ul class="lst">
          ${levels}
          <li><b>Reads:</b> ${forecast.agrees} for the call, ${forecast.against} against, of ${forecast.checked}</li>
        </ul>
        <ul class="lst">${reasons}</ul>
        ${ultHtml}
        ${measureHtml}
        ${horizonsHtml}
        ${conflHtml}
        ${swingConflHtml}
        <div class="note" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;">
          ${forecast.note || ''}
        </div>
        </details>
      </div>
    `;
    statusEl.textContent = swHas ? dirLabel : 'No swing setup';
  };

  /**
   * Wide tally under the card. Fifteen reads vote -1/0/+1 and the net is a
   * count, not a probability. A side prints one ATR bracket and says it is
   * not the scalp stop and not the swing stop. No side prints no stop.
   */
  mod.renderConfluence = function(container, statusEl, c) {
    var called = c.dir === 'BULL' || c.dir === 'BEAR';
    var color = c.dir === 'BEAR' ? '#dc262c' : (c.dir === 'BULL' ? '#15803d' : '#64748b');
    var rows = (c.reads || []).map(function(r) {
      var tag = r.vote > 0 ? 'LONG' : (r.vote < 0 ? 'SHORT' : 'no vote');
      var cls = r.vote > 0 ? 'pos' : (r.vote < 0 ? 'neg' : 'na');
      return '<li>' + String(r.label).replace(/</g, '') + ' — <span class="' + cls + '">'
        + tag + '</span> <span class="note">(' + String(r.note).replace(/</g, '') + ')</span></li>';
    }).join('');
    var self = this;
    var levels = called
      ? ('<li><b>' + (c.bracket.side === 'long' ? 'LONG' : 'SHORT') + ' illustration:</b> entry <b>'
        + self.fmt(c.bracket.entry) + '</b> · SL <b>' + self.fmt(c.bracket.sl) + '</b> · TP1 <b>'
        + self.fmt(c.bracket.tp1) + '</b> · TP2 <b>' + self.fmt(c.bracket.tp2)
        + '</b> <span class="note">— this tally\'s own one-ATR band. It is not the scalp stop and not the swing stop.</span></li>')
      : '<li class="note">No side. A thin tally prints no stop.</li>';
    container.insertAdjacentHTML('beforeend',
      '<div class="panel" data-cf-wide="1" style="margin-top:12px; border-left:4px solid ' + color + ';">'
      + '<h3 style="margin:0 0 6px;">WIDE TALLY <span class="note">— fifteen reads on the 15m tape</span> — '
      + '<span style="color:' + color + ';">' + (called ? c.dir : 'NO CALL') + '</span>'
      + ' <span class="note">(' + String(c.grade).replace(/</g, '') + ')</span></h3>'
      + '<ul class="lst">'
      + '<li class="note">This tally does not name the ultimate setup. That line is above, and only when the scalp and the swing agree.</li>'
      + '<li><b>Net:</b> <b>' + c.score + '</b> — the sum of the votes, a count, not a probability. '
      + c.agree + ' long, ' + c.oppose + ' short, ' + c.abstain + ' abstained, of ' + c.checked + '</li>'
      + (c.swing ? ('<li class="note">4h wide tally: ' + String(c.swing.dir) + ' (' + String(c.swing.grade || '').replace(/</g, '') + '). That read stays on the 4h tape. It is not the swing stop.</li>') : '')
      + ((c.patterns && c.patterns.length) ? ('<li class="note">Candle shapes on this tally: ' + c.patterns.map(function (p) { return String(p.label || p.id || '').replace(/</g, ''); }).slice(0, 8).join(', ') + '.</li>') : '')
      + '<li><b>Last close:</b> ' + self.fmt(c.close) + ' · <b>ATR band:</b> '
      + (c.bandLow != null ? (self.fmt(c.bandLow) + ' – ' + self.fmt(c.bandHigh)) : 'unread') + '</li>'
      + levels + '</ul>'
      + '<ul class="lst" style="max-height:260px; overflow:auto;">' + rows + '</ul>'
      + '<div class="note" style="margin-top:8px; border-top:1px solid var(--line); padding-top:8px;">'
      + String(c.note).replace(/</g, '') + '</div></div>');
  };

  mod.fmt = function(n) { return Number(n).toFixed(2); };

  // v1308: register through window.HG_tabs, the array bootHgTabs iterates.
  // Writing to window.HG_TAB_MODS directly misses the shell's lexical const
  // of the same name (see header above) and skips the auto-wiring that
  // creates the nav button + pane.
  if (typeof window !== 'undefined') {
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push(mod);
    // Defensive write: if a page has already run bootHgTabs and seeded the
    // registry object onto window (shell dev builds do this), carry the
    // module there too so a late-loaded tab can still mount on click.
    if (window.HG_TAB_MODS && typeof window.HG_TAB_MODS === 'object') {
      window.HG_TAB_MODS[mod.id] = mod;
    }
  }
})();
