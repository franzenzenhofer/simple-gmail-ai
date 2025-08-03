/**
 * Action Handlers Module
 * Contains all action handlers for user interactions
 */

namespace ActionHandlers {
  export function saveApiKey(e: any): GoogleAppsScript.Card_Service.ActionResponse {
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
      
      PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', trimmedKey);
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

  export function validateApiKeyFormat(e: any): GoogleAppsScript.Card_Service.ActionResponse {
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

  export function runAnalysis(e: any): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      // CRITICAL: Initialize spreadsheet logging for this execution
      AppLogger.initSpreadsheet();
      AppLogger.info('🔥 RUNANALYSIS CALLED - Button click received!');
      
      const apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('Please configure your API key first');
      }
      
      const mode = Utils.getFormValue(e, 'mode', Config.ProcessingMode.LABEL_ONLY);
      const prompt1 = Utils.getFormValue(e, 'prompt1', Config.PROMPTS.CLASSIFICATION);
      const prompt2 = Utils.getFormValue(e, 'prompt2', Config.PROMPTS.RESPONSE);
      
      // Save ALL settings for persistence
      const userProps = PropertiesService.getUserProperties();
      userProps.setProperty('PROCESSING_MODE', mode);
      userProps.setProperty('PROMPT_1', prompt1);
      userProps.setProperty('PROMPT_2', prompt2);
      
      // Determine processing flags based on mode
      const createDrafts = (mode === Config.ProcessingMode.CREATE_DRAFTS || mode === Config.ProcessingMode.AUTO_SEND);
      const autoReply = (mode === Config.ProcessingMode.AUTO_SEND);
      
      AppLogger.info('🔧 PARAMETERS EXTRACTED', { mode, createDrafts, autoReply, hasPrompt1: !!prompt1, hasPrompt2: !!prompt2 });
      
      // Acquire analysis lock with timeout protection
      if (!LockManager.acquireLock(mode)) {
        AppLogger.warn('Analysis already running, cannot start new analysis');
        return UI.showNotification('Analysis is already running. Please wait for it to complete.');
      }
      
      // Clear any previous cancellation flag
      userProps.deleteProperty('ANALYSIS_CANCELLED');
      
      // Initialize real-time stats tracking
      userProps.setProperty('CURRENT_SCANNED', '0');
      userProps.setProperty('CURRENT_SUPPORTS', '0');
      userProps.setProperty('CURRENT_DRAFTED', '0');
      userProps.setProperty('CURRENT_SENT', '0');
      userProps.setProperty('CURRENT_ERRORS', '0');
      
      AppLogger.info('🚀 ANALYSIS STARTED', {
        mode: mode,
        createDrafts: createDrafts,
        autoReply: autoReply,
        promptsConfigured: true
      });
      
      // START PROCESSING IMMEDIATELY AND GO TO LIVE LOG VIEW
      return ProcessingHandlers.continueProcessingAndNavigate(apiKey, mode, prompt1, prompt2, createDrafts, autoReply);
      
    } catch (err) {
      LockManager.releaseLock();
      AppLogger.error('Error starting analysis', { error: Utils.handleError(err) });
      return UI.showNotification('Error: ' + Utils.handleError(err));
    }
  }

  export function cancelProcessing(_e: any): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      // Use LockManager as single source of truth for lock state
      const isProcessing = LockManager.isLocked();
      
      if (!isProcessing) {
        return UI.showNotification('No processing to cancel');
      }
      
      // Force release lock and mark as cancelled
      LockManager.releaseLock();
      const props = PropertiesService.getUserProperties();
      props.setProperty('ANALYSIS_CANCELLED', 'true');
      
      AppLogger.info('🛑 PROCESSING CANCELLED BY USER', {
        executionId: AppLogger.executionId,
        cancelledAt: new Date().toISOString()
      });
      
      // Clear real-time stats
      props.deleteProperty('CURRENT_SCANNED');
      props.deleteProperty('CURRENT_SUPPORTS');
      props.deleteProperty('CURRENT_DRAFTED');
      props.deleteProperty('CURRENT_SENT');
      props.deleteProperty('CURRENT_ERRORS');
      
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

  export function toggleDebugMode(_e: any): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      const props = PropertiesService.getUserProperties();
      const currentMode = props.getProperty('DEBUG_MODE') === 'true';
      const newMode = !currentMode;
      
      props.setProperty('DEBUG_MODE', newMode.toString());
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

  export function toggleSpreadsheetLogging(_e: any): GoogleAppsScript.Card_Service.ActionResponse {
    try {
      const props = PropertiesService.getUserProperties();
      const currentMode = props.getProperty('SPREADSHEET_LOGGING') !== 'false'; // Default to true
      const newMode = !currentMode;
      
      props.setProperty('SPREADSHEET_LOGGING', newMode.toString());
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