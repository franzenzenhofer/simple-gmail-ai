/**
 * Logger Module
 * Handles console and spreadsheet logging
 */

namespace AppLogger {
  enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
  }
  
  export interface LogContext {
    shortMessage?: string; // Optional short message for UI display
    [key: string]: unknown;
  }
  
  interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context?: unknown;
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
    const debugMode = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.DEBUG_MODE);
    return debugMode === 'true' ? LogLevel.DEBUG : LogLevel.INFO;
  }
  
  export function initSpreadsheet(): void {
    try {
      Logger.log('🔧 INITIALIZING SPREADSHEET LOGGING...');
      
      const disabled = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.SPREADSHEET_LOGGING) === 'false';
      if (disabled) {
        Logger.log('⚠️ Spreadsheet logging is DISABLED');
        return;
      }
      
      Logger.log('📁 Setting up log folder...');
      let folderId = PropertiesService.getUserProperties().getProperty(Config.PROP_KEYS.LOG_FOLDER_ID);
      let folder: GoogleAppsScript.Drive.Folder;
      
      if (!folderId) {
        Logger.log('📁 Creating new log folder...');
        folder = DriveApp.createFolder('Gmail AI Logs');
        folderId = folder.getId();
        PropertiesService.getUserProperties().setProperty(Config.PROP_KEYS.LOG_FOLDER_ID, folderId);
        Logger.log('✅ Created log folder:', folderId);
      } else {
        try {
          folder = DriveApp.getFolderById(folderId);
          Logger.log('✅ Found existing log folder:', folderId);
        } catch (folderError) {
          Logger.log('❌ Existing folder not found, creating new one...');
          folder = DriveApp.createFolder('Gmail AI Logs');
          folderId = folder.getId();
          PropertiesService.getUserProperties().setProperty(Config.PROP_KEYS.LOG_FOLDER_ID, folderId);
          Logger.log('✅ Created replacement log folder:', folderId);
        }
      }
      
      const dateString = new Date().toISOString().split('T')[0] || '';
      const todayKey = 'LOG_SPREADSHEET_' + dateString.replace(/-/g, '_');
      let todayId = PropertiesService.getUserProperties().getProperty(todayKey);
      
      Logger.log('📊 Setting up today\'s spreadsheet for', dateString);
      
      if (!todayId) {
        Logger.log('📊 Creating new spreadsheet for today...');
        const spreadsheet = SpreadsheetApp.create('Logs ' + dateString);
        todayId = spreadsheet.getId();
        
        Logger.log('📊 Moving spreadsheet to log folder...');
        DriveApp.getFileById(todayId).moveTo(folder);
        
        Logger.log('📊 Setting up spreadsheet headers...');
        const sheet = spreadsheet.getActiveSheet();
        sheet.setName('Logs');
        const headers = ['Timestamp', 'Execution ID', 'Level', 'Message', 'Context'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
        
        PropertiesService.getUserProperties().setProperty(todayKey, todayId);
        Logger.log('✅ Created new spreadsheet:', todayId);
      } else {
        Logger.log('✅ Found existing spreadsheet for today:', todayId);
      }
      
      spreadsheetConfig = {
        folderId,
        folderUrl: 'https://drive.google.com/drive/folders/' + folderId,
        todaySpreadsheetId: todayId,
        todaySpreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + todayId,
        dateString
      };
      
      Logger.log('🎯 SPREADSHEET CONFIG ESTABLISHED:', {
        folderId,
        todaySpreadsheetId: todayId,
        dateString
      });
      
    } catch (e) {
      Logger.log('🚨 CRITICAL: Spreadsheet initialization failed:', String(e));
      // Don't silently fail - this is critical!
      spreadsheetConfig = null;
    }
  }
  
  export function getSpreadsheetConfig() {
    return spreadsheetConfig;
  }
  
  function maskSensitive(data: unknown): unknown {
    if (typeof data === 'string') {
      // Inline API key masking to avoid circular dependency
      let text = data;
      
      // Gemini API keys: AIza followed by 35 chars
      text = text.replace(/AIza[0-9A-Za-z\-_]{35}/g, (match) => {
        return match.substring(0, 8) + '...' + match.substring(match.length - 4);
      });
      
      // OpenAI API keys: sk- followed by alphanumeric
      text = text.replace(/sk-[a-zA-Z0-9]{48,}/g, (match) => {
        return 'sk-....' + match.substring(match.length - 4);
      });
      
      // Anthropic API keys: sk-ant- followed by alphanumeric
      text = text.replace(/sk-ant-[a-zA-Z0-9]{40,}/g, (match) => {
        return 'sk-ant-....' + match.substring(match.length - 4);
      });
      
      // Generic API key patterns
      text = text.replace(/([aA][pP][iI][-_]?[kK][eE][yY]\s*[=:]\s*)([a-zA-Z0-9\-_]{20,})/g, (_match, prefix, key) => {
        return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4);
      });
      
      // URL parameter API keys
      text = text.replace(/([?&]key=)([a-zA-Z0-9\-_]{20,})(&|$)/g, (_match, prefix, key, suffix) => {
        return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4) + suffix;
      });
      
      // Bearer tokens
      text = text.replace(/(Bearer\s+)([a-zA-Z0-9\-_.]{30,})/g, (_match, prefix, token) => {
        return prefix + token.substring(0, 4) + '...' + token.substring(token.length - 4);
      });
      
      return text;
    }
    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(item => maskSensitive(item));
      } else {
        const masked: Record<string, unknown> = {};
        const dataObj = data as Record<string, unknown>;
        for (const key in dataObj) {
          const lowerKey = key.toLowerCase();
          // Expand sensitive field detection
          if (lowerKey.includes('key') || 
              lowerKey.includes('token') || 
              lowerKey.includes('secret') || 
              lowerKey.includes('password') || 
              lowerKey.includes('auth') ||
              lowerKey.includes('credential') ||
              lowerKey.includes('api_key') ||
              lowerKey.includes('apikey')) {
            masked[key] = '***MASKED***';
          } else {
            masked[key] = maskSensitive(dataObj[key]);
          }
        }
        return masked;
      }
    }
    return data;
  }
  
  function log(level: LogLevel, message: string, context?: LogContext): void {
    if (level >= getLogLevel()) {
      const entry = {
        timestamp: new Date().toISOString(),
        executionId,
        level: LogLevel[level],
        message: maskSensitive(message),
        context: context ? maskSensitive(context) : undefined
      };
      
      // ALWAYS log to console
      Logger.log(JSON.stringify(entry));
      
      // ALSO log to CacheService for live view (FAST and LARGER!)
      // === SIMPLE WRITE-BOTH STRATEGY ===
      // Write to both CacheService AND PropertiesService for maximum reliability
      // Eliminates complex state tracking and fragile fallback logic
      
      const logEntry = {
        timestamp: entry.timestamp,
        level: entry.level,
        message: message,
        shortMessage: context?.shortMessage || '',
        context: context ? JSON.stringify(entry.context) : ''
      };
      
      const logKey = 'LIVE_LOG_' + executionId;
      const props = PropertiesService.getUserProperties();
      
      // Always set current execution ID for persistence
      props.setProperty(Config.PROP_KEYS.CURRENT_EXECUTION_ID, executionId);
      
      // Write to CacheService (fast access for UI)
      try {
        const cache = CacheService.getUserCache();
        const existingCacheLogs = cache.get(logKey) || '[]';
        const cacheLogs = JSON.parse(existingCacheLogs);
        
        cacheLogs.push(logEntry);
        
        // Keep last 100 entries in cache (more space available)
        if (cacheLogs.length > 100) {
          cacheLogs.splice(0, cacheLogs.length - 100);
        }
        
        cache.put(logKey, JSON.stringify(cacheLogs), 1800); // 30 min expiration
      } catch (cacheError) {
        Logger.log('Cache write failed (non-critical):', String(cacheError));
      }
      
      // Write to PropertiesService (persistent backup)
      try {
        const existingPropLogs = props.getProperty(logKey) || '[]';
        const propLogs = JSON.parse(existingPropLogs);
        
        propLogs.push(logEntry);
        
        // Keep last 30 entries in properties (space-constrained)
        if (propLogs.length > 30) {
          propLogs.splice(0, propLogs.length - 30);
        }
        
        props.setProperty(logKey, JSON.stringify(propLogs));
      } catch (propError) {
        Logger.log('Properties write failed (critical):', String(propError));
      }
      
      // CRITICAL: Spreadsheet logging MUST work for persistent storage
      if (spreadsheetConfig && spreadsheetConfig.todaySpreadsheetId) {
        try {
          const sheet = SpreadsheetApp.openById(spreadsheetConfig.todaySpreadsheetId).getActiveSheet();
          sheet.appendRow([
            entry.timestamp,
            entry.executionId,
            entry.level,
            message,
            context ? JSON.stringify(entry.context) : ''
          ]);
        } catch (spreadsheetError) {
          Logger.log('CRITICAL: Spreadsheet logging failed:', String(spreadsheetError));
          // Try to reinitialize spreadsheet on next call
          spreadsheetConfig = null;
        }
      } else {
        // Force reinitialize if config is missing
        Logger.log('Spreadsheet config missing, trying to reinitialize...');
        initSpreadsheet();
        const config = spreadsheetConfig; // Capture after init
        if (config && config.todaySpreadsheetId) {
          try {
            const sheet = SpreadsheetApp.openById(config.todaySpreadsheetId).getActiveSheet();
            sheet.appendRow([
              entry.timestamp,
              entry.executionId,
              entry.level,
              message,
              context ? JSON.stringify(entry.context) : ''
            ]);
          } catch (spreadsheetError) {
            Logger.log('CRITICAL: Spreadsheet logging failed after reinit:', String(spreadsheetError));
          }
        }
      }
    }
  }
  
  export const debug = (msg: string, ctx?: LogContext) => log(LogLevel.DEBUG, msg, ctx);
  export const info = (msg: string, ctx?: LogContext) => log(LogLevel.INFO, msg, ctx);
  export const warn = (msg: string, ctx?: LogContext) => log(LogLevel.WARN, msg, ctx);
  export const error = (msg: string, ctx?: LogContext) => log(LogLevel.ERROR, msg, ctx);
  
  // In-memory log cache for display
  let logCache: string[] = [];
  
  export function getLogsForDisplay(): string {
    return logCache.join('\n') || 'No logs available';
  }
  
  /**
   * Get recent logs with metadata
   */
  export function getRecentLogs(limit: number = 50): Array<{timestamp: number; level: string; message: string; context?: string}> {
    // === SIMPLE READ-BOTH STRATEGY ===
    // Try cache first (fast), then properties (persistent backup)
    // No complex state tracking needed
    
    const logKey = 'LIVE_LOG_' + executionId;
    
    // Try CacheService first (faster, more recent data)
    try {
      const cache = CacheService.getUserCache();
      const cachedLogs = cache.get(logKey);
      
      if (cachedLogs) {
        const logs = JSON.parse(cachedLogs);
        return logs.slice(-limit).map((entry: LogEntry) => ({
          timestamp: new Date(entry.timestamp).getTime(),
          level: entry.level.toLowerCase(),
          message: entry.message,
          context: entry.context ? JSON.stringify(entry.context) : undefined
        }));
      }
    } catch (cacheError) {
      Logger.log('Cache read failed, trying properties: ' + String(cacheError));
    }
    
    // Try PropertiesService (persistent backup)
    try {
      const props = PropertiesService.getUserProperties();
      const propLogs = props.getProperty(logKey);
      
      if (propLogs) {
        const logs = JSON.parse(propLogs);
        return logs.slice(-limit).map((entry: LogEntry) => ({
          timestamp: new Date(entry.timestamp).getTime(),
          level: entry.level.toLowerCase(),
          message: entry.message,
          context: entry.context ? JSON.stringify(entry.context) : undefined
        }));
      }
    } catch (propError) {
      Logger.log('Properties read also failed: ' + String(propError));
    }
    
    // Return empty array if both storage methods failed
    return [];
  }
  
  /**
   * Clear all logs
   */
  export function clearLogs(): void {
    logCache = [];
    
    try {
      const cache = CacheService.getUserCache();
      const logKey = 'LIVE_LOG_' + executionId;
      cache.remove(logKey);
    } catch (e) {
      // Ignore
    }
    
    try {
      const props = PropertiesService.getUserProperties();
      const logKey = 'LIVE_LOG_' + executionId;
      props.deleteProperty(logKey);
    } catch (e) {
      // Ignore
    }
    
    info('📋 Logs cleared', {});
  }
}