/* HARDGATE — Hey / Lens Protocol GraphQL fetch (public reads, no wallet). */
import { heyNormalizePost, heyFinalizeDesk } from './hey-lens-core.mjs';

export const HEY_LENS_API_URL = 'https://api.lens.xyz/graphql';
const TIMEOUT_MS = 18000;

const POST_FIELDS = `
  __typename
  ... on Post {
    id
    timestamp
    author {
      address
      username { localName }
    }
    metadata {
      __typename
      ... on TextOnlyMetadata { content }
      ... on ArticleMetadata { title content }
      ... on LinkMetadata { content sharingLink }
    }
    stats { reactions comments reposts }
  }
`;

const POSTS_QUERY = `query HeyPosts($request: PostsRequest!) {
  posts(request: $request) {
    items { ${POST_FIELDS} }
  }
}`;

const EXPLORE_QUERY = `query HeyExplore($request: PostsExploreRequest!) {
  mlPostsExplore(request: $request) {
    items { ${POST_FIELDS} }
  }
}`;

const ACCOUNT_QUERY = `query HeyAccount($request: AccountsRequest!) {
  accounts(request: $request) {
    items { address username { localName } }
  }
}`;

async function lensGraphql(query, variables, apiUrl){
  var url = apiUrl || process.env.HEY_LENS_API_URL || HEY_LENS_API_URL;
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, TIMEOUT_MS);
  try{
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: query, variables: variables || {} }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
    var j = await res.json();
    if (j.errors && j.errors.length){
      return { ok: false, error: j.errors.map(function(e){ return e.message; }).join('; ') };
    }
    return { ok: true, data: j.data };
  }catch(e){
    return { ok: false, error: (e && e.message) || String(e) };
  }finally{ clearTimeout(timer); }
}

export function heyLensAuthorsFromEnv(env){
  env = env || process.env;
  var raw = env.HEY_LENS_AUTHORS || env.HEY_LENS_ACCOUNTS
    || 'stani,0xAd2c0BEAdE60fb9f7ec5C87bDE8e4c126145F6E7';
  return String(raw).split(',').map(function(s){ return s.trim(); }).filter(Boolean);
}

async function resolveAuthorAddress(token, apiUrl){
  if (/^0x[a-fA-F0-9]{40}$/.test(token)) return token;
  var r = await lensGraphql(ACCOUNT_QUERY, {
    request: {
      filter: { searchBy: { localNameQuery: token.replace(/^@/, '') } },
      pageSize: 'TEN',
    },
  }, apiUrl);
  if (!r.ok || !r.data || !r.data.accounts) return null;
  var items = r.data.accounts.items || [];
  for (var i = 0; i < items.length; i++){
    var it = items[i];
    if (it && it.username && it.username.localName
        && it.username.localName.toLowerCase() === token.replace(/^@/, '').toLowerCase()){
      return it.address;
    }
  }
  return items[0] && items[0].address ? items[0].address : null;
}

function collectPosts(data, key){
  var items = data && data[key] && data[key].items;
  if (!Array.isArray(items)) return [];
  var out = [];
  for (var i = 0; i < items.length; i++){
    var row = heyNormalizePost(items[i]);
    if (row) out.push(row);
  }
  return out;
}

async function fetchExplorePosts(apiUrl){
  var r = await lensGraphql(EXPLORE_QUERY, {
    request: { pageSize: 'FIFTY' },
  }, apiUrl);
  if (!r.ok) return [];
  return collectPosts(r.data, 'mlPostsExplore');
}

async function fetchAuthorPosts(address, apiUrl){
  var r = await lensGraphql(POSTS_QUERY, {
    request: {
      filter: { authors: [address] },
      pageSize: 'TEN',
    },
  }, apiUrl);
  if (!r.ok) return [];
  return collectPosts(r.data, 'posts');
}

/** Build Hey-style crypto social desk from Lens public GraphQL. */
export async function fetchHeyLensDesk(env){
  env = env || process.env;
  var apiUrl = env.HEY_LENS_API_URL || HEY_LENS_API_URL;
  var authors = heyLensAuthorsFromEnv(env);
  var desk = { source: 'hey-lens', apiUrl: apiUrl, authors: authors, at: Date.now(), posts: [], errors: [] };

  try{
    var explore = await fetchExplorePosts(apiUrl);
    desk.posts = desk.posts.concat(explore);

    var addresses = [];
    for (var i = 0; i < authors.length; i++){
      var addr = await resolveAuthorAddress(authors[i], apiUrl);
      if (addr) addresses.push(addr);
      else desk.errors.push('author not found: ' + authors[i]);
    }
    var fetches = addresses.map(function(a){ return fetchAuthorPosts(a, apiUrl); });
    var batches = await Promise.all(fetches);
    for (var j = 0; j < batches.length; j++){
      desk.posts = desk.posts.concat(batches[j]);
    }

    var seen = {};
    desk.posts = desk.posts.filter(function(p){
      if (!p || !p.id || seen[p.id]) return false;
      seen[p.id] = true;
      return true;
    });
  }catch(e){
    desk.errors.push((e && e.message) || String(e));
  }

  return heyFinalizeDesk(desk);
}

export function heyLensConfigured(env){
  env = env || process.env;
  return !!(env.HEY_LENS_API_URL || true);
}
