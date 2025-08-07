/**
 * Continuation Handlers Module
 * Global functions for handling continuation triggers
 */

namespace ContinuationHandlers {
  
  /**
   * Global function to continue large inbox processing
   * This function is called by the time-based trigger
   */
  export function continueLargeInboxProcessing(): void {
    try {
      AppLogger.info('🔄 CONTINUATION TRIGGER FIRED', {
        timestamp: new Date().toISOString()
      });
      
      // Load continuation state
      const state = ContinuationTriggers.loadContinuationState();
      if (!state || !state.isActive) {
        AppLogger.warn('⚠️ No active continuation state found', {
          hasState: !!state,
          isActive: state?.isActive
        });
        ContinuationTriggers.deleteContinuationTriggers();
        return;
      }
      
      // Check for cancellation
      if (PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.ANALYSIS_CANCELLED) === 'true') {
        AppLogger.info('🛑 Continuation cancelled by user');
        ContinuationTriggers.clearContinuationState();
        ContinuationTriggers.deleteContinuationTriggers();
        return;
      }
      
      // Get remaining threads to process
      const lastProcessedThreadId = ContinuationTriggers.getRemainingThreadsForContinuation(state);
      const allThreads = GmailService.getUnprocessedThreads();
      
      let remainingThreads = allThreads;
      
      // If we have a last processed thread, start from after that point
      if (lastProcessedThreadId) {
        const lastIndex = allThreads.findIndex(thread => thread.getId() === lastProcessedThreadId);
        if (lastIndex >= 0) {
          remainingThreads = allThreads.slice(lastIndex + 1);
        }
      }
      
      if (remainingThreads.length === 0) {
        AppLogger.info('✅ NO REMAINING THREADS - CONTINUATION COMPLETE', {
          totalProcessed: state.processedCount,
          totalTime: Date.now() - state.startTime
        });
        
        ContinuationTriggers.clearContinuationState();
        ContinuationTriggers.deleteContinuationTriggers();
        return;
      }
      
      AppLogger.info('📧 CONTINUING PROCESSING', {
        remainingThreads: remainingThreads.length,
        totalProcessedSoFar: state.processedCount,
        originalEstimate: state.totalEstimated
      });
      
      // Continue processing with the saved settings
      const result = GmailService.processThreadsWithContinuation(
        remainingThreads,
        state.settings.apiKey,
        state.settings.createDrafts,
        state.settings.autoReply,
        state.settings.classificationPrompt,
        state.settings.responsePrompt
      );
      
      if (result.needsContinuation) {
        AppLogger.info('⏳ PROCESSING REQUIRES ANOTHER CONTINUATION', {
          processedInThisRun: result.results.size,
          totalProcessedSoFar: state.processedCount + result.results.size,
          needsAnotherContinuation: result.needsContinuation
        });
        // The trigger and state are already set up by processThreadsWithContinuation
      } else {
        AppLogger.info('🎉 ALL PROCESSING COMPLETE VIA CONTINUATION', {
          totalProcessed: state.processedCount + result.results.size,
          totalTime: Date.now() - state.startTime,
          finalBatchSize: result.results.size
        });
        
        // Clean up continuation state
        ContinuationTriggers.clearContinuationState();
        ContinuationTriggers.deleteContinuationTriggers();
      }
      
    } catch (error) {
      const errorMessage = Utils.logAndHandleError(error, 'Continuation processing');
      AppLogger.error('❌ CONTINUATION PROCESSING FAILED', {
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
      
      // Clean up on error
      ContinuationTriggers.clearContinuationState();
      ContinuationTriggers.deleteContinuationTriggers();
    }
  }
  
  /**
   * Cancel any active continuation processing
   */
  export function cancelContinuationProcessing(): void {
    try {
      AppLogger.info('🛑 CANCELLING CONTINUATION PROCESSING');
      
      // Set cancellation flag
      PropertiesService.getUserProperties().setProperty(Config.PROP_KEYS.ANALYSIS_CANCELLED, 'true');
      
      // Clean up continuation state and triggers
      ContinuationTriggers.clearContinuationState();
      ContinuationTriggers.deleteContinuationTriggers();
      
      AppLogger.info('✅ CONTINUATION PROCESSING CANCELLED');
      
    } catch (error) {
      AppLogger.error('❌ Failed to cancel continuation processing', {
        error: Utils.logAndHandleError(error, 'Cancel continuation processing')
      });
    }
  }
  
  /**
   * Initialize continuation processing for a new large inbox analysis
   */
  export function initializeLargeInboxProcessing(
    threads: GoogleAppsScript.Gmail.GmailThread[],
    apiKey: string,
    createDrafts: boolean,
    autoReply: boolean,
    classificationPrompt: string,
    responsePrompt: string
  ): {
    results: Map<string, GmailService.ProcessingResult>;
    needsContinuation: boolean;
    continuationState?: ContinuationTriggers.ContinuationState;
  } {
    try {
      // Clean up any old continuation states first
      ContinuationTriggers.cleanupOldContinuationStates();
      
      // Clear any existing cancellation flags
      PropertiesService.getUserProperties().deleteProperty(Config.PROP_KEYS.ANALYSIS_CANCELLED);
      
      AppLogger.info('🚀 INITIALIZING LARGE INBOX PROCESSING', {
        totalThreads: threads.length,
        maxExecutionTime: ExecutionTime.formatDuration(ExecutionTime.LIMITS.SAFE_EXECUTION_MS),
        batchSize: ContinuationTriggers.CONFIG.BATCH_SIZE_FOR_CONTINUATION
      });
      
      // Start processing with continuation support
      const result = GmailService.processThreadsWithContinuation(
        threads,
        apiKey,
        createDrafts,
        autoReply,
        classificationPrompt,
        responsePrompt
      );
      
      if (result.needsContinuation) {
        AppLogger.info('⏳ INITIAL PROCESSING REQUIRES CONTINUATION', {
          processedInFirstRun: result.results.size,
          totalThreads: threads.length,
          continuationScheduled: !!result.continuationState
        });
      } else {
        AppLogger.info('✅ ALL PROCESSING COMPLETED IN SINGLE RUN', {
          totalProcessed: result.results.size,
          totalThreads: threads.length
        });
      }
      
      return result;
      
    } catch (error) {
      AppLogger.error('❌ Failed to initialize large inbox processing', {
        error: Utils.logAndHandleError(error, 'Initialize large inbox processing'),
        threadCount: threads.length
      });
      throw error;
    }
  }
}