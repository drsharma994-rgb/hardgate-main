/* HARDGATE — which gates passed on each walk row, so their tuning can be
   re-tested instead of taken on trust.

   WHY THIS EXISTS. Several gates on this desk were tuned by splitting the
   walk on the gate's own verdict. The participation gate was re-pointed on
   exactly that:

     SCALP   passed 27.7% (n=2856)   vetoed 35.2% (n=1737)   z = -5.38
     SWING   passed 27.7% (n=2330)   vetoed 30.7% (n=2039)   z = -2.19

   That is a legitimate way to find a mis-pointed gate. It is also the same
   method that produced the stop floor's "-9,768R -> -1,092R", which turned
   out to be one end of the unprovable-fill interval and to reverse sign at
   the other (see GOLD_STOP_MIN_PCT in omnigold.js). Every split of that
   shape needs re-running across the interval.

   NOT ONE OF THEM CAN BE, because the walk artifact records outcomes and
   not verdicts. The numbers above cannot be reproduced, checked, or
   re-tested from anything this repo has kept. They have to be taken on
   trust, and the one case that WAS re-tested did not survive.

   So the walk records, per row, which gates passed and which failed.

   FORM. Two hex bitmasks over a key order stored once in meta. 35 gates
   times ~10k rows as objects would multiply the artifact several times
   over; as two hex strings it costs about twenty bytes a row. The key order
   is the union of every key seen during the run, sorted, so it is stable
   for a given gate ledger and changes visibly when the ledger does.

   ABSENT IS NOT FALSE. A gate that did not run on a row — some only push
   under certain conditions — is in neither mask, exactly like a gate that
   ran and reported UNCHECKED. Both mean "this row says nothing about that
   gate", and a split must drop those rows rather than count them as
   failures. decodeGateVerdict returns null for both and callers must
   handle it; that is the whole reason it is not a boolean. */

/* Build the key order for a run: the union of keys seen, sorted so the
   order depends on the ledger and not on which row happened to come
   first. */
export function gateKeyOrder(allKeys){
  const seen = {};
  for (const k of (allKeys || [])) if (k) seen[String(k)] = 1;
  return Object.keys(seen).sort();
}

/* Encode one row's ledger into { pass, fail } hex strings.

   Bit i of `pass` is set when keyOrder[i] reported pass === true, bit i of
   `fail` when it reported pass === false. A key that is absent from the
   ledger, or reported null, sets neither — see ABSENT IS NOT FALSE. */
export function encodeGateMask(gates, keyOrder){
  const idx = {};
  for (let i = 0; i < keyOrder.length; i++) idx[keyOrder[i]] = i;
  /* BigInt because a 35-gate ledger already exceeds what bitwise operators
     give (they truncate to 32 bits), and this must not silently lose the
     gates at the end of the list. */
  let pass = 0n, fail = 0n;
  for (const g of (gates || [])){
    if (!g || !(g.key in idx)) continue;
    const bit = 1n << BigInt(idx[g.key]);
    if (g.pass === true) pass |= bit;
    else if (g.pass === false) fail |= bit;
  }
  return { pass: pass.toString(16), fail: fail.toString(16) };
}

/* One gate's verdict on one row: true, false, or null for "this row says
   nothing" — whether the gate was unchecked or never ran. */
export function decodeGateVerdict(row, key, keyOrder){
  if (!row || !keyOrder) return null;
  const i = keyOrder.indexOf(key);
  if (i < 0) return null;
  const bit = 1n << BigInt(i);
  const read = h => { try { return (BigInt('0x' + String(h || '0')) & bit) !== 0n; } catch (e) { return false; } };
  if (read(row.gatesPass)) return true;
  if (read(row.gatesFail)) return false;
  return null;
}

/* Split rows by one gate's verdict. Rows the gate said nothing about are
   returned separately rather than folded into either side — counting them
   as failures is how a gate gets re-pointed on rows it never judged. */
export function splitByGate(rows, key, keyOrder){
  const passed = [], failed = [], silent = [];
  for (const r of (rows || [])){
    const v = decodeGateVerdict(r, key, keyOrder);
    (v === true ? passed : v === false ? failed : silent).push(r);
  }
  return { passed, failed, silent };
}

/* Every gate the artifact can answer for, with how many rows each judged.
   A gate that judged almost nothing cannot be tuned on this walk however
   good its split looks, and this is what says so. */
export function gateCoverage(rows, keyOrder){
  const out = [];
  for (const key of (keyOrder || [])){
    const s = splitByGate(rows, key, keyOrder);
    out.push({ key, passed: s.passed.length, failed: s.failed.length, silent: s.silent.length });
  }
  return out.sort((a, b) => (b.passed + b.failed) - (a.passed + a.failed));
}
