/* HARDGATE — execute idempotency cache (QuantDinger / eliza pattern). */

const TTL_MS = 24 * 60 * 60 * 1000;
const __cache = new Map();

export function hgIdempotencyGet(key){
  if (!key) return null;
  var row = __cache.get(String(key));
  if (!row) return null;
  if (Date.now() - row.at > TTL_MS){
    __cache.delete(String(key));
    return null;
  }
  return row.response;
}

export function hgIdempotencySet(key, response){
  if (!key) return;
  __cache.set(String(key), { at: Date.now(), response: response });
  if (__cache.size > 500){
    var oldest = __cache.keys().next().value;
    __cache.delete(oldest);
  }
}

export function hgIdempotencyClear(){
  __cache.clear();
}
