#!/usr/bin/env node

/**
 * Strip existing header comments from bundled file
 * More robust than using tail -n +X
 */

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node strip-header.js <file-path>');
  process.exitCode = 1;
  return;
}

try {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find the end of the header comment block
  // Look for the closing */ of a multi-line comment at the start
  const headerMatch = content.match(/^\/\*\*[\s\S]*?\*\//);
  
  let strippedContent;
  if (headerMatch) {
    // Remove the header comment and any immediately following empty lines
    strippedContent = content
      .substring(headerMatch[0].length)
      .replace(/^[\r\n]+/, '');
  } else {
    // No header found, return original content
    strippedContent = content;
  }
  
  // Output the content without header
  console.log(strippedContent);
  
} catch (error) {
  console.error(`Error processing file: ${error.message}`);
  process.exitCode = 1;
}