/**
 * Continuation Triggers Module
 * Handles large inbox processing beyond Apps Script execution limits
 */

namespace ContinuationTriggers {
  
  // State management for continuation triggers
  export interface ContinuationState {
    isActive: boolean;
    triggerId?: string;
    processedCount: number;
    totalEstimated: number;
    lastProcessedThread?: string;
    startTime: number;
    settings: {
      apiKey: string;
      createDrafts: boolean;
      autoReply: boolean;
      classificationPrompt: string;
      responsePrompt: string;
    };
    nextContinuationId?: string;
  }
  
  export interface ProcessingCheckpoint {
    continuationId: string;
    processedThreadIds: string[];
    remainingThreadIds: string[];
    batchProgress: {
      currentBatch: number;
      totalBatches: number;
      emailsInCurrentBatch: number;
    };
    processedCount: number;
    startTime: number;
    lastActivityTime: number;
  }
  
  // Configuration
  export const CONFIG = {
    MAX_EXECUTION_TIME_MS: 5 * 60 * 1000,      // 5 minutes (leave 1min buffer)
    CONTINUATION_DELAY_MS: 2000,               // 2 second delay between continuations
    CHECKPOINT_FREQUENCY: 50,                  // Save checkpoint every 50 processed emails
    MAX_CONTINUATIONS: 20,                     // Prevent infinite loops
    BATCH_SIZE_FOR_CONTINUATION: 100,          // Process in chunks of 100 emails max
    STATE_CLEANUP_HOURS: 24                    // Clean up old state after 24 hours
  };
  
  /**
   * Check if we're approaching execution time limit
   */
  export function isApproachingTimeLimit(startTime: number): boolean {
    const elapsed = Date.now() - startTime;
    return elapsed >= CONFIG.MAX_EXECUTION_TIME_MS;
  }
  
  /**
   * Save continuation state for resuming processing
   */
  export function saveContinuationState(state: ContinuationState): void {
    try {
      const stateKey = 'CONTINUATION_STATE_' + Date.now();
      const serializedState = JSON.stringify(state);
      
      PropertiesService.getUserProperties().setProperty(stateKey, serializedState);
      PropertiesService.getUserProperties().setProperty('ACTIVE_CONTINUATION_KEY', stateKey);
      
      AppLogger.info('💾 CONTINUATION STATE SAVED', {
        stateKey,
        processedCount: state.processedCount,
        totalEstimated: state.totalEstimated,
        triggerId: state.triggerId
      });
      
    } catch (error) {
      AppLogger.error('❌ Failed to save continuation state', { error: Utils.logAndHandleError(error, 'Save continuation state') });
      throw error;
    }
  }
  
  /**
   * Load continuation state for resuming processing
   */
  export function loadContinuationState(): ContinuationState | null {
    try {
      const activeKey = PropertiesService.getUserProperties().getProperty('ACTIVE_CONTINUATION_KEY');
      if (!activeKey) return null;
      
      const serializedState = PropertiesService.getUserProperties().getProperty(activeKey);
      if (!serializedState) return null;
      
      const state = JSON.parse(serializedState) as ContinuationState;
      
      AppLogger.info('📂 CONTINUATION STATE LOADED', {
        stateKey: activeKey,
        processedCount: state.processedCount,
        totalEstimated: state.totalEstimated,
        isActive: state.isActive
      });
      
      return state;
      
    } catch (error) {
      AppLogger.error('❌ Failed to load continuation state', { error: Utils.logAndHandleError(error, 'Load continuation state') });
      return null;
    }
  }
  
  /**
   * Clear continuation state when processing is complete
   */
  export function clearContinuationState(): void {
    try {
      const activeKey = PropertiesService.getUserProperties().getProperty('ACTIVE_CONTINUATION_KEY');
      if (activeKey) {
        PropertiesService.getUserProperties().deleteProperty(activeKey);
        PropertiesService.getUserProperties().deleteProperty('ACTIVE_CONTINUATION_KEY');
        
        AppLogger.info('🗑️ CONTINUATION STATE CLEARED', { stateKey: activeKey });
      }
    } catch (error) {
      AppLogger.error('❌ Failed to clear continuation state', { error: Utils.logAndHandleError(error, 'Clear continuation state') });
    }
  }
  
  /**
   * Create a time-based trigger for continuation
   */
  export function createContinuationTrigger(delayMs: number = CONFIG.CONTINUATION_DELAY_MS): string {
    try {
      // Delete any existing continuation triggers first
      deleteContinuationTriggers();
      
      const triggerTime = new Date(Date.now() + delayMs);
      const trigger = ScriptApp.newTrigger('continueLargeInboxProcessing')
        .timeBased()
        .at(triggerTime)
        .create();
      
      const triggerId = trigger.getUniqueId();
      
      AppLogger.info('⏰ CONTINUATION TRIGGER CREATED', {
        triggerId,
        scheduledTime: triggerTime.toISOString(),
        delayMs
      });
      
      return triggerId;
      
    } catch (error) {
      AppLogger.error('❌ Failed to create continuation trigger', { error: Utils.logAndHandleError(error, 'Create continuation trigger') });
      throw error;
    }
  }
  
