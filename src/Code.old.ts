/**
 * Gmail Support Triage & Auto-Reply Add-on
 * Uses Gemini 2.5 Flash Developer API
 * Modular TypeScript implementation bundled into single file
 */

// Constants
namespace Config {
  export const LABEL_SUPPORT = 'support';
  export const LABEL_NOT_SUPPORT = 'undefined';
  export const LABEL_AI_PROCESSED = 'ai✓';
  export const LABEL_AI_ERROR = 'ai✗';
  
  export const APP_VERSION = '__VERSION__';
  export const DEPLOY_TIME = '__DEPLOY_TIME__';
  
  export const DEFAULT_PROMPT_1 = [
    'You are an email triage assistant.',
    'Return exactly one word:',
    '  - support : if the email is a customer support request',
    '  - undefined : for anything else (not support).',
    '---------- EMAIL START ----------'
  ].join('\n');
  
  export const DEFAULT_PROMPT_2 = [
    'You are a customer support agent.',
    'Draft a friendly, concise reply that resolves the customer issue.',
    '---------- ORIGINAL EMAIL ----------'
  ].join('\n');
}

// Debug Logger Configuration
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

interface LogContext {
  function?: string;
  threadId?: string;
  threadSubject?: string;
  apiKey?: string;
  mode?: string;
  error?: any;
  duration?: number;
  [key: string]: any;
}

// Spreadsheet Logger Configuration
interface SpreadsheetLogConfig {
  folderId: string;
  folderUrl: string;
  todaySpreadsheetId: string;
  todaySpreadsheetUrl: string;
  dateString: string;
}

