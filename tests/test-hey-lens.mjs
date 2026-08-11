/* HARDGATE — Hey / Lens social desk tests (offline core + wiring). */
import {
  heyExtractPostText,
  heyLexSentiment,
  heyEngagement,
  heyNormalizePost,
  heySocialRiskScore,
  heyDeskFormationBoost,
  heyFinalizeDesk,
} from '../lib/hey-lens-core.mjs';
import { heyLensAuthorsFromEnv } from '../lib/hey-lens-fetch.mjs';
import { heyLensCapabilities } from '../lib/hey-lens-api.mjs';
import { formationQuality } from '../lib/formation-quality.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

console.log('== hey lens core ==');
{
  var text = heyExtractPostText({ __typename: 'TextOnlyMetadata', content: 'BTC bullish breakout moon' });
  ok(/BTC/.test(text), 'extract text metadata');
  ok(heyLexSentiment('bullish moon pump') > 0, 'bullish lex sentiment');
  ok(heyLexSentiment('bearish crash dump') < 0, 'bearish lex sentiment');
  ok(heyEngagement({ reactions: 10, comments: 2, reposts: 1 }) === 17, 'engagement weight');
}

console.log('== hey normalize + desk ==');
{
  var post = heyNormalizePost({
    __typename: 'Post',
    id: '1',
    timestamp: '2026-01-01T00:00:00Z',
    author: { username: { localName: 'stani' } },
    metadata: { __typename: 'TextOnlyMetadata', content: 'Bitcoin rally looks strong' },
    stats: { reactions: 50, comments: 3, reposts: 2 },
  });
  ok(post && post.keywords.btc && post.sentiment > 0, 'normalize crypto post');
  var desk = heyFinalizeDesk({ posts: [post] });
  ok(desk.socialRiskScore > 0 && desk.socialLabel, 'finalize social desk');
  ok(heyDeskFormationBoost('long', desk) >= 3, 'long boost on bullish desk');
}

console.log('== formation macro ==');
{
  var q = formationQuality({ side: 'long', socialRiskScore: 40 });
  ok(q.pillars.macro >= 60, 'social risk improves macro pillar for long');
}

console.log('== api + shell wiring ==');
{
  var caps = heyLensCapabilities();
  ok(caps.ok && caps.deskRoute === '/api/hey/desk', 'capabilities route');
  ok(heyLensAuthorsFromEnv({ HEY_LENS_AUTHORS: 'stani' }).length === 1, 'authors env');
  var srv = fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8');
  ok(/createHeyLensApi/.test(srv) && /\/api\/hey\//.test(srv), 'server mounts hey api');
  var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(html.indexOf('hey-desk.js') >= 0 && html.indexOf('hey-lens.js') >= 0, 'index loads hey scripts');
  ok(/tabs:\['basis','search','tradeos','hey'/.test(html), 'hey tab in TOOLS nav');
  var sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v238/.test(sw), 'cache hg-v238');
}

console.log('\n' + pass + ' assertions passed');
