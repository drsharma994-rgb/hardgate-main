/* HARDGATE — collapse the upper chrome with one key.

   Field report: the header + MARKET PICTURE + group chips eat the window
   so OMNIROUTE tickets sit below the fold. Minimize that block with a key
   (backtick `), persist the choice, and do not steal the key while typing.

   Run: node tests/test-chrome-min.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const HTML = read('index.html');
const CSS = read('mobile.css');
const ROUTE = read('omniroute.js');
const SW = read('sw.js');

function extractChrome(){
  const start = HTML.indexOf('var HG_CHROME_KEY');
  const end = HTML.indexOf('function toggleHeaderDrawer');
  if (start < 0 || end < 0 || end <= start) throw new Error('chrome-min helpers missing from index.html');
  return HTML.slice(start, end);
}

function boot(opts){
  opts = opts || {};
  const store = Object.assign({ hg_chrome_min: null }, opts.store || {});
  const htmlEl = {
    classList: (function(){
      const s = new Set();
      return {
        add(c){ s.add(c); },
        remove(c){ s.delete(c); },
        toggle(c, force){
          const on = force === undefined ? !s.has(c) : !!force;
          if (on) s.add(c); else s.delete(c);
          return on;
        },
        contains(c){ return s.has(c); },
        _set: s
      };
    })()
  };
  const btn = {
    tagName: 'BUTTON',
    id: 'chromeMinBtn',
    _attrs: { 'aria-pressed': 'false', title: '' },
    setAttribute(k, v){ this._attrs[k] = String(v); },
    getAttribute(k){ return this._attrs[k]; }
  };
  const listeners = [];
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    document: {
      documentElement: htmlEl,
      getElementById(id){ return id === 'chromeMinBtn' ? btn : null; },
      addEventListener(ev, fn){ listeners.push({ ev, fn }); }
    },
    localStorage: {
      getItem(k){ return store[k] == null ? null : String(store[k]); },
      setItem(k, v){ store[k] = String(v); }
    },
    window: null
  };
  ctx.window = ctx;
  vm.runInNewContext(extractChrome()
    + '\nhgChromeInit();\n'
    + 'this.__html = document.documentElement;\n'
    + 'this.__btn = document.getElementById("chromeMinBtn");\n'
    + 'this.__store = localStorage;\n'
    + 'this.__listeners = [];\n', ctx);
  ctx.__html = htmlEl;
  ctx.__btn = btn;
  ctx.__store = store;
  ctx.__listeners = listeners;
  /* Re-bind listeners captured during hgChromeInit via document.addEventListener */
  return ctx;
}

