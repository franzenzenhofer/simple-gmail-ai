/**
 * Entry Points Module
 * Contains all Google Apps Script entry points
 */

namespace EntryPoints {
  /**
   * T-05: Simple trigger when add-on is opened
   * Writes heartbeat timestamp for monitoring
   */
  export function onAddOnOpen(_e: any): void {
    try {
      const timestamp = new Date().toISOString();
      PropertiesService.getUserProperties().setProperty('AI_HEARTBEAT', timestamp);
      
      // Don't initialize logger for simple triggers - it's too heavy
      console.log('Heartbeat written on add-on open:', timestamp);
    } catch (error) {
      console.error('Failed to write heartbeat on open:', error);
    }
  }
  
  /**
   * Entry point for Gmail add-on homepage
   */
  export function onHomepage(): GoogleAppsScript.Card_Service.Card {
    try {
      AppLogger.initSpreadsheet();
      
      // Clear any stale processing flags on add-on load
      const props = PropertiesService.getUserProperties();
      const isProcessing = props.getProperty('ANALYSIS_RUNNING') === 'true';
      if (isProcessing) {
        const lastStartTime = props.getProperty('ANALYSIS_START_TIME');
        if (lastStartTime) {
          const elapsed = Date.now() - parseInt(lastStartTime);
          // Clear if older than 2 minutes (processing should never take that long)
          if (elapsed > 120000) {
            props.setProperty('ANALYSIS_RUNNING', 'false');
            AppLogger.info('Cleared stale ANALYSIS_RUNNING flag on startup', { elapsed });
          }
        } else {
          // No start time recorded, clear the flag
          props.setProperty('ANALYSIS_RUNNING', 'false');
          AppLogger.info('Cleared ANALYSIS_RUNNING flag (no start time)');
        }
      }
      
      AppLogger.info('Gmail Add-on started', {
        version: Config.VERSION,
        executionId: AppLogger.executionId
      });
      
      // T-05: Write heartbeat timestamp to UserProperties
      writeHeartbeat();
      
      // Initialize dark mode settings
      DarkMode.initializeDarkMode();
      // Apply theme colors to Config
      DarkMode.applyThemeToConfig();
      
      // Check if user needs welcome flow
      if (WelcomeFlow.needsWelcomeFlow()) {
        return WelcomeFlow.createWelcomeCard();
      }
      
      // Check if test mode is active
      if (TestMode.isTestModeActive()) {
        return TestMode.createTestModeCard();
      }
      
      // Use condensed UI
      return UIImprovements.createCondensedMainCard();
    } catch (error) {
      return ErrorHandling.handleGlobalError(error);
    }
  }

  /**
   * Entry point for Gmail message context
   */
  export function onGmailMessage(e: any): GoogleAppsScript.Card_Service.Card {
    try {
      AppLogger.initSpreadsheet();
      AppLogger.info('Gmail message context opened', {
        messageId: e.messageMetadata?.messageId,
        accessToken: e.messageMetadata?.accessToken ? 'present' : 'missing'
      });
      
      // T-05: Write heartbeat timestamp to UserProperties
      writeHeartbeat();
      
      // T-11: Use contextual actions card for per-message actions
      return ContextualActions.createContextualActionsCard(e);
    } catch (error) {
      return ErrorHandling.handleGlobalError(error);
    }
  }
  
  /**
   * T-05: Write heartbeat timestamp to UserProperties for monitoring
   */
  function writeHeartbeat(): void {
    try {
      const timestamp = new Date().toISOString();
      PropertiesService.getUserProperties().setProperty('AI_HEARTBEAT', timestamp);
      
      AppLogger.info('💓 HEARTBEAT WRITTEN', {
        timestamp: timestamp,
        executionId: AppLogger.executionId
      });
    } catch (error) {
      // Don't let heartbeat errors break the add-on
      AppLogger.error('Failed to write heartbeat', { error: String(error) });
    }
  }
}