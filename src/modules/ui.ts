/**
 * UI Builder Module
 * Contains all UI building functions
 */

namespace UI {
  export function buildHomepage(): GoogleAppsScript.Card_Service.Card {
    const savedKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
    const hasApiKey = savedKey.trim() !== '';
    
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('v' + Config.VERSION + ' • ' + Config.DEPLOY_TIME)
      );
    
    if (!hasApiKey) {
      // API Key Warning
      const warningSection = CardService.newCardSection();
      warningSection.addWidget(
        CardService.newDecoratedText()
          .setText('API Key Required')
          .setBottomLabel('Configure your Gemini API key to get started')
          .setOpenLink(CardService.newOpenLink()
            .setUrl('#')
            .setOnClose(CardService.OnClose.RELOAD)
            .setOpenAs(CardService.OpenAs.OVERLAY))
          .setOnClickAction(
            CardService.newAction().setFunctionName('showApiKeyTab')
          )
      );
      card.addSection(warningSection);
    }
    
    // Main Controls
    const mainSection = CardService.newCardSection();
    
    // Mode Selection
    mainSection.addWidget(
      CardService.newSelectionInput()
        .setFieldName('mode')
        .setTitle('Processing Mode')
        .setType(CardService.SelectionInputType.RADIO_BUTTON)
        .addItem('Label emails only', 'label', true)
        .addItem('Label + Create drafts', 'draft', false)
    );
    
    // Auto-reply
    mainSection.addWidget(
      CardService.newSelectionInput()
        .setFieldName('autoReply')
        .setType(CardService.SelectionInputType.CHECK_BOX)
        .addItem('🚨 Auto-send replies', 'send', false)
    );
    
    // Classification Prompt
    mainSection.addWidget(
      CardService.newTextInput()
        .setFieldName('prompt1')
        .setTitle('Classification Prompt')
        .setHint('How to identify support emails')
        .setValue(PropertiesService.getUserProperties().getProperty('PROMPT_1') || Config.PROMPTS.CLASSIFICATION)
        .setMultiline(true)
    );
    
    // Response Prompt
    mainSection.addWidget(
      CardService.newTextInput()
        .setFieldName('prompt2')
        .setTitle('Response Prompt')
        .setHint('How to draft replies')
        .setValue(PropertiesService.getUserProperties().getProperty('PROMPT_2') || Config.PROMPTS.RESPONSE)
        .setMultiline(true)
    );
    
    card.addSection(mainSection);
    
    // Last Execution section
    const lastExecSection = CardService.newCardSection();
    const lastExecTime = PropertiesService.getUserProperties().getProperty('LAST_EXECUTION_TIME');
    const lastExecStats = PropertiesService.getUserProperties().getProperty('LAST_EXECUTION_STATS');
    
    if (lastExecTime && lastExecStats) {
      lastExecSection.addWidget(
        CardService.newKeyValue()
          .setTopLabel('Last Execution')
          .setContent(lastExecTime)
          .setBottomLabel(lastExecStats)
      );
    } else {
      lastExecSection.addWidget(
        CardService.newKeyValue()
          .setTopLabel('Last Execution')
          .setContent('No recent runs')
          .setBottomLabel('Run analysis to see statistics')
      );
    }
    
    card.addSection(lastExecSection);
    
