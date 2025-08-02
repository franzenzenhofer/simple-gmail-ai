/**
 * Batch Processor Module
 * Handles batch processing of emails to reduce API calls and latency
 */

namespace BatchProcessor {
  // Configuration for batch processing
  export const CONFIG = {
    MAX_BATCH_SIZE: 20,           // Maximum emails per batch
    DELIMITER: '\u241E',          // Record Separator character
    MAX_EMAIL_LENGTH: 1000,       // Maximum characters per email content
    BATCH_DELAY_MS: 500          // Delay between batches to avoid rate limiting
  };

  export interface BatchItem {
    id: string;
    subject: string;
    body: string;
    threadId?: string;
  }

  export interface BatchResult {
    id: string;
    label: "support" | "not";
    confidence?: number;
    reasoning?: string;
    error?: string;
  }

  export interface BatchResponse {
    success: boolean;
    results: BatchResult[];
    batchId: string;
    processingTime: number;
    tokenCount?: {
      input: number;
      output: number;
    };
  }

  // Schema for batch classification responses
  const BATCH_CLASSIFICATION_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "array",
    "items": {
      "type": "object",
      "required": ["id", "label"],
      "properties": {
        "id": { "type": "string" },
        "label": { "type": "string", "enum": ["support", "not"] },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
        "reasoning": { "type": "string", "maxLength": 200 }
      },
      "additionalProperties": false
    },
    "minItems": 1,
    "maxItems": CONFIG.MAX_BATCH_SIZE
  };

  // Schema for batch reply generation responses (for future use)
  export const BATCH_REPLY_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "array",
    "items": {
      "type": "object",
      "required": ["id", "reply"],
      "properties": {
        "id": { "type": "string" },
        "reply": { "type": "string", "minLength": 1, "maxLength": 2000 },
        "tone": { "type": "string", "enum": ["formal", "friendly", "neutral"] },
        "category": { "type": "string", "enum": ["inquiry", "complaint", "request", "feedback", "other"] }
      },
      "additionalProperties": false
    },
    "minItems": 1,
    "maxItems": CONFIG.MAX_BATCH_SIZE
  };

  /**
   * Creates a batch prompt for classification with proper delimiters
   */
  export function createBatchClassificationPrompt(
    emails: BatchItem[],
    basePrompt: string
  ): string {
    if (emails.length === 0) {
      throw new Error('Cannot create batch prompt with empty email list');
    }

    let prompt = basePrompt + '\n\n';
    prompt += 'CRITICAL: Classify each email and respond with ONLY a valid JSON array.\n';
    prompt += 'Each array element must have: "id" (string), "label" ("support" or "not"), optionally "confidence" (0-1) and "reasoning" (brief).\n';
    prompt += 'Example format: [{"id":"email1","label":"support","confidence":0.9,"reasoning":"customer asking for help"}]\n\n';

    emails.forEach((email, index) => {
      const truncatedBody = email.body.length > CONFIG.MAX_EMAIL_LENGTH 
        ? email.body.substring(0, CONFIG.MAX_EMAIL_LENGTH) + '...'
        : email.body;

      prompt += `${CONFIG.DELIMITER}EMAIL_${index + 1}${CONFIG.DELIMITER}\n`;
      prompt += `ID: ${email.id}\n`;
      prompt += `Subject: ${email.subject}\n`;
      prompt += `Body: ${truncatedBody}\n`;
      prompt += `${CONFIG.DELIMITER}END_EMAIL_${index + 1}${CONFIG.DELIMITER}\n\n`;
    });

    prompt += 'RESPOND WITH JSON ARRAY ONLY - NO OTHER TEXT!';
    return prompt;
  }

  /**
   * Creates a batch prompt for reply generation
   */
  export function createBatchReplyPrompt(
    emails: BatchItem[],
    basePrompt: string
  ): string {
    if (emails.length === 0) {
      throw new Error('Cannot create batch prompt with empty email list');
    }

    let prompt = basePrompt + '\n\n';
    prompt += 'CRITICAL: Generate replies for each email and respond with ONLY a valid JSON array.\n';
    prompt += 'Each array element must have: "id" (string), "reply" (string), optionally "tone" and "category".\n';
    prompt += 'Example format: [{"id":"email1","reply":"Thank you for contacting us...","tone":"friendly"}]\n\n';

    emails.forEach((email, index) => {
      const truncatedBody = email.body.length > CONFIG.MAX_EMAIL_LENGTH 
        ? email.body.substring(0, CONFIG.MAX_EMAIL_LENGTH) + '...'
        : email.body;

      prompt += `${CONFIG.DELIMITER}EMAIL_${index + 1}${CONFIG.DELIMITER}\n`;
      prompt += `ID: ${email.id}\n`;
      prompt += `Subject: ${email.subject}\n`;
      prompt += `Body: ${truncatedBody}\n`;
      prompt += `${CONFIG.DELIMITER}END_EMAIL_${index + 1}${CONFIG.DELIMITER}\n\n`;
    });

    prompt += 'RESPOND WITH JSON ARRAY ONLY - NO OTHER TEXT!';
    return prompt;
  }

  /**
   * Splits emails into optimal batches
   */
  export function createBatches(emails: BatchItem[], maxBatchSize: number = CONFIG.MAX_BATCH_SIZE): BatchItem[][] {
    if (emails.length === 0) {
      return [];
    }

    const batches: BatchItem[][] = [];
    for (let i = 0; i < emails.length; i += maxBatchSize) {
      batches.push(emails.slice(i, i + maxBatchSize));
    }

    return batches;
  }

  /**
   * Processes a single batch for classification
   */
  export function processBatchClassification(
    apiKey: string,
    batch: BatchItem[],
    basePrompt: string
  ): BatchResponse {
    const batchId = 'batch_class_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const startTime = Date.now();

    AppLogger.info('🔄 BATCH CLASSIFICATION START', {
      batchId,
      emailCount: batch.length,
      maxBatchSize: CONFIG.MAX_BATCH_SIZE
    });

    try {
      const prompt = createBatchClassificationPrompt(batch, basePrompt);
      const result = AI.callGemini<BatchResult[]>(apiKey, prompt, BATCH_CLASSIFICATION_SCHEMA);

      if (!result.success) {
        AppLogger.error('❌ BATCH CLASSIFICATION FAILED', {
          batchId,
          error: result.error,
          statusCode: result.statusCode
        });

        // Return error result for all emails in batch
        const errorResults: BatchResult[] = batch.map(email => ({
          id: email.id,
          label: 'not' as const,
          error: result.error
        }));

        return {
          success: false,
          results: errorResults,
          batchId,
          processingTime: Date.now() - startTime
        };
      }

      // Validate that all emails are covered
      const expectedIds = new Set(batch.map(e => e.id));
      const returnedIds = new Set(result.data.map(r => r.id));
      
      // Add missing emails as 'not' classification
      const missingIds = [...expectedIds].filter(id => !returnedIds.has(id));
      if (missingIds.length > 0) {
        AppLogger.warn('⚠️ BATCH MISSING EMAILS', {
          batchId,
          missingIds,
          returnedCount: result.data.length,
          expectedCount: batch.length
        });

        missingIds.forEach(id => {
          result.data.push({
            id,
            label: 'not',
            confidence: 0,
            reasoning: 'Missing from batch response'
          });
        });
      }

      const processingTime = Date.now() - startTime;

      AppLogger.info('✅ BATCH CLASSIFICATION SUCCESS', {
        batchId,
        emailCount: batch.length,
        successCount: result.data.filter(r => !r.error).length,
        errorCount: result.data.filter(r => r.error).length,
        processingTime
      });

      return {
        success: true,
        results: result.data,
        batchId,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = Utils.logAndHandleError(error, `Batch classification ${batchId}`);

      AppLogger.error('❌ BATCH CLASSIFICATION EXCEPTION', {
        batchId,
        error: errorMessage,
        processingTime
      });

      // Return error result for all emails in batch
      const errorResults: BatchResult[] = batch.map(email => ({
        id: email.id,
        label: 'not' as const,
        error: errorMessage
      }));

      return {
        success: false,
        results: errorResults,
        batchId,
        processingTime
      };
    }
  }

  /**
   * Processes multiple batches with rate limiting
   */
  export function processAllBatches(
    apiKey: string,
    emails: BatchItem[],
    basePrompt: string,
    onBatchComplete?: (batchResponse: BatchResponse, batchIndex: number, totalBatches: number) => void
  ): BatchResult[] {
    if (emails.length === 0) {
      return [];
    }

    const allResults: BatchResult[] = [];
    const batches = createBatches(emails, CONFIG.MAX_BATCH_SIZE);
    
    AppLogger.info('📦 BATCH PROCESSING START', {
      totalEmails: emails.length,
      totalBatches: batches.length,
      maxBatchSize: CONFIG.MAX_BATCH_SIZE
    });

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch || batch.length === 0) {
        continue;
      }
      const batchResponse = processBatchClassification(apiKey, batch, basePrompt);
      
      allResults.push(...batchResponse.results);
      
      // Call progress callback if provided
      if (onBatchComplete) {
        onBatchComplete(batchResponse, i + 1, batches.length);
      }

      // Add delay between batches (except for the last one)
      if (i < batches.length - 1) {
        AppLogger.info('⏱️ BATCH DELAY', {
          batchIndex: i + 1,
          totalBatches: batches.length,
          delayMs: CONFIG.BATCH_DELAY_MS
        });
        Utilities.sleep(CONFIG.BATCH_DELAY_MS);
      }
    }

    AppLogger.info('✅ ALL BATCHES COMPLETE', {
      totalEmails: emails.length,
      totalBatches: batches.length,
      successCount: allResults.filter(r => !r.error).length,
      errorCount: allResults.filter(r => r.error).length
    });

    return allResults;
  }

  /**
   * Calculates potential token savings from batching
   */
  export function calculateBatchSavings(emailCount: number): {
    individualCalls: number;
    batchCalls: number;
    savedCalls: number;
    savePercentage: number;
  } {
    const individualCalls = emailCount;
    const batchCalls = Math.ceil(emailCount / CONFIG.MAX_BATCH_SIZE);
    const savedCalls = individualCalls - batchCalls;
    const savePercentage = emailCount > 0 ? Math.round((savedCalls / individualCalls) * 100) : 0;

    return {
      individualCalls,
      batchCalls,
      savedCalls,
      savePercentage
    };
  }
}