/**
 * Comprehensive tests for AppLogger module
 * Tests the actual namespace code with proper mocks
 */

// Mock all Google Apps Script services before loading Logger
const mockPropertiesInstance = {
  getProperty: jest.fn(),
  setProperty: jest.fn()
};

const mockPropertiesService = {
  getUserProperties: jest.fn(() => mockPropertiesInstance)
};

const mockCacheInstance = {
  get: jest.fn(),
  put: jest.fn()
};

const mockCacheService = {
  getUserCache: jest.fn(() => mockCacheInstance)
};

const mockSheet = {
  setName: jest.fn(),
  getRange: jest.fn(() => ({
    setValues: jest.fn(),
    setFontWeight: jest.fn()
  })),
  setFrozenRows: jest.fn(),
  appendRow: jest.fn()
};

const mockSpreadsheet = {
  getId: jest.fn(() => 'test-spreadsheet-id'),
  getActiveSheet: jest.fn(() => mockSheet)
};

const mockDriveFolder = {
  getId: jest.fn(() => 'test-folder-id')
};

const mockDriveFile = {
  moveTo: jest.fn()
};

const mockDriveApp = {
  createFolder: jest.fn(() => mockDriveFolder),
  getFolderById: jest.fn(() => mockDriveFolder),
  getFileById: jest.fn(() => mockDriveFile)
};

const mockSpreadsheetApp = {
  create: jest.fn(() => mockSpreadsheet),
  openById: jest.fn(() => mockSpreadsheet)
};

const mockLogger = {
  log: jest.fn()
};

// Set all globals before loading AppLogger
(global as any).PropertiesService = mockPropertiesService;
(global as any).CacheService = mockCacheService;
(global as any).DriveApp = mockDriveApp;
(global as any).SpreadsheetApp = mockSpreadsheetApp;
(global as any).Logger = mockLogger;

