/* HARDGATE — extract every INLINE <script> block (no src=) from index.html
   and syntax-check each with `node --check`. Catches edit-time syntax damage
   in the self-contained app without needing a browser.
   Run: node tests/extract-inline.mjs */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const htmlPath = new URL('../index.html', import.meta.url);
const html = fs.readFileSync(htmlPath, 'utf8');

// A script tag with a src attribute is skipped; everything else is inline.
const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-inline-'));
let i = 0, fail = 0, m;
while ((m = re.exec(html)) !== null){
  i++;
  const body = m[1];
  if (!body.trim()){ console.log(`block ${i}: (empty) OK`); continue; }
  const f = path.join(dir, `block${i}.js`);
  fs.writeFileSync(f, body);
  try{
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log(`block ${i}: OK (${body.length} chars)`);
  }catch(e){
    fail++;
    console.log(`block ${i}: SYNTAX ERROR`);
    console.log(String(e.stderr || e.message).split('\n').slice(0, 12).join('\n'));
  }
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(fail ? `\nFAILED: ${fail}/${i} inline block(s) have syntax errors` : `\nALL ${i} INLINE BLOCKS OK`);
process.exit(fail ? 1 : 0);