    // Fixed action button at bottom
    const analyzeBtn = CardService.newTextButton()
      .setText('Analyze Inbox')
      .setBackgroundColor('#1a73e8')
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('runAnalysis')
          .setLoadIndicator(CardService.LoadIndicator.SPINNER)
      );
    
    if (!hasApiKey) {
      analyzeBtn.setDisabled(true);
    }
    
    card.setFixedFooter(
      CardService.newFixedFooter()
        .setPrimaryButton(analyzeBtn)
    );
    
    return card.build();
  }
  
  export function buildApiKeyTab(): GoogleAppsScript.Card_Service.Card {
    const savedKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
    const hasApiKey = savedKey.trim() !== '';
    
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('API Key Configuration')
      );
    
    const mainSection = CardService.newCardSection();
    
    if (hasApiKey) {
      mainSection.addWidget(
        CardService.newKeyValue()
          .setTopLabel('Status')
          .setContent('API Key Configured')
          .setBottomLabel('Key ending in ...' + savedKey.slice(-8))
      );
    }
    
    mainSection.addWidget(
      CardService.newTextInput()
        .setFieldName('apiKey')
        .setTitle('Gemini API Key')
        .setHint('Your Gemini 2.5 Flash API key')
        .setValue(savedKey)
    );
    
    mainSection.addWidget(
      CardService.newTextButton()
        .setText('Save API Key')
        .setBackgroundColor('#34a853')
        .setOnClickAction(
          CardService.newAction().setFunctionName('saveApiKey')
        )
    );
    
    mainSection.addWidget(
      CardService.newTextParagraph()
        .setText('<i>Get your API key from <a href="https://aistudio.google.com/apikey">Google AI Studio</a></i>')
    );
    
    card.addSection(mainSection);
    
    // Back button
    const footerSection = CardService.newCardSection();
    footerSection.addWidget(
      CardService.newTextButton()
        .setText('Back')
        .setOnClickAction(
          CardService.newAction().setFunctionName('backToMain')
        )
    );
    card.addSection(footerSection);
    
    return card.build();
  }
  
  export function buildLogsTab(): GoogleAppsScript.Card_Service.Card {
    AppLogger.initSpreadsheet();
    const config = AppLogger.getSpreadsheetConfig();
    
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('Logs & Diagnostics')
      );
    
    const mainSection = CardService.newCardSection();
    
    if (config) {
      mainSection.addWidget(
        CardService.newDecoratedText()
          .setText('Today\'s Log')
          .setBottomLabel(config.dateString)
          .setOpenLink(CardService.newOpenLink()
            .setUrl(config.todaySpreadsheetUrl)
          )
      );
      
      mainSection.addWidget(
        CardService.newDecoratedText()
          .setText('All Logs')
          .setBottomLabel('View all daily logs')
          .setOpenLink(CardService.newOpenLink()
            .setUrl(config.folderUrl)
          )
      );
    }
    
    mainSection.addWidget(
      CardService.newKeyValue()
        .setTopLabel('Current Session')
        .setContent(AppLogger.executionId)
    );
    
    card.addSection(mainSection);
    
    // Back button
    const footerSection = CardService.newCardSection();
    footerSection.addWidget(
      CardService.newTextButton()
        .setText('Back')
        .setOnClickAction(
          CardService.newAction().setFunctionName('backToMain')
        )
    );
    card.addSection(footerSection);
    
    return card.build();
  }
  
  export function buildSettingsTab(): GoogleAppsScript.Card_Service.Card {
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('Settings')
      );
    
    const mainSection = CardService.newCardSection();
    
    const isDebugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE') === 'true';
    mainSection.addWidget(
      CardService.newDecoratedText()
        .setText(isDebugMode ? 'Debug Mode: ON' : 'Debug Mode: OFF')
        .setBottomLabel(isDebugMode ? 'Verbose logging enabled' : 'Normal logging')
        .setSwitchControl(
          CardService.newSwitch()
            .setFieldName('debugMode')
            .setValue(isDebugMode ? 'true' : 'false')
            .setOnChangeAction(
              CardService.newAction().setFunctionName('toggleDebugMode')
            )
        )
    );
    
    const spreadsheetDisabled = PropertiesService.getUserProperties().getProperty('SPREADSHEET_LOGGING') === 'false';
    mainSection.addWidget(
      CardService.newDecoratedText()
        .setText(spreadsheetDisabled ? 'Spreadsheet Logs: OFF' : 'Spreadsheet Logs: ON')
        .setBottomLabel(spreadsheetDisabled ? 'Console only' : 'Logging to Google Sheets')
        .setSwitchControl(
          CardService.newSwitch()
            .setFieldName('spreadsheetLogging')
            .setValue(spreadsheetDisabled ? 'false' : 'true')
            .setOnChangeAction(
              CardService.newAction().setFunctionName('toggleSpreadsheetLogging')
            )
        )
    );
    
    mainSection.addWidget(
      CardService.newKeyValue()
        .setTopLabel('Version')
        .setContent('v' + Config.VERSION)
        .setBottomLabel('Deployed: ' + Config.DEPLOY_TIME)
    );
    
    card.addSection(mainSection);
    
    // Back button
    const footerSection = CardService.newCardSection();
    footerSection.addWidget(
      CardService.newTextButton()
        .setText('Back')
        .setOnClickAction(
          CardService.newAction().setFunctionName('backToMain')
        )
    );
    card.addSection(footerSection);
    
    return card.build();
  }
  
  export function showNotification(message: string): GoogleAppsScript.Card_Service.ActionResponse {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(message)
      )
      .build();
  }
  
  export function navigateTo(card: GoogleAppsScript.Card_Service.Card): GoogleAppsScript.Card_Service.ActionResponse {
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(card))
      .build();
  }

  export function buildLiveLogView(): GoogleAppsScript.Card_Service.Card {
    AppLogger.initSpreadsheet();
    const config = AppLogger.getSpreadsheetConfig();
    
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('🔴 LIVE ANALYSIS')
          .setSubtitle('Real-time Email Processing')
      );
    
    // === REAL-TIME STATS SECTION ===
    const statsSection = CardService.newCardSection();
    const isRunning = PropertiesService.getUserProperties().getProperty('ANALYSIS_RUNNING') === 'true';
    
    // Get current stats from properties
    const currentStats = getCurrentProcessingStats();
    
    // Stats display with live counters
    statsSection.addWidget(
      CardService.newDecoratedText()
        .setText('<b>' + (isRunning ? '⏳ PROCESSING' : '✅ READY') + '</b>')
        .setBottomLabel('Status: ' + (isRunning ? 'Analysis in progress...' : 'Ready for new analysis'))
    );
    
    if (currentStats.scanned > 0 || isRunning) {
      statsSection.addWidget(
        CardService.newTextParagraph()
          .setText('<b>📊 LIVE STATS:</b> ' + 
            '📧 ' + currentStats.scanned + ' processed | ' +
            '🎯 ' + currentStats.supports + ' support | ' +
            '📝 ' + currentStats.drafted + ' drafts | ' +
            '📤 ' + currentStats.sent + ' sent' +
            (currentStats.errors > 0 ? ' | ❌ ' + currentStats.errors + ' errors' : ''))
      );
    }
    
    card.addSection(statsSection);
    
    // === LIVE ACTIVITY FEED ===
    const activitySection = CardService.newCardSection();
    
    // Get filtered, relevant log entries - current execution if running, otherwise last execution
    const relevantLogs = isRunning ? 
      getCurrentExecutionLogs(15) : 
      getLastExecutionLogs(15);
    
    if (relevantLogs.length > 0) {
      activitySection.addWidget(
        CardService.newTextParagraph()
          .setText('<b>📋 ACTIVITY FEED:</b>')
      );
      
      relevantLogs.forEach((logEntry) => {
        const timeOnly = logEntry.timestamp.substring(11, 19);
        
        // Enhanced message formatting
        let displayMessage = logEntry.message;
        let icon = '•';
        let importance = 'normal';
        
        // Categorize and format messages
        if (logEntry.message.includes('📧 PROCESSING EMAIL')) {
          icon = '📧';
          importance = 'high';
          displayMessage = logEntry.message.replace('📧 PROCESSING EMAIL', 'Processing email');
        } else if (logEntry.message.includes('📤 PROMPT SENT')) {
          icon = '📤';
          displayMessage = 'AI prompt sent → ' + logEntry.message.split('PROMPT SENT')[1];
        } else if (logEntry.message.includes('📥 RAW RESPONSE')) {
          icon = '📥';
          displayMessage = 'AI response received ← ' + (logEntry.message.length > 80 ? 
            logEntry.message.substring(0, 80) + '...' : logEntry.message);
        } else if (logEntry.message.includes('🎯 EMAIL CLASSIFIED')) {
          icon = '🎯';
          importance = 'high';
          displayMessage = logEntry.message.replace('🎯 EMAIL CLASSIFIED', 'Classified as');
        } else if (logEntry.message.includes('✍️ DRAFT CREATED')) {
          icon = '✍️';
          importance = 'high';
          displayMessage = logEntry.message.replace('✍️ DRAFT CREATED', 'Draft reply created');
        } else if (logEntry.message.includes('📤 EMAIL SENT')) {
          icon = '📤';
          importance = 'high';
          displayMessage = logEntry.message.replace('📤 EMAIL SENT', 'Reply sent');
        } else if (logEntry.message.includes('✅ COMPLETED')) {
          icon = '🏁';
          importance = 'high';
          displayMessage = logEntry.message.replace('✅ COMPLETED', 'Analysis completed');
        }
        
        // Create the activity entry
        const widget = CardService.newKeyValue()
          .setTopLabel(timeOnly + ' ' + icon)
          .setContent(displayMessage);
        
        if (importance === 'high') {
          widget.setBottomLabel('⭐ ' + logEntry.level);
        } else {
          widget.setBottomLabel(logEntry.level);
        }
        
        activitySection.addWidget(widget);
      });
    } else {
      activitySection.addWidget(
        CardService.newTextParagraph()
          .setText('<i>No recent activity. Start processing to see live updates.</i>')
      );
    }
    
    // Auto-refresh button with different text based on status
    activitySection.addWidget(
      CardService.newTextButton()
        .setText(isRunning ? '🔄 REFRESH (Auto)' : '🔄 Refresh')
        .setOnClickAction(
          CardService.newAction().setFunctionName('refreshLiveLog')
        )
    );
    
    card.addSection(activitySection);
    
    // === QUICK ACTIONS ===
    const quickActionsSection = CardService.newCardSection();
    
    if (config) {
      quickActionsSection.addWidget(
        CardService.newTextButton()
          .setText('📊 Full Log Details')
          .setOpenLink(CardService.newOpenLink()
            .setUrl(config.todaySpreadsheetUrl)
          )
      );
    }
    
    quickActionsSection.addWidget(
      CardService.newTextButton()
        .setText('← Back to Main')
        .setOnClickAction(
          CardService.newAction().setFunctionName('backToMain')
        )
    );
    
    card.addSection(quickActionsSection);
    
    return card.build();
  }

  function getCurrentProcessingStats(): {scanned: number, supports: number, drafted: number, sent: number, errors: number} {
    try {
      const scanned = parseInt(PropertiesService.getUserProperties().getProperty('CURRENT_SCANNED') || '0');
      const supports = parseInt(PropertiesService.getUserProperties().getProperty('CURRENT_SUPPORTS') || '0');
      const drafted = parseInt(PropertiesService.getUserProperties().getProperty('CURRENT_DRAFTED') || '0');
      const sent = parseInt(PropertiesService.getUserProperties().getProperty('CURRENT_SENT') || '0');
      const errors = parseInt(PropertiesService.getUserProperties().getProperty('CURRENT_ERRORS') || '0');
      
      return { scanned, supports, drafted, sent, errors };
    } catch (error) {
      return { scanned: 0, supports: 0, drafted: 0, sent: 0, errors: 0 };
    }
  }

  function getCurrentExecutionLogs(limit: number): Array<{timestamp: string, level: string, message: string, executionId: string}> {
    try {
      // Read from PropertiesService - FAST and reliable!
      const props = PropertiesService.getUserProperties();
      const currentExecutionId = props.getProperty('CURRENT_EXECUTION_ID') || AppLogger.executionId;
      const logKey = 'LIVE_LOG_' + currentExecutionId;
      const logsJson = props.getProperty(logKey);
      
      if (!logsJson) {
        return [];
      }
      
      const logs = JSON.parse(logsJson);
      
      // Map to expected format and reverse (newest first)
      const entries = logs.map((log: any) => ({
        timestamp: log.timestamp || '',
        executionId: currentExecutionId,
        level: log.level || 'INFO',
        message: log.message || ''
      })).reverse();
      
      return entries.slice(0, limit);
      
    } catch (error) {
      console.error('Failed to get current execution logs from properties:', String(error));
      return [];
    }
  }

  function getLastExecutionLogs(limit: number): Array<{timestamp: string, level: string, message: string, executionId: string}> {
    try {
      // Find the last execution ID from properties
      const props = PropertiesService.getUserProperties();
      const lastExecutionId = props.getProperty('LAST_EXECUTION_ID');
      
      if (!lastExecutionId) {
        return [];
      }
      
      const logKey = 'LIVE_LOG_' + lastExecutionId;
      const logsJson = props.getProperty(logKey);
      
      if (!logsJson) {
        return [];
      }
      
      const logs = JSON.parse(logsJson);
      
      // Map to expected format and reverse (newest first)
      const entries = logs.map((log: any) => ({
        timestamp: log.timestamp || '',
        executionId: lastExecutionId,
        level: log.level || 'INFO',
        message: log.message || ''
      })).reverse();
      
      return entries.slice(0, limit);
      
    } catch (error) {
      console.error('Failed to get last execution logs from properties:', String(error));
      return [];
    }
  }

}