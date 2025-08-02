/**
 * Gmail Support Triage & Auto-Reply Add-on
 * Clean, modular architecture with excellent UX
 */

// ===== CONFIGURATION =====
namespace Config {
  export const LABELS = {
    SUPPORT: 'support',
    NOT_SUPPORT: 'undefined',
    AI_PROCESSED: 'ai✓',
    AI_ERROR: 'ai✗'
  };
  
  export const VERSION = '__VERSION__';
  export const DEPLOY_TIME = '__DEPLOY_TIME__';
  
  export const PROMPTS = {
    CLASSIFICATION: [
      'You are an email triage assistant.',
      'Return exactly one word:',
      '  - support : if the email is a customer support request',
      '  - undefined : for anything else (not support).',
      '---------- EMAIL START ----------'
    ].join('\n'),
    
    RESPONSE: [
      'You are a customer support agent.',
      'Draft a friendly, concise reply that resolves the customer issue.',
      '---------- ORIGINAL EMAIL ----------'
    ].join('\n')
  };
  
  export const GEMINI = {
    MODEL: 'gemini-2.5-flash',
    TEMPERATURE: 0.3,
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/'
  };
}

// ===== TYPES =====
namespace Types {
  export interface FormInputs {
    [key: string]: {
      stringValues?: string[];
    };
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
  
  export interface ProcessingStats {
    scanned: number;
    supports: number;
    drafted: number;
    sent: number;
    errors: number;
  }
}

// ===== LOGGER =====
namespace Logger {
  enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
  }
  
  interface LogContext {
    [key: string]: any;
  }
  
  interface SpreadsheetConfig {
    folderId: string;
    folderUrl: string;
    todaySpreadsheetId: string;
    todaySpreadsheetUrl: string;
    dateString: string;
  }
  
  export const executionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  let spreadsheetConfig: SpreadsheetConfig | null = null;
  
  function getLogLevel(): LogLevel {
    const debugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE');
    return debugMode === 'true' ? LogLevel.DEBUG : LogLevel.INFO;
  }
  
  export function initSpreadsheet(): void {
    try {
      const disabled = PropertiesService.getUserProperties().getProperty('SPREADSHEET_LOGGING') === 'false';
      if (disabled) return;
      
      let folderId = PropertiesService.getUserProperties().getProperty('LOG_FOLDER_ID');
      let folder: GoogleAppsScript.Drive.Folder;
      
      if (!folderId) {
        folder = DriveApp.createFolder('Gmail AI Logs');
        folderId = folder.getId();
        PropertiesService.getUserProperties().setProperty('LOG_FOLDER_ID', folderId);
      } else {
        try {
          folder = DriveApp.getFolderById(folderId);
        } catch {
          folder = DriveApp.createFolder('Gmail AI Logs');
          folderId = folder.getId();
          PropertiesService.getUserProperties().setProperty('LOG_FOLDER_ID', folderId);
        }
      }
      
      const dateString = new Date().toISOString().split('T')[0];
      const todayKey = 'LOG_SPREADSHEET_' + dateString.replace(/-/g, '_');
      let todayId = PropertiesService.getUserProperties().getProperty(todayKey);
      
      if (!todayId) {
        const spreadsheet = SpreadsheetApp.create('Logs ' + dateString);
        todayId = spreadsheet.getId();
        
        DriveApp.getFileById(todayId).moveTo(folder);
        
        const sheet = spreadsheet.getActiveSheet();
        sheet.setName('Logs');
        const headers = ['Timestamp', 'Execution ID', 'Level', 'Message', 'Context'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
        
        PropertiesService.getUserProperties().setProperty(todayKey, todayId);
      }
      
      spreadsheetConfig = {
        folderId,
        folderUrl: 'https://drive.google.com/drive/folders/' + folderId,
        todaySpreadsheetId: todayId,
        todaySpreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + todayId,
        dateString
      };
    } catch (e) {
      console.error('Failed to init spreadsheet logging:', e);
    }
  }
  
  export function getSpreadsheetConfig() {
    return spreadsheetConfig;
  }
  
  function maskSensitive(data: any): any {
    if (typeof data === 'string') {
      return data.replace(/AIza[0-9A-Za-z\-_]{35}/g, 'AIza***MASKED***');
    }
    if (typeof data === 'object' && data !== null) {
      const masked: any = Array.isArray(data) ? [] : {};
      for (const key in data) {
        if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
          masked[key] = '***MASKED***';
        } else {
          masked[key] = maskSensitive(data[key]);
        }
      }
      return masked;
    }
    return data;
  }
  