// Modular Logger implementation
const AppLogger = {
  executionId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
  performanceTimers: new Map<string, number>(),
  spreadsheetConfig: null as SpreadsheetLogConfig | null,
  
  getLogLevel(): LogLevel {
    try {
      const debugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE');
      if (debugMode === 'true') return LogLevel.DEBUG;
      const level = PropertiesService.getUserProperties().getProperty('LOG_LEVEL');
      return LogLevel[level as keyof typeof LogLevel] || LogLevel.INFO;
    } catch (e) {
      return LogLevel.INFO;
    }
  },
  
  initSpreadsheetLogging(): void {
    try {
      // Always enabled by default unless explicitly disabled
      const disabled = PropertiesService.getUserProperties().getProperty('SPREADSHEET_LOGGING') === 'false';
      if (disabled) return;
      
      // Get or create the logs folder
      let folderId = PropertiesService.getUserProperties().getProperty('LOG_FOLDER_ID');
      let folder: GoogleAppsScript.Drive.Folder;
      
      if (!folderId) {
        // Create the folder
        folder = DriveApp.createFolder('Gmail AI Logs');
        folderId = folder.getId();
        PropertiesService.getUserProperties().setProperty('LOG_FOLDER_ID', folderId);
      } else {
        try {
          folder = DriveApp.getFolderById(folderId);
        } catch (e) {
          // Folder was deleted, create a new one
          folder = DriveApp.createFolder('Gmail AI Logs');
          folderId = folder.getId();
          PropertiesService.getUserProperties().setProperty('LOG_FOLDER_ID', folderId);
        }
      }
      
      // Get today's date string
      const today = new Date();
      const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Check if we already have today's spreadsheet
      const todaySpreadsheetIdKey = 'LOG_SPREADSHEET_' + dateString.replace(/-/g, '_');
      let todaySpreadsheetId = PropertiesService.getUserProperties().getProperty(todaySpreadsheetIdKey);
      let spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
      
      if (!todaySpreadsheetId) {
        // Create today's spreadsheet
        const spreadsheetName = 'Logs ' + dateString;
        spreadsheet = SpreadsheetApp.create(spreadsheetName);
        todaySpreadsheetId = spreadsheet.getId();
        
        // Move to the logs folder
        const file = DriveApp.getFileById(todaySpreadsheetId);
        file.moveTo(folder);
        
        // Set up headers
        const sheet = spreadsheet.getActiveSheet();
        sheet.setName('Logs');
        const headers = ['Timestamp', 'Execution ID', 'Level', 'Message', 'Context'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
        
        // Auto-resize columns
        for (let i = 1; i <= headers.length; i++) {
          sheet.autoResizeColumn(i);
        }
        
        // Save the spreadsheet ID
        PropertiesService.getUserProperties().setProperty(todaySpreadsheetIdKey, todaySpreadsheetId);
      }
      
      AppLogger.spreadsheetConfig = {
        folderId: folderId,
        folderUrl: 'https://drive.google.com/drive/folders/' + folderId,
        todaySpreadsheetId: todaySpreadsheetId,
        todaySpreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + todaySpreadsheetId,
        dateString: dateString
      };
    } catch (e) {
      console.error('Failed to initialize spreadsheet logging:', e);
    }
  },
  
  logToSpreadsheet(level: LogLevel, message: string, context?: LogContext): void {
    if (!AppLogger.spreadsheetConfig) return;
    
    try {
      const spreadsheet = SpreadsheetApp.openById(AppLogger.spreadsheetConfig.todaySpreadsheetId);
      const sheet = spreadsheet.getSheetByName('Logs') || spreadsheet.getActiveSheet();
      
      const row = [
        new Date().toISOString(),
        AppLogger.executionId,
        LogLevel[level],
        message,
        context ? JSON.stringify(AppLogger.maskSensitive(context)) : ''
      ];
      
      sheet.appendRow(row);
      
      // Color-code based on level
      const lastRow = sheet.getLastRow();
      const rowRange = sheet.getRange(lastRow, 1, 1, row.length);
      
      switch (level) {
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          rowRange.setBackground('#ffcccc'); // Light red
          break;
        case LogLevel.WARN:
          rowRange.setBackground('#fff3cd'); // Light yellow
          break;
        case LogLevel.DEBUG:
          rowRange.setBackground('#f0f0f0'); // Light gray
          break;
      }
    } catch (e) {
      // Silently fail to avoid infinite loops
    }
  },
  
  maskSensitive(data: any): any {
    if (typeof data === 'string') {
      return data.replace(/AIza[0-9A-Za-z\-_]{35}/g, 'AIza***MASKED***');
    }
    if (typeof data === 'object' && data !== null) {
      const masked: any = Array.isArray(data) ? [] : {};
      for (const key in data) {
        if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
          masked[key] = '***MASKED***';
        } else {
          masked[key] = AppLogger.maskSensitive(data[key]);
        }
      }
      return masked;
    }
    return data;
  },
  
  log(level: LogLevel, message: string, context?: LogContext): void {
    if (level >= AppLogger.getLogLevel()) {
      const entry = {
        timestamp: new Date().toISOString(),
        executionId: AppLogger.executionId,
        level: LogLevel[level],
        message,
        context: context ? AppLogger.maskSensitive(context) : undefined
      };
      console.log(JSON.stringify(entry));
      if (level >= LogLevel.ERROR) {
        console.error(JSON.stringify(entry));
      }
      
      // Also log to spreadsheet if enabled
      AppLogger.logToSpreadsheet(level, message, context);
    }
  },
  
  debug(msg: string, ctx?: LogContext): void { AppLogger.log(LogLevel.DEBUG, msg, ctx); },
  info(msg: string, ctx?: LogContext): void { AppLogger.log(LogLevel.INFO, msg, ctx); },
  warn(msg: string, ctx?: LogContext): void { AppLogger.log(LogLevel.WARN, msg, ctx); },
  error(msg: string, ctx?: LogContext): void { AppLogger.log(LogLevel.ERROR, msg, ctx); },
  
  startTimer(label: string): void {
    AppLogger.performanceTimers.set(label, Date.now());
    AppLogger.debug(`Timer started: ${label}`);
  },
  
  endTimer(label: string): number {
    const start = AppLogger.performanceTimers.get(label);
    if (!start) return 0;
    const duration = Date.now() - start;
    AppLogger.performanceTimers.delete(label);
    AppLogger.debug(`Timer ended: ${label} (${duration}ms)`);
    return duration;
  },
  
  functionStart(fn: string, params?: any): void {
    AppLogger.debug(`→ ${fn}`, { function: fn, params: AppLogger.maskSensitive(params) });
    AppLogger.startTimer(fn);
  },
  
  functionEnd(fn: string, result?: any): void {
    const duration = AppLogger.endTimer(fn);
    AppLogger.debug(`← ${fn}`, { function: fn, duration, result: result ? 'Success' : 'No result' });
  }
};

// Type definitions moved to Types namespace

// Type definitions
namespace Types {
  export interface FormInputs {
    [key: string]: {
      stringValues?: string[];
    };
  }
  
  export interface EventObject {
    formInputs?: FormInputs;
    commonEventObject?: any;
    parameters?: any;
  }
  
  export interface GeminiResponse {
    candidates?: Array<{
      content: {
        parts: Array<{
          text: string;
        }>;
      };
    }>;
    error?: {
      message: string;
    };
  }
}

// Safety helper functions
function isDevelopmentMode(): boolean {
  try {
    const devMode = PropertiesService.getUserProperties().getProperty('GMAIL_AI_DEV_MODE');
    const safetyMode = PropertiesService.getUserProperties().getProperty('GMAIL_AI_SAFETY_MODE');
    
    // Default to SAFE MODE if not explicitly set to production
    return devMode !== 'false' || safetyMode === 'true';
  } catch (e) {
    // If we can't check, assume we're in dev mode for safety
    return true;
  }
}

