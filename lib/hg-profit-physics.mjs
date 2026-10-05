/* HARDGATE — lib/hg-profit-physics.mjs
   THE SHARED TICKET-PHYSICS CHECK (hg-v1074).

   One pure module every ticket-forming desk can ask the same question:
   do this plan's NUMBERS describe a tradeable ticket, before any
   evidence, confluence or conviction is layered on top? Physics only —
   levels on the right side, R:R at or above the desk's own floor,
   funding not crowded against the direction. It can never mint a setup
   (that is the desks' job) and never re-ranks anything: it only says
   whether the geometry of the plan is sound, with a named veto for
   every way it is not.

   Contract (pinned by tests/test-profit-physics.mjs):
     hgProfitPhysics({ scanner, dir, entry, stop, t1, funding }) ->
       { ok: boolean,        false when any veto fired
         vetoes: string[],   every failed check, named plainly
         rr: number|null,    the plan's reward:risk when computable
         label: string }     'context' | 'ticket' | 'veto'

   The honest third state: a CONTEXT call (no levels — scanner: 'regime'
   and friends) has no physics to check and returns ok with no vetoes.
   A broken feed (|funding| out of sane range) is a veto, not a read —
   this is ticket physics, so a feed that cannot be trusted cannot
   underwrite a ticket.

   The thresholds are the house conventions, restated once here so the
   module stays dependency-free (pure ESM, no window):
     R:R floors  — swing 2.0 · scalp 1.2 · edge 2.0 · best 2.0 (else 1.5)
     funding     — 0.04%/interval against the direction is crowded
                   (the same threshold fundingGateDirectional gates on);
                   |funding| > 0.30 is a broken feed
   */
export function hgProfitPhysics(plan){
  const vetoes = [];
  const p = plan || {};
  const scanner = String(p.scanner || '').toLowerCase();
  const dir = String(p.dir || '').toLowerCase();
  const entry = Number(p.entry);
  const stop = Number(p.stop);
  const t1 = Number(p.t1);

  const hasLevels = [entry, stop, t1].every((v) => Number.isFinite(v));
  if (!hasLevels){
    /* context desk — nothing to check, nothing to veto */
    return { ok: true, vetoes, rr: null, label: 'context' };
  }
  if (!(dir === 'long' || dir === 'short')){
    vetoes.push('no direction on a levelled plan');
    return { ok: false, vetoes, rr: null, label: 'veto' };
  }

  /* --- directional sanity: the stop and the target must sit on their
     own sides of the entry. A long whose stop is above the entry (or
     whose target is below it) is not a plan, it is a typo. --- */
  if (dir === 'long'){
    if (!(stop < entry)) vetoes.push('stop on the wrong side of the entry for a long');
    if (!(t1 > entry)) vetoes.push('target on the wrong side of the entry for a long');
  } else {
    if (!(stop > entry)) vetoes.push('stop on the wrong side of the entry for a short');
    if (!(t1 < entry)) vetoes.push('target on the wrong side of the entry for a short');
  }

  /* --- R:R against the desk's own floor --- */
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(t1 - entry);
  const rr = risk > 0 ? reward / risk : NaN;
  const FLOORS = { swing: 2.0, scalp: 1.2, edge: 2.0, best: 2.0 };
  const floor = FLOORS[scanner] !== undefined ? FLOORS[scanner] : 1.5;
  if (!(rr > 0) || Number.isNaN(rr)){
    vetoes.push('R:R unreadable — zero-width risk window');
  } else if (rr < floor){
    vetoes.push('R:R ' + rr.toFixed(2) + ' below the ' + (scanner || 'default')
      + ' floor ' + floor.toFixed(2) + ' — noise, not a ticket');
  }

  /* --- funding crowding, when the caller carries a print --- */
  const funding = p.funding === undefined || p.funding === null ? null : Number(p.funding);
  if (funding !== null && Number.isFinite(funding)){
    if (Math.abs(funding) > 0.30){
      vetoes.push('funding feed out of range (' + funding.toFixed(4) + '%/interval) — not tradeable');
    } else if (dir === 'long' && funding >= 0.04){
      vetoes.push('funding crowded against the long (' + funding.toFixed(4) + '%/interval)');
    } else if (dir === 'short' && funding <= -0.04){
      vetoes.push('funding crowded against the short (' + funding.toFixed(4) + '%/interval)');
    }
  }

  return {
    ok: vetoes.length === 0,
    vetoes,
    rr: Number.isNaN(rr) ? null : rr,
    label: vetoes.length === 0 ? 'ticket' : 'veto'
  };
}
