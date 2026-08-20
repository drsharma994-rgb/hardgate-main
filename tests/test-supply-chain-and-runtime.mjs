/* HARDGATE — an audit of what could be updated, and the three things it found.

   1. TWO THIRD-PARTY SCRIPTS, NO INTEGRITY CHECK, ONE FLOATING VERSION.

      index.html loaded lightweight-charts from unpkg and @emailjs/browser
      from jsdelivr, and carried no integrity= attribute anywhere. A hijacked
      CDN path would have executed arbitrary JS in the page that renders trade
      decisions and holds the forward log. Worse, @emailjs/browser was pinned
      to a FLOATING MAJOR (@4), which resolves to the newest 4.x at request
      time — so the code this terminal ran could change without a deploy.

      They were also the only two things the service worker did not precache,
      so a 126-file offline shell broke on charts.

      Both are vendored under ./vendor at exact versions and precached. The
      EmailJS copy is byte-identical to what @4 served, so the pin changed
      nothing today and prevents the drift tomorrow. script-src no longer
      permits any third-party host, so a future edit that re-adds a CDN tag
      fails loudly instead of silently working.

   2. THE CSP BLOCKED THE APP'S OWN EMAIL ALERTS.

      connect-src listed fifteen data hosts and not api.emailjs.com, which is
      where EmailJS posts. Every email alert was being blocked by this
      application's own header. The calls are wrapped in try/catch that
      records to __hgLastEmail, so it failed quietly rather than throwing.

   3. FOUR HIGH-SEVERITY ADVISORIES ON THE DEPLOYED DAEMON, AND THREE
      DIFFERENT PUPPETEER VERSIONS.

      extract-zip symlink path traversal (GHSA-jmr9-qjv8-65gv) reached through
      puppeteer -> @puppeteer/browsers. The workflow installed puppeteer@23,
      package.json declared ^24.0.0, and the fix was in 25. It is an
      optionalDependency, but npm ci installs those and the daemon's build
      explicitly runs `npx puppeteer browsers install chrome`, so it was on
      the live service. npm audit now reports 0.

      engines said only ">=18", so Render was free to pick any future major
      and change the runtime under a deployed desk without a commit.

   Run: node tests/test-supply-chain-and-runtime.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const HTML = read('index.html');
const SW = read('sw.js');
const SRV = read('scripts/server.mjs');
const VJS = read('vercel.json');
const PKG = JSON.parse(read('package.json'));
const RENDER = read('render.yaml');
const ROUTE = read('omniroute.js');

console.log('== 1. no third-party script executes in this page ==');
{
  ok(!/unpkg\.com/.test(HTML), 'index.html loads nothing from unpkg');
  ok(!/cdn\.jsdelivr\.net/.test(HTML), 'nor from jsdelivr');
  ok(!/<script[^>]+src="https?:\/\//.test(HTML), 'no <script src> points off-origin at all');
  ok(/\.\/vendor\/lightweight-charts-4\.2\.0\.js/.test(HTML), 'charts are served from ./vendor');
  ok(/\.\/vendor\/emailjs-browser-4\.4\.1\.js/.test(HTML), 'EmailJS too, at an EXACT version');
  ok(!/@emailjs\/browser@4["'\/]/.test(HTML), 'the floating @4 major is gone');
  /* Order still matters: EmailJS initialises before the chart script. */
  ok(HTML.indexOf('emailjs-browser-4.4.1') < HTML.indexOf('lightweight-charts-4.2.0'),
     'and the load order is unchanged');
}

