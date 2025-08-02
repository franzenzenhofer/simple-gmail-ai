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
  
  // Escape label names for Gmail search queries
  function escapeLabelForSearch(label: string): string {
    // Gmail requires quotes around labels with spaces or special characters
    if (label.includes(' ') || label.includes('(') || label.includes(')') || label.includes('✓') || label.includes('✗')) {
      return '"' + label + '"';
    }
    return label;
  }
  
  export function getOrCreateLabel(name: string): GoogleAppsScript.Gmail.GmailLabel {
    try {
      let label = GmailApp.getUserLabelByName(name);
      if (!label) {
        // Try to create the label
        label = GmailApp.createLabel(name);
        AppLogger.info('Created new Gmail label', { labelName: name });
      }
      return label;
    } catch (error) {
      // Label might have been created by concurrent execution
      const label = GmailApp.getUserLabelByName(name);
      if (label) {
        return label;
      }
      // Re-throw if label still doesn't exist
      throw error;
    }
  }
  
  export function getUnprocessedThreads(): GoogleAppsScript.Gmail.GmailThread[] {
    // CRITICAL: Exclude BOTH AI_PROCESSED and AI_ERROR labels to prevent reprocessing
    const escapedProcessedLabel = escapeLabelForSearch(Config.LABELS.AI_PROCESSED);
    const escapedErrorLabel = escapeLabelForSearch(Config.LABELS.AI_ERROR);
    
    // Build query to exclude any email that has been touched by AI
    const recentQuery = 'in:inbox -label:' + escapedProcessedLabel + ' -label:' + escapedErrorLabel;
    const unreadQuery = 'in:inbox is:unread -label:' + escapedProcessedLabel + ' -label:' + escapedErrorLabel;
    
    AppLogger.info('🔍 SEARCHING FOR UNPROCESSED EMAILS', {
      recentQuery: recentQuery,
      unreadQuery: unreadQuery,
      excludedLabels: [Config.LABELS.AI_PROCESSED, Config.LABELS.AI_ERROR]
    });
    
    const recent = GmailApp.search(recentQuery, 0, 50);
    const unread = GmailApp.search(unreadQuery);
    
    AppLogger.info('📊 SEARCH RESULTS', {
      recentCount: recent.length,
      unreadCount: unread.length,
      totalBeforeDedup: recent.length + unread.length
    });
    
    const threadIds = new Set<string>();
    const threads: GoogleAppsScript.Gmail.GmailThread[] = [];
    
    [...recent, ...unread].forEach(thread => {
      const id = thread.getId();
      if (!threadIds.has(id)) {
        threadIds.add(id);
        threads.push(thread);
      }
    });
    
    AppLogger.info('✅ FINAL THREAD LIST', {
      uniqueThreads: threads.length,
      threadIds: threads.slice(0, 5).map(t => t.getId()) // Show first 5 IDs
    });
    
    return threads;
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
    const threadMap = new Map<string, {thread: GoogleAppsScript.Gmail.GmailThread, body: string, subject: string, sender: string}>();
    
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
        
        emailsToClassify.push({
          id: threadId,
          subject: subject,
          body: body,
          threadId: threadId
        });
        
        threadMap.set(threadId, {
          thread: thread,
          body: body,
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
    
    const supportThreads: Array<{threadId: string, thread: GoogleAppsScript.Gmail.GmailThread, body: string, subject: string, sender: string}> = [];
    
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
      
      supportThreads.forEach(({threadId, thread, body, subject, sender}) => {
        try {
          const replyPrompt = responsePrompt + '\n' + body + '\n---------- END ----------';
          const replyResult = AI.callGemini(apiKey, replyPrompt);
          
          if (replyResult.success && replyResult.data) {
            const replyBody = replyResult.data;
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
    const supportCount = Array.from(results.values()).filter(r => r.isSupport).length;
    const errorCount = Array.from(results.values()).filter(r => r.error).length;
    
    AppLogger.info('✅ BATCH CLASSIFICATION COMPLETE', {
      shortMessage: 'Batch complete: ' + successCount + '/' + threads.length + ' emails classified',
      totalThreads: threads.length,
      totalEmails: threads.length,
      successCount: successCount,
      supportCount: supportCount,
      errorCount: errorCount
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
      
      const fullPrompt = classificationPrompt + '\n' + body + '\n---------- EMAIL END ----------';
      const classificationResult = AI.callGemini(apiKey, fullPrompt);
      
      if (!classificationResult.success) {
        throw new Error(classificationResult.error);
      }
      
      const classification = classificationResult.data.toLowerCase();
      
      const isSupport = classification.indexOf('support') === 0;
      
      AppLogger.info('🎯 EMAIL CLASSIFIED', {
        shortMessage: 'Classified "' + subject + '" as ' + classification.toUpperCase(),
        subject: subject,
        classification: classification,
        isSupport: isSupport,
        threadId: thread.getId()
      });
      
      const supportLabel = getOrCreateLabel(Config.LABELS.SUPPORT);
      const notSupportLabel = getOrCreateLabel(Config.LABELS.NOT_SUPPORT);
      const processedLabel = getOrCreateLabel(Config.LABELS.AI_PROCESSED);
      
      if (isSupport) {
        thread.addLabel(supportLabel);
        thread.removeLabel(notSupportLabel);
        
        if (createDrafts || autoReply) {
          AppLogger.info('✍️ GENERATING REPLY', {
            subject: subject,
            mode: autoReply ? 'AUTO-SEND' : 'DRAFT',
            threadId: thread.getId()
          });
          
          const replyPrompt = responsePrompt + '\n' + body + '\n---------- END ----------';
          const replyResult = AI.callGemini(apiKey, replyPrompt);
          
          if (replyResult.success && replyResult.data) {
            const replyBody = replyResult.data;
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
        }
      } else {
        thread.addLabel(notSupportLabel);
        thread.removeLabel(supportLabel);
      }
      
      thread.addLabel(processedLabel);
      return { isSupport };
      
    } catch (error) {
      const errorLabel = getOrCreateLabel(Config.LABELS.AI_ERROR);
      thread.addLabel(errorLabel);
      const errorMessage = Utils.logAndHandleError(error, `Thread processing for ${thread.getId()}`);
      return { isSupport: false, error: errorMessage };
    }
  }
}