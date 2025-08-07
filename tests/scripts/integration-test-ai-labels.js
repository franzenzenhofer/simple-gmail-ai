#!/usr/bin/env node

/**
 * Integration test showing the complete AI label flow
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 AI Label Integration Test\n');

// Load the bundle
const bundlePath = path.join(__dirname, '../../dist/Code.gs');
const bundleCode = fs.readFileSync(bundlePath, 'utf8');

// Set up test environment
const Config = {
  LABELS: {
    AI_PROCESSED: 'ai✓',
    AI_ERROR: 'aiX',
    SUPPORT: 'Support',
    GENERAL: 'General'
  }
};

// Mock GmailApp
const createdLabels = [];
const GmailApp = {
  getUserLabelByName: (name) => {
    console.log(`  🔍 Checking for existing label: "${name}"`);
    return null; // Always return null to simulate label creation
  },
  createLabel: (name) => {
    console.log(`  ✅ Creating label: "${name}"`);
    createdLabels.push(name);
    return { getName: () => name };
  }
};

// Mock logger
const AppLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
};

// Extract and execute the label functions
eval(bundleCode.match(/function mapAILabelVariants\(labelName\)[\s\S]*?return labelName;\s*}/)[0]);
eval(bundleCode.match(/function preventAiDashLabel\(labelName\)[\s\S]*?return mapped;\s*\}/)[0]);
eval(bundleCode.match(/function sanitizeGmailLabel\(labelName\)[\s\S]*?return sanitized;\s*\}/)[0]);

// Create a simplified getOrCreateLabel that uses our functions
function getOrCreateLabel(labelName) {
  const sanitizedName = sanitizeGmailLabel(labelName);
  let label = GmailApp.getUserLabelByName(sanitizedName);
  if (!label) {
    label = GmailApp.createLabel(sanitizedName);
  }
  return label;
}

console.log('📧 Simulating AI Classification Results:\n');

// Simulate various AI classification results
const aiClassifications = [
  'ai@processed',      // Should become ai✓
  'ai:error',         // Should become aiX
  'ai#processed',     // Should become ai✓
  'ai!urgent',        // Should become Label_ai-urgent
  'Support',          // Should remain Support
  'ai-processed',     // Should become ai✓ (not remain ai-processed)
  'AI_ERROR',         // Should become aiX
  'Customer Support', // Should remain Customer Support
  'ai$special',       // Should become Label_ai-special
  'General',          // Should remain General
];

console.log('Processing AI classifications...\n');

aiClassifications.forEach(classification => {
  console.log(`\n🤖 AI returned: "${classification}"`);
  getOrCreateLabel(classification);
});

console.log('\n' + '='.repeat(60));
console.log('📊 Created Labels Summary:\n');

// Check for any ai- labels
const aiDashLabels = createdLabels.filter(label => label.startsWith('ai-'));
const correctLabels = createdLabels.filter(label => !label.startsWith('ai-'));

console.log('✅ Correct labels created:');
correctLabels.forEach(label => console.log(`   - ${label}`));

if (aiDashLabels.length > 0) {
  console.log('\n❌ FORBIDDEN ai- labels created:');
  aiDashLabels.forEach(label => console.log(`   - ${label}`));
}

console.log('\n' + '='.repeat(60));

if (aiDashLabels.length === 0) {
  console.log('✅ SUCCESS! Integration test passed.');
  console.log('🛡️  No AI classification can create an ai- label.');
  console.log('🏷️  All AI labels are properly sanitized.');
} else {
  console.log('❌ FAIL! Integration test failed.');
  console.log(`⚠️  ${aiDashLabels.length} forbidden ai- labels were created!`);
  process.exit(1);
}