  function log(level: LogLevel, message: string, context?: LogContext): void {
    if (level >= getLogLevel()) {
      const entry = {
        timestamp: new Date().toISOString(),
        executionId,
        level: LogLevel[level],
        message,
        context: context ? maskSensitive(context) : undefined
      };
      console.log(JSON.stringify(entry));
      
      if (spreadsheetConfig) {
        try {
          const sheet = SpreadsheetApp.openById(spreadsheetConfig.todaySpreadsheetId).getActiveSheet();
          sheet.appendRow([
            entry.timestamp,
            entry.executionId,
            entry.level,
            message,
            context ? JSON.stringify(entry.context) : ''
          ]);
        } catch {}
      }
    }
  }
  
  export const debug = (msg: string, ctx?: LogContext) => log(LogLevel.DEBUG, msg, ctx);
  export const info = (msg: string, ctx?: LogContext) => log(LogLevel.INFO, msg, ctx);
  export const warn = (msg: string, ctx?: LogContext) => log(LogLevel.WARN, msg, ctx);
  export const error = (msg: string, ctx?: LogContext) => log(LogLevel.ERROR, msg, ctx);
}

// ===== AI SERVICE =====
namespace AI {
  export function callGemini(apiKey: string, prompt: string): string {
    const requestId = 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    Logger.info('🚀 AI REQUEST [' + requestId + ']', {
      model: Config.GEMINI.MODEL,
      promptLength: prompt.length,
      promptPreview: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
      requestId
    });
    
    const url = Config.GEMINI.API_URL + Config.GEMINI.MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);
    
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: Config.GEMINI.TEMPERATURE
      }
    };
    
    try {
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      Logger.info('📨 AI RESPONSE [' + requestId + ']', {
        statusCode: responseCode,
        responseLength: responseText.length,
        requestId
      });
      
      if (responseCode !== 200) {
        Logger.error('❌ AI ERROR [' + requestId + ']', {
          statusCode: responseCode,
          error: responseText,
          requestId
        });
        throw new Error('API error: ' + responseCode);
      }
      
      const data = JSON.parse(responseText) as Types.GeminiResponse;
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from AI');
      }
      
      const result = data.candidates[0].content.parts[0].text.trim();
      
      Logger.info('✅ AI RESULT [' + requestId + ']', {
        result,
        requestId,
        classification: result.toLowerCase().indexOf('support') === 0 ? 'SUPPORT' : 'NOT_SUPPORT'
      });
      
      return result;
    } catch (error) {
      Logger.error('Failed to call AI', { error, requestId });
      throw error;
    }
  }
}

// ===== GMAIL SERVICE =====
namespace Gmail {
  export function getOrCreateLabel(name: string): GoogleAppsScript.Gmail.GmailLabel {
    let label = GmailApp.getUserLabelByName(name);
    if (!label) {
      label = GmailApp.createLabel(name);
    }
    return label;
  }
  
  export function getUnprocessedThreads(): GoogleAppsScript.Gmail.GmailThread[] {
    const recent = GmailApp.search('in:inbox -label:' + Config.LABELS.AI_PROCESSED, 0, 50);
    const unread = GmailApp.search('in:inbox is:unread -label:' + Config.LABELS.AI_PROCESSED);
    
    const threadIds = new Set<string>();
    const threads: GoogleAppsScript.Gmail.GmailThread[] = [];
    
    [...recent, ...unread].forEach(thread => {
      const id = thread.getId();
      if (!threadIds.has(id)) {
        threadIds.add(id);
        threads.push(thread);
      }
    });
    
    return threads;
  }
  
