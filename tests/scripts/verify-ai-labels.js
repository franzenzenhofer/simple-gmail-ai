/**
 * Verify ai✓/aiX labels are being applied
 */

const fs = require('fs');
const path = require('path');

// Read the gmail.ts file
const gmailPath = path.join(__dirname, '../../src/modules/gmail.ts');
const gmailContent = fs.readFileSync(gmailPath, 'utf8');

console.log('🔍 Verifying ai✓/aiX label enforcement...\n');

// Check 1: Verify appliedLabels includes AI_PROCESSED and AI_ERROR
const appliedLabelsChecks = [
  {
    pattern: /appliedLabels:\s*\[[^\]]*Config\.LABELS\.AI_PROCESSED/g,
    description: 'AI_PROCESSED (ai✓) in appliedLabels'
  },
  {
    pattern: /appliedLabels:\s*\[[^\]]*Config\.LABELS\.AI_ERROR/g,
    description: 'AI_ERROR (aiX) in appliedLabels'
  }
];

appliedLabelsChecks.forEach(check => {
  const matches = gmailContent.match(check.pattern);
  if (matches) {
    console.log(`✅ Found ${matches.length} instances of ${check.description}`);
    matches.forEach((match, i) => {
      const lineNum = gmailContent.substring(0, gmailContent.indexOf(match)).split('\n').length;
      console.log(`   Line ${lineNum}: ${match.trim()}`);
    });
  } else {
    console.log(`❌ NO instances of ${check.description} found!`);
  }
  console.log('');
});

// Check 2: Verify batch label application
console.log('🔍 Checking batch label application...\n');

const batchChecks = [
  {
    pattern: /processedBatch\.forEach.*thread\.addLabel\(processedLabel\)/gs,
    description: 'Batch application of processedLabel (ai✓)'
  },
  {
    pattern: /errorBatch\.forEach.*thread\.addLabel\(errorLabel\)/gs,
    description: 'Batch application of errorLabel (aiX)'
  }
];

batchChecks.forEach(check => {
  const matches = gmailContent.match(check.pattern);
  if (matches) {
    console.log(`✅ Found batch label application: ${check.description}`);
  } else {
    console.log(`❌ NO batch label application found: ${check.description}`);
  }
});

// Check 3: Verify early returns have aiX labels
console.log('\n🔍 Checking early returns have error labels...\n');

const earlyReturnChecks = [
  {
    pattern: /messages\.length === 0.*?thread\.addLabel.*?AI_ERROR/gs,
    description: 'Empty messages array gets aiX'
  },
  {
    pattern: /getPlainBody.*?trim.*?!body.*?thread\.addLabel.*?AI_ERROR/gs,
    description: 'Empty body gets aiX'
  }
];

earlyReturnChecks.forEach(check => {
  const matches = gmailContent.match(check.pattern);
  if (matches) {
    console.log(`✅ Early return properly labeled: ${check.description}`);
  } else {
    console.log(`⚠️  Check manually: ${check.description}`);
  }
});

// Check 4: Verify individual thread processing
console.log('\n🔍 Checking individual thread processing...\n');

const individualChecks = [
  {
    pattern: /!hasError && shouldApplyLabels.*?thread\.addLabel\(processedLabel\)/gs,
    description: 'Success path applies ai✓'
  },
  {
    pattern: /catch.*error.*?thread\.addLabel.*?errorLabel/gs,
    description: 'Error path applies aiX'
  }
];

individualChecks.forEach(check => {
  const matches = gmailContent.match(check.pattern);
  if (matches) {
    console.log(`✅ Individual processing: ${check.description}`);
  } else {
    console.log(`❌ MISSING: ${check.description}`);
  }
});

// Summary
console.log('\n📊 SUMMARY:\n');
console.log('The code SHOULD enforce that EVERY processed email gets either ai✓ or aiX.');
console.log('If the labels are not appearing in Gmail, check:');
console.log('1. The Gmail add-on is using the latest deployment (@HEAD or latest version)');
console.log('2. Clear browser cache and reload Gmail');
console.log('3. Check if there are any errors in the execution logs');
console.log('4. Verify Config.LABELS.AI_PROCESSED = "ai✓" and Config.LABELS.AI_ERROR = "aiX"');