function enableProductionMode(confirmation: string): boolean {
  if (confirmation !== 'I UNDERSTAND THIS WILL SEND REAL EMAILS') {
    console.error('Production mode NOT enabled - incorrect confirmation');
    return false;
  }
  
  PropertiesService.getUserProperties().setProperty('GMAIL_AI_DEV_MODE', 'false');
  PropertiesService.getUserProperties().setProperty('GMAIL_AI_SAFETY_MODE', 'false');
  console.warn('⚠️ PRODUCTION MODE ENABLED - EMAILS WILL BE SENT!');
  return true;
}

function enableDevelopmentMode(): void {
  PropertiesService.getUserProperties().setProperty('GMAIL_AI_DEV_MODE', 'true');
  PropertiesService.getUserProperties().setProperty('GMAIL_AI_SAFETY_MODE', 'true');
  console.log('✅ Development mode enabled - emails will NOT be sent');
}

function logBlockedAction(action: string, details: any): void {
  console.log('🛡️ SAFETY MODE - Blocked action:', action);
  console.log('Details:', JSON.stringify(details, null, 2));
}

// Entry point for Gmail add-on
function onHomepage(): GoogleAppsScript.Card_Service.Card {
  AppLogger.functionStart('onHomepage');
  
  // Initialize spreadsheet logging if enabled
  AppLogger.initSpreadsheetLogging();
  
  AppLogger.info('Gmail Add-on started', {
    version: APP_VERSION,
    deployTime: DEPLOY_TIME,
    executionId: AppLogger.executionId
  });
  
  // Always start in dev mode for safety
  const devMode = isDevelopmentMode();
  AppLogger.info('Mode check', { isDevelopmentMode: devMode });
  
  if (devMode) {
    AppLogger.info('✅ Running in DEVELOPMENT MODE - emails will NOT be sent');
  } else {
    AppLogger.warn('⚠️ Running in PRODUCTION MODE - emails WILL be sent!');
  }
  
  const card = buildHomepageCard();
  AppLogger.functionEnd('onHomepage', card);
  return card;
}

// Universal action for viewing logs (accessible from three-dot menu)
function viewLogsUniversal(e: any): GoogleAppsScript.Card_Service.UniversalActionResponse {
  AppLogger.functionStart('viewLogsUniversal');
  
  try {
    const card = buildLogsCard();
    
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([card])
      .build();
  } catch (err) {
    AppLogger.error('Error in viewLogsUniversal', { error: err });
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([buildErrorCard('Failed to load logs')])
      .build();
  }
}

// Universal action for toggling debug mode (accessible from three-dot menu)
function toggleDebugModeUniversal(e: any): GoogleAppsScript.Card_Service.UniversalActionResponse {
  AppLogger.functionStart('toggleDebugModeUniversal');
  
  try {
    const currentDebugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE') === 'true';
    const newDebugMode = !currentDebugMode;
    
    PropertiesService.getUserProperties().setProperty('DEBUG_MODE', newDebugMode.toString());
    AppLogger.info('Debug mode toggled via universal action', { oldValue: currentDebugMode, newValue: newDebugMode });
    
    const message = newDebugMode ? 
      '🐛 Debug mode ENABLED - Verbose logging active' : 
      '📊 Debug mode DISABLED - Normal logging';
    
    // Show the homepage card with a notification
    const updatedCard = buildHomepageCard();
    
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([updatedCard])
      .build();
  } catch (err) {
    AppLogger.error('Error in toggleDebugModeUniversal', { error: err });
    return CardService.newUniversalActionResponseBuilder()
      .displayAddOnCards([buildErrorCard('Failed to toggle debug mode')])
      .build();
  }
}

// Contextual trigger for Gmail messages
function onGmailMessage(e: any): GoogleAppsScript.Card_Service.Card {
  AppLogger.functionStart('onGmailMessage');
  
  try {
    // Build a contextual card with quick actions
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('AI Support Triage')
          .setSubtitle(`v${APP_VERSION}`)
      );
    
    // Quick info section
    const infoSection = CardService.newCardSection()
      .addWidget(
        CardService.newTextParagraph()
          .setText('<b>Quick Actions</b>')
      );
    
    // Add view logs button
    const viewLogsBtn = CardService.newTextButton()
      .setText('📋 View Logs')
      .setOnClickAction(
        CardService.newAction().setFunctionName('viewLogs')
      );
    
    // Add run analysis button
    const runAnalysisBtn = CardService.newTextButton()
      .setText('🤖 Analyze Inbox Now')
      .setOnClickAction(
        CardService.newAction().setFunctionName('runQuickAnalysis')
      );
    
    infoSection.addWidget(
      CardService.newButtonSet()
        .addButton(viewLogsBtn)
        .addButton(runAnalysisBtn)
    );
    
    // Debug info section
    const debugSection = CardService.newCardSection()
      .setHeader('Debug Info');
    
    const isDebugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE') === 'true';
    debugSection.addWidget(
      CardService.newKeyValue()
        .setTopLabel('Debug Mode')
        .setContent(isDebugMode ? '🐛 ON' : '📊 OFF')
    );
    
    debugSection.addWidget(
      CardService.newKeyValue()
        .setTopLabel('Execution ID')
        .setContent(AppLogger.executionId)
    );
    
    card.addSection(infoSection);
    card.addSection(debugSection);
    
    AppLogger.functionEnd('onGmailMessage');
    return card.build();
  } catch (err) {
    AppLogger.error('Error in onGmailMessage', { error: err });
    return buildErrorCard('Failed to load contextual card');
  }
}