  export function processThread(
    thread: GoogleAppsScript.Gmail.GmailThread,
    apiKey: string,
    mode: string,
    autoReply: boolean,
    classificationPrompt: string,
    responsePrompt: string
  ): { isSupport: boolean; error?: string } {
    try {
      const messages = thread.getMessages();
      if (messages.length === 0) return { isSupport: false };
      
      const msg = messages[messages.length - 1];
      const body = msg.getPlainBody().trim();
      if (!body) return { isSupport: false };
      
      const fullPrompt = classificationPrompt + '\n' + body + '\n---------- EMAIL END ----------';
      const classification = AI.callGemini(apiKey, fullPrompt).toLowerCase();
      
      const isSupport = classification.indexOf('support') === 0;
      
      const supportLabel = getOrCreateLabel(Config.LABELS.SUPPORT);
      const notSupportLabel = getOrCreateLabel(Config.LABELS.NOT_SUPPORT);
      const processedLabel = getOrCreateLabel(Config.LABELS.AI_PROCESSED);
      
      if (isSupport) {
        thread.addLabel(supportLabel);
        thread.removeLabel(notSupportLabel);
        
        if (mode === 'draft' || autoReply) {
          const replyPrompt = responsePrompt + '\n' + body + '\n---------- END ----------';
          const replyBody = AI.callGemini(apiKey, replyPrompt);
          
          if (replyBody) {
            if (autoReply) {
              thread.reply(replyBody, { htmlBody: replyBody });
            } else {
              thread.createDraftReply(replyBody, { htmlBody: replyBody });
            }
          }
        }
      } else {
        thread.addLabel(notSupportLabel);
        thread.removeLabel(supportLabel);
      }
      
      thread.addLabel(processedLabel);
      return { isSupport };
      
    } catch (error) {
      const errorLabel = getOrCreateLabel(Config.LABELS.AI_ERROR);
      thread.addLabel(errorLabel);
      return { isSupport: false, error: error.toString() };
    }
  }
}

// ===== UI BUILDER =====
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
          .setText('⚠️ API Key Required')
          .setBottomLabel('Configure your Gemini API key to get started')
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
    
    // Action Buttons
    const actionSection = CardService.newCardSection();
    
    const analyzeBtn = CardService.newTextButton()
      .setText('🚀 Analyze Inbox')
      .setBackgroundColor('#1a73e8')
      .setOnClickAction(
        CardService.newAction().setFunctionName('runAnalysis')
      );
    
    if (!hasApiKey) {
      analyzeBtn.setDisabled(true);
    }
    
    actionSection.addWidget(analyzeBtn);
    card.addSection(actionSection);
    
    // Footer Navigation
    const footerSection = CardService.newCardSection();
    footerSection.addWidget(
      CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText('🔑 API Key')
            .setOnClickAction(
              CardService.newAction().setFunctionName('showApiKeyTab')
            )
        )
        .addButton(
          CardService.newTextButton()
            .setText('📊 Logs')
            .setOnClickAction(
              CardService.newAction().setFunctionName('showLogsTab')
            )
        )
        .addButton(
          CardService.newTextButton()
            .setText('⚙️ Settings')
            .setOnClickAction(
              CardService.newAction().setFunctionName('showSettingsTab')
            )
        )
    );
    card.addSection(footerSection);
    
    return card.build();
  }
  
  export function buildApiKeyTab(): GoogleAppsScript.Card_Service.Card {
    const savedKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
    const hasApiKey = savedKey.trim() !== '';
    
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('🔑 API Key Configuration')
      );
    
    const mainSection = CardService.newCardSection();
    
    if (hasApiKey) {
      mainSection.addWidget(
        CardService.newKeyValue()
          .setTopLabel('Status')
          .setContent('✅ API Key Configured')
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
        .setText('💾 Save API Key')
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
        .setText('← Back to Main')
        .setOnClickAction(
          CardService.newAction().setFunctionName('backToMain')
        )
    );
    card.addSection(footerSection);
    
    return card.build();
  }
  
  export function buildLogsTab(): GoogleAppsScript.Card_Service.Card {
    Logger.initSpreadsheet();
    const config = Logger.getSpreadsheetConfig();
    
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('📊 Logs & Diagnostics')
      );
    
    const mainSection = CardService.newCardSection();
    
    if (config) {
      mainSection.addWidget(
        CardService.newDecoratedText()
          .setText('📄 Today\'s Log')
          .setBottomLabel(config.dateString)
          .setOnClickAction(
            CardService.newAction()
              .setOpenLink(
                CardService.newOpenLink()
                  .setUrl(config.todaySpreadsheetUrl)
                  .setOpenAs(CardService.OpenAs.FULL_SIZE)
              )
          )
      );
      
      mainSection.addWidget(
        CardService.newDecoratedText()
          .setText('📁 All Logs')
          .setBottomLabel('View all daily logs')
          .setOnClickAction(
            CardService.newAction()
              .setOpenLink(
                CardService.newOpenLink()
                  .setUrl(config.folderUrl)
                  .setOpenAs(CardService.OpenAs.FULL_SIZE)
              )
          )
      );
    }
    
    mainSection.addWidget(
      CardService.newKeyValue()
        .setTopLabel('Current Session')
        .setContent(Logger.executionId)
    );
    
    card.addSection(mainSection);
    
    // Back button
    const footerSection = CardService.newCardSection();
    footerSection.addWidget(
      CardService.newTextButton()
        .setText('← Back to Main')
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
          .setTitle('⚙️ Settings')
      );
    
    const mainSection = CardService.newCardSection();
    
    const isDebugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE') === 'true';
    mainSection.addWidget(
      CardService.newDecoratedText()
        .setText(isDebugMode ? '🐛 Debug Mode: ON' : '📊 Debug Mode: OFF')
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
        .setText(spreadsheetDisabled ? '📊 Spreadsheet Logs: OFF' : '📊 Spreadsheet Logs: ON')
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
        .setText('← Back to Main')
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
}

