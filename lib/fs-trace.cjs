/* HARDGATE — hg-v959: record which files a script REALLY reads and writes.

   Loaded with `node --require lib/fs-trace.cjs <script>`, it wraps the fs
   entry points and appends one line per access to HG_FS_TRACE.

   This exists because the alternative is parsing source for readFileSync(...)
   string literals, and this repo has corrected seven guards this session that
   passed or failed on what the source LOOKED like rather than what the code
   DID — a path built by join(), or sitting in a comment, defeats the parse in
   opposite directions. An observed access cannot be wrong about itself. */
'use strict';
const fs = require('node:fs');
const out = process.env.HG_FS_TRACE;
if (out){
  const note = (kind, p) => {
    try{
      if (typeof p !== 'string' || !p) return;
      fs.appendFileSync(out, kind + '\t' + p + '\n');
    }catch(e){}
  };
  for (const [fn, kind] of [['readFileSync', 'read'], ['writeFileSync', 'write'],
                            ['appendFileSync', 'write'], ['createReadStream', 'read'],
                            ['createWriteStream', 'write']]){
    const orig = fs[fn];
    if (typeof orig !== 'function') continue;
    fs[fn] = function(p){
      if (p !== out) note(kind, p);
      return orig.apply(this, arguments);
    };
  }
}
