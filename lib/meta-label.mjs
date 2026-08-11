/* HARDGATE — MLFinLab-style meta-labeling: secondary take/skip filter on primary signals.
   Primary signal = gate pass + direction. Meta-label = "should we size this trade?"
   Uses ledger bucket stats when available; falls back to formation features. */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function fpClass(sym){
  const s = String(sym || '').toUpperCase();
  if (/(XAU|PAXG|XAUT|GOLD)/.test(s)) return 'gold';
  if (/^(BTC|WBTC)/.test(s)) return 'btc';
  if (/^(ETH|WETH)/.test(s)) return 'eth';
  return 'alt';
}

function bucketKey(plan){
  const side = String(plan.dir || plan.side || 'long').toLowerCase() === 'short' ? 'short' : 'long';
  const tier = String(plan.tier || 'na').toLowerCase();
  const poi = String(plan.poi || plan.poiKind || 'none').toLowerCase();
  return fpClass(plan.sym || plan.symbol) + '|' + side + '|' + tier + '|' + poi;
}

function ledgerBucketStats(records){
  const map = {};
  const arr = Array.isArray(records) ? records : [];
  for (let i = 0; i < arr.length; i++){
    const r = arr[i];
    if (!r || r.status !== 'settled' || !Number.isFinite(+r.r)) continue;
    const k = bucketKey(r);
    if (!map[k]) map[k] = { n: 0, sumR: 0, wins: 0 };
    map[k].n++;
    map[k].sumR += +r.r;
    if (+r.r > 0) map[k].wins++;
  }
  for (const k in map){
    const s = map[k];
    s.expR = s.n ? s.sumR / s.n : 0;
    s.winRate = s.n ? s.wins / s.n : 0;
  }
  return map;
}

function featureScore(plan, ctx){
  ctx = ctx || {};
  let s = 0.5;
  const fqs = num(plan.fqs ?? plan.formationScore);
  if (fqs !== null) s += (fqs - 50) / 100;
  const fill = num(plan.fillProb);
  if (fill !== null) s += (fill - 40) / 200;
  const rr = num(plan.rr ?? plan.rr1);
  if (rr !== null) s += rr >= 2.5 ? 0.12 : rr >= 2 ? 0.06 : rr < 1.5 ? -0.15 : 0;
  if (plan.htfAlign === true) s += 0.08;
  if (plan.htfAlign === false) s -= 0.1;
  if (plan.eventBlackout === true) s -= 0.25;
  if (ctx.newsRisk === 'high') s -= 0.2;
  else if (ctx.newsRisk === 'medium') s -= 0.08;
  if (plan.poi === 'sweep' || plan.poiKind === 'sweep-reclaim') s += 0.1;
  return clamp(s, 0, 1);
}

/** @returns {{ take:boolean, prob:number, verdict:string, confidence:string, reason:string, bucket?:object, features:object }} */
export function hgMetaLabel(plan, ctx, ledgerRecords){
  ctx = ctx || {};
  if (!plan || !plan.dir){
    return { take: false, prob: 0, verdict: 'SKIP', confidence: 'low', reason: 'no plan', features: {} };
  }
  const buckets = ledgerBucketStats(ledgerRecords);
  const key = bucketKey(plan);
  const bucket = buckets[key] || null;
  const feat = featureScore(plan, ctx);
  let prob = feat;
  let reason = 'feature score ' + Math.round(feat * 100) + '%';

  if (bucket && bucket.n >= 5){
    const hist = clamp(0.5 + bucket.expR * 0.25 + (bucket.winRate - 0.5) * 0.4, 0.05, 0.95);
    prob = clamp(feat * 0.45 + hist * 0.55, 0.05, 0.95);
    reason = 'ledger n=' + bucket.n + ' E[R]=' + bucket.expR.toFixed(2) + ' · ' + reason;
  } else if (bucket && bucket.n >= 2){
    prob = clamp(feat * 0.7 + (0.5 + bucket.expR * 0.2) * 0.3, 0.05, 0.95);
    reason = 'thin ledger n=' + bucket.n + ' · ' + reason;
  }

  const floor = num(ctx.metaFloor) ?? 0.52;
  const take = prob >= floor;
  const verdict = take ? (prob >= 0.68 ? 'TAKE' : 'TAKE-CAUTIOUS') : 'SKIP';
  const confidence = prob >= 0.72 || prob <= 0.35 ? 'high' : prob >= 0.58 || prob <= 0.48 ? 'medium' : 'low';

  return {
    take,
    prob: Math.round(prob * 1000) / 1000,
    verdict,
    confidence,
    reason,
    bucket: bucket ? { key, n: bucket.n, expR: bucket.expR, winRate: bucket.winRate } : null,
    features: { featScore: Math.round(feat * 100), fqs: num(plan.fqs ?? plan.formationScore), fill: num(plan.fillProb), rr: num(plan.rr ?? plan.rr1) },
  };
}

export const HG_META_FLOOR = 0.52;
