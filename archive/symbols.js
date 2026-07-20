// symbols.js \u2014 symbol base-name normalization (extracted from index.html, Phase 16)
// Pure function, no dependencies. searchBase(sym, ex) becomes a classic-script global.

function searchBase(sym, ex){
  return ex==='delta' ? sym.replace(/USD$/,'') : sym.replace(/^B-/,'').replace(/_USDT$/,'');
}
