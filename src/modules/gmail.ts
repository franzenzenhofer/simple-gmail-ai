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
  
  // Email routing context interfaces
  export interface EmailContext {
    originalSender: string;
    replyTo?: string;
    allRecipients: {
      to: string[];
      cc: string[];
      bcc: string[];
    };
    threadId: string;
    isMailingList: boolean;
    hasNoReply: boolean;
    listHeaders?: {
      listId?: string;
      listUnsubscribe?: string;
      listPost?: string;
    };
    messageId: string;
    subject: string;
    suggestedMode?: 'reply' | 'reply-all' | 'forward';
  }
  
  export interface RecipientDecision {
    to: string[];
    cc?: string[];
    bcc?: string[];
    reason: string;
    mode: 'reply' | 'reply-all' | 'forward';
    warnings?: string[];
  }
  
  /**
   * Get the appropriate prompt for classification - ONLY from Docs
   */
  export function getClassificationPrompt(_basePrompt: string, threadLabels: string[]): string {
    try {
      // Check if Docs prompt editor is configured
      const hasDocsPrompts = DocsPromptEditor.hasCompiledPrompts();
      if (!hasDocsPrompts) {
        throw new Error('No prompt document configured. Please create a prompt document first.');
      }
      
      // Get prompt for the thread's labels - NO FALLBACKS!
      const promptConfig = DocsPromptEditor.getPromptForLabels(threadLabels);
      if (!promptConfig || !promptConfig.classificationPrompt) {
        throw new Error('No prompt document configured. Please create a prompt document first.');
      }
      
      AppLogger.info('📝 Using Docs prompt for labels', { 
        labels: threadLabels,
        promptLabel: promptConfig.label 
      });
      
      return promptConfig.classificationPrompt;
    } catch (error) {
      // NO FALLBACKS - prompts must come from docs
      AppLogger.error('Docs prompt error - cannot continue', { 
        error: String(error),
        labels: threadLabels 
      });
      throw new Error('Prompt configuration error: ' + error);
    }
  }
  
  /**
   * Get the appropriate response prompt - ONLY from Docs
   */
  function getResponsePrompt(_basePrompt: string, threadLabels: string[]): string {
    try {
      // Check if Docs prompt editor is configured
      const hasDocsPrompts = DocsPromptEditor.hasCompiledPrompts();
      if (!hasDocsPrompts) {
        throw new Error('No prompt document configured. Please create a prompt document first.');
      }
      
      // Get prompt for the thread's labels - NO FALLBACKS!
      const promptConfig = DocsPromptEditor.getPromptForLabels(threadLabels);
      if (!promptConfig || !promptConfig.responsePrompt) {
        throw new Error('No response prompt configured. Please create a prompt document first.');
      }
      
      AppLogger.info('📝 Using Docs response prompt for labels', { 
        labels: threadLabels,
        promptLabel: promptConfig.label 
      });
      
      return promptConfig.responsePrompt;
    } catch (error) {
      // NO FALLBACKS - prompts must come from docs
      AppLogger.error('Docs response prompt error - cannot continue', { 
        error: String(error),
        labels: threadLabels 
      });
      throw new Error('Response prompt configuration error: ' + error);
    }
  }
  
  /**
   * Extract comprehensive thread context for email routing
   * CRITICAL: This determines who receives the response
   */
  export function extractThreadContext(thread: GoogleAppsScript.Gmail.GmailThread): EmailContext {
    const messages = thread.getMessages();
    if (messages.length === 0) {
      throw new Error('Thread has no messages');
    }
    
    // Get the latest message for context
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage) {
      throw new Error('Unable to get latest message from thread');
    }
    
    // Extract sender and check for no-reply patterns
    const originalSender = latestMessage.getFrom();
    const hasNoReply = isNoReplyAddress(originalSender);
    
    // Get reply-to header if present
    let replyTo: string | undefined;
    try {
      // Note: getRawContent() contains headers but is expensive
      // For now, use getReplyTo() if available in future API versions
      // TODO: Parse raw content for Reply-To header if needed
      replyTo = undefined; // Placeholder for future implementation
    } catch (e) {
      // Ignore header parsing errors
    }
    
    // Extract all recipients
    const allRecipients = {
      to: parseEmailAddresses(latestMessage.getTo() || ''),
      cc: parseEmailAddresses(latestMessage.getCc() || ''),
      bcc: parseEmailAddresses(latestMessage.getBcc() || '')
    };
    
    // Check for mailing list headers
    const listHeaders = extractListHeaders(latestMessage);
    const isMailingList = !!(listHeaders.listId || listHeaders.listUnsubscribe);
    
    // Build context object
    const context: EmailContext = {
      originalSender,
      replyTo,
      allRecipients,
      threadId: thread.getId(),
      isMailingList,
      hasNoReply,
      listHeaders: isMailingList ? listHeaders : undefined,
      messageId: latestMessage.getId(),
      subject: thread.getFirstMessageSubject()
    };
    
    // Log context extraction
    AppLogger.info('📋 THREAD CONTEXT EXTRACTED', {
      threadId: thread.getId(),
      sender: originalSender,
      recipientCount: allRecipients.to.length + allRecipients.cc.length,
      hasNoReply,
      isMailingList,
      subject: context.subject
    });
    
    return context;
  }
  
  /**
   * Check if email address is a no-reply address
   */
  function isNoReplyAddress(email: string): boolean {
    const lowerEmail = email.toLowerCase();
    const noReplyPatterns = [
      'noreply@',
      'no-reply@',
      'donotreply@',
      'do-not-reply@',
      'notification@',
      'notifications@',
      'mailer-daemon@',
      'postmaster@'
    ];
    
    return noReplyPatterns.some(pattern => lowerEmail.includes(pattern));
  }
  
  /**
   * Extract single email address from a sender string (handles "Name <email>" format)
   */
  function extractEmailAddress(senderString: string): string {
    if (!senderString) return '';
    
    // Extract email from "Name <email>" format
    const emailMatch = senderString.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
      return emailMatch[1];
    }
    
    // If no angle brackets, assume it's already just an email
    return senderString.trim();
  }
  
  /**
   * Parse email addresses from a string (handles "Name <email>" format)
   */
  function parseEmailAddresses(emailString: string): string[] {
    if (!emailString) return [];
    
    // Split by comma and extract email addresses
    const addresses: string[] = [];
    const parts = emailString.split(',');
    
    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;
      
      // Extract email from "Name <email>" format
      const emailMatch = trimmed.match(/<([^>]+)>/);
      if (emailMatch && emailMatch[1]) {
        addresses.push(emailMatch[1]);
      } else if (trimmed.includes('@')) {
        addresses.push(trimmed);
      }
    });
    
    return addresses;
  }
  
  /**
   * Extract mailing list headers from message
   */
  function extractListHeaders(_message: GoogleAppsScript.Gmail.GmailMessage): NonNullable<EmailContext['listHeaders']> {
    // TODO: Implement raw header parsing
    // For now, return empty object
    // Future: Parse _message.getRawContent() for List-* headers
    return {
      listId: undefined,
      listUnsubscribe: undefined,
      listPost: undefined
    };
  }
  
  /**
   * Determine recipient strategy based on email context
   * CRITICAL: This decides who receives the response
   */
  export function determineRecipients(
    context: EmailContext,
    emailContent?: string
  ): RecipientDecision {
    const warnings: string[] = [];
    
    // Check for no-reply addresses
    if (context.hasNoReply) {
      warnings.push('WARNING: Sender is a no-reply address');
      return {
        to: [],
        cc: [],
        reason: 'Blocked: sender is a no-reply address',
        mode: 'reply',
        warnings
      };
    }
    
    // Check for mailing list
    if (context.isMailingList) {
      warnings.push('Email is from a mailing list');
      // TODO: Check list preferences for reply behavior
      return {
        to: [extractEmailAddress(context.originalSender)],
        reason: 'Mailing list: replying to sender only',
        mode: 'reply',
        warnings
      };
    }
    
    // Check for reply-to header
    if (context.replyTo && context.replyTo !== context.originalSender) {
      return {
        to: [extractEmailAddress(context.replyTo)],
        reason: 'Using Reply-To header',
        mode: 'reply',
        warnings
      };
    }
    
    // Analyze email content for forward indicators
    if (emailContent) {
      const lowerContent = emailContent.toLowerCase();
      const forwardPatterns = [
        'please forward to',
        'can you forward this to',
        'forward this to',
        'send this to',
        'pass this along to'
      ];
      
      const hasForwardRequest = forwardPatterns.some(pattern => 
        lowerContent.includes(pattern)
      );
      
      if (hasForwardRequest) {
        // TODO: Extract forward recipients from content
        warnings.push('Email contains forward request - manual review needed');
        return {
          to: [extractEmailAddress(context.originalSender)],
          reason: 'Forward request detected - needs manual review',
          mode: 'forward',
          warnings
        };
      }
    }
    
    // Check if email was sent to multiple people
    const totalRecipients = 
      context.allRecipients.to.length + 
      context.allRecipients.cc.length;
    
    if (totalRecipients > 2) {
      // Multiple recipients - analyze for reply-all indicators
      const replyAllIndicators = [
        'hi all',
        'hello all',
        'hi team',
        'hello team',
        'everyone',
        'hey guys',
        'dear all'
      ];
      
      const shouldReplyAll = emailContent ? 
        replyAllIndicators.some(indicator => 
          emailContent.toLowerCase().includes(indicator)
        ) : false;
      
      if (shouldReplyAll) {
        // Reply-all: include original recipients
        const allRecipients = new Set<string>();
        
        // Add original sender
        allRecipients.add(context.originalSender);
        
        // Add all TO recipients except ourselves
        // TODO: Get current user email to filter out
        context.allRecipients.to.forEach(email => allRecipients.add(email));
        
        return {
          to: Array.from(allRecipients),
          cc: context.allRecipients.cc,
          reason: 'Reply-all: email sent to group with group indicators',
          mode: 'reply-all',
          warnings
        };
      }
    }
    
    // Default: simple reply to sender
    return {
      to: [extractEmailAddress(context.originalSender)],
      reason: 'Standard reply to sender',
      mode: 'reply',
      warnings
    };
  }
  
  /**
   * Build recipient context for AI prompts
   * Provides the AI with information about who should receive the response
   */
  export function buildRecipientContext(
    emailContext: EmailContext,
    recipientDecision: RecipientDecision
  ): string {
    const lines: string[] = [];
    
    lines.push('\n--- RECIPIENT CONTEXT ---');
    lines.push('Original sender: ' + emailContext.originalSender);
    
    if (emailContext.allRecipients.to.length > 0) {
      lines.push('To: ' + emailContext.allRecipients.to.join(', '));
    }
    
    if (emailContext.allRecipients.cc.length > 0) {
      lines.push('CC: ' + emailContext.allRecipients.cc.join(', '));
    }
    
    if (emailContext.replyTo) {
      lines.push('Reply-To: ' + emailContext.replyTo);
    }
    
    if (emailContext.isMailingList) {
      lines.push('⚠️ This is a mailing list email');
    }
    
    if (emailContext.hasNoReply) {
      lines.push('⚠️ WARNING: Sender is a no-reply address');
    }
    
    lines.push('\nSuggested recipient mode: ' + recipientDecision.mode.toUpperCase());
    lines.push('Reason: ' + recipientDecision.reason);
    
    if (recipientDecision.warnings && recipientDecision.warnings.length > 0) {
      lines.push('\nWarnings:');
      recipientDecision.warnings.forEach(warning => lines.push('- ' + warning));
    }
    
    if (recipientDecision.to.length > 0) {
      lines.push('\nResponse will be sent to: ' + recipientDecision.to.join(', '));
      if (recipientDecision.cc && recipientDecision.cc.length > 0) {
        lines.push('CC: ' + recipientDecision.cc.join(', '));
      }
    } else {
      lines.push('\n❌ NO RECIPIENTS - Response blocked');
    }
    
    lines.push('--- END RECIPIENT CONTEXT ---\n');
    
    return lines.join('\n');
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
      const testModeConfigStr = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.TEST_MODE_CONFIG);
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
    continuationState?: ContinuationTriggers.ContinuationState;
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
    if (PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.ANALYSIS_CANCELLED) === 'true') {
      AppLogger.info('🛑 Processing cancelled before classification');
      return results;
    }
    
    // Group emails by label combinations for batch processing with appropriate prompts
    const emailsByPrompt = new Map<string, {prompt: string, emails: typeof emailsToClassify}>();
    
    emailsToClassify.forEach(email => {
      const threadData = threadMap.get(email.id);
      if (threadData) {
        const threadLabels = threadData.thread.getLabels().map(l => l.getName());
        const activePrompt = getClassificationPrompt(classificationPrompt, threadLabels);
        
        // Group by prompt
        if (!emailsByPrompt.has(activePrompt)) {
          emailsByPrompt.set(activePrompt, { prompt: activePrompt, emails: [] });
        }
        emailsByPrompt.get(activePrompt)!.emails.push(email);
      }
    });
    
    // Process each prompt group separately
    const allClassifications: Array<{id: string; label: string; confidence?: number; error?: string}> = [];
    
    emailsByPrompt.forEach(({prompt, emails}) => {
      const savings = BatchProcessor.calculateBatchSavings(emails.length);
      AppLogger.info('📊 BATCH PROCESSING GROUP', {
        totalEmails: emails.length,
        promptPreview: prompt.substring(0, 50) + '...',
        batchCalls: savings.batchCalls,
        savePercentage: savings.savePercentage
      });

      const classifications = BatchProcessor.processAllBatches(
        apiKey, 
        emails, 
        prompt,
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
      
      allClassifications.push(...classifications);
    });
    
    // Use all classifications for processing
    const classifications = allClassifications;
    
    // Step 3: Process classification results and apply labels
    const processedLabel = getOrCreateLabel(Config.LABELS.AI_PROCESSED);
    
    const supportThreads: Array<{threadId: string, thread: GoogleAppsScript.Gmail.GmailThread, body: string, redactedBody: string, subject: string, sender: string}> = [];
    
    classifications.forEach(result => {
      // Check for cancellation on each thread
      if (PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.ANALYSIS_CANCELLED) === 'true') {
        AppLogger.info('🛑 Processing cancelled during labeling');
        return; // Stop processing remaining threads
      }
      
      const threadData = threadMap.get(result.id);
      if (!threadData) return;
      
      // Dynamic label handling - label comes from AI/docs
      const labelToApply = result.label || 'General';
      const dynamicLabel = getOrCreateLabel(labelToApply);
      
      try {
        // Apply the dynamic label from AI
        threadData.thread.addLabel(dynamicLabel);
        
        // Check if this label should create drafts (from docs config)
        const docsPrompts = DocsPromptEditor.getPromptForLabels([labelToApply]);
        const shouldCreateDraft = docsPrompts && docsPrompts.responsePrompt && (createDrafts || autoReply);
        
        if (shouldCreateDraft) {
          supportThreads.push({
            threadId: result.id,
            thread: threadData.thread,
            body: threadData.body,
            redactedBody: threadData.redactedBody, // T-12: Include redacted body
            subject: threadData.subject,
            sender: threadData.sender
          });
        }
        
        threadData.thread.addLabel(processedLabel);
        
        results.set(result.id, {
          threadId: result.id,
          isSupport: shouldCreateDraft || false,
          error: result.error
        });
        
      } catch (error) {
        const errorMessage = Utils.logAndHandleError(error, `Label application for thread ${result.id}`);
        results.set(result.id, {
          threadId: result.id,
          isSupport: false,
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
      
      supportThreads.forEach(({threadId, thread, redactedBody, subject, sender, body}) => {
        // Check for cancellation at the start of each reply generation
        if (PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.ANALYSIS_CANCELLED) === 'true') {
          AppLogger.info('🛑 Processing cancelled during reply generation');
          return; // Skip remaining threads
        }
        
        try {
          // Extract thread context for recipient determination
          const emailContext = extractThreadContext(thread);
          const recipientDecision = determineRecipients(emailContext, body);
          
          // Check if we should block the response
          if (recipientDecision.to.length === 0) {
            AppLogger.warn('🚫 RESPONSE BLOCKED - NO VALID RECIPIENTS', {
              threadId: threadId,
              subject: subject,
              reason: recipientDecision.reason,
              warnings: recipientDecision.warnings
            });
            
            // Apply a special label to indicate blocked response
            try {
              const blockedLabel = getOrCreateLabel(Config.LABELS.AI_ERROR);
              thread.addLabel(blockedLabel);
            } catch (e) {
              // Ignore label errors
            }
            
            return; // Skip this thread
          }
          
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
          
          // Get thread labels for response prompt selection
          const threadLabels = thread.getLabels().map(label => label.getName());
          const activeResponsePrompt = getResponsePrompt(responsePrompt, threadLabels);
          
          // Build recipient context for AI
          const recipientContext = buildRecipientContext(emailContext, recipientDecision);
          
          // Create secure prompt with injection protection
          const replyPrompt = PromptSanitizer.createReplyPrompt(
            activeResponsePrompt,
            redactedBody,
            recipientContext
          );
          const replyResult = AI.callGemini(apiKey, replyPrompt, replySchema);
          
          if (replyResult.success && replyResult.data) {
            // T-14: Parse structured response
            let replyData: { reply?: string } | string;
            try {
              replyData = typeof replyResult.data === 'string' 
                ? JSON.parse(replyResult.data)
                : replyResult.data;
            } catch (e) {
              // Fallback to direct string if JSON parse fails
              replyData = { reply: String(replyResult.data) };
            }
            
            // T-12: Restore PII in the reply
            let replyBody = Redaction.restorePII(typeof replyData === 'object' && replyData.reply ? replyData.reply : String(replyData), threadId);
            // Format the reply text for proper display
            replyBody = Utils.formatEmailText(replyBody);
            
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
                thread.reply(replyBody);
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
                  thread.createDraftReply(replyBody);
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
    let testConfig: { enabled?: boolean; skipLabeling?: boolean; skipDraftCreation?: boolean; skipAutoReply?: boolean } | null = null;
    try {
      const testModeConfigStr = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.TEST_MODE_CONFIG);
      if (testModeConfigStr) {
        testConfig = JSON.parse(testModeConfigStr);
        if (testConfig !== null && testConfig.enabled) {
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
      // Schema allows ANY label name - labels are managed in Google Docs
      const classificationSchema = {
        type: 'object',
        properties: {
          label: {
            type: 'string'
            // No enum - AI can return any label name from the docs
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          category: {
            type: 'string'
            // Optional category for additional context
          }
        },
        required: ['label']
      };
      
      // Get thread labels for prompt selection
      const threadLabels = thread.getLabels().map(label => label.getName());
      const activeClassificationPrompt = getClassificationPrompt(classificationPrompt, threadLabels);
      
      // Get label options from docs configuration
      let labelOptions: string[] = ['support', 'not'];
      try {
        const compiledStr = PropertiesService.getUserProperties().getProperty('DOCS_PROMPT_COMPILED_CONFIG');
        if (compiledStr) {
          const parsed = JSON.parse(compiledStr);
          if (parsed.labels && Array.isArray(parsed.labels)) {
            const labels = parsed.labels.map((rule: { label?: string }) => rule.label).filter((l: string | undefined) => l);
            if (labels.length > 0) {
              labelOptions = labels;
            }
          }
        }
      } catch (error) {
        // Fall back to default labels
      }
      
      // Create secure prompt with injection protection
      const fullPrompt = PromptSanitizer.createClassificationPrompt(
        activeClassificationPrompt,
        redactedBody,
        labelOptions
      );
      const classificationResult = AI.callGemini(apiKey, fullPrompt, classificationSchema);
      
      if (!classificationResult.success) {
        throw new Error(classificationResult.error);
      }
      
      // T-14: Parse structured response
      let classificationData: unknown;
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
        // Try to extract any label-like word from the response
        const responseText = String(classificationResult.data).trim();
        classificationData = { label: responseText || 'General' };
      }
      
      const classData = classificationData as { label?: string; confidence?: number; category?: string };
      // Dynamic label handling
      const labelToApply = classData.label || 'General';
      
      AppLogger.info('🎯 EMAIL CLASSIFIED', {
        shortMessage: 'Classified "' + subject + '" as ' + labelToApply.toUpperCase(),
        subject: subject,
        classification: labelToApply,
        confidence: classData.confidence,
        category: classData.category,
        labelToApply: labelToApply,
        threadId: thread.getId()
      });
      
      const dynamicLabel = getOrCreateLabel(labelToApply);
      const processedLabel = getOrCreateLabel(Config.LABELS.AI_PROCESSED);
      
      // Check if this label should create drafts (from docs config)
      const docsPrompts = DocsPromptEditor.getPromptForLabels([labelToApply]);
      const shouldCreateDraft = docsPrompts && docsPrompts.responsePrompt && (createDrafts || autoReply);
      const isSupport = shouldCreateDraft || false; // For backward compatibility
      
      // T-10: Skip labeling in test mode if configured
      const shouldApplyLabels = !(testConfig && testConfig.enabled && testConfig.skipLabeling);
      
      // Apply dynamic label
      if (shouldApplyLabels) {
        thread.addLabel(dynamicLabel);
        thread.addLabel(processedLabel);
      }
      
      if (shouldCreateDraft) {
          // Extract thread context for recipient determination
          const emailContext = extractThreadContext(thread);
          const recipientDecision = determineRecipients(emailContext, body);
          
          // Check if we should block the response
          if (recipientDecision.to.length === 0) {
            AppLogger.warn('🚫 RESPONSE BLOCKED - NO VALID RECIPIENTS', {
              threadId: thread.getId(),
              subject: subject,
              reason: recipientDecision.reason,
              warnings: recipientDecision.warnings
            });
            
            // Apply error label and return
            const errorLabel = getOrCreateLabel(Config.LABELS.AI_ERROR);
            thread.addLabel(errorLabel);
            return { isSupport: isSupport || false, error: 'No valid recipients: ' + recipientDecision.reason };
          }
          
          AppLogger.info('✍️ GENERATING REPLY', {
            subject: subject,
            mode: autoReply ? 'AUTO-SEND' : 'DRAFT',
            threadId: thread.getId(),
            recipientMode: recipientDecision.mode,
            recipientCount: recipientDecision.to.length
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
          
          // Get thread labels for response prompt selection
          const threadLabels = thread.getLabels().map(label => label.getName());
          const activeResponsePrompt = getResponsePrompt(responsePrompt, threadLabels);
          
          // Build recipient context for AI
          const recipientContext = buildRecipientContext(emailContext, recipientDecision);
          
          // Create secure prompt with injection protection
          const replyPrompt = PromptSanitizer.createReplyPrompt(
            activeResponsePrompt,
            redactedBody,
            recipientContext
          );
          const replyResult = AI.callGemini(apiKey, replyPrompt, replySchema);
          
          if (replyResult.success && replyResult.data) {
            // T-14: Parse structured response
            let replyData: { reply?: string } | string;
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
              replyData = { reply: String(replyResult.data) };
            }
            
            // T-12: Restore PII in the reply before sending/saving
            let replyBody = Redaction.restorePII(typeof replyData === 'object' && replyData.reply ? replyData.reply : String(replyData), thread.getId());
            // Format the reply text for proper display
            replyBody = Utils.formatEmailText(replyBody);
            
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
              return { isSupport: isSupport || false, error: 'Guardrails failed: ' + validation.failureReasons.join('; ') };
            } else {
              // Guardrails passed - proceed with reply/draft
              if (autoReply) {
                thread.reply(replyBody);
                AppLogger.info('📤 EMAIL SENT', {
                  subject: subject,
                  to: sender,
                  replyLength: replyBody.length,
                  threadId: thread.getId()
                });
              } else {
                thread.createDraftReply(replyBody);
                AppLogger.info('📝 DRAFT CREATED', {
                  subject: subject,
                  replyLength: replyBody.length,
                  threadId: thread.getId()
                });
              }
            }
            
            // T-12: Clear redaction cache after successful processing
            Redaction.clearRedactionCache(thread.getId());
          } else {
            // AI reply generation failed
            const errorLabel = getOrCreateLabel(Config.LABELS.AI_ERROR);
            thread.addLabel(errorLabel);
            AppLogger.error('❌ FAILED TO GENERATE REPLY', {
              subject: subject,
              threadId: thread.getId(),
              error: 'No reply data returned'
            });
            return { isSupport: isSupport || false, error: 'No reply data returned' };
          }
      }
      
      return { isSupport: isSupport || false };
    } catch (error) {
      const errorLabel = getOrCreateLabel(Config.LABELS.AI_ERROR);
      thread.addLabel(errorLabel);
      const errorMessage = Utils.logAndHandleError(error, `Thread processing for ${thread.getId()}`);
      return { isSupport: false, error: errorMessage };
    }
  }
}