// Quick analysis function for contextual trigger
function runQuickAnalysis(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  AppLogger.functionStart('runQuickAnalysis');
  
  try {
    // Get saved API key
    const apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
    
    if (!apiKey) {
      return buildActionResponse('❌ Please configure API key in the main add-on first');
    }
    
    // Run with default settings
    const mockEvent = {
      formInput: {
        apiKey: apiKey,
        mode: 'label',
        prompt1: DEFAULT_PROMPT_1,
        prompt2: DEFAULT_PROMPT_2
      }
    };
    
    return runAnalysis(mockEvent);
  } catch (err) {
    AppLogger.error('Error in runQuickAnalysis', { error: err });
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return buildActionResponse('❌ Analysis failed: ' + errorMessage);
  }
}

// Helper function to build error card
function buildErrorCard(message: string): GoogleAppsScript.Card_Service.Card {
  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Error')
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextParagraph()
            .setText('❌ ' + message)
        )
    )
    .build();
}

// Save API key action
function saveApiKey(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  AppLogger.functionStart('saveApiKey', { hasFormInputs: !!e.formInputs, hasFormInput: !!e.formInput });
  
  try {
    const inputs = (e.formInputs || {}) as FormInputs;
    const formInput = e.formInput || {};
    
    AppLogger.debug('Form inputs received', {
      formInputKeys: Object.keys(formInput),
      formInputsKeys: Object.keys(inputs)
    });
    
    // Try multiple ways to get the API key
    let apiKey = formInput.apiKey || 
                 (inputs.apiKey && inputs.apiKey.stringValues && inputs.apiKey.stringValues[0]) ||
                 getFormValue(inputs, 'apiKey') ||
                 '';
    
    AppLogger.debug('API key extraction', { hasApiKey: !!apiKey, length: apiKey.length });
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Please enter an API key before saving');
    }
    
    // Store API key securely
    PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', apiKey);
    AppLogger.info('API key saved successfully');
    
    const response = CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification()
          .setText('✅ API key saved successfully')
      )
      .setNavigation(CardService.newNavigation().updateCard(buildHomepageCard()))
      .build();
    
    AppLogger.functionEnd('saveApiKey', response);
    return response;
    
  } catch (err) {
    AppLogger.error('Error saving API key', { error: err });
    const errorMessage = err instanceof Error ? err.message : 'Failed to save API key';
    return buildActionResponse('❌ ' + errorMessage);
  }
}

// View logs action
function viewLogs(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  AppLogger.functionStart('viewLogs');
  
  try {
    const card = buildLogsCard();
    AppLogger.functionEnd('viewLogs', card);
    
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(card))
      .build();
  } catch (err) {
    AppLogger.error('Error viewing logs', { error: err });
    return buildActionResponse('❌ Failed to load logs');
  }
}

// Toggle debug mode
function toggleDebugMode(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  AppLogger.functionStart('toggleDebugMode');
  
  try {
    const currentDebugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE') === 'true';
    const newDebugMode = !currentDebugMode;
    
    PropertiesService.getUserProperties().setProperty('DEBUG_MODE', newDebugMode.toString());
    AppLogger.info('Debug mode toggled', { oldValue: currentDebugMode, newValue: newDebugMode });
    
    const message = newDebugMode ? 
      '🐛 Debug mode ENABLED - Verbose logging active' : 
      '📊 Debug mode DISABLED - Normal logging';
    
    AppLogger.functionEnd('toggleDebugMode');
    
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(message))
      .setNavigation(CardService.newNavigation().updateCard(buildHomepageCard()))
      .build();
  } catch (err) {
    AppLogger.error('Error toggling debug mode', { error: err });
    return buildActionResponse('❌ Failed to toggle debug mode');
  }
}

// Back to main action
function backToMain(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildHomepageCard()))
    .build();
}