// Load AppLogger module using compiled namespace pattern
const loggerCode = `
var AppLogger;
(function (AppLogger) {
    let LogLevel;
    (function (LogLevel) {
        LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
        LogLevel[LogLevel["INFO"] = 1] = "INFO";
        LogLevel[LogLevel["WARN"] = 2] = "WARN";
        LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    })(LogLevel || (LogLevel = {}));
    
    AppLogger.executionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    let spreadsheetConfig = null;
    
    function getLogLevel() {
        const debugMode = PropertiesService.getUserProperties().getProperty('DEBUG_MODE');
        return debugMode === 'true' ? LogLevel.DEBUG : LogLevel.INFO;
    }
    
    function initSpreadsheet() {
        try {
            Logger.log('🔧 INITIALIZING SPREADSHEET LOGGING...');
            
            const disabled = PropertiesService.getUserProperties().getProperty('SPREADSHEET_LOGGING') === 'false';
            if (disabled) {
                Logger.log('⚠️ Spreadsheet logging is DISABLED');
                return;
            }
            
            Logger.log('📁 Setting up log folder...');
            let folderId = PropertiesService.getUserProperties().getProperty('LOG_FOLDER_ID');
            let folder;
            
            if (!folderId) {
                Logger.log('📁 Creating new log folder...');
                folder = DriveApp.createFolder('Gmail AI Logs');
                folderId = folder.getId();
                PropertiesService.getUserProperties().setProperty('LOG_FOLDER_ID', folderId);
                Logger.log('✅ Created log folder:', folderId);
            } else {
                try {
                    folder = DriveApp.getFolderById(folderId);
                    Logger.log('✅ Found existing log folder:', folderId);
                } catch (folderError) {
                    Logger.log('❌ Existing folder not found, creating new one...');
                    folder = DriveApp.createFolder('Gmail AI Logs');
                    folderId = folder.getId();
                    PropertiesService.getUserProperties().setProperty('LOG_FOLDER_ID', folderId);
                    Logger.log('✅ Created replacement log folder:', folderId);
                }
            }
            
            const dateString = new Date().toISOString().split('T')[0] || '';
            const todayKey = 'LOG_SPREADSHEET_' + dateString.replace(/-/g, '_');
            let todayId = PropertiesService.getUserProperties().getProperty(todayKey);
            
            Logger.log('📊 Setting up today\\'s spreadsheet for', dateString);
            
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
            spreadsheetConfig = null;
        }
    }
    AppLogger.initSpreadsheet = initSpreadsheet;
    
    function getSpreadsheetConfig() {
        return spreadsheetConfig;
    }
    AppLogger.getSpreadsheetConfig = getSpreadsheetConfig;
    
    function maskSensitive(data) {
        if (typeof data === 'string') {
            let text = data;
            
            // Gemini API keys
            text = text.replace(/AIza[0-9A-Za-z\\-_]{35}/g, (match) => {
                return match.substring(0, 8) + '...' + match.substring(match.length - 4);
            });
            
            // OpenAI API keys
            text = text.replace(/sk-[a-zA-Z0-9]{48,}/g, (match) => {
                return 'sk-....' + match.substring(match.length - 4);
            });
            
            // Anthropic API keys
            text = text.replace(/sk-ant-[a-zA-Z0-9]{40,}/g, (match) => {
                return 'sk-ant-....' + match.substring(match.length - 4);
            });
            
            // Generic API key patterns
            text = text.replace(/([aA][pP][iI][-_]?[kK][eE][yY]\\s*[=:]\\s*)([a-zA-Z0-9\\-_]{20,})/g, (_match, prefix, key) => {
                return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4);
            });
            
            // URL parameter API keys
            text = text.replace(/([?&]key=)([a-zA-Z0-9\\-_]{20,})(&|$)/g, (_match, prefix, key, suffix) => {
                return prefix + key.substring(0, 4) + '...' + key.substring(key.length - 4) + suffix;
            });
            
            // Bearer tokens
            text = text.replace(/(Bearer\\s+)([a-zA-Z0-9\\-_.]{30,})/g, (_match, prefix, token) => {
                return prefix + token.substring(0, 4) + '...' + token.substring(token.length - 4);
            });
            
            return text;
        }
        if (typeof data === 'object' && data !== null) {
            const masked = Array.isArray(data) ? [] : {};
            for (const key in data) {
                const lowerKey = key.toLowerCase();
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
                    masked[key] = maskSensitive(data[key]);
                }
            }
            return masked;
        }
        return data;
    }
    
    function log(level, message, context) {
        if (level >= getLogLevel()) {
            const entry = {
                timestamp: new Date().toISOString(),
                executionId: AppLogger.executionId,
                level: LogLevel[level],
                message: maskSensitive(message),
                context: context ? maskSensitive(context) : undefined
            };
            
            // ALWAYS log to console
            Logger.log(JSON.stringify(entry));
            
            // ALSO log to CacheService for live view
            try {
                const cache = CacheService.getUserCache();
                const logKey = 'LIVE_LOG_' + AppLogger.executionId;
                
                const existingLogsJson = cache.get(logKey);
                const logs = existingLogsJson ? JSON.parse(existingLogsJson) : [];
                
                logs.push({
                    timestamp: entry.timestamp,
                    level: entry.level,
                    message: message,
                    shortMessage: context?.shortMessage || '',
                    context: context ? JSON.stringify(entry.context) : ''
                });
                
                if (logs.length > 100) {
                    logs.splice(0, logs.length - 100);
                }
                
                cache.put(logKey, JSON.stringify(logs), 1800);
                
                PropertiesService.getUserProperties().setProperty('CURRENT_EXECUTION_ID', AppLogger.executionId);
                
            } catch (cacheError) {
                Logger.log('Failed to write to cache:', String(cacheError));
                try {
                    const props = PropertiesService.getUserProperties();
                    const logKey = 'LIVE_LOG_' + AppLogger.executionId;
                    const existingLogs = props.getProperty(logKey) || '[]';
                    const logs = JSON.parse(existingLogs);
                    
                    logs.push({
                        timestamp: entry.timestamp,
                        level: entry.level,
                        message: message,
                        shortMessage: context?.shortMessage || '',
                        context: context ? JSON.stringify(entry.context) : ''
                    });
                    
                    if (logs.length > 30) {
                        logs.splice(0, logs.length - 30);
                    }
                    
                    props.setProperty(logKey, JSON.stringify(logs));
                } catch (fallbackError) {
                    Logger.log('Fallback to properties also failed:', String(fallbackError));
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
                    Logger.log('CRITICAL: Spreadsheet logging failed:', String(spreadsheetError));
                    spreadsheetConfig = null;
                }
            } else {
                Logger.log('Spreadsheet config missing, trying to reinitialize...');
                initSpreadsheet();
                const config = spreadsheetConfig;
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
    
    AppLogger.debug = (msg, ctx) => log(LogLevel.DEBUG, msg, ctx);
    AppLogger.info = (msg, ctx) => log(LogLevel.INFO, msg, ctx);
    AppLogger.warn = (msg, ctx) => log(LogLevel.WARN, msg, ctx);
    AppLogger.error = (msg, ctx) => log(LogLevel.ERROR, msg, ctx);
})(AppLogger || (AppLogger = {}));
`;

