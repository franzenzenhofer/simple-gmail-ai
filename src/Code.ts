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
 * Initialize global error handler
 */
function handleGlobalError(error: any): GoogleAppsScript.Card_Service.Card {
  const errorMessage = error?.message || String(error);
  
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('⚠️ Error')
      .setSubtitle('Gmail AI Support Triage'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText('An error occurred: ' + errorMessage))
      .addWidget(CardService.newTextParagraph()
        .setText('Please try reloading Gmail or reinstalling the add-on.')));
  
  return card.build();
}

/**
 * Entry point for Gmail add-on homepage
 */
function onHomepage(): GoogleAppsScript.Card_Service.Card {
  try {
    AppLogger.initSpreadsheet();
    AppLogger.info('Gmail Add-on started', {
      version: Config.VERSION,
      executionId: AppLogger.executionId
    });
    
    return UI.buildHomepage();
  } catch (error) {
    return handleGlobalError(error);
  }
}

// ===== NAVIGATION HANDLERS =====

function showApiKeyTab(): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    return UI.navigateTo(UI.buildApiKeyTab());
  } catch (error) {
    return UI.navigateTo(handleGlobalError(error));
  }
}

function showLogsTab(): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    return UI.navigateTo(UI.buildLogsTab());
  } catch (error) {
    return UI.navigateTo(handleGlobalError(error));
  }
}

function showSettingsTab(): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    return UI.navigateTo(UI.buildSettingsTab());
  } catch (error) {
    return UI.navigateTo(handleGlobalError(error));
  }
}

function backToMain(): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    return UI.navigateTo(UI.buildHomepage());
  } catch (error) {
    return UI.navigateTo(handleGlobalError(error));
  }
}

// ===== ACTION HANDLERS =====

function saveApiKey(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const apiKey = Utils.getFormValue(e, 'apiKey');
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Please enter an API key');
    }
    
    // Validate Gemini API key format
    const trimmedKey = apiKey.trim();
    if (!trimmedKey.match(/^AIza[0-9A-Za-z\-_]{35}$/)) {
      throw new Error('Invalid API key format. Gemini API keys start with "AIza" followed by 35 characters.');
    }
    
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
        muteHttpExceptions: true
      });
      
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

