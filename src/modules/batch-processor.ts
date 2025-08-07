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
    label: string; // Dynamic label from AI/docs
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
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'type': 'array',
    'items': {
      'type': 'object',
      'required': ['id', 'label'],
      'properties': {
        'id': { 'type': 'string' },
        'label': { 'type': 'string', 'description': 'Dynamic label from docs - can be any label name' },
        'confidence': { 'type': 'number', 'minimum': 0, 'maximum': 1 },
        'reasoning': { 'type': 'string', 'maxLength': 200 }
      },
      'additionalProperties': false
    },
    'minItems': 1,
    'maxItems': CONFIG.MAX_BATCH_SIZE
  };

  // Schema for batch reply generation responses (for future use)
  export const BATCH_REPLY_SCHEMA = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    'type': 'array',
    'items': {
      'type': 'object',
      'required': ['id', 'reply'],
      'properties': {
        'id': { 'type': 'string' },
        'reply': { 'type': 'string', 'minLength': 1, 'maxLength': 2000 },
        'tone': { 'type': 'string', 'enum': ['formal', 'friendly', 'neutral'] },
        'category': { 'type': 'string', 'enum': ['inquiry', 'complaint', 'request', 'feedback', 'other'] }
      },
      'additionalProperties': false
    },
    'minItems': 1,
    'maxItems': CONFIG.MAX_BATCH_SIZE
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
    prompt += 'Each array element must have: "id" (string), "label" (exact label name from docs), optionally "confidence" (0-1) and "reasoning" (brief).\n';
    prompt += 'Example format: [{"id":"email1","label":"Support","confidence":0.9,"reasoning":"customer asking for help"}]\n\n';

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
    const batchId = 'batch_class_' + Date.now() + '_' + (typeof Utilities !== 'undefined' ? Utilities.getUuid().substr(0, 8) : Math.random().toString(36).substr(2, 8));
    const startTime = Date.now();
    const scriptStartTime = ContinuationTriggers.isApproachingTimeLimit(0) ? Date.now() : 0;

    AppLogger.info('🔄 BATCH CLASSIFICATION START', {
      batchId,
      emailCount: batch.length,
      maxBatchSize: CONFIG.MAX_BATCH_SIZE,
      scriptElapsedTime: scriptStartTime > 0 ? Date.now() - scriptStartTime + 'ms' : 'N/A'
    });

    // Check if we're already approaching time limit
    if (scriptStartTime > 0 && ExecutionTime.isApproachingLimit(scriptStartTime)) {
      const elapsedTime = ExecutionTime.getElapsedTime(scriptStartTime);
      throw new Error(`Script timeout: ${ExecutionTime.formatDuration(elapsedTime)} elapsed, cannot start new batch`);
    }

    try {
      const promptCreateStart = Date.now();
      const prompt = createBatchClassificationPrompt(batch, basePrompt);
      const promptCreateTime = Date.now() - promptCreateStart;
      
      AppLogger.info('📝 BATCH PROMPT CREATED', {
        batchId,
        promptLength: prompt.length,
        promptCreateTime: promptCreateTime + 'ms'
      });
      
      // Use fastest model for scanning
      const scanModel = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.SCAN_MODEL) || Config.GEMINI.DEFAULT_SCAN_MODEL;
      
      const apiCallStart = Date.now();
      const result = AI.callGemini<BatchResult[]>(apiKey, prompt, BATCH_CLASSIFICATION_SCHEMA, scanModel);
      const apiCallTime = Date.now() - apiCallStart;

      if (!result.success) {
        const processingTime = Date.now() - startTime;
        AppLogger.error('❌ BATCH CLASSIFICATION FAILED', {
          batchId,
          error: result.error,
          statusCode: result.statusCode,
          apiCallTime: apiCallTime + 'ms',
          totalProcessingTime: processingTime + 'ms'
        });

        // Return error result for all emails in batch
        const errorResults: BatchResult[] = batch.map(email => ({
          id: email.id,
          label: 'General',
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
            label: 'General',
            confidence: 0,
            reasoning: 'Missing from batch response'
          });
        });
      }

      const postProcessStart = Date.now();
      // Post-processing timing
      const postProcessTime = Date.now() - postProcessStart;
      const processingTime = Date.now() - startTime;

      AppLogger.info('✅ BATCH CLASSIFICATION SUCCESS', {
        batchId,
        emailCount: batch.length,
        successCount: result.data.filter(r => !r.error).length,
        errorCount: result.data.filter(r => r.error).length,
        promptCreateTime: promptCreateTime + 'ms',
        apiCallTime: apiCallTime + 'ms',
        postProcessTime: postProcessTime + 'ms',
        totalProcessingTime: processingTime + 'ms',
        avgTimePerEmail: Math.round(processingTime / batch.length) + 'ms'
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
        processingTime: processingTime + 'ms',
        scriptElapsedTime: scriptStartTime > 0 ? Date.now() - scriptStartTime + 'ms' : 'N/A'
      });

      // Return error result for all emails in batch
      const errorResults: BatchResult[] = batch.map(email => ({
        id: email.id,
        label: 'General',
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
    
    const overallStartTime = Date.now();
    
    AppLogger.info('📦 BATCH PROCESSING START', {
      totalEmails: emails.length,
      totalBatches: batches.length,
      maxBatchSize: CONFIG.MAX_BATCH_SIZE,
      averageEmailsPerBatch: Math.round(emails.length / batches.length)
    });

    for (let i = 0; i < batches.length; i++) {
      const batchStartTime = Date.now();
      const batch = batches[i];
      if (!batch || batch.length === 0) {
        continue;
      }
      
      AppLogger.info('🔢 PROCESSING BATCH', {
        batchNumber: i + 1,
        totalBatches: batches.length,
        emailsInBatch: batch.length,
        progressPercentage: Math.round(((i + 1) / batches.length) * 100) + '%'
      });
      
      const batchResponse = processBatchClassification(apiKey, batch, basePrompt);
      const batchTime = Date.now() - batchStartTime;
      
      allResults.push(...batchResponse.results);
      
      // Call progress callback if provided
      if (onBatchComplete) {
        const callbackStart = Date.now();
        onBatchComplete(batchResponse, i + 1, batches.length);
        const callbackTime = Date.now() - callbackStart;
        if (callbackTime > 100) {
          AppLogger.warn('⚠️ SLOW CALLBACK', {
            batchNumber: i + 1,
            callbackTime: callbackTime + 'ms'
          });
        }
      }

      AppLogger.info('✅ BATCH COMPLETE', {
        batchNumber: i + 1,
        totalBatches: batches.length,
        batchTime: batchTime + 'ms',
        averageTimePerEmail: Math.round(batchTime / batch.length) + 'ms',
        overallElapsed: (Date.now() - overallStartTime) + 'ms'
      });

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

    const overallTime = Date.now() - overallStartTime;
    
    AppLogger.info('✅ ALL BATCHES COMPLETE', {
      totalEmails: emails.length,
      totalBatches: batches.length,
      successCount: allResults.filter(r => !r.error).length,
      errorCount: allResults.filter(r => r.error).length,
      totalProcessingTime: overallTime + 'ms',
      averageTimePerEmail: Math.round(overallTime / emails.length) + 'ms',
      averageTimePerBatch: Math.round(overallTime / batches.length) + 'ms'
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