// Toggle spreadsheet logging
function toggleSpreadsheetLogging(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  AppLogger.functionStart('toggleSpreadsheetLogging');
  
  try {
    // Default is ON, so check if it's currently disabled
    const currentDisabled = PropertiesService.getUserProperties().getProperty('SPREADSHEET_LOGGING') === 'false';
    const newDisabled = !currentDisabled;
    
    PropertiesService.getUserProperties().setProperty('SPREADSHEET_LOGGING', newDisabled ? 'false' : 'true');
    
    if (!newDisabled) {
      // Re-enable spreadsheet logging
      AppLogger.initSpreadsheetLogging();
      
      const message = AppLogger.spreadsheetConfig ? 
        '📊 Spreadsheet logging ENABLED' : 
        '📊 Logs folder created and logging ENABLED';
      
      AppLogger.info('Spreadsheet logging enabled');
      
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText(message))
        .setNavigation(CardService.newNavigation().updateCard(buildLogsCard()))
        .build();
    } else {
      AppLogger.info('Spreadsheet logging disabled');
      
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText('📊 Spreadsheet logging DISABLED'))
        .setNavigation(CardService.newNavigation().updateCard(buildLogsCard()))
        .build();
    }
  } catch (err) {
    AppLogger.error('Error toggling spreadsheet logging', { error: err });
    return buildActionResponse('❌ Failed to toggle spreadsheet logging');
  }
}

