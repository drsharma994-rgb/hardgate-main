W.trendmxCrownOfRows = trendmxCrownOfRows;   /* hg-v1068: the crown, pure and testable */
W.trendmxCrownState = trendmxCrownState;     /* hg-v1068: the alert seam */
W.trendmxFundState = trendmxFundState;
W.trendmxFundChipHtml = trendmxFundChipHtml;
W.trendmxChopState = trendmxChopState;      /* hg-v1057: the trend-quality witness */
W.trendmxChopChipHtml = trendmxChopChipHtml;
W.trendmxFivePillars = trendmxFivePillars;
W.trendmxFullStackSetups = trendmxFullStackSetups;
W.trendmxPillarHtml = trendmxPillarHtml;
W.trendmxPerfectState = trendmxPerfectState;       /* hg-v1022: the perfect predicate */
W.trendmxPerfectSetups = trendmxPerfectSetups;     /* hg-v1022: the perfect bag collector */
W.trendmxPerfectDeskHTML = trendmxPerfectDeskHTML; /* hg-v1022: the perfect desk renderer */
W.trendmxAtrRegime = trendmxAtrRegime;             /* hg-v1022: the volatility regime read */
W.trendmxAtrRegimeChipHtml = trendmxAtrRegimeChipHtml;
W.tmVolWitness = tmVolWitness;             /* the pure 1D-tape read, exported for the tests */
W.trendmxFundingChipHtml = trendmxFundingChipHtml;
W.trendmxRowTier = trendmxRowTier;
/* hg-v1018: the mixed board is superseded by the two class desks — the
   collector and both renderers are the desk's behavior, exported the same
   way (the tests read them rather than re-deriving behavior) */
W.trendmxLimitClasses = trendmxLimitClasses;
W.trendmxGateCleanDeskHTML = trendmxGateCleanDeskHTML;
W.trendmxConvictionDeskHTML = trendmxConvictionDeskHTML;
W.trendmxLimitDeskHTML = trendmxLimitDeskHTML;
W.trendmxSummaryLine = trendmxSummaryLine;
W.trendmxGoldenCrossSetups = trendmxGoldenCrossSetups;
W.trendmxDeathCrossSetups = trendmxDeathCrossSetups;   /* hg-v1014 */
W.tmSmcScanPass = tmSmcScanPass;   /* hg-v1014: the shared ticket cap is desk behavior — the tests read it, never re-derive it */
W.trendmxGoldenDeskHTML = trendmxGoldenDeskHTML;   /* hg-v1015 */
W.trendmxDeathDeskHTML = trendmxDeathDeskHTML;   /* hg-v1015 */
W.trendmxPaintDeskSections = trendmxPaintDeskSections;   /* hg-v1015: the desk routing is desk behavior too */
W.trendmxScan = trendmxScan;
W.trendmxWarm = trendmxWarm;
W.trendmxCrossState = function(){
  try{
    if (!__tmScanSnap) return null;
    return {
      at: __tmScanSnap.at,
      scanned: __tmScanSnap.scanned,
      goldenCross: (__tmScanSnap.goldenCross || []).map(function(s){
        return { sym: s.sym, dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1, score: s.score,
          conviction: s.conviction, tier: s.tier, freshCross: s.freshCross };
      }),
      /* hg-v1014: the mirrored half — the alert cycle reads both */
      deathCross: (__tmScanSnap.deathCross || []).map(function(s){
        return { sym: s.sym, dir: s.dir, entry: s.entry, stop: s.stop, t1: s.t1, score: s.score,
          conviction: s.conviction, tier: s.tier, freshCross: s.freshCross };
      })
    };
  }catch(e){ return null; }
};
W.trendmxState = function(){
  try{ return __tmSnap ? JSON.parse(JSON.stringify(__tmSnap)) : null; }catch(e){ return null; }
};
W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'trendmx', label: 'TREND MATRIX', mount: mountTrendMatrix, refresh: refreshTrendMatrix });
W.HG_warmups = W.HG_warmups || [];
W.HG_warmups.push({ id: 'trendmx', label: 'TREND MATRIX', run: trendmxWarm });

})();
