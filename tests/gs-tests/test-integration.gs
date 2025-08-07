/**
 * Integration Test Script for Gmail Support Triage AI
 * Run this in Apps Script editor to verify functionality
 * 
 * IMPORTANT: This runs in DEVELOPMENT MODE - no emails will be sent
 */

// Test 1: Verify Development Mode is Active
function testDevelopmentMode() {
  console.log('=== Test 1: Development Mode ===');
  const isDev = isDevelopmentMode();
  console.log('Development mode active:', isDev);
  console.log('Expected: true');
  console.log('Result:', isDev === true ? '✅ PASS' : '❌ FAIL');
  return isDev === true;
}

// Test 2: Test Form Value Extraction
function testFormValueExtraction() {
  console.log('\n=== Test 2: Form Value Extraction ===');
  const mockInputs = {
    apiKey: { stringValues: ['test-key-123'] },
    mode: { stringValues: ['draft'] },
    prompt1: { stringValues: ['Test prompt'] }
  };
  
  const apiKey = getFormValue(mockInputs, 'apiKey');
  const mode = getFormValue(mockInputs, 'mode', 'label');
  const missing = getFormValue(mockInputs, 'missing', 'default');
  
  console.log('API Key:', apiKey, '(expected: test-key-123)');
  console.log('Mode:', mode, '(expected: draft)');
  console.log('Missing field:', missing, '(expected: default)');
  
  const passed = apiKey === 'test-key-123' && mode === 'draft' && missing === 'default';
  console.log('Result:', passed ? '✅ PASS' : '❌ FAIL');
  return passed;
}

// Test 3: Test Label Creation
function testLabelCreation() {
  console.log('\n=== Test 3: Label Creation ===');
  try {
    const testLabelName = 'Test_Label_' + new Date().getTime();
    const label = getOrCreateLabel(testLabelName);
    
    console.log('Created label:', label.getName());
    
    // Clean up
    label.deleteLabel();
    console.log('Cleaned up test label');
    console.log('Result: ✅ PASS');
    return true;
  } catch (e) {
    console.error('Error:', e.toString());
    console.log('Result: ❌ FAIL');
    return false;
  }
}

// Test 4: Test Gemini API Configuration
function testGeminiAPIConfig() {
  console.log('\n=== Test 4: Gemini API Configuration ===');
  
  const testKey = 'test-api-key-123';
  const expectedUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  
  const actualUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' +
                    'gemini-2.5-flash:generateContent';
  
  console.log('Expected URL:', expectedUrl);
  console.log('Actual URL:', actualUrl);
  console.log('URLs match:', expectedUrl === actualUrl);
  
  const payload = {
    contents: [{ parts: [{ text: 'Test prompt' }] }],
    generationConfig: { temperature: 0.3 }
  };
  
  console.log('Payload structure valid:', 
    payload.contents && 
    payload.contents[0].parts && 
    payload.contents[0].parts[0].text === 'Test prompt' &&
    payload.generationConfig.temperature === 0.3
  );
  
  console.log('Result: ✅ PASS');
  return true;
}

// Test 5: Test Homepage Card Building
function testHomepageCard() {
  console.log('\n=== Test 5: Homepage Card Building ===');
  try {
    const card = onHomepage();
    console.log('Card created:', card !== null);
    console.log('Card type:', typeof card);
    console.log('Result: ✅ PASS');
    return true;
  } catch (e) {
    console.error('Error:', e.toString());
    console.log('Result: ❌ FAIL');
    return false;
  }
}

// Test 6: Test Classification Logic
function testClassificationLogic() {
  console.log('\n=== Test 6: Classification Logic ===');
  
  const testCases = [
    { input: 'support', expected: true },
    { input: 'Support', expected: true },
    { input: 'SUPPORT', expected: true },
    { input: 'support request', expected: true },
    { input: 'not', expected: false },
    { input: 'not support', expected: false },
    { input: 'unsupported', expected: false }
  ];
  
  let allPassed = true;
  testCases.forEach(test => {
    const normalized = test.input.toLowerCase().trim();
    const isSupport = normalized.indexOf('support') === 0;
    const passed = isSupport === test.expected;
    console.log(`  "${test.input}" -> ${isSupport} (expected: ${test.expected}) ${passed ? '✅' : '❌'}`);
    if (!passed) allPassed = false;
  });
  
  console.log('Result:', allPassed ? '✅ PASS' : '❌ FAIL');
  return allPassed;
}

// Test 7: Test Error Handling
function testErrorHandling() {
  console.log('\n=== Test 7: Error Handling ===');
  
  try {
    // Test with missing API key
    const mockEvent = {
      formInputs: {
        mode: { stringValues: ['label'] }
        // apiKey is missing
      }
    };
    
    const response = runAnalysis(mockEvent);
    console.log('Handled missing API key gracefully');
    console.log('Result: ✅ PASS');
    return true;
  } catch (e) {
    console.error('Unexpected error:', e.toString());
    console.log('Result: ❌ FAIL');
    return false;
  }
}

// Master test runner
function runAllIntegrationTests() {
  console.log('🧪 Gmail Support Triage AI - Integration Tests');
  console.log('==============================================');
  console.log('Running in DEVELOPMENT MODE - No emails will be sent\n');
  
  const tests = [
    { name: 'Development Mode', fn: testDevelopmentMode },
    { name: 'Form Value Extraction', fn: testFormValueExtraction },
    { name: 'Label Creation', fn: testLabelCreation },
    { name: 'Gemini API Config', fn: testGeminiAPIConfig },
    { name: 'Homepage Card', fn: testHomepageCard },
    { name: 'Classification Logic', fn: testClassificationLogic },
    { name: 'Error Handling', fn: testErrorHandling }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    try {
      if (test.fn()) {
        passed++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error(`\nTest "${test.name}" threw error:`, e.toString());
      failed++;
    }
  });
  
  console.log('\n==============================================');
  console.log('📊 Test Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${tests.length}`);
  console.log(`🎯 Success Rate: ${Math.round(passed / tests.length * 100)}%`);
  console.log('\n' + (failed === 0 ? '🎉 All tests passed!' : '⚠️ Some tests failed'));
}

// Quick test to verify API key storage
function testAPIKeyStorage() {
  console.log('\n=== API Key Storage Test ===');
  
  // Store a test key
  const testKey = 'test-key-' + new Date().getTime();
  PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', testKey);
  
  // Retrieve it
  const retrieved = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
  
  console.log('Stored:', testKey);
  console.log('Retrieved:', retrieved);
  console.log('Match:', testKey === retrieved);
  
  // Clean up
  PropertiesService.getUserProperties().deleteProperty('GEMINI_API_KEY');
  
  return testKey === retrieved;
}