function runAnalysis(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    // CRITICAL: Initialize spreadsheet logging for this execution
    AppLogger.initSpreadsheet();
    AppLogger.info('🔥 RUNANALYSIS CALLED - Button click received!');
    
    const apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Please configure your API key first');
    }
    
    const mode = Utils.getFormValue(e, 'mode', 'label');
    const prompt1 = Utils.getFormValue(e, 'prompt1', Config.PROMPTS.CLASSIFICATION);
    const prompt2 = Utils.getFormValue(e, 'prompt2', Config.PROMPTS.RESPONSE);
    
    // Save ALL settings for persistence
    const userProps = PropertiesService.getUserProperties();
    userProps.setProperty('PROCESSING_MODE', mode);
    userProps.setProperty('PROMPT_1', prompt1);
    userProps.setProperty('PROMPT_2', prompt2);
    
    // Determine processing flags based on mode
    const createDrafts = (mode === 'draft' || mode === 'send');
    const autoReply = (mode === 'send');
    
    AppLogger.info('🔧 PARAMETERS EXTRACTED', { mode, createDrafts, autoReply, hasPrompt1: !!prompt1, hasPrompt2: !!prompt2 });
    
    // Mark analysis as starting 
    PropertiesService.getUserProperties().setProperty('ANALYSIS_RUNNING', 'true');
    
    // Initialize real-time stats tracking
    const properties = PropertiesService.getUserProperties();
    properties.setProperty('CURRENT_SCANNED', '0');
    properties.setProperty('CURRENT_SUPPORTS', '0');
    properties.setProperty('CURRENT_DRAFTED', '0');
    properties.setProperty('CURRENT_SENT', '0');
    properties.setProperty('CURRENT_ERRORS', '0');
    
    AppLogger.info('🚀 ANALYSIS STARTED', {
      mode: mode,
      createDrafts: createDrafts,
      autoReply: autoReply,
      promptsConfigured: true
    });
    
    // START ACTUAL PROCESSING
    const threads = GmailService.getUnprocessedThreads();
    const stats: Types.ProcessingStats = {
      scanned: 0,
      supports: 0,
      drafted: 0,
      sent: 0,
      errors: 0
    };
    
    AppLogger.info('📊 Starting analysis', {
      threadCount: threads.length,
      mode,
      createDrafts,
      autoReply
    });
    
    // Use batch processing instead of individual thread processing
    const results = GmailService.processThreads(
      threads,
      apiKey,
      createDrafts,
      autoReply,
      prompt1,
      prompt2
    );
    
    // Process results and update stats
    results.forEach((result) => {
      stats.scanned++;
      
      if (result.error) {
        stats.errors++;
      } else if (result.isSupport) {
        stats.supports++;
        if (createDrafts) {
          stats.drafted++;
        }
        if (autoReply) {
          stats.sent++;
        }
      }
      
      // Update real-time stats after each thread is processed
      properties.setProperty('CURRENT_SCANNED', stats.scanned.toString());
      properties.setProperty('CURRENT_SUPPORTS', stats.supports.toString());
      properties.setProperty('CURRENT_DRAFTED', stats.drafted.toString());
      properties.setProperty('CURRENT_SENT', stats.sent.toString());
      properties.setProperty('CURRENT_ERRORS', stats.errors.toString());
    });
    
    AppLogger.info('🎯 Analysis completed', { stats });
    
    // Mark analysis as complete and save execution info
    const props = PropertiesService.getUserProperties();
    props.setProperty('ANALYSIS_RUNNING', 'false');
    
    // Save last execution time and stats
    const executionTime = new Date().toLocaleString('de-AT', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Vienna'
    });
    const statsString = `${stats.scanned} analyzed | ${stats.supports} support | ${stats.drafted} drafts | ${stats.sent} sent${stats.errors > 0 ? ' | ' + stats.errors + ' errors' : ''}`;
    
    props.setProperty('LAST_EXECUTION_TIME', executionTime);
    props.setProperty('LAST_EXECUTION_STATS', statsString);
    
    // CRITICAL: Save this execution ID as the last one for live log view
    props.setProperty('LAST_EXECUTION_ID', AppLogger.executionId);
    
    const message = `✅ COMPLETED: ${statsString}`;
    AppLogger.info(message);
    
    // Navigate to live log view to show results
    AppLogger.info('🚀 NAVIGATING TO LIVE LOG VIEW - using pushCard() now');
    return UI.navigateTo(UI.buildLiveLogView());
    
  } catch (err) {
    PropertiesService.getUserProperties().setProperty('ANALYSIS_RUNNING', 'false');
    AppLogger.error('Error in analysis', { error: Utils.handleError(err) });
    return UI.navigateTo(UI.buildLiveLogView());
  }
}


function toggleDebugMode(_e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const currentDebugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE') === 'true';
  const newDebugMode = !currentDebugMode;
  
  PropertiesService.getUserProperties().setProperty('DEBUG_MODE', newDebugMode.toString());
  AppLogger.info('Debug mode toggled', { newValue: newDebugMode });
  
  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification()
        .setText(newDebugMode ? 'Debug mode enabled' : 'Debug mode disabled')
    )
    .setNavigation(CardService.newNavigation().updateCard(UI.buildSettingsTab()))
    .build();
}

function toggleSpreadsheetLogging(_e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const currentDisabled = PropertiesService.getUserProperties().getProperty('SPREADSHEET_LOGGING') === 'false';
  const newDisabled = !currentDisabled;
  
  PropertiesService.getUserProperties().setProperty('SPREADSHEET_LOGGING', newDisabled ? 'false' : 'true');
  
  if (!newDisabled) {
    AppLogger.initSpreadsheet();
  }
  
  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification()
        .setText(newDisabled ? 'Spreadsheet logging disabled' : 'Spreadsheet logging enabled')
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

function showApiKeyTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return CardService.newUniversalActionResponseBuilder()
    .displayAddOnCards([UI.buildApiKeyTab()])
    .build();
}

function showLogsTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return CardService.newUniversalActionResponseBuilder()
    .displayAddOnCards([UI.buildLogsTab()])
    .build();
}

function showSettingsTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return CardService.newUniversalActionResponseBuilder()
    .displayAddOnCards([UI.buildSettingsTab()])
    .build();
}

function showLiveLogTabUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return CardService.newUniversalActionResponseBuilder()
    .displayAddOnCards([UI.buildLiveLogView()])
    .build();
}

function refreshLiveLog(): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    return UI.navigateTo(UI.buildLiveLogView());
  } catch (error) {
    return UI.navigateTo(handleGlobalError(error));
  }
}

function onGmailMessage(_e: any): GoogleAppsScript.Card_Service.Card {
  // For now, just show the homepage
  // In the future, this could show context-specific actions
  return onHomepage();
}