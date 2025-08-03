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
  
  
  // Updated discriminated union for structured responses
  export type GeminiResult<T = string> = 
    | { success: true; data: T; requestId: string; schemaVersion?: string }
    | { success: false; error: string; statusCode?: number; requestId: string };
  
  
  // Enhanced callGemini with strict JSON mode support
  export function callGemini(apiKey: string, prompt: string): GeminiResult;
  export function callGemini<T>(apiKey: string, prompt: string, schema?: any): GeminiResult<T>;
  export function callGemini<T = string>(apiKey: string, prompt: string, schema?: any): GeminiResult<T> {
    const requestId = 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    const useJsonMode = !!schema;
    const schemaVersion = schema ? '1.0' : undefined;
    
    AppLogger.info('🚀 AI REQUEST [' + requestId + ']', {
      model: Config.GEMINI.MODEL,
      promptLength: prompt.length,
      useJsonMode,
      schemaVersion,
      requestId
    });
    
    // Log the actual prompt being sent
    AppLogger.info('📤 PROMPT SENT [' + requestId + ']', {
      prompt: prompt,
      requestId
    });
    
    const url = Config.GEMINI.API_URL + Config.GEMINI.MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);
    
    // Check if this is a retry attempt and use temperature 0
    const isRetry = schema && schema.retryAttempt;
    const cleanSchema = schema ? { ...schema } : undefined;
    if (cleanSchema) {
      delete cleanSchema.retryAttempt;
    }
    
    const generationConfig: any = {
      temperature: isRetry ? 0 : Config.GEMINI.TEMPERATURE
    };
    
    // T-14: Enable strict JSON mode if schema provided
    if (useJsonMode) {
      generationConfig.response_mime_type = 'application/json';
      generationConfig.response_schema = cleanSchema;
    }
    
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig
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
        // Determine specific error type
        let errorType = ErrorTaxonomy.AppErrorType.API_SERVICE_ERROR;
        if (responseCode === 401 || responseCode === 403) {
          errorType = ErrorTaxonomy.AppErrorType.API_KEY_INVALID;
        } else if (responseCode === 429) {
          errorType = ErrorTaxonomy.AppErrorType.API_RATE_LIMITED;
        } else if (responseCode === 503 || responseCode === 504) {
          errorType = ErrorTaxonomy.AppErrorType.NETWORK_UNAVAILABLE;
        }
        
        const appError = ErrorTaxonomy.createError(
          errorType,
          'API error: ' + responseCode + ' - ' + responseText,
          { statusCode: responseCode, requestId }
        );
        
        ErrorTaxonomy.logError(appError);
        return { success: false, error: appError.message, statusCode: responseCode, requestId };
      }
      
      const data = JSON.parse(responseText) as Types.GeminiResponse;
      
      if (!data.candidates || data.candidates.length === 0) {
        const appError = ErrorTaxonomy.createError(
          ErrorTaxonomy.AppErrorType.API_INVALID_RESPONSE,
          'No response from AI',
          { requestId }
        );
        ErrorTaxonomy.logError(appError);
        return { success: false, error: appError.message, requestId };
      }
      
      const candidate = data.candidates[0];
      if (!candidate?.content?.parts?.[0]?.text) {
        const appError = ErrorTaxonomy.createError(
          ErrorTaxonomy.AppErrorType.API_INVALID_RESPONSE,
          'Invalid response structure from AI',
          { requestId, candidate }
        );
        ErrorTaxonomy.logError(appError);
        return { success: false, error: appError.message, requestId };
      }
      const result = candidate.content.parts[0].text.trim();
      
      // Handle JSON mode responses
      if (useJsonMode) {
        // Clean and sanitize the response first
        const sanitizedResult = JsonValidator.sanitizeJsonResponse(result);
        
        if (!JsonValidator.isValidJson(sanitizedResult)) {
          AppLogger.error('❌ INVALID JSON [' + requestId + ']', {
            original: result,
            sanitized: sanitizedResult,
            requestId
          });
          
          // Retry with temperature 0 and clearer instructions
          if (!isRetry) {
            AppLogger.info('🔄 RETRYING WITH STRICT INSTRUCTIONS [' + requestId + ']', { requestId });
            const strictPrompt = prompt + '\n\nCRITICAL: Respond with ONLY valid JSON. No explanations, no markdown, no extra text.';
            return callGemini(apiKey, strictPrompt, { ...cleanSchema, retryAttempt: true });
          }
          
          return { success: false, error: 'Response is not valid JSON after retry', requestId };
        }
        
        try {
          const parsedResult = JSON.parse(sanitizedResult);
          
          // Validate against schema using the JsonValidator module
          const validation = JsonValidator.validate(parsedResult, cleanSchema);
          if (!validation.valid) {
            AppLogger.warn('⚠️ SCHEMA VALIDATION FAILED [' + requestId + ']', {
              result: parsedResult,
              errors: validation.errors,
              requestId
            });
            
            // Retry with temperature 0 if this was the first attempt
            if (!isRetry) {
              AppLogger.info('🔄 RETRYING WITH TEMPERATURE 0 [' + requestId + ']', { requestId });
              return callGemini(apiKey, prompt, { ...cleanSchema, retryAttempt: true });
            }
            
            return { 
              success: false, 
              error: 'JSON response failed schema validation: ' + (validation.errors || []).join(', '), 
              requestId 
            };
          }
          
          AppLogger.info('✅ AI JSON RESULT [' + requestId + ']', {
            result: parsedResult,
            schemaVersion,
            requestId
          });
          
          return { success: true, data: parsedResult as T, requestId, schemaVersion };
        } catch (parseError) {
          AppLogger.error('❌ JSON PARSE ERROR [' + requestId + ']', {
            error: String(parseError),
            sanitized: sanitizedResult,
            original: result,
            requestId
          });
          
          return { success: false, error: 'Failed to parse JSON response: ' + String(parseError), requestId };
        }
      } else {
        // Legacy string mode
        AppLogger.info('✅ AI RESULT [' + requestId + ']', {
          result,
          requestId,
          classification: result.toLowerCase().indexOf('support') === 0 ? 'SUPPORT' : 'NOT_SUPPORT'
        });
        
        return { success: true, data: result as T, requestId };
      }
    } catch (error) {
      // Parse and structure the error
      const appError = ErrorTaxonomy.parseError(error);
      
      // Create new error with added context
      const enrichedError = ErrorTaxonomy.createError(
        appError.type,
        appError.message,
        { ...appError.context, requestId }
      );
      
      // Log with appropriate severity
      ErrorTaxonomy.logError(enrichedError);
      
      return { success: false, error: enrichedError.message, requestId };
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
      
      // T-14: Use JSON schema for batch classification
      const batchSchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            classification: { 
              type: 'string',
              enum: ['support', 'not']
            }
          },
          required: ['id', 'classification']
        }
      };
      
      const response = callGemini(apiKey, batchPrompt, batchSchema);
      
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
      
      // T-14: Parse the batch response (should already be parsed with JSON schema)
      let batchResults: Array<{id: string, classification: string}>;
      try {
        if (typeof response.data === 'string') {
          // Fallback: Handle response that might have markdown code blocks
          const cleanResponse = response.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          batchResults = JSON.parse(cleanResponse);
        } else {
          // Should already be parsed when using JSON schema
          batchResults = response.data as Array<{id: string, classification: string}>;
        }
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