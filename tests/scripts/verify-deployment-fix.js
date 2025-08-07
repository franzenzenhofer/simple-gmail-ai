#!/usr/bin/env node

/**
 * Verify that the deployed bundle correctly prevents ai- label creation
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Deployment Fix for ai- Labels\n');

// Read the deployed bundle
const bundlePath = path.join(__dirname, '../../dist/Code.gs');
if (!fs.existsSync(bundlePath)) {
  console.error('❌ Bundle not found at:', bundlePath);
  process.exit(1);
}

const bundleCode = fs.readFileSync(bundlePath, 'utf8');

// Check for the fix functions
const hasMappingFunction = bundleCode.includes('function mapAILabelVariants');
const hasPreventFunction = bundleCode.includes('function preventAiDashLabel');
const hasSanitizeUpdate = bundleCode.includes('preventAiDashLabel(labelName)');

console.log('📋 Function Verification:');
console.log(`  ${hasMappingFunction ? '✅' : '❌'} mapAILabelVariants function exists`);
console.log(`  ${hasPreventFunction ? '✅' : '❌'} preventAiDashLabel function exists`);
console.log(`  ${hasSanitizeUpdate ? '✅' : '❌'} sanitizeGmailLabel calls preventAiDashLabel`);

// Check for correct mappings
const hasProcessedMapping = bundleCode.includes("normalized === 'ai-processed'");
const hasErrorMapping = bundleCode.includes("normalized === 'ai-error'");
const returnsCorrectLabels = bundleCode.includes("return Config.LABELS.AI_PROCESSED") && 
                             bundleCode.includes("return Config.LABELS.AI_ERROR");

console.log('\n📋 Label Mapping Verification:');
console.log(`  ${hasProcessedMapping ? '✅' : '❌'} Maps ai-processed to ai✓`);
console.log(`  ${hasErrorMapping ? '✅' : '❌'} Maps ai-error to aiX`);
console.log(`  ${returnsCorrectLabels ? '✅' : '❌'} Returns correct system labels`);

// Check for obsolete label filtering
const hasObsoleteFilter = bundleCode.includes("filterObsoleteLabels");
const filtersAiDash = bundleCode.includes("if (label.startsWith('ai-'))");

console.log('\n📋 Legacy Label Handling:');
console.log(`  ${hasObsoleteFilter ? '✅' : '❌'} filterObsoleteLabels function exists`);
console.log(`  ${filtersAiDash ? '✅' : '❌'} Filters out ai- labels`);

// Verify no hardcoded ai- labels remain (except in mapping/filtering logic)
const lines = bundleCode.split('\n');
const problematicLines = [];
lines.forEach((line, index) => {
  // Skip lines that are part of the fix or comments
  if (line.includes('normalized ===') || 
      line.includes('filterObsoleteLabels') ||
      line.includes('Filtering out obsolete label') ||
      line.includes('// Old format:') ||
      line.includes('// If it starts with') ||
      line.includes('// This would create') ||
      line.trim().startsWith('//') ||
      line.trim().startsWith('*')) {
    return;
  }
  
  // Check for hardcoded ai- labels
  if (line.match(/'ai-[a-z]+'/i) || line.match(/"ai-[a-z]+"/i)) {
    problematicLines.push({ line: index + 1, content: line.trim() });
  }
});

console.log('\n📋 Hardcoded Label Check:');
if (problematicLines.length === 0) {
  console.log('  ✅ No problematic hardcoded ai- labels found');
} else {
  console.log(`  ❌ Found ${problematicLines.length} lines with potential ai- labels:`);
  problematicLines.slice(0, 5).forEach(item => {
    console.log(`     Line ${item.line}: ${item.content.substring(0, 80)}...`);
  });
}

// Overall result
const allChecks = hasMappingFunction && hasPreventFunction && hasSanitizeUpdate &&
                  hasProcessedMapping && hasErrorMapping && returnsCorrectLabels &&
                  hasObsoleteFilter && filtersAiDash && problematicLines.length === 0;

console.log('\n' + '='.repeat(60));
if (allChecks) {
  console.log('✅ DEPLOYMENT VERIFIED: ai- label fix is properly deployed!');
  console.log('🛡️  No new ai- labels can be created');
  console.log('🏷️  All AI labels will be mapped to ai✓ or aiX');
} else {
  console.log('❌ DEPLOYMENT ISSUE: Some checks failed');
  console.log('⚠️  Please review the failed checks above');
  process.exit(1);
}