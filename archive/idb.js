/* idb.js \u2014 IndexedDB durability layer extracted from index.html (Phase 10 modularization).
   localStorage remains the synchronous source of truth; IndexedDB is a durable mirror.
   Loaded after store.js and BEFORE the main inline script so idbOpen/idbSet/idbGet are global. */
const IDB_DB='hardgate', IDB_STORE='kv';
function idbOpen(){ return new Promise(function(res,rej){ try{ const rq=indexedDB.open(IDB_DB,1); rq.onupgradeneeded=function(){ rq.result.createObjectStore(IDB_STORE); }; rq.onsuccess=function(){ res(rq.result); }; rq.onerror=function(){ rej(rq.error); }; }catch(e){ rej(e); } }); }
async function idbSet(key,val){ try{ const db=await idbOpen(); await new Promise(function(res,rej){ const tx=db.transaction(IDB_STORE,'readwrite'); tx.objectStore(IDB_STORE).put(val,key); tx.oncomplete=res; tx.onerror=function(){ rej(tx.error); }; }); }catch(e){} }
async function idbGet(key){ try{ const db=await idbOpen(); return await new Promise(function(res,rej){ const tx=db.transaction(IDB_STORE,'readonly'); const rq=tx.objectStore(IDB_STORE).get(key); rq.onsuccess=function(){ res(rq.result); }; rq.onerror=function(){ rej(rq.error); }; }); }catch(e){ return undefined; } }
