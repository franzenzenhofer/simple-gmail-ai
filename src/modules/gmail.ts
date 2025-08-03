/**
 * Gmail Service Module
 * Handles all Gmail operations
 */

namespace GmailService {
  export interface ProcessingResult {
    threadId: string;
    isSupport: boolean;
    error?: string;
  }
  
  
  export function getOrCreateLabel(name: string): GoogleAppsScript.Gmail.GmailLabel {
    try {
      // T-19: Use label cache for resilient label operations
      return LabelCache.getOrCreateLabel(name);
    } catch (error) {
      // Re-throw as structured error
      throw ErrorTaxonomy.createError(
        ErrorTaxonomy.AppErrorType.GMAIL_LABEL_CREATE_FAILED,
        'Failed to create label: ' + name,
        { labelName: name, originalError: error }
      );
    }
  }
  
  export function getUnprocessedThreads(): GoogleAppsScript.Gmail.GmailThread[] {
    // T-20: Use smart delta processing instead of manual search queries
    const scanResult = HistoryDelta.getEmailsToProcess();
    
    AppLogger.info('📊 DELTA SCAN COMPLETE', {
      scanType: scanResult.scanType,
      threadsFound: scanResult.threads.length,
      summary: scanResult.summary
    });
    
    // T-10: Check if test mode is active and limit results
    // Use dynamic check to avoid circular dependency
    try {
      const testModeConfigStr = PropertiesService.getUserProperties().getProperty('TEST_MODE_CONFIG');
      if (testModeConfigStr) {
        const testConfig = JSON.parse(testModeConfigStr);
        if (testConfig.enabled) {
          AppLogger.info('🧪 TEST MODE: Limiting results to 1 email');
          return scanResult.threads.slice(0, 1);
        }
      }
    } catch (e) {
      // Ignore test mode check errors
    }
    
    return scanResult.threads;
  }
  
  export function processThreadsWithContinuation(
    threads: GoogleAppsScript.Gmail.GmailThread[],
    apiKey: string,
    createDrafts: boolean,
    autoReply: boolean,
    classificationPrompt: string,
    responsePrompt: string
  ): {
    results: Map<string, ProcessingResult>;
    needsContinuation: boolean;
    continuationState?: any;
  } {
    // Check if we need continuation support
    const continuationCheck = ContinuationTriggers.processThreadsWithContinuation(
      threads,
      apiKey,
      createDrafts,
      autoReply,
      classificationPrompt,
      responsePrompt
    );
    
    if (continuationCheck.needsContinuation) {
      // Process as many threads as we can in this execution
      const batchSize = Math.min(50, threads.length);
      const batchThreads = threads.slice(0, batchSize);
      
      const results = processThreads(
        batchThreads,
        apiKey,
        createDrafts,
        autoReply,
        classificationPrompt,
        responsePrompt
      );
      
      AppLogger.info('🔄 PROCESSED INITIAL BATCH FOR CONTINUATION', {
        processedCount: results.size,
        totalThreads: threads.length,
        continuationRequired: true
      });
      
      return {
        results,
        needsContinuation: true,
        continuationState: continuationCheck.continuationState
      };
    }
    
    // For smaller inboxes, process normally
    const results = processThreads(
      threads,
      apiKey,
      createDrafts,
      autoReply,
      classificationPrompt,
      responsePrompt
    );
    
    return {
      results,
      needsContinuation: false
    };
  }