console.log('\n== the vendored files are real builds that register the right globals ==');
{
  const files = ['vendor/lightweight-charts-4.2.0.js', 'vendor/emailjs-browser-4.4.1.js'];
  for (const f of files){
    ok(fs.existsSync(path.join(ROOT, f)), f + ' exists');
    ok(fs.statSync(path.join(ROOT, f)).size > 3000, f + ' is a build, not a stub ('
      + fs.statSync(path.join(ROOT, f)).size + ' bytes)');
    ok(SW.includes("'./" + f + "'"), f + ' is precached — the offline shell now covers charts');
  }
  /* Run them in a browser-shaped global scope and check the exact API the app
     calls: LightweightCharts.createChart, LineStyle, emailjs.send, emailjs.init. */
  const el = () => ({ style:{}, dataset:{}, appendChild(){}, removeChild(){}, setAttribute(){},
    getAttribute:()=>null, addEventListener(){}, removeEventListener(){}, remove(){}, insertBefore(){},
    querySelector:()=>null, querySelectorAll:()=>[], getContext:()=>({ fillRect(){}, clearRect(){},
    measureText:()=>({width:10}) }), getBoundingClientRect:()=>({width:100,height:100,top:0,left:0,right:100,bottom:100}),
    classList:{ add(){}, remove(){}, contains:()=>false } });
  const ctx = { console:{log(){},warn(){},error(){}}, Math, Date, JSON, Object, Array, String, Number,
    Boolean, RegExp, Error, TypeError, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout,
    setInterval, clearInterval, Promise, Map, Set, WeakMap, WeakSet, Symbol, Proxy, Reflect,
    encodeURIComponent, decodeURIComponent, fetch: () => Promise.reject(new Error('offline')),
    navigator:{userAgent:'node'}, localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    devicePixelRatio:1, requestAnimationFrame:(f)=>setTimeout(f,0) };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  ctx.document = { createElement: el, createTextNode: el, createDocumentFragment: el,
    body: el(), head: el(), documentElement: el(), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], addEventListener(){}, removeEventListener(){} };
  vm.createContext(ctx);
  for (const f of files){
    let threw = null;
    try { vm.runInContext(read(f), ctx, { filename: f }); } catch (e){ threw = e; }
    ok(!threw, f + ' runs without throwing' + (threw ? ' — ' + threw.message : ''));
  }
  ok(ctx.LightweightCharts && typeof ctx.LightweightCharts.createChart === 'function',
     'window.LightweightCharts.createChart is the function index.html calls');
  ok(ctx.LightweightCharts && ctx.LightweightCharts.LineStyle,
     'and LineStyle, which the chart builder reads');
  ok(ctx.emailjs && typeof ctx.emailjs.send === 'function', 'window.emailjs.send exists');
  ok(ctx.emailjs && typeof ctx.emailjs.init === 'function', 'and emailjs.init, called at startup');
}

