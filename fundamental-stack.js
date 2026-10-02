/* =========================================================================
HARDGATE — fundamental-stack.js  (hg-v1003; leadership pass hg-v1005)
THE FUNDAMENTAL STACK, HOUSE-WIDE. One asset-aware read of the fundamental
feeds the app ALREADY fetches, shared by every crypto and gold setup tab.
hg-v1005 adds the two desk-side primitives the gold tabs share:
hgFundamentalScanCands (the v1004 leadership demote pass, generalized) and
hgFundamentalBlackout (the direction-free red-folder probe the entry vetoes
share) — one definition each, or eleven desk copies drift.

WHY THIS FILE EXISTS. hg-v1002 proved the pattern on OMNIBTC: the tape is
only half the read. But the stack lived inside omnibtc-engines.js, keyed to
BTC, unreachable by the other desks. This file is the single source of
truth the v1002 functions now delegate to — the same legs, the same house
thresholds, generalized by asset class:

  BTC ....... ON-CHAIN (mempool.space composite, votes) · TERM BASIS (the
              coin's curve row, votes) · FEAR & GREED (contrarian at the
              house S2 80/20 extremes only) · 25d RISK REVERSAL (Deribit,
              positioning at the house P9 |8| extreme only) · DVOL + BTC.D
              (INFO priors, never vote) · EVENT RISK (news blackout).
  ETH/ALTS .. FEAR & GREED and the coin's own TERM row vote; the news
              blackout refuses per symbol. ON-CHAIN is a BTC-only feed and
              says so (UNCHECKED, never faked); the BTC 25d RR + DVOL snaps
              render as COMPLEX PRIORS — INFO, never a vote for an alt.
  GOLD ...... REAL RATES (macro.js getGoldMacroCached: FRED DFII10 measured
              trend first, DXY+US10Y heuristic second — the same
              realRateHint goldind already scores) · CFTC COT (managed-money
              crowding, contrarian at the house |z|>=2 line — the same line
              goldCotGate vetoes at) · EVENT RISK (USD calendar, XAU). DXY,
              US10Y and the gold/silver ratio render INFO, never a vote.

THE DECISION RULES, identical on every desk (chips inform, gates decide):
  - a checked red-folder BLACKOUT refuses a fresh setup outright;
  - 2+ NET checked votes AGAINST the candidate's direction demote it to
    watch-only — ONE WITNESS NEVER FLIPS A SETUP, and a 2v1 split is not
    decisive;
  - 2+ net votes WITH the direction print a TAILWIND chip and touch nothing;
  - extreme legs print their own chips (F&G EXTREME / RR25 EXTREME / DVOL
    EXTREME / COT EXTREME);
  - a feed that was not measured says UNCHECKED — never a fake neutral.

WHAT THIS FILE WILL NOT DO.
  - Mint ENTRY / STOP / T1, invent direction, or move rank math.
  - Recalibrate a threshold. Every line above is the house's own, already
    enforced elsewhere (S2 80/20, P9 |8|, COT |z|>=2, realRateHint).
  - Read the mock macro feed (the fabricated macro-feeds.js series).
    Fabricated fundamentals are worse than none.
  - Fetch anything. Every read is state-only: the boot warmups and the
    desks' own loaders did the network work; a scan never blocks on it.

Classic script, IIFE. Every call is feature-checked. Never throws at load.
========================================================================= */
'use strict';