  export function processThreads(
    threads: GoogleAppsScript.Gmail.GmailThread[],
    apiKey: string,
    createDrafts: boolean,
    autoReply: boolean,
    classificationPrompt: string,
    responsePrompt: string
  ): Map<string, ProcessingResult> {
    const results = new Map<string, ProcessingResult>();
    
    if (threads.length === 0) return results;
    
    AppLogger.info('📦 BATCH PROCESSING START', {
      threadCount: threads.length,
      mode: autoReply ? 'AUTO-REPLY' : (createDrafts ? 'DRAFT' : 'LABEL-ONLY')
    });
    
    // Step 1: Prepare emails for batch classification using new BatchProcessor
    const emailsToClassify: BatchProcessor.BatchItem[] = [];
    const threadMap = new Map<string, {thread: GoogleAppsScript.Gmail.GmailThread, body: string, redactedBody: string, subject: string, sender: string}>();
    
    threads.forEach(thread => {
      try {
        const messages = thread.getMessages();
        if (messages.length === 0) {
          results.set(thread.getId(), { threadId: thread.getId(), isSupport: false });
          return;
        }
        
        const msg = messages[messages.length - 1];
        if (!msg) {
          results.set(thread.getId(), { threadId: thread.getId(), isSupport: false });
          return;
        }
        
        const body = msg.getPlainBody().trim();
        if (!body) {
          results.set(thread.getId(), { threadId: thread.getId(), isSupport: false });
          return;
        }
        
        const subject = thread.getFirstMessageSubject();
        const sender = msg.getFrom();
        const threadId = thread.getId();
        
        // T-12: Redact PII before batch classification
        const redactionResult = Redaction.redactPII(body, threadId);
        const redactedBody = redactionResult.redactedText;
        
        if (redactionResult.redactionCount > 0) {
          AppLogger.info('🔒 PII REDACTED FOR BATCH', {
            threadId: threadId,
            tokensRedacted: redactionResult.redactionCount
          });
        }
        
        emailsToClassify.push({
          id: threadId,
          subject: subject,
          body: redactedBody, // Use redacted body for classification
          threadId: threadId
        });
        
        threadMap.set(threadId, {
          thread: thread,
          body: body, // Keep original body for draft generation context
          redactedBody: redactedBody, // Store redacted version too
          subject: subject,
          sender: sender
        });
      } catch (error) {
        const errorMessage = Utils.logAndHandleError(error, `Thread preparation for ${thread.getId()}`);
        results.set(thread.getId(), {
          threadId: thread.getId(),
          isSupport: false,
          error: errorMessage
        });
      }
    });
    
    // Step 2: Check for cancellation before batch classification
    if (PropertiesService.getUserProperties().getProperty('ANALYSIS_CANCELLED') === 'true') {
      AppLogger.info('🛑 Processing cancelled before classification');
      return results;
    }
    
    // Batch classify all emails using the new BatchProcessor
    const savings = BatchProcessor.calculateBatchSavings(emailsToClassify.length);
    AppLogger.info('📊 BATCH PROCESSING SAVINGS', {
      totalEmails: emailsToClassify.length,
      individualCalls: savings.individualCalls,
      batchCalls: savings.batchCalls,
      savedCalls: savings.savedCalls,
      savePercentage: savings.savePercentage
    });

    const classifications = BatchProcessor.processAllBatches(
      apiKey, 
      emailsToClassify, 
      classificationPrompt,
      (batchResponse, batchIndex, totalBatches) => {
        AppLogger.info('🔄 BATCH PROGRESS', {
          batchIndex,
          totalBatches,
          emailsInBatch: batchResponse.results.length,
          processingTime: batchResponse.processingTime,
          success: batchResponse.success
        });
      }
    );
    
    // Step 3: Process classification results and apply labels
    const supportLabel = getOrCreateLabel(Config.LABELS.SUPPORT);
    const notSupportLabel = getOrCreateLabel(Config.LABELS.NOT_SUPPORT);
    const processedLabel = getOrCreateLabel(Config.LABELS.AI_PROCESSED);
    
    const supportThreads: Array<{threadId: string, thread: GoogleAppsScript.Gmail.GmailThread, body: string, redactedBody: string, subject: string, sender: string}> = [];
    
    classifications.forEach(result => {
      // Check for cancellation on each thread
      if (PropertiesService.getUserProperties().getProperty('ANALYSIS_CANCELLED') === 'true') {
        AppLogger.info('🛑 Processing cancelled during labeling');
        return; // Stop processing remaining threads
      }
      
      const threadData = threadMap.get(result.id);
      if (!threadData) return;
      
      const isSupport = result.label === 'support';
      
      try {
        if (isSupport) {
          threadData.thread.addLabel(supportLabel);
          threadData.thread.removeLabel(notSupportLabel);
          
          if (createDrafts || autoReply) {
            supportThreads.push({
              threadId: result.id,
              thread: threadData.thread,
              body: threadData.body,
              redactedBody: threadData.redactedBody, // T-12: Include redacted body
              subject: threadData.subject,
              sender: threadData.sender
            });
          }
        } else {
          threadData.thread.addLabel(notSupportLabel);
          threadData.thread.removeLabel(supportLabel);
        }
        
        threadData.thread.addLabel(processedLabel);
        
        results.set(result.id, {
          threadId: result.id,
          isSupport: isSupport,
          error: result.error
        });
        
      } catch (error) {
        const errorMessage = Utils.logAndHandleError(error, `Label application for thread ${result.id}`);
        results.set(result.id, {
          threadId: result.id,
          isSupport: isSupport,
          error: errorMessage
        });
      }
    });
    
    // Step 4: Generate replies for support emails (individually, as they need custom responses)
    if (supportThreads.length > 0 && (createDrafts || autoReply)) {
      AppLogger.info('✍️ GENERATING REPLIES', {
        supportCount: supportThreads.length,
        mode: autoReply ? 'AUTO-SEND' : 'DRAFT'
      });
      
      supportThreads.forEach(({threadId, thread, redactedBody, subject, sender}) => {
        try {
          // T-12: Use redacted body for AI reply generation
          // T-14: Use structured JSON response for batch reply generation
          const replySchema = {
            type: 'object',
            properties: {
              reply: {
                type: 'string'
              }
            },
            required: ['reply']
          };
          
          const replyPrompt = responsePrompt + '\n' + redactedBody + '\n---------- END ----------\n\nRespond with JSON containing a "reply" field with the email response.';
          const replyResult = AI.callGemini(apiKey, replyPrompt, replySchema);
          
          if (replyResult.success && replyResult.data) {
            // T-14: Parse structured response
            let replyData: any;
            try {
              replyData = typeof replyResult.data === 'string' 
                ? JSON.parse(replyResult.data)
                : replyResult.data;
            } catch (e) {
              // Fallback to direct string if JSON parse fails
              replyData = { reply: replyResult.data };
            }
            
            // T-12: Restore PII in the reply
            const replyBody = Redaction.restorePII(replyData.reply || replyData, threadId);
            
            // T-16: Validate reply with guardrails before sending/drafting
            const validation = Guardrails.validateReply(replyBody);
            if (!validation.isValid) {
              // Apply guardrails failed label and skip sending
              Guardrails.applyGuardrailsLabel(thread, validation.failureReasons.join('; '));
              AppLogger.warn('🚫 REPLY BLOCKED BY GUARDRAILS', {
                shortMessage: 'Reply blocked for "' + subject + '" - ' + validation.failureReasons[0],
                subject: subject,
                threadId: threadId,
                reasons: validation.failureReasons,
                replyLength: replyBody.length
              });
              
              // Update result to show guardrails failure
              const existingResult = results.get(threadId);
              if (existingResult) {
                existingResult.error = 'Guardrails failed: ' + validation.failureReasons.join('; ');
              }
            } else {
              // Guardrails passed - proceed with reply/draft
              if (autoReply) {
                thread.reply(replyBody, { htmlBody: replyBody });
                AppLogger.info('📤 EMAIL SENT', {
                  shortMessage: 'Sent reply to "' + subject + '" → ' + sender,
                  subject: subject,
                  to: sender,
                  replyLength: replyBody.length,
                  threadId: threadId
                });
                // Clear any draft metadata since we sent the email
                DraftTracker.clearDraftMetadata(threadId);
              } else {
                // Check for duplicate drafts before creating
                if (DraftTracker.isDuplicateDraft(threadId, replyBody)) {
                  AppLogger.info('⏭️ DRAFT SKIPPED (DUPLICATE)', {
                    shortMessage: 'Duplicate draft skipped for: ' + subject,
                    subject: subject,
                    threadId: threadId
                  });
                } else {
                  thread.createDraftReply(replyBody, { htmlBody: replyBody });
                  // Record the draft creation
                  DraftTracker.recordDraftCreation(threadId, replyBody);
                  AppLogger.info('✍️ DRAFT CREATED', {
                    shortMessage: 'Draft created for: ' + subject,
                    subject: subject,
                    draftLength: replyBody.length,
                    threadId: threadId
                  });
                }
              }
            }
            
            // T-12: Clear redaction cache after successful processing
            Redaction.clearRedactionCache(threadId);
          }
        } catch (error) {
          const errorMessage = Utils.logAndHandleError(error, `Reply creation for thread ${threadId}`);
          // Update the result with the error
          const existingResult = results.get(threadId);
          if (existingResult) {
            existingResult.error = errorMessage;
          }
        }
      });
    }
    
    const successCount = Array.from(results.values()).filter(r => !r.error).length;
    const errorCount = Array.from(results.values()).filter(r => r.error).length;
    
    Utils.logBatchComplete('batch classification', {
      totalEmails: threads.length,
      successCount: successCount,
      errorCount: errorCount,
      shortMessage: 'Batch complete: ' + successCount + '/' + threads.length + ' emails classified'
    });
    
    return results;
  }
  
