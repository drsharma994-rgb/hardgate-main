/* HARDGATE — Hey / Lens social desk core (pure, vm-testable).
   Inspired by Hey (Lens Protocol) explore feed + post engagement stats.
   Never throws. */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const round = (v, dp = 2) => (Number.isFinite(v) ? Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp) : null);

const BULL_RE = /\b(bull(ish)?|moon(ing)?|pump(ing)?|rally|rallying|breakout|long\b|buy(ing)?|accumulat|ath|rip(ping)?|send(ing)? it)\b/i;
const BEAR_RE = /\b(bear(ish)?|dump(ing)?|crash(ing)?|selloff|capitulat|short\b|sell(ing)?|rekt|liquidat|bloodbath|panic)\b/i;
const BTC_RE = /\b(btc|bitcoin)\b/i;
const ETH_RE = /\b(eth|ethereum|ether)\b/i;
const GOLD_RE = /\b(gold|xau|paxg)\b/i;
const CRYPTO_RE = /\b(crypto|defi|perp|funding|macro)\b/i;

/** Extract readable text from Lens PostMetadata union. */
export function heyExtractPostText(metadata){
  try{
    if (!metadata || typeof metadata !== 'object') return '';
    var t = metadata.__typename || metadata.type || '';
    if (t === 'TextOnlyMetadata' && metadata.content) return String(metadata.content);
    if (t === 'ArticleMetadata'){
      return [metadata.title, metadata.content].filter(Boolean).join(' ');
    }
    if (t === 'LinkMetadata'){
      return [metadata.content, metadata.sharingLink].filter(Boolean).join(' ');
    }
    if (metadata.content) return String(metadata.content);
    if (metadata.title) return String(metadata.title);
    return '';
  }catch(e){ return ''; }
}

export function heyPostKeywords(text){
  var s = String(text || '');
  return {
    btc: BTC_RE.test(s),
    eth: ETH_RE.test(s),
    gold: GOLD_RE.test(s),
    crypto: CRYPTO_RE.test(s) || BTC_RE.test(s) || ETH_RE.test(s),
  };
}

/** −1..+1 lexical sentiment from post body. */
export function heyLexSentiment(text){
  var s = String(text || '');
  if (!s.trim()) return 0;
  var bull = (s.match(BULL_RE) || []).length;
  var bear = (s.match(BEAR_RE) || []).length;
  if (!bull && !bear) return 0;
  var raw = (bull - bear) / Math.max(bull + bear, 1);
  return Math.max(-1, Math.min(1, raw));
}

/** Engagement weight from Hey-style PostStats. */
export function heyEngagement(stats){
  if (!stats) return 0;
  var r = num(stats.reactions) || 0;
  var c = num(stats.comments) || 0;
  var rp = num(stats.reposts) || 0;
  return r + c * 2 + rp * 3;
}

/** Normalize a raw Lens Post node into a desk row. */
export function heyNormalizePost(post){
  if (!post || post.__typename !== 'Post') return null;
  var text = heyExtractPostText(post.metadata);
  var kw = heyPostKeywords(text);
  if (!kw.crypto && !kw.btc && !kw.eth && !kw.gold) return null;
  var sent = heyLexSentiment(text);
  var eng = heyEngagement(post.stats);
  return {
    id: post.id,
    at: post.timestamp || null,
    author: post.author && post.author.username && post.author.username.localName
      ? post.author.username.localName
      : (post.author && post.author.address ? post.author.address.slice(0, 10) : 'anon'),
    text: text.length > 280 ? text.slice(0, 277) + '…' : text,
    keywords: kw,
    sentiment: round(sent, 3),
    engagement: eng,
    reactions: num(post.stats && post.stats.reactions),
    comments: num(post.stats && post.stats.comments),
    reposts: num(post.stats && post.stats.reposts),
  };
}

/**
 * Social risk-on score −100..+100 from Lens crypto posts (Hey explore pattern).
 * Weighted by engagement × lexical sentiment.
 */
export function heySocialRiskScore(posts){
  if (!Array.isArray(posts) || !posts.length) return 0;
  var weighted = 0, weight = 0;
  for (var i = 0; i < posts.length; i++){
    var p = posts[i];
    if (!p) continue;
    var w = Math.max(1, (p.engagement || 0) + 1);
    weighted += (p.sentiment || 0) * w;
    weight += w;
  }
  if (!(weight > 0)) return 0;
  var avg = weighted / weight;
  return Math.max(-100, Math.min(100, Math.round(avg * 100)));
}

export function heySocialLabel(score){
  var s = num(score) ?? 0;
  if (s >= 35) return 'SOCIAL-BULL';
  if (s >= 12) return 'SOCIAL-LEAN-BULL';
  if (s <= -35) return 'SOCIAL-BEAR';
  if (s <= -12) return 'SOCIAL-LEAN-BEAR';
  return 'SOCIAL-MIXED';
}

export function heyFinalizeDesk(raw){
  var desk = Object.assign({ source: 'hey-lens', at: Date.now() }, raw || {});
  var posts = Array.isArray(desk.posts) ? desk.posts.slice() : [];
  posts.sort(function(a, b){ return (b.engagement || 0) - (a.engagement || 0); });
  desk.posts = posts.slice(0, 12);
  desk.postCount = posts.length;
  desk.btcPosts = posts.filter(function(p){ return p.keywords && p.keywords.btc; }).length;
  desk.ethPosts = posts.filter(function(p){ return p.keywords && p.keywords.eth; }).length;
  desk.socialRiskScore = desk.socialRiskScore != null ? desk.socialRiskScore : heySocialRiskScore(posts);
  desk.socialLabel = desk.socialLabel || heySocialLabel(desk.socialRiskScore);
  desk.totalEngagement = posts.reduce(function(s, p){ return s + (p.engagement || 0); }, 0);
  return desk;
}

/** Formation boost −12..+12 from Hey social desk read. */
export function heyDeskFormationBoost(dir, desk){
  desk = desk || {};
  var side = String(dir || 'long').toLowerCase();
  var score = num(desk.socialRiskScore) ?? 0;
  if (side === 'long'){
    if (score >= 40) return 12;
    if (score >= 20) return 7;
    if (score >= 8) return 3;
    if (score <= -40) return -12;
    if (score <= -20) return -7;
    if (score <= -8) return -3;
    return 0;
  }
  if (score <= -40) return 12;
  if (score <= -20) return 7;
  if (score <= -8) return 3;
  if (score >= 40) return -12;
  if (score >= 20) return -7;
  if (score >= 8) return -3;
  return 0;
}

/** Macro pillar hint for FQS (0..1). */
export function heyDeskMacroScore(cand, desk){
  desk = desk || cand && cand.heyDesk;
  if (!desk || desk.socialRiskScore == null) return 0.5;
  var side = String((cand && cand.side) || 'long').toLowerCase();
  var s = +desk.socialRiskScore;
  if (side === 'long') return s >= 25 ? 0.85 : s >= 10 ? 0.65 : s <= -25 ? 0.2 : s <= -10 ? 0.35 : 0.5;
  return s <= -25 ? 0.85 : s <= -10 ? 0.65 : s >= 25 ? 0.2 : s >= 10 ? 0.35 : 0.5;
}
