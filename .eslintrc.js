module.exports = {
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: 'module'
  },
  env: {
    es6: true,
    node: true,
    jest: true
  },
  globals: {
    // Google Apps Script globals
    'CardService': 'readonly',
    'GmailApp': 'readonly',
    'PropertiesService': 'readonly',
    'UrlFetchApp': 'readonly',
    'GoogleAppsScript': 'readonly',
    'console': 'readonly',
    'Logger': 'readonly'
  },
  rules: {
    // Prevent common errors
    'no-console': 'off', // We use console.log for Apps Script logging
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    
    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error'
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.js',
    '.gmail-processor-reference/',
    '**/*.test.ts' // Ignore test files for now
  ]
};