  // Keep the old single-thread function for backward compatibility
  export function processThread(
    thread: GoogleAppsScript.Gmail.GmailThread,
    apiKey: string,
    createDrafts: boolean,
    autoReply: boolean,
    classificationPrompt: string,
    responsePrompt: string
  ): { isSupport: boolean; error?: string } {
    // T-10: Check if test mode is active
    // Use dynamic check to avoid circular dependency
    let testConfig: any = null;
    try {
      const testModeConfigStr = PropertiesService.getUserProperties().getProperty('TEST_MODE_CONFIG');
      if (testModeConfigStr) {
        testConfig = JSON.parse(testModeConfigStr);
        if (testConfig.enabled) {
          AppLogger.info('🧪 TEST MODE: Processing thread without mutations', {
            threadId: thread.getId(),
            skipLabeling: testConfig.skipLabeling,
            skipDraftCreation: testConfig.skipDraftCreation
          });
          
          // Override settings for test mode
          if (testConfig.skipDraftCreation) {
            createDrafts = false;
            autoReply = false;
          }
        }
      }
    } catch (e) {
      // Ignore test mode check errors
    }
    
    try {
      const messages = thread.getMessages();
      if (messages.length === 0) return { isSupport: false };
      
      const msg = messages[messages.length - 1];
      if (!msg) return { isSupport: false };
      const body = msg.getPlainBody().trim();
      if (!body) return { isSupport: false };
      
      const subject = thread.getFirstMessageSubject();
      const sender = msg.getFrom();
      
      AppLogger.info('📧 PROCESSING EMAIL', {
        shortMessage: 'Processing: ' + subject,
        subject: subject,
        from: sender,
        messageLength: body.length,
        threadId: thread.getId()
      });
      
      // T-12: Redact PII before sending to AI
      const redactionResult = Redaction.redactPII(body, thread.getId());
      const redactedBody = redactionResult.redactedText;
      
      if (redactionResult.redactionCount > 0) {
        AppLogger.info('🔒 PII REDACTED FOR CLASSIFICATION', {
          threadId: thread.getId(),
          tokensRedacted: redactionResult.redactionCount
        });
      }
      
      // T-14: Use structured JSON response for classification
      const classificationSchema = {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            enum: ['support', 'not']
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          category: {
            type: 'string',
            enum: ['technical', 'billing', 'feature_request', 'bug_report', 'general', 'not_support']
          }
        },
        required: ['label']
      };
      
      const fullPrompt = classificationPrompt + '\n' + redactedBody + '\n---------- EMAIL END ----------\n\nRespond with JSON containing "label" field with value "support" or "not".';
      const classificationResult = AI.callGemini(apiKey, fullPrompt, classificationSchema);
      
      if (!classificationResult.success) {
        throw new Error(classificationResult.error);
      }
      
      // T-14: Parse structured response
      let classificationData: any;
      try {
        classificationData = typeof classificationResult.data === 'string' 
          ? JSON.parse(classificationResult.data)
          : classificationResult.data;
      } catch (e) {
        // Fallback to string parsing if JSON parse fails
        AppLogger.warn('Failed to parse classification as JSON, falling back to string', {
          response: classificationResult.data,
          error: String(e)
        });
        classificationData = { label: String(classificationResult.data).toLowerCase().includes('support') ? 'support' : 'not' };
      }
      
      const isSupport = classificationData.label === 'support';
      
      AppLogger.info('🎯 EMAIL CLASSIFIED', {
        shortMessage: 'Classified "' + subject + '" as ' + classificationData.label.toUpperCase(),
        subject: subject,
        classification: classificationData.label,
        confidence: classificationData.confidence,
        category: classificationData.category,
        isSupport: isSupport,
        threadId: thread.getId()
      });
      
      const supportLabel = getOrCreateLabel(Config.LABELS.SUPPORT);
      const notSupportLabel = getOrCreateLabel(Config.LABELS.NOT_SUPPORT);
      const processedLabel = getOrCreateLabel(Config.LABELS.AI_PROCESSED);
      
      // T-10: Skip labeling in test mode if configured
      const shouldApplyLabels = !(testConfig && testConfig.enabled && testConfig.skipLabeling);
      
      if (isSupport) {
        if (shouldApplyLabels) {
          thread.addLabel(supportLabel);
          thread.removeLabel(notSupportLabel);
        }
        
        if (createDrafts || autoReply) {
          AppLogger.info('✍️ GENERATING REPLY', {
            subject: subject,
            mode: autoReply ? 'AUTO-SEND' : 'DRAFT',
            threadId: thread.getId()
          });
          
          // T-12: Use redacted body for reply generation (already redacted above)
          // T-14: Use structured JSON response for reply generation
          const replySchema = {
            type: 'object',
            properties: {
              reply: {
                type: 'string'
              },
              tone: {
                type: 'string',
                enum: ['formal', 'friendly', 'technical', 'empathetic']
              },
              requiresEscalation: {
                type: 'boolean'
              }
            },
            required: ['reply']
          };
          
          const replyPrompt = responsePrompt + '\n' + redactedBody + '\n---------- END ----------\n\nRespond with JSON containing a "reply" field with the email response.';
          const replyResult = AI.callGemini(apiKey, replyPrompt, replySchema);
          
          if (replyResult.success && replyResult.data) {
            // T-14: Parse structured response
            let replyData: any;
            try {
              replyData = typeof replyResult.data === 'string' 
                ? JSON.parse(replyResult.data)
                : replyResult.data;
            } catch (e) {
              // Fallback to direct string if JSON parse fails
              AppLogger.warn('Failed to parse reply as JSON, using as plain text', {
                response: replyResult.data,
                error: String(e)
              });
              replyData = { reply: replyResult.data };
            }
            
            // T-12: Restore PII in the reply before sending/saving
            const replyBody = Redaction.restorePII(replyData.reply || replyData, thread.getId());
            
            // T-16: Validate reply with guardrails before sending/drafting
            const validation = Guardrails.validateReply(replyBody);
            if (!validation.isValid) {
              // Apply guardrails failed label and skip sending
              Guardrails.applyGuardrailsLabel(thread, validation.failureReasons.join('; '));
              AppLogger.warn('🚫 REPLY BLOCKED BY GUARDRAILS', {
                subject: subject,
                threadId: thread.getId(),
                reasons: validation.failureReasons,
                replyLength: replyBody.length
              });
              // Return error to indicate guardrails failure
              return { isSupport, error: 'Guardrails failed: ' + validation.failureReasons.join('; ') };
            } else {
              // Guardrails passed - proceed with reply/draft
              if (autoReply) {
                thread.reply(replyBody, { htmlBody: replyBody });
                AppLogger.info('📤 EMAIL SENT', {
                  subject: subject,
                  to: sender,
                  replyLength: replyBody.length,
                  threadId: thread.getId()
                });
              } else {
                thread.createDraftReply(replyBody, { htmlBody: replyBody });
                AppLogger.info('📝 DRAFT CREATED', {
                  subject: subject,
                  replyLength: replyBody.length,
                  threadId: thread.getId()
                });
              }
            }
            
            // T-12: Clear redaction cache after successful processing
            Redaction.clearRedactionCache(thread.getId());
          }
        }
      } else {
        if (shouldApplyLabels) {
          thread.addLabel(notSupportLabel);
          thread.removeLabel(supportLabel);
        }
      }
      
      if (shouldApplyLabels) {
        thread.addLabel(processedLabel);
      }
      
      return { isSupport };
      
    } catch (error) {
      const errorLabel = getOrCreateLabel(Config.LABELS.AI_ERROR);
      thread.addLabel(errorLabel);
      const errorMessage = Utils.logAndHandleError(error, `Thread processing for ${thread.getId()}`);
      return { isSupport: false, error: errorMessage };
    }
  }
}