/**
 * TypeScript configuration for Jest
 * Separated from main Jest config for better maintainability
 */

module.exports = {
  // TypeScript compilation options for tests
  tsconfig: {
    target: 'ES2019',
    module: 'commonjs',
    lib: ['ES2019'],
    types: ['jest', 'google-apps-script'],
    
    // Additional TypeScript options for tests
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    strict: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    isolatedModules: true,
    noEmit: true,
    
    // Path mappings for tests
    paths: {
      '@/*': ['./src/*']
    },
    
    // Use inline source maps for better debugging
    sourceMap: true,
    inlineSourceMap: true,
    inlineSources: true
  },
  
  // ts-jest specific options
  isolatedModules: false, // Allow type checking in tests
  diagnostics: {
    // Ignore specific TypeScript errors in tests if needed
    ignoreCodes: [
      // 2339, // Property does not exist on type (useful for mocking)
    ]
  }
};