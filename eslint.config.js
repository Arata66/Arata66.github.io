const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['public/**', 'node_modules/**', '.deploy*/**'] },
  js.configs.recommended,
  {
    files: ['scripts/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, hexo: 'readonly' }
    }
  },
  {
    files: ['source/js/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser }
  },
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
];
