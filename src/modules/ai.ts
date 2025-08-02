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
  
  // Discriminated union for Gemini API results
  export type GeminiResult = 
    | { success: true; data: string; requestId: string }
    | { success: false; error: string; statusCode?: number; requestId: string };
  
  export function callGemini(apiKey: string, prompt: string): GeminiResult {
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
        muteHttpExceptions: true,
        // Add timeout to prevent hanging requests
        // Note: timeout is in seconds for UrlFetchApp, not milliseconds
        timeout: Config.GEMINI.TIMEOUT_MS / 1000
      } as GoogleAppsScript.URL_Fetch.URLFetchRequestOptions);
      
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
        return { success: false, error: 'API error: ' + responseCode + ' - ' + responseText, statusCode: responseCode, requestId };
      }
      
      const data = JSON.parse(responseText) as Types.GeminiResponse;
      
      if (!data.candidates || data.candidates.length === 0) {
        return { success: false, error: 'No response from AI', requestId };
      }
      
      const candidate = data.candidates[0];
      if (!candidate?.content?.parts?.[0]?.text) {
        return { success: false, error: 'Invalid response structure from AI', requestId };
      }
      const result = candidate.content.parts[0].text.trim();
      
      AppLogger.info('✅ AI RESULT [' + requestId + ']', {
        result,
        requestId,
        classification: result.toLowerCase().indexOf('support') === 0 ? 'SUPPORT' : 'NOT_SUPPORT'
      });
      
      return { success: true, data: result, requestId };
    } catch (error) {
      // Handle timeout errors specifically
      const errorStr = String(error);
      if (errorStr.includes('Timeout') || errorStr.includes('timeout')) {
        AppLogger.error('⏱️ Request timeout [' + requestId + ']', {
          error: errorStr,
          timeoutSeconds: Config.GEMINI.TIMEOUT_MS / 1000,
          requestId
        });
        return { success: false, error: 'Request timed out after ' + (Config.GEMINI.TIMEOUT_MS / 1000) + ' seconds', requestId };
      }
      
      const errorMessage = Utils.logAndHandleError(error, 'Gemini API call');
      return { success: false, error: errorMessage, requestId };
    }
  }
  
  // Helper function for backward compatibility
  export function callGeminiThrows(apiKey: string, prompt: string): string {
    const result = callGemini(apiKey, prompt);
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
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
      batchPrompt += 'CRITICAL: You must classify each email and respond with ONLY a valid JSON array. ';
      batchPrompt += 'Each array element must have exactly two fields: "id" (string) and "classification" (either "support" or "not"). ';
      batchPrompt += 'Do NOT include any other text, explanations, or markdown formatting. ';
      batchPrompt += 'Example format: [{"id":"email1","classification":"support"},{"id":"email2","classification":"not"}]\n\n';
      
      batch.forEach((email, index) => {
        batchPrompt += '--- EMAIL ' + (index + 1) + ' (ID: ' + email.id + ') ---\n';
        batchPrompt += 'Subject: ' + email.subject + '\n';
        batchPrompt += 'Body: ' + email.body.substring(0, 500) + '\n'; // Limit body length
        batchPrompt += '--- END EMAIL ' + (index + 1) + ' ---\n\n';
      });
      
      batchPrompt += 'REMEMBER: Respond ONLY with the JSON array, nothing else! Format: [{"id": "<email_id>", "classification": "support" or "not"}]';
      
      const response = callGemini(apiKey, batchPrompt);
      
      if (!response.success) {
        AppLogger.error('❌ BATCH API ERROR', {
          batchId,
          error: response.error,
          statusCode: response.statusCode
        });
        // Mark all emails in this batch as errors
        batch.forEach(email => {
          results.push({
            id: email.id,
            classification: 'not',
            error: response.error
          });
        });
        continue;
      }
      
      // Parse the batch response
      let batchResults: Array<{id: string, classification: string}>;
      try {
        // Handle response that might have markdown code blocks
        const cleanResponse = response.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        batchResults = JSON.parse(cleanResponse);
      } catch (parseError) {
        Utils.logAndHandleError(parseError, `Batch parse error for ${batchId}`);
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