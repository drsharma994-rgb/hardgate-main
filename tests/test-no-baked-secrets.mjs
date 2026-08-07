/* HARDGATE — no baked Telegram tokens or secret fallbacks in tracked source.
   Run: node tests/test-no-baked-secrets.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const TG_TOKEN_RE = /\d{8,10}:[A-Za-z0-9_-]{30,}/;
const SCAN_DIRS = ['', 'scripts', 'tests', 'lib', 'api'];
const SCAN_EXT = /\.(html|js|mjs|md|json|yml|yaml)$/;
const SKIP = new Set(['node_modules', '.git', 'archive', 'exports']);

let passed = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  passed++;
  console.log('  ok —', label);
};

function walk(dir, out){
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of entries){
    if (ent.name.startsWith('.') && ent.name !== '.github') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()){
      if (SKIP.has(ent.name)) continue;
      walk(full, out);
      continue;
    }
    if (!SCAN_EXT.test(ent.name)) continue;
    if (ent.name === 'test-no-baked-secrets.mjs') continue;
    if (ent.name === 'alert-state.json') continue;
    out.push(full);
  }
}

console.log('== no Telegram bot tokens in source ==');
{
  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  let hits = 0;
  for (const f of files){
    const rel = path.relative(ROOT, f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++){
      if (TG_TOKEN_RE.test(lines[i])){
        hits++;
        throw new Error('Telegram token pattern in ' + rel + ':' + (i + 1));
      }
    }
  }
  ok(hits === 0, 'zero bot-token patterns across ' + files.length + ' files');
}

console.log('== no HG_TG_DEFAULT fallbacks ==');
{
  const mustClean = ['index.html', 'scripts/alert-check.mjs'];
  for (const f of mustClean){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(src.indexOf('HG_TG_DEFAULT') < 0, f + ' has no HG_TG_DEFAULT');
    ok(src.indexOf('HG_TG_DEFAULT_TOKEN') < 0, f + ' has no HG_TG_DEFAULT_TOKEN');
  }
}

console.log('== README security wording ==');
{
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  ok(readme.indexOf('Nothing secret is exposed') < 0,
     'README no longer claims nothing secret is exposed');
  ok(/TELEGRAM_TOKEN/.test(readme), 'README documents TELEGRAM_TOKEN env');
}

console.log('\n' + passed + ' passed');
