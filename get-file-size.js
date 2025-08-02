#!/usr/bin/env node

/**
 * Cross-platform file size detection script
 * Replaces shell-specific stat commands with Node.js fs.statSync
 */

const fs = require('fs');
const path = require('path');

// Get file path from command line argument
const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node get-file-size.js <file-path>');
  process.exitCode = 1;
  return;
}

try {
  // Resolve to absolute path
  const absolutePath = path.resolve(filePath);
  
  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${filePath}`);
    process.exitCode = 1;
    return;
  }
  
  // Get file stats
  const stats = fs.statSync(absolutePath);
  
  // Check if it's actually a file (not a directory)
  if (!stats.isFile()) {
    console.error(`Not a file: ${filePath}`);
    process.exitCode = 1;
    return;
  }
  
  // Output just the size in bytes (matching the behavior of stat -f%z / stat -c%s)
  console.log(stats.size);
  
} catch (error) {
  console.error(`Error getting file size: ${error.message}`);
  process.exitCode = 1;
}