#!/usr/bin/env node

/**
 * Cross-platform file utilities
 * Provides portable file operations for build scripts
 */

const fs = require('fs');
const path = require('path');

// Command-line argument parsing
const command = process.argv[2];
const filePath = process.argv[3];

// Available commands
const commands = {
  size: getFileSize,
  exists: checkExists,
  readable: checkReadable,
  'human-size': getHumanReadableSize
};

// Main entry point
if (!command || !commands[command]) {
  console.error('Usage: node file-utils.js <command> <file-path>');
  console.error('Commands: ' + Object.keys(commands).join(', '));
  process.exitCode = 1;
  return;
}

if (!filePath) {
  console.error(`Error: file path required for '${command}' command`);
  process.exitCode = 1;
  return;
}

// Execute the requested command
commands[command](filePath);

// Command implementations
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(path.resolve(filePath));
    if (!stats.isFile()) {
      console.error(`Not a file: ${filePath}`);
      process.exitCode = 1;
      return;
    }
    console.log(stats.size);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

function checkExists(filePath) {
  try {
    const exists = fs.existsSync(path.resolve(filePath));
    console.log(exists ? 'true' : 'false');
    process.exitCode = exists ? 0 : 1;
  } catch (error) {
    console.log('false');
    process.exitCode = 1;
  }
}

function checkReadable(filePath) {
  try {
    fs.accessSync(path.resolve(filePath), fs.constants.R_OK);
    console.log('true');
  } catch (error) {
    console.log('false');
    process.exitCode = 1;
  }
}

function getHumanReadableSize(filePath) {
  try {
    const stats = fs.statSync(path.resolve(filePath));
    if (!stats.isFile()) {
      console.error(`Not a file: ${filePath}`);
      process.exitCode = 1;
      return;
    }
    
    const bytes = stats.size;
    const units = ['B', 'K', 'M', 'G', 'T'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    // Format similar to ls -lh output
    if (unitIndex === 0) {
      console.log(`${bytes}B`);
    } else if (size >= 10) {
      console.log(`${Math.round(size)}${units[unitIndex]}`);
    } else {
      console.log(`${size.toFixed(1)}${units[unitIndex]}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}