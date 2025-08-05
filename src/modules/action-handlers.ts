/**
 * Action Handlers Module
 * Contains all action handlers for user interactions
 */

namespace ActionHandlers {
  export function saveApiKey(e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      const apiKey = Utils.getFormValue(e, 'apiKey');
      
      // Pre-validate API key format
      const validation = Utils.validateApiKeyFormat(apiKey);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }
      
      const trimmedKey = apiKey.trim();
      
      // Test the API key with a simple request
      try {
        const testUrl = Config.GEMINI.API_URL + Config.GEMINI.MODEL + ':generateContent?key=' + encodeURIComponent(trimmedKey);
        const testResponse = UrlFetchApp.fetch(testUrl, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            contents: [{ parts: [{ text: 'test' }] }],
            generationConfig: { temperature: 0 }
          }),
          muteHttpExceptions: true,
          // Add timeout for API key validation (shorter timeout since it's just a test)
          timeout: 10 // 10 seconds timeout
        } as GoogleAppsScript.URL_Fetch.URLFetchRequestOptions);
        
        if (testResponse.getResponseCode() === 403) {
          throw new Error('API key is invalid or has insufficient permissions');
        } else if (testResponse.getResponseCode() !== 200) {
          throw new Error('API key validation failed. Please check your key.');
        }
      } catch (testError) {
        const errorMessage = String(testError);
        if (errorMessage.includes('API key')) {
          throw new Error(errorMessage);
        }
        if (errorMessage.includes('Timeout') || errorMessage.includes('timeout')) {
          throw new Error('API key validation timed out after 10 seconds. Please check your internet connection and try again.');
        }
        throw new Error('Failed to validate API key: ' + errorMessage);
      }
      
      PropertiesService.getUserProperties().setProperty(Config.PROP_KEYS.API_KEY, trimmedKey);
      AppLogger.info('API key saved and validated successfully');
      
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText('API key saved and validated successfully')
        )
        .setNavigation(CardService.newNavigation().updateCard(UI.buildApiKeyTab()))
        .build();
        
    } catch (err) {
      AppLogger.error('Error saving API key', { error: Utils.handleError(err) });
      return UI.showNotification('Error: ' + Utils.handleError(err));
    }
  }

  export function validateApiKeyFormat(e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      const apiKey = Utils.getFormValue(e, 'apiKey');
      const validation = Utils.validateApiKeyFormat(apiKey);
      
      if (validation.isValid) {
        return CardService.newActionResponseBuilder()
          .setNotification(
            CardService.newNotification().setText('✅ ' + validation.message)
          )
          .build();
      } else {
        return CardService.newActionResponseBuilder()
          .setNotification(
            CardService.newNotification().setText('❌ ' + validation.message)
          )
          .build();
      }
    } catch (err) {
      AppLogger.error('Error validating API key format', { error: Utils.handleError(err) });
      return UI.showNotification('Error: ' + Utils.handleError(err));
    }
  }

  export function runAnalysis(e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      // CRITICAL: Initialize spreadsheet logging for this execution
      AppLogger.initSpreadsheet();
      AppLogger.info('🔥 RUNANALYSIS CALLED - Button click received!');
      
      const apiKey = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.API_KEY);
      if (!apiKey) {
        throw new Error('Please configure your API key first');
      }
      
      // Check if compiled prompts exist before starting processing
      if (!DocsPromptEditor.hasCompiledPrompts()) {
        AppLogger.warn('⚠️ No compiled prompts found - processing blocked');
        return UI.showNotification('⚠️ Create Prompt Document first. Go to Prompt Editor tab to set up your prompts.');
      }
      
      const mode = Utils.getFormValue(e, 'mode', Config.ProcessingMode.LABEL_ONLY);
      
      // Save mode setting for persistence
      const userProps = PropertiesService.getUserProperties();
      userProps.setProperty(Config.PROP_KEYS.PROCESSING_MODE, mode);
      
      // Prompts now come ONLY from the Google Docs editor
      // No more on-page prompt editing
      
      // Determine processing flags based on mode
      const createDrafts = (mode === Config.ProcessingMode.CREATE_DRAFTS || mode === Config.ProcessingMode.AUTO_SEND);
      const autoReply = (mode === Config.ProcessingMode.AUTO_SEND);
      
      AppLogger.info('🔧 PARAMETERS EXTRACTED', { mode, createDrafts, autoReply });
      
      // Acquire analysis lock with timeout protection
      if (!LockManager.acquireLock(mode)) {
        AppLogger.warn('Analysis already running, cannot start new analysis');
        return UI.showNotification('Analysis is already running. Please wait for it to complete.');
      }
      
      // Clear any previous cancellation flag
      userProps.deleteProperty(Config.PROP_KEYS.ANALYSIS_CANCELLED);
      
      // Initialize real-time stats tracking
      userProps.setProperty(Config.PROP_KEYS.CURRENT_SCANNED, '0');
      userProps.setProperty(Config.PROP_KEYS.CURRENT_SUPPORTS, '0');
      userProps.setProperty(Config.PROP_KEYS.CURRENT_DRAFTED, '0');
      userProps.setProperty(Config.PROP_KEYS.CURRENT_SENT, '0');
      userProps.setProperty(Config.PROP_KEYS.CURRENT_ERRORS, '0');
      
      AppLogger.info('🚀 ANALYSIS STARTED', {
        mode: mode,
        createDrafts: createDrafts,
        autoReply: autoReply,
        promptsConfigured: true
      });
      
      // START PROCESSING IMMEDIATELY AND GO TO LIVE LOG VIEW
      // Prompts now come from docs only
      return ProcessingHandlers.continueProcessingAndNavigate(apiKey, mode, '', '', createDrafts, autoReply);
      
    } catch (err) {
      LockManager.releaseLock();
      AppLogger.error('Error starting analysis', { error: Utils.handleError(err) });
      return UI.showNotification('Error: ' + Utils.handleError(err));
    }
  }

  export function cancelProcessing(_e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      // Use LockManager as single source of truth for lock state
      const isProcessing = LockManager.isLocked();
      
      if (!isProcessing) {
        return UI.showNotification('No processing to cancel');
      }
      
      // Force release lock and mark as cancelled
      LockManager.releaseLock();
      const props = PropertiesService.getUserProperties();
      props.setProperty(Config.PROP_KEYS.ANALYSIS_CANCELLED, 'true');
      
      AppLogger.info('🛑 PROCESSING CANCELLED BY USER', {
        executionId: AppLogger.executionId,
        cancelledAt: new Date().toISOString()
      });
      
      // Clear real-time stats
      props.deleteProperty(Config.PROP_KEYS.CURRENT_SCANNED);
      props.deleteProperty(Config.PROP_KEYS.CURRENT_SUPPORTS);
      props.deleteProperty(Config.PROP_KEYS.CURRENT_DRAFTED);
      props.deleteProperty(Config.PROP_KEYS.CURRENT_SENT);
      props.deleteProperty(Config.PROP_KEYS.CURRENT_ERRORS);
      
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification()
            .setText('Processing cancelled successfully')
        )
        .setNavigation(CardService.newNavigation().updateCard(UI.buildLiveLogView()))
        .build();
    } catch (err) {
      AppLogger.error('Error cancelling processing', { error: Utils.handleError(err) });
      return UI.showNotification('Error cancelling: ' + Utils.handleError(err));
    }
  }

  export function toggleDebugMode(_e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      const props = PropertiesService.getUserProperties();
      const currentMode = props.getProperty(Config.PROP_KEYS.DEBUG_MODE) === 'true';
      const newMode = !currentMode;
      
      props.setProperty(Config.PROP_KEYS.DEBUG_MODE, newMode.toString());
      AppLogger.info('Debug mode toggled', { enabled: newMode });
      
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(
            newMode ? 'Debug mode enabled' : 'Debug mode disabled'
          )
        )
        .setNavigation(CardService.newNavigation().updateCard(UI.buildSettingsTab()))
        .build();
    } catch (err) {
      AppLogger.error('Error toggling debug mode', { error: Utils.handleError(err) });
      return UI.showNotification('Error: ' + Utils.handleError(err));
    }
  }

  export function toggleSpreadsheetLogging(_e: GoogleAppsScript.Addons.EventObject): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      const props = PropertiesService.getUserProperties();
      const currentMode = props.getProperty(Config.PROP_KEYS.SPREADSHEET_LOGGING) !== 'false'; // Default to true
      const newMode = !currentMode;
      
      props.setProperty(Config.PROP_KEYS.SPREADSHEET_LOGGING, newMode.toString());
      AppLogger.info('Spreadsheet logging toggled', { enabled: newMode });
      
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(
            newMode ? 'Spreadsheet logging enabled' : 'Spreadsheet logging disabled'
          )
        )
        .setNavigation(CardService.newNavigation().updateCard(UI.buildSettingsTab()))
        .build();
    } catch (err) {
      AppLogger.error('Error toggling spreadsheet logging', { error: Utils.handleError(err) });
      return UI.showNotification('Error: ' + Utils.handleError(err));
    }
  }
}