// coilwatch.js \u2014 coil-watchlist persistence (extracted from index.html, Phase 15)
// Depends at call-time on: nowSec(), S (global lexical scope), idbSet() (idb.js, loaded earlier).
// COILWATCH_KEY / saveCoilWatch / loadCoilWatch become classic-script globals.

const COILWATCH_KEY = "hardgate_coilwatch_v1";
function saveCoilWatch(list){ try{ const payload={at:nowSec(), ex:S.exchange, list:list}; localStorage.setItem(COILWATCH_KEY, JSON.stringify(payload)); if(typeof idbSet==='function') idbSet(COILWATCH_KEY, payload); }catch(e){} }
function loadCoilWatch(){ try{ return JSON.parse(localStorage.getItem(COILWATCH_KEY)||"null"); }catch(e){ return null; } }
