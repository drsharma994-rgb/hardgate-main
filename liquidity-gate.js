/* =========================================================================
HARDGATE — liquidity-gate.js
Liquidity-to-stop ratio + book imbalance tags for TRADE PLAN / scanners.
Loads after binance.js. Never throws.
========================================================================= */
'use strict';

async function hgLiquidityToStop(sym, dir, entry, stop, positionUsd){
  try{
    if (typeof binanceDepthBook !== 'function') return null;
    var book = await binanceDepthBook(sym, 20);
    if (!book) return null;
    if (typeof window !== 'undefined' && typeof window.liquidityToStop === 'function'){
      return window.liquidityToStop(book, dir, entry, stop, positionUsd);
    }
    return null;
  }catch(e){ return null; }
}

async function hgBookImbalanceTag(sym){
  try{
    if (typeof binanceDepth !== 'function') return null;
    var d = await binanceDepth(sym, 10);
    if (!d) return null;
    if (typeof window !== 'undefined' && typeof window.bookImbalance === 'function'){
      return window.bookImbalance(d);
    }
    var ratio = d.bidUsd / d.askUsd;
    return { ratio: ratio, extreme: ratio >= 2 || ratio <= 0.5, bidUsd: d.bidUsd, askUsd: d.askUsd };
  }catch(e){ return null; }
}

var W = (typeof window !== 'undefined') ? window : globalThis;
W.hgLiquidityToStop = hgLiquidityToStop;
W.hgBookImbalanceTag = hgBookImbalanceTag;
