#!/usr/bin/env node

/**
 * Inject version and deploy time into bundled code
 * More robust than simple string replacement
 */

const fs = require('fs');
const path = require('path');

function injectVersionInfo(bundleContent, version, deployTime) {
  // Use AST-aware replacement for Config module exports
  // Look for the specific pattern in the Config namespace
  
  // Pattern 1: export const VERSION = '__VERSION__';
  const versionPattern = /(export const VERSION = )(['"])__VERSION__\2(;?)/g;
  bundleContent = bundleContent.replace(versionPattern, `$1$2${version}$3$4`);
  
  // Pattern 2: export const DEPLOY_TIME = '__DEPLOY_TIME__';
  const deployTimePattern = /(export const DEPLOY_TIME = )(['"])__DEPLOY_TIME__\2(;?)/g;
  bundleContent = bundleContent.replace(deployTimePattern, `$1$2${deployTime}$3$4`);
  
  // Also handle the minified/transformed versions that might occur
  // Config.VERSION = '__VERSION__'
  const configVersionPattern = /(Config\.VERSION\s*=\s*)(['"])__VERSION__\2/g;
  bundleContent = bundleContent.replace(configVersionPattern, `$1$2${version}$2`);
  
  // Config.DEPLOY_TIME = '__DEPLOY_TIME__'
  const configDeployPattern = /(Config\.DEPLOY_TIME\s*=\s*)(['"])__DEPLOY_TIME__\2/g;
  bundleContent = bundleContent.replace(configDeployPattern, `$1$2${deployTime}$2`);
  
  return bundleContent;
}

// Main function for standalone usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: node inject-version.js <bundle-file> <version> <deploy-time>');
    process.exitCode = 1;
    return;
  }
  
  const [bundleFile, version, deployTime] = args;
  
  try {
    let content = fs.readFileSync(bundleFile, 'utf8');
    content = injectVersionInfo(content, version, deployTime);
    fs.writeFileSync(bundleFile, content);
    console.log(`✅ Version info injected: ${version} (${deployTime})`);
  } catch (error) {
    console.error(`❌ Error injecting version: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { injectVersionInfo };