// ESLint 9 flat config. Errors fail CI; warnings are reported in the job summary.
import globals from 'globals';

const rules = {
  'no-undef': 'error',
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-dupe-else-if': 'error',
  'no-unreachable': 'error',
  'no-self-assign': 'error',
  'no-const-assign': 'error',
  'no-func-assign': 'error',
  'no-unsafe-negation': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-cond-assign': 'error',
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
  'eqeqeq': 'warn',
  'no-empty': 'warn',
  'no-constant-condition': 'warn',
};

// Libraries the pages load from a CDN (so they are globals in the page scripts)
const cdnGlobals = { Chart: 'readonly', faceapi: 'readonly', QRCode: 'readonly', THREE: 'readonly' };

export default [
  { ignores: ['node_modules/**', 'legacy/**', 'uploads/**', 'assets/**', 'logs/**', 'docs/**'] },
  {
    files: ['backend/**/*.js', 'startAll.js', 'tests/**/*.js', 'scripts/**/*.js', '.github/scripts/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
    rules,
  },
  {
    files: ['frontend/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser, ...cdnGlobals } },
    rules,
  },
];
