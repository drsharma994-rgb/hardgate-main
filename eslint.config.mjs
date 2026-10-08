/* HARDGATE ESLint 9 flat config — two tiers.
 *
 * TIER 1 (blocking, `npm run lint`): api/, lib/, scripts/, tests/, *.mjs —
 *   the Node side of the repo.
 * TIER 2 (report-only, `npm run lint:legacy`): the root-level browser
 *   scripts (classic scripts, window globals, 600+ KB tabs). Warnings only,
 *   so the count is visible without blocking; parse errors still fail hard.
 *
 * Calibration notes (2026-10): `no-undef` is a warning outside api/ because
 * lib/ + scripts/ + tests/ legitimately reference browser globals and
 * cross-file app globals (HG_TAB_MODS, window, document) in this dual
 * (browser+Node) codebase. `no-redeclare` likewise — var-redeclaration is
 * idiomatic in the classic-script style. Genuine structural hazards
 * (no-dupe-keys etc.) stay errors outside tests/, where last-key-wins is
 * sometimes the point under test.
 *
 * Config file is .mjs so it never joins the root *.js enumeration guards
 * (tests + sw.js shell parity track root .js files).
 */
import js from '@eslint/js';

const warnOnly = {};
for (const [rule, level] of Object.entries(js.configs.recommended.rules || {})){
  warnOnly[rule] = level === 'error' ? 'warn' : level;
}

const NODE_GLOBALS = {
  console: 'readonly', process: 'readonly', Buffer: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly',
  clearInterval: 'readonly', queueMicrotask: 'readonly', structuredClone: 'readonly',
  globalThis: 'readonly', global: 'readonly', require: 'readonly', module: 'readonly',
  exports: 'readonly', __dirname: 'readonly', __filename: 'readonly',
};

const WEB_GLOBALS = {
  fetch: 'readonly', Response: 'readonly', Request: 'readonly', Headers: 'readonly',
  URL: 'readonly', URLSearchParams: 'readonly', FormData: 'readonly',
  ReadableStream: 'readonly', Blob: 'readonly', Event: 'readonly', CustomEvent: 'readonly',
  TextEncoder: 'readonly', TextDecoder: 'readonly', AbortController: 'readonly',
  AbortSignal: 'readonly', atob: 'readonly', btoa: 'readonly', crypto: 'readonly',
  performance: 'readonly', Intl: 'readonly', WebSocket: 'readonly', EventSource: 'readonly',
  window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
  localStorage: 'readonly', sessionStorage: 'readonly', history: 'readonly',
};

export default [
  {
    ignores: [
      'node_modules/**', 'vendors/**', 'android/**', 'snapshots/**',
      'data/**', 'docs/**', 'baseline-test.log', '*.min.js',
      /* generated literal fragments, not loadable scripts */
      'trendtable-src-*.js',
    ],
  },

  /* ---- TIER 1: core ---- */
  {
    files: ['api/**/*.js', 'lib/**/*.mjs', 'scripts/**/*.mjs', 'tests/**/*.mjs', '*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...NODE_GLOBALS, ...WEB_GLOBALS },
    },
    rules: {
      ...warnOnly,
      /* Structural hazards that mean a real bug: */
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-async-promise-executor': 'error',
      'no-self-assign': 'error',
      'no-shadow-restricted-names': 'error',
      'no-useless-backreference': 'error',
      'no-compare-neg-zero': 'error',
    },
  },

  /* app.js is ESM despite the .js extension (Node >=20.10 module detection
     runs it fine); every other root .js is a classic browser script. */
  {
    files: ['app.js'],
    languageOptions: { sourceType: 'module' },
  },

  /* api/*.js is CommonJS (require/module.exports), not ESM */
  {
    files: ['api/**/*.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: {
      /* Pure Node server code: undefined refs are real bugs here. */
      'no-undef': 'error',
      'no-redeclare': 'error',
    },
  },

  /* tests sometimes rely on last-key-wins on purpose */
  {
    files: ['tests/**/*.mjs'],
    rules: {
      'no-dupe-keys': 'warn',
      'no-redeclare': 'warn',
      'no-undef': 'warn',
    },
  },

  /* ---- TIER 2: legacy root browser scripts (report-only) ---- */
  {
    files: ['*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: {
        ...WEB_GLOBALS,
        XMLHttpRequest: 'readonly', MutationObserver: 'readonly',
        caches: 'readonly', serviceWorker: 'readonly', indexedDB: 'readonly',
        alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        Promise: 'readonly', EventTarget: 'readonly',
      },
    },
    rules: {
      ...warnOnly,
      'no-unused-vars': 'warn',
      /* Structural hazards still block even in legacy files: */
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-async-promise-executor': 'error',
      'no-compare-neg-zero': 'error',
      /* defensive try/catch-around-everything is the house style in the
         browser tabs (see the empty-catch warnings), so unreachable
         catch arms there are a warning, not a deploy blocker. */
      'no-unreachable': 'warn',
    },
  },
];
