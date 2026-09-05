/* HARDGATE — GET /api/formation-nightly + POST /rebake. Zero deps. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_NIGHTLY_BARS } from './formation-nightly.mjs';
import { rebakeNightly } from '../scripts/nightly-formation-rebake.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FILES = [
  path.join(ROOT, 'data', 'formation-nightly.json'),
  path.join(ROOT, 'scripts', 'formation-nightly.json')
];

function sendJson(res, status, obj){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function loadNightly(){
  for (const f of FILES){
    try{
      if (!fs.existsSync(f)) continue;
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (j && j.dayUtc) return { file: f, json: j };
    }catch(e){ /* next */ }
  }
  return null;
}

function localRebake(req){
  const host = String((req && req.headers && (req.headers.host || req.headers['x-forwarded-for'])) || '');
  const ip = String((req && req.socket && req.socket.remoteAddress) || '');
  if (/^127\.0\.0\.1|::1|localhost/.test(ip) || /^localhost|^127\.0\.0\.1/.test(host)) return true;
  const key = process.env.FORMATION_NIGHTLY_KEY || process.env.BOOK_DIGEST_CRON_SECRET || '';
  const hdr = String((req && req.headers && (req.headers['x-formation-nightly-key'] || req.headers['x-book-digest-key'])) || '');
  return !!(key && hdr && hdr === key);
}

export function createFormationNightlyApi(){
  return async function formationNightlyApi(req, res){
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/api/formation-nightly' && req.method === 'GET'){
      const hit = loadNightly();
      if (!hit) return sendJson(res, 200, { dayUtc: null, note: 'no nightly book yet — baked floors apply' });
      return sendJson(res, 200, hit.json);
    }
    if (url.pathname === '/api/formation-nightly/rebake' && req.method === 'POST'){
      if (!localRebake(req)) return sendJson(res, 403, { ok: false, error: 'rebake refused' });
      try{
        const j = await rebakeNightly({ bars: DEFAULT_NIGHTLY_BARS });
        return sendJson(res, 200, { ok: true, dayUtc: j.dayUtc, asOf: j.asOf });
      }catch(e){
        return sendJson(res, 500, { ok: false, error: String((e && e.message) || e).slice(0, 160) });
      }
    }
    return sendJson(res, 404, { ok: false, error: 'not found' });
  };
}

export function formationNightlyStatus(){
  const hit = loadNightly();
  return {
    hasBook: !!(hit && hit.json && hit.json.dayUtc),
    dayUtc: hit && hit.json && hit.json.dayUtc || null,
    asOf: hit && hit.json && hit.json.asOf || null,
    file: hit ? path.basename(hit.file) : null
  };
}