// Main analysis function
function runAnalysis(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  AppLogger.functionStart('runAnalysis');
  const analysisStart = Date.now();
  let stats = { scanned: 0, supports: 0, drafted: 0, sent: 0, errors: 0 };
  
  try {
    // Log the entire event object for debugging
    AppLogger.debug('Event object received', {
      hasFormInput: !!e.formInput,
      hasFormInputs: !!e.formInputs,
      formInputKeys: e.formInput ? Object.keys(e.formInput) : [],
      formInputsKeys: e.formInputs ? Object.keys(e.formInputs) : []
    });
    
    // Use both e.formInput and e.formInputs for compatibility
    const formInput = e.formInput || {};
    const formInputs = (e.formInputs || {}) as FormInputs;
    
    // Try multiple ways to get the API key
    let apiKey = formInput.apiKey || 
                 (formInputs.apiKey && formInputs.apiKey.stringValues && formInputs.apiKey.stringValues[0]) ||
                 getFormValue(formInputs, 'apiKey');
    
    // Fallback to saved API key if form input is empty
    if (!apiKey || apiKey.trim() === '') {
      console.log('No API key in form, trying saved properties...');
      apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
    }
    
    // Get other form values using the same approach
    const mode = formInput.mode || getFormValue(formInputs, 'mode', 'label');
    const autoReply = formInput.autoReply === 'send' || 
                      (formInputs.autoReply && formInputs.autoReply.stringValues && formInputs.autoReply.stringValues.length > 0);
    const prompt1 = formInput.prompt1 || getFormValue(formInputs, 'prompt1', DEFAULT_PROMPT_1);
    const prompt2 = formInput.prompt2 || getFormValue(formInputs, 'prompt2', DEFAULT_PROMPT_2);

    if (!apiKey || apiKey.trim() === '') {
      AppLogger.error('API Key validation failed', { 
        formInput: formInput, 
        formInputs: formInputs 
      });
      throw new Error('Missing Gemini API key. Please enter your API key in the form and click Save.');
    }
    
    // Store API key securely
    PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', apiKey);

    // Get or create labels
    AppLogger.debug('Creating/fetching labels');
    const supportLabel = getOrCreateLabel(LABEL_SUPPORT);
    const undefinedLabel = getOrCreateLabel(LABEL_NOT_SUPPORT);
    const processedLabel = getOrCreateLabel(LABEL_AI_PROCESSED);
    const errorLabel = getOrCreateLabel(LABEL_AI_ERROR);

    // Fetch inbox threads - exclude already processed
    AppLogger.info('Fetching inbox threads (excluding already processed)');
    const recent = GmailApp.search('in:inbox -label:' + LABEL_AI_PROCESSED, 0, 50);
    const unread = GmailApp.search('in:inbox is:unread -label:' + LABEL_AI_PROCESSED);
    AppLogger.debug('Threads fetched', { 
      recentCount: recent.length, 
      unreadCount: unread.length,
      query: 'excluding label:' + LABEL_AI_PROCESSED
    });
    
    // Combine and deduplicate threads
    const threadIds = new Set<string>();
    const allThreads = [...recent, ...unread];
    const threads: GoogleAppsScript.Gmail.GmailThread[] = [];
    
    for (const thread of allThreads) {
      const id = thread.getId();
      if (!threadIds.has(id)) {
        threadIds.add(id);
        threads.push(thread);
      }
    }

    // Stats are already initialized at the top of the function

    // Process each thread
    AppLogger.info('Starting thread processing', { threadCount: threads.length });
    
    threads.forEach((thread, index) => {
      // Double-check if already processed (safety check)
      const labels = thread.getLabels();
      const labelNames = labels.map(l => l.getName());
      
      if (labelNames.includes(LABEL_AI_PROCESSED)) {
        AppLogger.warn(`Thread ${index} already processed (should have been filtered), skipping`, {
          threadId: thread.getId(),
          subject: thread.getFirstMessageSubject()
        });
        return;
      }
      
      const messages = thread.getMessages();
      if (messages.length === 0) {
        AppLogger.debug(`Thread ${index} has no messages, skipping`);
        return;
      }
      
      const msg = messages[messages.length - 1]; // Get newest message
      if (!msg) {
        AppLogger.debug(`Thread ${index} has no valid message, skipping`);
        return;
      }
      
      stats.scanned++;
      AppLogger.debug(`Processing thread ${index + 1}/${threads.length}`, {
        threadId: thread.getId(),
        subject: thread.getFirstMessageSubject(),
        messageCount: messages.length,
        existingLabels: labelNames
      });

      const body = msg.getPlainBody().trim();
      if (!body) {
        AppLogger.debug('Empty message body, skipping');
        return;
      }

      try {
        const classificationPrompt = prompt1 + '\n' + body + '\n---------- EMAIL END ----------';
        AppLogger.debug('Calling Gemini for classification', { 
          promptLength: classificationPrompt.length 
        });
        
        const clsRaw = callGemini(apiKey, classificationPrompt);
        const cls = (clsRaw || '').toLowerCase().trim();
        AppLogger.debug('Classification result', { classification: cls });

        if (cls.indexOf('support') === 0) {
          stats.supports++;
          thread.addLabel(supportLabel);
          thread.removeLabel(undefinedLabel);
          thread.addLabel(processedLabel); // Mark as processed
          AppLogger.info('Thread classified as SUPPORT', {
            threadId: thread.getId(),
            subject: thread.getFirstMessageSubject()
          });

          if (mode === 'draft' || autoReply) {
            const replyPrompt = prompt2 + '\n' + body + '\n---------- END ----------';
            const replyBody = callGemini(apiKey, replyPrompt);

            if (replyBody) {
              // SAFETY CHECK: Only send/draft in production mode
              if (isDevelopmentMode()) {
                AppLogger.info('🚫 DEV MODE: Would create reply', {
                  action: autoReply ? 'send' : 'draft',
                  to: thread.getMessages()[0].getFrom(),
                  replyPreview: replyBody.substring(0, 100) + '...'
                });
                if (autoReply) {
                  stats.sent++; // Count it but don't actually send
                } else {
                  stats.drafted++; // Count it but don't actually create draft
                }
              } else {
                // PRODUCTION MODE - Actually send/draft emails
                if (autoReply) {
                  thread.reply(replyBody, { htmlBody: replyBody });
                  stats.sent++;
                  AppLogger.info('Email SENT', {
                    threadId: thread.getId(),
                    subject: thread.getFirstMessageSubject()
                  });
                } else {
                  thread.createDraftReply(replyBody, { htmlBody: replyBody });
                  stats.drafted++;
                  AppLogger.info('Draft created', {
                    threadId: thread.getId(),
                    subject: thread.getFirstMessageSubject()
                  });
                }
              }
            }
          }
        } else {
          thread.addLabel(undefinedLabel);
          thread.removeLabel(supportLabel);
          thread.addLabel(processedLabel); // Mark as processed
          AppLogger.info('Thread classified as NOT SUPPORT', {
            threadId: thread.getId(),
            subject: thread.getFirstMessageSubject()
          });
        }
      } catch (error) {
        stats.errors++;
        thread.addLabel(errorLabel); // Mark as error
        AppLogger.error('Error processing thread', {
          threadId: thread.getId(),
          subject: thread.getFirstMessageSubject(),
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack
          } : error
        });
        // Continue with next thread
      }
    });

    const duration = Date.now() - analysisStart;
    
    AppLogger.info('Analysis completed', {
      duration: duration,
      stats: stats,
      mode: mode,
      autoReply: autoReply
    });
    
    const devModeWarning = isDevelopmentMode() ? ' [🚫 DEV MODE]' : '';
    const toast = 'Scanned ' + stats.scanned +
                  ' | Support ' + stats.supports +
                  ' | Drafts ' + stats.drafted +
                  ' | Sent ' + stats.sent +
                  ' | Errors ' + stats.errors + devModeWarning;
    
    AppLogger.functionEnd('runAnalysis', { success: true, stats });
    return buildActionResponse(toast);

  } catch (err) {
    AppLogger.error('Fatal error in runAnalysis', { error: err });
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    AppLogger.functionEnd('runAnalysis', { success: false, error: errorMessage });
    return buildActionResponse('Error: ' + errorMessage);
  }
}

