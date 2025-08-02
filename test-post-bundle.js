#!/usr/bin/env node

/**
 * Post-bundle validation for Google Apps Script
 * Ensures the bundled file will work in GAS environment
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Test configuration
const tests = [];
let passed = 0;
let failed = 0;

// Helper to run tests
function test(name, fn) {
  tests.push({ name, fn });
}

function runTests() {
  console.log('\n🧪 Post-Bundle Validation\n');
  
  tests.forEach(({ name, fn }) => {
    try {
      fn();
      passed++;
      console.log(`✅ ${name}`);
    } catch (error) {
      failed++;
      console.log(`❌ ${name}`);
      console.log(`   ${error.message}`);
    }
  });
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Read files
const bundlePath = path.join(__dirname, 'dist', 'Code.gs');
const manifestPath = path.join(__dirname, 'dist', 'appsscript.json');

if (!fs.existsSync(bundlePath) || !fs.existsSync(manifestPath)) {
  console.error('❌ Build files not found. Run "npm run build" first.');
  process.exit(1);
}

const bundledCode = fs.readFileSync(bundlePath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Extract all function references from manifest
function getFunctionRefs(obj, refs = new Set()) {
  for (const key in obj) {
    if (key.endsWith('Function') && typeof obj[key] === 'string') {
      refs.add(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      getFunctionRefs(obj[key], refs);
    }
  }
  return refs;
}

const requiredFunctions = getFunctionRefs(manifest);

// Test 1: All manifest functions exist in bundle
test('All manifest functions exist', () => {
  requiredFunctions.forEach(fn => {
    const regex = new RegExp(`function\\s+${fn}\\s*\\(`, 'g');
    if (!regex.test(bundledCode)) {
      throw new Error(`Function '${fn}' not found in bundle`);
    }
  });
});

// Test 2: Bundle executes without syntax errors
test('Bundle has valid syntax', () => {
  new Function(bundledCode);
});

// Test 3: No module-level Google service access
test('No module-level Google service access', () => {
  // More accurate check: look for service calls outside any function scope
  const services = ['PropertiesService', 'CardService', 'GmailApp', 'UrlFetchApp', 'SpreadsheetApp', 'DriveApp'];
  
  // Remove all function bodies to find true module-level code
  let moduleLevel = bundledCode;
  
  // Remove function bodies (simple approach)
  moduleLevel = moduleLevel.replace(/function\s+\w+\s*\([^)]*\)\s*\{[^{}]*\{[^{}]*\}[^{}]*\}/g, 'function REMOVED() {}');
  moduleLevel = moduleLevel.replace(/function\s+\w+\s*\([^)]*\)\s*\{[^}]*\}/g, 'function REMOVED() {}');
  
  // Check for service usage in remaining code
  services.forEach(service => {
    const regex = new RegExp(`${service}\\.`, 'g');
    if (regex.test(moduleLevel)) {
      // Double-check it's not in a nested function we missed
      const lines = bundledCode.split('\n');
      lines.forEach((line, i) => {
        if (line.includes(`${service}.`) && line.trim() && !line.trim().startsWith('//')) {
          // Count braces to determine if we're in a function
          const before = lines.slice(0, i).join('\n');
          const openBraces = (before.match(/\{/g) || []).length;
          const closeBraces = (before.match(/\}/g) || []).length;
          if (openBraces === closeBraces) {
            throw new Error(`Module-level ${service} access at line ${i + 1}: ${line.trim()}`);
          }
        }
      });
    }
  });
});

// Run all tests
runTests();