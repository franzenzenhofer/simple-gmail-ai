/**
 * Logger Module
 * Handles all logging functionality including console and spreadsheet logging
 */

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

interface SpreadsheetLogConfig {
  folderId: string;
  folderUrl: string;
  todaySpreadsheetId: string;
  todaySpreadsheetUrl: string;
  dateString: string;
}

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
        } catch (e) {
          folder = DriveApp.createFolder('Gmail AI Logs');
          folderId = folder.getId();
          PropertiesService.getUserProperties().setProperty('LOG_FOLDER_ID', folderId);
        }
      }
      
      const today = new Date();
      const dateString = today.toISOString().split('T')[0];
      
      const todaySpreadsheetIdKey = 'LOG_SPREADSHEET_' + dateString.replace(/-/g, '_');
      let todaySpreadsheetId = PropertiesService.getUserProperties().getProperty(todaySpreadsheetIdKey);
      let spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
      
      if (!todaySpreadsheetId) {
        const spreadsheetName = 'Logs ' + dateString;
        spreadsheet = SpreadsheetApp.create(spreadsheetName);
        todaySpreadsheetId = spreadsheet.getId();
        
        const file = DriveApp.getFileById(todaySpreadsheetId);
        file.moveTo(folder);
        
        const sheet = spreadsheet.getActiveSheet();
        sheet.setName('Logs');
        const headers = ['Timestamp', 'Execution ID', 'Level', 'Message', 'Context'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
        
        for (let i = 1; i <= headers.length; i++) {
          sheet.autoResizeColumn(i);
        }
        
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
      
      const lastRow = sheet.getLastRow();
      const rowRange = sheet.getRange(lastRow, 1, 1, row.length);
      
      switch (level) {
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          rowRange.setBackground('#ffcccc');
          break;
        case LogLevel.WARN:
          rowRange.setBackground('#fff3cd');
          break;
        case LogLevel.DEBUG:
          rowRange.setBackground('#f0f0f0');
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

export { AppLogger, LogLevel, LogContext, SpreadsheetLogConfig };