console.log('\n== 2. the CSP permits what the app does, and nothing more ==');
{
  for (const [n, src] of [['scripts/server.mjs', SRV], ['vercel.json', VJS]]){
    const csp = /script-src[^;"]*/.exec(src);
    ok(!!csp, n + ' declares a script-src');
    ok(!/unpkg|jsdelivr/.test(csp[0]), n + ' script-src allows no CDN host: ' + csp[0].trim());
    ok(/'self'/.test(csp[0]), 'and still allows same-origin scripts');
    /* THE DEFECT: EmailJS posts to api.emailjs.com and connect-src omitted it. */
    ok(/connect-src[^;"]*https:\/\/api\.emailjs\.com/.test(src),
       n + ' connect-src permits api.emailjs.com, which every email alert needs');
    ok(/object-src 'none'/.test(src) && /frame-ancestors 'none'/.test(src),
       n + ' keeps the rest of the policy intact');
  }
  /* The endpoint the vendored library actually posts to, read from the file
     itself rather than assumed — if EmailJS ever moves it, this catches it. */
  ok(/api\.emailjs\.com/.test(read('vendor/emailjs-browser-4.4.1.js')),
     'and that host is the one the vendored EmailJS build really uses');
}

console.log('\n== 3. one puppeteer version, and a pinned runtime ==');
{
  const pup = (PKG.optionalDependencies || {}).puppeteer || (PKG.dependencies || {}).puppeteer;
  ok(/\^?2[5-9]|\^?[3-9]\d/.test(pup), 'package.json is on puppeteer 25 or newer (' + pup + ')');
  const wf = read('.github/workflows/alert-notify.yml');
  const runs = wf.split('\n').filter(l => /^\s+run:/.test(l)).join('\n');
  /* Bare `npm install puppeteer@25` reported "added 106 packages" on GHA then
     `import('puppeteer')` threw ERR_MODULE_NOT_FOUND. puppeteer is an
     optionalDependency — install from the lockfile with optional deps on,
     then install Chrome the same way the Render daemon does. */
  ok(/\bnpm ci\b/.test(runs), 'the workflow installs from the lockfile (npm ci)');
  ok(/include=optional/.test(runs), 'and includes optional deps so puppeteer is actually on disk');
  ok(/puppeteer browsers install chrome/.test(runs), 'then installs Chrome for the headless sweep');
  ok(!/npm install puppeteer@23/.test(runs), 'does not pin the old puppeteer@23');
  ok(!/npm install puppeteer@25/.test(runs),
     'does not use the bare `npm install puppeteer@25` that left the package unresolvable');
  ok(!/">=18"/.test(JSON.stringify(PKG.engines)), 'engines no longer accepts any future major');
  ok(/<\s*\d/.test(PKG.engines.node), 'it has an upper bound (' + PKG.engines.node + ')');
  const pins = [...RENDER.matchAll(/key: NODE_VERSION\s*\r?\n\s*value: "([^"]+)"/g)].map(x => x[1]);
  ok(pins.length === 2, 'both Render services pin NODE_VERSION (' + pins.length + ')');
  ok(pins[0] === pins[1], 'to the same version (' + pins.join(', ') + ')');
  const major = Number(String(pins[0]).split('.')[0]);
  const range = PKG.engines.node;
  ok(/>=\s*(\d+)/.exec(range) && major >= Number(/>=\s*(\d+)/.exec(range)[1]),
     'and that version satisfies the engines floor');
  ok(/<\s*(\d+)/.exec(range) && major < Number(/<\s*(\d+)/.exec(range)[1]),
     'and its ceiling — the pin and the declaration agree');
}

console.log('\n== 4. the dormant R-floor trap in measured-edge ==');
{
  /* The out-of-sample half already used the desk's own floor and said why;
     the in-sample half above it did not, so one gate could measure the same
     mechanic against two different breakevens. */
  ok(/var edInRr = isFinite\(fin\(x\.minRr\)\)/.test(ROUTE), 'the in-sample breakeven reads x.minRr');
  ok(/var pBreak = 1 \/ \(1 \+ edInRr\);/.test(ROUTE), 'and derives pBreak from it');
  ok(!/var pBreak = 1 \/ \(1 \+ MIN_RR\);/.test(ROUTE), 'the module default is no longer hard-wired');
  ok(/var edMinRr = isFinite\(fin\(x\.minRr\)\)/.test(ROUTE), 'the out-of-sample half is unchanged');

  /* Behavioural: 40% T1-first is EXACTLY breakeven at 1.5R and well below it
     at 2R. One number, two verdicts — which is the whole point. */
  const ctx = { console:{log(){},warn(){},error(){}}, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
  ctx.document = { createElement:()=>({style:{},innerHTML:'',appendChild(){},setAttribute(){},
    addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]}), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js','omniroute.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  const T0 = 1700000000 - (1700000000 % 86400);
  const rows = []; let p = 60000, s = 3;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < 300; i++){
    p = p*(1+(rnd()-0.5)*0.004); const r = p*0.002*(0.5+rnd());
    rows.push({ t:T0+i*14400, o:p-r*0.25, h:p+r, l:p-r, c:p, v:1000 });
  }
  const zOf = (minRr) => {
    const ex = { stats: { samples: 200, hit: 0.40, expR: 0 } };
    if (minRr !== undefined) ex.minRr = minRr;
    const g = ctx.hgOmniGates(rows, { dir:'long', kind:'ORB', mech:'ORB' }, null, ex);
    const e = (g || []).filter(x => x && x.key === 'measured-edge')[0];
    const m = /([-+][\d.]+)σ/.exec(String(e && e.why));
    return m ? parseFloat(m[1]) : NaN;
  };
  const z2 = zOf(undefined), z15 = zOf(1.5);
  ok(isFinite(z2) && isFinite(z15), 'both reads produce a sigma (' + z2 + ', ' + z15 + ')');
  /* 40% T1-first is ABOVE the 33.3% breakeven for 2R, and EXACTLY AT the 40%
     breakeven for 1.5R. Same measurement, two honest verdicts — and before
     this fix the 1.5R desk would have been handed the 2R one. */
  ok(z2 > 1.5, '40% clears the 33.3% breakeven for 2R (' + z2.toFixed(2) + 'σ)');
  ok(Math.abs(z15) < 0.2, 'and sits exactly on the 40% breakeven for 1.5R (' + z15.toFixed(2) + 'σ)');
  ok(z2 !== z15, 'the R floor now changes the verdict, which is the whole point');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL SUPPLY CHAIN AND RUNTIME TESTS PASSED');
