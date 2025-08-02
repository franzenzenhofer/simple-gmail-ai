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
    const escapedProcessedLabel = escapeLabelForSearch(Config.LABELS.AI_PROCESSED);
    const recentQuery = 'in:inbox -label:' + escapedProcessedLabel;
    const unreadQuery = 'in:inbox is:unread -label:' + escapedProcessedLabel;
    
    AppLogger.info('🔍 SEARCHING FOR UNPROCESSED EMAILS', {
      recentQuery: recentQuery,
      unreadQuery: unreadQuery,
      aiProcessedLabel: Config.LABELS.AI_PROCESSED
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
    
    // Step 1: Prepare emails for batch classification
    const emailsToClassify: AI.BatchClassificationRequest[] = [];
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
          body: body
        });
        
        threadMap.set(threadId, {
          thread: thread,
          body: body,
          subject: subject,
          sender: sender
        });
      } catch (error) {
        AppLogger.error('Failed to prepare thread for classification', {
          threadId: thread.getId(),
          error: String(error)
        });
        results.set(thread.getId(), {
          threadId: thread.getId(),
          isSupport: false,
          error: String(error)
        });
      }
    });
    
    // Step 2: Batch classify all emails
    const classifications = AI.batchClassifyEmails(apiKey, emailsToClassify, classificationPrompt);
    
    // Step 3: Process classification results and apply labels
    const supportLabel = getOrCreateLabel(Config.LABELS.SUPPORT);
    const notSupportLabel = getOrCreateLabel(Config.LABELS.NOT_SUPPORT);
    const processedLabel = getOrCreateLabel(Config.LABELS.AI_PROCESSED);
    
    const supportThreads: Array<{threadId: string, thread: GoogleAppsScript.Gmail.GmailThread, body: string, subject: string, sender: string}> = [];
    
    classifications.forEach(result => {
      const threadData = threadMap.get(result.id);
      if (!threadData) return;
      
      const isSupport = result.classification.indexOf('support') === 0;
      
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
        AppLogger.error('Failed to apply labels', {
          threadId: result.id,
          error: String(error)
        });
        results.set(result.id, {
          threadId: result.id,
          isSupport: isSupport,
          error: String(error)
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
                subject: subject,
                to: sender,
                replyLength: replyBody.length,
                threadId: threadId
              });
            } else {
              thread.createDraftReply(replyBody, { htmlBody: replyBody });
              AppLogger.info('✍️ DRAFT CREATED', {
                subject: subject,
                draftLength: replyBody.length,
                threadId: threadId
              });
            }
          }
        } catch (error) {
          AppLogger.error('Failed to create reply', {
            threadId: threadId,
            error: String(error)
          });
          // Update the result with the error
          const existingResult = results.get(threadId);
          if (existingResult) {
            existingResult.error = String(error);
          }
        }
      });
    }
    
    AppLogger.info('✅ BATCH PROCESSING COMPLETE', {
      totalThreads: threads.length,
      supportCount: Array.from(results.values()).filter(r => r.isSupport).length,
      errorCount: Array.from(results.values()).filter(r => r.error).length
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
      
      AppLogger.info('🎯 CLASSIFICATION RESULT', {
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
      return { isSupport: false, error: String(error) };
    }
  }
}