console.log('== wiring ==');
{
  ok(/id="chromeMinBtn"/.test(HTML), 'header has a chrome-min button');
  ok(/function toggleChromeMin\(/.test(HTML), 'toggleChromeMin is wired');
  ok(/function hgChromeKey\(/.test(HTML), 'keydown helper exists');
  ok(/hgChromeInit\(\)/.test(HTML), 'chrome-min boots on load');
  ok(/localStorage\.getItem\(HG_CHROME_KEY\)/.test(HTML) || /getItem\(['"]hg_chrome_min['"]\)/.test(HTML)
     || /HG_CHROME_KEY/.test(HTML), 'persists under hg_chrome_min');
  ok(/hg-chrome-min/.test(HTML), 'html class hg-chrome-min is the collapsed state');
  ok(/title="[^"]*`/.test(HTML.match(/id="chromeMinBtn"[^>]*>/)[0] || ''),
     'button advertises the backtick key');
  ok(swCacheOk(SW), 'cache matches build stamp');
}

console.log('== CSS hides the upper block ==');
{
  const css = HTML + '\n' + CSS;
  ok(/html\.hg-chrome-min\s+\.header-drawer/.test(css.replace(/\s+/g, ' ')),
     'collapsed state targets the tools drawer');
  ok(/html\.hg-chrome-min\s+\.market-picture-bar/.test(css.replace(/\s+/g, ' ')),
     'collapsed state hides MARKET PICTURE');
  ok(/html\.hg-chrome-min\s+\.header-chips/.test(css.replace(/\s+/g, ' ')),
     'collapsed state hides status chips');
  ok(/html\.hg-chrome-min\s+\.navgroups/.test(css.replace(/\s+/g, ' ')),
     'collapsed state hides group chips (tab row stays)');
  ok(/html\.hg-chrome-min\s+\.brand\s+small/.test(css.replace(/\s+/g, ' '))
     || /html\.hg-chrome-min\s+\.brand small/.test(css),
     'collapsed state hides the brand tagline');
  ok(/html\.hg-chrome-min\s+\.hg-lead/.test(css.replace(/\s+/g, ' ')),
     'collapsed state hides tab lead copy');
  ok(/class="note hg-lead"/.test(ROUTE) || /class='note hg-lead'/.test(ROUTE)
     || /class=\\"note hg-lead\\"/.test(ROUTE) || /hg-lead/.test(ROUTE),
     'OMNIROUTE intro is marked hg-lead so it collapses');
}

console.log('== desktop drawer cannot fight collapse ==');
{
  const desk = CSS.split('@media (min-width: 861px)')[1] || '';
  ok(/html:not\(\.hg-chrome-min\)/.test(desk) || /html\.hg-chrome-min/.test(CSS + HTML),
     'desktop always-open drawer yields when chrome is minimized');
}

console.log('== behaviour ==');
{
  const ctx = boot({ store: { hg_chrome_min: '0' } });
  ok(!ctx.__html.classList.contains('hg-chrome-min'), 'boot with 0 → expanded');
  ctx.toggleChromeMin();
  ok(ctx.__html.classList.contains('hg-chrome-min'), 'toggle collapses');
  ok(ctx.__store.hg_chrome_min === '1', 'collapse persists as 1');
  ok(ctx.__btn.getAttribute('aria-pressed') === 'true', 'button pressed when collapsed');
  ctx.toggleChromeMin();
  ok(!ctx.__html.classList.contains('hg-chrome-min'), 'toggle expands again');
  ok(ctx.__store.hg_chrome_min === '0', 'expand persists as 0');
}

console.log('== remembers last choice ==');
{
  const ctx = boot({ store: { hg_chrome_min: '1' } });
  ok(ctx.__html.classList.contains('hg-chrome-min'), 'boot with 1 → collapsed');
}

console.log('== backtick key ==');
{
  const ctx = boot({ store: { hg_chrome_min: '0' } });
  const fired = ctx.hgChromeKey({
    key: '`', code: 'Backquote',
    metaKey: false, ctrlKey: false, altKey: false,
    defaultPrevented: false, preventDefault(){ this.defaultPrevented = true; },
    target: { tagName: 'BODY', isContentEditable: false }
  });
  ok(fired === true, 'backtick on body is handled');
  ok(ctx.__html.classList.contains('hg-chrome-min'), 'backtick collapses the chrome');
}

console.log('== does not steal the key while typing ==');
{
  const ctx = boot({ store: { hg_chrome_min: '0' } });
  const fired = ctx.hgChromeKey({
    key: '`', code: 'Backquote',
    metaKey: false, ctrlKey: false, altKey: false,
    defaultPrevented: false, preventDefault(){ this.defaultPrevented = true; },
    target: { tagName: 'INPUT', isContentEditable: false }
  });
  ok(fired === false, 'backtick inside an input is ignored');
  ok(!ctx.__html.classList.contains('hg-chrome-min'), 'typing does not collapse chrome');

  const ta = ctx.hgChromeKey({
    key: '`', code: 'Backquote',
    metaKey: false, ctrlKey: false, altKey: false,
    defaultPrevented: false, preventDefault(){ this.defaultPrevented = true; },
    target: { tagName: 'TEXTAREA', isContentEditable: false }
  });
  ok(ta === false, 'backtick inside a textarea is ignored');

  const mod = ctx.hgChromeKey({
    key: '`', code: 'Backquote',
    metaKey: true, ctrlKey: false, altKey: false,
    defaultPrevented: false, preventDefault(){ this.defaultPrevented = true; },
    target: { tagName: 'BODY', isContentEditable: false }
  });
  ok(mod === false, 'cmd/ctrl+backtick is left for the browser');
}

console.log('\n' + passed + ' passed');
