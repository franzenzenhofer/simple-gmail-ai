#!/usr/bin/env node

/**
 * Enhanced Bundle Script for Modular Gmail AI
 * Combines multiple TypeScript module files into a single .gs file
 */

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

/**
 * Analyze module dependencies by examining namespace references
 */
function analyzeDependencies(modulesDir) {
  const dependencies = {};
  
  // Only analyze core module files (exclude test files and optional modules)
  const coreModules = [
    'config',
    'logger', 
    'utils',
    'ai',
    'gmail',
    'ui',
    'error-handling',
    'entry-points', 
    'navigation-handlers',
    'action-handlers',
    'processing-handlers',
    'universal-actions'
  ];
  
  // Map of namespace names to module files
  const namespaceToModule = {
    'Config': 'config',
    'AppLogger': 'logger', 
    'Utils': 'utils',
    'AI': 'ai',
    'GmailService': 'gmail',
    'UI': 'ui',
    'ErrorHandling': 'error-handling',
    'EntryPoints': 'entry-points', 
    'NavigationHandlers': 'navigation-handlers',
    'ActionHandlers': 'action-handlers',
    'ProcessingHandlers': 'processing-handlers',
    'UniversalActions': 'universal-actions'
  };
  
  coreModules.forEach(moduleName => {
    const filePath = path.join(modulesDir, `${moduleName}.ts`);
    if (!fs.existsSync(filePath)) {
      dependencies[moduleName] = []; // Module might not exist, that's ok
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const deps = [];
    
    // Find all namespace references (e.g., Config.VERSION, AppLogger.info, etc.)
    Object.keys(namespaceToModule).forEach(namespace => {
      const pattern = new RegExp(`\\b${namespace}\\.`, 'g');
      if (pattern.test(content) && namespaceToModule[namespace] !== moduleName) {
        deps.push(namespaceToModule[namespace]);
      }
    });
    
    dependencies[moduleName] = [...new Set(deps)]; // Remove duplicates
  });
  
  return dependencies;
}

/**
 * Topological sort for dependency resolution
 */
function topologicalSort(dependencies) {
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();
  
  function visit(node) {
    if (visiting.has(node)) {
      throw new Error(`Circular dependency detected involving: ${node}`);
    }
    if (visited.has(node)) return;
    
    visiting.add(node);
    
    const deps = dependencies[node] || [];
    deps.forEach(dep => {
      if (dependencies[dep] !== undefined) { // Only visit if dep exists in our modules
        visit(dep);
      }
    });
    
    visiting.delete(node);
    visited.add(node);
    sorted.push(node);
  }
  
  // Visit all modules
  Object.keys(dependencies).forEach(module => {
    if (!visited.has(module)) {
      visit(module);
    }
  });
  
  return sorted;
}

function readModuleFile(modulePath) {
  try {
    const content = fs.readFileSync(modulePath, 'utf8');
    // Remove namespace declaration lines (they'll be combined)
    return content
      .replace(/^namespace\s+\w+\s*\{/gm, '') // Remove namespace opening
      .replace(/^\}$/gm, '') // Remove namespace closing
      .trim();
  } catch (e) {
    console.warn(`⚠️  Module not found: ${modulePath}`);
    return '';
  }
}


function createBundle() {
  const distDir = path.join(__dirname, 'dist');
  const srcDir = path.join(distDir, 'src');
  const codeFile = path.join(srcDir, 'Code.js');
  const modulesDir = path.join(srcDir, 'modules');
  const bundleFile = path.join(distDir, 'Code.gs');
  const packageFile = path.join(__dirname, 'package.json');
  
  // Check if compiled files exist
  if (!fs.existsSync(codeFile)) {
    console.error('❌ Code.js not found. Run npm run build first.');
    process.exit(1);
  }
  
  // Read package.json to get version
  const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const fullVersion = packageJson.version || '1.0.0';
  const appVersion = fullVersion.split('.').slice(0, 2).join('.');
  const deployTime = new Date().toLocaleString('de-AT', {
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Vienna'
  });
  
  console.log('🔨 Creating modular bundle...');
  
  // Auto-resolve module dependencies
  const srcModulesDir = path.join(__dirname, 'src', 'modules');
  const dependencies = analyzeDependencies(srcModulesDir);
  const moduleOrder = topologicalSort(dependencies);
  
  console.log('🔍 Dependency analysis:');
  Object.keys(dependencies).forEach(module => {
    if (dependencies[module].length > 0) {
      console.log(`   ${module} → ${dependencies[module].join(', ')}`);
    }
  });
  console.log('📋 Resolved order:', moduleOrder.join(' → '));
  
  // Validate all required modules exist
  const missingModules = [];
  moduleOrder.forEach(moduleName => {
    const jsPath = path.join(modulesDir, `${moduleName}.js`);
    if (!fs.existsSync(jsPath)) {
      missingModules.push(moduleName);
    }
  });
  
  if (missingModules.length > 0) {
    console.error(`❌ Missing required modules: ${missingModules.join(', ')}`);
    console.error('Run npm run build first to compile TypeScript modules');
    process.exit(1);
  }
  
  // Read and combine all modules
  let modulesContent = '';
  
  moduleOrder.forEach(moduleName => {
    const jsPath = path.join(modulesDir, `${moduleName}.js`);
    if (fs.existsSync(jsPath)) {
      const moduleContent = fs.readFileSync(jsPath, 'utf8');
      
      try {
        // Parse the module content with Acorn
        const ast = acorn.parse(moduleContent, { ecmaVersion: 2022 });
        
        // Find namespace pattern: var X; (function (X) { ... })(X || (X = {}));
        let namespaceName = null;
        let namespaceContent = null;
        
        // Look for the var declaration followed by IIFE
        for (let i = 0; i < ast.body.length; i++) {
          const node = ast.body[i];
          
          // Find "var NamespaceName;"
          if (node.type === 'VariableDeclaration' && node.declarations.length === 1) {
            const varName = node.declarations[0].id.name;
            
            // Look for the IIFE in the next statement
            if (i + 1 < ast.body.length) {
              const nextNode = ast.body[i + 1];
              
              if (nextNode.type === 'ExpressionStatement' && 
                  nextNode.expression.type === 'CallExpression' &&
                  nextNode.expression.callee.type === 'FunctionExpression') {
                
                const funcExpr = nextNode.expression.callee;
                const args = nextNode.expression.arguments;
                
                // Check if it's the namespace pattern
                if (funcExpr.params.length === 1 && 
                    funcExpr.params[0].name === varName &&
                    args.length === 1) {
                  
                  namespaceName = varName;
                  
                  // Extract the function body content
                  const startPos = funcExpr.body.start + 1; // after opening brace
                  const endPos = funcExpr.body.end - 1; // before closing brace
                  let innerContent = moduleContent.substring(startPos, endPos);
                  
                  // Clean up the content
                  innerContent = innerContent
                    .replace(/Object\.defineProperty\(exports[^;]*;/g, '')
                    .replace(/exports\.[^=]*=[^;]*;/g, '')
                    .trim();
                  
                  namespaceContent = innerContent;
                  break;
                }
              }
            }
          }
        }
        
        if (namespaceName && namespaceContent) {
          modulesContent += `\n// ===== ${namespaceName.toUpperCase()} MODULE =====\n`;
          modulesContent += `var ${namespaceName};\n(function (${namespaceName}) {\n${namespaceContent}\n})(${namespaceName} || (${namespaceName} = {}));\n`;
          
          console.log(`✅ Included module: ${moduleName} (${namespaceName})`);
        } else {
          console.error(`❌ CRITICAL: Could not parse namespace pattern in module: ${moduleName}`);
          console.error('AST parsing failed - check TypeScript compilation output');
          process.exit(1); // FAIL FAST - NO FALLBACKS
        }
        
      } catch (error) {
        console.error(`❌ CRITICAL: Failed to parse module ${moduleName}:`, error.message);
        console.error('AST parsing failed - fix the root cause');
        process.exit(1); // FAIL FAST - NO FALLBACKS
      }
    }
  });
  
  // Read the main Code.js file
  let mainContent = fs.readFileSync(codeFile, 'utf8');
  
  // Remove module references and CommonJS artifacts
  mainContent = mainContent
    .replace(/\/\/\/\s*<reference[^>]*>/g, '') // Remove TypeScript references
    .replace(/"use strict";?\n?/g, '')
    .replace(/Object\.defineProperty\(exports[^;]*;/g, '')
    .replace(/exports\.[^=]*=[^;]*;/g, '')
    .replace(/var\s+([^=]+)\s*=\s*require\([^)]+\);?/g, '')
    .replace(/const\s+([^=]+)\s*=\s*require\([^)]+\);?/g, '')
    .trim();
  
  // Replace version placeholders
  const finalContent = (modulesContent + '\n\n' + mainContent)
    .replace(/__VERSION__/g, appVersion)
    .replace(/__DEPLOY_TIME__/g, deployTime);
  
  // Add header
  const header = `/**
 * Gmail Support Triage & Auto-Reply Add-on
 * Modular architecture bundled into single file
 * Generated: ${new Date().toISOString()}
 * Version: ${fullVersion}
 */

"use strict";

`;
  
  const bundledContent = header + finalContent;
  
  // Validate bundle content before writing
  if (bundledContent.length < 10000) { // Less than 10KB indicates a problem
    console.error('❌ Bundle too small - likely missing content');
    process.exit(1);
  }
  
  // Check for critical functions
  const requiredFunctions = ['onHomepage', 'runAnalysis'];
  const missingFunctions = requiredFunctions.filter(fn => !bundledContent.includes(`function ${fn}(`));
  
  if (missingFunctions.length > 0) {
    console.error(`❌ Bundle missing required functions: ${missingFunctions.join(', ')}`);
    process.exit(1);
  }
  
  // Check for syntax errors by parsing the final bundle
  try {
    acorn.parse(bundledContent, { ecmaVersion: 2022 });
    console.log('✅ Bundle syntax validation passed');
  } catch (syntaxError) {
    console.error('❌ Bundle has syntax errors:', syntaxError.message);
    console.error('Position:', syntaxError.pos);
    process.exit(1);
  }
  
  // Write the bundled file
  fs.writeFileSync(bundleFile, bundledContent);
  
  // Note: Keep intermediate src/ directory for incremental builds
  // The dist/ directory cleanup happens via npm run clean when needed
  
  console.log(`✅ Modular bundle created: ${bundleFile}`);
  console.log(`📦 Size: ${Math.round(bundledContent.length / 1024)}KB`);
  console.log(`📚 Modules included: ${moduleOrder.join(', ')}`);
  
  return bundleFile;
}

if (require.main === module) {
  createBundle();
}

module.exports = { createBundle };