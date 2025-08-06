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
  
  // Re-export JSONSchema from JsonValidator to avoid circular dependency
  export type JSONSchema = JsonValidator.JSONSchema;
  
  
  /**
   * Clean schema for Gemini API by removing unsupported fields
   */
  function cleanSchemaForGemini(schema: JsonValidator.JSONSchema): unknown {
    const cleaned: Record<string, unknown> = {};
    
    // Only copy fields that Gemini API supports
    const supportedFields = ['type', 'properties', 'required', 'items', 'enum', 'minimum', 'maximum', 'minLength', 'maxLength', 'format'];
    
    for (const field of supportedFields) {
      if (field in schema) {
        if (field === 'properties' && typeof schema.properties === 'object' && schema.properties !== null) {
          // Recursively clean nested properties
          cleaned.properties = {};
          for (const [key, value] of Object.entries(schema.properties)) {
            if (typeof value === 'object' && value !== null) {
              (cleaned.properties as Record<string, unknown>)[key] = cleanSchemaForGemini(value as JsonValidator.JSONSchema);
            } else {
              (cleaned.properties as Record<string, unknown>)[key] = value;
            }
          }
        } else if (field === 'items' && typeof schema.items === 'object' && schema.items !== null) {
          cleaned.items = cleanSchemaForGemini(schema.items as JsonValidator.JSONSchema);
        } else {
          cleaned[field] = (schema as Record<string, unknown>)[field];
        }
      }
    }
    
    return cleaned;
  }

  // Enhanced callGemini with strict JSON mode support and model selection
  export function callGemini(apiKey: string, prompt: string, model?: string): GeminiResult;
  export function callGemini<T>(apiKey: string, prompt: string, schema?: JSONSchema, model?: string): GeminiResult<T>;
  export function callGemini<T = string>(apiKey: string, prompt: string, schemaOrModel?: JSONSchema | string, model?: string): GeminiResult<T> {
    // Handle overloaded parameters
    let schema: JSONSchema | undefined;
    let selectedModel: string;
    
    if (typeof schemaOrModel === 'string') {
      // callGemini(apiKey, prompt, model)
      schema = undefined;
      selectedModel = schemaOrModel;
    } else {
      // callGemini(apiKey, prompt, schema, model)
      schema = schemaOrModel;
      selectedModel = model || Config.GEMINI.MODEL;
    }
    const requestId = 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const requestStartTime = Date.now();
    
    const useJsonMode = !!schema;
    const schemaVersion = schema ? '1.0' : undefined;
    
    AppLogger.info('🚀 AI REQUEST [' + requestId + ']', {
      model: selectedModel,
      promptLength: prompt.length,
      useJsonMode,
      schemaVersion,
      requestId,
      startTime: new Date(requestStartTime).toISOString()
    });
    
    // Log the actual prompt being sent
    AppLogger.info('📤 PROMPT SENT [' + requestId + ']', {
      prompt: prompt,
      requestId
    });
    
    const url = Config.GEMINI.API_URL + selectedModel + ':generateContent';
    
    // Check if this is a retry attempt and use temperature 0
    const isRetry = schema && schema.retryAttempt;
    
    const generationConfig: {
      temperature: number;
      response_mime_type?: string;
      response_schema?: unknown;
    } = {
      temperature: isRetry ? 0 : Config.GEMINI.TEMPERATURE
    };
    
    // T-14: Enable strict JSON mode if schema provided
    if (useJsonMode && schema) {
      generationConfig.response_mime_type = 'application/json';
      // Clean the schema to remove unsupported fields like $schema and additionalProperties
      generationConfig.response_schema = cleanSchemaForGemini(schema);
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
      // Log before making the request
      AppLogger.info('📤 API CALL START [' + requestId + ']', {
        requestId,
        url: url.replace(/key=[^&]+/, 'key=***'),
        payloadSize: JSON.stringify(payload).length
      });
      
      const fetchStartTime = Date.now();
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'x-goog-api-key': apiKey
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        // Use centralized timeout from ExecutionTime module
        timeout: ExecutionTime.getApiTimeoutSeconds()
      } as GoogleAppsScript.URL_Fetch.URLFetchRequestOptions);
      
      const fetchEndTime = Date.now();
      const fetchDuration = fetchEndTime - fetchStartTime;
      
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      const totalDuration = Date.now() - requestStartTime;
      
      AppLogger.info('📨 AI RESPONSE [' + requestId + ']', {
        statusCode: responseCode,
        responseLength: responseText.length,
        requestId,
        fetchDuration: fetchDuration + 'ms',
        totalDuration: totalDuration + 'ms',
        tokensPerSecond: responseText.length > 0 ? Math.round((responseText.length / 3.5) / (totalDuration / 1000)) : 0
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
        
        // Parse error details for better user feedback
        let errorDetails = '';
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error?.message) {
            errorDetails = errorData.error.message;
          }
        } catch (e) {
          errorDetails = responseText.substring(0, 200);
        }
        
        // Create user-friendly error messages
        let userMessage = '';
        if (responseCode === 401) {
          userMessage = '❌ Invalid API key. Please check your Gemini API key in Settings.';
        } else if (responseCode === 403) {
          userMessage = '❌ Access denied. Your API key may not have the required permissions.';
        } else if (responseCode === 429) {
          userMessage = '⏱️ Rate limit exceeded. Please wait a moment and try again.';
        } else if (responseCode === 404) {
          userMessage = '❌ API endpoint not found. This may be a configuration issue.';
        } else if (responseCode === 500 || responseCode === 503) {
          userMessage = '🔧 Gemini service is temporarily unavailable. Please try again later.';
        } else {
          userMessage = `❌ API Error (${responseCode}): ${errorDetails}`;
        }
        
        const appError = ErrorTaxonomy.createError(
          errorType,
          userMessage,
          { 
            statusCode: responseCode, 
            requestId,
            errorDetails,
            url: url.replace(/key=[^&]+/, 'key=***') // Mask API key
          }
        );
        
        ErrorTaxonomy.logError(appError);
        return { success: false, error: userMessage, statusCode: responseCode, requestId };
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
            return callGemini(apiKey, strictPrompt, { ...schema, retryAttempt: true });
          }
          
          return { success: false, error: 'Response is not valid JSON after retry', requestId };
        }
        
        try {
          const parsedResult = JSON.parse(sanitizedResult);
          
          // Validate against schema using the JsonValidator module
          const validation = JsonValidator.validate(parsedResult, schema);
          if (!validation.valid) {
            AppLogger.warn('⚠️ SCHEMA VALIDATION FAILED [' + requestId + ']', {
              result: parsedResult,
              errors: validation.errors,
              requestId
            });
            
            // Retry with temperature 0 if this was the first attempt
            if (!isRetry) {
              AppLogger.info('🔄 RETRYING WITH TEMPERATURE 0 [' + requestId + ']', { requestId });
              return callGemini(apiKey, prompt, { ...schema, retryAttempt: true });
            }
            
            return { 
              success: false, 
              error: 'JSON response failed schema validation: ' + (validation.errors || []).join(', '), 
              requestId 
            };
          }
          
          const finalDuration = Date.now() - requestStartTime;
          AppLogger.info('✅ AI JSON RESULT [' + requestId + ']', {
            result: parsedResult,
            schemaVersion,
            requestId,
            totalDuration: finalDuration + 'ms'
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
        const finalDuration = Date.now() - requestStartTime;
        AppLogger.info('✅ AI RESULT [' + requestId + ']', {
          result,
          requestId,
          classification: result.toLowerCase().indexOf('support') === 0 ? 'SUPPORT' : 'NOT_SUPPORT',
          totalDuration: finalDuration + 'ms'
        });
        
        return { success: true, data: result as T, requestId };
      }
    } catch (error) {
      const errorDuration = Date.now() - requestStartTime;
      AppLogger.error('❌ AI REQUEST FAILED [' + requestId + ']', {
        requestId,
        duration: errorDuration + 'ms',
        error: String(error)
      });
      
      // Parse and structure the error
      const appError = ErrorTaxonomy.parseError(error);
      
      // Create new error with added context
      const enrichedError = ErrorTaxonomy.createError(
        appError.type,
        appError.message,
        Object.assign({}, appError.context || {}, { requestId })
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
    
    Utils.logBatchComplete('ai batch classification', {
      totalEmails: emails.length,
      successCount: results.filter(r => !r.error).length,
      errorCount: results.filter(r => r.error).length
    });
    
    return results;
  }
}