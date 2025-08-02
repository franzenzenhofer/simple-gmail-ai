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
      console.log('🔧 INITIALIZING SPREADSHEET LOGGING...');
      
      const disabled = PropertiesService.getUserProperties().getProperty('SPREADSHEET_LOGGING') === 'false';
      if (disabled) {
        console.log('⚠️ Spreadsheet logging is DISABLED');
        return;
      }
      
      console.log('📁 Setting up log folder...');
      let folderId = PropertiesService.getUserProperties().getProperty('LOG_FOLDER_ID');
      let folder: GoogleAppsScript.Drive.Folder;
      
      if (!folderId) {
        console.log('📁 Creating new log folder...');
        folder = DriveApp.createFolder('Gmail AI Logs');
        folderId = folder.getId();
        PropertiesService.getUserProperties().setProperty('LOG_FOLDER_ID', folderId);
        console.log('✅ Created log folder:', folderId);
      } else {
        try {
          folder = DriveApp.getFolderById(folderId);
          console.log('✅ Found existing log folder:', folderId);
        } catch (folderError) {
          console.log('❌ Existing folder not found, creating new one...');
          folder = DriveApp.createFolder('Gmail AI Logs');
          folderId = folder.getId();
          PropertiesService.getUserProperties().setProperty('LOG_FOLDER_ID', folderId);
          console.log('✅ Created replacement log folder:', folderId);
        }
      }
      
      const dateString = new Date().toISOString().split('T')[0] || '';
      const todayKey = 'LOG_SPREADSHEET_' + dateString.replace(/-/g, '_');
      let todayId = PropertiesService.getUserProperties().getProperty(todayKey);
      
      console.log('📊 Setting up today\'s spreadsheet for', dateString);
      
      if (!todayId) {
        console.log('📊 Creating new spreadsheet for today...');
        const spreadsheet = SpreadsheetApp.create('Logs ' + dateString);
        todayId = spreadsheet.getId();
        
        console.log('📊 Moving spreadsheet to log folder...');
        DriveApp.getFileById(todayId).moveTo(folder);
        
        console.log('📊 Setting up spreadsheet headers...');
        const sheet = spreadsheet.getActiveSheet();
        sheet.setName('Logs');
        const headers = ['Timestamp', 'Execution ID', 'Level', 'Message', 'Context'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
        
        PropertiesService.getUserProperties().setProperty(todayKey, todayId);
        console.log('✅ Created new spreadsheet:', todayId);
      } else {
        console.log('✅ Found existing spreadsheet for today:', todayId);
      }
      
      spreadsheetConfig = {
        folderId,
        folderUrl: 'https://drive.google.com/drive/folders/' + folderId,
        todaySpreadsheetId: todayId,
        todaySpreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + todayId,
        dateString
      };
      
      console.log('🎯 SPREADSHEET CONFIG ESTABLISHED:', {
        folderId,
        todaySpreadsheetId: todayId,
        dateString
      });
      
    } catch (e) {
      console.error('🚨 CRITICAL: Spreadsheet initialization failed:', String(e));
      // Don't silently fail - this is critical!
      spreadsheetConfig = null;
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
      
      // ALWAYS log to console
      console.log(JSON.stringify(entry));
      
      // ALSO log to CacheService for live view (FAST and LARGER!)
      try {
        const cache = CacheService.getUserCache();
        const logKey = 'LIVE_LOG_' + executionId;
        
        // CacheService has 100KB limit per key (vs 9KB for PropertiesService)
        // and 600 seconds (10 min) default expiration
        const existingLogsJson = cache.get(logKey);
        const logs = existingLogsJson ? JSON.parse(existingLogsJson) : [];
        
        // Add new log entry
        logs.push({
          timestamp: entry.timestamp,
          level: entry.level,
          message: message,
          context: context ? JSON.stringify(entry.context) : ''
        });
        
        // Keep only last 100 entries (more than before since we have more space)
        if (logs.length > 100) {
          logs.splice(0, logs.length - 100);
        }
        
        // Store in cache with 30 minute expiration (1800 seconds)
        cache.put(logKey, JSON.stringify(logs), 1800);
        
        // Also set current execution ID in PropertiesService for persistence
        PropertiesService.getUserProperties().setProperty('CURRENT_EXECUTION_ID', executionId);
        
      } catch (cacheError) {
        console.error('Failed to write to cache:', String(cacheError));
        // Fallback to PropertiesService if cache fails
        try {
          const props = PropertiesService.getUserProperties();
          const logKey = 'LIVE_LOG_' + executionId;
          const existingLogs = props.getProperty(logKey) || '[]';
          const logs = JSON.parse(existingLogs);
          
          logs.push({
            timestamp: entry.timestamp,
            level: entry.level,
            message: message,
            context: context ? JSON.stringify(entry.context) : ''
          });
          
          // Keep only last 30 entries for PropertiesService (less space)
          if (logs.length > 30) {
            logs.splice(0, logs.length - 30);
          }
          
          props.setProperty(logKey, JSON.stringify(logs));
        } catch (fallbackError) {
          console.error('Fallback to properties also failed:', String(fallbackError));
        }
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
          console.error('CRITICAL: Spreadsheet logging failed:', String(spreadsheetError));
          // Try to reinitialize spreadsheet on next call
          spreadsheetConfig = null;
        }
      } else {
        // Force reinitialize if config is missing
        console.warn('Spreadsheet config missing, trying to reinitialize...');
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
            console.error('CRITICAL: Spreadsheet logging failed after reinit:', String(spreadsheetError));
          }
        }
      }
    }
  }
  
  export const debug = (msg: string, ctx?: LogContext) => log(LogLevel.DEBUG, msg, ctx);
  export const info = (msg: string, ctx?: LogContext) => log(LogLevel.INFO, msg, ctx);
  export const warn = (msg: string, ctx?: LogContext) => log(LogLevel.WARN, msg, ctx);
  export const error = (msg: string, ctx?: LogContext) => log(LogLevel.ERROR, msg, ctx);
}