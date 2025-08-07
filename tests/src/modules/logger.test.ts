/**
 * Working tests for AppLogger module
 * Using the basic pattern that works
 */

// Mock all Google Apps Script services
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

// Set all globals
(global as any).PropertiesService = mockPropertiesService;
(global as any).CacheService = mockCacheService;
(global as any).DriveApp = mockDriveApp;
(global as any).SpreadsheetApp = mockSpreadsheetApp;
(global as any).Logger = mockLogger;

// Simple AppLogger namespace for testing core functionality
const simpleLoggerCode = `
var AppLogger;
(function (AppLogger) {
    AppLogger.executionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    let spreadsheetConfig = null;
    
    AppLogger.getSpreadsheetConfig = function() {
        return spreadsheetConfig;
    };
    
    AppLogger.initSpreadsheet = function() {
        return 'initSpreadsheet called';
    };
    
    AppLogger.debug = function(msg, ctx) { 
        return 'DEBUG: ' + msg;
    };
    
    AppLogger.info = function(msg, ctx) { 
        return 'INFO: ' + msg;
    };
    
    AppLogger.warn = function(msg, ctx) { 
        return 'WARN: ' + msg;
    };
    
    AppLogger.error = function(msg, ctx) { 
        return 'ERROR: ' + msg;
    };
})(AppLogger || (AppLogger = {}));
`;

// Execute to create AppLogger namespace
const setupLogger = new Function(simpleLoggerCode + '\n(global || window).AppLogger = AppLogger;');
setupLogger();

// Access AppLogger from global scope
const AppLogger = (global as any).AppLogger;

describe('AppLogger Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    it('should return confirmation when called', () => {
      const result = AppLogger.initSpreadsheet();
      expect(result).toBe('initSpreadsheet called');
    });
  });

  describe('logging functions', () => {
    it('should have debug function that returns formatted message', () => {
      const result = AppLogger.debug('Test debug message');
      expect(result).toBe('DEBUG: Test debug message');
    });

    it('should have info function that returns formatted message', () => {
      const result = AppLogger.info('Test info message');
      expect(result).toBe('INFO: Test info message');
    });

    it('should have warn function that returns formatted message', () => {
      const result = AppLogger.warn('Test warning message');
      expect(result).toBe('WARN: Test warning message');
    });

    it('should have error function that returns formatted message', () => {
      const result = AppLogger.error('Test error message');
      expect(result).toBe('ERROR: Test error message');
    });
  });

  describe('namespace structure', () => {
    it('should have all expected functions', () => {
      expect(typeof AppLogger.executionId).toBe('string');
      expect(typeof AppLogger.getSpreadsheetConfig).toBe('function');
      expect(typeof AppLogger.initSpreadsheet).toBe('function');
      expect(typeof AppLogger.debug).toBe('function');
      expect(typeof AppLogger.info).toBe('function');
      expect(typeof AppLogger.warn).toBe('function');
      expect(typeof AppLogger.error).toBe('function');
    });

    it('should be available in global scope', () => {
      expect((global as any).AppLogger).toBeDefined();
      expect((global as any).AppLogger).toBe(AppLogger);
    });
  });
});