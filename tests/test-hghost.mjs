/* HARDGATE — hghost.js unit tests (offline, no network).
   Run: node tests/test-hghost.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  pass++;
  console.log('  ok —', label);
};

function mockDom(){
  const byId = {};
  const body = { firstChild: null, insertBefore(el, ref){
    if (!ref) this.firstChild = el;
  } };
  const header = { parentNode: { insertBefore(el, ref){ byId.hgHostBanner = el; el._id = 'hgHostBanner'; byId['hgHostBanner'] = el; } } };
  function makeEl(tag){
    const el = { tagName: tag.toUpperCase(), className: '', style: { cssText: '' }, innerHTML: '', _id: '' };
    Object.defineProperty(el, 'id', {
      get(){ return el._id; },
      set(v){ el._id = v; if (v) byId[v] = el; },
    });
    return el;
  }
  return {
    body,
    byId,
    getElementById(id){ return byId[id] || null; },
    createElement: makeEl,
    querySelector(sel){ return sel === 'header' ? header : null; },
    readyState: 'complete',
    addEventListener(){},
  };
}

function loadHghost(opts){
  opts = opts || {};
  const document = opts.document || mockDom();
  globalThis.window = {
    location: { hostname: opts.hostname || 'localhost' },
    document,
  };
  globalThis.document = document;
  globalThis.fetch = opts.fetch || (async () => ({ ok: true }));
  vm.runInThisContext(fs.readFileSync(root + 'hghost.js', 'utf8'), { filename: 'hghost.js' });
  return globalThis.window;
}

console.log('== exports ==');
{
  const W = loadHghost();
  ok(typeof W.hgHostingMode === 'function', 'hgHostingMode exported');
  ok(typeof W.hgApiAvailable === 'function', 'hgApiAvailable exported');
  ok(typeof W.hgProbeProxy === 'function', 'hgProbeProxy exported');
  ok(typeof W.hgStaticHostBanner === 'function', 'hgStaticHostBanner exported');
}

console.log('== hosting mode ==');
{
  ok(loadHghost({ hostname: 'drsharma994-rgb.github.io' }).hgHostingMode() === 'static', 'github.io → static');
  ok(loadHghost({ hostname: 'hardgate-main.onrender.com' }).hgHostingMode() === 'full', 'onrender.com → full');
  ok(loadHghost({ hostname: 'localhost' }).hgHostingMode() === 'full', 'localhost → full');
  ok(loadHghost({ hostname: '127.0.0.1' }).hgHostingMode() === 'full', '127.0.0.1 → full');
  ok(loadHghost({ hostname: 'example.com' }).hgHostingMode() === 'unknown', 'other host → unknown');
}

console.log('== api availability ==');
{
  ok(loadHghost({ hostname: 'localhost' }).hgApiAvailable() === true, 'full host has API');
  ok(loadHghost({ hostname: 'user.github.io' }).hgApiAvailable() === false, 'static mirror has no API');
}

console.log('== proxy probe ==');
{
  const Wok = loadHghost({
    fetch: async () => ({ ok: true }),
  });
  ok(await Wok.hgProbeProxy() === true, 'proxy probe true when fetch ok');

  const Wfail = loadHghost({
    fetch: async () => { throw new Error('offline'); },
  });
  ok(await Wfail.hgProbeProxy() === false, 'proxy probe false on fetch error');
}

console.log('== static host banner ==');
{
  const doc = mockDom();
  const Wfull = loadHghost({ hostname: 'localhost', document: doc });
  await Wfull.hgStaticHostBanner();
  ok(!doc.getElementById('hgHostBanner'), 'full host skips banner');

  const doc2 = mockDom();
  const WstaticOk = loadHghost({
    hostname: 'mirror.github.io',
    document: doc2,
    fetch: async () => ({ ok: true }),
  });
  await WstaticOk.hgStaticHostBanner();
  ok(!doc2.getElementById('hgHostBanner'), 'static + working proxy skips banner');

  const doc3 = mockDom();
  const WstaticBad = loadHghost({
    hostname: 'mirror.github.io',
    document: doc3,
    fetch: async () => ({ ok: false }),
  });
  await WstaticBad.hgStaticHostBanner();
  const banner = doc3.getElementById('hgHostBanner');
  ok(!!banner, 'static + failed proxy paints banner');
  ok(banner.innerHTML.indexOf('Static mirror') >= 0, 'banner mentions static mirror');
  ok(banner.innerHTML.indexOf('hardgate-main.onrender.com') >= 0, 'banner links full server');
}

console.log('\n' + pass + ' passed');
