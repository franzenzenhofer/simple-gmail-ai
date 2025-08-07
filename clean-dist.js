#!/usr/bin/env node

/**
 * Cross-platform cleanup script for deployment
 * Replaces shell-specific rm -rf commands with rimraf
 */

const rimraf = require('rimraf');
const path = require('path');

// Clean up directories
const dirsToClean = ['src', 'tests'];

dirsToClean.forEach(dir => {
  const fullPath = path.join(process.cwd(), 'dist', dir);
  try {
    rimraf.sync(fullPath);
    console.log(`✅ Removed ${dir} directory`);
  } catch (err) {
    // Directory might not exist, that's ok
    console.log(`ℹ️  ${dir} directory not found (already clean)`);
  }
});

console.log('🧹 Cleanup complete');