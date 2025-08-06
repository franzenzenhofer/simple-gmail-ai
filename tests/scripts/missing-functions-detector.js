#!/usr/bin/env node

/**
 * MISSING FUNCTIONS DETECTOR
 * Comprehensive analysis to ensure all UI-referenced functions exist
 * and are properly exported at global scope
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 MISSING FUNCTIONS DETECTOR');
console.log('=============================');

// Extract function names from UI components that will be called by Google Apps Script
function findUIFunctionReferences() {
  const uiReferences = new Set();
  const srcDir = path.join(__dirname, '../../src');
  
  // Scan all TypeScript files for setFunctionName calls
  function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const functionNameMatches = content.match(/setFunctionName\(['"`]([^'"`]+)['"`]\)/g);
    
    if (functionNameMatches) {
      functionNameMatches.forEach(match => {
        const funcName = match.match(/setFunctionName\(['"`]([^'"`]+)['"`]\)/)[1];
        uiReferences.add(funcName);
      });
    }
  }
  
  // Recursively scan all .ts files
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (file.endsWith('.ts')) {
        scanFile(fullPath);
      }
    });
  }
  
  scanDirectory(srcDir);
  return Array.from(uiReferences);
}

// Extract globally exported functions from Code.ts
function findGlobalExports() {
  const codeFilePath = path.join(__dirname, '../../src/Code.ts');
  const content = fs.readFileSync(codeFilePath, 'utf8');
  
  const globalFunctions = new Set();
  const functionMatches = content.match(/^function\s+(\w+)/gm);
  
  if (functionMatches) {
    functionMatches.forEach(match => {
      const funcName = match.match(/^function\s+(\w+)/)[1];
      globalFunctions.add(funcName);
    });
  }
  
  return Array.from(globalFunctions);
}

// Main analysis
const uiFunctions = findUIFunctionReferences();
const globalFunctions = findGlobalExports();

console.log('📱 UI Functions Found:', uiFunctions.length);
uiFunctions.forEach(func => console.log('  - ' + func));

console.log('\n🌍 Global Functions Found:', globalFunctions.length);
globalFunctions.forEach(func => console.log('  - ' + func));

// Find missing functions
const missingFunctions = uiFunctions.filter(func => !globalFunctions.includes(func));

console.log('\n❌ Missing Functions:', missingFunctions.length);
if (missingFunctions.length > 0) {
  missingFunctions.forEach(func => {
    console.log(`  ❌ ${func} - Referenced in UI but not globally exported!`);
  });
  
  console.log('\n🔧 FIX REQUIRED:');
  console.log('Add these functions to src/Code.ts:');
  missingFunctions.forEach(func => {
    console.log(`
function ${func}(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return ActionHandlers.${func}(e);
}`);
  });
  
  process.exit(1);
} else {
  console.log('✅ All UI functions are properly exported!');
}

// Additional checks
console.log('\n🔍 ADDITIONAL CHECKS:');

// Check for orphaned global functions
const orphanedFunctions = globalFunctions.filter(func => 
  !uiFunctions.includes(func) && 
  !['onInstall', 'onHomepage', 'onGmailMessage'].includes(func)
);

if (orphanedFunctions.length > 0) {
  console.log('⚠️  Orphaned Global Functions (may be unused):');
  orphanedFunctions.forEach(func => console.log('  - ' + func));
} else {
  console.log('✅ No orphaned functions found');
}

console.log('\n✅ Missing Functions Analysis Complete!');