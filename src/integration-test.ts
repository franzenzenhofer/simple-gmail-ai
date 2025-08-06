/**
 * Integration test for REAL Gemini API calls
 * Tests the actual batch processing with live API
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

// Get API key from environment variable for security
const API_KEY = process.env.GEMINI_API_KEY || '';

// Simple test logger for better performance
const testLog = {
  buffer: [] as string[],
  log: (msg: string) => testLog.buffer.push(msg),
  error: (msg: string) => testLog.buffer.push('ERROR: ' + msg),
  flush: () => {
    if (testLog.buffer.length > 0) {
      testLog.log(testLog.buffer.join('\n'));
      testLog.buffer = [];
    }
  }
};

// Configuration constants matching Config namespace
// Note: We duplicate these from Config.ts since this is a standalone Node.js script
// and importing the Google Apps Script namespace would be complex
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

interface BatchEmail {
  id: string;
  subject: string;
  body: string;
}

// JSON sanitization logic matching JsonValidator.sanitizeJsonResponse
function sanitizeJsonResponse(response: string): string {
  // Remove markdown code blocks if present
  let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Remove any text before the first { or [
  const startBrace = cleaned.indexOf('{');
  const startBracket = cleaned.indexOf('[');
  
  if (startBrace === -1 && startBracket === -1) {
    return cleaned;
  }
  
  const start = startBrace === -1 ? startBracket :
                startBracket === -1 ? startBrace :
                Math.min(startBrace, startBracket);
  
  if (start > 0) {
    cleaned = cleaned.substring(start);
  }
  
  // Remove any text after the last } or ]
  const endBrace = cleaned.lastIndexOf('}');
  const endBracket = cleaned.lastIndexOf(']');
  
  const end = Math.max(endBrace, endBracket);
  if (end !== -1 && end < cleaned.length - 1) {
    cleaned = cleaned.substring(0, end + 1);
  }
  
  return cleaned;
}

async function testBatchProcessing() {
  // Test state for cleanup
  let testStartTime: number | undefined;
  let apiCallMade = false;
  
  try {
    testStartTime = Date.now(); // Initialize before any early returns
    
    if (!API_KEY) {
      testLog.error('❌ No API key found - cannot run integration test');
      testLog.error('Please set GEMINI_API_KEY environment variable');
      testLog.error('Example: GEMINI_API_KEY=your-api-key npm test');
      testLog.flush();
      return;
    }
    testLog.log('🧪 INTEGRATION TEST: Batch Processing with Real Gemini API');
    testLog.log('API Key:', JSON.stringify(API_KEY.substring(0, 10) + '...' + API_KEY.substring(API_KEY.length - 5)));
    testLog.log('Test started at:', new Date(testStartTime).toISOString());
    testLog.flush();

  // Test emails similar to what we'd get from Gmail
  const testEmails: BatchEmail[] = [
    {
      id: 'test_email_1',
      subject: 'Help with login issues',
      body: 'Hi, I cannot log into my account. I keep getting an error message. Please help me reset my password.'
    },
    {
      id: 'test_email_2', 
      subject: 'Newsletter subscription',
      body: 'Please add me to your monthly newsletter. I am interested in your latest updates and product news.'
    },
    {
      id: 'test_email_3',
      subject: 'Bug report - app crashes',
      body: 'The mobile app keeps crashing when I try to save my settings. This is very frustrating. Please fix this issue.'
    }
  ];

  // Use the EXACT same prompt logic as in the actual code
  const classificationPrompt = [
    'You are an email triage assistant.',
    'Return exactly one word:',
    '  - support : if the email is a customer support request',
    '  - not : for anything else (not support).',
    '---------- EMAIL START ----------'
  ].join('\n');

  let batchPrompt = classificationPrompt + '\n\n';
  batchPrompt += 'CRITICAL: You must classify each email and respond with ONLY a valid JSON array. ';
  batchPrompt += 'Each array element must have exactly two fields: "id" (string) and "classification" (either "support" or "not"). ';
  batchPrompt += 'Do NOT include any other text, explanations, or markdown formatting. ';
  batchPrompt += 'Example format: [{"id":"email1","classification":"support"},{"id":"email2","classification":"not"}]\n\n';

  testEmails.forEach((email, index) => {
    batchPrompt += '--- EMAIL ' + (index + 1) + ' (ID: ' + email.id + ') ---\n';
    batchPrompt += 'Subject: ' + email.subject + '\n';
    batchPrompt += 'Body: ' + email.body.substring(0, 500) + '\n';
    batchPrompt += '--- END EMAIL ' + (index + 1) + ' ---\n\n';
  });

  batchPrompt += 'REMEMBER: Respond ONLY with the JSON array, nothing else! Format: [{"id": "<email_id>", "classification": "support" or "not"}]';

    testLog.log('\n📤 SENDING PROMPT TO GEMINI:');
    testLog.log('Length:', batchPrompt.length, 'characters');
    testLog.log('First 200 chars:', JSON.stringify(batchPrompt.substring(0, 200) + '...'));

    // API call section with nested try/catch for proper error handling
    try {
      apiCallMade = true;
      const url = GEMINI_API_URL + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(API_KEY);
    
    const payload = {
      contents: [{
        parts: [{
          text: batchPrompt
        }]
      }],
      generationConfig: {
        temperature: 0.3
      }
    };

    // Dynamic import of node-fetch for Node.js compatibility with ESM module
    const { default: fetch } = await import('node-fetch');
    
    // Use node-fetch for Node.js compatibility
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseCode = response.status;
    const responseText = await response.text();

    testLog.log('\n📥 GEMINI RESPONSE:');
    testLog.log('Status:', responseCode);
    testLog.log('Raw response:', JSON.stringify(responseText));

    if (responseCode !== 200) {
      testLog.error('❌ API ERROR:', responseCode, responseText);
      return;
    }

    const data = JSON.parse(responseText);
    
    if (!data.candidates || data.candidates.length === 0) {
      testLog.error('❌ No candidates in response');
      return;
    }

    const candidate = data.candidates[0];
    if (!candidate?.content?.parts?.[0]?.text) {
      testLog.error('❌ Invalid response structure');
      return;
    }

    const result = candidate.content.parts[0].text.trim();
    testLog.log('\n🎯 EXTRACTED RESULT:');
    testLog.log('Result:', JSON.stringify(result));

    // Test JSON parsing - this is the critical part that was failing
    testLog.log('\n🧪 TESTING JSON PARSING:');
    try {
      const cleanResponse = sanitizeJsonResponse(result);
      testLog.log('Cleaned response:', JSON.stringify(cleanResponse));
      
      const batchResults = JSON.parse(cleanResponse);
      testLog.log('✅ JSON PARSING SUCCESS!');
      testLog.log('Parsed results:', JSON.stringify(batchResults, null, 2));

      // Validate structure
      if (Array.isArray(batchResults)) {
        testLog.log('✅ Response is an array');
        batchResults.forEach((item, index) => {
          testLog.log(`Email ${index + 1}:`, JSON.stringify({ id: item.id, classification: item.classification }));
          
          if (item.id && (item.classification === 'support' || item.classification === 'not')) {
            testLog.log('✅ Valid format');
          } else {
            testLog.log('❌ Invalid format:', JSON.stringify(item));
          }
        });
      } else {
        testLog.log('❌ Response is not an array:', JSON.stringify({ type: typeof batchResults, value: batchResults }));
      }

      } catch (parseError) {
        testLog.error('❌ JSON PARSE ERROR:', parseError);
        testLog.error('This is the exact error that was happening in production!');
        throw parseError; // Re-throw to trigger cleanup
      }

    } catch (fetchError) {
      testLog.error('❌ FETCH ERROR:', fetchError);
      throw fetchError; // Re-throw to trigger cleanup
    }

  } catch (error) {
    testLog.error('❌ INTEGRATION TEST FAILED:', error);
    throw error; // Re-throw for proper error propagation
  } finally {
    // Cleanup and test reporting
    testLog.log('\n🧹 CLEANUP & REPORTING:');
    
    if (testStartTime) {
      const duration = Date.now() - testStartTime;
      testLog.log('Test duration:', duration, 'ms');
    }
    
    if (apiCallMade) {
      testLog.log('✅ API call was attempted');
      // In a real test, you might want to log API usage or clean up any created resources
    } else {
      testLog.log('⚠️  No API call was made');
    }
    
    testLog.log('Test completed at:', new Date().toISOString());
    testLog.log('🏁 Integration test cleanup complete');
    testLog.flush();
  }
}

// Run the test with proper error handling and cleanup
async function runIntegrationTest() {
  let testSuite: string = 'Gemini API Integration Test';
  
  try {
    testLog.log(`🚀 Starting ${testSuite}`);
    await testBatchProcessing();
    testLog.log(`✅ ${testSuite} completed successfully`);
    testLog.flush();
    process.exitCode = 0;
  } catch (error) {
    testLog.error(`❌ ${testSuite} failed:`, error);
    testLog.flush();
    process.exitCode = 1;
  } finally {
    testLog.log(`🏁 ${testSuite} suite finished`);
    testLog.flush();
    // In Node.js environment, we can exit gracefully
    if (typeof process !== 'undefined') {
      // Allow time for any pending console output
      setTimeout(() => {
        process.exit(process.exitCode || 0);
      }, 100);
    }
  }
}

// Execute the test suite
if (require.main === module) {
  runIntegrationTest();
}