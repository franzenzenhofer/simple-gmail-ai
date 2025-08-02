/**
 * Gmail Service Module
 * Handles all Gmail operations
 */

namespace GmailService {
  export function getOrCreateLabel(name: string): GoogleAppsScript.Gmail.GmailLabel {
    let label = GmailApp.getUserLabelByName(name);
    if (!label) {
      label = GmailApp.createLabel(name);
    }
    return label;
  }
  
  export function getUnprocessedThreads(): GoogleAppsScript.Gmail.GmailThread[] {
    const recentQuery = 'in:inbox -label:' + Config.LABELS.AI_PROCESSED;
    const unreadQuery = 'in:inbox is:unread -label:' + Config.LABELS.AI_PROCESSED;
    
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
      const classification = AI.callGemini(apiKey, fullPrompt).toLowerCase();
      
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
          const replyBody = AI.callGemini(apiKey, replyPrompt);
          
          if (replyBody) {
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