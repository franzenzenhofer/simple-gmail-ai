module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  rules: {
    // Style consistency
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    
    // TypeScript specific - be more lenient
    '@typescript-eslint/no-unused-vars': ['warn', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^(Config|AppLogger|AI|GmailService|UI|Utils|Types|EntryPoints|ActionHandlers|ProcessingHandlers|NavigationHandlers|UniversalActions|ErrorHandling|ProcessingOverlay|AISchemas|BatchProcessor|ContextualActions|ContinuationHandlers|ContinuationTriggers|DarkMode|DocsPromptEditor|DocsPromptHandlers|DraftTracker|ErrorTaxonomy|FunctionCalling|Guardrails|HistoryDelta|JsonValidator|LabelCache|LockManager|Redaction|StructuredAI|TestMode|UIImprovements|WelcomeFlow)$'
    }],
    '@typescript-eslint/explicit-function-return-type': 'off', // Too strict for this codebase
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // Code quality
    'no-console': 'off', // We use console.log for Apps Script logging
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': 'error',
    'no-inner-declarations': 'off', // Allow function declarations inside namespaces
    
    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error', 
    'no-new-func': 'error',
    
    // Google Apps Script specific allowances
    '@typescript-eslint/no-namespace': 'off', // We use namespaces for module organization
    '@typescript-eslint/no-unused-expressions': 'off', // GAS sometimes requires side effects
  },
  globals: {
    // Google Apps Script globals
    'PropertiesService': 'readonly',
    'CardService': 'readonly', 
    'GmailApp': 'readonly',
    'UrlFetchApp': 'readonly',
    'SpreadsheetApp': 'readonly',
    'DriveApp': 'readonly',
    'DocumentApp': 'readonly',
    'Session': 'readonly',
    'Utilities': 'readonly',
    'GoogleAppsScript': 'readonly',
    'console': 'readonly',
    'Logger': 'readonly'
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.js', // Ignore JS files like bundle.js, test-post-bundle.js
    'jest.config.js',
    '.eslintrc.js',
    '.gmail-processor-reference/',
    '**/*.test.ts' // Ignore test files
  ]
};