/**
 * Entry Points Module
 * Contains all Google Apps Script entry points
 */

namespace EntryPoints {
  /**
   * T-05: Simple trigger when add-on is opened
   * Writes heartbeat timestamp for monitoring
   */
  export function onAddOnOpen(_e: GoogleAppsScript.Addons.EventObject): void {
    try {
      const timestamp = new Date().toISOString();
      PropertiesService.getUserProperties().setProperty(Config.PROP_KEYS.AI_HEARTBEAT, timestamp);
      
      // Don't initialize logger for simple triggers - it's too heavy
      // Heartbeat written silently for performance
    } catch (error) {
      // Silent fail to keep trigger lightweight
    }
  }
  
  /**
   * Entry point for Gmail add-on homepage
   * ALWAYS checks welcome flow first to ensure proper user onboarding
   */
  export function onHomepage(): GoogleAppsScript.Card_Service.Card {
    try {
      AppLogger.initSpreadsheet();
      
      // T-05: Write heartbeat timestamp to UserProperties
      writeHeartbeat();
      
      AppLogger.info('Gmail Add-on started', {
        version: Config.VERSION,
        executionId: AppLogger.executionId
      });
      
      // STEP 1: ALWAYS check if user needs welcome flow FIRST
      // This ensures proper onboarding after factory reset or first-time use
      if (WelcomeFlow.needsWelcomeFlow()) {
        AppLogger.info('Redirecting to welcome flow - user needs onboarding');
        return WelcomeFlow.createWelcomeCard();
      }
      
      // STEP 2: Initialize system components only after welcome flow is complete
      // T-19: Migrate existing labels to cache on first load
      try {
        const props = PropertiesService.getUserProperties();
        const migrationFlag = props.getProperty(Config.PROP_KEYS.LABEL_CACHE_MIGRATED);
        if (!migrationFlag) {
          LabelCache.migrateExistingLabels();
          props.setProperty(Config.PROP_KEYS.LABEL_CACHE_MIGRATED, 'true');
        }
      } catch (error) {
        Utils.logWarning('migrate label cache', error);
      }
      
      // Clear any stale processing locks on add-on load
      const lockInfo = LockManager.getLockInfo();
      if (lockInfo) {
        const elapsed = Date.now() - lockInfo.startTime;
        AppLogger.info('Found existing analysis lock on startup', {
          executionId: lockInfo.executionId,
          elapsedMs: elapsed,
          mode: lockInfo.mode
        });
        // Lock manager will automatically handle stale locks based on timeout
      }
      
      // Initialize dark mode settings
      DarkMode.initializeDarkMode();
      // Apply theme colors to Config
      DarkMode.applyThemeToConfig();
      
      // STEP 3: Check for special modes (test mode overrides main screen)
      if (TestMode.isTestModeActive()) {
        AppLogger.info('Redirecting to test mode - active test configuration detected');
        return TestMode.createTestModeCard();
      }
      
      // STEP 4: Show main application screen
      AppLogger.info('Loading main application screen');
      return UI.buildHomepage();
    } catch (error) {
      return ErrorHandling.handleGlobalError(error);
    }
  }

  /**
   * Entry point for Gmail message context
   */
  export function onGmailMessage(e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.Card {
    try {
      AppLogger.initSpreadsheet();
      AppLogger.info('Gmail message context opened', {
        messageId: e.gmail?.messageId,
        accessToken: e.gmail?.accessToken ? 'present' : 'missing'
      });
      
      // T-05: Write heartbeat timestamp to UserProperties
      writeHeartbeat();
      
      // T-19: Ensure label cache migration on Gmail context too
      try {
        const props = PropertiesService.getUserProperties();
        const migrationFlag = props.getProperty(Config.PROP_KEYS.LABEL_CACHE_MIGRATED);
        if (!migrationFlag) {
          LabelCache.migrateExistingLabels();
          props.setProperty(Config.PROP_KEYS.LABEL_CACHE_MIGRATED, 'true');
        }
      } catch (error) {
        Utils.logWarning('migrate label cache in Gmail context', error);
      }
      
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
      PropertiesService.getUserProperties().setProperty(Config.PROP_KEYS.AI_HEARTBEAT, timestamp);
      
      AppLogger.info('💓 HEARTBEAT WRITTEN', {
        timestamp: timestamp,
        executionId: AppLogger.executionId
      });
    } catch (error) {
      // Don't let heartbeat errors break the add-on
      Utils.logError('write heartbeat', error);
    }
  }
}