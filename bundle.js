#!/usr/bin/env node

/**
 * Enhanced Bundle Script for Modular Gmail AI
 * Combines multiple TypeScript module files into a single .gs file
 */

const fs = require('fs');
const path = require('path');

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
  const deployTime = new Date().toISOString().replace('T', ' ').split('.')[0] + ' UTC';
  
  console.log('🔨 Creating modular bundle...');
  
  // Define module order (dependencies first)
  const moduleOrder = [
    'config',
    'logger',
    'properties',
    'ai',
    'gmail',
    'utils',
    'ui'
  ];
  
  // Read and combine all modules
  let modulesContent = '';
  
  moduleOrder.forEach(moduleName => {
    const jsPath = path.join(modulesDir, `${moduleName}.js`);
    if (fs.existsSync(jsPath)) {
      const moduleContent = fs.readFileSync(jsPath, 'utf8');
      
      // Extract namespace content
      const namespaceMatch = moduleContent.match(/var\s+(\w+);\s*\(function\s*\(\1\)\s*\{([\s\S]*?)\}\)\(\1\s*\|\|\s*\(\1\s*=\s*\{\}\)\);?/);
      
      if (namespaceMatch) {
        const namespaceName = namespaceMatch[1];
        let innerContent = namespaceMatch[2];
        
        // Clean up the content
        innerContent = innerContent
          .replace(/Object\.defineProperty\(exports[^;]*;/g, '')
          .replace(/exports\.[^=]*=[^;]*;/g, '')
          .trim();
        
        modulesContent += `\n// ===== ${namespaceName.toUpperCase()} MODULE =====\n`;
        modulesContent += `var ${namespaceName};\n(function (${namespaceName}) {\n${innerContent}\n})(${namespaceName} || (${namespaceName} = {}));\n`;
        
        console.log(`✅ Included module: ${moduleName} (${namespaceName})`);
      } else {
        console.warn(`⚠️  Could not parse module: ${moduleName}`);
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
  
  // Write the bundled file
  fs.writeFileSync(bundleFile, bundledContent);
  
  // Clean up the src directory to ensure single-file deployment
  if (fs.existsSync(srcDir)) {
    fs.rmSync(srcDir, { recursive: true, force: true });
    console.log('🧹 Cleaned up intermediate src directory');
  }
  
  console.log(`✅ Modular bundle created: ${bundleFile}`);
  console.log(`📦 Size: ${Math.round(bundledContent.length / 1024)}KB`);
  console.log(`📚 Modules included: ${moduleOrder.join(', ')}`);
  
  return bundleFile;
}

if (require.main === module) {
  createBundle();
}

module.exports = { createBundle };