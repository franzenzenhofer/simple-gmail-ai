#!/usr/bin/env node

/**
 * Post-bundle validation for Google Apps Script
 * Ensures the bundled file will work in GAS environment
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');

// Test configuration
const tests = [];
let passed = 0;
let failed = 0;

// Helper to run tests
function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('\n🧪 Post-Bundle Validation\n');
  
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`✅ ${name}`);
    } catch (error) {
      failed++;
      console.log(`❌ ${name}`);
      console.log(`   ${error.message}`);
    }
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

async function main() {
  // Read files
  const distPath = path.join(__dirname, 'dist');
  const bundlePath = path.join(distPath, 'Code.gs');
  const manifestPath = path.join(distPath, 'appsscript.json');

  if (!fsSync.existsSync(bundlePath) || !fsSync.existsSync(manifestPath)) {
    console.error('❌ Build files not found. Run "npm run build" first.');
    process.exit(1);
  }

  const bundledCode = await fs.readFile(bundlePath, 'utf8');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

  // Find all .js and .gs files in dist (including subdirectories)
  async function findJSFiles(dir, files = []) {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        await findJSFiles(fullPath, files);
      } else if (item.name.endsWith('.js') || item.name.endsWith('.gs')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allJSFiles = await findJSFiles(distPath);

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
      const regex = new RegExp(`\\bfunction\\s+${fn}\\b\\s*\\(`, 'g');
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
    const services = ['PropertiesService', 'CardService', 'GmailApp', 'UrlFetchApp', 'SpreadsheetApp', 'DriveApp'];
  
  try {
    // Parse the bundled code with Acorn
    const ast = acorn.parse(bundledCode, { 
      ecmaVersion: 2022,
      locations: true 
    });
    
    // Walk the AST to find service calls at module level
    function checkNode(node, inFunction = false) {
      // Track when we enter/exit functions
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
        // Check the function body with inFunction = true
        if (node.body) {
          checkNode(node.body, true);
        }
        return;
      }
      
      // Check for service calls
      if (node.type === 'MemberExpression' && !inFunction) {
        if (node.object && node.object.type === 'Identifier') {
          if (services.includes(node.object.name)) {
            const line = node.loc.start.line;
            const lineContent = bundledCode.split('\n')[line - 1];
            throw new Error(`Module-level ${node.object.name} access at line ${line}: ${lineContent.trim()}`);
          }
        }
      }
      
      // Recursively check child nodes
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach(child => {
              if (child && typeof child === 'object') {
                checkNode(child, inFunction);
              }
            });
          } else {
            checkNode(node[key], inFunction);
          }
        }
      }
    }
    
    // Start checking from the root
    checkNode(ast, false);
    
  } catch (parseError) {
    // If AST parsing fails, fall back to the original regex approach
    if (parseError.message.includes('Module-level')) {
      throw parseError;
    }
    
    // Fallback to brace counting if parse fails
    const lines = bundledCode.split('\n');
    lines.forEach((line, i) => {
      services.forEach(service => {
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
    });
  }
  });

  // Test 4: No CommonJS exports in any file
  test('No CommonJS exports in deployed files', async () => {
    const problematicPatterns = [
      /Object\.defineProperty\(exports/,
      /exports\.[a-zA-Z_]/,
      /module\.exports/,
      /require\(/,
      /__esModule/
    ];
    
    for (const filePath of allJSFiles) {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = path.relative(__dirname, filePath);
      
      problematicPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          // Find the line number
          const lines = content.split('\n');
          let lineNum = 0;
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              lineNum = i + 1;
              break;
            }
          }
          throw new Error(`CommonJS pattern found in ${relativePath} at line ${lineNum}: ${pattern}`);
        }
      });
    }
  });

  // Test 5: Bundle size check - prevent bloat and Apps Script limits
  test('Bundle size is under Apps Script 2MB hard limit', async () => {
    const stats = await fs.stat(bundlePath);
    const sizeInMB = stats.size / (1024 * 1024);
    const sizeInKB = stats.size / 1024;
    
    // Apps Script hard limit is 2MB per file
    const APPS_SCRIPT_LIMIT_MB = 2.0;
    // Warn at 1MB to catch bloat early
    const WARNING_THRESHOLD_MB = 1.0;
    
    if (sizeInMB >= APPS_SCRIPT_LIMIT_MB) {
      throw new Error(`Bundle exceeds Apps Script 2MB limit: ${sizeInMB.toFixed(2)}MB (${stats.size} bytes). Apps Script will reject this file.`);
    }
    
    if (sizeInMB > WARNING_THRESHOLD_MB) {
      console.log(`⚠️  Large bundle warning: ${sizeInMB.toFixed(2)}MB (approaching 2MB limit)`);
    }
    
    console.log(`✅ Bundle size OK: ${sizeInKB.toFixed(0)}KB (${sizeInMB.toFixed(2)}MB) - well under 2MB limit`);
  });

  // Test 6: Comprehensive Apps Script project size validation
  test('All project files are within Apps Script limits', async () => {
    const APPS_SCRIPT_FILE_LIMIT_MB = 2.0;
    const APPS_SCRIPT_PROJECT_LIMIT_MB = 10.0; // Total project size limit
    
    let totalProjectSize = 0;
    const fileSizes = [];
    
    for (const filePath of allJSFiles) {
      const stats = await fs.stat(filePath);
      const sizeInMB = stats.size / (1024 * 1024);
      const relativePath = path.relative(distPath, filePath);
      
      totalProjectSize += stats.size;
      fileSizes.push({ file: relativePath, sizeKB: Math.round(stats.size / 1024), sizeMB: sizeInMB });
      
      // Check individual file size limits
      if (sizeInMB >= APPS_SCRIPT_FILE_LIMIT_MB) {
        throw new Error(`File ${relativePath} exceeds 2MB limit: ${sizeInMB.toFixed(2)}MB`);
      }
    }
    
    const totalProjectSizeMB = totalProjectSize / (1024 * 1024);
    
    // Check total project size
    if (totalProjectSizeMB >= APPS_SCRIPT_PROJECT_LIMIT_MB) {
      throw new Error(`Total project size exceeds 10MB limit: ${totalProjectSizeMB.toFixed(2)}MB`);
    }
    
    // Log all file sizes for visibility
    console.log(`📊 File sizes:`);
    fileSizes.forEach(({ file, sizeKB, sizeMB }) => {
      const warning = sizeMB > 1 ? ' ⚠️' : '';
      console.log(`   ${file}: ${sizeKB}KB${warning}`);
    });
    console.log(`📦 Total project: ${Math.round(totalProjectSize / 1024)}KB (${totalProjectSizeMB.toFixed(2)}MB)`);
  });

  // Test 7: Only approved files in dist
  test('Only approved files in dist directory', async () => {
    const approvedFiles = ['Code.gs', 'appsscript.json', '.clasp.json'];
    const approvedDirs = []; // No subdirectories should exist
    
    const items = await fs.readdir(distPath, { withFileTypes: true });
    
    items.forEach(item => {
      if (item.isDirectory() && !approvedDirs.includes(item.name)) {
        throw new Error(`Unexpected directory in dist: ${item.name}`);
      } else if (item.isFile() && !approvedFiles.includes(item.name)) {
        throw new Error(`Unexpected file in dist: ${item.name}`);
      }
    });
  });

  // Run all tests
  await runTests();
}

// Run the main function
main().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});