  /**
   * Delete all continuation triggers
   */
  export function deleteContinuationTriggers(): void {
    try {
      const triggers = ScriptApp.getProjectTriggers();
      let deletedCount = 0;
      
      triggers.forEach(trigger => {
        if (trigger.getHandlerFunction() === 'continueLargeInboxProcessing') {
          ScriptApp.deleteTrigger(trigger);
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        AppLogger.info('🗑️ CONTINUATION TRIGGERS DELETED', { count: deletedCount });
      }
      
    } catch (error) {
      AppLogger.error('❌ Failed to delete continuation triggers', { error: Utils.logAndHandleError(error, 'Delete continuation triggers') });
    }
  }
  
  /**
   * Process threads with continuation support
   * This is a basic version that doesn't depend on GmailService to avoid circular dependencies
   */
  export function processThreadsWithContinuation(
    threads: GoogleAppsScript.Gmail.GmailThread[],
    apiKey: string,
    createDrafts: boolean,
    autoReply: boolean,
    classificationPrompt: string,
    responsePrompt: string
  ): { 
    results: Map<string, any>;
    needsContinuation: boolean;
    continuationState?: ContinuationState;
  } {
    const startTime = Date.now();
    const results = new Map<string, any>();
    
    // Check for existing continuation state
    const existingState = loadContinuationState();
    const processedCount = existingState?.processedCount || 0;
    
    AppLogger.info('🔄 CONTINUATION PROCESSING START', {
      totalThreads: threads.length,
      existingProcessedCount: processedCount,
      isResumingFromContinuation: !!existingState
    });
    
    // For now, just setup the continuation trigger without processing
    // The actual processing will be delegated to the parent module
    if (isApproachingTimeLimit(startTime) || threads.length > CONFIG.BATCH_SIZE_FOR_CONTINUATION) {
      const continuationState: ContinuationState = {
        isActive: true,
        processedCount: processedCount,
        totalEstimated: threads.length,
        lastProcessedThread: undefined,
        startTime: existingState?.startTime || startTime,
        settings: {
          apiKey,
          createDrafts,
          autoReply,
          classificationPrompt,
          responsePrompt
        },
        nextContinuationId: Utils.generateId()
      };
      
      // Save state and create trigger
      saveContinuationState(continuationState);
      const triggerId = createContinuationTrigger();
      if (triggerId) {
        continuationState.triggerId = triggerId;
        saveContinuationState(continuationState); // Save again with trigger ID
      }
      
      return {
        results,
        needsContinuation: true,
        continuationState
      };
    }
    
    return {
      results,
      needsContinuation: false
    };
  }
  
  /**
   * Get remaining threads for continuation processing
   * NOTE: This function should be called from the parent module to avoid circular dependencies
   */
  export function getRemainingThreadsForContinuation(
    state: ContinuationState
  ): string | undefined {
    // Return the last processed thread ID for the caller to handle
    return state.lastProcessedThread;
  }
  
  /**
   * Cleanup old continuation states
   */
  export function cleanupOldContinuationStates(): void {
    try {
      const properties = PropertiesService.getUserProperties();
      const allProperties = properties.getProperties();
      const cutoffTime = Date.now() - (CONFIG.STATE_CLEANUP_HOURS * 60 * 60 * 1000);
      
      let cleanedCount = 0;
      
      Object.keys(allProperties).forEach(key => {
        if (key.startsWith('CONTINUATION_STATE_')) {
          const timestamp = parseInt(key.replace('CONTINUATION_STATE_', ''));
          if (timestamp < cutoffTime) {
            properties.deleteProperty(key);
            cleanedCount++;
          }
        }
      });
      
      if (cleanedCount > 0) {
        AppLogger.info('🧹 OLD CONTINUATION STATES CLEANED', { count: cleanedCount });
      }
      
    } catch (error) {
      AppLogger.error('❌ Failed to cleanup old continuation states', { error: Utils.logAndHandleError(error, 'Cleanup old continuation states') });
    }
  }
  
  /**
   * Check if continuation processing is currently active
   */
  export function isContinuationActive(): boolean {
    const state = loadContinuationState();
    return state ? state.isActive : false;
  }
  
  /**
   * Get continuation status for UI display
   */
  export function getContinuationStatus(): {
    isActive: boolean;
    progress?: {
      processed: number;
      estimated: number;
      percentage: number;
      elapsedTime: number;
    };
  } {
    const state = loadContinuationState();
    
    if (!state || !state.isActive) {
      return { isActive: false };
    }
    
    const elapsedTime = Date.now() - state.startTime;
    const percentage = state.totalEstimated > 0 
      ? Math.round((state.processedCount / state.totalEstimated) * 100)
      : 0;
    
    return {
      isActive: true,
      progress: {
        processed: state.processedCount,
        estimated: state.totalEstimated,
        percentage,
        elapsedTime
      }
    };
  }
}