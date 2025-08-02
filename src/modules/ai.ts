/**
 * AI Service Module
 * Handles all Gemini API interactions
 */

namespace AI {
  export interface BatchClassificationRequest {
    id: string;
    subject: string;
    body: string;
  }
  
  export interface BatchClassificationResult {
    id: string;
    classification: string;
    error?: string;
  }
  
  export function callGemini(apiKey: string, prompt: string): string {
    const requestId = 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    AppLogger.info('🚀 AI REQUEST [' + requestId + ']', {
      model: Config.GEMINI.MODEL,
      promptLength: prompt.length,
      requestId
    });
    
    // Log the actual prompt being sent
    AppLogger.info('📤 PROMPT SENT [' + requestId + ']', {
      prompt: prompt,
      requestId
    });
    
    const url = Config.GEMINI.API_URL + Config.GEMINI.MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);
    
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: Config.GEMINI.TEMPERATURE
      }
    };
    
    try {
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      AppLogger.info('📨 AI RESPONSE [' + requestId + ']', {
        statusCode: responseCode,
        responseLength: responseText.length,
        requestId
      });
      
      // Log the raw response received
      AppLogger.info('📥 RAW RESPONSE [' + requestId + ']', {
        response: responseText,
        requestId
      });
      
      if (responseCode !== 200) {
        AppLogger.error('❌ AI ERROR [' + requestId + ']', {
          statusCode: responseCode,
          error: responseText,
          requestId
        });
        throw new Error('API error: ' + responseCode);
      }
      
      const data = JSON.parse(responseText) as Types.GeminiResponse;
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from AI');
      }
      
      const candidate = data.candidates[0];
      if (!candidate?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response structure from AI');
      }
      const result = candidate.content.parts[0].text.trim();
      
      AppLogger.info('✅ AI RESULT [' + requestId + ']', {
        result,
        requestId,
        classification: result.toLowerCase().indexOf('support') === 0 ? 'SUPPORT' : 'NOT_SUPPORT'
      });
      
      return result;
    } catch (error) {
      AppLogger.error('Failed to call AI', { error: String(error), requestId });
      throw error;
    }
  }
  
  export function batchClassifyEmails(
    apiKey: string,
    emails: BatchClassificationRequest[],
    classificationPrompt: string
  ): BatchClassificationResult[] {
    if (emails.length === 0) return [];
    
    const requestId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const batchSize = 10; // Process 10 emails at a time to stay within token limits
    const results: BatchClassificationResult[] = [];
    
    AppLogger.info('📦 BATCH CLASSIFICATION START', {
      totalEmails: emails.length,
      batchSize,
      requestId
    });
    
    // Process emails in batches
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, Math.min(i + batchSize, emails.length));
      const batchId = requestId + '_batch_' + Math.floor(i / batchSize);
      
      AppLogger.info('🔄 PROCESSING BATCH', {
        batchNumber: Math.floor(i / batchSize) + 1,
        emailsInBatch: batch.length,
        batchId
      });
      
      // Create a single prompt for the entire batch
      let batchPrompt = classificationPrompt + '\n\n';
      batchPrompt += 'Classify each of the following emails as "support" or "not". ';
      batchPrompt += 'Respond with ONLY a JSON array where each element has "id" and "classification" fields.\n\n';
      
      batch.forEach((email, index) => {
        batchPrompt += '--- EMAIL ' + (index + 1) + ' (ID: ' + email.id + ') ---\n';
        batchPrompt += 'Subject: ' + email.subject + '\n';
        batchPrompt += 'Body: ' + email.body.substring(0, 500) + '\n'; // Limit body length
        batchPrompt += '--- END EMAIL ' + (index + 1) + ' ---\n\n';
      });
      
      batchPrompt += 'Response format: [{"id": "<email_id>", "classification": "support" or "not"}]';
      
      try {
        const response = callGemini(apiKey, batchPrompt);
        
        // Parse the batch response
        let batchResults: Array<{id: string, classification: string}>;
        try {
          // Handle response that might have markdown code blocks
          const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          batchResults = JSON.parse(cleanResponse);
        } catch (parseError) {
          AppLogger.error('❌ BATCH PARSE ERROR', {
            batchId,
            response,
            error: String(parseError)
          });
          // Fallback: mark all emails in batch as errors
          batch.forEach(email => {
            results.push({
              id: email.id,
              classification: 'not',
              error: 'Failed to parse batch response'
            });
          });
          continue;
        }
        
        // Map results back to email IDs
        const resultMap = new Map(batchResults.map(r => [r.id, r.classification]));
        
        batch.forEach(email => {
          const classification = resultMap.get(email.id) || 'not';
          results.push({
            id: email.id,
            classification: classification.toLowerCase()
          });
          
          AppLogger.info('🎯 EMAIL CLASSIFIED', {
            emailId: email.id,
            subject: email.subject,
            classification,
            batchId
          });
        });
        
      } catch (error) {
        AppLogger.error('❌ BATCH API ERROR', {
          batchId,
          error: String(error)
        });
        // Mark all emails in this batch as errors
        batch.forEach(email => {
          results.push({
            id: email.id,
            classification: 'not',
            error: String(error)
          });
        });
      }
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < emails.length) {
        Utilities.sleep(500); // 500ms delay
      }
    }
    
    AppLogger.info('✅ BATCH CLASSIFICATION COMPLETE', {
      totalEmails: emails.length,
      successCount: results.filter(r => !r.error).length,
      errorCount: results.filter(r => r.error).length,
      requestId
    });
    
    return results;
  }
}