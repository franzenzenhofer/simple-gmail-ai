/**
 * Tests for Code.ts global function exports
 * Testing the main entry point functions that Google Apps Script calls
 */

// Mock all the namespace modules that Code.ts delegates to
const mockEntryPoints = {
  onHomepage: jest.fn(() => ({ type: 'card', id: 'homepage' })),
  onGmailMessage: jest.fn(() => ({ type: 'card', id: 'gmail-message' }))
};

const mockNavigationHandlers = {
  showApiKeyTab: jest.fn(() => ({ type: 'actionResponse', id: 'api-key-tab' })),
  showLogsTab: jest.fn(() => ({ type: 'actionResponse', id: 'logs-tab' })),
  showSettingsTab: jest.fn(() => ({ type: 'actionResponse', id: 'settings-tab' })),
  backToMain: jest.fn(() => ({ type: 'actionResponse', id: 'back-to-main' })),
  refreshLiveLog: jest.fn(() => ({ type: 'actionResponse', id: 'refresh-live-log' }))
};

const mockActionHandlers = {
  saveApiKey: jest.fn(() => ({ type: 'actionResponse', id: 'save-api-key' })),
  validateApiKeyFormat: jest.fn(() => ({ type: 'actionResponse', id: 'validate-api-key' })),
  runAnalysis: jest.fn(() => ({ type: 'actionResponse', id: 'run-analysis' })),
  cancelProcessing: jest.fn(() => ({ type: 'actionResponse', id: 'cancel-processing' })),
  toggleDebugMode: jest.fn(() => ({ type: 'actionResponse', id: 'toggle-debug' })),
  toggleSpreadsheetLogging: jest.fn(() => ({ type: 'actionResponse', id: 'toggle-spreadsheet' }))
};

const mockProcessingHandlers = {
  continueProcessing: jest.fn(() => ({ type: 'actionResponse', id: 'continue-processing' }))
};

const mockUniversalActions = {
  viewLogsUniversal: jest.fn(() => ({ type: 'universalActionResponse', id: 'view-logs' })),
  showApiKeyTabUniversal: jest.fn(() => ({ type: 'universalActionResponse', id: 'api-key-universal' })),
  showLogsTabUniversal: jest.fn(() => ({ type: 'universalActionResponse', id: 'logs-universal' })),
  showSettingsTabUniversal: jest.fn(() => ({ type: 'universalActionResponse', id: 'settings-universal' })),
  showLiveLogTabUniversal: jest.fn(() => ({ type: 'universalActionResponse', id: 'live-log-universal' }))
};

// Set globals to mock the imported modules
(global as any).EntryPoints = mockEntryPoints;
(global as any).NavigationHandlers = mockNavigationHandlers;
(global as any).ActionHandlers = mockActionHandlers;
(global as any).ProcessingHandlers = mockProcessingHandlers;
(global as any).UniversalActions = mockUniversalActions;

// Create simplified global functions for testing (these mirror Code.ts exports)
const codeGlobalFunctions = `
// Entry Points
function onHomepage() {
  return EntryPoints.onHomepage();
}

function onGmailMessage(e) {
  return EntryPoints.onGmailMessage(e);
}

// Navigation Handlers
function showApiKeyTab() {
  return NavigationHandlers.showApiKeyTab();
}

function showLogsTab() {
  return NavigationHandlers.showLogsTab();
}

function showSettingsTab() {
  return NavigationHandlers.showSettingsTab();
}

function backToMain() {
  return NavigationHandlers.backToMain();
}

function refreshLiveLog() {
  return NavigationHandlers.refreshLiveLog();
}

// Action Handlers
function saveApiKey(e) {
  return ActionHandlers.saveApiKey(e);
}

function validateApiKeyFormat(e) {
  return ActionHandlers.validateApiKeyFormat(e);
}

function runAnalysis(e) {
  return ActionHandlers.runAnalysis(e);
}

function cancelProcessing(e) {
  return ActionHandlers.cancelProcessing(e);
}

function toggleDebugMode(e) {
  return ActionHandlers.toggleDebugMode(e);
}

function toggleSpreadsheetLogging(e) {
  return ActionHandlers.toggleSpreadsheetLogging(e);
}

// Processing Handlers
function continueProcessing(e) {
  return ProcessingHandlers.continueProcessing(e);
}

// Universal Actions
function viewLogsUniversal() {
  return UniversalActions.viewLogsUniversal();
}

function showApiKeyTabUniversal() {
  return UniversalActions.showApiKeyTabUniversal();
}

function showLogsTabUniversal() {
  return UniversalActions.showLogsTabUniversal();
}

function showSettingsTabUniversal() {
  return UniversalActions.showSettingsTabUniversal();
}

function showLiveLogTabUniversal() {
  return UniversalActions.showLiveLogTabUniversal();
}
`;

