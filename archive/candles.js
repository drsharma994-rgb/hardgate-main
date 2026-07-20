/* candles.js \u2014 Candle-access layer: forming-bar guard, rate-limit bucket, cached getCandles.
 * Extracted from index.html (Phase 14). Loads after indicators.js (uses makeTokenBucket at
 * load time to build apiBucket). Becomes globals via classic-script scope: dropForming,
 * apiBucket, getCandles. Call-time deps resolved from inline blocks: nowSec, S,
 * candlesDelta, candlesCdcx.
 */
/* Drop the still-forming bar: gates must only ever see CLOSED candles.
   Evaluating a partial bar repaints \u2014 a cascade that exists at 14:37 can
   vanish by 16:00. Candle t = bar open time, so forming iff now-t < duration. */
function dropForming(rows, res){
  const sec = {'15m':900,'1h':3600,'2h':7200,'4h':14400,'1d':86400}[res];
  if (!rows.length || !sec) return rows;
  return (nowSec() - rows[rows.length-1].t < sec) ? rows.slice(0,-1) : rows;
}
const apiBucket = makeTokenBucket(8, 6); // Phase 7: burst smoothing for candle fetches

async function getCandles(sym, res, count){
  const key = `${S.exchange}|${sym}|${res}`;
  const hit = S.candleCache[key];
  const need = Math.max(count, 320); if (hit && (nowSec()-hit.at) < 60 && hit.rows.length >= count) return hit.rows.slice(-count);
  const __w = apiBucket.take(); if (__w>0) await new Promise(r=>setTimeout(r, Math.min(__w, 800)));
  let rows = S.exchange==='delta' ? await candlesDelta(sym,res,need) : await candlesCdcx(sym,res,need);
  rows = dropForming(rows, res);
  S.candleCache[key] = {rows, at: nowSec()}; rows = rows.slice(-count);
  return rows;
}
