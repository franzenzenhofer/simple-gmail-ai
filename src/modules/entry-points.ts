/**
 * Entry Points Module
 * Contains all Google Apps Script entry points
 */

namespace EntryPoints {
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
  export function onGmailMessage(_e: any): GoogleAppsScript.Card_Service.Card {
    try {
      AppLogger.initSpreadsheet();
      AppLogger.info('Gmail message context opened');
      return UI.buildHomepage();
    } catch (error) {
      return ErrorHandling.handleGlobalError(error);
    }
  }
}