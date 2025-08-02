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
          .setTitle('Gmail AI Support Triage')
          .setSubtitle('Powered by Gemini')
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
    
    // Fixed action button at bottom
    const analyzeBtn = CardService.newTextButton()
      .setText('Analyze Inbox')
      .setBackgroundColor('#1a73e8')
      .setOnClickAction(
        CardService.newAction().setFunctionName('runAnalysis')
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
      .setNavigation(CardService.newNavigation().updateCard(card))
      .build();
  }

  export function buildLiveLogView(): GoogleAppsScript.Card_Service.Card {
    AppLogger.initSpreadsheet();
    const config = AppLogger.getSpreadsheetConfig();
    
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('Live Analysis Log')
          .setSubtitle('Real-time processing updates')
      );
    
    const mainSection = CardService.newCardSection();
    
    // Current execution info
    mainSection.addWidget(
      CardService.newKeyValue()
        .setTopLabel('Current Session')
        .setContent(AppLogger.executionId)
        .setBottomLabel('Execution ID')
    );
    
    // Analysis status
    const isRunning = PropertiesService.getUserProperties().getProperty('ANALYSIS_RUNNING') === 'true';
    mainSection.addWidget(
      CardService.newKeyValue()
        .setTopLabel('Status')
        .setContent(isRunning ? 'ANALYZING...' : 'READY')
        .setBottomLabel(isRunning ? 'Analysis in progress' : 'Ready for analysis')
    );
    
    // Start Processing button if not running
    if (!isRunning) {
      mainSection.addWidget(
        CardService.newTextButton()
          .setText('Start Processing')
          .setBackgroundColor('#34a853')
          .setOnClickAction(
            CardService.newAction().setFunctionName('doAnalysisProcessing')
          )
      );
    }
    
    // Recent log entries (last 10)
    const recentLogs = getRecentLogEntries(10);
    if (recentLogs.length > 0) {
      mainSection.addWidget(
        CardService.newTextParagraph()
          .setText('<b>Recent Activity:</b>')
      );
      
      recentLogs.forEach(logEntry => {
        const timeOnly = logEntry.timestamp.substring(11, 19); // Just time part
        const shortExecId = logEntry.executionId.substring(0, 8);
        
        // Color code by log level and type
        let iconAndColor = '';
        if (logEntry.message.includes('🚀')) iconAndColor = '🚀';
        else if (logEntry.message.includes('📧')) iconAndColor = '📧';
        else if (logEntry.message.includes('📤')) iconAndColor = '📤';
        else if (logEntry.message.includes('📥')) iconAndColor = '📥';
        else if (logEntry.message.includes('🎯')) iconAndColor = '🎯';
        else if (logEntry.message.includes('✍️')) iconAndColor = '✍️';
        else if (logEntry.message.includes('📝')) iconAndColor = '📝';
        else if (logEntry.message.includes('❌')) iconAndColor = '❌';
        else if (logEntry.message.includes('✅')) iconAndColor = '✅';
        else iconAndColor = logEntry.level === 'ERROR' ? '❌' : 'ℹ️';
        
        mainSection.addWidget(
          CardService.newKeyValue()
            .setTopLabel(timeOnly + ' ' + iconAndColor)
            .setContent(logEntry.message)
            .setBottomLabel(logEntry.level + ' | ' + shortExecId)
        );
      });
    }
    
    // Refresh button
    mainSection.addWidget(
      CardService.newTextButton()
        .setText('Refresh')
        .setOnClickAction(
          CardService.newAction().setFunctionName('refreshLiveLog')
        )
    );
    
    // Links to full logs
    if (config) {
      mainSection.addWidget(
        CardService.newTextButton()
          .setText('View Complete Log in Spreadsheet')
          .setBackgroundColor('#1a73e8')
          .setOpenLink(CardService.newOpenLink()
            .setUrl(config.todaySpreadsheetUrl)
          )
      );
    }
    
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

  function getRecentLogEntries(limit: number): Array<{timestamp: string, level: string, message: string, executionId: string}> {
    try {
      const config = AppLogger.getSpreadsheetConfig();
      if (!config) return [];
      
      const sheet = SpreadsheetApp.openById(config.todaySpreadsheetId).getActiveSheet();
      const lastRow = sheet.getLastRow();
      
      if (lastRow <= 1) return []; // Only headers
      
      const startRow = Math.max(2, lastRow - limit + 1);
      const numRows = lastRow - startRow + 1;
      
      const data = sheet.getRange(startRow, 1, numRows, 4).getValues();
      
      // Return in reverse order so newest logs appear first
      return data.map(row => ({
        timestamp: row[0] ? row[0].toString() : '',
        executionId: row[1] ? row[1].toString() : '',
        level: row[2] ? row[2].toString() : '',
        message: row[3] ? row[3].toString() : ''
      })).filter(entry => entry.timestamp && entry.message).reverse();
      
    } catch (error) {
      AppLogger.error('Failed to get recent log entries', { error: String(error) });
      return [];
    }
  }
}