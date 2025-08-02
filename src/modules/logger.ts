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
      
      const dateString = new Date().toISOString().split('T')[0] || '';
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
      // Silently fail to avoid circular dependency
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
      // Log to console - allowed by Apps Script
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry));
      
      if (spreadsheetConfig) {
        console.log('Writing to spreadsheet:', spreadsheetConfig.todaySpreadsheetId);
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
          // Log spreadsheet errors to console so we can debug them
          console.error('Failed to write to spreadsheet:', String(spreadsheetError));
        }
      }
    }
  }
  
  export const debug = (msg: string, ctx?: LogContext) => log(LogLevel.DEBUG, msg, ctx);
  export const info = (msg: string, ctx?: LogContext) => log(LogLevel.INFO, msg, ctx);
  export const warn = (msg: string, ctx?: LogContext) => log(LogLevel.WARN, msg, ctx);
  export const error = (msg: string, ctx?: LogContext) => log(LogLevel.ERROR, msg, ctx);
}