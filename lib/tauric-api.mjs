/* HARDGATE — /api/tauric/* : the seam to TradingAgents (TauricResearch).

   WHY A SERVER ROUTE AT ALL

   TradingAgents is Python and its agents are LLM-driven; HARDGATE is a
   browser app of classic scripts. Nothing in the tab can import a Python
   module, so the pipeline runs here, out of process, and the tab talks JSON
   to it. scripts/tauric-bridge.py is the only thing on the far side and it
   contracts to print exactly one JSON object.

   WHERE THE INSTALL IS

   Resolved, never assumed, in this order:

     TAURIC_PYTHON   an explicit interpreter path — wins over everything
     TAURIC_HOME     a checkout, whose .venv/bin/python is used
     the siblings    ../TradingAgents next to this repo, then ~/TradingAgents

   A missing install is reported as `install`, distinct from a missing key
   and from a blocked vendor. They need different things from the reader —
   clone it, add a key, unblock a host — and collapsing them into one "error"
   is how a tab ends up saying "failed" to somebody who only needed to paste
   an API key.

   RUNS ARE NOT FREE. A full pipeline is four analysts, a two-sided research
   debate, a trader and a three-way risk debate — dozens of LLM calls against
   the caller's own key and quota. So: POST only (a GET that spends money is
   a trap for a prefetcher), one at a time, and a hard timeout. Preflight is
   GET because it spends nothing and constructs no graph. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)));
const BRIDGE = path.join(ROOT, 'scripts', 'tauric-bridge.py');

/* A pipeline run is minutes, not seconds: every agent is a round trip and
   the debates are several. Preflight is a couple of seconds at most. */
const RUN_TIMEOUT_MS = 15 * 60 * 1000;
const PREFLIGHT_TIMEOUT_MS = 90 * 1000;
/* stdout is one JSON object; anything approaching this is a runaway, and
   buffering it unbounded would trade a broken run for a dead server. */
const MAX_STDOUT = 8 * 1024 * 1024;

let __running = null;   /* the single in-flight run, or null */

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

function readJsonBody(req){
  return new Promise(function(resolve){
    const chunks = [];
    let size = 0;
    req.on('data', function(c){
      size += c.length;
      if (size > 64 * 1024) return;      /* a request body this big is not ours */
      chunks.push(c);
    });
    req.on('end', function(){
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e){ resolve(null); }
    });
    req.on('error', function(){ resolve(null); });
  });
}

/* The interpreter that has tradingagents importable, and how we found it —
   the tab prints the `how`, so a wrong venv is diagnosable from the page
   rather than only from a shell. */
export function resolveTauricPython(env){
  const e = env || process.env;
  const tried = [];

  const explicit = (e.TAURIC_PYTHON || '').trim();
  if (explicit){
    tried.push(explicit);
    if (fs.existsSync(explicit)){
      return { python: explicit, home: homeOfInterpreter(explicit), how: 'TAURIC_PYTHON', tried };
    }
  }

  const homes = [];
  const envHome = (e.TAURIC_HOME || '').trim();
  if (envHome) homes.push([envHome, 'TAURIC_HOME']);
  homes.push([path.join(ROOT, '..', 'TradingAgents'), 'sibling of this repo']);
  homes.push([path.join(os.homedir(), 'TradingAgents'), 'home directory']);

  for (const [home, how] of homes){
    for (const rel of [['.venv', 'bin', 'python'], ['.venv', 'Scripts', 'python.exe'], ['venv', 'bin', 'python']]){
      const p = path.join(home, ...rel);
      tried.push(p);
      if (fs.existsSync(p)) return { python: p, home: home, how: how, tried };
    }
  }
  return { python: null, home: null, how: null, tried };
}

/* The checkout an interpreter belongs to: <home>/.venv/bin/python -> <home>.
   Only used for an explicitly-set TAURIC_PYTHON, where we were given the
   interpreter and not the project. Returns null rather than a guess when the
   path is not shaped like a venv inside a checkout. */
function homeOfInterpreter(p){
  try {
    const parts = path.resolve(p).split(path.sep);
    for (let i = parts.length - 1; i >= 0; i--){
      if (parts[i] === '.venv' || parts[i] === 'venv'){
        return parts.slice(0, i).join(path.sep) || null;
      }
    }
  } catch (e){}
  return null;
}

/* Spawn the bridge and parse its one JSON object.

   stdout and stderr are kept apart on purpose. The bridge contracts that
   stdout is JSON and nothing else, so a library that prints a warning (and
   several of them do) cannot corrupt the payload — the warning lands in
   stderr and is handed back as `stderr_tail` for diagnosis. */