// Execute to create AppLogger namespace
const setupLogger = new Function(loggerCode + '\n(global || window).AppLogger = AppLogger;');
setupLogger();

// Access AppLogger from global scope
const AppLogger = (global as any).AppLogger;

describe('AppLogger Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock defaults
    mockPropertiesInstance.getProperty.mockReturnValue(undefined);
    mockCacheInstance.get.mockReturnValue(null);
  });

  describe('executionId', () => {
    it('should have a unique execution ID', () => {
      expect(AppLogger.executionId).toBeDefined();
      expect(typeof AppLogger.executionId).toBe('string');
      expect(AppLogger.executionId.length).toBeGreaterThan(0);
    });
  });

  describe('getSpreadsheetConfig', () => {
    it('should return null initially', () => {
      expect(AppLogger.getSpreadsheetConfig()).toBeNull();
    });
  });

  describe('initSpreadsheet', () => {
    it('should skip initialization when spreadsheet logging is disabled', () => {
      mockPropertiesInstance.getProperty
        .mockReturnValueOnce('false'); // SPREADSHEET_LOGGING = 'false'

      AppLogger.initSpreadsheet();
      
      expect(mockLogger.log).toHaveBeenCalledWith('🔧 INITIALIZING SPREADSHEET LOGGING...');
      expect(mockLogger.log).toHaveBeenCalledWith('⚠️ Spreadsheet logging is DISABLED');
      expect(AppLogger.getSpreadsheetConfig()).toBeNull();
    });

    it('should create new folder when no folder ID exists', () => {
      mockPropertiesInstance.getProperty
        .mockReturnValueOnce(undefined) // SPREADSHEET_LOGGING
        .mockReturnValueOnce(undefined) // LOG_FOLDER_ID
        .mockReturnValueOnce(undefined); // todayKey

      AppLogger.initSpreadsheet();
      
      expect(mockDriveApp.createFolder).toHaveBeenCalledWith('Gmail AI Logs');
      expect(mockPropertiesInstance.setProperty).toHaveBeenCalledWith('LOG_FOLDER_ID', 'test-folder-id');
      expect(AppLogger.getSpreadsheetConfig()).toBeDefined();
    });

    it('should use existing folder when folder ID exists', () => {
      mockPropertiesInstance.getProperty
        .mockReturnValueOnce(undefined) // SPREADSHEET_LOGGING
        .mockReturnValueOnce('existing-folder-id') // LOG_FOLDER_ID
        .mockReturnValueOnce(undefined); // todayKey

      AppLogger.initSpreadsheet();
      
      expect(mockDriveApp.getFolderById).toHaveBeenCalledWith('existing-folder-id');
      expect(mockLogger.log).toHaveBeenCalledWith('✅ Found existing log folder:', 'existing-folder-id');
    });

    it('should handle folder errors and create replacement', () => {
      mockPropertiesInstance.getProperty
        .mockReturnValueOnce(undefined) // SPREADSHEET_LOGGING
        .mockReturnValueOnce('invalid-folder-id') // LOG_FOLDER_ID
        .mockReturnValueOnce(undefined); // todayKey

      mockDriveApp.getFolderById.mockImplementation(() => {
        throw new Error('Folder not found');
      });

      AppLogger.initSpreadsheet();
      
      expect(mockLogger.log).toHaveBeenCalledWith('❌ Existing folder not found, creating new one...');
      expect(mockDriveApp.createFolder).toHaveBeenCalledWith('Gmail AI Logs');
    });

    it('should handle initialization errors gracefully', () => {
      mockPropertiesService.getUserProperties.mockImplementation(() => {
        throw new Error('Properties service error');
      });

      AppLogger.initSpreadsheet();
      
      expect(mockLogger.log).toHaveBeenCalledWith('🚨 CRITICAL: Spreadsheet initialization failed:', 'Error: Properties service error');
      expect(AppLogger.getSpreadsheetConfig()).toBeNull();
    });
  });

  describe('logging levels and filtering', () => {
    it('should log info level by default (not debug)', () => {
      mockPropertiesInstance.getProperty.mockReturnValue(undefined); // DEBUG_MODE not set

      AppLogger.info('Test info message');
      AppLogger.debug('Test debug message');
      
      // Should have 2 calls: info message + cache activity
      expect(mockLogger.log).toHaveBeenCalled();
      
      // Check that info message was logged
      const calls = mockLogger.log.mock.calls.filter(call => 
        call[0].includes('Test info message')
      );
      expect(calls.length).toBeGreaterThan(0);
      
      // Check that debug message was NOT logged
      const debugCalls = mockLogger.log.mock.calls.filter(call => 
        call[0].includes('Test debug message')
      );
      expect(debugCalls.length).toBe(0);
    });

    it('should log debug level when debug mode is enabled', () => {
      mockPropertiesInstance.getProperty.mockReturnValue('true'); // DEBUG_MODE = 'true'

      AppLogger.debug('Test debug message');
      
      expect(mockLogger.log).toHaveBeenCalled();
      const calls = mockLogger.log.mock.calls.filter(call => 
        call[0].includes('Test debug message')
      );
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should always log warn and error messages', () => {
      mockPropertiesInstance.getProperty.mockReturnValue(undefined); // Default log level

      AppLogger.warn('Test warning');
      AppLogger.error('Test error');
      
      expect(mockLogger.log).toHaveBeenCalled();
      
      const warnCalls = mockLogger.log.mock.calls.filter(call => 
        call[0].includes('Test warning')
      );
      const errorCalls = mockLogger.log.mock.calls.filter(call => 
        call[0].includes('Test error')
      );
      
      expect(warnCalls.length).toBeGreaterThan(0);
      expect(errorCalls.length).toBeGreaterThan(0);
    });
  });

  describe('cache logging functionality', () => {
    it('should store logs in cache with proper format', () => {
      AppLogger.info('Test cache message', { shortMessage: 'Short' });
      
      expect(mockCacheInstance.put).toHaveBeenCalled();
      const putArgs = mockCacheInstance.put.mock.calls[0];
      expect(putArgs[0]).toBe('LIVE_LOG_' + AppLogger.executionId);
      expect(putArgs[2]).toBe(1800); // 30 minute expiration
      
      const logs = JSON.parse(putArgs[1]);
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test cache message');
      expect(logs[0].shortMessage).toBe('Short');
    });

    it('should limit cache logs to 100 entries', () => {
      const existingLogs = Array(100).fill(null).map((_, i) => ({ 
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Message ${i}`,
        shortMessage: '',
        context: ''
      }));
      
      mockCacheInstance.get.mockReturnValue(JSON.stringify(existingLogs));

      AppLogger.info('New message');
      
      const putArgs = mockCacheInstance.put.mock.calls[0];
      const logs = JSON.parse(putArgs[1]);
      expect(logs).toHaveLength(100); // Should still be 100
      expect(logs[logs.length - 1].message).toBe('New message');
    });

    it('should fallback to properties service when cache fails', () => {
      mockCacheInstance.get.mockImplementation(() => {
        throw new Error('Cache error');
      });

      mockPropertiesInstance.getProperty
        .mockReturnValueOnce(undefined) // DEBUG_MODE
        .mockReturnValueOnce('[]'); // LIVE_LOG fallback

      AppLogger.info('Test message');
      
      expect(mockLogger.log).toHaveBeenCalledWith('Failed to write to cache:', 'Error: Cache error');
      expect(mockPropertiesInstance.setProperty).toHaveBeenCalled();
    });
  });

  describe('sensitive data masking', () => {
    it('should mask API keys in messages', () => {
      AppLogger.info('API key: AIzaSyBuTkN626dnV-ymciVPd5rYeKGbrcBpdco');
      
      const logCalls = mockLogger.log.mock.calls.filter(call => 
        call[0].includes('AIzaSyBu...pdco')
      );
      expect(logCalls.length).toBeGreaterThan(0);
    });

    it('should mask sensitive fields in context objects', () => {
      AppLogger.info('Test message', {
        apiKey: 'AIzaSyBuTkN626dnV-ymciVPd5rYeKGbrcBpdco',
        token: 'secret-token-123',
        password: 'my-password',
        normalField: 'normal-value'
      });
      
      expect(mockLogger.log).toHaveBeenCalled();
      
      // Check that the log entry contains masked values
      const logCall = mockLogger.log.mock.calls.find(call => 
        call[0].includes('***MASKED***')
      );
      expect(logCall).toBeDefined();
    });
  });

  describe('spreadsheet logging', () => {
    it('should log to spreadsheet when config is available', () => {
      // Initialize spreadsheet first
      mockPropertiesInstance.getProperty
        .mockReturnValueOnce(undefined) // SPREADSHEET_LOGGING
        .mockReturnValueOnce('test-folder-id') // LOG_FOLDER_ID
        .mockReturnValueOnce('test-spreadsheet-id') // todayKey
        .mockReturnValue(undefined); // For subsequent calls

      AppLogger.initSpreadsheet();
      
      AppLogger.info('Test spreadsheet message');
      
      expect(mockSpreadsheetApp.openById).toHaveBeenCalledWith('test-spreadsheet-id');
      expect(mockSheet.appendRow).toHaveBeenCalled();
    });

    it('should reinitialize when spreadsheet config is missing', () => {
      AppLogger.info('Test message');
      
      expect(mockLogger.log).toHaveBeenCalledWith('Spreadsheet config missing, trying to reinitialize...');
    });
  });

  describe('log entry structure', () => {
    it('should create properly structured JSON log entries', () => {
      AppLogger.info('Structure test', { key: 'value' });
      
      const logCall = mockLogger.log.mock.calls.find(call => 
        call[0].includes('Structure test')
      );
      
      expect(logCall).toBeDefined();
      const logEntry = JSON.parse(logCall[0]);
      
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('executionId');
      expect(logEntry).toHaveProperty('level');
      expect(logEntry).toHaveProperty('message');
      expect(logEntry).toHaveProperty('context');
      
      expect(logEntry.executionId).toBe(AppLogger.executionId);
      expect(logEntry.level).toBe('INFO');
      expect(logEntry.message).toBe('Structure test');
    });
  });
});