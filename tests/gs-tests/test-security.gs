// Security Tests for Gmail Support Triage AI

// Test: Ensure API keys are never exposed in URLs
function testAPIKeyNotInURL() {
  console.log('\n=== Security Test: API Key Not In URL ===');
  
  // This test checks that callGemini doesn't put API key in URL
  // We'll need to mock UrlFetchApp to intercept the call
  
  const originalFetch = UrlFetchApp.fetch;
  let capturedUrl = null;
  let capturedOptions = null;
  
  try {
    // Mock UrlFetchApp.fetch
    UrlFetchApp.fetch = function(url, options) {
      capturedUrl = url;
      capturedOptions = options;
      // Return mock response
      return {
        getContentText: function() {
          return JSON.stringify({
            candidates: [{
              content: {
                parts: [{ text: 'mock response' }]
              }
            }]
          });
        }
      };
    };
    
    // Call the function
    const testApiKey = 'super-secret-api-key-12345';
    callGemini(testApiKey, 'test prompt');
    
    // Verify URL doesn't contain API key
    console.log('Captured URL:', capturedUrl);
    console.log('URL contains API key:', capturedUrl.indexOf(testApiKey) !== -1);
    console.log('URL contains "key=" parameter:', capturedUrl.indexOf('key=') !== -1);
    
    if (capturedUrl.indexOf(testApiKey) !== -1) {
      throw new Error('SECURITY VIOLATION: API key found in URL!');
    }
    
    if (capturedUrl.indexOf('key=') !== -1) {
      throw new Error('SECURITY VIOLATION: URL contains key parameter!');
    }
    
    // Check if API key is in headers
    console.log('Headers:', capturedOptions.headers);
    if (!capturedOptions.headers || !capturedOptions.headers['x-goog-api-key']) {
      throw new Error('API key not found in headers!');
    }
    
    console.log('✓ API key is properly secured in headers');
    
  } finally {
    // Restore original function
    UrlFetchApp.fetch = originalFetch;
  }
}

// Test: Ensure no sensitive data in error messages
function testNoSensitiveDataInErrors() {
  console.log('\n=== Security Test: No Sensitive Data In Errors ===');
  
  const originalFetch = UrlFetchApp.fetch;
  
  try {
    // Mock UrlFetchApp.fetch to throw error
    UrlFetchApp.fetch = function(url, options) {
      throw new Error('Network error');
    };
    
    const testApiKey = 'super-secret-api-key-12345';
    
    try {
      callGemini(testApiKey, 'test prompt');
    } catch (error) {
      const errorMessage = error.toString();
      console.log('Error message:', errorMessage);
      
      // Check error doesn't contain API key
      if (errorMessage.indexOf(testApiKey) !== -1) {
        throw new Error('SECURITY VIOLATION: API key exposed in error message!');
      }
      
      console.log('✓ Error message does not contain sensitive data');
    }
    
  } finally {
    // Restore original function
    UrlFetchApp.fetch = originalFetch;
  }
}

// Run all security tests
function runSecurityTests() {
  console.log('====================================');
  console.log('Running Security Tests');
  console.log('====================================');
  
  try {
    testAPIKeyNotInURL();
    testNoSensitiveDataInErrors();
    
    console.log('\n✅ All security tests passed!');
  } catch (error) {
    console.error('\n❌ Security test failed:', error);
    throw error;
  }
}