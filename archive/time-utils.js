/* time-utils.js \u2014 pure time/session helpers extracted from index.html (Phase 11 modularization).
   fundingMinsAt / dayStartOf / sessionAt are pure Date math (no DOM/state).
   Loaded after idb.js and BEFORE the main inline script so they remain global. */
function fundingMinsAt(tSec){
  const d = new Date(tSec*1000);
  const secIn8h = (d.getUTCHours()%8)*3600 + d.getUTCMinutes()*60 + d.getUTCSeconds();
  return (8*3600 - secIn8h)/60;
}

function dayStartOf(tSec){
  const d = new Date(tSec*1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())/1000);
}

function sessionAt(tSec){
  const d = new Date(tSec*1000);
  const h = d.getUTCHours() + d.getUTCMinutes()/60;
  if (h>=7 && h<10) return {name:'LONDON KZ', kz:true};
  if (h>=12 && h<15) return {name:'NY KZ', kz:true};
  if (h>=0 && h<7) return {name:'ASIA (range builds)', kz:false};
  return {name:'OFF-SESSION', kz:false};
}
