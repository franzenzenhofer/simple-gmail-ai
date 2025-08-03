/**
 * Integration test for REAL Gemini API calls
 * Tests the actual batch processing with live API
 */

const API_KEY = 'AIzaSyBDeR8FBytoqxJ16aJV_2ryF__ChsUPCDE';

const testEmails = [
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

async function testBatchProcessing() {
  console.log('🧪 INTEGRATION TEST: Batch Processing with Real Gemini API');
  console.log('API Key:', API_KEY.substring(0, 10) + '...' + API_KEY.substring(API_KEY.length - 5));

  // Use the EXACTLY the same prompt logic as in our current AI module
  const classificationPrompt = [
    'You are an email triage assistant.',
    'Return exactly one word:',
    '  - support : if the email is a customer support request',
    '  - undefined : for anything else (not support).',
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

  console.log('\n📤 SENDING PROMPT TO GEMINI:');
  console.log('Length:', batchPrompt.length, 'characters');
  console.log('Prompt preview:\n' + batchPrompt.substring(0, 400) + '...\n');

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(API_KEY);
    
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseCode = response.status;
    const responseText = await response.text();

    console.log('\n📥 GEMINI RESPONSE:');
    console.log('Status:', responseCode);
    console.log('Raw response length:', responseText.length);
    console.log('Raw response:', responseText);

    if (responseCode !== 200) {
      console.error('❌ API ERROR:', responseCode, responseText);
      return;
    }

    const data = JSON.parse(responseText);
    
    if (!data.candidates || data.candidates.length === 0) {
      console.error('❌ No candidates in response');
      return;
    }

    const candidate = data.candidates[0];
    if (!candidate?.content?.parts?.[0]?.text) {
      console.error('❌ Invalid response structure');
      return;
    }

    const result = candidate.content.parts[0].text.trim();
    console.log('\n🎯 EXTRACTED RESULT:');
    console.log('Result text:', JSON.stringify(result));
    console.log('Result preview:', result.substring(0, 200));

    // Test JSON parsing - this is the critical part that was failing
    console.log('\n🧪 TESTING JSON PARSING (this is where it was failing before):');
    try {
      const cleanResponse = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      console.log('Cleaned response:', JSON.stringify(cleanResponse));
      
      const batchResults = JSON.parse(cleanResponse);
      console.log('✅ JSON PARSING SUCCESS!');
      console.log('Parsed results:', JSON.stringify(batchResults, null, 2));

      // Validate structure
      if (Array.isArray(batchResults)) {
        console.log('✅ Response is an array with', batchResults.length, 'elements');
        batchResults.forEach((item, index) => {
          console.log(`Email ${index + 1}:`, item.id, '->', item.classification);
          
          if (item.id && (item.classification === 'support' || item.classification === 'not')) {
            console.log('  ✅ Valid format');
          } else {
            console.log('  ❌ Invalid format:', JSON.stringify(item));
          }
        });

        // Check if all test emails are accounted for
        const foundIds = new Set(batchResults.map(r => r.id));
        const expectedIds = new Set(testEmails.map(e => e.id));
        
        if (foundIds.size === expectedIds.size) {
          console.log('✅ All emails processed');
        } else {
          console.log('❌ Missing emails. Expected:', Array.from(expectedIds), 'Got:', Array.from(foundIds));
        }

      } else {
        console.log('❌ Response is not an array:', typeof batchResults);
        console.log('Response content:', JSON.stringify(batchResults));
      }

    } catch (parseError) {
      console.error('❌ JSON PARSE ERROR:', parseError);
      console.error('Raw response that failed to parse:');
      console.error(JSON.stringify(result));
      console.error('This would be the exact error in production! The prompt needs improvement.');
    }

  } catch (error) {
    console.error('❌ FETCH ERROR:', error);
  }
}

// Run the test
testBatchProcessing().catch(console.error);