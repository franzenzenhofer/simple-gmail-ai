/**
 * UI Builder Module
 * Contains all UI building functions
 */

namespace UI {
  // Type for log entries used in UI
  interface UILogEntry {
    timestamp: string;
    level: string;
    message: string;
    executionId: string;
    shortMessage?: string;
  }
  export function buildHomepage(): GoogleAppsScript.Card_Service.Card {
    const savedKey = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.API_KEY) || '';
    const hasApiKey = savedKey.trim() !== '';
    
    // Check if processing using robust lock manager
    const isProcessing = LockManager.isLocked();
    
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
    
    // Mode Selection - 3 clear radio buttons with persistence
    const savedMode = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.PROCESSING_MODE) || Config.ProcessingMode.LABEL_ONLY;
    
    mainSection.addWidget(
      CardService.newSelectionInput()
        .setFieldName('mode')
        .setTitle('Processing Mode')
        .setType(CardService.SelectionInputType.RADIO_BUTTON)
        .addItem('Labels only', Config.ProcessingMode.LABEL_ONLY, savedMode === Config.ProcessingMode.LABEL_ONLY)
        .addItem('Labels + Draft', Config.ProcessingMode.CREATE_DRAFTS, savedMode === Config.ProcessingMode.CREATE_DRAFTS)
        .addItem('Labels + Send', Config.ProcessingMode.AUTO_SEND, savedMode === Config.ProcessingMode.AUTO_SEND)
    );
    
    // T-10: Add test mode toggle
    const isTestMode = TestMode.isTestModeActive();
    mainSection.addWidget(
      CardService.newDecoratedText()
        .setText('🧪 Test Run (1 email)')
        .setBottomLabel(isTestMode ? 'Test mode active - safe dry-run' : 'Process normally')
        .setSwitchControl(
          CardService.newSwitch()
            .setFieldName('testMode')
            .setValue(isTestMode ? 'true' : 'false')
            .setOnChangeAction(
              CardService.newAction().setFunctionName('toggleTestModeQuick')
            )
        )
    );
    
    card.addSection(mainSection);
    
    // Classification Prompt - Large editor
    const promptSection = CardService.newCardSection();
    promptSection.addWidget(
      CardService.newTextInput()
        .setFieldName('prompt1')
        .setTitle('🎯 Classification Prompt (How to identify support emails)')
        .setHint('Tell the AI how to classify emails as "support" or "undefined"')
        .setValue(PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.PROMPT_1) || Config.PROMPTS.CLASSIFICATION)
        .setMultiline(true)
    );
    
    // Response Prompt - Large editor  
    promptSection.addWidget(
      CardService.newTextInput()
        .setFieldName('prompt2')
        .setTitle('✍️ Response Prompt (How to draft replies)')
        .setHint('Tell the AI how to write helpful customer support responses')
        .setValue(PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.PROMPT_2) || Config.PROMPTS.RESPONSE)
        .setMultiline(true)
    );
    
    card.addSection(promptSection);
    
    // Docs Prompt Editor Button
    const docsEditorSection = CardService.newCardSection();
    docsEditorSection.addWidget(
      CardService.newTextButton()
        .setText('📝 Open Docs Prompt Editor')
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('showPromptEditor')
        )
    );
    docsEditorSection.addWidget(
      CardService.newTextParagraph()
        .setText('<i>Advanced: Manage prompts in Google Docs with per-label customization</i>')
    );
    card.addSection(docsEditorSection);
    
    // Last Execution section
    const lastExecSection = CardService.newCardSection();
    const lastExecTime = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.LAST_EXECUTION_TIME);
    const lastExecStats = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.LAST_EXECUTION_STATS);
    
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
      .setText(isProcessing ? 'Processing...' : 'Analyze Inbox')
      .setBackgroundColor(isProcessing ? Config.COLORS.PRIMARY_DISABLED : Config.COLORS.PRIMARY)
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('runAnalysis')
          .setLoadIndicator(CardService.LoadIndicator.SPINNER) // Show spinner for immediate feedback
      );
    
    if (!hasApiKey || isProcessing) {
      analyzeBtn.setDisabled(true);
    }
    
    card.setFixedFooter(
      CardService.newFixedFooter()
        .setPrimaryButton(analyzeBtn)
    );
    
    return card.build();
  }
  
  export function buildApiKeyTab(): GoogleAppsScript.Card_Service.Card {
    const savedKey = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.API_KEY) || '';
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
    
    // Add API key format validation info
    if (!hasApiKey) {
      mainSection.addWidget(
        CardService.newTextParagraph()
          .setText('<b>📋 API Key Format:</b><br/>' +
                   '• Must start with "AIza"<br/>' +
                   '• Exactly 39 characters total<br/>' +
                   '• Contains letters, numbers, hyphens, or underscores<br/>' +
                   '• Example: AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q')
      );
    }
    
    mainSection.addWidget(
      CardService.newTextInput()
        .setFieldName('apiKey')
        .setTitle('Gemini API Key')
        .setHint(hasApiKey ? 'Current key: ...' + savedKey.slice(-8) : 'Format: AIzaSy... (39 chars total)')
        .setValue(savedKey)
    );
    
    // Add validation button
    mainSection.addWidget(
      CardService.newTextButton()
        .setText('🔍 Validate Format')
        .setBackgroundColor(Config.COLORS.PRIMARY)
        .setOnClickAction(
          CardService.newAction().setFunctionName('validateApiKeyFormat')
        )
    );
    
    mainSection.addWidget(
      CardService.newTextButton()
        .setText('💾 Save API Key')
        .setBackgroundColor(Config.COLORS.SUCCESS)
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
    
    const isDebugMode = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.DEBUG_MODE) === 'true';
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
    
    const spreadsheetDisabled = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.SPREADSHEET_LOGGING) === 'false';
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
    
    // T-05: Show last heartbeat for monitoring
    const lastHeartbeat = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.AI_HEARTBEAT);
    if (lastHeartbeat) {
      const heartbeatDate = new Date(lastHeartbeat);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - heartbeatDate.getTime()) / 60000);
      
      mainSection.addWidget(
        CardService.newKeyValue()
          .setTopLabel('Last Heartbeat')
          .setContent(heartbeatDate.toLocaleString())
          .setBottomLabel(diffMinutes === 0 ? 'Just now' : diffMinutes + ' minutes ago')
      );
    }
    
    card.addSection(mainSection);
    
    // Factory Reset section
    const resetSection = CardService.newCardSection()
      .setHeader('🏭 Factory Reset');
    
    resetSection.addWidget(
      CardService.newTextParagraph()
        .setText('Reset the application to initial state. This will delete ALL data including your API key, settings, labels, and logs.')
    );
    
    resetSection.addWidget(
      CardService.newTextButton()
        .setText('Factory Reset...')
        .setBackgroundColor('#dc3545')
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
        .setOnClickAction(
          CardService.newAction().setFunctionName('showFactoryResetConfirmation')
        )
    );
    
    card.addSection(resetSection);
    
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
    
    AppLogger.info('🔧 BUILDING LIVE LOG VIEW', {
      spreadsheetId: config?.todaySpreadsheetId || 'none',
      hasConfig: !!config,
      timestamp: new Date().toISOString()
    });
    
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('🔴 LIVE ANALYSIS')
          .setSubtitle('Real-time Email Processing')
      );
    
    AppLogger.info('✅ Live log view card header created');
    
    // === REAL-TIME STATS SECTION ===
    const statsSection = CardService.newCardSection();
    const isRunning = LockManager.isLocked();
    
    AppLogger.info('📊 BUILDING STATS SECTION', {
      isRunning: isRunning,
      lockManagerState: LockManager.isLocked()
    });
    
    // Get current stats from properties
    const currentStats = getCurrentProcessingStats();
    
    AppLogger.info('📈 CURRENT STATS RETRIEVED', currentStats);
    
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
    
    AppLogger.info('✅ Stats section added to card');
    
    // === LIVE ACTIVITY FEED ===
    const activitySection = CardService.newCardSection();
    
    AppLogger.info('🔄 BUILDING ACTIVITY FEED', {
      isRunning: isRunning,
      executionId: AppLogger.executionId,
      lastExecutionId: PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.LAST_EXECUTION_ID)
    });
    
    // Get filtered, relevant log entries - current execution if running, otherwise last execution
    const relevantLogs = isRunning ? 
      getCurrentExecutionLogs(15) : 
      getLastExecutionLogs(15);
    
    AppLogger.info('📋 LOG ENTRIES RETRIEVED', {
      logCount: relevantLogs.length,
      source: isRunning ? 'current_execution' : 'last_execution'
    });
    
    if (relevantLogs.length > 0) {
      activitySection.addWidget(
        CardService.newTextParagraph()
          .setText('<b>📋 ACTIVITY FEED:</b>')
      );
      
      relevantLogs.forEach((logEntry: UILogEntry) => {
        const timeOnly = logEntry.timestamp.substring(11, 19);
        
        // Use shortMessage if available, otherwise fall back to full message
        let displayMessage = logEntry.shortMessage || logEntry.message;
        let icon = '•';
        let importance = 'normal';
        
        // Simple icon mapping based on message content
        if (logEntry.message.includes('📧 PROCESSING EMAIL')) {
          icon = '📧';
          importance = 'high';
        } else if (logEntry.message.includes('🎯 EMAIL CLASSIFIED')) {
          icon = '🎯';
          importance = 'high';
        } else if (logEntry.message.includes('✍️ DRAFT CREATED')) {
          icon = '✍️';
          importance = 'high';
        } else if (logEntry.message.includes('📤 EMAIL SENT')) {
          icon = '📤';
          importance = 'high';
        } else if (logEntry.message.includes('❌')) {
          icon = '❌';
          importance = 'high';
        } else if (logEntry.message.includes('CLASSIFICATION COMPLETE') || logEntry.message.includes('BATCH COMPLETE')) {
          icon = '🏁';
          importance = 'high';
        } else if (logEntry.message.includes('📤 PROMPT SENT')) {
          // Skip these - too verbose
          return;
        } else if (logEntry.message.includes('📥 RAW RESPONSE')) {
          // Skip these - too verbose
          return;
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
    
    // Add cancel button if processing is running
    if (isRunning) {
      quickActionsSection.addWidget(
        CardService.newTextButton()
          .setText('🛑 Cancel Processing')
          .setBackgroundColor(Config.COLORS.DANGER)
          .setOnClickAction(
            CardService.newAction().setFunctionName('cancelProcessing')
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
    
    AppLogger.info('🎯 LIVE LOG VIEW CONSTRUCTION COMPLETE', {
      sectionsAdded: ['stats', 'activity', 'quickActions'],
      cardBuilt: true,
      timestamp: new Date().toISOString()
    });
    
    return card.build();
  }

  function getCurrentProcessingStats(): {scanned: number, supports: number, drafted: number, sent: number, errors: number} {
    try {
      const scanned = parseInt(PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.CURRENT_SCANNED) || '0');
      const supports = parseInt(PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.CURRENT_SUPPORTS) || '0');
      const drafted = parseInt(PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.CURRENT_DRAFTED) || '0');
      const sent = parseInt(PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.CURRENT_SENT) || '0');
      const errors = parseInt(PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.CURRENT_ERRORS) || '0');
      
      return { scanned, supports, drafted, sent, errors };
    } catch (error) {
      return { scanned: 0, supports: 0, drafted: 0, sent: 0, errors: 0 };
    }
  }

  function getCurrentExecutionLogs(limit: number): Array<{timestamp: string, level: string, message: string, executionId: string}> {
    try {
      // Read from CacheService first - FAST and has more space!
      const cache = CacheService.getUserCache();
      const props = PropertiesService.getUserProperties();
      const currentExecutionId = props.getProperty(Config.PROP_KEYS.CURRENT_EXECUTION_ID) || AppLogger.executionId;
      const logKey = 'LIVE_LOG_' + currentExecutionId;
      
      // Try cache first
      let logsJson = cache.get(logKey);
      
      // Fallback to PropertiesService if cache miss
      if (!logsJson) {
        logsJson = props.getProperty(logKey);
      }
      
      if (!logsJson) {
        return [];
      }
      
      const logs = JSON.parse(logsJson);
      
      // Map to expected format and reverse (newest first)
      const entries = logs.map((log: UILogEntry) => ({
        timestamp: log.timestamp || '',
        executionId: currentExecutionId,
        level: log.level || 'INFO',
        message: log.message || ''
      })).reverse();
      
      return entries.slice(0, limit);
      
    } catch (error) {
      Utils.logAndHandleError(error, 'Current execution logs retrieval');
      return [];
    }
  }

  function getLastExecutionLogs(limit: number): Array<{timestamp: string, level: string, message: string, executionId: string}> {
    try {
      // Find the last execution ID from properties
      const props = PropertiesService.getUserProperties();
      const cache = CacheService.getUserCache();
      const lastExecutionId = props.getProperty(Config.PROP_KEYS.LAST_EXECUTION_ID);
      
      if (!lastExecutionId) {
        return [];
      }
      
      const logKey = 'LIVE_LOG_' + lastExecutionId;
      
      // Try cache first
      let logsJson = cache.get(logKey);
      
      // Fallback to PropertiesService if cache miss
      if (!logsJson) {
        logsJson = props.getProperty(logKey);
      }
      
      if (!logsJson) {
        return [];
      }
      
      const logs = JSON.parse(logsJson);
      
      // Map to expected format and reverse (newest first)
      const entries = logs.map((log: UILogEntry) => ({
        timestamp: log.timestamp || '',
        executionId: lastExecutionId,
        level: log.level || 'INFO',
        message: log.message || ''
      })).reverse();
      
      return entries.slice(0, limit);
      
    } catch (error) {
      Utils.logAndHandleError(error, 'Last execution logs retrieval');
      return [];
    }
  }

}