function runBridge(args, timeoutMs, env){
  return new Promise(function(resolve){
    const found = resolveTauricPython(env);
    if (!found.python){
      return resolve({ ok: false, stage: 'spawn', blocked: 'install',
        error: 'no TradingAgents interpreter found',
        hint: 'clone TauricResearch/TradingAgents and create its .venv, or set TAURIC_PYTHON',
        tried: found.tried });
    }
    if (!fs.existsSync(BRIDGE)){
      return resolve({ ok: false, stage: 'spawn', blocked: 'install',
        error: 'bridge script missing', path: BRIDGE });
    }

    /* RUN FROM THE TRADINGAGENTS CHECKOUT, NOT FROM THIS REPO.

       tradingagents/__init__.py loads its .env with find_dotenv(usecwd=True),
       which walks UP FROM THE CWD. Spawned with cwd = this repo, that walk
       never reaches the checkout, so a key pasted exactly where the
       TradingAgents README says to put it was invisible and the tab reported
       'no LLM key' to somebody who had just set one. Verified: the same
       preflight reports keys.ok false from here and true from there.

       Its own directory is also the right home for the caches and results
       it writes, so this fixes where those land too. Falls back to this repo
       only when the checkout could not be located, which is the case that
       already reports `install` and never gets this far. */
    const cwd = (found.home && fs.existsSync(found.home)) ? found.home : ROOT;

    let child;
    try {
      child = spawn(found.python, [BRIDGE].concat(args), {
        cwd: cwd,
        env: Object.assign({}, env || process.env, { PYTHONUNBUFFERED: '1' }),
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (e){
      return resolve({ ok: false, stage: 'spawn', blocked: 'install',
        error: String((e && e.message) || e), python: found.python });
    }

    let out = '', err = '', done = false, killed = false;
    const finish = function(obj){
      if (done) return;
      done = true;
      clearTimeout(timer);
      obj.python = found.python;
      obj.resolved_by = found.how;
      /* the tab prints this: 'no key' is a very different message once the
         reader can see WHICH directory was searched for the .env */
      obj.cwd = cwd;
      if (err) obj.stderr_tail = err.slice(-2000);
      resolve(obj);
    };

    const timer = setTimeout(function(){
      killed = true;
      try { child.kill('SIGKILL'); } catch (e){}
      finish({ ok: false, stage: 'spawn', blocked: 'timeout',
        error: 'the bridge exceeded ' + Math.round(timeoutMs / 1000) + 's and was stopped' });
    }, timeoutMs);

    child.stdout.on('data', function(c){
      if (out.length < MAX_STDOUT) out += c.toString('utf8');
    });
    child.stderr.on('data', function(c){
      err += c.toString('utf8');
      if (err.length > 64 * 1024) err = err.slice(-32 * 1024);
    });
    child.on('error', function(e){
      finish({ ok: false, stage: 'spawn', blocked: 'install',
        error: String((e && e.message) || e) });
    });
    child.on('close', function(code){
      if (killed) return;
      const trimmed = out.trim();
      if (!trimmed){
        return finish({ ok: false, stage: 'spawn', blocked: 'bridge',
          error: 'the bridge printed nothing on stdout', exit_code: code });
      }
      /* last non-empty line: the contract is one object, and taking the last
         line survives a stray print without silently accepting two payloads */
      const lines = trimmed.split('\n').filter(function(s){ return s.trim(); });
      try {
        const obj = JSON.parse(lines[lines.length - 1]);
        obj.exit_code = code;
        finish(obj);
      } catch (e){
        finish({ ok: false, stage: 'spawn', blocked: 'bridge',
          error: 'the bridge did not print JSON', exit_code: code,
          stdout_tail: trimmed.slice(-1000) });
      }
    });
  });
}

/* XAUUSD is the point of the tab, but the bridge takes any symbol its
   vendor table knows, so the parameter is honoured within a whitelist
   shape rather than interpolated raw into an argv. */
function cleanSymbol(s){
  const v = String(s == null ? '' : s).trim().toUpperCase();
  return /^[A-Z0-9.=^-]{1,16}$/.test(v) ? v : null;
}
function cleanDate(s){
  const v = String(s == null ? '' : s).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
const ANALYSTS = ['market', 'social', 'news', 'fundamentals'];
function cleanAnalysts(a){
  if (!Array.isArray(a) || !a.length) return ANALYSTS.slice();
  const out = a.map(function(x){ return String(x || '').trim().toLowerCase(); })
               .filter(function(x){ return ANALYSTS.indexOf(x) >= 0; });
  /* an empty selection is a caller error, not an instruction to run nothing */
  return out.length ? out : ANALYSTS.slice();
}

export function createTauricApi(){
  return async function tauricHandler(req, res){
    try {
      const u = new URL(req.url || '/', 'http://localhost');
      const method = (req.method || 'GET').toUpperCase();

      if (u.pathname === '/api/tauric/preflight' && method === 'GET'){
        const sym = cleanSymbol(u.searchParams.get('symbol')) || 'XAUUSD';
        const out = await runBridge(['--preflight', '--symbol', sym], PREFLIGHT_TIMEOUT_MS);
        return sendJson(res, 200, out);
      }

      if (u.pathname === '/api/tauric/run'){
        if (method !== 'POST'){
          /* a GET that fires dozens of paid LLM calls is a trap for any
             prefetcher, link scanner or reload */
          return sendJson(res, 405, { ok: false, blocked: 'method',
            error: 'a pipeline run costs LLM calls — POST only' });
        }
        if (__running){
          return sendJson(res, 429, { ok: false, blocked: 'busy',
            error: 'a run is already in flight', started: __running });
        }
        const body = (await readJsonBody(req)) || {};
        const sym = cleanSymbol(body.symbol) || 'XAUUSD';
        const day = cleanDate(body.date) || new Date().toISOString().slice(0, 10);
        const analysts = cleanAnalysts(body.analysts);
        const depth = Math.max(1, Math.min(3, parseInt(body.depth, 10) || 1));

        __running = new Date().toISOString();
        const t0 = Date.now();
        try {
          const out = await runBridge(
            ['--run', '--symbol', sym, '--date', day,
             '--analysts', analysts.join(','), '--depth', String(depth)],
            RUN_TIMEOUT_MS);
          out.elapsed_ms = Date.now() - t0;
          return sendJson(res, 200, out);
        } finally {
          __running = null;
        }
      }

      return sendJson(res, 404, { ok: false, error: 'unknown tauric route' });
    } catch (e){
      return sendJson(res, 500, { ok: false, blocked: 'server',
        error: String((e && e.message) || e) });
    }
  };
}
