/**
 * Gmail Support Triage & Auto-Reply Add-on
 * Main entry point - imports all modules
 */

// Module imports (will be inlined by bundler)
/// <reference path="modules/config.ts" />
/// <reference path="modules/types.ts" />
/// <reference path="modules/logger.ts" />
/// <reference path="modules/ai.ts" />
/// <reference path="modules/gmail.ts" />
/// <reference path="modules/ui.ts" />
/// <reference path="modules/utils.ts" />

// ===== MAIN ENTRY POINTS =====

/**
 * Entry point for Gmail add-on homepage
 */
function onHomepage(): GoogleAppsScript.Card_Service.Card {
  AppLogger.initSpreadsheet();
  AppLogger.info('Gmail Add-on started', {
    version: Config.VERSION,
    executionId: AppLogger.executionId
  });
  
  return UI.buildHomepage();
}

// ===== NAVIGATION HANDLERS =====

function showApiKeyTab(): GoogleAppsScript.Card_Service.ActionResponse {
  return UI.navigateTo(UI.buildApiKeyTab());
}

function showLogsTab(): GoogleAppsScript.Card_Service.ActionResponse {
  return UI.navigateTo(UI.buildLogsTab());
}

function showSettingsTab(): GoogleAppsScript.Card_Service.ActionResponse {
  return UI.navigateTo(UI.buildSettingsTab());
}

function backToMain(): GoogleAppsScript.Card_Service.ActionResponse {
  return UI.navigateTo(UI.buildHomepage());
}

// ===== ACTION HANDLERS =====

function saveApiKey(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const apiKey = Utils.getFormValue(e, 'apiKey');
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Please enter an API key');
    }
    
    PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', apiKey);
    AppLogger.info('API key saved successfully');
    
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText('✅ API key saved successfully')
      )
      .setNavigation(CardService.newNavigation().updateCard(UI.buildApiKeyTab()))
      .build();
      
  } catch (err) {
    AppLogger.error('Error saving API key', { error: Utils.handleError(err) });
    return UI.showNotification('❌ ' + Utils.handleError(err));
  }
}

function runAnalysis(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Please configure your API key first');
    }
    
    const mode = Utils.getFormValue(e, 'mode', 'label');
    const autoReply = Utils.getFormValue(e, 'autoReply') === 'send';
    const prompt1 = Utils.getFormValue(e, 'prompt1', Config.PROMPTS.CLASSIFICATION);
    const prompt2 = Utils.getFormValue(e, 'prompt2', Config.PROMPTS.RESPONSE);
    
    // Save prompts
    PropertiesService.getUserProperties().setProperty('PROMPT_1', prompt1);
    PropertiesService.getUserProperties().setProperty('PROMPT_2', prompt2);
    
    const threads = GmailService.getUnprocessedThreads();
    const stats: Types.ProcessingStats = {
      scanned: 0,
      supports: 0,
      drafted: 0,
      sent: 0,
      errors: 0
    };
    
    AppLogger.info('Starting analysis', {
      threadCount: threads.length,
      mode,
      autoReply
    });
    
    threads.forEach((thread, index) => {
      stats.scanned++;
      
      const result = GmailService.processThread(
        thread,
        apiKey,
        mode,
        autoReply,
        prompt1,
        prompt2
      );
      
      if (result.error) {
        stats.errors++;
      } else if (result.isSupport) {
        stats.supports++;
        if (mode === 'draft') stats.drafted++;
        if (autoReply) stats.sent++;
      }
    });
    
    AppLogger.info('Analysis completed', { stats });
    
    const message = `✅ Analyzed ${stats.scanned} | Support: ${stats.supports} | Drafts: ${stats.drafted} | Sent: ${stats.sent}${stats.errors > 0 ? ' | Errors: ' + stats.errors : ''}`;
    
    return UI.showNotification(message);
    
  } catch (err) {
    AppLogger.error('Error in analysis', { error: Utils.handleError(err) });
    return UI.showNotification('❌ ' + Utils.handleError(err));
  }
}

function toggleDebugMode(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const currentDebugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE') === 'true';
  const newDebugMode = !currentDebugMode;
  
  PropertiesService.getUserProperties().setProperty('DEBUG_MODE', newDebugMode.toString());
  AppLogger.info('Debug mode toggled', { newValue: newDebugMode });
  
  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification()
        .setText(newDebugMode ? '🐛 Debug mode enabled' : '📊 Debug mode disabled')
    )
    .setNavigation(CardService.newNavigation().updateCard(UI.buildSettingsTab()))
    .build();
}

function toggleSpreadsheetLogging(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const currentDisabled = PropertiesService.getUserProperties().getProperty('SPREADSHEET_LOGGING') === 'false';
  const newDisabled = !currentDisabled;
  
  PropertiesService.getUserProperties().setProperty('SPREADSHEET_LOGGING', newDisabled ? 'false' : 'true');
  
  if (!newDisabled) {
    AppLogger.initSpreadsheet();
  }
  
  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification()
        .setText(newDisabled ? '📊 Spreadsheet logging disabled' : '📊 Spreadsheet logging enabled')
    )
    .setNavigation(CardService.newNavigation().updateCard(UI.buildSettingsTab()))
    .build();
}

// ===== UNIVERSAL ACTIONS =====

function viewLogsUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return CardService.newUniversalActionResponseBuilder()
    .displayAddOnCards([UI.buildLogsTab()])
    .build();
}