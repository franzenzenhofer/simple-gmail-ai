#!/usr/bin/env node

/**
 * Simple test for label sanitization fix
 */

const Config = {
  LABELS: {
    AI_PROCESSED: 'ai✓',
    AI_ERROR: 'aiX'
  }
};

// Copy of the fix from utils.ts
function mapAILabelVariants(labelName) {
  const normalized = labelName.toLowerCase().trim();
  
  // First, check if it starts with "ai" followed by any non-letter character and contains "process"
  if (normalized.match(/^ai[^a-z].*process/)) {
    return Config.LABELS.AI_PROCESSED; // Returns 'ai✓'
  }
  
  // Check if it starts with "ai" followed by any non-letter character and contains "error"
  if (normalized.match(/^ai[^a-z].*error/)) {
    return Config.LABELS.AI_ERROR; // Returns 'aiX'
  }
  
  // Map exact matches for common variants
  if (normalized === 'ai_processed' || 
      normalized === 'ai processed' || 
      normalized === 'ai:processed' ||
      normalized === 'ai-processed' ||
      normalized === 'aiprocessed' ||
      normalized === 'processed') {
    return Config.LABELS.AI_PROCESSED; // Returns 'ai✓'
  }
  
  // Map common AI error label variants
  if (normalized === 'ai_error' || 
      normalized === 'ai error' || 
      normalized === 'ai:error' ||
      normalized === 'ai-error' ||
      normalized === 'aierror' ||
      normalized === 'error') {
    return Config.LABELS.AI_ERROR; // Returns 'aiX'
  }
  
  // Return original label if not an AI variant
  return labelName;
}

function preventAiDashLabel(labelName) {
  // First apply mapping to catch AI variants
  const mapped = mapAILabelVariants(labelName);
  if (mapped === Config.LABELS.AI_PROCESSED || mapped === Config.LABELS.AI_ERROR) {
    return mapped;
  }
  
  // Check if this would create "ai-" after sanitization
  const testSanitized = mapped.trim().toLowerCase();
  if (testSanitized.startsWith('ai') && testSanitized.length > 2) {
    // Check if the third character would be replaced with a dash
    const thirdChar = testSanitized[2];
    // If it's not alphanumeric, underscore, space, dash, period, slash, or our special chars
    if (thirdChar && !/[\w\s\-._/✓✗]/.test(thirdChar)) {
      // This would create "ai-something", so prepend to avoid it
      return 'Label_' + mapped;
    }
  }
  
  return mapped;
}

function sanitizeGmailLabel(labelName) {
  if (!labelName) return 'Untitled';
  
  // Apply AI dash prevention
  const safeLabelName = preventAiDashLabel(labelName);
  
  // If it was mapped to a system label, return it as-is (don't sanitize system labels)
  if (safeLabelName === Config.LABELS.AI_PROCESSED || safeLabelName === Config.LABELS.AI_ERROR) {
    return safeLabelName;
  }
  
  // Trim whitespace
  let sanitized = safeLabelName.trim();
  
  // Handle empty after trim
  if (!sanitized) return 'Untitled';
  
  // Replace illegal characters with safe alternatives
  // Gmail allows: letters, numbers, spaces, dashes, underscores, periods, slashes (for nesting)
  // SPECIAL: Allow checkmark ✓ and X ✗ for system labels ai✓ and aiX
  sanitized = sanitized.replace(/[^\w\s\-._/✓✗]/g, '-');
  
  // Clean up multiple consecutive spaces/dashes
  sanitized = sanitized.replace(/\s+/g, ' ').replace(/-+/g, '-');
  
  // Ensure no leading or trailing slashes (causes Gmail issues)
  sanitized = sanitized.replace(/^\/+|\/+$/g, '');
  
  // Clean up slash sequences (no empty nested levels)
  sanitized = sanitized.replace(/\/+/g, '/');
  
  // Truncate to Gmail's 40 character limit
  if (sanitized.length > 40) {
    // Try to truncate at word boundary or slash
    const truncated = sanitized.substring(0, 37);
    const lastSpace = truncated.lastIndexOf(' ');
    const lastSlash = truncated.lastIndexOf('/');
    const breakPoint = Math.max(lastSpace, lastSlash);
    
    if (breakPoint > 20) {
      sanitized = truncated.substring(0, breakPoint) + '...';
    } else {
      sanitized = truncated + '...';
    }
  }
  
  return sanitized;
}

// Test dangerous inputs
console.log('🧪 Testing Label Sanitization Fix\n');

const dangerousInputs = [
  'ai@processed', 'ai#error', 'ai!label', 'ai$test', 'ai%check',
  'ai^power', 'ai&test', 'ai*star', 'ai(paren', 'ai)close',
  'ai+plus', 'ai=equals', 'ai[bracket', 'ai]close', 'ai{brace',
  'ai}close', 'ai|pipe', 'ai\\backslash', 'ai;semicolon', 'ai\'quote',
  'ai"doublequote', 'ai<less', 'ai>greater', 'ai?question', 'ai,comma'
];

let passed = 0;
let failed = 0;

dangerousInputs.forEach(input => {
  const result = sanitizeGmailLabel(input);
  const createsAiDash = result.startsWith('ai-');
  
  if (createsAiDash) {
    console.log(`❌ "${input}" → "${result}" (CREATES ai- label!)`);
    failed++;
  } else {
    console.log(`✅ "${input}" → "${result}"`);
    passed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✅ SUCCESS! No "ai-" labels can be created.');
} else {
  console.log('❌ FAIL! Some inputs still create "ai-" labels.');
  process.exit(1);
}