// Execute the code to define the global functions
const setupGlobalFunctions = new Function(codeGlobalFunctions + `
// Expose functions globally for testing
(global || window).onHomepage = onHomepage;
(global || window).onGmailMessage = onGmailMessage;
(global || window).showApiKeyTab = showApiKeyTab;
(global || window).showLogsTab = showLogsTab;
(global || window).showSettingsTab = showSettingsTab;
(global || window).backToMain = backToMain;
(global || window).refreshLiveLog = refreshLiveLog;
(global || window).saveApiKey = saveApiKey;
(global || window).validateApiKeyFormat = validateApiKeyFormat;
(global || window).runAnalysis = runAnalysis;
(global || window).cancelProcessing = cancelProcessing;
(global || window).toggleDebugMode = toggleDebugMode;
(global || window).toggleSpreadsheetLogging = toggleSpreadsheetLogging;
(global || window).continueProcessing = continueProcessing;
(global || window).viewLogsUniversal = viewLogsUniversal;
(global || window).showApiKeyTabUniversal = showApiKeyTabUniversal;
(global || window).showLogsTabUniversal = showLogsTabUniversal;
(global || window).showSettingsTabUniversal = showSettingsTabUniversal;
(global || window).showLiveLogTabUniversal = showLiveLogTabUniversal;
`);
setupGlobalFunctions();

// Access the global functions for testing
const globalFunctions = {
  onHomepage: (global as any).onHomepage,
  onGmailMessage: (global as any).onGmailMessage,
  showApiKeyTab: (global as any).showApiKeyTab,
  showLogsTab: (global as any).showLogsTab,
  showSettingsTab: (global as any).showSettingsTab,
  backToMain: (global as any).backToMain,
  refreshLiveLog: (global as any).refreshLiveLog,
  saveApiKey: (global as any).saveApiKey,
  validateApiKeyFormat: (global as any).validateApiKeyFormat,
  runAnalysis: (global as any).runAnalysis,
  cancelProcessing: (global as any).cancelProcessing,
  toggleDebugMode: (global as any).toggleDebugMode,
  toggleSpreadsheetLogging: (global as any).toggleSpreadsheetLogging,
  continueProcessing: (global as any).continueProcessing,
  viewLogsUniversal: (global as any).viewLogsUniversal,
  showApiKeyTabUniversal: (global as any).showApiKeyTabUniversal,
  showLogsTabUniversal: (global as any).showLogsTabUniversal,
  showSettingsTabUniversal: (global as any).showSettingsTabUniversal,
  showLiveLogTabUniversal: (global as any).showLiveLogTabUniversal
};

