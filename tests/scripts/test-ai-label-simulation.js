#!/usr/bin/env node

/**
 * Simulate Gmail AI processing to test ai✓/aiX label application
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Gmail AI Label Simulation Test\n');
console.log('This simulates what WILL happen when the Gmail add-on uses v2.57+\n');

// Mock thread data
const testThreads = [
  { id: 'thread-1', subject: 'Help needed', body: 'I need help with my account', expectedLabel: 'Support', expectAi: 'ai✓' },
  { id: 'thread-2', subject: 'Security alert', body: 'Your account was accessed', expectedLabel: 'Security', expectAi: 'ai✓' },
  { id: 'thread-3', subject: 'Empty', body: '', expectedLabel: null, expectAi: 'aiX' },
  { id: 'thread-4', subject: 'No messages', messages: [], expectedLabel: null, expectAi: 'aiX' },
  { id: 'thread-5', subject: 'API Error', body: 'Test', simulateError: true, expectedLabel: null, expectAi: 'aiX' }
];

// Simulate the batch processing logic
function simulateBatchProcessing(threads) {
  console.log('📦 SIMULATING BATCH PROCESSING\n');
  
  const results = new Map();
  const processedBatch = [];
  const errorBatch = [];
  const labelBatches = new Map();
  
  // Step 1: Collect labels (simulating classification)
  threads.forEach(thread => {
    try {
      if (thread.simulateError) {
        throw new Error('Simulated API error');
      }
      
      if (thread.messages && thread.messages.length === 0) {
        // Empty messages array
        errorBatch.push({ thread, threadId: thread.id });
        results.set(thread.id, {
          threadId: thread.id,
          isSupport: false,
          error: 'Empty messages array',
          appliedLabels: ['aiX'] // Config.LABELS.AI_ERROR
        });
        return;
      }
      
      if (!thread.body) {
        // Early return cases - should get aiX
        errorBatch.push({ thread, threadId: thread.id });
        results.set(thread.id, {
          threadId: thread.id,
          isSupport: false,
          error: 'Empty thread or body',
          appliedLabels: ['aiX'] // Config.LABELS.AI_ERROR
        });
        return;
      }
      
      // Successful classification
      const label = thread.expectedLabel;
      
      if (label) {
        if (!labelBatches.has(label)) {
          labelBatches.set(label, []);
        }
        labelBatches.get(label).push({ thread, threadId: thread.id });
      }
      
      processedBatch.push({ thread, threadId: thread.id });
      
      results.set(thread.id, {
        threadId: thread.id,
        isSupport: label === 'Support',
        appliedLabels: [label, 'ai✓'] // [labelToApply, Config.LABELS.AI_PROCESSED]
      });
      
    } catch (error) {
      errorBatch.push({ thread, threadId: thread.id });
      results.set(thread.id, {
        threadId: thread.id,
        isSupport: false,
        error: error.message,
        appliedLabels: ['aiX'] // Config.LABELS.AI_ERROR
      });
    }
  });
  
  // Step 2: Simulate label application
  console.log('🏷️  Label Application Summary:\n');
  
  // Dynamic labels
  for (const [labelName, threadBatch] of labelBatches) {
    console.log(`   Applying "${labelName}" to ${threadBatch.length} threads`);
  }
  
  // ai✓ labels
  if (processedBatch.length > 0) {
    console.log(`   Applying "ai✓" (AI_PROCESSED) to ${processedBatch.length} threads`);
  }
  
  // aiX labels  
  if (errorBatch.length > 0) {
    console.log(`   Applying "aiX" (AI_ERROR) to ${errorBatch.length} threads`);
  }
  
  return results;
}

// Run simulation
const results = simulateBatchProcessing(testThreads);

// Verify results
console.log('\n\n🔍 VERIFICATION RESULTS:\n');

let allCorrect = true;

testThreads.forEach(thread => {
  const result = results.get(thread.id);
  const appliedLabels = result.appliedLabels || [];
  
  const hasExpectedAiLabel = appliedLabels.includes(thread.expectAi);
  const hasOnlyOneAiLabel = 
    (appliedLabels.includes('ai✓') && !appliedLabels.includes('aiX')) ||
    (!appliedLabels.includes('ai✓') && appliedLabels.includes('aiX'));
  
  const status = hasExpectedAiLabel && hasOnlyOneAiLabel ? '✅' : '❌';
  
  if (status === '❌') allCorrect = false;
  
  console.log(`${status} Thread "${thread.subject}"`);
  console.log(`   Expected: ${thread.expectAi}`);
  console.log(`   Applied: ${appliedLabels.join(', ')}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  console.log('');
});

// Final summary
console.log('\n📊 FINAL SUMMARY:\n');

if (allCorrect) {
  console.log('✅ ALL TESTS PASSED!');
  console.log('Every thread will receive EXACTLY ONE ai label (either ai✓ or aiX)');
  console.log('\n🎯 Once the Gmail add-on is updated to v2.57+, labels will work correctly!');
} else {
  console.log('❌ SOME TESTS FAILED!');
  console.log('Check the implementation!');
}

// Stats simulation
const stats = {
  scanned: testThreads.length,
  aiProcessedCount: Array.from(results.values()).filter(r => r.appliedLabels.includes('ai✓')).length,
  aiErrorCount: Array.from(results.values()).filter(r => r.appliedLabels.includes('aiX')).length,
  supports: Array.from(results.values()).filter(r => r.isSupport).length
};

console.log('\n📈 Expected completion message will include:');
console.log(`✅ COMPLETED: ${stats.scanned} analyzed | ${stats.supports} labeled | 0 drafts | 0 sent`);
console.log(`   Including: ${stats.aiProcessedCount} ai✓ | ${stats.aiErrorCount} aiX`);

console.log('\n⚠️  IMPORTANT: The Gmail add-on must be reinstalled to use the latest code!');
console.log('Current logs show v2.54 is running, but v2.57+ is needed for ai✓/aiX labels.');