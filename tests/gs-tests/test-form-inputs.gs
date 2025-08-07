/**
 * Test file to verify form input handling in different scenarios
 */

function testFormInputHandling() {
  console.log('=== Testing Form Input Handling ===');
  
  // Test Case 1: Standard e.formInput format
  const test1 = {
    formInput: {
      apiKey: 'test-api-key-1',
      mode: 'label',
      prompt1: 'Test prompt 1'
    }
  };
  testRunAnalysis(test1, 'Test 1: e.formInput format');
  
  // Test Case 2: e.formInputs array format
  const test2 = {
    formInputs: {
      apiKey: ['test-api-key-2'],
      mode: ['draft'],
      prompt1: ['Test prompt 2']
    }
  };
  testRunAnalysis(test2, 'Test 2: e.formInputs array format');
  
  // Test Case 3: e.formInputs object format
  const test3 = {
    formInputs: {
      apiKey: {
        stringValues: ['test-api-key-3']
      },
      mode: {
        stringValues: ['label']
      }
    }
  };
  testRunAnalysis(test3, 'Test 3: e.formInputs object format');
  
  // Test Case 4: Empty form (should use saved API key)
  const test4 = {
    formInput: {},
    formInputs: {}
  };
  testRunAnalysis(test4, 'Test 4: Empty form (fallback to saved)');
  
  // Test Case 5: Mixed format
  const test5 = {
    formInput: {
      apiKey: 'formInput-key'
    },
    formInputs: {
      mode: ['draft'],
      prompt1: {
        stringValues: ['Mixed format prompt']
      }
    }
  };
  testRunAnalysis(test5, 'Test 5: Mixed format');
}

function testRunAnalysis(mockEvent, testName) {
  console.log('\n--- ' + testName + ' ---');
  try {
    // Mock the minimal required event structure
    const e = mockEvent;
    
    // Extract values using the same logic as runAnalysis
    const formInput = e.formInput || {};
    const formInputs = e.formInputs || {};
    
    let apiKey = formInput.apiKey || 
                 (formInputs.apiKey && formInputs.apiKey[0]) ||
                 getFormValue(formInputs, 'apiKey');
    
    const mode = formInput.mode || getFormValue(formInputs, 'mode', 'label');
    const prompt1 = formInput.prompt1 || getFormValue(formInputs, 'prompt1', 'default');
    
    console.log('Extracted values:');
    console.log('  apiKey:', apiKey || '(empty)');
    console.log('  mode:', mode);
    console.log('  prompt1:', prompt1);
    console.log('Result: ' + (apiKey ? 'SUCCESS' : 'WOULD USE SAVED KEY'));
    
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

// Run the tests
testFormInputHandling();