// ===== MAIN ENTRY POINTS =====
function onHomepage(): GoogleAppsScript.Card_Service.Card {
  Logger.initSpreadsheet();
  Logger.info('Gmail Add-on started', {
    version: Config.VERSION,
    executionId: Logger.executionId
  });
  
  return UI.buildHomepage();
}

// Navigation functions
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

// Action handlers
function saveApiKey(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const apiKey = getFormValue(e, 'apiKey');
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Please enter an API key');
    }
    
    PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', apiKey);
    Logger.info('API key saved successfully');
    
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText('✅ API key saved successfully')
      )
      .setNavigation(CardService.newNavigation().updateCard(UI.buildApiKeyTab()))
      .build();
      
  } catch (err) {
    Logger.error('Error saving API key', { error: err });
    return UI.showNotification('❌ ' + err.message);
  }
}

function runAnalysis(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Please configure your API key first');
    }
    
    const mode = getFormValue(e, 'mode', 'label');
    const autoReply = getFormValue(e, 'autoReply') === 'send';
    const prompt1 = getFormValue(e, 'prompt1', Config.PROMPTS.CLASSIFICATION);
    const prompt2 = getFormValue(e, 'prompt2', Config.PROMPTS.RESPONSE);
    
    // Save prompts
    PropertiesService.getUserProperties().setProperty('PROMPT_1', prompt1);
    PropertiesService.getUserProperties().setProperty('PROMPT_2', prompt2);
    
    const threads = Gmail.getUnprocessedThreads();
    const stats: Types.ProcessingStats = {
      scanned: 0,
      supports: 0,
      drafted: 0,
      sent: 0,
      errors: 0
    };
    
    Logger.info('Starting analysis', {
      threadCount: threads.length,
      mode,
      autoReply
    });
    
    threads.forEach((thread, index) => {
      stats.scanned++;
      
      const result = Gmail.processThread(
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
    
    Logger.info('Analysis completed', { stats });
    
    const message = `✅ Analyzed ${stats.scanned} | Support: ${stats.supports} | Drafts: ${stats.drafted} | Sent: ${stats.sent}${stats.errors > 0 ? ' | Errors: ' + stats.errors : ''}`;
    
    return UI.showNotification(message);
    
  } catch (err) {
    Logger.error('Error in analysis', { error: err });
    return UI.showNotification('❌ ' + err.message);
  }
}

function toggleDebugMode(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const currentDebugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE') === 'true';
  const newDebugMode = !currentDebugMode;
  
  PropertiesService.getUserProperties().setProperty('DEBUG_MODE', newDebugMode.toString());
  Logger.info('Debug mode toggled', { newValue: newDebugMode });
  
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
    Logger.initSpreadsheet();
  }
  
  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification()
        .setText(newDisabled ? '📊 Spreadsheet logging disabled' : '📊 Spreadsheet logging enabled')
    )
    .setNavigation(CardService.newNavigation().updateCard(UI.buildSettingsTab()))
    .build();
}

// Universal actions
function viewLogsUniversal(): GoogleAppsScript.Card_Service.UniversalActionResponse {
  return CardService.newUniversalActionResponseBuilder()
    .displayAddOnCards([UI.buildLogsTab()])
    .build();
}

// Helper function
function getFormValue(e: any, field: string, fallback?: string): string {
  const formInput = e.formInput || {};
  const formInputs = (e.formInputs || {}) as Types.FormInputs;
  
  let value = formInput[field] || 
              (formInputs[field] && formInputs[field].stringValues && formInputs[field].stringValues[0]);
  
  if (!value && formInputs[field]) {
    if (Array.isArray(formInputs[field]) && formInputs[field].length > 0) {
      value = formInputs[field][0];
    }
  }
  
  return value || fallback || '';
}