/**
 * Draft Tracker Module
 * Prevents duplicate draft creation by tracking draft metadata
 */

namespace DraftTracker {
  // Key prefix for storing draft metadata
  const DRAFT_METADATA_PREFIX = 'DRAFT_';
  const DRAFT_METADATA_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
  
  export interface DraftMetadata {
    threadId: string;
    contentHash: string;
    createdAt: number;
    draftId?: string;
  }
  
  /**
   * Check if a draft with similar content already exists for this thread
   */
  export function isDuplicateDraft(threadId: string, replyContent: string): boolean {
    try {
      const cache = CacheService.getUserCache();
      const key = DRAFT_METADATA_PREFIX + threadId;
      const existingData = cache.get(key);
      
      if (!existingData) {
        return false;
      }
      
      const metadata: DraftMetadata = JSON.parse(existingData);
      const newHash = Utils.generateContentHash(replyContent);
      
      // Check if content hash matches (indicating duplicate content)
      if (metadata.contentHash === newHash) {
        AppLogger.info('🔍 Duplicate draft detected', {
          threadId: threadId,
          contentHash: newHash,
          createdAt: new Date(metadata.createdAt).toISOString()
        });
        return true;
      }
      
      return false;
    } catch (error) {
      // If there's any error reading metadata, assume it's not a duplicate
      AppLogger.warn('Failed to check draft metadata', {
        threadId: threadId,
        error: String(error)
      });
      return false;
    }
  }
  
  /**
   * Record that a draft was created for this thread
   */
  export function recordDraftCreation(threadId: string, replyContent: string, draftId?: string): void {
    try {
      const cache = CacheService.getUserCache();
      const key = DRAFT_METADATA_PREFIX + threadId;
      
      const metadata: DraftMetadata = {
        threadId: threadId,
        contentHash: Utils.generateContentHash(replyContent),
        createdAt: Date.now(),
        draftId: draftId
      };
      
      // Store with TTL to auto-cleanup old entries
      cache.put(key, JSON.stringify(metadata), DRAFT_METADATA_TTL);
      
      AppLogger.info('📝 Draft metadata recorded', {
        threadId: threadId,
        contentHash: metadata.contentHash
      });
    } catch (error) {
      // Log but don't fail the operation
      AppLogger.warn('Failed to record draft metadata', {
        threadId: threadId,
        error: String(error)
      });
    }
  }
  
  /**
   * Clear draft metadata for a thread (e.g., when draft is sent)
   */
  export function clearDraftMetadata(threadId: string): void {
    try {
      const cache = CacheService.getUserCache();
      const key = DRAFT_METADATA_PREFIX + threadId;
      cache.remove(key);
      
      AppLogger.info('🧹 Draft metadata cleared', {
        threadId: threadId
      });
    } catch (error) {
      AppLogger.warn('Failed to clear draft metadata', {
        threadId: threadId,
        error: String(error)
      });
    }
  }
  
  /**
   * Get existing drafts for a thread to check manually
   */
  export function getThreadDrafts(thread: GoogleAppsScript.Gmail.GmailThread): GoogleAppsScript.Gmail.GmailDraft[] {
    try {
      // Get all drafts
      const drafts = GmailApp.getDrafts();
      const threadId = thread.getId();
      const threadDrafts: GoogleAppsScript.Gmail.GmailDraft[] = [];
      
      // Filter drafts that belong to this thread
      drafts.forEach(draft => {
        try {
          const draftMessage = draft.getMessage();
          const draftThread = draftMessage.getThread();
          if (draftThread.getId() === threadId) {
            threadDrafts.push(draft);
          }
        } catch (e) {
          // Skip drafts we can't access
        }
      });
      
      return threadDrafts;
    } catch (error) {
      AppLogger.warn('Failed to get thread drafts', {
        threadId: thread.getId(),
        error: String(error)
      });
      return [];
    }
  }
}