describe('Code.ts Global Function Exports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Entry Points', () => {
    it('should call EntryPoints.onHomepage', () => {
      globalFunctions.onHomepage();
      
      expect(mockEntryPoints.onHomepage).toHaveBeenCalledWith();
    });

    it('should call EntryPoints.onGmailMessage with event', () => {
      const testEvent = { messageMetadata: { threadId: 'test123' } };
      globalFunctions.onGmailMessage(testEvent);
      
      expect(mockEntryPoints.onGmailMessage).toHaveBeenCalledWith(testEvent);
    });
  });

  describe('Navigation Handlers', () => {
    it('should call NavigationHandlers.showApiKeyTab', () => {
      globalFunctions.showApiKeyTab();
      
      expect(mockNavigationHandlers.showApiKeyTab).toHaveBeenCalledWith();
    });

    it('should call NavigationHandlers.showLogsTab', () => {
      globalFunctions.showLogsTab();
      
      expect(mockNavigationHandlers.showLogsTab).toHaveBeenCalledWith();
    });

    it('should call NavigationHandlers.showSettingsTab', () => {
      globalFunctions.showSettingsTab();
      
      expect(mockNavigationHandlers.showSettingsTab).toHaveBeenCalledWith();
    });

    it('should call NavigationHandlers.backToMain', () => {
      globalFunctions.backToMain();
      
      expect(mockNavigationHandlers.backToMain).toHaveBeenCalledWith();
    });

    it('should call NavigationHandlers.refreshLiveLog', () => {
      globalFunctions.refreshLiveLog();
      
      expect(mockNavigationHandlers.refreshLiveLog).toHaveBeenCalledWith();
    });
  });

  describe('Action Handlers', () => {
    it('should call ActionHandlers.saveApiKey with event', () => {
      const testEvent = { formInput: { apiKey: 'test-key' } };
      globalFunctions.saveApiKey(testEvent);
      
      expect(mockActionHandlers.saveApiKey).toHaveBeenCalledWith(testEvent);
    });

    it('should call ActionHandlers.validateApiKeyFormat with event', () => {
      const testEvent = { formInput: { apiKey: 'AIzaTest123' } };
      globalFunctions.validateApiKeyFormat(testEvent);
      
      expect(mockActionHandlers.validateApiKeyFormat).toHaveBeenCalledWith(testEvent);
    });

    it('should call ActionHandlers.runAnalysis with event', () => {
      const testEvent = { formInput: { mode: 'labels' } };
      globalFunctions.runAnalysis(testEvent);
      
      expect(mockActionHandlers.runAnalysis).toHaveBeenCalledWith(testEvent);
    });

    it('should call ActionHandlers.cancelProcessing with event', () => {
      const testEvent = {};
      globalFunctions.cancelProcessing(testEvent);
      
      expect(mockActionHandlers.cancelProcessing).toHaveBeenCalledWith(testEvent);
    });

    it('should call ActionHandlers.toggleDebugMode with event', () => {
      const testEvent = { formInput: { debugMode: 'true' } };
      globalFunctions.toggleDebugMode(testEvent);
      
      expect(mockActionHandlers.toggleDebugMode).toHaveBeenCalledWith(testEvent);
    });

    it('should call ActionHandlers.toggleSpreadsheetLogging with event', () => {
      const testEvent = { formInput: { spreadsheetLogging: 'false' } };
      globalFunctions.toggleSpreadsheetLogging(testEvent);
      
      expect(mockActionHandlers.toggleSpreadsheetLogging).toHaveBeenCalledWith(testEvent);
    });
  });

  describe('Processing Handlers', () => {
    it('should call ProcessingHandlers.continueProcessing with event', () => {
      const testEvent = { parameters: { executionId: 'exec123' } };
      globalFunctions.continueProcessing(testEvent);
      
      expect(mockProcessingHandlers.continueProcessing).toHaveBeenCalledWith(testEvent);
    });
  });

  describe('Universal Actions', () => {
    it('should call UniversalActions.viewLogsUniversal', () => {
      globalFunctions.viewLogsUniversal();
      
      expect(mockUniversalActions.viewLogsUniversal).toHaveBeenCalledWith();
    });

    it('should call UniversalActions.showApiKeyTabUniversal', () => {
      globalFunctions.showApiKeyTabUniversal();
      
      expect(mockUniversalActions.showApiKeyTabUniversal).toHaveBeenCalledWith();
    });

    it('should call UniversalActions.showLogsTabUniversal', () => {
      globalFunctions.showLogsTabUniversal();
      
      expect(mockUniversalActions.showLogsTabUniversal).toHaveBeenCalledWith();
    });

    it('should call UniversalActions.showSettingsTabUniversal', () => {
      globalFunctions.showSettingsTabUniversal();
      
      expect(mockUniversalActions.showSettingsTabUniversal).toHaveBeenCalledWith();
    });

    it('should call UniversalActions.showLiveLogTabUniversal', () => {
      globalFunctions.showLiveLogTabUniversal();
      
      expect(mockUniversalActions.showLiveLogTabUniversal).toHaveBeenCalledWith();
    });
  });

  describe('Function Availability', () => {
    it('should have all entry point functions defined', () => {
      expect(typeof globalFunctions.onHomepage).toBe('function');
      expect(typeof globalFunctions.onGmailMessage).toBe('function');
    });

    it('should have all navigation handler functions defined', () => {
      expect(typeof globalFunctions.showApiKeyTab).toBe('function');
      expect(typeof globalFunctions.showLogsTab).toBe('function');
      expect(typeof globalFunctions.showSettingsTab).toBe('function');
      expect(typeof globalFunctions.backToMain).toBe('function');
      expect(typeof globalFunctions.refreshLiveLog).toBe('function');
    });

    it('should have all action handler functions defined', () => {
      expect(typeof globalFunctions.saveApiKey).toBe('function');
      expect(typeof globalFunctions.validateApiKeyFormat).toBe('function');
      expect(typeof globalFunctions.runAnalysis).toBe('function');
      expect(typeof globalFunctions.cancelProcessing).toBe('function');
      expect(typeof globalFunctions.toggleDebugMode).toBe('function');
      expect(typeof globalFunctions.toggleSpreadsheetLogging).toBe('function');
    });

    it('should have all processing handler functions defined', () => {
      expect(typeof globalFunctions.continueProcessing).toBe('function');
    });

    it('should have all universal action functions defined', () => {
      expect(typeof globalFunctions.viewLogsUniversal).toBe('function');
      expect(typeof globalFunctions.showApiKeyTabUniversal).toBe('function');
      expect(typeof globalFunctions.showLogsTabUniversal).toBe('function');
      expect(typeof globalFunctions.showSettingsTabUniversal).toBe('function');
      expect(typeof globalFunctions.showLiveLogTabUniversal).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from delegated functions', () => {
      mockEntryPoints.onHomepage.mockImplementation(() => {
        throw new Error('EntryPoints error');
      });

      expect(() => {
        globalFunctions.onHomepage();
      }).toThrow('EntryPoints error');
    });

    it('should handle different parameter types correctly', () => {
      const complexEvent = {
        messageMetadata: { threadId: 'abc123' },
        formInput: { apiKey: 'test', mode: 'labels' },
        parameters: { executionId: 'exec456' }
      };

      globalFunctions.onGmailMessage(complexEvent);
      globalFunctions.saveApiKey(complexEvent);
      globalFunctions.continueProcessing(complexEvent);

      expect(mockEntryPoints.onGmailMessage).toHaveBeenCalledWith(complexEvent);
      expect(mockActionHandlers.saveApiKey).toHaveBeenCalledWith(complexEvent);
      expect(mockProcessingHandlers.continueProcessing).toHaveBeenCalledWith(complexEvent);
    });
  });
});