#!/usr/bin/env node

/**
 * Test script for label sanitization fix
 * Tests that no "ai-" labels can be created
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Label Sanitization Fix\n');

// Read the compiled bundle
const bundlePath = path.join(__dirname, '../../dist/Code.gs');
const bundleCode = fs.readFileSync(bundlePath, 'utf8');

// Extract the relevant functions
const mapAILabelVariantsMatch = bundleCode.match(/function mapAILabelVariants\(labelName\)[\s\S]*?return labelName;\s*}/);
const preventAiDashLabelMatch = bundleCode.match(/function preventAiDashLabel\(labelName\)[\s\S]*?return mapped;\s*\}/);
const sanitizeGmailLabelMatch = bundleCode.match(/function sanitizeGmailLabel\(labelName\)[\s\S]*?return sanitized;\s*\}/);

if (!mapAILabelVariantsMatch || !preventAiDashLabelMatch || !sanitizeGmailLabelMatch) {
  console.error('❌ Could not find required functions in bundle');
  console.error('mapAILabelVariants:', !!mapAILabelVariantsMatch);
  console.error('preventAiDashLabel:', !!preventAiDashLabelMatch);
  console.error('sanitizeGmailLabel:', !!sanitizeGmailLabelMatch);
  process.exit(1);
}

// Create test environment
const Config = {
  LABELS: {
    AI_PROCESSED: 'ai✓',
    AI_ERROR: 'aiX'
  }
};

// Execute the functions
eval(mapAILabelVariantsMatch[0]);
eval(preventAiDashLabelMatch[0]);
eval(sanitizeGmailLabelMatch[0]);

// Test cases
const testCases = [
  // AI_PROCESSED variants
  { input: 'ai_processed', expected: 'ai✓', description: 'ai_processed → ai✓' },
  { input: 'ai processed', expected: 'ai✓', description: 'ai processed → ai✓' },
  { input: 'ai:processed', expected: 'ai✓', description: 'ai:processed → ai✓' },
  { input: 'ai-processed', expected: 'ai✓', description: 'ai-processed → ai✓' },
  { input: 'aiprocessed', expected: 'ai✓', description: 'aiprocessed → ai✓' },
  { input: 'processed', expected: 'ai✓', description: 'processed → ai✓' },
  { input: 'AI_PROCESSED', expected: 'ai✓', description: 'AI_PROCESSED → ai✓' },
  
  // AI_ERROR variants
  { input: 'ai_error', expected: 'aiX', description: 'ai_error → aiX' },
  { input: 'ai error', expected: 'aiX', description: 'ai error → aiX' },
  { input: 'ai:error', expected: 'aiX', description: 'ai:error → aiX' },
  { input: 'ai-error', expected: 'aiX', description: 'ai-error → aiX' },
  { input: 'aierror', expected: 'aiX', description: 'aierror → aiX' },
  { input: 'error', expected: 'aiX', description: 'error → aiX' },
  { input: 'AI_ERROR', expected: 'aiX', description: 'AI_ERROR → aiX' },
  
  // Regular labels should be preserved
  { input: 'Support', expected: 'Support', description: 'Support → Support' },
  { input: 'Customer Service', expected: 'Customer Service', description: 'Customer Service → Customer Service' },
  { input: 'Bug Report', expected: 'Bug Report', description: 'Bug Report → Bug Report' },
  
  // Special character tests - should NOT create "ai-" labels
  { input: 'ai@processed', expected: 'ai✓', description: 'ai@processed → ai✓ (NOT ai-processed)' },
  { input: 'ai#error', expected: 'aiX', description: 'ai#error → aiX (NOT ai-error)' },
  { input: 'ai!test', expected: 'Label_ai-test', description: 'ai!test → Label_ai!test (prevents ai-test)' },
  { input: 'Test@Label', expected: 'Test-Label', description: 'Test@Label → Test-Label' },
  
  // Edge cases
  { input: '', expected: 'Untitled', description: 'Empty string → Untitled' },
  { input: '   ', expected: 'Untitled', description: 'Whitespace → Untitled' },
];

let passed = 0;
let failed = 0;

console.log('Running tests...\n');

testCases.forEach(test => {
  const result = sanitizeGmailLabel(test.input);
  const success = result === test.expected;
  
  if (success) {
    console.log(`✅ ${test.description}`);
    passed++;
  } else {
    console.log(`❌ ${test.description}`);
    console.log(`   Expected: "${test.expected}"`);
    console.log(`   Got: "${result}"`);
    failed++;
  }
});

// Additional test: ensure NO input can create an "ai-" label
console.log('\n🔍 Testing that NO input creates "ai-" labels...\n');

const dangerousInputs = [
  'ai@processed', 'ai#error', 'ai!label', 'ai$test', 'ai%check',
  'ai^power', 'ai&test', 'ai*star', 'ai(paren', 'ai)close',
  'ai+plus', 'ai=equals', 'ai[bracket', 'ai]close', 'ai{brace',
  'ai}close', 'ai|pipe', 'ai\\backslash', 'ai;semicolon', 'ai\'quote',
  'ai"doublequote', 'ai<less', 'ai>greater', 'ai?question', 'ai,comma'
];

let aiDashCreated = 0;
dangerousInputs.forEach(input => {
  const result = sanitizeGmailLabel(input);
  if (result.startsWith('ai-')) {
    console.log(`❌ DANGER: "${input}" created "${result}"`);
    aiDashCreated++;
    failed++;
  }
});

if (aiDashCreated === 0) {
  console.log('✅ No inputs created "ai-" labels');
  passed++;
}

// Summary
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Label sanitization fix has issues!');
  process.exit(1);
} else {
  console.log('✅ Label sanitization fix is working correctly!');
  console.log('🎯 AI label variants are properly mapped to ai✓ and aiX');
  console.log('🚫 No "ai-" labels can be created');
}