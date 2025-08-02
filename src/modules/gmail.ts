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
    const recent = GmailApp.search('in:inbox -label:' + Config.LABELS.AI_PROCESSED, 0, 50);
    const unread = GmailApp.search('in:inbox is:unread -label:' + Config.LABELS.AI_PROCESSED);
    
    const threadIds = new Set<string>();
    const threads: GoogleAppsScript.Gmail.GmailThread[] = [];
    
    [...recent, ...unread].forEach(thread => {
      const id = thread.getId();
      if (!threadIds.has(id)) {
        threadIds.add(id);
        threads.push(thread);
      }
    });
    
    return threads;
  }
  
  export function processThread(
    thread: GoogleAppsScript.Gmail.GmailThread,
    apiKey: string,
    mode: string,
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
      
      const fullPrompt = classificationPrompt + '\n' + body + '\n---------- EMAIL END ----------';
      const classification = AI.callGemini(apiKey, fullPrompt).toLowerCase();
      
      const isSupport = classification.indexOf('support') === 0;
      
      const supportLabel = getOrCreateLabel(Config.LABELS.SUPPORT);
      const notSupportLabel = getOrCreateLabel(Config.LABELS.NOT_SUPPORT);
      const processedLabel = getOrCreateLabel(Config.LABELS.AI_PROCESSED);
      
      if (isSupport) {
        thread.addLabel(supportLabel);
        thread.removeLabel(notSupportLabel);
        
        if (mode === 'draft' || autoReply) {
          const replyPrompt = responsePrompt + '\n' + body + '\n---------- END ----------';
          const replyBody = AI.callGemini(apiKey, replyPrompt);
          
          if (replyBody) {
            if (autoReply) {
              thread.reply(replyBody, { htmlBody: replyBody });
            } else {
              thread.createDraftReply(replyBody, { htmlBody: replyBody });
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