// UI building functions
function buildHomepageCard(): GoogleAppsScript.Card_Service.Card {
  const savedKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
  const hasApiKey = savedKey && savedKey.trim() !== '';

  const card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Gmail AI Support Triage')
        .setSubtitle('v' + APP_VERSION)
    );

  // API Key section - REQUIRED
  if (!hasApiKey) {
    const apiKeySection = CardService.newCardSection();
    apiKeySection.addWidget(
      CardService.newTextParagraph()
        .setText('⚠️ <b>API Key Required</b>')
    );
    
    apiKeySection.addWidget(
      CardService.newTextInput()
        .setFieldName('apiKey')
        .setTitle('Gemini API Key')
        .setHint('Enter your API key')
    );
    
    apiKeySection.addWidget(
      CardService.newTextButton()
        .setText('Save API Key')
        .setOnClickAction(
          CardService.newAction().setFunctionName('saveApiKey')
        )
    );
    
    card.addSection(apiKeySection);
  }

  // Main Controls
  const mainSection = CardService.newCardSection();
  
  // Mode selection
  mainSection.addWidget(
    CardService.newSelectionInput()
      .setFieldName('mode')
      .setTitle('Processing Mode')
      .setType(CardService.SelectionInputType.RADIO_BUTTON)
      .addItem('Label emails only', 'label', true)
      .addItem('Label + Create drafts', 'draft', false)
  );

  // Auto-reply warning
  mainSection.addWidget(
    CardService.newSelectionInput()
      .setFieldName('autoReply')
      .setType(CardService.SelectionInputType.CHECK_BOX)
      .addItem('⚠️ Auto-send replies (DANGER!)', 'send', false)
  );

  card.addSection(mainSection);

  // Quick Actions
  const actionsSection = CardService.newCardSection()
    .setHeader('Quick Actions');
  
  const buttonsSet = CardService.newButtonSet();
  
  // Analyze button
  buttonsSet.addButton(
    CardService.newTextButton()
      .setText('🚀 Analyze Inbox')
      .setBackgroundColor('#1a73e8')
      .setOnClickAction(
        CardService.newAction().setFunctionName('runAnalysis')
      )
  );
  
  // Settings button
  buttonsSet.addButton(
    CardService.newTextButton()
      .setText('⚙️ Settings')
      .setOnClickAction(
        CardService.newAction().setFunctionName('showSettings')
      )
  );
  
  actionsSection.addWidget(buttonsSet);
  card.addSection(actionsSection);

  // Status section
  if (hasApiKey) {
    const statusSection = CardService.newCardSection();
    statusSection.addWidget(
      CardService.newKeyValue()
        .setTopLabel('Status')
        .setContent('✅ Ready')
        .setBottomLabel('API key configured')
    );
    card.addSection(statusSection);
  }

  return card.build();
}

function buildActionResponse(text: string): GoogleAppsScript.Card_Service.ActionResponse {
  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification().setText(text)
    )
    .build();
}

// Build logs viewer card - SIMPLIFIED VERSION
function buildLogsCard(): GoogleAppsScript.Card_Service.Card {
  AppLogger.functionStart('buildLogsCard');
  
  const card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('📋 Logs & Diagnostics')
    );
  
  // Main log access section with big buttons
  const mainSection = CardService.newCardSection();
  
  // Initialize spreadsheet logging if needed
  if (!AppLogger.spreadsheetConfig) {
    AppLogger.initSpreadsheetLogging();
  }
  
  // Today's Log - Primary Action
  if (AppLogger.spreadsheetConfig?.todaySpreadsheetId) {
    mainSection.addWidget(
      CardService.newDecoratedText()
        .setText('📊 Today\'s Log (' + AppLogger.spreadsheetConfig.dateString + ')')
        .setBottomLabel('Click to open today\'s log spreadsheet')
        .setOnClickAction(
          CardService.newAction()
            .setOpenLink(
              CardService.newOpenLink()
                .setUrl(AppLogger.spreadsheetConfig.todaySpreadsheetUrl)
                .setOpenAs(CardService.OpenAs.FULL_SIZE)
            )
        )
    );
    
    mainSection.addWidget(
      CardService.newDecoratedText()
        .setText('📁 All Logs Folder')
        .setBottomLabel('View all daily log files')
        .setOnClickAction(
          CardService.newAction()
            .setOpenLink(
              CardService.newOpenLink()
                .setUrl(AppLogger.spreadsheetConfig.folderUrl)
                .setOpenAs(CardService.OpenAs.FULL_SIZE)
            )
        )
    );
  }
  
  // Quick Links
  mainSection.addWidget(
    CardService.newDecoratedText()
      .setText('🕐 Execution History')
      .setBottomLabel('View all Gmail add-on executions')
      .setOnClickAction(
        CardService.newAction()
          .setOpenLink(
            CardService.newOpenLink()
              .setUrl('https://script.google.com/home/projects/1rsJQPU1V1CIHbxfz4SZbZu3sYmK8eEcXuGUM_-no1Mtr0rNbu-RHq6Xt/executions')
              .setOpenAs(CardService.OpenAs.FULL_SIZE)
          )
      )
  );
  
  card.addSection(mainSection);
  
  // Settings section
  const settingsSection = CardService.newCardSection()
    .setHeader('Settings');
  
  const isDebugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE') === 'true';
  settingsSection.addWidget(
    CardService.newDecoratedText()
      .setText(isDebugMode ? '🐛 Debug Mode: ON' : '📊 Debug Mode: OFF')
      .setBottomLabel(isDebugMode ? 'Detailed logging enabled' : 'Normal logging only')
      .setSwitchControl(
        CardService.newSwitch()
          .setFieldName('debugMode')
          .setValue(isDebugMode ? 'true' : 'false')
          .setOnChangeAction(
            CardService.newAction().setFunctionName('toggleDebugMode')
          )
      )
  );
  
  card.addSection(settingsSection);
  
  // Back button
  const footerSection = CardService.newCardSection();
  footerSection.addWidget(
    CardService.newTextButton()
      .setText('← Back to Main')
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('backToMain')
      )
  );
  
  card.addSection(footerSection);
  
  AppLogger.functionEnd('buildLogsCard');
  return card.build();
}