(function(){

  var W = (typeof window !== 'undefined') ? window : globalThis;

  function gfn(name){
    return (W && typeof W[name] === 'function') ? W[name] : null;
  }
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }
  function esc(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function dirOf(v){
    var d = String(v || '').toLowerCase();
    if (d === 'buy' || d === 'l' || d === 'long') return 'long';
    if (d === 'sell' || d === 's' || d === 'short') return 'short';
    return '';
  }

  /* index.html keeps its macro reads on a top-level `const S` — reachable
     from classic scripts by bare name, NEVER on window. Probe both, guard
     both; TDZ and a missing binding both read as absent. */
  function hostS(){
    try{ if (W.S) return W.S; }catch(e0){}
    try{ if (typeof S !== 'undefined' && S) return S; }catch(e1){}
    return null;
  }

  /* Base-asset key. desk-agree.js owns the canonical normalizer ('[Delta
     India] BTCUSD' == 'BTCUSDT' == 'B-BTC_USDT'); use it when loaded, else
     the same rules locally — two venues of one coin must read one stack. */
  function baseSym(sym){
    try{
      if (gfn('hgDeskAgreeBaseSym')) return W.hgDeskAgreeBaseSym(sym);
    }catch(e0){}
    try{
      var s = String(sym || '').toUpperCase().replace(/^\[[^\]]*\]\s*/, '').trim();
      var m = s.match(/^B-([A-Z0-9]+)_USDT$/);
      if (m && m[1]) return m[1];
      s = s.replace(/[^A-Z0-9]/g, '');
      s = s.replace(/PERP$/, '');
      s = s.replace(/(USDT|USDC|USD|INR)$/, '');
      return s;
    }catch(e){ return String(sym || ''); }
  }

  /* Asset class from the symbol. Gold first (XAUT/PAXG quote-strip to XAU
     shapes), then the coins. Unknown quote-less names read as crypto — the
     desks that call this only ever carry crypto or gold. */
  function hgFundamentalAssetOf(sym){
    var b = baseSym(sym);
    if (!b) return '';
    if (/^(XAU|XAUT|PAXG|GOLD|XAUUSD|XAUEUR)$/.test(b) || /XAU|GOLD/.test(b)) return 'gold';
    if (b === 'BTC' || b === 'XBT' || b === 'WBTC') return 'btc';
    if (b === 'ETH' || b === 'WETH') return 'eth';
    return 'crypto';
  }

  function rowForBase(list, base){
    var i, it, sym;
    if (!Array.isArray(list) || !base) return null;
    for (i = 0; i < list.length; i++){
      it = list[i];
      if (!it) continue;
      sym = baseSym(it.sym || it.symbol || it.pair || it.base || '');
      if (sym === base) return it;
    }
    return null;
  }

  /* ---------------- the legs ---------------- */

  function legOnchain(asset, extra){
    if (asset !== 'btc'){
      return { key: 'onchain', label: 'ON-CHAIN', vote: 'neutral', state: 'unchecked',
        text: 'mempool.space composite is a BTC-only feed — never faked for an alt' };
    }
    var oc = extra.onchain;
    if (oc === undefined){
      try{
        var st = gfn('onchainState') ? W.onchainState() : null;
        oc = (gfn('onchainSignal') && st) ? W.onchainSignal(st.snap) : null;
      }catch(e0){ oc = null; }
    }
    if (oc && oc.bias){
      var vote = oc.bias === 'bullish' ? 'bull' : (oc.bias === 'bearish' ? 'bear' : 'neutral');
      var fl = oc.flags || {}, bits = [];
      if (fl.feeSpike) bits.push('fee spike');
      if (fl.congestion === 'clogged') bits.push('mempool clogged');
      if (fl.capitulation) bits.push('capitulation');
      if (isFinite(fin(oc.hashrateTrendPct))) bits.push('hashrate ' + (+fin(oc.hashrateTrendPct)).toFixed(1) + '%');
      return { key: 'onchain', label: 'ON-CHAIN', vote: vote, state: 'checked',
        text: 'bias ' + oc.bias + (bits.length ? ' · ' + bits.join(' · ') : '') };
    }
    return { key: 'onchain', label: 'ON-CHAIN', vote: 'neutral', state: 'unchecked',
      text: 'mempool.space read absent' };
  }

  function legTerm(asset, extra, base){
    var term = extra.term;
    if (term === undefined && gfn('termBasisState')){
      try{
        var tb = W.termBasisState();
        var row = rowForBase((tb && (tb.rows || tb.pairs || tb.results)) || [], base);
        term = row && row.curve ? row.curve : (row || null);
      }catch(e1){ term = null; }
    }
    var tReg = term && term.regime;
    if (tReg){
      var vote = (tReg === 'contango' || tReg === 'perp rich') ? 'bear'
        : (tReg === 'backwardation' || tReg === 'perp cheap') ? 'bull' : 'neutral';
      return { key: 'term', label: 'TERM BASIS', vote: vote, state: 'checked',
        text: String(tReg) + (vote === 'bear' ? ' — longs pay to be long' : vote === 'bull' ? ' — perp cheap / spot leads' : '') };
    }
    return { key: 'term', label: 'TERM BASIS', vote: 'neutral', state: 'unchecked',
      text: 'futures curve read absent' + (asset === 'btc' ? '' : (base ? ' for ' + base : ' — the coin is unidentified')) };
  }

  function legFng(extra){
    var fng = extra.fng;
    if (fng === undefined){
      var hS = hostS();
      fng = (hS && hS.fng) ? hS.fng : null;
    }
    if (fng && isFinite(fin(fng.v))){
      var fv = +fin(fng.v);
      var vote = fv >= 80 ? 'bear' : (fv <= 20 ? 'bull' : 'neutral');
      return { key: 'fng', label: 'FEAR & GREED', vote: vote, state: 'checked',
        extreme: vote !== 'neutral',
        text: fv + ' ' + (fng.c || '')
          + (vote === 'bear' ? ' — contrarian bear (house S2 ≥80 line)'
            : vote === 'bull' ? ' — contrarian bull (house S2 ≤20 line)'
            : ' — no extreme, no vote') };
    }
    return { key: 'fng', label: 'FEAR & GREED', vote: 'neutral', state: 'unchecked',
      text: 'alternative.me read absent' };
  }

  function legRr25d(asset, extra){
    var opt = extra.options;
    if (opt === undefined && gfn('deribitOptionsState')){
      try{ opt = W.deribitOptionsState(); }catch(eO){ opt = null; }
    }
    var rr = opt && opt.rr25d;
    if (rr && isFinite(fin(rr.rr25d))){
      var rv = +fin(rr.rr25d);
      var rExt = rr.extreme === true || (rr.extreme === undefined && Math.abs(rv) >= 8);
      var rBias = rr.bias || (rv > 0 ? 'CALLS RICH' : 'PUTS RICH');
      /* The boot warmup fetches the BTC book only. For an alt this snap is
         a COMPLEX PRIOR — it renders, it never casts the alt's vote. */
      if (asset !== 'btc'){
        return { key: 'rr25d', label: '25Δ RISK REVERSAL', vote: 'neutral', state: 'checked', info: true,
          extreme: rExt,
          text: 'BTC complex prior · rr ' + rv.toFixed(1) + ' · ' + rBias
            + (rExt ? ' · extreme (house |8| line)' : '') + ' — never a vote for an alt' };
      }
      var vote = rExt ? (rBias === 'PUTS RICH' ? 'bear' : 'bull') : 'neutral';
      return { key: 'rr25d', label: '25Δ RISK REVERSAL', vote: vote, state: 'checked',
        extreme: rExt,
        text: 'rr ' + rv.toFixed(1) + ' · ' + rBias
          + (rExt ? ' · extreme (house |8| line)' : ' · inside the |8| line, no vote') };
    }
    return { key: 'rr25d', label: '25Δ RISK REVERSAL', vote: 'neutral', state: 'unchecked',
      text: 'Deribit options snap absent' };
  }

  function legDvol(extra){
    var dv = extra.dvol;
    if (dv === undefined && gfn('deribitVolState')){
      try{ dv = W.deribitVolState(); }catch(eD){ dv = null; }
    }
    if (dv && isFinite(fin(dv.dvol))){
      return { key: 'dvol', label: 'DVOL (Deribit)', vote: 'neutral', state: 'checked', info: true,
        extreme: dv.regime === 'extreme',
        text: 'DVOL ' + (+fin(dv.dvol)).toFixed(1) + ' · ' + (dv.regime || 'normal') + ' — vol prior, never a vote' };
    }
    return { key: 'dvol', label: 'DVOL (Deribit)', vote: 'neutral', state: 'unchecked', info: true,
      text: 'DVOL snap absent' };
  }

  function legDom(extra){
    var dom = extra.dom;
    if (dom === undefined){
      var hS = hostS();
      dom = (hS && hS.dom != null) ? hS.dom : null;
    }
    if (isFinite(fin(dom))){
      return { key: 'dom', label: 'BTC DOMINANCE', vote: 'neutral', state: 'checked', info: true,
        text: (+fin(dom)).toFixed(1) + '% — informational (house F1: judge it yourself)' };
    }
    return { key: 'dom', label: 'BTC DOMINANCE', vote: 'neutral', state: 'unchecked', info: true,
      text: 'coingecko global read absent' };
  }

  function legNews(extra, newsKey){
    var news = extra.news;
    if (news === undefined && gfn('hgNewsRisk')){
      try{ news = W.hgNewsRisk(newsKey); }catch(eN){ news = null; }
    }
    if (news && !news.unchecked){
      return { key: 'news', label: 'EVENT RISK', vote: 'neutral', state: 'checked',
        blackout: news.blackout === true,
        text: news.blackout
          ? 'BLACKOUT — red-folder window: no fresh setup forms into the print'
          : 'risk ' + (news.risk || 'low') + ' — calendar checked, no blackout' };
    }
    return { key: 'news', label: 'EVENT RISK', vote: 'neutral', state: 'unchecked',
      text: 'calendar unchecked' + (news && news.note ? ' — ' + news.note : '') };
  }

  /* GOLD legs — real rates first (FRED-measured when macro.js has it), COT
     second (weekly CFTC managed money, contrarian at the house |z|>=2 line),
     the USD calendar as the blackout. DXY / US10Y / GSR are priors. */
  function legRealRate(extra){
    var macro = extra.macro;
    if (macro === undefined && gfn('getGoldMacroCached')){
      try{ macro = W.getGoldMacroCached(); }catch(eM){ macro = null; }
    }
    if (!macro){
      return { key: 'realrate', label: 'REAL RATES / DXY', vote: 'neutral', state: 'unchecked',
        text: 'gold macro read absent — getGoldMacro has not run' };
    }
    var measured = macro.realRateMeasured && macro.realRateMeasured.measured;
    var anyTrend = measured || (macro.dxy && macro.dxy.trend20) || macro.tnxTrend;
    if (!anyTrend){
      return { key: 'realrate', label: 'REAL RATES / DXY', vote: 'neutral', state: 'unchecked',
        text: 'macro fetch failed every leg — a NEUTRAL hint with no data is not a read' };
    }
    var hint = macro.realRateHint || 'NEUTRAL';
    var vote = hint === 'TAILWIND' ? 'bull' : (hint === 'HEADWIND' ? 'bear' : 'neutral');
    var src = measured ? 'FRED DFII10 measured' : 'DXY + US10Y trend heuristic';
    return { key: 'realrate', label: 'REAL RATES / DXY', vote: vote, state: 'checked',
      text: hint + ' · ' + src
        + (vote === 'bull' ? ' — falling rates favor gold longs' : vote === 'bear' ? ' — rising rates press gold' : ' — no tilt') };
  }

  function legCot(extra){
    var cot = extra.cot;
    if (cot === undefined){
      try{ cot = W.__hgGoldCot || null; }catch(eC){ cot = null; }
    }
    var z = cot && isFinite(fin(cot.zScore)) ? +fin(cot.zScore) : null;
    if (cot && (z !== null || cot.crowding)){
      var crowd = cot.crowding || 'NEUTRAL';
      var vote = 'neutral', ext = false;
      if (z !== null && z >= 2){ vote = 'bear'; ext = true; }
      else if (z !== null && z <= -2){ vote = 'bull'; ext = true; }
      else if (crowd === 'SPEC CROWDED LONG'){ vote = 'bear'; ext = true; }
      else if (crowd === 'SPEC CROWDED SHORT'){ vote = 'bull'; ext = true; }
      return { key: 'cot', label: 'CFTC COT', vote: vote, state: 'checked', extreme: ext,
        text: crowd + (z !== null ? ' · z ' + z.toFixed(2) : '')
          + (ext ? ' — contrarian at the house |z|≥2 line' : ' — inside the |z|≥2 line')
          + ' · weekly, lagged — positioning, not timing' };
    }
    return { key: 'cot', label: 'CFTC COT', vote: 'neutral', state: 'unchecked',
      text: 'COT read absent — weekly CFTC managed-money feed has not landed' };
  }

  /* Gold risk-sentiment: crypto Fear & Greed read as a risk-off / risk-on
     proxy, contrarian at the house S2 80/20 extremes ONLY (the same line
     goldRankSetups chips +1 at, and index.html blocks fresh sets at).
     Extreme GREED (≥80) = risk-on = weighs on gold = BEAR; extreme FEAR
     (≤20) = risk-off = bid for gold = BULL. Inside the line it is CHECKED
     but never a vote — weather is not a signal at 55. */
  function legFngGold(extra){
    var fng = extra && extra.fng;
    if (fng === undefined){
      var hSf = hostS();
      fng = (hSf && hSf.fng) ? hSf.fng : null;
    }
    if (fng && isFinite(fin(fng.v))){
      var fv = +fin(fng.v);
      var vote = fv >= 80 ? 'bear' : (fv <= 20 ? 'bull' : 'neutral');
      return { key: 'fng', label: 'RISK SENTIMENT (F&G)', vote: vote, state: 'checked',
        extreme: vote !== 'neutral',
        text: fv + ' ' + (fng.c || '')
          + (vote === 'bear' ? ' — extreme greed (risk-on) weighs on gold'
            : vote === 'bull' ? ' — extreme fear (risk-off) bids gold'
            : ' — no extreme, no vote') };
    }
    return { key: 'fng', label: 'RISK SENTIMENT (F&G)', vote: 'neutral', state: 'unchecked',
      text: 'alternative.me read absent' };
  }

  /* Gold positioning: spot-vs-perp basis (goldBasisSignal verdict) carried on
     the LAST goldspotState snapshot. Crowding is a positioning VOTE, exactly
     in line with the ranker chip: longs-crowding (perp premium) fades longs =
     BEAR; shorts-crowding (perp discount) is squeeze fuel = BULL. The PAXG
     proxy verdicts (paxg-premium / paxg-discount) are a TOKEN SPREAD, not
     XAUUSDT crowding — INFO, never a vote (they would otherwise mint a fake
     positioning read). Balanced and unavailable never vote either. */
  function legGoldPosition(extra){
    var spot = extra && extra.spot;
    if (spot === undefined && gfn('goldspotState')){
      try{ spot = W.goldspotState(); }catch(eSp){ spot = null; }
    }
    var v = spot && spot.verdict;
    if (v === 'longs-crowding'){
      return { key: 'position', label: 'PAXG BASIS (POSITIONING)', vote: 'bear', state: 'checked',
        extreme: false,
        text: 'perp premium — leveraged longs crowding, fade risk for fresh longs' };
    }
    if (v === 'shorts-crowding'){
      return { key: 'position', label: 'PAXG BASIS (POSITIONING)', vote: 'bull', state: 'checked',
        extreme: false,
        text: 'perp discount — shorts crowding, squeeze fuel for a bounce' };
    }
    if (v === 'paxg-premium' || v === 'paxg-discount'){
      return { key: 'position', label: 'PAXG BASIS (POSITIONING)', vote: 'neutral', state: 'checked', info: true,
        text: (v === 'paxg-premium' ? 'PAXG premium' : 'PAXG discount')
          + ' — token spread, not XAUUSDT crowding; the proxy never votes' };
    }
    if (v === 'balanced'){
      return { key: 'position', label: 'PAXG BASIS (POSITIONING)', vote: 'neutral', state: 'checked', info: true,
        text: 'basis inside the ±0.15% band — no leveraged crowding edge' };
    }
    return { key: 'position', label: 'PAXG BASIS (POSITIONING)', vote: 'neutral', state: 'unchecked',
      text: 'spot-vs-perp read absent' };
  }

  function goldInfoLegs(macro){
    var legs = [];
    if (macro && macro.dxy && isFinite(fin(macro.dxy.value))){
      legs.push({ key: 'dxy', label: 'DXY', vote: 'neutral', state: 'checked', info: true,
        text: (+fin(macro.dxy.value)).toFixed(1) + ' · ' + (macro.dxy.trend20 || 'n/a') + ' — prior, never a vote' });
    } else {
      legs.push({ key: 'dxy', label: 'DXY', vote: 'neutral', state: 'unchecked', info: true,
        text: 'DXY read absent' });
    }
    if (macro && isFinite(fin(macro.tnx))){
      legs.push({ key: 'us10y', label: 'US 10Y', vote: 'neutral', state: 'checked', info: true,
        text: (+fin(macro.tnx)).toFixed(2) + '% · ' + (macro.tnxTrend || 'n/a') + ' — prior, never a vote' });
    } else {
      legs.push({ key: 'us10y', label: 'US 10Y', vote: 'neutral', state: 'unchecked', info: true,
        text: 'yield read absent' });
    }
    if (macro && isFinite(fin(macro.goldSilverRatio))){
      legs.push({ key: 'gsr', label: 'GOLD/SILVER', vote: 'neutral', state: 'checked', info: true,
        text: (+fin(macro.goldSilverRatio)).toFixed(1) + ' — prior, never a vote' });
    } else {
      legs.push({ key: 'gsr', label: 'GOLD/SILVER', vote: 'neutral', state: 'unchecked', info: true,
        text: 'ratio read absent' });
    }
    return legs;
  }

  /* The full leg board for one asset class. extra fields prime the read;
     every field left undefined falls back to the live state read. For an
     alt, extra.base carries the coin ('SOL') so the TERM row lookup and the
     calendar read are the coin's OWN — hgFundamentalGate threads it from
     the symbol; without it an alt's term row is honestly UNCHECKED. */
  function hgFundamentalLegs(asset, extra){
    extra = extra || {};
    asset = String(asset || '').toLowerCase();
    if (asset === 'gold'){
      var macro = extra.macro;
      if (macro === undefined && gfn('getGoldMacroCached')){
        try{ macro = W.getGoldMacroCached(); }catch(eM){ macro = null; }
      }
      /* hg-v1033: the gold board now votes on ALL of T+F+S, not just the two
         macro legs. real-rate (F) + COT (F) + risk-sentiment (S, contrarian
         F&G) + PAXG positioning (S) are the four DIRECTIONAL legs; the USD
         calendar stays the blackout; DXY / US10Y / GSR stay INFO priors.
         "2+ net against" now means any two of the four checked witnesses —
         still never one, still honest (every leg stays UNCHECKED absent its
         feed). */
      return [
        legRealRate(extra),
        legCot(extra),
        legFngGold(extra),
        legGoldPosition(extra),
        legNews(extra, 'XAU')
      ].concat(goldInfoLegs(macro));
    }
    var base = (asset === 'btc') ? 'BTC'
      : baseSym(extra.base || (asset === 'eth' ? 'ETH' : ''));
    return [
      legOnchain(asset, extra),
      legTerm(asset, extra, base || ''),
      legFng(extra),
      legRr25d(asset, extra),
      legDvol(extra),
      legDom(extra),
      legNews(extra, base || 'BTC')
    ];
  }

  /* Votes are counted among checked DIRECTIONAL legs only. unknown =
     nothing directional was measured; quiet = read but no extremes;
     mixed = tied. The blackout flag rides alongside, asset-independent. */
  function hgFundamentalRegime(asset, extra){
    var legs = hgFundamentalLegs(asset, extra);
    var bulls = 0, bears = 0, checked = 0, blackout = false;
    legs.forEach(function(l){
      if (!l) return;
      if (l.blackout) blackout = true;
      if (l.info || l.key === 'news') return;
      if (l.state !== 'checked') return;
      checked++;
      if (l.vote === 'bull') bulls++;
      else if (l.vote === 'bear') bears++;
    });
    var regime = 'unknown';
    if (checked > 0){
      if (bulls === 0 && bears === 0) regime = 'quiet';
      else if (bulls === bears) regime = 'mixed';
      else regime = bulls > bears ? 'bullish' : 'bearish';
    }
    return { asset: String(asset || ''), regime: regime, bulls: bulls, bears: bears,
             checked: checked, blackout: blackout, legs: legs };
  }

  /* The decision primitive every desk shares. sym + dir in, verdict out.
     Never throws; a dark board blocks NOTHING (unchecked is not a clear,
     and it is not a veto either). */
  function hgFundamentalGate(sym, dir, opts){
    var out = { asset: '', base: baseSym(sym), dir: dirOf(dir),
                refuse: false, demote: false, chips: [], reason: '',
                regime: null, unchecked: [] };
    try{
      if (!out.base || !out.dir) return out;
      var asset = hgFundamentalAssetOf(sym);
      out.asset = asset;
      /* Thread the coin's own base into the read so an alt's TERM leg is
         its own curve row, not a blank. Clone — never mutate the caller's
         extra bag. */
      var ex = (opts && opts.extra) || {};
      if (out.base && ex.base === undefined) ex = Object.assign({}, ex, { base: out.base });
      var regime = hgFundamentalRegime(asset, ex);
      out.regime = regime;
      if (!regime || !Array.isArray(regime.legs)){
        out.unchecked.push('fundamental');
        return out;
      }
      if (regime.blackout){
        out.refuse = true;
        out.reason = 'macro event blackout — no fresh setup forms into a red-folder print';
        out.chips.push('EVENT BLACKOUT');
        return out;
      }
      var against = out.dir === 'long' ? regime.bears : regime.bulls;
      var withDir = out.dir === 'long' ? regime.bulls : regime.bears;
      if (against - withDir >= 2){
        out.demote = true;
        out.reason = 'fundamental headwind ' + against + 'v' + withDir
          + ' — 2+ net checked votes against this direction';
        out.chips.push('FUNDAMENTAL HEADWIND ' + against + 'v' + withDir);
      } else if (withDir - against >= 2){
        out.chips.push('FUNDAMENTAL TAILWIND ' + withDir + 'v' + against);
      }
      /* Extreme chips are the card's verdict strip, so they name only the
         asset's OWN reads: F&G is market-wide weather (every coin), COT is
         gold's own book. The Deribit rr25d/DVOL snaps are the BTC complex —
         on an alt they render on the board as priors but never speak in the
         verdict strip, or a SOL card would wear BTC's positioning. */
      regime.legs.forEach(function(l){
        if (!l || l.state !== 'checked' || !l.extreme) return;
        if (l.key === 'fng') out.chips.push('F&G EXTREME');
        else if (l.key === 'rr25d' && out.asset === 'btc') out.chips.push('RR25 EXTREME');
        else if (l.key === 'dvol' && out.asset === 'btc') out.chips.push('DVOL EXTREME');
        else if (l.key === 'cot') out.chips.push('COT EXTREME');
      });
      if (!regime.checked) out.unchecked.push('fundamental');
      return out;
    }catch(e){ return out; }
  }

  /* hg-v1005: THE LEADERSHIP PASS, HOUSE-WIDE. hg-v1004 proved this loop on
     GOLD SCALP; every gold desk that crowns a lead now runs the SAME one —
     one definition, or eleven copies drift.

     For every candidate with a symbol and a direction: the gate speaks.
     2+ NET checked votes AGAINST demote the candidate (stamped FUNDAMENTAL
     HEADWIND, the reason named in gateNotes — the card paints, it can
     never lead). A tailwind or an extreme CHIPS only: the desks' tallies
     already score these same legs as points, so adding points here would
     count them twice. Skipped rows: dropped / vetoed / locked (the trade
     you are IN keeps running — gate semantics, never re-judged). A dark
     board touches nothing — unchecked is not a veto.

     PURE apart from the gate it calls: it marks what it demotes and
     returns the counts, so the scan line and the tests read the same
     object the scan acted on. The compact verdict it stores (c.fundGate)
     is what publishes with the desk's snapshot — downstream desks hold
     THIS read at THIS instant, never a recomputed-later one. */
  function hgFundamentalScanCands(cands, opts){
    var out = { demoted: 0, gated: 0 };
    if (!Array.isArray(cands)) return out;
    var scanner = (opts && opts.scanner) || 'gold';
    for (var i = 0; i < cands.length; i++){
      var c = cands[i];
      if (!c || !c.sym || !c.dir || c.dropped || c.vetoed || c.locked) continue;
      var g = null;
      try{ g = hgFundamentalGate(c.sym, c.dir, { scanner: scanner }); }catch(eG){ g = null; }
      if (!g || (g.refuse !== true && g.demote !== true && !(g.chips && g.chips.length))) continue;
      out.gated++;
      c.fundGate = { refuse: g.refuse === true, demote: g.demote === true,
                     chips: (g.chips || []).slice(), reason: g.reason || '',
                     asset: g.asset || 'gold',
                     regime: g.regime ? { bulls: g.regime.bulls, bears: g.regime.bears, checked: g.regime.checked } : null };
      if (g.demote === true){
        c.demoted = true;
        if (!Array.isArray(c.stamps)) c.stamps = [];
        if (c.stamps.indexOf('FUNDAMENTAL HEADWIND') < 0) c.stamps.push('FUNDAMENTAL HEADWIND');
        var gn = Array.isArray(c.gateNotes) ? c.gateNotes.slice() : [];
        gn.push(g.reason || 'fundamental headwind — 2+ net checked votes against this direction');
        c.gateNotes = gn;
        out.demoted++;
      }
    }
    return out;
  }

  /* The direction-free blackout probe the desks' entry vetoes share. The
     gate checks the blackout before direction, so one ask serves a whole
     desk: TRUE only when the calendar leg is CHECKED and inside a
     red-folder window. An unchecked calendar answers false — it refuses
     nothing (a dark board blocks nothing). */
  function hgFundamentalBlackout(sym){
    try{
      var g = hgFundamentalGate(sym || 'XAUUSD', 'long', { scanner: 'gold' });
      return !!(g && g.refuse === true);
    }catch(e){ return false; }
  }

  /* ---------------- display ---------------- */

  /* One .gpip chip — the established honest-display pattern. ok on a
     tailwind, bad on a headwind/blackout, neutral on extremes alone. The
     title carries the whole rule so the chip itself never has to. */
  function hgFundamentalChipHtml(gate){
    try{
      if (!gate || !gate.chips || !gate.chips.length) return '';
      var cls = gate.refuse || gate.demote ? ' bad'
        : (gate.chips.some(function(c){ return /TAILWIND/.test(c); }) ? ' ok' : '');
      var r = gate.regime;
      var title = 'fundamental stack (' + (gate.asset || '?') + '): '
        + (r ? r.bulls + ' bull / ' + r.bears + ' bear of ' + r.checked + ' directional legs checked' : 'no read')
        + '. A red-folder blackout refuses; 2+ net checked votes against demote to watch; '
        + 'one witness never flips a setup; INFO priors never vote.';
      return '<span class="gpip' + cls + '" title="' + esc(title) + '">'
        + esc(gate.chips.join(' · ')) + '</span>';
    }catch(e){ return ''; }
  }

  /* What prints where the buttons would have been. The card still prints
     and is still recorded; the buttons return when the headwind clears. */
  function hgFundamentalBlockedNoteHtml(gate){
    try{
      if (!gate) return '';
      var head = gate.refuse ? 'EVENT BLACKOUT' : 'FUNDAMENTAL HEADWIND';
      var body = gate.refuse
        ? 'a red-folder macro print is inside its blackout window — no fresh setup forms into it.'
        : (gate.reason || 'the fundamental stack stands decisively against this direction') + '.';
      return '<div class="note warn" style="margin-top:6px;font-size:11px"><b>' + head + '</b> · '
        + esc(body)
        + ' The card still prints and is still recorded; the buttons return when the fundamental read clears. '
        + 'DVOL, BTC.D, DXY, US10Y and gold/silver are priors — they never cast this vote.</div>';
    }catch(e){ return ''; }
  }

  /* The blocked trade-plan button answers the click with the reason. */
  function hgFundamentalNotify(sym, dir){
    var msg = 'WATCH ONLY — the fundamental stack blocks this direction right now.';
    try{
      var g = hgFundamentalGate(sym, dir, {});
      if (g && g.reason) msg = (g.refuse ? 'EVENT BLACKOUT — ' : 'FUNDAMENTAL HEADWIND — ') + g.reason;
    }catch(e){}
    try{
      if (typeof W.alert === 'function'){ W.alert(msg); return false; }
    }catch(e2){}
    try{ if (typeof alert === 'function') alert(msg); }catch(e3){}
    return false;
  }

  function hgFundamentalPanelHtml(regime){
    if (!regime || !Array.isArray(regime.legs)) return '';
    var assetTag = regime.asset ? ' · ' + String(regime.asset).toUpperCase() : '';
    var html = '<div class="note" style="margin-top:10px" data-hg-fundamental="1"><b>FUNDAMENTAL REGIME — '
      + esc(String(regime.regime || 'unknown').toUpperCase()) + '</b>' + esc(assetTag)
      + ' · ' + regime.bulls + ' bull / ' + regime.bears + ' bear of ' + regime.checked + ' directional checked'
      + (regime.blackout ? ' · <b>EVENT BLACKOUT — no fresh setup forms</b>' : '')
      + '<br><span class="dim">Evidence, not tickets: a 2+-vote headwind demotes to watch, a blackout refuses, one witness never flips a setup. Priors (INFO) never vote.</span></div>';
    html += '<div class="cr-ind-wrap">';
    regime.legs.forEach(function(l){
      if (!l) return;
      var mark = '—';
      if (l.blackout) mark = 'BLACKOUT';
      else if (l.state !== 'checked') mark = '—';
      else if (l.info) mark = 'INFO';
      else mark = l.vote === 'bull' ? 'BULL' : l.vote === 'bear' ? 'BEAR' : 'NEUTRAL';
      html += '<div class="kv"><span class="k">' + esc(l.label) + '</span><span class="v">'
        + esc(mark) + (l.text ? ' · ' + esc(l.text) : '') + '</span></div>';
    });
    return html + '</div>';
  }

  W.hgFundamentalBaseSym = baseSym;
  W.hgFundamentalAssetOf = hgFundamentalAssetOf;
  W.hgFundamentalLegs = hgFundamentalLegs;
  W.hgFundamentalRegime = hgFundamentalRegime;
  W.hgFundamentalGate = hgFundamentalGate;
  W.hgFundamentalScanCands = hgFundamentalScanCands;
  W.hgFundamentalBlackout = hgFundamentalBlackout;
  W.hgFundamentalChipHtml = hgFundamentalChipHtml;
  W.hgFundamentalBlockedNoteHtml = hgFundamentalBlockedNoteHtml;
  W.hgFundamentalNotify = hgFundamentalNotify;
  W.hgFundamentalPanelHtml = hgFundamentalPanelHtml;
})();
