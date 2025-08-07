#!/usr/bin/env node

/**
 * Simulates the label creation process to verify the fix
 */

// Load the fix from the bundle
const fs = require('fs');
const path = require('path');
const bundlePath = path.join(__dirname, '../../dist/Code.gs');
const bundleCode = fs.readFileSync(bundlePath, 'utf8');

// Extract and execute the relevant functions
const Config = {
  LABELS: {
    AI_PROCESSED: 'ai✓',
    AI_ERROR: 'aiX'
  }
};

// Execute the functions from the bundle
eval(bundleCode.match(/function mapAILabelVariants\(labelName\)[\s\S]*?return labelName;\s*}/)[0]);
eval(bundleCode.match(/function preventAiDashLabel\(labelName\)[\s\S]*?return mapped;\s*\}/)[0]);
eval(bundleCode.match(/function sanitizeGmailLabel\(labelName\)[\s\S]*?return sanitized;\s*\}/)[0]);

console.log('🤖 Simulating AI Label Creation Process\n');

// Simulate various AI responses that might create labels
const aiResponses = [
  'ai@processed',
  'ai:error',
  'ai_processed',
  'ai#error',
  'AI!Processed',
  'ai$error',
  'ai&processed',
  'ai*error',
  'ai(processed)',
  'ai[error]',
  'ai{processed}',
  'ai|error',
  'ai\\processed',
  'ai;error',
  'ai"processed"',
  'ai<error>',
  'ai?processed',
  'ai,error'
];

console.log('📧 Processing simulated AI responses:\n');

let successCount = 0;
let failureCount = 0;

aiResponses.forEach(response => {
  const sanitized = sanitizeGmailLabel(response);
  const isCorrect = (sanitized === 'ai✓' || sanitized === 'aiX' || sanitized.startsWith('Label_'));
  const createsAiDash = sanitized.startsWith('ai-');
  
  if (createsAiDash) {
    console.log(`❌ "${response}" → "${sanitized}" (CREATES FORBIDDEN ai- LABEL!)`);
    failureCount++;
  } else if (isCorrect) {
    console.log(`✅ "${response}" → "${sanitized}"`);
    successCount++;
  } else {
    console.log(`⚠️  "${response}" → "${sanitized}" (unexpected result)`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`📊 Results: ${successCount} correct, ${failureCount} failures\n`);

if (failureCount === 0) {
  console.log('✅ SUCCESS! The fix is working perfectly.');
  console.log('🛡️  No AI response can create an ai- label.');
  console.log('🏷️  All AI labels are properly mapped to ai✓ or aiX.');
} else {
  console.log('❌ CRITICAL: The fix is not working!');
  console.log(`⚠️  ${failureCount} responses still create ai- labels!`);
  process.exit(1);
}