// Helper functions
function getOrCreateLabel(name: string): GoogleAppsScript.Gmail.GmailLabel {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}

function getFormValue(formInputs: FormInputs, field: string, fallback?: string): string {
  const obj = formInputs[field];
  if (obj) {
    // Handle array format (most common)
    if (Array.isArray(obj) && obj.length > 0) {
      return obj[0];
    }
    // Handle object with stringValues
    if (obj.stringValues && obj.stringValues.length > 0) {
      return obj.stringValues[0];
    }
    // Handle object with stringInputs (alternative format)
    if ((obj as any).stringInputs && (obj as any).stringInputs.length > 0 && (obj as any).stringInputs[0].value) {
      return (obj as any).stringInputs[0].value;
    }
  }
  return fallback || '';
}

function callGemini(apiKey: string, prompt: string): string {
  AppLogger.functionStart('callGemini', { promptLength: prompt.length });
  
  // Generate unique request ID to link request and response
  const requestId = 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              'gemini-2.5-flash:generateContent?key=' +
              encodeURIComponent(apiKey);

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.3
    }
  };
  
  // Log the full prompt being sent to AI with emojis
  AppLogger.info('🚀 AI REQUEST [' + requestId + ']', {
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
    fullPrompt: prompt, // This will be visible in debug mode
    requestId: requestId,
    emoji: '🤖➡️'
  });

  try {
    const fetchStart = Date.now();
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const fetchDuration = Date.now() - fetchStart;

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    AppLogger.info('📨 AI RESPONSE [' + requestId + ']', {
      statusCode: responseCode,
      duration: fetchDuration,
      responseLength: responseText.length,
      responsePreview: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
      requestId: requestId,
      emoji: '🤖⬅️'
    });
    
    if (responseCode !== 200) {
      AppLogger.error('❌ AI ERROR [' + requestId + ']', {
        statusCode: responseCode,
        errorResponse: responseText,
        requestId: requestId,
        emoji: '🤖💥'
      });
      
      // Try to parse error message
      let errorMessage = 'Gemini API error: ' + responseCode;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error && errorData.error.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {
        // Use generic error if can't parse
      }
      
      // Provide user-friendly error messages
      if (responseCode === 400) {
        throw new Error('Invalid API key or request. Please check your Gemini API key.');
      } else if (responseCode === 403) {
        throw new Error('API key unauthorized. Please verify your Gemini API key has the correct permissions.');
      } else if (responseCode === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else {
        throw new Error(errorMessage);
      }
    }

    const data = JSON.parse(response.getContentText()) as GeminiResponse;
    
    if (!data.candidates || data.candidates.length === 0) {
      const errorMessage = (data.error && data.error.message) || 'Gemini API returned no candidates';
      AppLogger.error('No candidates in response', { error: errorMessage });
      throw new Error(errorMessage);
    }

    const text = data.candidates[0].content.parts[0].text || '';
    const trimmedText = text.trim();
    
    AppLogger.info('✅ AI RESULT [' + requestId + ']', {
      rawResponse: text,
      trimmedResponse: trimmedText,
      responseLength: trimmedText.length,
      requestId: requestId,
      emoji: trimmedText.indexOf('support') === 0 ? '📧✅' : '📧❌'
    });
    
    AppLogger.functionEnd('callGemini', trimmedText);
    return trimmedText;
    
  } catch (error) {
    AppLogger.error('Error calling Gemini API', { error: error });
    throw error;
  }
}