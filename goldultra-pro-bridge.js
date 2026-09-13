/* =========================================================================
   HARDGATE GOLD ULTRA Enhancement Bridge — Professional Tier Integration

   Hooks into goldultra.js signal generation to add:
   - Macro context filtering
   - Smart money zone detection
   - Session volume analysis
   - Multi-timeframe confluence
   - Professional-grade confidence tiers
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

/* Wrap goldultra signal with professional enhancements */
function hgEnhanceGoldSignal(signal, candles){
  if (!signal) return signal;
  try{
    /* Load all professional context */
    var macroScore = G.hgComputeMacroScore ? G.hgComputeMacroScore() : { score: 0 };
    var smartMoney = G.hgDetectSmartMoneyZones ? G.hgDetectSmartMoneyZones(candles) : { zones: [] };
    var sessionAnalysis = G.hgAnalyzeSessionVolume ? G.hgAnalyzeSessionVolume(candles) : null;
    var session = G.hgGetCurrentSessionWindow ? G.hgGetCurrentSessionWindow() : null;

    /* Assign professional confidence tier */
    var tierAssignment = G.hgAssignConfidenceTier ? G.hgAssignConfidenceTier(
      signal.confidence || 0.5,
      signal.multiTFConfluence,
      smartMoney,
      macroScore
    ) : { confidence: signal.confidence || 0.5, tier: 'STANDARD' };

    /* Apply macro gate: block longs during strong USD, block shorts during weak USD */
    var macroGate = true;
    if (macroScore.goldBias === 'BEARISH' && signal.direction === 'LONG'){
      signal.macroGate = 'BLOCKED_STRONG_USD';
      macroGate = false;
    } else if (macroScore.goldBias === 'BULLISH' && signal.direction === 'SHORT'){
      signal.macroGate = 'CAUTION_GOLD_BULLISH';
    }

    /* Apply session gate: prefer entries during high liquidity */
    var sessionGate = true;
    if (session && session.liquidity === 'LOW'){
      signal.sessionGate = 'LOW_LIQUIDITY_CAUTION';
      sessionGate = false;
    }

    /* Apply smart money gate: bonus confidence if in institutional zone */
    if (smartMoney.institutionalSetup){
      signal.smartMoneyBonus = '+15%';
      tierAssignment.confidence *= 1.15;
    }

    /* Apply session volume gate: POC rejection = entry zone confirmation */
    if (sessionAnalysis && sessionAnalysis.poc){
      signal.pocContext = 'POC at ' + sessionAnalysis.poc.poc.toFixed(2);
      if (Math.abs(signal.entryPrice - sessionAnalysis.poc.poc) < 0.5){
        signal.pocConfirmation = 'ENTRY_NEAR_POC';
        tierAssignment.confidence *= 1.12;
      }
    }

    /* Final decision: only trade if macro + session gates pass */
    signal.shouldTrade = macroGate && sessionGate && tierAssignment.confidence >= 0.65;
    signal.macroContext = macroScore;
    signal.smartMoneyContext = smartMoney;
    signal.sessionContext = session;
    signal.tierAssignment = tierAssignment;
    signal.finalConfidence = tierAssignment.confidence;

    return signal;
  }catch(e){
    return signal;
  }
}

/* Card display enhancement for professional context */
function hgGoldSignalHTML(signal){
  if (!signal) return '';
  try{
    var html = '<div class=\"pro-signal-context\">';

    /* Tier badge */
    var tierColor = signal.tierAssignment && signal.tierAssignment.tier === 'PROFESSIONAL-GRADE' ? '#2ecc71' :
                    signal.tierAssignment && signal.tierAssignment.tier === 'PROFESSIONAL' ? '#3498db' :
                    signal.tierAssignment && signal.tierAssignment.tier === 'STANDARD' ? '#f39c12' : '#e74c3c';

    html += '<div style=\"color:' + tierColor + '; font-weight:bold;\">' + 
            (signal.tierAssignment ? signal.tierAssignment.tier : 'UNKNOWN') + 
            ' (' + (signal.finalConfidence ? (signal.finalConfidence * 100).toFixed(0) : '0') + '%)</div>';

    /* Macro context */
    if (signal.macroContext){
      html += '<div style=\"font-size:0.9em; margin-top:4px;\">💹 Macro: ' + signal.macroContext.goldBias + '</div>';
    }

    /* Smart money context */
    if (signal.smartMoneyContext && signal.smartMoneyContext.count > 0){
      html += '<div style=\"font-size:0.9em;\">🐋 Smart Money: ' + signal.smartMoneyContext.count + ' zones</div>';
    }

    /* Session context */
    if (signal.sessionContext){
      html += '<div style=\"font-size:0.9em;\">📊 Session: ' + signal.sessionContext.session + ' (' + signal.sessionContext.liquidity + ')</div>';
    }

    /* POC confirmation */
    if (signal.pocConfirmation){
      html += '<div style=\"font-size:0.9em; color:#2ecc71;\">✓ ' + signal.pocConfirmation + '</div>';
    }

    /* Gates */
    if (signal.macroGate){
      html += '<div style=\"font-size:0.9em; color:#e74c3c;\">⚠ ' + signal.macroGate + '</div>';
    }
    if (signal.sessionGate){
      html += '<div style=\"font-size:0.9em; color:#e74c3c;\">⚠ ' + signal.sessionGate + '</div>';
    }

    html += '</div>';
    return html;
  }catch(e){
    return '';
  }
}

/* Load professional context on chart update */
function hgInitGoldUltraPro(){
  try{
    if (G.document && G.document.addEventListener){
      G.document.addEventListener('goldultra:signal', function(ev){
        if (ev.detail && ev.detail.signal){
          var enhanced = hgEnhanceGoldSignal(ev.detail.signal, ev.detail.candles);
          var html = hgGoldSignalHTML(enhanced);
          if (html && ev.detail.cardElement){
            var proDiv = ev.detail.cardElement.querySelector('.pro-signal-context') || G.document.createElement('div');
            proDiv.innerHTML = html;
            if (!ev.detail.cardElement.querySelector('.pro-signal-context')){
              ev.detail.cardElement.appendChild(proDiv);
            }
          }
        }
      });
    }
  }catch(e){}
}

/* Auto-initialize on load */
if (G.document){
  if (G.document.readyState === 'loading'){
    G.document.addEventListener('DOMContentLoaded', hgInitGoldUltraPro);
  } else {
    hgInitGoldUltraPro();
  }
}

G.hgEnhanceGoldSignal = hgEnhanceGoldSignal;
G.hgGoldSignalHTML = hgGoldSignalHTML;
G.hgInitGoldUltraPro = hgInitGoldUltraPro;
