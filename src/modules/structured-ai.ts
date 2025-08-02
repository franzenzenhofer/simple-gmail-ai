/**
 * Structured AI Module
 * High-level interface for AI operations with structured JSON responses
 */

namespace StructuredAI {
  export interface StructuredResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    requestId: string;
    schemaVersion?: string;
    validationErrors?: string[];
  }
  
  export function classifyEmail(
    apiKey: string,
    emailContent: string,
    customPrompt?: string
  ): StructuredResult<AISchemas.ClassificationResponse> {
    const prompt = customPrompt || Config.PROMPTS.CLASSIFICATION;
    const fullPrompt = AISchemas.createPromptForSchema(
      prompt + '\n\n' + emailContent,
      'classification'
    );
    
    const result = AI.callGemini<AISchemas.ClassificationResponse>(
      apiKey,
      fullPrompt,
      AISchemas.getSchema('classification')
    );
    
    if (!result.success) {
      return {
        success: false,
        error: result.error,
        requestId: result.requestId
      };
    }
    
    return {
      success: true,
      data: result.data,
      requestId: result.requestId,
      schemaVersion: result.schemaVersion
    };
  }
  
  export function generateReply(
    apiKey: string,
    emailContent: string,
    customPrompt?: string
  ): StructuredResult<AISchemas.ReplyResponse> {
    const prompt = customPrompt || Config.PROMPTS.RESPONSE;
    const fullPrompt = AISchemas.createPromptForSchema(
      prompt + '\n\n' + emailContent,
      'reply'
    );
    
    const result = AI.callGemini<AISchemas.ReplyResponse>(
      apiKey,
      fullPrompt,
      AISchemas.getSchema('reply')
    );
    
    if (!result.success) {
      return {
        success: false,
        error: result.error,
        requestId: result.requestId
      };
    }
    
    return {
      success: true,
      data: result.data,
      requestId: result.requestId,
      schemaVersion: result.schemaVersion
    };
  }
  
  export function batchClassifyEmails(
    apiKey: string,
    emails: Array<{ id: string; content: string }>,
    customPrompt?: string
  ): StructuredResult<AISchemas.BatchResponse[]> {
    if (emails.length === 0) {
      return {
        success: true,
        data: [],
        requestId: 'empty_batch'
      };
    }
    
    const prompt = customPrompt || Config.PROMPTS.CLASSIFICATION;
    let batchPrompt = prompt + '\n\nClassify each email below:\n\n';
    
    emails.forEach((email, index) => {
      batchPrompt += `EMAIL ${index + 1} (ID: ${email.id}):\n${email.content}\n\n`;
    });
    
    const fullPrompt = AISchemas.createPromptForSchema(batchPrompt, 'batch');
    
    const result = AI.callGemini<AISchemas.BatchResponse[]>(
      apiKey,
      fullPrompt,
      AISchemas.getSchema('batch')
    );
    
    if (!result.success) {
      return {
        success: false,
        error: result.error,
        requestId: result.requestId
      };
    }
    
    // Validate that all email IDs are covered
    const expectedIds = new Set(emails.map(e => e.id));
    const returnedIds = new Set(result.data.map(r => r.id));
    
    const missingIds = [...expectedIds].filter(id => !returnedIds.has(id));
    if (missingIds.length > 0) {
      AppLogger.warn('Batch response missing some email IDs', {
        missingIds,
        requestId: result.requestId
      });
      
      // Add missing emails as 'not' classification
      missingIds.forEach(id => {
        result.data.push({
          id,
          label: 'not',
          confidence: 0
        });
      });
    }
    
    return {
      success: true,
      data: result.data,
      requestId: result.requestId,
      schemaVersion: result.schemaVersion
    };
  }
  
  // Legacy compatibility function
  export function classifyEmailLegacy(
    apiKey: string,
    emailContent: string,
    customPrompt?: string
  ): string {
    const result = classifyEmail(apiKey, emailContent, customPrompt);
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Classification failed');
    }
    
    return result.data.label;
  }
  
  // Utility function to check if structured mode is available
  export function isStructuredModeSupported(): boolean {
    // Check if the Gemini model supports JSON mode
    return Config.GEMINI.MODEL.includes('2.5') || Config.GEMINI.MODEL.includes('pro');
  }
  
  // Function to gracefully fallback to legacy mode if needed
  export function classifyWithFallback(
    apiKey: string,
    emailContent: string,
    customPrompt?: string
  ): { classification: string; structured: boolean; requestId: string } {
    if (isStructuredModeSupported()) {
      try {
        const result = classifyEmail(apiKey, emailContent, customPrompt);
        if (result.success && result.data) {
          return {
            classification: result.data.label,
            structured: true,
            requestId: result.requestId
          };
        }
      } catch (error) {
        AppLogger.warn('Structured classification failed, falling back to legacy', {
          error: String(error)
        });
      }
    }
    
    // Fallback to legacy string-based classification
    const legacyResult = AI.callGemini(apiKey, (customPrompt || Config.PROMPTS.CLASSIFICATION) + '\n\n' + emailContent);
    const classification = legacyResult.success 
      ? (legacyResult.data.toLowerCase().indexOf('support') === 0 ? 'support' : 'not')
      : 'not';
    
    return {
      classification,
      structured: false,
      requestId: legacyResult.requestId
    };
  }
}